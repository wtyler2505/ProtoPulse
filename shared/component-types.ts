export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  textAnchor?: string;
}

export interface BaseShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style?: ShapeStyle;
  layer?: string;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  rx?: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  cx: number;
  cy: number;
}

export interface PathShape extends BaseShape {
  type: 'path';
  d: string;
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
}

export interface GroupShape extends BaseShape {
  type: 'group';
  children: Shape[];
}

export type Shape = RectShape | CircleShape | PathShape | TextShape | GroupShape;

export interface PadSpec {
  type: 'tht' | 'smd';
  shape: 'circle' | 'rect' | 'oblong' | 'square';
  diameter?: number;
  drill?: number;
  width?: number;
  height?: number;
}

export interface TerminalPosition {
  x: number;
  y: number;
}

export interface Connector {
  id: string;
  name: string;
  description?: string;
  connectorType: 'male' | 'female' | 'pad';
  shapeIds: Record<string, string[]>;
  terminalPositions: Record<string, TerminalPosition>;
  padSpec?: PadSpec;
}

export interface Bus {
  id: string;
  name: string;
  connectorIds: string[];
}

export interface PartProperty {
  key: string;
  value: string;
  showInLabel?: boolean;
}

export interface PartMeta {
  title: string;
  family?: string;
  manufacturer?: string;
  mpn?: string;
  description?: string;
  tags: string[];
  mountingType: 'tht' | 'smd' | 'other' | '';
  packageType?: string;
  properties: PartProperty[];
  datasheetUrl?: string;
  version?: string;
  /** Optional SPICE subcircuit definition attached to this component. */
  spiceSubcircuit?: string;
}

export interface ViewData {
  shapes: Shape[];
  layerConfig?: Record<string, { visible: boolean; locked: boolean; color?: string }>;
}

export interface PartViews {
  breadboard: ViewData;
  schematic: ViewData;
  pcb: ViewData;
}

export type ConstraintType = 'distance' | 'alignment' | 'pitch' | 'symmetric' | 'equal' | 'fixed';

export interface Constraint {
  id: string;
  type: ConstraintType;
  shapeIds: string[];
  params: Record<string, number | string>;
  enabled: boolean;
}

export interface PartState {
  meta: PartMeta;
  connectors: Connector[];
  buses: Bus[];
  views: PartViews;
  constraints?: Constraint[];
}

export type DRCRuleType =
  | 'min-clearance'
  | 'min-trace-width'
  | 'courtyard-overlap'
  | 'pin-spacing'
  | 'pad-size'
  | 'silk-overlap'
  | 'annular-ring'
  | 'thermal-relief'
  | 'trace-to-edge'
  | 'via-in-pad'
  | 'solder-mask'
  | PcbDrcRuleType;

/** PCB-level DRC rule types for board-level design rule checking. */
export type PcbDrcRuleType =
  | 'trace_clearance'
  | 'trace_width_min'
  | 'trace_width_max'
  | 'via_drill_min'
  | 'via_annular_ring'
  | 'pad_clearance'
  | 'silk_clearance'
  | 'board_edge_clearance'
  | 'diff_pair_spacing'
  | 'copper_pour_clearance';

export interface DRCRule {
  type: DRCRuleType;
  params: Record<string, number>;
  severity: 'error' | 'warning';
  enabled: boolean;
}

export interface DRCViolation {
  id: string;
  ruleType: DRCRuleType;
  severity: 'error' | 'warning';
  message: string;
  shapeIds: string[];
  view: 'breadboard' | 'schematic' | 'pcb';
  location: { x: number; y: number };
  actual?: number;
  required?: number;
}

export interface ComponentValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  view?: string;
  elementId?: string;
  suggestion?: string;
}

export type EditorViewType = 'breadboard' | 'schematic' | 'pcb' | 'metadata' | 'pin-table' | 'spice';

// ---------------------------------------------------------------------------
// Mystery Part — generic black-box placeholder component
// ---------------------------------------------------------------------------

/** Which side of the rectangular body a pin is placed on. */
export type MysteryPartPinSide = 'top' | 'right' | 'bottom' | 'left';

/** Configuration for a single pin on a mystery part. */
export interface MysteryPartPin {
  /** Display label (e.g. "1", "VCC", "SDA"). */
  label: string;
  /** Which side of the body the pin sits on. */
  side: MysteryPartPinSide;
  /** Zero-based index within that side (auto-assigned by distributePins). */
  index: number;
}

/** Full configuration for a mystery part instance. */
export interface MysteryPartConfig {
  /** User-visible name for this placeholder. */
  name: string;
  /** Optional description / notes. */
  description: string;
  /** Body width in grid units. */
  bodyWidth: number;
  /** Body height in grid units. */
  bodyHeight: number;
  /** Pin definitions (2-40 pins). */
  pins: MysteryPartPin[];
}

/** Minimum allowed pin count. */
export const MYSTERY_PART_MIN_PINS = 2;
/** Maximum allowed pin count. */
export const MYSTERY_PART_MAX_PINS = 40;

/**
 * Distribute `pinCount` pins evenly across the given sides.
 *
 * Pins are assigned round-robin to the provided sides and each side's
 * pins receive sequential indices starting from 0.  Labels default to
 * the 1-based ordinal position of the pin across the whole part.
 */
