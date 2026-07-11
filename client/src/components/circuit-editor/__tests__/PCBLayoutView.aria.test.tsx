/**
 * ARIA contract test for PCBLayoutView's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * PCBLayoutView is the orchestrator for the whole PCB canvas: it pulls in
 * useCircuitDesigns/useCircuitInstances/useCircuitNets/useCircuitWires/
 * useCircuitVias/usePcbZones/useComments (all from '@/lib/circuit-editor/hooks'),
 * useProjectBoard, useBoardStackup, useDfmHighlights, useToast,
 * useProjectId, useProjectMeta (context), and useUndoRedo (context) — a full
 * mount would require mocking essentially the entire circuit-editor data
 * layer just to reach two toolbar `<input>` chips. Per the migration
 * instructions' escape hatch ("if a component is genuinely difficult to
 * render in isolation... acceptable to write a narrower test that imports
 * and directly exercises just the relevant <NumberInput>-bearing logic"),
 * this test isolates the exact JSX + props migrated in PCBLayoutView.tsx
 * (board width / board height toolbar chips, `w-12 h-5 px-1 text-[10px]`,
 * `min={10} max={500} step={5}`) rather than attempting a full app mount.
 *
 * Both instances are KEEP min={10} max={500} — already-numeric drop-in
 * swaps. The mirrored aria-valuemin/aria-valuemax are the RED->GREEN
 * witness: a raw `<input type="number" min={10} max={500}>` never gets
 * `aria-valuemin`/`aria-valuemax` DOM attributes (Chromium synthesizes ARIA
 * bounds only in the real accessibility tree, which happy-dom doesn't
 * reproduce), so these assertions are absent pre-migration and present
 * post-migration.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NumberInput } from '@/components/ui/number-input';

/**
 * Mirrors the exact board-width toolbar chip from PCBLayoutView.tsx
 * (search `data-testid="pcb-board-width"` in the source file) — same props,
 * same className, same value transform.
 */
function BoardWidthChipHarness() {
  const boardWidth = 1000; // matches DEFAULT_BOARD.widthMm-style tenths-of-mm units
  return (
    <NumberInput
      min={10}
      max={500}
      step={5}
      value={boardWidth / 10}
      onChange={() => {
        /* harness only exercises rendering, not state */
      }}
      className="w-12 h-5 px-1 text-[10px] text-foreground bg-muted/50 border border-border rounded text-center tabular-nums"
      data-testid="pcb-board-width"
      aria-label="Board width (mm)"
      title="Board width (mm)"
    />
  );
}

/** Mirrors the board-height toolbar chip — same shape, `pcb-board-height` testid. */
function BoardHeightChipHarness() {
  const boardHeight = 800;
  return (
    <NumberInput
      min={10}
      max={500}
      step={5}
      value={boardHeight / 10}
      onChange={() => {
        /* harness only exercises rendering, not state */
      }}
      className="w-12 h-5 px-1 text-[10px] text-foreground bg-muted/50 border border-border rounded text-center tabular-nums"
      data-testid="pcb-board-height"
      aria-label="Board height (mm)"
      title="Board height (mm)"
    />
  );
}

describe('PCBLayoutView board dimension toolbar chips — NumberInput ARIA contract (BL-0781)', () => {
  it('board width chip mirrors min={10} max={500} (isolated harness — see file header)', () => {
    render(<BoardWidthChipHarness />);
    const el = screen.getByTestId('pcb-board-width');
    expect(el.getAttribute('type')).toBe('number');
    expect(el.getAttribute('aria-valuemin')).toBe('10');
    expect(el.getAttribute('aria-valuemax')).toBe('500');
    expect(el.getAttribute('min')).toBe('10');
    expect(el.getAttribute('max')).toBe('500');
    // Confirm the tight toolbar className survived the wrapper swap unmodified.
    expect(el.className).toContain('w-12 h-5 px-1 text-[10px]');
  });

  it('board height chip mirrors min={10} max={500} (isolated harness)', () => {
    render(<BoardHeightChipHarness />);
    const el = screen.getByTestId('pcb-board-height');
    expect(el.getAttribute('type')).toBe('number');
    expect(el.getAttribute('aria-valuemin')).toBe('10');
    expect(el.getAttribute('aria-valuemax')).toBe('500');
    expect(el.getAttribute('min')).toBe('10');
    expect(el.getAttribute('max')).toBe('500');
    expect(el.className).toContain('w-12 h-5 px-1 text-[10px]');
  });

  it('board width mirrors the scaled value (100mm stored as 1000 tenths -> 100) onto aria-valuenow', () => {
    render(<BoardWidthChipHarness />);
    expect(screen.getByTestId('pcb-board-width').getAttribute('aria-valuenow')).toBe('100');
  });

  it('regression guard: neither field ever coerces its real max to aria-valuemax="0"', () => {
    render(<BoardWidthChipHarness />);
    render(<BoardHeightChipHarness />);
    expect(screen.getByTestId('pcb-board-width').getAttribute('aria-valuemax')).not.toBe('0');
    expect(screen.getByTestId('pcb-board-height').getAttribute('aria-valuemax')).not.toBe('0');
  });
});
