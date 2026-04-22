/**
 * E2E-074 / Plan 02 P1 Dead Buttons — Phase 1.
 *
 * Before this fix, `client/src/pages/workspace/WorkspaceHeader.tsx` nested the
 * Coach & Help trigger as:
 *
 *   <Popover>
 *     <PopoverTrigger asChild>
 *       <StyledTooltip>  <-- Radix Slot tries to forward ref/handlers to this
 *         <button />     <-- ...but StyledTooltip internally uses its OWN Slot
 *       </StyledTooltip>     (TooltipTrigger asChild), so the popover's
 *     </PopoverTrigger>      click handler never reaches the button.
 *   </Popover>
 *
 * The idiomatic fix (matching ExplainPanelButton + SidebarHeader elsewhere in
 * the codebase) is to put StyledTooltip OUTSIDE the PopoverTrigger so that
 * PopoverTrigger's Slot wraps the <button> directly:
 *
 *   <Popover>
 *     <StyledTooltip>
 *       <PopoverTrigger asChild>
 *         <button />
 *       </PopoverTrigger>
 *     </StyledTooltip>
 *   </Popover>
 *
 * This test is the click-truth verification: a real DevTools click on
 * `coach-help-button` must produce a visible popover containing the
 * TutorialMenu content. Only a real browser click through the full React +
 * Radix pipeline exercises the prop-forwarding chain correctly.
 */
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test('clicking Coach & Help opens the popover with tutorial menu (E2E-074)', async ({ page }) => {
  // 1. Reach the project picker in a known state.
  await page.goto('/');
  await page.evaluate(() => { localStorage.removeItem('protopulse-last-project'); });
  await page.goto('/');

  // 2. Create (or enter) a project so the WorkspaceHeader mounts.
  const createBtn = page.getByTestId('button-create-project');
  const firstProjectBtn = page.getByTestId('button-create-first-project');
  if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createBtn.click();
  } else {
    await firstProjectBtn.click();
  }
  await page.getByTestId('input-project-name').fill('E2E Coach Popover Project');
  await page.getByTestId('button-confirm-create').click();

  // 3. Wait for the workspace shell + header to render.
  await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', {
    timeout: 15_000,
  });

  const coachButton = page.getByTestId('coach-help-button');
  await coachButton.waitFor({ state: 'visible', timeout: 10_000 });

  // 4. Before click: popover is closed (aria-expanded=false on the Radix trigger).
  await expect(coachButton).toHaveAttribute('aria-expanded', 'false');

  // 5. Click the trigger (real browser click, not dispatchEvent).
  await coachButton.click();

  // 6. After click: aria-expanded flips true AND the TutorialMenu renders inside
  //    the popover content (lazy chunk may take a tick — assertions auto-retry
  //    up to the `expect` timeout configured in playwright.config.ts).
  await expect(coachButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('tutorial-menu')).toBeVisible();
});
