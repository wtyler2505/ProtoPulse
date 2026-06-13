import { XtensaCpu } from './xtensa.js';

import type { AdcReadRequest, AdcSampler, DigitalLevel, McuCore, McuState, McuStepResult, PinEvent } from './types.js';
import type { XtensaBus } from './xtensa.js';

export interface Esp32s3AdcContinuousOverflowEvent {
  cycle: number;
  descriptor: number;
  frameWord: number;
  policy: 'drop-new' | 'flush-old';
}

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
 * Honest cuts, stated plainly:
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
 * plus SAR ADC1/ADC2's oneshot paths (slice 7 + slice 14 — the
 * SENS_SAR_MEASx_CTRL2 register dance adc_oneshot_ll/analogRead
 * performs: one-hot channel select, start-bit edge, done poll, 12-bit
 * data; conversions complete instantly and attenuation is not modeled
 * — full scale is 3.3 V; ADC1 channel n reads GPIO n+1, ADC2 channel
 * n reads GPIO n+11 and is exposed to the host sampler as channel
 * 10+n so the one-dimensional McuCore ADC surface stays unambiguous),
 * plus
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
 * end-to-end. The RTC/eFuse/SYSTEM register set IDF's startup,
 * esp_chip_info, and reset-reason paths read is modeled (slice 11):
 * per-CPU reset causes in RTC_CNTL_RESET_STATE_REG (power-on 1; the
 * software_reset ROM trap and the OPTIONS0 SW_SYS_RST/SW_PROCPU_RST
 * write bits set 3/12 per rom/rtc.h), the 48-bit RTC main timer over
 * the ~136 kHz RC_SLOW clock (TIME_UPDATE-latched LOW0/HIGH0 reads;
 * the counter restarts at reset — real hardware keeps it),
 * eFuse BLOCK0..10 reads, BLOCK1 serving a documented SYNTHETIC
 * locally-administered MAC (7A:C0:DE:00:53:33) and wafer version 0
 * (chip rev v0.0), a minimal programming controller (PGM_DATA0..7,
 * CONF, CMD, INT_RAW/ST/ENA/CLR) whose burn command ORs staged
 * one-way bits into the selected block, and the SYSTEM clock-config
 * registers frozen at the post-2nd-stage-bootloader state matching
 * the modeled clock
 * (PLL 480 MHz, CPU 240 MHz, XTAL 40 MHz) — writes to them are
 * stored but do NOT retune the emulated clock. Reads of any OTHER
 * register in those three blocks refuse loudly with the address and
 * the modeled set (a benign zero would silently lie — e.g. "the RTC
 * watchdog is off"); unmodeled writes there are accepted and
 * dropped, like the other peripheral blocks. BOTH Xtensa cores run
 * (slice 12): the APP CPU is a second XtensaCpu on the same bus,
 * held exactly the way real silicon holds it at power-on
 * (SYSTEM_CORE_1_CONTROL_0's RESETING bit resets to 1, CLKGATE_EN
 * to 0 — system_reg.h) and released by IDF's start_other_core
 * sequence (cpu_start.c): esp_cpu_unstall(1) clearing the split
 * 0x86 stall code (RTC OPTIONS0 SW_STALL_APPCPU_C0 [1:0] +
 * SW_CPU_STALL_REG APPCPU_C1 [25:20]), CLKGATE_EN set, RUNSTALL
 * cleared, RESETING pulsed, then the ets_set_appcpu_boot_addr ROM
 * trap (0x40000720, esp32s3.rom.ld) — core 1 stays parked until
 * that address is non-zero, the net effect of the real ROM's wait
 * loop, then starts there with CCOUNT 0. INTERLEAVE POLICY:
 * lockstep per instruction — core 0 (the SoC timebase; all shared
 * timers count its cycles) steps one instruction, then core 1 steps
 * until its shared-timeline cycle count (release epoch + own
 * cycles) catches up; 1 instr = 1 cycle on both, so they alternate.
 * While gated/stalled, core 1's timeline slides forward without
 * executing. All SR state (PS, INTENABLE/INTERRUPT, CCOUNT/
 * CCOMPARE0, VECBASE, windows) lives per-XtensaCpu, so per-core
 * timer interrupts cannot cross-fire. FROM_CPU cross-core software
 * interrupts latch through SYSTEM_CPU_INTR_FROM_CPU0..3 and the
 * per-core interrupt matrix maps at +0x13C..+0x148, so the ESP-IDF
 * crosscore ISR path can poke the APP CPU while it sleeps in WAITI.
 * OPTIONS0's SW_APPCPU_RST
 * resets core 1 alone (cause 12 in RESET_STATE's APPCPU [11:6];
 * the boot address survives, like the real ROM's, so it restarts).
 * Core-1 cuts: no per-core cache/TRAX, no atomic/exclusive-access
 * modeling (the ISA subset has none), and raw (non-ROM) core-1
 * programs get a SYNTHETIC reset SP 16 KiB below the DRAM top (real
 * code sets its own stack immediately).
 * ALL FOUR general-purpose timers run (slice 13): the slice-8 T0
 * model generalized to T0/T1 in both TIMG0 and TIMG1 (T1's block is
 * T0's at +0x24; TIMG1's base is 0x60020000 — reg_base.h), each with
 * its own interrupt-matrix map (TG_T0/T1 +0xC8/0xCC, TG1_T0/T1
 * +0xD4/0xD8). The WATCHDOGS are modeled too (slice 13) — the MWDT
 * in each TIMG group (WDTCONFIG0..5 +0x48..0x5C, WDTFEED +0x60,
 * WDTWPROTECT +0x64) and the RTC_CNTL RWDT (WDTCONFIG0..4
 * +0x98..0xA8, WDTFEED +0xAC bit 31, WDTWPROTECT +0xB0), both gated
 * by the 0x50D83AA1 write-protect key (registers reset UNLOCKED,
 * like hardware; a wrong key silently drops config writes, exactly
 * the behavior wdt_hal relies on). Stages expire cumulatively from
 * the last feed; actions per hal/wdt_types.h — 1 raises the group's
 * WDT interrupt (bit 2, via TG_WDT/TG1_WDT maps +0xD0/0xDC), 2
 * resets the CPU, 3 the system, 4 (RWDT only) system+RTC — with the
 * real rom/rtc.h causes in RESET_STATE: TG0WDT 7/11, TG1WDT 8/17,
 * RTCWDT 9/13/16. MWDTs count APB/CLK_PRESCALE ticks; the RWDT
 * counts the modeled ~136 kHz RC_SLOW clock. Watchdog cuts, stated
 * plainly: stage-N CPU-reset ignores the PROCPU/APPCPU_RESET_EN
 * routing bits and always resets the PRO CPU (whole machine, like
 * SW_PROCPU_RST); the RWDT's stage-0 eFuse tick multiplier
 * (rwdt_ll.h writes timeout>>1) is NOT applied — CONFIG registers
 * hold raw ticks; FLASHBOOT_MOD_EN bits are stored but INERT (this
 * core boots post-bootloader with the flashboot watchdogs already
 * quiesced, so raw test images aren't killed before they can
 * configure anything — IDF startup's disable writes still land on
 * real modeled registers); the RWDT INT stage action now latches
 * RTC_WDT_INT via the RTC_CORE interrupt source. SUPER_WDT, sleep
 * pause, and XTAL clock sources are out of scope.
 * The APB_SARADC digital-controller register substrate is
 * modeled (slice 15): CTRL/CTRL2, packed pattern tables, DATA_STATUS,
 * DMA_CONF storage, ADC1/ADC2 done interrupts, and the two ESP-IDF
 * digital monitor threshold comparators; timer/start triggers complete
 * instantly and clearing DONE while timer mode is enabled advances the
 * pattern stream. APB_SARADC's ADC_DONE and threshold status route
 * through the core-0 interrupt matrix source at +0x104 (slice 20/21),
 * so digital-controller firmware can sleep in a level-1 handler instead
 * of polling. GDMA RX channel descriptors
 * are modeled for ADC continuous mode (slice 16): a channel whose
 * IN_PERI_SEL is ADC_DAC consumes APB_SARADC result words into the
 * real 12-byte DMA descriptor format in SRAM, updates descriptor
 * length/owner/SUC_EOF, and raises the RX DONE/SUC_EOF raw bits.
 * The GDMA RX interrupt matrix route is modeled for core 0 too, so
 * RX DONE/SUC_EOF can wake level-1 handlers through
 * DMA_IN_CHn_INT_MAP. Descriptor-starved ADC conversions now latch
 * DSCR_EMPTY instead of disappearing silently after the DMA-owned
 * pool is exhausted. CPU WAITI now parks until modeled level-1
 * interrupts wake it. CPU-owned descriptors now model driver-pool
 * backpressure: by default they latch DSCR_EMPTY and drop the new
 * sample until firmware returns ownership; an emulator-side
 * setAdcContinuousFlushPool(true) knob mirrors ESP-IDF's flush_pool
 * policy by recycling the CPU-owned frame and overwriting old data.
 * RMT channel-0..3 TX now has APB FIFO symbol writes, channel/group
 * dividers for APB/XTAL/RC_FAST clocks, GPIO-matrix output signals
 * 81..84, idle level, TX stop/start/end, TX threshold, finite loop
 * interrupts, group-clock-based TX carrier modulation, and the APB
 * direct-memory TX path behind SYS_CONF.APB_FIFO_MASK with CHnSTATUS
 * write-cursor/read-cursor visibility. TX threshold events re-arm by
 * symbol count after firmware clears INT_RAW, giving the driver refill
 * loop a real interrupt cadence, and direct-memory writes rebuild the
 * not-yet-transmitted waveform so refill ISRs can mutate future
 * symbols. RMT RX channel 0..3 now captures GPIO
 * input-matrix edges into CH4..CH7 APB FIFO symbols, honoring RX
 * limit/threshold and idle completion; RX carrier demodulation honors
 * CHmCONF0 carrier enable/polarity and CHm_RX_CARRIER_RM thresholds so
 * short carrier gaps collapse back into one base pulse. RX direct-memory
 * reads expose CH4..CH7STATUS cursor/error bits and wrap writes when
 * MEM_RX_WRAP_EN is set. RMT TX channel 3 can source symbols from GDMA
 * OUT descriptors when DMA access is enabled, and RMT RX channel 3 can
 * write captured symbols into GDMA IN descriptors, continuing across
 * linked descriptors so partial-receive callbacks can be modeled before
 * the final idle EOF. The first RTC sleep/wake path is modeled too:
 * SLP_TIMER0/1 arm the RTC main-timer alarm, STATE0.SLEEP_EN enters the
 * sleep state, WAKEUP_STATE's TIMER_TRIG source records
 * SLP_WAKEUP_CAUSE, and the RTC_CORE interrupt-matrix source wakes
 * WAITI through the normal level-1 path. RWDT stage-0 INT,
 * COCPU_SW_INT_TRIGGER, host-injected brownout detector trips,
 * XTAL32K-dead watchdog trips, and super-watchdog trips also latch
 * their RTC_CNTL INT_* bits and route through RTC_CORE. XTAL32K-dead
 * can wake light-sleep via the RTC_XTAL32K_DEAD_TRIG_EN wake source too.
 * SUPER_WDT also records its RTC reset flag/feed-interrupt bits,
 * supports the documented feed/flag-clear pulses, and reports reset
 * cause 18 when firmware has not selected BYPASS_RST.
 * Cuts: no driver ringbuffer API yet.
 * Still missing: full light/deep sleep register policy, non-timer wake
 * sources, wake-stub/deep-sleep reset behavior, clock/power-domain
 * gating, and the remaining RTC interrupt producers beyond RWDT/COCPU/
 * brownout/XTAL32K-dead/SUPER_WDT, such as touch and SARADC RTC-domain
 * wake/interrupt paths — so full IDF/FreeRTOS firmware does NOT run yet.
 * Loading Intel-HEX refuses with a message.
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
const GPIO_FUNC0_IN_SEL_CFG = 0x154; // GPIO_FUNCn_IN_SEL_CFG at +4·signal
const GPIO_FUNC0_OUT_SEL_CFG = 0x554; // GPIO_FUNCn_OUT_SEL_CFG at +4·n
const GPIO_FUNC_IN_SEL_LAST = GPIO_FUNC0_OUT_SEL_CFG;
const GPIO_FUNC_IN_SEL_MASK = 0x3f;
const GPIO_FUNC_IN_INV_SEL = 1 << 6;
const GPIO_SIG_IN_SEL = 1 << 7;
const GPIO_FUNC_OUT_SEL_RESET = 0x100;
const GPIO_FUNC_OUT_SEL_MASK = 0x1ff;
const GPIO_FUNC_OUT_INV_SEL = 1 << 9;
const GPIO_FUNC_OUT_CFG_MASK = 0xfff;

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
// interrupt_core0_reg.h / interrupt_core1_reg.h): each peripheral
// source has a 5-bit map register per CPU core selecting which CPU
// interrupt line it drives. Only the modeled sources' maps are wired;
// all reset to 16 — a line the CPU never dispatches, so unmapped
// sources stay silent (matching the headers' reset value).
const INTMTX_BASE = 0x600c2000;
const INTMTX_CORE1_OFFSET = 0x800;
const INTMTX_GPIO_MAP = 0x040; // INTERRUPT_CORE0_GPIO_INTERRUPT_PRO_MAP_REG
const INTMTX_UART_MAP = 0x06c; // INTERRUPT_CORE0_UART_INTR_MAP_REG
const INTMTX_LEDC_MAP = 0x08c; // INTERRUPT_CORE0_LEDC_INT_MAP_REG
const INTMTX_RTC_CORE_MAP = 0x09c; // INTERRUPT_CORE0_RTC_CORE_INTR_MAP_REG
const INTMTX_RMT_MAP = 0x0a0; // INTERRUPT_CORE0_RMT_INTR_MAP_REG
// The six TIMG sources sit contiguously (interrupt_core0_reg.h):
// TG_T0 +0xC8, TG_T1 +0xCC, TG_WDT +0xD0, TG1_T0 +0xD4, TG1_T1
// +0xD8, TG1_WDT +0xDC — group-major, [t0, t1, wdt] within a group.
const INTMTX_TG_MAPS = 0x0c8;
const INTMTX_APB_ADC_MAP = 0x104; // INTERRUPT_CORE0_APB_ADC_INT_MAP_REG
const INTMTX_GDMA_IN_MAPS = 0x108; // DMA_IN_CH0..4 at +0x108..+0x118
const INTMTX_GDMA_OUT_MAPS = 0x11c; // DMA_OUT_CH0..4 at +0x11C..+0x12C
const INTMTX_FROM_CPU_MAPS = 0x13c; // FROM_CPU_INTR0..3 at +0x13C..+0x148
const INTMTX_DEFAULT_MAP = 16;
type InterruptCore = 0 | 1;
type InterruptMapPair = [number, number];
type TimgMapSet = [[number, number, number], [number, number, number]];

const freshInterruptMapPair = (): InterruptMapPair => [INTMTX_DEFAULT_MAP, INTMTX_DEFAULT_MAP];
const freshTimgMapSet = (): TimgMapSet => [
  [INTMTX_DEFAULT_MAP, INTMTX_DEFAULT_MAP, INTMTX_DEFAULT_MAP],
  [INTMTX_DEFAULT_MAP, INTMTX_DEFAULT_MAP, INTMTX_DEFAULT_MAP],
];

// LEDC low-speed PWM (ledc_reg.h / ledc_ll.h). ESP32-S3 has one
// low-speed group: 8 channels, 4 timers. The driver writes the integer
// duty part as duty << 4 and starts output by setting SIG_OUT_EN then
// DUTY_START.
const LEDC_BASE = 0x60019000;
const LEDC_CHANNELS = 8;
const LEDC_TIMERS = 4;
const LEDC_CH_STRIDE = 0x14;
const LEDC_CH_CONF0 = 0x00;
const LEDC_CH_HPOINT = 0x04;
const LEDC_CH_DUTY = 0x08;
const LEDC_CH_CONF1 = 0x0c;
const LEDC_CH_DUTY_R = 0x10;
const LEDC_CH_SIG_OUT_EN = 1 << 2;
const LEDC_CH_IDLE_LV = 1 << 3;
const LEDC_CH_PARA_UP = 1 << 4;
const LEDC_CH_TIMER_SEL_MASK = 0x3;
const LEDC_CH_OVF_NUM_SHIFT = 5;
const LEDC_CH_OVF_NUM_MASK = 0x3ff;
const LEDC_CH_OVF_CNT_EN = 1 << 15;
const LEDC_CH_OVF_CNT_RST = 1 << 16;
const LEDC_CH_OVF_CNT_RST_ST = 1 << 17;
const LEDC_CH_DUTY_SCALE_MASK = 0x3ff;
const LEDC_CH_DUTY_CYCLE_SHIFT = 10;
const LEDC_CH_DUTY_CYCLE_MASK = 0x3ff;
const LEDC_CH_DUTY_NUM_SHIFT = 20;
const LEDC_CH_DUTY_NUM_MASK = 0x3ff;
const LEDC_CH_DUTY_INC = 1 << 30;
const LEDC_CH_DUTY_START = 1 << 31;
const LEDC_LSTIMER_CONF = 0x0a0;
const LEDC_LSTIMER_VALUE = 0x0a4;
const LEDC_LSTIMER_STRIDE = 0x08;
const LEDC_TIMER_DUTY_RES_MASK = 0x0f;
const LEDC_TIMER_CLK_DIV_SHIFT = 4;
const LEDC_TIMER_CLK_DIV_MASK = 0x3ffff;
const LEDC_TIMER_PAUSE = 1 << 22;
const LEDC_TIMER_RST = 1 << 23;
const LEDC_TIMER_PARA_UP = 1 << 25;
const LEDC_LSTIMER_OVF_INT_BASE = 0;
const LEDC_OVF_CNT_INT_BASE = 12;
const LEDC_INT_RAW = 0x0c0;
const LEDC_INT_ST = 0x0c4;
const LEDC_INT_ENA = 0x0c8;
const LEDC_INT_CLR = 0x0cc;
const LEDC_CONF = 0x0d0;
const LEDC_DATE = 0x0fc;
const LEDC_APB_CLK_SEL_MASK = 0x3;
const LEDC_APB_CLK_SEL_APB = 1;
const LEDC_APB_CLK_SEL_RC_FAST = 2;
const LEDC_APB_CLK_SEL_XTAL = 3;
const LEDC_CLK_EN = 1 << 31;
const LEDC_DUTY_MASK = 0x7ffff;
const LEDC_HPOINT_MASK = 0x3fff;
const LEDC_SIGNAL_BASE = 73; // GPIO matrix LEDC_LS_SIG_OUT0_IDX
const LEDC_DIV_FRAC_BITS = 8;
const LEDC_DIV_ONE = 1 << LEDC_DIV_FRAC_BITS;
const LEDC_DATE_RESET = 0x19040200;

// RMT substrate (rmt_reg.h / rmt_ll.h). ESP32-S3 has four TX channels
// (0..3) and four RX channels (hardware 4..7, driver-indexed 0..3).
const RMT_BASE = 0x60016000;
const RMT_TX_CHANNELS = 4;
const RMT_RX_CHANNELS = 4;
const RMT_CHDATA = 0x00;
const RMT_CHDATA_STRIDE = 0x04;
const RMT_CHCONF0 = 0x20;
const RMT_CHCONF0_STRIDE = 0x04;
const RMT_CHMCONF0 = 0x30;
const RMT_CHMCONF_STRIDE = 0x08;
const RMT_CHMCONF1 = 0x34;
const RMT_CHSTATUS = 0x50;
const RMT_CHSTATUS_STRIDE = 0x04;
const RMT_INT_RAW = 0x70;
const RMT_INT_ST = 0x74;
const RMT_INT_ENA = 0x78;
const RMT_INT_CLR = 0x7c;
const RMT_CH_CARRIER_DUTY = 0x80;
const RMT_CH_CARRIER_DUTY_STRIDE = 0x04;
const RMT_CH_TX_LIM = 0x0a0;
const RMT_CH_TX_LIM_STRIDE = 0x04;
const RMT_CH_RX_LIM = 0x0b0;
const RMT_CH_RX_LIM_STRIDE = 0x04;
const RMT_SYS_CONF = 0x0c0;
const RMT_TX_SIM = 0x0c4;
const RMT_REF_CNT_RST = 0x0c8;
const RMT_DATE = 0x0cc;
const RMT_TX_START = 1 << 0;
const RMT_MEM_RD_RST = 1 << 1;
const RMT_APB_MEM_RST = 1 << 2;
const RMT_TX_CONTI_MODE = 1 << 3;
const RMT_MEM_TX_WRAP_EN = 1 << 4;
const RMT_TX_STOP = 1 << 7;
const RMT_DIV_CNT_SHIFT = 8;
const RMT_DIV_CNT_MASK = 0xff;
const RMT_IDLE_OUT_LV = 1 << 5;
const RMT_IDLE_OUT_EN = 1 << 6;
const RMT_MEM_SIZE_SHIFT = 16;
const RMT_MEM_SIZE_MASK = 0x0f;
const RMT_CARRIER_EFF_EN = 1 << 20;
const RMT_CARRIER_EN = 1 << 21;
const RMT_CARRIER_OUT_LV = 1 << 22;
const RMT_DMA_ACCESS_EN = 1 << 25;
const RMT_TX_CONF0_WT_MASK = RMT_TX_START | RMT_MEM_RD_RST | RMT_APB_MEM_RST | RMT_TX_STOP | (1 << 23) | (1 << 24);
const RMT_TX_CONF0_RESET = (2 << RMT_DIV_CNT_SHIFT) | (1 << 16) | (1 << 20) | (1 << 21) | (1 << 22);
const RMT_CARRIER_DUTY_RESET = (64 << 16) | 64;
const RMT_SYS_SCLK_DIV_NUM_SHIFT = 4;
const RMT_SYS_SCLK_DIV_NUM_MASK = 0xff;
const RMT_SYS_SCLK_DIV_A_SHIFT = 12;
const RMT_SYS_SCLK_DIV_A_MASK = 0x3f;
const RMT_SYS_SCLK_DIV_B_SHIFT = 18;
const RMT_SYS_SCLK_DIV_B_MASK = 0x3f;
const RMT_SYS_SCLK_SEL_SHIFT = 24;
const RMT_SYS_SCLK_SEL_MASK = 0x3;
const RMT_SYS_SCLK_SEL_APB = 1;
const RMT_SYS_SCLK_SEL_RC_FAST = 2;
const RMT_SYS_SCLK_SEL_XTAL = 3;
const RMT_SYS_SCLK_ACTIVE = 1 << 26;
const RMT_CLK_EN = 1 << 31;
const RMT_SYS_APB_FIFO_MASK = 1 << 0;
const RMT_SYS_CONF_RESET = (1 << RMT_SYS_SCLK_DIV_NUM_SHIFT) | (RMT_SYS_SCLK_SEL_APB << RMT_SYS_SCLK_SEL_SHIFT) | RMT_SYS_SCLK_ACTIVE;
const RMT_SIGNAL_BASE = 81;
const RMT_DATE_RESET = 0x02100001;
const RMT_TX_LIM_MASK = 0x1ff;
const RMT_TX_LIM_RESET = 128;
const RMT_TX_LOOP_NUM_SHIFT = 9;
const RMT_TX_LOOP_NUM_MASK = 0x3ff;
const RMT_TX_LOOP_CNT_EN = 1 << 19;
const RMT_LOOP_COUNT_RESET = 1 << 20;
const RMT_LOOP_STOP_EN = 1 << 21;
const RMT_RX_EN = 1 << 0;
const RMT_MEM_WR_RST = 1 << 1;
const RMT_RX_APB_MEM_RST = 1 << 2;
const RMT_MEM_OWNER_RX = 1 << 3;
const RMT_RX_FILTER_EN = 1 << 4;
const RMT_RX_FILTER_THRES_SHIFT = 5;
const RMT_RX_FILTER_THRES_MASK = 0xff;
const RMT_MEM_RX_WRAP_EN = 1 << 13;
const RMT_RX_CONF_UPDATE = 1 << 15;
const RMT_RX_CONF1_WT_MASK = RMT_MEM_WR_RST | RMT_RX_APB_MEM_RST | (1 << 14) | RMT_RX_CONF_UPDATE;
const RMT_RX_CONF1_RESET = RMT_MEM_OWNER_RX | (15 << RMT_RX_FILTER_THRES_SHIFT);
const RMT_RX_DIV_CNT_MASK = 0xff;
const RMT_RX_IDLE_THRES_SHIFT = 8;
const RMT_RX_IDLE_THRES_MASK = 0x7fff;
const RMT_RX_DMA_ACCESS_EN = 1 << 23;
const RMT_RX_MEM_SIZE_SHIFT = 24;
const RMT_RX_MEM_SIZE_MASK = 0x0f;
const RMT_RX_CARRIER_EN = 1 << 28;
const RMT_RX_CARRIER_OUT_LV = 1 << 29;
const RMT_RX_CONF0_RESET = 2 | (RMT_RX_IDLE_THRES_MASK << RMT_RX_IDLE_THRES_SHIFT) | (1 << RMT_RX_MEM_SIZE_SHIFT) | (1 << 28) | (1 << 29);
const RMT_RX_LIM_MASK = 0x1ff;
const RMT_RX_LIM_RESET = 128;
const RMT_CH_RX_CARRIER_RM = 0x90;
const RMT_CH_RX_CARRIER_RM_STRIDE = 0x04;
const RMT_RX_CARRIER_RM_RESET = 0;
const RMT_RX_CARRIER_THRES_MASK = 0xffff;
const RMT_RX_END_INT_BASE = 16;
const RMT_RX_ERR_INT_BASE = 20;
const RMT_RX_THR_INT_BASE = 24;
const RMT_RX_SYMBOLS_PER_BLOCK = 48;
const RMT_TX_SYMBOLS_PER_BLOCK = 48;

// Timer groups 0 and 1 (timer_group_reg.h; flow per hal timer_ll.h
// and the gptimer driver): each group has two 54-bit general-purpose
// timers counting APB ticks (80 MHz — soc.h APB_CLK_FREQ) through a
// 16-bit prescaler (field value 0 means 65536; the HAL only programs
// 2..65536). T1's register block is T0's shifted by +0x24. The
// alarm-enable bit is cleared BY HARDWARE when the alarm fires —
// gptimer's ISR re-arms it for periodic use.
const TIMG0_BASE = 0x6001f000;
const TIMG1_BASE = 0x60020000; // reg_base.h DR_REG_TIMERGROUP1_BASE
const TIMG_T0CONFIG = 0x00; // EN 31, INCREASE 30, AUTORELOAD 29, DIVIDER [28:13], ALARM_EN 10
const TIMG_T0LO = 0x04;
const TIMG_T0HI = 0x08;
const TIMG_T0UPDATE = 0x0c;
const TIMG_T0ALARMLO = 0x10;
const TIMG_T0ALARMHI = 0x14;
const TIMG_T0LOADLO = 0x18;
const TIMG_T0LOADHI = 0x1c;
const TIMG_T0LOAD = 0x20;
const TIMG_T1_SHIFT = 0x24; // T1CONFIG..T1LOAD = T0's offsets + 0x24
const TIMG_INT_ENA = 0x70; // bits: T0=0, T1=1, WDT=2 in all four
const TIMG_INT_RAW = 0x74;
const TIMG_INT_ST = 0x78;
const TIMG_INT_CLR = 0x7c;
const T_EN = 1 << 31;
const T_INCREASE = 1 << 30;
const T_AUTORELOAD = 1 << 29;
const T_ALARM_EN = 1 << 10;
const T_ARMED = T_EN | T_ALARM_EN;
/** CPU cycles per APB tick: 240 MHz over 80 MHz. */
const CYCLES_PER_APB = 3;
const T_MASK = 2 ** 54; // the counters are 54 bits wide

// ── Slice 13: watchdogs ──
// MWDT — one per TIMG group (timer_group_reg.h): WDTCONFIG0 +0x48
// (EN 31, STG0..3 at [30:29]/[28:27]/[26:25]/[24:23],
// FLASHBOOT_MOD_EN 14 — reset 1, stored but inert here),
// WDTCONFIG1 +0x4C (CLK_PRESCALE [31:16], reset 1 — the MWDT clock
// is APB/prescale), WDTCONFIG2..5 +0x50..0x5C (stage0..3 timeouts in
// MWDT ticks), WDTFEED +0x60 ("write any value" feeds), WDTWPROTECT
// +0x64 (TIMG_WDT_WKEY_VALUE 0x50D83AA1; resets UNLOCKED — the key
// itself — so boot code can configure before protecting). Config
// writes under a wrong key are silently ignored, like hardware.
const TIMG_WDTCONFIG0 = 0x48;
const TIMG_WDTCONFIG1 = 0x4c;
const TIMG_WDTCONFIG2 = 0x50; // ..+0x5C: stage0..3
const TIMG_WDTFEED = 0x60;
const TIMG_WDTWPROTECT = 0x64;
const WDT_WKEY = 0x50d83aa1; // TIMG_WDT_WKEY_VALUE = RWDT_LL_WDT_WKEY_VALUE
const WDT_EN = 1 << 31;
const TIMG_WDT_INT = 1 << 2; // INT_* bit 2
const MWDT_CONFIG0_RESET = 1 << 14; // FLASHBOOT_MOD_EN (inert cut)
const MWDT_CONFIG1_RESET = 1 << 16; // CLK_PRESCALE = 1
// Stage actions (hal/wdt_types.h wdt_stage_action_t):
const WDT_STAGE_INT = 1;
const WDT_STAGE_RESET_CPU = 2;
const WDT_STAGE_RESET_SYSTEM = 3;
const WDT_STAGE_RESET_RTC = 4; // RWDT only
// RWDT — RTC_CNTL (rtc_cntl_reg.h): WDTCONFIG0 +0x98 (EN 31, STG0..3
// at [30:28]/[27:25]/[24:22]/[21:19] — 3-bit fields, since action 4
// exists), WDTCONFIG1..4 +0x9C..0xA8 (stage0..3 timeouts in RTC-slow
// ticks — the modeled ~136 kHz RC_SLOW; the eFuse stage-0 tick
// multiplier rwdt_ll.h compensates for is NOT modeled, raw ticks),
// WDTFEED +0xAC (bit 31), WDTWPROTECT +0xB0 (same 0x50D83AA1 key —
// hal/esp32s3/include/hal/rwdt_ll.h). Reset value keeps the header's
// FLASHBOOT_MOD_EN(12)/PAUSE_IN_SLP(9)/reset-length defaults, all
// inert here.
const RTC_WDTCONFIG0 = 0x98;
const RTC_WDTCONFIG1 = 0x9c; // ..+0xA8: stage0..3
const RTC_WDTFEED = 0xac;
const RTC_WDTWPROTECT = 0xb0;
const RTC_SWD_CONF = 0xb4;
const RTC_SWD_WPROTECT = 0xb8;
const RTC_COCPU_CTRL = 0x104;
const RTC_BROWN_OUT = 0xe8;
const RTC_WDT_FEED_BIT = 1 << 31; // RTC_CNTL_RTC_WDT_FEED
const RTC_SWD_WKEY = 0x8f1d312a;
const RTC_SWD_DISABLE = 1 << 30;
const RTC_SWD_FEED = 1 << 29;
const RTC_SWD_RST_FLAG_CLR = 1 << 28;
const RTC_SWD_BYPASS_RST = 1 << 17;
const RTC_SWD_FEED_INT = 1 << 1;
const RTC_SWD_RESET_FLAG = 1 << 0;
const RTC_SWD_CONF_RESET = 300 << 18;
const RTC_COCPU_SW_INT_TRIGGER = 1 << 26;
const RTC_BROWN_OUT_DET = 1 << 31;
const RTC_BROWN_OUT_ENA = 1 << 30;
const RTC_BROWN_OUT_CNT_CLR = 1 << 29;
const RTC_BROWN_OUT_RST_ENA = 1 << 26;
const RTC_BROWN_OUT_RESET = (RTC_BROWN_OUT_ENA | (0x3ff << 16) | (1 << 4)) >>> 0;
const RWDT_CONFIG0_RESET = ((1 << 16) | (1 << 13) | (1 << 12) | (1 << 9)) >>> 0;

// SAR ADC1/ADC2 oneshot paths (sens_reg.h; flow per
// hal/esp32s3/adc_ll.h — the same register dance adc_oneshot_ll_* and
// analogRead perform): SENS_SAR_MEASx_CTRL2 holds MEASx_DATA_SAR
// [15:0], MEASx_DONE_SAR bit 16, MEASx_START_SAR bit 17 (a 0→1 edge
// starts a conversion), MEASx_START_FORCE bit 18, SARx_EN_PAD
// [30:19] (one-hot channel select, written as 1<<channel), and
// SARx_EN_PAD_FORCE bit 31.
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
  0x40000720: 'ets_set_appcpu_boot_addr', // slice 12 — releases core 1
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

// ── Slice 11: RTC_CNTL / eFuse / SYSTEM ──
// Bases from reg_base.h (DR_REG_EFUSE_BASE / DR_REG_RTCCNTL_BASE /
// DR_REG_SYSTEM_BASE); offsets and fields from rtc_cntl_reg.h,
// efuse_reg.h, system_reg.h — all esp-idf v5.2
// components/soc/esp32s3/include/soc/. Policy for these three blocks:
// reads of unmodeled registers REFUSE with a diagnostic (a benign
// zero would silently lie — 0 in RTC_CNTL_WDTCONFIG0 claims "watchdog
// off"); unmodeled writes are accepted and dropped, consistent with
// the other peripheral blocks (a dropped config write cannot steer
// firmware logic the way a fabricated read can).
const RTCCNTL_BASE = 0x60008000;
const RTCCNTL_END = 0x60008800; // SENS sits at +0x800
const RTC_OPTIONS0 = 0x00; // SW_SYS_RST bit 31, SW_PROCPU_RST bit 5, SW_APPCPU_RST bit 4 (all WO)
const RTC_SLP_TIMER0 = 0x04; // SLP_VAL_LO [31:0]
const RTC_SLP_TIMER1 = 0x08; // SLP_VAL_HI [15:0], MAIN_TIMER_ALARM_EN bit 16 (WO)
const RTC_TIME_UPDATE = 0x0c; // TIME_UPDATE bit 31 latches the main timer
const RTC_TIME_LOW0 = 0x10; // latched timer [31:0]
const RTC_TIME_HIGH0 = 0x14; // latched timer [47:32] in [15:0]
const RTC_STATE0 = 0x18; // SLEEP_EN/SLP_WAKEUP/SLP_REJECT status and command bits
const RTC_RESET_STATE = 0x38; // RESET_CAUSE_PROCPU [5:0], RESET_CAUSE_APPCPU [11:6]
const RTC_WAKEUP_STATE = 0x3c; // WAKEUP_ENA [31:15], raw trigger bitmap
const RTC_INT_ENA = 0x40;
const RTC_INT_RAW = 0x44;
const RTC_INT_ST = 0x48;
const RTC_INT_CLR = 0x4c;
const RTC_EXT_XTL_CONF = 0x60;
const RTC_SW_SYS_RST = 1 << 31;
const RTC_SW_PROCPU_RST = 1 << 5;
const RTC_MAIN_TIMER_ALARM_EN = 1 << 16;
const RTC_SLP_VAL_HI_MASK = 0xffff;
const RTC_SLEEP_EN = 1 << 31;
const RTC_SLP_WAKEUP = 1 << 29;
const RTC_SLP_REJECT_CAUSE_CLR = 1 << 1;
const RTC_SW_CPU_INT = 1 << 0;
const RTC_WAKEUP_ENA_SHIFT = 15;
const RTC_WAKEUP_ENA_MASK = 0x1ffff;
const RTC_WAKEUP_STATE_RESET = 0x000c << RTC_WAKEUP_ENA_SHIFT; // rtc_cntl_reg.h default: 17'b1100
const RTC_SLP_WAKEUP_INT = 1 << 0;
const RTC_SLP_REJECT_INT = 1 << 1;
const RTC_WDT_INT = 1 << 3;
const RTC_BROWN_OUT_INT = 1 << 9;
const RTC_COCPU_INT = 1 << 13;
const RTC_SWD_INT = 1 << 15;
const RTC_XTAL32K_DEAD_INT = 1 << 16;
const RTC_MAIN_TIMER_INT = 1 << 10;
const RTC_XTAL32K_CONF = 0xf8;
const RTC_SLP_REJECT_CAUSE = 0x128;
const RTC_SLP_WAKEUP_CAUSE = 0x130;
const RTC_INT_ENA_W1TS = 0x138;
const RTC_INT_ENA_W1TC = 0x13c;
const RTC_TIMER_TRIG_EN = 1 << 3; // components/esp_hw_support/port/esp32s3/include/soc/rtc.h
const RTC_XTAL32K_DEAD_TRIG_EN = 1 << 12;
const RTC_XTAL32K_WDT_EN = 1 << 0;
const RTC_XTAL32K_WDT_RESET = 1 << 2;
const RTC_EXT_XTL_CONF_RESET = ((3 << 17) | (3 << 13) | (3 << 10) | (1 << 7)) >>> 0;
const RTC_XTAL32K_CONF_RESET = 0xff << 20;
// Reset causes (esp_rom/include/esp32s3/rom/rtc.h RESET_REASON —
// static-asserted equal to soc_reset_reason_t, the values
// esp_rom_get_reset_reason/esp_reset_reason consume):
const RESET_CAUSE_POWERON = 1; // POWERON_RESET
const RESET_CAUSE_SW_SYS = 3; // RTC_SW_SYS_RESET — ROM software_reset / SW_SYS_RST
const RESET_CAUSE_SW_CPU = 12; // RTC_SW_CPU_RESET — SW_PROCPU_RST (esp_restart's path)
// Watchdog reset causes (same rom/rtc.h enum — slice 13):
const RESET_CAUSE_TG0WDT_SYS = 7; // TG0WDT_SYS_RESET
const RESET_CAUSE_TG1WDT_SYS = 8; // TG1WDT_SYS_RESET
const RESET_CAUSE_RTCWDT_SYS = 9; // RTCWDT_SYS_RESET
const RESET_CAUSE_TG0WDT_CPU = 11; // TG0WDT_CPU_RESET
const RESET_CAUSE_RTCWDT_CPU = 13; // RTCWDT_CPU_RESET
const RESET_CAUSE_BROWNOUT = 15; // RTCWDT_BROWN_OUT_RESET
const RESET_CAUSE_RTCWDT_RTC = 16; // RTCWDT_RTC_RESET
const RESET_CAUSE_TG1WDT_CPU = 17; // TG1WDT_CPU_RESET
const RESET_CAUSE_SUPER_WDT = 18; // SUPER_WDT_RESET
// The RTC main timer counts the ~136 kHz RC_SLOW clock
// (clk_tree_defs.h SOC_CLK_RC_SLOW_FREQ_APPROX). 48 bits wide.
const RTC_SLOW_HZ = 136_000;

const EFUSE_BASE = 0x60007000;
const EFUSE_PGM_DATA_0 = 0x00;
const EFUSE_PGM_DATA_WORDS = 8;
const EFUSE_PGM_CHECK_VALUE_0 = 0x20;
const EFUSE_PGM_CHECK_WORDS = 3;
const EFUSE_RD_WR_DIS = 0x2c;
const EFUSE_RD_REPEAT_DATA_4 = 0x40;
const EFUSE_RD_MAC_SPI_SYS_0 = 0x44; // BLOCK1 word 0: MAC[31:0]
const EFUSE_RD_MAC_SPI_SYS_5 = 0x58; // BLOCK1 word 5: wafer/pkg/cal fields
const EFUSE_RD_SYS_PART1_DATA_0 = 0x5c; // BLK2 starts here; BLK2..10 are 8 words each
const EFUSE_RD_SYS_PART2_DATA_7 = 0x178;
const EFUSE_RD_REPEAT_ERR_0 = 0x17c;
const EFUSE_RD_REPEAT_ERR_4 = 0x190;
const EFUSE_RD_RS_ERR_0 = 0x1c0;
const EFUSE_RD_RS_ERR_1 = 0x1c4;
const EFUSE_CLK = 0x1c8;
const EFUSE_CONF = 0x1cc;
const EFUSE_STATUS = 0x1d0;
const EFUSE_CMD = 0x1d4;
const EFUSE_INT_RAW = 0x1d8;
const EFUSE_INT_ST = 0x1dc;
const EFUSE_INT_ENA = 0x1e0;
const EFUSE_INT_CLR = 0x1e4;
const EFUSE_DAC_CONF = 0x1e8;
const EFUSE_RD_TIM_CONF = 0x1ec;
const EFUSE_WR_TIM_CONF1 = 0x1f4;
const EFUSE_WR_TIM_CONF2 = 0x1f8;
const EFUSE_DATE = 0x1fc;
const EFUSE_WRITE_OP_CODE = 0x5a5a;
const EFUSE_READ_OP_CODE = 0x5aa5;
const EFUSE_READ_CMD = 1 << 0;
const EFUSE_PGM_CMD = 1 << 1;
const EFUSE_BLK_NUM_SHIFT = 2;
const EFUSE_BLK_NUM_MASK = 0xf << EFUSE_BLK_NUM_SHIFT;
const EFUSE_DONE_INTS = EFUSE_READ_CMD | EFUSE_PGM_CMD;
const EFUSE_BLOCK_COUNT = 11;
const EFUSE_BLOCK_WORDS = 8;
const EFUSE_DAC_CONF_RESET = (0xff << 9) | 28;
const EFUSE_RD_TIM_CONF_RESET = 18 << 24;
const EFUSE_WR_TIM_CONF1_RESET = 10368 << 8;
const EFUSE_WR_TIM_CONF2_RESET = 400;
const EFUSE_DATE_RESET = 34_607_760;
// SYNTHETIC MAC, documented: 7A:C0:DE:00:53:33 — locally-administered
// unicast (first octet bit 1 set, bit 0 clear), "C0DE"/"S3" mnemonic.
// efuse_hal_get_mac byte order: mac[0]=mac_1>>8, mac[1]=mac_1&0xff,
// mac[2..5]=mac_0 big-endian.
const EFUSE_MAC_0 = 0xde005333;
const EFUSE_MAC_1 = 0x00007ac0;

const SYSTEM_BASE = 0x600c0000;
const SYSTEM_CPU_PER_CONF = 0x10; // CPUPERIOD_SEL [1:0], PLL_FREQ_SEL bit 2
const SYSTEM_SYSCLK_CONF = 0x60; // PRE_DIV_CNT [9:0], SOC_CLK_SEL [11:10], CLK_XTAL_FREQ [18:12] (RO)
// The modeled values are the POST-2nd-stage-bootloader state (this
// core boots app images the way the bootloader leaves the chip, with
// the PLL already up), not the power-on reset values (XTAL/40 MHz):
// PLL_FREQ_SEL=1 (480 MHz PLL) + CPUPERIOD_SEL=2 → CPU 240 MHz, and
// SOC_CLK_SEL=1 (PLL) + PRE_DIV_CNT=1 + CLK_XTAL_FREQ=40 — exactly
// what rtc_clk_cpu_freq_get derives the modeled 240 MHz from.
const SYSTEM_CPU_PER_CONF_RESET = 0x6;
const SYSTEM_SYSCLK_CONF_RESET = (40 << 12) | (1 << 10) | 1; // 0x28401
const SYSTEM_CLK_XTAL_FREQ_MASK = 0x7f << 12; // RO field — writes can't touch it

// ── Slice 12: the second core (APP CPU) ──
// SYSTEM_CORE_1_CONTROL_0_REG sits at DR_REG_SYSTEM_BASE + 0x0
// (system_reg.h, esp-idf v5.2): RUNSTALL bit 0 (default 0),
// CLKGATE_EN bit 1 (default 0), RESETING bit 2 — the header's own
// spelling — default 1, i.e. core 1 is held in reset at power-on.
// CONTROL_1 (+0x4) is the 32-bit MESSAGE scratch word. IDF's
// start_other_core (esp_system/port/cpu_start.c) releases it:
// esp_cpu_unstall(1) → CLKGATE_EN set, RUNSTALL cleared, RESETING
// pulsed 1→0 → ets_set_appcpu_boot_addr(call_start_cpu1). The real
// ROM parks core 1 in a wait loop until that boot address is
// non-zero, then jumps to it — modeled as: core 1 starts executing
// at the stored address once all release conditions hold.
const SYSTEM_CORE_1_CTRL0 = 0x0;
const SYSTEM_CORE_1_CTRL1 = 0x4;
const SYSTEM_CPU_INTR_FROM_CPU = 0x30;
const SYSTEM_CPU_INTR_FROM_CPU_COUNT = 4;
const CORE1_RUNSTALL = 1 << 0;
const CORE1_CLKGATE_EN = 1 << 1;
const CORE1_RESETING = 1 << 2;
// esp_cpu_unstall/stall drive a split stall code (0x86 = stalled):
// C0 [1:0] of RTC_CNTL_OPTIONS0 (=0x2) + C1 [25:20] of
// RTC_CNTL_SW_CPU_STALL_REG at +0xBC (=0x21), per rtc_cntl_reg.h
// and esp_hw_support/cpu.c.
const RTC_SW_CPU_STALL = 0xbc;
const RTC_SW_APPCPU_RST = 1 << 4; // OPTIONS0 bit 4, WO — resets core 1 only
const STALL_APPCPU_C0_MASK = 0x3; // OPTIONS0 [1:0]
const STALL_C0_CODE = 0x2;
const STALL_C1_CODE = 0x21;
/** SYNTHETIC reset SP for raw core-1 programs — 16 KiB below the
 *  DRAM top so it cannot collide with core 0's reset stack (real
 *  call_start_cpu1 establishes its own stack immediately). */
const CORE1_RESET_SP = 0x4000;

const SENS_BASE = 0x60008800;
const SENS_SAR_MEAS1_CTRL2 = 0x0c;
const SENS_SAR_MEAS2_CTRL2 = 0x30;
const MEAS1_DONE_SAR = 1 << 16;
const MEAS1_START_SAR = 1 << 17;
const MEAS2_DONE_SAR = 1 << 16;
const MEAS2_START_SAR = 1 << 17;
// 12-bit result. Attenuation is not modeled: full scale is the 3.3 V
// supply, quantized like the RP2040 core does.
const ADC_VREF = 3.3;
const ADC_MAX = 4095;
// The McuCore ADC sampler/read-log surface is one-dimensional. Keep
// ADC1 as 0..9, expose ADC2 as 10..19 (ADC2 channel n = GPIO n+11).
const ADC2_SAMPLER_CHANNEL_BASE = 10;

// APB_SARADC digital controller (reg_base.h / apb_saradc_reg.h).
// Paired below with the first GDMA RX descriptor path for ADC
// continuous frames.
const APB_SARADC_BASE = 0x60040000;
const APB_SARADC_CTRL = 0x00;
const APB_SARADC_CTRL2 = 0x04;
const APB_SARADC_FSM_WAIT = 0x0c;
const APB_SARADC_SAR1_STATUS = 0x10;
const APB_SARADC_SAR2_STATUS = 0x14;
const APB_SARADC_SAR1_PATT_TAB1 = 0x18;
const APB_SARADC_SAR2_PATT_TAB1 = 0x28;
const APB_SARADC_APB_ADC_ARB_CTRL = 0x38;
const APB_SARADC_FILTER_CTRL0 = 0x3c;
const APB_SARADC_APB_SARADC1_DATA_STATUS = 0x40;
const APB_SARADC_THRES0_CTRL = 0x44;
const APB_SARADC_THRES1_CTRL = 0x48;
const APB_SARADC_THRES_CTRL = 0x58;
const APB_SARADC_INT_ENA = 0x5c;
const APB_SARADC_INT_RAW = 0x60;
const APB_SARADC_INT_ST = 0x64;
const APB_SARADC_INT_CLR = 0x68;
const APB_SARADC_DMA_CONF = 0x6c;
const APB_SARADC_APB_ADC_CLKM_CONF = 0x70;
const APB_SARADC_APB_SARADC2_DATA_STATUS = 0x78;
const APB_SARADC_APB_CTRL_DATE = 0x3fc;
const APB_SARADC_CTRL_RESET = 0x407f8240;
const APB_SARADC_CTRL2_RESET = 0xa1fe;
const APB_SARADC_FSM_WAIT_RESET = 0xff0808;
const APB_SARADC_CLKM_CONF_RESET = 0x04;
const APB_SARADC_DATE_RESET = 0x02101180;
const APB_SARADC_TIMER_EN = 1 << 24;
const APB_SARADC_START = 1 << 1;
const APB_SARADC_SAR2_PATT_P_CLEAR = 1 << 24;
const APB_SARADC_SAR1_PATT_P_CLEAR = 1 << 23;
const APB_SARADC_INT_ADC1_DONE = 1 << 31;
const APB_SARADC_INT_ADC2_DONE = 1 << 30;
const APB_SARADC_INT_THRES0_HIGH = 1 << 29;
const APB_SARADC_INT_THRES1_HIGH = 1 << 28;
const APB_SARADC_INT_THRES0_LOW = 1 << 27;
const APB_SARADC_INT_THRES1_LOW = 1 << 26;
const APB_SARADC_DMA_RESET_FSM = 1 << 30;
const APB_SARADC_THRES_VALUE_MASK = 0x1fff;
const APB_SARADC_THRES_HIGH_SHIFT = 5;
const APB_SARADC_THRES_LOW_SHIFT = 18;
const APB_SARADC_THRES_CHANNEL_MASK = 0x1f;
const APB_SARADC_THRES0_EN = 1 << 31;
const APB_SARADC_THRES1_EN = 1 << 30;
const APB_SARADC_THRES_ALL_EN = 1 << 27;

// GDMA channel substrate for ADC continuous frames and RMT DMA TX
// (gdma_reg.h). RX channel n selects peripheral 8 (ADC_DAC), starts
// from a 20-bit inlink descriptor address, and fills 12-byte DMA
// descriptors in SRAM. OUT channel n can select peripheral 9 (RMT),
// start from a 20-bit outlink descriptor, and feed RMT TX symbols.
const GDMA_BASE = 0x6003f000;
const GDMA_CHANNELS = 5;
const GDMA_RX_CHANNELS = GDMA_CHANNELS;
const GDMA_CH_STRIDE = 0xc0;
const GDMA_IN_CONF0 = 0x00;
const GDMA_IN_CONF1 = 0x04;
const GDMA_IN_INT_RAW = 0x08;
const GDMA_IN_INT_ST = 0x0c;
const GDMA_IN_INT_ENA = 0x10;
const GDMA_IN_INT_CLR = 0x14;
const GDMA_IN_LINK = 0x20;
const GDMA_IN_STATE = 0x24;
const GDMA_IN_SUC_EOF_DES_ADDR = 0x28;
const GDMA_IN_ERR_EOF_DES_ADDR = 0x2c;
const GDMA_IN_DSCR = 0x30;
const GDMA_IN_DSCR_BF0 = 0x34;
const GDMA_IN_DSCR_BF1 = 0x38;
const GDMA_IN_WEIGHT = 0x3c;
const GDMA_IN_PRI = 0x44;
const GDMA_IN_PERI_SEL = 0x48;
const GDMA_OUT_CONF0 = 0x60;
const GDMA_OUT_CONF1 = 0x64;
const GDMA_OUT_INT_RAW = 0x68;
const GDMA_OUT_INT_ST = 0x6c;
const GDMA_OUT_INT_ENA = 0x70;
const GDMA_OUT_INT_CLR = 0x74;
const GDMA_OUT_LINK = 0x80;
const GDMA_OUT_STATE = 0x84;
const GDMA_OUT_EOF_DES_ADDR = 0x88;
const GDMA_OUT_EOF_BFR_DES_ADDR = 0x8c;
const GDMA_OUT_DSCR = 0x90;
const GDMA_OUT_DSCR_BF0 = 0x94;
const GDMA_OUT_DSCR_BF1 = 0x98;
const GDMA_OUT_WEIGHT = 0x9c;
const GDMA_OUT_PRI = 0xa4;
const GDMA_OUT_PERI_SEL = 0xa8;
const GDMA_IN_RST = 1 << 0;
const GDMA_IN_DONE_INT = 1 << 0;
const GDMA_IN_SUC_EOF_INT = 1 << 1;
const GDMA_IN_DSCR_ERR_INT = 1 << 3;
const GDMA_IN_DSCR_EMPTY_INT = 1 << 4;
const GDMA_OUT_RST = 1 << 0;
const GDMA_OUT_DONE_INT = 1 << 0;
const GDMA_OUT_EOF_INT = 1 << 1;
const GDMA_OUT_DSCR_ERR_INT = 1 << 2;
const GDMA_OUT_TOTAL_EOF_INT = 1 << 3;
const GDMA_INLINK_ADDR_MASK = 0x000f_ffff;
const GDMA_INLINK_AUTO_RET = 1 << 20;
const GDMA_INLINK_STOP = 1 << 21;
const GDMA_INLINK_START = 1 << 22;
const GDMA_INLINK_RESTART = 1 << 23;
const GDMA_INLINK_PARK = 1 << 24;
const GDMA_OUTLINK_ADDR_MASK = 0x000f_ffff;
const GDMA_OUTLINK_STOP = 1 << 20;
const GDMA_OUTLINK_START = 1 << 21;
const GDMA_OUTLINK_RESTART = 1 << 22;
const GDMA_OUTLINK_PARK = 1 << 23;
const GDMA_PERI_ADC_DAC = 8;
const GDMA_PERI_RMT = 9;
const GDMA_PERI_NONE = 0x3f;
const GDMA_DESC_SIZE_MASK = 0xfff;
const GDMA_DESC_LENGTH_MASK = 0xfff << 12;
const GDMA_DESC_SUC_EOF = 1 << 30;
const GDMA_DESC_OWNER_DMA = 1 << 31;
const ADC_DIGI_RESULT_BYTES = 4;

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

/** One 54-bit general-purpose timer (T0 or T1 of either group). The
 *  counter is virtual: `base` is its value at core-0 cycle `sync`,
 *  and the live value derives from elapsed cycles. */
interface GpTimer {
  config: number;
  base: number;
  sync: number;
  latchLo: number; // captured by an UPDATE write
  latchHi: number;
  alarmLo: number;
  alarmHi: number;
  loadLo: number;
  loadHi: number;
}

/** One watchdog (MWDT or RWDT). `epoch` is the core-0 cycle of the
 *  last feed; `handled` counts stages already expired since then. */
interface Watchdog {
  config0: number;
  config1: number; // MWDT only: CLK_PRESCALE [31:16]
  timeouts: number[]; // stage0..3, in WDT ticks
  wprotect: number; // last WPROTECT write; === WDT_WKEY means unlocked
  epoch: number;
  handled: number;
}

/** One TIMG group: two timers, one MWDT, the shared INT_* regs, and
 *  per-core interrupt-matrix maps [t0, t1, wdt]. */
interface TimgGroup {
  timers: GpTimer[];
  wdt: Watchdog;
  intEna: number;
  intRaw: number;
  maps: TimgMapSet;
}

interface LedcTimer {
  conf: number;
  base: number;
  sync: number;
  ovfSerial: number;
}

interface LedcFade {
  baseDuty: number;
  startSerial: number;
  latchedSteps: number;
}

interface LedcChannel {
  conf0: number;
  hpoint: number;
  duty: number;
  conf1: number;
  dutyRead: number;
  ovfSerial: number;
  fade: LedcFade | null;
}

interface RmtTxSegment {
  endCycle: number;
  level: DigitalLevel;
}

interface RmtTxChannel {
  conf0: number;
  txLim: number;
  carrierDuty: number;
  fifo: number[];
  memory: number[];
  apbWriteCursor: number;
  apbWriteError: boolean;
  startCycle: number;
  durationCycles: number;
  segments: RmtTxSegment[];
  symbolEndCycles: number[];
  active: boolean;
  nextThresholdSymbol: number;
  loopFired: boolean;
}

interface RmtRxHalfPulse {
  duration: number;
  level: DigitalLevel;
}

interface RmtRxChannel {
  conf0: number;
  conf1: number;
  rxLim: number;
  carrierRm: number;
  memory: number[];
  writeCursor: number;
  readCursor: number;
  capturedSymbols: number;
  memoryFull: boolean;
  apbReadError: boolean;
  pending: RmtRxHalfPulse | null;
  active: boolean;
  started: boolean;
  rawCycle: number;
  rawLevel: DigitalLevel;
  lastCycle: number;
  lastLevel: DigitalLevel;
  thresholdFired: boolean;
}

interface GdmaRxChannel {
  conf0: number;
  conf1: number;
  intRaw: number;
  intEna: number;
  inLink: number;
  currentDesc: number;
  sucEofDesc: number;
  errEofDesc: number;
  descBf0: number;
  descBf1: number;
  weight: number;
  pri: number;
  periSel: number;
  maps: InterruptMapPair;
  offset: number;
  active: boolean;
  started: boolean;
}

interface GdmaTxChannel {
  conf0: number;
  conf1: number;
  intRaw: number;
  intEna: number;
  outLink: number;
  currentDesc: number;
  eofDesc: number;
  eofBfrDesc: number;
  descBf0: number;
  descBf1: number;
  weight: number;
  pri: number;
  periSel: number;
  maps: InterruptMapPair;
  active: boolean;
  started: boolean;
}

const freshGpTimer = (): GpTimer => ({
  config: 0,
  base: 0,
  sync: 0,
  latchLo: 0,
  latchHi: 0,
  alarmLo: 0,
  alarmHi: 0,
  loadLo: 0,
  loadHi: 0,
});

const freshWatchdog = (config0Reset: number, config1Reset: number): Watchdog => ({
  config0: config0Reset,
  config1: config1Reset,
  timeouts: [0, 0, 0, 0],
  wprotect: WDT_WKEY, // hardware resets UNLOCKED (WPROTECT holds the key)
  epoch: 0,
  handled: 0,
});

const freshTimgGroup = (): TimgGroup => ({
  timers: [freshGpTimer(), freshGpTimer()],
  wdt: freshWatchdog(MWDT_CONFIG0_RESET, MWDT_CONFIG1_RESET),
  intEna: 0,
  intRaw: 0,
  maps: freshTimgMapSet(),
});

const freshLedcTimer = (): LedcTimer => ({
  conf: LEDC_TIMER_RST,
  base: 0,
  sync: 0,
  ovfSerial: 0,
});

const freshLedcChannel = (): LedcChannel => ({
  conf0: 0,
  hpoint: 0,
  duty: 0,
  conf1: 1 << 30,
  dutyRead: 0,
  ovfSerial: 0,
  fade: null,
});

const freshRmtTxChannel = (): RmtTxChannel => ({
  conf0: RMT_TX_CONF0_RESET,
  txLim: RMT_TX_LIM_RESET,
  carrierDuty: RMT_CARRIER_DUTY_RESET,
  fifo: [],
  memory: [],
  apbWriteCursor: 0,
  apbWriteError: false,
  startCycle: 0,
  durationCycles: 0,
  segments: [],
  symbolEndCycles: [],
  active: false,
  nextThresholdSymbol: 0,
  loopFired: false,
});

const freshRmtRxChannel = (): RmtRxChannel => ({
  conf0: RMT_RX_CONF0_RESET,
  conf1: RMT_RX_CONF1_RESET,
  rxLim: RMT_RX_LIM_RESET,
  carrierRm: RMT_RX_CARRIER_RM_RESET,
  memory: [],
  writeCursor: 0,
  readCursor: 0,
  capturedSymbols: 0,
  memoryFull: false,
  apbReadError: false,
  pending: null,
  active: false,
  started: false,
  rawCycle: 0,
  rawLevel: 0,
  lastCycle: 0,
  lastLevel: 0,
  thresholdFired: false,
});

const freshGdmaRx = (): GdmaRxChannel => ({
  conf0: 0,
  conf1: 0x0c, // INFIFO_FULL threshold reset from gdma_reg.h
  intRaw: 0,
  intEna: 0,
  inLink: GDMA_INLINK_AUTO_RET,
  currentDesc: 0,
  sucEofDesc: 0,
  errEofDesc: 0,
  descBf0: 0,
  descBf1: 0,
  weight: 0x0f00,
  pri: 0,
  periSel: GDMA_PERI_NONE,
  maps: freshInterruptMapPair(),
  offset: 0,
  active: false,
  started: false,
});

const freshGdmaTx = (): GdmaTxChannel => ({
  conf0: 0,
  conf1: 0,
  intRaw: 0,
  intEna: 0,
  outLink: 0,
  currentDesc: 0,
  eofDesc: 0,
  eofBfrDesc: 0,
  descBf0: 0,
  descBf1: 0,
  weight: 0x0f00,
  pri: 0,
  periSel: GDMA_PERI_NONE,
  maps: freshInterruptMapPair(),
  active: false,
  started: false,
});

const freshEfuseBlocks = (): number[][] => {
  const blocks = Array.from({ length: EFUSE_BLOCK_COUNT }, () => Array(EFUSE_BLOCK_WORDS).fill(0) as number[]);
  const macBlock = blocks[1];
  if (macBlock === undefined) throw new Error('freshEfuseBlocks failed to allocate BLOCK1');
  macBlock[0] = EFUSE_MAC_0;
  macBlock[1] = EFUSE_MAC_1;
  return blocks;
};

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
  /** PRO CPU (core 0) — the SoC timebase: TIMG/RTC timers and step()
   *  budgets count ITS cycles. */
  private cpu: XtensaCpu;
  /** APP CPU (core 1) — slice 12. Shares the bus; all SR/interrupt
   *  state is per-XtensaCpu instance. */
  private cpu1: XtensaCpu;
  /** Whichever core is currently executing — event timestamps and ROM
   *  traps resolve against it. */
  private active: XtensaCpu;

  // Core-1 release state (slice 12).
  private core1Ctrl0 = CORE1_RESETING; // power-on: held in reset
  private core1Msg = 0; // CONTROL_1 MESSAGE scratch
  private rtcSwCpuStall = 0; // RTC_CNTL_SW_CPU_STALL_REG
  private appBootAddr = 0; // ets_set_appcpu_boot_addr's stored address
  private core1Started = false;
  /** Core 0 cycle at which core 1 last (re)started — its shared-
   *  timeline position is core1Epoch + cpu1.cycles. */
  private core1Epoch = 0;
  private fromCpuIntRaw = Array(SYSTEM_CPU_INTR_FROM_CPU_COUNT).fill(0) as number[];
  private fromCpuIntMaps: InterruptMapPair[] = Array.from({ length: SYSTEM_CPU_INTR_FROM_CPU_COUNT }, freshInterruptMapPair);

  // GPIO matrix state (two 32-bit banks each).
  private out = [0, 0];
  private enable = [0, 0];
  private inLevels = [0, 0];
  private gpioStatus = [0, 0]; // latched interrupt status per bank
  private pinCfg = new Int32Array(PIN_COUNT); // GPIO_PINn registers
  private gpioFuncIn = new Int32Array(256);
  private gpioFuncOut = new Int32Array(PIN_COUNT).fill(GPIO_FUNC_OUT_SEL_RESET);

  // LEDC low-speed group state. Counters are virtual, like TIMG:
  // `base` is the timer counter at core-0 cycle `sync`.
  private ledcTimers: LedcTimer[] = Array.from({ length: LEDC_TIMERS }, freshLedcTimer);
  private ledcChannels: LedcChannel[] = Array.from({ length: LEDC_CHANNELS }, freshLedcChannel);
  private ledcConf = 0;
  private ledcIntRaw = 0;
  private ledcIntEna = 0;
  private ledcIntMaps = freshInterruptMapPair();
  private rmtTx: RmtTxChannel[] = Array.from({ length: RMT_TX_CHANNELS }, freshRmtTxChannel);
  private rmtRx: RmtRxChannel[] = Array.from({ length: RMT_RX_CHANNELS }, freshRmtRxChannel);
  private rmtSysConf = RMT_SYS_CONF_RESET;
  private rmtIntRaw = 0;
  private rmtIntEna = 0;
  private rmtIntMaps = freshInterruptMapPair();

  // UART0 interrupt state + the interrupt matrix maps.
  private uartIntEna = 0;
  private uartTxDone = false; // latched TX_DONE raw bit
  private uartRxThrhd = 96; // CONF1 RXFIFO_FULL_THRHD reset value
  private gpioIntMaps = freshInterruptMapPair();
  private uartIntMaps = freshInterruptMapPair();

  // TIMG0/TIMG1 state (slices 8 + 13): per-group timers, MWDT, INT_*
  // regs and matrix maps. Counters are virtual — derived from elapsed
  // core-0 cycles, no per-cycle bookkeeping.
  private timg: TimgGroup[] = [freshTimgGroup(), freshTimgGroup()];
  // The RTC watchdog (slice 13) — config1 unused (no prescaler; it
  // counts the modeled ~136 kHz RC_SLOW clock directly).
  private rwdt: Watchdog = freshWatchdog(RWDT_CONFIG0_RESET, 0);

  // RTC/eFuse/SYSTEM state (slice 11). The reset causes survive
  // reset() — they describe WHY the last reset happened; loadFirmware
  // sets them back to power-on. appResetCause is core 1's own field
  // (RESET_STATE's APPCPU [11:6] — slice 12).
  private resetCause = RESET_CAUSE_POWERON;
  private appResetCause = RESET_CAUSE_POWERON;
  private rtcOptions0 = 0; // last write, WO sw-reset bits masked out
  private rtcSleepTimerLo = 0;
  private rtcSleepTimerHi = 0;
  private rtcMainTimerAlarmArmed = false;
  private rtcState0 = 0;
  private rtcWakeupState = RTC_WAKEUP_STATE_RESET;
  private rtcIntRaw = 0;
  private rtcIntEna = 0;
  private rtcRejectCause = 0;
  private rtcWakeupCause = 0;
  private rtcCocpuCtrl = 0;
  private rtcBrownOut = RTC_BROWN_OUT_RESET;
  private brownoutDetected = false;
  private rtcExtXtlConf = RTC_EXT_XTL_CONF_RESET;
  private rtcXtal32kConf = RTC_XTAL32K_CONF_RESET;
  private xtal32kDead = false;
  private rtcSwdConf = RTC_SWD_CONF_RESET;
  private rtcSwdWprotect = RTC_SWD_WKEY;
  private rtcCoreIntMaps = freshInterruptMapPair();
  private rtcTimeLatchLo = 0; // captured by a TIME_UPDATE write
  private rtcTimeLatchHi = 0;
  private cpuPerConf = SYSTEM_CPU_PER_CONF_RESET;
  private sysclkConf = SYSTEM_SYSCLK_CONF_RESET;
  private efuseBlocks = freshEfuseBlocks();
  private efusePgmData = Array(EFUSE_PGM_DATA_WORDS).fill(0) as number[];
  private efusePgmCheck = Array(EFUSE_PGM_CHECK_WORDS).fill(0) as number[];
  private efuseClk = 0;
  private efuseConf = 0;
  private efuseIntRaw = 0;
  private efuseIntEna = 0;
  private efuseDacConf = EFUSE_DAC_CONF_RESET;
  private efuseRdTimConf = EFUSE_RD_TIM_CONF_RESET;
  private efuseWrTimConf1 = EFUSE_WR_TIM_CONF1_RESET;
  private efuseWrTimConf2 = EFUSE_WR_TIM_CONF2_RESET;

  // SAR ADC1/ADC2 oneshot state.
  private meas1Ctrl2 = 0; // the control bits firmware wrote
  private meas2Ctrl2 = 0;
  private adcData = 0; // ADC1 latched 12-bit result
  private adc2Data = 0;
  private adcDone = false; // ADC1 done bit
  private adc2Done = false;
  private adcReads: AdcReadRequest[] = [];
  // APB_SARADC digital-controller state (continuous/DMA register
  // substrate). Pattern tables contain 4 regs × 4 packed 6-bit entries.
  private apbSaradcCtrl = APB_SARADC_CTRL_RESET;
  private apbSaradcCtrl2 = APB_SARADC_CTRL2_RESET;
  private apbSaradcFsmWait = APB_SARADC_FSM_WAIT_RESET;
  private apbSaradcSar1Patt = [0, 0, 0, 0];
  private apbSaradcSar2Patt = [0, 0, 0, 0];
  private apbSaradcPatternIdx = [0, 0];
  private apbSaradcAlterNext: 1 | 2 = 1;
  private apbSaradcArbCtrl = 0;
  private apbSaradcFilterCtrl0 = 0;
  private apbSaradcThres = [0, 0, 0];
  private apbSaradcIntEna = 0;
  private apbSaradcIntRaw = 0;
  private apbSaradcIntMaps = freshInterruptMapPair();
  private apbSaradcDmaConf = 0xff;
  private apbSaradcClkmConf = APB_SARADC_CLKM_CONF_RESET;
  private apbSaradcDataStatus = [0, 0];
  private gdmaRx: GdmaRxChannel[] = Array.from({ length: GDMA_RX_CHANNELS }, freshGdmaRx);
  private gdmaTx: GdmaTxChannel[] = Array.from({ length: GDMA_CHANNELS }, freshGdmaTx);
  private adcContinuousFlushPool = false;
  private adcContinuousOverflows: Esp32s3AdcContinuousOverflowEvent[] = [];
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
    this.cpu1 = new XtensaCpu(this.bus());
    this.active = this.cpu;
  }

  private consumePendingReset(startCycle: number): McuStepResult | null {
    if (!this.pendingReset) return null;
    const consumed = this.cpu.cycles - startCycle;
    const resetEvents = this.events;
    this.reset();
    return { cycles: consumed, events: resetEvents };
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
    this.resetCause = RESET_CAUSE_POWERON; // fresh firmware = fresh power-on
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
      this.active = this.cpu;
      this.cpu.step();
      const core0Reset = this.consumePendingReset(start);
      if (core0Reset !== null) {
        // software_reset ROM trap: a power-on reset that ends this
        // step() call (the cycle counter restarts from 0).
        return core0Reset;
      }
      // Lockstep interleave (slice 12): core 1 catches up to core 0's
      // timeline — 1 instr = 1 cycle on both, so they alternate.
      if (this.core1Started) {
        if (this.core1Runnable()) {
          this.active = this.cpu1;
          while (this.core1Epoch + this.cpu1.cycles < this.cpu.cycles) {
            this.cpu1.step();
            const core1Reset = this.consumePendingReset(start);
            if (core1Reset !== null) return core1Reset;
          }
          this.active = this.cpu;
        } else {
          // Gated/stalled: core 1's timeline slides forward without
          // executing, so a later release doesn't burst-replay it.
          this.core1Epoch = this.cpu.cycles - this.cpu1.cycles;
        }
      }
      this.checkTimersAndWdts();
      this.syncPins();
      const timedReset = this.consumePendingReset(start);
      if (timedReset !== null) {
        // A watchdog stage bit (slice 13) — same shape as the
        // software_reset path above.
        return timedReset;
      }
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
    this.captureRmtRxInputs();
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

  setAdcContinuousFlushPool(enabled: boolean): void {
    this.adcContinuousFlushPool = enabled;
  }

  drainAdcContinuousOverflows(): Esp32s3AdcContinuousOverflowEvent[] {
    const out = this.adcContinuousOverflows;
    this.adcContinuousOverflows = [];
    return out;
  }

  setBrownoutDetected(detected: boolean): void {
    this.brownoutDetected = detected;
    this.updateBrownoutDetector();
  }

  setXtal32kDead(dead: boolean): void {
    this.xtal32kDead = dead;
    this.updateXtal32kDead();
  }

  triggerSuperWatchdog(): void {
    this.triggerSuperWatchdogTrip();
  }

  inspect(): McuState {
    // No SREG on Xtensa — reported as 0; sp is a1 by call0 convention.
    // Reports the PRO CPU (core 0) — the SoC timebase.
    return { pc: this.cpu.pc, cycles: this.cpu.cycles, sreg: 0, sp: this.cpu.a(1) };
  }

  /** The shared-timeline cycle of the currently-executing core — the
   *  timestamp domain for pin events and ADC reads. Core 0's counter
   *  IS the timeline; core 1's position is its release epoch plus its
   *  own cycles (lockstep keeps them within one cycle). */
  private now(): number {
    return this.active === this.cpu1 ? this.core1Epoch + this.cpu1.cycles : this.cpu.cycles;
  }

  private efuseReadWord(off: number): number | null {
    if ((off & 3) !== 0) return null;
    if (off >= EFUSE_RD_WR_DIS && off <= EFUSE_RD_REPEAT_DATA_4) {
      return this.efuseBlocks[0]?.[(off - EFUSE_RD_WR_DIS) >> 2] ?? 0;
    }
    if (off >= EFUSE_RD_MAC_SPI_SYS_0 && off <= EFUSE_RD_MAC_SPI_SYS_5) {
      return this.efuseBlocks[1]?.[(off - EFUSE_RD_MAC_SPI_SYS_0) >> 2] ?? 0;
    }
    if (off >= EFUSE_RD_SYS_PART1_DATA_0 && off <= EFUSE_RD_SYS_PART2_DATA_7) {
      const rel = off - EFUSE_RD_SYS_PART1_DATA_0;
      const block = 2 + (rel >> 5);
      const word = (rel & 0x1f) >> 2;
      return this.efuseBlocks[block]?.[word] ?? 0;
    }
    return null;
  }

  private efuseProgramBlock(block: number): void {
    if (block < 0 || block >= EFUSE_BLOCK_COUNT) {
      throw new Error(`eFuse program command selected invalid block ${String(block)}; expected 0..10`);
    }
    const words = block < 2 ? 6 : EFUSE_BLOCK_WORDS;
    const target = this.efuseBlocks[block];
    if (target === undefined) {
      throw new Error(`eFuse BLOCK${String(block)} storage is missing`);
    }
    for (let i = 0; i < words; i++) {
      target[i] = ((target[i] ?? 0) | (this.efusePgmData[i] ?? 0)) >>> 0;
    }
    this.efusePgmData.fill(0);
    this.efusePgmCheck.fill(0);
    this.efuseIntRaw |= EFUSE_PGM_CMD;
  }

  private sampleAdc(channel: number): number {
    const cycle = this.now();
    const volts = this.sampler ? this.sampler(channel, cycle) : 0;
    const data = Math.min(ADC_MAX, Math.max(0, Math.round((volts / ADC_VREF) * ADC_MAX)));
    this.adcReads.push({ channel, cycle });
    return data;
  }

  private runSarAdcConversion(unit: 1 | 2, ctrl: number): void {
    const enPad = (ctrl >>> 19) & 0xfff;
    const muxChannel = enPad === 0 ? 0 : 31 - Math.clz32(enPad & -enPad);
    const channel = unit === 1 ? muxChannel : ADC2_SAMPLER_CHANNEL_BASE + muxChannel;
    const data = this.sampleAdc(channel);
    if (unit === 1) {
      this.adcData = data;
      this.adcDone = true;
    } else {
      this.adc2Data = data;
      this.adc2Done = true;
    }
  }

  private apbSaradcPattern(unit: 1 | 2): number {
    const ui = unit - 1;
    const lenShift = unit === 1 ? 15 : 19;
    const len = ((this.apbSaradcCtrl >>> lenShift) & 0xf) + 1;
    const idx = (this.apbSaradcPatternIdx[ui] ?? 0) % len;
    const regs = unit === 1 ? this.apbSaradcSar1Patt : this.apbSaradcSar2Patt;
    const tab = regs[idx >> 2] ?? 0;
    const shift = 18 - (idx & 3) * 6;
    const pat = (tab >>> shift) & 0x3f;
    this.apbSaradcPatternIdx[ui] = (idx + 1) % len;
    return (pat >>> 2) & 0xf;
  }

  private apbSaradcConvert(unit: 1 | 2): void {
    const muxChannel = this.apbSaradcPattern(unit);
    const channel = unit === 1 ? muxChannel : ADC2_SAMPLER_CHANNEL_BASE + muxChannel;
    const data = this.sampleAdc(channel);
    const word = (data & 0xfff) | ((muxChannel & 0xf) << 13) | ((unit - 1) << 17);
    this.apbSaradcDataStatus[unit - 1] = word >>> 0;
    this.gdmaPushAdcWord(word >>> 0);
    this.apbSaradcCheckThresholds(unit, muxChannel, data);
    this.apbSaradcIntRaw |= unit === 1 ? APB_SARADC_INT_ADC1_DONE : APB_SARADC_INT_ADC2_DONE;
    this.recomputeIrq();
  }

  private apbSaradcCheckThresholds(unit: 1 | 2, muxChannel: number, data: number): void {
    const thresCtrl = this.apbSaradcThres[2] ?? 0;
    const sampleChannel = (((unit - 1) << 3) | (muxChannel & 0x7)) & APB_SARADC_THRES_CHANNEL_MASK;
    const monitors = [
      {
        ctrl: this.apbSaradcThres[0] ?? 0,
        enabled: (thresCtrl & (APB_SARADC_THRES0_EN | APB_SARADC_THRES_ALL_EN)) !== 0,
        highInt: APB_SARADC_INT_THRES0_HIGH,
        lowInt: APB_SARADC_INT_THRES0_LOW,
      },
      {
        ctrl: this.apbSaradcThres[1] ?? 0,
        enabled: (thresCtrl & (APB_SARADC_THRES1_EN | APB_SARADC_THRES_ALL_EN)) !== 0,
        highInt: APB_SARADC_INT_THRES1_HIGH,
        lowInt: APB_SARADC_INT_THRES1_LOW,
      },
    ];
    for (const monitor of monitors) {
      if (!monitor.enabled) continue;
      if ((monitor.ctrl & APB_SARADC_THRES_CHANNEL_MASK) !== sampleChannel) continue;
      const high = (monitor.ctrl >>> APB_SARADC_THRES_HIGH_SHIFT) & APB_SARADC_THRES_VALUE_MASK;
      const low = (monitor.ctrl >>> APB_SARADC_THRES_LOW_SHIFT) & APB_SARADC_THRES_VALUE_MASK;
      if (data > high) this.apbSaradcIntRaw |= monitor.highInt;
      if (data < low) this.apbSaradcIntRaw |= monitor.lowInt;
    }
  }

  private apbSaradcRunDigitalConversion(): void {
    const ctrl = this.apbSaradcCtrl;
    const workMode = (ctrl >>> 3) & 0x3;
    const sarSel = (ctrl >>> 5) & 0x1;
    if (workMode === 0) this.apbSaradcConvert(sarSel === 0 ? 1 : 2);
    else if (workMode === 1) {
      this.apbSaradcConvert(1);
      this.apbSaradcConvert(2);
    } else {
      const unit = this.apbSaradcAlterNext;
      this.apbSaradcConvert(unit);
      this.apbSaradcAlterNext = unit === 1 ? 2 : 1;
    }
  }

  private sramU32(addr: number): number {
    const idx = this.sramIndex(addr);
    if (idx === null || idx + 4 > this.sram.length) {
      throw new Error(`GDMA descriptor points outside modeled SRAM: 0x${addr.toString(16)}`);
    }
    return (
      (this.sram[idx] ?? 0) |
      ((this.sram[idx + 1] ?? 0) << 8) |
      ((this.sram[idx + 2] ?? 0) << 16) |
      ((this.sram[idx + 3] ?? 0) << 24)
    ) >>> 0;
  }

  private setSramU32(addr: number, value: number): void {
    const idx = this.sramIndex(addr);
    if (idx === null || idx + 4 > this.sram.length) {
      throw new Error(`GDMA write points outside modeled SRAM: 0x${addr.toString(16)}`);
    }
    const v = value >>> 0;
    this.sram[idx] = v & 0xff;
    this.sram[idx + 1] = (v >>> 8) & 0xff;
    this.sram[idx + 2] = (v >>> 16) & 0xff;
    this.sram[idx + 3] = (v >>> 24) & 0xff;
  }

  private gdmaDescriptorAddress(field: number): number {
    const low = field & GDMA_INLINK_ADDR_MASK;
    const dramLow = DRAM_BASE & GDMA_INLINK_ADDR_MASK;
    const iramLow = IRAM_BASE & GDMA_INLINK_ADDR_MASK;
    if (low >= dramLow && low < dramLow + SRAM_BYTES) return DRAM_BASE + (low - dramLow);
    if (low >= iramLow && low < iramLow + SRAM_BYTES) return IRAM_BASE + (low - iramLow);
    return low;
  }

  private gdmaMarkDscrErr(ch: GdmaRxChannel, desc: number): void {
    ch.errEofDesc = desc >>> 0;
    ch.intRaw |= GDMA_IN_DSCR_ERR_INT;
    ch.active = false;
    ch.started = false;
    ch.offset = 0;
    this.recomputeIrq();
  }

  private gdmaParkDscrEmpty(ch: GdmaRxChannel, desc?: number, word?: number): void {
    if (desc !== undefined && word !== undefined) {
      this.adcContinuousOverflows.push({
        cycle: this.now(),
        descriptor: desc >>> 0,
        frameWord: word >>> 0,
        policy: 'drop-new',
      });
    }
    ch.intRaw |= GDMA_IN_DSCR_EMPTY_INT;
    ch.active = false;
    ch.offset = 0;
    this.recomputeIrq();
  }

  private gdmaHandleCpuOwnedDescriptor(ch: GdmaRxChannel, desc: number, dw0: number, word: number): number | null {
    if (!this.adcContinuousFlushPool) {
      this.gdmaParkDscrEmpty(ch, desc, word);
      return null;
    }

    this.adcContinuousOverflows.push({
      cycle: this.now(),
      descriptor: desc >>> 0,
      frameWord: word >>> 0,
      policy: 'flush-old',
    });
    const recycledDw0 = (dw0 & ~(GDMA_DESC_LENGTH_MASK | GDMA_DESC_SUC_EOF)) | GDMA_DESC_OWNER_DMA;
    this.setSramU32(desc, recycledDw0 >>> 0);
    ch.active = true;
    ch.offset = 0;
    return recycledDw0 >>> 0;
  }

  private gdmaStart(ch: GdmaRxChannel): void {
    const desc = this.gdmaDescriptorAddress(ch.inLink);
    ch.currentDesc = desc >>> 0;
    ch.offset = 0;
    ch.active = desc !== 0;
    ch.started = ch.active;
    if (!ch.active) ch.intRaw |= GDMA_IN_DSCR_EMPTY_INT;
    this.recomputeIrq();
  }

  private gdmaStartTx(ch: GdmaTxChannel): void {
    const desc = this.gdmaDescriptorAddress(ch.outLink);
    ch.currentDesc = desc >>> 0;
    ch.active = desc !== 0;
    ch.started = ch.active;
    this.recomputeIrq();
  }

  private gdmaMarkTxDscrErr(ch: GdmaTxChannel, desc: number): void {
    ch.eofDesc = desc >>> 0;
    ch.intRaw |= GDMA_OUT_DSCR_ERR_INT;
    ch.active = false;
    ch.started = false;
    this.recomputeIrq();
  }

  private gdmaReadTxSymbols(ch: GdmaTxChannel): number[] {
    const symbols: number[] = [];
    let desc = ch.currentDesc >>> 0;
    const seen = new Set<number>();
    for (let guard = 0; guard < 64 && desc !== 0 && !seen.has(desc); guard++) {
      seen.add(desc);
      const dw0 = this.sramU32(desc);
      const size = dw0 & GDMA_DESC_SIZE_MASK;
      const length = (dw0 & GDMA_DESC_LENGTH_MASK) >>> 12;
      const bytes = length > 0 ? Math.min(length, size === 0 ? length : size) : size;
      const buffer = this.sramU32(desc + 4);
      const next = this.sramU32(desc + 8);
      if ((dw0 & GDMA_DESC_OWNER_DMA) === 0 || bytes < 4) {
        this.gdmaMarkTxDscrErr(ch, desc);
        break;
      }
      for (let offset = 0; offset + 4 <= bytes; offset += 4) {
        symbols.push(this.sramU32(buffer + offset));
      }
      ch.descBf1 = ch.descBf0;
      ch.descBf0 = desc;
      ch.eofBfrDesc = buffer >>> 0;
      ch.eofDesc = desc >>> 0;
      ch.intRaw |= GDMA_OUT_DONE_INT | GDMA_OUT_EOF_INT;
      if ((dw0 & GDMA_DESC_SUC_EOF) !== 0 || next === 0) ch.intRaw |= GDMA_OUT_TOTAL_EOF_INT;
      this.setSramU32(desc, dw0 & ~GDMA_DESC_OWNER_DMA);
      desc = next >>> 0;
      ch.currentDesc = desc;
      if ((dw0 & GDMA_DESC_SUC_EOF) !== 0 || next === 0) break;
    }
    ch.active = false;
    ch.started = false;
    this.recomputeIrq();
    return symbols;
  }

  private gdmaPushAdcWord(word: number): void {
    const ch =
      this.gdmaRx.find((rx) => rx.active && rx.periSel === GDMA_PERI_ADC_DAC) ??
      this.gdmaRx.find((rx) => rx.started && rx.periSel === GDMA_PERI_ADC_DAC);
    if (ch === undefined) return;
    this.gdmaPushRxWord(ch, word >>> 0);
    this.recomputeIrq();
  }

  private gdmaPushRmtRxWord(word: number): boolean {
    const ch =
      this.gdmaRx.find((rx) => rx.active && rx.periSel === GDMA_PERI_RMT) ??
      this.gdmaRx.find((rx) => rx.started && rx.periSel === GDMA_PERI_RMT);
    if (ch === undefined) return false;
    const before = ch.intRaw;
    this.gdmaPushRxWord(ch, word >>> 0);
    this.recomputeIrq();
    return ch.intRaw !== before;
  }

  private gdmaFinishRxDescriptor(ch: GdmaRxChannel): boolean {
    const desc = ch.currentDesc >>> 0;
    if (desc === 0 || ch.offset === 0) return false;
    const dw0 = this.sramU32(desc);
    const size = dw0 & GDMA_DESC_SIZE_MASK;
    const length = Math.min(ch.offset, size) & GDMA_DESC_SIZE_MASK;
    const nextDw0 = (dw0 & ~(GDMA_DESC_LENGTH_MASK | GDMA_DESC_OWNER_DMA)) | (length << 12) | GDMA_DESC_SUC_EOF;
    this.setSramU32(desc, nextDw0 >>> 0);
    ch.sucEofDesc = desc;
    ch.intRaw |= GDMA_IN_DONE_INT | GDMA_IN_SUC_EOF_INT;
    ch.descBf1 = ch.descBf0;
    ch.descBf0 = desc;
    ch.currentDesc = this.sramU32(desc + 8) >>> 0;
    ch.offset = 0;
    ch.active = false;
    ch.started = false;
    this.recomputeIrq();
    return true;
  }

  private gdmaFinishRmtRx(): boolean {
    const ch =
      this.gdmaRx.find((rx) => rx.active && rx.periSel === GDMA_PERI_RMT) ??
      this.gdmaRx.find((rx) => rx.started && rx.periSel === GDMA_PERI_RMT);
    return ch === undefined ? false : this.gdmaFinishRxDescriptor(ch);
  }

  private gdmaPushRxWord(ch: GdmaRxChannel, word: number): void {
    let desc = ch.currentDesc >>> 0;
    if (desc === 0) {
      ch.intRaw |= GDMA_IN_DSCR_EMPTY_INT;
      ch.active = false;
      this.recomputeIrq();
      return;
    }
    let dw0 = this.sramU32(desc);
    let size = dw0 & GDMA_DESC_SIZE_MASK;
    if (size < ADC_DIGI_RESULT_BYTES) {
      this.gdmaMarkDscrErr(ch, desc);
      return;
    }
    if ((dw0 & GDMA_DESC_OWNER_DMA) === 0) {
      const recycled = this.gdmaHandleCpuOwnedDescriptor(ch, desc, dw0, word);
      if (recycled === null) return;
      dw0 = recycled;
    }
    let buffer = this.sramU32(desc + 4);
    if (ch.offset + ADC_DIGI_RESULT_BYTES > size) {
      const next = this.sramU32(desc + 8);
      if (next === 0) {
        ch.intRaw |= GDMA_IN_DSCR_EMPTY_INT;
        ch.active = false;
        this.recomputeIrq();
        return;
      }
      ch.descBf1 = ch.descBf0;
      ch.descBf0 = desc;
      desc = next >>> 0;
      ch.currentDesc = desc;
      ch.offset = 0;
      dw0 = this.sramU32(desc);
      size = dw0 & GDMA_DESC_SIZE_MASK;
      if (size < ADC_DIGI_RESULT_BYTES) {
        this.gdmaMarkDscrErr(ch, desc);
        return;
      }
      if ((dw0 & GDMA_DESC_OWNER_DMA) === 0) {
        const recycled = this.gdmaHandleCpuOwnedDescriptor(ch, desc, dw0, word);
        if (recycled === null) return;
        dw0 = recycled;
      }
      buffer = this.sramU32(desc + 4);
    }
    this.setSramU32(buffer + ch.offset, word);
    ch.offset += ADC_DIGI_RESULT_BYTES;
    const length = Math.min(ch.offset, size) & GDMA_DESC_SIZE_MASK;
    let nextDw0 = (dw0 & ~GDMA_DESC_LENGTH_MASK) | (length << 12);
    if (ch.offset >= size) {
      const next = this.sramU32(desc + 8);
      nextDw0 = (nextDw0 & ~GDMA_DESC_OWNER_DMA) | GDMA_DESC_SUC_EOF;
      this.setSramU32(desc, nextDw0 >>> 0);
      ch.sucEofDesc = desc;
      ch.intRaw |= GDMA_IN_DONE_INT | GDMA_IN_SUC_EOF_INT;
      ch.descBf1 = ch.descBf0;
      ch.descBf0 = desc;
      ch.currentDesc = next >>> 0;
      ch.offset = 0;
      if (next === 0) ch.active = false;
    } else {
      this.setSramU32(desc, nextDw0 >>> 0);
    }
  }

  /** esp_cpu_stall's split 0x86 code, both halves present. */
  private core1RtcStalled(): boolean {
    return (
      (this.rtcOptions0 & STALL_APPCPU_C0_MASK) === STALL_C0_CODE &&
      ((this.rtcSwCpuStall >>> 20) & 0x3f) === STALL_C1_CODE
    );
  }

  /** Clock on, not run-stalled, not in reset, not RTC-stalled. */
  private core1Runnable(): boolean {
    if ((this.core1Ctrl0 & CORE1_CLKGATE_EN) === 0) return false;
    if ((this.core1Ctrl0 & (CORE1_RUNSTALL | CORE1_RESETING)) !== 0) return false;
    return !this.core1RtcStalled();
  }

  /** Start (or restart) core 1 at the stored boot address once every
   *  release condition holds — the net effect of the real ROM's
   *  "wait until the boot address is non-zero, then jump" loop.
   *  Called whenever any release input changes. */
  private maybeStartCore1(): void {
    if (this.core1Started || this.appBootAddr === 0 || !this.core1Runnable()) return;
    this.cpu1.reset(this.appBootAddr, DRAM_BASE + SRAM_BYTES - CORE1_RESET_SP);
    this.core1Epoch = this.cpu.cycles;
    this.core1Started = true;
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
    this.gpioFuncIn.fill(0);
    this.gpioFuncOut.fill(GPIO_FUNC_OUT_SEL_RESET);
    this.ledcTimers = Array.from({ length: LEDC_TIMERS }, freshLedcTimer);
    this.ledcChannels = Array.from({ length: LEDC_CHANNELS }, freshLedcChannel);
    this.ledcConf = 0;
    this.ledcIntRaw = 0;
    this.ledcIntEna = 0;
    this.ledcIntMaps = freshInterruptMapPair();
    this.rmtTx = Array.from({ length: RMT_TX_CHANNELS }, freshRmtTxChannel);
    this.rmtRx = Array.from({ length: RMT_RX_CHANNELS }, freshRmtRxChannel);
    this.rmtSysConf = RMT_SYS_CONF_RESET;
    this.rmtIntRaw = 0;
    this.rmtIntEna = 0;
    this.rmtIntMaps = freshInterruptMapPair();
    this.uartIntEna = 0;
    this.uartTxDone = false;
    this.uartRxThrhd = 96;
    this.gpioIntMaps = freshInterruptMapPair();
    this.uartIntMaps = freshInterruptMapPair();
    this.timg = [freshTimgGroup(), freshTimgGroup()];
    this.rwdt = freshWatchdog(RWDT_CONFIG0_RESET, 0);
    // resetCause/appResetCause are deliberately NOT cleared — they
    // report why this reset happened (software_reset / SW_*_RST set
    // them before calling).
    this.rtcOptions0 = 0;
    this.core1Ctrl0 = CORE1_RESETING; // core 1 back to held-in-reset
    this.core1Msg = 0;
    this.rtcSwCpuStall = 0;
    this.appBootAddr = 0; // cpu_start.c zeroes it early in boot too
    this.core1Started = false;
    this.core1Epoch = 0;
    this.fromCpuIntRaw.fill(0);
    this.fromCpuIntMaps = Array.from({ length: SYSTEM_CPU_INTR_FROM_CPU_COUNT }, freshInterruptMapPair);
    this.rtcSleepTimerLo = 0;
    this.rtcSleepTimerHi = 0;
    this.rtcMainTimerAlarmArmed = false;
    this.rtcState0 = 0;
    this.rtcWakeupState = RTC_WAKEUP_STATE_RESET;
    this.rtcIntRaw = 0;
    this.rtcIntEna = 0;
    this.rtcRejectCause = 0;
    this.rtcWakeupCause = 0;
    this.rtcCocpuCtrl = 0;
    this.rtcBrownOut = RTC_BROWN_OUT_RESET;
    this.rtcExtXtlConf = RTC_EXT_XTL_CONF_RESET;
    this.rtcXtal32kConf = RTC_XTAL32K_CONF_RESET;
    this.rtcSwdConf = RTC_SWD_CONF_RESET;
    this.rtcSwdWprotect = RTC_SWD_WKEY;
    this.rtcCoreIntMaps = freshInterruptMapPair();
    this.rtcTimeLatchLo = 0;
    this.rtcTimeLatchHi = 0;
    this.cpuPerConf = SYSTEM_CPU_PER_CONF_RESET;
    this.sysclkConf = SYSTEM_SYSCLK_CONF_RESET;
    this.efusePgmData.fill(0);
    this.efusePgmCheck.fill(0);
    this.efuseClk = 0;
    this.efuseConf = 0;
    this.efuseIntRaw = 0;
    this.efuseIntEna = 0;
    this.efuseDacConf = EFUSE_DAC_CONF_RESET;
    this.efuseRdTimConf = EFUSE_RD_TIM_CONF_RESET;
    this.efuseWrTimConf1 = EFUSE_WR_TIM_CONF1_RESET;
    this.efuseWrTimConf2 = EFUSE_WR_TIM_CONF2_RESET;
    this.meas1Ctrl2 = 0;
    this.meas2Ctrl2 = 0;
    this.adcData = 0;
    this.adc2Data = 0;
    this.adcDone = false;
    this.adc2Done = false;
    this.adcReads = []; // the sampler itself survives — bench wiring
    this.apbSaradcCtrl = APB_SARADC_CTRL_RESET;
    this.apbSaradcCtrl2 = APB_SARADC_CTRL2_RESET;
    this.apbSaradcFsmWait = APB_SARADC_FSM_WAIT_RESET;
    this.apbSaradcSar1Patt = [0, 0, 0, 0];
    this.apbSaradcSar2Patt = [0, 0, 0, 0];
    this.apbSaradcPatternIdx = [0, 0];
    this.apbSaradcAlterNext = 1;
    this.apbSaradcArbCtrl = 0;
    this.apbSaradcFilterCtrl0 = 0;
    this.apbSaradcThres = [0, 0, 0];
    this.apbSaradcIntEna = 0;
    this.apbSaradcIntRaw = 0;
    this.apbSaradcIntMaps = freshInterruptMapPair();
    this.apbSaradcDmaConf = 0xff;
    this.apbSaradcClkmConf = APB_SARADC_CLKM_CONF_RESET;
    this.apbSaradcDataStatus = [0, 0];
    this.gdmaRx = Array.from({ length: GDMA_RX_CHANNELS }, freshGdmaRx);
    this.gdmaTx = Array.from({ length: GDMA_CHANNELS }, freshGdmaTx);
    this.adcContinuousOverflows = [];
    this.driven.fill(undefined);
    this.events = [];
    this.rxQueue = [];
    this.txBuffer = [];
    this.pendingReset = false;
    this.cpu = new XtensaCpu(this.bus());
    this.cpu1 = new XtensaCpu(this.bus());
    this.active = this.cpu;
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

  private timerDivider(t: GpTimer): number {
    const field = (t.config >>> 13) & 0xffff;
    return field === 0 ? 65536 : field; // 0 means 65536, per the HAL
  }

  /** The live 54-bit counter, derived from elapsed CPU cycles. */
  private timerValue(t: GpTimer): number {
    if ((t.config & T_EN) === 0) return t.base;
    const ticks = Math.floor((this.cpu.cycles - t.sync) / (CYCLES_PER_APB * this.timerDivider(t)));
    const delta = (t.config & T_INCREASE) !== 0 ? ticks : -ticks;
    // NOT the usual ((x % M) + M) % M: adding 2^54 to a small positive
    // value rounds it away (the float ulp at 2^54 is 4). Only add the
    // modulus when the value is actually negative.
    let v = (t.base + delta) % T_MASK;
    if (v < 0) v += T_MASK;
    return v;
  }

  /** Freeze the counter into base — required before any config
   *  change so old-divider time doesn't replay under the new one. */
  private timerResync(t: GpTimer): void {
    t.base = this.timerValue(t);
    t.sync = this.cpu.cycles;
  }

  /** Alarm comparator, run after every instruction while armed. On a
   *  hit: latch the raw interrupt, auto-disable the alarm (the
   *  hardware behavior gptimer's ISR re-arms around), auto-reload if
   *  configured. */
  private checkAlarm(grp: TimgGroup, ti: number): void {
    const t = grp.timers[ti];
    if (t === undefined) return;
    const alarm = t.alarmHi * 0x100000000 + t.alarmLo;
    const value = this.timerValue(t);
    const hit = (t.config & T_INCREASE) !== 0 ? value >= alarm : value <= alarm;
    if (!hit) return;
    grp.intRaw |= 1 << ti;
    t.config &= ~T_ALARM_EN;
    if ((t.config & T_AUTORELOAD) !== 0) {
      t.base = (t.loadHi * 0x100000000 + t.loadLo) % T_MASK;
      t.sync = this.cpu.cycles;
    }
    this.recomputeIrq();
  }

  /** Walk a watchdog's stages against elapsed ticks since the last
   *  feed, firing each newly-expired stage's action via `fire`. If
   *  all four stages expire without a reset, the hardware wraps to
   *  stage 0 — modeled as a self-feed. */
  private runWdtStages(w: Watchdog, ticks: number, fire: (stage: number) => void): void {
    let cum = 0;
    for (let s = 0; s < 4; s++) {
      cum += w.timeouts[s] ?? 0;
      if (ticks < cum) return;
      if (s < w.handled) continue;
      w.handled = s + 1;
      fire(s);
      if (this.pendingReset) return;
    }
    w.epoch = this.cpu.cycles;
    w.handled = 0;
  }

  /** One MWDT (group g): counts APB/CLK_PRESCALE ticks. Stage actions
   *  per hal/wdt_types.h; CPU resets ignore the PROCPU/APPCPU routing
   *  bits and reset the PRO CPU (whole machine) — stated cut. */
  private checkMwdt(g: number): void {
    const grp = this.timg[g];
    if (grp === undefined) return;
    const w = grp.wdt;
    const prescale = ((w.config1 >>> 16) & 0xffff) || 1;
    const ticks = Math.floor((this.cpu.cycles - w.epoch) / (CYCLES_PER_APB * prescale));
    this.runWdtStages(w, ticks, (s) => {
      const action = (w.config0 >>> (29 - 2 * s)) & 3;
      if (action === WDT_STAGE_INT) {
        grp.intRaw |= TIMG_WDT_INT;
        this.recomputeIrq();
      } else if (action === WDT_STAGE_RESET_CPU) {
        this.resetCause = g === 1 ? RESET_CAUSE_TG1WDT_CPU : RESET_CAUSE_TG0WDT_CPU;
        this.pendingReset = true;
      } else if (action === WDT_STAGE_RESET_SYSTEM) {
        const cause = g === 1 ? RESET_CAUSE_TG1WDT_SYS : RESET_CAUSE_TG0WDT_SYS;
        this.resetCause = cause;
        this.appResetCause = cause; // system reset hits both cores
        this.pendingReset = true;
      }
      // action 0 (off): the stage still consumes its timeout slot.
    });
  }

  /** The RWDT: counts the modeled ~136 kHz RC_SLOW clock. 3-bit stage
   *  fields; action 4 (reset RTC) exists here. INT stages latch
   *  RTC_CNTL_WDT_INT and route through RTC_CORE when enabled. */
  private checkRwdt(): void {
    const w = this.rwdt;
    const ticks = Math.floor(((this.cpu.cycles - w.epoch) * RTC_SLOW_HZ) / CLOCK_HZ);
    this.runWdtStages(w, ticks, (s) => {
      const action = (w.config0 >>> (28 - 3 * s)) & 7;
      if (action === WDT_STAGE_INT) {
        this.rtcIntRaw |= RTC_WDT_INT;
        this.recomputeIrq();
      } else if (action === WDT_STAGE_RESET_CPU) {
        this.resetCause = RESET_CAUSE_RTCWDT_CPU;
        this.pendingReset = true;
      } else if (action === WDT_STAGE_RESET_SYSTEM || action === WDT_STAGE_RESET_RTC) {
        const cause = action === WDT_STAGE_RESET_RTC ? RESET_CAUSE_RTCWDT_RTC : RESET_CAUSE_RTCWDT_SYS;
        this.resetCause = cause;
        this.appResetCause = cause;
        this.pendingReset = true;
      }
    });
  }

  private rtcTicks(): number {
    return Math.floor((this.cpu.cycles * RTC_SLOW_HZ) / CLOCK_HZ);
  }

  private rtcSleepAlarmTarget(): number {
    return this.rtcSleepTimerHi * 0x100000000 + this.rtcSleepTimerLo;
  }

  private rtcWakeupEnabledSources(): number {
    return (this.rtcWakeupState >>> RTC_WAKEUP_ENA_SHIFT) & RTC_WAKEUP_ENA_MASK;
  }

  private latchRtcWakeupSource(source: number): void {
    if ((this.rtcState0 & RTC_SLEEP_EN) === 0 || (this.rtcWakeupEnabledSources() & source) === 0) return;
    this.rtcState0 = (this.rtcState0 & ~RTC_SLEEP_EN) | RTC_SLP_WAKEUP;
    this.rtcWakeupCause |= source;
    this.rtcIntRaw |= RTC_SLP_WAKEUP_INT;
  }

  private checkRtcSleepTimer(): void {
    if (!this.rtcMainTimerAlarmArmed) return;
    if (this.rtcTicks() < this.rtcSleepAlarmTarget()) return;
    this.rtcMainTimerAlarmArmed = false;
    this.rtcIntRaw |= RTC_MAIN_TIMER_INT;
    this.latchRtcWakeupSource(RTC_TIMER_TRIG_EN);
    this.recomputeIrq();
  }

  private updateBrownoutDetector(): void {
    if (!this.brownoutDetected || (this.rtcBrownOut & RTC_BROWN_OUT_ENA) === 0) {
      this.rtcBrownOut &= ~RTC_BROWN_OUT_DET;
      this.recomputeIrq();
      return;
    }
    this.rtcBrownOut |= RTC_BROWN_OUT_DET;
    this.rtcIntRaw |= RTC_BROWN_OUT_INT;
    if ((this.rtcBrownOut & RTC_BROWN_OUT_RST_ENA) !== 0) {
      this.resetCause = RESET_CAUSE_BROWNOUT;
      this.appResetCause = RESET_CAUSE_BROWNOUT;
      this.pendingReset = true;
    }
    this.recomputeIrq();
  }

  private updateXtal32kDead(): void {
    if (!this.xtal32kDead || (this.rtcExtXtlConf & RTC_XTAL32K_WDT_EN) === 0) {
      this.recomputeIrq();
      return;
    }
    this.rtcIntRaw |= RTC_XTAL32K_DEAD_INT;
    this.latchRtcWakeupSource(RTC_XTAL32K_DEAD_TRIG_EN);
    this.recomputeIrq();
  }

  private triggerSuperWatchdogTrip(): void {
    if ((this.rtcSwdConf & RTC_SWD_DISABLE) !== 0) {
      this.recomputeIrq();
      return;
    }
    this.rtcSwdConf |= RTC_SWD_FEED_INT | RTC_SWD_RESET_FLAG;
    this.rtcIntRaw |= RTC_SWD_INT;
    if ((this.rtcSwdConf & RTC_SWD_BYPASS_RST) === 0) {
      this.resetCause = RESET_CAUSE_SUPER_WDT;
      this.appResetCause = RESET_CAUSE_SUPER_WDT;
      this.pendingReset = true;
    }
    this.recomputeIrq();
  }

  /** Per-instruction tick of every armed timer alarm and enabled
   *  watchdog — all on core 0's timeline, the SoC timebase. */
  private checkTimersAndWdts(): void {
    for (let g = 0; g < 2; g++) {
      const grp = this.timg[g];
      if (grp === undefined) continue;
      for (let ti = 0; ti < 2; ti++) {
        if (((grp.timers[ti]?.config ?? 0) & T_ARMED) === T_ARMED) this.checkAlarm(grp, ti);
      }
      if ((grp.wdt.config0 & WDT_EN) !== 0) {
        this.checkMwdt(g);
        if (this.pendingReset) return;
      }
    }
    if ((this.rwdt.config0 & WDT_EN) !== 0) this.checkRwdt();
    this.checkRtcSleepTimer();
    this.checkLedcTimers();
    this.checkRmt();
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

  private ledcTimerDivider(t: LedcTimer): number {
    return ((t.conf >>> LEDC_TIMER_CLK_DIV_SHIFT) & LEDC_TIMER_CLK_DIV_MASK) || LEDC_DIV_ONE;
  }

  private ledcTimerResolution(t: LedcTimer): number {
    return t.conf & LEDC_TIMER_DUTY_RES_MASK;
  }

  private ledcTimerPeriod(t: LedcTimer): number {
    return Math.max(1, 1 << this.ledcTimerResolution(t));
  }

  private ledcClockRatio(): readonly [number, number] {
    switch (this.ledcConf & LEDC_APB_CLK_SEL_MASK) {
      case LEDC_APB_CLK_SEL_XTAL:
        return [1, 6]; // 40 MHz XTAL over the modeled 240 MHz CPU clock
      case LEDC_APB_CLK_SEL_RC_FAST:
        return [7, 96]; // 17.5 MHz RC_FAST over the modeled 240 MHz CPU clock
      case LEDC_APB_CLK_SEL_APB:
      default:
        return [1, CYCLES_PER_APB]; // 80 MHz APB over the modeled 240 MHz CPU clock
    }
  }

  private ledcTimerRunning(t: LedcTimer): boolean {
    return (this.ledcConf & LEDC_CLK_EN) !== 0 && (t.conf & (LEDC_TIMER_RST | LEDC_TIMER_PAUSE)) === 0;
  }

  private ledcTimerTicks(t: LedcTimer): number {
    if (!this.ledcTimerRunning(t)) return 0;
    const divider = this.ledcTimerDivider(t);
    const [clockNumerator, clockDenominator] = this.ledcClockRatio();
    return Math.floor(((this.cpu.cycles - t.sync) * clockNumerator * LEDC_DIV_ONE) / (clockDenominator * divider));
  }

  private ledcTimerTotal(t: LedcTimer): number {
    return t.base + this.ledcTimerTicks(t);
  }

  private ledcTimerCounter(t: LedcTimer): number {
    if (!this.ledcTimerRunning(t)) return 0;
    return this.ledcTimerTotal(t) % this.ledcTimerPeriod(t);
  }

  private ledcTimerOverflowSerial(t: LedcTimer): number {
    if ((this.ledcConf & LEDC_CLK_EN) === 0 || (t.conf & (LEDC_TIMER_RST | LEDC_TIMER_PAUSE)) !== 0) return 0;
    return Math.floor(this.ledcTimerTotal(t) / this.ledcTimerPeriod(t));
  }

  private ledcTimerResync(t: LedcTimer): void {
    t.base = this.ledcTimerCounter(t);
    t.sync = this.cpu.cycles;
    t.ovfSerial = this.ledcTimerOverflowSerial(t);
  }

  private ledcChannelTimer(ch: LedcChannel): LedcTimer | undefined {
    return this.ledcTimers[ch.conf0 & LEDC_CH_TIMER_SEL_MASK];
  }

  private ledcChannelOverflowThreshold(ch: LedcChannel): number {
    return (((ch.conf0 >>> LEDC_CH_OVF_NUM_SHIFT) & LEDC_CH_OVF_NUM_MASK) + 1) >>> 0;
  }

  private ledcFadeScale(ch: LedcChannel): number {
    return ch.conf1 & LEDC_CH_DUTY_SCALE_MASK;
  }

  private ledcFadeCycle(ch: LedcChannel): number {
    return (ch.conf1 >>> LEDC_CH_DUTY_CYCLE_SHIFT) & LEDC_CH_DUTY_CYCLE_MASK;
  }

  private ledcFadeStepNum(ch: LedcChannel): number {
    return (ch.conf1 >>> LEDC_CH_DUTY_NUM_SHIFT) & LEDC_CH_DUTY_NUM_MASK;
  }

  private ledcFadeIsIncrement(ch: LedcChannel): boolean {
    return (ch.conf1 & LEDC_CH_DUTY_INC) !== 0;
  }

  private ledcFadeDutyAt(ch: LedcChannel, steps: number): number {
    const fade = ch.fade;
    if (fade === null) return ch.dutyRead;
    const delta = (steps * this.ledcFadeScale(ch)) << 4;
    const duty = this.ledcFadeIsIncrement(ch) ? fade.baseDuty + delta : fade.baseDuty - delta;
    return Math.max(0, Math.min(LEDC_DUTY_MASK, duty)) >>> 0;
  }

  private ledcFadeStepsElapsed(ch: LedcChannel, timer: LedcTimer): number {
    if (ch.fade === null) return 0;
    const cycle = this.ledcFadeCycle(ch);
    if (cycle === 0) return 0;
    const serial = this.ledcTimerOverflowSerial(timer);
    const elapsed = serial > ch.fade.startSerial ? serial - ch.fade.startSerial : 0;
    return Math.min(this.ledcFadeStepNum(ch), Math.floor(elapsed / cycle));
  }

  private ledcUpdateFade(chIndex: number, ch: LedcChannel): boolean {
    if (ch.fade === null) return false;
    const timer = this.ledcChannelTimer(ch);
    if (timer === undefined || !this.ledcTimerRunning(timer)) return false;
    const steps = this.ledcFadeStepsElapsed(ch, timer);
    if (steps <= ch.fade.latchedSteps) return false;
    ch.dutyRead = this.ledcFadeDutyAt(ch, steps);
    ch.fade.latchedSteps = steps;
    if (steps >= this.ledcFadeStepNum(ch)) {
      ch.fade = null;
      this.ledcIntRaw |= 1 << (4 + chIndex);
    }
    return true;
  }

  private ledcLatchFixedDuty(chIndex: number, ch: LedcChannel): void {
    ch.fade = null;
    ch.dutyRead = ch.duty;
    this.ledcIntRaw |= 1 << (4 + chIndex);
    this.recomputeIrq();
  }

  private ledcResyncFade(chIndex: number, ch: LedcChannel): void {
    if (ch.fade === null) return;
    this.ledcUpdateFade(chIndex, ch);
    const timer = this.ledcChannelTimer(ch);
    if (ch.fade === null || timer === undefined) return;
    ch.fade = {
      baseDuty: ch.dutyRead,
      startSerial: this.ledcTimerOverflowSerial(timer),
      latchedSteps: 0,
    };
  }

  private ledcChannelOvfResync(ch: LedcChannel): void {
    const timer = this.ledcChannelTimer(ch);
    ch.ovfSerial = timer === undefined ? 0 : this.ledcTimerOverflowSerial(timer);
  }

  private ledcChannelsOvfResyncForTimer(timerIndex: number): void {
    for (let i = 0; i < LEDC_CHANNELS; i++) {
      const ch = this.ledcChannels[i];
      if (ch !== undefined && (ch.conf0 & LEDC_CH_TIMER_SEL_MASK) === timerIndex) {
        this.ledcChannelOvfResync(ch);
        this.ledcResyncFade(i, ch);
      }
    }
  }

  private checkLedcTimers(): void {
    let changed = false;
    for (let i = 0; i < LEDC_TIMERS; i++) {
      const timer = this.ledcTimers[i];
      if (timer === undefined || !this.ledcTimerRunning(timer)) continue;
      const serial = this.ledcTimerOverflowSerial(timer);
      if (serial <= timer.ovfSerial) continue;
      timer.ovfSerial = serial;
      this.ledcIntRaw |= 1 << (LEDC_LSTIMER_OVF_INT_BASE + i);
      changed = true;
    }
    for (let i = 0; i < LEDC_CHANNELS; i++) {
      const ch = this.ledcChannels[i];
      if (ch === undefined) continue;
      if (this.ledcUpdateFade(i, ch)) changed = true;
      if ((ch.conf0 & LEDC_CH_OVF_CNT_EN) === 0) continue;
      const timer = this.ledcChannelTimer(ch);
      if (timer === undefined || !this.ledcTimerRunning(timer)) continue;
      const serial = this.ledcTimerOverflowSerial(timer);
      if (serial < ch.ovfSerial) {
        ch.ovfSerial = serial;
        continue;
      }
      const elapsed = serial - ch.ovfSerial;
      const threshold = this.ledcChannelOverflowThreshold(ch);
      if (elapsed < threshold) continue;
      ch.ovfSerial += Math.floor(elapsed / threshold) * threshold;
      this.ledcIntRaw |= 1 << (LEDC_OVF_CNT_INT_BASE + i);
      changed = true;
    }
    if (changed) this.recomputeIrq();
  }

  private ledcSignalLevel(signal: number): DigitalLevel | null {
    const chIndex = signal - LEDC_SIGNAL_BASE;
    const ch = this.ledcChannels[chIndex];
    if (ch === undefined) return null;
    if ((ch.conf0 & LEDC_CH_SIG_OUT_EN) === 0) return (ch.conf0 & LEDC_CH_IDLE_LV) !== 0 ? 1 : 0;
    const timer = this.ledcChannelTimer(ch);
    if (timer === undefined) return 0;
    const period = this.ledcTimerPeriod(timer);
    const duty = Math.min(period, ch.dutyRead >>> 4);
    if (duty <= 0) return 0;
    if (duty >= period) return 1;
    const counter = this.ledcTimerCounter(timer);
    const phase = (counter - (ch.hpoint % period) + period) % period;
    return phase < duty ? 1 : 0;
  }

  private rmtChannelDivider(ch: RmtTxChannel): number {
    const raw = (ch.conf0 >>> RMT_DIV_CNT_SHIFT) & RMT_DIV_CNT_MASK;
    return raw === 0 ? 256 : raw;
  }

  private rmtSourceCyclesPerTick(): number | null {
    if ((this.rmtSysConf & RMT_CLK_EN) === 0 || (this.rmtSysConf & RMT_SYS_SCLK_ACTIVE) === 0) return null;
    switch ((this.rmtSysConf >>> RMT_SYS_SCLK_SEL_SHIFT) & RMT_SYS_SCLK_SEL_MASK) {
      case RMT_SYS_SCLK_SEL_XTAL:
        return 6; // 40 MHz XTAL over the modeled 240 MHz CPU clock
      case RMT_SYS_SCLK_SEL_RC_FAST:
        return 30; // ESP-IDF names the S3 source RC_FAST / CLK_8M for RMT
      case RMT_SYS_SCLK_SEL_APB:
      default:
        return CYCLES_PER_APB; // 80 MHz APB over the modeled 240 MHz CPU clock
    }
  }

  private rmtGroupCyclesPerTick(): number | null {
    const sourceCycles = this.rmtSourceCyclesPerTick();
    if (sourceCycles === null) return null;
    const divNum = ((this.rmtSysConf >>> RMT_SYS_SCLK_DIV_NUM_SHIFT) & RMT_SYS_SCLK_DIV_NUM_MASK) + 1;
    const divA = (this.rmtSysConf >>> RMT_SYS_SCLK_DIV_A_SHIFT) & RMT_SYS_SCLK_DIV_A_MASK;
    const divB = (this.rmtSysConf >>> RMT_SYS_SCLK_DIV_B_SHIFT) & RMT_SYS_SCLK_DIV_B_MASK;
    const groupDiv = divNum + (divB === 0 ? 0 : divA / divB);
    return Math.max(1, Math.round(sourceCycles * groupDiv));
  }

  private rmtCyclesPerTick(ch: RmtTxChannel): number | null {
    const groupCycles = this.rmtGroupCyclesPerTick();
    if (groupCycles === null) return null;
    return Math.max(1, groupCycles * this.rmtChannelDivider(ch));
  }

  private rmtDirectMemoryMode(): boolean {
    return (this.rmtSysConf & RMT_SYS_APB_FIFO_MASK) !== 0;
  }

  private rmtTxMemoryCapacity(ch: RmtTxChannel): number {
    const blockCount = (ch.conf0 >>> RMT_MEM_SIZE_SHIFT) & RMT_MEM_SIZE_MASK;
    return Math.max(1, blockCount) * RMT_TX_SYMBOLS_PER_BLOCK;
  }

  private rmtWriteTxData(channel: number, value: number): void {
    const ch = this.rmtTx[channel];
    if (ch === undefined) return;
    if (!this.rmtDirectMemoryMode()) {
      ch.fifo.push(value >>> 0);
      return;
    }
    const capacity = this.rmtTxMemoryCapacity(ch);
    if (ch.apbWriteCursor >= capacity) {
      if ((ch.conf0 & RMT_MEM_TX_WRAP_EN) === 0) {
        ch.apbWriteError = true;
        return;
      }
      ch.apbWriteCursor = 0;
    }
    ch.memory[ch.apbWriteCursor] = value >>> 0;
    ch.apbWriteCursor++;
    if (ch.apbWriteCursor >= capacity && (ch.conf0 & RMT_MEM_TX_WRAP_EN) !== 0) ch.apbWriteCursor = 0;
    if (ch.active) this.rmtBuildTxWaveform(channel, ch);
  }

  private rmtTxDmaMode(chIndex: number, ch: RmtTxChannel): boolean {
    return chIndex === RMT_TX_CHANNELS - 1 && (ch.conf0 & RMT_DMA_ACCESS_EN) !== 0;
  }

  private rmtTxDmaSourceSymbols(): number[] {
    const ch =
      this.gdmaTx.find((tx) => tx.active && tx.periSel === GDMA_PERI_RMT) ??
      this.gdmaTx.find((tx) => tx.started && tx.periSel === GDMA_PERI_RMT);
    return ch === undefined ? [] : this.gdmaReadTxSymbols(ch);
  }

  private rmtTxSourceSymbols(chIndex: number, ch: RmtTxChannel): number[] {
    if (this.rmtTxDmaMode(chIndex, ch)) return this.rmtTxDmaSourceSymbols();
    if (!this.rmtDirectMemoryMode()) return ch.fifo;
    const capacity = this.rmtTxMemoryCapacity(ch);
    const symbols: number[] = [];
    for (let i = 0; i < capacity; i++) symbols.push(ch.memory[i] ?? 0);
    return symbols;
  }

  private rmtTxSentSymbols(ch: RmtTxChannel, elapsedCycles: number): number {
    if (ch.symbolEndCycles.length === 0 || ch.durationCycles <= 0) return 0;
    let loops = 0;
    let elapsed = Math.max(0, elapsedCycles);
    if (this.rmtTxLoopEnabled(ch)) {
      loops = Math.floor(elapsed / ch.durationCycles);
      elapsed %= ch.durationCycles;
    }
    let sentInLoop = 0;
    for (const endCycle of ch.symbolEndCycles) {
      if (elapsed < endCycle) break;
      sentInLoop++;
    }
    return loops * ch.symbolEndCycles.length + sentInLoop;
  }

  private rmtTxThresholdCycle(ch: RmtTxChannel, symbolNumber: number): number | null {
    if (symbolNumber <= 0 || ch.symbolEndCycles.length === 0 || ch.durationCycles <= 0) return null;
    const perLoop = ch.symbolEndCycles.length;
    const zeroBased = symbolNumber - 1;
    const loops = Math.floor(zeroBased / perLoop);
    if (!this.rmtTxLoopEnabled(ch) && loops > 0) return null;
    const index = zeroBased % perLoop;
    return loops * ch.durationCycles + (ch.symbolEndCycles[index] ?? 0);
  }

  private rmtTxStatusWord(ch: RmtTxChannel): number {
    const elapsed = this.cpu.cycles - ch.startCycle;
    const readCursor = ch.active ? this.rmtTxSentSymbols(ch, elapsed) : 0;
    const state = ch.active ? 1 : 0;
    const drainedPastMemory = this.rmtTxMemoryCapacity(ch) <= readCursor;
    const memEmpty = ch.active && !this.rmtTxLoopEnabled(ch) && drainedPastMemory && (ch.conf0 & RMT_MEM_TX_WRAP_EN) === 0 ? 1 : 0;
    return (
      (readCursor & 0x3ff) |
      ((ch.apbWriteCursor & 0x3ff) << 11) |
      ((state & 0x07) << 22) |
      (memEmpty << 25) |
      ((ch.apbWriteError ? 1 : 0) << 26)
    );
  }

  private rmtRxDivider(ch: RmtRxChannel): number {
    const raw = ch.conf0 & RMT_RX_DIV_CNT_MASK;
    return raw === 0 ? 256 : raw;
  }

  private rmtRxCyclesPerTick(ch: RmtRxChannel): number | null {
    const groupCycles = this.rmtGroupCyclesPerTick();
    if (groupCycles === null) return null;
    return Math.max(1, groupCycles * this.rmtRxDivider(ch));
  }

  private gpioPadLevel(gpio: number): DigitalLevel {
    const driven = this.driven[gpio];
    if (driven !== undefined) return driven;
    const bank = gpio >> 5;
    const bit = 1 << (gpio & 31);
    return ((this.inLevels[bank] ?? 0) & bit) !== 0 ? 1 : 0;
  }

  private rmtRawRxInputLevel(rxIndex: number): DigitalLevel | null {
    const cfg = this.gpioFuncIn[RMT_SIGNAL_BASE + rxIndex] ?? 0;
    if ((cfg & GPIO_SIG_IN_SEL) === 0) return null;
    const gpio = cfg & GPIO_FUNC_IN_SEL_MASK;
    if (gpio >= PIN_COUNT) return null;
    let level = this.gpioPadLevel(gpio);
    if ((cfg & GPIO_FUNC_IN_INV_SEL) !== 0) level = level === 1 ? 0 : 1;
    return level;
  }

  private rmtRxCarrierEnabled(ch: RmtRxChannel): boolean {
    return (ch.conf0 & RMT_RX_CARRIER_EN) !== 0;
  }

  private rmtRxCarrierActiveLevel(ch: RmtRxChannel): DigitalLevel {
    return (ch.conf0 & RMT_RX_CARRIER_OUT_LV) !== 0 ? 1 : 0;
  }

  private rmtRxCarrierThreshold(ch: RmtRxChannel, level: DigitalLevel): number {
    const active = this.rmtRxCarrierActiveLevel(ch);
    const raw = level === active ? (ch.carrierRm >>> 16) & RMT_RX_CARRIER_THRES_MASK : ch.carrierRm & RMT_RX_CARRIER_THRES_MASK;
    return raw + 1;
  }

  private rmtRxTicksBetween(ch: RmtRxChannel, start: number, end: number): number | null {
    const cyclesPerTick = this.rmtRxCyclesPerTick(ch);
    if (cyclesPerTick === null) return null;
    return Math.max(0, Math.round((end - start) / cyclesPerTick));
  }

  private rmtRxIdleThreshold(ch: RmtRxChannel): number {
    return (ch.conf0 >>> RMT_RX_IDLE_THRES_SHIFT) & RMT_RX_IDLE_THRES_MASK;
  }

  private rmtRxMemoryCapacity(ch: RmtRxChannel): number {
    const blocks = (ch.conf0 >>> RMT_RX_MEM_SIZE_SHIFT) & RMT_RX_MEM_SIZE_MASK;
    return Math.max(1, blocks) * RMT_RX_SYMBOLS_PER_BLOCK;
  }

  private rmtRxMemoryBase(chIndex: number): number {
    return (chIndex + RMT_TX_CHANNELS) * RMT_RX_SYMBOLS_PER_BLOCK;
  }

  private rmtRxStatusWord(chIndex: number, ch: RmtRxChannel): number {
    const base = this.rmtRxMemoryBase(chIndex);
    const writeAddr = (base + ch.writeCursor) & 0x3ff;
    const readAddr = (base + ch.readCursor) & 0x3ff;
    const state = ch.active ? 1 : 0;
    return (
      writeAddr |
      (readAddr << 11) |
      ((state & 0x07) << 22) |
      ((ch.memoryFull ? 1 : 0) << 26) |
      ((ch.apbReadError ? 1 : 0) << 27)
    );
  }

  private rmtReadRxData(ch: RmtRxChannel): number {
    const capacity = this.rmtRxMemoryCapacity(ch);
    if (this.rmtDirectMemoryMode() && ch.readCursor >= capacity) {
      ch.apbReadError = true;
      return 0;
    }
    const value = ch.memory[ch.readCursor] ?? 0;
    ch.readCursor++;
    return value >>> 0;
  }

  private rmtRxLimit(ch: RmtRxChannel): number {
    return ch.rxLim & RMT_RX_LIM_MASK;
  }

  private rmtRxDmaMode(chIndex: number, ch: RmtRxChannel): boolean {
    return chIndex === RMT_RX_CHANNELS - 1 && (ch.conf0 & RMT_RX_DMA_ACCESS_EN) !== 0;
  }

  private rmtResetRxWriter(ch: RmtRxChannel): void {
    ch.memory = [];
    ch.writeCursor = 0;
    ch.capturedSymbols = 0;
    ch.memoryFull = false;
    ch.pending = null;
    ch.started = false;
    ch.rawCycle = this.cpu.cycles;
    ch.rawLevel = 0;
    ch.lastCycle = this.cpu.cycles;
    ch.lastLevel = 0;
    ch.thresholdFired = false;
  }

  private rmtResetRxApbReader(ch: RmtRxChannel): void {
    ch.readCursor = 0;
    ch.apbReadError = false;
  }

  private rmtStartRx(chIndex: number): void {
    const ch = this.rmtRx[chIndex];
    if (ch === undefined) return;
    this.rmtIntRaw &= ~((1 << (RMT_RX_END_INT_BASE + chIndex)) | (1 << (RMT_RX_ERR_INT_BASE + chIndex)) | (1 << (RMT_RX_THR_INT_BASE + chIndex)));
    ch.active = true;
    ch.started = false;
    ch.pending = null;
    ch.thresholdFired = false;
    ch.rawCycle = this.cpu.cycles;
    ch.rawLevel = this.rmtRawRxInputLevel(chIndex) ?? 0;
    ch.lastCycle = this.cpu.cycles;
    ch.lastLevel = ch.rawLevel;
    this.recomputeIrq();
  }

  private rmtStopRx(ch: RmtRxChannel): void {
    ch.active = false;
    ch.started = false;
    ch.pending = null;
  }

  private rmtPushRxHalf(chIndex: number, duration: number, level: DigitalLevel): boolean {
    const ch = this.rmtRx[chIndex];
    if (ch === undefined || duration <= 0) return false;
    const half: RmtRxHalfPulse = { duration: Math.min(duration, 0x7fff), level };
    if (ch.pending === null) {
      ch.pending = half;
      return false;
    }
    const first = ch.pending;
    ch.pending = null;
    const symbol = (first.duration | (first.level << 15) | (half.duration << 16) | (half.level << 31)) >>> 0;
    if (this.rmtRxDmaMode(chIndex, ch)) return this.gdmaPushRmtRxWord(symbol);
    const capacity = this.rmtRxMemoryCapacity(ch);
    if (ch.writeCursor >= capacity) {
      if ((ch.conf1 & RMT_MEM_RX_WRAP_EN) === 0) {
        ch.memoryFull = true;
        ch.active = false;
        this.rmtIntRaw |= 1 << (RMT_RX_ERR_INT_BASE + chIndex);
        return true;
      }
      ch.writeCursor = 0;
    }
    ch.memory[ch.writeCursor] = symbol;
    ch.writeCursor++;
    ch.capturedSymbols++;
    if (ch.writeCursor >= capacity && (ch.conf1 & RMT_MEM_RX_WRAP_EN) !== 0) ch.writeCursor = 0;
    if (ch.writeCursor >= capacity) ch.memoryFull = true;
    const limit = this.rmtRxLimit(ch);
    if (!ch.thresholdFired && limit > 0 && ch.capturedSymbols >= limit) {
      ch.thresholdFired = true;
      this.rmtIntRaw |= 1 << (RMT_RX_THR_INT_BASE + chIndex);
      return true;
    }
    return false;
  }

  private rmtCaptureRxEdge(chIndex: number, nextLevel: DigitalLevel, now: number): boolean {
    const ch = this.rmtRx[chIndex];
    if (ch === undefined || !ch.active || (ch.conf1 & RMT_MEM_OWNER_RX) === 0) return false;
    if (!ch.started) {
      ch.started = true;
      ch.lastLevel = nextLevel;
      ch.lastCycle = now;
      return false;
    }
    if (nextLevel === ch.lastLevel) return false;
    const cyclesPerTick = this.rmtRxCyclesPerTick(ch);
    if (cyclesPerTick === null) return false;
    const duration = Math.max(1, Math.round((now - ch.lastCycle) / cyclesPerTick));
    const filter = (ch.conf1 >>> RMT_RX_FILTER_THRES_SHIFT) & RMT_RX_FILTER_THRES_MASK;
    let changed = false;
    if ((ch.conf1 & RMT_RX_FILTER_EN) === 0 || duration >= filter) {
      changed = this.rmtPushRxHalf(chIndex, duration, ch.lastLevel);
    }
    ch.lastLevel = nextLevel;
    ch.lastCycle = now;
    return changed;
  }

  private rmtMaybeFlushRxCarrierGap(chIndex: number, now: number): boolean {
    const ch = this.rmtRx[chIndex];
    if (ch === undefined || !ch.active || !this.rmtRxCarrierEnabled(ch)) return false;
    const active = this.rmtRxCarrierActiveLevel(ch);
    if (ch.rawLevel === active || ch.lastLevel !== active) return false;
    const gapTicks = this.rmtRxTicksBetween(ch, ch.rawCycle, now);
    if (gapTicks === null || gapTicks <= this.rmtRxCarrierThreshold(ch, ch.rawLevel)) return false;
    return this.rmtCaptureRxEdge(chIndex, ch.rawLevel, ch.rawCycle);
  }

  private rmtCaptureCarrierAwareRxEdge(chIndex: number, rawLevel: DigitalLevel, now: number): boolean {
    const ch = this.rmtRx[chIndex];
    if (ch === undefined || !ch.active) return false;
    if (!this.rmtRxCarrierEnabled(ch)) {
      ch.rawLevel = rawLevel;
      ch.rawCycle = now;
      return this.rmtCaptureRxEdge(chIndex, rawLevel, now);
    }

    const previousRawLevel = ch.rawLevel;
    const previousRawCycle = ch.rawCycle;
    const active = this.rmtRxCarrierActiveLevel(ch);

    if (!ch.started) {
      ch.rawLevel = rawLevel;
      ch.rawCycle = now;
      if (rawLevel !== active) return false;
      return this.rmtCaptureRxEdge(chIndex, rawLevel, now);
    }

    if (rawLevel !== active) {
      ch.rawLevel = rawLevel;
      ch.rawCycle = now;
      return false;
    }

    let changed = false;
    if (previousRawLevel !== active) {
      const gapTicks = this.rmtRxTicksBetween(ch, previousRawCycle, now);
      if (gapTicks !== null && gapTicks > this.rmtRxCarrierThreshold(ch, previousRawLevel)) {
        changed = this.rmtCaptureRxEdge(chIndex, previousRawLevel, previousRawCycle) || changed;
      }
    }

    ch.rawLevel = rawLevel;
    ch.rawCycle = now;

    if (previousRawLevel !== active) {
      const gapTicks = this.rmtRxTicksBetween(ch, previousRawCycle, now);
      if (gapTicks !== null && gapTicks <= this.rmtRxCarrierThreshold(ch, previousRawLevel)) return changed;
    }
    return this.rmtCaptureRxEdge(chIndex, rawLevel, now) || changed;
  }

  private captureRmtRxInputs(): boolean {
    let changed = false;
    const now = this.cpu.cycles;
    for (let i = 0; i < RMT_RX_CHANNELS; i++) {
      const ch = this.rmtRx[i];
      const level = this.rmtRawRxInputLevel(i);
      if (ch === undefined || level === null || !ch.active) continue;
      if (level === ch.rawLevel) {
        changed = this.rmtMaybeFlushRxCarrierGap(i, now) || changed;
        continue;
      }
      changed = this.rmtCaptureCarrierAwareRxEdge(i, level, now) || changed;
    }
    return changed;
  }

  private rmtIdleLevel(ch: RmtTxChannel): DigitalLevel {
    return (ch.conf0 & RMT_IDLE_OUT_EN) !== 0 && (ch.conf0 & RMT_IDLE_OUT_LV) !== 0 ? 1 : 0;
  }

  private rmtCarrierActiveLevel(ch: RmtTxChannel): DigitalLevel {
    return (ch.conf0 & RMT_CARRIER_OUT_LV) !== 0 ? 1 : 0;
  }

  private rmtCarrierLevel(ch: RmtTxChannel, elapsedCycles: number): DigitalLevel | null {
    if ((ch.conf0 & RMT_CARRIER_EN) === 0) return null;
    const cyclesPerCarrierTick = this.rmtGroupCyclesPerTick();
    if (cyclesPerCarrierTick === null) return null;
    const highTicks = (ch.carrierDuty >>> 16) & 0xffff;
    const lowTicks = ch.carrierDuty & 0xffff;
    const active = this.rmtCarrierActiveLevel(ch);
    if (highTicks === 0 && lowTicks === 0) return null;
    if (highTicks === 0) return active === 1 ? 0 : 1;
    if (lowTicks === 0) return active;
    const carrierTick = Math.floor(Math.max(0, elapsedCycles) / cyclesPerCarrierTick);
    const phase = carrierTick % (highTicks + lowTicks);
    return phase < highTicks ? active : active === 1 ? 0 : 1;
  }

  private rmtMaybeApplyCarrier(ch: RmtTxChannel, baseLevel: DigitalLevel, elapsedCycles: number): DigitalLevel {
    if (baseLevel !== this.rmtCarrierActiveLevel(ch)) return baseLevel;
    return this.rmtCarrierLevel(ch, elapsedCycles) ?? baseLevel;
  }

  private rmtStopTx(ch: RmtTxChannel): void {
    ch.active = false;
    ch.startCycle = this.cpu.cycles;
    ch.durationCycles = 0;
    ch.segments = [];
    ch.symbolEndCycles = [];
    ch.nextThresholdSymbol = 0;
    ch.loopFired = false;
  }

  private rmtBuildTxWaveform(chIndex: number, ch: RmtTxChannel): void {
    const cyclesPerTick = this.rmtCyclesPerTick(ch);
    const sourceSymbols = this.rmtTxSourceSymbols(chIndex, ch);
    const segments: RmtTxSegment[] = [];
    const symbolEndCycles: number[] = [];
    let elapsed = 0;
    if (cyclesPerTick !== null) {
      for (const symbol of sourceSymbols) {
        const duration0 = symbol & 0x7fff;
        const level0 = ((symbol >>> 15) & 1) as DigitalLevel;
        const duration1 = (symbol >>> 16) & 0x7fff;
        const level1 = ((symbol >>> 31) & 1) as DigitalLevel;
        if (duration0 === 0) break;
        elapsed += duration0 * cyclesPerTick;
        segments.push({ endCycle: elapsed, level: level0 });
        if (duration1 === 0) {
          symbolEndCycles.push(elapsed);
          break;
        }
        elapsed += duration1 * cyclesPerTick;
        segments.push({ endCycle: elapsed, level: level1 });
        symbolEndCycles.push(elapsed);
      }
    }
    ch.durationCycles = elapsed;
    ch.segments = segments;
    ch.symbolEndCycles = symbolEndCycles;
  }

  private rmtStartTx(chIndex: number): void {
    const ch = this.rmtTx[chIndex];
    if (ch === undefined) return;
    this.rmtIntRaw &= ~((1 << chIndex) | (1 << (8 + chIndex)) | (1 << (12 + chIndex)));
    this.rmtBuildTxWaveform(chIndex, ch);
    if (!this.rmtDirectMemoryMode() && !this.rmtTxDmaMode(chIndex, ch)) ch.fifo = [];
    ch.startCycle = this.cpu.cycles;
    ch.nextThresholdSymbol = this.rmtTxLimit(ch);
    ch.loopFired = false;
    ch.active = ch.segments.length > 0;
    if (!ch.active) this.rmtIntRaw |= 1 << chIndex;
    this.recomputeIrq();
  }

  private rmtTxLimit(ch: RmtTxChannel): number {
    return ch.txLim & RMT_TX_LIM_MASK;
  }

  private rmtTxLoopNumber(ch: RmtTxChannel): number {
    return (ch.txLim >>> RMT_TX_LOOP_NUM_SHIFT) & RMT_TX_LOOP_NUM_MASK;
  }

  private rmtTxLoopEnabled(ch: RmtTxChannel): boolean {
    return (ch.conf0 & RMT_TX_CONTI_MODE) !== 0;
  }

  private checkRmt(): void {
    let changed = false;
    changed = this.captureRmtRxInputs() || changed;
    const now = this.cpu.cycles;
    for (let i = 0; i < RMT_RX_CHANNELS; i++) {
      const ch = this.rmtRx[i];
      if (ch === undefined || !ch.active || !ch.started) continue;
      const cyclesPerTick = this.rmtRxCyclesPerTick(ch);
      if (cyclesPerTick === null) continue;
      const idleThreshold = this.rmtRxIdleThreshold(ch);
      if (idleThreshold === 0) continue;
      const idleTicks = Math.floor((now - ch.lastCycle) / cyclesPerTick);
      if (idleTicks < idleThreshold) continue;
      const level = ch.lastLevel;
      const dmaMode = this.rmtRxDmaMode(i, ch);
      changed = this.rmtPushRxHalf(i, Math.min(idleTicks, RMT_RX_IDLE_THRES_MASK), level) || changed;
      ch.active = false;
      ch.started = false;
      ch.pending = null;
      if (dmaMode) changed = this.gdmaFinishRmtRx() || changed;
      else this.rmtIntRaw |= 1 << (RMT_RX_END_INT_BASE + i);
      changed = true;
    }
    for (let i = 0; i < RMT_TX_CHANNELS; i++) {
      const ch = this.rmtTx[i];
      if (ch === undefined || !ch.active) continue;
      const elapsed = this.cpu.cycles - ch.startCycle;
      const limit = this.rmtTxLimit(ch);
      const thresholdBit = 1 << (8 + i);
      if (limit > 0 && ch.nextThresholdSymbol > 0 && (this.rmtIntRaw & thresholdBit) === 0) {
        const thresholdCycle = this.rmtTxThresholdCycle(ch, ch.nextThresholdSymbol);
        if (thresholdCycle !== null && elapsed >= thresholdCycle) {
          this.rmtIntRaw |= thresholdBit;
          ch.nextThresholdSymbol += limit;
          changed = true;
        }
      }

      if (ch.durationCycles <= 0) {
        ch.active = false;
        this.rmtIntRaw |= 1 << i;
        changed = true;
        continue;
      }

      if (this.rmtTxLoopEnabled(ch)) {
        const completedLoops = Math.floor(elapsed / ch.durationCycles);
        const loopNumber = this.rmtTxLoopNumber(ch);
        const countDone = (ch.txLim & RMT_TX_LOOP_CNT_EN) !== 0 && loopNumber > 0 && completedLoops >= loopNumber;
        if (countDone && !ch.loopFired) {
          ch.loopFired = true;
          this.rmtIntRaw |= 1 << (12 + i);
          changed = true;
        }
        if (countDone && (ch.txLim & RMT_LOOP_STOP_EN) !== 0) {
          ch.active = false;
          this.rmtIntRaw |= 1 << i;
          changed = true;
        }
        continue;
      }

      if (elapsed < ch.durationCycles) continue;
      ch.active = false;
      this.rmtIntRaw |= 1 << i;
      changed = true;
    }
    if (changed) this.recomputeIrq();
  }

  private rmtSignalLevel(signal: number): DigitalLevel | null {
    const chIndex = signal - RMT_SIGNAL_BASE;
    const ch = this.rmtTx[chIndex];
    if (ch === undefined) return null;
    if (!ch.active) {
      if ((ch.conf0 & RMT_CARRIER_EFF_EN) === 0) return this.rmtCarrierLevel(ch, this.cpu.cycles - ch.startCycle) ?? this.rmtIdleLevel(ch);
      return this.rmtIdleLevel(ch);
    }
    let elapsed = Math.max(0, this.cpu.cycles - ch.startCycle);
    if (this.rmtTxLoopEnabled(ch) && ch.durationCycles > 0) elapsed %= ch.durationCycles;
    for (const segment of ch.segments) {
      if (elapsed < segment.endCycle) return this.rmtMaybeApplyCarrier(ch, segment.level, elapsed);
    }
    return this.rmtIdleLevel(ch);
  }

  private routedSignalLevel(signal: number): DigitalLevel | null {
    return this.ledcSignalLevel(signal) ?? this.rmtSignalLevel(signal);
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
    const ledcPending = (this.ledcIntRaw & this.ledcIntEna) !== 0;
    const rmtPending = (this.rmtIntRaw & this.rmtIntEna) !== 0;
    const apbAdcPending = (this.apbSaradcIntRaw & this.apbSaradcIntEna) !== 0;
    const rtcPending = (this.rtcIntRaw & this.rtcIntEna) !== 0;
    const masks: InterruptMapPair = [0, 0];
    const raise = (maps: InterruptMapPair): void => {
      masks[0] |= 1 << (maps[0] & 31);
      masks[1] |= 1 << (maps[1] & 31);
    };
    if (gpioPending) raise(this.gpioIntMaps);
    if (uartPending) raise(this.uartIntMaps);
    if (ledcPending) raise(this.ledcIntMaps);
    if (rmtPending) raise(this.rmtIntMaps);
    if (apbAdcPending) raise(this.apbSaradcIntMaps);
    if (rtcPending) raise(this.rtcCoreIntMaps);
    for (let i = 0; i < SYSTEM_CPU_INTR_FROM_CPU_COUNT; i++) {
      const maps = this.fromCpuIntMaps[i];
      if ((this.fromCpuIntRaw[i] ?? 0) !== 0 && maps !== undefined) raise(maps);
    }
    // Each TIMG source (T0/T1/WDT × both groups) drives its own map.
    for (const grp of this.timg) {
      const pending = grp.intRaw & grp.intEna & 7;
      for (let i = 0; i < 3; i++) {
        if ((pending & (1 << i)) === 0) continue;
        for (const core of [0, 1] as const) {
          masks[core] |= 1 << ((grp.maps[core][i] ?? INTMTX_DEFAULT_MAP) & 31);
        }
      }
    }
    for (const ch of this.gdmaRx) {
      if ((ch.intRaw & ch.intEna) !== 0) raise(ch.maps);
    }
    for (const ch of this.gdmaTx) {
      if ((ch.intRaw & ch.intEna) !== 0) raise(ch.maps);
    }
    this.cpu.setExtInt(masks[0]);
    this.cpu1.setExtInt(masks[1]);
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
      const cfg = this.gpioFuncOut[gpio] ?? GPIO_FUNC_OUT_SEL_RESET;
      const routed = this.routedSignalLevel(cfg & GPIO_FUNC_OUT_SEL_MASK);
      let level: DigitalLevel = routed ?? (((this.out[bank] ?? 0) & bit) !== 0 ? 1 : 0);
      if (routed !== null && (cfg & GPIO_FUNC_OUT_INV_SEL) !== 0) level = level === 1 ? 0 : 1;
      const prev = this.driven[gpio];
      if (prev !== undefined && prev !== level) {
        this.events.push({ pin: esp32s3PinId(gpio), level, cycle: this.now() });
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

  /** Write the trap's return value into the callee window's a2 — of
   *  whichever core took the trap (either core may call ROM). */
  private romRet(v: number): void {
    this.active.phys[(this.active.windowBase * 4 + 2) & (this.active.phys.length - 1)] = v | 0;
  }

  private romTrap(fn: number): void {
    const arg = (i: number): number => this.active.a(2 + i);
    switch (fn) {
      case 0x400005d0: // ets_printf
        this.romRet(this.romPrintf());
        break;
      case 0x40000600: // ets_delay_us — burn cycles at the modeled 240 MHz.
        // One jump, not a loop: a CCOMPARE0 equality strictly inside
        // the skipped span is missed (honest cut — the header says so).
        // Burns the CALLING core's cycles.
        this.active.cycles += (arg(0) >>> 0) * CYCLES_PER_US;
        break;
      case 0x40000648: { // uart_tx_one_char — returns 0 (OK)
        this.txBuffer.push(arg(0) & 0xff);
        this.uartTxDone = true;
        this.recomputeIrq();
        this.romRet(0);
        break;
      }
      case 0x400006d8: // software_reset — never returns; step() resets.
        // The ROM routine asserts RTC_CNTL_SW_SYS_RST, so the next
        // boot reads RTC_SW_SYS_RESET (3) in RESET_STATE (rom/rtc.h)
        // — a system reset, so BOTH cause fields read 3.
        this.resetCause = RESET_CAUSE_SW_SYS;
        this.appResetCause = RESET_CAUSE_SW_SYS;
        this.pendingReset = true;
        break;
      case 0x40000720: // ets_set_appcpu_boot_addr(addr) — slice 12.
        // The real ROM stores it where core 1's wait loop polls;
        // here it's the last release condition for core 1.
        this.appBootAddr = arg(0) >>> 0;
        this.maybeStartCore1();
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
      return this.active.a(3 + argIdx++) | 0;
    };
    const out: number[] = [];
    const emitStr = (str: string): void => {
      for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff);
    };
    let p = this.active.a(2) >>> 0;
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
      if (off >= GPIO_FUNC0_IN_SEL_CFG && off < GPIO_FUNC_IN_SEL_LAST && (off & 3) === 0) {
        return (this.gpioFuncIn[(off - GPIO_FUNC0_IN_SEL_CFG) >> 2] ?? 0) >>> 0;
      }
      if (off >= GPIO_FUNC0_OUT_SEL_CFG && off < GPIO_FUNC0_OUT_SEL_CFG + 4 * PIN_COUNT && (off & 3) === 0) {
        return (this.gpioFuncOut[(off - GPIO_FUNC0_OUT_SEL_CFG) >> 2] ?? GPIO_FUNC_OUT_SEL_RESET) >>> 0;
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
      const core = (off >= INTMTX_CORE1_OFFSET ? 1 : 0) as InterruptCore;
      const sourceOff = off - core * INTMTX_CORE1_OFFSET;
      if (sourceOff === INTMTX_GPIO_MAP) return this.gpioIntMaps[core];
      if (sourceOff === INTMTX_UART_MAP) return this.uartIntMaps[core];
      if (sourceOff === INTMTX_LEDC_MAP) return this.ledcIntMaps[core];
      if (sourceOff === INTMTX_RTC_CORE_MAP) return this.rtcCoreIntMaps[core];
      if (sourceOff === INTMTX_RMT_MAP) return this.rmtIntMaps[core];
      if (sourceOff >= INTMTX_TG_MAPS && sourceOff < INTMTX_TG_MAPS + 24 && (sourceOff & 3) === 0) {
        const idx = (sourceOff - INTMTX_TG_MAPS) >> 2; // group-major [t0,t1,wdt]
        return this.timg[idx < 3 ? 0 : 1]?.maps[core][idx % 3] ?? INTMTX_DEFAULT_MAP;
      }
      if (sourceOff === INTMTX_APB_ADC_MAP) return this.apbSaradcIntMaps[core];
      if (sourceOff >= INTMTX_GDMA_IN_MAPS && sourceOff < INTMTX_GDMA_IN_MAPS + GDMA_RX_CHANNELS * 4 && (sourceOff & 3) === 0) {
        return this.gdmaRx[(sourceOff - INTMTX_GDMA_IN_MAPS) >> 2]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      }
      if (sourceOff >= INTMTX_GDMA_OUT_MAPS && sourceOff < INTMTX_GDMA_OUT_MAPS + GDMA_CHANNELS * 4 && (sourceOff & 3) === 0) {
        return this.gdmaTx[(sourceOff - INTMTX_GDMA_OUT_MAPS) >> 2]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      }
      if (sourceOff >= INTMTX_FROM_CPU_MAPS && sourceOff < INTMTX_FROM_CPU_MAPS + SYSTEM_CPU_INTR_FROM_CPU_COUNT * 4 && (sourceOff & 3) === 0) {
        return this.fromCpuIntMaps[(sourceOff - INTMTX_FROM_CPU_MAPS) >> 2]?.[core] ?? INTMTX_DEFAULT_MAP;
      }
      return INTMTX_DEFAULT_MAP; // unmodeled sources sit at their reset map
    }
    if (addr >= RMT_BASE && addr < RMT_BASE + 0x1000) {
      const off = addr - RMT_BASE;
      if (off >= RMT_CHDATA && off < RMT_CHDATA + (RMT_TX_CHANNELS + RMT_RX_CHANNELS) * RMT_CHDATA_STRIDE && (off & 3) === 0) {
        const channel = (off - RMT_CHDATA) >> 2;
        if (channel < RMT_TX_CHANNELS) return 0;
        const ch = this.rmtRx[channel - RMT_TX_CHANNELS];
        if (ch === undefined) return 0;
        return this.rmtReadRxData(ch);
      }
      if (off >= RMT_CHCONF0 && off < RMT_CHCONF0 + RMT_TX_CHANNELS * RMT_CHCONF0_STRIDE && (off & 3) === 0) {
        return this.rmtTx[(off - RMT_CHCONF0) >> 2]?.conf0 ?? 0;
      }
      if (off >= RMT_CHMCONF0 && off < RMT_CHMCONF0 + RMT_RX_CHANNELS * RMT_CHMCONF_STRIDE && (off - RMT_CHMCONF0) % RMT_CHMCONF_STRIDE === 0) {
        return this.rmtRx[(off - RMT_CHMCONF0) / RMT_CHMCONF_STRIDE]?.conf0 ?? 0;
      }
      if (off >= RMT_CHMCONF1 && off < RMT_CHMCONF1 + RMT_RX_CHANNELS * RMT_CHMCONF_STRIDE && (off - RMT_CHMCONF1) % RMT_CHMCONF_STRIDE === 0) {
        return this.rmtRx[(off - RMT_CHMCONF1) / RMT_CHMCONF_STRIDE]?.conf1 ?? RMT_RX_CONF1_RESET;
      }
      if (off >= RMT_CHSTATUS && off < RMT_CHSTATUS + RMT_TX_CHANNELS * RMT_CHSTATUS_STRIDE && (off & 3) === 0) {
        const ch = this.rmtTx[(off - RMT_CHSTATUS) >> 2];
        return ch === undefined ? 0 : this.rmtTxStatusWord(ch) >>> 0;
      }
      if (
        off >= RMT_CHSTATUS + RMT_TX_CHANNELS * RMT_CHSTATUS_STRIDE &&
        off < RMT_CHSTATUS + (RMT_TX_CHANNELS + RMT_RX_CHANNELS) * RMT_CHSTATUS_STRIDE &&
        (off & 3) === 0
      ) {
        const chIndex = (off - RMT_CHSTATUS - RMT_TX_CHANNELS * RMT_CHSTATUS_STRIDE) >> 2;
        const ch = this.rmtRx[chIndex];
        return ch === undefined ? 0 : this.rmtRxStatusWord(chIndex, ch) >>> 0;
      }
      if (off === RMT_INT_RAW) return this.rmtIntRaw >>> 0;
      if (off === RMT_INT_ST) return (this.rmtIntRaw & this.rmtIntEna) >>> 0;
      if (off === RMT_INT_ENA) return this.rmtIntEna >>> 0;
      if (off === RMT_INT_CLR) return 0;
      if (off >= RMT_CH_CARRIER_DUTY && off < RMT_CH_CARRIER_DUTY + RMT_TX_CHANNELS * RMT_CH_CARRIER_DUTY_STRIDE && (off & 3) === 0) {
        return this.rmtTx[(off - RMT_CH_CARRIER_DUTY) >> 2]?.carrierDuty ?? RMT_CARRIER_DUTY_RESET;
      }
      if (off >= RMT_CH_RX_CARRIER_RM && off < RMT_CH_RX_CARRIER_RM + RMT_RX_CHANNELS * RMT_CH_RX_CARRIER_RM_STRIDE && (off & 3) === 0) {
        return this.rmtRx[(off - RMT_CH_RX_CARRIER_RM) >> 2]?.carrierRm ?? RMT_RX_CARRIER_RM_RESET;
      }
      if (off >= RMT_CH_TX_LIM && off < RMT_CH_TX_LIM + RMT_TX_CHANNELS * RMT_CH_TX_LIM_STRIDE && (off & 3) === 0) {
        return this.rmtTx[(off - RMT_CH_TX_LIM) >> 2]?.txLim ?? RMT_TX_LIM_RESET;
      }
      if (off >= RMT_CH_RX_LIM && off < RMT_CH_RX_LIM + RMT_RX_CHANNELS * RMT_CH_RX_LIM_STRIDE && (off & 3) === 0) {
        return this.rmtRx[(off - RMT_CH_RX_LIM) >> 2]?.rxLim ?? RMT_RX_LIM_RESET;
      }
      if (off === RMT_SYS_CONF) return this.rmtSysConf >>> 0;
      if (off === RMT_TX_SIM || off === RMT_REF_CNT_RST) return 0;
      if (off === RMT_DATE) return RMT_DATE_RESET;
      return 0;
    }
    if (addr >= LEDC_BASE && addr < LEDC_BASE + 0x1000) {
      const off = addr - LEDC_BASE;
      if (off < LEDC_CH_STRIDE * LEDC_CHANNELS) {
        const ch = this.ledcChannels[Math.floor(off / LEDC_CH_STRIDE)];
        const toff = off % LEDC_CH_STRIDE;
        if (ch === undefined) return 0;
        if (toff === LEDC_CH_CONF0) return ch.conf0 >>> 0;
        if (toff === LEDC_CH_HPOINT) return ch.hpoint >>> 0;
        if (toff === LEDC_CH_DUTY) return ch.duty >>> 0;
        if (toff === LEDC_CH_CONF1) return ch.conf1 >>> 0;
        if (toff === LEDC_CH_DUTY_R) return ch.dutyRead >>> 0;
        return 0;
      }
      if (off >= LEDC_LSTIMER_CONF && off < LEDC_LSTIMER_CONF + LEDC_TIMERS * LEDC_LSTIMER_STRIDE) {
        const timer = this.ledcTimers[Math.floor((off - LEDC_LSTIMER_CONF) / LEDC_LSTIMER_STRIDE)];
        const toff = (off - LEDC_LSTIMER_CONF) % LEDC_LSTIMER_STRIDE;
        if (timer === undefined) return 0;
        if (toff === 0) return timer.conf >>> 0;
        if (toff === LEDC_LSTIMER_VALUE - LEDC_LSTIMER_CONF) return this.ledcTimerCounter(timer) >>> 0;
        return 0;
      }
      if (off === LEDC_INT_RAW) return this.ledcIntRaw >>> 0;
      if (off === LEDC_INT_ST) return (this.ledcIntRaw & this.ledcIntEna) >>> 0;
      if (off === LEDC_INT_ENA) return this.ledcIntEna >>> 0;
      if (off === LEDC_INT_CLR) return 0;
      if (off === LEDC_CONF) return this.ledcConf >>> 0;
      if (off === LEDC_DATE) return LEDC_DATE_RESET;
      return 0;
    }
    if (addr >= TIMG0_BASE && addr < TIMG1_BASE + 0x1000) {
      // TIMG0 and TIMG1 are contiguous 4 KiB blocks (slice 13).
      const g = addr >= TIMG1_BASE ? 1 : 0;
      const grp = this.timg[g];
      const off = addr - (g === 1 ? TIMG1_BASE : TIMG0_BASE);
      if (grp === undefined) return 0;
      if (off < TIMG_WDTCONFIG0) {
        const ti = off >= TIMG_T1_SHIFT ? 1 : 0;
        const t = grp.timers[ti];
        const toff = off - ti * TIMG_T1_SHIFT;
        if (t === undefined) return 0;
        if (toff === TIMG_T0CONFIG) return t.config >>> 0;
        if (toff === TIMG_T0LO) return t.latchLo >>> 0;
        if (toff === TIMG_T0HI) return t.latchHi >>> 0;
        if (toff === TIMG_T0UPDATE) return 0; // capture completes instantly
        if (toff === TIMG_T0ALARMLO) return t.alarmLo >>> 0;
        if (toff === TIMG_T0ALARMHI) return t.alarmHi >>> 0;
        if (toff === TIMG_T0LOADLO) return t.loadLo >>> 0;
        if (toff === TIMG_T0LOADHI) return t.loadHi >>> 0;
        return 0; // LOAD is write-only
      }
      if (off === TIMG_WDTCONFIG0) return grp.wdt.config0 >>> 0;
      if (off === TIMG_WDTCONFIG1) return grp.wdt.config1 >>> 0;
      if (off >= TIMG_WDTCONFIG2 && off < TIMG_WDTFEED && (off & 3) === 0) {
        return (grp.wdt.timeouts[(off - TIMG_WDTCONFIG2) >> 2] ?? 0) >>> 0;
      }
      if (off === TIMG_WDTFEED) return 0; // write-only
      if (off === TIMG_WDTWPROTECT) return grp.wdt.wprotect >>> 0;
      if (off === TIMG_INT_ENA) return grp.intEna;
      if (off === TIMG_INT_RAW) return grp.intRaw;
      if (off === TIMG_INT_ST) return grp.intRaw & grp.intEna;
      return 0;
    }
    if (addr >= GDMA_BASE && addr < GDMA_BASE + GDMA_CHANNELS * GDMA_CH_STRIDE) {
      const rel = addr - GDMA_BASE;
      const chIndex = Math.floor(rel / GDMA_CH_STRIDE);
      const ch = this.gdmaRx[chIndex];
      const tx = this.gdmaTx[chIndex];
      const off = rel % GDMA_CH_STRIDE;
      if (ch !== undefined) {
        if (off === GDMA_IN_CONF0) return ch.conf0 >>> 0;
        if (off === GDMA_IN_CONF1) return ch.conf1 >>> 0;
        if (off === GDMA_IN_INT_RAW) return ch.intRaw >>> 0;
        if (off === GDMA_IN_INT_ST) return (ch.intRaw & ch.intEna) >>> 0;
        if (off === GDMA_IN_INT_ENA) return ch.intEna >>> 0;
        if (off === GDMA_IN_INT_CLR) return 0;
        if (off === GDMA_IN_LINK) return (ch.inLink | (ch.active ? 0 : GDMA_INLINK_PARK)) >>> 0;
        if (off === GDMA_IN_STATE) return ch.currentDesc & 0x3ffff;
        if (off === GDMA_IN_SUC_EOF_DES_ADDR) return ch.sucEofDesc >>> 0;
        if (off === GDMA_IN_ERR_EOF_DES_ADDR) return ch.errEofDesc >>> 0;
        if (off === GDMA_IN_DSCR) return ch.currentDesc >>> 0;
        if (off === GDMA_IN_DSCR_BF0) return ch.descBf0 >>> 0;
        if (off === GDMA_IN_DSCR_BF1) return ch.descBf1 >>> 0;
        if (off === GDMA_IN_WEIGHT) return ch.weight >>> 0;
        if (off === GDMA_IN_PRI) return ch.pri >>> 0;
        if (off === GDMA_IN_PERI_SEL) return ch.periSel >>> 0;
      }
      if (tx !== undefined) {
        if (off === GDMA_OUT_CONF0) return tx.conf0 >>> 0;
        if (off === GDMA_OUT_CONF1) return tx.conf1 >>> 0;
        if (off === GDMA_OUT_INT_RAW) return tx.intRaw >>> 0;
        if (off === GDMA_OUT_INT_ST) return (tx.intRaw & tx.intEna) >>> 0;
        if (off === GDMA_OUT_INT_ENA) return tx.intEna >>> 0;
        if (off === GDMA_OUT_INT_CLR) return 0;
        if (off === GDMA_OUT_LINK) return (tx.outLink | (tx.active ? 0 : GDMA_OUTLINK_PARK)) >>> 0;
        if (off === GDMA_OUT_STATE) return tx.currentDesc & 0x3ffff;
        if (off === GDMA_OUT_EOF_DES_ADDR) return tx.eofDesc >>> 0;
        if (off === GDMA_OUT_EOF_BFR_DES_ADDR) return tx.eofBfrDesc >>> 0;
        if (off === GDMA_OUT_DSCR) return tx.currentDesc >>> 0;
        if (off === GDMA_OUT_DSCR_BF0) return tx.descBf0 >>> 0;
        if (off === GDMA_OUT_DSCR_BF1) return tx.descBf1 >>> 0;
        if (off === GDMA_OUT_WEIGHT) return tx.weight >>> 0;
        if (off === GDMA_OUT_PRI) return tx.pri >>> 0;
        if (off === GDMA_OUT_PERI_SEL) return tx.periSel >>> 0;
      }
      return 0;
    }
    if (addr >= SENS_BASE && addr < SENS_BASE + 0x400) {
      const off = addr - SENS_BASE;
      if (off === SENS_SAR_MEAS1_CTRL2) {
        let v = this.meas1Ctrl2 & ~(MEAS1_DONE_SAR | 0xffff);
        if (this.adcDone) v |= MEAS1_DONE_SAR | (this.adcData & 0xfff);
        return v >>> 0;
      }
      if (off === SENS_SAR_MEAS2_CTRL2) {
        let v = this.meas2Ctrl2 & ~(MEAS2_DONE_SAR | 0xffff);
        if (this.adc2Done) v |= MEAS2_DONE_SAR | (this.adc2Data & 0xfff);
        return v >>> 0;
      }
      return 0;
    }
    if (addr >= APB_SARADC_BASE && addr < APB_SARADC_BASE + 0x400) {
      const off = addr - APB_SARADC_BASE;
      if (off === APB_SARADC_CTRL) return this.apbSaradcCtrl >>> 0;
      if (off === APB_SARADC_CTRL2) return this.apbSaradcCtrl2 >>> 0;
      if (off === APB_SARADC_FSM_WAIT) return this.apbSaradcFsmWait >>> 0;
      if (off === APB_SARADC_SAR1_STATUS || off === APB_SARADC_SAR2_STATUS) return 0;
      if (off >= APB_SARADC_SAR1_PATT_TAB1 && off < APB_SARADC_SAR1_PATT_TAB1 + 16 && (off & 3) === 0) {
        return (this.apbSaradcSar1Patt[(off - APB_SARADC_SAR1_PATT_TAB1) >> 2] ?? 0) >>> 0;
      }
      if (off >= APB_SARADC_SAR2_PATT_TAB1 && off < APB_SARADC_SAR2_PATT_TAB1 + 16 && (off & 3) === 0) {
        return (this.apbSaradcSar2Patt[(off - APB_SARADC_SAR2_PATT_TAB1) >> 2] ?? 0) >>> 0;
      }
      if (off === APB_SARADC_APB_ADC_ARB_CTRL) return this.apbSaradcArbCtrl >>> 0;
      if (off === APB_SARADC_FILTER_CTRL0) return this.apbSaradcFilterCtrl0 >>> 0;
      if (off === APB_SARADC_APB_SARADC1_DATA_STATUS) return (this.apbSaradcDataStatus[0] ?? 0) >>> 0;
      if (off === APB_SARADC_THRES0_CTRL) return (this.apbSaradcThres[0] ?? 0) >>> 0;
      if (off === APB_SARADC_THRES1_CTRL) return (this.apbSaradcThres[1] ?? 0) >>> 0;
      if (off === APB_SARADC_THRES_CTRL) return (this.apbSaradcThres[2] ?? 0) >>> 0;
      if (off === APB_SARADC_INT_ENA) return this.apbSaradcIntEna >>> 0;
      if (off === APB_SARADC_INT_RAW) return this.apbSaradcIntRaw >>> 0;
      if (off === APB_SARADC_INT_ST) return (this.apbSaradcIntRaw & this.apbSaradcIntEna) >>> 0;
      if (off === APB_SARADC_INT_CLR) return 0;
      if (off === APB_SARADC_DMA_CONF) return this.apbSaradcDmaConf >>> 0;
      if (off === APB_SARADC_APB_ADC_CLKM_CONF) return this.apbSaradcClkmConf >>> 0;
      if (off === APB_SARADC_APB_SARADC2_DATA_STATUS) return (this.apbSaradcDataStatus[1] ?? 0) >>> 0;
      if (off === APB_SARADC_APB_CTRL_DATE) return APB_SARADC_DATE_RESET;
      return 0;
    }
    if (addr >= RTCCNTL_BASE && addr < RTCCNTL_END) {
      const off = addr - RTCCNTL_BASE;
      if (off === RTC_OPTIONS0) return this.rtcOptions0 >>> 0; // sw-reset bits are WO — they read 0
      if (off === RTC_SLP_TIMER0) return this.rtcSleepTimerLo >>> 0;
      if (off === RTC_SLP_TIMER1) return this.rtcSleepTimerHi & RTC_SLP_VAL_HI_MASK;
      if (off === RTC_TIME_UPDATE) return 0; // the latch completes instantly
      if (off === RTC_TIME_LOW0) return this.rtcTimeLatchLo >>> 0;
      if (off === RTC_TIME_HIGH0) return this.rtcTimeLatchHi & 0xffff;
      if (off === RTC_STATE0) return (this.rtcState0 & ~(RTC_SLP_REJECT_CAUSE_CLR | RTC_SW_CPU_INT)) >>> 0;
      if (off === RTC_RESET_STATE) {
        // Per-core cause fields (slice 12): PROCPU [5:0], APPCPU [11:6].
        return ((this.appResetCause << 6) | this.resetCause) >>> 0;
      }
      if (off === RTC_WAKEUP_STATE) return this.rtcWakeupState >>> 0;
      if (off === RTC_INT_ENA) return this.rtcIntEna >>> 0;
      if (off === RTC_INT_RAW) return this.rtcIntRaw >>> 0;
      if (off === RTC_INT_ST) return (this.rtcIntRaw & this.rtcIntEna) >>> 0;
      if (off === RTC_INT_CLR) return 0;
      if (off === RTC_EXT_XTL_CONF) return this.rtcExtXtlConf >>> 0;
      if (off === RTC_SW_CPU_STALL) return this.rtcSwCpuStall >>> 0;
      // The RWDT block (slice 13) — modeled for real now.
      if (off === RTC_WDTCONFIG0) return this.rwdt.config0 >>> 0;
      if (off >= RTC_WDTCONFIG1 && off < RTC_WDTFEED && (off & 3) === 0) {
        return (this.rwdt.timeouts[(off - RTC_WDTCONFIG1) >> 2] ?? 0) >>> 0;
      }
      if (off === RTC_WDTFEED) return 0; // the feed bit reads back 0
      if (off === RTC_WDTWPROTECT) return this.rwdt.wprotect >>> 0;
      if (off === RTC_SWD_CONF) return (this.rtcSwdConf & ~(RTC_SWD_FEED | RTC_SWD_RST_FLAG_CLR)) >>> 0;
      if (off === RTC_SWD_WPROTECT) return this.rtcSwdWprotect >>> 0;
      if (off === RTC_COCPU_CTRL) return (this.rtcCocpuCtrl & ~RTC_COCPU_SW_INT_TRIGGER) >>> 0;
      if (off === RTC_BROWN_OUT) return (this.rtcBrownOut & ~RTC_BROWN_OUT_CNT_CLR) >>> 0;
      if (off === RTC_XTAL32K_CONF) return this.rtcXtal32kConf >>> 0;
      if (off === RTC_SLP_REJECT_CAUSE) return this.rtcRejectCause >>> 0;
      if (off === RTC_SLP_WAKEUP_CAUSE) return this.rtcWakeupCause >>> 0;
      if (off === RTC_INT_ENA_W1TS || off === RTC_INT_ENA_W1TC) return 0;
      throw new Error(
        `read of unmodeled RTC_CNTL register 0x${addr.toString(16)} — this core models only ` +
          `OPTIONS0(+0x0), SLP_TIMER0/1(+0x4/+0x8), TIME_UPDATE(+0xc), TIME_LOW0/HIGH0(+0x10/0x14), ` +
          `STATE0(+0x18), RESET_STATE(+0x38), WAKEUP_STATE(+0x3c), INT_* (+0x40..+0x4c), ` +
          `EXT_XTL_CONF(+0x60), ` +
          `the RWDT block (+0x98..+0xb0), SWD(+0xb4/+0xb8), SW_CPU_STALL(+0xbc), COCPU_CTRL(+0x104), ` +
          `BROWN_OUT(+0xe8), XTAL32K_CONF(+0xf8), ` +
          `sleep reject/wakeup causes (+0x128/+0x130); ` +
          `a fabricated 0 here would lie`,
      );
    }
    if (addr >= EFUSE_BASE && addr < EFUSE_BASE + 0x1000) {
      const off = addr - EFUSE_BASE;
      if (off >= EFUSE_PGM_DATA_0 && off < EFUSE_PGM_DATA_0 + EFUSE_PGM_DATA_WORDS * 4 && (off & 3) === 0) {
        return this.efusePgmData[(off - EFUSE_PGM_DATA_0) >> 2] ?? 0;
      }
      if (off >= EFUSE_PGM_CHECK_VALUE_0 && off < EFUSE_PGM_CHECK_VALUE_0 + EFUSE_PGM_CHECK_WORDS * 4 && (off & 3) === 0) {
        return this.efusePgmCheck[(off - EFUSE_PGM_CHECK_VALUE_0) >> 2] ?? 0;
      }
      const efuseWord = this.efuseReadWord(off);
      if (efuseWord !== null) return efuseWord >>> 0;
      if (off >= EFUSE_RD_REPEAT_ERR_0 && off <= EFUSE_RD_REPEAT_ERR_4 && (off & 3) === 0) return 0;
      if (off >= EFUSE_RD_RS_ERR_0 && off <= EFUSE_RD_RS_ERR_1 && (off & 3) === 0) return 0;
      if (off === EFUSE_CLK) return this.efuseClk >>> 0;
      if (off === EFUSE_CONF) return this.efuseConf >>> 0;
      if (off === EFUSE_STATUS) return 0;
      if (off === EFUSE_CMD) return 0; // READ_CMD/PGM_CMD are self-clearing in this model.
      if (off === EFUSE_INT_RAW) return this.efuseIntRaw >>> 0;
      if (off === EFUSE_INT_ST) return (this.efuseIntRaw & this.efuseIntEna) >>> 0;
      if (off === EFUSE_INT_ENA) return this.efuseIntEna >>> 0;
      if (off === EFUSE_INT_CLR) return 0;
      if (off === EFUSE_DAC_CONF) return this.efuseDacConf >>> 0;
      if (off === EFUSE_RD_TIM_CONF) return this.efuseRdTimConf >>> 0;
      if (off === EFUSE_WR_TIM_CONF1) return this.efuseWrTimConf1 >>> 0;
      if (off === EFUSE_WR_TIM_CONF2) return this.efuseWrTimConf2 >>> 0;
      if (off === EFUSE_DATE) return EFUSE_DATE_RESET;
      throw new Error(
        `read of unmodeled eFuse register 0x${addr.toString(16)} — this core models only ` +
          `PGM_DATA0..7(+0x0..+0x1c), BLOCK0..10 readback (+0x2c..+0x178), ` +
          `the programming command/interrupt/timing regs (+0x1c8..+0x1fc), ` +
          `and BLOCK1's synthetic MAC 7A:C0:DE:00:53:33`,
      );
    }
    if (addr >= SYSTEM_BASE && addr < SYSTEM_BASE + 0x1000) {
      const off = addr - SYSTEM_BASE;
      if (off === SYSTEM_CORE_1_CTRL0) return this.core1Ctrl0 >>> 0;
      if (off === SYSTEM_CORE_1_CTRL1) return this.core1Msg >>> 0;
      if (off >= SYSTEM_CPU_INTR_FROM_CPU && off < SYSTEM_CPU_INTR_FROM_CPU + SYSTEM_CPU_INTR_FROM_CPU_COUNT * 4 && (off & 3) === 0) {
        return this.fromCpuIntRaw[(off - SYSTEM_CPU_INTR_FROM_CPU) >> 2] ?? 0;
      }
      if (off === SYSTEM_CPU_PER_CONF) return this.cpuPerConf >>> 0;
      if (off === SYSTEM_SYSCLK_CONF) return this.sysclkConf >>> 0;
      throw new Error(
        `read of unmodeled SYSTEM register 0x${addr.toString(16)} — this core models only ` +
          `CORE_1_CONTROL_0/1(+0x0/+0x4), CPU_INTR_FROM_CPU0..3(+0x30..+0x3c), ` +
          `CPU_PER_CONF(+0x10) and SYSCLK_CONF(+0x60), frozen at the 240 MHz PLL state`,
      );
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
      } else if (off >= GPIO_FUNC0_IN_SEL_CFG && off < GPIO_FUNC_IN_SEL_LAST && (off & 3) === 0) {
        this.gpioFuncIn[(off - GPIO_FUNC0_IN_SEL_CFG) >> 2] = v & 0xff;
        this.captureRmtRxInputs();
      } else if (off >= GPIO_FUNC0_OUT_SEL_CFG && off < GPIO_FUNC0_OUT_SEL_CFG + 4 * PIN_COUNT && (off & 3) === 0) {
        this.gpioFuncOut[(off - GPIO_FUNC0_OUT_SEL_CFG) >> 2] = (v & GPIO_FUNC_OUT_CFG_MASK) | 0;
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
      const core = (off >= INTMTX_CORE1_OFFSET ? 1 : 0) as InterruptCore;
      const sourceOff = off - core * INTMTX_CORE1_OFFSET;
      if (sourceOff === INTMTX_GPIO_MAP) this.gpioIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_UART_MAP) this.uartIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_LEDC_MAP) this.ledcIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_RTC_CORE_MAP) this.rtcCoreIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_RMT_MAP) this.rmtIntMaps[core] = value & 0x1f;
      else if (sourceOff >= INTMTX_TG_MAPS && sourceOff < INTMTX_TG_MAPS + 24 && (sourceOff & 3) === 0) {
        const idx = (sourceOff - INTMTX_TG_MAPS) >> 2;
        const grp = this.timg[idx < 3 ? 0 : 1];
        if (grp !== undefined) grp.maps[core][idx % 3] = value & 0x1f;
      } else if (sourceOff === INTMTX_APB_ADC_MAP) {
        this.apbSaradcIntMaps[core] = value & 0x1f;
      } else if (sourceOff >= INTMTX_GDMA_IN_MAPS && sourceOff < INTMTX_GDMA_IN_MAPS + GDMA_RX_CHANNELS * 4 && (sourceOff & 3) === 0) {
        const ch = this.gdmaRx[(sourceOff - INTMTX_GDMA_IN_MAPS) >> 2];
        if (ch !== undefined) ch.maps[core] = value & 0x1f;
      } else if (sourceOff >= INTMTX_GDMA_OUT_MAPS && sourceOff < INTMTX_GDMA_OUT_MAPS + GDMA_CHANNELS * 4 && (sourceOff & 3) === 0) {
        const ch = this.gdmaTx[(sourceOff - INTMTX_GDMA_OUT_MAPS) >> 2];
        if (ch !== undefined) ch.maps[core] = value & 0x1f;
      } else if (sourceOff >= INTMTX_FROM_CPU_MAPS && sourceOff < INTMTX_FROM_CPU_MAPS + SYSTEM_CPU_INTR_FROM_CPU_COUNT * 4 && (sourceOff & 3) === 0) {
        const maps = this.fromCpuIntMaps[(sourceOff - INTMTX_FROM_CPU_MAPS) >> 2];
        if (maps !== undefined) maps[core] = value & 0x1f;
      }
      // Map writes for unmodeled sources are accepted and dropped —
      // those sources never assert, so the mapping is moot.
      this.recomputeIrq();
      return;
    }
    if (addr >= RMT_BASE && addr < RMT_BASE + 0x1000) {
      const off = addr - RMT_BASE;
      const v = value >>> 0;
      if (off >= RMT_CHDATA && off < RMT_CHDATA + (RMT_TX_CHANNELS + RMT_RX_CHANNELS) * RMT_CHDATA_STRIDE && (off & 3) === 0) {
        const channel = (off - RMT_CHDATA) >> 2;
        if (channel < RMT_TX_CHANNELS) this.rmtWriteTxData(channel, v);
      } else if (off >= RMT_CHCONF0 && off < RMT_CHCONF0 + RMT_TX_CHANNELS * RMT_CHCONF0_STRIDE && (off & 3) === 0) {
        const chIndex = (off - RMT_CHCONF0) >> 2;
        const ch = this.rmtTx[chIndex];
        if (ch !== undefined) {
          ch.conf0 = (v & ~RMT_TX_CONF0_WT_MASK) >>> 0;
          if ((v & RMT_APB_MEM_RST) !== 0) {
            ch.fifo = [];
            ch.apbWriteCursor = 0;
            ch.apbWriteError = false;
          }
          if ((v & RMT_TX_STOP) !== 0) this.rmtStopTx(ch);
          if ((v & RMT_TX_START) !== 0) this.rmtStartTx(chIndex);
        }
      } else if (off >= RMT_CHMCONF0 && off < RMT_CHMCONF0 + RMT_RX_CHANNELS * RMT_CHMCONF_STRIDE && (off - RMT_CHMCONF0) % RMT_CHMCONF_STRIDE === 0) {
        const ch = this.rmtRx[(off - RMT_CHMCONF0) / RMT_CHMCONF_STRIDE];
        if (ch !== undefined) ch.conf0 = v;
      } else if (off >= RMT_CHMCONF1 && off < RMT_CHMCONF1 + RMT_RX_CHANNELS * RMT_CHMCONF_STRIDE && (off - RMT_CHMCONF1) % RMT_CHMCONF_STRIDE === 0) {
        const chIndex = (off - RMT_CHMCONF1) / RMT_CHMCONF_STRIDE;
        const ch = this.rmtRx[chIndex];
        if (ch !== undefined) {
          const wasEnabled = (ch.conf1 & RMT_RX_EN) !== 0;
          ch.conf1 = (v & ~RMT_RX_CONF1_WT_MASK) >>> 0;
          if ((v & RMT_MEM_WR_RST) !== 0) this.rmtResetRxWriter(ch);
          if ((v & RMT_RX_APB_MEM_RST) !== 0) this.rmtResetRxApbReader(ch);
          const nowEnabled = (ch.conf1 & RMT_RX_EN) !== 0;
          if (nowEnabled && !wasEnabled) this.rmtStartRx(chIndex);
          if (!nowEnabled && wasEnabled) this.rmtStopRx(ch);
        }
      } else if (off === RMT_INT_ENA) {
        this.rmtIntEna = v;
        this.recomputeIrq();
      } else if (off === RMT_INT_CLR) {
        this.rmtIntRaw &= ~v;
        this.recomputeIrq();
      } else if (off >= RMT_CH_CARRIER_DUTY && off < RMT_CH_CARRIER_DUTY + RMT_TX_CHANNELS * RMT_CH_CARRIER_DUTY_STRIDE && (off & 3) === 0) {
        const ch = this.rmtTx[(off - RMT_CH_CARRIER_DUTY) >> 2];
        if (ch !== undefined) ch.carrierDuty = v;
      } else if (off >= RMT_CH_RX_CARRIER_RM && off < RMT_CH_RX_CARRIER_RM + RMT_RX_CHANNELS * RMT_CH_RX_CARRIER_RM_STRIDE && (off & 3) === 0) {
        const ch = this.rmtRx[(off - RMT_CH_RX_CARRIER_RM) >> 2];
        if (ch !== undefined) ch.carrierRm = v;
      } else if (off >= RMT_CH_TX_LIM && off < RMT_CH_TX_LIM + RMT_TX_CHANNELS * RMT_CH_TX_LIM_STRIDE && (off & 3) === 0) {
        const ch = this.rmtTx[(off - RMT_CH_TX_LIM) >> 2];
        if (ch !== undefined) {
          ch.txLim = (v & ~RMT_LOOP_COUNT_RESET) >>> 0;
          if ((v & RMT_LOOP_COUNT_RESET) !== 0) {
            ch.startCycle = this.cpu.cycles;
            ch.nextThresholdSymbol = this.rmtTxLimit(ch);
            ch.loopFired = false;
          }
        }
      } else if (off >= RMT_CH_RX_LIM && off < RMT_CH_RX_LIM + RMT_RX_CHANNELS * RMT_CH_RX_LIM_STRIDE && (off & 3) === 0) {
        const ch = this.rmtRx[(off - RMT_CH_RX_LIM) >> 2];
        if (ch !== undefined) ch.rxLim = v;
      } else if (off === RMT_SYS_CONF) {
        this.rmtSysConf = v;
      } else if (off === RMT_REF_CNT_RST) {
        for (let i = 0; i < RMT_TX_CHANNELS; i++) {
          if ((v & (1 << i)) === 0) continue;
          const ch = this.rmtTx[i];
          if (ch !== undefined && ch.active) ch.startCycle = this.cpu.cycles;
        }
      } else if (off === RMT_TX_SIM) {
        for (let i = 0; i < RMT_TX_CHANNELS; i++) {
          if ((v & (1 << i)) !== 0) this.rmtStartTx(i);
        }
      }
      this.syncPins();
      return;
    }
    if (addr >= LEDC_BASE && addr < LEDC_BASE + 0x1000) {
      const off = addr - LEDC_BASE;
      const v = value >>> 0;
      if (off < LEDC_CH_STRIDE * LEDC_CHANNELS) {
        const chIndex = Math.floor(off / LEDC_CH_STRIDE);
        const ch = this.ledcChannels[chIndex];
        const toff = off % LEDC_CH_STRIDE;
        if (ch === undefined) return;
        if (toff === LEDC_CH_CONF0) {
          const prev = ch.conf0;
          ch.conf0 = (v & ~(LEDC_CH_PARA_UP | LEDC_CH_OVF_CNT_RST | LEDC_CH_OVF_CNT_RST_ST)) >>> 0;
          const enabled = (ch.conf0 & LEDC_CH_OVF_CNT_EN) !== 0;
          const wasEnabled = (prev & LEDC_CH_OVF_CNT_EN) !== 0;
          const timerChanged = (prev & LEDC_CH_TIMER_SEL_MASK) !== (ch.conf0 & LEDC_CH_TIMER_SEL_MASK);
          if ((v & LEDC_CH_OVF_CNT_RST) !== 0 || timerChanged || (!wasEnabled && enabled)) this.ledcChannelOvfResync(ch);
          if (timerChanged) this.ledcResyncFade(chIndex, ch);
        }
        else if (toff === LEDC_CH_HPOINT) ch.hpoint = v & LEDC_HPOINT_MASK;
        else if (toff === LEDC_CH_DUTY) ch.duty = v & LEDC_DUTY_MASK;
        else if (toff === LEDC_CH_CONF1) {
          ch.conf1 = v;
          if ((v & LEDC_CH_DUTY_START) !== 0) {
            ch.dutyRead = ch.duty;
            const timer = this.ledcChannelTimer(ch);
            const scale = this.ledcFadeScale(ch);
            const cycle = this.ledcFadeCycle(ch);
            const steps = this.ledcFadeStepNum(ch);
            if (timer !== undefined && scale > 0 && cycle > 0 && steps > 0) {
              ch.fade = {
                baseDuty: ch.duty,
                startSerial: this.ledcTimerOverflowSerial(timer),
                latchedSteps: 0,
              };
            } else {
              this.ledcLatchFixedDuty(chIndex, ch);
            }
          }
        }
        this.syncPins();
        return;
      }
      if (off >= LEDC_LSTIMER_CONF && off < LEDC_LSTIMER_CONF + LEDC_TIMERS * LEDC_LSTIMER_STRIDE) {
        const timerIndex = Math.floor((off - LEDC_LSTIMER_CONF) / LEDC_LSTIMER_STRIDE);
        const timer = this.ledcTimers[timerIndex];
        const toff = (off - LEDC_LSTIMER_CONF) % LEDC_LSTIMER_STRIDE;
        if (timer === undefined) return;
        if (toff === 0) {
          this.ledcTimerResync(timer);
          if ((v & LEDC_TIMER_RST) !== 0) {
            timer.base = 0;
            timer.sync = this.cpu.cycles;
          }
          timer.conf = (v & ~LEDC_TIMER_PARA_UP) >>> 0;
          timer.ovfSerial = this.ledcTimerOverflowSerial(timer);
          this.ledcChannelsOvfResyncForTimer(timerIndex);
        }
        this.syncPins();
        return;
      }
      if (off === LEDC_INT_ENA) {
        this.ledcIntEna = v;
        this.recomputeIrq();
      } else if (off === LEDC_INT_CLR) {
        this.ledcIntRaw &= ~v;
        this.recomputeIrq();
      } else if (off === LEDC_CONF) {
        const prev = this.ledcConf;
        const clockChanged = (prev & (LEDC_CLK_EN | LEDC_APB_CLK_SEL_MASK)) !== (v & (LEDC_CLK_EN | LEDC_APB_CLK_SEL_MASK));
        if (clockChanged) {
          for (const timer of this.ledcTimers) this.ledcTimerResync(timer);
        }
        this.ledcConf = v;
        if (clockChanged) {
          for (let i = 0; i < LEDC_CHANNELS; i++) {
            const ch = this.ledcChannels[i];
            if (ch === undefined) continue;
            this.ledcChannelOvfResync(ch);
            this.ledcResyncFade(i, ch);
          }
        }
      }
      else if (off === LEDC_DATE) return;
      this.syncPins();
      return;
    }
    if (addr >= TIMG0_BASE && addr < TIMG1_BASE + 0x1000) {
      const g = addr >= TIMG1_BASE ? 1 : 0;
      const grp = this.timg[g];
      const off = addr - (g === 1 ? TIMG1_BASE : TIMG0_BASE);
      const v = value >>> 0;
      if (grp === undefined) return;
      if (off < TIMG_WDTCONFIG0) {
        const ti = off >= TIMG_T1_SHIFT ? 1 : 0;
        const t = grp.timers[ti];
        const toff = off - ti * TIMG_T1_SHIFT;
        if (t === undefined) return;
        if (toff === TIMG_T0CONFIG) {
          this.timerResync(t); // freeze under the OLD divider/EN first
          t.config = v | 0;
        } else if (toff === TIMG_T0UPDATE) {
          const val = this.timerValue(t);
          t.latchLo = val % 0x100000000;
          t.latchHi = Math.floor(val / 0x100000000);
        } else if (toff === TIMG_T0ALARMLO) t.alarmLo = v;
        else if (toff === TIMG_T0ALARMHI) t.alarmHi = v & 0x3fffff;
        else if (toff === TIMG_T0LOADLO) t.loadLo = v;
        else if (toff === TIMG_T0LOADHI) t.loadHi = v & 0x3fffff;
        else if (toff === TIMG_T0LOAD) {
          // Any write reloads the counter from {LOADHI, LOADLO}.
          t.base = (t.loadHi * 0x100000000 + t.loadLo) % T_MASK;
          t.sync = this.cpu.cycles;
        }
        this.recomputeIrq();
        return;
      }
      if (off === TIMG_WDTWPROTECT) {
        grp.wdt.wprotect = v; // only the key value unlocks
      } else if (off >= TIMG_WDTCONFIG0 && off <= TIMG_WDTFEED) {
        // MWDT config space — silently ignored while write-protected,
        // exactly the gate wdt_hal opens with the 0x50D83AA1 key.
        if (grp.wdt.wprotect === WDT_WKEY) {
          if (off === TIMG_WDTCONFIG0) {
            grp.wdt.config0 = v;
            grp.wdt.epoch = this.cpu.cycles; // config restarts the count
            grp.wdt.handled = 0;
          } else if (off === TIMG_WDTCONFIG1) {
            grp.wdt.config1 = v;
            grp.wdt.epoch = this.cpu.cycles;
            grp.wdt.handled = 0;
          } else if (off === TIMG_WDTFEED) {
            // "Write any value to feed" — timer_group_reg.h.
            grp.wdt.epoch = this.cpu.cycles;
            grp.wdt.handled = 0;
          } else {
            grp.wdt.timeouts[(off - TIMG_WDTCONFIG2) >> 2] = v;
          }
        }
      } else if (off === TIMG_INT_ENA) grp.intEna = v;
      else if (off === TIMG_INT_CLR) grp.intRaw &= ~v;
      this.recomputeIrq();
      return;
    }
    if (addr >= GDMA_BASE && addr < GDMA_BASE + GDMA_CHANNELS * GDMA_CH_STRIDE) {
      const rel = addr - GDMA_BASE;
      const chIndex = Math.floor(rel / GDMA_CH_STRIDE);
      const ch = this.gdmaRx[chIndex];
      const tx = this.gdmaTx[chIndex];
      const off = rel % GDMA_CH_STRIDE;
      const v = value >>> 0;
      if (ch !== undefined && off === GDMA_IN_CONF0) {
        ch.conf0 = v;
        if ((v & GDMA_IN_RST) !== 0) {
          ch.active = false;
          ch.started = false;
          ch.offset = 0;
          ch.currentDesc = 0;
          ch.intRaw = 0;
          this.recomputeIrq();
        }
      } else if (ch !== undefined && off === GDMA_IN_CONF1) ch.conf1 = v;
      else if (ch !== undefined && off === GDMA_IN_INT_ENA) {
        ch.intEna = v;
        this.recomputeIrq();
      } else if (ch !== undefined && off === GDMA_IN_INT_CLR) {
        ch.intRaw &= ~v;
        this.recomputeIrq();
      }
      else if (ch !== undefined && off === GDMA_IN_LINK) {
        ch.inLink = v & (GDMA_INLINK_ADDR_MASK | GDMA_INLINK_AUTO_RET);
        if ((v & GDMA_INLINK_STOP) !== 0) {
          ch.active = false;
          ch.started = false;
          ch.offset = 0;
          this.recomputeIrq();
        }
        if ((v & (GDMA_INLINK_START | GDMA_INLINK_RESTART)) !== 0) this.gdmaStart(ch);
      } else if (ch !== undefined && off === GDMA_IN_WEIGHT) ch.weight = v & 0x0f00;
      else if (ch !== undefined && off === GDMA_IN_PRI) ch.pri = v & 0x0f;
      else if (ch !== undefined && off === GDMA_IN_PERI_SEL) ch.periSel = v & 0x3f;
      else if (tx !== undefined && off === GDMA_OUT_CONF0) {
        tx.conf0 = v;
        if ((v & GDMA_OUT_RST) !== 0) {
          tx.active = false;
          tx.started = false;
          tx.currentDesc = 0;
          tx.eofDesc = 0;
          tx.eofBfrDesc = 0;
          tx.descBf0 = 0;
          tx.descBf1 = 0;
          tx.intRaw = 0;
          this.recomputeIrq();
        }
      } else if (tx !== undefined && off === GDMA_OUT_CONF1) tx.conf1 = v;
      else if (tx !== undefined && off === GDMA_OUT_INT_ENA) {
        tx.intEna = v;
        this.recomputeIrq();
      } else if (tx !== undefined && off === GDMA_OUT_INT_CLR) {
        tx.intRaw &= ~v;
        this.recomputeIrq();
      } else if (tx !== undefined && off === GDMA_OUT_LINK) {
        tx.outLink = v & GDMA_OUTLINK_ADDR_MASK;
        if ((v & GDMA_OUTLINK_STOP) !== 0) {
          tx.active = false;
          tx.started = false;
          this.recomputeIrq();
        }
        if ((v & (GDMA_OUTLINK_START | GDMA_OUTLINK_RESTART)) !== 0) this.gdmaStartTx(tx);
      } else if (tx !== undefined && off === GDMA_OUT_WEIGHT) tx.weight = v & 0x0f00;
      else if (tx !== undefined && off === GDMA_OUT_PRI) tx.pri = v & 0x0f;
      else if (tx !== undefined && off === GDMA_OUT_PERI_SEL) tx.periSel = v & 0x3f;
      return;
    }
    if (addr >= SENS_BASE && addr < SENS_BASE + 0x400) {
      const off = addr - SENS_BASE;
      if (off === SENS_SAR_MEAS1_CTRL2) {
        const prev = this.meas1Ctrl2;
        this.meas1Ctrl2 = value >>> 0;
        // adc_oneshot_ll_start pulses MEAS1_START_SAR low then high —
        // the 0→1 edge runs a conversion. It completes immediately
        // (the conversion-time cut, stated in the header).
        if ((value & MEAS1_START_SAR) !== 0 && (prev & MEAS1_START_SAR) === 0) {
          this.runSarAdcConversion(1, value);
        }
      } else if (off === SENS_SAR_MEAS2_CTRL2) {
        const prev = this.meas2Ctrl2;
        this.meas2Ctrl2 = value >>> 0;
        // Same adc_oneshot_ll_start pulse for ADC2, backed by its
        // separate MEAS2_DONE/DATA bits.
        if ((value & MEAS2_START_SAR) !== 0 && (prev & MEAS2_START_SAR) === 0) {
          this.runSarAdcConversion(2, value);
        }
      }
      return;
    }
    if (addr >= APB_SARADC_BASE && addr < APB_SARADC_BASE + 0x400) {
      const off = addr - APB_SARADC_BASE;
      const v = value >>> 0;
      if (off === APB_SARADC_CTRL) {
        const prev = this.apbSaradcCtrl;
        if ((v & APB_SARADC_SAR1_PATT_P_CLEAR) !== 0) this.apbSaradcPatternIdx[0] = 0;
        if ((v & APB_SARADC_SAR2_PATT_P_CLEAR) !== 0) this.apbSaradcPatternIdx[1] = 0;
        this.apbSaradcCtrl = v;
        if ((v & APB_SARADC_START) !== 0 && (prev & APB_SARADC_START) === 0) {
          this.apbSaradcRunDigitalConversion();
        }
      } else if (off === APB_SARADC_CTRL2) {
        const prev = this.apbSaradcCtrl2;
        this.apbSaradcCtrl2 = v;
        if ((v & APB_SARADC_TIMER_EN) !== 0 && (prev & APB_SARADC_TIMER_EN) === 0) {
          this.apbSaradcRunDigitalConversion();
        }
      } else if (off === APB_SARADC_FSM_WAIT) this.apbSaradcFsmWait = v;
      else if (off >= APB_SARADC_SAR1_PATT_TAB1 && off < APB_SARADC_SAR1_PATT_TAB1 + 16 && (off & 3) === 0) {
        this.apbSaradcSar1Patt[(off - APB_SARADC_SAR1_PATT_TAB1) >> 2] = v & 0x00ff_ffff;
      } else if (off >= APB_SARADC_SAR2_PATT_TAB1 && off < APB_SARADC_SAR2_PATT_TAB1 + 16 && (off & 3) === 0) {
        this.apbSaradcSar2Patt[(off - APB_SARADC_SAR2_PATT_TAB1) >> 2] = v & 0x00ff_ffff;
      } else if (off === APB_SARADC_APB_ADC_ARB_CTRL) this.apbSaradcArbCtrl = v;
      else if (off === APB_SARADC_FILTER_CTRL0) this.apbSaradcFilterCtrl0 = v;
      else if (off === APB_SARADC_THRES0_CTRL) this.apbSaradcThres[0] = v;
      else if (off === APB_SARADC_THRES1_CTRL) this.apbSaradcThres[1] = v;
      else if (off === APB_SARADC_THRES_CTRL) this.apbSaradcThres[2] = v;
      else if (off === APB_SARADC_INT_ENA) {
        this.apbSaradcIntEna = v;
        this.recomputeIrq();
      }
      else if (off === APB_SARADC_INT_CLR) {
        this.apbSaradcIntRaw &= ~v;
        if ((this.apbSaradcCtrl2 & APB_SARADC_TIMER_EN) !== 0) this.apbSaradcRunDigitalConversion();
        this.recomputeIrq();
      } else if (off === APB_SARADC_DMA_CONF) {
        this.apbSaradcDmaConf = v;
        if ((v & APB_SARADC_DMA_RESET_FSM) !== 0) {
          this.apbSaradcIntRaw = 0;
          this.apbSaradcDataStatus = [0, 0];
          this.apbSaradcPatternIdx = [0, 0];
          this.apbSaradcAlterNext = 1;
          this.recomputeIrq();
        }
      } else if (off === APB_SARADC_APB_ADC_CLKM_CONF) this.apbSaradcClkmConf = v;
      return;
    }
    if (addr >= RTCCNTL_BASE && addr < RTCCNTL_END) {
      const off = addr - RTCCNTL_BASE;
      if (off === RTC_OPTIONS0) {
        // The WO software-reset bits act and read back 0; the rest —
        // including the SW_STALL_APPCPU_C0 [1:0] half of the stall
        // code — is stored (cut: bias/regulator fields are inert).
        this.rtcOptions0 = (value & ~(RTC_SW_SYS_RST | RTC_SW_PROCPU_RST | RTC_SW_APPCPU_RST)) >>> 0;
        if ((value & RTC_SW_SYS_RST) !== 0) {
          this.resetCause = RESET_CAUSE_SW_SYS;
          this.appResetCause = RESET_CAUSE_SW_SYS; // system reset hits both cores
          this.pendingReset = true;
        } else if ((value & RTC_SW_PROCPU_RST) !== 0) {
          this.resetCause = RESET_CAUSE_SW_CPU;
          this.pendingReset = true;
        } else if ((value & RTC_SW_APPCPU_RST) !== 0) {
          // Resets core 1 ALONE: back to the ROM park, then straight
          // to the still-stored boot address (real ROM behavior).
          this.appResetCause = RESET_CAUSE_SW_CPU;
          this.core1Started = false;
        }
        this.maybeStartCore1(); // stall-code half may have changed
      } else if (off === RTC_SLP_TIMER0) {
        this.rtcSleepTimerLo = value >>> 0;
      } else if (off === RTC_SLP_TIMER1) {
        this.rtcSleepTimerHi = value & RTC_SLP_VAL_HI_MASK;
        if ((value & RTC_MAIN_TIMER_ALARM_EN) !== 0) {
          this.rtcMainTimerAlarmArmed = true;
          this.checkRtcSleepTimer();
        }
      } else if (off === RTC_STATE0) {
        if ((value & RTC_SLP_REJECT_CAUSE_CLR) !== 0) {
          this.rtcRejectCause = 0;
          this.rtcIntRaw &= ~RTC_SLP_REJECT_INT;
        }
        this.rtcState0 = (value & ~(RTC_SLP_REJECT_CAUSE_CLR | RTC_SW_CPU_INT)) >>> 0;
        if ((value & RTC_SLEEP_EN) !== 0) this.checkRtcSleepTimer();
        this.recomputeIrq();
      } else if (off === RTC_SW_CPU_STALL) {
        this.rtcSwCpuStall = value >>> 0;
        this.maybeStartCore1();
      } else if (off === RTC_WAKEUP_STATE) {
        this.rtcWakeupState = value >>> 0;
      } else if (off === RTC_INT_ENA) {
        this.rtcIntEna = value >>> 0;
        this.recomputeIrq();
      } else if (off === RTC_INT_RAW) {
        this.rtcIntRaw = value >>> 0;
        this.recomputeIrq();
      } else if (off === RTC_INT_CLR) {
        this.rtcIntRaw &= ~value;
        this.recomputeIrq();
      } else if (off === RTC_EXT_XTL_CONF) {
        // XTAL32K_WDT_RESET is modeled as a write-only pulse. The
        // surrounding fields round-trip so rtc_clk_32k_enable-style
        // setup can observe its own policy.
        this.rtcExtXtlConf = (value & ~RTC_XTAL32K_WDT_RESET) >>> 0;
        if ((value & RTC_XTAL32K_WDT_RESET) !== 0 && !this.xtal32kDead) {
          this.rtcIntRaw &= ~RTC_XTAL32K_DEAD_INT;
        }
        this.updateXtal32kDead();
      } else if (off === RTC_TIME_UPDATE) {
        if ((value & (1 << 31)) !== 0) {
          // Latch the 48-bit RTC main timer: CPU cycles → RC_SLOW ticks.
          const ticks = this.rtcTicks();
          this.rtcTimeLatchLo = ticks % 0x100000000;
          this.rtcTimeLatchHi = Math.floor(ticks / 0x100000000) & 0xffff;
        }
      } else if (off === RTC_WDTWPROTECT) {
        this.rwdt.wprotect = value >>> 0;
      } else if (off >= RTC_WDTCONFIG0 && off <= RTC_WDTFEED) {
        // RWDT config space (slice 13) — same silent-drop gate as the
        // MWDTs while protected (rwdt_ll.h uses the same key).
        if (this.rwdt.wprotect === WDT_WKEY) {
          if (off === RTC_WDTCONFIG0) {
            this.rwdt.config0 = value >>> 0;
            this.rwdt.epoch = this.cpu.cycles;
            this.rwdt.handled = 0;
          } else if (off === RTC_WDTFEED) {
            // rwdt_ll_feed sets bit 31 (RTC_CNTL_RTC_WDT_FEED).
            if ((value & RTC_WDT_FEED_BIT) !== 0) {
              this.rwdt.epoch = this.cpu.cycles;
              this.rwdt.handled = 0;
            }
          } else {
            this.rwdt.timeouts[(off - RTC_WDTCONFIG1) >> 2] = value >>> 0;
          }
        }
      } else if (off === RTC_SWD_WPROTECT) {
        this.rtcSwdWprotect = value >>> 0;
      } else if (off === RTC_SWD_CONF) {
        if (this.rtcSwdWprotect === RTC_SWD_WKEY) {
          const flags = this.rtcSwdConf & (RTC_SWD_FEED_INT | RTC_SWD_RESET_FLAG);
          this.rtcSwdConf = ((value & ~(RTC_SWD_FEED | RTC_SWD_RST_FLAG_CLR | RTC_SWD_FEED_INT | RTC_SWD_RESET_FLAG)) | flags) >>> 0;
          if ((value & RTC_SWD_FEED) !== 0) {
            this.rtcSwdConf &= ~RTC_SWD_FEED_INT;
            this.rtcIntRaw &= ~RTC_SWD_INT;
          }
          if ((value & RTC_SWD_RST_FLAG_CLR) !== 0) {
            this.rtcSwdConf &= ~RTC_SWD_RESET_FLAG;
          }
          this.recomputeIrq();
        }
      } else if (off === RTC_COCPU_CTRL) {
        // COCPU_SW_INT_TRIGGER is a write-only pulse; the rest of the
        // register is stored so IDF startup can round-trip inert fields.
        this.rtcCocpuCtrl = (value & ~RTC_COCPU_SW_INT_TRIGGER) >>> 0;
        if ((value & RTC_COCPU_SW_INT_TRIGGER) !== 0) {
          this.rtcIntRaw |= RTC_COCPU_INT;
          this.recomputeIrq();
        }
      } else if (off === RTC_BROWN_OUT) {
        // BROWN_OUT_DET is read-only detector state and CNT_CLR is a
        // write-only pulse; the rest of the policy bits round-trip so
        // IDF's brownout LL can configure interrupt-vs-reset behavior.
        const det = this.rtcBrownOut & RTC_BROWN_OUT_DET;
        this.rtcBrownOut = ((value & ~(RTC_BROWN_OUT_DET | RTC_BROWN_OUT_CNT_CLR)) | det) >>> 0;
        if ((value & RTC_BROWN_OUT_CNT_CLR) !== 0 && !this.brownoutDetected) {
          this.rtcBrownOut &= ~RTC_BROWN_OUT_DET;
        }
        this.updateBrownoutDetector();
      } else if (off === RTC_XTAL32K_CONF) {
        this.rtcXtal32kConf = value >>> 0;
      } else if (off === RTC_INT_ENA_W1TS) {
        this.rtcIntEna = (this.rtcIntEna | value) >>> 0;
        this.recomputeIrq();
      } else if (off === RTC_INT_ENA_W1TC) {
        this.rtcIntEna = (this.rtcIntEna & ~value) >>> 0;
        this.recomputeIrq();
      }
      // Other RTC_CNTL writes (sleep setup, bias, …) accepted+dropped.
      return;
    }
    if (addr >= EFUSE_BASE && addr < EFUSE_BASE + 0x1000) {
      const off = addr - EFUSE_BASE;
      const v = value >>> 0;
      if (off >= EFUSE_PGM_DATA_0 && off < EFUSE_PGM_DATA_0 + EFUSE_PGM_DATA_WORDS * 4 && (off & 3) === 0) {
        this.efusePgmData[(off - EFUSE_PGM_DATA_0) >> 2] = v;
        return;
      }
      if (off >= EFUSE_PGM_CHECK_VALUE_0 && off < EFUSE_PGM_CHECK_VALUE_0 + EFUSE_PGM_CHECK_WORDS * 4 && (off & 3) === 0) {
        this.efusePgmCheck[(off - EFUSE_PGM_CHECK_VALUE_0) >> 2] = v;
        return;
      }
      if (off === EFUSE_CLK) {
        this.efuseClk = v;
        return;
      }
      if (off === EFUSE_CONF) {
        this.efuseConf = v & 0xffff;
        return;
      }
      if (off === EFUSE_CMD) {
        if ((v & EFUSE_READ_CMD) !== 0 && this.efuseConf === EFUSE_READ_OP_CODE) this.efuseIntRaw |= EFUSE_READ_CMD;
        if ((v & EFUSE_PGM_CMD) !== 0 && this.efuseConf === EFUSE_WRITE_OP_CODE) {
          this.efuseProgramBlock((v & EFUSE_BLK_NUM_MASK) >>> EFUSE_BLK_NUM_SHIFT);
        }
        return;
      }
      if (off === EFUSE_INT_RAW) {
        this.efuseIntRaw |= v & EFUSE_DONE_INTS;
        return;
      }
      if (off === EFUSE_INT_ENA) {
        this.efuseIntEna = v & EFUSE_DONE_INTS;
        return;
      }
      if (off === EFUSE_INT_CLR) {
        this.efuseIntRaw &= ~(v & EFUSE_DONE_INTS);
        return;
      }
      if (off === EFUSE_DAC_CONF) {
        this.efuseDacConf = v;
        return;
      }
      if (off === EFUSE_RD_TIM_CONF) {
        this.efuseRdTimConf = v;
        return;
      }
      if (off === EFUSE_WR_TIM_CONF1) {
        this.efuseWrTimConf1 = v;
        return;
      }
      if (off === EFUSE_WR_TIM_CONF2) {
        this.efuseWrTimConf2 = v;
        return;
      }
      if (off === EFUSE_DATE) return;
      throw new Error(
        `write to read-only or unmodeled eFuse register 0x${addr.toString(16)} — program fuses via PGM_DATA0..7 plus CMD.PGM_CMD`,
      );
    }
    if (addr >= SYSTEM_BASE && addr < SYSTEM_BASE + 0x1000) {
      const off = addr - SYSTEM_BASE;
      if (off === SYSTEM_CORE_1_CTRL0) {
        // Core 1's release bits (slice 12). A RESETING rising edge
        // resets core 1 — it re-parks and restarts at the stored boot
        // address when released again.
        const prev = this.core1Ctrl0;
        this.core1Ctrl0 = value & (CORE1_RUNSTALL | CORE1_CLKGATE_EN | CORE1_RESETING);
        if ((this.core1Ctrl0 & CORE1_RESETING) !== 0 && (prev & CORE1_RESETING) === 0) {
          this.core1Started = false;
        }
        this.maybeStartCore1();
        return;
      }
      if (off === SYSTEM_CORE_1_CTRL1) {
        this.core1Msg = value >>> 0; // MESSAGE scratch word
        return;
      }
      if (off >= SYSTEM_CPU_INTR_FROM_CPU && off < SYSTEM_CPU_INTR_FROM_CPU + SYSTEM_CPU_INTR_FROM_CPU_COUNT * 4 && (off & 3) === 0) {
        this.fromCpuIntRaw[(off - SYSTEM_CPU_INTR_FROM_CPU) >> 2] = value & 1;
        this.recomputeIrq();
        return;
      }
      // Stored but inert: the emulated clock is fixed at 240 MHz (cut
      // stated in the header). CLK_XTAL_FREQ is RO — writes can't touch it.
      if (off === SYSTEM_CPU_PER_CONF) this.cpuPerConf = value >>> 0;
      else if (off === SYSTEM_SYSCLK_CONF) {
        this.sysclkConf = ((value & ~SYSTEM_CLK_XTAL_FREQ_MASK) | (this.sysclkConf & SYSTEM_CLK_XTAL_FREQ_MASK)) >>> 0;
      }
      // Other SYSTEM writes (PERIP_CLK_EN, RST_EN, …) accepted+dropped.
      return;
    }
    throw new Error(`write outside the modeled ESP32-S3 map: 0x${addr.toString(16)}`);
  }
}

export { IRAM_BASE as ESP32S3_IRAM_BASE, DRAM_BASE as ESP32S3_DRAM_BASE, GPIO_BASE as ESP32S3_GPIO_BASE, UART0_BASE as ESP32S3_UART0_BASE };
