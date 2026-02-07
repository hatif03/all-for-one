import type { Edge, Node } from "@xyflow/react";
import { nanoid } from "nanoid";
import { discoverOperations, type DiscoveredStep } from "./api-discovery";
import type { RequirementClarification, RequirementStep } from "./requirement-store";

export interface GenerateWorkflowOptions {
  onProgress?: GenerateProgressCallback;
  clarificationValues?: Record<string, string>;
  clarifications?: RequirementClarification[];
}

/** Infer targetField from question text when AI omits it */
function inferFieldFromQuestion(question: string): string | undefined {
  const q = question.toLowerCase();
  if (q.includes("subject")) return "subject";
  if (q.includes("body") || q.includes("content")) return "body";
  if (q.includes("who receive") || q.includes("recipient") || q.includes("to whom")) return "to";
  if (q.includes("delay") || q.includes("how long") || q.includes("wait")) return "delayHours";
  if (q.includes("channel")) return "channel";
  if (q.includes("message") || q.includes("what to post")) return "message";
  return undefined;
}

/** Build map stepId -> { targetField -> value } from clarifications and clarificationValues (keys: stepId-index) */
function buildClarificationOverrides(
  clarificationValues?: Record<string, string>,
  clarifications?: RequirementClarification[]
): Map<string, Record<string, string>> {
  const byStep = new Map<string, Record<string, string>>();
  if (!clarifications?.length || !clarificationValues) return byStep;
  clarifications.forEach((c, idx) => {
    const key = `${c.stepId}-${idx}`;
    const value = clarificationValues[key];
    if (value == null || value.trim() === "") return;
    const field = c.targetField ?? inferFieldFromQuestion(c.question);
    if (!field) return;
    let row = byStep.get(c.stepId);
    if (!row) {
      row = {};
      byStep.set(c.stepId, row);
    }
    row[field] = value.trim();
  });
  return byStep;
}

/** Apply user clarification overrides to node data by type */
function applyClarificationOverrides(
  data: Record<string, unknown>,
  type: string,
  overrides: Record<string, string> | undefined
): void {
  if (!overrides || Object.keys(overrides).length === 0) return;
  if (type === "action-email") {
    if (overrides.to != null) data.to = overrides.to;
    if (overrides.subject != null) data.subject = overrides.subject;
    if (overrides.body != null) data.body = overrides.body;
    const items = data.items as { to?: string; subject?: string; body?: string }[] | undefined;
    if (Array.isArray(items) && items.length > 0) {
      if (overrides.to != null) items[0].to = overrides.to;
      if (overrides.subject != null) items[0].subject = overrides.subject;
      if (overrides.body != null) items[0].body = overrides.body;
    }
  } else if (type === "action-slack") {
    if (overrides.channel != null) data.channel = overrides.channel;
    if (overrides.message != null) data.message = overrides.message;
    const items = data.items as { channel?: string; message?: string }[] | undefined;
    if (Array.isArray(items) && items.length > 0) {
      if (overrides.channel != null) items[0].channel = overrides.channel;
      if (overrides.message != null) items[0].message = overrides.message;
    }
  } else if (type === "control-delay") {
    const parseDelay = (v: string): { hours?: number; minutes?: number } => {
      const match = String(v).trim().match(/(\d+)\s*(day|days|hour|hours|min|minutes?)?/i);
      if (!match) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) return { hours: n };
        return {};
      }
      const num = parseInt(match[1], 10);
      const unit = (match[2] ?? "").toLowerCase();
      if (unit.startsWith("d")) return { hours: num * 24 };
      if (unit.startsWith("h")) return { hours: num };
      if (unit.startsWith("m")) return { minutes: num };
      return { hours: num };
    };
    if (overrides.delayHours != null) {
      const parsed = parseDelay(overrides.delayHours);
      if (parsed.hours != null) data.delayHours = parsed.hours;
      if (parsed.minutes != null) data.delayMinutes = parsed.minutes;
    }
    if (overrides.delayMinutes != null) {
      const n = parseInt(overrides.delayMinutes, 10);
      if (!Number.isNaN(n)) data.delayMinutes = n;
    }
    const d = overrides.delay ?? overrides["how long"];
    if (d != null && overrides.delayHours == null && overrides.delayMinutes == null) {
      const parsed = parseDelay(d);
      if (parsed.hours != null) data.delayHours = parsed.hours;
      if (parsed.minutes != null) data.delayMinutes = parsed.minutes;
    }
  } else if (type === "action-http" && data.catalogParamValues && typeof data.catalogParamValues === "object") {
    const pv = data.catalogParamValues as Record<string, string>;
    for (const [k, v] of Object.entries(overrides)) {
      if (k !== "to" && k !== "subject" && k !== "body" && k !== "channel" && k !== "message" && k !== "delayHours" && k !== "delayMinutes" && k !== "delay") pv[k] = v;
    }
  }
}

