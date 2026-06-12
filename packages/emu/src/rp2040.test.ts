import { describe, expect, it } from 'vitest';

import { Rp2040Core } from './rp2040.js';
import {
  assembleThumb,
  B,
  BCOND,
  COND_EQ,
  COND_NE,
  LDR,
  loadConst,
  LSLS,
  MOVS,
  STR,
  TST,
} from './thumb-asm.js';

/**
 * The RP2040 core against real(ly emulated) silicon: every program here
 * is hand-assembled Thumb poking actual RP2040 registers — SIO for
 * GPIO, IO_BANK0 for function select, PADS for input enable, PL011
 * UART0, and the SAR ADC. Same philosophy as the AVR suite: firmware
 * runs for real or the test fails.
 */

const IO_BANK0 = 0x40014000;
const PADS_BANK0 = 0x4001c000;
const SIO = 0xd0000000;
const UART0 = 0x40034000;
const ADC = 0x4004c000;

const ctrlOf = (gp: number) => IO_BANK0 + gp * 8 + 4;
const padOf = (gp: number) => PADS_BANK0 + 4 + gp * 4;

const FUNCSEL_SIO = 5;
// SIO offsets
const GPIO_OUT_SET = 0x14;
const GPIO_OUT_CLR = 0x18;
const GPIO_OE_SET = 0x24;
const GPIO_IN = 0x04;

function core(program: number[]): Rp2040Core {
  const c = new Rp2040Core();
  c.loadFirmware(assembleThumb(program));
  return c;
}

/** funcsel GP25 to SIO, set OE bit25, leave the mask in r5 and the SIO
 *  base in r2. */
function gp25Setup(): number[] {
  return [
    ...loadConst(1, 0, ctrlOf(25)),
    MOVS(0, FUNCSEL_SIO),
    STR(0, 1, 0),
    ...loadConst(2, 0, SIO),
    MOVS(5, 1),
    LSLS(5, 5, 25),
    STR(5, 2, GPIO_OE_SET),
  ];
}

