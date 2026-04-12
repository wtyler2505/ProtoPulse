import { createContext, useContext, useMemo } from 'react';
import type { PartFilter } from '@shared/parts/part-filter';
import type { PartWithStock } from '@shared/parts/part-row';
import { useCatalog, type UseCatalogOptions } from './use-parts-catalog';
import { usePartStockMutations, type StockUpdatePayload } from './use-part-stock';
import { usePartIngress, type IngressPayload, type IngressResult } from './use-part-ingress';

export interface PartsCatalogState {
  ingest: (payload: IngressPayload) => Promise<IngressResult>;
  isIngesting: boolean;
  updateStock: (payload: StockUpdatePayload) => void;
  deleteStock: (stockId: string) => void;
  isUpdatingStock: boolean;
}

const PartsCatalogContext = createContext<PartsCatalogState | undefined>(undefined);

export function PartsCatalogProvider({
  projectId,
  children,
}: {
  projectId: number;
  children: React.ReactNode;
}) {
  const { ingest, isIngesting } = usePartIngress();
  const { updateStock, deleteStock, isUpdating } = usePartStockMutations(projectId);

  const value = useMemo<PartsCatalogState>(
    () => ({
      ingest,
      isIngesting,
      updateStock,
      deleteStock,
      isUpdatingStock: isUpdating,
    }),
    [ingest, isIngesting, updateStock, deleteStock, isUpdating],
  );

  return (
    <PartsCatalogContext.Provider value={value}>
      {children}
    </PartsCatalogContext.Provider>
  );
}

export function usePartsCatalog() {
  const context = useContext(PartsCatalogContext);
  if (!context) {
    throw new Error('usePartsCatalog must be used within PartsCatalogProvider');
  }
  return context;
}

export { useCatalog, type UseCatalogOptions, type PartFilter, type PartWithStock };
