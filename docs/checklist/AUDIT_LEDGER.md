# ProtoPulse Audit Ledger

Date: 2026-03-22 to 2026-03-23
Status: in progress

## Scope Guardrail

This file exists to prevent overclaiming.

Nothing in this checklist directory should be read as:
- every file reviewed line by line
- every button clicked
- every workflow fully replayed
- every backend route fully authorized and regression-tested

Unless a surface is explicitly marked `Live verified now`, it should be treated as:
- code inspected only
- inherited from prior audits
- or still pending active verification

## Evidence Buckets

### Live verified now
- `/projects` loads on the current dev server
- deep links such as `/projects/18/component_editor` have loaded successfully in the current audit window
- dev CSP/HMR issues that were present earlier were fixed and re-verified
- `ProjectProvider` plus core project-scoped providers can load a project successfully without immediate runtime failure
- direct deep link to `/projects/18/viewer_3d` loads without a runtime loop in the current audit window
- Architecture route verified:
  - `/projects/18/architecture` loads cleanly and renders the real canvas plus asset library
  - opening `Analyze design` shows the analysis drawer and closing it exposes the node inspector again
  - selecting `ESP32-S3-WROOM-1` reveals a real `Node Properties` inspector with editable fields
  - adding `BME280` from the asset library mutates the live graph from `2` nodes to `3`
  - the `Design Suggestions` dock appears with real architecture suggestions after the graph mutation
  - applying `Add a power indicator LED` now adds a correctly labeled `Power LED` node instead of corrupting the graph with `undefined led`
  - the follow-on suggestion now reads `Add current limiting resistor for Power LED`
  - applying that resistor suggestion adds a correctly labeled `330R resistor` node
  - the sample project architecture was restored to its original two-node state after the verification pass
- direct deep link to `/projects/18/procurement` now remains on Procurement instead of flashing back to Architecture
- `ProcurementView` is restored from bisect mode and currently renders as the full real screen
- `activeView = procurement` is stable in a minimal provider probe
- `usePredictions` is stable in the provider probe with procurement-state inputs
- milestone/toast logic is stable in the provider probe
- route-sync logic is stable in the provider probe
- workspace reducer plus responsive/keyboard setup is stable in the provider probe
- Procurement live interactions verified:
  - `Add Item` opens the `Add BOM Item` dialog
  - `Compare Suppliers` opens the supplier comparison dialog
  - `AVL Compliance` tab renders and reaches its empty state
  - `BOM Comparison` tab renders and reaches its empty state
- Validation route and screen verified:
  - `/projects/18/validation` loads cleanly
  - `System Validation` heading and issue summary render
  - DRC controls and troubleshooting sections render
  - clicking the `Validation` tab from `/projects/18/community` immediately updates the route to `/projects/18/validation`
  - `Run DRC Checks` triggers `POST /api/projects/18/validation`, increments the visible issue count from `130` to `131`, and surfaces `Validation Running`
  - opening `Floating Inputs` in the troubleshooter reveals a real detail view with symptoms, root cause, fix steps, and related issues
  - the troubleshooter detail view returns cleanly to the issue list via `Back to list`
  - `Custom Rules` opens a real `Custom DRC Rules` dialog with template, metadata, and script-editor controls
  - the `Custom DRC Rules` dialog dismisses via its explicit `Close` button
  - browser console remains free of fresh warnings/errors during the validation pass
- Export route and export precheck verified:
  - `/projects/18/output` loads cleanly
  - export catalog renders with populated format inventory
  - `Download Firmware Scaffold` opens the export precheck panel
  - the export precheck panel can be dismissed cleanly
  - browser console remains free of fresh warnings/errors during the export pass
- History route verified:
  - `/projects/18/design_history` loads cleanly
  - the onboarding hint can be dismissed
  - the real empty state renders as `Design Version History` with `Save Snapshot`
  - `Save Snapshot` opens a real save dialog with required-name validation
  - saving `Audit Snapshot 1` transitions the route from `0 snapshots` to `1 snapshot` and renders the saved entry
  - saving a snapshot surfaces `Snapshot saved`
  - `Compare to Current` renders `No differences found` for the freshly created snapshot
  - browser console remains free of fresh warnings/errors during the history pass
- Comments route verified:
  - `/projects/18/comments` loads cleanly
  - the existing comment thread hydrates after a brief loading state
  - `Reply` opens reply mode with a reply textbox
  - reply mode can be cancelled cleanly
  - browser console remains free of fresh warnings/errors during the comments pass
