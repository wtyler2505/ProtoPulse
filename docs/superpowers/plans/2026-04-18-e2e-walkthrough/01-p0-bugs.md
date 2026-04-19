# P0 Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every P0 bug identified by the 2026-04-18 E2E walkthrough — project-scope data leaks, 401 public-browse endpoints, DRC false positives on empty designs, the non-existent `/settings` route, the non-reactive light-mode toggle, and the empty-state DOM leak — without introducing regressions elsewhere.

**Architecture:** Each P0 is isolated (no P0 blocks another), so the plan executes as independent TDD slices that can ship one-commit-at-a-time. Server fixes land first (lowest risk of UI regression); client fixes land second; the empty-state DOM leak and light-mode toggle land last because they touch shared CSS/state primitives owned by `16-design-system.md`.

**Tech Stack:** Express 5 + Drizzle ORM (server), React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui (client), Vitest 4 (unit/integration), Playwright (e2e). Existing P0 security test suite lives at `server/__tests__/p0-server-security.test.ts` — extend it, don't shadow it.

**Parent:** `00-master-index.md` §3.1 (P0 explicit reroutes), §4.3 (multi-owner), §5 (Tier A, Wave 1).

**Tier:** A (must land before any other tier).

**Depends on:** none.

**Blocks:** every sub-plan except `02-p1-dead-buttons.md` (which runs in parallel within Wave 1 on strictly disjoint files).

---

## Coverage

Every finding listed here is claimed by THIS plan. `00-master-index.md` §12 verification bash loop will assert each of these appears in a commit authored by this plan's tasks.

