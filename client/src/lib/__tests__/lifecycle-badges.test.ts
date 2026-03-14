import { describe, it, expect } from 'vitest';
import {
  classifyLifecycle,
  getLifecycleColor,
  getLifecycleLabel,
  getLifecycleAdvice,
  getLifecycleDatabase,
} from '../lifecycle-badges';
import type { LifecycleStatus } from '../lifecycle-badges';

describe('lifecycle-badges', () => {
  // ── classifyLifecycle ──

  describe('classifyLifecycle', () => {
    it('returns "unknown" for empty string', () => {
      expect(classifyLifecycle('')).toBe('unknown');
    });

    it('returns "unknown" for whitespace-only string', () => {
      expect(classifyLifecycle('   ')).toBe('unknown');
    });

    it('returns "unknown" for unrecognized part number', () => {
      expect(classifyLifecycle('XYZ-NONEXISTENT-12345')).toBe('unknown');
    });

    it('classifies LM7805CT as nrnd', () => {
      expect(classifyLifecycle('LM7805CT')).toBe('nrnd');
    });

    it('is case-insensitive', () => {
      expect(classifyLifecycle('lm7805ct')).toBe('nrnd');
      expect(classifyLifecycle('LM7805CT')).toBe('nrnd');
      expect(classifyLifecycle('Lm7805Ct')).toBe('nrnd');
    });

    it('trims whitespace', () => {
      expect(classifyLifecycle('  LM7805CT  ')).toBe('nrnd');
    });

    it('strips /NOPB suffix', () => {
      expect(classifyLifecycle('LM741CN/NOPB')).toBe('nrnd');
    });

    it('classifies NE555P as nrnd', () => {
      expect(classifyLifecycle('NE555P')).toBe('nrnd');
    });

    it('classifies LM317K as obsolete', () => {
      expect(classifyLifecycle('LM317K')).toBe('obsolete');
    });

    it('classifies ATMEGA328P-PU as active', () => {
      expect(classifyLifecycle('ATMEGA328P-PU')).toBe('active');
    });

    it('classifies ESP32-WROOM-32 as active', () => {
      expect(classifyLifecycle('ESP32-WROOM-32')).toBe('active');
    });

    it('classifies RP2350 as preliminary', () => {
      expect(classifyLifecycle('RP2350')).toBe('preliminary');
    });

    it('classifies L293D as nrnd', () => {
      expect(classifyLifecycle('L293D')).toBe('nrnd');
    });

    it('classifies SN754410NE as obsolete', () => {
      expect(classifyLifecycle('SN754410NE')).toBe('obsolete');
    });

    it('classifies PIC16F84A as nrnd', () => {
      expect(classifyLifecycle('PIC16F84A')).toBe('nrnd');
    });

    it('classifies ATMEGA16-16PU as obsolete', () => {
      expect(classifyLifecycle('ATMEGA16-16PU')).toBe('obsolete');
    });

    // Manufacturer-specific matching
    it('matches UA7805 with Fairchild as obsolete', () => {
      expect(classifyLifecycle('UA7805', 'Fairchild Semiconductor')).toBe('obsolete');
    });

    it('returns UA7805 as obsolete even without manufacturer (fallback)', () => {
      expect(classifyLifecycle('UA7805')).toBe('obsolete');
    });

    it('classifies LM75A as active', () => {
      expect(classifyLifecycle('LM75A')).toBe('active');
    });

    it('classifies DS18B20 as active', () => {
      expect(classifyLifecycle('DS18B20')).toBe('active');
    });

    it('classifies MAX232CPE as nrnd', () => {
      expect(classifyLifecycle('MAX232CPE')).toBe('nrnd');
    });
  });

  // ── getLifecycleColor ──

  describe('getLifecycleColor', () => {
    const statuses: LifecycleStatus[] = ['active', 'nrnd', 'eol', 'obsolete', 'preliminary', 'unknown'];

    it('returns bg, text, and border for every status', () => {
      for (const status of statuses) {
        const colors = getLifecycleColor(status);
        expect(colors).toHaveProperty('bg');
        expect(colors).toHaveProperty('text');
        expect(colors).toHaveProperty('border');
        expect(typeof colors.bg).toBe('string');
        expect(typeof colors.text).toBe('string');
        expect(typeof colors.border).toBe('string');
      }
    });

    it('uses emerald for active', () => {
      const c = getLifecycleColor('active');
      expect(c.text).toContain('emerald');
    });

    it('uses amber for nrnd', () => {
      const c = getLifecycleColor('nrnd');
      expect(c.text).toContain('amber');
    });

    it('uses orange for eol', () => {
      const c = getLifecycleColor('eol');
      expect(c.text).toContain('orange');
    });

    it('uses red for obsolete', () => {
      const c = getLifecycleColor('obsolete');
      expect(c.text).toContain('red');
    });

    it('uses blue for preliminary', () => {
      const c = getLifecycleColor('preliminary');
      expect(c.text).toContain('blue');
    });
  });

  // ── getLifecycleLabel ──

  describe('getLifecycleLabel', () => {
    it('returns "Active" for active', () => {
      expect(getLifecycleLabel('active')).toBe('Active');
    });

    it('returns "NRND" for nrnd', () => {
      expect(getLifecycleLabel('nrnd')).toBe('NRND');
    });

    it('returns "EOL" for eol', () => {
      expect(getLifecycleLabel('eol')).toBe('EOL');
    });

    it('returns "Obsolete" for obsolete', () => {
      expect(getLifecycleLabel('obsolete')).toBe('Obsolete');
    });

    it('returns "Preliminary" for preliminary', () => {
      expect(getLifecycleLabel('preliminary')).toBe('Preliminary');
    });

    it('returns "Unknown" for unknown', () => {
      expect(getLifecycleLabel('unknown')).toBe('Unknown');
    });
  });

  // ── getLifecycleAdvice ──

  describe('getLifecycleAdvice', () => {
    const statuses: LifecycleStatus[] = ['active', 'nrnd', 'eol', 'obsolete', 'preliminary', 'unknown'];

    it('returns a non-empty string for every status', () => {
      for (const status of statuses) {
        const advice = getLifecycleAdvice(status);
        expect(typeof advice).toBe('string');
        expect(advice.length).toBeGreaterThan(0);
      }
    });

    it('nrnd advice mentions "Not Recommended"', () => {
      expect(getLifecycleAdvice('nrnd')).toContain('Not Recommended');
    });

    it('eol advice mentions "End of Life"', () => {
      expect(getLifecycleAdvice('eol')).toContain('End of Life');
    });

    it('obsolete advice mentions "no longer manufactured"', () => {
      expect(getLifecycleAdvice('obsolete')).toContain('no longer manufactured');
    });

    it('preliminary advice mentions "pre-production"', () => {
      expect(getLifecycleAdvice('preliminary')).toContain('pre-production');
    });
  });

  // ── getLifecycleDatabase ──

  describe('getLifecycleDatabase', () => {
    it('returns a non-empty array', () => {
      const db = getLifecycleDatabase();
      expect(db.length).toBeGreaterThan(0);
    });

    it('contains at least 45 entries', () => {
      expect(getLifecycleDatabase().length).toBeGreaterThanOrEqual(45);
    });

    it('all entries have partNumber and status', () => {
      for (const entry of getLifecycleDatabase()) {
        expect(entry.partNumber).toBeTruthy();
        expect(['active', 'nrnd', 'eol', 'obsolete', 'preliminary', 'unknown']).toContain(entry.status);
      }
    });

    it('manufacturer field is optional', () => {
      const db = getLifecycleDatabase();
      const withMfg = db.filter((e) => e.manufacturer);
      const withoutMfg = db.filter((e) => !e.manufacturer);
      expect(withMfg.length).toBeGreaterThan(0);
      expect(withoutMfg.length).toBeGreaterThan(0);
    });
  });
});