- Arduino route verified:
  - `/projects/18/arduino` loads cleanly
  - the real `Arduino Workbench` renders
  - `New file` opens the `New Sketch File` dialog
  - the dialog now includes descriptive accessibility text after a targeted fix in `ArduinoWorkbenchView.tsx`
  - reopening the dialog no longer emits the earlier `DialogContent` accessibility warning
- Serial Monitor route verified:
  - `/projects/18/serial_monitor` now loads cleanly and remains stable after a targeted fix
  - dismissing the onboarding hint no longer trips the workspace error boundary
  - the disconnected-state monitor renders real board, baud, and line-ending selectors plus DTR/RTS toggles and monitor controls
  - browser console remained free of fresh warnings/errors during the final serial monitor pass
- Circuit Code route verified:
  - `/projects/18/circuit_code` now loads cleanly and remains stable after targeted starter-evaluation fixes
  - the starter DSL now evaluates on first load, the preview resolves with `R1` / `10k`, and the status bar shows `1 components` / `2 nets`
  - `Apply to Project` is enabled on first load and clicking it triggers `POST /api/projects/18/circuits/apply-code -> 200` with `circuitId: 6`
  - browser console remained free of fresh warnings/errors during the final circuit-code pass
- Schematic route verified:
  - `/projects/18/schematic` now loads cleanly on the current dev server and renders the real schematic editor frame with toolbar, parts panel, canvas, `Push to PCB`, and `Add Component`
  - dragging `ATtiny85` from the parts panel onto the canvas creates `U1`, enables `Push to PCB`, and surfaces the real `Add U1 to BOM?` notification
  - after the backend auth fix and server restart, the formerly broken nested route `GET /api/projects/18/circuits/5` now returns `200` in the live browser network log
  - selecting `U1` and pressing `Delete` removes the instance and restores the `Empty Schematic` state with disabled `Push to PCB`
  - `Add Component` opens the real searchable overlay and it closes cleanly via `Escape`
  - clicking `Place ATtiny85 on schematic` from the overlay now creates `U1`
  - pressing `Enter` from the focused overlay also creates `U1`, and the live network log shows `POST /api/circuits/5/instances -> 201`
  - `Push to PCB` opens a real confirmation dialog, confirming it surfaces `Pushed to PCB`, and `/projects/18/pcb` then renders `U1` on the board
  - deleting `U1` from the schematic and revisiting `/projects/18/pcb` restores the `Empty PCB Board` state
  - browser console remained free of fresh warnings/errors during the final schematic/PCB pass
- Audit Trail route verified:
  - `/projects/18/audit_trail` now loads cleanly and remains stable after a desktop route-map fix
  - the desktop `Audit Trail` tab now renders on direct deep link and remains selected
  - expanding `Motor Controller` reveals structured field diffs
  - searching `ATmega` filters the list down to `1 entry (filtered from 5)` and exposes `Clear`
  - setting both date inputs to `2026-03-15` through `2026-03-16` reduces the list to `0 entries (filtered from 5)` and shows the real empty state
  - `Clear` restores the baseline `5 entries`
  - `Export CSV` generates a blob download named `audit-trail-2026-03-23.csv`; a fresh instrumentation pass observed `URL.createObjectURL()` plus anchor download click with `text/csv;charset=utf-8;` payload
  - browser console remained free of fresh warnings/errors during the audit-trail pass
- Starter Circuits route verified:
  - `/projects/18/starter_circuits` loads cleanly with populated starter templates
  - expanding `Servo Sweep` reveals the expected `Components Needed`, `What You Will Learn`, and `Arduino Code` sections
  - `Open Circuit` now routes into `/projects/18/arduino` instead of just copying code
  - the starter handoff now creates and selects `Servo_Sweep.ino` in the Arduino workbench with the expected sketch content
  - reopening the same starter sketch succeeds again without a duplicate-file explosion; fresh server evidence showed `POST /api/projects/18/arduino/files/create -> 201` and the refreshed files list remained `total: 1`
