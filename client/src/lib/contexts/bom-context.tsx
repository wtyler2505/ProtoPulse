import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { BomItem } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { projectMutationKeys, projectQueryKeys } from '@/lib/query-keys';
import type { PartWithStock, PartStockRow } from '@shared/parts/part-row';

function errorReason(error: Error): string {
  const msg = error.message.replace(/^\d{3}:\s*/, '');
  return msg || 'An unexpected error occurred';
}

const KNOWN_SUPPLIERS = new Set(['Digi-Key', 'Mouser', 'LCSC']);
const VALID_STATUSES = new Set(['In Stock', 'Low Stock', 'Out of Stock', 'On Order']);

function coerceSupplier(raw: string | null | undefined): BomItem['supplier'] {
  if (raw && KNOWN_SUPPLIERS.has(raw)) {
    return raw as 'Digi-Key' | 'Mouser' | 'LCSC';
  }
  return 'Unknown';
}

function coerceStatus(raw: string | null | undefined): BomItem['status'] {
  if (raw && VALID_STATUSES.has(raw)) {
    return raw as BomItem['status'];
  }
  return 'In Stock';
}

function mapToBomItem(entry: PartWithStock): BomItem {
  const s = entry.stock;
  const unitPrice = s?.unitPrice != null ? Number(s.unitPrice) : 0;
  const quantity = s?.quantityNeeded ?? 0;
  return {
    id: s?.id ?? entry.id,
    partNumber: entry.mpn ?? entry.slug,
    manufacturer: entry.manufacturer ?? '',
    description: entry.title,
    quantity,
    unitPrice,
    totalPrice: Math.round(quantity * unitPrice * 100) / 100,
    supplier: coerceSupplier(s?.supplier),
    stock: s?.quantityOnHand ?? 0,
    status: coerceStatus(s?.status),
    leadTime: s?.leadTime ?? undefined,
    esdSensitive: entry.esdSensitive ?? null,
    assemblyCategory: entry.assemblyCategory ?? null,
    storageLocation: s?.storageLocation ?? null,
    quantityOnHand: s?.quantityOnHand ?? null,
    minimumStock: s?.minimumStock ?? null,
  };
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

type CanonicalResponse = { data: PartWithStock[]; total: number };

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

  const bomQueryKey = projectQueryKeys.bom(projectId);

  const bomQuery = useQuery({
    queryKey: bomQueryKey,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/parts?projectId=${projectId}&hasStock=true`);
      return (await res.json()) as CanonicalResponse;
    },
    enabled: seeded,
    select: (response: CanonicalResponse) => response.data.map(mapToBomItem),
  });

  const addBomItemMutation = useMutation({
    mutationKey: projectMutationKeys.bom(projectId),
    mutationFn: async (item: Omit<BomItem, 'id'>) => {
      await apiRequest('POST', '/api/parts/ingress', {
        source: 'bom_create',
        origin: 'user',
        projectId,
        fields: {
          title: item.description,
          manufacturer: item.manufacturer || null,
          mpn: item.partNumber || null,
          canonicalCategory: 'component',
          esdSensitive: item.esdSensitive ?? null,
          assemblyCategory: item.assemblyCategory ?? null,
        },
        stock: {
          quantityNeeded: item.quantity,
          quantityOnHand: item.quantityOnHand ?? null,
          minimumStock: item.minimumStock ?? null,
          storageLocation: item.storageLocation ?? null,
          unitPrice: item.unitPrice,
          supplier: item.supplier !== 'Unknown' ? item.supplier : null,
          leadTime: item.leadTime ?? null,
          status: item.status,
        },
      });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to add BOM item', description: errorReason(error) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bomQueryKey });
    },
  });

  const deleteBomItemMutation = useMutation({
    mutationKey: projectMutationKeys.bom(projectId),
    mutationFn: async (id: number | string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/stock/${String(id)}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: bomQueryKey });
      const previous = queryClient.getQueryData<CanonicalResponse>(bomQueryKey);
      queryClient.setQueryData<CanonicalResponse>(bomQueryKey, (old) => {
        if (!old) { return old; }
        const filtered = old.data.filter((entry) => {
          const stockId = entry.stock?.id;
          return stockId !== String(id);
        });
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
      void queryClient.invalidateQueries({ queryKey: bomQueryKey });
    },
  });

  const updateBomItemMutation = useMutation({
    mutationKey: projectMutationKeys.bom(projectId),
    mutationFn: async ({ id, data }: { id: number | string; data: Partial<BomItem> }) => {
      const stockPayload: Record<string, unknown> = {};
      if (data.quantity !== undefined) { stockPayload.quantityNeeded = data.quantity; }
      if (data.unitPrice !== undefined) { stockPayload.unitPrice = data.unitPrice; }
      if (data.supplier !== undefined) { stockPayload.supplier = data.supplier !== 'Unknown' ? data.supplier : null; }
      if (data.status !== undefined) { stockPayload.status = data.status; }
      if (data.leadTime !== undefined) { stockPayload.leadTime = data.leadTime; }
      if (data.storageLocation !== undefined) { stockPayload.storageLocation = data.storageLocation; }
      if (data.quantityOnHand !== undefined) { stockPayload.quantityOnHand = data.quantityOnHand; }
      if (data.minimumStock !== undefined) { stockPayload.minimumStock = data.minimumStock; }

      const partPayload: Record<string, unknown> = {};
      if (data.description !== undefined) { partPayload.title = data.description; }
      if (data.manufacturer !== undefined) { partPayload.manufacturer = data.manufacturer || null; }
      if (data.partNumber !== undefined) { partPayload.mpn = data.partNumber || null; }
      if (data.esdSensitive !== undefined) { partPayload.esdSensitive = data.esdSensitive; }
      if (data.assemblyCategory !== undefined) { partPayload.assemblyCategory = data.assemblyCategory; }

      const promises: Promise<unknown>[] = [];

      if (Object.keys(stockPayload).length > 0) {
        promises.push(apiRequest('PATCH', `/api/projects/${projectId}/stock/${String(id)}`, stockPayload));
      }

      if (Object.keys(partPayload).length > 0) {
        const cached = queryClient.getQueryData<CanonicalResponse>(bomQueryKey);
        const entry = cached?.data.find((e) => e.stock?.id === String(id));
        if (entry) {
          promises.push(apiRequest('PATCH', `/api/parts/${entry.id}`, partPayload));
        }
      }

      await Promise.all(promises);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update BOM item', description: errorReason(error) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bomQueryKey });
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
