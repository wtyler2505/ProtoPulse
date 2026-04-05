import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ComponentPart, ComponentLibraryEntry } from '@shared/schema';

export function useComponentParts(projectId: number) {
  return useQuery<ComponentPart[]>({
    queryKey: ['component-parts', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/component-parts`);
      const json = await res.json() as { data: ComponentPart[]; total: number };
      return json.data;
    },
  });
}

export function useComponentPart(id: number, projectId: number) {
  return useQuery<ComponentPart>({
    queryKey: ['component-part', projectId, id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/component-parts/${id}`);
      return res.json();
    },
    enabled: id > 0,
  });
}

export function useComponentPartByNodeId(projectId: number, nodeId: string | null) {
  return useQuery<ComponentPart>({
    queryKey: ['component-part-node', projectId, nodeId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/component-parts/by-node/${nodeId}`);
      return res.json();
    },
    enabled: !!nodeId,
  });
}

export function useCreateComponentPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; nodeId?: string; meta?: unknown; connectors?: unknown; buses?: unknown; views?: unknown; constraints?: unknown }) => {
      const res = await apiRequest('POST', `/api/projects/${data.projectId}/component-parts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-parts'] });
    },
  });
}

export function useGenerateExactComponentPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apiKey,
      communitySourceUrl,
      description,
      imageBase64,
      imageMimeType,
      marketplaceSourceUrl,
      officialSourceUrl,
      projectId,
    }: {
      apiKey?: string;
      communitySourceUrl?: string;
      description: string;
      imageBase64?: string;
      imageMimeType?: string;
      marketplaceSourceUrl?: string;
      officialSourceUrl?: string;
      projectId: number;
    }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/component-parts/ai/generate`, {
        apiKey,
        communitySourceUrl,
        description,
        imageBase64,
        imageMimeType,
        marketplaceSourceUrl,
        officialSourceUrl,
      });
      return res.json() as Promise<ComponentPart>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-parts'] });
    },
  });
}

export function useUpdateComponentPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, data }: { id: number; projectId: number; data: { meta?: unknown; connectors?: unknown; buses?: unknown; views?: unknown; constraints?: unknown; nodeId?: string | null } }) => {
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/component-parts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-parts'] });
      queryClient.invalidateQueries({ queryKey: ['component-part'] });
    },
  });
}

export function useVerifyComponentPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      data,
    }: {
      data: {
        evidence?: unknown[];
        note?: string;
        pinAccuracyReport?: unknown;
        verificationLevel?: string;
        verifiedBy?: string;
        visualAccuracyReport?: unknown;
      };
      id: number;
      projectId: number;
    }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/component-parts/${id}/verify`, data);
      return res.json() as Promise<ComponentPart>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-parts'] });
      queryClient.invalidateQueries({ queryKey: ['component-part'] });
    },
  });
}

export function useDeleteComponentPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/component-parts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-parts'] });
    },
  });
}

export function useLibraryEntries(opts?: { search?: string; category?: string; page?: number }) {
  return useQuery<{ entries: ComponentLibraryEntry[]; total: number }>({
    queryKey: ['component-library', opts?.search, opts?.category, opts?.page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (opts?.search) params.set('search', opts.search);
      if (opts?.category) params.set('category', opts.category);
      if (opts?.page) params.set('page', String(opts.page));
      const res = await apiRequest('GET', `/api/component-library?${params.toString()}`);
      return res.json();
    },
  });
}

export function usePublishToLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description?: string; meta: unknown; connectors: unknown; buses: unknown; views: unknown; constraints: unknown; tags: string[]; category?: string; isPublic: boolean }) => {
      const res = await apiRequest('POST', '/api/component-library', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-library'] });
    },
  });
}

export function useForkLibraryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ libraryId, projectId }: { libraryId: number; projectId: number }) => {
      const res = await apiRequest('POST', `/api/component-library/${libraryId}/fork`, { projectId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-parts'] });
    },
  });
}
