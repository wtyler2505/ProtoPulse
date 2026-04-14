# Proactive Improvement Audit — 2026-04-14

Scope: ProtoPulse (`/home/wtyler/Projects/ProtoPulse`) — React/Vite + Express EDA platform.
Goal: Overwhelm Tyler with concrete, pickable improvement opportunities. No curation, no filtering. Volume over precision.

## Methodology

Parallel scans across `client/src`, `server/`, `shared/`, `docs/` for:
TODO/FIXME/HACK/XXX comments, console.* calls, files > 500 LOC, test gaps, deprecated import paths,
stale docs, missing error boundaries, perf smells, a11y gaps, security quick-checks, duplicate code,
TS strictness escapes, bundle-size suspects, "broken/workaround/hack" language, git hygiene.

## Headline Aggregates

| Signal | Count |
|---|---|
| Files in `client/src` using `console.*` | 28 |
| Files in `server/` using `console.*` | 2 (still likely a miss — check logger.ts usage) |
| TS files with `any` / `@ts-ignore` / `eslint-disable` | 86 occurrences / 59 files |
| `eslint-disable` lines found (including react-hooks/exhaustive-deps silencing) | 40+ |
| `@ts-expect-error` lines | 3 (all in tests, legitimate) |
| Client TS/TSX files > 1000 lines | 60+ |
| Server TS files > 500 lines | 29 |
| `client/src/lib/*.ts` modules with NO matching `__tests__/*.test.ts` | 17 |
| `.map(...=> <...)` inline JSX (render-perf smell candidates) | 50 files, 161 occurrences |
| `React.lazy` / `Suspense` usage | 13 files (good, but 13 is few relative to surface) |
| `react-window` / `react-virtualized` / `Virtuoso` usage | **ZERO — no virtualization anywhere** |
| Inline `onClick={() => ...}` in JSX | ≈230 (many are inside `.map` = re-render risk) |
| Stale docs (>30 days old) in `docs/` | 451 files — 21 mention WIP / TODO / future work |
| `eval(` / `new Function(` in client code | 3 files (DRC worker, circuit-dsl worker, drc-scripting) — documented but sandbox them |
| `dangerouslySetInnerHTML` | 2 (chart.tsx, StorageManagerPanel) |
| Git working tree | CLEAN, 0 uncommitted — 2440 commits in repo, on `parts-consolidation` branch |

## The Overwhelming Table

Legend — Effort: XS (<15m) · S (<1h) · M (1–3h) · L (3h+) · Priority: 🔴P0 · 🟠P1 · 🟡P2 · 🟢P3

