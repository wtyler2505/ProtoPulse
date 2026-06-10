import { MM, SCHEMATIC_GRID } from '@protopulse/graph';

import type { Footprint, Part, Pin, PinElectricalType, SymbolGeom, SymbolPrimitive } from '../types.js';

/** One schematic grid unit (1.27mm) in nm. */
export const G = SCHEMATIC_GRID;

// ── Generic footprint builders ───────────────────────────────────────
// All of these are generic IPC-class footprints, unverified — replace
// per-MPN before fab. Dimensions are conventional class values in
// integer nm, not measurements from a specific manufacturer drawing.

/** 0805-class chip footprint: two 1.0×1.25mm rect pads at x = ±0.95mm. */
export function footprint0805(keys: [string, string] = ['1', '2']): Footprint {
  return {
    pads: [
      { pinKey: keys[0], at: { x: Math.round(-0.95 * MM), y: 0 }, wNm: 1 * MM, hNm: Math.round(1.25 * MM), shape: 'rect' },
      { pinKey: keys[1], at: { x: Math.round(0.95 * MM), y: 0 }, wNm: 1 * MM, hNm: Math.round(1.25 * MM), shape: 'rect' },
    ],
    courtyard: { wNm: Math.round(3.2 * MM), hNm: Math.round(1.6 * MM) },
  };
}

/** SOT-23-class footprint: pads 1+2 at y = −1.0mm (x = ±0.95mm), pad 3
 *  opposite at (0, +1.0mm); 0.9×1.0mm rect pads. */
export function footprintSot23(keys: [string, string, string]): Footprint {
  const padW = Math.round(0.9 * MM);
  const padH = 1 * MM;
  return {
    pads: [
      { pinKey: keys[0], at: { x: Math.round(-0.95 * MM), y: -1 * MM }, wNm: padW, hNm: padH, shape: 'rect' },
      { pinKey: keys[1], at: { x: Math.round(0.95 * MM), y: -1 * MM }, wNm: padW, hNm: padH, shape: 'rect' },
      { pinKey: keys[2], at: { x: 0, y: 1 * MM }, wNm: padW, hNm: padH, shape: 'rect' },
    ],
    courtyard: { wNm: Math.round(3.5 * MM), hNm: Math.round(3.2 * MM) },
  };
}

/** DIP-8-class footprint: 1.6mm circle pads with 0.8mm drills on a
 *  2.54mm pitch, rows 7.62mm apart; pins 1–4 down the left column,
 *  5–8 back up the right. */
export function footprintDip8(): Footprint {
  const pitch = Math.round(2.54 * MM);
  const halfRow = Math.round(3.81 * MM); // rows 7.62mm apart
  const pad = { wNm: Math.round(1.6 * MM), hNm: Math.round(1.6 * MM), shape: 'circle' as const, drillNm: Math.round(0.8 * MM) };
  const pads: Footprint['pads'] = [];
  for (let i = 0; i < 4; i++) {
    pads.push({ pinKey: String(i + 1), at: { x: -halfRow, y: Math.round(1.5 * pitch) - i * pitch }, ...pad });
  }
  for (let i = 0; i < 4; i++) {
    pads.push({ pinKey: String(i + 5), at: { x: halfRow, y: -Math.round(1.5 * pitch) + i * pitch }, ...pad });
  }
  return { pads, courtyard: { wNm: Math.round(9.8 * MM), hNm: Math.round(9.8 * MM) } };
}

/**
 * Two-terminal horizontal symbol: pins at (-2G,0) and (2G,0), body
 * primitives supplied by the caller.
 */
export function twoPinSymbol(primitives: SymbolPrimitive[], keys: [string, string] = ['1', '2']): SymbolGeom {
  return {
    primitives,
    pins: [
      { key: keys[0], at: { x: -2 * G, y: 0 }, dir: 'W' },
      { key: keys[1], at: { x: 2 * G, y: 0 }, dir: 'E' },
    ],
  };
}

export function passivePins(names: [string, string], keys: [string, string] = ['1', '2']): Pin[] {
  return [
    { key: keys[0], name: names[0], electricalType: 'passive' },
    { key: keys[1], name: names[1], electricalType: 'passive' },
  ];
}

export interface PartSeed {
  id: string;
  name: string;
  refPrefix: string;
  class: Part['class'];
  pins: Pin[];
  symbol: SymbolGeom;
  footprint?: Footprint;
  mpn?: string;
  manufacturer?: string;
  datasheetUrl?: string;
  parametrics?: Part['parametrics'];
  provenance?: Part['provenance'];
  provenanceNote?: string;
}

export function definePart(seed: PartSeed): Part {
  const { provenance, ...rest } = seed;
  return { rev: 1, ...rest, provenance: provenance ?? 'unverified' } as Part;
}

export function pin(
  key: string,
  name: string,
  electricalType: PinElectricalType,
  number?: string,
): Pin {
  return { key, name, electricalType, ...(number !== undefined ? { number } : {}) };
}
