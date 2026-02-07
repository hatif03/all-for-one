"use client";

import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useOpenApiStore } from "@/lib/openapi-store";
import { RiListUnordered } from "@remixicon/react";
import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export function EndpointsSheet({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { services: openApiServices } = useOpenApiStore();

  const entries = useMemo(() => {
    const list = openApiServices.flatMap((s) =>
      s.operations.map((op) => ({
        service: s.name,
        method: op.method,
        path: op.urlTemplate,
        name: op.name,
        params: op.params.map((p) => p.key).join(", "),
      }))
    );
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.service.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.path.toLowerCase().includes(q)
    );
  }, [openApiServices, search]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? (
        <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : (
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <RiListUnordered className="size-4" />
            View endpoints
          </Button>
        </SheetTrigger>
      )}
      <SheetContent
        className="w-full sm:max-w-2xl flex flex-col gap-4 max-h-[90vh] min-h-0"
        side="right"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Your API endpoints</SheetTitle>
          <SheetDescription>
            Endpoints from APIs you’ve added (OpenAPI specs). Use these in HTTP nodes when building workflows.
          </SheetDescription>
        </SheetHeader>
        <Input
          placeholder="Search by name or path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="shrink-0"
        />
        <ScrollArea className="flex-1 min-h-[200px] rounded border overflow-auto">
          <div className="p-2 min-w-0">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium w-[130px]">Service</th>
                  <th className="text-left p-2 font-medium w-14">Method</th>
                  <th className="text-left p-2 font-medium">Endpoint</th>
                  <th className="text-left p-2 font-medium w-[160px]">Name</th>
                  <th className="text-left p-2 font-medium">Params</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={`${e.service}-${e.name}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-2 align-top">{e.service}</td>
                    <td className="p-2 font-mono text-xs align-top">{e.method}</td>
                    <td className="p-2 font-mono text-xs align-top break-all" title={e.path}>
                      {e.path}
                    </td>
                    <td className="p-2 align-top">{e.name}</td>
                    <td className="p-2 text-muted-foreground text-xs align-top break-all" title={e.params || undefined}>
                      {e.params || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground shrink-0">
            {openApiServices.length === 0
              ? "Add an OpenAPI spec in Connections to see your API endpoints here."
              : "No endpoints match your search."}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
