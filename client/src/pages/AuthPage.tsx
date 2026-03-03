import { useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      // Strip HTTP status prefix (e.g. "401: Invalid credentials")
      setError(msg.replace(/^\d{3}:\s*/, ''));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Layers className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl tracking-tight">ProtoPulse</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1">System Architect</p>
          </div>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 bg-card/50 border border-border p-5">
            <h2 data-testid="auth-heading" className="text-sm font-medium text-foreground">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>

            <div className="space-y-1">
              <label htmlFor="auth-username" className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Username
              </label>
              <input
                id="auth-username"
                data-testid="input-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-sm bg-muted/30 border border-border/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Enter username"
                disabled={submitting}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="auth-password" className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <input
                id="auth-password"
                data-testid="input-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm bg-muted/30 border border-border/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Enter password"
                disabled={submitting}
              />
            </div>

            {mode === 'register' && (
              <div className="space-y-1">
                <label htmlFor="auth-confirm-password" className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  id="auth-confirm-password"
                  data-testid="input-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-sm bg-muted/30 border border-border/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="Confirm password"
                  disabled={submitting}
                />
              </div>
            )}

            {error && (
              <p data-testid="auth-error" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              data-testid="button-auth-submit"
              disabled={submitting}
              className="w-full text-sm bg-primary text-primary-foreground py-2 px-4 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              data-testid="button-auth-toggle"
              onClick={toggleMode}
              className="text-primary hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
