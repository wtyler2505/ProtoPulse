# Phase 4: Technical Debt & Architecture — ProtoPulse

> Generated: 2026-07-18  
> Scope: `client/src`, `server`, `shared`, `packages`, and `src-tauri`, excluding dependency, coverage, build, and Rust target trees unless a section explicitly measures those artifacts.  
> Boundary: static analysis plus current GitHub Actions evidence. I did not run the full monorepo build/typecheck/test locally because this machine's documented `earlyoom` behavior can terminate those commands and produce false signals (`AGENTS.md:56-59`). Package-level and source-area tools were used instead; the latest CI evidence is from the current `fbd2f76e` commit.

## Method and interpretation

All findings get addressed — do not rank by priority/value/impact, do not fix only a subset, do not shrink the list. Severity below describes the consequence of a finding; it is not permission to omit lower-severity work. P0-P3 in the companion checklist is dependency/build order only.

The repository is large enough that raw counts require context. A long file is not automatically defective, a test-file count is not behavioral coverage, and a `lizard` score for a React closure can include nested callbacks. The counts locate maintenance boundaries; the file-level probes establish the actionable findings.

Tools actually used: `scc`, `tokei`, `lizard`, `rg`, `ast-grep`, `npm audit`, `cargo audit`, `cargo tree`, `git`, and `gh`. Context7 was also checked against current MDN documentation for CSP behavior in workers and string-to-code evaluation.

## Executive technical truth

- The trusted product scope is **2,527 files and 701,993 code lines** by `scc`; TypeScript alone is 680,423 code lines. This is not a small application hiding behind a tidy package list.
- The latest main CI and Packages CI runs pass on `fbd2f76e`; root CI ran **31,247 passing tests with 2 skipped** and passed its coverage gate. Tauri's five platform packages also built, but the workflow is red because the Linux x64 supply-chain step fails after packaging ([main CI](https://github.com/wtyler2505/ProtoPulse/actions/runs/29139503550), [packages CI](https://github.com/wtyler2505/ProtoPulse/actions/runs/29139503577), [Tauri matrix](https://github.com/wtyler2505/ProtoPulse/actions/runs/29139503578)).
- Complexity is concentrated in real product seams: the legacy breadboard canvas, PCB editor, simulation solvers, engine canvas, legacy AI path, and ESP32-S3 emulator. These same emulator files also have the highest measured 90-day change frequency.
- The current security posture has substantial strengths—global auth, origin checking, rate limiting, size limits, Helmet CSP, strict SVG sanitization, and argument-array process spawning in several paths (`server/index.ts:54-102`, `server/index.ts:165-251`, `shared/svg-sanitize.ts:14-79`). It also has four concrete gaps: request-derived Arduino values reach shell command strings; the code-execution workers conflict with production CSP; the relay can start open and retains unbounded aggregate state; and the active DOMPurify version is advisory-affected.
- The `.ppx` compatibility seam is not ready for vocabulary expansion: version 1 is written but any positive version is accepted, unknown ops hard-fail, `assets/` is only an empty directory, and unreadable browser data can fall through to a starter that is later autosaved (`packages/graph/src/store/serialize.ts:20-26`, `packages/graph/src/store/serialize.ts:95-129`, `packages/graph/src/store/fs-store.ts:79-112`, `packages/app/src/state/persistence.ts:53-62`, `packages/app/src/main.tsx:24-53`).
- The dependency picture is broader than the visible Rust failure. Current production `npm audit` reports **64 affected package nodes** (5 high, 59 moderate). The five high nodes are temporarily policy-allowlisted through 2026-07-31; two directly reachable remediation paths (`js-yaml` and the DOMPurify chain) already report fixes available.

## Cross-Phase Consequence Map

These are not isolated engineering chores. Each seam controls whether a current UX promise, migration step, or proposed composition can be delivered honestly.

