import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DamageAssessor, useDamageAssessment } from '../damage-assessment';
import type { DamageObservation, DamageReport, ComponentType, DamageCategory } from '../damage-assessment';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeObservation(overrides: Partial<DamageObservation> = {}): DamageObservation {
  return {
    category: overrides.category ?? 'corrosion',
    indicator: overrides.indicator ?? 'visible corrosion',
    present: overrides.present ?? true,
    severity: overrides.severity,
  };
}

function makeObservations(
  items: Array<{
    category: DamageCategory;
    indicator: string;
    severity?: 'minor' | 'moderate' | 'severe';
    present?: boolean;
  }>,
): DamageObservation[] {
  return items.map((item) => ({
    category: item.category,
    indicator: item.indicator,
    present: item.present ?? true,
    severity: item.severity,
  }));
}

// ---------------------------------------------------------------------------
// DamageAssessor
// ---------------------------------------------------------------------------

describe('DamageAssessor', () => {
  let assessor: DamageAssessor;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    assessor = new DamageAssessor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Basic assessment structure
  // -----------------------------------------------------------------------

  it('returns a complete damage report with all required fields', () => {
    const report = assessor.assess('generic', []);
    expect(report.id).toBeTruthy();
    expect(typeof report.id).toBe('string');
    expect(report.componentType).toBe('generic');
    expect(typeof report.overallScore).toBe('number');
    expect(['A', 'B', 'C', 'D', 'F']).toContain(report.overallGrade);
    expect(Array.isArray(report.categories)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(typeof report.usable).toBe('boolean');
    expect(typeof report.assessedAt).toBe('number');
  });

  it('generates unique IDs for each assessment', () => {
    const r1 = assessor.assess('generic', []);
    const r2 = assessor.assess('generic', []);
    expect(r1.id).not.toBe(r2.id);
  });

  it('includes all six damage categories in results', () => {
    const report = assessor.assess('generic', []);
    const categories = report.categories.map((c) => c.category);
    expect(categories).toContain('corrosion');
    expect(categories).toContain('heat-damage');
    expect(categories).toContain('pin-health');
    expect(categories).toContain('marking-legibility');
    expect(categories).toContain('physical-damage');
    expect(categories).toContain('moisture');
    expect(report.categories).toHaveLength(6);
  });

  // -----------------------------------------------------------------------
  // No observations — perfect score
  // -----------------------------------------------------------------------

  it('gives a perfect score (100, grade A) with no observations', () => {
    const report = assessor.assess('ic', []);
    expect(report.overallScore).toBe(100);
    expect(report.overallGrade).toBe('A');
    expect(report.usable).toBe(true);
  });

  it('marks all categories as severity "none" with no observations', () => {
    const report = assessor.assess('resistor', []);
    for (const cat of report.categories) {
      expect(cat.severity).toBe('none');
      expect(cat.score).toBe(100);
      expect(cat.indicators).toHaveLength(0);
    }
  });

  // -----------------------------------------------------------------------
  // Observations where present=false are ignored
  // -----------------------------------------------------------------------

  it('ignores observations where present is false', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', present: false },
      { category: 'heat-damage', indicator: 'discoloration', present: false },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBe(100);
    expect(report.overallGrade).toBe('A');
  });

  // -----------------------------------------------------------------------
  // Grade calculation accuracy — boundary tests
  // -----------------------------------------------------------------------

  it('assigns grade A for score >= 90', () => {
    // Single minor observation to get score just in A range
    const observations = makeObservations([
      { category: 'marking-legibility', indicator: 'faded markings', severity: 'minor' },
    ]);
    const report = assessor.assess('generic', observations);
    // marking-legibility weight for generic is 0.10, minor penalty = 15
    // score = 100 - 0.10 * 15 = 98.5 rounded = 99
    expect(report.overallScore).toBeGreaterThanOrEqual(90);
    expect(report.overallGrade).toBe('A');
  });

  it('assigns grade B for score in [75, 89]', () => {
    // Moderate corrosion on generic: weight 0.20, penalty 35 → -7 = 93
    // + moderate physical damage: weight 0.25, penalty 35 → -8.75
    // + moderate heat damage: weight 0.20, penalty 35 → -7
    // = 100 - 22.75 = ~77
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
      { category: 'physical-damage', indicator: 'cracked or chipped body', severity: 'moderate' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBeGreaterThanOrEqual(75);
    expect(report.overallScore).toBeLessThan(90);
    expect(report.overallGrade).toBe('B');
  });

  it('assigns grade C for score in [60, 74]', () => {
    // generic weights: physical-damage 0.25, heat-damage 0.20, corrosion 0.20, pin-health 0.15, moisture 0.10, marking 0.10
    // severe corrosion: cat score 30 * 0.20 = 6, severe pin-health: 30 * 0.15 = 4.5
    // remaining at 100: 0.25 + 0.20 + 0.10 + 0.10 = 0.65 * 100 = 65
    // total = 6 + 4.5 + 65 = 75.5 -> round = 76 ... still B
    // Add moderate physical damage: cat score 65 * 0.25 = 16.25
    // severe corrosion: 30 * 0.20 = 6, remaining 100 * (0.20 + 0.15 + 0.10 + 0.10) = 55
    // total = 16.25 + 6 + 55 = 77.25 -> 77 still B
    // Need: severe physical 30 * 0.25=7.5, moderate heat 65*0.20=13, moderate corrosion 65*0.20=13
    // remaining 100*(0.15+0.10+0.10) = 35 => total = 7.5+13+13+35 = 68.5 -> 69
    const observations = makeObservations([
      { category: 'physical-damage', indicator: 'cracked or chipped body', severity: 'severe' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'moderate' },
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBeGreaterThanOrEqual(60);
    expect(report.overallScore).toBeLessThan(75);
    expect(report.overallGrade).toBe('C');
  });

  it('assigns grade D for score in [40, 59]', () => {
    // generic weights: physical 0.25, heat 0.20, corrosion 0.20, pin 0.15, moisture 0.10, marking 0.10
    // severe physical: 30*0.25=7.5, severe heat: 30*0.20=6, severe corrosion: 30*0.20=6
    // remaining 100*(0.15+0.10+0.10) = 35 => total = 7.5+6+6+35 = 54.5 -> 55
    const observations = makeObservations([
      { category: 'physical-damage', indicator: 'cracked or chipped body', severity: 'severe' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'severe' },
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBeGreaterThanOrEqual(40);
    expect(report.overallScore).toBeLessThan(60);
    expect(report.overallGrade).toBe('D');
  });

  it('assigns grade F for score < 40', () => {
    // Severe damage across all major categories
    const observations = makeObservations([
      { category: 'physical-damage', indicator: 'cracked or chipped body', severity: 'severe' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'severe' },
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
      { category: 'pin-health', indicator: 'bent or damaged pins', severity: 'severe' },
      { category: 'moisture', indicator: 'moisture or residue', severity: 'severe' },
      { category: 'marking-legibility', indicator: 'illegible markings', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBeLessThan(40);
    expect(report.overallGrade).toBe('F');
  });

  // -----------------------------------------------------------------------
  // Usability threshold
  // -----------------------------------------------------------------------

  it('marks component as usable when score >= 40', () => {
    const observations = makeObservations([
      { category: 'physical-damage', indicator: 'cracked or chipped body', severity: 'severe' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'severe' },
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBeGreaterThanOrEqual(40);
    expect(report.usable).toBe(true);
  });

  it('marks component as unusable when score < 40', () => {
    const observations = makeObservations([
      { category: 'physical-damage', indicator: 'cracked or chipped body', severity: 'severe' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'severe' },
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
      { category: 'pin-health', indicator: 'bent or damaged pins', severity: 'severe' },
      { category: 'moisture', indicator: 'moisture or residue', severity: 'severe' },
      { category: 'marking-legibility', indicator: 'illegible markings', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBeLessThan(40);
    expect(report.usable).toBe(false);
  });

  // -----------------------------------------------------------------------
  // All severe damage — score 0
  // -----------------------------------------------------------------------

  it('floors score at 0 for extreme damage', () => {
    // Multiple severe observations per category to push category scores to 0
    // Each category needs total penalty >= 100 to reach 0
    // severe = 70 penalty, so 2 severe per category = 140 penalty, category score = max(0, 100-140) = 0
    const observations = makeObservations([
      { category: 'physical-damage', indicator: 'cracked or chipped body', severity: 'severe' },
      { category: 'physical-damage', indicator: 'broken housing', severity: 'severe' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'severe' },
      { category: 'heat-damage', indicator: 'melted', severity: 'severe' },
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
      { category: 'corrosion', indicator: 'green patina', severity: 'severe' },
      { category: 'pin-health', indicator: 'bent or damaged pins', severity: 'severe' },
      { category: 'pin-health', indicator: 'missing pins', severity: 'severe' },
      { category: 'moisture', indicator: 'moisture or residue', severity: 'severe' },
      { category: 'moisture', indicator: 'water damage', severity: 'severe' },
      { category: 'marking-legibility', indicator: 'illegible markings', severity: 'severe' },
      { category: 'marking-legibility', indicator: 'erased text', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBe(0);
    expect(report.overallGrade).toBe('F');
    expect(report.usable).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Each damage category scored independently
  // -----------------------------------------------------------------------

  it('scores corrosion independently from other categories', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    const heatDamage = report.categories.find((c) => c.category === 'heat-damage')!;

    expect(corrosion.score).toBeLessThan(100);
    expect(corrosion.severity).not.toBe('none');
    expect(heatDamage.score).toBe(100);
    expect(heatDamage.severity).toBe('none');
  });

  it('scores pin-health independently from other categories', () => {
    const observations = makeObservations([
      { category: 'pin-health', indicator: 'bent or damaged pins', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    const pinHealth = report.categories.find((c) => c.category === 'pin-health')!;
    const physical = report.categories.find((c) => c.category === 'physical-damage')!;

    expect(pinHealth.score).toBeLessThan(100);
    expect(physical.score).toBe(100);
  });

  it('accumulates multiple observations within the same category', () => {
    const singleObs = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
    ]);
    const doubleObs = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
      { category: 'corrosion', indicator: 'green patina', severity: 'moderate' },
    ]);

    const single = assessor.assess('generic', singleObs);
    const double = assessor.assess('generic', doubleObs);

    const singleCorrosion = single.categories.find((c) => c.category === 'corrosion')!;
    const doubleCorrosion = double.categories.find((c) => c.category === 'corrosion')!;

    expect(doubleCorrosion.score).toBeLessThan(singleCorrosion.score);
  });

  // -----------------------------------------------------------------------
  // Component-specific assessment
  // -----------------------------------------------------------------------

  describe('electrolytic capacitor assessment', () => {
    it('rates bulging top as severe heat-damage', () => {
      const observations = makeObservations([
        { category: 'heat-damage', indicator: 'bulging top' },
      ]);
      const report = assessor.assess('capacitor-electrolytic', observations);
      const heatDamage = report.categories.find((c) => c.category === 'heat-damage')!;
      // bulging top default severity is 'severe', penalty = 70
      expect(heatDamage.score).toBe(30);
      expect(heatDamage.severity).toBe('severe');
      expect(heatDamage.indicators).toContain('bulging top');
    });

    it('rates leaking electrolyte as severe moisture damage', () => {
      const observations = makeObservations([
        { category: 'moisture', indicator: 'leaking electrolyte' },
      ]);
      const report = assessor.assess('capacitor-electrolytic', observations);
      const moisture = report.categories.find((c) => c.category === 'moisture')!;
      expect(moisture.score).toBe(30);
      expect(moisture.severity).toBe('severe');
    });

    it('generates disposal recommendation for bulging electrolytic cap', () => {
      const observations = makeObservations([
        { category: 'heat-damage', indicator: 'bulging top' },
      ]);
      const report = assessor.assess('capacitor-electrolytic', observations);
      const disposalRec = report.recommendations.find((r) =>
        r.toLowerCase().includes('leaking') || r.toLowerCase().includes('exploding') || r.toLowerCase().includes('dispose'),
      );
      expect(disposalRec).toBeTruthy();
    });
  });

  describe('IC chip assessment', () => {
    it('rates charred markings as severe heat damage', () => {
      const observations = makeObservations([
        { category: 'heat-damage', indicator: 'charred markings' },
      ]);
      const report = assessor.assess('ic', observations);
      const heatDamage = report.categories.find((c) => c.category === 'heat-damage')!;
      expect(heatDamage.score).toBe(30);
      expect(heatDamage.severity).toBe('severe');
    });

    it('rates broken pins as severe pin damage', () => {
      const observations = makeObservations([
        { category: 'pin-health', indicator: 'broken pins' },
      ]);
      const report = assessor.assess('ic', observations);
      const pinHealth = report.categories.find((c) => c.category === 'pin-health')!;
      expect(pinHealth.score).toBe(30);
      expect(pinHealth.severity).toBe('severe');
    });

    it('rates cracked package as severe physical damage', () => {
      const observations = makeObservations([
        { category: 'physical-damage', indicator: 'cracked package' },
      ]);
      const report = assessor.assess('ic', observations);
      const physical = report.categories.find((c) => c.category === 'physical-damage')!;
      expect(physical.score).toBe(30);
      expect(physical.severity).toBe('severe');
    });

    it('weighs pin-health most heavily for ICs', () => {
      // Same severe observation, pin-health should impact score more than marking-legibility
      const pinObs = makeObservations([
        { category: 'pin-health', indicator: 'broken pins', severity: 'severe' },
      ]);
      const markingObs = makeObservations([
        { category: 'marking-legibility', indicator: 'faded part number', severity: 'severe' },
      ]);

      const pinReport = assessor.assess('ic', pinObs);
      const markingReport = assessor.assess('ic', markingObs);

      // pin-health weight = 0.30, marking-legibility weight = 0.05
      // pin damage should reduce overall score more
      expect(pinReport.overallScore).toBeLessThan(markingReport.overallScore);
    });
  });

  describe('resistor assessment', () => {
    it('rates cracked body as severe physical damage', () => {
      const observations = makeObservations([
        { category: 'physical-damage', indicator: 'cracked body' },
      ]);
      const report = assessor.assess('resistor', observations);
      const physical = report.categories.find((c) => c.category === 'physical-damage')!;
      expect(physical.score).toBe(30);
      expect(physical.severity).toBe('severe');
    });

    it('rates color band fading as moderate marking damage', () => {
      const observations = makeObservations([
        { category: 'marking-legibility', indicator: 'color band fading' },
      ]);
      const report = assessor.assess('resistor', observations);
      const marking = report.categories.find((c) => c.category === 'marking-legibility')!;
      // default severity for color band fading = moderate, penalty = 35
      expect(marking.score).toBe(65);
      expect(marking.severity).toBe('moderate');
    });
  });

  describe('connector assessment', () => {
    it('rates bent pins as moderate pin damage', () => {
      const observations = makeObservations([
        { category: 'pin-health', indicator: 'bent pins' },
      ]);
      const report = assessor.assess('connector', observations);
      const pinHealth = report.categories.find((c) => c.category === 'pin-health')!;
      expect(pinHealth.score).toBe(65);
    });

    it('rates oxidized contacts as moderate corrosion', () => {
      const observations = makeObservations([
        { category: 'corrosion', indicator: 'oxidized contacts' },
      ]);
      const report = assessor.assess('connector', observations);
      const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
      expect(corrosion.score).toBe(65);
    });

    it('weighs pin-health most heavily for connectors', () => {
      const pinObs = makeObservations([
        { category: 'pin-health', indicator: 'missing pins', severity: 'severe' },
      ]);
      const moistureObs = makeObservations([
        { category: 'moisture', indicator: 'moisture residue', severity: 'severe' },
      ]);

      const pinReport = assessor.assess('connector', pinObs);
      const moistureReport = assessor.assess('connector', moistureObs);

      // pin-health weight = 0.35, moisture weight = 0.10
      expect(pinReport.overallScore).toBeLessThan(moistureReport.overallScore);
    });
  });

  describe('LED assessment', () => {
    it('rates cloudy lens as moderate physical damage', () => {
      const observations = makeObservations([
        { category: 'physical-damage', indicator: 'cloudy lens' },
      ]);
      const report = assessor.assess('led', observations);
      const physical = report.categories.find((c) => c.category === 'physical-damage')!;
      expect(physical.score).toBe(65);
    });

    it('rates cracked dome as severe physical damage', () => {
      const observations = makeObservations([
        { category: 'physical-damage', indicator: 'cracked dome' },
      ]);
      const report = assessor.assess('led', observations);
      const physical = report.categories.find((c) => c.category === 'physical-damage')!;
      expect(physical.score).toBe(30);
      expect(physical.severity).toBe('severe');
    });
  });

  // -----------------------------------------------------------------------
  // All component types produce valid reports
  // -----------------------------------------------------------------------

  it.each<ComponentType>([
    'ic', 'resistor', 'capacitor-electrolytic', 'capacitor-ceramic',
    'capacitor-tantalum', 'connector', 'led', 'transformer',
    'diode', 'transistor', 'relay', 'generic',
  ])('produces valid report for component type: %s', (componentType) => {
    const report = assessor.assess(componentType, []);
    expect(report.componentType).toBe(componentType);
    expect(report.overallScore).toBe(100);
    expect(report.overallGrade).toBe('A');
    expect(report.usable).toBe(true);
    expect(report.categories).toHaveLength(6);
  });

  // -----------------------------------------------------------------------
  // Overall score aggregation (weighted)
  // -----------------------------------------------------------------------

  it('computes overall score as weighted sum of category scores', () => {
    // Single severe corrosion observation on generic component
    // corrosion category score = 100 - 70 = 30
    // generic corrosion weight = 0.20
    // expected overall = round(30 * 0.20 + 100 * (1 - 0.20)) = round(6 + 80) = 86
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.overallScore).toBe(86);
    expect(report.overallGrade).toBe('B');
  });

  // -----------------------------------------------------------------------
  // Severity-based scoring
  // -----------------------------------------------------------------------

  it('applies correct penalty for minor severity (15 points)', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'minor' },
    ]);
    const report = assessor.assess('generic', observations);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    expect(corrosion.score).toBe(85);
  });

  it('applies correct penalty for moderate severity (35 points)', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    expect(corrosion.score).toBe(65);
  });

  it('applies correct penalty for severe severity (70 points)', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    expect(corrosion.score).toBe(30);
  });

  it('uses default severity from component profile when not specified', () => {
    // 'visible corrosion' for generic has defaultSeverity 'moderate' = penalty 35
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion' },
    ]);
    const report = assessor.assess('generic', observations);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    expect(corrosion.score).toBe(65);
  });

  // -----------------------------------------------------------------------
  // Recommendations
  // -----------------------------------------------------------------------

  it('generates excellent condition recommendation for high scores', () => {
    const report = assessor.assess('generic', []);
    expect(report.recommendations.some((r) => r.toLowerCase().includes('excellent'))).toBe(true);
  });

  it('generates multimeter recommendation for moderate damage', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'moderate' },
      { category: 'pin-health', indicator: 'bent or damaged pins', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.recommendations.some((r) => r.toLowerCase().includes('multimeter'))).toBe(true);
  });

  it('generates cleaning recommendation for moderate corrosion', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.recommendations.some((r) => r.toLowerCase().includes('isopropyl'))).toBe(true);
  });

  it('generates replace recommendation for severe heat damage', () => {
    const observations = makeObservations([
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.recommendations.some((r) => r.toLowerCase().includes('replace'))).toBe(true);
  });

  it('generates pin straightening recommendation for moderate pin damage', () => {
    const observations = makeObservations([
      { category: 'pin-health', indicator: 'bent or damaged pins', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.recommendations.some((r) => r.toLowerCase().includes('straighten'))).toBe(true);
  });

  it('generates recycling recommendation for unusable components', () => {
    const observations = makeObservations([
      { category: 'physical-damage', indicator: 'cracked or chipped body', severity: 'severe' },
      { category: 'heat-damage', indicator: 'heat damage signs', severity: 'severe' },
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
      { category: 'pin-health', indicator: 'bent or damaged pins', severity: 'severe' },
      { category: 'moisture', indicator: 'moisture or residue', severity: 'severe' },
      { category: 'marking-legibility', indicator: 'illegible markings', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    expect(report.recommendations.some((r) => r.toLowerCase().includes('recycling'))).toBe(true);
  });

  it('deduplicates recommendations', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
      { category: 'corrosion', indicator: 'green patina', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    const cleanRecs = report.recommendations.filter((r) => r.toLowerCase().includes('isopropyl'));
    expect(cleanRecs).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Tantalum capacitor specific
  // -----------------------------------------------------------------------

  it('warns about short-circuit risk for heat-damaged tantalum caps', () => {
    const observations = makeObservations([
      { category: 'heat-damage', indicator: 'discoloration', severity: 'moderate' },
    ]);
    const report = assessor.assess('capacitor-tantalum', observations);
    expect(report.recommendations.some((r) => r.toLowerCase().includes('tantalum'))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // getIndicators
  // -----------------------------------------------------------------------

  it('returns component-specific indicators', () => {
    const indicators = assessor.getIndicators('ic');
    expect(indicators.length).toBeGreaterThan(0);
    expect(indicators.some((i) => i.indicator === 'charred markings')).toBe(true);
    expect(indicators.some((i) => i.indicator === 'bent pins')).toBe(true);
  });

  it('returns generic indicators for unknown-like types', () => {
    const indicators = assessor.getIndicators('generic');
    expect(indicators.length).toBeGreaterThan(0);
    expect(indicators.some((i) => i.indicator === 'visible corrosion')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Category result indicators list
  // -----------------------------------------------------------------------

  it('populates indicators list in category results', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'oxidized contacts', severity: 'moderate' },
      { category: 'corrosion', indicator: 'corroded pins', severity: 'severe' },
    ]);
    const report = assessor.assess('connector', observations);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    expect(corrosion.indicators).toContain('oxidized contacts');
    expect(corrosion.indicators).toContain('corroded pins');
    expect(corrosion.indicators).toHaveLength(2);
  });

  it('deduplicates indicators within a category', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'minor' },
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'moderate' },
    ]);
    const report = assessor.assess('generic', observations);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    expect(corrosion.indicators).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Assessment history (localStorage persistence)
  // -----------------------------------------------------------------------

  it('saves a report to history', () => {
    const report = assessor.assess('ic', []);
    assessor.saveToHistory(report);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-damage-assessment-history',
      expect.any(String),
    );
  });

  it('loads history from localStorage', () => {
    const report = assessor.assess('ic', []);
    assessor.saveToHistory(report);

    const history = assessor.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(report.id);
  });

  it('stores history in reverse chronological order (newest first)', () => {
    const r1 = assessor.assess('ic', []);
    const r2 = assessor.assess('resistor', []);
    assessor.saveToHistory(r1);
    assessor.saveToHistory(r2);

    const history = assessor.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe(r2.id);
    expect(history[1].id).toBe(r1.id);
  });

  it('enforces max 100 history items', () => {
    for (let i = 0; i < 105; i++) {
      const report = assessor.assess('generic', []);
      assessor.saveToHistory(report);
    }
    const history = assessor.getHistory();
    expect(history).toHaveLength(100);
  });

  it('clears all history', () => {
    const report = assessor.assess('ic', []);
    assessor.saveToHistory(report);
    assessor.clearHistory();

    const history = assessor.getHistory();
    expect(history).toHaveLength(0);
  });

  it('handles corrupt localStorage history gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    const history = assessor.getHistory();
    expect(history).toHaveLength(0);
  });

  it('handles non-array localStorage history gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('"just a string"');
    const history = assessor.getHistory();
    expect(history).toHaveLength(0);
  });

  it('filters out invalid entries from localStorage history', () => {
    const validReport: DamageReport = {
      id: 'valid-1',
      componentType: 'ic',
      overallScore: 85,
      overallGrade: 'B',
      categories: [],
      recommendations: [],
      usable: true,
      assessedAt: Date.now(),
    };
    const data = [validReport, { invalid: true }, { id: 'missing-fields' }];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));

    const history = assessor.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('valid-1');
  });

  // -----------------------------------------------------------------------
  // Category severity description
  // -----------------------------------------------------------------------

  it('provides descriptive text for each severity level', () => {
    const observations = makeObservations([
      { category: 'corrosion', indicator: 'visible corrosion', severity: 'severe' },
    ]);
    const report = assessor.assess('generic', observations);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    expect(corrosion.description.length).toBeGreaterThan(0);
    expect(corrosion.description.toLowerCase()).toContain('corrosion');
  });

  it('provides "no issues" description for undamaged categories', () => {
    const report = assessor.assess('generic', []);
    const corrosion = report.categories.find((c) => c.category === 'corrosion')!;
    expect(corrosion.description.toLowerCase()).toContain('no');
    expect(corrosion.description.toLowerCase()).toContain('corrosion');
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useDamageAssessment', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial null lastReport', () => {
    const { result } = renderHook(() => useDamageAssessment());
    expect(result.current.lastReport).toBeNull();
  });

  it('assesses a component and updates lastReport', () => {
    const { result } = renderHook(() => useDamageAssessment());
    let report: DamageReport | null = null;
    act(() => {
      report = result.current.assess('ic', []);
    });
    expect(result.current.lastReport).not.toBeNull();
    expect(result.current.lastReport!.componentType).toBe('ic');
    expect(result.current.lastReport!.id).toBe(report!.id);
  });

  it('saves assessment to history automatically', () => {
    const { result } = renderHook(() => useDamageAssessment());
    act(() => {
      result.current.assess('resistor', []);
    });
    const history = result.current.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].componentType).toBe('resistor');
  });

  it('clears history via hook', () => {
    const { result } = renderHook(() => useDamageAssessment());
    act(() => {
      result.current.assess('led', []);
    });
    expect(result.current.getHistory()).toHaveLength(1);
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.getHistory()).toHaveLength(0);
  });

  it('updates lastReport on subsequent assessments', () => {
    const { result } = renderHook(() => useDamageAssessment());
    act(() => {
      result.current.assess('ic', []);
    });
    const firstId = result.current.lastReport!.id;
    act(() => {
      result.current.assess('connector', []);
    });
    expect(result.current.lastReport!.id).not.toBe(firstId);
    expect(result.current.lastReport!.componentType).toBe('connector');
  });

  it('returns stable function references across renders', () => {
    const { result, rerender } = renderHook(() => useDamageAssessment());
    const firstAssess = result.current.assess;
    const firstGetHistory = result.current.getHistory;
    const firstClearHistory = result.current.clearHistory;
    rerender();
    expect(result.current.assess).toBe(firstAssess);
    expect(result.current.getHistory).toBe(firstGetHistory);
    expect(result.current.clearHistory).toBe(firstClearHistory);
  });
});
