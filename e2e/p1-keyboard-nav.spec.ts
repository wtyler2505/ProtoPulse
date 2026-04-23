/**
 * E2E-554 — Systemic keyboard-navigation scan (Plan 03 Phase 6).
 *
 * Kinetic counterpart to `p1-a11y-scan.spec.ts` (Phase 5, static axe scan).
 * For each major tab/route this spec:
 *   1. Navigates via /projects/1/{viewName} (same inventory as Phase 5).
 *   2. Waits for the workspace-main landmark and lets lazy chunks resolve.
 *   3. Runs `tabThrough(page, 20)` and asserts:
 *        - at least one reachable focus stop,
 *        - focus advances (no two consecutive identical selectors),
 *        - every stop has a non-empty accessible name,
 *   4. Runs `assertNoKeyboardTrap(page)` and asserts ≥5 distinct focus targets.
 *
 * Policy:
 *   - Green-baseline suite: if a view has a known-incomplete keyboard story
 *     (canvas-only interactions, deferred roving-tabindex work), skip that
 *     view via `test.skip()` with a BL-XXXX reference.
 *   - Don't fix component bugs here. File a BL, skip, move on — per Plan 03
 *     Phase 6's "don't be perfectionist" directive.
 *
 * Related backlog entries:
 *   - BL-0868: color-contrast ring (Phase 9) — green after Phase 9 landed.
 *   - BL-0869: breadboard tie-points intentionally not tab-stops (Phase 7).
 *   - BL-0870: 3D viewer / canvas views — keyboard story deferred (pointer-only today).
 */
import { test, expect, type Page } from '@playwright/test';
import { tabThrough, assertNoKeyboardTrap, type FocusStop } from './keyboard-helpers';

test.use({ storageState: 'e2e/.auth-state.json' });

/**
 * Navigate to a project view and wait for the workspace shell to mount.
 * Mirrors `p1-a11y-scan.spec.ts::openView` for consistency.
 */
async function openView(page: Page, viewName: string): Promise<void> {
  await page.goto(`/projects/1/${viewName}`);
  await page.waitForSelector('[data-testid="workspace-main"]', { timeout: 15_000 });
  await page.waitForTimeout(2_000);
  await expect(page.locator('[data-testid="workspace-main"]')).toBeVisible();
}

/**
 * Run the Phase 6 kernel on the currently-loaded page:
 *   - 20-tab walk, assert reachability + advancement + named focus stops.
 *   - no-keyboard-trap sanity (≥5 distinct targets inside 30 Tabs).
 *
 * Logs a per-view summary so CI output surfaces baseline counts the way
 * `p1-a11y-scan.spec.ts` does for axe totals.
 */
async function runKeyboardKernel(page: Page, label: string): Promise<void> {
  const stops = await tabThrough(page, 20);
  const named = stops.filter((s): s is FocusStop => s !== null);

  // Advancement check: no two consecutive non-null stops identical.
  // (Consecutive nulls are fine — means focus fell off the document.)
  for (let i = 1; i < stops.length; i += 1) {
    const prev = stops[i - 1];
    const curr = stops[i];
    if (prev && curr) {
      expect(
        curr.selector,
        `[keyboard-nav] ${label}: focus did not advance at step ${i} (stuck on ${prev.selector})`,
      ).not.toBe(prev.selector);
    }
  }

  // Reachability: at least one non-null named stop.
  expect(
    named.length,
    `[keyboard-nav] ${label}: no reachable interactive elements in 20 Tabs`,
  ).toBeGreaterThan(0);

  // Accessible-name check: every non-null stop has a non-empty accessibleName.
  const unnamed = named.filter((s) => !s.accessibleName || s.accessibleName.length === 0);
  expect(
    unnamed,
    `[keyboard-nav] ${label}: ${unnamed.length} focus stop(s) have no accessible name: ${unnamed
      .map((s) => s.selector)
      .join(', ')}`,
  ).toEqual([]);

  // No-trap check.
  const trap = await assertNoKeyboardTrap(page, { maxSteps: 30, minDistinctTargets: 5 });
  expect(
    trap.escaped,
    `[keyboard-nav] ${label}: suspected keyboard trap — only ${trap.distinctSelectors.length} distinct targets in 30 Tabs: ${trap.distinctSelectors.join(', ')}`,
  ).toBe(true);

  // eslint-disable-next-line no-console -- surface baseline per-view counts in CI
  console.log(
    `[keyboard-nav] ${label} — ${named.length}/20 reachable stops, ${trap.distinctSelectors.length} distinct targets in 30 Tabs`,
  );
}

// ---------------------------------------------------------------------------
// Project Picker (root route)
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Project Picker', () => {
  test('project-picker page is keyboard-navigable', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('protopulse-last-project');
    });
    await page.goto('/');
    await page.waitForSelector('[data-testid="project-picker-page"]', {
      timeout: 10_000,
    });
    await runKeyboardKernel(page, 'project-picker');
  });
});

