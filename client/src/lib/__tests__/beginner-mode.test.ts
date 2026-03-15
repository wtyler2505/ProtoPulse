import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  BeginnerMode,
  SIMPLIFIED_LABELS,
  useBeginnerMode,
} from '../beginner-mode';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  BeginnerMode.resetInstance();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// BeginnerMode singleton
// ---------------------------------------------------------------------------

describe('BeginnerMode', () => {
  it('returns a singleton instance', () => {
    const a = BeginnerMode.getInstance();
    const b = BeginnerMode.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = BeginnerMode.getInstance();
    BeginnerMode.resetInstance();
    const b = BeginnerMode.getInstance();
    expect(a).not.toBe(b);
  });

  it('starts disabled by default', () => {
    const bm = BeginnerMode.getInstance();
    expect(bm.isEnabled()).toBe(false);
  });

  it('enable() turns beginner mode on', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    expect(bm.isEnabled()).toBe(true);
  });

  it('disable() turns beginner mode off', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    bm.disable();
    expect(bm.isEnabled()).toBe(false);
  });

  it('toggle() flips the state', () => {
    const bm = BeginnerMode.getInstance();
    expect(bm.isEnabled()).toBe(false);
    bm.toggle();
    expect(bm.isEnabled()).toBe(true);
    bm.toggle();
    expect(bm.isEnabled()).toBe(false);
  });

  it('enable() is idempotent (does not re-notify)', () => {
    const bm = BeginnerMode.getInstance();
    const cb = vi.fn();
    bm.subscribe(cb);
    bm.enable();
    bm.enable();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('disable() is idempotent when already disabled', () => {
    const bm = BeginnerMode.getInstance();
    const cb = vi.fn();
    bm.subscribe(cb);
    bm.disable();
    expect(cb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('BeginnerMode persistence', () => {
  it('persists enabled state to localStorage', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    expect(localStorage.getItem('protopulse-beginner-mode')).toBe('true');
  });

  it('persists disabled state to localStorage', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    bm.disable();
    expect(localStorage.getItem('protopulse-beginner-mode')).toBe('false');
  });

  it('restores enabled state on construction', () => {
    localStorage.setItem('protopulse-beginner-mode', 'true');
    const bm = BeginnerMode.getInstance();
    expect(bm.isEnabled()).toBe(true);
  });

  it('treats non-"true" localStorage value as disabled', () => {
    localStorage.setItem('protopulse-beginner-mode', 'maybe');
    const bm = BeginnerMode.getInstance();
    expect(bm.isEnabled()).toBe(false);
  });

  it('handles localStorage errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage broken');
    });
    const bm = BeginnerMode.getInstance();
    expect(bm.isEnabled()).toBe(false);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Subscribe / notify
// ---------------------------------------------------------------------------

describe('BeginnerMode subscribe', () => {
  it('notifies subscribers on enable', () => {
    const bm = BeginnerMode.getInstance();
    const cb = vi.fn();
    bm.subscribe(cb);
    bm.enable();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on disable', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    const cb = vi.fn();
    bm.subscribe(cb);
    bm.disable();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on toggle', () => {
    const bm = BeginnerMode.getInstance();
    const cb = vi.fn();
    bm.subscribe(cb);
    bm.toggle();
    bm.toggle();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops notifications', () => {
    const bm = BeginnerMode.getInstance();
    const cb = vi.fn();
    const unsub = bm.subscribe(cb);
    unsub();
    bm.enable();
    expect(cb).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers', () => {
    const bm = BeginnerMode.getInstance();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bm.subscribe(cb1);
    bm.subscribe(cb2);
    bm.toggle();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Label resolution — getLabel()
// ---------------------------------------------------------------------------

describe('BeginnerMode.getLabel', () => {
  it('returns the original term when mode is disabled', () => {
    const bm = BeginnerMode.getInstance();
    expect(bm.getLabel('Architecture')).toBe('Architecture');
  });

  it('returns simplified label when mode is enabled', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    expect(bm.getLabel('Architecture')).toBe('Block Diagram');
  });

  it('is case-insensitive', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    expect(bm.getLabel('architecture')).toBe('Block Diagram');
    expect(bm.getLabel('ARCHITECTURE')).toBe('Block Diagram');
    expect(bm.getLabel('drc')).toBe('Design Check');
  });

  it('returns original term for unmapped labels', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    expect(bm.getLabel('Dashboard')).toBe('Dashboard');
    expect(bm.getLabel('Arduino')).toBe('Arduino');
  });

  it('maps all known simplified labels correctly', () => {
    const bm = BeginnerMode.getInstance();
    bm.enable();
    Array.from(SIMPLIFIED_LABELS.entries()).forEach(([technical, simplified]) => {
      expect(bm.getLabel(technical)).toBe(simplified);
    });
  });
});

// ---------------------------------------------------------------------------
// SIMPLIFIED_LABELS constant
// ---------------------------------------------------------------------------

describe('SIMPLIFIED_LABELS', () => {
  it('contains at least 15 entries', () => {
    expect(SIMPLIFIED_LABELS.size).toBeGreaterThanOrEqual(15);
  });

  it('maps DRC to Design Check', () => {
    expect(SIMPLIFIED_LABELS.get('DRC')).toBe('Design Check');
  });

  it('maps BOM to Parts List', () => {
    expect(SIMPLIFIED_LABELS.get('BOM')).toBe('Parts List');
  });

  it('maps Gerber to Manufacturing Files', () => {
    expect(SIMPLIFIED_LABELS.get('Gerber')).toBe('Manufacturing Files');
  });

  it('maps Netlist to Connection List', () => {
    expect(SIMPLIFIED_LABELS.get('Netlist')).toBe('Connection List');
  });

  it('maps ERC to Electrical Check', () => {
    expect(SIMPLIFIED_LABELS.get('ERC')).toBe('Electrical Check');
  });

  it('maps PCB to Circuit Board', () => {
    expect(SIMPLIFIED_LABELS.get('PCB')).toBe('Circuit Board');
  });

  it('has unique simplified labels (no accidental duplicates except intentional)', () => {
    const values = Array.from(SIMPLIFIED_LABELS.values());
    // 'Design Check' is intentionally used for both DRC and Validation
    const nonDuplicated = values.filter((v) => v !== 'Design Check');
    const unique = new Set(nonDuplicated);
    expect(unique.size).toBe(nonDuplicated.length);
  });
});

// ---------------------------------------------------------------------------
// useBeginnerMode hook
// ---------------------------------------------------------------------------

describe('useBeginnerMode', () => {
  it('returns isEnabled false by default', () => {
    const { result } = renderHook(() => useBeginnerMode());
    expect(result.current.isEnabled).toBe(false);
  });

  it('enable() sets isEnabled to true', () => {
    const { result } = renderHook(() => useBeginnerMode());
    act(() => result.current.enable());
    expect(result.current.isEnabled).toBe(true);
  });

  it('disable() sets isEnabled to false', () => {
    const { result } = renderHook(() => useBeginnerMode());
    act(() => result.current.enable());
    act(() => result.current.disable());
    expect(result.current.isEnabled).toBe(false);
  });

  it('toggle() flips isEnabled', () => {
    const { result } = renderHook(() => useBeginnerMode());
    act(() => result.current.toggle());
    expect(result.current.isEnabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isEnabled).toBe(false);
  });

  it('getLabel returns simplified label when enabled', () => {
    const { result } = renderHook(() => useBeginnerMode());
    act(() => result.current.enable());
    expect(result.current.getLabel('BOM')).toBe('Parts List');
  });

  it('getLabel returns original label when disabled', () => {
    const { result } = renderHook(() => useBeginnerMode());
    expect(result.current.getLabel('BOM')).toBe('BOM');
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useBeginnerMode());
    unmount();
    // Should not throw when toggling after unmount
    const bm = BeginnerMode.getInstance();
    expect(() => bm.toggle()).not.toThrow();
  });
});
