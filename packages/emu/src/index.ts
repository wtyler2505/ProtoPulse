/**
 * @protopulse/emu — MCU emulation (Vol II §D.2, honest v0.5 cut).
 *
 * Real firmware on a cycle-counted AVR core (avr8js) behind the
 * McuCore contract: pin edges out, external pin drive in, UART both
 * ways, and an ADC whose voltage source is a host-side sampler
 * consulted at conversion completion (the co-sim hard sync point).
 * Cores: ATmega328P @ 16 MHz (avr8js), RP2040 (rp2040js), and the
 * from-scratch ESP32-S3 v0 (Xtensa LX7 call0 subset).
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
export { Rp2040Core, RP2040_CLOCK_HZ } from './rp2040.js';
export {
  Esp32s3Core,
  type Esp32s3AdcContinuousOverflowEvent,
  type Esp32s3TwaiErrorFlags,
  type Esp32s3TwaiEvent,
  type Esp32s3TwaiFrame,
  esp32s3PinId,
  ESP32S3_IRAM_BASE,
  ESP32S3_DRAM_BASE,
  ESP32S3_GPIO_BASE,
  ESP32S3_UART0_BASE,
} from './esp32s3.js';
export * as xt from './xtensa-asm.js';
export { XtensaCpu, type XtensaBus } from './xtensa.js';
export type {
  AdcReadRequest,
  AdcSampler,
  DigitalLevel,
  McuCore,
  McuState,
  McuStepResult,
  PinEvent,
} from './types.js';
