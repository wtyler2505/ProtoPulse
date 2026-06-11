/**
 * ProtoPulse Sidebar Screenshot Catalog (sidebar-only exhaustive pass)
 *
 * Run:
 *   npx tsx scripts/sidebar-screenshot-catalog.ts
 */

import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5000';
const ROOT_DIR = path.resolve('docs/audit-screenshots');
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(ROOT_DIR, `${RUN_STAMP}-sidebar-only`);

const WAIT_SHORT = 300;
const WAIT_MED = 700;
const WAIT_LONG = 1400;

let shotNumber = 0;
const manifest: Array<{
  id: string;
  viewport: string;
  kind: 'panel' | 'element';
  file: string;
  description: string;
  status: 'captured' | 'skipped';
}> = [];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextId(): string {
  shotNumber += 1;
  return String(shotNumber).padStart(3, '0');
}

async function capturePanel(page: Page, viewportSlug: string, name: string, description: string) {
  const id = nextId();
  const file = `${id}_panel_${name}_${viewportSlug}.png`;
  await page.screenshot({
    path: path.join(OUT_DIR, file),
    animations: 'disabled',
    fullPage: false,
  });
  manifest.push({ id, viewport: viewportSlug, kind: 'panel', file, description, status: 'captured' });
}

async function captureElement(locator: Locator, viewportSlug: string, name: string, description: string) {
  const id = nextId();
  const file = `${id}_el_${name}_${viewportSlug}.png`;
  try {
    if (!(await locator.first().isVisible({ timeout: 2500 }))) {
      manifest.push({ id, viewport: viewportSlug, kind: 'element', file, description, status: 'skipped' });
      return;
    }
    await locator.first().screenshot({
      path: path.join(OUT_DIR, file),
      animations: 'disabled',
    });
    manifest.push({ id, viewport: viewportSlug, kind: 'element', file, description, status: 'captured' });
  } catch {
    manifest.push({ id, viewport: viewportSlug, kind: 'element', file, description, status: 'skipped' });
  }
}

async function clickIfVisible(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
    await locator.click({ force: true });
    await wait(WAIT_SHORT);
    return true;
  }
  return false;
}

async function fillIfVisible(page: Page, selector: string, value: string) {
  const locator = page.locator(selector).first();
  if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
    await locator.fill(value);
    await wait(WAIT_SHORT);
    return true;
  }
  return false;
}

async function clearIfVisible(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
    await locator.clear();
    await wait(WAIT_SHORT);
    return true;
  }
  return false;
}

async function openFreshWorkspace(page: Page, projectId: number) {
  await page.goto(`${BASE_URL}/projects/${projectId}`, { waitUntil: 'networkidle' });
  if (await page.locator('[data-testid="sidebar-nav"], [data-testid="workspace-main"]').first().isVisible({ timeout: 8000 }).catch(() => false)) {
    await wait(WAIT_LONG);
    return;
  }

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('protopulse-last-project'));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const createButton = page.getByTestId('button-create-project').or(page.getByRole('button', { name: /new project/i }));
  const firstProjectCard = page.locator('article, [data-testid^="project-card"], .group').filter({ hasText: /Blink LED|Temperature Logger|Motor Controller|Audio Amplifier|IoT Weather Station/i }).first();

  if (await createButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await createButton.first().click();
    if (await page.getByTestId('input-project-name').isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.getByTestId('input-project-name').fill('Sidebar Audit Project');
      await page.getByTestId('button-confirm-create').click();
    }
  } else if (await firstProjectCard.isVisible({ timeout: 4000 }).catch(() => false)) {
    await firstProjectCard.click();
  }

  if (!(await page.locator('[data-testid="sidebar-nav"], [data-testid="workspace-main"]').first().isVisible({ timeout: 6000 }).catch(() => false))) {
    await page.goto(`${BASE_URL}/projects/${projectId}`, { waitUntil: 'networkidle' });
  }

  await page.waitForSelector('[data-testid="sidebar-nav"], [data-testid="workspace-main"]', { timeout: 25_000 });
  await wait(WAIT_LONG);
}

