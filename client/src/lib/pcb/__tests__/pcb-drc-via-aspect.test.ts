/**
 * Tests for PCB DRC via aspect ratio rule (BL-0508).
 *
 * Aspect ratio = board_thickness / drill_diameter.
 * Exceeding the maximum makes reliable plating difficult/impossible.
 *
 * Uses the types and presets exported from pcb-drc-checker.ts.
 */

import { describe, it, expect } from 'vitest';
import { FAB_RULE_PRESETS } from '../pcb-drc-checker';
import type { FabRulePreset, PCBDrcViolation } from '../pcb-drc-checker';

// ---------------------------------------------------------------------------
// Via aspect ratio check helper
// ---------------------------------------------------------------------------

/** Via information needed for the aspect ratio check. */
interface ViaAspectInfo {
  id: string;
  /** Via center position in mm. */
  position: { x: number; y: number };
  /** Drill diameter in mm. */
  drillDiameter: number;
}

/** Default board thickness in mm (standard FR4). */
const DEFAULT_BOARD_THICKNESS = 1.6;

/**
 * Check via aspect ratio (board_thickness / drill_diameter) against the
 * preset maximum. Vias with aspect ratios exceeding the limit are flagged
 * because reliable barrel plating becomes difficult.
 */
function checkViaAspectRatio(
  vias: ViaAspectInfo[],
  preset: FabRulePreset,
  boardThickness = DEFAULT_BOARD_THICKNESS,
): PCBDrcViolation[] {
  const violations: PCBDrcViolation[] = [];
  for (const via of vias) {
    if (via.drillDiameter <= 0) {
      continue;
    }
    const aspectRatio = boardThickness / via.drillDiameter;
    if (aspectRatio > preset.maxViaAspectRatio) {
      violations.push({
        type: 'via_aspect_ratio',
        message: `Via "${via.id}" aspect ratio ${String(aspectRatio.toFixed(2))}:1 exceeds maximum ${String(preset.maxViaAspectRatio)}:1 (board ${String(boardThickness)}mm / drill ${String(via.drillDiameter)}mm) (${preset.name})`,
        position: via.position,
        severity: 'error',
        obstacleIds: [via.id],
        clearanceRequired: preset.maxViaAspectRatio,
        clearanceActual: aspectRatio,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeVia(overrides: Partial<ViaAspectInfo> & { id: string }): ViaAspectInfo {
  return {
    position: { x: 0, y: 0 },
    drillDiameter: 0.3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — FAB_RULE_PRESETS include maxViaAspectRatio
// ---------------------------------------------------------------------------

describe('FAB_RULE_PRESETS — maxViaAspectRatio field', () => {
  it('each preset has a maxViaAspectRatio that is a positive number', () => {
    for (const preset of Object.values(FAB_RULE_PRESETS)) {
      expect(typeof preset.maxViaAspectRatio).toBe('number');
      expect(preset.maxViaAspectRatio).toBeGreaterThan(0);
    }
  });

  it('JLCPCB maxViaAspectRatio is 6', () => {
    expect(FAB_RULE_PRESETS['JLCPCB'].maxViaAspectRatio).toBe(6);
  });

  it('PCBWay maxViaAspectRatio is 8', () => {
    expect(FAB_RULE_PRESETS['PCBWay'].maxViaAspectRatio).toBe(8);
  });

  it('OSHPark maxViaAspectRatio is 6', () => {
    expect(FAB_RULE_PRESETS['OSHPark'].maxViaAspectRatio).toBe(6);
  });

  it('Generic maxViaAspectRatio is 6', () => {
    expect(FAB_RULE_PRESETS['Generic'].maxViaAspectRatio).toBe(6);
  });

  it('maxViaAspectRatio values are in reasonable range (4–12)', () => {
    for (const preset of Object.values(FAB_RULE_PRESETS)) {
      expect(preset.maxViaAspectRatio).toBeGreaterThanOrEqual(4);
      expect(preset.maxViaAspectRatio).toBeLessThanOrEqual(12);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — Via aspect ratio check
// ---------------------------------------------------------------------------

describe('Via aspect ratio check', () => {
  const preset = FAB_RULE_PRESETS['JLCPCB']; // maxViaAspectRatio = 6

  it('passes when via has a large drill and thin board (low aspect ratio)', () => {
    // 1.6 / 0.5 = 3.2:1 — well under 6:1
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.5 })];
    const violations = checkViaAspectRatio(vias, preset);
    expect(violations).toHaveLength(0);
  });

  it('fails when via has a small drill and thick board (high aspect ratio)', () => {
    // 3.2 / 0.3 = 10.67:1 — exceeds 6:1
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.3 })];
    const violations = checkViaAspectRatio(vias, preset, 3.2);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('via_aspect_ratio');
    expect(violations[0].obstacleIds).toEqual(['via-1']);
    expect(violations[0].clearanceActual).toBeCloseTo(10.67, 1);
    expect(violations[0].clearanceRequired).toBe(6);
    expect(violations[0].severity).toBe('error');
  });

  it('passes at exact boundary value (ratio equals max)', () => {
    // 1.8 / 0.3 = 6.0:1 — exactly at limit, should pass
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.3 })];
    const violations = checkViaAspectRatio(vias, preset, 1.8);
    expect(violations).toHaveLength(0);
  });

  it('fails just above boundary value', () => {
    // 1.801 / 0.3 = 6.003:1 — just over 6:1
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.3 })];
    const violations = checkViaAspectRatio(vias, preset, 1.801);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('via_aspect_ratio');
  });

  it('uses default board thickness of 1.6mm when not specified', () => {
    // 1.6 / 0.3 = 5.33:1 — under 6:1, should pass
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.3 })];
    const violations = checkViaAspectRatio(vias, preset);
    expect(violations).toHaveLength(0);
  });

  it('uses custom board thickness when specified', () => {
    // 2.4 / 0.3 = 8.0:1 — exceeds 6:1
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.3 })];
    const violations = checkViaAspectRatio(vias, preset, 2.4);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('board 2.4mm');
    expect(violations[0].message).toContain('drill 0.3mm');
  });

  it('reports violation at the via position', () => {
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.1, position: { x: 15, y: 25 } })];
    // 1.6 / 0.1 = 16:1 — well over 6:1
    const violations = checkViaAspectRatio(vias, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].position).toEqual({ x: 15, y: 25 });
  });

  it('handles multiple vias where some pass and some fail', () => {
    const vias = [
      makeVia({ id: 'via-ok', drillDiameter: 0.5 }),       // 1.6/0.5 = 3.2:1 — pass
      makeVia({ id: 'via-bad', drillDiameter: 0.2 }),       // 1.6/0.2 = 8.0:1 — fail
      makeVia({ id: 'via-borderline', drillDiameter: 0.3 }), // 1.6/0.3 = 5.33:1 — pass
    ];
    const violations = checkViaAspectRatio(vias, preset);
    expect(violations).toHaveLength(1);
    expect(violations[0].obstacleIds).toEqual(['via-bad']);
  });

  it('flags multiple failing vias independently', () => {
    const vias = [
      makeVia({ id: 'via-1', drillDiameter: 0.15 }), // 1.6/0.15 = 10.67:1 — fail
      makeVia({ id: 'via-2', drillDiameter: 0.1 }),   // 1.6/0.1  = 16.0:1  — fail
    ];
    const violations = checkViaAspectRatio(vias, preset);
    expect(violations).toHaveLength(2);
    const ids = violations.map((v) => v.obstacleIds[0]);
    expect(ids).toContain('via-1');
    expect(ids).toContain('via-2');
  });

  it('skips vias with zero drill diameter', () => {
    const vias = [makeVia({ id: 'via-zero', drillDiameter: 0 })];
    const violations = checkViaAspectRatio(vias, preset);
    expect(violations).toHaveLength(0);
  });

  it('skips vias with negative drill diameter', () => {
    const vias = [makeVia({ id: 'via-neg', drillDiameter: -0.3 })];
    const violations = checkViaAspectRatio(vias, preset);
    expect(violations).toHaveLength(0);
  });

  it('returns empty for empty via list', () => {
    const violations = checkViaAspectRatio([], preset);
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — Different presets have different thresholds
// ---------------------------------------------------------------------------

describe('Via aspect ratio — preset differences', () => {
  it('PCBWay allows higher aspect ratio (8:1) than JLCPCB (6:1)', () => {
    // 1.6 / 0.2 = 8.0:1
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.2 })];

    const jlcViolations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['JLCPCB']);
    const pcbwayViolations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['PCBWay']);

    // 8.0 > 6 → JLCPCB fails
    expect(jlcViolations).toHaveLength(1);
    // 8.0 <= 8 → PCBWay passes (exactly at limit)
    expect(pcbwayViolations).toHaveLength(0);
  });

  it('OSHPark has same limit as JLCPCB (6:1)', () => {
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.2 })];

    const jlcViolations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['JLCPCB']);
    const oshViolations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['OSHPark']);

    expect(jlcViolations).toHaveLength(1);
    expect(oshViolations).toHaveLength(1);
  });

  it('Generic preset has same limit as JLCPCB (6:1)', () => {
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.25 })];
    // 1.6 / 0.25 = 6.4:1

    const jlcViolations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['JLCPCB']);
    const genViolations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['Generic']);

    expect(jlcViolations).toHaveLength(1);
    expect(genViolations).toHaveLength(1);
  });

  it('thick board (2.4mm) with medium drill passes PCBWay but fails JLCPCB', () => {
    // 2.4 / 0.35 = 6.857:1
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.35 })];

    const jlcViolations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['JLCPCB'], 2.4);
    const pcbwayViolations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['PCBWay'], 2.4);

    expect(jlcViolations).toHaveLength(1); // 6.857 > 6
    expect(pcbwayViolations).toHaveLength(0); // 6.857 < 8
  });
});

