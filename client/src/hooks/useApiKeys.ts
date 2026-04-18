import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth-context';

export type ApiKeyProvider = 'gemini';

/**
 * Sentinel value returned when the real API key is stored server-side.
 * The actual key never leaves the server — this placeholder tells the UI "a key exists".
 * Must be ASCII-safe (no Unicode >255) to avoid ByteString errors in HTTP headers.
 */
export const STORED_KEY_SENTINEL = '********';

/**
 * sessionStorage keys for pre-auth scratch values (audit #60 — plaintext-at-rest XSS fix).
 *
 * Security model: API keys are sensitive secrets. Per OWASP ASVS v4 §8.3.4 guidance on
 * short-lived secrets, pre-auth scratch uses `sessionStorage` (tab-scoped) instead of
 * `localStorage` (origin-wide + indefinite) to bound XSS exfiltration blast radius.
 * Authenticated users have their key stored server-side encrypted (AES-256-GCM via
 * `storeApiKey`); the plaintext never lingers client-side after migration.
 */
const SESSION_STORAGE_KEYS: Record<ApiKeyProvider, string> = {
  gemini: 'protopulse-ai-api-key-gemini-scratch',
};

/**
 * Legacy localStorage keys scrubbed on every hook mount — audit #60 plaintext-at-rest fix.
 * - `protopulse-ai-api-key` : v1 single-provider key (pre per-provider keys)
 * - `protopulse-ai-api-key-gemini` : v2 per-provider localStorage key (pre audit #60)
 * Values are migrated (to server if authenticated, otherwise to sessionStorage) then removed.
 */
const LEGACY_LOCALSTORAGE_KEYS: Record<ApiKeyProvider, readonly string[]> = {
  gemini: ['protopulse-ai-api-key', 'protopulse-ai-api-key-gemini'],
};

interface UseApiKeysResult {
  /** Current API key for the active provider. Empty string if none stored. */
  apiKey: string;
  /** Local keys map */
  localKeys: Record<string, string>;
  /** Update the API key for a provider. Stores server-side when authenticated, localStorage otherwise. */
  updateLocalKey: (provider: ApiKeyProvider, key: string) => void;
  /** Clear the API key for a provider from both server and localStorage. */
  clearApiKey: (provider: ApiKeyProvider) => void;
  /** Whether server-side key data is still loading. */
  isLoading: boolean;
  /** Providers that have stored keys on the server. */
  providers: string[];
}

/**
 * Drains any legacy plaintext localStorage entries for this provider, returning the
 * most recent recovered value (if any). The entries are removed in all cases — they
 * must not survive beyond this call (audit #60).
 */
function drainLegacyLocalStorage(provider: ApiKeyProvider): string {
  let recovered = '';
  try {
    for (const legacyKey of LEGACY_LOCALSTORAGE_KEYS[provider]) {
      const v = localStorage.getItem(legacyKey);
      if (v) { recovered = v; }
      try { localStorage.removeItem(legacyKey); } catch { /* ignore */ }
    }
  } catch { /* localStorage unavailable — nothing to drain */ }
  return recovered;
}

/**
 * Reads the pre-auth scratch API key for the given provider from sessionStorage,
 * after first draining any legacy localStorage values into the scratch slot.
 */
function readScratchKey(provider: ApiKeyProvider): string {
  const legacyValue = drainLegacyLocalStorage(provider);
  try {
    if (legacyValue && !sessionStorage.getItem(SESSION_STORAGE_KEYS[provider])) {
      sessionStorage.setItem(SESSION_STORAGE_KEYS[provider], legacyValue);
    }
    return sessionStorage.getItem(SESSION_STORAGE_KEYS[provider]) ?? '';
  } catch {
    return legacyValue;
  }
}

function writeScratchKey(provider: ApiKeyProvider, key: string): void {
  try {
    if (key) {
      sessionStorage.setItem(SESSION_STORAGE_KEYS[provider], key);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEYS[provider]);
    }
  } catch {
    // sessionStorage may be unavailable (private browsing, storage full)
  }
}

function clearScratchKey(provider: ApiKeyProvider): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEYS[provider]);
  } catch {
    // Ignore sessionStorage errors
  }
}

export function useApiKeys(): UseApiKeysResult {
  const { sessionId } = useAuth();
  const isAuthenticated = !!sessionId;
  const queryClient = useQueryClient();
  const migrationDoneRef = useRef(false);
  const activeProvider: ApiKeyProvider = 'gemini';

  const [localKeys, setLocalKeys] = useState<Record<ApiKeyProvider, string>>(() => ({
    gemini: readScratchKey('gemini'),
  }));

  // Audit #60: scrub any legacy plaintext localStorage entries once per hook lifetime,
  // even for unauthenticated users. readScratchKey drained them into the initial state
  // above; this belt-and-suspenders call covers late-arriving writes and StrictMode.
  useEffect(() => {
    for (const provider of ['gemini'] as ApiKeyProvider[]) {
      drainLegacyLocalStorage(provider);
    }
  }, []);

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

  const { mutate: storeOnServer } = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: ApiKeyProvider; apiKey: string }) => {
      await apiRequest('POST', '/api/settings/api-keys', { provider, apiKey });
    },
    onSuccess: (_data, variables) => {
      setLocalKeys((prev) => ({ ...prev, [variables.provider]: '' }));
      void queryClient.invalidateQueries({ queryKey: ['/api/settings/api-keys'] });
    },
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

  useEffect(() => {
    if (!isAuthenticated || migrationDoneRef.current) { return; }
    if (!providersQuery.isFetched) { return; }

    migrationDoneRef.current = true;
    const serverProviders = new Set(providersQuery.data ?? []);

    const allProviders: ApiKeyProvider[] = ['gemini'];
    for (const provider of allProviders) {
      // readScratchKey drains legacy localStorage AND returns current sessionStorage scratch.
      const scratch = readScratchKey(provider);
      if (scratch && !serverProviders.has(provider)) {
        storeOnServer({ provider, apiKey: scratch });
        clearScratchKey(provider);
      } else if (scratch && serverProviders.has(provider)) {
        clearScratchKey(provider);
      }
    }

    setLocalKeys({ gemini: '' });
  }, [isAuthenticated, providersQuery.isFetched, providersQuery.data, storeOnServer]);

  const updateLocalKey = useCallback(
    (provider: ApiKeyProvider, key: string) => {
      setLocalKeys((prev) => ({ ...prev, [provider]: key }));

      if (isAuthenticated) {
        if (key) {
          storeOnServer({ provider, apiKey: key });
        } else {
          deleteOnServer(provider);
        }
      } else {
        writeScratchKey(provider, key);
      }
    },
    [isAuthenticated, storeOnServer, deleteOnServer],
  );

  const clearApiKey = useCallback(
    (provider: ApiKeyProvider) => {
      if (isAuthenticated) {
        deleteOnServer(provider);
      }
      clearScratchKey(provider);
      setLocalKeys((prev) => ({ ...prev, [provider]: '' }));
    },
    [isAuthenticated, deleteOnServer],
  );

  let apiKey: string;
  if (isAuthenticated) {
    if (localKeys[activeProvider]) {
      apiKey = localKeys[activeProvider];
    } else {
      apiKey = providersQuery.data?.includes(activeProvider) ? STORED_KEY_SENTINEL : '';
    }
  } else {
    apiKey = localKeys[activeProvider];
  }

  return {
    apiKey,
    localKeys,
    updateLocalKey,
    clearApiKey,
    isLoading: isAuthenticated ? providersQuery.isLoading : false,
    providers: providersQuery.data ?? [],
  };
}