async function authenticatePage(page: Page): Promise<number> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const username = `sidebar-audit-${suffix}`;
  const password = 'SidebarAuditPass123!';

  const registerRes = await page.request.post(`${BASE_URL}/api/auth/register`, {
    data: { username, password },
  });
  let sessionId: string | undefined;
  if (registerRes.ok()) {
    const registerBody = (await registerRes.json()) as { sessionId?: string };
    sessionId = registerBody.sessionId;
  }

  const loginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { username, password },
  });
  if (loginRes.ok()) {
    const loginBody = (await loginRes.json()) as { sessionId?: string };
    sessionId = loginBody.sessionId || sessionId;
  }

  if (!sessionId) {
    throw new Error('Failed to obtain session id for screenshot run');
  }

  const createRes = await page.request.post(`${BASE_URL}/api/projects`, {
    headers: {
      'x-session-id': sessionId,
      'content-type': 'application/json',
    },
    data: {
      name: `Sidebar Audit ${suffix}`,
      description: 'Automated sidebar screenshot capture workspace',
    },
  });
  if (!createRes.ok()) {
    throw new Error(`Failed to create project for screenshot run (${createRes.status()})`);
  }
  const created = (await createRes.json()) as { id: number };
  if (!created?.id) {
    throw new Error('Project create response missing id');
  }

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((sid: string) => {
    localStorage.setItem('protopulse-session-id', sid);
  }, sessionId);
  return created.id;
}

async function addNodesForExplorerAndTimeline(page: Page) {
  const addButton = page.getByTestId('button-add-to-canvas').first();
  if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    for (let i = 0; i < 4; i += 1) {
      await addButton.click();
      await wait(400);
    }
  }
  await wait(WAIT_LONG);
}

