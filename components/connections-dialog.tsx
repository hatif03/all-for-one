"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONNECTION_KEYS, useConnectionsStore } from "@/lib/connections-store";
import { fetchAndIngestOpenAPI, ingestOpenAPISpec } from "@/lib/openapi-ingest";
import { useOpenApiStore } from "@/lib/openapi-store";
import { RiAddLine, RiCheckLine, RiKey2Line, RiLinkM, RiDeleteBin2Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ConnectionsDialog({ children }: { children: React.ReactNode }) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [addApiUrl, setAddApiUrl] = useState("");
  const [addApiJson, setAddApiJson] = useState("");
  const [addApiLoading, setAddApiLoading] = useState(false);
  const { connections, setConnection, removeConnection, open, setOpen } = useConnectionsStore();
  const { services: openApiServices, addService, removeService } = useOpenApiStore();

  const handleSave = (key: string) => {
    const value = inputValues[key];
    if (value?.trim()) {
      setConnection(key, value.trim());
    } else {
      removeConnection(key);
    }
  };

  useEffect(() => {
    const next: Record<string, string> = {};
    CONNECTION_KEYS.forEach((k) => {
      next[k] = connections[k] ?? "";
    });
    setInputValues((prev) => ({ ...prev, ...next }));
  }, [connections, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiLinkM className="size-5 shrink-0" />
            Connect your tools
          </DialogTitle>
          <DialogDescription>
            Connect Gmail, Slack, and other services so workflows can send email or post messages. Add an OpenAPI spec to let the app choose the right API action from your description.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {openApiServices.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Your APIs</p>
              <ul className="space-y-1">
                {openApiServices.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 bg-card p-2 rounded text-sm">
                    <span>{s.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        removeService(s.id);
                        toast.success(`Removed ${s.name}`);
                      }}
                    >
                      <RiDeleteBin2Line className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">Add API (OpenAPI spec)</p>
            <p className="text-xs text-muted-foreground">
              Enter a spec URL or paste openapi.json. You can then describe actions in plain language (e.g. &quot;Create a contact&quot;) when creating workflows.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://api.example.com/openapi.json"
                value={addApiUrl}
                onChange={(e) => setAddApiUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!addApiUrl.trim() || addApiLoading}
                onClick={async () => {
                  setAddApiLoading(true);
                  try {
                    const service = await fetchAndIngestOpenAPI(addApiUrl.trim());
                    addService(service);
                    setAddApiUrl("");
                    toast.success(`${service.name} added. You can say e.g. "${service.operations[0]?.name ?? "use an action"}" in your workflow description.`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to load spec");
                  } finally {
                    setAddApiLoading(false);
                  }
                }}
              >
                Load from URL
              </Button>
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder='Paste OpenAPI JSON here (e.g. {"openapi":"3.0","paths":{...}})'
                value={addApiJson}
                onChange={(e) => setAddApiJson(e.target.value)}
                className="min-h-[80px] font-mono text-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!addApiJson.trim() || addApiLoading}
                onClick={() => {
                  setAddApiLoading(true);
                  try {
                    const spec = JSON.parse(addApiJson.trim()) as Parameters<typeof ingestOpenAPISpec>[0];
                    const service = ingestOpenAPISpec(spec);
                    addService(service);
                    setAddApiJson("");
                    toast.success(`${service.name} added.`);
                  } catch {
                    toast.error("Invalid JSON or OpenAPI spec");
                  } finally {
                    setAddApiLoading(false);
                  }
                }}
              >
                <RiAddLine className="size-4 shrink-0" />
                Import JSON
              </Button>
            </div>
          </div>
          {CONNECTION_KEYS.map((key) => (
            <div key={key} className="bg-card p-3 rounded-lg flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RiKey2Line className="size-5" />
                  <span className="text-sm font-medium">{key}</span>
                  {connections[key] && (
                    <span className="text-xs text-green-600 bg-green-200 dark:bg-green-500/20 dark:text-green-400 px-2 py-1 rounded">
                      Connected
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  type="password"
                  placeholder={`${key} API key or token`}
                  value={inputValues[key] ?? ""}
                  onChange={(e) => setInputValues((p) => ({ ...p, [key]: e.target.value }))}
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" onClick={() => handleSave(key)}>
                  <RiCheckLine className="size-4 shrink-0" />
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
