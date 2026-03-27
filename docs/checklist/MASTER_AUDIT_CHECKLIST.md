# ProtoPulse Master Audit Checklist

Date: 2026-03-22  
Auditor: Codex  
Scope: frontend, backend, shared domain logic, workflows, route surface, tabs/screens, feature gaps, improvements backlog

## 1. Executive Summary

Scope correction:
- This document is a working audit ledger, not a completed proof that every surface in ProtoPulse has already been fully exercised.
- It mixes fresh browser checks, fresh code inspection, and prior audit material already in the repo.
- Anything not explicitly marked `Live verified now` should be read as `needs more verification`, even if it looks implemented in code.

ProtoPulse is already a very large, ambitious product surface with substantial implementation breadth. The codebase currently contains:

- `1550` TypeScript/TSX source files across `client/`, `server/`, and `shared/`
- `543` test files
- roughly `689,167` lines across TS/TSX sources
- `32` main REST route modules
- `15` circuit route modules
- `20` AI tool modules
- `33` view components
- `107` source files at `>= 1000` lines

The project is feature-rich enough that the main risks are no longer “missing everything.” The bigger risks are:

- correctness drift between UI promises and real backend behavior
- oversized monolith files and hotspots that make regressions easier to introduce
- partial feature truthfulness, where a feature exists but is only partly real, partly simulated, or unevenly wired
- verification gaps, especially around end-to-end route coverage, account/ownership boundaries, and repo-wide typecheck/build fitness

## 2. Audit Method

This checklist combines three evidence sources:

### Fresh code inspection
- app shell/routing
- workspace layout and tab model
- backend route/middleware surface
- shared engines and large-file hotspots

### Fresh live verification
- `/projects`
- `/projects/18/component_editor`
- `/projects/18/viewer_3d`
- `/projects/18/procurement`
- HMR/CSP/runtime stability after current fixes

### Existing repo audits used as inputs
- `docs/audits_and_evaluations_by_codex/zz_master_findings_rollup.md`
- `docs/qa-audit/MASTER-REPORT.md`
- `docs/product-analysis-checklist.md`
- `docs/app-audit-checklist.md`
- `docs/frontend-audit-checklist.md`
- `docs/backend-audit-checklist.md`
- `docs/audit-v2-checklist.md`

## 3. Current State Verdict

### What is in good shape
- The app has broad functional coverage across architecture, schematic, PCB, simulation, export, Arduino, collaboration, and AI tooling.
- The route/tab model is broad and coherent on paper.
- The test surface is unusually large for a product at this stage.
- The workspace is now stable again after the CSP/HMR/project-route fixes.
- Recent ownership hardening has improved the project route surface.

### What still needs serious work
- Repo-wide verification is not yet “green enough” to claim complete operational confidence.
- There is still a lot of monolithic code concentrated in critical interaction layers.
- Audit history strongly suggests some security and tenant-scope findings likely remain open outside the routes fixed in this pass.
- Native-desktop intent and browser-era architecture are still mixed together in ways that create conceptual drift.
- Broad workflow coverage is still incomplete; several tabs and route/button paths remain unverified in the current pass.

## 4. Fresh Verification Results

### Live verified now
- `/projects` loads correctly
- direct deep link to `/projects/18/component_editor` now renders correctly
- direct deep link to `/projects/18/viewer_3d` now renders correctly
- direct deep link to `/projects/18/procurement` now renders correctly and remains stable
- `/projects/18/validation` now renders correctly and remains stable
- `/projects/18/output` now renders correctly and remains stable
- `/projects/18/design_history` now renders correctly and remains stable
- `/projects/18/comments` now renders correctly and remains stable
- `/projects/18/arduino` now renders correctly and remains stable
- `/projects/18/circuit_code` now renders correctly and remains stable
- `/projects/18/serial_monitor` now renders correctly and remains stable
- `/projects/18/storage` now renders correctly and remains stable
- `/projects/18/ordering` now renders correctly and remains stable
- `/projects/18/lifecycle` now renders correctly and remains stable
- `/projects/18/knowledge` now renders correctly and remains stable after hydration
- `/projects/18/community` now renders correctly and remains stable after hydration
- `/projects/18/digital_twin` now renders correctly and remains stable
- `/projects/18/generative_design` now renders correctly and remains stable
- `/projects/18/design_patterns` now renders correctly and remains stable
- `/projects/18/simulation` now renders correctly and remains stable
- `/projects/18/audit_trail` now renders correctly and remains stable
- Vite HMR connects cleanly on port `5000`
- old CSP report-only noise is gone
- old `/vite-hmr` websocket failures are gone
- old `localhost:5173` fallback websocket noise is gone
- old `504 Outdated Optimize Dep` failures are gone
- Architecture interactions verified live:
  - `/projects/18/architecture` loads cleanly with the real canvas, asset library, and `Analyze design` drawer
  - selecting `ESP32-S3-WROOM-1` and closing the analysis drawer reveals a real `Node Properties` inspector
  - adding `BME280` from the asset library mutates the graph from `2` nodes to `3`
  - the docked `Design Suggestions` panel appears after that graph mutation
  - accepting `Add a power indicator LED` now creates a correctly labeled `Power LED` node instead of `undefined led`
  - the follow-on recommendation now reads `Add current limiting resistor for Power LED`
  - accepting that resistor suggestion creates `330R resistor`
  - the sample project architecture was restored to its original two-node state after the verification pass