const NODE_WIDTH = 280;
const NODE_HEIGHT = 200;
const GAP_X = 80;
const GAP_Y = 120;

function stepToNodeType(step: DiscoveredStep, stepIndex: number, isFirst: boolean): string {
  const desc = step.description.toLowerCase();
  const svc = step.suggestedService?.toLowerCase();

  // First step can be a trigger type
  if (isFirst && (svc === "webhook" || desc.includes("webhook") || desc.includes("form submit") || desc.includes("incoming")))
    return "trigger-webhook";
  if (isFirst && (svc === "schedule" || desc.includes("schedule") || desc.includes("daily") || desc.includes("weekly") || desc.includes("cron")))
    return "trigger-schedule";

  if (step.operation?.id?.includes("sendgrid") || step.operation?.id?.includes("gmail")) return "action-email";
  if (step.operation?.id?.includes("slack")) return "action-slack";
  if (svc === "document" || desc.includes("document") || desc.includes("pdf") || desc.includes("extract")) return "action-document";
  if (svc === "condition" || desc.includes(" if ") || desc.includes("branch") || desc.includes("else")) return "control-condition";
  if (svc === "transform" || desc.includes("map ") || desc.includes("transform") || desc.includes("reshape")) return "data-transform";
  if (desc.includes("approval") || desc.includes("approve")) return "control-approval";
  if (desc.includes("delay") || desc.includes("wait") || desc.includes("later")) return "control-delay";
  if (step.serviceId === "http" || svc === "http") return "action-http";
  if (svc === "email") return "action-email";
  if (svc === "slack") return "action-slack";
  if (svc === "approval") return "control-approval";
  if (svc === "delay") return "control-delay";
  return "action-http";
}

