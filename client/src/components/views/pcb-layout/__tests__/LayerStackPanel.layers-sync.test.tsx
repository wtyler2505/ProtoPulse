/**
 * LayerStackPanel — Board-layers sync integration (E2E-233, Plan 02 Phase 6)
 *
 * Verifies that when the shared project board's layer count changes (Plan 02
 * Phase 4, `boards.layers`), driving the BoardStackup singleton via
 * `applyLayerCount(n)` makes the layer-visibility panel render one toggle
 * row per copper layer — not just top/bottom. This is the integration-level
 * regression for E2E-233: "PCB layer visibility panel doesn't show inner
 * layers on 4+ layer stacks."
 *
 * The pure helper behind this is covered in
 * client/src/lib/pcb/__tests__/derive-visible-layers.test.ts; this file
 * proves the end-to-end wiring: BoardStackup.applyLayerCount → panel DOM.
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BoardStackup } from '@/lib/board-stackup';

import { LayerStackPanel } from '../LayerStackPanel';

describe('LayerStackPanel — board layers sync (E2E-233)', () => {
  beforeEach(() => {
    BoardStackup.resetForTesting();
    // Clear persisted state so each test starts with an empty stackup.
    window.localStorage.clear();
  });

  afterEach(() => {
    BoardStackup.resetForTesting();
    window.localStorage.clear();
  });

  it('renders 2 copper-layer rows when applyLayerCount(2)', () => {
    act(() => {
      BoardStackup.getInstance().applyLayerCount(2);
    });
    render(<LayerStackPanel activeLayer="F.Cu" onLayerSelect={() => undefined} />);
    const layers = BoardStackup.getInstance().getAllLayers();
    expect(layers).toHaveLength(2);
    // One copper-layer row per layer
    for (const l of layers) {
      expect(screen.getByTestId(`copper-layer-${l.id}`)).toBeDefined();
    }
  });

  it('renders 4 copper-layer rows (incl. 2 inner) when applyLayerCount(4)', () => {
    act(() => {
      BoardStackup.getInstance().applyLayerCount(4);
    });
    render(<LayerStackPanel activeLayer="F.Cu" onLayerSelect={() => undefined} />);
    const layers = BoardStackup.getInstance().getAllLayers();
    expect(layers).toHaveLength(4);
    for (const l of layers) {
      expect(screen.getByTestId(`copper-layer-${l.id}`)).toBeDefined();
    }
    // Summary reflects the new count
    expect(screen.getByTestId('layer-count').textContent).toContain('4');
  });

  it('renders 6 copper-layer rows when applyLayerCount(6)', () => {
    act(() => {
      BoardStackup.getInstance().applyLayerCount(6);
    });
    render(<LayerStackPanel activeLayer="F.Cu" onLayerSelect={() => undefined} />);
    expect(BoardStackup.getInstance().getAllLayers()).toHaveLength(6);
    expect(screen.getByTestId('layer-count').textContent).toContain('6');
  });

  it('re-renders when the stackup is later grown from 2 → 4', () => {
    act(() => {
      BoardStackup.getInstance().applyLayerCount(2);
    });
    const { rerender } = render(
      <LayerStackPanel activeLayer="F.Cu" onLayerSelect={() => undefined} />,
    );
    expect(BoardStackup.getInstance().getAllLayers()).toHaveLength(2);

    act(() => {
      BoardStackup.getInstance().applyLayerCount(4);
    });
    rerender(<LayerStackPanel activeLayer="F.Cu" onLayerSelect={() => undefined} />);
    expect(BoardStackup.getInstance().getAllLayers()).toHaveLength(4);
    expect(screen.getByTestId('layer-count').textContent).toContain('4');
  });
});
