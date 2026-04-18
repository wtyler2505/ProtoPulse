/**
 * Smoke tests for BreadboardDrcOverlay (audit finding #339).
 * Covers: hidden when visible=false, empty state with no violations, no crash on empty data.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import BreadboardDrcOverlay from '../BreadboardDrcOverlay';

const svgWrap = (ui: React.ReactNode) => (
  <svg data-testid="svg-root" width={1000} height={500} viewBox="0 0 1000 500">
    {ui}
  </svg>
);

describe('BreadboardDrcOverlay', () => {
  it('renders nothing when visible=false', () => {
    render(
      svgWrap(
        <BreadboardDrcOverlay
          nets={[]}
          wires={[]}
          instances={[]}
          parts={[]}
          visible={false}
        />,
      ),
    );
    expect(screen.queryByTestId('breadboard-drc-overlay')).toBeNull();
  });

  it('renders nothing when no violations (empty state)', () => {
    render(
      svgWrap(
        <BreadboardDrcOverlay
          nets={[]}
          wires={[]}
          instances={[]}
          parts={[]}
          visible={true}
        />,
      ),
    );
    // With no data, DRC produces no violations, so overlay renders null.
    expect(screen.queryByTestId('breadboard-drc-overlay')).toBeNull();
  });

  it('accepts required props and does not throw', () => {
    expect(() =>
      render(
        svgWrap(
          <BreadboardDrcOverlay
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
