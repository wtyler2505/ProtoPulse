/**
 * ViaRenderer tests — Verifies SVG rendering of PCB vias:
 * copper rings, drill holes, tented overlays, selection highlights,
 * via-type coloring, click handlers, and ViaOverlay multi-via rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ViaRenderer, ViaOverlay } from '../ViaRenderer';

// ---------------------------------------------------------------------------
// Via type defined inline (via-model.ts is being created in parallel)
// ---------------------------------------------------------------------------

type ViaType = 'through' | 'blind' | 'buried' | 'micro';

interface Via {
  id: string;
  position: { x: number; y: number };
  drillDiameter: number;
  outerDiameter: number;
  type: ViaType;
  fromLayer: string;
  toLayer: string;
  netId?: number;
  tented: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const makeVia = (overrides: Partial<Via> = {}): Via => ({
  id: 'via-1',
  position: { x: 15, y: 25 },
  drillDiameter: 0.3,
  outerDiameter: 0.6,
  type: 'through',
  fromLayer: 'F.Cu',
  toLayer: 'B.Cu',
  tented: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// ViaRenderer — single via
// ---------------------------------------------------------------------------

describe('ViaRenderer', () => {
  it('renders via with correct position (translate transform)', () => {
    const via = makeVia({ position: { x: 10, y: 20 } });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="via-via-1"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute('transform')).toBe('translate(10, 20)');
  });

  it('renders copper ring with correct radius (outerDiameter/2)', () => {
    const via = makeVia({ outerDiameter: 0.8 });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const copper = container.querySelector('circle[data-testid="via-copper-via-1"]');
    expect(copper).not.toBeNull();
    expect(copper?.getAttribute('r')).toBe('0.4');
  });

  it('renders drill hole with correct radius (drillDiameter/2)', () => {
    const via = makeVia({ drillDiameter: 0.4 });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const drill = container.querySelector('circle[data-testid="via-drill-via-1"]');
    expect(drill).not.toBeNull();
    expect(drill?.getAttribute('r')).toBe('0.2');
  });

  it('shows tented overlay when tented=true', () => {
    const via = makeVia({ tented: true });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const tent = container.querySelector('circle[data-testid="via-tent-via-1"]');
    expect(tent).not.toBeNull();
    expect(tent?.getAttribute('fill')).toBe('#22c55e40');
  });

  it('hides tented overlay when tented=false', () => {
    const via = makeVia({ tented: false });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const tent = container.querySelector('circle[data-testid="via-tent-via-1"]');
    expect(tent).toBeNull();
  });

  it('shows selection highlight when selected=true', () => {
    const via = makeVia({ outerDiameter: 0.6 });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={true} />
      </svg>,
    );
    const highlight = container.querySelector('circle[data-testid="via-highlight-via-1"]');
    expect(highlight).not.toBeNull();
    expect(highlight?.getAttribute('stroke')).toBe('#00F0FF');
    expect(highlight?.getAttribute('stroke-width')).toBe('0.3');
    expect(highlight?.getAttribute('fill')).toBe('none');
    // Highlight radius = outerDiameter/2 + 0.15
    expect(highlight?.getAttribute('r')).toBe('0.45');
  });

  it('hides selection highlight when selected=false', () => {
    const via = makeVia();
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const highlight = container.querySelector('circle[data-testid="via-highlight-via-1"]');
    expect(highlight).toBeNull();
  });

  it('uses correct color for through via (#c8a832)', () => {
    const via = makeVia({ type: 'through' });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const copper = container.querySelector('circle[data-testid="via-copper-via-1"]');
    expect(copper?.getAttribute('fill')).toBe('#c8a832');
  });

  it('uses correct color for blind via (#9370DB)', () => {
    const via = makeVia({ type: 'blind' });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const copper = container.querySelector('circle[data-testid="via-copper-via-1"]');
    expect(copper?.getAttribute('fill')).toBe('#9370DB');
  });

  it('uses correct color for buried via (#2F4F4F)', () => {
    const via = makeVia({ type: 'buried' });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const copper = container.querySelector('circle[data-testid="via-copper-via-1"]');
    expect(copper?.getAttribute('fill')).toBe('#2F4F4F');
  });

  it('uses correct color for micro via (#20B2AA)', () => {
    const via = makeVia({ type: 'micro' });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const copper = container.querySelector('circle[data-testid="via-copper-via-1"]');
    expect(copper?.getAttribute('fill')).toBe('#20B2AA');
  });

  it('calls onViaClick with via id when clicked', () => {
    const handleClick = vi.fn();
    const via = makeVia({ id: 'via-42' });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} onViaClick={handleClick} />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="via-via-42"]');
    expect(group).not.toBeNull();
    fireEvent.click(group!);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith('via-42', expect.any(Object));
  });

  it('renders cross marker lines in drill hole', () => {
    const via = makeVia({ drillDiameter: 0.4 });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="via-via-1"]');
    const lines = group?.querySelectorAll('line');
    expect(lines?.length).toBe(2);
    // Horizontal line: x1=-drillDiameter/4, x2=drillDiameter/4
    const hLine = lines![0];
    expect(hLine.getAttribute('x1')).toBe('-0.1');
    expect(hLine.getAttribute('x2')).toBe('0.1');
    expect(hLine.getAttribute('y1')).toBe('0');
    expect(hLine.getAttribute('y2')).toBe('0');
    // Vertical line: y1=-drillDiameter/4, y2=drillDiameter/4
    const vLine = lines![1];
    expect(vLine.getAttribute('x1')).toBe('0');
    expect(vLine.getAttribute('x2')).toBe('0');
    expect(vLine.getAttribute('y1')).toBe('-0.1');
    expect(vLine.getAttribute('y2')).toBe('0.1');
  });

  it('has data-testid attributes on all elements', () => {
    const via = makeVia({ id: 'test-via', tented: true });
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={true} />
      </svg>,
    );
    expect(container.querySelector('[data-testid="via-test-via"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="via-copper-test-via"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="via-drill-test-via"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="via-tent-test-via"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="via-highlight-test-via"]')).not.toBeNull();
  });

  it('drill hole uses board background color', () => {
    const via = makeVia();
    const { container } = render(
      <svg>
        <ViaRenderer via={via} selected={false} />
      </svg>,
    );
    const drill = container.querySelector('circle[data-testid="via-drill-via-1"]');
    expect(drill?.getAttribute('fill')).toBe('#1a1a1a');
  });
});

// ---------------------------------------------------------------------------
// ViaOverlay — multiple vias
// ---------------------------------------------------------------------------

describe('ViaOverlay', () => {
  it('renders multiple vias', () => {
    const vias = [
      makeVia({ id: 'v1', position: { x: 5, y: 10 } }),
      makeVia({ id: 'v2', position: { x: 20, y: 30 } }),
      makeVia({ id: 'v3', position: { x: 40, y: 50 } }),
    ];
    const { container } = render(
      <svg>
        <ViaOverlay vias={vias} selectedViaId={null} />
      </svg>,
    );
    expect(container.querySelector('[data-testid="via-v1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="via-v2"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="via-v3"]')).not.toBeNull();
  });

  it('passes selectedViaId to correct via', () => {
    const vias = [
      makeVia({ id: 'v1', position: { x: 5, y: 10 } }),
      makeVia({ id: 'v2', position: { x: 20, y: 30 } }),
    ];
    const { container } = render(
      <svg>
        <ViaOverlay vias={vias} selectedViaId="v2" />
      </svg>,
    );
    // v2 should have highlight, v1 should not
    expect(container.querySelector('[data-testid="via-highlight-v2"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="via-highlight-v1"]')).toBeNull();
  });

  it('forwards onViaClick to individual vias', () => {
    const handleClick = vi.fn();
    const vias = [
      makeVia({ id: 'v1', position: { x: 5, y: 10 } }),
      makeVia({ id: 'v2', position: { x: 20, y: 30 } }),
    ];
    const { container } = render(
      <svg>
        <ViaOverlay vias={vias} selectedViaId={null} onViaClick={handleClick} />
      </svg>,
    );
    const v1Group = container.querySelector('g[data-testid="via-v1"]');
    fireEvent.click(v1Group!);
    expect(handleClick).toHaveBeenCalledWith('v1', expect.any(Object));
  });

  it('renders empty when vias array is empty', () => {
    const { container } = render(
      <svg>
        <ViaOverlay vias={[]} selectedViaId={null} />
      </svg>,
    );
    const overlay = container.querySelector('g[data-testid="via-overlay"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.children.length).toBe(0);
  });
});
