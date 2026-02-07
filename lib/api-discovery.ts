import { apiCatalog, findOperationByIntent, type CatalogOperation } from "./api-catalog";

export interface DiscoveredStep {
  stepId: string;
  description: string;
  operation: CatalogOperation | null;
  serviceId: string;
  paramMapping: Record<string, string>;
  suggestedService?: string;
}

/**
 * Map high-level step descriptions to catalog operations (stub: keyword matching).
 * Later can be replaced with LLM semantic matching.
 */
export function discoverOperations(
  steps: { id: string; description: string; suggestedService?: string }[]
): DiscoveredStep[] {
  return steps.map((step) => {
    const operation = findOperationByIntent(step.description);
    if (!operation) {
      const customOp = apiCatalog.find((s) => s.id === "http")?.operations[0] ?? null;
      return {
        stepId: step.id,
        description: step.description,
        operation: customOp,
        serviceId: "http",
        paramMapping: {},
        suggestedService: step.suggestedService,
      };
    }
    const service = apiCatalog.find((s) =>
      s.operations.some((o) => o.id === operation.id)
    );
    const paramMapping: Record<string, string> = {};
    for (const p of operation.params) {
      paramMapping[p.key] = `{{${p.key}}}`;
    }
    return {
      stepId: step.id,
      description: step.description,
      operation,
      serviceId: service?.id ?? "http",
      paramMapping,
      suggestedService: step.suggestedService,
    };
  });
}
