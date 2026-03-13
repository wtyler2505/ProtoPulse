import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth-context';

export type ApiKeyProvider = 'anthropic' | 'gemini';

/**
 * Sentinel value returned when the real API key is stored server-side.
 * The actual key never leaves the server — this placeholder tells the UI "a key exists".
 * Must be ASCII-safe (no Unicode >255) to avoid ByteString errors in HTTP headers.
 */
export const STORED_KEY_SENTINEL = '********';

/** localStorage keys used before server-side migration. */
const LOCAL_STORAGE_KEYS: Record<ApiKeyProvider, string> = {
  anthropic: 'protopulse-ai-api-key-anthropic',
  gemini: 'protopulse-ai-api-key-gemini',
};

/** Legacy single-key storage from before per-provider keys. */
const LEGACY_KEY = 'protopulse-ai-api-key';

interface UseApiKeysResult {
  /** Current API key for the active provider. Empty string if none stored. */
  apiKey: string;
  /** Update the API key for a provider. Stores server-side when authenticated, localStorage otherwise. */
  setApiKey: (provider: ApiKeyProvider, key: string) => void;
  /** Clear the API key for a provider from both server and localStorage. */
  clearApiKey: (provider: ApiKeyProvider) => void;
  /** Whether server-side key data is still loading. */
  isLoading: boolean;
  /** Providers that have stored keys on the server. */
  providers: string[];
}

/**
 * Reads an API key from localStorage for the given provider, handling the legacy
 * single-key migration (old 'protopulse-ai-api-key' to anthropic per-provider key).
 */
function readLocalKey(provider: ApiKeyProvider): string {
  try {
    // Migrate legacy single-key to anthropic if present
    const legacyKey = localStorage.getItem(LEGACY_KEY);
    if (legacyKey) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.anthropic, legacyKey);
      localStorage.removeItem(LEGACY_KEY);
    }
    return localStorage.getItem(LOCAL_STORAGE_KEYS[provider]) ?? '';
  } catch {
    return '';
  }
}

function writeLocalKey(provider: ApiKeyProvider, key: string): void {
  try {
    if (key) {
      localStorage.setItem(LOCAL_STORAGE_KEYS[provider], key);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEYS[provider]);
    }
  } catch {
    // localStorage may be unavailable (private browsing, storage full)
  }
}

function clearLocalKey(provider: ApiKeyProvider): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEYS[provider]);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * API key management hook with dual persistence:
 * - **Authenticated**: keys stored server-side (AES-256-GCM encrypted).
 *   On first authenticated load, any existing localStorage keys are migrated to the server.
 * - **Unauthenticated**: falls back to localStorage (current behavior).
 *
 * The hook tracks the current provider so consumers get the correct key for the active provider.
 */
export function useApiKeys(activeProvider: ApiKeyProvider): UseApiKeysResult {
  const { sessionId } = useAuth();
  const isAuthenticated = !!sessionId;
  const queryClient = useQueryClient();
  const migrationDoneRef = useRef(false);

  // Local state: always initialized from localStorage (instant, no flash)
  const [localKeys, setLocalKeys] = useState<Record<ApiKeyProvider, string>>(() => ({
    anthropic: readLocalKey('anthropic'),
    gemini: readLocalKey('gemini'),
  }));

  // Server query: only when authenticated
  const providersQuery = useQuery<string[]>({
    queryKey: ['/api/settings/api-keys'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/settings/api-keys');
      const data = (await res.json()) as { providers: string[] };
      return data.providers;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Server mutations
  const { mutate: storeOnServer } = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: ApiKeyProvider; apiKey: string }) => {
      await apiRequest('POST', '/api/settings/api-keys', { provider, apiKey });
    },
    onSuccess: (_data, variables) => {
      // Clear local editing state — server now has the key, revert to sentinel display
      setLocalKeys((prev) => ({ ...prev, [variables.provider]: '' }));
      void queryClient.invalidateQueries({ queryKey: ['/api/settings/api-keys'] });
    },
    // Suppress global error toast — localStorage is the fallback
    onError: () => {},
  });

  const { mutate: deleteOnServer } = useMutation({
    mutationFn: async (provider: ApiKeyProvider) => {
      await apiRequest('DELETE', `/api/settings/api-keys/${provider}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/settings/api-keys'] });
    },
    onError: () => {},
  });

  // Migration: on first authenticated load, push any existing localStorage keys to server,
  // then clear them from localStorage so they aren't exposed in the browser.
  useEffect(() => {
    if (!isAuthenticated || migrationDoneRef.current) { return; }
    if (!providersQuery.isFetched) { return; }

    migrationDoneRef.current = true;
    const serverProviders = new Set(providersQuery.data ?? []);

    const allProviders: ApiKeyProvider[] = ['anthropic', 'gemini'];
    for (const provider of allProviders) {
      const localKey = readLocalKey(provider);
      if (localKey && !serverProviders.has(provider)) {
        // Migrate to server
        storeOnServer({ provider, apiKey: localKey });
        clearLocalKey(provider);
      } else if (localKey && serverProviders.has(provider)) {
        // Server already has a key — just clear the local copy
        clearLocalKey(provider);
      }
    }

    // Clear local state after migration
    setLocalKeys({ anthropic: '', gemini: '' });
  }, [isAuthenticated, providersQuery.isFetched, providersQuery.data, storeOnServer]);

  const setApiKey = useCallback(
    (provider: ApiKeyProvider, key: string) => {
      // Always update local state immediately for responsive controlled input
      setLocalKeys((prev) => ({ ...prev, [provider]: key }));

      if (isAuthenticated) {
        if (key) {
          storeOnServer({ provider, apiKey: key });
        } else {
          deleteOnServer(provider);
        }
      } else {
        writeLocalKey(provider, key);
      }
    },
    [isAuthenticated, storeOnServer, deleteOnServer],
  );

  const clearApiKey = useCallback(
    (provider: ApiKeyProvider) => {
      if (isAuthenticated) {
        deleteOnServer(provider);
      }
      clearLocalKey(provider);
      setLocalKeys((prev) => ({ ...prev, [provider]: '' }));
    },
    [isAuthenticated, deleteOnServer],
  );

  // Determine the current API key value:
  // - Authenticated users: the key is server-side, so we just need to know if a provider has a stored key.
  //   The actual key text is never exposed to the client after migration — the server uses it directly.
  //   For the ChatPanel's "has key" check and the !aiApiKey guard, we return a sentinel value
  //   when the server has a key for this provider.
  // - Unauthenticated: return the localStorage value.
  let apiKey: string;
  if (isAuthenticated) {
    // While the user is actively editing (localKeys non-empty), show their typed value
    // so the controlled input stays responsive. After server save succeeds, localKeys
    // is cleared and we revert to the sentinel placeholder.
    if (localKeys[activeProvider]) {
      apiKey = localKeys[activeProvider];
    } else {
      const serverHasKey = (providersQuery.data ?? []).includes(activeProvider);
      // Return a non-empty sentinel so the "no key" guard in handleSend doesn't trigger.
      // The actual key is never sent to the client — the server reads it from encrypted storage.
      apiKey = serverHasKey ? STORED_KEY_SENTINEL : '';
    }
  } else {
    apiKey = localKeys[activeProvider];
  }

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    isLoading: isAuthenticated && providersQuery.isLoading,
    providers: providersQuery.data ?? [],
  };
}
