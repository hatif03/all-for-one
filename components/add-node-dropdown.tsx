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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const NODE_GROUPS: {
  label: string;
  items: { type: string; label: string; description?: string; icon: React.ReactNode }[];
}[] = [
  {
    label: "Triggers",
    items: [
      { type: "trigger-manual", label: "Run by hand", description: "Start the workflow manually", icon: <RiInputMethodLine className="size-4" /> },
      { type: "trigger-webhook", label: "When something calls in", description: "Form submission or external event", icon: <RiLinkM className="size-4" /> },
      { type: "trigger-schedule", label: "Run on a schedule", description: "Daily, weekly, or custom time", icon: <RiCalendarLine className="size-4" /> },
    ],
  },
  {
    label: "Actions",
    items: [
      { type: "action-http", label: "Call an API or service", description: "Connect to another app or website", icon: <RiLinkM className="size-4" /> },
      { type: "action-email", label: "Send an email", description: "Send messages via Gmail or SendGrid", icon: <RiMailLine className="size-4" /> },
      { type: "action-slack", label: "Post to Slack", description: "Send a message to a channel", icon: <RiMessage2Line className="size-4" /> },
      { type: "action-document", label: "Process a document", description: "Extract or handle PDFs and forms", icon: <RiFileTextLine className="size-4" /> },
    ],
  },
  {
    label: "Control flow",
    items: [
      { type: "control-delay", label: "Delay (wait X time)", description: "Pause before the next step", icon: <RiTimeLine className="size-4" /> },
      { type: "control-condition", label: "If/else branch", description: "Do different things based on a condition", icon: <RiGitBranchLine className="size-4" /> },
      { type: "control-approval", label: "Wait for approval", description: "Someone must approve before continuing", icon: <RiCheckboxCircleLine className="size-4" /> },
    ],
  },
  {
    label: "Data & AI",
    items: [
      { type: "data-transform", label: "Transform data", description: "Map or reshape data between steps", icon: <RiFlowChart className="size-4" /> },
      { type: "prompt", label: "Prompt", description: "Text template with placeholders", icon: <RiTextSnippet className="size-4" /> },
      { type: "ai", label: "AI", description: "Use AI to generate or decide", icon: <RiAiGenerate2 className="size-4" /> },
      { type: "markdown", label: "Markdown", description: "Rich text content", icon: <RiMarkdownLine className="size-4" /> },
      { type: "annotation", label: "Annotation", description: "Note or instruction on the canvas", icon: <RiChatQuoteLine className="size-4" /> },
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
                  <TooltipProvider key={item.type}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 font-normal"
                          onClick={() => handleAdd(item.type)}
                        >
                          {item.icon}
                          {item.label}
                        </Button>
                      </TooltipTrigger>
                      {item.description && (
                        <TooltipContent side="right" className="max-w-xs">
                          <p>{item.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});
