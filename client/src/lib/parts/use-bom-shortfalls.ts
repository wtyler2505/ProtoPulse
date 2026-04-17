/**
 * BL-0150 — BOM inventory shortfall hook.
 *
 * Fetches `{ data, total, totalShortfallUnits }` from
 * `GET /api/projects/:id/bom/shortfalls`. Cached per project; the BOM table
 * and procurement view consume it to render per-row shortfall badges, and
 * the export precheck consumes `totalShortfallUnits` to warn on fab exports.
 *
 * The hook is read-only — shortfalls are a derived view over `part_stock`,
 * so any change to `quantityNeeded` (BOM add/remove) or `quantityOnHand`
 * (stock edit) should invalidate the `['bom-shortfalls', projectId]` key.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { BomShortfall } from '@shared/parts/shortfall';

export interface BomShortfallsResponse {
  data: BomShortfall[];
  total: number;
  totalShortfallUnits: number;
}

export function bomShortfallsQueryKey(projectId: number): readonly unknown[] {
  return [`/api/projects/${projectId}/bom/shortfalls`, 'bom-shortfalls', projectId] as const;
}

export function useBomShortfalls(projectId: number | null | undefined) {
  return useQuery<BomShortfallsResponse>({
    queryKey: bomShortfallsQueryKey(projectId ?? -1),
    enabled: typeof projectId === 'number' && projectId > 0,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/bom/shortfalls`);
      return (await res.json()) as BomShortfallsResponse;
    },
    staleTime: 30_000,
  });
}

/**
 * Convenience map keyed by canonical part number (MPN or slug) so the BOM
 * table — which only knows the `partNumber` string — can look up shortfalls
 * without an O(n) scan per row.
 */
export function indexShortfallsByPartNumber(
  shortfalls: ReadonlyArray<BomShortfall> | undefined,
): Map<string, BomShortfall> {
  const map = new Map<string, BomShortfall>();
  if (!shortfalls) { return map; }
  for (const row of shortfalls) {
    map.set(row.partNumber, row);
  }
  return map;
}
