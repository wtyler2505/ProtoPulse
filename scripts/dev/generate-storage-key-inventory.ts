#!/usr/bin/env tsx
/**
 * scripts/dev/generate-storage-key-inventory.ts
 *
 * Phase 3.5 (R4 retro Wave 3): Generate the authoritative storage-key
 * inventory by grepping the live codebase for `protopulse[:_-]*` literal
 * strings, then applying curated bucket classifications + a sensitive-key
 * oracle. The committed inventory is consumed by `storage-migration.ts`
 * as the classifier ground truth.
 *
 * Usage:
 *   tsx scripts/dev/generate-storage-key-inventory.ts        # writes default path
 *   STORAGE_INVENTORY_OUT=/tmp/foo.json tsx ...              # writes override path
 *
 * Drift check:
 *   tsx scripts/dev/check-storage-key-inventory.ts           # regenerates to temp, diffs
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type StorageBucket =
  | 'session-auth'
  | 'project-data'
  | 'user-prefs'
  | 'history-cache'
  | 'catalog-shared'
  | 'hardware-presets'
  | 'ux-flags'
  | 'migration-markers'
  | 'event-name-not-storage';

interface InventoryEntry {
  key: string;
  classifiedAs: StorageBucket;
  sensitive: boolean;
  callSites: Array<{ file: string; line: number }>;
}

// ───────────────────────────────────────────────────────────────────────────
// Window CustomEvent names found via rg — NOT localStorage keys.
// ───────────────────────────────────────────────────────────────────────────
const WINDOW_EVENT_NAMES: ReadonlySet<string> = new Set([
  'protopulse:chat-send',
  'protopulse:open-chat-panel',
  'protopulse:navigate-knowledge',
  'protopulse:schematic-focus-parts-panel',
  'protopulse:schematic-focus-power-panel',
  'protopulse:run-drc',
  'protopulse:run-erc',
  'protopulse:focus-component-search',
  'protopulse:place-component-instance',
  'protopulse:view-onboarding',
  'protopulse:export',
  'protopulse:bom-snapshot-cost',
  // R4.5 fix #2: Wave 5 introduced this CustomEvent in handle-project-open-outcome.ts:49.
  'protopulse:project-open-prompt-replace',
  'protopulse:open-project-from-file',
]);

// ───────────────────────────────────────────────────────────────────────────
// Strings that match the protopulse[:_-] pattern but are NOT storage keys.
// E.g., MIME-type substrings, config-environment markers, internal tags.
// ───────────────────────────────────────────────────────────────────────────
const IGNORED_LITERALS: ReadonlySet<string> = new Set([
  'protopulse_dev',        // server NODE_ENV-style marker
  'protopulse_staging',    // same
  'protopulse-power',      // drag MIME substring
  'protopulse-architecture-bundle', // ArchitectureView payload type, not localStorage
]);

// ───────────────────────────────────────────────────────────────────────────
// Curated classifications — explicit map for every known storage key.
// Each entry: bucket + sensitive flag.
// ───────────────────────────────────────────────────────────────────────────
const CURATED: Record<string, { bucket: StorageBucket; sensitive: boolean }> = {
  // ─── session-auth (credential-bearing — strictly first-class) ───────────
  'protopulse-session-id':                       { bucket: 'session-auth', sensitive: true },
  'protopulse-ai-api-key':                       { bucket: 'session-auth', sensitive: true },
  'protopulse-ai-api-key-gemini':                { bucket: 'session-auth', sensitive: true },
  'protopulse-ai-api-key-gemini-scratch':        { bucket: 'session-auth', sensitive: true },
  'protopulse-google-workspace-token':           { bucket: 'session-auth', sensitive: true },
  'protopulse-google-workspace-token-scratch':   { bucket: 'session-auth', sensitive: true },
  'protopulse:public-api:keys':                  { bucket: 'session-auth', sensitive: true },
  'protopulse:public-api:webhooks':              { bucket: 'session-auth', sensitive: true },
  'protopulse:public-api:deliveries':            { bucket: 'session-auth', sensitive: true },
  'protopulse-supplier-api':                     { bucket: 'session-auth', sensitive: true },

  // ─── user-prefs ─────────────────────────────────────────────────────────
  'protopulse-high-contrast':                    { bucket: 'user-prefs', sensitive: false },
  'protopulse-gpu-blur-override':                { bucket: 'user-prefs', sensitive: false },
  'protopulse-theme':                            { bucket: 'user-prefs', sensitive: false },
  'protopulse-beginner-mode':                    { bucket: 'user-prefs', sensitive: false },
  'protopulse-compact-mode':                     { bucket: 'user-prefs', sensitive: false },
  'protopulse-ai-safety-mode':                   { bucket: 'user-prefs', sensitive: false },
  'protopulse-keyboard-shortcuts':               { bucket: 'user-prefs', sensitive: false },
  'protopulse-locale':                           { bucket: 'user-prefs', sensitive: false },
  'protopulse-reduced-motion':                   { bucket: 'user-prefs', sensitive: false },
  'protopulse-font-scale':                       { bucket: 'user-prefs', sensitive: false },
  'protopulse-ai-tutor':                         { bucket: 'user-prefs', sensitive: false },
  'protopulse:role-preset':                      { bucket: 'user-prefs', sensitive: false },
  'protopulse:custom-keybindings':               { bucket: 'user-prefs', sensitive: false },
  'protopulse:quick-jump-recents':               { bucket: 'user-prefs', sensitive: false },
  'protopulse:sidebar-group-collapsed':          { bucket: 'user-prefs', sensitive: false },
  'protopulse:mention-notifications':            { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_provider':                      { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_model':                         { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_temp':                          { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_sysprompt':                     { bucket: 'user-prefs', sensitive: false },
  'protopulse_ai_preview_changes':               { bucket: 'user-prefs', sensitive: false },
  'protopulse_routing_strategy':                 { bucket: 'user-prefs', sensitive: false },
  'protopulse_optimization_goal':                { bucket: 'user-prefs', sensitive: false },
  'protopulse_preferred_suppliers':              { bucket: 'user-prefs', sensitive: false },
  'protopulse_bom_sort_order':                   { bucket: 'user-prefs', sensitive: false },
  'protopulse-telemetry':                        { bucket: 'user-prefs', sensitive: false },
  'protopulse-offline':                          { bucket: 'user-prefs', sensitive: false },
  'protopulse-multimodal-input':                 { bucket: 'user-prefs', sensitive: false },
  'protopulse-hidden-projects':                  { bucket: 'user-prefs', sensitive: false },
  'protopulse-mobile-review-config':             { bucket: 'user-prefs', sensitive: false },
  'protopulse-ratsnest-filter':                  { bucket: 'user-prefs', sensitive: false },

  // ─── project-data (project-scoped state) ────────────────────────────────
  // Unprefixed legacy asset keys + legacy sessionId
  'asset-favorites':                             { bucket: 'project-data', sensitive: false },
  'asset-recent':                                { bucket: 'project-data', sensitive: false },
  'asset-custom':                                { bucket: 'project-data', sensitive: false },
  'sessionId':                                   { bucket: 'session-auth', sensitive: true },
  'protopulse-board-settings':                   { bucket: 'project-data', sensitive: false },
  'protopulse-circuit-selection':                { bucket: 'project-data', sensitive: false },
  'protopulse-board-stackup':                    { bucket: 'project-data', sensitive: false },
  'protopulse-copper-pour':                      { bucket: 'project-data', sensitive: false },
  'protopulse-flex-zones':                       { bucket: 'project-data', sensitive: false },
  'protopulse-pcb-bundle':                       { bucket: 'project-data', sensitive: false },
  'protopulse-schematic-bundle':                 { bucket: 'project-data', sensitive: false },
  'protopulse:design-variables':                 { bucket: 'project-data', sensitive: false },
  'protopulse:design-variables:migrated':        { bucket: 'project-data', sensitive: false },
  'protopulse:firmware-snapshots':               { bucket: 'project-data', sensitive: false },
  'protopulse:drc-scripts':                      { bucket: 'project-data', sensitive: false },
  'protopulse:macros':                           { bucket: 'project-data', sensitive: false },
  'protopulse:design-branches':                  { bucket: 'project-data', sensitive: false },
  'protopulse:build-journal':                    { bucket: 'project-data', sensitive: false },
  'protopulse:bus-pin-mapper':                   { bucket: 'project-data', sensitive: false },
  'protopulse:avl-entries':                      { bucket: 'project-data', sensitive: false },
  'protopulse:net-colors':                       { bucket: 'project-data', sensitive: false },
  'protopulse:op-durations':                     { bucket: 'project-data', sensitive: false },
  'protopulse:plugins:state':                    { bucket: 'project-data', sensitive: false },
  'protopulse:fab-pipeline-orders':              { bucket: 'project-data', sensitive: false },
  'protopulse:classroom:assignments':            { bucket: 'project-data', sensitive: false },
  'protopulse:classroom:submissions':            { bucket: 'project-data', sensitive: false },
  'protopulse:review-resolutions':               { bucket: 'project-data', sensitive: false },
  'protopulse-eco-workflows':                    { bucket: 'project-data', sensitive: false },
  'protopulse-creator-profiles':                 { bucket: 'project-data', sensitive: false },
  'protopulse-circuit-challenges':               { bucket: 'project-data', sensitive: false },
  'protopulse-design-imports':                   { bucket: 'project-data', sensitive: false },
  'protopulse-design-snippets':                  { bucket: 'project-data', sensitive: false },
  'protopulse-team-templates':                   { bucket: 'project-data', sensitive: false },
  'protopulse-team-command-center':              { bucket: 'project-data', sensitive: false },
  'protopulse-custom-boards':                    { bucket: 'project-data', sensitive: false },
  'protopulse-component-favorites':              { bucket: 'project-data', sensitive: false },
  'protopulse-alternate-parts':                  { bucket: 'project-data', sensitive: false },
  'protopulse-assembly-cost-estimates':          { bucket: 'project-data', sensitive: false },
  'protopulse-candidate':                        { bucket: 'project-data', sensitive: false },
  'protopulse-pending-starter-circuit':          { bucket: 'project-data', sensitive: false },
  'protopulse-scriptable-commands':              { bucket: 'project-data', sensitive: false },
  'protopulse-sim-compare-snapshots':            { bucket: 'project-data', sensitive: false },
  'protopulse-sim-scenarios':                    { bucket: 'project-data', sensitive: false },
  'protopulse-standards-compliance':             { bucket: 'project-data', sensitive: false },
  'protopulse-twin':                             { bucket: 'project-data', sensitive: false },
  'protopulse-workspace-presets':                { bucket: 'project-data', sensitive: false },
  'protopulse-drc-suppressions':                 { bucket: 'project-data', sensitive: false },
  'protopulse-kanban-board':                     { bucket: 'project-data', sensitive: false },
  'protopulse-mobile-captures':                  { bucket: 'project-data', sensitive: false },
  'protopulse-pcb-orders':                       { bucket: 'project-data', sensitive: false },
  'protopulse-deployment-profiles':              { bucket: 'project-data', sensitive: false },
  'protopulse-dfm-checker':                      { bucket: 'project-data', sensitive: false },
  'protopulse-healing-config':                   { bucket: 'project-data', sensitive: false },

  // ─── history-cache (time-bound retention) ───────────────────────────────
  'protopulse-memory-history':                   { bucket: 'history-cache', sensitive: false },
  'protopulse-import-history':                   { bucket: 'history-cache', sensitive: false },
  'protopulse-command-history':                  { bucket: 'history-cache', sensitive: false },
  'protopulse-damage-assessment-history':        { bucket: 'history-cache', sensitive: false },
  'protopulse-order-history':                    { bucket: 'history-cache', sensitive: false },
  'protopulse-firmware-versions':                { bucket: 'history-cache', sensitive: false },
  'protopulse-recent-projects':                  { bucket: 'history-cache', sensitive: false },
  'protopulse-last-project':                     { bucket: 'history-cache', sensitive: false },
  'protopulse-prediction-feedback':              { bucket: 'history-cache', sensitive: false },
  'protopulse-prediction-dismissals':            { bucket: 'history-cache', sensitive: false },
  'protopulse-design-remix-history':             { bucket: 'history-cache', sensitive: false },
  'protopulse:interaction-history':              { bucket: 'history-cache', sensitive: false },
  'protopulse:keyboard-engine-history':          { bucket: 'history-cache', sensitive: false },
  'protopulse-lab-sessions':                     { bucket: 'history-cache', sensitive: false },
  'protopulse-pcb-order-tracker':                { bucket: 'history-cache', sensitive: false },
  'protopulse-parametric-search':                { bucket: 'history-cache', sensitive: false },
  'protopulse-incident-bundles':                 { bucket: 'history-cache', sensitive: false },
  'protopulse-healing-history':                  { bucket: 'history-cache', sensitive: false },

  // ─── catalog-shared (server-with-cache) ─────────────────────────────────
  'protopulse-marketplace':                      { bucket: 'catalog-shared', sensitive: false },
  'protopulse-marketplace-installed':            { bucket: 'catalog-shared', sensitive: false },
  'protopulse-installed-template-packs':         { bucket: 'catalog-shared', sensitive: false },
  'protopulse-rag-documents':                    { bucket: 'catalog-shared', sensitive: false },
  'protopulse-community-library':                { bucket: 'catalog-shared', sensitive: false },
  'protopulse-lcsc-mapper':                      { bucket: 'catalog-shared', sensitive: false },

  // ─── hardware-presets ───────────────────────────────────────────────────
  'protopulse-safe-commands':                    { bucket: 'hardware-presets', sensitive: false },
  'protopulse-serial-last-preset':               { bucket: 'hardware-presets', sensitive: false },
  'protopulse-serial-presets':                   { bucket: 'hardware-presets', sensitive: false },
  'protopulse:serial:profiles':                  { bucket: 'hardware-presets', sensitive: false },
  'protopulse:serial:preferences':               { bucket: 'hardware-presets', sensitive: false },
  'protopulse:baud:selected':                    { bucket: 'hardware-presets', sensitive: false },
  'protopulse:baud:lastUsed':                    { bucket: 'hardware-presets', sensitive: false },
  'protopulse-bench-robot':                      { bucket: 'hardware-presets', sensitive: false },
  'protopulse-bench-dashboard':                  { bucket: 'hardware-presets', sensitive: false },
  'protopulse-board-viewer-3d':                  { bucket: 'hardware-presets', sensitive: false },
  'protopulse-board-packages':                   { bucket: 'hardware-presets', sensitive: false },
  'protopulse-build-envs':                       { bucket: 'hardware-presets', sensitive: false },
  'protopulse-fs-upload':                        { bucket: 'hardware-presets', sensitive: false },

  // ─── ux-flags (one-time dismissals / onboarding state) ──────────────────
  'protopulse-dismissed-reminders':              { bucket: 'ux-flags', sensitive: false },
  'protopulse-adaptive-hints-dismissed':         { bucket: 'ux-flags', sensitive: false },
  'protopulse-ai-safety-dismissed':              { bucket: 'ux-flags', sensitive: false },
  'protopulse-onboarding-dismissed':             { bucket: 'ux-flags', sensitive: false },
  'protopulse-ctx-menu-hint-seen':               { bucket: 'ux-flags', sensitive: false },
  'protopulse-first-run-checklist':              { bucket: 'ux-flags', sensitive: false },
  'protopulse-pcb-tutorial-state':               { bucket: 'ux-flags', sensitive: false },
  'protopulse-tutorials':                        { bucket: 'ux-flags', sensitive: false },
  'protopulse-completed-tutorials':              { bucket: 'ux-flags', sensitive: false },
  'protopulse-milestone-unlocks':                { bucket: 'ux-flags', sensitive: false },
  'protopulse-mission-mode':                     { bucket: 'ux-flags', sensitive: false },
  'protopulse-smart-hints':                      { bucket: 'ux-flags', sensitive: false },
  'protopulse-ai-review-queue':                  { bucket: 'ux-flags', sensitive: false },
  'protopulse-learning-path':                    { bucket: 'ux-flags', sensitive: false },
  'protopulse-pwa-manager':                      { bucket: 'ux-flags', sensitive: false },
  'protopulse:changelog:lastSeenVersion':        { bucket: 'ux-flags', sensitive: false },
};

// ───────────────────────────────────────────────────────────────────────────
// Parameterized patterns — for keys with runtime-generated suffixes.
// ───────────────────────────────────────────────────────────────────────────
const PARAMETERIZED: Array<{ pattern: RegExp; bucket: StorageBucket; sensitive: boolean }> = [
  { pattern: /^protopulse-panel-layout(:|$)/,                  bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse:design-variables:project:/,           bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse-activity-feed-/,                      bucket: 'history-cache', sensitive: false },
  { pattern: /^protopulse-component-links-/,                    bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse:plugin-data:/,                        bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse-recent-projects(?::|$)/,              bucket: 'history-cache', sensitive: false },
  { pattern: /^protopulse-exported-/,                           bucket: 'project-data',  sensitive: false },
  { pattern: /^protopulse:bom-snapshot-cost:/,                  bucket: 'project-data',  sensitive: false },
  // R4.5 fix #2 (Codex R4 review): parameterized variant per project ID.
  // CURATED 'protopulse-order-history' covers the prefix; parameterized
  // pattern catches `protopulse-order-history:<projectId>` runtime keys.
  { pattern: /^protopulse-order-history(?::|$)/,                bucket: 'history-cache', sensitive: false },
];

// ───────────────────────────────────────────────────────────────────────────
// Sensitive-key oracle — defensive regex for credential-bearing key names.
// Any key matching THIS that doesn't classify as session-auth = FAIL.
// ───────────────────────────────────────────────────────────────────────────
export const SENSITIVE_KEY_ORACLE = /(api[-_:]?keys?|private[-_:]?key|access[-_:]?key|secret|oauth|bearer|credential|token|password|session[-_:]?id$|^sessionId$|jwt|public-api[:_-]?keys|public-api[:_-]?webhooks)/i;

// ───────────────────────────────────────────────────────────────────────────
// Generator main
// ───────────────────────────────────────────────────────────────────────────
function gatherKeysFromRg(): Map<string, Array<{ file: string; line: number }>> {
  const out = new Map<string, Array<{ file: string; line: number }>>();
  // Pattern families (capture the literal key from inside quotes):
  //   1. protopulse[:_-]<rest>   — main convention
  //   2. asset-(favorites|recent|custom)  — unprefixed legacy keys
  //   3. sessionId               — pure legacy in arduino JobHistoryPanel
  //
  // We use rg's `--only-matching` + a PCRE2 lookaround pattern so that lines
  // with multiple `'key'` literals (e.g., `['key-a', 'key-b']`) emit ONE rg
  // line per occurrence — avoids the greedy-regex bug where a single-line
  // multi-quote literal would only surface the last quoted string.
  const patterns = [
    `(?P<key>protopulse[:_-][a-zA-Z0-9:_.\\-]+)`,
    `(?P<key>asset-(?:favorites|recent|custom))`,
    `(?P<key>sessionId)`,
  ];
  let rgOutput = '';
  for (const pat of patterns) {
    try {
      rgOutput +=
        execSync(
          `rg -nP --only-matching --replace '$key' "['\\"]${pat}['\\"]" client/ ` +
            `--glob '*.ts' --glob '*.tsx' --glob '!**/__tests__/**' --glob '!**/bindings.ts'`,
          { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
        ) + '\n';
    } catch {
      // rg exits 1 if no matches — continue
    }
  }
  for (const lineRaw of rgOutput.split('\n')) {
    // Now each line is "<file>:<line>:<key>" with no surrounding noise.
    const m = lineRaw.match(/^([^:]+):(\d+):(.+)$/);
    if (!m) continue;
    const [, file, lineStr, key] = m;
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push({ file, line: Number(lineStr) });
  }
  return out;
}

