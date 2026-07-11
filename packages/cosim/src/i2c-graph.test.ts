import { materialize } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { i2cDevicesFromGraph } from './i2c-graph.js';

import type { DesignGraph, OpBody } from '@protopulse/graph';

/**
 * `i2cDevicesFromGraph` resolves every modeled I2C part placed in a design to a
 * co-sim device binding (via the @protopulse/emu registry), so a caller can
 * feed `runCosimClosedLoop` without hand-listing each sensor.
 */

function graphWith(placed: Array<{ id: string; partId: string }>): DesignGraph {
  const ops: OpBody[] = placed.map((p, i) => ({
    kind: 'add_component',
    id: p.id,
    ref: `U${String(i + 1)}`,
    partId: p.partId,
    partRev: 1,
  }));
  return materialize(ops.map((op, i) => ({ actor: 't', lamport: i + 1, ts: 0, op }))).graph;
}

describe('i2cDevicesFromGraph — auto-resolve placed I2C parts to device bindings', () => {
  it('returns a port-0 binding for each modeled I2C part, answering its identity register', () => {
    const graph = graphWith([
      { id: 'u1', partId: 'core:mpu6050' },
      { id: 'u2', partId: 'core:bme280' },
      { id: 'r1', partId: 'core:resistor' }, // not an I2C device — skipped
    ]);
    const devices = i2cDevicesFromGraph(graph);
    expect(devices.length).toBe(2);
    expect(devices.every((d) => d.port === 0)).toBe(true);
    // The address arg is ignored by the register-map model; read each identity.
    const at75 = devices.map((d) => d.slave(0, 0x75));
    const atD0 = devices.map((d) => d.slave(0, 0xd0));
    expect(at75).toContain(0x68); // MPU-6050 WHO_AM_I
    expect(atD0).toContain(0x60); // BME280 chip ID
  });

  it('returns [] when the design has no modeled I2C parts', () => {
    expect(i2cDevicesFromGraph(graphWith([{ id: 'r1', partId: 'core:resistor' }]))).toEqual([]);
  });
});
