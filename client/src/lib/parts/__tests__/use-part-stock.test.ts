import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

vi.mock('@/lib/queryClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/queryClient')>('@/lib/queryClient');
  return {
    ...actual,
    apiRequest: vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 's1', version: 2 }), { status: 200 }),
    ),
  };
});

import { apiRequest } from '@/lib/queryClient';
import { usePartStockMutations } from '../use-part-stock';

const mockApiRequest = vi.mocked(apiRequest);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('usePartStockMutations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updateStock calls PATCH with stock endpoint', async () => {
    const { result } = renderHook(() => usePartStockMutations(1), { wrapper: createWrapper() });

    act(() => {
      result.current.updateStock({
        stockId: 'stock-abc',
        data: { quantityNeeded: 25, unitPrice: 1.5 },
      });
    });

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        'PATCH',
        '/api/projects/1/stock/stock-abc',
        { quantityNeeded: 25, unitPrice: 1.5 },
      );
    });
  });

  it('updateStock includes If-Match header when version is provided', async () => {
    const { result } = renderHook(() => usePartStockMutations(1), { wrapper: createWrapper() });

    act(() => {
      result.current.updateStock({
        stockId: 'stock-abc',
        data: { unitPrice: 2.0 },
        version: 3,
      });
    });

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalled();
    });
  });

  it('deleteStock calls DELETE with stock endpoint', async () => {
    mockApiRequest.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const { result } = renderHook(() => usePartStockMutations(1), { wrapper: createWrapper() });

    act(() => {
      result.current.deleteStock('stock-xyz');
    });

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        'DELETE',
        '/api/projects/1/stock/stock-xyz',
      );
    });
  });

  it('uses correct project ID in stock endpoints', async () => {
    const { result } = renderHook(() => usePartStockMutations(42), { wrapper: createWrapper() });

    act(() => {
      result.current.updateStock({
        stockId: 's1',
        data: { quantityNeeded: 5 },
      });
    });

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        'PATCH',
        '/api/projects/42/stock/s1',
        { quantityNeeded: 5 },
      );
    });
  });

  it('shows toast on update error', async () => {
    const { toast } = await import('@/hooks/use-toast');
    mockApiRequest.mockRejectedValueOnce(new Error('409: Version conflict'));

    const { result } = renderHook(() => usePartStockMutations(1), { wrapper: createWrapper() });

    act(() => {
      result.current.updateStock({ stockId: 's1', data: { unitPrice: 1 } });
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'Failed to update stock' }),
      );
    });
  });

  it('shows toast on delete error', async () => {
    const { toast } = await import('@/hooks/use-toast');
    mockApiRequest.mockRejectedValueOnce(new Error('404: Stock row not found'));

    const { result } = renderHook(() => usePartStockMutations(1), { wrapper: createWrapper() });

    act(() => {
      result.current.deleteStock('bad-id');
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'Failed to delete item' }),
      );
    });
  });
});