| E2E ID | Severity | Finding (one-line) | Task |
|--------|----------|--------------------|------|
| E2E-015 | 🔴 BUG | Validation shows "All Checks Passing" on a 0-component project | Task 3.1 |
| E2E-091 | 🔴 P0 | Validation reports 128 issues on a 1-component project | Task 3.2 |
| E2E-093 | 🔴 P0 | Dashboard "All Checks Passing" disagrees with Validation's 128 issues | Task 3.3 |
| E2E-298 | 🔴 P0 | Audit Trail leaks entries from OTHER projects (OmniTrek Nexus shown on Blink LED) | Task 1.1-1.5 |
| E2E-312 | 🔴 P0 | 401 on `/api/parts/browse/alternates` | Task 2.1-2.5 |
| E2E-313 | 🔴 P0 | 401 on `/api/parts/browse/usage` | Task 2.1-2.5 |
| E2E-460 | 🔴 P0 | Audit Trail project leak confirmed visually (same bug as E2E-298) | Task 1.1-1.5 (resolved transitively) |
| E2E-481 | 🔴 P0 | Alternates tab renders only "Failed to load X data" | Task 2.6 (asserted via Playwright after Task 2.5 fix) |
| E2E-482 | 🔴 P0 | Part Usage tab — error message small/red on dark, barely visible | Task 2.6 (same assertion) |
| E2E-502 | 🔴 P0 | `/settings` returns 404 Page Not Found | Task 4.1-4.5 |
| E2E-546 | 🔴 project-scope expansion | Every list endpoint must take `projectId` filter; server test asserts no foreign-project entity leaks | Task 1.6-1.8 (middleware + test) |
| E2E-551 | 🔴 DRC expansion | DRC findings need `requiresPlacedComponents: boolean` flag | Task 3.4-3.6 |
| E2E-573 | 🔴 BUG | Pre-flight passes all 5 checks on empty breadboard | Task 3.7 |
| E2E-572 | 🔴 BUG | Audit reports score 100/100 healthy on empty board | Task 3.8 |
| E2E-950 | 🟡 → promoted | Empty-state heading persists in DOM after first component placed (a11y leak) | Task 5.1-5.5 |
| E2E-966 | 🟡 | Same empty-state leak on populated schematic (confirmed in Pass 12B) | Task 5.1-5.5 (same fix) |
| E2E-968 | 🔴 P1 → promoted P0 | Light-mode toggle is broken (classList changes, visuals don't) | Task 6.1-6.5 |
| E2E-1037 | 🔴 P0 | Same as E2E-968 (design-system confirmation) | Task 6.1-6.5 |

**Count:** 18 IDs directly owned + E2E-481/482 asserted as side-effect of Task 2. Total 18 unique IDs.

## Existing Infrastructure (read, don't reinvent)

| Concern | File(s) | Notes |
|---------|---------|-------|
| Global auth middleware | `server/index.ts:226-247` | Checks `isPublicApiPath` first; else demands `x-session-id` header |
| Public API allowlist | `server/request-routing.ts:5-13` (`PUBLIC_API_PATHS`) | Fix for E2E-312/313 adds `/api/parts/browse/` here |
| P0 security test suite | `server/__tests__/p0-server-security.test.ts` | Existing test file — extend, don't duplicate |
| Parts browse routes | `server/routes/parts.ts:301-329` (`/api/parts/browse/alternates`, `/api/parts/browse/usage`) | No `requireAuth` on routes themselves; relies on global middleware |
| Parts client fetchers | `client/src/hooks/` (grep `browse/alternates`, `browse/usage`) | Task 2.6 asserts these render data after fix |
| Audit trail routes | `server/routes/audit.ts` (grep to confirm) | Task 1 adds `projectId` filter |
| Audit trail storage | `server/storage/audit-storage.ts` (grep to confirm) | Task 1 enforces projectId scope |
| DRC engine | `server/services/drc/` (grep `export function runDRC`) | Task 3 adds empty-design guard + `requiresPlacedComponents` flag |
| Validation selector | `client/src/hooks/useValidation*.ts` | Task 3.3 unifies Dashboard + Validation summary |
| Breadboard audit | `server/services/breadboard/audit.ts` (grep) | Task 3.8 empty-board guard |
| Breadboard pre-flight | `server/services/breadboard/preflight.ts` (grep) | Task 3.7 empty-board guard |
| Settings page route | `client/src/App.tsx` (Wouter `<Route>` list) | Task 4 adds `/settings` |
| Settings landing component | does not yet exist | Task 4 creates `client/src/pages/settings/SettingsPage.tsx` |
| Schematic empty-state | `client/src/components/schematic/EmptyState.tsx` (grep) | Task 5 conditional render fix |
| Theme toggle | `client/src/components/ThemeToggle.tsx` (grep) | Task 6 investigates root cause |
| Tailwind dark mode config | `tailwind.config.ts` / `tailwind.config.js` | Task 6 verifies `darkMode: "class"` |
| Electron shell | `electron/` | No P0 changes here |

**Do before starting any task:** run `rg -l "PUBLIC_API_PATHS|auditStorage|empty-schematic|ThemeToggle"` and read each hit. Update this table if files moved since 2026-04-18.

## Research protocol (before Phase 1 and on stuck moments)

- **Context7**: `resolve-library-id` for `express` (5.x) → `query-docs` "how to express-augment typed request middleware". For `drizzle-orm` → `query-docs` "where clause with user-scoped predicate". For `react-router` / `wouter` (verify project uses wouter) → `query-docs` "nested routes".
- **Codebase**: ast-grep `app.get($$, $handler)` to map every list endpoint. Verify Task 1.6 middleware covers them all.
- **WebSearch**: "IEEE AccessibleName empty-state on DOM hidden elements" for Task 5. "Tailwind 4 dark mode class strategy" for Task 6.
- **Vault**: `qmd search "empty-state a11y pattern"` — if a vault note exists, link it.
- **Advisor**: call `advisor()` after Task 1.5 (first test fails green), then again before Task 6.5 (last task).

---

## Phase 1 — Audit Trail project-scope leak (E2E-298, E2E-460, E2E-546)

**Files:**
- Modify: `server/routes/audit.ts` (add projectId query-param, enforce in handler)
- Modify: `server/storage/audit-storage.ts` (accept projectId, add to WHERE clause)
- Create: `server/__tests__/p0-audit-scope.test.ts`
- Create: `server/middleware/project-scope.ts` (shared middleware for Task 1.6)
- Modify: `server/__tests__/p0-server-security.test.ts` (register new middleware in E2E-546 coverage)
- Modify: `client/src/pages/audit-trail/AuditTrailPage.tsx` (append `?projectId=` to fetch)

**`/agent-teams` prompt (if dispatched):**
```
Team: "p0-audit-scope"
Members: 2
File ownership:
  Member A: server/routes/audit.ts, server/storage/audit-storage.ts, server/middleware/project-scope.ts, tests (server/__tests__/p0-audit-scope.test.ts), server/__tests__/p0-server-security.test.ts
  Member B: client/src/pages/audit-trail/AuditTrailPage.tsx, client/src/hooks/useAuditTrail.ts
Context: E2E-298 shows OmniTrek Nexus audit entries on Blink LED tab. Root cause candidate: /api/audit/* list endpoint returns global history, not project-filtered. Verify via rg before assuming.
Success: Playwright test opens project A, creates audit entry "A-entry", opens project B, asserts "A-entry" NOT visible.
```

- [ ] **Task 1.1 — Reproduce the leak (Playwright e2e failing test)**

File: `tests/e2e/p0-audit-scope.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { loginAsE2EUser, openProject, createAuditEvent } from './helpers';

test('audit trail must not leak entries from other projects (E2E-298)', async ({ page }) => {
  await loginAsE2EUser(page);
  const projA = await openProject(page, 'Blink LED');
  await createAuditEvent(page, projA, { type: 'Created', entity: 'E2E-298-CanaryA' });

  const projB = await openProject(page, 'OmniTrek Nexus');
  await page.getByRole('tab', { name: 'Audit Trail' }).click();
  await page.waitForSelector('[data-testid="audit-trail-list"]');

  const leaked = await page.getByText('E2E-298-CanaryA').count();
  expect(leaked, 'Audit entries from project A must not appear when viewing project B').toBe(0);
});
```

Run: `npx playwright test tests/e2e/p0-audit-scope.spec.ts`
Expected: **FAIL** — entry count === 1 (the leak).

- [ ] **Task 1.2 — Run test to verify failure mode**

Run: `npx playwright test tests/e2e/p0-audit-scope.spec.ts --reporter=list`
Expected: test fails with "expected 0, received 1" (or similar). Capture screenshot in `test-results/` and attach to commit.

- [ ] **Task 1.3 — Add server-side projectId enforcement**

Modify `server/routes/audit.ts`:

```ts
// BEFORE: app.get('/api/audit/events', requireAuth, async (req, res) => { ... })
// AFTER:
app.get('/api/audit/events', requireAuth, requireProjectScope, async (req, res) => {
  const { projectId } = res.locals.projectScope; // set by requireProjectScope middleware
  const events = await auditStorage.listEvents({ projectId, userId: req.userId });
  res.json({ data: events, total: events.length });
});
```

Modify `server/storage/audit-storage.ts`:

```ts
async listEvents({ projectId, userId }: { projectId: number; userId: number }): Promise<AuditEvent[]> {
  return db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.projectId, projectId), eq(auditEvents.userId, userId)))
    .orderBy(desc(auditEvents.createdAt));
}
```

- [ ] **Task 1.4 — Add projectId query param to client fetcher**

Modify `client/src/pages/audit-trail/AuditTrailPage.tsx`:

```tsx
const { projectId } = useCurrentProject();
const { data } = useQuery({
  queryKey: ['audit-events', projectId],
  queryFn: () => fetchJson(`/api/audit/events?projectId=${projectId}`),
  enabled: projectId != null,
});
```

- [ ] **Task 1.5 — Run Playwright test: expect PASS + add commit**

Run: `npx playwright test tests/e2e/p0-audit-scope.spec.ts`
Expected: PASS.

Also run the existing P0 security suite:
Run: `npm test -- server/__tests__/p0-server-security.test.ts`
Expected: PASS (no regressions).

Commit:
```bash
git add server/routes/audit.ts server/storage/audit-storage.ts \
        client/src/pages/audit-trail/AuditTrailPage.tsx \
        tests/e2e/p0-audit-scope.spec.ts
git commit -m "fix(audit): scope audit trail by projectId (E2E-298, E2E-460, E2E-546)

The audit trail endpoint returned events across all projects, leaking
entries from project A into project B's UI. Enforce projectId via a new
requireProjectScope middleware and a scoped Drizzle WHERE clause. Add
Playwright regression test that fails without the fix.

Refs: docs/audits/2026-04-18-frontend-e2e-walkthrough.md (E2E-298, E2E-460)"
```

**Call `advisor()` here** before proceeding to Task 1.6 (middleware generalization).

- [ ] **Task 1.6 — Write the shared `requireProjectScope` middleware + failing multi-route test (E2E-546)**

File: `server/middleware/project-scope.ts`

```ts
import type { Request, Response, NextFunction } from 'express';

/**
 * Require a projectId in the query string. Validates it's a positive integer.
 * Emits 400 if missing/invalid. Sets res.locals.projectScope.projectId for handlers.
 */
export function requireProjectScope(req: Request, res: Response, next: NextFunction): void {
  const raw = req.query.projectId;
  const projectId = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(projectId) || projectId <= 0) {
    res.status(400).json({ message: 'projectId query parameter is required and must be a positive integer' });
    return;
  }
  res.locals.projectScope = { projectId };
  next();
}
```

File: `server/__tests__/p0-audit-scope.test.ts`

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp, seedTwoProjectsWithAuditEntries } from './helpers';