export function distributePins(
  pinCount: number,
  sides: MysteryPartPinSide[] = ['left', 'right'],
): MysteryPartPin[] {
  if (pinCount < MYSTERY_PART_MIN_PINS || pinCount > MYSTERY_PART_MAX_PINS) {
    throw new RangeError(
      `Pin count must be between ${MYSTERY_PART_MIN_PINS} and ${MYSTERY_PART_MAX_PINS}, got ${pinCount}`,
    );
  }
  if (sides.length === 0) {
    throw new RangeError('At least one side must be specified');
  }

  // Track per-side index counters
  const sideCounters = new Map<MysteryPartPinSide, number>();
  for (const s of sides) {
    sideCounters.set(s, 0);
  }

  const pins: MysteryPartPin[] = [];
  for (let i = 0; i < pinCount; i++) {
    const side = sides[i % sides.length];
    const idx = sideCounters.get(side) ?? 0;
    pins.push({ label: String(i + 1), side, index: idx });
    sideCounters.set(side, idx + 1);
  }
  return pins;
}

/** Create a default mystery part configuration (4 pins, 2 left / 2 right). */
export function createDefaultMysteryPartConfig(): MysteryPartConfig {
  return {
    name: 'Mystery Part',
    description: '',
    bodyWidth: 4,
    bodyHeight: 4,
    pins: distributePins(4, ['left', 'right']),
  };
}

/**
 * Build schematic-ready connectors and shapes for a mystery part config.
 *
 * Returns objects compatible with the standard library's Connector and
 * SchematicShape types so the mystery part can be rendered identically to
 * real components on the schematic canvas.
 */
export function buildMysteryPartView(config: MysteryPartConfig): {
  connectors: Connector[];
  shapes: Shape[];
} {
  const gridPx = 30; // px per grid unit — matches standard library spacing
  const bodyW = config.bodyWidth * gridPx;
  const bodyH = config.bodyHeight * gridPx;
  const pinSize = 10;

  // Group pins by side
  const bySide = new Map<MysteryPartPinSide, MysteryPartPin[]>();
  for (const pin of config.pins) {
    const arr = bySide.get(pin.side) ?? [];
    arr.push(pin);
    bySide.set(pin.side, arr);
  }

  const connectors: Connector[] = [];
  const pinShapes: Shape[] = [];

  for (const pin of config.pins) {
    const sidePins = bySide.get(pin.side) ?? [];
    const count = sidePins.length;
    const globalIdx = config.pins.indexOf(pin);
    const pinId = `mp-pin${globalIdx}`;
    const shapeId = `${pinId}-sch`;

    let px: number;
    let py: number;
    let tx: number;
    let ty: number;

    switch (pin.side) {
      case 'left': {
        const spacing = bodyH / (count + 1);
        px = 0;
        py = spacing * (pin.index + 1) - pinSize / 2;
        tx = 0;
        ty = spacing * (pin.index + 1);
        break;
      }
      case 'right': {
        const spacing = bodyH / (count + 1);
        px = bodyW + pinSize;
        py = spacing * (pin.index + 1) - pinSize / 2;
        tx = bodyW + pinSize * 2;
        ty = spacing * (pin.index + 1);
        break;
      }
      case 'top': {
        const spacing = bodyW / (count + 1);
        px = spacing * (pin.index + 1) + pinSize - pinSize / 2;
        py = 0;
        tx = spacing * (pin.index + 1) + pinSize;
        ty = 0;
        break;
      }
      case 'bottom': {
        const spacing = bodyW / (count + 1);
        px = spacing * (pin.index + 1) + pinSize - pinSize / 2;
        py = bodyH + pinSize;
        tx = spacing * (pin.index + 1) + pinSize;
        ty = bodyH + pinSize * 2;
        break;
      }
    }

    connectors.push({
      id: pinId,
      name: pin.label,
      description: `Pin ${globalIdx + 1} — ${pin.label}`,
      connectorType: 'pad',
      shapeIds: { schematic: [shapeId] },
      terminalPositions: { schematic: { x: tx, y: ty } },
      padSpec: { type: 'tht', shape: 'circle', diameter: 1.6, drill: 0.8 },
    });

    pinShapes.push({
      id: shapeId,
      type: 'rect',
      x: px,
      y: py,
      width: pinSize,
      height: pinSize,
      rotation: 0,
      style: { fill: '#C0C0C0', stroke: '#000000', strokeWidth: 1 },
    } as RectShape);
  }

  const bodyShape: RectShape = {
    id: 'body-sch',
    type: 'rect',
    x: pinSize,
    y: 0,
    width: bodyW,
    height: bodyH,
    rotation: 0,
    style: { fill: '#2A2A2A', stroke: '#00F0FF', strokeWidth: 2 },
  };

  const labelShape: TextShape = {
    id: 'label-sch',
    type: 'text',
    x: pinSize + bodyW / 2 - 30,
    y: bodyH / 2,
    width: 60,
    height: 14,
    rotation: 0,
    text: config.name || '?',
    style: { fontSize: 10, fontFamily: 'monospace', textAnchor: 'middle' },
  };

  return {
    connectors,
    shapes: [bodyShape, labelShape, ...pinShapes],
  };
}

export function createDefaultPartMeta(): PartMeta {
  return {
    title: '',
    tags: [],
    mountingType: '',
    properties: [],
  };
}

export function createDefaultViewData(): ViewData {
  return {
    shapes: [],
  };
}

export function createDefaultPartState(): PartState {
  return {
    meta: createDefaultPartMeta(),
    connectors: [],
    buses: [],
    views: {
      breadboard: createDefaultViewData(),
      schematic: createDefaultViewData(),
      pcb: createDefaultViewData(),
    },
  };
}
