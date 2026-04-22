/**
 * useProjectBoard tests — client hook for project-level PCB source of truth
 * (Plan 02 Phase 4 / E2E-228).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';
import { useProjectBoard, projectBoardQueryKey, DEFAULT_PROJECT_BOARD } from '../useProjectBoard';
import type { Board } from '@shared/schema';

const SAMPLE_BOARD: Board = {
  id: 42,
  projectId: 1,
  widthMm: 60,
  heightMm: 50,
  thicknessMm: 1.6,
  cornerRadiusMm: 2,
  layers: 2,
  copperWeightOz: 1,
  finish: 'HASL',
  solderMaskColor: 'green',
  silkscreenColor: 'white',
  minTraceWidthMm: 0.2,
  minDrillSizeMm: 0.3,
  castellatedHoles: false,
  impedanceControl: false,
  viaInPad: false,
  goldFingers: false,
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-01T00:00:00Z'),
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function wrapperWithClient() {
  const qc = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}

function mockFetchOnce(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('useProjectBoard', () => {
  it('returns the default shape synchronously before the fetch resolves', () => {
    mockFetchOnce(200, SAMPLE_BOARD);
    const { Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useProjectBoard(1), { wrapper: Wrapper });
    expect(result.current.board.widthMm).toBe(DEFAULT_PROJECT_BOARD.widthMm);
    expect(result.current.isLoading).toBe(true);
  });

  it('populates the board from the server', async () => {
    mockFetchOnce(200, SAMPLE_BOARD);
    const { Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useProjectBoard(1), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.board.widthMm).toBe(60);
    expect(result.current.board.heightMm).toBe(50);
  });

  it('is disabled when projectId is not positive (no fetch)', () => {
    const { Wrapper } = wrapperWithClient();
    renderHook(() => useProjectBoard(0), { wrapper: Wrapper });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updateBoard sends a PUT and updates the cache optimistically', async () => {
    mockFetchOnce(200, SAMPLE_BOARD);
    // Second call is the PUT response
    mockFetchOnce(200, { ...SAMPLE_BOARD, widthMm: 120 });

    const { qc, Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useProjectBoard(1), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateBoard({ widthMm: 120 });
    });

    // Server-returned value landed in cache
    const cached = qc.getQueryData<Board>(projectBoardQueryKey(1));
    expect(cached?.widthMm).toBe(120);

    // Second fetch must have been a PUT
    const putCall = fetchMock.mock.calls[1];
    expect(putCall[0]).toBe('/api/projects/1/board');
    expect(putCall[1].method).toBe('PUT');
    expect(JSON.parse(putCall[1].body as string)).toEqual({ widthMm: 120 });
  });

  it('rolls back optimistic update on PUT failure', async () => {
    mockFetchOnce(200, SAMPLE_BOARD);
    // PUT fails
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 400 }));

    const { qc, Wrapper } = wrapperWithClient();
    const { result } = renderHook(() => useProjectBoard(1), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateBoard({ widthMm: 9999 }).catch(() => undefined);
    });

    const cached = qc.getQueryData<Board>(projectBoardQueryKey(1));
    expect(cached?.widthMm).toBe(60); // unchanged
  });
});
