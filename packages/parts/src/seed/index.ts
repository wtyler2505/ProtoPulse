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

// BME280 — Bosch I²C/SPI environmental sensor (temp + humidity + pressure).
// The digital-bus complement to the TMP36's analog path: it talks I²C, so it
// exercises the SDA/SCL host-bus side of the breadboard. Datasheet pad names
// kept (SDI=SDA, SCK=SCL in I²C mode); CSB→VDDIO selects I²C, SDO selects the
// address (GND→0x76, VDDIO→0x77). Schematic-only (2.5×2.5 mm LGA-8 land
// pattern is a later datasheet-exact slice, like the ESP32 module).
const bme280 = definePart({
  id: 'core:bme280',
  name: 'BME280 temperature/humidity/pressure sensor (I²C/SPI)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'BME280',
  manufacturer: 'Bosch Sensortec',
  datasheetUrl: 'https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bme280-ds002.pdf',
  pins: [
    pin('1', 'GND', 'power_in', '1'),
    pin('2', 'CSB', 'input', '2'),
    pin('3', 'SDI', 'bidi', '3'), // SDA in I²C mode
    pin('4', 'SCK', 'input', '4'), // SCL in I²C mode
    pin('5', 'SDO', 'bidi', '5'), // address select (GND→0x76, VDDIO→0x77); SPI MISO
    pin('6', 'VDDIO', 'power_in', '6'),
    pin('7', 'GND', 'power_in', '7'),
    pin('8', 'VDD', 'power_in', '8'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'BME280', sizeNm: Math.round(G * 0.7) },
    ],
    pins: [
      { key: '8', at: { x: -4 * G, y: 3 * G }, dir: 'W' }, // VDD
      { key: '6', at: { x: -4 * G, y: G }, dir: 'W' }, // VDDIO
      { key: '1', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '7', at: { x: -4 * G, y: -3 * G }, dir: 'W' }, // GND
      { key: '4', at: { x: 4 * G, y: 3 * G }, dir: 'E' }, // SCK/SCL
      { key: '3', at: { x: 4 * G, y: G }, dir: 'E' }, // SDI/SDA
      { key: '5', at: { x: 4 * G, y: -G }, dir: 'E' }, // SDO
      { key: '2', at: { x: 4 * G, y: -3 * G }, dir: 'E' }, // CSB
    ],
  },
  parametrics: { currentDrawA: 0.000714, maxVoltage: 3.6 }, // ~714 µA during measurement; VDD 1.71–3.6 V
  provenance: 'verified',
  provenanceNote:
    'Pin map verified 2026-06-20 against the Bosch BME280 datasheet (LGA-8, numbered clockwise from top): 1 GND, 2 CSB, 3 SDI(=SDA), 4 SCK(=SCL), 5 SDO, 6 VDDIO, 7 GND, 8 VDD; corroborated across components101/watelectronics/espboards. I²C: CSB→VDDIO selects I²C, addr 0x77 default / 0x76 with SDO→GND. VDD 1.71–3.6 V, VDDIO 1.2–3.6 V. See inbox/2026-06-20-bme280-pinout.md. No footprint yet — LGA-8 land pattern is a later datasheet-exact slice.',
});

// GY-521 (MPU-6050) — InvenSense/TDK 6-axis IMU (3-axis accel + 3-axis gyro) on
// the common GY-521 breakout, I²C. Another digital-bus part; also has an
// auxiliary I²C master (XDA/XCL) for chaining e.g. a magnetometer, plus an INT
// line. Module runs at 3.3 V via an onboard regulator (VCC tolerant 3–5 V).
// Schematic-only (module land pattern deferred, like the ESP32 module).
const mpu6050 = definePart({
  id: 'core:mpu6050',
  name: 'GY-521 (MPU-6050) 6-axis IMU (I²C)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'GY-521',
  manufacturer: 'InvenSense/TDK (MPU-6050)',
  datasheetUrl: 'https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Datasheet1.pdf',
  pins: [
    pin('1', 'VCC', 'power_in', '1'),
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'SCL', 'input', '3'), // I²C clock in
    pin('4', 'SDA', 'bidi', '4'), // I²C data
    pin('5', 'XDA', 'bidi', '5'), // auxiliary I²C master data
    pin('6', 'XCL', 'output', '6'), // auxiliary I²C master clock
    pin('7', 'AD0', 'input', '7'), // address select: low→0x68, high→0x69
    pin('8', 'INT', 'output', '8'), // data-ready / motion interrupt
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'MPU-6050', sizeNm: Math.round(G * 0.55) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: 3 * G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: G }, dir: 'W' }, // GND
      { key: '7', at: { x: -4 * G, y: -G }, dir: 'W' }, // AD0
      { key: '8', at: { x: -4 * G, y: -3 * G }, dir: 'W' }, // INT
      { key: '3', at: { x: 4 * G, y: 3 * G }, dir: 'E' }, // SCL
      { key: '4', at: { x: 4 * G, y: G }, dir: 'E' }, // SDA
      { key: '5', at: { x: 4 * G, y: -G }, dir: 'E' }, // XDA
      { key: '6', at: { x: 4 * G, y: -3 * G }, dir: 'E' }, // XCL
    ],
  },
  parametrics: { currentDrawA: 0.0039, maxVoltage: 5 }, // ~3.9 mA accel+gyro; module VCC 3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against components101 + lastminuteengineers GY-521 pinouts and the InvenSense MPU-6000/6050 datasheet (NOT taken from the shared component log): header order 1 VCC, 2 GND, 3 SCL, 4 SDA, 5 XDA, 6 XCL, 7 AD0, 8 INT. I²C addr 0x68 (AD0 low) / 0x69 (AD0 high); XDA/XCL = auxiliary I²C master. Module is 3.3 V with onboard regulator, VCC tolerant 3–5 V. See inbox/2026-06-21-mpu6050-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// DS1302 RTC module — Maxim/Analog Devices DS1302 trickle-charge timekeeping chip
