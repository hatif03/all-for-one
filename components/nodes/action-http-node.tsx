import { NodeCard } from "@/components/node-card";
import { getMergedCatalog, findHttpOperationById } from "@/lib/http-node-catalog";
import { actionHttpDataSchema } from "@/lib/node-types";
import { useWorkflowStore } from "@/lib/workflow-store";
import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { RiLinkM } from "@remixicon/react";
import { useCallback, useMemo } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
  const catalogEntry = useMemo(() => findHttpOperationById(d.catalogOperationId), [d.catalogOperationId]);
  const mergedCatalog = useMemo(() => getMergedCatalog(), []);
  const hasBody = d.method !== "GET";

  const handleSelectAction = useCallback(
    (value: string) => {
      if (value === "__custom__") {
        handleChange({
          catalogServiceId: undefined,
          catalogOperationId: undefined,
          catalogParamValues: undefined,
          method: "GET",
          url: "",
          body: undefined,
        });
        return;
      }
      for (const service of mergedCatalog) {
        const op = service.operations.find((o) => o.id === value);
        if (op) {
          handleChange({
            catalogServiceId: service.id,
            catalogOperationId: op.id,
            method: op.method,
            url: op.urlTemplate,
            catalogParamValues: Object.fromEntries(op.params.map((p) => [p.key, `{{${p.key}}}`])),
          });
          return;
        }
      }
    },
    [handleChange, mergedCatalog]
  );

  const currentActionValue = d.catalogOperationId ?? "__custom__";
  const displayTitle = catalogEntry ? catalogEntry.operation.name : "HTTP Request";

  const content = catalogEntry ? (
    <div className="space-y-2">
      {catalogEntry.operation.params.map((p) => (
        <div key={p.key} className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {p.key}
            {p.required && " *"}
          </Label>
          <Input
            placeholder={p.description}
            value={d.catalogParamValues?.[p.key] ?? ""}
            onChange={(e) =>
              handleChange({
                catalogParamValues: { ...d.catalogParamValues, [p.key]: e.target.value },
              })
            }
            className="nodrag"
          />
        </div>
      ))}
    </div>
  ) : (
    <>
      <div className="flex gap-2 items-center">
        <Select value={d.method} onValueChange={(v) => handleChange({ method: v })}>
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
        <RiLinkM className="size-4 shrink-0 text-muted-foreground" />
        <Input
          placeholder="https://api.example.com/..."
          value={d.url ?? ""}
          onChange={(e) => handleChange({ url: e.target.value })}
          className="nodrag flex-1 font-mono text-xs"
        />
      </div>
      {hasBody && (
        <>
          <Select value={d.bodyType ?? "json"} onValueChange={(v) => handleChange({ bodyType: v })}>
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
    </>
  );

  return (
    <NodeCard title={displayTitle} node={props}>
      <div className="p-3 space-y-2 text-sm">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Action</Label>
          <Select value={currentActionValue} onValueChange={handleSelectAction}>
            <SelectTrigger className="nodrag w-full">
              <SelectValue placeholder="Choose an action or custom request" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__custom__">Custom request (URL + method)</SelectItem>
              {mergedCatalog.map((service) =>
                service.operations.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {service.name} - {op.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        {content}
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};
