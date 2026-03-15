/**
 * Lesson Mode — locks the UI to only show controls relevant to the current lesson step.
 *
 * When lesson mode is active, a full-screen overlay dims all UI controls that are
 * NOT in the allowed list. Allowed controls are specified as CSS selectors.
 *
 * Singleton + subscribe pattern (same as FavoritesManager, KanbanBoard, etc.).
 *
 * Usage:
 *   const lm = LessonMode.getInstance();
 *   lm.enable(['[data-testid="tab-architecture"]', '[data-testid="add-node-button"]']);
 *   lm.isControlAllowed('[data-testid="tab-architecture"]'); // true
 *   lm.disable();
 *
 * React hook:
 *   const { active, allowedSelectors, enable, disable, isControlAllowed } = useLessonMode();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LessonModeState {
  /** Whether lesson mode is currently active. */
  active: boolean;
  /** CSS selectors for the controls that should remain interactive. */
  allowedSelectors: readonly string[];
  /** Optional human-readable hint shown in the overlay banner. */
  hint: string | null;
}

export type LessonModeListener = () => void;

// ---------------------------------------------------------------------------
// LessonMode Singleton
// ---------------------------------------------------------------------------

export class LessonMode {
  private static instance: LessonMode | null = null;

  private state: LessonModeState;
  private listeners: Set<LessonModeListener>;

  constructor() {
    this.state = { active: false, allowedSelectors: [], hint: null };
    this.listeners = new Set();
  }

  static getInstance(): LessonMode {
    if (!LessonMode.instance) {
      LessonMode.instance = new LessonMode();
    }
    return LessonMode.instance;
  }

  static resetInstance(): void {
    LessonMode.instance = null;
  }

  // -----------------------------------------------------------------------
  // State accessors
  // -----------------------------------------------------------------------

  getState(): Readonly<LessonModeState> {
    return this.state;
  }

  isActive(): boolean {
    return this.state.active;
  }

  getAllowedSelectors(): readonly string[] {
    return this.state.allowedSelectors;
  }

  getHint(): string | null {
    return this.state.hint;
  }

  // -----------------------------------------------------------------------
  // Control checks
  // -----------------------------------------------------------------------

  /**
   * Returns true if a given CSS selector is in the allowed list.
   * When lesson mode is inactive, every control is considered allowed.
   */
  isControlAllowed(selector: string): boolean {
    if (!this.state.active) {
      return true;
    }
    return this.state.allowedSelectors.includes(selector);
  }

  /**
   * Check whether a DOM element matches any of the allowed selectors.
   * Returns true when lesson mode is inactive (everything allowed).
   */
  isElementAllowed(element: Element): boolean {
    if (!this.state.active) {
      return true;
    }
    return this.state.allowedSelectors.some((selector) => {
      try {
        return element.matches(selector) || element.closest(selector) !== null;
      } catch {
        // Invalid selector — skip
        return false;
      }
    });
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Activate lesson mode with a set of allowed CSS selectors.
   * All controls NOT matching these selectors will be dimmed and disabled.
   */
  enable(allowedSelectors: string[], hint?: string): void {
    this.state = {
      active: true,
      allowedSelectors: [...allowedSelectors],
      hint: hint ?? null,
    };
    this.notify();
  }

  /**
   * Update the set of allowed controls while lesson mode remains active.
   * No-op if lesson mode is not active.
   */
  setAllowedControls(allowedSelectors: string[], hint?: string): void {
    if (!this.state.active) {
      return;
    }
    this.state = {
      active: true,
      allowedSelectors: [...allowedSelectors],
      hint: hint !== undefined ? hint : this.state.hint,
    };
    this.notify();
  }

  /**
   * Deactivate lesson mode. All controls become interactive again.
   */
  disable(): void {
    if (!this.state.active) {
      return;
    }
    this.state = { active: false, allowedSelectors: [], hint: null };
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  subscribe(listener: LessonModeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((listener) => {
      listener();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useLessonMode() {
  const [state, setState] = useState<LessonModeState>(() =>
    LessonMode.getInstance().getState(),
  );

  useEffect(() => {
    const instance = LessonMode.getInstance();
    // Sync immediately in case state changed between render and effect
    setState(instance.getState());
    return instance.subscribe(() => {
      setState({ ...instance.getState() });
    });
  }, []);

  const enable = useCallback((selectors: string[], hint?: string) => {
    LessonMode.getInstance().enable(selectors, hint);
  }, []);

  const disable = useCallback(() => {
    LessonMode.getInstance().disable();
  }, []);

  const setAllowedControls = useCallback(
    (selectors: string[], hint?: string) => {
      LessonMode.getInstance().setAllowedControls(selectors, hint);
    },
    [],
  );

  const isControlAllowed = useCallback((selector: string) => {
    return LessonMode.getInstance().isControlAllowed(selector);
  }, []);

  return {
    active: state.active,
    allowedSelectors: state.allowedSelectors,
    hint: state.hint,
    enable,
    disable,
    setAllowedControls,
    isControlAllowed,
  } as const;
}
