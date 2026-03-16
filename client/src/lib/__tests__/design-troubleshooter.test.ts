import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  DesignTroubleshooter,
  useDesignTroubleshooter,
} from '../design-troubleshooter';
import type {
  DesignMistake,
  MistakeCategory,
  MistakeSeverity,
  SearchResult,
} from '../design-troubleshooter';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  DesignTroubleshooter.resetInstance();
});

afterEach(() => {
  DesignTroubleshooter.resetInstance();
});

// ---------------------------------------------------------------------------
// DesignTroubleshooter — singleton
// ---------------------------------------------------------------------------

describe('DesignTroubleshooter singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = DesignTroubleshooter.getInstance();
    const b = DesignTroubleshooter.getInstance();
    expect(a).toBe(b);
  });

  it('returns a new instance after resetInstance', () => {
    const a = DesignTroubleshooter.getInstance();
    DesignTroubleshooter.resetInstance();
    const b = DesignTroubleshooter.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// getAllMistakes
// ---------------------------------------------------------------------------

describe('getAllMistakes', () => {
  it('returns at least 15 built-in mistakes', () => {
    const ts = DesignTroubleshooter.getInstance();
    const all = ts.getAllMistakes();
    expect(all.length).toBeGreaterThanOrEqual(15);
  });

  it('returns defensive copy (not the internal array)', () => {
    const ts = DesignTroubleshooter.getInstance();
    const a = ts.getAllMistakes();
    const b = ts.getAllMistakes();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('every mistake has required fields', () => {
    const ts = DesignTroubleshooter.getInstance();
    for (const m of ts.getAllMistakes()) {
      expect(m.id).toBeTruthy();
      expect(m.title).toBeTruthy();
      expect(m.category).toBeTruthy();
      expect(m.severity).toBeTruthy();
      expect(m.difficulty).toBeTruthy();
      expect(m.symptoms.length).toBeGreaterThan(0);
      expect(m.cause).toBeTruthy();
      expect(m.explanation).toBeTruthy();
      expect(m.fixSteps.length).toBeGreaterThan(0);
      expect(m.preventionTips.length).toBeGreaterThan(0);
      expect(m.tags.length).toBeGreaterThan(0);
    }
  });

  it('all IDs are unique', () => {
    const ts = DesignTroubleshooter.getInstance();
    const ids = ts.getAllMistakes().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// getMistake
// ---------------------------------------------------------------------------

describe('getMistake', () => {
  it('returns the correct mistake by ID', () => {
    const ts = DesignTroubleshooter.getInstance();
    const m = ts.getMistake('floating-inputs');
    expect(m).toBeDefined();
    expect(m!.title).toBe('Floating Inputs');
  });

  it('returns undefined for unknown ID', () => {
    const ts = DesignTroubleshooter.getInstance();
    expect(ts.getMistake('nonexistent-id')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getByCategory
// ---------------------------------------------------------------------------

describe('getByCategory', () => {
  it('returns all power category mistakes', () => {
    const ts = DesignTroubleshooter.getInstance();
    const power = ts.getByCategory('power');
    expect(power.length).toBeGreaterThanOrEqual(3);
    for (const m of power) {
      expect(m.category).toBe('power');
    }
  });

  it('returns empty array for category with no mistakes', () => {
    const ts = DesignTroubleshooter.getInstance();
    // Cast to satisfy type — we intentionally test an unknown category
    const result = ts.getByCategory('nonexistent' as MistakeCategory);
    expect(result).toEqual([]);
  });

  it('communication category includes I2C and SPI mistakes', () => {
    const ts = DesignTroubleshooter.getInstance();
    const comm = ts.getByCategory('communication');
    const ids = comm.map((m) => m.id);
    expect(ids).toContain('i2c-missing-pullups');
    expect(ids).toContain('spi-bus-contention');
    expect(ids).toContain('uart-tx-rx-swap');
  });
});

// ---------------------------------------------------------------------------
// getBySeverity
// ---------------------------------------------------------------------------

describe('getBySeverity', () => {
  it('returns critical severity mistakes', () => {
    const ts = DesignTroubleshooter.getInstance();
    const critical = ts.getBySeverity('critical');
    expect(critical.length).toBeGreaterThanOrEqual(3);
    for (const m of critical) {
      expect(m.severity).toBe('critical');
    }
  });

  it('covers all three severity levels', () => {
    const ts = DesignTroubleshooter.getInstance();
    const severities: MistakeSeverity[] = ['critical', 'major', 'minor'];
    for (const sev of severities) {
      expect(ts.getBySeverity(sev).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getCategories
// ---------------------------------------------------------------------------

describe('getCategories', () => {
  it('returns at least 5 categories', () => {
    const ts = DesignTroubleshooter.getInstance();
    expect(ts.getCategories().length).toBeGreaterThanOrEqual(5);
  });

  it('includes power and communication', () => {
    const ts = DesignTroubleshooter.getInstance();
    const cats = ts.getCategories();
    expect(cats).toContain('power');
    expect(cats).toContain('communication');
  });
});

// ---------------------------------------------------------------------------
// searchBySymptom
// ---------------------------------------------------------------------------

describe('searchBySymptom', () => {
  it('returns empty for empty query', () => {
    const ts = DesignTroubleshooter.getInstance();
    expect(ts.searchBySymptom('')).toEqual([]);
    expect(ts.searchBySymptom('   ')).toEqual([]);
  });

  it('finds floating inputs when searching "erratic random"', () => {
    const ts = DesignTroubleshooter.getInstance();
    const results = ts.searchBySymptom('erratic random');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].mistake.id).toBe('floating-inputs');
  });

  it('finds LED mistake when searching "LED burns out bright"', () => {
    const ts = DesignTroubleshooter.getInstance();
    const results = ts.searchBySymptom('LED burns out bright');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.mistake.id);
    expect(ids).toContain('led-without-resistor');
  });

  it('finds power issues when searching "resets randomly"', () => {
    const ts = DesignTroubleshooter.getInstance();
    const results = ts.searchBySymptom('resets randomly');
    expect(results.length).toBeGreaterThan(0);
    // Should surface decoupling or flyback issues
    const ids = results.map((r) => r.mistake.id);
    expect(ids.some((id) => id === 'missing-decoupling-caps' || id === 'missing-flyback-diode')).toBe(true);
  });

  it('returns results sorted by score descending', () => {
    const ts = DesignTroubleshooter.getInstance();
    const results = ts.searchBySymptom('i2c not detected pull');
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('includes matched symptoms in results', () => {
    const ts = DesignTroubleshooter.getInstance();
    const results = ts.searchBySymptom('circuit behaves erratically');
    const floatingResult = results.find((r) => r.mistake.id === 'floating-inputs');
    expect(floatingResult).toBeDefined();
    expect(floatingResult!.matchedSymptoms.length).toBeGreaterThan(0);
  });

  it('finds SPI contention when searching "MISO garbage"', () => {
    const ts = DesignTroubleshooter.getInstance();
    const results = ts.searchBySymptom('MISO garbage');
    const ids = results.map((r) => r.mistake.id);
    expect(ids).toContain('spi-bus-contention');
  });

  it('finds UART swap when searching "serial no communication"', () => {
    const ts = DesignTroubleshooter.getInstance();
    const results = ts.searchBySymptom('serial no communication');
    const ids = results.map((r) => r.mistake.id);
    expect(ids).toContain('uart-tx-rx-swap');
  });

  it('case insensitive search', () => {
    const ts = DesignTroubleshooter.getInstance();
    const lower = ts.searchBySymptom('led burns out');
    const upper = ts.searchBySymptom('LED BURNS OUT');
    expect(lower.length).toBe(upper.length);
    expect(lower[0].mistake.id).toBe(upper[0].mistake.id);
  });

  it('handles special characters in query', () => {
    const ts = DesignTroubleshooter.getInstance();
    const results = ts.searchBySymptom('I2C (bus) -- not working!');
    expect(results.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getRelated
// ---------------------------------------------------------------------------

describe('getRelated', () => {
  it('returns related mistakes for floating-inputs', () => {
    const ts = DesignTroubleshooter.getInstance();
    const related = ts.getRelated('floating-inputs');
    expect(related.length).toBeGreaterThan(0);
    const ids = related.map((m) => m.id);
    expect(ids).toContain('missing-ground');
    expect(ids).toContain('i2c-missing-pullups');
  });

  it('returns empty for unknown ID', () => {
    const ts = DesignTroubleshooter.getInstance();
    expect(ts.getRelated('nonexistent')).toEqual([]);
  });

  it('all related IDs resolve to actual mistakes', () => {
    const ts = DesignTroubleshooter.getInstance();
    for (const mistake of ts.getAllMistakes()) {
      const related = ts.getRelated(mistake.id);
      expect(related.length).toBe(mistake.relatedMistakes.length);
    }
  });
});

// ---------------------------------------------------------------------------
// Specific mistake content validation
// ---------------------------------------------------------------------------

describe('built-in mistake content', () => {
  it('floating-inputs has correct category and severity', () => {
    const ts = DesignTroubleshooter.getInstance();
    const m = ts.getMistake('floating-inputs')!;
    expect(m.category).toBe('digital');
    expect(m.severity).toBe('major');
    expect(m.difficulty).toBe('beginner');
  });

  it('shorted-power-rails is critical severity', () => {
    const ts = DesignTroubleshooter.getInstance();
    const m = ts.getMistake('shorted-power-rails')!;
    expect(m.severity).toBe('critical');
  });

  it('every fixStep has sequential step numbers', () => {
    const ts = DesignTroubleshooter.getInstance();
    for (const m of ts.getAllMistakes()) {
      for (let i = 0; i < m.fixSteps.length; i++) {
        expect(m.fixSteps[i].step).toBe(i + 1);
      }
    }
  });

  it('every fixStep has instruction and detail', () => {
    const ts = DesignTroubleshooter.getInstance();
    for (const m of ts.getAllMistakes()) {
      for (const step of m.fixSteps) {
        expect(step.instruction).toBeTruthy();
        expect(step.detail).toBeTruthy();
      }
    }
  });

  it('wrong-crystal-loading-caps is analog category', () => {
    const ts = DesignTroubleshooter.getInstance();
    const m = ts.getMistake('wrong-crystal-loading-caps')!;
    expect(m.category).toBe('analog');
  });

  it('missing-flyback-diode is protection category', () => {
    const ts = DesignTroubleshooter.getInstance();
    const m = ts.getMistake('missing-flyback-diode')!;
    expect(m.category).toBe('protection');
    expect(m.severity).toBe('critical');
  });

  it('all difficulty levels are represented', () => {
    const ts = DesignTroubleshooter.getInstance();
    const difficulties = new Set(ts.getAllMistakes().map((m) => m.difficulty));
    expect(difficulties.has('beginner')).toBe(true);
    expect(difficulties.has('intermediate')).toBe(true);
    expect(difficulties.has('advanced')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useDesignTroubleshooter hook
// ---------------------------------------------------------------------------

describe('useDesignTroubleshooter', () => {
  it('provides searchBySymptom', () => {
    const { result } = renderHook(() => useDesignTroubleshooter());
    const results = result.current.searchBySymptom('floating');
    expect(results.length).toBeGreaterThan(0);
  });

  it('provides getMistake', () => {
    const { result } = renderHook(() => useDesignTroubleshooter());
    const m = result.current.getMistake('led-without-resistor');
    expect(m).toBeDefined();
    expect(m!.title).toBe('LED Without Current-Limiting Resistor');
  });

  it('provides getAllMistakes', () => {
    const { result } = renderHook(() => useDesignTroubleshooter());
    expect(result.current.getAllMistakes().length).toBeGreaterThanOrEqual(15);
  });

  it('provides getByCategory', () => {
    const { result } = renderHook(() => useDesignTroubleshooter());
    const power = result.current.getByCategory('power');
    expect(power.length).toBeGreaterThanOrEqual(3);
  });

  it('provides getBySeverity', () => {
    const { result } = renderHook(() => useDesignTroubleshooter());
    const critical = result.current.getBySeverity('critical');
    expect(critical.length).toBeGreaterThan(0);
  });

  it('provides getCategories', () => {
    const { result } = renderHook(() => useDesignTroubleshooter());
    expect(result.current.getCategories().length).toBeGreaterThanOrEqual(5);
  });

  it('provides getRelated', () => {
    const { result } = renderHook(() => useDesignTroubleshooter());
    const related = result.current.getRelated('missing-decoupling-caps');
    expect(related.length).toBeGreaterThan(0);
  });
});
