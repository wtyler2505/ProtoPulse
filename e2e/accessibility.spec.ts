import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test.describe('Accessibility — Project Picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('protopulse-last-project');
    });
    await page.goto('/');
  });

  test('page has a proper heading structure', async ({ page }) => {
    await expect(page.getByTestId('project-picker-page')).toBeVisible();
    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();
    const h1Text = await h1.first().textContent();
    expect(h1Text?.trim()).toBe('ProtoPulse');
  });

  test('interactive elements have accessible names', async ({ page }) => {
    // Create button should have visible text
    const createBtn = page.getByTestId('button-create-project');
    const firstProjectBtn = page.getByTestId('button-create-first-project');

    if (await createBtn.isVisible().catch(() => false)) {
      const text = await createBtn.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    } else if (await firstProjectBtn.isVisible().catch(() => false)) {
      const text = await firstProjectBtn.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('project cards are keyboard accessible', async ({ page }) => {
    const firstCard = page.locator('[data-testid^="project-card-"]').first();
    if (await firstCard.isVisible().catch(() => false)) {
      // Cards have role="button" and tabIndex=0
      const role = await firstCard.getAttribute('role');
      expect(role).toBe('button');
      const tabIndex = await firstCard.getAttribute('tabindex');
      expect(tabIndex).toBe('0');
    }
  });
});

test.describe('Accessibility — Project Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects/1');
    await page.waitForTimeout(2000);
  });

  test('workspace has heading or landmark content', async ({ page }) => {
    // There should be at least one heading in the workspace
    const headings = page.locator('h1, h2, h3');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('sidebar buttons have visible text or aria-label', async ({ page }) => {
    const buttons = page.locator('nav button, aside button, [role="navigation"] button');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      // At least one of these should be present
      const hasLabel = (text?.trim().length ?? 0) > 0 || !!ariaLabel || !!title;
      expect(hasLabel).toBeTruthy();
    }
  });

  test('no images without alt text', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      // Either has alt text or is decorative (role="presentation" or role="none")
      const isOk = alt !== null || role === 'presentation' || role === 'none';
      expect(isOk).toBeTruthy();
    }
  });
});