function stepToNodeData(type: string, step: DiscoveredStep): Record<string, unknown> {
  const d = step.description;
  switch (type) {
    case "trigger-webhook":
      return { path: "/webhook", method: "POST" };
    case "trigger-schedule":
      return { cron: "0 9 * * 1-5", description: d || "Weekday 9am" };
    case "action-email": {
      const opId = step.operation?.id ?? "";
      const pm = step.paramMapping ?? {};
      if (opId === "gmail-list") {
        return { operation: "list", query: pm.query ?? "is:unread", maxResults: pm.maxResults ? Number(pm.maxResults) : 50, service: "Gmail" };
      }
      if (opId === "gmail-get") {
        return { operation: "get", messageId: pm.id ?? "{{messageId}}", service: "Gmail" };
      }
      return {
        operation: "send",
        to: pm.to ?? "{{to}}",
        subject: pm.subject ?? "Notification",
        body: pm.body ?? d,
        service: opId.includes("gmail") ? "Gmail" : "SendGrid",
      };
    }
    case "action-slack": {
      const opId = step.operation?.id ?? "";
      const pm = step.paramMapping ?? {};
      if (opId === "slack-invite") {
        return { operation: "invite_user", email: pm.email ?? "{{email}}" };
      }
      if (opId === "slack-create-channel") {
        return { operation: "create_channel", channelName: pm.name ?? "{{channelName}}", isPrivate: false };
      }
      if (opId === "slack-invite-to-channel") {
        return { operation: "invite_to_channel", channel: pm.channel ?? "{{channel}}", users: pm.users ?? "{{users}}" };
      }
      if (opId === "slack-channel-history") {
        return { operation: "channel_history", channel: pm.channel ?? "{{channel}}", limit: pm.limit ? Number(pm.limit) : 10 };
      }
      if (opId === "slack-list-channels") {
        return { operation: "list_channels", limit: pm.limit ? Number(pm.limit) : 50 };
      }
      if (opId === "slack-reaction") {
        return {
          operation: "reaction",
          channel: pm.channel ?? "{{channel}}",
          timestamp: pm.timestamp ?? "{{timestamp}}",
          reactionName: pm.name ?? "thumbsup",
        };
      }
      return { operation: "post_message", channel: pm.channel ?? "#general", message: pm.text ?? d };
    }
    case "action-document":
      return { format: "pdf", extractFields: "" };
    case "control-condition":
      return { condition: d, leftOperand: "{{value}}", operator: "eq", rightOperand: "" };
    case "data-transform":
      return { mapping: "", outputKey: "payload" };
    case "control-approval":
      return { title: "Approve", description: d };
    case "control-delay":
      return { delayMinutes: 0, delayHours: 24 };
    case "action-http":
      return {
        method: (step.operation?.method as string) || "POST",
        url: step.operation?.urlTemplate ?? "https://api.example.com/action",
        body: undefined,
        bodyType: "json",
        catalogServiceId: step.serviceId,
        catalogOperationId: step.operation?.id,
        catalogParamValues: step.paramMapping ? Object.fromEntries(Object.entries(step.paramMapping).map(([k, v]) => [k, v])) : undefined,
      };
    default:
      return {};
  }
}

function isMergeableEmailSend(step: DiscoveredStep, type: string): boolean {
  if (type !== "action-email") return false;
  const opId = step.operation?.id ?? "";
  return opId !== "gmail-list" && opId !== "gmail-get";
}

function isMergeableSlackPost(step: DiscoveredStep, type: string): boolean {
  if (type !== "action-slack") return false;
  const opId = step.operation?.id ?? "";
  const nonPost = [
    "slack-invite",
    "slack-create-channel",
    "slack-invite-to-channel",
    "slack-channel-history",
    "slack-list-channels",
    "slack-reaction",
  ];
  return !nonPost.includes(opId);
}

type StepGroup = { type: string; steps: DiscoveredStep[] };

function buildStepGroups(discovered: DiscoveredStep[], startIndex: number): StepGroup[] {
  const groups: StepGroup[] = [];
  let i = startIndex;
  while (i < discovered.length) {
    const step = discovered[i];
    const type = stepToNodeType(step, i, false);
    if (isMergeableEmailSend(step, type)) {
      const steps: DiscoveredStep[] = [step];
      i++;
      while (i < discovered.length) {
        const next = discovered[i];
        const nextType = stepToNodeType(next, i, false);
        if (isMergeableEmailSend(next, nextType)) {
          steps.push(next);
          i++;
        } else break;
      }
      groups.push({ type: "action-email", steps });
      continue;
    }
    if (isMergeableSlackPost(step, type)) {
      const steps: DiscoveredStep[] = [step];
      i++;
      while (i < discovered.length) {
        const next = discovered[i];
        const nextType = stepToNodeType(next, i, false);
        if (isMergeableSlackPost(next, nextType)) {
          steps.push(next);
          i++;
        } else break;
      }
      groups.push({ type: "action-slack", steps });
      continue;
    }
    groups.push({ type, steps: [step] });
    i++;
  }
  return groups;
}

export type GenerateProgressCallback = (phase: string, detail?: string) => void;

