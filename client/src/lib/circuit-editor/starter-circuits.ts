/**
 * Pre-wired starter circuit templates — S6-06
 *
 * Four ready-to-place breadboard circuits for new users:
 *   1. LED + resistor (beginner)
 *   2. Voltage divider (beginner)
 *   3. Button + LED (intermediate)
 *   4. H-bridge motor driver (advanced)
 *
 * Each template produces arrays of instance and wire data compatible
 * with the circuit schema. Coordinates are absolute breadboard pixel
 * positions computed via `coordToPixel`.
 */

import { coordToPixel, type ColumnLetter } from './breadboard-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StarterCircuitId = 'led-basic' | 'voltage-divider' | 'button-led' | 'h-bridge';

export interface StarterInstance {
  referenceDesignator: string;
  breadboardX: number;
  breadboardY: number;
  breadboardRotation: number;
  properties: Record<string, unknown>;
}

export interface StarterWire {
  view: 'breadboard';
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
}

export interface StarterCircuit {
  id: StarterCircuitId;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instances: StarterInstance[];
  wires: StarterWire[];
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Shorthand to get pixel coords for a terminal-strip hole. */
function tp(col: ColumnLetter, row: number): { x: number; y: number } {
  return coordToPixel({ type: 'terminal', col, row });
}

/** Shorthand to get pixel coords for a power-rail point. */
function rp(rail: 'top_pos' | 'top_neg' | 'bottom_pos' | 'bottom_neg', index: number): { x: number; y: number } {
  return coordToPixel({ type: 'rail', rail, index });
}

/** Create a wire between two breadboard coordinates. */
function wire(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color = '#2ecc71',
  width = 1.5,
): StarterWire {
  return {
    view: 'breadboard',
    points: [{ ...from }, { ...to }],
    color,
    width,
  };
}

// ---------------------------------------------------------------------------
// Circuit definitions
// ---------------------------------------------------------------------------

function buildLedBasic(): StarterCircuit {
  // LED + 220Ω resistor circuit
  // Resistor R1: row 10, columns a-d (spans 4 holes)
  // LED D1: row 10 column e to row 10 column f (straddles gap... no)
  // Actually: resistor from a10 to d10, LED anode at e10, cathode at e15
  // Wire from power rail to a10, from d10 net to e10, from e15 to GND rail
  //
  // Layout:
  //   VCC rail → wire to a10
  //   R1 at a10 (pin1) to a14 (pin2)  — 4-row span axial resistor
  //   Wire from b14 to b17 (connect R1 output to LED anode row)
  //   LED D1 at a17 (anode) to a20 (cathode) — 3-row span
  //   Wire from b20 to GND rail

  const r1Pos = tp('a', 10);
  const d1Pos = tp('a', 17);

  return {
    id: 'led-basic',
    name: 'LED + Resistor',
    description: 'A simple LED circuit with a 220\u03A9 current-limiting resistor. Connect to 5V and GND.',
    difficulty: 'beginner',
    instances: [
      {
        referenceDesignator: 'R1',
        breadboardX: r1Pos.x,
        breadboardY: r1Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'resistor',
          value: '220\u03A9',
          pinCount: 2,
          rowSpan: 4,
        },
      },
      {
        referenceDesignator: 'D1',
        breadboardX: d1Pos.x,
        breadboardY: d1Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'led',
          color: 'red',
          pinCount: 2,
          rowSpan: 3,
        },
      },
    ],
    wires: [
      // VCC rail to R1 pin 1
      wire(rp('top_pos', 9), tp('a', 10), '#e74c3c', 1.5),
      // R1 pin 2 to LED anode row
      wire(tp('b', 14), tp('b', 17), '#2ecc71', 1.5),
      // LED cathode to GND rail
      wire(tp('b', 20), rp('top_neg', 19), '#1a1a2e', 1.5),
    ],
  };
}

function buildVoltageDivider(): StarterCircuit {
  // Two resistors in series forming a voltage divider
  // R1: a5 to a9 (4-row span)
  // R2: a12 to a16 (4-row span)
  // Wire from VCC to R1 top, R1 bottom to R2 top (output tap), R2 bottom to GND

  const r1Pos = tp('a', 5);
  const r2Pos = tp('a', 12);

  return {
    id: 'voltage-divider',
    name: 'Voltage Divider',
    description: 'Two resistors dividing an input voltage. Output at the junction between R1 and R2.',
    difficulty: 'beginner',
    instances: [
      {
        referenceDesignator: 'R1',
        breadboardX: r1Pos.x,
        breadboardY: r1Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'resistor',
          value: '10k\u03A9',
          pinCount: 2,
          rowSpan: 4,
        },
      },
      {
        referenceDesignator: 'R2',
        breadboardX: r2Pos.x,
        breadboardY: r2Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'resistor',
          value: '10k\u03A9',
          pinCount: 2,
          rowSpan: 4,
        },
      },
    ],
    wires: [
      // VCC to R1 top
      wire(rp('top_pos', 4), tp('a', 5), '#e74c3c', 1.5),
      // R1 bottom to R2 top (junction)
      wire(tp('b', 9), tp('b', 12), '#f1c40f', 1.5),
      // R2 bottom to GND
      wire(tp('b', 16), rp('top_neg', 15), '#1a1a2e', 1.5),
      // Output tap wire (junction to right side for measurement)
      wire(tp('c', 9), tp('c', 12), '#3498db', 1.5),
    ],
  };
}

