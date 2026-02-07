"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { toN8nWorkflow } from "@/lib/export-n8n";
import { applyNaturalLanguageEdit } from "@/lib/workflow-edit-ai";
import { getCleanedWorkflow, useWorkflowStore, type WorkflowState } from "@/lib/workflow-store";
import {
  RiAiGenerate2,
  RiArrowUpBoxLine,
  RiChatQuoteLine,
  RiDeleteBin2Line,
  RiMarkdownLine,
  RiPencilLine,
  RiStopLine,
  RiTextSnippet,
  RiCheckboxCircleLine,
} from "@remixicon/react";
import { Panel, useReactFlow } from "@xyflow/react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

export const Panels = memo(function Panels() {
  return (
    <>
      <TopLeftPanel />
      <TopRightPanel />
      <BottomCenterPanel />
    </>
  );
});

const TopLeftPanel = memo(function TopLeftPanel() {
  const { updateWorkflowName, currentName, currentWorkflowId } = useWorkflowStore(
    useShallow((state: WorkflowState) => ({
      updateWorkflowName: state.updateWorkflowName,
      currentName: state.getCurrentWorkflow()?.name,
      currentWorkflowId: state.currentWorkflowId,
    }))
  );

  const handleCanvasNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (currentWorkflowId) {
        updateWorkflowName(currentWorkflowId, e.target.value);
      }
    },
    [currentWorkflowId, updateWorkflowName]
  );

  if (currentName === undefined) return null;

  return (
    <Panel position="top-left">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Input
          value={currentName}
          onChange={handleCanvasNameChange}
          placeholder="Canvas name..."
          className="w-fit max-w-64 font-semibold not-focus:bg-transparent not-focus:border-transparent not-focus:ring-0 dark:not-focus:bg-transparent dark:not-focus:border-transparent dark:not-focus:ring-0 not-focus:-translate-x-4 transition-all not-focus:shadow-none"
        />
      </div>
    </Panel>
  );
});

