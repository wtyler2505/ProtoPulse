import { describe, expect, it } from 'vitest';

import { asErcAnchor, asErcAnchors } from './anchors.js';
import { codeToConceptSlug, REV_CODES, reviewConceptFor } from './concepts.js';

describe('reviewConceptFor', () => {
  it('resolves ERC-* codes through the erc package map', () => {
    expect(reviewConceptFor('ERC-OC-NO-PULLUP')?.conceptSlug).toBe('pull-up-pull-down');
  });

  it('resolves REV-* codes through the panel-owned map', () => {
    expect(reviewConceptFor('REV-NO-DECOUPLING')?.conceptSlug).toBe('power-and-heat');
    expect(reviewConceptFor('REV-TOLERANCE-STACK')?.conceptSlug).toBe('tolerance-stacking');
  });

  it('returns undefined for unmapped codes', () => {
    expect(reviewConceptFor('REV-FROM-THE-FUTURE')).toBeUndefined();
    expect(codeToConceptSlug('REV-FROM-THE-FUTURE')).toBeUndefined();
  });

  it('every REV mapping points at an article slug shaped like the wiki uses', () => {
    for (const info of Object.values(REV_CODES)) {
      expect(info.conceptSlug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(info.title.length).toBeGreaterThan(0);
    }
  });
});

describe('asErcAnchor (pinned review anchors → canvas anchors)', () => {
  it('narrows net/component/port anchors', () => {
    expect(asErcAnchor({ kind: 'net', netId: 'n1' })).toEqual({ kind: 'net', netId: 'n1' });
    expect(asErcAnchor({ kind: 'component', componentId: 'c1' })).toEqual({
      kind: 'component',
      componentId: 'c1',
    });
    expect(asErcAnchor({ kind: 'port', port: 'c1:2' })).toEqual({ kind: 'port', port: 'c1:2' });
  });

  it('rejects unknown kinds and malformed fields without throwing', () => {
    expect(asErcAnchor({ kind: 'board-region', x: 1 })).toBeNull();
    expect(asErcAnchor({ kind: 'net' })).toBeNull();
    expect(asErcAnchor({ kind: 'component', componentId: 7 })).toBeNull();
    expect(
      asErcAnchors([
        { kind: 'net', netId: 'n1' },
        { kind: 'board-region' },
        { kind: 'port', port: 'c1:1' },
      ]),
    ).toHaveLength(2);
  });
});