- Procurement interactions verified live:
  - `Add Item` opens the `Add BOM Item` dialog
  - `Compare Suppliers` opens the comparison dialog
  - `AVL Compliance` tab renders to its empty state
  - `BOM Comparison` tab renders to its empty state
- Validation interactions verified live:
  - `System Validation` screen renders issue counts and control sections
  - clicking the `Validation` tab from `/projects/18/community` immediately updates the route to `/projects/18/validation`
  - `Run DRC Checks` triggers `POST /api/projects/18/validation`, increments the visible issue count from `130` to `131`, and surfaces `Validation Running`
  - opening `Floating Inputs` in the troubleshooter reveals a real detail view with symptoms, root cause, fix steps, and related issues
  - `Back to list` returns the troubleshooter to the issue catalog cleanly
  - `Custom Rules` opens a real `Custom DRC Rules` dialog with sandboxed-script controls
  - the `Custom DRC Rules` dialog dismisses via its explicit `Close` button
  - no fresh browser warnings/errors appeared during the validation pass
- Export interactions verified live:
  - `EXPORT CENTER` renders populated categories and formats
  - `Download Firmware Scaffold` opens a real export precheck panel
  - the precheck panel dismisses cleanly
  - `Export SPICE` from the Simulation panel initially reproduced a real `500`, was fixed server-side, and now completes successfully with `Export Complete`
- History interactions verified live:
  - the onboarding hint dismisses cleanly
  - the empty-state `Design Version History` screen renders with `Save Snapshot`
  - `Save Snapshot` opens a real save dialog with required-name validation
  - saving `Audit Snapshot 1` moves the screen from `0 snapshots` to `1 snapshot` and renders the new row
  - saving a snapshot surfaces `Snapshot saved`
  - `Compare to Current` renders `No differences found` for the freshly created snapshot
  - the delete confirmation can be dismissed without deleting the snapshot
- Comments interactions verified live:
  - existing comment data hydrates after a brief loading state
  - `Reply` opens reply mode with a reply textbox
  - reply mode cancels cleanly
- Arduino interactions verified live:
  - the real `Arduino Workbench` renders
  - `New file` opens the `New Sketch File` dialog
  - the dialog accessibility warning was reproduced, fixed in code, and reverified as gone
  - `/projects/18/starter_circuits` renders populated starter templates
  - expanding `Servo Sweep` reveals the expected detail sections and full sketch
  - `Open Circuit` now routes into Arduino, creates `Servo_Sweep.ino`, and opens it in the editor
  - reopening the same starter sketch succeeds without recreating duplicate file rows
- Circuit Code interactions verified live:
  - the starter DSL now evaluates on first load
  - the preview resolves to `R1` / `10k` and the status bar shows `1 components` / `2 nets`
  - `Apply to Project` is enabled on first load and succeeds with `POST /api/projects/18/circuits/apply-code -> 200`
- Schematic interactions verified live:
  - `/projects/18/schematic` now renders the real schematic editor with toolbar, parts panel, canvas, `Push to PCB`, and `Add Component`
  - dragging `ATtiny85` onto the canvas creates `U1`, enables `Push to PCB`, and surfaces `Add U1 to BOM?`
  - the previously broken nested route `GET /api/projects/18/circuits/5` now returns `200` after the auth-middleware fix and fresh dev-server restart
  - selecting `U1` and pressing `Delete` restores the empty schematic and disables `Push to PCB` again
  - `Add Component` opens the real searchable overlay and it closes cleanly with `Escape`
  - clicking `Place ATtiny85 on schematic` from the overlay creates `U1`
  - pressing `Enter` from the focused overlay also creates `U1` and hits `POST /api/circuits/5/instances -> 201`
  - `Push to PCB` opens a real confirmation dialog, confirming it surfaces `Pushed to PCB`
  - `/projects/18/pcb` shows `U1` after that push, and deleting `U1` from the schematic then revisiting `/projects/18/pcb` restores `Empty PCB Board`
- Serial Monitor interactions verified live:
  - dismissing the onboarding hint no longer crashes the route into the workspace error boundary
  - the disconnected-state monitor renders real board, baud, and line-ending selectors plus DTR/RTS toggles and monitor controls
  - the final rerun left the browser console free of fresh warnings/errors
