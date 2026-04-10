import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BreadboardConnectivityExplainer from '../BreadboardConnectivityExplainer';

describe('BreadboardConnectivityExplainer', () => {
  it('renders the explainer root element', () => {
    render(
      <svg>
        <BreadboardConnectivityExplainer />
      </svg>,
    );
    expect(screen.getByTestId('connectivity-explainer')).toBeInTheDocument();
  });

  it('renders left-side row group annotations (a-e)', () => {
    render(
      <svg>
        <BreadboardConnectivityExplainer />
      </svg>,
    );
    const leftGroups = screen.getAllByTestId(/^row-group-left-/);
    // Should have one group per row (63 rows)
    expect(leftGroups.length).toBe(63);
  });

  it('renders right-side row group annotations (f-j)', () => {
    render(
      <svg>
        <BreadboardConnectivityExplainer />
      </svg>,
    );
    const rightGroups = screen.getAllByTestId(/^row-group-right-/);
    expect(rightGroups.length).toBe(63);
  });

  it('renders power rail markers', () => {
    render(
      <svg>
        <BreadboardConnectivityExplainer />
      </svg>,
    );
    expect(screen.getByTestId('power-rail-top-pos')).toBeInTheDocument();
    expect(screen.getByTestId('power-rail-top-neg')).toBeInTheDocument();
    expect(screen.getByTestId('power-rail-bottom-pos')).toBeInTheDocument();
    expect(screen.getByTestId('power-rail-bottom-neg')).toBeInTheDocument();
  });

  it('renders center channel annotation', () => {
    render(
      <svg>
        <BreadboardConnectivityExplainer />
      </svg>,
    );
    expect(screen.getByTestId('center-channel')).toBeInTheDocument();
  });

  it('renders behind content (low opacity)', () => {
    render(
      <svg>
        <BreadboardConnectivityExplainer />
      </svg>,
    );
    const root = screen.getByTestId('connectivity-explainer');
    expect(root.getAttribute('opacity')).toBeTruthy();
    const opacity = parseFloat(root.getAttribute('opacity') ?? '1');
    expect(opacity).toBeLessThanOrEqual(0.6);
  });

  it('applies visible prop to show/hide', () => {
    const { rerender } = render(
      <svg>
        <BreadboardConnectivityExplainer visible={false} />
      </svg>,
    );
    expect(screen.getByTestId('connectivity-explainer').getAttribute('opacity')).toBe('0');

    rerender(
      <svg>
        <BreadboardConnectivityExplainer visible={true} />
      </svg>,
    );
    const opacity = parseFloat(
      screen.getByTestId('connectivity-explainer').getAttribute('opacity') ?? '0',
    );
    expect(opacity).toBeGreaterThan(0);
  });

  it('renders + and - labels on power rails', () => {
    render(
      <svg>
        <BreadboardConnectivityExplainer />
      </svg>,
    );
    const plusLabels = screen.getAllByText('+');
    const minusLabels = screen.getAllByText('-');
    expect(plusLabels.length).toBeGreaterThanOrEqual(2);
    expect(minusLabels.length).toBeGreaterThanOrEqual(2);
  });
});
