import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { usePicking } from '../usePicking';

import type { SceneSelection } from '../../model/scene-model';

const COMP: SceneSelection = { kind: 'component', id: 'circuit-instance-1' };
const VIA: SceneSelection = { kind: 'via', id: 'circuit-via-9' };

describe('usePicking', () => {
  it('starts empty and selects on pick', () => {
    const { result } = renderHook(() => usePicking());
    expect(result.current.selection).toBeNull();
    act(() => { result.current.pick(COMP); });
    expect(result.current.selection).toEqual(COMP);
  });

  it('toggles off when picking the same element twice', () => {
    const { result } = renderHook(() => usePicking());
    act(() => { result.current.pick(COMP); });
    act(() => { result.current.pick({ ...COMP }); });
    expect(result.current.selection).toBeNull();
  });

  it('switches between elements and clears', () => {
    const { result } = renderHook(() => usePicking());
    act(() => { result.current.pick(COMP); });
    act(() => { result.current.pick(VIA); });
    expect(result.current.selection).toEqual(VIA);
    act(() => { result.current.clear(); });
    expect(result.current.selection).toBeNull();
  });

  it('set() assigns directly without toggling (double-click focus)', () => {
    const { result } = renderHook(() => usePicking());
    act(() => { result.current.set(COMP); });
    act(() => { result.current.set({ ...COMP }); });
    expect(result.current.selection).toEqual(COMP);
  });
});
