import { useQuery } from '@tanstack/react-query';
import { partsQueryKeys } from './query-keys';

export interface AlternatesBrowseRow {
  part: {
    id: string;
    slug: string;
    title: string;
    manufacturer: string | null;
    mpn: string | null;
    category: string | null;
    trustLevel: string;
  };
  alternateCount: number;
}

export function useAlternatesBrowse() {
  return useQuery<AlternatesBrowseRow[]>({
    queryKey: [...partsQueryKeys.all, 'browse', 'alternates'],
    queryFn: async () => {
      const res = await fetch('/api/parts/browse/alternates');
      if (!res.ok) { throw new Error('Failed to fetch alternates browse data'); }
      const body = await res.json();
      return body.data;
    },
    staleTime: 60_000,
  });
}