function buildButtonLed(): StarterCircuit {
  // Tactile button controlling an LED through a resistor
  // Button SW1: straddles channel at e25/f25 to e27/f27
  // Resistor R1: a30 to a34
  // LED D1: a37 to a40
  // Wires: VCC → button, button → resistor, resistor → LED, LED → GND

  const sw1Pos = tp('e', 25);
  const r1Pos = tp('a', 30);
  const d1Pos = tp('a', 37);

  return {
    id: 'button-led',
    name: 'Button + LED',
    description: 'Press a tactile button to light an LED. Demonstrates digital input controlling output.',
    difficulty: 'intermediate',
    instances: [
      {
        referenceDesignator: 'SW1',
        breadboardX: sw1Pos.x,
        breadboardY: sw1Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'button',
          pinCount: 4,
          rowSpan: 2,
          crossesChannel: true,
        },
      },
      {
        referenceDesignator: 'R1',
        breadboardX: r1Pos.x,
        breadboardY: r1Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'resistor',
          value: '220\u03A9',
          pinCount: 2,
          rowSpan: 4,
        },
      },
      {
        referenceDesignator: 'D1',
        breadboardX: d1Pos.x,
        breadboardY: d1Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'led',
          color: 'green',
          pinCount: 2,
          rowSpan: 3,
        },
      },
    ],
    wires: [
      // VCC to button input
      wire(rp('top_pos', 24), tp('a', 25), '#e74c3c', 1.5),
      // Button output to resistor input
      wire(tp('g', 27), tp('g', 30), '#2ecc71', 1.5),
      wire(tp('a', 30), tp('b', 30), '#f1c40f', 1.0),
      // Resistor output to LED anode
      wire(tp('b', 34), tp('b', 37), '#2ecc71', 1.5),
      // LED cathode to GND
      wire(tp('b', 40), rp('top_neg', 39), '#1a1a2e', 1.5),
    ],
  };
}

function buildHBridge(): StarterCircuit {
  // L293D H-bridge motor driver IC with DC motor
  // IC U1: DIP-16 straddling center channel at rows 5-12 (8 rows, e/f)
  // Motor M1: represented as 2-pin component at f15-f17
  // Wires: VCC, GND, enable, input, motor outputs

  const u1Pos = tp('e', 5);
  const m1Pos = tp('f', 15);

  return {
    id: 'h-bridge',
    name: 'H-Bridge Motor Driver',
    description: 'L293D IC driving a DC motor with direction control. Enable and two input pins select direction.',
    difficulty: 'advanced',
    instances: [
      {
        referenceDesignator: 'U1',
        breadboardX: u1Pos.x,
        breadboardY: u1Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'ic',
          partNumber: 'L293D',
          pinCount: 16,
          rowSpan: 8,
          crossesChannel: true,
        },
      },
      {
        referenceDesignator: 'M1',
        breadboardX: m1Pos.x,
        breadboardY: m1Pos.y,
        breadboardRotation: 0,
        properties: {
          componentType: 'motor',
          type: 'dc',
          pinCount: 2,
          rowSpan: 2,
        },
      },
    ],
    wires: [
      // VCC (pin 16, VS) — top-right of IC at f5
      wire(rp('top_pos', 4), tp('g', 5), '#e74c3c', 1.5),
      // GND (pins 4,5,12,13 — row 8/9 left side)
      wire(tp('d', 8), rp('top_neg', 7), '#1a1a2e', 1.5),
      wire(tp('d', 9), rp('top_neg', 8), '#1a1a2e', 1.5),
      // Enable (pin 1 — d5) — wire from VCC for always-on
      wire(rp('top_pos', 4), tp('d', 5), '#e74c3c', 1.0),
      // Motor output 1 (pin 3 — d7) to motor terminal
      wire(tp('g', 7), tp('g', 15), '#e67e22', 1.5),
      // Motor output 2 (pin 6 — d10) to motor terminal
      wire(tp('g', 10), tp('g', 17), '#e67e22', 1.5),
      // Input 1 (pin 2 — d6) — signal wire
      wire(tp('d', 6), tp('a', 6), '#3498db', 1.5),
      // Input 2 (pin 7 — d11) — signal wire
      wire(tp('d', 11), tp('a', 11), '#3498db', 1.5),
    ],
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const CIRCUIT_BUILDERS: Record<StarterCircuitId, () => StarterCircuit> = {
  'led-basic': buildLedBasic,
  'voltage-divider': buildVoltageDivider,
  'button-led': buildButtonLed,
  'h-bridge': buildHBridge,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return all available starter circuit IDs. */
export function getStarterCircuitIds(): StarterCircuitId[] {
  return Object.keys(CIRCUIT_BUILDERS) as StarterCircuitId[];
}

/**
 * Get a starter circuit template by ID.
 * Returns a fresh deep copy each call — safe to mutate.
 */
export function getStarterCircuit(id: StarterCircuitId): StarterCircuit {
  const builder = CIRCUIT_BUILDERS[id];
  if (!builder) {
    throw new Error(`Unknown starter circuit: ${id}`);
  }
  // Builder creates fresh objects each call, but deep-clone for safety
  const circuit = builder();
  return {
    ...circuit,
    instances: circuit.instances.map((inst) => ({
      ...inst,
      properties: { ...inst.properties },
    })),
    wires: circuit.wires.map((w) => ({
      ...w,
      points: w.points.map((p) => ({ ...p })),
    })),
  };
}
