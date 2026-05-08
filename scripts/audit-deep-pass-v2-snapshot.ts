/**
 * audit-deep-pass-v2-snapshot.ts
 *
 * One-off evidence-gathering script for the 2026-04-23 deep design audit
 * (companion annex: docs/audits/2026-04-23-protopulse-design-system-deep-audit-v2-annex.md).
 *
 * Connects to the running dev server at http://localhost:5000, authenticates
 * via the same /api/auth/register + /api/auth/login dance used in e2e/auth.setup.ts,
 * then navigates through a shortlist of shell + page + view surfaces and captures:
 *   - full-page PNG screenshot
 *   - accessibility tree JSON (role/name/state)
 *   - console errors + warnings
 *
 * Output: docs/audits/screenshots-2026-04-23/{slug}.{png,a11y.json,console.json}
 *         docs/audits/screenshots-2026-04-23/manifest.json
 */

import { chromium, type BrowserContext, type Page } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const BASE_URL = 'http://localhost:5000';
const OUT_DIR = path.resolve(
  process.cwd(),
  'docs/audits/screenshots-2026-04-23',
);

interface ShotSpec {
  slug: string;
  description: string;
  /** URL to navigate to (relative to BASE_URL) */
  url: string;
  /** Optional viewport override */
  viewport?: { width: number; height: number };
  /** Optional html class toggles (e.g. 'high-contrast', 'light', 'reduced-motion') */
  htmlClasses?: string[];
  /** Optional localStorage overrides to apply before nav */
  localStorage?: Record<string, string>;
  /**
   * Readiness signal. The script waits for ONE of these testids to be visible
   * before taking the screenshot. A single string is also accepted. For views
   * that have distinct "empty" and "populated" testids (e.g. schematic-empty
   * vs schematic-view), pass both and the first to mount wins.
   */
  waitForTestId?: string | string[];
  /**
   * If true, skip seeding the session id so the app shows the logged-out
   * AuthPage instead of redirecting to /projects.
   */
  loggedOut?: boolean;
  /** Extra wait after all readiness signals in ms (for animations / RAF). */
  settleMs?: number;
}

const DESKTOP_VP = { width: 1440, height: 900 };
const MOBILE_VP = { width: 390, height: 844 };

