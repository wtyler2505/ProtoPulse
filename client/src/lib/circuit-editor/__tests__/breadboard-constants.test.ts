/**
 * BB tie-point constants regression tests (audit #347)
 *
 * Exercises the MODEL_TIE_POINTS and PHYSICAL_TIE_POINTS constants on the BB
 * object in client/src/lib/circuit-editor/breadboard-model.ts and documents
 * the intentional model abstraction: ProtoPulse models each power rail as 63
 * contiguous points (aligned with terminal rows) whereas physical BB830
 * breadboards break each rail into two 50-point halves separated by a
 * mid-rail gap.
 */

import { describe, it, expect } from 'vitest';
import { BB } from '../breadboard-model';

describe('BB tie-point constants (regression for audit #347)', () => {
  it('MODEL_TIE_POINTS equals 882', () => {
    expect(BB.MODEL_TIE_POINTS).toBe(882);
  });

  it('PHYSICAL_TIE_POINTS equals 830', () => {
    expect(BB.PHYSICAL_TIE_POINTS).toBe(830);
  });

  it('couples to structural inputs (ROWS, LEFT_COLS, RIGHT_COLS)', () => {
    // If anyone changes ROWS or column counts, the derived totals must track.
    const terminalCount = (BB.LEFT_COLS.length + BB.RIGHT_COLS.length) * BB.ROWS;
    expect(terminalCount).toBe(630);
    expect(BB.MODEL_TIE_POINTS).toBe(terminalCount + 4 * BB.ROWS);
    expect(BB.PHYSICAL_TIE_POINTS).toBe(terminalCount + 4 * 50);
  });

  it('delta between MODEL and PHYSICAL equals exactly 4 × (63 − 50): no other math drift', () => {
    // 4 rails × (63 model points − 50 physical points) = 52
    expect(BB.MODEL_TIE_POINTS - BB.PHYSICAL_TIE_POINTS).toBe(4 * (BB.ROWS - 50));
  });

  it('terminal count (630) is consistent across both constants', () => {
    // Terminals: 63 rows × 10 cols = 630
    const TERMINALS = 63 * 10;
    expect(TERMINALS).toBe(630);

    // MODEL: 630 terminals + 4 × 63 rail points = 882
    expect(BB.MODEL_TIE_POINTS - 4 * 63).toBe(TERMINALS);

    // PHYSICAL: 630 terminals + 4 × 50 rail points = 830
    expect(BB.PHYSICAL_TIE_POINTS - 4 * 50).toBe(TERMINALS);
  });
});