describe('P0 — audit trail project-scope enforcement', () => {
  let app: import('express').Express;
  let sessionId: string;
  let projectA: number;
  let projectB: number;

  beforeAll(async () => {
    ({ app, sessionId, projectA, projectB } = await seedTwoProjectsWithAuditEntries());
  });

  it('rejects missing projectId with 400', async () => {
    const res = await request(app).get('/api/audit/events').set('x-session-id', sessionId);
    expect(res.status).toBe(400);
  });

  it('returns only project A events when projectId=A', async () => {
    const res = await request(app).get(`/api/audit/events?projectId=${projectA}`).set('x-session-id', sessionId);
    expect(res.status).toBe(200);
    expect(res.body.data.every((e: { projectId: number }) => e.projectId === projectA)).toBe(true);
  });

  it('returns only project B events when projectId=B', async () => {
    const res = await request(app).get(`/api/audit/events?projectId=${projectB}`).set('x-session-id', sessionId);
    expect(res.body.data.every((e: { projectId: number }) => e.projectId === projectB)).toBe(true);
    expect(res.body.data.some((e: { projectId: number }) => e.projectId === projectA)).toBe(false);
  });
});
```

Run: `npm test -- server/__tests__/p0-audit-scope.test.ts`
Expected: PASS (middleware + route already wired in Task 1.3).

- [ ] **Task 1.7 — Wire the shared middleware into other list endpoints (E2E-546 expansion)**

Grep for list endpoints that should be project-scoped:

```bash
rg -n "app\.get\('/api/(bom|procurement|parts|validation|exports|snapshots|comments)" server/routes/
```

For each that returns lists of project-owned entities, add `requireProjectScope` (or refactor to use `/api/projects/:id/xxx` path convention). Document each addition in the commit message.

Candidates (verify before modifying):
- `/api/audit/events` ✓ already done
- `/api/audit/entities`
- `/api/comments` (if not already `/api/projects/:id/comments`)
- `/api/snapshots`
- `/api/bom/templates` (may legitimately be global — verify)

For each endpoint touched, add a parallel supertest case to `server/__tests__/p0-audit-scope.test.ts` (rename file to `p0-project-scope.test.ts` if scope widens).

- [ ] **Task 1.8 — Run full check + commit middleware generalization**

```bash
npm run check && npm test && npx eslint . && npx prettier --write .
git add server/middleware/project-scope.ts server/routes/ server/__tests__/
git commit -m "feat(server): add requireProjectScope middleware; apply to list endpoints (E2E-546)

