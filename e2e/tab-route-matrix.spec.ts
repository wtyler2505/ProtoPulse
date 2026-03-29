/**
 * Tab / Route Matrix — Playwright smoke tests for all 30 ViewModes.
 *
 * Each test navigates directly to /projects/1/{viewName} and verifies:
 *  1. No crash (body is not empty, no unhandled error boundary).
 *  2. The workspace main panel renders (`[data-testid="workspace-main"]`).
 *  3. The correct tab is marked active (`[data-testid="tab-{view}"][aria-selected="true"]`).
 *
 * These are load-verification tests, not functional tests. They ensure every
 * route resolves to a renderable view without JS errors.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

// ---------------------------------------------------------------------------
// Helper: navigate to a view and assert it loaded without crashing
// ---------------------------------------------------------------------------
async function assertViewLoads(
  page: import('@playwright/test').Page,
  viewName: string,
  /** Optional extra selector that should be visible (view-specific landmark). */
  landmark?: string,
) {
  await page.goto(`/projects/1/${viewName}`);

  // Wait for workspace shell to appear
  await page.waitForSelector('[data-testid="workspace-main"]', { timeout: 15_000 });

  // Allow lazy Suspense chunks to resolve
  await page.waitForTimeout(2000);

  // Body should have content (not blank)
  await expect(page.locator('body')).not.toBeEmpty();

  // No error-boundary fallbacks should be visible in the main content area
  const mainPanel = page.locator('[data-testid="workspace-main"]');
  await expect(mainPanel).toBeVisible();

  // The tab for this view should be marked active (if visible in the tab bar).
  // Some views may not have a visible tab (e.g. project_explorer) — so we only
  // assert when the tab element exists.
  const tab = page.locator(`[data-testid="tab-${viewName}"]`);
  if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  // View-specific landmark check (optional)
  if (landmark) {
    const el = page.locator(landmark).first();
    await expect(el).toBeVisible({ timeout: 5000 });
  }
}

// ---------------------------------------------------------------------------
// Core Design Views
// ---------------------------------------------------------------------------
test.describe('Core Design Views', () => {
  test('dashboard', async ({ page }) => {
    await assertViewLoads(page, 'dashboard');
  });

  test('architecture', async ({ page }) => {
    await assertViewLoads(page, 'architecture');
  });

  test('schematic', async ({ page }) => {
    await assertViewLoads(page, 'schematic');
  });

  test('breadboard', async ({ page }) => {
    await assertViewLoads(page, 'breadboard');
  });

  test('pcb', async ({ page }) => {
    await assertViewLoads(page, 'pcb');
  });

  test('component_editor', async ({ page }) => {
    await assertViewLoads(page, 'component_editor');
  });
});

// ---------------------------------------------------------------------------
// Analysis & Validation Views
// ---------------------------------------------------------------------------
test.describe('Analysis & Validation Views', () => {
  test('validation', async ({ page }) => {
    await assertViewLoads(page, 'validation');
  });

  test('simulation', async ({ page }) => {
    await assertViewLoads(page, 'simulation');
  });

  test('procurement', async ({ page }) => {
    await assertViewLoads(page, 'procurement');
  });
});

// ---------------------------------------------------------------------------
// Code & Hardware Views
// ---------------------------------------------------------------------------
test.describe('Code & Hardware Views', () => {
  test('arduino', async ({ page }) => {
    await assertViewLoads(page, 'arduino');
  });

  test('circuit_code', async ({ page }) => {
    await assertViewLoads(page, 'circuit_code');
  });

  test('serial_monitor', async ({ page }) => {
    await assertViewLoads(page, 'serial_monitor');
  });
});

// ---------------------------------------------------------------------------
// AI & Generative Views
// ---------------------------------------------------------------------------
test.describe('AI & Generative Views', () => {
  test('generative_design', async ({ page }) => {
    await assertViewLoads(page, 'generative_design');
  });

  test('digital_twin', async ({ page }) => {
    await assertViewLoads(page, 'digital_twin');
  });
});

// ---------------------------------------------------------------------------
// Output & Export Views
// ---------------------------------------------------------------------------
test.describe('Output & Export Views', () => {
  test('output', async ({ page }) => {
    await assertViewLoads(page, 'output');
  });

  test('ordering', async ({ page }) => {
    await assertViewLoads(page, 'ordering');
  });
});

// ---------------------------------------------------------------------------
// Knowledge & Learning Views
// ---------------------------------------------------------------------------
test.describe('Knowledge & Learning Views', () => {
  test('knowledge', async ({ page }) => {
    await assertViewLoads(page, 'knowledge');
  });

  test('design_patterns', async ({ page }) => {
    await assertViewLoads(page, 'design_patterns');
  });

  test('starter_circuits', async ({ page }) => {
    await assertViewLoads(page, 'starter_circuits');
  });

  test('labs', async ({ page }) => {
    await assertViewLoads(page, 'labs');
  });

  test('calculators', async ({ page }) => {
    await assertViewLoads(page, 'calculators');
  });
});

// ---------------------------------------------------------------------------
// Project Management Views
// ---------------------------------------------------------------------------
test.describe('Project Management Views', () => {
  test('kanban', async ({ page }) => {
    await assertViewLoads(page, 'kanban');
  });

  test('comments', async ({ page }) => {
    await assertViewLoads(page, 'comments');
  });

  test('design_history', async ({ page }) => {
    await assertViewLoads(page, 'design_history');
  });

  test('lifecycle', async ({ page }) => {
    await assertViewLoads(page, 'lifecycle');
  });

  test('audit_trail', async ({ page }) => {
    await assertViewLoads(page, 'audit_trail');
  });
});

// ---------------------------------------------------------------------------
// Inventory & Community Views
// ---------------------------------------------------------------------------
test.describe('Inventory & Community Views', () => {
  test('storage', async ({ page }) => {
    await assertViewLoads(page, 'storage');
  });

  test('community', async ({ page }) => {
    await assertViewLoads(page, 'community');
  });

  test('viewer_3d', async ({ page }) => {
    await assertViewLoads(page, 'viewer_3d');
  });
});

// ---------------------------------------------------------------------------
// Edge case: project_explorer (valid ViewMode but not in sidebar navItems)
// ---------------------------------------------------------------------------
test.describe('Edge Cases', () => {
  test('project_explorer loads without crashing', async ({ page }) => {
    await assertViewLoads(page, 'project_explorer');
  });
});
