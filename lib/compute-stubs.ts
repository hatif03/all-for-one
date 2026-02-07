import type { ComputeNodeFunction } from "./compute";
import { useDatasetsStore } from "./datasets-store";

/**
 * Stub compute functions for extended node types.
 * Each returns current data with a minimal output so the graph can run.
 * Full implementations are added in later commits (e.g. action-http in commit 2).
 */

function stubCompute<T extends Record<string, unknown>>(
  _inputs: { output: string; label?: string }[],
  data: T,
  _abortSignal: AbortSignal,
  _nodeId: string
): Promise<T & { output?: string; error?: string }> {
  return Promise.resolve({
    ...data,
    loading: false,
    error: undefined,
    output: JSON.stringify({ ok: true, stub: true }),
  });
}

function parseListInput(raw: string | undefined): Record<string, unknown>[] {
  if (!raw?.trim()) return [];
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const first = lines[0];
  if (first.includes(",")) {
    const headers = first.split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    });
  }
  return lines.map((line) => ({ email: line.trim(), value: line.trim() }));
}

/** Manual trigger: outputs a payload so downstream nodes can run. Optional listInput or datasetId (list/CSV) becomes rows. */
export const computeTriggerManual: ComputeNodeFunction<Record<string, unknown>> = async (
  _inputs,
  data,
  abortSignal,
  _nodeId
) => {
  if (abortSignal?.aborted) throw new Error("Operation was aborted");
  let listInput: string | undefined = typeof data.listInput === "string" ? data.listInput : undefined;
  const datasetId = typeof data.datasetId === "string" ? data.datasetId : undefined;
  if (datasetId && !listInput) {
    const dataset = useDatasetsStore.getState().getDataset(datasetId);
    if (dataset?.raw) listInput = dataset.raw;
  }
  const rows = parseListInput(listInput);
  const payload = rows.length > 0 ? { rows, triggered: true, at: new Date().toISOString() } : { triggered: true, at: new Date().toISOString() };
  return {
    ...data,
    loading: false,
    error: undefined,
    output: JSON.stringify(payload),
  };
};
export const computeTriggerWebhook: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
export const computeTriggerSchedule: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
// action-http is implemented in compute.ts (real fetch)
export const computeActionDocument: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
// control-condition and control-approval implemented in compute-actions
export const computeDataTransform: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
