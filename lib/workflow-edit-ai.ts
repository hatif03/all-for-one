import { generateText } from "ai";
import { providers } from "./ai";
import { useApiKeysStore } from "./api-key-store";
import type { Edge, Node } from "@xyflow/react";

const SYSTEM = `You are a workflow editor. You receive a workflow as JSON with "nodes" and "edges" (React Flow format).
The user asks for a change in natural language (e.g. "Add a delay before the email", "Send that email later").
Reply with ONLY a single JSON object: { "nodes": [...], "edges": [...] } with the updated workflow.
- Preserve all node ids and structure; only change what the user asked.
- For "add a delay before X", insert a control-delay node between the previous step and X.
- Keep positions reasonable (increment y by 120 for new nodes).
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

export async function applyNaturalLanguageEdit(
  nodes: Node[],
  edges: Edge[],
  editRequest: string
): Promise<{ nodes: Node[]; edges: Edge[] } | { error: string }> {
  const model = getModel();
  if (!model) {
    return { error: "Add an API key in the sidebar to use edit with AI." };
  }
  const workflowJson = JSON.stringify({ nodes, edges }, null, 0);
  const { text } = await generateText({
    model,
    system: SYSTEM,
    prompt: `Current workflow:\n${workflowJson}\n\nUser request: ${editRequest}\n\nReturn updated workflow JSON only:`,
  });
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
