/**
 * Parse OpenAPI 3.x or Swagger 2.0 (JSON) into catalog shape for workflow discovery and HTTP node.
 */

import type { CatalogOperation, CatalogService } from "./api-catalog";

/** OpenAPI 3.x shape */
interface OpenAPI3Spec {
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
        requestBody?: {
          content?: Record<
            string,
            { schema?: { $ref?: string; properties?: Record<string, unknown> } }
          >;
        };
      }
    >
  >;
  components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
}

/** Swagger 2.0 shape (e.g. FastAPI /openapi.json, Petstore sample) */
interface Swagger2Spec {
  swagger?: string;
  host?: string;
  basePath?: string;
  info?: { title?: string; description?: string };
  paths?: Record<
    string,
    Record<
      string,
      {
        summary?: string;
        operationId?: string;
        description?: string;
        tags?: string[];
        parameters?: Array<{
          name: string;
          in: string;
          required?: boolean;
          description?: string;
          type?: string;
          schema?: { $ref?: string; properties?: Record<string, unknown> };
        }>;
      }
    >
  >;
  definitions?: Record<string, { properties?: Record<string, unknown> }>;
}

type OpenAPISpec = OpenAPI3Spec | Swagger2Spec;

function isSwagger2(spec: OpenAPISpec): spec is Swagger2Spec {
  return (spec as Swagger2Spec).swagger === "2.0";
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

/** Resolve #/components/schemas/Name to property keys from spec.components.schemas */
function getOas3BodyParamKeysFromRef(spec: OpenAPI3Spec, ref: string): string[] {
  const match = ref.match(/#\/components\/schemas\/(.+)/);
  if (!match) return [];
  const schema = spec.components?.schemas?.[match[1]];
  if (!schema?.properties) return [];
  return Object.keys(schema.properties);
}

function getSwagger2BaseUrl(spec: Swagger2Spec): string {
  const host = spec.host ?? "";
  const basePath = spec.basePath ?? "";
  if (!host) return "";
  const scheme = host.startsWith("http") ? "" : "https://";
  return `${scheme}${host}${basePath}`;
}

/** Resolve #/definitions/RefName to property keys from spec.definitions */
function getBodyParamKeysFromRef(spec: Swagger2Spec, ref: string): string[] {
  const match = ref.match(/#\/definitions\/(.+)/);
  if (!match) return [];
  const def = spec.definitions?.[match[1]];
  if (!def?.properties) return [];
  return Object.keys(def.properties);
}

/**
 * Ingest a Swagger 2.0 spec and return a CatalogService (same shape as OpenAPI 3.x).
 */
function ingestSwagger2Spec(spec: Swagger2Spec, sourceId?: string): CatalogService {
  const title = spec.info?.title ?? "Imported API";
  const baseUrl = getSwagger2BaseUrl(spec);
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
        if (!p?.name) continue;
        if (p.in === "body" && p.schema?.$ref) {
          const keys = getBodyParamKeysFromRef(spec, p.schema.$ref);
          for (const key of keys) {
            if (!params.some((x) => x.key === key)) {
              params.push({ key, required: false, description: key });
            }
          }
          if (keys.length === 0) {
            params.push({ key: "body", required: p.required ?? false, description: p.description ?? "Request body" });
          }
        } else if (p.in === "body" && p.schema?.properties) {
          for (const [key] of Object.entries(p.schema.properties)) {
            if (!params.some((x) => x.key === key)) {
              params.push({ key, required: false, description: key });
            }
          }
        } else if (p.in !== "body") {
          params.push({
            key: p.name,
            required: p.required ?? false,
            description: p.description ?? p.name,
          });
        } else {
          params.push({ key: "body", required: p.required ?? false, description: p.description ?? "Request body" });
        }
      }

      const urlTemplate = baseUrl ? resolveUrl(baseUrl, path) : path;
      const intentKeywords = [summary, opId, op.description, ...(op.tags ?? [])].filter(Boolean).flatMap((t) =>
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
 * Ingest an OpenAPI 3.x or Swagger 2.0 spec (JSON) and return a CatalogService.
 */
export function ingestOpenAPISpec(spec: OpenAPISpec, sourceId?: string): CatalogService {
  if (isSwagger2(spec)) {
    return ingestSwagger2Spec(spec, sourceId);
  }

  const oas3 = spec as OpenAPI3Spec;
  const title = oas3.info?.title ?? "Imported API";
  const baseUrl = oas3.servers?.[0]?.url ?? "";
  const id = sourceId ?? `openapi-${slug(title)}-${Date.now().toString(36)}`;

  const operations: CatalogOperation[] = [];
  const paths = oas3.paths ?? {};

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

      const bodySchema = op.requestBody?.content?.["application/json"]?.schema;
      if (bodySchema) {
        if (bodySchema.properties) {
          for (const [key] of Object.entries(bodySchema.properties)) {
            if (!params.some((p) => p.key === key)) {
              params.push({ key, required: false, description: key });
            }
          }
        } else if (bodySchema.$ref && "components" in oas3 && oas3.components?.schemas) {
          const keys = getOas3BodyParamKeysFromRef(oas3, bodySchema.$ref);
          for (const key of keys) {
            if (!params.some((p) => p.key === key)) {
              params.push({ key, required: false, description: key });
            }
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
    description: oas3.info?.description ?? `Imported from OpenAPI spec`,
    authType: "none",
    connectionKey: "",
    operations,
  };
}

/**
 * Fetch a spec from URL and ingest (expects JSON).
 * Handles raw OpenAPI/Swagger JSON or wrapped format (e.g. { spec: { ... } }).
 */
export async function fetchAndIngestOpenAPI(url: string): Promise<CatalogService> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status}`);
  const raw = (await res.json()) as OpenAPISpec | { spec?: OpenAPISpec };
  const spec = "spec" in raw && raw.spec ? raw.spec : (raw as OpenAPISpec);
  return ingestOpenAPISpec(spec, `openapi-url-${slug(new URL(url).hostname)}`);
}
