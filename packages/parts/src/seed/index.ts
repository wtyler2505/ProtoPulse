import { definePart, footprint0805, footprintDip8, footprintSot23, G, passivePins, pin, twoPinSymbol } from './helpers.js';

import type { Part } from '../types.js';

/**
 * The M1 seed library — ~15 parts, enough for Track 1 ("First Light")
 * and the Probe's input-protection stage.
 *
 * Symbol geometry is schematic convention, not physical dimensions.
 * Pin NUMBERS appear only where verified against a datasheet (see
 * inbox/2026-06-10-m1-seed-part-pinouts.md); everything else carries
 * functional pin names and provenance: unverified.
 *
 * Footprints below are generic IPC-class footprints, unverified —
 * replace per-MPN before fab. Parts with no board-ready package
 * (battery, headers, USB-C stub, pushbutton, power rails) carry none.
 */

const resistor = definePart({
  id: 'core:resistor',
  name: 'Resistor',
  refPrefix: 'R',
  class: 'resistor',
  footprint: footprint0805(), // generic IPC-class footprint, unverified — replace per-MPN before fab
  pins: passivePins(['1', '2']),
  symbol: twoPinSymbol([
    { kind: 'rect', x: -G, y: -Math.round(G / 2), w: 2 * G, h: G },
    { kind: 'line', a: { x: -2 * G, y: 0 }, b: { x: -G, y: 0 } },
    { kind: 'line', a: { x: G, y: 0 }, b: { x: 2 * G, y: 0 } },
  ]),
});

const capacitor = definePart({
  id: 'core:capacitor',
  name: 'Capacitor (ceramic)',
  refPrefix: 'C',
  class: 'capacitor',
  footprint: footprint0805(), // generic IPC-class footprint, unverified — replace per-MPN before fab
  pins: passivePins(['1', '2']),
  symbol: twoPinSymbol([
    { kind: 'line', a: { x: -2 * G, y: 0 }, b: { x: -Math.round(G / 4), y: 0 } },
    { kind: 'line', a: { x: -Math.round(G / 4), y: -G }, b: { x: -Math.round(G / 4), y: G } },
    { kind: 'line', a: { x: Math.round(G / 4), y: -G }, b: { x: Math.round(G / 4), y: G } },
    { kind: 'line', a: { x: Math.round(G / 4), y: 0 }, b: { x: 2 * G, y: 0 } },
  ]),
});

const capacitorElectrolytic = definePart({
  id: 'core:capacitor-electrolytic',
  name: 'Capacitor (electrolytic, polarized)',
  refPrefix: 'C',
  class: 'capacitor',
  footprint: footprint0805(), // generic IPC-class footprint, unverified — replace per-MPN before fab
  pins: passivePins(['+', '−']),
  symbol: twoPinSymbol(
    [
      { kind: 'line', a: { x: -2 * G, y: 0 }, b: { x: -Math.round(G / 4), y: 0 } },
      { kind: 'line', a: { x: -Math.round(G / 4), y: -G }, b: { x: -Math.round(G / 4), y: G } },
      { kind: 'polyline', points: [{ x: Math.round(G / 4), y: -G }, { x: Math.round(G / 2), y: 0 }, { x: Math.round(G / 4), y: G }] },
      { kind: 'line', a: { x: Math.round(G / 2), y: 0 }, b: { x: 2 * G, y: 0 } },
      { kind: 'text', at: { x: -G, y: G }, text: '+', sizeNm: G },
    ],
    ['1', '2'],
  ),
});

function diodeSymbol(): ReturnType<typeof twoPinSymbol> {
  return twoPinSymbol(
    [
      { kind: 'line', a: { x: -2 * G, y: 0 }, b: { x: 2 * G, y: 0 } },
      { kind: 'polyline', points: [{ x: -Math.round(G / 2), y: -Math.round(G * 0.75) }, { x: Math.round(G / 2), y: 0 }, { x: -Math.round(G / 2), y: Math.round(G * 0.75) }], closed: true },
      { kind: 'line', a: { x: Math.round(G / 2), y: -Math.round(G * 0.75) }, b: { x: Math.round(G / 2), y: Math.round(G * 0.75) } },
    ],
    ['A', 'K'],
  );
}

