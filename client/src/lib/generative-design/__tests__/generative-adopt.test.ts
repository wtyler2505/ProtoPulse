import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { CircuitIR } from '@/lib/circuit-dsl/circuit-ir';
import type { CandidateEntry } from '../generative-engine';
import type { FitnessResult } from '../fitness-scorer';
import {
  architectureToCurrentIR,
  compareCandidateWithCurrent,
  adoptCandidate,
  buildExportPayload,
  exportCandidate,
} from '../generative-adopt';
import type { Node, Edge } from '@xyflow/react';
import type { ComparisonResult, AdoptResult, ExportPayload } from '../generative-adopt';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFitness(overall = 0.85): FitnessResult {
  return {
    overall,
    breakdown: {
      componentCount: { score: 0.9, weight: 0.2, detail: '3 components' },
      estimatedCost: { score: 0.8, weight: 0.25, detail: '$2.00' },
    },
    violations: [],
    rank: 1,
  };
}

function makeIR(overrides?: Partial<CircuitIR>): CircuitIR {
  return {
    meta: { name: 'Test', version: '1.0.0' },
    components: [
      { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'OUT' } },
      { id: 'd1', refdes: 'D1', partId: 'led', pins: { anode: 'OUT', cathode: 'GND' } },
    ],
    nets: [
      { id: 'n1', name: 'VCC', type: 'power' },
      { id: 'n2', name: 'GND', type: 'ground' },
      { id: 'n3', name: 'OUT', type: 'signal' },
    ],
    wires: [],
    ...overrides,
  };
}

function makeCandidate(irOverrides?: Partial<CircuitIR>, fitness?: FitnessResult): CandidateEntry {
  return {
    id: 'cand-test-001',
    ir: makeIR(irOverrides),
    fitness: fitness ?? makeFitness(),
  };
}

// ---------------------------------------------------------------------------
// compareCandidateWithCurrent
// ---------------------------------------------------------------------------

