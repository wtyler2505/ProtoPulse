/**
 * ViolationNavigator — singleton+subscribe manager for navigating from
 * validation/DRC/ERC violation rows to the corresponding canvas view
 * (architecture, schematic, PCB, breadboard) with a highlight pulse.
 *
 * BL-0566: DRC/PCB Violation Click → Navigate to PCB Canvas
 */

import type { DRCRuleType, PcbDrcRuleType, DRCViolation } from '@shared/component-types';
import type { ERCRuleType, ERCViolation } from '@shared/circuit-types';
import type { DfmViolation } from '@/lib/dfm-checker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The canvas view that owns a given violation. */
export type ViolationViewType = 'architecture' | 'schematic' | 'pcb' | 'breadboard';

/** The kind of entity that the violation is attached to. */
export type ViolationEntityType = 'node' | 'trace' | 'pad' | 'zone' | 'via' | 'instance' | 'wire' | 'net' | 'shape';

/** A resolved location on a canvas for a violation. */
export interface ViolationLocation {
  viewType: ViolationViewType;
  entityId: string;
  entityType: ViolationEntityType;
  coordinates: { x: number; y: number };
  radius: number;
}

/** A request to navigate to a specific violation. */
export interface NavigationRequest {
  violationId: string;
  location: ViolationLocation;
  highlight: boolean;
  pulse: boolean;
  severity: 'error' | 'warning';
}

/** Callback type for navigation subscribers. */
export type NavigationCallback = (request: NavigationRequest) => void;

/**
 * A unified violation input — callers pass whichever violation type they have.
 * The navigator inspects the shape to classify and resolve a location.
 */
export interface ViolationInput {
  id: string;
  ruleType: string;
  severity: 'error' | 'warning';
  message: string;
  /** Element / shape IDs associated with the violation. */
  shapeIds?: string[];
  /** Location hint from the violation data itself. */
  location?: { x: number; y: number };
  /** The view the violation was originally reported from (DRCViolation has this). */
  view?: 'breadboard' | 'schematic' | 'pcb';
  /** For ERC violations: the circuit instance ID. */
  instanceId?: number;
  /** For ERC violations: the pin name. */
  pin?: string;
  /** For ERC violations: the net ID. */
  netId?: number;
  /** For DFM violations: the element ID. */
  elementId?: string;
  /** DFM category hint. */
  category?: string;
}

// ---------------------------------------------------------------------------
// Rule-type classification sets
// ---------------------------------------------------------------------------

/**
 * PCB-level DRC rule types — violations with these rule types belong on the
 * PCB canvas. Includes both component-level PCB rules and board-level PCB
 * DRC rules.
 */
const PCB_RULE_TYPES: ReadonlySet<string> = new Set<string>([
  // Component-level PCB DRC rules (DRCRuleType)
  'min-clearance',
  'min-trace-width',
  'courtyard-overlap',
  'pad-size',
  'silk-overlap',
  'annular-ring',
  'thermal-relief',
  'trace-to-edge',
  'via-in-pad',
  'solder-mask',
  // Board-level PCB DRC rules (PcbDrcRuleType)
  'trace_clearance',
  'trace_width_min',
  'trace_width_max',
  'via_drill_min',
  'via_annular_ring',
  'pad_clearance',
  'silk_clearance',
  'board_edge_clearance',
  'diff_pair_spacing',
  'copper_pour_clearance',
]);

/** ERC rule types — these belong on the schematic canvas. */
const ERC_RULE_TYPES: ReadonlySet<string> = new Set<string>([
  'unconnected-pin',
  'shorted-power',
  'floating-input',
  'missing-bypass-cap',
  'driver-conflict',
  'no-connect-connected',
  'power-net-unnamed',
]);

/** Architecture-level rule categories. */
const ARCHITECTURE_RULE_TYPES: ReadonlySet<string> = new Set<string>([
  'connectivity',
  'power',
  'naming',
  'completeness',
]);

