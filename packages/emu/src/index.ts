/**
 * @protopulse/emu — MCU emulation (Vol II §D.2, honest v0.5 cut).
 *
 * Real firmware on a cycle-counted AVR core (avr8js) behind the
 * McuCore contract: pin edges out, external pin drive in, UART both
 * ways. ATmega328P @ 16 MHz is the first core. Analog (ADC) belongs
 * to the co-sim slice and is intentionally not here.
 */
export {
  assemble,
  BRNE,
  CBI,
  DEC,
  IN,
  IO,
  LDI,
  LDS,
  MEM,
  NOP,
  OUT,
  RJMP,
  SBI,
  STS,
} from './asm.js';
export { Atmega328pCore, pinIdSchema } from './atmega328p.js';
export { parseIntelHex } from './intel-hex.js';
export type { DigitalLevel, McuCore, McuState, McuStepResult, PinEvent } from './types.js';
