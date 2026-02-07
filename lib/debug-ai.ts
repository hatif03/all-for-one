import { generateText } from "ai";
import type { Edge, Node } from "@xyflow/react";
import { providers } from "./ai";
import { useApiKeysStore } from "./api-key-store";

const SYSTEM = `You are a workflow debugger. You receive a workflow (nodes and edges in React Flow format) and a failing node with an error message.
Return ONLY a valid JSON object: { "nodes": [...], "edges": [...] } with the fixed workflow.
- Fix the failing node's data (e.g. correct URL, headers, required fields) or suggest a minimal change.
- Keep all node ids and the graph structure; only modify what is needed to fix the error.
- Return valid JSON only, no markdown or explanation.`;

function getModel() {
  const providerNames = Object.keys(providers);
  for (const name of providerNames) {
    const key = useApiKeysStore.getState().getApiKey(name);
    if (key) {
      const provider = providers[name];
      const modelId = provider.models.includes("gemini-2.5-flash")
        ? "gemini-2.5-flash"
        : provider.models[0];
      return provider.createModel(key, modelId, false);
    }
  }
  return null;
}

export async function debugWorkflowWithAI(
  nodes: Node[],
  edges: Edge[],
  failingNodeId: string,
  errorMessage: string
): Promise<{ nodes: Node[]; edges: Edge[] } | { error: string }> {
  const model = getModel();
  if (!model) {
    return { error: "Add an API key in the sidebar to use Debug with AI." };
  }
  const failingNode = nodes.find((n) => n.id === failingNodeId);
  const prompt = `Workflow nodes: ${JSON.stringify(nodes)}\nEdges: ${JSON.stringify(edges)}\n\nFailing node id: ${failingNodeId}\nFailing node data: ${JSON.stringify(failingNode?.data)}\nError: ${errorMessage}\n\nReturn fixed workflow JSON:`;
  const { text } = await generateText({ model, system: SYSTEM, prompt });
  const match = text.trim().match(/\{[\s\S]*\}/);
  if (!match) return { error: "Could not parse AI response." };
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return { nodes: parsed.nodes, edges: parsed.edges };
    }
  } catch {
    return { error: "Invalid JSON in AI response." };
  }
  return { error: "AI did not return nodes and edges." };
}