// on the common 5-pin breakout (coin-cell backup + 32.768 kHz crystal onboard).
// NOTE: 3-wire SERIAL interface, NOT I²C — a frequent misconception. The three
// signal lines are CLK (serial clock, MCU→module), DAT (bidirectional data), and
// RST/CE (chip enable, MCU-driven, active HIGH during a transfer). The chip is
// 8-pin (VCC1/VCC2/GND/SCLK/I/O/CE/X1/X2); the module breaks out only the 5 useful
// header pins. Schematic-only (module land pattern deferred, like the other modules).
const ds1302 = definePart({
  id: 'core:ds1302',
  name: 'DS1302 RTC module (3-wire)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'DS1302',
  manufacturer: 'Maxim/Analog Devices',
  datasheetUrl: 'https://www.analog.com/media/en/technical-documentation/data-sheets/ds1302.pdf',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // module power 2.0–5.5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'CLK', 'input', '3'), // SCLK — serial clock from MCU
    pin('4', 'DAT', 'bidi', '4'), // I/O — bidirectional serial data
    pin('5', 'RST', 'input', '5'), // CE — chip enable, active HIGH during transfer
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'DS1302', sizeNm: Math.round(G * 0.55) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: 3 * G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: 3 * G }, dir: 'E' }, // CLK
      { key: '4', at: { x: 4 * G, y: G }, dir: 'E' }, // DAT
      { key: '5', at: { x: 4 * G, y: -G }, dir: 'E' }, // RST
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // chip 2.0–5.5 V full operation
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against the Analog Devices DS1302 datasheet plus electropeak / espboards / SunFounder UMSK / components101 module pinouts (NOT taken from the shared component log): module 5-pin header order 1 VCC, 2 GND, 3 CLK, 4 DAT, 5 RST. DS1302 is a 3-WIRE SERIAL part (NOT I²C): CLK=serial clock (in), DAT=bidirectional I/O, RST/CE=chip enable (in, active HIGH). Chip is 8-pin (VCC1/VCC2/GND/SCLK/I/O/CE/X1/X2); the module exposes only the 5 useful pins and carries the 32.768 kHz crystal + coin-cell backup. See inbox/2026-06-21-ds1302-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// DS3231 RTC module (ZS-042) — Maxim/Analog Devices DS3231 extremely-accurate
// TCXO I²C RTC. Unlike the DS1302 above, this part genuinely IS I²C (addr 0x68).
// The ZS-042 board also carries an AT24C32 EEPROM (0x57) sharing the same SDA/SCL;
// we model only the DS3231's 6-pin header here. Two open-drain outputs (SQW alarm/
// square-wave, 32K 32.768 kHz clock) both need external pull-ups.
// Header order note: the ZS-042 has two 6-pin headers on opposite edges and silk
// order is board-revision-dependent (some boards reverse it); the pin NAMES and
// functions are fixed. We number 1–6 in the dominant published order
// (32K, SQW, SCL, SDA, VCC, GND). Schematic-only (module land pattern deferred).
const ds3231 = definePart({
  id: 'core:ds3231',
  name: 'DS3231 RTC module (ZS-042, I²C)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'DS3231',
  manufacturer: 'Maxim/Analog Devices',
  datasheetUrl: 'https://www.analog.com/media/en/technical-documentation/data-sheets/ds3231.pdf',
  pins: [
    pin('1', '32K', 'output', '1'), // 32.768 kHz output (open-drain, needs pull-up)
    pin('2', 'SQW', 'output', '2'), // square-wave / alarm interrupt (open-drain, needs pull-up)
    pin('3', 'SCL', 'input', '3'), // I²C clock in
    pin('4', 'SDA', 'bidi', '4'), // I²C data
    pin('5', 'VCC', 'power_in', '5'), // 3.3–5.5 V
    pin('6', 'GND', 'power_in', '6'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'DS3231', sizeNm: Math.round(G * 0.55) },
    ],
    pins: [
      { key: '5', at: { x: -4 * G, y: 3 * G }, dir: 'W' }, // VCC
      { key: '6', at: { x: -4 * G, y: G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: 3 * G }, dir: 'E' }, // SCL
      { key: '4', at: { x: 4 * G, y: G }, dir: 'E' }, // SDA
      { key: '2', at: { x: 4 * G, y: -G }, dir: 'E' }, // SQW
      { key: '1', at: { x: 4 * G, y: -3 * G }, dir: 'E' }, // 32K
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // module 3.3–5.5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against the Analog Devices DS3231 datasheet plus components101 + Cirkit Designer ZS-042 module pinouts (NOT taken from the shared component log): 6-pin header names 32K, SQW, SCL, SDA, VCC, GND. DS3231 IS I²C (addr 0x68) — contrast the 3-wire DS1302. SCL=clock in, SDA=bidirectional; SQW (square-wave/alarm) and 32K (32.768 kHz) are open-drain outputs needing external pull-ups. ZS-042 board also has an AT24C32 EEPROM (0x57) on the same bus — not modeled here. Header silk order is board-revision-dependent (two mirrored 6-pin headers); pin names/functions are fixed, numbering follows the dominant published order. See inbox/2026-06-21-ds3231-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// ULN2003 stepper driver board — the ubiquitous board paired with the 28BYJ-48
// 5-wire unipolar stepper. A ULN2003A Darlington array sinks the four motor phases;
// IN1–IN4 are control inputs from the MCU, with VCC/GND (5 V) for motor power and a
// removable enable jumper. The 5-wire 28BYJ-48 plugs into a keyed JST socket — that
// socket is NOT modeled as header pins here (it mates with the motor, not breadboard
// wiring); we model the 6 pins a user actually wires. Schematic-only, footprint deferred.
const uln2003Stepper = definePart({
  id: 'core:uln2003-stepper',
  name: 'ULN2003 stepper driver board',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'ULN2003',
  manufacturer: 'generic (ULN2003A Darlington array)',
  datasheetUrl: 'https://www.ti.com/lit/ds/symlink/uln2003a.pdf',
  pins: [
    pin('1', 'IN1', 'input', '1'), // phase A control from MCU
    pin('2', 'IN2', 'input', '2'), // phase B
    pin('3', 'IN3', 'input', '3'), // phase C
    pin('4', 'IN4', 'input', '4'), // phase D
    pin('5', 'VCC', 'power_in', '5'), // motor power, 5 V (via enable jumper)
    pin('6', 'GND', 'power_in', '6'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'ULN2003', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: 3 * G }, dir: 'W' }, // IN1
      { key: '2', at: { x: -4 * G, y: G }, dir: 'W' }, // IN2
      { key: '3', at: { x: -4 * G, y: -G }, dir: 'W' }, // IN3
      { key: '4', at: { x: -4 * G, y: -3 * G }, dir: 'W' }, // IN4
      { key: '5', at: { x: 4 * G, y: 3 * G }, dir: 'E' }, // VCC
      { key: '6', at: { x: 4 * G, y: -3 * G }, dir: 'E' }, // GND
    ],
  },
  parametrics: { maxVoltage: 12 }, // ULN2003A outputs rated to ~50 V; board commonly 5 V for 28BYJ-48
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against lastminuteengineers + makerguides + DigiKey ULN2003/28BYJ-48 tutorials and the TI ULN2003A datasheet (NOT taken from the shared component log): control header IN1, IN2, IN3, IN4 (MCU inputs) plus VCC/GND power (5 V via the enable jumper). The 5-wire 28BYJ-48 plugs into a keyed JST socket that is intentionally NOT modeled as header pins. IN1–IN4 drive the four Darlington channels sinking the motor phases. See inbox/2026-06-21-uln2003-stepper-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// L298N dual H-bridge motor driver module — the common red board with heatsink and
// an onboard 78M05 regulator. Drives 2 DC motors (or one bipolar stepper). Vs (motor
// supply) 2.5–46 V, 2 A/channel continuous. Control: ENA + IN1/IN2 for bridge A,
// IN3/IN4 + ENB for bridge B (EN pins take PWM for speed, IN pins set direction).
// The +5V pin is the 78M05's regulated output when the onboard jumper is fitted (the
// usual case), or a 5 V logic INPUT if the jumper is removed for Vs > 12 V — we model
// it as a power rail pin and document the dual role. Schematic-only, footprint deferred.
const l298n = definePart({
  id: 'core:l298n',
  name: 'L298N dual H-bridge motor driver',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'L298N',
  manufacturer: 'STMicroelectronics (L298)',
  datasheetUrl: 'https://www.st.com/resource/en/datasheet/l298.pdf',
  pins: [
    pin('1', '+12V', 'power_in', '1'), // Vs — motor supply 2.5–46 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', '+5V', 'power_in', '3'), // VSS logic; 78M05 OUT when jumper fitted (dual role)
    pin('4', 'ENA', 'input', '4'), // bridge-A enable / PWM
    pin('5', 'IN1', 'input', '5'), // bridge-A direction
    pin('6', 'IN2', 'input', '6'),
    pin('7', 'IN3', 'input', '7'), // bridge-B direction
    pin('8', 'IN4', 'input', '8'),
    pin('9', 'ENB', 'input', '9'), // bridge-B enable / PWM
    pin('10', 'OUT1', 'output', '10'), // bridge A
    pin('11', 'OUT2', 'output', '11'),
    pin('12', 'OUT3', 'output', '12'), // bridge B
    pin('13', 'OUT4', 'output', '13'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -7 * G, w: 8 * G, h: 14 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'L298N', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '4', at: { x: -5 * G, y: 5 * G }, dir: 'W' }, // ENA
      { key: '5', at: { x: -5 * G, y: 3 * G }, dir: 'W' }, // IN1
      { key: '6', at: { x: -5 * G, y: G }, dir: 'W' }, // IN2
      { key: '7', at: { x: -5 * G, y: -G }, dir: 'W' }, // IN3
      { key: '8', at: { x: -5 * G, y: -3 * G }, dir: 'W' }, // IN4
      { key: '9', at: { x: -5 * G, y: -5 * G }, dir: 'W' }, // ENB
      { key: '10', at: { x: 5 * G, y: 6 * G }, dir: 'E' }, // OUT1
      { key: '11', at: { x: 5 * G, y: 4 * G }, dir: 'E' }, // OUT2
      { key: '12', at: { x: 5 * G, y: 2 * G }, dir: 'E' }, // OUT3
      { key: '13', at: { x: 5 * G, y: 0 }, dir: 'E' }, // OUT4
      { key: '1', at: { x: 5 * G, y: -2 * G }, dir: 'E' }, // +12V
      { key: '2', at: { x: 5 * G, y: -4 * G }, dir: 'E' }, // GND
      { key: '3', at: { x: 5 * G, y: -6 * G }, dir: 'E' }, // +5V
    ],
  },
  parametrics: { maxVoltage: 46 }, // Vs up to 46 V (abs max 50 V)
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against the ST L298 datasheet plus components101 + etechnophiles + lastminuteengineers L298N module pinouts (NOT taken from the shared component log): power +12V (Vs 2.5–46 V) / GND / +5V (logic), control header ENA, IN1, IN2, IN3, IN4, ENB, motor outputs OUT1/OUT2 (bridge A) and OUT3/OUT4 (bridge B). ENA/ENB take PWM (speed), IN pins set direction. +5V is the onboard 78M05 regulator OUTPUT when the jumper is fitted (usual) or a 5 V logic INPUT when removed (Vs > 12 V) — modeled as a power rail pin, dual role documented. 2 A/channel continuous, 3 A peak. See inbox/2026-06-21-l298n-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// MAX7219 LED display driver module (8x8 dot-matrix / 7-seg). SPI-like 3-wire
// interface: DIN (serial data in), CLK (clock), CS/LOAD (latch). The module has a
// 5-pin INPUT header (VCC, GND, DIN, CS, CLK) wired to the MCU and a 5-pin OUTPUT
// header for daisy-chaining (VCC, GND, DOUT, CS, CLK) — the two share VCC/GND/CS/CLK,
// so the only distinct extra signal is DOUT. We model the 6 unique signals: chain by
// wiring this module's DOUT to the next module's DIN. Schematic-only, footprint deferred.
const max7219 = definePart({
  id: 'core:max7219',
  name: 'MAX7219 LED matrix driver module (SPI)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'MAX7219',
  manufacturer: 'Maxim/Analog Devices',
  datasheetUrl: 'https://www.analog.com/media/en/technical-documentation/data-sheets/MAX7219-MAX7221.pdf',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // 5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'DIN', 'input', '3'), // serial data in (from MCU MOSI)
    pin('4', 'CS', 'input', '4'), // chip select / LOAD latch
    pin('5', 'CLK', 'input', '5'), // serial clock
    pin('6', 'DOUT', 'output', '6'), // daisy-chain data out → next module's DIN
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -5 * G, w: 6 * G, h: 10 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'MAX7219', sizeNm: Math.round(G * 0.45) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: 4 * G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: 2 * G }, dir: 'W' }, // GND
      { key: '3', at: { x: -4 * G, y: 0 }, dir: 'W' }, // DIN
      { key: '4', at: { x: -4 * G, y: -2 * G }, dir: 'W' }, // CS
      { key: '5', at: { x: -4 * G, y: -4 * G }, dir: 'W' }, // CLK
      { key: '6', at: { x: 4 * G, y: 0 }, dir: 'E' }, // DOUT
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // MAX7219 operates 4.0–5.5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against the Analog Devices MAX7219/MAX7221 datasheet plus components101 + lastminuteengineers + Cirkit Designer module pinouts (NOT taken from the shared component log): input header VCC, GND, DIN, CS, CLK; output header VCC, GND, DOUT, CS, CLK (shares VCC/GND/CS/CLK). SPI-like 3-wire: DIN=serial data in, CLK=clock, CS=LOAD latch; DOUT cascades to the next module’s DIN. Modeled as the 6 unique signals. See inbox/2026-06-21-max7219-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// 1602A character LCD (HD44780 controller) — the classic 16-pin parallel 16x2
// display. VSS/VDD power, V0 contrast (pot wiper), RS/RW/E control, D0–D7 an 8-bit
// bidirectional data bus (4-bit mode uses only D4–D7; the busy flag is read back on
// D7, hence the bus is bidi not input-only), and A/K backlight LED. Schematic-only,
// footprint deferred. (The bare parallel module — an I²C-backpack variant is separate.)
const lcd1602 = definePart({
  id: 'core:lcd1602',
  name: '1602A 16x2 character LCD (HD44780)',
  refPrefix: 'U',
  class: 'ic',
  mpn: '1602A',
  manufacturer: 'generic (Hitachi HD44780 controller)',
  datasheetUrl: 'https://www.sparkfun.com/datasheets/LCD/HD44780.pdf',
  pins: [
    pin('1', 'VSS', 'power_in', '1'), // ground
    pin('2', 'VDD', 'power_in', '2'), // +5 V (4.7–5.3 V)
    pin('3', 'V0', 'input', '3'), // contrast (pot wiper)
    pin('4', 'RS', 'input', '4'), // register select (command/data)
    pin('5', 'RW', 'input', '5'), // read/write select
    pin('6', 'E', 'input', '6'), // enable strobe
    pin('7', 'D0', 'bidi', '7'),
    pin('8', 'D1', 'bidi', '8'),
    pin('9', 'D2', 'bidi', '9'),
    pin('10', 'D3', 'bidi', '10'),
    pin('11', 'D4', 'bidi', '11'),
    pin('12', 'D5', 'bidi', '12'),
    pin('13', 'D6', 'bidi', '13'),
    pin('14', 'D7', 'bidi', '14'), // also carries the busy flag on read
    pin('15', 'A', 'power_in', '15'), // backlight LED anode (+)
    pin('16', 'K', 'power_in', '16'), // backlight LED cathode (−)
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -8 * G, w: 8 * G, h: 16 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: '1602 LCD', sizeNm: Math.round(G * 0.45) },
    ],
    pins: [
      { key: '1', at: { x: -5 * G, y: 7 * G }, dir: 'W' }, // VSS
      { key: '2', at: { x: -5 * G, y: 5 * G }, dir: 'W' }, // VDD
      { key: '3', at: { x: -5 * G, y: 3 * G }, dir: 'W' }, // V0
      { key: '4', at: { x: -5 * G, y: G }, dir: 'W' }, // RS
      { key: '5', at: { x: -5 * G, y: -G }, dir: 'W' }, // RW
      { key: '6', at: { x: -5 * G, y: -3 * G }, dir: 'W' }, // E
      { key: '15', at: { x: -5 * G, y: -5 * G }, dir: 'W' }, // A
      { key: '16', at: { x: -5 * G, y: -7 * G }, dir: 'W' }, // K
      { key: '7', at: { x: 5 * G, y: 7 * G }, dir: 'E' }, // D0
      { key: '8', at: { x: 5 * G, y: 5 * G }, dir: 'E' }, // D1
      { key: '9', at: { x: 5 * G, y: 3 * G }, dir: 'E' }, // D2
      { key: '10', at: { x: 5 * G, y: G }, dir: 'E' }, // D3
      { key: '11', at: { x: 5 * G, y: -G }, dir: 'E' }, // D4
      { key: '12', at: { x: 5 * G, y: -3 * G }, dir: 'E' }, // D5
      { key: '13', at: { x: 5 * G, y: -5 * G }, dir: 'E' }, // D6
      { key: '14', at: { x: 5 * G, y: -7 * G }, dir: 'E' }, // D7
    ],
  },
  parametrics: { maxVoltage: 5.3 }, // VDD 4.7–5.3 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against the Hitachi HD44780U datasheet plus components101 + circuitdigest 16x2 LCD pinouts (NOT taken from the shared component log): 1 VSS, 2 VDD, 3 V0 (contrast), 4 RS, 5 RW, 6 E, 7–14 D0–D7, 15 A (LED+), 16 K (LED−). D0–D7 are a bidirectional bus (4-bit mode uses D4–D7; busy flag is read on D7) so modeled as bidi, not input-only. RS/RW/E are control inputs; V0 is the analog contrast input. See inbox/2026-06-21-lcd1602-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// RC522 RFID reader module (NXP MFRC522, 13.56 MHz). 8-pin SPI header. The module is
// an SPI slave: SDA (= SS/CS), SCK, MOSI, RST are master-driven inputs; MISO and IRQ
// are outputs. 3.3 V part (comms pins 5 V tolerant). Schematic-only, footprint deferred.
const rc522 = definePart({
  id: 'core:rc522',
  name: 'RC522 RFID reader module (SPI)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'RC522',
  manufacturer: 'NXP (MFRC522)',
  datasheetUrl: 'https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf',
  pins: [
    pin('1', 'SDA', 'input', '1'), // SS/CS — slave select (master-driven)
    pin('2', 'SCK', 'input', '2'), // SPI clock from master
    pin('3', 'MOSI', 'input', '3'), // master out → slave in
    pin('4', 'MISO', 'output', '4'), // slave out → master in
    pin('5', 'IRQ', 'output', '5'), // interrupt request out
    pin('6', 'GND', 'power_in', '6'),
    pin('7', 'RST', 'input', '7'), // reset (master-driven)
    pin('8', '3.3V', 'power_in', '8'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -5 * G, w: 6 * G, h: 10 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'RC522', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '8', at: { x: -4 * G, y: 3 * G }, dir: 'W' }, // 3.3V
      { key: '6', at: { x: -4 * G, y: G }, dir: 'W' }, // GND
      { key: '7', at: { x: -4 * G, y: -G }, dir: 'W' }, // RST
      { key: '5', at: { x: -4 * G, y: -3 * G }, dir: 'W' }, // IRQ
      { key: '1', at: { x: 4 * G, y: 3 * G }, dir: 'E' }, // SDA/SS
      { key: '2', at: { x: 4 * G, y: G }, dir: 'E' }, // SCK
      { key: '3', at: { x: 4 * G, y: -G }, dir: 'E' }, // MOSI
      { key: '4', at: { x: 4 * G, y: -3 * G }, dir: 'E' }, // MISO
    ],
  },
  parametrics: { maxVoltage: 3.6 }, // MFRC522 2.5–3.6 V; comms pins 5 V tolerant
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against the NXP MFRC522 datasheet plus components101 + microcontrollerslab + espboards RC522 module pinouts (NOT taken from the shared component log): 8-pin header order SDA (SS/CS), SCK, MOSI, MISO, IRQ, GND, RST, 3.3V. SPI slave: SDA/SCK/MOSI/RST are master-driven inputs, MISO and IRQ are outputs. 3.3 V part with 5 V-tolerant comms pins. The module also supports I²C/UART but the board is strapped for SPI. See inbox/2026-06-21-rc522-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// TB6612FNG dual motor driver breakout — Toshiba TB6612FNG, a MOSFET H-bridge pair
// (more efficient than the bipolar L298N). Drives 2 DC motors at 1.2 A continuous
// (3.2 A peak). Per motor: AIN1/AIN2 (or BIN1/BIN2) set direction, PWMA/PWMB set
// speed, STBY (active-low) enables the chip. VM = motor supply (≤15 V), VCC = logic
// (2.7–5.5 V). Modeled as the 14 unique signals across the breakout's two headers.
// Schematic-only, footprint deferred.
const tb6612fng = definePart({
  id: 'core:tb6612fng',
  name: 'TB6612FNG dual motor driver',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'TB6612FNG',
  manufacturer: 'Toshiba',
  datasheetUrl: 'https://cdn.sparkfun.com/datasheets/Robotics/TB6612FNG.pdf',
  pins: [
    pin('1', 'VM', 'power_in', '1'), // motor supply ≤15 V
    pin('2', 'VCC', 'power_in', '2'), // logic 2.7–5.5 V
    pin('3', 'GND', 'power_in', '3'),
    pin('4', 'AO1', 'output', '4'), // motor A output
    pin('5', 'AO2', 'output', '5'),
    pin('6', 'BO1', 'output', '6'), // motor B output
    pin('7', 'BO2', 'output', '7'),
    pin('8', 'PWMA', 'input', '8'), // motor A speed (PWM)
    pin('9', 'AIN1', 'input', '9'), // motor A direction
    pin('10', 'AIN2', 'input', '10'),
    pin('11', 'STBY', 'input', '11'), // standby, active-low (pull high to enable)
    pin('12', 'BIN1', 'input', '12'), // motor B direction
    pin('13', 'BIN2', 'input', '13'),
    pin('14', 'PWMB', 'input', '14'), // motor B speed (PWM)
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -7 * G, w: 8 * G, h: 14 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'TB6612', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '8', at: { x: -5 * G, y: 6 * G }, dir: 'W' }, // PWMA
      { key: '9', at: { x: -5 * G, y: 4 * G }, dir: 'W' }, // AIN1
      { key: '10', at: { x: -5 * G, y: 2 * G }, dir: 'W' }, // AIN2
      { key: '11', at: { x: -5 * G, y: 0 }, dir: 'W' }, // STBY
      { key: '12', at: { x: -5 * G, y: -2 * G }, dir: 'W' }, // BIN1
      { key: '13', at: { x: -5 * G, y: -4 * G }, dir: 'W' }, // BIN2
      { key: '14', at: { x: -5 * G, y: -6 * G }, dir: 'W' }, // PWMB
      { key: '1', at: { x: 5 * G, y: 6 * G }, dir: 'E' }, // VM
      { key: '2', at: { x: 5 * G, y: 4 * G }, dir: 'E' }, // VCC
      { key: '3', at: { x: 5 * G, y: 2 * G }, dir: 'E' }, // GND
      { key: '4', at: { x: 5 * G, y: 0 }, dir: 'E' }, // AO1
      { key: '5', at: { x: 5 * G, y: -2 * G }, dir: 'E' }, // AO2
      { key: '6', at: { x: 5 * G, y: -4 * G }, dir: 'E' }, // BO1
      { key: '7', at: { x: 5 * G, y: -6 * G }, dir: 'E' }, // BO2
    ],
  },
  parametrics: { maxVoltage: 15 }, // VM max 15 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against the Toshiba TB6612FNG datasheet plus the SparkFun TB6612FNG breakout hookup guide + Cirkit Designer (NOT taken from the shared component log): power VM (≤15 V) / VCC (2.7–5.5 V) / GND, motor outputs AO1/AO2 (A) and BO1/BO2 (B), control PWMA, AIN1, AIN2, STBY, BIN1, BIN2, PWMB. STBY is active-low (pull high to enable). PWMx = speed, xIN1/xIN2 = direction (CW/CCW/brake/stop). MOSFET H-bridge, 1.2 A continuous / 3.2 A peak per channel. Tyler owns the OSEPP shield variant; the TB6612FNG pin functions are identical. See inbox/2026-06-21-tb6612fng-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-038 sound sensor module — electret microphone + LM393 comparator. The canonical
// "comparator sensor module" pattern (shared by flame/IR/soil/etc.): VCC, GND, a
// threshold DO (digital, set by the onboard pot) and a continuous AO (analog). Header
// silk order is board-revision-dependent; pin names/functions are fixed. Schematic-
// only, footprint deferred. Opens the Tier-2 sensor-module set.
const ky038 = definePart({
  id: 'core:ky038',
  name: 'KY-038 sound sensor module',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'KY-038',
  manufacturer: 'generic (LM393 comparator + electret mic)',
  datasheetUrl: 'https://sensorkit.joy-it.net/en/sensors/ky-038',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // 3.3–5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'DO', 'output', '3'), // digital threshold (HIGH when sound > pot setpoint)
    pin('4', 'AO', 'output', '4'), // analog sound-level out
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'KY-038', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: G }, dir: 'E' }, // DO
      { key: '4', at: { x: 4 * G, y: -G }, dir: 'E' }, // AO
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against espboards + circuitdigest + microcontrollerslab KY-038 pinouts and the LM393 comparator basis (NOT taken from the shared component log): pins VCC, GND, DO (digital threshold, set by onboard pot), AO (analog sound level). DO/AO are outputs; power pins power_in. Header silk ORDER is board-revision-dependent (espboards shows +V, GND, DO, AO) — pin names/functions are fixed, numbering follows that order. See inbox/2026-06-21-ky038-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// Flame sensor module — IR photodiode + LM393 comparator (the KY-038 pattern, tuned
// to ~760–1100 nm IR from a flame). 4-pin variant: VCC, GND, DO (pot-threshold
// digital) and AO (analog IR level). (A cut-down 3-pin DO-only variant also exists;
// Tyler's is the 4-pin.) Schematic-only, footprint deferred.
const flameSensor = definePart({
  id: 'core:flame-sensor',
  name: 'Flame sensor module (IR + LM393)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'Flame-LM393',
  manufacturer: 'generic (IR photodiode + LM393 comparator)',
  datasheetUrl: 'https://docs.sunfounder.com/projects/ultimate-sensor-kit/en/latest/components_basic/03-component_flame.html',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // 3.3–5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'DO', 'output', '3'), // digital threshold (flame detected > pot setpoint)
    pin('4', 'AO', 'output', '4'), // analog IR level
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'FLAME', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: G }, dir: 'E' }, // DO
      { key: '4', at: { x: 4 * G, y: -G }, dir: 'E' }, // AO
    ],
  },
  parametrics: { maxVoltage: 5.5, currentDrawA: 0.007 }, // 3.3–5 V, <7 mA
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against circuitdigest + SunFounder Ultimate Sensor Kit flame-sensor pinouts and the LM393 comparator basis (NOT taken from the shared component log): 4-pin module VCC, GND, DO (pot-threshold digital), AO (analog IR level). IR photodiode front-end, ~760–1100 nm. DO/AO outputs, power pins power_in; <7 mA. A 3-pin DO-only variant also ships in some kits — Tyler owns the 4-pin. Header silk order is board-revision-dependent (names/functions fixed). See inbox/2026-06-21-flame-sensor-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// IR obstacle-avoidance sensor module — active IR LED emitter + photodiode receiver +
// LM393 comparator. 3-pin (digital-only, no analog out): VCC, GND, OUT. OUT is
// active-LOW — goes low when reflected IR exceeds the pot threshold (obstacle within
// ~2–20 cm). Schematic-only, footprint deferred.
const irObstacle = definePart({
  id: 'core:ir-obstacle',
  name: 'IR obstacle-avoidance sensor module',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'IR-Obstacle-LM393',
  manufacturer: 'generic (IR LED + photodiode + LM393)',
  datasheetUrl: 'https://osoyoo.com/2018/12/21/ir-obstacle-avoidance-module/',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // 3.3–5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'OUT', 'output', '3'), // digital, active-LOW when obstacle detected
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'IR-OBST', sizeNm: Math.round(G * 0.42) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: 0 }, dir: 'E' }, // OUT
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against Cirkit Designer + osoyoo + multiple IR-obstacle-module pinouts and the LM393 comparator basis (NOT taken from the shared component log): 3-pin module VCC, GND, OUT. Digital-only (no analog out); OUT is active-LOW — goes low when reflected IR exceeds the pot threshold (obstacle ~2–20 cm, 35° cone). Power pins power_in, OUT output. See inbox/2026-06-21-ir-obstacle-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// Soil moisture sensor module (FC-28) — resistive: a YL-69 two-prong probe wired into
// a YL-38 comparator board (LM393 + pot). The KY-038 comparator-module pattern again:
// the YL-38 board's MCU-facing header is VCC, GND, DO (pot threshold), AO (analog
// moisture level). The probe connects to the board over a separate 2-pin terminal
// (not modeled). (A 3-pin capacitive v1.2 variant also exists; this is the resistive
// FC-28.) Schematic-only, footprint deferred.
const soilMoisture = definePart({
  id: 'core:soil-moisture',
  name: 'Soil moisture sensor module (FC-28)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'FC-28',
  manufacturer: 'generic (YL-69 probe + YL-38/LM393 board)',
  datasheetUrl: 'https://components101.com/modules/soil-moisture-sensor-module',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // 3.3–5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'DO', 'output', '3'), // digital threshold (dry/wet, set by onboard pot)
    pin('4', 'AO', 'output', '4'), // analog moisture level (0–VCC)
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'SOIL', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: G }, dir: 'E' }, // DO
      { key: '4', at: { x: 4 * G, y: -G }, dir: 'E' }, // AO
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against components101 + Random Nerd Tutorials + Cirkit Designer YL-69/FC-28 pinouts and the LM393 comparator basis (NOT taken from the shared component log): YL-38 comparator board MCU header VCC, GND, DO (pot threshold), AO (analog 0–VCC moisture). Resistive sensor — the YL-69 two-prong probe wires into the YL-38 board over a separate 2-pin terminal (not modeled). DO/AO outputs, power pins power_in. A 3-pin capacitive v1.2 variant exists separately. See inbox/2026-06-21-soil-moisture-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// TTP223 capacitive touch sensor module — a dedicated Tontek TTP223 touch IC (NOT an
// LM393 comparator like the other Tier-2 sensors). 3-pin: VCC, GND, SIG. SIG is a
// push-pull digital output (no pull-up needed), active-HIGH by default; solder pads A
// (toggle mode) and B (invert to active-low) reconfigure it. Schematic-only, deferred.
const ttp223 = definePart({
  id: 'core:ttp223',
  name: 'TTP223 capacitive touch sensor module',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'TTP223',
  manufacturer: 'Tontek (TTP223 touch IC)',
  datasheetUrl: 'https://electropeak.com/learn/interfacing-ttp223-capacitance-touch-sensor-with-arduino/',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // 2.0–5.5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'SIG', 'output', '3'), // push-pull digital, active-HIGH default
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'TTP223', sizeNm: Math.round(G * 0.45) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: 0 }, dir: 'E' }, // SIG
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 2.0–5.5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against componentindex + pcbsync + electropeak TTP223 module pinouts and the Tontek TTP223 touch-IC basis (NOT taken from the shared component log): 3-pin VCC, GND, SIG. SIG is a push-pull digital output (no external pull-up), active-HIGH by default; rear solder pad A = toggle mode, pad B = invert to active-LOW. 2.0–5.5 V. Power pins power_in, SIG output. Header silk order is board-revision-dependent (names/functions fixed). See inbox/2026-06-21-ttp223-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-006 passive piezo buzzer module — an OUTPUT transducer (first non-sensor Tier-2
// part). Passive = no onboard oscillator; the MCU drives S with a square wave (tone())
// to set pitch (~1.5–2.5 kHz, loudest near 2 kHz). 3-pin: S (signal in), middle VCC
// (often NC on KY-006/HW-508), GND. Schematic-only, footprint deferred.
const ky006Buzzer = definePart({
  id: 'core:ky006-buzzer',
  name: 'KY-006 passive buzzer module',
  refPrefix: 'LS',
  class: 'ic',
  mpn: 'KY-006',
  manufacturer: 'generic (passive piezo buzzer)',
  datasheetUrl: 'https://sensorkit.joy-it.net/en/sensors/ky-006',
  pins: [
    pin('1', 'S', 'input', '1'), // square-wave drive from MCU (tone())
    pin('2', 'VCC', 'power_in', '2'), // middle pin — often NC on KY-006/HW-508
    pin('3', 'GND', 'power_in', '3'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'BUZZER', sizeNm: Math.round(G * 0.42) },
    ],
    pins: [
      { key: '2', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '3', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '1', at: { x: 4 * G, y: 0 }, dir: 'E' }, // S
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V drive
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against thegeekpub + espboards + arduinomodules + joy-it SensorKit KY-006 pinouts (NOT taken from the shared component log): 3-pin S (signal), middle VCC, GND. PASSIVE buzzer — no onboard oscillator; the MCU supplies a square wave on S (Arduino tone()), ~1.5–2.5 kHz, loudest near 2 kHz (contrast the active KY-012 which self-oscillates). On most KY-006/HW-508 boards the middle VCC pin is NC — wire S to a GPIO and GND to ground. S is an input to the module; power pins power_in. refPrefix LS (loudspeaker/sounder). See inbox/2026-06-21-ky006-buzzer-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// SW-420 vibration sensor module — a spring vibration switch (normally-closed) + LM393
// comparator + sensitivity pot. 3-pin, digital-only: VCC, GND, DO. At rest DO reads
// LOW; vibration opens the switch and DO goes HIGH. Schematic-only, footprint deferred.
const sw420Vibration = definePart({
  id: 'core:sw420-vibration',
  name: 'SW-420 vibration sensor module',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'SW-420',
  manufacturer: 'generic (SW-420 vibration switch + LM393)',
  datasheetUrl: 'https://components101.com/sensors/sw-420-vibration-sensor-module',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // 3.3–5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'DO', 'output', '3'), // digital: LOW at rest, HIGH on vibration
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'SW-420', sizeNm: Math.round(G * 0.45) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: 0 }, dir: 'E' }, // DO
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against components101 + microcontrollerslab + circuitdigest + SunFounder SW-420 pinouts and the LM393 comparator basis (NOT taken from the shared component log): 3-pin VCC, GND, DO. Digital-only (no analog). The SW-420 spring switch is normally-CLOSED — DO is LOW at rest and goes HIGH when vibration opens it; pot sets sensitivity. Power pins power_in, DO output. Header silk order is board-revision-dependent (names/functions fixed). See inbox/2026-06-21-sw420-vibration-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-008 laser transmitter module — a 650 nm 5 mW red laser diode + current-limit
// resistor (output emitter, like the buzzer). 3-pin: S (signal), middle VCC (unlabeled
// on most boards; some run the laser from S alone), GND. Drive S HIGH/PWM to fire.
// Schematic-only, footprint deferred.
const ky008Laser = definePart({
  id: 'core:ky008-laser',
  name: 'KY-008 laser diode module',
  refPrefix: 'D',
  class: 'ic',
  mpn: 'KY-008',
  manufacturer: 'generic (650 nm laser diode)',
  datasheetUrl: 'https://arduinomodules.info/ky-008-laser-transmitter-module/',
  pins: [
    pin('1', 'S', 'input', '1'), // on/off (or PWM) drive from MCU
    pin('2', 'VCC', 'power_in', '2'), // middle pin — 5 V (unlabeled; sometimes NC)
    pin('3', 'GND', 'power_in', '3'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'LASER', sizeNm: Math.round(G * 0.45) },
    ],
    pins: [
      { key: '2', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '3', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '1', at: { x: 4 * G, y: 0 }, dir: 'E' }, // S
    ],
  },
  parametrics: { maxVoltage: 5.5, currentDrawA: 0.04 }, // 5 V, <40 mA
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against arduinomodules + espboards + build-electronic-circuits + electropeak KY-008 pinouts (NOT taken from the shared component log): 3-pin S (signal), middle VCC (unlabeled on most silk; some boards run the laser from S alone so middle = NC), GND. 650 nm 5 mW, 5 V, <40 mA. Drive S HIGH/PWM to fire. S is an input to the module; power pins power_in. refPrefix D (diode emitter). See inbox/2026-06-21-ky008-laser-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-022 IR receiver module (HW-490) — a VS1838B/TL1838 38 kHz IR demodulator. 3-pin:
// S (demodulated signal OUT, idle-HIGH / LOW during bursts), middle VCC (2.7–5.5 V),
// GND. Pairs with the KY-005 IR transmitter below. Schematic-only, footprint deferred.
const ky022IrReceiver = definePart({
  id: 'core:ky022-ir-receiver',
  name: 'KY-022 IR receiver module (38 kHz)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'KY-022',
  manufacturer: 'generic (VS1838B / TL1838)',
  datasheetUrl: 'https://arduinomodules.info/ky-022-infrared-receiver-module/',
  pins: [
    pin('1', 'S', 'output', '1'), // demodulated signal out (idle HIGH, LOW on burst)
    pin('2', 'VCC', 'power_in', '2'), // middle pin — 2.7–5.5 V
    pin('3', 'GND', 'power_in', '3'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'IR-RECV', sizeNm: Math.round(G * 0.4) },
    ],
    pins: [
      { key: '2', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '3', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '1', at: { x: 4 * G, y: 0 }, dir: 'E' }, // S
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 2.7–5.5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against arduinomodules + thegeekpub + pinouts.net + espboards KY-022 pinouts and the VS1838B/TL1838 1838 IR-receiver IC (NOT taken from the shared component log): 3-pin S (signal), middle VCC (2.7–5.5 V), GND. 38 kHz band-pass demodulator; S is an OUTPUT — idle HIGH, pulled LOW during each IR burst. NOTE: the outer S and – order is NOT standardised across clones (middle is always VCC) — wire to the silk labels, not a fixed position. S output, power pins power_in. See inbox/2026-06-21-ky022-ir-receiver-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-005 IR transmitter module — a single 940 nm IR LED (the transmit half of the IR
// pair with KY-022 above). 3-pin: S (drive in — the MCU modulates a 38 kHz carrier via
// IRremote, through a series resistor), middle VCC (NC — no internal connection on
// KY-005), GND. Schematic-only, footprint deferred.
const ky005IrTransmitter = definePart({
  id: 'core:ky005-ir-transmitter',
  name: 'KY-005 IR transmitter module',
  refPrefix: 'D',
  class: 'ic',
  mpn: 'KY-005',
  manufacturer: 'generic (940 nm IR LED)',
  datasheetUrl: 'https://arduinomodules.info/ky-005-infrared-transmitter-sensor-module/',
  pins: [
    pin('1', 'S', 'input', '1'), // 38 kHz-modulated drive from MCU (via series R)
    pin('2', 'VCC', 'power_in', '2'), // middle pin — NC on KY-005 (no internal connection)
    pin('3', 'GND', 'power_in', '3'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'IR-XMIT', sizeNm: Math.round(G * 0.4) },
    ],
    pins: [
      { key: '2', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '3', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '1', at: { x: 4 * G, y: 0 }, dir: 'E' }, // S
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V drive (120Ω@3.3V / 220Ω@5V series R)
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against arduinomodules + espboards + thegeekpub + joy-it KY-005 pinouts (NOT taken from the shared component log): 3-pin S (signal), middle VCC, GND. Single 940 nm IR LED; the MCU drives S with a 38 kHz-modulated signal (IRremote) through a series resistor (120Ω@3.3V / 220Ω@5V). On KY-005 the middle VCC pin is NC (no internal connection) — practically wire S → GPIO, – → GND. S is an input to the module; refPrefix D (LED emitter). Pairs with KY-022 receiver. See inbox/2026-06-21-ky005-ir-transmitter-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// Slot-type IR optocoupler module — an ITR9606-style photo-interrupter (IR emitter +
// phototransistor facing across a 5 mm slot) + LM393 comparator + sensitivity pot.
// Common as an encoder/speed sensor: a slotted wheel chops the beam. 3-pin: VCC, GND,
// DO — DO is LOW when the slot is clear and HIGH when an object interrupts the beam.
// (A 4-pin AO variant exists.) Schematic-only, footprint deferred.
const slotOptocoupler = definePart({
  id: 'core:slot-optocoupler',
  name: 'Slot-type IR optocoupler module (LM393)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'ITR9606-LM393',
  manufacturer: 'generic (ITR9606 photo-interrupter + LM393)',
  datasheetUrl: 'https://www.diymore.cc/products/slot-type-ir-optocoupler-speed-sensor-module-lm393-for-arduino',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // 3.3–5 V
    pin('2', 'GND', 'power_in', '2'),
    pin('3', 'DO', 'output', '3'), // digital: LOW slot clear, HIGH when beam interrupted
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'SLOT-OPTO', sizeNm: Math.round(G * 0.34) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '2', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: 0 }, dir: 'E' }, // DO
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against multiple LM393 slot-optocoupler/speed-sensor module listings (diymore, DAOKI, Geekstory, SAYAL) and the ITR9606 photo-interrupter basis (NOT taken from the shared component log): 3-pin VCC, GND, DO. IR emitter + phototransistor across a 5 mm slot, LM393 squares the output; DO is LOW when the slot is clear and HIGH when an object interrupts the beam (pot sets sensitivity). Used as an encoder/speed sensor with a slotted chopper wheel. A 4-pin VCC/GND/DO/AO variant also exists. Power pins power_in, DO output. See inbox/2026-06-21-slot-optocoupler-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-016 RGB LED module — a 5 mm common-cathode RGB LED with three 150 Ω series
// resistors on board. 4-pin: R, G, B (each an anode driven by a PWM line through its
// resistor) and GND (the shared cathode). Drive R/G/B with PWM for full color.
// Schematic-only, footprint deferred.
const ky016RgbLed = definePart({
  id: 'core:ky016-rgb-led',
  name: 'KY-016 RGB LED module',
  refPrefix: 'D',
  class: 'ic',
  mpn: 'KY-016',
  manufacturer: 'generic (common-cathode RGB LED)',
  datasheetUrl: 'https://arduinomodules.info/ky-016-rgb-full-color-led-module/',
  pins: [
    pin('1', 'R', 'input', '1'), // red anode (PWM drive via 150Ω)
    pin('2', 'G', 'input', '2'), // green anode
    pin('3', 'B', 'input', '3'), // blue anode
    pin('4', 'GND', 'power_in', '4'), // common cathode / ground
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'RGB', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '4', at: { x: -4 * G, y: 0 }, dir: 'W' }, // GND (common cathode)
      { key: '1', at: { x: 4 * G, y: 2 * G }, dir: 'E' }, // R
      { key: '2', at: { x: 4 * G, y: 0 }, dir: 'E' }, // G
      { key: '3', at: { x: 4 * G, y: -2 * G }, dir: 'E' }, // B
    ],
  },
  parametrics: { maxVoltage: 5.5, currentDrawA: 0.06 }, // 3×20 mA per channel
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against arduinomodules + espboards + joy-it SensorKit + Cirkit Designer KY-016 pinouts (NOT taken from the shared component log): 4-pin R, G, B, GND. Common-CATHODE 5 mm RGB LED with three onboard 150 Ω series resistors; R/G/B are anodes driven by PWM lines (modeled as inputs to the module), GND is the shared cathode (power_in). 20 mA/channel; Vf ≈1.8 V red, ≈2.8 V green/blue. refPrefix D. Header silk order is board-revision-dependent (names/functions fixed). See inbox/2026-06-21-ky016-rgb-led-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// TM1637 4-digit 7-segment display module — a Titan Micro TM1637 LED driver + 4-digit
// display on a 2-wire bus. 4-pin: CLK, DIO, VCC, GND. The protocol is I²C-like but not
// standard I²C; DIO is bidirectional (the TM1637 can also scan a key matrix back over
// it), so it's modeled bidi. Schematic-only, footprint deferred.
const tm1637Display = definePart({
  id: 'core:tm1637-display',
  name: 'TM1637 4-digit 7-segment display',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'TM1637',
  manufacturer: 'Titan Micro (TM1637)',
  datasheetUrl: 'https://lastminuteengineers.com/tm1637-arduino-tutorial/',
  pins: [
    pin('1', 'CLK', 'input', '1'), // 2-wire clock from MCU
    pin('2', 'DIO', 'bidi', '2'), // 2-wire data I/O (also key-scan readback)
    pin('3', 'VCC', 'power_in', '3'), // 3.3–5 V
    pin('4', 'GND', 'power_in', '4'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'TM1637', sizeNm: Math.round(G * 0.42) },
    ],
    pins: [
      { key: '3', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '4', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '1', at: { x: 4 * G, y: G }, dir: 'E' }, // CLK
      { key: '2', at: { x: 4 * G, y: -G }, dir: 'E' }, // DIO
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against lastminuteengineers + makerguides + circuitdigest + Cirkit Designer TM1637 module pinouts and the Titan Micro TM1637 IC (NOT taken from the shared component log): 4-pin CLK, DIO, VCC, GND. 2-wire interface (I²C-like but not standard I²C); CLK is a clock input, DIO is bidirectional (data + optional key-scan readback) so modeled bidi. 3.3–5 V. Power pins power_in. See inbox/2026-06-21-tm1637-display-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-004 button module — a tactile push button + onboard 10 kΩ resistor (distinct
// from the bare `core:pushbutton`: this is a 3-pin module that outputs a clean logic
// level). 3-pin: S (signal out), middle VCC, GND. Standard pull-DOWN variant: S sits
// LOW at rest, HIGH when pressed (active-high). Schematic-only, footprint deferred.
const ky004Button = definePart({
  id: 'core:ky004-button',
  name: 'KY-004 button module',
  refPrefix: 'SW',
  class: 'ic',
  mpn: 'KY-004',
  manufacturer: 'generic (tactile button + 10kΩ)',
  datasheetUrl: 'https://arduinomodules.info/ky-004-key-switch-module/',
  pins: [
    pin('1', 'S', 'output', '1'), // logic level out: LOW at rest, HIGH pressed (pull-down)
    pin('2', 'VCC', 'power_in', '2'), // middle pin — 3.3–5 V
    pin('3', 'GND', 'power_in', '3'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'KY-004', sizeNm: Math.round(G * 0.45) },
    ],
    pins: [
      { key: '2', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC
      { key: '3', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '1', at: { x: 4 * G, y: 0 }, dir: 'E' }, // S
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against arduinomodules + espboards + joy-it SensorKit + Cirkit Designer KY-004 pinouts (NOT taken from the shared component log): 3-pin S (signal), middle VCC, GND. Tactile push button + onboard 10 kΩ; the standard (original Keyes) variant is pull-DOWN — S is LOW at rest and HIGH when pressed (active-high), so S is an OUTPUT from the module. Distinct from the bare 2-pin core:pushbutton. refPrefix SW. See inbox/2026-06-21-ky004-button-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// Arduino Nano (ATmega328P) — first Tier-3 board. 30 pins in two rows of 15. Digital
// D0–D13 (D0/D1 = UART RX/TX; D10–D13 = SPI SS/MOSI/MISO/SCK), analog A0–A7 (A4/A5 =
// I²C SDA/SCL; A6/A7 are analog-INPUT only), plus power (VIN in, regulated 5V & 3V3
// out), two GND, two RESET, and AREF. Modeled as a board: GPIO = bidi, analog-only =
// input, 5V/3V3 = power_out (onboard regulators source them), VIN/GND = power_in.
// (Tyler's is the DCCduino clone — identical pinout.) Schematic-only, footprint deferred.
const arduinoNano = definePart({
  id: 'core:arduino-nano',
  name: 'Arduino Nano (ATmega328P)',
  refPrefix: 'A',
  class: 'ic',
  mpn: 'Arduino Nano',
  manufacturer: 'Arduino (ATmega328P; DCCduino clone)',
  datasheetUrl: 'https://content.arduino.cc/assets/Pinout-NANO_latest.pdf',
  pins: [
    pin('1', 'D1', 'bidi', '1'), // TX
    pin('2', 'D0', 'bidi', '2'), // RX
    pin('3', 'RST', 'input', '3'), // reset (active-low)
    pin('4', 'GND', 'power_in', '4'),
    pin('5', 'D2', 'bidi', '5'),
    pin('6', 'D3', 'bidi', '6'),
    pin('7', 'D4', 'bidi', '7'),
    pin('8', 'D5', 'bidi', '8'),
    pin('9', 'D6', 'bidi', '9'),
    pin('10', 'D7', 'bidi', '10'),
    pin('11', 'D8', 'bidi', '11'),
    pin('12', 'D9', 'bidi', '12'),
    pin('13', 'D10', 'bidi', '13'), // SPI SS
    pin('14', 'D11', 'bidi', '14'), // SPI MOSI
    pin('15', 'D12', 'bidi', '15'), // SPI MISO
    pin('16', 'D13', 'bidi', '16'), // SPI SCK (onboard LED)
    pin('17', '3V3', 'power_out', '17'), // regulated 3.3 V out (≤50 mA)
    pin('18', 'AREF', 'input', '18'), // ADC reference in
    pin('19', 'A0', 'bidi', '19'),
    pin('20', 'A1', 'bidi', '20'),
    pin('21', 'A2', 'bidi', '21'),
    pin('22', 'A3', 'bidi', '22'),
    pin('23', 'A4', 'bidi', '23'), // I²C SDA
    pin('24', 'A5', 'bidi', '24'), // I²C SCL
    pin('25', 'A6', 'input', '25'), // analog-input only
    pin('26', 'A7', 'input', '26'), // analog-input only
    pin('27', '5V', 'power_out', '27'), // regulated 5 V out
    pin('28', 'RST', 'input', '28'), // second reset pin
    pin('29', 'GND', 'power_in', '29'),
    pin('30', 'VIN', 'power_in', '30'), // 7–12 V unregulated in
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -15 * G, w: 8 * G, h: 30 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'NANO', sizeNm: Math.round(G * 0.6) },
    ],
    pins: [
      // left column: keys 1–15, top (14G) to bottom (−14G), step −2G
      { key: '1', at: { x: -5 * G, y: 14 * G }, dir: 'W' },
      { key: '2', at: { x: -5 * G, y: 12 * G }, dir: 'W' },
      { key: '3', at: { x: -5 * G, y: 10 * G }, dir: 'W' },
      { key: '4', at: { x: -5 * G, y: 8 * G }, dir: 'W' },
      { key: '5', at: { x: -5 * G, y: 6 * G }, dir: 'W' },
      { key: '6', at: { x: -5 * G, y: 4 * G }, dir: 'W' },
      { key: '7', at: { x: -5 * G, y: 2 * G }, dir: 'W' },
      { key: '8', at: { x: -5 * G, y: 0 }, dir: 'W' },
      { key: '9', at: { x: -5 * G, y: -2 * G }, dir: 'W' },
      { key: '10', at: { x: -5 * G, y: -4 * G }, dir: 'W' },
      { key: '11', at: { x: -5 * G, y: -6 * G }, dir: 'W' },
      { key: '12', at: { x: -5 * G, y: -8 * G }, dir: 'W' },
      { key: '13', at: { x: -5 * G, y: -10 * G }, dir: 'W' },
      { key: '14', at: { x: -5 * G, y: -12 * G }, dir: 'W' },
      { key: '15', at: { x: -5 * G, y: -14 * G }, dir: 'W' },
      // right column: keys 16–30
      { key: '16', at: { x: 5 * G, y: 14 * G }, dir: 'E' },
      { key: '17', at: { x: 5 * G, y: 12 * G }, dir: 'E' },
      { key: '18', at: { x: 5 * G, y: 10 * G }, dir: 'E' },
      { key: '19', at: { x: 5 * G, y: 8 * G }, dir: 'E' },
      { key: '20', at: { x: 5 * G, y: 6 * G }, dir: 'E' },
      { key: '21', at: { x: 5 * G, y: 4 * G }, dir: 'E' },
      { key: '22', at: { x: 5 * G, y: 2 * G }, dir: 'E' },
      { key: '23', at: { x: 5 * G, y: 0 }, dir: 'E' },
      { key: '24', at: { x: 5 * G, y: -2 * G }, dir: 'E' },
      { key: '25', at: { x: 5 * G, y: -4 * G }, dir: 'E' },
      { key: '26', at: { x: 5 * G, y: -6 * G }, dir: 'E' },
      { key: '27', at: { x: 5 * G, y: -8 * G }, dir: 'E' },
      { key: '28', at: { x: 5 * G, y: -10 * G }, dir: 'E' },
      { key: '29', at: { x: 5 * G, y: -12 * G }, dir: 'E' },
      { key: '30', at: { x: 5 * G, y: -14 * G }, dir: 'E' },
    ],
  },
  parametrics: { maxVoltage: 12 }, // VIN 7–12 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against the official Arduino Pinout-NANO PDF plus zbotic + nextpcb + electronicshub Nano references (NOT taken from the shared component log): 30 pins in two rows of 15. Left row 1–15: D1/TX, D0/RX, RST, GND, D2–D12. Right row 16–30: D13, 3V3, AREF, A0–A7, 5V, RST, GND, VIN. D0/D1 = UART; D10–D13 = SPI SS/MOSI/MISO/SCK; A4/A5 = I²C SDA/SCL; A6/A7 are analog-INPUT only (no digital, no pull-up). GPIO modeled bidi, analog-only input, AREF/RST input, 3V3 & 5V power_out (onboard regulators), VIN & GND power_in. Tyler owns the DCCduino clone (identical pinout). refPrefix A. See inbox/2026-06-21-arduino-nano-pinout.md. No footprint yet — board land pattern is a later slice.',
});

// Arduino Uno R3 (ATmega328P) — the iconic board, four female headers (32 modeled
// pins). Power: NC, IOREF, RESET, 3V3, 5V, GND×2, VIN. Analog A0–A5 (A4/A5 also = I²C).
// Digital D0–D13 (D0/D1 UART, D10–D13 SPI, D3/5/6/9/10/11 PWM), plus the R3 additions:
// GND/AREF and dedicated SDA/SCL near AREF (electrically the same nets as A4/A5).
// GPIO = bidi, analog-only/RESET/AREF = input, 3V3/5V/IOREF = power_out, VIN/GND =
// power_in. (Tyler also owns the OSEPP Uno R3 Plus — same pinout.) Footprint deferred.
const arduinoUno = definePart({
  id: 'core:arduino-uno-r3',
  name: 'Arduino Uno R3 (ATmega328P)',
  refPrefix: 'A',
  class: 'ic',
  mpn: 'Arduino Uno R3',
  manufacturer: 'Arduino (ATmega328P; OSEPP Uno R3 Plus clone)',
  datasheetUrl: 'https://content.arduino.cc/assets/Pinout-UNOrev3_latest.pdf',
  pins: [
    // POWER header (8 pins; the corner pin is reserved/NC per the official R3 diagram)
    pin('1', 'NC', 'nc', '1'), // reserved corner pin of the R3 power header
    pin('2', 'IOREF', 'power_out', '2'), // logic-voltage reference out to shields
    pin('3', 'RESET', 'input', '3'), // active-low reset
    pin('4', '3V3', 'power_out', '4'), // regulated 3.3 V out
    pin('5', '5V', 'power_out', '5'), // regulated 5 V out
    pin('6', 'GND', 'power_in', '6'),
    pin('7', 'GND', 'power_in', '7'),
    pin('8', 'VIN', 'power_in', '8'), // 7–12 V recommended (6–20 V abs max)
    // ANALOG header
    pin('9', 'A0', 'bidi', '9'),
    pin('10', 'A1', 'bidi', '10'),
    pin('11', 'A2', 'bidi', '11'),
    pin('12', 'A3', 'bidi', '12'),
    pin('13', 'A4', 'bidi', '13'), // I²C SDA
    pin('14', 'A5', 'bidi', '14'), // I²C SCL
    // DIGITAL lower header (D0–D7)
    pin('15', 'D0', 'bidi', '15'), // RX
    pin('16', 'D1', 'bidi', '16'), // TX
    pin('17', 'D2', 'bidi', '17'),
    pin('18', 'D3', 'bidi', '18'), // PWM
    pin('19', 'D4', 'bidi', '19'),
    pin('20', 'D5', 'bidi', '20'), // PWM
    pin('21', 'D6', 'bidi', '21'), // PWM
    pin('22', 'D7', 'bidi', '22'),
    // DIGITAL upper header (D8–D13 + GND, AREF, SDA, SCL)
    pin('23', 'D8', 'bidi', '23'),
    pin('24', 'D9', 'bidi', '24'), // PWM
    pin('25', 'D10', 'bidi', '25'), // SPI SS / PWM
    pin('26', 'D11', 'bidi', '26'), // SPI MOSI / PWM
    pin('27', 'D12', 'bidi', '27'), // SPI MISO
    pin('28', 'D13', 'bidi', '28'), // SPI SCK (onboard LED)
    pin('29', 'GND', 'power_in', '29'),
    pin('30', 'AREF', 'input', '30'), // ADC reference in
    pin('31', 'SDA', 'bidi', '31'), // dedicated I²C (= A4 net)
    pin('32', 'SCL', 'bidi', '32'), // dedicated I²C (= A5 net)
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -16 * G, w: 8 * G, h: 32 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'UNO R3', sizeNm: Math.round(G * 0.6) },
    ],
    pins: [
      // left column: keys 1–16 (y 15G..−15G, step −2G)
      { key: '1', at: { x: -5 * G, y: 15 * G }, dir: 'W' },
      { key: '2', at: { x: -5 * G, y: 13 * G }, dir: 'W' },
      { key: '3', at: { x: -5 * G, y: 11 * G }, dir: 'W' },
      { key: '4', at: { x: -5 * G, y: 9 * G }, dir: 'W' },
      { key: '5', at: { x: -5 * G, y: 7 * G }, dir: 'W' },
      { key: '6', at: { x: -5 * G, y: 5 * G }, dir: 'W' },
      { key: '7', at: { x: -5 * G, y: 3 * G }, dir: 'W' },
      { key: '8', at: { x: -5 * G, y: 1 * G }, dir: 'W' },
      { key: '9', at: { x: -5 * G, y: -1 * G }, dir: 'W' },
      { key: '10', at: { x: -5 * G, y: -3 * G }, dir: 'W' },
      { key: '11', at: { x: -5 * G, y: -5 * G }, dir: 'W' },
      { key: '12', at: { x: -5 * G, y: -7 * G }, dir: 'W' },
      { key: '13', at: { x: -5 * G, y: -9 * G }, dir: 'W' },
      { key: '14', at: { x: -5 * G, y: -11 * G }, dir: 'W' },
      { key: '15', at: { x: -5 * G, y: -13 * G }, dir: 'W' },
      { key: '16', at: { x: -5 * G, y: -15 * G }, dir: 'W' },
      // right column: keys 17–32 (y 15G..−15G, step −2G)
      { key: '17', at: { x: 5 * G, y: 15 * G }, dir: 'E' },
      { key: '18', at: { x: 5 * G, y: 13 * G }, dir: 'E' },
      { key: '19', at: { x: 5 * G, y: 11 * G }, dir: 'E' },
      { key: '20', at: { x: 5 * G, y: 9 * G }, dir: 'E' },
      { key: '21', at: { x: 5 * G, y: 7 * G }, dir: 'E' },
      { key: '22', at: { x: 5 * G, y: 5 * G }, dir: 'E' },
      { key: '23', at: { x: 5 * G, y: 3 * G }, dir: 'E' },
      { key: '24', at: { x: 5 * G, y: 1 * G }, dir: 'E' },
      { key: '25', at: { x: 5 * G, y: -1 * G }, dir: 'E' },
      { key: '26', at: { x: 5 * G, y: -3 * G }, dir: 'E' },
      { key: '27', at: { x: 5 * G, y: -5 * G }, dir: 'E' },
      { key: '28', at: { x: 5 * G, y: -7 * G }, dir: 'E' },
      { key: '29', at: { x: 5 * G, y: -9 * G }, dir: 'E' },
      { key: '30', at: { x: 5 * G, y: -11 * G }, dir: 'E' },
      { key: '31', at: { x: 5 * G, y: -13 * G }, dir: 'E' },
      { key: '32', at: { x: 5 * G, y: -15 * G }, dir: 'E' },
    ],
  },
  parametrics: { maxVoltage: 12 }, // VIN 7–12 V recommended (6–20 V abs max)
  provenance: 'verified',
  provenanceNote:
    'Pin map VISUALLY re-verified 2026-06-22 against the official Arduino Pinout-UNOrev3 PDF (rendered + read pin-by-pin), correcting the earlier text-only model that omitted the reserved corner pin. Four headers, 32 modeled pins. POWER (8): NC, IOREF, RESET, 3V3, 5V, GND, GND, VIN — the corner pin is reserved/NC on the R3 diagram (modeled nc). ANALOG: A0–A5 (A4/A5 = I²C SDA/SCL). DIGITAL lower: D0/RX, D1/TX, D2–D7. DIGITAL upper: D8–D13, GND, AREF, SDA, SCL (R3 dedicated I²C, same ATmega nets as A4/A5). D13=SCK, D12=CIPO/MISO, D11=COPI/MOSI, D10=SS; PWM on D3/5/6/9/10/11. GPIO bidi, analog-only/RESET/AREF input, IOREF/3V3/5V power_out, VIN/GND power_in (VIN 7–12 V recommended, 6–20 V abs max per the official diagram). Tyler also owns the OSEPP Uno R3 Plus (same pinout). refPrefix A. See inbox/2026-06-21-arduino-uno-r3-pinout.md + inbox/2026-06-22-board-visual-verification-sweep.md. No footprint yet — board land pattern is a later slice.',
});

// NodeMCU ESP8266 (Amica) — 30-pin ESP-12E dev board. Canonical Amica layout: left
// column A0, RSV, RSV, SD3, SD2, SD1, CMD, SD0, CLK, GND, 3V3, EN, RST, GND, VIN; right
// column D0–D4, 3V3, GND, D5–D8, RX, TX, GND, 3V3. GPIO labels D0–D8 map to ESP GPIOs
// (D0=16, D1=5, D2=4, D3=0, D4=2, D5=14, D6=12, D7=13, D8=15, RX=3, TX=1); D5–D8 are the
// HSPI bus. A0 is a 0–1 V ADC (with onboard divider). SD0–SD3/CMD/CLK are the SDIO flash
// bus (occupied by onboard flash). 3V3 = regulator out (≤600 mA). Footprint deferred.
const nodemcuEsp8266 = definePart({
  id: 'core:nodemcu-esp8266',
  name: 'NodeMCU ESP8266 (Amica)',
  refPrefix: 'A',
  class: 'ic',
  mpn: 'NodeMCU ESP8266',
  manufacturer: 'Amica (ESP8266 ESP-12E)',
  datasheetUrl: 'https://components101.com/development-boards/nodemcu-esp8266-pinout-features-and-datasheet',
  pins: [
    // left column
    pin('1', 'A0', 'input', '1'), // ADC, 0–1 V (onboard divider)
    pin('2', 'RSV', 'nc', '2'), // reserved
    pin('3', 'RSV', 'nc', '3'), // reserved
    pin('4', 'SD3', 'bidi', '4'), // SDIO flash bus
    pin('5', 'SD2', 'bidi', '5'),
    pin('6', 'SD1', 'bidi', '6'),
    pin('7', 'CMD', 'bidi', '7'),
    pin('8', 'SD0', 'bidi', '8'),
    pin('9', 'CLK', 'bidi', '9'),
    pin('10', 'GND', 'power_in', '10'),
    pin('11', '3V3', 'power_out', '11'), // regulator out (≤600 mA)
    pin('12', 'EN', 'input', '12'), // chip enable (CH_PD), pulled high
    pin('13', 'RST', 'input', '13'),
    pin('14', 'GND', 'power_in', '14'),
    pin('15', 'VIN', 'power_in', '15'), // 5 V in
    // right column
    pin('16', 'D0', 'bidi', '16'), // GPIO16
    pin('17', 'D1', 'bidi', '17'), // GPIO5 (I²C SCL by convention)
    pin('18', 'D2', 'bidi', '18'), // GPIO4 (I²C SDA)
    pin('19', 'D3', 'bidi', '19'), // GPIO0 (flash button)
    pin('20', 'D4', 'bidi', '20'), // GPIO2 (onboard LED)
    pin('21', '3V3', 'power_out', '21'),
    pin('22', 'GND', 'power_in', '22'),
    pin('23', 'D5', 'bidi', '23'), // GPIO14 (HSPI SCK)
    pin('24', 'D6', 'bidi', '24'), // GPIO12 (HSPI MISO)
    pin('25', 'D7', 'bidi', '25'), // GPIO13 (HSPI MOSI)
    pin('26', 'D8', 'bidi', '26'), // GPIO15 (HSPI SS)
    pin('27', 'RX', 'bidi', '27'), // GPIO3
    pin('28', 'TX', 'bidi', '28'), // GPIO1
    pin('29', 'GND', 'power_in', '29'),
    pin('30', '3V3', 'power_out', '30'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -15 * G, w: 8 * G, h: 30 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'NodeMCU', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '1', at: { x: -5 * G, y: 14 * G }, dir: 'W' },
      { key: '2', at: { x: -5 * G, y: 12 * G }, dir: 'W' },
      { key: '3', at: { x: -5 * G, y: 10 * G }, dir: 'W' },
      { key: '4', at: { x: -5 * G, y: 8 * G }, dir: 'W' },
      { key: '5', at: { x: -5 * G, y: 6 * G }, dir: 'W' },
      { key: '6', at: { x: -5 * G, y: 4 * G }, dir: 'W' },
      { key: '7', at: { x: -5 * G, y: 2 * G }, dir: 'W' },
      { key: '8', at: { x: -5 * G, y: 0 }, dir: 'W' },
      { key: '9', at: { x: -5 * G, y: -2 * G }, dir: 'W' },
      { key: '10', at: { x: -5 * G, y: -4 * G }, dir: 'W' },
      { key: '11', at: { x: -5 * G, y: -6 * G }, dir: 'W' },
      { key: '12', at: { x: -5 * G, y: -8 * G }, dir: 'W' },
      { key: '13', at: { x: -5 * G, y: -10 * G }, dir: 'W' },
      { key: '14', at: { x: -5 * G, y: -12 * G }, dir: 'W' },
      { key: '15', at: { x: -5 * G, y: -14 * G }, dir: 'W' },
      { key: '16', at: { x: 5 * G, y: 14 * G }, dir: 'E' },
      { key: '17', at: { x: 5 * G, y: 12 * G }, dir: 'E' },
      { key: '18', at: { x: 5 * G, y: 10 * G }, dir: 'E' },
      { key: '19', at: { x: 5 * G, y: 8 * G }, dir: 'E' },
      { key: '20', at: { x: 5 * G, y: 6 * G }, dir: 'E' },
      { key: '21', at: { x: 5 * G, y: 4 * G }, dir: 'E' },
      { key: '22', at: { x: 5 * G, y: 2 * G }, dir: 'E' },
      { key: '23', at: { x: 5 * G, y: 0 }, dir: 'E' },
      { key: '24', at: { x: 5 * G, y: -2 * G }, dir: 'E' },
      { key: '25', at: { x: 5 * G, y: -4 * G }, dir: 'E' },
      { key: '26', at: { x: 5 * G, y: -6 * G }, dir: 'E' },
      { key: '27', at: { x: 5 * G, y: -8 * G }, dir: 'E' },
      { key: '28', at: { x: 5 * G, y: -10 * G }, dir: 'E' },
      { key: '29', at: { x: 5 * G, y: -12 * G }, dir: 'E' },
      { key: '30', at: { x: 5 * G, y: -14 * G }, dir: 'E' },
    ],
  },
  parametrics: { maxVoltage: 5 }, // VIN ~5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against components101 + lastminuteengineers + etechnophiles NodeMCU/ESP8266 references (NOT taken from the shared component log): canonical 30-pin Amica layout — left A0, RSV, RSV, SD3, SD2, SD1, CMD, SD0, CLK, GND, 3V3, EN, RST, GND, VIN; right D0, D1, D2, D3, D4, 3V3, GND, D5, D6, D7, D8, RX, TX, GND, 3V3. GPIO mapping confirmed (etechnophiles): D0=GPIO16, D1=5, D2=4, D3=0, D4=2, D5=14, D6=12, D7=13, D8=15, RX=3, TX=1; D5–D8 = HSPI. A0 = 0–1 V ADC (onboard divider, input). EN/RST input; SD0–SD3/CMD/CLK = SDIO flash bus (bidi, occupied by onboard flash); RSV = nc; 3V3 = regulator out (≤600 mA, power_out); VIN/GND power_in. refPrefix A. See inbox/2026-06-21-nodemcu-esp8266-pinout.md. No footprint yet — board land pattern is a later slice.',
});

// Raspberry Pi 3 B+ — modeled as its standardized 40-pin J8 GPIO header (schematic
// symbol only; the SBC is far more than this header, but the header is the EDA-relevant
// interface). Physical pins 1–40, odd column left / even column right, BCM numbering.
// 2×3V3 + 2×5V rails (board sources them, power_out), 8×GND. I²C on GPIO2/3 (pins 3/5),
// SPI0 on GPIO7-11, UART on GPIO14/15. All GPIO modeled bidi, rails power_out, GND
// power_in. Header layout is invariant across all 40-pin Pis. Footprint deferred.
const raspberryPi3bp = definePart({
  id: 'core:raspberry-pi-3bp',
  name: 'Raspberry Pi 3 B+ (40-pin GPIO header)',
  refPrefix: 'A',
  class: 'ic',
  mpn: 'Raspberry Pi 3 B+',
  manufacturer: 'Raspberry Pi Foundation',
  datasheetUrl: 'https://pinout.xyz/',
  pins: [
    pin('1', '3V3', 'power_out', '1'),
    pin('2', '5V', 'power_out', '2'),
    pin('3', 'GPIO2', 'bidi', '3'), // I²C1 SDA
    pin('4', '5V', 'power_out', '4'),
    pin('5', 'GPIO3', 'bidi', '5'), // I²C1 SCL
    pin('6', 'GND', 'power_in', '6'),
    pin('7', 'GPIO4', 'bidi', '7'),
    pin('8', 'GPIO14', 'bidi', '8'), // UART TXD
    pin('9', 'GND', 'power_in', '9'),
    pin('10', 'GPIO15', 'bidi', '10'), // UART RXD
    pin('11', 'GPIO17', 'bidi', '11'),
    pin('12', 'GPIO18', 'bidi', '12'), // PCM CLK / PWM0
    pin('13', 'GPIO27', 'bidi', '13'),
    pin('14', 'GND', 'power_in', '14'),
    pin('15', 'GPIO22', 'bidi', '15'),
    pin('16', 'GPIO23', 'bidi', '16'),
    pin('17', '3V3', 'power_out', '17'),
    pin('18', 'GPIO24', 'bidi', '18'),
    pin('19', 'GPIO10', 'bidi', '19'), // SPI0 MOSI
    pin('20', 'GND', 'power_in', '20'),
    pin('21', 'GPIO9', 'bidi', '21'), // SPI0 MISO
    pin('22', 'GPIO25', 'bidi', '22'),
    pin('23', 'GPIO11', 'bidi', '23'), // SPI0 SCLK
    pin('24', 'GPIO8', 'bidi', '24'), // SPI0 CE0
    pin('25', 'GND', 'power_in', '25'),
    pin('26', 'GPIO7', 'bidi', '26'), // SPI0 CE1
    pin('27', 'GPIO0', 'bidi', '27'), // ID_SD (EEPROM)
    pin('28', 'GPIO1', 'bidi', '28'), // ID_SC (EEPROM)
    pin('29', 'GPIO5', 'bidi', '29'),
    pin('30', 'GND', 'power_in', '30'),
    pin('31', 'GPIO6', 'bidi', '31'),
    pin('32', 'GPIO12', 'bidi', '32'), // PWM0
    pin('33', 'GPIO13', 'bidi', '33'), // PWM1
    pin('34', 'GND', 'power_in', '34'),
    pin('35', 'GPIO19', 'bidi', '35'), // SPI1 MISO / PCM FS
    pin('36', 'GPIO16', 'bidi', '36'),
    pin('37', 'GPIO26', 'bidi', '37'),
    pin('38', 'GPIO20', 'bidi', '38'), // SPI1 MOSI
    pin('39', 'GND', 'power_in', '39'),
    pin('40', 'GPIO21', 'bidi', '40'), // SPI1 SCLK
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -20 * G, w: 8 * G, h: 40 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'Pi 3B+', sizeNm: Math.round(G * 0.6) },
    ],
    pins: [
      // odd physical pins → left column (y 19G..−19G), even → right column
      { key: '1', at: { x: -5 * G, y: 19 * G }, dir: 'W' },
      { key: '3', at: { x: -5 * G, y: 17 * G }, dir: 'W' },
      { key: '5', at: { x: -5 * G, y: 15 * G }, dir: 'W' },
      { key: '7', at: { x: -5 * G, y: 13 * G }, dir: 'W' },
      { key: '9', at: { x: -5 * G, y: 11 * G }, dir: 'W' },
      { key: '11', at: { x: -5 * G, y: 9 * G }, dir: 'W' },
      { key: '13', at: { x: -5 * G, y: 7 * G }, dir: 'W' },
      { key: '15', at: { x: -5 * G, y: 5 * G }, dir: 'W' },
      { key: '17', at: { x: -5 * G, y: 3 * G }, dir: 'W' },
      { key: '19', at: { x: -5 * G, y: 1 * G }, dir: 'W' },
      { key: '21', at: { x: -5 * G, y: -1 * G }, dir: 'W' },
      { key: '23', at: { x: -5 * G, y: -3 * G }, dir: 'W' },
      { key: '25', at: { x: -5 * G, y: -5 * G }, dir: 'W' },
      { key: '27', at: { x: -5 * G, y: -7 * G }, dir: 'W' },
      { key: '29', at: { x: -5 * G, y: -9 * G }, dir: 'W' },
      { key: '31', at: { x: -5 * G, y: -11 * G }, dir: 'W' },
      { key: '33', at: { x: -5 * G, y: -13 * G }, dir: 'W' },
      { key: '35', at: { x: -5 * G, y: -15 * G }, dir: 'W' },
      { key: '37', at: { x: -5 * G, y: -17 * G }, dir: 'W' },
      { key: '39', at: { x: -5 * G, y: -19 * G }, dir: 'W' },
      { key: '2', at: { x: 5 * G, y: 19 * G }, dir: 'E' },
      { key: '4', at: { x: 5 * G, y: 17 * G }, dir: 'E' },
      { key: '6', at: { x: 5 * G, y: 15 * G }, dir: 'E' },
      { key: '8', at: { x: 5 * G, y: 13 * G }, dir: 'E' },
      { key: '10', at: { x: 5 * G, y: 11 * G }, dir: 'E' },
      { key: '12', at: { x: 5 * G, y: 9 * G }, dir: 'E' },
      { key: '14', at: { x: 5 * G, y: 7 * G }, dir: 'E' },
      { key: '16', at: { x: 5 * G, y: 5 * G }, dir: 'E' },
      { key: '18', at: { x: 5 * G, y: 3 * G }, dir: 'E' },
      { key: '20', at: { x: 5 * G, y: 1 * G }, dir: 'E' },
      { key: '22', at: { x: 5 * G, y: -1 * G }, dir: 'E' },
      { key: '24', at: { x: 5 * G, y: -3 * G }, dir: 'E' },
      { key: '26', at: { x: 5 * G, y: -5 * G }, dir: 'E' },
      { key: '28', at: { x: 5 * G, y: -7 * G }, dir: 'E' },
      { key: '30', at: { x: 5 * G, y: -9 * G }, dir: 'E' },
      { key: '32', at: { x: 5 * G, y: -11 * G }, dir: 'E' },
      { key: '34', at: { x: 5 * G, y: -13 * G }, dir: 'E' },
      { key: '36', at: { x: 5 * G, y: -15 * G }, dir: 'E' },
      { key: '38', at: { x: 5 * G, y: -17 * G }, dir: 'E' },
      { key: '40', at: { x: 5 * G, y: -19 * G }, dir: 'E' },
    ],
  },
  parametrics: { maxVoltage: 5 }, // 5 V supply rail
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-21 against pinout.xyz + Pi4J model-3b-plus + etechnophiles Pi 3B+ references (NOT taken from the shared component log): standardized 40-pin J8 header, BCM numbering, odd pins left / even right. 2×3V3 (1,17), 2×5V (2,4), 8×GND (6,9,14,20,25,30,34,39), I²C1 on GPIO2/3 (pins 3,5), UART on GPIO14/15 (8,10), SPI0 on GPIO7-11 (19,21,23,24,26), SPI1 on GPIO16-21. Modeled as the GPIO header only (schematic symbol, SBC). GPIO bidi, 3V3/5V power_out (board sources them), GND power_in. refPrefix A. Header layout is invariant across all 40-pin Pis. See inbox/2026-06-21-raspberry-pi-3bp-pinout.md. No footprint — board land pattern deferred.',
});

// NodeMCU ESP-32S (Ai-Thinker NodeMCU-32S) — 38-pin ESP-WROOM-32 dev board. Tyler's
// catalog mislabels the chip "ESP32-S2" but also claims Bluetooth, which the S2 lacks —
// the board is the classic dual-core ESP32 (ESP-WROOM-32, Wi-Fi + BT/BLE). Modeled as its
// 38-pin header: continuous numbering, left column top→bottom (1–19), then right (20–38).
// All six SPI-flash pins (GPIO6-11) are broken out (bidi, but occupied by onboard flash).
// GPIO34/35/36/39 are INPUT-ONLY (no output drivers / pull-ups). Footprint deferred.
const nodemcuEsp32s = definePart({
  id: 'core:nodemcu-esp32s',
  name: 'NodeMCU ESP-32S (ESP-WROOM-32, 38-pin)',
  refPrefix: 'A',
  class: 'ic',
  mpn: 'NodeMCU-32S',
  manufacturer: 'Ai-Thinker (ESP32-WROOM-32)',
  datasheetUrl: 'https://www.espboards.dev/esp32/nodemcu-32s/',
  pins: [
    // left column (top → bottom)
    pin('1', '3V3', 'power_out', '1'), // onboard AMS1117 regulator out
    pin('2', 'EN', 'input', '2'), // chip enable / reset (active high, pulled up)
    pin('3', 'GPIO36', 'input', '3'), // SENSOR_VP, ADC1_0 — input only
    pin('4', 'GPIO39', 'input', '4'), // SENSOR_VN, ADC1_3 — input only
    pin('5', 'GPIO34', 'input', '5'), // ADC1_6 — input only
    pin('6', 'GPIO35', 'input', '6'), // ADC1_7 — input only
    pin('7', 'GPIO32', 'bidi', '7'), // ADC1_4, Touch9, Xtal32P
    pin('8', 'GPIO33', 'bidi', '8'), // ADC1_5, Touch8, Xtal32N
    pin('9', 'GPIO25', 'bidi', '9'), // DAC1, ADC2_8
    pin('10', 'GPIO26', 'bidi', '10'), // DAC2, ADC2_9
    pin('11', 'GPIO27', 'bidi', '11'), // ADC2_7, Touch7
    pin('12', 'GPIO14', 'bidi', '12'), // ADC2_6, Touch6, HSPI CLK
    pin('13', 'GPIO12', 'bidi', '13'), // ADC2_5, Touch5, HSPI MISO (strapping)
    pin('14', 'GND', 'power_in', '14'),
    pin('15', 'GPIO13', 'bidi', '15'), // ADC2_4, Touch4, HSPI MOSI
    pin('16', 'GPIO9', 'bidi', '16'), // SD2 / flash (onboard SPI flash)
    pin('17', 'GPIO10', 'bidi', '17'), // SD3 / flash
    pin('18', 'GPIO11', 'bidi', '18'), // CMD / flash
    pin('19', '5V', 'power_in', '19'), // VIN (USB / external 5 V)
    // right column (top → bottom)
    pin('20', 'GND', 'power_in', '20'),
    pin('21', 'GPIO23', 'bidi', '21'), // VSPI MOSI
    pin('22', 'GPIO22', 'bidi', '22'), // I²C SCL
    pin('23', 'GPIO1', 'bidi', '23'), // U0TXD
    pin('24', 'GPIO3', 'bidi', '24'), // U0RXD
    pin('25', 'GPIO21', 'bidi', '25'), // I²C SDA
    pin('26', 'GND', 'power_in', '26'),
    pin('27', 'GPIO19', 'bidi', '27'), // VSPI MISO
    pin('28', 'GPIO18', 'bidi', '28'), // VSPI SCK
    pin('29', 'GPIO5', 'bidi', '29'), // VSPI CS0 (strapping)
    pin('30', 'GPIO17', 'bidi', '30'), // U2TXD
    pin('31', 'GPIO16', 'bidi', '31'), // U2RXD
    pin('32', 'GPIO4', 'bidi', '32'), // ADC2_0, Touch0
    pin('33', 'GPIO0', 'bidi', '33'), // boot strapping, ADC2_1, Touch1
    pin('34', 'GPIO2', 'bidi', '34'), // ADC2_2, Touch2 (onboard LED, strapping)
    pin('35', 'GPIO15', 'bidi', '35'), // ADC2_3, Touch3, HSPI CS0 (strapping)
    pin('36', 'GPIO8', 'bidi', '36'), // SD1 / flash
    pin('37', 'GPIO7', 'bidi', '37'), // SD0 / flash
    pin('38', 'GPIO6', 'bidi', '38'), // CLK / flash
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -19 * G, w: 8 * G, h: 38 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'ESP-32S', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '1', at: { x: -5 * G, y: 18 * G }, dir: 'W' },
      { key: '2', at: { x: -5 * G, y: 16 * G }, dir: 'W' },
      { key: '3', at: { x: -5 * G, y: 14 * G }, dir: 'W' },
      { key: '4', at: { x: -5 * G, y: 12 * G }, dir: 'W' },
      { key: '5', at: { x: -5 * G, y: 10 * G }, dir: 'W' },
      { key: '6', at: { x: -5 * G, y: 8 * G }, dir: 'W' },
      { key: '7', at: { x: -5 * G, y: 6 * G }, dir: 'W' },
      { key: '8', at: { x: -5 * G, y: 4 * G }, dir: 'W' },
      { key: '9', at: { x: -5 * G, y: 2 * G }, dir: 'W' },
      { key: '10', at: { x: -5 * G, y: 0 }, dir: 'W' },
      { key: '11', at: { x: -5 * G, y: -2 * G }, dir: 'W' },
      { key: '12', at: { x: -5 * G, y: -4 * G }, dir: 'W' },
      { key: '13', at: { x: -5 * G, y: -6 * G }, dir: 'W' },
      { key: '14', at: { x: -5 * G, y: -8 * G }, dir: 'W' },
      { key: '15', at: { x: -5 * G, y: -10 * G }, dir: 'W' },
      { key: '16', at: { x: -5 * G, y: -12 * G }, dir: 'W' },
      { key: '17', at: { x: -5 * G, y: -14 * G }, dir: 'W' },
      { key: '18', at: { x: -5 * G, y: -16 * G }, dir: 'W' },
      { key: '19', at: { x: -5 * G, y: -18 * G }, dir: 'W' },
      { key: '20', at: { x: 5 * G, y: 18 * G }, dir: 'E' },
      { key: '21', at: { x: 5 * G, y: 16 * G }, dir: 'E' },
      { key: '22', at: { x: 5 * G, y: 14 * G }, dir: 'E' },
      { key: '23', at: { x: 5 * G, y: 12 * G }, dir: 'E' },
      { key: '24', at: { x: 5 * G, y: 10 * G }, dir: 'E' },
      { key: '25', at: { x: 5 * G, y: 8 * G }, dir: 'E' },
      { key: '26', at: { x: 5 * G, y: 6 * G }, dir: 'E' },
      { key: '27', at: { x: 5 * G, y: 4 * G }, dir: 'E' },
      { key: '28', at: { x: 5 * G, y: 2 * G }, dir: 'E' },
      { key: '29', at: { x: 5 * G, y: 0 }, dir: 'E' },
      { key: '30', at: { x: 5 * G, y: -2 * G }, dir: 'E' },
      { key: '31', at: { x: 5 * G, y: -4 * G }, dir: 'E' },
      { key: '32', at: { x: 5 * G, y: -6 * G }, dir: 'E' },
      { key: '33', at: { x: 5 * G, y: -8 * G }, dir: 'E' },
      { key: '34', at: { x: 5 * G, y: -10 * G }, dir: 'E' },
      { key: '35', at: { x: 5 * G, y: -12 * G }, dir: 'E' },
      { key: '36', at: { x: 5 * G, y: -14 * G }, dir: 'E' },
      { key: '37', at: { x: 5 * G, y: -16 * G }, dir: 'E' },
      { key: '38', at: { x: 5 * G, y: -18 * G }, dir: 'E' },
    ],
  },
  parametrics: { maxVoltage: 5 }, // VIN ~5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-22 by VISUAL inspection of the Mischianti high-res "ESP32 NODEMCU-32S ESP-32S Kit" pinout diagram (1440×842, read pin-by-pin in-browser, both columns zoomed), cross-checked against espboards.dev/esp32/nodemcu-32s text data (SDA=GPIO21, SCL=GPIO22, MOSI=GPIO23, MISO=GPIO19, SCK=GPIO18, CS=GPIO5, U0TXD=GPIO1/U0RXD=GPIO3, U2=GPIO16/17, VP=GPIO36/VN=GPIO39 all agree). NOT taken from the shared component log, whose "ESP32-S2 + Bluetooth" entry is internally contradictory (S2 has no Bluetooth); board is the classic dual-core ESP32 / ESP-WROOM-32. 38-pin header, continuous numbering: left 1–19 = 3V3, EN, GPIO36, 39, 34, 35, 32, 33, 25, 26, 27, 14, 12, GND, 13, 9, 10, 11, 5V(VIN); right 20–38 = GND, GPIO23, 22, 1, 3, 21, GND, 19, 18, 5, 17, 16, 4, 0, 2, 15, 8, 7, 6. All six SPI-flash pins broken out: GPIO9/10/11 = SD2/SD3/CMD (left), GPIO8/7/6 = SD1/SD0/CLK (right) — bidi but occupied by onboard SPI flash (using them as GPIO crashes the board). GPIO34/35/36/39 are INPUT-ONLY (no output drivers, no pull-ups) → modeled input; EN input; 3V3 = onboard regulator out (power_out); 5V/VIN + GND = power_in; all other GPIO bidi. refPrefix A. See inbox/2026-06-22-nodemcu-esp32s-pinout.md. No footprint yet — board land pattern is a later slice.',
});

// Arduino MEGA 2560 REV3 (ATmega2560) — the large board, 86 modeled header pins across
// five headers. Pinout VISUALLY verified 2026-06-22 against the official Arduino
// Pinout-Mega2560rev3 PDF (all 4 pages). Power: NC, IOREF, RESET, 3V3, 5V, GND×2, VIN.
// Analog A0–A15 (= D54–D69; A4–A7 also = JTAG). Digital shield header D0–D13 + dedicated
// SCL/SDA + AREF + GND. Comm header D14–D21. Bottom 2×18 header D22–D53 + 5V×2 + GND×2.
// D-pins bidi, analog bidi, AREF/RESET input, IOREF/3V3/5V power_out, VIN/GND power_in,
// NC reserved. SPI on D50–D53 (CIPO/COPI/SCK/SS). Footprint deferred.
const arduinoMega2560 = definePart({
  id: 'core:arduino-mega2560',
  name: 'Arduino MEGA 2560 R3 (ATmega2560)',
  refPrefix: 'A',
  class: 'ic',
  mpn: 'Arduino Mega 2560 Rev3',
  manufacturer: 'Arduino (ATmega2560)',
  datasheetUrl: 'https://content.arduino.cc/assets/Pinout-Mega2560rev3_latest.pdf',
  pins: [
    // POWER header (8; corner pin reserved/NC per the official diagram)
    pin('1', 'NC', 'nc', '1'), // reserved corner pin of the power header
    pin('2', 'IOREF', 'power_out', '2'), // logic-voltage reference out to shields
    pin('3', 'RESET', 'input', '3'), // active-low reset
    pin('4', '3V3', 'power_out', '4'), // regulated 3.3 V out
    pin('5', '5V', 'power_out', '5'), // regulated 5 V out
    pin('6', 'GND', 'power_in', '6'),
    pin('7', 'GND', 'power_in', '7'),
    pin('8', 'VIN', 'power_in', '8'), // 7-12 V recommended (6-20 V abs max)
    // ANALOG header A0-A15 (= D54-D69)
    pin('9', 'A0', 'bidi', '9'), // PF0 / ADC0 / D54
    pin('10', 'A1', 'bidi', '10'), // PF1 / ADC1 / D55
    pin('11', 'A2', 'bidi', '11'), // PF2 / ADC2 / D56
    pin('12', 'A3', 'bidi', '12'), // PF3 / ADC3 / D57
    pin('13', 'A4', 'bidi', '13'), // PF4 / ADC4 / D58 / JTAG TCK
    pin('14', 'A5', 'bidi', '14'), // PF5 / ADC5 / D59 / JTAG TMS
    pin('15', 'A6', 'bidi', '15'), // PF6 / ADC6 / D60 / JTAG TDO
    pin('16', 'A7', 'bidi', '16'), // PF7 / ADC7 / D61 / JTAG TDI
    pin('17', 'A8', 'bidi', '17'), // PK0 / ADC8 / D62
    pin('18', 'A9', 'bidi', '18'), // PK1 / ADC9 / D63
    pin('19', 'A10', 'bidi', '19'), // PK2 / ADC10 / D64
    pin('20', 'A11', 'bidi', '20'), // PK3 / ADC11 / D65
    pin('21', 'A12', 'bidi', '21'), // PK4 / ADC12 / D66
    pin('22', 'A13', 'bidi', '22'), // PK5 / ADC13 / D67
    pin('23', 'A14', 'bidi', '23'), // PK6 / ADC14 / D68
    pin('24', 'A15', 'bidi', '24'), // PK7 / ADC15 / D69
    // DIGITAL shield header (right edge, top group)
    pin('25', 'SCL', 'bidi', '25'), // dedicated I2C SCL (= D21 / PD0 net)
    pin('26', 'SDA', 'bidi', '26'), // dedicated I2C SDA (= D20 / PD1 net)
    pin('27', 'AREF', 'input', '27'), // ADC reference in
    pin('28', 'GND', 'power_in', '28'),
    pin('29', 'D13', 'bidi', '29'), // PB7 / PWM / onboard LED
    pin('30', 'D12', 'bidi', '30'), // PB6 / PWM
    pin('31', 'D11', 'bidi', '31'), // PB5 / PWM
    pin('32', 'D10', 'bidi', '32'), // PB4 / PWM
    pin('33', 'D9', 'bidi', '33'), // PH6 / PWM
    pin('34', 'D8', 'bidi', '34'), // PH5 / PWM
    pin('35', 'D7', 'bidi', '35'), // PH4
    pin('36', 'D6', 'bidi', '36'), // PH3 / PWM
    pin('37', 'D5', 'bidi', '37'), // PE3 / PWM
    pin('38', 'D4', 'bidi', '38'), // PG5
    pin('39', 'D3', 'bidi', '39'), // PE5 / PWM
    pin('40', 'D2', 'bidi', '40'), // PE4 / PWM
    pin('41', 'D1', 'bidi', '41'), // PE1 / TX0
    pin('42', 'D0', 'bidi', '42'), // PE0 / RX0
    // COMMUNICATION header (right edge, lower group): D14-D21
    pin('43', 'D14', 'bidi', '43'), // PJ1 / TX3
    pin('44', 'D15', 'bidi', '44'), // PJ0 / RX3
    pin('45', 'D16', 'bidi', '45'), // PH1 / TX2
    pin('46', 'D17', 'bidi', '46'), // PH0 / RX2
    pin('47', 'D18', 'bidi', '47'), // PD3 / TX1
    pin('48', 'D19', 'bidi', '48'), // PD2 / RX1
    pin('49', 'D20', 'bidi', '49'), // PD1 / SDA
    pin('50', 'D21', 'bidi', '50'), // PD0 / SCL
    // BOTTOM 2x18 header — left column (5V, even pins D22-D52, GND)
    pin('51', '5V', 'power_out', '51'),
    pin('52', 'D22', 'bidi', '52'), // PA0 / AD0
    pin('53', 'D24', 'bidi', '53'), // PA2 / AD2
    pin('54', 'D26', 'bidi', '54'), // PA4 / AD4
    pin('55', 'D28', 'bidi', '55'), // PA6 / AD6
    pin('56', 'D30', 'bidi', '56'), // PC7 / A15
    pin('57', 'D32', 'bidi', '57'), // PC5 / A13
    pin('58', 'D34', 'bidi', '58'), // PC3 / A11
    pin('59', 'D36', 'bidi', '59'), // PC1 / A9
    pin('60', 'D38', 'bidi', '60'), // PD7 / T0
    pin('61', 'D40', 'bidi', '61'), // PG1 / RD
    pin('62', 'D42', 'bidi', '62'), // PL7
    pin('63', 'D44', 'bidi', '63'), // PL5 / PWM
    pin('64', 'D46', 'bidi', '64'), // PL3 / PWM
    pin('65', 'D48', 'bidi', '65'), // PL1
    pin('66', 'D50', 'bidi', '66'), // PB3 / CIPO/MISO
    pin('67', 'D52', 'bidi', '67'), // PB1 / SCK
    pin('68', 'GND', 'power_in', '68'),
    // BOTTOM 2x18 header — right column (5V, odd pins D23-D53, GND)
    pin('69', '5V', 'power_out', '69'),
    pin('70', 'D23', 'bidi', '70'), // PA1 / AD1
    pin('71', 'D25', 'bidi', '71'), // PA3 / AD3
    pin('72', 'D27', 'bidi', '72'), // PA5 / AD5
    pin('73', 'D29', 'bidi', '73'), // PA7 / AD7
    pin('74', 'D31', 'bidi', '74'), // PC6 / A14
    pin('75', 'D33', 'bidi', '75'), // PC4 / A12
    pin('76', 'D35', 'bidi', '76'), // PC2 / A10
    pin('77', 'D37', 'bidi', '77'), // PC0 / A8
    pin('78', 'D39', 'bidi', '78'), // PG2 / ALE
    pin('79', 'D41', 'bidi', '79'), // PG0 / WR
    pin('80', 'D43', 'bidi', '80'), // PL6
    pin('81', 'D45', 'bidi', '81'), // PL4 / PWM
    pin('82', 'D47', 'bidi', '82'), // PL2 / PWM
    pin('83', 'D49', 'bidi', '83'), // PL0
    pin('84', 'D51', 'bidi', '84'), // PB2 / COPI/MOSI
    pin('85', 'D53', 'bidi', '85'), // PB0 / SS
    pin('86', 'GND', 'power_in', '86'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -43 * G, w: 8 * G, h: 86 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'MEGA2560', sizeNm: Math.round(G * 0.6) },
    ],
    pins: [
      { key: '1', at: { x: -5 * G, y: 42 * G }, dir: 'W' },
      { key: '2', at: { x: -5 * G, y: 40 * G }, dir: 'W' },
      { key: '3', at: { x: -5 * G, y: 38 * G }, dir: 'W' },
      { key: '4', at: { x: -5 * G, y: 36 * G }, dir: 'W' },
      { key: '5', at: { x: -5 * G, y: 34 * G }, dir: 'W' },
      { key: '6', at: { x: -5 * G, y: 32 * G }, dir: 'W' },
      { key: '7', at: { x: -5 * G, y: 30 * G }, dir: 'W' },
      { key: '8', at: { x: -5 * G, y: 28 * G }, dir: 'W' },
      { key: '9', at: { x: -5 * G, y: 26 * G }, dir: 'W' },
      { key: '10', at: { x: -5 * G, y: 24 * G }, dir: 'W' },
      { key: '11', at: { x: -5 * G, y: 22 * G }, dir: 'W' },
      { key: '12', at: { x: -5 * G, y: 20 * G }, dir: 'W' },
      { key: '13', at: { x: -5 * G, y: 18 * G }, dir: 'W' },
      { key: '14', at: { x: -5 * G, y: 16 * G }, dir: 'W' },
      { key: '15', at: { x: -5 * G, y: 14 * G }, dir: 'W' },
      { key: '16', at: { x: -5 * G, y: 12 * G }, dir: 'W' },
      { key: '17', at: { x: -5 * G, y: 10 * G }, dir: 'W' },
      { key: '18', at: { x: -5 * G, y: 8 * G }, dir: 'W' },
      { key: '19', at: { x: -5 * G, y: 6 * G }, dir: 'W' },
      { key: '20', at: { x: -5 * G, y: 4 * G }, dir: 'W' },
      { key: '21', at: { x: -5 * G, y: 2 * G }, dir: 'W' },
      { key: '22', at: { x: -5 * G, y: 0 * G }, dir: 'W' },
      { key: '23', at: { x: -5 * G, y: -2 * G }, dir: 'W' },
      { key: '24', at: { x: -5 * G, y: -4 * G }, dir: 'W' },
      { key: '25', at: { x: -5 * G, y: -6 * G }, dir: 'W' },
      { key: '26', at: { x: -5 * G, y: -8 * G }, dir: 'W' },
      { key: '27', at: { x: -5 * G, y: -10 * G }, dir: 'W' },
      { key: '28', at: { x: -5 * G, y: -12 * G }, dir: 'W' },
      { key: '29', at: { x: -5 * G, y: -14 * G }, dir: 'W' },
      { key: '30', at: { x: -5 * G, y: -16 * G }, dir: 'W' },
      { key: '31', at: { x: -5 * G, y: -18 * G }, dir: 'W' },
      { key: '32', at: { x: -5 * G, y: -20 * G }, dir: 'W' },
      { key: '33', at: { x: -5 * G, y: -22 * G }, dir: 'W' },
      { key: '34', at: { x: -5 * G, y: -24 * G }, dir: 'W' },
      { key: '35', at: { x: -5 * G, y: -26 * G }, dir: 'W' },
      { key: '36', at: { x: -5 * G, y: -28 * G }, dir: 'W' },
      { key: '37', at: { x: -5 * G, y: -30 * G }, dir: 'W' },
      { key: '38', at: { x: -5 * G, y: -32 * G }, dir: 'W' },
      { key: '39', at: { x: -5 * G, y: -34 * G }, dir: 'W' },
      { key: '40', at: { x: -5 * G, y: -36 * G }, dir: 'W' },
      { key: '41', at: { x: -5 * G, y: -38 * G }, dir: 'W' },
      { key: '42', at: { x: -5 * G, y: -40 * G }, dir: 'W' },
      { key: '43', at: { x: -5 * G, y: -42 * G }, dir: 'W' },
      { key: '44', at: { x: 5 * G, y: 42 * G }, dir: 'E' },
      { key: '45', at: { x: 5 * G, y: 40 * G }, dir: 'E' },
      { key: '46', at: { x: 5 * G, y: 38 * G }, dir: 'E' },
      { key: '47', at: { x: 5 * G, y: 36 * G }, dir: 'E' },
      { key: '48', at: { x: 5 * G, y: 34 * G }, dir: 'E' },
      { key: '49', at: { x: 5 * G, y: 32 * G }, dir: 'E' },
      { key: '50', at: { x: 5 * G, y: 30 * G }, dir: 'E' },
      { key: '51', at: { x: 5 * G, y: 28 * G }, dir: 'E' },
      { key: '52', at: { x: 5 * G, y: 26 * G }, dir: 'E' },
      { key: '53', at: { x: 5 * G, y: 24 * G }, dir: 'E' },
      { key: '54', at: { x: 5 * G, y: 22 * G }, dir: 'E' },
      { key: '55', at: { x: 5 * G, y: 20 * G }, dir: 'E' },
      { key: '56', at: { x: 5 * G, y: 18 * G }, dir: 'E' },
      { key: '57', at: { x: 5 * G, y: 16 * G }, dir: 'E' },
      { key: '58', at: { x: 5 * G, y: 14 * G }, dir: 'E' },
      { key: '59', at: { x: 5 * G, y: 12 * G }, dir: 'E' },
      { key: '60', at: { x: 5 * G, y: 10 * G }, dir: 'E' },
      { key: '61', at: { x: 5 * G, y: 8 * G }, dir: 'E' },
      { key: '62', at: { x: 5 * G, y: 6 * G }, dir: 'E' },
      { key: '63', at: { x: 5 * G, y: 4 * G }, dir: 'E' },
      { key: '64', at: { x: 5 * G, y: 2 * G }, dir: 'E' },
      { key: '65', at: { x: 5 * G, y: 0 * G }, dir: 'E' },
      { key: '66', at: { x: 5 * G, y: -2 * G }, dir: 'E' },
      { key: '67', at: { x: 5 * G, y: -4 * G }, dir: 'E' },
      { key: '68', at: { x: 5 * G, y: -6 * G }, dir: 'E' },
      { key: '69', at: { x: 5 * G, y: -8 * G }, dir: 'E' },
      { key: '70', at: { x: 5 * G, y: -10 * G }, dir: 'E' },
      { key: '71', at: { x: 5 * G, y: -12 * G }, dir: 'E' },
      { key: '72', at: { x: 5 * G, y: -14 * G }, dir: 'E' },
      { key: '73', at: { x: 5 * G, y: -16 * G }, dir: 'E' },
      { key: '74', at: { x: 5 * G, y: -18 * G }, dir: 'E' },
      { key: '75', at: { x: 5 * G, y: -20 * G }, dir: 'E' },
      { key: '76', at: { x: 5 * G, y: -22 * G }, dir: 'E' },
      { key: '77', at: { x: 5 * G, y: -24 * G }, dir: 'E' },
      { key: '78', at: { x: 5 * G, y: -26 * G }, dir: 'E' },
      { key: '79', at: { x: 5 * G, y: -28 * G }, dir: 'E' },
      { key: '80', at: { x: 5 * G, y: -30 * G }, dir: 'E' },
      { key: '81', at: { x: 5 * G, y: -32 * G }, dir: 'E' },
      { key: '82', at: { x: 5 * G, y: -34 * G }, dir: 'E' },
      { key: '83', at: { x: 5 * G, y: -36 * G }, dir: 'E' },
      { key: '84', at: { x: 5 * G, y: -38 * G }, dir: 'E' },
      { key: '85', at: { x: 5 * G, y: -40 * G }, dir: 'E' },
      { key: '86', at: { x: 5 * G, y: -42 * G }, dir: 'E' },
    ],
  },
  parametrics: { maxVoltage: 12 }, // VIN 7–12 V recommended (6–20 V abs max)
  provenance: 'verified',
  provenanceNote:
    'Pin map VISUALLY verified 2026-06-22 against the official Arduino Pinout-Mega2560rev3 PDF (all 4 pages, read pin-by-pin). 86 modeled header pins across five headers. POWER (8): NC, IOREF, RESET, 3V3, 5V, GND, GND, VIN — corner pin reserved/NC. ANALOG (16): A0–A15 (= D54–D69; A4–A7 also = JTAG TCK/TMS/TDO/TDI). DIGITAL shield header (18): dedicated SCL/SDA, AREF, GND, D13–D0 (D13=LED, PWM on D2–D13 per board). COMM header (8): D14–D21 (TX3/RX3/TX2/RX2/TX1/RX1/SDA/SCL). BOTTOM 2×18 header (36): 5V + even D22–D52 + GND (left), 5V + odd D23–D53 + GND (right); D50=CIPO/MISO, D51=COPI/MOSI, D52=SCK, D53=SS (SPI). All D-pins + analog bidi, AREF/RESET input, IOREF/3V3/5V power_out, VIN/GND power_in (VIN 7–12 V recommended, 6–20 V abs max), NC reserved. 5 GND + 3 5V header pins. refPrefix A. See inbox/2026-06-22-arduino-mega2560-pinout.md. No footprint yet — board land pattern is a later slice.',
});

// HC-SR04 ultrasonic distance sensor — the iconic 4-pin module (VCC, TRIG, ECHO, GND).
// MCU pulses TRIG (10 µs) → module emits a 40 kHz burst → ECHO goes high for the round-trip
// time. 5 V supply, 2–400 cm range. TRIG = input (MCU-driven), ECHO = output (module-driven),
// VCC/GND = power_in. Footprint deferred.
const hcsr04 = definePart({
  id: 'core:hc-sr04',
  name: 'HC-SR04 ultrasonic distance sensor',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'HC-SR04',
  manufacturer: 'generic (ElecFreaks original)',
  datasheetUrl: 'https://components101.com/sensors/ultrasonic-sensor-working-pinout-datasheet',
  pins: [
    pin('1', 'VCC', 'power_in', '1'), // +5 V
    pin('2', 'TRIG', 'input', '2'), // trigger: MCU drives a 10 µs high pulse
    pin('3', 'ECHO', 'output', '3'), // echo: module drives high for the round-trip time
    pin('4', 'GND', 'power_in', '4'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'HC-SR04', sizeNm: Math.round(G * 0.42) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: 2 * G }, dir: 'W' }, // VCC
      { key: '4', at: { x: -4 * G, y: -2 * G }, dir: 'W' }, // GND
      { key: '2', at: { x: 4 * G, y: 2 * G }, dir: 'E' }, // TRIG
      { key: '3', at: { x: 4 * G, y: -2 * G }, dir: 'E' }, // ECHO
    ],
  },
  parametrics: { maxVoltage: 5 }, // 5 V supply
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-22 against components101 + the official ElecFreaks HC-SR04 datasheet + espboards.dev (NOT taken from the shared component log, though it agrees): 4-pin module, left-to-right order VCC, TRIG, ECHO, GND. 5 V supply, 2–400 cm range, 40 kHz. TRIG = input (MCU drives a 10 µs trigger pulse), ECHO = output (module drives the pin high for the echo round-trip time), VCC/GND = power_in. refPrefix U. See inbox/2026-06-22-hc-sr04-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// HC-SR501 PIR motion sensor — 3-pin module (GND, OUT, VCC). Pyroelectric IR sensor +
// BISS0001 behind a Fresnel dome; OUT goes HIGH (3.3 V TTL) on motion. 4.5–20 V supply
// (onboard regulator), 2 trim pots (sensitivity + time delay) and an H/L retrigger jumper
// (not modeled). The middle pin is always OUT; the canonical silk order (front view) is
// GND, OUT, VCC — but some clones swap the two end pins, so read the silkscreen per board.
// OUT = output (module-driven), VCC/GND = power_in. Footprint deferred.
const hcsr501 = definePart({
  id: 'core:hc-sr501',
  name: 'HC-SR501 PIR motion sensor module',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'HC-SR501',
  manufacturer: 'generic (BISS0001-based PIR)',
  datasheetUrl: 'https://components101.com/sensors/hc-sr501-pir-sensor',
  pins: [
    pin('1', 'GND', 'power_in', '1'),
    pin('2', 'OUT', 'output', '2'), // digital HIGH (3.3 V) on motion
    pin('3', 'VCC', 'power_in', '3'), // 4.5–20 V (onboard regulator)
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -3 * G, w: 6 * G, h: 6 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'PIR', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '3', at: { x: -4 * G, y: G }, dir: 'W' }, // VCC (power top)
      { key: '1', at: { x: -4 * G, y: -G }, dir: 'W' }, // GND
      { key: '2', at: { x: 4 * G, y: 0 }, dir: 'E' }, // OUT
    ],
  },
  parametrics: { maxVoltage: 20 }, // 4.5–20 V supply
  provenance: 'verified',
  provenanceNote:
    'Pin map VISUALLY verified 2026-06-22 against three authoritative pinout diagrams read as images — lastminuteengineers front-view diagram, components101 board photo, and componentsinfo back-side view — all three show silk order GND, OUT, VCC (pin 1 = GND, 2 = OUT, 3 = VCC). This CORRECTS an earlier text-only model that had VCC/OUT/GND (taken from a components101 text table that was reversed from the actual board pictures — caught by the mandatory board-diagram-verification sweep). Pyroelectric PIR + BISS0001; OUT = digital HIGH (3.3 V TTL) when motion detected, LOW idle; 4.5–20 V supply via onboard regulator; ~7 m range, ~120° FoV; sensitivity + delay trim pots and an H/L retrigger jumper exist on-board but are not header pins. The middle pin is ALWAYS OUT (orientation-independent anchor, unanimous across all viewed diagrams); the two END pins (GND/VCC) are silk-swapped on some clones, so the per-board silkscreen is ground truth. OUT = output, VCC/GND = power_in. refPrefix U. See inbox/2026-06-22-hc-sr501-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-040 rotary encoder module — 5-pin (CLK, DT, SW, +, GND). Incremental quadrature
// encoder + push-button. CLK/DT are the two quadrature contacts (board has 10k pull-ups);
// SW is the shaft push-button (to GND). 3.3–5 V. CLK/DT/SW = signal lines the MCU reads
// (output), +/GND = power_in. Footprint deferred.
const ky040Encoder = definePart({
  id: 'core:ky040-encoder',
  name: 'KY-040 rotary encoder module',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'KY-040',
  manufacturer: 'Keyes (generic KY-040)',
  datasheetUrl: 'https://components101.com/modules/KY-04-rotary-encoder-pinout-features-datasheet-working-application-alternative',
  pins: [
    pin('1', 'CLK', 'output', '1'), // quadrature A (board 10k pull-up)
    pin('2', 'DT', 'output', '2'), // quadrature B (board 10k pull-up)
    pin('3', 'SW', 'output', '3'), // shaft push-button (to GND)
    pin('4', '+', 'power_in', '4'), // 3.3–5 V
    pin('5', 'GND', 'power_in', '5'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'KY-040', sizeNm: Math.round(G * 0.42) },
    ],
    pins: [
      { key: '4', at: { x: -4 * G, y: 2 * G }, dir: 'W' }, // +
      { key: '5', at: { x: -4 * G, y: -2 * G }, dir: 'W' }, // GND
      { key: '1', at: { x: 4 * G, y: 2 * G }, dir: 'E' }, // CLK
      { key: '2', at: { x: 4 * G, y: 0 }, dir: 'E' }, // DT
      { key: '3', at: { x: 4 * G, y: -2 * G }, dir: 'E' }, // SW
    ],
  },
  parametrics: { maxVoltage: 5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-22 against components101 KY-040 + espboards.dev + the Keyes KY-040 datasheet (the shared component log agrees): 5-pin module, silk order CLK, DT, SW, +, GND. Incremental quadrature rotary encoder + shaft push-button. CLK = quadrature A, DT = quadrature B (board carries 10k pull-ups on both so an open contact reads HIGH); SW = momentary push-button to GND. 3.3–5 V. CLK/DT/SW modeled output (signal lines the MCU reads), + and GND power_in. refPrefix U. See inbox/2026-06-22-ky040-encoder-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// KY-023 dual-axis analog joystick — 5-pin (GND, +5V, VRx, VRy, SW). Two 10k pots (X/Y)
// + a push-button (press the stick down). VRx/VRy = analog wiper outputs (0–VCC), SW =
// momentary button to GND. 3.3–5 V. VRx/VRy/SW = output (MCU reads), GND/+5V = power_in.
// Footprint deferred.
const ky023Joystick = definePart({
  id: 'core:ky023-joystick',
  name: 'KY-023 dual-axis analog joystick module',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'KY-023',
  manufacturer: 'Keyes (generic PS2-style joystick)',
  datasheetUrl: 'https://arduinomodules.info/ky-023-joystick-dual-axis-module/',
  pins: [
    pin('1', 'GND', 'power_in', '1'),
    pin('2', '+5V', 'power_in', '2'), // 3.3–5 V supply
    pin('3', 'VRx', 'output', '3'), // X-axis analog (pot wiper, 0–VCC)
    pin('4', 'VRy', 'output', '4'), // Y-axis analog (pot wiper, 0–VCC)
    pin('5', 'SW', 'output', '5'), // push-button (to GND, needs MCU pull-up)
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'KY-023', sizeNm: Math.round(G * 0.42) },
    ],
    pins: [
      { key: '2', at: { x: -4 * G, y: 2 * G }, dir: 'W' }, // +5V
      { key: '1', at: { x: -4 * G, y: -2 * G }, dir: 'W' }, // GND
      { key: '3', at: { x: 4 * G, y: 2 * G }, dir: 'E' }, // VRx
      { key: '4', at: { x: 4 * G, y: 0 }, dir: 'E' }, // VRy
      { key: '5', at: { x: 4 * G, y: -2 * G }, dir: 'E' }, // SW
    ],
  },
  parametrics: { maxVoltage: 5 }, // 3.3–5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-22 against arduinomodules.info KY-023 + espboards.dev + watelectronics (the shared component log agrees exactly): 5-pin module, silk order GND, +5V, VRx, VRy, SW. Two perpendicular 10k pots give VRx (X) and VRy (Y) analog wiper outputs (0–VCC); pressing the stick closes SW to GND (needs an MCU pull-up, reads LOW when pressed). 3.3–5 V. VRx/VRy/SW modeled output (signals the MCU reads), GND/+5V power_in. refPrefix U. See inbox/2026-06-22-ky023-joystick-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// L293D quadruple half-H driver IC (DIP-16) — dual H-bridge motor driver with internal
// flyback diodes. Two enables (1,2EN / 3,4EN), four inputs (1A–4A), four outputs (1Y–4Y),
// VCC1 (logic 4.5–7 V), VCC2 (motor 4.5–36 V), 4× GND (center pins, also heat-sinking).
// EN + inputs = input (MCU-driven), Y outputs = output (drive the motor), VCC1/VCC2/GND =
// power_in. Standard DIP-16 layout (1–8 left, 16–9 right). Footprint deferred (no DIP-16 helper).
const l293d = definePart({
  id: 'core:l293d',
  name: 'L293D dual H-bridge motor driver IC',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'L293D',
  manufacturer: 'STMicroelectronics / Texas Instruments',
  datasheetUrl: 'https://www.st.com/resource/en/datasheet/l293d.pdf',
  pins: [
    pin('1', 'EN12', 'input', '1'), // 1,2EN — enable left bridge (PWM/HIGH)
    pin('2', '1A', 'input', '2'), // input 1
    pin('3', '1Y', 'output', '3'), // output 1 → motor
    pin('4', 'GND', 'power_in', '4'),
    pin('5', 'GND', 'power_in', '5'),
    pin('6', '2Y', 'output', '6'), // output 2 → motor
    pin('7', '2A', 'input', '7'), // input 2
    pin('8', 'VCC2', 'power_in', '8'), // motor supply 4.5–36 V
    pin('9', 'EN34', 'input', '9'), // 3,4EN — enable right bridge
    pin('10', '3A', 'input', '10'), // input 3
    pin('11', '3Y', 'output', '11'), // output 3 → motor
    pin('12', 'GND', 'power_in', '12'),
    pin('13', 'GND', 'power_in', '13'),
    pin('14', '4Y', 'output', '14'), // output 4 → motor
    pin('15', '4A', 'input', '15'), // input 4
    pin('16', 'VCC1', 'power_in', '16'), // logic supply 4.5–7 V
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -8 * G, w: 6 * G, h: 16 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'L293D', sizeNm: Math.round(G * 0.6) },
    ],
    pins: [
      // left column: pins 1–8 top → bottom
      { key: '1', at: { x: -4 * G, y: 7 * G }, dir: 'W' },
      { key: '2', at: { x: -4 * G, y: 5 * G }, dir: 'W' },
      { key: '3', at: { x: -4 * G, y: 3 * G }, dir: 'W' },
      { key: '4', at: { x: -4 * G, y: G }, dir: 'W' },
      { key: '5', at: { x: -4 * G, y: -G }, dir: 'W' },
      { key: '6', at: { x: -4 * G, y: -3 * G }, dir: 'W' },
      { key: '7', at: { x: -4 * G, y: -5 * G }, dir: 'W' },
      { key: '8', at: { x: -4 * G, y: -7 * G }, dir: 'W' },
      // right column: pins 16–9 top → bottom (DIP mirror)
      { key: '16', at: { x: 4 * G, y: 7 * G }, dir: 'E' },
      { key: '15', at: { x: 4 * G, y: 5 * G }, dir: 'E' },
      { key: '14', at: { x: 4 * G, y: 3 * G }, dir: 'E' },
      { key: '13', at: { x: 4 * G, y: G }, dir: 'E' },
      { key: '12', at: { x: 4 * G, y: -G }, dir: 'E' },
      { key: '11', at: { x: 4 * G, y: -3 * G }, dir: 'E' },
      { key: '10', at: { x: 4 * G, y: -5 * G }, dir: 'E' },
      { key: '9', at: { x: 4 * G, y: -7 * G }, dir: 'E' },
    ],
  },
  parametrics: { maxVoltage: 36 }, // VCC2 motor supply up to 36 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-22 against the ST L293D datasheet + components101 + utmel (the shared component log agrees): DIP-16. Pin 1 = 1,2EN (enable left bridge), 2 = 1A, 3 = 1Y, 4/5 = GND, 6 = 2Y, 7 = 2A, 8 = VCC2 (motor 4.5–36 V), 9 = 3,4EN, 10 = 3A, 11 = 3Y, 12/13 = GND, 14 = 4Y, 15 = 4A, 16 = VCC1 (logic 4.5–7 V). 600 mA/channel, internal flyback diodes. Enables + A inputs = input (MCU-driven), Y outputs = output (drive the load), VCC1/VCC2/4×GND = power_in. Standard DIP-16 schematic layout (1–8 left top→bottom, 16–9 right top→bottom). refPrefix U. See inbox/2026-06-22-l293d-pinout.md. No footprint yet — no DIP-16 helper, land pattern is a later slice.',
});

// Songle SRD-05VDC-SL-C relay — 5 V SPDT electromechanical relay, 5-pin PCB type. Two
// non-polarized coil pins (~70 Ω, 0.36 W) + a SPDT contact set: COM, NO, NC. Contacts
// rated 10 A 250 VAC / 10 A 30 VDC. As a bare relay every pin is passive (the coil is an
// inductive load you drive externally; contacts are switch terminals). refPrefix K (relay).
const srd05vdcRelay = definePart({
  id: 'core:srd-05vdc-relay',
  name: 'Songle SRD-05VDC-SL-C relay (SPDT, 5 V)',
  refPrefix: 'K',
  class: 'switch',
  mpn: 'SRD-05VDC-SL-C',
  manufacturer: 'Songle (Ningbo Songle Relay)',
  datasheetUrl: 'https://www.circuitbasics.com/wp-content/uploads/2015/11/SRD-05VDC-SL-C-Datasheet.pdf',
  pins: [
    pin('1', 'COIL1', 'passive', '1'), // coil (non-polarized, ~70 Ω)
    pin('2', 'COIL2', 'passive', '2'), // coil
    pin('3', 'COM', 'passive', '3'), // common contact
    pin('4', 'NO', 'passive', '4'), // normally-open contact
    pin('5', 'NC', 'passive', '5'), // normally-closed contact
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -4 * G, w: 6 * G, h: 8 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'SRD-05', sizeNm: Math.round(G * 0.42) },
    ],
    pins: [
      { key: '1', at: { x: -4 * G, y: 2 * G }, dir: 'W' }, // COIL1
      { key: '2', at: { x: -4 * G, y: -2 * G }, dir: 'W' }, // COIL2
      { key: '3', at: { x: 4 * G, y: 2 * G }, dir: 'E' }, // COM
      { key: '4', at: { x: 4 * G, y: 0 }, dir: 'E' }, // NO
      { key: '5', at: { x: 4 * G, y: -2 * G }, dir: 'E' }, // NC
    ],
  },
  parametrics: { maxVoltage: 250 }, // contact rating 250 VAC
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-22 against the Songle SRD-05VDC-SL-C datasheet (circuitbasics/handsontec) + the shared component log: 5-pin PCB-type SPDT relay. Two non-polarized coil pins (5 V, ~70 Ω, 0.36 W) and a SPDT contact set COM/NO/NC. Contacts rated 10 A 250 VAC / 10 A 30 VDC. NC closed at rest, NO closes when the coil energizes. As a bare relay all pins modeled passive (the coil is an inductive load driven externally; contacts are switch terminals). refPrefix K (relay), class switch. See inbox/2026-06-22-srd-05vdc-relay-pinout.md. No footprint yet — land pattern is a later slice.',
});

// 10K rotary potentiometer — standard 3-terminal variable resistor / voltage divider.
// Terminals A and B are the fixed ends of the 10 kΩ track; WIPER (middle) taps the
// adjustable point (~300° rotation). All terminals passive; class resistor, refPrefix RV.
const pot10k = definePart({
  id: 'core:pot-10k',
  name: '10K rotary potentiometer',
  refPrefix: 'RV',
  class: 'resistor',
  mpn: 'POT-10K',
  manufacturer: 'generic (10 kΩ rotary)',
  pins: [
    pin('1', 'A', 'passive', '1'), // one end of the 10k track
    pin('2', 'WIPER', 'passive', '2'), // wiper (variable tap)
    pin('3', 'B', 'passive', '3'), // other end of the 10k track
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -2 * G, y: -G, w: 4 * G, h: 2 * G },
      { kind: 'text', at: { x: 0, y: -2 * G }, text: '10k', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      { key: '1', at: { x: -3 * G, y: 0 }, dir: 'W' }, // A
      { key: '3', at: { x: 3 * G, y: 0 }, dir: 'E' }, // B
      { key: '2', at: { x: 0, y: 2 * G }, dir: 'N' }, // WIPER
    ],
  },
  provenance: 'verified',
  provenanceNote:
    'Standard 3-terminal rotary potentiometer (Tyler owns a 10 kΩ rotary pot — "10K Ohm Rotary Potentiometer" in the component log). Universal topology, web-confirmed: terminals A and B are the two fixed ends of the resistive track, the middle pin is the WIPER (adjustable tap); used as a variable resistor (A–WIPER) or a voltage divider (A–WIPER–B). ~300° mechanical rotation, linear taper assumed for general-purpose use. All terminals passive; class resistor, refPrefix RV (variable resistor). See inbox/2026-06-22-pot-10k-pinout.md. No footprint yet — land pattern is a later slice.',
});

// P30N06LE (RFP30N06LE) logic-level N-channel power MOSFET, TO-220AB. 60 V Vds, 30 A Id,
// Rds(on) 0.047 Ω, Vgs(th) 2–4 V — fully on from 5 V logic, so a GPIO can switch it.
// TO-220 pin order 1=Gate, 2=Drain, 3=Source (tab = Drain). Distinct from the small-signal
// SOT-23 AO3400 already in the library. G/D/S modeled passive, class transistor, refPrefix Q.
const p30n06le = definePart({
  id: 'core:p30n06le',
  name: 'P30N06LE N-MOSFET (logic-level, TO-220)',
  refPrefix: 'Q',
  class: 'transistor',
  mpn: 'RFP30N06LE',
  manufacturer: 'Fairchild / onsemi',
  datasheetUrl: 'https://cdn.sparkfun.com/assets/4/1/1/8/0/RFP30N06LE.pdf',
  pins: [
    pin('G', 'G', 'passive', '1'), // gate (logic-level, Vgs(th) 2–4 V)
    pin('D', 'D', 'passive', '2'), // drain (tab)
    pin('S', 'S', 'passive', '3'), // source
  ],
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
  parametrics: { maxVoltage: 60 }, // Vds 60 V
  provenance: 'verified',
  provenanceNote:
    'Pin map web-verified 2026-06-22 against the Fairchild/onsemi RFP30N06LE datasheet (the shared component log agrees): logic-level N-channel enhancement-mode power MOSFET in TO-220AB. Standard pin order 1 = Gate, 2 = Drain, 3 = Source, with the metal tab internally connected to Drain. 60 V Vds, 30 A Id, Rds(on) 0.047 Ω, Vgs(th) 2–4 V (5 V-logic drivable). G/D/S modeled passive (discrete 3-terminal semiconductor), class transistor, refPrefix Q. Distinct from the SOT-23 AO3400 already in the seed. See inbox/2026-06-22-p30n06le-pinout.md. No footprint yet — TO-220 land pattern is a later slice.',
});

// HW-221 bidirectional logic level converter — YF08E (TXS0108E-equivalent) 8-channel
// auto-direction level shifter on the common blue ~2×3 cm breakout. Two 10-pin rows:
// low-voltage A side (VA, A1–A8, OE) and high-voltage B side (VB, B1–B8, GND), with the
// channels paired straight across (A1↔B1 … A8↔B8, OE↔GND). VA = lower reference
// (1.2–3.6 V), VB = higher reference (1.65–5.5 V, VA ≤ VB). OE = output-enable, active
// HIGH with an internal pulldown (part is disabled / high-Z when OE floats). VA/VB/GND =
// power_in, OE = input (host-driven), all A/B channels bidi (auto-direction). The catalog
// description (no OE, GND on the low side) was WRONG — the diagram shows OE as the bottom
// A-side pin and GND only on the B side. refPrefix U, class ic. Footprint deferred.
const hw221LevelShifter = definePart({
  id: 'core:hw221-level-shifter',
  name: 'HW-221 8-channel bidirectional logic level converter (YF08E)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'HW-221',
  manufacturer: 'generic (YF08E / TXS0108E-equivalent)',
  datasheetUrl: 'https://www.ti.com/lit/ds/symlink/txs0108e.pdf',
  pins: [
    pin('VA', 'VA', 'power_in', '1'), // low-side reference 1.2–3.6 V
    pin('A1', 'A1', 'bidi', '2'),
    pin('A2', 'A2', 'bidi', '3'),
    pin('A3', 'A3', 'bidi', '4'),
    pin('A4', 'A4', 'bidi', '5'),
    pin('A5', 'A5', 'bidi', '6'),
    pin('A6', 'A6', 'bidi', '7'),
    pin('A7', 'A7', 'bidi', '8'),
    pin('A8', 'A8', 'bidi', '9'),
    pin('OE', 'OE', 'input', '10'), // output enable, active HIGH (internal pulldown)
    pin('VB', 'VB', 'power_in', '11'), // high-side reference 1.65–5.5 V (VA ≤ VB)
    pin('B1', 'B1', 'bidi', '12'),
    pin('B2', 'B2', 'bidi', '13'),
    pin('B3', 'B3', 'bidi', '14'),
    pin('B4', 'B4', 'bidi', '15'),
    pin('B5', 'B5', 'bidi', '16'),
    pin('B6', 'B6', 'bidi', '17'),
    pin('B7', 'B7', 'bidi', '18'),
    pin('B8', 'B8', 'bidi', '19'),
    pin('GND', 'GND', 'power_in', '20'),
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -3 * G, y: -10 * G, w: 6 * G, h: 20 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'HW-221', sizeNm: Math.round(G * 0.5) },
    ],
    pins: [
      // A side (left), top→bottom: VA, A1–A8, OE
      { key: 'VA', at: { x: -4 * G, y: 9 * G }, dir: 'W' },
      { key: 'A1', at: { x: -4 * G, y: 7 * G }, dir: 'W' },
      { key: 'A2', at: { x: -4 * G, y: 5 * G }, dir: 'W' },
      { key: 'A3', at: { x: -4 * G, y: 3 * G }, dir: 'W' },
      { key: 'A4', at: { x: -4 * G, y: G }, dir: 'W' },
      { key: 'A5', at: { x: -4 * G, y: -G }, dir: 'W' },
      { key: 'A6', at: { x: -4 * G, y: -3 * G }, dir: 'W' },
      { key: 'A7', at: { x: -4 * G, y: -5 * G }, dir: 'W' },
      { key: 'A8', at: { x: -4 * G, y: -7 * G }, dir: 'W' },
      { key: 'OE', at: { x: -4 * G, y: -9 * G }, dir: 'W' },
      // B side (right), top→bottom: VB, B1–B8, GND (paired opposite the A side)
      { key: 'VB', at: { x: 4 * G, y: 9 * G }, dir: 'E' },
      { key: 'B1', at: { x: 4 * G, y: 7 * G }, dir: 'E' },
      { key: 'B2', at: { x: 4 * G, y: 5 * G }, dir: 'E' },
      { key: 'B3', at: { x: 4 * G, y: 3 * G }, dir: 'E' },
      { key: 'B4', at: { x: 4 * G, y: G }, dir: 'E' },
      { key: 'B5', at: { x: 4 * G, y: -G }, dir: 'E' },
      { key: 'B6', at: { x: 4 * G, y: -3 * G }, dir: 'E' },
      { key: 'B7', at: { x: 4 * G, y: -5 * G }, dir: 'E' },
      { key: 'B8', at: { x: 4 * G, y: -7 * G }, dir: 'E' },
      { key: 'GND', at: { x: 4 * G, y: -9 * G }, dir: 'E' },
    ],
  },
  parametrics: { maxVoltage: 5.5 }, // VB up to 5.5 V
  provenance: 'verified',
  provenanceNote:
    'Pin map VISUALLY verified 2026-06-22 against an authoritative HW-221/YF08E pinout diagram read as an image (components101 TXS0108E pinout; the diagram itself shows the "YF08E" IC and "HW-221" silkscreen, confirming the 8-channel target board — NOT the 4-channel BSS138 board). Silk rows: low-voltage A side VA, A1–A8, OE (top→bottom); high-voltage B side VB, B1–B8, GND (top→bottom); channels paired straight across (A1↔B1 … A8↔B8, OE↔GND). This CORRECTS the owner catalog, which listed no OE and put GND on the low side — the real bottom A-side pin is OE (output enable, active HIGH, internal pulldown → disabled/high-Z when floating), and the single GND is on the B side. YF08E ≈ TXS0108E: VA = lower reference 1.2–3.6 V, VB = higher reference 1.65–5.5 V (VA ≤ VB), 8 auto-direction bidirectional channels. VA/VB/GND = power_in, OE = input (host-driven), A1–A8/B1–B8 = bidi. The module carries no manufacturer pin numbers, so the 1–20 numbering is our convention (A side 1–10, B side 11–20). refPrefix U, class ic. See inbox/2026-06-22-hw221-level-shifter-pinout.md. No footprint yet — module land pattern is a later slice.',
});

// ESP8266EX — Espressif's bare WiFi SoC in a QFN-32 (5×5 mm, 0.5 mm pitch) with a center
// GND thermal pad (pin 33). This is the RAW CHIP for custom-PCB designs, distinct from the
// NodeMCU/ESP-12 modules already in the seed. Pin assignment verified against the official
// Espressif ESP8266EX datasheet v7.1, Table 2-1 (read as an image). Datasheet PRIMARY names
// kept (MTMS/MTDI/MTCK/MTDO are the JTAG names; GPIO14/12/13/15 are their alt functions —
// see the inline GPIO aliases). ERC: VDD*/GND = power_in; GPIOs = bidi; analog/EN/reset/bias
// (TOUT/CHIP_EN/EXT_RSTB/RES12K) = input; XTAL_OUT = output, XTAL_IN = input; LNA (RF
// antenna) = passive. refPrefix U, class ic. Footprint deferred (QFN-32 land pattern later).
const esp8266ex = definePart({
  id: 'core:esp8266ex',
  name: 'ESP8266EX WiFi SoC (QFN-32)',
  refPrefix: 'U',
  class: 'ic',
  mpn: 'ESP8266EX',
  manufacturer: 'Espressif Systems',
  datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf',
  pins: [
    pin('1', 'VDDA', 'power_in', '1'), // analog power (2.5–3.6 V)
    pin('2', 'LNA', 'passive', '2'), // RF antenna interface
    pin('3', 'VDD3P3', 'power_in', '3'), // amp power (2.5–3.6 V)
    pin('4', 'VDD3P3', 'power_in', '4'), // amp power (2.5–3.6 V)
    pin('5', 'VDD_RTC', 'power_in', '5'), // RTC rail ~1.1 V (normally left NC)
    pin('6', 'TOUT', 'input', '6'), // ADC analog input (0–1.0 V)
    pin('7', 'CHIP_EN', 'input', '7'), // chip enable, active HIGH
    pin('8', 'XPD_DCDC', 'bidi', '8'), // GPIO16 / deep-sleep wakeup
    pin('9', 'MTMS', 'bidi', '9'), // GPIO14
    pin('10', 'MTDI', 'bidi', '10'), // GPIO12
    pin('11', 'VDDPST', 'power_in', '11'), // digital/IO power (1.8–3.6 V)
    pin('12', 'MTCK', 'bidi', '12'), // GPIO13
    pin('13', 'MTDO', 'bidi', '13'), // GPIO15
    pin('14', 'GPIO2', 'bidi', '14'), // gpio (boot strap)
    pin('15', 'GPIO0', 'bidi', '15'), // gpio (boot strap)
    pin('16', 'GPIO4', 'bidi', '16'), // gpio
    pin('17', 'VDDPST', 'power_in', '17'), // digital/IO power (1.8–3.6 V)
    pin('18', 'SDIO_DATA_2', 'bidi', '18'), // GPIO9
    pin('19', 'SDIO_DATA_3', 'bidi', '19'), // GPIO10
    pin('20', 'SDIO_CMD', 'bidi', '20'), // GPIO11
    pin('21', 'SDIO_CLK', 'bidi', '21'), // GPIO6
    pin('22', 'SDIO_DATA_0', 'bidi', '22'), // GPIO7
    pin('23', 'SDIO_DATA_1', 'bidi', '23'), // GPIO8
    pin('24', 'GPIO5', 'bidi', '24'), // gpio
    pin('25', 'U0RXD', 'bidi', '25'), // GPIO3 / UART0 RX
    pin('26', 'U0TXD', 'bidi', '26'), // GPIO1 / UART0 TX
    pin('27', 'XTAL_OUT', 'output', '27'), // crystal drive out
    pin('28', 'XTAL_IN', 'input', '28'), // crystal in
    pin('29', 'VDDD', 'power_in', '29'), // analog power (2.5–3.6 V)
    pin('30', 'VDDA', 'power_in', '30'), // analog power (2.5–3.6 V)
    pin('31', 'RES12K', 'input', '31'), // bias: 12 kΩ to GND
    pin('32', 'EXT_RSTB', 'input', '32'), // external reset, active LOW
    pin('33', 'GND', 'power_in', '33'), // center thermal pad
  ],
  symbol: {
    primitives: [
      { kind: 'rect', x: -4 * G, y: -17 * G, w: 8 * G, h: 34 * G },
      { kind: 'text', at: { x: 0, y: 0 }, text: 'ESP8266EX', sizeNm: Math.round(G * 0.6) },
    ],
    pins: [
      { key: '1', at: { x: -5 * G, y: 16 * G }, dir: 'W' }, // VDDA
      { key: '2', at: { x: -5 * G, y: 14 * G }, dir: 'W' }, // LNA
      { key: '3', at: { x: -5 * G, y: 12 * G }, dir: 'W' }, // VDD3P3
      { key: '4', at: { x: -5 * G, y: 10 * G }, dir: 'W' }, // VDD3P3
      { key: '5', at: { x: -5 * G, y: 8 * G }, dir: 'W' }, // VDD_RTC
      { key: '6', at: { x: -5 * G, y: 6 * G }, dir: 'W' }, // TOUT
      { key: '7', at: { x: -5 * G, y: 4 * G }, dir: 'W' }, // CHIP_EN
      { key: '8', at: { x: -5 * G, y: 2 * G }, dir: 'W' }, // XPD_DCDC
      { key: '9', at: { x: -5 * G, y: 0 }, dir: 'W' }, // MTMS
      { key: '10', at: { x: -5 * G, y: -2 * G }, dir: 'W' }, // MTDI
      { key: '11', at: { x: -5 * G, y: -4 * G }, dir: 'W' }, // VDDPST
      { key: '12', at: { x: -5 * G, y: -6 * G }, dir: 'W' }, // MTCK
      { key: '13', at: { x: -5 * G, y: -8 * G }, dir: 'W' }, // MTDO
      { key: '14', at: { x: -5 * G, y: -10 * G }, dir: 'W' }, // GPIO2
      { key: '15', at: { x: -5 * G, y: -12 * G }, dir: 'W' }, // GPIO0
      { key: '16', at: { x: -5 * G, y: -14 * G }, dir: 'W' }, // GPIO4
      { key: '17', at: { x: -5 * G, y: -16 * G }, dir: 'W' }, // VDDPST
      { key: '18', at: { x: 5 * G, y: 15 * G }, dir: 'E' }, // SDIO_DATA_2
      { key: '19', at: { x: 5 * G, y: 13 * G }, dir: 'E' }, // SDIO_DATA_3
      { key: '20', at: { x: 5 * G, y: 11 * G }, dir: 'E' }, // SDIO_CMD
      { key: '21', at: { x: 5 * G, y: 9 * G }, dir: 'E' }, // SDIO_CLK
      { key: '22', at: { x: 5 * G, y: 7 * G }, dir: 'E' }, // SDIO_DATA_0
      { key: '23', at: { x: 5 * G, y: 5 * G }, dir: 'E' }, // SDIO_DATA_1
      { key: '24', at: { x: 5 * G, y: 3 * G }, dir: 'E' }, // GPIO5
      { key: '25', at: { x: 5 * G, y: 1 * G }, dir: 'E' }, // U0RXD
      { key: '26', at: { x: 5 * G, y: -1 * G }, dir: 'E' }, // U0TXD
      { key: '27', at: { x: 5 * G, y: -3 * G }, dir: 'E' }, // XTAL_OUT
      { key: '28', at: { x: 5 * G, y: -5 * G }, dir: 'E' }, // XTAL_IN
      { key: '29', at: { x: 5 * G, y: -7 * G }, dir: 'E' }, // VDDD
      { key: '30', at: { x: 5 * G, y: -9 * G }, dir: 'E' }, // VDDA
      { key: '31', at: { x: 5 * G, y: -11 * G }, dir: 'E' }, // RES12K
      { key: '32', at: { x: 5 * G, y: -13 * G }, dir: 'E' }, // EXT_RSTB
      { key: '33', at: { x: 5 * G, y: -15 * G }, dir: 'E' }, // GND
    ],
  },
  parametrics: { maxVoltage: 3.6 }, // VDD 2.5–3.6 V (3.3 V typical)
  provenance: 'verified',
  provenanceNote:
    'Pin map VISUALLY verified 2026-06-22 against the official Espressif ESP8266EX datasheet v7.1, Table 2-1 + Figure 2-1 (read as images): QFN-32, 5×5 mm, 0.5 mm pitch, with the center exposed thermal pad as pin 33 = GND. 32 signal pins per the datasheet, datasheet PRIMARY names retained (pins 9/10/12/13 are MTMS/MTDI/MTCK/MTDO with GPIO14/12/13/15 as alt functions; SDIO_DATA_0..3 / SDIO_CMD / SDIO_CLK are GPIO7/8/9/10/11/6; U0RXD/U0TXD are GPIO3/1). ERC: all VDD rails (VDDA ×2, VDD3P3 ×2, VDD_RTC, VDDPST ×2, VDDD) + GND pad = power_in; GPIO/JTAG/SDIO/UART I/O pins = bidi; TOUT (ADC), CHIP_EN, EXT_RSTB (reset), RES12K (12 kΩ bias) = input; XTAL_OUT = output, XTAL_IN = input; LNA (RF antenna) = passive. This is the BARE SoC for custom PCBs — distinct from the NodeMCU ESP8266/ESP-32S modules already in the seed. See inbox/2026-06-22-esp8266ex-pinout.md. No footprint yet — QFN-32 land pattern is a later slice.',
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
  bme280,
  mpu6050,
  ds1302,
  ds3231,
  uln2003Stepper,
  l298n,
  max7219,
  lcd1602,
  rc522,
  tb6612fng,
  ky038,
  flameSensor,
  irObstacle,
  soilMoisture,
  ttp223,
  ky006Buzzer,
  sw420Vibration,
  ky008Laser,
  ky022IrReceiver,
  ky005IrTransmitter,
  slotOptocoupler,
  ky016RgbLed,
  tm1637Display,
  ky004Button,
  arduinoNano,
  arduinoUno,
  arduinoMega2560,
  hcsr04,
  hcsr501,
  ky040Encoder,
  ky023Joystick,
  l293d,
  srd05vdcRelay,
  pot10k,
  p30n06le,
  hw221LevelShifter,
  esp8266ex,
  nodemcuEsp8266,
  nodemcuEsp32s,
  raspberryPi3bp,
  pushbutton,
  header2x10,
  usbcPower,
  battery,
  esp32s3,
  pwrVcc,
  pwrGnd,
];
