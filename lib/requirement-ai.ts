import { generateText } from "ai";
import { providers } from "./ai";
import { useApiKeysStore } from "./api-key-store";
import { useConnectionsStore } from "./connections-store";
import { useDatasetsStore } from "./datasets-store";
import { useExamplesStore } from "./examples-store";
import { useOpenApiStore } from "./openapi-store";
import type { RequirementClarification, RequirementStep } from "./requirement-store";
import { formatProviderError } from "./utils";

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
4. **Decide:** Prefer decomposing into steps (JSON RESPONSE). Only ask 1–2 clarification questions in plain text when something is truly ambiguous and blocks the workflow; otherwise make reasonable assumptions and use placeholders (e.g. {{to}}, {{subject}}, #general) so the user can edit later.

**Scenario coverage (required):** For each workflow, explicitly consider and add steps where they matter:
- Happy path first.
- What happens if approval is rejected (e.g. notify requester, log, or branch to alternative). Add a step or condition for the rejection path and set its "reason" to mention it (e.g. "If approval rejected, notifies the requester").
- What if the list is empty or an API returns no data (e.g. condition to skip or notify). Include a condition or a step that handles empty results when the flow fetches or iterates over data.
- Retry or notify on API failure when the step is critical (e.g. delay then retry, or send failure notification). Add delay + retry or a failure-branch step where appropriate.
- Alternative branches: use condition steps for if/else (e.g. "If amount > 1000 require approval else auto-approve"). Set each step's "reason" so it's clear which scenario it covers.
Include condition, approval, or delay steps where these scenarios apply. Prefer generating steps with placeholders (e.g. subject: "Notification", channel: "#general", to: "{{to}}") rather than asking many questions; the user can change them in the workflow. Only ask 1–2 questions when a single critical input is missing and cannot be guessed (e.g. which API key to use).

**Output rules:**
- If the requirement is clear enough to break into steps, reply with ONLY a valid JSON object (no markdown, no extra text): {"steps":[{"id":"1","description":"...","suggestedService":"...","reason":"..."}, ...]}. For HTTP steps that call one of the user's custom APIs (from Available custom APIs), add "catalogOperationId": "<exact operation id>" so the endpoint is auto-filled without the user providing details. Include a short "reason" for each step.
- Add "clarifications" only when truly needed (at most 1–2). Prefer omitting clarifications and using sensible placeholders in the step descriptions so the user can click Generate workflow and then edit the nodes. If you do add clarifications, use "targetField" (e.g. "to", "subject", "body", "channel", "message").
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

const NODE_TYPES_CONTEXT = `
Available node types (suggestedService values and purpose):
- Triggers: manual (user starts), webhook (external call-in), schedule (cron).
- Actions: email (Gmail/SendGrid send/list/get), slack (post, invite, channels, reactions), http (call APIs), document (PDF/forms).
- Control: condition (if/else), approval (human gate), delay (wait).
- Data: transform (map/reshape data).
`;

function getSystemPrompt(): string {
  let base = SYSTEM_BASE + NODE_TYPES_CONTEXT;

  const connections = useConnectionsStore.getState();
  const connected: string[] = [];
  if (connections.getConnection("Gmail")) connected.push("Gmail");
  if (connections.getConnection("SendGrid")) connected.push("SendGrid");
  if (connections.getConnection("Slack")) connected.push("Slack");
  base += `\n\nConnected services: ${connected.length ? connected.join(", ") : "None"}. Only suggest email or Slack steps when the user has connected the corresponding service; otherwise say "Connect Gmail in the sidebar" (or the relevant service).`;

  const datasets = useDatasetsStore.getState().datasets;
  if (datasets.length > 0) {
    const names = datasets.map((d) => d.name).join(", ");
    base += `\n\nAvailable datasets (for list inputs): ${names}. You can suggest steps that use a dataset by name (e.g. "use the Contacts dataset").`;
  }

  const openApiServices = useOpenApiStore.getState().getServices();
  if (openApiServices.length > 0) {
    const lines = openApiServices.flatMap((s) =>
      s.operations.map((o) => {
        const paramKeys = o.params.map((p) => p.key).join(" ");
        return `id=${o.id} | ${s.name} | ${o.method} ${o.urlTemplate} | ${o.name}${paramKeys ? ` | params: ${paramKeys}` : ""}`;
      })
    );
    base += `\n\nAvailable custom APIs (user's backend endpoints; use these to auto-fill HTTP steps so the user need not specify endpoints):\n${lines.join("\n")}\n
For HTTP steps that clearly match one operation above, include "catalogOperationId": "<id>" in that step (use the exact id= value). This lets the workflow generator pre-fill the endpoint and parameters. Only suggest steps that use these APIs when they fit; the user does not need to give further endpoint details.`;
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

/** Use only flash (non-pro) models for reliability; prefer Gemini 2.5 Flash for Google. */
const GOOGLE_FLASH_MODEL = "gemini-2.5-flash";

function getModel(): { model: ReturnType<typeof providers[keyof typeof providers]["createModel"]> } | null {
  const providerNames = Object.keys(providers);
  for (const name of providerNames) {
    const key = useApiKeysStore.getState().getApiKey(name);
    if (key) {
      const provider = providers[name as keyof typeof providers];
      const modelId =
        name === "Google Generative AI"
          ? (provider.models.includes(GOOGLE_FLASH_MODEL) ? GOOGLE_FLASH_MODEL : provider.models[0])
          : provider.models[0];
      const model = provider.createModel(key, modelId, false);
      return { model };
    }
  }
  return null;
}

/** Strip markdown code fences so we can parse JSON that was wrapped in ```json ... ``` */
function stripCodeFences(text: string): string {
  let s = text.trim();
  const open = s.match(/^```(?:json)?\s*\n?/i);
  if (open) s = s.slice(open[0].length);
  const close = s.match(/\n?```\s*$/);
  if (close) s = s.slice(0, -close[0].length);
  return s.trim();
}

/** Parse final response: extract steps (and optional clarifications) from JSON or return message as-is */
function parseResponse(text: string): Omit<RequirementAIResult, "displayThinking" | "displayContent"> {
  const trimmed = text.trim();
  const stripped = stripCodeFences(trimmed);
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        steps?: { id?: string; description?: string; suggestedService?: string; reason?: string; catalogOperationId?: string }[];
        clarifications?: { stepId?: string; question?: string; placeholder?: string; targetField?: string }[];
      };
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const steps: RequirementStep[] = parsed.steps.map(
          (s, i) => ({
            id: String(s.id ?? i + 1),
            description: String(s.description ?? ""),
            suggestedService: s.suggestedService,
            reason: typeof s.reason === "string" ? s.reason : undefined,
            catalogOperationId: typeof s.catalogOperationId === "string" && s.catalogOperationId.trim() ? s.catalogOperationId.trim() : undefined,
          })
        );
        const clarifications: RequirementClarification[] | undefined = Array.isArray(parsed.clarifications)
          ? parsed.clarifications
            .filter((c): c is { stepId: string; question: string; placeholder: string; targetField?: string } =>
              typeof c?.stepId === "string" && typeof c?.question === "string" && typeof c?.placeholder === "string"
            )
            .map((c) => ({ stepId: c.stepId, question: c.question, placeholder: c.placeholder, targetField: c.targetField }))
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
 * Non-streaming: calls the model once and returns steps or message. Chat shows "Getting response…" until done.
 */
export async function requirementToStepsStream(
  messages: { role: string; content: string }[],
  newUserMessage: string,
  _callbacks: RequirementStreamCallbacks
): Promise<RequirementAIResult> {
  const modelInfo = getModel();
  if (!modelInfo) {
    const noKeyMessage = "Add an API key (e.g. Google) in the sidebar to use the assistant.";
    return {
      message: noKeyMessage,
      displayContent: noKeyMessage,
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

  let res: { text: string; reasoning?: string };
  try {
    const out = await generateText({
      model,
      system: systemPrompt,
      prompt: userContent,
    });
    res = { text: out.text, reasoning: out.reasoning };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const displayContent = formatProviderError(errMsg);
    return {
      message: errMsg,
      displayContent,
    };
  }

  let finalContent = (res.text || "").trim();
  let finalThinking = (res.reasoning || "").trim();
  if (!finalThinking && finalContent) {
    const split = splitThinkingResponse(finalContent);
    if (split.thinking) {
      finalThinking = split.thinking;
      finalContent = split.response;
    }
  }

  const parsed = parseResponse(finalContent);
  const displayContent =
    finalContent ||
    parsed.message ||
    "The model returned no response. Try again or check your API key.";
  return {
    ...parsed,
    displayThinking: finalThinking || undefined,
    displayContent,
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
