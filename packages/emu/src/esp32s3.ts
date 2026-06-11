import { XtensaCpu } from './xtensa.js';

import type { XtensaBus } from './xtensa.js';
import type { AdcReadRequest, AdcSampler, DigitalLevel, McuCore, McuState, McuStepResult, PinEvent } from './types.js';

/**
 * ESP32-S3 v0 — a from-scratch Xtensa LX7 core, the first slice of the
 * "no off-the-shelf JS emulator" epic. Every address and encoding is
 * verified against Espressif's own esp-idf v5.2 headers and the ISA
 * overview (inbox/2026-06-11-esp32s3-emulator-core-verification.md).
 *
 * What it runs: raw hand-assembled machine code (the xtensa-asm.ts
 * rig) loaded at the IRAM base, or an esptool-built ESP-IDF app image
 * (magic 0xE9) whose segments all target the modeled SRAM window —
 * header, per-segment loading, and the XOR checksum are validated
 * against esp_app_format.h / esptool (slice 5).
 *
 * Wired peripherals: the GPIO matrix output/input registers
 * (OUT/W1TS/W1TC + the OUT1 bank for GPIO32-48, ENABLE likewise, IN +
 * IN1 — pins surface as 'IO0'..'IO48' cycle-stamped events exactly
 * like the AVR and RP2040 cores) and UART0's FIFO + STATUS registers
 * (tx bytes land in drainUart; uartWrite feeds RXFIFO_CNT and FIFO
 * reads).
 *
 * Honest cuts, stated plainly: SINGLE core (the S3 has two);
 * 1 instruction = 1 cycle at 240 MHz (no memory-wait, cache, or
 * spill/fill timing); one 480 KB SRAM window mapped at both its
 * instruction-bus and data-bus addresses (no SRAM0/cache regions).
 * The instruction set now spans the 24-bit core forms, the 16-bit
 * code-density forms (slice 2), the windowed ABI (slice 3 —
 * CALL4/8/12, ENTRY, RETW with magic spill/fill), and exceptions +
 * level-1 interrupts with the CCOUNT/CCOMPARE core timer (slice 4 —
 * RSR/WSR/RSIL/RFE, timer0 on INT6, vectors at VECBASE+0x340), plus
 * MOVSP with the Alloca handler's net effect and the ESP-IDF app-image
 * loader (slice 5), plus peripheral interrupt lines through the
 * interrupt matrix (slice 6 — GPIO edge/level pin interrupts via
 * GPIO_PINn/STATUS and UART0's RXFIFO_FULL/TX_DONE via INT_RAW/ST/
 * ENA/CLR, each source's 5-bit map register selecting its CPU line),
 * plus SAR ADC1's oneshot path (slice 7 — the SENS_SAR_MEAS1_CTRL2
 * register dance adc_oneshot_ll/analogRead performs: one-hot channel
 * select, start-bit edge, done poll, 12-bit data; conversions
 * complete instantly and attenuation is not modeled — full scale is
 * 3.3 V; channels are ADC1's, i.e. channel n reads GPIO n+1), plus
 * TIMG0's timer 0 (slice 8 — the 54-bit general-purpose timer over
 * the 80 MHz APB clock with its 16-bit prescaler, UPDATE-latched
 * LO/HI reads, LOAD, and the alarm that hardware auto-disables on
 * fire, exactly the behavior gptimer's ISR re-arms around).
 * Interrupt-driven, analog, and gptimer-style firmware patterns run
 * end-to-end — but there is still no flash cache (flash-mapped image
 * segments refuse), no ADC2/DMA mode, no TIMG0 T1/TIMG1/watchdogs,
 * and no XTAL clock source for the timer (APB only), so real IDF
 * firmware does NOT run yet. Loading Intel-HEX refuses with a
 * message.
 */

const CLOCK_HZ = 240_000_000;

// Memory map (esp-idf v5.2 soc.h / reg_base.h):
const IRAM_BASE = 0x40378000; // D/IRAM — same SRAM as DRAM_BASE, other bus
const DRAM_BASE = 0x3fc88000;
const SRAM_BYTES = 0x78000; // 480 KiB shared window
const GPIO_BASE = 0x60004000;
const UART0_BASE = 0x60000000;

// GPIO matrix register offsets (gpio_reg.h):
const GPIO_OUT = 0x04;
const GPIO_OUT_W1TS = 0x08;
const GPIO_OUT_W1TC = 0x0c;
const GPIO_OUT1 = 0x10;
const GPIO_OUT1_W1TS = 0x14;
const GPIO_OUT1_W1TC = 0x18;
const GPIO_ENABLE = 0x20;
const GPIO_ENABLE_W1TS = 0x24;
const GPIO_ENABLE_W1TC = 0x28;
const GPIO_ENABLE1 = 0x2c;
const GPIO_ENABLE1_W1TS = 0x30;
const GPIO_ENABLE1_W1TC = 0x34;
const GPIO_IN = 0x3c;
const GPIO_IN1 = 0x40;
const GPIO_STATUS = 0x44; // interrupt status, GPIO0-31
const GPIO_STATUS_W1TS = 0x48;
const GPIO_STATUS_W1TC = 0x4c;
const GPIO_STATUS1 = 0x50; // GPIO32-48
const GPIO_STATUS1_W1TS = 0x54;
const GPIO_STATUS1_W1TC = 0x58;
const GPIO_PIN0 = 0x74; // GPIO_PINn at +4·n: INT_TYPE [9:7], INT_ENA [17:13]

