/**
 * DFM → PCB Highlight Bridge (BL-0572)
 *
 * Connects DFM validation violations to the PCB canvas highlight overlay.
 * When a user clicks a DFM violation in the ValidationView, this bridge:
 *   1. Converts the DfmViolation to a ViolationInput
 *   2. Navigates via ViolationNavigator (triggers view switch event)
 *   3. Maintains its own highlight state with 5s auto-clear
 *   4. Provides a React hook for PCBLayoutView to read the active highlight
 *
 * Uses its own highlight state (not the navigator's) because the navigator
 * has a fixed 3s auto-clear that's too short for a cross-view navigation
 * where the user needs time to orient on the PCB canvas.
 */

import { useSyncExternalStore, useCallback } from 'react';
import { ViolationNavigator } from '@/lib/validation/violation-navigator';
import type { DfmViolation, DfmCategory } from '@/lib/dfm-checker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** SVG overlay highlight data for the PCB canvas. */
export interface DfmPcbHighlight {
  /** Unique ID of the violation being highlighted. */
  violationId: string;
  /** Center coordinates on the PCB canvas (board units). */
  x: number;
  y: number;
  /** Highlight ring radius (board units). */
  radius: number;
  /** Severity determines the highlight color. */
  severity: 'error' | 'warning';
  /** The DFM category (trace, drill, via, etc.) for labeling. */
  category: DfmCategory;
  /** Human-readable DFM rule name. */
  ruleName: string;
  /** The element ID on the PCB (trace, pad, via ID) — may be absent for board-level violations. */
  elementId?: string;
}

// ---------------------------------------------------------------------------
// Singleton state for DFM highlights
// ---------------------------------------------------------------------------

const DFM_HIGHLIGHT_TIMEOUT_MS = 5_000;
const DEFAULT_RADIUS = 30;

/** Current active DFM highlight. */
let activeHighlight: DfmPcbHighlight | null = null;

/** Timer handle for auto-clear. */
let clearTimer: ReturnType<typeof setTimeout> | null = null;

/** Subscriber callbacks for useSyncExternalStore. */
const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of Array.from(listeners)) {
    cb();
  }
}

function clearTimerIfActive(): void {
  if (clearTimer !== null) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}

function setHighlight(highlight: DfmPcbHighlight | null): void {
  activeHighlight = highlight;
  notify();
}

// ---------------------------------------------------------------------------
// Core mapping function
// ---------------------------------------------------------------------------

/**
 * Map a DFM violation to a PCB canvas highlight and trigger navigation.
 *
 * Converts the DfmViolation to a ViolationInput and navigates via
 * ViolationNavigator (which emits the view-switch event to listeners).
 * Then sets the bridge's own highlight state with a 5s auto-clear timer.
 *
 * Returns the highlight data for immediate use.
 */
export function mapDfmViolationToHighlight(violation: DfmViolation): DfmPcbHighlight {
  const navigator = ViolationNavigator.getInstance();

  // Convert DfmViolation → ViolationInput and navigate
  // This triggers view-switch events via ViolationNavigator.onNavigate listeners
  const input = ViolationNavigator.fromDfmViolation(violation);
  const request = navigator.navigate(input);

  // Build our own highlight from the original violation data (richer than what
  // the navigator stores — we keep category, ruleName, etc.)
  const highlight: DfmPcbHighlight = {
    violationId: request.violationId,
    x: request.location.coordinates.x,
    y: request.location.coordinates.y,
    radius: request.location.radius > 0 ? request.location.radius : DEFAULT_RADIUS,
    severity: request.severity,
    category: violation.category,
    ruleName: violation.ruleName,
    elementId: violation.elementId,
  };

  // Set highlight with 5s auto-clear
  clearTimerIfActive();
  setHighlight(highlight);

  clearTimer = setTimeout(() => {
    clearTimer = null;
    setHighlight(null);
  }, DFM_HIGHLIGHT_TIMEOUT_MS);

  return highlight;
}

/**
 * Manually clear the active DFM highlight.
 */
export function clearDfmHighlight(): void {
  clearTimerIfActive();
  if (activeHighlight !== null) {
    setHighlight(null);
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/** useSyncExternalStore subscribe function. */
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** useSyncExternalStore getSnapshot function. */
function getSnapshot(): DfmPcbHighlight | null {
  return activeHighlight;
}

/**
 * Subscribe to the active DFM highlight for the PCB canvas overlay.
 *
 * Returns the current highlight (or null) and a function to clear it.
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useDfmHighlights(): {
  highlight: DfmPcbHighlight | null;
  clearHighlight: () => void;
} {
  const highlight = useSyncExternalStore(subscribe, getSnapshot);

  const clear = useCallback(() => {
    clearDfmHighlight();
  }, []);

  return { highlight, clearHighlight: clear };
}

// ---------------------------------------------------------------------------
// Direct state access (for testing and non-React consumers)
// ---------------------------------------------------------------------------

/** Get the current active DFM highlight. */
export function getDfmHighlight(): DfmPcbHighlight | null {
  return activeHighlight;
}

// ---------------------------------------------------------------------------
// Testing utilities
// ---------------------------------------------------------------------------

/** Reset the DFM bridge state. For testing only. */
export function resetDfmBridgeForTesting(): void {
  clearTimerIfActive();
  activeHighlight = null;
  listeners.clear();
}
