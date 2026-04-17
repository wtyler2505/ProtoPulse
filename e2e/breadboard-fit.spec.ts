import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test.describe('Breadboard Fit Rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('protopulse-last-project'));
    await page.goto('/');

    const createBtn = page.getByTestId('button-create-project');
    const firstProjectBtn = page.getByTestId('button-create-first-project');

    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
    } else {
      await firstProjectBtn.click();
    }

    await page.getByTestId('input-project-name').fill('Fit Rules Test Project');
    await page.getByTestId('button-confirm-create').click();

    await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', {
      timeout: 15_000,
    });
    
    // Switch to Architecture view if not already there, to place parts
    const archLabel = page.locator('text=Architecture').first();
    await archLabel.click();
    await page.waitForTimeout(2000);
  });

  test('placing off-board only component warns user', async ({ page }) => {
    // Navigate to breadboard view
    await page.locator('text=Breadboard').first().click();
    await page.waitForTimeout(1000);

    // We can simulate an API call or use the UI to add an L298N or Mega 2560
    // since the drag and drop might be complex, let's verify if the toast logic triggers
    // by intercepting the API or triggering the drop manually via page.evaluate
    
    // Alternatively, we can just trigger a component drop if the UI supports a click-to-place
    // In our app, there is a component panel.
    const addComponentBtn = page.getByTestId('button-add-component').first();
    if (await addComponentBtn.isVisible().catch(() => false)) {
      await addComponentBtn.click();
      await page.fill('input[placeholder*="Search"]', 'L298N');
      await page.getByText('L298N Dual Motor Driver Module').first().click();
      
      // Simulate drop on breadboard
      await page.mouse.move(500, 500);
      await page.mouse.down();
      await page.mouse.up();
      
      // Expect toast about off-board placement
      await expect(page.locator('text=This board is too wide for the breadboard')).toBeVisible();
    }
  });
});
