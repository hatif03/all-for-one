import { generateText } from "ai";
import { providers } from "./ai";
import { useApiKeysStore } from "./api-key-store";
import type { CatalogOperation } from "./api-catalog";

const SYSTEM_PROMPT = `You are picking the best API operation for a workflow step and filling its parameters. You will be given:
1. A step description (what the user wants to do).
2. A list of available operations (id, name, description, method, path, params with keys).
3. Optionally: a short summary of user-provided inputs (e.g. "segment: all customers, delay: 3 days") and previous steps in the workflow (so you can suggest values from earlier steps).

Respond with ONLY a valid JSON object, no markdown or extra text. Use exactly one of these shapes:
- If one operation clearly fits the step: {"operationId": "<id from the list>", "paramMapping": {"paramKey": "literal value or {{placeholder}}"}}
- If no good match: {"operationId": null}

Rules:
- operationId MUST be exactly one of the ids from the list, or null.
- paramMapping: for each parameter of the chosen operation, suggest a value. Use literal values from the user summary when they fit (e.g. user said "all customers" -> segment: "all_customers" or segment: "all"). When the value should come from a previous step's output, use a placeholder like {{trigger.rows}} or {{stepId.key}} (e.g. for "send to each from list" use the step id that fetches the list). When unknown, use {{paramKey}}.
- Pick the single best matching operation by semantic fit (e.g. "retrieve customer list" -> GET /customers or List customers). Prefer operations whose params you can fill from user context or previous steps.`;

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

/** Compact representation for the prompt to save tokens */
function formatOperation(op: CatalogOperation): string {
  const params = op.params?.length ? ` params=[${op.params.map((p) => p.key).join(", ")}]` : "";
  return `id=${op.id} name="${op.name}" method=${op.method} path=${op.urlTemplate} description=${(op.description ?? "").slice(0, 80)}${params}`;
}

export interface SelectOperationResult {
  operationId: string;
  paramMapping?: Record<string, string>;
}

export interface SelectOperationContext {
  /** Concise summary of user-provided inputs (e.g. "segment: all customers, delay: 3 days, subject: Special Offer") */
  userSummary?: string;
  /** Previous steps in the workflow so param values can reference their outputs (e.g. {{stepId.key}}) */
  previousSteps?: { stepId: string; description: string }[];
}

/**
 * Use the LLM to pick the best API operation for a workflow step from a list of candidates.
 * Optionally pass userSummary and previousSteps to fill paramMapping with literals or {{stepId.key}}.
 * Returns null if no model, no match, or invalid response.
 */
export async function selectOperationByAI(
  stepDescription: string,
  candidateOperations: CatalogOperation[],
  context?: SelectOperationContext
): Promise<SelectOperationResult | null> {
  if (candidateOperations.length === 0) return null;

  const model = getModel();
  if (!model) return null;

  const opsList = candidateOperations.map(formatOperation).join("\n");
  let userPrompt = `Step: "${stepDescription}"\n\nAvailable operations:\n${opsList}`;
  if (context?.userSummary) {
    userPrompt += `\n\nUser-provided inputs: ${context.userSummary}`;
  }
  if (context?.previousSteps?.length) {
    userPrompt += `\n\nPrevious steps in this workflow (you may reference their output in paramMapping, e.g. {{stepId.key}} or {{trigger.rows}}):\n${context.previousSteps.map((s) => `- ${s.stepId}: ${s.description}`).join("\n")}`;
  }

  try {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    const trimmed = text.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { operationId?: string | null; paramMapping?: Record<string, string> };
    if (parsed.operationId == null || parsed.operationId === "null") return null;

    const operationId = String(parsed.operationId);
    const valid = candidateOperations.some((op) => op.id === operationId);
    if (!valid) return null;

    return {
      operationId,
      paramMapping: typeof parsed.paramMapping === "object" && parsed.paramMapping ? parsed.paramMapping : undefined,
    };
  } catch {
    return null;
  }
}
