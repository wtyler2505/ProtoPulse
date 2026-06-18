import { XtensaCpu } from './xtensa.js';

import type { AdcReadRequest, AdcSampler, DigitalLevel, McuCore, McuState, McuStepResult, PinEvent } from './types.js';
import type { XtensaBus } from './xtensa.js';

export interface Esp32s3AdcContinuousOverflowEvent {
  cycle: number;
  descriptor: number;
  frameWord: number;
  policy: 'drop-new' | 'flush-old';
}

export interface Esp32s3TwaiFrame {
  id: number;
  data?: readonly number[];
  dlc?: number;
  extended?: boolean;
  rtr?: boolean;
}

export interface Esp32s3TwaiErrorFlags {
  ackErr?: true;
  busError?: true;
  rxFifoOverrun?: true;
  busOff?: true;
  arbLost?: true;
}

export type Esp32s3TwaiErrorState = 'active' | 'warning' | 'passive' | 'bus_off';

export type Esp32s3TwaiEvent =
  | { type: 'tx_done'; success: boolean; frame: Esp32s3TwaiFrame }
  | { type: 'rx_done'; frame: Esp32s3TwaiFrame }
  | { type: 'error'; flags: Esp32s3TwaiErrorFlags }
  | { type: 'state_change'; oldState: Esp32s3TwaiErrorState; newState: Esp32s3TwaiErrorState };

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
 * the selected RTC_SLOW clock (TIME_UPDATE-latched LOW0/HIGH0 reads;
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
 * counts the selected RTC_SLOW clock source, with the real stage-0
 * eFuse timeout multiplier from BLOCK0 WDT_DELAY_SEL. Watchdog cuts,
 * stated plainly: stage-N CPU-reset ignores the PROCPU/APPCPU_RESET_EN
 * routing bits and always resets the PRO CPU (whole machine, like
 * SW_PROCPU_RST); FLASHBOOT_MOD_EN bits are stored but INERT (this
 * core boots post-bootloader with the flashboot watchdogs already
 * quiesced, so raw test images aren't killed before they can
 * configure anything — IDF startup's disable writes still land on
 * real modeled registers); the RWDT INT stage action now latches
 * RTC_WDT_INT via the RTC_CORE interrupt source, and RWDT
 * PAUSE_IN_SLP freezes elapsed timeout while modeled RTC sleep is
 * active. SUPER_WDT timed countdown is out of scope.
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
 * the final idle EOF. PCNT unit 0..3 now exposes the ESP32-S3 pulse-counter
 * register block, consumes GPIO input-matrix pulse/control signals 33..48,
 * applies edge actions plus level-control inversion/hold, returns signed
 * 16-bit counts, and latches watchpoint/status interrupts through the PCNT
 * interrupt-matrix map. PCNT cuts: no APB-cycle glitch filtering, no
 * quadrature helper layer beyond the two raw channels, and no driver power/
 * clock gating effects yet. The first RTC sleep/wake path is modeled too:
 * SLP_TIMER0/1 arm the RTC main-timer alarm, STATE0.SLEEP_EN enters the
 * sleep state, WAKEUP_STATE's TIMER_TRIG source records
 * SLP_WAKEUP_CAUSE, and the RTC_CORE interrupt-matrix source wakes
 * WAITI through the normal level-1 path. SLP_REJECT_CONF can also
 * reject a modeled light-sleep entry for a host-injected reject source,
 * latching SLP_REJECT_CAUSE and RTC_CNTL_SLP_REJECT_INT. A host-injected
 * SDIO-idle event latches RTC_CNTL_SDIO_IDLE_INT and can wake modeled
 * light sleep through RTC_SDIO_TRIG_EN. Host-injected WiFi/BT wake
 * events record RTC_WIFI_TRIG_EN/RTC_BT_TRIG_EN through the shared
 * SLP_WAKEUP path. GPIO high/low level wakeup tracks
 * GPIO_PINn.WAKEUP_ENABLE plus INT_TYPE and records
 * RTC_GPIO_TRIG_EN. EXT1 wakeup watches the RTC GPIO0..21 mask and
 * records RTC_EXT1_TRIG_EN plus EXT_WAKEUP1_STATUS. UART0/1 RX bytes
 * can likewise wake modeled light sleep through RTC_UART0/1_TRIG_EN
 * after their modeled RX edge threshold is reached; the pre-wake/
 * triggering byte is dropped like ESP-IDF documents for light sleep.
 * RWDT stage-0 INT,
 * COCPU_SW_INT_TRIGGER, host-injected brownout detector trips,
 * power-glitch detector trips, clock-glitch detector trips,
 * XTAL32K-dead watchdog trips, and super-watchdog trips also latch
 * their RTC_CNTL INT_* bits and route through RTC_CORE. The power-glitch
 * detector can take its enable bit
 * either from PG_CTRL or the documented BLOCK0 eFuse bit when
 * PG_CTRL selects eFuse control. XTAL32K-dead can wake light-sleep via the
 * RTC_XTAL32K_DEAD_TRIG_EN wake source too.
 * SUPER_WDT also records its RTC reset flag/feed-interrupt bits,
 * supports the documented feed/flag-clear pulses, and reports reset
 * cause 18 when firmware has not selected BYPASS_RST and has selected
 * software control in FIB_SEL. RTC SARADC1/2
 * oneshot completions, TSENS raw reads, and touch one-shot scans latch
 * their RTC-domain interrupt producers. The repeated touch sleep timer
 * runs on TOUCH_SLEEP_CYCLES and can wake RTC sleep when RTC_TOUCH_TRIG_EN is armed.
 * ULP force-start/start-top
 * synthetic WAKEs latch RTC_CNTL_ULP_CP_INT and wake sleep when
 * RTC_ULP_TRIG_EN is armed; the ULP sleep timer also schedules that
 * synthetic WAKE from ULP_CP_TIMER_1.SLP_CYCLE while enabled, and
 * LOW_POWER_ST exposes the main idle/sleep + ready-for-wakeup bits ULP
 * WAKE examples poll, and ULP_CP_TIMER readback preserves GPIO_WAKEUP_ENA
 * while treating GPIO_WAKEUP_CLR as a write-only pulse. ULP_CP_CTRL
 * preserves FORCE_START_TOP/CLK_FO readback while treating MEM_OFFST_CLR
 * as write-only. STATE0.SW_CPU_INT follows the ULP wake-main pulse path
 * used by ulp_riscv_wakeup_main_processor(). INT_RAW writes only affect
 * the documented TOUCH_APPROACH_LOOP_DONE R/W raw bit; producer-owned
 * raw bits stay read-only. FIB_SEL preserves the documented three-bit
 * selector reset/readback and gates software-controlled brownout analog,
 * glitch, and super-watchdog reset routing. COCPU_CTRL keeps the
 * documented reset timing fields/COCPU_SEL bit while
 * COCPU_DONE/SHUT_RESET_EN reflect through LOW_POWER_ST's COCPU
 * done/sleep bits.
 * COCPU_SW_INT_TRIGGER wakes RTC sleep when RTC_COCPU_TRIG_EN is armed.
 * SENS_SAR_COCPU_STATE.DBG_TRIGGER
 * models a synthetic COCPU trap producer, latching RTC_CNTL_COCPU_TRAP_INT
 * and waking RTC sleep when RTC_COCPU_TRAP_TRIG_EN is armed. Touch scans
 * with a nonzero timeout budget below the synthetic measurement cost latch
 * RTC_CNTL_TOUCH_TIMEOUT_INT. Touch proximity pads accumulate
 * deterministic approach counts and latch TOUCH_APPROACH_LOOP_DONE when
 * they reach the configured total scan count.
 * GPSPI2/GPSPI3 now expose a first CPU-FIFO master path: command,
 * address, and MOSI phases drain from the W0..W15 buffer, MISO phases
 * synthesize zero bytes into that same buffer, cmd.usr self-clears, and
 * TRANS_DONE routes through SPI2/3_DMA interrupt-matrix sources. Cuts:
 * no DMA descriptor movement, attached-device response model, timing,
 * chip-select pins, line modes beyond the recorded phase bytes, or
 * driver ringbuffer API yet.
 * MCPWM0/MCPWM1 now expose the source-pinned register blocks, virtual
 * timer/operator/comparator/generator path, GPIO-matrix output signals
 * 160..171, continuous software force, and PWM0/1 interrupt-matrix
 * routing. Cuts: no dead-time, carrier, faults, capture, sync propagation,
 * power/clock gating effects, or full driver object model yet.
 * TWAI/CAN now exposes the source-pinned ESP32-S3 register block, the
 * SJA1000-style 8-bit registers packed into 32-bit words, TX/RX frame
 * buffer bytes, self-reception loopback, RX buffer release, RI/TI/EI/BEI
 * interrupts, acceptance-filter enforcement, typed host injection/drain,
 * and a host-side peer bus that delivers standard frames, models ACK/no-ACK
 * TX error-counter movement, enters BUS_OFF after repeated ACK errors, and
 * suppresses listen-only transmissions while exposing host-drained
 * TX/RX/error/state-change events, including RX FIFO overrun errors, for
 * bridge-style callback data.
 * Cuts: no bit timing/arbitration/retry scheduling, full driver alert queue,
 * exact dual-filter mode, or wire-level GPIO waveform yet.
 * Still missing: full light/deep sleep register policy, remaining wake
 * sources, wake-stub/deep-sleep reset behavior, clock/power-domain
 * gating, full touch deep-sleep/proximity/timeout behavior, real ULP
 * instruction execution, and the remaining RTC interrupt producers
 * beyond RWDT/COCPU/brownout/power-glitch/clock-glitch/XTAL32K-dead/
 * SUPER_WDT/SARADC/TSENS/touch done-scan-active/wake/timeout/proximity/
 * ULP wake/COCPU wake/COCPU trap paths — so full IDF/FreeRTOS firmware
 * does NOT run yet.
 * Loading Intel-HEX refuses with a message.
 */

const CLOCK_HZ = 240_000_000;

// Memory map (esp-idf v5.2 soc.h / reg_base.h):
const IRAM_BASE = 0x40378000; // D/IRAM — same SRAM as DRAM_BASE, other bus
const DRAM_BASE = 0x3fc88000;
const SRAM_BYTES = 0x78000; // 480 KiB shared window
const GPIO_BASE = 0x60004000;
const UART0_BASE = 0x60000000;
const UART1_BASE = 0x60010000;
const UART2_BASE = 0x6002e000; // REG_UART_BASE(2): UART0 + 2*0x10000 + 0xe000

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
// 4 low level, 5 high level. WAKEUP_ENABLE bit 10 is set by
// gpio_wakeup_enable for light sleep; INT_ENA bit 13 =
// GPIO_LL_INTR_ENA — on the S3 both CPUs share that one enable bit.
const GPIO_PIN_INT_TYPE_SHIFT = 7;
const GPIO_PIN_WAKEUP_ENABLE_BIT = 1 << 10;
const GPIO_INT_LOW_LEVEL = 4;
const GPIO_INT_HIGH_LEVEL = 5;
const GPIO_INT_ENA_BIT = 1 << 13;

// UART register offsets (uart_reg.h):
const UART_FIFO = 0x00; // RXFIFO_RD_BYTE [7:0]
const UART_INT_RAW = 0x04;
const UART_INT_ST = 0x08; // raw & ena
const UART_INT_ENA = 0x0c;
const UART_INT_CLR = 0x10;
const UART_STATUS = 0x1c; // RXFIFO_CNT [9:0], TXFIFO_CNT [25:16]
const UART_CONF0 = 0x20; // PARITY [0], PARITY_EN [1], BIT_NUM [3:2], STOP_BIT_NUM [5:4]
const UART_CONF1 = 0x24; // RXFIFO_FULL_THRHD [9:0], resets to 96
const UART_SLEEP_CONF = 0x38; // ACTIVE_THRESHOLD [9:0], resets to 240
const UART_CONF0_RESET = 0x1c; // 8 data bits, no parity, 1 stop bit
const UART_PARITY = 1 << 0;
const UART_PARITY_EN = 1 << 1;
const UART_BIT_NUM_SHIFT = 2;
const UART_BIT_NUM_MASK = 0x3;
const UART_RXFIFO_MASK = 0x3ff;
const UART_ACTIVE_THRESHOLD_RESET = 240;
const UART_WAKEUP_EDGE_MIN = 3;
const UART_RXFIFO_FULL_INT = 1 << 0;
const UART_TX_DONE_INT = 1 << 14;
const UART_WAKEUP_INT = 1 << 19;

// I2C external controllers (ESP-IDF v5.5.4 ESP32-S3):
// soc.h REG_I2C_BASE(i) = 0x60013000 + i * 0x14000; the linker
// script provides I2C0=0x60013000 and I2C1=0x60027000. This first cut
// executes the LL command FIFO instantly, acks writes by default, and
// returns synthetic zero bytes for reads until a real bus/device bridge
// exists.
const I2C0_BASE = 0x60013000;
const I2C1_BASE = 0x60027000;
const I2C_BLOCK_BYTES = 0x200; // sizeof(i2c_dev_t)
const I2C_CONTROLLER_COUNT = 2;
const I2C_FIFO_LEN = 32; // SOC_I2C_FIFO_LEN
const I2C_CMD_COUNT = 8; // SOC_I2C_CMD_REG_NUM
const I2C_SCL_LOW_PERIOD = 0x00;
const I2C_CTR = 0x04;
const I2C_SR = 0x08;
const I2C_TO = 0x0c;
const I2C_SLAVE_ADDR = 0x10;
const I2C_FIFO_ST = 0x14;
const I2C_FIFO_CONF = 0x18;
const I2C_DATA = 0x1c;
const I2C_INT_RAW = 0x20;
const I2C_INT_CLR = 0x24;
const I2C_INT_ENA = 0x28;
const I2C_INT_ST = 0x2c;
const I2C_SDA_HOLD = 0x30;
const I2C_SDA_SAMPLE = 0x34;
const I2C_SCL_HIGH_PERIOD = 0x38;
const I2C_SCL_START_HOLD = 0x40;
const I2C_SCL_RSTART_SETUP = 0x44;
const I2C_SCL_STOP_HOLD = 0x48;
const I2C_SCL_STOP_SETUP = 0x4c;
const I2C_FILTER_CFG = 0x50;
const I2C_CLK_CONF = 0x54;
const I2C_COMD0 = 0x58;
const I2C_COMD_END = I2C_COMD0 + I2C_CMD_COUNT * 4;
const I2C_SCL_ST_TIME_OUT = 0x78;
const I2C_SCL_MAIN_ST_TIME_OUT = 0x7c;
const I2C_SCL_SP_CONF = 0x80;
const I2C_SCL_STRETCH_CONF = 0x84;
const I2C_DATE = 0xf8;
const I2C_TXFIFO_START_ADDR = 0x100;
const I2C_RXFIFO_START_ADDR = 0x180;
const I2C_CTR_RESET = 0x20b; // SDA/SCL open-drain, rx-full NACK, arbitration enabled
const I2C_TO_RESET = 16;
const I2C_FIFO_CONF_RESET = 11 | (4 << 5) | (1 << 14);
const I2C_FILTER_CFG_RESET = (1 << 8) | (1 << 9);
const I2C_CLK_CONF_RESET = 1 << 21;
const I2C_SCL_SETUP_RESET = 8;
const I2C_SCL_ST_TIMEOUT_RESET = 16;
const I2C_DATE_RESET = 537330177;
const I2C_TRANS_START = 1 << 5;
const I2C_RX_FIFO_RST = 1 << 12;
const I2C_TX_FIFO_RST = 1 << 13;
const I2C_FIFO_PRT_EN = 1 << 14;
const I2C_RXFIFO_CNT_SHIFT = 8;
const I2C_TXFIFO_CNT_SHIFT = 18;
const I2C_FIFO_CNT_MASK = 0x3f;
const I2C_RXFIFO_WM_INT = 1 << 0;
const I2C_TXFIFO_WM_INT = 1 << 1;
const I2C_RXFIFO_OVF_INT = 1 << 2;
const I2C_END_DETECT_INT = 1 << 3;
const I2C_TRANS_COMPLETE_INT = 1 << 7;
const I2C_NACK_INT = 1 << 10;
const I2C_TXFIFO_OVF_INT = 1 << 11;
const I2C_RXFIFO_UDF_INT = 1 << 12;
const I2C_INT_CLEARABLE = 0x1ffff;
const I2C_COMMAND_MASK = 0x3fff;
const I2C_COMMAND_DONE = 0x80000000;
const I2C_CMD_BYTE_NUM_MASK = 0xff;
const I2C_CMD_ACK_EN = 1 << 8;
const I2C_CMD_ACK_EXP = 1 << 9;
const I2C_CMD_OP_SHIFT = 11;
const I2C_CMD_OP_MASK = 0x7;
const I2C_LL_CMD_WRITE = 1;
const I2C_LL_CMD_STOP = 2;
const I2C_LL_CMD_READ = 3;
const I2C_LL_CMD_END = 4;
const I2C_LL_CMD_RESTART = 6;

// General-purpose SPI controllers GPSPI2/GPSPI3 (ESP-IDF v5.5.4
// ESP32-S3): reg_base.h pins GPSPI2=0x60024000, GPSPI3=0x60025000.
// This first cut executes CPU-buffer master transactions instantly,
// matching the polling path's observable completion bit without modeling
// SPI clock timing or attached devices yet.
const SPI2_BASE = 0x60024000;
const SPI3_BASE = 0x60025000;
const SPI_BLOCK_BYTES = 0x1000;
const SPI_CONTROLLER_COUNT = 2;
const SPI_WORD_COUNT = 16;
const SPI_CMD = 0x00;
const SPI_ADDR = 0x04;
const SPI_CTRL = 0x08;
const SPI_CLOCK = 0x0c;
const SPI_USER = 0x10;
const SPI_USER1 = 0x14;
const SPI_USER2 = 0x18;
const SPI_MS_DLEN = 0x1c;
const SPI_MISC = 0x20;
const SPI_DMA_CONF = 0x30;
const SPI_DMA_INT_ENA = 0x34;
const SPI_DMA_INT_CLR = 0x38;
const SPI_DMA_INT_RAW = 0x3c;
const SPI_DMA_INT_ST = 0x40;
const SPI_DMA_INT_SET = 0x44;
const SPI_W0 = 0x98;
const SPI_SLAVE = 0xe0;
const SPI_SLAVE1 = 0xe4;
const SPI_CLK_GATE = 0xe8;
const SPI_DATE = 0xf0;
const SPI_CMD_UPDATE = 1 << 23;
const SPI_CMD_USR = 1 << 24;
const SPI_USR_COMMAND = 0x80000000;
const SPI_USR_ADDR = 0x40000000;
const SPI_USR_MISO = 0x10000000;
const SPI_USR_MOSI = 0x08000000;
const SPI_USR_MOSI_HIGHPART = 0x02000000;
const SPI_USR_MISO_HIGHPART = 0x01000000;
const SPI_USR_ADDR_BITLEN_SHIFT = 27;
const SPI_USR_COMMAND_BITLEN_SHIFT = 28;
const SPI_PHASE_BITLEN_MASK = 0x1f;
const SPI_COMMAND_BITLEN_MASK = 0x0f;
const SPI_MS_DATA_BITLEN_MASK = 0x3ffff;
const SPI_TRANS_DONE_INT = 1 << 12;
const SPI_INT_CLEARABLE = 0x1fffff;
const SPI_DMA_CONF_WT_MASK = 0xe0000000;
const SPI_CLOCK_RESET = 0x80003043;
const SPI_USER_RESET = SPI_USR_COMMAND;
const SPI_USER1_RESET = ((23 << 27) | (1 << 22) | 7) >>> 0;
const SPI_USER2_RESET = ((7 << 28) | (1 << 27)) >>> 0;
const SPI_DATE_RESET = 0x02101190;

// MCPWM motor-control PWM blocks (ESP-IDF v5.5.4 ESP32-S3):
// reg_base.h pins PWM0=0x6001E000 and PWM1=0x6002C000; soc_caps.h
// says two groups, each with three timers/operators and two generators.
// This first cut models timer/operator/comparator/generator output and
// the group interrupt registers. Cuts: no dead-time, carrier, fault,
// capture, sync input propagation, or power/clock gating side effects yet.
const MCPWM0_BASE = 0x6001e000;
const MCPWM1_BASE = 0x6002c000;
const MCPWM_BLOCK_BYTES = 0x1000;
const MCPWM_GROUPS = 2;
const MCPWM_TIMERS = 3;
const MCPWM_OPERATORS = 3;
const MCPWM_GENERATORS = 2;
const MCPWM_CLK_CFG = 0x00;
const MCPWM_TIMER0_CFG0 = 0x04;
const MCPWM_TIMER_CFG_STRIDE = 0x10;
const MCPWM_TIMER_CFG1_DELTA = 0x04;
const MCPWM_TIMER_SYNC_DELTA = 0x08;
const MCPWM_TIMER_STATUS_DELTA = 0x0c;
const MCPWM_TIMER_PRESCALE_MASK = 0xff;
const MCPWM_TIMER_PERIOD_SHIFT = 8;
const MCPWM_TIMER_PERIOD_MASK = 0xffff;
const MCPWM_TIMER_CFG0_RESET = 255 << MCPWM_TIMER_PERIOD_SHIFT;
const MCPWM_TIMER_START_MASK = 0x7;
const MCPWM_TIMER_MOD_SHIFT = 3;
const MCPWM_TIMER_MOD_MASK = 0x3;
const MCPWM_TIMER_MOD_UP = 1;
const MCPWM_TIMER_MOD_DOWN = 2;
const MCPWM_TIMER_MOD_UP_DOWN = 3;
const MCPWM_TIMER_START_RUN = 2;
const MCPWM_OPERATOR_TIMERSEL = 0x38;
const MCPWM_OPERATOR_STRIDE = 0x38;
const MCPWM_OPERATOR0_BASE = 0x3c;
const MCPWM_GEN_STMP_CFG = 0x00;
const MCPWM_GEN_TSTMP_A = 0x04;
const MCPWM_GEN_TSTMP_B = 0x08;
const MCPWM_GEN_CFG0 = 0x0c;
const MCPWM_GEN_FORCE = 0x10;
const MCPWM_GEN_A_REG = 0x14;
const MCPWM_GEN_B_REG = 0x18;
const MCPWM_FORCE_RESET = 0x20;
const MCPWM_GEN_A_FORCE_SHIFT = 6;
const MCPWM_GEN_B_FORCE_SHIFT = 8;
const MCPWM_GEN_FORCE_MASK = 0x3;
const MCPWM_GEN_ACTION_LOW = 1;
const MCPWM_GEN_ACTION_HIGH = 2;
const MCPWM_GEN_ACTION_TOGGLE = 3;
const MCPWM_GEN_ACTION_UTEZ_SHIFT = 0;
const MCPWM_GEN_ACTION_UTEP_SHIFT = 2;
const MCPWM_GEN_ACTION_UTEA_SHIFT = 4;
const MCPWM_GEN_ACTION_UTEB_SHIFT = 6;
const MCPWM_INT_ENA = 0x110;
const MCPWM_INT_RAW = 0x114;
const MCPWM_INT_ST = 0x118;
const MCPWM_INT_CLR = 0x11c;
const MCPWM_CLK = 0x120;
const MCPWM_DATE = 0x124;
const MCPWM_INT_CLEARABLE = 0x3fffffff;
const MCPWM_TIMER_TEZ_INT_BASE = 3;
const MCPWM_TIMER_TEP_INT_BASE = 6;
const MCPWM_OP_TEA_INT_BASE = 15;
const MCPWM_OP_TEB_INT_BASE = 18;
const MCPWM_SIGNAL_GROUP0_BASE = 160; // PWM0_OUT0A_IDX
const MCPWM_SIGNAL_GROUP1_BASE = 166; // PWM1_OUT0A_IDX
const MCPWM_DATE_RESET = 34632240;

// TWAI/CAN controller (ESP-IDF v5.5.4 ESP32-S3):
// reg_base.h pins TWAI at 0x6002B000. twai_struct.h maps the SJA1000-style
// 8-bit registers into the low byte of 32-bit words from +0x00..+0x7c.
// soc_caps.h says ESP32-S3 has one TWAI controller; twai_periph.c wires
// it to ETS_TWAI_INTR_SOURCE/CAN_INT_MAP and GPIO matrix signal 116.
const TWAI_BASE = 0x6002b000;
const TWAI_BLOCK_BYTES = 0x80;
const TWAI_MODE = 0x00;
const TWAI_COMMAND = 0x04;
const TWAI_STATUS = 0x08;
const TWAI_INTERRUPT = 0x0c;
const TWAI_INTERRUPT_ENABLE = 0x10;
const TWAI_BUS_TIMING_0 = 0x18;
const TWAI_BUS_TIMING_1 = 0x1c;
const TWAI_ARB_LOST_CAPTURE = 0x2c;
const TWAI_ERR_CODE_CAPTURE = 0x30;
const TWAI_ERR_WARNING_LIMIT = 0x34;
const TWAI_RX_ERR_COUNTER = 0x38;
const TWAI_TX_ERR_COUNTER = 0x3c;
const TWAI_BUFFER_START = 0x40;
const TWAI_BUFFER_BYTES = 13;
const TWAI_ACCEPTANCE_BYTES = 8;
const TWAI_RX_MESSAGE_COUNTER = 0x74;
const TWAI_CLOCK_DIVIDER = 0x7c;
const TWAI_MODE_RESET = 1 << 0;
const TWAI_MODE_LISTEN_ONLY = 1 << 1;
const TWAI_MODE_NO_ACK = 1 << 2;
const TWAI_MODE_ACCEPTANCE_FILTER = 1 << 3; // AFM: 1 = single filter, 0 = dual filter
const TWAI_MODE_MASK = 0x0f;
const TWAI_CMD_TX_REQUEST = 1 << 0;
const TWAI_CMD_ABORT_TX = 1 << 1;
const TWAI_CMD_RELEASE_RX = 1 << 2;
const TWAI_CMD_CLEAR_OVERRUN = 1 << 3;
const TWAI_CMD_SELF_RX_REQUEST = 1 << 4;
const TWAI_STATUS_RX_BUFFER = 1 << 0;
const TWAI_STATUS_DATA_OVERRUN = 1 << 1;
const TWAI_STATUS_TX_BUFFER = 1 << 2;
const TWAI_STATUS_TX_COMPLETE = 1 << 3;
const TWAI_STATUS_ERROR = 1 << 6;
const TWAI_STATUS_BUS = 1 << 7;
const TWAI_INTR_RX = 1 << 0;
const TWAI_INTR_TX = 1 << 1;
const TWAI_INTR_ERR = 1 << 2;
const TWAI_INTR_DATA_OVERRUN = 1 << 3;
const TWAI_INTR_ERR_PASSIVE = 1 << 5;
const TWAI_INTR_ARB_LOST = 1 << 6; // ALI — SJA1000 IR.6 / TWAI_LL_INTR_ALI
const TWAI_INTR_BUS_ERR = 1 << 7;
const TWAI_INTR_CLEARABLE = 0xef;
const TWAI_ERR_WARNING_LIMIT_RESET = 96;
const TWAI_ERR_DELTA_TX_ACK = 8;
const TWAI_ERR_SEG_ACK_SLOT = 25;
const TWAI_CLOCK_DIVIDER_MASK = 0x1ff;
const TWAI_FRAME_DLC_MASK = 0x0f;
const TWAI_FRAME_RTR = 1 << 6;
const TWAI_FRAME_EXTENDED = 1 << 7;
const TWAI_STD_ID_MASK = 0x7ff;
const TWAI_EXT_ID_MASK = 0x1fffffff;
const TWAI_FRAME_DATA_BYTES = 8;

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
const INTMTX_UART1_MAP = 0x070; // INTERRUPT_CORE0_UART1_INTR_MAP_REG
const INTMTX_UART2_MAP = 0x074; // INTERRUPT_CORE0_UART2_INTR_MAP_REG
const INTMTX_PWM0_MAP = 0x07c; // INTERRUPT_CORE0_PWM0_INTR_MAP_REG
const INTMTX_PWM1_MAP = 0x080; // INTERRUPT_CORE0_PWM1_INTR_MAP_REG
const INTMTX_LEDC_MAP = 0x08c; // INTERRUPT_CORE0_LEDC_INT_MAP_REG
const INTMTX_EFUSE_MAP = 0x090; // INTERRUPT_CORE0_EFUSE_INT_MAP_REG (source 36)
const INTMTX_SHA_MAP = 0x150; // INTERRUPT_CORE0_SHA_INT_MAP_REG (source 84: 0x040 + 4*(84-16))
const INTMTX_CAN_MAP = 0x094; // INTERRUPT_CORE0_CAN_INT_MAP_REG
const INTMTX_RTC_CORE_MAP = 0x09c; // INTERRUPT_CORE0_RTC_CORE_INTR_MAP_REG
const INTMTX_RMT_MAP = 0x0a0; // INTERRUPT_CORE0_RMT_INTR_MAP_REG
const INTMTX_PCNT_MAP = 0x0a4; // INTERRUPT_CORE0_PCNT_INTR_MAP_REG
const INTMTX_I2C_EXT0_MAP = 0x0a8; // INTERRUPT_CORE0_I2C_EXT0_INTR_MAP_REG
const INTMTX_I2C_EXT1_MAP = 0x0ac; // INTERRUPT_CORE0_I2C_EXT1_INTR_MAP_REG
const INTMTX_SPI2_DMA_MAP = 0x0b0; // INTERRUPT_CORE0_SPI2_DMA_INT_MAP_REG
const INTMTX_SPI3_DMA_MAP = 0x0b4; // INTERRUPT_CORE0_SPI3_DMA_INT_MAP_REG
const INTMTX_SYSTIMER_TARGET0_MAP = 0x0e4; // INTERRUPT_CORE0_SYSTIMER_TARGET0_INT_MAP_REG (source 57)
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

// PCNT pulse counter (pcnt_reg.h / pcnt_ll.h). Four units, two
// channels per unit. GPIO input matrix signals are laid out as
// SIG_CH0, SIG_CH1, CTRL_CH0, CTRL_CH1 for each unit.
const PCNT_BASE = 0x60017000;
const PCNT_UNITS = 4;
const PCNT_CHANNELS = 2;
const PCNT_UNIT_CONF_STRIDE = 0x0c;
const PCNT_U_CONF0 = 0x00;
const PCNT_U_CONF1 = 0x04;
const PCNT_U_CONF2 = 0x08;
const PCNT_U_CNT = 0x30;
const PCNT_U_CNT_STRIDE = 0x04;
const PCNT_INT_RAW = 0x40;
const PCNT_INT_ST = 0x44;
const PCNT_INT_ENA = 0x48;
const PCNT_INT_CLR = 0x4c;
const PCNT_U_STATUS = 0x50;
const PCNT_U_STATUS_STRIDE = 0x04;
const PCNT_CTRL = 0x60;
const PCNT_DATE = 0xfc;
const PCNT_FILTER_EN = 1 << 10;
const PCNT_FILTER_THRES_MASK = 0x3ff; // U0_CONF0[9:0]: glitch-filter threshold in APB cycles
const PCNT_THR_ZERO_EN = 1 << 11;
const PCNT_THR_H_LIM_EN = 1 << 12;
const PCNT_THR_L_LIM_EN = 1 << 13;
const PCNT_THR_THRES0_EN = 1 << 14;
const PCNT_THR_THRES1_EN = 1 << 15;
const PCNT_CONF0_RESET = 16 | PCNT_FILTER_EN | PCNT_THR_ZERO_EN | PCNT_THR_H_LIM_EN | PCNT_THR_L_LIM_EN;
const PCNT_CTRL_RESET = 0x55;
const PCNT_DATE_RESET = 0x19072601;
const PCNT_CH0_NEG_MODE_SHIFT = 16;
const PCNT_CH0_POS_MODE_SHIFT = 18;
const PCNT_CH0_HCTRL_MODE_SHIFT = 20;
const PCNT_CH0_LCTRL_MODE_SHIFT = 22;
const PCNT_CH_FIELD_CHANNEL_SHIFT = 8;
const PCNT_MODE_MASK = 0x3;
const PCNT_ACTION_HOLD = 0;
const PCNT_ACTION_INCREASE = 1;
const PCNT_ACTION_DECREASE = 2;
const PCNT_CTRL_KEEP = 0;
const PCNT_CTRL_INVERT = 1;
const PCNT_SIG_CH0_IN0_IDX = 33;
const PCNT_MATRIX_SIGNALS_PER_UNIT = 4;
const PCNT_STATUS_THRES1_LAT = 1 << 2;
const PCNT_STATUS_THRES0_LAT = 1 << 3;
const PCNT_STATUS_L_LIM_LAT = 1 << 4;
const PCNT_STATUS_H_LIM_LAT = 1 << 5;
const PCNT_STATUS_ZERO_LAT = 1 << 6;

// SHA accelerator (hwcrypto_reg.h, DR_REG_SHA_BASE 0x6003B000). The non-DMA
// path: write SHA_MODE, write a software-padded 64-byte block to the message
// region, write SHA_START (first block: load the IV then run the per-block
// compression) or SHA_CONTINUE (accumulate onto the running state), poll
// SHA_BUSY (instant here), then read the digest words. Padding is done in
// firmware, so the engine only models the block compression.
const AES_BASE = 0x6003a000;
const AES_KEY_BASE = 0x00; // 8 key words (AES-128 uses the first 4)
const AES_TEXT_IN_BASE = 0x20; // 4 input words
const AES_TEXT_OUT_BASE = 0x30; // 4 output words
const AES_MODE = 0x40; // AES-128 encrypt = 0
const AES_TRIGGER = 0x48; // write 1 to start
const AES_STATE = 0x4c; // 0 idle / 1 busy / 2 done
const AES_MODE_AES128_ENC = 0;
const AES_STATE_DONE = 2;
const SHA_BASE = 0x6003b000;
const SHA_MODE = 0x00;
const SHA_START = 0x10;
const SHA_CONTINUE = 0x14;
const SHA_BUSY = 0x18;
const SHA_CLEAR_IRQ = 0x24; // write 1 to clear the completion interrupt
const SHA_INT_ENA = 0x28; // write 1 to enable the completion interrupt
const SHA_H_BASE = 0x40; // digest output: 8 words for SHA-256
const SHA_TEXT_BASE = 0x80; // message input: 16 words for SHA-256
const SHA_MODE_SHA1 = 0;
const SHA_MODE_SHA224 = 1;
const SHA_MODE_SHA256 = 2;
const SHA1_IV = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
// SHA-224 shares the SHA-256 block compression but uses a distinct initial vector.
const SHA224_IV = [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4];
const SHA256_IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const sha256Rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

// SHA-512/384 (64-bit-word algorithms). 64-bit values are carried as [hi32, lo32]
// pairs; the registers lay each out hi-word-first. Constants are FIPS 180-4
// (cross-checked vs mbed-TLS sha512.c and the Linux sha2.h IVs).
const SHA_MODE_SHA384 = 3;
const SHA_MODE_SHA512 = 4;
type Word64 = [number, number];
const SHA512_IV: Word64[] = [
  [0x6a09e667, 0xf3bcc908], [0xbb67ae85, 0x84caa73b], [0x3c6ef372, 0xfe94f82b], [0xa54ff53a, 0x5f1d36f1],
  [0x510e527f, 0xade682d1], [0x9b05688c, 0x2b3e6c1f], [0x1f83d9ab, 0xfb41bd6b], [0x5be0cd19, 0x137e2179],
];
const SHA384_IV: Word64[] = [
  [0xcbbb9d5d, 0xc1059ed8], [0x629a292a, 0x367cd507], [0x9159015a, 0x3070dd17], [0x152fecd8, 0xf70e5939],
  [0x67332667, 0xffc00b31], [0x8eb44a87, 0x68581511], [0xdb0c2e0d, 0x64f98fa7], [0x47b5481d, 0xbefa4fa4],
];
const SHA512_K: Word64[] = [
  [0x428a2f98, 0xd728ae22], [0x71374491, 0x23ef65cd], [0xb5c0fbcf, 0xec4d3b2f], [0xe9b5dba5, 0x8189dbbc],
  [0x3956c25b, 0xf348b538], [0x59f111f1, 0xb605d019], [0x923f82a4, 0xaf194f9b], [0xab1c5ed5, 0xda6d8118],
  [0xd807aa98, 0xa3030242], [0x12835b01, 0x45706fbe], [0x243185be, 0x4ee4b28c], [0x550c7dc3, 0xd5ffb4e2],
  [0x72be5d74, 0xf27b896f], [0x80deb1fe, 0x3b1696b1], [0x9bdc06a7, 0x25c71235], [0xc19bf174, 0xcf692694],
  [0xe49b69c1, 0x9ef14ad2], [0xefbe4786, 0x384f25e3], [0x0fc19dc6, 0x8b8cd5b5], [0x240ca1cc, 0x77ac9c65],
  [0x2de92c6f, 0x592b0275], [0x4a7484aa, 0x6ea6e483], [0x5cb0a9dc, 0xbd41fbd4], [0x76f988da, 0x831153b5],
  [0x983e5152, 0xee66dfab], [0xa831c66d, 0x2db43210], [0xb00327c8, 0x98fb213f], [0xbf597fc7, 0xbeef0ee4],
  [0xc6e00bf3, 0x3da88fc2], [0xd5a79147, 0x930aa725], [0x06ca6351, 0xe003826f], [0x14292967, 0x0a0e6e70],
  [0x27b70a85, 0x46d22ffc], [0x2e1b2138, 0x5c26c926], [0x4d2c6dfc, 0x5ac42aed], [0x53380d13, 0x9d95b3df],
  [0x650a7354, 0x8baf63de], [0x766a0abb, 0x3c77b2a8], [0x81c2c92e, 0x47edaee6], [0x92722c85, 0x1482353b],
  [0xa2bfe8a1, 0x4cf10364], [0xa81a664b, 0xbc423001], [0xc24b8b70, 0xd0f89791], [0xc76c51a3, 0x0654be30],
  [0xd192e819, 0xd6ef5218], [0xd6990624, 0x5565a910], [0xf40e3585, 0x5771202a], [0x106aa070, 0x32bbd1b8],
  [0x19a4c116, 0xb8d2d0c8], [0x1e376c08, 0x5141ab53], [0x2748774c, 0xdf8eeb99], [0x34b0bcb5, 0xe19b48a8],
  [0x391c0cb3, 0xc5c95a63], [0x4ed8aa4a, 0xe3418acb], [0x5b9cca4f, 0x7763e373], [0x682e6ff3, 0xd6b2b8a3],
  [0x748f82ee, 0x5defb2fc], [0x78a5636f, 0x43172f60], [0x84c87814, 0xa1f0ab72], [0x8cc70208, 0x1a6439ec],
  [0x90befffa, 0x23631e28], [0xa4506ceb, 0xde82bde9], [0xbef9a3f7, 0xb2c67915], [0xc67178f2, 0xe372532b],
  [0xca273ece, 0xea26619c], [0xd186b8c7, 0x21c0c207], [0xeada7dd6, 0xcde0eb1e], [0xf57d4f7f, 0xee6ed178],
  [0x06f067aa, 0x72176fba], [0x0a637dc5, 0xa2c898a6], [0x113f9804, 0xbef90dae], [0x1b710b35, 0x131c471b],
  [0x28db77f5, 0x23047d84], [0x32caab7b, 0x40c72493], [0x3c9ebe0a, 0x15c9bebc], [0x431d67c4, 0x9c100d4c],
  [0x4cc5d4be, 0xcb3e42b6], [0x597f299c, 0xfc657e2a], [0x5fcb6fab, 0x3ad6faec], [0x6c44198c, 0x4a475817],
];
const add64 = (a: Word64, b: Word64): Word64 => {
  const lo = a[1] + b[1];
  const hi = (a[0] + b[0] + (lo > 0xffffffff ? 1 : 0)) >>> 0;
  return [hi, lo >>> 0];
};
const xor64 = (a: Word64, b: Word64): Word64 => [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
const and64 = (a: Word64, b: Word64): Word64 => [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0];
const not64 = (a: Word64): Word64 => [(~a[0]) >>> 0, (~a[1]) >>> 0];
const rotr64 = (x: Word64, n: number): Word64 => {
  if (n === 32) return [x[1], x[0]];
  if (n < 32) {
    return [((x[0] >>> n) | (x[1] << (32 - n))) >>> 0, ((x[1] >>> n) | (x[0] << (32 - n))) >>> 0];
  }
  const m = n - 32;
  return [((x[1] >>> m) | (x[0] << (32 - m))) >>> 0, ((x[0] >>> m) | (x[1] << (32 - m))) >>> 0];
};
const shr64 = (x: Word64, n: number): Word64 => {
  if (n < 32) return [x[0] >>> n, ((x[1] >>> n) | (x[0] << (32 - n))) >>> 0];
  return [0, x[0] >>> (n - 32)];
};

// AES (FIPS-197), CPU-driven ECB path. The S-box is generated algebraically
// (GF(2^8) multiplicative inverse via log/antilog tables with generator 3, then
// the affine transform) so no 256-byte constant table is transcribed.
const aesRotl8 = (x: number, n: number): number => ((x << n) | (x >>> (8 - n))) & 0xff;
const aesXtime = (a: number): number => ((a << 1) ^ ((a & 0x80) !== 0 ? 0x1b : 0)) & 0xff;
const AES_SBOX: number[] = (() => {
  const exp: number[] = new Array(256).fill(0);
  const log: number[] = new Array(256).fill(0);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x = (x ^ aesXtime(x)) & 0xff; // x *= 3 in GF(2^8)
  }
  const inv = (a: number): number => (a === 0 ? 0 : (exp[(255 - (log[a] ?? 0)) % 255] ?? 0));
  const box: number[] = new Array(256).fill(0);
  for (let i = 0; i < 256; i++) {
    const s = inv(i);
    box[i] = (s ^ aesRotl8(s, 1) ^ aesRotl8(s, 2) ^ aesRotl8(s, 3) ^ aesRotl8(s, 4) ^ 0x63) & 0xff;
  }
  return box;
})();
const aesSub = (b: number): number => AES_SBOX[b & 0xff] ?? 0;
// AES key expansion for Nk = 4/6/8 (AES-128/192/256): key bytes -> 16*(Nr+1)
// round-key bytes, Nr = Nk + 6.
const aesExpandKey = (key: number[], nk: number): number[] => {
  const nr = nk + 6;
  const total = 16 * (nr + 1);
  const keyBytes = nk * 4;
  const rk: number[] = new Array(total).fill(0);
  for (let i = 0; i < keyBytes; i++) rk[i] = key[i] ?? 0;
  const rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d];
  for (let i = keyBytes; i < total; i += 4) {
    let t0 = rk[i - 4] ?? 0;
    let t1 = rk[i - 3] ?? 0;
    let t2 = rk[i - 2] ?? 0;
    let t3 = rk[i - 1] ?? 0;
    const wordIdx = i / 4;
    if (wordIdx % nk === 0) {
      const a0 = t0;
      t0 = aesSub(t1) ^ (rcon[wordIdx / nk - 1] ?? 0); // RotWord + SubWord + Rcon
      t1 = aesSub(t2);
      t2 = aesSub(t3);
      t3 = aesSub(a0);
    } else if (nk > 6 && wordIdx % nk === 4) {
      t0 = aesSub(t0); // AES-256 extra SubWord
      t1 = aesSub(t1);
      t2 = aesSub(t2);
      t3 = aesSub(t3);
    }
    rk[i] = (rk[i - keyBytes] ?? 0) ^ t0;
    rk[i + 1] = (rk[i - keyBytes + 1] ?? 0) ^ t1;
    rk[i + 2] = (rk[i - keyBytes + 2] ?? 0) ^ t2;
    rk[i + 3] = (rk[i - keyBytes + 3] ?? 0) ^ t3;
  }
  return rk;
};
// AES encrypt one 16-byte block over Nr rounds (column-major state, s[r + 4c]).
const aesEncryptBlock = (input: number[], roundKeys: number[], nr: number): number[] => {
  const s: number[] = new Array(16);
  for (let i = 0; i < 16; i++) s[i] = ((input[i] ?? 0) ^ (roundKeys[i] ?? 0)) & 0xff; // AddRoundKey 0
  for (let round = 1; round <= nr; round++) {
    for (let i = 0; i < 16; i++) s[i] = aesSub(s[i] ?? 0); // SubBytes
    // ShiftRows: row r rotates left by r (state is column-major, row r at indices r,r+4,r+8,r+12)
    for (let r = 1; r < 4; r++) {
      const row = [s[r] ?? 0, s[r + 4] ?? 0, s[r + 8] ?? 0, s[r + 12] ?? 0];
      for (let c = 0; c < 4; c++) s[r + 4 * c] = row[(c + r) % 4] ?? 0;
    }
    if (round !== nr) {
      for (let c = 0; c < 4; c++) {
        // MixColumns on column c (bytes s[4c..4c+3])
        const a0 = s[4 * c] ?? 0;
        const a1 = s[4 * c + 1] ?? 0;
        const a2 = s[4 * c + 2] ?? 0;
        const a3 = s[4 * c + 3] ?? 0;
        s[4 * c] = (aesXtime(a0) ^ (aesXtime(a1) ^ a1) ^ a2 ^ a3) & 0xff;
        s[4 * c + 1] = (a0 ^ aesXtime(a1) ^ (aesXtime(a2) ^ a2) ^ a3) & 0xff;
        s[4 * c + 2] = (a0 ^ a1 ^ aesXtime(a2) ^ (aesXtime(a3) ^ a3)) & 0xff;
        s[4 * c + 3] = ((aesXtime(a0) ^ a0) ^ a1 ^ a2 ^ aesXtime(a3)) & 0xff;
      }
    }
    for (let i = 0; i < 16; i++) s[i] = (s[i] ?? 0) ^ (roundKeys[16 * round + i] ?? 0); // AddRoundKey
  }
  return s;
};

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
// ticks — the selected RC_SLOW/XTAL32K/RC_FAST_D256 source; stage 0
// applies the eFuse WDT_DELAY_SEL multiplier rwdt_ll.h compensates for),
// WDTFEED +0xAC (bit 31), WDTWPROTECT +0xB0 (same 0x50D83AA1 key —
// hal/esp32s3/include/hal/rwdt_ll.h). Reset value keeps the header's
// FLASHBOOT_MOD_EN(12)/PAUSE_IN_SLP(9)/reset-length defaults, all
// inert except PAUSE_IN_SLP, which freezes the modeled RWDT while RTC
// sleep is active.
const RTC_WDTCONFIG0 = 0x98;
const RTC_WDTCONFIG1 = 0x9c; // ..+0xA8: stage0..3
const RTC_WDTFEED = 0xac;
const RTC_WDTWPROTECT = 0xb0;
const RTC_SWD_CONF = 0xb4;
const RTC_SWD_WPROTECT = 0xb8;
const RTC_ULP_CP_TIMER = 0xfc;
const RTC_ULP_CP_CTRL = 0x100;
const RTC_COCPU_CTRL = 0x104;
const RTC_ULP_CP_TIMER_1 = 0x134;
const RTC_PG_CTRL = 0x144;
const RTC_FIB_SEL = 0x148;
const RTC_BROWN_OUT = 0xe8;
const RTC_WDT_FEED_BIT = 1 << 31; // RTC_CNTL_RTC_WDT_FEED
const RTC_WDT_PAUSE_IN_SLP = 1 << 9;
const RTC_SWD_WKEY = 0x8f1d312a;
const RTC_SWD_DISABLE = 1 << 30;
const RTC_SWD_FEED = 1 << 29;
const RTC_SWD_RST_FLAG_CLR = 1 << 28;
const RTC_SWD_BYPASS_RST = 1 << 17;
const RTC_SWD_FEED_INT = 1 << 1;
const RTC_SWD_RESET_FLAG = 1 << 0;
const RTC_SWD_CONF_RESET = 300 << 18;
const RTC_ULP_CP_TIMER_RESET = 0;
const RTC_ULP_CP_CTRL_RESET = ((512 << 11) | 512) >>> 0;
const RTC_ULP_CP_TIMER_1_RESET = 200 << 8;
const RTC_ULP_CP_SLP_TIMER_EN = 1 << 31;
const RTC_ULP_CP_GPIO_WAKEUP_CLR = 1 << 30;
const RTC_ULP_CP_TIMER_SLP_CYCLE_SHIFT = 8;
const RTC_ULP_CP_TIMER_SLP_CYCLE_MASK = 0x00ff_ffff;
const RTC_ULP_CP_START_TOP = 1 << 31;
const RTC_ULP_CP_FORCE_START_TOP = 1 << 30;
const RTC_ULP_CP_RESET = 1 << 29;
const RTC_ULP_CP_MEM_OFFST_CLR = 1 << 22;
const RTC_COCPU_DONE = 1 << 25;
const RTC_COCPU_SHUT_RESET_EN = 1 << 22;
const RTC_COCPU_SW_INT_TRIGGER = 1 << 26;
const RTC_COCPU_CTRL_RESET = ((1 << 23) | (40 << 14) | (16 << 7) | (8 << 1)) >>> 0;
const RTC_BROWN_OUT_DET = 1 << 31;
const RTC_BROWN_OUT_ENA = 1 << 30;
const RTC_BROWN_OUT_CNT_CLR = 1 << 29;
const RTC_BROWN_OUT_ANA_RST_EN = 1 << 28;
const RTC_BROWN_OUT_RST_ENA = 1 << 26;
const RTC_BROWN_OUT_RESET = (RTC_BROWN_OUT_ENA | (0x3ff << 16) | (1 << 4)) >>> 0;
const RTC_POWER_GLITCH_EN = 1 << 31;
const RTC_POWER_GLITCH_EFUSE_SEL = 1 << 30;
const RTC_PG_CTRL_RESET = 0;
const RTC_FIB_SEL_MASK = 0x7;
const RTC_FIB_SEL_RESET = 0x7;
const RTC_FIB_GLITCH_RST = 1 << 0;
const RTC_FIB_BOD_RST = 1 << 1;
const RTC_FIB_SUPER_WDT_RST = 1 << 2;
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

