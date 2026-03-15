import { describe, it, expect } from 'vitest';
import {
  computeDesignDiff,
  changeTypeColor,
  changeTypeLabel,
} from '../design-diff-viewer';
import type {
  DesignSnapshot,
  DiffNode,
  DiffEdge,
  DiffBomItem,
  DiffCircuitInstance,
  DiffChangeType,
} from '../design-diff-viewer';

// ---------------------------------------------------------------------------
// Helpers — factory functions for test data
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<DiffNode> = {}): DiffNode {
  return {
    nodeId: 'n1',
    label: 'MCU',
    nodeType: 'microcontroller',
    positionX: 100,
    positionY: 200,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<DiffEdge> = {}): DiffEdge {
  return {
    edgeId: 'e1',
    source: 'n1',
    target: 'n2',
    label: 'SPI',
    signalType: 'data',
    ...overrides,
  };
}

function makeBomItem(overrides: Partial<DiffBomItem> = {}): DiffBomItem {
  return {
    partNumber: 'ATmega328P',
    manufacturer: 'Microchip',
    description: '8-bit AVR MCU',
    quantity: 1,
    unitPrice: '3.50',
    supplier: 'Mouser',
    status: 'In Stock',
    ...overrides,
  };
}

function makeCircuitInstance(overrides: Partial<DiffCircuitInstance> = {}): DiffCircuitInstance {
  return {
    referenceDesignator: 'U1',
    schematicX: 10,
    schematicY: 20,
    properties: null,
    ...overrides,
  };
}

function emptySnapshot(): DesignSnapshot {
  return { nodes: [], edges: [], bomItems: [], circuitInstances: [] };
}

// =============================================================================
// computeDesignDiff — Empty snapshots
// =============================================================================

describe('computeDesignDiff', () => {
  describe('empty snapshots', () => {
    it('returns empty sections when both snapshots are empty', () => {
      const result = computeDesignDiff(emptySnapshot(), emptySnapshot());
      expect(result.sections).toHaveLength(4);
      for (const section of result.sections) {
        expect(section.rows).toHaveLength(0);
        expect(section.summary.total).toBe(0);
      }
      expect(result.totalSummary.total).toBe(0);
    });

    it('returns correct section IDs and labels', () => {
      const result = computeDesignDiff(emptySnapshot(), emptySnapshot());
      expect(result.sections.map((s) => s.id)).toEqual([
        'arch-nodes',
        'arch-edges',
        'bom',
        'circuit-instances',
      ]);
      expect(result.sections.map((s) => s.label)).toEqual([
        'Architecture Nodes',
        'Architecture Edges',
        'BOM Items',
        'Circuit Instances',
      ]);
    });
  });

  // ===========================================================================
  // Architecture Nodes section
  // ===========================================================================

  describe('architecture nodes', () => {
    it('detects added nodes', () => {
      const baseline = emptySnapshot();
      const current = { ...emptySnapshot(), nodes: [makeNode()] };
      const result = computeDesignDiff(baseline, current);
      const section = result.sections[0];

      expect(section.summary.added).toBe(1);
      expect(section.rows).toHaveLength(1);
      expect(section.rows[0].changeType).toBe('added');
      expect(section.rows[0].key).toBe('n1');
      expect(section.rows[0].baselineFields).toBeNull();
      expect(section.rows[0].currentFields).not.toBeNull();
    });

    it('detects removed nodes', () => {
      const baseline = { ...emptySnapshot(), nodes: [makeNode()] };
      const current = emptySnapshot();
      const result = computeDesignDiff(baseline, current);
      const section = result.sections[0];

      expect(section.summary.removed).toBe(1);
      expect(section.rows[0].changeType).toBe('removed');
      expect(section.rows[0].currentFields).toBeNull();
      expect(section.rows[0].baselineFields).not.toBeNull();
    });

    it('detects modified nodes', () => {
      const baseline = { ...emptySnapshot(), nodes: [makeNode()] };
      const current = { ...emptySnapshot(), nodes: [makeNode({ label: 'ESP32' })] };
      const result = computeDesignDiff(baseline, current);
      const section = result.sections[0];

      expect(section.summary.modified).toBe(1);
      expect(section.rows[0].changeType).toBe('modified');
      expect(section.rows[0].fieldChanges).toHaveLength(1);
      expect(section.rows[0].fieldChanges[0].field).toBe('Label');
      expect(section.rows[0].fieldChanges[0].oldValue).toBe('MCU');
      expect(section.rows[0].fieldChanges[0].newValue).toBe('ESP32');
    });

    it('identifies unchanged nodes', () => {
      const nodes = [makeNode()];
      const result = computeDesignDiff(
        { ...emptySnapshot(), nodes },
        { ...emptySnapshot(), nodes },
      );
      const section = result.sections[0];

      expect(section.summary.unchanged).toBe(1);
      expect(section.rows[0].changeType).toBe('unchanged');
      expect(section.rows[0].fieldChanges).toHaveLength(0);
    });

    it('detects position changes', () => {
      const baseline = { ...emptySnapshot(), nodes: [makeNode()] };
      const current = { ...emptySnapshot(), nodes: [makeNode({ positionX: 500, positionY: 600 })] };
      const result = computeDesignDiff(baseline, current);
      const row = result.sections[0].rows[0];

      expect(row.changeType).toBe('modified');
      const changedFields = row.fieldChanges.map((c) => c.field);
      expect(changedFields).toContain('X');
      expect(changedFields).toContain('Y');
    });

    it('handles multiple nodes with mixed changes', () => {
      const baseline = {
        ...emptySnapshot(),
        nodes: [
          makeNode({ nodeId: 'n1', label: 'MCU' }),
          makeNode({ nodeId: 'n2', label: 'Sensor' }),
          makeNode({ nodeId: 'n3', label: 'Motor' }),
        ],
      };
      const current = {
        ...emptySnapshot(),
        nodes: [
          makeNode({ nodeId: 'n1', label: 'MCU' }), // unchanged
          makeNode({ nodeId: 'n2', label: 'IMU' }),  // modified
          makeNode({ nodeId: 'n4', label: 'GPS' }),  // added (n3 removed)
        ],
      };
      const result = computeDesignDiff(baseline, current);
      const section = result.sections[0];

      expect(section.summary.added).toBe(1);
      expect(section.summary.removed).toBe(1);
      expect(section.summary.modified).toBe(1);
      expect(section.summary.unchanged).toBe(1);
      expect(section.summary.total).toBe(4);
    });
  });

  // ===========================================================================
  // Architecture Edges section
  // ===========================================================================

  describe('architecture edges', () => {
    it('detects added edges', () => {
      const result = computeDesignDiff(
        emptySnapshot(),
        { ...emptySnapshot(), edges: [makeEdge()] },
      );
      expect(result.sections[1].summary.added).toBe(1);
    });

    it('detects removed edges', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), edges: [makeEdge()] },
        emptySnapshot(),
      );
      expect(result.sections[1].summary.removed).toBe(1);
    });

    it('detects modified edges (label change)', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), edges: [makeEdge()] },
        { ...emptySnapshot(), edges: [makeEdge({ label: 'I2C' })] },
      );
      const row = result.sections[1].rows[0];
      expect(row.changeType).toBe('modified');
      expect(row.fieldChanges.some((c) => c.field === 'Label')).toBe(true);
    });

    it('detects signal type changes', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), edges: [makeEdge({ signalType: 'data' })] },
        { ...emptySnapshot(), edges: [makeEdge({ signalType: 'power' })] },
      );
      const row = result.sections[1].rows[0];
      expect(row.changeType).toBe('modified');
      expect(row.fieldChanges.some((c) => c.field === 'Signal Type')).toBe(true);
    });

    it('uses source→target as label when edge has no label', () => {
      const result = computeDesignDiff(
        emptySnapshot(),
        { ...emptySnapshot(), edges: [makeEdge({ label: null })] },
      );
      expect(result.sections[1].rows[0].label).toBe('n1 → n2');
    });
  });

  // ===========================================================================
  // BOM Items section
  // ===========================================================================

  describe('BOM items', () => {
    it('detects added BOM items', () => {
      const result = computeDesignDiff(
        emptySnapshot(),
        { ...emptySnapshot(), bomItems: [makeBomItem()] },
      );
      expect(result.sections[2].summary.added).toBe(1);
      expect(result.sections[2].rows[0].key).toBe('ATmega328P');
    });

    it('detects removed BOM items', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), bomItems: [makeBomItem()] },
        emptySnapshot(),
      );
      expect(result.sections[2].summary.removed).toBe(1);
    });

    it('detects quantity changes', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), bomItems: [makeBomItem({ quantity: 1 })] },
        { ...emptySnapshot(), bomItems: [makeBomItem({ quantity: 5 })] },
      );
      const row = result.sections[2].rows[0];
      expect(row.changeType).toBe('modified');
      expect(row.fieldChanges.some((c) => c.field === 'Qty')).toBe(true);
    });

    it('detects supplier changes', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), bomItems: [makeBomItem({ supplier: 'Mouser' })] },
        { ...emptySnapshot(), bomItems: [makeBomItem({ supplier: 'DigiKey' })] },
      );
      const row = result.sections[2].rows[0];
      expect(row.changeType).toBe('modified');
      const supplierChange = row.fieldChanges.find((c) => c.field === 'Supplier');
      expect(supplierChange).toBeDefined();
      expect(supplierChange?.oldValue).toBe('Mouser');
      expect(supplierChange?.newValue).toBe('DigiKey');
    });

    it('identifies unchanged BOM items', () => {
      const items = [makeBomItem()];
      const result = computeDesignDiff(
        { ...emptySnapshot(), bomItems: items },
        { ...emptySnapshot(), bomItems: items },
      );
      expect(result.sections[2].summary.unchanged).toBe(1);
    });
  });

  // ===========================================================================
  // Circuit Instances section
  // ===========================================================================

  describe('circuit instances', () => {
    it('detects added instances', () => {
      const result = computeDesignDiff(
        emptySnapshot(),
        { ...emptySnapshot(), circuitInstances: [makeCircuitInstance()] },
      );
      expect(result.sections[3].summary.added).toBe(1);
      expect(result.sections[3].rows[0].key).toBe('U1');
    });

    it('detects removed instances', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), circuitInstances: [makeCircuitInstance()] },
        emptySnapshot(),
      );
      expect(result.sections[3].summary.removed).toBe(1);
    });

    it('detects position changes on instances', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), circuitInstances: [makeCircuitInstance()] },
        { ...emptySnapshot(), circuitInstances: [makeCircuitInstance({ schematicX: 50 })] },
      );
      const row = result.sections[3].rows[0];
      expect(row.changeType).toBe('modified');
      expect(row.fieldChanges.some((c) => c.field === 'X')).toBe(true);
    });

    it('handles multiple instances', () => {
      const result = computeDesignDiff(
        {
          ...emptySnapshot(),
          circuitInstances: [
            makeCircuitInstance({ referenceDesignator: 'U1' }),
            makeCircuitInstance({ referenceDesignator: 'R1' }),
          ],
        },
        {
          ...emptySnapshot(),
          circuitInstances: [
            makeCircuitInstance({ referenceDesignator: 'U1' }),
            makeCircuitInstance({ referenceDesignator: 'C1' }),
          ],
        },
      );
      const section = result.sections[3];
      expect(section.summary.unchanged).toBe(1); // U1
      expect(section.summary.removed).toBe(1);   // R1
      expect(section.summary.added).toBe(1);      // C1
    });
  });

  // ===========================================================================
  // Cross-section / total summary
  // ===========================================================================

  describe('total summary', () => {
    it('aggregates counts across all sections', () => {
      const result = computeDesignDiff(
        {
          nodes: [makeNode()],
          edges: [makeEdge()],
          bomItems: [],
          circuitInstances: [],
        },
        {
          nodes: [makeNode({ label: 'Changed' })],
          edges: [],
          bomItems: [makeBomItem()],
          circuitInstances: [],
        },
      );

      expect(result.totalSummary.modified).toBe(1);  // node modified
      expect(result.totalSummary.removed).toBe(1);    // edge removed
      expect(result.totalSummary.added).toBe(1);      // bom added
      expect(result.totalSummary.total).toBe(3);
    });
  });

  // ===========================================================================
  // Sorting order
  // ===========================================================================

  describe('row sorting', () => {
    it('sorts rows: removed first, modified, added, unchanged last', () => {
      const result = computeDesignDiff(
        {
          ...emptySnapshot(),
          nodes: [
            makeNode({ nodeId: 'n1', label: 'A' }),
            makeNode({ nodeId: 'n2', label: 'B' }),
            makeNode({ nodeId: 'n3', label: 'C' }),
          ],
        },
        {
          ...emptySnapshot(),
          nodes: [
            makeNode({ nodeId: 'n1', label: 'A' }),       // unchanged
            makeNode({ nodeId: 'n2', label: 'B-mod' }),    // modified
            makeNode({ nodeId: 'n4', label: 'D' }),        // added (n3 removed)
          ],
        },
      );
      const types = result.sections[0].rows.map((r) => r.changeType);
      expect(types).toEqual(['removed', 'modified', 'added', 'unchanged']);
    });
  });

  // ===========================================================================
  // Column headers
  // ===========================================================================

  describe('columns', () => {
    it('provides correct column headers for each section', () => {
      const result = computeDesignDiff(emptySnapshot(), emptySnapshot());
      expect(result.sections[0].columns).toEqual(['Label', 'Type', 'X', 'Y']);
      expect(result.sections[1].columns).toEqual(['Source', 'Target', 'Label', 'Signal Type']);
      expect(result.sections[2].columns).toEqual(['Manufacturer', 'Description', 'Qty', 'Unit Price', 'Supplier', 'Status']);
      expect(result.sections[3].columns).toEqual(['Ref Des', 'X', 'Y']);
    });
  });

  // ===========================================================================
  // Field values in row data
  // ===========================================================================

  describe('field values', () => {
    it('populates baselineFields and currentFields for modified rows', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), nodes: [makeNode({ label: 'Old' })] },
        { ...emptySnapshot(), nodes: [makeNode({ label: 'New' })] },
      );
      const row = result.sections[0].rows[0];
      expect(row.baselineFields?.['Label']).toBe('Old');
      expect(row.currentFields?.['Label']).toBe('New');
    });

    it('handles null field values', () => {
      const result = computeDesignDiff(
        { ...emptySnapshot(), edges: [makeEdge({ signalType: null })] },
        { ...emptySnapshot(), edges: [makeEdge({ signalType: 'power' })] },
      );
      const row = result.sections[1].rows[0];
      expect(row.changeType).toBe('modified');
      const change = row.fieldChanges.find((c) => c.field === 'Signal Type');
      expect(change?.oldValue).toBeNull();
      expect(change?.newValue).toBe('power');
    });
  });
});

// =============================================================================
// changeTypeColor
// =============================================================================

describe('changeTypeColor', () => {
  it('returns green for added', () => {
    expect(changeTypeColor('added')).toContain('green');
  });

  it('returns red for removed', () => {
    expect(changeTypeColor('removed')).toContain('red');
  });

  it('returns amber for modified', () => {
    expect(changeTypeColor('modified')).toContain('amber');
  });

  it('returns muted for unchanged', () => {
    expect(changeTypeColor('unchanged')).toContain('muted');
  });

  it('returns non-empty strings for all types', () => {
    const types: DiffChangeType[] = ['added', 'removed', 'modified', 'unchanged'];
    for (const t of types) {
      expect(changeTypeColor(t).length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// changeTypeLabel
// =============================================================================

describe('changeTypeLabel', () => {
  it('returns correct labels', () => {
    expect(changeTypeLabel('added')).toBe('Added');
    expect(changeTypeLabel('removed')).toBe('Removed');
    expect(changeTypeLabel('modified')).toBe('Modified');
    expect(changeTypeLabel('unchanged')).toBe('Unchanged');
  });
});