- Task Board interactions verified live:
  - a persisted audit task was present at the start of the fresh pass, confirming real localStorage-backed board state
  - editing that task updates title, description, priority, tags, and assignee on the rendered card
  - adding tags and assignee enables the extra filter controls
  - filtering by assignee `Tyler` preserves the matching task, while a non-matching priority filter (`Low`) hides it and drives visible column counts to `0`
  - `Clear` restores the unfiltered board
  - deleting the persisted task restores the `0 tasks` baseline and reload preserves the empty board
- Calculators interactions verified live:
  - the real `Engineering Calculators` screen renders
  - dismissing the onboarding hint works
  - `Ohm's Law` with `5 V` and `20 mA` returns `250 Ω` and `100 mW`
  - `Apply to Component` on that Ohm's Law result copies `250 Ω` to the clipboard and surfaces the real `Copied to clipboard` toast
  - `Add to BOM` on that Ohm's Law result initially reproduced a real `400` caused by the BOM API expecting string-form numeric input for `unitPrice`
  - after patching the shared BOM insert schema and restarting the dev server, the exact same `Add to BOM` click succeeds and surfaces `Added to BOM`
  - a fresh authenticated API probe immediately after the rerun showed `GET /api/projects/18/bom -> total: 1` with `Resistor 250 Ω (from Ohm's Law calculator)` and normalized `unitPrice: "0.0000"` / `totalPrice: "0.0000"`
  - a fresh authenticated API probe also confirmed `PATCH /api/projects/18/bom/6` accepts numeric `unitPrice: 0.25`, returns `200`, and normalizes to `unitPrice: "0.2500"` / `totalPrice: "0.2500"`
  - cleanup deleted the temporary BOM row and restored the sample project back to `0` BOM items
  - the default `LED Resistor` inputs return `150 Ω` and `60 mW`
  - the default forward `Voltage Divider` inputs return `2.5 V`, `50.0%`, and `250 µA`
- Labs interactions verified live:
  - the real `Lab Templates` screen renders with populated lab cards
  - dismissing the onboarding hint works
  - opening `LED Circuit Basics` reveals objectives, steps, hints, and grading criteria
  - `Start Lab` switches the view into tracked progress mode
  - completing the first step advances progress to `1/5` and `20%`
  - reloading after progress advances preserves the updated step count in both the detail view and the card list
  - `Reset` returns the lab to the pre-start state
  - reloading after `Reset` preserves the cleared state and leaves `localStorage['protopulse-lab-sessions']` empty again
- Tasks interactions verified live:
  - the real `Task Board` screen renders in an empty-state sample project
  - `Add task` opens a real create dialog and submit stays disabled until a title is entered
  - creating a task persists it to the board and increments the total task count
  - moving the new task from `Backlog` to `To Do` updates the column counts correctly
- Simulation interactions verified live:
  - the earlier `Run DC Operating Point` `404` is no longer reproduced after the simulation contract fix
  - the sample project currently has one circuit shell and zero placed circuit instances
  - `Start Simulation` and `Run DC Operating Point` are disabled on that empty circuit
  - opening `Results` shows a clear “Nothing to simulate yet” message
  - `Add Probe` expands real editable probe controls
  - `Share` copies successfully and surfaces `Simulation link copied`
- Inventory interactions verified live:
  - the real `Storage Manager` screen renders
  - `Scan` opens the `Barcode Scanner` dialog
  - the scanner dialog closes cleanly
  - with a temporary seeded BOM item, the non-empty inventory path renders a grouped `Bin A1` section, `3 / 5` quantity readout, `Critical` status, and a visible low-stock count
  - `Labels` opens a real print workflow with selection and preview controls
  - preview renders the selected part label correctly
  - a browser probe confirmed `Print 1 Label` reaches `window.open()`, writes printable HTML, focuses the print window, and invokes `print()`
  - cleanup restored the project back to the empty inventory baseline
- Ordering interactions verified live:
  - `Order PCB` step 1 renders the board specification form
  - `Next` advances to `Select Fab` in the current pass
  - `Select Fab` renders real fabricator compatibility cards
  - selecting `JLCPCB`, running DFM, and advancing through `Quotes` to `Summary` all work
  - the quote table is populated with deterministic client-side pricing (`JLCPCB` best at `$27.00` grand total for the default `5` boards)
  - clicking `Place Order` creates a `submitted` order in `localStorage['protopulse-pcb-orders']` with embedded DFM and quote data
  - a browser fetch/XHR probe stayed empty through the full quote/place-order flow, and the backend `GET /api/projects/18/orders` remained empty, so the current route is not using the server-side ordering API
  - the fabricator API-key panel can store/remove a fab key through `/api/settings/api-keys`, but order placement does not depend on that key and still remains local-only
  - cleanup removed the temporary local order and restored the route to its baseline state
  - the empty `Design Suggestions` overlay no longer covers the lower-right action area
