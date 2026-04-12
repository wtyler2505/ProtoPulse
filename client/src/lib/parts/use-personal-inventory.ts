import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import type { PartStockRow } from '@shared/parts/part-row';

interface PersonalStockResponse {
  data: PartStockRow[];
  total: number;
}

const PERSONAL_KEYS = {
  all: ['/api/parts/inventory/personal', 'parts', 'personal-inventory'] as const,
};

export function usePersonalInventory() {
  return useQuery({
    queryKey: PERSONAL_KEYS.all,
    queryFn: getQueryFn<PersonalStockResponse>({ on401: 'throw' }),
    select: (response) => response.data,
  });
}

export function useAddPersonalStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      partId: string;
      quantityOnHand?: number;
      storageLocation?: string | null;
      unitPrice?: number | null;
      supplier?: string | null;
      notes?: string | null;
    }) => {
      const res = await apiRequest('POST', '/api/parts/inventory/personal', data);
      return res.json() as Promise<PartStockRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts', 'personal-inventory'] });
    },
  });
}
