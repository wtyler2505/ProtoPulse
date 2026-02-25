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
import { BomProvider, useBom } from '@/lib/contexts/bom-context';

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
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BomProvider seeded={seeded}>{children}</BomProvider>
      </QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BomContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Hook throws outside provider
  it('useBom throws when used outside BomProvider', () => {
    // Suppress React error boundary console noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useBom());
    }).toThrow('useBom must be used within BomProvider');

    spy.mockRestore();
  });

  // 2. Default bomSettings values
  it('provides default bomSettings values', () => {
    const { result } = renderHook(() => useBom(), { wrapper: createWrapper() });

    expect(result.current.bomSettings.maxCost).toBe(50);
    expect(result.current.bomSettings.batchSize).toBe(1000);
    expect(result.current.bomSettings.inStockOnly).toBe(true);
    expect(result.current.bomSettings.manufacturingDate).toBeInstanceOf(Date);
  });

  // 3. setBomSettings merges partial updates
  it('setBomSettings updates partial settings', () => {
    const { result } = renderHook(() => useBom(), { wrapper: createWrapper() });

    act(() => {
      result.current.setBomSettings({ maxCost: 200, inStockOnly: false });
    });

    expect(result.current.bomSettings.maxCost).toBe(200);
    expect(result.current.bomSettings.inStockOnly).toBe(false);
    // Unchanged fields keep their defaults
    expect(result.current.bomSettings.batchSize).toBe(1000);
  });

  // 4. addBomItem calls apiRequest with correct method, URL, and body
  it('addBomItem calls apiRequest with POST and the correct payload', async () => {
    const { result } = renderHook(() => useBom(), { wrapper: createWrapper() });

    const newItem = {
      partNumber: 'LM7805',
      manufacturer: 'Texas Instruments',
      description: '5V voltage regulator',
      quantity: 10,
      unitPrice: 0.55,
      totalPrice: 5.5,
      supplier: 'Digi-Key' as const,
      stock: 500,
      status: 'In Stock' as const,
    };

    act(() => {
      result.current.addBomItem(newItem);
    });

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/projects/1/bom',
        newItem,
      );
    });
  });

  // 5. deleteBomItem calls apiRequest with correct DELETE url
  it('deleteBomItem calls apiRequest with DELETE and the correct URL', async () => {
    const { result } = renderHook(() => useBom(), { wrapper: createWrapper() });

    act(() => {
      result.current.deleteBomItem(42);
    });

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'DELETE',
        '/api/bom/42?projectId=1',
      );
    });
  });

  // 6. updateBomItem calls apiRequest with correct PATCH url and body
  it('updateBomItem calls apiRequest with PATCH and the correct URL/body', async () => {
    const { result } = renderHook(() => useBom(), { wrapper: createWrapper() });

    const patchData = { quantity: 25, unitPrice: 1.1 };

    act(() => {
      result.current.updateBomItem(7, patchData);
    });

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        'PATCH',
        '/api/bom/7?projectId=1',
        patchData,
      );
    });
  });
});
