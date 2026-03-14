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
