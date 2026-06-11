#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function argValue(name, fallback = null) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return fallback;
  return args[i + 1];
}

const rawScope = argValue('--scope', 'sidebar');
const scope = rawScope === 'full' ? 'full-app' : rawScope;
const dryRun = args.includes('--dry-run');
const allowPanelErrors = args.includes('--allow-panel-errors');
const baseOut = argValue('--out', 'docs/audit-screenshots');
const keepCount = Number.parseInt(argValue('--keep', '2') ?? '2', 10);
const pilot = args.includes('--pilot');
const maxElementsPerView = Number.parseInt(argValue('--max-elements', '120') ?? '120', 10);
const maxInteractionsPerView = Number.parseInt(argValue('--max-interactions', '45') ?? '45', 10);
const seedMode = argValue('--seed-mode', 'mixed');
const currentProjectId = Number.parseInt(argValue('--current-project-id', '1') ?? '1', 10);
const requestedViewports = String(argValue('--viewports', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const onlyFilters = String(argValue('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.resolve(baseOut, `${stamp}-${scope}-catalog`);
const latestDir = path.resolve(baseOut, `latest-${scope}-catalog`);
const manifestPath = path.join(runDir, 'MANIFEST.md');
const manifestJsonPath = path.join(runDir, 'MANIFEST.json');
const summaryPath = path.join(runDir, 'SUMMARY.json');
const checklistPath = path.join(runDir, 'CHECKLIST.md');
const crosswalkPath = path.join(runDir, 'CROSSWALK.md');
const failuresPath = path.join(runDir, 'FAILURES.md');
const bootstrapPath = path.resolve('.tmp/screenshot-capture-super/bootstrap.json');

const REPORT_PATH = 'docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md';
const SIDEBAR_CONSTANTS_PATH = 'client/src/components/layout/sidebar/sidebar-constants.ts';

const VIEWPORTS = {
  desktop: { name: 'desktop', width: 1920, height: 1080 },
  laptop: { name: 'laptop', width: 1366, height: 768 },
  'short-laptop': { name: 'short-laptop', width: 1280, height: 720 },
  tablet: { name: 'tablet', width: 1024, height: 768 },
  mobile: { name: 'mobile', width: 430, height: 932 },
};

const DEFAULT_FULL_VIEWPORTS = ['desktop', 'laptop', 'short-laptop', 'tablet', 'mobile'];

const SKILL_TO_VIEW = {
  'pp-view-3d': 'viewer_3d',
  'pp-view-ai-chat': 'shell:ai-chat',
  'pp-view-alternates': 'part_alternates',
  'pp-view-architecture': 'architecture',
  'pp-view-arduino': 'arduino',
  'pp-view-audit-trail': 'audit_trail',
  'pp-view-bom-templates': 'bom_templates',
  'pp-view-breadboard': 'breadboard',
  'pp-view-calculators': 'calculators',
  'pp-view-circuit-code': 'circuit_code',
  'pp-view-comments': 'comments',
  'pp-view-community': 'community',
  'pp-view-component-editor': 'component_editor',
  'pp-view-dashboard': 'dashboard',
  'pp-view-digital-twin': 'digital_twin',
  'pp-view-exports': 'output',
  'pp-view-generative': 'generative_design',
  'pp-view-history': 'design_history',
  'pp-view-inventory': 'storage',
  'pp-view-labs': 'labs',
  'pp-view-learn': 'knowledge',
  'pp-view-left-sidebar': 'shell:left-sidebar',
  'pp-view-lifecycle': 'lifecycle',
  'pp-view-my-parts': 'personal_inventory',
  'pp-view-order-pcb': 'ordering',
  'pp-view-part-usage': 'part_usage',
  'pp-view-patterns': 'design_patterns',
  'pp-view-pcb': 'pcb',
  'pp-view-procurement': 'procurement',
  'pp-view-project-explorer': 'shell:project-explorer',
  'pp-view-right-sidebar': 'shell:right-sidebar',
  'pp-view-schematic': 'schematic',
  'pp-view-serial-monitor': 'serial_monitor',
  'pp-view-simulation': 'simulation',
  'pp-view-starter-circuits': 'starter_circuits',
  'pp-view-supply-chain': 'supply_chain',
  'pp-view-tasks': 'kanban',
  'pp-view-uiux-design': 'shell:uiux-design',
  'pp-view-validation': 'validation',
  'pp-view-vault': 'vault_browser',
};

const PILOT_VIEW_KEYS = new Set([
  'dashboard',
  'shell:ai-chat',
  'shell:left-sidebar',
  'shell:right-sidebar',
  'validation',
  'output',
]);

const CLICK_DENY = /\b(delete|remove|logout|sign out|reset|clear all|confirm|submit|save|apply|create|upload|download|export|order|purchase|pay|install|uninstall|compile|flash|run|send|connect|disconnect|cancel job|close project)\b/i;
const NAV_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 10_000;

const STABLE_SCREENSHOT_STYLE = `
  *, *::before, *::after {
    caret-color: transparent !important;
    transition-duration: 0s !important;
    animation-duration: 0s !important;
  }
  [data-testid*="live" i],
  [data-testid*="timestamp" i],
  [data-testid*="cursor" i],
  .animate-pulse,
  .animate-spin {
    animation: none !important;
  }
`;

function screenshotOptions(extra = {}) {
  return {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
    style: STABLE_SCREENSHOT_STYLE,
    ...extra,
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmDirIfExists(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function cpDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function writeArtifacts(payload) {
  ensureDir(runDir);
  fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2));
  if (payload.scope === 'full-app') {
    fs.writeFileSync(manifestJsonPath, JSON.stringify(payload.manifestRows ?? [], null, 2));
    fs.writeFileSync(crosswalkPath, renderCrosswalk(payload));
    fs.writeFileSync(failuresPath, renderFailures(payload));
  }
  fs.writeFileSync(
    manifestPath,
    payload.scope === 'full-app' ? renderFullManifest(payload) : renderBasicManifest(payload),
  );
  fs.writeFileSync(
    checklistPath,
    payload.scope === 'full-app' ? renderFullChecklist(payload) : renderBasicChecklist(payload),
  );
}

function renderBasicManifest(payload) {
  return [
    '# Screenshot Capture Manifest',
    '',
    `- scope: ${scope}`,
    `- created_at: ${payload.createdAt}`,
    `- dry_run: ${String(payload.dryRun)}`,
    `- allow_panel_errors: ${String(payload.allowPanelErrors)}`,
    `- status: ${payload.status}`,
    `- delegated_script: ${payload.delegatedScript || 'none'}`,
    '',
    '## Notes',
    ...payload.notes.map((n) => `- ${n}`),
    '',
  ].join('\n');
}

function renderBasicChecklist(payload) {
  return [
    '# Capture Checklist',
    '',
    '- [x] run directory created',
    '- [x] summary emitted',
    '- [x] manifest emitted',
    `- [${payload.status === 'ok' ? 'x' : ' '}] delegated capture script succeeded`,
    '',
  ].join('\n');
}

function renderFullManifest(payload) {
  const rows = payload.manifestRows ?? [];
  const captured = rows.filter((row) => row.status === 'captured').length;
  const skipped = rows.filter((row) => row.status === 'skipped').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  const lines = [
    '# Full App Screenshot Capture Manifest',
    '',
    `- scope: ${payload.scope}`,
    `- created_at: ${payload.createdAt}`,
    `- dry_run: ${String(payload.dryRun)}`,
    `- pilot: ${String(payload.pilot)}`,
    `- status: ${payload.status}`,
    `- captured: ${captured}`,
    `- skipped: ${skipped}`,
    `- failed: ${failed}`,
    `- viewports: ${(payload.viewports ?? []).join(', ')}`,
    `- seed_mode: ${payload.seedMode || seedMode}`,
    '',
    '## Notes',
    ...payload.notes.map((n) => `- ${n}`),
    '',
    '## Captures',
    '',
    '| # | Status | Target | Section | Viewport | Kind | Name | File / Reason |',
    '|---:|---|---|---|---|---|---|---|',
  ];

  for (const row of rows) {
    const fileOrReason = row.file ? `\`${row.file}\`` : escapeTable(row.reason || '');
    lines.push(`| ${row.id} | ${row.status} | ${escapeTable(row.targetId || '')} | ${escapeTable(row.sectionKey)} | ${escapeTable(row.viewport)} | ${escapeTable(row.kind)} | ${escapeTable(row.name)} | ${fileOrReason} |`);
  }

  lines.push('');
  return lines.join('\n');
}

function renderFullChecklist(payload) {
  const coverage = payload.requiredCoverage ?? {};
  const lines = [
    '# Full App Screenshot Capture Checklist',
    '',
    `- [x] inventory generated (${payload.inventory?.length ?? 0} entries)`,
    `- [x] summary emitted`,
    `- [x] machine manifest emitted`,
    `- [x] markdown manifest emitted`,
    `- [x] crosswalk emitted`,
    `- [x] failures file emitted`,
    `- [${coverage.missingRequiredViews?.length ? ' ' : 'x'}] required views have default full-viewport evidence`,
    '',
    '## Required View Coverage',
    '',
    '| Status | Skill | View | Section |',
    '|---|---|---|---|',
  ];

  for (const item of payload.inventory ?? []) {
    const covered = coverage.coveredRequiredViews?.includes(item.viewKey);
    const required = item.kind !== 'meta';
    lines.push(`| ${!required ? 'n/a' : covered ? 'covered' : 'missing'} | ${item.skill} | ${item.viewKey} | ${escapeTable(item.reportTitle || item.label)} |`);
  }

  lines.push('');
  return lines.join('\n');
}

function renderCrosswalk(payload) {
  const rows = payload.manifestRows ?? [];
  const lines = [
    '# Backlog Report Screenshot Crosswalk',
    '',
    'Maps each documented view/page skill to the screenshot evidence folder produced by this run.',
    '',
    '| Skill | View Key | Report Section | Folder | Captured | Failed | Skipped |',
    '|---|---|---|---|---:|---:|---:|',
  ];

  for (const item of payload.inventory ?? []) {
    const itemRows = rows.filter((row) => row.sectionKey === item.sectionKey);
    const captured = itemRows.filter((row) => row.status === 'captured').length;
    const failed = itemRows.filter((row) => row.status === 'failed').length;
    const skipped = itemRows.filter((row) => row.status === 'skipped').length;
    const folders = (payload.targets?.length ? payload.targets : [{ id: '' }])
      .map((target) => target.id ? `${target.id}/${item.folder}` : item.folder)
      .map((folder) => `\`${folder}\``)
      .join('<br>');
    lines.push(`| ${item.skill} | ${item.viewKey} | ${escapeTable(item.reportTitle || item.label)} | ${folders} | ${captured} | ${failed} | ${skipped} |`);
  }

  lines.push('');
  return lines.join('\n');
}

function renderFailures(payload) {
  const rows = (payload.manifestRows ?? []).filter((row) => row.status !== 'captured');
  const consoleRows = payload.consoleEvents ?? [];
  const lines = [
    '# Screenshot Capture Failures',
    '',
    `Status: ${payload.status}`,
    '',
  ];

  if (rows.length === 0) {
    lines.push('No skipped or failed capture rows recorded.', '');
  } else {
    lines.push('| # | Status | Target | Section | Viewport | Kind | Name | Reason |', '|---:|---|---|---|---|---|---|---|');
    for (const row of rows) {
      lines.push(`| ${row.id} | ${row.status} | ${escapeTable(row.targetId || '')} | ${escapeTable(row.sectionKey)} | ${escapeTable(row.viewport)} | ${escapeTable(row.kind)} | ${escapeTable(row.name)} | ${escapeTable(row.reason || '')} |`);
    }
    lines.push('');
  }

  lines.push('## Console And Page Errors', '');
  if (consoleRows.length === 0) {
    lines.push('No console/page errors recorded.', '');
  } else {
    lines.push('| Target | Section | Viewport | Type | Message |', '|---|---|---|---|---|');
    for (const event of consoleRows) {
      lines.push(`| ${escapeTable(event.targetId || '')} | ${escapeTable(event.sectionKey)} | ${escapeTable(event.viewport)} | ${escapeTable(event.type)} | ${escapeTable(event.message)} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function escapeTable(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function slugify(value) {
  return String(value ?? 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'item';
}

function testIdSelector(testId) {
  return `[data-testid="${String(testId).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function parseReportSections() {
  if (!fs.existsSync(REPORT_PATH)) return [];
  const text = fs.readFileSync(REPORT_PATH, 'utf8');
  const lines = text.split(/\r?\n/);
  const sections = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^##\s+(\d+)\.\s+(.+?)\s+\((pp-view-[^)]+)\)/);
    if (!match) continue;
    sections.push({
      sectionNumber: Number(match[1]),
      title: match[2],
      skill: match[3],
      line: i + 1,
    });
  }
  return sections;
}

function parseNavViews() {
  if (!fs.existsSync(SIDEBAR_CONSTANTS_PATH)) return new Map();
  const text = fs.readFileSync(SIDEBAR_CONSTANTS_PATH, 'utf8');
  const nav = new Map();
  const re = /\{\s*icon:\s*[^,]+,\s*view:\s*'([^']+)',\s*label:\s*'([^']+)'\s*\}/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    nav.set(match[1], { view: match[1], label: match[2] });
  }
  return nav;
}

function buildFullInventory() {
  const reportSections = parseReportSections();
  const sectionBySkill = new Map(reportSections.map((section) => [section.skill, section]));
  const nav = parseNavViews();
  const entries = Object.keys(SKILL_TO_VIEW).sort().map((skill) => {
    const viewKey = SKILL_TO_VIEW[skill];
    const report = sectionBySkill.get(skill);
    const navItem = nav.get(viewKey);
    const kind = viewKey.startsWith('shell:') ? 'shell' : 'route';
    const label = navItem?.label || report?.title || skill.replace(/^pp-view-/, '').replace(/-/g, ' ');
    const folder = `${slugify(skill)}__${slugify(viewKey)}`;
    return {
      skill,
      viewKey,
      kind,
      label,
      folder,
      sectionKey: skill,
      reportTitle: report?.title || '',
      reportLine: report?.line || null,
      reportSectionNumber: report?.sectionNumber || null,
      required: true,
    };
  });

  for (const navItem of nav.values()) {
    const alreadyIncluded = entries.some((entry) => entry.viewKey === navItem.view);
    if (!alreadyIncluded) {
      entries.push({
        skill: `route:${navItem.view}`,
        viewKey: navItem.view,
        kind: 'route',
        label: navItem.label,
        folder: `route-${slugify(navItem.view)}`,
        sectionKey: `route:${navItem.view}`,
        reportTitle: 'Route exists but has no pp-view skill mapping',
        reportLine: null,
        reportSectionNumber: null,
        required: true,
      });
    }
  }

  let selected = pilot ? entries.filter((entry) => PILOT_VIEW_KEYS.has(entry.viewKey)) : entries;
  if (onlyFilters.length > 0) {
    selected = selected.filter((entry) => onlyFilters.some((filter) => {
      const normalized = filter.toLowerCase();
      return entry.skill.toLowerCase() === normalized
        || entry.viewKey.toLowerCase() === normalized
        || entry.label.toLowerCase() === normalized
        || entry.folder.toLowerCase().includes(normalized);
    }));
  }
  return selected.sort((a, b) => a.folder.localeCompare(b.folder));
}

function selectedFullViewports() {
  const names = requestedViewports.length > 0 ? requestedViewports : DEFAULT_FULL_VIEWPORTS;
  return names.map((name) => VIEWPORTS[name]).filter(Boolean);
}

function summarizeRows(rows, inventory) {
  const coveredRequiredViews = [];
  for (const item of inventory) {
    const covered = rows.some((row) => row.sectionKey === item.sectionKey && row.name === 'default-viewport' && row.status === 'captured');
    if (covered) coveredRequiredViews.push(item.viewKey);
  }
  const missingRequiredViews = inventory
    .filter((item) => item.required && !coveredRequiredViews.includes(item.viewKey))
    .map((item) => item.viewKey);

  return {
    totals: {
      captured: rows.filter((row) => row.status === 'captured').length,
      skipped: rows.filter((row) => row.status === 'skipped').length,
      failed: rows.filter((row) => row.status === 'failed').length,
      attempted: rows.length,
    },
    requiredCoverage: {
      coveredRequiredViews,
      missingRequiredViews,
    },
  };
}

async function loadChromium() {
  try {
    const mod = await import('playwright');
    return mod.chromium;
  } catch {
    const mod = await import('@playwright/test');
    return mod.chromium;
  }
}

async function launchCaptureBrowser(chromium) {
  const base = { headless: true };
  try {
    return await chromium.launch(base);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Executable doesn't exist|playwright install|browser executable/i.test(msg)) {
      throw err;
    }
    return chromium.launch({ ...base, channel: 'chrome' });
  }
}

function createRecorder(rows) {
  let nextId = 0;
  return function record(row) {
    nextId += 1;
    const normalized = {
      id: nextId,
      status: 'captured',
      file: '',
      reason: '',
      ...row,
    };
    rows.push(normalized);
    return normalized;
  };
}

async function waitForWorkspace(page, url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await page.waitForTimeout(800 * attempt);
    const visible = await page.locator('[data-testid="workspace-main"], [data-testid="workspace-header"], [data-testid="mobile-bottom-nav"], [data-testid="sidebar-nav"]').first().isVisible({ timeout: 2500 }).catch(() => false);
    const bodyText = await page.locator('body').innerText({ timeout: 2500 }).catch(() => '');
    const hasBlockingText = /404|not found|sidebar region error|chat region error/i.test(bodyText);
    if (visible && (allowPanelErrors || !hasBlockingText)) {
      return true;
    }
  }
  return false;
}

async function assertNoPanelError(page, stage) {
  if (allowPanelErrors) return;
  const html = await page.content().catch(() => '');
  if (/Sidebar region error|Chat region error|Something went wrong/i.test(html)) {
    throw new Error(`panel/error surface detected at ${stage}`);
  }
}

async function capturePageShot(page, record, entry, viewport, kind, name, description, opts = {}) {
  const dir = path.join(runDir, entry.folder, viewport.name);
  ensureDir(dir);
  const file = path.join(entry.folder, viewport.name, `${String((opts.index ?? 0)).padStart(3, '0')}-${slugify(name)}.png`);
  try {
    await assertNoPanelError(page, `${entry.sectionKey}:${viewport.name}:${name}`);
    await page.screenshot({
      path: path.join(runDir, file),
      ...screenshotOptions({
        fullPage: Boolean(opts.fullPage),
        timeout: opts.timeout ?? 10_000,
      }),
    });
    record({ sectionKey: entry.sectionKey, viewKey: entry.viewKey, viewport: viewport.name, kind, name, description, targetId: opts.targetId || entry.targetId || '', file, status: 'captured' });
  } catch (err) {
    record({ sectionKey: entry.sectionKey, viewKey: entry.viewKey, viewport: viewport.name, kind, name, description, targetId: opts.targetId || entry.targetId || '', status: 'failed', reason: err instanceof Error ? err.message : String(err) });
  }
}

async function captureLocatorFallbackClip(page, locator, filePath, timeout) {
  const element = locator.first();
  await element.scrollIntoViewIfNeeded({ timeout: Math.min(timeout, 5000) }).catch(() => undefined);
  await page.waitForTimeout(250);
  const box = await element.boundingBox().catch(() => null);
  if (!box || box.width < 2 || box.height < 2) return false;
  const viewportSize = page.viewportSize() ?? { width: 1920, height: 1080 };
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const maxWidth = Math.max(0, viewportSize.width - x);
  const maxHeight = Math.max(0, viewportSize.height - y);
  const width = Math.min(Math.ceil(box.width), maxWidth);
  const height = Math.min(Math.ceil(box.height), maxHeight);
  if (width < 2 || height < 2) return false;
  await page.screenshot({
    path: filePath,
    ...screenshotOptions({
      timeout,
      clip: { x, y, width, height },
    }),
  });
  return true;
}

async function captureLocatorShot(locator, record, entry, viewport, kind, name, description, opts = {}) {
  const dir = path.join(runDir, entry.folder, viewport.name);
  ensureDir(dir);
  const file = path.join(entry.folder, viewport.name, `${String((opts.index ?? 0)).padStart(3, '0')}-${slugify(name)}.png`);
  const filePath = path.join(runDir, file);
  const timeout = opts.timeout ?? 7000;
  try {
    const visible = await locator.first().isVisible({ timeout: opts.visibleTimeout ?? 1800 }).catch(() => false);
    if (!visible) {
      record({ sectionKey: entry.sectionKey, viewKey: entry.viewKey, viewport: viewport.name, kind, name, description, targetId: opts.targetId || entry.targetId || '', status: 'skipped', reason: 'not visible' });
      return false;
    }
    await locator.first().screenshot({
      path: filePath,
      ...screenshotOptions({ timeout }),
    });
    record({ sectionKey: entry.sectionKey, viewKey: entry.viewKey, viewport: viewport.name, kind, name, description, targetId: opts.targetId || entry.targetId || '', file, status: 'captured' });
    return true;
  } catch (err) {
    if (opts.page && opts.fallbackClip !== false) {
      try {
        const recovered = await captureLocatorFallbackClip(opts.page, locator, filePath, timeout);
        if (recovered) {
          record({ sectionKey: entry.sectionKey, viewKey: entry.viewKey, viewport: viewport.name, kind, name, description: `${description} (clip fallback)`, targetId: opts.targetId || entry.targetId || '', file, status: 'captured' });
          return true;
        }
      } catch {
        // Preserve the original locator.screenshot error below; it explains the unstable element.
      }
    }
    record({ sectionKey: entry.sectionKey, viewKey: entry.viewKey, viewport: viewport.name, kind, name, description, targetId: opts.targetId || entry.targetId || '', status: 'failed', reason: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

async function captureVisibleTestIds(page, record, entry, viewport, rootLocator, startIndex) {
  const root = rootLocator ?? page.locator('[data-testid="workspace-main"]').first();
  const items = await root.locator('[data-testid]').evaluateAll((elements) => {
    const seen = new Map();
    return elements.map((el) => {
      const testId = el.getAttribute('data-testid') || '';
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const occurrence = seen.get(testId) || 0;
      seen.set(testId, occurrence + 1);
      return {
        testId,
        occurrence,
        text: (el.textContent || '').trim().slice(0, 80),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        visible: rect.width > 2 && rect.height > 2 && style.visibility !== 'hidden' && style.display !== 'none',
      };
    }).filter((item) => item.testId && item.visible)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }).catch(() => []);

  const limited = items.slice(0, Number.isFinite(maxElementsPerView) ? maxElementsPerView : 120);
  let index = startIndex;
  for (const item of limited) {
    index += 1;
    const locator = root.locator(testIdSelector(item.testId)).nth(item.occurrence);
    await captureLocatorShot(locator, record, entry, viewport, 'element', `testid-${item.testId}-${item.occurrence}`, item.text || `data-testid=${item.testId}`, { index, page });
  }

  if (items.length > limited.length) {
    record({
      sectionKey: entry.sectionKey,
      viewKey: entry.viewKey,
      viewport: viewport.name,
      targetId: entry.targetId || '',
      kind: 'element',
      name: 'visible-testid-overflow',
      description: `${items.length - limited.length} visible data-testid elements beyond configured cap`,
      status: 'skipped',
      reason: `max-elements=${maxElementsPerView}`,
    });
  }
  return index;
}

async function captureScrollStates(page, record, entry, viewport, rootLocator, startIndex) {
  const root = rootLocator ?? page.locator('[data-testid="workspace-main"]').first();
  const canScroll = await root.evaluate((el) => el.scrollHeight > el.clientHeight + 24).catch(() => false);
  if (!canScroll) return startIndex;
  let index = startIndex;
  for (const pos of ['top', 'middle', 'bottom']) {
    index += 1;
    await root.evaluate((el, position) => {
      if (position === 'top') el.scrollTop = 0;
      if (position === 'middle') el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) / 2);
      if (position === 'bottom') el.scrollTop = el.scrollHeight;
    }, pos).catch(() => undefined);
    await page.waitForTimeout(250);
    await capturePageShot(page, record, entry, viewport, 'viewport', `scroll-${pos}`, `Main region scrolled to ${pos}`, { index });
  }
  return index;
}

async function captureInteractions(page, record, entry, viewport, rootLocator, startIndex) {
  const root = rootLocator ?? page.locator('[data-testid="workspace-main"]').first();
  const candidates = await root.locator('button:not([disabled]), [role="tab"], [role="button"], [aria-haspopup], [aria-expanded]').evaluateAll((elements) => elements.map((el, index) => {
    const rect = el.getBoundingClientRect();
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    return {
      index,
      testId: el.getAttribute('data-testid') || '',
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      aria: el.getAttribute('aria-label') || '',
      text,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visible: rect.width > 4 && rect.height > 4,
    };
  }).filter((item) => item.visible)).catch(() => []);

  const safe = candidates
    .filter((item) => !CLICK_DENY.test(`${item.testId} ${item.aria} ${item.text}`))
    .slice(0, Number.isFinite(maxInteractionsPerView) ? maxInteractionsPerView : 45);

  let index = startIndex;
  for (const item of safe) {
    const nameBase = item.testId || item.aria || item.text || `${item.role}-${item.index}`;
    const locator = root.locator('button:not([disabled]), [role="tab"], [role="button"], [aria-haspopup], [aria-expanded]').nth(item.index);
    const visible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
    if (!visible) continue;
    try {
      await locator.click({ timeout: 2500 });
    } catch {
      await locator.click({ force: true, timeout: 2500 }).catch(() => undefined);
    }
    await page.waitForTimeout(350);
    index += 1;
    await capturePageShot(page, record, entry, viewport, 'interaction', `after-click-${nameBase}`, `After clicking ${nameBase}`, { index });
    const overlay = page.locator('[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-testid*="dialog"], [data-testid*="popover"]').last();
    if (await overlay.isVisible({ timeout: 800 }).catch(() => false)) {
      index += 1;
      await captureLocatorShot(overlay, record, entry, viewport, 'overlay', `overlay-${nameBase}`, `Overlay opened by ${nameBase}`, { index, visibleTimeout: 800, page });
    }
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(150);
  }

  if (candidates.length > safe.length) {
    record({
      sectionKey: entry.sectionKey,
      viewKey: entry.viewKey,
      viewport: viewport.name,
      targetId: entry.targetId || '',
      kind: 'interaction',
      name: 'interaction-overflow-or-denylist',
      description: `${candidates.length - safe.length} candidate interactions skipped by cap or denylist`,
      status: 'skipped',
      reason: `max-interactions=${maxInteractionsPerView}; destructive/network actions denied`,
    });
  }
  return index;
}

async function enrichProjectViaUi(page, bootstrap) {
  const url = `${bootstrap.baseUrl}/projects/${bootstrap.projectId}/architecture`;
  const loaded = await waitForWorkspace(page, url);
  if (!loaded) return;
  const addButton = page.getByTestId('button-add-to-canvas').first();
  if (await addButton.isVisible({ timeout: 2500 }).catch(() => false)) {
    for (let i = 0; i < 4; i += 1) {
      await addButton.click({ timeout: 2500 }).catch(() => undefined);
      await page.waitForTimeout(350);
    }
  }
}

async function captureShellScenario(page, record, entry, viewport) {
  let index = 10;
  await capturePageShot(page, record, entry, viewport, 'viewport', 'default-viewport', `${entry.label} shell default`, { index: 1 });
  if (entry.viewKey === 'shell:left-sidebar' || entry.viewKey === 'shell:project-explorer' || entry.viewKey === 'shell:uiux-design') {
    const sidebar = page.locator('[data-testid="sidebar-nav"], [data-testid="sidebar-collapsed"]').first();
    await captureLocatorShot(sidebar, record, entry, viewport, 'panel', 'sidebar-panel', 'Left sidebar panel', { index: 2, page });
    const projectExplorer = page.locator('[data-testid="project-explorer"]').first();
    await captureLocatorShot(projectExplorer, record, entry, viewport, 'panel', 'project-explorer', 'Project explorer panel', { index: 3, page });
    if (await page.getByTestId('sidebar-search').isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByTestId('sidebar-search').fill('esp').catch(() => undefined);
      await page.waitForTimeout(250);
      await capturePageShot(page, record, entry, viewport, 'interaction', 'sidebar-search-esp', 'Sidebar search query state', { index: 4 });
      await page.getByTestId('sidebar-search').fill('').catch(() => undefined);
    }
    const settings = page.getByTestId('button-project-settings').first();
    if (await settings.isVisible({ timeout: 1000 }).catch(() => false)) {
      await settings.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      await capturePageShot(page, record, entry, viewport, 'interaction', 'project-settings-open', 'Project settings opened', { index: 5 });
      await page.keyboard.press('Escape').catch(() => undefined);
    }
    if (viewport.width >= 1280 && await page.getByTestId('toggle-sidebar').isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByTestId('toggle-sidebar').click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
      await capturePageShot(page, record, entry, viewport, 'interaction', 'sidebar-collapsed', 'Sidebar collapsed state', { index: 6 });
      await page.getByTestId('toggle-sidebar').click({ force: true }).catch(() => undefined);
    }
  }

  if (entry.viewKey === 'shell:right-sidebar' || entry.viewKey === 'shell:ai-chat' || entry.viewKey === 'shell:uiux-design') {
    await captureLocatorShot(page.locator('[data-testid="hover-peek-dock-right"], [data-testid="chat-panel"], textarea[placeholder*="message" i]').first(), record, entry, viewport, 'panel', 'right-chat-panel', 'Right chat/sidebar panel', { index: 7, page });
    const activityButton = page.locator('[data-testid="activity-filter-toggle"], button[aria-label*="activity" i], button:has-text("Activity")').first();
    if (await activityButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await activityButton.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
      await capturePageShot(page, record, entry, viewport, 'interaction', 'activity-or-right-overlay-open', 'Right-side activity/overlay state', { index: 8 });
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }

  index = await captureVisibleTestIds(page, record, entry, viewport, undefined, index);
  await captureInteractions(page, record, entry, viewport, undefined, index);
}

async function captureRouteScenario(page, record, entry, viewport) {
  let index = 1;
  await capturePageShot(page, record, entry, viewport, 'viewport', 'default-viewport', `${entry.label} default loaded viewport`, { index });
  index += 1;
  await capturePageShot(page, record, entry, viewport, 'viewport', 'full-page', `${entry.label} full-page capture`, { index, fullPage: true });
  const main = page.locator('[data-testid="workspace-main"]').first();
  index += 1;
  await captureLocatorShot(main, record, entry, viewport, 'panel', 'workspace-main', `${entry.label} main workspace panel`, { index, page, timeout: 15_000 });
  index = await captureVisibleTestIds(page, record, entry, viewport, main, index);
  index = await captureScrollStates(page, record, entry, viewport, main, index);
  await captureInteractions(page, record, entry, viewport, main, index);
}

async function internalFullAppCapture() {
  const inventory = buildFullInventory();
  const viewports = selectedFullViewports();
  const rows = [];
  const consoleEvents = [];
  const record = createRecorder(rows);
  const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
  const chromium = await loadChromium();
  const browser = await launchCaptureBrowser(chromium);

  const progress = (message) => {
    process.stderr.write(`[full-app-capture] ${message}\n`);
  };
  const targets = [];
  if (seedMode === 'synthetic' || seedMode === 'mixed') {
    targets.push({
      id: 'synthetic-rich',
      label: 'Synthetic rich project',
      projectId: bootstrap.projectId,
      required: true,
      enrich: true,
    });
  }
  if (seedMode === 'current' || seedMode === 'mixed') {
    targets.push({
      id: 'current-local',
      label: `Current local project ${currentProjectId}`,
      projectId: currentProjectId,
      required: seedMode === 'current',
      enrich: false,
    });
  }
  if (targets.length === 0) {
    throw new Error(`unsupported seed mode: ${seedMode}`);
  }

  try {
    for (const target of targets.filter((item) => item.enrich)) {
      progress(`enrich ${target.id} project=${target.projectId}`);
      const seedContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
      const seedPage = await seedContext.newPage();
      seedPage.setDefaultTimeout(ACTION_TIMEOUT_MS);
      seedPage.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
      await seedPage.goto(bootstrap.baseUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      await seedPage.evaluate((sid) => localStorage.setItem('protopulse-session-id', sid), bootstrap.sessionId);
      await enrichProjectViaUi(seedPage, { ...bootstrap, projectId: target.projectId });
      await seedContext.close();
    }

    for (const target of targets) {
      for (const viewport of viewports) {
        progress(`target=${target.id} viewport=${viewport.name} start`);
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: 'reduce',
          colorScheme: 'dark',
          deviceScaleFactor: 1,
        });
        await context.tracing.start({ screenshots: true, snapshots: true }).catch(() => undefined);
        const page = await context.newPage();
        page.setDefaultTimeout(ACTION_TIMEOUT_MS);
        page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
        let activeSectionKey = 'unknown';
        page.on('console', (msg) => {
          if (['error', 'warning'].includes(msg.type())) {
            consoleEvents.push({ targetId: target.id, sectionKey: activeSectionKey, viewport: viewport.name, type: msg.type(), message: msg.text().slice(0, 500) });
          }
        });
        page.on('pageerror', (err) => {
          consoleEvents.push({ targetId: target.id, sectionKey: activeSectionKey, viewport: viewport.name, type: 'pageerror', message: err.message.slice(0, 500) });
        });

        let rowsBeforeTarget = rows.length;
        try {
          await page.goto(bootstrap.baseUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
          await page.evaluate((sid) => localStorage.setItem('protopulse-session-id', sid), bootstrap.sessionId);

          for (const entry of inventory) {
            activeSectionKey = entry.sectionKey;
            progress(`target=${target.id} viewport=${viewport.name} entry=${entry.skill} route=${entry.kind === 'route' ? entry.viewKey : 'dashboard'}`);
            const targetEntry = {
              ...entry,
              targetId: target.id,
              folder: path.join(target.id, entry.folder),
            };
            const routeView = entry.kind === 'route' ? entry.viewKey : 'dashboard';
            const url = `${bootstrap.baseUrl}/projects/${target.projectId}/${routeView}`;
            const loaded = await waitForWorkspace(page, url);
            if (!loaded) {
              record({
                sectionKey: entry.sectionKey,
                viewKey: entry.viewKey,
                viewport: viewport.name,
                targetId: target.id,
                kind: 'viewport',
                name: 'default-viewport',
                description: `${entry.label} failed to load`,
                status: target.required ? 'failed' : 'skipped',
                reason: `workspace did not load for ${url}`,
              });
              continue;
            }

            if (entry.kind === 'shell') {
              await captureShellScenario(page, record, targetEntry, viewport);
            } else {
              await captureRouteScenario(page, record, targetEntry, viewport);
            }
          }
        } finally {
          const hadFailures = rows.slice(rowsBeforeTarget).some((row) => row.status === 'failed');
          if (hadFailures) {
            const traceDir = path.join(runDir, 'traces');
            ensureDir(traceDir);
            await context.tracing.stop({ path: path.join(traceDir, `${target.id}-${viewport.name}.zip`) }).catch(() => undefined);
          } else {
            await context.tracing.stop().catch(() => undefined);
          }
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const summary = summarizeRows(rows, inventory);
  return {
    inventory,
    targets,
    seedMode,
    viewports: viewports.map((viewport) => viewport.name),
    manifestRows: rows,
    consoleEvents,
    ...summary,
  };
}

function updateLatestCatalog() {
  rmDirIfExists(latestDir);
  cpDir(runDir, latestDir);
}

function pruneOldCatalogs(keepCount = 5) {
  const root = path.resolve(baseOut);
  if (!fs.existsSync(root)) return;
  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      if (name.startsWith('latest-')) return false;
      const isCatalog = name.endsWith(`-${scope}-catalog`);
      const isLegacySidebarOnly = scope === 'sidebar' && name.endsWith('-sidebar-only');
      return isCatalog || isLegacySidebarOnly;
    })
    .map((name) => ({
      name,
      full: path.join(root, name),
      mtime: fs.statSync(path.join(root, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  const toRemove = entries.slice(keepCount);
  for (const item of toRemove) {
    rmDirIfExists(item.full);
  }
}

async function internalSidebarCapture() {
  const chromium = await loadChromium();
  const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 1024, height: 768 },
    { name: 'mobile', width: 430, height: 932 },
  ];

  const browser = await launchCaptureBrowser(chromium);
  const captures = [];
  async function assertNoPanelError(page, stage) {
    if (allowPanelErrors) {
      return;
    }
    const html = await page.content();
    if (html.includes('Sidebar region error') || html.includes('Chat region error')) {
      throw new Error(`panel error surface detected at ${stage}`);
    }
  }
  const pushShot = (name) => captures.push(name);

  async function shot(page, name) {
    const p = path.join(runDir, name);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await assertNoPanelError(page, `shot:${name}:attempt-${attempt}`);
        await page.screenshot({ path: p, fullPage: false, animations: 'disabled' });
        pushShot(name);
        return;
      } catch (err) {
        if (attempt === 2) throw err;
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
      }
    }
  }

  async function shotIfVisible(locator, name) {
    if (await locator.first().isVisible({ timeout: 1800 }).catch(() => false)) {
      await locator.first().screenshot({ path: path.join(runDir, name), animations: 'disabled' });
      pushShot(name);
      return true;
    }
    return false;
  }

  async function clickIfVisible(page, selector) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 1800 }).catch(() => false)) {
      await el.click({ force: true });
      await page.waitForTimeout(250);
      return true;
    }
    return false;
  }

  async function tryOpenSidebar(page) {
    const selectors = [
      '[data-testid="mobile-menu-toggle"]',
      '[data-testid="toggle-sidebar"]',
      'button[aria-label*="sidebar" i]',
      'button[aria-label*="menu" i]',
      'header button:first-of-type',
    ];
    for (const selector of selectors) {
      if (await clickIfVisible(page, selector)) {
        return true;
      }
    }
    return false;
  }

  async function fillIfVisible(page, selector, value) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 1800 }).catch(() => false)) {
      await el.fill(value);
      await page.waitForTimeout(250);
      return true;
    }
    return false;
  }

  async function waitForWorkspaceLoaded(page, projectUrl) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await page.goto(projectUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      const pickerVisible = await page.locator('[data-testid="project-picker-page"]').first().isVisible({ timeout: 1200 }).catch(() => false);
      const skeletonVisible = await page.locator('[data-testid="skeleton-grid"], [data-testid="project-card-skeleton"]').first().isVisible({ timeout: 1200 }).catch(() => false);
      const sidebarVisible = await page.locator('[data-testid="sidebar-nav"], [data-testid="sidebar-collapsed"]').first().isVisible({ timeout: 1500 }).catch(() => false);
      const workspaceVisible = await page.locator('[data-testid="workspace-main"], [data-testid="workspace-header"], [data-testid="mobile-bottom-nav"]').first().isVisible({ timeout: 1500 }).catch(() => false);
      const welcomeVisible = await page.locator('text=Welcome to ProtoPulse').first().isVisible({ timeout: 1200 }).catch(() => false);
      const html = await page.content();
      const hasPanelError = html.includes('Sidebar region error') || html.includes('Chat region error');

      if (!pickerVisible && !skeletonVisible && !hasPanelError && (sidebarVisible || workspaceVisible || welcomeVisible)) {
        return true;
      }

      await page.waitForTimeout(800 * attempt);
    }
    return false;
  }

  try {
    for (const vp of viewports) {
      let viewportSucceeded = false;

      for (let attempt = 1; attempt <= 3 && !viewportSucceeded; attempt += 1) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await context.newPage();
        try {
          await page.goto(bootstrap.baseUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
          await page.evaluate((sid) => localStorage.setItem('protopulse-session-id', sid), bootstrap.sessionId);

          const loaded = await waitForWorkspaceLoaded(page, bootstrap.projectUrl);
          if (!loaded) {
            throw new Error(`workspace did not reach loaded state (viewport=${vp.name}, attempt=${attempt})`);
          }
          await assertNoPanelError(page, `viewport-start:${vp.name}:attempt-${attempt}`);

          await shot(page, `full-${vp.name}.png`);
          const captureCountBefore = captures.length;

          const sidebar = page.locator('[data-testid="sidebar-nav"], [data-testid="sidebar-collapsed"]').first();
          await shotIfVisible(sidebar, `sidebar-${vp.name}.png`);

          const search = page.locator('[data-testid="sidebar-search"]').first();
          if (await search.isVisible({ timeout: 1500 }).catch(() => false)) {
            await fillIfVisible(page, '[data-testid="sidebar-search"]', 'esp');
            await shot(page, `sidebar-search-esp-${vp.name}.png`);
            await fillIfVisible(page, '[data-testid="sidebar-search"]', 'zzzz-not-found');
            await shot(page, `sidebar-search-empty-${vp.name}.png`);
            await fillIfVisible(page, '[data-testid="sidebar-search"]', '');
          }

          await shotIfVisible(page.locator('[data-testid="project-explorer"]'), `sidebar-project-explorer-${vp.name}.png`);
          await shotIfVisible(page.locator('[data-testid="timeline-live-indicator"]'), `sidebar-timeline-indicator-${vp.name}.png`);
          await shotIfVisible(page.locator('[data-testid="button-project-settings"]'), `sidebar-settings-toggle-${vp.name}.png`);

          if (await clickIfVisible(page, '[data-testid="button-project-settings"]')) {
            await shot(page, `sidebar-settings-open-${vp.name}.png`);
            await shotIfVisible(page.locator('[data-testid="settings-name-input"]'), `sidebar-settings-name-input-${vp.name}.png`);
            await shotIfVisible(page.locator('[data-testid="settings-desc-input"]'), `sidebar-settings-desc-input-${vp.name}.png`);
          }

          for (const filter of ['all', 'User', 'AI']) {
            if (await clickIfVisible(page, `[data-testid="timeline-filter-${filter}"]`)) {
              await shot(page, `sidebar-timeline-filter-${String(filter).toLowerCase()}-${vp.name}.png`);
            }
          }

          if (vp.width >= 1280) {
            if (await clickIfVisible(page, '[data-testid="toggle-sidebar"]')) {
              await shot(page, `sidebar-collapsed-${vp.name}.png`);
              await shotIfVisible(page.locator('[data-testid="sidebar-collapsed"]'), `sidebar-collapsed-rail-${vp.name}.png`);
              await clickIfVisible(page, '[data-testid="toggle-sidebar"]');
              await shot(page, `sidebar-reexpanded-${vp.name}.png`);
            }
          } else {
            if (await tryOpenSidebar(page)) {
              await shot(page, `sidebar-overlay-open-${vp.name}.png`);
              await shotIfVisible(page.locator('[data-testid="sidebar-backdrop"]'), `sidebar-backdrop-${vp.name}.png`);
              await clickIfVisible(page, '[data-testid="sidebar-backdrop"]');
              await shot(page, `sidebar-overlay-closed-${vp.name}.png`);
            }
          }

          const captureCountAfter = captures.length;
          if (captureCountAfter <= captureCountBefore) {
            await shotIfVisible(
              page.locator('[data-testid="hover-peek-dock-left"], [data-testid="mobile-header"], [data-testid="sidebar-collapsed"]'),
              `sidebar-fallback-${vp.name}.png`,
            );
          }

          viewportSucceeded = true;
        } finally {
          await context.close();
        }
      }

      if (!viewportSucceeded) {
        throw new Error(`all attempts failed for viewport=${vp.name}`);
      }
    }
  } finally {
    await browser.close();
  }
  const sidebarEvidence = captures.filter((name) => name.startsWith('sidebar-'));
  if (sidebarEvidence.length === 0) {
    throw new Error('no sidebar evidence captures were produced');
  }
  return captures;
}

async function main() {
  const notes = [];
  notes.push('Research-backed wrapper initialized.');

  if (dryRun) {
    notes.push('Dry run mode: no delegated capture executed.');
    if (scope === 'full-app') {
      const inventory = buildFullInventory();
      const viewports = selectedFullViewports().map((viewport) => viewport.name);
      notes.push(`Full-app inventory entries: ${inventory.length}`);
      writeArtifacts({
        createdAt: new Date().toISOString(),
        dryRun: true,
        allowPanelErrors,
        scope,
        pilot,
        seedMode,
        targets: [],
        status: 'ok',
        delegatedScript: null,
        notes,
        inventory,
        viewports,
        manifestRows: [],
        consoleEvents: [],
        totals: { captured: 0, skipped: 0, failed: 0, attempted: 0 },
        requiredCoverage: {
          coveredRequiredViews: [],
          missingRequiredViews: inventory.map((item) => item.viewKey),
        },
      });
    } else {
      writeArtifacts({
        createdAt: new Date().toISOString(),
        dryRun: true,
        allowPanelErrors,
        scope,
        status: 'ok',
        delegatedScript: null,
        notes,
      });
    }
    process.stdout.write(`${runDir}\n`);
    return;
  }

  let delegatedScript = 'internal-playwright-capture';
  let exitCode = 0;
  let captures = [];

  if (!fs.existsSync(bootstrapPath)) {
    notes.push('Missing bootstrap.json. Run bootstrap-auth-project.mjs first.');
    exitCode = 2;
  } else if (scope === 'sidebar') {
    notes.push('Running internal Playwright sidebar capture.');
    try {
      captures = await internalSidebarCapture();
      notes.push(`Captured files: ${captures.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notes.push(`Internal capture failed: ${msg}`);
      exitCode = 2;
    }
  } else if (scope === 'full-app') {
    notes.push('Running internal Playwright full-app capture.');
    notes.push(`Mode: ${pilot ? 'pilot' : 'full'}; max-elements=${maxElementsPerView}; max-interactions=${maxInteractionsPerView}`);
    try {
      const result = await internalFullAppCapture();
      captures = result.manifestRows.filter((row) => row.status === 'captured').map((row) => row.file).filter(Boolean);
      notes.push(`Inventory entries: ${result.inventory.length}`);
      notes.push(`Captured rows: ${result.totals.captured}; skipped: ${result.totals.skipped}; failed: ${result.totals.failed}`);
      if (result.requiredCoverage.missingRequiredViews.length > 0) {
        notes.push(`Missing required view coverage: ${result.requiredCoverage.missingRequiredViews.join(', ')}`);
        exitCode = 2;
      }

      const status = exitCode === 0 ? 'ok' : 'failed';
      writeArtifacts({
        createdAt: new Date().toISOString(),
        dryRun: false,
        allowPanelErrors,
        scope,
        pilot,
        status,
        delegatedScript,
        notes,
        ...result,
      });
      if (status === 'ok') {
        updateLatestCatalog();
        pruneOldCatalogs(Number.isFinite(keepCount) && keepCount > 0 ? keepCount : 2);
      }

      process.stdout.write(`${runDir}\n`);
      process.exit(exitCode === 0 ? 0 : 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notes.push(`Internal full-app capture failed: ${msg}`);
      exitCode = 2;
    }
  } else {
    notes.push(`Scope ${scope} is not wired yet. Use scope=sidebar or scope=full-app.`);
    exitCode = 2;
  }

  const status = exitCode === 0 ? 'ok' : 'failed';
  writeArtifacts({
    createdAt: new Date().toISOString(),
    dryRun: false,
    allowPanelErrors,
    scope,
    status,
    delegatedScript,
    captures,
    notes,
  });
  if (status === 'ok') {
    updateLatestCatalog();
    pruneOldCatalogs(Number.isFinite(keepCount) && keepCount > 0 ? keepCount : 2);
  }

  process.stdout.write(`${runDir}\n`);
  process.exit(exitCode === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