- Audit Trail interactions verified live:
  - direct navigation now stays on `/projects/18/audit_trail`
  - the desktop `Audit Trail` tab remains selected on the direct deep link
  - expanding `Motor Controller` reveals structured field diffs
  - searching `ATmega` filters the list to `1 entry (filtered from 5)` and exposes `Clear`
  - setting both date inputs to `2026-03-15` through `2026-03-16` reduces the list to `0 entries (filtered from 5)` and shows the empty state
  - `Clear` restores the baseline `5 entries`
  - `Export CSV` generates a blob download named `audit-trail-2026-03-23.csv`; a fresh instrumentation pass observed `URL.createObjectURL()` plus anchor download click with `text/csv;charset=utf-8;` payload
- Lifecycle interactions verified live:
  - the onboarding hint dismisses cleanly
  - `Add Component` opens the lifecycle tracking dialog
  - the lifecycle dialog closes cleanly via keyboard escape
  - creating a temporary lifecycle entry is a real persisted server mutation; the table and summary cards update immediately and the same record is present after reload
  - editing that entry is also real; changing it to `EOL` surfaces the attention banner and persists after reload
  - `Export CSV` produces a real blob download named `lifecycle-report-2026-03-23.csv`
  - deleting the temporary entry restores the empty baseline in both the UI and the API
- Learn interactions verified live:
  - the route/tab selection resolves correctly to `/projects/18/knowledge`
  - after hydration, `Electronics Knowledge Hub` renders with article count, search, filters, and article cards
- Community interactions verified live:
  - the route/tab selection resolves correctly to `/projects/18/community`
  - after hydration, `Community Library` renders with populated library content
  - the default `Browse` tab shows a populated catalog with real search and filter controls
  - the `Featured` tab opens and reveals populated featured, trending, and new-arrivals sections
  - opening `USB-C Connector Module` reveals the real detail view and `Download Component`
  - clicking `Download Component` increments the local download count but does not create a blob, anchor download, fetch, or XHR, so it is currently not a real download/export workflow
  - `Collections` opens correctly and `New` creates a persisted collection
  - post-submit DOM checks show the create dialog really does close; the earlier contrary impression came from a stale click snapshot
  - the current UI exposes no live add/remove/delete collection controls even though the data layer implements them
  - cleanup restored the library back to zero collections after the audit pass
- 3D View interactions verified live:
  - `/projects/18/viewer_3d` loads cleanly with the real `3D Board Viewer`
  - camera-angle controls are live; switching from `Iso` to `Front` updates the active selection
  - editing board dimensions from `100 x 80 x 1.6` to `120 x 90 x 2` and pressing `Apply` updates the inline board label and the side-panel dimensions card
  - toggling `Top Copper` changes the live layer checkbox state and can be restored cleanly
  - `Export` generates a blob download named `board-3d-scene.json`; a fresh instrumentation pass observed `URL.createObjectURL()` and anchor-download click with `application/json` payload
  - the board dimensions and layer state were restored to the original baseline after verification
  - no fresh browser warnings/errors appeared during the 3D View pass
- Patterns interactions verified live:
  - the route/tab selection resolves correctly to `/projects/18/design_patterns`
  - filtering with `divider` reduces the pattern count to `1 of 10` and keeps `Voltage Divider` visible
  - applying the `Signal` category filter keeps the filtered results coherent
  - `My Snippets` renders a populated snippet library with the expected `5 of 5` baseline
  - `Create` opens a real dialog, creating a temporary snippet increments the count to `6 of 6`, and the dialog closes cleanly after save
  - expanding the temporary snippet reveals `Edit`, `Delete`, and `Duplicate`
  - `Delete` opens a real confirmation dialog and removes the temporary snippet, returning the library to `5 of 5`
- AI chat interactions verified live:
  - the `Project Summary` quick action sends a real prompt
  - the chat panel shows a live analyzing state before the response lands
  - the assistant returns a real summary plus follow-up actions like `Run Validation`, `Optimize BOM`, and `Help me fix these issues`
- Global shortcuts interactions verified live:
  - pressing `?` with workspace focus opens the `Keyboard Shortcuts` overlay
  - pressing `?` with the chat textarea focused inserts `?` into the input and does not open the overlay
- Digital Twin interactions verified live:
  - the empty-state `No device` screen renders correctly
  - `Connect` is enabled and a controlled runtime probe confirmed it reaches `navigator.serial.requestPort()` with real user activation
  - canceling that port request shows the expected `No port selected` toast
  - `Generate Firmware` opens the real dialog
  - the firmware dialog exposes real board, baud-rate, sample-rate, and pin-configuration controls
  - `Generate Sketch` produces firmware output from defaults
  - adding a pin and regenerating updates the generated code with pin-specific output
  - the firmware dialog closes cleanly