| Technical seam | User, migration, and innovation consequence | Phase 4 coverage |
|---|---|---|
| CSP versus local evaluators | DRC scripting and the circuit DSL can look available in development but fail under the delivered browser/Tauri policy. Keep CSP strong and replace `Function`; the resulting trust policy and resource limits should inform the proposed device-model workshop rather than allow another raw-evaluation path. | TD-06, TD-13, EN-05; connects to UI capability truth and IN-07. |
| Relay exposure and state bounds | An open/global-token relay with unbounded aggregate room/log state is not a safe substrate for portable review capsules, narrow read/comment/edit roles, offline queues, or non-local rooms. Authorization, quotas, eviction, backpressure, and file-only fallback precede those collaboration workflows. | TD-11, TD-24, EN-05; connects to FG-06/16 and IN-05/12. |
| Tauri audit and release truth | All five platform package steps complete, but release evidence fails later at audit and packaged smoke is skipped. The UX may say desktop packaging exists; it must not imply release readiness, and reproducible release capsules need a complete audit/SBOM/smoke record. | TD-02 through TD-05, TD-15, EN-03/04; connects to Phase 1 EN-16, UI capability truth, and IN-18. |
| Arduino path, process, and project ownership | Real-device work crosses from a project into host files and processes. Until every request value is schema-bound, workspace-owned, and passed as an argument array, flashing cannot be presented as a trustworthy live-device path. | TD-01, TD-24, EN-05; connects to Phase 1 EN-10 and UI-16. |
| `.ppx` compatibility, recovery, and autosave | A normal vocabulary change can make a design unreadable, then the starter/autosave path can replace the only browser copy. Version migration, future-op policy, assets, retained raw bytes, and blocked autosave form one gate for the real-project migration corpus and every proposal that expands stored graph vocabulary. | TD-07 through TD-10, TD-13, TD-24, EN-05; connects to Phase 1 EN-01/02/08, FG-01/02/18, UI-17, and IN-01/19/20. |
| Conditional test boundaries | Thirty-one thousand passing tests do not exercise the Phase 3 journeys: Playwright is absent from required CI, database parity and real closed-loop cosim are conditional, production CSP is untested, and packaged smoke is downstream of fail-fast audit. Those states cannot ratify migration, custom logic, real collaboration, or scenario/causal-trace work. | TD-13 through TD-15, TD-24/25, EN-03/05; connects to UI-06/09/17 and IN-06/13/19. |
| Complexity hotspots plus change frequency | The legacy breadboard and PCB canvases carry current maker workflows; `CanvasHost` carries the candidate canonical editor and semantic circuit mode; solver/emulator boundaries carry scenario, device-model, and causal-trace work. Characterization and stable interfaces must precede UX reflow, migration parity, or innovation work in those areas. | TD-20 through TD-23, TD-28, EN-01/02; connects to UI-06 through UI-10 and IN-06/07/09/10/11/13/19/20. |

## Complexity Hotspots

These are actual `lizard --csv` results from six deterministic source-only runs. Tests, generated output, `node_modules`, `dist`, `coverage`, and `src-tauri/target` were excluded. The first attempted whole-scope scan was discarded because its exclusion pattern accidentally admitted the 26 GB Rust target tree; a corrected all-file run was then replaced by these bounded area runs when `lizard`'s worker pool spent several minutes tokenizing the entire TypeScript surface. The area runs completed normally and are reproducible.

| Function / closure | File | CCN | NLOC | Params |
|---|---|---:|---:|---:|
| `(anonymous)` breadboard canvas component | `client/src/components/circuit-editor/breadboard-canvas/index.tsx:355` | 459 | 744 | 0 |
| `(anonymous)` engine canvas component | `packages/app/src/editor/CanvasHost.tsx:95` | 253 | 368 | 0 |
| `runTransientAnalysis` | `client/src/lib/simulation/transient-analysis.ts:553` | 204 | 503 | 1 |
| `stampNonlinearCompanions` | `client/src/lib/simulation/circuit-solver.ts:340` | 97 | 123 | 8 |
| `(anonymous)` PCB canvas component | `client/src/components/circuit-editor/PCBLayoutView.tsx:281` | 93 | 513 | 1 |
| `generateLogFrequencies` area | `client/src/lib/simulation/ac-analysis.ts:131` | 55 | 249 | 20 |
| `solveTransient` | `client/src/lib/simulation/circuit-solver.ts:695` | 52 | 134 | 6 |
| `sha256BlockInto` | `packages/emu/src/esp32s3.ts:1069` | 50 | 26 | 0 |
| `solveLinearSystem` area | `client/src/lib/simulation/circuit-solver.ts:108` | 48 | 159 | 25 |
| `isArchView` / legacy AI closure area | `server/ai.ts:650` | 43 | 239 | 8 |
| `aesEncryptBlock` | `packages/emu/src/esp32s3.ts:1242` | 37 | 25 | 0 |
| `aesDecryptBlock` | `packages/emu/src/esp32s3.ts:1290` | 37 | 25 | 0 |
| `(anonymous)` component editor body | `client/src/components/views/ComponentEditorView.tsx:860` | 36 | 363 | 1 |
| `computeNodeImpedance` | `client/src/lib/simulation/ac-analysis.ts:611` | 34 | 116 | 4 |
| `runParsedNetlist` | `client/src/lib/simulation/spice-netlist-parser.ts:920` | 31 | 79 | 1 |
| `exportPanelFab` | `packages/app/src/panels/ExportPanel.tsx:148` | 29 | 42 | 0 |
| `(anonymous)` component-editor helper | `client/src/components/views/ComponentEditorView.tsx:577` | 29 | 36 | 0 |
| `parseSpiceNetlist` | `client/src/lib/simulation/spice-netlist-parser.ts:588` | 26 | 90 | 1 |
| `segmentToSegmentDistance` area | `shared/drc-engine.ts:995` | 23 | 58 | 23 |
| `formatAsConstExpressions` area | `shared/arduino-pin-generator.ts:495` | 22 | 103 | 11 |

