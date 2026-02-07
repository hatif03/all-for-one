import { NodeCard } from "@/components/node-card";
import { actionEmailDataSchema } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { RiFileTextLine, RiMailLine } from "@remixicon/react";
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

export const ActionEmailNode: NodeTypes[keyof NodeTypes] = (props) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const parsedData = useMemo(() => actionEmailDataSchema.safeParse(props.data), [props.data]);

  const handleChange = useCallback(
    (updates: Record<string, unknown>) => {
      updateNodeData(props.id, { ...updates, dirty: true });
    },
    [props.id, updateNodeData]
  );

  if (!parsedData.success) {
    return <ErrorNode title="Invalid Email Node Data" description={parsedData.error.message} node={props} />;
  }

  const d = parsedData.data;
  const isList = d.toSource === "list";

  return (
    <NodeCard title="Send Email" node={props}>
      <div className="p-3 space-y-2 text-sm">
        <Select value={d.service ?? "SendGrid"} onValueChange={(v) => handleChange({ service: v })}>
          <SelectTrigger className="nodrag">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SendGrid">SendGrid</SelectItem>
            <SelectItem value="Gmail">Gmail</SelectItem>
          </SelectContent>
        </Select>
        <Select value={d.toSource ?? "single"} onValueChange={(v) => handleChange({ toSource: v as "single" | "list" })}>
          <SelectTrigger className="nodrag">
            <SelectValue placeholder="Send to" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">One recipient</SelectItem>
            <SelectItem value="list">Many (from list/CSV above)</SelectItem>
          </SelectContent>
        </Select>
        {isList ? (
          <div className="flex items-center gap-2">
            <RiMailLine className="size-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Column for email (e.g. email)"
              value={d.toListField ?? "email"}
              onChange={(e) => handleChange({ toListField: e.target.value })}
              className="nodrag flex-1"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <RiMailLine className="size-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="To (email)"
              value={d.to ?? ""}
              onChange={(e) => handleChange({ to: e.target.value })}
              className="nodrag flex-1"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <RiFileTextLine className="size-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Subject"
            value={d.subject ?? ""}
            onChange={(e) => handleChange({ subject: e.target.value })}
            className="nodrag flex-1"
          />
        </div>
        <Textarea
          placeholder="Body"
          value={d.body ?? ""}
          onChange={(e) => handleChange({ body: e.target.value })}
          className="nodrag min-h-[60px]"
        />
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
