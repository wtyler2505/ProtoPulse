/**
 * Canvas Accessibility — aria-label generators and live-region announcer
 * for SchematicCanvas, BreadboardView, and PCBLayoutView.
 *
 * BL-0326: Screen-reader labels for canvas actions
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canvas view types */
export type CanvasView = 'schematic' | 'breadboard' | 'pcb';

/** Entity types that can appear on any canvas */
export type CanvasEntityType =
  | 'component'
  | 'wire'
  | 'net'
  | 'via'
  | 'zone'
  | 'trace'
  | 'power-symbol'
  | 'net-label'
  | 'annotation'
  | 'comment'
  | 'no-connect';

/** Actions that can be performed on canvas entities */
export type CanvasAction =
  | 'select'
  | 'deselect'
  | 'move'
  | 'rotate'
  | 'delete'
  | 'add'
  | 'connect'
  | 'disconnect'
  | 'start-wire'
  | 'finish-wire'
  | 'cancel'
  | 'copy'
  | 'paste'
  | 'rename'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'undo'
  | 'redo'
  | 'toggle-layer'
  | 'tool-change';

/** Options for generating an entity aria-label */
export interface AriaLabelOptions {
  entityType: CanvasEntityType;
  /** Display label (e.g., reference designator "R1", net name "GND") */
  label?: string;
  /** Extra context (e.g., "100 ohm resistor", "pin 3") */
  detail?: string;
  /** Position on canvas */
  position?: { x: number; y: number };
  /** Whether the entity is currently selected */
  selected?: boolean;
  /** The view context */
  view?: CanvasView;
}

/** Options for generating an action announcement */
export interface AnnouncementOptions {
  action: CanvasAction;
  entityType?: CanvasEntityType;
  /** Display label of the entity acted upon */
  label?: string;
  /** Extra detail */
  detail?: string;
  /** View context */
  view?: CanvasView;
}

/** Tool names used across canvases */
export type CanvasTool =
  | 'select'
  | 'wire'
  | 'trace'
  | 'delete'
  | 'pan'
  | 'draw-net'
  | 'place-power'
  | 'place-net-label'
  | 'place-annotation'
  | 'place-no-connect'
  | 'via'
  | 'zone'
  | 'comment'
  | 'component';

// ---------------------------------------------------------------------------
// Label Generators
// ---------------------------------------------------------------------------

const ENTITY_LABELS: Record<CanvasEntityType, string> = {
  'component': 'Component',
  'wire': 'Wire',
  'net': 'Net',
  'via': 'Via',
  'zone': 'Zone',
  'trace': 'Trace',
  'power-symbol': 'Power symbol',
  'net-label': 'Net label',
  'annotation': 'Annotation',
  'comment': 'Comment',
  'no-connect': 'No-connect marker',
};

const VIEW_LABELS: Record<CanvasView, string> = {
  schematic: 'Schematic',
  breadboard: 'Breadboard',
  pcb: 'PCB layout',
};

const ACTION_VERBS: Record<CanvasAction, string> = {
  'select': 'Selected',
  'deselect': 'Deselected',
  'move': 'Moved',
  'rotate': 'Rotated',
  'delete': 'Deleted',
  'add': 'Added',
  'connect': 'Connected',
  'disconnect': 'Disconnected',
  'start-wire': 'Started drawing wire',
  'finish-wire': 'Finished wire',
  'cancel': 'Cancelled',
  'copy': 'Copied',
  'paste': 'Pasted',
  'rename': 'Renamed',
  'zoom-in': 'Zoomed in',
  'zoom-out': 'Zoomed out',
  'zoom-reset': 'Zoom reset',
  'undo': 'Undo',
  'redo': 'Redo',
  'toggle-layer': 'Toggled layer',
  'tool-change': 'Switched tool',
};

const TOOL_LABELS: Record<CanvasTool, string> = {
  select: 'Select',
  wire: 'Wire drawing',
  trace: 'Trace routing',
  delete: 'Delete',
  pan: 'Pan',
  'draw-net': 'Draw net',
  'place-power': 'Place power symbol',
  'place-net-label': 'Place net label',
  'place-annotation': 'Place annotation',
  'place-no-connect': 'Place no-connect marker',
  via: 'Place via',
  zone: 'Draw zone',
  comment: 'Add comment',
  component: 'Place component',
};

/**
 * Generate an aria-label for a canvas entity.
 *
 * Examples:
 * - "Component R1, 100 ohm resistor, selected"
 * - "Wire GND at position 120, 340"
 * - "Via at position 50, 60 on PCB layout"
 */
export function getAriaLabel(options: AriaLabelOptions): string {
  const { entityType, label, detail, position, selected, view } = options;
  const parts: string[] = [];

  // Entity type
  parts.push(ENTITY_LABELS[entityType]);

  // Name/label
  if (label) {
    parts.push(label);
  }

  // Detail (e.g., "100 ohm resistor")
  if (detail) {
    parts.push(detail);
  }

  // Position
  if (position) {
    parts.push(`at position ${Math.round(position.x)}, ${Math.round(position.y)}`);
  }

  // View context
  if (view) {
    parts.push(`on ${VIEW_LABELS[view]}`);
  }

  // Selection state
  if (selected) {
    parts.push('selected');
  }

  return parts.join(', ');
}

