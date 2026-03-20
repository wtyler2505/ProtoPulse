/**
 * Design Reuse Library
 *
 * Save and reuse schematic/architecture fragments as reusable design snippets.
 * Supports CRUD, search, categorization, rating, usage tracking, import/export,
 * and placement with automatic ID remapping. Ships with 5 built-in snippets
 * for common circuit patterns.
 *
 * Usage:
 *   const library = SnippetLibrary.getInstance();
 *   library.addSnippet({ name: 'Voltage Divider', category: 'analog', ... });
 *   const result = library.prepareForPlacement(snippetId, { x: 100, y: 200 });
 *
 * React hook:
 *   const { snippets, addSnippet, search, prepareForPlacement } = useDesignSnippets();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SnippetCategory =
  | 'power'
  | 'sensor'
  | 'communication'
  | 'motor-control'
  | 'filtering'
  | 'protection'
  | 'digital'
  | 'analog'
  | 'custom';

export interface SnippetNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface SnippetEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface SnippetWire {
  id: string;
  startPin: string;
  endPin: string;
  netName?: string;
}

export interface SnippetCircuitInstance {
  id: string;
  componentId: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface SnippetCircuitNet {
  id: string;
  name: string;
  connectedPins: Array<{ instanceId: string; pinId: string }>;
}

export interface DesignSnippet {
  id: string;
  name: string;
  description: string;
  category: SnippetCategory;
  tags: string[];
  nodes: SnippetNode[];
  edges: SnippetEdge[];
  wires: SnippetWire[];
  circuitInstances?: SnippetCircuitInstance[];
  circuitNets?: SnippetCircuitNet[];
  metadata: {
    author: string;
    createdAt: number;
    updatedAt: number;
    version: number;
    usageCount: number;
    rating: number;
  };
  thumbnail?: string;
}

export interface CreateSnippetInput {
  name: string;
  description?: string;
  category: SnippetCategory;
  tags?: string[];
  nodes?: SnippetNode[];
  edges?: SnippetEdge[];
  wires?: SnippetWire[];
  circuitInstances?: SnippetCircuitInstance[];
  circuitNets?: SnippetCircuitNet[];
  author?: string;
  thumbnail?: string;
}

export interface PlacementResult {
  nodeIdMap: Map<string, string>;
  nodes: SnippetNode[];
  edges: SnippetEdge[];
  wires: SnippetWire[];
  instanceIdMap?: Map<string, string>;
  circuitInstances?: SnippetCircuitInstance[];
  circuitNets?: SnippetCircuitNet[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-design-snippets';

// ---------------------------------------------------------------------------
// Built-in snippets
// ---------------------------------------------------------------------------

function createBuiltinSnippets(): DesignSnippet[] {
  const now = Date.now();
  return [
    {
      id: 'builtin-voltage-divider',
      name: 'Voltage Divider',
      description: 'Two-resistor voltage divider for scaling down voltage. Vout = Vin * R2 / (R1 + R2).',
      category: 'analog',
      tags: ['resistor', 'voltage', 'divider', 'basic'],
      nodes: [
        { id: 'vd-r1', type: 'resistor', label: 'R1', properties: { value: '10k' }, position: { x: 0, y: 0 } },
        { id: 'vd-r2', type: 'resistor', label: 'R2', properties: { value: '10k' }, position: { x: 0, y: 100 } },
      ],
      edges: [{ id: 'vd-e1', source: 'vd-r1', target: 'vd-r2', label: 'Vout' }],
      wires: [{ id: 'vd-w1', startPin: 'vd-r1:2', endPin: 'vd-r2:1', netName: 'Vout' }],
      metadata: { author: 'ProtoPulse', createdAt: now, updatedAt: now, version: 1, usageCount: 0, rating: 0 },
    },
    {
      id: 'builtin-led-indicator',
      name: 'LED Indicator',
      description: 'LED with current-limiting resistor. Standard indicator circuit for status LEDs.',
      category: 'analog',
      tags: ['led', 'indicator', 'resistor', 'basic'],
      nodes: [
        { id: 'led-r1', type: 'resistor', label: 'R1', properties: { value: '330' }, position: { x: 0, y: 0 } },
        { id: 'led-d1', type: 'led', label: 'LED1', properties: { color: 'green' }, position: { x: 0, y: 100 } },
      ],
      edges: [{ id: 'led-e1', source: 'led-r1', target: 'led-d1' }],
      wires: [{ id: 'led-w1', startPin: 'led-r1:2', endPin: 'led-d1:anode' }],
      metadata: { author: 'ProtoPulse', createdAt: now, updatedAt: now, version: 1, usageCount: 0, rating: 0 },
    },
    {
      id: 'builtin-decoupling-caps',
      name: 'Decoupling Cap Network',
      description: 'Parallel 100nF + 10uF decoupling capacitors for IC power supply filtering.',
      category: 'power',
      tags: ['capacitor', 'decoupling', 'bypass', 'power'],
      nodes: [
        { id: 'dc-c1', type: 'capacitor', label: 'C1', properties: { value: '100nF' }, position: { x: 0, y: 0 } },
        { id: 'dc-c2', type: 'capacitor', label: 'C2', properties: { value: '10uF' }, position: { x: 80, y: 0 } },
      ],
      edges: [{ id: 'dc-e1', source: 'dc-c1', target: 'dc-c2', label: 'VCC' }],
      wires: [
        { id: 'dc-w1', startPin: 'dc-c1:1', endPin: 'dc-c2:1', netName: 'VCC' },
        { id: 'dc-w2', startPin: 'dc-c1:2', endPin: 'dc-c2:2', netName: 'GND' },
      ],
      metadata: { author: 'ProtoPulse', createdAt: now, updatedAt: now, version: 1, usageCount: 0, rating: 0 },
    },
    {
      id: 'builtin-pull-up-array',
      name: 'Pull-Up Resistor Array',
      description: 'Four pull-up resistors for I2C or digital inputs. Common values: 4.7k for I2C, 10k for GPIO.',
      category: 'digital',
      tags: ['pull-up', 'resistor', 'i2c', 'digital'],
      nodes: [
        { id: 'pu-r1', type: 'resistor', label: 'R1', properties: { value: '4.7k' }, position: { x: 0, y: 0 } },
        { id: 'pu-r2', type: 'resistor', label: 'R2', properties: { value: '4.7k' }, position: { x: 80, y: 0 } },
        { id: 'pu-r3', type: 'resistor', label: 'R3', properties: { value: '4.7k' }, position: { x: 160, y: 0 } },
        { id: 'pu-r4', type: 'resistor', label: 'R4', properties: { value: '4.7k' }, position: { x: 240, y: 0 } },
      ],
      edges: [
        { id: 'pu-e1', source: 'pu-r1', target: 'pu-r2' },
        { id: 'pu-e2', source: 'pu-r2', target: 'pu-r3' },
        { id: 'pu-e3', source: 'pu-r3', target: 'pu-r4' },
      ],
      wires: [
        { id: 'pu-w1', startPin: 'pu-r1:1', endPin: 'pu-r2:1', netName: 'VCC' },
        { id: 'pu-w2', startPin: 'pu-r2:1', endPin: 'pu-r3:1', netName: 'VCC' },
        { id: 'pu-w3', startPin: 'pu-r3:1', endPin: 'pu-r4:1', netName: 'VCC' },
      ],
      metadata: { author: 'ProtoPulse', createdAt: now, updatedAt: now, version: 1, usageCount: 0, rating: 0 },
    },
    {
      id: 'builtin-bypass-filter',
      name: 'Bypass Filter',
      description: 'RC low-pass filter for noise suppression on analog signals or power rails.',
      category: 'filtering',
      tags: ['filter', 'rc', 'low-pass', 'noise'],
      nodes: [
        { id: 'bf-r1', type: 'resistor', label: 'R1', properties: { value: '100' }, position: { x: 0, y: 0 } },
        { id: 'bf-c1', type: 'capacitor', label: 'C1', properties: { value: '100nF' }, position: { x: 100, y: 50 } },
      ],
      edges: [{ id: 'bf-e1', source: 'bf-r1', target: 'bf-c1' }],
      wires: [{ id: 'bf-w1', startPin: 'bf-r1:2', endPin: 'bf-c1:1', netName: 'filtered' }],
      metadata: { author: 'ProtoPulse', createdAt: now, updatedAt: now, version: 1, usageCount: 0, rating: 0 },
    },
  ];
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// SnippetLibrary
// ---------------------------------------------------------------------------

/**
 * Manages a library of reusable design snippets.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists to localStorage with built-in starter snippets.
 */
