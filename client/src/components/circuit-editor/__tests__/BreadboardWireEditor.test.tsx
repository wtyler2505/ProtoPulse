import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import BreadboardWireEditor from '../BreadboardWireEditor';

describe('BreadboardWireEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
      configurable: true,
      value: () => ({
        inverse: () => ({}),
      }),
    });

    Object.defineProperty(SVGSVGElement.prototype, 'createSVGPoint', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      }),
    });
  });

  it('previews and commits snapped endpoint targets during drag', () => {
    const onMoveEndpoint = vi.fn();

    render(
      <svg data-testid="breadboard-svg">
        <BreadboardWireEditor
          wires={[
            {
              id: 1,
              view: 'breadboard',
              points: [{ x: 10, y: 10 }, { x: 40, y: 10 }],
              width: 1.5,
              color: '#3498db',
            },
          ]}
          selectedWireId={1}
          onSelectWire={vi.fn()}
          onDeleteWire={vi.fn()}
          onMoveEndpoint={onMoveEndpoint}
          resolveEndpointTarget={(pos) => (
            Math.abs(pos.x - 24) < 1 && Math.abs(pos.y - 24) < 1
              ? { x: 30, y: 30 }
              : pos
          )}
          zoom={1}
          active
        />
      </svg>,
    );

    fireEvent.mouseDown(screen.getByTestId('wire-handle-start'), { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 24, clientY: 24 });

    expect(screen.getByTestId('wire-snap-preview')).toBeInTheDocument();
    expect(screen.getByTestId('wire-handle-start')).toHaveAttribute('cx', '30');
    expect(screen.getByTestId('wire-handle-start')).toHaveAttribute('cy', '30');

    fireEvent.mouseUp(window, { clientX: 24, clientY: 24 });

    expect(onMoveEndpoint).toHaveBeenCalledWith(1, 'start', { x: 30, y: 30 });
  });
});