// ---------------------------------------------------------------------------
// Tests — Violation message content
// ---------------------------------------------------------------------------

describe('Via aspect ratio — violation message', () => {
  it('includes the via ID in the message', () => {
    const vias = [makeVia({ id: 'V42', drillDiameter: 0.1 })];
    const violations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['JLCPCB']);
    expect(violations[0].message).toContain('V42');
  });

  it('includes the preset name in the message', () => {
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.1 })];
    const violations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['PCBWay'], 3.0);
    expect(violations[0].message).toContain('PCBWay');
  });

  it('includes the aspect ratio value in the message', () => {
    // 1.6 / 0.1 = 16.00:1
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.1 })];
    const violations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['JLCPCB']);
    expect(violations[0].message).toContain('16.00');
  });

  it('includes board thickness and drill diameter in the message', () => {
    const vias = [makeVia({ id: 'via-1', drillDiameter: 0.2 })];
    const violations = checkViaAspectRatio(vias, FAB_RULE_PRESETS['JLCPCB'], 2.0);
    expect(violations[0].message).toContain('board 2mm');
    expect(violations[0].message).toContain('drill 0.2mm');
  });
});

// ---------------------------------------------------------------------------
// Tests — PCBDrcViolation type includes via_aspect_ratio
// ---------------------------------------------------------------------------

describe('PCBDrcViolation type union includes via_aspect_ratio', () => {
  it('can create a PCBDrcViolation with type via_aspect_ratio', () => {
    const v: PCBDrcViolation = {
      type: 'via_aspect_ratio',
      message: 'test',
      position: { x: 0, y: 0 },
      severity: 'error',
      obstacleIds: ['via-1'],
      clearanceRequired: 6,
      clearanceActual: 10,
    };
    expect(v.type).toBe('via_aspect_ratio');
  });
});
