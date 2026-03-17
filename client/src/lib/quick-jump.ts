/**
 * Quick Jump
 *
 * A global target registry and fuzzy-search engine for instant navigation
 * within ProtoPulse. Targets include all ViewModes, common tools (DRC,
 * export, simulate), quick actions (undo, redo, save), components, and
 * settings. Recent targets are tracked in localStorage for a "frecency"
 * boost.
 *
 * Storage key: 'protopulse:quick-jump-recents'
 *
 * Implements singleton+subscribe for React integration via `useSyncExternalStore`.
 */

import { useCallback, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The kind of destination a quick-jump target represents. */
export type QuickJumpTargetType = 'view' | 'tool' | 'action' | 'component' | 'setting';

/** A single navigable target in the quick-jump registry. */
export interface QuickJumpTarget {
  /** Unique identifier (e.g. 'view:architecture', 'tool:drc', 'action:undo'). */
  id: string;
  /** Categorization used for filtering and iconography. */
  type: QuickJumpTargetType;
  /** Human-readable label shown in the command palette. */
  label: string;
  /** Optional longer description. */
  description?: string;
  /** Extra terms that should match during search (synonyms, abbreviations). */
  keywords: string[];
  /** Optional keyboard shortcut hint (display-only, not wired). */
  shortcut?: string;
}

/** A search result wrapping a target with a relevance score (0–1, higher is better). */
export interface QuickJumpResult {
  target: QuickJumpTarget;
  score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse:quick-jump-recents';
const MAX_RECENTS = 10;

// ---------------------------------------------------------------------------
// Registry — static list of built-in targets
// ---------------------------------------------------------------------------

export const QUICK_JUMP_REGISTRY: readonly QuickJumpTarget[] = [
  // -- Views ----------------------------------------------------------------
  { id: 'view:dashboard', type: 'view', label: 'Dashboard', description: 'Project overview and summary stats', keywords: ['home', 'overview', 'summary'] },
  { id: 'view:architecture', type: 'view', label: 'Architecture', description: 'Design system block diagram', keywords: ['blocks', 'diagram', 'system'] },
  { id: 'view:schematic', type: 'view', label: 'Schematic', description: 'Circuit schematic capture and net editing', keywords: ['circuit', 'net', 'wire', 'capture'] },
  { id: 'view:breadboard', type: 'view', label: 'Breadboard', description: 'Virtual breadboard wiring and placement', keywords: ['proto', 'prototype', 'wiring'] },
  { id: 'view:pcb', type: 'view', label: 'PCB Layout', description: 'PCB footprint placement and trace routing', keywords: ['board', 'trace', 'route', 'footprint', 'layout'] },
  { id: 'view:component_editor', type: 'view', label: 'Component Editor', description: 'Design individual electronic components', keywords: ['part', 'symbol', 'editor'] },
  { id: 'view:procurement', type: 'view', label: 'Procurement', description: 'Manage bill of materials and sourcing', keywords: ['bom', 'buy', 'sourcing', 'parts'] },
  { id: 'view:validation', type: 'view', label: 'Validation', description: 'Run design rule checks', keywords: ['drc', 'erc', 'rules', 'errors'] },
  { id: 'view:simulation', type: 'view', label: 'Simulation', description: 'SPICE simulation, AC/DC analysis, and waveform viewer', keywords: ['spice', 'ac', 'dc', 'transient', 'waveform', 'analyze'] },
  { id: 'view:kanban', type: 'view', label: 'Tasks', description: 'Track design tasks with a kanban board', keywords: ['kanban', 'todo', 'board', 'task'] },
  { id: 'view:knowledge', type: 'view', label: 'Learn', description: 'Electronics reference articles and learning resources', keywords: ['learn', 'articles', 'reference', 'education'] },
  { id: 'view:viewer_3d', type: 'view', label: '3D View', description: '3D PCB board visualization', keywords: ['3d', 'three', 'board', 'visual', 'model'] },
  { id: 'view:community', type: 'view', label: 'Community', description: 'Browse and share community component library', keywords: ['share', 'library', 'browse'] },
  { id: 'view:ordering', type: 'view', label: 'Order PCB', description: 'Order PCBs from fabricators with DFM checks', keywords: ['fab', 'fabrication', 'order', 'jlcpcb', 'pcbway'] },
  { id: 'view:storage', type: 'view', label: 'Inventory', description: 'Inventory tracking and storage location management', keywords: ['inventory', 'stock', 'warehouse', 'storage'] },
  { id: 'view:serial_monitor', type: 'view', label: 'Serial Monitor', description: 'Serial monitor for hardware devices', keywords: ['serial', 'uart', 'monitor', 'terminal', 'usb'] },
  { id: 'view:calculators', type: 'view', label: 'Calculators', description: 'Electronics engineering calculators', keywords: ['ohm', 'resistor', 'divider', 'calc', 'math'] },
  { id: 'view:design_patterns', type: 'view', label: 'Patterns', description: 'Reusable circuit design patterns', keywords: ['template', 'pattern', 'reuse', 'snippet'] },
  { id: 'view:circuit_code', type: 'view', label: 'Circuit Code', description: 'Circuit design as code with DSL editor', keywords: ['code', 'dsl', 'script', 'text'] },
  { id: 'view:arduino', type: 'view', label: 'Arduino', description: 'Embedded firmware workbench', keywords: ['firmware', 'embed', 'upload', 'sketch', 'esp32'] },
  { id: 'view:generative_design', type: 'view', label: 'Generative Design', description: 'AI-guided generative circuit design', keywords: ['ai', 'generate', 'evolve', 'optimize'] },
  { id: 'view:digital_twin', type: 'view', label: 'Digital Twin', description: 'Live hardware digital twin with IoT telemetry', keywords: ['twin', 'iot', 'telemetry', 'shadow', 'live'] },
  { id: 'view:starter_circuits', type: 'view', label: 'Starter Circuits', description: 'Pre-built circuits for instant beginner gratification', keywords: ['starter', 'beginner', 'example', 'preset'] },
  { id: 'view:labs', type: 'view', label: 'Labs', description: 'Guided lab assignments with grading', keywords: ['lab', 'assignment', 'guided', 'tutorial'] },
  { id: 'view:design_history', type: 'view', label: 'History', description: 'Architecture snapshot history and visual diff', keywords: ['history', 'snapshot', 'diff', 'timeline'] },
  { id: 'view:lifecycle', type: 'view', label: 'Lifecycle', description: 'Component lifecycle tracking and supply chain risk', keywords: ['lifecycle', 'eol', 'obsolete', 'risk'] },
  { id: 'view:comments', type: 'view', label: 'Comments', description: 'Design review comments and discussions', keywords: ['comment', 'review', 'discussion', 'note'] },
  { id: 'view:output', type: 'view', label: 'Exports', description: 'Export design files and artifacts', keywords: ['export', 'gerber', 'kicad', 'eagle', 'output', 'file'] },
  { id: 'view:project_explorer', type: 'view', label: 'Project Explorer', description: 'Browse project files and assets', keywords: ['files', 'explorer', 'tree', 'browse'] },
  { id: 'view:audit_trail', type: 'view', label: 'Audit Trail', description: 'View audit log entries', keywords: ['audit', 'log', 'trail', 'activity'] },

  // -- Tools ----------------------------------------------------------------
  { id: 'tool:drc', type: 'tool', label: 'Run DRC', description: 'Execute design rule check on current design', keywords: ['drc', 'check', 'rules', 'validate', 'errors'], shortcut: 'Ctrl+Shift+D' },
  { id: 'tool:erc', type: 'tool', label: 'Run ERC', description: 'Execute electrical rule check on schematic', keywords: ['erc', 'electrical', 'rules', 'check'] },
  { id: 'tool:export', type: 'tool', label: 'Export Design', description: 'Export design files (Gerber, KiCad, Eagle, etc.)', keywords: ['export', 'gerber', 'kicad', 'eagle', 'pdf', 'bom'] },
  { id: 'tool:simulate', type: 'tool', label: 'Run Simulation', description: 'Run SPICE circuit simulation', keywords: ['simulate', 'spice', 'run', 'analysis'] },
  { id: 'tool:autoroute', type: 'tool', label: 'Autoroute PCB', description: 'Automatically route PCB traces', keywords: ['autoroute', 'route', 'auto', 'trace', 'maze'] },
  { id: 'tool:monte-carlo', type: 'tool', label: 'Monte Carlo Analysis', description: 'Run Monte Carlo tolerance analysis', keywords: ['monte', 'carlo', 'tolerance', 'statistics', 'random'] },
  { id: 'tool:thermal', type: 'tool', label: 'Thermal Analysis', description: 'Analyze thermal performance and heat map', keywords: ['thermal', 'heat', 'temperature', 'derating'] },
  { id: 'tool:dfm', type: 'tool', label: 'DFM Check', description: 'Run design-for-manufacturing check', keywords: ['dfm', 'manufacturing', 'fab', 'fabrication'] },

  // -- Actions --------------------------------------------------------------
  { id: 'action:undo', type: 'action', label: 'Undo', description: 'Undo the last action', keywords: ['undo', 'revert', 'back'], shortcut: 'Ctrl+Z' },
  { id: 'action:redo', type: 'action', label: 'Redo', description: 'Redo the last undone action', keywords: ['redo', 'forward'], shortcut: 'Ctrl+Y' },
  { id: 'action:save', type: 'action', label: 'Save Project', description: 'Save the current project', keywords: ['save', 'persist', 'write'], shortcut: 'Ctrl+S' },
  { id: 'action:zoom-fit', type: 'action', label: 'Zoom to Fit', description: 'Fit entire design in view', keywords: ['zoom', 'fit', 'reset', 'view'], shortcut: 'Ctrl+0' },
  { id: 'action:zoom-in', type: 'action', label: 'Zoom In', description: 'Zoom into the canvas', keywords: ['zoom', 'in', 'magnify'], shortcut: 'Ctrl+=' },
  { id: 'action:zoom-out', type: 'action', label: 'Zoom Out', description: 'Zoom out of the canvas', keywords: ['zoom', 'out', 'shrink'], shortcut: 'Ctrl+-' },
  { id: 'action:select-all', type: 'action', label: 'Select All', description: 'Select all items in current view', keywords: ['select', 'all'], shortcut: 'Ctrl+A' },
  { id: 'action:delete', type: 'action', label: 'Delete Selected', description: 'Delete selected items', keywords: ['delete', 'remove', 'erase'], shortcut: 'Delete' },
  { id: 'action:copy', type: 'action', label: 'Copy', description: 'Copy selected items to clipboard', keywords: ['copy', 'clipboard'], shortcut: 'Ctrl+C' },
  { id: 'action:paste', type: 'action', label: 'Paste', description: 'Paste items from clipboard', keywords: ['paste', 'clipboard'], shortcut: 'Ctrl+V' },
  { id: 'action:cut', type: 'action', label: 'Cut', description: 'Cut selected items to clipboard', keywords: ['cut', 'clipboard'], shortcut: 'Ctrl+X' },

  // -- Components -----------------------------------------------------------
  { id: 'component:resistor', type: 'component', label: 'Resistor', description: 'Add a resistor to the design', keywords: ['resistor', 'ohm', 'r', 'passive'] },
  { id: 'component:capacitor', type: 'component', label: 'Capacitor', description: 'Add a capacitor to the design', keywords: ['capacitor', 'cap', 'c', 'farad', 'passive'] },
  { id: 'component:inductor', type: 'component', label: 'Inductor', description: 'Add an inductor to the design', keywords: ['inductor', 'coil', 'l', 'henry', 'passive'] },
  { id: 'component:led', type: 'component', label: 'LED', description: 'Add a light-emitting diode', keywords: ['led', 'light', 'diode', 'indicator'] },
  { id: 'component:transistor', type: 'component', label: 'Transistor', description: 'Add a transistor (BJT/MOSFET)', keywords: ['transistor', 'bjt', 'mosfet', 'fet', 'npn', 'pnp'] },
  { id: 'component:ic', type: 'component', label: 'Integrated Circuit', description: 'Add an IC/microchip', keywords: ['ic', 'chip', 'microchip', 'integrated'] },

  // -- Settings -------------------------------------------------------------
  { id: 'setting:theme', type: 'setting', label: 'Theme Settings', description: 'Configure application theme', keywords: ['theme', 'dark', 'light', 'color', 'appearance'] },
  { id: 'setting:api-keys', type: 'setting', label: 'API Key Settings', description: 'Manage AI provider API keys', keywords: ['api', 'key', 'anthropic', 'gemini', 'openai', 'credential'] },
  { id: 'setting:shortcuts', type: 'setting', label: 'Keyboard Shortcuts', description: 'View and customize keyboard shortcuts', keywords: ['keyboard', 'shortcut', 'keybinding', 'hotkey'] },
  { id: 'setting:grid', type: 'setting', label: 'Grid Settings', description: 'Configure snap grid and grid display', keywords: ['grid', 'snap', 'align', 'spacing'] },
];

// ---------------------------------------------------------------------------
// Fuzzy search
// ---------------------------------------------------------------------------

/**
 * Score a query against a single string.
 *
 * Uses a character-walk algorithm: characters of the query must appear in
 * order in the haystack. Consecutive matching characters, word-boundary
 * matches, and prefix matches receive bonus points.
 *
 * @returns A score in [0, 1] (0 means no match, 1 means perfect/exact).
 */
export function fuzzyScore(query: string, haystack: string): number {
  const q = query.toLowerCase();
  const h = haystack.toLowerCase();

  if (q.length === 0) {
    return 0;
  }

  // Exact match fast-path.
  if (h === q) {
    return 1;
  }

  // Substring match fast-path.
  if (h.includes(q)) {
    // Prefer prefix matches.
    const prefixBonus = h.startsWith(q) ? 0.15 : 0;
    return 0.7 + prefixBonus + (q.length / h.length) * 0.15;
  }

  // Character-walk fuzzy matching.
  let qi = 0;
  let consecutiveBonus = 0;
  let totalBonus = 0;
  let lastMatchIndex = -2;

  for (let hi = 0; hi < h.length && qi < q.length; hi++) {
    if (h[hi] === q[qi]) {
      // Consecutive match bonus.
      if (hi === lastMatchIndex + 1) {
        consecutiveBonus += 0.1;
      }
      // Word-boundary bonus (first char or preceded by space/separator).
      if (hi === 0 || ' _-/'.includes(h[hi - 1])) {
        totalBonus += 0.1;
      }
      lastMatchIndex = hi;
      qi++;
    }
  }

  // All query chars must be found.
  if (qi < q.length) {
    return 0;
  }

  const baseScore = q.length / h.length;
  const score = Math.min(1, baseScore * 0.5 + (totalBonus + consecutiveBonus) * 0.5 + 0.1);
  return Math.round(score * 1000) / 1000;
}

/**
 * Score a query against a QuickJumpTarget, considering label, description,
 * keywords, and type.
 *
 * @returns A score in [0, 1]. 0 means no match.
 */
function scoreTarget(query: string, target: QuickJumpTarget): number {
  const labelScore = fuzzyScore(query, target.label);
  const descScore = target.description ? fuzzyScore(query, target.description) * 0.6 : 0;
  const keywordScores = target.keywords.map((kw) => fuzzyScore(query, kw) * 0.8);
  const idScore = fuzzyScore(query, target.id) * 0.5;

  return Math.max(labelScore, descScore, idScore, ...keywordScores);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search the quick-jump registry for targets matching the given query.
 *
 * Results are ranked by fuzzy relevance with a recency boost for recently
 * used targets.
 *
 * @param query - Free-text search string (empty returns all targets ranked by recency).
 * @param options - Optional configuration.
 * @returns Sorted array of results (highest score first). Targets with score 0 are excluded.
 */
export function searchQuickJump(
  query: string,
  options?: { limit?: number; typeFilter?: QuickJumpTargetType },
): QuickJumpResult[] {
  const recents = getRecentJumps();
  const recentSet = new Map(recents.map((id, idx) => [id, idx]));

  const registry = options?.typeFilter
    ? QUICK_JUMP_REGISTRY.filter((t) => t.type === options.typeFilter)
    : QUICK_JUMP_REGISTRY;

  const results: QuickJumpResult[] = [];

  for (const target of registry) {
    let score: number;

    if (query.trim().length === 0) {
      // No query — rank by recency alone (recent first, then alphabetical).
      score = recentSet.has(target.id) ? 0.5 + (MAX_RECENTS - recentSet.get(target.id)!) / (MAX_RECENTS * 2) : 0.1;
    } else {
      score = scoreTarget(query, target);
      if (score === 0) {
        continue;
      }
      // Recency boost (up to +0.05).
      if (recentSet.has(target.id)) {
        score = Math.min(1, score + 0.05 * ((MAX_RECENTS - recentSet.get(target.id)!) / MAX_RECENTS));
      }
    }

    results.push({ target, score });
  }

  results.sort((a, b) => b.score - a.score || a.target.label.localeCompare(b.target.label));

  if (options?.limit && options.limit > 0) {
    return results.slice(0, options.limit);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Recents (localStorage)
// ---------------------------------------------------------------------------

/**
 * Return the last {@link MAX_RECENTS} target IDs the user jumped to
 * (most recent first).
 */
export function getRecentJumps(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/**
 * Record a jump to the given target, pushing it to the front of the
 * recents list and trimming to {@link MAX_RECENTS}.
 */
export function recordJump(targetId: string): void {
  const recents = getRecentJumps().filter((id) => id !== targetId);
  recents.unshift(targetId);
  const trimmed = recents.slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage quota exceeded — silently ignore.
  }
  QuickJumpStore.getInstance().notifyRecentsChanged();
}

/**
 * Clear all recent jump history.
 */
export function clearRecentJumps(): void {
  localStorage.removeItem(STORAGE_KEY);
  QuickJumpStore.getInstance().notifyRecentsChanged();
}

// ---------------------------------------------------------------------------
// QuickJumpStore — singleton + subscribe (for React integration)
// ---------------------------------------------------------------------------

type Listener = () => void;

/**
 * Singleton store that exposes a subscribe/getSnapshot API for
 * `useSyncExternalStore`. The snapshot is the current recents list;
 * it updates whenever `recordJump` or `clearRecentJumps` is called.
 */
export class QuickJumpStore {
  private static instance: QuickJumpStore | null = null;

  static getInstance(): QuickJumpStore {
    if (!QuickJumpStore.instance) {
      QuickJumpStore.instance = new QuickJumpStore();
    }
    return QuickJumpStore.instance;
  }

  /** Reset the singleton (for testing). */
  static resetInstance(): void {
    QuickJumpStore.instance = null;
  }

  private listeners: Set<Listener> = new Set();
  private snapshot: readonly string[];

  constructor() {
    this.snapshot = getRecentJumps();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly string[] => {
    return this.snapshot;
  };

  /** Called internally when recents change. */
  notifyRecentsChanged(): void {
    this.snapshot = getRecentJumps();
    this.listeners.forEach((fn) => fn());
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook for quick-jump integration.
 *
 * Returns the current recents list (reactive), plus stable callbacks for
 * search, recording, and clearing.
 *
 * @example
 * ```tsx
 * const { recents, search, recordJump: record, clear } = useQuickJump();
 * const results = search('pcb');
 * ```
 */
export function useQuickJump() {
  const store = QuickJumpStore.getInstance();

  const recents = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const search = useCallback(
    (query: string, options?: { limit?: number; typeFilter?: QuickJumpTargetType }) => {
      return searchQuickJump(query, options);
    },
    [],
  );

  const record = useCallback((targetId: string) => {
    recordJump(targetId);
  }, []);

  const clear = useCallback(() => {
    clearRecentJumps();
  }, []);

  return {
    /** Current recent target IDs (most recent first). */
    recents,
    /** Search the registry with fuzzy matching. */
    search,
    /** Record a jump to the given target ID. */
    recordJump: record,
    /** Clear all recent jump history. */
    clearRecentJumps: clear,
    /** The full static registry of targets. */
    registry: QUICK_JUMP_REGISTRY,
  } as const;
}
