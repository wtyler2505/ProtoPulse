import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SnippetLibrary } from '../design-reuse';
import type {
  CreateSnippetInput,
  SnippetCircuitInstance,
  SnippetCircuitNet,
} from '../design-reuse';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCircuitInstances(): SnippetCircuitInstance[] {
  return [
    {
      id: 'ci-1',
      componentId: 'comp-resistor',
      label: 'R1',
      type: 'resistor',
      properties: { value: '10k', package: '0805' },
      position: { x: 0, y: 0 },
    },
    {
      id: 'ci-2',
      componentId: 'comp-capacitor',
      label: 'C1',
      type: 'capacitor',
      properties: { value: '100nF', package: '0402' },
      position: { x: 100, y: 0 },
    },
    {
      id: 'ci-3',
      componentId: 'comp-ic-lm7805',
      label: 'U1',
      type: 'ic',
      properties: { value: 'LM7805', package: 'TO-220' },
      position: { x: 200, y: 50 },
    },
  ];
}

function makeCircuitNets(): SnippetCircuitNet[] {
  return [
    {
      id: 'net-1',
      name: 'VIN',
      connectedPins: [
        { instanceId: 'ci-1', pinId: 'pin1' },
        { instanceId: 'ci-3', pinId: 'input' },
      ],
    },
    {
      id: 'net-2',
      name: 'VOUT',
      connectedPins: [
        { instanceId: 'ci-2', pinId: 'pin1' },
        { instanceId: 'ci-3', pinId: 'output' },
      ],
    },
    {
      id: 'net-3',
      name: 'GND',
      connectedPins: [
        { instanceId: 'ci-1', pinId: 'pin2' },
        { instanceId: 'ci-2', pinId: 'pin2' },
        { instanceId: 'ci-3', pinId: 'gnd' },
      ],
    },
  ];
}

function makeInputWithCircuit(overrides?: Partial<CreateSnippetInput>): CreateSnippetInput {
  return {
    name: 'Circuit Test Snippet',
    category: 'power',
    description: 'A snippet with circuit instances and nets',
    tags: ['test', 'circuit'],
    nodes: [
      { id: 'n1', type: 'regulator', label: 'Regulator', properties: {}, position: { x: 0, y: 0 } },
    ],
    edges: [],
    wires: [],
    circuitInstances: makeCircuitInstances(),
    circuitNets: makeCircuitNets(),
    ...overrides,
  };
}