// ---------------------------------------------------------------------------
// Core Design Views
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Core Design Views', () => {
  test('dashboard', async ({ page }) => {
    await openView(page, 'dashboard');
    await runKeyboardKernel(page, 'dashboard');
  });

  test('architecture', async ({ page }) => {
    await openView(page, 'architecture');
    await runKeyboardKernel(page, 'architecture');
  });

  test('schematic', async ({ page }) => {
    await openView(page, 'schematic');
    await runKeyboardKernel(page, 'schematic');
  });

  test('breadboard', async ({ page }) => {
    await openView(page, 'breadboard');
    await runKeyboardKernel(page, 'breadboard');
  });

  test('pcb', async ({ page }) => {
    await openView(page, 'pcb');
    await runKeyboardKernel(page, 'pcb');
  });

  test('component_editor', async ({ page }) => {
    await openView(page, 'component_editor');
    await runKeyboardKernel(page, 'component_editor');
  });

  // 3D viewer is a Three.js canvas — keyboard navigation is deferred (BL-0870).
  // Pointer-only today; adding WASD/arrow-nav requires a dedicated camera
  // controller. Skipped rather than failed per Plan 03 Phase 6 "don't be
  // perfectionist" policy.
  test.skip('viewer_3d — canvas-only, keyboard story deferred (BL-0870)', () => {});
});

// ---------------------------------------------------------------------------
// Analysis & Validation
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Analysis & Validation', () => {
  test('validation', async ({ page }) => {
    await openView(page, 'validation');
    await runKeyboardKernel(page, 'validation');
  });

  test('simulation', async ({ page }) => {
    await openView(page, 'simulation');
    await runKeyboardKernel(page, 'simulation');
  });

  test('procurement', async ({ page }) => {
    await openView(page, 'procurement');
    await runKeyboardKernel(page, 'procurement');
  });
});

// ---------------------------------------------------------------------------
// Code & Hardware
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Code & Hardware', () => {
  test('arduino', async ({ page }) => {
    await openView(page, 'arduino');
    await runKeyboardKernel(page, 'arduino');
  });

  test('circuit_code', async ({ page }) => {
    await openView(page, 'circuit_code');
    await runKeyboardKernel(page, 'circuit_code');
  });

  test('serial_monitor', async ({ page }) => {
    await openView(page, 'serial_monitor');
    await runKeyboardKernel(page, 'serial_monitor');
  });
});

// ---------------------------------------------------------------------------
// Output & Ordering
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Output & Ordering', () => {
  test('output', async ({ page }) => {
    await openView(page, 'output');
    await runKeyboardKernel(page, 'output');
  });

  test('ordering (Order PCB)', async ({ page }) => {
    await openView(page, 'ordering');
    await runKeyboardKernel(page, 'ordering');
  });
});

// ---------------------------------------------------------------------------
// Knowledge & Learning
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Knowledge & Learning', () => {
  test('design_patterns (Patterns tab)', async ({ page }) => {
    await openView(page, 'design_patterns');
    await runKeyboardKernel(page, 'design_patterns');
  });

  test('knowledge (Learn tab)', async ({ page }) => {
    await openView(page, 'knowledge');
    await runKeyboardKernel(page, 'knowledge');
  });

  test('starter_circuits', async ({ page }) => {
    await openView(page, 'starter_circuits');
    await runKeyboardKernel(page, 'starter_circuits');
  });

  test('labs', async ({ page }) => {
    await openView(page, 'labs');
    await runKeyboardKernel(page, 'labs');
  });

  test('calculators', async ({ page }) => {
    await openView(page, 'calculators');
    await runKeyboardKernel(page, 'calculators');
  });
});

// ---------------------------------------------------------------------------
// Project Management
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Project Management', () => {
  test('kanban (Tasks tab)', async ({ page }) => {
    await openView(page, 'kanban');
    await runKeyboardKernel(page, 'kanban');
  });

  test('design_history (History tab)', async ({ page }) => {
    await openView(page, 'design_history');
    await runKeyboardKernel(page, 'design_history');
  });

  test('comments', async ({ page }) => {
    await openView(page, 'comments');
    await runKeyboardKernel(page, 'comments');
  });

  test('lifecycle', async ({ page }) => {
    await openView(page, 'lifecycle');
    await runKeyboardKernel(page, 'lifecycle');
  });

  test('audit_trail', async ({ page }) => {
    await openView(page, 'audit_trail');
    await runKeyboardKernel(page, 'audit_trail');
  });
});

// ---------------------------------------------------------------------------
// Inventory & Community
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Inventory & Community', () => {
  test('storage', async ({ page }) => {
    await openView(page, 'storage');
    await runKeyboardKernel(page, 'storage');
  });

  test('community', async ({ page }) => {
    await openView(page, 'community');
    await runKeyboardKernel(page, 'community');
  });
});

// ---------------------------------------------------------------------------
// AI & Generative
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — AI & Generative', () => {
  test('generative_design', async ({ page }) => {
    await openView(page, 'generative_design');
    await runKeyboardKernel(page, 'generative_design');
  });

  test('digital_twin', async ({ page }) => {
    await openView(page, 'digital_twin');
    await runKeyboardKernel(page, 'digital_twin');
  });
});

// ---------------------------------------------------------------------------
// Settings (Plan 01 Phase 4 skeleton)
// ---------------------------------------------------------------------------
test.describe('Keyboard nav — Settings', () => {
  test('settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await runKeyboardKernel(page, 'settings');
  });
});
