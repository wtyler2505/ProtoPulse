import { createContext, useContext, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ProjectHistoryItem } from '@/lib/project-context';

const PROJECT_ID = 1;

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

interface HistoryState {
  history: ProjectHistoryItem[];
  addToHistory: (action: string, user: 'User' | 'AI') => void;
}

const HistoryContext = createContext<HistoryState | undefined>(undefined);

export function HistoryProvider({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}/history`],
    enabled: seeded,
    select: (data: Array<{ id: number | string; action: string; user: 'User' | 'AI'; timestamp: string }>) => data.map((item): ProjectHistoryItem => ({
      id: String(item.id),
      action: item.action,
      user: item.user,
      timestamp: formatTimeAgo(item.timestamp),
    })),
  });

  const addHistoryMutation = useMutation({
    mutationFn: async (data: { action: string; user: string }) => {
      await apiRequest('POST', `/api/projects/${PROJECT_ID}/history`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/history`] });
    },
  });

  const addToHistory = useCallback((action: string, user: 'User' | 'AI') => {
    addHistoryMutation.mutate({ action, user });
  }, [addHistoryMutation]);

  return (
    <HistoryContext.Provider value={{
      history: historyQuery.data ?? [],
      addToHistory,
    }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) throw new Error('useHistory must be used within HistoryProvider');
  return context;
}
