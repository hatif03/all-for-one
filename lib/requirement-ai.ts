import { streamText } from "ai";
import { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { providers } from "./ai";
import { useApiKeysStore } from "./api-key-store";
import { useConnectionsStore } from "./connections-store";
import { useExamplesStore } from "./examples-store";
import { useOpenApiStore } from "./openapi-store";
import type { RequirementClarification, RequirementStep } from "./requirement-store";

const SLACK_CONTEXT_MAX_CHARS = 500;

/** Fetch Slack channel list when connected; return short summary for system prompt or empty on error. */
async function getSlackContext(): Promise<string> {
  const token = useConnectionsStore.getState().getConnection("Slack");
  if (!token) return "";
  try {
    const res = await fetch("https://slack.com/api/conversations.list", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 30 }),
    });
    const json = (await res.json()) as { ok?: boolean; channels?: { name?: string }[] };
    if (!json.ok || !Array.isArray(json.channels)) return "";
    const names = json.channels.map((c) => (c.name ? `#${c.name}` : "")).filter(Boolean);
    const str = names.slice(0, 15).join(", ");
    if (!str) return "";
    const line = `\n\nSlack channels available: ${str}. You can reference these in step descriptions when suggesting Slack steps.`;
    return line.slice(0, SLACK_CONTEXT_MAX_CHARS);
  } catch {
    return "";
  }
}

const SYSTEM_BASE = `You are a workflow assistant for an AI-powered business workflow builder. The user describes a business process they want to automate. Your job is to reason through it and either clarify or decompose it into a rich, multi-step workflow.

**Thinking process (follow these phases in order):**
1. **Understand:** Restate the user's goal and key entities (who, what, when, which systems).
2. **Scenarios:** Consider the happy path first, then failure and alternatives: what happens if approval is rejected, if an API fails, if data is missing, timeouts, retries, and branches (if X then A else B). Include condition, approval, or delay steps where they matter.
3. **Gaps:** Identify ambiguities or missing inputs (e.g. who receives the email, which Slack channel, approval timeout, retry count).
4. **Decide:** Either ask 1–2 short, actionable clarification questions (plain-text RESPONSE) or decompose into steps (JSON RESPONSE). If asking questions, phrase them so the user can answer briefly; offer to use placeholders if they prefer.

**Scenario coverage:** Consider: happy path; what happens on failure (approval rejected, API error); timeouts and delays; missing or invalid data; retries; alternative branches. Include condition, approval, or delay steps where relevant. If critical details are missing (e.g. who receives the email, which Slack channel, approval timeout), ask 1–2 brief questions before generating steps, unless the user said to use placeholders.

**Output rules:**
- If the requirement is clear enough to break into steps, reply with ONLY a valid JSON object (no markdown, no extra text): {"steps":[{"id":"1","description":"...","suggestedService":"..."}, ...]}.
- You may optionally add "clarifications" to the JSON: {"steps":[...], "clarifications":[{"stepId":"1","question":"Who should receive the welcome email?","placeholder":"new hire email"}]} for optional details the user can fill later.
- suggestedService must be one of: "email", "slack", "http", "approval", "delay", "document", "webhook", "schedule", "condition", "transform" when it fits:
  - email: sending emails; list or get emails (Gmail).
  - slack: posting to channels; inviting users; creating channels; channel history; list channels; reactions.
  - http: calling APIs, webhooks.
  - approval: human approval gates.
  - delay: wait before next step.
  - document: extract or process documents (PDF, forms).
  - webhook: trigger when an external system calls in.
  - schedule: run on a schedule.
  - condition: branch logic (if/else).
  - transform: map or reshape data between steps.
- Use short step descriptions (e.g. "Send welcome email", "Add user to Slack", "Wait 24 hours", "If amount > 1000 require approval").
- Prefer 5–10 steps when the process allows. Include at least one of: approval, delay, condition, or transform. For onboarding or multi-system flows, include email + slack + http where relevant.
- If you need clarification, ask 1–2 brief questions in plain text. Do not output JSON in that case.
- Keep all responses concise.

If your model does not output reasoning in a separate channel, first output your reasoning in this exact format: THINKING:\\n...your reasoning...\\n\\nRESPONSE:\\n... and put your final answer (JSON or plain text) after RESPONSE:.`;

function getSystemPrompt(): string {
  let base = SYSTEM_BASE;
  const openApiServices = useOpenApiStore.getState().getServices();
  if (openApiServices.length > 0) {
    const apiList = openApiServices
      .map((s) => `${s.name}: ${s.operations.map((o) => o.name).join(", ")}`)
      .join("; ");
    base += `\n\nAvailable custom APIs: ${apiList}. Prefer suggestedService "http" and step descriptions that match these operations (e.g. "place order" -> Place order).`;
  }
  const examples = useExamplesStore.getState().getExamples();
  if (examples.length === 0) return base;
  const ex = examples[0];
  return `${base}

Example of a good decomposition:
User: "${ex.requirement.slice(0, 200)}..."
Steps (JSON): ${JSON.stringify(ex.steps)}`;
}

export interface RequirementAIResult {
  steps?: RequirementStep[];
  clarifications?: RequirementClarification[];
  message: string;
  /** For committing the assistant message: thinking block content */
  displayThinking?: string;
  /** For committing the assistant message: main reply content */
  displayContent?: string;
}

