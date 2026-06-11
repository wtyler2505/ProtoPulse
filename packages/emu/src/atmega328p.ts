import {
  ADCMuxInputType,
  AVRADC,
  AVRIOPort,
  AVRSPI,
  AVRTWI,
  AVRTimer,
  AVRUSART,
  CPU,
  PinState,
  adcConfig,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  spiConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
  usart0Config,
} from 'avr8js';
import { z } from 'zod';

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
 * ATmega328P @ 16 MHz (the Arduino Uno brain) on avr8js.
 *
 * Wired peripherals: timers 0/1/2 (PWM and CTC drive their OC pins
 * through the GPIO ports, so waveforms land in the pin-event stream),
 * GPIO ports B/C/D, USART0, SPI (master mode against a host byte
 * handler — see setSpiHandler), TWI (master mode against a host bus
 * handler — see setTwiHandler), and the ADC (avr8js AVRADC with the
 * voltage source replaced by a host sampler — see the ADC block in
 * buildCore). Honest gaps: EEPROM and the watchdog are NOT wired;
 * SPI/TWI slave mode is not modeled (the host is always the far end).
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
  timer1: AVRTimer;
  timer2: AVRTimer;
  spi: AVRSPI;
  twi: AVRTWI;
  adc: AVRADC;
}

/** Host side of the TWI bus — the slave(s) the master firmware talks
 *  to. Synchronous and honest: ack booleans and read bytes come back
 *  immediately (bus stretching is not modeled). */
export interface TwiHostHandler {
  /** Address phase: return true to ACK (slave present). */
  connect(addr: number, write: boolean): boolean;
  /** Master wrote a byte: return true to ACK. */
  write(value: number): boolean;
  /** Master reads a byte; `ack` is the master's planned response. */
  read(ack: boolean): number;
  /** Bus events, for logging/asserting. */
  start?(repeated: boolean): void;
  stop?(): void;
}

export interface Atmega328pOptions {
  /**
   * AVcc supply in volts (default 5). AREF is assumed strapped to
   * AVcc, so the REFS=00 (AREF) and REFS=01 (AVcc) ADMUX reference
   * selections both read this value; the internal 1.1 V bandgap
   * selection is independent of it.
   */
  aVccVolts?: number;
}

export class Atmega328pCore implements McuCore {
  readonly clockHz = CLOCK_HZ;
  readonly aVccVolts: number;

  private program = new Uint8Array(0);
  private core: CoreParts;
  private events: PinEvent[] = [];
  private rxQueue: number[] = [];
  private txBuffer: number[] = [];
  private adcReads: AdcReadRequest[] = [];
  private adcSampler: AdcSampler | undefined;
  private spiHandler: ((mosiByte: number) => number) | undefined;
  private twiHandler: TwiHostHandler | undefined;

