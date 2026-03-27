import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface User {
  id: number;
  username: string;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

interface AuthContextValue {
  user: User | null;
  sessionId: string | null;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
AuthContext.displayName = 'AuthContext';

const SESSION_KEY = 'protopulse-session-id';

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 2;

/** Returns true if the error is a network/connectivity failure (not an HTTP response). */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || !navigator.onLine;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    navigator.onLine ? 'connected' : 'offline',
  );
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Validate existing session on mount
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    function clearSession() {
      queryClient.clear();
      localStorage.removeItem(SESSION_KEY);
      setSessionId(null);
      setUser(null);
    }

    async function attemptValidate(): Promise<{ ok: boolean; networkError: boolean; status?: number }> {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'X-Session-Id': sessionId! },
        });
        if (res.ok) {
          const data = (await res.json()) as User;
          if (!cancelled) {
            setUser(data);
            setConnectionStatus('connected');
          }
          return { ok: true, networkError: false };
        }
        return { ok: false, networkError: false, status: res.status };
      } catch (error: unknown) {
        if (isNetworkError(error)) {
          return { ok: false, networkError: true };
        }
        // Unknown error — treat as network error to be safe (don't clear session)
        return { ok: false, networkError: true };
      }
    }

    async function validate() {
      const result = await attemptValidate();

      if (cancelled) { return; }

      if (result.ok) {
        setLoading(false);
        return;
      }

      // HTTP 401/403 — session truly expired/invalid
      if (!result.networkError && (result.status === 401 || result.status === 403)) {
        clearSession();
        setConnectionStatus('connected');
        setLoading(false);
        return;
      }

      // Network error — retry up to MAX_RETRIES times
      if (result.networkError) {
        setConnectionStatus(navigator.onLine ? 'reconnecting' : 'offline');

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (cancelled) { return; }
          await new Promise<void>((resolve) => {
            retryTimerRef.current = setTimeout(resolve, RETRY_DELAY_MS);
          });
          if (cancelled) { return; }

          const retry = await attemptValidate();
          if (cancelled) { return; }

          if (retry.ok) {
            setLoading(false);
            return;
          }
          if (!retry.networkError && (retry.status === 401 || retry.status === 403)) {
            clearSession();
            setConnectionStatus('connected');
            setLoading(false);
            return;
          }
        }

        // All retries exhausted — keep session, mark offline, stop loading
        if (!cancelled) {
          setConnectionStatus(navigator.onLine ? 'reconnecting' : 'offline');
          setLoading(false);
        }
        return;
      }

      // Other HTTP error (e.g. 500) — keep session but mark offline
      setConnectionStatus(navigator.onLine ? 'reconnecting' : 'offline');
      setLoading(false);
    }

    void validate();
    return () => {
      cancelled = true;
      clearTimeout(retryTimerRef.current);
    };
  }, [sessionId]);

  // Listen for online/offline events to auto-retry validation
  useEffect(() => {
    function handleOnline() {
      setConnectionStatus('reconnecting');
      // Trigger re-validation by re-reading the session (will re-run the validate effect
      // only if sessionId reference changes — so we force it via a state update)
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored && user === null && !loading) {
        // Re-trigger validation by setting sessionId to a new string ref
        setSessionId(stored);
        setLoading(true);
      } else if (stored && user !== null) {
        // Already have user — just re-check quietly
        void fetch('/api/auth/me', { headers: { 'X-Session-Id': stored } })
          .then((res) => {
            if (res.ok) {
              setConnectionStatus('connected');
            } else if (res.status === 401 || res.status === 403) {
              queryClient.clear();
              localStorage.removeItem(SESSION_KEY);
              setSessionId(null);
              setUser(null);
              setConnectionStatus('connected');
            }
          })
          .catch(() => {
            setConnectionStatus('reconnecting');
          });
      }
    }

    function handleOffline() {
      setConnectionStatus('offline');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, loading]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiRequest('POST', '/api/auth/login', { username, password });
    const data = (await res.json()) as { sessionId: string; user: User };
    queryClient.clear();
    localStorage.setItem(SESSION_KEY, data.sessionId);
    setSessionId(data.sessionId);
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiRequest('POST', '/api/auth/register', { username, password });
    const data = (await res.json()) as { sessionId: string; user: User };
    queryClient.clear();
    localStorage.setItem(SESSION_KEY, data.sessionId);
    setSessionId(data.sessionId);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'X-Session-Id': sessionId },
        });
      } catch {
        // Logout best-effort — clear local state regardless
      }
    }
    queryClient.clear();
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setUser(null);
  }, [sessionId]);

  return (
    <AuthContext.Provider value={{ user, sessionId, loading, connectionStatus, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