- Generative interactions verified live:
  - `/projects/18/generative_design` route/tab selection resolves correctly
  - clicking `Generate` with an empty description still produces a candidate list in the current pass
  - that blank-input generate pass did not emit any fresh XHR/fetch request in the live network log
  - `Compare` expands a visible diff against the current design and surfaced `1 component added` / `ADDED D101`
  - `Export` generates a blob download named `candidate-cand-b171216f.json`; a fresh instrumentation pass observed `URL.createObjectURL()` plus anchor download click with `application/json` payload

### Live failures verified now
- no fresh live runtime failure is currently reproduced in the Procurement route after the route-sync fix
- the Architecture route still emits a fresh React Flow parent-container sizing warning in the current pass
- ~~Generative currently accepts an empty circuit description~~ **FIXED (Wave 155)**: Generate button now disabled when description is empty
- ~~the Design History snapshot delete trigger is currently an unlabeled icon-only button~~ **FIXED (Wave 155)**: added aria-label with snapshot name
- ~~AI follow-up chips are still only partially verified~~ **FIXED (Wave 155)**: AI action execution pipeline repaired — streaming tool calls now captured in `allToolCalls` via three-tier extraction (finalResponse.request.messages, finalResponse.messages, fallback re-execution)
- ~~AI navigation via chat is also currently unreliable~~ **FIXED (Wave 155)**: same AI action pipeline fix — `switch_view` actions from Genkit tools now reach client for execution
- Generative currently appears to be largely local/mock: the blank-input generate pass made no fresh network request, and the current client implementation runs from an in-browser engine seeded with `defaultBaseCircuit()`
- Design Patterns currently stops at library management: fresh live UI and code inspection both show `Create`, `Edit`, `Delete`, and `Duplicate`, but no action to place/import a pattern or snippet into Schematic or Architecture
- the `Custom DRC Rules` dialog showed a fresh keyboard-dismiss gap: pressing `Escape` left it open, while the explicit `Close` button dismissed it
- ~~Breadboard integration gap~~ **FIXED (Wave 155)**: auto-placement assigns breadboard coordinates on mount; wire sync now calls `syncSchematicToBreadboard()` to create missing breadboard wires from schematic net segments
- Schematic/PCB still have meaningful verification gaps even after the latest pass: richer wiring/net editing, multi-component edits, and manufacturing/export parity are still not fully replayed in the current session
- ~~automated BOM route regression remains weaker~~ **FIXED (Wave 155)**: `bom-routes.test.ts` passes 15/15 — the `baseUrl` issue was transient
- this should not be over-read as “Procurement fully verified”; it only means the previously reproduced route-loop defect is no longer reproducing in the current pass

### Verified by fresh code inspection
- app shell routes are defined in [client/src/App.tsx](/home/wtyler/Projects/ProtoPulse/client/src/App.tsx)
- tab definitions and labels are centralized in [client/src/components/layout/sidebar/sidebar-constants.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/layout/sidebar/sidebar-constants.ts)
- project bootstrap gating now prevents project-scoped provider floods in [client/src/lib/project-context.tsx](/home/wtyler/Projects/ProtoPulse/client/src/lib/project-context.tsx)
- project-route URL/view synchronization was corrected in [client/src/pages/ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx)
- workspace/global shortcut guards now share a stronger editable-context check in [client/src/lib/keyboard-shortcuts.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/keyboard-shortcuts.ts) and [client/src/pages/ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx)
- collaboration websocket upgrades are now path-scoped in [server/collaboration.ts](/home/wtyler/Projects/ProtoPulse/server/collaboration.ts)
- architecture suggestion `add_component` actions are now normalized in [client/src/lib/prediction-actions.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/prediction-actions.ts) before node creation in [client/src/pages/ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx)
- snippet form lifecycle is now synchronized correctly in [client/src/components/views/DesignPatternsView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/DesignPatternsView.tsx)
- circuit-code starter evaluation is now kicked off from [client/src/components/views/CircuitCodeView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/CircuitCodeView.tsx), and the DSL worker in [client/src/lib/circuit-dsl/circuit-dsl-worker.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/circuit-dsl/circuit-dsl-worker.ts) now accepts both explicit and shorthand builder styles
- the history delete affordance is currently defined in [client/src/components/views/DesignHistoryView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/DesignHistoryView.tsx) as a ghost icon button with no accessible name
- the desktop audit-trail route is now represented in [client/src/components/layout/sidebar/sidebar-constants.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/layout/sidebar/sidebar-constants.ts) and [client/src/lib/sidebar-groups.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/sidebar-groups.ts), matching the existing `ViewMode` and prefetch/tutorial metadata
- the current 3D viewer screen is implemented in [client/src/components/views/BoardViewer3DView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/BoardViewer3DView.tsx)
- the current Generative screen is implemented in [client/src/components/views/GenerativeDesignView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/GenerativeDesignView.tsx) and drives an in-browser engine from [client/src/lib/generative-design/generative-engine.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/generative-design/generative-engine.ts)
- AI client-action execution is wired in [useActionExecutor.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/chat/hooks/useActionExecutor.ts) and [navigation.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/chat/hooks/action-handlers/navigation.ts); **Wave 155 fix**: [server/ai.ts](/home/wtyler/Projects/ProtoPulse/server/ai.ts) now captures streaming tool calls in `allToolCalls` via three-tier extraction — actions flow from server to client
- prediction rules in [client/src/lib/ai-prediction-engine.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/ai-prediction-engine.ts) still include non-`add_component` action types such as `open_view` and `show_info`, but those branches remain only code-inspected in the current audit wave
- the Serial Monitor route consumes [client/src/lib/arduino/serial-logger.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/arduino/serial-logger.ts) through [client/src/components/panels/SerialMonitorPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/SerialMonitorPanel.tsx), and the latest fix now caches the external-store snapshot instead of returning a fresh object every read
- breadboard rendering is currently gated by `breadboardX` / `breadboardY` in [client/src/components/circuit-editor/BreadboardView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/circuit-editor/BreadboardView.tsx), while [client/src/lib/circuit-editor/view-sync.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/circuit-editor/view-sync.ts) contains schematic/breadboard sync helpers that are not currently wired into the live route