// GPIO_PINn INT_TYPE values (hal/gpio_types.h, written verbatim by
// gpio_ll_set_intr_type): 0 off, 1 posedge, 2 negedge, 3 anyedge,
// 4 low level, 5 high level. INT_ENA bit 13 = GPIO_LL_INTR_ENA — on
// the S3 both CPUs share that one enable bit.
const GPIO_INT_ENA_BIT = 1 << 13;

// UART register offsets (uart_reg.h):
const UART_FIFO = 0x00; // RXFIFO_RD_BYTE [7:0]
const UART_INT_RAW = 0x04;
const UART_INT_ST = 0x08; // raw & ena
const UART_INT_ENA = 0x0c;
const UART_INT_CLR = 0x10;
const UART_STATUS = 0x1c; // RXFIFO_CNT [9:0], TXFIFO_CNT [25:16]
const UART_CONF1 = 0x24; // RXFIFO_FULL_THRHD [9:0], resets to 96
const UART_RXFIFO_FULL_INT = 1 << 0;
const UART_TX_DONE_INT = 1 << 14;

// The interrupt matrix (reg_base.h DR_REG_INTERRUPT_BASE +
// interrupt_core0_reg.h): each peripheral source has a 5-bit map
// register selecting which CPU interrupt line it drives. Only the
// two modeled sources' maps are wired; both reset to 16 — a line the
// CPU never dispatches, so unmapped sources stay silent (matching
// the headers' reset value).
const INTMTX_BASE = 0x600c2000;
const INTMTX_GPIO_MAP = 0x040; // INTERRUPT_CORE0_GPIO_INTERRUPT_PRO_MAP_REG
const INTMTX_UART_MAP = 0x06c; // INTERRUPT_CORE0_UART_INTR_MAP_REG
const INTMTX_TG_T0_MAP = 0x0c8; // INTERRUPT_CORE0_TG_T0_INT_MAP_REG (TIMG0 T0)
const INTMTX_DEFAULT_MAP = 16;

// Timer group 0, timer 0 (timer_group_reg.h; flow per hal timer_ll.h
// and the gptimer driver): the 54-bit general-purpose timer counting
// APB ticks (80 MHz — soc.h APB_CLK_FREQ) through a 16-bit prescaler
// (field value 0 means 65536; the HAL only programs 2..65536). The
// alarm-enable bit is cleared BY HARDWARE when the alarm fires —
// gptimer's ISR re-arms it for periodic use.
const TIMG0_BASE = 0x6001f000;
const TIMG_T0CONFIG = 0x00; // EN 31, INCREASE 30, AUTORELOAD 29, DIVIDER [28:13], ALARM_EN 10
const TIMG_T0LO = 0x04;
const TIMG_T0HI = 0x08;
const TIMG_T0UPDATE = 0x0c;
const TIMG_T0ALARMLO = 0x10;
const TIMG_T0ALARMHI = 0x14;
const TIMG_T0LOADLO = 0x18;
const TIMG_T0LOADHI = 0x1c;
const TIMG_T0LOAD = 0x20;
const TIMG_INT_ENA = 0x70; // T0 is bit 0 in all four
const TIMG_INT_RAW = 0x74;
const TIMG_INT_ST = 0x78;
const TIMG_INT_CLR = 0x7c;
const T0_EN = 1 << 31;
const T0_INCREASE = 1 << 30;
const T0_AUTORELOAD = 1 << 29;
const T0_ALARM_EN = 1 << 10;
const T0_ARMED = T0_EN | T0_ALARM_EN;
/** CPU cycles per APB tick: 240 MHz over 80 MHz. */
const CYCLES_PER_APB = 3;
const T0_MASK = 2 ** 54; // the counter is 54 bits wide

// SAR ADC1 oneshot path (sens_reg.h; flow per hal/esp32s3/adc_ll.h —
// the same register dance adc_oneshot_ll_* and analogRead perform):
// SENS_SAR_MEAS1_CTRL2 holds MEAS1_DATA_SAR [15:0], MEAS1_DONE_SAR
// bit 16, MEAS1_START_SAR bit 17 (a 0→1 edge starts a conversion),
// MEAS1_START_FORCE bit 18, SAR1_EN_PAD [30:19] (one-hot channel
// select, written as 1<<channel), SAR1_EN_PAD_FORCE bit 31.
const SENS_BASE = 0x60008800;
const SENS_SAR_MEAS1_CTRL2 = 0x0c;
const MEAS1_DONE_SAR = 1 << 16;
const MEAS1_START_SAR = 1 << 17;
// 12-bit result. Attenuation is not modeled: full scale is the 3.3 V
// supply, quantized like the RP2040 core does.
const ADC_VREF = 3.3;
const ADC_MAX = 4095;