`lizard` sometimes folds nested TypeScript/React functions into one reported area, which explains names such as `isArchView` and large aggregate parameter counts. That makes the number directional, not imaginary: the reported source spans really do hold those nested decisions and callbacks. Refactoring should establish smaller stateful boundaries and tests, then rerun the same commands; it should not chase a score mechanically.

## Largest Files

### Actual `scc --by-file` leaders

| File | Lines | Code | Language / role |
|---|---:|---:|---|
| `packages/emu/src/esp32s3.test.ts` | 13,408 | 12,071 | TypeScript test corpus |
| `packages/emu/src/esp32s3.ts` | 9,475 | 8,185 | TypeScript emulator |
| `src-tauri/gen/schemas/linux-schema.json` | 7,537 | 7,537 | generated JSON |
| `src-tauri/gen/schemas/desktop-schema.json` | 7,537 | 7,537 | generated JSON |
| `packages/parts/src/seed/index.ts` | 2,943 | 2,901 | seed data |
| `client/src/lib/desktop/storage-key-inventory.json` | 2,013 | 2,013 | generated inventory |
| `client/src/lib/__tests__/web-serial-integration.test.ts` | 2,114 | 1,513 | TypeScript test |
| `client/src/components/circuit-editor/PCBLayoutView.tsx` | 1,530 | 1,342 | React editor |
| `client/src/components/circuit-editor/breadboard-canvas/index.tsx` | 1,477 | 1,268 | React editor |
| `client/src/components/panels/SerialMonitorPanel.tsx` | 1,399 | 1,251 | React panel |
| `shared/drc-engine.ts` | 1,541 | 1,250 | shared algorithm |
| `server/export/eagle-exporter.ts` | 1,291 | 1,241 | exporter |
| `client/src/components/simulation/WaveformViewer.tsx` | 1,453 | 1,217 | React visualization |
| `client/src/components/views/ComponentEditorView.tsx` | 1,263 | 1,208 | React editor |
| `packages/app/src/styles.css` | 1,423 | 1,166 | engine stylesheet |

There are **26 non-test TypeScript/Rust files with at least 1,000 code lines**. They are all accounted for here so decomposition work does not quietly become “fix the three largest”:

| Boundary | Files |
|---|---|
| Emulator and static catalogs | `packages/emu/src/esp32s3.ts`; `packages/parts/src/seed/index.ts`; `shared/arduino-example-circuits.ts`; `shared/schema.ts` |
| Editor/view components | `PCBLayoutView.tsx`; `breadboard-canvas/index.tsx`; `SerialMonitorPanel.tsx`; `WaveformViewer.tsx`; `ComponentEditorView.tsx`; `client/src/components/panels/ExportPanel.tsx`; `component-editor/ShapeCanvas.tsx`; `ChatPanel.tsx`; `ArchitectureView.tsx` |
| Client logic | `tutorial-system.ts`; `lcsc-part-mapper.ts`; `assembly-cost-estimator.ts`; `arduino/code-simulator.ts`; `breadboard-board-audit.ts`; `proactive-healing.ts`; `parametric-search.ts`; `pcb/pcb-drc-checker.ts`; `pcb/webgl-viewer.ts`; `alternate-parts.ts` |
| Server/shared logic | `shared/drc-engine.ts`; `server/export/eagle-exporter.ts`; `server/ai.ts` |

Static catalogs and serialization-heavy exporters need partitioning and generated-data boundaries, not arbitrary function splitting. The high-CCN editors, solvers, AI path, DRC, and emulator need behavioral seams and smaller testable units.

## Code Smell Summary

