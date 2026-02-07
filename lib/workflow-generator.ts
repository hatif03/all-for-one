import type { Edge, Node } from "@xyflow/react";
import { nanoid } from "nanoid";
import { discoverOperations, type DiscoveredStep } from "./api-discovery";
import type { RequirementStep } from "./requirement-store";

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
    case "action-email":
      return { to: "{{to}}", subject: "Notification", body: d, service: "SendGrid" };
    case "action-slack":
      return { operation: "post_message", channel: "#general", message: d };
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

export function generateWorkflowFromSteps(
  steps: RequirementStep[],
  workflowName: string
): { nodes: Node[]; edges: Edge[] } {
  const discovered = discoverOperations(steps);
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

  if (useAltTrigger && first) {
    const triggerType = stepToNodeType(first, 0, true);
    triggerId = nanoid();
    nodes.push({
      id: triggerId,
      type: triggerType,
      position: { x: 0, y: 0 },
      data: stepToNodeData(triggerType, first),
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

  for (let i = startIndex; i < discovered.length; i++) {
    const step = discovered[i];
    const type = stepToNodeType(step, i, false);
    const nodeId = nanoid();
    const data = stepToNodeData(type, step);
    nodes.push({
      id: nodeId,
      type,
      position: { x: 0, y: y + GAP_Y },
      data: { ...data },
      width: NODE_WIDTH,
      height: type.startsWith("control-") ? 180 : NODE_HEIGHT,
    });
    edges.push({
      id: nanoid(),
      source: prevId,
      target: nodeId,
    });
    prevId = nodeId;
    y += GAP_Y + (type.startsWith("control-") ? 180 : NODE_HEIGHT);
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
