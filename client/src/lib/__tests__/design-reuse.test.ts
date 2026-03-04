import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SnippetLibrary, useDesignSnippets } from '../design-reuse';
import type { CreateSnippetInput, DesignSnippet, SnippetCategory } from '../design-reuse';

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

function makeInput(overrides?: Partial<CreateSnippetInput>): CreateSnippetInput {
  return {
    name: 'Test Snippet',
    category: 'analog',
    description: 'A test snippet',
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
// Singleton
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = SnippetLibrary.getInstance();
    const b = SnippetLibrary.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = SnippetLibrary.getInstance();
    SnippetLibrary.resetForTesting();
    const second = SnippetLibrary.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Built-in snippets
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Built-in Snippets', () => {
  it('loads 5 built-in snippets on first init', () => {
    expect(library.getAllSnippets()).toHaveLength(5);
  });

  it('built-ins have expected IDs', () => {
    const ids = library.getAllSnippets().map((s) => s.id);
    expect(ids).toContain('builtin-voltage-divider');
    expect(ids).toContain('builtin-led-indicator');
    expect(ids).toContain('builtin-decoupling-caps');
    expect(ids).toContain('builtin-pull-up-array');
    expect(ids).toContain('builtin-bypass-filter');
  });

  it('built-ins have valid categories', () => {
    const validCategories: SnippetCategory[] = [
      'power', 'sensor', 'communication', 'motor-control',
      'filtering', 'protection', 'digital', 'analog', 'custom',
    ];
    for (const snippet of library.getAllSnippets()) {
      expect(validCategories).toContain(snippet.category);
    }
  });

  it('built-ins have nodes, edges, and wires', () => {
    for (const snippet of library.getAllSnippets()) {
      expect(snippet.nodes.length).toBeGreaterThan(0);
      expect(snippet.edges.length).toBeGreaterThan(0);
      expect(snippet.wires.length).toBeGreaterThan(0);
    }
  });

  it('built-ins have author ProtoPulse', () => {
    for (const snippet of library.getAllSnippets()) {
      expect(snippet.metadata.author).toBe('ProtoPulse');
    }
  });
});

// ---------------------------------------------------------------------------
// CRUD — Add
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Add', () => {
  it('adds a snippet and returns it', () => {
    const snippet = library.addSnippet(makeInput());
    expect(snippet.name).toBe('Test Snippet');
    expect(snippet.category).toBe('analog');
    expect(snippet.description).toBe('A test snippet');
    expect(snippet.tags).toEqual(['test']);
    expect(snippet.nodes).toHaveLength(2);
    expect(snippet.edges).toHaveLength(1);
    expect(snippet.wires).toHaveLength(1);
  });

  it('assigns a UUID id', () => {
    const snippet = library.addSnippet(makeInput());
    expect(snippet.id).toMatch(/^uuid-/);
  });

  it('sets metadata timestamps', () => {
    const before = Date.now();
    const snippet = library.addSnippet(makeInput());
    const after = Date.now();
    expect(snippet.metadata.createdAt).toBeGreaterThanOrEqual(before);
    expect(snippet.metadata.createdAt).toBeLessThanOrEqual(after);
    expect(snippet.metadata.updatedAt).toBe(snippet.metadata.createdAt);
  });

  it('initializes version, usageCount, and rating to defaults', () => {
    const snippet = library.addSnippet(makeInput());
    expect(snippet.metadata.version).toBe(1);
    expect(snippet.metadata.usageCount).toBe(0);
    expect(snippet.metadata.rating).toBe(0);
  });

  it('defaults author to User', () => {
    const snippet = library.addSnippet(makeInput());
    expect(snippet.metadata.author).toBe('User');
  });

  it('accepts custom author', () => {
    const snippet = library.addSnippet(makeInput({ author: 'Tyler' }));
    expect(snippet.metadata.author).toBe('Tyler');
  });

  it('defaults optional fields', () => {
    const snippet = library.addSnippet({ name: 'Minimal', category: 'custom' });
    expect(snippet.description).toBe('');
    expect(snippet.tags).toEqual([]);
    expect(snippet.nodes).toEqual([]);
    expect(snippet.edges).toEqual([]);
    expect(snippet.wires).toEqual([]);
  });

  it('increases snippet count', () => {
    const countBefore = library.getAllSnippets().length;
    library.addSnippet(makeInput());
    expect(library.getAllSnippets()).toHaveLength(countBefore + 1);
  });
});

