import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import CollaborationCursors, {
  cursorColorForUser,
  CURSOR_FADE_MS,
  useCollaborationCursors,
  useCursorEmitter,
  type CursorState,
} from '../CollaborationCursors';
import { CURSOR_COLORS } from '@shared/collaboration';
import type { CollaborationClient, CollabEventMap } from '@/lib/collaboration-client';
import { createElement } from 'react';
import { renderHook, act as hookAct } from '@testing-library/react';

/* ------------------------------------------------------------------ */
/*  Mock CollaborationClient                                           */
/* ------------------------------------------------------------------ */

type CursorMoveHandler = (data: CollabEventMap['cursor-move']) => void;
type UsersChangeHandler = (data: CollabEventMap['users-change']) => void;

function createMockClient(overrides: Partial<CollaborationClient> = {}): CollaborationClient {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const client: CollaborationClient = {
    on: vi.fn(<K extends keyof CollabEventMap>(event: K, cb: (data: CollabEventMap[K]) => void) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb as (...args: unknown[]) => void);
      return () => { set.delete(cb as (...args: unknown[]) => void); };
    }),
    off: vi.fn(),
    getActiveUsers: vi.fn().mockReturnValue([
      { userId: 10, username: 'Alice', role: 'editor', lastActivity: Date.now() },
      { userId: 20, username: 'Bob', role: 'viewer', lastActivity: Date.now() },
    ]),
    sendCursorPosition: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getConnectionState: vi.fn().mockReturnValue('connected'),
    sendSelectionChange: vi.fn(),
    sendStateUpdate: vi.fn(),
    requestLock: vi.fn(),
    releaseLock: vi.fn(),
    isLocked: vi.fn(),
    setUserId: vi.fn(),
    getMyRole: vi.fn().mockReturnValue('editor'),
    ...overrides,
  } as unknown as CollaborationClient;

  // Helper to emit events in tests
  (client as unknown as Record<string, unknown>).__emit = (event: string, data: unknown) => {
    const set = listeners.get(event);
    if (set) {
      for (const fn of Array.from(set)) {
        fn(data);
      }
    }
  };

  return client;
}

function emitEvent(client: CollaborationClient, event: string, data: unknown): void {
  (client as unknown as Record<string, (e: string, d: unknown) => void>).__emit(event, data);
}

/* ------------------------------------------------------------------ */
/*  Tests: cursorColorForUser                                          */
/* ------------------------------------------------------------------ */

