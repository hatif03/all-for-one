import { NodeCard } from "@/components/node-card";
import { BaseNodeData } from "@/lib/base-node";
import { Handle, Node, NodeProps, Position, type NodeTypes } from "@xyflow/react";

export type BusinessNodeKind =
  | "trigger-manual"
  | "trigger-webhook"
  | "trigger-schedule"
  | "action-http"
  | "action-email"
  | "action-slack"
  | "action-document"
  | "control-delay"
  | "control-condition"
  | "control-approval"
  | "data-transform";

const LABELS: Record<BusinessNodeKind, string> = {
  "trigger-manual": "Trigger (Manual)",
  "trigger-webhook": "Trigger (Webhook)",
  "trigger-schedule": "Trigger (Schedule)",
  "action-http": "HTTP Request",
  "action-email": "Send Email",
  "action-slack": "Slack",
  "action-document": "Document",
  "control-delay": "Delay",
  "control-condition": "Condition",
  "control-approval": "Approval",
  "data-transform": "Transform",
};

export function createGenericBusinessNode(kind: BusinessNodeKind): NodeTypes[keyof NodeTypes] {
  const label = LABELS[kind];
  return function GenericBusinessNode(props: NodeProps) {
    return (
      <NodeCard title={label} node={props}>
        <div className="p-3 text-sm text-muted-foreground min-h-[80px]">
          <p>{label} – configure in properties</p>
        </div>
        <Handle type="source" position={Position.Bottom} />
        <Handle type="target" position={Position.Top} />
      </NodeCard>
    );
  };
}