| Smell | Current source-only result | Consequence / interpretation |
|---|---:|---|
| Explicit `any` type | 1 | `useState<any[]>` in `ProfileSettingsDialog.tsx:35`; replace with the actual device type. |
| `as any` assertions | 1 | Generated binding catch path in `client/src/lib/bindings.ts:62`; fix the generator/template, not only the emitted file. |
| `@ts-ignore` / `@ts-expect-error` | 0 | Clean. |
| Direct `eval(...)` AST matches | 0 | Clean. String-to-code execution uses `Function`, covered under Security. |
| `!.`-shaped non-null assertions | 118 | Many are guard-backed, but the rule is warning-only and CI hides warnings; ratchet by changed file. |
| Browser/engine raw console calls | 22 | The client already has a structured logger (`client/src/lib/logger.ts:4-40`), but engine and migration paths still bypass it. |
| Broad console textual matches | 39 in 22 files | Includes logger bindings, comments, server/CLI output, and the 22 browser/engine calls; it is not 39 leaked debug logs. |
| Developer TODOs | 5 | Draftsman plus four vault-link/data-model follow-ups. Generated firmware scaffolds intentionally emit user-facing TODOs and are not counted as source debt. |
| Lint warning visibility | hidden in CI | Both workflows run ESLint with `--quiet`, while explicit `any`, non-null assertions, console, accessibility, hooks dependencies, and many legacy rules are warnings (`.github/workflows/ci.yml:30`, `.github/workflows/packages-ci.yml:45`, `eslint.config.js:162-239`). |
| Duplicate lint override | 1 | `no-alert` is set to error and later overwritten to warning (`eslint.config.js:181`, `eslint.config.js:186`). |

TypeScript itself is strict (`tsconfig.json:10`). The problem is not a wholesale absence of typing; it is the invisible warning backlog and a few unsafe boundary escapes.

The five actual source TODOs are:

- `packages/app/src/panels/DraftsmanPanel.tsx:21`
- `client/src/components/views/KnowledgeView.tsx:141`
- `client/src/components/views/procurement/BomToolbar.tsx:76`
- `client/src/components/views/component-editor/DRCPanel.tsx:242`
- `client/src/components/views/DashboardView.tsx:282`

## Security Findings

| Finding | Location / live evidence | Severity | Required treatment |
|---|---|---|---|
| Request-derived Arduino values reach shell command strings and unbounded paths | Compile/upload accept `req.body.sketchPath` directly (`server/routes/arduino.ts:258-304`); `resolveSafe` exists but is used only by syntax source lookup (`server/arduino-service.ts:131-138`, `server/arduino-service.ts:472-476`); syntax builds a shell string containing request `fqbn` (`server/arduino-service.ts:505-508`); ELF analysis builds another shell string from the stored path (`server/routes/arduino.ts:335-353`). | High | Validate FQBN/port/path with one schema, resolve every sketch/artifact under the owned workspace, and replace both shell strings with `execFile` argument arrays. Add traversal, quote, option-injection, and ownership tests. |
| Production CSP conflicts with both custom-code execution paths | Main-thread `new Function` syntax check and worker execution (`client/src/lib/drc-scripting.ts:143-151`, `client/src/lib/drc-script-worker.ts:249-259`); blob-worker DSL `new Function` (`client/src/lib/circuit-dsl/circuit-dsl-worker.ts:295-313`); production web and Tauri CSP intentionally omit `unsafe-eval` (`server/index.ts:61-64`, `src-tauri/tauri.conf.json:23`, `src-tauri/tests/command_manifest.rs:209-210`). | High functional / security-boundary conflict | Do not weaken CSP to make it pass. Replace string execution with a constrained interpreter/AST evaluator or an isolated process boundary, then add browser and packaged-Tauri tests under production CSP. |
| Relay can start open and aggregate state is unbounded | Token is optional and the entry point labels the default `open` (`packages/relay/src/main.ts:12-28`); per-message caps exist (`packages/relay/src/protocol.ts:20-35`), but rooms/branches/envelopes have no aggregate quotas and empty rooms remain forever (`packages/relay/src/server.ts:52-58`, `packages/relay/src/server.ts:99-123`, `packages/relay/src/server.ts:225-233`). | High when network-reachable | Make bind host explicit, require auth for non-loopback use, add room/client/branch/envelope/byte quotas, eviction/backpressure, and persistent-storage quotas. |
| DOMPurify security control is advisory-affected | `isomorphic-dompurify@3.9.0` resolves `dompurify@3.4.0`; current `npm audit` reports the DOMPurify node moderate with a fix available. It guards imported SVG rendered through `dangerouslySetInnerHTML` (`shared/svg-sanitize.ts:11-79`, `StorageManagerPanel.tsx:730-733`). | Medium | Upgrade the chain, rerun the malicious SVG corpus, and keep the strict tags/attributes/512 KiB cap. |
| Arduino autocomplete uses `innerHTML` | `client/src/lib/arduino/autocomplete.ts:82-84`. The current generator sanitizes the name and constrains pin values (`shared/arduino-pin-generator.ts:136-159`, `shared/arduino-pin-generator.ts:341-372`), but optional component/net fields exist on the type. | Medium | Build DOM nodes with `textContent`; do not preserve an injection sink based on today's caller invariants. Add an adversarial label test. |
| Chart style injection is a controlled developer-data sink | `client/src/components/ui/chart.tsx:69-98` documents `useId` plus developer-owned `ChartConfig`. | Low / retain guard | Keep config non-user-controlled; validate CSS values if that contract changes. |
| SVG preview sink is sanitized and bounded | `StorageManagerPanel.tsx:730-733`; `shared/svg-sanitize.ts:14-79`. | Controlled | Preserve sanitizer parity between the client and shared copies and keep regression tests blocking. |
| Hardcoded credential scan | Filename-only scan produced three candidates: backup/restore URL parsers and a local audit account fixture. Redacted inspection showed runtime-derived `PGPASSWORD` and generated audit credentials, not committed production secrets (`scripts/backup.sh:64-74`, `scripts/restore.sh:145-157`, `scripts/audit-deep-pass-v2-snapshot.ts:272-281`). | No production finding | Keep secret scanning in CI. Do not treat the fixture password as a service credential. |
| Private-key marker scan | One match, in `client/src/lib/__tests__/sketch-secrets-scanner.test.ts`; no production-source private key marker. | No production finding | Preserve the fixture and scanner. |
| Plain HTTP scan | Product matches are SVG/XML namespaces, localhost development endpoints, and an Arduino LAN example; production deployment profiles warn on HTTP (`client/src/lib/deployment-profiles.ts:118-149`). | No blanket finding | Keep localhost/LAN allowances scoped and preserve the production validation. |

