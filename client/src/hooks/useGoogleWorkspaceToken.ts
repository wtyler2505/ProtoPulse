import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth-context';
import { STORED_KEY_SENTINEL } from '@/hooks/useApiKeys';

/**
 * Google Workspace OAuth token management.
 *
 * Security model (audit finding #60 — XSS token exfiltration):
 *   - **Authenticated users:** token is stored server-side in `api_keys` with AES-256-GCM
 *     encryption (via `storeApiKey`). The server lists the provider but NEVER echoes the
 *     decrypted token back to the client. After a successful save, the UI shows
 *     {@link STORED_KEY_SENTINEL} (`'********'`) to indicate "token present".
 *   - **Pre-auth scratch (user pastes token before logging in):** stored in
 *     `sessionStorage`, **not** `localStorage`. Per OWASP ASVS v4 §8.3.4 guidance on
 *     short-lived secrets, sessionStorage bounds exposure to the current tab lifetime.
 *     On login the scratch value migrates to the server and the sessionStorage entry
 *     is cleared.
 *
 * This hook intentionally does NOT reuse {@link useApiKeys}: that hook uses
 * `localStorage` for its pre-auth scratch (consistent with the Gemini API key), which
 * is acceptable for a developer-pasted API key the user owns but not for an OAuth
 * access/refresh token that grants delegated access to a third party (Google Workspace).
 *
 * The OAuth token is NEVER sent in AI streaming request bodies — the server resolves
 * it from the caller's encrypted `api_keys` row inside `/api/chat/ai/stream`
 * (see `server/routes/chat.ts`).
 */

const PROVIDER = 'google_workspace' as const;
const SESSION_STORAGE_KEY = 'protopulse-google-workspace-token-scratch';
/** Legacy localStorage key scrubbed on every load — audit #60 plaintext-at-rest fix. */
const LEGACY_LOCALSTORAGE_KEY = 'protopulse-google-workspace-token';

function readScratch(): string {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeScratch(v: string): void {
  try {
    if (v) sessionStorage.setItem(SESSION_STORAGE_KEY, v);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // sessionStorage may be unavailable — silently ignore
  }
}

function scrubLegacyPlaintext(): void {
  try { localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY); } catch { /* ignore */ }
}

export interface UseGoogleWorkspaceTokenResult {
  /**
   * Display value for the token input. Empty string if none stored.
   * When a server-stored token exists and no fresh scratch value is present,
   * this is {@link STORED_KEY_SENTINEL}.
   */
  token: string;
  /** True once the server providers list has loaded (or user is unauthenticated). */
  isLoading: boolean;
  /** True if the server reports a stored `google_workspace` token for the current user. */
  hasServerToken: boolean;
  /**
   * Save or clear the Google Workspace token.
   *
   * - Authenticated + non-empty value: POSTs to `/api/settings/api-keys` (encrypted server-side).
   * - Authenticated + empty value: DELETEs the server record.
   * - Unauthenticated: writes to sessionStorage (migrates to server on next login).
   *
   * Passing the sentinel is a no-op (UI re-rendered with unchanged stored key).
   */
  setToken: (value: string) => void;
  /** Explicit clear: deletes both the server record and any scratch value. */
  clearToken: () => void;
}

export function useGoogleWorkspaceToken(): UseGoogleWorkspaceTokenResult {
  const { sessionId } = useAuth();
  const isAuthenticated = !!sessionId;
  const queryClient = useQueryClient();
  const migrationDoneRef = useRef(false);

  // Scrub any legacy plaintext token once per hook lifetime.
  useEffect(() => { scrubLegacyPlaintext(); }, []);

  const [scratch, setScratch] = useState<string>(() => readScratch());

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

  const hasServerToken = (providersQuery.data ?? []).includes(PROVIDER);

  const { mutate: storeOnServer } = useMutation({
    mutationFn: async (apiKey: string) => {
      await apiRequest('POST', '/api/settings/api-keys', { provider: PROVIDER, apiKey });
    },
    onSuccess: () => {
      setScratch('');
      writeScratch('');
      void queryClient.invalidateQueries({ queryKey: ['/api/settings/api-keys'] });
    },
    onError: () => {},
  });

  const { mutate: deleteOnServer } = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/settings/api-keys/${PROVIDER}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/settings/api-keys'] });
    },
    onError: () => {},
  });

  // Migrate pre-auth scratch value to server after login.
  useEffect(() => {
    if (!isAuthenticated || migrationDoneRef.current) return;
    if (!providersQuery.isFetched) return;

    migrationDoneRef.current = true;
    const currentScratch = readScratch();
    if (currentScratch && !hasServerToken) {
      storeOnServer(currentScratch);
    } else if (currentScratch && hasServerToken) {
      // Server already has one — discard the scratch to avoid lingering plaintext.
      setScratch('');
      writeScratch('');
    }
  }, [isAuthenticated, providersQuery.isFetched, hasServerToken, storeOnServer]);

  const setToken = useCallback((value: string) => {
    // Sentinel from the UI means "don't touch the stored key" — no-op.
    if (value === STORED_KEY_SENTINEL) return;

    if (isAuthenticated) {
      if (value) {
        storeOnServer(value);
      } else {
        deleteOnServer();
      }
    } else {
      setScratch(value);
      writeScratch(value);
    }
  }, [isAuthenticated, storeOnServer, deleteOnServer]);

  const clearToken = useCallback(() => {
    if (isAuthenticated) {
      deleteOnServer();
    }
    setScratch('');
    writeScratch('');
  }, [isAuthenticated, deleteOnServer]);

  let token: string;
  if (isAuthenticated) {
    if (scratch) {
      token = scratch;
    } else {
      token = hasServerToken ? STORED_KEY_SENTINEL : '';
    }
  } else {
    token = scratch;
  }

  return {
    token,
    isLoading: isAuthenticated ? providersQuery.isLoading : false,
    hasServerToken,
    setToken,
    clearToken,
  };
}