/** DFM categories that map to PCB. */
const DFM_CATEGORIES: ReadonlySet<string> = new Set<string>([
  'drill',
  'trace',
  'annularRing',
  'silkscreen',
  'solderMask',
  'boardEdge',
  'copperWeight',
  'holeSpacing',
]);

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Determine which canvas view a violation belongs to.
 *
 * Priority:
 * 1. Explicit `view` field on the violation (DRCViolation carries this)
 * 2. Rule-type set membership
 * 3. DFM category hint
 * 4. Fallback: 'architecture'
 */
export function classifyViolation(violation: ViolationInput): ViolationViewType {
  // 1. Explicit view field
  if (violation.view) {
    return violation.view;
  }

  const rule = violation.ruleType;

  // 2. Rule-type classification
  if (PCB_RULE_TYPES.has(rule)) {
    return 'pcb';
  }
  if (ERC_RULE_TYPES.has(rule)) {
    return 'schematic';
  }
  if (ARCHITECTURE_RULE_TYPES.has(rule)) {
    return 'architecture';
  }

  // 3. DFM category
  if (violation.category && DFM_CATEGORIES.has(violation.category)) {
    return 'pcb';
  }

  // 4. Heuristic: rule names with underscores tend to be PCB-level
  if (rule.includes('_')) {
    return 'pcb';
  }
  // Heuristic: rule names with dashes and known PCB keywords
  if (/trace|pad|via|drill|copper|clearance|mask|silk|annular|courtyard|edge|pour/i.test(rule)) {
    return 'pcb';
  }

  // 5. Fallback
  return 'architecture';
}

// ---------------------------------------------------------------------------
// Location resolution
// ---------------------------------------------------------------------------

/** Default radius for the highlight ring (canvas units). */
const DEFAULT_RADIUS = 30;

/**
 * Resolve a ViolationLocation from a ViolationInput.
 *
 * Extracts the best available position, entity ID, and entity type from the
 * violation data. When no position is available, returns a center-of-canvas
 * fallback ({0,0}) so the navigation still switches views.
 */
export function resolveLocation(violation: ViolationInput): ViolationLocation {
  const viewType = classifyViolation(violation);

  // Determine entity type from context
  let entityType: ViolationEntityType = 'shape';
  let entityId = '';

  if (violation.instanceId !== undefined) {
    entityType = 'instance';
    entityId = String(violation.instanceId);
  } else if (violation.netId !== undefined) {
    entityType = 'net';
    entityId = String(violation.netId);
  } else if (violation.elementId) {
    entityType = inferEntityType(violation.ruleType);
    entityId = violation.elementId;
  } else if (violation.shapeIds && violation.shapeIds.length > 0) {
    entityType = inferEntityType(violation.ruleType);
    entityId = violation.shapeIds[0];
  }

  const coordinates = violation.location ?? { x: 0, y: 0 };

  return {
    viewType,
    entityId,
    entityType,
    coordinates,
    radius: DEFAULT_RADIUS,
  };
}

/**
 * Infer a more specific entity type from the DRC/ERC rule type string.
 */
function inferEntityType(ruleType: string): ViolationEntityType {
  if (/trace|width/i.test(ruleType)) {
    return 'trace';
  }
  if (/pad|annular|solder/i.test(ruleType)) {
    return 'pad';
  }
  if (/via|drill/i.test(ruleType)) {
    return 'via';
  }
  if (/pour|zone|copper/i.test(ruleType)) {
    return 'zone';
  }
  if (/pin|net|connect/i.test(ruleType)) {
    return 'net';
  }
  return 'shape';
}

// ---------------------------------------------------------------------------
// ViolationNavigator singleton
// ---------------------------------------------------------------------------

/** Auto-clear highlight after this many milliseconds. */
const HIGHLIGHT_TIMEOUT_MS = 3_000;

type Listener = () => void;

export class ViolationNavigator {
  private static instance: ViolationNavigator | null = null;

  /** React useSyncExternalStore subscribers. */
  private subscribers: Set<Listener> = new Set();

