import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BreadboardGrid from '../BreadboardGrid';

const MIN_RENDERED_TIE_POINTS = 830;

describe('BreadboardGrid tie-point a11y (E2E-625)', () => {
  it('renders accessible tie-point roles and labels for terminals and rails', { timeout: 15000 }, () => {
    const { container } = render(<BreadboardGrid />);
    const holes = container.querySelectorAll('circle[data-testid^="hole-"]');

    expect(holes.length).toBeGreaterThanOrEqual(MIN_RENDERED_TIE_POINTS);

    for (const hole of holes) {
      const label = hole.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label?.length ?? 0).toBeGreaterThan(5);
      expect(hole.getAttribute('role')).toBe('button');
    }

    const hole = container.querySelector('[data-testid="hole-t:a1"]');
    expect(hole).not.toBeNull();
    expect(hole?.getAttribute('aria-label')).toMatch(/terminal column a, row 1/i);

    const rail = container.querySelector('[data-testid="hole-r:left_pos:0"]');
    expect(rail).not.toBeNull();
    expect(rail?.getAttribute('aria-label')).toMatch(/left positive rail/i);
    expect(rail?.getAttribute('aria-label')).toMatch(/point 1/i);
  });
});