- Calculators route verified:
  - `/projects/18/calculators` loads cleanly and the real `Engineering Calculators` screen renders
  - dismissing the onboarding hint works
  - `Ohm's Law` with `5 V` and `20 mA` returns `250 Ω` and `100 mW`
  - `Apply to Component` on that Ohm's Law result copies `250 Ω` to the clipboard and surfaces the real `Copied to clipboard` toast
  - the default `LED Resistor` inputs return `150 Ω` and `60 mW`
  - the default forward `Voltage Divider` inputs return `2.5 V`, `50.0%`, and `250 µA`
  - `Add to BOM` on that same Ohm's Law result initially reproduced a real `400` with `Validation error: Expected string, received number at "unitPrice"`
  - after patching the shared BOM insert schema and restarting the dev server, the exact same `Add to BOM` click succeeds and surfaces `Added to BOM`
  - a fresh authenticated API probe immediately after that click showed `GET /api/projects/18/bom -> total: 1` with `Resistor 250 Ω (from Ohm's Law calculator)` plus normalized `unitPrice: "0.0000"` / `totalPrice: "0.0000"`
  - a fresh authenticated API probe also confirmed `PATCH /api/projects/18/bom/6` accepts numeric `unitPrice: 0.25`, returns `200`, and normalizes to `unitPrice: "0.2500"` / `totalPrice: "0.2500"`
  - cleanup deleted the temporary BOM row and restored the sample project back to `0` BOM items
  - browser console remained free of fresh warnings/errors during the calculators pass
- Labs route verified:
  - `/projects/18/labs` loads cleanly with the real `Lab Templates` screen
  - dismissing the onboarding hint works
  - selecting `LED Circuit Basics` opens a full lab detail view with objectives, steps, hints, and grading criteria
  - `Start Lab` switches the lab into tracked progress mode with a `0/5` progress state
  - marking the first step complete advances progress to `1/5` and `20%`
  - reloading after step completion preserves the updated lab progress in both the detail view and the lab-card list
  - `Reset` returns the lab to the pre-start `Start Lab` state
  - reloading after `Reset` preserves the cleared state and leaves `localStorage['protopulse-lab-sessions']` empty again
  - browser console remained free of fresh warnings/errors during the labs pass
- Tasks route verified:
  - `/projects/18/kanban` loads cleanly with the real `Task Board` screen
  - a stale audit task persisted in `localStorage['protopulse-kanban-board']` at the start of the fresh pass, proving the board is genuinely persistence-backed rather than reset-on-load
  - `Add task` opens a real `Create Task` dialog and the submit action stays disabled until a title is present
  - creating a backlog task persists it to the board and increases the visible task count from `0` to `1`
  - moving the new task right shifts it from `Backlog` to `To Do` and updates the column counts correctly
  - editing the persisted task is real: title, description, priority, tags, and assignee changes all render on the card after save
  - edit-side metadata enrichment is reflected in the filter bar; adding tags and assignee causes the `All tags` / `All assignees` filters to appear
  - filtering by assignee `Tyler` keeps the matching task visible, and switching priority to non-matching `Low` hides the task and drops visible column counts to `0`
  - `Clear` restores the unfiltered board state
  - deleting the persisted audit task is real; the board returns to `0 tasks`, `localStorage['protopulse-kanban-board']` shows `tasks: []`, and reload preserves the empty baseline
  - browser console remained free of fresh warnings/errors during the tasks pass
- Inventory route verified:
  - `/projects/18/storage` loads cleanly
  - the real `Storage Manager` screen renders
  - `Scan` opens the `Barcode Scanner` dialog
  - the scanner dialog can be closed cleanly
  - with a temporary seeded BOM item, the non-empty inventory path renders a grouped `Bin A1` section, `3 / 5` quantity readout, `Critical` stock badge, and a visible low-stock count
  - opening `Labels` reveals a real print workflow with label-size, columns, selection, and preview controls
  - preview renders the selected part label correctly
  - a browser probe confirmed `Print 1 Label` reaches `window.open()`, writes printable HTML, focuses the print window, and invokes `print()`
  - cleanup deleted the temporary BOM item and restored the sample project back to the empty inventory baseline
  - browser console remains free of fresh warnings/errors during the inventory pass
- Order PCB route verified:
  - `/projects/18/ordering` loads cleanly
  - the board specification step renders with its controls
  - `Next` advances from `Board Specs` to `Select Fab` in the current pass
  - selecting `JLCPCB`, running DFM, and advancing through `Quotes` to `Summary` all work in the current pass
  - the quote table is populated with deterministic client-side pricing (`JLCPCB` best at `$27.00` grand total for the default `5` boards)
  - clicking `Place Order` creates a `submitted` order in `localStorage['protopulse-pcb-orders']` with embedded DFM and quote data
  - a browser fetch/XHR probe stayed empty through the full quote and place-order flow, and the real backend endpoint `GET /api/projects/18/orders` remained `0`, so the current route is not using the server-side ordering API
  - the fabricator API-key panel can store/remove a fab key through `/api/settings/api-keys`, but order placement does not depend on that key and still remains local-only
  - cleanup removed the temporary local order and restored the route to its initial step-1 baseline
  - after the `Design Suggestions` workspace fix, the old empty panel no longer sits over the lower-right action area
  - browser console remains free of fresh warnings/errors during the ordering pass
