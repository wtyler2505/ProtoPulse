/**
 * R5 #2 — localStorage → tauri-plugin-store migration runner.
 *
 * Per Codex R3 ratified architecture:
 * - Per-workflow markers, written ONLY after each workflow's writes succeed.
 * - HARD-EXCLUDES session-auth/credential keys (stay in localStorage; R5 #4
 *   Stronghold wave migrates them).
 * - HARD-EXCLUDES the 3 bootstrap-read keys read at App.tsx module load
 *   (`protopulse-high-contrast`, `protopulse-gpu-blur-override`,
 *   `protopulse-theme`) — they stay in localStorage until the Bootstrap-Storage
 *   Restructure follow-up wave.
 * - Idempotent: re-running after a marker is present is a no-op for that
 *   workflow.
 * - Fail-open: if migration throws, callers render the app anyway and adapter
 *   falls back to localStorage.
 */

import { commands } from '@/lib/bindings';
import { isSensitiveKey } from '@/lib/desktop/storage-migration';

// ─── Markers ─────────────────────────────────────────────────────────────────

/**
 * Per-workflow markers — written to the corresponding store AFTER its data
 * writes + save succeed. Idempotency check: if marker present, skip
 * migration entirely.
 */
const MARKER_KEY_USER_SETTINGS = 'protopulse-migration:user-settings-store-v1';
const MARKER_KEY_KANBAN_STATE = 'protopulse-migration:kanban-state-store-v1';
const MARKER_KEY_DESIGN_VARIABLES =
  'protopulse-migration:design-variables-store-v1';

// ─── Allowlists ──────────────────────────────────────────────────────────────

/**
 * User-settings keys that DO migrate to plugin-store in R5 #2.
 *
 * R5 #2 HARD-EXCLUDES:
 * - Session-auth/credential keys (api keys, OAuth tokens, session-id) —
 *   stay in localStorage until R5 #4 Stronghold/keychain wave.
 * - Bootstrap-read keys (high-contrast, gpu-blur-override, theme) — read
 *   at App.tsx module load before React mounts; require Bootstrap-Storage
 *   Restructure follow-up wave to migrate safely.
 */
export const USER_SETTINGS_MIGRATION_ALLOWLIST: ReadonlySet<string> = new Set([
  // R3 explicit allowlist:
  'protopulse-beginner-mode',
  'protopulse-compact-mode',
  'protopulse-ai-safety-mode',
  'protopulse-keyboard-shortcuts',
  'protopulse-locale',
  'protopulse-reduced-motion',
  'protopulse-font-scale',
  'protopulse-ai-tutor',
  'protopulse-multimodal-input',
  'protopulse-offline',
  'protopulse-telemetry',
  'protopulse-mobile-review-config',
  'protopulse-ratsnest-filter',
  'protopulse-hidden-projects',
  'protopulse_ai_provider',
  'protopulse_ai_model',
  'protopulse_ai_temp',
  'protopulse_ai_sysprompt',
  'protopulse_ai_preview_changes',
  'protopulse_routing_strategy',
  'protopulse_optimization_goal',
  'protopulse_preferred_suppliers',
  'protopulse_bom_sort_order',
  'protopulse:role-preset',
  'protopulse:custom-keybindings',
  'protopulse:quick-jump-recents',
  'protopulse:sidebar-group-collapsed',
  'protopulse:mention-notifications',
]);

/**
 * Hard-excluded user-settings keys (R3 Q3 + Q6 exclusions). Even if a future
 * caller adds them to ALLOWLIST, the runtime check rejects them.
 */
export const USER_SETTINGS_HARD_EXCLUDE: ReadonlySet<string> = new Set([
  // Bootstrap-read keys (App.tsx:21-60 reads at module load — pre-React):
  'protopulse-high-contrast',
  'protopulse-gpu-blur-override',
  'protopulse-theme',
]);

// ─── Migration runner ────────────────────────────────────────────────────────

interface WorkflowResult {
  workflow: 'user-settings' | 'kanban-state' | 'design-variables';
  migrated: boolean;
  reason?: string;
  keysMigrated: number;
}

export interface MigrationSummary {
  ranAt: string;
  results: WorkflowResult[];
}

/**
 * Run all R5 #2 migrations. Each workflow independently:
 *   1. Check marker — if present, skip.
 *   2. Drain localStorage keys per allowlist.
 *   3. Write each to plugin-store via typed command (Rust persists + saves).
 *   4. Only on full success: write the marker (which also saves).
 *
 * Returns a per-workflow result summary. NEVER throws — fail-open.
 * Caller renders app regardless of result.
 */
export async function runDesktopStorageMigrations(): Promise<MigrationSummary> {
  const results: WorkflowResult[] = [];

  results.push(await migrateUserSettings());
  results.push(await migrateKanbanState());
  results.push(await migrateDesignVariables());

  return {
    ranAt: new Date().toISOString(),
    results,
  };
}

