# Task Handoff to Codex — Verify BL-0876 staged fix + triage BL-0875

**From:** Claude Code (session at 14MB context — needs to wind down)
**Date:** 2026-05-09
**Priority:** medium
**Coordination note:** Tyler also has Codex working on NLM-related files (`data/pp-nlm/`, `scripts/pp-nlm/`, `.claude/skills/pp-knowledge/`, `.claude/skills/pp-nlm-operator/`, `docs/notebooklm.md`). **This handoff is NOT NLM work** — it's test verification on `client/src/test-setup.ts` + a11y/lifecycle/procurement test suites. If you (Codex) are already busy on NLM, queue this; if there's no conflict, proceed.

## Background

This session closed 8 BL items in the BL-0866 family (test-suite drift cluster):
- BL-0865, BL-0872, BL-0873, BL-0874, BL-0877 → DONE
- BL-0866 → SPLIT into 7 children
- BL-0878 → DONE 6/7
- BL-0879 → diagnosed as architectural (CRDT LWW server-side monotonic Lamport bug)
- **BL-0876 → STAGED** ← this is what needs verification

## What was just changed (uncommitted as of handoff write — auto-commit hook will pick it up)

`client/src/test-setup.ts` got a global `fetch` stub:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response('null', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
```

Hypothesis: Components using `useQuery` (TanStack Query) trigger real `fetch` calls during a11y rendering. Without a dev server on :3000, those produce `ECONNREFUSED` noise. The stub returns 404 JSON `null` so `useQuery` resolves cleanly to "no data" instead of TCP-failing.

**Source for the pattern:** vitest 3.x docs on `vi.stubGlobal` (https://vitest.dev/api/vi.html#vi-stubglobal). 3.x is current as of May 2026 per package.json.

## Tasks

### Task 1 — Verify BL-0876 staged fix

Run, in this order, with `run_in_background: true` and `NODE_OPTIONS="--max-old-space-size=4096"`:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run \
  client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx \
  client/src/lib/__tests__/lifecycle-badges-integration.test.ts \
  client/src/components/views/__tests__/procurement-sub-components.test.tsx \
  2>&1 | tee logs/tests-bl0876-verify-pretest.log
```

Expected if the fix is correct: 0 ECONNREFUSED, all tests pass (10/10 + ~40+ + 2/2). The 3 files we already migrated to QueryClientProvider wrappers should still pass. The new global stub layer should be additive, not breaking.

### Task 2 — Run a11y suite, count ECONNREFUSED before/after

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run \
  client/src/__tests__/a11y.test.tsx \
  2>&1 | tee logs/tests-a11y-bl0876-after.log
```

After it completes:
- `grep -c "ECONNREFUSED" logs/tests-a11y-bl0876-after.log` → should be 0
- `grep -c "ECONNREFUSED" logs/tests-a11y-latest.log` → previous run, was non-zero
- Note pass/fail counts

### Task 3 — Triage remaining BL-0875 a11y violations

After Task 2, parse `logs/tests-a11y-bl0876-after.log` for the failing tests. The previous breakdown was 3 distinct failure modes:
- (a) `Tooltip must be used within TooltipProvider` — test-setup wrapper issue
- (b) `ECONNREFUSED 127.0.0.1:3000` — should be GONE after Task 1's fix
- (c) Real axe-core violations (button-name, label, aria-valid-attr-value, aria-prohibited-attr) in CalculatorsView, DesignPatternsView, KanbanView, KnowledgeView, BoardViewer3DView, CommunityView, etc.

For each remaining failure, classify (a/b/c) in a new section appended to `docs/MASTER_BACKLOG.md` under BL-0875 as a 2026-05-09 update.

### Task 4 — Update BL-0876 status in MASTER_BACKLOG.md

If Tasks 1+2 show 0 ECONNREFUSED and no test regressions: change BL-0876 status from `STAGED` to `DONE` and add the verification note (test count, log path, ECONNREFUSED before/after).

If the global fetch stub caused regressions in tests that DO need real fetch behavior: revert the test-setup.ts change, mark BL-0876 as `BLOCKED — global stub regresses tests X/Y, needs per-test mock strategy instead`, and document which tests need real fetch.

## Output: write `CODEX_DONE.md` with this exact shape

```markdown
STATUS: [done|partial|blocked]
TASKS_COMPLETED: [1, 2, 3, 4 or subset]

BL-0876 verification:
- ECONNREFUSED before: <count>
- ECONNREFUSED after: <count>
- Tests passing in BL-0876 sentinel suite (Task 1): <X>/<Y>
- Decision: <DONE | reverted | other>

BL-0875 triage (counts):
- Mode (a) TooltipProvider: <count> tests, list: [...]
- Mode (b) ECONNREFUSED: <count>
- Mode (c) real axe violations: <count> tests, list: [view: violation]

MASTER_BACKLOG.md updates:
- BL-0876: <new status>
- BL-0875: <updated diagnostic>

BLOCKERS: <any unexpected failures or env issues>
NEXT_STEPS: <what's still pending after this handoff>
```

## Constraints

- Do NOT touch any of these (Tyler's other Codex session may be working there): `data/pp-nlm/`, `scripts/pp-nlm/`, `.claude/skills/pp-knowledge/`, `.claude/skills/pp-nlm-operator/`, `docs/notebooklm.md`, NLM source manifests under `~/.claude/state/pp-nlm/`.
- Do NOT skip-fix individual axe violations in this run — that's BL-0875's separate triage scope.
- Do NOT alter the test-setup.ts fix unless verification shows regressions.
- Stay within the BL-0866 child cluster scope.

## Success criteria

- [ ] Task 1 sentinel suite runs cleanly with the staged fix (no regression)
- [ ] ECONNREFUSED count in a11y log drops to 0
- [ ] BL-0876 row in MASTER_BACKLOG.md is updated (DONE or BLOCKED with concrete reason)
- [ ] BL-0875 row gets a 2026-05-09 triage update with per-mode counts
- [ ] CODEX_DONE.md written with structured output
