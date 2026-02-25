import { createContext, useContext, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
    select: (data: Array<Omit<ValidationIssue, 'id'> & { id: number | string }>) => data.map((issue): ValidationIssue => ({
      ...issue,
      id: String(issue.id),
    })),
  });

  const addValidationIssueMutation = useMutation({
    mutationFn: async (issue: { severity: 'error' | 'warning' | 'info'; message: string; componentId?: string; suggestion?: string }) => {
      await apiRequest('POST', `/api/projects/${projectId}/validation`, issue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/validation`] });
    },
  });

  const deleteValidationIssueMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest('DELETE', `/api/validation/${Number(id)}?projectId=${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/validation`] });
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

  return (
    <ValidationContext.Provider value={{
      issues: validationQuery.data ?? [],
      runValidation,
      addValidationIssue,
      deleteValidationIssue,
    }}>
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidation() {
  const context = useContext(ValidationContext);
  if (!context) throw new Error('useValidation must be used within ValidationProvider');
  return context;
}
