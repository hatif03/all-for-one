import { baseNodeDataSchema } from "@/lib/base-node";
import { z } from "zod";

/**
 * Extended node type registry and schemas for business workflow use cases.
 * Used by compute, workflow generator, and UI.
 */

// --- Triggers ---
export const triggerManualDataSchema = baseNodeDataSchema.extend({
  label: z.string().optional(),
  listInput: z.string().optional(),
  datasetId: z.string().optional(),
});
export type TriggerManualData = z.infer<typeof triggerManualDataSchema>;

export const triggerWebhookDataSchema = baseNodeDataSchema.extend({
  path: z.string().optional(),
  method: z.enum(["POST", "GET"]).default("POST"),
});
export type TriggerWebhookData = z.infer<typeof triggerWebhookDataSchema>;

export const triggerScheduleDataSchema = baseNodeDataSchema.extend({
  cron: z.string().optional(),
  description: z.string().optional(),
});
export type TriggerScheduleData = z.infer<typeof triggerScheduleDataSchema>;

// --- Actions ---
export const actionHttpDataSchema = baseNodeDataSchema.extend({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  url: z.string().default(""),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  bodyType: z.enum(["json", "raw"]).optional(),
  catalogServiceId: z.string().optional(),
  catalogOperationId: z.string().optional(),
  catalogParamValues: z.record(z.string()).optional(),
});
export type ActionHttpData = z.infer<typeof actionHttpDataSchema>;

export const actionEmailDataSchema = baseNodeDataSchema.extend({
  service: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  template: z.string().optional(),
  toSource: z.enum(["single", "list"]).optional(),
  toListField: z.string().optional(),
});
export type ActionEmailData = z.infer<typeof actionEmailDataSchema>;

export const actionSlackDataSchema = baseNodeDataSchema.extend({
  operation: z.enum(["post_message", "invite_user", "create_channel"]).optional(),
  channel: z.string().optional(),
  message: z.string().optional(),
  userId: z.string().optional(),
});
export type ActionSlackData = z.infer<typeof actionSlackDataSchema>;

export const actionDocumentDataSchema = baseNodeDataSchema.extend({
  format: z.enum(["pdf", "html", "text"]).optional(),
  extractFields: z.string().optional(),
});
export type ActionDocumentData = z.infer<typeof actionDocumentDataSchema>;

// --- Control flow ---
export const controlDelayDataSchema = baseNodeDataSchema.extend({
  delayMinutes: z.number().min(0).optional(),
  delayHours: z.number().min(0).optional(),
});
export type ControlDelayData = z.infer<typeof controlDelayDataSchema>;

export const controlConditionDataSchema = baseNodeDataSchema.extend({
  condition: z.string().optional(),
  leftOperand: z.string().optional(),
  operator: z.enum(["eq", "neq", "contains", "gt", "lt"]).optional(),
  rightOperand: z.string().optional(),
});
export type ControlConditionData = z.infer<typeof controlConditionDataSchema>;

export const controlApprovalDataSchema = baseNodeDataSchema.extend({
  title: z.string().optional(),
  description: z.string().optional(),
  approved: z.boolean().optional(),
  approvedBy: z.string().optional(),
});
export type ControlApprovalData = z.infer<typeof controlApprovalDataSchema>;

// --- Data ---
export const dataTransformDataSchema = baseNodeDataSchema.extend({
  mapping: z.string().optional(),
  outputKey: z.string().optional(),
});
export type DataTransformData = z.infer<typeof dataTransformDataSchema>;

/** All extended node type names (excluding existing prompt, ai, markdown, annotation). */
export const EXTENDED_NODE_TYPES = [
  "trigger-manual",
  "trigger-webhook",
  "trigger-schedule",
  "action-http",
  "action-email",
  "action-slack",
  "action-document",
  "control-delay",
  "control-condition",
  "control-approval",
  "data-transform",
] as const;

export type ExtendedNodeType = (typeof EXTENDED_NODE_TYPES)[number];

export function isExtendedNodeType(type: string): type is ExtendedNodeType {
  return (EXTENDED_NODE_TYPES as readonly string[]).includes(type);
}
