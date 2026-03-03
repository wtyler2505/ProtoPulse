import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { BomItem } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';

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
    queryKey: [`/api/projects/${projectId}/bom`],
    enabled: seeded,
    select: (response: { data: Array<Omit<BomItem, 'id'> & { id: number | string }>; total: number }) => response.data.map((item): BomItem => ({
      ...item,
      id: String(item.id),
    })),
  });

  const addBomItemMutation = useMutation({
    mutationFn: async (item: Omit<BomItem, 'id'>) => {
      await apiRequest('POST', `/api/projects/${projectId}/bom`, item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/bom`] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to add BOM item', description: errorReason(error) });
    },
  });

  const deleteBomItemMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/bom/${Number(id)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/bom`] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to delete BOM item', description: errorReason(error) });
    },
  });

  const updateBomItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<BomItem> }) => {
      await apiRequest('PATCH', `/api/projects/${projectId}/bom/${Number(id)}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/bom`] });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update BOM item', description: `Changes may not have been saved. ${errorReason(error)}` });
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