// ESP-IDF app-image format (esp_app_format.h; checksum from esptool):
const ESP_IMAGE_MAGIC = 0xe9;
const ESP_IMAGE_HEADER_BYTES = 24; // esp_image_header_t
const ESP_IMAGE_MAX_SEGMENTS = 16;
const ESP_CHECKSUM_SEED = 0xef; // esptool's ESP_CHECKSUM_MAGIC
const ESP32S3_CHIP_ID = 0x0009; // ESP_CHIP_ID_ESP32S3
const ESP_CHIP_NAMES: Record<number, string> = {
  0x0000: 'ESP32',
  0x0002: 'ESP32-S2',
  0x0005: 'ESP32-C3',
  0x0009: 'ESP32-S3',
  0x000c: 'ESP32-C2',
  0x000d: 'ESP32-C6',
  0x0010: 'ESP32-H2',
  0x0012: 'ESP32-P4',
};

/** One loadable chunk of firmware: raw images get a single segment. */
interface LoadedSegment {
  addr: number;
  data: Uint8Array;
}

/** GPIO0-48; bank 0 covers 0-31, bank 1 covers 32-48. */
const PIN_COUNT = 49;

export const esp32s3PinId = (gpio: number): string => `IO${String(gpio)}`;

export class Esp32s3Core implements McuCore {
  readonly clockHz = CLOCK_HZ;

  private segments: LoadedSegment[] = [];
  private entry = IRAM_BASE;
  private sram = new Uint8Array(SRAM_BYTES);
  private cpu: XtensaCpu;

  // GPIO matrix state (two 32-bit banks each).
  private out = [0, 0];
  private enable = [0, 0];
  private inLevels = [0, 0];
  private gpioStatus = [0, 0]; // latched interrupt status per bank
  private pinCfg = new Int32Array(PIN_COUNT); // GPIO_PINn registers

  // UART0 interrupt state + the interrupt matrix maps.
  private uartIntEna = 0;
  private uartTxDone = false; // latched TX_DONE raw bit
  private uartRxThrhd = 96; // CONF1 RXFIFO_FULL_THRHD reset value
  private gpioIntMap = INTMTX_DEFAULT_MAP;
  private uartIntMap = INTMTX_DEFAULT_MAP;

  // TIMG0 T0 state. The counter is virtual: t0Base is its value at
  // cpu cycle t0Sync, and the live value derives from elapsed cycles
  // — no per-cycle bookkeeping.
  private t0Config = 0;
  private t0Base = 0;
  private t0Sync = 0;
  private t0LatchLo = 0; // captured by a T0UPDATE write
  private t0LatchHi = 0;
  private t0AlarmLo = 0;
  private t0AlarmHi = 0;
  private t0LoadLo = 0;
  private t0LoadHi = 0;
  private timgIntEna = 0;
  private timgIntRaw = 0;
  private tgT0IntMap = INTMTX_DEFAULT_MAP;

  // SAR ADC1 oneshot state.
  private meas1Ctrl2 = 0; // the control bits firmware wrote
  private adcData = 0; // latched 12-bit result
  private adcDone = false;
  private adcReads: AdcReadRequest[] = [];
  /** Bench wiring — survives reset(), like loaded firmware. */
  private sampler: AdcSampler | null = null;
  /** Last driven level per pin; undefined while not output-enabled. */
  private driven: (DigitalLevel | undefined)[] = new Array<DigitalLevel | undefined>(PIN_COUNT).fill(undefined);
  private events: PinEvent[] = [];

  private rxQueue: number[] = [];
  private txBuffer: number[] = [];

  constructor() {
    this.cpu = new XtensaCpu(this.bus());
  }

  loadFirmware(image: Uint8Array | string): void {
    if (typeof image === 'string' || (image.length > 0 && image[0] === 0x3a)) {
      throw new Error(
        'the ESP32-S3 core loads RAW machine-code images at the IRAM base (use assembleXtensa) or esptool-built ESP-IDF app images (.bin, magic 0xE9) — Intel-HEX is not supported',
      );
    }
    if (image.length > 0 && image[0] === ESP_IMAGE_MAGIC) {
      const parsed = this.parseEspImage(image);
      this.segments = parsed.segments;
      this.entry = parsed.entry;
    } else {
      if (image.length > SRAM_BYTES) {
        throw new Error(`image is ${String(image.length)} bytes; the modeled SRAM window is ${String(SRAM_BYTES)}`);
      }
      this.segments = [{ addr: IRAM_BASE, data: new Uint8Array(image) }];
      this.entry = IRAM_BASE;
    }
    this.reset();
  }

