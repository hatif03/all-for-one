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
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ThinkingBlock({ thinking, defaultOpen = false }: { thinking: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!thinking.trim()) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2 pt-2 border-t border-border/50">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground/80 transition-colors">
        {open ? <RiArrowUpSLine className="size-3 shrink-0" /> : <RiArrowDownSLine className="size-3 shrink-0" />}
        <span className="underline decoration-dotted underline-offset-1">Show thinking</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 rounded bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
          {thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Heuristic: content looks like clarification questions (short, contains questions) */
function looksLikeQuestions(content: string): boolean {
  const t = content.trim();
  if (t.length > 500 || t.length < 3) return false;
  return t.includes("?") || t.toLowerCase().includes("which ") || t.toLowerCase().includes("what ") || t.toLowerCase().includes("how ");
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
  const hasContent = content.trim().length > 0;
  const displayContent = hasContent
    ? content
    : isPending
      ? "Getting response…"
      : "";
  const isQuestion = displayContent ? looksLikeQuestions(displayContent) : false;
  return (
    <div
      className={cn(
        "rounded-xl max-w-[85%] text-sm",
        isQuestion
          ? "border border-primary/25 bg-primary/5 shadow-sm px-4 py-3"
          : "rounded-lg px-3 py-2 bg-muted",
        isPending && "opacity-90"
      )}
    >
      {displayContent ? (
        <div className={cn("text-foreground", isQuestion && "space-y-1")}>
          {isQuestion && (
            <p className="text-[10px] font-medium uppercase tracking-wider text-primary/80">Quick questions</p>
          )}
          <div className={cn(isQuestion && "text-[15px] leading-snug")}>{displayContent}</div>
        </div>
      ) : null}
      {showThinking && <ThinkingBlock thinking={thinking!} defaultOpen={isPending} />}
    </div>
  );
}

export function RequirementChat({
  onGenerateWorkflow,
}: {
  onGenerateWorkflow?: (
    steps: { id: string; description: string }[],
    clarificationValues?: Record<string, string>,
    clarifications?: { stepId: string; question: string; placeholder: string; targetField?: string }[]
  ) => void;
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
  const stepsSectionRef = useRef<HTMLDivElement>(null);

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
      const rawContent =
        result.displayContent ??
        useRequirementStore.getState().pendingContent ??
        result.message ??
        "No response.";
      const hasSteps = result.steps && result.steps.length > 0;
      const content =
        hasSteps
          ? `I've broken this into ${result.steps!.length} steps. Review below and click "Generate workflow" to build it.`
          : rawContent;
      commitPendingMessage(thinking, content);
      if (hasSteps) {
        setSteps(result.steps!);
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

  useEffect(() => {
    if (steps?.length && !isLoading) {
      const t = setTimeout(() => stepsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
      return () => clearTimeout(t);
    }
  }, [steps?.length, isLoading]);

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
                "max-w-[85%] text-sm animate-in fade-in-0 duration-200",
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
            <div ref={stepsSectionRef} className="rounded-lg border bg-card p-3 space-y-2 scroll-mt-4">
              <p className="text-sm font-medium">Steps I&apos;ll create:</p>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                {steps.map((s) => (
                  <li key={s.id}>{s.description}</li>
                ))}
              </ol>
              {clarifications != null && clarifications.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <p className="text-xs font-semibold text-foreground">Optional details</p>
                  <div className="space-y-2">
                    {clarifications.map((c, idx) => {
                      const inputKey = `${c.stepId}-${idx}`;
                      return (
                        <label key={inputKey} className="block">
                          <span className="text-sm font-medium text-foreground block mb-1">{c.question}</span>
                          <input
                            type="text"
                            placeholder={c.placeholder}
                            value={clarificationValues[inputKey] ?? ""}
                            onChange={(e) =>
                              setClarificationValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                      onGenerateWorkflow(
                        steps,
                        Object.keys(clarificationValues).length > 0 ? clarificationValues : undefined,
                        clarifications ?? undefined
                      )
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
