import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createXai } from "@ai-sdk/xai";
import { createGroq } from "@ai-sdk/groq";
import { LanguageModelV1 } from "ai";

export const providers: Record<
  string,
  {
    models: string[];
    keyUrl: string;
    createModel: (apiKey: string, modelId: string, reasoning: boolean) => LanguageModelV1;
  }
> = {
  "Google Generative AI": {
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash-exp",
      "gemini-exp-1206",
      "gemma-3-27b-it",
    ],
    createModel(apiKey: string, modelId: string) {
      const google = createGoogleGenerativeAI({
        apiKey,
      });
      return google(modelId, {
        useSearchGrounding: true,
      });
    },
  },
  OpenAI: {
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      "o1",
      "o1-mini",
      "o3-mini",
      "o3",
      "o4-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-4.5-preview",
      "gpt-3.5-turbo",
      "chatgpt-4o-latest",
    ],
    createModel(apiKey, modelId, reasoning) {
      const openai = createOpenAI({
        apiKey,
        compatibility: "strict",
      });
      return openai(modelId, {
        reasoningEffort: reasoning ? "medium" : undefined,
      });
    },
  },
  Anthropic: {
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      "claude-4-opus-20250514",
      "claude-4-sonnet-20250514",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ],
    createModel(apiKey, modelId) {
      const anthropic = createAnthropic({
        apiKey,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      });
      return anthropic(modelId);
    },
  },
  xAI: {
    keyUrl: "https://console.x.ai/",
    models: [
      "grok-3",
      "grok-3-fast",
      "grok-3-mini",
      "grok-3-mini-fast",
      "grok-2-1212",
      "grok-2",
      "grok-beta",
    ],
    createModel(apiKey, modelId) {
      const xai = createXai({
        apiKey,
      });
      return xai(modelId);
    },
  },
  Groq: {
    keyUrl: "https://console.groq.com/keys",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "llama3-70b-8192",
      "llama3-8b-8192",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
      "qwen-2.5-32b",
      "qwen/qwen3-32b",
      "deepseek-r1-distill-llama-70b",
      "deepseek-r1-distill-qwen-32b",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ],
    createModel(apiKey, modelId) {
      const groq = createGroq({ apiKey });
      return groq(modelId);
    },
  },
};
