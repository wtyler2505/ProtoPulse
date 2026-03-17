import { describe, it, expect } from 'vitest';
import {
  diffDesigns,
  getDiffSummary,
  formatDiffChange,
  groupChangesByEntity,
} from '../import-diff-engine';
import type {
  DesignSnapshot,
  DiffChange,
  DiffEntityType,
  ImportDiffResult,
} from '../import-diff-engine';

// ---------------------------------------------------------------------------
// Helpers — factory functions for test data
// ---------------------------------------------------------------------------

function emptySnapshot(): DesignSnapshot {
  return { nodes: [], edges: [], bomItems: [], nets: [] };
}

function makeSnapshot(overrides: Partial<DesignSnapshot> = {}): DesignSnapshot {
  return { ...emptySnapshot(), ...overrides };
}

// =============================================================================
// diffDesigns — identical designs
// =============================================================================

describe('diffDesigns', () => {
  describe('identical designs', () => {
    it('returns no changes for two empty snapshots', () => {
      const result = diffDesigns(emptySnapshot(), emptySnapshot());
      expect(result.changes).toHaveLength(0);
      expect(result.severity).toBe('none');
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
      expect(result.summary.modified).toBe(0);
      expect(result.summary.unchanged).toBe(0);
    });

    it('returns severity "none" when both snapshots have identical nodes', () => {
      const nodes = [{ id: 'n1', label: 'MCU', type: 'microcontroller' }];
      const result = diffDesigns(makeSnapshot({ nodes }), makeSnapshot({ nodes }));
      expect(result.changes).toHaveLength(0);
      expect(result.severity).toBe('none');
      expect(result.summary.unchanged).toBe(1);
    });

    it('returns severity "none" when all entities are identical', () => {
      const snap: DesignSnapshot = {
        nodes: [
          { id: 'n1', label: 'MCU', type: 'microcontroller' },
          { id: 'n2', label: 'Sensor', type: 'sensor' },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        bomItems: [{ id: 'b1', partNumber: 'ATmega328P', quantity: 1 }],
        nets: [{ id: 'net1', name: 'VCC' }],
      };
      const result = diffDesigns(snap, snap);
      expect(result.changes).toHaveLength(0);
      expect(result.severity).toBe('none');
      expect(result.summary.unchanged).toBe(5);
    });
  });

  // ===========================================================================
  // Added entities
  // ===========================================================================

  describe('added entities', () => {
    it('detects added nodes', () => {
      const imported = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'MCU', type: 'microcontroller' },
          { id: 'n2', label: 'Sensor', type: 'sensor' },
        ],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'microcontroller' }],
      });
      const result = diffDesigns(imported, current);

      expect(result.summary.added).toBe(1);
      const added = result.changes.filter((c) => c.type === 'added');
      expect(added).toHaveLength(1);
      expect(added[0].entityType).toBe('node');
      expect(added[0].id).toBe('n2');
      expect(added[0].label).toBe('Sensor');
    });

    it('detects added edges', () => {
      const imported = makeSnapshot({
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
        ],
      });
      const current = makeSnapshot({
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.added).toBe(1);
      expect(result.changes[0].entityType).toBe('edge');
    });

    it('detects added BOM items', () => {
      const imported = makeSnapshot({
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 10 }],
      });
      const current = makeSnapshot();
      const result = diffDesigns(imported, current);
      expect(result.summary.added).toBe(1);
      expect(result.changes[0].entityType).toBe('bomItem');
    });

    it('detects added nets', () => {
      const imported = makeSnapshot({
        nets: [{ id: 'net1', name: 'VCC' }],
      });
      const current = makeSnapshot();
      const result = diffDesigns(imported, current);
      expect(result.summary.added).toBe(1);
      expect(result.changes[0].entityType).toBe('net');
    });

    it('severity is minor when only additions with low percentage', () => {
      const current = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'A', type: 'a' },
          { id: 'n2', label: 'B', type: 'b' },
          { id: 'n3', label: 'C', type: 'c' },
          { id: 'n4', label: 'D', type: 'd' },
          { id: 'n5', label: 'E', type: 'e' },
          { id: 'n6', label: 'F', type: 'f' },
        ],
      });
      const imported = makeSnapshot({
        nodes: [
          ...current.nodes,
          { id: 'n7', label: 'G', type: 'g' },
        ],
      });
      const result = diffDesigns(imported, current);
      expect(result.severity).toBe('minor');
    });
  });

  // ===========================================================================
  // Removed entities
  // ===========================================================================

  describe('removed entities', () => {
    it('detects removed nodes', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'microcontroller' }],
      });
      const current = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'MCU', type: 'microcontroller' },
          { id: 'n2', label: 'Sensor', type: 'sensor' },
        ],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.removed).toBe(1);
      const removed = result.changes.filter((c) => c.type === 'removed');
      expect(removed).toHaveLength(1);
      expect(removed[0].id).toBe('n2');
    });

    it('detects removed BOM items', () => {
      const imported = makeSnapshot();
      const current = makeSnapshot({
        bomItems: [{ id: 'b1', partNumber: 'Cap100nF', quantity: 5 }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.removed).toBe(1);
    });

    it('severity is breaking when removed nodes have connected edges in current', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'micro' }],
      });
      const current = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'MCU', type: 'micro' },
          { id: 'n2', label: 'Sensor', type: 'sensor' },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      });
      const result = diffDesigns(imported, current);
      // n2 is removed (in current but not imported), and e1 references n2
      expect(result.severity).toBe('breaking');
    });
  });

  // ===========================================================================
  // Modified entities
  // ===========================================================================

  describe('modified entities', () => {
    it('detects label changes on nodes', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'n1', label: 'ESP32', type: 'microcontroller' }],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'microcontroller' }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.modified).toBe(1);
      const mod = result.changes.find((c) => c.type === 'modified');
      expect(mod).toBeDefined();
      expect(mod!.changedFields).toContain('label');
      expect(mod!.before).toEqual({ id: 'n1', label: 'MCU', type: 'microcontroller' });
      expect(mod!.after).toEqual({ id: 'n1', label: 'ESP32', type: 'microcontroller' });
    });

    it('detects type changes on nodes', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'processor' }],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'microcontroller' }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.modified).toBe(1);
      expect(result.changes[0].changedFields).toContain('type');
    });

    it('detects source/target changes on edges', () => {
      const imported = makeSnapshot({
        edges: [{ id: 'e1', source: 'n1', target: 'n3' }],
      });
      const current = makeSnapshot({
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.modified).toBe(1);
      expect(result.changes[0].changedFields).toContain('target');
    });

    it('detects quantity changes on BOM items', () => {
      const imported = makeSnapshot({
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 20 }],
      });
      const current = makeSnapshot({
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 10 }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.modified).toBe(1);
      expect(result.changes[0].changedFields).toContain('quantity');
    });

    it('detects partNumber changes on BOM items', () => {
      const imported = makeSnapshot({
        bomItems: [{ id: 'b1', partNumber: 'R2K2', quantity: 10 }],
      });
      const current = makeSnapshot({
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 10 }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.modified).toBe(1);
      expect(result.changes[0].changedFields).toContain('partNumber');
    });

    it('detects name changes on nets', () => {
      const imported = makeSnapshot({
        nets: [{ id: 'net1', name: 'GND' }],
      });
      const current = makeSnapshot({
        nets: [{ id: 'net1', name: 'VCC' }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.modified).toBe(1);
      expect(result.changes[0].changedFields).toContain('name');
    });
  });

  // ===========================================================================
  // Fuzzy matching by label when IDs differ
  // ===========================================================================

  describe('fuzzy matching', () => {
    it('matches nodes by label when IDs differ', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'imported-1', label: 'MCU', type: 'microcontroller' }],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'current-1', label: 'MCU', type: 'microcontroller' }],
      });
      const result = diffDesigns(imported, current);
      // Should fuzzy match by label, not report add+remove
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
      expect(result.summary.unchanged).toBe(1);
    });

    it('matches nodes by label and detects field changes', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'x1', label: 'Sensor', type: 'imu' }],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'y1', label: 'Sensor', type: 'accelerometer' }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.modified).toBe(1);
      expect(result.changes[0].changedFields).toContain('type');
    });

    it('matches edges by source+target when IDs differ', () => {
      const imported = makeSnapshot({
        edges: [{ id: 'ie1', source: 'n1', target: 'n2' }],
      });
      const current = makeSnapshot({
        edges: [{ id: 'ce1', source: 'n1', target: 'n2' }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
      expect(result.summary.unchanged).toBe(1);
    });

    it('matches BOM items by partNumber when IDs differ', () => {
      const imported = makeSnapshot({
        bomItems: [{ id: 'ib1', partNumber: 'ATmega328P', quantity: 1 }],
      });
      const current = makeSnapshot({
        bomItems: [{ id: 'cb1', partNumber: 'ATmega328P', quantity: 1 }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.unchanged).toBe(1);
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
    });

    it('matches nets by name when IDs differ', () => {
      const imported = makeSnapshot({
        nets: [{ id: 'inet1', name: 'VCC' }],
      });
      const current = makeSnapshot({
        nets: [{ id: 'cnet1', name: 'VCC' }],
      });
      const result = diffDesigns(imported, current);
      expect(result.summary.unchanged).toBe(1);
    });

    it('does not fuzzy match when labels also differ', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'x1', label: 'Motor', type: 'actuator' }],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'y1', label: 'Sensor', type: 'sensor' }],
      });
      const result = diffDesigns(imported, current);
      // Different ID AND different label → add + remove, not modify
      expect(result.summary.added).toBe(1);
      expect(result.summary.removed).toBe(1);
    });
  });

  // ===========================================================================
  // Severity classification
  // ===========================================================================

  describe('severity classification', () => {
    it('severity is "none" for identical designs', () => {
      const snap = makeSnapshot({
        nodes: [{ id: 'n1', label: 'A', type: 'a' }],
      });
      expect(diffDesigns(snap, snap).severity).toBe('none');
    });

    it('severity is "breaking" when removed nodes have edges', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'micro' }],
      });
      const current = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'MCU', type: 'micro' },
          { id: 'n2', label: 'Sensor', type: 'sensor' },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      });
      expect(diffDesigns(imported, current).severity).toBe('breaking');
    });

    it('severity is "major" when more than 20% of entities changed', () => {
      // 5 current nodes, 3 of them different in import → 60% change rate
      const current = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'A', type: 'a' },
          { id: 'n2', label: 'B', type: 'b' },
          { id: 'n3', label: 'C', type: 'c' },
          { id: 'n4', label: 'D', type: 'd' },
          { id: 'n5', label: 'E', type: 'e' },
        ],
      });
      const imported = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'A', type: 'a' },
          { id: 'n2', label: 'B', type: 'b' },
          // n3, n4, n5 removed; n6, n7, n8 added
          { id: 'n6', label: 'F', type: 'f' },
          { id: 'n7', label: 'G', type: 'g' },
          { id: 'n8', label: 'H', type: 'h' },
        ],
      });
      const result = diffDesigns(imported, current);
      expect(result.severity).toBe('major');
    });

    it('severity is "minor" when less than 20% of entities changed', () => {
      const nodes = Array.from({ length: 10 }, (_, i) => ({
        id: `n${i}`,
        label: `Node${i}`,
        type: 'generic',
      }));
      const imported = makeSnapshot({ nodes: [...nodes, { id: 'n10', label: 'New', type: 'generic' }] });
      const current = makeSnapshot({ nodes });
      const result = diffDesigns(imported, current);
      // 1 addition out of 11 total = ~9%
      expect(result.severity).toBe('minor');
    });
  });

  // ===========================================================================
  // getDiffSummary
  // ===========================================================================

  describe('getDiffSummary', () => {
    it('aggregates changes correctly', () => {
      const changes: DiffChange[] = [
        { type: 'added', entityType: 'node', id: 'n1', label: 'A' },
        { type: 'added', entityType: 'node', id: 'n2', label: 'B' },
        { type: 'removed', entityType: 'edge', id: 'e1', label: 'E1' },
        { type: 'modified', entityType: 'bomItem', id: 'b1', label: 'R1', changedFields: ['quantity'] },
      ];
      const summary = getDiffSummary(changes);
      expect(summary.added).toBe(2);
      expect(summary.removed).toBe(1);
      expect(summary.modified).toBe(1);
      expect(summary.unchanged).toBe(0);
    });

    it('returns zero counts for empty changes', () => {
      const summary = getDiffSummary([]);
      expect(summary.added).toBe(0);
      expect(summary.removed).toBe(0);
      expect(summary.modified).toBe(0);
      expect(summary.unchanged).toBe(0);
    });

    it('populates byEntityType breakdown', () => {
      const changes: DiffChange[] = [
        { type: 'added', entityType: 'node', id: 'n1', label: 'A' },
        { type: 'added', entityType: 'bomItem', id: 'b1', label: 'B' },
        { type: 'removed', entityType: 'node', id: 'n2', label: 'C' },
      ];
      const summary = getDiffSummary(changes);
      expect(summary.byEntityType.node.added).toBe(1);
      expect(summary.byEntityType.node.removed).toBe(1);
      expect(summary.byEntityType.bomItem.added).toBe(1);
      expect(summary.byEntityType.edge.added).toBe(0);
    });
  });

  // ===========================================================================
  // formatDiffChange
  // ===========================================================================

  describe('formatDiffChange', () => {
    it('formats an added node', () => {
      const change: DiffChange = {
        type: 'added',
        entityType: 'node',
        id: 'n1',
        label: 'MCU',
      };
      const text = formatDiffChange(change);
      expect(text).toContain('Added');
      expect(text).toContain('node');
      expect(text).toContain('MCU');
    });

    it('formats a removed edge', () => {
      const change: DiffChange = {
        type: 'removed',
        entityType: 'edge',
        id: 'e1',
        label: 'SPI Bus',
      };
      const text = formatDiffChange(change);
      expect(text).toContain('Removed');
      expect(text).toContain('edge');
      expect(text).toContain('SPI Bus');
    });

    it('formats a modified BOM item with changed fields', () => {
      const change: DiffChange = {
        type: 'modified',
        entityType: 'bomItem',
        id: 'b1',
        label: 'R1K',
        changedFields: ['quantity', 'partNumber'],
      };
      const text = formatDiffChange(change);
      expect(text).toContain('Modified');
      expect(text).toContain('bomItem');
      expect(text).toContain('R1K');
      expect(text).toContain('quantity');
      expect(text).toContain('partNumber');
    });

    it('formats a modified entity without changed fields gracefully', () => {
      const change: DiffChange = {
        type: 'modified',
        entityType: 'net',
        id: 'net1',
        label: 'VCC',
      };
      const text = formatDiffChange(change);
      expect(text).toContain('Modified');
      expect(text).toContain('net');
      expect(text).toContain('VCC');
    });
  });

  // ===========================================================================
  // groupChangesByEntity
  // ===========================================================================

  describe('groupChangesByEntity', () => {
    it('groups changes by entity type', () => {
      const changes: DiffChange[] = [
        { type: 'added', entityType: 'node', id: 'n1', label: 'A' },
        { type: 'added', entityType: 'edge', id: 'e1', label: 'E1' },
        { type: 'removed', entityType: 'node', id: 'n2', label: 'B' },
        { type: 'modified', entityType: 'bomItem', id: 'b1', label: 'R1', changedFields: ['quantity'] },
      ];
      const groups = groupChangesByEntity(changes);
      expect(groups.node).toHaveLength(2);
      expect(groups.edge).toHaveLength(1);
      expect(groups.bomItem).toHaveLength(1);
      expect(groups.net).toHaveLength(0);
    });

    it('returns empty arrays for entity types with no changes', () => {
      const groups = groupChangesByEntity([]);
      expect(groups.node).toHaveLength(0);
      expect(groups.edge).toHaveLength(0);
      expect(groups.bomItem).toHaveLength(0);
      expect(groups.net).toHaveLength(0);
    });

    it('preserves change order within each group', () => {
      const changes: DiffChange[] = [
        { type: 'added', entityType: 'node', id: 'n1', label: 'First' },
        { type: 'removed', entityType: 'node', id: 'n2', label: 'Second' },
        { type: 'modified', entityType: 'node', id: 'n3', label: 'Third', changedFields: ['label'] },
      ];
      const groups = groupChangesByEntity(changes);
      expect(groups.node[0].label).toBe('First');
      expect(groups.node[1].label).toBe('Second');
      expect(groups.node[2].label).toBe('Third');
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles one empty snapshot and one full snapshot', () => {
      const full = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'micro' }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 1 }],
        nets: [{ id: 'net1', name: 'VCC' }],
      });
      // imported is full, current is empty → everything is "added"
      const result = diffDesigns(full, emptySnapshot());
      expect(result.summary.added).toBe(4);
      expect(result.summary.removed).toBe(0);
    });

    it('handles current full, imported empty → everything removed', () => {
      const full = makeSnapshot({
        nodes: [{ id: 'n1', label: 'MCU', type: 'micro' }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 1 }],
        nets: [{ id: 'net1', name: 'VCC' }],
      });
      const result = diffDesigns(emptySnapshot(), full);
      expect(result.summary.removed).toBe(4);
      expect(result.summary.added).toBe(0);
    });

    it('handles all entities different between snapshots', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'n1', label: 'Alpha', type: 'a' }],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        bomItems: [{ id: 'b1', partNumber: 'PartA', quantity: 1 }],
        nets: [{ id: 'net1', name: 'NetA' }],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'n9', label: 'Omega', type: 'z' }],
        edges: [{ id: 'e9', source: 'n9', target: 'n8' }],
        bomItems: [{ id: 'b9', partNumber: 'PartZ', quantity: 99 }],
        nets: [{ id: 'net9', name: 'NetZ' }],
      });
      const result = diffDesigns(imported, current);
      // All different IDs and labels → 4 added + 4 removed
      expect(result.summary.added).toBe(4);
      expect(result.summary.removed).toBe(4);
    });

    it('handles duplicate IDs within a snapshot (last wins)', () => {
      const imported = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'First', type: 'a' },
          { id: 'n1', label: 'Second', type: 'b' },
        ],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'n1', label: 'Second', type: 'b' }],
      });
      const result = diffDesigns(imported, current);
      // Dedup by ID (last wins), so imported n1='Second'/'b' matches current
      expect(result.summary.unchanged).toBe(1);
      expect(result.summary.added).toBe(0);
    });

    it('handles large number of entities', () => {
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        id: `n${i}`,
        label: `Node${i}`,
        type: 'generic',
      }));
      const imported = makeSnapshot({ nodes });
      const current = makeSnapshot({ nodes });
      const result = diffDesigns(imported, current);
      expect(result.summary.unchanged).toBe(100);
      expect(result.changes).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Mixed changes across entity types
  // ===========================================================================

  describe('mixed changes', () => {
    it('handles simultaneous adds, removes, and modifications across types', () => {
      const current = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'MCU', type: 'micro' },
          { id: 'n2', label: 'OldSensor', type: 'sensor' },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 5 }],
        nets: [{ id: 'net1', name: 'VCC' }],
      });
      const imported = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'MCU', type: 'micro' },    // unchanged
          { id: 'n3', label: 'NewMotor', type: 'motor' }, // added (n2 removed)
        ],
        edges: [],                                          // e1 removed
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 10 }], // modified
        nets: [
          { id: 'net1', name: 'VCC' },                    // unchanged
          { id: 'net2', name: 'GND' },                    // added
        ],
      });
      const result = diffDesigns(imported, current);

      expect(result.summary.unchanged).toBe(2); // n1 + net1
      expect(result.summary.added).toBe(2);     // n3 + net2
      expect(result.summary.removed).toBe(2);   // n2 + e1
      expect(result.summary.modified).toBe(1);  // b1 quantity
    });
  });

  // ===========================================================================
  // before/after populated correctly
  // ===========================================================================

  describe('before/after fields', () => {
    it('populates before and after for modified nodes', () => {
      const imported = makeSnapshot({
        nodes: [{ id: 'n1', label: 'Updated', type: 'sensor' }],
      });
      const current = makeSnapshot({
        nodes: [{ id: 'n1', label: 'Original', type: 'sensor' }],
      });
      const result = diffDesigns(imported, current);
      const mod = result.changes.find((c) => c.type === 'modified');
      expect(mod!.before).toEqual({ id: 'n1', label: 'Original', type: 'sensor' });
      expect(mod!.after).toEqual({ id: 'n1', label: 'Updated', type: 'sensor' });
    });

    it('before is undefined for added entities', () => {
      const result = diffDesigns(
        makeSnapshot({ nodes: [{ id: 'n1', label: 'New', type: 'a' }] }),
        makeSnapshot(),
      );
      const added = result.changes.find((c) => c.type === 'added');
      expect(added!.before).toBeUndefined();
      expect(added!.after).toBeDefined();
    });

    it('after is undefined for removed entities', () => {
      const result = diffDesigns(
        makeSnapshot(),
        makeSnapshot({ nodes: [{ id: 'n1', label: 'Old', type: 'a' }] }),
      );
      const removed = result.changes.find((c) => c.type === 'removed');
      expect(removed!.before).toBeDefined();
      expect(removed!.after).toBeUndefined();
    });
  });

  // ===========================================================================
  // Integration: summary matches diffDesigns result
  // ===========================================================================

  describe('getDiffSummary consistency', () => {
    it('getDiffSummary matches the summary from diffDesigns', () => {
      const imported = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'MCU', type: 'micro' },
          { id: 'n3', label: 'GPS', type: 'gps' },
        ],
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 20 }],
      });
      const current = makeSnapshot({
        nodes: [
          { id: 'n1', label: 'MCU', type: 'micro' },
          { id: 'n2', label: 'Sensor', type: 'sensor' },
        ],
        bomItems: [{ id: 'b1', partNumber: 'R1K', quantity: 10 }],
      });
      const result = diffDesigns(imported, current);
      const recalculated = getDiffSummary(result.changes);
      expect(recalculated.added).toBe(result.summary.added);
      expect(recalculated.removed).toBe(result.summary.removed);
      expect(recalculated.modified).toBe(result.summary.modified);
    });
  });
});
