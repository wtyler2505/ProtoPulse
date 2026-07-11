import {
  Esp32s3Core,
  ESP32S3_IRAM_BASE,
  ESP32S3_SPI2_BASE,
  ESP32S3_UART0_BASE,
  rc522,
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
 * SPI digital device in the co-sim CLOSED LOOP — the SPI counterpart of the
 * I2C device binding. A real `Esp32s3Core` runs firmware that reads the RC522
 * VersionReg over SPI while `runCosimClosedLoop` drives the window; the loop
 * installs the modeled device (via the new `spiDevices` binding → setSpiSlave)
 * so the firmware reads back 0x92 instead of zeros.
 */

const parts = seedPartDb();
const { assembleXtensa, L32R, S32I, L32I, MOVI, J, BR } = xt;

/** Firmware: SPI command byte + 1-byte MISO read on GPSPI2, TX it over UART0. */
function spiReadImage(cmd: number): Uint8Array {
  const USER_CMD_MISO = (0x80000000 | 0x10000000) >>> 0;
  const USER2_CMD = ((7 << 28) | (cmd & 0xffff)) >>> 0;
  const SPI_CMD_USR = 1 << 24;
  return assembleXtensa(
    ESP32S3_IRAM_BASE,
    [ESP32S3_SPI2_BASE, ESP32S3_UART0_BASE, USER_CMD_MISO, USER2_CMD, SPI_CMD_USR],
    [
      L32R(2, 0),
      L32R(6, 1),
      L32R(3, 2),
      S32I(3, 2, 0x10), // USER = COMMAND | MISO
      L32R(3, 3),
      S32I(3, 2, 0x18), // USER2 = 8-bit command
      MOVI(3, 7),
      S32I(3, 2, 0x1c), // MS_DLEN = 8 bits
      MOVI(3, 0),
      S32I(3, 2, 0x98), // W0 = 0
      L32R(3, 4),
      S32I(3, 2, 0x00), // CMD = USR
      L32I(4, 2, 0x98), // W0 low byte = MISO[0]
      S32I(4, 6, 0), // UART <- byte
      J(BR(-1)),
    ],
  );
}

function railGraph(): DesignGraph {
  const ops: OpBody[] = [
    { kind: 'add_component', id: 'vcc', ref: 'PWR1', partId: 'core:pwr-vcc', partRev: 1, value: '3.3V' },
    { kind: 'connect', port: 'vcc:1', newNetId: 'n_vcc' },
    { kind: 'rename_net', netId: 'n_vcc', name: 'VCC' },
  ];
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

describe('co-sim closed loop — firmware reads an SPI device through the bus-device binding (REAL)', () => {
  const engine = new SpiceEngine();
  let uart: number[];

  beforeAll(async () => {
    await engine.start();
    const core = new Esp32s3Core();
    core.loadFirmware(spiReadImage(0xee)); // RC522 VersionReg read address
    const spec: ClosedLoopSpec = {
      windowS: 200e-6,
      stepS: 1e-6,
      quantumS: 50e-6,
      bindings: [{ pin: 'B5', netId: 'n_vcc' }],
      spiDevices: [{ port: 2, slave: rc522() }],
    };
    await runCosimClosedLoop({ graph: railGraph(), parts, core, spec, engine });
    uart = [...core.drainUart()];
  }, 120_000);

  afterAll(async () => {
    await engine.stop();
  });

  it('installs the SPI device for the run so firmware reads VersionReg = 0x92', () => {
    expect(uart).toContain(0x92);
  });
});
