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
import { ChatProvider, useChat } from '@/lib/contexts/chat-context';

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
          <ChatProvider seeded={seeded}>
            {children}
          </ChatProvider>
        </ProjectIdProvider>
      </QueryClientProvider>
    );
  };
  return Wrapper;
}

function createWrapperWithQueryClient(queryClient: QueryClient, seeded = true) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ProjectIdProvider projectId={1}>
          <ChatProvider seeded={seeded}>
            {children}
          </ChatProvider>
        </ProjectIdProvider>
      </QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides empty messages initially', async () => {
    const { result } = renderHook(() => useChat(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });
  });

  it('provides isGenerating = false initially', async () => {
    const { result } = renderHook(() => useChat(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it('setIsGenerating updates the state', async () => {
    const { result } = renderHook(() => useChat(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });
    act(() => {
      result.current.setIsGenerating(true);
    });
    expect(result.current.isGenerating).toBe(true);
  });

  it('addMessage with string calls apiRequest with role=user', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const { result } = renderHook(() => useChat(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });
    act(() => {
      result.current.addMessage('Hello world');
    });
    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/projects/1/chat',
        { role: 'user', content: 'Hello world', branchId: null },
      );
    });
  });

  it('addMessage with ChatMessage object calls apiRequest with role and content', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const { result } = renderHook(() => useChat(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });
    act(() => {
      result.current.addMessage({
        id: 'msg-1',
        role: 'assistant',
        content: 'AI response',
        timestamp: Date.now(),
        mode: 'chat',
      });
    });
    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/projects/1/chat',
        { role: 'assistant', content: 'AI response', mode: 'chat', branchId: null },
      );
    });
  });

  it('serializes clientId metadata when adding a ChatMessage object', async () => {
    mockedApiRequest.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const { result } = renderHook(() => useChat(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });

    act(() => {
      result.current.addMessage({
        id: 'msg-2',
        clientId: 'client-123',
        role: 'assistant',
        content: 'Review this change',
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/projects/1/chat',
        {
          role: 'assistant',
          content: 'Review this change',
          branchId: null,
          metadata: JSON.stringify({ clientId: 'client-123' }),
        },
      );
    });
  });

  it('hydrates clientId from stored chat metadata', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          queryFn: async () => ({
            data: [
              {
                id: 7,
                role: 'assistant',
                content: 'Persisted response',
                timestamp: new Date('2026-03-31T18:35:00.000Z').toISOString(),
                metadata: JSON.stringify({ clientId: 'client-789' }),
              },
            ],
            total: 1,
          }),
        },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useChat(), {
      wrapper: createWrapperWithQueryClient(queryClient),
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]?.id).toBe('7');
      expect(result.current.messages[0]?.clientId).toBe('client-789');
    });
  });

  it('throws when useChat is used outside ChatProvider', () => {
    // Suppress React error boundary noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useChat());
    }).toThrow('useChat must be used within ChatProvider');
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
          <ChatProvider seeded={false}>
            {children}
          </ChatProvider>
        </ProjectIdProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useChat(), { wrapper: Wrapper });
    // Give time for potential fetch
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.messages).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