  constructor(options: Atmega328pOptions = {}) {
    const aVcc = options.aVccVolts ?? 5;
    if (!Number.isFinite(aVcc) || aVcc <= 0) {
      throw new Error(`aVccVolts must be a positive number of volts (got ${aVcc})`);
    }
    this.aVccVolts = aVcc;
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

  /**
   * Install the analog source consulted at ADC conversion COMPLETION
   * time (the co-sim hard sync point). See the ADC block in buildCore
   * for the exact quantization. Survives reset(): the sampler is bench
   * wiring, not machine state.
   */
  setAdcSampler(fn: AdcSampler): void {
    this.adcSampler = fn;
  }

  /**
   * Install the SPI far end: called once per master-mode byte with the
   * MOSI value; returns the MISO byte. The transfer completes after the
   * configured SPI clock cycles (avr8js models the timing; we supply
   * the data). Survives reset(), like the ADC sampler — bench wiring.
   */
  setSpiHandler(fn: (mosiByte: number) => number): void {
    this.spiHandler = fn;
  }

  /** Install the TWI far end (see TwiHostHandler). Survives reset(). */
  setTwiHandler(handler: TwiHostHandler): void {
    this.twiHandler = handler;
  }

  /** ADC conversions completed since the last drain (honesty readout). */
  drainAdcReads(): AdcReadRequest[] {
    const out = this.adcReads;
    this.adcReads = [];
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
   * queues, unread pin events and undrained ADC reads are dropped;
   * the ADC sampler (host wiring) is kept.
   */
  reset(): void {
    this.events = [];
    this.rxQueue = [];
    this.txBuffer = [];
    this.adcReads = [];
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
    const timer1 = new AVRTimer(cpu, timer1Config);
    const timer2 = new AVRTimer(cpu, timer2Config);
    const ports: Record<PortLetter, AVRIOPort> = {
      B: new AVRIOPort(cpu, portBConfig),
      C: new AVRIOPort(cpu, portCConfig),
      D: new AVRIOPort(cpu, portDConfig),
    };
    const usart = new AVRUSART(cpu, usart0Config, CLOCK_HZ);
    usart.onByteTransmit = (value) => {
      this.txBuffer.push(value & 0xff);
    };

    // SPI master: the host handler IS the slave. The reply is supplied
    // synchronously; avr8js still charges the configured clock cycles
    // before SPIF sets, so firmware timing stays honest.
    const spi = new AVRSPI(cpu, spiConfig, CLOCK_HZ);
    spi.onByte = (value) => {
      const reply = this.spiHandler ? this.spiHandler(value & 0xff) & 0xff : 0xff;
      spi.completeTransfer(reply);
    };

    // TWI master: bus events route to the host handler; an absent
    // handler NACKs every address — an empty bus, not a hang.
    const twi = new AVRTWI(cpu, twiConfig, CLOCK_HZ);
    twi.eventHandler = {
      start: (repeated: boolean) => {
        this.twiHandler?.start?.(repeated);
        twi.completeStart();
      },
      stop: () => {
        this.twiHandler?.stop?.();
        twi.completeStop();
      },
      connectToSlave: (addr: number, write: boolean) => {
        twi.completeConnect(this.twiHandler?.connect(addr, write) ?? false);
      },
      writeByte: (value: number) => {
        twi.completeWrite(this.twiHandler?.write(value & 0xff) ?? false);
      },
      readByte: (ack: boolean) => {
        twi.completeRead(this.twiHandler ? this.twiHandler.read(ack) & 0xff : 0xff);
      },
    };

    /**
     * ADC: avr8js AVRADC handles the register plumbing at the 328P
     * addresses (ADMUX 0x7C, ADCSRA 0x7A, ADCSRB 0x7B, ADCL 0x78,
     * ADCH 0x79). Writing ADSC to ADCSRA (with ADEN) starts a
     * conversion; it completes after 25 ADC clocks for the first
     * conversion after power-on and 13 thereafter (datasheet §28.4),
     * where one ADC clock = the ADPS prescaler (÷2..÷128) in CPU
     * cycles. On completion ADCL/ADCH hold the 10-bit result (ADLAR
     * left-adjustment honored), ADSC is cleared and ADIF is set (the
     * ADC interrupt fires if ADIE + I are set).
     *
     * We replace avr8js's conversion-START voltage lookup with a
     * conversion-COMPLETION call to the host sampler — the co-sim
     * hard sync point — quantized as clamp(round(volts/vref*1023),
     * 0, 1023), so 0 V → 0 and vref → 1023 exactly.
     *
     * Honest gaps: no ADC noise-reduction sleep mode, no auto-trigger
     * / free-running mode (ADCSRB ADTS bits are inert; every
     * conversion is firmware-started via ADSC), no DIDR0 effect, no
     * differential channels (the 328P mux has none). Writing ADIF=1
     * does not clear the flag (avr8js plain-writes ADCSRA). Setting
     * ADSC with ADEN clear completes with result 0 (avr8js special
     * case) without consulting the sampler or the honesty readout.
     */
    const adc = new AVRADC(cpu, adcConfig);
    adc.avcc = this.aVccVolts;
    adc.aref = this.aVccVolts; // AREF strapped to AVcc (see Atmega328pOptions)
    adc.onADCRead = (input) => {
      // Latched at conversion START, like the hardware: mux channel,
      // reference voltage and conversion length. The analog VALUE is
      // sampled at completion, below.
      const channel =
        input.type === ADCMuxInputType.SingleEnded
          ? input.channel
          : (cpu.data[adcConfig.ADMUX] ?? 0) & adcConfig.muxInputMask;
      const fixedVolts =
        input.type === ADCMuxInputType.Constant
          ? input.voltage
          : input.type === ADCMuxInputType.Temperature
            ? 0.378125 // avr8js's 25 °C reading
            : undefined;
      const vref = adc.referenceVoltage;
      cpu.addClockEvent(() => {
        const cycle = cpu.cycles;
        const volts = fixedVolts ?? this.adcSampler?.(channel, cycle) ?? 0;
        if (!Number.isFinite(volts)) {
          throw new Error(
            `ADC sampler returned non-finite volts (${volts}) for channel ${channel}`,
          );
        }
        const result = Math.min(1023, Math.max(0, Math.round((volts / vref) * 1023)));
        adc.completeADCRead(result); // writes ADCL/ADCH, clears ADSC, sets ADIF
        this.adcReads.push({ channel, cycle });
      }, adc.sampleCycles);
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

    return { cpu, ports, usart, timer0, timer1, timer2, spi, twi, adc };
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