Generalizes the audit-trail fix (E2E-298) into reusable middleware so
every list endpoint that exposes project-owned entities enforces a
projectId query param. Covers /api/audit/events, /api/audit/entities,
/api/comments, /api/snapshots. Full list in commit diff."
```

---

## Phase 2 — 401 on `/api/parts/browse/*` (E2E-312, E2E-313, E2E-481, E2E-482)

**Files:**
- Modify: `server/request-routing.ts` (add `/api/parts/browse/` to `PUBLIC_API_PATHS`)
- Modify: `server/__tests__/request-routing.test.ts` (assert new public path)
- Modify: `server/__tests__/p0-server-security.test.ts` (assert browse endpoints do NOT leak any user-scoped data despite being public)
- No client changes required (the fetchers already exist; they'll stop getting 401s)
- Add: `tests/e2e/p0-alternates-part-usage-render.spec.ts` (verifies E2E-481/482 rendering)

**`/agent-teams` prompt:**
```
Team: "p0-parts-browse-auth"
Members: 1 (small, focused)
Context: Global middleware at server/index.ts:226 applies auth unless isPublicApiPath() matches. Browse endpoints at server/routes/parts.ts:302, 317 return aggregate data (no user-scoped fields). Pattern matches /api/vault/ (already public).
Success: Logged-out request to /api/parts/browse/alternates returns 200 with data; Alternates tab renders a list (not a red error).
```

- [ ] **Task 2.1 — Write failing routing test**

Modify `server/__tests__/request-routing.test.ts`:

```ts
describe('PUBLIC_API_PATHS (E2E-312/313)', () => {
  it('marks /api/parts/browse/alternates as public', () => {
    expect(isPublicApiPath('/api/parts/browse/alternates')).toBe(true);
  });
  it('marks /api/parts/browse/usage as public', () => {
    expect(isPublicApiPath('/api/parts/browse/usage')).toBe(true);
  });
  it('keeps /api/parts/:id non-public (requires session)', () => {
    expect(isPublicApiPath('/api/parts/42')).toBe(false);
  });
});
```

Run: `npm test -- server/__tests__/request-routing.test.ts`
Expected: FAIL (first two).

- [ ] **Task 2.2 — Add the allowlist entry**

Modify `server/request-routing.ts`:

```ts
export const PUBLIC_API_PATHS = [
  '/api/auth/',
  '/api/health',
  '/api/ready',
  '/api/docs',
  '/api/metrics',
  '/api/settings/chat',
  '/api/vault/',
  '/api/parts/browse/', // E2E-312/313 — read-only aggregate browse views (no user data)
] as const;
```

- [ ] **Task 2.3 — Verify browse handlers are truly user-agnostic**

Re-read `server/routes/parts.ts:301-329` and `server/storage/parts-storage.ts` to prove `getAlternates()` / `getUsageAcrossProjects()` do NOT filter by userId/projectId. If they do, the fix is wrong — we'd be leaking user data to anon. Document the read in the commit message.

If the handler internally uses `req.userId` or similar, REVERT Task 2.2 and instead call `requireAuth` explicitly on the route (different fix).

- [ ] **Task 2.4 — Add security regression test**

Modify `server/__tests__/p0-server-security.test.ts`:

```ts
it('GET /api/parts/browse/alternates returns 200 without session (E2E-312)', async () => {
  const res = await request(app).get('/api/parts/browse/alternates');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});
it('GET /api/parts/browse/alternates does NOT expose userId/projectId fields (E2E-312 security)', async () => {
  const res = await request(app).get('/api/parts/browse/alternates');
  for (const entry of res.body.data) {
    expect(entry).not.toHaveProperty('userId');
    expect(entry).not.toHaveProperty('ownerSecret');
  }
});
```

Run: `npm test -- server/__tests__`
Expected: PASS.

- [ ] **Task 2.5 — Commit server fix**

```bash
git add server/request-routing.ts server/__tests__/request-routing.test.ts server/__tests__/p0-server-security.test.ts
git commit -m "fix(auth): whitelist /api/parts/browse/ as public (E2E-312, E2E-313)

The Alternates and Part Usage tabs rely on aggregate browse endpoints
that return no user-scoped data. Global auth middleware was 401-ing
anonymous calls, which broke both tabs. Add the path prefix to
PUBLIC_API_PATHS alongside /api/vault/. Regression tests assert:
(1) browse endpoints return 200 without session,
(2) responses never contain userId or ownerSecret fields,
(3) /api/parts/:id remains session-gated."
```

- [ ] **Task 2.6 — Add Playwright assertion that the tabs actually render (E2E-481/482)**

File: `tests/e2e/p0-alternates-part-usage-render.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { loginAsE2EUser, openProject } from './helpers';

test('Alternates tab renders data (not an error) (E2E-481)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  await page.getByRole('tab', { name: 'Alternates' }).click();
  await expect(page.getByText('Failed to load')).toHaveCount(0);
  await expect(page.getByTestId('alternates-list')).toBeVisible();
});

test('Part Usage tab renders data (not an error) (E2E-482)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  await page.getByRole('tab', { name: 'Part Usage' }).click();
  await expect(page.getByText('Failed to load')).toHaveCount(0);
  await expect(page.getByTestId('part-usage-list')).toBeVisible();
});
```

Run: `npx playwright test tests/e2e/p0-alternates-part-usage-render.spec.ts`
Expected: PASS.

Commit:
```bash
git add tests/e2e/p0-alternates-part-usage-render.spec.ts
git commit -m "test(e2e): alternates + part-usage tabs render data (E2E-481, E2E-482)"
```

---

## Phase 3 — DRC / Audit false positives on empty designs (E2E-015, E2E-091, E2E-093, E2E-548, E2E-551, E2E-572, E2E-573)

**Files:**
- Modify: `server/services/drc/engine.ts` (grep to confirm path)
- Modify: `server/services/drc/rules/*.ts` (add `requiresPlacedComponents` flag per rule)
- Modify: `server/services/breadboard/audit.ts` (empty-board short-circuit)
- Modify: `server/services/breadboard/preflight.ts` (empty-board short-circuit)
- Create: `client/src/hooks/useValidationSummary.ts` (single selector consumed by Dashboard + Validation)
- Modify: `client/src/pages/dashboard/ValidationCard.tsx` (consume new hook)
- Modify: `client/src/pages/validation/ValidationPage.tsx` (consume same hook)
- Test: `server/__tests__/p0-drc-empty-design.test.ts`, `server/__tests__/p0-breadboard-empty-board.test.ts`

**`/agent-teams` prompt:**
```
Team: "p0-drc-emptystate"
Members: 3
File ownership:
  Member A: server/services/drc/* + tests
  Member B: server/services/breadboard/{audit,preflight}.ts + tests
  Member C: client hooks + ValidationCard + ValidationPage
Context: DRC fires all rules on 0-component designs, producing 128 false positives. Dashboard simultaneously says "All Checks Passing" by using a DIFFERENT selector. Both need to consume one source of truth.
Success:
  (1) Empty project: validation summary says "No design to validate yet — add components to begin"
  (2) 1-component project: validation shows only rules that apply (no rules requiring >=2 components)
  (3) Dashboard's count === Validation page's count for same project+state
```

- [ ] **Task 3.1 — Failing test: 0-component validation must report "no design yet" (E2E-015)**

File: `server/__tests__/p0-drc-empty-design.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { runValidation } from '../services/drc/engine';

describe('P0 — DRC on empty designs (E2E-015, E2E-091)', () => {
  it('returns sentinel no-design status for a project with 0 components', async () => {
    const result = await runValidation({ projectId: 1, components: [], connections: [], boardPlaced: false });
    expect(result.status).toBe('no-design');
    expect(result.issues).toEqual([]);
    expect(result.summary).toMatch(/add components to begin/i);
  });

  it('does NOT report "All Checks Passing" on empty project (E2E-015)', async () => {
    const result = await runValidation({ projectId: 1, components: [], connections: [], boardPlaced: false });
    expect(result.summary).not.toMatch(/all checks passing/i);
  });
});
```

Run: `npm test -- p0-drc-empty-design`
Expected: FAIL.

- [ ] **Task 3.2 — Failing test: 1-component validation must NOT report 128 issues (E2E-091)**

Add to same test file:

```ts
it('reports issue count ≤ rule count (never 128 on a 1-component project)', async () => {
  const result = await runValidation({
    projectId: 1,
    components: [{ id: 'U1', type: 'microcontroller' }],
    connections: [],
    boardPlaced: false,
  });
  expect(result.issues.length).toBeLessThan(20);
});
```

- [ ] **Task 3.3 — Failing integration test: Dashboard + Validation report same count (E2E-093, E2E-548)**

File: `client/src/hooks/__tests__/useValidationSummary.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useValidationSummary } from '../useValidationSummary';
import { withQueryClient } from '../../test-utils/queryClient';

describe('useValidationSummary parity (E2E-093)', () => {
  it('dashboard and validation tab consume the same counts', async () => {
    const wrapper = withQueryClient();
    const { result: dashResult } = renderHook(() => useValidationSummary({ consumer: 'dashboard' }), { wrapper });
    const { result: valResult } = renderHook(() => useValidationSummary({ consumer: 'validation' }), { wrapper });

    await waitFor(() => {
      expect(dashResult.current.data).toBeDefined();
      expect(valResult.current.data).toBeDefined();
    });

    expect(dashResult.current.data?.errorCount).toBe(valResult.current.data?.errorCount);
    expect(dashResult.current.data?.warningCount).toBe(valResult.current.data?.warningCount);
    expect(dashResult.current.data?.infoCount).toBe(valResult.current.data?.infoCount);
  });
});
```

- [ ] **Task 3.4 — Add `requiresPlacedComponents` flag (E2E-551)**

Modify the DRC rule type in `server/services/drc/types.ts`:

```ts
export interface DRCRule {
  id: string;
  name: string;
  category: 'signal' | 'power' | 'best-practice' | 'manufacturing';
  severity: 'error' | 'warning' | 'info';
  /** True if this rule cannot meaningfully run unless components are placed. */
  requiresPlacedComponents: boolean;
  /** True if this rule needs a PCB layout (placed + routed) to fire. */
  requiresPcbLayout?: boolean;
  check: (ctx: DRCContext) => DRCFinding[];
}
```

Audit each rule file under `server/services/drc/rules/` and set the flag correctly. Rules that validate component-to-component relationships → `requiresPlacedComponents: true`. Rules validating project metadata (e.g. "BOM has a revision") → `false`.

- [ ] **Task 3.5 — Implement empty-design short-circuit in engine**

Modify `server/services/drc/engine.ts`:

```ts
export async function runValidation(ctx: DRCContext): Promise<DRCResult> {
  if (ctx.components.length === 0) {
    return {
      status: 'no-design',
      issues: [],
      summary: 'No design to validate yet — add components to begin',
      rulesEvaluated: 0,
      rulesSkipped: ALL_RULES.length,
    };
  }

  const applicableRules = ALL_RULES.filter(rule => {
    if (rule.requiresPcbLayout && !ctx.boardPlaced) return false;
    if (rule.requiresPlacedComponents && ctx.components.length === 0) return false;
    return true;
  });

  const issues = applicableRules.flatMap(rule => rule.check(ctx));
  return {
    status: issues.length === 0 ? 'all-passing' : 'has-issues',
    issues,
    summary: buildSummary(issues, applicableRules.length, ALL_RULES.length - applicableRules.length),
    rulesEvaluated: applicableRules.length,
    rulesSkipped: ALL_RULES.length - applicableRules.length,
  };
}
```

Run the test from Task 3.1 + 3.2: expect PASS.

- [ ] **Task 3.6 — Implement the unified `useValidationSummary` hook**

File: `client/src/hooks/useValidationSummary.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { useCurrentProject } from './useCurrentProject';

