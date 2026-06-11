/**
 * BL-0781 — Spinbutton synthesized-valuemax=0 regression smoke (Phase 2 of
 * the NumberInput migration wave).
 *
 * Background:
 *   Chromium's accessibility tree synthesises `aria-valuemax="0"` on
 *   `<input type="number">` elements that lack an explicit HTML `max`
 *   attribute. Assistive tech then announces "spinbutton, max 0" — i.e.
 *   the user can't increment. This breaks E2E-236 / E2E-271 / E2E-284.
 *
 *   The NumberInput primitive at client/src/components/ui/number-input.tsx
 *   is the canonical fix: it mirrors the JSX `max` prop to BOTH the HTML
 *   `max` attribute AND `aria-valuemax`, and omits both when `max` is
 *   intentionally undefined (matching WAI-ARIA 1.2 §spinbutton).
 *
 *   Unit tests in client/src/components/**\/__tests__/*.aria.test.tsx verify
 *   the prop-mirroring CONTRACT in happy-dom. This spec is the real-browser
 *   PROOF: visit each view that owns a migrated spinbutton, walk every
 *   element with `role="spinbutton"`, and fail if any reports
 *   `aria-valuemax="0"` without an actual `max="0"` justification.
 *
 * Coverage:
 *   Views are derived from the 25-file migration cohort
 *   (docs/audits/bl-0781-number-input-audit.md). Each view name maps to the
 *   project route segment used by `e2e/e2e-project.ts`'s
 *   `getSetupProjectPath()` helper (same convention as p1-a11y-scan.spec.ts).
 *
 * Skip-guard:
 *   The whole suite is wrapped in `test.describe.skip(...)` until Phase 1 of
 *   the migration wave lands. Until every cohort has shipped, running this
 *   spec would fail loudly on each migrated-but-not-yet-merged file — a
 *   false alarm. The skip is removed in the same commit that flips BL-0781
 *   to DONE (Phase 3 of the plan).
 *
 * Plan reference: ~/.claude/plans/claude-devfleet-sp-write-plan-bl-0781-hidden-pancake.md
 */
import { test, expect, type Page } from '@playwright/test';

import { getSetupProjectPath } from './e2e-project';

test.use({ storageState: 'e2e/.auth-state.json' });
test.setTimeout(60_000);

/**
 * Views in scope for BL-0781. Each maps to a route the setup-created project
 * exposes (see e2e/p1-a11y-scan.spec.ts for the same convention).
 *
 * Comments cite which migrated files contribute spinbuttons to each view.
 */
const VIEWS: Array<{ slug: string; label: string; sources: string[] }> = [
  { slug: 'breadboard', label: 'Breadboard Lab', sources: ['BreadboardQuickIntake'] },
  {
    slug: 'schematic',
    label: 'Schematic + sub-panels',
    sources: [
      'ScenarioManagerPanel',
      'FailureInjectionPanel',
      'WorstCaseAnalysisPanel',
      'DiffPairLengthMatchPanel',
      'ImpedanceTraceWidthPanel',
      'NetClassPanel',
      'BusPinMappingDialog',
      'FunctionGeneratorPanel',
      'RotationInputPanel',
      'BaudRateSelector',
      'MysteryPartConfigurator',
    ],
  },
  { slug: 'pcb', label: 'PCB Layout', sources: ['PCBLayoutView'] },
  {
    slug: 'component_editor',
    label: 'Component Editor',
    sources: ['DRCPanel', 'ComponentInspector', 'ShapeCanvas', 'GeneratorModal'],
  },
  { slug: 'viewer_3d', label: '3D Viewer (BL-0773 closure)', sources: ['BoardViewer3DView (pre-migrated)'] },
  { slug: 'ordering', label: 'Order PCB (BL-0790 closure)', sources: ['PcbOrderingView (pre-migrated)'] },
  { slug: 'calculators', label: 'Calculators', sources: ['CalculatorsView (pre-migrated)'] },
  {
    slug: 'procurement',
    label: 'Procurement',
    sources: ['BomTable', 'SupplierDrawer', 'AddItemDialog', 'CostOptimizerPanel', 'OrderHistoryPanel', 'PcbOrderTrackerPanel'],
  },
  { slug: 'generative_design', label: 'Generative Design', sources: ['GenerativeDesignView'] },
  { slug: 'digital_twin', label: 'Digital Twin', sources: ['DigitalTwinView'] },
  { slug: 'simulation', label: 'Simulation (Bode plot view; spinbutton-free per audit)', sources: ['(BodePlot is Recharts <XAxis>, no spinbuttons expected)'] },
];

async function openView(page: Page, slug: string): Promise<void> {
  await page.goto(getSetupProjectPath(slug));
  const workspaceMain = page.getByTestId('workspace-main');
  await expect(workspaceMain).toBeVisible({ timeout: 20_000 });
  // Allow lazy chunks + initial effects to settle, matching the cadence used
  // by p1-a11y-scan.spec.ts. Spinbuttons may be inside collapsible sub-panels
  // that lazy-load — give them a beat.
  await page.waitForTimeout(2_000);
  await expect(workspaceMain).toBeVisible();
}

/**
 * Returns `[testid, aria-valuemax, max-attr]` for every spinbutton with a
 * suspicious `aria-valuemax="0"` value. A real semantic max of 0 (e.g. an
 * intentional "no inventory" counter) is allowed: we only flag cases where
 * `aria-valuemax="0"` is present AND the HTML `max` attribute is NOT "0".
 */
async function findSynthesizedValuemaxZero(
  page: Page,
): Promise<Array<{ testId: string; ariaValueMax: string | null; maxAttr: string | null }>> {
  return page.evaluate(() => {
    const offenders: Array<{ testId: string; ariaValueMax: string | null; maxAttr: string | null }> = [];
    const spinbuttons = document.querySelectorAll<HTMLElement>('[role="spinbutton"], input[type="number"]');
    for (const el of Array.from(spinbuttons)) {
      const aria = el.getAttribute('aria-valuemax');
      const maxAttr = el.getAttribute('max');
      if (aria === '0' && maxAttr !== '0') {
        offenders.push({
          testId: el.getAttribute('data-testid') ?? el.getAttribute('id') ?? '(unidentified)',
          ariaValueMax: aria,
          maxAttr,
        });
      }
    }
    return offenders;
  });
}

// ============================================================================
// Phase 1 of BL-0781 shipped 2026-05-27 (all 25 cohort files migrated).
// Skip guard removed. This suite now runs as part of the standard Playwright
// a11y gate.
// ============================================================================
test.describe('BL-0781 — Phase 2 spinbutton smoke', () => {
  for (const view of VIEWS) {
    test(`${view.label}: no spinbutton has synthesized aria-valuemax="0"`, async ({ page }) => {
      await openView(page, view.slug);
      const offenders = await findSynthesizedValuemaxZero(page);
      if (offenders.length > 0) {
        const lines = offenders
          .map((o) => `  ${o.testId} — aria-valuemax="${o.ariaValueMax}", max="${o.maxAttr}"`)
          .join('\n');
        throw new Error(
          `[bl-0781] ${view.label} (${view.slug}) has ${offenders.length} spinbutton(s) ` +
            `with synthesized aria-valuemax="0":\n${lines}\n\n` +
            `Sources in this view: ${view.sources.join(', ')}\n` +
            `Migration spec: docs/audits/bl-0781-number-input-audit.md`,
        );
      }
      expect(offenders).toEqual([]);
    });
  }
});