Current MDN documentation, retrieved through Context7, states that [`Function()` is blocked when `script-src` lacks `'unsafe-eval'`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_eval_expressions), and that [`blob:` workers inherit the creator's CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP#workers). That directly supports the static CSP conflict above; it is not an inference from package names. A live production browser and packaged Tauri run still must capture the exact user-facing error.

The global server boundary is otherwise materially hardened: CSP, strict transport security, CORS allowlisting, API rate limiting, request size limits, origin checks, session validation, and audit logging are all wired before routes (`server/index.ts:54-102`, `server/index.ts:113-251`). The findings above should be fixed without discarding those controls.

## Test Health

Count reconciliation with Phase 0: the canonical baseline has **2,466 code-like files**—2,453 TypeScript/TSX, 8 Rust, and 5 CSS/HTML—and its conventional `__tests__` / `.test.*` / `.spec.*` classifier finds **874 test files**. That yields Phase 0's approximate 1,592 non-test code-like files and 0.55:1 ratio. Phase 4 narrows the denominator to TypeScript/TSX because its static `describe`/`it`/`test` declaration scan does not apply to Rust or styles: 2,453 minus the same 874 test files is **1,579**, or 0.5535. A broader directory-name classifier also counts `src-tauri/tests/command_manifest.rs`, producing 875 as seen in Phase 1. Phase 0 remains the canonical cross-language baseline; Phase 4's narrower figures describe the TS/TSX test corpus.

| Metric | Current value | Interpretation |
|---|---:|---|
| TS/TSX non-test files | 1,579 | Phase 4 denominator for the static test-declaration scan. |
| Conventional TS/TSX test files | 874 | Broad unit/integration corpus across legacy and engine. |
| TS/TSX test:non-test ratio | 0.5535 | Strong by file count; not proof of behavior or risk coverage. |
| Static test declarations | 31,360 | `describe`/`it`/`test`-style count across both product layers. |
| Latest root CI | 765 files; 31,247 passed; 2 skipped | Current-commit GitHub evidence, not a local rerun. |
| Latest Packages CI | Passed | Runs workspace typecheck/lint/tests, AI eval, CLI smoke, and editor build (`.github/workflows/packages-ci.yml:32-67`). |
| Root coverage gate | lines 60%, branches 50%, functions 55%, statements 60% | Broad floor only (`scripts/check-coverage.ts:16-19`, `.github/workflows/ci.yml:77-85`). |
| Graph coverage gate | aggregate 95/90/95/95; critical files 100% | Strong contract-package standard (`packages/graph/vitest.config.ts:9-22`). |
| Playwright in CI | 0 workflow references | Scripts/config exist, but neither main nor packages workflow runs them (`package.json:26-30`, `playwright.config.ts:3-49`). |
| Packaged desktop smoke | `continue-on-error`, currently skipped | It follows the failing supply-chain step (`.github/workflows/tauri-build.yml:141-177`). |

The two root-CI skips come from the database-backed migration parity suite being conditional on `MIGRATION_DRIFT_DB_URL` (`server/__tests__/migration-drift.test.ts:114-145`). A second conditional package suite covers real closed-loop cosimulation only when ADC support is present (`packages/cosim/src/quantum.loop.test.ts:296`, `packages/cosim/src/quantum.loop.test.ts:376-405`). Both need named CI lanes or explicit evidence artifacts; silently conditional critical integration coverage is not the same as a pass, and it cannot validate the real-project migration corpus or the proposed scenario/causal-trace workflows.

The test foundation is a strength. The missing layer is runtime-system proof: Playwright, production CSP execution, packaged desktop smoke, database migration parity, relay resource behavior, and real-device boundaries.

## Dependency and Supply-Chain Health

### Rust / Tauri

`cargo audit --file src-tauri/Cargo.lock --json` currently reports:

- `RUSTSEC-2026-0194`: `quick-xml@0.38.4`, quadratic duplicate-attribute checking; patched at `>=0.41.0`.
- `RUSTSEC-2026-0195`: `quick-xml@0.38.4`, unbounded namespace allocation; patched at `>=0.41.0`.
- 19 unmaintained warnings.
- 4 unsound warnings: `anyhow@1.0.102`, `glib@0.18.5`, `rand@0.7.3`, and `rand@0.8.5`.

`cargo tree --target all -i quick-xml@0.38.4` traces both blocking advisories through `quick-xml -> plist@1.8.0 -> tauri@2.10.3` and its plugins. This is not a failed platform build: all five packaging jobs completed, then Linux x64 failed at supply-chain checking. The latest eight listed Tauri runs are red, and three sampled failed logs show the same two advisories.

The supply-chain script says its exit code represents a high-or-greater advisory, but plain `cargo audit` blocks every vulnerability and exits before npm audit or either SBOM can run (`scripts/ci/supply-chain-check.sh:12-15`, `scripts/ci/supply-chain-check.sh:33-47`, `scripts/ci/supply-chain-check.sh:49-91`). A strict all-vulnerability policy is defensible; the code, comment, and reporting flow need to agree. Checks should aggregate results so a Rust failure does not hide npm and SBOM state.

### npm

Root manifests declare 100 production and 49 development dependencies (`package.json`). Current `npm audit --omit=dev --json` reports:

| Audit result | Count |
|---|---:|
| Critical | 0 |
| High affected package nodes | 5 |
| Moderate affected package nodes | 59 |
| Total affected package nodes | 64 |
| Production dependency nodes | 812 |

The five high nodes are in the Genkit/OpenTelemetry chain and currently have no npm-provided fix. The policy checker allows them only while their exact path remains no-fix and only through **2026-07-31** (`scripts/ci/npm-audit-allowlist.json:1-105`, `scripts/ci/check-npm-audit-policy.mjs:42-106`). The policy command passes today; it is a time-boxed exception, not a clean audit.

Direct affected dependencies are `@genkit-ai/google-genai`, `genkit`, and `js-yaml`. `js-yaml@4.1.1` has a fix available and enters the shipped engine through `@protopulse/content` (`packages/content/package.json:14`). `isomorphic-dompurify@3.9.0` brings `dompurify@3.4.0`, whose affected node also has a fix available (`package.json:116`). Every affected family needs either an upgrade, removal, constrained exposure with a time-boxed record, or an upstream-blocked record with a recheck date; “moderate” is not a disposal category.

Installed dependency mass is also concentrated: `googleapis` 196 MB, `@google-cloud` 142 MB, `@opentelemetry` 75 MB, `lucide-react` 44 MB, and `three`, `eecircuit-engine`, and `date-fns` 39 MB each. This is a developer-install cost and an architectural signal around the legacy Genkit/Google path, not a reason to remove useful dependencies by size alone.

## Performance and Build Artifacts

The current-commit Vite build passed in **19.37 seconds**, but emitted its `>500 kB` warning. The relevant minified JavaScript chunks were:

| Chunk | Raw | Gzip |
|---|---:|---:|
| `WebGLBoardViewer` | 1,026.77 kB | 281.16 kB |
| `CodeEditor` | 680.74 kB | 234.26 kB |
| main `index` | 629.06 kB | 185.20 kB |
| `react-vendor` | 393.58 kB | 127.37 kB |
| `BreadboardView` | 389.58 kB | 106.40 kB |

Evidence: [main CI build log](https://github.com/wtyler2505/ProtoPulse/actions/runs/29139503550). `vite.config.ts:75-96` provides hidden source maps and manually separates only the universal React chunk, relying on dynamic imports for the rest. Add bundle budgets and inspect the three over-500 kB chunks; do not flatten everything into one manual vendor chunk.

Local artifact sizes were `dist` 60 MB, `node_modules` 1.4 GB, and `src-tauri/target` **26 GB**. The current root `dist` predates the current commit, so it is not used as bundle truth; GitHub output above is. The Rust target size is local cache hygiene, not shipped application size, but it materially affects disk pressure and made an initially mis-scoped analysis command expensive.

## Architecture Gaps

### Performance

- Three current JavaScript chunks exceed Vite's warning threshold, led by a 1.03 MB board viewer. The build passes, so this is a budget and loading-path gap rather than a build failure.
- Large React closures combine data fetching, mutations, gesture state, clipboard, keyboard, geometry, and rendering. Their lizard spans are consistent with rerender/debugging risk even without a live performance trace.
- Relay per-frame caps are good, but aggregate memory is not bounded by room, client, time, or total bytes.

### Scalability

- Relay state and optional JSONL persistence have no total quotas or eviction. Empty rooms are explicitly retained (`packages/relay/src/server.ts:225-233`).
- The legacy app and 16-package engine remain two product and data paths. The importer exists, but the default flip and legacy retirement are still open (`ROADMAP.md:2113-2142`). Every new cross-cutting capability otherwise risks two implementations and two support contracts.
- The engine's proposed physical-system expansion must follow the compatibility gate. ADR-0017 is Proposed, and its stated op count is already stale; the live closed union is 35 named op schemas plus `batch` (`docs/adr/0017-physical-system-design-graph.md:1-6`, `packages/graph/src/ops.ts:312-360`).

### Security

- The Arduino command/path boundary, production CSP conflict, relay defaults/quotas, DOMPurify version, and autocomplete HTML sink are the actionable findings. They are mapped one-for-one in the companion checklist.
- Auth/CORS/CSP/input-size controls are real strengths and should remain regression-tested while those seams change.

### Testing

- Unit/integration volume is high. System proof is missing from required CI: no Playwright workflow, conditional database parity, conditional closed-loop cosim, fail-open packaged smoke, and no production-CSP test for the custom script features.
- Root coverage percentages are broad aggregate floors. Risk modules—auth, import/export, storage migration, shell/process boundaries, and graph compatibility—need path-specific gates like the graph package already uses.

### Code quality

- Complexity and size are concentrated, not uniform. The required decomposition set is the full hotspot/large-file inventory above, with different treatments for algorithms, stateful UI, and static data.
- ESLint warnings are intentionally hidden by `--quiet`; that makes incremental debt invisible. The duplicate `no-alert` definition proves config drift can silently weaken a rule.
- Raw browser/engine console use bypasses the existing redacting structured logger.

### Developer experience

- Project guidance explicitly says the package typecheck hook can report false clean after termination and the changed-test hook can miss package tests (`AGENTS.md:56-59`). A contributor should not need to remember which green signal is fictional.
- The 26 GB target cache and 1.4 GB dependency tree make broad local commands expensive on this workstation. CI is currently the trustworthy full-system executor.
- Phase 0's canonical snapshot recorded 389 commits in 30 days and 1,048 in 90 days. Phase 4's later rolling `--since` query at the same HEAD returned 388 and 1,040 because the time boundary advances while the commit does not; this is a measurement-clock difference, not repository activity. In the Phase 4 cut, the ESP32 source and test were touched in 159 and 168 90-day commits respectively, and `packages/parts/src/seed/index.ts` plus its test were each touched 49 times. High change frequency and high complexity occupy the same emulator boundary.
- The current main history has two author identities (Tyler and Claude), which is not evidence of two independent human maintainers. Ownership notes and decomposition boundaries should make the hotspots recoverable after another long absence.
- GitHub currently has no open bug-labeled issues and no open pull requests. The dense local backlog is therefore the actual work surface; GitHub quietness does not mean technical debt is empty.

## Ticking Time Bombs

This heading follows the audit template. Every item below is already represented in the checklist; it is not a shorter “only do these” list.

1. A normal graph vocabulary/version change can make saved data unreadable, and current browser boot can replace the unreadable value with a starter on a later flush. Version dispatch, unknown-op handling, assets, fixtures, and non-destructive recovery must land as one dependency group.
2. Arduino project-owner input reaches shell command strings and artifact paths. Adjacent code already proves `execFile` plus workspace-safe resolution is available; leaving the two exceptions creates avoidable command/path risk.
3. Tauri packaging is healthy but its release workflow has been red repeatedly since the quick-xml advisories appeared. Because the script fails fast, npm and SBOM state remain hidden on those runs.
4. The Genkit/OpenTelemetry high-advisory exception expires on 2026-07-31. Without an explicit recheck/removal/renewal decision, the next clean Rust run can become red at npm policy.
5. DRC scripting and circuit DSL rely on `Function` while production CSP explicitly forbids it. Weakening CSP would trade a functional bug for a security regression; the execution architecture must change.
6. Relay message limits do not bound aggregate rooms/logs, and default startup is open. Network deployment without quotas/auth would turn design sync into a resource-exhaustion surface.
7. The highest-change-frequency emulator files are also 9,475/13,408-line monoliths. Continued feature work without partitioning raises review and regression cost every time those files change, and directly slows scenario CI, device-model, causal-trace, and migration proving work.
8. A green local hook can mean “terminated” or “no package tests found.” That is a reliability defect in the development feedback loop, not merely documentation debt.

## Raw Tool Outputs

### `scc` trusted product scope

```text
Language                 Files     Lines   Blanks  Comments     Code Complexity
TypeScript                2451    869487   100095     88969   680423      98396
JSON                        41     17800       12         0    17788          0
TOML                        14       232       37        52      143          1
Rust                         8      1961      182       300     1479        144
Markdown                     5       512      105         0      407          0
CSS                          4      2457      332       398     1727          0
XML                          2         9        0         0        9          0
HTML                         1        17        0         0       17          0
Total                     2527    892476   100763     89720   701993      98541
```

`tokei` independently reported 2,528 files and 703,214 code lines (TSX 130,611; TypeScript 551,446). The small difference comes from language classification/counting, not scope drift.

### Actual `lizard --csv` excerpts

```text
744,459,5471,0,894,"(anonymous)@355-1248@client/src/components/circuit-editor/breadboard-canvas/index.tsx",...
368,253,3029,0,428,"(anonymous)@95-522@packages/app/src/editor/CanvasHost.tsx",...
503,204,4264,1,700,"runTransientAnalysis@553-1252@client/src/lib/simulation/transient-analysis.ts",...
123,97,1359,8,191,"stampNonlinearCompanions@340-530@client/src/lib/simulation/circuit-solver.ts",...
513,93,2517,1,730,"(anonymous)@281-1010@client/src/components/circuit-editor/PCBLayoutView.tsx",...
26,50,695,0,26,"sha256BlockInto@1069-1094@packages/emu/src/esp32s3.ts",...
239,43,1439,8,433,"isArchView@650-1082@server/ai.ts",...
58,23,520,23,75,"segmentToSegmentDistance@995-1069@shared/drc-engine.ts",...
```

### Security scans

```text
ast-grep direct eval(...) matches:       0
ast-grep `as any` matches:               1  client/src/lib/bindings.ts:62
rg explicit `any` source matches:        1  ProfileSettingsDialog.tsx:35
rg @ts-ignore / @ts-expect-error:         0
rg production private-key markers:       0  (one test-fixture match)
rg developer TODO comments:              5
rg browser/engine console calls:         22
rg `!.`-shaped non-null assertions:     118
```

Dangerous HTML/string execution locations found and manually classified:

```text
client/src/lib/arduino/autocomplete.ts:82             innerHTML (replace)
client/src/components/views/StorageManagerPanel.tsx:732  sanitized SVG sink
client/src/components/ui/chart.tsx:81                 developer-config CSS sink
client/src/lib/drc-scripting.ts:147                   Function syntax check
client/src/lib/drc-script-worker.ts:257               Function worker execution
client/src/lib/circuit-dsl/circuit-dsl-worker.ts:305  Function in blob worker
```

### Dependency audit summaries

```text
npm audit --omit=dev:
  critical 0, high 5, moderate 59, total affected nodes 64
  direct affected: @genkit-ai/google-genai, genkit, js-yaml
  policy result today: five high nodes allowed, no unapproved high/critical

cargo audit --file src-tauri/Cargo.lock:
  vulnerabilities 2: RUSTSEC-2026-0194, RUSTSEC-2026-0195
  warnings 23: 19 unmaintained, 4 unsound
```

### Git and artifact excerpts

```text
Phase 4 rolling snapshot at HEAD: 388 / 30 days; 1,040 / 90 days
Phase 0 earlier rolling snapshot at same HEAD: 389 / 30 days; 1,048 / 90 days
90-day file change frequency in the Phase 4 cut:
  168 packages/emu/src/esp32s3.test.ts
  159 packages/emu/src/esp32s3.ts
   71 packages/README.md
   49 packages/parts/src/seed/index.ts
   49 packages/parts/src/parts.test.ts

local artifacts:
  536K packages/cli/dist
   60M dist
  1.4G node_modules
   26G src-tauri/target
```