function classify(key: string): { bucket: StorageBucket; sensitive: boolean } | null {
  if (WINDOW_EVENT_NAMES.has(key)) return { bucket: 'event-name-not-storage', sensitive: false };
  if (IGNORED_LITERALS.has(key)) return null; // intentional skip
  const direct = CURATED[key];
  if (direct) return direct;
  for (const { pattern, bucket, sensitive } of PARAMETERIZED) {
    if (pattern.test(key)) return { bucket, sensitive };
  }
  return null;
}

function main(): void {
  const keys = gatherKeysFromRg();
  const inventory: InventoryEntry[] = [];
  const unclassified: string[] = [];

  for (const [key, callSites] of keys.entries()) {
    const c = classify(key);
    if (!c) {
      if (IGNORED_LITERALS.has(key)) continue;
      unclassified.push(key);
      continue;
    }
    // Sensitive-oracle cross-check: any key matching the oracle MUST be session-auth.
    if (
      SENSITIVE_KEY_ORACLE.test(key) &&
      c.bucket !== 'session-auth' &&
      c.bucket !== 'event-name-not-storage'
    ) {
      console.error(
        `[inventory] SENSITIVE KEY MISCLASSIFIED: "${key}" → ${c.bucket} (expected session-auth)`,
      );
      process.exit(2);
    }
    // Sort callSites for deterministic output (avoids drift-test false positives
    // from rg/Map iteration ordering).
    const sortedSites = [...callSites].sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
    inventory.push({ key, classifiedAs: c.bucket, sensitive: c.sensitive, callSites: sortedSites });
  }

  if (unclassified.length > 0) {
    console.error(`[inventory] ${unclassified.length} UNCLASSIFIED KEYS — add to CURATED, PARAMETERIZED, WINDOW_EVENT_NAMES, or IGNORED_LITERALS:`);
    for (const k of unclassified) console.error(`  ${k}`);
    process.exit(3);
  }

  inventory.sort((a, b) => a.key.localeCompare(b.key));

  const outPath =
    process.env.STORAGE_INVENTORY_OUT ??
    resolve(__dirname, '../../client/src/lib/desktop/storage-key-inventory.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(inventory, null, 2) + '\n');
  console.log(`[inventory] Wrote ${inventory.length} entries to ${outPath}`);
}

main();
