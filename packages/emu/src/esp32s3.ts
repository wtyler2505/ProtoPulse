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
 * Flash-mapped app-image segments (slice 9) are served read-only at
 * their IROM/DROM vaddrs — the net effect of the bootloader's MMU
 * setup plus a fully-warmed cache (XIP reads cost 1 cycle like
 * everything else; no cache-miss timing, no MMU registers, no SPI
 * flash writes). ROM functions (slice 10) are HOST-INTERCEPTED
 * TRAPS, not real mask-ROM code: each modeled function's REAL entry
 * address (esp-idf's esp32s3.rom.ld / .rom.newlib.ld) serves a
 * synthetic ENTRY+RETW stub, and fetching the RETW runs the
 * function's semantic effect on the host — ets_printf (register
 * varargs only, %dicusxXp%% with 0/width flags), uart_tx_one_char,
 * ets_delay_us (jumps CCOUNT forward, so a CCOMPARE0 equality inside
 * the skipped span is missed), memset/memcpy/strlen, and
 * software_reset (modeled as power-on reset; the running step()
 * returns early). Windowed-ABI callers only — a call0-style call
 * into ROM refuses at the stub's RETW; any OTHER address in the
 * ROM0/ROM1 ranges refuses loudly, naming the address and the
 * modeled functions (no silent garbage). Interrupt-driven, analog,
 * gptimer-style, and flash-resident firmware patterns run
 * end-to-end — but there are still no RTC/eFuse/SYSTEM registers,
 * no second core, no ADC2/DMA mode, no TIMG0 T1/TIMG1/watchdogs,
 * and no XTAL clock source for the timer (APB only), so full
 * IDF/FreeRTOS firmware does NOT run yet. Loading Intel-HEX refuses
 * with a message.
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
// Flash-cache-mapped windows (soc.h SOC_IROM/DROM_*, confirmed by
// ext_mem_defs.h). App-image segments with load addresses here are
// MAPPED by the bootloader's MMU setup, not copied — the vaddr in
// the image header IS the post-mapping address. The emulator serves
// those segments directly at their vaddrs, read-only, which is the
// net effect of a fully-warmed cache.
const IROM_LOW = 0x42000000;
const IROM_HIGH = 0x44000000;
const DROM_LOW = 0x3c000000;
const DROM_HIGH = 0x3e000000;

// ── Slice 10: ROM functions as host-intercepted traps ──
// The mask-ROM ranges (ESP32-S3 TRM / datasheet "Internal Memory
// Address Mapping"): ROM0 0x4000_0000..0x4005_FFFF (384 KiB,
// instruction bus), ROM1 0x3FF0_0000..0x3FF1_FFFF (128 KiB, data
// bus). The real ROM's code is not emulated; instead each modeled
// function's REAL entry address — straight out of esp-idf v5.2's
// components/esp_rom/esp32s3/ld/esp32s3.rom.ld (+ .rom.newlib.ld for
// the libc exports) — serves a synthetic ENTRY+RETW stub, and the
// fetch of that RETW triggers the function's semantic effect on the
// host (result into the callee window's a2, return via the CPU's own
// RETW with its spill/fill machinery). This is the standard
// trick for ROM-less emulation; QEMU-esp32s3 instead ships Espressif's
// real ROM dump, which we deliberately do not (no redistributable
// blob, no mask-ROM UART/SPI drivers to model under it).
// esp_rom_delay_us is the IDF-side alias of ets_delay_us
// (esp32s3.rom.api.ld), so it needs no separate entry. Windowed-ABI
// callers only: a call0-style call lands on the stub's RETW, which
// already refuses call0 links loudly. Any other ROM address refuses
// with a diagnostic naming it — no silent garbage.
const ROM0_LOW = 0x40000000;
const ROM0_HIGH = 0x40060000;
const ROM1_LOW = 0x3ff00000;
const ROM1_HIGH = 0x3ff20000;
const ROM_FNS: Record<number, string> = {
  0x400005d0: 'ets_printf',
  0x40000600: 'ets_delay_us', // = esp_rom_delay_us
  0x40000648: 'uart_tx_one_char',
  0x400006d8: 'software_reset',
  0x400011e8: 'memset',
  0x400011f4: 'memcpy',
  0x40001248: 'strlen',
};
const ROM_FN_LIST = Object.entries(ROM_FNS)
  .map(([a, n]) => `${n}@0x${Number(a).toString(16)}`)
  .join(', ');
