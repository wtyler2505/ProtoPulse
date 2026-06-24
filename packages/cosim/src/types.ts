import { z } from 'zod';

import type { I2cSlave, McuCore, PinEvent } from '@protopulse/emu';
import type { Uuid } from '@protopulse/graph';
import type { SimulateResult } from '@protopulse/sim';

/**
 * Co-sim bus types (Vol II §D.3).
 *
 * First slice: one-directional MCU→SPICE. Firmware runs first; its pin
 * edges are replayed into the analog window as PWL voltage sources
 * behind a series Rout — the behavioral GPIO output boundary.
 *
 * Second slice (FEEDBACK): the closed loop. The window is cut into
 * conservative quanta; per quantum the previous solve's voltages feed
 * the MCU's digital inputs (Schmitt comparator) and its ADC (sampler),
 * the core steps one quantum, and the analog side re-solves with the
 * full PWL history. See quantum.ts for the loop and its compromises.
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

// ── Closed loop (FEEDBACK direction) ────────────────────────────────

/** Default conservative quantum, seconds (Vol II §D.3 lock-step grain). */
export const DEFAULT_QUANTUM_S = 50e-6;
/** Comparator low threshold for digital inputs, volts (0.3 × 5V logic). */
export const DEFAULT_VIL_V = 0.3 * 5;
/** Comparator high threshold for digital inputs, volts (0.6 × 5V logic). */
export const DEFAULT_VIH_V = 0.6 * 5;
/** Minimum comparator hysteresis band, volts. */
export const COMPARATOR_HYST_V = 0.1;

/**
 * PINNED @protopulse/emu addition (the ADC track): one firmware-initiated
 * ADC conversion, stamped with the CPU cycle it started on. Mirrored
 * locally so this package never imports the in-flight emu surface.
 */
export interface AdcReadRequest {
  channel: number;
  cycle: number;
}

/** The host-side conversion callback the core calls mid-step: volts in,
 *  per the pinned `setAdcSampler` contract. */
export type AdcSampler = (channel: number, cycle: number) => number;

/**
 * PINNED extension of the McuCore contract (landing on the emu track):
 * a core that can route ADC conversions to a host sampler. Probed at
 * runtime via {@link hasAdcSupport} — never assumed.
 */
export interface AdcCapableCore extends McuCore {
  setAdcSampler(fn: AdcSampler): void;
  drainAdcReads(): AdcReadRequest[];
}

/** Runtime probe for the pinned ADC surface on a core. */
export function hasAdcSupport(core: McuCore): core is AdcCapableCore {
  const probe = core as Partial<AdcCapableCore>;
  return (
    typeof probe.setAdcSampler === 'function' && typeof probe.drainAdcReads === 'function'
  );
}

/**
 * PINNED extension: a core that can host I2C slave devices on a controller
 * port (the ESP32-S3 emu surface). Probed via {@link hasI2cSupport}, never assumed.
 */
export interface I2cCapableCore extends McuCore {
  setI2cSlave(port: 0 | 1, fn: I2cSlave | null): void;
}

/** Runtime probe for the I2C slave-device surface on a core. */
export function hasI2cSupport(core: McuCore): core is I2cCapableCore {
  return typeof (core as Partial<I2cCapableCore>).setI2cSlave === 'function';
}

/** One analog net fed back onto one MCU *digital input* pin through the
 *  Schmitt comparator (VIL/VIH + hysteresis, state retained per pin). */
export interface InputBinding {
  /** The design net whose voltage is comparator-sampled. */
  netId: Uuid;
  /** Digital input pin to drive, e.g. 'D2' (port letter + bit). */
  pin: string;
}

/** One analog net fed back into one MCU ADC channel via the sampler. */
export interface AdcBinding {
  /** The design net whose voltage the ADC converts. */
  netId: Uuid;
  /** ADC mux channel (0–15). */
  channel: number;
}

/** One modeled I2C slave device installed on a controller port for the run. */
export interface I2cDeviceBinding {
  /** I2C controller port (0 = I2C0, 1 = I2C1). */
  port: 0 | 1;
  /** The device model — answers master register reads. */
  slave: I2cSlave;
}

