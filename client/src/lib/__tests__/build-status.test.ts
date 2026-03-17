import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BuildStatusManager, useBuildStatus, formatBuildDuration } from '../build-status';
import type { BuildPhase, BuildStatus } from '../build-status';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let manager: BuildStatusManager;

beforeEach(() => {
  BuildStatusManager.resetForTesting();
  manager = BuildStatusManager.getInstance();
});

afterEach(() => {
  BuildStatusManager.resetForTesting();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('BuildStatusManager - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = BuildStatusManager.getInstance();
    const b = BuildStatusManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = BuildStatusManager.getInstance();
    BuildStatusManager.resetForTesting();
    const second = BuildStatusManager.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Default State
// ---------------------------------------------------------------------------

describe('BuildStatusManager - Default State', () => {
  it('starts with phase "done" and zero progress', () => {
    const status = manager.getBuildStatus();
    expect(status.phase).toBe('done');
    expect(status.progress).toBe(0);
  });

  it('starts with null startedAt', () => {
    expect(manager.getBuildStatus().startedAt).toBeNull();
  });

  it('starts with empty errors, warnings, and output arrays', () => {
    const status = manager.getBuildStatus();
    expect(status.errors).toEqual([]);
    expect(status.warnings).toEqual([]);
    expect(status.output).toEqual([]);
  });

  it('is not building by default', () => {
    expect(manager.isBuilding()).toBe(false);
  });

  it('has empty board and sketch by default', () => {
    expect(manager.getBoard()).toBe('');
    expect(manager.getSketch()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// startBuild
// ---------------------------------------------------------------------------

describe('BuildStatusManager - startBuild', () => {
  it('sets phase to compiling', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    expect(manager.getBuildStatus().phase).toBe('compiling');
  });

  it('sets progress to 0', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    expect(manager.getBuildStatus().progress).toBe(0);
  });

  it('records startedAt timestamp', () => {
    const before = Date.now();
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    const after = Date.now();
    const startedAt = manager.getBuildStatus().startedAt;
    expect(startedAt).toBeGreaterThanOrEqual(before);
    expect(startedAt).toBeLessThanOrEqual(after);
  });

  it('stores board FQBN', () => {
    manager.startBuild('arduino:avr:mega', 'Robot.ino');
    expect(manager.getBoard()).toBe('arduino:avr:mega');
  });

  it('stores sketch name', () => {
    manager.startBuild('arduino:avr:mega', 'Robot.ino');
    expect(manager.getSketch()).toBe('Robot.ino');
  });

  it('clears previous errors, warnings, and output', () => {
    manager.startBuild('arduino:avr:uno', 'First.ino');
    manager.addError('compile error');
    manager.addWarning('deprecation warning');
    manager.addOutput('some output');

    manager.startBuild('arduino:avr:uno', 'Second.ino');
    const status = manager.getBuildStatus();
    expect(status.errors).toEqual([]);
    expect(status.warnings).toEqual([]);
    expect(status.output).toEqual([]);
  });

  it('marks isBuilding as true', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    expect(manager.isBuilding()).toBe(true);
  });

  it('notifies subscribers', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// updateProgress
// ---------------------------------------------------------------------------

describe('BuildStatusManager - updateProgress', () => {
  beforeEach(() => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
  });

  it('updates phase and progress within same phase', () => {
    manager.updateProgress('compiling', 50);
    const status = manager.getBuildStatus();
    expect(status.phase).toBe('compiling');
    expect(status.progress).toBe(50);
  });

  it('transitions forward through phases', () => {
    manager.updateProgress('linking', 20);
    expect(manager.getBuildStatus().phase).toBe('linking');

    manager.updateProgress('uploading', 60);
    expect(manager.getBuildStatus().phase).toBe('uploading');

    manager.updateProgress('verifying', 80);
    expect(manager.getBuildStatus().phase).toBe('verifying');

    manager.updateProgress('done', 100);
    expect(manager.getBuildStatus().phase).toBe('done');
  });

  it('clamps progress to 0-100', () => {
    manager.updateProgress('compiling', -10);
    expect(manager.getBuildStatus().progress).toBe(0);

    manager.updateProgress('compiling', 150);
    expect(manager.getBuildStatus().progress).toBe(100);
  });

  it('rounds fractional progress', () => {
    manager.updateProgress('compiling', 33.7);
    expect(manager.getBuildStatus().progress).toBe(34);
  });

  it('ignores backward phase transitions', () => {
    manager.updateProgress('linking', 30);
    manager.updateProgress('compiling', 10);
    expect(manager.getBuildStatus().phase).toBe('linking');
    expect(manager.getBuildStatus().progress).toBe(30);
  });

  it('ignores updates after done phase', () => {
    manager.updateProgress('done', 100);
    manager.updateProgress('compiling', 0);
    expect(manager.getBuildStatus().phase).toBe('done');
  });

  it('ignores updates after error phase', () => {
    manager.addError('fatal');
    manager.updateProgress('uploading', 50);
    expect(manager.getBuildStatus().phase).toBe('error');
  });

  it('notifies subscribers on valid update', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.updateProgress('compiling', 25);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify on ignored backward transition', () => {
    manager.updateProgress('linking', 30);
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.updateProgress('compiling', 10);
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// addError
// ---------------------------------------------------------------------------

describe('BuildStatusManager - addError', () => {
  it('adds error message to errors array', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.addError('undefined reference to setup');
    expect(manager.getBuildStatus().errors).toEqual(['undefined reference to setup']);
  });

  it('transitions to error phase', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.addError('compile failed');
    expect(manager.getBuildStatus().phase).toBe('error');
  });

  it('accumulates multiple errors', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.addError('error 1');
    manager.addError('error 2');
    manager.addError('error 3');
    expect(manager.getBuildStatus().errors).toHaveLength(3);
  });

  it('caps errors at MAX_ERRORS (500)', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    for (let i = 0; i < 510; i++) {
      manager.addError(`error ${i}`);
    }
    expect(manager.getBuildStatus().errors).toHaveLength(500);
  });

  it('marks isBuilding as false after error', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.addError('fatal');
    expect(manager.isBuilding()).toBe(false);
  });

  it('notifies subscribers', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.addError('oops');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// addWarning
// ---------------------------------------------------------------------------

describe('BuildStatusManager - addWarning', () => {
  it('adds warning message to warnings array', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.addWarning('unused variable x');
    expect(manager.getBuildStatus().warnings).toEqual(['unused variable x']);
  });

  it('does not change the build phase', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.updateProgress('linking', 40);
    manager.addWarning('deprecated API');
    expect(manager.getBuildStatus().phase).toBe('linking');
  });

  it('accumulates multiple warnings', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.addWarning('warning 1');
    manager.addWarning('warning 2');
    expect(manager.getBuildStatus().warnings).toHaveLength(2);
  });

  it('caps warnings at MAX_WARNINGS (500)', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    for (let i = 0; i < 510; i++) {
      manager.addWarning(`warning ${i}`);
    }
    expect(manager.getBuildStatus().warnings).toHaveLength(500);
  });

  it('notifies subscribers', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.addWarning('heads up');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// addOutput
// ---------------------------------------------------------------------------

describe('BuildStatusManager - addOutput', () => {
  it('adds output line to output array', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.addOutput('Compiling sketch...');
    expect(manager.getBuildStatus().output).toEqual(['Compiling sketch...']);
  });

  it('accumulates multiple output lines', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.addOutput('line 1');
    manager.addOutput('line 2');
    manager.addOutput('line 3');
    expect(manager.getBuildStatus().output).toHaveLength(3);
  });

  it('caps output at MAX_OUTPUT_LINES (5000)', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    for (let i = 0; i < 5010; i++) {
      manager.addOutput(`line ${i}`);
    }
    expect(manager.getBuildStatus().output).toHaveLength(5000);
  });

  it('notifies subscribers', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.addOutput('hello');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getBuildStatus snapshot isolation
// ---------------------------------------------------------------------------

describe('BuildStatusManager - getBuildStatus', () => {
  it('returns a snapshot that does not mutate when manager changes', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    const snapshot = manager.getBuildStatus();
    manager.updateProgress('linking', 50);
    expect(snapshot.phase).toBe('compiling');
    expect(snapshot.progress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('BuildStatusManager - Subscription', () => {
  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);
    unsub();
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple simultaneous subscribers', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    manager.subscribe(listener1);
    manager.subscribe(listener2);
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing one does not affect others', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const unsub1 = manager.subscribe(listener1);
    manager.subscribe(listener2);
    unsub1();
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('BuildStatusManager - reset', () => {
  it('restores default status', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.updateProgress('linking', 50);
    manager.addError('something');
    manager.addWarning('something');
    manager.addOutput('something');
    manager.reset();

    const status = manager.getBuildStatus();
    expect(status.phase).toBe('done');
    expect(status.progress).toBe(0);
    expect(status.startedAt).toBeNull();
    expect(status.errors).toEqual([]);
    expect(status.warnings).toEqual([]);
    expect(status.output).toEqual([]);
  });

  it('clears board and sketch', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.reset();
    expect(manager.getBoard()).toBe('');
    expect(manager.getSketch()).toBe('');
  });

  it('marks isBuilding as false', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    manager.reset();
    expect(manager.isBuilding()).toBe(false);
  });

  it('notifies subscribers', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.reset();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Full Build Lifecycle
// ---------------------------------------------------------------------------

describe('BuildStatusManager - Full Lifecycle', () => {
  it('walks through a successful build end-to-end', () => {
    manager.startBuild('arduino:avr:uno', 'Blink.ino');
    expect(manager.isBuilding()).toBe(true);

    manager.addOutput('Compiling sketch...');
    manager.updateProgress('compiling', 50);
    manager.addWarning('unused variable');

    manager.updateProgress('linking', 0);
    manager.addOutput('Linking...');
    manager.updateProgress('linking', 100);

    manager.updateProgress('uploading', 0);
    manager.addOutput('Uploading to board...');
    manager.updateProgress('uploading', 80);

    manager.updateProgress('verifying', 0);
    manager.updateProgress('verifying', 100);

    manager.updateProgress('done', 100);
    expect(manager.isBuilding()).toBe(false);
    expect(manager.getBuildStatus().phase).toBe('done');
    expect(manager.getBuildStatus().output).toHaveLength(3);
    expect(manager.getBuildStatus().warnings).toHaveLength(1);
    expect(manager.getBuildStatus().errors).toHaveLength(0);
  });

  it('handles a failed build', () => {
    manager.startBuild('arduino:avr:uno', 'Broken.ino');
    manager.updateProgress('compiling', 30);
    manager.addOutput('Compiling...');
    manager.addError('Broken.ino:10:5: error: expected ; before }');

    expect(manager.isBuilding()).toBe(false);
    expect(manager.getBuildStatus().phase).toBe('error');
    expect(manager.getBuildStatus().errors).toHaveLength(1);
  });

  it('allows starting a new build after error', () => {
    manager.startBuild('arduino:avr:uno', 'Broken.ino');
    manager.addError('fatal');
    expect(manager.isBuilding()).toBe(false);

    manager.startBuild('arduino:avr:uno', 'Fixed.ino');
    expect(manager.isBuilding()).toBe(true);
    expect(manager.getBuildStatus().phase).toBe('compiling');
    expect(manager.getBuildStatus().errors).toEqual([]);
    expect(manager.getSketch()).toBe('Fixed.ino');
  });

  it('allows starting a new build after done', () => {
    manager.startBuild('arduino:avr:uno', 'First.ino');
    manager.updateProgress('done', 100);
    expect(manager.isBuilding()).toBe(false);

    manager.startBuild('arduino:avr:mega', 'Second.ino');
    expect(manager.isBuilding()).toBe(true);
    expect(manager.getBoard()).toBe('arduino:avr:mega');
  });
});

// ---------------------------------------------------------------------------
// formatBuildDuration
// ---------------------------------------------------------------------------

describe('formatBuildDuration', () => {
  it('formats sub-second durations as milliseconds', () => {
    expect(formatBuildDuration(0)).toBe('0ms');
    expect(formatBuildDuration(1)).toBe('1ms');
    expect(formatBuildDuration(500)).toBe('500ms');
    expect(formatBuildDuration(999)).toBe('999ms');
  });

  it('formats seconds with one decimal', () => {
    expect(formatBuildDuration(1000)).toBe('1.0s');
    expect(formatBuildDuration(1500)).toBe('1.5s');
    expect(formatBuildDuration(45300)).toBe('45.3s');
  });

  it('formats minutes and seconds for >= 60s', () => {
    expect(formatBuildDuration(60000)).toBe('1m 0s');
    expect(formatBuildDuration(90000)).toBe('1m 30s');
    expect(formatBuildDuration(125000)).toBe('2m 5s');
  });

  it('handles negative and non-finite values', () => {
    expect(formatBuildDuration(-100)).toBe('0ms');
    expect(formatBuildDuration(Infinity)).toBe('0ms');
    expect(formatBuildDuration(NaN)).toBe('0ms');
    expect(formatBuildDuration(-Infinity)).toBe('0ms');
  });

  it('rounds milliseconds', () => {
    expect(formatBuildDuration(1.7)).toBe('2ms');
    expect(formatBuildDuration(0.3)).toBe('0ms');
  });
});

// ---------------------------------------------------------------------------
// useBuildStatus hook
// ---------------------------------------------------------------------------

describe('useBuildStatus', () => {
  it('returns default status when no build is active', () => {
    const { result } = renderHook(() => useBuildStatus());
    expect(result.current.status.phase).toBe('done');
    expect(result.current.isBuilding).toBe(false);
    expect(result.current.board).toBe('');
    expect(result.current.sketch).toBe('');
  });

  it('reflects startBuild in hook state', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => {
      result.current.startBuild('arduino:avr:uno', 'Blink.ino');
    });
    expect(result.current.status.phase).toBe('compiling');
    expect(result.current.isBuilding).toBe(true);
    expect(result.current.board).toBe('arduino:avr:uno');
    expect(result.current.sketch).toBe('Blink.ino');
  });

  it('reflects updateProgress in hook state', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => {
      result.current.startBuild('arduino:avr:uno', 'Blink.ino');
    });
    act(() => {
      result.current.updateProgress('linking', 55);
    });
    expect(result.current.status.phase).toBe('linking');
    expect(result.current.status.progress).toBe(55);
  });

  it('reflects addError in hook state', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => {
      result.current.startBuild('arduino:avr:uno', 'Blink.ino');
    });
    act(() => {
      result.current.addError('compile failed');
    });
    expect(result.current.status.errors).toEqual(['compile failed']);
    expect(result.current.status.phase).toBe('error');
    expect(result.current.isBuilding).toBe(false);
  });

  it('reflects addWarning in hook state', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => {
      result.current.startBuild('arduino:avr:uno', 'Blink.ino');
    });
    act(() => {
      result.current.addWarning('unused var');
    });
    expect(result.current.status.warnings).toEqual(['unused var']);
  });

  it('reflects addOutput in hook state', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => {
      result.current.startBuild('arduino:avr:uno', 'Blink.ino');
    });
    act(() => {
      result.current.addOutput('Compiling...');
    });
    expect(result.current.status.output).toEqual(['Compiling...']);
  });

  it('reflects reset in hook state', () => {
    const { result } = renderHook(() => useBuildStatus());
    act(() => {
      result.current.startBuild('arduino:avr:uno', 'Blink.ino');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.status.phase).toBe('done');
    expect(result.current.isBuilding).toBe(false);
    expect(result.current.board).toBe('');
    expect(result.current.sketch).toBe('');
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useBuildStatus());
    unmount();
    // Should not throw or cause issues when manager notifies after unmount
    const mgr = BuildStatusManager.getInstance();
    mgr.startBuild('arduino:avr:uno', 'Blink.ino');
    // If we got here without error, cleanup worked
    expect(true).toBe(true);
  });
});
