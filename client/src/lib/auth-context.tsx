import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: number;
  username: string;
}

interface AuthContextValue {
  user: User | null;
  sessionId: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
AuthContext.displayName = 'AuthContext';

const SESSION_KEY = 'protopulse-session-id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  const [loading, setLoading] = useState(true);

  // Validate existing session on mount
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function validate() {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'X-Session-Id': sessionId! },
        });

        if (!cancelled) {
          if (res.ok) {
            const data = (await res.json()) as User;
            setUser(data);
          } else {
            // Session invalid — clear it
            localStorage.removeItem(SESSION_KEY);
            setSessionId(null);
            setUser(null);
          }
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(SESSION_KEY);
          setSessionId(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void validate();
    return () => { cancelled = true; };
  }, [sessionId]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiRequest('POST', '/api/auth/login', { username, password });
    const data = (await res.json()) as { sessionId: string; user: User };
    localStorage.setItem(SESSION_KEY, data.sessionId);
    setSessionId(data.sessionId);
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiRequest('POST', '/api/auth/register', { username, password });
    const data = (await res.json()) as { sessionId: string; user: User };
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
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setUser(null);
  }, [sessionId]);

  return (
    <AuthContext.Provider value={{ user, sessionId, loading, login, register, logout }}>
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
