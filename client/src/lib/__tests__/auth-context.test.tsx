import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth-context';
import type { ConnectionStatus } from '../auth-context';

// Mock queryClient
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  queryClient: { clear: vi.fn() },
}));

function TestConsumer() {
  const { user, loading, connectionStatus, sessionId } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.username : 'null'}</span>
      <span data-testid="connection">{connectionStatus}</span>
      <span data-testid="session">{sessionId ?? 'null'}</span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

describe('AuthProvider session resilience', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, writable: true, configurable: true });
  });

  it('sets user on successful validation', async () => {
    localStorage.setItem('protopulse-session-id', 'valid-session');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, username: 'alice' }), { status: 200 }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('alice');
    expect(screen.getByTestId('connection').textContent).toBe('connected');
  });

  it('clears session on HTTP 401', async () => {
    localStorage.setItem('protopulse-session-id', 'expired-session');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('session').textContent).toBe('null');
    expect(localStorage.getItem('protopulse-session-id')).toBeNull();
  });

  it('clears session on HTTP 403', async () => {
    localStorage.setItem('protopulse-session-id', 'forbidden-session');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('session').textContent).toBe('null');
  });

  it('does NOT clear session on network error (TypeError), retries, then marks reconnecting', async () => {
    localStorage.setItem('protopulse-session-id', 'network-blip-session');
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))  // initial
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))  // retry 1
      .mockRejectedValueOnce(new TypeError('Failed to fetch')); // retry 2

    renderWithProvider();

    // Advance past both retry delays (2s each) — use async variant to flush microtasks
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Session should be preserved — NOT cleared
    expect(screen.getByTestId('session').textContent).toBe('network-blip-session');
    expect(localStorage.getItem('protopulse-session-id')).toBe('network-blip-session');
    expect(screen.getByTestId('connection').textContent).toMatch(/reconnecting|offline/);
    // 1 initial + 2 retries = 3 calls
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('retries on network error and succeeds on retry', async () => {
    localStorage.setItem('protopulse-session-id', 'retry-session');
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))  // initial fails
      .mockResolvedValueOnce(                                     // retry 1 succeeds
        new Response(JSON.stringify({ id: 2, username: 'bob' }), { status: 200 }),
      );

    renderWithProvider();

    // Advance past the first retry delay — async variant flushes microtasks
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('bob');
    expect(screen.getByTestId('connection').textContent).toBe('connected');
  });

  it('retries on network error then clears on 401 during retry', async () => {
    localStorage.setItem('protopulse-session-id', 'retry-then-expired');
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    renderWithProvider();

    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('session').textContent).toBe('null');
  });

  it('keeps session but marks reconnecting on HTTP 500', async () => {
    localStorage.setItem('protopulse-session-id', 'server-error-session');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    // Session preserved — server errors are transient, not auth failures
    expect(screen.getByTestId('session').textContent).toBe('server-error-session');
    expect(screen.getByTestId('connection').textContent).toMatch(/reconnecting|offline/);
  });

  it('marks offline when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    localStorage.setItem('protopulse-session-id', 'offline-session');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    renderWithProvider();

    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('connection').textContent).toBe('offline');
    // Session preserved
    expect(screen.getByTestId('session').textContent).toBe('offline-session');
  });

  it('skips validation when no session exists', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('exposes connectionStatus in context', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    const status = screen.getByTestId('connection').textContent as ConnectionStatus;
    expect(['connected', 'reconnecting', 'offline']).toContain(status);
  });

  it('responds to offline event', async () => {
    localStorage.setItem('protopulse-session-id', 'event-session');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, username: 'alice' }), { status: 200 }),
    );

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('alice');
    });

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByTestId('connection').textContent).toBe('offline');
  });

  it('useAuth throws when used outside AuthProvider', () => {
    function Orphan() {
      useAuth();
      return null;
    }
    // Suppress React error boundary console noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Orphan />)).toThrow('useAuth must be used within AuthProvider');
    consoleSpy.mockRestore();
  });
});