const TopRightPanel = memo(function TopRightPanel() {
  const [nlEditOpen, setNlEditOpen] = useState(false);
  const [nlEditInput, setNlEditInput] = useState("");
  const [nlEditLoading, setNlEditLoading] = useState(false);
  const {
    deleteWorkflow,
    getCurrentWorkflow,
    getNodes,
    getEdges,
    currentWorkflowId,
    abortAllOperations,
    setWorkflowContent,
    setWorkflowMetadata,
    isRunning,
  } = useWorkflowStore(
    useShallow((state: WorkflowState) => ({
      deleteWorkflow: state.deleteWorkflow,
      getCurrentWorkflow: state.getCurrentWorkflow,
      getNodes: state.getNodes,
      getEdges: state.getEdges,
      currentWorkflowId: state.currentWorkflowId,
      abortAllOperations: state.abortAllOperations,
      setWorkflowContent: state.setWorkflowContent,
      setWorkflowMetadata: state.setWorkflowMetadata,
      isRunning: state.getNodes().some((node) => node.data.loading),
    }))
  );
  const workflow = getCurrentWorkflow();
  const isAiGenerated = workflow?.metadata?.source === "ai-generated";
  const isApproved = workflow?.metadata?.approved === true;

  const handleApproveDeploy = useCallback(() => {
    if (currentWorkflowId) {
      setWorkflowMetadata(currentWorkflowId, { approved: true });
      toast.success("Workflow approved and ready to run");
    }
  }, [currentWorkflowId, setWorkflowMetadata]);

  const handleNlEditSubmit = useCallback(async () => {
    if (!currentWorkflowId || !nlEditInput.trim()) return;
    setNlEditLoading(true);
    try {
      const result = await applyNaturalLanguageEdit(getNodes(), getEdges(), nlEditInput.trim());
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setWorkflowContent(currentWorkflowId, result.nodes, result.edges);
        toast.success("Workflow updated");
        setNlEditInput("");
        setNlEditOpen(false);
      }
    } finally {
      setNlEditLoading(false);
    }
  }, [currentWorkflowId, nlEditInput, getNodes, getEdges, setWorkflowContent]);

  const handleDeleteWorkflow = useCallback(() => {
    if (currentWorkflowId && confirm("Are you sure you want to delete this workflow? This action cannot be undone.")) {
      deleteWorkflow(currentWorkflowId);
    }
  }, [currentWorkflowId, deleteWorkflow]);

  const handleExportToClipboard = useCallback(() => {
    const w = getCurrentWorkflow();
    if (w) {
      navigator.clipboard.writeText(JSON.stringify(getCleanedWorkflow(w), null, 2));
      toast.success("Workflow copied to clipboard");
    }
  }, [getCurrentWorkflow]);

  const handleExportN8n = useCallback(() => {
    const w = getCurrentWorkflow();
    if (!w) return;
    const n8n = toN8nWorkflow(w.name, getNodes(), getEdges());
    navigator.clipboard.writeText(JSON.stringify(n8n, null, 2));
    toast.success("Exported for n8n (copied to clipboard)");
  }, [getCurrentWorkflow, getNodes, getEdges]);

  return (
    <Panel position="top-right">
      <div className="flex items-center gap-2">
        {isAiGenerated && !isApproved && (
          <Button size="sm" onClick={handleApproveDeploy}>
            <RiCheckboxCircleLine className="size-4 shrink-0" />
            <span className="hidden sm:block">Approve & deploy</span>
          </Button>
        )}
        <Dialog open={nlEditOpen} onOpenChange={setNlEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RiPencilLine className="size-4 shrink-0" />
              <span className="hidden sm:block">Edit in NL</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit with natural language</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder='e.g. "Add a delay before sending the email"'
              value={nlEditInput}
              onChange={(e) => setNlEditInput(e.target.value)}
              className="min-h-[80px]"
              disabled={nlEditLoading}
            />
            <Button onClick={handleNlEditSubmit} disabled={nlEditLoading || !nlEditInput.trim()}>
              {nlEditLoading ? "Applying..." : "Apply changes"}
            </Button>
          </DialogContent>
        </Dialog>
        {isRunning && (
          <Button variant="outline" size="sm" onClick={abortAllOperations}>
            <RiStopLine className="size-4" />
            Stop all
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleExportToClipboard}>
          <RiArrowUpBoxLine className="size-4" />
          <span className="hidden sm:block">Export</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportN8n}>
          <span className="hidden sm:block">Export for n8n</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeleteWorkflow}
          className="text-destructive hover:text-destructive"
        >
          <RiDeleteBin2Line className="size-4" />
          <span className="hidden sm:block">Delete Workflow</span>
        </Button>
      </div>
    </Panel>
  );
});

const BottomCenterPanel = memo(function BottomCenterPanel() {
  const instance = useReactFlow();
  const addNode = useWorkflowStore((state: WorkflowState) => state.addNode);

  const handleAddNode = useCallback(
    (type: string) => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const position = instance.screenToFlowPosition({ x: screenWidth / 2, y: screenHeight / 2 });
      switch (type) {
        case "prompt":
          addNode({
            data: { prompt: "" },
            position,
            height: 500,
            width: 450,
            type: type,
          });
          break;
        case "ai":
          addNode({
            data: { systemPrompt: "" },
            position,
            height: 500,
            width: 450,
            type: type,
          });
          break;
        case "markdown":
          addNode({
            data: {},
            position,
            height: 500,
            width: 450,
            type: type,
          });
          break;
        case "annotation":
          addNode({
            data: { text: "" },
            position,
            height: 150,
            width: 400,
            type: type,
          });
          break;
      }
    },
    [addNode, instance]
  );

  return (
    <Panel position="bottom-center">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => handleAddNode("prompt")}>
          <RiTextSnippet className="size-5 shrink-0" />
          <span className="hidden sm:block">Prompt</span>
        </Button>
        <Button variant="outline" onClick={() => handleAddNode("ai")}>
          <RiAiGenerate2 className="size-5 shrink-0" />
          <span className="hidden sm:block">AI</span>
        </Button>
        <Button variant="outline" onClick={() => handleAddNode("markdown")}>
          <RiMarkdownLine className="size-5 shrink-0" />
          <span className="hidden sm:block">Markdown</span>
        </Button>
        <Button variant="outline" onClick={() => handleAddNode("annotation")}>
          <RiChatQuoteLine className="size-5 shrink-0" />
          <span className="hidden sm:block">Annotation</span>
        </Button>
      </div>
    </Panel>
  );
});