async function captureExpandedSidebarStates(page: Page, viewportSlug: string) {
  await capturePanel(page, viewportSlug, 'expanded-default', 'Expanded default sidebar');
  await captureElement(page.getByTestId('sidebar-nav'), viewportSlug, 'sidebar-nav', 'Sidebar container');
  await captureElement(page.getByTestId('sidebar-search'), viewportSlug, 'search-input-default', 'Sidebar search input');
  await captureElement(page.getByTestId('project-explorer'), viewportSlug, 'project-explorer', 'Project explorer container');
  await captureElement(page.getByTestId('timeline-live-indicator'), viewportSlug, 'timeline-live-indicator', 'Timeline live indicator row');

  await page.getByTestId('sidebar-search').hover();
  await wait(WAIT_SHORT);
  await captureElement(page.getByTestId('sidebar-search'), viewportSlug, 'search-hover', 'Search hover state');

  await page.getByTestId('sidebar-search').focus();
  await wait(WAIT_SHORT);
  await captureElement(page.getByTestId('sidebar-search'), viewportSlug, 'search-focus', 'Search focus state');

  await fillIfVisible(page, '[data-testid="sidebar-search"]', 'esp');
  await capturePanel(page, viewportSlug, 'search-active-esp', 'Search active with query "esp"');
  await captureElement(page.locator('[data-testid="fuzzy-match-highlight"]').first(), viewportSlug, 'search-highlight', 'Search highlight segment');

  await fillIfVisible(page, '[data-testid="sidebar-search"]', 'zzzz-not-found');
  await capturePanel(page, viewportSlug, 'search-empty-state', 'Search empty-state with no matches');
  await clearIfVisible(page, '[data-testid="sidebar-search"]');

  await captureElement(page.getByTestId('inline-edit-name'), viewportSlug, 'inline-name-default', 'Inline project name display');
  await page.getByTestId('inline-edit-name').dblclick();
  await wait(WAIT_SHORT);
  await captureElement(page.getByTestId('inline-edit-name'), viewportSlug, 'inline-name-editing', 'Inline project name editing input');
  await page.keyboard.press('Escape');
  await wait(WAIT_SHORT);

  const groupButtons = [
    'sidebar-group-header-design',
    'sidebar-group-header-build',
    'sidebar-group-header-ship',
    'sidebar-group-header-manage',
  ];
  for (const testId of groupButtons) {
    await captureElement(page.getByTestId(testId), viewportSlug, `${testId}-default`, `Group header ${testId}`);
    await clickIfVisible(page, `[data-testid="${testId}"]`);
    await capturePanel(page, viewportSlug, `${testId}-collapsed`, `Group collapsed state ${testId}`);
    await clickIfVisible(page, `[data-testid="${testId}"]`);
    await capturePanel(page, viewportSlug, `${testId}-expanded`, `Group expanded state ${testId}`);
  }

  const explorerSections = ['architecture', 'schematics', 'pcb', 'components', 'bom', 'validation'];
  for (const section of explorerSections) {
    await captureElement(
      page.getByTestId(`explorer-section-${section}`),
      viewportSlug,
      `explorer-section-${section}`,
      `Explorer section row ${section}`,
    );
  }

  const categories = ['mcu', 'sensor', 'power', 'comm', 'connector', 'generic'];
  for (const cat of categories) {
    await captureElement(page.getByTestId(`block-category-${cat}`), viewportSlug, `block-category-${cat}`, `Block category ${cat}`);
    await clickIfVisible(page, `[data-testid="block-category-${cat}"]`);
    await capturePanel(page, viewportSlug, `block-category-${cat}-collapsed`, `Category ${cat} collapsed`);
    await clickIfVisible(page, `[data-testid="block-category-${cat}"]`);
    await capturePanel(page, viewportSlug, `block-category-${cat}-expanded`, `Category ${cat} expanded`);
  }

  for (const filter of ['all', 'User', 'AI']) {
    await clickIfVisible(page, `[data-testid="timeline-filter-${filter}"]`);
    await capturePanel(page, viewportSlug, `timeline-filter-${String(filter).toLowerCase()}`, `Timeline filtered to ${filter}`);
    await captureElement(page.getByTestId(`timeline-filter-${filter}`), viewportSlug, `timeline-filter-btn-${String(filter).toLowerCase()}`, `Timeline filter button ${filter}`);
  }

  await captureElement(page.getByTestId('timeline-show-more'), viewportSlug, 'timeline-show-more-button', 'Timeline show-more button');
  if (await clickIfVisible(page, '[data-testid="timeline-show-more"]')) {
    await capturePanel(page, viewportSlug, 'timeline-expanded-show-more', 'Timeline expanded via show-more');
  }

  const timelineItems = page.locator('[data-testid^="timeline-item-"]');
  const timelineCount = await timelineItems.count();
  for (let i = 0; i < Math.min(timelineCount, 8); i += 1) {
    const item = timelineItems.nth(i);
    await captureElement(item, viewportSlug, `timeline-item-${i + 1}`, `Timeline item index ${i + 1}`);
    await item.click();
    await wait(WAIT_SHORT);
    await captureElement(item, viewportSlug, `timeline-item-${i + 1}-expanded`, `Timeline item index ${i + 1} expanded`);
    await item.click();
    await wait(WAIT_SHORT);
  }

  const undoButtons = page.locator('[data-testid^="timeline-undo-"]');
  const undoCount = await undoButtons.count();
  for (let i = 0; i < Math.min(undoCount, 6); i += 1) {
    await captureElement(undoButtons.nth(i), viewportSlug, `timeline-undo-${i + 1}`, `Timeline undo button index ${i + 1}`);
  }

  await captureElement(page.getByTestId('button-project-settings'), viewportSlug, 'project-settings-toggle', 'Project settings toggle');
  await clickIfVisible(page, '[data-testid="button-project-settings"]');
  await capturePanel(page, viewportSlug, 'project-settings-open', 'Project settings panel open');
  await captureElement(page.getByTestId('settings-name-input'), viewportSlug, 'settings-name-input', 'Settings project name input');
  await captureElement(page.getByTestId('settings-desc-input'), viewportSlug, 'settings-desc-input', 'Settings description input');
  await captureElement(page.getByTestId('button-export-project'), viewportSlug, 'settings-export-button', 'Settings export button');
  await captureElement(page.getByTestId('button-import-project'), viewportSlug, 'settings-import-button', 'Settings import button');
}

