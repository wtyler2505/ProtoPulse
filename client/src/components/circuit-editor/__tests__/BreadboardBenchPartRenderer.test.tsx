/**
 * Smoke tests for BreadboardBenchPartRenderer (audit finding #338).
 * Covers: returns null when no bench position, renders fallback when benched, click handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import BreadboardBenchPartRenderer from '../BreadboardBenchPartRenderer';
import type { CircuitInstanceRow } from '@shared/schema';

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 42,
    circuitId: 1,
    partId: 100,
    referenceDesignator: 'U1',
    designator: 'U1',
    instanceName: 'U1',
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    benchX: 500,
    benchY: 300,
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    rotation: 0,
    value: null,
    params: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as CircuitInstanceRow;
}

const svgWrap = (ui: React.ReactNode) => (
  <svg data-testid="svg-root" width={1000} height={600} viewBox="0 0 1000 600">
    {ui}
  </svg>
);

describe('BreadboardBenchPartRenderer', () => {
  it('returns null when benchX/benchY are unset', () => {
    const instance = makeInstance({ benchX: null, benchY: null });
    const { container } = render(
      svgWrap(<BreadboardBenchPartRenderer instance={instance} />),
    );
    expect(container.querySelector(`[data-testid^="bench-component-"]`)).toBeNull();
    expect(container.querySelector(`[data-testid^="bench-exact-view-"]`)).toBeNull();
  });

  it('renders fallback bench card when positioned and no exact view available', () => {
    const instance = makeInstance();
    render(svgWrap(<BreadboardBenchPartRenderer instance={instance} />));
    expect(screen.getByTestId(`bench-component-${instance.id}`)).toBeInTheDocument();
  });

  it('calls onClick with instance id when clicked', () => {
    const onClick = vi.fn();
    const instance = makeInstance();
    render(svgWrap(<BreadboardBenchPartRenderer instance={instance} onClick={onClick} />));
    fireEvent.click(screen.getByTestId(`bench-component-${instance.id}`));
    expect(onClick).toHaveBeenCalledWith(instance.id);
  });

  it('displays reference designator text', () => {
    const instance = makeInstance({ referenceDesignator: 'R7' });
    render(svgWrap(<BreadboardBenchPartRenderer instance={instance} />));
    // Ref-des may appear in multiple SVG text nodes (fallback card shows it twice).
    expect(screen.getAllByText('R7').length).toBeGreaterThan(0);
  });
});
