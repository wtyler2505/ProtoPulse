/**
 * @protopulse/emu — MCU emulation (Vol II §D.2, honest v0.5 cut).
 *
 * Real firmware on a cycle-counted AVR core (avr8js) behind the
 * McuCore contract: pin edges out, external pin drive in, UART both
 * ways, and an ADC whose voltage source is a host-side sampler
 * consulted at conversion completion (the co-sim hard sync point).
 * ATmega328P @ 16 MHz is the first core.
 */
export {
  ANDI,
  assemble,
  BRLO,
  BRNE,
  BRSH,
  CBI,
  CPI,
  DEC,
  IN,
  IO,
  LDI,
  LDS,
  MEM,
  NOP,
  ORI,
  OUT,
  RJMP,
  SBI,
  SBRC,
  SBRS,
  STS,
} from './asm.js';
export { Atmega328pCore, pinIdSchema } from './atmega328p.js';
export type { Atmega328pOptions } from './atmega328p.js';
export { parseIntelHex } from './intel-hex.js';
export type {
  AdcReadRequest,
  AdcSampler,
  DigitalLevel,
  McuCore,
  McuState,
  McuStepResult,
  PinEvent,
} from './types.js';