// SYSTIMER (systimer_reg.h): two 52-bit up-counters + three comparators at
// 0x60023000. UNIT0 counts at 16 MHz (XTAL 40 MHz / 2.5, hardwired), so one
// SYSTIMER tick is CLOCK_HZ / 16 MHz = 15 CPU cycles. This first slice models
// UNIT0's counter and its UPDATE/VALUE_VALID latch read path (what esp_timer
// polls); comparators/alarms/interrupts land in a follow-on slice.
const SYSTIMER_BASE = 0x60023000;
const SYSTIMER_BLOCK_BYTES = 0x100;
const SYSTIMER_CYCLES_PER_TICK = CLOCK_HZ / 16_000_000; // 15
const SYSTIMER_COUNT_MOD = 0x10000000000000; // 2^52 (counter width)
const SYSTIMER_CONF = 0x00;
const SYSTIMER_UNIT0_OP = 0x04;
const SYSTIMER_UNIT0_LOAD_HI = 0x0c;
const SYSTIMER_UNIT0_LOAD_LO = 0x10;
const SYSTIMER_UNIT0_VALUE_HI = 0x40;
const SYSTIMER_UNIT0_VALUE_LO = 0x44;
const SYSTIMER_UNIT0_LOAD = 0x5c;
const SYSTIMER_UNIT1_OP = 0x08;
const SYSTIMER_UNIT1_LOAD_HI = 0x14;
const SYSTIMER_UNIT1_LOAD_LO = 0x18;
const SYSTIMER_UNIT1_VALUE_HI = 0x48;
const SYSTIMER_UNIT1_VALUE_LO = 0x4c;
const SYSTIMER_UNIT1_LOAD = 0x60;
const SYSTIMER_TIMER_UNIT1_WORK_EN = 1 << 2; // CONF bit 2
const SYSTIMER_INT_ENA = 0x64;
const SYSTIMER_INT_RAW = 0x68;
const SYSTIMER_INT_CLR = 0x6c;
const SYSTIMER_INT_ST = 0x70;
const SYSTIMER_TIMER_UNIT0_WORK_EN = 1 << 1; // CONF bit 1
const SYSTIMER_TARGET0_WORK_EN = 1 << 7; // CONF bit 7 — enable COMP0 (COMP1=8, COMP2=9)
const SYSTIMER_TARGET_UNIT_SEL = 1 << 31; // TARGETn_CONF bit 31 — 0=UNIT0, 1=UNIT1
const SYSTIMER_TIMER_UNIT0_UPDATE = 1 << 30; // UNIT0_OP write strobe
const SYSTIMER_TIMER_UNIT0_VALUE_VALID = 1 << 29; // UNIT0_OP read-only flag
const SYSTIMER_TARGET0_INT = 1 << 0; // INT_* bit 0 — COMP0/TARGET0 alarm
const SYSTIMER_INT_MASK = 0x7; // TARGET0/1/2
const SYSTIMER_TARGET0_PERIOD_MODE = 1 << 30; // TARGET0_CONF bit 30
const SYSTIMER_TARGET0_PERIOD_MASK = 0x03ffffff; // TARGET0_CONF bits [25:0]
/** Walk-the-bus guard for strlen / %s — a missing NUL must refuse,
 *  not spin forever. */
const ROM_STR_MAX = 0x10000;

// ── Slice 11: RTC_CNTL / eFuse / SYSTEM ──
// Bases from reg_base.h (DR_REG_EFUSE_BASE / DR_REG_RTCCNTL_BASE /
// DR_REG_RTCIO_BASE / DR_REG_SYSTEM_BASE); offsets and fields from
// rtc_cntl_reg.h, rtc_io_reg.h, efuse_reg.h, system_reg.h — all esp-idf v5.2
// components/soc/esp32s3/include/soc/. Policy for these three blocks:
// reads of unmodeled registers REFUSE with a diagnostic (a benign
// zero would silently lie — 0 in RTC_CNTL_WDTCONFIG0 claims "watchdog
// off"); unmodeled writes are accepted and dropped, consistent with
// the other peripheral blocks (a dropped config write cannot steer
// firmware logic the way a fabricated read can).
const RTCCNTL_BASE = 0x60008000;
const RTCCNTL_END = 0x60008800; // SENS sits at +0x800
const RTCIO_BASE = 0x60008400;
const RTCIO_END = 0x60008800;
const RTC_OPTIONS0 = 0x00; // SW_SYS_RST bit 31, SW_PROCPU_RST bit 5, SW_APPCPU_RST bit 4 (all WO)
const RTC_SLP_TIMER0 = 0x04; // SLP_VAL_LO [31:0]
const RTC_SLP_TIMER1 = 0x08; // SLP_VAL_HI [15:0], MAIN_TIMER_ALARM_EN bit 16 (WO)
const RTC_TIME_UPDATE = 0x0c; // TIME_UPDATE bit 31 latches the main timer
const RTC_TIME_LOW0 = 0x10; // latched timer [31:0]
const RTC_TIME_HIGH0 = 0x14; // latched timer [47:32] in [15:0]
const RTC_STATE0 = 0x18; // SLEEP_EN/SLP_WAKEUP/SLP_REJECT status and command bits
const RTC_ANA_CONF = 0x34; // GLITCH_RST_EN bit 20; analog/I2C power defaults below
const RTC_DIG_PWC = 0x90; // RTC_CNTL_DIG_PWC_REG
const RTC_DG_WRAP_PD_EN = 0x80000000; // DG_WRAP_PD_EN bit 31 — powers down the digital core (deep sleep)
const RTC_RESET_STATE = 0x38; // RESET_CAUSE_PROCPU [5:0], RESET_CAUSE_APPCPU [11:6]
const RTC_WAKEUP_STATE = 0x3c; // WAKEUP_ENA [31:15], raw trigger bitmap
const RTC_INT_ENA = 0x40;
const RTC_INT_RAW = 0x44;
const RTC_INT_ST = 0x48;
const RTC_INT_CLR = 0x4c;
const RTC_EXT_XTL_CONF = 0x60;
const RTC_EXT_WAKEUP_CONF = 0x64;
const RTC_SLP_REJECT_CONF = 0x68;
const RTC_CLK_CONF = 0x74;
const RTC_SLOW_CLK_CONF = 0x78;
const RTC_SW_SYS_RST = 1 << 31;
const RTC_SW_PROCPU_RST = 1 << 5;
const RTC_MAIN_TIMER_ALARM_EN = 1 << 16;
const RTC_SLP_VAL_HI_MASK = 0xffff;
const RTC_SLEEP_EN = 1 << 31;
const RTC_SLP_REJECT = 1 << 30;
const RTC_SLP_WAKEUP = 1 << 29;
const RTC_SLP_REJECT_CAUSE_CLR = 1 << 1;
const RTC_SW_CPU_INT = 1 << 0;
const RTC_LIGHT_SLP_REJECT_EN = 1 << 30;
const RTC_SLEEP_REJECT_ENA_SHIFT = 12;
const RTC_SLEEP_REJECT_ENA_MASK = 0x3ffff;
const RTC_WAKEUP_ENA_SHIFT = 15;
const RTC_WAKEUP_ENA_MASK = 0x1ffff;
const RTC_WAKEUP_STATE_RESET = 0x000c << RTC_WAKEUP_ENA_SHIFT; // rtc_cntl_reg.h default: 17'b1100
const RTC_SLP_WAKEUP_INT = 1 << 0;
const RTC_SLP_REJECT_INT = 1 << 1;
const RTC_SDIO_IDLE_INT = 1 << 2;
const RTC_WDT_INT = 1 << 3;
const RTC_TOUCH_SCAN_DONE_INT = 1 << 4;
const RTC_ULP_CP_INT = 1 << 5;
const RTC_TOUCH_DONE_INT = 1 << 6;
const RTC_TOUCH_ACTIVE_INT = 1 << 7;
const RTC_TOUCH_INACTIVE_INT = 1 << 8;
const RTC_BROWN_OUT_INT = 1 << 9;
const RTC_SARADC1_INT = 1 << 11;
const RTC_TSENS_INT = 1 << 12;
const RTC_COCPU_INT = 1 << 13;
const RTC_SARADC2_INT = 1 << 14;
const RTC_SWD_INT = 1 << 15;
const RTC_XTAL32K_DEAD_INT = 1 << 16;
const RTC_COCPU_TRAP_INT = 1 << 17;
const RTC_TOUCH_TIMEOUT_INT = 1 << 18;
const RTC_GLITCH_DET_INT = 1 << 19;
const RTC_TOUCH_APPROACH_LOOP_DONE_INT = 1 << 20;
const RTC_INT_RAW_WRITABLE = RTC_TOUCH_APPROACH_LOOP_DONE_INT;
const RTC_MAIN_TIMER_INT = 1 << 10;
const RTC_TOUCH_INT_MASK =
  RTC_TOUCH_SCAN_DONE_INT |
  RTC_TOUCH_DONE_INT |
  RTC_TOUCH_ACTIVE_INT |
  RTC_TOUCH_INACTIVE_INT |
  RTC_TOUCH_TIMEOUT_INT |
  RTC_TOUCH_APPROACH_LOOP_DONE_INT;
const RTC_XTAL32K_CONF = 0xf8;
const RTC_LOW_POWER_ST = 0xd0;
const RTC_EXT_WAKEUP1 = 0xe0;
const RTC_EXT_WAKEUP1_STATUS = 0xe4;
const RTC_SLP_REJECT_CAUSE = 0x128;
const RTC_SLP_WAKEUP_CAUSE = 0x130;
const RTC_INT_ENA_W1TS = 0x138;
const RTC_INT_ENA_W1TC = 0x13c;
const RTC_EXT_WAKEUP1_LV = 1 << 31;
const RTC_EXT_WAKEUP0_LV = 1 << 30;
const RTC_GPIO_WAKEUP_FILTER = 1 << 29;
const RTC_EXT_WAKEUP_CONF_MASK = RTC_EXT_WAKEUP1_LV | RTC_EXT_WAKEUP0_LV | RTC_GPIO_WAKEUP_FILTER;
const RTC_EXT_WAKEUP1_STATUS_CLR = 1 << 22;
const RTC_EXT_WAKEUP1_SEL_MASK = 0x003f_ffff;
const RTC_IO_EXT_WAKEUP0 = 0xdc;
const RTC_IO_EXT_WAKEUP0_SEL_SHIFT = 27;
const RTC_IO_EXT_WAKEUP0_SEL_MASK = 0xf800_0000;
const RTC_MAIN_STATE_IN_IDLE = 1 << 27;
const RTC_MAIN_STATE_IN_SLP = 1 << 26;
const RTC_RDY_FOR_WAKEUP = 1 << 19;
const RTC_COCPU_STATE_DONE = 1 << 16;
const RTC_COCPU_STATE_SLP = 1 << 15;
const RTC_EXT0_TRIG_EN = 1 << 0;
const RTC_EXT1_TRIG_EN = 1 << 1;
const RTC_GPIO_TRIG_EN = 1 << 2;
const RTC_TIMER_TRIG_EN = 1 << 3; // components/esp_hw_support/port/esp32s3/include/soc/rtc.h
const RTC_SDIO_TRIG_EN = 1 << 4;
const RTC_WIFI_TRIG_EN = 1 << 5;
const RTC_UART0_TRIG_EN = 1 << 6;
const RTC_UART1_TRIG_EN = 1 << 7;
const RTC_ULP_TRIG_EN = 1 << 9;
const RTC_BT_TRIG_EN = 1 << 10;
const RTC_COCPU_TRIG_EN = 1 << 11;
const RTC_XTAL32K_DEAD_TRIG_EN = 1 << 12;
const RTC_COCPU_TRAP_TRIG_EN = 1 << 13;
const RTC_XTAL32K_WDT_EN = 1 << 0;
const RTC_XTAL32K_WDT_RESET = 1 << 2;
const RTC_GLITCH_RST_EN = 1 << 20;
const RTC_ANA_CONF_RESET = ((1 << 22) | (1 << 18)) >>> 0;
const RTC_EXT_XTL_CONF_RESET = ((3 << 17) | (3 << 13) | (3 << 10) | (1 << 7)) >>> 0;
const RTC_XTAL32K_CONF_RESET = 0xff << 20;
// Reset causes (esp_rom/include/esp32s3/rom/rtc.h RESET_REASON —
// static-asserted equal to soc_reset_reason_t, the values
// esp_rom_get_reset_reason/esp_reset_reason consume):
const RESET_CAUSE_POWERON = 1; // POWERON_RESET
const RESET_CAUSE_SW_SYS = 3; // RTC_SW_SYS_RESET — ROM software_reset / SW_SYS_RST
const RESET_CAUSE_SW_CPU = 12; // RTC_SW_CPU_RESET — SW_PROCPU_RST (esp_restart's path)
const RESET_CAUSE_DEEPSLEEP = 5; // DEEPSLEEP_RESET — wake from deep sleep boots fresh
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
const RESET_CAUSE_GLITCH_RTC = 19; // GLITCH_RTC_RESET
const RESET_CAUSE_POWER_GLITCH = 23; // POWER_GLITCH_RESET
// The RTC main timer and RWDT count RTC_SLOW_CLK. ESP-IDF's clk_tree
// maps ANA_CLK_RTC_SEL to RC_SLOW, XTAL32K, or RC_FAST_D256.
const RTC_CLK_CONF_RESET = 0x1158321c; // rtc_cntl_reg.h reset fields
const RTC_SLOW_CLK_CONF_RESET = 1 << 22; // ANA_CLK_DIV_VLD reset bit
const RTC_ANA_CLK_RTC_SEL_SHIFT = 30;
const RTC_ANA_CLK_RTC_SEL_MASK = 0x3;
const RTC_ANA_CLK_DIV_SHIFT = 23;
const RTC_ANA_CLK_DIV_MASK = 0xff;
const RTC_ANA_CLK_DIV_VLD = 1 << 22;
const RTC_SLOW_SRC_RC_SLOW = 0;
const RTC_SLOW_SRC_XTAL32K = 1;
const RTC_SLOW_SRC_RC_FAST_D256 = 2;
const RTC_RC_SLOW_HZ = 136_000;
const RTC_XTAL32K_HZ = 32_768;
const RTC_RC_FAST_D256_HZ = Math.floor(17_500_000 / 256);

const EFUSE_BASE = 0x60007000;
const EFUSE_PGM_DATA_0 = 0x00;
const EFUSE_PGM_DATA_WORDS = 8;
const EFUSE_PGM_CHECK_VALUE_0 = 0x20;
const EFUSE_PGM_CHECK_WORDS = 3;
const EFUSE_RD_WR_DIS = 0x2c;
const EFUSE_RD_REPEAT_DATA_0 = 0x30;
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
const EFUSE_WDT_DELAY_SEL_SHIFT = 16;
const EFUSE_WDT_DELAY_SEL_MASK = 0x3;
const EFUSE_POWERGLITCH_EN = 1 << 30;
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
const SENS_SAR_READER1_CTRL = 0x00;
const SENS_SAR_MEAS1_CTRL2 = 0x0c;
const SENS_SAR_READER2_CTRL = 0x24;
const SENS_SAR_MEAS2_CTRL2 = 0x30;
const SENS_SAR_TSENS_CTRL = 0x50;
const SENS_SAR_TSENS_CTRL2 = 0x54;
const SENS_SAR_COCPU_STATE = 0xe4;
const SENS_SAR1_INT_EN = 1 << 29;
const MEAS1_DONE_SAR = 1 << 16;
const MEAS1_START_SAR = 1 << 17;
const SENS_SAR2_INT_EN = 1 << 30;
const MEAS2_DONE_SAR = 1 << 16;
const MEAS2_START_SAR = 1 << 17;
const SENS_SAR_READER1_CTRL_RESET = (SENS_SAR1_INT_EN | (1 << 18) | 2) >>> 0;
const SENS_SAR_READER2_CTRL_RESET = (SENS_SAR2_INT_EN | (1 << 18) | (1 << 16) | 2) >>> 0;
const SENS_TSENS_DUMP_OUT = 1 << 24;
const SENS_TSENS_INT_EN = 1 << 12;
const SENS_TSENS_READY = 1 << 8;
const SENS_TSENS_CTRL_RESET = (SENS_TSENS_INT_EN | (6 << 14)) >>> 0;
const SENS_TSENS_CTRL2_RESET = ((1 << 14) | 2) >>> 0;
const SENS_TSENS_DEFAULT_OUT = 128;
const SENS_COCPU_TRAP = 1 << 29;
const SENS_COCPU_DBG_TRIGGER = 1 << 25;
// 12-bit result. Attenuation is not modeled: full scale is the 3.3 V
// supply, quantized like the RP2040 core does.
const ADC_VREF = 3.3;
const ADC_MAX = 4095;
// The McuCore ADC sampler/read-log surface is one-dimensional. Keep
// ADC1 as 0..9, expose ADC2 as 10..19 (ADC2 channel n = GPIO n+11).
const ADC2_SAMPLER_CHANNEL_BASE = 10;

