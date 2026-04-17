/**
 * Standard Component Library — 120+ real-world components for ProtoPulse.
 *
 * Each entry conforms to the InsertComponentLibrary shape from shared/schema.ts
 * minus id, downloadCount, createdAt, updatedAt (auto-generated) and isPublic
 * (always true when seeding).
 *
 * Categories: Logic ICs, Passives, Microcontrollers, Power, Op-Amps, Transistors,
 * Diodes, LEDs, Connectors, Displays & UI, Sensors, Communication Modules.
 */

import type { ComponentCategory } from './component-categories';

// ---------------------------------------------------------------------------
// Types — we define our own shape to avoid coupling to Drizzle insert schema
// which uses jsonb (unknown). The seed route will cast as needed.
// ---------------------------------------------------------------------------

interface PinDef {
  name: string;
  type: 'power' | 'io' | 'input' | 'output' | 'gnd';
}

interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  textAnchor?: string;
}

interface SchematicShape {
  id: string;
  type: 'rect' | 'circle' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  style: ShapeStyle;
}

interface Connector {
  id: string;
  name: string;
  description: string;
  connectorType: 'pad';
  shapeIds: { schematic: string[] };
  terminalPositions: { schematic: { x: number; y: number } };
  padSpec: { type: 'tht'; shape: 'circle'; diameter: number; drill: number };
}

export interface StandardComponentDef {
  title: string;
  description: string;
  category: ComponentCategory;
  tags: string[];
  meta: Record<string, unknown>;
  connectors: Connector[];
  buses: unknown[];
  views: { schematic: { shapes: SchematicShape[] } };
  constraints: unknown[];
}

// ---------------------------------------------------------------------------
// Helper: build a minimal DIP-style schematic view (generic IC box)
// ---------------------------------------------------------------------------

