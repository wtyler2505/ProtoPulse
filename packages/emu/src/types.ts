/**
 * The MCU emulation contract (Vol II §D.2).
 *
 * An McuCore runs real firmware cycle-by-cycle and exposes exactly the
 * surfaces the co-sim loop needs: digital pin edges out, external pin
 * drive in, a UART byte stream both ways, an ADC fed by a host-side
 * voltage sampler, and an inspectable machine state. Analog
 * comparators remain out of scope.
 */

/** A digital logic level. Analog values are out of scope for v0.5. */
export type DigitalLevel = 0 | 1;

/**
 * A level change on a GPIO pin driven by the MCU as an output,
 * stamped with the CPU cycle count at the instant of the change.
 */
export interface PinEvent {
  /** Port letter + bit, e.g. 'B5' (Arduino D13), 'D3'. */
  pin: string;
  level: DigitalLevel;
  /** Absolute CPU cycle count (since reset) when the edge happened. */
  cycle: number;
}

/** What one `step` call actually did. */
export interface McuStepResult {
  /**
   * Cycles actually consumed — exact, but may exceed the requested
   * budget by up to (longest-instruction − 1) cycles because an AVR
   * instruction is atomic.
   */
  cycles: number;
  /** Output pin edges observed during this step, in order. */
  events: PinEvent[];
}

/** One completed ADC conversion — the co-sim honesty readout unit. */
export interface AdcReadRequest {
  /**
   * Core-defined mux/sampler channel latched at conversion start.
   * AVR follows ADMUX (0-7 ADC pins, 8 temperature, 14/15 bandgap/GND);
   * ESP32-S3 uses 0-9 for ADC1 and 10-19 for ADC2.
   */
  channel: number;
  /** Absolute CPU cycle count at conversion COMPLETION. */
  cycle: number;
}

/**
 * Host-side analog source. Called at conversion COMPLETION time — the
 * co-sim hard sync point — and returns the channel's voltage in volts.
 */
export type AdcSampler = (channel: number, cycle: number) => number;

/** Snapshot of core machine state for debugging / assertions. */
export interface McuState {
  /** Program counter, in words (avr8js convention). */
  pc: number;
  /** Absolute cycle count since reset. */
  cycles: number;
  /** Status register (I T H S V N Z C). */
  sreg: number;
  /** Stack pointer (data-space byte address). */
  sp: number;
}

/**
 * A microcontroller core. One instance = one MCU on the board.
 */
export interface McuCore {
  /** Core clock frequency in Hz. */
  readonly clockHz: number;

  /**
   * Load a program and reset the core. Accepts raw program bytes
   * (little-endian 16-bit words, as flashed) or Intel-HEX text —
   * the format is detected.
   */
  loadFirmware(hex: Uint8Array | string): void;

  /** Run instructions until at least `maxCycles` cycles have elapsed. */
  step(maxCycles: number): McuStepResult;

  /** Drive an external logic level onto a pin (effective when the pin is an input). */
  setPin(pin: string, level: DigitalLevel): void;

  /** Host → MCU: queue one byte for the MCU's UART receiver. */
  uartWrite(byte: number): void;

  /** MCU → host: all UART bytes transmitted since the last drain. */
  drainUart(): Uint8Array;

  /**
   * Install the analog source the ADC consults when a conversion
   * completes. The returned voltage is quantized by the core's ADC
   * resolution and reference voltage. Without a sampler, every
   * conversion reads 0 V. The sampler survives reset(), like loaded
   * firmware: it is bench wiring, not machine state.
   *
   * Optional in the contract only because not every core has an ADC
   * (and existing co-sim fakes predate it); Atmega328pCore always
   * implements it.
   */
  setAdcSampler?(fn: AdcSampler): void;

  /**
   * All ADC conversions completed since the last drain, in completion
   * order — the honesty readout that lets the co-sim loop verify what
   * the firmware actually sampled. Optional for the same reason as
   * setAdcSampler.
   */
  drainAdcReads?(): AdcReadRequest[];

  /** Snapshot pc / cycles / SREG / SP. */
  inspect(): McuState;

  /** Power-on reset: machine state, peripherals, and queues cleared; firmware kept. */
  reset(): void;
}