const led = definePart({
  id: 'core:led',
  name: 'LED',
  refPrefix: 'D',
  class: 'led',
  footprint: footprint0805(['A', 'K']), // generic IPC-class footprint, unverified — replace per-MPN before fab
  pins: passivePins(['A', 'K'], ['A', 'K']),
  symbol: diodeSymbol(),
  parametrics: { currentDrawA: 0.02 },
});

const diode1n4148 = definePart({
  id: 'core:1n4148',
  name: 'Small-signal diode 1N4148',
  refPrefix: 'D',
  class: 'diode',
  footprint: footprint0805(['A', 'K']), // generic IPC-class footprint, unverified — replace per-MPN before fab
  mpn: '1N4148',
  pins: passivePins(['A', 'K'], ['A', 'K']),
  symbol: diodeSymbol(),
});

const schottky1n5819 = definePart({
  id: 'core:1n5819',
  name: 'Schottky diode 1N5819',
  refPrefix: 'D',
  class: 'diode',
  footprint: footprint0805(['A', 'K']), // generic IPC-class footprint, unverified — replace per-MPN before fab
  mpn: '1N5819',
  pins: passivePins(['A', 'K'], ['A', 'K']),
  symbol: diodeSymbol(),
});

const tvsUni = definePart({
  id: 'core:tvs-unidirectional',
  name: 'TVS diode (unidirectional)',
  refPrefix: 'D',
  class: 'diode',
  footprint: footprint0805(['A', 'K']), // generic IPC-class footprint, unverified — replace per-MPN before fab
  pins: passivePins(['A', 'K'], ['A', 'K']),
  symbol: diodeSymbol(),
});

const bat54s = definePart({
  id: 'core:bat54s',
  name: 'BAT54S dual series Schottky',
  refPrefix: 'D',
  class: 'diode',
  // generic IPC-class footprint, unverified — replace per-MPN before fab
  // (SOT-23 pad order matches the verified pin map: 1=A1, 2=K2, 3=COM).
  footprint: footprintSot23(['1', '2', '3']),
  mpn: 'BAT54S',
  datasheetUrl: 'https://www.vishay.com/docs/86410/bat54_bat54a_bat54c_bat54s.pdf',
  pins: [
    pin('1', 'A1', 'passive', '1'),
    pin('2', 'K2', 'passive', '2'),
    pin('3', 'COM', 'passive', '3'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -2 * G, y: -2 * G, w: 4 * G, h: 4 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'BAT54S', sizeNm: Math.round(G * 0.7) },
    ],
    pins: [
      { key: '1', at: { x: -3 * G, y: 0 }, dir: 'W' },
      { key: '2', at: { x: 3 * G, y: 0 }, dir: 'E' },
      { key: '3', at: { x: 0, y: -3 * G }, dir: 'S' },
    ],
  },
  provenance: 'verified',
  provenanceNote:
    'Pin map verified 2026-06-10 against Vishay doc 86410 + onsemi BAT54SLT1: 1=anode D1, 2=cathode D2, 3=common midpoint (K1+A2). See inbox/2026-06-10-m1-seed-part-pinouts.md.',
});

const npn2n3904 = definePart({
  id: 'core:2n3904',
  name: 'NPN transistor 2N3904',
  refPrefix: 'Q',
  class: 'transistor',
  // generic IPC-class footprint, unverified — replace per-MPN before fab
  // (SOT-23 B/E/C order follows the common MMBT3904 convention).
  footprint: footprintSot23(['B', 'E', 'C']),
  mpn: '2N3904',
  pins: [pin('B', 'B', 'passive'), pin('C', 'C', 'passive'), pin('E', 'E', 'passive')],
  symbol: {
    primitives: [
      { kind: 'circle', cx: 0, cy: 0, r: Math.round(G * 1.4) },
      { kind: 'line', a: { x: -2 * G, y: 0 }, b: { x: -Math.round(G / 2), y: 0 } },
      { kind: 'line', a: { x: -Math.round(G / 2), y: -G }, b: { x: -Math.round(G / 2), y: G } },
      { kind: 'line', a: { x: -Math.round(G / 2), y: Math.round(G / 2) }, b: { x: G, y: 2 * G } },
      { kind: 'line', a: { x: -Math.round(G / 2), y: -Math.round(G / 2) }, b: { x: G, y: -2 * G } },
    ],
    pins: [
      { key: 'B', at: { x: -2 * G, y: 0 }, dir: 'W' },
      { key: 'C', at: { x: G, y: -2 * G }, dir: 'N' },
      { key: 'E', at: { x: G, y: 2 * G }, dir: 'S' },
    ],
  },
});