function buildDipView(leftPins: PinDef[], rightPins: PinDef[], label: string): {
  connectors: Connector[];
  views: { schematic: { shapes: SchematicShape[] } };
} {
  const rowCount = Math.max(leftPins.length, rightPins.length);
  const bodyH = Math.max(rowCount * 30 + 20, 80);
  const bodyW = 120;

  const connectors: Connector[] = [
    ...leftPins.map((p, i) => ({
      id: `pin${i + 1}`,
      name: p.name,
      description: `Pin ${i + 1} — ${p.name} (${p.type})`,
      connectorType: 'pad' as const,
      shapeIds: { schematic: [`pin${i + 1}-sch`] },
      terminalPositions: { schematic: { x: 0, y: 20 + i * 30 } },
      padSpec: { type: 'tht' as const, shape: 'circle' as const, diameter: 1.6, drill: 0.8 },
    })),
    ...rightPins.map((p, i) => {
      const idx = leftPins.length + i;
      return {
        id: `pin${idx + 1}`,
        name: p.name,
        description: `Pin ${idx + 1} — ${p.name} (${p.type})`,
        connectorType: 'pad' as const,
        shapeIds: { schematic: [`pin${idx + 1}-sch`] },
        terminalPositions: { schematic: { x: bodyW + 20, y: 20 + i * 30 } },
        padSpec: { type: 'tht' as const, shape: 'circle' as const, diameter: 1.6, drill: 0.8 },
      };
    }),
  ];

  const pinShapes: SchematicShape[] = [
    ...leftPins.map((_, i) => ({
      id: `pin${i + 1}-sch`,
      type: 'rect' as const,
      x: 0,
      y: 15 + i * 30,
      width: 10,
      height: 10,
      rotation: 0,
      style: { fill: '#C0C0C0', stroke: '#000000', strokeWidth: 1 },
    })),
    ...rightPins.map((_, i) => {
      const idx = leftPins.length + i;
      return {
        id: `pin${idx + 1}-sch`,
        type: 'rect' as const,
        x: bodyW + 10,
        y: 15 + i * 30,
        width: 10,
        height: 10,
        rotation: 0,
        style: { fill: '#C0C0C0', stroke: '#000000', strokeWidth: 1 },
      };
    }),
  ];

  return {
    connectors,
    views: {
      schematic: {
        shapes: [
          {
            id: 'body-sch',
            type: 'rect' as const,
            x: 10,
            y: 0,
            width: bodyW,
            height: bodyH,
            rotation: 0,
            style: { fill: '#FFFFFF', stroke: '#000000', strokeWidth: 2 },
          },
          {
            id: 'label-sch',
            type: 'text' as const,
            x: 10 + bodyW / 2 - 30,
            y: bodyH / 2,
            width: 60,
            height: 14,
            rotation: 0,
            text: label,
            style: { fontSize: 10, fontFamily: 'monospace', textAnchor: 'middle' },
          },
          ...pinShapes,
        ],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: two-terminal passive (resistor, capacitor, inductor, diode, LED)
// ---------------------------------------------------------------------------

function buildTwoTerminalView(label: string) {
  return buildDipView(
    [{ name: '1', type: 'io' }],
    [{ name: '2', type: 'io' }],
    label,
  );
}

// ---------------------------------------------------------------------------
// Helper: three-terminal (transistor, regulator)
// ---------------------------------------------------------------------------

function buildThreeTerminalView(pins: [PinDef, PinDef, PinDef], label: string) {
  return buildDipView(
    [pins[0]],
    [pins[1], pins[2]],
    label,
  );
}

// ---------------------------------------------------------------------------
// Component definitions by category
// ---------------------------------------------------------------------------

function ic(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Logic ICs', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function passive(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Passives', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function mcu(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Microcontrollers', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function power(title: string, description: string, tags: string[], meta: Record<string, unknown>, pins: [PinDef, PinDef, PinDef], label: string): StandardComponentDef {
  const view = buildThreeTerminalView(pins, label);
  return { title, description, category: 'Power', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function opamp(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Op-Amps', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function transistor(title: string, description: string, tags: string[], meta: Record<string, unknown>, pins: [PinDef, PinDef, PinDef], label: string): StandardComponentDef {
  const view = buildThreeTerminalView(pins, label);
  return { title, description, category: 'Transistors', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function diode(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Diodes', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function led(color: string, wavelength: string, mpn: string): StandardComponentDef {
  const view = buildTwoTerminalView(`${color[0]}LED`);
  return {
    title: `${color} LED`,
    description: `${color} LED, 5mm, ${wavelength}, 20mA typical`,
    category: 'LEDs',
    tags: ['LED', color.toLowerCase(), '5mm', 'indicator'],
    meta: { manufacturer: 'Broadcom', mpn, mountingType: 'tht', wavelength },
    connectors: view.connectors, buses: [], views: view.views, constraints: [],
  };
}

function connector(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Connectors', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function display(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Displays & UI', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function sensor(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Sensors', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

function comm(title: string, description: string, tags: string[], meta: Record<string, unknown>, label: string): StandardComponentDef {
  const view = buildTwoTerminalView(label);
  return { title, description, category: 'Communication', tags, meta, connectors: view.connectors, buses: [], views: view.views, constraints: [] };
}

// --- BJT pin set helpers ---
const NPN_PINS: [PinDef, PinDef, PinDef] = [{ name: 'E', type: 'io' }, { name: 'B', type: 'input' }, { name: 'C', type: 'output' }];
const PNP_PINS: [PinDef, PinDef, PinDef] = [{ name: 'E', type: 'io' }, { name: 'B', type: 'input' }, { name: 'C', type: 'output' }];
const FET_PINS: [PinDef, PinDef, PinDef] = [{ name: 'S', type: 'io' }, { name: 'G', type: 'input' }, { name: 'D', type: 'output' }];
const REG_PINS: [PinDef, PinDef, PinDef] = [{ name: 'IN', type: 'input' }, { name: 'GND', type: 'gnd' }, { name: 'OUT', type: 'output' }];
const ADJ_REG_PINS: [PinDef, PinDef, PinDef] = [{ name: 'IN', type: 'input' }, { name: 'ADJ', type: 'io' }, { name: 'OUT', type: 'output' }];

// ---------------------------------------------------------------------------
// 74xx Logic ICs (11)
// ---------------------------------------------------------------------------
const LOGIC_ICS: StandardComponentDef[] = [
  ic('7400 — Quad 2-Input NAND', 'Quad 2-input NAND gate, 14-pin DIP', ['74xx', 'NAND', 'gate', 'DIP-14', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC00N', mountingType: 'tht', packageType: 'DIP-14', dimensions: {'length':19.3,'width':6.4,'height':3.3} }, '7400'),
  ic('7402 — Quad 2-Input NOR', 'Quad 2-input NOR gate, 14-pin DIP', ['74xx', 'NOR', 'gate', 'DIP-14', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC02N' }, '7402'),
  ic('7404 — Hex Inverter', 'Hex inverter (NOT gate), 14-pin DIP', ['74xx', 'NOT', 'inverter', 'DIP-14', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC04N' }, '7404'),
  ic('7408 — Quad 2-Input AND', 'Quad 2-input AND gate, 14-pin DIP', ['74xx', 'AND', 'gate', 'DIP-14', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC08N' }, '7408'),
  ic('7432 — Quad 2-Input OR', 'Quad 2-input OR gate, 14-pin DIP', ['74xx', 'OR', 'gate', 'DIP-14', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC32N' }, '7432'),
  ic('7486 — Quad 2-Input XOR', 'Quad 2-input XOR gate, 14-pin DIP', ['74xx', 'XOR', 'gate', 'DIP-14', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC86N' }, '7486'),
  ic('74HC595 — 8-Bit Shift Register', '8-bit serial-in parallel-out shift register with output latch, 16-pin DIP', ['74xx', 'shift register', 'serial', 'DIP-16', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC595N' }, '595'),
  ic('74HC165 — 8-Bit Parallel-In Shift Register', '8-bit parallel-in serial-out shift register, 16-pin DIP', ['74xx', 'shift register', 'parallel', 'DIP-16', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC165N' }, '165'),
  ic('74HC138 — 3-to-8 Decoder', '3-to-8 line decoder/demultiplexer, 16-pin DIP', ['74xx', 'decoder', 'demux', 'DIP-16', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC138N' }, '138'),
  ic('74HC245 — Octal Bus Transceiver', 'Octal bus transceiver with 3-state outputs, 20-pin DIP', ['74xx', 'buffer', 'transceiver', 'DIP-20', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC245N' }, '245'),
  ic('74HC00 — Quad 2-Input NAND (HC)', 'High-speed CMOS quad 2-input NAND gate, 14-pin DIP', ['74xx', 'NAND', 'CMOS', 'DIP-14', 'logic'], { manufacturer: 'Texas Instruments', mpn: 'SN74HC00N' }, 'HC00'),
];

// ---------------------------------------------------------------------------
// Passives: Resistors E24 (10) + Capacitors (4) + Inductors (2) = 16
// ---------------------------------------------------------------------------
const RESISTORS: StandardComponentDef[] = [
  { value: '100\u03A9', mpn: 'MFR-25FBF52-100R' },
  { value: '220\u03A9', mpn: 'MFR-25FBF52-220R' },
  { value: '470\u03A9', mpn: 'MFR-25FBF52-470R' },
  { value: '1k\u03A9', mpn: 'MFR-25FBF52-1K' },
  { value: '2.2k\u03A9', mpn: 'MFR-25FBF52-2K2' },
  { value: '4.7k\u03A9', mpn: 'MFR-25FBF52-4K7' },
  { value: '10k\u03A9', mpn: 'MFR-25FBF52-10K' },
  { value: '22k\u03A9', mpn: 'MFR-25FBF52-22K' },
  { value: '47k\u03A9', mpn: 'MFR-25FBF52-47K' },
  { value: '100k\u03A9', mpn: 'MFR-25FBF52-100K' },
  { value: '330\u03A9', mpn: 'MFR-25FBF52-330R' },
  { value: '680\u03A9', mpn: 'MFR-25FBF52-680R' },
  { value: '3.3k\u03A9', mpn: 'MFR-25FBF52-3K3' },
  { value: '6.8k\u03A9', mpn: 'MFR-25FBF52-6K8' },
  { value: '1M\u03A9', mpn: 'MFR-25FBF52-1M' },
  { value: '10M\u03A9', mpn: 'MFR-25FBF52-10M' },
].map(({ value, mpn }) =>
  passive(`Resistor ${value}`, `${value} metal film resistor, 1/4W, 1%, axial`, ['resistor', 'passive', 'axial', '1/4W', value], { manufacturer: 'Yageo', mpn, mountingType: 'tht', packageType: 'Axial', value }, value),
);

const CAPACITORS: StandardComponentDef[] = [
  passive('Capacitor 22pF', '22pF ceramic capacitor, 50V, C0G/NP0', ['capacitor', 'passive', '22pF'], { manufacturer: 'Murata', mpn: 'K220J15C0GF5TL2', value: '22pF' }, '22pF'),
  passive('Capacitor 100nF', '100nF ceramic capacitor, 50V, X7R (bypass)', ['capacitor', 'passive', '100nF', 'bypass'], { manufacturer: 'Murata', mpn: 'K104K15X7RF5TL2', value: '100nF' }, '100nF'),
  passive('Capacitor 10\u03BCF', '10\u03BCF ceramic capacitor, 25V, X5R', ['capacitor', 'passive', '10\u03BCF'], { manufacturer: 'Murata', mpn: 'GRM31CR61E106KA12L', value: '10\u03BCF' }, '10\u03BCF'),
  passive('Capacitor 100\u03BCF', '100\u03BCF electrolytic capacitor, 25V, radial', ['capacitor', 'passive', '100\u03BCF', 'electrolytic'], { manufacturer: 'Nichicon', mpn: 'UVR1E101MPD', value: '100\u03BCF' }, '100\u03BCF'),
];

const INDUCTORS: StandardComponentDef[] = [
  passive('Inductor 10\u03BCH', '10\u03BCH radial inductor, 1A', ['inductor', 'passive', '10\u03BCH'], { manufacturer: 'Bourns', mpn: 'RLB0914-100KL', value: '10\u03BCH' }, '10\u03BCH'),
  passive('Inductor 100\u03BCH', '100\u03BCH radial inductor, 0.5A', ['inductor', 'passive', '100\u03BCH'], { manufacturer: 'Bourns', mpn: 'RLB0914-101KL', value: '100\u03BCH' }, '100\u03BCH'),
];

// ---------------------------------------------------------------------------
// Microcontrollers (6)
// ---------------------------------------------------------------------------
const MCUS: StandardComponentDef[] = [
  mcu('ATmega328P', '8-bit AVR MCU, 32KB flash, 2KB SRAM, 28-pin DIP — Arduino Uno brain', ['MCU', 'AVR', 'Arduino', 'DIP-28', 'ATmega'], { manufacturer: 'Microchip', mpn: 'ATMEGA328P-PU', mountingType: 'tht', packageType: 'DIP-28' }, '328P'),
  mcu('ATmega2560', '8-bit AVR MCU, 256KB flash, 8KB SRAM, 100-pin TQFP — Arduino Mega brain', ['MCU', 'AVR', 'Arduino', 'TQFP-100', 'ATmega'], { manufacturer: 'Microchip', mpn: 'ATMEGA2560-16AU', mountingType: 'smd', packageType: 'TQFP-100' }, '2560'),
  mcu('ESP8266 (ESP-12F)', 'Wi-Fi SoC, 80MHz, 4MB flash, 80KB SRAM', ['MCU', 'Wi-Fi', 'ESP8266', 'IoT'], { manufacturer: 'Espressif', mpn: 'ESP-12F', dimensions: {'length':24,'width':16,'height':3}, mountingType: 'smd' }, 'ESP12'),
  mcu('ESP32-WROOM-32', 'Dual-core Wi-Fi/BLE SoC, 240MHz, 4MB flash, 520KB SRAM', ['MCU', 'Wi-Fi', 'Bluetooth', 'ESP32', 'IoT'], { manufacturer: 'Espressif', mpn: 'ESP32-WROOM-32E', mountingType: 'smd' }, 'ESP32'),
  mcu('ATtiny85', '8-bit AVR MCU, 8KB flash, 512B SRAM, 8-pin DIP — compact and versatile', ['MCU', 'AVR', 'DIP-8', 'ATtiny'], { manufacturer: 'Microchip', mpn: 'ATTINY85-20PU', mountingType: 'tht', packageType: 'DIP-8', dimensions: {'length':9.8,'width':6.4,'height':3.3} }, 'tiny85'),
  mcu('STM32F103C8T6 (Blue Pill)', 'ARM Cortex-M3, 72MHz, 64KB flash, 20KB SRAM, 48-pin LQFP', ['MCU', 'ARM', 'STM32', 'Cortex-M3', 'LQFP-48'], { manufacturer: 'STMicroelectronics', mpn: 'STM32F103C8T6', mountingType: 'smd', packageType: 'LQFP-48', dimensions: {'length':7,'width':7,'height':1.4} }, 'STM32'),
];

// ---------------------------------------------------------------------------
// Power ICs (6)
// ---------------------------------------------------------------------------
const POWER_ICS: StandardComponentDef[] = [
  power('LM7805 — 5V Linear Regulator', '5V 1A positive voltage regulator, TO-220', ['voltage regulator', 'linear', '5V', 'TO-220', 'power'], { manufacturer: 'Texas Instruments', mpn: 'LM7805CT', mountingType: 'tht', packageType: 'TO-220', dimensions: {'length':10.4,'width':4.6,'height':9.15} }, REG_PINS, '7805'),
  power('LM7812 — 12V Linear Regulator', '12V 1A positive voltage regulator, TO-220', ['voltage regulator', 'linear', '12V', 'TO-220', 'power'], { manufacturer: 'Texas Instruments', mpn: 'LM7812CT', mountingType: 'tht', packageType: 'TO-220', dimensions: {'length':10.4,'width':4.6,'height':9.15} }, REG_PINS, '7812'),
  power('LM317 — Adjustable Positive Regulator', 'Adjustable 1.2\u201337V, 1.5A positive voltage regulator, TO-220', ['voltage regulator', 'adjustable', 'TO-220', 'power'], { manufacturer: 'Texas Instruments', mpn: 'LM317T', mountingType: 'tht', packageType: 'TO-220', dimensions: {'length':10.4,'width':4.6,'height':9.15} }, ADJ_REG_PINS, 'LM317'),
  power('LM337 — Adjustable Negative Regulator', 'Adjustable -1.2 to -37V, 1.5A negative voltage regulator, TO-220', ['voltage regulator', 'negative', 'adjustable', 'TO-220', 'power'], { manufacturer: 'Texas Instruments', mpn: 'LM337T', mountingType: 'tht', packageType: 'TO-220', dimensions: {'length':10.4,'width':4.6,'height':9.15} }, ADJ_REG_PINS, 'LM337'),
  power('AMS1117-3.3 — 3.3V LDO Regulator', '3.3V 1A low-dropout regulator, SOT-223', ['LDO', 'regulator', '3.3V', 'SOT-223', 'power'], { manufacturer: 'Advanced Monolithic Systems', mpn: 'AMS1117-3.3', mountingType: 'smd', packageType: 'SOT-223', dimensions: {'length':6.5,'width':3.5,'height':1.6} }, REG_PINS, '1117'),
  { ...(() => { const v = buildTwoTerminalView('MP1584'); return { title: 'MP1584 — 3A Step-Down Converter', description: '3A adjustable step-down (buck) converter, 4.5\u201328V input', category: 'Power', tags: ['buck', 'converter', 'switching', 'power', 'step-down'], meta: { manufacturer: 'Monolithic Power Systems', mpn: 'MP1584EN', mountingType: 'smd', packageType: 'SOIC-8', dimensions: {'length':4.9,'width':3.9,'height':1.75} }, connectors: v.connectors, buses: [], views: v.views, constraints: [] }; })() },
];

// ---------------------------------------------------------------------------
// Op-Amps & Comparators (6)
// ---------------------------------------------------------------------------
const OPAMPS: StandardComponentDef[] = [
  opamp('LM358 — Dual Op-Amp', 'Dual low-power operational amplifier, 8-pin DIP', ['op-amp', 'dual', 'DIP-8', 'analog'], { manufacturer: 'Texas Instruments', mpn: 'LM358P', mountingType: 'tht', packageType: 'DIP-8', dimensions: {'length':9.8,'width':6.4,'height':3.3} }, 'LM358'),
  opamp('LM741 — General Purpose Op-Amp', 'General-purpose single op-amp, 8-pin DIP', ['op-amp', 'single', 'DIP-8', 'analog', 'classic'], { manufacturer: 'Texas Instruments', mpn: 'LM741CN', mountingType: 'tht', packageType: 'DIP-8', dimensions: {'length':9.8,'width':6.4,'height':3.3} }, '741'),
  opamp('TL071 — Low-Noise JFET Op-Amp', 'Low-noise JFET-input single op-amp, 8-pin DIP', ['op-amp', 'JFET', 'low-noise', 'DIP-8', 'analog'], { manufacturer: 'Texas Instruments', mpn: 'TL071CP', mountingType: 'tht', packageType: 'DIP-8', dimensions: {'length':9.8,'width':6.4,'height':3.3} }, 'TL071'),
  opamp('TL072 — Dual Low-Noise JFET Op-Amp', 'Dual low-noise JFET-input op-amp, 8-pin DIP', ['op-amp', 'JFET', 'dual', 'low-noise', 'DIP-8', 'analog'], { manufacturer: 'Texas Instruments', mpn: 'TL072CP', mountingType: 'tht', packageType: 'DIP-8', dimensions: {'length':9.8,'width':6.4,'height':3.3} }, 'TL072'),
  opamp('LM393 — Dual Comparator', 'Dual differential comparator, open-collector output, 8-pin DIP', ['comparator', 'dual', 'DIP-8', 'analog'], { manufacturer: 'Texas Instruments', mpn: 'LM393P', mountingType: 'tht', packageType: 'DIP-8', dimensions: {'length':9.8,'width':6.4,'height':3.3} }, 'LM393'),
  opamp('LM324 — Quad Op-Amp', 'Quad low-power operational amplifier, 14-pin DIP', ['op-amp', 'quad', 'DIP-14', 'analog'], { manufacturer: 'Texas Instruments', mpn: 'LM324N', mountingType: 'tht', packageType: 'DIP-14', dimensions: {'length':19.3,'width':6.4,'height':3.3} }, 'LM324'),
];

// ---------------------------------------------------------------------------
// Transistors (8)
// ---------------------------------------------------------------------------
const TRANSISTORS: StandardComponentDef[] = [
  transistor('2N2222 — NPN Transistor', 'NPN general-purpose transistor, 800mA, 40V, TO-92', ['NPN', 'transistor', 'BJT', 'TO-92'], { manufacturer: 'ON Semiconductor', mpn: 'P2N2222AG', mountingType: 'tht', packageType: 'TO-92', dimensions: {'length':4.8,'width':3.8,'height':4.8} }, NPN_PINS, '2222'),
  transistor('2N3904 — NPN Transistor', 'NPN general-purpose transistor, 200mA, 40V, TO-92', ['NPN', 'transistor', 'BJT', 'TO-92'], { manufacturer: 'ON Semiconductor', mpn: '2N3904', mountingType: 'tht', packageType: 'TO-92', dimensions: {'length':4.8,'width':3.8,'height':4.8} }, NPN_PINS, '3904'),
  transistor('2N3906 — PNP Transistor', 'PNP general-purpose transistor, 200mA, 40V, TO-92', ['PNP', 'transistor', 'BJT', 'TO-92'], { manufacturer: 'ON Semiconductor', mpn: '2N3906', mountingType: 'tht', packageType: 'TO-92', dimensions: {'length':4.8,'width':3.8,'height':4.8} }, PNP_PINS, '3906'),
  transistor('BC547 — NPN Transistor', 'NPN small-signal transistor, 100mA, 45V, TO-92', ['NPN', 'transistor', 'BJT', 'TO-92', 'small-signal'], { manufacturer: 'ON Semiconductor', mpn: 'BC547BTA', mountingType: 'tht', packageType: 'TO-92', dimensions: {'length':4.8,'width':3.8,'height':4.8} }, NPN_PINS, 'BC547'),
  transistor('BC557 — PNP Transistor', 'PNP small-signal transistor, 100mA, 45V, TO-92', ['PNP', 'transistor', 'BJT', 'TO-92', 'small-signal'], { manufacturer: 'ON Semiconductor', mpn: 'BC557BTA', mountingType: 'tht', packageType: 'TO-92', dimensions: {'length':4.8,'width':3.8,'height':4.8} }, PNP_PINS, 'BC557'),
  transistor('2N7000 — N-Channel MOSFET', 'N-channel enhancement MOSFET, 200mA, 60V, TO-92', ['MOSFET', 'N-channel', 'TO-92', 'logic-level'], { manufacturer: 'ON Semiconductor', mpn: '2N7000', mountingType: 'tht', packageType: 'TO-92', dimensions: {'length':4.8,'width':3.8,'height':4.8} }, FET_PINS, '2N7K'),
  transistor('IRF540N — N-Channel Power MOSFET', 'N-channel power MOSFET, 33A, 100V, TO-220', ['MOSFET', 'N-channel', 'power', 'TO-220'], { manufacturer: 'Infineon', mpn: 'IRF540NPBF', mountingType: 'tht', packageType: 'TO-220', dimensions: {'length':10.4,'width':4.6,'height':9.15} }, FET_PINS, 'IRF540'),
  transistor('IRLZ44N — Logic-Level N-Channel MOSFET', 'Logic-level N-channel MOSFET, 47A, 55V, TO-220', ['MOSFET', 'N-channel', 'logic-level', 'power', 'TO-220'], { manufacturer: 'Infineon', mpn: 'IRLZ44NPBF', mountingType: 'tht', packageType: 'TO-220', dimensions: {'length':10.4,'width':4.6,'height':9.15} }, FET_PINS, 'IRLZ44'),
];

// ---------------------------------------------------------------------------
// Diodes (8)
// ---------------------------------------------------------------------------
const DIODES: StandardComponentDef[] = [
  diode('1N4148 — Small Signal Diode', 'Fast-switching small signal diode, 100V, 200mA, DO-35', ['diode', 'signal', 'switching', 'DO-35'], { manufacturer: 'Vishay', mpn: '1N4148', mountingType: 'tht', packageType: 'DO-35', dimensions: {'length':5.08,'width':2,'height':2} }, '4148'),
  diode('1N4007 — Rectifier Diode', 'General-purpose rectifier, 1000V, 1A, DO-41', ['diode', 'rectifier', 'DO-41'], { manufacturer: 'ON Semiconductor', mpn: '1N4007', mountingType: 'tht', packageType: 'DO-41' }, '4007'),
  diode('1N5819 — Schottky Diode', 'Schottky barrier diode, 40V, 1A, DO-41 — low forward voltage drop', ['diode', 'Schottky', 'DO-41'], { manufacturer: 'ON Semiconductor', mpn: '1N5819', mountingType: 'tht', packageType: 'DO-41' }, '5819'),
  diode('1N5408 — Power Rectifier Diode', 'Power rectifier, 1000V, 3A, DO-201', ['diode', 'rectifier', 'power', 'DO-201'], { manufacturer: 'ON Semiconductor', mpn: '1N5408', mountingType: 'tht', packageType: 'DO-201' }, '5408'),
  diode('Zener Diode 3.3V', '3.3V Zener diode, 500mW, DO-35', ['diode', 'Zener', '3.3V', 'DO-35'], { manufacturer: 'ON Semiconductor', mpn: '1N5226B', mountingType: 'tht', packageType: 'DO-35', dimensions: {'length':5.08,'width':2,'height':2}, value: '3.3V' }, 'Z3.3V'),
  diode('Zener Diode 5.1V', '5.1V Zener diode, 500mW, DO-35', ['diode', 'Zener', '5.1V', 'DO-35'], { manufacturer: 'ON Semiconductor', mpn: '1N5231B', mountingType: 'tht', packageType: 'DO-35', dimensions: {'length':5.08,'width':2,'height':2}, value: '5.1V' }, 'Z5.1V'),
  diode('Zener Diode 12V', '12V Zener diode, 500mW, DO-35', ['diode', 'Zener', '12V', 'DO-35'], { manufacturer: 'ON Semiconductor', mpn: '1N5242B', mountingType: 'tht', packageType: 'DO-35', dimensions: {'length':5.08,'width':2,'height':2}, value: '12V' }, 'Z12V'),
  diode('BAT85 — Schottky Diode', 'Small signal Schottky diode, 30V, 200mA, DO-35', ['diode', 'Schottky', 'signal', 'DO-35'], { manufacturer: 'NXP', mpn: 'BAT85', mountingType: 'tht', packageType: 'DO-35', dimensions: {'length':5.08,'width':2,'height':2} }, 'BAT85'),
];

// ---------------------------------------------------------------------------
// LEDs (6)
// ---------------------------------------------------------------------------
const LEDS: StandardComponentDef[] = [
  led('Red', '620\u2013625nm', 'HLMP-4700'),
  led('Green', '565\u2013570nm', 'HLMP-1790'),
  led('Blue', '465\u2013475nm', 'C503B-BAN'),
  led('Yellow', '585\u2013595nm', 'HLMP-4719'),
  led('White', '6500K', 'C503C-WAN'),
  led('IR', '940nm', 'TSAL6200'),
];

// ---------------------------------------------------------------------------
// Connectors (11)
// ---------------------------------------------------------------------------
const CONNECTORS: StandardComponentDef[] = [
  connector('JST PH 2-Pin', '2-pin JST PH connector, 2mm pitch, right-angle', ['connector', 'JST', 'PH', '2-pin'], { manufacturer: 'JST', mpn: 'B2B-PH-K-S', mountingType: 'tht', pitch: '2mm' }, 'JST2'),
  connector('JST PH 3-Pin', '3-pin JST PH connector, 2mm pitch', ['connector', 'JST', 'PH', '3-pin'], { manufacturer: 'JST', mpn: 'B3B-PH-K-S', mountingType: 'tht', pitch: '2mm' }, 'JST3'),
  connector('JST XH 4-Pin', '4-pin JST XH connector, 2.5mm pitch', ['connector', 'JST', 'XH', '4-pin'], { manufacturer: 'JST', mpn: 'B4B-XH-A', mountingType: 'tht', pitch: '2.5mm' }, 'XH4'),
  connector('2x3 ISP Header', '2x3 pin header for AVR ISP programming, 2.54mm pitch', ['connector', 'header', 'ISP', 'AVR', '2x3'], { manufacturer: 'Samtec', mountingType: 'tht', pitch: '2.54mm' }, 'ISP'),
  connector('2x5 JTAG Header', '2x5 pin header for JTAG/SWD debugging, 1.27mm pitch', ['connector', 'header', 'JTAG', 'SWD', '2x5'], { manufacturer: 'Samtec', mountingType: 'smd', pitch: '1.27mm' }, 'JTAG'),
  connector('USB Type-A Receptacle', 'USB Type-A female connector, through-hole', ['connector', 'USB', 'Type-A', 'receptacle'], { manufacturer: 'Molex', mpn: '0480370001', mountingType: 'tht' }, 'USB-A'),
  connector('USB Type-B Receptacle', 'USB Type-B female connector, through-hole', ['connector', 'USB', 'Type-B', 'receptacle'], { manufacturer: 'Molex', mpn: '0670688000', mountingType: 'tht' }, 'USB-B'),
  connector('USB Type-C Receptacle', 'USB Type-C female connector, SMD', ['connector', 'USB', 'Type-C', 'receptacle'], { manufacturer: 'GCT', mpn: 'USB4105-GF-A', mountingType: 'smd' }, 'USB-C'),
  connector('DC Barrel Jack 5.5x2.1mm', 'DC power barrel jack, 5.5mm outer / 2.1mm inner, panel mount', ['connector', 'DC', 'barrel', 'power', 'jack'], { manufacturer: 'CUI', mpn: 'PJ-002A', mountingType: 'tht' }, 'DC'),
  connector('Terminal Block 2-Pin', '2-position screw terminal block, 5.08mm pitch', ['connector', 'terminal', 'screw', '2-pin'], { manufacturer: 'Phoenix Contact', mpn: '1729018', mountingType: 'tht', pitch: '5.08mm' }, 'TB2'),
  connector('Terminal Block 3-Pin', '3-position screw terminal block, 5.08mm pitch', ['connector', 'terminal', 'screw', '3-pin'], { manufacturer: 'Phoenix Contact', mpn: '1729021', mountingType: 'tht', pitch: '5.08mm' }, 'TB3'),
];

// ---------------------------------------------------------------------------
// Displays & UI (4)
// ---------------------------------------------------------------------------
const DISPLAYS: StandardComponentDef[] = [
  display('16x2 LCD (HD44780)', '16x2 character LCD with HD44780 controller, parallel interface', ['display', 'LCD', 'character', '16x2', 'HD44780'], { manufacturer: 'Hitachi', interface: 'parallel' }, 'LCD'),
  display('0.96" OLED I2C (SSD1306)', '0.96-inch 128x64 OLED display, I2C interface, SSD1306 controller', ['display', 'OLED', 'I2C', '128x64', 'SSD1306'], { manufacturer: 'Solomon Systech', interface: 'I2C', resolution: '128x64' }, 'OLED'),
  display('7-Segment Display (Common Cathode)', 'Single digit 7-segment LED display, common cathode, 0.56"', ['display', '7-segment', 'LED', 'common-cathode'], { manufacturer: 'Kingbright', mpn: 'SA56-11EWA' }, '7SEG'),
  display('4x4 Keypad Matrix', '4x4 button matrix keypad, membrane type', ['input', 'keypad', 'matrix', '4x4', 'button'], { interface: 'matrix', rows: 4, cols: 4 }, 'KEY'),
];

// ---------------------------------------------------------------------------
// Sensors (8)
// ---------------------------------------------------------------------------
const SENSORS: StandardComponentDef[] = [
  sensor('DHT11 — Temperature & Humidity Sensor', 'Digital temperature (0\u201350\u00B0C) and humidity (20\u201380%) sensor, single-wire', ['sensor', 'temperature', 'humidity', 'DHT11', 'digital'], { manufacturer: 'Aosong', mpn: 'DHT11', dimensions: {'length':15.5,'width':12,'height':5.5}, interface: 'single-wire', accuracy: '\u00B12\u00B0C, \u00B15%RH' }, 'DHT11'),
  sensor('DHT22 — Temperature & Humidity Sensor', 'Digital temperature (-40\u201380\u00B0C) and humidity (0\u2013100%) sensor, single-wire', ['sensor', 'temperature', 'humidity', 'DHT22', 'digital'], { manufacturer: 'Aosong', mpn: 'DHT22/AM2302', dimensions: {'length':25.1,'width':15.1,'height':7.7}, interface: 'single-wire', accuracy: '\u00B10.5\u00B0C, \u00B12%RH' }, 'DHT22'),
  sensor('DS18B20 — 1-Wire Temperature Sensor', 'Digital 1-Wire temperature sensor, -55 to +125\u00B0C, \u00B10.5\u00B0C accuracy, TO-92', ['sensor', 'temperature', '1-Wire', 'DS18B20', 'digital'], { manufacturer: 'Maxim', mpn: 'DS18B20', interface: '1-Wire', mountingType: 'tht', packageType: 'TO-92', dimensions: {'length':4.8,'width':3.8,'height':4.8} }, '18B20'),
  sensor('HC-SR04 — Ultrasonic Distance Sensor', 'Ultrasonic ranging module, 2cm\u20134m range, 3mm resolution', ['sensor', 'ultrasonic', 'distance', 'HC-SR04'], { manufacturer: 'Generic', mpn: 'HC-SR04', dimensions: {'length':45,'width':20,'height':15}, interface: 'trigger/echo' }, 'SR04'),
  sensor('PIR Motion Sensor (HC-SR501)', 'Passive infrared motion sensor module, adjustable sensitivity and delay', ['sensor', 'PIR', 'motion', 'HC-SR501', 'infrared'], { manufacturer: 'Generic', mpn: 'HC-SR501', dimensions: {'length':32,'width':24,'height':24} }, 'PIR'),
  sensor('LDR — Light Dependent Resistor', 'Photoresistor (LDR), 1k\u03A9\u201310M\u03A9 range depending on illumination', ['sensor', 'light', 'LDR', 'photoresistor', 'analog'], { manufacturer: 'Generic', type: 'photoresistor' }, 'LDR'),
  sensor('NTC Thermistor 10k\u03A9', '10k\u03A9 NTC thermistor, B=3950, -40 to +125\u00B0C', ['sensor', 'thermistor', 'NTC', '10k\u03A9', 'temperature', 'analog'], { manufacturer: 'Murata', mpn: 'NCP15XH103F03RC', value: '10k\u03A9', beta: 3950 }, 'NTC'),
  sensor('MPU-6050 — 6-Axis IMU', '6-axis accelerometer + gyroscope, I2C', ['sensor', 'IMU', 'accelerometer', 'gyroscope', 'I2C', 'MPU-6050'], { manufacturer: 'TDK InvenSense', mpn: 'MPU-6050', dimensions: {'length':20,'width':15,'height':1.2}, interface: 'I2C' }, 'MPU'),
];

// ---------------------------------------------------------------------------
// Communication Modules (4)
// ---------------------------------------------------------------------------
const COMM_MODULES: StandardComponentDef[] = [
  comm('NRF24L01 — 2.4GHz Transceiver', '2.4GHz wireless transceiver module, SPI, 250kbps\u20132Mbps, 100m range', ['wireless', 'RF', '2.4GHz', 'NRF24L01', 'SPI'], { manufacturer: 'Nordic Semiconductor', mpn: 'NRF24L01+', interface: 'SPI', frequency: '2.4GHz' }, 'NRF24'),
  comm('HC-05 — Bluetooth Module', 'Bluetooth 2.0 SPP module, UART, master/slave, 10m range', ['Bluetooth', 'UART', 'HC-05', 'SPP', 'wireless'], { manufacturer: 'Generic', mpn: 'HC-05', dimensions: {'length':37.3,'width':15.2,'height':6}, interface: 'UART', btVersion: '2.0' }, 'HC-05'),
  comm('SIM800L — GSM/GPRS Module', 'Quad-band GSM/GPRS module, UART, SMS/voice/data', ['GSM', 'GPRS', 'cellular', 'SIM800L', 'UART'], { manufacturer: 'SIMCom', mpn: 'SIM800L', dimensions: {'length':25,'width':23,'height':5}, interface: 'UART', bands: '850/900/1800/1900MHz' }, 'SIM800'),
  comm('RFM95 — LoRa Transceiver', 'Long-range LoRa transceiver, 868/915MHz, SPI, up to 15km range', ['LoRa', 'wireless', 'long-range', 'RFM95', 'SPI'], { manufacturer: 'HopeRF', mpn: 'RFM95W', dimensions: {'length':16,'width':16,'height':2}, interface: 'SPI', frequency: '868/915MHz' }, 'RFM95'),
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * All standard library component definitions (120 components).
 * Each entry is ready to be inserted into the component_library table
 * with `isPublic: true`.
 */
export const STANDARD_LIBRARY_COMPONENTS: StandardComponentDef[] = [
  ...LOGIC_ICS,
  ...RESISTORS,
  ...CAPACITORS,
  ...INDUCTORS,
  ...MCUS,
  ...POWER_ICS,
  ...OPAMPS,
  ...TRANSISTORS,
  ...DIODES,
  ...LEDS,
  ...CONNECTORS,
  ...DISPLAYS,
  ...SENSORS,
  ...COMM_MODULES,
];

/**
 * Category names present in the standard library.
 *
 * Re-exported from shared/component-categories.ts — the single source of truth.
 */
export { COMPONENT_CATEGORIES as STANDARD_LIBRARY_CATEGORIES } from './component-categories';
export type { ComponentCategory as StandardLibraryCategory } from './component-categories';
