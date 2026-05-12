/**
 * Desktop lifecycle bridge — Phase 4.3 (R4 retro Wave 5).
 *
 * Null-rendering React component that owns the project-open listener for the
 * entire desktop session. Mounts at the App.tsx level INSIDE all providers
 * but OUTSIDE the route switch, so cold-start deep-links queued in Rust drain
 * regardless of which route the user lands on (`/`, `/projects`, `/settings`,
 * auth gate, or the per-project workspace).
 *
 * Closes C5 + C14 + C19 from the R4 retro: a `ProjectWorkspace`-mounted
 * listener would strand cold-start events when the user's initial route is
 * not the workspace.
 */

import { useEffect, useRef } from 'react';

import { isTauri } from '@/lib/tauri-api';
import {
  installProjectOpenListener,
  type ProjectOpenOutcome,
} from './project-open-contract';
import { handleProjectOpenOutcome } from './handle-project-open-outcome';

/**
 * Active-project getter — read from wherever the app tracks the currently
 * loaded project. For now, derives from `window.location.pathname` since
 * wouter routes are URL-state-only and there is no central store yet.
 * R5+ wave: replace with a Zustand selector if/when a central store lands.
 */
function readActiveProjectPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/projects\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function DesktopLifecycleBridge(): null {
  // Use a ref so the cleanup function captures the latest unlisten reference
  // even if the component re-renders (which it shouldn't, but defensive).
  const unlistenRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!isTauri) {
      return undefined;
    }
    let cancelled = false;
    void installProjectOpenListener(
      (outcome: ProjectOpenOutcome) => handleProjectOpenOutcome(outcome),
      () => readActiveProjectPath(),
    )
      .then((unlisten) => {
        if (cancelled) {
          unlisten();
        } else {
          unlistenRef.current = unlisten;
        }
      })
      .catch((e) => {
        console.error('[lifecycle] installProjectOpenListener failed:', e);
      });

    return () => {
      cancelled = true;
      unlistenRef.current?.();
      unlistenRef.current = undefined;
    };
  }, []);

  return null;
}
