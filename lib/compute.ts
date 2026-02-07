import { aiNodeDataSchema, computeAi } from "@/components/nodes/ai-node";
import { computeMarkdown } from "@/components/nodes/markdown-node";
import { computePrompt, promptNodeDataSchema } from "@/components/nodes/prompt-node";
import {
  computeActionEmail,
  computeActionHttp,
  computeActionSlack,
  computeControlApproval,
  computeControlCondition,
  computeControlDelay,
} from "@/lib/compute-actions";
import {
  computeActionDocument,
  computeDataTransform,
  computeTriggerManual,
  computeTriggerSchedule,
  computeTriggerWebhook,
} from "@/lib/compute-stubs";

export type ComputeNodeFunction<T> = (inputs: ComputeNodeInput[], data: T, abortSignal: AbortSignal, nodeId: string) => Promise<T>;

export type ComputeNodeInput = { output: string; label?: string };

export function formatInputs(inputs: ComputeNodeInput[]) {
  return inputs
    .map((input) => {
      if (input.label) {
        const label = input.label.toLowerCase().replace(/ /g, "_");
        return `<${label}>\n${input.output.trim()}\n</${label}>`; 
      }
      return input.output;
    })
    .join("\n\n");
}

export const computeNode = async (
  type: string,
  inputs: ComputeNodeInput[],
  data: Record<string, unknown>,
  abortSignal: AbortSignal,
  nodeId: string
): Promise<Record<string, unknown>> => {
  try {
    // Check if operation was aborted before starting
    if (abortSignal?.aborted) {
      throw new Error("Operation was aborted");
    }

    switch (type) {
      case "markdown":
        return computeMarkdown(inputs, data, abortSignal, nodeId);
      case "prompt":
        return computePrompt(inputs, promptNodeDataSchema.parse(data), abortSignal, nodeId);
      case "ai":
        return computeAi(inputs, aiNodeDataSchema.parse(data), abortSignal, nodeId);
      case "trigger-manual":
        return computeTriggerManual(inputs, data, abortSignal, nodeId);
      case "trigger-webhook":
        return computeTriggerWebhook(inputs, data, abortSignal, nodeId);
      case "trigger-schedule":
        return computeTriggerSchedule(inputs, data, abortSignal, nodeId);
      case "action-http":
        return computeActionHttp(inputs, data, abortSignal, nodeId);
      case "action-email":
        return computeActionEmail(inputs, data, abortSignal, nodeId);
      case "action-slack":
        return computeActionSlack(inputs, data, abortSignal, nodeId);
      case "action-document":
        return computeActionDocument(inputs, data, abortSignal, nodeId);
      case "control-delay":
        return computeControlDelay(inputs, data, abortSignal, nodeId);
      case "control-condition":
        return computeControlCondition(inputs, data, abortSignal, nodeId);
      case "control-approval":
        return computeControlApproval(inputs, data, abortSignal, nodeId);
      case "data-transform":
        return computeDataTransform(inputs, data, abortSignal, nodeId);
      default:
        throw new Error(`Node type ${type} not found`);
    }
  } catch (error) {
    return {
      ...data,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
