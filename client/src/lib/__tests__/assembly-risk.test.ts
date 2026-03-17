import { describe, it, expect } from 'vitest';
import {
  calculateAssemblyRisks,
  getRiskColor,
  getRiskLevel,
  getOverallRiskLevel,
  getRiskLevelLabel,
  getRiskLevelColor,
  getRiskLevelBadgeClasses,
  sortRisks,
} from '../assembly-risk';
import type { BomItem } from '@/lib/project-context';
import type { AssemblyRisk, ComponentPlacement } from '../assembly-risk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBomItem(overrides: Partial<BomItem> = {}): BomItem {
  return {
    id: '1',
    partNumber: 'TEST-001',
    manufacturer: 'TestCo',
    description: 'Generic part',
    quantity: 1,
    unitPrice: 1.0,
    totalPrice: 1.0,
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    ...overrides,
  } as BomItem;
}

// ---------------------------------------------------------------------------
// calculateAssemblyRisks
// ---------------------------------------------------------------------------

describe('calculateAssemblyRisks', () => {
  it('returns empty array for empty BOM', () => {
    expect(calculateAssemblyRisks([])).toEqual([]);
  });

  it('returns zero risk for a generic part with no risk patterns', () => {
    const items = [makeBomItem({ description: 'Wire 22AWG red' })];
    const risks = calculateAssemblyRisks(items);
    expect(risks).toHaveLength(1);
    expect(risks[0].riskScore).toBe(0);
    expect(risks[0].factors).toHaveLength(0);
  });

  it('detects BGA package risk', () => {
    const items = [makeBomItem({ description: 'MCU BGA-256 package', partNumber: 'STM32H7' })];
    const risks = calculateAssemblyRisks(items);
    expect(risks[0].riskScore).toBeGreaterThan(0);
    const bgaFactor = risks[0].factors.find((f) => f.name === 'BGA Package');
    expect(bgaFactor).toBeDefined();
    expect(bgaFactor!.score).toBeGreaterThanOrEqual(0.9);
  });

  it('detects WLCSP as highest BGA risk', () => {
    const items = [makeBomItem({ description: 'IC WLCSP-16' })];
    const risks = calculateAssemblyRisks(items);
    const bgaFactor = risks[0].factors.find((f) => f.name === 'BGA Package');
    expect(bgaFactor).toBeDefined();
    expect(bgaFactor!.score).toBe(1.0);
  });

  it('detects fine pitch risk', () => {
    const items = [makeBomItem({ description: 'QFP 0.5mm pitch 100-pin' })];
    const risks = calculateAssemblyRisks(items);
    const pitchFactor = risks[0].factors.find((f) => f.name === 'Fine Pitch');
    expect(pitchFactor).toBeDefined();
    expect(pitchFactor!.score).toBe(0.7);
  });

  it('detects 0.3mm as highest pitch risk', () => {
    const items = [makeBomItem({ description: 'IC 0.3mm pitch FBGA' })];
    const risks = calculateAssemblyRisks(items);
    const pitchFactor = risks[0].factors.find((f) => f.name === 'Fine Pitch');
    expect(pitchFactor).toBeDefined();
    expect(pitchFactor!.score).toBe(1.0);
  });

  it('detects small passive 0201', () => {
    const items = [makeBomItem({ description: 'Capacitor 100nF 0201' })];
    const risks = calculateAssemblyRisks(items);
    const smallFactor = risks[0].factors.find((f) => f.name === 'Small Passives');
    expect(smallFactor).toBeDefined();
    expect(smallFactor!.score).toBe(0.9);
  });

  it('detects 0402 small passive', () => {
    const items = [makeBomItem({ description: 'Resistor 10k 0402' })];
    const risks = calculateAssemblyRisks(items);
    const smallFactor = risks[0].factors.find((f) => f.name === 'Small Passives');
    expect(smallFactor).toBeDefined();
    expect(smallFactor!.score).toBe(0.7);
  });

  it('detects 01005 as highest small passive risk', () => {
    const items = [makeBomItem({ description: 'Cap 01005 22pF' })];
    const risks = calculateAssemblyRisks(items);
    const smallFactor = risks[0].factors.find((f) => f.name === 'Small Passives');
    expect(smallFactor).toBeDefined();
    expect(smallFactor!.score).toBe(1.0);
  });

  it('detects QFN hand-solder difficulty', () => {
    const items = [makeBomItem({ description: 'Voltage regulator QFN-20' })];
    const risks = calculateAssemblyRisks(items);
    const handFactor = risks[0].factors.find((f) => f.name === 'Hand-Solder Difficulty');
    expect(handFactor).toBeDefined();
    expect(handFactor!.score).toBe(0.85);
  });

  it('detects DFN hand-solder difficulty', () => {
    const items = [makeBomItem({ description: 'LDO DFN-8' })];
    const risks = calculateAssemblyRisks(items);
    const handFactor = risks[0].factors.find((f) => f.name === 'Hand-Solder Difficulty');
    expect(handFactor).toBeDefined();
    expect(handFactor!.score).toBe(0.85);
  });

  it('detects component height risk for electrolytic', () => {
    const items = [makeBomItem({ description: 'Electrolytic capacitor 100uF 25V' })];
    const risks = calculateAssemblyRisks(items);
    const heightFactor = risks[0].factors.find((f) => f.name === 'Component Height');
    expect(heightFactor).toBeDefined();
    expect(heightFactor!.score).toBe(0.5);
  });

  it('detects thermal sensitivity for LED', () => {
    const items = [makeBomItem({ description: 'LED red 0805 SMD' })];
    const risks = calculateAssemblyRisks(items);
    const thermalFactor = risks[0].factors.find((f) => f.name === 'Thermal Sensitivity');
    expect(thermalFactor).toBeDefined();
    expect(thermalFactor!.score).toBe(0.5);
  });

  it('detects thermal sensitivity for crystal', () => {
    const items = [makeBomItem({ description: 'Crystal 16MHz HC49' })];
    const risks = calculateAssemblyRisks(items);
    const thermalFactor = risks[0].factors.find((f) => f.name === 'Thermal Sensitivity');
    expect(thermalFactor).toBeDefined();
    expect(thermalFactor!.score).toBe(0.6);
  });

  it('detects battery thermal risk as highest thermal score', () => {
    const items = [makeBomItem({ description: 'Battery holder CR2032' })];
    const risks = calculateAssemblyRisks(items);
    const thermalFactor = risks[0].factors.find((f) => f.name === 'Thermal Sensitivity');
    expect(thermalFactor).toBeDefined();
    expect(thermalFactor!.score).toBe(0.8);
  });

  it('accumulates multiple risk factors for complex parts', () => {
    const items = [makeBomItem({ description: 'MCU BGA-400 0.4mm pitch MEMS sensor' })];
    const risks = calculateAssemblyRisks(items);
    expect(risks[0].factors.length).toBeGreaterThanOrEqual(3);
    expect(risks[0].riskScore).toBeGreaterThan(50);
  });

  it('assigns sequential refDes when no placements provided', () => {
    const items = [
      makeBomItem({ id: '1', description: 'Part A' }),
      makeBomItem({ id: '2', description: 'Part B' }),
    ];
    const risks = calculateAssemblyRisks(items);
    expect(risks[0].refDes).toBe('U1');
    expect(risks[1].refDes).toBe('U2');
  });

  it('uses placements refDes when provided', () => {
    const items = [makeBomItem({ partNumber: 'CAP-100N', description: 'Cap 0402' })];
    const placements: ComponentPlacement[] = [
      { refDes: 'C5', partNumber: 'CAP-100N', x: 10, y: 20, rotation: 0 },
    ];
    const risks = calculateAssemblyRisks(items, placements);
    expect(risks[0].refDes).toBe('C5');
  });

  it('handles multiple items independently', () => {
    const items = [
      makeBomItem({ id: '1', partNumber: 'R1', description: 'Resistor 10k 1206' }),
      makeBomItem({ id: '2', partNumber: 'U1', description: 'MCU BGA-256 0.5mm pitch' }),
    ];
    const risks = calculateAssemblyRisks(items);
    expect(risks).toHaveLength(2);
    expect(risks[1].riskScore).toBeGreaterThan(risks[0].riskScore);
  });

  it('preserves partNumber and description in results', () => {
    const items = [makeBomItem({ partNumber: 'ABC-123', description: 'Test component' })];
    const risks = calculateAssemblyRisks(items);
    expect(risks[0].partNumber).toBe('ABC-123');
    expect(risks[0].description).toBe('Test component');
  });

  it('detects MEMS thermal sensitivity', () => {
    const items = [makeBomItem({ description: 'MEMS accelerometer' })];
    const risks = calculateAssemblyRisks(items);
    const thermalFactor = risks[0].factors.find((f) => f.name === 'Thermal Sensitivity');
    expect(thermalFactor).toBeDefined();
    expect(thermalFactor!.score).toBe(0.7);
  });

  it('detects transformer height risk', () => {
    const items = [makeBomItem({ description: 'Transformer 5V 1A' })];
    const risks = calculateAssemblyRisks(items);
    const heightFactor = risks[0].factors.find((f) => f.name === 'Component Height');
    expect(heightFactor).toBeDefined();
    expect(heightFactor!.score).toBe(0.7);
  });
});