const nmosAo3400 = definePart({
  id: 'core:nmos-ao3400',
  name: 'N-MOSFET (AO3400-class, logic level)',
  refPrefix: 'Q',
  class: 'transistor',
  // generic IPC-class footprint, unverified — replace per-MPN before fab
  // (SOT-23 G/S/D order follows the common small-signal MOSFET convention).
  footprint: footprintSot23(['G', 'S', 'D']),
  mpn: 'AO3400A',
  pins: [pin('G', 'G', 'passive'), pin('D', 'D', 'passive'), pin('S', 'S', 'passive')],
  symbol: {
    primitives: [
      { kind: 'circle', cx: 0, cy: 0, r: Math.round(G * 1.4) },
      { kind: 'line', a: { x: -2 * G, y: 0 }, b: { x: -Math.round(G / 2), y: 0 } },
      { kind: 'line', a: { x: -Math.round(G / 2), y: -G }, b: { x: -Math.round(G / 2), y: G } },
      { kind: 'line', a: { x: 0, y: -G }, b: { x: 0, y: G } },
      { kind: 'line', a: { x: 0, y: -Math.round(G / 2) }, b: { x: G, y: -2 * G } },
      { kind: 'line', a: { x: 0, y: Math.round(G / 2) }, b: { x: G, y: 2 * G } },
    ],
    pins: [
      { key: 'G', at: { x: -2 * G, y: 0 }, dir: 'W' },
      { key: 'D', at: { x: G, y: -2 * G }, dir: 'N' },
      { key: 'S', at: { x: G, y: 2 * G }, dir: 'S' },
    ],
  },
});

const ne555 = definePart({
  id: 'core:ne555',
  name: 'NE555 timer',
  refPrefix: 'U',
  class: 'ic',
  // generic IPC-class footprint, unverified — replace per-MPN before fab
  // (DIP-8: pins 1–4 down the left side, 5–8 up the right, per datasheet).
  footprint: footprintDip8(),
  mpn: 'NE555',
  manufacturer: 'Texas Instruments',
  datasheetUrl: 'https://www.ti.com/lit/ds/symlink/ne555.pdf',
  pins: [
    pin('1', 'GND', 'power_in', '1'),
    pin('2', 'TRIG', 'input', '2'),
    pin('3', 'OUT', 'output', '3'),
    pin('4', 'RESET', 'input', '4'),
    pin('5', 'CONT', 'passive', '5'),
    pin('6', 'THRES', 'input', '6'),
    pin('7', 'DISCH', 'open_collector', '7'),
    pin('8', 'VCC', 'power_in', '8'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: '555', sizeNm: G },
    ],
    pins: [
      { key: '2', at: { x: -4 * G, y: 3 * G }, dir: 'W' },
      { key: '6', at: { x: -4 * G, y: G }, dir: 'W' },
      { key: '5', at: { x: -4 * G, y: -G }, dir: 'W' },
      { key: '4', at: { x: -4 * G, y: -3 * G }, dir: 'W' },
      { key: '3', at: { x: 4 * G, y: 2 * G }, dir: 'E' },
      { key: '7', at: { x: 4 * G, y: -2 * G }, dir: 'E' },
      { key: '8', at: { x: 0, y: 5 * G }, dir: 'N' },
      { key: '1', at: { x: 0, y: -5 * G }, dir: 'S' },
    ],
  },
  parametrics: { currentDrawA: 0.01, maxVoltage: 16 },
  provenance: 'verified',
  provenanceNote:
    'Pin map verified 2026-06-10 against TI NE555 datasheet (DIP-8): 1 GND, 2 TRIG, 3 OUT, 4 RESET, 5 CONT, 6 THRES, 7 DISCH, 8 VCC. See inbox/2026-06-10-m1-seed-part-pinouts.md.',
});