function makeInputWithoutCircuit(overrides?: Partial<CreateSnippetInput>): CreateSnippetInput {
  return {
    name: 'Arch-Only Snippet',
    category: 'analog',
    description: 'No circuit data',
    tags: ['test'],
    nodes: [
      { id: 'n1', type: 'resistor', label: 'R1', properties: { value: '10k' }, position: { x: 0, y: 0 } },
      { id: 'n2', type: 'resistor', label: 'R2', properties: { value: '20k' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    wires: [{ id: 'w1', startPin: 'n1:2', endPin: 'n2:1', netName: 'mid' }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let library: SnippetLibrary;

beforeEach(() => {
  localStorage.clear();
  SnippetLibrary.resetForTesting();
  library = SnippetLibrary.getInstance();
});

afterEach(() => {
  SnippetLibrary.resetForTesting();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// SnippetCircuitInstance interface typing
// ---------------------------------------------------------------------------

describe('SnippetCircuitInstance — type correctness', () => {
  it('has all required fields', () => {
    const inst: SnippetCircuitInstance = {
      id: 'test-id',
      componentId: 'comp-1',
      label: 'R1',
      type: 'resistor',
      properties: { value: '10k' },
      position: { x: 0, y: 0 },
    };
    expect(inst.id).toBe('test-id');
    expect(inst.componentId).toBe('comp-1');
    expect(inst.label).toBe('R1');
    expect(inst.type).toBe('resistor');
    expect(inst.properties).toEqual({ value: '10k' });
    expect(inst.position).toEqual({ x: 0, y: 0 });
  });

  it('allows arbitrary properties', () => {
    const inst: SnippetCircuitInstance = {
      id: 'x',
      componentId: 'c',
      label: 'U1',
      type: 'ic',
      properties: { value: 'ATmega328P', package: 'DIP-28', pinCount: 28, hasPullUp: true },
      position: { x: 10, y: 20 },
    };
    expect(inst.properties.package).toBe('DIP-28');
    expect(inst.properties.pinCount).toBe(28);
    expect(inst.properties.hasPullUp).toBe(true);
  });

  it('supports negative positions', () => {
    const inst: SnippetCircuitInstance = {
      id: 'neg',
      componentId: 'c',
      label: 'R1',
      type: 'resistor',
      properties: {},
      position: { x: -100, y: -200 },
    };
    expect(inst.position.x).toBe(-100);
    expect(inst.position.y).toBe(-200);
  });
});

// ---------------------------------------------------------------------------
// SnippetCircuitNet interface typing
// ---------------------------------------------------------------------------

describe('SnippetCircuitNet — type correctness', () => {
  it('has all required fields', () => {
    const net: SnippetCircuitNet = {
      id: 'net-test',
      name: 'VCC',
      connectedPins: [{ instanceId: 'inst-1', pinId: 'pin1' }],
    };
    expect(net.id).toBe('net-test');
    expect(net.name).toBe('VCC');
    expect(net.connectedPins).toHaveLength(1);
    expect(net.connectedPins[0].instanceId).toBe('inst-1');
    expect(net.connectedPins[0].pinId).toBe('pin1');
  });

  it('allows multiple connected pins', () => {
    const net: SnippetCircuitNet = {
      id: 'net-multi',
      name: 'GND',
      connectedPins: [
        { instanceId: 'i1', pinId: 'p1' },
        { instanceId: 'i2', pinId: 'p2' },
        { instanceId: 'i3', pinId: 'p3' },
      ],
    };
    expect(net.connectedPins).toHaveLength(3);
  });

  it('allows empty connectedPins array', () => {
    const net: SnippetCircuitNet = {
      id: 'net-empty',
      name: 'FLOAT',
      connectedPins: [],
    };
    expect(net.connectedPins).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DesignSnippet — circuitInstances/circuitNets optional fields
// ---------------------------------------------------------------------------

describe('DesignSnippet — circuit fields are optional', () => {
  it('addSnippet works without circuitInstances or circuitNets', () => {
    const snippet = library.addSnippet(makeInputWithoutCircuit());
    expect(snippet.circuitInstances).toBeUndefined();
    expect(snippet.circuitNets).toBeUndefined();
  });

  it('addSnippet stores circuitInstances when provided', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    expect(snippet.circuitInstances).toBeDefined();
    expect(snippet.circuitInstances).toHaveLength(3);
  });

  it('addSnippet stores circuitNets when provided', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    expect(snippet.circuitNets).toBeDefined();
    expect(snippet.circuitNets).toHaveLength(3);
  });

  it('addSnippet stores correct instance data', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const r1 = snippet.circuitInstances!.find((i) => i.label === 'R1');
    expect(r1).toBeDefined();
    expect(r1!.type).toBe('resistor');
    expect(r1!.properties.value).toBe('10k');
    expect(r1!.componentId).toBe('comp-resistor');
  });

  it('addSnippet stores correct net data', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const vin = snippet.circuitNets!.find((n) => n.name === 'VIN');
    expect(vin).toBeDefined();
    expect(vin!.connectedPins).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// CreateSnippetInput — circuit fields
// ---------------------------------------------------------------------------

describe('CreateSnippetInput — circuit fields', () => {
  it('accepts circuitInstances in input', () => {
    const input = makeInputWithCircuit();
    expect(input.circuitInstances).toHaveLength(3);
    const snippet = library.addSnippet(input);
    expect(snippet.circuitInstances).toHaveLength(3);
  });

  it('accepts circuitNets in input', () => {
    const input = makeInputWithCircuit();
    expect(input.circuitNets).toHaveLength(3);
    const snippet = library.addSnippet(input);
    expect(snippet.circuitNets).toHaveLength(3);
  });

  it('accepts empty circuitInstances array', () => {
    const snippet = library.addSnippet(makeInputWithCircuit({ circuitInstances: [] }));
    expect(snippet.circuitInstances).toEqual([]);
  });

  it('accepts empty circuitNets array', () => {
    const snippet = library.addSnippet(makeInputWithCircuit({ circuitNets: [] }));
    expect(snippet.circuitNets).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// prepareForPlacement — circuit instance ID remapping
// ---------------------------------------------------------------------------

describe('prepareForPlacement — circuit instance remapping', () => {
  it('remaps circuit instance IDs to new UUIDs', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result).not.toBeNull();
    expect(result!.circuitInstances).toBeDefined();
    expect(result!.circuitInstances).toHaveLength(3);

    const originalIds = new Set(['ci-1', 'ci-2', 'ci-3']);
    for (const inst of result!.circuitInstances!) {
      expect(originalIds.has(inst.id)).toBe(false);
      expect(inst.id).toMatch(/^uuid-/);
    }
  });

  it('builds instanceIdMap with correct old→new mappings', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result!.instanceIdMap).toBeDefined();
    expect(result!.instanceIdMap!.size).toBe(3);
    expect(result!.instanceIdMap!.has('ci-1')).toBe(true);
    expect(result!.instanceIdMap!.has('ci-2')).toBe(true);
    expect(result!.instanceIdMap!.has('ci-3')).toBe(true);

    // Values should differ from keys
    result!.instanceIdMap!.forEach((newId, oldId) => {
      expect(newId).not.toBe(oldId);
    });
  });

  it('instance IDs in result match instanceIdMap values', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const mappedIds = new Set<string>();
    result!.instanceIdMap!.forEach((newId) => {
      mappedIds.add(newId);
    });

    for (const inst of result!.circuitInstances!) {
      expect(mappedIds.has(inst.id)).toBe(true);
    }
  });

  it('preserves instance labels after remapping', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const labels = result!.circuitInstances!.map((i) => i.label);
    expect(labels).toContain('R1');
    expect(labels).toContain('C1');
    expect(labels).toContain('U1');
  });

  it('preserves instance types after remapping', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const types = result!.circuitInstances!.map((i) => i.type);
    expect(types).toContain('resistor');
    expect(types).toContain('capacitor');
    expect(types).toContain('ic');
  });

  it('preserves instance componentId after remapping', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const compIds = result!.circuitInstances!.map((i) => i.componentId);
    expect(compIds).toContain('comp-resistor');
    expect(compIds).toContain('comp-capacitor');
    expect(compIds).toContain('comp-ic-lm7805');
  });

  it('preserves instance properties after remapping', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const r1 = result!.circuitInstances!.find((i) => i.label === 'R1');
    expect(r1!.properties.value).toBe('10k');
    expect(r1!.properties.package).toBe('0805');
  });

  it('does not mutate original snippet circuit instances', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    library.prepareForPlacement(snippet.id, { x: 100, y: 200 });

    const original = library.getSnippet(snippet.id)!;
    expect(original.circuitInstances![0].id).toBe('ci-1');
    expect(original.circuitInstances![0].position).toEqual({ x: 0, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// prepareForPlacement — circuit instance position offsetting
// ---------------------------------------------------------------------------

describe('prepareForPlacement — circuit instance positions', () => {
  it('offsets instance positions by given offset', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 300, y: 400 });

    // Original positions: (0,0), (100,0), (200,50)
    const positions = result!.circuitInstances!.map((i) => i.position);
    expect(positions).toContainEqual({ x: 300, y: 400 });
    expect(positions).toContainEqual({ x: 400, y: 400 });
    expect(positions).toContainEqual({ x: 500, y: 450 });
  });

  it('handles zero offset', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const positions = result!.circuitInstances!.map((i) => i.position);
    expect(positions).toContainEqual({ x: 0, y: 0 });
    expect(positions).toContainEqual({ x: 100, y: 0 });
    expect(positions).toContainEqual({ x: 200, y: 50 });
  });

  it('handles negative offset', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: -50, y: -100 });

    const positions = result!.circuitInstances!.map((i) => i.position);
    expect(positions).toContainEqual({ x: -50, y: -100 });
    expect(positions).toContainEqual({ x: 50, y: -100 });
    expect(positions).toContainEqual({ x: 150, y: -50 });
  });
});

// ---------------------------------------------------------------------------
// prepareForPlacement — circuit net ID remapping
// ---------------------------------------------------------------------------

describe('prepareForPlacement — circuit net remapping', () => {
  it('remaps net IDs to new UUIDs', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result!.circuitNets).toBeDefined();
    expect(result!.circuitNets).toHaveLength(3);

    const originalNetIds = new Set(['net-1', 'net-2', 'net-3']);
    for (const net of result!.circuitNets!) {
      expect(originalNetIds.has(net.id)).toBe(false);
      expect(net.id).toMatch(/^uuid-/);
    }
  });

  it('preserves net names after remapping', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const netNames = result!.circuitNets!.map((n) => n.name);
    expect(netNames).toContain('VIN');
    expect(netNames).toContain('VOUT');
    expect(netNames).toContain('GND');
  });

  it('remaps connectedPins instanceId references', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const newInstanceIds = new Set<string>();
    result!.instanceIdMap!.forEach((newId) => {
      newInstanceIds.add(newId);
    });

    for (const net of result!.circuitNets!) {
      for (const pin of net.connectedPins) {
        expect(newInstanceIds.has(pin.instanceId)).toBe(true);
      }
    }
  });

  it('preserves pinId in connectedPins', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    // Find VIN net and check pin IDs preserved
    const vinNet = result!.circuitNets!.find((n) => n.name === 'VIN');
    expect(vinNet).toBeDefined();
    const pinIds = vinNet!.connectedPins.map((p) => p.pinId);
    expect(pinIds).toContain('pin1');
    expect(pinIds).toContain('input');
  });

  it('GND net has 3 connected pins with remapped instanceIds', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const gndNet = result!.circuitNets!.find((n) => n.name === 'GND');
    expect(gndNet).toBeDefined();
    expect(gndNet!.connectedPins).toHaveLength(3);

    // All instanceIds should be remapped (none should be original)
    const originalIds = new Set(['ci-1', 'ci-2', 'ci-3']);
    for (const pin of gndNet!.connectedPins) {
      expect(originalIds.has(pin.instanceId)).toBe(false);
    }
  });

  it('connectedPins pinIds are preserved (pin2 for GND)', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const gndNet = result!.circuitNets!.find((n) => n.name === 'GND');
    const pinIds = gndNet!.connectedPins.map((p) => p.pinId);
    expect(pinIds).toContain('pin2');
    expect(pinIds).toContain('gnd');
  });

  it('does not mutate original snippet nets', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const original = library.getSnippet(snippet.id)!;
    expect(original.circuitNets![0].id).toBe('net-1');
    expect(original.circuitNets![0].connectedPins[0].instanceId).toBe('ci-1');
  });
});