  /**
   * Parse an esptool-built app image: 24-byte esp_image_header_t
   * (magic, segment_count, entry_addr @4, chip_id u16le @12), then
   * segment_count × (load_addr u32le, data_len u32le, data), then a
   * checksum byte — XOR of all segment data seeded 0xEF — sitting as
   * the LAST byte of the 16-byte-aligned image body.
   */
  private parseEspImage(image: Uint8Array): { segments: LoadedSegment[]; entry: number } {
    const u32 = (off: number): number =>
      (((image[off] ?? 0) | ((image[off + 1] ?? 0) << 8) | ((image[off + 2] ?? 0) << 16) | ((image[off + 3] ?? 0) << 24)) >>> 0);
    if (image.length < ESP_IMAGE_HEADER_BYTES) {
      throw new Error(`ESP image truncated: ${String(image.length)} bytes is shorter than the 24-byte header`);
    }
    const chipId = (image[12] ?? 0) | ((image[13] ?? 0) << 8);
    if (chipId !== ESP32S3_CHIP_ID) {
      const name = ESP_CHIP_NAMES[chipId] ?? 'an unknown chip';
      throw new Error(`this app image targets ${name} (chip_id ${String(chipId)}); this core emulates the ESP32-S3 (chip_id 9)`);
    }
    const segmentCount = image[1] ?? 0;
    if (segmentCount === 0 || segmentCount > ESP_IMAGE_MAX_SEGMENTS) {
      throw new Error(`ESP image declares ${String(segmentCount)} segments; expected 1..${String(ESP_IMAGE_MAX_SEGMENTS)}`);
    }
    const entry = u32(4);
    if (this.sramIndex(entry) === null) {
      throw new Error(`ESP image entry point 0x${entry.toString(16)} is outside the modeled SRAM window`);
    }
    const segments: LoadedSegment[] = [];
    let off = ESP_IMAGE_HEADER_BYTES;
    let checksum = ESP_CHECKSUM_SEED;
    for (let i = 0; i < segmentCount; i++) {
      if (off + 8 > image.length) {
        throw new Error(`ESP image truncated in segment ${String(i)}'s header`);
      }
      const addr = u32(off);
      const len = u32(off + 4);
      off += 8;
      if (off + len > image.length) {
        throw new Error(`ESP image truncated: segment ${String(i)} declares ${String(len)} bytes but only ${String(image.length - off)} remain`);
      }
      if (len > 0 && (this.sramIndex(addr) === null || this.sramIndex(addr + len - 1) === null)) {
        throw new Error(
          `ESP image segment ${String(i)} loads at 0x${addr.toString(16)}..0x${(addr + len).toString(16)} — a flash-mapped or unmapped region; the flash cache is not modeled yet, so only IRAM/DRAM-resident images run`,
        );
      }
      const data = new Uint8Array(image.subarray(off, off + len));
      for (const b of data) checksum ^= b;
      segments.push({ addr, data });
      off += len;
    }
    // The checksum byte is the last byte once (body + 1) is padded to 16.
    const checkOff = Math.ceil((off + 1) / 16) * 16 - 1;
    if (checkOff >= image.length) {
      throw new Error('ESP image truncated before its checksum byte');
    }
    const stored = image[checkOff] ?? -1;
    if (stored !== checksum) {
      throw new Error(`ESP image checksum mismatch: stored 0x${stored.toString(16)}, computed 0x${checksum.toString(16)} — corrupted image?`);
    }
    return { segments, entry };
  }

  step(maxCycles: number): McuStepResult {
    if (!Number.isInteger(maxCycles) || maxCycles <= 0) {
      throw new Error(`maxCycles must be a positive integer (got ${String(maxCycles)})`);
    }
    const start = this.cpu.cycles;
    const target = start + maxCycles;
    while (this.cpu.cycles < target) {
      this.cpu.step();
      if ((this.t0Config & T0_ARMED) === T0_ARMED) this.checkT0Alarm();
    }
    const events = this.events;
    this.events = [];
    return { cycles: this.cpu.cycles - start, events };
  }

  setPin(pin: string, level: DigitalLevel): void {
    const gpio = this.parsePin(pin);
    const bank = gpio >> 5;
    const bit = 1 << (gpio & 31);
    const cur = this.inLevels[bank] ?? 0;
    const was = (cur & bit) !== 0 ? 1 : 0;
    this.inLevels[bank] = level === 1 ? cur | bit : cur & ~bit;
    if (was !== level) {
      // Edge-type pins latch their STATUS bit on a matching edge.
      const type = ((this.pinCfg[gpio] ?? 0) >> 7) & 7;
      if ((type === 1 && level === 1) || (type === 2 && level === 0) || type === 3) {
        this.gpioStatus[bank] = (this.gpioStatus[bank] ?? 0) | bit;
      }
    }
    this.recomputeIrq();
  }

