import { materialize, SCHEMATIC_GRID } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { importLegacy, mapLegacyPart } from './legacy.js';

/**
 * Importer tests run against a realistic legacy snapshot: connector
 * ids in the legacy 'pinN' form, BOTH segment generations
 * ({instanceId, pinId} and {fromInstanceId, …}), an unmappable part,
 * and dirty data (a port claimed by two nets).
 */

const G = SCHEMATIC_GRID;

/** Two-terminal legacy connectors, ids pin1/pin2 like the standard library. */
function twoTerminal(nameA = '1', nameB = '2') {
  return [
    { id: 'pin1', name: nameA, connectorType: 'pad' },
    { id: 'pin2', name: nameB, connectorType: 'pad' },
  ];
}

function snapshot() {
  return {
    project: { name: 'My Bench Project' },
    parts: [
      { id: 11, meta: { title: '10k Resistor', category: 'Passives', tags: ['resistor'] }, connectors: twoTerminal() },
      { id: 12, meta: { title: 'Red LED', category: 'LEDs', mpn: 'HLMP-1301' }, connectors: twoTerminal() },
      { id: 13, meta: { title: 'LDR — Light Dependent Resistor', category: 'Sensors', tags: ['LDR', 'photoresistor'] }, connectors: twoTerminal() },
      { id: 14, meta: { title: 'NPN Transistor', category: 'Transistors', mpn: 'BC547' }, connectors: [
        { id: 'pin1', name: 'E' },
        { id: 'pin2', name: 'B' },
        { id: 'pin3', name: 'C' },
      ] },
    ],
    designs: [
      {
        id: 1,
        name: 'Main Circuit',
        instances: [
          { id: 101, referenceDesignator: 'R1', partId: 11, schematicX: 100, schematicY: 50, schematicRotation: 0, properties: { value: '10k' } },
          { id: 102, referenceDesignator: 'D1', partId: 12, schematicX: 200, schematicY: 50, schematicRotation: 88, properties: {} },
          { id: 103, referenceDesignator: 'LDR1', partId: 13, schematicX: 300, schematicY: 50, schematicRotation: 0, properties: {} },
          { id: 104, referenceDesignator: 'Q1', partId: 14, schematicX: 150, schematicY: 150, schematicRotation: 0, properties: {} },
        ],
        nets: [
          // Old segment generation: pairwise from/to with connector IDS.
          { id: 201, name: 'LED_K', segments: [
            { fromInstanceId: 101, fromPin: 'pin2', toInstanceId: 102, toPin: 'pin1' },
          ] },
          // New generation: {instanceId, pinId} with connector NAMES.
          { id: 202, name: 'BASE', segments: [
            { instanceId: 104, pinId: 'B' },
            { instanceId: 102, pinId: '2' },
          ] },
          // Dirty data: claims R1 pin2 again — first net wins.
          { id: 203, name: 'DUPE', segments: [
            { instanceId: 101, pinId: 'pin2' },
            { instanceId: 104, pinId: 'C' },
          ] },
          // References the skipped LDR only — nothing importable.
          { id: 204, name: 'SENSE', segments: [{ instanceId: 103, pinId: 'pin1' }] },
        ],
      },
      { id: 2, name: 'Sub Sheet', instances: [], nets: [] },
    ],
  };
}

describe('mapLegacyPart', () => {
  it('maps the seed-covered kinds and refuses what it cannot honor', () => {
    expect(mapLegacyPart({ title: '10k Resistor' })?.partId).toBe('core:resistor');
    expect(mapLegacyPart({ title: '100nF Ceramic Capacitor' })?.partId).toBe('core:capacitor');
    expect(mapLegacyPart({ title: '10µF Electrolytic Capacitor' })?.partId).toBe('core:capacitor-electrolytic');
    expect(mapLegacyPart({ mpn: '1N4148' })?.partId).toBe('core:1n4148');
    expect(mapLegacyPart({ mpn: 'BAT54S' })?.partId).toBe('core:bat54s');
    expect(mapLegacyPart({ title: 'NE555 Timer' })?.partId).toBe('core:ne555');
    expect(mapLegacyPart({ title: 'Tactile Pushbutton' })?.partId).toBe('core:pushbutton');
    // Generic NPN maps with a note; the LDR refuses (not a fixed resistor).
    const npn = mapLegacyPart({ title: 'NPN Transistor' });
    expect(npn?.partId).toBe('core:2n3904');
    expect(npn?.note).toContain('2N3904');
    expect(mapLegacyPart({ title: 'LDR — Light Dependent Resistor', tags: ['photoresistor'] })).toBeNull();
    expect(mapLegacyPart({ title: 'Mystery Module' })).toBeNull();
  });
});