- Simulation route re-verified:
  - `/projects/18/simulation` loads cleanly on the current dev server
  - the earlier `Run DC Operating Point` `404` is no longer reproduced after correcting the client/server simulation contract
  - live API evidence shows the sample project has one circuit shell and zero placed circuit instances, so the earlier blank result state was an empty-circuit UX problem rather than a dropped simulation payload
  - `Start Simulation` is now disabled on the empty sample circuit
  - `Run DC Operating Point` is now disabled on the empty sample circuit
  - opening `Results` now shows `Nothing to simulate yet. Place at least one component in the schematic before running a simulation.`
  - `Export SPICE` initially reproduced a real `500` on the current sample project
  - after a server-side guard fix in `server/circuit-routes/simulations.ts` and a dev-server restart, `Export SPICE` now completes successfully with a `200` response and `Export Complete`
  - `Add Probe` expands into real editable controls (`Probe name`, probe type, and `Node/Comp`)
  - `Share` now copies successfully and surfaces `Simulation link copied`
  - browser console remained free of fresh warnings/errors during the final simulation pass
- Lifecycle route verified:
  - `/projects/18/lifecycle` loads cleanly
  - the onboarding hint dismisses cleanly
  - the empty-state lifecycle dashboard renders
  - `Add Component` opens a real lifecycle tracking dialog
  - the lifecycle dialog closes cleanly via keyboard escape
  - creating a temporary lifecycle entry (`AUDIT-LC-001`) is a real persisted mutation: the table updates, status cards change to `NRND 1 / 100%`, and `GET /api/projects/18/lifecycle` returns the same record
  - reload preserves the created record, proving the route is not relying on optimistic client state alone
  - editing the same record is a real persisted mutation: manufacturer/status/source changes propagate into both the table and the API, and the attention banner appears for the `EOL` state
  - reload preserves the edited values, including `Audit Components Intl`, `EOL`, and `Lifecycle Audit Refresh`
  - `Export CSV` is a real blob download: a browser probe observed `URL.createObjectURL()`, anchor click, and `lifecycle-report-2026-03-23.csv`
  - deleting the temporary record is a real persisted mutation: the row disappears, `GET /api/projects/18/lifecycle` returns `{"data":[],"total":0}`, and reload restores the empty baseline
  - browser console remains free of fresh warnings/errors during the lifecycle pass
- Learn route verified:
  - `/projects/18/knowledge` updates the route and selected tab correctly
  - after hydration, the real `Electronics Knowledge Hub` renders
  - article count, search, category filter, level filter, and article cards appear
  - browser console remains free of fresh warnings/errors during the learn pass
- Community route verified:
  - `/projects/18/community` updates the route and selected tab correctly
  - after hydration, the real `Community Library` renders
  - the default `Browse` tab shows a populated component catalog with search and filter controls
  - the `Featured` tab opens and populated featured, trending, and new-arrivals content appears
  - opening `USB-C Connector Module` reveals a real detail view with component metadata and `Download Component`
  - clicking `Download Component` increments the local download counter (`3200 -> 3201 -> 3202`) but a browser probe observed no blob creation, anchor download, fetch, or XHR, so this is currently a mislabeled local counter action rather than a real download/export
  - the seeded library content does not include the metadata required by `shouldPromptBomAdd()` (`manufacturer` / `mpn`), so the BOM-prompt path is effectively unreachable in the shipped sample data
  - `Collections` opens correctly and `New` creates a persisted collection
  - post-submit DOM checks show the create dialog really does close; the earlier contrary impression came from a stale click snapshot
  - the current UI exposes no live add/remove/delete collection controls even though the data layer implements them
  - cleanup removed the temporary audit collection and restored the sample library back to zero collections
  - browser console remains free of fresh warnings/errors during the community pass
- 3D View route verified:
  - `/projects/18/viewer_3d` loads cleanly and remains stable
  - the real `3D Board Viewer` renders with camera-angle buttons, layer toggles, dimensions, and edit-board controls
  - switching from `Iso` to `Front` updates the active camera-angle button state
  - editing board dimensions from `100 x 80 x 1.6` to `120 x 90 x 2` and pressing `Apply` updates both the inline scene dimensions and the side-panel dimensions card
  - toggling `Top Copper` changes the live layer checkbox state and can be restored cleanly
  - `Export` now has fresh proof: a live instrumentation pass showed it generates a blob download named `board-3d-scene.json` with an `application/json` payload
  - the sample board dimensions and layer state were restored to `100 x 80 x 1.6` with `Top Copper` re-enabled after the verification pass
  - browser console remains free of fresh warnings/errors during the 3D View pass
