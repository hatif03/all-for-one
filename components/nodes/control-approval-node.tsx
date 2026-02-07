import { NodeCard } from "@/components/node-card";
import { controlApprovalDataSchema } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { ErrorNode } from "./error-node";

export const ControlApprovalNode: NodeTypes[keyof NodeTypes] = (props) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const runNode = useWorkflowStore((state) => state.runNode);
  const parsedData = useMemo(() => controlApprovalDataSchema.safeParse(props.data), [props.data]);

  const handleChange = useCallback(
    (updates: Record<string, unknown>) => {
      updateNodeData(props.id, { ...updates, dirty: true });
    },
    [props.id, updateNodeData]
  );

  const handleApprove = useCallback(() => {
    updateNodeData(props.id, { approved: true, pendingApproval: false });
    runNode(props.id);
  }, [props.id, updateNodeData, runNode]);

  const handleReject = useCallback(() => {
    updateNodeData(props.id, { approved: false, output: JSON.stringify({ status: "rejected" }) });
  }, [props.id, updateNodeData]);

  if (!parsedData.success) {
    return <ErrorNode title="Invalid Approval Node Data" description={parsedData.error.message} node={props} />;
  }

  const d = parsedData.data;
  const pending = (d as Record<string, unknown>).pendingApproval === true && d.approved !== true;

  return (
    <NodeCard title="Approval" node={props}>
      <div className="p-3 space-y-2 text-sm">
        <Input
          placeholder="Title"
          value={d.title ?? ""}
          onChange={(e) => handleChange({ title: e.target.value })}
          className="nodrag"
        />
        <Textarea
          placeholder="Description for approver"
          value={d.description ?? ""}
          onChange={(e) => handleChange({ description: e.target.value })}
          className="nodrag min-h-[60px]"
        />
        {pending && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="nodrag" onClick={handleApprove}>
              Approve
            </Button>
            <Button size="sm" variant="outline" className="nodrag" onClick={handleReject}>
              Reject
            </Button>
          </div>
        )}
        {d.approved === true && (
          <p className="text-xs text-green-600 dark:text-green-400">Approved</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
