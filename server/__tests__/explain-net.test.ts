/**
 * Tests for the explain_net AI tool (BL-0522).
 *
 * Covers: net classification logic, instance role classification,
 * explanation builder, and the full tool execute path with mocked storage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  classifyNet,
  classifyInstanceRole,
  buildNetExplanation,
} from '../ai-tools/circuit';
import type { NetClassification } from '../ai-tools/circuit';
import { ToolRegistry } from '../ai-tools/registry';
import { registerCircuitCodeTools } from '../ai-tools/circuit';
import type { IStorage } from '../storage';
import type { ToolContext, ToolResult } from '../ai-tools/types';

// ---------------------------------------------------------------------------
// Unit tests — classifyNet
// ---------------------------------------------------------------------------

describe('classifyNet', () => {
  it('classifies VCC as power', () => {
    const result = classifyNet('VCC', 'signal', null);
    expect(result.type).toBe('power');
    expect(result.protocol).toBeNull();
  });

  it('classifies VDD as power', () => {
    const result = classifyNet('VDD', 'signal', null);
    expect(result.type).toBe('power');
  });

  it('classifies 3.3V as power', () => {
    const result = classifyNet('3.3V', 'signal', '3.3V');
    expect(result.type).toBe('power');
    expect(result.description).toContain('3.3V');
  });

  it('classifies 5V as power', () => {
    const result = classifyNet('5V', 'signal', null);
    expect(result.type).toBe('power');
  });

  it('classifies GND as ground', () => {
    const result = classifyNet('GND', 'signal', null);
    expect(result.type).toBe('ground');
    expect(result.description).toBe('ground reference');
  });

  it('classifies AGND as ground', () => {
    const result = classifyNet('AGND', 'signal', null);
    expect(result.type).toBe('ground');
  });

  it('classifies DGND as ground', () => {
    const result = classifyNet('DGND', 'signal', null);
    expect(result.type).toBe('ground');
  });

  it('classifies SDA as I2C data', () => {
    const result = classifyNet('SDA', 'signal', null);
    expect(result.type).toBe('signal');
    expect(result.protocol).toBe('I2C');
    expect(result.description).toContain('I2C');
  });

  it('classifies SCL as I2C clock', () => {
    const result = classifyNet('SCL', 'signal', null);
    expect(result.type).toBe('signal');
    expect(result.protocol).toBe('I2C');
  });

  it('classifies MOSI as SPI', () => {
    const result = classifyNet('MOSI', 'signal', null);
    expect(result.protocol).toBe('SPI');
    expect(result.description).toContain('data out');
  });

  it('classifies MISO as SPI', () => {
    const result = classifyNet('MISO', 'signal', null);
    expect(result.protocol).toBe('SPI');
    expect(result.description).toContain('data in');
  });

  it('classifies SCK as SPI clock', () => {
    const result = classifyNet('SCK', 'signal', null);
    expect(result.type).toBe('clock');
    expect(result.protocol).toBe('SPI');
  });

  it('classifies CS as SPI chip select', () => {
    const result = classifyNet('CS', 'signal', null);
    expect(result.protocol).toBe('SPI');
    expect(result.description).toContain('chip select');
  });

  it('classifies TX as UART', () => {
    const result = classifyNet('TX', 'signal', null);
    expect(result.protocol).toBe('UART');
    expect(result.description).toContain('transmit');
  });

  it('classifies RX as UART', () => {
    const result = classifyNet('RX', 'signal', null);
    expect(result.protocol).toBe('UART');
    expect(result.description).toContain('receive');
  });

  it('classifies CLK as clock', () => {
    const result = classifyNet('CLK', 'signal', null);
    expect(result.type).toBe('clock');
    expect(result.protocol).toBeNull();
  });

  it('classifies RST as reset', () => {
    const result = classifyNet('RST', 'signal', null);
    expect(result.type).toBe('reset');
  });

  it('classifies NRST as reset', () => {
    const result = classifyNet('NRST', 'signal', null);
    expect(result.type).toBe('reset');
  });

  it('classifies ADC0 as analog', () => {
    const result = classifyNet('ADC0', 'signal', null);
    expect(result.type).toBe('analog');
  });

  it('classifies SWDIO as JTAG/SWD', () => {
    const result = classifyNet('SWDIO', 'signal', null);
    expect(result.protocol).toBe('JTAG/SWD');
  });

  it('classifies CAN_H as CAN', () => {
    const result = classifyNet('CAN_H', 'signal', null);
    expect(result.protocol).toBe('CAN');
  });

  it('classifies D+ as USB', () => {
    const result = classifyNet('D+', 'signal', null);
    expect(result.protocol).toBe('USB');
  });

  it('respects stored type "power" over name pattern', () => {
    const result = classifyNet('CUSTOM_RAIL', 'power', '12V');
    expect(result.type).toBe('power');
    expect(result.description).toContain('12V');
  });

  it('respects stored type "ground"', () => {
    const result = classifyNet('CUSTOM_GND', 'ground', null);
    expect(result.type).toBe('ground');
  });

  it('respects stored type "bus"', () => {
    const result = classifyNet('DATA_BUS', 'bus', null);
    expect(result.type).toBe('bus');
  });

  it('defaults unknown names to generic signal', () => {
    const result = classifyNet('MY_CUSTOM_NET', 'signal', null);
    expect(result.type).toBe('signal');
    expect(result.protocol).toBeNull();
    expect(result.description).toBe('general-purpose signal');
  });

  it('is case-insensitive', () => {
    expect(classifyNet('vcc', 'signal', null).type).toBe('power');
    expect(classifyNet('gnd', 'signal', null).type).toBe('ground');
    expect(classifyNet('sda', 'signal', null).protocol).toBe('I2C');
    expect(classifyNet('mosi', 'signal', null).protocol).toBe('SPI');
  });
});

// ---------------------------------------------------------------------------
// Unit tests — classifyInstanceRole
// ---------------------------------------------------------------------------

describe('classifyInstanceRole', () => {
  const powerNet: NetClassification = { type: 'power', protocol: null, description: 'power rail' };
  const groundNet: NetClassification = { type: 'ground', protocol: null, description: 'ground' };
  const signalNet: NetClassification = { type: 'signal', protocol: 'SPI', description: 'SPI data' };

  it('classifies voltage regulator as driver on power net', () => {
    expect(classifyInstanceRole('U1', 'LDO Voltage Regulator', powerNet)).toBe('driver');
  });

  it('classifies resistor as load on power net', () => {
    expect(classifyInstanceRole('R1', '10k Resistor', powerNet)).toBe('load');
  });

  it('classifies capacitor as load on ground net', () => {
    expect(classifyInstanceRole('C1', '100nF Capacitor', groundNet)).toBe('load');
  });

  it('classifies MCU as driver on signal net', () => {
    expect(classifyInstanceRole('U1', 'ATmega328P MCU', signalNet)).toBe('driver');
  });

  it('classifies generic IC as driver on signal net', () => {
    expect(classifyInstanceRole('IC1', 'SPI Flash', signalNet)).toBe('driver');
  });

  it('classifies resistor as load on signal net', () => {
    expect(classifyInstanceRole('R1', 'Pull-up Resistor', signalNet)).toBe('load');
  });

  it('classifies LED as load', () => {
    expect(classifyInstanceRole('D1', 'Red LED', signalNet)).toBe('load');
  });

  it('classifies diode as load', () => {
    expect(classifyInstanceRole('D2', 'Schottky Diode', signalNet)).toBe('load');
  });

  it('classifies connector as unknown', () => {
    expect(classifyInstanceRole('J1', 'USB-C Connector', signalNet)).toBe('unknown');
  });

  it('classifies sensor as driver', () => {
    expect(classifyInstanceRole('U2', 'Temperature Sensor', signalNet)).toBe('driver');
  });

  it('classifies motor as load', () => {
    expect(classifyInstanceRole('M1', 'DC Motor', signalNet)).toBe('load');
  });

  it('classifies inductor as load', () => {
    expect(classifyInstanceRole('L1', 'Inductor 10uH', signalNet)).toBe('load');
  });

  it('classifies ferrite bead as load', () => {
    expect(classifyInstanceRole('FB1', 'Ferrite Bead', signalNet)).toBe('load');
  });

  it('classifies transistor with driver name as driver', () => {
    expect(classifyInstanceRole('Q1', 'MOSFET Driver', signalNet)).toBe('driver');
  });

  it('classifies generic transistor as unknown', () => {
    expect(classifyInstanceRole('Q1', '2N2222 NPN', signalNet)).toBe('unknown');
  });

  it('classifies battery as driver on power net', () => {
    expect(classifyInstanceRole('BT1', '9V Battery', powerNet)).toBe('driver');
  });
});

// ---------------------------------------------------------------------------
// Unit tests — buildNetExplanation
// ---------------------------------------------------------------------------

describe('buildNetExplanation', () => {
  it('builds explanation for a power net with drivers and loads', () => {
    const result = buildNetExplanation({
      netName: 'VCC',
      classification: { type: 'power', protocol: null, description: 'positive power rail (5V)' },
      voltage: '5V',
      drivers: ['U1 (LDO Regulator)'],
      loads: ['R1 (Resistor)', 'U2 (MCU)'],
      unknownRole: [],
      wireCount: 3,
      instanceCount: 3,
    });

    expect(result).toContain('VCC');
    expect(result).toContain('5V');
    expect(result).toContain('U1 (LDO Regulator)');
    expect(result).toContain('R1 (Resistor)');
    expect(result).toContain('3 component(s)');
  });

  it('builds explanation for an I2C net with protocol info', () => {
    const result = buildNetExplanation({
      netName: 'SDA',
      classification: { type: 'signal', protocol: 'I2C', description: 'I2C data line' },
      voltage: null,
      drivers: ['U1 (MCU)'],
      loads: ['U2 (EEPROM)'],
      unknownRole: [],
      wireCount: 1,
      instanceCount: 2,
    });

    expect(result).toContain('SDA');
    expect(result).toContain('I2C');
    expect(result).toContain('Driven by');
    expect(result).toContain('Loads');
  });

  it('builds explanation for a net with no connections', () => {
    const result = buildNetExplanation({
      netName: 'ORPHAN',
      classification: { type: 'signal', protocol: null, description: 'general-purpose signal' },
      voltage: null,
      drivers: [],
      loads: [],
      unknownRole: [],
      wireCount: 0,
      instanceCount: 0,
    });

    expect(result).toContain('ORPHAN');
    expect(result).toContain('No components or wires');
  });

  it('includes unknown-role components as "Also connected"', () => {
    const result = buildNetExplanation({
      netName: 'DATA',
      classification: { type: 'signal', protocol: null, description: 'general-purpose signal' },
      voltage: null,
      drivers: [],
      loads: [],
      unknownRole: ['J1 (Header)'],
      wireCount: 1,
      instanceCount: 1,
    });

    expect(result).toContain('Also connected');
    expect(result).toContain('J1 (Header)');
  });

  it('includes clock description for clock nets', () => {
    const result = buildNetExplanation({
      netName: 'CLK',
      classification: { type: 'clock', protocol: null, description: 'clock signal' },
      voltage: null,
      drivers: [],
      loads: [],
      unknownRole: [],
      wireCount: 0,
      instanceCount: 0,
    });

    expect(result).toContain('clock signal');
    expect(result).toContain('synchronization');
  });

  it('includes reset description for reset nets', () => {
    const result = buildNetExplanation({
      netName: 'NRST',
      classification: { type: 'reset', protocol: null, description: 'reset signal (typically active low)' },
      voltage: null,
      drivers: [],
      loads: [],
      unknownRole: [],
      wireCount: 0,
      instanceCount: 0,
    });

    expect(result).toContain('reset');
    expect(result).toContain('active low');
  });

  it('includes ground-specific description', () => {
    const result = buildNetExplanation({
      netName: 'GND',
      classification: { type: 'ground', protocol: null, description: 'ground reference' },
      voltage: null,
      drivers: [],
      loads: ['C1 (Decoupling Cap)'],
      unknownRole: [],
      wireCount: 2,
      instanceCount: 1,
    });

    expect(result).toContain('ground reference (0V)');
  });
});

// ---------------------------------------------------------------------------
// Integration tests — explain_net tool execute via ToolRegistry
// ---------------------------------------------------------------------------

describe('explain_net tool (integration)', () => {
  const NOW = new Date('2026-03-13T12:00:00Z');

  function makeNet(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 1,
      circuitId: 10,
      name: 'VCC',
      netType: 'power',
      voltage: '5V',
      busWidth: null,
      segments: [],
      labels: [],
      style: {},
      createdAt: NOW,
      ...overrides,
    };
  }

  function makeInstance(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 100,
      circuitId: 10,
      partId: 1,
      subDesignId: null,
      referenceDesignator: 'U1',
      schematicX: 0,
      schematicY: 0,
      schematicRotation: 0,
      breadboardX: null,
      breadboardY: null,
      breadboardRotation: 0,
      pcbX: null,
      pcbY: null,
      pcbRotation: 0,
      pcbSide: 'front',
      properties: {},
      createdAt: NOW,
      ...overrides,
    };
  }

  function makePart(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 1,
      projectId: 1,
      nodeId: null,
      meta: { name: 'ATmega328P MCU' },
      connectors: [],
      buses: [],
      views: {},
      constraints: [],
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    };
  }

  function makeDesign(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 10,
      projectId: 1,
      parentDesignId: null,
      name: 'Main Circuit',
      description: null,
      settings: {},
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    };
  }

  let registry: ToolRegistry;
  let mockStorage: Record<string, ReturnType<typeof vi.fn>>;
  let ctx: ToolContext;

  beforeEach(() => {
    registry = new ToolRegistry();
    mockStorage = {
      getCircuitDesigns: vi.fn().mockResolvedValue([makeDesign()]),
      getCircuitNets: vi.fn().mockResolvedValue([makeNet()]),
      getCircuitInstances: vi.fn().mockResolvedValue([]),
      getCircuitWires: vi.fn().mockResolvedValue([]),
      getComponentParts: vi.fn().mockResolvedValue([]),
      // Stubs for other tools registered by registerCircuitCodeTools
      getCircuitNet: vi.fn(),
      createCircuitVias: vi.fn(),
      getPcbZone: vi.fn(),
      getPcbZones: vi.fn().mockResolvedValue([]),
      deletePcbZone: vi.fn(),
      createPcbZone: vi.fn(),
    };
    ctx = { projectId: 1, storage: mockStorage as unknown as IStorage };
    registerCircuitCodeTools(registry);
  });

  async function executeExplainNet(params: Record<string, unknown>): Promise<ToolResult> {
    return registry.execute('explain_net', params, ctx);
  }

  it('is registered in the registry', () => {
    const tool = registry.get('explain_net');
    expect(tool).toBeDefined();
    expect(tool!.category).toBe('circuit');
    expect(tool!.requiresConfirmation).toBe(false);
  });

  it('returns error when no circuit designs exist', async () => {
    mockStorage.getCircuitDesigns.mockResolvedValue([]);
    const result = await executeExplainNet({ netName: 'VCC' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('No circuit designs');
  });

  it('returns error when specified design not found', async () => {
    const result = await executeExplainNet({ netName: 'VCC', circuitDesignId: 999 });
    expect(result.success).toBe(false);
    expect(result.message).toContain('999');
    expect(result.message).toContain('not found');
  });

  it('returns error when net not found and lists available nets', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ name: 'VCC' }),
      makeNet({ name: 'GND', id: 2 }),
    ]);
    const result = await executeExplainNet({ netName: 'NONEXISTENT' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('NONEXISTENT');
    expect(result.message).toContain('VCC');
    expect(result.message).toContain('GND');
  });

  it('explains a power net with connected components', async () => {
    const regulator = makeInstance({ id: 100, referenceDesignator: 'U1', partId: 1 });
    const cap = makeInstance({ id: 101, referenceDesignator: 'C1', partId: 2 });

    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({
        name: 'VCC',
        netType: 'power',
        voltage: '5V',
        segments: [
          { fromInstanceId: 100, toInstanceId: 101, fromPin: 'OUT', toPin: 'pin1' },
        ],
      }),
    ]);
    mockStorage.getCircuitInstances.mockResolvedValue([regulator, cap]);
    mockStorage.getComponentParts.mockResolvedValue([
      makePart({ id: 1, meta: { name: 'LDO Voltage Regulator' } }),
      makePart({ id: 2, meta: { name: '100nF Capacitor' } }),
    ]);

    const result = await executeExplainNet({ netName: 'VCC' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('VCC');
    expect(result.message).toContain('5V');
    expect(result.message).toContain('LDO Voltage Regulator');
    expect(result.message).toContain('Capacitor');
    expect(result.data).toMatchObject({
      type: 'net_explanation',
      netName: 'VCC',
      classification: 'power',
      drivers: expect.arrayContaining([expect.stringContaining('U1')]),
      loads: expect.arrayContaining([expect.stringContaining('C1')]),
    });
  });

  it('explains an I2C net with protocol info', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ name: 'SDA', netType: 'signal', voltage: null }),
    ]);

    const result = await executeExplainNet({ netName: 'SDA' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('I2C');
    expect(result.data).toMatchObject({
      type: 'net_explanation',
      classification: 'signal',
      protocol: 'I2C',
    });
  });

  it('explains an SPI net', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ name: 'MOSI', netType: 'signal', voltage: null }),
    ]);

    const result = await executeExplainNet({ netName: 'MOSI' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('SPI');
    expect(result.data).toMatchObject({ protocol: 'SPI' });
  });

  it('explains a UART net', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ name: 'TX', netType: 'signal', voltage: null }),
    ]);

    const result = await executeExplainNet({ netName: 'TX' });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ protocol: 'UART' });
  });

  it('explains a ground net', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ name: 'GND', netType: 'ground', voltage: null }),
    ]);

    const result = await executeExplainNet({ netName: 'GND' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('ground');
  });

  it('explains a generic signal net', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ name: 'MY_SIGNAL', netType: 'signal', voltage: null }),
    ]);

    const result = await executeExplainNet({ netName: 'MY_SIGNAL' });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      classification: 'signal',
      protocol: null,
    });
  });

  it('is case-insensitive for net name lookup', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ name: 'VCC', netType: 'power' }),
    ]);

    const result = await executeExplainNet({ netName: 'vcc' });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ netName: 'VCC' });
  });

  it('includes confidence score', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([makeNet()]);
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({ id: 100, referenceDesignator: 'U1' }),
    ]);
    mockStorage.getComponentParts.mockResolvedValue([
      makePart({ id: 1 }),
    ]);
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ segments: [{ fromInstanceId: 100 }] }),
    ]);

    const result = await executeExplainNet({ netName: 'VCC' });
    expect(result.success).toBe(true);
    expect(result.confidence).toBeDefined();
    expect(result.confidence!.score).toBeGreaterThanOrEqual(50);
    expect(result.confidence!.factors.length).toBeGreaterThan(0);
  });

  it('includes sources in the result', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ segments: [{ fromInstanceId: 100 }] }),
    ]);
    mockStorage.getCircuitInstances.mockResolvedValue([
      makeInstance({ id: 100, referenceDesignator: 'U1' }),
    ]);
    mockStorage.getComponentParts.mockResolvedValue([makePart()]);

    const result = await executeExplainNet({ netName: 'VCC' });
    expect(result.sources).toBeDefined();
    expect(result.sources!.length).toBeGreaterThan(0);
    expect(result.sources!.some((s) => s.type === 'net')).toBe(true);
  });

  it('counts wires connected to the net', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([makeNet()]);
    mockStorage.getCircuitWires.mockResolvedValue([
      { id: 1, circuitId: 10, netId: 1, view: 'schematic', points: [], layer: 'front', width: 1, color: null, wireType: 'wire', createdAt: NOW },
      { id: 2, circuitId: 10, netId: 1, view: 'schematic', points: [], layer: 'front', width: 1, color: null, wireType: 'wire', createdAt: NOW },
      { id: 3, circuitId: 10, netId: 99, view: 'schematic', points: [], layer: 'front', width: 1, color: null, wireType: 'wire', createdAt: NOW },
    ]);

    const result = await executeExplainNet({ netName: 'VCC' });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ wireCount: 2 });
  });

  it('searches all designs when circuitDesignId is not specified', async () => {
    mockStorage.getCircuitDesigns.mockResolvedValue([
      makeDesign({ id: 10 }),
      makeDesign({ id: 20 }),
    ]);
    mockStorage.getCircuitNets
      .mockResolvedValueOnce([]) // design 10 — no match
      .mockResolvedValueOnce([makeNet({ circuitId: 20, name: 'SDA' })]); // design 20 — match

    const result = await executeExplainNet({ netName: 'SDA' });
    expect(result.success).toBe(true);
    expect(mockStorage.getCircuitNets).toHaveBeenCalledTimes(2);
  });

  it('scopes to specified design when circuitDesignId is provided', async () => {
    mockStorage.getCircuitDesigns.mockResolvedValue([
      makeDesign({ id: 10 }),
      makeDesign({ id: 20 }),
    ]);
    mockStorage.getCircuitNets.mockResolvedValue([makeNet({ circuitId: 10 })]);

    const result = await executeExplainNet({ netName: 'VCC', circuitDesignId: 10 });
    expect(result.success).toBe(true);
    expect(mockStorage.getCircuitNets).toHaveBeenCalledTimes(1);
    expect(mockStorage.getCircuitNets).toHaveBeenCalledWith(10);
  });

  it('handles net with no segments and no wires gracefully', async () => {
    mockStorage.getCircuitNets.mockResolvedValue([
      makeNet({ segments: [], name: 'FLOATING' }),
    ]);
    mockStorage.getCircuitInstances.mockResolvedValue([]);
    mockStorage.getCircuitWires.mockResolvedValue([]);

    const result = await executeExplainNet({ netName: 'FLOATING' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('No components or wires');
    expect(result.confidence!.score).toBe(50);
  });
});
