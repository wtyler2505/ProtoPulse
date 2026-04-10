import { describe, expect, it } from 'vitest';

import { runPreflight } from '../breadboard-preflight';
import type { PreflightCheck, PreflightInput, PreflightResult } from '../breadboard-preflight';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Factory helpers — minimal mock rows (same pattern as board-audit tests)
// ---------------------------------------------------------------------------

let nextId = 1;

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  const id = overrides.id ?? nextId++;
  return {
    id,
    circuitId: 1,
    partId: null,
    subDesignId: null,
    referenceDesignator: `U${String(id)}`,
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: 100,
    breadboardY: 50,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    benchX: null,
    benchY: null,
    properties: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

function makeNet(
  overrides: Partial<CircuitNetRow> & { segments?: unknown[] } = {},
): CircuitNetRow {
  const id = overrides.id ?? nextId++;
  const { segments, ...rest } = overrides;
  return {
    id,
    circuitId: 1,
    name: `net${String(id)}`,
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: segments ?? [],
    labels: [],
    style: {},
    createdAt: new Date(),
    ...rest,
  } as CircuitNetRow;
}

function makeWire(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
  const id = overrides.id ?? nextId++;
  return {
    id,
    circuitId: 1,
    netId: 1,
    view: 'breadboard',
    points: [],
    layer: 'front',
    width: 1,
    color: null,
    wireType: 'wire',
    createdAt: new Date(),
    ...overrides,
  } as CircuitWireRow;
}

function makePart(
  overrides: Partial<ComponentPart> & { meta?: Record<string, unknown>; connectors?: unknown[] } = {},
): ComponentPart {
  const id = overrides.id ?? nextId++;
  return {
    id,
    projectId: 1,
    nodeId: null,
    meta: overrides.meta ?? {},
    connectors: overrides.connectors ?? [],
    buses: [],
    views: {},
    constraints: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ComponentPart;
}

function makeIcPart(id: number, title = 'ATmega328P', family = 'ic'): ComponentPart {
  return makePart({
    id,
    meta: { family, title },
    connectors: [
      { id: 'VCC', name: 'VCC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
      { id: 'GND', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
      { id: 'D0', name: 'D0', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
      { id: 'D1', name: 'D1', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
    ],
  });
}

function makeCapPart(id: number): ComponentPart {
  return makePart({
    id,
    meta: { family: 'capacitor', title: '100nF' },
    connectors: [
      { id: 'pin-1', name: 'pin-1', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
      { id: 'pin-2', name: 'pin-2', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
    ],
  });
}

function preflight(input: Partial<PreflightInput> = {}): PreflightResult {
  return runPreflight({
    instances: input.instances ?? [],
    wires: input.wires ?? [],
    nets: input.nets ?? [],
    parts: input.parts ?? [],
  });
}

function findCheck(result: PreflightResult, id: string): PreflightCheck | undefined {
  return result.checks.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('breadboard-preflight', () => {
  describe('overallStatus', () => {
    it('passes on empty board', () => {
      const result = preflight();
      expect(result.overallStatus).toBe('pass');
    });

    it('passes with a simple clean board (one IC + one cap)', () => {
      const icPart = makeIcPart(10);
      const capPart = makeCapPart(11);
      const ic = makeInstance({ id: 1, partId: 10 });
      const cap = makeInstance({ id: 2, partId: 11 });
      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 2, toPin: 'pin-1' },
        ],
      });
      const gndNet = makeNet({
        name: 'GND',
        netType: 'ground',
        segments: [
          { fromInstanceId: 1, fromPin: 'GND', toInstanceId: 2, toPin: 'pin-2' },
        ],
      });

      const result = preflight({
        instances: [ic, cap],
        parts: [icPart, capPart],
        nets: [powerNet, gndNet],
      });
      expect(result.overallStatus).toBe('pass');
    });

    it('overall status is fail when any check is fail', () => {
      // Two parts with mismatched operating voltages on shared power net
      const esp32Part = makePart({
        id: 20,
        meta: { family: 'mcu', title: 'ESP32-WROOM', operatingVoltage: 3.3 },
        connectors: [
          { id: 'VCC', name: '3V3', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GND', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const arduinoPart = makePart({
        id: 21,
        meta: { family: 'mcu', title: 'Arduino Uno', operatingVoltage: 5.0 },
        connectors: [
          { id: 'VCC', name: '5V', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GND', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const espInst = makeInstance({ id: 30, partId: 20 });
      const ardInst = makeInstance({ id: 31, partId: 21 });
      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 30, fromPin: 'VCC', toInstanceId: 31, toPin: 'VCC' },
        ],
      });

      const result = preflight({
        instances: [espInst, ardInst],
        parts: [esp32Part, arduinoPart],
        nets: [powerNet],
      });
      expect(result.overallStatus).toBe('fail');
    });

    it('overall status is warn when worst check is warn', () => {
      // IC without decoupling = warn (no fail conditions)
      const icPart = makeIcPart(40, 'ATmega328P', 'ic');
      const ic = makeInstance({ id: 50, partId: 40 });

      const result = preflight({ instances: [ic], parts: [icPart] });
      expect(result.overallStatus).toBe('warn');
    });
  });

  describe('voltage-mismatch check', () => {
    it('detects 3.3V part sharing power net with 5V part', () => {
      const esp32Part = makePart({
        id: 60,
        meta: { family: 'mcu', title: 'ESP32-WROOM', operatingVoltage: 3.3 },
        connectors: [
          { id: 'VCC', name: '3V3', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const unoPart = makePart({
        id: 61,
        meta: { family: 'mcu', title: 'Arduino Uno', operatingVoltage: 5.0 },
        connectors: [
          { id: 'VCC', name: '5V', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const esp = makeInstance({ id: 70, partId: 60 });
      const uno = makeInstance({ id: 71, partId: 61 });
      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 70, fromPin: 'VCC', toInstanceId: 71, toPin: 'VCC' },
        ],
      });

      const result = preflight({
        instances: [esp, uno],
        parts: [esp32Part, unoPart],
        nets: [powerNet],
      });

      const check = findCheck(result, 'voltage-mismatch');
      expect(check).toBeDefined();
      expect(check!.status).toBe('fail');
      expect(check!.detail.length).toBeGreaterThan(0);
      expect(check!.affectedInstanceIds).toContain(70);
      expect(check!.affectedInstanceIds).toContain(71);
    });

    it('passes when all parts share the same operating voltage', () => {
      const p1 = makePart({ id: 80, meta: { family: 'mcu', title: 'RP2040', operatingVoltage: 3.3 } });
      const p2 = makePart({ id: 81, meta: { family: 'ic', title: 'BME280', operatingVoltage: 3.3 } });
      const i1 = makeInstance({ id: 90, partId: 80 });
      const i2 = makeInstance({ id: 91, partId: 81 });
      const net = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 90, fromPin: 'VCC', toInstanceId: 91, toPin: 'VCC' },
        ],
      });

      const result = preflight({ instances: [i1, i2], parts: [p1, p2], nets: [net] });
      expect(findCheck(result, 'voltage-mismatch')!.status).toBe('pass');
    });

    it('passes when no power nets exist', () => {
      const result = preflight();
      expect(findCheck(result, 'voltage-mismatch')!.status).toBe('pass');
    });
  });

  describe('missing-decoupling check', () => {
    it('warns when IC has no nearby decoupling cap', () => {
      const icPart = makeIcPart(100);
      const ic = makeInstance({ id: 110, partId: 100 });

      const result = preflight({ instances: [ic], parts: [icPart] });
      const check = findCheck(result, 'missing-decoupling');
      expect(check).toBeDefined();
      expect(check!.status).toBe('warn');
    });

    it('passes when IC has decoupling cap connected on same power net', () => {
      const icPart = makeIcPart(120);
      const capPart = makeCapPart(121);
      const ic = makeInstance({ id: 130, partId: 120 });
      const cap = makeInstance({ id: 131, partId: 121 });
      const net = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 130, fromPin: 'VCC', toInstanceId: 131, toPin: 'pin-1' },
        ],
      });
      const gndNet = makeNet({
        name: 'GND',
        netType: 'ground',
        segments: [
          { fromInstanceId: 130, fromPin: 'GND', toInstanceId: 131, toPin: 'pin-2' },
        ],
      });

      const result = preflight({
        instances: [ic, cap],
        parts: [icPart, capPart],
        nets: [net, gndNet],
      });
      expect(findCheck(result, 'missing-decoupling')!.status).toBe('pass');
    });

    it('ignores passives — no decoupling warning for resistors', () => {
      const resPart = makePart({
        id: 140,
        meta: { family: 'resistor', title: '10k' },
      });
      const res = makeInstance({ id: 150, partId: 140 });

      const result = preflight({ instances: [res], parts: [resPart] });
      expect(findCheck(result, 'missing-decoupling')!.status).toBe('pass');
    });
  });

  describe('power-budget check', () => {
    it('detects power budget overrun (>500mA on USB rail)', () => {
      const ledPart = makePart({
        id: 200,
        meta: { family: 'led', title: 'Red LED', currentDraw: 20 },
      });
      // 26 LEDs x 20mA = 520mA > 500mA budget
      const leds = Array.from({ length: 26 }, (_, i) =>
        makeInstance({ id: 300 + i, partId: 200 }),
      );

      const result = preflight({ instances: leds, parts: [ledPart] });
      const check = findCheck(result, 'power-budget');
      expect(check).toBeDefined();
      expect(check!.status).toBe('fail');
    });

    it('warns when approaching budget (>400mA)', () => {
      const ledPart = makePart({
        id: 210,
        meta: { family: 'led', title: 'Red LED', currentDraw: 20 },
      });
      // 21 LEDs x 20mA = 420mA — between 400 and 500
      const leds = Array.from({ length: 21 }, (_, i) =>
        makeInstance({ id: 400 + i, partId: 210 }),
      );

      const result = preflight({ instances: leds, parts: [ledPart] });
      expect(findCheck(result, 'power-budget')!.status).toBe('warn');
    });

    it('passes when total draw is within budget', () => {
      const ledPart = makePart({
        id: 220,
        meta: { family: 'led', title: 'Red LED', currentDraw: 20 },
      });
      // 5 LEDs x 20mA = 100mA
      const leds = Array.from({ length: 5 }, (_, i) =>
        makeInstance({ id: 500 + i, partId: 220 }),
      );

      const result = preflight({ instances: leds, parts: [ledPart] });
      expect(findCheck(result, 'power-budget')!.status).toBe('pass');
    });

    it('passes when no parts have currentDraw metadata', () => {
      const icPart = makeIcPart(230);
      const ic = makeInstance({ id: 510, partId: 230 });

      const result = preflight({ instances: [ic], parts: [icPart] });
      // power-budget is 'pass' when no draw is calculable
      expect(findCheck(result, 'power-budget')!.status).not.toBe('fail');
    });
  });

  describe('adc2-wifi-conflict check', () => {
    it('detects ESP32 ADC2 pin usage when WiFi-capable', () => {
      const esp32Part = makePart({
        id: 250,
        meta: { family: 'mcu', title: 'ESP32-WROOM-32' },
        connectors: [
          { id: 'GPIO25', name: 'IO25', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GPIO26', name: 'IO26', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const sensorPart = makePart({
        id: 251,
        meta: { family: 'sensor', title: 'Soil Moisture Sensor' },
        connectors: [
          { id: 'SIG', name: 'SIG', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const esp = makeInstance({ id: 600, partId: 250 });
      const sensor = makeInstance({ id: 601, partId: 251 });
      const sigNet = makeNet({
        name: 'ADC_SIG',
        netType: 'signal',
        segments: [
          { fromInstanceId: 600, fromPin: 'GPIO25', toInstanceId: 601, toPin: 'SIG' },
        ],
      });

      const result = preflight({
        instances: [esp, sensor],
        parts: [esp32Part, sensorPart],
        nets: [sigNet],
      });

      const check = findCheck(result, 'adc2-wifi-conflict');
      expect(check).toBeDefined();
      expect(check!.status).toBe('warn');
    });

    it('passes when no ESP32 parts are present', () => {
      const avr = makePart({ id: 260, meta: { family: 'mcu', title: 'ATmega328P' } });
      const inst = makeInstance({ id: 610, partId: 260 });

      const result = preflight({ instances: [inst], parts: [avr] });
      expect(findCheck(result, 'adc2-wifi-conflict')!.status).toBe('pass');
    });
  });

  describe('unconnected-required-pins check', () => {
    it('warns about IC with VCC or GND pins not connected to any net', () => {
      const icPart = makeIcPart(270);
      const ic = makeInstance({ id: 700, partId: 270 });
      // No nets — VCC and GND are unconnected

      const result = preflight({ instances: [ic], parts: [icPart] });
      const check = findCheck(result, 'unconnected-required-pins');
      expect(check).toBeDefined();
      expect(check!.status).toBe('warn');
      expect(check!.affectedPinIds.length).toBeGreaterThan(0);
    });

    it('passes when all required pins are connected', () => {
      const icPart = makeIcPart(280);
      const ic = makeInstance({ id: 710, partId: 280 });
      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [{ fromInstanceId: 710, fromPin: 'VCC', toInstanceId: 710, toPin: 'VCC' }],
      });
      const gndNet = makeNet({
        name: 'GND',
        netType: 'ground',
        segments: [{ fromInstanceId: 710, fromPin: 'GND', toInstanceId: 710, toPin: 'GND' }],
      });

      const result = preflight({
        instances: [ic],
        parts: [icPart],
        nets: [powerNet, gndNet],
      });
      expect(findCheck(result, 'unconnected-required-pins')!.status).toBe('pass');
    });

    it('ignores passive components for required pins', () => {
      const resPart = makePart({ id: 290, meta: { family: 'resistor', title: '10k' } });
      const res = makeInstance({ id: 720, partId: 290 });

      const result = preflight({ instances: [res], parts: [resPart] });
      expect(findCheck(result, 'unconnected-required-pins')!.status).toBe('pass');
    });
  });

  describe('bench placement coverage', () => {
    it('scans on-bench instances (benchX/Y set, breadboardX/Y null)', () => {
      const icPart = makeIcPart(300);
      const benchInstance = makeInstance({
        id: 800,
        partId: 300,
        breadboardX: null,
        breadboardY: null,
        benchX: 200,
        benchY: 100,
      });

      const result = preflight({ instances: [benchInstance], parts: [icPart] });
      // IC on bench without decoupling should trigger the warn
      expect(findCheck(result, 'missing-decoupling')!.status).toBe('warn');
    });

    it('scans both on-board and on-bench instances together', () => {
      const icPart = makeIcPart(310);
      const onBoard = makeInstance({ id: 810, partId: 310, breadboardX: 100, breadboardY: 50 });
      const onBench = makeInstance({
        id: 811,
        partId: 310,
        breadboardX: null,
        breadboardY: null,
        benchX: 300,
        benchY: 150,
      });

      const result = preflight({ instances: [onBoard, onBench], parts: [icPart] });
      // Two ICs without decoupling
      expect(findCheck(result, 'missing-decoupling')!.status).toBe('warn');
    });
  });

  describe('PreflightResult structure', () => {
    it('always returns all five checks', () => {
      const result = preflight();
      expect(result.checks).toHaveLength(5);
      const ids = result.checks.map((c) => c.id);
      expect(ids).toContain('voltage-mismatch');
      expect(ids).toContain('missing-decoupling');
      expect(ids).toContain('power-budget');
      expect(ids).toContain('adc2-wifi-conflict');
      expect(ids).toContain('unconnected-required-pins');
    });

    it('every check has required fields', () => {
      const result = preflight();
      for (const check of result.checks) {
        expect(check.id).toEqual(expect.any(String));
        expect(check.label).toEqual(expect.any(String));
        expect(check.status).toMatch(/^(pass|warn|fail)$/);
        expect(check.detail).toEqual(expect.any(String));
        expect(Array.isArray(check.affectedInstanceIds)).toBe(true);
        expect(Array.isArray(check.affectedPinIds)).toBe(true);
      }
    });
  });
});
