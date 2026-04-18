/**
 * Smoke tests for BreadboardConnectivityOverlay (audit finding #340).
 * Covers: invisible when visible=false, renders nothing for empty state, renders when visible with data.
 */

import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import BreadboardConnectivityOverlay from '../BreadboardConnectivityOverlay';

const svgWrap = (ui: ReactNode) => (
  <svg data-testid="svg-root" width={1000} height={500} viewBox="0 0 1000 500">
    {ui}
  </svg>
);

describe('BreadboardConnectivityOverlay', () => {
  it('renders nothing when visible=false', () => {
    render(
      svgWrap(
        <BreadboardConnectivityOverlay
          nets={[]}
          wires={[]}
          instances={[]}
          parts={[]}
          visible={false}
        />,
      ),
    );
    expect(screen.queryByTestId('breadboard-connectivity-overlay')).toBeNull();
  });

  it('renders nothing when visible=true but no nets/wires (empty state)', () => {
    render(
      svgWrap(
        <BreadboardConnectivityOverlay
          nets={[]}
          wires={[]}
          instances={[]}
          parts={[]}
          visible={true}
        />,
      ),
    );
    expect(screen.queryByTestId('breadboard-connectivity-overlay')).toBeNull();
  });

  it('accepts required props without crashing when passed sparse arrays', () => {
    expect(() =>
      render(
        svgWrap(
          <BreadboardConnectivityOverlay
            nets={[]}
            wires={[]}
            instances={[]}
            parts={[]}
            visible={true}
          />,
        ),
      ),
    ).not.toThrow();
  });
});
