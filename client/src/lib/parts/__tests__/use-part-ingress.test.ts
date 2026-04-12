import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

const INGRESS_RESPONSE = { partId: 'p1', slug: 'res-10k', created: true, reused: false, stockId: 's1', placementId: null };

vi.mock('@/lib/queryClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/queryClient')>('@/lib/queryClient');
  return {
    ...actual,
    apiRequest: vi.fn().mockImplementation(
      () => Promise.resolve(new Response(JSON.stringify(INGRESS_RESPONSE), { status: 201 })),
    ),
  };
});

import { apiRequest } from '@/lib/queryClient';
import { usePartIngress } from '../use-part-ingress';

const mockApiRequest = vi.mocked(apiRequest);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('usePartIngress', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls POST /api/parts/ingress with payload', async () => {
    const { result } = renderHook(() => usePartIngress(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.ingest({
        source: 'manual',
        origin: 'user',
        projectId: 1,
        fields: {
          title: 'Test Resistor',
          canonicalCategory: 'resistor',
          manufacturer: 'Yageo',
          mpn: 'RC0402',
        },
        stock: { quantityNeeded: 10, unitPrice: 0.01 },
      });
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      'POST',
      '/api/parts/ingress',
      expect.objectContaining({
        source: 'manual',
        origin: 'user',
        projectId: 1,
        fields: expect.objectContaining({ title: 'Test Resistor', canonicalCategory: 'resistor' }),
      }),
    );
  });

  it('returns IngressResult with partId and slug', async () => {
    const { result } = renderHook(() => usePartIngress(), { wrapper: createWrapper() });

    let ingressResult: Awaited<ReturnType<typeof result.current.ingest>> | undefined;
    await act(async () => {
      ingressResult = await result.current.ingest({
        source: 'bom_create',
        origin: 'user',
        fields: { title: 'Cap', canonicalCategory: 'capacitor' },
      });
    });

    expect(ingressResult).toEqual({
      partId: 'p1',
      slug: 'res-10k',
      created: true,
      reused: false,
      stockId: 's1',
      placementId: null,
    });
  });

  it('reports isPending during ingress', async () => {
    let resolveRequest: (() => void) | undefined;
    mockApiRequest.mockImplementationOnce(
      () => new Promise<Response>((resolve) => {
        resolveRequest = () => resolve(new Response(JSON.stringify({ partId: 'p1', slug: 's', created: true, reused: false, stockId: null, placementId: null })));
      }),
    );

    const { result } = renderHook(() => usePartIngress(), { wrapper: createWrapper() });
    expect(result.current.isIngesting).toBe(false);

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.ingest({
        source: 'manual',
        origin: 'user',
        fields: { title: 'X', canonicalCategory: 'unknown' },
      });
    });

    await waitFor(() => expect(result.current.isIngesting).toBe(true));

    await act(async () => {
      resolveRequest!();
      await promise!;
    });

    await waitFor(() => expect(result.current.isIngesting).toBe(false));
  });

  it('shows toast on error', async () => {
    const { toast } = await import('@/hooks/use-toast');
    mockApiRequest.mockRejectedValueOnce(new Error('500: Internal Server Error'));

    const { result } = renderHook(() => usePartIngress(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.ingest({
          source: 'manual',
          origin: 'user',
          fields: { title: 'Fail', canonicalCategory: 'unknown' },
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'Failed to add part' }),
      );
    });
  });
});
