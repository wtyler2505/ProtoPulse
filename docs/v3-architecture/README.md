# ProtoPulse v3 Architecture Draft

ProtoPulse v3 moves the product from a generic diagram editor toward an adversarial, agent-driven EDA platform.

The working model has four parts:

1. Visual Strategy: `tldraw` is the infinite canvas where humans and agents define hardware/software boundaries.
2. Circuit Compilation: `@tscircuit/core` turns canvas intent into strict circuit objects.
3. AI Orchestration: `genkit` handles model flow, multimodal parsing, and Gemini-backed context.
4. Execution Swarm: `@openai/agents` runs bounded workers for firmware, component generation, and checks.

This folder is a safe draft scaffold. It mirrors the proposed v3 shape without touching the current app runtime.

## Current Version Pins

These match the current ProtoPulse root `package.json`.

| Package | Version |
|---|---:|
| `react` | `^19.2.0` |
| `react-dom` | `^19.2.0` |
| `tldraw` | `^5.0.1` |
| `@tscircuit/core` | `^0.0.1255` |
| `@tscircuit/props` | `^0.0.534` |
| `genkit` | `^1.30.1` |
| `@genkit-ai/google-genai` | `^1.30.1` |
| `openai` | `^6.38.0` |
| `@openai/agents` | `^0.11.4` |
| `drizzle-orm` | `^0.45.2` |
| `zod` | `^3.25.76` |
| `vite` | `^7.1.9` |
| `tsx` | `^4.20.5` |
| `typescript` | `5.6.3` |
| `@vitejs/plugin-react` | `^5.0.4` |
| `drizzle-kit` | `^0.31.9` |

## Scaffold

The draft app shell lives in `protopulse-v3/`.

The most important rule: agents can transform verified data, but they cannot invent physical facts. Unknown dimensions, pinouts, footprints, voltages, or colors must stay unknown until verified from the ProtoPulse knowledge pipeline or a cited source.

## Validation

Run:

```bash
npx --no-install tsx docs/v3-architecture/protopulse-v3/scripts/validate-v3-architecture.ts
```

Expected behavior:

- Canvas boundaries parse.
- Boundaries compile into circuit node records.
- Firmware request validates.
- Missing hardware facts return `needs_verification`.
- Verified `tscircuit` draft elements emit TSX.
- Swarm manifests are checked for worker cap, claimed-file conflicts, unsafe paths, and missing hardware facts.
- AI flow drafts use Zod input/output contracts shaped like Genkit `defineFlow` schemas.
- The v3 shell shows a compact compile status panel over the canvas.
- The v3 shell includes a physical analysis dock wired to visual and layout inspection APIs.
- The v3 shell extracts `tldraw` shape metadata into boundary objects and previews them.
- Boundary metadata rules now validate required fields for hardware, firmware, power, signal, and mechanical boundaries.
- Canvas boundaries now compile into a `tscircuit` draft when every boundary is safe.
- The compiler supports board size, chips, connectors, power rails, nets, and traces.
- Hardware facts can be sourced from real ProtoPulse `docs/parts` and `knowledge` notes.
- Verified fact provenance now has a Drizzle/Postgres storage path.

The included sample intentionally verifies only `logic_voltage`, so the fact gate reports `pinout` and `usb_interface` as missing instead of inventing them.

The `tscircuit` draft path is intentionally stricter: it throws before emitting TSX if any element is not `verified`.

The sample also includes an unsafe capacitor draft marked `needs_verification`; validation confirms that draft is blocked.

Run a swarm plan check:

```bash
npx --no-install tsx docs/v3-architecture/protopulse-v3/scripts/orchestrate-swarm.ts docs/v3-architecture/protopulse-v3/examples/sample-swarm.json
```

The sample swarm intentionally blocks one component task because `pinout` is not verified.

Run the ready sample:

```bash
npx --no-install tsx docs/v3-architecture/protopulse-v3/scripts/orchestrate-swarm.ts docs/v3-architecture/protopulse-v3/examples/sample-swarm-ready.json
```

Run the one-file v3 compile gate:

```bash
npm --prefix docs/v3-architecture/protopulse-v3 run compile:check -- examples/sample-architecture.json
```

Render that compile gate as Markdown:

```bash
npm --prefix docs/v3-architecture/protopulse-v3 run compile:check -- examples/sample-architecture.json --markdown
```

Run the real ready sample end-to-end:

```bash
npm --prefix docs/v3-architecture/protopulse-v3 run validate:real-sample
```

That one returns `ready`.

Docs checked:

- Context7: `tldraw`
- Context7: `Genkit`
- Context7: `tscircuit`
- Context7: `tscircuit` programmatic render API
- Web: `https://developers.openai.com/codex/noninteractive`

Task 1 status:

- `multimodalDatasheetFlow` and `visualHardwareInspectionFlow` are real Genkit `defineFlow` exports.
- The flow bodies still use deterministic draft logic, so no live model call is required for validation.

Task 2 status:

- The main app already exposes `POST /api/projects/:id/hardware-inspection/visual`.
- The main app already renders `HardwareInspectionPanel`.
- The v3 shell now has a lightweight dock that calls that same visual inspection API.

Task 3 status:

- Added `embodiedLayoutAnalysisFlow` as a real Genkit `defineFlow` export in the v3 draft.
- Added a layout API client for `/api/projects/:id/hardware-inspection/layout`.
- Upgraded the v3 dock with Visual/Layout modes.

