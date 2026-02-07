"use client";

import { useWorkflowStore } from "@/lib/workflow-store";
import { useReactFlow } from "@xyflow/react";
import {
  RiAddLine,
  RiMailLine,
  RiMessage2Line,
  RiTimeLine,
  RiCheckboxCircleLine,
  RiGitBranchLine,
  RiFileTextLine,
  RiLinkM,
  RiCalendarLine,
  RiInputMethodLine,
  RiFlowChart,
  RiAiGenerate2,
  RiMarkdownLine,
  RiChatQuoteLine,
  RiTextSnippet,
} from "@remixicon/react";
import { memo, useCallback } from "react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";

const NODE_GROUPS: { label: string; items: { type: string; label: string; icon: React.ReactNode }[] }[] = [
  {
    label: "Triggers",
    items: [
      { type: "trigger-manual", label: "Manual", icon: <RiInputMethodLine className="size-4" /> },
      { type: "trigger-webhook", label: "Webhook", icon: <RiLinkM className="size-4" /> },
      { type: "trigger-schedule", label: "Schedule", icon: <RiCalendarLine className="size-4" /> },
    ],
  },
  {
    label: "Actions",
    items: [
      { type: "action-http", label: "HTTP", icon: <RiLinkM className="size-4" /> },
      { type: "action-email", label: "Email", icon: <RiMailLine className="size-4" /> },
      { type: "action-slack", label: "Slack", icon: <RiMessage2Line className="size-4" /> },
      { type: "action-document", label: "Document", icon: <RiFileTextLine className="size-4" /> },
    ],
  },
  {
    label: "Control flow",
    items: [
      { type: "control-delay", label: "Delay", icon: <RiTimeLine className="size-4" /> },
      { type: "control-condition", label: "Condition", icon: <RiGitBranchLine className="size-4" /> },
      { type: "control-approval", label: "Approval", icon: <RiCheckboxCircleLine className="size-4" /> },
    ],
  },
  {
    label: "Data & AI",
    items: [
      { type: "data-transform", label: "Transform", icon: <RiFlowChart className="size-4" /> },
      { type: "prompt", label: "Prompt", icon: <RiTextSnippet className="size-4" /> },
      { type: "ai", label: "AI", icon: <RiAiGenerate2 className="size-4" /> },
      { type: "markdown", label: "Markdown", icon: <RiMarkdownLine className="size-4" /> },
      { type: "annotation", label: "Annotation", icon: <RiChatQuoteLine className="size-4" /> },
    ],
  },
];

const defaultSize = { height: 200, width: 280 };
const largeSize = { height: 500, width: 450 };

function getNodePayload(type: string, position: { x: number; y: number }) {
  switch (type) {
    case "prompt":
      return { data: { prompt: "" }, position, ...largeSize, type };
    case "ai":
      return { data: { systemPrompt: "" }, position, ...largeSize, type };
    case "markdown":
      return { data: {}, position, ...largeSize, type };
    case "annotation":
      return { data: { text: "" }, position, ...largeSize, type };
    default:
      return { data: {}, position, ...defaultSize, type };
  }
}

export const AddNodeDropdown = memo(function AddNodeDropdown() {
  const instance = useReactFlow();
  const addNode = useWorkflowStore((state) => state.addNode);

  const handleAdd = useCallback(
    (type: string) => {
      const { x, y } = instance.screenToFlowPosition({
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
        y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
      });
      addNode(getNodePayload(type, { x, y }) as Parameters<typeof addNode>[0]);
    },
    [addNode, instance]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <RiAddLine className="size-4 shrink-0" />
          Add node
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <ScrollArea className="h-[320px] w-full rounded-md">
          <div className="p-1 pr-3">
            {NODE_GROUPS.map((group) => (
              <div key={group.label} className="py-1">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <Button
                    key={item.type}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 font-normal"
                    onClick={() => handleAdd(item.type)}
                  >
                    {item.icon}
                    {item.label}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});
