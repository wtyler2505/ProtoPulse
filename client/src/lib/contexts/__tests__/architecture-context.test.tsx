import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { Node, Edge } from '@xyflow/react';

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
import { ArchitectureProvider, useArchitecture } from '@/lib/contexts/architecture-context';

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
        // Provide a default queryFn that returns an empty array, mirroring the
        // real queryClient's getQueryFn but without hitting the network.
        queryFn: async () => [],
      },
      mutations: { retry: false },
    },
  });
}

function createWrapper(seeded = true) {
  const queryClient = createTestQueryClient();
  const setActiveView = vi.fn();
  const Wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ProjectIdProvider projectId={1}>
          <ArchitectureProvider seeded={seeded} setActiveView={setActiveView}>
            {children}
          </ArchitectureProvider>
        </ProjectIdProvider>
      </QueryClientProvider>
    );
  };
  return { Wrapper, queryClient };
}

/** Builds a minimal React Flow Node for testing. */
function makeNode(id: string, label = `Node ${id}`): Node {
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { label, type: 'microcontroller', description: '' },
  };
}

/** Builds a minimal React Flow Edge for testing. */
function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ArchitectureContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Hook throws outside provider
  it('useArchitecture throws when used outside ArchitectureProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useArchitecture());
    }).toThrow('useArchitecture must be used within ArchitectureProvider');

    spy.mockRestore();
  });

  // 2. Initial nodes and edges are empty arrays
  it('provides empty nodes and edges initially', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useArchitecture(), {
      wrapper: Wrapper,
    });

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
  });

  // 3. setNodes calls apiRequest with PUT to the nodes endpoint
  it('setNodes calls apiRequest with PUT to /api/projects/1/nodes', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useArchitecture(), {
      wrapper: Wrapper,
    });

    const testNodes: Node[] = [makeNode('n1', 'MCU'), makeNode('n2', 'Sensor')];

    act(() => {
      result.current.setNodes(testNodes);
    });

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'PUT',
        '/api/projects/1/nodes',
        expect.arrayContaining([
          expect.objectContaining({ nodeId: 'n1', label: 'MCU' }),
          expect.objectContaining({ nodeId: 'n2', label: 'Sensor' }),
        ]),
      );
    });
  });

  // 4. setEdges calls apiRequest with PUT to the edges endpoint
  it('setEdges calls apiRequest with PUT to /api/projects/1/edges', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useArchitecture(), {
      wrapper: Wrapper,
    });

    const testEdges: Edge[] = [makeEdge('e1', 'n1', 'n2')];

    act(() => {
      result.current.setEdges(testEdges);
    });

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'PUT',
        '/api/projects/1/edges',
        expect.arrayContaining([
          expect.objectContaining({ edgeId: 'e1', source: 'n1', target: 'n2' }),
        ]),
      );
    });
  });

  // 5. canUndo is false initially
  it('canUndo is false when no undo state has been pushed', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useArchitecture(), {
      wrapper: Wrapper,
    });

    expect(result.current.canUndo).toBe(false);
  });

  // 6. pushUndoState makes canUndo true
  it('pushUndoState makes canUndo true', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useArchitecture(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.pushUndoState();
    });

    expect(result.current.canUndo).toBe(true);
  });

  // 7. undo with empty stack is a no-op
  it('undo with empty stack is a no-op (canUndo stays false)', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useArchitecture(), {
      wrapper: Wrapper,
    });

    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.undo();
    });

    // canUndo should still be false, no apiRequest calls triggered
    expect(result.current.canUndo).toBe(false);
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  // 8. redo with empty stack is a no-op
  it('redo with empty stack is a no-op (canRedo stays false)', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useArchitecture(), {
      wrapper: Wrapper,
    });

    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.redo();
    });

    // canRedo should still be false, no apiRequest calls triggered
    expect(result.current.canRedo).toBe(false);
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  // 9. Non-default projectId flows through to API calls
  it('uses projectId from context for API calls (non-default project)', async () => {
    const queryClient = createTestQueryClient();
    const setActiveView = vi.fn();
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ProjectIdProvider projectId={42}>
          <ArchitectureProvider seeded setActiveView={setActiveView}>
            {children}
          </ArchitectureProvider>
        </ProjectIdProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useArchitecture(), { wrapper: Wrapper });
    act(() => { result.current.setNodes([makeNode('n1', 'MCU')]); });

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'PUT',
        '/api/projects/42/nodes',
        expect.any(Array),
      );
    });
  });

  // 10. setNodes updates the query cache optimistically (before mutation resolves)
  it('setNodes updates query cache before mutation completes', () => {
    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useArchitecture(), { wrapper: Wrapper });

    const testNodes: Node[] = [makeNode('n1', 'MCU')];

    act(() => {
      result.current.setNodes(testNodes);
    });

    // Cache is updated synchronously via setQueryData — this is the
    // optimistic update, visible before the mutation round-trip completes.
    const cached = queryClient.getQueryData(['/api/projects/1/nodes']);
    expect(cached).toEqual([
      expect.objectContaining({ nodeId: 'n1', label: 'MCU' }),
    ]);

    // The mutation function hasn't fired yet (it's async/scheduled),
    // proving the cache was updated independently of the server response.
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });
});
