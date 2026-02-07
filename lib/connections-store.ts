import { create } from "zustand";
import { persist } from "zustand/middleware";

const CONNECTION_KEYS = ["Gmail", "SendGrid", "Slack"] as const;

export type ConnectionKey = (typeof CONNECTION_KEYS)[number];

interface ConnectionsState {
  connections: Record<string, string>;
  setConnection: (key: string, value: string) => void;
  getConnection: (key: string) => string | undefined;
  removeConnection: (key: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set, get) => ({
      connections: {},
      open: false,
      setOpen: (open: boolean) => set({ open }),
      setConnection: (key: string, value: string) =>
        set((state) => ({
          connections: { ...state.connections, [key]: value },
        })),
      getConnection: (key: string) => get().connections[key],
      removeConnection: (key: string) =>
        set((state) => {
          const { [key]: _, ...rest } = state.connections;
          return { connections: rest };
        }),
    }),
    {
      name: "workflow-connections-storage",
      partialize: (s) => ({ connections: s.connections }),
      merge: (persisted, current) => ({
        ...current,
        ...(typeof persisted === "object" && persisted !== null ? persisted : {}),
        open: false,
      }),
    }
  )
);

export { CONNECTION_KEYS };
