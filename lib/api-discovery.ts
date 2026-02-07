import { apiCatalog, findOperationByIntent, findOperationByIntentInCatalog, type CatalogOperation } from "./api-catalog";
import { selectOperationByAI } from "./api-discovery-ai";
import { useOpenApiStore } from "./openapi-store";

export interface DiscoveredStep {
  stepId: string;
  description: string;
  operation: CatalogOperation | null;
  serviceId: string;
  paramMapping: Record<string, string>;
  suggestedService?: string;
}

function defaultParamMapping(op: CatalogOperation): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of op.params) out[p.key] = `{{${p.key}}}`;
  return out;
}

/**
 * Map high-level step descriptions to catalog operations.
 * For HTTP-like steps with user-added OpenAPI specs, uses AI to pick the best endpoint;
 * otherwise falls back to keyword matching.
 */
export async function discoverOperations(
  steps: { id: string; description: string; suggestedService?: string }[],
  onProgress?: (phase: string, detail?: string) => void
): Promise<DiscoveredStep[]> {
  const dynamicServices = useOpenApiStore.getState().getServices();
  const mergedCatalog = [...apiCatalog, ...dynamicServices];
  const openApiOperations = dynamicServices.flatMap((s) => s.operations);

  const result: DiscoveredStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onProgress?.("Matching step", `${i + 1}: ${step.description}`);
    const isHttpLike = step.suggestedService === "http";
    const hasCandidates = openApiOperations.length > 0;

    if (isHttpLike && hasCandidates) {
      const aiResult = await selectOperationByAI(step.description, openApiOperations);
      if (aiResult) {
        const operation = openApiOperations.find((o) => o.id === aiResult.operationId) ?? null;
        if (operation) {
          const service = mergedCatalog.find((s) =>
            s.operations.some((o) => o.id === operation.id)
          );
          const paramMapping = { ...defaultParamMapping(operation), ...(aiResult.paramMapping ?? {}) };
          result.push({
            stepId: step.id,
            description: step.description,
            operation,
            serviceId: service?.id ?? "http",
            paramMapping,
            suggestedService: step.suggestedService,
          });
          continue;
        }
      }
    }

    const operation = findOperationByIntentInCatalog(step.description, mergedCatalog) ?? findOperationByIntent(step.description);
    if (!operation) {
      const customOp = apiCatalog.find((s) => s.id === "http")?.operations[0] ?? null;
      result.push({
        stepId: step.id,
        description: step.description,
        operation: customOp,
        serviceId: "http",
        paramMapping: {},
        suggestedService: step.suggestedService,
      });
      continue;
    }
    const service = mergedCatalog.find((s) =>
      s.operations.some((o) => o.id === operation.id)
    );
    result.push({
      stepId: step.id,
      description: step.description,
      operation,
      serviceId: service?.id ?? "http",
      paramMapping: defaultParamMapping(operation),
      suggestedService: step.suggestedService,
    });
  }

  return result;
}
