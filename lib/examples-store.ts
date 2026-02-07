import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RequirementStep } from "./requirement-store";

export interface SavedExample {
  id: string;
  requirement: string;
  steps: RequirementStep[];
  savedAt: number;
}

const MAX_EXAMPLES = 5;

interface ExamplesState {
  examples: SavedExample[];
  addExample: (requirement: string, steps: RequirementStep[]) => void;
  getExamples: () => SavedExample[];
}

export const useExamplesStore = create<ExamplesState>()(
  persist(
    (set, get) => ({
      examples: [],
      addExample: (requirement: string, steps: RequirementStep[]) => {
        const id = `ex-${Date.now()}`;
        set((s) => ({
          examples: [
            { id, requirement, steps, savedAt: Date.now() },
            ...s.examples.slice(0, MAX_EXAMPLES - 1),
          ],
        }));
      },
      getExamples: () => get().examples,
    }),
    { name: "workflow-examples-storage", partialize: (s) => ({ examples: s.examples }) }
  )
);