async function captureDesktopCollapsedStates(page: Page, viewportSlug: string) {
  await clickIfVisible(page, '[data-testid="toggle-sidebar"]');
  await wait(WAIT_MED);
  await capturePanel(page, viewportSlug, 'collapsed-default', 'Collapsed sidebar icon rail');
  await captureElement(page.getByTestId('sidebar-collapsed'), viewportSlug, 'collapsed-container', 'Collapsed sidebar container');

  const collapsedGroups = ['design', 'build', 'ship', 'manage'];
  for (const group of collapsedGroups) {
    await captureElement(page.getByTestId(`sidebar-group-toggle-${group}`), viewportSlug, `collapsed-group-toggle-${group}`, `Collapsed group toggle ${group}`);
    await clickIfVisible(page, `[data-testid="sidebar-group-toggle-${group}"]`);
    await capturePanel(page, viewportSlug, `collapsed-group-${group}-expanded`, `Collapsed mode group expanded ${group}`);
  }

  const icons = page.locator('[data-testid^="sidebar-icon-"]');
  const iconCount = await icons.count();
  for (let i = 0; i < iconCount; i += 1) {
    const icon = icons.nth(i);
    await icon.hover();
    await wait(WAIT_SHORT);
    await captureElement(icon, viewportSlug, `collapsed-icon-${i + 1}-hover`, `Collapsed icon ${i + 1} hover`);
    await icon.focus();
    await wait(WAIT_SHORT);
    await captureElement(icon, viewportSlug, `collapsed-icon-${i + 1}-focus`, `Collapsed icon ${i + 1} focus`);
  }

  await clickIfVisible(page, '[data-testid="toggle-sidebar"]');
  await wait(WAIT_MED);
  await capturePanel(page, viewportSlug, 're-expanded-after-collapsed', 'Sidebar restored after collapsed state');
}

async function captureResizeStates(page: Page, viewportSlug: string) {
  const handle = page.getByTestId('resize-handle-left');
  if (!(await handle.isVisible({ timeout: 2000 }).catch(() => false))) {
    manifest.push({
      id: nextId(),
      viewport: viewportSlug,
      kind: 'panel',
      file: 'n/a',
      description: 'Resize states unavailable in this viewport',
      status: 'skipped',
    });
    return;
  }

  const box = await handle.boundingBox();
  if (!box) { return; }

  const drag = async (deltaX: number) => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await wait(WAIT_MED);
  };

  await capturePanel(page, viewportSlug, 'resize-baseline', 'Sidebar width baseline');
  await drag(-220);
  await capturePanel(page, viewportSlug, 'resize-min-ish', 'Sidebar near minimum width');
  await drag(300);
  await capturePanel(page, viewportSlug, 'resize-max-ish', 'Sidebar near maximum width');
  await drag(-120);
  await capturePanel(page, viewportSlug, 'resize-restored', 'Sidebar width restored to mid');
}

