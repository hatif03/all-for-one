import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { providers } from './ai'

/** Default API keys (from env) used when the user has not set their own. */
const DEFAULT_API_KEYS: Record<string, string | undefined> = {
  Groq: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DEFAULT_GROQ_API_KEY : undefined,
  'Google Generative AI': typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DEFAULT_GEMINI_API_KEY : undefined,
}

function getDefaultApiKey(provider: string): string | undefined {
  const key = DEFAULT_API_KEYS[provider];
  return key && key.trim() ? key : undefined;
}

interface ApiKeysState {
  open: boolean
  apiKeys: Record<string, string> // map provider to api key
  setApiKey: (provider: string, apiKey: string) => void
  getApiKey: (provider: string) => string | undefined
  getApiKeyFromModelId: (modelId: string) => string | undefined
  removeApiKey: (provider: string) => void
  clearAllApiKeys: () => void
  setOpen: (open: boolean) => void
}

export const useApiKeysStore = create<ApiKeysState>()(
  persist(
    (set, get) => ({
      open: false,
      apiKeys: {},
      setOpen: (open: boolean) => set({ open }),
      setApiKey: (provider: string, apiKey: string) =>
        set((state) => ({
          apiKeys: {
            ...state.apiKeys,
            [provider]: apiKey,
          },
        })),
      getApiKey: (provider: string) => {
        const userKey = get().apiKeys[provider];
        if (userKey && userKey.trim()) return userKey;
        return getDefaultApiKey(provider);
      },
      getApiKeyFromModelId: (modelId: string) => {
        const provider = Object.keys(providers).find((provider) => providers[provider].models.includes(modelId));
        if (!provider) return undefined;
        const userKey = get().apiKeys[provider];
        if (userKey && userKey.trim()) return userKey;
        return getDefaultApiKey(provider);
      },
      removeApiKey: (provider: string) =>
        set((state) => {
          const { [provider]: _removed, ...rest } = state.apiKeys;
          return { apiKeys: rest };
        }),
      clearAllApiKeys: () => set({ apiKeys: {} }),
    }),
    {
      name: 'api-keys-storage',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
      }),
    }
  )
)