const RTC_TOUCH_CTRL1 = 0x108;
const RTC_TOUCH_CTRL2 = 0x10c;
const RTC_TOUCH_SCAN_CTRL = 0x110;
const RTC_TOUCH_SLP_THRES = 0x114;
const RTC_TOUCH_APPROACH = 0x118;
const RTC_TOUCH_FILTER_CTRL = 0x11c;
const RTC_TOUCH_TIMEOUT_CTRL = 0x124;
const RTC_TOUCH_DAC = 0x14c;
const RTC_TOUCH_DAC1 = 0x150;
const RTC_TOUCH_CTRL1_RESET = ((0x1000 << 16) | 0x100) >>> 0;
const RTC_TOUCH_CTRL2_RESET = ((4 << 17) | (1 << 14) | (3 << 6) | (3 << 2)) >>> 0;
const RTC_TOUCH_SCAN_CTRL_RESET = ((0xf << 28) | (1 << 8) | 2) >>> 0;
const RTC_TOUCH_SLP_THRES_RESET = 0xf << 27;
const RTC_TOUCH_APPROACH_RESET = 80 << 24;
const RTC_TOUCH_SLP_PAD_SHIFT = 27;
const RTC_TOUCH_SLP_PAD_MASK = 0x1f;
const RTC_TOUCH_SLEEP_CYCLES_MASK = 0xffff;
const RTC_TOUCH_SLP_APPROACH_EN = 1 << 26;
const RTC_TOUCH_APPROACH_MEAS_TIME_SHIFT = 24;
const RTC_TOUCH_APPROACH_MEAS_TIME_MASK = 0xff << RTC_TOUCH_APPROACH_MEAS_TIME_SHIFT;
const RTC_TOUCH_FILTER_CTRL_RESET =
  ((1 << 31) | (1 << 28) | (3 << 25) | (1 << 23) | (1 << 21) | (1 << 19) | (5 << 15) | (1 << 11)) >>> 0;
const RTC_TOUCH_TIMEOUT_CTRL_RESET = ((1 << 22) | 0x3fffff) >>> 0;
const RTC_TOUCH_RESET = 1 << 29;
const RTC_TOUCH_START_EN = 1 << 15;
const RTC_TOUCH_SLP_TIMER_EN = 1 << 13;
const RTC_TOUCH_SLP_CHANNEL_CLR = 1 << 23;
const RTC_TOUCH_TIMEOUT_EN = 1 << 22;
const RTC_TOUCH_TIMEOUT_NUM_MASK = 0x003f_ffff;
const RTC_TOUCH_SCAN_PAD_MAP_SHIFT = 10;
const RTC_TOUCH_SCAN_PAD_MAP_MASK = 0x7fff << RTC_TOUCH_SCAN_PAD_MAP_SHIFT;
const RTC_TOUCH_TRIG_EN = 1 << 8;
const TOUCH_CHANNEL_MASK = 0x7fff;
const TOUCH_CHANNEL_COUNT = 15;
const SENS_SAR_TOUCH_CONF = 0x5c;
const SENS_TOUCH_DENOISE_END = 1 << 18;
const SENS_TOUCH_UNIT_END = 1 << 19;
const SENS_TOUCH_STATUS_CLR = 1 << 15;
const SENS_TOUCH_OUTEN_MASK = TOUCH_CHANNEL_MASK;
const SENS_TOUCH_DATA_SEL_SHIFT = 16;
const SENS_TOUCH_DATA_SEL_MASK = 0x3 << SENS_TOUCH_DATA_SEL_SHIFT;
const SENS_TOUCH_DATA_SEL_BENCHMARK = 2;
const SENS_TOUCH_CONF_RESET = ((0xf << 28) | (0xf << 24) | (0xf << 20) | SENS_TOUCH_OUTEN_MASK) >>> 0;
const SENS_SAR_TOUCH_THRES1 = 0x64;
const SENS_TOUCH_THRES_COUNT = 14;
const SENS_TOUCH_THRES_MASK = 0x003f_ffff;
const SENS_SAR_TOUCH_CHN_ST = 0x9c;
const SENS_TOUCH_MEAS_DONE = 1 << 31;
const SENS_TOUCH_CHANNEL_CLR_MASK = TOUCH_CHANNEL_MASK << 15;
const SENS_SAR_TOUCH_STATUS0 = 0xa0;
const SENS_SAR_TOUCH_STATUS_STRIDE = 4;
const SENS_SAR_TOUCH_SLP_STATUS = 0xdc;
const SENS_SAR_TOUCH_APPR_STATUS = 0xe0;
const SENS_TOUCH_SCAN_CURR_SHIFT = 22;
const SENS_TOUCH_DATA_MASK = 0x003f_ffff;
const SENS_TOUCH_DEBOUNCE_SHIFT = 29;
const SENS_TOUCH_DEBOUNCE_MASK = 0x7;
const SENS_TOUCH_DEFAULT_DATA = 2048;
const SENS_TOUCH_APPROACH_PAD0_SHIFT = 28;
const SENS_TOUCH_APPROACH_PAD1_SHIFT = 24;
const SENS_TOUCH_APPROACH_PAD2_SHIFT = 20;
const SENS_TOUCH_APPROACH_PAD_MASK = 0xf;
const SENS_TOUCH_APPROACH_DISABLED = 0xf;
const SENS_TOUCH_APPROACH_COUNT_MASK = 0xff;

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
const GDMA_IN_CHECK_OWNER = 1 << 12; // IN_CONF1 bit 12 — gate descriptor owner checking (reset 0 = off)
const GDMA_OUT_AUTO_WRBACK = 1 << 2; // OUT_CONF0 bit 2 — auto-clear OWNER after TX (reset 0 = off)
const GDMA_OUT_CHECK_OWNER = 1 << 12; // OUT_CONF1 bit 12 — gate TX descriptor owner checking (reset 0 = off)
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

interface PcntUnit {
  conf0: number;
  conf1: number;
  conf2: number;
  count: number;
  status: number;
  lastPulse: Array<DigitalLevel | null>;
  lastCtrl: Array<DigitalLevel | null>;
  pendingPulse: Array<DigitalLevel | null>; // glitch filter: candidate level awaiting >= FILTER_THRES cycles
  pendingPulseCycle: number[];
}

interface I2cController {
  regs: Map<number, number>;
  commands: number[];
  txFifo: number[];
  rxFifo: number[];
  txMem: number[];
  rxMem: number[];
  intRaw: number;
  intEna: number;
  maps: InterruptMapPair;
  writeLog: number[];
  lastAck: 0 | 1;
}

interface SpiController {
  regs: Map<number, number>;
  words: number[];
  intRaw: number;
  intEna: number;
  maps: InterruptMapPair;
  writeLog: number[];
}

interface McpwmTimer {
  cfg0: number;
  cfg1: number;
  syncReg: number;
  base: number;
  sync: number;
  tezSerial: number;
  tepSerial: number;
}

interface McpwmOperator {
  stmpCfg: number;
  tstmpA: number;
  tstmpB: number;
  cfg0: number;
  force: number;
  genA: number;
  genB: number;
  cmpASerial: number;
  cmpBSerial: number;
}

interface McpwmGroup {
  clkCfg: number;
  timers: McpwmTimer[];
  operators: McpwmOperator[];
  operatorTimerSel: number;
  intRaw: number;
  intEna: number;
  maps: InterruptMapPair;
  clk: number;
}

interface TwaiController {
  mode: number;
  busTiming0: number;
  busTiming1: number;
  arbLostCapture: number;
  arbLostCaptureArmed: boolean;
  errCodeCapture: number;
  errWarningLimit: number;
  rxErrCounter: number;
  txErrCounter: number;
  buffer: number[];
  acceptance: number[];
  rxFifo: number[][];
  txLog: number[][];
  events: Esp32s3TwaiEvent[];
  pendingTx: number[] | null;
  pendingTxSelfReceive: boolean;
  pendingTxSingleShot: boolean;
  txComplete: boolean;
  dataOverrun: boolean;
  busOff: boolean;
  interrupt: number;
  interruptEna: number;
  clockDivider: number;
  maps: InterruptMapPair;
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

const freshPcntUnit = (): PcntUnit => ({
  conf0: PCNT_CONF0_RESET,
  conf1: 0,
  conf2: 0,
  count: 0,
  status: 0,
  lastPulse: Array(PCNT_CHANNELS).fill(null) as Array<DigitalLevel | null>,
  lastCtrl: Array(PCNT_CHANNELS).fill(null) as Array<DigitalLevel | null>,
  pendingPulse: Array(PCNT_CHANNELS).fill(null) as Array<DigitalLevel | null>,
  pendingPulseCycle: Array(PCNT_CHANNELS).fill(0) as number[],
});

const freshI2cController = (): I2cController => ({
  regs: new Map<number, number>([
    [I2C_SCL_LOW_PERIOD, 0],
    [I2C_CTR, I2C_CTR_RESET],
    [I2C_TO, I2C_TO_RESET],
    [I2C_SLAVE_ADDR, 0],
    [I2C_FIFO_CONF, I2C_FIFO_CONF_RESET],
    [I2C_SDA_HOLD, 0],
    [I2C_SDA_SAMPLE, 0],
    [I2C_SCL_HIGH_PERIOD, 0],
    [I2C_SCL_START_HOLD, I2C_SCL_SETUP_RESET],
    [I2C_SCL_RSTART_SETUP, I2C_SCL_SETUP_RESET],
    [I2C_SCL_STOP_HOLD, I2C_SCL_SETUP_RESET],
    [I2C_SCL_STOP_SETUP, I2C_SCL_SETUP_RESET],
    [I2C_FILTER_CFG, I2C_FILTER_CFG_RESET],
    [I2C_CLK_CONF, I2C_CLK_CONF_RESET],
    [I2C_SCL_ST_TIME_OUT, I2C_SCL_ST_TIMEOUT_RESET],
    [I2C_SCL_MAIN_ST_TIME_OUT, I2C_SCL_ST_TIMEOUT_RESET],
    [I2C_SCL_SP_CONF, 0],
    [I2C_SCL_STRETCH_CONF, 0],
  ]),
  commands: Array(I2C_CMD_COUNT).fill(0) as number[],
  txFifo: [],
  rxFifo: [],
  txMem: Array(I2C_FIFO_LEN).fill(0) as number[],
  rxMem: Array(I2C_FIFO_LEN).fill(0) as number[],
  intRaw: 0,
  intEna: 0,
  maps: freshInterruptMapPair(),
  writeLog: [],
  lastAck: 0,
});

const freshSpiController = (): SpiController => ({
  regs: new Map<number, number>([
    [SPI_CMD, 0],
    [SPI_ADDR, 0],
    [SPI_CTRL, 0],
    [SPI_CLOCK, SPI_CLOCK_RESET],
    [SPI_USER, SPI_USER_RESET],
    [SPI_USER1, SPI_USER1_RESET],
    [SPI_USER2, SPI_USER2_RESET],
    [SPI_MS_DLEN, 0],
    [SPI_MISC, 0],
    [SPI_DMA_CONF, 0],
    [SPI_SLAVE, 0],
    [SPI_SLAVE1, 0],
    [SPI_CLK_GATE, 0],
  ]),
  words: Array(SPI_WORD_COUNT).fill(0) as number[],
  intRaw: 0,
  intEna: 0,
  maps: freshInterruptMapPair(),
  writeLog: [],
});

const freshMcpwmTimer = (): McpwmTimer => ({
  cfg0: MCPWM_TIMER_CFG0_RESET,
  cfg1: 0,
  syncReg: 0,
  base: 0,
  sync: 0,
  tezSerial: 0,
  tepSerial: 0,
});

const freshMcpwmOperator = (): McpwmOperator => ({
  stmpCfg: 0,
  tstmpA: 0,
  tstmpB: 0,
  cfg0: 0,
  force: MCPWM_FORCE_RESET,
  genA: 0,
  genB: 0,
  cmpASerial: 0,
  cmpBSerial: 0,
});

const freshMcpwmGroup = (): McpwmGroup => ({
  clkCfg: 0,
  timers: Array.from({ length: MCPWM_TIMERS }, freshMcpwmTimer),
  operators: Array.from({ length: MCPWM_OPERATORS }, freshMcpwmOperator),
  operatorTimerSel: 0,
  intRaw: 0,
  intEna: 0,
  maps: freshInterruptMapPair(),
  clk: 0,
});

const freshTwaiController = (): TwaiController => ({
  mode: TWAI_MODE_RESET,
  busTiming0: 0,
  busTiming1: 0,
  arbLostCapture: 0,
  arbLostCaptureArmed: true,
  errCodeCapture: 0,
  errWarningLimit: TWAI_ERR_WARNING_LIMIT_RESET,
  rxErrCounter: 0,
  txErrCounter: 0,
  buffer: Array(TWAI_BUFFER_BYTES).fill(0) as number[],
  acceptance: [0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff],
  rxFifo: [],
  txLog: [],
  events: [],
  pendingTx: null,
  pendingTxSelfReceive: false,
  pendingTxSingleShot: false,
  txComplete: true,
  dataOverrun: false,
  busOff: false,
  interrupt: 0,
  interruptEna: 0,
  clockDivider: 0,
  maps: freshInterruptMapPair(),
});

/** One SYSTIMER comparator (COMP0/1/2). Each compares the counter selected by
 *  TARGET_UNIT_SEL against an alarm value, in one-shot or auto-reload mode, and
 *  drives its own interrupt-matrix source (57/58/59). */
interface SystimerComparator {
  targetHi: number; // staged alarm value (applied on COMPn_LOAD)
  targetLo: number;
  conf: number; // staged TARGETn_CONF (period/mode/unit-sel)
  active: number; // active comparator value
  loaded: boolean;
  periodMode: boolean; // auto-reload (period) vs one-shot (target)
  period: number; // PERIOD ticks for auto-reload
  unit1: boolean; // TARGET_UNIT_SEL: drive from UNIT1 instead of UNIT0
  maps: InterruptMapPair; // TARGETn -> CPU interrupt routing
}

interface SystimerController {
  conf: number;
  unit0Base: number; // counter value at unit0Sync
  unit0Sync: number; // cpu.cycles when unit0Base was captured
  unit0LoadHi: number;
  unit0LoadLo: number;
  unit0ValueHi: number; // latched by an UPDATE strobe
  unit0ValueLo: number;
  unit0ValueValid: boolean;
  unit1Base: number; // the second 52-bit counter (UNIT1)
  unit1Sync: number;
  unit1LoadHi: number;
  unit1LoadLo: number;
  unit1ValueHi: number;
  unit1ValueLo: number;
  unit1ValueValid: boolean;
  comps: SystimerComparator[]; // COMP0/1/2
  intRaw: number; // TARGET0/1/2 alarm latches (bits 0..2)
  intEna: number;
}

const freshSystimer = (): SystimerController => ({
  conf: 0,
  unit0Base: 0,
  unit0Sync: 0,
  unit0LoadHi: 0,
  unit0LoadLo: 0,
  unit0ValueHi: 0,
  unit0ValueLo: 0,
  unit0ValueValid: false,
  unit1Base: 0,
  unit1Sync: 0,
  unit1LoadHi: 0,
  unit1LoadLo: 0,
  unit1ValueHi: 0,
  unit1ValueLo: 0,
  unit1ValueValid: false,
  comps: [freshSystimerComparator(), freshSystimerComparator(), freshSystimerComparator()],
  intRaw: 0,
  intEna: 0,
});

const freshSystimerComparator = (): SystimerComparator => ({
  targetHi: 0,
  targetLo: 0,
  conf: 0,
  active: 0,
  loaded: false,
  periodMode: false,
  period: 0,
  unit1: false,
  maps: freshInterruptMapPair(),
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
  private pcntUnits: PcntUnit[] = Array.from({ length: PCNT_UNITS }, freshPcntUnit);
  private pcntCtrl = PCNT_CTRL_RESET;
  private shaMode = 0;
  private shaText: number[] = new Array(32).fill(0); // 32 words: 16 for SHA-256, 32 for SHA-512
  private shaH: number[] = new Array(16).fill(0); // 16 words: 8 for SHA-256, 16 for SHA-512
  private shaIntRaw = 0;
  private shaIntEna = 0;
  private shaIntMaps: InterruptMapPair = freshInterruptMapPair();
  private aesMode = 0;
  private aesKey: number[] = new Array(8).fill(0);
  private aesIn: number[] = new Array(4).fill(0);
  private aesOut: number[] = new Array(4).fill(0);
  private aesState = 0; // 0 idle / 2 done
  private pcntIntRaw = 0;
  private pcntIntEna = 0;
  private pcntIntMaps = freshInterruptMapPair();
  private i2c: I2cController[] = Array.from({ length: I2C_CONTROLLER_COUNT }, freshI2cController);
  private spi: SpiController[] = Array.from({ length: SPI_CONTROLLER_COUNT }, freshSpiController);
  private mcpwm: McpwmGroup[] = Array.from({ length: MCPWM_GROUPS }, freshMcpwmGroup);
  private twai: TwaiController = freshTwaiController();
  private systimer: SystimerController = freshSystimer();

  // UART0/1 interrupt state + the interrupt matrix maps.
  private uartIntEna = 0;
  private uartTxDone = false; // latched TX_DONE raw bit
  private uartRxThrhd = 96; // CONF1 RXFIFO_FULL_THRHD reset value
  private uartConf0 = UART_CONF0_RESET;
  private uartWakeup = false;
  private uartWakeActiveThreshold = UART_ACTIVE_THRESHOLD_RESET;
  private uartWakeEdgeCount = 0;
  private uart1RxQueue: number[] = [];
  private uart1IntEna = 0;
  private uart1TxDone = false;
  private uart1RxThrhd = 96;
  private uart1Conf0 = UART_CONF0_RESET;
  private uart1Wakeup = false;
  private uart1WakeActiveThreshold = UART_ACTIVE_THRESHOLD_RESET;
  private uart1WakeEdgeCount = 0;
  private uart2RxQueue: number[] = [];
  private uart2IntEna = 0;
  private uart2TxDone = false;
  private uart2RxThrhd = 96;
  private uart2Conf0 = UART_CONF0_RESET;
  private uart2WakeActiveThreshold = UART_ACTIVE_THRESHOLD_RESET;
  private gpioIntMaps = freshInterruptMapPair();
  private uartIntMaps = freshInterruptMapPair();
  private uart1IntMaps = freshInterruptMapPair();
  private uart2IntMaps = freshInterruptMapPair();

  // TIMG0/TIMG1 state (slices 8 + 13): per-group timers, MWDT, INT_*
  // regs and matrix maps. Counters are virtual — derived from elapsed
  // core-0 cycles, no per-cycle bookkeeping.
  private timg: TimgGroup[] = [freshTimgGroup(), freshTimgGroup()];
  // The RTC watchdog (slice 13) — config1 unused (no prescaler; it
  // counts RTC_SLOW_CLK directly).
  private rwdt: Watchdog = freshWatchdog(RWDT_CONFIG0_RESET, 0);
  private rwdtPauseStartCycle: number | null = null;

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
  private rtcDigPwc = 0; // RTC_CNTL_DIG_PWC_REG (DG_WRAP_PD_EN selects deep sleep)
  private rtcDeepSleep = false; // captured at sleep entry: wake resets instead of resuming
  private rtcWakeupState = RTC_WAKEUP_STATE_RESET;
  private rtcIntRaw = 0;
  private rtcIntEna = 0;
  private rtcSlpRejectConf = 0;
  private rtcClkConf = RTC_CLK_CONF_RESET;
  private rtcSlowClkConf = RTC_SLOW_CLK_CONF_RESET;
  private rtcRcSlowDiv = 1;
  private rtcTickBase = 0;
  private rtcTickBaseCycle = 0;
  private rtcSleepRejectSource = 0;
  private rtcSdioIdle = false;
  private rtcWifiWake = false;
  private rtcBtWake = false;
  private rtcExtWakeupConf = 0;
  private rtcIoExtWakeup0 = 0;
  private rtcExtWakeup1 = 0;
  private rtcExtWakeup1Status = 0;
  private rtcRejectCause = 0;
  private rtcWakeupCause = 0;
  private rtcCocpuCtrl = RTC_COCPU_CTRL_RESET;
  private rtcAnaConf = RTC_ANA_CONF_RESET;
  private clockGlitchDetected = false;
  private rtcBrownOut = RTC_BROWN_OUT_RESET;
  private brownoutDetected = false;
  private rtcPgCtrl = RTC_PG_CTRL_RESET;
  private powerGlitchDetected = false;
  private rtcFibSel = RTC_FIB_SEL_RESET;
  private rtcExtXtlConf = RTC_EXT_XTL_CONF_RESET;
  private rtcXtal32kConf = RTC_XTAL32K_CONF_RESET;
  private xtal32kDead = false;
  private rtcSwdConf = RTC_SWD_CONF_RESET;
  private rtcSwdWprotect = RTC_SWD_WKEY;
  private rtcUlpCpTimer = RTC_ULP_CP_TIMER_RESET;
  private rtcUlpCpCtrl = RTC_ULP_CP_CTRL_RESET;
  private rtcUlpCpTimer1 = RTC_ULP_CP_TIMER_1_RESET;
  private rtcUlpTimerStartTick: number | null = null;
  private cocpuTrap = false;
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
  private efuseIntMaps: InterruptMapPair = freshInterruptMapPair();
  private efuseDacConf = EFUSE_DAC_CONF_RESET;
  private efuseRdTimConf = EFUSE_RD_TIM_CONF_RESET;
  private efuseWrTimConf1 = EFUSE_WR_TIM_CONF1_RESET;
  private efuseWrTimConf2 = EFUSE_WR_TIM_CONF2_RESET;

  // SAR ADC1/ADC2 oneshot state.
  private meas1Ctrl2 = 0; // the control bits firmware wrote
  private meas2Ctrl2 = 0;
  private sarReader1Ctrl = SENS_SAR_READER1_CTRL_RESET;
  private sarReader2Ctrl = SENS_SAR_READER2_CTRL_RESET;
  private tsensCtrl = SENS_TSENS_CTRL_RESET;
  private tsensCtrl2 = SENS_TSENS_CTRL2_RESET;
  private rtcTouchCtrl1 = RTC_TOUCH_CTRL1_RESET;
  private rtcTouchCtrl2 = RTC_TOUCH_CTRL2_RESET;
  private rtcTouchScanCtrl = RTC_TOUCH_SCAN_CTRL_RESET;
  private rtcTouchSlpThres = RTC_TOUCH_SLP_THRES_RESET;
  private rtcTouchApproach = RTC_TOUCH_APPROACH_RESET;
  private rtcTouchFilterCtrl = RTC_TOUCH_FILTER_CTRL_RESET;
  private rtcTouchTimeoutCtrl = RTC_TOUCH_TIMEOUT_CTRL_RESET;
  private rtcTouchDac = 0;
  private rtcTouchDac1 = 0;
  private sensTouchConf = SENS_TOUCH_CONF_RESET;
  private touchThresholds = Array(SENS_TOUCH_THRES_COUNT).fill(0) as number[];
  private touchData = Array(TOUCH_CHANNEL_COUNT).fill(0) as number[];
  private touchDebounce = Array(TOUCH_CHANNEL_COUNT).fill(0) as number[];
  private touchMeasDone = false;
  private touchActiveMask = 0;
  private touchScanCurr = 0;
  private touchApproachCounts = [0, 0, 0];
  private touchSleepApproachCount = 0;
  private rtcTouchTimerStartTick: number | null = null;
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
  private twaiPeers = new Set<Esp32s3Core>();
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
      const type = ((this.pinCfg[gpio] ?? 0) >>> GPIO_PIN_INT_TYPE_SHIFT) & 7;
      if ((type === 1 && level === 1) || (type === 2 && level === 0) || type === 3) {
        this.gpioStatus[bank] = (this.gpioStatus[bank] ?? 0) | bit;
      }
    }
    this.updateRtcGpioWakeup();
    this.updateRtcExt0Wakeup();
    this.updateRtcExt1Wakeup();
    this.captureRmtRxInputs();
    this.capturePcntInputs();
    this.recomputeIrq();
  }

  uartWrite(byte: number): void {
    this.uartWriteTo(0, byte);
  }

