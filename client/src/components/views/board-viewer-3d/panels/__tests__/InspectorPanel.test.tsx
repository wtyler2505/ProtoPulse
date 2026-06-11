import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Component3D } from '@/lib/board-viewer-3d';
import { InspectorPanel } from '../InspectorPanel';

const component: Component3D = {
  id: 'component-42',
  refDes: 'U42',
  package: 'SOIC-8',
  position: { x: 34, y: 32, z: 0 },
  rotation: 90,
  side: 'top',
  bodyWidth: 5,
  bodyHeight: 6,
  bodyDepth: 1.75,
  color: '#20232a',
  label: 'Sensor interface',
  pins: [
    { id: 'pin-1', position: { x: -1, y: 0 }, diameter: 0.6, type: 'smd' },
    { id: 'pin-2', position: { x: 1, y: 0 }, diameter: 0.6, type: 'smd' },
  ],
};

describe('InspectorPanel', () => {
  it('renders selected component identity and geometry details', () => {
    render(<InspectorPanel component={component} onClear={vi.fn()} />);

    expect(screen.getByTestId('viewer-3d-webgl-inspector').getAttribute('data-selected-component-id')).toBe(
      'component-42',
    );
    expect(screen.getByText('U42')).toBeInTheDocument();
    expect(screen.getByText('Sensor interface')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-3d-webgl-inspector-package')).toHaveTextContent('SOIC-8');
    expect(screen.getByTestId('viewer-3d-webgl-inspector-pin-count')).toHaveTextContent('2');
  });

  it('calls onClear from the icon button', () => {
    const onClear = vi.fn();
    render(<InspectorPanel component={component} onClear={onClear} />);

    fireEvent.click(screen.getByTestId('viewer-3d-webgl-inspector-clear'));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
