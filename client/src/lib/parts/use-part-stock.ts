import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { PartStockRow } from '@shared/parts/part-row';
import { partsQueryKeys, partsMutationKeys } from './query-keys';

function errorReason(error: Error): string {
  return error.message.replace(/^\d{3}:\s*/, '') || 'An unexpected error occurred';
}

export interface StockUpdatePayload {
  stockId: string;
  data: Partial<{
    quantityNeeded: number;
    quantityOnHand: number | null;
    minimumStock: number | null;
    storageLocation: string | null;
    unitPrice: number | string | null;
    supplier: string | null;
    leadTime: string | null;
    status: string;
    notes: string | null;
  }>;
  version?: number;
}

export function usePartStockMutations(projectId: number) {
  const queryClient = useQueryClient();

  const invalidateCatalog = () => {
    void queryClient.invalidateQueries({ queryKey: ['parts'] });
  };

  const updateStockMutation = useMutation({
    mutationKey: partsMutationKeys.stock(projectId),
    mutationFn: async ({ stockId, data, version }: StockUpdatePayload) => {
      const headers: Record<string, string> = {};
      if (version !== undefined) {
        headers['If-Match'] = `"${version}"`;
      }
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/stock/${stockId}`, data);
      return (await res.json()) as PartStockRow;
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update stock', description: errorReason(error) });
    },
    onSettled: invalidateCatalog,
  });

  const deleteStockMutation = useMutation({
    mutationKey: partsMutationKeys.stock(projectId),
    mutationFn: async (stockId: string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/stock/${stockId}`);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to delete item', description: errorReason(error) });
    },
    onSettled: invalidateCatalog,
  });

  return {
    updateStock: updateStockMutation.mutate,
    deleteStock: deleteStockMutation.mutate,
    isUpdating: updateStockMutation.isPending,
    isDeleting: deleteStockMutation.isPending,
  };
}
