import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

vi.mock('@/lib/queryClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/queryClient')>('@/lib/queryClient');
  return {
    ...actual,
    getQueryFn: () => async () => ({
      data: [
        {
          id: 'part-1',
          slug: 'res-10k-0402',
          title: '10kΩ Resistor',
          description: 'Precision resistor',
          manufacturer: 'Yageo',
          mpn: 'RC0402FR-0710KL',
          canonicalCategory: 'resistor',
          packageType: '0402',
          tolerance: '1%',
          esdSensitive: false,
          assemblyCategory: 'smt',
          meta: {},
          connectors: [],
          datasheetUrl: null,
          manufacturerUrl: null,
          origin: 'library',
          originRef: null,
          forkedFromId: null,
          authorUserId: null,
          isPublic: true,
          trustLevel: 'library',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
          stock: {
            id: 'stock-1',
            projectId: 1,
            partId: 'part-1',
            quantityNeeded: 100,
            quantityOnHand: 50,
            minimumStock: 10,
            storageLocation: 'Bin A3',
            unitPrice: '0.0100',
            supplier: 'Digi-Key',
            leadTime: '2 weeks',
            status: 'In Stock',
            notes: null,
            version: 1,
            updatedAt: '2026-01-01T00:00:00Z',
            deletedAt: null,
          },
        },
        {
          id: 'part-2',
          slug: 'cap-100nf-0603',
          title: '100nF Capacitor',
          description: null,
          manufacturer: null,
          mpn: null,
          canonicalCategory: 'capacitor',
          packageType: '0603',
          tolerance: '10%',
          esdSensitive: null,
          assemblyCategory: 'smt',
          meta: {},
          connectors: [],
          datasheetUrl: null,
          manufacturerUrl: null,
          origin: 'user',
          originRef: null,
          forkedFromId: null,
          authorUserId: null,
          isPublic: false,
          trustLevel: 'user',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
          stock: null,
        },
      ],
      total: 2,
    }),
  };
});

import { useCatalog } from '../use-parts-catalog';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useCatalog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns parts array from canonical endpoint', async () => {
    const { result } = renderHook(
      () => useCatalog({ filter: { projectId: 1, hasStock: true } }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.parts.length).toBe(2));
    expect(result.current.parts[0].title).toBe('10kΩ Resistor');
    expect(result.current.parts[1].title).toBe('100nF Capacitor');
  });

  it('coerces stock unitPrice from string to number', async () => {
    const { result } = renderHook(
      () => useCatalog({ filter: { projectId: 1, hasStock: true } }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.parts.length).toBe(2));
    const stock = result.current.parts[0].stock;
    expect(stock).not.toBeNull();
    expect(typeof stock!.unitPrice).toBe('number');
    expect(stock!.unitPrice).toBe(0.01);
  });

  it('preserves null stock for parts without stock', async () => {
    const { result } = renderHook(
      () => useCatalog({ filter: { projectId: 1, hasStock: true } }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.parts.length).toBe(2));
    expect(result.current.parts[1].stock).toBeNull();
  });

  it('starts in loading state', () => {
    const { result } = renderHook(
      () => useCatalog({ filter: { text: 'resistor' } }),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.parts).toEqual([]);
  });

  it('respects enabled=false', async () => {
    const { result } = renderHook(
      () => useCatalog({ filter: { text: 'x' }, enabled: false }),
      { wrapper: createWrapper() },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.parts).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('coerces stock quantityNeeded and quantityOnHand', async () => {
    const { result } = renderHook(
      () => useCatalog({ filter: { projectId: 1, hasStock: true } }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.parts.length).toBe(2));
    const stock = result.current.parts[0].stock!;
    expect(stock.quantityNeeded).toBe(100);
    expect(stock.quantityOnHand).toBe(50);
    expect(stock.minimumStock).toBe(10);
  });
});
