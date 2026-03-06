import { describe, it, expect, beforeEach } from 'vitest';

import {
  DiffPairManager,
  PROTOCOL_PRESETS,
} from '../pcb/diff-pair-manager';
import type {
  DiffPairProtocol,
  DiffPairDefinition,
  AddPairInput,
  DiffPairMeasurement,
  DiffPairDrcViolation,
} from '../pcb/diff-pair-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshManager(): DiffPairManager {
  return DiffPairManager.create();
}

function makeAddInput(overrides?: Partial<AddPairInput>): AddPairInput {
  return {
    id: 'dp-usb',
    netIdP: 'net-dp',
    netIdN: 'net-dn',
    protocol: 'USB 2.0',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Protocol Presets
// ---------------------------------------------------------------------------

describe('PROTOCOL_PRESETS', () => {
  it('USB 2.0 has 90ohm impedance', () => {
    expect(PROTOCOL_PRESETS['USB 2.0'].targetImpedance).toBe(90);
  });

  it('USB 3.0 has 85ohm impedance', () => {
    expect(PROTOCOL_PRESETS['USB 3.0'].targetImpedance).toBe(85);
  });

  it('HDMI has 100ohm impedance', () => {
    expect(PROTOCOL_PRESETS['HDMI'].targetImpedance).toBe(100);
  });

  it('LVDS has 100ohm impedance', () => {
    expect(PROTOCOL_PRESETS['LVDS'].targetImpedance).toBe(100);
  });

  it('PCIe has 85ohm impedance', () => {
    expect(PROTOCOL_PRESETS['PCIe'].targetImpedance).toBe(85);
  });

  it('Ethernet has 100ohm impedance', () => {
    expect(PROTOCOL_PRESETS['Ethernet'].targetImpedance).toBe(100);
  });

  it('Custom has 100ohm impedance', () => {
    expect(PROTOCOL_PRESETS['Custom'].targetImpedance).toBe(100);
  });

  it('every preset has maxSkewPs > 0', () => {
    const protocols: DiffPairProtocol[] = [
      'USB 2.0', 'USB 3.0', 'HDMI', 'LVDS', 'PCIe', 'Ethernet', 'Custom',
    ];
    for (const p of protocols) {
      expect(PROTOCOL_PRESETS[p].maxSkewPs).toBeGreaterThan(0);
    }
  });

  it('USB 2.0 has specific width and gap', () => {
    expect(PROTOCOL_PRESETS['USB 2.0'].traceWidth).toBe(0.15);
    expect(PROTOCOL_PRESETS['USB 2.0'].gap).toBe(0.15);
  });

  it('USB 3.0 has specific width, gap, and maxSkew', () => {
    expect(PROTOCOL_PRESETS['USB 3.0'].traceWidth).toBe(0.127);
    expect(PROTOCOL_PRESETS['USB 3.0'].gap).toBe(0.127);
    expect(PROTOCOL_PRESETS['USB 3.0'].maxSkewPs).toBe(15);
  });

  it('HDMI has specific gap', () => {
    expect(PROTOCOL_PRESETS['HDMI'].gap).toBe(0.18);
  });

  it('PCIe has same values as USB 3.0 width/gap', () => {
    expect(PROTOCOL_PRESETS['PCIe'].traceWidth).toBe(0.127);
    expect(PROTOCOL_PRESETS['PCIe'].gap).toBe(0.127);
  });

  it('Ethernet has wider trace width', () => {
    expect(PROTOCOL_PRESETS['Ethernet'].traceWidth).toBe(0.2);
  });
});

// ---------------------------------------------------------------------------
// Pair Management
// ---------------------------------------------------------------------------

describe('DiffPairManager — pair management', () => {
  let mgr: DiffPairManager;

  beforeEach(() => {
    mgr = freshManager();
  });

  it('addPair stores the pair and auto-populates from preset', () => {
    mgr.addPair(makeAddInput());
    const pair = mgr.getPair('dp-usb');
    expect(pair).toBeDefined();
    expect(pair!.protocol).toBe('USB 2.0');
    expect(pair!.traceWidth).toBe(PROTOCOL_PRESETS['USB 2.0'].traceWidth);
    expect(pair!.gap).toBe(PROTOCOL_PRESETS['USB 2.0'].gap);
    expect(pair!.targetImpedance).toBe(PROTOCOL_PRESETS['USB 2.0'].targetImpedance);
    expect(pair!.maxSkewPs).toBe(PROTOCOL_PRESETS['USB 2.0'].maxSkewPs);
    expect(pair!.maxUncoupledPct).toBe(PROTOCOL_PRESETS['USB 2.0'].maxUncoupledPct);
  });

  it('addPair allows custom overrides on top of preset', () => {
    mgr.addPair(makeAddInput({ traceWidth: 0.2, gap: 0.25 }));
    const pair = mgr.getPair('dp-usb');
    expect(pair!.traceWidth).toBe(0.2);
    expect(pair!.gap).toBe(0.25);
    // Non-overridden fields still come from preset
    expect(pair!.targetImpedance).toBe(PROTOCOL_PRESETS['USB 2.0'].targetImpedance);
  });

  it('addPair rejects duplicate ID', () => {
    mgr.addPair(makeAddInput());
    expect(() => mgr.addPair(makeAddInput({ netIdP: 'net-other-p', netIdN: 'net-other-n' }))).toThrow(/duplicate/i);
  });

  it('addPair rejects net already assigned to another pair', () => {
    mgr.addPair(makeAddInput());
    expect(() =>
      mgr.addPair(makeAddInput({ id: 'dp-other', netIdP: 'net-dp', netIdN: 'net-new' })),
    ).toThrow(/already assigned/i);
    expect(() =>
      mgr.addPair(makeAddInput({ id: 'dp-other2', netIdP: 'net-new', netIdN: 'net-dn' })),
    ).toThrow(/already assigned/i);
  });

  it('addPair rejects P === N', () => {
    expect(() =>
      mgr.addPair(makeAddInput({ netIdP: 'same-net', netIdN: 'same-net' })),
    ).toThrow();
  });

  it('removePair removes existing pair', () => {
    mgr.addPair(makeAddInput());
    expect(mgr.getPair('dp-usb')).toBeDefined();
    mgr.removePair('dp-usb');
    expect(mgr.getPair('dp-usb')).toBeUndefined();
  });

  it('removePair throws on non-existent ID', () => {
    expect(() => mgr.removePair('non-existent')).toThrow();
  });

  it('updatePair partially updates fields', () => {
    mgr.addPair(makeAddInput());
    mgr.updatePair('dp-usb', { traceWidth: 0.3, gap: 0.4 });
    const pair = mgr.getPair('dp-usb');
    expect(pair!.traceWidth).toBe(0.3);
    expect(pair!.gap).toBe(0.4);
    // Unchanged fields remain
    expect(pair!.protocol).toBe('USB 2.0');
    expect(pair!.targetImpedance).toBe(90);
  });

  it('getPairs returns all pairs as defensive copies', () => {
    mgr.addPair(makeAddInput());
    mgr.addPair(makeAddInput({ id: 'dp-hdmi', netIdP: 'hdmi-p', netIdN: 'hdmi-n', protocol: 'HDMI' }));
    const pairs = mgr.getPairs();
    expect(pairs).toHaveLength(2);
    // Defensive copy — modifying returned array should not affect internal state
    pairs[0].traceWidth = 999;
    expect(mgr.getPair('dp-usb')!.traceWidth).not.toBe(999);
  });

  it('getPairByNetId finds pair by P net', () => {
    mgr.addPair(makeAddInput());
    const found = mgr.getPairByNetId('net-dp');
    expect(found).toBeDefined();
    expect(found!.id).toBe('dp-usb');
  });

  it('getPairByNetId finds pair by N net', () => {
    mgr.addPair(makeAddInput());
    const found = mgr.getPairByNetId('net-dn');
    expect(found).toBeDefined();
    expect(found!.id).toBe('dp-usb');
  });

  it('getPairByNetId returns undefined for unknown net', () => {
    mgr.addPair(makeAddInput());
    expect(mgr.getPairByNetId('unknown-net')).toBeUndefined();
  });

  it('removePair frees nets for reuse', () => {
    mgr.addPair(makeAddInput());
    mgr.removePair('dp-usb');
    // Should not throw — nets are freed
    expect(() => mgr.addPair(makeAddInput({ id: 'dp-usb-reuse' }))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

describe('DiffPairManager — subscribe', () => {
  let mgr: DiffPairManager;

  beforeEach(() => {
    mgr = freshManager();
  });

  it('notifies on addPair', () => {
    let callCount = 0;
    mgr.subscribe(() => {
      callCount++;
    });
    mgr.addPair(makeAddInput());
    expect(callCount).toBe(1);
  });

  it('notifies on removePair', () => {
    mgr.addPair(makeAddInput());
    let callCount = 0;
    mgr.subscribe(() => {
      callCount++;
    });
    mgr.removePair('dp-usb');
    expect(callCount).toBe(1);
  });

  it('notifies on updatePair', () => {
    mgr.addPair(makeAddInput());
    let callCount = 0;
    mgr.subscribe(() => {
      callCount++;
    });
    mgr.updatePair('dp-usb', { gap: 0.3 });
    expect(callCount).toBe(1);
  });

  it('does not call listener after unsubscribe', () => {
    let callCount = 0;
    const unsub = mgr.subscribe(() => {
      callCount++;
    });
    unsub();
    mgr.addPair(makeAddInput());
    expect(callCount).toBe(0);
  });

  it('multiple listeners all get notified', () => {
    let count1 = 0;
    let count2 = 0;
    mgr.subscribe(() => { count1++; });
    mgr.subscribe(() => { count2++; });
    mgr.addPair(makeAddInput());
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// DRC
// ---------------------------------------------------------------------------

describe('DiffPairManager — DRC', () => {
  let mgr: DiffPairManager;

  beforeEach(() => {
    mgr = freshManager();
    mgr.addPair(makeAddInput({ id: 'dp-usb', protocol: 'USB 2.0' }));
  });

  it('no violations for well-routed pair', () => {
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.15,
        widthActual: 0.15,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    expect(violations).toHaveLength(0);
  });

  it('detects skew violation', () => {
    // USB 2.0 maxSkewPs = 50ps. Skew = |lengthP - lengthN| * 6.5 ps/mm
    // lengthP=50, lengthN=42 => delta=8mm * 6.5 = 52ps > 50ps
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 42,
        gapActual: 0.15,
        widthActual: 0.15,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    const skew = violations.filter((v) => v.type === 'diff-pair-skew');
    expect(skew).toHaveLength(1);
    expect(skew[0].pairId).toBe('dp-usb');
    expect(skew[0].severity).toBe('error');
  });

  it('detects gap violation (actual < target * 0.9)', () => {
    // USB 2.0 gap = 0.15mm. 0.9 * 0.15 = 0.135. actual = 0.13 < 0.135 => violation
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.13,
        widthActual: 0.15,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    const gap = violations.filter((v) => v.type === 'diff-pair-gap');
    expect(gap).toHaveLength(1);
    expect(gap[0].pairId).toBe('dp-usb');
  });

  it('detects width violation (actual < target * 0.9)', () => {
    // USB 2.0 traceWidth = 0.15mm. 0.9 * 0.15 = 0.135. actual = 0.12 < 0.135 => violation
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.15,
        widthActual: 0.12,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    const width = violations.filter((v) => v.type === 'diff-pair-width');
    expect(width).toHaveLength(1);
    expect(width[0].pairId).toBe('dp-usb');
  });

  it('detects uncoupled length violation', () => {
    // USB 2.0 maxUncoupledPct = 10. avgLength = (50+50)/2 = 50.
    // maxUncoupled = 50 * 10/100 = 5mm. uncoupledLength = 6 > 5 => violation
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.15,
        widthActual: 0.15,
        uncoupledLength: 6,
      },
    };
    const violations = mgr.checkDrc(measurements);
    const uncoupled = violations.filter((v) => v.type === 'diff-pair-uncoupled');
    expect(uncoupled).toHaveLength(1);
    expect(uncoupled[0].pairId).toBe('dp-usb');
  });

  it('skips pairs with no measurement data', () => {
    mgr.addPair(makeAddInput({ id: 'dp-hdmi', netIdP: 'h-p', netIdN: 'h-n', protocol: 'HDMI' }));
    // Only provide measurement for dp-usb, not dp-hdmi
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.15,
        widthActual: 0.15,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    // Should have no violations — dp-hdmi is skipped, dp-usb is fine
    expect(violations).toHaveLength(0);
  });

  it('can detect multiple violations on same pair', () => {
    // Both gap and width violations at once
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.10,
        widthActual: 0.10,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    expect(violations.filter((v) => v.type === 'diff-pair-gap')).toHaveLength(1);
    expect(violations.filter((v) => v.type === 'diff-pair-width')).toHaveLength(1);
  });

  it('checks multiple pairs in one call', () => {
    mgr.addPair(makeAddInput({ id: 'dp-hdmi', netIdP: 'h-p', netIdN: 'h-n', protocol: 'HDMI' }));
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 42, // skew violation for USB 2.0
        gapActual: 0.15,
        widthActual: 0.15,
        uncoupledLength: 2,
      },
      'dp-hdmi': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.10, // gap violation for HDMI (target 0.18, 0.9*0.18=0.162)
        widthActual: 0.15,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    const usbViolations = violations.filter((v) => v.pairId === 'dp-usb');
    const hdmiViolations = violations.filter((v) => v.pairId === 'dp-hdmi');
    expect(usbViolations.length).toBeGreaterThanOrEqual(1);
    expect(hdmiViolations.length).toBeGreaterThanOrEqual(1);
  });

  it('no skew violation when delta is within limit', () => {
    // USB 2.0: maxSkew 50ps. lengthP=50, lengthN=49 => delta=1mm * 6.5 = 6.5ps < 50ps
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 49,
        gapActual: 0.15,
        widthActual: 0.15,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    expect(violations.filter((v) => v.type === 'diff-pair-skew')).toHaveLength(0);
  });

  it('gap exactly at 0.9 * target does not violate', () => {
    // USB 2.0 gap = 0.15. 0.9 * 0.15 = 0.135
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.135,
        widthActual: 0.15,
        uncoupledLength: 2,
      },
    };
    const violations = mgr.checkDrc(measurements);
    expect(violations.filter((v) => v.type === 'diff-pair-gap')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('DiffPairManager — serialization', () => {
  it('round-trips toJSON/fromJSON', () => {
    const mgr = freshManager();
    mgr.addPair(makeAddInput());
    mgr.addPair(makeAddInput({ id: 'dp-hdmi', netIdP: 'h-p', netIdN: 'h-n', protocol: 'HDMI' }));

    const json = mgr.toJSON();
    const restored = DiffPairManager.fromJSON(json);
    const pairs = restored.getPairs();
    expect(pairs).toHaveLength(2);

    const usb = restored.getPair('dp-usb');
    expect(usb).toBeDefined();
    expect(usb!.protocol).toBe('USB 2.0');
    expect(usb!.targetImpedance).toBe(90);

    const hdmi = restored.getPair('dp-hdmi');
    expect(hdmi).toBeDefined();
    expect(hdmi!.protocol).toBe('HDMI');
  });

  it('fromJSON with empty data creates empty manager', () => {
    const mgr = DiffPairManager.fromJSON({ pairs: [] });
    expect(mgr.getPairs()).toHaveLength(0);
  });

  it('fromJSON with invalid data throws', () => {
    expect(() => DiffPairManager.fromJSON(null)).toThrow();
    expect(() => DiffPairManager.fromJSON('bad')).toThrow();
    expect(() => DiffPairManager.fromJSON(42)).toThrow();
  });

  it('serialized data matches expected shape', () => {
    const mgr = freshManager();
    mgr.addPair(makeAddInput());
    const json = mgr.toJSON();
    expect(json).toHaveProperty('pairs');
    expect(Array.isArray((json as unknown as Record<string, unknown>).pairs)).toBe(true);
  });

  it('fromJSON restores pairs that pass DRC', () => {
    const mgr = freshManager();
    mgr.addPair(makeAddInput());
    const json = mgr.toJSON();
    const restored = DiffPairManager.fromJSON(json);
    const measurements: Record<string, DiffPairMeasurement> = {
      'dp-usb': {
        lengthP: 50,
        lengthN: 50,
        gapActual: 0.15,
        widthActual: 0.15,
        uncoupledLength: 2,
      },
    };
    expect(restored.checkDrc(measurements)).toHaveLength(0);
  });
});
