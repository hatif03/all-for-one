"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useWorkflowStore } from "@/lib/workflow-store";
import {
  RiAddLine,
  RiArrowDownBoxLine,
  RiChatSmile3Line,
  RiFlowChart,
  RiGithubLine,
  RiKeyLine,
  RiLinkM,
  RiListUnordered,
  RiMoonLine,
  RiSunLine,
  RiFileList3Line,
} from "@remixicon/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import ApiKeys from "./api-keys";
import ConnectionsDialog from "./connections-dialog";
import { EndpointsSheet } from "./endpoints-sheet";
import ImportDialog from "./import-dialog";
import Logo from "./logo";
import { RequirementChat } from "./requirement-chat";
import { generateWorkflowFromSteps } from "@/lib/workflow-generator";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export function AppSidebar() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [templateList, setTemplateList] = useState<{ name: string; description: string; nodes: unknown[]; edges: unknown[] }[]>([]);

  useEffect(() => {
    if (templateSheetOpen && templateList.length === 0) {
      import("@/lib/templates").then(({ getTemplatesForPicker }) => setTemplateList(getTemplatesForPicker()));
    }
  }, [templateSheetOpen, templateList.length]);

  const { createWorkflow, switchWorkflow, setWorkflowContent, setWorkflowMetadata, currentWorkflowId } = useWorkflowStore(
    useShallow((state) => ({
      createWorkflow: state.createWorkflow,
      switchWorkflow: state.switchWorkflow,
      setWorkflowContent: state.setWorkflowContent,
      setWorkflowMetadata: state.setWorkflowMetadata,
      currentWorkflowId: state.currentWorkflowId,
    }))
  );

  const serializedWorkflows = useWorkflowStore(
    useShallow((state) =>
      state.workflows
        .map((workflow) => ({
          name: workflow.name,
          id: workflow.id,
          createdAt: new Date(workflow.createdAt).toISOString(),
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((workflow) => `${workflow.name}:${workflow.id}`)
    )
  );

  const workflows = useMemo(() => {
    return serializedWorkflows.map((workflow) => {
      const lastDashIndex = workflow.lastIndexOf(":");
      const name = workflow.substring(0, lastDashIndex);
      const id = workflow.substring(lastDashIndex + 1);
      return {
        name,
        id,
      };
    });
  }, [serializedWorkflows]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const menuItems = workflows.map((workflow) => (
    <SidebarMenuItem key={workflow.id}>
      <SidebarMenuButton onClick={() => switchWorkflow(workflow.id)} isActive={workflow.id === currentWorkflowId}>
        <RiFlowChart className="size-4 shrink-0" />
        <span className="truncate">{workflow.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 flex items-center gap-2">
          <Logo className="size-18" />
          <span className="text-2xl tracking-tighter font-sans leading-none font-medium" suppressHydrationWarning>
            One for All
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>New</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Sheet open={aiSheetOpen} onOpenChange={setAiSheetOpen}>
                  <SheetTrigger asChild>
                    <SidebarMenuButton>
                      <RiChatSmile3Line className="size-4 shrink-0" />
                      Create with AI
                    </SidebarMenuButton>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 max-h-[100dvh]">
                    <SheetHeader className="p-4 border-b shrink-0">
                      <SheetTitle className="flex items-center gap-2">
                        <RiChatSmile3Line className="size-5 shrink-0" />
                        Describe your workflow
                      </SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      <RequirementChat
                        onGenerateWorkflow={async (steps, clarificationValues, clarifications) => {
                          const { useRequirementStore } = await import("@/lib/requirement-store");
                          const name = "Generated workflow";
                          const id = createWorkflow(name);
                          useRequirementStore.getState().setProgressMessage("Discovering operations…");
                          try {
                            const { nodes, edges } = await generateWorkflowFromSteps(steps, name, {
                              onProgress: (phase, detail) => {
                                useRequirementStore.getState().setProgressMessage(
                                  detail ? `${phase}: ${detail}` : phase
                                );
                              },
                              clarificationValues,
                              clarifications,
                            });
                            setWorkflowContent(id, nodes, edges);
                            setWorkflowMetadata(id, { source: "ai-generated", approved: false });
                            switchWorkflow(id);
                            setAiSheetOpen(false);
                          } finally {
                            useRequirementStore.getState().setProgressMessage("");
                          }
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => createWorkflow()}>
                  <RiAddLine className="size-4 shrink-0" />
                  New Workflow
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Sheet open={templateSheetOpen} onOpenChange={setTemplateSheetOpen}>
                  <SheetTrigger asChild>
                    <SidebarMenuButton>
                      <RiFileList3Line className="size-4 shrink-0" />
                      Start from template
                    </SidebarMenuButton>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle>Choose a template</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-2">
                        {templateList.map((t) => (
                          <Button
                            key={t.name}
                            variant="outline"
                            className="h-auto flex flex-col items-start gap-1 p-3 text-left w-full"
                            onClick={async () => {
                              const { cloneWorkflowContent } = await import("@/lib/templates");
                              const id = createWorkflow(t.name);
                              const { nodes, edges } = cloneWorkflowContent(t.nodes as Node[], t.edges as Edge[]);
                              setWorkflowContent(id, nodes, edges);
                              switchWorkflow(id);
                              setTemplateSheetOpen(false);
                            }}
                          >
                            <span className="font-medium">{t.name}</span>
                            <span className="text-xs text-muted-foreground font-normal">{t.description}</span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <ImportDialog>
                  <SidebarMenuButton>
                    <RiArrowDownBoxLine className="size-4 shrink-0" />
                    Import
                  </SidebarMenuButton>
                </ImportDialog>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Workflows</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mounted ? (
                menuItems
              ) : (
                <>
                  <SidebarMenuSkeleton />
                  <SidebarMenuSkeleton />
                  <SidebarMenuSkeleton />
                  <SidebarMenuSkeleton />
                  <SidebarMenuSkeleton />
                  <SidebarMenuSkeleton />
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ApiKeys>
                      <SidebarMenuButton>
                        <RiKeyLine className="size-4 shrink-0" />
                        API Keys
                      </SidebarMenuButton>
                    </ApiKeys>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Add an API key (e.g. Google) so the assistant can generate and edit workflows.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ConnectionsDialog>
                      <SidebarMenuButton>
                        <RiLinkM className="size-4 shrink-0" />
                        Connections
                      </SidebarMenuButton>
                    </ConnectionsDialog>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Add APIs (OpenAPI specs) and connect email or Slack.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <EndpointsSheet
              trigger={
                <SidebarMenuButton>
                  <RiListUnordered className="size-4 shrink-0" />
                  Your API endpoints
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="https://github.com/hatif03/one-for-all" target="_blank">
              <SidebarMenuButton>
                <RiGithubLine className="size-4 shrink-0" />
                GitHub
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {mounted ? (
              <SidebarMenuButton
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                suppressHydrationWarning
              >
                {resolvedTheme === "dark" ? (
                  <RiSunLine className="size-4 shrink-0" suppressHydrationWarning />
                ) : (
                  <RiMoonLine className="size-4 shrink-0" suppressHydrationWarning />
                )}{" "}
                {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
              </SidebarMenuButton>
            ) : (
              <SidebarMenuSkeleton />
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
