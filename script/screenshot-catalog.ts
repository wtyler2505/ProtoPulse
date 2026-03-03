/**
 * ProtoPulse UI Screenshot Catalog
 *
 * Captures BOTH full-viewport context shots AND individual element screenshots.
 * Run: npx tsx script/screenshot-catalog.ts
 */

import { chromium, type Page, type Browser, type Locator } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5000';
const OUT_DIR = path.resolve('docs/audit-screenshots/2026-02-28-full-catalog');
const WAIT_MS = 800;
const ANIM_WAIT = 400;
const LOAD_WAIT = 1500;

let screenshotCount = 0;
const manifest: { category: string; file: string; description: string; type: 'viewport' | 'element' }[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function wait(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/** Full-viewport screenshot */
async function capturePage(
  page: Page,
  category: string,
  name: string,
  description: string,
  opts: { fullPage?: boolean; viewport?: string } = {}
) {
  const dir = path.join(OUT_DIR, category);
  ensureDir(dir);
  const suffix = opts.viewport ? `_${opts.viewport}` : '';
  const num = String(++screenshotCount).padStart(3, '0');
  const filename = `${num}_${name}${suffix}.png`;
  const filepath = path.join(dir, filename);

  await page.screenshot({ path: filepath, fullPage: opts.fullPage ?? false, animations: 'disabled' });
  manifest.push({ category, file: filename, description, type: 'viewport' });
  console.log(`  [${num}] ${category}/${filename} — ${description}`);
}

/** Element-level screenshot — crops to the exact bounding box of the element */
async function captureEl(
  page: Page,
  selector: string,
  category: string,
  name: string,
  description: string
): Promise<boolean> {
  const dir = path.join(OUT_DIR, category);
  ensureDir(dir);

  try {
    const loc = page.locator(selector).first();
    if (!(await loc.isVisible({ timeout: 2000 }))) {
      console.warn(`    ⚠ Not visible: ${selector}`);
      return false;
    }

    const num = String(++screenshotCount).padStart(3, '0');
    const filename = `${num}_${name}.png`;
    const filepath = path.join(dir, filename);

    await loc.screenshot({ path: filepath, animations: 'disabled' });
    manifest.push({ category, file: filename, description, type: 'element' });
    console.log(`  [${num}] ${category}/${filename} — ${description} (element)`);
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 80) : String(e);
    console.warn(`    ⚠ captureEl failed for "${selector}": ${msg}`);
    return false;
  }
}

/** Element-level screenshot by data-testid */
async function captureTestId(
  page: Page,
  testId: string,
  category: string,
  name: string,
  description: string
): Promise<boolean> {
  return captureEl(page, `[data-testid="${testId}"]`, category, name, description);
}

async function safeClick(page: Page, selector: string, waitAfter = ANIM_WAIT) {
  try {
    await page.waitForSelector(selector, { timeout: 3000 });
    await page.click(selector);
    await wait(waitAfter);
    return true;
  } catch {
    console.warn(`    ⚠ Could not click: ${selector}`);
    return false;
  }
}

async function safeClickTestId(page: Page, testId: string, waitAfter = ANIM_WAIT) {
  return safeClick(page, `[data-testid="${testId}"]`, waitAfter);
}

async function navigateAndWait(page: Page) {
  await page.goto(`${BASE_URL}/projects/1`, { waitUntil: 'networkidle' });
  await wait(LOAD_WAIT);
}

// ─── Phase 1: App Shell & Default State ───────────────────────────────────────

async function captureAppShell(page: Page) {
  console.log('\n═══ PHASE 1: App Shell & Default State ═══');
  await navigateAndWait(page);

  // Full viewport
  await capturePage(page, '01-app-shell', 'full-app-default', 'Full app default — 3-panel layout');
  await capturePage(page, '01-app-shell', 'full-app-fullpage', 'Full app (full page scroll)', { fullPage: true });

  // ── Element: Header / branding ──
  await captureEl(page, 'h1', '01-app-shell', 'el_header-branding', 'ProtoPulse header branding');

  // ── Element: Tab bar ──
  await captureEl(page, '[role="tablist"], [data-testid="tab-architecture"]', '01-app-shell', 'el_tab-bar', 'Main tab navigation bar');

  // ── Element: Individual tabs ──
  for (const tab of ['output', 'architecture', 'component_editor', 'schematic', 'breadboard', 'pcb', 'procurement', 'validation']) {
    await captureTestId(page, `tab-${tab}`, '01-app-shell', `el_tab-${tab}`, `Tab button: ${tab}`);
  }

  // ── Element: Toggle buttons ──
  await captureTestId(page, 'toggle-sidebar', '01-app-shell', 'el_btn-toggle-sidebar', 'Toggle sidebar button');
  await captureTestId(page, 'toggle-chat', '01-app-shell', 'el_btn-toggle-chat', 'Toggle chat button');
  await captureTestId(page, 'toggle-dark-mode', '01-app-shell', 'el_btn-toggle-dark-mode', 'Toggle dark mode button');

  // ── Element: Skip links (visible on focus) ──
  await captureTestId(page, 'skip-to-main', '01-app-shell', 'el_skip-to-main', 'Skip to main content link');
}

// ─── Phase 2: Sidebar ─────────────────────────────────────────────────────────

async function captureSidebar(page: Page) {
  console.log('\n═══ PHASE 2: Sidebar States ═══');
  await navigateAndWait(page);

  // Viewport: sidebar expanded
  await capturePage(page, '02-sidebar', 'sidebar-expanded-default', 'Sidebar expanded — blocks + timeline');

  // ── Element: Search input ──
  await captureTestId(page, 'sidebar-search', '02-sidebar', 'el_sidebar-search', 'Sidebar search input');

  // ── Element: Inline edit project name ──
  await captureTestId(page, 'inline-edit-name', '02-sidebar', 'el_inline-edit-name', 'Inline project name editor');

  // ── Element: Block categories ──
  for (const cat of ['mcu', 'sensor', 'power', 'comm', 'connector']) {
    await captureTestId(page, `block-category-${cat}`, '02-sidebar', `el_block-category-${cat}`, `Block category: ${cat}`);
  }

  // ── Element: Block nodes ──
  for (const id of [1, 2, 3, 4, 5]) {
    await captureTestId(page, `block-node-${id}`, '02-sidebar', `el_block-node-${id}`, `Block node #${id}`);
  }

  // ── Element: Timeline filter buttons ──
  for (const filter of ['all', 'User', 'AI']) {
    await captureTestId(page, `timeline-filter-${filter}`, '02-sidebar', `el_timeline-filter-${filter.toLowerCase()}`, `Timeline filter: ${filter}`);
  }

  // ── Element: Timeline items ──
  for (const id of [1, 2, 3, 4]) {
    await captureTestId(page, `timeline-item-${id}`, '02-sidebar', `el_timeline-item-${id}`, `Timeline item #${id}`);
    await captureTestId(page, `timeline-undo-${id}`, '02-sidebar', `el_timeline-undo-${id}`, `Timeline undo button #${id}`);
  }

  // ── Element: Timeline live indicator ──
  await captureTestId(page, 'timeline-live-indicator', '02-sidebar', 'el_timeline-live-indicator', 'Timeline live indicator dot');

  // ── Element: Project settings button ──
  await captureTestId(page, 'button-project-settings', '02-sidebar', 'el_btn-project-settings', 'Project settings toggle button');

  // Viewport: project settings open
  await safeClickTestId(page, 'button-project-settings', WAIT_MS);
  await capturePage(page, '02-sidebar', 'sidebar-settings-open', 'Sidebar with project settings expanded');

  // ── Element: Settings panel contents ──
  // Try to find the settings section by nearby elements
  await captureEl(page, 'input[value="Smart_Agro_Node_v1"]', '02-sidebar', 'el_settings-project-name-input', 'Project name input field');
  await captureEl(page, 'textarea', '02-sidebar', 'el_settings-description-textarea', 'Project description textarea');

  // Close settings
  await safeClickTestId(page, 'button-project-settings');
  await wait(300);

  // Viewport: search active
  const searchInput = page.locator('[data-testid="sidebar-search"]');
  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.fill('ESP');
    await wait(ANIM_WAIT);
    await capturePage(page, '02-sidebar', 'sidebar-search-active', 'Sidebar search filtering for "ESP"');
    await searchInput.clear();
    await wait(ANIM_WAIT);
  }

  // Viewport: sidebar collapsed
  await safeClickTestId(page, 'toggle-sidebar', WAIT_MS);
  await capturePage(page, '02-sidebar', 'sidebar-collapsed', 'Sidebar collapsed — icon-only strip');

  // ── Element: Collapsed sidebar icon buttons ──
  // When collapsed, the sidebar shows icon buttons for views
  for (const btn of ['Architecture', 'Component Editor', 'Procurement', 'Validation', 'Simulation', 'Output', 'Settings']) {
    await captureEl(page, `button:has-text("${btn}")`, '02-sidebar', `el_sidebar-icon-${btn.toLowerCase().replace(/\s+/g, '-')}`, `Collapsed sidebar icon: ${btn}`);
  }

  // Restore sidebar
  await safeClickTestId(page, 'toggle-sidebar', WAIT_MS);
}

