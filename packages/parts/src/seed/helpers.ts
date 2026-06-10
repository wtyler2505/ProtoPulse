import { SCHEMATIC_GRID } from '@protopulse/graph';
import type { Part, Pin, PinElectricalType, SymbolGeom, SymbolPrimitive } from '../types.js';

/** One schematic grid unit (1.27mm) in nm. */
export const G = SCHEMATIC_GRID;

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
