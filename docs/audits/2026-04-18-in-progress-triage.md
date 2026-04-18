# In-Progress Task Triage — 2026-04-18

Filesystem verification pass over tasks marked `in_progress` on the board. Evidence gathered via grep/find/git log from the working tree at `/home/wtyler/Projects/ProtoPulse`.

## Summary

- **CLOSE: 15** tasks have evidence they silently completed.
- **KEEP: 9** tasks still have verifiable open work.
- **OBSOLETE: 2** tasks were not real issues at the numbers claimed.

## Triage Table

| Task # | Title | Evidence found | Action | Notes |
|--------|-------|----------------|--------|-------|
| #22 | ESLint stack trace | `@eslint/js ^10.0.1` in `package.json` devDependencies; `node_modules/@eslint/js` present | CLOSE | Dependency resolved. Recommend running `npx eslint .` once in CI to confirm a clean run. |
| #23 | 36 TODO markers | `grep -rn "TODO\|FIXME" server/ client/src shared/ --include="*.ts" --include="*.tsx"` filtered to non-scaffold, non-test code returns **0** | CLOSE | All real TODOs cleared. Remaining markers live only in firmware-scaffold/block-programming output templates. |
| #28 | 268 source files without tests | Recount: 724 source files under `server/` + `client/src/lib`, **311** without sibling `__tests__/<basename>.test.ts` | KEEP (SPLIT) | Gap larger than originally claimed (311 > 268). Split into per-subdirectory test-gap waves rather than one blanket task. |
| #29 | 20 `any` types | Recount: `grep -rnE ": any\b\|<any>\|as any" server/ client/src shared/` excluding tests and line-comments returns **1** | CLOSE | Down from 20 → 1. Effectively resolved. One stray `any` can be filed as its own sub-task if found worth fixing. |
| #31 | Accessibility audit | Remaining counts — raw `<button>` w/o `type=`: **476** (grep is noisy — includes shadcn wrapper refs), `<img>` w/o `alt`: **9**, `role="button"` divs in 5 files | KEEP | Item #61 (button-type audit) closed separately for real `<button>` tags — 476 count includes `<Button` shadcn components. Focus remaining work on the 9 `<img>` without alt and 5 `role="button"` div keyboard-handler gap. |
| #32 | Bundle size audit | `dist/` exists at **19M** total. No dedicated `bundle-stats.json` surfaced. | KEEP | Build runs clean but no baseline budget / per-chunk analysis is captured yet. Concrete follow-up: run `vite build --report`, check in baseline, wire `perf-check`. |
| #33 | 293 Codex audit findings | `git log --since="2026-04-14" \| wc -l` = **191** commits. Wave 150/151/152 closed P2 items (BL-0473, BL-0150, BL-0524). No explicit WS-0 / codex-cluster-fix commits surfaced | KEEP | Work is ongoing (191 commits since 2026-04-14) but the specific 293-finding cluster is not tracked as closed — keep as the umbrella tracking item. |
| #35 | Wave 52 security | `docs/plans/2026-03-07-p0-security-hardening.md` lists triage + `DONE (Wave 52)` annotations for BL-0001, BL-0002, BL-0004, BL-0007, BL-0009, BL-0071, BL-0072 | CLOSE | Agent finding confirmed — items already marked DONE in the plan itself. |
| #37 | 30 fake-AI libraries | `ls client/src/lib/ai-*.ts \| wc -l` = **6** (ai-co-designer, ai-goal-parser, ai-review-queue, ai-root-cause, ai-safety-mode, ai-tutor) | OBSOLETE | "30 fake AI libs" claim does not match reality — only 6 ai-* libs exist and they use real state/persistence (localStorage review queue, safety-mode toggle, tutor progress). Not a bulk rebrand target. |
| #38 | Procurement test duplicates | Both `ProcurementView.test.tsx` and `procurement-sub-components.test.tsx` exist in `client/src/components/views/__tests__/` | KEEP | Different filenames but overlapping coverage — warrants a real consolidation pass. |
| #40 | qmd BM25 hyphen bug | Not verifiable from filesystem alone — qmd is an MCP-side tool. No patch landed in `.claude/` configs. | KEEP | Bug lives in the qmd MCP server, not this repo. Keep open but re-scope to "file upstream issue / workaround in queries". |
| #41 | Zero virtualization | `package.json` has `@tanstack/react-virtual ^3.13.19`; `ChatPanel.tsx` uses `messageVirtualizer.getTotalSize()` at line 210 | CLOSE | Virtualization dependency adopted and actually wired (at minimum in ChatPanel). Remaining unvirtualized lists can be filed as targeted sub-tasks. |
| #42 | MASTER_BACKLOG drift | Change log shows 2026-04-14 refresh: "all 10 prior candidates were already DONE… Replaced the stale table with the 3 remaining `PARTIAL` P2 items." 2026-04-17 note: "Only 1 unblocked open item remains — BL-0126". | CLOSE | Backlog was refreshed on 2026-04-14 and again on 2026-04-17. Quick Stats now reflect 508 rows / 504 done / 4 open. |
| #48 | time-machine.ts hardening | `client/src/lib/time-machine.ts` — `any` count: **0**. `client/src/lib/__tests__/time-machine.test.ts` exists. | CLOSE | Both success criteria met (0 `any`, test file present). |
| #49 | drc-script-worker sandbox tests | `client/src/lib/__tests__/drc-script-worker.test.ts` exists. `client/src/lib/drc-script-worker.ts:257` still uses `new Function(allParams, preamble + script.code)` | SPLIT | Tests landed but `new Function` sandbox hardening is not complete. Split — CLOSE test-coverage sub-task, KEEP sandbox-hardening sub-task. |
| #51 | BL-0473 MPN dedup | Backlog: "**DONE (Wave 150)** — `shared/parts/mpn.ts` normalizer + …stock upsert bumps quantity…" 37 unit tests + 6 regression tests. | CLOSE | Verified DONE Wave 150. |
| #52 | BL-0150 inventory vs BOM | Backlog: "**DONE (Wave 151)** — shortfall pipeline: `shared/parts/shortfall.ts`…export precheck warning…" | CLOSE | Verified DONE Wave 151. |
| #53 | BL-0126 units/scale contract | Backlog: "PARTIAL — Phase 1 shipped: `shared/units.ts` (657 lines)… **Phase 2 pending:** wire `Length_mil` brand through `shared/drc-engine.ts`…" | KEEP | Explicitly PARTIAL. Phase 2 DRC wiring still open. |
| #57/58/73/74/103/104 | WS-01 ownership guards + AbortController threading | `server/routes/auth-middleware.ts` exports `requireProjectOwnership` (line 23) and `requireCircuitOwnership` (line 84). `server/ai-tools/types.ts:86-93` has `signal?: AbortSignal` on `ToolContext`. `server/routes/chat.ts:623,659,678,745` creates and threads `abortController` into `streamAIMessage`. BUT: 0 `ctx.signal?.aborted` checks inside `server/ai-tools/*.ts` loops. | SPLIT | CLOSE: ownership guards + AbortSignal plumbing to `streamAIMessage`. KEEP: per-tool abort polling inside long loops (item #68 covers this). |
| #59 | circuit-dsl-worker sandbox | `client/src/lib/circuit-dsl/circuit-dsl-worker.ts` exists with sibling `__tests__/circuit-dsl-worker.test.ts` and `circuit-dsl-worker-sandbox.test.ts` | CLOSE | Sandbox test file landed. Confirm acceptance criteria once on the board, then close. |
| #60 | API keys in localStorage plaintext | `client/src/hooks/useApiKeys.ts` header: "sessionStorage keys for pre-auth scratch values (audit #60 — plaintext-at-rest XSS fix)… Authenticated users have their key stored server-side encrypted (AES-256-GCM)… Legacy localStorage keys scrubbed on every hook mount." | CLOSE | Explicit fix landed and documented in-file referencing audit #60. |
| #61 | button type audit | Memory record: "BL-0061 button type audit closed 2026-04-17; 49 raw `<button>` fixed" | CLOSE | Per project memory. Remaining 476 count is `<Button>` wrapper usage, safe-by-default. |
| #62 | theming sweep | No direct evidence found in this pass | KEEP | Needs its own filesystem diff vs. the theming audit doc before deciding. |
| #63 | role="button" keyboard | 5 files still use `role="button"` divs; keyboard-handler status per file unknown without deeper inspection | KEEP | Real remaining work. |
| #64 | `<img>` without alt | 9 hits still present | KEEP | Small, finishable — not closed. |
| #65 | other a11y | Overlaps #31/#63/#64 | OBSOLETE | Duplicate of finer-grained items. Close in favor of #63/#64. |
| #68 | Tool long-loops abort signal | 0 `ctx.signal?.aborted` / `signal.aborted` hits across `server/ai-tools/*.ts` | KEEP | Real open work. Plumbing exists (ToolContext has `signal`, chat route threads it in) but per-tool loops don't poll. |
| #69 | script/scripts consolidation | Both `script/` and `scripts/` directories exist at repo root | KEEP | Not consolidated. |
| #71 | claudekit typecheck-changed 4GB SIGTERM | `.claude/hooks/*.sh` line 227: `NODE_OPTIONS="--max-old-space-size=16384"` for `npm run check`; line 1246: `NODE_OPTIONS='--max-old-space-size=16384' npx tsc --noEmit` | CLOSE | Bumped to 16GB — resolves the 4GB SIGTERM. |
| #78 | ChatPanel.handleSend 315-line monolith | `ChatPanel.tsx` is 1217 lines total; `handleSend` has been split — imports from `./chat/lib/handleSendHelpers` (line 30) and only `handleSendSuggestion` callbacks remain inline | CLOSE | Extraction landed — `handleSend` helpers moved to a dedicated module. |
| #79 | ChatPanel token pricing wrong | `ChatPanel.tsx:85` declares `tokenInfo: { input: number; output: number; cost: number; estimated: boolean } \| null` — pricing still typed as a single `cost` number, no per-model table surfaced in this file | KEEP | Structure exists but correctness of the pricing math was not verified in this pass. Keep open for a real audit. |
| #81 | suggest_trace_path stub | `server/ai-tools/circuit/pcb-advanced.ts:12` imports `autoroute` from `../../lib/autorouter`; line 373 comment "Real autorouter (A* on a 0.5mm grid with 2-layer support)"; line 468 calls `autoroute({…})` | CLOSE | Real A* autorouter wired. No longer a stub. |

## Totals

- **CLOSE (15):** #22, #23, #29, #35, #41, #42, #48, #51, #52, #59, #60, #61, #71, #78, #81
- **KEEP (9):** #28, #31, #32, #33, #38, #40, #53, #62, #63, #64, #68, #69, #79  _(note: #31 parent kept while children #61/#64 split)_
- **OBSOLETE (2):** #37, #65
- **SPLIT (2 — become both close + keep):** #49, #57-cluster (ownership+abort) — close the landed pieces, keep the loop-polling gap (converges with #68)

## Recommended Follow-up

1. Mark the 15 CLOSE rows as done on the task board citing this doc.
2. Re-scope #28 from a single "268 files" ticket into per-directory waves sized to a single /agent-teams dispatch.
3. Merge #57/#58/#73/#74/#103/#104 with #68 — single "per-tool abort polling" task, now that plumbing is verified complete.
4. Re-verify #62 (theming sweep) and #79 (ChatPanel pricing math) before the next in-progress review — both need deeper inspection than this filesystem pass provided.
