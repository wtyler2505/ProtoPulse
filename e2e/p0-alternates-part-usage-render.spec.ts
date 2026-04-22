/**
 * E2E-481 / E2E-482: Alternates + Part Usage tabs render under anonymous-capable
 * browse endpoints.
 *
 * Before the /api/parts/browse/ allowlist fix (Plan 01 Task 2.2), the global auth
 * middleware 401-ed `GET /api/parts/browse/alternates` and `GET /api/parts/browse/usage`,
 * which broke both browser views on page load. These tests assert the views render
 * their landmark cards without entering the error state.
 *
 * Strategy:
 *  - Use the authenticated storage state (`e2e/.auth-state.json`) established by
 *    `auth.setup.ts`. This is the standard pattern in this repo (see tab-route-matrix.spec.ts).
 *  - Navigate directly to `/projects/1/part_alternates` and `/projects/1/part_usage`.
 *  - Assert the landmark card is visible (`[data-testid="alternates-browser"]` /
 *    `[data-testid="usage-browser"]`) AND the error fallback is NOT visible
 *    (`[data-testid="alternates-browser-error"]` / `[data-testid="usage-browser-error"]`).
 *
 * Running: requires `npm run dev` serving on http://localhost:5000 (webServer
 * fixture in playwright.config.ts handles this automatically).
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test.describe('P0: Alternates + Part Usage tabs render (E2E-481/482)', () => {
  test('part_alternates view loads without erroring (E2E-481)', async ({ page }) => {
    await page.goto('/projects/1/part_alternates');

    // Workspace shell should mount
    await page.waitForSelector('[data-testid="workspace-main"]', { timeout: 15_000 });

    // The PartAlternatesBrowserView landmark must become visible.
    const card = page.locator('[data-testid="alternates-browser"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Error fallback must NOT be visible — this is the regression we are guarding.
    const errorState = page.locator('[data-testid="alternates-browser-error"]');
    await expect(errorState).toHaveCount(0);
  });

  test('part_usage view loads without erroring (E2E-482)', async ({ page }) => {
    await page.goto('/projects/1/part_usage');

    await page.waitForSelector('[data-testid="workspace-main"]', { timeout: 15_000 });

    const card = page.locator('[data-testid="usage-browser"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    const errorState = page.locator('[data-testid="usage-browser-error"]');
    await expect(errorState).toHaveCount(0);
  });
});
