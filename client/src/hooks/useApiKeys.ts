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

/** localStorage keys used before server-side migration. */
const LOCAL_STORAGE_KEYS: Record<ApiKeyProvider, string> = {
  gemini: 'protopulse-ai-api-key-gemini',
};

/** Legacy single-key storage from before per-provider keys. */
const LEGACY_KEY = 'protopulse-ai-api-key';

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
 * Reads an API key from localStorage for the given provider, handling the legacy
 * single-key migration.
 */
function readLocalKey(provider: ApiKeyProvider): string {
  try {
    const legacyKey = localStorage.getItem(LEGACY_KEY);
    if (legacyKey) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.gemini, legacyKey);
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

export function useApiKeys(): UseApiKeysResult {
  const { sessionId } = useAuth();
  const isAuthenticated = !!sessionId;
  const queryClient = useQueryClient();
  const migrationDoneRef = useRef(false);
  const activeProvider: ApiKeyProvider = 'gemini';

  const [localKeys, setLocalKeys] = useState<Record<ApiKeyProvider, string>>(() => ({
    gemini: readLocalKey('gemini'),
  }));

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
      const localKey = readLocalKey(provider);
      if (localKey && !serverProviders.has(provider)) {
        storeOnServer({ provider, apiKey: localKey });
        clearLocalKey(provider);
      } else if (localKey && serverProviders.has(provider)) {
        clearLocalKey(provider);
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