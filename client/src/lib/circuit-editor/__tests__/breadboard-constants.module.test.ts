/**
 * Breadboard Constants Module Tests
 *
 * Exercises all exports from breadboard-constants.ts — the single source of
 * truth for physical geometry, canvas rendering values, severity weights,
 * layout-quality thresholds, power budget limits, and vault-note slug aliases.
 *
 * Task 1.4 of /home/wtyler/.claude/plans/calm-yawning-kitten.md.
 * These tests MUST fail before breadboard-constants.ts is created (TDD red).
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PHYSICAL,
  UI,
  SEVERITY_WEIGHTS,
  LAYOUT_QUALITY,
  POWER_BUDGET,
  VAULT_SLUGS,
} from '../breadboard-constants';
import { BB } from '../breadboard-model';

// ---------------------------------------------------------------------------
// PHYSICAL — datasheet-authoritative breadboard geometry
// ---------------------------------------------------------------------------

describe('PHYSICAL', () => {
  it('PITCH_MM is exactly 2.54 (industry 0.1 inch standard)', () => {
    expect(PHYSICAL.PITCH_MM).toBe(2.54);
  });

  it('PITCH_PX_96DPI = PITCH_MM × (96/25.4) (W3C CSS Values 3 §5.2)', () => {
    expect(PHYSICAL.PITCH_PX_96DPI).toBeCloseTo(PHYSICAL.PITCH_MM * (96 / 25.4), 10);
    expect(PHYSICAL.PITCH_PX_96DPI).toBe(9.6);
  });

  it('BOARD_WIDTH_MM is 165.1 (BB830 datasheet)', () => {
    expect(PHYSICAL.BOARD_WIDTH_MM).toBe(165.1);
  });

  it('BOARD_HEIGHT_MM is 54.6', () => {
    expect(PHYSICAL.BOARD_HEIGHT_MM).toBe(54.6);
  });

  it('BOARD_THICKNESS_MM is 8.5', () => {
    expect(PHYSICAL.BOARD_THICKNESS_MM).toBe(8.5);
  });

  it('CHANNEL_GAP_MM is 7.62 (0.3 inch DIP straddle)', () => {
    expect(PHYSICAL.CHANNEL_GAP_MM).toBe(7.62);
  });

  it('TIE_POINTS is 830', () => {
    expect(PHYSICAL.TIE_POINTS).toBe(830);
  });

  it('PHYSICAL.TIE_POINTS === BB.PHYSICAL_TIE_POINTS (cross-file drift guard)', () => {
    expect(PHYSICAL.TIE_POINTS).toBe(BB.PHYSICAL_TIE_POINTS);
  });
});

// ---------------------------------------------------------------------------
// UI — canvas/rendering pixel values
// ---------------------------------------------------------------------------

describe('UI', () => {
  it('PITCH_PX is 10 (documented rounding pitfall vs 9.6)', () => {
    expect(UI.PITCH_PX).toBe(10);
  });

  it('SNAP_RADIUS_PX === PITCH_PX × 0.6', () => {
    expect(UI.SNAP_RADIUS_PX).toBe(UI.PITCH_PX * 0.6);
  });

  it('HOLE_RADIUS_TERMINAL_FRACTION > HOLE_RADIUS_RAIL_FRACTION (terminals slightly bigger)', () => {
    expect(UI.HOLE_RADIUS_TERMINAL_FRACTION).toBeGreaterThan(UI.HOLE_RADIUS_RAIL_FRACTION);
  });

  it('BENCH_ANCHOR_HIT_RADIUS_PX <= 2 × BENCH_ANCHOR_VISIBLE_RADIUS_PX (audit #196 invariant)', () => {
    expect(UI.BENCH_ANCHOR_HIT_RADIUS_PX).toBeLessThanOrEqual(2 * UI.BENCH_ANCHOR_VISIBLE_RADIUS_PX);
  });

  it('PIN_SNAP_TOLERANCE_PX > SNAP_RADIUS_PX (wires tolerate more imprecision than holes)', () => {
    expect(UI.PIN_SNAP_TOLERANCE_PX).toBeGreaterThan(UI.SNAP_RADIUS_PX);
  });

  it('ORIGIN_X_PX >= one-hole-radius (room for row labels)', () => {
    expect(UI.ORIGIN_X_PX).toBeGreaterThanOrEqual(UI.HOLE_RADIUS_TERMINAL_FRACTION * UI.PITCH_PX);
  });

  it('ORIGIN_Y_PX is positive (canvas has top margin)', () => {
    expect(UI.ORIGIN_Y_PX).toBeGreaterThan(0);
  });

  it('HOVER_RADIUS_DELTA_PX is positive (hover expands hole radius)', () => {
    expect(UI.HOVER_RADIUS_DELTA_PX).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// SEVERITY_WEIGHTS — score deduction per issue
// ---------------------------------------------------------------------------

describe('SEVERITY_WEIGHTS', () => {
  it('monotonic: critical > warning > info', () => {
    expect(SEVERITY_WEIGHTS.critical).toBeGreaterThan(SEVERITY_WEIGHTS.warning);
    expect(SEVERITY_WEIGHTS.warning).toBeGreaterThan(SEVERITY_WEIGHTS.info);
  });

  it('recalibrated to 20/10/2 per audit #271', () => {
    expect(SEVERITY_WEIGHTS).toEqual({ critical: 20, warning: 10, info: 2 });
  });

  it('5 critical issues drop score by 100 (entire range — encodes a catastrophic board)', () => {
    expect(5 * SEVERITY_WEIGHTS.critical).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// LAYOUT_QUALITY — scoring thresholds and curve parameters
// ---------------------------------------------------------------------------

describe('LAYOUT_QUALITY', () => {
  it('pin-trust bases are monotonic: verified > connector > heuristic > stash-absent', () => {
    expect(LAYOUT_QUALITY.PIN_TRUST_BASE_VERIFIED).toBeGreaterThan(
      LAYOUT_QUALITY.PIN_TRUST_BASE_CONNECTOR,
    );
    expect(LAYOUT_QUALITY.PIN_TRUST_BASE_CONNECTOR).toBeGreaterThan(
      LAYOUT_QUALITY.PIN_TRUST_BASE_HEURISTIC,
    );
    expect(LAYOUT_QUALITY.PIN_TRUST_BASE_HEURISTIC).toBeGreaterThan(
      LAYOUT_QUALITY.PIN_TRUST_BASE_STASH_ABSENT,
    );
  });

  it('band thresholds are monotonically descending', () => {
    expect(LAYOUT_QUALITY.BAND_DIALED_IN).toBeGreaterThan(LAYOUT_QUALITY.BAND_SOLID);
    expect(LAYOUT_QUALITY.BAND_SOLID).toBeGreaterThan(LAYOUT_QUALITY.BAND_DEVELOPING);
  });

  it('penalty curve avoids floor collapse (audit #245)', () => {
    // 3 critical heuristic pins from BASE_HEURISTIC should not drop below FLOOR.
    const after3Crits =
      LAYOUT_QUALITY.PIN_TRUST_BASE_HEURISTIC - 3 * LAYOUT_QUALITY.CRITICAL_HEURISTIC_PENALTY;
    expect(after3Crits).toBeGreaterThanOrEqual(LAYOUT_QUALITY.CRITICAL_HEURISTIC_FLOOR);
  });

  it('stash modifier clamped to ±3 (audit #246)', () => {
    expect(LAYOUT_QUALITY.STASH_MODIFIER_MAX).toBe(3);
  });

  it('TONE_GOOD_THRESHOLD > TONE_WATCH_THRESHOLD (good is better than watch)', () => {
    expect(LAYOUT_QUALITY.TONE_GOOD_THRESHOLD).toBeGreaterThan(LAYOUT_QUALITY.TONE_WATCH_THRESHOLD);
  });

  it('BAND_DIALED_IN matches TONE_GOOD_THRESHOLD (scoring bands are aligned)', () => {
    expect(LAYOUT_QUALITY.BAND_DIALED_IN).toBe(LAYOUT_QUALITY.TONE_GOOD_THRESHOLD);
  });
});

// ---------------------------------------------------------------------------
// POWER_BUDGET — current-draw thresholds for preflight checks
// ---------------------------------------------------------------------------

describe('POWER_BUDGET', () => {
  it('USB_WARN_MA < USB_FAIL_MA (warn fires before fail)', () => {
    expect(POWER_BUDGET.USB_WARN_MA).toBeLessThan(POWER_BUDGET.USB_FAIL_MA);
  });

  it('EXTERNAL_MODULE_FAIL_MA > USB_FAIL_MA (external supply handles more than USB)', () => {
    expect(POWER_BUDGET.EXTERNAL_MODULE_FAIL_MA).toBeGreaterThan(POWER_BUDGET.USB_FAIL_MA);
  });

  it('USB_FAIL_MA is 500 (USB 2.0 hard cap)', () => {
    expect(POWER_BUDGET.USB_FAIL_MA).toBe(500);
  });

  it('USB_WARN_MA is 400 (80% of USB 2.0 cap)', () => {
    expect(POWER_BUDGET.USB_WARN_MA).toBe(400);
  });

  it('EXTERNAL_MODULE_FAIL_MA is 700 (breadboard power module limit)', () => {
    expect(POWER_BUDGET.EXTERNAL_MODULE_FAIL_MA).toBe(700);
  });

  it('USB_WARN_MA is 80% of USB_FAIL_MA (documented threshold contract)', () => {
    expect(POWER_BUDGET.USB_WARN_MA / POWER_BUDGET.USB_FAIL_MA).toBeCloseTo(0.8, 2);
  });
});

// ---------------------------------------------------------------------------
// VAULT_SLUGS — stable citation aliases for audit/coach/prompt integration
// ---------------------------------------------------------------------------

describe('VAULT_SLUGS', () => {
  // This file lives at client/src/lib/circuit-editor/__tests__/breadboard-constants.module.test.ts
  // Traverse up 5 levels to reach the repo root, then into knowledge/.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const knowledgeDir = resolve(__dirname, '..', '..', '..', '..', '..', 'knowledge');

  it('all 41 entries are present (36 Wave 1 + 5 Wave 2 decoupling/driver slugs)', () => {
    expect(Object.keys(VAULT_SLUGS)).toHaveLength(41);
  });

  // Parameterized: every slug's file exists on disk
  for (const [key, slug] of Object.entries(VAULT_SLUGS)) {
    it(`${key} -> ${slug}.md exists in knowledge/`, () => {
      const file = resolve(knowledgeDir, `${slug}.md`);
      expect(existsSync(file)).toBe(true);
    });
  }

  it('all slugs use kebab-case (no underscores, no capitals)', () => {
    for (const slug of Object.values(VAULT_SLUGS)) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