const pushbutton = definePart({
  id: 'core:pushbutton',
  name: 'Pushbutton (momentary)',
  refPrefix: 'SW',
  class: 'switch',
  pins: passivePins(['1', '2']),
  symbol: twoPinSymbol([
    { kind: 'line', a: { x: -2 * G, y: 0 }, b: { x: -G, y: 0 } },
    { kind: 'circle', cx: -G, cy: 0, r: Math.round(G / 5) },
    { kind: 'circle', cx: G, cy: 0, r: Math.round(G / 5) },
    { kind: 'line', a: { x: -G, y: G }, b: { x: G, y: G } },
    { kind: 'line', a: { x: G, y: 0 }, b: { x: 2 * G, y: 0 } },
  ]),
});

const header2x10 = definePart({
  id: 'core:header-2x10',
  name: 'Header 2×10 0.1"',
  refPrefix: 'J',
  class: 'connector',
  pins: Array.from({ length: 20 }, (_, i) => pin(String(i + 1), String(i + 1), 'passive', String(i + 1))),
  symbol: {
    primitives: [{ kind: 'rect', x: -2 * G, y: -10 * G, w: 4 * G, h: 20 * G }],
    pins: Array.from({ length: 20 }, (_, i) => {
      const row = Math.floor(i / 2); // 0..9
      const left = i % 2 === 0;
      return {
        key: String(i + 1),
        at: { x: left ? -3 * G : 3 * G, y: (9 - row * 2) * G },
        dir: left ? ('W' as const) : ('E' as const),
      };
    }),
  },
});

const usbcPower = definePart({
  id: 'core:usbc-power-stub',
  name: 'USB-C connector (power-only stub)',
  refPrefix: 'J',
  class: 'connector',
  pins: [
    pin('VBUS', 'VBUS', 'power_out'),
    pin('GND', 'GND', 'power_out'),
    pin('CC1', 'CC1', 'passive'),
    pin('CC2', 'CC2', 'passive'),
    pin('SHIELD', 'SHIELD', 'passive'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'USB-C', sizeNm: Math.round(G * 0.7) },
    ],
    pins: [
      { key: 'VBUS', at: { x: 4 * G, y: 2 * G }, dir: 'E' },
      { key: 'CC1', at: { x: 4 * G, y: 0 }, dir: 'E' },
      { key: 'CC2', at: { x: 4 * G, y: -G }, dir: 'E' },
      { key: 'GND', at: { x: 4 * G, y: -2 * G }, dir: 'E' },
      { key: 'SHIELD', at: { x: 0, y: -4 * G }, dir: 'S' },
    ],
  },
  provenanceNote:
    'Functional stub: pins are roles (VBUS/GND/CC), not receptacle pin letters. Replace with a verified receptacle part before footprint work.',
});

const battery = definePart({
  id: 'core:battery',
  name: 'Battery',
  refPrefix: 'BT',
  class: 'battery',
  pins: [pin('+', '+', 'power_out'), pin('-', '−', 'power_out')],
  symbol: twoPinSymbol(
    [
      { kind: 'line', a: { x: -2 * G, y: 0 }, b: { x: -Math.round(G / 4), y: 0 } },
      { kind: 'line', a: { x: -Math.round(G / 4), y: -Math.round(G * 1.2) }, b: { x: -Math.round(G / 4), y: Math.round(G * 1.2) } },
      { kind: 'line', a: { x: Math.round(G / 4), y: -Math.round(G * 0.6) }, b: { x: Math.round(G / 4), y: Math.round(G * 0.6) } },
      { kind: 'line', a: { x: Math.round(G / 4), y: 0 }, b: { x: 2 * G, y: 0 } },
      { kind: 'text', at: { x: -G, y: G }, text: '+', sizeNm: G },
    ],
    ['+', '-'],
  ),
});

/** Power pseudo-symbols: a rail source the ERC power check can see. */
const pwrVcc = definePart({
  id: 'core:pwr-vcc',
  name: 'VCC rail',
  refPrefix: 'PWR',
  class: 'power',
  pins: [pin('1', 'VCC', 'power_out')],
  symbol: {
    primitives: [{ kind: 'polyline', points: [{ x: -Math.round(G / 2), y: G }, { x: 0, y: 2 * G }, { x: Math.round(G / 2), y: G }], closed: true }],
    pins: [{ key: '1', at: { x: 0, y: 0 }, dir: 'S' }],
  },
});