/**
 * Generate an announcement string for a canvas action (used with aria-live).
 *
 * Examples:
 * - "Selected Component R1"
 * - "Deleted Wire GND"
 * - "Started drawing wire on Schematic"
 * - "Switched tool to Trace routing"
 */
export function getActionAnnouncement(options: AnnouncementOptions): string {
  const { action, entityType, label, detail, view } = options;
  const parts: string[] = [];

  // Action verb
  parts.push(ACTION_VERBS[action]);

  // Entity type + label
  if (entityType) {
    const entityLabel = ENTITY_LABELS[entityType];
    if (label) {
      parts.push(`${entityLabel} ${label}`);
    } else {
      parts.push(entityLabel.toLowerCase());
    }
  }

  // Detail
  if (detail) {
    parts.push(detail);
  }

  // View context (only for certain actions where it matters)
  if (view && !entityType) {
    parts.push(`on ${VIEW_LABELS[view]}`);
  }

  return parts.join(' ');
}

/**
 * Generate an announcement for a tool change.
 */
export function getToolChangeAnnouncement(tool: CanvasTool, view?: CanvasView): string {
  const toolLabel = TOOL_LABELS[tool];
  const viewLabel = view ? ` on ${VIEW_LABELS[view]}` : '';
  return `Switched tool to ${toolLabel}${viewLabel}`;
}

/**
 * Generate an aria-label for the canvas container.
 */
export function getCanvasAriaLabel(view: CanvasView, circuitName?: string): string {
  const viewLabel = VIEW_LABELS[view];
  if (circuitName) {
    return `${viewLabel} canvas for ${circuitName}. Use keyboard shortcuts for navigation.`;
  }
  return `${viewLabel} canvas. Use keyboard shortcuts for navigation.`;
}

/**
 * Generate an aria-label for a toolbar tool button.
 */
export function getToolButtonAriaLabel(tool: CanvasTool, active: boolean, shortcut?: string): string {
  const toolLabel = TOOL_LABELS[tool];
  const activeLabel = active ? ', active' : '';
  const shortcutLabel = shortcut ? `. Shortcut: ${shortcut}` : '';
  return `${toolLabel} tool${activeLabel}${shortcutLabel}`;
}

/**
 * Generate a zoom level announcement.
 */
export function getZoomAnnouncement(zoomLevel: number, action: 'zoom-in' | 'zoom-out' | 'zoom-reset'): string {
  const verb = ACTION_VERBS[action];
  return `${verb} to ${zoomLevel.toFixed(1)}x`;
}

/**
 * Generate an aria-label for a wire/trace with endpoint info.
 */
export function getWireAriaLabel(options: {
  netName?: string;
  pointCount: number;
  selected?: boolean;
  view?: CanvasView;
}): string {
  const { netName, pointCount, selected, view } = options;
  const parts: string[] = ['Wire'];
  if (netName) {
    parts.push(`on net ${netName}`);
  }
  parts.push(`with ${pointCount} points`);
  if (view) {
    parts.push(`on ${VIEW_LABELS[view]}`);
  }
  if (selected) {
    parts.push('selected');
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// CanvasAnnouncer — manages an aria-live region for canvas announcements
// ---------------------------------------------------------------------------

/**
 * CanvasAnnouncer creates and manages an invisible aria-live region
 * that announces canvas actions to screen readers.
 *
 * Usage:
 *   const announcer = new CanvasAnnouncer();
 *   announcer.announce('Selected Component R1');
 *   // Later...
 *   announcer.destroy();
 *
 * Or use the React hook `useCanvasAnnouncer()`.
 */
export class CanvasAnnouncer {
  private liveRegion: HTMLDivElement | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('data-testid', 'canvas-announcer');
    // Visually hidden but accessible to screen readers
    Object.assign(this.liveRegion.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    document.body.appendChild(this.liveRegion);
  }

  /**
   * Announce a message to screen readers via the aria-live region.
   * Clears after 1 second to allow repeated identical announcements.
   */
  announce(message: string): void {
    if (!this.liveRegion) {
      return;
    }
    // Clear first to force re-announcement even for identical messages
    this.liveRegion.textContent = '';
    if (this.timerId) {
      clearTimeout(this.timerId);
    }
    // Use a microtask to ensure the clear is processed before the new message
    requestAnimationFrame(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = message;
      }
    });
    // Clear after 1 second to allow repeats
    this.timerId = setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = '';
      }
    }, 1000);
  }

  /**
   * Remove the live region from the DOM.
   */
  destroy(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.liveRegion) {
      this.liveRegion.remove();
      this.liveRegion = null;
    }
  }

  /**
   * Get the current announcement text (for testing).
   */
  getCurrentMessage(): string {
    return this.liveRegion?.textContent ?? '';
  }
}
