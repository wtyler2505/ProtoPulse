/**
 * a11y-helpers — Reusable axe-core/playwright wrappers for the P1 a11y scan suite
 * (Plan 03 Phase 5 / E2E-494 rollup).
 *
 * This module provides `runAxeScan()`, the single entry point the spec should
 * use when scanning a page. The helper:
 *
 * - Applies a consistent baseline tag set: WCAG 2.1 A/AA + best-practice rules.
 * - Excludes third-party / known-noisy selectors that are either (a) rendered
 *   by libraries we do not own (xyflow/React Flow internals), or (b) part of
 *   deliberate visual-only scaffolding (breadboard tie-point circles) that have
 *   their own accessibility story tracked via MASTER_BACKLOG.
 * - Returns a structured summary filtered to `critical` and `serious` impacts —
 *   the two severities Plan 03 Phase 5 treats as gating. `moderate` and `minor`
 *   are still visible in the raw report, but do not fail the spec by default.
 *
 * Usage:
 *   const { criticalSerious, all } = await runAxeScan(page);
 *   expect(criticalSerious).toEqual([]);
 */

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * Tags we scan for by default. Source: axe-core rule metadata.
 *   - wcag2a / wcag2aa:    WCAG 2.0 Level A + AA
 *   - wcag21a / wcag21aa:  WCAG 2.1 deltas (pointer, orientation, etc.)
 *   - best-practice:       Deque's curated best-practice rules (not normative,
 *                          but catches regressions like redundant role="button"
 *                          on native <button>).
 */
const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/**
 * Selectors excluded from every scan.
 *
 * Rationale (keep in sync with docs/audits if this list grows):
 * - `.react-flow__*`          — xyflow internals (architecture/schematic views)
 *                                render SVG markup we do not control; axe flags
 *                                decorative nodes without labels.
 * - `[data-testid^="hole-"]`  — breadboard tie-point circles. 830 of these per
 *                                board; labeling each would drown assistive
 *                                tech. Tracked via the breadboard a11y plan,
 *                                not this scan.
 * - `canvas`                   — raster canvases (PCB/3D preview) are excluded
 *                                from axe scans by policy; their a11y story is
 *                                a separate descriptive text layer.
 */
const DEFAULT_EXCLUDES: string[] = [
  '.react-flow__node',
  '.react-flow__edge',
  '.react-flow__handle',
  '.react-flow__controls',
  '.react-flow__minimap',
  '.react-flow__background',
  '[data-testid^="hole-"]',
  'canvas',
];

export interface RunAxeScanOptions {
  /** Additional include selectors (scan is scoped to these). */
  include?: string[];
  /** Additional exclude selectors (appended to DEFAULT_EXCLUDES). */
  exclude?: string[];
  /** Rule ids to disable for this scan (e.g. ['color-contrast']). */
  disableRules?: string[];
  /** Override the default tag set. */
  tags?: string[];
}

export interface AxeScanSummary {
  /** Violations filtered to impact === 'critical' | 'serious'. */
  criticalSerious: Result[];
  /** All violations axe reported (any impact). */
  all: Result[];
  /** Short human-readable summary for test output. */
  summary: string;
}

/**
 * Run an axe-core scan against the currently-loaded page.
 *
 * The caller is responsible for navigating to the target route and waiting for
 * the view-specific landmark to be visible BEFORE calling this — axe will scan
 * whatever DOM is mounted at the moment of invocation.
 */
export async function runAxeScan(
  page: Page,
  options: RunAxeScanOptions = {},
): Promise<AxeScanSummary> {
  let builder = new AxeBuilder({ page }).withTags(options.tags ?? DEFAULT_TAGS);

  if (options.include && options.include.length > 0) {
    for (const selector of options.include) {
      builder = builder.include(selector);
    }
  }

  const excludes = [...DEFAULT_EXCLUDES, ...(options.exclude ?? [])];
  for (const selector of excludes) {
    builder = builder.exclude(selector);
  }

  if (options.disableRules && options.disableRules.length > 0) {
    builder = builder.disableRules(options.disableRules);
  }

  const results = await builder.analyze();
  const all = results.violations;
  const criticalSerious = all.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  const summary = formatSummary(criticalSerious, all);
  return { criticalSerious, all, summary };
}

function formatSummary(criticalSerious: Result[], all: Result[]): string {
  if (all.length === 0) return 'axe: 0 violations';
  const lines = [
    `axe: ${all.length} total violations (${criticalSerious.length} critical/serious)`,
  ];
  for (const v of criticalSerious) {
    lines.push(
      `  - [${v.impact}] ${v.id}: ${v.nodes.length} node(s) — ${v.help}`,
    );
  }
  return lines.join('\n');
}
