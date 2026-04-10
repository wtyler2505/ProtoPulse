/**
 * BreadboardGrid fit-zone overlay tests.
 *
 * Tests for the fitZones prop on BreadboardGrid that highlights where large
 * components can be placed.
 *
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BreadboardGrid from '../BreadboardGrid';
import type { FitZone } from '../BreadboardGrid';

describe('BreadboardGrid fitZones', () => {
  it('renders no fit-zone overlay when fitZones is undefined', { timeout: 15000 }, () => {
    render(<BreadboardGrid />);
    expect(screen.queryByTestId('fit-zone-overlay')).toBeNull();
  });

  it('renders no fit-zone overlay when fitZones is empty', { timeout: 15000 }, () => {
    render(<BreadboardGrid fitZones={[]} />);
    expect(screen.queryByTestId('fit-zone-overlay')).toBeNull();
  });

  it('renders fit-zone rectangles for each zone', { timeout: 15000 }, () => {
    const zones: FitZone[] = [
      { startRow: 1, rowSpan: 4, crossesChannel: true, startCol: 'e' },
      { startRow: 10, rowSpan: 4, crossesChannel: true, startCol: 'e' },
    ];
    render(<BreadboardGrid fitZones={zones} />);
    const overlay = screen.getByTestId('fit-zone-overlay');
    expect(overlay).toBeTruthy();
    expect(screen.getByTestId('fit-zone-1')).toBeTruthy();
    expect(screen.getByTestId('fit-zone-10')).toBeTruthy();
  });

  it('renders fit zones with dashed stroke', { timeout: 15000 }, () => {
    const zones: FitZone[] = [
      { startRow: 5, rowSpan: 2, crossesChannel: false, startCol: 'a' },
    ];
    render(<BreadboardGrid fitZones={zones} />);
    const zone = screen.getByTestId('fit-zone-5');
    expect(zone.getAttribute('stroke-dasharray')).toBeTruthy();
  });
});