// ─── Phase 3: Architecture View ───────────────────────────────────────────────

async function captureArchitectureView(page: Page) {
  console.log('\n═══ PHASE 3: Architecture View ═══');
  await navigateAndWait(page);
  await safeClickTestId(page, 'tab-architecture');
  await wait(WAIT_MS);

  // Viewport: default with asset library
  await capturePage(page, '03-architecture', 'architecture-default', 'Architecture view — asset library + canvas + chat');

  // ── Element: Asset Library panel ──
  await captureTestId(page, 'asset-search', '03-architecture', 'el_asset-search', 'Asset library search input');
  await captureTestId(page, 'asset-sort', '03-architecture', 'el_asset-sort-btn', 'Asset library sort button');
  await captureTestId(page, 'toggle-asset-manager', '03-architecture', 'el_btn-toggle-asset-manager', 'Toggle asset manager button');
  await captureTestId(page, 'asset-add-custom', '03-architecture', 'el_btn-add-custom-part', 'Add Custom Part button');

  // ── Element: Asset category filter buttons ──
  for (const cat of ['all', 'mcu', 'power', 'comm', 'sensor', 'connector']) {
    await captureTestId(page, `asset-category-${cat}`, '03-architecture', `el_asset-category-${cat}`, `Asset category button: ${cat}`);
  }

  // ── Element: Individual asset items ──
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    await captureTestId(page, `asset-item-${id}`, '03-architecture', `el_asset-item-${id}`, `Asset library item #${id}`);
  }

  // ── Element: Asset item buttons ──
  await captureTestId(page, 'button-add-asset-1', '03-architecture', 'el_btn-add-asset-to-canvas', 'Add asset to canvas button (sample)');

  // Viewport: asset categories
  for (const cat of ['mcu', 'power', 'comm', 'sensor', 'connector']) {
    await safeClickTestId(page, `asset-category-${cat}`);
    await wait(300);
    await capturePage(page, '03-architecture', `architecture-assets-${cat}`, `Architecture — asset library filtered: ${cat}`);
  }
  await safeClickTestId(page, 'asset-category-all');
  await wait(300);

  // ── Element: Toolbar buttons ──
  await captureTestId(page, 'tool-select', '03-architecture', 'el_tool-select', 'Toolbar: select mode button');
  await captureTestId(page, 'tool-pan', '03-architecture', 'el_tool-pan', 'Toolbar: pan mode button');
  await captureTestId(page, 'tool-grid', '03-architecture', 'el_tool-grid', 'Toolbar: grid snap toggle button');
  await captureTestId(page, 'tool-fit', '03-architecture', 'el_tool-fit', 'Toolbar: fit view button');

  // ── Element: ReactFlow controls (zoom in/out/fit/lock) ──
  await captureTestId(page, 'rf__controls', '03-architecture', 'el_rf-controls', 'ReactFlow zoom/interactivity controls');

  // ── Element: Minimap ──
  await captureTestId(page, 'rf__minimap', '03-architecture', 'el_rf-minimap', 'ReactFlow minimap');

  // ── Element: Architecture nodes ──
  for (const id of [1, 2, 3, 4, 5]) {
    await captureTestId(page, `rf__node-${id}`, '03-architecture', `el_arch-node-${id}`, `Architecture node #${id}`);
  }

  // ── Element: Architecture edges ──
  for (const edge of ['e5-2', 'e2-1', 'e1-3', 'e1-4']) {
    await captureTestId(page, `rf__edge-${edge}`, '03-architecture', `el_arch-edge-${edge}`, `Architecture edge ${edge}`);
  }

  // Viewport: close asset library — full canvas
  await safeClickTestId(page, 'toggle-asset-manager', WAIT_MS);
  await capturePage(page, '03-architecture', 'architecture-full-canvas', 'Architecture — full canvas, asset library hidden');

  // ── Element: The full ReactFlow wrapper ──
  await captureTestId(page, 'rf__wrapper', '03-architecture', 'el_rf-canvas-full', 'Full ReactFlow canvas');

  // Viewport: toolbar states
  await safeClickTestId(page, 'tool-pan');
  await capturePage(page, '03-architecture', 'architecture-pan-mode', 'Architecture — pan mode active');
  await safeClickTestId(page, 'tool-select');

  // Viewport: node selected
  const nodeEl = page.locator('[data-testid="rf__node-1"]');
  if (await nodeEl.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nodeEl.click();
    await wait(ANIM_WAIT);
    await capturePage(page, '03-architecture', 'architecture-node-selected', 'Architecture — node selected');
    await captureTestId(page, 'rf__node-1', '03-architecture', 'el_arch-node-selected-detail', 'Selected architecture node close-up');
  }

  // Viewport: context menu
  const nodeEl2 = page.locator('[data-testid="rf__node-2"]');
  if (await nodeEl2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nodeEl2.click({ button: 'right' });
    await wait(ANIM_WAIT);
    await capturePage(page, '03-architecture', 'architecture-context-menu', 'Architecture — right-click context menu');

    // ── Element: The context menu itself ──
    await captureEl(page, '[role="menu"], [data-radix-menu-content]', '03-architecture', 'el_context-menu', 'Right-click context menu (element)');
    await page.keyboard.press('Escape');
    await wait(300);
  }

  // Re-open asset library
  await safeClickTestId(page, 'toggle-asset-manager', WAIT_MS);

  // Viewport: fit view
  await safeClickTestId(page, 'tool-fit');
  await wait(ANIM_WAIT);
  await capturePage(page, '03-architecture', 'architecture-fit-view', 'Architecture — after fit-to-view');
}

