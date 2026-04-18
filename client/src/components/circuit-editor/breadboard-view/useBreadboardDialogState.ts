/**
 * useBreadboardDialogState — discriminated-union dialog state machine.
 *
 * Encodes the invariant that only ONE of the four breadboard dialogs can be
 * open at a time (they are mutually exclusive in the UX).  Replaces the four
 * scattered useState<boolean> calls in BreadboardView:
 *   exactDraftModalOpen, exactPartDialogOpen, inventoryDialogOpen, shoppingListOpen
 *
 * Note: workbenchOpen is intentionally excluded — it is a sidebar-panel toggle
 * that defaults to true and can coexist with any open dialog.  Folding it into
 * a mutually-exclusive union would silently dismiss dialogs whenever the board-
 * audit / preflight handlers call setWorkbenchOpen(true).
 */

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BreadboardDialogState =
  | { kind: 'closed' }
  | { kind: 'exact-draft' }
  | { kind: 'exact-part' }
  | { kind: 'inventory' }
  | { kind: 'shopping-list' };

export interface UseBreadboardDialogStateResult {
  state: BreadboardDialogState;
  open: (kind: Exclude<BreadboardDialogState['kind'], 'closed'>) => void;
  close: () => void;
  isOpen: (kind: BreadboardDialogState['kind']) => boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const CLOSED: BreadboardDialogState = { kind: 'closed' };

export function useBreadboardDialogState(): UseBreadboardDialogStateResult {
  const [state, setState] = useState<BreadboardDialogState>(CLOSED);

  const open = useCallback(
    (kind: Exclude<BreadboardDialogState['kind'], 'closed'>) => {
      setState({ kind });
    },
    [],
  );

  const close = useCallback(() => {
    setState(CLOSED);
  }, []);

  const isOpen = useCallback(
    (kind: BreadboardDialogState['kind']): boolean => state.kind === kind,
    [state.kind],
  );

  return { state, open, close, isOpen };
}
