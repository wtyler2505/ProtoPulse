# Task Handoff #2 to Codex — BL-0875 source-code axe fixes (bulk mechanical)

**From:** Claude Code
**Date:** 2026-05-09
**Priority:** medium
**Coordination:** Tyler may have a separate Codex session on NLM. **This is NOT NLM work** — it's a11y source-code fixes in `client/src/components/views/*.tsx`. Stay clear of `data/pp-nlm/`, `scripts/pp-nlm/`, `.claude/skills/pp-knowledge/`, `.claude/skills/pp-nlm-operator/`, `docs/notebooklm.md`. Claude is concurrently working `server/collaboration.ts` + `shared/collaboration.ts` (BL-0879 CRDT) — do NOT touch those.

## Background

Previous Codex handoff verified BL-0876 (ECONNREFUSED → 0, 73/73 sentinel suite passing). Per CODEX_DONE.md from that run, BL-0875 a11y suite has 10 real axe-core violations across 9 views. These are SOURCE-CODE bugs (not test-setup bugs). Most are missing `aria-label` on icon-only buttons and missing `<label>` on inputs.

## Tasks

### Task 1 — Fix all 10 real axe violations

Per Codex-1's triage, the violations are:

| View | File | Violations |
|---|---|---|
| ComponentEditorView | `client/src/components/views/ComponentEditorView.tsx` | label |
| CalculatorsView | `client/src/components/views/CalculatorsView.tsx` | aria-prohibited-attr, aria-valid-attr-value, button-name |
| DesignPatternsView | `client/src/components/views/DesignPatternsView.tsx` | button-name |
| KanbanView | `client/src/components/views/KanbanView.tsx` | button-name |
| KnowledgeView | `client/src/components/views/KnowledgeView.tsx` | button-name |
| BoardViewer3DView | `client/src/components/views/BoardViewer3DView.tsx` | button-name, label |
| CommunityView | `client/src/components/views/CommunityView.tsx` | button-name |
| PcbOrderingView | `client/src/components/views/PcbOrderingView.tsx` | button-name |
| GenerativeDesignView | `client/src/components/views/GenerativeDesignView.tsx` | aria-prohibited-attr, label |
| AuditTrailView | `client/src/components/views/AuditTrailView.tsx` | button-name |

For each:

1. Read the source file.
2. Run `NODE_OPTIONS="--max-old-space-size=4096" npx vitest run client/src/__tests__/a11y.test.tsx -t "<ViewName>" 2>&1 | tee logs/tests-a11y-<view>-pretest.log` (background) to get the exact axe message + failing element selectors.
3. Apply the minimal fix per WCAG:
   - **button-name**: icon-only `<button>` needs `aria-label="<verb> <noun>"` (e.g., `aria-label="Close dialog"`). Don't invent random labels — read what the button does and label accordingly.
   - **label**: form inputs need an associated `<label htmlFor>` OR `aria-label`/`aria-labelledby`. Prefer real visible labels per WCAG 3.3.2 unless the existing UI is intentionally label-less.
   - **aria-prohibited-attr**: an ARIA attribute is on an element where it's not allowed. Remove it OR change the element role appropriately. Read https://www.w3.org/TR/wai-aria-1.2/#prohibitedattributes for the rule.
   - **aria-valid-attr-value**: the attribute value is invalid (e.g., `aria-controls="undefined"`). Fix the value source.
4. Re-run the targeted axe test to confirm 0 violations for that view.

### Task 2 — Verify final count

After all 10 are fixed:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run client/src/__tests__/a11y.test.tsx 2>&1 | tee logs/tests-a11y-bl0875-after.log
```

Count: `grep -c "violations:" logs/tests-a11y-bl0875-after.log`. Expected reduction: 10 → 0 for these specific rules.

### Task 3 — Update BL-0875 in MASTER_BACKLOG.md

Note that the 10 source-code axe violations are CLOSED, the 1 TooltipProvider test-harness wrapper for ArchitectureView remains, and the harness failures (DashboardView, Breadboard, Procurement, CircuitCodeView, ArduinoWorkbenchView, SchematicView) are still open as a separate test-harness sub-cluster.

If BL-0875 is reduced to ONLY test-harness failures (no source-code axe violations remaining), you may split it: keep BL-0875 for harness work, carve a new BL-0880 for "BL-0875 source-code axe fixes — DONE" as historical record.

## Constraints

- **Do NOT touch** `client/src/test-setup.ts` (Claude's BL-0876 fix landed there — leave it).
- **Do NOT touch** `server/collaboration.ts` or `shared/collaboration.ts` — Claude is concurrently fixing BL-0879 there.
- **Do NOT touch** any NLM territory paths (see top of file).
- **Do NOT** add visible labels that change the visible UI design unless the existing design is broken — prefer `aria-label` for icon-only controls per common WCAG practice. The goal is screen-reader access, not visual redesign.
- Each fix should be the SMALLEST change that satisfies axe. Don't refactor surrounding code.
- Commit per view OR one commit at the end with clear message — your call.

## Output: write `CODEX_DONE.md` with this exact shape

```markdown
STATUS: [done|partial|blocked]
TASKS_COMPLETED: [1, 2, 3 or subset]

BL-0875 source-code axe fix:
- Views fixed: <count> / 10
- Per-view changes summary:
  - ComponentEditorView: <description of what was added/changed>
  - CalculatorsView: <description>
  - ... (one line per view)
- a11y suite axe-violation count before: 10
- a11y suite axe-violation count after: <count>
- Remaining failures in a11y suite (non-axe): <list>

MASTER_BACKLOG.md updates:
- BL-0875: <new status / new note>
- BL-0880 (if created): <description>

BLOCKERS: <any unexpected issues>
NEXT_STEPS: <what's still pending>
```

## Success criteria

- [ ] All 10 source-code axe violations resolved
- [ ] a11y test suite shows reduced axe-violation count
- [ ] BL-0875 row in MASTER_BACKLOG.md updated (or split with BL-0880)
- [ ] CODEX_DONE.md written with structured output
- [ ] No untouched files in claimed-out territory (test-setup.ts, collaboration.ts, NLM paths)
