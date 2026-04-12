import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { PartOrigin, AssemblyCategory } from '@shared/parts/part-row';
import { partsMutationKeys } from './query-keys';

function errorReason(error: Error): string {
  return error.message.replace(/^\d{3}:\s*/, '') || 'An unexpected error occurred';
}

export type IngressSource =
  | 'library_copy'
  | 'fzpz'
  | 'svg'
  | 'csv_bom'
  | 'camera_scan'
  | 'barcode'
  | 'manual'
  | 'bom_create'
  | 'component_create'
  | 'circuit_instance'
  | 'ai';

export interface IngressPayload {
  source: IngressSource;
  origin: PartOrigin;
  projectId?: number;
  fields: {
    title: string;
    description?: string | null;
    manufacturer?: string | null;
    mpn?: string | null;
    canonicalCategory: string;
    packageType?: string | null;
    tolerance?: string | null;
    esdSensitive?: boolean | null;
    assemblyCategory?: AssemblyCategory | null;
    datasheetUrl?: string | null;
    manufacturerUrl?: string | null;
    meta?: Record<string, unknown>;
    connectors?: unknown[];
    trustLevel?: string;
    originRef?: string | null;
    isPublic?: boolean;
  };
  stock?: {
    quantityNeeded?: number;
    quantityOnHand?: number | null;
    minimumStock?: number | null;
    storageLocation?: string | null;
    unitPrice?: number | string | null;
    supplier?: string | null;
    leadTime?: string | null;
    status?: string;
    notes?: string | null;
  };
}

export interface IngressResult {
  partId: string;
  slug: string;
  created: boolean;
  reused: boolean;
  stockId: string | null;
  placementId: string | null;
}

export function usePartIngress() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: partsMutationKeys.ingress,
    mutationFn: async (payload: IngressPayload) => {
      const res = await apiRequest('POST', '/api/parts/ingress', payload);
      return (await res.json()) as IngressResult;
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to add part', description: errorReason(error) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });

  return {
    ingest: mutation.mutateAsync,
    ingestSync: mutation.mutate,
    isIngesting: mutation.isPending,
  };
}