describe('cursorColorForUser', () => {
  it('returns a color from the CURSOR_COLORS palette', () => {
    for (let id = 0; id < 50; id++) {
      const color = cursorColorForUser(id);
      expect(CURSOR_COLORS).toContain(color);
    }
  });

  it('is deterministic — same user ID always gets the same color', () => {
    const color1 = cursorColorForUser(42);
    const color2 = cursorColorForUser(42);
    expect(color1).toBe(color2);
  });

  it('distributes different user IDs across multiple colors', () => {
    const colors = new Set<string>();
    for (let id = 1; id <= 100; id++) {
      colors.add(cursorColorForUser(id));
    }
    // With 12 colors and 100 IDs, expect at least 6 distinct colors
    expect(colors.size).toBeGreaterThanOrEqual(6);
  });

  it('handles large user IDs without error', () => {
    const color = cursorColorForUser(999999999);
    expect(CURSOR_COLORS).toContain(color);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: useCollaborationCursors hook                                */
/* ------------------------------------------------------------------ */

describe('useCollaborationCursors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array when client is null', () => {
    const { result } = renderHook(() => useCollaborationCursors(null, 'schematic'));
    expect(result.current).toEqual([]);
  });

  it('tracks cursor-move events and returns cursor state', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCollaborationCursors(client, 'schematic'));

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 100, y: 200, view: 'schematic' },
      });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].userId).toBe(10);
    expect(result.current[0].x).toBe(100);
    expect(result.current[0].y).toBe(200);
    expect(result.current[0].username).toBe('Alice');
  });

  it('filters cursors by view', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCollaborationCursors(client, 'schematic'));

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 100, y: 200, view: 'pcb' },
      });
    });

    // pcb cursor should not appear in schematic view
    expect(result.current).toHaveLength(0);
  });

  it('updates position on subsequent cursor-move events', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCollaborationCursors(client, 'schematic'));

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 50, y: 50, view: 'schematic' },
      });
    });

    expect(result.current[0].x).toBe(50);

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 300, y: 400, view: 'schematic' },
      });
    });

    expect(result.current[0].x).toBe(300);
    expect(result.current[0].y).toBe(400);
  });

  it('tracks multiple users simultaneously', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCollaborationCursors(client, 'schematic'));

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 10, y: 20, view: 'schematic' },
      });
      emitEvent(client, 'cursor-move', {
        userId: 20,
        cursor: { x: 200, y: 300, view: 'schematic' },
      });
    });

    expect(result.current).toHaveLength(2);
    const ids = result.current.map((c) => c.userId).sort();
    expect(ids).toEqual([10, 20]);
  });

  it('removes cursor when user leaves', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCollaborationCursors(client, 'schematic'));

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 100, y: 200, view: 'schematic' },
      });
    });

    expect(result.current).toHaveLength(1);

    hookAct(() => {
      emitEvent(client, 'users-change', [
        { userId: 20, username: 'Bob', role: 'viewer', lastActivity: Date.now() },
      ]);
    });

    // User 10 left — should be removed
    expect(result.current).toHaveLength(0);
  });

  it('removes stale cursors after CURSOR_FADE_MS', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCollaborationCursors(client, 'schematic'));

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 100, y: 200, view: 'schematic' },
      });
    });

    expect(result.current).toHaveLength(1);

    // Advance past the fade threshold + cleanup interval
    hookAct(() => {
      vi.advanceTimersByTime(CURSOR_FADE_MS + 2_000);
    });

    expect(result.current).toHaveLength(0);
  });

  it('assigns deterministic color to cursor', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCollaborationCursors(client, 'schematic'));

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 0, y: 0, view: 'schematic' },
      });
    });

    expect(result.current[0].color).toBe(cursorColorForUser(10));
  });

  it('falls back to "User <id>" when username not found', () => {
    const client = createMockClient({
      getActiveUsers: vi.fn().mockReturnValue([]),
    });
    const { result } = renderHook(() => useCollaborationCursors(client, 'schematic'));

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 99,
        cursor: { x: 0, y: 0, view: 'schematic' },
      });
    });

    expect(result.current[0].username).toBe('User 99');
  });

  it('cleans up subscriptions on unmount', () => {
    const client = createMockClient();
    const unsubCursor = vi.fn();
    const unsubUsers = vi.fn();
    let callCount = 0;
    (client.on as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? unsubCursor : unsubUsers;
    });

    const { unmount } = renderHook(() => useCollaborationCursors(client, 'schematic'));
    unmount();

    expect(unsubCursor).toHaveBeenCalled();
    expect(unsubUsers).toHaveBeenCalled();
  });

  it('resets cursors when client changes to null', () => {
    const client = createMockClient();
    const { result, rerender } = renderHook(
      ({ c }) => useCollaborationCursors(c, 'schematic'),
      { initialProps: { c: client as CollaborationClient | null } },
    );

    hookAct(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 100, y: 200, view: 'schematic' },
      });
    });

    expect(result.current).toHaveLength(1);

    rerender({ c: null });
    expect(result.current).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: CollaborationCursors component                              */
/* ------------------------------------------------------------------ */

