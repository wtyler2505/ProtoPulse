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

describe('PCB view-mode state (v0.4)', () => {
  it('boots on the schematic with select tools and F.Cu active', () => {
    useUi.setState({
      viewMode: 'schematic',
      pcbTool: 'select',
      pcbPlaceComponentId: null,
      activeLayer: 'F.Cu',
      activeTab: 'inspector',
    });
    const s = useUi.getState();
    expect(s.viewMode).toBe('schematic');
    expect(s.pcbTool).toBe('select');
    expect(s.activeLayer).toBe('F.Cu');
  });

  it('setViewMode resets both canvases to their neutral tool', () => {
    useUi.getState().startPlace('core:resistor');
    useUi.getState().setViewMode('pcb');
    let s = useUi.getState();
    expect(s.viewMode).toBe('pcb');
    expect(s.tool).toBe('select');
    expect(s.placePartId).toBeNull();

    useUi.getState().startPcbPlace('c1');
    useUi.getState().setViewMode('schematic');
    s = useUi.getState();
    expect(s.pcbTool).toBe('select');
    expect(s.pcbPlaceComponentId).toBeNull();
  });

  it('leaving pcb mode evicts the DRC tab (it does not exist there)', () => {
    useUi.getState().setViewMode('pcb');
    useUi.getState().setTab('drc');
    useUi.getState().setViewMode('schematic');
    expect(useUi.getState().activeTab).toBe('inspector');

    // …but a non-DRC tab survives the switch.
    useUi.getState().setViewMode('pcb');
    useUi.getState().setTab('erc');
    useUi.getState().setViewMode('schematic');
    expect(useUi.getState().activeTab).toBe('erc');
  });

  it('startPcbPlace arms the place tool; setPcbTool disarms it', () => {
    useUi.getState().setViewMode('pcb');
    useUi.getState().startPcbPlace('c42');
    let s = useUi.getState();
    expect(s.pcbTool).toBe('place');
    expect(s.pcbPlaceComponentId).toBe('c42');
    useUi.getState().setPcbTool('trace');
    s = useUi.getState();
    expect(s.pcbTool).toBe('trace');
    expect(s.pcbPlaceComponentId).toBeNull();
    useUi.getState().setViewMode('schematic');
  });

  it('toggleLayer flips between the two copper layers', () => {
    useUi.setState({ activeLayer: 'F.Cu' });
    useUi.getState().toggleLayer();
    expect(useUi.getState().activeLayer).toBe('B.Cu');
    useUi.getState().toggleLayer();
    expect(useUi.getState().activeLayer).toBe('F.Cu');
  });
});