export interface RequirementStreamCallbacks {
  onThinkingFragment: (fragment: string) => void;
  onContentFragment: (fragment: string) => void;
}

function getModel(): { model: ReturnType<typeof providers[keyof typeof providers]["createModel"]> } | null {
  const providerNames = Object.keys(providers);
  for (const name of providerNames) {
    const key = useApiKeysStore.getState().getApiKey(name);
    if (key) {
      const provider = providers[name as keyof typeof providers];
      const modelId = provider.models.includes("gemini-2.5-flash")
        ? "gemini-2.5-flash"
        : provider.models[0];
      const model = provider.createModel(key, modelId, true);
      return { model };
    }
  }
  return null;
}

/** Parse final response: extract steps (and optional clarifications) from JSON or return message as-is */
function parseResponse(text: string): Omit<RequirementAIResult, "displayThinking" | "displayContent"> {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        steps?: { id?: string; description?: string; suggestedService?: string }[];
        clarifications?: { stepId?: string; question?: string; placeholder?: string }[];
      };
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const steps: RequirementStep[] = parsed.steps.map(
          (s, i) => ({
            id: String(s.id ?? i + 1),
            description: String(s.description ?? ""),
            suggestedService: s.suggestedService,
          })
        );
        const clarifications: RequirementClarification[] | undefined = Array.isArray(parsed.clarifications)
          ? parsed.clarifications
            .filter((c): c is { stepId: string; question: string; placeholder: string } =>
              typeof c?.stepId === "string" && typeof c?.question === "string" && typeof c?.placeholder === "string"
            )
            .map((c) => ({ stepId: c.stepId, question: c.question, placeholder: c.placeholder }))
          : undefined;
        return { steps, clarifications, message: trimmed };
      }
    } catch {
      // fall through
    }
  }
  return { message: trimmed };
}

/** Split response that uses THINKING:\n...\n\nRESPONSE:\n... format */
function splitThinkingResponse(full: string): { thinking: string; response: string } {
  const thinkingMatch = full.match(/THINKING:\s*\n([\s\S]*?)\n\s*\nRESPONSE:\s*\n([\s\S]*)/i);
  if (thinkingMatch) {
    return { thinking: thinkingMatch[1].trim(), response: thinkingMatch[2].trim() };
  }
  const tagMatch = full.match(/<thinking>([\s\S]*?)<\/thinking>\s*<response>([\s\S]*)<\/response>/i);
  if (tagMatch) {
    return { thinking: tagMatch[1].trim(), response: tagMatch[2].trim() };
  }
  return { thinking: "", response: full.trim() };
}

/**
 * Stream requirement-to-steps: calls onThinkingFragment and onContentFragment as the LLM streams.
 * Returns the final result (steps + message or message only). Caller should commit the final
 * assistant message with thinking + content via the store.
 */
export async function requirementToStepsStream(
  messages: { role: string; content: string }[],
  newUserMessage: string,
  callbacks: RequirementStreamCallbacks
): Promise<RequirementAIResult> {
  const modelInfo = getModel();
  if (!modelInfo) {
    return {
      message: "Add an API key (e.g. Google) in the sidebar to use the assistant.",
    };
  }

  const { model } = modelInfo;
  const fullMessages = [
    ...messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
    { role: "user" as const, content: newUserMessage },
  ];
  const userContent = fullMessages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

  let systemPrompt = getSystemPrompt();
  const slackContext = await getSlackContext();
  if (slackContext) systemPrompt += slackContext;

  let thinkingBuffer = "";
  let contentBuffer = "";

  const res = streamText({
    model,
    system: systemPrompt,
    prompt: userContent,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: -1,
          includeThoughts: true,
        },
        responseModalities: ["TEXT"],
      } satisfies GoogleGenerativeAIProviderOptions,
      anthropic: {
        thinking: { type: "enabled" },
      } satisfies AnthropicProviderOptions,
      xai: {
        reasoningEffort: "medium",
      },
    },
  });

  for await (const chunk of res.fullStream) {
    if (chunk.type === "reasoning") {
      thinkingBuffer += chunk.textDelta;
      callbacks.onThinkingFragment(chunk.textDelta);
    }
    if (chunk.type === "text-delta") {
      contentBuffer += chunk.textDelta;
      callbacks.onContentFragment(chunk.textDelta);
    }
  }

  let finalContent = contentBuffer.trim();
  let finalThinking = thinkingBuffer.trim();

  if (!finalThinking && finalContent) {
    const split = splitThinkingResponse(finalContent);
    if (split.thinking) {
      finalThinking = split.thinking;
      finalContent = split.response;
    }
  }

  const parsed = parseResponse(finalContent);
  return {
    ...parsed,
    displayThinking: finalThinking || undefined,
    displayContent: finalContent || parsed.message,
  };
}

/** Non-streaming entry for backwards compatibility; prefers streaming in the UI. */
export async function requirementToSteps(
  messages: { role: string; content: string }[],
  newUserMessage: string
): Promise<RequirementAIResult> {
  let thinking = "";
  let content = "";
  const result = await requirementToStepsStream(messages, newUserMessage, {
    onThinkingFragment: (f) => { thinking += f; },
    onContentFragment: (f) => { content += f; },
  });
  return result;
}
