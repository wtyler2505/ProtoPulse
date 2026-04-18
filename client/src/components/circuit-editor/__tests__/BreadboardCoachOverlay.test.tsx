/**
 * Smoke tests for BreadboardCoachOverlay (audit finding #341).
 *
 * This file exports multiple pieces: getPinRoleColor helper,
 * CoachSuggestionOverlay, BreadboardCoachPlanOverlay, BreadboardPinAnchorOverlay.
 * Tests cover the pure helper + smoke render of each overlay with minimal fixtures.
 */

import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  getPinRoleColor,
  BreadboardCoachPlanOverlay,
  BreadboardPinAnchorOverlay,
  CoachSuggestionOverlay,
} from '../BreadboardCoachOverlay';
import type { BreadboardCoachPlan } from '@/lib/breadboard-coach-plan';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';

const svgWrap = (ui: ReactNode) => (
  <svg data-testid="svg-root" width={1000} height={500} viewBox="0 0 1000 500">
    {ui}
  </svg>
);

describe('getPinRoleColor', () => {
  it('returns distinct colors per role', () => {
    const colors = new Set([
      getPinRoleColor('power'),
      getPinRoleColor('ground'),
      getPinRoleColor('clock'),
      getPinRoleColor('control'),
      getPinRoleColor('communication'),
      getPinRoleColor('analog'),
      getPinRoleColor('passive'),
      getPinRoleColor('signal'),
    ]);
    expect(colors.size).toBe(8);
  });

  it('falls back to signal color for unknown role', () => {
    // @ts-expect-error — testing fallback
    expect(getPinRoleColor('unknown-role')).toBe(getPinRoleColor('signal'));
  });
});

const emptyPlan: BreadboardCoachPlan = {
  bridges: [],
  headline: '',
  corridorHints: [],
  highlightedPinIds: [],
  hookups: [],
  suggestions: [],
  verifiedBoardCautions: [],
};

describe('BreadboardCoachPlanOverlay', () => {
  it('renders the overlay root group with empty plan', () => {
    render(
      svgWrap(
        <BreadboardCoachPlanOverlay
          coachPlan={emptyPlan}
          preparedCoachHookups={[]}
          preparedCoachBridges={[]}
          stagedCoachSuggestions={[]}
          resolvedCoachSuggestions={[]}
        />,
      ),
    );
    expect(screen.getByTestId('breadboard-coach-plan-overlay')).toBeInTheDocument();
  });
});

describe('BreadboardPinAnchorOverlay', () => {
  it('returns null when selected instance has no pins', () => {
    const model = {
      pins: [],
    } as unknown as BreadboardSelectedPartModel;
    const { container } = render(
      svgWrap(
        <BreadboardPinAnchorOverlay
          selectedInstanceModel={model}
          hoveredInspectorPinId={null}
          coachPlanVisible={false}
          coachPlan={null}
        />,
      ),
    );
    expect(container.querySelector('[data-testid="breadboard-pin-anchor-overlay"]')).toBeNull();
  });
});

describe('CoachSuggestionOverlay', () => {
  it('renders a suggestion group with test id', () => {
    render(
      svgWrap(
        <CoachSuggestionOverlay
          suggestion={{
            id: 'sug-1',
            label: 'Add bypass cap',
            priority: 'critical',
            type: 'capacitor',
            value: '0.1uF',
            pixel: { x: 100, y: 100 },
            targetPixels: [{ x: 150, y: 150 }],
          }}
          status="pending"
        />,
      ),
    );
    expect(screen.getByTestId('breadboard-coach-suggestion-sug-1')).toBeInTheDocument();
  });
});