describe('importLegacy', () => {
  it('produces a sound bundle: components, values, placements, nets', () => {
    const { bundle, report } = importLegacy(snapshot());

    expect(bundle.designId).toBe('my-bench-project');
    expect(report.problems).toEqual([]);
    expect(report.components).toBe(3); // R1, D1, Q1 — LDR skipped
    expect(report.skipped.join('\n')).toContain('LDR1');

    const ops = bundle.branches[0]?.ops ?? [];
    const result = materialize(ops);
    expect(result.warnings).toEqual([]);
    expect(result.violations).toEqual([]);
    const g = result.graph;

    // Components with refs and the explicit value.
    const r1 = g.components.get('legacy-101');
    expect(r1?.ref).toBe('R1');
    expect(r1?.partId).toBe('core:resistor');
    expect(r1?.value).toBe('10k');

    // Placement: 100px → 4 grid steps; rotation 88° snaps to 90.
    expect(g.schematic.placements.get('legacy-101')?.at).toEqual({ x: 4 * G, y: 2 * G });
    expect(g.schematic.placements.get('legacy-102')?.rot).toBe(90);
  });

  it('resolves both segment generations, connector ids AND names, by-name pin mapping', () => {
    const { bundle } = importLegacy(snapshot());
    const g = materialize(bundle.branches[0]?.ops ?? []).graph;

    const byName = new Map([...g.nets.values()].map((n) => [n.name, n]));
    // LED_K: R1 pin2 (id) + D1 pin1 (id → name '1' → ordinal → engine 'A').
    expect(byName.get('LED_K')?.ports.slice().sort()).toEqual(['legacy-101:2', 'legacy-102:A']);
    // BASE: Q1 'B' by name + D1 '2' (name → ordinal → engine 'K').
    expect(byName.get('BASE')?.ports.slice().sort()).toEqual(['legacy-102:K', 'legacy-104:B']);
  });

  it('dirty data degrades with reasons, never silently', () => {
    const { bundle, report } = importLegacy(snapshot());
    const g = materialize(bundle.branches[0]?.ops ?? []).graph;
    const byName = new Map([...g.nets.values()].map((n) => [n.name, n]));

    // DUPE wanted R1 pin2 — already on LED_K; it keeps only Q1's C.
    expect(byName.get('DUPE')?.ports).toEqual(['legacy-104:C']);
    expect(report.skipped.join('\n')).toContain('already on another net');
    // SENSE only touched the skipped LDR — the whole net is skipped.
    expect(byName.has('SENSE')).toBe(false);
    expect(report.skipped.join('\n')).toContain('net SENSE');
    // The second design is noted, not imported.
    expect(report.notes.join('\n')).toContain('Sub Sheet');
  });

  it('duplicate reference designators are uniquified, never a broken bundle', () => {
    // Real legacy DBs contain duplicate refdes rows (no unique constraint).
    // Found 2026-06-12 with a synthetic snapshot: the second add_component
    // was rejected ("ref designator R1 already in use") and every later op
    // touching that component cascaded into problems.
    const s = snapshot();
    s.designs[0]!.instances.push({
      id: 105,
      referenceDesignator: 'R1',
      partId: 11,
      schematicX: 400,
      schematicY: 50,
      schematicRotation: 0,
      properties: {},
    });
    s.designs[0]!.nets.push({
      id: 205,
      name: 'DUPREF',
      segments: [{ instanceId: 105, pinId: 'pin1' }, { instanceId: 104, pinId: 'E' }],
    });

    const { bundle, report } = importLegacy(s);
    expect(report.problems).toEqual([]);
    expect(report.components).toBe(4);
    expect(report.notes.join('\n')).toContain('R1');

    const g = materialize(bundle.branches[0]?.ops ?? []).graph;
    const refs = [...g.components.values()].map((c) => c.ref).sort();
    expect(new Set(refs).size).toBe(refs.length); // all unique
    // Its net still imported against the renamed component.
    const byName = new Map([...g.nets.values()].map((n) => [n.name, n]));
    expect(byName.get('DUPREF')?.ports).toContain('legacy-105:1');
  });

  it('unicode survives: project name slug, refs, net names, values', () => {
    const s = snapshot();
    s.project.name = 'Ünïcode — Nasty 🚀 Edge/Case!!';
    s.designs[0]!.nets[1]!.name = 'NÉT_ÜNI';
    const { bundle, report } = importLegacy(s);
    expect(report.problems).toEqual([]);
    expect(bundle.designId).not.toBe(''); // slug never collapses to empty
    const g = materialize(bundle.branches[0]?.ops ?? []).graph;
    expect([...g.nets.values()].some((n) => n.name === 'NÉT_ÜNI')).toBe(true);
  });

  it('--design selects by name; an unknown name throws with the list', () => {
    const { report } = importLegacy(snapshot(), 'Sub Sheet');
    expect(report.designName).toBe('Sub Sheet');
    expect(report.components).toBe(0);
    expect(() => importLegacy(snapshot(), 'nope')).toThrow('Main Circuit');
  });
});
