import { describe, it, expect } from 'vitest';
import type { BomItemLike, AssemblyMethod, AssemblySummary } from '../assembly-grouping';
import {
  classifyAssemblyMethod,
  groupByAssemblyMethod,
  getAssemblySummary,
  getAssemblyMethodLabel,
  getAssemblyMethodColor,
} from '../assembly-grouping';

// ── helpers ──────────────────────────────────────────────────────────

function item(overrides: Partial<BomItemLike> = {}): BomItemLike {
  return { id: 1, partNumber: 'X', ...overrides };
}

// ── classifyAssemblyMethod ───────────────────────────────────────────

describe('classifyAssemblyMethod', () => {
  // ── mountingType priority ──
  describe('mountingType takes priority', () => {
    it('returns smt when mountingType is "smd"', () => {
      expect(classifyAssemblyMethod(item({ mountingType: 'smd', package: 'DIP-8' }))).toBe('smt');
    });

    it('returns smt when mountingType is "SMD" (case-insensitive)', () => {
      expect(classifyAssemblyMethod(item({ mountingType: 'SMD' }))).toBe('smt');
    });

    it('returns tht when mountingType is "tht"', () => {
      expect(classifyAssemblyMethod(item({ mountingType: 'tht', package: 'QFP-44' }))).toBe('tht');
    });

    it('returns tht when mountingType is "THT" (case-insensitive)', () => {
      expect(classifyAssemblyMethod(item({ mountingType: 'THT' }))).toBe('tht');
    });
  });

  // ── SMT packages ──
  describe('SMT package patterns', () => {
    const smtPackages = [
      'QFP-44',
      'LQFP-48',
      'QFN-32',
      'VQFN-20',
      'SOIC-8',
      'SOP-16',
      'SOT-23',
      'SOT-223',
      'BGA-256',
      'TSSOP-20',
      'MSOP-8',
      'DFN-8',
      '0201',
      '0402',
      '0603',
      '0805',
      '1206',
      '1210',
      '2512',
    ];

    for (const pkg of smtPackages) {
      it(`classifies "${pkg}" as smt`, () => {
        expect(classifyAssemblyMethod(item({ package: pkg }))).toBe('smt');
      });
    }

    it('classifies "chip" package as smt', () => {
      expect(classifyAssemblyMethod(item({ package: 'chip' }))).toBe('smt');
    });

    it('classifies mixed-case "Soic-16" as smt', () => {
      expect(classifyAssemblyMethod(item({ package: 'Soic-16' }))).toBe('smt');
    });
  });

  // ── THT packages ──
  describe('THT package patterns', () => {
    const thtPackages = [
      'DIP-8',
      'PDIP-14',
      'SIP-3',
      'TO-220',
      'TO-92',
      'TO-3',
      'TO-247',
    ];

    for (const pkg of thtPackages) {
      it(`classifies "${pkg}" as tht`, () => {
        expect(classifyAssemblyMethod(item({ package: pkg }))).toBe('tht');
      });
    }

    it('classifies "Axial" as tht', () => {
      expect(classifyAssemblyMethod(item({ package: 'Axial' }))).toBe('tht');
    });

    it('classifies "radial" as tht', () => {
      expect(classifyAssemblyMethod(item({ package: 'radial' }))).toBe('tht');
    });
  });

  // ── Manual packages ──
  describe('manual assembly package patterns', () => {
    const manualPackages = [
      'header 2x5',
      'JST-XH-2',
      'Molex-KK-4',
      'connector-DB9',
      'switch-SPDT',
      'potentiometer-10K',
      'pot-1K',
      'heatsink-TO220',
      'terminal-block-2',
      'barrel-jack',
      'socket-DIP-28',
    ];

    for (const pkg of manualPackages) {
      it(`classifies "${pkg}" as manual`, () => {
        expect(classifyAssemblyMethod(item({ package: pkg }))).toBe('manual');
      });
    }
  });

  // ── description fallback ──
  describe('description fallback', () => {
    it('uses description when package is missing', () => {
      expect(classifyAssemblyMethod(item({ description: '100nF ceramic capacitor, 0805 SMD' }))).toBe('smt');
    });

    it('uses description when package is empty', () => {
      expect(classifyAssemblyMethod(item({ package: '', description: 'DIP-8 op-amp' }))).toBe('tht');
    });

    it('detects manual from description', () => {
      expect(classifyAssemblyMethod(item({ description: '2-pin screw terminal connector' }))).toBe('manual');
    });

    it('detects SMT from "surface mount" in description', () => {
      expect(classifyAssemblyMethod(item({ description: 'surface mount LED' }))).toBe('smt');
    });

    it('detects THT from "through hole" in description', () => {
      expect(classifyAssemblyMethod(item({ description: 'through hole resistor' }))).toBe('tht');
    });

    it('detects THT from "through-hole" (hyphenated) in description', () => {
      expect(classifyAssemblyMethod(item({ description: 'through-hole component' }))).toBe('tht');
    });
  });

  // ── edge cases ──
  describe('edge cases', () => {
    it('returns unknown for empty item', () => {
      expect(classifyAssemblyMethod({})).toBe('unknown');
    });

    it('returns unknown for item with no classifiable info', () => {
      expect(classifyAssemblyMethod(item({ partNumber: 'ABC123' }))).toBe('unknown');
    });

    it('returns unknown for undefined package and description', () => {
      expect(classifyAssemblyMethod(item({ package: undefined, description: undefined }))).toBe('unknown');
    });

    it('returns unknown for unrecognized package', () => {
      expect(classifyAssemblyMethod(item({ package: 'custom-module' }))).toBe('unknown');
    });

    it('handles package with leading/trailing whitespace', () => {
      expect(classifyAssemblyMethod(item({ package: '  QFP-44  ' }))).toBe('smt');
    });
  });
});