// ---------------------------------------------------------------------------
// prepareForPlacement — backwards compatibility
// ---------------------------------------------------------------------------

describe('prepareForPlacement — backwards compatibility', () => {
  it('works for snippets without circuitInstances', () => {
    const snippet = library.addSnippet(makeInputWithoutCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 50, y: 50 });

    expect(result).not.toBeNull();
    expect(result!.nodes).toHaveLength(2);
    expect(result!.edges).toHaveLength(1);
    expect(result!.wires).toHaveLength(1);
    expect(result!.circuitInstances).toBeUndefined();
    expect(result!.circuitNets).toBeUndefined();
    expect(result!.instanceIdMap).toBeUndefined();
  });

  it('existing nodeIdMap still works for arch-only snippets', () => {
    const snippet = library.addSnippet(makeInputWithoutCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result!.nodeIdMap.size).toBe(2);
    result!.nodeIdMap.forEach((newId, oldId) => {
      expect(newId).not.toBe(oldId);
    });
  });

  it('node position offsets still work for arch-only snippets', () => {
    const snippet = library.addSnippet(makeInputWithoutCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 100, y: 200 });

    expect(result!.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(result!.nodes[1].position).toEqual({ x: 200, y: 200 });
  });

  it('wire pin remapping still works for arch-only snippets', () => {
    const snippet = library.addSnippet(makeInputWithoutCircuit());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    for (const wire of result!.wires) {
      expect(wire.startPin.startsWith('n1:')).toBe(false);
      expect(wire.endPin.startsWith('n2:')).toBe(false);
    }
  });

  it('built-in snippets without circuit data still work', () => {
    const builtinId = 'builtin-voltage-divider';
    const result = library.prepareForPlacement(builtinId, { x: 10, y: 20 });

    expect(result).not.toBeNull();
    expect(result!.nodes).toHaveLength(2);
    expect(result!.circuitInstances).toBeUndefined();
    expect(result!.circuitNets).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// prepareForPlacement — edge cases
// ---------------------------------------------------------------------------

describe('prepareForPlacement — circuit edge cases', () => {
  it('handles snippet with circuitInstances but no circuitNets', () => {
    const snippet = library.addSnippet(
      makeInputWithCircuit({ circuitNets: undefined }),
    );
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result!.circuitInstances).toHaveLength(3);
    expect(result!.circuitNets).toBeUndefined();
  });

  it('handles snippet with circuitNets but no circuitInstances', () => {
    const snippet = library.addSnippet(
      makeInputWithCircuit({ circuitInstances: undefined }),
    );
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result!.circuitInstances).toBeUndefined();
    // Nets will have unresolvable instanceIds but should not crash
    expect(result!.circuitNets).toHaveLength(3);
  });

  it('handles empty circuitInstances array', () => {
    const snippet = library.addSnippet(makeInputWithCircuit({ circuitInstances: [] }));
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result!.circuitInstances).toEqual([]);
    expect(result!.instanceIdMap!.size).toBe(0);
  });

  it('handles empty circuitNets array', () => {
    const snippet = library.addSnippet(makeInputWithCircuit({ circuitNets: [] }));
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result!.circuitNets).toEqual([]);
  });

  it('handles single circuit instance', () => {
    const snippet = library.addSnippet(
      makeInputWithCircuit({
        circuitInstances: [
          {
            id: 'only-one',
            componentId: 'comp-1',
            label: 'R1',
            type: 'resistor',
            properties: { value: '1k' },
            position: { x: 50, y: 75 },
          },
        ],
        circuitNets: [],
      }),
    );
    const result = library.prepareForPlacement(snippet.id, { x: 10, y: 20 });

    expect(result!.circuitInstances).toHaveLength(1);
    expect(result!.circuitInstances![0].id).not.toBe('only-one');
    expect(result!.circuitInstances![0].position).toEqual({ x: 60, y: 95 });
    expect(result!.instanceIdMap!.size).toBe(1);
  });

  it('handles many circuit instances', () => {
    const instances: SnippetCircuitInstance[] = Array.from({ length: 20 }, (_, i) => ({
      id: `ci-${i}`,
      componentId: `comp-${i}`,
      label: `C${i}`,
      type: 'capacitor',
      properties: { value: '100nF' },
      position: { x: i * 50, y: 0 },
    }));
    const snippet = library.addSnippet(
      makeInputWithCircuit({ circuitInstances: instances, circuitNets: [] }),
    );
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    expect(result!.circuitInstances).toHaveLength(20);
    expect(result!.instanceIdMap!.size).toBe(20);

    // All IDs should be unique
    const ids = new Set(result!.circuitInstances!.map((i) => i.id));
    expect(ids.size).toBe(20);
  });

  it('net with connectedPins referencing unknown instanceId preserves the ID', () => {
    const snippet = library.addSnippet(
      makeInputWithCircuit({
        circuitInstances: [
          {
            id: 'ci-known',
            componentId: 'c',
            label: 'R1',
            type: 'resistor',
            properties: {},
            position: { x: 0, y: 0 },
          },
        ],
        circuitNets: [
          {
            id: 'net-x',
            name: 'TEST',
            connectedPins: [
              { instanceId: 'ci-known', pinId: 'p1' },
              { instanceId: 'ci-unknown', pinId: 'p2' },
            ],
          },
        ],
      }),
    );
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    const net = result!.circuitNets![0];
    // Known instance should be remapped
    const knownNewId = result!.instanceIdMap!.get('ci-known');
    expect(net.connectedPins.some((p) => p.instanceId === knownNewId)).toBe(true);
    // Unknown instance keeps original ID
    expect(net.connectedPins.some((p) => p.instanceId === 'ci-unknown')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateSnippet — circuit fields
// ---------------------------------------------------------------------------

describe('updateSnippet — circuit fields', () => {
  it('updates circuitInstances', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const newInstances: SnippetCircuitInstance[] = [
      {
        id: 'new-ci',
        componentId: 'comp-new',
        label: 'R99',
        type: 'resistor',
        properties: { value: '1M' },
        position: { x: 500, y: 500 },
      },
    ];
    const updated = library.updateSnippet(snippet.id, { circuitInstances: newInstances });
    expect(updated!.circuitInstances).toHaveLength(1);
    expect(updated!.circuitInstances![0].label).toBe('R99');
  });

  it('updates circuitNets', () => {
    const snippet = library.addSnippet(makeInputWithCircuit());
    const newNets: SnippetCircuitNet[] = [
      {
        id: 'new-net',
        name: 'SIG',
        connectedPins: [{ instanceId: 'ci-1', pinId: 'p1' }],
      },
    ];
    const updated = library.updateSnippet(snippet.id, { circuitNets: newNets });
    expect(updated!.circuitNets).toHaveLength(1);
    expect(updated!.circuitNets![0].name).toBe('SIG');
  });
});

// ---------------------------------------------------------------------------
// duplicateSnippet — circuit fields
// ---------------------------------------------------------------------------

describe('duplicateSnippet — circuit fields', () => {
  it('preserves circuitInstances in duplicate', () => {
    const original = library.addSnippet(makeInputWithCircuit());
    const dup = library.duplicateSnippet(original.id);

    expect(dup!.circuitInstances).toBeDefined();
    expect(dup!.circuitInstances).toHaveLength(3);
    expect(dup!.circuitInstances![0].label).toBe('R1');
  });

  it('preserves circuitNets in duplicate', () => {
    const original = library.addSnippet(makeInputWithCircuit());
    const dup = library.duplicateSnippet(original.id);

    expect(dup!.circuitNets).toBeDefined();
    expect(dup!.circuitNets).toHaveLength(3);
    expect(dup!.circuitNets![0].name).toBe('VIN');
  });

  it('duplicate without circuit fields omits them', () => {
    const original = library.addSnippet(makeInputWithoutCircuit());
    const dup = library.duplicateSnippet(original.id);

    expect(dup!.circuitInstances).toBeUndefined();
    expect(dup!.circuitNets).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Built-in snippets with circuit data
// ---------------------------------------------------------------------------

describe('Built-in snippets — circuit data', () => {
  it('builtin-decoupling-caps has circuitInstances', () => {
    const snippet = library.getSnippet('builtin-decoupling-caps');
    expect(snippet).toBeDefined();
    expect(snippet!.circuitInstances).toBeDefined();
    expect(snippet!.circuitInstances!.length).toBeGreaterThanOrEqual(2);
  });

  it('builtin-decoupling-caps has circuitNets', () => {
    const snippet = library.getSnippet('builtin-decoupling-caps');
    expect(snippet!.circuitNets).toBeDefined();
    expect(snippet!.circuitNets!.length).toBeGreaterThanOrEqual(2);
  });

  it('builtin-decoupling-caps circuitInstances have correct types', () => {
    const snippet = library.getSnippet('builtin-decoupling-caps');
    const types = snippet!.circuitInstances!.map((i) => i.type);
    expect(types.every((t) => t === 'capacitor')).toBe(true);
  });

  it('builtin-voltage-divider has circuitInstances', () => {
    const snippet = library.getSnippet('builtin-voltage-divider');
    expect(snippet!.circuitInstances).toBeDefined();
    expect(snippet!.circuitInstances!.length).toBeGreaterThanOrEqual(2);
  });

  it('builtin-voltage-divider circuitInstances are resistors', () => {
    const snippet = library.getSnippet('builtin-voltage-divider');
    const types = snippet!.circuitInstances!.map((i) => i.type);
    expect(types.every((t) => t === 'resistor')).toBe(true);
  });

  it('builtin-led-indicator has circuitInstances', () => {
    const snippet = library.getSnippet('builtin-led-indicator');
    expect(snippet!.circuitInstances).toBeDefined();
    expect(snippet!.circuitInstances!.length).toBeGreaterThanOrEqual(2);
  });

  it('built-in snippet circuit data is placed correctly', () => {
    const result = library.prepareForPlacement('builtin-decoupling-caps', { x: 100, y: 100 });
    expect(result).not.toBeNull();
    expect(result!.circuitInstances).toBeDefined();

    for (const inst of result!.circuitInstances!) {
      expect(inst.position.x).toBeGreaterThanOrEqual(100);
      expect(inst.position.y).toBeGreaterThanOrEqual(100);
    }
  });

  it('built-in snippet circuit net instanceIds are remapped on placement', () => {
    const result = library.prepareForPlacement('builtin-decoupling-caps', { x: 0, y: 0 });
    expect(result!.circuitNets).toBeDefined();

    const instanceIds = new Set(result!.circuitInstances!.map((i) => i.id));
    for (const net of result!.circuitNets!) {
      for (const pin of net.connectedPins) {
        expect(instanceIds.has(pin.instanceId)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Import/Export — circuit fields
// ---------------------------------------------------------------------------

describe('Import/Export — circuit fields roundtrip', () => {
  it('export includes circuit data', () => {
    library.addSnippet(makeInputWithCircuit());
    const json = library.exportToJson();
    const parsed = JSON.parse(json);
    const last = parsed[parsed.length - 1];
    expect(last.circuitInstances).toBeDefined();
    expect(last.circuitNets).toBeDefined();
  });

  it('import restores circuit data', () => {
    library.addSnippet(makeInputWithCircuit({ name: 'Circuit Export' }));
    const json = library.exportToJson();
    library.clear();
    library.importFromJson(json);

    const imported = library.search('Circuit Export');
    expect(imported).toHaveLength(1);
    expect(imported[0].circuitInstances).toHaveLength(3);
    expect(imported[0].circuitNets).toHaveLength(3);
  });
});
