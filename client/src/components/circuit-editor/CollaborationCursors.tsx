/**
 * CollaborationCursors — SVG / HTML overlay that renders live collaboration
 * cursors from remote users on Schematic and PCB canvases (BL-0525).
 *
 * Features:
 *  - Colored cursor arrow + username label per collaborator
 *  - Deterministic color assignment by user ID hash
 *  - Smooth position interpolation via CSS transitions
 *  - Cursor fades out after 5 s of inactivity
 *  - Filters cursors to the current view (schematic vs pcb)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CollabEventMap } from '@/lib/collaboration-client';
import type { CollaborationClient } from '@/lib/collaboration-client';
import { CURSOR_COLORS } from '@shared/collaboration';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CursorState {
  userId: number;
  username: string;
  x: number;
  y: number;
  view: string;
  color: string;
  lastActivity: number;
}

export interface CollaborationCursorsProps {
  /** The collaboration client instance (null when not connected). */
  client: CollaborationClient | null;
  /** Which view to filter cursors for (e.g. 'schematic' or 'pcb'). */
  view: string;
  /** Current viewport zoom (used to keep cursor size constant). */
  zoom?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Inactivity threshold after which a cursor fades out (ms). */
export const CURSOR_FADE_MS = 5_000;

/**
 * Deterministic color from a user ID using djb2 hash into the shared
 * CURSOR_COLORS palette.
 */
export function cursorColorForUser(userId: number): string {
  // djb2-style hash to distribute IDs across the palette
  let hash = 5381;
  const str = String(userId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

/* ------------------------------------------------------------------ */
/*  Hook: useCollaborationCursors                                      */
/* ------------------------------------------------------------------ */

/**
 * Subscribes to cursor-move events from the collaboration client and
 * maintains a map of remote cursor positions for the given view.
 */
export function useCollaborationCursors(
  client: CollaborationClient | null,
  view: string,
): CursorState[] {
  const [cursors, setCursors] = useState<Map<number, CursorState>>(new Map());
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to cursor-move events
  useEffect(() => {
    if (!client) {
      setCursors(new Map());
      return;
    }

    const handleCursorMove: (data: CollabEventMap['cursor-move']) => void = (data) => {
      setCursors((prev) => {
        const next = new Map(prev);
        const activeUsers = client.getActiveUsers();
        const user = activeUsers.find((u) => u.userId === data.userId);
        const username = user?.username ?? `User ${String(data.userId)}`;

        next.set(data.userId, {
          userId: data.userId,
          username,
          x: data.cursor.x,
          y: data.cursor.y,
          view: data.cursor.view,
          color: cursorColorForUser(data.userId),
          lastActivity: Date.now(),
        });
        return next;
      });
    };

    const handleUserLeave: (data: CollabEventMap['users-change']) => void = (users) => {
      setCursors((prev) => {
        const activeIds = new Set(users.map((u) => u.userId));
        const next = new Map(prev);
        let changed = false;
        for (const id of Array.from(next.keys())) {
          if (!activeIds.has(id)) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    const unsubCursor = client.on('cursor-move', handleCursorMove);
    const unsubUsers = client.on('users-change', handleUserLeave);

    return () => {
      unsubCursor();
      unsubUsers();
    };
  }, [client]);

  // Periodic cleanup of stale cursors
  useEffect(() => {
    fadeTimerRef.current = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, cursor] of next) {
          if (now - cursor.lastActivity > CURSOR_FADE_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1_000);

    return () => {
      if (fadeTimerRef.current !== null) {
        clearInterval(fadeTimerRef.current);
      }
    };
  }, []);

  // Filter to the requested view
  const filtered = Array.from(cursors.values()).filter((c) => c.view === view);
  return filtered;
}

/* ------------------------------------------------------------------ */
/*  Component: CollaborationCursors                                    */
/* ------------------------------------------------------------------ */

/**
 * HTML overlay that renders remote collaboration cursors.
 * Must be placed inside a `position: relative` container that matches
 * the canvas coordinate system (or has appropriate transforms applied).
 *
 * For ReactFlow (Schematic): positions are in flow coordinates.
 * For PCB SVG: positions are in board coordinates — caller should
 * apply the same translate/scale transform as the SVG `<g>`.
 */
export default function CollaborationCursors({
  client,
  view,
  zoom = 1,
}: CollaborationCursorsProps) {
  const cursors = useCollaborationCursors(client, view);

  if (cursors.length === 0) {
    return null;
  }

  const inverseZoom = 1 / zoom;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[15]"
      data-testid="collaboration-cursors-overlay"
    >
      {cursors.map((cursor) => {
        const timeSinceActivity = Date.now() - cursor.lastActivity;
        const isFading = timeSinceActivity > CURSOR_FADE_MS - 1_000; // start fade 1s before removal

        return (
          <div
            key={cursor.userId}
            data-testid={`collab-cursor-${String(cursor.userId)}`}
            className="absolute left-0 top-0 pointer-events-none"
            style={{
              transform: `translate(${String(cursor.x)}px, ${String(cursor.y)}px)`,
              transition: 'transform 80ms linear',
              opacity: isFading ? 0.3 : 1,
            }}
          >
            {/* Cursor arrow SVG */}
            <svg
              width={20 * inverseZoom}
              height={24 * inverseZoom}
              viewBox="0 0 20 24"
              fill="none"
              className="drop-shadow-md"
              style={{ overflow: 'visible' }}
            >
              <path
                d="M1 1L1 18L6.5 13L12 20L15 18.5L9.5 11.5L17 10L1 1Z"
                fill={cursor.color}
                stroke="#000"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </svg>
            {/* Username label */}
            <div
              data-testid={`collab-cursor-label-${String(cursor.userId)}`}
              className="absolute left-4 top-4 whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-medium shadow-md select-none"
              style={{
                backgroundColor: cursor.color,
                color: '#000',
                transform: `scale(${String(inverseZoom)})`,
                transformOrigin: 'top left',
              }}
            >
              {cursor.username}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook: useCursorEmitter                                             */
/* ------------------------------------------------------------------ */

/**
 * Returns a mouse-move handler that emits cursor position updates
 * to the collaboration client, throttled by the client's built-in
 * CURSOR_THROTTLE_MS.
 */
export function useCursorEmitter(
  client: CollaborationClient | null,
  view: string,
): (x: number, y: number) => void {
  return useCallback(
    (x: number, y: number) => {
      if (!client) { return; }
      client.sendCursorPosition(x, y, view);
    },
    [client, view],
  );
}
