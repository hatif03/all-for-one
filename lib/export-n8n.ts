import type { Edge, Node } from "@xyflow/react";

/**
 * Convert our internal workflow (nodes + edges) to n8n workflow JSON.
 * Simplified mapping: trigger-manual -> n8n Manual Trigger, action-http -> HTTP Request, etc.
 */
export function toN8nWorkflow(
  name: string,
  nodes: Node[],
  edges: Edge[]
): Record<string, unknown> {
  const n8nNodes: Record<string, unknown>[] = [];
  const idToName: Record<string, string> = {};
  nodes.forEach((n, i) => {
    const safeName = (n.data?.label as string) || `${n.type}-${i}`.replace(/\s/g, "_");
    const uniqueName = `${safeName}-${n.id.slice(0, 8)}`;
    idToName[n.id] = uniqueName;
    const n8nNode = mapNodeToN8n(n, uniqueName);
    if (n8nNode) n8nNodes.push(n8nNode);
  });
  const connections = buildN8nConnections(edges, idToName);
  return {
    name,
    nodes: n8nNodes,
    connections,
    active: false,
    settings: {},
    versionId: Date.now().toString(),
  };
}

function mapNodeToN8n(node: Node, name: string): Record<string, unknown> | null {
  const position = [node.position?.x ?? 0, node.position?.y ?? 0];
  const d = node.data as Record<string, unknown> || {};
  switch (node.type) {
    case "trigger-manual":
      return {
        id: node.id,
        name,
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position,
      };
    case "action-http":
      return {
        id: node.id,
        name,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4,
        position,
        parameters: {
          method: d.method ?? "GET",
          url: d.url ?? "",
          options: {},
        },
      };
    case "action-email":
      return {
        id: node.id,
        name,
        type: "n8n-nodes-base.emailSend",
        typeVersion: 2,
        position,
        parameters: {
          to: d.to ?? "",
          subject: d.subject ?? "",
          text: d.body ?? "",
        },
      };
    case "action-slack":
      return {
        id: node.id,
        name,
        type: "n8n-nodes-base.slack",
        typeVersion: 2,
        position,
        parameters: {
          channel: d.channel ?? "#general",
          text: d.message ?? "",
        },
      };
    case "control-delay":
      return {
        id: node.id,
        name,
        type: "n8n-nodes-base.wait",
        typeVersion: 1,
        position,
        parameters: {
          amount: Number(d.delayMinutes ?? 0) + Number(d.delayHours ?? 0) * 60,
          unit: "minutes",
        },
      };
    default:
      return {
        id: node.id,
        name,
        type: "n8n-nodes-base.noOp",
        typeVersion: 1,
        position,
        parameters: {},
      };
  }
}

function buildN8nConnections(
  edges: Edge[],
  idToName: Record<string, string>
): Record<string, unknown> {
  const connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }> = {};
  edges.forEach((e) => {
    const fromName = idToName[e.source];
    const toName = idToName[e.target];
    if (!fromName || !toName) return;
    if (!connections[fromName]) {
      connections[fromName] = { main: [[]] };
    }
    connections[fromName].main[0].push({ node: toName, type: "main", index: 0 });
  });
  return connections;
}
