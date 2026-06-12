import { describe, expect, it } from 'vitest';

import {
  CONCEPT_PAUSE_MARKER,
  isTeachingDepth,
  narrationFor,
  stripConceptPause,
  TEACHING_DEPTHS,
  wantsConceptPause,
} from './depth.js';

describe('narrationFor (the depth dial)', () => {
  it('do-it says nothing', () => {
    expect(narrationFor('do-it', 'Connected R1:2 to GND')).toBeNull();
  });

  it('show-me narrates the explain line verbatim', () => {
    expect(narrationFor('show-me', 'Connected R1:2 to GND')).toBe('Connected R1:2 to GND');
  });

  it('teach-me narrates AND marks that a concept pause is wanted', () => {
    const line = narrationFor('teach-me', 'Connected R1:2 to GND');
    expect(line).not.toBeNull();
    expect(line).toContain('Connected R1:2 to GND');
    expect(line).toContain(CONCEPT_PAUSE_MARKER);
    expect(wantsConceptPause(line ?? '')).toBe(true);
  });

  it('show-me narration never carries the pause marker', () => {
    expect(wantsConceptPause(narrationFor('show-me', 'moved C1') ?? '')).toBe(false);
  });

  it('stripConceptPause removes the marker and trailing space', () => {
    const line = narrationFor('teach-me', 'Renamed net N1 to VOUT');
    expect(stripConceptPause(line ?? '')).toBe('Renamed net N1 to VOUT');
    // No-op on unmarked lines.
    expect(stripConceptPause('plain line')).toBe('plain line');
  });
});

describe('TeachingDepth helpers', () => {
  it('lists exactly the three dial positions', () => {
    expect(TEACHING_DEPTHS).toEqual(['do-it', 'show-me', 'teach-me']);
  });

  it('isTeachingDepth guards persisted values', () => {
    expect(isTeachingDepth('do-it')).toBe(true);
    expect(isTeachingDepth('show-me')).toBe(true);
    expect(isTeachingDepth('teach-me')).toBe(true);
    expect(isTeachingDepth('lecture-mode')).toBe(false);
    expect(isTeachingDepth(null)).toBe(false);
    expect(isTeachingDepth(2)).toBe(false);
  });
});