// ── groupByAssemblyMethod ────────────────────────────────────────────

describe('groupByAssemblyMethod', () => {
  it('returns empty array for empty input', () => {
    expect(groupByAssemblyMethod([])).toEqual([]);
  });

  it('groups all-SMT items into a single group', () => {
    const items: BomItemLike[] = [
      item({ id: 1, package: 'QFP-44' }),
      item({ id: 2, package: '0805' }),
      item({ id: 3, package: 'SOT-23' }),
    ];
    const groups = groupByAssemblyMethod(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].method).toBe('smt');
    expect(groups[0].count).toBe(3);
    expect(groups[0].percentage).toBe(100);
    expect(groups[0].items).toHaveLength(3);
  });

  it('groups mixed items into separate groups', () => {
    const items: BomItemLike[] = [
      item({ id: 1, package: 'QFP-44' }),
      item({ id: 2, package: 'DIP-8' }),
      item({ id: 3, package: 'header 2x5' }),
      item({ id: 4, package: '0603' }),
    ];
    const groups = groupByAssemblyMethod(items);
    expect(groups).toHaveLength(3);

    const smtGroup = groups.find((g) => g.method === 'smt');
    const thtGroup = groups.find((g) => g.method === 'tht');
    const manualGroup = groups.find((g) => g.method === 'manual');

    expect(smtGroup?.count).toBe(2);
    expect(thtGroup?.count).toBe(1);
    expect(manualGroup?.count).toBe(1);
  });

  it('sorts groups: smt, tht, manual, unknown', () => {
    const items: BomItemLike[] = [
      item({ id: 1, description: 'connector' }),
      item({ id: 2, package: 'DIP-8' }),
      item({ id: 3, package: 'custom-xyz' }),
      item({ id: 4, package: '0805' }),
    ];
    const groups = groupByAssemblyMethod(items);
    const order = groups.map((g) => g.method);
    expect(order).toEqual(['smt', 'tht', 'manual', 'unknown']);
  });

  it('percentages sum to ~100', () => {
    const items: BomItemLike[] = [
      item({ id: 1, package: 'QFP-44' }),
      item({ id: 2, package: 'DIP-8' }),
      item({ id: 3, package: 'header' }),
    ];
    const groups = groupByAssemblyMethod(items);
    const total = groups.reduce((acc, g) => acc + g.percentage, 0);
    expect(Math.round(total)).toBe(100);
  });

  it('calculates correct percentages for uneven splits', () => {
    const items: BomItemLike[] = [
      item({ id: 1, package: 'QFP-44' }),
      item({ id: 2, package: '0805' }),
      item({ id: 3, package: 'DIP-8' }),
    ];
    const groups = groupByAssemblyMethod(items);
    const smtGroup = groups.find((g) => g.method === 'smt');
    const thtGroup = groups.find((g) => g.method === 'tht');
    expect(smtGroup?.percentage).toBeCloseTo(66.67, 1);
    expect(thtGroup?.percentage).toBeCloseTo(33.33, 1);
  });

  it('omits groups with zero items', () => {
    const items: BomItemLike[] = [
      item({ id: 1, package: 'QFP-44' }),
      item({ id: 2, package: '0402' }),
    ];
    const groups = groupByAssemblyMethod(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].method).toBe('smt');
  });

  it('preserves item references in groups', () => {
    const original = item({ id: 42, package: 'SOT-23', partNumber: 'REG-3V3' });
    const groups = groupByAssemblyMethod([original]);
    expect(groups[0].items[0]).toBe(original);
  });
});

