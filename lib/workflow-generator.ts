import type { Edge, Node } from "@xyflow/react";
import { nanoid } from "nanoid";
import { discoverOperations, type DiscoveredStep } from "./api-discovery";
import type { RequirementStep } from "./requirement-store";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 200;
const GAP_X = 80;
const GAP_Y = 120;

function stepToNodeType(step: DiscoveredStep): string {
  const desc = step.description.toLowerCase();
  if (step.operation?.id?.includes("sendgrid") || step.operation?.id?.includes("gmail")) return "action-email";
  if (step.operation?.id?.includes("slack")) return "action-slack";
  if (step.serviceId === "http" && !step.operation?.urlTemplate) return "action-http";
  if (desc.includes("approval") || desc.includes("approve")) return "control-approval";
  if (desc.includes("delay") || desc.includes("wait") || desc.includes("later")) return "control-delay";
  if (step.suggestedService === "email") return "action-email";
  if (step.suggestedService === "slack") return "action-slack";
  if (step.suggestedService === "approval") return "control-approval";
  if (step.suggestedService === "delay") return "control-delay";
  return "action-http";
}

function stepToNodeData(type: string, step: DiscoveredStep): Record<string, unknown> {
  const d = step.description;
  switch (type) {
    case "action-email":
      return { to: "", subject: "Welcome", body: d, service: "SendGrid" };
    case "action-slack":
      return { operation: "post_message", channel: "#general", message: d };
    case "control-approval":
      return { title: "Approve", description: d };
    case "control-delay":
      return { delayMinutes: 0, delayHours: 0 };
    case "action-http":
      return { method: "GET", url: step.operation?.urlTemplate ?? "https://api.example.com", body: undefined };
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
  const triggerId = nanoid();
  nodes.push({
    id: triggerId,
    type: "trigger-manual",
    position: { x: 0, y: 0 },
    data: {},
    width: NODE_WIDTH,
    height: 120,
  });

  let prevId = triggerId;
  let y = 0;
  discovered.forEach((step, i) => {
    const type = stepToNodeType(step);
    const nodeId = nanoid();
    const data = stepToNodeData(type, step);
    nodes.push({
      id: nodeId,
      type,
      position: { x: 0, y: y + GAP_Y },
      data: { ...data },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
    edges.push({
      id: nanoid(),
      source: prevId,
      target: nodeId,
    });
    prevId = nodeId;
    y += GAP_Y + NODE_HEIGHT;
  });

  return { nodes, edges };
}
