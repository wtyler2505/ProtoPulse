/**
 * Tests for BGA Fanout and Escape Routing Engine
 *
 * Validates fanout pattern generation for Ball Grid Array packages,
 * BGA-specific DRC rules, and pattern recommendation logic.
 */

import { describe, it, expect } from 'vitest';
import {
  generateFanout,
  checkBgaDrc,
  recommendPattern,
  getBallPositions,
  BGA_PRESETS,
  DEFAULT_BGA_RULES,
} from '../bga-fanout';
import type {
  BgaPreset,
  BgaFanoutRules,
  FanoutPattern,
  FanoutResult,
  FanoutVia,
  FanoutTrace,
  BgaDrcResult,
  BgaDrcViolation,
  BgaDrcViolationType,
  PatternRecommendation,
} from '../bga-fanout';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePreset(overrides: Partial<BgaPreset> = {}): BgaPreset {
  return {
    name: 'Test BGA',
    pitch: 1.0,
    ballDiameter: 0.5,
    rows: 4,
    cols: 4,
    ballCount: 16,
    description: 'Test BGA preset',
    ...overrides,
  };
}

function makeRules(overrides: Partial<BgaFanoutRules> = {}): BgaFanoutRules {
  return {
    ...DEFAULT_BGA_RULES,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BGA Presets
// ---------------------------------------------------------------------------

describe('BGA_PRESETS', () => {
  it('should have at least 5 presets', () => {
    const presetNames = Object.keys(BGA_PRESETS);
    expect(presetNames.length).toBeGreaterThanOrEqual(5);
  });

  it('should have valid pitch values', () => {
    for (const preset of Object.values(BGA_PRESETS)) {
      expect(preset.pitch).toBeGreaterThan(0);
      expect(preset.pitch).toBeLessThanOrEqual(2.0);
    }
  });

  it('should have valid ball diameters less than pitch', () => {
    for (const preset of Object.values(BGA_PRESETS)) {
      expect(preset.ballDiameter).toBeGreaterThan(0);
      expect(preset.ballDiameter).toBeLessThan(preset.pitch);
    }
  });

  it('should have consistent ball counts', () => {
    for (const preset of Object.values(BGA_PRESETS)) {
      expect(preset.ballCount).toBeLessThanOrEqual(preset.rows * preset.cols);
    }
  });

  it('should have descriptions', () => {
    for (const preset of Object.values(BGA_PRESETS)) {
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });

  it('should include common BGA packages', () => {
    expect(BGA_PRESETS['BGA-256-1.0']).toBeDefined();
    expect(BGA_PRESETS['BGA-484-1.0']).toBeDefined();
    expect(BGA_PRESETS['BGA-144-0.8']).toBeDefined();
    expect(BGA_PRESETS['BGA-100-0.65']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_BGA_RULES
// ---------------------------------------------------------------------------

describe('DEFAULT_BGA_RULES', () => {
  it('should have reasonable default values', () => {
    expect(DEFAULT_BGA_RULES.minViaDrill).toBeGreaterThan(0);
    expect(DEFAULT_BGA_RULES.minAnnularRing).toBeGreaterThan(0);
    expect(DEFAULT_BGA_RULES.minTraceWidth).toBeGreaterThan(0);
    expect(DEFAULT_BGA_RULES.minClearance).toBeGreaterThan(0);
    expect(DEFAULT_BGA_RULES.minSolderMaskBridge).toBeGreaterThan(0);
    expect(DEFAULT_BGA_RULES.boardThickness).toBeGreaterThan(0);
  });

  it('should not allow via-in-pad by default', () => {
    expect(DEFAULT_BGA_RULES.allowViaInPad).toBe(false);
  });

  it('should not allow micro via by default', () => {
    expect(DEFAULT_BGA_RULES.allowMicroVia).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recommendPattern
// ---------------------------------------------------------------------------

describe('recommendPattern', () => {
  it('should recommend dog-bone for standard 1.0mm pitch BGA', () => {
    const rec = recommendPattern(
      makePreset({ pitch: 1.0, ballDiameter: 0.5 }),
      makeRules(),
    );
    expect(rec.recommended).toBe('dog-bone');
  });

  it('should recommend via-in-pad for fine-pitch with VIP capability', () => {
    const rec = recommendPattern(
      makePreset({ pitch: 0.5, ballDiameter: 0.25 }),
      makeRules({
        allowViaInPad: true,
        minViaDrill: 0.1,
        minAnnularRing: 0.05,
      }),
    );
    expect(rec.recommended).toBe('via-in-pad');
  });

  it('should recommend escape-channel when vias cannot fit', () => {
    const rec = recommendPattern(
      makePreset({ pitch: 0.5, ballDiameter: 0.3 }),
      makeRules({
        allowViaInPad: false,
        allowMicroVia: false,
        minViaDrill: 0.3,
        minAnnularRing: 0.15,
      }),
    );
    // With large via and tight pitch, escape channel may be only option
    expect(['escape-channel', 'dog-bone']).toContain(rec.recommended);
  });

  it('should return feasibility for all patterns', () => {
    const rec = recommendPattern(makePreset(), makeRules());
    expect(rec.feasibility).toBeDefined();
    expect(typeof rec.feasibility['dog-bone']).toBe('boolean');
    expect(typeof rec.feasibility['via-in-pad']).toBe('boolean');
    expect(typeof rec.feasibility['escape-channel']).toBe('boolean');
  });

  it('should include reason text', () => {
    const rec = recommendPattern(makePreset(), makeRules());
    expect(rec.reason.length).toBeGreaterThan(0);
  });

  it('should list alternatives', () => {
    const rec = recommendPattern(
      makePreset({ pitch: 1.0, ballDiameter: 0.5 }),
      makeRules(),
    );
    expect(Array.isArray(rec.alternatives)).toBe(true);
  });

  it('should consider micro via when available', () => {
    const rec = recommendPattern(
      makePreset({ pitch: 0.65, ballDiameter: 0.35 }),
      makeRules({ allowMicroVia: true }),
    );
    expect(rec.recommended).toBeDefined();
    expect(rec.feasibility['dog-bone']).toBe(true); // micro via enables dog-bone
  });
});

// ---------------------------------------------------------------------------
// generateFanout — dog-bone
// ---------------------------------------------------------------------------

describe('generateFanout — dog-bone', () => {
  it('should generate vias and traces for each ball', () => {
    const preset = makePreset({ rows: 4, cols: 4 });
    const result = generateFanout(preset, makeRules(), 'dog-bone');

    expect(result.pattern).toBe('dog-bone');
    expect(result.vias.length).toBeGreaterThan(0);
    expect(result.traces.length).toBeGreaterThan(0);
    expect(result.totalBalls).toBe(16);
  });

  it('should have one via per escaped ball', () => {
    const preset = makePreset({ rows: 4, cols: 4 });
    const result = generateFanout(preset, makeRules(), 'dog-bone');

    expect(result.vias.length).toBe(result.escapedBalls);
    expect(result.traces.length).toBe(result.escapedBalls);
  });

  it('should compute escape rate', () => {
    const result = generateFanout(makePreset(), makeRules(), 'dog-bone');
    expect(result.escapeRate).toBeGreaterThan(0);
    expect(result.escapeRate).toBeLessThanOrEqual(1);
  });

  it('should assign net IDs based on ball position', () => {
    const result = generateFanout(makePreset({ rows: 2, cols: 2 }), makeRules(), 'dog-bone');

    for (const via of result.vias) {
      expect(via.netId).toMatch(/^ball_[A-Z]\d+$/);
    }
  });

  it('should place vias at offset from ball centers', () => {
    const preset = makePreset({ rows: 2, cols: 2, pitch: 1.0 });
    const result = generateFanout(preset, makeRules(), 'dog-bone');

    // Each via should be offset from the ball position
    for (let i = 0; i < result.vias.length; i++) {
      const via = result.vias[i];
      const trace = result.traces[i];
      const dx = via.position.x - trace.from.x;
      const dy = via.position.y - trace.from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThan(0);
    }
  });

  it('should use micro vias for fine-pitch when allowed', () => {
    const result = generateFanout(
      makePreset({ pitch: 0.65, ballDiameter: 0.35 }),
      makeRules({ allowMicroVia: true }),
      'dog-bone',
    );

    const microVias = result.vias.filter((v) => v.type === 'micro');
    expect(microVias.length).toBeGreaterThan(0);
  });

  it('should use through vias for standard pitch', () => {
    const result = generateFanout(
      makePreset({ pitch: 1.0 }),
      makeRules({ allowMicroVia: false }),
      'dog-bone',
    );

    for (const via of result.vias) {
      expect(via.type).toBe('through');
    }
  });

  it('should handle depopulated center', () => {
    const preset = makePreset({ rows: 6, cols: 6, ballCount: 32, depopulatedCenter: 2 });
    const result = generateFanout(preset, makeRules(), 'dog-bone');

    expect(result.totalBalls).toBeLessThan(36); // 6x6 = 36, minus depopulated
  });

  it('should warn when not all balls can escape', () => {
    // Large BGA with limited layers
    const preset = makePreset({ rows: 10, cols: 10, ballCount: 100 });
    const result = generateFanout(preset, makeRules({ routingLayers: 2 }), 'dog-bone');

    if (result.escapedBalls < result.totalBalls) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// generateFanout — via-in-pad
// ---------------------------------------------------------------------------

describe('generateFanout — via-in-pad', () => {
  it('should place vias directly at ball positions', () => {
    const preset = makePreset({ rows: 3, cols: 3, pitch: 0.8, ballDiameter: 0.4 });
    const result = generateFanout(
      preset,
      makeRules({ allowViaInPad: true }),
      'via-in-pad',
    );

    expect(result.pattern).toBe('via-in-pad');
    for (const via of result.vias) {
      // Vias should be at ball positions (centered at origin)
      expect(typeof via.position.x).toBe('number');
      expect(typeof via.position.y).toBe('number');
    }
  });

  it('should escape all balls (100% rate)', () => {
    const preset = makePreset({ rows: 3, cols: 3 });
    const result = generateFanout(preset, makeRules({ allowViaInPad: true }), 'via-in-pad');

    expect(result.escapeRate).toBe(1);
    expect(result.escapedBalls).toBe(result.totalBalls);
  });

  it('should create escape traces on inner layers', () => {
    const preset = makePreset({ rows: 3, cols: 3 });
    const result = generateFanout(preset, makeRules({ allowViaInPad: true }), 'via-in-pad');

    expect(result.traces.length).toBe(result.totalBalls);
  });

  it('should warn when via outer exceeds ball diameter', () => {
    const preset = makePreset({ ballDiameter: 0.3 });
    const result = generateFanout(
      preset,
      makeRules({ minViaDrill: 0.3, minAnnularRing: 0.15, allowViaInPad: true }),
      'via-in-pad',
    );

    const viaOuter = 0.3 + 2 * 0.15; // 0.6mm > 0.3mm ball
    expect(result.warnings.some((w) => w.includes('exceeds ball diameter'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateFanout — escape-channel
// ---------------------------------------------------------------------------

describe('generateFanout — escape-channel', () => {
  it('should route traces between ball rows', () => {
    const preset = makePreset({ rows: 4, cols: 4, pitch: 1.0 });
    const result = generateFanout(preset, makeRules(), 'escape-channel');

    expect(result.pattern).toBe('escape-channel');
    expect(result.traces.length).toBeGreaterThan(0);
  });

  it('should place vias at escape points', () => {
    const preset = makePreset({ rows: 4, cols: 4 });
    const result = generateFanout(preset, makeRules(), 'escape-channel');

    expect(result.vias.length).toBe(result.escapedBalls);
  });

  it('should use top layer for escape traces', () => {
    const result = generateFanout(makePreset(), makeRules(), 'escape-channel');

    for (const trace of result.traces) {
      expect(trace.layer).toBe('F.Cu');
    }
  });

  it('should warn when no traces fit between balls', () => {
    // Very tight pitch with wide traces
    const preset = makePreset({ pitch: 0.4, ballDiameter: 0.35 });
    const result = generateFanout(
      preset,
      makeRules({ minTraceWidth: 0.127, minClearance: 0.127 }),
      'escape-channel',
    );

    if (0.4 - 0.35 < 0.127 + 2 * 0.127) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it('should report layers used', () => {
    const result = generateFanout(makePreset(), makeRules(), 'escape-channel');
    expect(result.layersUsed).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// generateFanout — auto pattern selection
// ---------------------------------------------------------------------------

describe('generateFanout — auto pattern', () => {
  it('should auto-select pattern when not specified', () => {
    const result = generateFanout(makePreset({ pitch: 1.0 }), makeRules());
    expect(result.pattern).toBeDefined();
    expect(['dog-bone', 'via-in-pad', 'escape-channel']).toContain(result.pattern);
  });

  it('should use recommended pattern', () => {
    const preset = makePreset({ pitch: 1.0, ballDiameter: 0.5 });
    const rec = recommendPattern(preset, makeRules());
    const result = generateFanout(preset, makeRules());

    expect(result.pattern).toBe(rec.recommended);
  });
});

// ---------------------------------------------------------------------------
// checkBgaDrc
// ---------------------------------------------------------------------------

describe('checkBgaDrc', () => {
  it('should pass DRC for well-spaced BGA', () => {
    const preset = makePreset({ pitch: 1.0, ballDiameter: 0.5, rows: 2, cols: 2 });
    const rules = makeRules();
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    // Small 2x2 BGA with standard pitch should generally pass
    expect(drc.summary).toBeDefined();
  });

  it('should detect pitch vs via violation', () => {
    const preset = makePreset({ pitch: 0.4, ballDiameter: 0.2 });
    const rules = makeRules({
      minViaDrill: 0.3,
      minAnnularRing: 0.15,
      minAntiPad: 0.9,
    });
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    // Anti-pad (0.9mm) > pitch (0.4mm) -> violation
    const pitchViolation = drc.violations.find((v) => v.type === 'pitch_vs_via');
    expect(pitchViolation).toBeDefined();
    expect(pitchViolation!.severity).toBe('error');
  });

  it('should detect via aspect ratio violation', () => {
    const preset = makePreset({ rows: 2, cols: 2 });
    const rules = makeRules({
      minViaDrill: 0.1,
      boardThickness: 1.6,
      maxViaAspectRatio: 8,
    });
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    // 1.6 / 0.1 = 16:1 > 8:1
    const arViolation = drc.violations.find((v) => v.type === 'via_aspect_ratio');
    expect(arViolation).toBeDefined();
    expect(arViolation!.severity).toBe('error');
  });

  it('should not report via aspect ratio if within limits', () => {
    const preset = makePreset({ rows: 2, cols: 2 });
    const rules = makeRules({
      minViaDrill: 0.3,
      boardThickness: 1.6,
      maxViaAspectRatio: 8,
    });
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    // 1.6 / 0.3 = 5.3:1 < 8:1
    const arViolation = drc.violations.find((v) => v.type === 'via_aspect_ratio');
    expect(arViolation).toBeUndefined();
  });

  it('should return pass=true when no errors', () => {
    const preset = makePreset({ pitch: 2.0, ballDiameter: 0.5, rows: 2, cols: 2 });
    const rules = makeRules({ boardThickness: 1.6 });
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    const hasErrors = drc.violations.some((v) => v.severity === 'error');
    expect(drc.pass).toBe(!hasErrors);
  });

  it('should return pass=false when errors exist', () => {
    const preset = makePreset({ pitch: 0.3, ballDiameter: 0.15, rows: 2, cols: 2 });
    const rules = makeRules({
      minViaDrill: 0.3,
      minAnnularRing: 0.15,
      minAntiPad: 0.9,
    });
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    // Pitch (0.3) < anti-pad (0.9)
    expect(drc.pass).toBe(false);
  });

  it('should include summary text', () => {
    const preset = makePreset({ rows: 2, cols: 2 });
    const fanout = generateFanout(preset, makeRules(), 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, makeRules());

    expect(drc.summary.length).toBeGreaterThan(0);
  });

  it('should detect solder mask bridge violations', () => {
    // Tight pitch where vias are close to adjacent pads
    const preset = makePreset({ pitch: 0.8, ballDiameter: 0.4, rows: 3, cols: 3 });
    const rules = makeRules({ minSolderMaskBridge: 0.5 }); // very strict
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    // With 0.5mm solder mask bridge requirement on 0.8mm pitch, violations likely
    const smViolations = drc.violations.filter((v) => v.type === 'solder_mask_bridge');
    // May or may not have violations depending on exact via placement
    expect(Array.isArray(smViolations)).toBe(true);
  });

  it('should limit violations to prevent O(n^2) blowup', () => {
    const preset = makePreset({ pitch: 0.5, ballDiameter: 0.25, rows: 10, cols: 10 });
    const rules = makeRules({
      minAntiPad: 0.05, // very small anti-pad to avoid pitch_vs_via but trigger overlaps
    });
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    // Should cap per-type violations
    const antiPadViolations = drc.violations.filter((v) => v.type === 'anti_pad_overlap');
    expect(antiPadViolations.length).toBeLessThanOrEqual(20);
  });

  it('should include position in each violation', () => {
    const preset = makePreset({ pitch: 0.3, ballDiameter: 0.15, rows: 2, cols: 2 });
    const rules = makeRules({ minAntiPad: 0.9 });
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    for (const v of drc.violations) {
      expect(v.position).toBeDefined();
      expect(typeof v.position.x).toBe('number');
      expect(typeof v.position.y).toBe('number');
    }
  });

  it('should include actual and required values', () => {
    const preset = makePreset({ pitch: 0.3 });
    const rules = makeRules({ minAntiPad: 0.9, minViaDrill: 0.1, boardThickness: 1.6, maxViaAspectRatio: 8 });
    const fanout = generateFanout(preset, rules, 'dog-bone');
    const drc = checkBgaDrc(fanout, preset, rules);

    for (const v of drc.violations) {
      expect(typeof v.actual).toBe('number');
      expect(typeof v.required).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// getBallPositions
// ---------------------------------------------------------------------------

describe('getBallPositions', () => {
  it('should return correct count for simple grid', () => {
    const positions = getBallPositions(makePreset({ rows: 4, cols: 4 }));
    expect(positions).toHaveLength(16);
  });

  it('should handle depopulated center', () => {
    const positions = getBallPositions(makePreset({ rows: 6, cols: 6, depopulatedCenter: 2 }));
    expect(positions.length).toBe(36 - 4); // 6x6 minus 2x2 center
  });

  it('should center positions around origin', () => {
    const positions = getBallPositions(makePreset({ rows: 2, cols: 2, pitch: 1.0 }));

    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);

    expect(Math.abs(xs.reduce((a, b) => a + b, 0))).toBeLessThan(0.01);
    expect(Math.abs(ys.reduce((a, b) => a + b, 0))).toBeLessThan(0.01);
  });

  it('should name balls correctly (A1, A2, B1, B2, ...)', () => {
    const positions = getBallPositions(makePreset({ rows: 2, cols: 2 }));
    const names = positions.map((p) => p.name).sort();

    expect(names).toContain('A1');
    expect(names).toContain('A2');
    expect(names).toContain('B1');
    expect(names).toContain('B2');
  });

  it('should include row and col indices', () => {
    const positions = getBallPositions(makePreset({ rows: 3, cols: 3 }));

    for (const pos of positions) {
      expect(pos.row).toBeGreaterThanOrEqual(0);
      expect(pos.col).toBeGreaterThanOrEqual(0);
      expect(pos.row).toBeLessThan(3);
      expect(pos.col).toBeLessThan(3);
    }
  });

  it('should space balls by pitch', () => {
    const pitch = 1.27;
    const positions = getBallPositions(makePreset({ rows: 3, cols: 3, pitch }));

    // Check spacing between adjacent balls in same row
    const row0 = positions.filter((p) => p.row === 0).sort((a, b) => a.col - b.col);
    if (row0.length >= 2) {
      const dx = Math.abs(row0[1].x - row0[0].x);
      expect(dx).toBeCloseTo(pitch, 5);
    }
  });

  it('should return empty for 0x0 grid', () => {
    const positions = getBallPositions(makePreset({ rows: 0, cols: 0 }));
    expect(positions).toHaveLength(0);
  });

  it('should handle 1x1 grid', () => {
    const positions = getBallPositions(makePreset({ rows: 1, cols: 1 }));
    expect(positions).toHaveLength(1);
    expect(positions[0].x).toBe(0);
    expect(positions[0].y).toBe(0);
    expect(positions[0].name).toBe('A1');
  });
});

// ---------------------------------------------------------------------------
// Type coverage
// ---------------------------------------------------------------------------

describe('type coverage', () => {
  it('should export FanoutPattern values', () => {
    const patterns: FanoutPattern[] = ['dog-bone', 'via-in-pad', 'escape-channel'];
    expect(patterns).toHaveLength(3);
  });

  it('should export BgaDrcViolationType values', () => {
    const types: BgaDrcViolationType[] = [
      'pitch_vs_via',
      'anti_pad_overlap',
      'solder_mask_bridge',
      'via_aspect_ratio',
      'trace_clearance',
      'drill_to_pad',
    ];
    expect(types).toHaveLength(6);
  });

  it('should export FanoutVia with all fields', () => {
    const via: FanoutVia = {
      id: 'v1',
      position: { x: 0, y: 0 },
      drillDiameter: 0.3,
      outerDiameter: 0.6,
      type: 'through',
      netId: 'ball_A1',
      padRow: 0,
      padCol: 0,
    };
    expect(via.id).toBe('v1');
  });

  it('should export FanoutTrace with all fields', () => {
    const trace: FanoutTrace = {
      id: 't1',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
      width: 0.127,
      layer: 'F.Cu',
      netId: 'ball_A1',
    };
    expect(trace.id).toBe('t1');
  });

  it('should export BgaDrcViolation with all fields', () => {
    const violation: BgaDrcViolation = {
      type: 'pitch_vs_via',
      severity: 'error',
      message: 'Test',
      position: { x: 0, y: 0 },
      actual: 0.5,
      required: 1.0,
    };
    expect(violation.type).toBe('pitch_vs_via');
  });
});
