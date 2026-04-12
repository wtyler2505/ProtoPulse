import { useQuery } from '@tanstack/react-query';
import { PARTS_QUERY_KEYS } from './query-keys';

export interface UsageBrowseRow {
  part: {
    id: string;
    slug: string;
    title: string;
    manufacturer: string | null;
    mpn: string | null;
    category: string | null;
    trustLevel: string;
  };
  projectCount: number;
  totalQuantityNeeded: number;
  totalPlacements: number;
}

export function useUsageBrowse() {
  return useQuery<UsageBrowseRow[]>({
    queryKey: [...PARTS_QUERY_KEYS.base, 'browse', 'usage'],
    queryFn: async () => {
      const res = await fetch('/api/parts/browse/usage');
      if (!res.ok) { throw new Error('Failed to fetch usage summary'); }
      const body = await res.json();
      return body.data;
    },
    staleTime: 60_000,
  });
}
