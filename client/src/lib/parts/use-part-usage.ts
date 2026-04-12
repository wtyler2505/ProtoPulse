import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { partsQueryKeys } from './query-keys';

export interface PartUsageRow {
  projectId: number;
  projectName: string;
  stockQuantityNeeded: number;
  stockQuantityOnHand: number | null;
  placementCount: number;
}

interface PartUsageResponse {
  data: PartUsageRow[];
  total: number;
}

export function usePartUsage(partId: string | null) {
  return useQuery({
    queryKey: partsQueryKeys.usage(partId!),
    queryFn: getQueryFn<PartUsageResponse>({ on401: 'throw' }),
    enabled: !!partId,
    select: (response) => response.data,
  });
}
