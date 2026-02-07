import { NodeCard } from "@/components/node-card";
import { actionHttpDataSchema } from "@/lib/node-types";
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
import { Textarea } from "../ui/textarea";
import { ErrorNode } from "./error-node";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export const ActionHttpNode: NodeTypes[keyof NodeTypes] = (props) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const parsedData = useMemo(() => actionHttpDataSchema.safeParse(props.data), [props.data]);

  const handleChange = useCallback(
    (updates: Record<string, unknown>) => {
      updateNodeData(props.id, { ...updates, dirty: true });
    },
    [props.id, updateNodeData]
  );

  if (!parsedData.success) {
    return <ErrorNode title="Invalid HTTP Node Data" description={parsedData.error.message} node={props} />;
  }

  const d = parsedData.data;
  const hasBody = d.method !== "GET";

  return (
    <NodeCard title="HTTP Request" node={props}>
      <div className="p-3 space-y-2 text-sm">
        <div className="flex gap-2 items-center">
          <Select
            value={d.method}
            onValueChange={(v) => handleChange({ method: v })}
          >
            <SelectTrigger className="w-24 nodrag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="https://api.example.com/..."
            value={d.url ?? ""}
            onChange={(e) => handleChange({ url: e.target.value })}
            className="nodrag flex-1 font-mono text-xs"
          />
        </div>
        {hasBody && (
          <>
            <Select
              value={d.bodyType ?? "json"}
              onValueChange={(v) => handleChange({ bodyType: v })}
            >
              <SelectTrigger className="w-24 nodrag">
                <SelectValue placeholder="Body type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="raw">Raw</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder='{"key": "value"} or raw body'
              value={d.body ?? ""}
              onChange={(e) => handleChange({ body: e.target.value })}
              className="nodrag min-h-[60px] font-mono text-xs"
            />
          </>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