  uartWrite(byte: number): void {
    if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
      throw new Error(`uartWrite expects a byte 0..255 (got ${String(byte)})`);
    }
    this.rxQueue.push(byte);
    this.recomputeIrq();
  }

  drainUart(): Uint8Array {
    const out = Uint8Array.from(this.txBuffer);
    this.txBuffer = [];
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
    // No SREG on Xtensa — reported as 0; sp is a1 by call0 convention.
    return { pc: this.cpu.pc, cycles: this.cpu.cycles, sreg: 0, sp: this.cpu.a(1) };
  }

  /** Power-on reset: machine + peripheral state cleared, firmware kept. */
  reset(): void {
    this.sram = new Uint8Array(SRAM_BYTES);
    for (const seg of this.segments) {
      const idx = this.sramIndex(seg.addr);
      if (idx !== null) this.sram.set(seg.data, idx);
    }
    this.out = [0, 0];
    this.enable = [0, 0];
    this.inLevels = [0, 0];
    this.gpioStatus = [0, 0];
    this.pinCfg.fill(0);
    this.uartIntEna = 0;
    this.uartTxDone = false;
    this.uartRxThrhd = 96;
    this.gpioIntMap = INTMTX_DEFAULT_MAP;
    this.uartIntMap = INTMTX_DEFAULT_MAP;
    this.t0Config = 0;
    this.t0Base = 0;
    this.t0Sync = 0;
    this.t0LatchLo = 0;
    this.t0LatchHi = 0;
    this.t0AlarmLo = 0;
    this.t0AlarmHi = 0;
    this.t0LoadLo = 0;
    this.t0LoadHi = 0;
    this.timgIntEna = 0;
    this.timgIntRaw = 0;
    this.tgT0IntMap = INTMTX_DEFAULT_MAP;
    this.meas1Ctrl2 = 0;
    this.adcData = 0;
    this.adcDone = false;
    this.adcReads = []; // the sampler itself survives — bench wiring
    this.driven.fill(undefined);
    this.events = [];
    this.rxQueue = [];
    this.txBuffer = [];
    this.cpu = new XtensaCpu(this.bus());
    // SP at the top of the DRAM window, like a bare-metal crt0 would.
    this.cpu.reset(this.entry, DRAM_BASE + SRAM_BYTES);
  }

  private parsePin(pin: string): number {
    const m = /^IO(\d{1,2})$/.exec(pin);
    const gpio = m ? Number(m[1]) : NaN;
    if (!m || gpio >= PIN_COUNT) {
      throw new Error(`invalid pin "${pin}": expected 'IO0'..'IO${String(PIN_COUNT - 1)}'`);
    }
    return gpio;
  }

  private t0Divider(): number {
    const field = (this.t0Config >>> 13) & 0xffff;
    return field === 0 ? 65536 : field; // 0 means 65536, per the HAL
  }

  /** The live 54-bit counter, derived from elapsed CPU cycles. */
  private t0Value(): number {
    if ((this.t0Config & T0_EN) === 0) return this.t0Base;
    const ticks = Math.floor((this.cpu.cycles - this.t0Sync) / (CYCLES_PER_APB * this.t0Divider()));
    const delta = (this.t0Config & T0_INCREASE) !== 0 ? ticks : -ticks;
    // NOT the usual ((x % M) + M) % M: adding 2^54 to a small positive
    // value rounds it away (the float ulp at 2^54 is 4). Only add the
    // modulus when the value is actually negative.
    let v = (this.t0Base + delta) % T0_MASK;
    if (v < 0) v += T0_MASK;
    return v;
  }

  /** Freeze the counter into t0Base — required before any config
   *  change so old-divider time doesn't replay under the new one. */
  private t0Resync(): void {
    this.t0Base = this.t0Value();
    this.t0Sync = this.cpu.cycles;
  }

  /** Alarm comparator, run after every instruction while armed. On a
   *  hit: latch the raw interrupt, auto-disable the alarm (the
   *  hardware behavior gptimer's ISR re-arms around), auto-reload if
   *  configured. */
  private checkT0Alarm(): void {
    const alarm = this.t0AlarmHi * 0x100000000 + this.t0AlarmLo;
    const value = this.t0Value();
    const hit = (this.t0Config & T0_INCREASE) !== 0 ? value >= alarm : value <= alarm;
    if (!hit) return;
    this.timgIntRaw |= 1;
    this.t0Config &= ~T0_ALARM_EN;
    if ((this.t0Config & T0_AUTORELOAD) !== 0) {
      this.t0Base = (this.t0LoadHi * 0x100000000 + this.t0LoadLo) % T0_MASK;
      this.t0Sync = this.cpu.cycles;
    }
    this.recomputeIrq();
  }

  /** UART0's raw interrupt bits: RXFIFO_FULL tracks the live FIFO
   *  state against the CONF1 threshold (level-style — it re-asserts
   *  while data remains); TX_DONE latches per transmitted byte and
   *  clears via INT_CLR. */
  private uartIntRaw(): number {
    let raw = this.uartTxDone ? UART_TX_DONE_INT : 0;
    if (this.rxQueue.length > this.uartRxThrhd) raw |= UART_RXFIFO_FULL_INT;
    return raw;
  }

  /** Re-derive the interrupt matrix's output and drive the CPU's
   *  level-triggered external lines. Called whenever any modeled
   *  interrupt source's inputs change. */
  private recomputeIrq(): void {
    // Level-type GPIO pins re-assert their STATUS bit while the level
    // holds — W1TC alone cannot silence them, exactly like hardware.
    for (let gpio = 0; gpio < PIN_COUNT; gpio++) {
      const type = ((this.pinCfg[gpio] ?? 0) >> 7) & 7;
      if (type !== 4 && type !== 5) continue;
      const bank = gpio >> 5;
      const bit = 1 << (gpio & 31);
      const high = ((this.inLevels[bank] ?? 0) & bit) !== 0;
      if (type === 4 ? !high : high) {
        this.gpioStatus[bank] = (this.gpioStatus[bank] ?? 0) | bit;
      }
    }
    let gpioPending = false;
    for (let gpio = 0; gpio < PIN_COUNT; gpio++) {
      if (((this.pinCfg[gpio] ?? 0) & GPIO_INT_ENA_BIT) === 0) continue;
      if (((this.gpioStatus[gpio >> 5] ?? 0) & (1 << (gpio & 31))) !== 0) {
        gpioPending = true;
        break;
      }
    }
    const uartPending = (this.uartIntRaw() & this.uartIntEna) !== 0;
    const timgPending = (this.timgIntRaw & this.timgIntEna & 1) !== 0;
    let mask = 0;
    if (gpioPending) mask |= 1 << (this.gpioIntMap & 31);
    if (uartPending) mask |= 1 << (this.uartIntMap & 31);
    if (timgPending) mask |= 1 << (this.tgT0IntMap & 31);
    this.cpu.setExtInt(mask);
  }

  /** Re-derive driven levels after any OUT/ENABLE change; emit edges. */
  private syncPins(): void {
    for (let gpio = 0; gpio < PIN_COUNT; gpio++) {
      const bank = gpio >> 5;
      const bit = 1 << (gpio & 31);
      const enabled = ((this.enable[bank] ?? 0) & bit) !== 0;
      if (!enabled) {
        this.driven[gpio] = undefined;
        continue;
      }
      const level: DigitalLevel = ((this.out[bank] ?? 0) & bit) !== 0 ? 1 : 0;
      const prev = this.driven[gpio];
      if (prev !== undefined && prev !== level) {
        this.events.push({ pin: esp32s3PinId(gpio), level, cycle: this.cpu.cycles });
      }
      this.driven[gpio] = level;
    }
  }

  private bus(): XtensaBus {
    return {
      read: (addr, bytes) => this.busRead(addr, bytes),
      write: (addr, bytes, value) => {
        this.busWrite(addr, bytes, value);
      },
    };
  }

  private sramIndex(addr: number): number | null {
    if (addr >= IRAM_BASE && addr < IRAM_BASE + SRAM_BYTES) return addr - IRAM_BASE;
    if (addr >= DRAM_BASE && addr < DRAM_BASE + SRAM_BYTES) return addr - DRAM_BASE;
    return null;
  }

  private busRead(addr: number, bytes: 1 | 2 | 4): number {
    const idx = this.sramIndex(addr);
    if (idx !== null) {
      let v = 0;
      for (let i = bytes - 1; i >= 0; i--) v = (v << 8) | (this.sram[idx + i] ?? 0);
      return v >>> 0;
    }
    if (addr >= GPIO_BASE && addr < GPIO_BASE + 0x1000) {
      const off = addr - GPIO_BASE;
      if (off === GPIO_OUT) return this.out[0] ?? 0;
      if (off === GPIO_OUT1) return this.out[1] ?? 0;
      if (off === GPIO_ENABLE) return this.enable[0] ?? 0;
      if (off === GPIO_ENABLE1) return this.enable[1] ?? 0;
      if (off === GPIO_IN) return (this.inLevels[0] ?? 0) >>> 0;
      if (off === GPIO_IN1) return (this.inLevels[1] ?? 0) >>> 0;
      if (off === GPIO_STATUS) return (this.gpioStatus[0] ?? 0) >>> 0;
      if (off === GPIO_STATUS1) return (this.gpioStatus[1] ?? 0) >>> 0;
      if (off >= GPIO_PIN0 && off < GPIO_PIN0 + 4 * PIN_COUNT && (off & 3) === 0) {
        return (this.pinCfg[(off - GPIO_PIN0) >> 2] ?? 0) >>> 0;
      }
      return 0;
    }
    if (addr >= UART0_BASE && addr < UART0_BASE + 0x1000) {
      const off = addr - UART0_BASE;
      if (off === UART_FIFO) {
        const byte = this.rxQueue.shift() ?? 0;
        this.recomputeIrq(); // draining may deassert RXFIFO_FULL
        return byte;
      }
      if (off === UART_STATUS) {
        const rx = Math.min(this.rxQueue.length, 0x3ff);
        return rx; // TXFIFO_CNT [25:16] stays 0 — the modeled tx FIFO never fills
      }
      if (off === UART_INT_RAW) return this.uartIntRaw();
      if (off === UART_INT_ST) return this.uartIntRaw() & this.uartIntEna;
      if (off === UART_INT_ENA) return this.uartIntEna;
      if (off === UART_CONF1) return this.uartRxThrhd;
      return 0;
    }
    if (addr >= INTMTX_BASE && addr < INTMTX_BASE + 0x1000) {
      const off = addr - INTMTX_BASE;
      if (off === INTMTX_GPIO_MAP) return this.gpioIntMap;
      if (off === INTMTX_UART_MAP) return this.uartIntMap;
      if (off === INTMTX_TG_T0_MAP) return this.tgT0IntMap;
      return INTMTX_DEFAULT_MAP; // unmodeled sources sit at their reset map
    }
    if (addr >= TIMG0_BASE && addr < TIMG0_BASE + 0x1000) {
      const off = addr - TIMG0_BASE;
      if (off === TIMG_T0CONFIG) return this.t0Config >>> 0;
      if (off === TIMG_T0LO) return this.t0LatchLo >>> 0;
      if (off === TIMG_T0HI) return this.t0LatchHi >>> 0;
      if (off === TIMG_T0UPDATE) return 0; // capture completes instantly
      if (off === TIMG_T0ALARMLO) return this.t0AlarmLo >>> 0;
      if (off === TIMG_T0ALARMHI) return this.t0AlarmHi >>> 0;
      if (off === TIMG_T0LOADLO) return this.t0LoadLo >>> 0;
      if (off === TIMG_T0LOADHI) return this.t0LoadHi >>> 0;
      if (off === TIMG_INT_ENA) return this.timgIntEna;
      if (off === TIMG_INT_RAW) return this.timgIntRaw;
      if (off === TIMG_INT_ST) return this.timgIntRaw & this.timgIntEna;
      return 0;
    }
    if (addr >= SENS_BASE && addr < SENS_BASE + 0x400) {
      if (addr - SENS_BASE === SENS_SAR_MEAS1_CTRL2) {
        let v = this.meas1Ctrl2 & ~(MEAS1_DONE_SAR | 0xffff);
        if (this.adcDone) v |= MEAS1_DONE_SAR | (this.adcData & 0xfff);
        return v >>> 0;
      }
      return 0;
    }
    throw new Error(`read outside the modeled ESP32-S3 map: 0x${addr.toString(16)}`);
  }

  private busWrite(addr: number, bytes: 1 | 2 | 4, value: number): void {
    const idx = this.sramIndex(addr);
    if (idx !== null) {
      for (let i = 0; i < bytes; i++) this.sram[idx + i] = (value >>> (8 * i)) & 0xff;
      return;
    }
    if (addr >= GPIO_BASE && addr < GPIO_BASE + 0x1000) {
      const off = addr - GPIO_BASE;
      const v = value >>> 0;
      if (off === GPIO_OUT) this.out[0] = v;
      else if (off === GPIO_OUT_W1TS) this.out[0] = (this.out[0] ?? 0) | v;
      else if (off === GPIO_OUT_W1TC) this.out[0] = (this.out[0] ?? 0) & ~v;
      else if (off === GPIO_OUT1) this.out[1] = v;
      else if (off === GPIO_OUT1_W1TS) this.out[1] = (this.out[1] ?? 0) | v;
      else if (off === GPIO_OUT1_W1TC) this.out[1] = (this.out[1] ?? 0) & ~v;
      else if (off === GPIO_ENABLE) this.enable[0] = v;
      else if (off === GPIO_ENABLE_W1TS) this.enable[0] = (this.enable[0] ?? 0) | v;
      else if (off === GPIO_ENABLE_W1TC) this.enable[0] = (this.enable[0] ?? 0) & ~v;
      else if (off === GPIO_ENABLE1) this.enable[1] = v;
      else if (off === GPIO_ENABLE1_W1TS) this.enable[1] = (this.enable[1] ?? 0) | v;
      else if (off === GPIO_ENABLE1_W1TC) this.enable[1] = (this.enable[1] ?? 0) & ~v;
      else if (off === GPIO_STATUS) this.gpioStatus[0] = v;
      else if (off === GPIO_STATUS_W1TS) this.gpioStatus[0] = ((this.gpioStatus[0] ?? 0) | v) >>> 0;
      else if (off === GPIO_STATUS_W1TC) this.gpioStatus[0] = ((this.gpioStatus[0] ?? 0) & ~v) >>> 0;
      else if (off === GPIO_STATUS1) this.gpioStatus[1] = v;
      else if (off === GPIO_STATUS1_W1TS) this.gpioStatus[1] = ((this.gpioStatus[1] ?? 0) | v) >>> 0;
      else if (off === GPIO_STATUS1_W1TC) this.gpioStatus[1] = ((this.gpioStatus[1] ?? 0) & ~v) >>> 0;
      else if (off >= GPIO_PIN0 && off < GPIO_PIN0 + 4 * PIN_COUNT && (off & 3) === 0) {
        this.pinCfg[(off - GPIO_PIN0) >> 2] = v | 0;
      }
      this.syncPins();
      this.recomputeIrq();
      return;
    }
    if (addr >= UART0_BASE && addr < UART0_BASE + 0x1000) {
      const off = addr - UART0_BASE;
      if (off === UART_FIFO) {
        this.txBuffer.push(value & 0xff);
        this.uartTxDone = true; // tx is instantaneous in this model
      } else if (off === UART_INT_ENA) {
        this.uartIntEna = value >>> 0;
      } else if (off === UART_INT_CLR) {
        // Clears latched bits; RXFIFO_FULL tracks the FIFO level, so
        // it re-asserts unless the FIFO was drained first.
        if ((value & UART_TX_DONE_INT) !== 0) this.uartTxDone = false;
      } else if (off === UART_CONF1) {
        this.uartRxThrhd = value & 0x3ff;
      }
      this.recomputeIrq();
      return;
    }
    if (addr >= INTMTX_BASE && addr < INTMTX_BASE + 0x1000) {
      const off = addr - INTMTX_BASE;
      if (off === INTMTX_GPIO_MAP) this.gpioIntMap = value & 0x1f;
      else if (off === INTMTX_UART_MAP) this.uartIntMap = value & 0x1f;
      else if (off === INTMTX_TG_T0_MAP) this.tgT0IntMap = value & 0x1f;
      // Map writes for unmodeled sources are accepted and dropped —
      // those sources never assert, so the mapping is moot.
      this.recomputeIrq();
      return;
    }
    if (addr >= TIMG0_BASE && addr < TIMG0_BASE + 0x1000) {
      const off = addr - TIMG0_BASE;
      const v = value >>> 0;
      if (off === TIMG_T0CONFIG) {
        this.t0Resync(); // freeze under the OLD divider/EN first
        this.t0Config = v | 0;
      } else if (off === TIMG_T0UPDATE) {
        const val = this.t0Value();
        this.t0LatchLo = val % 0x100000000;
        this.t0LatchHi = Math.floor(val / 0x100000000);
      } else if (off === TIMG_T0ALARMLO) this.t0AlarmLo = v;
      else if (off === TIMG_T0ALARMHI) this.t0AlarmHi = v & 0x3fffff;
      else if (off === TIMG_T0LOADLO) this.t0LoadLo = v;
      else if (off === TIMG_T0LOADHI) this.t0LoadHi = v & 0x3fffff;
      else if (off === TIMG_T0LOAD) {
        // Any write reloads the counter from {LOADHI, LOADLO}.
        this.t0Base = (this.t0LoadHi * 0x100000000 + this.t0LoadLo) % T0_MASK;
        this.t0Sync = this.cpu.cycles;
      } else if (off === TIMG_INT_ENA) this.timgIntEna = v;
      else if (off === TIMG_INT_CLR) this.timgIntRaw &= ~v;
      this.recomputeIrq();
      return;
    }
    if (addr >= SENS_BASE && addr < SENS_BASE + 0x400) {
      if (addr - SENS_BASE === SENS_SAR_MEAS1_CTRL2) {
        const prev = this.meas1Ctrl2;
        this.meas1Ctrl2 = value >>> 0;
        // adc_oneshot_ll_start pulses MEAS1_START_SAR low then high —
        // the 0→1 edge runs a conversion. It completes immediately
        // (the conversion-time cut, stated in the header).
        if ((value & MEAS1_START_SAR) !== 0 && (prev & MEAS1_START_SAR) === 0) {
          const enPad = (value >>> 19) & 0xfff;
          const channel = enPad === 0 ? 0 : 31 - Math.clz32(enPad & -enPad);
          const volts = this.sampler ? this.sampler(channel, this.cpu.cycles) : 0;
          this.adcData = Math.min(ADC_MAX, Math.max(0, Math.round((volts / ADC_VREF) * ADC_MAX)));
          this.adcDone = true;
          this.adcReads.push({ channel, cycle: this.cpu.cycles });
        }
      }
      return;
    }
    throw new Error(`write outside the modeled ESP32-S3 map: 0x${addr.toString(16)}`);
  }
}

export { IRAM_BASE as ESP32S3_IRAM_BASE, DRAM_BASE as ESP32S3_DRAM_BASE, GPIO_BASE as ESP32S3_GPIO_BASE, UART0_BASE as ESP32S3_UART0_BASE };
