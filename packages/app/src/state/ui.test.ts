import { describe, expect, it } from 'vitest';

import { DEPTH_STORAGE_KEY, loadDepth, storeDepth, useUi } from './ui.js';

import type { StorageLike } from './ui.js';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('teaching-depth persistence (localStorage "pp-depth")', () => {
  it('defaults to show-me when nothing is stored', () => {
    expect(loadDepth(fakeStorage())).toBe('show-me');
    expect(loadDepth(null)).toBe('show-me');
  });

  it('round-trips through storage', () => {
    const storage = fakeStorage();
    storeDepth('teach-me', storage);
    expect(storage.data[DEPTH_STORAGE_KEY]).toBe('teach-me');
    expect(loadDepth(storage)).toBe('teach-me');
    storeDepth('do-it', storage);
    expect(loadDepth(storage)).toBe('do-it');
  });

  it('falls back to show-me on garbage stored values', () => {
    expect(loadDepth(fakeStorage({ [DEPTH_STORAGE_KEY]: 'omniscient' }))).toBe('show-me');
    expect(loadDepth(fakeStorage({ [DEPTH_STORAGE_KEY]: '' }))).toBe('show-me');
  });

  it('survives a throwing storage (privacy mode)', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadDepth(broken)).toBe('show-me');
    expect(() => { storeDepth('teach-me', broken); }).not.toThrow();
  });
});

describe('useUi store (node — no DOM, no localStorage)', () => {
  it('boots with the default depth and updates through setTeachingDepth', () => {
    expect(useUi.getState().teachingDepth).toBe('show-me');
    useUi.getState().setTeachingDepth('teach-me');
    expect(useUi.getState().teachingDepth).toBe('teach-me');
    useUi.getState().setTeachingDepth('show-me');
  });

  it('askProfessor seeds the prompt AND switches to the professor tab', () => {
    useUi.getState().askProfessor('Explain [warn] REV-NO-DECOUPLING — …');
    const s = useUi.getState();
    expect(s.activeTab).toBe('professor');
    expect(s.professorSeed).toBe('Explain [warn] REV-NO-DECOUPLING — …');
  });

  it('consumeProfessorSeed hands the seed over exactly once', () => {
    useUi.getState().askProfessor('once');
    expect(useUi.getState().consumeProfessorSeed()).toBe('once');
    expect(useUi.getState().professorSeed).toBeNull();
    expect(useUi.getState().consumeProfessorSeed()).toBeNull();
  });

  it('flashStatus sets the line and bumps the seq; clear is seq-guarded', () => {
    const before = useUi.getState().statusFlashSeq;
    useUi.getState().flashStatus('Applied fix for REV-A');
    const afterFirst = useUi.getState();
    expect(afterFirst.statusFlash).toBe('Applied fix for REV-A');
    expect(afterFirst.statusFlashSeq).toBe(before + 1);

    // A newer flash supersedes; the stale timer's clear must be a no-op.
    useUi.getState().flashStatus('Applied fix for REV-B');
    useUi.getState().clearStatusFlash(before + 1); // stale seq
    expect(useUi.getState().statusFlash).toBe('Applied fix for REV-B');
    useUi.getState().clearStatusFlash(before + 2); // current seq
    expect(useUi.getState().statusFlash).toBeNull();
  });
});
