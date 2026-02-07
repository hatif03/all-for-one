"use client";

import { useRequirementStore } from "@/lib/requirement-store";
import { useExamplesStore } from "@/lib/examples-store";
import { requirementToSteps } from "@/lib/requirement-ai";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  RiBookmarkLine,
  RiCalendarLine,
  RiMailLine,
  RiMagicLine,
  RiMessage2Line,
  RiSendPlaneLine,
} from "@remixicon/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function RequirementChat({
  onGenerateWorkflow,
}: {
  onGenerateWorkflow?: (steps: { id: string; description: string }[]) => void;
}) {
  const { messages, steps, isLoading, addMessage, setSteps, setLoading } = useRequirementStore();
  const addExample = useExamplesStore((s) => s.addExample);
  const [input, setInput] = useState("");

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    addMessage({ role: "user", content: text });
    setLoading(true);
    try {
      const result = await requirementToSteps(messages, text);
      addMessage({ role: "assistant", content: result.message });
      if (result.steps?.length) {
        setSteps(result.steps);
      }
    } catch (err) {
      addMessage({
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  }, [input, isLoading, messages, addMessage, setSteps, setLoading]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
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
                "rounded-lg px-3 py-2 max-w-[85%] text-sm",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {m.content}
            </div>
          ))}
          {steps != null && steps.length > 0 && (
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <p className="text-sm font-medium">Steps I&apos;ll create:</p>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                {steps.map((s) => (
                  <li key={s.id}>{s.description}</li>
                ))}
              </ol>
              <div className="flex gap-2 mt-2">
                {onGenerateWorkflow && (
                  <Button className="flex-1" onClick={() => onGenerateWorkflow(steps)}>
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
