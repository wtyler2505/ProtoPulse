import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useProjectId } from '@/lib/contexts/project-id-context';

export interface JitRunHistoryItem {
  runId?: string;
  command?: string;
  status?: string;
  message?: string;
  completedAt?: number;
  createdAt?: number;
}

export function useJitRunHistory(limit = 3) {
  const projectId = useProjectId();
  const [items, setItems] = useState<JitRunHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<JitRunHistoryItem[]> => {
    setLoading(true);
    try {
      const res = await apiRequest('GET', `/api/projects/${String(projectId)}/jit-skills/history`);
      const body = (await res.json()) as { data?: JitRunHistoryItem[] };
      const next = (body.data ?? []).slice(0, limit);
      setItems(next);
      return next;
    } catch {
      setItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    window.addEventListener('protopulse:jit-skill-updated', handler);
    return () => window.removeEventListener('protopulse:jit-skill-updated', handler);
  }, [refresh]);

  return {
    items,
    loading,
    refresh,
  };
}
