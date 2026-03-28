/**
 * Shared types for schematic sub-modules. Uses `typeof` to derive proper
 * mutation ref types from the actual hooks, avoiding loose `Record<string, unknown>`.
 */
import type {
  useCreateCircuitInstance,
  useUpdateCircuitDesign,
  useUpdateCircuitInstance,
  useCreateCircuitNet,
} from '@/lib/circuit-editor/hooks';
import type { useToast } from '@/hooks/use-toast';
import type { useBom } from '@/lib/contexts/bom-context';

// Mutation return types derived from the actual hooks
export type CreateInstanceMutation = ReturnType<typeof useCreateCircuitInstance>;
export type UpdateDesignMutation = ReturnType<typeof useUpdateCircuitDesign>;
export type UpdateInstanceMutation = ReturnType<typeof useUpdateCircuitInstance>;
export type CreateNetMutation = ReturnType<typeof useCreateCircuitNet>;
export type ToastFn = ReturnType<typeof useToast>['toast'];
export type BomState = ReturnType<typeof useBom>;