describe('Rp2040Core', () => {
  it('blink: GP25 toggles with strictly increasing cycle stamps', () => {
    // loop: OUT_SET; OUT_CLR; b loop
    const program = [
      ...gp25Setup(),
      STR(5, 2, GPIO_OUT_SET),
      STR(5, 2, GPIO_OUT_CLR),
      B(-4),
    ];
    const c = core(program);
    const { events, cycles } = c.step(2_000);
    expect(cycles).toBeGreaterThanOrEqual(2_000);
    const gp25 = events.filter((e) => e.pin === 'GP25');
    expect(gp25.length).toBeGreaterThan(10);
    // First event is the output-enable itself (OUT resets low), then
    // the loop alternates; stamps strictly increase throughout.
    expect(gp25[0]?.level).toBe(0);
    for (let i = 1; i < gp25.length; i++) {
      expect(gp25[i]?.level).toBe(gp25[i - 1]?.level === 1 ? 0 : 1);
      expect(gp25[i]?.cycle).toBeGreaterThan(gp25[i - 1]?.cycle ?? Infinity);
    }
  });

  it('setPin drives an input the firmware reads: GP25 mirrors GP2', () => {
    const program = [
      ...gp25Setup(),
      // GP2: input-enable the pad (rp2040js pads reset with IE off).
      ...loadConst(1, 0, padOf(2)),
      MOVS(0, 0x76),
      STR(0, 1, 0),
      MOVS(4, 4), // bit2 mask
      // loop: in = SIO.GPIO_IN; if (in & bit2) set else clr
      LDR(3, 2, GPIO_IN),
      TST(3, 4),
      BCOND(COND_EQ, 1), // → clr
      STR(5, 2, GPIO_OUT_SET),
      B(-6), // → loop
      STR(5, 2, GPIO_OUT_CLR), // clr:
      B(-8), // → loop
    ];
    const c = core(program);
    c.step(500);

    c.setPin('GP2', 1);
    const high = c.step(500).events.filter((e) => e.pin === 'GP25');
    expect(high[high.length - 1]?.level).toBe(1);

    c.setPin('GP2', 0);
    const low = c.step(500).events.filter((e) => e.pin === 'GP25');
    expect(low[low.length - 1]?.level).toBe(0);
  });

  it('UART0 TX reaches drainUart', () => {
    const program = [
      ...loadConst(1, 0, UART0),
      MOVS(0, 0x48), // 'H'
      STR(0, 1, 0), // DR
      MOVS(0, 0x69), // 'i'
      STR(0, 1, 0),
      B(-2), // park
    ];
    const c = core(program);
    c.step(200);
    expect([...c.drainUart()]).toEqual([0x48, 0x69]);
    expect([...c.drainUart()]).toEqual([]); // drained means drained
  });

  it('uartWrite feeds the receiver: firmware echoes bytes back', () => {
    const program = [
      ...loadConst(1, 0, UART0),
      ...loadConst(0, 3, 0x301), // UARTEN | TXE | RXE
      STR(0, 1, 0x30), // CR
      MOVS(4, 0x10), // FR.RXFE
      // poll: while (FR & RXFE) ; then echo DR -> DR
      LDR(3, 1, 0x18),
      TST(3, 4),
      BCOND(COND_NE, -4), // → poll
      LDR(0, 1, 0), // pop DR
      STR(0, 1, 0), // echo
      B(-7), // → poll
    ];
    const c = core(program);
    c.step(500); // let firmware enable the UART first
    c.uartWrite(0x42);
    c.step(500);
    expect([...c.drainUart()]).toEqual([0x42]);
  });

  it('the ADC consults the sampler (12-bit @ 3.3 Vref) and reports the read', () => {
    const program = [
      ...loadConst(1, 0, ADC),
      MOVS(0, 0x05), // CS = EN | START_ONCE (AINSEL 0)
      STR(0, 1, 0),
      MOVS(4, 1),
      LSLS(4, 4, 8), // CS.READY
      // poll: until READY
      LDR(3, 1, 0),
      TST(3, 4),
      BCOND(COND_EQ, -4), // → poll
      LDR(0, 1, 4), // RESULT
      ...loadConst(2, 3, UART0),
      STR(0, 2, 0), // low byte out the UART
      B(-2), // park
    ];
    const c = core(program);
    const seen: number[] = [];
    c.setAdcSampler((channel) => {
      seen.push(channel);
      return (100 / 4095) * 3.3; // quantizes to exactly 100
    });
    c.step(1_000);
    expect(seen).toEqual([0]);
    expect([...c.drainUart()]).toEqual([100]);
    const reads = c.drainAdcReads();
    expect(reads).toHaveLength(1);
    expect(reads[0]?.channel).toBe(0);
    expect(c.drainAdcReads()).toEqual([]);
  });

  it('inspect advances; reset clears state but keeps firmware and bench wiring', () => {
    const program = [...gp25Setup(), STR(5, 2, GPIO_OUT_SET), STR(5, 2, GPIO_OUT_CLR), B(-4)];
    const c = core(program);
    expect(c.clockHz).toBe(125_000_000);
    c.setPin('GP2', 1);
    c.step(1_000);
    const before = c.inspect();
    expect(before.cycles).toBeGreaterThanOrEqual(1_000);

    c.reset();
    expect(c.inspect().cycles).toBe(0);
    // Firmware survives reset: it blinks again from scratch.
    const again = c.step(2_000).events.filter((e) => e.pin === 'GP25');
    expect(again.length).toBeGreaterThan(10);
    expect(again[1]?.level).toBe(1); // event 0 is the OE-enable low
  });

  it('refuses to step without firmware and rejects unknown pins', () => {
    const c = new Rp2040Core();
    expect(() => c.step(100)).toThrow(/no firmware/);
    expect(() => { c.setPin('Z9', 1); }).toThrow(/unknown RP2040 pin/);
    expect(() => { c.setPin('GP30', 1); }).toThrow(/unknown RP2040 pin/);
  });
});
