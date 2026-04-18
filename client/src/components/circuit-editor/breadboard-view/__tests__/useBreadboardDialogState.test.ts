/**
 * useBreadboardDialogState hook tests.
 *
 * Verifies the discriminated-union dialog state machine:
 *   - Initial state is closed.
 *   - open() transitions to the correct kind.
 *   - close() always returns to closed.
 *   - Mutual exclusion: opening a second dialog transitions directly, not stacks.
 *   - isOpen() returns correct boolean for each kind.
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBreadboardDialogState } from '../useBreadboardDialogState';

describe('useBreadboardDialogState', () => {
  it('starts in the closed state', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    expect(result.current.state).toEqual({ kind: 'closed' });
  });

  it('open("inventory") transitions to inventory kind', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('inventory');
    });
    expect(result.current.state).toEqual({ kind: 'inventory' });
  });

  it('open("exact-part") transitions to exact-part kind', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('exact-part');
    });
    expect(result.current.state).toEqual({ kind: 'exact-part' });
  });

  it('open("exact-draft") transitions to exact-draft kind', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('exact-draft');
    });
    expect(result.current.state).toEqual({ kind: 'exact-draft' });
  });

  it('open("shopping-list") transitions to shopping-list kind', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('shopping-list');
    });
    expect(result.current.state).toEqual({ kind: 'shopping-list' });
  });

  it('close() from inventory returns to closed', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('inventory');
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.state).toEqual({ kind: 'closed' });
  });

  it('close() from exact-draft returns to closed', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('exact-draft');
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.state).toEqual({ kind: 'closed' });
  });

  it('close() when already closed stays closed', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.close();
    });
    expect(result.current.state).toEqual({ kind: 'closed' });
  });

  it('mutual exclusion: open("exact-part") then open("inventory") transitions directly to inventory', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('exact-part');
    });
    expect(result.current.state).toEqual({ kind: 'exact-part' });
    act(() => {
      result.current.open('inventory');
    });
    expect(result.current.state).toEqual({ kind: 'inventory' });
  });

  it('isOpen("inventory") is true when inventory is open', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('inventory');
    });
    expect(result.current.isOpen('inventory')).toBe(true);
  });

  it('isOpen("exact-part") is false when inventory is open', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('inventory');
    });
    expect(result.current.isOpen('exact-part')).toBe(false);
  });

  it('isOpen("closed") is true when no dialog is open', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    expect(result.current.isOpen('closed')).toBe(true);
  });

  it('isOpen("closed") is false when a dialog is open', () => {
    const { result } = renderHook(() => useBreadboardDialogState());
    act(() => {
      result.current.open('shopping-list');
    });
    expect(result.current.isOpen('closed')).toBe(false);
  });
});
