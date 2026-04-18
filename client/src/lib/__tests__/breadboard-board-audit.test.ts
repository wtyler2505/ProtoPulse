import { beforeEach, describe, expect, it } from 'vitest';
import { VAULT_SLUGS } from '@/lib/circuit-editor/breadboard-constants';

import { auditBreadboard } from '@/lib/breadboard-board-audit';
import type { BoardAuditInput, BoardAuditIssue, BoardAuditSummary } from '@/lib/breadboard-board-audit';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Factory helpers — minimal mock rows
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

function makeNet(overrides: Partial<CircuitNetRow> & { segments?: unknown[] } = {}): CircuitNetRow {
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

function makePart(overrides: Partial<ComponentPart> & { meta?: Record<string, unknown>; connectors?: unknown[] } = {}): ComponentPart {
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

function makeIcPart(id: number, title = 'ATmega328P'): ComponentPart {
  return makePart({
    id,
    meta: { family: 'ic', title },
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

function makeVerifiedEsp32Part(id: number): ComponentPart {
  return makePart({
    id,
    meta: {
      family: 'mcu',
      title: 'NodeMCU ESP32-S',
      verificationStatus: 'verified',
      partFamily: 'board-module',
      mpn: 'nodemcu-esp32s',
    },
    connectors: [
      { id: 'VCC', name: 'VCC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
      { id: 'GND', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
      { id: 'GPIO6', name: 'CLK', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
      { id: 'GPIO25', name: 'IO25', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
      { id: 'GPIO0', name: 'IO0', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
    ],
  });
}

function audit(input: Partial<BoardAuditInput> = {}): BoardAuditSummary {
  return auditBreadboard({
    instances: input.instances ?? [],
    wires: input.wires ?? [],
    nets: input.nets ?? [],
    parts: input.parts ?? [],
  });
}

function issueIds(issues: BoardAuditIssue[]): string[] {
  return issues.map((i) => i.id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auditBreadboard', () => {
  beforeEach(() => {
    nextId = 100;
  });

  // -------------------------------------------------------------------------
  // Empty / clean boards
  // -------------------------------------------------------------------------

  it('returns score 100 for an empty board with no instances', () => {
    const result = audit();
    expect(result.score).toBe(100);
    expect(result.label).toBe('Healthy');
    expect(result.issues).toHaveLength(0);
    expect(result.stats.totalInstances).toBe(0);
  });

  it('returns score 100 when instances are not placed on the breadboard', () => {
    const inst = makeInstance({ breadboardX: null, breadboardY: null, partId: 200 });
    const part = makeIcPart(200);
    const result = audit({ instances: [inst], parts: [part] });
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.stats.totalInstances).toBe(0);
  });

  it('returns score 100 for a well-wired board with decoupling', () => {
    const icPart = makeIcPart(200);
    const capPart = makeCapPart(201);
    const icInstance = makeInstance({ id: 1, partId: 200, breadboardX: 100, breadboardY: 50 });
    const capInstance = makeInstance({
      id: 2,
      partId: 201,
      breadboardX: 100,
      breadboardY: 51,
      referenceDesignator: 'C1',
    });

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

    const result = audit({
      instances: [icInstance, capInstance],
      parts: [icPart, capPart],
      nets: [powerNet, gndNet],
      wires: [makeWire(), makeWire()],
    });

    expect(result.score).toBe(100);
    expect(result.label).toBe('Healthy');
    expect(result.issues).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Check 1: Missing decoupling
  // -------------------------------------------------------------------------

  describe('missing decoupling', () => {
    it('flags IC with no nearby capacitor', () => {
      const icPart = makeIcPart(200);
      const icInstance = makeInstance({ id: 1, partId: 200, breadboardX: 100, breadboardY: 50 });

      const result = audit({
        instances: [icInstance],
        parts: [icPart],
        nets: [
          makeNet({
            name: 'VCC',
            netType: 'power',
            segments: [{ fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 1, toPin: 'VCC' }],
          }),
          makeNet({
            name: 'GND',
            netType: 'ground',
            segments: [{ fromInstanceId: 1, fromPin: 'GND', toInstanceId: 1, toPin: 'GND' }],
          }),
        ],
      });

      expect(result.score).toBeLessThan(100);
      const decouplingIssues = result.issues.filter((i) => i.id.startsWith('missing-decoupling'));
      expect(decouplingIssues).toHaveLength(1);
      expect(decouplingIssues[0].severity).toBe('warning');
      expect(decouplingIssues[0].category).toBe('missing');
      expect(decouplingIssues[0].affectedInstanceIds).toContain(1);
    });

    it('does not flag IC with capacitor within 2 rows', () => {
      const icPart = makeIcPart(200);
      const capPart = makeCapPart(201);
      const icInstance = makeInstance({ id: 1, partId: 200, breadboardX: 100, breadboardY: 50 });
      const capInstance = makeInstance({
        id: 2,
        partId: 201,
        breadboardX: 100,
        breadboardY: 52,
        referenceDesignator: 'C1',
      });

      const result = audit({
        instances: [icInstance, capInstance],
        parts: [icPart, capPart],
      });

      const decouplingIssues = result.issues.filter((i) => i.id.startsWith('missing-decoupling'));
      expect(decouplingIssues).toHaveLength(0);
    });

    it('flags IC when the capacitor is too far away (>2 rows)', () => {
      const icPart = makeIcPart(200);
      const capPart = makeCapPart(201);
      const icInstance = makeInstance({ id: 1, partId: 200, breadboardX: 100, breadboardY: 50 });
      const capInstance = makeInstance({
        id: 2,
        partId: 201,
        breadboardX: 100,
        breadboardY: 60,
        referenceDesignator: 'C1',
      });

      const result = audit({
        instances: [icInstance, capInstance],
        parts: [icPart, capPart],
      });

      const decouplingIssues = result.issues.filter((i) => i.id.startsWith('missing-decoupling'));
      expect(decouplingIssues).toHaveLength(1);
    });

    it('accepts coach-staged support parts as decoupling', () => {
      const icPart = makeIcPart(200);
      const supportPart = makePart({
        id: 201,
        meta: { family: 'resistor', title: '10k pull-up' },
      });
      const icInstance = makeInstance({
        id: 1,
        partId: 200,
        breadboardX: 100,
        breadboardY: 50,
        referenceDesignator: 'U1',
      });
      const supportInstance = makeInstance({
        id: 2,
        partId: 201,
        breadboardX: 100,
        breadboardY: 51,
        referenceDesignator: 'R1',
        properties: { coachPlanFor: 'U1' },
      });

      const result = audit({
        instances: [icInstance, supportInstance],
        parts: [icPart, supportPart],
      });

      const decouplingIssues = result.issues.filter((i) => i.id.startsWith('missing-decoupling'));
      expect(decouplingIssues).toHaveLength(0);
    });

    it('does not flag resistors or passives', () => {
      const resPart = makePart({
        id: 200,
        meta: { family: 'resistor', title: '220R' },
      });
      const resInstance = makeInstance({ id: 1, partId: 200 });

      const result = audit({
        instances: [resInstance],
        parts: [resPart],
      });

      const decouplingIssues = result.issues.filter((i) => i.id.startsWith('missing-decoupling'));
      expect(decouplingIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Check 2: Restricted pin usage
  // -------------------------------------------------------------------------

  describe('restricted pin usage', () => {
    it('flags wires connected to restricted pins on verified boards', () => {
      const espPart = makeVerifiedEsp32Part(200);
      const espInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      const net = makeNet({
        segments: [
          { fromInstanceId: 1, fromPin: 'gpio6', toInstanceId: 99, toPin: 'D0' },
        ],
      });

      const result = audit({
        instances: [espInstance],
        parts: [espPart],
        nets: [net],
      });

      const restrictedIssues = result.issues.filter((i) => i.id.startsWith('restricted-pin'));
      expect(restrictedIssues).toHaveLength(1);
      expect(restrictedIssues[0].severity).toBe('critical');
      expect(restrictedIssues[0].category).toBe('safety');
    });

    it('does not flag non-restricted pins', () => {
      const espPart = makeVerifiedEsp32Part(200);
      const espInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      const net = makeNet({
        segments: [
          { fromInstanceId: 1, fromPin: 'gpio25', toInstanceId: 99, toPin: 'D0' },
        ],
      });

      const result = audit({
        instances: [espInstance],
        parts: [espPart],
        nets: [net],
      });

      const restrictedIssues = result.issues.filter((i) => i.id.startsWith('restricted-pin'));
      expect(restrictedIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Check 3: Strapping pin signal routing
  // -------------------------------------------------------------------------

  describe('strapping pin conflicts', () => {
    it('flags non-power signal on a boot strapping pin', () => {
      const espPart = makeVerifiedEsp32Part(200);
      const espInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      // GPIO0 is a boot strapping pin on ESP32
      const signalNet = makeNet({
        name: 'sensor_data',
        netType: 'signal',
        segments: [
          { fromInstanceId: 1, fromPin: 'gpio0', toInstanceId: 99, toPin: 'D0' },
        ],
      });

      const result = audit({
        instances: [espInstance],
        parts: [espPart],
        nets: [signalNet],
      });

      const strappingIssues = result.issues.filter((i) => i.id.startsWith('strapping-pin'));
      expect(strappingIssues).toHaveLength(1);
      expect(strappingIssues[0].severity).toBe('warning');
      expect(strappingIssues[0].category).toBe('safety');
    });

    it('does not flag power nets on boot pins', () => {
      const espPart = makeVerifiedEsp32Part(200);
      const espInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'gpio0', toInstanceId: 99, toPin: 'VCC' },
        ],
      });

      const result = audit({
        instances: [espInstance],
        parts: [espPart],
        nets: [powerNet],
      });

      const strappingIssues = result.issues.filter((i) => i.id.startsWith('strapping-pin'));
      expect(strappingIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Check 4: ADC2 WiFi conflict
  // -------------------------------------------------------------------------

  describe('ADC2 WiFi conflict', () => {
    it('warns when ADC2 pins are wired on an ESP32', () => {
      const espPart = makeVerifiedEsp32Part(200);
      const espInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      // GPIO25 is ADC2_CH8 on ESP32 — unavailable when WiFi active
      const net = makeNet({
        segments: [
          { fromInstanceId: 1, fromPin: 'gpio25', toInstanceId: 99, toPin: 'A0' },
        ],
      });

      const result = audit({
        instances: [espInstance],
        parts: [espPart],
        nets: [net],
      });

      const adcIssues = result.issues.filter((i) => i.id.startsWith('adc2-wifi'));
      expect(adcIssues).toHaveLength(1);
      expect(adcIssues[0].severity).toBe('warning');
      expect(adcIssues[0].category).toBe('signal');
    });

    it('does not warn for ADC1 pins', () => {
      const espPart = makeVerifiedEsp32Part(200);
      const espInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      // GPIO36 is ADC1_CH0 — no WiFi conflict
      const net = makeNet({
        segments: [
          { fromInstanceId: 1, fromPin: 'gpio36', toInstanceId: 99, toPin: 'A0' },
        ],
      });

      const result = audit({
        instances: [espInstance],
        parts: [espPart],
        nets: [net],
      });

      const adcIssues = result.issues.filter((i) => i.id.startsWith('adc2-wifi'));
      expect(adcIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Check 5: Missing ground return
  // -------------------------------------------------------------------------

  describe('missing ground return', () => {
    it('flags a part with power connected but no ground', () => {
      const icPart = makeIcPart(200);
      const icInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 99, toPin: 'VCC' },
        ],
      });

      const result = audit({
        instances: [icInstance],
        parts: [icPart],
        nets: [powerNet],
      });

      const groundIssues = result.issues.filter((i) => i.id.startsWith('missing-ground'));
      expect(groundIssues).toHaveLength(1);
      expect(groundIssues[0].severity).toBe('critical');
      expect(groundIssues[0].category).toBe('power');
    });

    it('does not flag a part with both power and ground connected', () => {
      const icPart = makeIcPart(200);
      const icInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 99, toPin: 'VCC' },
        ],
      });
      const gndNet = makeNet({
        name: 'GND',
        netType: 'ground',
        segments: [
          { fromInstanceId: 1, fromPin: 'GND', toInstanceId: 99, toPin: 'GND' },
        ],
      });

      const result = audit({
        instances: [icInstance],
        parts: [icPart],
        nets: [powerNet, gndNet],
      });

      const groundIssues = result.issues.filter((i) => i.id.startsWith('missing-ground'));
      expect(groundIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // checkMissingGroundReturn message format (audit #289)
  // -------------------------------------------------------------------------

  describe('checkMissingGroundReturn message format (audit #289)', () => {
    it('includes "name (id)" when pin name differs from pin id', () => {
      // Part where ground pin has id="pin-2" but name="GND" — distinct values.
      const part = makePart({
        id: 300,
        meta: { family: 'ic', title: 'TestIC' },
        connectors: [
          { id: 'VCC', name: 'VCC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'pin-2', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const inst = makeInstance({ id: 300, partId: 300, referenceDesignator: 'U300' });

      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [{ fromInstanceId: 300, fromPin: 'VCC', toInstanceId: 99, toPin: 'VCC' }],
      });

      const result = audit({ instances: [inst], parts: [part], nets: [powerNet] });

      const groundIssues = result.issues.filter((i) => i.id.startsWith('missing-ground'));
      expect(groundIssues).toHaveLength(1);
      expect(groundIssues[0].detail).toContain('GND (pin-2)');
    });

    it('shows name only (no redundant parens) when pin name equals pin id', () => {
      // Part where ground pin has id="GND" and name="GND" — same values.
      const part = makePart({
        id: 301,
        meta: { family: 'ic', title: 'TestIC2' },
        connectors: [
          { id: 'VCC', name: 'VCC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GND', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const inst = makeInstance({ id: 301, partId: 301, referenceDesignator: 'U301' });

      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [{ fromInstanceId: 301, fromPin: 'VCC', toInstanceId: 99, toPin: 'VCC' }],
      });

      const result = audit({ instances: [inst], parts: [part], nets: [powerNet] });

      const groundIssues = result.issues.filter((i) => i.id.startsWith('missing-ground'));
      expect(groundIssues).toHaveLength(1);
      // Should contain "GND" but NOT "GND (GND)" — no redundant parens.
      expect(groundIssues[0].detail).toContain('GND');
      expect(groundIssues[0].detail).not.toContain('GND (GND)');
    });

    it('includes both name-id pairs when a part has 2 missing ground pins', () => {
      // Part with two distinct ground pins: id="pin-2"/name="GND" and id="pin-4"/name="AGND".
      // Both names match the isGroundConnector heuristic; IDs differ from names.
      const part = makePart({
        id: 302,
        meta: { family: 'ic', title: 'DualGndIC' },
        connectors: [
          { id: 'VCC', name: 'VCC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'pin-2', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'pin-4', name: 'AGND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const inst = makeInstance({ id: 302, partId: 302, referenceDesignator: 'U302' });

      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [{ fromInstanceId: 302, fromPin: 'VCC', toInstanceId: 99, toPin: 'VCC' }],
      });

      const result = audit({ instances: [inst], parts: [part], nets: [powerNet] });

      const groundIssues = result.issues.filter((i) => i.id.startsWith('missing-ground'));
      expect(groundIssues).toHaveLength(1);
      expect(groundIssues[0].detail).toContain('GND (pin-2)');
      expect(groundIssues[0].detail).toContain('AGND (pin-4)');
    });
  });

  // -------------------------------------------------------------------------
  // Check 6: Wire density hotspots
  // -------------------------------------------------------------------------

  describe('wire density hotspots', () => {
    it('flags congested row bands with >8 wire endpoints', () => {
      // Create 6 instances all on the same breadboard row (row 50).
      // Then create 5 nets connecting consecutive pairs, giving 10 endpoints
      // all mapped to row 50 — well above the 8-endpoint threshold.
      const instances: CircuitInstanceRow[] = [];
      for (let i = 0; i < 6; i++) {
        instances.push(makeInstance({
          id: 50 + i,
          breadboardX: 100 + i * 15,
          breadboardY: 50,
          referenceDesignator: `J${String(i)}`,
        }));
      }

      const segments: Array<{ fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string }> = [];
      for (let i = 0; i < 5; i++) {
        segments.push({
          fromInstanceId: 50 + i,
          fromPin: 'pin-1',
          toInstanceId: 50 + i + 1,
          toPin: 'pin-2',
        });
      }

      const net = makeNet({ segments });

      const result = audit({ instances, nets: [net] });

      const densityIssues = result.issues.filter((i) => i.id.startsWith('wire-density'));
      expect(densityIssues.length).toBeGreaterThanOrEqual(1);
      expect(densityIssues[0].severity).toBe('info');
      expect(densityIssues[0].category).toBe('layout');
    });

    it('does not flag sparse wiring', () => {
      const inst1 = makeInstance({ id: 1, breadboardX: 100, breadboardY: 10 });
      const inst2 = makeInstance({ id: 2, breadboardX: 100, breadboardY: 80 });

      const net = makeNet({
        segments: [{ fromInstanceId: 1, fromPin: 'pin-1', toInstanceId: 2, toPin: 'pin-2' }],
      });

      const result = audit({ instances: [inst1, inst2], nets: [net] });

      const densityIssues = result.issues.filter((i) => i.id.startsWith('wire-density'));
      expect(densityIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Check 7: Unconnected power pins
  // -------------------------------------------------------------------------

  describe('unconnected power pins', () => {
    it('flags IC with no power or ground wires at all', () => {
      const icPart = makeIcPart(200);
      const icInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      const result = audit({
        instances: [icInstance],
        parts: [icPart],
        nets: [],
      });

      const unconnectedIssues = result.issues.filter((i) => i.id.startsWith('unconnected-power'));
      expect(unconnectedIssues).toHaveLength(1);
      expect(unconnectedIssues[0].severity).toBe('warning');
      expect(unconnectedIssues[0].category).toBe('power');
    });

    it('does not flag IC when at least one power pin is connected', () => {
      const icPart = makeIcPart(200);
      const icInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      const net = makeNet({
        name: 'VCC',
        segments: [
          { fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 99, toPin: 'VCC' },
        ],
      });

      const result = audit({
        instances: [icInstance],
        parts: [icPart],
        nets: [net],
      });

      const unconnectedIssues = result.issues.filter((i) => i.id.startsWith('unconnected-power'));
      expect(unconnectedIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Scoring behavior
  // -------------------------------------------------------------------------

  describe('scoring', () => {
    it('each critical issue deducts 15 points', () => {
      const icPart = makeIcPart(200);
      const icInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });

      // Power connected, no ground → critical (-15)
      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 99, toPin: 'VCC' },
        ],
      });

      const result = audit({
        instances: [icInstance],
        parts: [icPart],
        nets: [powerNet],
      });

      const criticalCount = result.issues.filter((i) => i.severity === 'critical').length;
      const warningCount = result.issues.filter((i) => i.severity === 'warning').length;
      const infoCount = result.issues.filter((i) => i.severity === 'info').length;
      const expectedScore = Math.max(0, 100 - criticalCount * 15 - warningCount * 8 - infoCount * 3);
      expect(result.score).toBe(expectedScore);
    });

    it('score floors at 0 with many issues', () => {
      // Create 10 ICs with no decoupling, no power — lots of issues
      const instances: CircuitInstanceRow[] = [];
      const parts: ComponentPart[] = [];
      for (let i = 0; i < 10; i++) {
        const partId = 200 + i;
        parts.push(makeIcPart(partId));
        instances.push(makeInstance({
          id: 10 + i,
          partId,
          breadboardX: 100 + i * 20,
          breadboardY: 50,
          referenceDesignator: `U${String(i)}`,
        }));
      }

      const result = audit({ instances, parts });

      expect(result.score).toBe(0);
      expect(result.label).toBe('Critical');
    });

    it('issues are sorted by severity: critical first, then warning, then info', () => {
      const icPart = makeIcPart(200);
      const espPart = makeVerifiedEsp32Part(201);
      const icInstance = makeInstance({ id: 1, partId: 200, referenceDesignator: 'U1' });
      const espInstance = makeInstance({ id: 2, partId: 201, referenceDesignator: 'U2' });

      // Power without ground on IC → critical
      // Restricted pin on ESP32 → critical
      // Missing decoupling on both → warning x2
      const powerNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 1, fromPin: 'VCC', toInstanceId: 99, toPin: 'VCC' },
        ],
      });
      const restrictedNet = makeNet({
        segments: [
          { fromInstanceId: 2, fromPin: 'gpio6', toInstanceId: 99, toPin: 'D0' },
        ],
      });

      const result = audit({
        instances: [icInstance, espInstance],
        parts: [icPart, espPart],
        nets: [powerNet, restrictedNet],
      });

      // Verify issues are sorted: all criticals before all warnings
      let sawWarning = false;
      for (const issue of result.issues) {
        if (issue.severity === 'warning') {
          sawWarning = true;
        }
        if (issue.severity === 'critical' && sawWarning) {
          throw new Error('Critical issue found after a warning — sort order is wrong');
        }
      }

      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Stats tracking
  // -------------------------------------------------------------------------

  describe('stats', () => {
    it('counts affected instances correctly', () => {
      const icPart = makeIcPart(200);
      const ic1 = makeInstance({ id: 1, partId: 200, breadboardY: 50, referenceDesignator: 'U1' });
      const ic2 = makeInstance({ id: 2, partId: 200, breadboardY: 70, referenceDesignator: 'U2' });

      const result = audit({
        instances: [ic1, ic2],
        parts: [icPart],
      });

      // Both ICs should have issues (missing decoupling, unconnected power)
      expect(result.stats.instancesWithIssues).toBe(2);
      expect(result.stats.totalInstances).toBe(2);
    });

    it('tracks wire count from input', () => {
      const wires = [makeWire(), makeWire(), makeWire()];
      const result = audit({ wires });

      expect(result.stats.totalWires).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Motor controller audit checks
  // -------------------------------------------------------------------------

  describe('motor controller checks', () => {
    function makeMotorDriverPart(id: number, title: string): ComponentPart {
      return makePart({
        id,
        meta: { family: 'driver', title },
        connectors: [
          { id: 'EN', name: 'EN', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'PWM', name: 'PWM', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'VCC', name: 'VCC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GND', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
    }

    function makeBldcDriverPart(id: number): ComponentPart {
      return makePart({
        id,
        meta: { family: 'driver', title: 'RioRand BLDC Controller' },
        connectors: [
          { id: 'STOP', name: 'STOP', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'BRAKE', name: 'BRAKE', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'PWM', name: 'PWM', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'HA', name: 'HA', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'HB', name: 'HB', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'HC', name: 'HC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'VCC', name: 'VCC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GND', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
    }

    it('flags BLDC driver with STOP/BRAKE polarity advisory', () => {
      const driverPart = makeBldcDriverPart(500);
      const driver = makeInstance({ id: 600, partId: 500 });

      const result = audit({ instances: [driver], parts: [driverPart] });
      const motorIssue = result.issues.find((i) => i.id.includes('motor-bldc-polarity'));
      expect(motorIssue).toBeDefined();
      expect(motorIssue!.severity).toBe('warning');
      expect(motorIssue!.category).toBe('safety');
    });

    it('flags H-bridge driver with back-EMF advisory', () => {
      const driverPart = makeMotorDriverPart(510, 'L298N H-Bridge');
      const driver = makeInstance({ id: 610, partId: 510 });

      const result = audit({ instances: [driver], parts: [driverPart] });
      const emfIssue = result.issues.find((i) => i.id.includes('motor-back-emf'));
      expect(emfIssue).toBeDefined();
      expect(emfIssue!.severity).toBe('warning');
    });

    it('does not flag non-motor drivers', () => {
      const ledDriverPart = makePart({
        id: 520,
        meta: { family: 'driver', title: 'WS2812B LED Driver' },
        connectors: [
          { id: 'DIN', name: 'DIN', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
      const led = makeInstance({ id: 620, partId: 520 });

      const result = audit({ instances: [led], parts: [ledDriverPart] });
      const motorIssues = result.issues.filter((i) => i.id.includes('motor-'));
      expect(motorIssues).toHaveLength(0);
    });

    it('does not flag passive components as motor drivers', () => {
      const resPart = makePart({
        id: 530,
        meta: { family: 'resistor', title: '10k Resistor' },
      });
      const res = makeInstance({ id: 630, partId: 530 });

      const result = audit({ instances: [res], parts: [resPart] });
      const motorIssues = result.issues.filter((i) => i.id.includes('motor-'));
      expect(motorIssues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Check 9: Heuristic ESP32 restricted-pin fallback (audit #241, #256)
  // -------------------------------------------------------------------------

  describe('checkHeuristicEsp32RestrictedPins (audit #241, #256)', () => {
    /** Build a minimal unverified ESP32 part with the given title. */
    function makeHeuristicEsp32Part(id: number, title: string): ComponentPart {
      return makePart({
        id,
        meta: { family: 'mcu', title },
        connectors: [],
      });
    }

    /** Build a verified ESP32 part (has a recognized alias so heuristic skips it). */
    function makeVerifiedEsp32PartLocal(id: number): ComponentPart {
      return makePart({
        id,
        meta: {
          family: 'mcu',
          title: 'NodeMCU ESP32-S',
          verificationStatus: 'verified',
          partFamily: 'board-module',
          mpn: 'nodemcu-esp32s',
        },
        connectors: [],
      });
    }

    /** Build a single-wire audit input for one instance + one pin connection. */
    function makeEsp32AuditInput(
      partId: number,
      part: ComponentPart,
      pinLabel: string,
    ): Parameters<typeof audit>[0] {
      const instance = makeInstance({ id: 700, partId, breadboardX: 50, breadboardY: 50 });
      const net = makeNet({
        segments: [{ fromInstanceId: 700, fromPin: pinLabel, toInstanceId: 999, toPin: 'D0' }],
      });
      return { instances: [instance], parts: [part], nets: [net] };
    }

    it.each([
      // positive cases — should fire
      ['ESP32 dev module', 'GPIO6', 'critical', VAULT_SLUGS.ESP32_GPIO6_11_FLASH],
      ['ESP32 dev module', 'GPIO11', 'critical', VAULT_SLUGS.ESP32_GPIO6_11_FLASH],
      ['ESP32 dev module', 'GPIO12', 'critical', VAULT_SLUGS.ESP32_GPIO12_STRAPPING],
      ['ESP32 dev module', 'GPIO5', 'warning', VAULT_SLUGS.ESP32_GPIO5_STRAPPING],
      ['ESP32 dev module', 'GPIO0', 'warning', VAULT_SLUGS.ESP32_GPIO5_STRAPPING],
      // numeric-label variants
      ['ESP32 module', 'IO12', 'critical', VAULT_SLUGS.ESP32_GPIO12_STRAPPING],
      ['ESP32 board', 'D12', 'critical', VAULT_SLUGS.ESP32_GPIO12_STRAPPING],
    ] as const)(
      'title="%s" pin="%s" → severity=%s, remediationLink=%s',
      (title, pinLabel, expectedSeverity, expectedSlug) => {
        const part = makeHeuristicEsp32Part(701, title);
        const input = makeEsp32AuditInput(701, part, pinLabel);
        const result = audit(input);

        const heuristicIssues = result.issues.filter((i) => i.id.startsWith('heuristic-esp32'));
        expect(heuristicIssues).toHaveLength(1);
        expect(heuristicIssues[0].severity).toBe(expectedSeverity);
        expect(heuristicIssues[0].category).toBe('safety');
        expect(heuristicIssues[0].remediationLink).toBe(expectedSlug);
      },
    );

    it('does not fire for truly safe pin GPIO23 on heuristic ESP32', () => {
      const part = makeHeuristicEsp32Part(702, 'ESP32 dev module');
      const input = makeEsp32AuditInput(702, part, 'GPIO23');
      const result = audit(input);
      const heuristicIssues = result.issues.filter((i) => i.id.startsWith('heuristic-esp32'));
      expect(heuristicIssues).toHaveLength(0);
    });

    it.each([
      ['GPIO34', VAULT_SLUGS.ESP32_GPIO34_39_INPUT],
      ['GPIO35', VAULT_SLUGS.ESP32_GPIO34_39_INPUT],
      ['GPIO36', VAULT_SLUGS.ESP32_GPIO34_39_INPUT],
      ['GPIO37', VAULT_SLUGS.ESP32_GPIO34_39_INPUT],
      ['GPIO38', VAULT_SLUGS.ESP32_GPIO34_39_INPUT],
      ['GPIO39', VAULT_SLUGS.ESP32_GPIO34_39_INPUT],
    ])('flags input-only pin %s with the 34-39 vault slug', (pinLabel, slug) => {
      const part = makeHeuristicEsp32Part(720, 'ESP32 dev module');
      const input = makeEsp32AuditInput(720, part, pinLabel);
      const result = audit(input);
      const issue = result.issues.find((i) => i.id.startsWith('heuristic-esp32-input-only'));
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('warning');
      expect(issue!.remediationLink).toBe(slug);
      expect(issue!.detail.toLowerCase()).toMatch(/input[- ]only|no.*pull/);
    });

    it.each([
      ['GPIO2', 'gpio2'],
      ['IO2', 'gpio2'],
      ['GPIO15', 'gpio15'],
      ['IO15', 'gpio15'],
    ])('flags strapping pin %s with warning severity', (pinLabel, idFragment) => {
      const part = makeHeuristicEsp32Part(730, 'ESP32 dev module');
      const input = makeEsp32AuditInput(730, part, pinLabel);
      const result = audit(input);
      const issue = result.issues.find((i) => i.id.startsWith(`heuristic-esp32-${idFragment}`));
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('warning');
      expect(issue!.category).toBe('safety');
    });

    it('emits an info advisory for unknown ESP32 variant (audit #241 conservative fallback)', () => {
      // "ESP32" with no recognized variant suffix — triggers the unknown-variant advisory.
      const part = makeHeuristicEsp32Part(740, 'ESP32');
      const input = makeEsp32AuditInput(740, part, 'GPIO23');
      const result = audit(input);
      const advisory = result.issues.find((i) =>
        i.id.startsWith('heuristic-esp32-unknown-variant'),
      );
      expect(advisory).toBeDefined();
      expect(advisory!.severity).toBe('info');
      expect(advisory!.remediationLink).toBe(VAULT_SLUGS.ESP32_SAFE_PINS);
    });

    it('does NOT emit unknown-variant advisory for a recognized ESP32-WROOM title', () => {
      const part = makeHeuristicEsp32Part(741, 'ESP32-WROOM-32');
      const input = makeEsp32AuditInput(741, part, 'GPIO23');
      const result = audit(input);
      const advisory = result.issues.find((i) =>
        i.id.startsWith('heuristic-esp32-unknown-variant'),
      );
      expect(advisory).toBeUndefined();
    });

    it('does not fire for ESP8266 (sibling exclusion)', () => {
      const part = makeHeuristicEsp32Part(703, 'ESP8266 dev');
      const input = makeEsp32AuditInput(703, part, 'GPIO6');
      const result = audit(input);
      const heuristicIssues = result.issues.filter((i) => i.id.startsWith('heuristic-esp32'));
      expect(heuristicIssues).toHaveLength(0);
    });

    it('does not fire for generic MCU that is not ESP32', () => {
      const part = makeHeuristicEsp32Part(704, 'Generic uC');
      const input = makeEsp32AuditInput(704, part, 'GPIO12');
      const result = audit(input);
      const heuristicIssues = result.issues.filter((i) => i.id.startsWith('heuristic-esp32'));
      expect(heuristicIssues).toHaveLength(0);
    });

    it('does not fire when verified-boards profile matches (verified path is authoritative)', () => {
      const part = makeVerifiedEsp32PartLocal(705);
      const input = makeEsp32AuditInput(705, part, 'GPIO12');
      const result = audit(input);
      const heuristicIssues = result.issues.filter((i) => i.id.startsWith('heuristic-esp32'));
      expect(heuristicIssues).toHaveLength(0);
    });

    it('GPIO12 detail mentions hardware damage risk', () => {
      const part = makeHeuristicEsp32Part(706, 'ESP32 dev module');
      const input = makeEsp32AuditInput(706, part, 'GPIO12');
      const result = audit(input);
      const issue = result.issues.find((i) => i.id.startsWith('heuristic-esp32-gpio12'));
      expect(issue).toBeDefined();
      expect(issue!.detail.toLowerCase()).toMatch(/hardware damage/);
    });
  });

  // -------------------------------------------------------------------------
  // checkStrappingPinConflicts net classification (audit #283)
  // -------------------------------------------------------------------------

  describe('checkStrappingPinConflicts net classification (audit #283)', () => {
    /**
     * Build a verified ESP32 part suitable for strapping-pin checks.
     * Uses the nodemcu-esp32s alias so verified-boards resolves it and
     * bootPins are populated.
     */
    function makeEsp32Part(id: number): ComponentPart {
      return makePart({
        id,
        meta: {
          family: 'mcu',
          title: 'NodeMCU ESP32-S',
          verificationStatus: 'verified',
          partFamily: 'board-module',
          mpn: 'nodemcu-esp32s',
        },
        connectors: [
          { id: 'VCC', name: 'VCC', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GND', name: 'GND', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GPIO0', name: 'IO0', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GPIO12', name: 'IO12', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'GPIO2', name: 'IO2', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
    }

    function makeResistorPart(id: number, value = '10k'): ComponentPart {
      return makePart({
        id,
        meta: { family: 'resistor', title: `${value} pull-up resistor` },
        connectors: [
          { id: 'pin-1', name: 'pin-1', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'pin-2', name: 'pin-2', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
    }

    function makeButtonPart(id: number): ComponentPart {
      return makePart({
        id,
        meta: { family: 'switch', title: 'Tactile Push Button' },
        connectors: [
          { id: 'pin-1', name: 'pin-1', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
          { id: 'pin-2', name: 'pin-2', connectorType: 'pad', shapeIds: {}, terminalPositions: {} },
        ],
      });
    }

    /**
     * Case 1: GPIO0 wired directly to another MCU digital output → FIRES.
     * Signal net: esp32.gpio0 ↔ otherMcu.D0
     */
    it('fires when GPIO0 is connected directly to an MCU digital output', () => {
      const esp32Part = makeEsp32Part(800);
      const mcuPart = makeIcPart(801, 'ATmega328P');

      const esp32Inst = makeInstance({ id: 810, partId: 800, referenceDesignator: 'U10' });
      const mcuInst = makeInstance({ id: 811, partId: 801, referenceDesignator: 'U11' });

      // Direct signal wire: GPIO0 → MCU output pin
      const signalNet = makeNet({
        name: 'gpio0_signal',
        netType: 'signal',
        segments: [
          { fromInstanceId: 810, fromPin: 'gpio0', toInstanceId: 811, toPin: 'D0' },
        ],
      });

      const result = audit({
        instances: [esp32Inst, mcuInst],
        parts: [esp32Part, mcuPart],
        nets: [signalNet],
      });

      const strappingIssues = result.issues.filter((i) => i.id.startsWith('strapping-pin'));
      expect(strappingIssues).toHaveLength(1);
      expect(strappingIssues[0].severity).toBe('warning');
      expect(strappingIssues[0].category).toBe('safety');
    });

    /**
     * Case 2: GPIO0 wired through 10kΩ resistor to 3V3 rail → DOES NOT FIRE.
     * Net A (signal): esp32.gpio0 ↔ R1.pin-1
     * Net B (power): R1.pin-2 ↔ VCC-rail (netType='power')
     */
    it('does NOT fire when GPIO0 is connected through a resistor to VCC (pull-up)', () => {
      const esp32Part = makeEsp32Part(800);
      const resPart = makeResistorPart(802);

      const esp32Inst = makeInstance({ id: 810, partId: 800, referenceDesignator: 'U10' });
      const resInst = makeInstance({ id: 812, partId: 802, referenceDesignator: 'R1' });

      // Signal net: GPIO0 → R1.pin-1
      const signalNet = makeNet({
        name: 'gpio0_pullup',
        netType: 'signal',
        segments: [
          { fromInstanceId: 810, fromPin: 'gpio0', toInstanceId: 812, toPin: 'pin-1' },
        ],
      });

      // Power net: R1.pin-2 → VCC rail
      const vccNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 812, fromPin: 'pin-2', toInstanceId: 999, toPin: 'VCC' },
        ],
      });

      const result = audit({
        instances: [esp32Inst, resInst],
        parts: [esp32Part, resPart],
        nets: [signalNet, vccNet],
      });

      const strappingIssues = result.issues.filter((i) => i.id.startsWith('strapping-pin'));
      expect(strappingIssues).toHaveLength(0);
    });

    /**
     * Case 3: GPIO0 wired through 10kΩ resistor to GND (pull-down) → DOES NOT FIRE.
     * Net A (signal): esp32.gpio0 ↔ R1.pin-1
     * Net B (ground): R1.pin-2 ↔ GND rail
     */
    it('does NOT fire when GPIO0 is connected through a resistor to GND (pull-down)', () => {
      const esp32Part = makeEsp32Part(800);
      const resPart = makeResistorPart(802);

      const esp32Inst = makeInstance({ id: 810, partId: 800, referenceDesignator: 'U10' });
      const resInst = makeInstance({ id: 812, partId: 802, referenceDesignator: 'R1' });

      const signalNet = makeNet({
        name: 'gpio0_pulldown',
        netType: 'signal',
        segments: [
          { fromInstanceId: 810, fromPin: 'gpio0', toInstanceId: 812, toPin: 'pin-1' },
        ],
      });

      const gndNet = makeNet({
        name: 'GND',
        netType: 'ground',
        segments: [
          { fromInstanceId: 812, fromPin: 'pin-2', toInstanceId: 999, toPin: 'GND' },
        ],
      });

      const result = audit({
        instances: [esp32Inst, resInst],
        parts: [esp32Part, resPart],
        nets: [signalNet, gndNet],
      });

      const strappingIssues = result.issues.filter((i) => i.id.startsWith('strapping-pin'));
      expect(strappingIssues).toHaveLength(0);
    });

    /**
     * Case 4: GPIO0 wired to a reset button (button → resistor → VCC, button → pin)
     * → DOES NOT FIRE (passive path to VCC through switch+resistor).
     *
     * Net A (signal): esp32.gpio0 ↔ SW1.pin-1
     * Net B (signal): SW1.pin-2 ↔ R1.pin-1
     * Net C (power): R1.pin-2 ↔ VCC
     *
     * A switch is treated as a passive for classification purposes.
     */
    it('does NOT fire when GPIO0 is connected through a reset button + pull-up resistor to VCC', () => {
      const esp32Part = makeEsp32Part(800);
      const buttonPart = makeButtonPart(803);
      const resPart = makeResistorPart(804);

      const esp32Inst = makeInstance({ id: 810, partId: 800, referenceDesignator: 'U10' });
      const buttonInst = makeInstance({ id: 813, partId: 803, referenceDesignator: 'SW1' });
      const resInst = makeInstance({ id: 814, partId: 804, referenceDesignator: 'R2' });

      // GPIO0 → button.pin-1
      const signalNet = makeNet({
        name: 'gpio0_btn',
        netType: 'signal',
        segments: [
          { fromInstanceId: 810, fromPin: 'gpio0', toInstanceId: 813, toPin: 'pin-1' },
        ],
      });

      // button.pin-2 → R2.pin-1 (intermediate passive link)
      const midNet = makeNet({
        name: 'btn_res_link',
        netType: 'signal',
        segments: [
          { fromInstanceId: 813, fromPin: 'pin-2', toInstanceId: 814, toPin: 'pin-1' },
        ],
      });

      // R2.pin-2 → VCC
      const vccNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 814, fromPin: 'pin-2', toInstanceId: 999, toPin: 'VCC' },
        ],
      });

      const result = audit({
        instances: [esp32Inst, buttonInst, resInst],
        parts: [esp32Part, buttonPart, resPart],
        nets: [signalNet, midNet, vccNet],
      });

      const strappingIssues = result.issues.filter((i) => i.id.startsWith('strapping-pin'));
      expect(strappingIssues).toHaveLength(0);
    });

    /**
     * Case 5: GPIO0 connected to pull-up resistor to VCC AND to another MCU output pin.
     * Active source wins → FIRES.
     *
     * Net A (signal): esp32.gpio0 ↔ R1.pin-1  AND  esp32.gpio0 ↔ otherMcu.D0
     */
    it('fires when GPIO0 has both a pull-up resistor AND an active MCU output', () => {
      const esp32Part = makeEsp32Part(800);
      const mcuPart = makeIcPart(801, 'ATmega328P');
      const resPart = makeResistorPart(802);

      const esp32Inst = makeInstance({ id: 810, partId: 800, referenceDesignator: 'U10' });
      const mcuInst = makeInstance({ id: 811, partId: 801, referenceDesignator: 'U11' });
      const resInst = makeInstance({ id: 812, partId: 802, referenceDesignator: 'R1' });

      // Mixed net: GPIO0 ↔ R1.pin-1 AND GPIO0 ↔ MCU.D0 (two segments on same net)
      const mixedNet = makeNet({
        name: 'gpio0_mixed',
        netType: 'signal',
        segments: [
          { fromInstanceId: 810, fromPin: 'gpio0', toInstanceId: 812, toPin: 'pin-1' },
          { fromInstanceId: 810, fromPin: 'gpio0', toInstanceId: 811, toPin: 'D0' },
        ],
      });

      // Power net: R1.pin-2 → VCC (pull-up exists but shouldn't suppress warning)
      const vccNet = makeNet({
        name: 'VCC',
        netType: 'power',
        segments: [
          { fromInstanceId: 812, fromPin: 'pin-2', toInstanceId: 999, toPin: 'VCC' },
        ],
      });

      const result = audit({
        instances: [esp32Inst, mcuInst, resInst],
        parts: [esp32Part, mcuPart, resPart],
        nets: [mixedNet, vccNet],
      });

      const strappingIssues = result.issues.filter((i) => i.id.startsWith('strapping-pin'));
      expect(strappingIssues).toHaveLength(1);
      expect(strappingIssues[0].severity).toBe('warning');
    });

    /**
     * Case 6: GPIO12 wired through a capacitor to GND (bypass/filter cap) → DOES NOT FIRE.
     * Capacitor is a passive component; this is a safe bypass configuration.
     *
     * Net A (signal): esp32.gpio12 ↔ C1.pin-1
     * Net B (ground): C1.pin-2 ↔ GND
     */
    it('does NOT fire when GPIO12 is connected through a capacitor to GND (bypass filter)', () => {
      const esp32Part = makeEsp32Part(800);
      const capPart = makeCapPart(805);

      const esp32Inst = makeInstance({ id: 810, partId: 800, referenceDesignator: 'U10' });
      const capInst = makeInstance({ id: 815, partId: 805, referenceDesignator: 'C1' });

      const signalNet = makeNet({
        name: 'gpio12_bypass',
        netType: 'signal',
        segments: [
          { fromInstanceId: 810, fromPin: 'gpio12', toInstanceId: 815, toPin: 'pin-1' },
        ],
      });

      const gndNet = makeNet({
        name: 'GND',
        netType: 'ground',
        segments: [
          { fromInstanceId: 815, fromPin: 'pin-2', toInstanceId: 999, toPin: 'GND' },
        ],
      });

      const result = audit({
        instances: [esp32Inst, capInst],
        parts: [esp32Part, capPart],
        nets: [signalNet, gndNet],
      });

      const strappingIssues = result.issues.filter((i) => i.id.startsWith('strapping-pin'));
      expect(strappingIssues).toHaveLength(0);
    });
  });
});