async function runViewport(browser: Browser, viewport: { name: string; width: number; height: number }) {
  const viewportSlug = `${viewport.name}_${viewport.width}x${viewport.height}`;
  const context: BrowserContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  try {
    const projectId = await authenticatePage(page);
    await openFreshWorkspace(page, projectId);
    await addNodesForExplorerAndTimeline(page);
    await captureExpandedSidebarStates(page, viewportSlug);

    const isDesktopLike = viewport.width >= 1280;
    if (isDesktopLike) {
      await captureDesktopCollapsedStates(page, viewportSlug);
      await captureResizeStates(page, viewportSlug);
      if (await clickIfVisible(page, '[data-testid="toggle-dark-mode"]')) {
        await wait(WAIT_MED);
        await capturePanel(page, viewportSlug, 'dark-theme-expanded', 'Expanded sidebar in dark theme');
        if (await clickIfVisible(page, '[data-testid="toggle-dark-mode"]')) {
          await wait(WAIT_MED);
          await capturePanel(page, viewportSlug, 'light-theme-expanded', 'Expanded sidebar in light theme');
        }
      } else {
        manifest.push({
          id: nextId(),
          viewport: viewportSlug,
          kind: 'panel',
          file: 'n/a',
          description: 'Theme toggle unavailable in this run',
          status: 'skipped',
        });
      }
    } else {
      await clickIfVisible(page, '[data-testid="toggle-sidebar"]');
      await wait(WAIT_MED);
      await capturePanel(page, viewportSlug, 'mobile-tablet-sidebar-open', 'Sidebar opened in overlay mode');
      await captureElement(page.getByTestId('sidebar-backdrop'), viewportSlug, 'mobile-tablet-backdrop', 'Sidebar backdrop on small viewport');
      await clickIfVisible(page, '[data-testid="sidebar-backdrop"]');
      await wait(WAIT_MED);
      await capturePanel(page, viewportSlug, 'mobile-tablet-sidebar-closed', 'Sidebar closed in overlay mode');
    }
  } finally {
    await context.close();
  }
}

function writeManifest() {
  const lines: string[] = [];
  lines.push('# Sidebar Screenshot Catalog');
  lines.push('');
  lines.push(`- Generated at: ${new Date().toISOString()}`);
  lines.push(`- Output directory: \`${OUT_DIR}\``);
  lines.push(`- Total attempted: ${manifest.length}`);
  lines.push(`- Captured: ${manifest.filter((m) => m.status === 'captured').length}`);
  lines.push(`- Skipped: ${manifest.filter((m) => m.status === 'skipped').length}`);
  lines.push('');
  lines.push('| ID | Viewport | Kind | File | Status | Description |');
  lines.push('|---:|---|---|---|---|---|');
  for (const entry of manifest) {
    lines.push(`| ${entry.id} | ${entry.viewport} | ${entry.kind} | \`${entry.file}\` | ${entry.status} | ${entry.description} |`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'MANIFEST.md'), `${lines.join('\n')}\n`, 'utf8');
}

function writeChecklist() {
  const requiredPatterns = [
    'expanded-default',
    'search-active-esp',
    'search-empty-state',
    'project-settings-open',
    'timeline-filter-all',
    'timeline-filter-user',
    'timeline-filter-ai',
    'dark-theme-expanded',
    'light-theme-expanded',
    'collapsed-default',
    'resize-min-ish',
    'resize-max-ish',
    'mobile-tablet-sidebar-open',
  ];

  const files = new Set(manifest.filter((m) => m.status === 'captured').map((m) => m.file));
  const lines: string[] = [];
  lines.push('# Sidebar Capture Checklist');
  lines.push('');
  for (const pattern of requiredPatterns) {
    const ok = Array.from(files).some((f) => f.includes(pattern));
    lines.push(`- [${ok ? 'x' : ' '}] ${pattern}`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'CHECKLIST.md'), `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: true });
  try {
    await runViewport(browser, { name: 'desktop', width: 1920, height: 1080 });
    await runViewport(browser, { name: 'tablet', width: 1024, height: 768 });
    await runViewport(browser, { name: 'mobile', width: 430, height: 932 });
    writeManifest();
    writeChecklist();
    console.log(`Sidebar capture complete: ${OUT_DIR}`);
    console.log(`Captured ${manifest.filter((m) => m.status === 'captured').length}/${manifest.length}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
