import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { BomItem } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { projectMutationKeys, projectQueryKeys } from '@/lib/query-keys';

/** Extract a human-readable reason from a mutation error. */
function errorReason(error: Error): string {
  const msg = error.message.replace(/^\d{3}:\s*/, '');
  return msg || 'An unexpected error occurred';
}

interface BomState {
  bom: BomItem[];
  bomSettings: {
    maxCost: number;
    batchSize: number;
    inStockOnly: boolean;
    manufacturingDate: Date;
  };
  setBomSettings: (settings: Partial<{ maxCost: number; batchSize: number; inStockOnly: boolean; manufacturingDate: Date }>) => void;
  addBomItem: (item: Omit<BomItem, 'id'>) => void;
  deleteBomItem: (id: number | string) => void;
  updateBomItem: (id: number | string, data: Partial<BomItem>) => void;
}

const BomContext = createContext<BomState | undefined>(undefined);

export function BomProvider({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const projectId = useProjectId();

  const [bomSettings, setBomSettingsState] = useState({
    maxCost: 50,
    batchSize: 1000,
    inStockOnly: true,
    manufacturingDate: new Date(),
  });

  const setBomSettings = useCallback((settings: Partial<typeof bomSettings>) => {
    setBomSettingsState(prev => ({ ...prev, ...settings }));
  }, []);

  const bomQuery = useQuery({
    queryKey: projectQueryKeys.bom(projectId),
    enabled: seeded,
    select: (response: { data: Array<Omit<BomItem, 'id'> & { id: number | string; unitPrice: number | string; totalPrice: number | string }>; total: number }) => response.data.map((item): BomItem => ({
      ...item,
      id: String(item.id),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
  });

  const bomQueryKey = projectQueryKeys.bom(projectId);

  type BomRawItem = Omit<BomItem, 'id'> & { id: number | string; unitPrice: number | string; totalPrice: number | string };
  type BomRawResponse = { data: BomRawItem[]; total: number };

  const addBomItemMutation = useMutation({
    mutationKey: projectMutationKeys.bom(projectId),
    mutationFn: async (item: Omit<BomItem, 'id'>) => {
      await apiRequest('POST', `/api/projects/${projectId}/bom`, item);
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: bomQueryKey });
      const previous = queryClient.getQueryData<BomRawResponse>(bomQueryKey);
      queryClient.setQueryData<BomRawResponse>(bomQueryKey, (old) => {
        const items = old?.data ?? [];
        const optimistic: BomRawItem = {
          ...newItem,
          id: `temp-${crypto.randomUUID()}`,
          unitPrice: newItem.unitPrice,
          totalPrice: newItem.quantity * newItem.unitPrice,
        };
        return { data: [...items, optimistic], total: items.length + 1 };
      });
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bomQueryKey, context.previous);
      }
      toast({ variant: 'destructive', title: 'Failed to add BOM item', description: errorReason(error) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bomQueryKey });
    },
  });

  const deleteBomItemMutation = useMutation({
    mutationKey: projectMutationKeys.bom(projectId),
    mutationFn: async (id: number | string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/bom/${Number(id)}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: bomQueryKey });
      const previous = queryClient.getQueryData<BomRawResponse>(bomQueryKey);
      queryClient.setQueryData<BomRawResponse>(bomQueryKey, (old) => {
        const items = old?.data ?? [];
        const filtered = items.filter((item) => String(item.id) !== String(id));
        return { data: filtered, total: filtered.length };
      });
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bomQueryKey, context.previous);
      }
      toast({ variant: 'destructive', title: 'Failed to delete BOM item', description: errorReason(error) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bomQueryKey });
    },
  });

  const updateBomItemMutation = useMutation({
    mutationKey: projectMutationKeys.bom(projectId),
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<BomItem> }) => {
      await apiRequest('PATCH', `/api/projects/${projectId}/bom/${Number(id)}`, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: bomQueryKey });
      const previous = queryClient.getQueryData<BomRawResponse>(bomQueryKey);
      queryClient.setQueryData<BomRawResponse>(bomQueryKey, (old) => {
        const items = old?.data ?? [];
        const updated = items.map((item) => {
          if (String(item.id) !== String(id)) {
            return item;
          }
          const merged = { ...item, ...data };
          const qty = Number(merged.quantity);
          const price = Number(merged.unitPrice);
          return { ...merged, totalPrice: Math.round(qty * price * 100) / 100 };
        });
        return { data: updated, total: updated.length };
      });
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bomQueryKey, context.previous);
      }
      toast({ variant: 'destructive', title: 'Failed to update BOM item', description: `Changes may not have been saved. ${errorReason(error)}` });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bomQueryKey });
    },
  });

  const addBomItem = useCallback((item: Omit<BomItem, 'id'>) => addBomItemMutation.mutate(item), [addBomItemMutation]);
  const deleteBomItem = useCallback((id: number | string) => deleteBomItemMutation.mutate(id), [deleteBomItemMutation]);
  const updateBomItem = useCallback((id: number | string, data: Partial<BomItem>) => updateBomItemMutation.mutate({ id, data }), [updateBomItemMutation]);

  const bom = bomQuery.data ?? [];

  const contextValue = useMemo<BomState>(() => ({
    bom,
    bomSettings,
    setBomSettings,
    addBomItem,
    deleteBomItem,
    updateBomItem,
  }), [
    bom,
    bomSettings,
    setBomSettings,
    addBomItem,
    deleteBomItem,
    updateBomItem,
  ]);

  return (
    <BomContext.Provider value={contextValue}>
      {children}
    </BomContext.Provider>
  );
}

export function useBom() {
  const context = useContext(BomContext);
  if (!context) throw new Error('useBom must be used within BomProvider');
  return context;
}