const pwrGnd = definePart({
  id: 'core:pwr-gnd',
  name: 'GND rail',
  refPrefix: 'PWR',
  class: 'power',
  pins: [pin('1', 'GND', 'power_out')],
  symbol: {
    primitives: [
      { kind: 'line', a: { x: -G, y: -G }, b: { x: G, y: -G } },
      { kind: 'line', a: { x: -Math.round(G / 2), y: -Math.round(G * 1.4) }, b: { x: Math.round(G / 2), y: -Math.round(G * 1.4) } },
    ],
    pins: [{ key: '1', at: { x: 0, y: 0 }, dir: 'N' }],
  },
});


/**
 * ESP32-S3-WROOM-1 module — the Probe's brain (Vol II §F). Pin map
 * verified 2026-06-11 against the Espressif ESP32-S3-WROOM-1/-1U
 * datasheet pin-definition table, cross-checked against an
 * independent community pinout (see inbox note). 41 pins: 40
 * castellated + the thermal pad. NO footprint yet — the module is
 * schematic-usable; the land pattern is a later, datasheet-exact
 * slice (the unplaced tray flags it on the board side).
 *
 * Strapping pins (datasheet §2.4): IO0 (boot mode), IO3, IO45, IO46 —
 * load them carefully; EN must be pulled high to run.
 */
const esp32s3Pin = (num: number, name: string, type: 'power_in' | 'input' | 'bidi') =>
  pin(String(num), name, type, String(num));

const ESP32S3_PINS: [number, string, 'power_in' | 'input' | 'bidi'][] = [
  [1, 'GND', 'power_in'],
  [2, '3V3', 'power_in'],
  [3, 'EN', 'input'],
  [4, 'IO4', 'bidi'],
  [5, 'IO5', 'bidi'],
  [6, 'IO6', 'bidi'],
  [7, 'IO7', 'bidi'],
  [8, 'IO15', 'bidi'],
  [9, 'IO16', 'bidi'],
  [10, 'IO17', 'bidi'],
  [11, 'IO18', 'bidi'],
  [12, 'IO8', 'bidi'],
  [13, 'IO19', 'bidi'], // USB D-
  [14, 'IO20', 'bidi'], // USB D+
  [15, 'IO3', 'bidi'], // strapping
  [16, 'IO46', 'bidi'], // strapping
  [17, 'IO9', 'bidi'],
  [18, 'IO10', 'bidi'],
  [19, 'IO11', 'bidi'],
  [20, 'IO12', 'bidi'],
  [21, 'IO13', 'bidi'],
  [22, 'IO14', 'bidi'],
  [23, 'IO21', 'bidi'],
  [24, 'IO47', 'bidi'],
  [25, 'IO48', 'bidi'],
  [26, 'IO45', 'bidi'], // strapping
  [27, 'IO0', 'bidi'], // strapping (boot)
  [28, 'IO35', 'bidi'],
  [29, 'IO36', 'bidi'],
  [30, 'IO37', 'bidi'],
  [31, 'IO38', 'bidi'],
  [32, 'MTCK', 'bidi'], // IO39
  [33, 'MTDO', 'bidi'], // IO40
  [34, 'MTDI', 'bidi'], // IO41
  [35, 'MTMS', 'bidi'], // IO42
  [36, 'RXD0', 'bidi'], // IO44
  [37, 'TXD0', 'bidi'], // IO43
  [38, 'IO2', 'bidi'],
  [39, 'IO1', 'bidi'],
  [40, 'GND', 'power_in'],
  [41, 'EPAD', 'power_in'],
];

/** Symbol sides: left = EN + IOs in numeric order, right = UART/JTAG/
 *  USB/high IOs, 3V3 on top, grounds underneath. */
const ESP32S3_LEFT = [3, 27, 39, 38, 15, 4, 5, 6, 7, 12, 17, 18, 19, 20, 21, 22, 8, 9, 10, 11];
const ESP32S3_RIGHT = [37, 36, 13, 14, 23, 28, 29, 30, 31, 32, 35, 34, 33, 26, 16, 24, 25];

