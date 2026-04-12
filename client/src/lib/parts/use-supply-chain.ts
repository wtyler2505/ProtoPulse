import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';

export interface SupplyChainAlert {
  id: string;
  partId: string;
  projectId: number | null;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  previousValue: string | null;
  currentValue: string | null;
  supplier: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
}

interface AlertsResponse {
  data: SupplyChainAlert[];
  total: number;
}

interface AlertCountResponse {
  count: number;
}

export function useSupplyChainAlerts(projectId?: number) {
  const params = new URLSearchParams();
  if (projectId !== undefined) { params.set('projectId', String(projectId)); }
  params.set('unacknowledgedOnly', 'false');

  return useQuery({
    queryKey: [`/api/supply-chain/alerts?${params.toString()}`, 'supply-chain', 'alerts', projectId ?? 'all'],
    queryFn: getQueryFn<AlertsResponse>({ on401: 'throw' }),
    select: (response) => response.data,
  });
}

export function useSupplyChainAlertCount(projectId?: number) {
  const params = new URLSearchParams();
  if (projectId !== undefined) { params.set('projectId', String(projectId)); }

  return useQuery({
    queryKey: [`/api/supply-chain/alerts/count?${params.toString()}`, 'supply-chain', 'count', projectId ?? 'all'],
    queryFn: getQueryFn<AlertCountResponse>({ on401: 'throw' }),
    select: (response) => response.count,
    refetchInterval: 60_000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest('POST', `/api/supply-chain/alerts/${alertId}/ack`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-chain'] });
    },
  });
}

export function useAcknowledgeAllAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId?: number) => {
      await apiRequest('POST', '/api/supply-chain/alerts/ack-all', projectId !== undefined ? { projectId } : {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-chain'] });
    },
  });
}

export function useTriggerSupplyChainCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: number) => {
      const res = await apiRequest('POST', '/api/supply-chain/check', { projectId });
      return res.json() as Promise<{ jobId: string; message: string }>;
    },
    onSuccess: () => {
      // Refetch alerts after a delay (job takes time)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['supply-chain'] });
      }, 5000);
    },
  });
}