// ── getAssemblySummary ───────────────────────────────────────────────

describe('getAssemblySummary', () => {
  it('returns all zeros for empty input', () => {
    const summary = getAssemblySummary([]);
    expect(summary).toEqual<AssemblySummary>({
      total: 0,
      smt: 0,
      tht: 0,
      manual: 0,
      unknown: 0,
      smtPercentage: 0,
    });
  });

  it('calculates correct counts', () => {
    const items: BomItemLike[] = [
      item({ id: 1, package: 'QFP-44' }),
      item({ id: 2, package: '0805' }),
      item({ id: 3, package: 'DIP-8' }),
      item({ id: 4, package: 'header' }),
      item({ id: 5, package: 'custom-xyz' }),
    ];
    const summary = getAssemblySummary(items);
    expect(summary.total).toBe(5);
    expect(summary.smt).toBe(2);
    expect(summary.tht).toBe(1);
    expect(summary.manual).toBe(1);
    expect(summary.unknown).toBe(1);
    expect(summary.smtPercentage).toBe(40);
  });

  it('calculates smtPercentage correctly for all-SMT BOM', () => {
    const items: BomItemLike[] = [
      item({ id: 1, package: 'QFP-44' }),
      item({ id: 2, package: '0402' }),
    ];
    const summary = getAssemblySummary(items);
    expect(summary.smtPercentage).toBe(100);
  });

  it('calculates smtPercentage correctly for no-SMT BOM', () => {
    const items: BomItemLike[] = [
      item({ id: 1, package: 'DIP-8' }),
      item({ id: 2, package: 'TO-220' }),
    ];
    const summary = getAssemblySummary(items);
    expect(summary.smtPercentage).toBe(0);
  });
});

// ── getAssemblyMethodLabel ───────────────────────────────────────────

describe('getAssemblyMethodLabel', () => {
  it('returns "SMT (Surface Mount)" for smt', () => {
    expect(getAssemblyMethodLabel('smt')).toBe('SMT (Surface Mount)');
  });

  it('returns "THT (Through-Hole)" for tht', () => {
    expect(getAssemblyMethodLabel('tht')).toBe('THT (Through-Hole)');
  });

  it('returns "Manual Assembly" for manual', () => {
    expect(getAssemblyMethodLabel('manual')).toBe('Manual Assembly');
  });

  it('returns "Unknown" for unknown', () => {
    expect(getAssemblyMethodLabel('unknown')).toBe('Unknown');
  });
});

// ── getAssemblyMethodColor ───────────────────────────────────────────

describe('getAssemblyMethodColor', () => {
  it('returns a color string for each method', () => {
    const methods: AssemblyMethod[] = ['smt', 'tht', 'manual', 'unknown'];
    for (const m of methods) {
      const color = getAssemblyMethodColor(m);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it('returns different colors for different methods', () => {
    const colors = new Set(
      (['smt', 'tht', 'manual', 'unknown'] as AssemblyMethod[]).map((m) => getAssemblyMethodColor(m)),
    );
    expect(colors.size).toBe(4);
  });
});
