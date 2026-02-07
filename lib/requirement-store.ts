import { create } from "zustand";

export interface RequirementMessage {
  role: "user" | "assistant";
  content: string;
  /** Shown above content in a Thinking block when present */
  thinking?: string;
}

export interface RequirementStep {
  id: string;
  description: string;
  suggestedService?: string;
  /** One-sentence explanation of why this step is in the workflow */
  reason?: string;
  /** When set, the workflow generator will pre-fill this HTTP step with the given operation (from user's custom APIs). */
  catalogOperationId?: string;
}

/** Optional clarification for a step (e.g. "Who receives the email?") */
export interface RequirementClarification {
  stepId: string;
  question: string;
  placeholder: string;
  /** Which node field to fill (e.g. "subject", "body", "to", "delayHours", "channel") */
  targetField?: string;
}

export type ProgressCallback = (phase: string, detail?: string) => void;

interface RequirementState {
  messages: RequirementMessage[];
  steps: RequirementStep[] | null;
  clarifications: RequirementClarification[] | null;
  isLoading: boolean;
  /** Progress during "Generate workflow" (e.g. "Discovering operations", "Matching step 1: Send email") */
  progressMessage: string;
  /** Streaming: thinking so far */
  pendingThinking: string;
  /** Streaming: response content so far */
  pendingContent: string;
  addMessage: (msg: RequirementMessage) => void;
  setSteps: (steps: RequirementStep[] | null) => void;
  setClarifications: (clarifications: RequirementClarification[] | null) => void;
  setLoading: (loading: boolean) => void;
  setProgressMessage: (message: string) => void;
  appendPendingThinking: (fragment: string) => void;
  appendPendingContent: (fragment: string) => void;
  /** Commit current pending thinking/content as the latest assistant message and clear pending */
  commitPendingMessage: (thinking: string, content: string) => void;
  clearPending: () => void;
  reset: () => void;
}

const initialState = {
  messages: [] as RequirementMessage[],
  steps: null as RequirementStep[] | null,
  clarifications: null as RequirementClarification[] | null,
  isLoading: false,
  progressMessage: "",
  pendingThinking: "",
  pendingContent: "",
};

export const useRequirementStore = create<RequirementState>()((set) => ({
  ...initialState,
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),
  setSteps: (steps) => set({ steps }),
  setClarifications: (clarifications) => set({ clarifications }),
  setLoading: (isLoading) => set({ isLoading }),
  setProgressMessage: (progressMessage) => set({ progressMessage }),
  appendPendingThinking: (fragment) =>
    set((s) => ({ pendingThinking: s.pendingThinking + fragment })),
  appendPendingContent: (fragment) =>
    set((s) => ({ pendingContent: s.pendingContent + fragment })),
  commitPendingMessage: (thinking, content) =>
    set((s) => ({
      messages: [...s.messages, { role: "assistant", content, thinking: thinking || undefined }],
      pendingThinking: "",
      pendingContent: "",
    })),
  clearPending: () => set({ pendingThinking: "", pendingContent: "" }),
  reset: () => set(initialState),
}));
