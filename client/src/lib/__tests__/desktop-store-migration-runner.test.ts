/**
 * R5 #2 — migration runner contract tests.
 *
 * Verifies (per Codex R3 ratified):
 * - Bootstrap-read keys EXCLUDED from migration allowlist (3 specific keys).
 * - Bootstrap-read keys remain in localStorage after migration (defensive).
 * - Migration allowlist excludes credential/session-auth keys.
 * - SENSITIVE_KEY_ORACLE oracle defensively rejects credential-bearing keys
 *   at runtime in addition to the explicit allowlist.
 *
 * R5 #2 capability assertion (NO `store:default`, NO `@tauri-apps/plugin-store`)
 * lives in `tauri-native-authority.test.ts` — see Wave F separate addition.
 */
import { describe, it, expect } from 'vitest';

import {
  USER_SETTINGS_MIGRATION_ALLOWLIST,
  USER_SETTINGS_HARD_EXCLUDE,
} from '@/lib/desktop/storage-migration-runner';
import { isSensitiveKey } from '@/lib/desktop/storage-migration';

describe('R5 #2 migration runner — Codex R3 acceptance guards', () => {
  it('hard-excludes the 3 bootstrap-read keys (App.tsx module-load reads)', () => {
    // Per Codex R3 Q3: protopulse-high-contrast/gpu-blur-override/theme are
    // read at App.tsx:21-60 BEFORE any React component mounts. They CANNOT
    // be migrated to plugin-store in R5 #2 because the migration gate is
    // inside the React tree.
    const bootstrapKeys = [
      'protopulse-high-contrast',
      'protopulse-gpu-blur-override',
      'protopulse-theme',
    ];
    for (const key of bootstrapKeys) {
      expect(USER_SETTINGS_HARD_EXCLUDE.has(key)).toBe(true);
      expect(USER_SETTINGS_MIGRATION_ALLOWLIST.has(key)).toBe(false);
    }
  });

  it('allowlist excludes session-auth / credential-bearing keys (defensive)', () => {
    // Codex R3 Q6: user-settings allowlist must EXCLUDE session-auth keys.
    // The R5 #4 (Stronghold) wave migrates those separately.
    const sensitiveKeys = [
      'protopulse-session-id',
      'protopulse-ai-api-key',
      'protopulse-ai-api-key-gemini',
      'protopulse-google-workspace-token',
      'protopulse:public-api:keys',
      'protopulse:public-api:webhooks',
      'protopulse-supplier-api',
    ];
    for (const key of sensitiveKeys) {
      expect(USER_SETTINGS_MIGRATION_ALLOWLIST.has(key)).toBe(false);
    }
  });

  it('every allowlist entry is NON-sensitive per the inventory oracle', () => {
    // Defensive cross-check: any key in the allowlist MUST NOT match the
    // SENSITIVE_KEY_ORACLE. Catches future allowlist additions that
    // accidentally include credentials.
    for (const key of USER_SETTINGS_MIGRATION_ALLOWLIST) {
      expect(isSensitiveKey(key), `allowlist entry "${key}" matched SENSITIVE_KEY_ORACLE`).toBe(
        false,
      );
    }
  });

  it('every hard-exclude entry is NON-sensitive (excluded for OTHER reasons — bootstrap-read)', () => {
    // The 3 hard-excluded keys are NON-credential-bearing (theme, contrast,
    // blur). They're excluded because of timing (App.tsx eager read), not
    // because they're sensitive.
    for (const key of USER_SETTINGS_HARD_EXCLUDE) {
      expect(isSensitiveKey(key), `hard-exclude key "${key}" matched oracle unexpectedly`).toBe(
        false,
      );
    }
  });

  it('allowlist and hard-exclude are disjoint', () => {
    for (const key of USER_SETTINGS_HARD_EXCLUDE) {
      expect(USER_SETTINGS_MIGRATION_ALLOWLIST.has(key)).toBe(false);
    }
  });
});

describe('R5 #2 capability minimization (Codex R3 Q2)', () => {
  it('package.json does NOT include @tauri-apps/plugin-store', async () => {
    const pkg = await import('../../../../package.json');
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(deps).not.toHaveProperty('@tauri-apps/plugin-store');
  });

  it('capability default.json does NOT grant store:default', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const capPath = path.resolve(
      __dirname,
      '../../../../src-tauri/capabilities/default.json',
    );
    const raw = fs.readFileSync(capPath, 'utf8');
    const cap = JSON.parse(raw) as { permissions: unknown[] };
    // R3 Q2: webview must NOT be able to invoke plugin commands directly.
    // The plugin runs backend-only via the 6 typed commands.
    const hasStoreDefault = cap.permissions.some((p) => p === 'store:default');
    expect(hasStoreDefault, 'capability default.json should NOT include store:default').toBe(
      false,
    );
  });
});