const esp32s3 = definePart({
  id: 'core:esp32-s3-wroom-1',
  name: 'ESP32-S3-WROOM-1 module',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'ESP32-S3-WROOM-1',
  manufacturer: 'Espressif',
  datasheetUrl:
    'https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf',
  pins: ESP32S3_PINS.map(([num, name, type]) => esp32s3Pin(num, name, type)),
  symbol: {
    primitives: [
      { kind: 'rect', x: -6 * G, y: -11 * G, w: 12 * G, h: 22 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'S3', sizeNm: G },
    ],
    pins: [
      ...ESP32S3_LEFT.map((num, i) => ({
        key: String(num),
        at: { x: -7 * G, y: (10 - i) * G },
        dir: 'W' as const,
      })),
      ...ESP32S3_RIGHT.map((num, i) => ({
        key: String(num),
        at: { x: 7 * G, y: (10 - i) * G },
        dir: 'E' as const,
      })),
      { key: '2', at: { x: 0, y: 12 * G }, dir: 'N' as const },
      { key: '1', at: { x: -2 * G, y: -12 * G }, dir: 'S' as const },
      { key: '40', at: { x: 0, y: -12 * G }, dir: 'S' as const },
      { key: '41', at: { x: 2 * G, y: -12 * G }, dir: 'S' as const },
    ],
  },
  parametrics: { currentDrawA: 0.5, maxVoltage: 3.6 },
  provenance: 'verified',
  provenanceNote:
    'Pin map (all 41) verified 2026-06-11 against the Espressif ESP32-S3-WROOM-1/-1U datasheet pin-definition table, cross-checked against atomic14/esp32-s3-pinouts. See inbox/2026-06-11-esp32-s3-wroom-1-pinout.md. No footprint yet — land pattern is a later datasheet-exact slice.',
});

// TMP36 — low-voltage analog temperature sensor. VOUT is a voltage
// proportional to temperature (10 mV/°C, 750 mV at 25°C, 500 mV offset so
// sub-zero temps stay positive), readable straight off an MCU ADC channel —
// the natural analog companion for the co-sim ADC path. Modeled schematic-only
// (TO-92 land pattern is a later datasheet-exact slice, like the ESP32 module).
const tmp36 = definePart({
  id: 'core:tmp36',
  name: 'TMP36 analog temperature sensor',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'TMP36GZ',
  manufacturer: 'Analog Devices',
  datasheetUrl: 'https://www.analog.com/media/en/technical-documentation/data-sheets/tmp35_36_37.pdf',
  pins: [
    pin('1', '+VS', 'power_in', '1'),
    pin('2', 'VOUT', 'output', '2'),
    pin('3', 'GND', 'power_in', '3'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -2 * G, y: -2 * G, w: 4 * G, h: 4 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'TMP36', sizeNm: Math.round(G * 0.7) },
    ],
    pins: [
      { key: '1', at: { x: 0, y: 3 * G }, dir: 'N' },
      { key: '2', at: { x: 3 * G, y: 0 }, dir: 'E' },
      { key: '3', at: { x: 0, y: -3 * G }, dir: 'S' },
    ],
  },
  parametrics: { currentDrawA: 0.00005, maxVoltage: 5.5 }, // 50 µA typ; VS 2.7–5.5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map verified 2026-06-20 against the Analog Devices TMP35/36/37 datasheet (Rev H, TO-92 3-lead, flat face toward you / leads down): pin 1 = +VS (2.7–5.5 V), pin 2 = VOUT, pin 3 = GND. Output 10 mV/°C, 750 mV at 25°C, −40 to +125 °C. Cross-checked against Adafruit TMP36 guide. See inbox/2026-06-20-tmp36-pinout.md. No footprint yet — TO-92 land pattern is a later datasheet-exact slice.',
});

export const SEED_PARTS: Part[] = [
  resistor,
  capacitor,
  capacitorElectrolytic,
  led,
  diode1n4148,
  schottky1n5819,
  tvsUni,
  bat54s,
  npn2n3904,
  nmosAo3400,
  ne555,
  tmp36,
  pushbutton,
  header2x10,
  usbcPower,
  battery,
  esp32s3,
  pwrVcc,
  pwrGnd,
];
