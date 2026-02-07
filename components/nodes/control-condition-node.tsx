import { NodeCard } from "@/components/node-card";
import { controlConditionDataSchema } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ErrorNode } from "./error-node";

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
] as const;

export const ControlConditionNode: NodeTypes[keyof NodeTypes] = (props) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const parsedData = useMemo(() => controlConditionDataSchema.safeParse(props.data), [props.data]);

  const handleChange = useCallback(
    (updates: Record<string, unknown>) => {
      updateNodeData(props.id, { ...updates, dirty: true });
    },
    [props.id, updateNodeData]
  );

  if (!parsedData.success) {
    return <ErrorNode title="Invalid Condition Node Data" description={parsedData.error.message} node={props} />;
  }

  const d = parsedData.data;
  return (
    <NodeCard title="Condition" node={props}>
      <div className="p-3 space-y-2 text-sm">
        <div className="flex gap-2 items-center flex-wrap">
          <Input
            placeholder="Left value"
            value={d.leftOperand ?? ""}
            onChange={(e) => handleChange({ leftOperand: e.target.value })}
            className="nodrag flex-1 min-w-0"
          />
          <Select
            value={d.operator ?? "eq"}
            onValueChange={(v) => handleChange({ operator: v })}
          >
            <SelectTrigger className="w-28 nodrag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Right value"
            value={d.rightOperand ?? ""}
            onChange={(e) => handleChange({ rightOperand: e.target.value })}
            className="nodrag flex-1 min-w-0"
          />
        </div>
        <p className="text-xs text-muted-foreground">Connect &quot;true&quot; and &quot;false&quot; handles to different branches.</p>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: "30%" }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: "70%" }} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
