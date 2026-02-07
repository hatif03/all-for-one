import { apiCatalog, findOperationByIntent, findOperationByIntentInCatalog, type CatalogOperation } from "./api-catalog";
import { selectOperationByAI, type SelectOperationContext } from "./api-discovery-ai";
import type { RequirementClarification } from "./requirement-store";
import { useOpenApiStore } from "./openapi-store";

export interface DiscoverOperationsOptions {
  clarificationValues?: Record<string, string>;
  clarifications?: RequirementClarification[];
}

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

/** Build a short userSummary from clarification values for the discovery AI */
function buildUserSummary(
  clarificationValues?: Record<string, string>,
  clarifications?: RequirementClarification[]
): string | undefined {
  if (!clarifications?.length || !clarificationValues) return undefined;
  const parts: string[] = [];
  clarifications.forEach((c, idx) => {
    const key = `${c.stepId}-${idx}`;
    const value = clarificationValues[key];
    if (value != null && value.trim() !== "") {
      const label = c.targetField ?? c.question.slice(0, 30);
      parts.push(`${label}: ${value.trim().slice(0, 50)}`);
    }
  });
  return parts.length > 0 ? parts.join("; ") : undefined;
}

/**
 * Map high-level step descriptions to catalog operations.
 * For HTTP-like steps with user-added OpenAPI specs, uses AI to pick the best endpoint;
 * otherwise falls back to keyword matching.
 */
export async function discoverOperations(
  steps: { id: string; description: string; suggestedService?: string; catalogOperationId?: string }[],
  onProgress?: (phase: string, detail?: string) => void,
  options?: DiscoverOperationsOptions
): Promise<DiscoveredStep[]> {
  const dynamicServices = useOpenApiStore.getState().getServices();
  const mergedCatalog = [...apiCatalog, ...dynamicServices];
  const openApiOperations = dynamicServices.flatMap((s) => s.operations);
  const userSummary = buildUserSummary(options?.clarificationValues, options?.clarifications);

  const result: DiscoveredStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onProgress?.("Matching step", `${i + 1}: ${step.description}`);
    const isHttpLike = step.suggestedService === "http";
    const hasCandidates = openApiOperations.length > 0;

    // Use AI-provided catalogOperationId when present (requirement AI already picked the endpoint)
    if (step.catalogOperationId?.trim()) {
      let operation: CatalogOperation | null = null;
      let service = mergedCatalog.find((s) =>
        s.operations.some((o) => o.id === step.catalogOperationId!.trim())
      );
      if (service) {
        operation = service.operations.find((o) => o.id === step.catalogOperationId!.trim()) ?? null;
      }
      if (operation) {
        result.push({
          stepId: step.id,
          description: step.description,
          operation,
          serviceId: service?.id ?? "http",
          paramMapping: defaultParamMapping(operation),
          suggestedService: step.suggestedService,
        });
        continue;
      }
    }

    if (isHttpLike && hasCandidates) {
      const context: SelectOperationContext = {
        userSummary,
        previousSteps: steps.slice(0, i).map((s) => ({ stepId: s.id, description: s.description })),
      };
      const aiResult = await selectOperationByAI(step.description, openApiOperations, context);
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