export class SnippetLibrary {
  private static instance: SnippetLibrary | null = null;

  private snippets: DesignSnippet[];
  private listeners = new Set<Listener>();

  constructor() {
    this.snippets = [];
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): SnippetLibrary {
    if (!SnippetLibrary.instance) {
      SnippetLibrary.instance = new SnippetLibrary();
    }
    return SnippetLibrary.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    SnippetLibrary.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any snippet mutation.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  /** Add a new snippet to the library. Returns the created snippet. */
  addSnippet(input: CreateSnippetInput): DesignSnippet {
    const now = Date.now();
    const snippet: DesignSnippet = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description ?? '',
      category: input.category,
      tags: input.tags ?? [],
      nodes: input.nodes ?? [],
      edges: input.edges ?? [],
      wires: input.wires ?? [],
      ...(input.circuitInstances !== undefined ? { circuitInstances: input.circuitInstances } : {}),
      ...(input.circuitNets !== undefined ? { circuitNets: input.circuitNets } : {}),
      metadata: {
        author: input.author ?? 'User',
        createdAt: now,
        updatedAt: now,
        version: 1,
        usageCount: 0,
        rating: 0,
      },
      thumbnail: input.thumbnail,
    };

    this.snippets.push(snippet);
    this.save();
    this.notify();
    return snippet;
  }

