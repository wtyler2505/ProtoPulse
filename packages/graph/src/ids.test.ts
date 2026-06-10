import { describe, expect, it } from 'vitest';

import { newUuid, randomIds, sequentialIds } from './ids.js';
import {
  insertPortSorted,
  makePortRef,
  MM,
  parsePortRef,
  SCHEMATIC_GRID,
} from './types.js';

describe('ids', () => {
  it('generates v7 UUIDs (time-sortable)', () => {
    const a = newUuid();
    const b = randomIds.next();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(b).not.toBe(a);
  });

  it('sequentialIds is deterministic, monotonic, and UUID-shaped', () => {
    const src = sequentialIds(7);
    const first = src.next();
    const second = src.next();
    expect(first).toBe('00000007-0000-7000-8000-000000000001');
    expect(second).toBe('00000007-0000-7000-8000-000000000002');
    expect(sequentialIds(7).next()).toBe(first);
    expect(sequentialIds().next()).toBe('00000000-0000-7000-8000-000000000001');
  });
});

describe('port refs and constants', () => {
  it('round-trips port refs, including pin keys containing colons-free text', () => {
    const ref = makePortRef('comp-1', 'PA12');
    expect(ref).toBe('comp-1:PA12');
    expect(parsePortRef(ref)).toEqual({ componentId: 'comp-1', pinKey: 'PA12' });
  });

  it('throws on malformed port refs', () => {
    expect(() => parsePortRef('no-colon')).toThrow('Malformed PortRef');
  });

  it('grid constants are integer nanometers', () => {
    expect(MM).toBe(1_000_000);
    expect(SCHEMATIC_GRID).toBe(1_270_000);
  });

  it('insertPortSorted keeps order and ignores duplicates', () => {
    const ports: string[] = [];
    insertPortSorted(ports, 'b:1');
    insertPortSorted(ports, 'a:1');
    insertPortSorted(ports, 'c:1');
    insertPortSorted(ports, 'b:1');
    expect(ports).toEqual(['a:1', 'b:1', 'c:1']);
  });
});
