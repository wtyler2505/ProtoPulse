/**
 * E2E-968 / E2E-1037: Light-mode theme toggle must actually change visuals.
 *
 * Before Plan 01 Phase 6, `client/src/index.css` declared `@theme inline { ... }`,
 * and Tailwind v4's `inline` modifier inlines theme variable values directly into
 * generated utility classes at build time (e.g. `bg-background` compiles to
 * `background-color: hsl(225 20% 3%)` rather than `background-color: var(--color-background)`).
 * Consequently the runtime `setProperty('--color-background', ...)` call in
 * `theme-context.tsx` DID update the CSS custom property on <html>, but the
 * Tailwind-generated classes ignored that update because they referenced frozen
 * literal values. Result: classList flipped, inline styles flipped, but visible
 * utility classes didn't react.
 *
 * Strategy:
 *  - Use the authenticated storage state (`e2e/.auth-state.json`) established by
 *    `auth.setup.ts`. The theme toggle lives in `WorkspaceHeader`, so we have to
 *    create/enter a project workspace to render it.
 *  - Capture `getComputedStyle(document.body).backgroundColor` before + after the
 *    toggle click and assert they differ.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test('theme toggle changes computed body background color (E2E-968/1037)', async ({ page }) => {
  // 1. Go to picker and clear last-project to ensure a known starting state
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('protopulse-last-project'));
  await page.goto('/');

  // 2. Create a fresh project so the WorkspaceHeader (which hosts ThemeToggle) renders
  const createBtn = page.getByTestId('button-create-project');
  const firstProjectBtn = page.getByTestId('button-create-first-project');
  if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createBtn.click();
  } else {
    await firstProjectBtn.click();
  }
  await page.getByTestId('input-project-name').fill('E2E Theme Toggle Project');
  await page.getByTestId('button-confirm-create').click();

  // 3. Wait for workspace to mount
  await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', {
    timeout: 15_000,
  });
  // Ensure the header (lazy-loaded) is in the DOM
  await page.getByTestId('theme-toggle').waitFor({ state: 'visible', timeout: 10_000 });

  // 4. Capture body background before the toggle click
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  // 5. Click the toggle
  await page.getByTestId('theme-toggle').click();

  // 6. Give the theme-context useEffect a tick to apply the new preset
  await page.waitForTimeout(300);

  // 7. Capture body background after the toggle click; assert it actually changed
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  expect(after).not.toBe(before);
});