Task 4 status:

- Added `extractBoundariesFromTldrawShapes`.
- Uses `shape.meta.protopulse` for v3 boundary metadata.
- The v3 shell now shows extracted boundaries in a preview panel.

Task 5 status:

- Added `boundaryRules` for all five boundary kinds.
- Added rule evaluation to the validator.
- The boundary preview panel now shows ready/missing metadata state.

Task 6 status:

- Added `compileCanvasBoundariesToTscircuit`.
- The compiler consumes extracted boundaries and rule results.
- The compile status panel now shows blocked reasons or emitted TSX preview.

Task 7 status:

- Added compiler output for `chip`, `connector`, `powerRail`, and `trace`.
- Added board size metadata support from mechanical boundaries.
- Added element-kind summary to the compile status panel.

Task 8 status:

- Added `loadVerifiedHardwareFacts`.
- The validator now sources Mega 2560 facts from the real ProtoPulse notes.
- The v3 shell includes a verified facts panel.

Task 9 status:

- Added `v3_provenance_events` Drizzle table.
- Replaced the in-memory verified fact map with DB-shaped insert/select operations.
- Added SQL DDL for the provenance table.

Task 10 status:

- Added Drizzle tables for verified facts, compile runs, swarm tasks, and inspection reports.
- Added SQL DDL coverage for the four architecture storage tables.
- Added a v3 shell storage panel so the UI shows which architecture tables are ready.

Task 11 status:

- Added a verified emission gate: blocked compile results do not emit final TSX.
- Added hard test coverage for blocked compile output and unverified fact input.
- Added a v3 shell no-emit proof panel so blocked output is obvious in the UI.

Task 12 status:

- Added bad-case swarm tests for unsafe paths, duplicate claimed files, and more than 6 workers.
- Added a bad swarm fixture that trips all three safety gates.
- Added a v3 shell swarm safety panel so blocked swarm reasons are visible.

Task 13 status:

- Added `npm run compile:check -- <json-file>`.
- The command loads one v3 JSON file, checks hardware facts, extracts tldraw boundaries, runs rules, compiles, and only emits TSX when ready.
- Added a v3 shell command panel that shows the exact compile-check command.

Task 14 status:

- Added a v3 compile report schema with accepted facts, missing facts, blocked tasks, and emitted TSX.
- The one-file CLI now returns the report as JSON, with optional Markdown output.
- Added a v3 shell compile report panel with report counts and TSX emission state.

Task 15 status:

- Added guarded OpenAI Agents dispatch wiring after swarm planning.
- Blocked swarm plans return zero dispatches; ready plans create dry-run dispatch records unless execution is explicitly enabled.
- Added a v3 shell OpenAI dispatch panel so the dispatch gate is visible.

Task 16 status:

- Added Codex CLI command templates for ready swarm tasks.
- Templates use `codex exec`, `--sandbox workspace-write`, and `--output-schema`.
- Added a v3 shell Codex templates panel so blocked/ready command generation is visible.

Task 17 status:

- Added an Arduino/C++ firmware output contract.
- The contract requires at least one `.ino` sketch file and validates firmware files, board, FQBN, libraries, pins, and notes.
- Added a v3 shell firmware contract panel so sketch/file/pin state is visible.

Task 18 status:

- Added board/pin ownership checks before firmware generation.
- Firmware now blocks when `pinout` is not verified, no pins are claimed, or duplicate pins are claimed.
- Added a v3 shell pin ownership panel so firmware blockers are visible.

Task 19 status:

- Added real `@tscircuit/core` render proof using `Circuit`, `renderUntilSettled`, and `getCircuitJson`.
- Added a render proof test that checks real Circuit JSON is produced.
- Added a v3 shell tscircuit proof panel showing rendered Circuit JSON count and types.

Task 20 status:

- Decided v3 coexists with the current `@xyflow/react` Architecture view first, then replaces it after migration gates pass.
- Added ADR-0001 with the decision, gates, consequences, and next step.
- Added a v3 shell architecture decision panel so the replacement stance is visible.

Task 21 status:

- Added a migration adapter from current Architecture nodes/edges to v3 tldraw shapes.
- Added a migration plan document with source fields, target shape rules, gates, and rollout.
- Added a v3 shell migration panel showing migrated node/edge/shape counts.

Task 22 status:

- Added a dedicated blocked/ready compile gate UI.
- The gate shows boundary metadata, hardware facts, pin ownership, and final TSX emission state.
- The validator now reports whether the full compile gate is ready.

Task 23 status:

- Added visual/layout inspection report storage shape through the v3 inspection reports table and DB operation.
- The v3 shell now stores the latest inspection reports in local report history.
- Visual and layout results now render as styled Markdown instead of raw preformatted text.

Task 24 status:

- Added `examples/real-sample-project.json` as a ready sample project.
- Added `npm run validate:real-sample` for end-to-end validation across facts, boundaries, compile, pin ownership, swarm, Codex templates, OpenAI dry-run, report output, and tscircuit render proof.
- Added a v3 shell real-sample validation panel with the command.

Task 25 status:

- Decided v3 leaves `docs/v3-architecture` only after real-sample, migration, report, compile-state, and Tyler UI verification gates pass.
- Added ADR-0002 with the live-app entry decision and first live step.
- Added a v3 shell live entry gate panel so the live-app move criteria are visible.
