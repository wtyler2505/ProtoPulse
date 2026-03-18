/**
 * ir-to-schematic — Convert CircuitIR into a lightweight schematic layout
 * for read-only SVG preview rendering.
 *
 * This is NOT the full interactive @xyflow schematic editor — it produces
 * simple auto-laid-out position data for the preview pane.
 */

import type { CircuitIR } from './circuit-ir';

// ---------------------------------------------------------------------------
// Layout Types
// ---------------------------------------------------------------------------

export interface PinLayout {
  name: string;
  x: number;
  y: number;
  netId: string;
}

export interface ComponentLayout {
  id: string;
  refdes: string;
  partId?: string;
  value?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: PinLayout[];
}

export interface NetSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface NetPath {
  netId: string;
  name: string;
  type: 'signal' | 'power' | 'ground';
  segments: NetSegment[];
}

export interface SchematicLayout {
  components: ComponentLayout[];
  nets: NetPath[];
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Layout Constants
// ---------------------------------------------------------------------------

const COLS_PER_ROW = 4;
const CELL_SPACING_X = 200;
const CELL_SPACING_Y = 200;
const COMPONENT_WIDTH = 120;
const MIN_COMPONENT_HEIGHT = 60;
const PIN_PAIR_HEIGHT = 20;
const PADDING = 40;

// ---------------------------------------------------------------------------
// irToSchematicLayout
// ---------------------------------------------------------------------------

/**
 * Convert a CircuitIR into a SchematicLayout with auto-positioned components
 * and Manhattan-routed net paths.
 */
export function irToSchematicLayout(ir: CircuitIR): SchematicLayout {
  if (ir.components.length === 0) {
    return { components: [], nets: [], width: 0, height: 0 };
  }

  // Build net name -> net info lookup
  const netByName = new Map<string, { id: string; type: 'signal' | 'power' | 'ground' }>();
  for (const net of ir.nets) {
    netByName.set(net.name, { id: net.id, type: net.type });
  }

  // --- Lay out components in a grid ---
  const components: ComponentLayout[] = ir.components.map((comp, index) => {
    const col = index % COLS_PER_ROW;
    const row = Math.floor(index / COLS_PER_ROW);

    const pinNames = Object.keys(comp.pins);
    const pinPairs = Math.ceil(pinNames.length / 2);
    const height = Math.max(MIN_COMPONENT_HEIGHT, pinPairs * PIN_PAIR_HEIGHT);

    const x = PADDING + col * CELL_SPACING_X;
    const y = PADDING + row * CELL_SPACING_Y;

    // Place pins on left/right edges
    const pins: PinLayout[] = pinNames.map((pinName, pinIndex) => {
      const netName = comp.pins[pinName];
      const netInfo = netByName.get(netName);
      const netId = netInfo?.id ?? '';

      // Odd-indexed pins on left, even-indexed on right
      const onLeft = pinIndex % 2 === 0;
      const pinX = onLeft ? x : x + COMPONENT_WIDTH;

      // Distribute pins vertically within component bounds
      const pinsOnSide = pinNames.filter((_, pi) => pi % 2 === (onLeft ? 0 : 1));
      const sideIndex = Math.floor(pinIndex / 2);
      const sideCount = pinsOnSide.length;
      const pinY = sideCount <= 1
        ? y + height / 2
        : y + (height / (sideCount + 1)) * (sideIndex + 1);

      return { name: pinName, x: pinX, y: pinY, netId };
    });

    return {
      id: comp.id,
      refdes: comp.refdes,
      value: comp.value,
      x,
      y,
      width: COMPONENT_WIDTH,
      height,
      pins,
    };
  });

  // --- Route nets between connected pins ---
  // Build a map of netId -> list of pin positions
  const pinsByNet = new Map<string, Array<{ x: number; y: number }>>();
  for (const comp of components) {
    for (const pin of comp.pins) {
      if (pin.netId) {
        let pins = pinsByNet.get(pin.netId);
        if (!pins) {
          pins = [];
          pinsByNet.set(pin.netId, pins);
        }
        pins.push({ x: pin.x, y: pin.y });
      }
    }
  }

  const nets: NetPath[] = ir.nets.map((net) => {
    const connectedPins = pinsByNet.get(net.id) ?? [];
    const segments: NetSegment[] = [];

    // Connect pins sequentially with Manhattan (L-shaped) routing
    for (let i = 0; i < connectedPins.length - 1; i++) {
      const from = connectedPins[i];
      const to = connectedPins[i + 1];

      // L-shaped route: horizontal first, then vertical
      const midX = (from.x + to.x) / 2;
      segments.push(
        { x1: from.x, y1: from.y, x2: midX, y2: from.y },
        { x1: midX, y1: from.y, x2: midX, y2: to.y },
        { x1: midX, y1: to.y, x2: to.x, y2: to.y },
      );
    }

    return {
      netId: net.id,
      name: net.name,
      type: net.type,
      segments,
    };
  });

  // --- Compute layout bounds ---
  let maxX = 0;
  let maxY = 0;
  for (const comp of components) {
    maxX = Math.max(maxX, comp.x + comp.width);
    maxY = Math.max(maxY, comp.y + comp.height);
  }

  return {
    components,
    nets,
    width: maxX + PADDING,
    height: maxY + PADDING,
  };
}
