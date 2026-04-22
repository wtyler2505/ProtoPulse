/**
 * E2E-228 / E2E-235 / E2E-270 — Plan 02 Phase 4.
 *
 * Before this fix, PCBLayoutView, BoardViewer3DView, and PcbOrderingView each
 * held independent local state for the physical board dimensions, seeded from
 * three different hardcoded defaults (50×40mm, 100×80mm, 100×80mm). Editing
 * in one tab did not propagate to the others.
 *
 * The fix introduces a shared `boards` table (one row per project) and a
 * `useProjectBoard()` hook. All three views read from and write to this
 * single source of truth via `/api/projects/:id/board`.
 *
 * This spec is the click-truth verification: resize in the PCB tab, navigate
 * to the 3D View tab, and assert the new dimensions are reflected there.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test('board dimensions edited in PCB tab propagate to 3D View (E2E-228)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.removeItem('protopulse-last-project'); });
  await page.goto('/');

  const createBtn = page.getByTestId('button-create-project');
  const firstProjectBtn = page.getByTestId('button-create-first-project');
  if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createBtn.click();
  } else {
    await firstProjectBtn.click();
  }
  await page.getByTestId('input-project-name').fill('E2E Board SoT Project');
  await page.getByTestId('button-confirm-create').click();

  await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', {
    timeout: 15_000,
  });

  // Visit PCB tab. PCBLayoutView exposes width/height inputs as the first two
  // elements below the toolbar — their value is in cm (boardWidth / 10 in the
  // component), so 60mm displays as 6. Skip that complication by navigating
  // via the view switcher when available, otherwise rely on direct hash/nav.
  await page.getByRole('button', { name: /pcb/i }).first().click({ trial: false }).catch(() => undefined);

  // Resize the board. The exact selectors depend on the PCB layout toolbar;
  // fall back to input by label if testIds shift.
  const widthInput = page.getByLabel(/width/i).first();
  const heightInput = page.getByLabel(/height/i).first();
  await widthInput.waitFor({ state: 'visible', timeout: 10_000 });
  await widthInput.fill('6');  // cm -> 60mm
  await heightInput.fill('5');  // cm -> 50mm

  // Let the 500ms debounce + PUT land.
  await page.waitForTimeout(1500);

  // Navigate to 3D View. Not every workspace shell has a visible "3D" link,
  // but PCBLayoutView includes a `pcb-view-3d` button that jumps there.
  const view3dBtn = page.getByTestId('pcb-view-3d');
  if (await view3dBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await view3dBtn.click();
  } else {
    await page.getByRole('button', { name: /3d/i }).first().click();
  }

  // Assert the 3D view's dimensions display matches what we just set.
  await expect(page.getByTestId('board-width')).toContainText('60', { timeout: 10_000 });
  await expect(page.getByTestId('board-height')).toContainText('50', { timeout: 10_000 });
});
