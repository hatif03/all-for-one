import { create } from "zustand";

export interface RequirementMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RequirementStep {
  id: string;
  description: string;
  suggestedService?: string;
}

interface RequirementState {
  messages: RequirementMessage[];
  steps: RequirementStep[] | null;
  isLoading: boolean;
  addMessage: (msg: RequirementMessage) => void;
  setSteps: (steps: RequirementStep[] | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  messages: [],
  steps: null,
  isLoading: false,
};

export const useRequirementStore = create<RequirementState>()((set) => ({
  ...initialState,
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),
  setSteps: (steps) => set({ steps }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set(initialState),
}));
