/**
 * React integration for the unified undo/redo stack.
 *
 * Provides `UndoRedoProvider` and `useUndoRedo()` hook that wrap the core
 * `UndoRedoStack` engine with React state, keyboard shortcuts (Ctrl+Z /
 * Ctrl+Shift+Z), and a stable API for consumers.
 */

import { createContext, useContext, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import type { UndoableCommand, HistoryEntry, UndoRedoSnapshot } from '@/lib/undo-redo';
import { UndoRedoStack } from '@/lib/undo-redo';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface UndoRedoState {
  /** Push a new undoable command (clears redo stack). */
  push: (command: UndoableCommand) => void;
  /** Undo the most recent command. */
  undo: () => void;
  /** Redo the most recently undone command. */
  redo: () => void;
  /** Whether an undo is available. */
  canUndo: boolean;
  /** Whether a redo is available. */
  canRedo: boolean;
  /** Description of the next undo action, or `null`. */
  undoDescription: string | null;
  /** Description of the next redo action, or `null`. */
  redoDescription: string | null;
  /** Full undo history (oldest first). */
  history: HistoryEntry[];
  /** Reset both stacks. */
  clear: () => void;
}

const UndoRedoContext = createContext<UndoRedoState | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Elements whose keyboard events should NOT trigger undo/redo shortcuts. */
const EDITABLE_TAG_NAMES = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (EDITABLE_TAG_NAMES.has(target.tagName)) {
    return true;
  }
  return target.isContentEditable;
}

export function UndoRedoProvider({ children, maxSize = 50 }: { children: React.ReactNode; maxSize?: number }) {
  // The stack is created once and survives re-renders.
  const stackRef = useRef<UndoRedoStack | null>(null);
  if (stackRef.current === null) {
    stackRef.current = new UndoRedoStack(maxSize);
  }
  const stack = stackRef.current;

  // We use useSyncExternalStore so the component tree re-renders whenever the
  // stack mutates (push / undo / redo / clear).
  const subscribeRef = useRef<((onStoreChange: () => void) => () => void) | null>(null);
  if (subscribeRef.current === null) {
    subscribeRef.current = (onStoreChange: () => void) => {
      stack.setListener(onStoreChange);
      return () => {
        stack.setListener(null);
      };
    };
  }

  // getSnapshot returns a cached reference that only changes when the stack
  // mutates — this is required by useSyncExternalStore to avoid infinite loops.
  const getSnapshotRef = useRef<() => UndoRedoSnapshot>(
    () => stack.getSnapshot(),
  );

  const snapshot = useSyncExternalStore(subscribeRef.current, getSnapshotRef.current);

  // Stable callbacks --------------------------------------------------------

  const push = useCallback((command: UndoableCommand) => {
    stack.push(command);
  }, [stack]);

  const undo = useCallback(() => {
    void stack.undo();
  }, [stack]);

  const redo = useCallback(() => {
    void stack.redo();
  }, [stack]);

  const clear = useCallback(() => {
    stack.clear();
  }, [stack]);

  // Keyboard shortcuts ------------------------------------------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      // Skip when focus is in an editable field.
      if (isEditableTarget(e.target)) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void stack.redo();
        return;
      }

      if (isCtrlOrMeta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void stack.undo();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stack]);

  // Build context value -----------------------------------------------------

  const value: UndoRedoState = {
    push,
    undo,
    redo,
    canUndo: snapshot.canUndo,
    canRedo: snapshot.canRedo,
    undoDescription: snapshot.undoDescription,
    redoDescription: snapshot.redoDescription,
    history: snapshot.history,
    clear,
  };

  return (
    <UndoRedoContext.Provider value={value}>
      {children}
    </UndoRedoContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUndoRedo(): UndoRedoState {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedo must be used within an UndoRedoProvider');
  }
  return context;
}