export type ValidationSummary = {
  status: 'no-design' | 'all-passing' | 'has-issues';
  errorCount: number;
  warningCount: number;
  infoCount: number;
  summary: string;
  rulesEvaluated: number;
  rulesSkipped: number;
};

export function useValidationSummary(opts: { consumer: 'dashboard' | 'validation' } = { consumer: 'dashboard' }) {
  const { projectId } = useCurrentProject();
  return useQuery<ValidationSummary>({
    queryKey: ['validation-summary', projectId],
    queryFn: () => fetchJson(`/api/validation/summary?projectId=${projectId}`),
    enabled: projectId != null,
    staleTime: 5_000,
  });
}
```

Refactor `client/src/pages/dashboard/ValidationCard.tsx` + `client/src/pages/validation/ValidationPage.tsx` to consume this hook. Delete the older duplicate selectors.

- [ ] **Task 3.7 — Breadboard pre-flight empty-board guard (E2E-573)**

Modify `server/services/breadboard/preflight.ts`:

```ts
export async function runPreflight(ctx: BreadboardContext): Promise<PreflightResult> {
  if (ctx.placedParts.length === 0) {
    return {
      status: 'no-design',
      summary: 'Cannot pre-flight: no components placed. Drag a starter part onto the board to begin.',
      checks: [],
    };
  }
  // existing logic
}
```

Add test: `server/__tests__/p0-breadboard-empty-board.test.ts`.

- [ ] **Task 3.8 — Breadboard audit empty-board guard (E2E-572)**

Same pattern as Task 3.7 for `server/services/breadboard/audit.ts`. Empty board should NOT score 100/100; it should return `status: 'no-design'` with score `null`.

- [ ] **Task 3.9 — Run full check + commit**

```bash
npm run check && npm test && npx eslint . && npx prettier --write .
git add server/services/drc/ server/services/breadboard/ \
        client/src/hooks/useValidationSummary.ts \
        client/src/pages/dashboard/ValidationCard.tsx \
        client/src/pages/validation/ValidationPage.tsx \
        server/__tests__/p0-drc-empty-design.test.ts \
        server/__tests__/p0-breadboard-empty-board.test.ts \
        client/src/hooks/__tests__/useValidationSummary.test.tsx
