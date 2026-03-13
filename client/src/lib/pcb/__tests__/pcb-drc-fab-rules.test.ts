/**
 * Tests for PCB DRC fabrication/assembly rules:
 * - Solder mask expansion
 * - Paste aperture ratio
 * - Courtyard clearance
 *
 * Uses the types and presets exported from pcb-drc-checker.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  FAB_RULE_PRESETS,
  PCBDrcChecker,
} from '../pcb-drc-checker';
import type {
  FabRulePreset,
  PCBPadFabInfo,
  PCBComponentCourtyard,
  PCBDrcViolation,
} from '../pcb-drc-checker';

// ---------------------------------------------------------------------------
// Standalone fab-rule check helpers
// ---------------------------------------------------------------------------
// These implement the three fab/assembly DRC checks using the exported types.
// They serve as the reference logic for validating pad and courtyard data
// against manufacturer preset thresholds.

/**
 * Check solder mask expansion on each pad against a preset minimum.
 * Returns violations for pads whose expansion is below the threshold.
 */
function checkSolderMaskExpansion(
  pads: PCBPadFabInfo[],
  preset: FabRulePreset,
): PCBDrcViolation[] {
  const violations: PCBDrcViolation[] = [];
  for (const pad of pads) {
    if (pad.solderMaskExpansion < preset.minSolderMaskExpansion) {
      violations.push({
        type: 'solder_mask_expansion',
        message: `Pad "${pad.id}" solder mask expansion ${String(pad.solderMaskExpansion)}mm is below minimum ${String(preset.minSolderMaskExpansion)}mm (${preset.name})`,
        position: pad.position,
        severity: 'warning',
        obstacleIds: [pad.id],
        clearanceRequired: preset.minSolderMaskExpansion,
        clearanceActual: pad.solderMaskExpansion,
      });
    }
  }
  return violations;
}

/**
 * Check paste aperture ratio (paste area / pad area) against preset range.
 * Ratio too small = insufficient solder paste. Too large = bridging risk.
 */
function checkPasteApertureRatio(
  pads: PCBPadFabInfo[],
  preset: FabRulePreset,
): PCBDrcViolation[] {
  const violations: PCBDrcViolation[] = [];
  for (const pad of pads) {
    if (pad.type !== 'smd') {
      continue; // paste aperture only applies to SMD pads
    }
    const padArea = pad.width * pad.height;
    if (padArea === 0) {
      continue;
    }
    const pasteW = pad.pasteApertureWidth ?? pad.width;
    const pasteH = pad.pasteApertureHeight ?? pad.height;
    const pasteArea = pasteW * pasteH;
    const ratio = pasteArea / padArea;

    if (ratio < preset.minPasteApertureRatio) {
      violations.push({
        type: 'paste_aperture_ratio',
        message: `Pad "${pad.id}" paste aperture ratio ${String(ratio.toFixed(3))} is below minimum ${String(preset.minPasteApertureRatio)} — insufficient solder paste (${preset.name})`,
        position: pad.position,
        severity: 'warning',
        obstacleIds: [pad.id],
        clearanceRequired: preset.minPasteApertureRatio,
        clearanceActual: ratio,
      });
    } else if (ratio > preset.maxPasteApertureRatio) {
      violations.push({
        type: 'paste_aperture_ratio',
        message: `Pad "${pad.id}" paste aperture ratio ${String(ratio.toFixed(3))} exceeds maximum ${String(preset.maxPasteApertureRatio)} — solder bridging risk (${preset.name})`,
        position: pad.position,
        severity: 'warning',
        obstacleIds: [pad.id],
        clearanceRequired: preset.maxPasteApertureRatio,
        clearanceActual: ratio,
      });
    }
  }
  return violations;
}

/**
 * AABB overlap test for courtyard bounding boxes.
 * Returns the gap distance (negative = overlap).
 */
