import { generateText } from "ai";
import { providers } from "./ai";
import { useApiKeysStore } from "./api-key-store";
import type { RequirementStep } from "./requirement-store";

const SYSTEM_PROMPT = `You are a workflow assistant. The user describes a business process they want to automate.

Rules:
1. If the requirement is clear enough to break into steps, reply with ONLY a valid JSON object (no markdown, no extra text): {"steps":[{"id":"1","description":"...","suggestedService":"..."}, ...]}.
2. Use short step descriptions (e.g. "Send welcome email", "Add user to Slack").
3. suggestedService is optional: use "email", "slack", "http", "approval", "delay" when obvious.
4. If you need clarification (e.g. which email provider, which systems), ask 1-2 brief questions in plain text. Do not output JSON in that case.
5. Keep all responses concise.`;

export interface RequirementAIResult {
  steps?: RequirementStep[];
  message: string;
}

function getModel() {
  const providerNames = Object.keys(providers);
  for (const name of providerNames) {
    const key = useApiKeysStore.getState().getApiKey(name);
    if (key) {
      const provider = providers[name];
      const modelId = provider.models.includes("gemini-2.5-flash")
        ? "gemini-2.5-flash"
        : provider.models[0];
      return provider.createModel(key, modelId, false);
    }
  }
  return null;
}

export async function requirementToSteps(
  messages: { role: string; content: string }[],
  newUserMessage: string
): Promise<RequirementAIResult> {
  const model = getModel();
  if (!model) {
    return {
      message: "Add an API key (e.g. Google) in the sidebar to use the assistant.",
    };
  }

  const fullMessages = [
    ...messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
    { role: "user" as const, content: newUserMessage },
  ];
  const userContent = fullMessages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

  const { text } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: userContent,
  });

  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const steps: RequirementStep[] = parsed.steps.map(
          (s: { id?: string; description?: string; suggestedService?: string }, i: number) => ({
            id: String(s.id ?? i + 1),
            description: String(s.description ?? ""),
            suggestedService: s.suggestedService,
          })
        );
        return { steps, message: trimmed };
      }
    } catch {
      // fall through to return as message
    }
  }
  return { message: trimmed };
}
