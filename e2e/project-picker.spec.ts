import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

test.describe('Project Picker Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear last-project redirect so we stay on the picker
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('protopulse-last-project');
    });
    await page.goto('/');
  });

  test('page loads and shows ProtoPulse branding', async ({ page }) => {
    await expect(page.getByTestId('project-picker-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ProtoPulse' })).toBeVisible();
  });

  test('project list or empty state is visible', async ({ page }) => {
    const pickerPage = page.getByTestId('project-picker-page');
    await expect(pickerPage).toBeVisible();

    // Either the project grid or the empty state should be present
    const grid = page.getByTestId('project-grid');
    const empty = page.getByTestId('empty-state');
    const hasGrid = await grid.isVisible().catch(() => false);
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasGrid || hasEmpty).toBeTruthy();
  });

  test('create project button exists', async ({ page }) => {
    // Either the "New Project" button (when projects exist) or the "Create Your First Project" button
    const createBtn = page.getByTestId('button-create-project');
    const firstProjectBtn = page.getByTestId('button-create-first-project');
    const hasCreate = await createBtn.isVisible().catch(() => false);
    const hasFirstProject = await firstProjectBtn.isVisible().catch(() => false);
    expect(hasCreate || hasFirstProject).toBeTruthy();
  });

  test('clicking create opens dialog with name and description fields', async ({ page }) => {
    // Click whichever create button is visible
    const createBtn = page.getByTestId('button-create-project');
    const firstProjectBtn = page.getByTestId('button-create-first-project');

    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
    } else {
      await firstProjectBtn.click();
    }

    const dialog = page.getByTestId('create-project-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('input-project-name')).toBeVisible();
    await expect(page.getByTestId('input-project-description')).toBeVisible();
  });

  test('cancel button closes create dialog', async ({ page }) => {
    const createBtn = page.getByTestId('button-create-project');
    const firstProjectBtn = page.getByTestId('button-create-first-project');

    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
    } else {
      await firstProjectBtn.click();
    }

    await expect(page.getByTestId('create-project-dialog')).toBeVisible();
    await page.getByTestId('button-cancel-create').click();
    await expect(page.getByTestId('create-project-dialog')).not.toBeVisible();
  });

  test('create button is disabled when name is empty', async ({ page }) => {
    const createBtn = page.getByTestId('button-create-project');
    const firstProjectBtn = page.getByTestId('button-create-first-project');

    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
    } else {
      await firstProjectBtn.click();
    }

    const confirmBtn = page.getByTestId('button-confirm-create');
    await expect(confirmBtn).toBeDisabled();
  });
});