describe('compareCandidateWithCurrent', () => {
  it('reports no differences when candidate matches current', () => {
    const ir = makeIR();
    const candidate = makeCandidate();
    const result = compareCandidateWithCurrent(candidate, ir);

    expect(result.componentsAdded).toBe(0);
    expect(result.componentsRemoved).toBe(0);
    expect(result.componentsChanged).toBe(0);
    expect(result.componentsUnchanged).toBe(2);
    expect(result.netsAdded).toBe(0);
    expect(result.netsRemoved).toBe(0);
    expect(result.netsUnchanged).toBe(3);
    expect(result.summary).toBe('No differences');
  });

  it('detects added components', () => {
    const current = makeIR({
      components: [
        { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'OUT' } },
      ],
    });
    const candidate = makeCandidate(); // has R1 + D1
    const result = compareCandidateWithCurrent(candidate, current);

    expect(result.componentsAdded).toBe(1);
    const added = result.componentDiffs.find((d) => d.status === 'added');
    expect(added).toBeDefined();
    expect(added?.refdes).toBe('D1');
  });

  it('detects removed components', () => {
    const current = makeIR({
      components: [
        { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'OUT' } },
        { id: 'd1', refdes: 'D1', partId: 'led', pins: { anode: 'OUT', cathode: 'GND' } },
        { id: 'c1', refdes: 'C1', partId: 'capacitor', value: '100nF', pins: { pin1: 'VCC', pin2: 'GND' } },
      ],
    });
    const candidate = makeCandidate(); // only R1 + D1
    const result = compareCandidateWithCurrent(candidate, current);

    expect(result.componentsRemoved).toBe(1);
    const removed = result.componentDiffs.find((d) => d.status === 'removed');
    expect(removed?.refdes).toBe('C1');
  });

  it('detects changed component partId', () => {
    const current = makeIR({
      components: [
        { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'OUT' } },
        { id: 'd1', refdes: 'D1', partId: 'diode', pins: { anode: 'OUT', cathode: 'GND' } },
      ],
    });
    const candidate = makeCandidate(); // D1 is 'led' in candidate
    const result = compareCandidateWithCurrent(candidate, current);

    expect(result.componentsChanged).toBe(1);
    const changed = result.componentDiffs.find((d) => d.status === 'changed');
    expect(changed?.refdes).toBe('D1');
    expect(changed?.details).toContain('Part changed');
  });

  it('detects changed component value', () => {
    const current = makeIR({
      components: [
        { id: 'r1', refdes: 'R1', partId: 'resistor', value: '4.7k', pins: { pin1: 'VCC', pin2: 'OUT' } },
        { id: 'd1', refdes: 'D1', partId: 'led', pins: { anode: 'OUT', cathode: 'GND' } },
      ],
    });
    const candidate = makeCandidate(); // R1 is '10k' in candidate
    const result = compareCandidateWithCurrent(candidate, current);

    expect(result.componentsChanged).toBe(1);
    const changed = result.componentDiffs.find((d) => d.status === 'changed');
    expect(changed?.refdes).toBe('R1');
    expect(changed?.details).toContain('Value changed');
  });

  it('detects added nets', () => {
    const current = makeIR({
      nets: [
        { id: 'n1', name: 'VCC', type: 'power' },
        { id: 'n2', name: 'GND', type: 'ground' },
      ],
    });
    const candidate = makeCandidate(); // has VCC, GND, OUT
    const result = compareCandidateWithCurrent(candidate, current);

    expect(result.netsAdded).toBe(1);
    const added = result.netDiffs.find((d) => d.status === 'added');
    expect(added?.name).toBe('OUT');
  });

  it('detects removed nets', () => {
    const current = makeIR({
      nets: [
        { id: 'n1', name: 'VCC', type: 'power' },
        { id: 'n2', name: 'GND', type: 'ground' },
        { id: 'n3', name: 'OUT', type: 'signal' },
        { id: 'n4', name: 'AUX', type: 'signal' },
      ],
    });
    const candidate = makeCandidate(); // has VCC, GND, OUT (no AUX)
    const result = compareCandidateWithCurrent(candidate, current);

    expect(result.netsRemoved).toBe(1);
    const removed = result.netDiffs.find((d) => d.status === 'removed');
    expect(removed?.name).toBe('AUX');
  });

  it('handles null currentIR (everything is added)', () => {
    const candidate = makeCandidate();
    const result = compareCandidateWithCurrent(candidate, null);

    expect(result.componentsAdded).toBe(2);
    expect(result.componentsRemoved).toBe(0);
    expect(result.netsAdded).toBe(3);
    expect(result.netsRemoved).toBe(0);
    expect(result.summary).toContain('2 components added');
    expect(result.summary).toContain('3 nets added');
  });

  it('handles empty candidate IR', () => {
    const current = makeIR();
    const candidate = makeCandidate({
      components: [],
      nets: [],
    });
    const result = compareCandidateWithCurrent(candidate, current);

    expect(result.componentsAdded).toBe(0);
    expect(result.componentsRemoved).toBe(2);
    expect(result.netsRemoved).toBe(3);
    expect(result.summary).toContain('2 components removed');
  });

  it('includes candidate fitness in result', () => {
    const fitness = makeFitness(0.72);
    const candidate = makeCandidate(undefined, fitness);
    const result = compareCandidateWithCurrent(candidate, null);

    expect(result.candidateFitness.overall).toBe(0.72);
  });

  it('builds a human-readable summary', () => {
    const current = makeIR({
      components: [
        { id: 'r1', refdes: 'R1', partId: 'resistor', value: '4.7k', pins: { pin1: 'VCC', pin2: 'OUT' } },
      ],
      nets: [
        { id: 'n1', name: 'VCC', type: 'power' },
      ],
    });
    const candidate = makeCandidate();
    const result = compareCandidateWithCurrent(candidate, current);

    // R1 changed (value), D1 added, OUT and GND nets added
    expect(result.summary).toContain('added');
    expect(result.summary).toContain('changed');
  });

  it('correctly categorizes unchanged components and nets', () => {
    const ir = makeIR();
    const candidate = makeCandidate();
    const result = compareCandidateWithCurrent(candidate, ir);

    expect(result.componentDiffs.every((d) => d.status === 'unchanged')).toBe(true);
    expect(result.netDiffs.every((d) => d.status === 'unchanged')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// adoptCandidate
// ---------------------------------------------------------------------------

describe('adoptCandidate', () => {
  it('creates architecture nodes for each component', () => {
    const candidate = makeCandidate();
    const result = adoptCandidate(candidate);

    expect(result.nodes).toHaveLength(2);
    expect(result.componentCount).toBe(2);
  });

  it('node IDs are prefixed with gen-', () => {
    const candidate = makeCandidate();
    const result = adoptCandidate(candidate);

    for (const node of result.nodes) {
      expect(node.nodeId).toMatch(/^gen-/);
    }
  });

  it('includes component metadata in node data', () => {
    const candidate = makeCandidate();
    const result = adoptCandidate(candidate);

    const r1Node = result.nodes.find((n) => n.nodeId === 'gen-r1');
    expect(r1Node).toBeDefined();
    expect(r1Node?.data).toMatchObject({
      generatedFrom: 'generative-design',
      candidateId: 'cand-test-001',
      irPartId: 'resistor',
      value: '10k',
    });
  });

  it('labels include refdes and value', () => {
    const candidate = makeCandidate();
    const result = adoptCandidate(candidate);

    const r1Node = result.nodes.find((n) => n.nodeId === 'gen-r1');
    expect(r1Node?.label).toBe('R1 (10k)');
  });

  it('labels omit value parentheses when value is undefined', () => {
    const candidate = makeCandidate({
      components: [
        { id: 'u1', refdes: 'U1', partId: 'opamp', pins: { in: 'VCC', out: 'OUT' } },
      ],
    });
    const result = adoptCandidate(candidate);
    const u1Node = result.nodes.find((n) => n.nodeId === 'gen-u1');
    expect(u1Node?.label).toBe('U1');
  });

  it('places nodes in a grid layout', () => {
    const candidate = makeCandidate({
      components: [
        { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'GND' } },
        { id: 'r2', refdes: 'R2', partId: 'resistor', value: '4.7k', pins: { pin1: 'VCC', pin2: 'GND' } },
        { id: 'r3', refdes: 'R3', partId: 'resistor', value: '1k', pins: { pin1: 'VCC', pin2: 'GND' } },
        { id: 'r4', refdes: 'R4', partId: 'resistor', value: '2.2k', pins: { pin1: 'VCC', pin2: 'GND' } },
        { id: 'r5', refdes: 'R5', partId: 'resistor', value: '100', pins: { pin1: 'VCC', pin2: 'GND' } },
      ],
      nets: [
        { id: 'n1', name: 'VCC', type: 'power' },
        { id: 'n2', name: 'GND', type: 'ground' },
      ],
    });
    const result = adoptCandidate(candidate);

    // 5 nodes in 4-column grid: first row has 4, second has 1
    expect(result.nodes[0].positionX).toBe(200); // col 0
    expect(result.nodes[1].positionX).toBe(400); // col 1
    expect(result.nodes[4].positionX).toBe(200); // col 0, row 1
    expect(result.nodes[4].positionY).toBeGreaterThan(result.nodes[0].positionY);
  });

  it('creates edges connecting components sharing nets', () => {
    const candidate = makeCandidate();
    const result = adoptCandidate(candidate);

    // R1 and D1 share 'OUT' net -> at least one edge
    expect(result.edges.length).toBeGreaterThan(0);
    const outEdge = result.edges.find((e) => e.label === 'OUT');
    expect(outEdge).toBeDefined();
    expect(outEdge?.source).toBe('gen-r1');
    expect(outEdge?.target).toBe('gen-d1');
  });

  it('edge IDs are prefixed with gen-edge-', () => {
    const candidate = makeCandidate();
    const result = adoptCandidate(candidate);

    for (const edge of result.edges) {
      expect(edge.edgeId).toMatch(/^gen-edge-/);
    }
  });

  it('returns correct net count', () => {
    const candidate = makeCandidate();
    const result = adoptCandidate(candidate);
    expect(result.netCount).toBe(3);
  });

  it('handles candidate with no components', () => {
    const candidate = makeCandidate({ components: [], nets: [] });
    const result = adoptCandidate(candidate);

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.componentCount).toBe(0);
    expect(result.netCount).toBe(0);
  });

  it('deduplicates components in net edge chains', () => {
    // A component with both pins on the same net should not self-loop
    const candidate = makeCandidate({
      components: [
        { id: 'r1', refdes: 'R1', partId: 'resistor', value: '10k', pins: { pin1: 'VCC', pin2: 'VCC' } },
      ],
      nets: [{ id: 'n1', name: 'VCC', type: 'power' }],
    });
    const result = adoptCandidate(candidate);

    // Only one unique component on VCC, so no edge needed
    expect(result.edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildExportPayload
// ---------------------------------------------------------------------------

describe('buildExportPayload', () => {
  it('returns correct format and version', () => {
    const candidate = makeCandidate();
    const payload = buildExportPayload(candidate);

    expect(payload.format).toBe('protopulse-candidate');
    expect(payload.version).toBe('1.0.0');
  });

  it('includes exportedAt timestamp', () => {
    const candidate = makeCandidate();
    const before = new Date().toISOString();
    const payload = buildExportPayload(candidate);
    const after = new Date().toISOString();

    expect(payload.exportedAt >= before).toBe(true);
    expect(payload.exportedAt <= after).toBe(true);
  });

  it('includes candidate id, ir, and fitness', () => {
    const candidate = makeCandidate();
    const payload = buildExportPayload(candidate);

    expect(payload.candidate.id).toBe('cand-test-001');
    expect(payload.candidate.ir.components).toHaveLength(2);
    expect(payload.candidate.fitness.overall).toBe(0.85);
  });

  it('produces valid JSON', () => {
    const candidate = makeCandidate();
    const payload = buildExportPayload(candidate);
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json) as ExportPayload;

    expect(parsed.format).toBe('protopulse-candidate');
    expect(parsed.candidate.id).toBe('cand-test-001');
  });
});

// ---------------------------------------------------------------------------
// exportCandidate (browser download)
// ---------------------------------------------------------------------------

describe('exportCandidate', () => {
  let createObjectURLSpy: Mock;
  let revokeObjectURLSpy: Mock;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let clickedLink: HTMLAnchorElement | null = null;

  beforeEach(() => {
    clickedLink = null;
    createObjectURLSpy = vi.fn() as Mock;
    createObjectURLSpy.mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.fn() as Mock;
    globalThis.URL.createObjectURL = createObjectURLSpy as unknown as typeof URL.createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy as unknown as typeof URL.revokeObjectURL;

    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      clickedLink = node as HTMLAnchorElement;
      return node;
    });
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Blob with JSON content', () => {
    const candidate = makeCandidate();
    exportCandidate(candidate);

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
  });

  it('sets download filename with candidate id', () => {
    const candidate = makeCandidate();
    exportCandidate(candidate);

    expect(clickedLink).not.toBeNull();
    expect(clickedLink?.download).toBe('candidate-cand-test-001.json');
  });

  it('appends and removes link from DOM', () => {
    const candidate = makeCandidate();
    exportCandidate(candidate);

    expect(appendChildSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledOnce();
  });

  it('revokes the object URL after click', () => {
    const candidate = makeCandidate();
    exportCandidate(candidate);

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('sets noopener noreferrer on the link', () => {
    const candidate = makeCandidate();
    exportCandidate(candidate);

    expect(clickedLink?.rel).toBe('noopener noreferrer');
  });
});

// ---------------------------------------------------------------------------
// architectureToCurrentIR
// ---------------------------------------------------------------------------

describe('architectureToCurrentIR', () => {
  it('returns an empty-component IR when there are no nodes', () => {
    const ir = architectureToCurrentIR([], []);
    expect(ir.components).toEqual([]);
    expect(ir.nets).toEqual([]);
    expect(ir.meta.name).toBe('Current Architecture');
  });

  it('derives components from architecture nodes using label + type', () => {
    const nodes: Node[] = [
      {
        id: 'node-1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'U1', type: 'mcu' },
      },
      {
        id: 'node-2',
        type: 'custom',
        position: { x: 200, y: 0 },
        data: { label: 'R1', type: 'resistor' },
      },
    ];
    const ir = architectureToCurrentIR(nodes, []);
    expect(ir.components).toHaveLength(2);
    expect(ir.components[0]).toMatchObject({ id: 'node-1', refdes: 'U1', partId: 'mcu' });
    expect(ir.components[1]).toMatchObject({ id: 'node-2', refdes: 'R1', partId: 'resistor' });
    // Synthetic pin inserted because there are no edges
    expect(Object.keys(ir.components[0].pins)).toHaveLength(1);
  });

  it('preserves IR-native metadata on previously adopted generative nodes', () => {
    const nodes: Node[] = [
      {
        id: 'gen-c1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: 'C1 (0.1uF)',
          type: 'capacitor',
          irRefdes: 'C1',
          irPartId: 'capacitor',
          value: '0.1uF',
          pins: { pin1: 'VCC', pin2: 'GND' },
        },
      },
    ];
    const ir = architectureToCurrentIR(nodes, []);
    expect(ir.components[0].refdes).toBe('C1');
    expect(ir.components[0].partId).toBe('capacitor');
    expect(ir.components[0].value).toBe('0.1uF');
    expect(ir.components[0].pins).toEqual({ pin1: 'VCC', pin2: 'GND' });
  });

  it('derives pins from connected edges and builds nets with type inference', () => {
    const nodes: Node[] = [
      { id: 'a', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'A', type: 'mcu' } },
      { id: 'b', type: 'custom', position: { x: 200, y: 0 }, data: { label: 'B', type: 'led' } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b', label: 'VCC' },
      { id: 'e2', source: 'a', target: 'b', label: 'GND' },
      { id: 'e3', source: 'a', target: 'b', label: 'DATA' },
    ];
    const ir = architectureToCurrentIR(nodes, edges);
    // Pins derived from edge labels
    expect(Object.values(ir.components[0].pins)).toEqual(expect.arrayContaining(['VCC', 'GND', 'DATA']));
    // Net types inferred
    const byName = new Map(ir.nets.map((n) => [n.name, n.type]));
    expect(byName.get('VCC')).toBe('power');
    expect(byName.get('GND')).toBe('ground');
    expect(byName.get('DATA')).toBe('signal');
  });

  it('produces a comparison against a candidate that reflects the real project, not defaultBaseCircuit', () => {
    // Simulates audit C-1: current project holds U1 (mcu) and R2 (resistor).
    // Candidate has R2 (unchanged) + new C1 (capacitor). Comparison should
    // show U1 as REMOVED and C1 as ADDED — NOT fall back to the R1 stub.
    const nodes: Node[] = [
      { id: 'u1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'U1', type: 'mcu' } },
      { id: 'r2', type: 'custom', position: { x: 200, y: 0 }, data: { label: 'R2', type: 'resistor', value: '1k' } },
    ];
    const currentIR = architectureToCurrentIR(nodes, []);
    const candidate: CandidateEntry = {
      id: 'cand-x',
      generation: 1,
      parentIds: [],
      ir: {
        meta: { name: 'variant', version: '1.0.0' },
        components: [
          { id: 'r2', refdes: 'R2', partId: 'resistor', value: '1k', pins: { pin1: 'VCC', pin2: 'OUT' } },
          { id: 'c1', refdes: 'C1', partId: 'capacitor', value: '10uF', pins: { pin1: 'VCC', pin2: 'GND' } },
        ],
        nets: [
          { id: 'n1', name: 'VCC', type: 'power' },
          { id: 'n2', name: 'GND', type: 'ground' },
          { id: 'n3', name: 'OUT', type: 'signal' },
        ],
        wires: [],
      },
      fitness: makeFitness(),
    };

    const result = compareCandidateWithCurrent(candidate, currentIR);
    const addedRefdes = result.componentDiffs.filter((d) => d.status === 'added').map((d) => d.refdes);
    const removedRefdes = result.componentDiffs.filter((d) => d.status === 'removed').map((d) => d.refdes);
    expect(addedRefdes).toContain('C1');
    expect(removedRefdes).toContain('U1');
    // The R1 stub fingerprint MUST NOT appear as a "removed" component
    expect(removedRefdes).not.toContain('R1');
  });
});