  /** Remove a snippet by ID. Returns true if removed, false if not found. */
  removeSnippet(id: string): boolean {
    const index = this.snippets.findIndex((s) => s.id === id);
    if (index === -1) {
      return false;
    }
    this.snippets.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  /** Update an existing snippet. Returns the updated snippet or null if not found. */
  updateSnippet(id: string, updates: Partial<CreateSnippetInput>): DesignSnippet | null {
    const snippet = this.snippets.find((s) => s.id === id);
    if (!snippet) {
      return null;
    }

    if (updates.name !== undefined) {
      snippet.name = updates.name;
    }
    if (updates.description !== undefined) {
      snippet.description = updates.description;
    }
    if (updates.category !== undefined) {
      snippet.category = updates.category;
    }
    if (updates.tags !== undefined) {
      snippet.tags = updates.tags;
    }
    if (updates.nodes !== undefined) {
      snippet.nodes = updates.nodes;
    }
    if (updates.edges !== undefined) {
      snippet.edges = updates.edges;
    }
    if (updates.wires !== undefined) {
      snippet.wires = updates.wires;
    }
    if (updates.author !== undefined) {
      snippet.metadata.author = updates.author;
    }
    if (updates.thumbnail !== undefined) {
      snippet.thumbnail = updates.thumbnail;
    }

    snippet.metadata.updatedAt = Date.now();
    snippet.metadata.version += 1;

    this.save();
    this.notify();
    return { ...snippet, nodes: [...snippet.nodes], edges: [...snippet.edges], wires: [...snippet.wires] };
  }

  /** Get a snippet by ID. Returns undefined if not found. */
  getSnippet(id: string): DesignSnippet | undefined {
    return this.snippets.find((s) => s.id === id);
  }

  /** Get all snippets in the library. */
  getAllSnippets(): DesignSnippet[] {
    return [...this.snippets];
  }

  // -----------------------------------------------------------------------
  // Filtering & Search
  // -----------------------------------------------------------------------

  /** Get all snippets in a specific category. */
  getByCategory(category: SnippetCategory): DesignSnippet[] {
    return this.snippets.filter((s) => s.category === category);
  }

  /** Search snippets by name, description, and tags (case-insensitive). */
  search(query: string): DesignSnippet[] {
    const lower = query.toLowerCase();
    return this.snippets.filter((s) => {
      if (s.name.toLowerCase().includes(lower)) {
        return true;
      }
      if (s.description.toLowerCase().includes(lower)) {
        return true;
      }
      if (s.tags.some((t) => t.toLowerCase().includes(lower))) {
        return true;
      }
      return false;
    });
  }

  // -----------------------------------------------------------------------
  // Duplicate
  // -----------------------------------------------------------------------

  /** Duplicate an existing snippet with a new name. Returns the new snippet or null if source not found. */
  duplicateSnippet(id: string, newName?: string): DesignSnippet | null {
    const source = this.snippets.find((s) => s.id === id);
    if (!source) {
      return null;
    }

    const now = Date.now();
    const duplicate: DesignSnippet = {
      id: crypto.randomUUID(),
      name: newName ?? `${source.name} (Copy)`,
      description: source.description,
      category: source.category,
      tags: [...source.tags],
      nodes: source.nodes.map((n) => ({ ...n, properties: { ...n.properties }, position: { ...n.position } })),
      edges: source.edges.map((e) => ({ ...e })),
      wires: source.wires.map((w) => ({ ...w })),
      metadata: {
        author: source.metadata.author,
        createdAt: now,
        updatedAt: now,
        version: 1,
        usageCount: 0,
        rating: 0,
      },
      thumbnail: source.thumbnail,
    };

    this.snippets.push(duplicate);
    this.save();
    this.notify();
    return duplicate;
  }

  // -----------------------------------------------------------------------
  // Usage & Rating
  // -----------------------------------------------------------------------

  /** Increment the usage count for a snippet. */
  incrementUsage(id: string): void {
    const snippet = this.snippets.find((s) => s.id === id);
    if (!snippet) {
      return;
    }
    snippet.metadata.usageCount += 1;
    this.save();
    this.notify();
  }

  /** Rate a snippet (1-5 stars). Values are clamped to [1, 5]. */
  rateSnippet(id: string, rating: number): void {
    const snippet = this.snippets.find((s) => s.id === id);
    if (!snippet) {
      return;
    }
    snippet.metadata.rating = Math.max(1, Math.min(5, Math.round(rating)));
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Placement
  // -----------------------------------------------------------------------

  /**
   * Prepare a snippet for placement by remapping all IDs to new UUIDs
   * and offsetting node positions. Returns null if snippet not found.
   */
  prepareForPlacement(id: string, offset: { x: number; y: number }): PlacementResult | null {
    const snippet = this.snippets.find((s) => s.id === id);
    if (!snippet) {
      return null;
    }

    // Build old→new ID map for nodes
    const nodeIdMap = new Map<string, string>();
    snippet.nodes.forEach((n) => {
      nodeIdMap.set(n.id, crypto.randomUUID());
    });

    // Remap nodes with offset positions
    const nodes: SnippetNode[] = snippet.nodes.map((n) => ({
      ...n,
      id: nodeIdMap.get(n.id) ?? n.id,
      properties: { ...n.properties },
      position: {
        x: n.position.x + offset.x,
        y: n.position.y + offset.y,
      },
    }));

    // Remap edges — source/target reference node IDs
    const edges: SnippetEdge[] = snippet.edges.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      source: nodeIdMap.get(e.source) ?? e.source,
      target: nodeIdMap.get(e.target) ?? e.target,
    }));