const SHOTS: ShotSpec[] = [
  // --- Public surfaces ---
  {
    slug: '01-auth-login',
    description: 'AuthPage login (unauthenticated)',
    url: '/',
    viewport: DESKTOP_VP,
    loggedOut: true,
    settleMs: 1000,
  },
  {
    slug: '02-not-found',
    description: 'NotFound 404',
    url: '/does-not-exist',
    viewport: DESKTOP_VP,
    waitForTestId: 'not-found-page',
    settleMs: 500,
  },
  // --- Project picker ---
  {
    slug: '03-project-picker-default',
    description: 'ProjectPickerPage default state (authenticated)',
    url: '/projects',
    viewport: DESKTOP_VP,
    waitForTestId: 'project-picker-page',
    settleMs: 1000,
  },
  // --- Workspace shell (requires a project id; we will create one first) ---
  {
    slug: '10-workspace-default',
    description: 'ProjectWorkspace default (sidebar + chat expanded)',
    url: '/projects/__PID__/dashboard',
    viewport: DESKTOP_VP,
    waitForTestId: 'dashboard-view',
    settleMs: 1500,
  },
  {
    slug: '11-workspace-sidebar-collapsed',
    description: 'ProjectWorkspace with sidebar collapsed',
    url: '/projects/__PID__/dashboard',
    viewport: DESKTOP_VP,
    localStorage: { 'protopulse-sidebar-collapsed': 'true' },
    waitForTestId: 'dashboard-view',
    settleMs: 1500,
  },
  {
    slug: '12-workspace-chat-collapsed',
    description: 'ProjectWorkspace with AI chat collapsed',
    url: '/projects/__PID__/dashboard',
    viewport: DESKTOP_VP,
    localStorage: { 'protopulse-chat-collapsed': 'true' },
    waitForTestId: 'dashboard-view',
    settleMs: 1500,
  },
  {
    slug: '13-workspace-light-theme',
    description: 'ProjectWorkspace — light theme',
    url: '/projects/__PID__/dashboard',
    viewport: DESKTOP_VP,
    localStorage: { 'protopulse-theme': 'light' },
    waitForTestId: 'dashboard-view',
    settleMs: 1500,
  },
  {
    slug: '14-workspace-high-contrast',
    description: 'ProjectWorkspace — high-contrast mode',
    url: '/projects/__PID__/dashboard',
    viewport: DESKTOP_VP,
    localStorage: { 'protopulse-high-contrast': 'true' },
    waitForTestId: 'dashboard-view',
    settleMs: 1500,
  },
  {
    slug: '15-workspace-amber-theme',
    description: 'ProjectWorkspace — Amber dark preset',
    url: '/projects/__PID__/dashboard',
    viewport: DESKTOP_VP,
    localStorage: { 'protopulse-theme': 'amber' },
    waitForTestId: 'dashboard-view',
    settleMs: 1500,
  },
  // --- Views ---
  {
    slug: '20-architecture',
    description: 'Architecture view (empty project)',
    url: '/projects/__PID__/architecture',
    viewport: DESKTOP_VP,
    waitForTestId: 'architecture-drop-zone',
    settleMs: 2000,
  },
  {
    slug: '21-schematic',
    description: 'Schematic view (empty project → empty state)',
    url: '/projects/__PID__/schematic',
    viewport: DESKTOP_VP,
    waitForTestId: ['schematic-view', 'schematic-empty'],
    settleMs: 2000,
  },
  {
    slug: '22-pcb',
    description: 'PCB layout view (empty project → empty guidance)',
    url: '/projects/__PID__/pcb',
    viewport: DESKTOP_VP,
    waitForTestId: ['pcb-layout-view', 'pcb-empty-guidance'],
    settleMs: 2000,
  },
  {
    slug: '23-validation',
    description: 'Validation view',
    url: '/projects/__PID__/validation',
    viewport: DESKTOP_VP,
    waitForTestId: 'workspace-main',
    settleMs: 2000,
  },
  {
    slug: '24-procurement',
    description: 'Procurement view',
    url: '/projects/__PID__/procurement',
    viewport: DESKTOP_VP,
    waitForTestId: 'procurement-view',
    settleMs: 2000,
  },
  {
    slug: '25-knowledge',
    description: 'Knowledge view',
    url: '/projects/__PID__/knowledge',
    viewport: DESKTOP_VP,
    waitForTestId: 'knowledge-view',
    settleMs: 1500,
  },
  {
    slug: '26-kanban',
    description: 'Kanban task board',
    url: '/projects/__PID__/kanban',
    viewport: DESKTOP_VP,
    waitForTestId: 'kanban-view',
    settleMs: 1500,
  },
  {
    slug: '27-component-editor',
    description: 'Component Editor view',
    url: '/projects/__PID__/component_editor',
    viewport: DESKTOP_VP,
    waitForTestId: 'component-editor',
    settleMs: 2000,
  },
  {
    slug: '28-breadboard',
    description: 'Breadboard view',
    url: '/projects/__PID__/breadboard',
    viewport: DESKTOP_VP,
    waitForTestId: ['breadboard-view', 'breadboard-loading'],
    settleMs: 2500,
  },
  {
    slug: '29-calculators',
    description: 'Calculators view',
    url: '/projects/__PID__/calculators',
    viewport: DESKTOP_VP,
    waitForTestId: 'calculators-view',
    settleMs: 1500,
  },
  // --- Mobile ---
  {
    slug: '30-mobile-project-picker',
    description: 'ProjectPickerPage on mobile viewport',
    url: '/projects',
    viewport: MOBILE_VP,
    waitForTestId: 'project-picker-page',
    settleMs: 1000,
  },
  {
    slug: '31-mobile-workspace',
    description: 'ProjectWorkspace dashboard on mobile viewport',
    url: '/projects/__PID__/dashboard',
    viewport: MOBILE_VP,
    waitForTestId: 'dashboard-view',
    settleMs: 1500,
  },
  // --- Settings ---
  {
    slug: '40-settings',
    description: '/settings top-level page',
    url: '/settings',
    viewport: DESKTOP_VP,
    waitForTestId: 'settings-page',
    settleMs: 600,
  },
];

