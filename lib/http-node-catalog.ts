import { apiCatalog } from "./api-catalog";
import type { CatalogOperation, CatalogService } from "./api-catalog";
import { useOpenApiStore } from "./openapi-store";

export function getMergedCatalog(): CatalogService[] {
  const dynamic = useOpenApiStore.getState().getServices();
  return [...apiCatalog, ...dynamic];
}

export interface HttpCatalogEntry {
  serviceId: string;
  operation: CatalogOperation;
}

export function findHttpOperationById(operationId: string | undefined): HttpCatalogEntry | null {
  if (!operationId) return null;
  const catalog = getMergedCatalog();
  for (const service of catalog) {
    const op = service.operations.find((o) => o.id === operationId);
    if (op) return { serviceId: service.id, operation: op };
  }
  return null;
}
