/**
 * Icon Language — centralized icon mapping for consistent iconography across ProtoPulse.
 *
 * Provides a single source of truth for which lucide-react icon represents each
 * action and entity. Downstream components should use `getIconForAction()` and
 * `getIconForEntity()` rather than importing icons ad-hoc, ensuring visual
 * consistency and making future icon changes a one-line fix.
 */

import type { LucideIcon } from 'lucide-react';
import {
  // --- Actions ---
  Plus,
  Trash2,
  Pencil,
  Save,
  Download,
  Upload,
  CheckCircle,
  Zap,
  Copy,
  ClipboardPaste,
  Undo2,
  Redo2,
  Search,
  Filter,
  SortAsc,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  RefreshCw,
  Play,
  Square,
  Pause,
  Settings,
  Share2,
  Link,
  Unlink,
  RotateCw,
  FlipHorizontal2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  Info,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  AlertTriangle,
  AlertCircle,
  // --- Entities ---
  Cpu,
  CircuitBoard,
  Package,
  FileText,
  Layers,
  GitBranch,
  Bot,
  Users,
  Factory,
  Ruler,
  ShieldCheck,
  Activity,
  BarChart3,
  Lightbulb,
  Wrench,
  BookOpen,
  MessageSquare,
  Clock,
  Star,
  Sparkles,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Broad functional domains that group related actions. Allows domain-specific
 * icon overrides when the same verb has different visual semantics in different
 * contexts (e.g. "run" in analysis means "simulate", in hardware means "flash").
 */
export type IconDomain =
  | 'design'
  | 'analysis'
  | 'hardware'
  | 'manufacturing'
  | 'documentation'
  | 'collaboration';

/**
 * A single action-to-icon binding with metadata.
 */
export interface IconMapping {
  /** The domain this mapping belongs to. */
  domain: IconDomain;
  /** The action verb or noun this icon represents. */
  action: string;
  /** The lucide-react icon component name (for auditing / logging). */
  iconName: string;
  /** The actual lucide-react icon component. */
  icon: LucideIcon;
  /** Human-readable label suitable for tooltips and aria-labels. */
  label: string;
}

// ---------------------------------------------------------------------------
// Master icon map
// ---------------------------------------------------------------------------

/**
 * Canonical action-to-icon mappings. Keyed by action verb/noun.
 *
 * When a single action needs domain-specific overrides, use domain-qualified
 * keys (e.g. "run:analysis" vs "run:hardware") or pass the domain parameter
 * to `getIconForAction()`.
 */
export const ICON_MAP: Record<string, IconMapping> = {
  // ---- CRUD / generic ----
  add: { domain: 'design', action: 'add', iconName: 'Plus', icon: Plus, label: 'Add' },
  delete: { domain: 'design', action: 'delete', iconName: 'Trash2', icon: Trash2, label: 'Delete' },
  edit: { domain: 'design', action: 'edit', iconName: 'Pencil', icon: Pencil, label: 'Edit' },
  save: { domain: 'design', action: 'save', iconName: 'Save', icon: Save, label: 'Save' },
  duplicate: { domain: 'design', action: 'duplicate', iconName: 'Copy', icon: Copy, label: 'Duplicate' },
  paste: { domain: 'design', action: 'paste', iconName: 'ClipboardPaste', icon: ClipboardPaste, label: 'Paste' },
  undo: { domain: 'design', action: 'undo', iconName: 'Undo2', icon: Undo2, label: 'Undo' },
  redo: { domain: 'design', action: 'redo', iconName: 'Redo2', icon: Redo2, label: 'Redo' },
  close: { domain: 'design', action: 'close', iconName: 'X', icon: X, label: 'Close' },
  confirm: { domain: 'design', action: 'confirm', iconName: 'Check', icon: Check, label: 'Confirm' },
  cancel: { domain: 'design', action: 'cancel', iconName: 'X', icon: X, label: 'Cancel' },

  // ---- I/O ----
  export: { domain: 'manufacturing', action: 'export', iconName: 'Download', icon: Download, label: 'Export' },
  import: { domain: 'manufacturing', action: 'import', iconName: 'Upload', icon: Upload, label: 'Import' },
  download: { domain: 'manufacturing', action: 'download', iconName: 'Download', icon: Download, label: 'Download' },
  upload: { domain: 'manufacturing', action: 'upload', iconName: 'Upload', icon: Upload, label: 'Upload' },
  share: { domain: 'collaboration', action: 'share', iconName: 'Share2', icon: Share2, label: 'Share' },
  link: { domain: 'collaboration', action: 'link', iconName: 'Link', icon: Link, label: 'Link' },
  unlink: { domain: 'collaboration', action: 'unlink', iconName: 'Unlink', icon: Unlink, label: 'Unlink' },
  open_external: {
    domain: 'documentation',
    action: 'open_external',
    iconName: 'ExternalLink',
    icon: ExternalLink,
    label: 'Open external',
  },

  // ---- Search / filter / sort ----
  search: { domain: 'design', action: 'search', iconName: 'Search', icon: Search, label: 'Search' },
  filter: { domain: 'design', action: 'filter', iconName: 'Filter', icon: Filter, label: 'Filter' },
  sort: { domain: 'design', action: 'sort', iconName: 'SortAsc', icon: SortAsc, label: 'Sort' },

  // ---- Visibility / lock ----
  show: { domain: 'design', action: 'show', iconName: 'Eye', icon: Eye, label: 'Show' },
  hide: { domain: 'design', action: 'hide', iconName: 'EyeOff', icon: EyeOff, label: 'Hide' },
  lock: { domain: 'design', action: 'lock', iconName: 'Lock', icon: Lock, label: 'Lock' },
  unlock: { domain: 'design', action: 'unlock', iconName: 'Unlock', icon: Unlock, label: 'Unlock' },

  // ---- Transform ----
  rotate: { domain: 'design', action: 'rotate', iconName: 'RotateCw', icon: RotateCw, label: 'Rotate' },
  mirror: { domain: 'design', action: 'mirror', iconName: 'FlipHorizontal2', icon: FlipHorizontal2, label: 'Mirror' },
  move: { domain: 'design', action: 'move', iconName: 'Move', icon: Move, label: 'Move' },
  zoom_in: { domain: 'design', action: 'zoom_in', iconName: 'ZoomIn', icon: ZoomIn, label: 'Zoom in' },
  zoom_out: { domain: 'design', action: 'zoom_out', iconName: 'ZoomOut', icon: ZoomOut, label: 'Zoom out' },
  fit_view: { domain: 'design', action: 'fit_view', iconName: 'Maximize', icon: Maximize, label: 'Fit to view' },

  // ---- Execution / simulation ----
  run: { domain: 'analysis', action: 'run', iconName: 'Play', icon: Play, label: 'Run' },
  stop: { domain: 'analysis', action: 'stop', iconName: 'Square', icon: Square, label: 'Stop' },
  pause: { domain: 'analysis', action: 'pause', iconName: 'Pause', icon: Pause, label: 'Pause' },
  simulate: { domain: 'analysis', action: 'simulate', iconName: 'Zap', icon: Zap, label: 'Simulate' },
  validate: {
    domain: 'analysis',
    action: 'validate',
    iconName: 'CheckCircle',
    icon: CheckCircle,
    label: 'Validate',
  },
  refresh: { domain: 'design', action: 'refresh', iconName: 'RefreshCw', icon: RefreshCw, label: 'Refresh' },

  // ---- Settings / info ----
  settings: { domain: 'design', action: 'settings', iconName: 'Settings', icon: Settings, label: 'Settings' },
  info: { domain: 'documentation', action: 'info', iconName: 'Info', icon: Info, label: 'Info' },
  help: { domain: 'documentation', action: 'help', iconName: 'HelpCircle', icon: HelpCircle, label: 'Help' },

  // ---- Navigation helpers ----
  expand: { domain: 'design', action: 'expand', iconName: 'ChevronRight', icon: ChevronRight, label: 'Expand' },
  collapse: { domain: 'design', action: 'collapse', iconName: 'ChevronDown', icon: ChevronDown, label: 'Collapse' },

  // ---- Status ----
  warning: {
    domain: 'analysis',
    action: 'warning',
    iconName: 'AlertTriangle',
    icon: AlertTriangle,
    label: 'Warning',
  },
  error: { domain: 'analysis', action: 'error', iconName: 'AlertCircle', icon: AlertCircle, label: 'Error' },
  success: { domain: 'analysis', action: 'success', iconName: 'CheckCircle', icon: CheckCircle, label: 'Success' },
  measure: { domain: 'design', action: 'measure', iconName: 'Ruler', icon: Ruler, label: 'Measure' },
  favorite: { domain: 'design', action: 'favorite', iconName: 'Star', icon: Star, label: 'Favorite' },
  ai_assist: { domain: 'design', action: 'ai_assist', iconName: 'Sparkles', icon: Sparkles, label: 'AI assist' },
} as const;

// ---------------------------------------------------------------------------
// Domain-specific overrides
// ---------------------------------------------------------------------------

/**
 * When a generic action has different visual meaning per domain, this map
 * provides the override. The key format is `action:domain`.
 */
const DOMAIN_OVERRIDES: Record<string, IconMapping> = {
  'run:hardware': {
    domain: 'hardware',
    action: 'run',
    iconName: 'Zap',
    icon: Zap,
    label: 'Flash / Upload',
  },
  'validate:manufacturing': {
    domain: 'manufacturing',
    action: 'validate',
    iconName: 'ShieldCheck',
    icon: ShieldCheck,
    label: 'DFM check',
  },
  'validate:design': {
    domain: 'design',
    action: 'validate',
    iconName: 'ShieldCheck',
    icon: ShieldCheck,
    label: 'DRC check',
  },
};

// ---------------------------------------------------------------------------
// Entity icon map
// ---------------------------------------------------------------------------

/**
 * Maps domain entities (nouns) to their canonical icons.
 */
const ENTITY_ICON_MAP: Record<string, IconMapping> = {
  component: {
    domain: 'design',
    action: 'component',
    iconName: 'Cpu',
    icon: Cpu,
    label: 'Component',
  },
  circuit: {
    domain: 'design',
    action: 'circuit',
    iconName: 'CircuitBoard',
    icon: CircuitBoard,
    label: 'Circuit',
  },
  bom: {
    domain: 'manufacturing',
    action: 'bom',
    iconName: 'Package',
    icon: Package,
    label: 'Bill of Materials',
  },
  document: {
    domain: 'documentation',
    action: 'document',
    iconName: 'FileText',
    icon: FileText,
    label: 'Document',
  },
  layer: {
    domain: 'design',
    action: 'layer',
    iconName: 'Layers',
    icon: Layers,
    label: 'Layer',
  },
  branch: {
    domain: 'collaboration',
    action: 'branch',
    iconName: 'GitBranch',
    icon: GitBranch,
    label: 'Branch',
  },
  ai: {
    domain: 'design',
    action: 'ai',
    iconName: 'Bot',
    icon: Bot,
    label: 'AI Assistant',
  },
  user: {
    domain: 'collaboration',
    action: 'user',
    iconName: 'Users',
    icon: Users,
    label: 'Users',
  },
  factory: {
    domain: 'manufacturing',
    action: 'factory',
    iconName: 'Factory',
    icon: Factory,
    label: 'Manufacturer',
  },
  validation: {
    domain: 'analysis',
    action: 'validation',
    iconName: 'ShieldCheck',
    icon: ShieldCheck,
    label: 'Validation',
  },
  signal: {
    domain: 'analysis',
    action: 'signal',
    iconName: 'Activity',
    icon: Activity,
    label: 'Signal',
  },
  metrics: {
    domain: 'analysis',
    action: 'metrics',
    iconName: 'BarChart3',
    icon: BarChart3,
    label: 'Metrics',
  },
  idea: {
    domain: 'documentation',
    action: 'idea',
    iconName: 'Lightbulb',
    icon: Lightbulb,
    label: 'Idea',
  },
  tool: {
    domain: 'hardware',
    action: 'tool',
    iconName: 'Wrench',
    icon: Wrench,
    label: 'Tool',
  },
  knowledge: {
    domain: 'documentation',
    action: 'knowledge',
    iconName: 'BookOpen',
    icon: BookOpen,
    label: 'Knowledge',
  },
  comment: {
    domain: 'collaboration',
    action: 'comment',
    iconName: 'MessageSquare',
    icon: MessageSquare,
    label: 'Comment',
  },
  history: {
    domain: 'design',
    action: 'history',
    iconName: 'Clock',
    icon: Clock,
    label: 'History',
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the canonical `IconMapping` for the given action verb.
 *
 * When `domain` is provided and a domain-specific override exists, that
 * override is returned instead of the generic mapping.
 *
 * Returns `undefined` if the action is not in the map.
 */
export function getIconForAction(action: string, domain?: IconDomain): IconMapping | undefined {
  if (domain) {
    const overrideKey = `${action}:${domain}`;
    const override = DOMAIN_OVERRIDES[overrideKey];
    if (override) {
      return override;
    }
  }
  return ICON_MAP[action];
}

/**
 * Returns the canonical `IconMapping` for the given entity noun.
 *
 * Returns `undefined` if the entity is not in the map.
 */
export function getIconForEntity(entity: string): IconMapping | undefined {
  return ENTITY_ICON_MAP[entity];
}

// ---------------------------------------------------------------------------
// Audit utilities
// ---------------------------------------------------------------------------

export interface IconAuditResult {
  /** True when no conflicts or duplicates were detected. */
  clean: boolean;
  /** Actions that share the exact same icon component. */
  duplicateIcons: Array<{ iconName: string; actions: string[] }>;
  /** Actions where the same action key appears in both ICON_MAP and overrides with different icons. */
  overrideConflicts: Array<{
    action: string;
    baseIconName: string;
    overrideIconName: string;
    domain: IconDomain;
  }>;
  /** Entity keys that collide with action keys (same string, different icon). */
  entityActionCollisions: Array<{
    key: string;
    actionIconName: string;
    entityIconName: string;
  }>;
}

/**
 * Audits the icon maps for consistency issues.
 *
 * - **duplicateIcons**: groups of 3+ actions sharing the same icon, which may
 *   cause user confusion. (Pairs are acceptable — e.g. close/cancel both use X.)
 * - **overrideConflicts**: domain overrides that point to the same icon as the
 *   base mapping (redundant override).
 * - **entityActionCollisions**: an entity and an action with the same key but
 *   different icons.
 */
export function auditIconConsistency(): IconAuditResult {
  // 1. Detect duplicate icons (3+ actions sharing same icon)
  const iconToActions = new Map<string, string[]>();
  for (const [action, mapping] of Object.entries(ICON_MAP)) {
    const existing = iconToActions.get(mapping.iconName);
    if (existing) {
      existing.push(action);
    } else {
      iconToActions.set(mapping.iconName, [action]);
    }
  }

  const duplicateIcons: IconAuditResult['duplicateIcons'] = [];
  for (const [iconName, actions] of Array.from(iconToActions.entries())) {
    if (actions.length >= 3) {
      duplicateIcons.push({ iconName, actions: [...actions].sort() });
    }
  }

  // 2. Detect redundant overrides (override icon === base icon)
  const overrideConflicts: IconAuditResult['overrideConflicts'] = [];
  for (const [key, override] of Object.entries(DOMAIN_OVERRIDES)) {
    const [action] = key.split(':');
    const base = ICON_MAP[action];
    if (base && base.iconName === override.iconName) {
      overrideConflicts.push({
        action,
        baseIconName: base.iconName,
        overrideIconName: override.iconName,
        domain: override.domain,
      });
    }
  }

  // 3. Entity–action collisions
  const entityActionCollisions: IconAuditResult['entityActionCollisions'] = [];
  for (const [key, entityMapping] of Object.entries(ENTITY_ICON_MAP)) {
    const actionMapping = ICON_MAP[key];
    if (actionMapping && actionMapping.iconName !== entityMapping.iconName) {
      entityActionCollisions.push({
        key,
        actionIconName: actionMapping.iconName,
        entityIconName: entityMapping.iconName,
      });
    }
  }

  const clean =
    duplicateIcons.length === 0 &&
    overrideConflicts.length === 0 &&
    entityActionCollisions.length === 0;

  return { clean, duplicateIcons, overrideConflicts, entityActionCollisions };
}

/**
 * Returns all registered action keys.
 */
export function getAllActionKeys(): string[] {
  return Object.keys(ICON_MAP);
}

/**
 * Returns all registered entity keys.
 */
export function getAllEntityKeys(): string[] {
  return Object.keys(ENTITY_ICON_MAP);
}

/**
 * Returns all registered domain override keys (format: `action:domain`).
 */
export function getAllDomainOverrideKeys(): string[] {
  return Object.keys(DOMAIN_OVERRIDES);
}
