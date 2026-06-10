import { z } from 'zod';

import type { PinEvent } from '@protopulse/emu';
import type { Uuid } from '@protopulse/graph';
import type { SimulateResult } from '@protopulse/sim';

/**
 * Co-sim bus types (Vol II §D.3), first slice: one-directional
 * MCU→SPICE. Firmware runs first; its pin edges are replayed into the
 * analog window as PWL voltage sources behind a series Rout — the
 * behavioral GPIO output boundary. Nothing flows back yet.
 */

/** Default GPIO high level, volts (5V logic — Vol II §D.3). */
export const DEFAULT_VOLTS_HIGH = 5;
/** Default GPIO low level, volts. */
export const DEFAULT_VOLTS_LOW = 0;
/** Default behavioral output resistance, ohms (Vol II §D.3 boundary). */
export const DEFAULT_ROUT_OHMS = 30;
/** Default edge slew ramp, seconds. */
export const DEFAULT_RISE_S = 100e-9;

/**
 * One MCU GPIO pin bound onto one design net. The pin's digital edges
 * become a PWL voltage source driving INTO the net through `routOhms`.
 */
export interface PinBinding {
  /** Port letter + bit, e.g. 'B5' (Arduino D13). */
  pin: string;
  /** The design net this pin drives. */
  netId: Uuid;
  /** Logic-high level in volts (default 5). */
  voltsHigh?: number;
  /** Logic-low level in volts (default 0). */
  voltsLow?: number;
  /** Series output resistance in ohms (default 30 — Vol II §D.3 behavioral GPIO boundary). */
  routOhms?: number;
  /** Edge slew ramp in seconds (default 100e-9). */
  riseS?: number;
}

/** One co-sim window: how long, how fine, and which pins drive which nets. */
export interface CosimWindowSpec {
  /** Window length, seconds. */
  windowS: number;
  /** Suggested transient output step, seconds. */
  stepS: number;
  /** Pin → net bindings; one PWL source per binding. */
  bindings: PinBinding[];
}

/** Everything one co-sim window produced, digital and analog sides both. */
export interface CosimResult {
  /** The SPICE transient run, fidelity manifest included. */
  sim: SimulateResult;
  /** All MCU output pin edges observed during the window (all pins, bound or not). */
  pinEvents: PinEvent[];
  /** CPU cycles actually consumed (may overshoot the window by ≤ one instruction per chunk). */
  mcuCycles: number;
  /** Emulated MCU time, seconds (= mcuCycles / clockHz). */
  virtualTimeS: number;
  /** Per bound pin: the exact SPICE card pair (V…PWL + series R) injected. */
  pwlSources: Record<string, string>;
}

const zPositive = z.number().finite().positive();
const zVolts = z.number().finite();

/** 'B5', 'D3' — a port letter + bit. The bound core rejects letters it lacks. */
export const cosimPinSchema = z
  .string()
  .regex(/^[A-Z][0-7]$/, "pin must be a port letter + bit 0-7, e.g. 'B5'");

export const pinBindingSchema: z.ZodType<PinBinding> = z
  .object({
    pin: cosimPinSchema,
    netId: z.string().min(1),
    voltsHigh: zVolts.optional(),
    voltsLow: zVolts.optional(),
    routOhms: zPositive.optional(),
    riseS: zPositive.optional(),
  })
  .strict();

export const cosimWindowSpecSchema: z.ZodType<CosimWindowSpec> = z
  .object({
    windowS: zPositive,
    stepS: zPositive,
    bindings: z.array(pinBindingSchema).min(1),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (spec.stepS > spec.windowS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'stepS must not exceed windowS' });
    }
    const seen = new Set<string>();
    for (const binding of spec.bindings) {
      if (seen.has(binding.pin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate binding for pin ${binding.pin}`,
        });
      }
      seen.add(binding.pin);
    }
  });
