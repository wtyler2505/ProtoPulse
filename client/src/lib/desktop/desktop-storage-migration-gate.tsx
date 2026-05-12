/**
 * R5 #2 — Desktop storage migration gate (Codex R3 ratified).
 *
 * Wrapper component mounted ABOVE all providers that read localStorage
 * during initialization. In Tauri mode, runs the per-workflow migrations
 * to plugin-store before children mount. In browser mode, mounts children
 * immediately (no migration needed; localStorage is the canonical store).
 *
 * Fail-open semantics: if migration throws/fails, render children anyway
 * and the adapter falls back to localStorage (per Codex R3 — never block
 * app launch indefinitely).
 *
 * Limitation: cannot guard the 3 bootstrap-read keys
 * (`protopulse-high-contrast`, `protopulse-gpu-blur-override`,
 * `protopulse-theme`) — they're read at App.tsx module load, BEFORE this
 * component mounts. The migration runner explicitly excludes them; the
 * Bootstrap-Storage Restructure follow-up wave migrates them after
 * restructuring App.tsx eager reads.
 */

import { useEffect, useState, type ReactNode } from 'react';

import { isTauri } from '@/lib/tauri-api';
import { runDesktopStorageMigrations } from '@/lib/desktop/storage-migration-runner';

type Status = 'pending' | 'ready' | 'failed';

export function DesktopStorageMigrationGate({ children }: { children: ReactNode }) {
  // Browser mode: no migration needed. Skip directly to ready.
  const [status, setStatus] = useState<Status>(isTauri ? 'pending' : 'ready');

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    void runDesktopStorageMigrations()
      .then((summary) => {
        if (cancelled) return;
        // Telemetry: log byte-count-only summary (NOT values — per Codex R3
        // note: settings can contain personalized config even when non-sensitive).
        console.log('[desktop-storage-migration]', {
          ranAt: summary.ranAt,
          results: summary.results.map((r) => ({
            workflow: r.workflow,
            migrated: r.migrated,
            keysMigrated: r.keysMigrated,
            reason: r.reason,
          })),
        });
        setStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[desktop-storage-migration] failed; falling open to localStorage:', e);
        setStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'pending') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'sans-serif',
          color: '#666',
        }}
      >
        Initializing storage...
      </div>
    );
  }

  return <>{children}</>;
}