// ─── Phase 4: Component Editor ────────────────────────────────────────────────

async function captureComponentEditor(page: Page) {
  console.log('\n═══ PHASE 4: Component Editor ═══');
  await navigateAndWait(page);
  await safeClickTestId(page, 'tab-component_editor');
  await wait(LOAD_WAIT);

  await capturePage(page, '04-component-editor', 'component-editor-default', 'Component Editor — default state');
  await capturePage(page, '04-component-editor', 'component-editor-fullpage', 'Component Editor — full page', { fullPage: true });

  // Try to capture each sub-tab
  for (const tab of ['breadboard', 'schematic', 'pcb', 'metadata', 'pin-table', 'Breadboard', 'Schematic', 'PCB', 'Metadata', 'Pin Table']) {
    const sel = `[data-testid="editor-tab-${tab.toLowerCase()}"], button:has-text("${tab}"):not([data-testid^="tab-"]), [role="tab"]:has-text("${tab}")`;
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click();
      await wait(WAIT_MS);
      const safeName = tab.toLowerCase().replace(/\s+/g, '-');
      await capturePage(page, '04-component-editor', `component-editor-tab-${safeName}`, `Component Editor — ${tab} tab`);

      // Element: the active tab content area
      await captureEl(page, 'main [role="tabpanel"], main > div > div', '04-component-editor', `el_editor-content-${safeName}`, `Component Editor content area: ${tab}`);
    }
  }

  // Capture any visible modals/buttons unique to component editor
  for (const [text, name] of [
    ['Generate', 'generate'],
    ['Modify', 'modify'],
    ['DRC', 'drc'],
    ['Validate', 'validate'],
    ['History', 'history'],
    ['Publish', 'publish'],
    ['Export', 'export-component'],
    ['Import', 'import-component'],
  ]) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await captureEl(page, `button:has-text("${text}")`, '04-component-editor', `el_btn-${name}`, `Component Editor button: ${text}`);
    }
  }
}