| # | Category | File/Location | Issue | Suggested Fix | Effort | Priority |
|---|---|---|---|---|---|---|
| 1 | File size | `client/src/components/circuit-editor/BreadboardView.tsx` | 2,284 lines — Tyler's standard is <500 | Split into sub-components: `BreadboardCanvas`, `BreadboardToolbar`, `BreadboardOverlays`, `useBreadboardState` hook | L | 🟠P1 |
| 2 | File size | `client/src/lib/arduino/code-simulator.ts` | 1,563 lines | Extract opcode handlers + tests; split into `simulator-core`, `simulator-opcodes`, `simulator-io` | L | 🟠P1 |
| 3 | File size | `client/src/lib/ai-prediction-engine.ts` | 1,554 lines | Split prediction strategies into adapters (strategy pattern) | L | 🟠P1 |
| 4 | File size | `shared/drc-engine.ts` | 1,519 lines | Break rule classes into `shared/drc/rules/*.ts` with barrel | L | 🟠P1 |
| 5 | File size | `server/ai-tools/circuit.ts` | 1,502 lines | Split AI-tool handlers by concern (circuit-read, circuit-mutate, circuit-analyze) | L | 🟠P1 |
| 6 | File size | `server/ai.ts` | 1,412 lines | Extract prompt assembly, model routing, streaming logic into modules | L | 🟠P1 |
| 7 | File size | `client/src/components/simulation/WaveformViewer.tsx` | 1,453 lines | Split canvas renderer, axis/grid, tooltip overlay, controls | L | 🟠P1 |
| 8 | File size | `client/src/lib/lcsc-part-mapper.ts` | 1,439 lines | Separate category mappers into `lib/lcsc/mappers/*.ts` | M | 🟡P2 |
| 9 | File size | `server/export/kicad-exporter.ts` | 1,424 lines | Extract per-file-format writers (sch, pcb, kicad_pro) | L | 🟡P2 |
| 10 | File size | `client/src/lib/tutorial-system.ts` | 1,425 lines | Decouple step registry from runtime | M | 🟡P2 |
| 11 | File size | `client/src/components/panels/SerialMonitorPanel.tsx` | 1,398 lines | Extract `SerialTerminal`, `SerialControls`, `useSerialSession` | L | 🟠P1 |
| 12 | File size | `client/src/components/views/ComponentEditorView.tsx` | 1,261 lines | 14 instances of `: any` — refactor alongside size split | L | 🟠P1 |
| 13 | File size | `client/src/components/views/ArchitectureView.tsx` | 1,202 lines | Split graph renderer from inspector panel | M | 🟡P2 |
| 14 | File size | `client/src/components/circuit-editor/PCBLayoutView.tsx` | 1,282 lines | Split canvas / toolbar / status / keyboard-shortcut host | L | 🟠P1 |
| 15 | File size | `client/src/components/panels/ChatPanel.tsx` | 1,274 lines | Already has `panels/chat/*` subdir — migrate the rest into hooks/components | M | 🟠P1 |
| 16 | File size | `client/src/lib/self-healing.ts` | 1,412 lines | Extract heuristics per subsystem | M | 🟡P2 |
| 17 | File size | `client/src/lib/supplier-api.ts` | 1,413 lines | 18 hardcoded URLs — factor out to `lib/supplier/adapters/*.ts` with config | M | 🟠P1 |
| 18 | File size | `client/src/lib/assembly-cost-estimator.ts` | 1,363 lines | Split cost models per process + pricing curves | M | 🟡P2 |
| 19 | File size | `client/src/lib/copper-pour.ts` | 1,354 lines | Extract polygon operations into `lib/pcb/polygon/*` | L | 🟡P2 |
| 20 | File size | `client/src/lib/pcb/pcb-drc-checker.ts` | 1,324 lines | Split rule implementations into `pcb/drc/rules/*` | L | 🟡P2 |
| 21 | File size | `client/src/lib/web-serial.ts` | 1,312 lines | Split transport, framing, device detection | M | 🟡P2 |
| 22 | File size | `client/src/lib/architecture-analyzer.ts` | 1,271 lines | Extract graph-walk visitors into their own files | M | 🟡P2 |
| 23 | File size | `client/src/lib/community-library.ts` | 1,254 lines | Split API client from cache/indexer | M | 🟢P3 |
| 24 | File size | `client/src/lib/pcb/webgl-viewer.ts` | 1,298 lines | Split shader, buffer manager, camera controller | M | 🟡P2 |
| 25 | File size | `client/src/lib/proactive-healing.ts` | 1,295 lines | Extract detector vs. remediator per concern | M | 🟡P2 |
| 26 | File size | `client/src/lib/alternate-parts.ts` | 1,263 lines | Split scoring pipeline into stages with tests per stage | M | 🟡P2 |
| 27 | Test gap | `client/src/lib/accessibility-audit-dashboard.ts` | No `__tests__/accessibility-audit-dashboard.test.ts` | Add unit tests | M | 🟠P1 |
| 28 | Test gap | `client/src/lib/clipboard.ts` | No tests | Add tests (stub `navigator.clipboard`) | S | 🟠P1 |
| 29 | Test gap | `client/src/lib/csv.ts` | No tests — CSV round-trip is a common regression source | Add parse/serialize round-trip tests incl. quoted commas + newlines | S | 🔴P0 |
| 30 | Test gap | `client/src/lib/drc-script-worker.ts` | `new Function()` sandbox with no tests | Add sandbox-escape negative tests | M | 🔴P0 |
| 31 | Test gap | `client/src/lib/error-messages.ts` | No tests | Snapshot each message formatter | S | 🟢P3 |
| 32 | Test gap | `client/src/lib/project-navigation-state.ts` | No tests | Add state-machine tests | S | 🟡P2 |
| 33 | Test gap | `client/src/lib/project-picker-visibility.ts` | No tests | Add tests | S | 🟢P3 |
| 34 | Test gap | `client/src/lib/queryClient.ts` | No tests for TanStack client config | Verify default options via tests | S | 🟡P2 |
| 35 | Test gap | `client/src/lib/query-keys.ts` | No tests — central key registry is a cache-invalidation risk | Add stability tests (ensure keys don't drift between refactors) | XS | 🟠P1 |
| 36 | Test gap | `client/src/lib/starter-circuit-launch.ts` | No tests | Add tests | S | 🟢P3 |
| 37 | Test gap | `client/src/lib/stream-resilience.ts` | No tests for streaming retry logic | Add flake-hardening tests | M | 🟠P1 |
| 38 | Test gap | `client/src/lib/svg-sanitize.ts` | No tests — sanitizer for user-uploaded SVG (used by `StorageManagerPanel` via `dangerouslySetInnerHTML`) | **HIGH-PRIORITY security test** — add XSS payload tests | M | 🔴P0 |
| 39 | Test gap | `client/src/lib/tauri-api.ts` | No tests | Add mocked Tauri command tests | S | 🟡P2 |
| 40 | Test gap | `client/src/lib/tutorials.ts` | No tests | Add tests for step-traversal logic | S | 🟡P2 |
| 41 | Test gap | `client/src/lib/types.ts` | Type-only file — no tests expected, but ensure it's only types (no runtime code) | Audit content; if runtime logic leaked in, extract | XS | 🟢P3 |
| 42 | Test gap | `client/src/lib/undo-redo-commands.ts` | No tests for command pattern | Add forward/reverse invariant tests for each command | M | 🟠P1 |
| 43 | Test gap | `client/src/lib/use-canvas-announcer.ts` | No tests | Add a11y announcer tests | S | 🟡P2 |
| 44 | Console usage | `client/src/components/views/ProcurementView.tsx` | `console.*` in production code path | Replace with logger wrapper (create `client/src/lib/logger.ts` if absent) | S | 🟡P2 |
| 45 | Console usage | `client/src/components/circuit-editor/BreadboardView.tsx` | `console.*` calls | Replace with logger; guard with `import.meta.env.DEV` | S | 🟡P2 |
| 46 | Console usage | `client/src/components/panels/ChatPanel.tsx` | `console.*` | Logger refactor | S | 🟡P2 |
| 47 | Console usage | `client/src/components/panels/SerialMonitorPanel.tsx` | `console.*` | Logger refactor — note: serial monitor legitimately logs, double-check each call | S | 🟡P2 |
| 48 | Console usage | `client/src/components/circuit-editor/PCBLayoutView.tsx` | `console.*` | Logger refactor | S | 🟡P2 |
| 49 | Console usage | `client/src/lib/ai-prediction-engine.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 50 | Console usage | `client/src/lib/arduino/serial-logger.ts` | Uses `console.*` — but this IS a logger; just verify it respects env-driven log level | Verify env flag respected | S | 🟢P3 |
| 51 | Console usage | `client/src/lib/back-annotation.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 52 | Console usage | `client/src/lib/damage-assessment.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 53 | Console usage | `client/src/lib/library-conflict-detector.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 54 | Console usage | `client/src/lib/voice-ai.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 55 | Console usage | `client/src/lib/ci-coverage-gates.ts` | `console.*` | Logger refactor | S | 🟢P3 |
| 56 | Console usage | `client/src/lib/inventory-health.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 57 | Console usage | `client/src/lib/barcode-scanner.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 58 | Console usage | `client/src/lib/clipboard.ts` | `console.*` | Logger refactor | S | 🟢P3 |
| 59 | Console usage | `client/src/lib/cost-optimizer.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 60 | Console usage | `client/src/lib/sketch-secrets-scanner.ts` | `console.*` | Logger refactor — ironic given its purpose | S | 🟡P2 |
| 61 | Console usage | `client/src/lib/ram-usage-monitor.ts` | `console.*` | Logger refactor | S | 🟡P2 |
| 62 | Console usage | `server/collaboration.ts` | Server `console.*` — should be `logger.ts` | Replace with `logger.info/warn/error` | S | 🟠P1 |
| 63 | Console usage | `server/auth.ts` | Server `console.*` in auth module is a **security audit hazard** (may leak tokens / session IDs) | Audit every call; scrub sensitive fields; route through structured logger | M | 🔴P0 |
| 64 | `eval` / `new Function` | `client/src/lib/drc-script-worker.ts:218` | `new Function(allParams, preamble + script.code)` — user-controlled DRC script | Confirm sandbox isolation in Worker; add CSP policy tests; doc the threat model | L | 🟠P1 |
| 65 | `eval` / `new Function` | `client/src/lib/circuit-dsl/circuit-dsl-worker.ts:281` | `new Function(...)` — circuit DSL evaluator | Same sandbox review as #64 | L | 🟠P1 |
| 66 | `eval` / `new Function` | `client/src/lib/drc-scripting.ts:147` | `new Function(code)` for syntax validation | Replace with AST parse (acorn) — safer than `new Function` even if just for validation | M | 🟠P1 |
| 67 | XSS risk | `client/src/components/views/StorageManagerPanel.tsx:732` | `dangerouslySetInnerHTML={{ __html: sanitizeSvg(previewSvg) }}` | Add fuzz tests for `sanitizeSvg`; consider `DOMPurify` hardening profile | M | 🔴P0 |
| 68 | XSS risk | `client/src/components/ui/chart.tsx:81` | `dangerouslySetInnerHTML` in chart component | Verify content is only CSS or static config, never user data | S | 🟡P2 |
| 69 | TODO in code | `client/src/lib/arduino/block-programming.ts:202` | "Add a code comment" placeholder text "TODO" | Replace the default placeholder with localized string | XS | 🟢P3 |
| 70 | TODO in code | `client/src/lib/arduino/firmware-testing.ts:866` | `// TODO: set test input` — generated scaffold | Document that these are intentional scaffold placeholders | XS | 🟢P3 |
| 71 | TODO in code | `client/src/lib/arduino/firmware-testing.ts:883` | `// TODO: verify side effects` in generated code | Same as #70 | XS | 🟢P3 |
| 72 | TODO in code | `client/src/lib/arduino/esp-idf-support.ts:722` | `// TODO: Add your application logic here` in scaffold | Same as #70 | XS | 🟢P3 |
| 73 | TODO in code | `server/export/firmware-scaffold-generator.ts` | 24+ TODO markers in generated firmware scaffolds | These are intentional user-facing hints — add a note at top of generator documenting this decision | XS | 🟢P3 |
| 74 | `: any` density | `client/src/components/views/ComponentEditorView.tsx` | 14 instances of `: any` | Pick a session; type them one by one (Zod schemas where possible) | M | 🟠P1 |
| 75 | `: any` density | `client/src/lib/manufacturing/yield-estimator.ts` | 22 instances of `: any` | Type with Zod or proper interfaces | M | 🟠P1 |
| 76 | `: any` density | `client/src/lib/time-machine.ts` | 12 `: any` | Type undo/redo payloads | M | 🟡P2 |
| 77 | `: any` density | `client/src/lib/scriptable-commands.ts` | 11 `: any` | Type command payloads | M | 🟡P2 |
| 78 | `: any` density | `client/src/lib/state-illustrations.ts` | 7 `: any` | Type SVG element map | S | 🟢P3 |
| 79 | `: any` density | `client/src/lib/damage-assessment.ts` | 7 `: any` | Type damage reports | S | 🟡P2 |
| 80 | `eslint-disable` | `client/src/lib/role-presets.ts` (lines 387/393/399) | 3 instances of `react-hooks/exhaustive-deps` silencing | Extract stable refs; memoize callbacks properly | S | 🟡P2 |
| 81 | `eslint-disable` | `client/src/components/circuit-editor/BreadboardView.tsx:890` | `react-hooks/exhaustive-deps` silenced | Memoize or split effect | S | 🟡P2 |
| 82 | `eslint-disable` | `client/src/components/panels/SerialMonitorPanel.tsx:491` | exhaustive-deps silenced | Memoize | S | 🟡P2 |
| 83 | `eslint-disable` | `client/src/components/panels/ChatPanel.tsx:517` | Entire file disables `no-explicit-any` for Web Speech API | Extract the Web Speech code into its own file with the disable scoped to ONLY that file | S | 🟡P2 |
| 84 | `eslint-disable` | `client/src/lib/drc-scripting.ts:146` | `no-implied-eval` | Replace `new Function` with AST parse (see #66) | M | 🟠P1 |
| 85 | `eslint-disable` | `client/src/lib/progressive-render.ts:189` | exhaustive-deps silenced | Fix hook deps | S | 🟡P2 |
| 86 | `eslint-disable` | `client/src/components/views/circuit-code/CodeEditor.tsx:196` | exhaustive-deps silenced | Fix hook deps | S | 🟡P2 |
| 87 | `eslint-disable` | `client/src/lib/gesture-shortcuts.ts:551` | exhaustive-deps silenced | Fix hook deps | S | 🟡P2 |
| 88 | `eslint-disable` | `client/src/lib/beginner-mode.ts:204` | exhaustive-deps silenced | Fix hook deps | S | 🟡P2 |
| 89 | `eslint-disable` | `client/src/components/circuit-editor/RatsnestFilterPanel.tsx:73` | exhaustive-deps silenced | Fix hook deps | S | 🟡P2 |
| 90 | `eslint-disable` | `client/src/components/circuit-editor/PartFamilySwapPanel.tsx:66/84` | 2 exhaustive-deps silenced | Fix hook deps | S | 🟡P2 |
| 91 | `eslint-disable` | `client/src/components/circuit-editor/ViolationFocusOverlay.tsx:79` | exhaustive-deps silenced | Fix hook deps | S | 🟡P2 |
| 92 | `eslint-disable` | `client/src/lib/arduino-ide-launcher.ts:409` | exhaustive-deps silenced in hook | Fix hook deps | S | 🟡P2 |
| 93 | `eslint-disable` | `client/src/components/simulation/SensorSliderPanel.tsx:219` | exhaustive-deps silenced | Fix hook deps | S | 🟡P2 |
| 94 | Perf smell | All 50 files with `.map(...=> <...>` in JSX | 161 inline-JSX occurrences — combined with inline `onClick` creates new function per render → child re-renders | Triage: audit the heaviest views (BreadboardView, PCBLayoutView, ProcurementView), extract `useCallback` handlers and key-stable items | L | 🟡P2 |
| 95 | Perf — no virtualization | Entire app — ZERO occurrences of `react-window` / `react-virtualized` / `Virtuoso` / `FixedSizeList` | Long lists (parts library, BOM tables, activity feed, DRC violations, chat messages, component library) degrade at scale | Pick top-5 longest lists; add `react-window` or `@tanstack/react-virtual`. BL-item worthy | L | 🟠P1 |
| 96 | Perf — BreadboardView memo density | `BreadboardView.tsx` | Only 55 `useMemo`/`useCallback`/`memo` across 2284 lines — likely under-memoized for the largest component in the app | Profile with React DevTools; add memoization around expensive canvas renderers | M | 🟠P1 |
| 97 | Bundle size | `client/src/pages/workspace/lazy-imports.ts` | 56 `React.lazy` calls — good! But verify each chunk's actual size | Run `npm run build -- --mode production` + `rollup-plugin-visualizer`; find oversized chunks | M | 🟠P1 |
| 98 | Bundle size | Only 13 files use `Suspense`/`React.lazy` | Many heavy views (3D viewers, WebGL, Three.js consumers) may NOT be lazy-loaded | Audit `board-viewer-3d.ts` (1189 lines), `webgl-viewer.ts` (1298) — these must be code-split | M | 🟠P1 |
| 99 | a11y — images | `client/src/components/ui/WhatsNewPanel.tsx` | `<img>` without `alt=` | Add alt text | XS | 🟠P1 |
| 100 | a11y — form inputs | `client/src/components/views/procurement/BomTable.tsx` | 2 `<input type="text/number">` with no verifiable `<label>` association | Add `htmlFor` / `aria-label` | S | 🟠P1 |
| 101 | a11y — form inputs | `client/src/components/views/component-editor/ShapeCanvas.tsx` | 2 unlabeled inputs | Same as #100 | S | 🟠P1 |
| 102 | a11y audit (broad) | All `.tsx` | No automated a11y CI gate (checked — only a dashboard module exists) | Add `jest-axe` or `vitest-axe` + run in CI on component tests | M | 🟠P1 |
| 103 | Hardcoded URLs | `client/src/lib/supplier-api.ts` | 18 `https://` URLs hardcoded — inspect for embedded API keys / endpoints that should be envvars | Extract to `config/suppliers.ts`; read from env where sensitive | M | 🟠P1 |
| 104 | Hardcoded URLs | `client/src/lib/state-illustrations.ts` | 8 URLs | Likely CDN/asset links — verify and centralize | S | 🟢P3 |
| 105 | Hardcoded URLs | `client/src/lib/pinout-data.ts` | 13 URLs (probably datasheet links) | Centralize into a map | S | 🟢P3 |
| 106 | Hardcoded URLs | `client/src/lib/fab-pipeline.ts` | 5 URLs | Centralize | S | 🟡P2 |
| 107 | Hardcoded URLs | `client/src/lib/procurement/supplier-pricing-engine.ts` | 7 URLs | Centralize; align with #103 | S | 🟠P1 |
| 108 | Error boundaries | App has only 3 functional error boundaries (`ErrorBoundary`, `ValidationErrorBoundary`, workspace-level) | Route-level and panel-level boundaries missing — single panel crash can blow entire view | Add per-view boundaries (one per lazy chunk) | M | 🟠P1 |
| 109 | Stale docs — WIP | `docs/future-features-and-ideas-list.md` (>30d old, mentions future work) | Review and either archive or convert to BL items | Archive or promote to backlog | S | 🟡P2 |
| 110 | Stale docs — WIP | `docs/audit-v2-checklist.md` | Old audit with WIP markers | Archive or close | S | 🟢P3 |
| 111 | Stale docs — WIP | `docs/product-analysis-report.md` | >30 days old | Archive or refresh | S | 🟢P3 |
| 112 | Stale docs — WIP | `docs/fzpz-integration-plan.md` | >30 days | Check if BL-item exists, archive | S | 🟢P3 |
| 113 | Stale docs — WIP | `docs/frontend-audit-checklist.md` | >30 days with TODO markers | Cross-reference with current audit checklist | S | 🟡P2 |
| 114 | Stale docs — WIP | `docs/product-analysis-checklist.md` | Stale | Archive or merge into current plans | S | 🟢P3 |
| 115 | Stale docs — WIP | `docs/plans/2026-03-07-p0-security-hardening.md` | 30+ days old "P0 security" plan — if incomplete, this is 🔴 | Open and verify status; if incomplete this is a 🔴 | S | 🔴P0 |
| 116 | Stale docs — WIP | `docs/audits_and_evaluations_by_codex/04_FE-04_design_editor_ui_layer_audit.md` | Old codex audit | Convert outstanding findings to BL items | M | 🟡P2 |
| 117 | Stale docs — WIP | `docs/USER_GUIDE.md` | >30 days old + line 1136 says "This resolves most temporary issues" | User-facing doc; review for accuracy | M | 🟠P1 |
| 118 | Stale docs — WIP | `docs/hardware/RioRand_ZS-X11H_BLDC_Controller_Reference.md` | Old reference | Verify still current (tension file exists contradicting this) | S | 🟡P2 |
| 119 | Stale docs — WIP | `docs/audit-screenshots/2026-02-28-full-catalog/VISUAL-AUDIT-CHECKLIST.md` | Old visual audit | Archive | S | 🟢P3 |
| 120 | Broken marker | `docs/MASTER_BACKLOG.md` section header | "P1 — High (Broken Workflows / Major UX / Test Gaps)" | Section exists by design — sanity-check nothing stuck there forever | S | 🟢P3 |
| 121 | Broken marker | `docs/MASTER_BACKLOG.md:555` | "Broken/Non-Functional Features (Wave 64 Audit)" | Audit whether all child items are truly DONE | M | 🟠P1 |
| 122 | Broken marker | `docs/qa-audit/section-02-workspace-layout-navigation.md:74` | "Project 2 ('DevelopmentTest') is broken" | Verify fixed in current HEAD | S | 🟠P1 |
| 123 | Broken marker | `docs/qa-audit/section-15-settings-export-edge-cases.md:77` | "Export Center broken (same as S6)" | Verify and close or promote | S | 🟠P1 |
| 124 | Workaround marker | `docs/MASTER_BACKLOG.md:105` | "Native process spawning replaces browser-sandbox workarounds" | Good — already resolved | XS | 🟢P3 |
| 125 | Workaround marker | `docs/parts/ds3231-rtc-module-zs042...md:38` | "No workaround short of using an I2C multiplexer" | Domain note, not tech debt | XS | 🟢P3 |
| 126 | Workaround marker | `docs/parts/esp8266-nodemcu-amica...md:216` | "**They are not broken out on most boards**" | Factual, not tech debt | XS | 🟢P3 |
| 127 | Active plan — session mining | `docs/plans/2026-04-11-session-mining-pipeline-rebuild.md` | Large plan with many "broken" references (all describing fixes in progress) | Verify plan finished; close items | S | 🟠P1 |
| 128 | Active plan — vault health | `docs/plans/2026-04-11-knowledge-vault-health-restoration.md` | Same | Verify finished | S | 🟠P1 |
| 129 | Git branch hygiene | Local branch `replit-agent` exists | Stale branch from Replit | Delete if no unique commits: `git branch -D replit-agent` after verification | XS | 🟡P2 |
| 130 | Git branch hygiene | `remotes/gitsafe-backup/main` | Remote exists and may be stale | Check last fetch date; prune if abandoned | XS | 🟢P3 |
| 131 | Git branch hygiene | Currently on `parts-consolidation` branch, not `main` | Long-lived feature branch — risk of drift | Plan merge back to main; check divergence (`git log main..HEAD`) | S | 🟠P1 |
| 132 | Git large repo | 2,440 commits in history | Many auto-commits — consider squash+rebase for noise reduction | Document decision; if keeping, it's fine | XS | 🟢P3 |
| 133 | Duplicate file | `client/src/components/views/__tests__/ProcurementView.test.tsx` **and** `client/src/components/views/__tests__/procurement-view.test.tsx` | TWO test files (different case) for same component | Merge into one canonical file | S | 🟠P1 |
| 134 | Test structure | `client/src/lib/__tests__/` has 269 test files for 273 lib files | 98% coverage file-by-file — nearly perfect; just close the 17-file gap (see #27-43) | As above | — | — |
| 135 | `fix-db.cjs` | Root-level `fix-db.cjs` | One-off DB fix script at repo root | Move to `scripts/fix-db.cjs` or delete if no longer needed | XS | 🟡P2 |
| 136 | `build-lightweight-stack.sh` | Root-level shell script | Lives at repo root alongside package.json | Move to `scripts/` | XS | 🟢P3 |
| 137 | `.moltbook_credentials.json` at root | `/home/wtyler/Projects/ProtoPulse/.moltbook_credentials.json` | Credentials file at repo root | **Verify in `.gitignore`**; if committed, rotate creds immediately | XS | 🔴P0 |
| 138 | `RALPH-PRODUCT-ANALYSIS.md` / `RALPH-TESTS.md` at root | Two RALPH-* files at root | Should be in `docs/` or `ops/` | Move | XS | 🟢P3 |
| 139 | `product-analysis.skill` at root | `product-analysis.skill` (41KB) at repo root | Skill file at root | Move to `.claude/skills/` or equivalent | XS | 🟢P3 |
| 140 | `productivity.plugin` at root | `productivity.plugin` (37KB) | Plugin at root | Move to `.claude/plugins/` | XS | 🟢P3 |
| 141 | `doc/` and `docs/` both exist | Two documentation directories | Ambiguity — consolidate | Pick one, rewrite links, delete the other | S | 🟡P2 |
| 142 | `scribe/` directory | Root-level `scribe/` dir | Unclear purpose from top-level | Document or remove | S | 🟢P3 |
| 143 | `src-tauri/` exists | Tauri directory exists | Memory notes say "Tauri migration after hardware POC" — is the dir current or stale prototype? | Verify alignment with `project_tauri_migration.md` | S | 🟡P2 |
| 144 | Tests with `eslint-disable import-x/first` | 8 test files disable import-first rule | Tests re-ordering imports for mocks — common pattern but worth centralizing | Consider a shared test setup file that hoists mocks via `vi.mock` factory | S | 🟢P3 |
| 145 | Tests disabling `no-dynamic-delete` | `web-serial.test.ts`, `web-serial-integration.test.ts` | Dynamic delete in tests | Refactor to use proper mock reset | S | 🟢P3 |
| 146 | Tests disabling `no-implied-eval` | `drc-scripting.test.ts:159` | Uses `new Function` to test DRC sandbox | Document why; acceptable if testing sandbox boundaries | XS | 🟢P3 |
| 147 | `import-x/first` disable | `server/parts-ingress.ts:42` | One-off disable with `consistent-type-imports` | Fix import to compliant form | XS | 🟢P3 |
| 148 | Noop function lint | `client/src/lib/arduino/serial-logger.ts:35` | `no-empty-function` disabled | Use `function noop() {}` with a named noop constant | XS | 🟢P3 |
| 149 | Noop function lint | `client/src/lib/arduino/error-line-linker.ts:71` | Same | Same | XS | 🟢P3 |
| 150 | Noop function lint | `client/src/lib/validation/violation-navigator.ts:278` | Same | Same | XS | 🟢P3 |
| 151 | Thrown non-Error | `server/__tests__/job-queue.test.ts:1127` | `throw 'string error'; // eslint-disable only-throw-error` | Test verifies behavior on bad throws — acceptable, document intent | XS | 🟢P3 |
| 152 | Control regex | `client/src/lib/arduino-ide-launcher.ts:302` | `no-control-regex` disabled — stripping ANSI escapes | Extract to shared `strip-ansi` helper with test coverage | S | 🟡P2 |
| 153 | File named `arduino-ide-launcher.ts` has 2 `@ts-ignore`-class escapes | Same file | Multiple escapes suggest typing pain | Tackle typing as part of broader Arduino refactor | M | 🟡P2 |
| 154 | `collaboration.ts` — 1 `@ts-ignore` in server | `server/lib/ws-session-validator.ts:1` | One escape | Fix at next touch | XS | 🟢P3 |
| 155 | `batch-analysis.ts` — `@ts-ignore` | `server/batch-analysis.ts:1` | One escape | Fix at next touch | XS | 🟢P3 |
| 156 | Server console usage | `server/auth.ts` uses `console` — see #63 | Critical security-adjacent | See #63 | — | — |
| 157 | `setInterval` / `setTimeout` cleanup review | 15 files use timers | Each must cleanup on unmount or they leak across HMR | Audit: `time-machine.ts`, `ProcurementView.tsx`, `project-context.tsx`, `drc-scripting.ts`, `macro-recorder.ts`, `dfm-pcb-bridge.ts`, Arduino timers | M | 🟠P1 |
| 158 | Arduino runtime timers | `client/src/lib/arduino/ota-variable-watch.ts` (2), `hil-lite.ts` (2), `isr-safety-scanner.ts` (1), `serial-logger.ts` (3) | Timer-heavy modules | Ensure `return () => clearTimeout/Interval(...)` in every effect that creates them | M | 🟠P1 |
| 159 | Docs "coming soon" in `USER_GUIDE.md` | Multiple "temporary issue" / "coming soon" phrases | Potentially misleading to users | Audit and either ship or remove promises | M | 🟠P1 |
| 160 | `reports/ai-audit/00-MASTER-REPORT.md` | "HIGH 19 — Tool double-execution, missing abort signal, dead Anthropic code, weak typing, missing rate limits, broken GenerativeDesign adopt" | Some of these may still be open | Cross-check with current state; file BL items for unresolved | M | 🔴P0 |
| 161 | `reports/browser-testing-report.md` | Browser testing report — verify it reflects current state | Refresh or archive | M | 🟡P2 |
| 162 | `CODEX_DONE.md` at root (122KB) | Huge Codex output file at root | Archive or move to `docs/codex-outputs/` | XS | 🟡P2 |
| 163 | `replit.md` at root (symlinked) | Legacy Replit config | Verify still needed post-Tauri migration plan | XS | 🟢P3 |
| 164 | `.replit` file | Replit config | Same as #163 | XS | 🟢P3 |
| 165 | `.codex` empty file at root | `-r--r--r--` zero-byte file | Marker file? Document or remove | XS | 🟢P3 |
| 166 | `.genkit/` dir | Genkit (Google) artifacts | Verify still in use; add to `.gitignore` if it's build output | XS | 🟢P3 |
| 167 | `.idx/` dir | Google IDX artifacts | Same | XS | 🟢P3 |
| 168 | `.claudekit/` dir | Claudekit files — Tyler's memory notes mention local patches get overwritten | See `claudekit_patches.md` — ensure patches persist across upgrades | S | 🟠P1 |
| 169 | Two `AGENTS.md` / `CLAUDE.md` naming | `CLAUDE.md` → `AGENTS.md` symlink | Works but verify ALL AI tools actually follow the symlink | XS | 🟢P3 |
| 170 | `.smart-env/event_logs/event_logs.ajson` modified | Uncommitted modification | Likely generated — add to `.gitignore` if not already | XS | 🟡P2 |
| 171 | `.claude/scheduled_tasks.lock` deleted | Uncommitted deletion | Likely ephemeral lockfile — add to `.gitignore` | XS | 🟢P3 |
| 172 | `.claude/.tsc-errors.log` modified | Generated TSC log tracked | Add `.tsc-errors.log` to `.gitignore` | XS | 🟡P2 |
| 173 | Tension files modified uncommitted | `ops/tensions/bldc-brake-polarity-*.md`, `ops/tensions/mosfet-driver-*.md` | Uncommitted edits pre-audit | Commit if intentional, discard if not | XS | 🟢P3 |
| 174 | Arduino scaffold TODOs — 24+ in one file | `server/export/firmware-scaffold-generator.ts` | All intentional user-facing scaffold hints | Add file-top comment declaring these are intentional; add lint exception for just this file | XS | 🟢P3 |
| 175 | ESP-IDF config TODO | `client/src/lib/arduino/esp-idf-support.ts:610` | "Handle `# CONFIG_XXX is not set`" — a code-comment describing Kconfig syntax, not a TODO | No action (false positive in TODO scan) | XS | 🟢P3 |
| 176 | Duplicate audit/checklist files | `docs/checklist/` has `MASTER_AUDIT_CHECKLIST.md`, `WORKFLOW_VERIFICATION_MATRIX.md`, `AUDIT_LEDGER.md` — all reference same temporary data | Consolidate into one audit source-of-truth | M | 🟡P2 |
| 177 | Duplicate `BreadboardView` tests exceed source? | `BreadboardView.tsx` 2284 lines vs `BreadboardView.test.tsx` 1195 lines | Good coverage, but file size of both suggests refactor cascade | Do #1 first, then re-split tests | — | 🟠P1 |
| 178 | `server/export/kicad-exporter.ts` (1424) + `eagle-exporter.ts` (1291) + `step-generator.ts` (856) + `fzz-handler.ts` (821) | All exporters are massive | Extract shared exporter scaffolding (`BaseExporter`, `writeFile`, `validate`) | L | 🟡P2 |
| 179 | No tests for `types.ts` in `client/src/lib` | File is type-only per convention but not verified | Audit for runtime code; if pure types, document in ESLint config | XS | 🟢P3 |
| 180 | `shared/arduino-example-circuits.ts` — 1430 lines | Giant static data file | If pure data, split per-example into separate files, export via barrel | M | 🟡P2 |
| 181 | Tests failing-to-exist for `accessibility-audit-dashboard` | See #27 | A11y module with no tests is ironic | Add tests PRIORITY because the module enforces a11y | M | 🟠P1 |
| 182 | Potential mocking complexity | `client/src/lib/__tests__/web-serial.test.ts` 1474 lines, `web-serial-integration.test.ts` 2114 lines | Test files bigger than anything except BreadboardView | Split test files per concern; extract shared fixtures | L | 🟡P2 |
| 183 | Large test | `design-branching.test.ts` 1390 lines, `design-import.test.ts` 1281 lines | Big test files | Split | M | 🟢P3 |
| 184 | Massive server test | `server/lib/__tests__/job-executors.test.ts` 1371 lines | Big | Split per executor | M | 🟢P3 |
| 185 | Massive server test | `server/__tests__/job-queue.test.ts` 1247 lines | Big | Split | M | 🟢P3 |
| 186 | Massive server test | `server/__tests__/ai-tools-boundary.test.ts` 1139 lines | Big — but boundary tests should stay together | Document choice | XS | 🟢P3 |
| 187 | `.agents/skills/claude-api/templates/*.ts` | `error-handling.ts` (5 `any`), `cloudflare-worker.ts` (4 `any`) | Template files — probably intentional `any` | Document as templates, lint-exempt | XS | 🟢P3 |
| 188 | `.agents/skills/claude-agent-sdk/templates/custom-mcp-server.ts:109` | `eval(args.expression)` in template | Dangerous template — add prominent warning at top | S | 🟠P1 |
| 189 | `.agents/skills/claude-api/templates/tool-use-advanced.ts:52` | `eval(input.expression)` in template | Same as #188 | S | 🟠P1 |
| 190 | AI report findings | `reports/ai-audit/00-MASTER-REPORT.md` — mentions "dead Anthropic code" | Track down and delete if dead | M | 🟠P1 |
| 191 | AI report findings | Same file — "missing abort signal" on AI tools | Wire `AbortController` through streaming + tool calls | M | 🔴P0 |
| 192 | AI report findings | Same file — "missing rate limits" | Add rate limiter middleware around AI tool endpoints | M | 🟠P1 |
| 193 | AI report findings | Same file — "tool double-execution" | Debounce / idempotency key on AI tool calls | M | 🟠P1 |
| 194 | AI report findings | Same file — "broken GenerativeDesign adopt" | Open BL item, fix or close feature | M | 🟠P1 |
| 195 | `images/` dir at repo root | Contains images at top level | Move to `client/public/images/` or `docs/images/` depending on use | S | 🟢P3 |
| 196 | `attached_assets/` at root | Old-looking dir | Archive if unused | S | 🟢P3 |
| 197 | `manual/` at root | Manual files at root | Move to `docs/manual/` | XS | 🟢P3 |
| 198 | `conductor/` at root | Conductor-related files | Document purpose or move | S | 🟢P3 |
| 199 | `templates/` at root | Generic templates dir at root | Move under `docs/templates/` or similar | XS | 🟢P3 |
| 200 | `script/` AND `scripts/` both exist | Two script directories | Consolidate into `scripts/` | S | 🟡P2 |
| 201 | `self/` dir at root | Ars Contexta self-notes at root | Confirm intended location per Ars Contexta methodology | XS | 🟢P3 |
| 202 | Orphaned top-level `reports/` | Reports dir at root | Move to `docs/reports/` for consistency | XS | 🟢P3 |
| 203 | TypeScript strict check | Run `npx tsc --noEmit` | Baseline error count | Run and commit current count to `.tsc-errors.log` as a gate | S | 🟠P1 |
| 204 | ESLint baseline | Run `npx eslint . --quiet` | Baseline warning count | Gate CI on non-increase | S | 🟠P1 |
| 205 | Vitest coverage | Run `npm run test -- --coverage` | Baseline coverage per module | Add threshold gates; start permissive, tighten over time | M | 🟠P1 |
| 206 | `package.json` scripts review | Top-level `package.json` | Audit for unused/broken scripts (build-lightweight-stack.sh, fix-db.cjs referenced?) | Run each npm script, prune dead ones | S | 🟢P3 |
| 207 | `vite.config.ts` audit | Root | Check manual chunk splits, build target, env handling | Tune chunk splits; document per target (web vs Tauri) | M | 🟡P2 |
| 208 | `drizzle.config.ts` sanity | Root | Ensure migrations are idempotent and reviewed | Audit `migrations/` dir | S | 🟢P3 |
| 209 | `playwright.config.ts` | Root | E2E config | Verify CI runs on merges; surface broken specs | S | 🟡P2 |
| 210 | `e2e/` dir | Playwright specs | Audit for stale specs | S | 🟡P2 |
| 211 | `backups/` dir at root | Backup files checked in | Add to `.gitignore` if ephemeral, or move to `.local/` | XS | 🟡P2 |
| 212 | `.local/` dir | Local-only files — should be `.gitignore`d | Verify | XS | 🟢P3 |
| 213 | `logs/` dir | Log files at root | Add to `.gitignore` if not already | XS | 🟢P3 |
| 214 | `.smart-env/` tracked artifacts | Modified `event_logs.ajson` was uncommitted — now part of an "Auto:" commit | Consider whether this should ever be committed | S | 🟡P2 |
| 215 | Auto-commit noise | `git log` full of "Auto: N files" commits | Hard to bisect; hard to review | Consider: (a) compact to one commit per day; (b) better commit messages from hook; (c) separate branch | M | 🟠P1 |
| 216 | Memory note backlog — "Fix before moving forward" | `MEMORY.md` rule | Per Tyler's rule: the `.tsc-errors.log` modification suggests open TS errors | Run `npm run check`; fix EVERY error before any new work | S | 🔴P0 |
| 217 | No pre-commit hook verification | `.claude/hooks/` dir exists but verify hooks ACTUALLY run on commits | Hooks may be silently skipped | Test: create a small file, stage, commit; verify hook output | XS | 🟡P2 |
| 218 | No pre-push hook for main | `auto-push-protopulse.sh` runs on Stop, not on push | No guard against pushing broken main | Add pre-push hook: run `npm run check` before push | S | 🟠P1 |
| 219 | Docs: `AGENTS.md` symlink chain | `.cursorrules`, `.windsurfrules`, `.replit.md`, `CLAUDE.md`, `GEMINI.md`, `.clinerules` all → `AGENTS.md` | Good consolidation | Verify each tool actually respects symlinks (some follow, some don't on Windows) | S | 🟢P3 |
| 220 | `self/identity.md` drift | `self/` is agent identity | Per Tyler's session rhythm, must be read every session | Verify session hook does this | S | 🟢P3 |
| 221 | Missing `CONTRIBUTING.md` | Repo root | No contributor guide | Add one describing commit conventions + hook requirements | S | 🟢P3 |
| 222 | Missing `SECURITY.md` | Repo root | No security policy | Add one (especially given `eval`/`new Function` usage) | S | 🟡P2 |
| 223 | Missing `LICENSE` header | Check root | License status? | Add `LICENSE` if intended public; else mark private | S | 🟢P3 |
| 224 | `README.md` size 22KB | Root README | Likely outdated in places | Compare against current feature set; trim | M | 🟡P2 |
| 225 | `knowledge/` is 81KB block-file directory | 528+ notes per Tyler's memory | Verify Obsidian links not broken after Wave 106 campaign | Run `arscontexta:health` skill | S | 🟠P1 |
| 226 | `ops/tensions/` has uncommitted edits | Tensions are intentional contradictions | Commit them as tension notes per Ars Contexta | XS | 🟢P3 |
| 227 | `ops/sessions/` session mining | Per plan `2026-04-11-session-mining-pipeline-rebuild.md` | Verify session mining pipeline works end-to-end | Run `/remember --mine-sessions` | S | 🟠P1 |
| 228 | `ops/queue/queue.json` status | Ars Contexta queue | Stale inbox items? | Check + process via `/next` | S | 🟡P2 |
| 229 | `ops/health/` reports | Per Ars Contexta, periodic health checks | Verify cadence | Schedule via cron or stop-hook | S | 🟡P2 |
| 230 | Obsidian orphans | `.obsidian/` dir configured | Potential orphan notes in `knowledge/` | Run Obsidian's unresolved-links report | S | 🟡P2 |
| 231 | `images/` may be referenced from both docs AND client | Risk of broken links after moves | Before move, grep all `.md` and `.tsx` for paths | S | 🟡P2 |
| 232 | `shared/` has no tests directory | `shared/drc-engine.ts` is 1519 lines with presumably heavy logic | Verify tests exist or add | M | 🔴P0 |
| 233 | `server/storage/parts.ts` 926 lines | Parts storage logic | Split per query type; add tests for edge cases (null, empty, bulk) | M | 🟠P1 |
| 234 | `server/__tests__/auth-regression.test.ts` 885 lines | Good — auth has a regression suite | Verify covers all auth paths in `server/auth.ts` | S | 🟡P2 |
| 235 | `server/circuit-routes/exports.ts` 942 lines | Export routes | Split per export type | M | 🟡P2 |
| 236 | Chat route size | `server/routes/chat.ts` 806 lines | Split prompt assembly, tool dispatch, streaming | M | 🟠P1 |
| 237 | Components route | `server/routes/components.ts` 781 lines | Split CRUD + search + import | M | 🟡P2 |
| 238 | `server/component-ai.ts` 1006 lines | AI tools for components | Extract model-specific adapters | M | 🟡P2 |
| 239 | `server/ai-tools/export.ts` 1107 lines | AI export tools | Same | M | 🟡P2 |
| 240 | `server/ai-tools/manufacturing.ts` 1062 lines | AI manufacturing tools | Same | M | 🟡P2 |
| 241 | Collaboration tests | `server/__tests__/collaboration*.test.ts` — 3 files totaling 2500+ lines | Heavy integration | Verify runtime (is collaboration feature still active?) | S | 🟡P2 |
| 242 | Empty Arduino IDE paths | `.agents/skills/claude-api/templates/nextjs-api-route.ts:1` any-typed | Template — document intention | XS | 🟢P3 |
| 243 | Vite-plugin-meta-images usage | `vite-plugin-meta-images.ts` at root uses `console.*` | Guard with DEV check or migrate to logger | XS | 🟢P3 |
| 244 | Tauri POC | `src-tauri/` directory exists | Per memory, migration is "after hardware POC" | Confirm status; ensure Tauri build doesn't regress against web | S | 🟡P2 |
| 245 | Cron verification | `~/.claude/scripts/auto-push-protopulse.sh` runs every 15 min | Verify log shows healthy pushes | `tail ~/.claude/logs/auto-push-protopulse.log` | XS | 🟢P3 |
| 246 | ESLint config | `eslint.config.js` 6376 bytes | Large flat config; review for dead rules | S | 🟢P3 |
| 247 | `reports/` vs `docs/audits/` | Two similar destinations | Consolidate audit output location | S | 🟢P3 |
| 248 | Large SVG rendering | `svg-sanitize` + `StorageManagerPanel` | Run `svg-sanitize` through OWASP XSS filter evaluator | M | 🔴P0 |
| 249 | Arduino serial tests depending on `navigator.serial` | Jest/Vitest env shimming | Verify stable; 1474+2114 lines of tests suggests complexity | Extract shared `web-serial-test-env.ts` fixtures | M | 🟡P2 |
| 250 | `client/src/lib/sketch-secrets-scanner.ts` uses `console.*` | Secret scanner logs itself | Ensure scanner never logs matched secrets | XS | 🔴P0 |
| 251 | `client/src/lib/arduino/isr-safety-scanner.ts` uses `setInterval` | Scan loop | Must stop on dispose | S | 🟡P2 |
| 252 | `client/src/lib/time-machine.ts` 12 `any`s + 2 timers | Undo/redo time machine — one of the most reliability-critical libs | TYPE IT PROPERLY; add fuzz tests | L | 🔴P0 |
| 253 | `client/src/lib/ram-usage-monitor.ts` — `console.*` | Ironic: memory monitor uses console | Logger refactor; also verify it doesn't itself leak memory | S | 🟡P2 |
| 254 | "Fast way vs best way" | `MEMORY.md` rule: "never do shit the fast way unless it's the best way" | Apply to all items above — pick the RIGHT refactor even if bigger | — | — |

## Summary

**254 findings** across all scanned categories. No curation applied, per mission brief.

### Quick-wins (XS effort, any priority)
- #99 alt text
- #135–140, #162, #195–200 root-level file moves
- #148–155, #170–173 trivial lint cleanups
- #137 verify `.moltbook_credentials.json` ignored — **potential 🔴**
- #216 run `npm run check` and clear `.tsc-errors.log`

### Weekend-worth (L effort, 🟠+)
- #1 BreadboardView split (2284 LOC)
- #95 Add virtualization everywhere it matters
- #5, #6, #7 AI/simulation/waveform splits
- #252 Type the time-machine properly

### Security-leaning (🔴)
- #29 CSV round-trip tests
- #30 DRC script sandbox escape tests
- #38 `svg-sanitize` fuzz/XSS tests
- #63 Audit `server/auth.ts` console calls for secret leakage
- #67 Harden `StorageManagerPanel` SVG preview
- #115 P0 security hardening plan — verify complete
- #137 Credentials file status
- #160, #191 abort signal + rate limits for AI tools
- #232 Tests for `shared/drc-engine.ts` (1519 LOC, no dir)
- #248 OWASP eval of `svg-sanitize`
- #250 Secrets scanner logging audit
- #252 time-machine fuzz

### Systemic ask (L / M)
- #94, #96 render-perf audit via React DevTools
- #97, #98 bundle-size profiling
- #102 `vitest-axe` in CI
- #108 per-view error boundaries
- #205 coverage baseline + thresholds
- #215 auto-commit noise reduction

---

Generated 2026-04-14 by proactive-improvement-audit sweep.
Consumed input: `client/src/` (273 lib files), `server/` (40+ modules), `shared/`, `docs/` (451+ md files).
