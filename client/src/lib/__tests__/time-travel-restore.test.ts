import { describe, it, expect, beforeEach } from 'vitest';
import {
  TimeTravelRestoreManager,
  type DesignSnapshot,
  type IdentifiableObject,
  type RestoreDomain,
  type ObjectChangeType,
} from '../time-travel-restore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, label = 'Node', type = 'mcu'): IdentifiableObject {
  return { id, label, type, x: 0, y: 0 };
}

function makeEdge(id: string, source = 'n1', target = 'n2'): IdentifiableObject {
  return { id, source, target, label: '' };
}

function makeInstance(id: string, componentId = 'R1', x = 0, y = 0): IdentifiableObject {
  return { id, componentId, x, y, rotation: 0 };
}

function makeNet(id: string, name = 'VCC'): IdentifiableObject {
  return { id, name, pins: [] };
}

function makeWire(id: string, x1 = 0, y1 = 0, x2 = 100, y2 = 0): IdentifiableObject {
  return { id, x1, y1, x2, y2 };
}

function makeBomItem(id: string, part = 'R-10K', qty = 1): IdentifiableObject {
  return { id, partNumber: part, quantity: qty, unitPrice: 0.1 };
}

function makeSimResult(id: string, type = 'dc'): IdentifiableObject {
  return { id, type, data: [] };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TimeTravelRestoreManager', () => {
  let manager: TimeTravelRestoreManager;

  beforeEach(() => {
    TimeTravelRestoreManager.resetInstance();
    manager = TimeTravelRestoreManager.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = TimeTravelRestoreManager.getInstance();
      const b = TimeTravelRestoreManager.getInstance();
      expect(a).toBe(b);
    });

    it('resets to a fresh instance', () => {
      const first = TimeTravelRestoreManager.getInstance();
      TimeTravelRestoreManager.resetInstance();
      const second = TimeTravelRestoreManager.getInstance();
      expect(first).not.toBe(second);
    });
  });

  // -----------------------------------------------------------------------
  // Domain analysis
  // -----------------------------------------------------------------------

  describe('analyzeDomain', () => {
    it('detects no changes when snapshot and current are identical', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1')], edges: [makeEdge('e1')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1')], edges: [makeEdge('e1')] };

      const result = manager.analyzeDomain('architecture', snap, current);
      expect(result.domain).toBe('architecture');
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
      expect(result.summary.modified).toBe(0);
      expect(result.summary.unchanged).toBe(2);
    });

    it('detects added objects (present in current but not snapshot)', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1'), makeNode('n2', 'New')] };

      const result = manager.analyzeDomain('architecture', snap, current);
      expect(result.summary.added).toBe(1);
      const added = result.changes.find((c) => c.changeType === 'added');
      expect(added).toBeDefined();
      expect(added!.id).toBe('n2');
      expect(added!.currentObject).not.toBeNull();
      expect(added!.snapshotObject).toBeNull();
    });

    it('detects removed objects (present in snapshot but not current)', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1'), makeNode('n2')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1')] };

      const result = manager.analyzeDomain('architecture', snap, current);
      expect(result.summary.removed).toBe(1);
      const removed = result.changes.find((c) => c.changeType === 'removed');
      expect(removed).toBeDefined();
      expect(removed!.id).toBe('n2');
      expect(removed!.snapshotObject).not.toBeNull();
      expect(removed!.currentObject).toBeNull();
    });

    it('detects modified objects with field-level diffs', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1', 'Old Label', 'mcu')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1', 'New Label', 'sensor')] };

      const result = manager.analyzeDomain('architecture', snap, current);
      expect(result.summary.modified).toBe(1);
      const modified = result.changes.find((c) => c.changeType === 'modified');
      expect(modified).toBeDefined();
      expect(modified!.fieldDiffs).toHaveLength(2);

      const labelDiff = modified!.fieldDiffs.find((d) => d.field === 'label');
      expect(labelDiff).toBeDefined();
      expect(labelDiff!.snapshotValue).toBe('Old Label');
      expect(labelDiff!.currentValue).toBe('New Label');
    });

    it('handles empty snapshot and current data', () => {
      const result = manager.analyzeDomain('architecture', {}, {});
      expect(result.changes).toHaveLength(0);
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
    });

    it('handles null/undefined arrays gracefully', () => {
      const snap: DesignSnapshot = { nodes: undefined };
      const current: DesignSnapshot = {};

      const result = manager.analyzeDomain('architecture', snap, current);
      expect(result.changes).toHaveLength(0);
    });

    it('analyzes schematic domain (instances, nets, wires)', () => {
      const snap: DesignSnapshot = {
        instances: [makeInstance('i1')],
        nets: [makeNet('net1')],
        wires: [makeWire('w1')],
      };
      const current: DesignSnapshot = {
        instances: [makeInstance('i1', 'C1')],
        nets: [makeNet('net1')],
        wires: [makeWire('w1'), makeWire('w2')],
      };

      const result = manager.analyzeDomain('schematic', snap, current);
      expect(result.summary.modified).toBe(1); // i1 changed componentId
      expect(result.summary.unchanged).toBe(2); // net1 + w1
      expect(result.summary.added).toBe(1); // w2
    });

    it('analyzes bom domain', () => {
      const snap: DesignSnapshot = { bomItems: [makeBomItem('b1', 'R-10K', 5)] };
      const current: DesignSnapshot = { bomItems: [makeBomItem('b1', 'R-10K', 10)] };

      const result = manager.analyzeDomain('bom', snap, current);
      expect(result.summary.modified).toBe(1);
      const mod = result.changes.find((c) => c.changeType === 'modified');
      expect(mod!.fieldDiffs.some((d) => d.field === 'quantity')).toBe(true);
    });

    it('analyzes simulation domain', () => {
      const snap: DesignSnapshot = { simulationResults: [makeSimResult('s1', 'dc')] };
      const current: DesignSnapshot = { simulationResults: [makeSimResult('s1', 'ac')] };

      const result = manager.analyzeDomain('simulation', snap, current);
      expect(result.summary.modified).toBe(1);
    });

    it('caches analysis results', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1')] };

      const first = manager.analyzeDomain('architecture', snap, current);
      const second = manager.analyzeDomain('architecture', snap, current);
      expect(first).toBe(second); // Same reference — cached
    });

    it('assigns correct subType to changes', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1')], edges: [makeEdge('e1')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1', 'Changed')], edges: [] };

      const result = manager.analyzeDomain('architecture', snap, current);
      const nodeChange = result.changes.find((c) => c.id === 'n1');
      const edgeChange = result.changes.find((c) => c.id === 'e1');
      expect(nodeChange!.subType).toBe('node');
      expect(edgeChange!.subType).toBe('edge');
    });
  });

  // -----------------------------------------------------------------------
  // analyzeAll
  // -----------------------------------------------------------------------

  describe('analyzeAll', () => {
    it('analyzes all four domains', () => {
      const snap: DesignSnapshot = {
        nodes: [makeNode('n1')],
        bomItems: [makeBomItem('b1')],
      };
      const current: DesignSnapshot = {
        nodes: [makeNode('n1', 'Changed')],
        bomItems: [makeBomItem('b1', 'C-100nF')],
      };

      const results = manager.analyzeAll(snap, current);
      expect(results.size).toBe(4);
      expect(results.has('architecture')).toBe(true);
      expect(results.has('schematic')).toBe(true);
      expect(results.has('bom')).toBe(true);
      expect(results.has('simulation')).toBe(true);
    });

    it('returns empty changes for domains with no data', () => {
      const results = manager.analyzeAll({}, {});
      const arch = results.get('architecture')!;
      expect(arch.changes).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Cache management
  // -----------------------------------------------------------------------

  describe('cache management', () => {
    it('getCachedAnalysis returns null for unanalyzed domain', () => {
      expect(manager.getCachedAnalysis('architecture')).toBeNull();
    });

    it('getCachedAnalysis returns cached result after analysis', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1')] };
      manager.analyzeDomain('architecture', snap, snap);
      expect(manager.getCachedAnalysis('architecture')).not.toBeNull();
    });

    it('clearAnalysis removes all cached data and selections', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1')] };
      manager.analyzeDomain('architecture', snap, snap);
      manager.selectObjects(['n1']);

      manager.clearAnalysis();
      expect(manager.getCachedAnalysis('architecture')).toBeNull();
      expect(manager.getSelectedIds().size).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Object selection
  // -----------------------------------------------------------------------

  describe('object selection', () => {
    it('selects objects by ID', () => {
      manager.selectObjects(['a', 'b', 'c']);
      expect(manager.getSelectedIds().size).toBe(3);
      expect(manager.isSelected('a')).toBe(true);
      expect(manager.isSelected('d')).toBe(false);
    });

    it('deselects objects by ID', () => {
      manager.selectObjects(['a', 'b', 'c']);
      manager.deselectObjects(['b']);
      expect(manager.isSelected('b')).toBe(false);
      expect(manager.isSelected('a')).toBe(true);
    });

    it('toggles selection', () => {
      manager.toggleObject('x');
      expect(manager.isSelected('x')).toBe(true);
      manager.toggleObject('x');
      expect(manager.isSelected('x')).toBe(false);
    });

    it('deselectAll clears all selections', () => {
      manager.selectObjects(['a', 'b', 'c']);
      manager.deselectAll();
      expect(manager.getSelectedIds().size).toBe(0);
    });

    it('selectAllChanged selects only non-unchanged objects in a domain', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1'), makeNode('n2')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1', 'Changed')] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectAllChanged('architecture');

      const selected = manager.getSelectedIds();
      expect(selected.has('n1')).toBe(true); // modified
      expect(selected.has('n2')).toBe(true); // removed
    });

    it('selectAllChanged is a no-op if domain not analyzed', () => {
      manager.selectAllChanged('architecture');
      expect(manager.getSelectedIds().size).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Restore preview
  // -----------------------------------------------------------------------

  describe('generateRestorePreview', () => {
    it('returns empty preview when nothing is selected', () => {
      const preview = manager.generateRestorePreview();
      expect(preview.objectsToRestore).toHaveLength(0);
      expect(preview.objectsToDelete).toHaveLength(0);
      expect(preview.objectsToAdd).toHaveLength(0);
      expect(preview.totalFieldChanges).toBe(0);
      expect(preview.warnings).toHaveLength(0);
    });

    it('classifies modified objects into objectsToRestore', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1', 'Old')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1', 'New')] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n1']);

      const preview = manager.generateRestorePreview();
      expect(preview.objectsToRestore).toHaveLength(1);
      expect(preview.objectsToRestore[0].id).toBe('n1');
      expect(preview.totalFieldChanges).toBeGreaterThan(0);
    });

    it('classifies added objects (to be deleted on restore) into objectsToDelete', () => {
      const snap: DesignSnapshot = { nodes: [] };
      const current: DesignSnapshot = { nodes: [makeNode('n-new')] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n-new']);

      const preview = manager.generateRestorePreview();
      expect(preview.objectsToDelete).toHaveLength(1);
      expect(preview.objectsToDelete[0].id).toBe('n-new');
    });

    it('classifies removed objects (to be re-added on restore) into objectsToAdd', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n-old')] };
      const current: DesignSnapshot = { nodes: [] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n-old']);

      const preview = manager.generateRestorePreview();
      expect(preview.objectsToAdd).toHaveLength(1);
      expect(preview.objectsToAdd[0].id).toBe('n-old');
    });

    it('ignores unchanged objects even if selected', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1')] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n1']);

      const preview = manager.generateRestorePreview();
      expect(preview.objectsToRestore).toHaveLength(0);
      expect(preview.objectsToDelete).toHaveLength(0);
      expect(preview.objectsToAdd).toHaveLength(0);
    });

    it('generates deletion warnings for objects to be deleted', () => {
      const snap: DesignSnapshot = { nodes: [] };
      const current: DesignSnapshot = { nodes: [makeNode('n-new')] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n-new']);

      const preview = manager.generateRestorePreview();
      expect(preview.warnings.some((w) => w.severity === 'warning' && w.objectId === 'n-new')).toBe(true);
    });

    it('generates info warnings for objects to be added', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n-old')] };
      const current: DesignSnapshot = { nodes: [] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n-old']);

      const preview = manager.generateRestorePreview();
      expect(preview.warnings.some((w) => w.severity === 'info' && w.objectId === 'n-old')).toBe(true);
    });

    it('warns about multi-field modifications (>5 fields)', () => {
      const snapNode: IdentifiableObject = {
        id: 'n1', a: 1, b: 2, c: 3, d: 4, e: 5, f: 6,
      };
      const currentNode: IdentifiableObject = {
        id: 'n1', a: 10, b: 20, c: 30, d: 40, e: 50, f: 60,
      };
      const snap: DesignSnapshot = { nodes: [snapNode] };
      const current: DesignSnapshot = { nodes: [currentNode] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n1']);

      const preview = manager.generateRestorePreview();
      expect(preview.warnings.some((w) => w.message.includes('6 field changes'))).toBe(true);
    });

    it('generates cross-domain warning for schematic without bom', () => {
      const snap: DesignSnapshot = {
        instances: [makeInstance('i1')],
      };
      const current: DesignSnapshot = {
        instances: [makeInstance('i1', 'C1')],
      };

      manager.analyzeDomain('schematic', snap, current);
      manager.selectObjects(['i1']);

      const preview = manager.generateRestorePreview();
      expect(preview.warnings.some((w) => w.message.includes('schematic without BOM'))).toBe(true);
    });

    it('generates cross-domain warning for architecture without schematic', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1', 'Old')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1', 'New')] };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n1']);

      const preview = manager.generateRestorePreview();
      expect(preview.warnings.some((w) => w.message.includes('architecture without schematic'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Filtering & querying
  // -----------------------------------------------------------------------

  describe('filtering and querying', () => {
    const snap: DesignSnapshot = {
      nodes: [makeNode('n1', 'Old'), makeNode('n2')],
      edges: [makeEdge('e1')],
      bomItems: [makeBomItem('b1', 'R-10K', 5)],
    };
    const current: DesignSnapshot = {
      nodes: [makeNode('n1', 'New'), makeNode('n3')],
      edges: [makeEdge('e1')],
      bomItems: [makeBomItem('b1', 'R-10K', 10)],
    };

    beforeEach(() => {
      manager.analyzeDomain('architecture', snap, current);
      manager.analyzeDomain('bom', snap, current);
    });

    it('getAllChanges returns changes from all analyzed domains', () => {
      const all = manager.getAllChanges();
      // architecture: n1=modified, n2=removed, n3=added, e1=unchanged
      // bom: b1=modified
      expect(all.length).toBe(5);
    });

    it('getChangesByType filters correctly', () => {
      const modified = manager.getChangesByType('modified');
      expect(modified.length).toBe(2); // n1, b1
      expect(modified.every((c) => c.changeType === 'modified')).toBe(true);
    });

    it('getChangesForDomain returns changes for a specific domain', () => {
      const archChanges = manager.getChangesForDomain('architecture');
      expect(archChanges.length).toBe(4);
    });

    it('getChangesForDomain returns empty for unanalyzed domain', () => {
      expect(manager.getChangesForDomain('simulation')).toHaveLength(0);
    });

    it('getModifiedForDomain excludes unchanged objects', () => {
      const modified = manager.getModifiedForDomain('architecture');
      expect(modified.every((c) => c.changeType !== 'unchanged')).toBe(true);
      expect(modified.length).toBe(3); // n1=modified, n2=removed, n3=added
    });

    it('searchChanges finds by object ID', () => {
      const results = manager.searchChanges('n1');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('n1');
    });

    it('searchChanges finds by field name in diffs', () => {
      const results = manager.searchChanges('label');
      expect(results.some((c) => c.id === 'n1')).toBe(true);
    });

    it('searchChanges is case-insensitive', () => {
      const results = manager.searchChanges('LABEL');
      expect(results.some((c) => c.id === 'n1')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Summary helpers
  // -----------------------------------------------------------------------

  describe('summary helpers', () => {
    it('getOverallSummary aggregates all domains', () => {
      const snap: DesignSnapshot = {
        nodes: [makeNode('n1', 'Old')],
        bomItems: [makeBomItem('b1', 'R', 5)],
      };
      const current: DesignSnapshot = {
        nodes: [makeNode('n1', 'New')],
        bomItems: [makeBomItem('b1', 'R', 10)],
      };

      manager.analyzeAll(snap, current);
      const summary = manager.getOverallSummary();
      expect(summary.modified).toBe(2); // n1 + b1
      expect(summary.totalFieldDiffs).toBeGreaterThan(0);
    });

    it('getAnalyzedDomainCount returns correct count', () => {
      expect(manager.getAnalyzedDomainCount()).toBe(0);
      manager.analyzeDomain('architecture', {}, {});
      expect(manager.getAnalyzedDomainCount()).toBe(1);
      manager.analyzeDomain('bom', {}, {});
      expect(manager.getAnalyzedDomainCount()).toBe(2);
    });

    it('hasChanges returns false when no changes exist', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1')] };
      manager.analyzeDomain('architecture', snap, snap);
      expect(manager.hasChanges()).toBe(false);
    });

    it('hasChanges returns true when changes exist', () => {
      const snap: DesignSnapshot = { nodes: [makeNode('n1', 'Old')] };
      const current: DesignSnapshot = { nodes: [makeNode('n1', 'New')] };
      manager.analyzeDomain('architecture', snap, current);
      expect(manager.hasChanges()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies subscribers on analyzeDomain', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.analyzeDomain('architecture', {}, {});
      expect(called).toBe(1);
    });

    it('notifies subscribers on selectObjects', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.selectObjects(['a']);
      expect(called).toBe(1);
    });

    it('notifies subscribers on deselectObjects', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.deselectObjects(['a']);
      expect(called).toBe(1);
    });

    it('notifies subscribers on toggleObject', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.toggleObject('a');
      expect(called).toBe(1);
    });

    it('notifies subscribers on deselectAll', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.deselectAll();
      expect(called).toBe(1);
    });

    it('notifies subscribers on clearAnalysis', () => {
      let called = 0;
      manager.subscribe(() => { called++; });
      manager.clearAnalysis();
      expect(called).toBe(1);
    });

    it('unsubscribe stops notifications', () => {
      let called = 0;
      const unsub = manager.subscribe(() => { called++; });
      unsub();
      manager.selectObjects(['a']);
      expect(called).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Field diff edge cases
  // -----------------------------------------------------------------------

  describe('field diff edge cases', () => {
    it('detects added fields (present in current but not snapshot)', () => {
      const snap: DesignSnapshot = { nodes: [{ id: 'n1', label: 'A' }] };
      const current: DesignSnapshot = { nodes: [{ id: 'n1', label: 'A', color: 'red' }] };

      manager.analyzeDomain('architecture', snap, current);
      const changes = manager.getChangesForDomain('architecture');
      const modified = changes.find((c) => c.changeType === 'modified');
      expect(modified).toBeDefined();
      expect(modified!.fieldDiffs.some((d) => d.field === 'color')).toBe(true);
    });

    it('detects removed fields (present in snapshot but not current)', () => {
      const snap: DesignSnapshot = { nodes: [{ id: 'n1', label: 'A', color: 'red' }] };
      const current: DesignSnapshot = { nodes: [{ id: 'n1', label: 'A' }] };

      manager.analyzeDomain('architecture', snap, current);
      const changes = manager.getChangesForDomain('architecture');
      const modified = changes.find((c) => c.changeType === 'modified');
      expect(modified).toBeDefined();
      const colorDiff = modified!.fieldDiffs.find((d) => d.field === 'color');
      expect(colorDiff!.snapshotValue).toBe('red');
      expect(colorDiff!.currentValue).toBeUndefined();
    });

    it('handles nested object comparison via JSON serialization', () => {
      const snap: DesignSnapshot = { nodes: [{ id: 'n1', props: { a: 1 } }] };
      const current: DesignSnapshot = { nodes: [{ id: 'n1', props: { a: 2 } }] };

      manager.analyzeDomain('architecture', snap, current);
      const modified = manager.getChangesByType('modified');
      expect(modified.length).toBe(1);
      expect(modified[0].fieldDiffs.some((d) => d.field === 'props')).toBe(true);
    });

    it('treats identical nested objects as equal', () => {
      const snap: DesignSnapshot = { nodes: [{ id: 'n1', props: { a: 1, b: [2, 3] } }] };
      const current: DesignSnapshot = { nodes: [{ id: 'n1', props: { a: 1, b: [2, 3] } }] };

      manager.analyzeDomain('architecture', snap, current);
      const changes = manager.getChangesForDomain('architecture');
      expect(changes[0].changeType).toBe('unchanged');
    });

    it('skips id field in diffs', () => {
      const snap: DesignSnapshot = { nodes: [{ id: 'n1', label: 'A' }] };
      const current: DesignSnapshot = { nodes: [{ id: 'n1', label: 'B' }] };

      manager.analyzeDomain('architecture', snap, current);
      const modified = manager.getChangesByType('modified');
      expect(modified[0].fieldDiffs.every((d) => d.field !== 'id')).toBe(true);
    });

    it('handles null values in fields', () => {
      const snap: DesignSnapshot = { nodes: [{ id: 'n1', value: null }] };
      const current: DesignSnapshot = { nodes: [{ id: 'n1', value: 42 }] };

      manager.analyzeDomain('architecture', snap, current);
      const modified = manager.getChangesByType('modified');
      expect(modified.length).toBe(1);
      const valueDiff = modified[0].fieldDiffs.find((d) => d.field === 'value');
      expect(valueDiff!.snapshotValue).toBeNull();
      expect(valueDiff!.currentValue).toBe(42);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-domain restore preview
  // -----------------------------------------------------------------------

  describe('multi-domain restore preview', () => {
    it('combines changes from multiple domains', () => {
      const snap: DesignSnapshot = {
        nodes: [makeNode('n1', 'Old')],
        bomItems: [makeBomItem('b1', 'R', 5)],
      };
      const current: DesignSnapshot = {
        nodes: [makeNode('n1', 'New')],
        bomItems: [makeBomItem('b1', 'R', 10)],
      };

      manager.analyzeDomain('architecture', snap, current);
      manager.analyzeDomain('bom', snap, current);
      manager.selectObjects(['n1', 'b1']);

      const preview = manager.generateRestorePreview();
      expect(preview.objectsToRestore.length).toBe(2);
      expect(preview.objectsToRestore.some((c) => c.domain === 'architecture')).toBe(true);
      expect(preview.objectsToRestore.some((c) => c.domain === 'bom')).toBe(true);
    });

    it('does not include unselected objects', () => {
      const snap: DesignSnapshot = {
        nodes: [makeNode('n1', 'Old'), makeNode('n2', 'Also Old')],
      };
      const current: DesignSnapshot = {
        nodes: [makeNode('n1', 'New'), makeNode('n2', 'Also New')],
      };

      manager.analyzeDomain('architecture', snap, current);
      manager.selectObjects(['n1']); // Only n1 selected

      const preview = manager.generateRestorePreview();
      expect(preview.objectsToRestore.length).toBe(1);
      expect(preview.objectsToRestore[0].id).toBe('n1');
    });
  });
});
