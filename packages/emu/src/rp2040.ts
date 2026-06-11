import { GPIOPinState, RP2040 } from 'rp2040js';

import { parseIntelHex } from './intel-hex.js';

import type {
  AdcReadRequest,
  AdcSampler,
  DigitalLevel,
  McuCore,
  McuState,
  McuStepResult,
  PinEvent,
} from './types.js';

/**
 * RP2040 core (Vol II §D.2, second McuCore) on wokwi's rp2040js —
 * a Cortex-M0+ with the RP2040 SIO/IO_BANK0/UART/ADC peripherals.
 *
 * Contract mapping, honestly stated:
 * - Pins are 'GP0'…'GP29' (bare numbers accepted). PinEvents fire for
 *   levels the MCU DRIVES (output High/Low); function-select changes
 *   to input don't emit.
 * - Firmware images are raw Thumb code entered at the flash base with
 *   SP at the top of SRAM — the test-rig convention, like the AVR
 *   core's hand-assembled words. UF2 / bootrom / boot2 flows are out
 *   of scope in this slice. Intel-HEX is accepted and laid down from
 *   its load address relative to flash.
 * - ADC: 12-bit against a 3.3 V reference (the AVR core quantizes to
 *   10 bits against 5 V — each core states its own truth). Conversions
 *   complete IMMEDIATELY rather than after the silicon's ~2 µs sample
 *   time — an honest timing cut; the completion cycle stamp is the
 *   start cycle.
 * - uartWrite feeds UART0's receiver; the FIFO only accepts bytes once
 *   firmware has enabled the UART (UARTEN|RXE), exactly like hardware.
 */

const FLASH_BASE = 0x10000000;
const SRAM_BASE = 0x20000000;
/** rp2040js models the full 264 KiB of striped SRAM. */
const SRAM_SIZE = 264 * 1024;
export const RP2040_CLOCK_HZ = 125_000_000;
const ADC_VREF = 3.3;
const ADC_MAX = 4095;

function pinIndex(pin: string): number {
  const text = pin.startsWith('GP') ? pin.slice(2) : pin;
  const idx = Number(text);
  if (!Number.isInteger(idx) || idx < 0 || idx > 29) {
    throw new Error(`unknown RP2040 pin "${pin}" (expected GP0..GP29)`);
  }
  return idx;
}

export class Rp2040Core implements McuCore {
  readonly clockHz = RP2040_CLOCK_HZ;

  private mcu: RP2040;
  private firmware: Uint8Array | null = null;
  private events: PinEvent[] = [];
  private uartOut: number[] = [];
  private adcReads: AdcReadRequest[] = [];
  private sampler: AdcSampler | null = null;
  /** External input levels survive reset (bench wiring, not state). */
  private inputLevels = new Map<number, DigitalLevel>();

  constructor() {
    this.mcu = this.build();
  }

  /** Fresh machine wired to this core's queues; firmware + bench
   *  wiring re-applied. The rp2040js instance has no full power-on
   *  reset, so reset = rebuild — same trick, stated plainly. */
  private build(): RP2040 {
    const mcu = new RP2040();
    for (const gpio of mcu.gpio) {
      gpio.addListener((state) => {
        if (state !== GPIOPinState.Low && state !== GPIOPinState.High) return;
        this.events.push({
          pin: `GP${String(gpio.index)}`,
          level: state === GPIOPinState.High ? 1 : 0,
          cycle: mcu.core.cycles,
        });
      });
    }
    const uart0 = mcu.uart[0];
    if (uart0) {
      uart0.onByte = (value) => {
        this.uartOut.push(value & 0xff);
      };
    }
    mcu.adc.onADCRead = (channel) => {
      const cycle = mcu.core.cycles;
      const volts = this.sampler ? this.sampler(channel, cycle) : 0;
      const value = Math.min(ADC_MAX, Math.max(0, Math.round((volts / ADC_VREF) * ADC_MAX)));
      this.adcReads.push({ channel, cycle });
      mcu.adc.completeADCRead(value, false);
    };
    if (this.firmware) {
      mcu.flash.set(this.firmware.subarray(0, mcu.flash.length));
      mcu.core.PC = FLASH_BASE;
      mcu.core.SP = SRAM_BASE + SRAM_SIZE;
    }
    for (const [idx, level] of this.inputLevels) {
      mcu.gpio[idx]?.setInputValue(level === 1);
    }
    return mcu;
  }

  loadFirmware(hex: Uint8Array | string): void {
    this.firmware = typeof hex === 'string' ? parseIntelHex(hex) : hex.slice();
    this.reset();
  }

  step(maxCycles: number): McuStepResult {
    if (!this.firmware) throw new Error('no firmware loaded');
    const start = this.mcu.core.cycles;
    this.events = [];
    while (this.mcu.core.cycles - start < maxCycles) {
      this.mcu.step();
    }
    return { cycles: this.mcu.core.cycles - start, events: this.events };
  }

  setPin(pin: string, level: DigitalLevel): void {
    const idx = pinIndex(pin);
    this.inputLevels.set(idx, level);
    this.mcu.gpio[idx]?.setInputValue(level === 1);
  }

  uartWrite(byte: number): void {
    this.mcu.uart[0]?.feedByte(byte & 0xff);
  }

  drainUart(): Uint8Array {
    const out = Uint8Array.from(this.uartOut);
    this.uartOut = [];
    return out;
  }

  setAdcSampler(fn: AdcSampler): void {
    this.sampler = fn;
  }

  drainAdcReads(): AdcReadRequest[] {
    const out = this.adcReads;
    this.adcReads = [];
    return out;
  }

  inspect(): McuState {
    return {
      // PC is a byte address (ARM convention) — the AVR core reports
      // words; each core reports its own architecture's truth.
      pc: this.mcu.core.PC,
      cycles: this.mcu.core.cycles,
      sreg: this.mcu.core.xPSR,
      sp: this.mcu.core.SP,
    };
  }

  reset(): void {
    this.events = [];
    this.uartOut = [];
    this.adcReads = [];
    this.mcu = this.build();
  }
}