describe('CollaborationCursors component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when client is null', () => {
    const { container } = render(
      createElement(CollaborationCursors, { client: null, view: 'schematic' }),
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no cursors are present', () => {
    const client = createMockClient();
    const { container } = render(
      createElement(CollaborationCursors, { client, view: 'schematic' }),
    );
    expect(screen.queryByTestId('collaboration-cursors-overlay')).toBeNull();
  });

  it('renders cursor elements for each remote user', () => {
    const client = createMockClient();
    const { rerender } = render(
      createElement(CollaborationCursors, { client, view: 'schematic' }),
    );

    act(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 50, y: 75, view: 'schematic' },
      });
    });

    // Force rerender to pick up state change
    rerender(createElement(CollaborationCursors, { client, view: 'schematic' }));

    expect(screen.getByTestId('collaboration-cursors-overlay')).toBeTruthy();
    expect(screen.getByTestId('collab-cursor-10')).toBeTruthy();
  });

  it('renders username label', () => {
    const client = createMockClient();
    render(createElement(CollaborationCursors, { client, view: 'schematic' }));

    act(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 50, y: 75, view: 'schematic' },
      });
    });

    const label = screen.getByTestId('collab-cursor-label-10');
    expect(label.textContent).toBe('Alice');
  });

  it('applies cursor color to the arrow path', () => {
    const client = createMockClient();
    render(createElement(CollaborationCursors, { client, view: 'schematic' }));

    act(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 50, y: 75, view: 'schematic' },
      });
    });

    const cursor = screen.getByTestId('collab-cursor-10');
    const path = cursor.querySelector('path');
    expect(path).toBeTruthy();
    expect(path?.getAttribute('fill')).toBe(cursorColorForUser(10));
  });

  it('positions cursor with transform', () => {
    const client = createMockClient();
    render(createElement(CollaborationCursors, { client, view: 'schematic' }));

    act(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 120, y: 240, view: 'schematic' },
      });
    });

    const cursor = screen.getByTestId('collab-cursor-10');
    expect(cursor.style.transform).toContain('translate(120px, 240px)');
  });

  it('applies smooth transition for interpolation', () => {
    const client = createMockClient();
    render(createElement(CollaborationCursors, { client, view: 'schematic' }));

    act(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 50, y: 75, view: 'schematic' },
      });
    });

    const cursor = screen.getByTestId('collab-cursor-10');
    expect(cursor.style.transition).toContain('transform');
  });

  it('renders multiple cursors for multiple users', () => {
    const client = createMockClient();
    render(createElement(CollaborationCursors, { client, view: 'schematic' }));

    act(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 50, y: 75, view: 'schematic' },
      });
      emitEvent(client, 'cursor-move', {
        userId: 20,
        cursor: { x: 200, y: 300, view: 'schematic' },
      });
    });

    expect(screen.getByTestId('collab-cursor-10')).toBeTruthy();
    expect(screen.getByTestId('collab-cursor-20')).toBeTruthy();
  });

  it('does not render cursors from a different view', () => {
    const client = createMockClient();
    render(createElement(CollaborationCursors, { client, view: 'schematic' }));

    act(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 50, y: 75, view: 'pcb' },
      });
    });

    expect(screen.queryByTestId('collab-cursor-10')).toBeNull();
  });

  it('scales cursor size inversely with zoom', () => {
    const client = createMockClient();
    render(createElement(CollaborationCursors, { client, view: 'schematic', zoom: 2 }));

    act(() => {
      emitEvent(client, 'cursor-move', {
        userId: 10,
        cursor: { x: 50, y: 75, view: 'schematic' },
      });
    });

    const cursor = screen.getByTestId('collab-cursor-10');
    const svg = cursor.querySelector('svg');
    // At zoom=2, inverseZoom=0.5 => 20*0.5 = 10
    expect(svg?.getAttribute('width')).toBe('10');
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: useCursorEmitter hook                                       */
/* ------------------------------------------------------------------ */

describe('useCursorEmitter', () => {
  it('calls sendCursorPosition on the client', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCursorEmitter(client, 'schematic'));

    hookAct(() => {
      result.current(100, 200);
    });

    expect(client.sendCursorPosition).toHaveBeenCalledWith(100, 200, 'schematic');
  });

  it('does nothing when client is null', () => {
    const { result } = renderHook(() => useCursorEmitter(null, 'schematic'));

    // Should not throw
    hookAct(() => {
      result.current(100, 200);
    });
  });

  it('passes the correct view string', () => {
    const client = createMockClient();
    const { result } = renderHook(() => useCursorEmitter(client, 'pcb'));

    hookAct(() => {
      result.current(50, 75);
    });

    expect(client.sendCursorPosition).toHaveBeenCalledWith(50, 75, 'pcb');
  });

  it('returns a stable callback reference', () => {
    const client = createMockClient();
    const { result, rerender } = renderHook(() => useCursorEmitter(client, 'schematic'));

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
