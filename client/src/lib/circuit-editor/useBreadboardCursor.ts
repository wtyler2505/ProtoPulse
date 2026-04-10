/**
 * Keyboard-driven breadboard cursor navigation — S6-01
 *
 * Provides a pure `moveCursor` function for grid navigation and a
 * `useBreadboardCursor` React hook that wires it to keyboard events.
 *
 * Arrow keys move the cursor one hole at a time.
 * Shift+Arrow moves 5 holes at a time.
 * Tab cycles through placed components.
 * Enter starts/finishes a wire from the cursor position.
 * Escape deactivates the cursor.
 */

import { useCallback, useState } from 'react';
import { BB, type ColumnLetter } from './breadboard-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Position of the keyboard-driven cursor on the breadboard grid. */
export interface CursorState {
  col: ColumnLetter;
  row: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIFT_STEP = 5;
const ALL_COLS = BB.ALL_COLS;

// ---------------------------------------------------------------------------
// Pure movement function
// ---------------------------------------------------------------------------

/**
 * Compute the next cursor state after a keyboard key press.
 *
 * @param state  Current cursor position.
 * @param key    The `KeyboardEvent.key` value.
 * @param shift  Whether the Shift modifier was held.
 * @returns      New cursor state (never mutates input).
 */
export function moveCursor(
  state: CursorState,
  key: string,
  shift = false,
): CursorState {
  const step = shift ? SHIFT_STEP : 1;
  const colIdx = ALL_COLS.indexOf(state.col as typeof ALL_COLS[number]);

  switch (key) {
    case 'ArrowDown': {
      const nextRow = Math.min(state.row + step, BB.ROWS);
      return { ...state, row: nextRow };
    }
    case 'ArrowUp': {
      const nextRow = Math.max(state.row - step, 1);
      return { ...state, row: nextRow };
    }
    case 'ArrowRight': {
      const nextIdx = Math.min(colIdx + step, ALL_COLS.length - 1);
      return { ...state, col: ALL_COLS[nextIdx] };
    }
    case 'ArrowLeft': {
      const nextIdx = Math.max(colIdx - step, 0);
      return { ...state, col: ALL_COLS[nextIdx] };
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseBreadboardCursorOptions {
  /** Called when Enter is pressed — receives current cursor position. */
  onEnter?: (state: CursorState) => void;
  /** Called when Tab is pressed — receives direction (+1 forward, -1 backward). */
  onTab?: (direction: 1 | -1) => void;
  /** Called when Escape is pressed. */
  onEscape?: () => void;
}

export interface UseBreadboardCursorReturn {
  cursor: CursorState;
  setCursor: (state: CursorState) => void;
  handleKeyDown: (e: KeyboardEvent | React.KeyboardEvent) => void;
}

/**
 * Hook that manages a breadboard cursor navigable via keyboard.
 *
 * Attach `handleKeyDown` to a container's `onKeyDown` or use it
 * with a `useEffect` window listener.
 */
export function useBreadboardCursor(
  options: UseBreadboardCursorOptions = {},
): UseBreadboardCursorReturn {
  const [cursor, setCursor] = useState<CursorState>({
    col: 'a',
    row: 1,
    active: false,
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      const { key, shiftKey } = e;

      // Arrow keys — move cursor
      if (key.startsWith('Arrow')) {
        e.preventDefault();
        setCursor((prev) => {
          // Activate cursor on first arrow press if not already active
          const activated = prev.active ? prev : { ...prev, active: true };
          return moveCursor(activated, key, shiftKey);
        });
        return;
      }

      // Enter — signal wire start/finish
      if (key === 'Enter' && cursor.active) {
        e.preventDefault();
        options.onEnter?.(cursor);
        return;
      }

      // Tab — cycle through placed components
      if (key === 'Tab') {
        e.preventDefault();
        const direction = shiftKey ? -1 : 1;
        options.onTab?.(direction as 1 | -1);
        return;
      }

      // Escape — deactivate cursor
      if (key === 'Escape') {
        e.preventDefault();
        setCursor((prev) => ({ ...prev, active: false }));
        options.onEscape?.();
      }
    },
    [cursor, options],
  );

  return { cursor, setCursor, handleKeyDown };
}
