"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CatalogService } from "./api-catalog";

interface OpenApiState {
  services: CatalogService[];
  addService: (service: CatalogService) => void;
  removeService: (id: string) => void;
  getServices: () => CatalogService[];
}

export const useOpenApiStore = create<OpenApiState>()(
  persist(
    (set, get) => ({
      services: [],
      addService(service) {
        set((state) => ({
          services: state.services.filter((s) => s.id !== service.id).concat(service),
        }));
      },
      removeService(id) {
        set((state) => ({
          services: state.services.filter((s) => s.id !== id),
        }));
      },
      getServices() {
        return get().services;
      },
    }),
    { name: "openapi-catalog", version: 1 }
  )
);
