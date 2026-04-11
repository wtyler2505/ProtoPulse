import { describe, expect, it } from 'vitest';

import { alwaysVisibleIds } from '../sidebar-constants';

describe('alwaysVisibleIds', () => {
  it('keeps procurement reachable before a design graph exists', () => {
    expect(alwaysVisibleIds.has('procurement')).toBe(true);
  });

  it('keeps storage (inventory) reachable before a design graph exists', () => {
    expect(alwaysVisibleIds.has('storage')).toBe(true);
  });
});