- Digital Twin route verified:
  - `/projects/18/digital_twin` loads cleanly and remains stable
  - the empty-state `No device` screen renders with `Connect`, `Generate Firmware`, and the expected no-data messages
  - a controlled runtime probe confirmed `Connect` reaches `navigator.serial.requestPort()` with real user activation
  - the cancelled-port path shows the expected `No port selected` toast
  - `Generate Firmware` opens a real dialog
  - the firmware dialog exposes real board, baud-rate, sample-rate, and pin-configuration controls
  - `Generate Sketch` produces firmware output from default settings
  - adding a pin and regenerating updates the generated code with pin constants, manifest entries, and command handling
  - the firmware dialog closes cleanly via its close button
  - browser console remains free of fresh warnings/errors during the Digital Twin pass
- Generative route verified:
  - `/projects/18/generative_design` loads cleanly and remains stable
  - clicking `Generate` with an empty description still produces a candidate list in the current pass
  - `Compare` expands a visible diff against the current design and surfaced `1 component added` / `ADDED D101` in the current pass
  - `Export` generates a blob download named `candidate-cand-b171216f.json`; a fresh instrumentation pass observed `URL.createObjectURL()` plus anchor download click with `application/json` payload
  - browser console remains free of fresh warnings/errors during the generative pass
- Patterns route verified:
  - `/projects/18/design_patterns` loads cleanly and remains stable
  - filtering the pattern library with `divider` reduces the results to `Voltage Divider` and updates the counter to `1 of 10`
  - applying the `Signal` category filter keeps the filtered result set consistent
  - `My Snippets` renders a populated snippet library with the expected `5 of 5` baseline count
  - `Create` opens a real snippet dialog with the correct fields and disabled submit state
  - creating a temporary snippet persists it to the list, increments the counter to `6 of 6`, and now closes the dialog cleanly
  - expanding a custom snippet reveals real `Edit`, `Delete`, and `Duplicate` controls
  - `Duplicate` creates a persisted `Codex Audit Temp (Copy)` row and increments the count to `7 of 7`
  - `Edit` opens a real metadata dialog, saving `Codex Audit Temp Edited` persists the renamed row, and `Delete` removes it cleanly
  - after cleanup, the route returns to the original `5 of 5` baseline
  - browser console remained free of fresh warnings/errors during the full patterns pass
- AI chat quick action verified:
  - the `Project Summary` quick action sends a real prompt from the chat panel
  - the panel shows a live analyzing state before the response lands
  - the assistant returns a project summary plus follow-up action chips such as `Run Validation`, `Optimize BOM`, and `Help me fix these issues`
  - browser console remained free of fresh warnings/errors during the quick-action pass

### Live failures verified now
- none currently reproduced in the Procurement route after the route-sync fix
- the Architecture route still emits a fresh React Flow warning in the current pass: the parent container needs an explicit width and height to render the graph
- Generative Design currently accepts an empty circuit description and still produces six `100.0%` candidates in the current live pass
- the snapshot delete trigger in Design History is currently an icon-only unlabeled button, which makes the destructive action hard to discover and fails basic accessible naming expectations
- AI follow-up action chips are still only partially verified: in the fresh `Run Validation` pass, the chip sent a new chat prompt and returned copy about running validation, but no non-chat validation request or route transition was observed
- AI navigation via chat is currently untrustworthy in the fresh pass: `Switch to the Validation view now.` returned assistant copy claiming success, but the route stayed `/projects/18/community` until the Validation tab was clicked manually
- fresh stream evidence showed `/api/chat/ai/stream` ended that navigation pass with `actions: []` and `toolCalls: []`, while fresh code inspection in `server/ai.ts` shows `executeStreamForProvider()` never populates `allToolCalls`, so `extractClientActions()` has nothing to materialize into client navigation actions
- the `Custom DRC Rules` dialog has a keyboard-dismiss gap in the fresh rerun: pressing `Escape` left the dialog open, while the explicit `Close` button dismissed it
- Generative appears to still be largely local/mock in the current pass: clicking `Generate` with a blank description produced six `100.0%` candidates without any fresh XHR/fetch request, and fresh code inspection shows the current client engine runs entirely in-browser from `defaultBaseCircuit()`
- Design Patterns currently stops at snippet management in the current implementation: fresh live UI and code inspection both show `Create`, `Edit`, `Delete`, and `Duplicate`, but no action to place/import a pattern or snippet into Schematic or Architecture
- Breadboard currently has a real schematic-sync/placement gap in the current pass: with `U1` present in `/projects/18/schematic`, `/projects/18/breadboard` still rendered the `Getting Started` empty state
- a fresh authenticated API probe confirmed the instance exists (`U1`) but still has `breadboardX: null` / `breadboardY: null`, so the issue is not missing circuit data
- automated BOM route regression proof is still incomplete in the current pass: `npx vitest run shared/__tests__/schema.test.ts` passed after the numeric-input schema fix, but `server/__tests__/bom-routes.test.ts` still cannot be treated as passing evidence because its harness leaves `baseUrl` undefined under current Vitest execution
- repo-wide lint truth is still not confirmed from this wave because a targeted eslint pass on the touched simulation files timed out after 60 seconds without producing a result
- broader workspace coverage is still incomplete, so absence of a reproduced failure here is not proof that every adjacent workflow is healthy

