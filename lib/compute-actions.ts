import type { ComputeNodeFunction, ComputeNodeInput } from "./compute";
import { actionHttpDataSchema } from "./node-types";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

export const computeActionHttp: ComputeNodeFunction<Record<string, unknown>> = async (
  inputs: ComputeNodeInput[],
  data: Record<string, unknown>,
  abortSignal: AbortSignal,
  _nodeId: string
) => {
  const parsed = actionHttpDataSchema.safeParse(data);
  const config = parsed.success ? parsed.data : { method: "GET" as const, url: "", body: undefined, headers: undefined, bodyType: "json" as const };

  if (!config.url?.trim()) {
    return {
      ...data,
      loading: false,
      error: "URL is required",
      output: undefined,
    };
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (abortSignal?.aborted) throw new Error("Operation was aborted");
    try {
      const body =
        config.method !== "GET" && config.body != null
          ? config.bodyType === "json"
            ? JSON.stringify(typeof config.body === "string" ? tryParseJson(config.body) : config.body)
            : String(config.body)
          : undefined;

      const res = await fetch(config.url, {
        method: config.method,
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body,
        signal: abortSignal,
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return {
        ...data,
        loading: false,
        error: undefined,
        output: text,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  return {
    ...data,
    loading: false,
    error: lastError?.message ?? "Request failed",
    output: undefined,
  };
};

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
