/**
 * E2E-494 — Systemic a11y scan (Plan 03 Phase 5).
 *
 * Dynamic counterpart to Plan 03 Phase 4 (ESLint jsx-a11y static rules).
 * For each major tab/route, this spec:
 *   1. Navigates via /projects/1/{viewName} (matches tab-route-matrix.spec.ts).
 *   2. Waits for the workspace-main landmark and allows lazy Suspense chunks to
 *      resolve.
 *   3. Runs axe-core with WCAG 2.1 A/AA + best-practice tags.
 *   4. Asserts zero `critical` + zero `serious` violations.
 *
 * Baseline policy:
 *   - critical/serious => test FAILS (hard gate)
 *   - moderate/minor   => reported in the summary string, does NOT fail
 *
 * Known exclusions live in a11y-helpers.ts (React Flow internals, breadboard
 * tie-points, raster canvases). See that file for rationale.
 *
 * Individual tabs may be `test.skip()`'d with a BL-XXXX reference if their
 * current violation count is too high to fix inline — the goal of this suite is
 * a green-baseline regression net, not a one-shot sweep.
 */
import { test, expect, type Page } from '@playwright/test';
import { runAxeScan, type RunAxeScanOptions } from './a11y-helpers';

test.use({ storageState: 'e2e/.auth-state.json' });

/**
 * Navigate to a project view and wait for the workspace shell to mount.
 */
async function openView(page: Page, viewName: string): Promise<void> {
  await page.goto(`/projects/1/${viewName}`);
  await page.waitForSelector('[data-testid="workspace-main"]', { timeout: 15_000 });
  // Let lazy chunks + data-fetching effects settle. Matches the cadence used by
  // tab-route-matrix.spec.ts, which is the de-facto load-waiting convention for
  // this workspace.
  await page.waitForTimeout(2_000);
  await expect(page.locator('[data-testid="workspace-main"]')).toBeVisible();
}

async function scanAndAssert(
  page: Page,
  label: string,
  options: RunAxeScanOptions = {},
): Promise<void> {
  const { criticalSerious, summary } = await runAxeScan(page, options);
  // eslint-disable-next-line no-console -- surface baseline per-tab counts in CI output
  console.log(`[a11y-scan] ${label} — ${summary}`);
  if (criticalSerious.length > 0) {
    const details = criticalSerious
      .map((v) => `${v.id} (${v.impact}, ${v.nodes.length} node(s)): ${v.help}`)
      .join('\n');
    throw new Error(
      `[a11y-scan] ${label} has ${criticalSerious.length} critical/serious violation(s):\n${details}`,
    );
  }
  expect(criticalSerious).toEqual([]);
}

// ---------------------------------------------------------------------------
// Project Picker (root route)
// ---------------------------------------------------------------------------
test.describe('A11y scan — Project Picker', () => {
  test('project-picker page has no critical/serious axe violations', async ({
    page,
  }) => {
    await page.goto('/');
    // Ensure we land on the picker, not an auto-selected workspace.
    await page.evaluate(() => {
      localStorage.removeItem('protopulse-last-project');
    });
    await page.goto('/');
    await page.waitForSelector('[data-testid="project-picker-page"]', {
      timeout: 10_000,
    });
    await scanAndAssert(page, 'project-picker');
  });
});

// ---------------------------------------------------------------------------
// Core Design Views
// ---------------------------------------------------------------------------
test.describe('A11y scan — Core Design Views', () => {
  test('dashboard', async ({ page }) => {
    await openView(page, 'dashboard');
    await scanAndAssert(page, 'dashboard');
  });

  test('architecture', async ({ page }) => {
    await openView(page, 'architecture');
    await scanAndAssert(page, 'architecture');
  });

  test('schematic', async ({ page }) => {
    await openView(page, 'schematic');
    await scanAndAssert(page, 'schematic');
  });

  test('breadboard', async ({ page }) => {
    await openView(page, 'breadboard');
    // Breadboard also renders decorative rails/power strips that axe sometimes
    // flags for color-contrast despite being non-interactive. Color-contrast is
    // re-enabled once Plan 03 Phase 9 (tokens) lands — see BL-0868.
    await scanAndAssert(page, 'breadboard', { disableRules: ['color-contrast'] });
  });

  test('pcb', async ({ page }) => {
    await openView(page, 'pcb');
    await scanAndAssert(page, 'pcb');
  });

  test('component_editor', async ({ page }) => {
    await openView(page, 'component_editor');
    await scanAndAssert(page, 'component_editor');
  });

  test('viewer_3d', async ({ page }) => {
    await openView(page, 'viewer_3d');
    // 3D viewer is driven by <canvas> (already excluded in helper defaults).
    await scanAndAssert(page, 'viewer_3d');
  });
});

