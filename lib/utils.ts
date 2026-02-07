import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Turn provider API errors (quota, rate limit, billing) into a clear message with links. */
export function formatProviderError(errMsg: string): string {
  const lower = errMsg.toLowerCase()
  if (lower.includes("quota") || lower.includes("rate limit") || lower.includes("rate-limit")) {
    if (lower.includes("google") || lower.includes("gemini") || lower.includes("ai.google.dev")) {
      return `Google Gemini quota exceeded. Your free tier or plan limit has been reached.\n\n• Check usage and limits: https://ai.google.dev/gemini-api/docs/rate-limits\n• Usage dashboard: https://aistudio.google.com/\n\nYou can wait for your quota to reset, upgrade billing in Google AI Studio, or use another provider (OpenAI, Anthropic, xAI, Groq) in Settings if you have an API key.`
    }
    return `Rate limit or quota exceeded: ${errMsg}\n\nCheck your provider's usage/billing page or try again later.`
  }
  if (lower.includes("billing") || lower.includes("payment")) {
    return `${errMsg}\n\nCheck your provider's billing/plan page and add payment method if required.`
  }
  return `Request failed: ${errMsg}. Check your API key and model.`
}