interface Manifest {
  generatedAt: string;
  baseUrl: string;
  playwrightVersion: string;
  shots: Array<{
    slug: string;
    description: string;
    url: string;
    viewport: { width: number; height: number };
    status: 'ok' | 'failed';
    error?: string;
    consoleErrorCount: number;
    consoleWarningCount: number;
    ariaLineCount: number;
    screenshot: 'ok' | 'missing';
    htmlClasses: string[];
    /**
     * Set when `waitForTestId` was provided but none of the testids became
     * visible within the timeout. The screenshot is still captured, but this
     * flag tells the auditor the capture may not reflect the intended view
     * state.
     */
    readinessMiss?: string;
  }>;
}

async function authenticate(): Promise<{ sessionId: string; username: string }> {
  const randomSuffix = Math.floor(Math.random() * 1_000_000).toString();
  const username = `audit-v2-${randomSuffix}`;
  const password = 'AuditV2Pass!123';

  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!registerRes.ok) {
    throw new Error(`register failed: ${registerRes.status} ${await registerRes.text()}`);
  }

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const { sessionId } = (await loginRes.json()) as { sessionId: string };
  if (!sessionId) {
    throw new Error('login returned no sessionId');
  }
  return { sessionId, username };
}

async function createProject(sessionId: string): Promise<number> {
  const createRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      name: `Audit v2 Scratch Project`,
      description: 'Auto-generated for design audit snapshot capture',
    }),
  });
  if (!createRes.ok) {
    throw new Error(`createProject failed: ${createRes.status} ${await createRes.text()}`);
  }
  const project = (await createRes.json()) as { id: number };
  return project.id;
}

function countAriaLines(yaml: string): number {
  // Each indented bullet roughly corresponds to a semantic element in Playwright's
  // ariaSnapshot() output. Count non-empty, non-comment lines as a rough proxy.
  return yaml
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#')).length;
}

/**
 * Keys that any shot might override. Before each shot we explicitly set or
 * remove these on the shared page so stale values from a previous shot don't
 * leak into the next one (e.g. `protopulse-theme=amber` from shot 15 must not
 * carry over into shot 20).
 */
const RESETTABLE_STORAGE_KEYS = [
  'protopulse-sidebar-collapsed',
  'protopulse-chat-collapsed',
  'protopulse-theme',
  'protopulse-high-contrast',
] as const;