// ─── Phase 5: Schematic View ──────────────────────────────────────────────────

async function captureSchematicView(page: Page) {
  console.log('\n═══ PHASE 5: Schematic View ═══');
  await navigateAndWait(page);
  await safeClickTestId(page, 'tab-schematic');
  await wait(LOAD_WAIT);

  await capturePage(page, '05-schematic', 'schematic-default', 'Schematic view — default state');
  await capturePage(page, '05-schematic', 'schematic-fullpage', 'Schematic view — full page', { fullPage: true });

  // Element: any panels, toolbars, canvas areas
  await captureEl(page, '[data-testid*="schematic"], .schematic-canvas, [class*="schematic"]', '05-schematic', 'el_schematic-canvas', 'Schematic canvas area');

  // Buttons specific to schematic
  for (const [text, name] of [
    ['Create Circuit', 'create-circuit'],
    ['Expand', 'expand-arch'],
    ['Components', 'components-panel'],
    ['Power', 'power-panel'],
    ['ERC', 'erc-panel'],
    ['Run ERC', 'run-erc'],
  ]) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await captureEl(page, `button:has-text("${text}")`, '05-schematic', `el_btn-${name}`, `Schematic button: ${text}`);
    }
  }
}

// ─── Phase 6: Breadboard View ─────────────────────────────────────────────────

async function captureBreadboardView(page: Page) {
  console.log('\n═══ PHASE 6: Breadboard View ═══');
  await navigateAndWait(page);
  await safeClickTestId(page, 'tab-breadboard');
  await wait(LOAD_WAIT);

  await capturePage(page, '06-breadboard', 'breadboard-default', 'Breadboard view — default state');
  await capturePage(page, '06-breadboard', 'breadboard-fullpage', 'Breadboard view — full page', { fullPage: true });

  await captureEl(page, '[data-testid*="breadboard"], [class*="breadboard"]', '06-breadboard', 'el_breadboard-canvas', 'Breadboard canvas area');
}

// ─── Phase 7: PCB Layout View ─────────────────────────────────────────────────

async function capturePCBView(page: Page) {
  console.log('\n═══ PHASE 7: PCB Layout View ═══');
  await navigateAndWait(page);
  await safeClickTestId(page, 'tab-pcb');
  await wait(LOAD_WAIT);

  await capturePage(page, '07-pcb', 'pcb-default', 'PCB Layout view — default state');
  await capturePage(page, '07-pcb', 'pcb-fullpage', 'PCB Layout view — full page', { fullPage: true });

  await captureEl(page, '[data-testid*="pcb"], [class*="pcb"]', '07-pcb', 'el_pcb-canvas', 'PCB canvas area');
}