### Code inspected
- app router in `client/src/App.tsx`
- workspace shell and tab routing in `client/src/pages/ProjectWorkspace.tsx`
- navigation model in `client/src/components/layout/sidebar/sidebar-constants.ts`
- onboarding/smart hint surfaces such as `FirstRunChecklist`, `ViewOnboardingHint`, and `SmartHintToast`
- provider composition in `client/src/lib/project-context.tsx`
- project meta state in `client/src/lib/contexts/project-meta-context.tsx`
- tutorial layer in `client/src/lib/tutorial-context.tsx`, `client/src/components/ui/TutorialOverlay.tsx`, and `client/src/components/ui/LessonModeOverlay.tsx`
- procurement surface in `client/src/components/views/ProcurementView.tsx` and related procurement panels
- comments and history surfaces in `client/src/components/views/CommentsView.tsx` and `client/src/components/views/DesignHistoryView.tsx`
- architecture surface in `client/src/components/views/ArchitectureView.tsx`
- architecture suggestion UI in `client/src/components/ui/PredictionPanel.tsx` and `client/src/components/ui/PredictionCard.tsx`
- audit trail surface in `client/src/components/views/AuditTrailView.tsx`
- 3D viewer surface in `client/src/components/views/BoardViewer3DView.tsx`
- breadboard surface in `client/src/components/circuit-editor/BreadboardView.tsx`
- schematic-to-breadboard sync helpers in `client/src/lib/circuit-editor/view-sync.ts`
- Arduino workbench dialog composition in `client/src/components/views/ArduinoWorkbenchView.tsx`
- circuit-code surface in `client/src/components/views/CircuitCodeView.tsx`
- circuit-code worker runtime in `client/src/lib/circuit-dsl/circuit-dsl-worker.ts`
- schematic route hook path in `client/src/lib/circuit-editor/hooks.ts`
- circuit design project route in `server/circuit-routes/designs.ts`
- project ownership middleware in `server/routes/auth-middleware.ts`
- prediction action normalization in `client/src/lib/prediction-actions.ts`
- prediction rule generation in `client/src/lib/ai-prediction-engine.ts`
- Digital Twin surface in `client/src/components/views/DigitalTwinView.tsx`
- design patterns and snippet reuse in `client/src/components/views/DesignPatternsView.tsx` and `client/src/lib/design-reuse.ts`
- generative design surface in `client/src/components/views/GenerativeDesignView.tsx`
- in-browser generative engine flow in `client/src/lib/generative-design/generative-engine.ts`
- keyboard shortcut handling in `client/src/lib/keyboard-shortcuts.ts` and workspace-level shortcut wiring in `client/src/pages/ProjectWorkspace.tsx`
- AI chat streaming/action execution in `server/ai.ts`, `client/src/components/panels/chat/hooks/useActionExecutor.ts`, and `client/src/components/panels/chat/hooks/action-handlers/navigation.ts`
- serial monitor surface in `client/src/components/panels/SerialMonitorPanel.tsx`
- external-store snapshot flow in `client/src/lib/arduino/serial-logger.ts`
- onboarding dismissal flow in `client/src/lib/view-onboarding.ts`
- desktop tab routing metadata in `client/src/components/layout/sidebar/sidebar-constants.ts`
- desktop sidebar grouping in `client/src/lib/sidebar-groups.ts`

### Prior audits only
- repo-wide product analysis docs
- earlier QA/browser audit docs
- earlier code-inspection rollups

## Latest Resolved Frontend Bug

### Procurement Route
- Route: `/projects/18/procurement`
- Current status: stable in the latest live browser pass
- Prior symptom: `Maximum update depth exceeded` plus rapid URL flashing between `/architecture` and `/procurement`
- Root cause found:
  - the workspace URL/view synchronization logic in `ProjectWorkspace` was fighting the initial route bootstrap
  - the “advanced view” guard could also redirect too early before the first graph query had fully resolved
