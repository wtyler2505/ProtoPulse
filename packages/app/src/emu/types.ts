// Pinned @protopulse/emu API (v0.5); swap to direct import after the
// emulation track lands. The emu package is built on a parallel track —
// these local declarations keep the app typechecking (and its tests
// running against fakes) independent of that track's timing. The shapes
// are the contract; the module itself is loaded LAZILY in runner.ts.

/** A digital pin level — the emulator surfaces logic, not volts. */
export type DigitalLevel = 0 | 1;

/** One observed pin transition, stamped with the core cycle it happened on. */
export interface PinEvent {
  pin: string;
  level: DigitalLevel;
  cycle: number;
}

/** Snapshot of the core's architectural state. */
export interface McuInspection {
  pc: number;
  cycles: number;
  sreg: number;
  sp: number;
}

/** PINNED addition (emu ADC track): one firmware-initiated ADC
 *  conversion, stamped with the CPU cycle it started on. */
export interface AdcReadRequest {
  channel: number;
  cycle: number;
}

/**
 * The pinned MCU-core contract: load firmware, step in bounded cycle
 * batches, observe pin events and UART bytes, poke pins and UART back in.
 *
 * The ADC pair is OPTIONAL here: it is the pinned addition landing on
 * the emu ADC track. Consumers probe for it at runtime (closed-loop
 * co-sim refuses ADC bindings when the loaded core lacks it) — older
 * cores and test fakes stay valid without it.
 */
export interface McuCore {
  readonly clockHz: number;
  loadFirmware(hex: Uint8Array | string): void;
  step(maxCycles: number): { cycles: number; events: PinEvent[] };
  setPin(pin: string, level: DigitalLevel): void;
  uartWrite(byte: number): void;
  drainUart(): Uint8Array;
  inspect(): McuInspection;
  reset(): void;
  /** PINNED (emu ADC track): install the host conversion callback —
   *  volts back per (channel, cycle) request. */
  setAdcSampler?(fn: (channel: number, cycle: number) => number): void;
  /** PINNED (emu ADC track): conversions made since the last drain. */
  drainAdcReads?(): AdcReadRequest[];
}

/** Shape of the lazily imported '@protopulse/emu' module. Partial in
 *  practice until the emulation track lands — runner.ts checks at runtime. */
export interface EmuModule {
  Atmega328pCore: new () => McuCore;
  Rp2040Core: new () => McuCore;
}

/** Selectable MCU cores, keyed by the emu module's constructor names.
 *  `adcChannels` are the single-ended mux channels the co-sim panel
 *  offers for net→ADC bindings: the 328P has ADC0–7, the RP2040 has
 *  ADC0–3 (GP26–29; channel 4 is the internal temperature sensor). */
export const CORE_KINDS = {
  atmega328p: {
    ctor: 'Atmega328pCore',
    label: 'ATmega328P (AVR, 16 MHz)',
    adcChannels: [0, 1, 2, 3, 4, 5, 6, 7] as readonly number[],
  },
  rp2040: {
    ctor: 'Rp2040Core',
    label: 'RP2040 (Cortex-M0+, 125 MHz)',
    adcChannels: [0, 1, 2, 3] as readonly number[],
  },
} as const;

export type CoreKind = keyof typeof CORE_KINDS;
