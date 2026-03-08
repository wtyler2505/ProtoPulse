import { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import type { ValidationIssue } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';

const validationChecks: Array<{ severity: 'error' | 'warning' | 'info'; message: string; componentId: string; suggestion: string }> = [
  { severity: 'info', message: 'Check I2C pull-up resistor values for SHT40', componentId: '4', suggestion: 'Recommended 4.7kΩ for 100kHz standard mode.' },
  { severity: 'warning', message: 'No ESD protection on USB-C data lines', componentId: '5', suggestion: 'Add TVS diode array (e.g., USBLC6-2SC6) for ESD protection.' },
  { severity: 'info', message: 'Consider adding watchdog timer configuration', componentId: '1', suggestion: 'Enable ESP32 hardware WDT with 5s timeout for field reliability.' },
  { severity: 'warning', message: 'Battery reverse polarity protection missing', componentId: '2', suggestion: 'Add P-channel MOSFET or Schottky diode for reverse polarity protection.' },
  { severity: 'error', message: 'SPI bus contention possible without proper CS management', componentId: '3', suggestion: 'Ensure CS lines have pull-up resistors and are properly sequenced.' },
  { severity: 'info', message: 'Power sequencing not defined for multi-rail design', componentId: '2', suggestion: 'Define power-up sequence: 3.3V → 1.8V → I/O to prevent latch-up.' },
];

interface ValidationState {
  issues: ValidationIssue[];
  runValidation: () => void;
  addValidationIssue: (issue: { severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }) => void;
  deleteValidationIssue: (id: number | string) => void;
}

const ValidationContext = createContext<ValidationState | undefined>(undefined);

export function ValidationProvider({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const projectId = useProjectId();
  const validationCheckIndex = useRef(0);

  const validationQuery = useQuery({
    queryKey: [`/api/projects/${projectId}/validation`],
    enabled: seeded,
    select: (response: { data: Array<Omit<ValidationIssue, 'id'> & { id: number | string }>; total: number }) => response.data.map((issue): ValidationIssue => ({
      ...issue,
      id: String(issue.id),
    })),
  });

  const validationQueryKey = [`/api/projects/${projectId}/validation`];

  type ValidationRawItem = Omit<ValidationIssue, 'id'> & { id: number | string };
  type ValidationRawResponse = { data: ValidationRawItem[]; total: number };

  const addValidationIssueMutation = useMutation({
    mutationFn: async (issue: { severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }) => {
      await apiRequest('POST', `/api/projects/${projectId}/validation`, issue);
    },
    onMutate: async (newIssue) => {
      await queryClient.cancelQueries({ queryKey: validationQueryKey });
      const previous = queryClient.getQueryData<ValidationRawResponse>(validationQueryKey);
      queryClient.setQueryData<ValidationRawResponse>(validationQueryKey, (old) => {
        const items = old?.data ?? [];
        const optimistic: ValidationRawItem = {
          id: `temp-${crypto.randomUUID()}`,
          severity: newIssue.severity,
          message: newIssue.message,
          componentId: newIssue.componentId,
          suggestion: newIssue.suggestion,
        };
        return { data: [...items, optimistic], total: items.length + 1 };
      });
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(validationQueryKey, context.previous);
      }
      const reason = error.message.replace(/^\d{3}:\s*/, '') || 'An unexpected error occurred';
      toast({ variant: 'destructive', title: 'Failed to add validation issue', description: reason });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: validationQueryKey });
    },
  });

  const deleteValidationIssueMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/validation/${Number(id)}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: validationQueryKey });
      const previous = queryClient.getQueryData<ValidationRawResponse>(validationQueryKey);
      queryClient.setQueryData<ValidationRawResponse>(validationQueryKey, (old) => {
        const items = old?.data ?? [];
        const filtered = items.filter((item) => String(item.id) !== String(id));
        return { data: filtered, total: filtered.length };
      });
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(validationQueryKey, context.previous);
      }
      const reason = error.message.replace(/^\d{3}:\s*/, '') || 'An unexpected error occurred';
      toast({ variant: 'destructive', title: 'Failed to delete validation issue', description: reason });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: validationQueryKey });
    },
  });

  const runValidation = useCallback(() => {
    const check = validationChecks[validationCheckIndex.current % validationChecks.length];
    validationCheckIndex.current += 1;
    addValidationIssueMutation.mutate(check);
  }, [addValidationIssueMutation]);

  const addValidationIssue = useCallback((issue: { severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }) => {
    addValidationIssueMutation.mutate(issue);
  }, [addValidationIssueMutation]);

  const deleteValidationIssue = useCallback((id: number | string) => {
    deleteValidationIssueMutation.mutate(id);
  }, [deleteValidationIssueMutation]);

  const issues = validationQuery.data ?? [];

  const contextValue = useMemo<ValidationState>(() => ({
    issues,
    runValidation,
    addValidationIssue,
    deleteValidationIssue,
  }), [
    issues,
    runValidation,
    addValidationIssue,
    deleteValidationIssue,
  ]);

  return (
    <ValidationContext.Provider value={contextValue}>
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidation() {
  const context = useContext(ValidationContext);
  if (!context) throw new Error('useValidation must be used within ValidationProvider');
  return context;
}
