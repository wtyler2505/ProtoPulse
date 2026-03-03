import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useHistory } from '@/lib/contexts/history-context';
import { useOutput } from '@/lib/contexts/output-context';
import type { BomItem } from '@/lib/project-context';
import { ACTION_LABELS } from '../constants';
import type { AIAction } from '../chat-types';
import { ACTION_HANDLERS } from './action-handlers';
import type { ActionContext, ActionState } from './action-handlers';

/**
 * Hook that returns a function to execute AI-generated actions against the
 * project state.  Each action type corresponds to a mutation on the relevant
 * domain context.
 *
 * **Accumulator pattern**: The returned callback copies the current state
 * arrays (`nodes`, `edges`, `bom`, `issues`) into local mutable accumulators
 * before entering the action loop. Every handler reads from and writes to the
 * accumulators, then a single `setNodes(currentNodes)` / `setEdges(currentEdges)`
 * call at the end commits all changes atomically. This prevents the stale-
 * closure bug where multi-action sequences would silently drop earlier
 * mutations.
 */
export function useActionExecutor(): (actions: AIAction[]) => string[] {
  const {
    setNodes, setEdges, nodes, edges, pushUndoState, undo, redo,
  } = useArchitecture();
  const { bom, addBomItem, deleteBomItem, updateBomItem } = useBom();
  const { runValidation, addValidationIssue, deleteValidationIssue, issues } = useValidation();
  const {
    setActiveView, projectName, projectDescription, setProjectName, setProjectDescription,
  } = useProjectMeta();
  const { addToHistory } = useHistory();
  const { addOutputLog } = useOutput();

  return useCallback((actions: AIAction[]): string[] => {
    pushUndoState();
    const executedLabels: string[] = [];

    // ---- Local mutable accumulators ----
    const state: ActionState = {
      currentNodes: [...nodes] as Node[],
      currentEdges: [...edges] as Edge[],
      currentBom: [...bom] as BomItem[],
      currentIssues: [...issues],
      nodesDirty: false,
      edgesDirty: false,
    };

    // ---- Build context object passed to every handler ----
    const ctx: ActionContext = {
      state,
      arch: { setActiveView, undo, redo },
      bom: { addBomItem, deleteBomItem, updateBomItem },
      validation: { runValidation, deleteValidationIssue, addValidationIssue },
      meta: { projectName, projectDescription, setProjectName, setProjectDescription },
      history: { addToHistory },
      output: { addOutputLog },
    };

    for (const action of actions) {
      const label = ACTION_LABELS[action.type] || action.type;
      executedLabels.push(label);

      const handler = ACTION_HANDLERS[action.type];
      if (handler) {
        handler(action, ctx);
      }
    }

    // ---- Commit accumulated state changes ----
    if (state.nodesDirty) { setNodes(state.currentNodes); }
    if (state.edgesDirty) { setEdges(state.currentEdges); }

    return executedLabels;
  }, [
    nodes, edges, bom, issues, projectName, projectDescription,
    setNodes, setEdges, addBomItem, deleteBomItem, updateBomItem,
    runValidation, deleteValidationIssue, addValidationIssue,
    setActiveView, setProjectName, setProjectDescription,
    addToHistory, addOutputLog, pushUndoState, undo, redo,
  ]);
}
