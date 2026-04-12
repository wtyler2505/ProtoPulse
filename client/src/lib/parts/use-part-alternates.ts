import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { partsQueryKeys } from './query-keys';
import type { PartRow } from '@shared/parts/part-row';

interface AlternatesResponse {
  data: PartRow[];
  total: number;
}

export function usePartAlternates(partId: string | null) {
  return useQuery({
    queryKey: partsQueryKeys.alternates(partId!),
    queryFn: getQueryFn<AlternatesResponse>({ on401: 'throw' }),
    enabled: !!partId,
    select: (response) => response.data,
  });
}

interface SubstituteResult {
  message: string;
  stockMerged: boolean;
  placementsUpdated: number;
}

export function useSubstitutePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      oldPartId,
      substituteId,
      projectId,
    }: {
      oldPartId: string;
      substituteId: string;
      projectId: number;
    }) => {
      const res = await apiRequest('POST', `/api/parts/${oldPartId}/substitute`, {
        substituteId,
        projectId,
      });
      return res.json() as Promise<SubstituteResult>;
    },
    onSuccess: (_data, variables) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({
        queryKey: partsQueryKeys.usage(variables.oldPartId),
      });
      queryClient.invalidateQueries({
        queryKey: partsQueryKeys.usage(variables.substituteId),
      });
    },
  });
}
