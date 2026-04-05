import { createContext, useContext, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ProjectHistoryItem } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { projectMutationKeys, projectQueryKeys } from '@/lib/query-keys';


interface HistoryState {
  history: ProjectHistoryItem[];
  addToHistory: (action: string, user: 'User' | 'AI') => void;
}

const HistoryContext = createContext<HistoryState | undefined>(undefined);

export function HistoryProvider({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const projectId = useProjectId();
  const historyQueryKey = projectQueryKeys.history(projectId);

  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    enabled: seeded,
    select: (response: { data: Array<{ id: number | string; action: string; user: 'User' | 'AI'; timestamp: string }>; total: number }) => response.data.map((item): ProjectHistoryItem => ({
      id: String(item.id),
      action: item.action,
      user: item.user,
      timestamp: item.timestamp,
    })),
  });

  const addHistoryMutation = useMutation({
    mutationKey: projectMutationKeys.history(projectId),
    mutationFn: async (data: { action: string; user: string }) => {
      await apiRequest('POST', `/api/projects/${projectId}/history`, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
  });

  const addToHistory = useCallback((action: string, user: 'User' | 'AI') => {
    addHistoryMutation.mutate({ action, user });
  }, [addHistoryMutation]);

  const history = historyQuery.data ?? [];

  const contextValue = useMemo<HistoryState>(() => ({
    history,
    addToHistory,
  }), [
    history,
    addToHistory,
  ]);

  return (
    <HistoryContext.Provider value={contextValue}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) throw new Error('useHistory must be used within HistoryProvider');
  return context;
}