/** The stub every ROM function serves: ENTRY a1,16 ; RETW. */
const ROM_STUB = Uint8Array.from([0x36, 0x21, 0x00, 0x90, 0x00, 0x00]);
const CYCLES_PER_US = CLOCK_HZ / 1_000_000; // 240
/** Walk-the-bus guard for strlen / %s — a missing NUL must refuse,
 *  not spin forever. */
const ROM_STR_MAX = 0x10000;

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
  /** Flash-mapped (IROM/DROM) segments — served read-only in place. */
  private romSegments: LoadedSegment[] = [];
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

  /** Set by the software_reset ROM trap; consumed by step(). */
  private pendingReset = false;

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
      this.romSegments = parsed.romSegments;
      this.entry = parsed.entry;
    } else {
      if (image.length > SRAM_BYTES) {
        throw new Error(`image is ${String(image.length)} bytes; the modeled SRAM window is ${String(SRAM_BYTES)}`);
      }
      this.segments = [{ addr: IRAM_BASE, data: new Uint8Array(image) }];
      this.romSegments = [];
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
  private parseEspImage(image: Uint8Array): { segments: LoadedSegment[]; romSegments: LoadedSegment[]; entry: number } {
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
    if (this.sramIndex(entry) === null && !(entry >= IROM_LOW && entry < IROM_HIGH)) {
      throw new Error(`ESP image entry point 0x${entry.toString(16)} is outside the modeled SRAM window and the IROM cache window`);
    }
    const segments: LoadedSegment[] = [];
    const romSegments: LoadedSegment[] = [];
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
      const data = new Uint8Array(image.subarray(off, off + len));
      const end = addr + Math.max(len, 1) - 1;
      const inSram = this.sramIndex(addr) !== null && this.sramIndex(end) !== null;
      const inIrom = addr >= IROM_LOW && end < IROM_HIGH;
      const inDrom = addr >= DROM_LOW && end < DROM_HIGH;
      if (len > 0 && inSram) segments.push({ addr, data });
      else if (len > 0 && (inIrom || inDrom)) romSegments.push({ addr, data });
      else if (len > 0) {
        throw new Error(
          `ESP image segment ${String(i)} loads at 0x${addr.toString(16)}..0x${(addr + len).toString(16)} — outside the modeled SRAM window and the IROM/DROM cache windows`,
        );
      }
      for (const b of data) checksum ^= b;
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
    return { segments, romSegments, entry };
  }

  step(maxCycles: number): McuStepResult {
    if (!Number.isInteger(maxCycles) || maxCycles <= 0) {
      throw new Error(`maxCycles must be a positive integer (got ${String(maxCycles)})`);
    }
    const start = this.cpu.cycles;
    const target = start + maxCycles;
    while (this.cpu.cycles < target) {
      this.cpu.step();
      if (this.pendingReset) {
        // software_reset ROM trap: a power-on reset that ends this
        // step() call (the cycle counter restarts from 0).
        const consumed = this.cpu.cycles - start;
        const resetEvents = this.events;
        this.reset();
        return { cycles: consumed, events: resetEvents };
      }
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
    this.pendingReset = false;
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

  // ── ROM function traps (slice 10) ──

  /** Serve the synthetic ENTRY+RETW stub for a modeled ROM function;
   *  fetching the RETW's first byte (entry+3) runs the function's
   *  semantic effect — at that point the CPU's ENTRY has already
   *  rotated the window, so args sit in the callee's a2.. and the
   *  CPU's own RETW performs the return (with its spill/fill and its
   *  call0-link refusal). Triggering on the fetch (not on PC) means a
   *  level-1 interrupt taken at entry+3 cannot double-run the effect:
   *  no fetch happens on the vectored step, and the post-RFE retry
   *  fetches — and runs — it exactly once. */
  private romRead(addr: number, bytes: 1 | 2 | 4): number {
    let fn: number | null = null;
    for (const a of Object.keys(ROM_FNS)) {
      const base = Number(a);
      if (addr >= base && addr < base + ROM_STUB.length) {
        fn = base;
        break;
      }
    }
    if (fn === null) {
      throw new Error(
        `ROM address 0x${addr.toString(16)} is not a modeled ROM function — ` +
          `this core traps only ${ROM_FN_LIST}; the mask ROM's code is not emulated`,
      );
    }
    if (addr === fn + 3 && bytes === 1) this.romTrap(fn);
    let v = 0;
    for (let i = bytes - 1; i >= 0; i--) v = (v << 8) | (ROM_STUB[addr - fn + i] ?? 0);
    return v >>> 0;
  }

  /** Write the trap's return value into the callee window's a2. */
  private romRet(v: number): void {
    this.cpu.phys[(this.cpu.windowBase * 4 + 2) & (this.cpu.phys.length - 1)] = v | 0;
  }

  private romTrap(fn: number): void {
    const arg = (i: number): number => this.cpu.a(2 + i);
    switch (fn) {
      case 0x400005d0: // ets_printf
        this.romRet(this.romPrintf());
        break;
      case 0x40000600: // ets_delay_us — burn cycles at the modeled 240 MHz.
        // One jump, not a loop: a CCOMPARE0 equality strictly inside
        // the skipped span is missed (honest cut — the header says so).
        this.cpu.cycles += (arg(0) >>> 0) * CYCLES_PER_US;
        break;
      case 0x40000648: { // uart_tx_one_char — returns 0 (OK)
        this.txBuffer.push(arg(0) & 0xff);
        this.uartTxDone = true;
        this.recomputeIrq();
        this.romRet(0);
        break;
      }
      case 0x400006d8: // software_reset — never returns; step() resets.
        this.pendingReset = true;
        break;
      case 0x400011e8: { // memset(dst, c, n) → dst
        const dst = arg(0) >>> 0;
        const c = arg(1) & 0xff;
        const n = arg(2) >>> 0;
        for (let i = 0; i < n; i++) this.busWrite((dst + i) >>> 0, 1, c);
        this.romRet(dst | 0);
        break;
      }
      case 0x400011f4: { // memcpy(dst, src, n) → dst
        const dst = arg(0) >>> 0;
        const src = arg(1) >>> 0;
        const n = arg(2) >>> 0;
        for (let i = 0; i < n; i++) this.busWrite((dst + i) >>> 0, 1, this.busRead((src + i) >>> 0, 1));
        this.romRet(dst | 0);
        break;
      }
      case 0x40001248: // strlen(s)
        this.romRet(this.romStrlen(arg(0) >>> 0));
        break;
      default:
        throw new Error(`ROM trap dispatch out of sync for 0x${fn.toString(16)} — this is a core bug`);
    }
  }

  private romStrlen(ptr: number): number {
    for (let n = 0; n <= ROM_STR_MAX; n++) {
      if (this.busRead((ptr + n) >>> 0, 1) === 0) return n;
    }
    throw new Error(`strlen ROM trap: no NUL within ${String(ROM_STR_MAX)} bytes of 0x${ptr.toString(16)} — bad pointer?`);
  }

  /** Minimal ets_printf: %d %i %u %x %X %p %c %s %% with '0' and
   *  width flags ('l' modifiers accepted and ignored; width is not
   *  applied to %s). Register varargs only (a3..a7); anything fancier
   *  refuses loudly rather than printing garbage. */
  private romPrintf(): number {
    let argIdx = 0;
    const nextArg = (): number => {
      if (argIdx >= 5) {
        throw new Error('ets_printf trap supports at most 5 varargs (register args a3..a7 — stack varargs are not modeled)');
      }
      return this.cpu.a(3 + argIdx++) | 0;
    };
    const out: number[] = [];
    const emitStr = (str: string): void => {
      for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff);
    };
    let p = this.cpu.a(2) >>> 0;
    for (let guard = 0; ; guard++) {
      if (guard > ROM_STR_MAX) {
        throw new Error('ets_printf trap: format string has no NUL within 64 KiB — bad pointer?');
      }
      const ch = this.busRead(p++, 1);
      if (ch === 0) break;
      if (ch !== 0x25) {
        out.push(ch);
        continue;
      }
      let c = this.busRead(p++, 1);
      if (c === 0x25) {
        out.push(0x25); // %%
        continue;
      }
      let zero = false;
      let width = 0;
      if (c === 0x30) {
        zero = true;
        c = this.busRead(p++, 1);
      }
      while (c >= 0x30 && c <= 0x39) {
        width = width * 10 + (c - 0x30);
        c = this.busRead(p++, 1);
      }
      while (c === 0x6c) c = this.busRead(p++, 1); // 'l'
      const pad = (str: string): string =>
        str.length >= width ? str : (zero ? '0' : ' ').repeat(width - str.length) + str;
      switch (c) {
        case 0x64: case 0x69: emitStr(pad(String(nextArg()))); break; // %d %i
        case 0x75: emitStr(pad(String(nextArg() >>> 0))); break; // %u
        case 0x78: emitStr(pad((nextArg() >>> 0).toString(16))); break; // %x
        case 0x58: emitStr(pad((nextArg() >>> 0).toString(16).toUpperCase())); break; // %X
        case 0x70: emitStr(`0x${(nextArg() >>> 0).toString(16)}`); break; // %p
        case 0x63: out.push(nextArg() & 0xff); break; // %c
        case 0x73: { // %s
          const sp = nextArg() >>> 0;
          const len = this.romStrlen(sp); // guards against a missing NUL
          for (let i = 0; i < len; i++) out.push(this.busRead((sp + i) >>> 0, 1));
          break;
        }
        default:
          throw new Error(
            `ets_printf trap: unsupported conversion '%${String.fromCharCode(c)}' — only %d %i %u %x %X %p %c %s %% are modeled`,
          );
      }
    }
    for (const b of out) this.txBuffer.push(b);
    if (out.length > 0) {
      this.uartTxDone = true;
      this.recomputeIrq();
    }
    return out.length;
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

  private inCacheWindow(addr: number): boolean {
    return (addr >= IROM_LOW && addr < IROM_HIGH) || (addr >= DROM_LOW && addr < DROM_HIGH);
  }

  private busRead(addr: number, bytes: 1 | 2 | 4): number {
    const idx = this.sramIndex(addr);
    if (idx !== null) {
      let v = 0;
      for (let i = bytes - 1; i >= 0; i--) v = (v << 8) | (this.sram[idx + i] ?? 0);
      return v >>> 0;
    }
    if (this.inCacheWindow(addr)) {
      for (const seg of this.romSegments) {
        if (addr >= seg.addr && addr + bytes <= seg.addr + seg.data.length) {
          let v = 0;
          for (let i = bytes - 1; i >= 0; i--) v = (v << 8) | (seg.data[addr - seg.addr + i] ?? 0);
          return v >>> 0;
        }
      }
      throw new Error(`read of unmapped flash-cache address 0x${addr.toString(16)} — only the app image's IROM/DROM segments are mapped`);
    }
    if ((addr >= ROM0_LOW && addr < ROM0_HIGH) || (addr >= ROM1_LOW && addr < ROM1_HIGH)) {
      return this.romRead(addr, bytes);
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
    if (this.inCacheWindow(addr)) {
      throw new Error(`write to flash-cache address 0x${addr.toString(16)} — flash is read-only through the cache`);
    }
    if ((addr >= ROM0_LOW && addr < ROM0_HIGH) || (addr >= ROM1_LOW && addr < ROM1_HIGH)) {
      throw new Error(`write to ROM address 0x${addr.toString(16)} — the mask ROM is read-only`);
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
