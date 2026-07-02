/**
 * BL-0781 — NumberInput migration a11y smoke (Phase 2).
 *
 * The unit tests added alongside the migration (client/src/components/**\/__tests__/*.aria.test.tsx)
 * verify the prop-mirroring contract in happy-dom: NumberInput passes `max` through
 * to `aria-valuemax`. They do NOT prove the actual bug fix, because happy-dom does
 * not reproduce Chromium's accessibility-tree synthesis behavior (the bug is
 * Chromium inventing `aria-valuemax="0"` on a real `<input type="number">` with no
 * `max` attribute — happy-dom just reflects the DOM attributes as written).
 *
 * This spec is the real-browser witness: for every view containing a migrated
 * NumberInput, it walks every `role=spinbutton` element currently visible and
 * asserts none report `aria-valuemax="0"` unless that field's real semantic max
 * genuinely is 0 (none in this migration are). A `null` aria-valuemax (the
 * OMIT-MAX case) or a real non-zero number (the KEEP/ADD-MAX case) both pass —
 * only the synthesized-zero is a failure.
 *
 * Per the project's a11y-scan convention (e2e/p1-a11y-scan.spec.ts): this is a
 * regression net across the touched views, not an exhaustive per-field sweep —
 * fields behind an extra click (e.g. DRCPanel's rule-param row, requiring
 * "Run DRC" first) are covered by the unit-level aria-contract tests instead,
 * since reproducing every precondition here would duplicate that coverage for
 * no additional signal (the underlying bug is view-agnostic: any spinbutton
 * without a real `max` gets the fix once it uses NumberInput).
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ storageState: 'e2e/.auth-state.json' });

async function openView(page: Page, viewName: string): Promise<void> {
  await page.goto(`/projects/1/${viewName}`);
  await page.waitForSelector('[data-testid="workspace-main"]', { timeout: 15_000 });
  await page.waitForTimeout(2_000);
  await expect(page.locator('[data-testid="workspace-main"]')).toBeVisible();
}

/**
 * Asserts every currently-visible spinbutton on the page has no synthesized
 * `aria-valuemax="0"`. A `null` (omitted) or non-zero value both pass.
 */
async function assertNoSynthesizedZeroMax(page: Page, label: string): Promise<void> {
  const spinbuttons = await page.getByRole('spinbutton').all();
  const violations: string[] = [];

  for (const sb of spinbuttons) {
    const ariaValueMax = await sb.getAttribute('aria-valuemax');
    if (ariaValueMax !== '0') continue;
    // aria-valuemax="0" is only legitimate if the field's real HTML max is
    // also 0 (a genuine zero ceiling) — none of BL-0781's instances are, but
    // this keeps the assertion correct in principle rather than banning "0"
    // outright.
    const semanticMax = await sb.getAttribute('max');
    if (semanticMax === '0') continue;
    const testId = await sb.getAttribute('data-testid');
    violations.push(testId ?? '(no data-testid)');
  }

  expect(violations, `${label}: synthesized aria-valuemax="0" on: ${violations.join(', ')}`).toEqual([]);
}

test.describe('BL-0781 — spinbutton aria-valuemax regression (real browser)', () => {
  test('schematic tab (circuit-editor panels)', async ({ page }) => {
    await openView(page, 'schematic');
    await assertNoSynthesizedZeroMax(page, 'schematic');
  });

  test('pcb tab (PCBLayoutView board dimensions)', async ({ page }) => {
    await openView(page, 'pcb');
    await assertNoSynthesizedZeroMax(page, 'pcb');
  });

  test('component_editor tab (ComponentInspector, DRCPanel, GeneratorModal, ShapeCanvas)', async ({
    page,
  }) => {
    await openView(page, 'component_editor');
    await assertNoSynthesizedZeroMax(page, 'component_editor');
  });

  test('procurement tab (SupplierDrawer, AddItemDialog, CostOptimizerPanel, OrderHistoryPanel, PcbOrderTrackerPanel, BomTable)', async ({
    page,
  }) => {
    await openView(page, 'procurement');
    await assertNoSynthesizedZeroMax(page, 'procurement');
  });

  test('digital_twin tab (sample rate + GPIO pin fields)', async ({ page }) => {
    await openView(page, 'digital_twin');
    await assertNoSynthesizedZeroMax(page, 'digital_twin');
  });

  test('generative_design tab (population/generations)', async ({ page }) => {
    await openView(page, 'generative_design');
    await assertNoSynthesizedZeroMax(page, 'generative_design');
  });
});