### Not fully verified in this pass
- full repo `npm run check`
  - `timeout 120s npm run check` exited with code `124`
  - this is a real verification gap
- full `npm test`
- all 30+ workspace tabs and all button paths from a fresh live click-through in this exact pass
  - prior QA audit covers much of this, but not every surface was re-clicked in this pass
- real hardware attach/telemetry verification in Digital Twin
- route-by-route backend ownership enforcement across every module
- button-by-button validation across every workspace surface

## 5. Existing Audit Baseline

### Prior code audit rollup
The Codex rollup at `docs/audits_and_evaluations_by_codex/zz_master_findings_rollup.md` reported:

- `293` total findings
- `25` P0
- `126` P1
- `117` P2
- `25` P3

That rollup remains important because it covered the whole codebase by section, even though it was code-inspection-only and not a runtime pass.

### Prior QA browser audit
The QA report at `docs/qa-audit/MASTER-REPORT.md` reported:

- `15/15` UI sections passing after fixes
- zero critical remaining in that audit set

That report is useful, but it should not be treated as permanent truth. The app is moving fast enough that those validations need periodic refreshes.

## 6. Codebase Hotspots

The strongest maintainability smell in the current codebase is file-size concentration.

### Critical monolith hotspots
- [client/src/lib/design-import.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/design-import.ts) `2724` lines
- [client/src/components/circuit-editor/SchematicCanvas.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/circuit-editor/SchematicCanvas.tsx) `1892` lines
- [client/src/lib/standards-compliance.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/standards-compliance.ts) `1749` lines
- [shared/error-taxonomy.ts](/home/wtyler/Projects/ProtoPulse/shared/error-taxonomy.ts) `1674` lines
- [client/src/components/simulation/SimulationPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/simulation/SimulationPanel.tsx) `1654` lines
- [server/export/gerber-generator.ts](/home/wtyler/Projects/ProtoPulse/server/export/gerber-generator.ts) `1598` lines
- [client/src/components/views/ArduinoWorkbenchView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx) `1588` lines
- [client/src/components/views/ValidationView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ValidationView.tsx) `1540` lines
- [shared/drc-engine.ts](/home/wtyler/Projects/ProtoPulse/shared/drc-engine.ts) `1519` lines
- [server/export/kicad-exporter.ts](/home/wtyler/Projects/ProtoPulse/server/export/kicad-exporter.ts) `1458` lines
- [server/ai-tools/circuit.ts](/home/wtyler/Projects/ProtoPulse/server/ai-tools/circuit.ts) `1455` lines
- [client/src/pages/ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx) `1372` lines

### Structural conclusion
`107` source files are `>= 1000` lines. That is too many. It raises the cost of:

- onboarding
- safe edits
- root-cause tracing
- targeted tests
- confidence in “small” changes

## 7. Architecture and Platform Assessment

### Strengths
- clear separation of `client`, `server`, and `shared`
- good use of shared domain types and engines
- strong route modularization on the backend
- broad feature decomposition at the directory level

### Weaknesses
- some runtime-critical layers are still effectively monolithic
- the product vision has pivoted to native desktop, but major app assumptions still center on Express/Vite/browser semantics
- feature breadth is outpacing “truth alignment,” meaning some surfaces are richer than the verification discipline behind them

### Strategic architecture recommendation
ProtoPulse needs a “truth pass” more than a “feature pass” in the next phase:

- define which features are production-real
- define which are experimental
- define which are simulated or placeholder
- mark them visibly in UI and tests

## 8. Frontend Audit

### App shell and routing
Status: mostly healthy, recently stabilized

Strengths:
- simple top-level routing in [client/src/App.tsx](/home/wtyler/Projects/ProtoPulse/client/src/App.tsx)
- auth gating is straightforward
- embed flow is isolated cleanly

