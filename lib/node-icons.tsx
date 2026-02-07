"use client";

import React from "react";
import {
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

const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
  "trigger-manual": <RiInputMethodLine className="size-4 shrink-0" />,
  "trigger-webhook": <RiLinkM className="size-4 shrink-0" />,
  "trigger-schedule": <RiCalendarLine className="size-4 shrink-0" />,
  "action-http": <RiLinkM className="size-4 shrink-0" />,
  "action-email": <RiMailLine className="size-4 shrink-0" />,
  "action-slack": <RiMessage2Line className="size-4 shrink-0" />,
  "action-document": <RiFileTextLine className="size-4 shrink-0" />,
  "control-delay": <RiTimeLine className="size-4 shrink-0" />,
  "control-condition": <RiGitBranchLine className="size-4 shrink-0" />,
  "control-approval": <RiCheckboxCircleLine className="size-4 shrink-0" />,
  "data-transform": <RiFlowChart className="size-4 shrink-0" />,
  prompt: <RiTextSnippet className="size-4 shrink-0" />,
  ai: <RiAiGenerate2 className="size-4 shrink-0" />,
  markdown: <RiMarkdownLine className="size-4 shrink-0" />,
  annotation: <RiChatQuoteLine className="size-4 shrink-0" />,
};

export function getNodeIcon(type: string): React.ReactNode {
  return NODE_TYPE_ICONS[type] ?? null;
}
