import { SCHEMATIC_GRID } from '@protopulse/graph';
import { z } from 'zod';

import type { Nm, Vec } from '@protopulse/graph';

/**
 * The minimal M1 part model — a trimmed Vol II §I schema. The graph is
 * parts-blind (it stores partId + partRev); ERC, export, renderer, app,
 * and the AI consume parts through this package.
 */

/** ERC pin electrical types — Vol II §C.1. */
export const PIN_ELECTRICAL_TYPES = [
  'input',
  'output',
  'bidi',
  'tristate',
  'passive',
  'power_in',
  'power_out',
  'open_collector',
  'open_emitter',
  'nc',
] as const;
export type PinElectricalType = (typeof PIN_ELECTRICAL_TYPES)[number];

export type PinDir = 'N' | 'S' | 'E' | 'W';

export interface Pin {
  /** Stable key used in PortRefs (componentId:pinKey). */
  key: string;
  /** Human name ("TRIG", "VCC", "A"). */
  name: string;
  electricalType: PinElectricalType;
  /** Physical package pin number, when verified ("1".."8"). */
  number?: string;
}

/** Where a pin attaches on the symbol, on the 1.27mm schematic grid. */
export interface SymbolPin {
  key: string;
  at: Vec;
  /** Direction the pin points away from the body. */
  dir: PinDir;
}

export type SymbolPrimitive =
  | { kind: 'rect'; x: Nm; y: Nm; w: Nm; h: Nm }
  | { kind: 'circle'; cx: Nm; cy: Nm; r: Nm }
  | { kind: 'line'; a: Vec; b: Vec }
  | { kind: 'polyline'; points: Vec[]; closed?: boolean }
  | { kind: 'text'; at: Vec; text: string; sizeNm: Nm };

export interface SymbolGeom {
  /** Body outline primitives, origin-centered. */
  primitives: SymbolPrimitive[];
  pins: SymbolPin[];
}

export type PartClass =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'diode'
  | 'led'
  | 'transistor'
  | 'ic'
  | 'connector'
  | 'switch'
  | 'power'
  | 'battery'
  | 'other';

export type Provenance = 'unverified' | 'community-tested' | 'verified';

export interface Part {
  id: string;
  rev: number;
  name: string;
  /** "R", "C", "D", "U"… drives auto ref assignment. */
  refPrefix: string;
  class: PartClass;
  mpn?: string;
  manufacturer?: string;
  datasheetUrl?: string;
  pins: Pin[];
  symbol: SymbolGeom;
  /** Typed parametrics for ERC/sim (declared current draw, ratings…). */
  parametrics?: {
    /** Worst-case supply draw in amps, for current-budget checks. */
    currentDrawA?: number;
    maxVoltage?: number;
  };
  provenance: Provenance;
  /** Who/what verified this against which datasheet rev, or why not. */
  provenanceNote?: string;
}

// ── Validation ───────────────────────────────────────────────────────

const zNm = z.number().int();
const zVec = z.object({ x: zNm, y: zNm });

const pinSchema: z.ZodType<Pin> = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  electricalType: z.enum(PIN_ELECTRICAL_TYPES),
  number: z.string().optional(),
});

const symbolPrimitiveSchema: z.ZodType<SymbolPrimitive> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rect'), x: zNm, y: zNm, w: zNm, h: zNm }),
  z.object({ kind: z.literal('circle'), cx: zNm, cy: zNm, r: zNm }),
  z.object({ kind: z.literal('line'), a: zVec, b: zVec }),
  z.object({ kind: z.literal('polyline'), points: z.array(zVec).min(2), closed: z.boolean().optional() }),
  z.object({ kind: z.literal('text'), at: zVec, text: z.string(), sizeNm: zNm }),
]);

export const partSchema: z.ZodType<Part> = z
  .object({
    id: z.string().min(1),
    rev: z.number().int().positive(),
    name: z.string().min(1),
    refPrefix: z.string().min(1),
    class: z.enum([
      'resistor',
      'capacitor',
      'inductor',
      'diode',
      'led',
      'transistor',
      'ic',
      'connector',
      'switch',
      'power',
      'battery',
      'other',
    ]),
    mpn: z.string().optional(),
    manufacturer: z.string().optional(),
    datasheetUrl: z.string().url().optional(),
    pins: z.array(pinSchema).min(1),
    symbol: z.object({
      primitives: z.array(symbolPrimitiveSchema),
      pins: z.array(z.object({ key: z.string().min(1), at: zVec, dir: z.enum(['N', 'S', 'E', 'W']) })),
    }),
    parametrics: z
      .object({
        currentDrawA: z.number().positive().optional(),
        maxVoltage: z.number().positive().optional(),
      })
      .optional(),
    provenance: z.enum(['unverified', 'community-tested', 'verified']),
    provenanceNote: z.string().optional(),
  })
  .superRefine((part, ctx) => {
    const pinKeys = new Set<string>();
    for (const pin of part.pins) {
      if (pinKeys.has(pin.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate pin key ${pin.key}` });
      }
      pinKeys.add(pin.key);
    }
    for (const sp of part.symbol.pins) {
      if (!pinKeys.has(sp.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `symbol pin ${sp.key} has no electrical pin` });
      }
      if (sp.at.x % SCHEMATIC_GRID !== 0 || sp.at.y % SCHEMATIC_GRID !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `symbol pin ${sp.key} is off the 1.27mm grid (${String(sp.at.x)}, ${String(sp.at.y)})`,
        });
      }
    }
    const symbolKeys = new Set(part.symbol.pins.map((p) => p.key));
    for (const pin of part.pins) {
      if (!symbolKeys.has(pin.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `pin ${pin.key} missing from symbol` });
      }
    }
  });