Concerns:
- project picker and deep-link behavior have regressed before, which suggests this area needs permanent regression coverage
- eager localStorage/theme/GPU bootstrap logic increases first-load surface area before React fully owns the page

Recommendations:
- add browser tests for route matrix: `/`, `/projects`, `/projects/:id/:view`, `/embed/*`, and unknown routes
- explicitly test stale `lastProject` behavior across logout/login/account switch

### Workspace frame and navigation
Status: high complexity, currently functioning, high regression risk

Strengths:
- centralized nav model in [sidebar-constants.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/layout/sidebar/sidebar-constants.ts)
- broad view coverage
- active-view routing now behaves more safely after the sync fix

Concerns:
- [ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx) is still a hotspot
- 30+ tabs in a single frame is powerful but easy to mis-wire
- state sync between URL, localStorage, context, and view mount order is fragile

Recommendations:
- split `ProjectWorkspace` into:
  - frame shell
  - routing sync adapter
  - panel layout state
  - tab rendering registry
- add one browser test that iterates every workspace tab and asserts:
  - URL changes correctly
  - selected tab updates
  - main heading exists
  - no console error appears

### Core views
Status: broad coverage, uneven confidence, with fresh improvement in Procurement stability

Notable strengths:
- Architecture, Arduino, Validation, and Simulation are deeply implemented
- Component Editor and Exports surfaces are present and connected

Notable risks:
- some views are enormous and likely mixing orchestration, rendering, and business logic
- empty states and happy-path rendering are better covered than failure modes

Recommendations:
- define a per-view owner file for:
  - entry state
  - empty state
  - loading state
  - error state
  - permission state
  - success state

### Shared UI system
Status: strong primitive library, needs pruning and consistency review

Concerns:
- backup file [client/src/components/panels/ChatPanel.tsx.bak](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/ChatPanel.tsx.bak) is still in tree
- the UI library is broad enough that drift risk is real
- copy, labels, and affordances may not be consistent across all advanced surfaces

Recommendations:
- remove `.bak` source artifacts from active source tree
- generate a UI primitive usage inventory
- audit keyboard/focus patterns across dialogs, drawers, sheets, command palette, and Radix wrappers

### Frontend testing and verification
Status: strong volume, incomplete runtime certainty

Strengths:
- large client test footprint
- prior QA browser audit is extensive

Gaps:
- fresh live verification in this pass only covered a subset
- repo-wide typecheck currently lacks a clean result
- test count is high, but high count alone does not guarantee route-to-feature truthfulness

Recommendations:
- add a “workspace route matrix” Playwright suite
- add console-clean assertions on every primary route
- add a smoke suite for all tab surfaces on a sample project

## 9. Backend Audit

### Route surface
Status: large and improving, still deserves another ownership-focused pass

Strengths:
- well modularized route layout
- ownership middleware is now used widely across many project-scoped routes

Fresh observation:
- route guard usage appears substantially better than older audit findings suggested
- however, older P0/P1 findings should be treated as “needs revalidation,” not “assumed fixed”

Concerns:
- tenant-scope and ownership guarantees still need a renewed full-pass re-audit
- jobs, AI tools, and collaboration remain the most suspicious surfaces for cross-scope drift

Recommendations:
- run a dedicated “ownership re-audit” against every route in:
  - `server/routes/*`
  - `server/circuit-routes/*`
  - `server/ai-tools/*`
- create one generated matrix: route, middleware, scope source, storage guard, test coverage

### Collaboration/realtime
Status: improved operationally, still security-sensitive

Strengths:
- websocket upgrade routing now no longer conflicts with Vite HMR

Concerns:
- [server/collaboration.ts](/home/wtyler/Projects/ProtoPulse/server/collaboration.ts) still takes `sessionId` from URL query
- anything auth-sensitive in websocket query params deserves scrutiny

Recommendations:
- move websocket auth away from URL query transport if possible
- add handshake authorization regression tests
- verify role enforcement end-to-end, not just handshake validation

### AI backend and tool execution
Status: feature-rich, high-risk area

Strengths:
- rich AI tool surface
- modular tool structure

Concerns:
- the older code audit flagged AI route/tool safety as one of the heaviest risk zones
- [server/ai.ts](/home/wtyler/Projects/ProtoPulse/server/ai.ts) and [server/ai-tools/circuit.ts](/home/wtyler/Projects/ProtoPulse/server/ai-tools/circuit.ts) are still large, complex surfaces
- fresh live/browser plus code evidence shows a concrete orchestration gap: chat can claim it switched views even when `done` is emitted with empty `actions` and `toolCalls`, leaving the UI unchanged

Recommendations:
- enforce tool confirmation/permission policy server-side, not just in metadata
- add tenant-scoped dedupe/cache keys everywhere AI execution can cross sessions
- fix the streaming tool-result capture path in `server/ai.ts` so client-dispatchable actions such as `switch_view` and `run_validation` can actually reach `extractClientActions()`
- classify every AI tool as:
  - read-only
  - reversible mutation
  - destructive mutation
  - side-effecting external action