  uartWriteTo(port: 0 | 1 | 2, byte: number): void {
    if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
      throw new Error(`uartWriteTo expects a byte 0..255 (got ${String(byte)})`);
    }
    if (port !== 2 && this.consumeUartSleepRxByte(port, byte)) {
      this.recomputeIrq();
      return;
    }
    if (port === 0) {
      this.uartWakeEdgeCount = 0;
      this.rxQueue.push(byte);
    } else if (port === 1) {
      this.uart1WakeEdgeCount = 0;
      this.uart1RxQueue.push(byte);
    } else {
      this.uart2RxQueue.push(byte);
    }
    this.recomputeIrq();
  }

  private consumeUartSleepRxByte(port: 0 | 1, byte: number): boolean {
    const source = port === 0 ? RTC_UART0_TRIG_EN : RTC_UART1_TRIG_EN;
    if ((this.rtcState0 & RTC_SLEEP_EN) === 0 || (this.rtcWakeupEnabledSources() & source) === 0) return false;

    const conf0 = port === 0 ? this.uartConf0 : this.uart1Conf0;
    const edges = this.uartPositiveEdges(byte, conf0);
    if (port === 0) {
      this.uartWakeEdgeCount += edges;
      if (this.uartWakeEdgeCount >= this.uartWakeActiveThreshold + UART_WAKEUP_EDGE_MIN) {
        this.uartWakeEdgeCount = 0;
        this.uartWakeup = true;
        this.latchRtcWakeupSource(source);
      }
    } else {
      this.uart1WakeEdgeCount += edges;
      if (this.uart1WakeEdgeCount >= this.uart1WakeActiveThreshold + UART_WAKEUP_EDGE_MIN) {
        this.uart1WakeEdgeCount = 0;
        this.uart1Wakeup = true;
        this.latchRtcWakeupSource(source);
      }
    }
    return true;
  }

  private uartPositiveEdges(byte: number, conf0: number): number {
    let prev = 1; // idle line before the start bit
    let edges = 0;
    const sample = (level: number): void => {
      if (prev === 0 && level === 1) edges++;
      prev = level;
    };
    const dataBits = 5 + ((conf0 >>> UART_BIT_NUM_SHIFT) & UART_BIT_NUM_MASK);
    sample(0); // start bit
    let ones = 0;
    for (let bit = 0; bit < dataBits; bit++) {
      const dataBit = (byte >>> bit) & 1;
      ones += dataBit;
      sample(dataBit);
    }
    if ((conf0 & UART_PARITY_EN) !== 0) {
      const oddParity = (conf0 & UART_PARITY) !== 0;
      const parityBit = oddParity ? 1 - (ones & 1) : ones & 1;
      sample(parityBit);
    }
    // One high sample covers all legal stop-bit modes; extra high stop
    // time cannot create another positive edge.
    sample(1);
    return edges;
  }

  private resetUartWakeEdgeCounts(): void {
    this.uartWakeEdgeCount = 0;
    this.uart1WakeEdgeCount = 0;
  }

  drainUart(): Uint8Array {
    const out = Uint8Array.from(this.txBuffer);
    this.txBuffer = [];
    return out;
  }

  drainI2cWrites(port: 0 | 1 = 0): Uint8Array {
    const ctrl = this.i2c[port];
    if (ctrl === undefined) throw new Error(`drainI2cWrites expects port 0 or 1 (got ${String(port)})`);
    const out = Uint8Array.from(ctrl.writeLog);
    ctrl.writeLog = [];
    return out;
  }

  drainSpiWrites(port: 2 | 3 = 2): Uint8Array {
    const ctrl = this.spi[port - 2];
    if (ctrl === undefined) throw new Error(`drainSpiWrites expects port 2 or 3 (got ${String(port)})`);
    const out = Uint8Array.from(ctrl.writeLog);
    ctrl.writeLog = [];
    return out;
  }

  injectTwaiFrame(frame: Esp32s3TwaiFrame): boolean {
    const raw = this.twaiFormatFrame(frame);
    const accepted = this.twaiPushRxFrame(raw, true);
    this.recomputeIrq();
    return accepted;
  }

  /**
   * Stage a frame as a simultaneous bus contender without resolving the bus yet.
   * A turn-based core cannot have two guests transmitting within the same bit
   * window, so contention is host-driven: arm one or more peers, then let another
   * node's TX request trigger arbitration. Arming a node that cannot transmit
   * (reset or listen-only) is a no-op and returns false.
   */
  armTwaiTransmit(frame: Esp32s3TwaiFrame): boolean {
    if ((this.twai.mode & TWAI_MODE_RESET) !== 0) return false;
    if ((this.twai.mode & TWAI_MODE_LISTEN_ONLY) !== 0) return false;
    this.twai.pendingTx = this.twaiFormatFrame(frame);
    this.twai.pendingTxSelfReceive = false;
    this.twai.pendingTxSingleShot = false;
    return true;
  }

  drainTwaiTx(): Esp32s3TwaiFrame[] {
    const out = this.twai.txLog.map((frame) => this.twaiFrameEvent(frame));
    this.twai.txLog = [];
    return out;
  }

  drainTwaiEvents(): Esp32s3TwaiEvent[] {
    const out = this.twai.events.map((event) => this.twaiCloneEvent(event));
    this.twai.events = [];
    return out;
  }

  connectTwaiPeer(peer: Esp32s3Core): void {
    if (peer === this) throw new Error('connectTwaiPeer requires a different ESP32-S3 core');
    this.twaiPeers.add(peer);
    peer.twaiPeers.add(this);
  }

  disconnectTwaiPeer(peer: Esp32s3Core): void {
    this.twaiPeers.delete(peer);
    peer.twaiPeers.delete(this);
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

  setPowerGlitchDetected(detected: boolean): void {
    this.powerGlitchDetected = detected;
    this.updatePowerGlitchDetector();
  }

  setClockGlitchDetected(detected: boolean): void {
    this.clockGlitchDetected = detected;
    this.updateClockGlitchDetector();
  }

  setRtcSleepRejectSource(sourceMask: number): void {
    this.rtcSleepRejectSource = sourceMask & RTC_SLEEP_REJECT_ENA_MASK;
  }

  setRtcSdioIdle(idle: boolean): void {
    this.rtcSdioIdle = idle;
    this.updateRtcSdioIdle();
  }

  setRtcWifiWake(active: boolean): void {
    this.rtcWifiWake = active;
    this.updateRtcWifiWake();
  }

  setRtcBtWake(active: boolean): void {
    this.rtcBtWake = active;
    this.updateRtcBtWake();
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

  private powerGlitchEfuseEnabled(): boolean {
    return ((this.efuseReadWord(EFUSE_RD_REPEAT_DATA_4) ?? 0) & EFUSE_POWERGLITCH_EN) !== 0;
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
      if ((this.sarReader1Ctrl & SENS_SAR1_INT_EN) !== 0) this.rtcIntRaw |= RTC_SARADC1_INT;
    } else {
      this.adc2Data = data;
      this.adc2Done = true;
      if ((this.sarReader2Ctrl & SENS_SAR2_INT_EN) !== 0) this.rtcIntRaw |= RTC_SARADC2_INT;
    }
    this.recomputeIrq();
  }

  private runTouchMeasurement(): void {
    const scanMask = ((this.rtcTouchScanCtrl & RTC_TOUCH_SCAN_PAD_MAP_MASK) >>> RTC_TOUCH_SCAN_PAD_MAP_SHIFT) & TOUCH_CHANNEL_MASK;
    const outMask = this.sensTouchConf & SENS_TOUCH_OUTEN_MASK;
    const enabled = scanMask & outMask;
    const channel = enabled === 0 ? 0 : 31 - Math.clz32(enabled & -enabled);
    this.touchScanCurr = channel & 0xf;
    this.touchMeasDone = true;
    this.touchData[channel] = SENS_TOUCH_DEFAULT_DATA;
    if (channel > 0) {
      this.touchDebounce[channel] = Math.min(SENS_TOUCH_DEBOUNCE_MASK, (this.touchDebounce[channel] ?? 0) + 1);
    }

    const threshold = channel > 0 ? (this.touchThresholds[channel - 1] ?? 0) : 0;
    const nextActive = threshold !== 0 && SENS_TOUCH_DEFAULT_DATA >= threshold ? 1 << channel : 0;
    if (nextActive !== 0) {
      this.touchActiveMask |= nextActive;
      this.rtcIntRaw |= RTC_TOUCH_ACTIVE_INT;
    } else if (this.touchActiveMask !== 0) {
      this.touchActiveMask = 0;
      this.rtcIntRaw |= RTC_TOUCH_INACTIVE_INT;
    }

    this.updateTouchApproachCounts(channel);
    this.rtcIntRaw |= RTC_TOUCH_DONE_INT | RTC_TOUCH_SCAN_DONE_INT;
    const timeoutCycles = this.rtcTouchTimeoutCtrl & RTC_TOUCH_TIMEOUT_NUM_MASK;
    if ((this.rtcTouchTimeoutCtrl & RTC_TOUCH_TIMEOUT_EN) !== 0 && timeoutCycles !== 0 && timeoutCycles <= SENS_TOUCH_DEFAULT_DATA) {
      this.rtcIntRaw |= RTC_TOUCH_TIMEOUT_INT;
    }
    this.latchRtcWakeupSource(RTC_TOUCH_TRIG_EN);
    this.recomputeIrq();
  }

  private touchSleepTimerPeriodTicks(): number {
    return Math.max(1, this.rtcTouchCtrl1 & RTC_TOUCH_SLEEP_CYCLES_MASK);
  }

  private armTouchSleepTimer(): void {
    this.rtcTouchTimerStartTick = this.rtcTicks();
  }

  private checkRtcTouchSleepTimer(): void {
    if ((this.rtcTouchCtrl2 & RTC_TOUCH_SLP_TIMER_EN) === 0) {
      this.rtcTouchTimerStartTick = null;
      return;
    }
    if (this.rtcTouchTimerStartTick === null) {
      this.rtcTouchTimerStartTick = this.rtcTicks();
      return;
    }
    const now = this.rtcTicks();
    const period = this.touchSleepTimerPeriodTicks();
    if (now - this.rtcTouchTimerStartTick < period) return;
    this.rtcTouchTimerStartTick = now;
    this.runTouchMeasurement();
  }

  private updateTouchApproachCounts(channel: number): void {
    const total = (this.rtcTouchApproach & RTC_TOUCH_APPROACH_MEAS_TIME_MASK) >>> RTC_TOUCH_APPROACH_MEAS_TIME_SHIFT;
    if (total === 0) return;
    const sleepPad = (this.rtcTouchSlpThres >>> RTC_TOUCH_SLP_PAD_SHIFT) & RTC_TOUCH_SLP_PAD_MASK;
    if ((this.rtcTouchSlpThres & RTC_TOUCH_SLP_APPROACH_EN) !== 0 && sleepPad === channel) {
      const next = Math.min(SENS_TOUCH_APPROACH_COUNT_MASK, this.touchSleepApproachCount + 1);
      this.touchSleepApproachCount = next;
      if (next >= total) {
        this.rtcIntRaw |= RTC_TOUCH_APPROACH_LOOP_DONE_INT;
      }
    }
    const pads = [
      (this.sensTouchConf >>> SENS_TOUCH_APPROACH_PAD0_SHIFT) & SENS_TOUCH_APPROACH_PAD_MASK,
      (this.sensTouchConf >>> SENS_TOUCH_APPROACH_PAD1_SHIFT) & SENS_TOUCH_APPROACH_PAD_MASK,
      (this.sensTouchConf >>> SENS_TOUCH_APPROACH_PAD2_SHIFT) & SENS_TOUCH_APPROACH_PAD_MASK,
    ];
    pads.forEach((pad, i) => {
      if (pad === SENS_TOUCH_APPROACH_DISABLED || pad !== channel) return;
      const next = Math.min(SENS_TOUCH_APPROACH_COUNT_MASK, (this.touchApproachCounts[i] ?? 0) + 1);
      this.touchApproachCounts[i] = next;
      if (next >= total) {
        this.rtcIntRaw |= RTC_TOUCH_APPROACH_LOOP_DONE_INT;
      }
    });
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
      const ownerErr = (dw0 & GDMA_DESC_OWNER_DMA) === 0 && (ch.conf1 & GDMA_OUT_CHECK_OWNER) !== 0;
      if (ownerErr || bytes < 4) {
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
      // OUT_AUTO_WRBACK (OUT_CONF0 bit 2, reset 0) gates the automatic descriptor
      // write-back that returns ownership to the CPU; without it the OWNER bit is
      // left untouched and firmware must recycle the descriptor itself.
      if ((ch.conf0 & GDMA_OUT_AUTO_WRBACK) !== 0) this.setSramU32(desc, dw0 & ~GDMA_DESC_OWNER_DMA);
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
    if ((dw0 & GDMA_DESC_OWNER_DMA) === 0 && (ch.conf1 & GDMA_IN_CHECK_OWNER) !== 0) {
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
      if ((dw0 & GDMA_DESC_OWNER_DMA) === 0 && (ch.conf1 & GDMA_IN_CHECK_OWNER) !== 0) {
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
    this.pcntUnits = Array.from({ length: PCNT_UNITS }, freshPcntUnit);
    this.pcntCtrl = PCNT_CTRL_RESET;
    this.shaMode = 0;
    this.shaText = new Array(32).fill(0);
    this.shaH = new Array(16).fill(0);
    this.shaIntRaw = 0;
    this.shaIntEna = 0;
    this.shaIntMaps = freshInterruptMapPair();
    this.aesMode = 0;
    this.aesKey = new Array(8).fill(0);
    this.aesIn = new Array(4).fill(0);
    this.aesOut = new Array(4).fill(0);
    this.aesState = 0;
    this.pcntIntRaw = 0;
    this.pcntIntEna = 0;
    this.pcntIntMaps = freshInterruptMapPair();
    this.i2c = Array.from({ length: I2C_CONTROLLER_COUNT }, freshI2cController);
    this.spi = Array.from({ length: SPI_CONTROLLER_COUNT }, freshSpiController);
    this.mcpwm = Array.from({ length: MCPWM_GROUPS }, freshMcpwmGroup);
    this.twai = freshTwaiController();
    this.systimer = freshSystimer();
    this.uartIntEna = 0;
    this.uartTxDone = false;
    this.uartRxThrhd = 96;
    this.uartConf0 = UART_CONF0_RESET;
    this.uartWakeup = false;
    this.uartWakeActiveThreshold = UART_ACTIVE_THRESHOLD_RESET;
    this.uartWakeEdgeCount = 0;
    this.uart1RxQueue = [];
    this.uart1IntEna = 0;
    this.uart1TxDone = false;
    this.uart1RxThrhd = 96;
    this.uart1Conf0 = UART_CONF0_RESET;
    this.uart1Wakeup = false;
    this.uart1WakeActiveThreshold = UART_ACTIVE_THRESHOLD_RESET;
    this.uart1WakeEdgeCount = 0;
    this.uart2RxQueue = [];
    this.uart2IntEna = 0;
    this.uart2TxDone = false;
    this.uart2RxThrhd = 96;
    this.uart2Conf0 = UART_CONF0_RESET;
    this.uart2WakeActiveThreshold = UART_ACTIVE_THRESHOLD_RESET;
    this.gpioIntMaps = freshInterruptMapPair();
    this.uartIntMaps = freshInterruptMapPair();
    this.uart1IntMaps = freshInterruptMapPair();
    this.uart2IntMaps = freshInterruptMapPair();
    this.timg = [freshTimgGroup(), freshTimgGroup()];
    this.rwdt = freshWatchdog(RWDT_CONFIG0_RESET, 0);
    this.rwdtPauseStartCycle = null;
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
    this.rtcDigPwc = 0;
    this.rtcDeepSleep = false;
    this.rtcWakeupState = RTC_WAKEUP_STATE_RESET;
    this.rtcIntRaw = 0;
    this.rtcIntEna = 0;
    this.rtcSlpRejectConf = 0;
    this.rtcClkConf = RTC_CLK_CONF_RESET;
    this.rtcSlowClkConf = RTC_SLOW_CLK_CONF_RESET;
    this.rtcRcSlowDiv = 1;
    this.rtcTickBase = 0;
    this.rtcTickBaseCycle = 0;
    this.rtcExtWakeupConf = 0;
    this.rtcIoExtWakeup0 = 0;
    this.rtcExtWakeup1 = 0;
    this.rtcExtWakeup1Status = 0;
    this.rtcRejectCause = 0;
    this.rtcWakeupCause = 0;
    this.rtcCocpuCtrl = RTC_COCPU_CTRL_RESET;
    this.rtcAnaConf = RTC_ANA_CONF_RESET;
    this.rtcBrownOut = RTC_BROWN_OUT_RESET;
    this.rtcPgCtrl = RTC_PG_CTRL_RESET;
    this.rtcFibSel = RTC_FIB_SEL_RESET;
    this.rtcExtXtlConf = RTC_EXT_XTL_CONF_RESET;
    this.rtcXtal32kConf = RTC_XTAL32K_CONF_RESET;
    this.rtcSwdConf = RTC_SWD_CONF_RESET;
    this.rtcSwdWprotect = RTC_SWD_WKEY;
    this.rtcUlpCpTimer = RTC_ULP_CP_TIMER_RESET;
    this.rtcUlpCpCtrl = RTC_ULP_CP_CTRL_RESET;
    this.rtcUlpCpTimer1 = RTC_ULP_CP_TIMER_1_RESET;
    this.rtcUlpTimerStartTick = null;
    this.cocpuTrap = false;
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
    this.efuseIntMaps = freshInterruptMapPair();
    this.efuseDacConf = EFUSE_DAC_CONF_RESET;
    this.efuseRdTimConf = EFUSE_RD_TIM_CONF_RESET;
    this.efuseWrTimConf1 = EFUSE_WR_TIM_CONF1_RESET;
    this.efuseWrTimConf2 = EFUSE_WR_TIM_CONF2_RESET;
    this.meas1Ctrl2 = 0;
    this.meas2Ctrl2 = 0;
    this.sarReader1Ctrl = SENS_SAR_READER1_CTRL_RESET;
    this.sarReader2Ctrl = SENS_SAR_READER2_CTRL_RESET;
    this.tsensCtrl = SENS_TSENS_CTRL_RESET;
    this.tsensCtrl2 = SENS_TSENS_CTRL2_RESET;
    this.rtcTouchCtrl1 = RTC_TOUCH_CTRL1_RESET;
    this.rtcTouchCtrl2 = RTC_TOUCH_CTRL2_RESET;
    this.rtcTouchScanCtrl = RTC_TOUCH_SCAN_CTRL_RESET;
    this.rtcTouchSlpThres = RTC_TOUCH_SLP_THRES_RESET;
    this.rtcTouchApproach = RTC_TOUCH_APPROACH_RESET;
    this.rtcTouchFilterCtrl = RTC_TOUCH_FILTER_CTRL_RESET;
    this.rtcTouchTimeoutCtrl = RTC_TOUCH_TIMEOUT_CTRL_RESET;
    this.rtcTouchDac = 0;
    this.rtcTouchDac1 = 0;
    this.sensTouchConf = SENS_TOUCH_CONF_RESET;
    this.touchThresholds = Array(SENS_TOUCH_THRES_COUNT).fill(0) as number[];
    this.touchData = Array(TOUCH_CHANNEL_COUNT).fill(0) as number[];
    this.touchDebounce = Array(TOUCH_CHANNEL_COUNT).fill(0) as number[];
    this.touchMeasDone = false;
    this.touchActiveMask = 0;
    this.touchScanCurr = 0;
    this.touchApproachCounts = [0, 0, 0];
    this.touchSleepApproachCount = 0;
    this.rtcTouchTimerStartTick = null;
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
    this.uart1RxQueue = [];
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

  /** Current SYSTIMER UNIT0 count: base plus 16 MHz ticks elapsed since the
   *  base was captured, but only while UNIT0_WORK_EN is set (otherwise frozen).
   *  Wrapped to the 52-bit counter width. */
  private systimerUnit0Value(): number {
    if ((this.systimer.conf & SYSTIMER_TIMER_UNIT0_WORK_EN) === 0) return this.systimer.unit0Base;
    const ticks = Math.floor((this.cpu.cycles - this.systimer.unit0Sync) / SYSTIMER_CYCLES_PER_TICK);
    return (this.systimer.unit0Base + ticks) % SYSTIMER_COUNT_MOD;
  }

  /** Freeze UNIT0 into base before any CONF change so old run-state time doesn't
   *  replay (mirrors timerResync). */
  private systimerUnit0Resync(): void {
    this.systimer.unit0Base = this.systimerUnit0Value();
    this.systimer.unit0Sync = this.cpu.cycles;
  }

  private systimerUnit1Value(): number {
    if ((this.systimer.conf & SYSTIMER_TIMER_UNIT1_WORK_EN) === 0) return this.systimer.unit1Base;
    const ticks = Math.floor((this.cpu.cycles - this.systimer.unit1Sync) / SYSTIMER_CYCLES_PER_TICK);
    return (this.systimer.unit1Base + ticks) % SYSTIMER_COUNT_MOD;
  }

  private systimerUnit1Resync(): void {
    this.systimer.unit1Base = this.systimerUnit1Value();
    this.systimer.unit1Sync = this.cpu.cycles;
  }

  private systimerRead(off: number): number {
    // Comparator register banks (COMP0/1/2): HI 0x1c+8n, LO 0x20+8n, CONF 0x34+4n.
    if (off === 0x1c || off === 0x24 || off === 0x2c) return (this.systimer.comps[(off - 0x1c) / 8]?.targetHi ?? 0) >>> 0;
    if (off === 0x20 || off === 0x28 || off === 0x30) return (this.systimer.comps[(off - 0x20) / 8]?.targetLo ?? 0) >>> 0;
    if (off === 0x34 || off === 0x38 || off === 0x3c) return (this.systimer.comps[(off - 0x34) / 4]?.conf ?? 0) >>> 0;
    switch (off) {
      case SYSTIMER_CONF:
        return this.systimer.conf >>> 0;
      case SYSTIMER_UNIT0_OP:
        return this.systimer.unit0ValueValid ? SYSTIMER_TIMER_UNIT0_VALUE_VALID : 0;
      case SYSTIMER_UNIT0_LOAD_HI:
        return this.systimer.unit0LoadHi >>> 0;
      case SYSTIMER_UNIT0_LOAD_LO:
        return this.systimer.unit0LoadLo >>> 0;
      case SYSTIMER_UNIT0_VALUE_HI:
        return this.systimer.unit0ValueHi >>> 0;
      case SYSTIMER_UNIT0_VALUE_LO:
        return this.systimer.unit0ValueLo >>> 0;
      case SYSTIMER_UNIT1_OP:
        return this.systimer.unit1ValueValid ? SYSTIMER_TIMER_UNIT0_VALUE_VALID : 0;
      case SYSTIMER_UNIT1_LOAD_HI:
        return this.systimer.unit1LoadHi >>> 0;
      case SYSTIMER_UNIT1_LOAD_LO:
        return this.systimer.unit1LoadLo >>> 0;
      case SYSTIMER_UNIT1_VALUE_HI:
        return this.systimer.unit1ValueHi >>> 0;
      case SYSTIMER_UNIT1_VALUE_LO:
        return this.systimer.unit1ValueLo >>> 0;
      case SYSTIMER_INT_ENA:
        return this.systimer.intEna >>> 0;
      case SYSTIMER_INT_RAW:
        return this.systimer.intRaw >>> 0;
      case SYSTIMER_INT_ST:
        return (this.systimer.intRaw & this.systimer.intEna) >>> 0;
      default:
        return 0;
    }
  }

  private systimerWrite(off: number, value: number): void {
    const v = value >>> 0;
    // Comparator banks: HI 0x1c+8n, LO 0x20+8n, CONF 0x34+4n, COMPn_LOAD 0x50+4n.
    if (off === 0x1c || off === 0x24 || off === 0x2c) {
      const c = this.systimer.comps[(off - 0x1c) / 8];
      if (c) c.targetHi = v & 0xfffff;
      return;
    }
    if (off === 0x20 || off === 0x28 || off === 0x30) {
      const c = this.systimer.comps[(off - 0x20) / 8];
      if (c) c.targetLo = v;
      return;
    }
    if (off === 0x34 || off === 0x38 || off === 0x3c) {
      const c = this.systimer.comps[(off - 0x34) / 4];
      if (c) c.conf = v;
      return;
    }
    if (off === 0x50 || off === 0x54 || off === 0x58) {
      this.systimerLoadComparator((off - 0x50) / 4);
      return;
    }
    switch (off) {
      case SYSTIMER_CONF:
        // Freeze both counters under the old run-state before applying the new one.
        this.systimerUnit0Resync();
        this.systimerUnit1Resync();
        this.systimer.conf = v;
        return;
      case SYSTIMER_UNIT0_OP:
        if ((v & SYSTIMER_TIMER_UNIT0_UPDATE) !== 0) {
          // Latch a coherent counter snapshot into VALUE_HI/LO and signal VALID.
          const count = this.systimerUnit0Value();
          this.systimer.unit0ValueLo = count % 0x100000000;
          this.systimer.unit0ValueHi = Math.floor(count / 0x100000000) & 0xfffff;
          this.systimer.unit0ValueValid = true;
        }
        return;
      case SYSTIMER_UNIT0_LOAD_HI:
        this.systimer.unit0LoadHi = v & 0xfffff;
        return;
      case SYSTIMER_UNIT0_LOAD_LO:
        this.systimer.unit0LoadLo = v;
        return;
      case SYSTIMER_UNIT0_LOAD:
        // Apply LOAD_HI/LO into the counter base.
        this.systimer.unit0Base = (this.systimer.unit0LoadHi * 0x100000000 + this.systimer.unit0LoadLo) % SYSTIMER_COUNT_MOD;
        this.systimer.unit0Sync = this.cpu.cycles;
        return;
      case SYSTIMER_UNIT1_OP:
        if ((v & SYSTIMER_TIMER_UNIT0_UPDATE) !== 0) {
          const count = this.systimerUnit1Value();
          this.systimer.unit1ValueLo = count % 0x100000000;
          this.systimer.unit1ValueHi = Math.floor(count / 0x100000000) & 0xfffff;
          this.systimer.unit1ValueValid = true;
        }
        return;
      case SYSTIMER_UNIT1_LOAD_HI:
        this.systimer.unit1LoadHi = v & 0xfffff;
        return;
      case SYSTIMER_UNIT1_LOAD_LO:
        this.systimer.unit1LoadLo = v;
        return;
      case SYSTIMER_UNIT1_LOAD:
        this.systimer.unit1Base = (this.systimer.unit1LoadHi * 0x100000000 + this.systimer.unit1LoadLo) % SYSTIMER_COUNT_MOD;
        this.systimer.unit1Sync = this.cpu.cycles;
        return;
      case SYSTIMER_INT_ENA:
        this.systimer.intEna = v & SYSTIMER_INT_MASK;
        this.recomputeIrq();
        return;
      case SYSTIMER_INT_CLR:
        this.systimer.intRaw &= ~(v & SYSTIMER_INT_MASK);
        this.recomputeIrq();
        return;
      default:
        return;
    }
  }

  /** Apply a comparator's staged TARGETn config on a COMPn_LOAD strobe. Period mode
   *  arms the first alarm one PERIOD ahead of its selected counter and auto-reloads;
   *  target mode uses the absolute TARGETn_HI/LO value. */
  private systimerLoadComparator(n: number): void {
    const c = this.systimer.comps[n];
    if (c === undefined) return;
    c.periodMode = (c.conf & SYSTIMER_TARGET0_PERIOD_MODE) !== 0;
    c.period = c.conf & SYSTIMER_TARGET0_PERIOD_MASK;
    c.unit1 = (c.conf & SYSTIMER_TARGET_UNIT_SEL) !== 0;
    c.active = c.periodMode
      ? (c.unit1 ? this.systimerUnit1Value() : this.systimerUnit0Value()) + c.period
      : c.targetHi * 0x100000000 + c.targetLo;
    c.loaded = true;
    this.systimerCheckAlarms();
  }

  /** Per-instruction comparator check (mirrors checkAlarm). Each enabled comparator
   *  latches its TARGETn interrupt once the counter it watches reaches the target;
   *  period mode auto-reloads, one-shot mode holds the level until the target is
   *  rewritten (as esp_timer's ISR does). */
  private systimerCheckAlarms(): void {
    let changed = false;
    for (let n = 0; n < this.systimer.comps.length; n++) {
      const c = this.systimer.comps[n];
      if (c === undefined || !c.loaded) continue;
      if ((this.systimer.conf & (SYSTIMER_TARGET0_WORK_EN << n)) === 0) continue;
      const value = c.unit1 ? this.systimerUnit1Value() : this.systimerUnit0Value();
      if (value < c.active) continue;
      const bit = SYSTIMER_TARGET0_INT << n;
      if ((this.systimer.intRaw & bit) === 0) changed = true;
      this.systimer.intRaw |= bit;
      if (c.periodMode && c.period > 0) {
        do {
          c.active += c.period;
        } while (value >= c.active);
      }
    }
    if (changed) this.recomputeIrq();
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
  private runWdtStages(w: Watchdog, ticks: number, fire: (stage: number) => void, timeoutForStage?: (stage: number) => number): void {
    let cum = 0;
    for (let s = 0; s < 4; s++) {
      cum += timeoutForStage ? timeoutForStage(s) : (w.timeouts[s] ?? 0);
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

  /** The RWDT: counts the selected RTC_SLOW_CLK source. 3-bit stage
   *  fields; action 4 (reset RTC) exists here. INT stages latch
   *  RTC_CNTL_WDT_INT and route through RTC_CORE when enabled. */
  private checkRwdt(): void {
    const w = this.rwdt;
    const paused = (w.config0 & RTC_WDT_PAUSE_IN_SLP) !== 0 && (this.rtcState0 & RTC_SLEEP_EN) !== 0;
    if (paused) {
      if (this.rwdtPauseStartCycle === null) this.rwdtPauseStartCycle = this.cpu.cycles;
      return;
    }
    if (this.rwdtPauseStartCycle !== null) {
      w.epoch += this.cpu.cycles - this.rwdtPauseStartCycle;
      this.rwdtPauseStartCycle = null;
    }
    const ticks = this.rwdtElapsedTicks();
    this.runWdtStages(
      w,
      ticks,
      (s) => {
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
      },
      (s) => this.rwdtTimeoutForStage(s),
    );
  }

  private rwdtTimeoutForStage(stage: number): number {
    const timeout = this.rwdt.timeouts[stage] ?? 0;
    if (stage !== 0) return timeout;
    const delaySel = ((this.efuseReadWord(EFUSE_RD_REPEAT_DATA_0) ?? 0) >>> EFUSE_WDT_DELAY_SEL_SHIFT) & EFUSE_WDT_DELAY_SEL_MASK;
    return timeout * (2 << delaySel);
  }

  private rtcTicks(): number {
    return (
      this.rtcTickBase +
      Math.floor(((this.cpu.cycles - this.rtcTickBaseCycle) * this.rtcSlowHz()) / CLOCK_HZ)
    );
  }

  private rtcSlowHz(): number {
    const source = (this.rtcClkConf >>> RTC_ANA_CLK_RTC_SEL_SHIFT) & RTC_ANA_CLK_RTC_SEL_MASK;
    switch (source) {
      case RTC_SLOW_SRC_XTAL32K:
        return RTC_XTAL32K_HZ;
      case RTC_SLOW_SRC_RC_FAST_D256:
        return RTC_RC_FAST_D256_HZ;
      case RTC_SLOW_SRC_RC_SLOW:
      default:
        return Math.floor(RTC_RC_SLOW_HZ / this.rtcRcSlowDiv);
    }
  }

  private updateRtcSlowDivider(): void {
    if ((this.rtcSlowClkConf & RTC_ANA_CLK_DIV_VLD) === 0) return;
    this.rtcRcSlowDiv = (((this.rtcSlowClkConf >>> RTC_ANA_CLK_DIV_SHIFT) & RTC_ANA_CLK_DIV_MASK) + 1) >>> 0;
    if (this.rtcRcSlowDiv === 0) this.rtcRcSlowDiv = 1;
  }

  private rwdtActiveEndCycle(): number {
    return this.rwdtPauseStartCycle ?? this.cpu.cycles;
  }

  private rwdtElapsedTicks(hz = this.rtcSlowHz()): number {
    return Math.floor(((this.rwdtActiveEndCycle() - this.rwdt.epoch) * hz) / CLOCK_HZ);
  }

  private setRwdtElapsedTicks(ticks: number, hz = this.rtcSlowHz()): void {
    const elapsedCycles = Math.floor((ticks * CLOCK_HZ) / hz);
    this.rwdt.epoch = this.rwdtActiveEndCycle() - elapsedCycles;
  }

  private rebaseRtcSlowClock(update: () => void): void {
    const ticks = this.rtcTicks();
    const rwdtTicks = this.rwdtElapsedTicks();
    update();
    this.rtcTickBase = ticks;
    this.rtcTickBaseCycle = this.cpu.cycles;
    this.setRwdtElapsedTicks(rwdtTicks);
  }

  private rtcSleepAlarmTarget(): number {
    return this.rtcSleepTimerHi * 0x100000000 + this.rtcSleepTimerLo;
  }

  private rtcLowPowerStatus(): number {
    let v = (this.rtcState0 & RTC_SLEEP_EN) !== 0 ? RTC_MAIN_STATE_IN_SLP | RTC_RDY_FOR_WAKEUP : RTC_MAIN_STATE_IN_IDLE;
    if ((this.rtcCocpuCtrl & (RTC_COCPU_DONE | RTC_COCPU_SHUT_RESET_EN)) === (RTC_COCPU_DONE | RTC_COCPU_SHUT_RESET_EN)) {
      v |= RTC_COCPU_STATE_DONE | RTC_COCPU_STATE_SLP;
    }
    return v >>> 0;
  }

  private rtcWakeupEnabledSources(): number {
    return (this.rtcWakeupState >>> RTC_WAKEUP_ENA_SHIFT) & RTC_WAKEUP_ENA_MASK;
  }

  private rtcGpioWakeupPending(): boolean {
    for (let gpio = 0; gpio < PIN_COUNT; gpio++) {
      const cfg = this.pinCfg[gpio] ?? 0;
      if ((cfg & GPIO_PIN_WAKEUP_ENABLE_BIT) === 0) continue;
      const type = (cfg >>> GPIO_PIN_INT_TYPE_SHIFT) & 7;
      if (type !== GPIO_INT_LOW_LEVEL && type !== GPIO_INT_HIGH_LEVEL) continue;
      const bank = gpio >> 5;
      const bit = 1 << (gpio & 31);
      const high = ((this.inLevels[bank] ?? 0) & bit) !== 0;
      if (type === GPIO_INT_LOW_LEVEL ? !high : high) return true;
    }
    return false;
  }

  private updateRtcGpioWakeup(): void {
    if (this.rtcGpioWakeupPending()) this.latchRtcWakeupSource(RTC_GPIO_TRIG_EN);
  }

  private rtcExt0WakeupPending(): boolean {
    const gpio = (this.rtcIoExtWakeup0 >>> RTC_IO_EXT_WAKEUP0_SEL_SHIFT) & 0x1f;
    if (gpio >= 22) return false;
    const bit = 1 << (gpio & 31);
    const high = ((this.inLevels[gpio >> 5] ?? 0) & bit) !== 0;
    const highWake = (this.rtcExtWakeupConf & RTC_EXT_WAKEUP0_LV) !== 0;
    return highWake ? high : !high;
  }

  private updateRtcExt0Wakeup(): void {
    if (this.rtcExt0WakeupPending()) this.latchRtcWakeupSource(RTC_EXT0_TRIG_EN);
  }

  private rtcExt1WakeupPending(): number {
    const selected = this.rtcExtWakeup1 & RTC_EXT_WAKEUP1_SEL_MASK;
    if (selected === 0) return 0;
    const highWake = (this.rtcExtWakeupConf & RTC_EXT_WAKEUP1_LV) !== 0;
    let pending = 0;
    for (let gpio = 0; gpio < 22; gpio++) {
      const rtcBit = 1 << gpio;
      if ((selected & rtcBit) === 0) continue;
      const bank = gpio >> 5;
      const gpioBit = 1 << (gpio & 31);
      const high = ((this.inLevels[bank] ?? 0) & gpioBit) !== 0;
      if (highWake ? high : !high) pending |= rtcBit;
    }
    return pending >>> 0;
  }

  private updateRtcExt1Wakeup(): void {
    const pending = this.rtcExt1WakeupPending();
    if (
      pending !== 0 &&
      (this.rtcState0 & RTC_SLEEP_EN) !== 0 &&
      (this.rtcWakeupEnabledSources() & RTC_EXT1_TRIG_EN) !== 0
    ) {
      this.rtcExtWakeup1Status |= pending;
      this.latchRtcWakeupSource(RTC_EXT1_TRIG_EN);
    }
  }

  private latchRtcWakeupSource(source: number): void {
    if ((this.rtcState0 & RTC_SLEEP_EN) === 0 || (this.rtcWakeupEnabledSources() & source) === 0) return;
    this.rtcState0 = (this.rtcState0 & ~RTC_SLEEP_EN) | RTC_SLP_WAKEUP;
    this.rtcWakeupCause |= source;
    if (this.rtcDeepSleep) {
      // Deep sleep powered the digital core down; any wake source boots the chip
      // fresh from the reset vector with DEEPSLEEP_RESET as the recorded cause,
      // rather than resuming WAITI the way light sleep does.
      this.rtcDeepSleep = false;
      this.resetCause = RESET_CAUSE_DEEPSLEEP;
      this.appResetCause = RESET_CAUSE_DEEPSLEEP;
      this.pendingReset = true;
      return;
    }
    this.resetUartWakeEdgeCounts();
    this.rtcIntRaw |= RTC_SLP_WAKEUP_INT;
  }

  private rejectRtcSleepIfNeeded(): boolean {
    if ((this.rtcSlpRejectConf & RTC_LIGHT_SLP_REJECT_EN) === 0) return false;
    const enabled = (this.rtcSlpRejectConf >>> RTC_SLEEP_REJECT_ENA_SHIFT) & RTC_SLEEP_REJECT_ENA_MASK;
    const rejected = enabled & this.rtcSleepRejectSource;
    if (rejected === 0) return false;
    this.rtcState0 = (this.rtcState0 & ~RTC_SLEEP_EN) | RTC_SLP_REJECT;
    this.rtcRejectCause = rejected >>> 0;
    this.rtcIntRaw |= RTC_SLP_REJECT_INT;
    this.recomputeIrq();
    return true;
  }

  private checkRtcSleepTimer(): void {
    if (!this.rtcMainTimerAlarmArmed) return;
    if (this.rtcTicks() < this.rtcSleepAlarmTarget()) return;
    this.rtcMainTimerAlarmArmed = false;
    this.rtcIntRaw |= RTC_MAIN_TIMER_INT;
    this.latchRtcWakeupSource(RTC_TIMER_TRIG_EN);
    this.recomputeIrq();
  }

  private updateRtcSdioIdle(): void {
    if (!this.rtcSdioIdle) {
      this.recomputeIrq();
      return;
    }
    this.rtcIntRaw |= RTC_SDIO_IDLE_INT;
    this.latchRtcWakeupSource(RTC_SDIO_TRIG_EN);
    this.recomputeIrq();
  }

  private updateRtcWifiWake(): void {
    if (!this.rtcWifiWake) {
      this.recomputeIrq();
      return;
    }
    this.latchRtcWakeupSource(RTC_WIFI_TRIG_EN);
    this.recomputeIrq();
  }

  private updateRtcBtWake(): void {
    if (!this.rtcBtWake) {
      this.recomputeIrq();
      return;
    }
    this.latchRtcWakeupSource(RTC_BT_TRIG_EN);
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
    const digitalReset = (this.rtcBrownOut & RTC_BROWN_OUT_RST_ENA) !== 0;
    const analogReset =
      (this.rtcBrownOut & RTC_BROWN_OUT_ANA_RST_EN) !== 0 && (this.rtcFibSel & RTC_FIB_BOD_RST) === 0;
    if (digitalReset || analogReset) {
      this.resetCause = RESET_CAUSE_BROWNOUT;
      this.appResetCause = RESET_CAUSE_BROWNOUT;
      this.pendingReset = true;
    }
    this.recomputeIrq();
  }

  private updatePowerGlitchDetector(): void {
    const enabled =
      (this.rtcPgCtrl & RTC_POWER_GLITCH_EFUSE_SEL) !== 0
        ? this.powerGlitchEfuseEnabled()
        : (this.rtcPgCtrl & RTC_POWER_GLITCH_EN) !== 0;
    if (!this.powerGlitchDetected || !enabled) {
      this.recomputeIrq();
      return;
    }
    this.rtcIntRaw |= RTC_GLITCH_DET_INT;
    if ((this.rtcFibSel & RTC_FIB_GLITCH_RST) === 0) {
      this.resetCause = RESET_CAUSE_POWER_GLITCH;
      this.appResetCause = RESET_CAUSE_POWER_GLITCH;
      this.pendingReset = true;
    }
    this.recomputeIrq();
  }

  private updateClockGlitchDetector(): void {
    const enabled = this.clockGlitchDetected && (this.rtcAnaConf & RTC_GLITCH_RST_EN) !== 0;
    if (!enabled) {
      this.recomputeIrq();
      return;
    }
    this.rtcIntRaw |= RTC_GLITCH_DET_INT;
    const softwareResetEnabled = (this.rtcFibSel & RTC_FIB_GLITCH_RST) === 0;
    if (softwareResetEnabled) {
      this.resetCause = RESET_CAUSE_GLITCH_RTC;
      this.appResetCause = RESET_CAUSE_GLITCH_RTC;
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

  private triggerUlpWake(): void {
    this.rtcIntRaw |= RTC_ULP_CP_INT;
    this.latchRtcWakeupSource(RTC_ULP_TRIG_EN);
    this.recomputeIrq();
  }

  private ulpTimerPeriodTicks(): number {
    const field = (this.rtcUlpCpTimer1 >>> RTC_ULP_CP_TIMER_SLP_CYCLE_SHIFT) & RTC_ULP_CP_TIMER_SLP_CYCLE_MASK;
    return Math.max(1, field);
  }

  private armUlpTimer(): void {
    this.rtcUlpTimerStartTick = this.rtcTicks();
    this.checkRtcUlpTimer();
  }

  private checkRtcUlpTimer(): void {
    if ((this.rtcUlpCpTimer & RTC_ULP_CP_SLP_TIMER_EN) === 0) {
      this.rtcUlpTimerStartTick = null;
      return;
    }
    if (this.rtcUlpTimerStartTick === null) {
      this.rtcUlpTimerStartTick = this.rtcTicks();
      return;
    }
    const now = this.rtcTicks();
    const period = this.ulpTimerPeriodTicks();
    if (now - this.rtcUlpTimerStartTick < period) return;
    this.rtcUlpTimerStartTick = now;
    this.triggerUlpWake();
  }

  private triggerCocpuTrap(): void {
    this.cocpuTrap = true;
    this.rtcIntRaw |= RTC_COCPU_TRAP_INT;
    this.latchRtcWakeupSource(RTC_COCPU_TRAP_TRIG_EN);
    this.recomputeIrq();
  }

  private triggerSuperWatchdogTrip(): void {
    if ((this.rtcSwdConf & RTC_SWD_DISABLE) !== 0) {
      this.recomputeIrq();
      return;
    }
    this.rtcSwdConf |= RTC_SWD_FEED_INT | RTC_SWD_RESET_FLAG;
    this.rtcIntRaw |= RTC_SWD_INT;
    if ((this.rtcSwdConf & RTC_SWD_BYPASS_RST) === 0 && (this.rtcFibSel & RTC_FIB_SUPER_WDT_RST) === 0) {
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
    this.checkRtcUlpTimer();
    this.checkRtcTouchSleepTimer();
    this.checkMcpwm();
    this.checkLedcTimers();
    this.checkRmt();
    this.systimerCheckAlarms();
  }

  /** UART0's raw interrupt bits: RXFIFO_FULL tracks the live FIFO
   *  state against the CONF1 threshold (level-style — it re-asserts
   *  while data remains); TX_DONE latches per transmitted byte and
   *  clears via INT_CLR; WAKEUP latches after the sleep edge threshold. */
  private uartIntRaw(): number {
    let raw = this.uartTxDone ? UART_TX_DONE_INT : 0;
    if (this.uartWakeup) raw |= UART_WAKEUP_INT;
    if (this.rxQueue.length > this.uartRxThrhd) raw |= UART_RXFIFO_FULL_INT;
    return raw;
  }

  private uart1IntRaw(): number {
    let raw = this.uart1TxDone ? UART_TX_DONE_INT : 0;
    if (this.uart1Wakeup) raw |= UART_WAKEUP_INT;
    if (this.uart1RxQueue.length > this.uart1RxThrhd) raw |= UART_RXFIFO_FULL_INT;
    return raw;
  }

  private uart2IntRaw(): number {
    let raw = this.uart2TxDone ? UART_TX_DONE_INT : 0;
    if (this.uart2RxQueue.length > this.uart2RxThrhd) raw |= UART_RXFIFO_FULL_INT;
    return raw;
  }

  private i2cForAddress(addr: number): { port: 0 | 1; ctrl: I2cController; off: number } | null {
    const bases = [I2C0_BASE, I2C1_BASE] as const;
    for (const port of [0, 1] as const) {
      const base = bases[port];
      if (addr >= base && addr < base + I2C_BLOCK_BYTES) {
        const ctrl = this.i2c[port];
        if (ctrl === undefined) throw new Error(`missing I2C${String(port)} controller`);
        return { port, ctrl, off: addr - base };
      }
    }
    return null;
  }

  private i2cUpdateWatermarks(ctrl: I2cController): void {
    ctrl.intRaw &= ~(I2C_RXFIFO_WM_INT | I2C_TXFIFO_WM_INT);
    const fifoConf = ctrl.regs.get(I2C_FIFO_CONF) ?? I2C_FIFO_CONF_RESET;
    if ((fifoConf & I2C_FIFO_PRT_EN) === 0) return;
    const rxThreshold = fifoConf & 0x1f;
    const txThreshold = (fifoConf >>> 5) & 0x1f;
    if (ctrl.rxFifo.length > rxThreshold) ctrl.intRaw |= I2C_RXFIFO_WM_INT;
    if (ctrl.txFifo.length < txThreshold) ctrl.intRaw |= I2C_TXFIFO_WM_INT;
  }

  private i2cRead(ctrl: I2cController, off: number): number {
    if (off === I2C_DATA) {
      const byte = ctrl.rxFifo.shift();
      if (byte === undefined) {
        ctrl.intRaw |= I2C_RXFIFO_UDF_INT;
        this.recomputeIrq();
        return 0;
      }
      ctrl.rxMem.copyWithin(0, 1);
      ctrl.rxMem[I2C_FIFO_LEN - 1] = 0;
      this.i2cUpdateWatermarks(ctrl);
      this.recomputeIrq();
      return byte & 0xff;
    }
    if (off === I2C_SR) {
      const rx = Math.min(ctrl.rxFifo.length, I2C_FIFO_CNT_MASK);
      const tx = Math.min(ctrl.txFifo.length, I2C_FIFO_CNT_MASK);
      return ((ctrl.lastAck & 1) | (rx << I2C_RXFIFO_CNT_SHIFT) | (tx << I2C_TXFIFO_CNT_SHIFT)) >>> 0;
    }
    if (off === I2C_FIFO_ST) {
      const rx = Math.min(ctrl.rxFifo.length, 0x1f);
      const tx = Math.min(ctrl.txFifo.length, 0x1f);
      return ((rx << 5) | (tx << 15)) >>> 0;
    }
    if (off === I2C_INT_RAW) return ctrl.intRaw >>> 0;
    if (off === I2C_INT_ST) return (ctrl.intRaw & ctrl.intEna) >>> 0;
    if (off === I2C_INT_ENA) return ctrl.intEna >>> 0;
    if (off >= I2C_COMD0 && off < I2C_COMD_END && (off & 3) === 0) {
      return ctrl.commands[(off - I2C_COMD0) >> 2] ?? 0;
    }
    if (off === I2C_DATE) return I2C_DATE_RESET;
    if (off >= I2C_TXFIFO_START_ADDR && off < I2C_TXFIFO_START_ADDR + I2C_FIFO_LEN * 4 && (off & 3) === 0) {
      return ctrl.txMem[(off - I2C_TXFIFO_START_ADDR) >> 2] ?? 0;
    }
    if (off >= I2C_RXFIFO_START_ADDR && off < I2C_RXFIFO_START_ADDR + I2C_FIFO_LEN * 4 && (off & 3) === 0) {
      return ctrl.rxMem[(off - I2C_RXFIFO_START_ADDR) >> 2] ?? 0;
    }
    return ctrl.regs.get(off) ?? 0;
  }

  private i2cWrite(ctrl: I2cController, off: number, value: number): void {
    const v = value >>> 0;
    if (off === I2C_DATA) {
      if (ctrl.txFifo.length >= I2C_FIFO_LEN) ctrl.intRaw |= I2C_TXFIFO_OVF_INT;
      else {
        ctrl.txFifo.push(v & 0xff);
        ctrl.txMem[ctrl.txFifo.length - 1] = v & 0xff;
      }
      this.i2cUpdateWatermarks(ctrl);
      this.recomputeIrq();
      return;
    }
    if (off === I2C_INT_ENA) {
      ctrl.intEna = v & I2C_INT_CLEARABLE;
      this.recomputeIrq();
      return;
    }
    if (off === I2C_INT_CLR) {
      ctrl.intRaw &= ~(v & I2C_INT_CLEARABLE);
      this.i2cUpdateWatermarks(ctrl);
      this.recomputeIrq();
      return;
    }
    if (off === I2C_FIFO_CONF) {
      ctrl.regs.set(I2C_FIFO_CONF, v & ~(I2C_RX_FIFO_RST | I2C_TX_FIFO_RST));
      if ((v & I2C_RX_FIFO_RST) !== 0) {
        ctrl.rxFifo = [];
        ctrl.rxMem.fill(0);
      }
      if ((v & I2C_TX_FIFO_RST) !== 0) {
        ctrl.txFifo = [];
        ctrl.txMem.fill(0);
      }
      this.i2cUpdateWatermarks(ctrl);
      this.recomputeIrq();
      return;
    }
    if (off === I2C_CTR) {
      ctrl.regs.set(I2C_CTR, v & ~I2C_TRANS_START);
      if ((v & I2C_TRANS_START) !== 0) this.i2cRunTransaction(ctrl);
      this.recomputeIrq();
      return;
    }
    if (off >= I2C_COMD0 && off < I2C_COMD_END && (off & 3) === 0) {
      ctrl.commands[(off - I2C_COMD0) >> 2] = v & I2C_COMMAND_MASK;
      return;
    }
    if (off >= I2C_TXFIFO_START_ADDR && off < I2C_TXFIFO_START_ADDR + I2C_FIFO_LEN * 4 && (off & 3) === 0) {
      const idx = (off - I2C_TXFIFO_START_ADDR) >> 2;
      ctrl.txMem[idx] = v & 0xff;
      if (idx >= ctrl.txFifo.length) ctrl.txFifo.length = idx + 1;
      ctrl.txFifo[idx] = v & 0xff;
      this.i2cUpdateWatermarks(ctrl);
      return;
    }
    if (off >= I2C_RXFIFO_START_ADDR && off < I2C_RXFIFO_START_ADDR + I2C_FIFO_LEN * 4 && (off & 3) === 0) {
      ctrl.rxMem[(off - I2C_RXFIFO_START_ADDR) >> 2] = v & 0xff;
      return;
    }
    ctrl.regs.set(off, v);
  }

  private i2cRunTransaction(ctrl: I2cController): void {
    let txMemCursor = 0;
    let sawStop = false;
    let stopped = false;
    ctrl.lastAck = 0;
    for (let i = 0; i < I2C_CMD_COUNT && !stopped; i++) {
      const command = ctrl.commands[i] ?? 0;
      const payload = command & I2C_COMMAND_MASK;
      const op = (payload >>> I2C_CMD_OP_SHIFT) & I2C_CMD_OP_MASK;
      if (payload === 0) break;
      switch (op) {
        case I2C_LL_CMD_RESTART:
          break;
        case I2C_LL_CMD_WRITE: {
          const count = payload & I2C_CMD_BYTE_NUM_MASK;
          for (let n = 0; n < count; n++) {
            const byte = ctrl.txFifo.shift() ?? ctrl.txMem[txMemCursor] ?? 0;
            txMemCursor++;
            ctrl.writeLog.push(byte & 0xff);
          }
          const ackExpected = (payload & I2C_CMD_ACK_EXP) !== 0 ? 1 : 0;
          if ((payload & I2C_CMD_ACK_EN) !== 0 && ackExpected !== ctrl.lastAck) {
            ctrl.intRaw |= I2C_NACK_INT;
            stopped = true;
          }
          break;
        }
        case I2C_LL_CMD_READ: {
          const count = payload & I2C_CMD_BYTE_NUM_MASK;
          for (let n = 0; n < count; n++) {
            if (ctrl.rxFifo.length >= I2C_FIFO_LEN) {
              ctrl.intRaw |= I2C_RXFIFO_OVF_INT;
              break;
            }
            ctrl.rxFifo.push(0);
            ctrl.rxMem[ctrl.rxFifo.length - 1] = 0;
          }
          break;
        }
        case I2C_LL_CMD_STOP:
          sawStop = true;
          break;
        case I2C_LL_CMD_END:
          stopped = true;
          break;
        default:
          stopped = true;
          break;
      }
      ctrl.commands[i] = (payload | I2C_COMMAND_DONE) >>> 0;
    }
    if (sawStop) ctrl.intRaw |= I2C_END_DETECT_INT;
    if ((ctrl.intRaw & I2C_NACK_INT) === 0) ctrl.intRaw |= I2C_TRANS_COMPLETE_INT;
    ctrl.txFifo = [];
    ctrl.txMem.fill(0);
    this.i2cUpdateWatermarks(ctrl);
  }

  private spiForAddress(addr: number): { port: 2 | 3; ctrl: SpiController; off: number } | null {
    const bases = [SPI2_BASE, SPI3_BASE] as const;
    for (const idx of [0, 1] as const) {
      const base = bases[idx];
      if (addr >= base && addr < base + SPI_BLOCK_BYTES) {
        const ctrl = this.spi[idx];
        if (ctrl === undefined) throw new Error(`missing GPSPI${String(idx + 2)} controller`);
        return { port: (idx + 2) as 2 | 3, ctrl, off: addr - base };
      }
    }
    return null;
  }

  private spiBufferByte(ctrl: SpiController, byteIndex: number): number {
    const word = ctrl.words[byteIndex >> 2] ?? 0;
    return (word >>> ((byteIndex & 3) * 8)) & 0xff;
  }

  private spiSetBufferByte(ctrl: SpiController, byteIndex: number, byte: number): void {
    const wordIndex = byteIndex >> 2;
    const shift = (byteIndex & 3) * 8;
    const cur = ctrl.words[wordIndex] ?? 0;
    ctrl.words[wordIndex] = ((cur & ~(0xff << shift)) | ((byte & 0xff) << shift)) >>> 0;
  }

  private spiAppendMsbField(out: number[], value: number, bitLength: number): void {
    const bytes = Math.ceil(Math.max(1, bitLength) / 8);
    for (let i = bytes - 1; i >= 0; i--) out.push((value >>> (i * 8)) & 0xff);
  }

  private spiRunTransaction(ctrl: SpiController): void {
    const user = ctrl.regs.get(SPI_USER) ?? SPI_USER_RESET;
    const user1 = ctrl.regs.get(SPI_USER1) ?? SPI_USER1_RESET;
    const user2 = ctrl.regs.get(SPI_USER2) ?? SPI_USER2_RESET;
    const dataBits = ((ctrl.regs.get(SPI_MS_DLEN) ?? 0) & SPI_MS_DATA_BITLEN_MASK) + 1;
    const dataBytes = Math.ceil(dataBits / 8);
    if ((user & SPI_USR_COMMAND) !== 0) {
      const bits = ((user2 >>> SPI_USR_COMMAND_BITLEN_SHIFT) & SPI_COMMAND_BITLEN_MASK) + 1;
      this.spiAppendMsbField(ctrl.writeLog, user2 & 0xffff, bits);
    }
    if ((user & SPI_USR_ADDR) !== 0) {
      const bits = ((user1 >>> SPI_USR_ADDR_BITLEN_SHIFT) & SPI_PHASE_BITLEN_MASK) + 1;
      this.spiAppendMsbField(ctrl.writeLog, ctrl.regs.get(SPI_ADDR) ?? 0, bits);
    }
    if ((user & SPI_USR_MOSI) !== 0) {
      const startByte = (user & SPI_USR_MOSI_HIGHPART) !== 0 ? 8 * 4 : 0;
      const available = SPI_WORD_COUNT * 4 - startByte;
      for (let i = 0; i < Math.min(dataBytes, available); i++) ctrl.writeLog.push(this.spiBufferByte(ctrl, startByte + i));
    }
    if ((user & SPI_USR_MISO) !== 0) {
      const startByte = (user & SPI_USR_MISO_HIGHPART) !== 0 ? 8 * 4 : 0;
      const available = SPI_WORD_COUNT * 4 - startByte;
      for (let i = 0; i < Math.min(dataBytes, available); i++) this.spiSetBufferByte(ctrl, startByte + i, 0);
    }
    ctrl.intRaw |= SPI_TRANS_DONE_INT;
  }

  private spiRead(ctrl: SpiController, off: number): number {
    if (off >= SPI_W0 && off < SPI_W0 + SPI_WORD_COUNT * 4 && (off & 3) === 0) {
      return ctrl.words[(off - SPI_W0) >> 2] ?? 0;
    }
    if (off === SPI_DMA_INT_RAW) return ctrl.intRaw >>> 0;
    if (off === SPI_DMA_INT_ST) return (ctrl.intRaw & ctrl.intEna) >>> 0;
    if (off === SPI_DMA_INT_ENA) return ctrl.intEna >>> 0;
    if (off === SPI_DMA_INT_CLR || off === SPI_DMA_INT_SET) return 0;
    if (off === SPI_DATE) return SPI_DATE_RESET;
    return ctrl.regs.get(off) ?? 0;
  }

  private spiWrite(ctrl: SpiController, off: number, value: number): void {
    const v = value >>> 0;
    if (off >= SPI_W0 && off < SPI_W0 + SPI_WORD_COUNT * 4 && (off & 3) === 0) {
      ctrl.words[(off - SPI_W0) >> 2] = v;
      return;
    }
    if (off === SPI_DMA_INT_ENA) {
      ctrl.intEna = v & SPI_INT_CLEARABLE;
      this.recomputeIrq();
      return;
    }
    if (off === SPI_DMA_INT_CLR) {
      ctrl.intRaw &= ~(v & SPI_INT_CLEARABLE);
      this.recomputeIrq();
      return;
    }
    if (off === SPI_DMA_INT_SET) {
      ctrl.intRaw |= v & SPI_INT_CLEARABLE;
      this.recomputeIrq();
      return;
    }
    if (off === SPI_DMA_CONF) {
      ctrl.regs.set(SPI_DMA_CONF, v & ~SPI_DMA_CONF_WT_MASK);
      return;
    }
    if (off === SPI_CMD) {
      ctrl.regs.set(SPI_CMD, v & ~(SPI_CMD_UPDATE | SPI_CMD_USR));
      if ((v & SPI_CMD_USR) !== 0) {
        this.spiRunTransaction(ctrl);
        this.recomputeIrq();
      }
      return;
    }
    if (off === SPI_DATE) return;
    ctrl.regs.set(off, v);
  }

  private mcpwmForAddress(addr: number): { groupIndex: 0 | 1; group: McpwmGroup; off: number } | null {
    const bases = [MCPWM0_BASE, MCPWM1_BASE] as const;
    for (const groupIndex of [0, 1] as const) {
      const base = bases[groupIndex];
      if (addr >= base && addr < base + MCPWM_BLOCK_BYTES) {
        const group = this.mcpwm[groupIndex];
        if (group === undefined) throw new Error(`missing MCPWM${String(groupIndex)} group`);
        return { groupIndex, group, off: addr - base };
      }
    }
    return null;
  }

  private mcpwmTimerForOffset(group: McpwmGroup, off: number): { index: number; timer: McpwmTimer; toff: number } | null {
    if (off < MCPWM_TIMER0_CFG0 || off >= MCPWM_TIMER0_CFG0 + MCPWM_TIMERS * MCPWM_TIMER_CFG_STRIDE) return null;
    const rel = off - MCPWM_TIMER0_CFG0;
    if ((rel & 3) !== 0) return null;
    const index = Math.floor(rel / MCPWM_TIMER_CFG_STRIDE);
    const timer = group.timers[index];
    if (timer === undefined) return null;
    return { index, timer, toff: rel % MCPWM_TIMER_CFG_STRIDE };
  }

  private mcpwmOperatorForOffset(group: McpwmGroup, off: number): { index: number; op: McpwmOperator; toff: number } | null {
    if (off < MCPWM_OPERATOR0_BASE || off >= MCPWM_OPERATOR0_BASE + MCPWM_OPERATORS * MCPWM_OPERATOR_STRIDE) return null;
    const rel = off - MCPWM_OPERATOR0_BASE;
    if ((rel & 3) !== 0) return null;
    const index = Math.floor(rel / MCPWM_OPERATOR_STRIDE);
    const op = group.operators[index];
    if (op === undefined) return null;
    return { index, op, toff: rel % MCPWM_OPERATOR_STRIDE };
  }

  private mcpwmTimerPeriod(t: McpwmTimer): number {
    return (t.cfg0 >>> MCPWM_TIMER_PERIOD_SHIFT) & MCPWM_TIMER_PERIOD_MASK;
  }

  private mcpwmTimerCycleLength(t: McpwmTimer): number {
    return Math.max(1, this.mcpwmTimerPeriod(t) + 1);
  }

  private mcpwmTimerMode(t: McpwmTimer): number {
    return (t.cfg1 >>> MCPWM_TIMER_MOD_SHIFT) & MCPWM_TIMER_MOD_MASK;
  }

  private mcpwmTimerRunning(t: McpwmTimer): boolean {
    return (t.cfg1 & MCPWM_TIMER_START_MASK) === MCPWM_TIMER_START_RUN && this.mcpwmTimerMode(t) !== 0;
  }

  private mcpwmTimerTicks(group: McpwmGroup, t: McpwmTimer): number {
    if (!this.mcpwmTimerRunning(t)) return 0;
    const elapsed = Math.max(0, this.cpu.cycles - t.sync);
    const groupDiv = (group.clkCfg & 0xff) + 1;
    const timerDiv = (t.cfg0 & MCPWM_TIMER_PRESCALE_MASK) + 1;
    // mcpwm_reg.h defines PWM_clk as 6.25 ns * (prescale + 1),
    // i.e. 160 MHz before dividers. The modeled CPU runs at 240 MHz.
    return Math.floor((elapsed * 2) / (3 * groupDiv * timerDiv));
  }

  private mcpwmTimerTotal(group: McpwmGroup, t: McpwmTimer): number {
    return t.base + this.mcpwmTimerTicks(group, t);
  }

  private mcpwmTimerCounter(group: McpwmGroup, t: McpwmTimer): number {
    if (!this.mcpwmTimerRunning(t)) return t.base & MCPWM_TIMER_PERIOD_MASK;
    const period = this.mcpwmTimerPeriod(t);
    const mode = this.mcpwmTimerMode(t);
    if (mode === MCPWM_TIMER_MOD_DOWN) {
      const down = this.mcpwmTimerTotal(group, t) % Math.max(1, period + 1);
      return Math.max(0, period - down);
    }
    if (mode === MCPWM_TIMER_MOD_UP_DOWN && period > 0) {
      const phase = this.mcpwmTimerTotal(group, t) % (period * 2);
      return phase <= period ? phase : period * 2 - phase;
    }
    return this.mcpwmTimerTotal(group, t) % this.mcpwmTimerCycleLength(t);
  }

  private mcpwmTimerDirection(group: McpwmGroup, t: McpwmTimer): 0 | 1 {
    const mode = this.mcpwmTimerMode(t);
    if (mode === MCPWM_TIMER_MOD_DOWN) return 1;
    if (mode !== MCPWM_TIMER_MOD_UP_DOWN) return 0;
    const period = this.mcpwmTimerPeriod(t);
    if (period <= 0) return 0;
    return this.mcpwmTimerTotal(group, t) % (period * 2) > period ? 1 : 0;
  }

  private mcpwmEventSerial(total: number, threshold: number, period: number): number {
    if (threshold < 0 || threshold > period || total < threshold) return 0;
    return Math.floor((total - threshold) / Math.max(1, period + 1)) + 1;
  }

  private mcpwmTezSerial(group: McpwmGroup, t: McpwmTimer): number {
    if (!this.mcpwmTimerRunning(t)) return 0;
    return Math.floor(this.mcpwmTimerTotal(group, t) / this.mcpwmTimerCycleLength(t));
  }

  private mcpwmTepSerial(group: McpwmGroup, t: McpwmTimer): number {
    if (!this.mcpwmTimerRunning(t)) return 0;
    const period = this.mcpwmTimerPeriod(t);
    return this.mcpwmEventSerial(this.mcpwmTimerTotal(group, t), period, period);
  }

  private mcpwmLatchTimerSerials(group: McpwmGroup, timer: McpwmTimer): void {
    timer.tezSerial = this.mcpwmTezSerial(group, timer);
    timer.tepSerial = this.mcpwmTepSerial(group, timer);
  }

  private mcpwmLatchOperatorSerials(group: McpwmGroup, opIndex: number, op: McpwmOperator): void {
    const timer = this.mcpwmOperatorTimer(group, opIndex);
    if (timer === undefined || !this.mcpwmTimerRunning(timer)) {
      op.cmpASerial = 0;
      op.cmpBSerial = 0;
      return;
    }
    const period = this.mcpwmTimerPeriod(timer);
    const total = this.mcpwmTimerTotal(group, timer);
    op.cmpASerial = this.mcpwmEventSerial(total, op.tstmpA & 0xffff, period);
    op.cmpBSerial = this.mcpwmEventSerial(total, op.tstmpB & 0xffff, period);
  }

  private mcpwmResyncTimer(group: McpwmGroup, timer: McpwmTimer): void {
    timer.base = this.mcpwmTimerCounter(group, timer);
    timer.sync = this.cpu.cycles;
    this.mcpwmLatchTimerSerials(group, timer);
  }

  private mcpwmOperatorTimer(group: McpwmGroup, opIndex: number): McpwmTimer | undefined {
    const timerIndex = (group.operatorTimerSel >>> (opIndex * 2)) & 0x3;
    return group.timers[timerIndex < MCPWM_TIMERS ? timerIndex : 0];
  }

  private mcpwmApplyAction(level: DigitalLevel, action: number): DigitalLevel {
    switch (action & 0x3) {
      case MCPWM_GEN_ACTION_LOW:
        return 0;
      case MCPWM_GEN_ACTION_HIGH:
        return 1;
      case MCPWM_GEN_ACTION_TOGGLE:
        return level === 1 ? 0 : 1;
      default:
        return level;
    }
  }

  private mcpwmGeneratorLevel(group: McpwmGroup, opIndex: number, genIndex: number): DigitalLevel {
    const op = group.operators[opIndex];
    if (op === undefined) return 0;
    const forceShift = genIndex === 0 ? MCPWM_GEN_A_FORCE_SHIFT : MCPWM_GEN_B_FORCE_SHIFT;
    const forceMode = (op.force >>> forceShift) & MCPWM_GEN_FORCE_MASK;
    if (forceMode === MCPWM_GEN_ACTION_LOW) return 0;
    if (forceMode === MCPWM_GEN_ACTION_HIGH) return 1;

    const timer = this.mcpwmOperatorTimer(group, opIndex);
    if (timer === undefined || !this.mcpwmTimerRunning(timer)) return 0;
    const period = this.mcpwmTimerPeriod(timer);
    const counter = this.mcpwmTimerCounter(group, timer);
    const cmpA = op.tstmpA & 0xffff;
    const cmpB = op.tstmpB & 0xffff;
    const actionReg = genIndex === 0 ? op.genA : op.genB;

    let level: DigitalLevel = 0;
    level = this.mcpwmApplyAction(level, (actionReg >>> MCPWM_GEN_ACTION_UTEZ_SHIFT) & 0x3);
    if (cmpA <= period && counter >= cmpA) {
      level = this.mcpwmApplyAction(level, (actionReg >>> MCPWM_GEN_ACTION_UTEA_SHIFT) & 0x3);
    }
    if (cmpB <= period && counter >= cmpB) {
      level = this.mcpwmApplyAction(level, (actionReg >>> MCPWM_GEN_ACTION_UTEB_SHIFT) & 0x3);
    }
    if (counter >= period) {
      level = this.mcpwmApplyAction(level, (actionReg >>> MCPWM_GEN_ACTION_UTEP_SHIFT) & 0x3);
    }
    return level;
  }

  private mcpwmSignalLevel(signal: number): DigitalLevel | null {
    let groupIndex: 0 | 1;
    let signalBase: number;
    if (signal >= MCPWM_SIGNAL_GROUP0_BASE && signal < MCPWM_SIGNAL_GROUP0_BASE + MCPWM_OPERATORS * MCPWM_GENERATORS) {
      groupIndex = 0;
      signalBase = MCPWM_SIGNAL_GROUP0_BASE;
    } else if (signal >= MCPWM_SIGNAL_GROUP1_BASE && signal < MCPWM_SIGNAL_GROUP1_BASE + MCPWM_OPERATORS * MCPWM_GENERATORS) {
      groupIndex = 1;
      signalBase = MCPWM_SIGNAL_GROUP1_BASE;
    } else {
      return null;
    }
    const group = this.mcpwm[groupIndex];
    if (group === undefined) return null;
    const rel = signal - signalBase;
    return this.mcpwmGeneratorLevel(group, Math.floor(rel / MCPWM_GENERATORS), rel % MCPWM_GENERATORS);
  }

  private checkMcpwm(): void {
    let changed = false;
    for (const group of this.mcpwm) {
      for (let timerIndex = 0; timerIndex < MCPWM_TIMERS; timerIndex++) {
        const timer = group.timers[timerIndex];
        if (timer === undefined || !this.mcpwmTimerRunning(timer)) continue;
        const tezSerial = this.mcpwmTezSerial(group, timer);
        if (tezSerial > timer.tezSerial) {
          timer.tezSerial = tezSerial;
          group.intRaw |= 1 << (MCPWM_TIMER_TEZ_INT_BASE + timerIndex);
          changed = true;
        }
        const tepSerial = this.mcpwmTepSerial(group, timer);
        if (tepSerial > timer.tepSerial) {
          timer.tepSerial = tepSerial;
          group.intRaw |= 1 << (MCPWM_TIMER_TEP_INT_BASE + timerIndex);
          changed = true;
        }
      }
      for (let opIndex = 0; opIndex < MCPWM_OPERATORS; opIndex++) {
        const op = group.operators[opIndex];
        const timer = this.mcpwmOperatorTimer(group, opIndex);
        if (op === undefined || timer === undefined || !this.mcpwmTimerRunning(timer)) continue;
        const period = this.mcpwmTimerPeriod(timer);
        const total = this.mcpwmTimerTotal(group, timer);
        const cmpASerial = this.mcpwmEventSerial(total, op.tstmpA & 0xffff, period);
        if (cmpASerial > op.cmpASerial) {
          op.cmpASerial = cmpASerial;
          group.intRaw |= 1 << (MCPWM_OP_TEA_INT_BASE + opIndex);
          changed = true;
        }
        const cmpBSerial = this.mcpwmEventSerial(total, op.tstmpB & 0xffff, period);
        if (cmpBSerial > op.cmpBSerial) {
          op.cmpBSerial = cmpBSerial;
          group.intRaw |= 1 << (MCPWM_OP_TEB_INT_BASE + opIndex);
          changed = true;
        }
      }
    }
    if (changed) this.recomputeIrq();
  }

  private mcpwmRead(group: McpwmGroup, off: number): number {
    if (off === MCPWM_CLK_CFG) return group.clkCfg >>> 0;
    const timerReg = this.mcpwmTimerForOffset(group, off);
    if (timerReg !== null) {
      const { timer, toff } = timerReg;
      if (toff === 0) return timer.cfg0 >>> 0;
      if (toff === MCPWM_TIMER_CFG1_DELTA) return timer.cfg1 >>> 0;
      if (toff === MCPWM_TIMER_SYNC_DELTA) return timer.syncReg >>> 0;
      if (toff === MCPWM_TIMER_STATUS_DELTA) {
        return (this.mcpwmTimerCounter(group, timer) | (this.mcpwmTimerDirection(group, timer) << 16)) >>> 0;
      }
      return 0;
    }
    if (off === MCPWM_OPERATOR_TIMERSEL) return group.operatorTimerSel >>> 0;
    const opReg = this.mcpwmOperatorForOffset(group, off);
    if (opReg !== null) {
      const { op, toff } = opReg;
      if (toff === MCPWM_GEN_STMP_CFG) return op.stmpCfg >>> 0;
      if (toff === MCPWM_GEN_TSTMP_A) return op.tstmpA >>> 0;
      if (toff === MCPWM_GEN_TSTMP_B) return op.tstmpB >>> 0;
      if (toff === MCPWM_GEN_CFG0) return op.cfg0 >>> 0;
      if (toff === MCPWM_GEN_FORCE) return op.force >>> 0;
      if (toff === MCPWM_GEN_A_REG) return op.genA >>> 0;
      if (toff === MCPWM_GEN_B_REG) return op.genB >>> 0;
      return 0;
    }
    if (off === MCPWM_INT_ENA) return group.intEna >>> 0;
    if (off === MCPWM_INT_RAW) return group.intRaw >>> 0;
    if (off === MCPWM_INT_ST) return (group.intRaw & group.intEna) >>> 0;
    if (off === MCPWM_INT_CLR) return 0;
    if (off === MCPWM_CLK) return group.clk >>> 0;
    if (off === MCPWM_DATE) return MCPWM_DATE_RESET;
    return 0;
  }

  private mcpwmWrite(group: McpwmGroup, off: number, value: number): void {
    const v = value >>> 0;
    if (off === MCPWM_CLK_CFG) {
      for (const timer of group.timers) this.mcpwmResyncTimer(group, timer);
      group.clkCfg = v & 0xff;
      return;
    }
    const timerReg = this.mcpwmTimerForOffset(group, off);
    if (timerReg !== null) {
      const { timer, toff } = timerReg;
      if (toff === 0) {
        this.mcpwmResyncTimer(group, timer);
        timer.cfg0 = v & 0x03ffffff;
        this.mcpwmLatchTimerSerials(group, timer);
      } else if (toff === MCPWM_TIMER_CFG1_DELTA) {
        const wasRunning = this.mcpwmTimerRunning(timer);
        if (wasRunning) this.mcpwmResyncTimer(group, timer);
        timer.cfg1 = v & 0x1f;
        if (!wasRunning && this.mcpwmTimerRunning(timer)) {
          timer.base = 0;
          timer.sync = this.cpu.cycles;
        }
        this.mcpwmLatchTimerSerials(group, timer);
        for (let i = 0; i < MCPWM_OPERATORS; i++) {
          const op = group.operators[i];
          if (op !== undefined) this.mcpwmLatchOperatorSerials(group, i, op);
        }
      } else if (toff === MCPWM_TIMER_SYNC_DELTA) {
        timer.syncReg = v;
      }
      this.syncPins();
      return;
    }
    if (off === MCPWM_OPERATOR_TIMERSEL) {
      group.operatorTimerSel = v & 0x3f;
      for (let i = 0; i < MCPWM_OPERATORS; i++) {
        const op = group.operators[i];
        if (op !== undefined) this.mcpwmLatchOperatorSerials(group, i, op);
      }
      this.syncPins();
      return;
    }
    const opReg = this.mcpwmOperatorForOffset(group, off);
    if (opReg !== null) {
      const { index, op, toff } = opReg;
      if (toff === MCPWM_GEN_STMP_CFG) op.stmpCfg = v;
      else if (toff === MCPWM_GEN_TSTMP_A) {
        op.tstmpA = v & 0xffff;
        this.mcpwmLatchOperatorSerials(group, index, op);
      } else if (toff === MCPWM_GEN_TSTMP_B) {
        op.tstmpB = v & 0xffff;
        this.mcpwmLatchOperatorSerials(group, index, op);
      } else if (toff === MCPWM_GEN_CFG0) op.cfg0 = v;
      else if (toff === MCPWM_GEN_FORCE) op.force = v;
      else if (toff === MCPWM_GEN_A_REG) op.genA = v & 0x00ffffff;
      else if (toff === MCPWM_GEN_B_REG) op.genB = v & 0x00ffffff;
      this.syncPins();
      return;
    }
    if (off === MCPWM_INT_ENA) {
      group.intEna = v & MCPWM_INT_CLEARABLE;
      this.recomputeIrq();
      return;
    }
    if (off === MCPWM_INT_CLR) {
      group.intRaw &= ~(v & MCPWM_INT_CLEARABLE);
      this.recomputeIrq();
      return;
    }
    if (off === MCPWM_CLK) {
      group.clk = v & 1;
    }
  }

  private twaiForAddress(addr: number): number | null {
    if (addr >= TWAI_BASE && addr < TWAI_BASE + TWAI_BLOCK_BYTES) return addr - TWAI_BASE;
    return null;
  }

  private twaiStatus(): number {
    // TBS (transmit buffer) is always free in this synchronous model; TCS reflects
    // whether the last transmission actually completed (cleared by a single-shot drop
    // or an unacknowledged transmit).
    let status = TWAI_STATUS_TX_BUFFER;
    if (this.twai.txComplete) status |= TWAI_STATUS_TX_COMPLETE;
    if (this.twai.rxFifo.length > 0) status |= TWAI_STATUS_RX_BUFFER;
    if (this.twai.dataOverrun) status |= TWAI_STATUS_DATA_OVERRUN;
    if (this.twai.busOff || this.twai.txErrCounter >= this.twai.errWarningLimit || this.twai.rxErrCounter >= this.twai.errWarningLimit) {
      status |= TWAI_STATUS_ERROR;
    }
    if (this.twai.busOff) status |= TWAI_STATUS_BUS;
    return status >>> 0;
  }

  private twaiReadBufferByte(index: number): number {
    const frame = this.twai.rxFifo[0];
    return (frame ?? this.twai.buffer)[index] ?? 0;
  }

  private twaiAcceptanceCode(): number {
    return (
      (((this.twai.acceptance[0] ?? 0) << 24) |
        ((this.twai.acceptance[1] ?? 0) << 16) |
        ((this.twai.acceptance[2] ?? 0) << 8) |
        (this.twai.acceptance[3] ?? 0)) >>>
      0
    );
  }

  private twaiAcceptanceMask(): number {
    return (
      (((this.twai.acceptance[4] ?? 0) << 24) |
        ((this.twai.acceptance[5] ?? 0) << 16) |
        ((this.twai.acceptance[6] ?? 0) << 8) |
        (this.twai.acceptance[7] ?? 0)) >>>
      0
    );
  }

  private twaiFrameAcceptanceWord(frame: readonly number[]): number {
    const info = frame[0] ?? 0;
    const rtr = (info & TWAI_FRAME_RTR) !== 0 ? 1 : 0;
    if ((info & TWAI_FRAME_EXTENDED) !== 0) {
      const id =
        ((((frame[1] ?? 0) << 21) | ((frame[2] ?? 0) << 13) | ((frame[3] ?? 0) << 5) | ((frame[4] ?? 0) >>> 3)) &
          TWAI_EXT_ID_MASK) >>>
        0;
      return (((id & TWAI_EXT_ID_MASK) << 3) | (rtr << 2)) >>> 0;
    }
    const id = ((((frame[1] ?? 0) << 3) | ((frame[2] ?? 0) >>> 5)) & TWAI_STD_ID_MASK) >>> 0;
    const data0 = (frame[3] ?? 0) & 0xff;
    const data1 = (frame[4] ?? 0) & 0xff;
    return (((id & TWAI_STD_ID_MASK) << 21) | (rtr << 20) | (data0 << 12) | (data1 << 4)) >>> 0;
  }

  private twaiAcceptsFrame(frame: readonly number[]): boolean {
    // SJA1000 AMR semantics: mask bit 1 means "do not compare". AFM (mode bit
    // 3) selects single (set) vs dual (clear) filter mode. Dual-filter mode is
    // modeled exactly for both standard and extended frames.
    const single = (this.twai.mode & TWAI_MODE_ACCEPTANCE_FILTER) !== 0;
    if (single) {
      const code = this.twaiAcceptanceCode();
      const mask = this.twaiAcceptanceMask();
      const word = this.twaiFrameAcceptanceWord(frame);
      return (((word ^ code) & ~mask) >>> 0) === 0;
    }
    const extended = ((frame[0] ?? 0) & TWAI_FRAME_EXTENDED) !== 0;
    return extended
      ? this.twaiAcceptsDualFilterExtended(frame)
      : this.twaiAcceptsDualFilterStandard(frame);
  }

  private twaiAcceptsDualFilterExtended(frame: readonly number[]): boolean {
    // Dual-filter EFF: each filter compares only ID[28:13] (top 16 bits);
    // RTR and data bytes do not participate. Filter 1 = ACR0/ACR1,
    // Filter 2 = ACR2/ACR3. Accept if either matches (mask bit 1 = don't care).
    const id =
      ((((frame[1] ?? 0) << 21) | ((frame[2] ?? 0) << 13) | ((frame[3] ?? 0) << 5) | ((frame[4] ?? 0) >>> 3)) &
        TWAI_EXT_ID_MASK) >>>
      0;
    const [acr0, acr1, acr2, acr3, amr0, amr1, amr2, amr3] = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) => this.twai.acceptance[i] ?? 0,
    ) as [number, number, number, number, number, number, number, number];
    const compare = 0x1fffe000; // ID[28:13]
    const code1 = (((acr0 << 21) | (acr1 << 13)) & compare) >>> 0;
    const mask1 = (((amr0 << 21) | (amr1 << 13)) & compare) >>> 0;
    if ((((id ^ code1) & ~mask1 & compare) >>> 0) === 0) return true;
    const code2 = (((acr2 << 21) | (acr3 << 13)) & compare) >>> 0;
    const mask2 = (((amr2 << 21) | (amr3 << 13)) & compare) >>> 0;
    return (((id ^ code2) & ~mask2 & compare) >>> 0) === 0;
  }

  private twaiAcceptsDualFilterStandard(frame: readonly number[]): boolean {
    const info = frame[0] ?? 0;
    const rtr = (info & TWAI_FRAME_RTR) !== 0 ? 1 : 0;
    const id = ((((frame[1] ?? 0) << 3) | ((frame[2] ?? 0) >>> 5)) & TWAI_STD_ID_MASK) >>> 0;
    const data0 = (frame[3] ?? 0) & 0xff;
    const [acr0, acr1, acr2, acr3, amr0, amr1, amr2, amr3] = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) => this.twai.acceptance[i] ?? 0,
    ) as [number, number, number, number, number, number, number, number];

    // Filter 1: ID[10:3]=ACR0, ID[2:0]=ACR1[7:5], RTR=ACR1[4],
    // data byte 1 = ACR1[3:0]<<4 | ACR3[3:0].
    const f1IdCode = ((acr0 << 3) | (acr1 >>> 5)) & TWAI_STD_ID_MASK;
    const f1IdMask = ((amr0 << 3) | (amr1 >>> 5)) & TWAI_STD_ID_MASK;
    const f1IdMatch = (((id ^ f1IdCode) & ~f1IdMask) & TWAI_STD_ID_MASK) === 0;
    const f1RtrMatch = ((amr1 >>> 4) & 1) === 1 || ((acr1 >>> 4) & 1) === rtr;
    const f1DataCode = (((acr1 & 0x0f) << 4) | (acr3 & 0x0f)) & 0xff;
    const f1DataMask = (((amr1 & 0x0f) << 4) | (amr3 & 0x0f)) & 0xff;
    // Data filtering applies to data frames only; remote frames carry no data.
    const f1DataMatch = rtr === 1 || (((data0 ^ f1DataCode) & ~f1DataMask) & 0xff) === 0;
    if (f1IdMatch && f1RtrMatch && f1DataMatch) return true;

    // Filter 2: ID[10:3]=ACR2, ID[2:0]=ACR3[7:5], RTR=ACR3[4]; ID+RTR only.
    const f2IdCode = ((acr2 << 3) | (acr3 >>> 5)) & TWAI_STD_ID_MASK;
    const f2IdMask = ((amr2 << 3) | (amr3 >>> 5)) & TWAI_STD_ID_MASK;
    const f2IdMatch = (((id ^ f2IdCode) & ~f2IdMask) & TWAI_STD_ID_MASK) === 0;
    const f2RtrMatch = ((amr3 >>> 4) & 1) === 1 || ((acr3 >>> 4) & 1) === rtr;
    return f2IdMatch && f2RtrMatch;
  }

  private twaiPushRxFrame(frame: number[], applyFilter: boolean): boolean {
    if ((this.twai.mode & TWAI_MODE_RESET) !== 0) return false;
    if (applyFilter && !this.twaiAcceptsFrame(frame)) return false;
    if (this.twai.rxFifo.length >= 64) {
      this.twai.dataOverrun = true;
      this.twai.interrupt |= TWAI_INTR_DATA_OVERRUN;
      this.twai.events.push({ type: 'error', flags: { rxFifoOverrun: true } });
      return false;
    }
    this.twai.rxFifo.push(frame.map((b) => b & 0xff));
    this.twai.interrupt |= TWAI_INTR_RX;
    this.twai.events.push({ type: 'rx_done', frame: this.twaiFrameEvent(frame) });
    return true;
  }

  private twaiActiveOnBus(): boolean {
    return (this.twai.mode & TWAI_MODE_RESET) === 0 && !this.twai.busOff;
  }

  private twaiCanAckBusFrame(): boolean {
    return this.twaiActiveOnBus() && (this.twai.mode & TWAI_MODE_LISTEN_ONLY) === 0;
  }

  private twaiReceiveFromBus(frame: readonly number[]): boolean {
    if (!this.twaiActiveOnBus()) return false;
    const canAck = this.twaiCanAckBusFrame();
    this.twaiPushRxFrame(Array.from(frame, (b) => b & 0xff), true);
    this.recomputeIrq();
    return canAck;
  }

  private twaiFormatFrame(frame: Esp32s3TwaiFrame): number[] {
    const data = Array.from(frame.data ?? [], (b) => {
      if (!Number.isInteger(b) || b < 0 || b > 0xff) {
        throw new Error(`TWAI data bytes must be integers 0..255 (got ${String(b)})`);
      }
      return b & 0xff;
    });
    const dlc = frame.dlc ?? data.length;
    if (!Number.isInteger(dlc) || dlc < 0 || dlc > TWAI_FRAME_DLC_MASK) {
      throw new Error(`TWAI dlc must be an integer 0..15 (got ${String(dlc)})`);
    }
    const extended = frame.extended === true;
    const idMask = extended ? TWAI_EXT_ID_MASK : TWAI_STD_ID_MASK;
    if (!Number.isInteger(frame.id) || frame.id < 0 || frame.id > idMask) {
      throw new Error(`TWAI ${extended ? 'extended' : 'standard'} id must be 0..0x${idMask.toString(16)} (got ${String(frame.id)})`);
    }

    const out = Array(TWAI_BUFFER_BYTES).fill(0) as number[];
    out[0] = (dlc & TWAI_FRAME_DLC_MASK) | (frame.rtr === true ? TWAI_FRAME_RTR : 0) | (extended ? TWAI_FRAME_EXTENDED : 0);
    if (extended) {
      const id = frame.id & TWAI_EXT_ID_MASK;
      out[1] = (id >>> 21) & 0xff;
      out[2] = (id >>> 13) & 0xff;
      out[3] = (id >>> 5) & 0xff;
      out[4] = (id << 3) & 0xff;
      for (let i = 0; i < Math.min(TWAI_FRAME_DATA_BYTES, dlc, data.length); i++) out[5 + i] = data[i] ?? 0;
    } else {
      const id = frame.id & TWAI_STD_ID_MASK;
      out[1] = (id >>> 3) & 0xff;
      out[2] = (id << 5) & 0xff;
      for (let i = 0; i < Math.min(TWAI_FRAME_DATA_BYTES, dlc, data.length); i++) out[3 + i] = data[i] ?? 0;
    }
    return out;
  }

  private twaiDecodeFrame(frame: readonly number[]): Esp32s3TwaiFrame {
    const info = frame[0] ?? 0;
    const dlc = info & TWAI_FRAME_DLC_MASK;
    const extended = (info & TWAI_FRAME_EXTENDED) !== 0;
    const rtr = (info & TWAI_FRAME_RTR) !== 0;
    const id = extended
      ? ((((frame[1] ?? 0) << 21) | ((frame[2] ?? 0) << 13) | ((frame[3] ?? 0) << 5) | ((frame[4] ?? 0) >>> 3)) & TWAI_EXT_ID_MASK)
      : ((((frame[1] ?? 0) << 3) | ((frame[2] ?? 0) >>> 5)) & TWAI_STD_ID_MASK);
    const dataOffset = extended ? 5 : 3;
    const data = rtr ? [] : frame.slice(dataOffset, dataOffset + Math.min(TWAI_FRAME_DATA_BYTES, dlc)).map((b) => b & 0xff);
    return { id, data, dlc, extended, rtr };
  }

  private twaiCloneDecodedFrame(frame: Esp32s3TwaiFrame): Esp32s3TwaiFrame {
    return {
      id: frame.id,
      data: Array.from(frame.data ?? []),
      dlc: frame.dlc,
      extended: frame.extended,
      rtr: frame.rtr,
    };
  }

  private twaiFrameEvent(frame: readonly number[]): Esp32s3TwaiFrame {
    return this.twaiCloneDecodedFrame(this.twaiDecodeFrame(frame));
  }

  private twaiCloneEvent(event: Esp32s3TwaiEvent): Esp32s3TwaiEvent {
    switch (event.type) {
      case 'tx_done':
        return { type: 'tx_done', success: event.success, frame: this.twaiCloneDecodedFrame(event.frame) };
      case 'rx_done':
        return { type: 'rx_done', frame: this.twaiCloneDecodedFrame(event.frame) };
      case 'error':
        return {
          type: 'error',
          flags: {
            ...(event.flags.ackErr === true ? { ackErr: true } : {}),
            ...(event.flags.busError === true ? { busError: true } : {}),
            ...(event.flags.rxFifoOverrun === true ? { rxFifoOverrun: true } : {}),
            ...(event.flags.busOff === true ? { busOff: true } : {}),
            ...(event.flags.arbLost === true ? { arbLost: true } : {}),
          },
        };
      case 'state_change':
        return { type: 'state_change', oldState: event.oldState, newState: event.newState };
    }
  }

  private twaiErrorState(): Esp32s3TwaiErrorState {
    if (this.twai.busOff) return 'bus_off';
    const errorCount = Math.max(this.twai.txErrCounter, this.twai.rxErrCounter);
    if (errorCount >= 128) return 'passive';
    if (errorCount >= this.twai.errWarningLimit) return 'warning';
    return 'active';
  }

  private twaiPushStateChange(oldState: Esp32s3TwaiErrorState): void {
    const newState = this.twaiErrorState();
    if (newState !== oldState) this.twai.events.push({ type: 'state_change', oldState, newState });
  }

  private twaiRecordSuccessfulTransmit(): void {
    const oldState = this.twaiErrorState();
    if (this.twai.txErrCounter > 0) this.twai.txErrCounter--;
    this.twaiPushStateChange(oldState);
  }

  private twaiRecordAckError(): void {
    const oldState = this.twaiErrorState();
    const nextTec = this.twai.txErrCounter + TWAI_ERR_DELTA_TX_ACK;
    this.twai.errCodeCapture = TWAI_ERR_SEG_ACK_SLOT;
    this.twai.interrupt |= TWAI_INTR_ERR | TWAI_INTR_BUS_ERR;
    this.twai.events.push({ type: 'error', flags: { ackErr: true, busError: true } });
    if (nextTec >= 256) {
      this.twai.busOff = true;
      this.twai.mode |= TWAI_MODE_RESET;
      this.twai.txErrCounter = 128;
      this.twai.rxErrCounter = 0;
      this.twai.interrupt |= TWAI_INTR_ERR_PASSIVE;
      this.twai.events.push({ type: 'error', flags: { busOff: true } });
      this.twaiPushStateChange(oldState);
      return;
    }
    this.twai.txErrCounter = nextTec & 0xff;
    if (this.twai.txErrCounter >= 128) this.twai.interrupt |= TWAI_INTR_ERR_PASSIVE;
    this.twaiPushStateChange(oldState);
  }

  private twaiTransmit(selfReceive: boolean, singleShot: boolean): void {
    if ((this.twai.mode & TWAI_MODE_RESET) !== 0) return;
    if ((this.twai.mode & TWAI_MODE_LISTEN_ONLY) !== 0) return;
    this.twai.pendingTx = this.twai.buffer.slice(0, TWAI_BUFFER_BYTES).map((b) => b & 0xff);
    this.twai.pendingTxSelfReceive = selfReceive;
    this.twai.pendingTxSingleShot = singleShot;
    this.twaiResolveBus();
  }

  /**
   * Resolve all frames pending on the bus by CAN bitwise arbitration. Each round the
   * numerically lowest identifier wins and is delivered; every loser captures the
   * arbitration-lost bit (ALC), raises ALI, and — because CAN is non-destructive —
   * keeps its frame armed to retransmit on the next round. The winner clears its
   * pending frame, so the contender set strictly shrinks and the loop terminates.
   * With a single armed node (the common case) it wins uncontested and delivers
   * exactly as a plain transmit.
   */
  private twaiResolveBus(): void {
    const bus = [this, ...this.twaiPeers];
    for (;;) {
      const contenders = bus.filter(
        (node) =>
          node.twai.pendingTx !== null &&
          (node.twai.mode & TWAI_MODE_RESET) === 0 &&
          (node.twai.mode & TWAI_MODE_LISTEN_ONLY) === 0 &&
          !node.twai.busOff,
      );
      if (contenders.length === 0) return;
      let winner = contenders[0]!;
      let winnerKey = winner.twaiArbitrationKey(winner.twai.pendingTx!);
      for (let i = 1; i < contenders.length; i++) {
        const node = contenders[i]!;
        const key = node.twaiArbitrationKey(node.twai.pendingTx!);
        if (key < winnerKey) {
          winner = node;
          winnerKey = key;
        }
      }
      const winningFrame = winner.twai.pendingTx!;
      // Losers detect the collision during the arbitration field, before the frame
      // completes: capture the losing bit, raise ALI, but do NOT touch the TEC —
      // losing arbitration is normal traffic, not a bus error.
      for (const node of contenders) {
        if (node === winner) continue;
        // The SJA1000 ALC/ALI capture latches on the first loss and is suppressed
        // until software reads ALC (re-arm). Arbitration itself still happens — the
        // loser keeps its frame armed below and retransmits regardless — but a
        // second loss before ALC is read produces no new capture or interrupt.
        if (!node.twai.arbLostCaptureArmed) continue;
        node.twai.arbLostCapture = node.twaiArbLostBit(node.twai.pendingTx!, winningFrame);
        node.twai.arbLostCaptureArmed = false;
        node.twai.interrupt |= TWAI_INTR_ARB_LOST;
        node.twai.events.push({ type: 'error', flags: { arbLost: true } });
        node.recomputeIrq();
      }
      winner.twai.pendingTx = null;
      const selfReceive = winner.twai.pendingTxSelfReceive;
      winner.twai.pendingTxSelfReceive = false;
      winner.twai.pendingTxSingleShot = false;
      winner.twaiDeliver(winningFrame, selfReceive);
      // Single-shot losers do not retransmit: the controller releases the TX buffer
      // and reports a failed transmission (TWAI_ALERT_TX_FAILED) rather than
      // re-arming the frame. This happens after the winning frame is received.
      for (const node of contenders) {
        if (node === winner || !node.twai.pendingTxSingleShot) continue;
        const dropped = node.twai.pendingTx!;
        node.twai.pendingTx = null;
        node.twai.pendingTxSingleShot = false;
        node.twai.pendingTxSelfReceive = false;
        node.twai.txComplete = false; // single-shot drop did not complete (TCS = 0)
        node.twai.events.push({ type: 'tx_done', success: false, frame: node.twaiFrameEvent(dropped) });
        node.twai.interrupt |= TWAI_INTR_TX;
        node.recomputeIrq();
      }
    }
  }

  private twaiDeliver(frame: number[], selfReceive: boolean): void {
    this.twai.txLog.push(frame);
    let acknowledged = (this.twai.mode & TWAI_MODE_NO_ACK) !== 0;
    if (selfReceive) this.twaiPushRxFrame(frame, true);
    if (!selfReceive) {
      for (const peer of this.twaiPeers) acknowledged = peer.twaiReceiveFromBus(frame) || acknowledged;
    }
    this.twai.txComplete = acknowledged;
    if (acknowledged) this.twaiRecordSuccessfulTransmit();
    else this.twaiRecordAckError();
    this.twai.events.push({ type: 'tx_done', success: acknowledged, frame: this.twaiFrameEvent(frame) });
    this.twai.interrupt |= TWAI_INTR_TX;
    this.recomputeIrq();
  }

  private twaiArbitrationKey(frame: readonly number[]): number {
    // Wire-order priority — lower key wins. CAN arbitrates the 11-bit base id first
    // (identical position in both formats), then bit 12 (RTR for standard frames,
    // recessive SRR=1 for extended), then bit 13 (IDE: dominant 0 for standard,
    // recessive 1 for extended), then the 18-bit extension + RTR for extended frames.
    // This makes a standard frame beat an extended frame sharing the same base id,
    // and a data frame beat a remote frame with the same id — both per CAN 2.0B.
    const info = frame[0] ?? 0;
    const rtr = (info & TWAI_FRAME_RTR) !== 0 ? 1 : 0;
    if ((info & TWAI_FRAME_EXTENDED) !== 0) {
      const id =
        ((((frame[1] ?? 0) << 21) | ((frame[2] ?? 0) << 13) | ((frame[3] ?? 0) << 5) | ((frame[4] ?? 0) >>> 3)) &
          TWAI_EXT_ID_MASK) >>>
        0;
      const base = (id >>> 18) & TWAI_STD_ID_MASK;
      const ext18 = id & 0x3ffff;
      return base * 0x200000 + 0x100000 + 0x80000 + ((ext18 << 1) | rtr);
    }
    const id = ((((frame[1] ?? 0) << 3) | ((frame[2] ?? 0) >>> 5)) & TWAI_STD_ID_MASK) >>> 0;
    return id * 0x200000 + rtr * 0x100000;
  }

  private twaiArbitrationBits(frame: readonly number[]): number[] {
    // Arbitration field in transmission order, MSB first, excluding the SOF bit.
    const info = frame[0] ?? 0;
    const rtr = (info & TWAI_FRAME_RTR) !== 0 ? 1 : 0;
    const bits: number[] = [];
    if ((info & TWAI_FRAME_EXTENDED) !== 0) {
      const id =
        ((((frame[1] ?? 0) << 21) | ((frame[2] ?? 0) << 13) | ((frame[3] ?? 0) << 5) | ((frame[4] ?? 0) >>> 3)) &
          TWAI_EXT_ID_MASK) >>>
        0;
      for (let b = 28; b >= 18; b--) bits.push((id >>> b) & 1); // base ID.28..18
      bits.push(1); // SRR (recessive)
      bits.push(1); // IDE (recessive)
      for (let b = 17; b >= 0; b--) bits.push((id >>> b) & 1); // ID.17..0
      bits.push(rtr); // RTR
    } else {
      const id = ((((frame[1] ?? 0) << 3) | ((frame[2] ?? 0) >>> 5)) & TWAI_STD_ID_MASK) >>> 0;
      for (let b = 10; b >= 0; b--) bits.push((id >>> b) & 1); // ID.10..0
      bits.push(rtr); // RTR
      bits.push(0); // IDE (dominant)
    }
    return bits;
  }

  private twaiArbLostBit(loser: readonly number[], winner: readonly number[]): number {
    // ALC captures the bit number (SJA1000 numbering: SOF=0, ID.MSB=1, …) at which
    // the loser's recessive bit was first overridden by the winner's dominant bit.
    const lb = this.twaiArbitrationBits(loser);
    const wb = this.twaiArbitrationBits(winner);
    const n = Math.min(lb.length, wb.length);
    for (let i = 0; i < n; i++) {
      if (lb[i] !== wb[i]) return Math.min(0x1f, i + 1);
    }
    return Math.min(0x1f, n + 1);
  }

  private twaiRead(off: number): number {
    if (off === TWAI_MODE) return this.twai.mode >>> 0;
    if (off === TWAI_COMMAND) return 0;
    if (off === TWAI_STATUS) return this.twaiStatus();
    if (off === TWAI_INTERRUPT) {
      const value = this.twai.interrupt & TWAI_INTR_CLEARABLE;
      this.twai.interrupt = 0;
      this.recomputeIrq();
      return value >>> 0;
    }
    if (off === TWAI_INTERRUPT_ENABLE) return this.twai.interruptEna >>> 0;
    if (off === TWAI_BUS_TIMING_0) return this.twai.busTiming0 >>> 0;
    if (off === TWAI_BUS_TIMING_1) return this.twai.busTiming1 >>> 0;
    if (off === TWAI_ARB_LOST_CAPTURE) {
      const value = this.twai.arbLostCapture >>> 0;
      this.twai.arbLostCaptureArmed = true; // reading ALC re-arms the capture mechanism
      return value;
    }
    if (off === TWAI_ERR_CODE_CAPTURE) return this.twai.errCodeCapture >>> 0;
    if (off === TWAI_ERR_WARNING_LIMIT) return this.twai.errWarningLimit >>> 0;
    if (off === TWAI_RX_ERR_COUNTER) return this.twai.rxErrCounter >>> 0;
    if (off === TWAI_TX_ERR_COUNTER) return this.twai.txErrCounter >>> 0;
    if (off >= TWAI_BUFFER_START && off < TWAI_BUFFER_START + TWAI_BUFFER_BYTES * 4 && (off & 3) === 0) {
      const index = (off - TWAI_BUFFER_START) >> 2;
      if ((this.twai.mode & TWAI_MODE_RESET) !== 0 && index < TWAI_ACCEPTANCE_BYTES) return this.twai.acceptance[index] ?? 0;
      return this.twaiReadBufferByte(index);
    }
    if (off === TWAI_RX_MESSAGE_COUNTER) return Math.min(0x7f, this.twai.rxFifo.length);
    if (off === TWAI_CLOCK_DIVIDER) return this.twai.clockDivider >>> 0;
    return 0;
  }

  private twaiWrite(off: number, value: number): void {
    const v = value >>> 0;
    if (off === TWAI_MODE) {
      const wasResetMode = (this.twai.mode & TWAI_MODE_RESET) !== 0;
      this.twai.mode = v & TWAI_MODE_MASK;
      const inResetMode = (this.twai.mode & TWAI_MODE_RESET) !== 0;
      if (this.twai.busOff && wasResetMode && !inResetMode) {
        // Bus-off recovery: returning to operating mode rejoins the bus
        // error-active with cleared counters. ESP-IDF fires on_state_change
        // when the node exits bus-off; the 129-recessive-bit wait is not
        // modeled, so recovery here is immediate.
        this.twai.busOff = false;
        this.twai.txErrCounter = 0;
        this.twai.rxErrCounter = 0;
        this.twai.events.push({ type: 'state_change', oldState: 'bus_off', newState: 'active' });
      }
      this.recomputeIrq();
      return;
    }
    if (off === TWAI_COMMAND) {
      if ((v & TWAI_CMD_RELEASE_RX) !== 0) this.twai.rxFifo.shift();
      if ((v & TWAI_CMD_CLEAR_OVERRUN) !== 0) {
        this.twai.dataOverrun = false;
        this.twai.interrupt &= ~TWAI_INTR_DATA_OVERRUN;
      }
      // AT (abort) latched together with TR/SRR requests single-shot: the frame is
      // transmitted once and dropped on arbitration loss or error instead of being
      // retried (ESP-IDF writes CMR=0x03 for single-shot TX, 0x12 for single-shot
      // self-reception). AT on its own has no pending transmission to cancel in this
      // synchronous model, so it is a no-op.
      const singleShot = (v & TWAI_CMD_ABORT_TX) !== 0;
      if ((v & TWAI_CMD_TX_REQUEST) !== 0) this.twaiTransmit(false, singleShot);
      else if ((v & TWAI_CMD_SELF_RX_REQUEST) !== 0) this.twaiTransmit(true, singleShot);
      this.recomputeIrq();
      return;
    }
    if (off === TWAI_INTERRUPT_ENABLE) {
      this.twai.interruptEna = v & TWAI_INTR_CLEARABLE;
      this.recomputeIrq();
      return;
    }
    if (off === TWAI_BUS_TIMING_0) {
      this.twai.busTiming0 = v & 0xffff;
      return;
    }
    if (off === TWAI_BUS_TIMING_1) {
      this.twai.busTiming1 = v & 0xff;
      return;
    }
    if (off === TWAI_ARB_LOST_CAPTURE) {
      this.twai.arbLostCapture = v & 0x1f;
      return;
    }
    if (off === TWAI_ERR_CODE_CAPTURE) {
      this.twai.errCodeCapture = v & 0xff;
      return;
    }
    if (off === TWAI_ERR_WARNING_LIMIT) {
      this.twai.errWarningLimit = v & 0xff;
      return;
    }
    if (off === TWAI_RX_ERR_COUNTER) {
      this.twai.rxErrCounter = v & 0xff;
      return;
    }
    if (off === TWAI_TX_ERR_COUNTER) {
      this.twai.txErrCounter = v & 0xff;
      this.twai.busOff = false;
      return;
    }
    if (off >= TWAI_BUFFER_START && off < TWAI_BUFFER_START + TWAI_BUFFER_BYTES * 4 && (off & 3) === 0) {
      const index = (off - TWAI_BUFFER_START) >> 2;
      if ((this.twai.mode & TWAI_MODE_RESET) !== 0 && index < TWAI_ACCEPTANCE_BYTES) this.twai.acceptance[index] = v & 0xff;
      else this.twai.buffer[index] = v & 0xff;
      return;
    }
    if (off === TWAI_CLOCK_DIVIDER) {
      this.twai.clockDivider = v & TWAI_CLOCK_DIVIDER_MASK;
    }
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

  private pcntMatrixLevel(signal: number): DigitalLevel | null {
    const cfg = this.gpioFuncIn[signal] ?? 0;
    if ((cfg & GPIO_SIG_IN_SEL) === 0) return null;
    const gpio = cfg & GPIO_FUNC_IN_SEL_MASK;
    if (gpio >= PIN_COUNT) return null;
    let level = this.gpioPadLevel(gpio);
    if ((cfg & GPIO_FUNC_IN_INV_SEL) !== 0) level = level === 1 ? 0 : 1;
    return level;
  }

  private pcntSignalIndex(unit: number, channel: number): number {
    return PCNT_SIG_CH0_IN0_IDX + unit * PCNT_MATRIX_SIGNALS_PER_UNIT + channel;
  }

  private pcntCtrlIndex(unit: number, channel: number): number {
    return PCNT_SIG_CH0_IN0_IDX + unit * PCNT_MATRIX_SIGNALS_PER_UNIT + 2 + channel;
  }

  private pcntModeShift(channel: number, rising: boolean): number {
    return (rising ? PCNT_CH0_POS_MODE_SHIFT : PCNT_CH0_NEG_MODE_SHIFT) + channel * PCNT_CH_FIELD_CHANNEL_SHIFT;
  }

  private pcntCtrlShift(channel: number, level: DigitalLevel): number {
    return (level === 1 ? PCNT_CH0_HCTRL_MODE_SHIFT : PCNT_CH0_LCTRL_MODE_SHIFT) + channel * PCNT_CH_FIELD_CHANNEL_SHIFT;
  }

  private pcntSigned16(value: number): number {
    const raw = value & 0xffff;
    return raw >= 0x8000 ? raw - 0x10000 : raw;
  }

  private pcntUnitReset(unit: number): boolean {
    return (this.pcntCtrl & (1 << (unit * 2))) !== 0;
  }

  private pcntUnitPaused(unit: number): boolean {
    return (this.pcntCtrl & (1 << (unit * 2 + 1))) !== 0;
  }

  private pcntThresholdValue(unit: PcntUnit, index: 0 | 1): number {
    const raw = index === 0 ? unit.conf1 & 0xffff : (unit.conf1 >>> 16) & 0xffff;
    return this.pcntSigned16(raw);
  }

  private pcntLimitValue(unit: PcntUnit, high: boolean): number {
    const raw = high ? unit.conf2 & 0xffff : (unit.conf2 >>> 16) & 0xffff;
    return this.pcntSigned16(raw);
  }

  private pcntApplyEdgeAction(unitIndex: number, channel: number, rising: boolean): void {
    const unit = this.pcntUnits[unitIndex];
    if (unit === undefined || this.pcntUnitReset(unitIndex) || this.pcntUnitPaused(unitIndex)) return;
    let action = (unit.conf0 >>> this.pcntModeShift(channel, rising)) & PCNT_MODE_MASK;
    if (action === PCNT_ACTION_HOLD || (action !== PCNT_ACTION_INCREASE && action !== PCNT_ACTION_DECREASE)) return;

    const ctrl = unit.lastCtrl[channel];
    if (ctrl !== null && ctrl !== undefined) {
      const ctrlAction = (unit.conf0 >>> this.pcntCtrlShift(channel, ctrl)) & PCNT_MODE_MASK;
      if (ctrlAction === PCNT_CTRL_INVERT) {
        action = action === PCNT_ACTION_INCREASE ? PCNT_ACTION_DECREASE : PCNT_ACTION_INCREASE;
      } else if (ctrlAction !== PCNT_CTRL_KEEP) {
        return;
      }
    }

    const oldCount = unit.count;
    const delta = action === PCNT_ACTION_INCREASE ? 1 : -1;
    unit.count = this.pcntSigned16(unit.count + delta);
    if (unit.count !== oldCount) this.pcntCheckEvents(unitIndex, unit, oldCount);
  }

  private pcntCheckEvents(unitIndex: number, unit: PcntUnit, oldCount: number): void {
    let latched = 0;
    if ((unit.conf0 & PCNT_THR_THRES1_EN) !== 0 && unit.count === this.pcntThresholdValue(unit, 1)) latched |= PCNT_STATUS_THRES1_LAT;
    if ((unit.conf0 & PCNT_THR_THRES0_EN) !== 0 && unit.count === this.pcntThresholdValue(unit, 0)) latched |= PCNT_STATUS_THRES0_LAT;
    if ((unit.conf0 & PCNT_THR_L_LIM_EN) !== 0 && unit.count === this.pcntLimitValue(unit, false)) latched |= PCNT_STATUS_L_LIM_LAT;
    if ((unit.conf0 & PCNT_THR_H_LIM_EN) !== 0 && unit.count === this.pcntLimitValue(unit, true)) latched |= PCNT_STATUS_H_LIM_LAT;
    if ((unit.conf0 & PCNT_THR_ZERO_EN) !== 0 && unit.count === 0) latched |= PCNT_STATUS_ZERO_LAT;
    if (unit.count === 0 && oldCount > 0) unit.status = (unit.status & ~PCNT_MODE_MASK) | 0;
    else if (unit.count === 0 && oldCount < 0) unit.status = (unit.status & ~PCNT_MODE_MASK) | 1;
    else if (oldCount < 0 && unit.count > 0) unit.status = (unit.status & ~PCNT_MODE_MASK) | 2;
    else if (oldCount > 0 && unit.count < 0) unit.status = (unit.status & ~PCNT_MODE_MASK) | 3;
    if (latched !== 0) {
      unit.status |= latched;
      this.pcntIntRaw |= 1 << unitIndex;
      this.recomputeIrq();
    }
  }

  // Glitch filter (U0_CONF0 FILTER_EN/FILTER_THRES): confirm a deferred edge once its
  // candidate level has held for >= FILTER_THRES APB cycles. Pulses narrower than the
  // threshold never reach pcntApplyEdgeAction, so both of their edges are dropped.
  private pcntFlushPending(unitIndex: number, channel: number): void {
    const unit = this.pcntUnits[unitIndex];
    if (unit === undefined) return;
    const pending = unit.pendingPulse[channel];
    if (pending == null) return; // narrows out both null and undefined
    if ((unit.conf0 & PCNT_FILTER_EN) === 0) {
      unit.pendingPulse[channel] = null;
      return;
    }
    const thres = unit.conf0 & PCNT_FILTER_THRES_MASK;
    if (this.cpu.cycles - (unit.pendingPulseCycle[channel] ?? 0) >= thres) {
      const confirmed: DigitalLevel = pending;
      this.pcntApplyEdgeAction(unitIndex, channel, confirmed === 1);
      unit.lastPulse[channel] = confirmed;
      unit.pendingPulse[channel] = null;
    }
  }

  private capturePcntInputs(countEdges = true): void {
    for (let unitIndex = 0; unitIndex < PCNT_UNITS; unitIndex++) {
      const unit = this.pcntUnits[unitIndex];
      if (unit === undefined) continue;
      const filtered = (unit.conf0 & PCNT_FILTER_EN) !== 0;
      for (let channel = 0; channel < PCNT_CHANNELS; channel++) {
        const pulse = this.pcntMatrixLevel(this.pcntSignalIndex(unitIndex, channel));
        const ctrl = this.pcntMatrixLevel(this.pcntCtrlIndex(unitIndex, channel));
        const last = unit.lastPulse[channel];
        unit.lastCtrl[channel] = ctrl;
        if (pulse === null) {
          unit.lastPulse[channel] = null;
          unit.pendingPulse[channel] = null;
          continue;
        }
        if (!countEdges || last === null) {
          unit.lastPulse[channel] = pulse;
          unit.pendingPulse[channel] = null;
          continue;
        }
        if (filtered) {
          // First confirm any candidate that has aged past the threshold, then re-evaluate.
          this.pcntFlushPending(unitIndex, channel);
          const confirmed = unit.lastPulse[channel];
          if (pulse === confirmed) {
            unit.pendingPulse[channel] = null; // returned to the confirmed level: candidate was a glitch
          } else if (unit.pendingPulse[channel] !== pulse) {
            unit.pendingPulse[channel] = pulse; // start a new candidate, timestamped now
            unit.pendingPulseCycle[channel] = this.cpu.cycles;
          }
          continue;
        }
        if (pulse !== last) this.pcntApplyEdgeAction(unitIndex, channel, pulse === 1);
        unit.lastPulse[channel] = pulse;
      }
    }
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
    return this.ledcSignalLevel(signal) ?? this.rmtSignalLevel(signal) ?? this.mcpwmSignalLevel(signal);
  }

  /** Re-derive the interrupt matrix's output and drive the CPU's
   *  level-triggered external lines. Called whenever any modeled
   *  interrupt source's inputs change. */
  private recomputeIrq(): void {
    // Level-type GPIO pins re-assert their STATUS bit while the level
    // holds — W1TC alone cannot silence them, exactly like hardware.
    for (let gpio = 0; gpio < PIN_COUNT; gpio++) {
      const type = ((this.pinCfg[gpio] ?? 0) >>> GPIO_PIN_INT_TYPE_SHIFT) & 7;
      if (type !== GPIO_INT_LOW_LEVEL && type !== GPIO_INT_HIGH_LEVEL) continue;
      const bank = gpio >> 5;
      const bit = 1 << (gpio & 31);
      const high = ((this.inLevels[bank] ?? 0) & bit) !== 0;
      if (type === GPIO_INT_LOW_LEVEL ? !high : high) {
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
    const uart1Pending = (this.uart1IntRaw() & this.uart1IntEna) !== 0;
    const uart2Pending = (this.uart2IntRaw() & this.uart2IntEna) !== 0;
    const ledcPending = (this.ledcIntRaw & this.ledcIntEna) !== 0;
    const rmtPending = (this.rmtIntRaw & this.rmtIntEna) !== 0;
    const pcntPending = (this.pcntIntRaw & this.pcntIntEna) !== 0;
    const mcpwm0Pending = ((this.mcpwm[0]?.intRaw ?? 0) & (this.mcpwm[0]?.intEna ?? 0)) !== 0;
    const mcpwm1Pending = ((this.mcpwm[1]?.intRaw ?? 0) & (this.mcpwm[1]?.intEna ?? 0)) !== 0;
    const twaiPending = (this.twai.interrupt & this.twai.interruptEna) !== 0;
    const i2c0Pending = ((this.i2c[0]?.intRaw ?? 0) & (this.i2c[0]?.intEna ?? 0)) !== 0;
    const i2c1Pending = ((this.i2c[1]?.intRaw ?? 0) & (this.i2c[1]?.intEna ?? 0)) !== 0;
    const spi2Pending = ((this.spi[0]?.intRaw ?? 0) & (this.spi[0]?.intEna ?? 0)) !== 0;
    const spi3Pending = ((this.spi[1]?.intRaw ?? 0) & (this.spi[1]?.intEna ?? 0)) !== 0;
    const apbAdcPending = (this.apbSaradcIntRaw & this.apbSaradcIntEna) !== 0;
    const rtcPending = (this.rtcIntRaw & this.rtcIntEna) !== 0;
    const masks: InterruptMapPair = [0, 0];
    const raise = (maps: InterruptMapPair): void => {
      masks[0] |= 1 << (maps[0] & 31);
      masks[1] |= 1 << (maps[1] & 31);
    };
    if (gpioPending) raise(this.gpioIntMaps);
    if (uartPending) raise(this.uartIntMaps);
    if (uart1Pending) raise(this.uart1IntMaps);
    if (uart2Pending) raise(this.uart2IntMaps);
    if (ledcPending) raise(this.ledcIntMaps);
    if (rmtPending) raise(this.rmtIntMaps);
    if (pcntPending) raise(this.pcntIntMaps);
    if (mcpwm0Pending) raise(this.mcpwm[0]?.maps ?? freshInterruptMapPair());
    if (mcpwm1Pending) raise(this.mcpwm[1]?.maps ?? freshInterruptMapPair());
    if (twaiPending) raise(this.twai.maps);
    if (i2c0Pending) raise(this.i2c[0]?.maps ?? freshInterruptMapPair());
    if (i2c1Pending) raise(this.i2c[1]?.maps ?? freshInterruptMapPair());
    if (spi2Pending) raise(this.spi[0]?.maps ?? freshInterruptMapPair());
    if (spi3Pending) raise(this.spi[1]?.maps ?? freshInterruptMapPair());
    if (apbAdcPending) raise(this.apbSaradcIntMaps);
    if (rtcPending) raise(this.rtcCoreIntMaps);
    if ((this.efuseIntRaw & this.efuseIntEna) !== 0) raise(this.efuseIntMaps);
    if ((this.shaIntRaw & this.shaIntEna) !== 0) raise(this.shaIntMaps);
    for (let n = 0; n < this.systimer.comps.length; n++) {
      const c = this.systimer.comps[n];
      if (c !== undefined && (this.systimer.intRaw & this.systimer.intEna & (1 << n)) !== 0) raise(c.maps);
    }
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
    this.capturePcntInputs();
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

  // One SHA-256 block compression (FIPS 180-4). `this.shaH` holds the running
  // digest state and the 16 big-endian words of `this.shaText` are the message
  // block; the new state is written back into `this.shaH`.
  private sha256Compress(): void {
    const w = new Array<number>(64);
    for (let t = 0; t < 16; t++) w[t] = (this.shaText[t] ?? 0) >>> 0;
    for (let t = 16; t < 64; t++) {
      const w15 = w[t - 15] ?? 0;
      const w2 = w[t - 2] ?? 0;
      const s0 = (sha256Rotr(w15, 7) ^ sha256Rotr(w15, 18) ^ (w15 >>> 3)) >>> 0;
      const s1 = (sha256Rotr(w2, 17) ^ sha256Rotr(w2, 19) ^ (w2 >>> 10)) >>> 0;
      w[t] = (((w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1) >>> 0) >>> 0;
    }
    let a = this.shaH[0] ?? 0;
    let b = this.shaH[1] ?? 0;
    let c = this.shaH[2] ?? 0;
    let d = this.shaH[3] ?? 0;
    let e = this.shaH[4] ?? 0;
    let f = this.shaH[5] ?? 0;
    let g = this.shaH[6] ?? 0;
    let h = this.shaH[7] ?? 0;
    for (let t = 0; t < 64; t++) {
      const big1 = (sha256Rotr(e, 6) ^ sha256Rotr(e, 11) ^ sha256Rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = ((h + big1 + ch + (SHA256_K[t] ?? 0) + (w[t] ?? 0)) >>> 0) >>> 0;
      const big0 = (sha256Rotr(a, 2) ^ sha256Rotr(a, 13) ^ sha256Rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = ((big0 + maj) >>> 0) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    this.shaH[0] = ((this.shaH[0] ?? 0) + a) >>> 0;
    this.shaH[1] = ((this.shaH[1] ?? 0) + b) >>> 0;
    this.shaH[2] = ((this.shaH[2] ?? 0) + c) >>> 0;
    this.shaH[3] = ((this.shaH[3] ?? 0) + d) >>> 0;
    this.shaH[4] = ((this.shaH[4] ?? 0) + e) >>> 0;
    this.shaH[5] = ((this.shaH[5] ?? 0) + f) >>> 0;
    this.shaH[6] = ((this.shaH[6] ?? 0) + g) >>> 0;
    this.shaH[7] = ((this.shaH[7] ?? 0) + h) >>> 0;
  }

  // One SHA-1 block compression (FIPS 180-4, 80 rounds onto a 5-word digest).
  private sha1Compress(): void {
    const w = new Array<number>(80);
    for (let t = 0; t < 16; t++) w[t] = (this.shaText[t] ?? 0) >>> 0;
    for (let t = 16; t < 80; t++) {
      w[t] = sha256Rotr(((w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0)) >>> 0, 31);
    }
    let a = this.shaH[0] ?? 0;
    let b = this.shaH[1] ?? 0;
    let c = this.shaH[2] ?? 0;
    let d = this.shaH[3] ?? 0;
    let e = this.shaH[4] ?? 0;
    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = ((b & c) ^ (~b & d)) >>> 0;
        k = 0x5a827999;
      } else if (t < 40) {
        f = (b ^ c ^ d) >>> 0;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = ((b & c) ^ (b & d) ^ (c & d)) >>> 0;
        k = 0x8f1bbcdc;
      } else {
        f = (b ^ c ^ d) >>> 0;
        k = 0xca62c1d6;
      }
      const temp = ((sha256Rotr(a, 27) + f + e + k + (w[t] ?? 0)) >>> 0) >>> 0;
      e = d;
      d = c;
      c = sha256Rotr(b, 2); // rotate-left 30 == rotate-right 2
      b = a;
      a = temp;
    }
    this.shaH[0] = ((this.shaH[0] ?? 0) + a) >>> 0;
    this.shaH[1] = ((this.shaH[1] ?? 0) + b) >>> 0;
    this.shaH[2] = ((this.shaH[2] ?? 0) + c) >>> 0;
    this.shaH[3] = ((this.shaH[3] ?? 0) + d) >>> 0;
    this.shaH[4] = ((this.shaH[4] ?? 0) + e) >>> 0;
  }

  // One SHA-512/384 block compression (FIPS 180-4, 80 rounds over 64-bit words).
  // shaH holds the 8 digest words as 16 hi/lo halves; shaText holds the 16 message
  // words as 32 hi/lo halves.
  private sha512Compress(): void {
    const hw = (i: number): Word64 => [(this.shaH[2 * i] ?? 0) >>> 0, (this.shaH[2 * i + 1] ?? 0) >>> 0];
    const w: Word64[] = new Array(80);
    for (let t = 0; t < 16; t++) w[t] = [(this.shaText[2 * t] ?? 0) >>> 0, (this.shaText[2 * t + 1] ?? 0) >>> 0];
    for (let t = 16; t < 80; t++) {
      const a15 = w[t - 15] ?? [0, 0];
      const a2 = w[t - 2] ?? [0, 0];
      const s0 = xor64(xor64(rotr64(a15, 1), rotr64(a15, 8)), shr64(a15, 7));
      const s1 = xor64(xor64(rotr64(a2, 19), rotr64(a2, 61)), shr64(a2, 6));
      w[t] = add64(add64(w[t - 16] ?? [0, 0], s0), add64(w[t - 7] ?? [0, 0], s1));
    }
    let a = hw(0);
    let b = hw(1);
    let c = hw(2);
    let d = hw(3);
    let e = hw(4);
    let f = hw(5);
    let g = hw(6);
    let h = hw(7);
    for (let t = 0; t < 80; t++) {
      const big1 = xor64(xor64(rotr64(e, 14), rotr64(e, 18)), rotr64(e, 41));
      const ch = xor64(and64(e, f), and64(not64(e), g));
      const t1 = add64(add64(add64(h, big1), add64(ch, SHA512_K[t] ?? [0, 0])), w[t] ?? [0, 0]);
      const big0 = xor64(xor64(rotr64(a, 28), rotr64(a, 34)), rotr64(a, 39));
      const maj = xor64(xor64(and64(a, b), and64(a, c)), and64(b, c));
      const t2 = add64(big0, maj);
      h = g;
      g = f;
      f = e;
      e = add64(d, t1);
      d = c;
      c = b;
      b = a;
      a = add64(t1, t2);
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) {
      const sum = add64(hw(i), next[i] ?? [0, 0]);
      this.shaH[2 * i] = sum[0];
      this.shaH[2 * i + 1] = sum[1];
    }
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
    if (addr >= AES_BASE && addr < AES_BASE + 0x1000) {
      const off = addr - AES_BASE;
      if (off === AES_STATE) return this.aesState >>> 0;
      if (off >= AES_TEXT_OUT_BASE && off < AES_TEXT_OUT_BASE + 4 * 4 && (off & 3) === 0) {
        return (this.aesOut[(off - AES_TEXT_OUT_BASE) >> 2] ?? 0) >>> 0;
      }
      if (off >= AES_TEXT_IN_BASE && off < AES_TEXT_IN_BASE + 4 * 4 && (off & 3) === 0) {
        return (this.aesIn[(off - AES_TEXT_IN_BASE) >> 2] ?? 0) >>> 0;
      }
      if (off >= AES_KEY_BASE && off < AES_KEY_BASE + 8 * 4 && (off & 3) === 0) {
        return (this.aesKey[(off - AES_KEY_BASE) >> 2] ?? 0) >>> 0;
      }
      if (off === AES_MODE) return this.aesMode >>> 0;
      return 0;
    }
    if (addr >= SHA_BASE && addr < SHA_BASE + 0x1000) {
      const off = addr - SHA_BASE;
      if (off === SHA_BUSY) return 0; // compression is instantaneous in the model
      if (off === SHA_INT_ENA) return this.shaIntEna >>> 0;
      if (off >= SHA_H_BASE && off < SHA_H_BASE + 16 * 4 && (off & 3) === 0) {
        return (this.shaH[(off - SHA_H_BASE) >> 2] ?? 0) >>> 0;
      }
      if (off >= SHA_TEXT_BASE && off < SHA_TEXT_BASE + 32 * 4 && (off & 3) === 0) {
        return (this.shaText[(off - SHA_TEXT_BASE) >> 2] ?? 0) >>> 0;
      }
      if (off === SHA_MODE) return this.shaMode >>> 0;
      return 0;
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
        const rx = Math.min(this.rxQueue.length, UART_RXFIFO_MASK);
        return rx; // TXFIFO_CNT [25:16] stays 0 — the modeled tx FIFO never fills
      }
      if (off === UART_INT_RAW) return this.uartIntRaw();
      if (off === UART_INT_ST) return this.uartIntRaw() & this.uartIntEna;
      if (off === UART_INT_ENA) return this.uartIntEna;
      if (off === UART_CONF0) return this.uartConf0 >>> 0;
      if (off === UART_CONF1) return this.uartRxThrhd;
      if (off === UART_SLEEP_CONF) return this.uartWakeActiveThreshold;
      return 0;
    }
    if (addr >= UART1_BASE && addr < UART1_BASE + 0x1000) {
      const off = addr - UART1_BASE;
      if (off === UART_FIFO) {
        const byte = this.uart1RxQueue.shift() ?? 0;
        this.recomputeIrq(); // draining may deassert RXFIFO_FULL
        return byte;
      }
      if (off === UART_STATUS) {
        const rx = Math.min(this.uart1RxQueue.length, UART_RXFIFO_MASK);
        return rx; // TXFIFO_CNT [25:16] stays 0 — the modeled tx FIFO never fills
      }
      if (off === UART_INT_RAW) return this.uart1IntRaw();
      if (off === UART_INT_ST) return this.uart1IntRaw() & this.uart1IntEna;
      if (off === UART_INT_ENA) return this.uart1IntEna;
      if (off === UART_CONF0) return this.uart1Conf0 >>> 0;
      if (off === UART_CONF1) return this.uart1RxThrhd;
      if (off === UART_SLEEP_CONF) return this.uart1WakeActiveThreshold;
      return 0;
    }
    if (addr >= UART2_BASE && addr < UART2_BASE + 0x1000) {
      const off = addr - UART2_BASE;
      if (off === UART_FIFO) {
        const byte = this.uart2RxQueue.shift() ?? 0;
        this.recomputeIrq(); // draining may deassert RXFIFO_FULL
        return byte;
      }
      if (off === UART_STATUS) {
        const rx = Math.min(this.uart2RxQueue.length, UART_RXFIFO_MASK);
        return rx;
      }
      if (off === UART_INT_RAW) return this.uart2IntRaw();
      if (off === UART_INT_ST) return this.uart2IntRaw() & this.uart2IntEna;
      if (off === UART_INT_ENA) return this.uart2IntEna;
      if (off === UART_CONF0) return this.uart2Conf0 >>> 0;
      if (off === UART_CONF1) return this.uart2RxThrhd;
      if (off === UART_SLEEP_CONF) return this.uart2WakeActiveThreshold;
      return 0;
    }
    const i2c = this.i2cForAddress(addr);
    if (i2c !== null) return this.i2cRead(i2c.ctrl, i2c.off);
    const spi = this.spiForAddress(addr);
    if (spi !== null) return this.spiRead(spi.ctrl, spi.off);
    const mcpwm = this.mcpwmForAddress(addr);
    if (mcpwm !== null) return this.mcpwmRead(mcpwm.group, mcpwm.off);
    const twai = this.twaiForAddress(addr);
    if (twai !== null) return this.twaiRead(twai);
    if (addr >= SYSTIMER_BASE && addr < SYSTIMER_BASE + SYSTIMER_BLOCK_BYTES) return this.systimerRead(addr - SYSTIMER_BASE);
    if (addr >= INTMTX_BASE && addr < INTMTX_BASE + 0x1000) {
      const off = addr - INTMTX_BASE;
      const core = (off >= INTMTX_CORE1_OFFSET ? 1 : 0) as InterruptCore;
      const sourceOff = off - core * INTMTX_CORE1_OFFSET;
      if (sourceOff === INTMTX_GPIO_MAP) return this.gpioIntMaps[core];
      if (sourceOff === INTMTX_UART_MAP) return this.uartIntMaps[core];
      if (sourceOff === INTMTX_UART1_MAP) return this.uart1IntMaps[core];
      if (sourceOff === INTMTX_UART2_MAP) return this.uart2IntMaps[core];
      if (sourceOff === INTMTX_PWM0_MAP) return this.mcpwm[0]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      if (sourceOff === INTMTX_PWM1_MAP) return this.mcpwm[1]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      if (sourceOff === INTMTX_LEDC_MAP) return this.ledcIntMaps[core];
      if (sourceOff === INTMTX_CAN_MAP) return this.twai.maps[core];
      if (sourceOff === INTMTX_EFUSE_MAP) return this.efuseIntMaps[core];
      if (sourceOff === INTMTX_SHA_MAP) return this.shaIntMaps[core];
      if (sourceOff === INTMTX_RTC_CORE_MAP) return this.rtcCoreIntMaps[core];
      if (sourceOff === INTMTX_RMT_MAP) return this.rmtIntMaps[core];
      if (sourceOff === INTMTX_PCNT_MAP) return this.pcntIntMaps[core];
      if (sourceOff === INTMTX_I2C_EXT0_MAP) return this.i2c[0]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      if (sourceOff === INTMTX_I2C_EXT1_MAP) return this.i2c[1]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      if (sourceOff === INTMTX_SPI2_DMA_MAP) return this.spi[0]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      if (sourceOff === INTMTX_SPI3_DMA_MAP) return this.spi[1]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      if (sourceOff >= INTMTX_TG_MAPS && sourceOff < INTMTX_TG_MAPS + 24 && (sourceOff & 3) === 0) {
        const idx = (sourceOff - INTMTX_TG_MAPS) >> 2; // group-major [t0,t1,wdt]
        return this.timg[idx < 3 ? 0 : 1]?.maps[core][idx % 3] ?? INTMTX_DEFAULT_MAP;
      }
      if (sourceOff === INTMTX_APB_ADC_MAP) return this.apbSaradcIntMaps[core];
      if (
        sourceOff >= INTMTX_SYSTIMER_TARGET0_MAP &&
        sourceOff <= INTMTX_SYSTIMER_TARGET0_MAP + 8 &&
        ((sourceOff - INTMTX_SYSTIMER_TARGET0_MAP) & 3) === 0
      ) {
        return this.systimer.comps[(sourceOff - INTMTX_SYSTIMER_TARGET0_MAP) >> 2]?.maps[core] ?? INTMTX_DEFAULT_MAP;
      }
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
    if (addr >= PCNT_BASE && addr < PCNT_BASE + 0x1000) {
      const off = addr - PCNT_BASE;
      if (off < PCNT_U_CNT && off % PCNT_UNIT_CONF_STRIDE < 0x0c && (off & 3) === 0) {
        const unit = this.pcntUnits[Math.floor(off / PCNT_UNIT_CONF_STRIDE)];
        const toff = off % PCNT_UNIT_CONF_STRIDE;
        if (unit === undefined) return 0;
        if (toff === PCNT_U_CONF0) return unit.conf0 >>> 0;
        if (toff === PCNT_U_CONF1) return unit.conf1 >>> 0;
        if (toff === PCNT_U_CONF2) return unit.conf2 >>> 0;
        return 0;
      }
      if (off >= PCNT_U_CNT && off < PCNT_U_CNT + PCNT_UNITS * PCNT_U_CNT_STRIDE && (off & 3) === 0) {
        const unitIndex = (off - PCNT_U_CNT) >> 2;
        // Confirm any glitch-filter candidate that has now held >= FILTER_THRES cycles,
        // so a long pulse counts before the guest observes the counter mid-pulse.
        for (let ch = 0; ch < PCNT_CHANNELS; ch++) this.pcntFlushPending(unitIndex, ch);
        const unit = this.pcntUnits[unitIndex];
        return unit === undefined ? 0 : unit.count & 0xffff;
      }
      if (off === PCNT_INT_RAW) return this.pcntIntRaw >>> 0;
      if (off === PCNT_INT_ST) return (this.pcntIntRaw & this.pcntIntEna) >>> 0;
      if (off === PCNT_INT_ENA) return this.pcntIntEna >>> 0;
      if (off === PCNT_INT_CLR) return 0;
      if (off >= PCNT_U_STATUS && off < PCNT_U_STATUS + PCNT_UNITS * PCNT_U_STATUS_STRIDE && (off & 3) === 0) {
        return this.pcntUnits[(off - PCNT_U_STATUS) >> 2]?.status ?? 0;
      }
      if (off === PCNT_CTRL) return this.pcntCtrl >>> 0;
      if (off === PCNT_DATE) return PCNT_DATE_RESET;
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
      if (off === SENS_SAR_READER1_CTRL) return this.sarReader1Ctrl >>> 0;
      if (off === SENS_SAR_MEAS1_CTRL2) {
        let v = this.meas1Ctrl2 & ~(MEAS1_DONE_SAR | 0xffff);
        if (this.adcDone) v |= MEAS1_DONE_SAR | (this.adcData & 0xfff);
        return v >>> 0;
      }
      if (off === SENS_SAR_READER2_CTRL) return this.sarReader2Ctrl >>> 0;
      if (off === SENS_SAR_MEAS2_CTRL2) {
        let v = this.meas2Ctrl2 & ~(MEAS2_DONE_SAR | 0xffff);
        if (this.adc2Done) v |= MEAS2_DONE_SAR | (this.adc2Data & 0xfff);
        return v >>> 0;
      }
      if (off === SENS_SAR_TSENS_CTRL) return this.tsensCtrl >>> 0;
      if (off === SENS_SAR_TSENS_CTRL2) return this.tsensCtrl2 >>> 0;
      if (off === SENS_SAR_COCPU_STATE) return this.cocpuTrap ? SENS_COCPU_TRAP : 0;
      if (off === SENS_SAR_TOUCH_CONF) {
        let v = this.sensTouchConf & ~(SENS_TOUCH_DENOISE_END | SENS_TOUCH_UNIT_END | SENS_TOUCH_STATUS_CLR);
        if (this.touchMeasDone) v |= SENS_TOUCH_DENOISE_END | SENS_TOUCH_UNIT_END;
        return v >>> 0;
      }
      if (off >= SENS_SAR_TOUCH_THRES1 && off < SENS_SAR_TOUCH_THRES1 + SENS_TOUCH_THRES_COUNT * 4 && (off & 3) === 0) {
        return (this.touchThresholds[(off - SENS_SAR_TOUCH_THRES1) >> 2] ?? 0) >>> 0;
      }
      if (off === SENS_SAR_TOUCH_CHN_ST) {
        return ((this.touchMeasDone ? SENS_TOUCH_MEAS_DONE : 0) | (this.touchActiveMask & TOUCH_CHANNEL_MASK)) >>> 0;
      }
      if (off >= SENS_SAR_TOUCH_STATUS0 && off < SENS_SAR_TOUCH_STATUS0 + TOUCH_CHANNEL_COUNT * SENS_SAR_TOUCH_STATUS_STRIDE && (off & 3) === 0) {
        const channel = (off - SENS_SAR_TOUCH_STATUS0) / SENS_SAR_TOUCH_STATUS_STRIDE;
        const data = this.touchData[channel] ?? 0;
        if (channel === 0) return ((this.touchScanCurr << SENS_TOUCH_SCAN_CURR_SHIFT) | (data & SENS_TOUCH_DATA_MASK)) >>> 0;
        return ((((this.touchDebounce[channel] ?? 0) & SENS_TOUCH_DEBOUNCE_MASK) << SENS_TOUCH_DEBOUNCE_SHIFT) | (data & SENS_TOUCH_DATA_MASK)) >>> 0;
      }
      if (off === SENS_SAR_TOUCH_SLP_STATUS) {
        const sleepPad = (this.rtcTouchSlpThres >>> RTC_TOUCH_SLP_PAD_SHIFT) & RTC_TOUCH_SLP_PAD_MASK;
        const dataSel = (this.sensTouchConf & SENS_TOUCH_DATA_SEL_MASK) >>> SENS_TOUCH_DATA_SEL_SHIFT;
        // ESP-IDF's LL uses SLP_STATUS only for benchmark/smooth; raw
        // sleep-pad data is read from sar_touch_status[touch_num - 1].
        const data = dataSel >= SENS_TOUCH_DATA_SEL_BENCHMARK ? (this.touchData[sleepPad] ?? 0) : 0;
        return ((((this.touchDebounce[sleepPad] ?? 0) & SENS_TOUCH_DEBOUNCE_MASK) << SENS_TOUCH_DEBOUNCE_SHIFT) | (data & SENS_TOUCH_DATA_MASK)) >>> 0;
      }
      if (off === SENS_SAR_TOUCH_APPR_STATUS) {
        return (
          ((this.touchSleepApproachCount & SENS_TOUCH_APPROACH_COUNT_MASK) << 24) |
          ((this.touchApproachCounts[0] ?? 0) << 16) |
          ((this.touchApproachCounts[1] ?? 0) << 8) |
          (this.touchApproachCounts[2] ?? 0)
        ) >>> 0;
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
    if (addr >= RTCIO_BASE && addr < RTCIO_END) {
      const off = addr - RTCIO_BASE;
      if (off === RTC_IO_EXT_WAKEUP0) return this.rtcIoExtWakeup0 >>> 0;
      throw new Error(
        `read of unmodeled RTC_IO register 0x${addr.toString(16)} — this core models only ` +
          `EXT_WAKEUP0(+0xdc); a fabricated 0 here would lie`,
      );
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
      if (off === RTC_ANA_CONF) return this.rtcAnaConf >>> 0;
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
      if (off === RTC_EXT_WAKEUP_CONF) return this.rtcExtWakeupConf >>> 0;
      if (off === RTC_SLP_REJECT_CONF) return this.rtcSlpRejectConf >>> 0;
      if (off === RTC_CLK_CONF) return this.rtcClkConf >>> 0;
      if (off === RTC_SLOW_CLK_CONF) return this.rtcSlowClkConf >>> 0;
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
      if (off === RTC_ULP_CP_TIMER) return this.rtcUlpCpTimer >>> 0;
      if (off === RTC_ULP_CP_CTRL) return (this.rtcUlpCpCtrl & ~RTC_ULP_CP_MEM_OFFST_CLR) >>> 0;
      if (off === RTC_COCPU_CTRL) return (this.rtcCocpuCtrl & ~RTC_COCPU_SW_INT_TRIGGER) >>> 0;
      if (off === RTC_LOW_POWER_ST) return this.rtcLowPowerStatus();
      if (off === RTC_EXT_WAKEUP1) return this.rtcExtWakeup1 >>> 0;
      if (off === RTC_EXT_WAKEUP1_STATUS) return this.rtcExtWakeup1Status >>> 0;
      if (off === RTC_BROWN_OUT) return (this.rtcBrownOut & ~RTC_BROWN_OUT_CNT_CLR) >>> 0;
      if (off === RTC_XTAL32K_CONF) return this.rtcXtal32kConf >>> 0;
      if (off === RTC_PG_CTRL) return this.rtcPgCtrl >>> 0;
      if (off === RTC_FIB_SEL) return this.rtcFibSel >>> 0;
      if (off === RTC_TOUCH_CTRL1) return this.rtcTouchCtrl1 >>> 0;
      if (off === RTC_TOUCH_CTRL2) return this.rtcTouchCtrl2 >>> 0;
      if (off === RTC_TOUCH_SCAN_CTRL) return this.rtcTouchScanCtrl >>> 0;
      if (off === RTC_TOUCH_SLP_THRES) return this.rtcTouchSlpThres >>> 0;
      if (off === RTC_TOUCH_APPROACH) return this.rtcTouchApproach >>> 0;
      if (off === RTC_TOUCH_FILTER_CTRL) return this.rtcTouchFilterCtrl >>> 0;
      if (off === RTC_TOUCH_TIMEOUT_CTRL) return this.rtcTouchTimeoutCtrl >>> 0;
      if (off === RTC_TOUCH_DAC) return this.rtcTouchDac >>> 0;
      if (off === RTC_TOUCH_DAC1) return this.rtcTouchDac1 >>> 0;
      if (off === RTC_SLP_REJECT_CAUSE) return this.rtcRejectCause >>> 0;
      if (off === RTC_SLP_WAKEUP_CAUSE) return this.rtcWakeupCause >>> 0;
      if (off === RTC_ULP_CP_TIMER_1) return this.rtcUlpCpTimer1 >>> 0;
      if (off === RTC_INT_ENA_W1TS || off === RTC_INT_ENA_W1TC) return 0;
      throw new Error(
        `read of unmodeled RTC_CNTL register 0x${addr.toString(16)} — this core models only ` +
          `OPTIONS0(+0x0), SLP_TIMER0/1(+0x4/+0x8), TIME_UPDATE(+0xc), TIME_LOW0/HIGH0(+0x10/0x14), ` +
          `STATE0(+0x18), ANA_CONF(+0x34), RESET_STATE(+0x38), WAKEUP_STATE(+0x3c), INT_* (+0x40..+0x4c), ` +
          `EXT_XTL_CONF(+0x60), SLP_REJECT_CONF(+0x68), CLK_CONF/SLOW_CLK_CONF(+0x74/+0x78), ` +
          `the RWDT block (+0x98..+0xb0), SWD(+0xb4/+0xb8), SW_CPU_STALL(+0xbc), LOW_POWER_ST(+0xd0), ` +
          `ULP_CP_TIMER/CTRL(+0xfc/+0x100), COCPU_CTRL(+0x104), ` +
          `BROWN_OUT(+0xe8), XTAL32K_CONF(+0xf8), PG_CTRL/FIB_SEL(+0x144/+0x148), ` +
          `TOUCH_CTRL1/2(+0x108/+0x10c), TOUCH_SCAN/SLP/APPROACH/FILTER/TIMEOUT(+0x110..+0x124), TOUCH_DAC/DAC1(+0x14c/+0x150), ` +
          `sleep reject/wakeup causes (+0x128/+0x130), ULP_CP_TIMER_1(+0x134); ` +
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
    if (addr >= AES_BASE && addr < AES_BASE + 0x1000) {
      const off = addr - AES_BASE;
      const v = value >>> 0;
      if (off >= AES_KEY_BASE && off < AES_KEY_BASE + 8 * 4 && (off & 3) === 0) {
        this.aesKey[(off - AES_KEY_BASE) >> 2] = v;
      } else if (off >= AES_TEXT_IN_BASE && off < AES_TEXT_IN_BASE + 4 * 4 && (off & 3) === 0) {
        this.aesIn[(off - AES_TEXT_IN_BASE) >> 2] = v;
      } else if (off === AES_MODE) {
        this.aesMode = v;
      } else if (off === AES_TRIGGER) {
        if ((v & 1) !== 0) {
          // Encrypt modes: 0 = AES-128, 1 = AES-192, 2 = AES-256.
          const nk = this.aesMode === 0 ? 4 : this.aesMode === 1 ? 6 : this.aesMode === 2 ? 8 : 0;
          if (nk !== 0) {
            const keyBytes: number[] = [];
            for (let w = 0; w < nk; w++) {
              const k = this.aesKey[w] ?? 0;
              keyBytes.push((k >>> 24) & 0xff, (k >>> 16) & 0xff, (k >>> 8) & 0xff, k & 0xff);
            }
            const inBytes: number[] = [];
            for (let w = 0; w < 4; w++) {
              const t = this.aesIn[w] ?? 0;
              inBytes.push((t >>> 24) & 0xff, (t >>> 16) & 0xff, (t >>> 8) & 0xff, t & 0xff);
            }
            const out = aesEncryptBlock(inBytes, aesExpandKey(keyBytes, nk), nk + 6);
            for (let w = 0; w < 4; w++) {
              this.aesOut[w] =
                (((out[4 * w] ?? 0) << 24) | ((out[4 * w + 1] ?? 0) << 16) | ((out[4 * w + 2] ?? 0) << 8) | (out[4 * w + 3] ?? 0)) >>> 0;
            }
          }
          this.aesState = AES_STATE_DONE;
        }
      }
      return;
    }
    if (addr >= SHA_BASE && addr < SHA_BASE + 0x1000) {
      const off = addr - SHA_BASE;
      const v = value >>> 0;
      if (off >= SHA_TEXT_BASE && off < SHA_TEXT_BASE + 32 * 4 && (off & 3) === 0) {
        this.shaText[(off - SHA_TEXT_BASE) >> 2] = v;
      } else if (off === SHA_MODE) {
        this.shaMode = v;
      } else if (off === SHA_START) {
        // First block: load the mode's initial vector, then run its compression.
        if (this.shaMode === SHA_MODE_SHA1) {
          this.shaH = SHA1_IV.slice();
          this.sha1Compress();
        } else if (this.shaMode === SHA_MODE_SHA224) {
          this.shaH = SHA224_IV.slice();
          this.sha256Compress();
        } else if (this.shaMode === SHA_MODE_SHA256) {
          this.shaH = SHA256_IV.slice();
          this.sha256Compress();
        } else if (this.shaMode === SHA_MODE_SHA384) {
          this.shaH = SHA384_IV.flatMap((p) => [p[0], p[1]]);
          this.sha512Compress();
        } else if (this.shaMode === SHA_MODE_SHA512) {
          this.shaH = SHA512_IV.flatMap((p) => [p[0], p[1]]);
          this.sha512Compress();
        }
        this.shaIntRaw = 1; // block complete asserts the (level) done interrupt
        this.recomputeIrq();
      } else if (off === SHA_CONTINUE) {
        // Subsequent block: accumulate onto the running digest state.
        if (this.shaMode === SHA_MODE_SHA1) this.sha1Compress();
        else if (this.shaMode === SHA_MODE_SHA224 || this.shaMode === SHA_MODE_SHA256) this.sha256Compress();
        else if (this.shaMode === SHA_MODE_SHA384 || this.shaMode === SHA_MODE_SHA512) this.sha512Compress();
        this.shaIntRaw = 1;
        this.recomputeIrq();
      } else if (off === SHA_INT_ENA) {
        this.shaIntEna = v;
        this.recomputeIrq();
      } else if (off === SHA_CLEAR_IRQ) {
        this.shaIntRaw = 0;
        this.recomputeIrq();
      }
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
      } else if (off >= GPIO_FUNC0_IN_SEL_CFG && off < GPIO_FUNC_IN_SEL_LAST && (off & 3) === 0) {
        this.gpioFuncIn[(off - GPIO_FUNC0_IN_SEL_CFG) >> 2] = v & 0xff;
        this.captureRmtRxInputs();
        this.capturePcntInputs(false);
      } else if (off >= GPIO_FUNC0_OUT_SEL_CFG && off < GPIO_FUNC0_OUT_SEL_CFG + 4 * PIN_COUNT && (off & 3) === 0) {
        this.gpioFuncOut[(off - GPIO_FUNC0_OUT_SEL_CFG) >> 2] = (v & GPIO_FUNC_OUT_CFG_MASK) | 0;
      }
      this.syncPins();
      this.updateRtcGpioWakeup();
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
        if ((value & UART_WAKEUP_INT) !== 0) {
          this.uartWakeup = false;
          this.uartWakeEdgeCount = 0;
        }
      } else if (off === UART_CONF1) {
        this.uartRxThrhd = value & UART_RXFIFO_MASK;
      } else if (off === UART_CONF0) {
        this.uartConf0 = value >>> 0;
      } else if (off === UART_SLEEP_CONF) {
        this.uartWakeActiveThreshold = value & UART_RXFIFO_MASK;
      }
      this.recomputeIrq();
      return;
    }
    if (addr >= UART1_BASE && addr < UART1_BASE + 0x1000) {
      const off = addr - UART1_BASE;
      if (off === UART_FIFO) {
        this.txBuffer.push(value & 0xff);
        this.uart1TxDone = true; // tx is instantaneous in this model
      } else if (off === UART_INT_ENA) {
        this.uart1IntEna = value >>> 0;
      } else if (off === UART_INT_CLR) {
        if ((value & UART_TX_DONE_INT) !== 0) this.uart1TxDone = false;
        if ((value & UART_WAKEUP_INT) !== 0) {
          this.uart1Wakeup = false;
          this.uart1WakeEdgeCount = 0;
        }
      } else if (off === UART_CONF1) {
        this.uart1RxThrhd = value & UART_RXFIFO_MASK;
      } else if (off === UART_CONF0) {
        this.uart1Conf0 = value >>> 0;
      } else if (off === UART_SLEEP_CONF) {
        this.uart1WakeActiveThreshold = value & UART_RXFIFO_MASK;
      }
      this.recomputeIrq();
      return;
    }
    if (addr >= UART2_BASE && addr < UART2_BASE + 0x1000) {
      const off = addr - UART2_BASE;
      if (off === UART_FIFO) {
        this.txBuffer.push(value & 0xff);
        this.uart2TxDone = true; // tx is instantaneous in this model
      } else if (off === UART_INT_ENA) {
        this.uart2IntEna = value >>> 0;
      } else if (off === UART_INT_CLR) {
        if ((value & UART_TX_DONE_INT) !== 0) this.uart2TxDone = false;
      } else if (off === UART_CONF1) {
        this.uart2RxThrhd = value & UART_RXFIFO_MASK;
      } else if (off === UART_CONF0) {
        this.uart2Conf0 = value >>> 0;
      } else if (off === UART_SLEEP_CONF) {
        this.uart2WakeActiveThreshold = value & UART_RXFIFO_MASK;
      }
      this.recomputeIrq();
      return;
    }
    const i2c = this.i2cForAddress(addr);
    if (i2c !== null) {
      this.i2cWrite(i2c.ctrl, i2c.off, value);
      return;
    }
    const spi = this.spiForAddress(addr);
    if (spi !== null) {
      this.spiWrite(spi.ctrl, spi.off, value);
      return;
    }
    const mcpwm = this.mcpwmForAddress(addr);
    if (mcpwm !== null) {
      this.mcpwmWrite(mcpwm.group, mcpwm.off, value);
      return;
    }
    const twai = this.twaiForAddress(addr);
    if (twai !== null) {
      this.twaiWrite(twai, value);
      return;
    }
    if (addr >= SYSTIMER_BASE && addr < SYSTIMER_BASE + SYSTIMER_BLOCK_BYTES) {
      this.systimerWrite(addr - SYSTIMER_BASE, value);
      return;
    }
    if (addr >= INTMTX_BASE && addr < INTMTX_BASE + 0x1000) {
      const off = addr - INTMTX_BASE;
      const core = (off >= INTMTX_CORE1_OFFSET ? 1 : 0) as InterruptCore;
      const sourceOff = off - core * INTMTX_CORE1_OFFSET;
      if (sourceOff === INTMTX_GPIO_MAP) this.gpioIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_UART_MAP) this.uartIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_UART1_MAP) this.uart1IntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_UART2_MAP) this.uart2IntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_PWM0_MAP) {
        const group = this.mcpwm[0];
        if (group !== undefined) group.maps[core] = value & 0x1f;
      } else if (sourceOff === INTMTX_PWM1_MAP) {
        const group = this.mcpwm[1];
        if (group !== undefined) group.maps[core] = value & 0x1f;
      } else if (sourceOff === INTMTX_LEDC_MAP) this.ledcIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_CAN_MAP) this.twai.maps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_EFUSE_MAP) {
        this.efuseIntMaps[core] = value & 0x1f;
        this.recomputeIrq();
      } else if (sourceOff === INTMTX_SHA_MAP) {
        this.shaIntMaps[core] = value & 0x1f;
        this.recomputeIrq();
      } else if (sourceOff === INTMTX_RTC_CORE_MAP) this.rtcCoreIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_RMT_MAP) this.rmtIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_PCNT_MAP) this.pcntIntMaps[core] = value & 0x1f;
      else if (sourceOff === INTMTX_I2C_EXT0_MAP) {
        const ctrl = this.i2c[0];
        if (ctrl !== undefined) ctrl.maps[core] = value & 0x1f;
      } else if (sourceOff === INTMTX_I2C_EXT1_MAP) {
        const ctrl = this.i2c[1];
        if (ctrl !== undefined) ctrl.maps[core] = value & 0x1f;
      } else if (sourceOff === INTMTX_SPI2_DMA_MAP) {
        const ctrl = this.spi[0];
        if (ctrl !== undefined) ctrl.maps[core] = value & 0x1f;
      } else if (sourceOff === INTMTX_SPI3_DMA_MAP) {
        const ctrl = this.spi[1];
        if (ctrl !== undefined) ctrl.maps[core] = value & 0x1f;
      }
      else if (sourceOff >= INTMTX_TG_MAPS && sourceOff < INTMTX_TG_MAPS + 24 && (sourceOff & 3) === 0) {
        const idx = (sourceOff - INTMTX_TG_MAPS) >> 2;
        const grp = this.timg[idx < 3 ? 0 : 1];
        if (grp !== undefined) grp.maps[core][idx % 3] = value & 0x1f;
      } else if (sourceOff === INTMTX_APB_ADC_MAP) {
        this.apbSaradcIntMaps[core] = value & 0x1f;
      } else if (
        sourceOff >= INTMTX_SYSTIMER_TARGET0_MAP &&
        sourceOff <= INTMTX_SYSTIMER_TARGET0_MAP + 8 &&
        ((sourceOff - INTMTX_SYSTIMER_TARGET0_MAP) & 3) === 0
      ) {
        const c = this.systimer.comps[(sourceOff - INTMTX_SYSTIMER_TARGET0_MAP) >> 2];
        if (c !== undefined) c.maps[core] = value & 0x1f;
        this.recomputeIrq();
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
    if (addr >= PCNT_BASE && addr < PCNT_BASE + 0x1000) {
      const off = addr - PCNT_BASE;
      const v = value >>> 0;
      if (off < PCNT_U_CNT && off % PCNT_UNIT_CONF_STRIDE < 0x0c && (off & 3) === 0) {
        const unit = this.pcntUnits[Math.floor(off / PCNT_UNIT_CONF_STRIDE)];
        const toff = off % PCNT_UNIT_CONF_STRIDE;
        if (unit !== undefined) {
          if (toff === PCNT_U_CONF0) unit.conf0 = v;
          else if (toff === PCNT_U_CONF1) unit.conf1 = v;
          else if (toff === PCNT_U_CONF2) unit.conf2 = v;
          this.capturePcntInputs(false);
        }
      } else if (off === PCNT_INT_ENA) {
        this.pcntIntEna = v & ((1 << PCNT_UNITS) - 1);
        this.recomputeIrq();
      } else if (off === PCNT_INT_CLR) {
        this.pcntIntRaw &= ~v;
        for (let i = 0; i < PCNT_UNITS; i++) {
          if ((v & (1 << i)) !== 0) {
            const unit = this.pcntUnits[i];
            if (unit !== undefined) unit.status &= PCNT_MODE_MASK;
          }
        }
        this.recomputeIrq();
      } else if (off === PCNT_CTRL) {
        this.pcntCtrl = v;
        for (let i = 0; i < PCNT_UNITS; i++) {
          if ((v & (1 << (i * 2))) !== 0) {
            const unit = this.pcntUnits[i];
            if (unit !== undefined) unit.count = 0;
          }
        }
        this.capturePcntInputs(false);
        this.recomputeIrq();
      }
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
      if (off === SENS_SAR_READER1_CTRL) {
        this.sarReader1Ctrl = value >>> 0;
      } else if (off === SENS_SAR_MEAS1_CTRL2) {
        const prev = this.meas1Ctrl2;
        this.meas1Ctrl2 = value >>> 0;
        // adc_oneshot_ll_start pulses MEAS1_START_SAR low then high —
        // the 0→1 edge runs a conversion. It completes immediately
        // (the conversion-time cut, stated in the header).
        if ((value & MEAS1_START_SAR) !== 0 && (prev & MEAS1_START_SAR) === 0) {
          this.runSarAdcConversion(1, value);
        }
      } else if (off === SENS_SAR_READER2_CTRL) {
        this.sarReader2Ctrl = value >>> 0;
      } else if (off === SENS_SAR_MEAS2_CTRL2) {
        const prev = this.meas2Ctrl2;
        this.meas2Ctrl2 = value >>> 0;
        // Same adc_oneshot_ll_start pulse for ADC2, backed by its
        // separate MEAS2_DONE/DATA bits.
        if ((value & MEAS2_START_SAR) !== 0 && (prev & MEAS2_START_SAR) === 0) {
          this.runSarAdcConversion(2, value);
        }
      } else if (off === SENS_SAR_TSENS_CTRL) {
        const ro = this.tsensCtrl & (SENS_TSENS_READY | 0xff);
        this.tsensCtrl = ((value & ~(SENS_TSENS_READY | 0xff)) | ro) >>> 0;
        if ((value & SENS_TSENS_DUMP_OUT) !== 0) {
          this.tsensCtrl = ((this.tsensCtrl & ~0xff) | SENS_TSENS_READY | SENS_TSENS_DEFAULT_OUT) >>> 0;
          if ((this.tsensCtrl & SENS_TSENS_INT_EN) !== 0) {
            this.rtcIntRaw |= RTC_TSENS_INT;
            this.recomputeIrq();
          }
        }
      } else if (off === SENS_SAR_TSENS_CTRL2) {
        this.tsensCtrl2 = value >>> 0;
      } else if (off === SENS_SAR_COCPU_STATE) {
        if ((value & SENS_COCPU_DBG_TRIGGER) !== 0) {
          this.triggerCocpuTrap();
        }
      } else if (off === SENS_SAR_TOUCH_CONF) {
        if ((value & SENS_TOUCH_STATUS_CLR) !== 0) {
          this.touchActiveMask = 0;
        }
        this.sensTouchConf = (value & ~(SENS_TOUCH_DENOISE_END | SENS_TOUCH_UNIT_END | SENS_TOUCH_STATUS_CLR)) >>> 0;
      } else if (off >= SENS_SAR_TOUCH_THRES1 && off < SENS_SAR_TOUCH_THRES1 + SENS_TOUCH_THRES_COUNT * 4 && (off & 3) === 0) {
        this.touchThresholds[(off - SENS_SAR_TOUCH_THRES1) >> 2] = value & SENS_TOUCH_THRES_MASK;
      } else if (off === SENS_SAR_TOUCH_CHN_ST) {
        const clear = (value & SENS_TOUCH_CHANNEL_CLR_MASK) >>> 15;
        if (clear !== 0) this.touchActiveMask &= ~clear;
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
    if (addr >= RTCIO_BASE && addr < RTCIO_END) {
      const off = addr - RTCIO_BASE;
      if (off === RTC_IO_EXT_WAKEUP0) {
        this.rtcIoExtWakeup0 = value & RTC_IO_EXT_WAKEUP0_SEL_MASK;
        this.updateRtcExt0Wakeup();
      }
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
        if ((value & RTC_SW_CPU_INT) !== 0) {
          this.triggerUlpWake();
        } else {
          if ((value & RTC_SLEEP_EN) !== 0 && this.rejectRtcSleepIfNeeded()) return;
          if ((value & RTC_SLEEP_EN) !== 0) this.rtcDeepSleep = (this.rtcDigPwc & RTC_DG_WRAP_PD_EN) !== 0;
          if ((value & RTC_SLEEP_EN) !== 0) this.resetUartWakeEdgeCounts();
          if ((value & RTC_SLEEP_EN) !== 0) this.checkRtcSleepTimer();
          if ((value & RTC_SLEEP_EN) !== 0) this.updateRtcExt0Wakeup();
          if ((value & RTC_SLEEP_EN) !== 0) this.updateRtcExt1Wakeup();
          if ((value & RTC_SLEEP_EN) !== 0) this.updateRtcGpioWakeup();
          if ((value & RTC_SLEEP_EN) !== 0) this.updateRtcSdioIdle();
          if ((value & RTC_SLEEP_EN) !== 0) this.updateRtcWifiWake();
          if ((value & RTC_SLEEP_EN) !== 0) this.updateRtcBtWake();
          if ((value & RTC_SLEEP_EN) !== 0) this.checkRtcTouchSleepTimer();
          this.recomputeIrq();
        }
      } else if (off === RTC_DIG_PWC) {
        this.rtcDigPwc = value >>> 0;
      } else if (off === RTC_SW_CPU_STALL) {
        this.rtcSwCpuStall = value >>> 0;
        this.maybeStartCore1();
      } else if (off === RTC_WAKEUP_STATE) {
        this.rtcWakeupState = value >>> 0;
      } else if (off === RTC_INT_ENA) {
        this.rtcIntEna = value >>> 0;
        this.recomputeIrq();
      } else if (off === RTC_INT_RAW) {
        this.rtcIntRaw =
          ((this.rtcIntRaw & ~RTC_INT_RAW_WRITABLE) | (value & RTC_INT_RAW_WRITABLE)) >>> 0;
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
      } else if (off === RTC_ANA_CONF) {
        this.rtcAnaConf = value >>> 0;
        this.updateClockGlitchDetector();
      } else if (off === RTC_EXT_WAKEUP_CONF) {
        this.rtcExtWakeupConf = value & RTC_EXT_WAKEUP_CONF_MASK;
        this.updateRtcExt0Wakeup();
        this.updateRtcExt1Wakeup();
      } else if (off === RTC_SLP_REJECT_CONF) {
        this.rtcSlpRejectConf = value >>> 0;
      } else if (off === RTC_CLK_CONF) {
        this.rebaseRtcSlowClock(() => {
          this.rtcClkConf = value >>> 0;
        });
      } else if (off === RTC_SLOW_CLK_CONF) {
        this.rebaseRtcSlowClock(() => {
          this.rtcSlowClkConf = value >>> 0;
          this.updateRtcSlowDivider();
        });
      } else if (off === RTC_TIME_UPDATE) {
        if ((value & (1 << 31)) !== 0) {
          // Latch the 48-bit RTC main timer: CPU cycles → RTC_SLOW ticks.
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
            this.rwdtPauseStartCycle = null;
          } else if (off === RTC_WDTFEED) {
            // rwdt_ll_feed sets bit 31 (RTC_CNTL_RTC_WDT_FEED).
            if ((value & RTC_WDT_FEED_BIT) !== 0) {
              this.rwdt.epoch = this.cpu.cycles;
              this.rwdt.handled = 0;
              this.rwdtPauseStartCycle = null;
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
      } else if (off === RTC_ULP_CP_TIMER) {
        const prev = this.rtcUlpCpTimer;
        this.rtcUlpCpTimer = (value & ~RTC_ULP_CP_GPIO_WAKEUP_CLR) >>> 0;
        const enabled = (this.rtcUlpCpTimer & RTC_ULP_CP_SLP_TIMER_EN) !== 0;
        const wasEnabled = (prev & RTC_ULP_CP_SLP_TIMER_EN) !== 0;
        if (enabled && !wasEnabled) this.armUlpTimer();
        else if (!enabled) this.rtcUlpTimerStartTick = null;
        else this.recomputeIrq();
      } else if (off === RTC_ULP_CP_CTRL) {
        const prev = this.rtcUlpCpCtrl;
        this.rtcUlpCpCtrl = (value & ~RTC_ULP_CP_MEM_OFFST_CLR) >>> 0;
        if ((value & RTC_ULP_CP_RESET) !== 0) {
          this.rtcIntRaw &= ~RTC_ULP_CP_INT;
        }
        const start = (value & RTC_ULP_CP_START_TOP) !== 0 && (prev & RTC_ULP_CP_START_TOP) === 0;
        if (start || (value & RTC_ULP_CP_FORCE_START_TOP) !== 0) {
          this.triggerUlpWake();
        } else {
          this.recomputeIrq();
        }
      } else if (off === RTC_COCPU_CTRL) {
        // COCPU_SW_INT_TRIGGER is a write-only pulse; the rest of the
        // register is stored so IDF startup can round-trip inert fields.
        this.rtcCocpuCtrl = (value & ~RTC_COCPU_SW_INT_TRIGGER) >>> 0;
        if ((value & RTC_COCPU_SW_INT_TRIGGER) !== 0) {
          this.rtcIntRaw |= RTC_COCPU_INT;
          this.latchRtcWakeupSource(RTC_COCPU_TRIG_EN);
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
      } else if (off === RTC_PG_CTRL) {
        this.rtcPgCtrl = value >>> 0;
        this.updatePowerGlitchDetector();
      } else if (off === RTC_FIB_SEL) {
        this.rtcFibSel = value & RTC_FIB_SEL_MASK;
        this.updateClockGlitchDetector();
      } else if (off === RTC_EXT_WAKEUP1) {
        if ((value & RTC_EXT_WAKEUP1_STATUS_CLR) !== 0) this.rtcExtWakeup1Status = 0;
        this.rtcExtWakeup1 = value & RTC_EXT_WAKEUP1_SEL_MASK;
        this.updateRtcExt1Wakeup();
      } else if (off === RTC_TOUCH_CTRL1) {
        this.rtcTouchCtrl1 = value >>> 0;
        if ((this.rtcTouchCtrl2 & RTC_TOUCH_SLP_TIMER_EN) !== 0) this.armTouchSleepTimer();
      } else if (off === RTC_TOUCH_CTRL2) {
        const prev = this.rtcTouchCtrl2;
        this.rtcTouchCtrl2 = value >>> 0;
        if ((value & RTC_TOUCH_RESET) !== 0) {
          this.touchMeasDone = false;
          this.touchActiveMask = 0;
          this.touchScanCurr = 0;
          this.touchData.fill(0);
          this.touchDebounce.fill(0);
          this.touchApproachCounts = [0, 0, 0];
          this.touchSleepApproachCount = 0;
          this.rtcTouchTimerStartTick = null;
          this.rtcIntRaw &= ~RTC_TOUCH_INT_MASK;
        }
        const startPulse = (value & RTC_TOUCH_START_EN) !== 0 && (prev & RTC_TOUCH_START_EN) === 0;
        const timerStart = (value & RTC_TOUCH_SLP_TIMER_EN) !== 0 && (prev & RTC_TOUCH_SLP_TIMER_EN) === 0;
        if (timerStart) this.armTouchSleepTimer();
        else if ((value & RTC_TOUCH_SLP_TIMER_EN) === 0) this.rtcTouchTimerStartTick = null;
        if (startPulse || timerStart) this.runTouchMeasurement();
        this.recomputeIrq();
      } else if (off === RTC_TOUCH_SCAN_CTRL) {
        this.rtcTouchScanCtrl = value >>> 0;
      } else if (off === RTC_TOUCH_SLP_THRES) {
        this.rtcTouchSlpThres = value >>> 0;
      } else if (off === RTC_TOUCH_APPROACH) {
        this.rtcTouchApproach = (value & ~RTC_TOUCH_SLP_CHANNEL_CLR) >>> 0;
        if ((value & RTC_TOUCH_SLP_CHANNEL_CLR) !== 0) {
          this.touchMeasDone = false;
          this.touchScanCurr = 0;
          this.touchData.fill(0);
          this.touchDebounce.fill(0);
          this.touchApproachCounts = [0, 0, 0];
          this.touchSleepApproachCount = 0;
        }
      } else if (off === RTC_TOUCH_FILTER_CTRL) {
        this.rtcTouchFilterCtrl = value >>> 0;
      } else if (off === RTC_TOUCH_TIMEOUT_CTRL) {
        this.rtcTouchTimeoutCtrl = value >>> 0;
      } else if (off === RTC_TOUCH_DAC) {
        this.rtcTouchDac = value >>> 0;
      } else if (off === RTC_TOUCH_DAC1) {
        this.rtcTouchDac1 = value >>> 0;
      } else if (off === RTC_INT_ENA_W1TS) {
        this.rtcIntEna = (this.rtcIntEna | value) >>> 0;
        this.recomputeIrq();
      } else if (off === RTC_INT_ENA_W1TC) {
        this.rtcIntEna = (this.rtcIntEna & ~value) >>> 0;
        this.recomputeIrq();
      } else if (off === RTC_ULP_CP_TIMER_1) {
        this.rtcUlpCpTimer1 = value >>> 0;
        if ((this.rtcUlpCpTimer & RTC_ULP_CP_SLP_TIMER_EN) !== 0) this.armUlpTimer();
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
        this.recomputeIrq();
        return;
      }
      if (off === EFUSE_INT_RAW) {
        this.efuseIntRaw |= v & EFUSE_DONE_INTS;
        this.recomputeIrq();
        return;
      }
      if (off === EFUSE_INT_ENA) {
        this.efuseIntEna = v & EFUSE_DONE_INTS;
        this.recomputeIrq();
        return;
      }
      if (off === EFUSE_INT_CLR) {
        this.efuseIntRaw &= ~(v & EFUSE_DONE_INTS);
        this.recomputeIrq();
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

export {
  IRAM_BASE as ESP32S3_IRAM_BASE,
  DRAM_BASE as ESP32S3_DRAM_BASE,
  GPIO_BASE as ESP32S3_GPIO_BASE,
  I2C0_BASE as ESP32S3_I2C0_BASE,
  I2C1_BASE as ESP32S3_I2C1_BASE,
  MCPWM0_BASE as ESP32S3_MCPWM0_BASE,
  MCPWM1_BASE as ESP32S3_MCPWM1_BASE,
  PCNT_BASE as ESP32S3_PCNT_BASE,
  SPI2_BASE as ESP32S3_SPI2_BASE,
  SPI3_BASE as ESP32S3_SPI3_BASE,
  TWAI_BASE as ESP32S3_TWAI_BASE,
  UART0_BASE as ESP32S3_UART0_BASE,
  UART1_BASE as ESP32S3_UART1_BASE,
  UART2_BASE as ESP32S3_UART2_BASE,
};