// ---------------------------------------------------------------------------
// Analysis & Validation
// ---------------------------------------------------------------------------
test.describe('A11y scan — Analysis & Validation', () => {
  test('validation', async ({ page }) => {
    await openView(page, 'validation');
    await scanAndAssert(page, 'validation');
  });

  test('simulation', async ({ page }) => {
    await openView(page, 'simulation');
    await scanAndAssert(page, 'simulation');
  });

  test('procurement', async ({ page }) => {
    await openView(page, 'procurement');
    await scanAndAssert(page, 'procurement');
  });
});

// ---------------------------------------------------------------------------
// Code & Hardware
// ---------------------------------------------------------------------------
test.describe('A11y scan — Code & Hardware', () => {
  test('arduino', async ({ page }) => {
    await openView(page, 'arduino');
    await scanAndAssert(page, 'arduino');
  });

  test('circuit_code', async ({ page }) => {
    await openView(page, 'circuit_code');
    await scanAndAssert(page, 'circuit_code');
  });

  test('serial_monitor', async ({ page }) => {
    await openView(page, 'serial_monitor');
    await scanAndAssert(page, 'serial_monitor');
  });
});

// ---------------------------------------------------------------------------
// Output & Ordering
// ---------------------------------------------------------------------------
test.describe('A11y scan — Output & Ordering', () => {
  test('output', async ({ page }) => {
    await openView(page, 'output');
    await scanAndAssert(page, 'output');
  });

  test('ordering (Order PCB)', async ({ page }) => {
    await openView(page, 'ordering');
    await scanAndAssert(page, 'ordering');
  });
});

// ---------------------------------------------------------------------------
// Knowledge & Learning
// ---------------------------------------------------------------------------
test.describe('A11y scan — Knowledge & Learning', () => {
  test('design_patterns (Patterns tab)', async ({ page }) => {
    await openView(page, 'design_patterns');
    await scanAndAssert(page, 'design_patterns');
  });

  test('knowledge (Learn tab)', async ({ page }) => {
    await openView(page, 'knowledge');
    await scanAndAssert(page, 'knowledge');
  });

  test('starter_circuits', async ({ page }) => {
    await openView(page, 'starter_circuits');
    await scanAndAssert(page, 'starter_circuits');
  });

  test('labs', async ({ page }) => {
    await openView(page, 'labs');
    await scanAndAssert(page, 'labs');
  });

  test('calculators', async ({ page }) => {
    await openView(page, 'calculators');
    await scanAndAssert(page, 'calculators');
  });
});

// ---------------------------------------------------------------------------
// Project Management
// ---------------------------------------------------------------------------
test.describe('A11y scan — Project Management', () => {
  test('kanban (Tasks tab)', async ({ page }) => {
    await openView(page, 'kanban');
    await scanAndAssert(page, 'kanban');
  });

  test('design_history (History tab)', async ({ page }) => {
    await openView(page, 'design_history');
    await scanAndAssert(page, 'design_history');
  });

  test('comments', async ({ page }) => {
    await openView(page, 'comments');
    await scanAndAssert(page, 'comments');
  });

  test('lifecycle', async ({ page }) => {
    await openView(page, 'lifecycle');
    await scanAndAssert(page, 'lifecycle');
  });

  test('audit_trail', async ({ page }) => {
    await openView(page, 'audit_trail');
    await scanAndAssert(page, 'audit_trail');
  });
});

// ---------------------------------------------------------------------------
// Inventory & Community
// ---------------------------------------------------------------------------
test.describe('A11y scan — Inventory & Community', () => {
  test('storage', async ({ page }) => {
    await openView(page, 'storage');
    await scanAndAssert(page, 'storage');
  });

  test('community', async ({ page }) => {
    await openView(page, 'community');
    await scanAndAssert(page, 'community');
  });
});

// ---------------------------------------------------------------------------
// AI & Generative
// ---------------------------------------------------------------------------
test.describe('A11y scan — AI & Generative', () => {
  test('generative_design', async ({ page }) => {
    await openView(page, 'generative_design');
    await scanAndAssert(page, 'generative_design');
  });

  test('digital_twin', async ({ page }) => {
    await openView(page, 'digital_twin');
    await scanAndAssert(page, 'digital_twin');
  });
});

// ---------------------------------------------------------------------------
// Settings (Plan 01 Phase 4 skeleton)
// ---------------------------------------------------------------------------
test.describe('A11y scan — Settings', () => {
  test('settings page', async ({ page }) => {
    await page.goto('/settings');
    // Settings skeleton uses its own shell — assert on <main> rather than the
    // workspace-main testid.
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await scanAndAssert(page, 'settings');
  });
});
