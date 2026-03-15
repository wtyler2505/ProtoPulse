/**
 * DFM → PCB Highlight Bridge (BL-0572)
 *
 * Connects DFM validation violations to the PCB canvas highlight overlay.
 * When a user clicks a DFM violation in the ValidationView, this bridge:
 *   1. Converts the DfmViolation to a ViolationInput
 *   2. Navigates via ViolationNavigator (triggers view switch + highlight)
 *   3. Provides a React hook for PCBLayoutView to read the active highlight
 *
 * Auto-clears highlights after 5 seconds (longer than the default 3s
 * to give the user time to orient on the PCB canvas after view switch).
 */

import { useSyncExternalStore, useCallback } from 'react';
import { ViolationNavigator } from '@/lib/validation/violation-navigator';
import type { NavigationRequest } from '@/lib/validation/violation-navigator';
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
// DFM highlight auto-clear timeout (5 seconds)
// ---------------------------------------------------------------------------

const DFM_HIGHLIGHT_TIMEOUT_MS = 5_000;

/** Timer handle for DFM-specific extended timeout. */
let dfmClearTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Clear any pending DFM-specific highlight timer.
 */
function clearDfmTimer(): void {
  if (dfmClearTimer !== null) {
    clearTimeout(dfmClearTimer);
    dfmClearTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Core mapping function
// ---------------------------------------------------------------------------

/**
 * Map a DFM violation to a PCB canvas highlight and trigger navigation.
 *
 * Converts the DfmViolation to a ViolationInput, navigates via
 * ViolationNavigator (which emits the view-switch + highlight events),
 * and returns the highlight data for the PCB overlay.
 *
 * Sets an extended 5s auto-clear timer (overrides the navigator's default 3s).
 */
export function mapDfmViolationToHighlight(violation: DfmViolation): DfmPcbHighlight {
  const navigator = ViolationNavigator.getInstance();

  // Convert DfmViolation → ViolationInput and navigate
  const input = ViolationNavigator.fromDfmViolation(violation);
  const request = navigator.navigate(input);

  // Override the navigator's 3s auto-clear with our 5s timer
  clearDfmTimer();
  dfmClearTimer = setTimeout(() => {
    dfmClearTimer = null;
    navigator.clearHighlight();
  }, DFM_HIGHLIGHT_TIMEOUT_MS);

  return navigationRequestToHighlight(request, violation);
}

/**
 * Convert a NavigationRequest + original DfmViolation into DfmPcbHighlight data.
 */
function navigationRequestToHighlight(
  request: NavigationRequest,
  violation: DfmViolation,
): DfmPcbHighlight {
  return {
    violationId: request.violationId,
    x: request.location.coordinates.x,
    y: request.location.coordinates.y,
    radius: request.location.radius,
    severity: request.severity,
    category: violation.category,
    ruleName: violation.ruleName,
    elementId: violation.elementId,
  };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to the ViolationNavigator's active highlight and expose it
 * as a DfmPcbHighlight (or null) for the PCB canvas overlay.
 *
 * Only returns a highlight when the active navigation targets the PCB view.
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useDfmHighlights(): {
  highlight: DfmPcbHighlight | null;
  clearHighlight: () => void;
} {
  const navigator = ViolationNavigator.getInstance();

  const subscribe = useCallback(
    (cb: () => void) => navigator.subscribe(cb),
    [navigator],
  );

  const getSnapshot = useCallback((): NavigationRequest | null => {
    return navigator.getSnapshot();
  }, [navigator]);

  const request = useSyncExternalStore(subscribe, getSnapshot);

  const clearHighlight = useCallback(() => {
    clearDfmTimer();
    navigator.clearHighlight();
  }, [navigator]);

  // Only show highlights targeting the PCB view
  if (!request || request.location.viewType !== 'pcb') {
    return { highlight: null, clearHighlight };
  }

  const highlight: DfmPcbHighlight = {
    violationId: request.violationId,
    x: request.location.coordinates.x,
    y: request.location.coordinates.y,
    radius: request.location.radius,
    severity: request.severity,
    // The ViolationNavigator doesn't carry the full DFM category/ruleName,
    // so we derive sensible defaults from the entity type.
    category: entityTypeToDfmCategory(request.location.entityType),
    ruleName: request.violationId,
    elementId: request.location.entityId || undefined,
  };

  return { highlight, clearHighlight };
}

/**
 * Map a ViolationEntityType to a DfmCategory for display purposes.
 */
function entityTypeToDfmCategory(entityType: string): DfmCategory {
  switch (entityType) {
    case 'trace':
      return 'trace';
    case 'via':
      return 'via';
    case 'pad':
      return 'pad';
    case 'zone':
      return 'clearance';
    default:
      return 'board';
  }
}

// ---------------------------------------------------------------------------
// Testing utilities
// ---------------------------------------------------------------------------

/** Reset the DFM-specific timer. For testing only. */
export function resetDfmBridgeForTesting(): void {
  clearDfmTimer();
}
