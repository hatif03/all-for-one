"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

export interface Dataset {
  id: string;
  name: string;
  raw: string;
  createdAt: string;
}

interface DatasetsState {
  datasets: Dataset[];
  addDataset: (name: string, raw: string) => string;
  removeDataset: (id: string) => void;
  getDataset: (id: string) => Dataset | null;
}

export const useDatasetsStore = create<DatasetsState>()(
  persist(
    (set, get) => ({
      datasets: [],
      addDataset(name, raw) {
        const id = nanoid();
        set((state) => ({
          datasets: state.datasets.concat({
            id,
            name,
            raw,
            createdAt: new Date().toISOString(),
          }),
        }));
        return id;
      },
      removeDataset(id) {
        set((state) => ({
          datasets: state.datasets.filter((d) => d.id !== id),
        }));
      },
      getDataset(id) {
        return get().datasets.find((d) => d.id === id) ?? null;
      },
    }),
    { name: "datasets-store", version: 1 }
  )
);
