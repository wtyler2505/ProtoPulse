import type { Part } from '../types.js';
import { definePart, G, passivePins, pin, twoPinSymbol } from './helpers.js';

/**
 * The M1 seed library — ~15 parts, enough for Track 1 ("First Light")
 * and the Probe's input-protection stage.
 *
 * Symbol geometry is schematic convention, not physical dimensions.
 * Pin NUMBERS appear only where verified against a datasheet (see
 * inbox/2026-06-10-m1-seed-part-pinouts.md); everything else carries
 * functional pin names and provenance: unverified.
 */

const resistor = definePart({
  id: 'core:resistor',
  name: 'Resistor',
  refPrefix: 'R',
  class: 'resistor',
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
  pins: passivePins(['A', 'K'], ['A', 'K']),
  symbol: diodeSymbol(),
  parametrics: { currentDrawA: 0.02 },
});

const diode1n4148 = definePart({
  id: 'core:1n4148',
  name: 'Small-signal diode 1N4148',
  refPrefix: 'D',
  class: 'diode',
  mpn: '1N4148',
  pins: passivePins(['A', 'K'], ['A', 'K']),
  symbol: diodeSymbol(),
});

const schottky1n5819 = definePart({
  id: 'core:1n5819',
  name: 'Schottky diode 1N5819',
  refPrefix: 'D',
  class: 'diode',
  mpn: '1N5819',
  pins: passivePins(['A', 'K'], ['A', 'K']),
  symbol: diodeSymbol(),
});

const tvsUni = definePart({
  id: 'core:tvs-unidirectional',
  name: 'TVS diode (unidirectional)',
  refPrefix: 'D',
  class: 'diode',
  pins: passivePins(['A', 'K'], ['A', 'K']),
  symbol: diodeSymbol(),
});

const bat54s = definePart({
  id: 'core:bat54s',
  name: 'BAT54S dual series Schottky',
  refPrefix: 'D',
  class: 'diode',
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
  pushbutton,
  header2x10,
  usbcPower,
  battery,
  pwrVcc,
  pwrGnd,
];
