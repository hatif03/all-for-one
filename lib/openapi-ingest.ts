/**
 * Parse OpenAPI 3.x (JSON) into catalog shape for workflow discovery and HTTP node.
 */

import type { CatalogOperation, CatalogService } from "./api-catalog";

interface OpenAPISpec {
  openapi?: string;
  info?: { title?: string; description?: string };
  servers?: Array<{ url: string }>;
  paths?: Record<
    string,
    Record<
      string,
      {
        summary?: string;
        operationId?: string;
        description?: string;
        parameters?: Array<{ name: string; in: string; required?: boolean; description?: string }>;
        requestBody?: { content?: Record<string, { schema?: { properties?: Record<string, unknown> } }> };
      }
    >
 >;
}

function slug(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveUrl(base: string, path: string): string {
  const baseUrl = base.replace(/\/$/, "");
  const pathStr = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${pathStr}`;
}

/**
 * Ingest an OpenAPI 3.x spec (JSON) and return a CatalogService with one operation per path+method.
 */
export function ingestOpenAPISpec(spec: OpenAPISpec, sourceId?: string): CatalogService {
  const title = spec.info?.title ?? "Imported API";
  const baseUrl = spec.servers?.[0]?.url ?? "";
  const id = sourceId ?? `openapi-${slug(title)}-${Date.now().toString(36)}`;

  const operations: CatalogOperation[] = [];

  const paths = spec.paths ?? {};
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const methods = ["get", "post", "put", "patch", "delete"] as const;
    for (const method of methods) {
      const op = pathItem[method];
      if (!op || typeof op !== "object") continue;

          const summary = op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`;
          const opId = op.operationId ?? slug(`${method}-${path}`);
          const uniqueOpId = `${id}-${opId}`;

          const params: { key: string; required: boolean; description: string }[] = [];

          for (const p of op.parameters ?? []) {
            if (p?.name) {
              params.push({
                key: p.name,
                required: p.required ?? false,
                description: p.description ?? p.name,
              });
            }
          }

          if (op.requestBody?.content?.["application/json"]?.schema?.properties) {
            for (const [key] of Object.entries(op.requestBody.content["application/json"].schema.properties)) {
              if (!params.some((p) => p.key === key)) {
                params.push({ key, required: false, description: key });
              }
            }
          }

          const urlTemplate = baseUrl ? resolveUrl(baseUrl, path) : path;
          const intentKeywords = [summary, opId, op.description].filter(Boolean).flatMap((t) =>
            String(t)
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 2)
          );

          operations.push({
            id: uniqueOpId,
            name: summary,
            description: op.description ?? summary,
            method: method.toUpperCase(),
            urlTemplate,
            connectionKey: "",
            params,
            intentKeywords: [...new Set(intentKeywords)].slice(0, 10),
          });
    }
  }

  return {
    id,
    name: title,
    description: spec.info?.description ?? `Imported from OpenAPI spec`,
    authType: "none",
    connectionKey: "",
    operations,
  };
}

/**
 * Fetch a spec from URL and ingest (expects JSON).
 */
export async function fetchAndIngestOpenAPI(url: string): Promise<CatalogService> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status}`);
  const spec = (await res.json()) as OpenAPISpec;
  return ingestOpenAPISpec(spec, `openapi-url-${slug(new URL(url).hostname)}`);
}