function courtyardGap(a: PCBComponentCourtyard, b: PCBComponentCourtyard): number {
  const aMinX = a.position.x + a.courtyard.x;
  const aMinY = a.position.y + a.courtyard.y;
  const aMaxX = aMinX + a.courtyard.width;
  const aMaxY = aMinY + a.courtyard.height;

  const bMinX = b.position.x + b.courtyard.x;
  const bMinY = b.position.y + b.courtyard.y;
  const bMaxX = bMinX + b.courtyard.width;
  const bMaxY = bMinY + b.courtyard.height;

  const gapX = Math.max(aMinX - bMaxX, bMinX - aMaxX, 0);
  const gapY = Math.max(aMinY - bMaxY, bMinY - aMaxY, 0);

  if (gapX === 0 && gapY === 0) {
    // Overlapping — compute overlap depth as negative distance
    const overlapX = Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX);
    const overlapY = Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY);
    if (overlapX > 0 && overlapY > 0) {
      return -Math.min(overlapX, overlapY);
    }
    return 0; // touching
  }

  return Math.sqrt(gapX * gapX + gapY * gapY);
}

/**
 * Check courtyard-to-courtyard clearance between all component pairs on the same layer.
 */
function checkCourtyardClearance(
  components: PCBComponentCourtyard[],
  preset: FabRulePreset,
): PCBDrcViolation[] {
  const violations: PCBDrcViolation[] = [];
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i];
      const b = components[j];
      // Only check same-layer components
      if (a.layer !== b.layer) {
        continue;
      }
      const gap = courtyardGap(a, b);
      if (gap < preset.minCourtyardClearance) {
        const midX = (a.position.x + b.position.x) / 2;
        const midY = (a.position.y + b.position.y) / 2;
        violations.push({
          type: 'courtyard_clearance',
          message: `Components "${a.id}" and "${b.id}" courtyard clearance ${String(gap.toFixed(3))}mm is below minimum ${String(preset.minCourtyardClearance)}mm (${preset.name})`,
          position: { x: midX, y: midY },
          severity: 'error',
          obstacleIds: [a.id, b.id],
          clearanceRequired: preset.minCourtyardClearance,
          clearanceActual: gap,
        });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePadFabInfo(overrides: Partial<PCBPadFabInfo> & { id: string }): PCBPadFabInfo {
  return {
    position: { x: 0, y: 0 },
    width: 1.0,
    height: 0.6,
    type: 'smd',
    solderMaskExpansion: 0.05,
    componentId: 'comp-1',
    ...overrides,
  };
}

function makeCourtyard(
  overrides: Partial<PCBComponentCourtyard> & { id: string },
): PCBComponentCourtyard {
  return {
    position: { x: 0, y: 0 },
    courtyard: { x: -1, y: -0.5, width: 2, height: 1 },
    layer: 'front',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — FAB_RULE_PRESETS
// ---------------------------------------------------------------------------

describe('FAB_RULE_PRESETS', () => {
  it('exports all four manufacturer presets', () => {
    expect(FAB_RULE_PRESETS).toHaveProperty('JLCPCB');
    expect(FAB_RULE_PRESETS).toHaveProperty('PCBWay');
    expect(FAB_RULE_PRESETS).toHaveProperty('OSHPark');
    expect(FAB_RULE_PRESETS).toHaveProperty('Generic');
  });

  it('each preset has a name matching its key', () => {
    for (const [key, preset] of Object.entries(FAB_RULE_PRESETS)) {
      expect(preset.name).toBe(key);
    }
  });

  it('each preset has all required fab rule fields', () => {
    for (const preset of Object.values(FAB_RULE_PRESETS)) {
      expect(typeof preset.minSolderMaskExpansion).toBe('number');
      expect(typeof preset.minPasteApertureRatio).toBe('number');
      expect(typeof preset.maxPasteApertureRatio).toBe('number');
      expect(typeof preset.minCourtyardClearance).toBe('number');
    }
  });

  it('solder mask expansion thresholds are positive and reasonable (0.01–0.2mm)', () => {
    for (const preset of Object.values(FAB_RULE_PRESETS)) {
      expect(preset.minSolderMaskExpansion).toBeGreaterThan(0.01);
      expect(preset.minSolderMaskExpansion).toBeLessThanOrEqual(0.2);
    }
  });

  it('paste aperture ratio range is valid (min < max, both in 0–1.5)', () => {
    for (const preset of Object.values(FAB_RULE_PRESETS)) {
      expect(preset.minPasteApertureRatio).toBeGreaterThan(0);
      expect(preset.maxPasteApertureRatio).toBeGreaterThan(0);
      expect(preset.minPasteApertureRatio).toBeLessThan(preset.maxPasteApertureRatio);
      expect(preset.maxPasteApertureRatio).toBeLessThanOrEqual(1.5);
    }
  });

  it('courtyard clearance is positive and reasonable (0.1–2.0mm)', () => {
    for (const preset of Object.values(FAB_RULE_PRESETS)) {
      expect(preset.minCourtyardClearance).toBeGreaterThanOrEqual(0.1);
      expect(preset.minCourtyardClearance).toBeLessThanOrEqual(2.0);
    }
  });

  it('JLCPCB preset has expected values', () => {
    const jlc = FAB_RULE_PRESETS['JLCPCB'];
    expect(jlc.minSolderMaskExpansion).toBe(0.05);
    expect(jlc.minPasteApertureRatio).toBe(0.5);
    expect(jlc.maxPasteApertureRatio).toBe(1.0);
    expect(jlc.minCourtyardClearance).toBe(0.25);
  });

  it('PCBWay preset has expected values', () => {
    const pw = FAB_RULE_PRESETS['PCBWay'];
    expect(pw.minSolderMaskExpansion).toBe(0.051);
    expect(pw.minPasteApertureRatio).toBe(0.5);
    expect(pw.maxPasteApertureRatio).toBe(0.95);
    expect(pw.minCourtyardClearance).toBe(0.2);
  });

  it('OSHPark preset has expected values', () => {
    const osh = FAB_RULE_PRESETS['OSHPark'];
    expect(osh.minSolderMaskExpansion).toBe(0.05);
    expect(osh.minPasteApertureRatio).toBe(0.55);
    expect(osh.maxPasteApertureRatio).toBe(0.9);
    expect(osh.minCourtyardClearance).toBe(0.25);
  });

  it('Generic preset has expected values', () => {
    const gen = FAB_RULE_PRESETS['Generic'];
    expect(gen.minSolderMaskExpansion).toBe(0.05);
    expect(gen.minPasteApertureRatio).toBe(0.6);
    expect(gen.maxPasteApertureRatio).toBe(1.0);
    expect(gen.minCourtyardClearance).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Tests — Solder Mask Expansion
// ---------------------------------------------------------------------------

describe('Solder mask expansion check', () => {
  const preset = FAB_RULE_PRESETS['JLCPCB']; // minSolderMaskExpansion = 0.05

  it('passes when expansion meets the minimum', () => {
    const pads = [makePadFabInfo({ id: 'pad-1', solderMaskExpansion: 0.06 })];
    const violations = checkSolderMaskExpansion(pads, preset);
    expect(violations).toHaveLength(0);
  });

  it('passes at exact boundary value', () => {
    const pads = [makePadFabInfo({ id: 'pad-1', solderMaskExpansion: 0.05 })];
    const violations = checkSolderMaskExpansion(pads, preset);
    expect(violations).toHaveLength(0);
  });

  it('fails when expansion is below the minimum', () => {
    const pads = [makePadFabInfo({ id: 'pad-1', solderMaskExpansion: 0.03 })];
    const violations = checkSolderMaskExpansion(pads, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('solder_mask_expansion');
    expect(violations[0].clearanceActual).toBe(0.03);
    expect(violations[0].clearanceRequired).toBe(0.05);
    expect(violations[0].obstacleIds).toEqual(['pad-1']);
  });

  it('reports violation at the pad position', () => {
    const pads = [
      makePadFabInfo({ id: 'pad-1', solderMaskExpansion: 0.01, position: { x: 5, y: 10 } }),
    ];
    const violations = checkSolderMaskExpansion(pads, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].position).toEqual({ x: 5, y: 10 });
  });

  it('flags zero expansion as a violation', () => {
    const pads = [makePadFabInfo({ id: 'pad-1', solderMaskExpansion: 0 })];
    const violations = checkSolderMaskExpansion(pads, preset);
    expect(violations).toHaveLength(1);
  });

  it('checks multiple pads independently', () => {
    const pads = [
      makePadFabInfo({ id: 'pad-ok', solderMaskExpansion: 0.08 }),
      makePadFabInfo({ id: 'pad-bad', solderMaskExpansion: 0.02 }),
      makePadFabInfo({ id: 'pad-borderline', solderMaskExpansion: 0.05 }),
    ];
    const violations = checkSolderMaskExpansion(pads, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].obstacleIds).toEqual(['pad-bad']);
  });

  it('returns empty for empty pad list', () => {
    const violations = checkSolderMaskExpansion([], preset);
    expect(violations).toHaveLength(0);
  });

  it('uses PCBWay preset with stricter threshold (0.051mm)', () => {
    const pcbWay = FAB_RULE_PRESETS['PCBWay'];
    const pads = [makePadFabInfo({ id: 'pad-1', solderMaskExpansion: 0.05 })];
    const violations = checkSolderMaskExpansion(pads, pcbWay);
    // 0.05 < 0.051 → violation
    expect(violations).toHaveLength(1);
    expect(violations[0].clearanceRequired).toBe(0.051);
  });

  it('applies to both SMD and THT pads', () => {
    const pads = [
      makePadFabInfo({ id: 'smd-pad', type: 'smd', solderMaskExpansion: 0.02 }),
      makePadFabInfo({ id: 'tht-pad', type: 'tht', solderMaskExpansion: 0.02 }),
    ];
    const violations = checkSolderMaskExpansion(pads, preset);
    expect(violations).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — Paste Aperture Ratio
// ---------------------------------------------------------------------------

describe('Paste aperture ratio check', () => {
  const preset = FAB_RULE_PRESETS['JLCPCB']; // min=0.5, max=1.0

  it('passes when ratio is within acceptable range', () => {
    // Pad 1.0x0.6, paste 0.8x0.5 → ratio = 0.4/0.6 = 0.667
    const pads = [
      makePadFabInfo({
        id: 'pad-1',
        width: 1.0,
        height: 0.6,
        pasteApertureWidth: 0.8,
        pasteApertureHeight: 0.5,
      }),
    ];
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(0);
  });

  it('defaults paste to pad dimensions when not specified (ratio = 1.0)', () => {
    const pads = [
      makePadFabInfo({ id: 'pad-1', width: 1.0, height: 0.6 }),
    ];
    // No pasteApertureWidth/Height → ratio = (1.0*0.6)/(1.0*0.6) = 1.0
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(0); // 1.0 == max, should pass
  });

  it('flags ratio below minimum as insufficient solder', () => {
    // Pad 1.0x1.0, paste 0.5x0.5 → ratio = 0.25/1.0 = 0.25
    const pads = [
      makePadFabInfo({
        id: 'pad-1',
        width: 1.0,
        height: 1.0,
        pasteApertureWidth: 0.5,
        pasteApertureHeight: 0.5,
      }),
    ];
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('paste_aperture_ratio');
    expect(violations[0].message).toContain('insufficient solder paste');
    expect(violations[0].clearanceActual).toBeCloseTo(0.25, 3);
  });

  it('flags ratio above maximum as bridging risk', () => {
    // Pad 0.5x0.5, paste 0.6x0.6 → ratio = 0.36/0.25 = 1.44
    const pads = [
      makePadFabInfo({
        id: 'pad-1',
        width: 0.5,
        height: 0.5,
        pasteApertureWidth: 0.6,
        pasteApertureHeight: 0.6,
      }),
    ];
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('paste_aperture_ratio');
    expect(violations[0].message).toContain('solder bridging risk');
    expect(violations[0].clearanceActual).toBeCloseTo(1.44, 2);
  });

  it('passes at exact minimum boundary (ratio = 0.5)', () => {
    // Pad 1.0x1.0, paste sqrt(0.5)xsqrt(0.5) ≈ 0.7071x0.7071 → ratio = 0.5
    const side = Math.sqrt(0.5);
    const pads = [
      makePadFabInfo({
        id: 'pad-1',
        width: 1.0,
        height: 1.0,
        pasteApertureWidth: side,
        pasteApertureHeight: side,
      }),
    ];
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(0);
  });

  it('passes at exact maximum boundary (ratio = 1.0)', () => {
    const pads = [
      makePadFabInfo({
        id: 'pad-1',
        width: 1.0,
        height: 0.6,
        pasteApertureWidth: 1.0,
        pasteApertureHeight: 0.6,
      }),
    ];
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(0);
  });

  it('skips THT pads (paste aperture only applies to SMD)', () => {
    const pads = [
      makePadFabInfo({
        id: 'tht-pad',
        type: 'tht',
        width: 1.0,
        height: 1.0,
        pasteApertureWidth: 0.1,
        pasteApertureHeight: 0.1,
      }),
    ];
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(0);
  });

  it('skips pads with zero area', () => {
    const pads = [
      makePadFabInfo({ id: 'zero-pad', width: 0, height: 0 }),
    ];
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(0);
  });

  it('checks multiple pads and flags only violations', () => {
    const pads = [
      makePadFabInfo({ id: 'ok', width: 1, height: 1, pasteApertureWidth: 0.8, pasteApertureHeight: 0.8 }),
      makePadFabInfo({ id: 'too-small', width: 1, height: 1, pasteApertureWidth: 0.3, pasteApertureHeight: 0.3 }),
      makePadFabInfo({ id: 'too-large', width: 0.5, height: 0.5, pasteApertureWidth: 0.6, pasteApertureHeight: 0.6 }),
    ];
    const violations = checkPasteApertureRatio(pads, preset);
    expect(violations).toHaveLength(2);
    const ids = violations.map((v) => v.obstacleIds[0]);
    expect(ids).toContain('too-small');
    expect(ids).toContain('too-large');
  });

  it('uses OSHPark preset with narrower range (0.55–0.9)', () => {
    const osh = FAB_RULE_PRESETS['OSHPark'];
    // ratio = 1.0 (default no paste override) → exceeds max 0.9
    const pads = [makePadFabInfo({ id: 'pad-1', width: 1, height: 1 })];
    const violations = checkPasteApertureRatio(pads, osh);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('solder bridging risk');
  });

  it('returns empty for empty pad list', () => {
    const violations = checkPasteApertureRatio([], preset);
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — Courtyard Clearance
// ---------------------------------------------------------------------------

describe('Courtyard clearance check', () => {
  const preset = FAB_RULE_PRESETS['JLCPCB']; // minCourtyardClearance = 0.25

  it('passes when components have adequate spacing', () => {
    const comps = [
      makeCourtyard({ id: 'U1', position: { x: 0, y: 0 }, courtyard: { x: -1, y: -0.5, width: 2, height: 1 } }),
      makeCourtyard({ id: 'U2', position: { x: 5, y: 0 }, courtyard: { x: -1, y: -0.5, width: 2, height: 1 } }),
    ];
    // U1 courtyard: -1..1, U2 courtyard: 4..6 → gap = 3mm
    const violations = checkCourtyardClearance(comps, preset);
    expect(violations).toHaveLength(0);
  });

  it('fails when components are too close', () => {
    const comps = [
      makeCourtyard({ id: 'U1', position: { x: 0, y: 0 }, courtyard: { x: -1, y: -0.5, width: 2, height: 1 } }),
      makeCourtyard({ id: 'U2', position: { x: 1.1, y: 0 }, courtyard: { x: -1, y: -0.5, width: 2, height: 1 } }),
    ];
    // U1 courtyard X: -1..1, U2 courtyard X: 0.1..2.1 → overlap in X
    const violations = checkCourtyardClearance(comps, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('courtyard_clearance');
    expect(violations[0].obstacleIds).toEqual(['U1', 'U2']);
    expect(violations[0].clearanceActual).toBeLessThan(0.25);
  });

  it('flags overlapping courtyards (negative gap)', () => {
    const comps = [
      makeCourtyard({ id: 'R1', position: { x: 0, y: 0 }, courtyard: { x: -0.5, y: -0.5, width: 1, height: 1 } }),
      makeCourtyard({ id: 'R2', position: { x: 0.5, y: 0 }, courtyard: { x: -0.5, y: -0.5, width: 1, height: 1 } }),
    ];
    // R1: -0.5..0.5, R2: 0..1 → overlap 0.5mm
    const violations = checkCourtyardClearance(comps, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].clearanceActual).toBeLessThan(0);
  });

  it('passes at exact boundary clearance', () => {
    const comps = [
      makeCourtyard({ id: 'C1', position: { x: 0, y: 0 }, courtyard: { x: 0, y: 0, width: 1, height: 1 } }),
      makeCourtyard({ id: 'C2', position: { x: 1.25, y: 0 }, courtyard: { x: 0, y: 0, width: 1, height: 1 } }),
    ];
    // C1: 0..1, C2: 1.25..2.25 → gap = 0.25mm exactly
    const violations = checkCourtyardClearance(comps, preset);
    expect(violations).toHaveLength(0);
  });

  it('does not flag components on different layers', () => {
    const comps = [
      makeCourtyard({ id: 'U1', position: { x: 0, y: 0 }, layer: 'front' }),
      makeCourtyard({ id: 'U2', position: { x: 0, y: 0 }, layer: 'back' }),
    ];
    // Same position but different layers — no violation
    const violations = checkCourtyardClearance(comps, preset);
    expect(violations).toHaveLength(0);
  });

  it('checks all pairs (3 components → 3 pairs)', () => {
    // All overlapping on same layer
    const comps = [
      makeCourtyard({ id: 'A', position: { x: 0, y: 0 } }),
      makeCourtyard({ id: 'B', position: { x: 0.1, y: 0 } }),
      makeCourtyard({ id: 'C', position: { x: 0.2, y: 0 } }),
    ];
    const violations = checkCourtyardClearance(comps, preset);
    // A-B, A-C, B-C — all should violate
    expect(violations).toHaveLength(3);
    const pairs = violations.map((v) => v.obstacleIds.sort().join(','));
    expect(pairs).toContain('A,B');
    expect(pairs).toContain('A,C');
    expect(pairs).toContain('B,C');
  });

  it('reports violation position at midpoint between components', () => {
    const comps = [
      makeCourtyard({ id: 'U1', position: { x: 0, y: 0 } }),
      makeCourtyard({ id: 'U2', position: { x: 0.5, y: 0 } }),
    ];
    const violations = checkCourtyardClearance(comps, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].position.x).toBeCloseTo(0.25, 3);
    expect(violations[0].position.y).toBeCloseTo(0, 3);
  });

  it('handles single component (no pairs)', () => {
    const comps = [makeCourtyard({ id: 'U1' })];
    const violations = checkCourtyardClearance(comps, preset);
    expect(violations).toHaveLength(0);
  });

  it('handles empty component list', () => {
    const violations = checkCourtyardClearance([], preset);
    expect(violations).toHaveLength(0);
  });

  it('uses Generic preset with larger clearance (0.5mm)', () => {
    const generic = FAB_RULE_PRESETS['Generic'];
    const comps = [
      makeCourtyard({ id: 'C1', position: { x: 0, y: 0 }, courtyard: { x: 0, y: 0, width: 1, height: 1 } }),
      makeCourtyard({ id: 'C2', position: { x: 1.3, y: 0 }, courtyard: { x: 0, y: 0, width: 1, height: 1 } }),
    ];
    // Gap = 0.3mm — passes JLCPCB (0.25) but fails Generic (0.5)
    const jlcViolations = checkCourtyardClearance(comps, preset);
    const genViolations = checkCourtyardClearance(comps, generic);
    expect(jlcViolations).toHaveLength(0);
    expect(genViolations).toHaveLength(1);
  });

  it('detects Y-axis proximity violations', () => {
    const comps = [
      makeCourtyard({ id: 'U1', position: { x: 0, y: 0 }, courtyard: { x: 0, y: 0, width: 1, height: 1 } }),
      makeCourtyard({ id: 'U2', position: { x: 0, y: 1.1 }, courtyard: { x: 0, y: 0, width: 1, height: 1 } }),
    ];
    // Y gap = 0.1mm < 0.25mm minimum
    const violations = checkCourtyardClearance(comps, preset);
    expect(violations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — Integration: all fab rules together
// ---------------------------------------------------------------------------

describe('Integration: combined fab rule check', () => {
  it('runs all three checks on a mock board with mixed pass/fail conditions', () => {
    const preset = FAB_RULE_PRESETS['JLCPCB'];

    // Pads: 1 good SMD, 1 bad solder mask, 1 bad paste ratio
    const pads: PCBPadFabInfo[] = [
      makePadFabInfo({ id: 'pad-good', solderMaskExpansion: 0.06, width: 1, height: 1, pasteApertureWidth: 0.8, pasteApertureHeight: 0.8 }),
      makePadFabInfo({ id: 'pad-bad-mask', solderMaskExpansion: 0.01, width: 1, height: 1, pasteApertureWidth: 0.8, pasteApertureHeight: 0.8 }),
      makePadFabInfo({ id: 'pad-bad-paste', solderMaskExpansion: 0.06, width: 1, height: 1, pasteApertureWidth: 0.2, pasteApertureHeight: 0.2 }),
    ];

    // Components: 2 close together (violation), 1 far away (ok)
    const comps: PCBComponentCourtyard[] = [
      makeCourtyard({ id: 'U1', position: { x: 0, y: 0 } }),
      makeCourtyard({ id: 'U2', position: { x: 0.5, y: 0 } }),
      makeCourtyard({ id: 'U3', position: { x: 20, y: 0 } }),
    ];

    const maskViolations = checkSolderMaskExpansion(pads, preset);
    const pasteViolations = checkPasteApertureRatio(pads, preset);
    const courtyardViolations = checkCourtyardClearance(comps, preset);

    // 1 mask violation
    expect(maskViolations).toHaveLength(1);
    expect(maskViolations[0].obstacleIds).toEqual(['pad-bad-mask']);

    // 1 paste violation (ratio = 0.04 — way below 0.5)
    expect(pasteViolations).toHaveLength(1);
    expect(pasteViolations[0].obstacleIds).toEqual(['pad-bad-paste']);

    // 1 courtyard violation (U1-U2 too close)
    expect(courtyardViolations).toHaveLength(1);
    expect(courtyardViolations[0].obstacleIds).toEqual(['U1', 'U2']);

    // All violations have correct types
    const allViolations = [...maskViolations, ...pasteViolations, ...courtyardViolations];
    expect(allViolations).toHaveLength(3);
    const types = new Set(allViolations.map((v) => v.type));
    expect(types.has('solder_mask_expansion')).toBe(true);
    expect(types.has('paste_aperture_ratio')).toBe(true);
    expect(types.has('courtyard_clearance')).toBe(true);
  });

  it('clean board with all passing conditions produces zero violations', () => {
    const preset = FAB_RULE_PRESETS['Generic'];

    const pads: PCBPadFabInfo[] = [
      makePadFabInfo({ id: 'p1', solderMaskExpansion: 0.1, width: 1, height: 1, pasteApertureWidth: 0.8, pasteApertureHeight: 0.8 }),
      makePadFabInfo({ id: 'p2', solderMaskExpansion: 0.08, width: 0.5, height: 0.5, pasteApertureWidth: 0.4, pasteApertureHeight: 0.4 }),
    ];

    const comps: PCBComponentCourtyard[] = [
      makeCourtyard({ id: 'C1', position: { x: 0, y: 0 }, courtyard: { x: 0, y: 0, width: 1, height: 1 } }),
      makeCourtyard({ id: 'C2', position: { x: 5, y: 0 }, courtyard: { x: 0, y: 0, width: 1, height: 1 } }),
    ];

    expect(checkSolderMaskExpansion(pads, preset)).toHaveLength(0);
    expect(checkPasteApertureRatio(pads, preset)).toHaveLength(0);
    expect(checkCourtyardClearance(comps, preset)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — PCBDrcChecker violation type coverage
// ---------------------------------------------------------------------------

describe('PCBDrcChecker violation types include fab rules', () => {
  it('the PCBDrcViolation type union includes solder_mask_expansion', () => {
    const v: PCBDrcViolation = {
      type: 'solder_mask_expansion',
      message: 'test',
      position: { x: 0, y: 0 },
      severity: 'warning',
      obstacleIds: [],
      clearanceRequired: 0.05,
      clearanceActual: 0.03,
    };
    expect(v.type).toBe('solder_mask_expansion');
  });

  it('the PCBDrcViolation type union includes paste_aperture_ratio', () => {
    const v: PCBDrcViolation = {
      type: 'paste_aperture_ratio',
      message: 'test',
      position: { x: 0, y: 0 },
      severity: 'warning',
      obstacleIds: [],
      clearanceRequired: 0.5,
      clearanceActual: 0.3,
    };
    expect(v.type).toBe('paste_aperture_ratio');
  });

  it('the PCBDrcViolation type union includes courtyard_clearance', () => {
    const v: PCBDrcViolation = {
      type: 'courtyard_clearance',
      message: 'test',
      position: { x: 0, y: 0 },
      severity: 'error',
      obstacleIds: [],
      clearanceRequired: 0.25,
      clearanceActual: 0.1,
    };
    expect(v.type).toBe('courtyard_clearance');
  });
});

// ---------------------------------------------------------------------------
// Tests — PCBDrcChecker class still works (no regressions)
// ---------------------------------------------------------------------------

describe('PCBDrcChecker class basic functionality (regression guard)', () => {
  it('instantiates with default clearance', () => {
    const checker = new PCBDrcChecker();
    expect(checker).toBeDefined();
    expect(checker.getViolationCount()).toBe(0);
  });

  it('instantiates with custom clearance', () => {
    const checker = new PCBDrcChecker(0.15);
    expect(checker).toBeDefined();
  });

  it('checkAll on empty board returns no violations', () => {
    const checker = new PCBDrcChecker();
    const violations = checker.checkAll();
    expect(violations).toHaveLength(0);
  });

  it('checkTrace on empty board returns no violations for valid width', () => {
    const checker = new PCBDrcChecker();
    const violations = checker.checkTrace(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      0.2,
      'front',
    );
    expect(violations).toHaveLength(0);
  });

  it('checkTrace flags min-width violation', () => {
    const checker = new PCBDrcChecker();
    checker.setMinTraceWidth(0.15);
    const violations = checker.checkTrace(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      0.1,
      'front',
    );
    expect(violations.some((v) => v.type === 'min-width')).toBe(true);
  });
});