/** A closed-loop co-sim window: outputs out, comparator + ADC back in,
 *  lock-stepped on a conservative quantum (default 50 µs). */
export interface ClosedLoopSpec {
  /** Window length, seconds. */
  windowS: number;
  /** Suggested transient output step, seconds. */
  stepS: number;
  /** Conservative quantum, seconds (default {@link DEFAULT_QUANTUM_S}). */
  quantumS?: number;
  /** OUTPUT pin → net bindings; one PWL source per binding. */
  bindings: PinBinding[];
  /** Net → digital input pin feedback bindings (comparator). */
  inputs?: InputBinding[];
  /** Net → ADC channel feedback bindings (sampler). */
  adc?: AdcBinding[];
  /** I2C slave devices installed on the core for the run (bus-device models). */
  i2cDevices?: I2cDeviceBinding[];
}

/** Everything a closed-loop run produced, plus its honesty counters. */
export interface ClosedLoopResult extends CosimResult {
  /** How many conservative quanta the window was cut into. */
  quanta: number;
  /** Every ADC conversion the firmware made, with the volts it was fed. */
  adcReads: (AdcReadRequest & { volts: number })[];
  /** Comparator transitions driven onto digital input pins (cycle = the
   *  MCU cycle count at the quantum boundary where the edge applied). */
  inputEdges: PinEvent[];
  /**
   * Full re-solves performed — the batch engine cannot pause/resume, so
   * every quantum re-runs the transient FROM ZERO over a longer span.
   * O(n²)-ish in quanta; this counter keeps that cost visible.
   */
  rerunSolves: number;
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

function refineWindowAndBindings(
  spec: { windowS: number; stepS: number; bindings: PinBinding[] },
  ctx: z.RefinementCtx,
): void {
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
}

export const cosimWindowSpecSchema: z.ZodType<CosimWindowSpec> = z
  .object({
    windowS: zPositive,
    stepS: zPositive,
    bindings: z.array(pinBindingSchema).min(1),
  })
  .strict()
  .superRefine(refineWindowAndBindings);

export const inputBindingSchema: z.ZodType<InputBinding> = z
  .object({
    netId: z.string().min(1),
    pin: cosimPinSchema,
  })
  .strict();

export const adcBindingSchema: z.ZodType<AdcBinding> = z
  .object({
    netId: z.string().min(1),
    channel: z.number().int().min(0).max(15),
  })
  .strict();

export const i2cDeviceBindingSchema: z.ZodType<I2cDeviceBinding> = z
  .object({
    port: z.union([z.literal(0), z.literal(1)]),
    slave: z.custom<I2cSlave>((v) => typeof v === 'function', {
      message: 'i2c slave must be a function',
    }),
  })
  .strict();

export const closedLoopSpecSchema: z.ZodType<ClosedLoopSpec> = z
  .object({
    windowS: zPositive,
    stepS: zPositive,
    quantumS: zPositive.optional(),
    bindings: z.array(pinBindingSchema).min(1),
    inputs: z.array(inputBindingSchema).optional(),
    adc: z.array(adcBindingSchema).optional(),
    i2cDevices: z.array(i2cDeviceBindingSchema).optional(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    refineWindowAndBindings(spec, ctx);
    const quantumS = spec.quantumS ?? DEFAULT_QUANTUM_S;
    if (quantumS < spec.stepS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'quantumS must be at least stepS — a quantum is solved at stepS resolution',
      });
    }
    const inputPins = new Set<string>();
    for (const input of spec.inputs ?? []) {
      if (inputPins.has(input.pin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate input binding for pin ${input.pin}`,
        });
      }
      inputPins.add(input.pin);
      if (spec.bindings.some((b) => b.pin === input.pin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `pin ${input.pin} cannot be both an output binding and a digital input`,
        });
      }
    }
    const channels = new Set<number>();
    for (const adc of spec.adc ?? []) {
      if (channels.has(adc.channel)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate ADC binding for channel ${String(adc.channel)}`,
        });
      }
      channels.add(adc.channel);
    }
  });