async function capture(
  page: Page,
  consoleErrors: string[],
  consoleWarnings: string[],
  spec: ShotSpec,
  sessionId: string,
  projectId: number,
): Promise<Manifest['shots'][number]> {
  const resolvedUrl = spec.url.replace('__PID__', String(projectId));
  const viewport = spec.viewport ?? DESKTOP_VP;

  // Wipe previous shot's console capture — the listeners stay attached to the
  // long-lived page so each shot needs a fresh view.
  consoleErrors.length = 0;
  consoleWarnings.length = 0;
  let readinessMiss: string | undefined;

  // Per-shot localStorage reconciliation. We drive this via page.evaluate
  // against the CURRENT document (the previous shot's origin), so values
  // apply before navigation and persist across the wouter client-side route
  // change. Session + onboarding-dismissed are applied to every
  // authenticated shot so we don't re-trigger the WelcomeOverlay.
  const applied: Record<string, string> = spec.loggedOut
    ? { ...spec.localStorage }
    : {
        'protopulse-session-id': sessionId,
        'protopulse-onboarding-dismissed': 'true',
        ...spec.localStorage,
      };
  const removed: string[] = [
    ...RESETTABLE_STORAGE_KEYS.filter((k) => !(k in applied)),
    ...(spec.loggedOut ? ['protopulse-session-id'] : []),
  ];

  await page
    .evaluate(
      (payload: { set: Record<string, string>; del: string[] }) => {
        for (const k of payload.del) window.localStorage.removeItem(k);
        for (const [k, v] of Object.entries(payload.set)) {
          window.localStorage.setItem(k, v);
        }
      },
      { set: applied, del: removed },
    )
    .catch(() => {
      /* about:blank initial page has no localStorage — fine, addInitScript covers it */
    });

  const htmlClasses = spec.htmlClasses ?? [];

  try {
    // Resize the shared page's viewport for this shot (desktop vs mobile).
    const currentVp = page.viewportSize();
    if (!currentVp || currentVp.width !== viewport.width || currentVp.height !== viewport.height) {
      await page.setViewportSize(viewport);
    }

    // Navigate. Use 'load' (document + subresources) rather than 'networkidle'
    // because ProtoPulse keeps long-lived sockets / polling that never idle.
    await page.goto(`${BASE_URL}${resolvedUrl}`, {
      waitUntil: 'load',
      timeout: 30_000,
    });

    // Reset any html classes left over from the previous shot (e.g.
    // `reduced-motion`, `high-contrast`) before applying this shot's set.
    await page.evaluate((classes: string[]) => {
      // Keep Tailwind's `dark`/`light` theme class alone — the ThemeProvider
      // owns that — but clear audit-specific modifiers.
      const root = document.documentElement;
      const protected_ = new Set(['dark', 'light']);
      for (const c of Array.from(root.classList)) {
        if (!protected_.has(c)) root.classList.remove(c);
      }
      for (const c of classes) root.classList.add(c);
    }, htmlClasses);

    // Readiness gate 1: wait for the "Loading project..." skeleton chrome to
    // disappear. This is surfaced by ProjectLoadingSkeleton.tsx. It may never
    // render at all (e.g. on /settings, /auth), so we swallow the timeout.
    await page
      .getByText('Loading project...', { exact: false })
      .waitFor({ state: 'detached', timeout: 8_000 })
      .catch(() => {
        /* not present or already gone — fine */
      });

    // Readiness gate 2: wait for the view-specific testid. This is the most
    // reliable signal that the target view has actually mounted. When multiple
    // testids are provided, the first one to match wins (e.g. a view's
    // populated-state testid OR its empty-state testid). If none match before
    // the timeout we DON'T fail the shot — we capture whatever is on screen
    // and mark the miss in the manifest so the auditor can follow up.
    if (spec.waitForTestId) {
      const testIds = Array.isArray(spec.waitForTestId)
        ? spec.waitForTestId
        : [spec.waitForTestId];
      const selector = testIds.map((id) => `[data-testid="${id}"]`).join(', ');
      try {
        // 'attached' rather than 'visible' — ReactFlow-based views (architecture,
        // pcb, breadboard) render their root div with `h-full` before the flow
        // chrome has sized, so Playwright reports 0-height → not visible. By
        // the time we screenshot (after settleMs) the element is fully laid
        // out. 'attached' + settleMs together is the reliable combo.
        await page.locator(selector).first().waitFor({
          state: 'attached',
          timeout: 12_000,
        });
      } catch {
        readinessMiss = testIds.join('|');
        console.warn(
          `[audit-v2] ${spec.slug}: readiness testid(s) ${readinessMiss} never attached — screenshotting anyway`,
        );
      }
    }

    // Readiness gate 3: let React settle any post-mount effects and allow
    // queued RAFs (animations, ReactFlow layout, skeleton-to-content crossfade)
    // to finish. This is where the 1200ms wasn't enough before.
    if (spec.settleMs) {
      await page.waitForTimeout(spec.settleMs);
    }

    // Capture screenshot first so an a11y failure doesn't prevent visual evidence.
    let screenshotStatus: 'ok' | 'missing' = 'missing';
    try {
      const screenshotPath = path.join(OUT_DIR, `${spec.slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshotStatus = 'ok';
    } catch (shotErr) {
      consoleErrors.push(
        `screenshot failed: ${shotErr instanceof Error ? shotErr.message : String(shotErr)}`,
      );
    }

    // ARIA snapshot via locator.ariaSnapshot() — modern Playwright API.
    let ariaYaml = '';
    try {
      ariaYaml = await page.locator('body').ariaSnapshot({ timeout: 5_000 });
    } catch (ariaErr) {
      ariaYaml = `# ariaSnapshot failed: ${
        ariaErr instanceof Error ? ariaErr.message : String(ariaErr)
      }`;
    }
    await fs.writeFile(
      path.join(OUT_DIR, `${spec.slug}.aria.yaml`),
      ariaYaml,
      'utf8',
    );

    await fs.writeFile(
      path.join(OUT_DIR, `${spec.slug}.console.json`),
      JSON.stringify({ errors: [...consoleErrors], warnings: [...consoleWarnings] }, null, 2),
      'utf8',
    );

    const ariaLineCount = countAriaLines(ariaYaml);

    return {
      slug: spec.slug,
      description: spec.description,
      url: resolvedUrl,
      viewport,
      status: 'ok',
      consoleErrorCount: consoleErrors.length,
      consoleWarningCount: consoleWarnings.length,
      ariaLineCount,
      screenshot: screenshotStatus,
      htmlClasses,
      ...(readinessMiss ? { readinessMiss } : {}),
    };
  } catch (err) {
    return {
      slug: spec.slug,
      description: spec.description,
      url: resolvedUrl,
      viewport,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      consoleErrorCount: consoleErrors.length,
      consoleWarningCount: consoleWarnings.length,
      ariaLineCount: 0,
      screenshot: 'missing',
      htmlClasses,
      ...(readinessMiss ? { readinessMiss } : {}),
    };
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Quick sanity-check: is the dev server up?
  try {
    const res = await fetch(`${BASE_URL}/`);
    if (!res.ok) {
      throw new Error(`dev server responded ${res.status}`);
    }
  } catch (err) {
    throw new Error(
      `dev server not reachable at ${BASE_URL}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  console.log('[audit-v2] Authenticating...');
  const { sessionId, username } = await authenticate();
  console.log(`[audit-v2] Session for ${username}`);

  console.log('[audit-v2] Creating scratch project...');
  const projectId = await createProject(sessionId);
  console.log(`[audit-v2] Project id = ${projectId}`);

  console.log('[audit-v2] Launching browser...');
  const browser = await chromium.launch({ headless: true });

  // One long-lived context + page for the entire run. Previously we created a
  // fresh context per shot which, with 22 shots × ~70 Vite chunks per cold
  // load, reliably blew past the dev server's 1000 req/min limit and returned
  // 429 from shot ~15 onward — collapsing every later capture to the auth
  // fallback page. Sharing the context keeps Vite modules cached and the
  // session cookie warm, so the whole run fits comfortably under the quota.
  //
  // NOTE: we intentionally do NOT use context.addInitScript to seed the
  // session id — that would re-plant the key on every navigation and break
  // the `loggedOut` shot (which needs the key gone). Instead we prime the
  // origin once below with a page.evaluate, and each subsequent shot drives
  // its own localStorage reconciliation via page.evaluate before navigating.
  const context: BrowserContext = await browser.newContext({
    viewport: DESKTOP_VP,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  const page: Page = await context.newPage();
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') consoleErrors.push(msg.text());
    else if (type === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  // Prime the origin so page.evaluate() can touch localStorage on the right
  // document. A quick hit to the auth page is enough — we just need ANY real
  // page load so the subsequent evaluate calls run on the app origin, not
  // about:blank.
  console.log('[audit-v2] Priming origin...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 30_000 });
  await page.evaluate(
    (payload: { sessionId: string }) => {
      window.localStorage.setItem('protopulse-session-id', payload.sessionId);
      window.localStorage.setItem('protopulse-onboarding-dismissed', 'true');
    },
    { sessionId },
  );

  // Pacing: the dev server's rate limiter is 1000 req/min. Each workspace
  // shot fires ~30–80 requests (project/architecture/bom/validation/history
  // + AI tool endpoints + vault backlinks + metrics). Bursting those back-to-
  // back blows the window, so we sleep briefly between shots to let the
  // rolling window drain. 2.5s is empirically plenty without bloating the
  // run past ~12 min.
  const INTER_SHOT_COOLDOWN_MS = 2_500;

  const results: Manifest['shots'] = [];
  for (const [idx, spec] of SHOTS.entries()) {
    if (idx > 0) {
      await page.waitForTimeout(INTER_SHOT_COOLDOWN_MS);
    }
    const startedAt = Date.now();
    const result = await capture(
      page,
      consoleErrors,
      consoleWarnings,
      spec,
      sessionId,
      projectId,
    );
    const dur = Date.now() - startedAt;
    const missFragment = result.readinessMiss ? ` MISS=${result.readinessMiss}` : '';
    const tag =
      result.status === 'ok'
        ? `ok (${String(dur)}ms, aria=${String(result.ariaLineCount)}, shot=${result.screenshot}, ${String(result.consoleErrorCount)} err / ${String(result.consoleWarningCount)} warn${missFragment})`
        : `FAILED (${result.error ?? 'unknown'})`;
    console.log(`[audit-v2] ${spec.slug}: ${tag}`);
    results.push(result);
  }

  await context.close();
  await browser.close();

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    playwrightVersion: '1.58.2',
    shots: results,
  };
  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );

  const okCount = results.filter((r) => r.status === 'ok').length;
  console.log(
    `[audit-v2] Done. ${String(okCount)}/${String(results.length)} shots ok. Output in ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error('[audit-v2] FATAL:', err);
  process.exit(1);
});
