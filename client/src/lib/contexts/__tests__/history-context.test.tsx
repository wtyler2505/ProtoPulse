import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock use-toast (imported by queryClient.ts)
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// Mock apiRequest so no real HTTP calls are made
vi.mock('@/lib/queryClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/queryClient')>('@/lib/queryClient');
  return {
    ...actual,
    apiRequest: vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    ),
  };
});

// Import AFTER mocks are wired
import { apiRequest } from '@/lib/queryClient';
import { ProjectIdProvider } from '@/lib/contexts/project-id-context';
import { HistoryProvider, useHistory } from '@/lib/contexts/history-context';

const mockedApiRequest = vi.mocked(apiRequest);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        queryFn: async () => ({ data: [], total: 0 }),
      },
      mutations: { retry: false },
    },
  });
}

function createWrapper(seeded = true) {
  const queryClient = createTestQueryClient();
  const Wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ProjectIdProvider projectId={1}>
          <HistoryProvider seeded={seeded}>
            {children}
          </HistoryProvider>
        </ProjectIdProvider>
      </QueryClientProvider>
    );
  };
  return Wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HistoryContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides empty history initially', async () => {
    const { result } = renderHook(() => useHistory(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.history).toEqual([]);
    });
  });

  it('addToHistory calls apiRequest with correct payload', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const { result } = renderHook(() => useHistory(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.history).toEqual([]);
    });
    act(() => {
      result.current.addToHistory('Added resistor R1', 'User');
    });
    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/projects/1/history',
        { action: 'Added resistor R1', user: 'User' },
      );
    });
  });

  it('addToHistory with AI user', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const { result } = renderHook(() => useHistory(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.history).toEqual([]);
    });
    act(() => {
      result.current.addToHistory('Generated power supply', 'AI');
    });
    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/projects/1/history',
        { action: 'Generated power supply', user: 'AI' },
      );
    });
  });

  it('throws when useHistory is used outside HistoryProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useHistory());
    }).toThrow('useHistory must be used within HistoryProvider');
    spy.mockRestore();
  });

  it('does not fetch when seeded is false', async () => {
    const queryClient = createTestQueryClient();
    const fetchSpy = vi.fn();
    queryClient.setDefaultOptions({
      queries: {
        retry: false,
        gcTime: 0,
        queryFn: fetchSpy,
      },
    });

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ProjectIdProvider projectId={1}>
          <HistoryProvider seeded={false}>
            {children}
          </HistoryProvider>
        </ProjectIdProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useHistory(), { wrapper: Wrapper });
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.history).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('addToHistory is a function on every render', async () => {
    const { result, rerender } = renderHook(() => useHistory(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.history).toEqual([]);
    });
    expect(typeof result.current.addToHistory).toBe('function');
    rerender();
    expect(typeof result.current.addToHistory).toBe('function');
  });
});