// ─── Phase 8: Procurement / BOM ───────────────────────────────────────────────

async function captureProcurementView(page: Page) {
  console.log('\n═══ PHASE 8: Procurement / BOM ═══');
  await navigateAndWait(page);
  await safeClickTestId(page, 'tab-procurement');
  await wait(LOAD_WAIT);

  await capturePage(page, '08-procurement', 'procurement-default', 'Procurement/BOM — default table view');
  await capturePage(page, '08-procurement', 'procurement-fullpage', 'Procurement/BOM — full page', { fullPage: true });

  // ── Element: BOM table ──
  await captureEl(page, 'table, [data-testid*="bom-table"], [role="table"]', '08-procurement', 'el_bom-table', 'BOM table');

  // ── Element: Individual BOM rows ──
  const rows = page.locator('table tbody tr, [data-testid*="bom-row"]');
  const rowCount = await rows.count().catch(() => 0);
  for (let i = 0; i < Math.min(rowCount, 5); i++) {
    try {
      const row = rows.nth(i);
      if (await row.isVisible({ timeout: 1000 })) {
        const num = String(++screenshotCount).padStart(3, '0');
        const filename = `${num}_el_bom-row-${i + 1}.png`;
        await row.screenshot({ path: path.join(OUT_DIR, '08-procurement', filename), animations: 'disabled' });
        manifest.push({ category: '08-procurement', file: filename, description: `BOM table row #${i + 1}`, type: 'element' });
        console.log(`  [${num}] 08-procurement/${filename} — BOM row #${i + 1} (element)`);
      }
    } catch { /* skip */ }
  }

  // ── Element: Procurement buttons ──
  for (const [text, name] of [
    ['Add Item', 'add-item'],
    ['Add Part', 'add-part'],
    ['Export', 'export'],
    ['Settings', 'settings'],
    ['Preferences', 'preferences'],
  ]) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await captureEl(page, `button:has-text("${text}")`, '08-procurement', `el_btn-${name}`, `Procurement button: ${text}`);
    }
  }

  // Viewport: Add item dialog
  const addBtn = page.locator('button:has-text("Add Item"), button:has-text("Add Part"), [data-testid*="add-bom"]').first();
  if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addBtn.click();
    await wait(WAIT_MS);
    await capturePage(page, '08-procurement', 'procurement-add-dialog', 'Procurement — Add BOM item dialog open');
    await captureEl(page, '[role="dialog"], [data-radix-dialog-content]', '08-procurement', 'el_dialog-add-bom', 'Add BOM item dialog (element)');
    await page.keyboard.press('Escape');
    await wait(300);
  }

  // Viewport: context menu
  const bomRow = page.locator('table tbody tr, [data-testid*="bom-row"]').first();
  if (await bomRow.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bomRow.click({ button: 'right' });
    await wait(ANIM_WAIT);
    await capturePage(page, '08-procurement', 'procurement-context-menu', 'Procurement — BOM row context menu');
    await captureEl(page, '[role="menu"], [data-radix-menu-content]', '08-procurement', 'el_context-menu-bom', 'BOM context menu (element)');
    await page.keyboard.press('Escape');
    await wait(300);
  }
}

// ─── Phase 9: Validation View ─────────────────────────────────────────────────

async function captureValidationView(page: Page) {
  console.log('\n═══ PHASE 9: Validation View ═══');
  await navigateAndWait(page);
  await safeClickTestId(page, 'tab-validation');
  await wait(LOAD_WAIT);

  await capturePage(page, '09-validation', 'validation-default', 'Validation — issues list');
  await capturePage(page, '09-validation', 'validation-fullpage', 'Validation — full page', { fullPage: true });

  // ── Element: Validation issues list ──
  await captureEl(page, '[data-testid*="validation-list"], [data-testid*="issues-list"], [class*="validation"]', '09-validation', 'el_validation-list', 'Validation issues list');

  // ── Element: Individual issues ──
  const issues = page.locator('[data-testid*="validation-issue"], [data-testid*="issue-"]');
  const issueCount = await issues.count().catch(() => 0);
  for (let i = 0; i < Math.min(issueCount, 5); i++) {
    try {
      const issue = issues.nth(i);
      if (await issue.isVisible({ timeout: 1000 })) {
        const num = String(++screenshotCount).padStart(3, '0');
        const filename = `${num}_el_validation-issue-${i + 1}.png`;
        await issue.screenshot({ path: path.join(OUT_DIR, '09-validation', filename), animations: 'disabled' });
        manifest.push({ category: '09-validation', file: filename, description: `Validation issue #${i + 1}`, type: 'element' });
        console.log(`  [${num}] 09-validation/${filename} — Issue #${i + 1} (element)`);
      }
    } catch { /* skip */ }
  }

  // Buttons
  for (const [text, name] of [['Run', 'run'], ['Validate', 'validate'], ['Dismiss', 'dismiss']]) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await captureEl(page, `button:has-text("${text}")`, '09-validation', `el_btn-${name}`, `Validation button: ${text}`);
    }
  }
}

