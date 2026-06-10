import { describe, expect, it } from 'vitest';

import { narrateApply, narrationPlan } from './narration.js';
import { useUi } from './ui.js';

describe('narrationPlan (pure depth routing)', () => {
  it('do-it stays silent — no flash, no concept', () => {
    expect(narrationPlan('do-it', 'Applied fix for REV-A', 'power-and-heat')).toEqual({
      flash: null,
      openConcept: null,
    });
  });

  it('show-me flashes the line but never pauses on a concept', () => {
    expect(narrationPlan('show-me', 'Applied fix for REV-A', 'power-and-heat')).toEqual({
      flash: 'Applied fix for REV-A',
      openConcept: null,
    });
  });

  it('teach-me flashes a clean line (marker stripped) AND opens the concept', () => {
    expect(narrationPlan('teach-me', 'Applied fix for REV-A', 'power-and-heat')).toEqual({
      flash: 'Applied fix for REV-A',
      openConcept: 'power-and-heat',
    });
  });

  it('teach-me without a known concept still flashes, pauses nowhere', () => {
    expect(narrationPlan('teach-me', 'Applied fix for REV-X')).toEqual({
      flash: 'Applied fix for REV-X',
      openConcept: null,
    });
  });
});

describe('narrateApply (routes through the CURRENT dial into ui state)', () => {
  it('show-me flashes the status bar', () => {
    useUi.getState().setTeachingDepth('show-me');
    narrateApply('Applied fix for ERC-OC-NO-PULLUP: missing pull-up', 'pull-up-pull-down');
    expect(useUi.getState().statusFlash).toBe('Applied fix for ERC-OC-NO-PULLUP: missing pull-up');
    expect(useUi.getState().conceptSlug).toBeNull();
    useUi.getState().clearStatusFlash(useUi.getState().statusFlashSeq);
  });

  it('teach-me also opens the concept viewer (the concept pause)', () => {
    useUi.getState().setTeachingDepth('teach-me');
    narrateApply('Applied fix for ERC-OC-NO-PULLUP: missing pull-up', 'pull-up-pull-down');
    expect(useUi.getState().statusFlash).toBe('Applied fix for ERC-OC-NO-PULLUP: missing pull-up');
    expect(useUi.getState().conceptSlug).toBe('pull-up-pull-down');
    useUi.getState().closeConcept();
    useUi.getState().clearStatusFlash(useUi.getState().statusFlashSeq);
  });

  it('do-it leaves the UI untouched', () => {
    useUi.getState().setTeachingDepth('do-it');
    const seqBefore = useUi.getState().statusFlashSeq;
    narrateApply('Applied fix for ERC-OC-NO-PULLUP: missing pull-up', 'pull-up-pull-down');
    expect(useUi.getState().statusFlash).toBeNull();
    expect(useUi.getState().statusFlashSeq).toBe(seqBefore);
    expect(useUi.getState().conceptSlug).toBeNull();
    useUi.getState().setTeachingDepth('show-me');
  });
});