export async function generateWorkflowFromSteps(
  steps: RequirementStep[],
  workflowName: string,
  options?: GenerateWorkflowOptions
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const { onProgress, clarificationValues, clarifications } = options ?? {};
  const overridesByStep = buildClarificationOverrides(clarificationValues, clarifications);

  onProgress?.("Discovering operations", "");
  const discovered = await discoverOperations(steps, onProgress, {
    clarificationValues,
    clarifications,
  });
  onProgress?.("Building workflow", "");
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const first = discovered[0];
  const useAltTrigger =
    first &&
    (first.suggestedService === "webhook" ||
      first.suggestedService === "schedule" ||
      /webhook|schedule|daily|weekly|form submit|incoming/i.test(first.description));

  let triggerId: string;
  let startIndex: number;

  const shortLabel = (text: string, max = 50) =>
    (text?.length ?? 0) <= max ? text ?? "" : (text ?? "").slice(0, max - 3) + "...";

  if (useAltTrigger && first) {
    const triggerType = stepToNodeType(first, 0, true);
    triggerId = nanoid();
    nodes.push({
      id: triggerId,
      type: triggerType,
      position: { x: 0, y: 0 },
      data: { ...stepToNodeData(triggerType, first), label: shortLabel(first.description) },
      width: NODE_WIDTH,
      height: 120,
    });
    startIndex = 1;
  } else {
    triggerId = nanoid();
    nodes.push({
      id: triggerId,
      type: "trigger-manual",
      position: { x: 0, y: 0 },
      data: {},
      width: NODE_WIDTH,
      height: 120,
    });
    startIndex = 0;
  }

  let prevId = triggerId;
  let y = 0;

  const groups = buildStepGroups(discovered, startIndex);
  for (const group of groups) {
    const { type, steps: groupSteps } = group;
    const step = groupSteps[0];
    const requirementStep = steps.find((s) => String(s.id) === String(step.stepId));
    const nodeId = nanoid();
    let data: Record<string, unknown>;
    if (groupSteps.length === 1) {
      data = { ...stepToNodeData(type, step), label: shortLabel(step.description) };
    } else if (type === "action-email") {
      const firstData = stepToNodeData(type, step) as Record<string, unknown>;
      data = {
        operation: "send",
        service: firstData.service ?? "SendGrid",
        items: groupSteps.map((s) => ({
          label: shortLabel(s.description),
          to: "{{to}}",
          subject: "Notification",
          body: s.description ?? "",
        })),
        label: groupSteps.length > 1 ? `${groupSteps.length} emails` : shortLabel(step.description),
      };
    } else if (type === "action-slack") {
      data = {
        operation: "post_message",
        items: groupSteps.map((s) => ({
          label: shortLabel(s.description),
          channel: "#general",
          message: s.description ?? "",
        })),
        label: groupSteps.length > 1 ? `${groupSteps.length} messages` : shortLabel(step.description),
      };
    } else {
      data = { ...stepToNodeData(type, step), label: shortLabel(step.description) };
    }
    const overrides = overridesByStep.get(step.stepId);
    applyClarificationOverrides(data, type, overrides);
    data.reason = requirementStep?.reason ?? shortLabel(step.description);
    const height = type.startsWith("control-") ? 180 : NODE_HEIGHT;
    nodes.push({
      id: nodeId,
      type,
      position: { x: 0, y: y + GAP_Y },
      data,
      width: NODE_WIDTH,
      height,
    });
    edges.push({
      id: nanoid(),
      source: prevId,
      target: nodeId,
    });
    prevId = nodeId;
    y += GAP_Y + height;
  }

  // Add annotation summarizing the workflow (showcases annotation node)
  const annotationId = nanoid();
  nodes.push({
    id: annotationId,
    type: "annotation",
    position: { x: NODE_WIDTH + GAP_X, y: 40 },
    data: {
      text: `**${workflowName}**\n\nGenerated from your description. Edit nodes to set credentials and parameters. Use **Connections** in the sidebar to link APIs.`,
    },
    width: 280,
    height: 120,
  });

  return { nodes, edges };
}
