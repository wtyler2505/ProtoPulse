import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SIOverlayManager,
  getSIOverlayManager,
  resetSIOverlayManager,
  getSeverityColor,
} from '../si-overlay';
import type { SIAdvisory, SIAdvisoryType, SISeverity, SIAnnotation } from '../si-overlay';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeAdvisory(overrides: Partial<SIAdvisory> = {}): SIAdvisory {
  return {
    id: 'adv-1',
    type: 'impedance-mismatch',
    message: 'Impedance mismatch on TRACE1',
    severity: 'warning',
    x: 100,
    y: 200,
    actualZ0: 55,
    targetZ0: 50,
    deviationPct: 10,
    ...overrides,
  };
}

function makeStubAdvisory(overrides: Partial<SIAdvisory> = {}): SIAdvisory {
  return {
    id: 'stub-1',
    type: 'stub-length',
    message: 'Stub length 8mm exceeds max 5mm',
    severity: 'error',
    x: 50,
    y: 75,
    stubLength: 8,
    maxStubLength: 5,
    ...overrides,
  };
}

function makeCrosstalkAdvisory(overrides: Partial<SIAdvisory> = {}): SIAdvisory {
  return {
    id: 'xt-1',
    type: 'crosstalk',
    message: 'NEXT -15dB between NET_A and NET_B',
    severity: 'warning',
    x: 30,
    y: 40,
    nextDb: -15,
    fextDb: -25,
    x2: 80,
    y2: 90,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Manager instantiation
// ---------------------------------------------------------------------------

describe('SIOverlayManager', () => {
  let mgr: SIOverlayManager;

  beforeEach(() => {
    mgr = SIOverlayManager.create();
  });

  // -----------------------------------------------------------------------
  // Enable / disable
  // -----------------------------------------------------------------------

  describe('enable / disable', () => {
    it('starts disabled', () => {
      expect(mgr.isEnabled()).toBe(false);
    });

    it('setEnabled(true) enables the overlay', () => {
      mgr.setEnabled(true);
      expect(mgr.isEnabled()).toBe(true);
    });

    it('setEnabled(false) disables the overlay', () => {
      mgr.setEnabled(true);
      mgr.setEnabled(false);
      expect(mgr.isEnabled()).toBe(false);
    });

    it('toggle() flips the enabled state', () => {
      expect(mgr.toggle()).toBe(true);
      expect(mgr.isEnabled()).toBe(true);
      expect(mgr.toggle()).toBe(false);
      expect(mgr.isEnabled()).toBe(false);
    });

    it('setEnabled with same value does not notify', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setEnabled(false); // already false
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on setEnabled', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setEnabled(true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on updateAdvisories', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.updateAdvisories([makeAdvisory()]);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on clearAdvisories', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clearAdvisories();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.setEnabled(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple listeners all receive notification', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      mgr.subscribe(l1);
      mgr.subscribe(l2);
      mgr.setEnabled(true);
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // getSnapshot
  // -----------------------------------------------------------------------

  describe('getSnapshot', () => {
    it('returns disabled state with empty annotations by default', () => {
      const snap = mgr.getSnapshot();
      expect(snap.enabled).toBe(false);
      expect(snap.annotations).toEqual([]);
    });

    it('returns annotations when enabled with advisories', () => {
      mgr.updateAdvisories([makeAdvisory()]);
      mgr.setEnabled(true);
      const snap = mgr.getSnapshot();
      expect(snap.enabled).toBe(true);
      expect(snap.annotations.length).toBe(1);
    });

    it('returns empty annotations when disabled even with advisories', () => {
      mgr.updateAdvisories([makeAdvisory()]);
      const snap = mgr.getSnapshot();
      expect(snap.enabled).toBe(false);
      expect(snap.annotations).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Advisory → Annotation mapping: impedance-mismatch
  // -----------------------------------------------------------------------

  describe('impedance-mismatch advisory mapping', () => {
    it('maps to annotation with correct type and severity', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory()]);
      const annotations = mgr.getAnnotations();
      expect(annotations.length).toBe(1);
      expect(annotations[0].type).toBe('impedance-mismatch');
      expect(annotations[0].severity).toBe('warning');
    });

    it('produces a deviation-percent label', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory({ deviationPct: 10 })]);
      const ann = mgr.getAnnotations()[0];
      expect(ann.label).toBe('+10.0%');
    });

    it('shows negative deviation correctly', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory({ deviationPct: -5.3 })]);
      const ann = mgr.getAnnotations()[0];
      expect(ann.label).toBe('-5.3%');
    });

    it('preserves position from advisory', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory({ x: 42, y: 99 })]);
      const ann = mgr.getAnnotations()[0];
      expect(ann.x).toBe(42);
      expect(ann.y).toBe(99);
    });

    it('uses warning color for warning severity', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory({ severity: 'warning' })]);
      expect(mgr.getAnnotations()[0].color).toBe('#FACC15');
    });
  });

  // -----------------------------------------------------------------------
  // Advisory → Annotation mapping: stub-length
  // -----------------------------------------------------------------------

  describe('stub-length advisory mapping', () => {
    it('maps to annotation with radius', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeStubAdvisory()]);
      const ann = mgr.getAnnotations()[0];
      expect(ann.type).toBe('stub-length');
      expect(ann.radius).toBeGreaterThan(0);
    });

    it('radius scales with stub length', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeStubAdvisory({ stubLength: 2 })]);
      const small = mgr.getAnnotations()[0].radius!;
      mgr.updateAdvisories([makeStubAdvisory({ stubLength: 10 })]);
      const large = mgr.getAnnotations()[0].radius!;
      expect(large).toBeGreaterThan(small);
    });

    it('radius has a minimum bound', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeStubAdvisory({ stubLength: 0 })]);
      const ann = mgr.getAnnotations()[0];
      expect(ann.radius).toBeGreaterThanOrEqual(3);
    });

    it('uses error color for error severity', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeStubAdvisory({ severity: 'error' })]);
      expect(mgr.getAnnotations()[0].color).toBe('#EF4444');
    });

    it('tooltip contains the advisory message', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeStubAdvisory()]);
      expect(mgr.getAnnotations()[0].tooltip).toBe('Stub length 8mm exceeds max 5mm');
    });
  });

  // -----------------------------------------------------------------------
  // Advisory → Annotation mapping: crosstalk
  // -----------------------------------------------------------------------

  describe('crosstalk advisory mapping', () => {
    it('maps to annotation with second-point coordinates', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeCrosstalkAdvisory()]);
      const ann = mgr.getAnnotations()[0];
      expect(ann.type).toBe('crosstalk');
      expect(ann.x2).toBe(80);
      expect(ann.y2).toBe(90);
    });

    it('handles missing x2/y2 gracefully', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeCrosstalkAdvisory({ x2: undefined, y2: undefined })]);
      const ann = mgr.getAnnotations()[0];
      expect(ann.x2).toBeUndefined();
      expect(ann.y2).toBeUndefined();
    });

    it('uses info color for info severity', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeCrosstalkAdvisory({ severity: 'info' })]);
      expect(mgr.getAnnotations()[0].color).toBe('#00F0FF');
    });
  });

  // -----------------------------------------------------------------------
  // Severity classification & color
  // -----------------------------------------------------------------------

  describe('severity color coding', () => {
    const cases: Array<[SISeverity, string]> = [
      ['info', '#00F0FF'],
      ['warning', '#FACC15'],
      ['error', '#EF4444'],
    ];

    it.each(cases)('severity "%s" maps to color %s', (severity, expectedColor) => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory({ id: `sev-${severity}`, severity })]);
      expect(mgr.getAnnotations()[0].color).toBe(expectedColor);
    });

    it.each(cases)('getSeverityColor returns %s for "%s"', (severity, expectedColor) => {
      expect(getSeverityColor(severity)).toBe(expectedColor);
    });
  });

  // -----------------------------------------------------------------------
  // Empty advisories
  // -----------------------------------------------------------------------

  describe('empty advisories', () => {
    it('produces no annotations when advisories are empty', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([]);
      expect(mgr.getAnnotations()).toEqual([]);
    });

    it('clearAdvisories empties annotations', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory()]);
      expect(mgr.getAnnotations().length).toBe(1);
      mgr.clearAdvisories();
      expect(mgr.getAnnotations()).toEqual([]);
    });

    it('getAdvisoryCount reflects current count', () => {
      expect(mgr.getAdvisoryCount()).toBe(0);
      mgr.updateAdvisories([makeAdvisory(), makeStubAdvisory()]);
      expect(mgr.getAdvisoryCount()).toBe(2);
      mgr.clearAdvisories();
      expect(mgr.getAdvisoryCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // State immutability
  // -----------------------------------------------------------------------

  describe('state immutability', () => {
    it('getAnnotations returns a frozen array', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory()]);
      const annotations = mgr.getAnnotations();
      expect(Object.isFrozen(annotations)).toBe(true);
    });

    it('updating advisories does not mutate previously returned annotations', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory({ id: 'a1' })]);
      const first = mgr.getAnnotations();
      mgr.updateAdvisories([makeAdvisory({ id: 'a2' })]);
      const second = mgr.getAnnotations();
      expect(first).not.toBe(second);
      expect(first[0].id).toBe('a1');
      expect(second[0].id).toBe('a2');
    });

    it('getSnapshot returns consistent state', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory()]);
      const snap = mgr.getSnapshot();
      expect(snap.enabled).toBe(true);
      expect(snap.annotations).toBe(mgr.getAnnotations());
    });
  });

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------

  describe('filtering', () => {
    beforeEach(() => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([
        makeAdvisory({ id: 'imp-1', severity: 'warning' }),
        makeStubAdvisory({ id: 'stub-1', severity: 'error' }),
        makeCrosstalkAdvisory({ id: 'xt-1', severity: 'info' }),
      ]);
    });

    it('getAnnotationsBySeverity filters correctly', () => {
      expect(mgr.getAnnotationsBySeverity('warning').length).toBe(1);
      expect(mgr.getAnnotationsBySeverity('error').length).toBe(1);
      expect(mgr.getAnnotationsBySeverity('info').length).toBe(1);
    });

    it('getAnnotationsByType filters correctly', () => {
      expect(mgr.getAnnotationsByType('impedance-mismatch').length).toBe(1);
      expect(mgr.getAnnotationsByType('stub-length').length).toBe(1);
      expect(mgr.getAnnotationsByType('crosstalk').length).toBe(1);
    });

    it('returns empty for non-matching filter', () => {
      mgr.updateAdvisories([makeAdvisory({ severity: 'warning' })]);
      expect(mgr.getAnnotationsBySeverity('info')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple advisories
  // -----------------------------------------------------------------------

  describe('multiple advisories', () => {
    it('maps all advisories to annotations', () => {
      mgr.setEnabled(true);
      const advisories = [
        makeAdvisory({ id: 'a1' }),
        makeStubAdvisory({ id: 'a2' }),
        makeCrosstalkAdvisory({ id: 'a3' }),
      ];
      mgr.updateAdvisories(advisories);
      expect(mgr.getAnnotations().length).toBe(3);
    });

    it('preserves advisory order in annotations', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([
        makeAdvisory({ id: 'first' }),
        makeStubAdvisory({ id: 'second' }),
        makeCrosstalkAdvisory({ id: 'third' }),
      ]);
      const ids = Array.from(mgr.getAnnotations()).map((a) => a.id);
      expect(ids).toEqual(['first', 'second', 'third']);
    });

    it('replaces previous advisories entirely', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory({ id: 'old' })]);
      mgr.updateAdvisories([makeStubAdvisory({ id: 'new' })]);
      const annotations = mgr.getAnnotations();
      expect(annotations.length).toBe(1);
      expect(annotations[0].id).toBe('new');
    });
  });

  // -----------------------------------------------------------------------
  // Enable/disable interaction with advisories
  // -----------------------------------------------------------------------

  describe('enable/disable interaction with advisories', () => {
    it('disabling clears visible annotations but keeps advisory count', () => {
      mgr.setEnabled(true);
      mgr.updateAdvisories([makeAdvisory()]);
      expect(mgr.getAnnotations().length).toBe(1);
      mgr.setEnabled(false);
      expect(mgr.getAnnotations()).toEqual([]);
      expect(mgr.getAdvisoryCount()).toBe(1);
    });

    it('re-enabling restores annotations from existing advisories', () => {
      mgr.updateAdvisories([makeAdvisory()]);
      mgr.setEnabled(true);
      expect(mgr.getAnnotations().length).toBe(1);
      mgr.setEnabled(false);
      expect(mgr.getAnnotations()).toEqual([]);
      mgr.setEnabled(true);
      expect(mgr.getAnnotations().length).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('getSIOverlayManager / resetSIOverlayManager', () => {
  beforeEach(() => {
    resetSIOverlayManager();
  });

  it('returns the same instance on repeated calls', () => {
    const a = getSIOverlayManager();
    const b = getSIOverlayManager();
    expect(a).toBe(b);
  });

  it('resetSIOverlayManager creates a fresh instance', () => {
    const a = getSIOverlayManager();
    a.setEnabled(true);
    resetSIOverlayManager();
    const b = getSIOverlayManager();
    expect(b).not.toBe(a);
    expect(b.isEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSeverityColor standalone
// ---------------------------------------------------------------------------

describe('getSeverityColor', () => {
  it('returns cyan for info', () => {
    expect(getSeverityColor('info')).toBe('#00F0FF');
  });

  it('returns yellow for warning', () => {
    expect(getSeverityColor('warning')).toBe('#FACC15');
  });

  it('returns red for error', () => {
    expect(getSeverityColor('error')).toBe('#EF4444');
  });
});
