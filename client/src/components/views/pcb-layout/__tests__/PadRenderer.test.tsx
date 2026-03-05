import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PadRenderer } from '../PadRenderer';
import type { Pad } from '@/lib/pcb/footprint-library';

const makePad = (overrides: Partial<Pad> = {}): Pad => ({
  number: 1,
  type: 'smd',
  shape: 'rect',
  position: { x: 0, y: 0 },
  width: 1.2,
  height: 0.6,
  layer: 'front',
  ...overrides,
});

describe('PadRenderer', () => {
  it('renders SMD rect pad as SVG rect', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad()}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const rect = container.querySelector('rect[data-testid="pad-1"]');
    expect(rect).not.toBeNull();
  });

  it('renders SMD circle pad as SVG circle', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ shape: 'circle', width: 1.0, height: 1.0 })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const circle = container.querySelector('circle[data-testid="pad-1"]');
    expect(circle).not.toBeNull();
  });

  it('renders THT pad with drill hole', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ type: 'tht', shape: 'circle', width: 1.6, height: 1.6, drill: 0.8, layer: 'both' })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });

  it('renders THT oblong pad with drill hole', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ type: 'tht', shape: 'oblong', width: 1.8, height: 1.0, drill: 0.8, layer: 'both' })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="pad-group-1"]');
    expect(group).not.toBeNull();
    // THT oblong: outer rect with rx + inner circle for drill
    const rects = group!.querySelectorAll('rect');
    const circles = group!.querySelectorAll('circle');
    expect(rects.length).toBeGreaterThanOrEqual(1);
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });

  it('dims pad when on inactive layer', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ layer: 'back' })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="pad-group-1"]');
    expect(group?.getAttribute('opacity')).toBe('0.3');
  });

  it('does not dim THT pad (layer=both) regardless of active layer', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ type: 'tht', shape: 'circle', width: 1.6, height: 1.6, drill: 0.8, layer: 'both' })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="back"
        />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="pad-group-1"]');
    const opacity = group?.getAttribute('opacity');
    expect(opacity === null || opacity === '1').toBe(true);
  });

  it('highlights pad when selected', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad()}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={true}
          activeLayer="front"
        />
      </svg>,
    );
    const highlight = container.querySelector('[data-testid="pad-highlight-1"]');
    expect(highlight).not.toBeNull();
  });

  it('does not render highlight when not selected', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad()}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const highlight = container.querySelector('[data-testid="pad-highlight-1"]');
    expect(highlight).toBeNull();
  });

  it('applies rotation transform', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ position: { x: 1, y: 0 } })}
          componentX={10}
          componentY={10}
          rotation={90}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="pad-group-1"]');
    expect(group?.getAttribute('transform')).toContain('rotate');
  });

  it('does not apply rotation when rotation is 0', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ position: { x: 1, y: 0 } })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="pad-group-1"]');
    const transform = group?.getAttribute('transform') ?? '';
    expect(transform).not.toContain('rotate');
  });

  it('renders solder mask outline when solderMaskExpansion is set', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ solderMaskExpansion: 0.05 })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const maskOutline = container.querySelector('[data-testid="pad-mask-1"]');
    expect(maskOutline).not.toBeNull();
  });

  it('uses red color for front layer pads', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ layer: 'front' })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
        />
      </svg>,
    );
    const rect = container.querySelector('rect[data-testid="pad-1"]');
    expect(rect?.getAttribute('stroke')).toBe('#ef4444');
  });

  it('uses blue color for back layer pads', () => {
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ layer: 'back' })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="back"
        />
      </svg>,
    );
    const rect = container.querySelector('rect[data-testid="pad-1"]');
    expect(rect?.getAttribute('stroke')).toBe('#3b82f6');
  });

  it('calls onPadClick when pad is clicked', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <svg>
        <PadRenderer
          pad={makePad({ number: 3 })}
          componentX={10}
          componentY={10}
          rotation={0}
          scale={10}
          selected={false}
          activeLayer="front"
          onPadClick={handleClick}
        />
      </svg>,
    );
    const group = container.querySelector('g[data-testid="pad-group-3"]');
    group?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handleClick).toHaveBeenCalledWith(3);
  });
});