// ─── Phase 10: Output View ────────────────────────────────────────────────────

async function captureOutputView(page: Page) {
  console.log('\n═══ PHASE 10: Output View ═══');
  await navigateAndWait(page);
  await safeClickTestId(page, 'tab-output');
  await wait(LOAD_WAIT);

  await capturePage(page, '10-output', 'output-default', 'Output/Console — default state');
  await capturePage(page, '10-output', 'output-fullpage', 'Output/Console — full page', { fullPage: true });

  // Element: console/output area
  await captureEl(page, '[data-testid*="output-log"], [data-testid*="console"], [class*="output"]', '10-output', 'el_output-log', 'Output log area');

  // Buttons
  for (const [text, name] of [['Copy', 'copy-all'], ['Clear', 'clear']]) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await captureEl(page, `button:has-text("${text}")`, '10-output', `el_btn-${name}`, `Output button: ${text}`);
    }
  }
}

// ─── Phase 11: Chat Panel ─────────────────────────────────────────────────────

async function captureChatPanel(page: Page) {
  console.log('\n═══ PHASE 11: Chat Panel ═══');
  await navigateAndWait(page);

  // Viewport: default
  await capturePage(page, '11-chat', 'chat-default', 'Chat panel — default with messages');

  // ── Element: Chat header ──
  await captureEl(page, 'h3:has-text("ProtoPulse AI")', '11-chat', 'el_chat-header', 'Chat header: ProtoPulse AI');
  await captureTestId(page, 'chat-search-toggle', '11-chat', 'el_btn-chat-search', 'Chat search toggle button');
  await captureTestId(page, 'chat-export', '11-chat', 'el_btn-chat-export', 'Chat export button');
  await captureTestId(page, 'settings-button', '11-chat', 'el_btn-chat-settings', 'Chat settings button');

  // ── Element: Chat messages ──
  for (const id of [1, 2, 3, 4, 5]) {
    await captureTestId(page, `copy-msg-${id}`, '11-chat', `el_copy-msg-btn-${id}`, `Copy message button #${id}`);
  }

  // ── Element: Chat input area ──
  await captureTestId(page, 'chat-input', '11-chat', 'el_chat-input', 'Chat text input');
  await captureTestId(page, 'send-button', '11-chat', 'el_btn-send', 'Send message button');
  await captureTestId(page, 'button-image-upload', '11-chat', 'el_btn-image-upload', 'Image upload button');
  await captureTestId(page, 'button-voice-input', '11-chat', 'el_btn-voice-input', 'Voice input button');
  await captureTestId(page, 'toggle-quick-actions', '11-chat', 'el_btn-toggle-quick-actions', 'Toggle quick actions button');

  // ── Element: Quick action buttons ──
  await captureTestId(page, 'quick-actions-bar', '11-chat', 'el_quick-actions-bar', 'Quick actions bar');
  for (const qa of ['generate-architecture', 'optimize-bom', 'run-validation', 'add-mcu-node', 'project-summary', 'show-help', 'export-bom-csv']) {
    await captureTestId(page, `quick-action-${qa}`, '11-chat', `el_quick-action-${qa}`, `Quick action: ${qa}`);
  }

  // Viewport: settings panel
  await safeClickTestId(page, 'settings-button', WAIT_MS);
  await capturePage(page, '11-chat', 'chat-settings-open', 'Chat — settings panel open');

  // ── Element: Settings contents ──
  // Provider buttons, model select, API key input, temperature, routing strategy
  await captureEl(page, '[data-testid*="settings-panel"], [class*="settings"]', '11-chat', 'el_settings-panel', 'Chat settings panel (element)');

  // Close settings
  await safeClickTestId(page, 'settings-button');
  await wait(300);

  // Viewport: search
  await safeClickTestId(page, 'chat-search-toggle', WAIT_MS);
  await capturePage(page, '11-chat', 'chat-search-active', 'Chat — search bar active');
  await safeClickTestId(page, 'chat-search-toggle');
  await wait(300);

  // Viewport: chat input with text
  const chatInput = page.locator('[data-testid="chat-input"]');
  if (await chatInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await chatInput.fill('design a solar-powered sensor node for agricultural monitoring');
    await wait(300);
    await capturePage(page, '11-chat', 'chat-typing', 'Chat — message being typed');
    await captureTestId(page, 'chat-input', '11-chat', 'el_chat-input-with-text', 'Chat input with text (element)');
    await chatInput.clear();
  }

  // Viewport: collapsed
  await safeClickTestId(page, 'toggle-chat', WAIT_MS);
  await capturePage(page, '11-chat', 'chat-collapsed', 'Chat panel collapsed');

  // Restore
  await safeClickTestId(page, 'toggle-chat', WAIT_MS);

  // Viewport: maximum workspace (both collapsed)
  await safeClickTestId(page, 'toggle-sidebar');
  await safeClickTestId(page, 'toggle-chat', WAIT_MS);
  await capturePage(page, '11-chat', 'workspace-maximized', 'Maximum workspace — sidebar + chat collapsed');
  await safeClickTestId(page, 'toggle-sidebar');
  await safeClickTestId(page, 'toggle-chat', WAIT_MS);
}

