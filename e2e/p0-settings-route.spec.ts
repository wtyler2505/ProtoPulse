/**
 * E2E-502: /settings route renders a skeleton page instead of 404.
 *
 * Before Plan 01 Phase 4, visiting /settings fell through Wouter's <Switch>
 * to the NotFound page. This spec guards the route by asserting the
 * SettingsPage landmark is visible and the 404 fallback is NOT rendered.
 *
 * Full settings catalog (theme picker, API key manager, etc.) is tracked in
 * plan 17 (17-shell-header-nav.md) and is intentionally out of scope.
 *
 * Strategy: use the shared authenticated storage state established by
 * `auth.setup.ts` (same pattern as `p0-alternates-part-usage-render.spec.ts`).
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test.describe('P0: /settings route renders skeleton (E2E-502)', () => {
  test('/settings shows the Settings heading and tabs', async ({ page }) => {
    await page.goto('/settings');

    // The page landmark must mount.
    const pageEl = page.locator('[data-testid="settings-page"]');
    await expect(pageEl).toBeVisible({ timeout: 15_000 });

    // The h1 heading is the canonical "this is the settings page" signal.
    const heading = page.getByRole('heading', { level: 1, name: /^settings$/i });
    await expect(heading).toBeVisible();

    // All three placeholder tabs must render.
    await expect(page.locator('[data-testid="settings-tab-profile"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-tab-appearance"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-tab-api-keys"]')).toBeVisible();

    // The 404 fallback must NOT render — this is the regression we are guarding.
    await expect(page.locator('[data-testid="not-found-page"]')).toHaveCount(0);
    await expect(page.getByText(/page not found/i)).toHaveCount(0);
  });
});
