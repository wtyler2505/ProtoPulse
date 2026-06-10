import {
  AVRIOPort,
  AVRTimer,
  AVRUSART,
  CPU,
  PinState,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  usart0Config,
} from 'avr8js';
import { z } from 'zod';

import { parseIntelHex } from './intel-hex.js';

import type { DigitalLevel, McuCore, McuState, McuStepResult, PinEvent } from './types.js';

/**
 * ATmega328P @ 16 MHz (the Arduino Uno brain) on avr8js.
 *
 * Wired peripherals: timer0, GPIO ports B/C/D, USART0. Honest gaps —
 * timer1/timer2, SPI, TWI, EEPROM, watchdog and ADC are NOT wired;
 * ADC in particular is the co-sim slice's job, not this package's.
 * Firmware touching unwired peripherals reads/writes plain RAM bytes,
 * so it won't crash, but those peripherals do nothing.
 */

const CLOCK_HZ = 16_000_000;
const FLASH_BYTES = 0x8000; // 32 KiB flash (datasheet §1)
const SRAM_BYTES = 2048; // internal SRAM, RAMEND = 0x08FF (datasheet §8.3)

const PORT_LETTERS = ['B', 'C', 'D'] as const;
type PortLetter = (typeof PORT_LETTERS)[number];

/** Pin ids are port letter + bit: 'B5', 'D3'. Port A does not exist on the 328P. */
export const pinIdSchema = z
  .string()
  .regex(/^[BCD][0-7]$/, "pin must be a 328P port letter + bit, e.g. 'B5' or 'D3'");

function parsePinId(pin: string): { letter: PortLetter; bit: number } {
  const parsed = pinIdSchema.safeParse(pin);
  if (!parsed.success) {
    throw new Error(`invalid pin "${pin}": expected port letter B/C/D + bit 0-7, e.g. 'B5'`);
  }
  return { letter: pin[0] as PortLetter, bit: Number(pin[1]) };
}

interface CoreParts {
  cpu: CPU;
  ports: Record<PortLetter, AVRIOPort>;
  usart: AVRUSART;
  timer0: AVRTimer;
}

export class Atmega328pCore implements McuCore {
  readonly clockHz = CLOCK_HZ;

  private program = new Uint8Array(0);
  private core: CoreParts;
  private events: PinEvent[] = [];
  private rxQueue: number[] = [];
  private txBuffer: number[] = [];

  constructor() {
    this.core = this.buildCore();
  }

  loadFirmware(hex: Uint8Array | string): void {
    const program = typeof hex === 'string' ? parseIntelHex(hex) : decodeFirmwareBytes(hex);
    if (program.length > FLASH_BYTES) {
      throw new Error(`firmware is ${program.length} bytes; ATmega328P flash is ${FLASH_BYTES}`);
    }
    this.program = program;
    this.reset();
  }

  step(maxCycles: number): McuStepResult {
    if (!Number.isInteger(maxCycles) || maxCycles <= 0) {
      throw new Error(`maxCycles must be a positive integer (got ${maxCycles})`);
    }
    const { cpu } = this.core;
    const start = cpu.cycles;
    const target = start + maxCycles;
    while (cpu.cycles < target) {
      avrInstruction(cpu);
      cpu.tick();
      this.pumpRx();
    }
    const events = this.events;
    this.events = [];
    return { cycles: cpu.cycles - start, events };
  }

  setPin(pin: string, level: DigitalLevel): void {
    const { letter, bit } = parsePinId(pin);
    this.core.ports[letter].setPin(bit, level === 1);
  }

  uartWrite(byte: number): void {
    if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
      throw new Error(`uartWrite expects a byte 0..255 (got ${byte})`);
    }
    this.rxQueue.push(byte);
    this.pumpRx();
  }

  drainUart(): Uint8Array {
    const out = Uint8Array.from(this.txBuffer);
    this.txBuffer = [];
    return out;
  }

  inspect(): McuState {
    const { cpu } = this.core;
    return { pc: cpu.pc, cycles: cpu.cycles, sreg: cpu.SREG, sp: cpu.SP };
  }

  /**
   * Power-on reset semantics, stronger than the RESET pin: the CPU and
   * all peripherals are rebuilt, so SRAM is cleared and the cycle
   * counter returns to 0. The loaded firmware is kept. Pending UART
   * queues and unread pin events are dropped.
   */
  reset(): void {
    this.events = [];
    this.rxQueue = [];
    this.txBuffer = [];
    this.core = this.buildCore();
  }

  /**
   * Escape hatch for co-simulation and tests: the raw avr8js machine.
   * Reaching in is reading the bench oscilloscope, not part of the
   * McuCore contract — don't build product features against it.
   */
  raw(): CoreParts {
    return this.core;
  }

  /** Feed queued host→MCU bytes whenever the receiver can take one. */
  private pumpRx(): void {
    const { usart } = this.core;
    while (this.rxQueue.length > 0 && usart.rxEnable && !usart.rxBusy) {
      const byte = this.rxQueue[0] ?? 0;
      if (usart.writeByte(byte) === false) {
        return;
      }
      this.rxQueue.shift();
    }
  }

  private buildCore(): CoreParts {
    // Unprogrammed flash is left 0x0000 (= NOP), so a runaway PC idles
    // harmlessly instead of executing 0xFFFF garbage.
    const progMem = new Uint16Array(FLASH_BYTES / 2);
    new Uint8Array(progMem.buffer).set(this.program);

    const cpu = new CPU(progMem, SRAM_BYTES);
    const timer0 = new AVRTimer(cpu, timer0Config);
    const ports: Record<PortLetter, AVRIOPort> = {
      B: new AVRIOPort(cpu, portBConfig),
      C: new AVRIOPort(cpu, portCConfig),
      D: new AVRIOPort(cpu, portDConfig),
    };
    const usart = new AVRUSART(cpu, usart0Config, CLOCK_HZ);
    usart.onByteTransmit = (value) => {
      this.txBuffer.push(value & 0xff);
    };

    for (const letter of PORT_LETTERS) {
      const port = ports[letter];
      // Last observed *driven* level per pin; undefined while the pin
      // is an input. A PinEvent is a change between two driven levels,
      // so the instant a pin first becomes an output is not an "edge".
      const driven: (DigitalLevel | undefined)[] = new Array<DigitalLevel | undefined>(8).fill(
        undefined,
      );
      port.addListener(() => {
        for (let bit = 0; bit < 8; bit++) {
          const state = port.pinState(bit);
          if (state === PinState.High || state === PinState.Low) {
            const level: DigitalLevel = state === PinState.High ? 1 : 0;
            const prev = driven[bit];
            if (prev !== undefined && prev !== level) {
              this.events.push({ pin: `${letter}${bit}`, level, cycle: cpu.cycles });
            }
            driven[bit] = level;
          } else {
            driven[bit] = undefined;
          }
        }
      });
    }

    return { cpu, ports, usart, timer0 };
  }
}

/**
 * Detect Intel-HEX text handed over as bytes (a `.hex` file read with
 * readFileSync and no encoding): starts with ':' and is pure printable
 * ASCII. Anything else is treated as a raw program image and copied.
 */
function decodeFirmwareBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 0 && bytes[0] === 0x3a /* ':' */) {
    const ascii = bytes.every((b) => b === 0x0a || b === 0x0d || (b >= 0x20 && b < 0x7f));
    if (ascii) {
      return parseIntelHex(new TextDecoder().decode(bytes));
    }
  }
  return new Uint8Array(bytes);
}