- Current verification:
  - cold load to `/projects/18/viewer_3d` succeeds
  - switching from Viewer 3D to Procurement updates the URL correctly
  - cold load to `/projects/18/procurement` stays on Procurement
  - the real Procurement view renders and interactive surfaces respond

### Nested Project Resource Ownership Guard
- Route impact: project-scoped nested endpoints such as `/api/projects/:projectId/circuits/:id`
- Current status: fixed and reverified on the latest fresh dev server
- Prior symptom:
  - the live schematic route could hit `GET /api/projects/18/circuits/5 -> 404 {"message":"Project not found"}`
  - sibling requests like `/api/projects/18/circuits` and `/api/circuits/5/instances` still succeeded, making the failure look inconsistent from the UI
- Root cause found:
  - `requireProjectOwnership()` was preferring `req.params.id` over `req.params.projectId`
  - on nested routes like `/api/projects/:projectId/circuits/:id`, that meant the circuit id was being misread as the project id
- Current verification:
  - `server/routes/auth-middleware.ts` now prefers `projectId` when both params are present
  - targeted regression coverage passed in `server/__tests__/ownership-integration.test.ts` and `server/__tests__/project-ownership.test.ts`
  - after restarting the dev server, the live browser network log now shows `GET /api/projects/18/circuits/5 -> 200`
  - the schematic drag/delete flow no longer reproduces the old ownership 404

### Design Suggestions Panel
- Route impact: workspace-wide, especially lower-right action areas such as Ordering and Inventory
- Current status: improved in the latest live browser pass
- Prior symptom: global `Design Suggestions` box rendered as a bottom-right absolute overlay and could cover view-level controls
- Root cause found:
  - `ProjectWorkspace` mounted `PredictionPanel` as `absolute bottom-4 right-4`
  - `PredictionPanel` also rendered an idle empty state even when there were no active suggestions
- Current verification:
  - `/projects/18/ordering` no longer shows the empty panel after reload
  - `/projects/18/storage` no longer shows the empty panel after reload
  - browser console remained clean during both checks

### Architecture Suggestion Apply Labels
- Route: `/projects/18/architecture`
- Current status: fixed for the verified `add_component` suggestion path in the latest live browser pass
- Prior symptom:
  - accepting architecture suggestions could create corrupted node labels such as `undefined led`
  - the next recommendation would then inherit the bad label and read `Add current limiting resistor for undefined led`
- Root cause found:
  - `ProjectWorkspace.handlePredictionAccept()` only handled `add_component` payloads in one narrow shape
  - some prediction rules emit payloads with `label` and optional `count`, which were not being normalized before node creation
- Current verification:
  - adding `BME280` produces a real suggestion dock
  - accepting `Add a power indicator LED` now creates `Power LED`
  - the follow-on recommendation now references `Power LED`
  - accepting the resistor suggestion creates `330R resistor`
  - focused regression coverage now exists for prediction action label/count normalization

### Design Patterns Snippet Dialog
- Route: `/projects/18/design_patterns`
- Current status: stable in the latest live browser and targeted test pass
- Prior symptom:
  - snippet creation worked, but the form implementation depended on a render-time reset side effect
  - this made the dialog state brittle and hard to trust during create/edit flows
- Root cause found:
  - `SnippetFormDialog` was using a `useState` initializer to call `resetForm`, which is the wrong lifecycle for synchronizing dialog form state
- Current verification:
  - the form reset is now driven by `useEffect` when the dialog opens
  - a focused regression test now covers create, close, and reset behavior
  - fresh browser verification confirmed a post-patch create closes the dialog, persists the snippet, and still allows cleanup through delete

### Workspace Shortcuts Overlay Guard
- Route impact: workspace-wide, especially chat and other editable surfaces
- Current status: hardened and verified in the latest live browser and targeted test pass
- Prior symptom:
  - the shortcuts overlay guard depended only on `event.target`
  - that made the workspace-level `?` handler weaker than the shared shortcut path when focus and event target diverged
- Root cause found:
  - `ProjectWorkspace` used a local target-only editable check
  - the shared keyboard shortcut utility also lacked an `activeElement` fallback for window/body-targeted events
- Current verification:
  - pressing `?` with general workspace focus still opens `Keyboard Shortcuts`
  - pressing `?` with the chat textarea focused inserts `?` into the input and does not open the overlay
  - focused regression coverage now verifies editable-target detection, active-element fallback, and the non-editable path