// ---------------------------------------------------------------------------
// getRiskColor
// ---------------------------------------------------------------------------

describe('getRiskColor', () => {
  it('returns green for score 0', () => {
    expect(getRiskColor(0)).toBe('#22c55e');
  });

  it('returns green for score 25', () => {
    expect(getRiskColor(25)).toBe('#22c55e');
  });

  it('returns yellow for score 26', () => {
    expect(getRiskColor(26)).toBe('#eab308');
  });

  it('returns yellow for score 50', () => {
    expect(getRiskColor(50)).toBe('#eab308');
  });

  it('returns orange for score 51', () => {
    expect(getRiskColor(51)).toBe('#f97316');
  });

  it('returns orange for score 75', () => {
    expect(getRiskColor(75)).toBe('#f97316');
  });

  it('returns red for score 76', () => {
    expect(getRiskColor(76)).toBe('#ef4444');
  });

  it('returns red for score 100', () => {
    expect(getRiskColor(100)).toBe('#ef4444');
  });

  it('clamps negative scores to green', () => {
    expect(getRiskColor(-10)).toBe('#22c55e');
  });

  it('clamps scores above 100 to red', () => {
    expect(getRiskColor(150)).toBe('#ef4444');
  });
});

// ---------------------------------------------------------------------------
// getRiskLevel
// ---------------------------------------------------------------------------

