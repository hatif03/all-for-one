"use client";

import { useRequirementStore } from "@/lib/requirement-store";
import { useExamplesStore } from "@/lib/examples-store";
import { requirementToStepsStream } from "@/lib/requirement-ai";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  RiBookmarkLine,
  RiCalendarLine,
  RiMailLine,
  RiMagicLine,
  RiMessage2Line,
  RiSendPlaneLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
} from "@remixicon/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ThinkingBlock({ thinking, defaultOpen = false }: { thinking: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!thinking.trim()) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground/80 hover:text-muted-foreground">
        {open ? <RiArrowUpSLine className="size-3 shrink-0" /> : <RiArrowDownSLine className="size-3 shrink-0" />}
        Thinking
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground/80 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AssistantBubble({
  content,
  thinking,
  isPending,
}: {
  content: string;
  thinking?: string;
  isPending?: boolean;
}) {
  const showThinking = (thinking?.trim() ?? "").length > 0;
  const displayContent = content.trim()
    ? content
    : isPending
      ? "…"
      : "";
  return (
    <div className={cn("rounded-lg px-3 py-2 max-w-[85%] text-sm bg-muted", isPending && "opacity-90")}>
      {showThinking && <ThinkingBlock thinking={thinking!} defaultOpen={isPending} />}
      {displayContent ? <div className="text-foreground">{displayContent}</div> : null}
    </div>
  );
}

export function RequirementChat({
  onGenerateWorkflow,
}: {
  onGenerateWorkflow?: (steps: { id: string; description: string }[], clarificationValues?: Record<string, string>) => void;
}) {
  const {
    messages,
    steps,
    clarifications,
    isLoading,
    progressMessage,
    pendingThinking,
    pendingContent,
    addMessage,
    setSteps,
    setClarifications,
    setLoading,
    appendPendingThinking,
    appendPendingContent,
    commitPendingMessage,
    clearPending,
  } = useRequirementStore();
  const addExample = useExamplesStore((s) => s.addExample);
  const [input, setInput] = useState("");
  const [clarificationValues, setClarificationValues] = useState<Record<string, string>>({});

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    addMessage({ role: "user", content: text });
    setLoading(true);
    clearPending();
    try {
      const result = await requirementToStepsStream(messages, text, {
        onThinkingFragment: appendPendingThinking,
        onContentFragment: appendPendingContent,
      });
      const thinking = result.displayThinking ?? useRequirementStore.getState().pendingThinking;
      const content = result.displayContent ?? useRequirementStore.getState().pendingContent;
      commitPendingMessage(thinking, content);
      if (result.steps?.length) {
        setSteps(result.steps);
        setClarifications(result.clarifications ?? null);
        setClarificationValues({});
      } else {
        setSteps(null);
        setClarifications(null);
      }
    } catch (err) {
      clearPending();
      const errorMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
      addMessage({ role: "assistant", content: errorMsg });
    } finally {
      setLoading(false);
    }
  }, [
    input,
    isLoading,
    messages,
    addMessage,
    setSteps,
    setClarifications,
    setLoading,
    appendPendingThinking,
    appendPendingContent,
    commitPendingMessage,
    clearPending,
  ]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 p-4">
        <div className="space-y-4">
          {messages.length === 0 && !isLoading && (
            <>
              <p className="text-sm text-muted-foreground">
                Describe what you want to automate. For example: &quot;Send an email to everyone on my list&quot; or &quot;When a form is submitted, notify my team.&quot;
              </p>
              <p className="text-xs font-medium text-muted-foreground">I want to…</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 text-left justify-start gap-2 font-normal"
                  onClick={() => setInput("Send a welcome email to new signups when they register.")}
                >
                  <RiMailLine className="size-4 shrink-0" />
                  Send a welcome email to new signups
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 text-left justify-start gap-2 font-normal"
                  onClick={() => setInput("When a form is submitted, notify my team in Slack and send a confirmation email.")}
                >
                  <RiMessage2Line className="size-4 shrink-0" />
                  Notify my team when a form is submitted
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 text-left justify-start gap-2 font-normal"
                  onClick={() => setInput("Run a report every Monday at 9am, then email it to the team and post a summary in Slack.")}
                >
                  <RiCalendarLine className="size-4 shrink-0" />
                  Run a report weekly and email it
                </Button>
              </div>
            </>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] text-sm",
                m.role === "user" && "ml-auto"
              )}
            >
              {m.role === "user" ? (
                <div className="rounded-lg px-3 py-2 bg-primary text-primary-foreground">
                  {m.content}
                </div>
              ) : (
                <AssistantBubble content={m.content} thinking={m.thinking} />
              )}
            </div>
          ))}
          {isLoading && (
            <div className="max-w-[85%]">
              <AssistantBubble
                content={pendingContent}
                thinking={pendingThinking}
                isPending
              />
            </div>
          )}
          {progressMessage && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {progressMessage}
            </div>
          )}
          {steps != null && steps.length > 0 && !isLoading && (
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <p className="text-sm font-medium">Steps I&apos;ll create:</p>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                {steps.map((s) => (
                  <li key={s.id}>{s.description}</li>
                ))}
              </ol>
              {clarifications != null && clarifications.length > 0 && (
                <div className="text-xs space-y-2 pt-1 border-t">
                  <p className="font-medium text-muted-foreground">Optional details:</p>
                  <div className="space-y-1.5">
                    {clarifications.map((c, idx) => {
                      const inputKey = `${c.stepId}-${idx}`;
                      return (
                        <label key={inputKey} className="block">
                          <span className="text-muted-foreground">{c.question}</span>
                          <input
                            type="text"
                            placeholder={c.placeholder}
                            value={clarificationValues[inputKey] ?? ""}
                            onChange={(e) =>
                              setClarificationValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
                            }
                            className="mt-0.5 w-full rounded border bg-background px-2 py-1.5 text-sm"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                {onGenerateWorkflow && (
                  <Button
                    className="flex-1"
                    onClick={() =>
                      onGenerateWorkflow(steps, Object.keys(clarificationValues).length > 0 ? clarificationValues : undefined)
                    }
                  >
                    <RiMagicLine className="size-4 shrink-0" />
                    Generate workflow
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const requirement = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
                    addExample(requirement || "Workflow", steps);
                    toast.success("Saved as template for future generations");
                  }}
                  title="Save as template"
                >
                  <RiBookmarkLine className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t flex gap-2">
        <Textarea
          placeholder="Describe what you want to automate, e.g. 'Send an email to everyone on my list'"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="min-h-[60px] resize-none"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="shrink-0"
        >
          <RiSendPlaneLine className="size-5" />
        </Button>
      </div>
    </div>
  );
}
