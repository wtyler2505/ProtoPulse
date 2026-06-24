import {
  Esp32s3Core,
  ESP32S3_I2C0_BASE,
  ESP32S3_IRAM_BASE,
  ESP32S3_UART0_BASE,
  mpu6050,
  xt,
} from '@protopulse/emu';
import { materialize } from '@protopulse/graph';
import { seedPartDb } from '@protopulse/parts';
import { SpiceEngine } from '@protopulse/sim';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runCosimClosedLoop } from './quantum.js';

import type { ClosedLoopSpec } from './types.js';
import type { DesignGraph, OpBody } from '@protopulse/graph';

/**
 * I2C digital sensor in the co-sim CLOSED LOOP — the bus-device counterpart of
 * the analog ADC sampler. A real `Esp32s3Core` runs firmware that reads the
 * MPU-6050 WHO_AM_I register over I2C while `runCosimClosedLoop` drives the
 * window; the loop installs the modeled device (via the new `i2cDevices`
 * binding → `setI2cSlave`) so the firmware reads back 0x68 instead of zeros.
 */

const parts = seedPartDb();
const { assembleXtensa, L32R, S32I, L32I, MOVI, J, BR } = xt;

/** Firmware: read 1 byte from `reg` of I2C device `addr`, TX it over UART0. */
function i2cReadImage(addr: number, reg: number): Uint8Array {
  const addrW = (addr << 1) | 0;
  const addrR = (addr << 1) | 1;
  const WRITE2_ACK = 2 | (1 << 8) | (1 << 11);
  const WRITE1_ACK = 1 | (1 << 8) | (1 << 11);
  const RESTART = 6 << 11;
  const READ1 = 1 | (3 << 11);
  const STOP = 2 << 11;
  const END = 4 << 11;
  return assembleXtensa(
    ESP32S3_IRAM_BASE,
    [ESP32S3_I2C0_BASE, ESP32S3_UART0_BASE, addrW, reg, addrR, WRITE2_ACK, RESTART, WRITE1_ACK, READ1, STOP, END],
    [
      L32R(2, 0),
      L32R(6, 1),
      L32R(3, 2),
      S32I(3, 2, 0x1c),
      L32R(3, 3),
      S32I(3, 2, 0x1c),
      L32R(3, 4),
      S32I(3, 2, 0x1c),
      L32R(3, 5),
      S32I(3, 2, 0x58),
      L32R(3, 6),
      S32I(3, 2, 0x5c),
      L32R(3, 7),
      S32I(3, 2, 0x60),
      L32R(3, 8),
      S32I(3, 2, 0x64),
      L32R(3, 9),
      S32I(3, 2, 0x68),
      L32R(3, 10),
      S32I(3, 2, 0x6c),
      MOVI(3, 0x20),
      S32I(3, 2, 0x04), // TRANS_START
      L32I(4, 2, 0x1c), // RXFIFO byte
      S32I(4, 6, 0), // UART <- byte
      J(BR(-1)),
    ],
  );
}

/** Minimal graph: just a rail net to satisfy the required output binding. */
function railGraph(): DesignGraph {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1, value: '3.3V' },
    { kind: 'connect', port: 'vcc:1', newNetId: 'n_vcc' },
    { kind: 'rename_net', netId: 'n_vcc', name: 'VCC' },
  ];
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

describe('co-sim closed loop — firmware reads an I2C sensor through the bus-device binding (REAL)', () => {
  const engine = new SpiceEngine();
  let uart: number[];

  beforeAll(async () => {
    await engine.start();
    const core = new Esp32s3Core();
    core.loadFirmware(i2cReadImage(0x68, 0x75)); // MPU-6050 WHO_AM_I
    const spec: ClosedLoopSpec = {
      windowS: 200e-6,
      stepS: 1e-6,
      quantumS: 50e-6,
      bindings: [{ pin: 'B5', netId: 'n_vcc' }],
      i2cDevices: [{ port: 0, slave: mpu6050() }],
    };
    await runCosimClosedLoop({ graph: railGraph(), parts, core, spec, engine });
    uart = [...core.drainUart()];
  }, 120_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('installs the I2C device for the run so firmware reads WHO_AM_I = 0x68', () => {
    expect(uart).toContain(0x68);
  });
});