describe('getRiskLevel', () => {
  it('returns low for 0', () => expect(getRiskLevel(0)).toBe('low'));
  it('returns low for 25', () => expect(getRiskLevel(25)).toBe('low'));
  it('returns medium for 26', () => expect(getRiskLevel(26)).toBe('medium'));
  it('returns medium for 50', () => expect(getRiskLevel(50)).toBe('medium'));
  it('returns high for 51', () => expect(getRiskLevel(51)).toBe('high'));
  it('returns high for 75', () => expect(getRiskLevel(75)).toBe('high'));
  it('returns critical for 76', () => expect(getRiskLevel(76)).toBe('critical'));
  it('returns critical for 100', () => expect(getRiskLevel(100)).toBe('critical'));
});

// ---------------------------------------------------------------------------
// getOverallRiskLevel
// ---------------------------------------------------------------------------

describe('getOverallRiskLevel', () => {
  it('returns low for empty array', () => {
    expect(getOverallRiskLevel([])).toBe('low');
  });

  it('returns the level of the highest-scored item', () => {
    const risks: AssemblyRisk[] = [
      { refDes: 'R1', partNumber: 'R1', description: '', riskScore: 10, factors: [] },
      { refDes: 'U1', partNumber: 'U1', description: '', riskScore: 80, factors: [] },
      { refDes: 'C1', partNumber: 'C1', description: '', riskScore: 30, factors: [] },
    ];
    expect(getOverallRiskLevel(risks)).toBe('critical');
  });

  it('returns low when all items are low risk', () => {
    const risks: AssemblyRisk[] = [
      { refDes: 'R1', partNumber: 'R1', description: '', riskScore: 5, factors: [] },
      { refDes: 'R2', partNumber: 'R2', description: '', riskScore: 20, factors: [] },
    ];
    expect(getOverallRiskLevel(risks)).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// getRiskLevelLabel
// ---------------------------------------------------------------------------

describe('getRiskLevelLabel', () => {
  it('returns correct labels', () => {
    expect(getRiskLevelLabel('low')).toBe('Low Risk');
    expect(getRiskLevelLabel('medium')).toBe('Medium Risk');
    expect(getRiskLevelLabel('high')).toBe('High Risk');
    expect(getRiskLevelLabel('critical')).toBe('Critical Risk');
  });
});

// ---------------------------------------------------------------------------
// getRiskLevelColor
// ---------------------------------------------------------------------------

describe('getRiskLevelColor', () => {
  it('returns correct color classes', () => {
    expect(getRiskLevelColor('low')).toContain('emerald');
    expect(getRiskLevelColor('medium')).toContain('yellow');
    expect(getRiskLevelColor('high')).toContain('orange');
    expect(getRiskLevelColor('critical')).toContain('red');
  });
});

// ---------------------------------------------------------------------------
// getRiskLevelBadgeClasses
// ---------------------------------------------------------------------------

describe('getRiskLevelBadgeClasses', () => {
  it('returns bg + border + text classes for each level', () => {
    for (const level of ['low', 'medium', 'high', 'critical'] as const) {
      const classes = getRiskLevelBadgeClasses(level);
      expect(classes).toContain('bg-');
      expect(classes).toContain('border-');
      expect(classes).toContain('text-');
    }
  });
});

// ---------------------------------------------------------------------------
// sortRisks
// ---------------------------------------------------------------------------

describe('sortRisks', () => {
  const risks: AssemblyRisk[] = [
    { refDes: 'C1', partNumber: 'CAP-1', description: '', riskScore: 30, factors: [{ name: 'a', weight: 1, score: 0.3, description: '' }] },
    { refDes: 'U1', partNumber: 'MCU-1', description: '', riskScore: 90, factors: [{ name: 'a', weight: 1, score: 0.9, description: '' }, { name: 'b', weight: 1, score: 0.8, description: '' }] },
    { refDes: 'R1', partNumber: 'RES-1', description: '', riskScore: 10, factors: [] },
  ];

  it('sorts by riskScore descending', () => {
    const sorted = sortRisks(risks, 'riskScore', 'desc');
    expect(sorted[0].riskScore).toBe(90);
    expect(sorted[1].riskScore).toBe(30);
    expect(sorted[2].riskScore).toBe(10);
  });

  it('sorts by riskScore ascending', () => {
    const sorted = sortRisks(risks, 'riskScore', 'asc');
    expect(sorted[0].riskScore).toBe(10);
    expect(sorted[2].riskScore).toBe(90);
  });

  it('sorts by refDes ascending', () => {
    const sorted = sortRisks(risks, 'refDes', 'asc');
    expect(sorted[0].refDes).toBe('C1');
    expect(sorted[1].refDes).toBe('R1');
    expect(sorted[2].refDes).toBe('U1');
  });

  it('sorts by partNumber descending', () => {
    const sorted = sortRisks(risks, 'partNumber', 'desc');
    expect(sorted[0].partNumber).toBe('RES-1');
    expect(sorted[2].partNumber).toBe('CAP-1');
  });

  it('sorts by factors count descending', () => {
    const sorted = sortRisks(risks, 'factors', 'desc');
    expect(sorted[0].factors.length).toBe(2);
    expect(sorted[2].factors.length).toBe(0);
  });

  it('does not mutate original array', () => {
    const original = [...risks];
    sortRisks(risks, 'riskScore', 'asc');
    expect(risks).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// Structured Assembly Risk API — calculateAssemblyRisk
// ---------------------------------------------------------------------------

import {
  calculateAssemblyRisk,
  getStructuredRiskLevel,
} from '../assembly-risk';
import type { BomItemRiskInput } from '../assembly-risk';

describe('calculateAssemblyRisk (structured input)', () => {
  // -------------------------------------------------------------------------
  // Package complexity factor
  // -------------------------------------------------------------------------

  describe('package complexity', () => {
    it('scores BGA as 9', () => {
      const result = calculateAssemblyRisk({ package: 'BGA' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(9);
    });

    it('scores WLCSP as 10', () => {
      const result = calculateAssemblyRisk({ package: 'WLCSP' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(10);
    });

    it('scores QFN as 7', () => {
      const result = calculateAssemblyRisk({ package: 'QFN' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(7);
    });

    it('scores QFP as 6', () => {
      const result = calculateAssemblyRisk({ package: 'QFP' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(6);
    });

    it('scores SOIC as 3', () => {
      const result = calculateAssemblyRisk({ package: 'SOIC' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(3);
    });

    it('scores DIP as 2', () => {
      const result = calculateAssemblyRisk({ package: 'DIP' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(2);
    });

    it('scores axial as 1', () => {
      const result = calculateAssemblyRisk({ package: 'axial' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(1);
    });

    it('scores 0201 as 8', () => {
      const result = calculateAssemblyRisk({ package: '0201' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(8);
    });

    it('scores 01005 as 10', () => {
      const result = calculateAssemblyRisk({ package: '01005' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(10);
    });

    it('matches case-insensitively', () => {
      const result = calculateAssemblyRisk({ package: 'Bga' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(9);
    });

    it('matches substring packages (e.g. BGA-256)', () => {
      const result = calculateAssemblyRisk({ package: 'BGA-256' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(9);
    });

    it('returns null factor for unknown package', () => {
      const result = calculateAssemblyRisk({ package: 'XYZZY' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor).toBeUndefined();
    });

    it('returns null factor when package is undefined', () => {
      const result = calculateAssemblyRisk({});
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Pin count factor
  // -------------------------------------------------------------------------

  describe('pin count', () => {
    it('scores >100 pins as 9', () => {
      const result = calculateAssemblyRisk({ pinCount: 144 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(9);
    });

    it('scores >50 pins as 7', () => {
      const result = calculateAssemblyRisk({ pinCount: 64 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(7);
    });

    it('scores >20 pins as 5', () => {
      const result = calculateAssemblyRisk({ pinCount: 28 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(5);
    });

    it('scores >10 pins as 3', () => {
      const result = calculateAssemblyRisk({ pinCount: 14 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(3);
    });

    it('scores <=10 pins as 1', () => {
      const result = calculateAssemblyRisk({ pinCount: 8 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(1);
    });

    it('boundary: 101 pins scores 9', () => {
      const result = calculateAssemblyRisk({ pinCount: 101 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(9);
    });

    it('boundary: 100 pins scores 7', () => {
      const result = calculateAssemblyRisk({ pinCount: 100 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(7);
    });

    it('boundary: 50 pins scores 5', () => {
      const result = calculateAssemblyRisk({ pinCount: 50 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(5);
    });

    it('boundary: 10 pins scores 1', () => {
      const result = calculateAssemblyRisk({ pinCount: 10 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor!.score).toBe(1);
    });

    it('returns no factor for undefined pinCount', () => {
      const result = calculateAssemblyRisk({});
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor).toBeUndefined();
    });

    it('returns no factor for 0 pins', () => {
      const result = calculateAssemblyRisk({ pinCount: 0 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Fine pitch factor
  // -------------------------------------------------------------------------

  describe('fine pitch', () => {
    it('scores <0.4mm as 9', () => {
      const result = calculateAssemblyRisk({ pitch: 0.3 });
      const factor = result.factors.find((f) => f.name === 'Fine Pitch');
      expect(factor!.score).toBe(9);
    });

    it('scores <0.5mm as 7', () => {
      const result = calculateAssemblyRisk({ pitch: 0.4 });
      const factor = result.factors.find((f) => f.name === 'Fine Pitch');
      expect(factor!.score).toBe(7);
    });

    it('scores <0.65mm as 5', () => {
      const result = calculateAssemblyRisk({ pitch: 0.5 });
      const factor = result.factors.find((f) => f.name === 'Fine Pitch');
      expect(factor!.score).toBe(5);
    });

    it('scores <1.0mm as 3', () => {
      const result = calculateAssemblyRisk({ pitch: 0.8 });
      const factor = result.factors.find((f) => f.name === 'Fine Pitch');
      expect(factor!.score).toBe(3);
    });

    it('scores >=1.0mm as 1', () => {
      const result = calculateAssemblyRisk({ pitch: 1.27 });
      const factor = result.factors.find((f) => f.name === 'Fine Pitch');
      expect(factor!.score).toBe(1);
    });

    it('returns no factor for undefined pitch', () => {
      const result = calculateAssemblyRisk({});
      const factor = result.factors.find((f) => f.name === 'Fine Pitch');
      expect(factor).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Thermal pad factor
  // -------------------------------------------------------------------------

  describe('thermal pad', () => {
    it('adds +3 risk when hasThermalPad is true', () => {
      const result = calculateAssemblyRisk({ hasThermalPad: true });
      const factor = result.factors.find((f) => f.name === 'Thermal Pad');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(3);
    });

    it('no factor when hasThermalPad is false', () => {
      const result = calculateAssemblyRisk({ hasThermalPad: false });
      const factor = result.factors.find((f) => f.name === 'Thermal Pad');
      expect(factor).toBeUndefined();
    });

    it('no factor when hasThermalPad is undefined', () => {
      const result = calculateAssemblyRisk({});
      const factor = result.factors.find((f) => f.name === 'Thermal Pad');
      expect(factor).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Double-sided assembly factor
  // -------------------------------------------------------------------------

  describe('double-sided assembly', () => {
    it('adds +2 risk when isDoubleSided is true', () => {
      const result = calculateAssemblyRisk({ isDoubleSided: true });
      const factor = result.factors.find((f) => f.name === 'Double-Sided Assembly');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(2);
    });

    it('no factor when isDoubleSided is false', () => {
      const result = calculateAssemblyRisk({ isDoubleSided: false });
      const factor = result.factors.find((f) => f.name === 'Double-Sided Assembly');
      expect(factor).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Mounting type factor
  // -------------------------------------------------------------------------

  describe('mounting type', () => {
    it('adds +4 risk for manual placement', () => {
      const result = calculateAssemblyRisk({ mountingType: 'manual' });
      const factor = result.factors.find((f) => f.name === 'Manual Placement');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(4);
    });

    it('adds +2 risk for mixed technology', () => {
      const result = calculateAssemblyRisk({ mountingType: 'mixed' });
      const factor = result.factors.find((f) => f.name === 'Mixed Technology');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(2);
    });

    it('adds +1 risk for through-hole', () => {
      const result = calculateAssemblyRisk({ mountingType: 'tht' });
      const factor = result.factors.find((f) => f.name === 'Through-Hole');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(1);
    });

    it('no factor for smt (standard)', () => {
      const result = calculateAssemblyRisk({ mountingType: 'smt' });
      const mountFactors = result.factors.filter((f) =>
        ['Manual Placement', 'Mixed Technology', 'Through-Hole'].includes(f.name),
      );
      expect(mountFactors).toHaveLength(0);
    });

    it('no factor when mountingType is undefined', () => {
      const result = calculateAssemblyRisk({});
      const mountFactors = result.factors.filter((f) =>
        ['Manual Placement', 'Mixed Technology', 'Through-Hole'].includes(f.name),
      );
      expect(mountFactors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // ESD sensitivity factor
  // -------------------------------------------------------------------------

  describe('ESD sensitivity', () => {
    it('adds +2 risk when esdSensitive is true', () => {
      const result = calculateAssemblyRisk({ esdSensitive: true });
      const factor = result.factors.find((f) => f.name === 'ESD Sensitivity');
      expect(factor).toBeDefined();
      expect(factor!.score).toBe(2);
    });

    it('no factor when esdSensitive is false', () => {
      const result = calculateAssemblyRisk({ esdSensitive: false });
      const factor = result.factors.find((f) => f.name === 'ESD Sensitivity');
      expect(factor).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Combined scoring — realistic components
  // -------------------------------------------------------------------------

  describe('combined scoring for realistic components', () => {
    it('ATmega328P in DIP-28 is low risk', () => {
      const result = calculateAssemblyRisk({
        package: 'DIP',
        pinCount: 28,
        pitch: 2.54,
      });
      expect(result.level).toBe('low');
      expect(result.overall).toBeLessThan(40);
    });

    it('BGA-256 with fine pitch is critical risk', () => {
      const result = calculateAssemblyRisk({
        package: 'BGA',
        pinCount: 256,
        pitch: 0.4,
        hasThermalPad: true,
        esdSensitive: true,
      });
      // Base: (9*0.3 + 9*0.2 + 7*0.2) / 0.7 = 84 + modifiers: thermal(3) + esd(2) = 89
      expect(result.level).toBe('critical');
      expect(result.overall).toBeGreaterThanOrEqual(80);
    });

    it('WLCSP-500 with ultra-fine pitch and manual placement is critical risk', () => {
      const result = calculateAssemblyRisk({
        package: 'WLCSP',
        pinCount: 500,
        pitch: 0.3,
        hasThermalPad: true,
        isDoubleSided: true,
        mountingType: 'manual',
        esdSensitive: true,
      });
      expect(result.level).toBe('critical');
      expect(result.overall).toBeGreaterThanOrEqual(80);
    });

    it('QFN-20 with thermal pad is medium-to-high risk', () => {
      const result = calculateAssemblyRisk({
        package: 'QFN',
        pinCount: 20,
        pitch: 0.5,
        hasThermalPad: true,
      });
      expect(result.overall).toBeGreaterThanOrEqual(40);
      expect(result.factors.length).toBeGreaterThanOrEqual(3);
    });

    it('0402 resistor is moderate risk', () => {
      const result = calculateAssemblyRisk({
        package: '0402',
        pinCount: 2,
      });
      expect(result.overall).toBeGreaterThan(0);
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor!.score).toBe(6);
    });

    it('through-hole 1206 resistor is low risk', () => {
      const result = calculateAssemblyRisk({
        package: '1206',
        pinCount: 2,
        pitch: 3.2,
      });
      expect(result.level).toBe('low');
    });
  });

  // -------------------------------------------------------------------------
  // Level thresholds
  // -------------------------------------------------------------------------

  describe('level thresholds', () => {
    it('score 39 is low', () => {
      expect(getStructuredRiskLevel(39)).toBe('low');
    });

    it('score 40 is medium', () => {
      expect(getStructuredRiskLevel(40)).toBe('medium');
    });

    it('score 59 is medium', () => {
      expect(getStructuredRiskLevel(59)).toBe('medium');
    });

    it('score 60 is high', () => {
      expect(getStructuredRiskLevel(60)).toBe('high');
    });

    it('score 79 is high', () => {
      expect(getStructuredRiskLevel(79)).toBe('high');
    });

    it('score 80 is critical', () => {
      expect(getStructuredRiskLevel(80)).toBe('critical');
    });

    it('score 100 is critical', () => {
      expect(getStructuredRiskLevel(100)).toBe('critical');
    });

    it('score 0 is low', () => {
      expect(getStructuredRiskLevel(0)).toBe('low');
    });
  });

  // -------------------------------------------------------------------------
  // Suggestions generation
  // -------------------------------------------------------------------------

  describe('suggestions', () => {
    it('generates suggestions for high-risk BGA packages', () => {
      const result = calculateAssemblyRisk({ package: 'BGA', pinCount: 200 });
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some((s) => s.includes('X-ray'))).toBe(true);
    });

    it('generates stencil suggestion for thermal pad', () => {
      const result = calculateAssemblyRisk({ hasThermalPad: true });
      expect(result.suggestions.some((s) => s.includes('stencil'))).toBe(true);
    });

    it('generates ESD suggestion for esdSensitive', () => {
      const result = calculateAssemblyRisk({ esdSensitive: true });
      expect(result.suggestions.some((s) => s.includes('ESD') || s.includes('wrist strap'))).toBe(true);
    });

    it('generates drag soldering suggestion for fine pitch', () => {
      const result = calculateAssemblyRisk({ pitch: 0.5 });
      expect(result.suggestions.some((s) => s.includes('drag soldering') || s.includes('flux'))).toBe(true);
    });

    it('generates double-sided suggestion', () => {
      const result = calculateAssemblyRisk({ isDoubleSided: true });
      expect(result.suggestions.some((s) => s.includes('reflow side') || s.includes('heavier'))).toBe(true);
    });

    it('generates manual placement suggestion', () => {
      const result = calculateAssemblyRisk({ mountingType: 'manual' });
      expect(result.suggestions.some((s) => s.includes('manual assembly'))).toBe(true);
    });

    it('generates no suggestions for zero-risk items', () => {
      const result = calculateAssemblyRisk({});
      expect(result.suggestions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty input returns zero score and low level', () => {
      const result = calculateAssemblyRisk({});
      expect(result.overall).toBe(0);
      expect(result.level).toBe('low');
      expect(result.factors).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('all fields undefined returns zero score', () => {
      const input: BomItemRiskInput = {
        package: undefined,
        pinCount: undefined,
        pitch: undefined,
        hasThermalPad: undefined,
        isDoubleSided: undefined,
        mountingType: undefined,
        esdSensitive: undefined,
      };
      const result = calculateAssemblyRisk(input);
      expect(result.overall).toBe(0);
      expect(result.level).toBe('low');
    });

    it('negative pin count returns no pin factor', () => {
      const result = calculateAssemblyRisk({ pinCount: -5 });
      const factor = result.factors.find((f) => f.name === 'Pin Count');
      expect(factor).toBeUndefined();
    });

    it('negative pitch returns no pitch factor', () => {
      const result = calculateAssemblyRisk({ pitch: -1 });
      const factor = result.factors.find((f) => f.name === 'Fine Pitch');
      expect(factor).toBeUndefined();
    });

    it('empty string package returns no package factor', () => {
      const result = calculateAssemblyRisk({ package: '' });
      const factor = result.factors.find((f) => f.name === 'Package Complexity');
      expect(factor).toBeUndefined();
    });

    it('returns correct factor count with all inputs populated', () => {
      const result = calculateAssemblyRisk({
        package: 'BGA',
        pinCount: 256,
        pitch: 0.4,
        hasThermalPad: true,
        isDoubleSided: true,
        mountingType: 'manual',
        esdSensitive: true,
      });
      // All 7 factors should be present
      expect(result.factors).toHaveLength(7);
    });

    it('overall score is between 0 and 100', () => {
      const result = calculateAssemblyRisk({
        package: 'WLCSP',
        pinCount: 500,
        pitch: 0.2,
        hasThermalPad: true,
        isDoubleSided: true,
        mountingType: 'manual',
        esdSensitive: true,
      });
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });
  });
});
