import type { ComputeNodeFunction } from "./compute";

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

/** Manual trigger: outputs a payload so downstream nodes can run. */
export const computeTriggerManual: ComputeNodeFunction<Record<string, unknown>> = async (
  _inputs,
  data,
  abortSignal,
  _nodeId
) => {
  if (abortSignal?.aborted) throw new Error("Operation was aborted");
  return {
    ...data,
    loading: false,
    error: undefined,
    output: JSON.stringify({ triggered: true, at: new Date().toISOString() }),
  };
};
export const computeTriggerWebhook: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
export const computeTriggerSchedule: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
// action-http is implemented in compute.ts (real fetch)
export const computeActionEmail: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
export const computeActionSlack: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
export const computeActionDocument: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
export const computeControlDelay: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
export const computeControlCondition: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
export const computeControlApproval: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
export const computeDataTransform: ComputeNodeFunction<Record<string, unknown>> = stubCompute;
