import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test.describe('Project Workspace', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Go to picker and clear last-project to ensure we don't auto-redirect
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('protopulse-last-project'));
    await page.goto('/');

    // 2. Create a fresh project for the test
    const createBtn = page.getByTestId('button-create-project');
    const firstProjectBtn = page.getByTestId('button-create-first-project');

    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
    } else {
      await firstProjectBtn.click();
    }


    await page.getByTestId('input-project-name').fill('E2E Test Project');
    await page.getByTestId('button-confirm-create').click();

    // 3. Wait for the workspace to load
    await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', {
      timeout: 15_000,
    });
    // Give lazy-loaded components time to mount
    await page.waitForTimeout(2000);
  });


  test('page loads without crashing', async ({ page }) => {
    // The page should not show the Not Found page
    await expect(page.locator('text=404')).not.toBeVisible();
    // Should have some content rendered
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('sidebar navigation is visible', async ({ page }) => {
    // The sidebar contains nav items — look for known view labels
    const sidebar = page.locator('nav, [role="navigation"], aside').first();
    await expect(sidebar).toBeVisible();
  });

  test('architecture view is the default view', async ({ page }) => {
    // Architecture is the default tab — look for its content or active nav indicator
    const archLabel = page.locator('text=Architecture').first();
    await expect(archLabel).toBeVisible();
  });

  test('can see multiple nav items for different views', async ({ page }) => {
    // These labels come from sidebar-constants.ts and are always visible
    const expectedLabels = ['Architecture', 'Simulation', 'Tasks', 'Learn'];
    for (const label of expectedLabels) {
      const el = page.locator(`text=${label}`).first();
      await expect(el).toBeVisible();
    }
  });

  test('chat panel is visible', async ({ page }) => {
    // The chat panel should show the AI chat header or input
    const chatHeader = page.locator('text=ProtoPulse AI').first();
    const chatInput = page.locator('textarea[placeholder*="message" i]').first();
    const hasHeader = await chatHeader.isVisible().catch(() => false);
    const hasInput = await chatInput.isVisible().catch(() => false);
    expect(hasHeader || hasInput).toBeTruthy();
  });

  test('clicking a nav item switches the active view', async ({ page }) => {
    // 1. Add a node to unlock advanced tabs (Procurement, etc.)
    await page.getByTestId('button-add-to-canvas').first().click();
    await page.waitForTimeout(2000); // Wait for sync debounce

    // 2. Click on "Procurement" in the sidebar
    const procurementNav = page.locator('text=Procurement').first();
    await procurementNav.click();
    await page.waitForTimeout(1000);

    // The procurement view should now be showing — look for BOM-related content or tab indicator
    const procurementContent = page.locator('text=Bill of Materials, text=BOM, text=Procurement').first();
    await expect(procurementContent).toBeVisible();
  });

});
