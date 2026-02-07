"use client";

import { NodeCard } from "@/components/node-card";
import { useDatasetsStore } from "@/lib/datasets-store";
import { triggerManualDataSchema } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { RiListUnordered } from "@remixicon/react";
import { useCallback, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { ErrorNode } from "./error-node";

export const TriggerManualNode: NodeTypes[keyof NodeTypes] = (props) => {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const parsedData = useMemo(() => triggerManualDataSchema.safeParse(props.data), [props.data]);

  const handleChange = useCallback(
    (updates: Record<string, unknown>) => {
      updateNodeData(props.id, { ...updates, dirty: true });
    },
    [props.id, updateNodeData]
  );

  if (!parsedData.success) {
    return <ErrorNode title="Invalid Trigger Data" description={parsedData.error.message} node={props} />;
  }

  const d = parsedData.data;
  const datasets = useDatasetsStore((s) => s.datasets);

  return (
    <NodeCard title="Run by hand" node={props}>
      <div className="p-3 space-y-2 text-sm">
        {datasets.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Use dataset</span>
            <Select
              value={d.datasetId ?? "__none__"}
              onValueChange={(v) => handleChange({ datasetId: v === "__none__" ? undefined : v, listInput: v === "__none__" ? d.listInput : undefined })}
            >
              <SelectTrigger className="nodrag">
                <SelectValue placeholder="None (paste below)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (paste below)</SelectItem>
                {datasets.map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>
                    {ds.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RiListUnordered className="size-3.5" />
            List input (optional)
          </span>
          <Textarea
            placeholder="One email per line, or paste CSV (first line = headers). Leave empty for a single run."
            value={d.listInput ?? ""}
            onChange={(e) => handleChange({ listInput: e.target.value, datasetId: undefined })}
            className="nodrag min-h-[80px] resize-y text-xs"
          />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