// ---------------------------------------------------------------------------
// CRUD — Get
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Get', () => {
  it('gets a snippet by ID', () => {
    const added = library.addSnippet(makeInput());
    const found = library.getSnippet(added.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(added.id);
  });

  it('returns undefined for unknown ID', () => {
    expect(library.getSnippet('nonexistent')).toBeUndefined();
  });

  it('getAllSnippets returns a copy', () => {
    const all1 = library.getAllSnippets();
    const all2 = library.getAllSnippets();
    expect(all1).not.toBe(all2);
    expect(all1).toEqual(all2);
  });
});

// ---------------------------------------------------------------------------
// CRUD — Update
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Update', () => {
  it('updates name and description', () => {
    const snippet = library.addSnippet(makeInput());
    const updated = library.updateSnippet(snippet.id, { name: 'Updated Name', description: 'New desc' });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.description).toBe('New desc');
  });

  it('updates category and tags', () => {
    const snippet = library.addSnippet(makeInput());
    const updated = library.updateSnippet(snippet.id, { category: 'power', tags: ['power', 'supply'] });
    expect(updated!.category).toBe('power');
    expect(updated!.tags).toEqual(['power', 'supply']);
  });

  it('increments version on update', () => {
    const snippet = library.addSnippet(makeInput());
    expect(snippet.metadata.version).toBe(1);
    const updated = library.updateSnippet(snippet.id, { name: 'V2' });
    expect(updated!.metadata.version).toBe(2);
    const updated2 = library.updateSnippet(snippet.id, { name: 'V3' });
    expect(updated2!.metadata.version).toBe(3);
  });

  it('updates updatedAt timestamp', () => {
    const snippet = library.addSnippet(makeInput());
    const originalUpdatedAt = snippet.metadata.updatedAt;
    const updated = library.updateSnippet(snippet.id, { name: 'Later' });
    expect(updated!.metadata.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('updates nodes, edges, and wires', () => {
    const snippet = library.addSnippet(makeInput());
    const newNodes = [{ id: 'x1', type: 'cap', label: 'C1', properties: {}, position: { x: 50, y: 50 } }];
    const updated = library.updateSnippet(snippet.id, { nodes: newNodes, edges: [], wires: [] });
    expect(updated!.nodes).toHaveLength(1);
    expect(updated!.nodes[0].id).toBe('x1');
    expect(updated!.edges).toHaveLength(0);
    expect(updated!.wires).toHaveLength(0);
  });

  it('returns null for unknown ID', () => {
    expect(library.updateSnippet('nonexistent', { name: 'Nope' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CRUD — Remove
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Remove', () => {
  it('removes a snippet by ID', () => {
    const snippet = library.addSnippet(makeInput());
    expect(library.removeSnippet(snippet.id)).toBe(true);
    expect(library.getSnippet(snippet.id)).toBeUndefined();
  });

  it('returns false for unknown ID', () => {
    expect(library.removeSnippet('nonexistent')).toBe(false);
  });

  it('decreases snippet count', () => {
    const snippet = library.addSnippet(makeInput());
    const countBefore = library.getAllSnippets().length;
    library.removeSnippet(snippet.id);
    expect(library.getAllSnippets()).toHaveLength(countBefore - 1);
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Search', () => {
  beforeEach(() => {
    library.addSnippet(makeInput({ name: 'Voltage Regulator', description: 'LDO circuit', tags: ['power', 'ldo'] }));
    library.addSnippet(makeInput({ name: 'LED Driver', description: 'Constant current', tags: ['led', 'driver'] }));
    library.addSnippet(makeInput({ name: 'Motor H-Bridge', description: 'Bidirectional motor', tags: ['motor'] }));
  });

  it('finds by name', () => {
    const results = library.search('voltage');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.name === 'Voltage Regulator')).toBe(true);
  });

  it('finds by description', () => {
    const results = library.search('constant current');
    expect(results.some((s) => s.name === 'LED Driver')).toBe(true);
  });

  it('finds by tag', () => {
    const results = library.search('motor');
    expect(results.some((s) => s.name === 'Motor H-Bridge')).toBe(true);
  });

  it('search is case-insensitive', () => {
    const results = library.search('VOLTAGE');
    expect(results.some((s) => s.name === 'Voltage Regulator')).toBe(true);
  });

  it('returns empty array for no matches', () => {
    const results = library.search('zzz-nonexistent-zzz');
    expect(results).toHaveLength(0);
  });

  it('returns all snippets for empty string', () => {
    const results = library.search('');
    expect(results.length).toBe(library.getAllSnippets().length);
  });
});

// ---------------------------------------------------------------------------
// Category filtering
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Category', () => {
  it('filters by category', () => {
    library.addSnippet(makeInput({ name: 'Power1', category: 'power' }));
    library.addSnippet(makeInput({ name: 'Digital1', category: 'digital' }));

    const power = library.getByCategory('power');
    expect(power.length).toBeGreaterThanOrEqual(1);
    for (const s of power) {
      expect(s.category).toBe('power');
    }
  });

  it('returns empty for unused category', () => {
    expect(library.getByCategory('sensor')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Duplicate', () => {
  it('duplicates a snippet with default name', () => {
    const original = library.addSnippet(makeInput({ name: 'Original' }));
    const dup = library.duplicateSnippet(original.id);
    expect(dup).not.toBeNull();
    expect(dup!.name).toBe('Original (Copy)');
    expect(dup!.id).not.toBe(original.id);
  });

  it('duplicates with custom name', () => {
    const original = library.addSnippet(makeInput({ name: 'Original' }));
    const dup = library.duplicateSnippet(original.id, 'My Custom Copy');
    expect(dup!.name).toBe('My Custom Copy');
  });

  it('duplicate has fresh metadata', () => {
    const original = library.addSnippet(makeInput());
    library.incrementUsage(original.id);
    library.rateSnippet(original.id, 5);
    const dup = library.duplicateSnippet(original.id);
    expect(dup!.metadata.usageCount).toBe(0);
    expect(dup!.metadata.rating).toBe(0);
    expect(dup!.metadata.version).toBe(1);
  });

  it('duplicate preserves nodes, edges, wires', () => {
    const original = library.addSnippet(makeInput());
    const dup = library.duplicateSnippet(original.id);
    expect(dup!.nodes).toHaveLength(original.nodes.length);
    expect(dup!.edges).toHaveLength(original.edges.length);
    expect(dup!.wires).toHaveLength(original.wires.length);
  });

  it('returns null for unknown ID', () => {
    expect(library.duplicateSnippet('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Usage counting
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Usage', () => {
  it('increments usage count', () => {
    const snippet = library.addSnippet(makeInput());
    expect(snippet.metadata.usageCount).toBe(0);
    library.incrementUsage(snippet.id);
    expect(library.getSnippet(snippet.id)!.metadata.usageCount).toBe(1);
    library.incrementUsage(snippet.id);
    expect(library.getSnippet(snippet.id)!.metadata.usageCount).toBe(2);
  });

  it('no-op for unknown ID', () => {
    // Should not throw
    library.incrementUsage('nonexistent');
  });
});

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Rating', () => {
  it('rates a snippet within range', () => {
    const snippet = library.addSnippet(makeInput());
    library.rateSnippet(snippet.id, 4);
    expect(library.getSnippet(snippet.id)!.metadata.rating).toBe(4);
  });

  it('clamps rating below 1', () => {
    const snippet = library.addSnippet(makeInput());
    library.rateSnippet(snippet.id, 0);
    expect(library.getSnippet(snippet.id)!.metadata.rating).toBe(1);
  });

  it('clamps rating above 5', () => {
    const snippet = library.addSnippet(makeInput());
    library.rateSnippet(snippet.id, 10);
    expect(library.getSnippet(snippet.id)!.metadata.rating).toBe(5);
  });

  it('rounds fractional ratings', () => {
    const snippet = library.addSnippet(makeInput());
    library.rateSnippet(snippet.id, 3.7);
    expect(library.getSnippet(snippet.id)!.metadata.rating).toBe(4);
  });

  it('no-op for unknown ID', () => {
    library.rateSnippet('nonexistent', 5);
  });
});

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

describe('SnippetLibrary — prepareForPlacement', () => {
  it('returns null for unknown ID', () => {
    expect(library.prepareForPlacement('nonexistent', { x: 0, y: 0 })).toBeNull();
  });

  it('remaps all node IDs to new UUIDs', () => {
    const snippet = library.addSnippet(makeInput());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });
    expect(result).not.toBeNull();
    expect(result!.nodeIdMap.size).toBe(2);

    // All new IDs should be different from originals
    result!.nodeIdMap.forEach((newId, oldId) => {
      expect(newId).not.toBe(oldId);
    });

    // Placed nodes should use new IDs
    const newIds: string[] = [];
    result!.nodeIdMap.forEach((newId) => {
      newIds.push(newId);
    });
    for (const node of result!.nodes) {
      expect(newIds.includes(node.id)).toBe(true);
    }
  });

  it('offsets node positions', () => {
    const snippet = library.addSnippet(makeInput());
    const originalNodes = snippet.nodes;
    const result = library.prepareForPlacement(snippet.id, { x: 200, y: 300 });

    for (let i = 0; i < result!.nodes.length; i++) {
      expect(result!.nodes[i].position.x).toBe(originalNodes[i].position.x + 200);
      expect(result!.nodes[i].position.y).toBe(originalNodes[i].position.y + 300);
    }
  });

  it('remaps edge source and target IDs', () => {
    const snippet = library.addSnippet(makeInput());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });
    const newNodeIds: string[] = [];
    result!.nodeIdMap.forEach((newId) => {
      newNodeIds.push(newId);
    });
    for (const edge of result!.edges) {
      expect(newNodeIds.includes(edge.source)).toBe(true);
      expect(newNodeIds.includes(edge.target)).toBe(true);
    }
  });

  it('remaps wire pin references', () => {
    const snippet = library.addSnippet(makeInput());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });

    // Original wires had "n1:2" and "n2:1"
    // After remapping, they should start with the new node IDs
    for (const wire of result!.wires) {
      // Neither startPin nor endPin should start with original node IDs
      expect(wire.startPin.startsWith('n1:')).toBe(false);
      expect(wire.endPin.startsWith('n2:')).toBe(false);
    }
  });

  it('assigns new IDs to edges', () => {
    const snippet = library.addSnippet(makeInput());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });
    for (const edge of result!.edges) {
      expect(edge.id).not.toBe('e1');
    }
  });

  it('assigns new IDs to wires', () => {
    const snippet = library.addSnippet(makeInput());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });
    for (const wire of result!.wires) {
      expect(wire.id).not.toBe('w1');
    }
  });

  it('preserves wire netName', () => {
    const snippet = library.addSnippet(makeInput());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });
    expect(result!.wires[0].netName).toBe('mid');
  });

  it('preserves node properties', () => {
    const snippet = library.addSnippet(makeInput());
    const result = library.prepareForPlacement(snippet.id, { x: 0, y: 0 });
    const r1 = result!.nodes.find((n) => n.label === 'R1');
    expect(r1).toBeDefined();
    expect(r1!.properties.value).toBe('10k');
  });
});

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Import/Export', () => {
  it('exports all snippets as JSON string', () => {
    const json = library.exportToJson();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(library.getAllSnippets().length);
  });

  it('roundtrips export → import', () => {
    library.addSnippet(makeInput({ name: 'Custom1' }));
    const json = library.exportToJson();
    library.clear();
    expect(library.getAllSnippets()).toHaveLength(0);
    const result = library.importFromJson(json);
    expect(result.imported).toBe(6); // 5 built-in + 1 custom
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('skips duplicate IDs on import', () => {
    const json = library.exportToJson();
    // Import again without clearing — all should be skipped
    const result = library.importFromJson(json);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(5);
  });

  it('handles malformed JSON', () => {
    const result = library.importFromJson('not valid json{{{');
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('handles non-array JSON', () => {
    const result = library.importFromJson('{"key": "value"}');
    expect(result.imported).toBe(0);
    expect(result.errors[0]).toContain('array');
  });

  it('handles non-object entries in array', () => {
    const result = library.importFromJson('[42, "string", null]');
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(3);
  });

  it('skips entries missing required fields', () => {
    const result = library.importFromJson('[{"id": "x"}]');
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips entries missing nodes/edges/wires arrays', () => {
    const result = library.importFromJson(
      '[{"id":"x","name":"Bad","category":"power","nodes":[],"edges":[],"metadata":{}}]',
    );
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Popular & Recent
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Popular & Recent', () => {
  it('getPopular returns snippets sorted by usage count descending', () => {
    const s1 = library.addSnippet(makeInput({ name: 'Low Usage' }));
    const s2 = library.addSnippet(makeInput({ name: 'High Usage' }));
    library.incrementUsage(s2.id);
    library.incrementUsage(s2.id);
    library.incrementUsage(s2.id);
    library.incrementUsage(s1.id);

    const popular = library.getPopular();
    expect(popular[0].name).toBe('High Usage');
  });

  it('getPopular respects limit', () => {
    const popular = library.getPopular(2);
    expect(popular).toHaveLength(2);
  });

  it('getRecent returns snippets sorted by updatedAt descending', () => {
    library.addSnippet(makeInput({ name: 'Older' }));
    library.addSnippet(makeInput({ name: 'Newer' }));

    const recent = library.getRecent();
    // The last added should have the latest updatedAt
    expect(recent[0].metadata.updatedAt).toBeGreaterThanOrEqual(recent[1].metadata.updatedAt);
  });

  it('getRecent respects limit', () => {
    const recent = library.getRecent(3);
    expect(recent).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Persistence', () => {
  it('saves to localStorage on add', () => {
    library.addSnippet(makeInput());
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('saves to localStorage on remove', () => {
    const snippet = library.addSnippet(makeInput());
    vi.mocked(localStorage.setItem).mockClear();
    library.removeSnippet(snippet.id);
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('saves to localStorage on update', () => {
    const snippet = library.addSnippet(makeInput());
    vi.mocked(localStorage.setItem).mockClear();
    library.updateSnippet(snippet.id, { name: 'Updated' });
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('loads persisted snippets on construction', () => {
    library.addSnippet(makeInput({ name: 'Persisted One' }));
    const countBefore = library.getAllSnippets().length;
    SnippetLibrary.resetForTesting();
    const newLibrary = SnippetLibrary.getInstance();
    expect(newLibrary.getAllSnippets()).toHaveLength(countBefore);
    expect(newLibrary.getAllSnippets().some((s) => s.name === 'Persisted One')).toBe(true);
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('not valid json{{{');
    SnippetLibrary.resetForTesting();
    const newLibrary = SnippetLibrary.getInstance();
    // Should fallback to built-in snippets
    expect(newLibrary.getAllSnippets()).toHaveLength(5);
  });

  it('handles non-array localStorage gracefully', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('"just a string"');
    SnippetLibrary.resetForTesting();
    const newLibrary = SnippetLibrary.getInstance();
    expect(newLibrary.getAllSnippets()).toHaveLength(5);
  });

  it('seeds built-ins when localStorage is empty', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    SnippetLibrary.resetForTesting();
    const newLibrary = SnippetLibrary.getInstance();
    expect(newLibrary.getAllSnippets()).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Notify
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Subscription', () => {
  it('notifies on add', () => {
    const listener = vi.fn<() => void>();
    library.subscribe(listener);
    library.addSnippet(makeInput());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on remove', () => {
    const snippet = library.addSnippet(makeInput());
    const listener = vi.fn<() => void>();
    library.subscribe(listener);
    library.removeSnippet(snippet.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on update', () => {
    const snippet = library.addSnippet(makeInput());
    const listener = vi.fn<() => void>();
    library.subscribe(listener);
    library.updateSnippet(snippet.id, { name: 'Changed' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on usage increment', () => {
    const snippet = library.addSnippet(makeInput());
    const listener = vi.fn<() => void>();
    library.subscribe(listener);
    library.incrementUsage(snippet.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on rate', () => {
    const snippet = library.addSnippet(makeInput());
    const listener = vi.fn<() => void>();
    library.subscribe(listener);
    library.rateSnippet(snippet.id, 4);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on clear', () => {
    const listener = vi.fn<() => void>();
    library.subscribe(listener);
    library.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies on import', () => {
    const snippet = library.addSnippet(makeInput());
    const json = library.exportToJson();
    library.clear();
    const listener = vi.fn<() => void>();
    library.subscribe(listener);
    library.importFromJson(json);
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn<() => void>();
    const unsub = library.subscribe(listener);
    unsub();
    library.addSnippet(makeInput());
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Clear', () => {
  it('removes all snippets', () => {
    library.addSnippet(makeInput());
    library.clear();
    expect(library.getAllSnippets()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('SnippetLibrary — Edge Cases', () => {
  it('empty library after clear has zero snippets', () => {
    library.clear();
    expect(library.getAllSnippets()).toHaveLength(0);
  });

  it('search on empty library returns empty array', () => {
    library.clear();
    expect(library.search('anything')).toHaveLength(0);
  });

  it('getByCategory on empty library returns empty array', () => {
    library.clear();
    expect(library.getByCategory('analog')).toHaveLength(0);
  });

  it('getPopular on empty library returns empty array', () => {
    library.clear();
    expect(library.getPopular()).toHaveLength(0);
  });

  it('getRecent on empty library returns empty array', () => {
    library.clear();
    expect(library.getRecent()).toHaveLength(0);
  });

  it('duplicate on empty library returns null', () => {
    library.clear();
    expect(library.duplicateSnippet('whatever')).toBeNull();
  });

  it('placement on empty library returns null', () => {
    library.clear();
    expect(library.prepareForPlacement('whatever', { x: 0, y: 0 })).toBeNull();
  });

  it('exportToJson on empty library returns empty array', () => {
    library.clear();
    expect(JSON.parse(library.exportToJson())).toEqual([]);
  });

  it('import empty array is a no-op', () => {
    const countBefore = library.getAllSnippets().length;
    const result = library.importFromJson('[]');
    expect(result.imported).toBe(0);
    expect(library.getAllSnippets()).toHaveLength(countBefore);
  });
});

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

describe('useDesignSnippets', () => {
  beforeEach(() => {
    localStorage.clear();
    SnippetLibrary.resetForTesting();
  });

  it('returns snippets array', () => {
    const { result } = renderHook(() => useDesignSnippets());
    expect(Array.isArray(result.current.snippets)).toBe(true);
    // Should include built-in snippets
    expect(result.current.snippets.length).toBeGreaterThanOrEqual(5);
  });

  it('addSnippet adds and triggers re-render', () => {
    const { result } = renderHook(() => useDesignSnippets());
    const initialCount = result.current.snippets.length;

    act(() => {
      result.current.addSnippet(makeInput({ name: 'Hook Added' }));
    });

    expect(result.current.snippets.length).toBe(initialCount + 1);
  });

  it('removeSnippet removes and triggers re-render', () => {
    const { result } = renderHook(() => useDesignSnippets());

    let snippet: DesignSnippet;
    act(() => {
      snippet = result.current.addSnippet(makeInput({ name: 'To Remove' }));
    });

    const countAfterAdd = result.current.snippets.length;

    act(() => {
      result.current.removeSnippet(snippet!.id);
    });

    expect(result.current.snippets.length).toBe(countAfterAdd - 1);
  });

  it('search works via hook', () => {
    const { result } = renderHook(() => useDesignSnippets());

    act(() => {
      result.current.addSnippet(makeInput({ name: 'Searchable Widget' }));
    });

    const found = result.current.search('Searchable');
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((s) => s.name === 'Searchable Widget')).toBe(true);
  });

  it('getByCategory works via hook', () => {
    const { result } = renderHook(() => useDesignSnippets());
    const analog = result.current.getByCategory('analog');
    for (const s of analog) {
      expect(s.category).toBe('analog');
    }
  });

  it('prepareForPlacement works via hook', () => {
    const { result } = renderHook(() => useDesignSnippets());
    const snippetId = result.current.snippets[0].id;
    const placement = result.current.prepareForPlacement(snippetId, { x: 50, y: 50 });
    expect(placement).not.toBeNull();
    expect(placement!.nodes.length).toBeGreaterThan(0);
  });

  it('exportToJson and importFromJson work via hook', () => {
    const { result } = renderHook(() => useDesignSnippets());

    act(() => {
      result.current.addSnippet(makeInput({ name: 'Export Me' }));
    });

    const json = result.current.exportToJson();

    act(() => {
      SnippetLibrary.getInstance().clear();
    });

    let importResult: { imported: number; skipped: number; errors: string[] };
    act(() => {
      importResult = result.current.importFromJson(json);
    });

    expect(importResult!.imported).toBeGreaterThan(0);
  });

  it('popular and recent are returned', () => {
    const { result } = renderHook(() => useDesignSnippets());
    expect(Array.isArray(result.current.popular)).toBe(true);
    expect(Array.isArray(result.current.recent)).toBe(true);
  });

  it('updateSnippet works via hook', () => {
    const { result } = renderHook(() => useDesignSnippets());

    let snippet: DesignSnippet;
    act(() => {
      snippet = result.current.addSnippet(makeInput({ name: 'Original Hook' }));
    });

    act(() => {
      result.current.updateSnippet(snippet!.id, { name: 'Updated Hook' });
    });

    const found = result.current.snippets.find((s) => s.id === snippet!.id);
    expect(found?.name).toBe('Updated Hook');
  });
});