// ─── Phase 12: Themes ─────────────────────────────────────────────────────────

async function captureThemes(page: Page) {
  console.log('\n═══ PHASE 12: Theme Toggle ═══');
  await navigateAndWait(page);

  await capturePage(page, '12-themes', 'dark-theme-default', 'Dark theme (default)');

  const themeBtn = page.locator('[data-testid="toggle-dark-mode"]');
  if (await themeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await themeBtn.click();
    await wait(WAIT_MS);
    await capturePage(page, '12-themes', 'light-theme-architecture', 'Light theme — architecture view');

    await safeClickTestId(page, 'tab-procurement', LOAD_WAIT);
    await capturePage(page, '12-themes', 'light-theme-procurement', 'Light theme — procurement view');

    await safeClickTestId(page, 'tab-validation', LOAD_WAIT);
    await capturePage(page, '12-themes', 'light-theme-validation', 'Light theme — validation view');

    await safeClickTestId(page, 'tab-component_editor', LOAD_WAIT);
    await capturePage(page, '12-themes', 'light-theme-component-editor', 'Light theme — component editor');

    // Toggle back
    await themeBtn.click();
    await wait(WAIT_MS);
  }
}

// ─── Phase 13: Keyboard Shortcuts ─────────────────────────────────────────────

async function captureKeyboardShortcuts(page: Page) {
  console.log('\n═══ PHASE 13: Keyboard Shortcuts ═══');
  await navigateAndWait(page);

  await page.keyboard.press('?');
  await wait(WAIT_MS);

  const modal = page.locator('[role="dialog"]').first();
  if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await capturePage(page, '13-modals', 'keyboard-shortcuts-modal', 'Keyboard shortcuts modal');
    await captureEl(page, '[role="dialog"]', '13-modals', 'el_keyboard-shortcuts-dialog', 'Keyboard shortcuts dialog (element)');
    await page.keyboard.press('Escape');
    await wait(300);
  }
}

// ─── Phase 14: Responsive Viewports ───────────────────────────────────────────

async function captureResponsive(browser: Browser) {
  console.log('\n═══ PHASE 14: Responsive Viewports ═══');

  const viewports = {
    'tablet-landscape': { width: 1024, height: 768 },
    'tablet-portrait':  { width: 768, height: 1024 },
    'mobile-large':     { width: 430, height: 932 },
    'mobile-small':     { width: 375, height: 667 },
  };

  for (const [vpName, vpSize] of Object.entries(viewports)) {
    console.log(`  → ${vpName} (${vpSize.width}×${vpSize.height})`);

    const ctx = await browser.newContext({ viewport: vpSize, colorScheme: 'dark' });
    const page = await ctx.newPage();

    await page.addInitScript(() => {
      const s = document.createElement('style');
      s.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
      document.head.appendChild(s);
    });

    await page.goto(`${BASE_URL}/projects/1`, { waitUntil: 'networkidle' });
    await wait(LOAD_WAIT);

    // Viewport screenshots
    await capturePage(page, '14-responsive', `responsive-${vpName}-default`, `Responsive ${vpName} — default`, { viewport: vpName });
    await capturePage(page, '14-responsive', `responsive-${vpName}-fullpage`, `Responsive ${vpName} — full page`, { viewport: vpName, fullPage: true });

    // ── Element: Mobile header ──
    await captureTestId(page, 'mobile-header', '14-responsive', `el_${vpName}-mobile-header`, `${vpName}: mobile header`);
    await captureTestId(page, 'mobile-menu-toggle', '14-responsive', `el_${vpName}-menu-toggle`, `${vpName}: menu toggle button`);
    await captureTestId(page, 'mobile-chat-toggle', '14-responsive', `el_${vpName}-chat-toggle`, `${vpName}: chat toggle button`);

    // Mobile menu open
    if (await safeClickTestId(page, 'mobile-menu-toggle', WAIT_MS)) {
      await capturePage(page, '14-responsive', `responsive-${vpName}-menu-open`, `Responsive ${vpName} — mobile menu open`, { viewport: vpName });
      await page.keyboard.press('Escape');
      await wait(300);
    }

    // Mobile chat open
    if (await safeClickTestId(page, 'mobile-chat-toggle', WAIT_MS)) {
      await capturePage(page, '14-responsive', `responsive-${vpName}-chat-open`, `Responsive ${vpName} — mobile chat open`, { viewport: vpName });
      await page.keyboard.press('Escape');
      await wait(300);
    }

    // ── Element: Mobile bottom nav ──
    await captureTestId(page, 'mobile-bottom-nav', '14-responsive', `el_${vpName}-bottom-nav`, `${vpName}: bottom navigation bar`);
    for (const tab of ['output', 'architecture', 'component_editor', 'schematic', 'breadboard', 'pcb', 'procurement', 'validation']) {
      await captureTestId(page, `bottom-nav-${tab}`, '14-responsive', `el_${vpName}-bottom-nav-${tab}`, `${vpName}: bottom nav ${tab}`);
    }

    // Cycle through views at this viewport
    for (const tab of ['architecture', 'procurement', 'validation', 'component_editor']) {
      if (await safeClickTestId(page, `tab-${tab}`, LOAD_WAIT) || await safeClickTestId(page, `bottom-nav-${tab}`, LOAD_WAIT)) {
        await capturePage(page, '14-responsive', `responsive-${vpName}-${tab}`, `Responsive ${vpName} — ${tab}`, { viewport: vpName });
      }
    }

    await page.close();
    await ctx.close();
  }
}

