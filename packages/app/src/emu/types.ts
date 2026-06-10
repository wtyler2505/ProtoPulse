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

/**
 * The pinned MCU-core contract: load firmware, step in bounded cycle
 * batches, observe pin events and UART bytes, poke pins and UART back in.
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
}

/** Shape of the lazily imported '@protopulse/emu' module. Partial in
 *  practice until the emulation track lands — runner.ts checks at runtime. */
export interface EmuModule {
  Atmega328pCore: new () => McuCore;
}