  /** Navigation event subscribers. */
  private navigationListeners: Set<NavigationCallback> = new Set();

  /** Currently highlighted location (if any). */
  private activeHighlight: NavigationRequest | null = null;

  /** Timer handle for auto-clear. */
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): ViolationNavigator {
    if (!ViolationNavigator.instance) {
      ViolationNavigator.instance = new ViolationNavigator();
    }
    return ViolationNavigator.instance;
  }

  /** Reset singleton — for testing only. */
  static resetInstance(): void {
    if (ViolationNavigator.instance) {
      ViolationNavigator.instance.dispose();
      ViolationNavigator.instance = null;
    }
  }

  // -----------------------------------------------------------------------
  // React useSyncExternalStore interface
  // -----------------------------------------------------------------------

  subscribe(cb: Listener): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  getSnapshot(): NavigationRequest | null {
    return this.activeHighlight;
  }

  // -----------------------------------------------------------------------
  // Navigation event listeners (for view-switching in ProjectWorkspace)
  // -----------------------------------------------------------------------

  onNavigate(cb: NavigationCallback): () => void {
    this.navigationListeners.add(cb);
    return () => {
      this.navigationListeners.delete(cb);
    };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Navigate to a violation: resolves location, emits navigation event,
   * sets active highlight with auto-clear timer.
   */
  navigate(violation: ViolationInput): NavigationRequest {
    const location = resolveLocation(violation);

    const request: NavigationRequest = {
      violationId: violation.id,
      location,
      highlight: true,
      pulse: true,
      severity: violation.severity,
    };

    // Set highlight + start auto-clear
    this.setActiveHighlight(request);

    // Notify navigation listeners (view switching, viewport centering)
    for (const cb of Array.from(this.navigationListeners)) {
      cb(request);
    }

    return request;
  }

  /**
   * Get the currently active highlight (for overlay rendering).
   */
  getActiveHighlight(): NavigationRequest | null {
    return this.activeHighlight;
  }

  /**
   * Clear the active highlight immediately.
   */
  clearHighlight(): void {
    if (this.highlightTimer !== null) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }
    if (this.activeHighlight !== null) {
      this.activeHighlight = null;
      this.notify();
    }
  }

  // -----------------------------------------------------------------------
  // Convenience: convert typed violation objects into ViolationInput
  // -----------------------------------------------------------------------

  static fromDRCViolation(v: DRCViolation): ViolationInput {
    return {
      id: v.id,
      ruleType: v.ruleType,
      severity: v.severity,
      message: v.message,
      shapeIds: v.shapeIds,
      location: v.location,
      view: v.view,
    };
  }

  static fromERCViolation(v: ERCViolation): ViolationInput {
    return {
      id: v.id,
      ruleType: v.ruleType,
      severity: v.severity,
      message: v.message,
      location: v.location,
      instanceId: v.instanceId,
      pin: v.pin,
      netId: v.netId,
    };
  }

  static fromDfmViolation(v: DfmViolation): ViolationInput {
    return {
      id: v.id,
      ruleType: v.ruleId,
      severity: v.severity === 'info' ? 'warning' : v.severity,
      message: v.message,
      location: v.location,
      elementId: v.elementId,
      category: v.category,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private setActiveHighlight(request: NavigationRequest): void {
    // Clear any existing timer
    if (this.highlightTimer !== null) {
      clearTimeout(this.highlightTimer);
    }

    this.activeHighlight = request;
    this.notify();

    // Auto-clear after timeout
    this.highlightTimer = setTimeout(() => {
      this.highlightTimer = null;
      this.activeHighlight = null;
      this.notify();
    }, HIGHLIGHT_TIMEOUT_MS);
  }

  private notify(): void {
    for (const cb of this.subscribers) {
      cb();
    }
  }

  private dispose(): void {
    if (this.highlightTimer !== null) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }
    this.activeHighlight = null;
    this.subscribers.clear();
    this.navigationListeners.clear();
  }
}
