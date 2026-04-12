import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import type { PartFilter, PartPagination } from '@shared/parts/part-filter';
import type { PartRow, PartStockRow, PartWithStock } from '@shared/parts/part-row';
import { partsQueryKeys } from './query-keys';

interface CatalogResponse {
  data: PartWithStock[];
  total: number;
}

interface CatalogResponsePlain {
  data: PartRow[];
  total: number;
}

export interface UseCatalogOptions {
  filter: PartFilter;
  pagination?: PartPagination;
  enabled?: boolean;
}

function coerceStock(raw: Record<string, unknown>): PartStockRow {
  return {
    ...raw,
    unitPrice: raw.unitPrice != null ? Number(raw.unitPrice) : null,
    quantityNeeded: Number(raw.quantityNeeded ?? 0),
    quantityOnHand: raw.quantityOnHand != null ? Number(raw.quantityOnHand) : null,
    minimumStock: raw.minimumStock != null ? Number(raw.minimumStock) : null,
    version: Number(raw.version ?? 1),
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt as string),
  } as PartStockRow;
}

export function useCatalog({ filter, pagination, enabled = true }: UseCatalogOptions) {
  const hasProject = filter.projectId !== undefined;

  const query = useQuery({
    queryKey: partsQueryKeys.catalog({ ...filter, ...(pagination ?? {}) } as PartFilter),
    queryFn: getQueryFn<CatalogResponse | CatalogResponsePlain>({ on401: 'throw' }),
    enabled,
    select: (response) => {
      if (!hasProject) {
        const plain = response as CatalogResponsePlain;
        return plain.data.map((part): PartWithStock => ({ ...part, stock: null }));
      }
      const joined = response as CatalogResponse;
      return joined.data.map((entry): PartWithStock => ({
        ...entry,
        stock: entry.stock ? coerceStock(entry.stock as unknown as Record<string, unknown>) : null,
      }));
    },
  });

  return {
    parts: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