// ─── Phase 15: Error States ───────────────────────────────────────────────────

async function captureErrorStates(page: Page) {
  console.log('\n═══ PHASE 15: Error States ═══');

  await page.goto(`${BASE_URL}/nonexistent-page`, { waitUntil: 'networkidle' });
  await wait(WAIT_MS);
  await capturePage(page, '15-error-states', '404-not-found', '404 Not Found page');
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

function generateManifest() {
  console.log('\n═══ Generating Manifest ═══');

  const cats = new Map<string, typeof manifest>();
  for (const e of manifest) {
    if (!cats.has(e.category)) cats.set(e.category, []);
    cats.get(e.category)!.push(e);
  }

  const vpCount = manifest.filter(m => m.type === 'viewport').length;
  const elCount = manifest.filter(m => m.type === 'element').length;

  let md = `# UI Screenshot Catalog — ProtoPulse\n\n`;
  md += `> Generated: ${new Date().toISOString()}\n`;
  md += `> Total: **${manifest.length}** screenshots (${vpCount} viewport, ${elCount} element)\n\n`;

  md += `## Summary\n\n`;
  md += `| Category | Viewport | Element | Total |\n|----------|----------|---------|-------|\n`;
  for (const [cat, entries] of cats) {
    const vp = entries.filter(e => e.type === 'viewport').length;
    const el = entries.filter(e => e.type === 'element').length;
    md += `| ${cat} | ${vp} | ${el} | ${entries.length} |\n`;
  }
  md += `| **Total** | **${vpCount}** | **${elCount}** | **${manifest.length}** |\n\n`;

  md += `## All Screenshots\n\n`;
  for (const [cat, entries] of cats) {
    md += `### ${cat}\n\n`;
    md += `| File | Type | Description |\n|------|------|-------------|\n`;
    for (const e of entries) {
      md += `| \`${e.file}\` | ${e.type} | ${e.description} |\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(path.join(OUT_DIR, 'MANIFEST.md'), md);
  console.log(`  Wrote MANIFEST.md (${manifest.length} entries)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ProtoPulse UI Screenshot Catalog                     ║');
  console.log('║  Full Mode — Viewport + Element Screenshots           ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nOutput: ${OUT_DIR}\n`);

  ensureDir(OUT_DIR);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,  // 2x for retina-quality captures
    colorScheme: 'dark',
  });

  const page = await ctx.newPage();

  // Kill animations for deterministic shots
  await page.addInitScript(() => {
    const s = document.createElement('style');
    s.textContent = '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }';
    document.head.appendChild(s);
  });

  const t0 = Date.now();

  try {
    await captureAppShell(page);
    await captureSidebar(page);
    await captureArchitectureView(page);
    await captureComponentEditor(page);
    await captureSchematicView(page);
    await captureBreadboardView(page);
    await capturePCBView(page);
    await captureProcurementView(page);
    await captureValidationView(page);
    await captureOutputView(page);
    await captureChatPanel(page);
    await captureThemes(page);
    await captureKeyboardShortcuts(page);
    await captureErrorStates(page);

    await page.close();
    await ctx.close();

    await captureResponsive(browser);
  } catch (err) {
    console.error('\n❌ Fatal error:', err);
  } finally {
    await browser.close();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  generateManifest();

  const vpCount = manifest.filter(m => m.type === 'viewport').length;
  const elCount = manifest.filter(m => m.type === 'element').length;

  console.log(`\n╔════════════════════════════════════════════════════════╗`);
  console.log(`║  COMPLETE                                              ║`);
  console.log(`║  ${String(manifest.length).padStart(3)} screenshots (${vpCount} viewport + ${elCount} element) in ${elapsed}s`.padEnd(57) + `║`);
  console.log(`╚════════════════════════════════════════════════════════╝`);
}

main().catch(console.error);
