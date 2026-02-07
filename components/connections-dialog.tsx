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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CONNECTION_KEYS, useConnectionsStore } from "@/lib/connections-store";
import { fetchAndIngestOpenAPI, ingestOpenAPISpec } from "@/lib/openapi-ingest";
import { useOpenApiStore } from "@/lib/openapi-store";
import { RiAddLine, RiCheckLine, RiKey2Line, RiLinkM, RiDeleteBin2Line, RiExternalLinkLine, RiListUnordered } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

const CREDENTIAL_HINTS: Record<string, string> = {
  Gmail: "Get a token: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0; or use OAuth 2.0 Playground to get an access token for Gmail scopes.",
  SendGrid: "Get an API key: sendgrid.com → Settings → API Keys → Create API Key (Mail Send permission).",
  Slack: "Get a bot token: api.slack.com/apps → Create New App → OAuth & Permissions → add chat:write (and others) → Install to Workspace → copy Bot User OAuth Token (xoxb-...).",
};

export default function ConnectionsDialog({ children }: { children: React.ReactNode }) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [addApiUrl, setAddApiUrl] = useState("");
  const [addApiDocsUrl, setAddApiDocsUrl] = useState("");
  const [addApiJson, setAddApiJson] = useState("");
  const [addApiJsonDocsUrl, setAddApiJsonDocsUrl] = useState("");
  const [addApiLoading, setAddApiLoading] = useState(false);
  const [endpointsSheetOpen, setEndpointsSheetOpen] = useState(false);
  const [endpointsSearch, setEndpointsSearch] = useState("");
  const { connections, setConnection, removeConnection, open, setOpen } = useConnectionsStore();
  const { services: openApiServices, addService, removeService } = useOpenApiStore();
  const endpointEntries = useMemo(() => {
    const list = openApiServices.flatMap((s) =>
      s.operations.map((op) => ({
        service: s.name,
        method: op.method,
        path: op.urlTemplate,
        name: op.name,
        params: op.params.map((p) => p.key).join(", "),
      }))
    );
    const q = endpointsSearch.trim().toLowerCase();
    return q ? list.filter((e) => e.service.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || e.path.toLowerCase().includes(q)) : list;
  }, [openApiServices, endpointsSearch]);

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
            Connections
          </DialogTitle>
          <DialogDescription>
            Add APIs (OpenAPI spec) or connect Gmail, SendGrid, or Slack for workflows.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {false && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Endpoints</p>
            <Sheet open={endpointsSheetOpen} onOpenChange={setEndpointsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <RiListUnordered className="size-4" />
                  View all endpoints
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-xl flex flex-col gap-4">
                <SheetHeader>
                  <SheetTitle>Your API endpoints</SheetTitle>
                  <SheetDescription>
                    Endpoints from APIs you’ve added (OpenAPI specs). Use these in HTTP nodes when building workflows.
                  </SheetDescription>
                </SheetHeader>
                <Input
                  placeholder="Search by name or path..."
                  value={endpointsSearch}
                  onChange={(e) => setEndpointsSearch(e.target.value)}
                  className="shrink-0"
                />
                <ScrollArea className="flex-1 rounded border">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">Service</th>
                        <th className="text-left p-2 font-medium">Method</th>
                        <th className="text-left p-2 font-medium min-w-[120px]">Endpoint</th>
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Params</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpointEntries.map((e, i) => (
                        <tr key={`${e.service}-${e.name}-${i}`} className="border-b last:border-0">
                          <td className="p-2">{e.service}</td>
                          <td className="p-2 font-mono text-xs">{e.method}</td>
                          <td className="p-2 font-mono text-xs truncate max-w-[180px]" title={e.path}>{e.path}</td>
                          <td className="p-2">{e.name}</td>
                          <td className="p-2 text-muted-foreground text-xs">{e.params || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                {endpointEntries.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {openApiServices.length === 0
                      ? "Add an OpenAPI spec above to see your API endpoints here."
                      : "No endpoints match your search."}
                  </p>
                )}
              </SheetContent>
            </Sheet>
          </div>
          )}
          {openApiServices.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Your APIs</p>
              <ul className="space-y-1">
                {openApiServices.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 bg-card p-2 rounded text-sm">
                    <span>{s.name}</span>
                    <div className="flex items-center gap-1">
                      {s.docsUrl && (
                        <a
                          href={s.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                        >
                          View docs
                          <RiExternalLinkLine className="size-3" />
                        </a>
                      )}
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
                    </div>
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
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="https://api.example.com/openapi.json"
                  value={addApiUrl}
                  onChange={(e) => setAddApiUrl(e.target.value)}
                  className="flex-1"
                  aria-label="Spec URL (OpenAPI JSON endpoint)"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!addApiUrl.trim() || addApiLoading}
                  onClick={async () => {
                    setAddApiLoading(true);
                    try {
                      const service = await fetchAndIngestOpenAPI(addApiUrl.trim());
                      addService({
                        ...service,
                        docsUrl: addApiDocsUrl.trim() || undefined,
                      });
                      setAddApiUrl("");
                      setAddApiDocsUrl("");
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
              <Input
                placeholder="Documentation URL (optional, e.g. link to API docs)"
                value={addApiDocsUrl}
                onChange={(e) => setAddApiDocsUrl(e.target.value)}
                className="text-sm text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Textarea
                  placeholder='Paste OpenAPI JSON here (e.g. {"openapi":"3.0","paths":{...}})'
                  value={addApiJson}
                  onChange={(e) => setAddApiJson(e.target.value)}
                  className="min-h-[80px] font-mono text-xs flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!addApiJson.trim() || addApiLoading}
                  onClick={() => {
                    setAddApiLoading(true);
                    try {
                      const raw = JSON.parse(addApiJson.trim()) as Record<string, unknown> | Parameters<typeof ingestOpenAPISpec>[0];
                      const spec =
                        raw && typeof raw === "object" && "spec" in raw && raw.spec
                          ? (raw.spec as Parameters<typeof ingestOpenAPISpec>[0])
                          : (raw as Parameters<typeof ingestOpenAPISpec>[0]);
                      const service = ingestOpenAPISpec(spec);
                      addService({
                        ...service,
                        docsUrl: addApiJsonDocsUrl.trim() || undefined,
                      });
                      setAddApiJson("");
                      setAddApiJsonDocsUrl("");
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
              <Input
                placeholder="Documentation URL (optional)"
                value={addApiJsonDocsUrl}
                onChange={(e) => setAddApiJsonDocsUrl(e.target.value)}
                className="text-sm text-muted-foreground"
              />
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
              {CREDENTIAL_HINTS[key] && (
                <p className="text-xs text-muted-foreground mt-0.5">{CREDENTIAL_HINTS[key]}</p>
              )}
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