### Serial Monitor Route
- Route: `/projects/18/serial_monitor`
- Current status: stable in the latest live browser pass
- Prior symptom:
  - dismissing the onboarding hint could crash the route into the workspace error boundary
  - React warned that `getSnapshot` should be cached and the screen hit `Maximum update depth exceeded`
- Root cause found:
  - `SerialMonitorPanel` consumes `SerialLogger` through `useSyncExternalStore`
  - `SerialLogger.getSnapshot()` was returning a new object on every read, so React treated each snapshot as changed even when the logger state had not changed
- Current verification:
  - `SerialLogger` now caches and refreshes a stable snapshot object only when logger state changes
  - focused regression coverage verifies snapshot referential stability until state changes
  - fresh reload to `/projects/18/serial_monitor` renders the real disconnected-state monitor without the earlier loop
  - dismissing the onboarding hint no longer trips the error boundary
  - browser console remained free of fresh warnings/errors during the final pass

### Circuit Code Starter Evaluation
- Route: `/projects/18/circuit_code`
- Current status: stable in the latest live browser pass
- Prior symptom:
  - first load showed the starter DSL but left the preview empty and `Apply to Project` disabled
  - after the initial mount fix, the worker surfaced `Identifier 'c' has already been declared`
- Root cause found:
  - `CircuitCodeView` only evaluated after editor changes, so the starter DSL never received its first evaluation on mount
  - the DSL worker also assumed an implicit injected `c` builder while the shipped starter template explicitly declared `const c = circuit(...)`
- Current verification:
  - `CircuitCodeView` now evaluates the starter template on initial mount
  - the worker now supports both explicit builder declaration and shorthand builder usage
  - fresh live verification showed `R1`, `10k`, `1 components`, and `2 nets` on first load
  - `Apply to Project` now succeeds on first load with `POST /api/projects/18/circuits/apply-code -> 200`
  - targeted regression coverage passes for the mount evaluation path

### Audit Trail Desktop Route Mapping
- Route: `/projects/18/audit_trail`
- Current status: stable in the latest live browser pass
- Prior symptom:
  - the workspace still contained an `audit_trail` render branch, but direct navigation fell back to `History`
  - the view existed in onboarding, quick-jump, mobile nav, and prefetch metadata, but not in the desktop tab model
- Root cause found:
  - `audit_trail` had drifted out of desktop `navItems`, `tabDescriptions`, `alwaysVisibleIds`, and the sidebar grouping model
  - because `VALID_VIEW_MODES` is derived from `navItems`, the route could not be honored during URL bootstrap
- Current verification:
  - direct navigation to `/projects/18/audit_trail` now stays on the route
  - the desktop `Audit Trail` tab renders and remains selected
  - expanding an entry reveals structured diffs and search filtering works
  - focused sidebar-group and mobile-nav tests pass with the restored view mapping

## Honest Coverage Snapshot

### Frontend
- Route inventory reviewed: partial
- Tab inventory reviewed: mapped, with fresh live verification on Component Editor, Architecture, Procurement, Validation, Exports, History, Audit Trail, Comments, Arduino, Circuit Code, Serial Monitor, Starter Circuits, Patterns, Calculators, Labs, Tasks, Inventory, Ordering, Lifecycle, Learn, Community, 3D View, Digital Twin, and Generative
- Buttons verified live: partial, now including `Project Summary`, `Run Validation`, the Validation screen's `Run DRC Checks`, Architecture `Analyze design`, Architecture asset-library add actions, Architecture suggestion `Apply`, 3D View camera-angle and board-apply controls, and Digital Twin `Generate Firmware` / `Add Pin` / `Generate Sketch`
- Screens verified live: partial
- Browser console sweep: partial and focused on active failures, with fresh clean passes on Patterns, Community, the AI quick-action flow, Circuit Code, Audit Trail, and the final Serial Monitor pass

### Backend
- Route module inventory reviewed: partial
- Ownership/auth regression sweep: partial
- Full route-by-route verification: not complete
- Full test pass: not complete in this audit pass

### Shared/domain logic
- High-risk shared files identified
- Full line-by-line shared engine verification: not complete

## Immediate Next Audit Steps

1. Continue the fresh tab-by-tab browser sweep beyond the now-verified set, especially whether AI chat can trigger real domain workflows instead of only chat copy.
2. Verify another workspace slice end to end with live evidence, not just code inspection.
3. Trace and fix the server-side AI tool-result extraction gap in `server/ai.ts`, then re-run live navigation and validation-action probes.
4. Distinguish every checklist item as `live verified`, `code inspected`, or `pending`.
