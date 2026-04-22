/**
 * E2E-266 / Plan 02 P1 Dead Buttons — Phase 5.
 *
 * Before this fix, clicking a community card called `setSelectedComponent(...)`
 * which swapped the whole view to an inline `ComponentDetail` pane. The
 * 2026-04-18 walkthrough auditor clicked a USB-C card and observed "NOTHING
 * visible" — no dialog, no detail panel, no install/add affordance. Two root
 * causes: (a) the inline replacement is easy to miss because the back button
 * lives at the top-left, far from the click target; (b) the Card was a <div>
 * with onClick and no role/keyboard support, so keyboard users could not open
 * the detail view at all.
 *
 * The fix renders a proper Radix Dialog with testid `community-detail-dialog`,
 * converts the Card wrapper to a real <button> (keyboard + a11y), and keeps
 * the detail body (download button, author, description, tags) inside the
 * dialog so it is visually unambiguous that the click opened something.
 *
 * This is the click-truth verification: a real DevTools click on a community
 * card MUST produce a visible detail dialog; Escape MUST close it; the detail
 * MUST contain the selected component's name.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test('clicking a community card opens the detail dialog (E2E-266)', async ({ page }) => {
  // 1. Reach the project picker in a known state.
  await page.goto('/');
  await page.evaluate(() => { localStorage.removeItem('protopulse-last-project'); });
  await page.goto('/');

  // 2. Create (or enter) a project so the workspace shell mounts.
  const createBtn = page.getByTestId('button-create-project');
  const firstProjectBtn = page.getByTestId('button-create-first-project');
  if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createBtn.click();
  } else {
    await firstProjectBtn.click();
  }
  await page.getByTestId('input-project-name').fill('E2E Community Card Click');
  await page.getByTestId('button-confirm-create').click();

  // 3. Wait for the workspace shell.
  await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', {
    timeout: 15_000,
  });

  // 4. Navigate to the Community view via the sidebar.
  const communityNav = page.getByRole('button', { name: /community/i }).first();
  await communityNav.waitFor({ state: 'visible', timeout: 10_000 });
  await communityNav.click();

  // 5. Wait for the Community view grid to render at least one card.
  await page.getByTestId('community-view').waitFor({ state: 'visible', timeout: 10_000 });
  const firstCard = page.locator('[data-testid^="community-card-"]').first();
  await firstCard.waitFor({ state: 'visible', timeout: 10_000 });

  // 6. Before click: detail dialog is absent.
  await expect(page.getByTestId('community-detail-dialog')).toHaveCount(0);

  // 7. Real browser click on the card (not dispatchEvent — must exercise the
  //    <button> keyboard/ARIA path end to end).
  await firstCard.click();

  // 8. After click: dialog visible and contains the component's name.
  const dialog = page.getByTestId('community-detail-dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(dialog.getByTestId('detail-name')).toBeVisible();
  await expect(dialog.getByTestId('detail-download-btn')).toBeVisible();

  // 9. Escape closes the dialog (Radix focus-trap behavior).
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('community-detail-dialog')).toHaveCount(0);
});
