import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { SpiceModelRow, InsertSpiceModel } from '@shared/schema';

interface SpiceModelListResult {
  models: SpiceModelRow[];
  total: number;
}

interface SpiceModelListOptions {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

function buildQueryString(opts?: Omit<SpiceModelListOptions, 'enabled'>): string {
  const params = new URLSearchParams();
  if (opts?.category) {
    params.set('category', opts.category);
  }
  if (opts?.search) {
    params.set('search', opts.search);
  }
  if (opts?.limit !== undefined) {
    params.set('limit', String(opts.limit));
  }
  if (opts?.offset !== undefined) {
    params.set('offset', String(opts.offset));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Fetch a paginated list of SPICE models with optional filtering.
 */
export function useSpiceModels(opts?: SpiceModelListOptions) {
  const { enabled = true, ...filterOpts } = opts ?? {};
  const queryString = buildQueryString(filterOpts);

  return useQuery<SpiceModelListResult>({
    queryKey: [`/api/spice-models${queryString}`],
    enabled,
  });
}

/**
 * Fetch a single SPICE model by ID.
 */
export function useSpiceModel(id: number | null | undefined) {
  return useQuery<SpiceModelRow>({
    queryKey: [`/api/spice-models/${id}`],
    enabled: id != null,
  });
}

/**
 * Create a new SPICE model.
 */
export function useCreateSpiceModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (model: InsertSpiceModel) => {
      const res = await apiRequest('POST', '/api/spice-models', model);
      return res.json() as Promise<SpiceModelRow>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/spice-models'] });
    },
  });
}

/**
 * Seed the database with standard SPICE models.
 */
export function useSeedSpiceModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/spice-models/seed');
      return res.json() as Promise<{ message: string; count: number }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/spice-models'] });
    },
  });
}
