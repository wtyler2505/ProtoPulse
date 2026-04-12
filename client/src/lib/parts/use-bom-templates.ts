import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';

export interface BomTemplate {
  id: string;
  userId: number;
  name: string;
  description: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface BomTemplateItem {
  id: string;
  templateId: string;
  partId: string;
  quantityNeeded: number;
  unitPrice: string | null;
  supplier: string | null;
  notes: string | null;
  partTitle: string;
  partMpn: string | null;
}

export interface BomTemplateWithItems extends BomTemplate {
  items: BomTemplateItem[];
}

interface TemplatesResponse {
  data: BomTemplate[];
  total: number;
}

const TEMPLATE_KEYS = {
  all: ['/api/bom-templates', 'bom-templates'] as const,
  detail: (id: string) => [`/api/bom-templates/${id}`, 'bom-templates', 'detail', id] as const,
};

export function useBomTemplates() {
  return useQuery({
    queryKey: TEMPLATE_KEYS.all,
    queryFn: getQueryFn<TemplatesResponse>({ on401: 'throw' }),
    select: (response) => response.data,
  });
}

export function useBomTemplateDetail(templateId: string | null) {
  return useQuery({
    queryKey: TEMPLATE_KEYS.detail(templateId!),
    queryFn: getQueryFn<BomTemplateWithItems>({ on401: 'throw' }),
    enabled: !!templateId,
  });
}

export function useCreateBomTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string | null;
      tags?: string[];
      items: Array<{
        partId: string;
        quantityNeeded?: number;
        unitPrice?: number | null;
        supplier?: string | null;
        notes?: string | null;
      }>;
    }) => {
      const res = await apiRequest('POST', '/api/bom-templates', data);
      return res.json() as Promise<BomTemplate & { itemCount: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-templates'] });
    },
  });
}

export function useApplyBomTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, projectId }: { templateId: string; projectId: number }) => {
      const res = await apiRequest('POST', `/api/bom-templates/${templateId}/apply`, { projectId });
      return res.json() as Promise<{ message: string; created: number; skipped: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

export function useDeleteBomTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest('DELETE', `/api/bom-templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-templates'] });
    },
  });
}