### Export pipeline
Status: broadest backend feature area, still a major correctness hotspot

Strengths:
- huge export format coverage
- dedicated modules for major formats

Concerns:
- exporter files are large and correctness-sensitive
- prior audits already flagged net mapping correctness risk

Recommendations:
- add golden-project export fixtures
- diff outputs against known-good reference artifacts
- add compatibility validation against importers where possible

### Jobs/background processing
Status: valuable but trust-sensitive

Concerns:
- queue/job surfaces historically flagged for scope and operational concerns
- production/runtime alignment still needs explicit confirmation

Recommendations:
- add dashboard/reporting for job lifecycle truth
- verify cancel/retry/idempotency behavior with integration tests

## 10. Shared Domain Audit

### Strengths
- `shared/` is clearly intended as system truth for core contracts
- major engines exist for DRC, diffs, error taxonomy, and component/domain models

### Risks
- these files are large enough that “shared truth” can become “shared complexity”
- if frontend/backend wiring diverges, these files can create false confidence rather than actual alignment

### Recommendations
- treat [shared/drc-engine.ts](/home/wtyler/Projects/ProtoPulse/shared/drc-engine.ts) and [shared/schema.ts](/home/wtyler/Projects/ProtoPulse/shared/schema.ts) as controlled-core files
- require explicit acceptance tests whenever shared contracts change
- generate a “where used” map for each shared engine

## 11. Functional Gaps and Likely Incomplete Areas

These are not all proven broken. They are areas that still warrant active suspicion:

- full repo typecheck/build health
- route-by-route ownership parity after recent fixes
- truthfulness of advanced/AI-generated flows
- native-desktop-first execution path consistency versus browser-era assumptions
- advanced collaboration role and session semantics
- import/export parity for all advertised formats
- hardware/serial edge cases on disconnect/reconnect/cancel/error
- advanced tabs with sparse recent runtime verification

## 12. Recommendations Backlog

### Immediate
- make `npm run check` complete successfully and capture the result
- run a fresh full Playwright sweep for all major routes and tabs
- delete stale source backup artifacts like `ChatPanel.tsx.bak`
- produce a current ownership-guard matrix for all route modules

### High value
- split the largest frontend orchestrators
- split the largest backend exporters/tool modules
- add per-view smoke tests for all workspace tabs
- create a “feature truth” inventory: real, experimental, simulated, placeholder

### Medium value
- align native desktop roadmap with actual runtime architecture
- add generated documentation for route contracts and workspace tab mapping
- add runtime feature health indicators for advanced tools

### Long-range / strategic
- reframe the app around product tiers:
  - core maker workflow
  - pro workflow
  - experimental AI lab
- reduce “everything in one workspace shell” cognitive load with grouped workflows or modes

## 13. New Feature / Enhancement Ideas

### UX and workflow
- tab search / command-jump for the 30+ workspace tabs
- workflow mode presets:
  - beginner
  - design
  - firmware
  - manufacturing
  - debug
- feature maturity badges on advanced tabs
- “what changed since last visit” per project

### Quality and safety
- route ownership auditor generator
- export fidelity scorecard
- simulation confidence score
- AI action dry-run preview for all mutating operations
- “trust mode” banner when app is using simulated/fallback data

### Native desktop / hardware
- first-class serial/device dashboard outside the main project workspace
- toolchain health panel for Arduino/embedded dependencies
- offline package/cache manager for board cores and libraries

### Learning and maker support
- guided workflow templates by outcome:
  - blink an LED
  - read a sensor
  - drive a motor
  - send telemetry
- design review coach mode
- “why this failed” explainer that links validation, BOM, and firmware hints

## 14. Final Checklist

### Must-fix
- [x] full repo typecheck completes cleanly (fixed: added `--max-old-space-size=4096` to `check` script — Wave 156)
- [ ] route ownership matrix re-audited after recent hardening
- [ ] all primary workspace tabs covered by current live smoke tests
- [ ] stale backup/temporary source files removed from app tree

### Should-fix
- [ ] break up the top 10 largest production files
- [ ] add tab/route matrix browser tests
- [ ] classify feature maturity and truthfulness in UI
- [ ] add stronger AI action permission boundaries

### Nice-to-have
- [ ] grouped tab modes
- [ ] richer health dashboards for hardware/toolchain/export confidence
- [ ] native-desktop-specific workflow simplification

## 15. Bottom Line

ProtoPulse is not a thin prototype anymore. It is a large product platform with enough surface area that its next big quality gains will come from:

- verification discipline
- scope/ownership correctness
- runtime truthfulness
- reduction of hotspot complexity

If the goal is “trustworthy all-in-one electronics platform,” the next milestone should be a stabilization wave, not just another expansion wave.
