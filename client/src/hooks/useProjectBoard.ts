/**
 * useProjectBoard — shared PCB source of truth (Plan 02 Phase 4 / E2E-228).
 *
 * A project has exactly one physical PCB. PCBLayoutView, BoardViewer3DView,
 * and PcbOrderingView all consume this hook so that edits in one view
 * propagate to the others via React Query's cache.
 *
 * Each view edits only the fields it owns (PCBLayoutView → width/height,
 * BoardViewer3DView → thickness/cornerRadius, PcbOrderingView →
 * layers/finish/colors/flags). The server merges partial updates — fields
 * omitted from `updateBoard()` are preserved.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Board, UpdateBoard } from '@shared/schema';

// Default displayed when the server hasn't responded yet (initial render).
// Mirrors server/storage/boards.ts DEFAULT_BOARD_VALUES.
export const DEFAULT_PROJECT_BOARD: Board = {
  id: 0,
  projectId: 0,
  widthMm: 100,
  heightMm: 80,
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
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export function projectBoardQueryKey(projectId: number): readonly unknown[] {
  return ['projects', projectId, 'board'] as const;
}

export interface UseProjectBoardResult {
  board: Board;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  updateBoard: (patch: UpdateBoard) => Promise<Board>;
  isUpdating: boolean;
}

export function useProjectBoard(projectId: number): UseProjectBoardResult {
  const queryClient = useQueryClient();
  const enabled = Number.isFinite(projectId) && projectId > 0;
  const key = projectBoardQueryKey(projectId);

  const query = useQuery<Board>({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/board`, undefined, signal);
      return (await res.json()) as Board;
    },
    enabled,
    staleTime: 60_000,
  });

  const mutation = useMutation<Board, Error, UpdateBoard, { previous?: Board }>({
    mutationKey: [...key, 'update'],
    mutationFn: async (patch: UpdateBoard) => {
      const res = await apiRequest('PUT', `/api/projects/${projectId}/board`, patch);
      return (await res.json()) as Board;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Board>(key);
      if (previous) {
        queryClient.setQueryData<Board>(key, { ...previous, ...patch, updatedAt: new Date() });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(key, ctx.previous);
      }
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData<Board>(key, fresh);
    },
  });

  return {
    board: query.data ?? { ...DEFAULT_PROJECT_BOARD, projectId },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    updateBoard: (patch: UpdateBoard) => mutation.mutateAsync(patch),
    isUpdating: mutation.isPending,
  };
}