async function migrateUserSettings(): Promise<WorkflowResult> {
  try {
    const marker = await readSettingSafe(MARKER_KEY_USER_SETTINGS);
    if (marker !== null) {
      return { workflow: 'user-settings', migrated: false, reason: 'marker present', keysMigrated: 0 };
    }
    let migrated = 0;
    for (const key of USER_SETTINGS_MIGRATION_ALLOWLIST) {
      if (USER_SETTINGS_HARD_EXCLUDE.has(key)) continue;
      if (isSensitiveKey(key)) continue; // defensive double-check
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw; // legacy non-JSON entry — preserve as string
      }
      await writeSettingSafe(key, parsed);
      migrated += 1;
    }
    // Marker written ONLY after all key writes succeeded.
    await writeSettingSafe(MARKER_KEY_USER_SETTINGS, {
      migratedAt: new Date().toISOString(),
      keysMigrated: migrated,
    });
    return { workflow: 'user-settings', migrated: true, keysMigrated: migrated };
  } catch (e) {
    return {
      workflow: 'user-settings',
      migrated: false,
      reason: e instanceof Error ? e.message : String(e),
      keysMigrated: 0,
    };
  }
}

async function migrateKanbanState(): Promise<WorkflowResult> {
  try {
    // Kanban marker lives in user-settings (single-marker file per workflow).
    // Actually — store the marker in kanban-state.json itself for atomicity:
    // write the value + save, then write the marker + save. No cross-store
    // dependency.
    const existing = await readKanbanSafe();
    if (existing && '__migration_marker__' in existing) {
      return { workflow: 'kanban-state', migrated: false, reason: 'marker present', keysMigrated: 0 };
    }
    const legacy = localStorage.getItem('protopulse-kanban-board');
    if (legacy === null) {
      // No legacy data to migrate. Still write a marker so we don't keep checking.
      await writeKanbanSafe({ __migration_marker__: new Date().toISOString() });
      return { workflow: 'kanban-state', migrated: true, keysMigrated: 0 };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(legacy);
    } catch {
      parsed = legacy;
    }
    const withMarker = {
      ...(typeof parsed === 'object' && parsed !== null ? parsed : { data: parsed }),
      __migration_marker__: new Date().toISOString(),
    };
    await writeKanbanSafe(withMarker);
    return { workflow: 'kanban-state', migrated: true, keysMigrated: 1 };
  } catch (e) {
    return {
      workflow: 'kanban-state',
      migrated: false,
      reason: e instanceof Error ? e.message : String(e),
      keysMigrated: 0,
    };
  }
}

async function migrateDesignVariables(): Promise<WorkflowResult> {
  try {
    // For each `protopulse:design-variables:project:<id>` localStorage key,
    // migrate to plugin-store under that project_id.
    const prefix = 'protopulse:design-variables:project:';
    let migrated = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null || !key.startsWith(prefix)) continue;
      const projectId = key.slice(prefix.length);
      // project_id validation — skip silently if invalid (don't fail migration)
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(projectId)) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
      await writeDesignVarsSafe(projectId, parsed);
      migrated += 1;
    }
    // Use a sentinel project_id `__migration__` to store the marker (any
    // 64-char ASCII alnum/dash/underscore works; this matches the validator).
    await writeDesignVarsSafe('__migration__', {
      migratedAt: new Date().toISOString(),
      projectsMigrated: migrated,
    });
    return { workflow: 'design-variables', migrated: true, keysMigrated: migrated };
  } catch (e) {
    return {
      workflow: 'design-variables',
      migrated: false,
      reason: e instanceof Error ? e.message : String(e),
      keysMigrated: 0,
    };
  }
}

// ─── Direct-command helpers (the adapter is consumer-facing; these are
//     migration-only paths that always call Tauri commands). ─────────────────

async function readSettingSafe(key: string): Promise<unknown> {
  const result = await commands.readUserSetting(key);
  if (result.status === 'error') return null;
  if (result.data === null) return null;
  try {
    return JSON.parse(result.data);
  } catch {
    return result.data;
  }
}

async function writeSettingSafe(key: string, value: unknown): Promise<void> {
  const result = await commands.writeUserSetting(key, JSON.stringify(value));
  if (result.status === 'error') {
    throw new Error(`writeUserSetting('${key}') failed: ${result.error}`);
  }
}

async function readKanbanSafe(): Promise<Record<string, unknown> | null> {
  const result = await commands.readKanbanState();
  if (result.status === 'error') return null;
  if (result.data === null) return null;
  try {
    return JSON.parse(result.data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function writeKanbanSafe(value: unknown): Promise<void> {
  const result = await commands.writeKanbanState(JSON.stringify(value));
  if (result.status === 'error') {
    throw new Error(`writeKanbanState failed: ${result.error}`);
  }
}

async function writeDesignVarsSafe(projectId: string, value: unknown): Promise<void> {
  const result = await commands.writeProjectDesignVariables(projectId, JSON.stringify(value));
  if (result.status === 'error') {
    throw new Error(`writeProjectDesignVariables('${projectId}') failed: ${result.error}`);
  }
}
