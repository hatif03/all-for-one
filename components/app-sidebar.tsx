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
  RiGithubLine,
  RiKeyLine,
  RiLinkM,
  RiMoonLine,
  RiSunLine,
} from "@remixicon/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import ApiKeys from "./api-keys";
import ConnectionsDialog from "./connections-dialog";
import ImportDialog from "./import-dialog";
import Logo from "./logo";
import { RequirementChat } from "./requirement-chat";
import { generateWorkflowFromSteps } from "@/lib/workflow-generator";

export function AppSidebar() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);

  const { createWorkflow, switchWorkflow, setWorkflowContent, currentWorkflowId } = useWorkflowStore(
    useShallow((state) => ({
      createWorkflow: state.createWorkflow,
      switchWorkflow: state.switchWorkflow,
      setWorkflowContent: state.setWorkflowContent,
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
                  <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle>Describe your workflow</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 min-h-0">
                      <RequirementChat
                        onGenerateWorkflow={(steps) => {
                          const name = "Generated workflow";
                          const id = createWorkflow(name);
                          const { nodes, edges } = generateWorkflowFromSteps(steps, name);
                          setWorkflowContent(id, nodes, edges);
                          switchWorkflow(id);
                          setAiSheetOpen(false);
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
            <ApiKeys>
              <SidebarMenuButton>
                <RiKeyLine className="size-4 shrink-0" />
                API Keys
              </SidebarMenuButton>
            </ApiKeys>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ConnectionsDialog>
              <SidebarMenuButton>
                <RiLinkM className="size-4 shrink-0" />
                Connections
              </SidebarMenuButton>
            </ConnectionsDialog>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="https://github.com/yourusername/one-for-all" target="_blank">
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
