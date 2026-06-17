import { describe, expect, it } from 'vitest';

import {
  Esp32s3Core,
  ESP32S3_DRAM_BASE,
  ESP32S3_GPIO_BASE,
  ESP32S3_I2C0_BASE,
  ESP32S3_I2C1_BASE,
  ESP32S3_IRAM_BASE,
  ESP32S3_MCPWM0_BASE,
  ESP32S3_MCPWM1_BASE,
  ESP32S3_PCNT_BASE,
  ESP32S3_SPI2_BASE,
  ESP32S3_SPI3_BASE,
  ESP32S3_TWAI_BASE,
  ESP32S3_UART0_BASE,
  ESP32S3_UART1_BASE,
  ESP32S3_UART2_BASE,
} from './esp32s3.js';
import {
  ADD,
  ADD_N,
  ADDI,
  ADDMI,
  ADDI_N,
  AND,
  assembleXtensa,
  BEQZ,
  BEQZ_TO,
  BEQZ_N_TO,
  BLT,
  BNE,
  BNEZ,
  BNEZ_TO,
  BR,
  CALL0,
  CALL0_TO,
  CALLN_TO,
  CALLX0,
  CALLXN,
  ENTRY,
  J,
  J_TO,
  L32I,
  L32I_N,
  L32R,
  MEMW,
  MOV_N,
  MOVI,
  MOVI_N,
  MOVSP,
  NOP,
  NOP_N,
  OR,
  PAD_TO,
  RET,
  RET_N,
  RETW,
  RETW_N,
  RFE,
  RSIL,
  RSR,
  S32I,
  S32I_N,
  SLLI,
  SR,
  SRAI,
  SRLI,
  SUB,
  WAITI,
  WSR,
} from './xtensa-asm.js';

import type { XtInstr } from './xtensa-asm.js';

/**
 * The ESP32-S3 v0 suite — real hand-assembled Xtensa machine code
 * against the from-scratch interpreter, exactly like the AVR and
 * RP2040 rigs. The first describe pins the ASSEMBLER's bytes against
 * encodings from the ida-xtensa2 disassembler tables and real objdump
 * listings, so an assembler/interpreter shared bug cannot hide.
 */

const GPIO = ESP32S3_GPIO_BASE;
const UART = ESP32S3_UART0_BASE;
const UART1 = ESP32S3_UART1_BASE;
const UART2 = ESP32S3_UART2_BASE;
const I2C0 = ESP32S3_I2C0_BASE;
const I2C1 = ESP32S3_I2C1_BASE;
const SPI2 = ESP32S3_SPI2_BASE;
const SPI3 = ESP32S3_SPI3_BASE;
const MCPWM0 = ESP32S3_MCPWM0_BASE;
const MCPWM1 = ESP32S3_MCPWM1_BASE;
const TWAI = ESP32S3_TWAI_BASE;
const INTMTX = 0x600c2000;
const LEDC = 0x60019000;
const RMT = 0x60016000;
const PCNT = ESP32S3_PCNT_BASE;
const GDMA = 0x6003f000;
const GPIO_FUNC5_OUT_SEL_CFG = GPIO + 0x568;
const GPIO_FUNC33_IN_SEL_CFG = GPIO + 0x154 + 33 * 4;
const GPIO_FUNC35_IN_SEL_CFG = GPIO + 0x154 + 35 * 4;
const GPIO_FUNC81_IN_SEL_CFG = GPIO + 0x154 + 81 * 4;
const GPIO_FUNC84_IN_SEL_CFG = GPIO + 0x154 + 84 * 4;
const GPIO_SIG_IN_SEL = 1 << 7;
const LEDC_CLK_EN = 0x80000000;
const LEDC_APB_CLK_SEL_XTAL = 3;
const LEDC_TIMER0_2BIT_DIV1 = (256 << 4) | 2;
const LEDC_TIMER0_3BIT_DIV1 = (256 << 4) | 3;
const LEDC_TIMER0_8BIT_DIV1 = (256 << 4) | 8;
const LEDC_DUTY_START = 0x80000000;
const LEDC_DUTY_INC = 1 << 30;
const LEDC_SIG_OUT_EN = 1 << 2;
const LEDC_LS_SIG_OUT0 = 73;
const RMT_CLK_EN = 0x80000000;
const RMT_SYS_APB_FIFO_MASK = 1;
const RMT_SCLK_ACTIVE = 1 << 26;
const RMT_SCLK_SEL_APB = 1 << 24;
const RMT_TX_START = 1;
const RMT_MEM_RD_RST = 1 << 1;
const RMT_MEM_TX_WRAP_EN = 1 << 4;
const RMT_TX_CONTI_MODE = 1 << 3;
const RMT_IDLE_OUT_EN = 1 << 6;
const RMT_CARRIER_EFF_EN = 1 << 20;
const RMT_CARRIER_EN = 1 << 21;
const RMT_CARRIER_OUT_LV = 1 << 22;
const RMT_DMA_ACCESS_EN = 1 << 25;
const RMT_RX_DMA_ACCESS_EN = 1 << 23;
const RMT_RX_CARRIER_EN = 1 << 28;
const RMT_RX_CARRIER_OUT_LV = 1 << 29;
const RMT_CH0_CARRIER_DUTY = 0x80;
const RMT_CH0_STATUS = 0x50;
const RMT_CH0_TX_LIM = 0xa0;
const RMT_CH4_RX_LIM = 0xb0;
const RMT_CH4_RX_CARRIER_RM = 0x90;
const RMT_SIG_OUT0 = 81;
const RMT_SIG_OUT3 = RMT_SIG_OUT0 + 3;
const RMT_RX_EN = 1;
const RMT_MEM_WR_RST = 1 << 1;
const RMT_APB_MEM_RST = 1 << 2;
const RMT_MEM_OWNER_RX = 1 << 3;
const RMT_MEM_RX_WRAP_EN = 1 << 13;
const RMT_RX_CONF_UPDATE = 1 << 15;
const RMT_CH0_TX_END = 1;
const RMT_CH0_TX_THR_EVENT = 1 << 8;
const RMT_CH0_TX_LOOP = 1 << 12;
const RMT_CH3_TX_END = 1 << 3;
const RMT_CH4_STATUS = 0x60;
const RMT_CH4_RX_END = 1 << 16;
const RMT_CH4_RX_THR_EVENT = 1 << 24;
const PCNT_CH0_POS_INC = 1 << 18;
const PCNT_CH0_LCTRL_INVERT = 1 << 22;
const PCNT_THR_H_LIM_EN = 1 << 12;
const PCNT_UNIT0_INT = 1;
const PCNT_H_LIM_STATUS = 1 << 5;
const I2C_TRANS_COMPLETE_INT = 1 << 7;
const I2C_NACK_INT = 1 << 10;
const I2C_ALL_INTS = 0x3fff;
const I2C_CMD_RESTART = 6 << 11;
const I2C_CMD_WRITE2_ACK = 2 | (1 << 8) | (1 << 11);
const I2C_CMD_WRITE1_ACK_EXPECT_NACK = 1 | (1 << 8) | (1 << 9) | (1 << 11);
const I2C_CMD_READ2 = 2 | (3 << 11);
const I2C_CMD_STOP = 2 << 11;
const I2C_CMD_END = 4 << 11;
const SPI_TRANS_DONE_INT = 1 << 12;
const SPI_ALL_INTS = 0x1fffff;
const SPI_CMD_UPDATE = 1 << 23;
const SPI_CMD_USR = 1 << 24;
const SPI_USR_COMMAND = 0x80000000;
const SPI_USR_ADDR = 0x40000000;
const SPI_USR_MISO = 0x10000000;
const SPI_USR_MOSI = 0x08000000;
const SPI_USR_MOSI_HIGHPART = 0x02000000;
const SPI_USER_COMMAND_ADDR_MOSI = (SPI_USR_COMMAND | SPI_USR_ADDR | SPI_USR_MOSI) >>> 0;
const SPI_USER1_ADDR_24_BITS = (23 << 27) >>> 0;
const SPI_USER2_CMD_9F = ((7 << 28) | 0x9f) >>> 0;
const SPI_MS_DLEN_16_BITS = 15;
const SPI_MS_DLEN_32_BITS = 31;
const MCPWM_TIMER0_PERIOD7 = 7 << 8;
const MCPWM_TIMER0_START_UP = (2 | (1 << 3)) >>> 0;
const MCPWM_GEN_UTEZ_HIGH_UTEA_LOW = (2 | (1 << 4)) >>> 0;
const MCPWM_OP0_TEA_INT = 1 << 15;
const MCPWM_PWM0_OUT0A = 160;
const MCPWM_PWM1_OUT0A = 166;
const TWAI_RI_TI = 0x03;
const TWAI_LISTEN_ONLY_MODE = 1 << 1;
const TWAI_SELF_TEST_MODE = 1 << 2;
const TWAI_ACCEPTANCE_FILTER_MODE = 1 << 3;
const TWAI_TI_EI_BEI = (1 << 1) | (1 << 2) | (1 << 7);
const TWAI_TX_REQUEST = 1 << 0;
const TWAI_SELF_RX_REQUEST = 1 << 4;
const TWAI_RELEASE_RX_BUFFER = 1 << 2;
const TWAI_STATUS_RBS_TBS_TCS = 0x0d;
const TWAI_STD_DLC3 = 3;
const TWAI_STD_ID_0X123_BYTE0 = 0x24;
const TWAI_STD_ID_0X123_BYTE1 = 0x60;
const GDMA_OUT_CH0_INT_RAW = 0x68;
const GDMA_OUT_CH0_INT_CLR = 0x74;
const GDMA_OUT_CH0_LINK = 0x80;
const GDMA_OUT_CH0_PERI_SEL = 0xa8;
const GDMA_IN_CH0_INT_RAW = 0x08;
const GDMA_IN_CH0_INT_CLR = 0x14;
const GDMA_IN_CH0_LINK = 0x20;
const GDMA_IN_CH0_PERI_SEL = 0x48;
const GDMA_OUT_LINK_START = 1 << 21;
const GDMA_INLINK_AUTO_RET = 1 << 20;
const GDMA_INLINK_START = 1 << 22;
const GDMA_PERI_RMT = 9;
const GDMA_IN_DONE = 1 << 0;
const GDMA_IN_SUC_EOF = 1 << 1;
const GDMA_OUT_DONE = 1 << 0;
const GDMA_OUT_EOF = 1 << 1;
const GDMA_OUT_TOTAL_EOF = 1 << 3;
const GDMA_DESC_SUC_EOF = 1 << 30;
const GDMA_DESC_OWNER_DMA = 1 << 31;

function core(image: Uint8Array): Esp32s3Core {
  const c = new Esp32s3Core();
  c.loadFirmware(image);
  return c;
}

const word = (w: number): number[] => [w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff];

describe('xtensa assembler — byte fixtures from independent sources', () => {
  it('emits the documented encodings exactly', () => {
    expect(word(RET())).toEqual([0x80, 0x00, 0x00]);
    expect(word(NOP())).toEqual([0xf0, 0x20, 0x00]);
    expect(word(MEMW())).toEqual([0xc0, 0x20, 0x00]);
    expect(word(WAITI(0))).toEqual([0x00, 0x70, 0x00]);
    expect(word(WAITI(3))).toEqual([0x00, 0x73, 0x00]);
    // movi a2, 63 → "22 a0 3f" (objdump)
    expect(word(MOVI(2, 63))).toEqual([0x22, 0xa0, 0x3f]);
    // l32i a2, a1, 16 → imm8 scaled by 4 → "22 21 04"
    expect(word(L32I(2, 1, 16))).toEqual([0x22, 0x21, 0x04]);
    // Opcode/mask spot checks against the disassembler table.
    expect(ADD(3, 1, 2) & 0xff000f).toBe(0x800000);
    expect(BEQZ(4, 0) & 0xff).toBe(0x16);
    expect(BNEZ(4, 0) & 0xff).toBe(0x56);
    expect(J(0) & 0x3f).toBe(0x06);
    expect(CALL0(0) & 0x3f).toBe(0x05);
  });
});

describe('Esp32s3Core', () => {
  it('blinks IO5 with cycle-exact spacing (W1TS/W1TC through the GPIO matrix)', () => {
    // a2 = GPIO base; enable IO5; loop { W1TS; delay; W1TC; delay }
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 5], [
      L32R(2, 0), // a2 = GPIO_BASE
      L32R(3, 1), // a3 = bit 5
      S32I(3, 2, 0x24), // ENABLE_W1TS
      // loop:
      S32I(3, 2, 0x08), // OUT_W1TS → high
      MOVI(4, 10),
      ADDI(4, 4, -1), //   delay: 10 × (ADDI+BNEZ)
      BNEZ(4, BR(-2)),
      S32I(3, 2, 0x0c), // OUT_W1TC → low
      MOVI(4, 10),
      ADDI(4, 4, -1),
      BNEZ(4, BR(-2)),
      J(BR(-9)), // back to loop
    ]);
    const c = core(image);
    const { events } = c.step(1_000);
    const io5 = events.filter((e) => e.pin === 'IO5');
    expect(io5.length).toBeGreaterThan(8);
    // Strict alternation with a constant period (1 instr = 1 cycle).
    for (let i = 1; i < io5.length; i++) {
      expect(io5[i]?.level).toBe(io5[i - 1]?.level === 1 ? 0 : 1);
    }
    const periods = new Set<number>();
    for (let i = 2; i < io5.length; i++) {
      periods.add((io5[i]?.cycle ?? 0) - (io5[i - 2]?.cycle ?? 0));
    }
    expect(periods.size).toBe(1); // zero jitter
  });

  it('mirrors a host-driven input (IO4 → IO6) through GPIO_IN', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 6, 1 << 4], [
      L32R(2, 0),
      L32R(3, 1), // output bit (IO6)
      L32R(5, 2), // input mask (IO4)
      S32I(3, 2, 0x24), // enable IO6
      // loop:
      L32I(4, 2, 0x3c), // GPIO_IN
      AND(4, 4, 5),
      BEQZ(4, BR(2)),
      S32I(3, 2, 0x08), // high
      J(BR(1)),
      S32I(3, 2, 0x0c), // low (BEQZ target)
      J(BR(-7)), // back to loop
    ]);
    const c = core(image);
    c.step(200); // settle: IO4 low → IO6 driven low (no edge yet — first drive)
    c.setPin('IO4', 1);
    const high = c.step(200).events.filter((e) => e.pin === 'IO6');
    expect(high[0]?.level).toBe(1);
    c.setPin('IO4', 0);
    const low = c.step(200).events.filter((e) => e.pin === 'IO6');
    expect(low[0]?.level).toBe(0);
  });

  it('routes LEDC channel 0 PWM through the GPIO matrix to IO5', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [LEDC, GPIO, GPIO_FUNC5_OUT_SEL_CFG, LEDC_CLK_EN, LEDC_TIMER0_2BIT_DIV1, 2 << 4, LEDC_DUTY_START, 1 << 5, LEDC_LS_SIG_OUT0],
      [
        L32R(2, 0), // LEDC
        L32R(3, 3),
        S32I(3, 2, 0xd0), // CONF.CLK_EN
        L32R(3, 4),
        S32I(3, 2, 0xa0), // TIMER0: 2-bit resolution, divider=1.0
        L32R(3, 5),
        S32I(3, 2, 0x08), // CH0 duty = 2 / 4, driver style (duty << 4)
        L32R(3, 6),
        S32I(3, 2, 0x0c), // ledc_update_duty: DUTY_START
        MOVI(3, LEDC_SIG_OUT_EN),
        S32I(3, 2, 0x00), // CH0 SIG_OUT_EN, timer 0

        L32R(4, 1), // GPIO
        L32R(5, 7),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 8),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- LEDC_LS_SIG_OUT0
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(260);
    const io5 = events.filter((e) => e.pin === 'IO5');

    expect(io5.length).toBeGreaterThan(20);
    const tail = io5.slice(-12);
    for (let i = 1; i < tail.length; i++) {
      expect(tail[i]?.level).toBe(tail[i - 1]?.level === 1 ? 0 : 1);
    }
    const halfPeriods = new Set<number>();
    for (let i = 1; i < tail.length; i++) {
      halfPeriods.add((tail[i]?.cycle ?? 0) - (tail[i - 1]?.cycle ?? 0));
    }
    expect([...halfPeriods]).toEqual([6]);
  });

  it('routes MCPWM0 operator 0 generator A through the GPIO matrix to IO5', () => {
    // Context7: ESP-IDF v5.5.4 MCPWM uses timer -> operator ->
    // comparator -> generator; source-checked against mcpwm_reg.h and
    // GPIO matrix PWM0_OUT0A_IDX=160.
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        MCPWM0,
        GPIO,
        GPIO_FUNC5_OUT_SEL_CFG,
        MCPWM_TIMER0_PERIOD7,
        3,
        MCPWM_GEN_UTEZ_HIGH_UTEA_LOW,
        MCPWM_TIMER0_START_UP,
        1 << 5,
        MCPWM_PWM0_OUT0A,
      ],
      [
        L32R(2, 0), // MCPWM0
        L32R(3, 3),
        S32I(3, 2, 0x04), // TIMER0_CFG0: period 7, divider 1
        L32R(3, 4),
        S32I(3, 2, 0x40), // GEN0_TSTMP_A = 3
        L32R(3, 5),
        S32I(3, 2, 0x50), // GEN0_A: high at TEZ, low at TEA

        L32R(4, 1), // GPIO
        L32R(5, 7),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 8),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- PWM0_OUT0A

        L32R(3, 6),
        S32I(3, 2, 0x08), // TIMER0_CFG1: run up-counting
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(320);
    const io5 = events.filter((e) => e.pin === 'IO5');

    expect(io5.length).toBeGreaterThan(10);
    expect(new Set(io5.map((e) => e.level))).toEqual(new Set([0, 1]));
    for (let i = 1; i < io5.length; i++) {
      expect(io5[i]?.level).toBe(io5[i - 1]?.level === 1 ? 0 : 1);
    }
  });

  it('routes MCPWM0 compare interrupts through the interrupt matrix', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        MCPWM0,
        UART,
        ESP32S3_IRAM_BASE,
        INTMTX,
        MCPWM_OP0_TEA_INT,
        MCPWM_TIMER0_PERIOD7,
        3,
        MCPWM_GEN_UTEZ_HIGH_UTEA_LOW,
        MCPWM_TIMER0_START_UP,
      ],
      [
        L32R(2, 0), // MCPWM0
        L32R(6, 1), // UART0
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(7, 3),
        MOVI(3, 1),
        S32I(3, 7, 0x7c), // PWM0_INTR -> CPU line 1
        MOVI(3, 2),
        WSR(3, SR.INTENABLE),
        RSIL(12, 12),

        L32R(3, 4),
        S32I(3, 2, 0x11c), // clear stale OP0_TEA
        S32I(3, 2, 0x110), // enable OP0_TEA
        L32R(3, 5),
        S32I(3, 2, 0x04), // TIMER0_CFG0
        L32R(3, 6),
        S32I(3, 2, 0x40), // GEN0_TSTMP_A
        L32R(3, 7),
        S32I(3, 2, 0x50), // GEN0_A action
        L32R(3, 8),
        S32I(3, 2, 0x08), // start timer
        WAITI(0),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(6, 1),
        L32I(3, 2, 0x118), // INT_ST
        L32R(4, 4),
        AND(3, 3, 4),
        SRLI(3, 3, 8),
        S32I(3, 6, 0), // OP0_TEA bit 15 -> UART byte 0x80
        L32R(4, 4),
        S32I(4, 2, 0x11c), // clear OP0_TEA
        MOVI(4, 0),
        S32I(4, 2, 0x110), // one-shot test: disable further compare IRQs
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([0x80]);
  });

  it('routes MCPWM1 output signals independently from MCPWM0', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [MCPWM1, GPIO, GPIO_FUNC5_OUT_SEL_CFG, 2 << 6, 1 << 5, MCPWM_PWM1_OUT0A],
      [
        L32R(2, 0), // MCPWM1
        L32R(3, 3),
        S32I(3, 2, 0x4c), // GEN0_FORCE: force A high
        L32R(4, 1), // GPIO
        L32R(5, 4),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 5),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- PWM1_OUT0A
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(80);
    expect(events.find((e) => e.pin === 'IO5')?.level).toBe(1);
  });

  it('loops back a TWAI self-reception frame and releases the RX buffer', () => {
    // Context7: ESP-IDF v5.5.4 TWAI has one ESP32-S3 controller and
    // twai_ll.h uses the self-reception command for self-test traffic.
    // Source-checked against twai_struct.h: buffer bytes live at +0x40.
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI, UART, 0xa0, 0x80, 0x11, 0x22, 0x33, TWAI_STATUS_RBS_TBS_TCS],
      [
        L32R(2, 0), // TWAI
        MOVI(3, TWAI_SELF_TEST_MODE),
        S32I(3, 2, 0x00), // leave reset mode, enable self-test/no-ack style mode
        MOVI(3, TWAI_RI_TI),
        S32I(3, 2, 0x10), // enable RI/TI, even though this polling test does not map CAN_INT

        MOVI(3, TWAI_STD_DLC3),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=3
        L32R(3, 2),
        S32I(3, 2, 0x44), // standard ID byte 0
        L32R(3, 3),
        S32I(3, 2, 0x48), // standard ID byte 1
        L32R(3, 4),
        S32I(3, 2, 0x4c), // data 0
        L32R(3, 5),
        S32I(3, 2, 0x50), // data 1
        L32R(3, 6),
        S32I(3, 2, 0x54), // data 2

        MOVI(3, TWAI_SELF_RX_REQUEST),
        S32I(3, 2, 0x04), // command: self reception request
        L32R(6, 1), // UART0
        L32I(3, 2, 0x08), // status: RBS + TBS + TCS
        L32R(4, 7),
        AND(3, 3, 4),
        S32I(3, 6, 0),
        L32I(3, 2, 0x74), // RX message counter
        S32I(3, 6, 0),
        L32I(3, 2, 0x40), // frame info
        S32I(3, 6, 0),
        L32I(3, 2, 0x44), // ID byte 0
        S32I(3, 6, 0),
        L32I(3, 2, 0x48), // ID byte 1
        S32I(3, 6, 0),
        L32I(3, 2, 0x4c), // data 0
        S32I(3, 6, 0),
        L32I(3, 2, 0x50), // data 1
        S32I(3, 6, 0),
        L32I(3, 2, 0x54), // data 2
        S32I(3, 6, 0),
        MOVI(3, TWAI_RELEASE_RX_BUFFER),
        S32I(3, 2, 0x04), // release RX buffer
        L32I(3, 2, 0x08),
        MOVI(4, 1),
        AND(3, 3, 4), // RBS should clear
        S32I(3, 6, 0),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(600);
    expect([...c.drainUart()]).toEqual([0x0d, 1, 3, 0xa0, 0x80, 0x11, 0x22, 0x33, 0]);
  });

  it('routes TWAI RX/TX interrupts through CAN_INT and clears them on interrupt read', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI, UART, ESP32S3_IRAM_BASE, INTMTX],
      [
        L32R(2, 0), // TWAI
        L32R(6, 1), // UART0
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(7, 3),
        MOVI(3, 1),
        S32I(3, 7, 0x94), // CAN_INT -> CPU line 1
        MOVI(3, 2),
        WSR(3, SR.INTENABLE),
        RSIL(12, 12),

        MOVI(3, TWAI_SELF_TEST_MODE),
        S32I(3, 2, 0x00),
        MOVI(3, TWAI_RI_TI),
        S32I(3, 2, 0x10),
        MOVI(3, TWAI_STD_DLC3),
        S32I(3, 2, 0x40),
        MOVI(3, TWAI_SELF_RX_REQUEST),
        S32I(3, 2, 0x04),
        WAITI(0),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(6, 1),
        L32I(3, 2, 0x0c), // INTERRUPT read clears RI/TI
        S32I(3, 6, 0),
        L32I(3, 2, 0x0c), // second read proves clear
        S32I(3, 6, 0),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(700);
    expect([...c.drainUart()]).toEqual([TWAI_RI_TI, 0]);
  });

  it('accepts host-injected TWAI frames through the acceptance filter', () => {
    const code: XtInstr[] = [
      L32R(2, 0), // TWAI
      MOVI(3, TWAI_STD_ID_0X123_BYTE0),
      S32I(3, 2, 0x40), // ACR0: std ID 0x123 bits 10..3
      MOVI(3, TWAI_STD_ID_0X123_BYTE1),
      S32I(3, 2, 0x44), // ACR1: std ID 0x123 bits 2..0, left-aligned
      MOVI(3, 0),
      S32I(3, 2, 0x48), // ACR2
      S32I(3, 2, 0x4c), // ACR3
      S32I(3, 2, 0x50), // AMR0: compare ACR0
      MOVI(3, 0x1f),
      S32I(3, 2, 0x54), // AMR1: compare ID bits, ignore non-ID low bits
      MOVI(3, 0xff),
      S32I(3, 2, 0x58), // AMR2: ignore data byte 0
      S32I(3, 2, 0x5c), // AMR3: ignore data byte 1
      MOVI(3, TWAI_ACCEPTANCE_FILTER_MODE),
      S32I(3, 2, 0x00), // leave reset mode, keep AFM single-filter bit
      MOVI(3, TWAI_RI_TI),
      S32I(3, 2, 0x10),
    ];
    const poll = code.length;
    code.push(
      L32I(3, 2, 0x74), // RX message counter
      BEQZ_TO(3, poll),
      L32R(6, 1), // UART0
      S32I(3, 6, 0), // count
      L32I(3, 2, 0x0c), // interrupt register; read clears RI
      S32I(3, 6, 0),
      L32I(3, 2, 0x40), // frame info
      S32I(3, 6, 0),
      L32I(3, 2, 0x44), // ID byte 0
      S32I(3, 6, 0),
      L32I(3, 2, 0x48), // ID byte 1
      S32I(3, 6, 0),
      L32I(3, 2, 0x4c), // data 0
      S32I(3, 6, 0),
      L32I(3, 2, 0x50), // data 1
      S32I(3, 6, 0),
      J(BR(-1)),
    );

    const c = core(assembleXtensa(ESP32S3_IRAM_BASE, [TWAI, UART], code));
    c.step(240);
    expect(c.injectTwaiFrame({ id: 0x321, data: [0x44] })).toBe(false);
    c.step(240);
    expect([...c.drainUart()]).toEqual([]);
    expect(c.injectTwaiFrame({ id: 0x123, data: [0xaa, 0xbb] })).toBe(true);
    c.step(700);
    expect([...c.drainUart()]).toEqual([1, 1, 2, TWAI_STD_ID_0X123_BYTE0, TWAI_STD_ID_0X123_BYTE1, 0xaa, 0xbb]);
  });

  it('surfaces firmware TWAI transmissions to the host bench', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI, 0x80, 0x20, 0xde, 0xad],
      [
        L32R(2, 0), // TWAI
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        MOVI(3, 2),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=2
        L32R(3, 1),
        S32I(3, 2, 0x44), // std id 0x401 byte 0
        L32R(3, 2),
        S32I(3, 2, 0x48), // std id 0x401 byte 1
        L32R(3, 3),
        S32I(3, 2, 0x4c), // data 0
        L32R(3, 4),
        S32I(3, 2, 0x50), // data 1
        MOVI(3, TWAI_TX_REQUEST),
        S32I(3, 2, 0x04),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(360);
    expect(c.drainTwaiTx()).toEqual([{ id: 0x401, data: [0xde, 0xad], dlc: 2, extended: false, rtr: false }]);
    expect(c.drainTwaiTx()).toEqual([]);
  });

  it('latches TWAI no-ACK transmit errors and increments TEC', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI, UART, 0x80, 0x20, 0xca, 0xfe],
      [
        L32R(2, 0), // TWAI
        L32R(6, 1), // UART0
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        MOVI(3, 0xff),
        S32I(3, 2, 0x10), // enable all modeled TWAI interrupt bits
        MOVI(3, 2),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=2
        L32R(3, 2),
        S32I(3, 2, 0x44), // std id 0x401 byte 0
        L32R(3, 3),
        S32I(3, 2, 0x48), // std id 0x401 byte 1
        L32R(3, 4),
        S32I(3, 2, 0x4c), // data 0
        L32R(3, 5),
        S32I(3, 2, 0x50), // data 1
        MOVI(3, TWAI_TX_REQUEST),
        S32I(3, 2, 0x04),
        L32I(3, 2, 0x0c), // INTERRUPT: TI + EI + BEI for a no-ACK attempt
        S32I(3, 6, 0),
        L32I(3, 2, 0x3c), // TX error counter
        S32I(3, 6, 0),
        L32I(3, 2, 0x30), // error code capture: ACK slot
        S32I(3, 6, 0),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(520);
    expect(c.drainTwaiTx()).toEqual([{ id: 0x401, data: [0xca, 0xfe], dlc: 2, extended: false, rtr: false }]);
    expect([...c.drainUart()]).toEqual([TWAI_TI_EI_BEI, 8, 25]);
  });

  it('delivers TWAI frames to a connected peer and ACKs without growing TEC', () => {
    const tx = core(
      assembleXtensa(ESP32S3_IRAM_BASE, [TWAI, UART, 0x80, 0x40, 0x10, 0x20, 0x30], [
        L32R(2, 0), // TWAI
        L32R(6, 1), // UART0
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        MOVI(3, 3),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=3
        L32R(3, 2),
        S32I(3, 2, 0x44), // std id 0x402 byte 0
        L32R(3, 3),
        S32I(3, 2, 0x48), // std id 0x402 byte 1
        L32R(3, 4),
        S32I(3, 2, 0x4c), // data 0
        L32R(3, 5),
        S32I(3, 2, 0x50), // data 1
        L32R(3, 6),
        S32I(3, 2, 0x54), // data 2
        MOVI(3, TWAI_TX_REQUEST),
        S32I(3, 2, 0x04),
        L32I(3, 2, 0x3c), // TX error counter stays zero on ACK
        S32I(3, 6, 0),
        L32I(3, 2, 0x0c), // only TI is latched
        S32I(3, 6, 0),
        J(BR(-1)),
      ]),
    );
    const rx = core(
      assembleXtensa(ESP32S3_IRAM_BASE, [TWAI, UART], [
        L32R(2, 0), // TWAI
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        MOVI(3, TWAI_RI_TI),
        S32I(3, 2, 0x10),
        L32R(6, 1), // UART0
        L32I(3, 2, 0x74), // RX message counter
        BEQZ_TO(3, 5),
        S32I(3, 6, 0),
        L32I(3, 2, 0x40), // frame info
        S32I(3, 6, 0),
        L32I(3, 2, 0x44), // ID byte 0
        S32I(3, 6, 0),
        L32I(3, 2, 0x48), // ID byte 1
        S32I(3, 6, 0),
        L32I(3, 2, 0x4c), // data 0
        S32I(3, 6, 0),
        L32I(3, 2, 0x50), // data 1
        S32I(3, 6, 0),
        L32I(3, 2, 0x54), // data 2
        S32I(3, 6, 0),
        J(BR(-1)),
      ]),
    );

    tx.connectTwaiPeer(rx);
    rx.step(120);
    tx.step(520);
    rx.step(700);

    expect(tx.drainTwaiTx()).toEqual([{ id: 0x402, data: [0x10, 0x20, 0x30], dlc: 3, extended: false, rtr: false }]);
    expect([...tx.drainUart()]).toEqual([0, 2]);
    expect([...rx.drainUart()]).toEqual([1, 3, 0x80, 0x40, 0x10, 0x20, 0x30]);
  });

  it('drains TWAI tx/rx done events for a connected peer frame', () => {
    const tx = core(
      assembleXtensa(ESP32S3_IRAM_BASE, [TWAI, 0x80, 0x60, 0x44], [
        L32R(2, 0), // TWAI
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        MOVI(3, 1),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=1
        L32R(3, 1),
        S32I(3, 2, 0x44), // std id 0x403 byte 0
        L32R(3, 2),
        S32I(3, 2, 0x48), // std id 0x403 byte 1
        L32R(3, 3),
        S32I(3, 2, 0x4c), // data 0
        MOVI(3, TWAI_TX_REQUEST),
        S32I(3, 2, 0x04),
        J(BR(-1)),
      ]),
    );
    const rx = core(
      assembleXtensa(ESP32S3_IRAM_BASE, [TWAI], [
        L32R(2, 0), // TWAI
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        J(BR(-1)),
      ]),
    );

    tx.connectTwaiPeer(rx);
    rx.step(80);
    tx.step(320);

    expect(tx.drainTwaiEvents()).toEqual([
      { type: 'tx_done', success: true, frame: { id: 0x403, data: [0x44], dlc: 1, extended: false, rtr: false } },
    ]);
    expect(rx.drainTwaiEvents()).toEqual([
      { type: 'rx_done', frame: { id: 0x403, data: [0x44], dlc: 1, extended: false, rtr: false } },
    ]);
  });

  it('drains TWAI ACK bus-error events with failed tx_done callbacks', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI, 0x80, 0x80, 0x55],
      [
        L32R(2, 0), // TWAI
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        MOVI(3, 1),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=1
        L32R(3, 1),
        S32I(3, 2, 0x44), // std id 0x404 byte 0
        L32R(3, 2),
        S32I(3, 2, 0x48), // std id 0x404 byte 1
        L32R(3, 3),
        S32I(3, 2, 0x4c), // data 0
        MOVI(3, TWAI_TX_REQUEST),
        S32I(3, 2, 0x04),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(320);

    expect(c.drainTwaiEvents()).toEqual([
      { type: 'error', flags: { ackErr: true, busError: true } },
      { type: 'tx_done', success: false, frame: { id: 0x404, data: [0x55], dlc: 1, extended: false, rtr: false } },
    ]);
  });

  it('drains TWAI state-change events as ACK errors escalate TEC', () => {
    const txBurst: XtInstr[] = [];
    for (let i = 0; i < 32; i++) {
      txBurst.push(MOVI(3, TWAI_TX_REQUEST), S32I(3, 2, 0x04));
    }
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI, 0x80, 0xa0, 0x66],
      [
        L32R(2, 0), // TWAI
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        MOVI(3, 1),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=1
        L32R(3, 1),
        S32I(3, 2, 0x44), // std id 0x405 byte 0
        L32R(3, 2),
        S32I(3, 2, 0x48), // std id 0x405 byte 1
        L32R(3, 3),
        S32I(3, 2, 0x4c), // data 0
        ...txBurst,
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(4000);

    expect(c.drainTwaiEvents().filter((event) => event.type === 'state_change')).toEqual([
      { type: 'state_change', oldState: 'active', newState: 'warning' },
      { type: 'state_change', oldState: 'warning', newState: 'passive' },
      { type: 'state_change', oldState: 'passive', newState: 'bus_off' },
    ]);
  });

  it('surfaces TWAI bus-off as a host error event when the TEC saturates', () => {
    const txBurst: XtInstr[] = [];
    for (let i = 0; i < 32; i++) {
      txBurst.push(MOVI(3, TWAI_TX_REQUEST), S32I(3, 2, 0x04));
    }
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI, 0x80, 0xa0, 0x66],
      [
        L32R(2, 0), // TWAI
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode
        MOVI(3, 1),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=1
        L32R(3, 1),
        S32I(3, 2, 0x44), // std id 0x405 byte 0
        L32R(3, 2),
        S32I(3, 2, 0x48), // std id 0x405 byte 1
        L32R(3, 3),
        S32I(3, 2, 0x4c), // data 0
        ...txBurst,
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(4000);

    const events = c.drainTwaiEvents();

    // Bus-off is surfaced exactly once, as its own host error event (mirrors the
    // legacy TWAI_ALERT_BUS_OFF alert, distinct from the ACK/bus-error alert).
    expect(events.filter((event) => event.type === 'error' && event.flags.busOff === true)).toEqual([
      { type: 'error', flags: { busOff: true } },
    ]);

    // Existing state-change escalation is unchanged by the new error event.
    expect(events.filter((event) => event.type === 'state_change')).toEqual([
      { type: 'state_change', oldState: 'active', newState: 'warning' },
      { type: 'state_change', oldState: 'warning', newState: 'passive' },
      { type: 'state_change', oldState: 'passive', newState: 'bus_off' },
    ]);

    // The bus-off error event immediately precedes the passive -> bus_off transition.
    const busOffIdx = events.findIndex((event) => event.type === 'error' && event.flags.busOff === true);
    const busOffStateIdx = events.findIndex(
      (event) => event.type === 'state_change' && event.newState === 'bus_off',
    );
    expect(busOffStateIdx).toBe(busOffIdx + 1);
  });

  it('does not transmit TWAI frames while listen-only mode is active', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI, UART, 0x80, 0xc0, 0x77],
      [
        L32R(2, 0), // TWAI
        L32R(6, 1), // UART0
        MOVI(3, TWAI_LISTEN_ONLY_MODE),
        S32I(3, 2, 0x00), // leave reset with listen-only active
        MOVI(3, 1),
        S32I(3, 2, 0x40), // frame info: standard data frame, DLC=1
        L32R(3, 2),
        S32I(3, 2, 0x44), // std id 0x406 byte 0
        L32R(3, 3),
        S32I(3, 2, 0x48), // std id 0x406 byte 1
        L32R(3, 4),
        S32I(3, 2, 0x4c), // data 0
        MOVI(3, TWAI_TX_REQUEST),
        S32I(3, 2, 0x04),
        L32I(3, 2, 0x3c), // TEC stays zero because no TX occurred
        S32I(3, 6, 0),
        L32I(3, 2, 0x0c), // no TX/error interrupt latched
        S32I(3, 6, 0),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(360);

    expect(c.drainTwaiTx()).toEqual([]);
    expect(c.drainTwaiEvents()).toEqual([]);
    expect([...c.drainUart()]).toEqual([0, 0]);
  });

  it('surfaces TWAI RX FIFO overruns to the host bench', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [TWAI],
      [
        L32R(2, 0), // TWAI
        MOVI(3, 0),
        S32I(3, 2, 0x00), // leave reset mode so host-injected frames enter RX FIFO
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(80);

    for (let i = 0; i < 64; i++) {
      expect(c.injectTwaiFrame({ id: 0x410 + i, data: [i] })).toBe(true);
    }
    expect(c.drainTwaiEvents()).toHaveLength(64);

    expect(c.injectTwaiFrame({ id: 0x450, data: [0xee] })).toBe(false);
    expect(c.drainTwaiEvents()).toEqual([{ type: 'error', flags: { rxFifoOverrun: true } }]);
  });

  it('routes RMT channel 0 TX symbols through the GPIO matrix to IO5', () => {
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB;
    const rmtCh0Conf = (1 << 8) | (1 << 16) | RMT_IDLE_OUT_EN;
    const symbol0 = 2 | (1 << 15) | (3 << 16); // high 2 ticks, low 3 ticks
    const symbol1 = 1 | (1 << 15) | (2 << 16); // high 1 tick, low 2 ticks
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RMT, GPIO, GPIO_FUNC5_OUT_SEL_CFG, UART, rmtSysConf, symbol0, symbol1, rmtCh0Conf, 1 << 5, RMT_SIG_OUT0, rmtCh0Conf | RMT_TX_START],
      [
        L32R(2, 0), // RMT
        L32R(3, 4),
        S32I(3, 2, 0xc0), // SYS_CONF: clk on, APB source, group divider 1
        L32R(3, 5),
        S32I(3, 2, 0x00), // CH0DATA symbol 0
        L32R(3, 6),
        S32I(3, 2, 0x00), // CH0DATA symbol 1
        L32R(3, 7),
        S32I(3, 2, 0x20), // CH0CONF0: divider 1, idle low

        L32R(4, 1), // GPIO
        L32R(5, 8),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 9),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- RMT_SIG_OUT0

        L32R(3, 10),
        S32I(3, 2, 0x20), // tx_start
        MOVI(8, 80),
        ADDI(8, 8, -1),
        BNEZ(8, BR(-2)),
        L32R(9, 3), // UART
        L32I(8, 2, 0x70), // INT_RAW
        S32I(8, 9, 0x00),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(360);
    const io5 = events.filter((e) => e.pin === 'IO5');

    expect(io5.map((e) => e.level)).toEqual([1, 0, 1, 0]);
    expect(io5.slice(1).map((e, i) => e.cycle - (io5[i]?.cycle ?? 0))).toEqual([6, 9, 3]);
    expect([...c.drainUart()]).toEqual([1]);
  });

  it('modulates RMT TX high symbols with the carrier duty clock', () => {
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB;
    const rmtCh0Conf = (1 << 8) | (1 << 16) | RMT_IDLE_OUT_EN | RMT_CARRIER_EFF_EN | RMT_CARRIER_EN | RMT_CARRIER_OUT_LV;
    const carrierDuty = (1 << 16) | 1; // high 1 group tick, low 1 group tick
    const symbol = 8 | (1 << 15) | (4 << 16); // high 8 RMT ticks, low 4 RMT ticks
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RMT, GPIO, GPIO_FUNC5_OUT_SEL_CFG, rmtSysConf, carrierDuty, symbol, rmtCh0Conf, 1 << 5, RMT_SIG_OUT0, rmtCh0Conf | RMT_TX_START],
      [
        L32R(2, 0), // RMT
        L32R(3, 3),
        S32I(3, 2, 0xc0), // SYS_CONF: clk on, APB source, group divider 1
        L32R(3, 4),
        S32I(3, 2, RMT_CH0_CARRIER_DUTY),
        L32R(3, 5),
        S32I(3, 2, 0x00), // CH0DATA symbol
        L32R(3, 6),
        S32I(3, 2, 0x20), // CH0CONF0: carrier on high level, idle low

        L32R(4, 1), // GPIO
        L32R(5, 7),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 8),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- RMT_SIG_OUT0

        L32R(3, 9),
        S32I(3, 2, 0x20), // tx_start
        MOVI(8, 90),
        ADDI(8, 8, -1),
        BNEZ(8, BR(-2)),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(420);
    const io5 = events.filter((e) => e.pin === 'IO5');
    const carrier = io5.slice(0, 8);

    expect(carrier.map((e) => e.level)).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    expect(carrier.slice(1).map((e, i) => e.cycle - (carrier[i]?.cycle ?? 0))).toEqual([3, 3, 3, 3, 3, 3, 3]);
    expect(io5.length).toBe(8);
  });

  it('transmits from RMT APB direct memory and rearms TX threshold after clear', () => {
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB | RMT_SYS_APB_FIFO_MASK;
    const rmtCh0Conf = (1 << 8) | (1 << 16) | RMT_IDLE_OUT_EN | RMT_MEM_TX_WRAP_EN;
    const symbol0 = 2 | (1 << 15) | (2 << 16); // high 2 ticks, low 2 ticks
    const symbol1 = 1 | (1 << 15) | (1 << 16); // high 1 tick, low 1 tick
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        RMT,
        GPIO,
        GPIO_FUNC5_OUT_SEL_CFG,
        UART,
        rmtSysConf,
        rmtCh0Conf | RMT_MEM_RD_RST | RMT_APB_MEM_RST,
        symbol0,
        symbol1,
        rmtCh0Conf,
        1,
        RMT_CH0_TX_THR_EVENT | RMT_CH0_TX_END,
        1 << 5,
        RMT_SIG_OUT0,
        rmtCh0Conf | RMT_TX_START,
        0xff,
        RMT_CH0_TX_THR_EVENT,
      ],
      [
        L32R(2, 0), // RMT
        L32R(3, 4),
        S32I(3, 2, 0xc0), // SYS_CONF: APB direct-memory mode + clock on
        L32R(3, 5),
        S32I(3, 2, 0x20), // CH0CONF0: memory read/APB cursor reset
        L32R(3, 6),
        S32I(3, 2, 0x00), // CH0DATA direct-memory symbol 0
        L32R(3, 7),
        S32I(3, 2, 0x00), // CH0DATA direct-memory symbol 1
        L32I(8, 2, RMT_CH0_STATUS),
        SRLI(8, 8, 11),
        L32R(10, 14),
        AND(8, 8, 10),
        L32R(9, 3), // UART
        S32I(8, 9, 0x00), // APB write cursor == 2
        L32R(3, 9),
        S32I(3, 2, RMT_CH0_TX_LIM), // threshold every one symbol
        L32R(3, 10),
        S32I(3, 2, 0x78), // enable TX_THR_EVENT | TX_END

        L32R(4, 1), // GPIO
        L32R(5, 11),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 12),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- RMT_SIG_OUT0

        L32R(3, 13),
        S32I(3, 2, 0x20), // tx_start
        L32R(10, 15),
        L32R(12, 3), // UART
        L32I(8, 2, 0x70), // wait for first TX_THR_EVENT
        AND(11, 8, 10),
        BEQZ(11, BR(-3)),
        MOVI(11, 1),
        S32I(11, 12, 0x00),
        S32I(10, 2, 0x7c), // clear TX_THR_EVENT
        L32I(8, 2, 0x70), // wait for the next threshold crossing
        AND(11, 8, 10),
        BEQZ(11, BR(-3)),
        MOVI(11, 2),
        S32I(11, 12, 0x00),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(520);
    const io5 = events.filter((e) => e.pin === 'IO5');

    expect(io5.map((e) => e.level)).toEqual([1, 0, 1, 0]);
    expect(io5.slice(1).map((e, i) => e.cycle - (io5[i]?.cycle ?? 0))).toEqual([6, 6, 3]);
    expect([...c.drainUart()]).toEqual([2, 1, 2]);
  });

  it('applies RMT TX direct-memory refills while the waveform is in flight', () => {
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB | RMT_SYS_APB_FIFO_MASK;
    const rmtCh0Conf = (1 << 8) | (1 << 16) | RMT_IDLE_OUT_EN | RMT_MEM_TX_WRAP_EN;
    const symbol0 = 2 | (1 << 15) | (2 << 16); // high 2 ticks, low 2 ticks
    const placeholder = 80 | (1 << 15) | (20 << 16); // high, then low
    const refilled = (80 | (1 << 15) | (20 << 16) | (1 << 31)) >>> 0; // stay high until TX_END
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        RMT,
        GPIO,
        GPIO_FUNC5_OUT_SEL_CFG,
        UART,
        rmtSysConf,
        rmtCh0Conf | RMT_MEM_RD_RST | RMT_APB_MEM_RST,
        symbol0,
        placeholder,
        rmtCh0Conf,
        1,
        RMT_CH0_TX_THR_EVENT | RMT_CH0_TX_END,
        1 << 5,
        RMT_SIG_OUT0,
        rmtCh0Conf | RMT_TX_START,
        0xff,
        RMT_CH0_TX_THR_EVENT,
        rmtCh0Conf | RMT_APB_MEM_RST,
        refilled,
        RMT_CH0_TX_END,
      ],
      [
        L32R(2, 0), // RMT
        L32R(3, 4),
        S32I(3, 2, 0xc0), // SYS_CONF: APB direct-memory mode + clock on
        L32R(3, 5),
        S32I(3, 2, 0x20), // CH0CONF0: memory read/APB cursor reset
        L32R(3, 6),
        S32I(3, 2, 0x00), // initial symbol 0
        L32R(3, 7),
        S32I(3, 2, 0x00), // placeholder symbol 1
        L32R(3, 9),
        S32I(3, 2, RMT_CH0_TX_LIM), // threshold after symbol 0
        L32R(3, 10),
        S32I(3, 2, 0x78), // enable TX_THR_EVENT | TX_END

        L32R(4, 1), // GPIO
        L32R(5, 11),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 12),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- RMT_SIG_OUT0

        L32R(3, 13),
        S32I(3, 2, 0x20), // tx_start
        L32R(10, 15),
        L32R(12, 3), // UART
        L32I(8, 2, 0x70), // wait for first TX_THR_EVENT
        AND(11, 8, 10),
        BEQZ(11, BR(-3)),
        MOVI(11, 1),
        S32I(11, 12, 0x00),
        L32R(3, 16),
        S32I(3, 2, 0x20), // reset APB write cursor only
        L32R(3, 6),
        S32I(3, 2, 0x00), // preserve already-sent slot 0
        L32R(3, 17),
        S32I(3, 2, 0x00), // refill future slot 1
        S32I(10, 2, 0x7c), // clear TX_THR_EVENT
        L32R(10, 18),
        L32I(8, 2, 0x70), // wait for TX_END
        AND(11, 8, 10),
        BEQZ(11, BR(-3)),
        MOVI(11, 2),
        S32I(11, 12, 0x00),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(900);
    const io5 = events.filter((e) => e.pin === 'IO5');

    expect(io5.map((e) => e.level)).toEqual([1, 0, 1, 0]);
    expect(io5.slice(1).map((e, i) => e.cycle - (io5[i]?.cycle ?? 0))).toEqual([6, 6, 300]);
    expect([...c.drainUart()]).toEqual([1, 2]);
  });

  it('feeds RMT channel 3 TX from GDMA OUT descriptors', () => {
    const desc = ESP32S3_DRAM_BASE + 0x1200;
    const buf = ESP32S3_DRAM_BASE + 0x1240;
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB;
    const rmtCh3Conf = (1 << 8) | (1 << 16) | RMT_IDLE_OUT_EN | RMT_MEM_TX_WRAP_EN | RMT_DMA_ACCESS_EN;
    const symbol0 = 2 | (1 << 15) | (2 << 16); // high 2 ticks, low 2 ticks
    const symbol1 = 1 | (1 << 15) | (1 << 16); // high 1 tick, low 1 tick
    const descWord = GDMA_DESC_OWNER_DMA | GDMA_DESC_SUC_EOF | 8;
    const outLinkStart = (desc & 0x000f_ffff) | GDMA_OUT_LINK_START;
    const gdmaDoneMask = GDMA_OUT_DONE | GDMA_OUT_EOF | GDMA_OUT_TOTAL_EOF;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        desc,
        buf,
        descWord,
        symbol0,
        symbol1,
        GDMA,
        outLinkStart,
        RMT,
        GPIO,
        GPIO_FUNC5_OUT_SEL_CFG,
        UART,
        rmtSysConf,
        rmtCh3Conf,
        1 << 5,
        RMT_SIG_OUT3,
        rmtCh3Conf | RMT_TX_START,
        gdmaDoneMask,
      ],
      [
        L32R(2, 0), // descriptor
        L32R(3, 2),
        S32I(3, 2, 0), // dw0: owner=DMA, EOF, 8 bytes
        L32R(3, 1),
        S32I(3, 2, 4), // buffer
        MOVI(3, 0),
        S32I(3, 2, 8), // next = NULL
        L32R(4, 1), // buffer
        L32R(5, 3),
        S32I(5, 4, 0),
        L32R(5, 4),
        S32I(5, 4, 4),

        L32R(6, 5), // GDMA
        MOVI(7, GDMA_PERI_RMT),
        S32I(7, 6, GDMA_OUT_CH0_PERI_SEL),
        L32R(7, 6),
        S32I(7, 6, GDMA_OUT_CH0_LINK),

        L32R(8, 7), // RMT
        L32R(9, 11),
        S32I(9, 8, 0xc0), // SYS_CONF: clk on, APB source, group divider 1
        L32R(9, 12),
        S32I(9, 8, 0x2c), // CH3CONF0: DMA access, divider 1, idle low

        L32R(4, 8), // GPIO
        L32R(5, 13),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 9),
        L32R(7, 14),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- RMT_SIG_OUT3

        L32R(9, 15),
        S32I(9, 8, 0x2c), // CH3 tx_start
        MOVI(10, 80),
        ADDI(10, 10, -1),
        BNEZ(10, BR(-2)),
        L32R(11, 10), // UART
        L32R(6, 5), // GDMA
        L32I(12, 6, GDMA_OUT_CH0_INT_RAW),
        S32I(12, 11, 0), // GDMA OUT raw = DONE|EOF|TOTAL_EOF
        L32I(12, 8, 0x70),
        S32I(12, 11, 0), // RMT raw = CH3_TX_END
        L32R(12, 16),
        S32I(12, 6, GDMA_OUT_CH0_INT_CLR),
        L32I(12, 6, GDMA_OUT_CH0_INT_RAW),
        S32I(12, 11, 0), // clear worked
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(560);
    const io5 = events.filter((e) => e.pin === 'IO5');

    expect(io5.map((e) => e.level)).toEqual([1, 0, 1, 0]);
    expect(io5.slice(1).map((e, i) => e.cycle - (io5[i]?.cycle ?? 0))).toEqual([6, 6, 3]);
    expect([...c.drainUart()]).toEqual([gdmaDoneMask, RMT_CH3_TX_END, 0]);
  });

  it('latches RMT TX threshold and finite-loop interrupts', () => {
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB;
    const rmtCh0Conf = (1 << 8) | (1 << 16) | RMT_IDLE_OUT_EN | RMT_TX_CONTI_MODE;
    const txLimitLoopStop = 1 | (2 << 9) | (1 << 19) | (1 << 21);
    const symbol = 1 | (1 << 15) | (1 << 16); // high 1 tick, low 1 tick
    const intMask = RMT_CH0_TX_END | RMT_CH0_TX_THR_EVENT | RMT_CH0_TX_LOOP;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        RMT,
        GPIO,
        GPIO_FUNC5_OUT_SEL_CFG,
        UART,
        rmtSysConf,
        symbol,
        rmtCh0Conf,
        txLimitLoopStop,
        1 << 5,
        RMT_SIG_OUT0,
        intMask,
        rmtCh0Conf | RMT_TX_START,
        0xff,
      ],
      [
        L32R(2, 0), // RMT
        L32R(3, 4),
        S32I(3, 2, 0xc0), // SYS_CONF: clk on, APB source, group divider 1
        L32R(3, 5),
        S32I(3, 2, 0x00), // CH0DATA symbol
        L32R(3, 6),
        S32I(3, 2, 0x20), // CH0CONF0: divider 1, loop mode, idle low
        L32R(3, 7),
        S32I(3, 2, RMT_CH0_TX_LIM), // threshold=1 symbol, loop twice, autostop
        L32R(3, 10),
        S32I(3, 2, 0x78), // enable TX_END | TX_THR_EVENT | TX_LOOP

        L32R(4, 1), // GPIO
        L32R(5, 8),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 9),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- RMT_SIG_OUT0

        L32R(3, 11),
        S32I(3, 2, 0x20), // tx_start
        MOVI(8, 90),
        ADDI(8, 8, -1),
        BNEZ(8, BR(-2)),
        L32R(9, 3), // UART
        L32I(8, 2, 0x70), // INT_RAW
        L32R(10, 12), // 0xff
        AND(11, 8, 10),
        S32I(11, 9, 0x00), // low byte: TX_END
        SRLI(11, 8, 8),
        AND(11, 11, 10),
        S32I(11, 9, 0x00), // high byte: TX_THR_EVENT | TX_LOOP
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(420);
    const io5 = events.filter((e) => e.pin === 'IO5');

    expect(io5.map((e) => e.level)).toEqual([1, 0, 1, 0]);
    expect([...c.drainUart()]).toEqual([RMT_CH0_TX_END, (RMT_CH0_TX_THR_EVENT | RMT_CH0_TX_LOOP) >> 8]);
  });

  it('captures host-driven GPIO edges with RMT RX channel 0', () => {
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB;
    const rxConf0 = 1 | (4 << 8) | (1 << 24); // divider 1, idle after 4 RMT ticks, one memory block
    const rxConf1Reset = RMT_MEM_OWNER_RX | RMT_MEM_WR_RST | RMT_APB_MEM_RST | RMT_RX_CONF_UPDATE;
    const rxConf1Start = RMT_MEM_OWNER_RX | RMT_RX_EN | RMT_RX_CONF_UPDATE;
    const gpioInRoute = 4 | GPIO_SIG_IN_SEL; // IO4 -> RMT_SIG_IN0
    const intMask = RMT_CH4_RX_END | RMT_CH4_RX_THR_EVENT;
    const literals = [
      RMT,
      GPIO_FUNC81_IN_SEL_CFG,
      UART,
      rmtSysConf,
      rxConf0,
      gpioInRoute,
      rxConf1Reset,
      rxConf1Start,
      intMask,
      RMT_CH4_RX_END,
      0xff,
      1,
    ];
    const code: XtInstr[] = [
      L32R(2, 0), // RMT
      L32R(3, 3),
      S32I(3, 2, 0xc0), // SYS_CONF: clk on, APB source, group divider 1
      L32R(3, 4),
      S32I(3, 2, 0x30), // CH4CONF0: RX divider + idle threshold
      MOVI(3, 1),
      S32I(3, 2, RMT_CH4_RX_LIM), // threshold after one captured symbol
      L32R(4, 1),
      L32R(5, 5),
      S32I(5, 4, 0x00), // GPIO input matrix: RMT_SIG_IN0 <- IO4
      L32R(3, 6),
      S32I(3, 2, 0x34), // reset RX write/APB pointers
      L32R(3, 8),
      S32I(3, 2, 0x78), // enable RX_END | RX_THR_EVENT
      L32R(3, 7),
      S32I(3, 2, 0x34), // rx_en + conf_update
    ];
    const poll = code.length;
    code.push(
      L32I(8, 2, 0x70), // INT_RAW
      L32R(10, 9),
      AND(9, 8, 10),
      BEQZ_TO(9, poll),
      L32R(12, 2), // UART
      L32R(10, 10), // 0xff
      SRLI(11, 8, 8),
      SRLI(11, 11, 8),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // RX_END raw byte
      SRLI(11, 8, 12),
      SRLI(11, 11, 12),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // RX_THR raw byte
      L32I(8, 2, 0x10), // CH4DATA
      AND(11, 8, 10),
      S32I(11, 12, 0x00), // duration0 low byte
      SRLI(11, 8, 15),
      L32R(10, 11), // 1
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // level0
      L32R(10, 10),
      SRLI(11, 8, 8),
      SRLI(11, 11, 8),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // duration1 low byte
      SRLI(11, 8, 15),
      SRLI(11, 11, 15),
      SRLI(11, 11, 1),
      L32R(10, 11),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // level1
      J(BR(-1)),
    );
    const c = core(assembleXtensa(ESP32S3_IRAM_BASE, literals, code));
    c.setPin('IO4', 0);
    c.step(90);
    c.setPin('IO4', 1);
    c.step(6);
    c.setPin('IO4', 0);
    c.step(9);
    c.setPin('IO4', 1);
    c.step(90);

    expect([...c.drainUart()]).toEqual([1, 1, 2, 1, 3, 0]);
  });

  it('demodulates short RMT RX carrier gaps on the active level', () => {
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB;
    const rxConf0 = 1 | (30 << 8) | (1 << 24) | RMT_RX_CARRIER_EN | RMT_RX_CARRIER_OUT_LV;
    const carrierRm = (2 << 16) | 2; // tolerate low/high carrier gaps up to three RMT ticks
    const rxConf1Reset = RMT_MEM_OWNER_RX | RMT_MEM_WR_RST | RMT_APB_MEM_RST | RMT_RX_CONF_UPDATE;
    const rxConf1Start = RMT_MEM_OWNER_RX | RMT_RX_EN | RMT_RX_CONF_UPDATE;
    const gpioInRoute = 4 | GPIO_SIG_IN_SEL; // IO4 -> RMT_SIG_IN0
    const intMask = RMT_CH4_RX_END | RMT_CH4_RX_THR_EVENT;
    const literals = [
      RMT,
      GPIO_FUNC81_IN_SEL_CFG,
      UART,
      rmtSysConf,
      rxConf0,
      carrierRm,
      gpioInRoute,
      rxConf1Reset,
      rxConf1Start,
      intMask,
      RMT_CH4_RX_END,
      0xff,
      1,
    ];
    const code: XtInstr[] = [
      L32R(2, 0), // RMT
      L32R(3, 3),
      S32I(3, 2, 0xc0), // SYS_CONF: clk on, APB source, group divider 1
      L32R(3, 4),
      S32I(3, 2, 0x30), // CH4CONF0: RX divider + idle threshold + carrier demod on high
      L32R(3, 5),
      S32I(3, 2, RMT_CH4_RX_CARRIER_RM), // tolerate short carrier gaps
      MOVI(3, 1),
      S32I(3, 2, RMT_CH4_RX_LIM), // threshold after one demodulated symbol
      L32R(4, 1),
      L32R(5, 6),
      S32I(5, 4, 0x00), // GPIO input matrix: RMT_SIG_IN0 <- IO4
      L32R(3, 7),
      S32I(3, 2, 0x34), // reset RX write/APB pointers
      L32R(3, 9),
      S32I(3, 2, 0x78), // enable RX_END | RX_THR_EVENT
      L32R(3, 8),
      S32I(3, 2, 0x34), // rx_en + conf_update
    ];
    const poll = code.length;
    code.push(
      L32I(8, 2, 0x70), // INT_RAW
      L32R(10, 10),
      AND(9, 8, 10),
      BEQZ_TO(9, poll),
      L32R(12, 2), // UART
      L32R(10, 11), // 0xff
      SRLI(11, 8, 8),
      SRLI(11, 11, 8),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // RX_END raw byte
      SRLI(11, 8, 12),
      SRLI(11, 11, 12),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // RX_THR raw byte
      L32I(8, 2, 0x10), // CH4DATA
      AND(11, 8, 10),
      S32I(11, 12, 0x00), // duration0 low byte
      SRLI(11, 8, 15),
      L32R(10, 12), // 1
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // level0
      L32R(10, 11),
      SRLI(11, 8, 8),
      SRLI(11, 11, 8),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // duration1 low byte
      SRLI(11, 8, 15),
      SRLI(11, 11, 15),
      SRLI(11, 11, 1),
      L32R(10, 12),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // level1
      J(BR(-1)),
    );
    const c = core(assembleXtensa(ESP32S3_IRAM_BASE, literals, code));
    c.setPin('IO4', 0);
    c.step(90);
    c.setPin('IO4', 1);
    c.step(3);
    c.setPin('IO4', 0);
    c.step(1);
    c.setPin('IO4', 1);
    c.step(3);
    c.setPin('IO4', 0);
    c.step(1);
    c.setPin('IO4', 1);
    c.step(3);
    c.setPin('IO4', 0);
    c.step(12);
    c.setPin('IO4', 1);
    c.step(300);

    expect([...c.drainUart()]).toEqual([1, 1, 4, 1, 4, 0]);
  });

  it('counts GPIO-matrix PCNT pulses and latches high-limit interrupts', () => {
    const conf0 = PCNT_CH0_POS_INC | PCNT_THR_H_LIM_EN;
    const highLimit3 = 3;
    const pulseRoute = 4 | GPIO_SIG_IN_SEL; // IO4 -> PCNT_SIG_CH0_IN0
    const literals = [PCNT, GPIO_FUNC33_IN_SEL_CFG, UART, conf0, highLimit3, pulseRoute, 0, PCNT_UNIT0_INT, 0xff];
    const code: XtInstr[] = [
      L32R(2, 0), // PCNT
      L32R(3, 3),
      S32I(3, 2, 0x00), // U0_CONF0: ch0 rising increments, high-limit event enabled
      L32R(3, 4),
      S32I(3, 2, 0x08), // U0_CONF2: high limit = 3
      L32R(4, 1),
      L32R(5, 5),
      S32I(5, 4, 0x00), // GPIO input matrix: PCNT_SIG_CH0_IN0 <- IO4
      L32R(3, 7),
      S32I(3, 2, 0x48), // INT_ENA: unit 0 threshold/watch event
      L32R(3, 6),
      S32I(3, 2, 0x60), // CTRL: release unit reset bits
    ];
    const poll = code.length;
    code.push(
      L32I(8, 2, 0x44), // INT_ST
      L32R(9, 7),
      AND(8, 8, 9),
      BEQZ_TO(8, poll),
      L32I(6, 2, 0x30), // U0_CNT
      L32I(7, 2, 0x50), // U0_STATUS
      L32R(12, 2), // UART
      L32R(10, 8), // 0xff
      AND(11, 6, 10),
      S32I(11, 12, 0x00), // count low byte
      AND(11, 8, 10),
      S32I(11, 12, 0x00), // masked interrupt bit
      AND(11, 7, 10),
      S32I(11, 12, 0x00), // high-limit status latch
      L32R(9, 7),
      S32I(9, 2, 0x4c), // INT_CLR
      L32I(8, 2, 0x44),
      AND(11, 8, 10),
      S32I(11, 12, 0x00), // interrupt clears
      J(BR(-1)),
    );

    const c = core(assembleXtensa(ESP32S3_IRAM_BASE, literals, code));
    c.setPin('IO4', 0);
    c.step(120);
    for (let i = 0; i < 3; i++) {
      c.setPin('IO4', 1);
      c.step(1);
      c.setPin('IO4', 0);
      c.step(1);
    }
    c.step(300);

    expect([...c.drainUart()]).toEqual([3, PCNT_UNIT0_INT, PCNT_H_LIM_STATUS, 0]);
  });

  it('honors PCNT level-control inversion on pulse edges', () => {
    const conf0 = PCNT_CH0_POS_INC | PCNT_CH0_LCTRL_INVERT;
    const pulseRoute = 4 | GPIO_SIG_IN_SEL; // IO4 -> PCNT_SIG_CH0_IN0
    const ctrlRoute = 5 | GPIO_SIG_IN_SEL; // IO5 -> PCNT_CTRL_CH0_IN0
    const literals = [PCNT, GPIO_FUNC33_IN_SEL_CFG, GPIO_FUNC35_IN_SEL_CFG, UART, conf0, pulseRoute, ctrlRoute, 0, 0xff];
    const code: XtInstr[] = [
      L32R(2, 0), // PCNT
      L32R(3, 4),
      S32I(3, 2, 0x00), // U0_CONF0: rising increments, low control inverts
      L32R(4, 1),
      L32R(5, 5),
      S32I(5, 4, 0x00), // pulse route
      L32R(4, 2),
      L32R(5, 6),
      S32I(5, 4, 0x00), // control route
      L32R(3, 7),
      S32I(3, 2, 0x60), // release unit reset bits
    ];
    const poll = code.length;
    code.push(
      L32I(6, 2, 0x30), // U0_CNT
      BEQZ_TO(6, poll),
      L32R(12, 3), // UART
      L32R(10, 8), // 0xff
      AND(11, 6, 10),
      S32I(11, 12, 0x00), // low byte of signed -1
      SRLI(11, 6, 8),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // high byte of signed -1
      J(BR(-1)),
    );

    const c = core(assembleXtensa(ESP32S3_IRAM_BASE, literals, code));
    c.setPin('IO4', 0);
    c.setPin('IO5', 0);
    c.step(120);
    c.setPin('IO4', 1);
    c.step(160);

    expect([...c.drainUart()]).toEqual([0xff, 0xff]);
  });

  it('wraps RMT RX direct memory and reports APB read/write offsets', () => {
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB | RMT_SYS_APB_FIFO_MASK;
    const rxConf0 = 1 | (200 << 8) | (1 << 24); // divider 1, long idle, one 48-symbol memory block
    const rxConf1Reset = RMT_MEM_OWNER_RX | RMT_MEM_RX_WRAP_EN | RMT_MEM_WR_RST | RMT_APB_MEM_RST | RMT_RX_CONF_UPDATE;
    const rxConf1Start = RMT_MEM_OWNER_RX | RMT_MEM_RX_WRAP_EN | RMT_RX_EN | RMT_RX_CONF_UPDATE;
    const gpioInRoute = 4 | GPIO_SIG_IN_SEL; // IO4 -> RMT_SIG_IN0
    const literals = [
      RMT,
      GPIO_FUNC81_IN_SEL_CFG,
      UART,
      rmtSysConf,
      rxConf0,
      gpioInRoute,
      rxConf1Reset,
      rxConf1Start,
      RMT_CH4_RX_END,
      0xff,
    ];
    const code: XtInstr[] = [
      L32R(2, 0), // RMT
      L32R(3, 3),
      S32I(3, 2, 0xc0), // SYS_CONF: direct-memory APB path, APB clock source
      L32R(3, 4),
      S32I(3, 2, 0x30), // CH4CONF0: RX divider + idle threshold
      L32R(4, 1),
      L32R(5, 5),
      S32I(5, 4, 0x00), // GPIO input matrix: RMT_SIG_IN0 <- IO4
      L32R(3, 6),
      S32I(3, 2, 0x34), // reset RX write/APB pointers while keeping wrap configured
      L32R(3, 8),
      S32I(3, 2, 0x78), // enable RX_END
      L32R(3, 7),
      S32I(3, 2, 0x34), // rx_en + wrap + conf_update
    ];
    const poll = code.length;
    code.push(
      L32I(8, 2, 0x70), // INT_RAW
      L32R(10, 8), // RMT_CH4_RX_END
      AND(9, 8, 10),
      BEQZ_TO(9, poll),
      L32R(12, 2), // UART
      L32R(10, 9), // 0xff
      L32I(8, 2, RMT_CH4_STATUS),
      AND(11, 8, 10),
      S32I(11, 12, 0x00), // CH4 write offset low byte: base 192 + wrapped cursor 1
      L32I(8, 2, 0x10), // CH4DATA direct-memory slot 0
      AND(11, 8, 10),
      S32I(11, 12, 0x00), // wrapped duration0 low byte
      SRLI(11, 8, 8),
      SRLI(11, 11, 8),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // wrapped duration1 low byte
      L32I(8, 2, RMT_CH4_STATUS),
      SRLI(11, 8, 11),
      AND(11, 11, 10),
      S32I(11, 12, 0x00), // CH4 APB read offset low byte: base 192 + cursor 1
      J(BR(-1)),
    );
    const c = core(assembleXtensa(ESP32S3_IRAM_BASE, literals, code));
    c.setPin('IO4', 0);
    c.step(120);
    c.setPin('IO4', 1);
    c.step(6);
    c.setPin('IO4', 0);
    c.step(9);
    c.setPin('IO4', 1);
    for (let i = 0; i < 48; i++) {
      c.step(3);
      c.setPin('IO4', 0);
      c.step(3);
      c.setPin('IO4', 1);
    }
    c.step(900);

    expect([...c.drainUart()]).toEqual([193, 1, 1, 193]);
  });

  it('captures RMT RX channel 3 symbols through GDMA IN descriptors', () => {
    const desc = ESP32S3_DRAM_BASE + 0x1280;
    const buf = ESP32S3_DRAM_BASE + 0x12c0;
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB;
    const rxDmaConf0 = 1 | (4 << 8) | RMT_RX_DMA_ACCESS_EN | (1 << 24); // divider 1, idle 4 ticks, DMA-capable CH7
    const rxConf1Reset = RMT_MEM_OWNER_RX | RMT_MEM_WR_RST | RMT_APB_MEM_RST | RMT_RX_CONF_UPDATE;
    const rxConf1Start = RMT_MEM_OWNER_RX | RMT_RX_EN | RMT_RX_CONF_UPDATE;
    const gpioInRoute = 4 | GPIO_SIG_IN_SEL; // IO4 -> RMT_SIG_IN3
    const descWord = GDMA_DESC_OWNER_DMA | 8;
    const inLinkStart = (desc & 0x000f_ffff) | GDMA_INLINK_AUTO_RET | GDMA_INLINK_START;
    const gdmaDoneMask = GDMA_IN_DONE | GDMA_IN_SUC_EOF;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        desc,
        buf,
        descWord,
        GDMA,
        inLinkStart,
        RMT,
        GPIO_FUNC84_IN_SEL_CFG,
        gpioInRoute,
        rmtSysConf,
        rxDmaConf0,
        rxConf1Reset,
        rxConf1Start,
        UART,
        gdmaDoneMask,
        0xff,
        1,
      ],
      [
        L32R(2, 0), // descriptor
        L32R(3, 2),
        S32I(3, 2, 0), // dw0: owner=DMA, 8-byte buffer
        L32R(3, 1),
        S32I(3, 2, 4), // buffer
        MOVI(3, 0),
        S32I(3, 2, 8), // next = NULL

        L32R(4, 3), // GDMA
        MOVI(5, GDMA_PERI_RMT),
        S32I(5, 4, GDMA_IN_CH0_PERI_SEL),
        L32R(5, 4),
        S32I(5, 4, GDMA_IN_CH0_LINK),

        L32R(6, 5), // RMT
        L32R(7, 8),
        S32I(7, 6, 0xc0), // SYS_CONF: clk on, APB source, group divider 1
        L32R(7, 9),
        S32I(7, 6, 0x48), // CH7CONF0: DMA access + idle threshold
        L32R(7, 6),
        L32R(8, 7),
        S32I(8, 7, 0), // GPIO input matrix: RMT_SIG_IN3 <- IO4
        L32R(7, 10),
        S32I(7, 6, 0x4c), // reset RX write/APB pointers
        L32R(7, 11),
        S32I(7, 6, 0x4c), // rx_en + conf_update

        L32R(12, 12), // UART
        L32R(10, 13), // GDMA done mask
        L32I(8, 4, GDMA_IN_CH0_INT_RAW),
        AND(9, 8, 10),
        BEQZ(9, BR(-3)),
        S32I(8, 12, 0), // GDMA IN raw = DONE|SUC_EOF
        L32I(8, 6, 0x70),
        SRLI(8, 8, 8),
        SRLI(8, 8, 8),
        S32I(8, 12, 0), // no RMT RX_END raw byte in DMA mode
        L32R(9, 1), // buffer
        L32R(10, 14), // 0xff
        L32I(8, 9, 0),
        AND(11, 8, 10),
        S32I(11, 12, 0), // duration0 low byte
        SRLI(11, 8, 15),
        L32R(10, 15), // 1
        AND(11, 11, 10),
        S32I(11, 12, 0), // level0
        L32R(10, 14),
        SRLI(11, 8, 8),
        SRLI(11, 11, 8),
        AND(11, 11, 10),
        S32I(11, 12, 0), // duration1 low byte
        SRLI(11, 8, 15),
        SRLI(11, 11, 15),
        SRLI(11, 11, 1),
        L32R(10, 15),
        AND(11, 11, 10),
        S32I(11, 12, 0), // level1
        L32R(9, 0), // descriptor
        L32I(8, 9, 0),
        SRLI(8, 8, 12),
        L32R(10, 14),
        AND(8, 8, 10),
        S32I(8, 12, 0), // descriptor length = 4, partial EOF
        L32R(8, 13),
        S32I(8, 4, GDMA_IN_CH0_INT_CLR),
        L32I(8, 4, GDMA_IN_CH0_INT_RAW),
        S32I(8, 12, 0), // clear worked
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setPin('IO4', 0);
    c.step(90);
    c.setPin('IO4', 1);
    c.step(6);
    c.setPin('IO4', 0);
    c.step(9);
    c.setPin('IO4', 1);
    c.step(300);

    expect([...c.drainUart()]).toEqual([gdmaDoneMask, 0, 2, 1, 3, 0, 4, 0]);
  });

  it('continues RMT RX DMA across linked descriptors for partial receives', () => {
    const desc0 = ESP32S3_DRAM_BASE + 0x1300;
    const desc1 = ESP32S3_DRAM_BASE + 0x1320;
    const buf0 = ESP32S3_DRAM_BASE + 0x1360;
    const buf1 = ESP32S3_DRAM_BASE + 0x1380;
    const rmtSysConf = RMT_CLK_EN | RMT_SCLK_ACTIVE | RMT_SCLK_SEL_APB;
    const rxDmaConf0 = 1 | (400 << 8) | RMT_RX_DMA_ACCESS_EN | (1 << 24); // divider 1, long idle threshold, DMA-capable CH7
    const rxConf1Reset = RMT_MEM_OWNER_RX | RMT_MEM_WR_RST | RMT_APB_MEM_RST | RMT_RX_CONF_UPDATE;
    const rxConf1Start = RMT_MEM_OWNER_RX | RMT_RX_EN | RMT_RX_CONF_UPDATE;
    const gpioInRoute = 4 | GPIO_SIG_IN_SEL; // IO4 -> RMT_SIG_IN3
    const desc0Word = GDMA_DESC_OWNER_DMA | 4;
    const desc1Word = GDMA_DESC_OWNER_DMA | 8;
    const inLinkStart = (desc0 & 0x000f_ffff) | GDMA_INLINK_AUTO_RET | GDMA_INLINK_START;
    const gdmaDoneMask = GDMA_IN_DONE | GDMA_IN_SUC_EOF;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        desc0,
        desc1,
        buf0,
        buf1,
        desc0Word,
        desc1Word,
        GDMA,
        inLinkStart,
        RMT,
        GPIO_FUNC84_IN_SEL_CFG,
        gpioInRoute,
        rmtSysConf,
        rxDmaConf0,
        rxConf1Reset,
        rxConf1Start,
        UART,
        gdmaDoneMask,
        0xff,
        1,
      ],
      [
        L32R(2, 0), // descriptor 0
        L32R(3, 4),
        S32I(3, 2, 0), // desc0: owner=DMA, 4-byte buffer
        L32R(3, 2),
        S32I(3, 2, 4), // desc0 buffer
        L32R(3, 1),
        S32I(3, 2, 8), // desc0 -> desc1
        L32R(4, 1), // descriptor 1
        L32R(3, 5),
        S32I(3, 4, 0), // desc1: owner=DMA, 8-byte buffer
        L32R(3, 3),
        S32I(3, 4, 4), // desc1 buffer
        MOVI(3, 0),
        S32I(3, 4, 8), // desc1 -> NULL

        L32R(4, 6), // GDMA
        MOVI(5, GDMA_PERI_RMT),
        S32I(5, 4, GDMA_IN_CH0_PERI_SEL),
        L32R(5, 7),
        S32I(5, 4, GDMA_IN_CH0_LINK),

        L32R(6, 8), // RMT
        L32R(7, 11),
        S32I(7, 6, 0xc0), // SYS_CONF: clk on, APB source, group divider 1
        L32R(7, 12),
        S32I(7, 6, 0x48), // CH7CONF0: DMA access + idle threshold
        L32R(7, 9),
        L32R(8, 10),
        S32I(8, 7, 0), // GPIO input matrix: RMT_SIG_IN3 <- IO4
        L32R(7, 13),
        S32I(7, 6, 0x4c), // reset RX write/APB pointers
        L32R(7, 14),
        S32I(7, 6, 0x4c), // rx_en + conf_update

        L32R(12, 15), // UART
        L32R(10, 16), // GDMA done mask
        L32R(13, 17), // 0xff
        L32R(14, 18), // 1

        L32I(8, 4, GDMA_IN_CH0_INT_RAW),
        AND(9, 8, 10),
        BEQZ(9, BR(-3)),
        S32I(9, 12, 0), // first GDMA callback: DONE|SUC_EOF
        L32I(8, 2, 0),
        SRLI(11, 8, 12),
        AND(11, 11, 13),
        S32I(11, 12, 0), // desc0 length = 4
        SRLI(11, 8, 15),
        SRLI(11, 11, 15),
        SRLI(11, 11, 1),
        AND(11, 11, 14),
        S32I(11, 12, 0), // desc0 owner returned to CPU
        L32R(15, 2), // buf0
        L32I(8, 15, 0),
        AND(11, 8, 13),
        S32I(11, 12, 0), // desc0 duration0
        SRLI(11, 8, 15),
        AND(11, 11, 14),
        S32I(11, 12, 0), // desc0 level0
        L32R(11, 16),
        S32I(11, 4, GDMA_IN_CH0_INT_CLR),

        L32I(8, 4, GDMA_IN_CH0_INT_RAW),
        AND(9, 8, 10),
        BEQZ(9, BR(-3)),
        S32I(9, 12, 0), // final GDMA callback after RX idle EOF
        L32R(15, 1), // descriptor 1
        L32I(8, 15, 0),
        SRLI(11, 8, 12),
        AND(11, 11, 13),
        S32I(11, 12, 0), // desc1 partial length = 4
        SRLI(11, 8, 15),
        SRLI(11, 11, 15),
        SRLI(11, 11, 1),
        AND(11, 11, 14),
        S32I(11, 12, 0), // desc1 owner returned to CPU
        L32R(15, 3), // buf1
        L32I(8, 15, 0),
        AND(11, 8, 13),
        S32I(11, 12, 0), // desc1 duration0
        SRLI(11, 8, 15),
        AND(11, 11, 14),
        S32I(11, 12, 0), // desc1 level0
        L32R(11, 16),
        S32I(11, 4, GDMA_IN_CH0_INT_CLR),
        L32I(8, 4, GDMA_IN_CH0_INT_RAW),
        S32I(8, 12, 0), // final clear worked
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setPin('IO4', 0);
    c.step(90);
    c.setPin('IO4', 1);
    c.step(6);
    c.setPin('IO4', 0);
    c.step(9);
    c.setPin('IO4', 1);
    c.step(600);
    c.setPin('IO4', 0);
    c.step(9);
    c.setPin('IO4', 1);
    c.step(2000);

    expect([...c.drainUart()]).toEqual([gdmaDoneMask, 4, 0, 2, 1, gdmaDoneMask, 4, 0, 200, 1, 0]);
  });

  it('uses LEDC shared clock source selection for timer speed and readback', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        LEDC,
        GPIO,
        GPIO_FUNC5_OUT_SEL_CFG,
        ESP32S3_UART0_BASE,
        LEDC_CLK_EN | LEDC_APB_CLK_SEL_XTAL,
        LEDC_TIMER0_2BIT_DIV1,
        2 << 4,
        LEDC_DUTY_START,
        1 << 5,
        LEDC_LS_SIG_OUT0,
      ],
      [
        L32R(2, 0), // LEDC
        L32R(3, 4),
        S32I(3, 2, 0xd0), // CONF.CLK_EN + apb_clk_sel = XTAL
        L32I(4, 2, 0xd0),
        MOVI(5, 3),
        AND(4, 4, 5),
        L32R(5, 3),
        S32I(4, 5, 0), // UART: prove apb_clk_sel readback

        L32R(3, 5),
        S32I(3, 2, 0xa0), // TIMER0: 2-bit resolution, divider=1.0
        L32R(3, 6),
        S32I(3, 2, 0x08), // CH0 duty = 2 / 4
        L32R(3, 7),
        S32I(3, 2, 0x0c), // ledc_update_duty: DUTY_START
        MOVI(3, LEDC_SIG_OUT_EN),
        S32I(3, 2, 0x00), // CH0 SIG_OUT_EN, timer 0

        L32R(4, 1), // GPIO
        L32R(5, 8),
        S32I(5, 4, 0x24), // enable IO5
        L32R(6, 2),
        L32R(7, 9),
        S32I(7, 6, 0x00), // GPIO matrix: IO5 <- LEDC_LS_SIG_OUT0
        J(BR(-1)),
      ],
    );
    const c = core(image);
    const { events } = c.step(520);
    const io5 = events.filter((e) => e.pin === 'IO5');

    expect([...c.drainUart()]).toEqual([LEDC_APB_CLK_SEL_XTAL]);
    expect(io5.length).toBeGreaterThan(20);
    const tail = io5.slice(-12);
    const halfPeriods = new Set<number>();
    for (let i = 1; i < tail.length; i++) {
      expect(tail[i]?.level).toBe(tail[i - 1]?.level === 1 ? 0 : 1);
      halfPeriods.add((tail[i]?.cycle ?? 0) - (tail[i - 1]?.cycle ?? 0));
    }
    expect([...halfPeriods]).toEqual([12]);
  });

  it('reports LEDC duty readback with ESP-IDF integer-duty semantics', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [LEDC, UART, 3 << 4, LEDC_DUTY_START], [
      L32R(2, 0), // LEDC
      L32R(3, 2),
      S32I(3, 2, 0x08), // ledc_hal_set_duty_int_part(..., 3) writes 3 << 4
      L32R(3, 3),
      S32I(3, 2, 0x0c), // ledc_update_duty applies it to DUTY_R
      L32I(4, 2, 0x10),
      SRLI(4, 4, 4),
      L32R(5, 1),
      S32I(4, 5, 0),
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(80);

    expect([...c.drainUart()]).toEqual([3]);
  });

  it('advances LEDC single-range hardware fade before duty-change interrupt', () => {
    const LEDC_DUTY_CHNG_END_CH0 = 1 << 4;
    const LEDC_FADE_UP_TWO_STEPS = LEDC_DUTY_START | LEDC_DUTY_INC | (2 << 20) | (1 << 10) | 1;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [LEDC, UART, LEDC_CLK_EN, LEDC_TIMER0_3BIT_DIV1, 1 << 4, LEDC_FADE_UP_TWO_STEPS],
      [
        L32R(2, 0), // LEDC
        L32R(3, 1), // UART
        L32R(4, 2),
        S32I(4, 2, 0xd0), // CONF.CLK_EN
        L32R(4, 3),
        S32I(4, 2, 0xa0), // TIMER0: 3-bit resolution, divider=1.0
        L32R(4, 4),
        S32I(4, 2, 0x08), // CH0 starts at duty 1
        MOVI(4, LEDC_DUTY_CHNG_END_CH0),
        S32I(4, 2, 0xc8), // INT_ENA: duty-change-end ch0
        L32R(4, 5),
        S32I(4, 2, 0x0c), // start 2 x +1 hardware fade steps
        L32I(5, 2, 0x10),
        SRLI(5, 5, 4),
        S32I(5, 3, 0), // immediate readback is still the start duty

        MOVI(7, 80),
        ADDI(7, 7, -1),
        BNEZ(7, BR(-2)),
        L32I(5, 2, 0x10),
        SRLI(5, 5, 4),
        S32I(5, 3, 0), // final duty after two fade steps
        L32I(5, 2, 0xc4),
        MOVI(6, LEDC_DUTY_CHNG_END_CH0),
        AND(5, 5, 6),
        S32I(5, 3, 0), // prove the fade-end status bit latched
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(400);

    expect([...c.drainUart()]).toEqual([1, 3, LEDC_DUTY_CHNG_END_CH0]);
  });

  it('stops an active LEDC fade with an ESP-IDF-style fixed duty update', () => {
    const LEDC_FADE_UP_SIX_STEPS = LEDC_DUTY_START | LEDC_DUTY_INC | (6 << 20) | (2 << 10) | 1;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [LEDC, UART, LEDC_CLK_EN, LEDC_TIMER0_3BIT_DIV1, 1 << 4, LEDC_FADE_UP_SIX_STEPS, LEDC_DUTY_START],
      [
        L32R(2, 0), // LEDC
        L32R(3, 1), // UART
        L32R(4, 2),
        S32I(4, 2, 0xd0), // CONF.CLK_EN
        L32R(4, 3),
        S32I(4, 2, 0xa0), // TIMER0: 3-bit resolution, divider=1.0
        L32R(4, 4),
        S32I(4, 2, 0x08), // CH0 starts at duty 1
        L32R(4, 5),
        S32I(4, 2, 0x0c), // start a long hardware fade toward duty 7

        MOVI(7, 70),
        ADDI(7, 7, -1),
        BNEZ(7, BR(-2)),
        L32I(5, 2, 0x10),
        SRLI(6, 5, 4),
        S32I(6, 3, 0), // partial duty, after fade has moved

        S32I(5, 2, 0x08), // ledc_fade_stop snapshots current raw DUTY_R
        L32R(4, 6),
        S32I(4, 2, 0x0c), // fixed update with zero fade params aborts the fade

        MOVI(7, 220),
        ADDI(7, 7, -1),
        BNEZ(7, BR(-2)),
        L32I(5, 2, 0x10),
        SRLI(5, 5, 4),
        S32I(5, 3, 0), // final duty must stay pinned at the snapshot
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(700);
    const output = [...c.drainUart()];

    expect(output).toHaveLength(2);
    expect(output[0]).toBeGreaterThan(1);
    expect(output[0]).toBeLessThan(7);
    expect(output[1]).toBe(output[0]);
  });

  it('routes LEDC duty-change interrupts through the interrupt matrix', () => {
    const SCRATCH = ESP32S3_DRAM_BASE + 0x900;
    const INTMTX = 0x600c2000;
    const LEDC_DUTY_CHNG_END_CH0 = 1 << 4;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        UART,
        LEDC,
        INTMTX,
        SCRATCH,
        ESP32S3_IRAM_BASE,
        LEDC_CLK_EN,
        LEDC_TIMER0_2BIT_DIV1,
        2 << 4,
        LEDC_DUTY_START,
      ],
      [
        L32R(2, 0), // UART
        L32R(3, 1), // LEDC
        L32R(4, 2), // interrupt matrix
        L32R(5, 3), // SCRATCH counter
        MOVI(6, 0),
        S32I(6, 5, 0), // counter = 0
        L32R(6, 4),
        WSR(6, SR.VECBASE),
        MOVI(6, 0),
        S32I(6, 4, 0x8c), // LEDC source -> CPU line 0
        MOVI(6, 1),
        WSR(6, SR.INTENABLE),
        RSIL(8, 0),

        L32R(6, 5),
        S32I(6, 3, 0xd0), // CONF.CLK_EN
        L32R(6, 6),
        S32I(6, 3, 0xa0), // TIMER0: 2-bit resolution, divider=1.0
        L32R(6, 7),
        S32I(6, 3, 0x08), // CH0 duty
        MOVI(6, LEDC_DUTY_CHNG_END_CH0),
        S32I(6, 3, 0xc8), // INT_ENA: duty-change-end ch0

        L32R(6, 8),
        S32I(6, 3, 0x0c), // first duty-start interrupt
        MOVI(7, 1),
        L32I(8, 5, 0),
        BNE(8, 7, BR(-2)),
        L32R(6, 8),
        S32I(6, 3, 0x0c), // second interrupt after ISR clear
        MOVI(7, 2),
        L32I(8, 5, 0),
        BNE(8, 7, BR(-2)),
        S32I(8, 2, 0x00),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 3), // SCRATCH
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 1), // LEDC
        MOVI(4, LEDC_DUTY_CHNG_END_CH0),
        S32I(4, 3, 0xcc), // INT_CLR: duty-change-end ch0
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(500);

    expect([...c.drainUart()]).toEqual([2]);
  });

  it('generates LEDC low-speed timer overflow interrupts', () => {
    const SCRATCH = ESP32S3_DRAM_BASE + 0x920;
    const INTMTX = 0x600c2000;
    const LEDC_LSTIMER0_OVF = 1 << 0;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, LEDC, INTMTX, SCRATCH, ESP32S3_IRAM_BASE, LEDC_CLK_EN, LEDC_TIMER0_8BIT_DIV1],
      [
        L32R(2, 0), // UART
        L32R(3, 1), // LEDC
        L32R(4, 2), // interrupt matrix
        L32R(5, 3), // SCRATCH counter
        MOVI(6, 0),
        S32I(6, 5, 0), // counter = 0
        L32R(6, 4),
        WSR(6, SR.VECBASE),
        MOVI(6, 0),
        S32I(6, 4, 0x8c), // LEDC source -> CPU line 0
        MOVI(6, 1),
        WSR(6, SR.INTENABLE),
        RSIL(8, 0),

        L32R(6, 5),
        S32I(6, 3, 0xd0), // CONF.CLK_EN
        L32R(6, 6),
        S32I(6, 3, 0xa0), // TIMER0: 8-bit resolution, divider=1.0
        MOVI(6, LEDC_LSTIMER0_OVF),
        S32I(6, 3, 0xc8), // INT_ENA: low-speed timer0 overflow

        MOVI(7, 3),
        L32I(8, 5, 0),
        BNE(8, 7, BR(-2)),
        S32I(8, 2, 0x00),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 3), // SCRATCH
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 1), // LEDC
        MOVI(4, LEDC_LSTIMER0_OVF),
        S32I(4, 3, 0xcc), // INT_CLR: low-speed timer0 overflow
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(5_000);

    expect([...c.drainUart()]).toEqual([3]);
  });

  it('generates LEDC channel overflow-count interrupts', () => {
    const SCRATCH = ESP32S3_DRAM_BASE + 0x940;
    const INTMTX = 0x600c2000;
    const LEDC_OVF_CNT_CH0 = 1 << 12;
    const LEDC_CH0_OVF_EVERY_TWO_AND_RESET = (1 << 16) | (1 << 15) | (1 << 5);
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        UART,
        LEDC,
        INTMTX,
        SCRATCH,
        ESP32S3_IRAM_BASE,
        LEDC_CLK_EN,
        LEDC_TIMER0_8BIT_DIV1,
        LEDC_CH0_OVF_EVERY_TWO_AND_RESET,
        LEDC_OVF_CNT_CH0,
      ],
      [
        L32R(2, 0), // UART
        L32R(3, 1), // LEDC
        L32R(4, 2), // interrupt matrix
        L32R(5, 3), // SCRATCH counter
        MOVI(6, 0),
        S32I(6, 5, 0), // counter = 0
        L32R(6, 4),
        WSR(6, SR.VECBASE),
        MOVI(6, 0),
        S32I(6, 4, 0x8c), // LEDC source -> CPU line 0
        MOVI(6, 1),
        WSR(6, SR.INTENABLE),
        RSIL(8, 0),

        L32R(6, 5),
        S32I(6, 3, 0xd0), // CONF.CLK_EN
        L32R(6, 6),
        S32I(6, 3, 0xa0), // TIMER0: 8-bit resolution, divider=1.0
        L32R(6, 7),
        S32I(6, 3, 0x00), // CH0: reset overflow counter, enable, max count = 2
        L32R(6, 8),
        S32I(6, 3, 0xc8), // INT_ENA: channel0 overflow counter

        MOVI(7, 3),
        L32I(8, 5, 0),
        BNE(8, 7, BR(-2)),
        S32I(8, 2, 0x00),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 3), // SCRATCH
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 1), // LEDC
        L32R(4, 8),
        S32I(4, 3, 0xcc), // INT_CLR: channel0 overflow counter
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(15_000);

    expect([...c.drainUart()]).toEqual([3]);
  });

  it('high-bank pins (IO33 via OUT1/ENABLE1) emit events too', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << (33 - 32)], [
      L32R(2, 0),
      L32R(3, 1),
      S32I(3, 2, 0x30), // ENABLE1_W1TS
      S32I(3, 2, 0x14), // OUT1_W1TS
      S32I(3, 2, 0x18), // OUT1_W1TC
      S32I(3, 2, 0x14), // OUT1_W1TS
      J(BR(-1)), // park
    ]);
    const c = core(image);
    const io33 = c.step(100).events.filter((e) => e.pin === 'IO33');
    expect(io33.map((e) => e.level)).toEqual([1, 0, 1]); // first drive (low) isn't an edge
  });

  it('UART0: tx bytes land in drainUart; rx echoes through STATUS + FIFO', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      L32R(2, 0),
      MOVI(3, 0x48), // 'H'
      S32I(3, 2, 0x00), // FIFO ← tx
      MOVI(3, 0x69), // 'i'
      S32I(3, 2, 0x00),
      // echo loop: poll RXFIFO_CNT, read FIFO, write it back
      L32I(4, 2, 0x1c), // STATUS
      BEQZ(4, BR(-2)), // nothing yet → re-poll STATUS
      L32I(5, 2, 0x00), // FIFO → byte
      S32I(5, 2, 0x00), // echo
      J(BR(-5)), // back to the STATUS poll
    ]);
    const c = core(image);
    c.step(50);
    expect([...c.drainUart()]).toEqual([0x48, 0x69]);
    c.uartWrite(0x42);
    c.step(50);
    expect([...c.drainUart()]).toEqual([0x42]);
  });

  it('CALL0/RET subroutines work (call0 ABI, a0 link register)', () => {
    // main: a2 = 5; call double twice; tx a2 over UART; park.
    // double: a2 += a2; ret.
    // 1 literal → code starts at byte 8; 'double' must sit 4-aligned:
    // index 8 → 8 + 24 = byte 32. Two NOPs pad it there.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      MOVI(2, 5),
      CALL0_TO(8),
      CALL0_TO(8),
      L32R(6, 0),
      S32I(2, 6, 0x00), // tx the result
      J(BR(-1)), // park
      NOP(),
      NOP(),
      // double:
      ADD(2, 2, 2),
      RET(),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([20]); // 5 doubled twice
  });

  it('SLLI/shift arithmetic and the parked loop never wedge', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      MOVI(2, 3),
      SLLI(3, 2, 4), // a3 = 3 << 4 = 48 = '0'
      L32R(4, 0),
      S32I(3, 4, 0x00), // tx '0'
      J(BR(-1)),
    ]);
    const c = core(image);
    const res = c.step(100);
    expect(res.cycles).toBeGreaterThanOrEqual(100);
    expect([...c.drainUart()]).toEqual([0x30]);
  });

  it('refuses Intel-HEX and unimplemented instructions loudly', () => {
    const c = new Esp32s3Core();
    expect(() => { c.loadFirmware(':10000000'); }).toThrow('RAW machine-code');
    // ILL.N (0xf06d) — the density space's deliberate illegal
    // instruction, which this core refuses like everything unknown.
    c.loadFirmware(Uint8Array.from([0x6d, 0xf0, 0x00]));
    expect(() => c.step(1)).toThrow('unimplemented Xtensa instruction');
  });

  it('reset() restarts from power-on; firmware and pin events replay', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 2], [
      L32R(2, 0),
      L32R(3, 1),
      S32I(3, 2, 0x24),
      S32I(3, 2, 0x08),
      S32I(3, 2, 0x0c),
      J(BR(-1)),
    ]);
    const c = core(image);
    const first = c.step(50).events.filter((e) => e.pin === 'IO2').map((e) => e.level);
    c.reset();
    const again = c.step(50).events.filter((e) => e.pin === 'IO2').map((e) => e.level);
    expect(again).toEqual(first);
    expect(c.inspect().cycles).toBe(50);
  });
});

describe('Esp32s3Core — 16-bit code-density forms (slice 2)', () => {
  const w16 = (n: { w16: number }): number[] => [n.w16 & 0xff, (n.w16 >> 8) & 0xff];

  it('narrow encodings match the disassembler fixtures exactly', () => {
    expect(w16(RET_N())).toEqual([0x0d, 0xf0]);
    expect(w16(NOP_N())).toEqual([0x3d, 0xf0]);
    expect(MOV_N(0, 0).w16).toBe(0x000d);
    expect(MOVI_N(0, 0).w16 & 0x008f).toBe(0x000c);
    expect(ADD_N(0, 0, 0).w16 & 0x000f).toBe(0x000a);
    expect(L32I_N(0, 0, 0).w16 & 0x000f).toBe(0x0008);
    expect(S32I_N(0, 0, 0).w16 & 0x000f).toBe(0x0009);
  });

  it("MOVI.N covers its asymmetric −32..95 range and MOV.N moves s → t", () => {
    // a2 = 95, a3 = −32 (both ends of the range); a4 = a2 + a3 = 63.
    // Then the MOV.N direction probe: a5 = 7, a6 = 42, MOV.N a6, a5 —
    // if dest/src were transposed, the UART would say 42, not 7.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      MOVI_N(2, 95),
      MOVI_N(3, -32),
      ADD_N(4, 2, 3),
      L32R(7, 0),
      S32I(4, 7, 0x00), // tx 63
      MOVI_N(5, 7),
      MOVI_N(6, 42),
      MOV_N(6, 5),
      S32I(6, 7, 0x00), // tx 7
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([63, 7]);
  });

  it('ADDI.N: t=0 means −1; L32I.N/S32I.N round-trip through DRAM', () => {
    const SCRATCH = 0x3fc88000 + 0x200;
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH], [
      MOVI_N(2, 5),
      ADDI_N(2, 2, -1), // 4
      ADDI_N(2, 2, -1), // 3
      ADDI_N(2, 2, 15), // 18
      L32R(3, 1),
      S32I_N(2, 3, 8), // narrow store
      L32I_N(4, 3, 8), // narrow load back
      L32R(7, 0),
      S32I(4, 7, 0x00), // tx 18
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([18]);
  });

  it('BEQZ.N branches forward over the trap; mixed-width layout resolves', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      L32R(7, 0),
      MOVI_N(2, 0),
      BEQZ_N_TO(2, 5), // taken → skip the trap byte
      MOVI(3, 0x66), // trap: would tx 0x66
      S32I(3, 7, 0x00),
      MOVI_N(4, 90), // target
      S32I(4, 7, 0x00), // tx 90 only
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([90]);
  });

  it('a mixed-width blink: narrow delay loop, index-based jumps, zero jitter', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 7], [
      L32R(2, 0),
      L32R(3, 1),
      S32I(3, 2, 0x24), // enable IO7
      // [3] loop:
      S32I(3, 2, 0x08), // high
      MOVI_N(4, 6),
      ADDI_N(4, 4, -1), // [5] narrow delay body
      BNEZ_TO(4, 5),
      S32I(3, 2, 0x0c), // low
      MOVI_N(4, 6),
      ADDI_N(4, 4, -1), // [9]
      BNEZ_TO(4, 9),
      J_TO(3),
    ]);
    const c = core(image);
    const io7 = c.step(800).events.filter((e) => e.pin === 'IO7');
    expect(io7.length).toBeGreaterThan(8);
    for (let i = 1; i < io7.length; i++) {
      expect(io7[i]?.level).toBe(io7[i - 1]?.level === 1 ? 0 : 1);
    }
    const periods = new Set<number>();
    for (let i = 2; i < io7.length; i++) {
      periods.add((io7[i]?.cycle ?? 0) - (io7[i - 2]?.cycle ?? 0));
    }
    expect(periods.size).toBe(1);
  });

  it('RET.N returns; RETW.N (windowed) refuses loudly', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      MOVI_N(2, 3),
      CALL0_TO(7), // the assembler enforces the 4-aligned target
      L32R(7, 0),
      S32I(2, 7, 0x00),
      J(BR(-1)),
      NOP(),
      NOP(), // pad: code[7] lands at byte 8 + 2+3+3+3+3+3+3 = 28 ✓
      // [7] double:
      ADD_N(2, 2, 2),
      RET_N(),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([6]);

    const d = new Esp32s3Core();
    d.loadFirmware(Uint8Array.from([0x1d, 0xf0])); // RETW.N with a0 = 0
    expect(() => d.step(1)).toThrow('call0-style link');
  });
});

describe('Esp32s3Core — windowed ABI (slice 3)', () => {
  it('ENTRY/RETW byte fixtures match real objdump output', () => {
    // "entry a1, 32" disassembles as "36 41 00".
    expect(word(ENTRY(1, 32))).toEqual([0x36, 0x41, 0x00]);
    expect(word(RETW())).toEqual([0x90, 0x00, 0x00]);
    expect(RETW_N().w16).toBe(0xf01d);
    expect(word(CALLXN(2, 5))).toEqual([0xe0, 0x05, 0x00]);
  });

  it('CALL8/ENTRY rotate the window: args arrive in a2, locals survive', () => {
    // crt0: a2=UART, a3=sentinel 7; a10=arg 5; call8 fn; tx a10 (retval)
    // and a3 (sentinel) — both must survive the callee's window.
    // fn: entry; a2 = arg; a2 += 1; retw → caller sees retval in a10.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      L32R(2, 0),
      MOVI(3, 7),
      MOVI(10, 5),
      CALLN_TO(2, 8), // call8 → fn at code[8] (4-aligned: 8 + 21 + pad)
      S32I(10, 2, 0x00), // tx retval (6)
      S32I(3, 2, 0x00), // tx sentinel (7)
      J(BR(-1)),
      NOP(), // pad: code[8] at byte 8 + 21 + 3 = 32 ✓
      // fn:
      ENTRY(1, 16),
      ADDI(2, 2, 1), // retval = arg + 1
      RETW(),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([6, 7]);
  });

  it('deep CALL8 recursion forces spills and fills; every frame survives', () => {
    // rec(d): if d==0 return 0; r = rec(d-1); tx own depth; return d + r.
    // Depth 12 → 14 live frames × 8 regs ≫ 64 physical: multiple
    // overflow spills on the way down, underflow fills on the way up.
    // The tx sequence proves each frame's saved register (a3) and the
    // crt0 frame's UART pointer (a2) round-tripped through memory.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      // crt0:
      L32R(2, 0), // a2 = UART
      ADDI(3, 1, -16),
      S32I(1, 3, 4), // [sp−12] ← sp: init the base save area like crt0 must
      MOVI(10, 12), // arg
      CALLN_TO(2, 8), // call8 rec
      S32I(10, 2, 0x00), // tx total (78) through crt0's restored a2
      J(BR(-1)),
      NOP(), // pad: rec at code[8] = byte 8 + 24 = 32 ✓
      // rec: frame 32 — a call8-making function must reserve 16 bytes
      // of base save area PLUS 16 for its callee's extra save area
      // (the ABI rule behind the canonical "entry a1, 32").
      ENTRY(1, 32),
      MOV_N(3, 2), // a3 = depth (this frame's sentinel)
      BNEZ_TO(2, 13),
      MOVI(2, 0), // base case: return 0
      RETW(),
      // [13] recurse:
      ADDI(10, 2, -1),
      CALLN_TO(2, 8),
      L32R(7, 0), // a7 = UART (fresh in this window)
      S32I(3, 7, 0x00), // tx own depth — only correct if a3 survived
      ADD(2, 3, 10), // return depth + child sum
      RETW_N(), // narrow return on the unwind path
    ]);
    const c = core(image);
    c.step(2_000);
    expect([...c.drainUart()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 78]);
  });

  it('CALLX8 calls through a register; RETW frame-size mismatch refuses', () => {
    const fnAddr = ESP32S3_IRAM_BASE + 12 + 24; // 2 literals → code at 12; code[8] = byte 36 (4-aligned)
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, fnAddr], [
      L32R(2, 0),
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(4, 1), // fn address
      MOVI(10, 41),
      CALLXN(2, 4), // call8 via a4
      S32I(10, 2, 0x00), // tx 42
      J(BR(-1)),
      // fn:
      ENTRY(1, 16),
      ADDI(2, 2, 1),
      RETW(),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([42]);
  });
});

describe('Esp32s3Core — exceptions + level-1 interrupts (slice 4)', () => {
  const SCRATCH = 0x3fc88000 + 0x400;

  it('RSR/WSR round-trip; CCOUNT advances exactly one per instruction', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, 0x1234], [
      L32R(2, 0),
      L32R(3, 1),
      WSR(3, SR.VECBASE),
      RSR(4, SR.VECBASE),
      S32I(4, 2, 0x00), // tx 0x34 (low byte of the round-tripped value)
      RSR(5, SR.CCOUNT),
      NOP(),
      NOP(),
      NOP(),
      RSR(6, SR.CCOUNT),
      SUB(6, 6, 5), // exactly 4 instructions between the reads
      S32I(6, 2, 0x00),
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(40);
    expect([...c.drainUart()]).toEqual([0x34, 4]);
  });

  it('the CCOMPARE0 timer interrupt vectors, the handler re-arms, main counts 3 ticks', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE], [
      // main:
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = SCRATCH
      MOVI(4, 0),
      S32I(4, 3, 0), // counter = 0
      L32R(5, 2),
      WSR(5, SR.VECBASE), // vectors at the image base (1KB-aligned)
      MOVI(6, 64), // 1 << 6 — the timer0 line
      WSR(6, SR.INTENABLE),
      RSR(7, SR.CCOUNT),
      ADDMI(7, 7, 256),
      WSR(7, SR.CCOMPARE0),
      RSIL(8, 0), // unmask (reset leaves INTLEVEL = 15)
      // loop until counter == 3:
      MOVI(9, 3),
      L32I(4, 3, 0), // [13]
      BNE(4, 9, BR(-2)),
      S32I(4, 2, 0x00), // tx 3
      J(BR(-1)),
      // the level-1 user vector lives at VECBASE + 0x340:
      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1), // save a2 the architectural way
      L32R(2, 1), // a2 = SCRATCH (L32R reaches backward ✓)
      S32I(3, 2, 8), // save a3 to scratch
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0), // counter++
      RSR(3, SR.CCOMPARE0),
      ADDMI(3, 3, 256),
      WSR(3, SR.CCOMPARE0), // re-arm — also CLEARS the pending bit
      L32I(3, 2, 8), // restore a3
      RSR(2, SR.EXCSAVE1), // restore a2
      RFE(),
    ]);
    const c = core(image);
    c.step(2_000);
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('WAITI parks until an enabled level-1 timer interrupt wakes the core', () => {
    // Source-checked against the Cadence ISA summary/ida-xtensa2:
    // WAITI encodes as 0x007000 | (imm4 << 8) and waits for an
    // interrupt above PS.INTLEVEL. This slice models level-1 wakeups.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE], [
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = SCRATCH
      MOVI(4, 0),
      S32I(4, 3, 0), // counter = 0
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      MOVI(6, 64),
      WSR(6, SR.INTENABLE),
      RSR(7, SR.CCOUNT),
      ADDI(7, 7, 24),
      WSR(7, SR.CCOMPARE0),
      WAITI(0), // no further instructions retire until timer0 wakes us
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx 1 after RFE resumes past WAITI
      J(BR(-1)),

      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1),
      L32R(2, 1),
      S32I(3, 2, 8),
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0),
      RSR(3, SR.CCOMPARE0),
      ADDMI(3, 3, 256),
      WSR(3, SR.CCOMPARE0),
      L32I(3, 2, 8),
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(400);
    expect([...c.drainUart()]).toEqual([1]);
  });

  it('RSIL masks a pending interrupt; lowering INTLEVEL delivers it', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE], [
      L32R(2, 0),
      L32R(3, 1),
      MOVI(4, 0),
      S32I(4, 3, 0),
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      MOVI(6, 64),
      WSR(6, SR.INTENABLE),
      RSR(7, SR.CCOUNT),
      ADDI(7, 7, 20),
      WSR(7, SR.CCOMPARE0), // fires soon — but INTLEVEL is still 15
      // burn well past the match while masked:
      MOVI(8, 30),
      ADDI(8, 8, -1),
      BNEZ(8, BR(-2)),
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx 0 — latched but not delivered
      RSIL(8, 0), // unmask → delivers immediately
      NOP(),
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx 1
      J(BR(-1)),
      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1),
      L32R(2, 1),
      S32I(3, 2, 8),
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0),
      RSR(3, SR.CCOMPARE0),
      ADDMI(3, 3, 7936), // re-arm far away — one tick only
      WSR(3, SR.CCOMPARE0),
      L32I(3, 2, 8),
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(500);
    expect([...c.drainUart()]).toEqual([0, 1]);
  });

  it('unimplemented special registers refuse loudly', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [], [RSR(2, 99), J(BR(-1))]);
    const c = core(image);
    expect(() => c.step(5)).toThrow('unimplemented special register 99');
  });
});

describe('Esp32s3Core — peripheral interrupt lines through the matrix (slice 6)', () => {
  const SCRATCH = 0x3fc88000 + 0x800;
  const INTMTX = 0x600c2000;
  // GPIO_PINn config values (INT_TYPE [9:7], INT_ENA bit 13):
  const PIN_POSEDGE = (1 << 7) | (1 << 13);
  const PIN_HIGH_LEVEL = (5 << 7) | (1 << 13);

  it('a rising-edge GPIO interrupt vectors through the matrix; falling edges do not', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE, GPIO, PIN_POSEDGE, INTMTX], [
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = SCRATCH
      MOVI(4, 0),
      S32I(4, 3, 0), // counter = 0
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      L32R(5, 3), // a5 = GPIO base
      L32R(6, 4),
      S32I(6, 5, 0x84), // GPIO_PIN4 ← posedge | INT_ENA
      L32R(7, 5), // a7 = interrupt matrix
      MOVI(6, 0),
      S32I(6, 7, 0x40), // GPIO source → CPU line 0
      MOVI(6, 1),
      WSR(6, SR.INTENABLE),
      RSIL(8, 0),
      // wait for counter == 2, settle, re-read — if falling edges
      // wrongly counted, the re-read would say 3:
      MOVI(9, 2),
      L32I(4, 3, 0),
      BNE(4, 9, BR(-2)),
      MOVI(8, 40),
      ADDI(8, 8, -1),
      BNEZ(8, BR(-2)),
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx the settled count
      J(BR(-1)),
      PAD_TO(0x340),
      // handler: counter++, drop the latched edge via STATUS_W1TC.
      WSR(2, SR.EXCSAVE1),
      L32R(2, 1), // a2 = SCRATCH
      S32I(3, 2, 8),
      S32I(4, 2, 12), // main polls in a3/a4 — save both
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0),
      L32R(3, 3), // a3 = GPIO base
      MOVI(4, 1 << 4),
      S32I(4, 3, 0x4c), // STATUS_W1TC
      L32I(4, 2, 12),
      L32I(3, 2, 8),
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(150); // config settles; IO4 idles low
    c.setPin('IO4', 1);
    c.step(100);
    c.setPin('IO4', 0); // falling edge — must NOT count
    c.step(100);
    c.setPin('IO4', 1);
    c.step(400);
    expect([...c.drainUart()]).toEqual([2]);
  });

  it('a high-level GPIO interrupt re-fires after W1TC until the level drops', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SCRATCH, ESP32S3_IRAM_BASE, GPIO, PIN_HIGH_LEVEL, INTMTX], [
      L32R(2, 0),
      L32R(3, 1),
      MOVI(4, 0),
      S32I(4, 3, 0),
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      L32R(5, 3),
      L32R(6, 4),
      S32I(6, 5, 0x84), // GPIO_PIN4 ← high-level | INT_ENA
      L32R(7, 5),
      MOVI(6, 0),
      S32I(6, 7, 0x40),
      MOVI(6, 1),
      WSR(6, SR.INTENABLE),
      RSIL(8, 0),
      // While IO4 is high the handler starves this loop (the line
      // re-asserts after every W1TC — that is the point); once the
      // host drops the pin, the count must have climbed ≥ 3.
      MOVI(9, 3),
      L32I(4, 3, 0),
      BLT(4, 9, BR(-2)),
      MOVI(4, 0xaa),
      S32I(4, 2, 0x00),
      J(BR(-1)),
      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1),
      L32R(2, 1),
      S32I(3, 2, 8),
      S32I(4, 2, 12),
      L32I(3, 2, 0),
      ADDI(3, 3, 1),
      S32I(3, 2, 0),
      L32R(3, 3),
      MOVI(4, 1 << 4),
      S32I(4, 3, 0x4c), // W1TC — re-asserts while the level holds
      L32I(4, 2, 12),
      L32I(3, 2, 8),
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(150);
    c.setPin('IO4', 1);
    c.step(600); // handler fires repeatedly; main is starved
    c.setPin('IO4', 0);
    c.step(300); // level gone → main finally runs and reports
    expect([...c.drainUart()]).toEqual([0xaa]);
  });

  it('a fully interrupt-driven UART echo: RXFIFO_FULL wakes the handler per byte', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, ESP32S3_IRAM_BASE, INTMTX], [
      L32R(2, 0), // a2 = UART
      L32R(5, 1),
      WSR(5, SR.VECBASE),
      MOVI(3, 0),
      S32I(3, 2, 0x24), // CONF1: RXFIFO_FULL_THRHD = 0 (any byte)
      MOVI(3, 1),
      S32I(3, 2, 0x0c), // INT_ENA = RXFIFO_FULL
      L32R(7, 2),
      MOVI(3, 1),
      S32I(3, 7, 0x6c), // UART source → CPU line 1
      MOVI(3, 2),
      WSR(3, SR.INTENABLE),
      RSIL(8, 0),
      J(BR(-1)), // main does NOTHING — the echo is all interrupts
      PAD_TO(0x340),
      // main is parked and reads no registers, so a3 needs no save.
      WSR(2, SR.EXCSAVE1),
      L32R(2, 0),
      L32I(3, 2, 0x00), // FIFO read — draining deasserts the line
      S32I(3, 2, 0x00), // echo
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(100);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWrite(0x77);
    c.step(100);
    expect([...c.drainUart()]).toEqual([0x77]);
    c.uartWrite(0x55); // the line must re-assert for a second byte
    c.step(100);
    expect([...c.drainUart()]).toEqual([0x55]);
  });

  it('routes UART1 RXFIFO_FULL through its own interrupt matrix source', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART1, UART, ESP32S3_IRAM_BASE, INTMTX], [
      L32R(2, 0), // a2 = UART1
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      MOVI(3, 0),
      S32I(3, 2, 0x24), // CONF1: RXFIFO_FULL_THRHD = 0 (any byte)
      MOVI(3, 1),
      S32I(3, 2, 0x0c), // INT_ENA = RXFIFO_FULL
      L32R(7, 3),
      MOVI(3, 1),
      S32I(3, 7, 0x70), // UART1 source -> CPU line 1
      MOVI(3, 2),
      WSR(3, SR.INTENABLE),
      RSIL(8, 0),
      J(BR(-1)),

      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1),
      L32R(2, 0), // UART1
      L32R(4, 1), // UART0 test output
      L32I(3, 2, 0x00), // UART1 FIFO read
      S32I(3, 4, 0x00), // report over UART0
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(100);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWriteTo(1, 0x5c);
    c.step(100);
    expect([...c.drainUart()]).toEqual([0x5c]);
  });

  it('routes UART2 RXFIFO_FULL through its own interrupt matrix source', () => {
    // ESP-IDF v5.5.4 ESP32-S3 headers: SOC_UART_NUM is 3,
    // REG_UART_BASE(2) is UART0 + 0x2e000, and UART2_INTR_MAP is
    // INTERRUPT_CORE0_BASE + 0x074.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART2, UART, ESP32S3_IRAM_BASE, INTMTX], [
      L32R(2, 0), // a2 = UART2
      L32R(5, 2),
      WSR(5, SR.VECBASE),
      MOVI(3, 0),
      S32I(3, 2, 0x24), // CONF1: RXFIFO_FULL_THRHD = 0 (any byte)
      MOVI(3, 1),
      S32I(3, 2, 0x0c), // INT_ENA = RXFIFO_FULL
      L32R(7, 3),
      MOVI(3, 1),
      S32I(3, 7, 0x74), // UART2 source -> CPU line 1
      MOVI(3, 2),
      WSR(3, SR.INTENABLE),
      RSIL(8, 0),
      J(BR(-1)),

      PAD_TO(0x340),
      WSR(2, SR.EXCSAVE1),
      L32R(2, 0), // UART2
      L32R(4, 1), // UART0 test output
      L32I(3, 2, 0x00), // UART2 FIFO read
      S32I(3, 4, 0x00), // report over UART0
      RSR(2, SR.EXCSAVE1),
      RFE(),
    ]);
    const c = core(image);
    c.step(100);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWriteTo(2, 0x6d);
    c.step(100);
    expect([...c.drainUart()]).toEqual([0x6d]);
  });

  it('runs an I2C0 master write command list and routes completion through I2C_EXT0', () => {
    // Context7: ESP-IDF v5.5.4 I2C master supports blocking and async
    // completion; source-checked against i2c_ll.h command fields and
    // esp32s3.peripherals.ld/I2C0 plus I2C_EXT0_INTR_MAP at +0x0A8.
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        I2C0,
        UART,
        ESP32S3_IRAM_BASE,
        INTMTX,
        I2C_TRANS_COMPLETE_INT,
        I2C_ALL_INTS,
        I2C_CMD_RESTART,
        I2C_CMD_WRITE2_ACK,
        I2C_CMD_STOP,
        I2C_CMD_END,
        0x3f,
      ],
      [
        L32R(2, 0), // a2 = I2C0
        L32R(6, 1), // a6 = UART0 for reporting
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(3, 5),
        S32I(3, 2, 0x24), // clear stale I2C interrupts
        L32R(3, 4),
        S32I(3, 2, 0x28), // enable TRANS_COMPLETE
        L32R(7, 3),
        MOVI(3, 1),
        S32I(3, 7, 0xa8), // I2C_EXT0 -> CPU line 1
        MOVI(3, 2),
        WSR(3, SR.INTENABLE),
        MOVI(3, 0xa0),
        S32I(3, 2, 0x1c), // address byte 0x50 write
        MOVI(3, 0x33),
        S32I(3, 2, 0x1c), // payload
        L32R(3, 6),
        S32I(3, 2, 0x58), // START/RESTART
        L32R(3, 7),
        S32I(3, 2, 0x5c), // WRITE 2, check ACK=0
        L32R(3, 8),
        S32I(3, 2, 0x60), // STOP
        L32R(3, 9),
        S32I(3, 2, 0x64), // END
        RSIL(12, 12),
        MOVI(3, 0x20),
        S32I(3, 2, 0x04), // TRANS_START
        WAITI(0),
        L32I(4, 2, 0x08), // SR: tx FIFO count should be 0
        SRLI(4, 4, 15),
        SRLI(4, 4, 3),
        L32R(5, 10),
        AND(4, 4, 5),
        S32I(4, 6, 0),
        L32I(4, 2, 0x58), // COMD0 done bit
        SRAI(4, 4, 31),
        MOVI(5, 1),
        AND(4, 4, 5),
        S32I(4, 6, 0),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(6, 1),
        L32I(3, 2, 0x2c), // INT_ST
        L32R(4, 4),
        AND(3, 3, 4),
        MOVI(5, 0),
        BEQZ(3, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // report completion IRQ
        L32R(3, 4),
        S32I(3, 2, 0x24), // clear completion
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0, 1]);
    expect([...c.drainI2cWrites(0)]).toEqual([0xa0, 0x33]);
  });

  it('fills the I2C0 RX FIFO for a master READ command and clears completion raw', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [I2C0, UART, I2C_TRANS_COMPLETE_INT, I2C_ALL_INTS, I2C_CMD_RESTART, I2C_CMD_READ2, I2C_CMD_STOP, I2C_CMD_END, 0x3f],
      [
        L32R(2, 0), // I2C0
        L32R(6, 1), // UART0
        L32R(3, 3),
        S32I(3, 2, 0x24), // clear all I2C raw bits
        L32R(3, 4),
        S32I(3, 2, 0x58),
        L32R(3, 5),
        S32I(3, 2, 0x5c), // READ two synthetic bytes
        L32R(3, 6),
        S32I(3, 2, 0x60),
        L32R(3, 7),
        S32I(3, 2, 0x64),
        MOVI(3, 0x20),
        S32I(3, 2, 0x04), // TRANS_START
        L32I(4, 2, 0x20), // INT_RAW
        L32R(5, 2),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // completion raw present
        L32I(4, 2, 0x08), // SR: RXFIFO_CNT
        SRLI(4, 4, 8),
        L32R(5, 8),
        AND(4, 4, 5),
        S32I(4, 6, 0),
        L32I(4, 2, 0x1c),
        S32I(4, 6, 0),
        L32I(4, 2, 0x1c),
        S32I(4, 6, 0),
        L32R(3, 2),
        S32I(3, 2, 0x24), // clear completion
        L32I(4, 2, 0x20),
        L32R(5, 2),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // 0 after clear
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(600);
    expect([...c.drainUart()]).toEqual([1, 2, 0, 0, 0]);
  });

  it('routes I2C1 forced NACK through its own interrupt matrix source', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        I2C1,
        UART,
        ESP32S3_IRAM_BASE,
        INTMTX,
        I2C_NACK_INT,
        I2C_ALL_INTS,
        I2C_CMD_RESTART,
        I2C_CMD_WRITE1_ACK_EXPECT_NACK,
        I2C_CMD_STOP,
        I2C_CMD_END,
      ],
      [
        L32R(2, 0), // a2 = I2C1
        L32R(6, 1), // a6 = UART0 for reporting
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(3, 5),
        S32I(3, 2, 0x24), // clear all I2C raw bits
        L32R(3, 4),
        S32I(3, 2, 0x28), // enable NACK
        L32R(7, 3),
        MOVI(3, 1),
        S32I(3, 7, 0xac), // I2C_EXT1 -> CPU line 1
        MOVI(3, 2),
        WSR(3, SR.INTENABLE),
        MOVI(3, 0xa0),
        S32I(3, 2, 0x1c),
        L32R(3, 6),
        S32I(3, 2, 0x58),
        L32R(3, 7),
        S32I(3, 2, 0x5c), // WRITE 1, impossible expected ACK=1
        L32R(3, 8),
        S32I(3, 2, 0x60),
        L32R(3, 9),
        S32I(3, 2, 0x64),
        RSIL(12, 12),
        MOVI(3, 0x20),
        S32I(3, 2, 0x04), // TRANS_START
        WAITI(0),
        L32I(4, 2, 0x5c), // COMD1 done bit
        SRAI(4, 4, 31),
        MOVI(5, 1),
        AND(4, 4, 5),
        S32I(4, 6, 0),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(6, 1),
        L32I(3, 2, 0x2c), // INT_ST
        L32R(4, 4),
        AND(3, 3, 4),
        MOVI(5, 0),
        BEQZ(3, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // report NACK IRQ
        L32R(3, 4),
        S32I(3, 2, 0x24), // clear NACK
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 1]);
    expect([...c.drainI2cWrites(1)]).toEqual([0xa0]);
  });

  it('runs a GPSPI2 CPU-FIFO master write and routes TRANS_DONE through SPI2_DMA', () => {
    // Context7: ESP-IDF v5.5.4 SPI master polling completion waits for
    // cmd.usr to clear; source-checked against spi_reg.h/GPSPI2 plus
    // SPI2_DMA_INT_MAP at +0x0B0.
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        SPI2,
        UART,
        ESP32S3_IRAM_BASE,
        INTMTX,
        SPI_TRANS_DONE_INT,
        SPI_ALL_INTS,
        SPI_CMD_USR,
        SPI_CMD_UPDATE,
        SPI_USER_COMMAND_ADDR_MOSI,
        SPI_USER1_ADDR_24_BITS,
        SPI_USER2_CMD_9F,
        SPI_MS_DLEN_32_BITS,
        0x44332211,
        0x123456,
      ],
      [
        L32R(2, 0), // a2 = GPSPI2
        L32R(6, 1), // a6 = UART0
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(3, 5),
        S32I(3, 2, 0x38), // clear stale SPI DMA raw bits
        L32R(3, 4),
        S32I(3, 2, 0x34), // enable TRANS_DONE
        L32R(7, 3),
        MOVI(3, 1),
        S32I(3, 7, 0xb0), // SPI2_DMA -> CPU line 1
        MOVI(3, 2),
        WSR(3, SR.INTENABLE),
        L32R(3, 13),
        S32I(3, 2, 0x04), // address 0x123456
        L32R(3, 9),
        S32I(3, 2, 0x14), // 24-bit address phase
        L32R(3, 10),
        S32I(3, 2, 0x18), // 8-bit command 0x9f
        L32R(3, 11),
        S32I(3, 2, 0x1c), // 32-bit data phase
        L32R(3, 12),
        S32I(3, 2, 0x98), // W0 bytes 11 22 33 44
        L32R(3, 8),
        S32I(3, 2, 0x10), // command + address + MOSI phases
        L32R(3, 7),
        S32I(3, 2, 0x00), // UPDATE self-clears
        RSIL(12, 12),
        L32R(3, 6),
        S32I(3, 2, 0x00), // USR starts and self-clears
        WAITI(0),
        L32I(4, 2, 0x00), // CMD.USR should now be clear
        L32R(5, 6),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(6, 1),
        L32I(3, 2, 0x40), // DMA_INT_ST
        L32R(4, 4),
        AND(3, 3, 4),
        MOVI(5, 0),
        BEQZ(3, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // report completion IRQ
        L32R(3, 4),
        S32I(3, 2, 0x38), // clear completion
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    expect([...c.drainSpiWrites(2)]).toEqual([0x9f, 0x12, 0x34, 0x56, 0x11, 0x22, 0x33, 0x44]);
  });

  it('fills GPSPI2 MISO bytes with zeros and clears TRANS_DONE raw', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SPI2, UART, SPI_TRANS_DONE_INT, SPI_ALL_INTS, SPI_USR_MISO, SPI_MS_DLEN_16_BITS, SPI_CMD_USR, 0xdeadbeef],
      [
        L32R(2, 0), // GPSPI2
        L32R(6, 1), // UART0
        L32R(3, 3),
        S32I(3, 2, 0x38), // clear all SPI raw bits
        L32R(3, 7),
        S32I(3, 2, 0x98), // W0 starts nonzero
        L32R(3, 5),
        S32I(3, 2, 0x1c), // 16-bit read data phase
        L32R(3, 4),
        S32I(3, 2, 0x10), // MISO phase
        L32R(3, 6),
        S32I(3, 2, 0x00), // USR start
        L32I(4, 2, 0x3c), // DMA_INT_RAW
        L32R(5, 2),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // completion raw present
        L32I(4, 2, 0x98),
        S32I(4, 6, 0), // low byte zero-filled
        SRLI(4, 4, 8),
        S32I(4, 6, 0), // high byte zero-filled
        L32R(3, 2),
        S32I(3, 2, 0x38), // clear TRANS_DONE
        L32I(4, 2, 0x3c),
        L32R(5, 2),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(600);
    expect([...c.drainUart()]).toEqual([1, 0, 0, 0]);
  });

  it('routes GPSPI3 independently and drains MOSI from W8 when highpart is selected', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        SPI3,
        UART,
        ESP32S3_IRAM_BASE,
        INTMTX,
        SPI_TRANS_DONE_INT,
        SPI_ALL_INTS,
        SPI_CMD_USR,
        (SPI_USR_MOSI | SPI_USR_MOSI_HIGHPART) >>> 0,
        SPI_MS_DLEN_32_BITS,
        0x88776655,
      ],
      [
        L32R(2, 0), // GPSPI3
        L32R(6, 1), // UART0
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(3, 5),
        S32I(3, 2, 0x38), // clear SPI raw bits
        L32R(3, 4),
        S32I(3, 2, 0x34), // enable TRANS_DONE
        L32R(7, 3),
        MOVI(3, 1),
        S32I(3, 7, 0xb4), // SPI3_DMA -> CPU line 1
        MOVI(3, 2),
        WSR(3, SR.INTENABLE),
        L32R(3, 8),
        S32I(3, 2, 0x1c), // 32-bit data phase
        L32R(3, 9),
        S32I(3, 2, 0xb8), // W8 bytes 55 66 77 88
        L32R(3, 7),
        S32I(3, 2, 0x10), // MOSI from high half
        RSIL(12, 12),
        L32R(3, 6),
        S32I(3, 2, 0x00), // USR starts and self-clears
        WAITI(0),
        L32I(4, 2, 0x00),
        L32R(5, 6),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(6, 1),
        L32I(3, 2, 0x40), // DMA_INT_ST
        L32R(4, 4),
        AND(3, 3, 4),
        MOVI(5, 0),
        BEQZ(3, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0),
        L32R(3, 4),
        S32I(3, 2, 0x38),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    expect([...c.drainSpiWrites(3)]).toEqual([0x55, 0x66, 0x77, 0x88]);
  });
});

describe('Esp32s3Core — flash-mapped IROM/DROM segments (slice 9)', () => {
  const IROM = 0x42000000;
  const DROM = 0x3c000000;

  it('boots an XIP image: code runs from IROM, consts read from DROM', () => {
    // No SRAM segment at all — code executes in place from the IROM
    // window and pulls a constant from DROM, like a real app image's
    // .flash.text/.flash.rodata. The stack still lives in DRAM.
    const code = assembleXtensa(IROM, [UART, DROM], [
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = DROM const
      L32I(4, 3, 0),
      S32I(4, 2, 0x00), // tx the flash-resident constant
      J(BR(-1)),
    ]);
    const image = buildEspImage(IROM, [
      { addr: IROM, data: code },
      { addr: DROM, data: Uint8Array.from([0xc3, 0, 0, 0]) },
    ]);
    const c = core(image);
    expect(c.inspect().pc).toBe(IROM);
    c.step(30);
    expect([...c.drainUart()]).toEqual([0xc3]);
    c.reset(); // segments are firmware — they survive
    c.step(30);
    expect([...c.drainUart()]).toEqual([0xc3]);
  });

  it('flash is read-only through the cache; unmapped cache reads refuse', () => {
    // A raw SRAM program that pokes the DROM window must refuse.
    const writer = assembleXtensa(ESP32S3_IRAM_BASE, [DROM], [
      L32R(2, 0),
      MOVI(3, 1),
      S32I(3, 2, 0x00),
    ]);
    const c = core(writer);
    expect(() => c.step(10)).toThrow('read-only through the cache');

    // Reading inside the window but outside any mapped segment.
    const reader = assembleXtensa(ESP32S3_IRAM_BASE, [IROM + 0x100000], [
      L32R(2, 0),
      L32I(3, 2, 0x00),
    ]);
    const d = core(reader);
    expect(() => d.step(10)).toThrow('unmapped flash-cache address');
  });
});

describe('Esp32s3Core — TIMG0 timer 0 (slice 8)', () => {
  const SCRATCH = 0x3fc88000 + 0xa00;
  const TIMG0 = 0x6001f000;
  const INTMTX = 0x600c2000;
  // T0CONFIG: EN (31) | INCREASE (30) | divider 2 in [28:13].
  const CFG_RUN = (0x80000000 | 0x40000000 | (2 << 13)) >>> 0;
  const CFG_PERIODIC = (CFG_RUN | (1 << 29) | (1 << 10)) >>> 0; // + AUTORELOAD + ALARM_EN
  const CFG_ONESHOT = (CFG_RUN | (1 << 10)) >>> 0; // + ALARM_EN only

  it('the counter ticks at APB/divider and latches through UPDATE', () => {
    // Divider 2 → one tick per 6 CPU cycles (240 MHz CPU, 80 MHz
    // APB). Exactly 12 cycles separate the two UPDATE writes, so the
    // latched values differ by exactly 2 regardless of phase.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, TIMG0, CFG_RUN], [
      L32R(2, 0), // a2 = UART
      L32R(3, 1), // a3 = TIMG0
      L32R(4, 2),
      S32I(4, 3, 0x00), // CONFIG: enabled, up, divider 2
      S32I(4, 3, 0x0c), // UPDATE — latch
      L32I(5, 3, 0x04), // a5 = LO
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      NOP(),
      S32I(4, 3, 0x0c), // UPDATE again, 12 cycles after the first
      L32I(7, 3, 0x04),
      SUB(7, 7, 5),
      S32I(7, 2, 0x00), // tx 2
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(100);
    expect([...c.drainUart()]).toEqual([2]);
  });

  it('a periodic alarm: autoreload + the gptimer ISR re-arm dance counts 3', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, SCRATCH, ESP32S3_IRAM_BASE, TIMG0, INTMTX, CFG_PERIODIC],
      [
        L32R(2, 0), // a2 = UART
        L32R(3, 1), // a3 = SCRATCH
        MOVI(4, 0),
        S32I(4, 3, 0), // counter = 0
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(6, 3), // a6 = TIMG0
        MOVI(7, 0),
        S32I(7, 6, 0x18), // LOADLO = 0
        S32I(7, 6, 0x1c), // LOADHI = 0
        S32I(7, 6, 0x20), // LOAD — counter ← 0
        MOVI(7, 30),
        S32I(7, 6, 0x10), // ALARMLO = 30 ticks
        MOVI(7, 0),
        S32I(7, 6, 0x14), // ALARMHI = 0
        MOVI(7, 1),
        S32I(7, 6, 0x70), // INT_ENA = T0
        L32R(8, 4),
        MOVI(7, 2),
        S32I(7, 8, 0xc8), // TG_T0 source → CPU line 2
        MOVI(7, 4),
        WSR(7, SR.INTENABLE), // 1 << 2
        L32R(7, 5),
        S32I(7, 6, 0x00), // CONFIG — armed and running
        RSIL(9, 0),
        MOVI(10, 3),
        L32I(4, 3, 0),
        BNE(4, 10, BR(-2)),
        S32I(4, 2, 0x00), // tx 3
        J(BR(-1)),
        PAD_TO(0x340),
        // handler: counter++, INT_CLR, re-arm ALARM_EN — the exact
        // dance gptimer's ISR performs because hardware auto-cleared
        // the alarm. (a5 is dead in main after init — no save.)
        WSR(2, SR.EXCSAVE1),
        L32R(2, 1),
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 3), // a3 = TIMG0
        MOVI(4, 1),
        S32I(4, 3, 0x7c), // INT_CLR = T0
        L32I(4, 3, 0x00),
        MOVI(5, 1 << 10),
        OR(4, 4, 5),
        S32I(4, 3, 0x00), // ALARM_EN back on
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(3000);
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('a one-shot alarm fires exactly once — hardware auto-disables it', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, SCRATCH, ESP32S3_IRAM_BASE, TIMG0, INTMTX, CFG_ONESHOT],
      [
        L32R(2, 0),
        L32R(3, 1),
        MOVI(4, 0),
        S32I(4, 3, 0),
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(6, 3),
        MOVI(7, 0),
        S32I(7, 6, 0x18),
        S32I(7, 6, 0x1c),
        S32I(7, 6, 0x20),
        MOVI(7, 30),
        S32I(7, 6, 0x10),
        MOVI(7, 0),
        S32I(7, 6, 0x14),
        MOVI(7, 1),
        S32I(7, 6, 0x70),
        L32R(8, 4),
        MOVI(7, 2),
        S32I(7, 8, 0xc8),
        MOVI(7, 4),
        WSR(7, SR.INTENABLE),
        L32R(7, 5),
        S32I(7, 6, 0x00), // CONFIG — no autoreload this time
        RSIL(9, 0),
        // burn far past the alarm (and past where a second or third
        // firing would land if the auto-disable were missing):
        MOVI(10, 600),
        ADDI(10, 10, -1),
        BNEZ(10, BR(-2)),
        L32I(4, 3, 0),
        S32I(4, 2, 0x00), // tx the count — must be exactly 1
        J(BR(-1)),
        PAD_TO(0x340),
        // handler: counter++, INT_CLR — deliberately NO re-arm.
        WSR(2, SR.EXCSAVE1),
        L32R(2, 1),
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 3),
        MOVI(4, 1),
        S32I(4, 3, 0x7c),
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(2500);
    expect([...c.drainUart()]).toEqual([1]);
  });
});

describe('Esp32s3Core — SAR ADC1 oneshot (slice 7)', () => {
  const SENS = 0x60008800;
  // SENS_SAR_MEAS1_CTRL2: EN_PAD_FORCE (bit 31) | START_FORCE (bit
  // 18) | channel 3 one-hot in SAR1_EN_PAD ([30:19]) — exactly what
  // adc_oneshot_ll writes — then the START_SAR (bit 17) 0→1 pulse.
  const CTRL_CH3 = (0x80000000 | (1 << 18) | (1 << (19 + 3))) >>> 0;
  const CTRL_CH3_START = (CTRL_CH3 | (1 << 17)) >>> 0;

  const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SENS, CTRL_CH3, CTRL_CH3_START, 0xfff], [
    L32R(2, 0), // a2 = UART
    L32R(3, 1), // a3 = SENS
    L32R(4, 2),
    S32I(4, 3, 0x0c), // start low (the adc_ll pulse's first half)
    L32R(4, 3),
    S32I(4, 3, 0x0c), // start 0→1 — the conversion runs
    L32I(5, 3, 0x0c), // poll MEAS1_DONE_SAR (bit 16)
    SRAI(6, 5, 16), // SRLI tops out at 15; the AND below drops sign fill
    MOVI(7, 1),
    AND(6, 6, 7),
    BEQZ(6, BR(-5)),
    L32R(7, 4), // 0xfff — MEAS1_DATA_SAR is the low 12 bits
    AND(5, 5, 7),
    S32I(5, 2, 0x00), // tx data & 0xff
    SRLI(5, 5, 8),
    S32I(5, 2, 0x00), // tx data >> 8
    J(BR(-1)),
  ]);

  it('an analogRead-style conversion round-trips through the sampler', () => {
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 3 ? 1.65 : 0));
    c.step(120);
    // round(1.65 / 3.3 × 4095) = 2048 → bytes [0x00, 0x08].
    expect([...c.drainUart()]).toEqual([0x00, 0x08]);
    const reads = c.drainAdcReads();
    expect(reads.length).toBe(1);
    expect(reads[0]?.channel).toBe(3);
    expect(reads[0]?.cycle).toBeGreaterThan(0);
    expect(c.drainAdcReads()).toEqual([]); // drained means drained
  });

  it('without a sampler every conversion reads 0 V — and still logs', () => {
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([0, 0]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([3]);
  });
});

describe('Esp32s3Core — SAR ADC2 oneshot (slice 14)', () => {
  const SENS = 0x60008800;
  // SENS_SAR_MEAS2_CTRL2 mirrors ADC1's pulse/done/data shape. ADC2
  // channel 4 maps to physical GPIO15; the host sampler sees channel
  // 14 so ADC1 channel 4 and ADC2 channel 4 cannot collide.
  const CTRL_ADC2_CH4 = (0x80000000 | (1 << 18) | (1 << (19 + 4))) >>> 0;
  const CTRL_ADC2_CH4_START = (CTRL_ADC2_CH4 | (1 << 17)) >>> 0;

  const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SENS, CTRL_ADC2_CH4, CTRL_ADC2_CH4_START, 0xfff], [
    L32R(2, 0), // a2 = UART
    L32R(3, 1), // a3 = SENS
    L32R(4, 2),
    S32I(4, 3, 0x30), // start low
    L32R(4, 3),
    S32I(4, 3, 0x30), // start 0→1 — the conversion runs
    L32I(5, 3, 0x30), // poll MEAS2_DONE_SAR (bit 16)
    SRAI(6, 5, 16),
    MOVI(7, 1),
    AND(6, 6, 7),
    BEQZ(6, BR(-5)),
    L32R(7, 4), // 0xfff — MEAS2_DATA_SAR is the low 12 bits
    AND(5, 5, 7),
    S32I(5, 2, 0x00),
    SRLI(5, 5, 8),
    S32I(5, 2, 0x00),
    J(BR(-1)),
  ]);

  it('uses the ADC2 register block and a distinct host sampler channel', () => {
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 14 ? 0.825 : 0));
    c.step(120);
    // round(0.825 / 3.3 × 4095) = 1024 → bytes [0x00, 0x04].
    expect([...c.drainUart()]).toEqual([0x00, 0x04]);
    const reads = c.drainAdcReads();
    expect(reads.map((r) => r.channel)).toEqual([14]);
    expect(reads[0]?.cycle).toBeGreaterThan(0);
  });
});

describe('Esp32s3Core — APB_SARADC digital controller (slice 15)', () => {
  const APB_SARADC = 0x60040000;
  const INTMTX = 0x600c2000;
  const SCRATCH = ESP32S3_DRAM_BASE + 0x1100;
  const INT_ADC1_DONE = 0x80000000;
  const INT_THRES0_HIGH = 0x20000000;
  const INT_THRES1_LOW = 0x04000000;
  const CTRL_ADC1_LEN1 = 1 << 25; // data_sar_sel, single ADC1, pattern length 1
  const CTRL_ADC1_START = CTRL_ADC1_LEN1 | 2;
  const CTRL_ADC1_LEN2 = (1 << 25) | (1 << 15); // sar1_patt_len = 1 -> length 2
  const CTRL2_TIMER_ENABLE = (1 << 24) | (1 << 11);
  const THRES0_CTRL_CH4_HIGH_0X900_LOW_0 = (0x900 << 5) | 4;
  const THRES1_CTRL_CH4_HIGH_DISABLED_LOW_0X400 = ((0x400 << 18) | (0x1fff << 5) | 4) >>> 0;
  const THRES0_EN = 0x80000000;
  const THRES1_EN = 0x40000000;
  const MASK_12BIT = 0xfff;
  const SAR1_PATTERN_CH4 = ((4 << 2) << 18) >>> 0;
  const SAR1_PATTERN_CH2_CH5 = (((2 << 2) << 18) | ((5 << 2) << 12)) >>> 0;

  it('timer-triggered digital ADC1 conversion latches INT_ST and DATA_STATUS', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, APB_SARADC, SAR1_PATTERN_CH4, CTRL_ADC1_LEN1, INT_ADC1_DONE, CTRL2_TIMER_ENABLE, MASK_12BIT],
      [
        L32R(2, 0),
        L32R(3, 1),
        L32R(4, 2),
        S32I(4, 3, 0x18), // SAR1 pattern table item 0 = channel 4
        L32R(4, 3),
        S32I(4, 3, 0x00), // ADC1, one pattern item, type2 output semantics
        L32R(4, 4),
        S32I(4, 3, 0x5c), // enable ADC1_DONE
        L32R(4, 5),
        S32I(4, 3, 0x04), // timer enable triggers one digital conversion
        L32I(5, 3, 0x64), // INT_ST
        SRAI(5, 5, 31),
        MOVI(6, 1),
        AND(5, 5, 6),
        S32I(5, 2, 0x00), // tx done? 1=yes
        L32I(5, 3, 0x40), // ADC1 DATA_STATUS
        L32R(6, 6),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        SRLI(5, 5, 8),
        S32I(5, 2, 0x00),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 4 ? 1.65 : 0));
    c.step(160);
    expect([...c.drainUart()]).toEqual([1, 0x00, 0x08]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([4]);
  });

  it('clearing ADC1_DONE advances the running pattern table', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, APB_SARADC, SAR1_PATTERN_CH2_CH5, CTRL_ADC1_LEN2, INT_ADC1_DONE, CTRL2_TIMER_ENABLE, MASK_12BIT],
      [
        L32R(2, 0),
        L32R(3, 1),
        L32R(4, 2),
        S32I(4, 3, 0x18), // channel 2, then channel 5
        L32R(4, 3),
        S32I(4, 3, 0x00),
        L32R(4, 4),
        S32I(4, 3, 0x5c),
        L32R(4, 5),
        S32I(4, 3, 0x04),
        L32I(5, 3, 0x40),
        L32R(6, 6),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        SRLI(5, 5, 8),
        S32I(5, 2, 0x00),
        L32R(4, 4),
        S32I(4, 3, 0x68), // clear done; timer mode immediately queues next pattern
        L32I(5, 3, 0x40),
        L32R(6, 6),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        SRLI(5, 5, 8),
        S32I(5, 2, 0x00),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 2 ? 0.825 : channel === 5 ? 3.3 : 0));
    c.step(220);
    expect([...c.drainUart()]).toEqual([0x00, 0x04, 0xff, 0x0f]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([2, 5]);
  });

  it('routes APB_SARADC ADC1_DONE through the interrupt matrix to a level-1 handler', () => {
    // Source-checked against esp-idf v5.2.7:
    //   interrupt_core0_reg.h — INTERRUPT_CORE0_APB_ADC_INT_MAP_REG = +0x104
    //   apb_saradc_reg.h     — ADC1_DONE lives at bit 31 in INT_ENA/RAW/ST/CLR
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, APB_SARADC, INTMTX, SCRATCH, ESP32S3_IRAM_BASE, SAR1_PATTERN_CH4, CTRL_ADC1_LEN1, INT_ADC1_DONE, CTRL_ADC1_START, MASK_12BIT],
      [
        L32R(13, 3), // scratch
        MOVI(14, 0),
        S32I(14, 13, 0), // ISR counter = 0
        L32R(14, 4),
        WSR(14, SR.VECBASE),

        L32R(3, 1), // APB_SARADC
        L32R(4, 5),
        S32I(4, 3, 0x18), // SAR1 pattern item 0 = channel 4
        L32R(4, 6),
        S32I(4, 3, 0x00), // ADC1, START low
        L32R(4, 7),
        S32I(4, 3, 0x5c), // INT_ENA = ADC1_DONE

        L32R(15, 2), // interrupt matrix
        MOVI(4, 0),
        S32I(4, 15, 0x104), // APB_ADC source -> CPU line 0
        MOVI(4, 1),
        WSR(4, SR.INTENABLE),
        RSIL(12, 0),

        L32R(4, 8),
        S32I(4, 3, 0x00), // START edge triggers ADC1_DONE
        MOVI(11, 1),
        L32I(4, 13, 0),
        BNE(4, 11, BR(-2)),

        L32R(2, 0), // UART
        S32I(4, 2, 0x00), // counter = 1
        L32I(5, 3, 0x64), // INT_ST after the ISR clear
        S32I(5, 2, 0x00),
        L32I(5, 3, 0x40), // ADC1 DATA_STATUS still holds the sample
        L32R(6, 9),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        SRLI(5, 5, 8),
        S32I(5, 2, 0x00),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 3),
        S32I(3, 2, 8),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 1),
        L32R(4, 7),
        S32I(4, 3, 0x68), // INT_CLR = ADC1_DONE
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 4 ? 1.65 : 0));
    c.step(400);
    expect([...c.drainUart()]).toEqual([1, 0, 0x00, 0x08]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([4]);
  });

  it('routes APB_SARADC threshold-monitor high crossings through the interrupt matrix', () => {
    // Source-checked against esp-idf v5.2.7:
    //   adc_types.h       — HIGH means raw_result > threshold
    //   adc_ll.h          — monitor channel = (adc_unit << 3) | (channel & 0x7)
    //   apb_saradc_reg.h — THRES0_HIGH_INT lives at bit 29; THRES0_EN at THRES_CTRL bit 31
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        UART,
        APB_SARADC,
        INTMTX,
        SCRATCH,
        ESP32S3_IRAM_BASE,
        SAR1_PATTERN_CH4,
        CTRL_ADC1_LEN1,
        INT_THRES0_HIGH,
        THRES0_CTRL_CH4_HIGH_0X900_LOW_0,
        THRES0_EN,
        CTRL_ADC1_START,
        MASK_12BIT,
      ],
      [
        L32R(13, 3), // scratch
        MOVI(14, 0),
        S32I(14, 13, 0), // ISR counter = 0
        L32R(14, 4),
        WSR(14, SR.VECBASE),

        L32R(3, 1), // APB_SARADC
        L32R(4, 5),
        S32I(4, 3, 0x18), // SAR1 pattern item 0 = channel 4
        L32R(4, 6),
        S32I(4, 3, 0x00), // ADC1, START low
        L32R(4, 8),
        S32I(4, 3, 0x44), // THRES0: ADC1 channel 4, high threshold 0x900
        L32R(4, 9),
        S32I(4, 3, 0x58), // enable threshold monitor 0
        L32R(4, 7),
        S32I(4, 3, 0x5c), // INT_ENA = THRES0_HIGH

        L32R(15, 2), // interrupt matrix
        MOVI(4, 0),
        S32I(4, 15, 0x104), // APB_ADC source -> CPU line 0
        MOVI(4, 1),
        WSR(4, SR.INTENABLE),
        RSIL(12, 0),

        L32R(4, 10),
        S32I(4, 3, 0x00), // START edge triggers threshold monitor
        MOVI(11, 1),
        L32I(4, 13, 0),
        BNE(4, 11, BR(-2)),

        L32R(2, 0), // UART
        S32I(4, 2, 0x00), // counter = 1
        L32I(5, 3, 0x64), // INT_ST after the ISR clear
        S32I(5, 2, 0x00),
        L32I(5, 3, 0x40), // ADC1 DATA_STATUS still holds the sample
        L32R(6, 11),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        SRLI(5, 5, 8),
        S32I(5, 2, 0x00),
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 3),
        S32I(3, 2, 8),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 1),
        L32R(4, 7),
        S32I(4, 3, 0x68), // INT_CLR = THRES0_HIGH
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 4 ? 2.5 : 0));
    c.step(420);
    expect([...c.drainUart()]).toEqual([1, 0, 0x1e, 0x0c]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([4]);
  });

  it('latches and clears APB_SARADC threshold-monitor low crossings', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        UART,
        APB_SARADC,
        SAR1_PATTERN_CH4,
        CTRL_ADC1_LEN1,
        THRES1_CTRL_CH4_HIGH_DISABLED_LOW_0X400,
        THRES1_EN,
        INT_THRES1_LOW,
        CTRL_ADC1_START,
      ],
      [
        L32R(2, 0), // UART
        L32R(3, 1), // APB_SARADC
        L32R(4, 2),
        S32I(4, 3, 0x18), // SAR1 pattern item 0 = channel 4
        L32R(4, 3),
        S32I(4, 3, 0x00), // ADC1, START low
        L32R(4, 4),
        S32I(4, 3, 0x48), // THRES1: ADC1 channel 4, low threshold 0x400
        L32R(4, 5),
        S32I(4, 3, 0x58), // enable threshold monitor 1
        L32R(4, 6),
        S32I(4, 3, 0x5c), // INT_ENA = THRES1_LOW
        L32R(4, 7),
        S32I(4, 3, 0x00), // START edge triggers threshold monitor
        L32I(5, 3, 0x64), // INT_ST
        SRLI(5, 5, 13),
        SRLI(5, 5, 13),
        MOVI(6, 1),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        L32R(4, 6),
        S32I(4, 3, 0x68), // clear THRES1_LOW
        L32I(5, 3, 0x64),
        SRLI(5, 5, 13),
        SRLI(5, 5, 13),
        AND(5, 5, 6),
        S32I(5, 2, 0x00),
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 4 ? 0.5 : 3.3));
    c.step(260);
    expect([...c.drainUart()]).toEqual([1, 0]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([4]);
  });
});

/**
 * Build an esptool-shaped app image: 24-byte header (magic 0xE9,
 * segment count, entry @4, chip_id @12), the segments, and the XOR
 * checksum (seed 0xEF) as the last byte of the 16-byte-aligned body.
 */
function buildEspImage(
  entry: number,
  segs: { addr: number; data: Uint8Array }[],
  opts: { chipId?: number; corruptChecksum?: boolean } = {},
): Uint8Array {
  const bytes: number[] = new Array<number>(24).fill(0);
  bytes[0] = 0xe9;
  bytes[1] = segs.length;
  bytes[2] = 0x02; // spi_mode DIO — the loader ignores flash fields
  for (let i = 0; i < 4; i++) bytes[4 + i] = (entry >>> (8 * i)) & 0xff;
  const chipId = opts.chipId ?? 9;
  bytes[12] = chipId & 0xff;
  bytes[13] = (chipId >> 8) & 0xff;
  let checksum = 0xef;
  for (const seg of segs) {
    for (let i = 0; i < 4; i++) bytes.push((seg.addr >>> (8 * i)) & 0xff);
    for (let i = 0; i < 4; i++) bytes.push((seg.data.length >>> (8 * i)) & 0xff);
    for (const b of seg.data) {
      bytes.push(b);
      checksum ^= b;
    }
  }
  const total = Math.ceil((bytes.length + 1) / 16) * 16;
  while (bytes.length < total) bytes.push(0);
  bytes[total - 1] = opts.corruptChecksum ? checksum ^ 0xff : checksum;
  return Uint8Array.from(bytes);
}

describe('Esp32s3Core — MOVSP + ESP-IDF app images (slice 5)', () => {
  const SCRATCH = 0x3fc88000 + 0x600;

  it('boots a two-segment app image (code → IRAM, data → DRAM) at its entry point', () => {
    // The code segment deliberately does NOT sit at the IRAM base —
    // the entry_addr field has to be honored for this to run at all.
    const codeBase = ESP32S3_IRAM_BASE + 0x100;
    const code = assembleXtensa(codeBase, [UART, SCRATCH], [
      L32R(2, 0),
      L32R(3, 1),
      L32I(4, 3, 0), // read the data segment's payload
      S32I(4, 2, 0x00), // tx it
      J(BR(-1)),
    ]);
    const image = buildEspImage(codeBase, [
      { addr: codeBase, data: code },
      { addr: SCRATCH, data: Uint8Array.from([0x5a, 0, 0, 0]) },
    ]);
    const c = core(image);
    expect(c.inspect().pc).toBe(codeBase);
    c.step(30);
    expect([...c.drainUart()]).toEqual([0x5a]);
    // reset() reloads every segment and restarts at the entry point.
    c.reset();
    c.step(30);
    expect([...c.drainUart()]).toEqual([0x5a]);
  });

  it('refuses wrong-chip, unmapped-segment, and corrupted images with clear messages', () => {
    const c = new Esp32s3Core();
    const seg = { addr: ESP32S3_IRAM_BASE, data: Uint8Array.from([0x0d, 0xf0, 0x00, 0x00]) };
    expect(() => {
      c.loadFirmware(buildEspImage(ESP32S3_IRAM_BASE, [seg], { chipId: 0 }));
    }).toThrow('targets ESP32 (chip_id 0)');
    expect(() => {
      c.loadFirmware(buildEspImage(ESP32S3_IRAM_BASE, [{ addr: 0x50000000, data: Uint8Array.from([1, 2, 3, 4]) }]));
    }).toThrow('outside the modeled SRAM window and the IROM/DROM cache windows');
    expect(() => {
      c.loadFirmware(buildEspImage(ESP32S3_IRAM_BASE, [seg], { corruptChecksum: true }));
    }).toThrow('checksum mismatch');
  });

  it("MOVSP with the caller's frame live is a plain stack-pointer move", () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      // crt0:
      CALLN_TO(2, 4), // call8 fn — idx 4 lands at byte 8 + 12 = 20 ✓
      J(BR(-1)),
      NOP(),
      NOP(),
      // fn:
      ENTRY(1, 16),
      L32R(2, 0), // a2 = UART
      MOV_N(3, 1), // a3 = old sp
      MOVI(4, 0x77),
      ADDI(5, 1, -16),
      S32I(4, 5, 0), // marker below the OLD sp
      ADDI(6, 1, -32),
      MOVSP(1, 6), // caller's frame is live → plain move, NO copy
      SUB(7, 3, 1),
      S32I(7, 2, 0x00), // tx 32 — sp really moved
      ADDI(5, 1, -16),
      L32I(4, 5, 0),
      S32I(4, 2, 0x00), // tx 0 — the save area was NOT copied
      RETW(),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([32, 0]);
  });

  it('MOVSP with the callers hidden performs the Alloca save-area move', () => {
    // crt0 (wb 0) → call8 main (wb 2) → call8 fn (wb 4): WindowStart
    // is 0b10101 = 21. fn clears main's bit (WSR 17) so all three WS
    // bits below it read 0 — the RM's AllocaCause condition — then
    // MOVSP must move the 4-word base save area to below the new sp.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART], [
      // crt0:
      ADDI(3, 1, -16),
      S32I(1, 3, 4), // [sp−12] ← sp
      CALLN_TO(2, 4), // call8 main — byte 8 + 12 = 20 ✓
      J(BR(-1)),
      // main:
      ENTRY(1, 32),
      CALLN_TO(2, 8), // call8 fn — byte 8 + 24 = 32 ✓
      RETW(),
      NOP(),
      // fn:
      ENTRY(1, 16),
      L32R(2, 0), // a2 = UART
      ADDI(4, 1, -16),
      MOVI(5, 0x11),
      S32I(5, 4, 0),
      MOVI(5, 0x44),
      S32I(5, 4, 12), // markers at [sp−16] and [sp−4]
      RSR(6, SR.WINDOWSTART),
      S32I(6, 2, 0x00), // tx 21 — three live frames, as constructed
      MOVI(7, 17), // keep bits {0,4}: hide main's frame
      WSR(7, SR.WINDOWSTART),
      ADDI(8, 1, -32),
      MOVSP(1, 8), // alloca path: copy [old sp−16..−4] → [new sp−16..−4]
      ADDI(4, 1, -16),
      L32I(9, 4, 0),
      S32I(9, 2, 0x00), // tx 0x11 — moved
      L32I(9, 4, 12),
      S32I(9, 2, 0x00), // tx 0x44 — moved
      MOVI(7, 21), // restore so RETW unwinds without a bogus fill
      WSR(7, SR.WINDOWSTART),
      RETW(),
    ]);
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([21, 0x11, 0x44]);
  });
});

describe('Esp32s3Core — ROM functions (slice 10)', () => {
  // REAL mask-ROM entry addresses, pinned here independently of the
  // implementation, from esp-idf v5.2:
  //   components/esp_rom/esp32s3/ld/esp32s3.rom.ld
  //   components/esp_rom/esp32s3/ld/esp32s3.rom.newlib.ld
  const ETS_PRINTF = 0x400005d0;
  const ETS_DELAY_US = 0x40000600;
  const UART_TX_ONE_CHAR = 0x40000648;
  const SOFTWARE_RESET = 0x400006d8;
  const ROM_MEMSET = 0x400011e8;
  const ROM_MEMCPY = 0x400011f4;
  const ROM_STRLEN = 0x40001248;
  const SCRATCH = 0x3fc88000 + 0x500;

  it('CALL8 to ets_delay_us burns us·240 cycles and resumes after the windowed return', () => {
    // IO5 goes high, ets_delay_us(10) runs, IO5 goes low — the two
    // cycle-stamped edges must straddle 10 µs at 240 MHz (2400 cycles)
    // plus only a handful of call/stub instructions.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [GPIO, 1 << 5, ETS_DELAY_US], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4), // base save area, like every windowed crt0 here
      L32R(2, 0),
      L32R(4, 1),
      S32I(4, 2, 0x24), // enable IO5 (driven low — first drive, no edge)
      S32I(4, 2, 0x08), // IO5 high
      L32R(8, 2), // a8 = ets_delay_us
      MOVI(10, 10), // arg: 10 µs
      CALLXN(2, 8), // call8 into ROM
      S32I(4, 2, 0x0c), // IO5 low — only reached if the RETW worked
      J(BR(-1)),
    ]);
    const c = core(image);
    const io5 = c.step(3_000).events.filter((e) => e.pin === 'IO5');
    expect(io5.map((e) => e.level)).toEqual([1, 0]);
    const span = (io5[1]?.cycle ?? 0) - (io5[0]?.cycle ?? 0);
    expect(span).toBeGreaterThanOrEqual(2_400);
    expect(span).toBeLessThan(2_420); // delay + call overhead only
  });

  it('uart_tx_one_char pushes to the UART0 tx queue and returns 0', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, UART_TX_ONE_CHAR], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32R(8, 1),
      MOVI(10, 0x41), // 'A'
      CALLXN(2, 8),
      S32I(10, 2, 0x00), // tx the return value (0) through the FIFO
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([0x41, 0]);
  });

  it('ets_printf formats register varargs to UART0 and returns the count', () => {
    // "n=%d!\n" packed little-endian into the literal pool: the pool
    // starts at base+4, so the string lives at IRAM_BASE+4.
    const fmt0 = 0x64253d6e; // 'n' '=' '%' 'd'
    const fmt1 = 0x00000a21; // '!' '\n' NUL
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [fmt0, fmt1, ETS_PRINTF, ESP32S3_IRAM_BASE + 4, UART],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(8, 2), // a8 = ets_printf
        L32R(10, 3), // arg0: the format string
        MOVI(11, 42), // arg1
        CALLXN(2, 8),
        L32R(2, 4),
        S32I(10, 2, 0x00), // tx the return value (6 chars written)
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(120);
    const text = 'n=42!\n';
    expect([...c.drainUart()]).toEqual([...Array.from(text, (ch) => ch.charCodeAt(0)), text.length]);
  });

  it('memset and memcpy ROM exports mutate DRAM and return dst', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [ROM_MEMSET, ROM_MEMCPY, SCRATCH, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(5, 2), // a5 = SCRATCH
      L32R(8, 0),
      MOV_N(10, 5),
      MOVI(11, 0x5a),
      MOVI(12, 4),
      CALLXN(2, 8), // memset(SCRATCH, 0x5a, 4)
      L32R(8, 1),
      ADDI(10, 5, 8),
      MOV_N(11, 5),
      MOVI(12, 4),
      CALLXN(2, 8), // memcpy(SCRATCH+8, SCRATCH, 4)
      L32R(2, 3),
      L32I(4, 5, 8),
      S32I(4, 2, 0x00), // tx 0x5a — the copy of the fill landed
      SUB(6, 10, 5),
      S32I(6, 2, 0x00), // tx 8 — memcpy returned dst
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([0x5a, 8]);
  });

  it('strlen ROM export walks memory to the NUL', () => {
    // "Hi!" at IRAM_BASE+4 (the first pool literal).
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [0x00216948, ROM_STRLEN, ESP32S3_IRAM_BASE + 4, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(8, 1),
      L32R(10, 2),
      CALLXN(2, 8),
      L32R(2, 3),
      S32I(10, 2, 0x00), // tx 3
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('software_reset performs a power-on reset and ends the step() call', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [UART, SOFTWARE_RESET], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      MOVI(3, 0x21),
      S32I(3, 2, 0x00), // tx '!' (dropped by the reset — power-on clears it)
      L32R(8, 1),
      CALLXN(2, 8), // never returns
      J(BR(-1)),
    ]);
    const c = core(image);
    const res = c.step(10_000);
    expect(res.cycles).toBeLessThan(10_000); // returned early at the reset
    expect(c.inspect().pc).toBe(ESP32S3_IRAM_BASE); // back at the entry point
    expect(c.inspect().cycles).toBe(0);
    expect([...c.drainUart()]).toEqual([]); // peripheral state cleared too
  });

  it('an unmodeled ROM address halts with a diagnostic naming it', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [0x40001000], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(8, 0),
      CALLXN(2, 8),
      J(BR(-1)),
    ]);
    const c = core(image);
    expect(() => c.step(50)).toThrow(/ROM address 0x40001000/);
    expect(() => c.step(50)).toThrow(/ets_delay_us/); // the diagnostic lists what IS modeled
  });
});

describe('Esp32s3Core — RTC/eFuse/SYSTEM (slice 11)', () => {
  // REAL register addresses, pinned independently of the implementation,
  // from esp-idf v5.2 components/soc/esp32s3/include/soc/:
  //   reg_base.h     — DR_REG_EFUSE_BASE 0x60007000, DR_REG_RTCCNTL_BASE
  //                    0x60008000, DR_REG_RTCIO_BASE 0x60008400,
  //                    DR_REG_SYSTEM_BASE 0x600C0000
  //   rtc_cntl_reg.h — OPTIONS0 +0x0, TIME_UPDATE +0xC, TIME_LOW0 +0x10,
  //                    TIME_HIGH0 +0x14, RESET_STATE +0x38
  //   efuse_reg.h    — PGM_DATA0 +0x0, RD_MAC_SPI_SYS_0 +0x44, _1 +0x48,
  //                    CONF +0x1CC, CMD +0x1D4, INT_* +0x1D8..0x1E4
  //   system_reg.h   — CPU_PER_CONF +0x10, SYSCLK_CONF +0x60
  // Reset causes from esp_rom/include/esp32s3/rom/rtc.h: POWERON_RESET=1,
  // RTC_SW_SYS_RESET=3, RTC_SW_CPU_RESET=12.
  const RTCCNTL = 0x60008000;
  const RTCIO = 0x60008400;
  const RTC_OPTIONS0 = 0x60008000;
  const RTC_TIME_UPDATE = 0x6000800c;
  const RTC_CLK_CONF_XTAL32K = 0x5158321c;
  const RTC_RESET_STATE = 0x60008038;
  const INTMTX = 0x600c2000;
  const SYS = 0x600c0000;
  const SET_BOOT = 0x40000720;
  const CORE1_ENTRY = ESP32S3_IRAM_BASE + 0x400;
  const EFUSE_BASE = 0x60007000;
  const EFUSE_MAC0 = 0x60007044;
  const EFUSE_MAC1 = 0x60007048;
  const EFUSE_WRITE_OP_CODE = 0x5a5a;
  const EFUSE_PGM_DONE = 1 << 1;
  const EFUSE_BLK2_PGM_CMD = (2 << 2) | EFUSE_PGM_DONE;
  const SYS_CPU_PER_CONF = 0x600c0010;
  const SYS_SYSCLK_CONF = 0x600c0060;
  const SOFTWARE_RESET = 0x400006d8;

  /** Firmware: tx RESET_CAUSE_PROCPU, then if it reads power-on (1) do
   *  `trigger` (a software reset of some flavor); a non-power-on cause
   *  halts. Each test then sees uart [1] from the first boot and the
   *  new cause from the second. */
  const causeRoundTrip = (literals: number[], trigger: XtInstr[]): Uint8Array =>
    assembleXtensa(ESP32S3_IRAM_BASE, [RTC_RESET_STATE, UART, ...literals], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0), // RESET_STATE
      L32I(4, 2, 0),
      MOVI(5, 0x3f),
      AND(4, 4, 5), // RESET_CAUSE_PROCPU [5:0]
      L32R(6, 1),
      S32I(4, 6, 0), // tx the cause
      ADDI(5, 4, -1),
      BNEZ_TO(5, 10 + trigger.length), // not power-on → halt
      ...trigger,
      J_TO(10 + trigger.length), // halt: J self
    ]);

  it('software_reset (slice 10) flips the reset cause from POWERON(1) to RTC_SW_SYS_RESET(3)', () => {
    const image = causeRoundTrip([SOFTWARE_RESET], [
      L32R(8, 2),
      CALLXN(2, 8), // never returns — step() resets
    ]);
    const c = core(image);
    c.step(10_000); // boot 1: tx 1, reset
    expect([...c.drainUart()]).toEqual([]); // reset cleared the tx fifo mid-flight
    c.step(200); // boot 2: tx 3, halt
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('RESET_STATE reports the cause for BOTH CPUs (per-core fields; both POWERON at power-on)', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [RTC_RESET_STATE, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32I(4, 2, 0),
      L32R(6, 1),
      S32I(4, 6, 0), // tx low byte: (appcpu<<6 | procpu) & 0xff = 0x41 at power-on
      J_TO(6),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([0x41]); // 1<<6 | 1
  });

  it('writing RTC_CNTL_SW_SYS_RST (OPTIONS0 bit 31) resets with cause 3', () => {
    const image = causeRoundTrip([RTC_OPTIONS0], [
      L32R(8, 2),
      MOVI(9, 1),
      SLLI(9, 9, 31),
      S32I(9, 8, 0), // OPTIONS0 ← SW_SYS_RST
    ]);
    const c = core(image);
    c.step(10_000);
    c.step(200);
    expect([...c.drainUart()]).toEqual([3]);
  });

  it('writing RTC_CNTL_SW_PROCPU_RST (OPTIONS0 bit 5) resets with cause RTC_SW_CPU_RESET(12)', () => {
    const image = causeRoundTrip([RTC_OPTIONS0], [
      L32R(8, 2),
      MOVI(9, 1 << 5),
      S32I(9, 8, 0),
    ]);
    const c = core(image);
    c.step(10_000);
    c.step(200);
    expect([...c.drainUart()]).toEqual([12]);
  });

  it('the RTC slow-clock counter ticks at 136 kHz and latches on TIME_UPDATE', () => {
    // ets_delay_us(1000) jumps CCOUNT by 240_000 cycles; the 48-bit RTC
    // main timer then reads 1000 µs × 136 kHz = 136 ticks.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [RTC_TIME_UPDATE, UART, 0x40000600], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0), // TIME_UPDATE
      L32I(4, 2, 4), // TIME_LOW0 (no update yet — must read the 0 latch)
      L32R(6, 1),
      S32I(4, 6, 0), // tx 0
      L32R(8, 2),
      MOVI(10, 1000),
      CALLXN(2, 8), // ets_delay_us(1000)
      MOVI(9, 1),
      SLLI(9, 9, 31),
      S32I(9, 2, 0), // TIME_UPDATE ← bit 31: latch now
      L32I(4, 2, 4), // TIME_LOW0
      S32I(4, 6, 0), // tx 136
      L32I(4, 2, 8), // TIME_HIGH0
      S32I(4, 6, 0), // tx 0
      J_TO(16),
    ]);
    const c = core(image);
    c.step(250_000);
    expect([...c.drainUart()]).toEqual([0, 136, 0]);
  });

  it('the RTC slow-clock counter keeps elapsed ticks when CLK_CONF switches source', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [RTCCNTL, UART, RTC_CLK_CONF_XTAL32K, 0x40000600, 6000], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0), // RTC_CNTL base
      L32R(6, 1), // UART
      L32R(7, 2), // CLK_CONF.ANA_CLK_RTC_SEL = XTAL32K
      L32R(8, 3), // ets_delay_us
      MOVI(10, 1000),
      CALLXN(2, 8),
      MOVI(9, 1),
      SLLI(9, 9, 31),
      S32I(9, 2, 0x0c), // TIME_UPDATE latch at RC_SLOW
      L32I(4, 2, 0x10),
      S32I(4, 6, 0), // tx ~136
      S32I(7, 2, 0x74), // switch to XTAL32K
      S32I(9, 2, 0x0c), // latch immediately after switch
      L32I(4, 2, 0x10),
      S32I(4, 6, 0), // must not fall back to the slower absolute-time value
      L32R(10, 4),
      ADDI(10, 10, -1),
      BNEZ(10, BR(-2)),
      S32I(9, 2, 0x0c),
      L32I(4, 2, 0x10),
      S32I(4, 6, 0), // then keeps aging on the new slow source
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(500_000);
    const out = [...c.drainUart()];
    expect(out[0]).toBe(136);
    expect(out[1]).toBeGreaterThanOrEqual(out[0] ?? 0);
    expect(out[1]).toBeLessThanOrEqual((out[0] ?? 0) + 1);
    expect(out[2]).toBeGreaterThan(out[1] ?? 0);
    expect(out[2]).toBeLessThanOrEqual((out[1] ?? 0) + 3);
  });

  it('eFuse MAC registers serve the documented synthetic MAC 7A:C0:DE:00:53:33', () => {
    // efuse_hal_get_mac order: mac[0]=mac_1>>8, mac[1]=mac_1, mac[2..5]=mac_0
    // big-endian — so mac_0 = 0xDE005333, mac_1 = 0x00007AC0.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [EFUSE_MAC0, EFUSE_MAC1, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32I(4, 2, 0), // MAC_0
      L32R(6, 2),
      S32I(4, 6, 0), // tx 0x33 (tx masks to the low byte)
      SRAI(5, 4, 8),
      S32I(5, 6, 0), // tx 0x53
      SRAI(5, 4, 16),
      S32I(5, 6, 0), // tx 0x00
      SRAI(5, 4, 24),
      S32I(5, 6, 0), // tx 0xde
      L32R(2, 1),
      L32I(4, 2, 0), // MAC_1
      S32I(4, 6, 0), // tx 0xc0
      SRAI(5, 4, 8),
      S32I(5, 6, 0), // tx 0x7a
      J_TO(17),
    ]);
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([0x33, 0x53, 0x00, 0xde, 0xc0, 0x7a]);
  });

  it('eFuse wafer-version words (RD_MAC_SPI_SYS_2..5) read 0 — chip revision v0.0', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [0x6000704c, 0x60007058, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32I(4, 2, 0),
      L32R(6, 2),
      S32I(4, 6, 0),
      L32R(2, 1),
      L32I(4, 2, 0),
      S32I(4, 6, 0),
      J_TO(9),
    ]);
    const c = core(image);
    c.step(60);
    expect([...c.drainUart()]).toEqual([0, 0]);
  });

  it('eFuse programming command burns staged one-way bits and exposes PGM_DONE status', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [EFUSE_BASE, UART, 0xa5, EFUSE_WRITE_OP_CODE, EFUSE_BLK2_PGM_CMD, EFUSE_PGM_DONE, 0x50],
      [
        L32R(2, 0), // a2 = EFUSE base
        L32R(6, 1), // a6 = UART
        L32R(3, 2),
        S32I(3, 2, 0x00), // PGM_DATA0 = 0xa5
        L32R(3, 3),
        S32I(3, 2, 0x1cc), // CONF = WRITE_OP_CODE
        L32R(3, 4),
        S32I(3, 2, 0x1d4), // CMD = BLK2 + PGM_CMD
        L32I(4, 2, 0x5c), // BLK2 word0
        S32I(4, 6, 0), // tx 0xa5
        L32I(4, 2, 0x00), // PGM_DATA0 clears after burn
        S32I(4, 6, 0), // tx 0x00
        L32R(3, 5),
        S32I(3, 2, 0x1e0), // INT_ENA = PGM_DONE
        L32I(4, 2, 0x1dc), // INT_ST = RAW & ENA
        S32I(4, 6, 0), // tx 0x02
        S32I(3, 2, 0x1e4), // INT_CLR = PGM_DONE
        L32I(4, 2, 0x1dc),
        S32I(4, 6, 0), // tx 0x00
        L32R(3, 6),
        S32I(3, 2, 0x00), // second burn ORs 0x50 into existing 0xa5
        L32R(3, 4),
        S32I(3, 2, 0x1d4),
        L32I(4, 2, 0x5c),
        S32I(4, 6, 0), // tx 0xf5
        J_TO(25),
      ],
    );
    const c = core(image);
    c.step(180);
    expect([...c.drainUart()]).toEqual([0xa5, 0x00, 0x02, 0x00, 0xf5]);
  });

  it('SYSTEM clock-config registers describe the modeled post-bootloader 240 MHz PLL state', () => {
    // CPU_PER_CONF: PLL_FREQ_SEL=1 (480 MHz PLL), CPUPERIOD_SEL=2 (240 MHz) → 0x6.
    // SYSCLK_CONF: CLK_XTAL_FREQ=40 [18:12], SOC_CLK_SEL=1 (PLL) [11:10],
    // PRE_DIV_CNT=1 [9:0] → 0x28401.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [SYS_CPU_PER_CONF, SYS_SYSCLK_CONF, UART], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0),
      L32I(4, 2, 0),
      L32R(6, 2),
      S32I(4, 6, 0), // tx 0x06
      L32R(2, 1),
      L32I(4, 2, 0),
      S32I(4, 6, 0), // tx 0x01 (PRE_DIV_CNT)
      SRAI(5, 4, 10),
      S32I(5, 6, 0), // tx 0xa1 = CLK_XTAL_FREQ<<2 | SOC_CLK_SEL = 40<<2|1
      J_TO(11),
    ]);
    const c = core(image);
    c.step(80);
    expect([...c.drainUart()]).toEqual([0x06, 0x01, 0xa1]);
  });

  it('RTC INT_RAW writes only affect the documented touch-approach R/W raw bit', () => {
    // Source-checked against ESP-IDF release/v5.5 rtc_cntl_reg.h:
    // TOUCH_APPROACH_LOOP_DONE_INT_RAW is R/W, while ULP_CP and
    // SLP_WAKEUP raw bits are RO producer latches.
    const touchApproachRaw = 1 << 20;
    const ulpRaw = 1 << 5;
    const sleepWakeRaw = 1;
    const rawWrite = touchApproachRaw | ulpRaw | sleepWakeRaw;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, UART, rawWrite, 1, 0x3f, 0],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 2),
        S32I(3, 2, 0x44), // INT_RAW: write R/W approach plus RO ULP/SLP bits
        L32I(4, 2, 0x44),
        SRAI(5, 4, 20),
        L32R(6, 3),
        AND(5, 5, 6),
        L32R(7, 1),
        S32I(5, 7, 0), // tx 1: approach raw is writable
        L32R(6, 4),
        AND(5, 4, 6),
        S32I(5, 7, 0), // tx 0: low RO raw bits did not latch from write
        L32R(3, 5),
        S32I(3, 2, 0x44), // INT_RAW: clear the R/W approach bit
        L32I(4, 2, 0x44),
        SRAI(5, 4, 20),
        L32R(6, 3),
        AND(5, 5, 6),
        S32I(5, 7, 0), // tx 0: approach raw cleared by the write
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(500);
    expect([...c.drainUart()]).toEqual([1, 0, 0]);
  });

  it('RTC sleep timer wakes WAITI through the RTC core interrupt matrix', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h: SLP_TIMER0 +0x04, SLP_TIMER1 +0x08,
    // STATE0 +0x18, WAKEUP_STATE +0x3c, INT_* +0x40..0x4c,
    // SLP_WAKEUP_CAUSE +0x130. interrupt_core0_reg.h maps RTC_CORE at
    // +0x09c. soc/rtc.h defines RTC_TIMER_TRIG_EN as BIT(3).
    const rtcTimerTrig = 1 << 3;
    const wakeupTimer = rtcTimerTrig << 15;
    const rtcIntMask = (1 << 10) | 1; // MAIN_TIMER_INT | SLP_WAKEUP_INT
    const sleepEn = 0x80000000;
    const mainTimerAlarmEn = 1 << 16;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, wakeupTimer, rtcIntMask, sleepEn, mainTimerAlarmEn],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        RSIL(8, 0),
        L32R(4, 5),
        S32I(4, 2, 0x4c), // clear stale MAIN_TIMER/SLP_WAKEUP raw bits
        S32I(4, 2, 0x40), // enable both RTC raw sources
        L32R(4, 4),
        S32I(4, 2, 0x3c), // WAKEUP_STATE timer wake source
        MOVI(4, 1),
        S32I(4, 2, 0x04), // target RTC slow-clock tick 1
        L32R(4, 7),
        S32I(4, 2, 0x08), // arm RTC main timer alarm, high bits = 0
        L32R(4, 6),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 2),
        S32I(4, 5, 0), // tx RTC_TIMER_TRIG_EN (0x08)
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 5),
        S32I(3, 2, 0x4c), // clear MAIN_TIMER/SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(5_000);
    expect([...c.drainUart()]).toEqual([rtcTimerTrig]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('RTC SDIO idle wakes light sleep through RTC_CORE and records the wake cause', () => {
    // Context7: ESP-IDF release/v5.5 sleep docs list light-sleep wake
    // sources. Source-checked bit positions against ESP-IDF release/v5.5:
    // soc/rtc.h defines RTC_SDIO_TRIG_EN as BIT(4), and
    // rtc_cntl_reg.h exposes RTC_CNTL_SDIO_IDLE_INT_* at bit 2.
    const rtcSdioTrig = 1 << 4;
    const rtcSdioIdleInt = 1 << 2;
    const rtcSlpWakeupInt = 1;
    const rtcIntMask = rtcSdioIdleInt | rtcSlpWakeupInt;
    const wakeupSdio = rtcSdioTrig << 15;
    const sleepEn = 0x80000000;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, wakeupSdio, rtcIntMask, sleepEn, rtcSdioTrig],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0x4c), // clear stale SDIO_IDLE/SLP_WAKEUP raw bits
        S32I(4, 2, 0x40), // enable both RTC raw sources
        L32R(4, 4),
        S32I(4, 2, 0x3c), // WAKEUP_STATE SDIO wake source
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(4, 6),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 7),
        AND(4, 4, 5),
        L32R(6, 2),
        S32I(4, 6, 0), // tx RTC_SDIO_TRIG_EN (0x10)
        L32I(4, 2, 0x48),
        S32I(4, 6, 0), // tx 0: INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 5),
        S32I(3, 2, 0x4c), // clear SDIO_IDLE/SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.setRtcSdioIdle(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([rtcSdioTrig, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('RTC WiFi and BT host events wake light sleep through SLP_WAKEUP cause bits', () => {
    // Context7: ESP-IDF v5.5.4 sleep docs list WiFi and Bluetooth as
    // light-sleep wake sources. Source-checked against ESP-IDF v5.5.4:
    // soc/rtc.h defines RTC_WIFI_TRIG_EN as BIT(5) and RTC_BT_TRIG_EN
    // as BIT(10), while rtc_cntl_reg.h exposes no separate WiFi/BT
    // RTC INT_RAW producer bits; both wake through SLP_WAKEUP.
    const rtcWifiTrig = 1 << 5;
    const rtcBtTrig = 1 << 10;
    const rtcSlpWakeupInt = 1;
    const sleepEn = 0x80000000;
    const imageFor = (wakeupTrig: number, wakeupShift: number) =>
      assembleXtensa(
        ESP32S3_IRAM_BASE,
        [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, wakeupTrig << 15, rtcSlpWakeupInt, sleepEn, wakeupTrig],
        [
          L32R(2, 0), // a2 = RTC_CNTL
          L32R(3, 1), // a3 = interrupt matrix
          MOVI(4, 1),
          S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
          L32R(5, 3),
          WSR(5, SR.VECBASE),
          MOVI(4, 2),
          WSR(4, SR.INTENABLE),
          L32R(4, 5),
          S32I(4, 2, 0x4c), // clear stale SLP_WAKEUP raw bit
          S32I(4, 2, 0x40), // enable SLP_WAKEUP raw source
          L32R(4, 4),
          S32I(4, 2, 0x3c), // WAKEUP_STATE WiFi/BT wake source
          RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
          L32R(4, 6),
          S32I(4, 2, 0x18), // STATE0.SLEEP_EN
          WAITI(0),
          L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
          L32R(5, 7),
          AND(4, 4, 5),
          SRLI(4, 4, wakeupShift),
          L32R(6, 2),
          S32I(4, 6, 0), // tx 1: selected wake cause bit was recorded
          L32I(4, 2, 0x48),
          S32I(4, 6, 0), // tx 0: INT_ST clear after ISR
          J(BR(-1)),

          PAD_TO(0x340),
          WSR(2, SR.EXCSAVE1),
          L32R(2, 0),
          L32R(3, 5),
          S32I(3, 2, 0x4c), // clear SLP_WAKEUP so it does not re-fire
          RSR(2, SR.EXCSAVE1),
          RFE(),
        ],
      );

    const wifi = core(imageFor(rtcWifiTrig, 5));
    wifi.step(300);
    expect([...wifi.drainUart()]).toEqual([]);
    wifi.setRtcWifiWake(true);
    wifi.step(1_000);
    expect([...wifi.drainUart()]).toEqual([1, 0]);
    wifi.step(300);
    expect([...wifi.drainUart()]).toEqual([]);

    const bt = core(imageFor(rtcBtTrig, 10));
    bt.step(300);
    expect([...bt.drainUart()]).toEqual([]);
    bt.setRtcBtWake(true);
    bt.step(1_000);
    expect([...bt.drainUart()]).toEqual([1, 0]);
    bt.step(300);
    expect([...bt.drainUart()]).toEqual([]);
  });

  it('UART0 RX wakes light sleep through RTC_CORE after edge threshold and drops the wake byte', () => {
    // Context7: ESP-IDF release/v5.5 sleep docs list UART wake as a
    // light-sleep source and say the triggering byte is not received.
    // Source-checked against ESP-IDF release/v5.5: soc/rtc.h makes
    // RTC_UART0_TRIG_EN BIT(6), uart_ll.h stores wake_threshold - 3 in
    // UART_SLEEP_CONF.ACTIVE_THRESHOLD, and uart.h documents 0x61 as
    // an 8N1 byte with three positive RX edges.
    const rtcUart0Trig = 1 << 6;
    const rtcSlpWakeupInt = 1;
    const uartWakeupInt = 1 << 19;
    const wakeupUart0 = rtcUart0Trig << 15;
    const sleepEn = 0x80000000;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, wakeupUart0, rtcSlpWakeupInt, sleepEn, rtcUart0Trig, 0xff, 0x3ff, uartWakeupInt],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0x4c), // clear stale SLP_WAKEUP raw
        S32I(4, 2, 0x40), // enable SLP_WAKEUP raw
        L32R(6, 2), // a6 = UART0
        MOVI(4, 0),
        S32I(4, 6, 0x38), // UART_SLEEP_CONF.ACTIVE_THRESHOLD = 0 -> 3 edges
        L32R(4, 4),
        S32I(4, 2, 0x3c), // WAKEUP_STATE UART0 wake source
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(4, 6),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 7),
        AND(4, 4, 5),
        L32R(6, 2),
        S32I(4, 6, 0), // tx RTC_UART0_TRIG_EN (0x40)
        L32R(7, 9),
        L32I(4, 6, 0x1c), // UART0 STATUS: wake byte is not received
        AND(4, 4, 7),
        S32I(4, 6, 0), // tx FIFO count 0
        L32I(4, 6, 0x04), // UART_INT_RAW
        L32R(5, 10),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // tx UART_WAKEUP_INT raw flag
        L32R(4, 10),
        S32I(4, 6, 0x10), // clear UART_WAKEUP_INT
        L32I(4, 6, 0x04),
        L32R(5, 10),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // tx 0: UART_WAKEUP_INT cleared
        L32I(4, 2, 0x48),
        S32I(4, 6, 0), // tx 0: RTC INT_ST clear after ISR
        L32I(4, 6, 0x1c), // wait for the post-wake byte
        AND(4, 4, 7),
        BEQZ(4, BR(-3)),
        L32I(4, 6, 0),
        L32R(5, 8),
        AND(4, 4, 5),
        S32I(4, 6, 0), // tx post-wake byte
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 5),
        S32I(3, 2, 0x4c), // clear SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWrite(0x61);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([rtcUart0Trig, 0, 1, 0, 0]);
    c.uartWrite(0x5a);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([0x5a]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('UART1 RX wakes light sleep through RTC_CORE after edge threshold and drops the wake byte', () => {
    // Context7 + ESP-IDF v5.5.4 sources: UART wake is light-sleep-only,
    // RTC_UART1_TRIG_EN is BIT(7), UART1 lives at UART0+0x10000, and
    // UART_SLEEP_CONF.ACTIVE_THRESHOLD stores wake_threshold - 3.
    const rtcUart1Trig = 1 << 7;
    const rtcSlpWakeupInt = 1;
    const uartWakeupInt = 1 << 19;
    const wakeupUart1 = rtcUart1Trig << 15;
    const sleepEn = 0x80000000;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, UART1, wakeupUart1, rtcSlpWakeupInt, sleepEn, rtcUart1Trig, 0xff, 0x3ff, uartWakeupInt],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 6),
        S32I(4, 2, 0x4c), // clear stale SLP_WAKEUP raw
        S32I(4, 2, 0x40), // enable SLP_WAKEUP raw
        L32R(7, 4), // a7 = UART1
        MOVI(4, 0),
        S32I(4, 7, 0x38), // UART_SLEEP_CONF.ACTIVE_THRESHOLD = 0 -> 3 edges
        L32R(4, 5),
        S32I(4, 2, 0x3c), // WAKEUP_STATE UART1 wake source
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(4, 7),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 8),
        AND(4, 4, 5),
        L32R(6, 2), // a6 = UART0 for test reporting
        S32I(4, 6, 0), // tx RTC_UART1_TRIG_EN (0x80)
        L32R(7, 4), // a7 = UART1
        L32R(8, 10),
        L32I(4, 7, 0x1c), // UART1 STATUS: wake byte is not received
        AND(4, 4, 8),
        S32I(4, 6, 0), // tx FIFO count 0
        L32I(4, 7, 0x04), // UART1 INT_RAW
        L32R(5, 11),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // tx UART_WAKEUP_INT raw flag
        L32R(4, 11),
        S32I(4, 7, 0x10), // clear UART_WAKEUP_INT
        L32I(4, 7, 0x04),
        L32R(5, 11),
        AND(4, 4, 5),
        MOVI(5, 0),
        BEQZ(4, BR(1)),
        MOVI(5, 1),
        S32I(5, 6, 0), // tx 0: UART_WAKEUP_INT cleared
        L32I(4, 2, 0x48),
        S32I(4, 6, 0), // tx 0: RTC INT_ST clear after ISR
        L32I(4, 7, 0x1c), // wait for the post-wake byte
        AND(4, 4, 8),
        BEQZ(4, BR(-3)),
        L32I(4, 7, 0),
        L32R(5, 9),
        AND(4, 4, 5),
        S32I(4, 6, 0), // tx post-wake byte
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 6),
        S32I(3, 2, 0x4c), // clear SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWriteTo(1, 0x61);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([rtcUart1Trig, 0, 1, 0, 0]);
    c.uartWriteTo(1, 0x6b);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([0x6b]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('UART0 light-sleep wake edge count honors configured data bits', () => {
    // Context7 + ESP-IDF v5.5.4 sources: UART_CONF0 at +0x20 stores
    // UART_BIT_NUM [3:2], UART_PARITY(_EN), and STOP_BIT_NUM; UART
    // wake counts positive RX edges across the configured frame.
    const rtcUart0Trig = 1 << 6;
    const rtcSlpWakeupInt = 1;
    const wakeupUart0 = rtcUart0Trig << 15;
    const sleepEn = 0x80000000;
    const uart7n1Conf0 = (2 << 2) | (1 << 4); // UART_DATA_7_BITS + UART_STOP_BITS_1
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, wakeupUart0, rtcSlpWakeupInt, sleepEn, rtcUart0Trig, 0xff, uart7n1Conf0, 0x3ff],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0x4c), // clear stale SLP_WAKEUP raw
        S32I(4, 2, 0x40), // enable SLP_WAKEUP raw
        L32R(6, 2), // a6 = UART0
        MOVI(4, 0),
        S32I(4, 6, 0x38), // UART_SLEEP_CONF.ACTIVE_THRESHOLD = 0 -> 3 edges
        L32R(4, 9),
        S32I(4, 6, 0x20), // UART_CONF0 = 7N1
        L32R(4, 4),
        S32I(4, 2, 0x3c), // WAKEUP_STATE UART0 wake source
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(4, 6),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 7),
        AND(4, 4, 5),
        S32I(4, 6, 0), // tx RTC_UART0_TRIG_EN (0x40)
        L32I(4, 6, 0x1c), // UART0 STATUS: wake bytes are not received
        L32R(5, 10),
        AND(4, 4, 5),
        S32I(4, 6, 0), // tx FIFO count 0
        L32I(4, 2, 0x48),
        S32I(4, 6, 0), // tx 0: INT_ST clear after ISR
        L32I(4, 6, 0x1c), // wait for the post-wake byte
        AND(4, 4, 5),
        BEQZ(4, BR(-3)),
        L32I(4, 6, 0),
        L32R(5, 8),
        AND(4, 4, 5),
        S32I(4, 6, 0), // tx post-wake byte
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 5),
        S32I(3, 2, 0x4c), // clear SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWrite(0x40);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWrite(0x40);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWrite(0x40);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([rtcUart0Trig, 0, 0]);
    c.uartWrite(0x5a);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([0x5a]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('GPIO high-level wakeup wakes light sleep through RTC_CORE and records the wake cause', () => {
    // Context7: ESP-IDF release/v5.5 sleep docs say GPIO wake is
    // light-sleep-only and uses high/low levels configured by
    // gpio_wakeup_enable. Source-checked against ESP-IDF release/v5.5:
    // gpio.c writes GPIO_PINn.INT_TYPE + WAKEUP_ENABLE, gpio_reg.h puts
    // WAKEUP_ENABLE at bit 10 and INT_TYPE at [9:7], and soc/rtc.h
    // exposes RTC_GPIO_TRIG_EN as BIT(2).
    const rtcGpioTrig = 1 << 2;
    const rtcSlpWakeupInt = 1;
    const wakeupGpio = rtcGpioTrig << 15;
    const sleepEn = 0x80000000;
    const gpioPin7HighWake = (1 << 10) | (5 << 7);
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, GPIO, wakeupGpio, rtcSlpWakeupInt, sleepEn, rtcGpioTrig, gpioPin7HighWake],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(7, 4), // a7 = GPIO
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 6),
        S32I(4, 2, 0x4c), // clear stale SLP_WAKEUP raw
        S32I(4, 2, 0x40), // enable SLP_WAKEUP raw
        L32R(4, 9),
        S32I(4, 7, 0x90), // GPIO_PIN7: WAKEUP_ENABLE + high-level INT_TYPE
        L32R(4, 5),
        S32I(4, 2, 0x3c), // WAKEUP_STATE GPIO wake source
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(4, 7),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 8),
        AND(4, 4, 5),
        L32R(6, 2),
        S32I(4, 6, 0), // tx RTC_GPIO_TRIG_EN (0x04)
        L32I(4, 2, 0x48),
        S32I(4, 6, 0), // tx 0: INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 6),
        S32I(3, 2, 0x4c), // clear SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.setPin('IO7', 1);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([rtcGpioTrig, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('EXT0 RTC IO wakeup records the single wake source', () => {
    // Context7: ESP-IDF release/v5.5 sleep docs say ESP32-S3 EXT0 uses
    // one RTC GPIO0..21 and wakes on a selected low/high level. Source-
    // checked against ESP-IDF release/v5.5: rtc_io_ll.h writes
    // RTC_IO_EXT_WAKEUP0_SEL and RTC_CNTL_EXT_WAKEUP0_LV, while
    // sleep_modes.c arms RTC_EXT0_TRIG_EN for esp_sleep_enable_ext0_wakeup().
    const rtcExt0Trig = 1 << 0;
    const rtcSlpWakeupInt = 1;
    const wakeupExt0 = rtcExt0Trig << 15;
    const sleepEn = 0x80000000;
    const ext0LvHigh = 1 << 30;
    const ext0Gpio7 = 7 << 27;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, RTCIO, wakeupExt0, rtcSlpWakeupInt, sleepEn, rtcExt0Trig, ext0LvHigh, ext0Gpio7],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(8, 4), // a8 = RTC_IO
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 6),
        S32I(4, 2, 0x4c), // clear stale SLP_WAKEUP raw
        S32I(4, 2, 0x40), // enable SLP_WAKEUP raw
        L32R(4, 9),
        S32I(4, 2, 0x64), // EXT_WAKEUP_CONF.EXT_WAKEUP0_LV = high
        L32R(4, 10),
        S32I(4, 8, 0xdc), // RTC_IO_EXT_WAKEUP0_SEL = RTC GPIO7
        L32R(4, 5),
        S32I(4, 2, 0x3c), // WAKEUP_STATE EXT0 wake source
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(4, 7),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 8),
        AND(4, 4, 5),
        L32R(6, 2),
        S32I(4, 6, 0), // tx RTC_EXT0_TRIG_EN (0x01)
        L32I(4, 8, 0xdc), // RTC_IO_EXT_WAKEUP0_SEL
        SRAI(4, 4, 27),
        S32I(4, 6, 0), // tx selected RTC GPIO number (7)
        L32I(4, 2, 0x48),
        S32I(4, 6, 0), // tx 0: INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 6),
        S32I(3, 2, 0x4c), // clear SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.setPin('IO7', 1);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([rtcExt0Trig, 7, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('EXT1 RTC GPIO wakeup records the selected RTC IO status', () => {
    // Context7: ESP-IDF release/v5.5 sleep docs say ESP32-S3 EXT1 uses
    // RTC GPIO0..21 and supports any-low/any-high modes. Source-checked
    // against ESP-IDF release/v5.5: rtc_cntl_ll_ext1_set_wakeup_pins()
    // writes EXT_WAKEUP1_SEL plus EXT_WAKEUP1_LV, and EXT_WAKEUP1_STATUS
    // is cleared through EXT_WAKEUP1_STATUS_CLR.
    const rtcExt1Trig = 1 << 1;
    const rtcSlpWakeupInt = 1;
    const wakeupExt1 = rtcExt1Trig << 15;
    const sleepEn = 0x80000000;
    const ext1LvHigh = 1 << 31;
    const ext1Gpio7 = 1 << 7;
    const ext1StatusClr = 1 << 22;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, wakeupExt1, rtcSlpWakeupInt, sleepEn, rtcExt1Trig, ext1LvHigh, ext1Gpio7, ext1StatusClr],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0x4c), // clear stale SLP_WAKEUP raw
        S32I(4, 2, 0x40), // enable SLP_WAKEUP raw
        L32R(4, 8),
        S32I(4, 2, 0x64), // EXT_WAKEUP_CONF.EXT_WAKEUP1_LV = high
        L32R(4, 9),
        S32I(4, 2, 0xe0), // EXT_WAKEUP1_SEL = RTC GPIO7
        L32R(4, 4),
        S32I(4, 2, 0x3c), // WAKEUP_STATE EXT1 wake source
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(4, 6),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 7),
        AND(4, 4, 5),
        L32R(6, 2),
        S32I(4, 6, 0), // tx RTC_EXT1_TRIG_EN (0x02)
        L32I(4, 2, 0xe4), // EXT_WAKEUP1_STATUS
        L32R(5, 9),
        AND(4, 4, 5),
        S32I(4, 6, 0), // tx GPIO7 status bit (0x80)
        L32R(4, 10),
        S32I(4, 2, 0xe0), // clear EXT_WAKEUP1_STATUS
        L32I(4, 2, 0xe4),
        S32I(4, 6, 0), // tx 0: EXT_WAKEUP1_STATUS cleared
        L32I(4, 2, 0x48),
        S32I(4, 6, 0), // tx 0: INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 5),
        S32I(3, 2, 0x4c), // clear SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.setPin('IO7', 1);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([rtcExt1Trig, ext1Gpio7, 0, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('RTC sleep reject blocks light sleep and reports the reject cause through RTC_CORE', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h has SLP_REJECT_CONF +0x68 with
    // LIGHT_SLP_REJECT_EN bit 30 and SLEEP_REJECT_ENA [29:12];
    // STATE0.SLP_REJECT is bit 30, SLP_REJECT_CAUSE is +0x128, and
    // RTC_CNTL_SLP_REJECT_INT_* is bit 1. soc/rtc.h defines
    // RTC_GPIO_TRIG_EN as BIT(2), part of RTC_SLEEP_REJECT_MASK.
    const rtcGpioTrig = 1 << 2;
    const rtcSleepRejectInt = 1 << 1;
    const lightSleepRejectEn = 1 << 30;
    const rejectConf = lightSleepRejectEn | (rtcGpioTrig << 12);
    const sleepEn = 0x80000000;
    const rejectCauseClr = 1 << 1;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, rtcSleepRejectInt, rejectConf, sleepEn, rtcGpioTrig, 1, rejectCauseClr],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0x68), // SLP_REJECT_CONF: light sleep, GPIO source
        L32R(4, 4),
        S32I(4, 2, 0x4c), // clear stale SLP_REJECT raw
        S32I(4, 2, 0x40), // enable SLP_REJECT raw
        RSIL(12, 12), // hold the reject interrupt until WAITI lowers INTLEVEL
        L32R(4, 6),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN, rejected by host source
        WAITI(0),
        L32I(4, 2, 0x18),
        SRAI(4, 4, 30),
        L32R(6, 8),
        AND(4, 4, 6),
        L32R(5, 2),
        S32I(4, 5, 0), // tx 1: STATE0.SLP_REJECT latched
        L32I(4, 2, 0x128),
        L32R(6, 7),
        AND(4, 4, 6),
        S32I(4, 5, 0), // tx 4: GPIO reject cause
        L32I(4, 2, 0x18),
        SRAI(4, 4, 31),
        L32R(6, 8),
        AND(4, 4, 6),
        S32I(4, 5, 0), // tx 0: SLEEP_EN did not stick
        L32R(4, 9),
        S32I(4, 2, 0x18), // SLP_REJECT_CAUSE_CLR
        L32I(4, 2, 0x128),
        S32I(4, 5, 0), // tx 0: cause cleared
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear SLP_REJECT raw
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.setRtcSleepRejectSource(rtcGpioTrig);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, rtcGpioTrig, 0, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('RTC low-power status reports idle, sleep, and ready-for-wakeup bits', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // ULP WAKE examples poll RTC_CNTL_LOW_POWER_ST.RDY_FOR_WAKEUP
    // before waking a sleeping main CPU, or MAIN_STATE_IN_IDLE when the
    // main CPU is not asleep.
    const sleepEn = 0x80000000;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, UART, sleepEn],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(6, 1), // a6 = UART
        L32I(4, 2, 0xd0), // LOW_POWER_ST while awake
        SRAI(4, 4, 27),
        S32I(4, 6, 0), // tx 1: MAIN_STATE_IN_IDLE
        L32R(4, 2),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        L32I(5, 2, 0xd0), // LOW_POWER_ST while sleeping
        SRAI(5, 5, 19),
        S32I(5, 6, 0), // tx 0x81: MAIN_STATE_IN_SLP + RDY_FOR_WAKEUP
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(80);
    expect([...c.drainUart()]).toEqual([1, 0x81]);
  });

  it('RTC low-power status reports COCPU done and sleep after ULP halt control writes', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // ulp_riscv_halt() sets RTC_CNTL_COCPU_CTRL.COCPU_DONE and
    // COCPU_SHUT_RESET_EN; rtc_cntl_reg.h exposes LOW_POWER_ST
    // COCPU_STATE_DONE/SLP as read-only status bits.
    const cocpuDoneAndReset = (1 << 25) | (1 << 22);
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, UART, cocpuDoneAndReset],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(6, 1), // a6 = UART
        L32R(4, 2),
        S32I(4, 2, 0x104), // COCPU_CTRL.DONE | SHUT_RESET_EN
        L32I(5, 2, 0xd0), // LOW_POWER_ST
        SRAI(5, 5, 15),
        MOVI(7, 3),
        AND(5, 5, 7),
        S32I(5, 6, 0), // tx 3: COCPU_STATE_DONE | COCPU_STATE_SLP
        MOVI(4, 0),
        S32I(4, 2, 0x104), // rescue/reset path clears the status-driving bits
        L32I(5, 2, 0xd0),
        SRAI(5, 5, 15),
        AND(5, 5, 7),
        S32I(5, 6, 0), // tx 0: COCPU status bits clear
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(120);
    expect([...c.drainUart()]).toEqual([3, 0]);
  });

  it('COCPU control exposes documented reset timing fields', () => {
    // Source-checked against ESP-IDF release/v5.5 rtc_cntl_reg.h:
    // COCPU_SEL defaults high, SHUT_2_CLK_DIS defaults 40,
    // START_2_INTR_EN defaults 16, and START_2_RESET_DIS defaults 8.
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, UART, 0x3f, 0xff, 1],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32I(4, 2, 0x104), // COCPU_CTRL reset value
        L32R(7, 1),
        S32I(4, 7, 0), // tx 0x10: START_2_RESET_DIS low byte
        SRAI(5, 4, 7),
        L32R(6, 2),
        AND(5, 5, 6),
        S32I(5, 7, 0), // tx 16: START_2_INTR_EN
        SRAI(5, 4, 14),
        L32R(6, 3),
        AND(5, 5, 6),
        S32I(5, 7, 0), // tx 40: SHUT_2_CLK_DIS
        SRAI(5, 4, 23),
        L32R(6, 4),
        AND(5, 5, 6),
        S32I(5, 7, 0), // tx 1: COCPU_SEL
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(500);
    expect([...c.drainUart()]).toEqual([0x10, 16, 40, 1]);
  });

  it('COCPU software trigger wakes WAITI through the RTC core interrupt matrix', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h has COCPU_CTRL +0x104, COCPU_SW_INT_TRIGGER
    // bit 26, and RTC_CNTL_COCPU_INT_* at bit 13. RTC_CORE routes
    // through interrupt_core0_reg.h +0x09c.
    const RTC_COCPU_INT = 1 << 13;
    const RTC_COCPU_SW_INT_TRIGGER = 1 << 26;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, SYS, SET_BOOT, CORE1_ENTRY, RTC_COCPU_INT, RTC_COCPU_SW_INT_TRIGGER],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(4, 1), // a4 = interrupt matrix
        MOVI(5, 1),
        S32I(5, 4, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(5, 2),
        WSR(5, SR.INTENABLE),
        L32R(7, 7),
        S32I(7, 2, 0x4c), // clear stale COCPU raw
        S32I(7, 2, 0x40), // enable COCPU raw
        L32R(10, 5),
        L32R(2, 6),
        CALLX0(10), // ets_set_appcpu_boot_addr(CORE1_ENTRY)
        L32R(2, 0), // restore a2 = RTC_CNTL after the call0 argument
        L32R(8, 4), // a8 = SYSTEM
        MOVI(9, 6),
        S32I(9, 8, 0), // CLKGATE_EN | RESETING
        MOVI(9, 2),
        S32I(9, 8, 0), // clear RESETING: core 1 released
        RSIL(12, 0),
        WAITI(0),
        L32I(5, 2, 0x48), // INT_ST after handler clear
        L32R(6, 2),
        S32I(5, 6, 0), // tx 0: status is clear
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 7),
        S32I(3, 2, 0x4c), // clear COCPU raw
        RSR(2, SR.EXCSAVE1),
        RFE(),

        PAD_TO(0x400),
        L32R(2, 0), // core 1: a2 = RTC_CNTL
        MOVI(3, 80),
        ADDI(3, 3, -1),
        BNEZ(3, BR(-2)), // give core 0 time to enter WAITI
        L32R(4, 8),
        S32I(4, 2, 0x104), // COCPU_CTRL.COCPU_SW_INT_TRIGGER
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(5_000);
    expect([...c.drainUart()]).toEqual([0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('COCPU software trigger wakes RTC sleep with the COCPU wake source recorded', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h has COCPU_CTRL.COCPU_SW_INT_TRIGGER and
    // RTC_CNTL_COCPU_INT at bit 13; soc/rtc.h exposes
    // RTC_COCPU_TRIG_EN as wake source bit 11.
    const RTC_COCPU_INT = 1 << 13;
    const RTC_SLP_WAKEUP_INT = 1;
    const RTC_COCPU_TRIG_EN = 1 << 11;
    const RTC_COCPU_SW_INT_TRIGGER = 1 << 26;
    const rtcIntMask = RTC_COCPU_INT | RTC_SLP_WAKEUP_INT;
    const wakeupCocpu = RTC_COCPU_TRIG_EN << 15;
    const sleepEn = 0x80000000;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, rtcIntMask, wakeupCocpu, sleepEn, RTC_COCPU_SW_INT_TRIGGER],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(5, 1),
        S32I(5, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(5, 2),
        WSR(5, SR.INTENABLE),
        L32R(5, 4),
        S32I(5, 2, 0x4c), // clear stale COCPU/SLP_WAKEUP raw bits
        S32I(5, 2, 0x40), // enable COCPU and SLP_WAKEUP raw bits
        L32R(5, 5),
        S32I(5, 2, 0x3c), // WAKEUP_STATE COCPU wake source
        L32R(5, 6),
        S32I(5, 2, 0x18), // STATE0.SLEEP_EN
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(5, 7),
        S32I(5, 2, 0x104), // COCPU_CTRL.COCPU_SW_INT_TRIGGER
        WAITI(0),
        L32I(5, 2, 0x130), // SLP_WAKEUP_CAUSE
        SRLI(5, 5, 11),
        L32R(6, 2),
        S32I(5, 6, 0), // tx 1: COCPU_TRIG_EN recorded
        L32I(5, 2, 0x48),
        S32I(5, 6, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear COCPU/SLP_WAKEUP raw bits
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('COCPU debug trigger wakes RTC sleep with the trap wake source recorded', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // sens_reg.h exposes SENS_SAR_COCPU_STATE (+0xe4),
    // SENS_COCPU_DBG_TRIGGER (bit 25), and SENS_COCPU_TRAP (bit 29).
    // rtc_cntl_reg.h exposes RTC_CNTL_COCPU_TRAP_INT at bit 17, while
    // soc/rtc.h exposes RTC_COCPU_TRAP_TRIG_EN as wake source bit 13.
    const SENS = 0x60008800;
    const RTC_COCPU_TRAP_INT = 1 << 17;
    const RTC_SLP_WAKEUP_INT = 1;
    const RTC_COCPU_TRAP_TRIG_EN = 1 << 13;
    const SENS_COCPU_DBG_TRIGGER = 1 << 25;
    const rtcIntMask = RTC_COCPU_TRAP_INT | RTC_SLP_WAKEUP_INT;
    const wakeupTrap = RTC_COCPU_TRAP_TRIG_EN << 15;
    const sleepEn = 0x80000000;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, SENS, rtcIntMask, wakeupTrap, sleepEn, SENS_COCPU_DBG_TRIGGER],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(4, 4), // a4 = SENS
        MOVI(5, 1),
        S32I(5, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(5, 2),
        WSR(5, SR.INTENABLE),
        L32R(5, 5),
        S32I(5, 2, 0x4c), // clear stale COCPU_TRAP/SLP_WAKEUP raw bits
        S32I(5, 2, 0x40), // enable COCPU_TRAP and SLP_WAKEUP raw bits
        L32R(5, 6),
        S32I(5, 2, 0x3c), // WAKEUP_STATE COCPU_TRAP wake source
        L32R(5, 7),
        S32I(5, 2, 0x18), // STATE0.SLEEP_EN
        RSIL(12, 12), // hold pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(5, 8),
        S32I(5, 4, 0xe4), // SENS_SAR_COCPU_STATE.SENS_COCPU_DBG_TRIGGER
        WAITI(0),
        L32I(5, 2, 0x130), // SLP_WAKEUP_CAUSE
        SRLI(5, 5, 13),
        L32R(6, 2),
        S32I(5, 6, 0), // tx 1: RTC_COCPU_TRAP_TRIG_EN recorded
        L32I(5, 4, 0xe4), // SENS_SAR_COCPU_STATE
        SRLI(5, 5, 15),
        SRLI(5, 5, 14),
        S32I(5, 6, 0), // tx 1: SENS_COCPU_TRAP readback
        L32I(5, 2, 0x48),
        S32I(5, 6, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 5),
        S32I(3, 2, 0x4c), // clear COCPU_TRAP/SLP_WAKEUP raw bits
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('brownout detector trips wake WAITI through the RTC core interrupt matrix', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h has BROWN_OUT +0xe8, BROWN_OUT_DET bit 31,
    // BROWN_OUT_ENA bit 30, and RTC_CNTL_BROWN_OUT_INT_* at bit 9.
    // brownout_ll.h configures interrupt-vs-reset through that register,
    // and RTC_CORE routes through interrupt_core0_reg.h +0x09c.
    const RTC_BROWN_OUT_INT = 1 << 9;
    const RTC_BROWN_OUT_ENA = 1 << 30;
    const rtcBrownoutReset = (RTC_BROWN_OUT_ENA | (0x3ff << 16) | (1 << 4)) >>> 0;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, RTC_BROWN_OUT_INT, rtcBrownoutReset],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0xe8), // BOD enabled, hardware reset disabled for ISR mode
        L32R(4, 4),
        S32I(4, 2, 0x4c), // clear stale BROWN_OUT raw
        S32I(4, 2, 0x40), // enable BROWN_OUT raw
        RSIL(8, 0),
        WAITI(0),
        L32I(4, 2, 0xe8), // BROWN_OUT_DET is a real readback bit
        SRAI(4, 4, 31),
        MOVI(6, 1),
        AND(4, 4, 6),
        L32R(5, 2),
        S32I(4, 5, 0), // tx 1
        L32I(4, 2, 0x48), // INT_ST after handler clear
        S32I(4, 5, 0), // tx 0
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear BROWN_OUT raw
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.setBrownoutDetected(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('brownout analog reset follows FIB_SEL software control and reports the ROM brownout cause', () => {
    // Source-checked against ESP-IDF v5.5.4: brownout_ll_ana_reset_enable()
    // clears RTC_CNTL_FIB_BOD_RST before setting BROWN_OUT_ANA_RST_EN.
    // esp32s3/rom/rtc.h reports brownout resets as cause 15.
    const RTC_BROWN_OUT_ENA = 1 << 30;
    const RTC_BROWN_OUT_ANA_RST_EN = 1 << 28;
    const FIB_BOD_RST = 1 << 1;
    const fibSoftwareBodReset = 0x7 & ~FIB_BOD_RST;
    const rtcBrownoutAnalogReset =
      (RTC_BROWN_OUT_ENA | RTC_BROWN_OUT_ANA_RST_EN | (0x3ff << 16) | (1 << 4)) >>> 0;
    const image = causeRoundTrip([RTCCNTL, fibSoftwareBodReset, rtcBrownoutAnalogReset], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0x148), // FIB_SEL: software controls BOD reset
      L32R(9, 4),
      S32I(9, 8, 0xe8), // BROWN_OUT: enable detector + analog reset only
    ]);
    const c = core(image);
    c.step(800);
    expect([...c.drainUart()]).toEqual([1]);
    c.setBrownoutDetected(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([15]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('power-glitch detector trips WAITI through the RTC core interrupt matrix', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h has PG_CTRL +0x144, POWER_GLITCH_EN bit 31, and
    // RTC_CNTL_GLITCH_DET_INT_* at bit 19. RTC_CORE routes through
    // interrupt_core0_reg.h +0x09c.
    const RTC_GLITCH_DET_INT = 1 << 19;
    const POWER_GLITCH_EN = 0x80000000;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, RTC_GLITCH_DET_INT, POWER_GLITCH_EN],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0x144), // PG_CTRL.POWER_GLITCH_EN
        L32R(4, 4),
        S32I(4, 2, 0x4c), // clear stale GLITCH_DET raw
        S32I(4, 2, 0x40), // enable GLITCH_DET raw
        RSIL(8, 0),
        WAITI(0),
        L32I(4, 2, 0x144),
        SRAI(4, 4, 31),
        MOVI(6, 1),
        AND(4, 4, 6),
        L32R(5, 2),
        S32I(4, 5, 0), // tx 1: PG_CTRL enable bit round-tripped
        L32I(4, 2, 0x48),
        S32I(4, 5, 0), // tx 0: INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear GLITCH_DET raw
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.setPowerGlitchDetected(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('clock-glitch detector trips WAITI through the RTC core interrupt matrix', () => {
    // Source-checked against ESP-IDF v5.5.4: ANA_CONF has
    // GLITCH_RST_EN bit 20, RTC_CNTL_GLITCH_DET_INT_* is bit 19, and
    // RTC_CORE routes through interrupt_core0_reg.h +0x09c.
    const RTC_GLITCH_DET_INT = 1 << 19;
    const RTC_GLITCH_RST_EN = 1 << 20;
    const RTC_ANA_CONF_RESET = (1 << 22) | (1 << 18);
    const anaConfGlitchDetect = (RTC_ANA_CONF_RESET | RTC_GLITCH_RST_EN) >>> 0;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, RTC_GLITCH_DET_INT, anaConfGlitchDetect],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0x34), // ANA_CONF.GLITCH_RST_EN, without software reset routing
        L32R(4, 4),
        S32I(4, 2, 0x4c), // clear stale GLITCH_DET raw
        S32I(4, 2, 0x40), // enable GLITCH_DET raw
        RSIL(8, 0),
        WAITI(0),
        L32I(4, 2, 0x34),
        SRAI(4, 4, 20),
        MOVI(6, 1),
        AND(4, 4, 6),
        L32R(5, 2),
        S32I(4, 5, 0), // tx 1: ANA_CONF.GLITCH_RST_EN round-tripped
        L32I(4, 2, 0x48),
        S32I(4, 5, 0), // tx 0: INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear GLITCH_DET raw
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
    c.setClockGlitchDetected(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('power-glitch reset follows FIB_SEL software control and reports the ROM power-glitch cause', () => {
    // Source-checked against ESP-IDF release/v5.5: PG_CTRL has
    // POWER_GLITCH_EN, FIB_SEL bit 0 is FIB_GLITCH_RST, and
    // esp32s3/rom/rtc.h reports power-glitch resets as cause 23.
    const POWER_GLITCH_EN = 0x80000000;
    const FIB_GLITCH_RST = 1;
    const fibSoftwareGlitchReset = 0x7 & ~FIB_GLITCH_RST;
    const image = causeRoundTrip([RTCCNTL, fibSoftwareGlitchReset, POWER_GLITCH_EN], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0x148), // FIB_SEL: software controls glitch reset
      L32R(9, 4),
      S32I(9, 8, 0x144), // PG_CTRL: enable power-glitch detector
    ]);
    const c = core(image);
    c.step(800);
    expect([...c.drainUart()]).toEqual([1]);
    c.setPowerGlitchDetected(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([23]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('power-glitch eFuse selector enables reset from BLOCK0 POWERGLITCH_EN', () => {
    // Source-checked against ESP-IDF v5.5.4: PG_CTRL.EFUSE_SEL is bit
    // 30, EFUSE_RD_REPEAT_DATA4 has POWERGLITCH_EN at bit 30, and
    // esp32s3/rom/rtc.h reports power-glitch resets as cause 23.
    const POWER_GLITCH_EFUSE_SEL = 1 << 30;
    const EFUSE_POWERGLITCH_EN = 1 << 30;
    const EFUSE_BLK0_PGM_CMD = EFUSE_PGM_DONE;
    const FIB_GLITCH_RST = 1;
    const fibSoftwareGlitchReset = 0x7 & ~FIB_GLITCH_RST;

    const fuseClearImage = causeRoundTrip([RTCCNTL, fibSoftwareGlitchReset, POWER_GLITCH_EFUSE_SEL], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0x148), // FIB_SEL: software controls glitch reset
      L32R(9, 4),
      S32I(9, 8, 0x144), // PG_CTRL: select eFuse enable source
    ]);
    const fuseClear = core(fuseClearImage);
    fuseClear.step(800);
    expect([...fuseClear.drainUart()]).toEqual([1]);
    fuseClear.setPowerGlitchDetected(true);
    fuseClear.step(1_000);
    expect([...fuseClear.drainUart()]).toEqual([]);

    const image = causeRoundTrip(
      [
        EFUSE_BASE,
        RTCCNTL,
        EFUSE_POWERGLITCH_EN,
        EFUSE_WRITE_OP_CODE,
        EFUSE_BLK0_PGM_CMD,
        fibSoftwareGlitchReset,
        POWER_GLITCH_EFUSE_SEL,
      ],
      [
        L32R(8, 2),
        L32R(9, 4),
        S32I(9, 8, 0x14), // PGM_DATA5: BLOCK0 POWERGLITCH_EN
        L32R(9, 5),
        S32I(9, 8, 0x1cc), // CONF = WRITE_OP_CODE
        L32R(9, 6),
        S32I(9, 8, 0x1d4), // CMD = BLOCK0 + PGM_CMD
        L32R(8, 3),
        L32R(9, 7),
        S32I(9, 8, 0x148), // FIB_SEL: software controls glitch reset
        L32R(9, 8),
        S32I(9, 8, 0x144), // PG_CTRL: eFuse-selected power-glitch enable
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1]);
    c.setPowerGlitchDetected(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([23]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('clock-glitch reset follows ANA_CONF and FIB_SEL software control', () => {
    // Source-checked against ESP-IDF v5.5.4: ANA_CONF is +0x34,
    // GLITCH_RST_EN is bit 20, FIB_SEL bit 0 is FIB_GLITCH_RST, and
    // esp32s3/rom/rtc.h reports clock-glitch resets as cause 19.
    const RTC_GLITCH_RST_EN = 1 << 20;
    const RTC_ANA_CONF_RESET = (1 << 22) | (1 << 18);
    const FIB_GLITCH_RST = 1;
    const fibSoftwareGlitchReset = 0x7 & ~FIB_GLITCH_RST;
    const anaConfGlitchReset = (RTC_ANA_CONF_RESET | RTC_GLITCH_RST_EN) >>> 0;
    const image = causeRoundTrip([RTCCNTL, fibSoftwareGlitchReset, anaConfGlitchReset], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0x148), // FIB_SEL: software controls glitch reset
      L32R(9, 4),
      S32I(9, 8, 0x34), // ANA_CONF.GLITCH_RST_EN
    ]);
    const c = core(image);
    c.step(800);
    expect([...c.drainUart()]).toEqual([1]);
    c.setClockGlitchDetected(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([19]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('RTC FIB_SEL resets and writes only the documented three-bit selector', () => {
    // Source-checked against ESP-IDF release/v5.5 rtc_cntl_reg.h:
    // RTC_CNTL_FIB_SEL is an R/W field at PG_CTRL+0x4, bitpos [2:0],
    // reset 3'd7.
    const fibSelMask = 0x7;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, UART, fibSelMask, 0x02, 0xff],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = UART
        L32R(6, 2),
        L32I(4, 2, 0x148),
        AND(4, 4, 6),
        S32I(4, 3, 0), // tx 7: reset selector
        L32R(4, 3),
        S32I(4, 2, 0x148),
        L32I(5, 2, 0x148),
        AND(5, 5, 6),
        S32I(5, 3, 0), // tx 2: selector write
        L32R(4, 4),
        S32I(4, 2, 0x148),
        L32I(5, 2, 0x148),
        S32I(5, 3, 0), // tx 7: high bits do not stick
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(300);
    expect([...c.drainUart()]).toEqual([7, 2, 7]);
  });

  it('XTAL32K-dead trips wake sleep through RTC_CORE and record the wake cause', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h has EXT_XTL_CONF +0x60 with XTAL32K_WDT_EN bit 0,
    // XTAL32K_CONF +0xf8 for timeout policy, and
    // RTC_CNTL_XTAL32K_DEAD_INT_* at bit 16. soc/rtc.h exposes
    // RTC_XTAL32K_DEAD_TRIG_EN as wake source bit 12.
    const RTC_XTAL32K_DEAD_INT = 1 << 16;
    const RTC_SLP_WAKEUP_INT = 1;
    const rtcIntMask = RTC_XTAL32K_DEAD_INT | RTC_SLP_WAKEUP_INT;
    const wakeupXtal32kDead = (1 << 12) << 15;
    const xtal32kWdtEn = 1;
    const sleepEn = 0x80000000;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, rtcIntMask, wakeupXtal32kDead, xtal32kWdtEn, sleepEn],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 4),
        S32I(4, 2, 0x4c), // clear stale XTAL32K_DEAD/SLP_WAKEUP raw
        S32I(4, 2, 0x40), // enable both RTC raw sources
        L32R(4, 5),
        S32I(4, 2, 0x3c), // WAKEUP_STATE XTAL32K_DEAD wake source
        L32R(4, 6),
        S32I(4, 2, 0x60), // EXT_XTL_CONF.XTAL32K_WDT_EN
        L32R(4, 7),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        RSIL(8, 0),
        WAITI(0),
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE
        SRLI(4, 4, 12),
        L32R(5, 2),
        S32I(4, 5, 0), // tx 1: XTAL32K_DEAD_TRIG_EN recorded
        L32I(4, 2, 0x48), // INT_ST after handler clear
        S32I(4, 5, 0), // tx 0
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear XTAL32K_DEAD/SLP_WAKEUP raw
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(400);
    expect([...c.drainUart()]).toEqual([]);
    c.setXtal32kDead(true);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('SUPER_WDT feed interrupt wakes WAITI through RTC_CORE without reset', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h has SWD_CONF +0xb4, SWD_WPROTECT +0xb8,
    // SWD_FEED_INT bit 1, SWD_FEED bit 29, SWD_BYPASS_RST bit 17,
    // and RTC_CNTL_SWD_INT_* at bit 15. RTC_CORE routes through
    // interrupt_core0_reg.h +0x09c.
    const RTC_SWD_INT = 1 << 15;
    const RTC_SWD_WKEY = 0x8f1d312a;
    const RTC_SWD_BYPASS_RST = 1 << 17;
    const RTC_SWD_FEED = 1 << 29;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, RTC_SWD_INT, RTC_SWD_WKEY, RTC_SWD_BYPASS_RST, RTC_SWD_FEED],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        L32R(4, 5),
        S32I(4, 2, 0xb8), // unlock SUPER_WDT
        L32R(4, 6),
        S32I(4, 2, 0xb4), // SWD_CONF.BYPASS_RST: interrupt only
        L32R(4, 4),
        S32I(4, 2, 0x4c), // clear stale SWD raw
        S32I(4, 2, 0x40), // enable SWD raw
        RSIL(8, 0),
        WAITI(0),
        L32I(4, 2, 0xb4), // SWD_CONF.FEED_INT readback
        SRLI(4, 4, 1),
        MOVI(6, 1),
        AND(4, 4, 6),
        L32R(5, 2),
        S32I(4, 5, 0), // tx 1
        L32R(4, 7),
        S32I(4, 2, 0xb4), // SWD_FEED clears FEED_INT
        L32I(4, 2, 0xb4),
        SRLI(4, 4, 1),
        AND(4, 4, 6),
        S32I(4, 5, 0), // tx 0: feed pulse cleared FEED_INT
        L32I(4, 2, 0x48), // INT_ST after handler/feed clear
        S32I(4, 5, 0), // tx 0
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear SWD raw
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(400);
    expect([...c.drainUart()]).toEqual([]);
    c.triggerSuperWatchdog();
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('SUPER_WDT reset follows FIB_SEL software control and reports the ROM cause', () => {
    // Source-checked against ESP-IDF v5.5.4: SWD_CONF has
    // SWD_BYPASS_RST bit 17, FIB_SEL bit 2 is FIB_SUPER_WDT_RST, and
    // esp32s3/rom/rtc.h reports super-watchdog resets as cause 18.
    const RTC_SWD_WKEY = 0x8f1d312a;
    const FIB_SUPER_WDT_RST = 1 << 2;
    const fibSoftwareSuperWdtReset = 0x7 & ~FIB_SUPER_WDT_RST;

    const defaultFibImage = causeRoundTrip([RTCCNTL, RTC_SWD_WKEY], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0xb8), // unlock SUPER_WDT
      MOVI(9, 0),
      S32I(9, 8, 0xb4), // BYPASS_RST clear, but FIB still owns reset
    ]);
    const defaultFib = core(defaultFibImage);
    defaultFib.step(300);
    expect([...defaultFib.drainUart()]).toEqual([1]);
    defaultFib.triggerSuperWatchdog();
    defaultFib.step(1_000);
    expect([...defaultFib.drainUart()]).toEqual([]);

    const image = causeRoundTrip([RTCCNTL, RTC_SWD_WKEY, fibSoftwareSuperWdtReset], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0xb8), // unlock SUPER_WDT
      MOVI(9, 0),
      S32I(9, 8, 0xb4), // BYPASS_RST clear
      L32R(9, 4),
      S32I(9, 8, 0x148), // FIB_SEL: software controls SUPER_WDT reset
    ]);
    const c = core(image);
    c.step(800);
    expect([...c.drainUart()]).toEqual([1]);
    c.triggerSuperWatchdog();
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([18]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('SARADC1/2 RTC-domain conversions route through RTC_CORE', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // sens_reg.h has SENS_SAR1_INT_EN bit 29, SENS_SAR2_INT_EN bit 30,
    // MEASx_START_SAR bit 17, and MEASx_DONE_SAR bit 16. rtc_cntl_reg.h
    // routes SARADC1/SARADC2 into RTC_CNTL INT bits 11 and 14.
    const SENS = 0x60008800;
    const SCRATCH = ESP32S3_DRAM_BASE + 0xa00;
    const RTC_SARADC1_INT = 1 << 11;
    const RTC_SARADC2_INT = 1 << 14;
    const CTRL_ADC1_CH3 = (0x80000000 | (1 << 18) | (1 << (19 + 3))) >>> 0;
    const CTRL_ADC1_CH3_START = (CTRL_ADC1_CH3 | (1 << 17)) >>> 0;
    const CTRL_ADC2_CH4 = (0x80000000 | (1 << 18) | (1 << (19 + 4))) >>> 0;
    const CTRL_ADC2_CH4_START = (CTRL_ADC2_CH4 | (1 << 17)) >>> 0;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        RTCCNTL,
        INTMTX,
        UART,
        ESP32S3_IRAM_BASE,
        SENS,
        SCRATCH,
        RTC_SARADC1_INT,
        CTRL_ADC1_CH3,
        CTRL_ADC1_CH3_START,
        RTC_SARADC2_INT,
        CTRL_ADC2_CH4,
        CTRL_ADC2_CH4_START,
      ],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(4, 4), // a4 = SENS
        L32R(5, 2), // a5 = UART
        L32R(8, 5), // a8 = ISR counter scratch
        MOVI(6, 0),
        S32I(6, 8, 0),
        MOVI(6, 1),
        S32I(6, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(6, 2),
        WSR(6, SR.INTENABLE),
        L32R(6, 6),
        S32I(6, 2, 0x4c), // clear stale SARADC1 raw
        S32I(6, 2, 0x40), // enable SARADC1 raw
        RSIL(12, 0),
        L32R(6, 7),
        S32I(6, 4, 0x0c), // ADC1 start low
        L32R(6, 8),
        S32I(6, 4, 0x0c), // ADC1 start 0->1, ISR increments scratch
        MOVI(9, 1),
        L32I(6, 8, 0),
        BNE(6, 9, BR(-2)),
        L32I(6, 4, 0x0c), // MEAS1_DONE_SAR
        SRAI(6, 6, 16),
        MOVI(7, 1),
        AND(6, 6, 7),
        S32I(6, 5, 0), // tx 1: ADC1 done
        L32I(6, 2, 0x48),
        S32I(6, 5, 0), // tx 0: RTC INT_ST clear after ISR

        MOVI(6, 0),
        S32I(6, 8, 0),
        L32R(6, 9),
        S32I(6, 2, 0x4c), // clear stale SARADC2 raw
        S32I(6, 2, 0x40), // enable SARADC2 raw
        L32R(6, 10),
        S32I(6, 4, 0x30), // ADC2 start low
        L32R(6, 11),
        S32I(6, 4, 0x30), // ADC2 start 0->1, ISR increments scratch
        MOVI(9, 1),
        L32I(6, 8, 0),
        BNE(6, 9, BR(-2)),
        L32I(6, 4, 0x30), // MEAS2_DONE_SAR
        SRAI(6, 6, 16),
        AND(6, 6, 7),
        S32I(6, 5, 0), // tx 1: ADC2 done
        L32I(6, 2, 0x48),
        S32I(6, 5, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(10, 0),
        L32R(11, 5),
        L32I(12, 11, 0),
        ADDI(12, 12, 1),
        S32I(12, 11, 0), // scratch++ proves RTC_CORE dispatched
        L32I(12, 10, 0x48),
        S32I(12, 10, 0x4c), // clear the enabled RTC raw producer
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_500);
    expect([...c.drainUart()]).toEqual([1, 0, 1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('TSENS raw reads route through RTC_CORE', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // temperature_sensor_ll_get_temperature_raw() sets TSENS_DUMP_OUT,
    // waits for TSENS_READY, then reads TSENS_OUT. rtc_cntl_reg.h routes
    // TSENS into RTC_CNTL INT bit 12.
    const SENS = 0x60008800;
    const SCRATCH = ESP32S3_DRAM_BASE + 0xa20;
    const RTC_TSENS_INT = 1 << 12;
    const TSENS_DUMP_OUT = (1 << 24) | (1 << 12) | (6 << 14);
    const BYTE_MASK = 0xff;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, SENS, SCRATCH, RTC_TSENS_INT, TSENS_DUMP_OUT, BYTE_MASK],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(4, 4), // a4 = SENS
        L32R(5, 2), // a5 = UART
        L32R(8, 5), // a8 = ISR counter scratch
        MOVI(6, 0),
        S32I(6, 8, 0),
        MOVI(6, 1),
        S32I(6, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(6, 2),
        WSR(6, SR.INTENABLE),
        L32R(6, 6),
        S32I(6, 2, 0x4c), // clear stale TSENS raw
        S32I(6, 2, 0x40), // enable TSENS raw
        RSIL(12, 0),
        L32R(6, 7),
        S32I(6, 4, 0x50), // TSENS_DUMP_OUT: conversion/read completes immediately
        MOVI(9, 1),
        L32I(6, 8, 0),
        BNE(6, 9, BR(-2)),
        L32I(6, 4, 0x50), // TSENS_READY + TSENS_OUT
        SRLI(7, 6, 8),
        MOVI(10, 1),
        AND(7, 7, 10),
        S32I(7, 5, 0), // tx 1: ready
        L32R(7, 8),
        AND(6, 6, 7),
        S32I(6, 5, 0), // tx raw output byte
        L32I(6, 2, 0x48),
        S32I(6, 5, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(10, 0),
        L32R(11, 5),
        L32I(12, 11, 0),
        ADDI(12, 12, 1),
        S32I(12, 11, 0), // scratch++ proves RTC_CORE dispatched
        L32I(12, 10, 0x48),
        S32I(12, 10, 0x4c), // clear TSENS raw
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 128, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('touch one-shot scans route done/scan/active through RTC_CORE', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // touch_ll_trigger_oneshot_measurement() pulses TOUCH_START_EN,
    // touch_ll_is_measure_done() reads SENS_TOUCH_MEAS_DONE, and
    // touch_ll_intr_* map done/scan/active to RTC_CNTL bits 6/4/7.
    const SENS = 0x60008800;
    const SCRATCH = ESP32S3_DRAM_BASE + 0xa40;
    const TOUCH_INTS = (1 << 4) | (1 << 6) | (1 << 7);
    const TOUCH_SCAN_PAD1 = ((0xf << 28) | (1 << 11) | (1 << 8) | 2) >>> 0;
    const TOUCH_CTRL2_START = ((4 << 17) | (1 << 16) | (1 << 15) | (1 << 14) | (3 << 6) | (3 << 2)) >>> 0;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, SENS, SCRATCH, TOUCH_INTS, TOUCH_SCAN_PAD1, TOUCH_CTRL2_START, 1, 0xff],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(4, 4), // a4 = SENS
        L32R(5, 2), // a5 = UART
        L32R(8, 5), // a8 = ISR counter scratch
        MOVI(6, 0),
        S32I(6, 8, 0),
        MOVI(6, 1),
        S32I(6, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(6, 2),
        WSR(6, SR.INTENABLE),
        L32R(6, 6),
        S32I(6, 2, 0x4c), // clear stale touch raw bits
        S32I(6, 2, 0x40), // enable touch done/scan/active raw bits
        L32R(6, 7),
        S32I(6, 2, 0x110), // TOUCH_SCAN_CTRL: scan pad 1
        L32R(6, 9),
        S32I(6, 4, 0x64), // TOUCH_THRES1: make pad 1 active
        RSIL(12, 0),
        L32R(6, 8),
        S32I(6, 2, 0x10c), // TOUCH_CTRL2.TOUCH_START_EN software trigger
        MOVI(9, 1),
        L32I(6, 8, 0),
        BNE(6, 9, BR(-2)),
        L32I(6, 4, 0x9c), // TOUCH_CHN_ST: MEAS_DONE + active mask
        SRLI(7, 6, 15),
        SRLI(7, 7, 15),
        SRLI(7, 7, 1),
        S32I(7, 5, 0), // tx 1: measure done
        L32I(6, 4, 0xa4), // TOUCH_STATUS1: pad 1 raw data
        SRLI(6, 6, 8),
        L32R(7, 10),
        AND(6, 6, 7),
        S32I(6, 5, 0), // tx 8: high byte of stable raw data 2048
        L32I(6, 2, 0x48),
        S32I(6, 5, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(10, 0),
        L32R(11, 5),
        L32I(12, 11, 0),
        ADDI(12, 12, 1),
        S32I(12, 11, 0), // scratch++ proves RTC_CORE dispatched
        L32I(12, 10, 0x48),
        S32I(12, 10, 0x4c), // clear touch raw bits that reached INT_ST
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 8, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('touch one-shot scans route timeout through RTC_CORE', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // touch_ll_set_timeout() writes TOUCH_TIMEOUT_CTRL.TIMEOUT_NUM and
    // TIMEOUT_EN; touch_ll_intr_* maps timeout to RTC_CNTL bit 18.
    const SENS = 0x60008800;
    const SCRATCH = ESP32S3_DRAM_BASE + 0xa50;
    const RTC_TOUCH_TIMEOUT_INT = 1 << 18;
    const TOUCH_SCAN_PAD1 = ((0xf << 28) | (1 << 11) | (1 << 8) | 2) >>> 0;
    const TOUCH_CTRL2_START = ((4 << 17) | (1 << 16) | (1 << 15) | (1 << 14) | (3 << 6) | (3 << 2)) >>> 0;
    const TOUCH_TIMEOUT_ONE_CYCLE = (1 << 22) | 1;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, SENS, SCRATCH, RTC_TOUCH_TIMEOUT_INT, TOUCH_SCAN_PAD1, TOUCH_CTRL2_START, TOUCH_TIMEOUT_ONE_CYCLE],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(4, 4), // a4 = SENS
        L32R(5, 2), // a5 = UART
        L32R(8, 5), // a8 = ISR counter scratch
        MOVI(6, 0),
        S32I(6, 8, 0),
        MOVI(6, 1),
        S32I(6, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(6, 2),
        WSR(6, SR.INTENABLE),
        L32R(6, 6),
        S32I(6, 2, 0x4c), // clear stale TOUCH_TIMEOUT raw
        S32I(6, 2, 0x40), // enable TOUCH_TIMEOUT raw
        L32R(6, 7),
        S32I(6, 2, 0x110), // TOUCH_SCAN_CTRL: scan pad 1
        L32R(6, 9),
        S32I(6, 2, 0x124), // TOUCH_TIMEOUT_CTRL: tiny nonzero budget
        RSIL(12, 0),
        L32R(6, 8),
        S32I(6, 2, 0x10c), // TOUCH_CTRL2.TOUCH_START_EN software trigger
        MOVI(9, 1),
        L32I(6, 8, 0),
        BNE(6, 9, BR(-2)),
        S32I(6, 5, 0), // tx 1: RTC_CORE dispatched
        L32I(6, 2, 0x48),
        S32I(6, 5, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(10, 0),
        L32R(11, 5),
        L32I(12, 11, 0),
        ADDI(12, 12, 1),
        S32I(12, 11, 0), // scratch++ proves RTC_CORE dispatched
        L32I(12, 10, 0x48),
        S32I(12, 10, 0x4c), // clear timeout raw that reached INT_ST
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('touch one-shot scans route proximity loop-done through RTC_CORE', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // touch_ll_set_proximity_sensing_channel() writes SENS_TOUCH_APPROACH_PAD0,
    // touch_ll_proximity_set_total_scan_times() writes TOUCH_APPROACH_MEAS_TIME,
    // and touch_ll_intr_* maps proximity-measure-done to RTC_CNTL bit 20.
    const SENS = 0x60008800;
    const SCRATCH = ESP32S3_DRAM_BASE + 0xa60;
    const RTC_TOUCH_PROX_DONE_INT = 1 << 20;
    const TOUCH_SCAN_PAD1 = ((0xf << 28) | (1 << 11) | (1 << 8) | 2) >>> 0;
    const TOUCH_CTRL2_START = ((4 << 17) | (1 << 16) | (1 << 15) | (1 << 14) | (3 << 6) | (3 << 2)) >>> 0;
    const TOUCH_CONF_PROX_PAD1 = ((1 << 28) | (0xf << 24) | (0xf << 20) | 0x7fff) >>> 0;
    const TOUCH_APPROACH_ONCE = 1 << 24;
    const BYTE_MASK = 0xff;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        RTCCNTL,
        INTMTX,
        UART,
        ESP32S3_IRAM_BASE,
        SENS,
        SCRATCH,
        RTC_TOUCH_PROX_DONE_INT,
        TOUCH_SCAN_PAD1,
        TOUCH_CTRL2_START,
        TOUCH_CONF_PROX_PAD1,
        TOUCH_APPROACH_ONCE,
        BYTE_MASK,
      ],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(4, 4), // a4 = SENS
        L32R(5, 2), // a5 = UART
        L32R(8, 5), // a8 = ISR counter scratch
        MOVI(6, 0),
        S32I(6, 8, 0),
        MOVI(6, 1),
        S32I(6, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(6, 2),
        WSR(6, SR.INTENABLE),
        L32R(6, 6),
        S32I(6, 2, 0x4c), // clear stale TOUCH_APPROACH_LOOP_DONE raw
        S32I(6, 2, 0x40), // enable TOUCH_APPROACH_LOOP_DONE raw
        L32R(6, 9),
        S32I(6, 4, 0x5c), // SENS_TOUCH_APPROACH_PAD0 = pad 1
        L32R(6, 10),
        S32I(6, 2, 0x118), // TOUCH_APPROACH_MEAS_TIME = 1
        L32R(6, 7),
        S32I(6, 2, 0x110), // TOUCH_SCAN_CTRL: scan pad 1
        RSIL(12, 0),
        L32R(6, 8),
        S32I(6, 2, 0x10c), // TOUCH_CTRL2.TOUCH_START_EN software trigger
        MOVI(9, 1),
        L32I(6, 8, 0),
        BNE(6, 9, BR(-2)),
        S32I(6, 5, 0), // tx 1: RTC_CORE dispatched
        L32I(6, 4, 0xe0), // SENS_SAR_TOUCH_APPR_STATUS
        SRLI(6, 6, 15),
        SRLI(6, 6, 1),
        L32R(7, 11),
        AND(6, 6, 7),
        S32I(6, 5, 0), // tx 1: approach pad0 count
        L32I(6, 2, 0x48),
        S32I(6, 5, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(10, 0),
        L32R(11, 5),
        L32I(12, 11, 0),
        ADDI(12, 12, 1),
        S32I(12, 11, 0), // scratch++ proves RTC_CORE dispatched
        L32I(12, 10, 0x48),
        S32I(12, 10, 0x4c), // clear proximity-loop raw that reached INT_ST
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('touch sleep status exposes benchmark, smooth, and debounce for the configured sleep pad', () => {
    // ESP-IDF v5.5.4 touch_ll_sleep_read_benchmark/smooth() reads
    // SENS_SAR_TOUCH_SLP_STATUS.TOUCH_SLP_DATA after selecting the
    // configured RTCCNTL.touch_slp_thres.touch_slp_pad, and
    // touch_ll_sleep_read_debounce() reads TOUCH_SLP_DEBOUNCE there.
    const SENS = 0x60008800;
    const TOUCH_SCAN_PAD1 = ((0xf << 28) | (1 << 11) | (1 << 8) | 2) >>> 0;
    const TOUCH_CTRL2_START = ((4 << 17) | (1 << 16) | (1 << 15) | (1 << 14) | (3 << 6) | (3 << 2)) >>> 0;
    const TOUCH_CONF_ALL_OUT = 0x7fff;
    const TOUCH_DATA_SEL_BENCHMARK = 2 << 16;
    const TOUCH_DATA_SEL_SMOOTH = 3 << 16;
    const TOUCH_CONF_BENCHMARK_ALL_OUT = TOUCH_CONF_ALL_OUT | TOUCH_DATA_SEL_BENCHMARK;
    const TOUCH_CONF_SMOOTH_ALL_OUT = TOUCH_CONF_ALL_OUT | TOUCH_DATA_SEL_SMOOTH;
    const TOUCH_SLEEP_PAD1 = 1 << 27;
    const BYTE_MASK = 0xff;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        RTCCNTL,
        SENS,
        UART,
        TOUCH_SCAN_PAD1,
        TOUCH_CTRL2_START,
        TOUCH_CONF_BENCHMARK_ALL_OUT,
        TOUCH_SLEEP_PAD1,
        BYTE_MASK,
        TOUCH_CONF_SMOOTH_ALL_OUT,
      ],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = SENS
        L32R(4, 2), // a4 = UART
        L32R(5, 5),
        S32I(5, 3, 0x5c), // SENS_TOUCH_CONF: enable touch outputs
        L32R(5, 6),
        S32I(5, 2, 0x114), // TOUCH_SLP_THRES: sleep pad 1
        L32R(5, 3),
        S32I(5, 2, 0x110), // TOUCH_SCAN_CTRL: scan pad 1
        L32I(6, 3, 0xdc), // SENS_SAR_TOUCH_SLP_STATUS before scan
        SRLI(6, 6, 8),
        L32R(7, 7),
        AND(6, 6, 7),
        S32I(6, 4, 0), // tx 0: no sleep-pad data yet
        L32R(5, 4),
        S32I(5, 2, 0x10c), // TOUCH_START_EN pulse
        L32I(6, 3, 0xdc),
        SRLI(6, 6, 8),
        L32R(7, 7),
        AND(6, 6, 7),
        S32I(6, 4, 0), // tx 8: 2048 >> 8
        L32R(5, 8),
        S32I(5, 3, 0x5c), // switch TOUCH_DATA_SEL to smooth
        L32I(6, 3, 0xdc),
        SRLI(6, 6, 8),
        L32R(7, 7),
        AND(6, 6, 7),
        S32I(6, 4, 0), // tx 8: smooth follows modeled data too
        L32I(6, 3, 0xdc),
        SRLI(6, 6, 14),
        SRLI(6, 6, 15),
        L32R(7, 7),
        AND(6, 6, 7),
        S32I(6, 4, 0), // tx 1: one measured sample contributes debounce
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([0, 8, 8, 1]);
  });

  it('touch sleep raw data uses the per-pad status register, not SLP_STATUS', () => {
    // ESP-IDF v5.5.4 touch_ll_sleep_read_data() documents this
    // workaround: sleep-pad raw data is not in sar_touch_slp_status,
    // so raw reads use SENS.sar_touch_status[touch_num - 1].
    const SENS = 0x60008800;
    const TOUCH_SCAN_PAD1 = ((0xf << 28) | (1 << 11) | (1 << 8) | 2) >>> 0;
    const TOUCH_CTRL2_START = ((4 << 17) | (1 << 16) | (1 << 15) | (1 << 14) | (3 << 6) | (3 << 2)) >>> 0;
    const TOUCH_CONF_RAW_ALL_OUT = 0x7fff;
    const TOUCH_SLEEP_PAD1 = 1 << 27;
    const BYTE_MASK = 0xff;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, SENS, UART, TOUCH_SCAN_PAD1, TOUCH_CTRL2_START, TOUCH_CONF_RAW_ALL_OUT, TOUCH_SLEEP_PAD1, BYTE_MASK],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = SENS
        L32R(4, 2), // a4 = UART
        L32R(5, 5),
        S32I(5, 3, 0x5c), // SENS_TOUCH_CONF: outputs on, TOUCH_DATA_SEL_RAW
        L32R(5, 6),
        S32I(5, 2, 0x114), // TOUCH_SLP_THRES: sleep pad 1
        L32R(5, 3),
        S32I(5, 2, 0x110), // TOUCH_SCAN_CTRL: scan pad 1
        L32R(5, 4),
        S32I(5, 2, 0x10c), // TOUCH_START_EN pulse

        L32I(6, 3, 0xdc), // SENS_SAR_TOUCH_SLP_STATUS: raw mode does not expose data
        SRLI(6, 6, 8),
        L32R(7, 7),
        AND(6, 6, 7),
        S32I(6, 4, 0), // tx 0: SLP_STATUS raw path is intentionally empty

        L32I(6, 3, 0xa4), // SENS.sar_touch_status[0]: raw data for pad 1
        SRLI(6, 6, 8),
        L32R(7, 7),
        AND(6, 6, 7),
        S32I(6, 4, 0), // tx 8: 2048 >> 8 through the documented workaround
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([0, 8]);
  });

  it('touch sleep proximity count is exposed in APPR_STATUS and gates loop-done', () => {
    // Source-checked against ESP-IDF v5.5.4 ESP32-S3 headers:
    // touch_ll_sleep_enable_proximity_sensing() writes
    // RTCCNTL.touch_slp_thres.touch_slp_approach_en,
    // touch_ll_sleep_set_channel_num() writes touch_slp_pad, and
    // touch_ll_sleep_read_proximity_cnt() reads
    // SENS.sar_touch_appr_status.touch_slp_approach_cnt.
    const SENS = 0x60008800;
    const RTC_TOUCH_PROX_DONE_INT = 1 << 20;
    const TOUCH_SCAN_PAD1 = ((0xf << 28) | (1 << 11) | (1 << 8) | 2) >>> 0;
    const TOUCH_CTRL2_START = ((4 << 17) | (1 << 16) | (1 << 15) | (1 << 14) | (3 << 6) | (3 << 2)) >>> 0;
    const TOUCH_CONF_ALL_OUT = 0x7fff;
    const TOUCH_SLEEP_PAD1_PROX = ((1 << 27) | (1 << 26)) >>> 0;
    const TOUCH_APPROACH_TWICE = 2 << 24;
    const BYTE_MASK = 0xff;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        RTCCNTL,
        SENS,
        UART,
        TOUCH_SCAN_PAD1,
        TOUCH_CTRL2_START,
        TOUCH_CONF_ALL_OUT,
        TOUCH_SLEEP_PAD1_PROX,
        TOUCH_APPROACH_TWICE,
        BYTE_MASK,
        RTC_TOUCH_PROX_DONE_INT,
      ],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = SENS
        L32R(4, 2), // a4 = UART
        L32R(5, 5),
        S32I(5, 3, 0x5c), // SENS_TOUCH_CONF: enable touch outputs
        L32R(5, 6),
        S32I(5, 2, 0x114), // TOUCH_SLP_THRES: sleep pad 1 + approach enable
        L32R(5, 7),
        S32I(5, 2, 0x118), // TOUCH_APPROACH_MEAS_TIME = 2
        L32R(5, 3),
        S32I(5, 2, 0x110), // TOUCH_SCAN_CTRL: scan pad 1

        L32R(5, 4),
        S32I(5, 2, 0x10c), // first TOUCH_START_EN pulse
        L32I(6, 3, 0xe0), // SENS_SAR_TOUCH_APPR_STATUS
        SRLI(6, 6, 12),
        SRLI(6, 6, 12),
        L32R(7, 8),
        AND(6, 6, 7),
        S32I(6, 4, 0), // tx 1: sleep approach count after first scan
        L32I(6, 2, 0x44), // RTC_INT_RAW
        L32R(7, 9),
        AND(6, 6, 7),
        MOVI(7, 0),
        BEQZ(6, BR(1)),
        MOVI(7, 1),
        S32I(7, 4, 0), // tx 0: loop-done still below total

        MOVI(5, 0),
        S32I(5, 2, 0x10c), // clear START_EN so the second write has an edge
        L32R(5, 4),
        S32I(5, 2, 0x10c), // second TOUCH_START_EN pulse
        L32I(6, 3, 0xe0),
        SRLI(6, 6, 12),
        SRLI(6, 6, 12),
        L32R(7, 8),
        AND(6, 6, 7),
        S32I(6, 4, 0), // tx 2: sleep approach count after second scan
        L32I(6, 2, 0x44),
        L32R(7, 9),
        AND(6, 6, 7),
        MOVI(7, 0),
        BEQZ(6, BR(1)),
        MOVI(7, 1),
        S32I(7, 4, 0), // tx 1: loop-done reached total
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0, 2, 1]);
  });

  it('touch one-shot scans wake RTC sleep with the touch wake source recorded', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // soc/rtc.h defines RTC_TOUCH_TRIG_EN as BIT(8), and sleep_modes
    // documents touchpad wake as a touch interrupt configured before
    // sleep. The modeled touch one-shot is the interrupt producer here.
    const SENS = 0x60008800;
    const TOUCH_INTS = (1 << 4) | (1 << 6) | (1 << 7);
    const RTC_SLP_WAKEUP_INT = 1;
    const RTC_TOUCH_TRIG_EN = 1 << 8;
    const rtcIntMask = TOUCH_INTS | RTC_SLP_WAKEUP_INT;
    const wakeupTouch = RTC_TOUCH_TRIG_EN << 15;
    const sleepEn = 0x80000000;
    const TOUCH_SCAN_PAD1 = ((0xf << 28) | (1 << 11) | (1 << 8) | 2) >>> 0;
    const TOUCH_CTRL2_START = ((4 << 17) | (1 << 16) | (1 << 15) | (1 << 14) | (3 << 6) | (3 << 2)) >>> 0;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, SENS, rtcIntMask, wakeupTouch, sleepEn, TOUCH_SCAN_PAD1, TOUCH_CTRL2_START, 1],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(4, 4), // a4 = SENS
        MOVI(5, 1),
        S32I(5, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(5, 2),
        WSR(5, SR.INTENABLE),
        L32R(5, 5),
        S32I(5, 2, 0x4c), // clear stale touch/SLP_WAKEUP raw bits
        S32I(5, 2, 0x40), // enable touch and SLP_WAKEUP raw bits
        L32R(5, 6),
        S32I(5, 2, 0x3c), // WAKEUP_STATE touch wake source
        L32R(5, 8),
        S32I(5, 2, 0x110), // TOUCH_SCAN_CTRL: scan pad 1
        L32R(5, 10),
        S32I(5, 4, 0x64), // TOUCH_THRES1: make pad 1 active
        L32R(5, 7),
        S32I(5, 2, 0x18), // STATE0.SLEEP_EN
        RSIL(12, 12), // hold the pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(5, 9),
        S32I(5, 2, 0x10c), // TOUCH_CTRL2.TOUCH_START_EN while asleep
        WAITI(0),
        L32I(5, 2, 0x130), // SLP_WAKEUP_CAUSE
        SRLI(5, 5, 8),
        L32R(6, 2),
        S32I(5, 6, 0), // tx 1: TOUCH_TRIG_EN recorded
        L32I(5, 2, 0x48),
        S32I(5, 6, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 5),
        S32I(3, 2, 0x4c), // clear touch/SLP_WAKEUP raw bits
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('touch sleep timer wakes RTC sleep after the programmed interval', () => {
    // Context7 + ESP-IDF v5.5.4 sources: touch wake is a touch interrupt
    // sleep source, and touch_ll_start_fsm_repeated_timer() arms
    // RTCCNTL.touch_ctrl2.touch_slp_timer_en for timer-triggered scans.
    // RTC_CNTL_TOUCH_CTRL1.TOUCH_SLEEP_CYCLES sets the RTC slow-clock
    // interval between repeated timer measurements.
    const SENS = 0x60008800;
    const TOUCH_INTS = (1 << 4) | (1 << 6) | (1 << 7);
    const RTC_SLP_WAKEUP_INT = 1;
    const RTC_TOUCH_TRIG_EN = 1 << 8;
    const rtcIntMask = TOUCH_INTS | RTC_SLP_WAKEUP_INT;
    const wakeupTouch = RTC_TOUCH_TRIG_EN << 15;
    const sleepEn = 0x80000000;
    const TOUCH_SCAN_PAD1 = ((0xf << 28) | (1 << 11) | (1 << 8) | 2) >>> 0;
    const TOUCH_CTRL2_TIMER = ((4 << 17) | (1 << 16) | (1 << 14) | (1 << 13) | (3 << 6) | (3 << 2)) >>> 0;
    const TOUCH_CONF_ALL_OUT = 0x7fff;
    const TOUCH_SLEEP_PAD1 = 1 << 27;
    const TOUCH_SLP_CHANNEL_CLR = 1 << 23;
    const TOUCH_CTRL1_SLEEP_4 = ((0x1000 << 16) | 4) >>> 0;
    const BYTE_MASK = 0xff;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [
        RTCCNTL,
        INTMTX,
        UART,
        ESP32S3_IRAM_BASE,
        SENS,
        rtcIntMask,
        wakeupTouch,
        sleepEn,
        TOUCH_SCAN_PAD1,
        TOUCH_CTRL2_TIMER,
        TOUCH_CONF_ALL_OUT,
        TOUCH_SLEEP_PAD1,
        TOUCH_SLP_CHANNEL_CLR,
        BYTE_MASK,
        TOUCH_CTRL1_SLEEP_4,
      ],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        L32R(4, 4), // a4 = SENS
        L32R(6, 2), // a6 = UART
        MOVI(5, 1),
        S32I(5, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(5, 3),
        WSR(5, SR.VECBASE),
        MOVI(5, 2),
        WSR(5, SR.INTENABLE),
        L32R(5, 5),
        S32I(5, 2, 0x4c), // clear stale touch/SLP_WAKEUP raw bits
        S32I(5, 2, 0x40), // enable touch and SLP_WAKEUP raw bits
        L32R(5, 10),
        S32I(5, 4, 0x5c), // SENS_TOUCH_CONF: enable touch outputs
        L32R(5, 11),
        S32I(5, 2, 0x114), // TOUCH_SLP_THRES: sleep pad 1
        L32R(5, 8),
        S32I(5, 2, 0x110), // TOUCH_SCAN_CTRL: scan pad 1
        L32R(5, 14),
        S32I(5, 2, 0x108), // TOUCH_CTRL1: 4 RTC slow-clock sleep cycles between scans
        L32R(5, 9),
        S32I(5, 2, 0x10c), // arm repeated touch sleep timer before sleep
        L32R(5, 12),
        S32I(5, 2, 0x118), // clear the pre-sleep timer-start sample
        L32R(5, 5),
        S32I(5, 2, 0x4c), // clear raw bits from the pre-sleep timer-start sample
        L32R(5, 6),
        S32I(5, 2, 0x3c), // WAKEUP_STATE touch wake source
        RSIL(12, 12), // hold the pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(5, 7),
        S32I(5, 2, 0x18), // STATE0.SLEEP_EN; armed touch timer produces wake scan
        WAITI(0),
        L32I(5, 2, 0x130), // SLP_WAKEUP_CAUSE
        SRLI(5, 5, 8),
        S32I(5, 6, 0), // tx 1: TOUCH_TRIG_EN recorded
        L32I(5, 4, 0xa4), // SENS_SAR_TOUCH_STATUS1: fresh sleep-timer sample
        SRLI(5, 5, 8),
        L32R(7, 13),
        AND(5, 5, 7),
        S32I(5, 6, 0), // tx 8: 2048 >> 8
        L32I(5, 4, 0xa4),
        SRLI(5, 5, 14),
        SRLI(5, 5, 15),
        L32R(7, 13),
        AND(5, 5, 7),
        S32I(5, 6, 0), // tx 1: one sleep-entry sample contributes debounce
        L32I(5, 2, 0x48),
        S32I(5, 6, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 5),
        S32I(3, 2, 0x4c), // clear touch/SLP_WAKEUP raw bits
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([]);
    c.step(20_000);
    expect([...c.drainUart()]).toEqual([1, 8, 1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('ULP control force-start and clock-force bits read back while mem-offset clear is write-only', () => {
    // Source-checked against ESP-IDF release/v5.5 rtc_cntl_reg.h:
    // FORCE_START_TOP and CLK_FO are R/W, while MEM_OFFST_CLR is WO.
    const ulpForceStart = 1 << 30;
    const ulpClockForce = 1 << 28;
    const memOffsetClear = 1 << 22;
    const ctrlValue = ulpForceStart | ulpClockForce | memOffsetClear;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, UART, ctrlValue, 7, 1],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 2),
        S32I(3, 2, 0x100), // ULP_CP_CTRL: FORCE_START_TOP | CLK_FO | WO MEM_OFFST_CLR
        L32I(4, 2, 0x100),
        SRAI(5, 4, 28),
        L32R(6, 3),
        AND(5, 5, 6),
        L32R(7, 1),
        S32I(5, 7, 0), // tx 5: FORCE_START_TOP and CLK_FO read back
        SRAI(5, 4, 22),
        L32R(6, 4),
        AND(5, 5, 6),
        S32I(5, 7, 0), // tx 0: MEM_OFFST_CLR is write-only
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(500);
    expect([...c.drainUart()]).toEqual([5, 0]);
  });

  it('ULP force-start wakes RTC sleep with the ULP wake source recorded', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // esp_sleep_enable_ulp_wakeup() arms the ULP wake source, soc/rtc.h
    // defines RTC_ULP_TRIG_EN as BIT(9), and rtc_cntl_reg.h exposes
    // ULP_CP_CTRL.FORCE_START_TOP plus RTC_CNTL_ULP_CP_INT at bit 5.
    const RTC_ULP_CP_INT = 1 << 5;
    const RTC_SLP_WAKEUP_INT = 1;
    const RTC_ULP_TRIG_EN = 1 << 9;
    const rtcIntMask = RTC_ULP_CP_INT | RTC_SLP_WAKEUP_INT;
    const wakeupUlp = RTC_ULP_TRIG_EN << 15;
    const sleepEn = 0x80000000;
    const ulpForceStart = 1 << 30;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, rtcIntMask, wakeupUlp, sleepEn, ulpForceStart],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(5, 1),
        S32I(5, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(5, 2),
        WSR(5, SR.INTENABLE),
        L32R(5, 4),
        S32I(5, 2, 0x4c), // clear stale ULP/SLP_WAKEUP raw bits
        S32I(5, 2, 0x40), // enable ULP and SLP_WAKEUP raw bits
        L32R(5, 5),
        S32I(5, 2, 0x3c), // WAKEUP_STATE ULP wake source
        L32R(5, 6),
        S32I(5, 2, 0x18), // STATE0.SLEEP_EN
        RSIL(12, 12), // hold the pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32R(5, 7),
        S32I(5, 2, 0x100), // ULP_CP_CTRL.FORCE_START_TOP synthetic WAKE
        WAITI(0),
        L32I(5, 2, 0x130), // SLP_WAKEUP_CAUSE
        SRLI(5, 5, 9),
        L32R(6, 2),
        S32I(5, 6, 0), // tx 1: ULP_TRIG_EN recorded
        L32I(5, 2, 0x48),
        S32I(5, 6, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear ULP/SLP_WAKEUP raw bits
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('ULP wake-main software pulse wakes RTC sleep with the ULP wake source recorded', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // ulp_riscv_wakeup_main_processor() sets RTC_CNTL_STATE0.SW_CPU_INT,
    // and ULP RISC-V examples use that helper before the main app sees
    // ESP_SLEEP_WAKEUP_ULP. SET_PERI_REG_MASK performs a read/modify/write,
    // so this test preserves STATE0.SLEEP_EN while pulsing SW_CPU_INT.
    const RTC_ULP_CP_INT = 1 << 5;
    const RTC_SLP_WAKEUP_INT = 1;
    const RTC_ULP_TRIG_EN = 1 << 9;
    const rtcIntMask = RTC_ULP_CP_INT | RTC_SLP_WAKEUP_INT;
    const wakeupUlp = RTC_ULP_TRIG_EN << 15;
    const sleepEn = 0x80000000;
    const swCpuInt = 1;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, rtcIntMask, wakeupUlp, sleepEn, swCpuInt],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(5, 1),
        S32I(5, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(5, 2),
        WSR(5, SR.INTENABLE),
        L32R(5, 4),
        S32I(5, 2, 0x4c), // clear stale ULP/SLP_WAKEUP raw bits
        S32I(5, 2, 0x40), // enable ULP and SLP_WAKEUP raw bits
        L32R(5, 5),
        S32I(5, 2, 0x3c), // WAKEUP_STATE ULP wake source
        L32R(5, 6),
        S32I(5, 2, 0x18), // STATE0.SLEEP_EN
        RSIL(12, 12), // hold the pending RTC_CORE interrupt until WAITI lowers INTLEVEL
        L32I(5, 2, 0x18),
        L32R(7, 7),
        OR(5, 5, 7),
        S32I(5, 2, 0x18), // SET_PERI_REG_MASK(STATE0, SW_CPU_INT)
        WAITI(0),
        L32I(5, 2, 0x130), // SLP_WAKEUP_CAUSE
        SRLI(5, 5, 9),
        L32R(6, 2),
        S32I(5, 6, 0), // tx 1: ULP_TRIG_EN recorded
        L32I(5, 2, 0x48),
        S32I(5, 6, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear ULP/SLP_WAKEUP raw bits
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('ULP sleep timer wakes RTC sleep with the ULP wake source recorded', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // ulp_run() sets RTC_CNTL_ULP_CP_TIMER.ULP_CP_SLP_TIMER_EN, and
    // ulp_set_wakeup_period() writes RTC_CNTL_ULP_CP_TIMER_1
    // ULP_CP_TIMER_SLP_CYCLE [31:8]. The timer-triggered ULP run is the
    // synthetic WAKE producer until real ULP instruction execution lands.
    const RTC_ULP_CP_INT = 1 << 5;
    const RTC_SLP_WAKEUP_INT = 1;
    const RTC_ULP_TRIG_EN = 1 << 9;
    const rtcIntMask = RTC_ULP_CP_INT | RTC_SLP_WAKEUP_INT;
    const wakeupUlp = RTC_ULP_TRIG_EN << 15;
    const sleepEn = 0x80000000;
    const ulpPeriodOneSlowTick = 1 << 8;
    const ulpTimerEnable = 1 << 31;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, INTMTX, UART, ESP32S3_IRAM_BASE, rtcIntMask, wakeupUlp, sleepEn, ulpPeriodOneSlowTick, ulpTimerEnable],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = interrupt matrix
        MOVI(5, 1),
        S32I(5, 3, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 3),
        WSR(6, SR.VECBASE),
        MOVI(5, 2),
        WSR(5, SR.INTENABLE),
        L32R(5, 4),
        S32I(5, 2, 0x4c), // clear stale ULP/SLP_WAKEUP raw bits
        S32I(5, 2, 0x40), // enable ULP and SLP_WAKEUP raw bits
        L32R(5, 5),
        S32I(5, 2, 0x3c), // WAKEUP_STATE ULP wake source
        L32R(5, 7),
        S32I(5, 2, 0x134), // ULP_CP_TIMER_1.SLP_CYCLE = 1 RTC slow tick
        L32R(5, 6),
        S32I(5, 2, 0x18), // STATE0.SLEEP_EN
        L32R(5, 8),
        S32I(5, 2, 0xfc), // ULP_CP_TIMER.ULP_CP_SLP_TIMER_EN
        WAITI(0),
        L32I(5, 2, 0x130), // SLP_WAKEUP_CAUSE
        SRLI(5, 5, 9),
        L32R(6, 2),
        S32I(5, 6, 0), // tx 1: ULP_TRIG_EN recorded
        L32I(5, 2, 0x48),
        S32I(5, 6, 0), // tx 0: RTC INT_ST clear after ISR
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 4),
        S32I(3, 2, 0x4c), // clear ULP/SLP_WAKEUP raw bits
        MOVI(3, 0),
        S32I(3, 2, 0xfc), // ulp_timer_stop(): clear ULP_CP_SLP_TIMER_EN
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(6_000);
    expect([...c.drainUart()]).toEqual([1, 0]);
    c.step(3_000);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('ULP GPIO wake clear is a write-only pulse while enable reads back', () => {
    // Source-checked against ESP-IDF release/v5.5: RTC_CNTL_ULP_CP_TIMER
    // marks GPIO_WAKEUP_CLR as WO, while GPIO_WAKEUP_ENA and PC_INIT are R/W.
    const gpioWakeClear = 1 << 30;
    const gpioWakeEnable = 1 << 29;
    const pcInit = 0x55;
    const timerValue = gpioWakeClear | gpioWakeEnable | pcInit;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, UART, timerValue, 3],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 2),
        S32I(3, 2, 0xfc), // ULP_CP_TIMER: write ENA plus WO CLR pulse
        L32I(4, 2, 0xfc),
        SRAI(5, 4, 29),
        L32R(6, 3),
        AND(5, 5, 6),
        L32R(7, 1),
        S32I(5, 7, 0), // tx 1: bit29 set and bit30 clear after readback
        S32I(4, 7, 0), // tx 0x55: PC_INIT low bits preserved
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.step(500);
    expect([...c.drainUart()]).toEqual([1, pcInit]);
  });

  it('a read of an unmodeled RTC_CNTL register halts with a diagnostic naming it', () => {
    // 0x60008090 is RTC_CNTL_WDTCONFIG0_REG territory — reading 0 there
    // would silently claim "watchdog off", so the core refuses instead.
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [0x60008090], [
      L32R(2, 0),
      L32I(4, 2, 0),
      J_TO(2),
    ]);
    const c = core(image);
    expect(() => c.step(50)).toThrow(/0x60008090/);
    expect(() => c.step(50)).toThrow(/RESET_STATE/); // lists what IS modeled
  });

  it('unmodeled eFuse/SYSTEM reads refuse, and direct eFuse readback writes refuse', () => {
    const rd = (addr: number): Esp32s3Core =>
      core(assembleXtensa(ESP32S3_IRAM_BASE, [addr], [L32R(2, 0), L32I(4, 2, 0), J_TO(2)]));
    expect(() => rd(0x60007194).step(50)).toThrow(/0x60007194/); // gap after RD_REPEAT_ERR4
    expect(() => rd(0x600c0018).step(50)).toThrow(/0x600c0018/); // SYSTEM_PERIP_CLK_EN0
    const wr = core(assembleXtensa(ESP32S3_IRAM_BASE, [EFUSE_MAC0], [L32R(2, 0), S32I(2, 2, 0), J_TO(2)]));
    expect(() => wr.step(50)).toThrow(/read-only.*PGM_DATA/);
  });
});

describe('Esp32s3Core — second core (slice 12)', () => {
  // REAL register addresses/bits, pinned independently of the
  // implementation, from esp-idf v5.2:
  //   system_reg.h    — SYSTEM_CORE_1_CONTROL_0_REG = SYSTEM_BASE+0x0
  //                     (RUNSTALL bit 0, CLKGATE_EN bit 1, RESETING
  //                     bit 2 — default 1), CONTROL_1 +0x4 (MESSAGE)
  //   rtc_cntl_reg.h  — OPTIONS0 SW_STALL_APPCPU_C0 [1:0],
  //                     SW_CPU_STALL_REG +0xBC, APPCPU_C1 [25:20]
  //   esp32s3.rom.ld  — ets_set_appcpu_boot_addr = 0x40000720
  //   cpu_start.c     — start_other_core: unstall → CLKGATE_EN set,
  //                     RUNSTALL clear, RESETING pulse → boot addr.
  const SYS = 0x600c0000;
  const RTC = 0x60008000;
  const SET_BOOT = 0x40000720;
  const CORE1_ENTRY = ESP32S3_IRAM_BASE + 0x400;
  const INTMTX_CORE1 = 0x600c2800;

  it('core 1 is held in reset at power-on — boot address alone starts nothing', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [SET_BOOT, CORE1_ENTRY, GPIO, 1 << 7], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(8, 0),
      L32R(10, 1),
      CALLXN(2, 8), // ets_set_appcpu_boot_addr(CORE1_ENTRY) — but RESETING is still 1
      J_TO(5),
      PAD_TO(0x400),
      // core 1 (never released): would toggle IO7 forever
      L32R(2, 2),
      L32R(3, 3),
      S32I(3, 2, 0x24), // ENABLE_W1TS
      S32I(3, 2, 0x08),
      S32I(3, 2, 0x0c),
      J_TO(10),
    ]);
    const c = core(image);
    const { events } = c.step(2_000);
    expect(events.filter((e) => e.pin === 'IO7')).toEqual([]);
  });

  it("IDF's release sequence (unstall → clkgate/runstall/reset pulse → boot addr) starts core 1", () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTC, SYS, SET_BOOT, CORE1_ENTRY, GPIO, 1 << 7, UART],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        // esp_cpu_unstall(1): clear the split 0x86 stall code.
        L32R(4, 0),
        MOVI(5, 0),
        S32I(5, 4, 0), // OPTIONS0 ← 0 (SW_STALL_APPCPU_C0 [1:0] clear)
        S32I(5, 4, 0xbc), // SW_CPU_STALL ← 0 (APPCPU_C1 [25:20] clear)
        // start_other_core's SYSTEM dance:
        L32R(4, 1),
        L32I(6, 4, 0), // read CONTROL_0 — RESETING (bit 2) set at power-on
        L32R(9, 6),
        S32I(6, 9, 0), // tx 0x04
        MOVI(7, 6),
        S32I(7, 4, 0), // CLKGATE_EN | RESETING
        MOVI(7, 2),
        S32I(7, 4, 0), // clear RESETING — core 1 released, parked in ROM
        L32R(8, 2),
        L32R(10, 3),
        CALLXN(2, 8), // ets_set_appcpu_boot_addr(CORE1_ENTRY) → core 1 starts
        J_TO(17),
        PAD_TO(0x400),
        // core 1: toggle IO7 forever (core 0 never touches IO7)
        L32R(2, 4),
        L32R(3, 5),
        S32I(3, 2, 0x24),
        S32I(3, 2, 0x08),
        S32I(3, 2, 0x0c),
        J_TO(22),
      ],
    );
    const c = core(image);
    const { events } = c.step(2_000);
    expect([...c.drainUart()]).toEqual([0x04]); // power-on CONTROL_0 = RESETING
    const io7 = events.filter((e) => e.pin === 'IO7');
    expect(io7.length).toBeGreaterThan(3);
    expect(io7[0]?.level).toBe(1); // W1TS first, strict alternation after
    for (let i = 1; i < io7.length; i++) expect(io7[i]?.level).toBe(1 - (io7[i - 1]?.level ?? 0));
  });

  it('both cores run interleaved — two GPIOs toggle with overlapping cycle stamps', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SYS, SET_BOOT, CORE1_ENTRY, GPIO, 1 << 5, 1 << 7],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(4, 0),
        MOVI(7, 6),
        S32I(7, 4, 0),
        MOVI(7, 2),
        S32I(7, 4, 0),
        L32R(8, 1),
        L32R(10, 2),
        CALLXN(2, 8),
        // core 0: toggle IO5 forever
        L32R(2, 3),
        L32R(3, 4),
        S32I(3, 2, 0x24),
        S32I(3, 2, 0x08),
        S32I(3, 2, 0x0c),
        J_TO(13),
        PAD_TO(0x400),
        // core 1: toggle IO7 forever
        L32R(2, 3),
        L32R(3, 5),
        S32I(3, 2, 0x24),
        S32I(3, 2, 0x08),
        S32I(3, 2, 0x0c),
        J_TO(20),
      ],
    );
    const c = core(image);
    const { events } = c.step(2_000);
    const io5 = events.filter((e) => e.pin === 'IO5');
    const io7 = events.filter((e) => e.pin === 'IO7');
    expect(io5.length).toBeGreaterThan(3);
    expect(io7.length).toBeGreaterThan(3);
    const firstIo5 = io5[0];
    const lastIo5 = io5.at(-1);
    const firstIo7 = io7[0];
    const lastIo7 = io7.at(-1);
    if (firstIo5 === undefined || lastIo5 === undefined || firstIo7 === undefined || lastIo7 === undefined) {
      throw new Error('expected both cores to emit GPIO events');
    }
    // Interleaved, not sequential: each stream starts before the other ends.
    expect(firstIo7.cycle).toBeLessThan(lastIo5.cycle);
    expect(firstIo5.cycle).toBeLessThan(lastIo7.cycle);
  });

  it("per-core CCOMPARE0 interrupts don't cross-fire (separate VECBASE/INTENABLE/CCOUNT)", () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SYS, SET_BOOT, CORE1_ENTRY, GPIO, 1 << 5, 1 << 7, ESP32S3_IRAM_BASE, CORE1_ENTRY],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(4, 0),
        MOVI(7, 6),
        S32I(7, 4, 0),
        MOVI(7, 2),
        S32I(7, 4, 0),
        L32R(8, 1),
        L32R(10, 2),
        CALLXN(2, 8),
        // core 0: arm its core timer ~256 cycles out; ISR raises IO5.
        L32R(2, 3),
        L32R(3, 4),
        S32I(3, 2, 0x24), // enable IO5 (drives 0)
        L32R(5, 6),
        WSR(5, SR.VECBASE),
        MOVI(6, 64),
        WSR(6, SR.INTENABLE),
        RSR(7, SR.CCOUNT),
        ADDMI(7, 7, 256),
        WSR(7, SR.CCOMPARE0),
        RSIL(8, 0),
        J_TO(21),
        PAD_TO(0x340), // core 0's level-1 vector
        L32R(2, 3),
        L32R(3, 4),
        S32I(3, 2, 0x08), // IO5 ← 1, exactly once
        RSR(4, SR.CCOMPARE0),
        ADDMI(4, 4, 32512), // re-arm far past the test horizon
        WSR(4, SR.CCOMPARE0),
        RFE(),
        PAD_TO(0x400),
        // core 1: same shape, ~512 cycles out on ITS OWN CCOUNT; ISR raises IO7.
        L32R(2, 3),
        L32R(3, 5),
        S32I(3, 2, 0x24),
        L32R(5, 7),
        WSR(5, SR.VECBASE),
        MOVI(6, 64),
        WSR(6, SR.INTENABLE),
        RSR(7, SR.CCOUNT),
        ADDMI(7, 7, 512),
        WSR(7, SR.CCOMPARE0),
        RSIL(8, 0),
        J_TO(41),
        PAD_TO(0x740), // core 1's vector: VECBASE(0x400) + 0x340
        L32R(2, 3),
        L32R(3, 5),
        S32I(3, 2, 0x08),
        RSR(4, SR.CCOMPARE0),
        ADDMI(4, 4, 32512),
        WSR(4, SR.CCOMPARE0),
        RFE(),
      ],
    );
    const c = core(image);
    const { events } = c.step(1_500);
    const io5 = events.filter((e) => e.pin === 'IO5');
    const io7 = events.filter((e) => e.pin === 'IO7');
    // Each timer fires exactly once, on its own core, on its own schedule.
    expect(io5.map((e) => e.level)).toEqual([1]);
    expect(io7.map((e) => e.level)).toEqual([1]);
    const [io5Timer] = io5;
    const [io7Timer] = io7;
    if (io5Timer === undefined || io7Timer === undefined) throw new Error('expected one timer event per core');
    expect(io7Timer.cycle - io5Timer.cycle).toBeGreaterThan(150);
  });

  it('routes UART0 peripheral interrupts to APP CPU through core-1 matrix maps', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SYS, SET_BOOT, CORE1_ENTRY, UART, INTMTX_CORE1],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        // Release core 1 and point the ROM park loop at CORE1_ENTRY.
        L32R(4, 0),
        MOVI(7, 6),
        S32I(7, 4, 0),
        MOVI(7, 2),
        S32I(7, 4, 0),
        L32R(8, 1),
        L32R(10, 2),
        CALLXN(2, 8),
        // UART0: any received byte raises RXFIFO_FULL.
        L32R(2, 3),
        MOVI(3, 0),
        S32I(3, 2, 0x24),
        MOVI(3, 1),
        S32I(3, 2, 0x0c),
        // INTERRUPT_CORE1_UART_INTR_MAP_REG = DR_REG_INTERRUPT_BASE + 0x86C.
        L32R(5, 4),
        MOVI(3, 1),
        S32I(3, 5, 0x6c),
        J_TO(21),
        PAD_TO(0x400),
        // core 1: wait for UART0 on external level-1 CPU line 1.
        L32R(2, 3),
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        MOVI(3, 2),
        WSR(3, SR.INTENABLE),
        RSIL(8, 0),
        WAITI(0),
        J(BR(-1)),
        PAD_TO(0x740),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 3),
        L32I(3, 2, 0x00),
        S32I(3, 2, 0x00),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(500);
    expect([...c.drainUart()]).toEqual([]);
    c.uartWrite(0x42);
    c.step(300);
    expect([...c.drainUart()]).toEqual([0x42]);
  });

  it('routes FROM_CPU cross-core software interrupts to APP CPU', () => {
    const fromCpu1 = SYS + 0x34; // SYSTEM_CPU_INTR_FROM_CPU_1_REG
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SYS, SET_BOOT, CORE1_ENTRY, UART, INTMTX_CORE1, fromCpu1],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        // Route FROM_CPU_INTR1 to APP CPU external level-1 line 1.
        L32R(5, 4),
        MOVI(3, 1),
        S32I(3, 5, 0x140),
        // Release core 1 and point the ROM park loop at CORE1_ENTRY.
        L32R(4, 0),
        MOVI(7, 6),
        S32I(7, 4, 0),
        MOVI(7, 2),
        S32I(7, 4, 0),
        L32R(8, 1),
        L32R(10, 2),
        CALLXN(2, 8),
        ...Array.from({ length: 64 }, () => NOP()),
        // crosscore_int_ll_trigger_interrupt(1) writes bit 0 to this register.
        L32R(6, 5),
        MOVI(7, 1),
        S32I(7, 6, 0),
        J(BR(-1)),
        PAD_TO(0x400),
        // core 1: wait for the cross-core software interrupt.
        L32R(2, 3),
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        MOVI(3, 2),
        WSR(3, SR.INTENABLE),
        RSIL(8, 0),
        WAITI(0),
        J(BR(-1)),
        PAD_TO(0x740),
        WSR(2, SR.EXCSAVE1),
        // crosscore_int_ll_clear_interrupt(1) writes 0 to the same register.
        L32R(2, 5),
        MOVI(3, 0),
        S32I(3, 2, 0),
        L32R(2, 3),
        MOVI(3, 0x51),
        S32I(3, 2, 0),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(1_000);
    expect([...c.drainUart()]).toEqual([0x51]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('SW_APPCPU_RST sets the APPCPU reset cause (12) while PROCPU keeps power-on (1)', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [SYS, SET_BOOT, CORE1_ENTRY, RTC, UART],
      [
        ADDI(3, 1, -16),
        S32I(1, 3, 4),
        L32R(4, 0),
        MOVI(7, 6),
        S32I(7, 4, 0),
        MOVI(7, 2),
        S32I(7, 4, 0),
        L32R(8, 1),
        L32R(10, 2),
        CALLXN(2, 8), // core 1 running
        L32R(4, 3),
        MOVI(5, 1 << 4),
        S32I(5, 4, 0), // OPTIONS0 ← SW_APPCPU_RST: resets core 1 only
        L32I(6, 4, 0x38), // RESET_STATE
        L32R(9, 4),
        SRLI(7, 6, 6),
        MOVI(8, 0x3f),
        AND(7, 7, 8),
        S32I(7, 9, 0), // tx RESET_CAUSE_APPCPU [11:6] = 12
        MOVI(8, 0x3f),
        AND(6, 6, 8),
        S32I(6, 9, 0), // tx RESET_CAUSE_PROCPU [5:0] = 1
        J_TO(22),
        PAD_TO(0x400),
        J_TO(24), // core 1: park
      ],
    );
    const c = core(image);
    c.step(2_000);
    expect([...c.drainUart()]).toEqual([12, 1]);
  });
});

describe('Esp32s3Core — timers + watchdogs (slice 13)', () => {
  // REAL register addresses, pinned independently of the implementation,
  // from esp-idf v5.2 components/soc/esp32s3/include/soc/:
  //   reg_base.h        — DR_REG_TIMERGROUP0_BASE 0x6001F000,
  //                       DR_REG_TIMERGROUP1_BASE 0x60020000
  //   timer_group_reg.h — T1CONFIG +0x24..T1LOAD +0x44 (T0's layout +0x24);
  //                       WDTCONFIG0 +0x48, WDTCONFIG1 +0x4C (CLK_PRESCALE
  //                       [31:16]), WDTCONFIG2..5 +0x50..0x5C (stage0..3
  //                       timeouts), WDTFEED +0x60 (any write feeds),
  //                       WDTWPROTECT +0x64, TIMG_WDT_WKEY_VALUE 0x50D83AA1;
  //                       INT_* bits: T0=0, T1=1, WDT=2
  //   rtc_cntl_reg.h    — RTC_CNTL_WDTCONFIG0 +0x98 (EN 31, STG0 [30:28]),
  //                       WDTCONFIG1..4 +0x9C..0xA8 (stage0..3 timeouts in
  //                       RTC-slow ticks), WDTFEED +0xAC, WDTWPROTECT +0xB0
  //                       (same 0x50D83AA1 key — hal/esp32s3 rwdt_ll.h)
  //                       and CLK_CONF +0x74 ANA_CLK_RTC_SEL [31:30]
  //                       selecting RC_SLOW(0), XTAL32K(1), RC_FAST_D256(2);
  //                       SLOW_CLK_CONF +0x78 ANA_CLK_DIV [30:23] divides
  //                       RC_SLOW by register+1 when ANA_CLK_DIV_VLD is set
  //   interrupt_core0_reg.h — TG1_T1_INT_MAP +0x0D8
  // Stage actions (hal/wdt_types.h): 0 off, 1 interrupt, 2 reset CPU,
  // 3 reset system, 4 reset RTC (RWDT only). Reset causes
  // (esp_rom/include/esp32s3/rom/rtc.h): TG0WDT_SYS_RESET=7,
  // TG1WDT_SYS_RESET=8, RTCWDT_SYS_RESET=9, RTCWDT_RTC_RESET=16.
  const SCRATCH = 0x3fc88000 + 0xa00;
  const TIMG0 = 0x6001f000;
  const TIMG1 = 0x60020000;
  const INTMTX = 0x600c2000;
  const EFUSE_BASE = 0x60007000;
  const RTC_RESET_STATE = 0x60008038;
  const RTCCNTL = 0x60008000;
  const RTC_CLK_CONF_XTAL32K = 0x5158321c;
  const RTC_SLOW_CLK_DIV4 = (3 << 23) | (1 << 22);
  const WDT_KEY = 0x50d83aa1;
  const EFUSE_WRITE_OP_CODE = 0x5a5a;
  const EFUSE_PGM_DONE = 1 << 1;
  const EFUSE_BLK0_PGM_CMD = EFUSE_PGM_DONE;
  // T1CONFIG: EN | INCREASE | divider 2 | AUTORELOAD off | ALARM_EN.
  const T1_CFG_ONESHOT = (0x80000000 | 0x40000000 | (2 << 13) | (1 << 10)) >>> 0;
  // MWDT CONFIG0: EN (31) | STG0 = reset-system (3 << 29).
  const MWDT_EN_STG0_SYS = (0x80000000 | (3 << 29)) >>> 0;
  // RWDT CONFIG0: EN (31) | STG0 = reset-system (3 << 28).
  const RWDT_EN_STG0_SYS = (0x80000000 | (3 << 28)) >>> 0;
  // RWDT CONFIG0: EN (31) | STG0 = interrupt (1 << 28).
  const RWDT_EN_STG0_INT = (0x80000000 | (1 << 28)) >>> 0;
  const RWDT_PAUSE_IN_SLP = 1 << 9;
  const EFUSE_WDT_DELAY_SEL_2 = 2 << 16;

  /** Same shape as the slice-11 helper: tx RESET_CAUSE_PROCPU, then on
   *  power-on (1) run `trigger` and fall into a self-loop halt; a
   *  non-power-on cause halts straight away. */
  const causeRoundTrip = (literals: number[], trigger: XtInstr[]): Uint8Array =>
    assembleXtensa(ESP32S3_IRAM_BASE, [RTC_RESET_STATE, UART, ...literals], [
      ADDI(3, 1, -16),
      S32I(1, 3, 4),
      L32R(2, 0), // RESET_STATE
      L32I(4, 2, 0),
      MOVI(5, 0x3f),
      AND(4, 4, 5), // RESET_CAUSE_PROCPU [5:0]
      L32R(6, 1),
      S32I(4, 6, 0), // tx the cause
      ADDI(5, 4, -1),
      BNEZ_TO(5, 10 + trigger.length), // not power-on → halt
      ...trigger,
      J_TO(10 + trigger.length), // halt: J self
    ]);

  it('TIMG1 T1 fires through the matrix on its own line, independent of TIMG0 T0', () => {
    // The slice-8 one-shot dance, transplanted to group 1 / timer 1:
    // T1 register block at +0x24, INT bit 1, TG1_T1 map at +0x0D8.
    // TIMG0's INT_RAW must stay 0 throughout — nothing leaks across.
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [UART, SCRATCH, ESP32S3_IRAM_BASE, TIMG1, INTMTX, T1_CFG_ONESHOT, TIMG0],
      [
        L32R(2, 0), // a2 = UART
        L32R(3, 1), // a3 = SCRATCH
        MOVI(4, 0),
        S32I(4, 3, 0), // counter = 0
        L32R(5, 2),
        WSR(5, SR.VECBASE),
        L32R(6, 3), // a6 = TIMG1
        MOVI(7, 0),
        S32I(7, 6, 0x3c), // T1LOADLO = 0
        S32I(7, 6, 0x40), // T1LOADHI = 0
        S32I(7, 6, 0x44), // T1LOAD — counter ← 0
        MOVI(7, 30),
        S32I(7, 6, 0x34), // T1ALARMLO = 30 ticks
        MOVI(7, 0),
        S32I(7, 6, 0x38), // T1ALARMHI = 0
        MOVI(7, 2),
        S32I(7, 6, 0x70), // INT_ENA = T1 (bit 1)
        L32R(8, 4),
        MOVI(7, 2),
        S32I(7, 8, 0xd8), // TG1_T1 source → CPU line 2
        MOVI(7, 4),
        WSR(7, SR.INTENABLE), // 1 << 2
        L32R(7, 5),
        S32I(7, 6, 0x24), // T1CONFIG — armed, one-shot
        RSIL(9, 0),
        MOVI(10, 600),
        ADDI(10, 10, -1),
        BNEZ(10, BR(-2)), // burn far past the alarm
        L32R(11, 6), // a11 = TIMG0
        L32I(12, 11, 0x74),
        S32I(12, 2, 0x00), // tx TIMG0 INT_RAW — must be 0
        L32I(4, 3, 0),
        S32I(4, 2, 0x00), // tx the count — exactly 1
        J(BR(-1)),
        PAD_TO(0x340),
        // handler: counter++, INT_CLR(T1) — no re-arm (one-shot).
        WSR(2, SR.EXCSAVE1),
        L32R(2, 1),
        S32I(3, 2, 8),
        S32I(4, 2, 12),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 3), // a3 = TIMG1
        MOVI(4, 2),
        S32I(4, 3, 0x7c), // INT_CLR = T1
        L32I(4, 2, 12),
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(2_500);
    expect([...c.drainUart()]).toEqual([0, 1]);
  });

  it('MWDT config writes are ignored while write-protected; the 0x50D83AA1 key unlocks', () => {
    const image = assembleXtensa(ESP32S3_IRAM_BASE, [TIMG0, WDT_KEY, UART], [
      L32R(2, 0), // a2 = TIMG0
      L32R(3, 1), // a3 = key
      L32R(4, 2), // a4 = UART
      MOVI(5, 77),
      S32I(5, 2, 0x50), // WDTCONFIG2 ← 77 (unprotected at reset, like hardware)
      MOVI(6, 0),
      S32I(6, 2, 0x64), // WDTWPROTECT ← 0: protect
      MOVI(5, 50),
      S32I(5, 2, 0x50), // ignored — protected
      L32I(7, 2, 0x50),
      S32I(7, 4, 0), // tx 77
      S32I(3, 2, 0x64), // WDTWPROTECT ← key: unlock
      MOVI(5, 50),
      S32I(5, 2, 0x50), // sticks now
      L32I(7, 2, 0x50),
      S32I(7, 4, 0), // tx 50
      J(BR(-1)),
    ]);
    const c = core(image);
    c.step(200);
    expect([...c.drainUart()]).toEqual([77, 50]);
  });

  it('an enabled, unfed MWDT0 stage-0 system reset reboots with cause TG0WDT_SYS_RESET (7)', () => {
    const image = causeRoundTrip([TIMG0, WDT_KEY, MWDT_EN_STG0_SYS], [
      L32R(8, 2), // a8 = TIMG0
      L32R(9, 3), // a9 = key
      S32I(9, 8, 0x64), // unlock (reset state is unlocked; explicit like wdt_hal)
      MOVI(10, 10),
      S32I(10, 8, 0x50), // WDTCONFIG2: stage0 = 10 ticks
      MOVI(10, 1),
      SLLI(10, 10, 16),
      S32I(10, 8, 0x4c), // WDTCONFIG1: prescale 1 (80 MHz MWDT clock)
      L32R(10, 4),
      S32I(10, 8, 0x48), // WDTCONFIG0: EN | STG0=reset-system — then spin
    ]);
    const c = core(image);
    c.step(10_000); // boot 1: tx 1, then the WDT bites mid-spin
    c.step(500); // boot 2: tx the cause, halt
    expect([...c.drainUart()]).toEqual([7]);
  });

  it('feeding WDTFEED inside the loop holds the reset off', () => {
    const image = causeRoundTrip([TIMG0, WDT_KEY, MWDT_EN_STG0_SYS], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0x64),
      MOVI(10, 10),
      S32I(10, 8, 0x50), // stage0 = 10 ticks (30 CPU cycles)
      MOVI(10, 1),
      SLLI(10, 10, 16),
      S32I(10, 8, 0x4c),
      L32R(10, 4),
      S32I(10, 8, 0x48), // armed
      MOVI(10, 200), // 200 × (feed every ~3 cycles) ≫ 10-tick timeout
      S32I(9, 8, 0x60), // WDTFEED — any write feeds
      ADDI(10, 10, -1),
      BNEZ(10, BR(-3)),
      MOVI(10, 0),
      S32I(10, 8, 0x48), // cleanup: disarm before the unfed halt spin
      L32R(11, 1), // UART
      MOVI(12, 42),
      S32I(12, 11, 0), // tx 42 — still on boot 1
    ]);
    const c = core(image);
    c.step(10_000);
    expect([...c.drainUart()]).toEqual([1, 42]);
  });

  it("IDF's disable sequence (key, WDTCONFIG0=0, re-protect) silences an armed MWDT for good", () => {
    const image = causeRoundTrip([TIMG0, WDT_KEY, MWDT_EN_STG0_SYS], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0x64),
      MOVI(10, 10),
      S32I(10, 8, 0x50),
      MOVI(10, 1),
      SLLI(10, 10, 16),
      S32I(10, 8, 0x4c),
      L32R(10, 4),
      S32I(10, 8, 0x48), // armed — and now the wdt_hal disable dance:
      MOVI(10, 0),
      S32I(10, 8, 0x48), // WDTCONFIG0 ← 0 (still unlocked)
      S32I(10, 8, 0x64), // WDTWPROTECT ← 0: re-protect
      MOVI(10, 200),
      ADDI(10, 10, -1),
      BNEZ(10, BR(-2)), // burn far past the dead timeout — no feeds
      L32R(11, 1),
      MOVI(12, 99),
      S32I(12, 11, 0), // tx 99 — never rebooted
    ]);
    const c = core(image);
    c.step(10_000);
    expect([...c.drainUart()]).toEqual([1, 99]);
  });

  it('an unfed RWDT reboots with its own cause, RTCWDT_SYS_RESET (9)', () => {
    const image = causeRoundTrip([RTCCNTL, WDT_KEY, RWDT_EN_STG0_SYS], [
      L32R(8, 2), // a8 = RTC_CNTL
      L32R(9, 3),
      S32I(9, 8, 0xb0), // RTC_CNTL_WDTWPROTECT ← key
      MOVI(10, 2),
      S32I(10, 8, 0x9c), // WDTCONFIG1: stage0 = 2 RTC-slow ticks (~3530 cycles)
      L32R(10, 4),
      S32I(10, 8, 0x98), // WDTCONFIG0: EN | STG0=reset-system — then spin
    ]);
    const c = core(image);
    c.step(20_000); // boot 1: tx 1, RWDT bites
    c.step(500); // boot 2: tx the cause
    expect([...c.drainUart()]).toEqual([9]);
  });

  it('RWDT stage-0 uses the default eFuse x2 timeout multiplier', () => {
    // Source-checked against ESP-IDF v5.5.4: rwdt_ll_config_stage()
    // writes WDTCONFIG1 = timeout_ticks >> 1, and the hardware applies
    // an implicit stage-0 multiplier from BLOCK0 WDT_DELAY_SEL. The
    // default fuse value 0 therefore makes register value 1 last for
    // two RTC-slow ticks, not one.
    const image = causeRoundTrip([RTCCNTL, WDT_KEY, RWDT_EN_STG0_SYS], [
      L32R(8, 2),
      L32R(9, 3),
      S32I(9, 8, 0xb0), // unlock RWDT
      MOVI(10, 1),
      S32I(10, 8, 0x9c), // WDTCONFIG1: raw stage0 register value 1
      L32R(10, 4),
      S32I(10, 8, 0x98), // WDTCONFIG0: EN | STG0=reset-system
      MOVI(10, 1000),
      ADDI(10, 10, -1),
      BNEZ(10, BR(-2)), // run past one RTC-slow tick but not two
      L32R(11, 1),
      MOVI(12, 42),
      S32I(12, 11, 0), // tx survives only if the implicit x2 is honored
    ]);
    const c = core(image);
    c.step(2_600);
    expect([...c.drainUart()]).toEqual([1, 42]);
    c.step(4_000);
    c.step(500);
    expect([...c.drainUart()]).toEqual([9]);
  });

  it('RWDT stage-0 follows RTC_CNTL_CLK_CONF XTAL32K slow-clock selection', () => {
    // ESP-IDF's clk_tree maps ANA_CLK_RTC_SEL=1 to XTAL32K, slowing the
    // raw stage0=1, default eFuse x2 timeout from ~3.5k cycles to ~14.6k.
    const image = causeRoundTrip([RTCCNTL, WDT_KEY, RWDT_EN_STG0_SYS, RTC_CLK_CONF_XTAL32K], [
      L32R(8, 2),
      L32R(9, 3),
      L32R(7, 5),
      S32I(7, 8, 0x74), // CLK_CONF.ANA_CLK_RTC_SEL = XTAL32K
      S32I(9, 8, 0xb0), // unlock RWDT
      MOVI(10, 1),
      S32I(10, 8, 0x9c), // WDTCONFIG1: raw stage0 register value 1
      L32R(10, 4),
      S32I(10, 8, 0x98), // WDTCONFIG0: EN | STG0=reset-system
      MOVI(10, 2000),
      ADDI(10, 10, -1),
      BNEZ(10, BR(-2)), // far past RC_SLOW x2, before XTAL32K x2
      L32R(11, 1),
      MOVI(12, 42),
      S32I(12, 11, 0),
    ]);
    const c = core(image);
    c.step(7_000);
    expect([...c.drainUart()]).toEqual([1, 42]);
    c.step(10_000);
    c.step(500);
    expect([...c.drainUart()]).toEqual([9]);
  });

  it('RWDT stage-0 follows RTC_CNTL_SLOW_CLK_CONF RC_SLOW divider', () => {
    // clk_ll_rc_slow_set_divider(4) writes ANA_CLK_DIV=3 and sets VLD,
    // slowing the same raw stage0=1/eFuse x2 timeout by 4x.
    const image = causeRoundTrip([RTCCNTL, WDT_KEY, RWDT_EN_STG0_SYS, RTC_SLOW_CLK_DIV4], [
      L32R(8, 2),
      L32R(9, 3),
      L32R(7, 5),
      S32I(7, 8, 0x78), // SLOW_CLK_CONF.ANA_CLK_DIV = 3, VLD = 1
      S32I(9, 8, 0xb0), // unlock RWDT
      MOVI(10, 1),
      S32I(10, 8, 0x9c), // WDTCONFIG1: raw stage0 register value 1
      L32R(10, 4),
      S32I(10, 8, 0x98), // WDTCONFIG0: EN | STG0=reset-system
      MOVI(10, 2000),
      ADDI(10, 10, -1),
      BNEZ(10, BR(-2)), // far past undivided RC_SLOW x2
      L32R(11, 1),
      MOVI(12, 42),
      S32I(12, 11, 0),
    ]);
    const c = core(image);
    c.step(7_000);
    expect([...c.drainUart()]).toEqual([1, 42]);
    c.step(10_000);
    c.step(500);
    expect([...c.drainUart()]).toEqual([9]);
  });

  it('RWDT keeps elapsed RTC-slow ticks when CLK_CONF changes mid-timeout', () => {
    const image = causeRoundTrip([RTCCNTL, WDT_KEY, RWDT_EN_STG0_SYS, RTC_CLK_CONF_XTAL32K, 5000], [
      L32R(8, 2),
      L32R(9, 3),
      L32R(7, 5),
      S32I(9, 8, 0xb0), // unlock RWDT
      MOVI(10, 1),
      S32I(10, 8, 0x9c), // raw stage0 register value 1 -> 2 RTC-slow ticks
      L32R(10, 4),
      S32I(10, 8, 0x98), // arm under default RC_SLOW
      MOVI(10, 1000),
      ADDI(10, 10, -1),
      BNEZ(10, BR(-2)), // age past one RC_SLOW tick, but not two
      S32I(7, 8, 0x74), // switch the live timeout to XTAL32K
      L32R(10, 6),
      ADDI(10, 10, -1),
      BNEZ(10, BR(-2)), // one more XTAL32K tick should finish the timeout
      L32R(11, 1),
      MOVI(12, 42),
      S32I(12, 11, 0), // only reaches here if the pre-switch elapsed tick was lost
    ]);
    const c = core(image);
    c.step(15_000);
    c.step(500);
    expect([...c.drainUart()]).toEqual([9]);
  });

  it('RWDT stage-0 honors burned eFuse WDT_DELAY_SEL values', () => {
    // EFUSE_RD_REPEAT_DATA0.WDT_DELAY_SEL bits [17:16] select the
    // stage-0 implicit multiplier. Fuse value 2 makes register value 1
    // last for eight RTC-slow ticks.
    const image = causeRoundTrip(
      [EFUSE_BASE, RTCCNTL, WDT_KEY, EFUSE_WDT_DELAY_SEL_2, EFUSE_WRITE_OP_CODE, EFUSE_BLK0_PGM_CMD, RWDT_EN_STG0_SYS],
      [
        L32R(8, 2),
        L32R(9, 5),
        S32I(9, 8, 0x04), // PGM_DATA1: BLOCK0 WDT_DELAY_SEL = 2
        L32R(9, 6),
        S32I(9, 8, 0x1cc), // CONF = WRITE_OP_CODE
        L32R(9, 7),
        S32I(9, 8, 0x1d4), // CMD = BLOCK0 + PGM_CMD
        L32R(8, 3),
        L32R(9, 4),
        S32I(9, 8, 0xb0), // unlock RWDT
        MOVI(10, 1),
        S32I(10, 8, 0x9c), // raw stage0 register value 1
        L32R(10, 8),
        S32I(10, 8, 0x98), // WDTCONFIG0: EN | STG0=reset-system
        MOVI(10, 2000),
        ADDI(10, 10, -1),
        BNEZ(10, BR(-2)), // beyond default x2, still before burned x8
        L32R(11, 1),
        MOVI(12, 99),
        S32I(12, 11, 0),
      ],
    );
    const c = core(image);
    c.step(6_000);
    expect([...c.drainUart()]).toEqual([1, 99]);
    c.step(12_000);
    c.step(500);
    expect([...c.drainUart()]).toEqual([9]);
  });

  it('RWDT pause-in-sleep freezes the timeout until RTC timer wake', () => {
    // Source-checked against ESP-IDF v5.5.4: RTC_CNTL_WDTCONFIG0
    // has WDT_PAUSE_IN_SLP at bit 9 with reset default 1. The test
    // arms a two-slow-tick reset timeout, sleeps until tick 10, and
    // proves the reset did not happen while RTC sleep was active.
    const rtcTimerTrig = 1 << 3;
    const wakeupTimer = rtcTimerTrig << 15;
    const rtcIntMask = (1 << 10) | 1; // MAIN_TIMER_INT | SLP_WAKEUP_INT
    const sleepEn = 0x80000000;
    const mainTimerAlarmEn = 1 << 16;
    const rwdtPausedReset = (RWDT_EN_STG0_SYS | RWDT_PAUSE_IN_SLP) >>> 0;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, WDT_KEY, rwdtPausedReset, INTMTX, ESP32S3_IRAM_BASE, wakeupTimer, rtcIntMask, sleepEn, mainTimerAlarmEn, UART, 10],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1),
        S32I(3, 2, 0xb0), // unlock RWDT
        MOVI(4, 2),
        S32I(4, 2, 0x9c), // WDTCONFIG1: stage0 = 2 RTC-slow ticks
        L32R(5, 3),
        MOVI(4, 1),
        S32I(4, 5, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 4),
        WSR(6, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        RSIL(8, 0),
        L32R(4, 6),
        S32I(4, 2, 0x4c), // clear stale MAIN_TIMER/SLP_WAKEUP raw bits
        S32I(4, 2, 0x40), // enable both RTC raw sources
        L32R(4, 5),
        S32I(4, 2, 0x3c), // WAKEUP_STATE timer wake source
        L32R(4, 2),
        S32I(4, 2, 0x98), // arm RWDT with pause-in-sleep
        L32R(4, 10),
        S32I(4, 2, 0x04), // target RTC slow-clock tick 10
        L32R(4, 8),
        S32I(4, 2, 0x08), // arm RTC main timer alarm
        L32R(4, 7),
        S32I(4, 2, 0x18), // STATE0.SLEEP_EN
        WAITI(0),
        MOVI(4, 0),
        S32I(4, 2, 0x98), // disarm before RWDT resumes long enough to bite
        L32I(4, 2, 0x130), // SLP_WAKEUP_CAUSE raw trigger bitmap
        L32R(5, 9),
        S32I(4, 5, 0), // tx RTC_TIMER_TRIG_EN
        L32I(4, 2, 0x38), // RESET_STATE
        MOVI(6, 0x3f),
        AND(4, 4, 6),
        S32I(4, 5, 0), // tx POWERON reset cause, not RTCWDT
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 6),
        S32I(3, 2, 0x4c), // clear MAIN_TIMER/SLP_WAKEUP so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(25_000);
    expect([...c.drainUart()]).toEqual([rtcTimerTrig, 1]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });

  it('an RWDT stage-0 interrupt wakes WAITI through RTC_CORE without rebooting', () => {
    // Source-checked against ESP-IDF release/v5.5:
    // rtc_cntl_reg.h has RTC_CNTL_WDT_INT_* at bit 3 and WDTCONFIG0
    // +0x98 / WDTCONFIG1 +0x9c; interrupt_core0_reg.h maps RTC_CORE
    // at +0x09c; rwdt_ll.h clears the status through int_clr.rtc_wdt.
    const RTC_WDT_INT = 1 << 3;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [RTCCNTL, WDT_KEY, RWDT_EN_STG0_INT, INTMTX, ESP32S3_IRAM_BASE, UART, RTC_WDT_INT, RTC_RESET_STATE, 0x80000000],
      [
        L32R(2, 0), // a2 = RTC_CNTL
        L32R(3, 1), // a3 = WDT key
        S32I(3, 2, 0xb0), // unlock RWDT
        MOVI(4, 2),
        S32I(4, 2, 0x9c), // WDTCONFIG1: stage0 = 2 RTC-slow ticks
        L32R(5, 3), // a5 = interrupt matrix
        MOVI(4, 1),
        S32I(4, 5, 0x9c), // RTC_CORE_INTR_MAP -> external level-1 line 1
        L32R(6, 4),
        WSR(6, SR.VECBASE),
        MOVI(4, 2),
        WSR(4, SR.INTENABLE),
        RSIL(8, 0),
        L32R(4, 6),
        S32I(4, 2, 0x4c), // clear stale RTC_WDT raw
        S32I(4, 2, 0x40), // enable RTC_WDT interrupt
        L32R(4, 2),
        S32I(4, 2, 0x98), // arm RWDT stage0 interrupt
        WAITI(0),
        L32I(4, 2, 0x48), // INT_ST after handler clear
        L32R(5, 5),
        S32I(4, 5, 0), // tx 0: status is clear
        L32R(5, 7),
        L32I(4, 5, 0),
        MOVI(6, 0x3f),
        AND(4, 4, 6),
        L32R(6, 8),
        S32I(6, 2, 0xac), // feed RWDT so later steps do not advance to reset stage
        L32R(5, 5),
        S32I(4, 5, 0), // tx RESET_CAUSE_PROCPU = POWERON(1), not RTCWDT
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 0),
        L32R(3, 6),
        S32I(3, 2, 0x4c), // clear RTC_WDT raw so it does not re-fire
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.step(12_000);
    expect([...c.drainUart()]).toEqual([0, 1]);
    c.step(300);
    expect([...c.drainUart()]).toEqual([]);
  });
});

describe('Esp32s3Core — ADC continuous GDMA frames (slice 16)', () => {
  const GDMA = 0x6003f000;
  const INTMTX = 0x600c2000;
  const APB_SARADC = 0x60040000;
  const DESC = ESP32S3_DRAM_BASE + 0x1000;
  const BUF = ESP32S3_DRAM_BASE + 0x1040;
  const SCRATCH = ESP32S3_DRAM_BASE + 0x1080;
  const DESC_LINK_START = (DESC & 0x000f_ffff) | (1 << 22) | (1 << 20);
  const DESC_8_BYTES_DMA = 0x80000008;
  const ADC_DAC_PERI = 8;
  const ADC1_CH2_PATTERN = (2 << 2) << 18;

  it('writes ADC digital-controller results into a GDMA RX descriptor buffer', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [DESC, BUF, DESC_8_BYTES_DMA, GDMA, DESC_LINK_START, APB_SARADC, ADC1_CH2_PATTERN, UART],
      [
        L32R(2, 0), // a2 = descriptor
        L32R(3, 1), // a3 = buffer
        L32R(4, 2), // owner=DMA, size=8 bytes
        S32I(4, 2, 0),
        S32I(3, 2, 4),
        MOVI(5, 0),
        S32I(5, 2, 8), // next = NULL

        L32R(6, 3), // a6 = GDMA base
        MOVI(7, ADC_DAC_PERI),
        S32I(7, 6, 0x48), // IN_PERI_SEL_CH0 = ADC_DAC
        L32R(7, 4),
        S32I(7, 6, 0x20), // IN_LINK_CH0 = desc | START

        L32R(8, 5), // a8 = APB_SARADC
        L32R(9, 6),
        S32I(9, 8, 0x18), // SAR1 pattern table: ADC1 channel 2
        MOVI(10, 2),
        S32I(10, 8, 0x00), // START edge: sample 1
        MOVI(10, 0),
        S32I(10, 8, 0x00),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // START edge: sample 2, descriptor complete

        L32R(12, 7), // UART
        L32I(11, 3, 0),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // sample 1 high byte: 0x48 = ch2 + 2048 raw
        L32I(11, 3, 4),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // sample 2 high byte
        L32I(11, 2, 0),
        SRLI(11, 11, 12),
        S32I(11, 12, 0), // descriptor length = 8
        L32I(11, 6, 0x08),
        S32I(11, 12, 0), // GDMA INT_RAW = DONE|SUC_EOF
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 2 ? 1.65 : 0));
    c.step(400);

    expect([...c.drainUart()]).toEqual([0x48, 0x48, 8, 3]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([2, 2]);
  });

  it('advances ADC continuous writes across chained GDMA RX descriptors', () => {
    const desc2 = ESP32S3_DRAM_BASE + 0x1020;
    const buf2 = ESP32S3_DRAM_BASE + 0x10c0;
    const desc4BytesDma = 0x80000004;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [DESC, desc2, BUF, buf2, desc4BytesDma, GDMA, DESC_LINK_START, APB_SARADC, ADC1_CH2_PATTERN, UART],
      [
        L32R(2, 0), // descriptor 1
        L32R(3, 1), // descriptor 2
        L32R(4, 4), // owner=DMA, size=4 bytes
        S32I(4, 2, 0),
        L32R(5, 2),
        S32I(5, 2, 4),
        S32I(3, 2, 8), // descriptor 1 -> descriptor 2
        S32I(4, 3, 0),
        L32R(5, 3),
        S32I(5, 3, 4),
        MOVI(5, 0),
        S32I(5, 3, 8),

        L32R(6, 5), // GDMA
        MOVI(7, ADC_DAC_PERI),
        S32I(7, 6, 0x48),
        L32R(7, 6),
        S32I(7, 6, 0x20),

        L32R(8, 7), // APB_SARADC
        L32R(9, 8),
        S32I(9, 8, 0x18),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 1 fills descriptor 1
        MOVI(10, 0),
        S32I(10, 8, 0x00),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 2 must hop to descriptor 2

        L32R(12, 9), // UART
        L32R(3, 2),
        L32I(11, 3, 0),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // buffer 1 high byte
        L32R(3, 3),
        L32I(11, 3, 0),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // buffer 2 high byte
        L32R(2, 0),
        L32I(11, 2, 0),
        SRLI(11, 11, 12),
        S32I(11, 12, 0), // descriptor 1 length
        L32R(2, 1),
        L32I(11, 2, 0),
        SRLI(11, 11, 12),
        S32I(11, 12, 0), // descriptor 2 length
        L32I(11, 6, 0x08),
        S32I(11, 12, 0), // GDMA INT_RAW = DONE|SUC_EOF from descriptor 2
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 2 ? 1.65 : 0));
    c.step(500);

    expect([...c.drainUart()]).toEqual([0x48, 0x48, 4, 4, 3]);
  });

  it('reports descriptor starvation when ADC continuous data arrives after the pool is exhausted', () => {
    const desc4BytesDma = 0x80000004;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [DESC, BUF, desc4BytesDma, GDMA, DESC_LINK_START, APB_SARADC, ADC1_CH2_PATTERN, UART],
      [
        L32R(2, 0), // descriptor
        L32R(3, 1), // buffer
        L32R(4, 2), // owner=DMA, size=4 bytes
        S32I(4, 2, 0),
        S32I(3, 2, 4),
        MOVI(5, 0),
        S32I(5, 2, 8), // next = NULL

        L32R(6, 3), // GDMA
        MOVI(7, ADC_DAC_PERI),
        S32I(7, 6, 0x48),
        L32R(7, 4),
        S32I(7, 6, 0x20),

        L32R(8, 5), // APB_SARADC
        L32R(9, 6),
        S32I(9, 8, 0x18),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 1 fills the only descriptor
        MOVI(10, 0),
        S32I(10, 8, 0x00),
        MOVI(11, 3),
        S32I(11, 6, 0x14), // clear DONE | SUC_EOF before probing starvation
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 2 arrives while no descriptor is DMA-owned

        L32R(12, 7), // UART
        L32I(11, 6, 0x08),
        S32I(11, 12, 0), // GDMA INT_RAW = DSCR_EMPTY
        L32I(11, 2, 0),
        SRLI(11, 11, 12),
        S32I(11, 12, 0), // descriptor length remains 4
        L32I(11, 3, 0),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // original sample survived; second was not written over it
        J(BR(-1)),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 2 ? 1.65 : 0));
    c.step(500);

    expect([...c.drainUart()]).toEqual([16, 4, 0x48]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([2, 2]);
  });

  it('recovers a circular GDMA RX pool after firmware returns descriptor ownership', () => {
    const desc4BytesDma = 0x80000004;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [DESC, BUF, desc4BytesDma, GDMA, DESC_LINK_START, APB_SARADC, ADC1_CH2_PATTERN, UART],
      [
        L32R(2, 0), // descriptor
        L32R(3, 1), // buffer
        L32R(4, 2), // owner=DMA, size=4 bytes
        S32I(4, 2, 0),
        S32I(3, 2, 4),
        S32I(2, 2, 8), // circular pool: descriptor -> itself

        L32R(6, 3), // GDMA
        MOVI(7, ADC_DAC_PERI),
        S32I(7, 6, 0x48),
        L32R(7, 4),
        S32I(7, 6, 0x20),

        L32R(8, 5), // APB_SARADC
        L32R(9, 6),
        S32I(9, 8, 0x18),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 1 fills descriptor and returns it to CPU ownership
        MOVI(10, 0),
        S32I(10, 8, 0x00),
        MOVI(11, 3),
        S32I(11, 6, 0x14), // clear DONE | SUC_EOF
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 2 arrives while the pool is CPU-owned: backpressure

        L32R(12, 7), // UART
        L32I(11, 6, 0x08),
        S32I(11, 12, 0), // GDMA INT_RAW = DSCR_EMPTY, not DSCR_ERR
        L32I(11, 3, 0),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // first sample survived; backpressure did not overwrite it
        MOVI(11, 16),
        S32I(11, 6, 0x14), // clear DSCR_EMPTY
        S32I(4, 2, 0), // firmware returns descriptor ownership to DMA
        MOVI(10, 0),
        S32I(10, 8, 0x00),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 3 resumes into the returned descriptor
        L32I(11, 6, 0x08),
        S32I(11, 12, 0), // GDMA INT_RAW = DONE | SUC_EOF
        L32I(11, 3, 0),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // recovered sample overwrote buffer
        L32I(11, 2, 0),
        SRLI(11, 11, 12),
        S32I(11, 12, 0), // descriptor length = 4
        J(BR(-1)),
      ],
    );
    const samples = [0.825, 1.65, 2.475];
    let read = 0;
    const c = core(image);
    c.setAdcSampler((channel) => {
      if (channel !== 2) return 0;
      return samples[read++] ?? 0;
    });
    c.step(700);

    expect([...c.drainUart()]).toEqual([16, 0x44, 3, 0x4b, 4]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([2, 2, 2]);
    expect(c.drainAdcContinuousOverflows().map((event) => event.policy)).toEqual(['drop-new']);
  });

  it('flushes old circular GDMA RX frame data when the ADC continuous flush_pool policy is enabled', () => {
    const desc4BytesDma = 0x80000004;
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [DESC, BUF, desc4BytesDma, GDMA, DESC_LINK_START, APB_SARADC, ADC1_CH2_PATTERN, UART],
      [
        L32R(2, 0), // descriptor
        L32R(3, 1), // buffer
        L32R(4, 2), // owner=DMA, size=4 bytes
        S32I(4, 2, 0),
        S32I(3, 2, 4),
        S32I(2, 2, 8), // circular pool: descriptor -> itself

        L32R(6, 3), // GDMA
        MOVI(7, ADC_DAC_PERI),
        S32I(7, 6, 0x48),
        L32R(7, 4),
        S32I(7, 6, 0x20),

        L32R(8, 5), // APB_SARADC
        L32R(9, 6),
        S32I(9, 8, 0x18),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 1 fills descriptor and returns it to CPU ownership
        MOVI(10, 0),
        S32I(10, 8, 0x00),
        MOVI(11, 3),
        S32I(11, 6, 0x14), // clear DONE | SUC_EOF
        MOVI(10, 2),
        S32I(10, 8, 0x00), // sample 2 flushes old frame and writes the new one

        L32R(12, 7), // UART
        L32I(11, 6, 0x08),
        S32I(11, 12, 0), // GDMA INT_RAW = DONE | SUC_EOF, no DSCR_EMPTY
        L32I(11, 3, 0),
        SRLI(11, 11, 8),
        S32I(11, 12, 0), // second sample overwrote the old frame
        L32I(11, 2, 0),
        SRLI(11, 11, 12),
        S32I(11, 12, 0), // descriptor length = 4
        J(BR(-1)),
      ],
    );
    const samples = [0.825, 1.65];
    let read = 0;
    const c = core(image);
    c.setAdcContinuousFlushPool(true);
    c.setAdcSampler((channel) => {
      if (channel !== 2) return 0;
      return samples[read++] ?? 0;
    });
    c.step(600);

    expect([...c.drainUart()]).toEqual([3, 0x48, 4]);
    expect(c.drainAdcReads().map((r) => r.channel)).toEqual([2, 2]);
    expect(c.drainAdcContinuousOverflows().map((event) => event.policy)).toEqual(['flush-old']);
  });

  it('routes GDMA RX DONE/SUC_EOF through the interrupt matrix to a level-1 handler', () => {
    const image = assembleXtensa(
      ESP32S3_IRAM_BASE,
      [DESC, BUF, DESC_8_BYTES_DMA, GDMA, DESC_LINK_START, APB_SARADC, ADC1_CH2_PATTERN, UART, SCRATCH, ESP32S3_IRAM_BASE, INTMTX],
      [
        L32R(13, 8), // scratch
        MOVI(14, 0),
        S32I(14, 13, 0), // irq counter = 0
        L32R(14, 9),
        WSR(14, SR.VECBASE),

        L32R(2, 0), // descriptor
        L32R(3, 1), // buffer
        L32R(4, 2), // owner=DMA, size=8 bytes
        S32I(4, 2, 0),
        S32I(3, 2, 4),
        MOVI(5, 0),
        S32I(5, 2, 8),

        L32R(6, 3), // GDMA
        MOVI(7, ADC_DAC_PERI),
        S32I(7, 6, 0x48), // IN_PERI_SEL_CH0 = ADC_DAC
        MOVI(7, 3),
        S32I(7, 6, 0x10), // IN_INT_ENA: DONE | SUC_EOF
        L32R(15, 10), // interrupt matrix
        MOVI(7, 0),
        S32I(7, 15, 0x108), // DMA_IN_CH0 -> CPU line 0
        MOVI(7, 1),
        WSR(7, SR.INTENABLE),
        RSIL(12, 0),
        L32R(7, 4),
        S32I(7, 6, 0x20), // IN_LINK_CH0 = desc | START

        L32R(8, 5), // APB_SARADC
        L32R(9, 6),
        S32I(9, 8, 0x18), // ADC1 channel 2 pattern
        MOVI(10, 2),
        S32I(10, 8, 0x00),
        MOVI(10, 0),
        S32I(10, 8, 0x00),
        MOVI(10, 2),
        S32I(10, 8, 0x00), // second sample completes descriptor, raises GDMA IRQ

        MOVI(11, 1),
        L32I(4, 13, 0),
        BNE(4, 11, BR(-2)),
        L32R(12, 7), // UART
        S32I(4, 12, 0), // counter = 1
        L32I(4, 6, 0x08),
        S32I(4, 12, 0), // raw bits after ISR clear = 0
        L32I(4, 3, 0),
        SRLI(4, 4, 8),
        S32I(4, 12, 0), // frame survived in DMA buffer
        J(BR(-1)),

        PAD_TO(0x340),
        WSR(2, SR.EXCSAVE1),
        L32R(2, 8), // scratch
        S32I(3, 2, 8),
        L32I(3, 2, 0),
        ADDI(3, 3, 1),
        S32I(3, 2, 0),
        L32R(3, 3), // GDMA
        MOVI(4, 3),
        S32I(4, 3, 0x14), // clear DONE | SUC_EOF
        L32I(3, 2, 8),
        RSR(2, SR.EXCSAVE1),
        RFE(),
      ],
    );
    const c = core(image);
    c.setAdcSampler((channel) => (channel === 2 ? 1.65 : 0));
    c.step(600);

    expect([...c.drainUart()]).toEqual([1, 0, 0x48]);
  });
});
