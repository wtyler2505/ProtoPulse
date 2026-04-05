import type { QueryKey } from '@tanstack/react-query';

export const projectQueryKeys = {
  list: (query = 'limit=100&offset=0&sort=desc') =>
    [`/api/projects?${query}`, 'project-list', query] as const,
  detail: (projectId: number) =>
    [`/api/projects/${projectId}`, 'project', projectId, 'detail'] as const,
  nodes: (projectId: number) =>
    [`/api/projects/${projectId}/nodes`, 'project', projectId, 'nodes'] as const,
  edges: (projectId: number) =>
    [`/api/projects/${projectId}/edges`, 'project', projectId, 'edges'] as const,
  bom: (projectId: number) =>
    [`/api/projects/${projectId}/bom`, 'project', projectId, 'bom'] as const,
  validation: (projectId: number) =>
    [`/api/projects/${projectId}/validation`, 'project', projectId, 'validation'] as const,
  history: (projectId: number) =>
    [`/api/projects/${projectId}/history`, 'project', projectId, 'history'] as const,
  designSnapshots: (projectId: number) =>
    [`/api/projects/${projectId}/snapshots`, 'project', projectId, 'design-snapshots'] as const,
  chat: (projectId: number, branchId: string | null) =>
    [branchId ? `/api/projects/${projectId}/chat?branchId=${branchId}` : `/api/projects/${projectId}/chat`, 'project', projectId, 'chat', branchId ?? 'main'] as const,
  chatBranches: (projectId: number) =>
    [`/api/projects/${projectId}/chat/branches`, 'project', projectId, 'chat-branches'] as const,
};

export const projectMutationKeys = {
  meta: (projectId: number) => ['project-mutation', projectId, 'meta'] as const,
  nodes: (projectId: number) => ['project-mutation', projectId, 'nodes'] as const,
  edges: (projectId: number) => ['project-mutation', projectId, 'edges'] as const,
  bom: (projectId: number) => ['project-mutation', projectId, 'bom'] as const,
  validation: (projectId: number) => ['project-mutation', projectId, 'validation'] as const,
  history: (projectId: number) => ['project-mutation', projectId, 'history'] as const,
  designSnapshots: (projectId: number) => ['project-mutation', projectId, 'design-snapshots'] as const,
  chat: (projectId: number) => ['project-mutation', projectId, 'chat'] as const,
};

export function isProjectMutationKey(queryKey: QueryKey | undefined, projectId?: number): boolean {
  if (!Array.isArray(queryKey) || queryKey[0] !== 'project-mutation') {
    return false;
  }

  if (projectId === undefined) {
    return true;
  }

  return queryKey[1] === projectId;
}
