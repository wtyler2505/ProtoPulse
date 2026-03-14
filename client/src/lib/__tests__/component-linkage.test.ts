import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ComponentLinkManager,
  resetComponentLinkManager,
  getComponentLinkManager,
} from '../component-linkage';
import type { ArchNodeInfo, CircuitInstanceInfo } from '../component-linkage';

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  resetComponentLinkManager();

  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => store[key] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
    store[key] = value;
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<ArchNodeInfo> = {}): ArchNodeInfo {
  return {
    nodeId: 'node-1',
    label: 'Arduino Uno',
    nodeType: 'mcu',
    description: 'Main controller',
    ...overrides,
  };
}

function makeInstance(overrides: Partial<CircuitInstanceInfo> = {}): CircuitInstanceInfo {
  return {
    id: 100,
    referenceDesignator: 'U1',
    properties: { name: 'Arduino Uno' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — basic link/unlink
// ---------------------------------------------------------------------------

describe('ComponentLinkManager', () => {
  describe('linkComponents / unlinkComponents', () => {
    it('creates a manual link between node and instance', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('node-1', 100);
      const links = mgr.getAllLinks();
      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        architectureNodeId: 'node-1',
        circuitInstanceId: 100,
        linkType: 'manual',
        confidence: undefined,
      });
    });

    it('replaces existing link for the same node', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('node-1', 100);
      mgr.linkComponents('node-1', 200);
      const links = mgr.getAllLinks();
      expect(links).toHaveLength(1);
      expect(links[0].circuitInstanceId).toBe(200);
    });

    it('replaces existing link for the same instance', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('node-1', 100);
      mgr.linkComponents('node-2', 100);
      const links = mgr.getAllLinks();
      expect(links).toHaveLength(1);
      expect(links[0].architectureNodeId).toBe('node-2');
    });

    it('removes a link with unlinkComponents', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('node-1', 100);
      mgr.unlinkComponents('node-1', 100);
      expect(mgr.getAllLinks()).toHaveLength(0);
    });

    it('unlinkComponents is a no-op for non-existent link', () => {
      const mgr = ComponentLinkManager.create(1);
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.unlinkComponents('node-99', 999);
      expect(listener).not.toHaveBeenCalled();
    });

    it('unlinkNode removes all links for a node', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('node-1', 100);
      mgr.linkComponents('node-2', 200);
      mgr.unlinkNode('node-1');
      expect(mgr.getAllLinks()).toHaveLength(1);
      expect(mgr.getAllLinks()[0].architectureNodeId).toBe('node-2');
    });

    it('clearAll removes all links', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('node-1', 100);
      mgr.linkComponents('node-2', 200);
      mgr.clearAll();
      expect(mgr.getAllLinks()).toHaveLength(0);
    });

    it('clearAll is a no-op when already empty', () => {
      const mgr = ComponentLinkManager.create(1);
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clearAll();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------------------

  describe('getLinkedInstance / getLinkedNode', () => {
    it('returns the linked instance for a node', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('node-1', 100);
      const link = mgr.getLinkedInstance('node-1');
      expect(link).toBeDefined();
      expect(link?.circuitInstanceId).toBe(100);
    });

    it('returns undefined for an unlinked node', () => {
      const mgr = ComponentLinkManager.create(1);
      expect(mgr.getLinkedInstance('node-99')).toBeUndefined();
    });

    it('returns the linked node for an instance', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('node-1', 100);
      const link = mgr.getLinkedNode(100);
      expect(link).toBeDefined();
      expect(link?.architectureNodeId).toBe('node-1');
    });

    it('returns undefined for an unlinked instance', () => {
      const mgr = ComponentLinkManager.create(1);
      expect(mgr.getLinkedNode(999)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe + snapshot
  // -------------------------------------------------------------------------

  describe('subscribe / getSnapshot', () => {
    it('notifies listeners on link change', () => {
      const mgr = ComponentLinkManager.create(1);
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.linkComponents('node-1', 100);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const mgr = ComponentLinkManager.create(1);
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.linkComponents('node-1', 100);
      expect(listener).not.toHaveBeenCalled();
    });

    it('getSnapshot returns current state with version', () => {
      const mgr = ComponentLinkManager.create(1);
      const snap1 = mgr.getSnapshot();
      expect(snap1.version).toBe(0);
      expect(snap1.links).toHaveLength(0);

      mgr.linkComponents('node-1', 100);
      const snap2 = mgr.getSnapshot();
      expect(snap2.version).toBe(1);
      expect(snap2.links).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  describe('persistence', () => {
    it('persists links to localStorage', () => {
      const mgr = ComponentLinkManager.create(42);
      mgr.linkComponents('node-1', 100);
      const raw = store['protopulse-component-links-42'];
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].architectureNodeId).toBe('node-1');
    });

    it('loads links from localStorage on create', () => {
      store['protopulse-component-links-42'] = JSON.stringify([
        { architectureNodeId: 'node-x', circuitInstanceId: 7, linkType: 'manual' },
      ]);
      const mgr = ComponentLinkManager.create(42);
      expect(mgr.getAllLinks()).toHaveLength(1);
      expect(mgr.getAllLinks()[0].architectureNodeId).toBe('node-x');
    });

    it('handles corrupted localStorage gracefully', () => {
      store['protopulse-component-links-42'] = '{bad json';
      const mgr = ComponentLinkManager.create(42);
      expect(mgr.getAllLinks()).toHaveLength(0);
    });

    it('filters out invalid entries from localStorage', () => {
      store['protopulse-component-links-42'] = JSON.stringify([
        { architectureNodeId: 'node-x', circuitInstanceId: 7, linkType: 'manual' },
        { bad: 'data' },
        { architectureNodeId: 'node-y', circuitInstanceId: 'not-a-number', linkType: 'manual' },
      ]);
      const mgr = ComponentLinkManager.create(42);
      expect(mgr.getAllLinks()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Auto-detection
  // -------------------------------------------------------------------------

  describe('autoDetectLinks', () => {
    it('auto-detects links by fuzzy matching node label to instance name', () => {
      const mgr = ComponentLinkManager.create(1);
      const nodes: ArchNodeInfo[] = [makeNode({ nodeId: 'n1', label: 'Arduino Uno' })];
      const instances: CircuitInstanceInfo[] = [
        makeInstance({ id: 1, referenceDesignator: 'U1', properties: { name: 'Arduino Uno' } }),
      ];

      const created = mgr.autoDetectLinks(nodes, instances);
      expect(created).toHaveLength(1);
      expect(created[0].architectureNodeId).toBe('n1');
      expect(created[0].circuitInstanceId).toBe(1);
      expect(created[0].linkType).toBe('auto');
      expect(created[0].confidence).toBeGreaterThan(0);
    });

    it('does not create duplicate links for already-linked nodes', () => {
      const mgr = ComponentLinkManager.create(1);
      mgr.linkComponents('n1', 1);

      const nodes: ArchNodeInfo[] = [makeNode({ nodeId: 'n1', label: 'Arduino Uno' })];
      const instances: CircuitInstanceInfo[] = [
        makeInstance({ id: 1, referenceDesignator: 'U1', properties: { name: 'Arduino Uno' } }),
      ];

      const created = mgr.autoDetectLinks(nodes, instances);
      expect(created).toHaveLength(0);
      expect(mgr.getAllLinks()).toHaveLength(1);
    });

    it('does not link already-claimed instances', () => {
      const mgr = ComponentLinkManager.create(1);

      const nodes: ArchNodeInfo[] = [
        makeNode({ nodeId: 'n1', label: 'Motor Driver' }),
        makeNode({ nodeId: 'n2', label: 'Motor Driver' }),
      ];
      const instances: CircuitInstanceInfo[] = [
        makeInstance({ id: 1, referenceDesignator: 'U1', properties: { name: 'Motor Driver L298N' } }),
      ];

      const created = mgr.autoDetectLinks(nodes, instances);
      // Only one link should be created (one instance, first match wins)
      expect(created).toHaveLength(1);
    });

    it('returns empty array when no nodes to match', () => {
      const mgr = ComponentLinkManager.create(1);
      const created = mgr.autoDetectLinks([], [makeInstance()]);
      expect(created).toHaveLength(0);
    });

    it('returns empty array when no instances to match', () => {
      const mgr = ComponentLinkManager.create(1);
      const created = mgr.autoDetectLinks([makeNode()], []);
      expect(created).toHaveLength(0);
    });

    it('matches by referenceDesignator as fallback', () => {
      const mgr = ComponentLinkManager.create(1);
      const nodes: ArchNodeInfo[] = [makeNode({ nodeId: 'n1', label: 'U1' })];
      const instances: CircuitInstanceInfo[] = [
        makeInstance({ id: 1, referenceDesignator: 'U1', properties: {} }),
      ];

      const created = mgr.autoDetectLinks(nodes, instances);
      expect(created).toHaveLength(1);
    });

    it('handles multiple nodes and instances', () => {
      const mgr = ComponentLinkManager.create(1);
      const nodes: ArchNodeInfo[] = [
        makeNode({ nodeId: 'n1', label: 'ESP32' }),
        makeNode({ nodeId: 'n2', label: 'Temperature Sensor' }),
        makeNode({ nodeId: 'n3', label: 'LED Strip' }),
      ];
      const instances: CircuitInstanceInfo[] = [
        makeInstance({ id: 1, referenceDesignator: 'U1', properties: { name: 'ESP32 DevKit' } }),
        makeInstance({ id: 2, referenceDesignator: 'U2', properties: { name: 'DHT22 Temperature Sensor' } }),
        makeInstance({ id: 3, referenceDesignator: 'D1', properties: { name: 'WS2812B LED' } }),
      ];

      const created = mgr.autoDetectLinks(nodes, instances);
      expect(created.length).toBeGreaterThanOrEqual(2);
      // ESP32 should match
      const esp32Link = created.find((l) => l.architectureNodeId === 'n1');
      expect(esp32Link?.circuitInstanceId).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Global singleton
  // -------------------------------------------------------------------------

  describe('getComponentLinkManager / resetComponentLinkManager', () => {
    it('returns same instance for same projectId', () => {
      const a = getComponentLinkManager(1);
      const b = getComponentLinkManager(1);
      expect(a).toBe(b);
    });

    it('returns new instance for different projectId', () => {
      const a = getComponentLinkManager(1);
      const b = getComponentLinkManager(2);
      expect(a).not.toBe(b);
    });

    it('reset creates fresh instance', () => {
      const a = getComponentLinkManager(1);
      a.linkComponents('node-1', 100);
      resetComponentLinkManager();
      const b = getComponentLinkManager(1);
      expect(b).not.toBe(a);
    });
  });
});
