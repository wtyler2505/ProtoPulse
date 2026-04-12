import type { PartFilter } from '@shared/parts/part-filter';

function filterKey(filter: PartFilter): string {
  return JSON.stringify(filter);
}

export const partsQueryKeys = {
  all: ['parts'] as const,

  catalog: (filter: PartFilter) =>
    [`/api/parts?${buildSearchParams(filter)}`, 'parts', 'catalog', filterKey(filter)] as const,

  detail: (id: string) =>
    [`/api/parts/${id}`, 'parts', 'detail', id] as const,

  alternates: (id: string) =>
    [`/api/parts/${id}/alternates`, 'parts', 'alternates', id] as const,

  stock: (projectId: number) =>
    [`/api/projects/${projectId}/stock`, 'parts', 'stock', projectId] as const,

  lifecycle: (id: string) =>
    [`/api/parts/${id}/lifecycle`, 'parts', 'lifecycle', id] as const,

  spice: (id: string) =>
    [`/api/parts/${id}/spice`, 'parts', 'spice', id] as const,
};

export const partsMutationKeys = {
  ingress: ['parts-mutation', 'ingress'] as const,
  stock: (projectId: number) => ['parts-mutation', 'stock', projectId] as const,
};

function buildSearchParams(filter: PartFilter): string {
  const params = new URLSearchParams();
  if (filter.text) { params.set('text', filter.text); }
  if (filter.category) { params.set('category', filter.category); }
  if (filter.minTrustLevel) { params.set('minTrustLevel', filter.minTrustLevel); }
  if (filter.origin) { params.set('origin', filter.origin); }
  if (filter.isPublic !== undefined) { params.set('isPublic', String(filter.isPublic)); }
  if (filter.hasMpn !== undefined) { params.set('hasMpn', String(filter.hasMpn)); }
  if (filter.projectId !== undefined) { params.set('projectId', String(filter.projectId)); }
  if (filter.hasStock !== undefined) { params.set('hasStock', String(filter.hasStock)); }
  if (filter.tags && filter.tags.length > 0) { params.set('tags', filter.tags.join(',')); }
  return params.toString();
}