git commit -m "fix(validation): eliminate DRC/audit false positives on empty designs (E2E-015, E2E-091, E2E-093, E2E-548, E2E-551, E2E-572, E2E-573)

- DRC rules declare requiresPlacedComponents; engine skips inapplicable rules on empty designs and returns a no-design status instead of fake 'All Checks Passing' or 128 issues.
- Breadboard audit + preflight short-circuit on empty boards with a helpful message.
- Dashboard + Validation page now consume a single useValidationSummary hook — counts cannot disagree."
```

---

## Phase 4 — `/settings` 404 (E2E-502, + partial E2E-503/504)

**Files:**
- Modify: `client/src/App.tsx` (add `<Route path="/settings">`)
- Create: `client/src/pages/settings/SettingsPage.tsx`
- Create: `client/src/pages/settings/sections/ProfileSection.tsx`
- Create: `client/src/pages/settings/sections/AppearanceSection.tsx` (hosts E2E-517 theme toggle if ship with Phase 6)
- Create: `client/src/pages/settings/sections/APIKeysSection.tsx`
- Test: `tests/e2e/p0-settings-route.spec.ts`

**Note on scope:** E2E-504 (full settings catalog — API keys, notifications, GDPR export, delete account) is NOT fully delivered here. Phase 4 ships a **routable skeleton** that prevents the 404. The full settings catalog is its own Tier E project tracked in `17-shell-header-nav.md`. Document this narrowing in the commit message.

- [ ] **Task 4.1 — Failing Playwright test**

File: `tests/e2e/p0-settings-route.spec.ts`

```ts
test('/settings renders a page (not 404) (E2E-502)', async ({ page }) => {
  await loginAsE2EUser(page);
  await page.goto('/settings');
  await expect(page.getByText('Page Not Found')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
});
```

Run: FAIL.

- [ ] **Task 4.2 — Scaffold skeleton page**

`client/src/pages/settings/SettingsPage.tsx`:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProfileSection } from './sections/ProfileSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { APIKeysSection } from './sections/APIKeysSection';

export function SettingsPage() {
  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="apikeys">API Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileSection /></TabsContent>
        <TabsContent value="appearance"><AppearanceSection /></TabsContent>
        <TabsContent value="apikeys"><APIKeysSection /></TabsContent>
      </Tabs>
    </main>
  );
}
```

Each section component is a skeleton with a "TODO — see 17-shell-header-nav.md" placeholder.

- [ ] **Task 4.3 — Register route**

Modify `client/src/App.tsx` — add `<Route path="/settings" component={SettingsPage} />` in the Wouter `<Switch>`.

- [ ] **Task 4.4 — Verify sidebar gear icon routes here**

Grep for the gear icon in sidebar (`rg 'settings' client/src/pages/workspace/WorkspaceSidebar.tsx`). Confirm the click handler navigates to `/settings`. If it points somewhere else (e.g. opens a modal), wire it to `setLocation('/settings')`.

- [ ] **Task 4.5 — Run + commit**

```bash
npx playwright test tests/e2e/p0-settings-route.spec.ts   # expect PASS
npm run check && npm test
git add client/src/App.tsx client/src/pages/settings/ tests/e2e/p0-settings-route.spec.ts
git commit -m "fix(routing): /settings renders a skeleton page instead of 404 (E2E-502)

Scaffold SettingsPage with tabs for Profile / Appearance / API Keys. Each section is
a placeholder; full content is owned by 17-shell-header-nav plan (E2E-504). This
commit only fixes the 404; it does not attempt to ship the full settings catalog."
```

---

## Phase 5 — Empty-state DOM leak (E2E-950, E2E-966)

**Files:**
- Modify: `client/src/components/schematic/EmptyState.tsx` (or equivalent — grep to confirm)
- Modify: `client/src/pages/schematic/SchematicCanvas.tsx` (conditional render)
- Test: `client/src/components/schematic/__tests__/EmptyState.a11y.test.tsx`

**Note:** This is owned by Phase 5 of THIS plan AND coordinates with `03-a11y-systemic.md` (global empty-state component). Phase 5 ships the narrow Schematic fix; `03` later migrates it to the shared primitive.

- [ ] **Task 5.1 — Failing test: empty-state heading must be absent from DOM on populated canvas**

```tsx
it('does not render the Empty Schematic heading after a component is placed (E2E-950/966)', () => {
  const { queryByRole, rerender } = render(<SchematicCanvas components={[]} />);
  expect(queryByRole('heading', { name: /empty schematic/i })).toBeInTheDocument();

  rerender(<SchematicCanvas components={[MOCK_ATTINY85_INSTANCE]} />);
  expect(queryByRole('heading', { name: /empty schematic/i })).not.toBeInTheDocument();
});
```

Run: FAIL (heading currently stays in DOM, just hidden visually).

- [ ] **Task 5.2 — Conditional render**

In `SchematicCanvas.tsx`, replace `className={components.length > 0 ? 'hidden' : ''}` with an actual `{components.length === 0 && <EmptyState />}` conditional.

- [ ] **Task 5.3 — Rerun test: PASS**

- [ ] **Task 5.4 — Playwright regression**

```ts
test('schematic empty-state heading removed from DOM once populated (E2E-950/966)', async ({ page }) => {
  await loginAsE2EUser(page);
  await openProject(page, 'Blink LED');
  await page.getByRole('tab', { name: 'Schematic' }).click();
  await expect(page.getByRole('heading', { name: /empty schematic/i })).toBeVisible();
  await dragPart(page, 'ATtiny85', { x: 600, y: 400 });
  await expect(page.getByRole('heading', { name: /empty schematic/i })).toHaveCount(0);
});
```

- [ ] **Task 5.5 — Commit**

```bash
git add client/src/components/schematic/EmptyState.tsx client/src/pages/schematic/SchematicCanvas.tsx client/src/components/schematic/__tests__/ tests/e2e/
git commit -m "fix(a11y): unmount Schematic empty-state on populated canvas (E2E-950, E2E-966)

The empty-state heading was display:hidden but remained in the DOM,
causing screen readers to announce 'Empty Schematic' on non-empty views.
Switch from CSS hide to conditional render."
```

---

## Phase 6 — Light-mode toggle non-reactive (E2E-968, E2E-1037)

### Pre-research root cause (verified 2026-04-18 during plan authoring)

Investigated `client/src/index.css`, `client/src/lib/theme-context.tsx`, and `client/src/components/ui/theme-toggle.tsx`. The wiring is correct (toggle → `toggleThemeMode()` → `setCurrentTheme('light')` → `useEffect` → `applyThemeColors(LIGHT)` → `document.documentElement.style.setProperty(...)`).

**Root cause:** `client/src/index.css:4` declares `@theme inline { ... }` wrapping the dark-mode color definitions. Per Tailwind CSS v4 documentation, the `inline` modifier **inlines the variable's literal value into every generated utility class at build time** — e.g. `bg-background` compiles to `background-color: hsl(225 20% 3%);` rather than `background-color: var(--color-background);`. Consequently, the runtime `style.setProperty('--color-background', 'hsl(210 20% 98%)')` call DOES update the custom property on the `<html>` element, but Tailwind-generated classes no longer reference that variable — they reference the build-time-frozen literal. Result: `classList` flips, inline styles flip, but visible Tailwind classes don't react. Audit screenshot matches this exactly.

**Secondary cause:** Even after changing `@theme inline` → `@theme`, hardcoded HSL literals appear throughout `index.css` in utility classes like `.edge-glow` (`hsl(190 100% 43% / 0.3)`, line ~214), `.scan-line`, `.led-on`, `.data-grid`, scrollbar selectors (`*`, `*::-webkit-scrollbar-thumb`), and React Flow overrides (`.react-flow__node`, `.react-flow__handle`). These all need to reference `var(--color-primary)` / `var(--color-border)` etc. so they react to theme changes.

**Tertiary cause (possible):** The `next-themes` sync at `theme-context.tsx:342` (`setNextTheme(currentTheme === 'light' ? 'light' : 'dark')`) flips a `.light` / `.dark` class on `<html>`. Tailwind 4 does NOT auto-apply `dark:` variants unless the config explicitly enables class-based dark mode. Since Tailwind 4 uses the `@custom-variant dark (&:where(.dark, .dark *))` pattern, we need to confirm index.css declares it — if not, add it.

### Research citations

- Tailwind CSS v4 docs — `@theme inline` — ["The inline option causes the variable's value to be inserted directly into utilities at build time, rather than being referenced via `var()`."](https://tailwindcss.com/docs/theme#referencing-other-variables) (Context7 query pending in task 6.1.)
- Project file `client/src/index.css:4` — confirmed `@theme inline { --color-background: hsl(...)` structure.
- Project file `client/src/lib/theme-context.tsx:310-316` — confirmed `applyThemeColors` writes via `style.setProperty`.

### Intended fix (high confidence)

1. Change `@theme inline { ... }` → `@theme { ... }` in `client/src/index.css` so Tailwind generates `var(...)` references, not literals.
2. Add `@custom-variant dark (&:where(.dark, .dark *));` at top of index.css if not already present.
3. Audit all hardcoded HSL literals in `index.css` utility blocks and migrate them to `var(--color-*)`. Each `hsl(190 100% 43%)` becomes `var(--color-primary)`; each `hsl(225 12% 14% ...)` becomes `color-mix(in srgb, var(--color-border) 50%, transparent)` (or define dedicated tokens).
4. Confirm the light preset's `applyThemeColors` still wins over `@theme` values. Inline style on `<html>` beats stylesheet variable declarations by specificity.

**Files:**
- Modify: `client/src/index.css` (primary fix — `@theme inline` → `@theme`, migrate literals)
- Investigate: `client/src/components/ui/theme-toggle.tsx`, `client/src/lib/theme-context.tsx` (no changes expected — wiring is correct)
- Test: `tests/e2e/p0-theme-toggle.spec.ts`
- Verify: `client/src/**/*.tsx` for additional hardcoded HSL/hex (grep `hsl\(19[0-9]` and `#00F0F[0-9]`)

- [ ] **Task 6.1 — Context7 verification + index.css audit**

Call Context7:
```
resolve-library-id tailwindcss
query-docs "@theme inline vs @theme — runtime variable reactivity"
```

Confirm the pre-research finding above. Then run:

```bash
# Count hardcoded theme-colored literals to migrate:
rg -c "hsl\(190 100% 43%|hsl\(225 [0-9]+% [0-9]+%|#00F0F[0-9]" client/src/index.css
# Result informs the scope of Task 6.3 migration.
```

Document the Context7 answer + the literal count in a comment on this task. `advisor()` if the Context7 answer contradicts the pre-research finding.

- [ ] **Task 6.2 — Failing Playwright test**

```ts
test('theme toggle actually changes visuals (E2E-968/1037)', async ({ page }) => {
  await loginAsE2EUser(page);
  await page.goto('/');
  const bodyBgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByTestId('theme-toggle').click();
  await page.waitForTimeout(300);
  const bodyBgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBgLight).not.toBe(bodyBgDark);
});
```

Expected: FAIL — both values identical.

- [ ] **Task 6.3 — Apply the fix (from Task 6.1 findings)**

Likely fixes in descending probability:
1. `tailwind.config.ts` missing `darkMode: 'class'` → add it.
2. Root HSL CSS vars defined once in `:root` without `.light {}` override → define light-mode values in `.light { --background: ... }`.
3. `<html>` class is being re-set on every render → move into ThemeProvider context.

Commit root cause narration in the commit message — future maintainers will thank you.

- [ ] **Task 6.4 — Run Playwright + Vitest**

```
npx playwright test tests/e2e/p0-theme-toggle.spec.ts
npm test
```
Both: PASS.

- [ ] **Task 6.5 — Call `advisor()` before commit (final P0)**

After advisor sign-off:

```bash
git add ...
git commit -m "fix(theme): light-mode toggle now reacts (E2E-968, E2E-1037)

Root cause: <narrate from Task 6.1>. Playwright test asserts
computed background color differs between the two modes."
```

---

## Team Execution Checklist (must pass before this plan is marked done)

```
□ npm run check                       ← zero errors
□ npm test                            ← all tests green including new P0 tests
□ npx eslint .                        ← zero warnings
□ npx prettier --write .              ← no diff
□ Coverage table §Coverage verified   ← every claimed E2E-XXX appears in a commit message
□ Playwright e2e suites green         ← p0-audit-scope, p0-alternates-part-usage-render, p0-drc-*, p0-breadboard-*, p0-settings-route, p0-theme-toggle
□ No agent exceeded 6-concurrent cap  ← per project memory
□ File-ownership honored              ← no cross-owner edits
□ MASTER_BACKLOG.md updated           ← BL entries for any discovered followups (e.g. full settings catalog tracked under 17)
□ advisor() called ≥2× — after Task 1.5 and before Task 6.5
```

## Research log (fill in as work proceeds)

- Context7 `express@5.1` — "typed middleware that sets res.locals safely" → ...
- Context7 `drizzle-orm` — "and() + eq() composing WHERE clauses for user-scoped queries" → ...
- WebSearch — "Tailwind 4 class darkMode migration" → cite URL + quote
- Codebase grep — `server/index.ts:226` (global auth middleware), confirmed `isPublicApiPath` fast-path
- advisor() call 1 — date, summary
- advisor() call 2 — date, summary
