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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDatasetsStore } from "@/lib/datasets-store";
import { useWorkflowStore } from "@/lib/workflow-store";
import { RiArrowDownBoxLine, RiFileList3Line } from "@remixicon/react";
import { useState } from "react";
import { toast } from "sonner";

export default function ImportDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [dataName, setDataName] = useState("");
  const [dataInput, setDataInput] = useState("");
  const importFromJson = useWorkflowStore((state) => state.importFromJson);
  const addDataset = useDatasetsStore((state) => state.addDataset);

  const handleImportWorkflow = () => {
    importFromJson(jsonInput.trim());
    setJsonInput("");
    setOpen(false);
  };

  const handleImportData = () => {
    const name = dataName.trim() || "Imported list";
    addDataset(name, dataInput.trim());
    setDataName("");
    setDataInput("");
    toast.success(`"${name}" saved. Use it in a Manual trigger via "Use dataset".`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiArrowDownBoxLine className="size-5 shrink-0" />
            Import
          </DialogTitle>
          <DialogDescription>
            Import a workflow (JSON) or a list/CSV to use in workflows (e.g. send email to many).
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="workflow" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="workflow" className="gap-1.5">
              <RiArrowDownBoxLine className="size-4" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5">
              <RiFileList3Line className="size-4" />
              Data (list/CSV)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="workflow" className="space-y-4 mt-4">
            <Textarea
              placeholder="Paste your workflow JSON here..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="h-[280px] break-all font-mono text-sm overflow-y-auto"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImportWorkflow} disabled={!jsonInput.trim()}>
                <RiArrowDownBoxLine className="size-4 shrink-0" />
                Import Workflow
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="data" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Paste a list (one per line) or CSV. Use it in a &quot;Run by hand&quot; trigger via &quot;Use dataset&quot; to send emails or run steps for each row.
            </p>
            <Input
              placeholder="Name (e.g. Newsletter recipients)"
              value={dataName}
              onChange={(e) => setDataName(e.target.value)}
            />
            <Textarea
              placeholder={'One per line: alice@example.com\nOr CSV with headers: email,name\na@x.com,Alice'}
              value={dataInput}
              onChange={(e) => setDataInput(e.target.value)}
              className="h-[200px] font-mono text-sm resize-y"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImportData} disabled={!dataInput.trim()}>
                <RiFileList3Line className="size-4 shrink-0" />
                Import data
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