    // Remap wires — startPin/endPin may reference node IDs as prefix (e.g. "vd-r1:2")
    const wires: SnippetWire[] = snippet.wires.map((w) => {
      let startPin = w.startPin;
      let endPin = w.endPin;

      // Remap pin references that use node ID as prefix
      nodeIdMap.forEach((newId, oldId) => {
        if (startPin.startsWith(oldId + ':')) {
          startPin = newId + startPin.slice(oldId.length);
        }
        if (endPin.startsWith(oldId + ':')) {
          endPin = newId + endPin.slice(oldId.length);
        }
      });

      return {
        ...w,
        id: crypto.randomUUID(),
        startPin,
        endPin,
      };
    });

    return { nodeIdMap, nodes, edges, wires };
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export all snippets as a JSON string. */
  exportToJson(): string {
    return JSON.stringify(this.snippets, null, 2);
  }

  /** Import snippets from a JSON string. Returns import statistics. */
  importFromJson(json: string): { imported: number; skipped: number; errors: string[] } {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      result.errors.push('Invalid JSON format');
      return result;
    }

    if (!Array.isArray(parsed)) {
      result.errors.push('Expected an array of snippets');
      return result;
    }

    const existingIds = new Set(this.snippets.map((s) => s.id));

    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) {
        result.errors.push('Skipped non-object entry');
        result.skipped += 1;
        continue;
      }

      const candidate = item as Record<string, unknown>;

      // Validate required fields
      if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
        result.errors.push(`Skipped entry: missing id or name`);
        result.skipped += 1;
        continue;
      }

      // Skip duplicates by ID
      if (existingIds.has(candidate.id)) {
        result.skipped += 1;
        continue;
      }

      // Validate it has the minimum shape of a DesignSnippet
      if (
        typeof candidate.category !== 'string' ||
        !Array.isArray(candidate.nodes) ||
        !Array.isArray(candidate.edges) ||
        !Array.isArray(candidate.wires) ||
        typeof candidate.metadata !== 'object' ||
        candidate.metadata === null
      ) {
        result.errors.push(`Skipped "${candidate.name}": missing required fields`);
        result.skipped += 1;
        continue;
      }

      this.snippets.push(item as DesignSnippet);
      existingIds.add(candidate.id);
      result.imported += 1;
    }

    if (result.imported > 0) {
      this.save();
      this.notify();
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Sorting queries
  // -----------------------------------------------------------------------

  /** Get most popular snippets sorted by usage count (descending). */
  getPopular(limit = 10): DesignSnippet[] {
    return [...this.snippets].sort((a, b) => b.metadata.usageCount - a.metadata.usageCount).slice(0, limit);
  }

  /** Get most recently updated snippets (descending). */
  getRecent(limit = 10): DesignSnippet[] {
    return [...this.snippets].sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt).slice(0, limit);
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Remove all snippets from the library. */
  clear(): void {
    this.snippets = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist snippets to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snippets));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load snippets from localStorage. Seeds built-ins if empty. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // First load — seed with built-in snippets
        this.snippets = createBuiltinSnippets();
        this.save();
        return;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.snippets = createBuiltinSnippets();
        this.save();
        return;
      }

      // Validate each entry
      this.snippets = parsed.filter(
        (item: unknown): item is DesignSnippet =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as DesignSnippet).id === 'string' &&
          typeof (item as DesignSnippet).name === 'string' &&
          typeof (item as DesignSnippet).category === 'string' &&
          Array.isArray((item as DesignSnippet).nodes) &&
          Array.isArray((item as DesignSnippet).edges) &&
          Array.isArray((item as DesignSnippet).wires) &&
          typeof (item as DesignSnippet).metadata === 'object' &&
          (item as DesignSnippet).metadata !== null,
      );
    } catch {
      // Corrupt data — seed with built-ins
      this.snippets = createBuiltinSnippets();
      this.save();
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the design snippet library in React components.
 * Subscribes to the SnippetLibrary singleton and triggers re-renders on state changes.
 */
export function useDesignSnippets(): {
  snippets: DesignSnippet[];
  addSnippet: (input: CreateSnippetInput) => DesignSnippet;
  removeSnippet: (id: string) => boolean;
  updateSnippet: (id: string, updates: Partial<CreateSnippetInput>) => DesignSnippet | null;
  search: (query: string) => DesignSnippet[];
  getByCategory: (category: SnippetCategory) => DesignSnippet[];
  prepareForPlacement: (id: string, offset: { x: number; y: number }) => PlacementResult | null;
  exportToJson: () => string;
  importFromJson: (json: string) => { imported: number; skipped: number; errors: string[] };
  popular: DesignSnippet[];
  recent: DesignSnippet[];
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const library = SnippetLibrary.getInstance();
    const unsubscribe = library.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addSnippet = useCallback((input: CreateSnippetInput) => {
    return SnippetLibrary.getInstance().addSnippet(input);
  }, []);

  const removeSnippet = useCallback((id: string) => {
    return SnippetLibrary.getInstance().removeSnippet(id);
  }, []);

  const updateSnippet = useCallback((id: string, updates: Partial<CreateSnippetInput>) => {
    return SnippetLibrary.getInstance().updateSnippet(id, updates);
  }, []);

  const searchSnippets = useCallback((query: string) => {
    return SnippetLibrary.getInstance().search(query);
  }, []);

  const getByCategory = useCallback((category: SnippetCategory) => {
    return SnippetLibrary.getInstance().getByCategory(category);
  }, []);

  const prepareForPlacement = useCallback((id: string, offset: { x: number; y: number }) => {
    return SnippetLibrary.getInstance().prepareForPlacement(id, offset);
  }, []);

  const exportToJson = useCallback(() => {
    return SnippetLibrary.getInstance().exportToJson();
  }, []);

  const importFromJson = useCallback((json: string) => {
    return SnippetLibrary.getInstance().importFromJson(json);
  }, []);

  const library = typeof window !== 'undefined' ? SnippetLibrary.getInstance() : null;

  return {
    snippets: library?.getAllSnippets() ?? [],
    addSnippet,
    removeSnippet,
    updateSnippet,
    search: searchSnippets,
    getByCategory,
    prepareForPlacement,
    exportToJson,
    importFromJson,
    popular: library?.getPopular() ?? [],
    recent: library?.getRecent() ?? [],
  };
}
