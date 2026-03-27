# ProtoPulse Workflow Verification Matrix

Date: 2026-03-23

## Verification Legend
- `Live verified now`: checked directly in current browser/dev-session pass
- `Prior QA verified`: covered in `docs/qa-audit/MASTER-REPORT.md`
- `Code inspected`: traced in source during this pass
- `Needs deeper revalidation`: not enough fresh evidence for a confident current-state claim

Important scope note:
- This matrix is not a claim that every workflow below has been fully replayed end to end in the current session.
- It is a current evidence register. If a workflow lacks `Live verified now`, treat it as still needing active verification.

## 1. Auth and Project Entry

### Workflow
1. Load app
2. Pass auth gate
3. Reach project picker
4. Open/create/select project
5. Land in workspace

### Evidence
- Live verified now: `/projects`
- Prior QA verified: yes
- Code inspected:
  - [client/src/App.tsx](/home/wtyler/Projects/ProtoPulse/client/src/App.tsx)
  - [client/src/lib/auth-context.tsx](/home/wtyler/Projects/ProtoPulse/client/src/lib/auth-context.tsx)

### Status
- Current confidence: high
- Needs deeper revalidation:
  - multi-account cache separation
  - logout/login stale-project edge cases

## 2. Workspace Navigation and Tab Routing

### Workflow
1. Enter project workspace
2. Select tab
3. URL updates
4. Correct tab becomes active
5. Correct view mounts

### Evidence
- Live verified now: component editor deep link
- Prior QA verified: yes
- Code inspected:
  - [client/src/pages/ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx)
  - [client/src/components/layout/sidebar/sidebar-constants.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/layout/sidebar/sidebar-constants.ts)

### Status
- Current confidence: medium-high
- Needs deeper revalidation:
  - all tab buttons, not just sampled routes
  - browser back/forward across many tabs

## 3. Architecture Workflow

### Workflow
1. Open architecture view
2. Inspect/add/edit nodes and edges
3. Persist changes
4. Feed downstream views and AI

### Evidence
- Live verified now:
  - `/projects/18/architecture` loads and remains stable
  - the real canvas, asset library, and `Analyze design` drawer render
  - selecting `ESP32-S3-WROOM-1` and closing the analysis drawer reveals a real `Node Properties` inspector
  - adding `BME280` from the asset library increases the live graph from `2` nodes to `3`
  - the docked `Design Suggestions` panel appears after that architecture mutation
  - accepting `Add a power indicator LED` now adds a correctly labeled `Power LED` node
  - the follow-on recommendation now reads `Add current limiting resistor for Power LED`
  - accepting the resistor suggestion adds a correctly labeled `330R resistor` node
  - the sample project architecture was restored to its original two-node state after the verification pass
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/views/ArchitectureView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArchitectureView.tsx)
  - [client/src/components/ui/PredictionPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/ui/PredictionPanel.tsx)
  - [client/src/components/ui/PredictionCard.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/ui/PredictionCard.tsx)
  - [client/src/lib/prediction-actions.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/prediction-actions.ts)
  - [client/src/lib/ai-prediction-engine.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/ai-prediction-engine.ts)
  - [client/src/pages/ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx)
  - [server/routes/architecture.ts](/home/wtyler/Projects/ProtoPulse/server/routes/architecture.ts)
  - [server/storage/architecture.ts](/home/wtyler/Projects/ProtoPulse/server/storage/architecture.ts)

### Status
- Current confidence: medium-high
- Needs deeper revalidation:
  - edge creation/deletion and richer edit flows
  - undo/redo and history interactions
  - persistence after manual graph edits and reloads
  - suggestion action types beyond the verified `add_component` path; `open_view` and `show_info` are still code-inspected only
  - fresh React Flow parent-container sizing warning still appears in the console during the current architecture pass

## 4. Schematic / Breadboard / PCB Workflow

### Workflow
1. Build circuit design
2. Edit nets/components/layout
3. Validate rules
4. Export/manufacture

### Evidence
- Live verified now:
  - `/projects/18/schematic` loads on the current dev server and renders the real schematic editor frame with toolbar, parts panel, canvas, `Push to PCB`, and `Add Component`
  - dragging `ATtiny85` from the parts panel onto the canvas creates `U1`, enables `Push to PCB`, and surfaces the real `Add U1 to BOM?` notification
  - after the ownership middleware fix and dev-server restart, `GET /api/projects/18/circuits/5` now returns `200` in the live browser network log instead of the earlier `404 {"message":"Project not found"}`
  - selecting `U1` and pressing `Delete` removes the instance, restores the `Empty Schematic` state, and disables `Push to PCB` again
  - `Add Component` opens the real searchable overlay and it closes cleanly via `Escape`
  - clicking `Place ATtiny85 on schematic` from that overlay creates `U1`
  - pressing `Enter` from the focused overlay also creates `U1` and hits `POST /api/circuits/5/instances -> 201`
  - `Push to PCB` opens a real confirmation dialog and confirming it surfaces `Pushed to PCB`
  - `/projects/18/pcb` renders the real layout UI and shows `U1` after the push
  - deleting `U1` from the schematic and revisiting `/projects/18/pcb` restores `Empty PCB Board`
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/circuit-editor/SchematicCanvas.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/circuit-editor/SchematicCanvas.tsx)
  - [client/src/lib/circuit-editor/hooks.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/circuit-editor/hooks.ts)
  - [client/src/components/circuit-editor/BreadboardView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/circuit-editor/BreadboardView.tsx)
  - [client/src/components/circuit-editor/PCBLayoutView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/circuit-editor/PCBLayoutView.tsx)
  - [client/src/lib/circuit-editor/view-sync.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/circuit-editor/view-sync.ts)
  - [server/circuit-routes/designs.ts](/home/wtyler/Projects/ProtoPulse/server/circuit-routes/designs.ts)
  - [server/routes/auth-middleware.ts](/home/wtyler/Projects/ProtoPulse/server/routes/auth-middleware.ts)
  - [server/circuit-routes/*](/home/wtyler/Projects/ProtoPulse/server/circuit-routes.ts)
  - [server/__tests__/ownership-integration.test.ts](/home/wtyler/Projects/ProtoPulse/server/__tests__/ownership-integration.test.ts)
  - [server/__tests__/project-ownership.test.ts](/home/wtyler/Projects/ProtoPulse/server/__tests__/project-ownership.test.ts)

### Status
- Current confidence: medium-high
- Needs deeper revalidation:
  - advanced wiring, annotation, net-browser, and sheet-editing edge cases
  - Push-to-PCB behavior after multi-component or non-trivial schematic edits
  - ~~Breadboard placement/sync gap~~ **FIXED (Wave 155)**: auto-placement already assigns coordinates on mount; wire sync now calls `syncSchematicToBreadboard()` to create missing breadboard wires from schematic net segments
  - the current Breadboard UI did not expose an obvious placement source beyond the generic project explorer/sidebar in the same pass, so the route remains low-confidence for practical usability
  - manufacturing/export parity

## 5. Component Editor Workflow

### Workflow
1. Open component editor
2. Switch sub-tabs/content modes
3. Generate/edit/export component artifacts

### Evidence
- Live verified now: direct route opens and remains stable
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/views/ComponentEditorView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ComponentEditorView.tsx)

### Status
- Current confidence: high for route stability
- Needs deeper revalidation:
  - generation and export sub-actions
  - deep editing state persistence

## 6. BOM / Procurement Workflow

### Workflow
1. Add/manage BOM items
2. price/source parts
3. compare alternates
4. export procurement artifacts

### Evidence
- Live verified now:
  - direct route `/projects/18/procurement` remains stable
  - `Add Item` opens the `Add BOM Item` dialog
  - `Compare Suppliers` opens the comparison dialog
  - `AVL Compliance` tab renders to its empty state
  - `BOM Comparison` tab renders to its empty state
  - `Add to BOM` from the Ohm's Law calculator now succeeds in the live app after a shared BOM schema fix for numeric `unitPrice` input
  - a fresh authenticated API probe immediately after that calculator action showed `GET /api/projects/18/bom -> total: 1` with `Resistor 250 Ω (from Ohm's Law calculator)` and normalized price strings
  - a fresh authenticated API probe confirmed `PATCH /api/projects/18/bom/6` accepts numeric `unitPrice: 0.25`, returns `200`, and normalizes it to `unitPrice: "0.2500"` / `totalPrice: "0.2500"`
  - cleanup deleted the temporary BOM row and restored the sample project back to `0` BOM items
- Prior QA verified: yes
- Code inspected:
  - [server/routes/bom.ts](/home/wtyler/Projects/ProtoPulse/server/routes/bom.ts)
  - [server/storage/bom.ts](/home/wtyler/Projects/ProtoPulse/server/storage/bom.ts)
  - [client/src/pages/ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx)
  - [client/src/components/views/ProcurementView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ProcurementView.tsx)

### Status
- Current confidence: medium
- Needs deeper revalidation:
  - create/edit/save/delete BOM item flows beyond dialog open
  - external pricing truthfulness
  - alternate-part quality
  - procurement export artifact generation
  - automated route regression is still weaker than the live evidence here; the shared schema regression passed, but `server/__tests__/bom-routes.test.ts` still has a harness issue that leaves `baseUrl` undefined under current Vitest execution

## 7. Validation Workflow

### Workflow
1. Run validation
2. inspect issues
3. navigate/fix findings

### Evidence
- Live verified now:
  - `/projects/18/validation` loads and remains stable
  - `System Validation` heading and issue summary render
  - DRC controls, DFM controls, manufacturer compare, BOM completeness, and troubleshooter sections render
  - clicking the `Validation` tab from `/projects/18/community` immediately updates the route to `/projects/18/validation`
  - `Run DRC Checks` triggers `POST /api/projects/18/validation`, increments the visible issue count from `130` to `131`, and raises `Validation Running`
  - opening `Floating Inputs` in the troubleshooter reveals a structured detail view with symptoms, root cause, fix steps, and related issues
  - the troubleshooter detail view returns cleanly to the issue list via `Back to list`
  - `Custom Rules` opens a real `Custom DRC Rules` dialog with template, metadata, and script-editor controls
  - the `Custom DRC Rules` dialog dismisses via its explicit `Close` button
  - browser console stayed free of fresh warnings/errors during the validation pass
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/views/ValidationView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ValidationView.tsx)
  - [shared/drc-engine.ts](/home/wtyler/Projects/ProtoPulse/shared/drc-engine.ts)
  - [server/routes/validation.ts](/home/wtyler/Projects/ProtoPulse/server/routes/validation.ts)

### Status
- Current confidence: medium-high
- Needs deeper revalidation:
  - cross-tool navigation from issue to surface
  - keyboard dismissal on the `Custom DRC Rules` dialog; the fresh `Escape` rerun left it open
  - standards truth across all rule sets

## 8. Simulation Workflow

### Workflow
1. configure analysis
2. execute simulation
3. inspect waveforms/plots
4. compare outcomes

### Evidence
- Live verified now:
  - `/projects/18/simulation` loads and remains stable on the current dev server
  - the earlier `Run DC Operating Point` `404` is no longer reproduced after correcting the client/server simulation contract
  - the sample project currently has one circuit shell and zero placed circuit instances, which was confirmed via the live API during this pass
  - `Start Simulation` is disabled on the empty sample circuit
  - `Run DC Operating Point` is disabled on the empty sample circuit
  - opening `Results` shows a concrete empty-state message telling the user to place at least one component before simulating
  - `Add Probe` expands the probes section into editable `Probe name`, type, and `Node/Comp` controls
  - `Export SPICE` completes successfully and surfaces `Export Complete`
  - `Share` copies successfully and surfaces `Simulation link copied`
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/simulation/SimulationPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/simulation/SimulationPanel.tsx)
  - [client/src/lib/simulation/*](/home/wtyler/Projects/ProtoPulse/client/src/lib/simulation)
  - [server/circuit-routes/simulations.ts](/home/wtyler/Projects/ProtoPulse/server/circuit-routes/simulations.ts)

### Status
- Current confidence: medium
- Needs deeper revalidation:
  - a non-empty circuit with actual instances/nets still needs fresh live simulation coverage for DC, transient, AC, and sweep
  - numerical edge cases
  - long-running or malformed input controls

## 9. Arduino / Firmware Workflow

### Workflow
1. open Arduino workbench
2. manage files/profiles
3. compile/upload/monitor
4. inspect telemetry/runtime

### Evidence
- Live verified now:
  - `/projects/18/arduino` loads and remains stable
  - `Arduino Workbench` renders with sketch explorer, output tabs, and disabled compile controls in the empty-state case
  - `New file` opens the `New Sketch File` dialog
  - the `New Sketch File` dialog now includes descriptive text and no longer emits the earlier `DialogContent` accessibility warning
  - `/projects/18/circuit_code` now loads and remains stable after starter-evaluation fixes
  - the starter DSL is visible on first load and the preview resolves to `R1` / `10k`
  - the circuit-code status bar now shows `1 components` / `2 nets` on first load
  - `Apply to Project` is enabled on first load and succeeds with `POST /api/projects/18/circuits/apply-code -> 200`
  - `/projects/18/serial_monitor` now loads and remains stable after the targeted external-store snapshot fix
  - dismissing the serial monitor onboarding hint no longer trips the workspace error boundary
  - the disconnected-state serial monitor renders board, baud, and line-ending selectors plus DTR/RTS toggles and monitor controls
  - `/projects/18/starter_circuits` loads with populated templates and `Servo Sweep` expands into full details
  - `Open Circuit` on `Servo Sweep` now routes to `/projects/18/arduino` and shows the expected handoff toast instead of only copying code
  - the queued starter launch creates and selects `Servo_Sweep.ino` in the workbench, and the editor opens with the expected sketch content
  - reopening the same starter sketch succeeds again without the earlier storage failure; fresh server evidence showed `POST /api/projects/18/arduino/files/create -> 201` followed by `/api/projects/18/arduino/files` with `total: 1`
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/views/ArduinoWorkbenchView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/ArduinoWorkbenchView.tsx)
  - [client/src/components/views/StarterCircuitsPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/StarterCircuitsPanel.tsx)
  - [client/src/lib/starter-circuit-launch.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/starter-circuit-launch.ts)
  - [client/src/components/views/CircuitCodeView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/CircuitCodeView.tsx)
  - [client/src/lib/circuit-dsl/circuit-dsl-worker.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/circuit-dsl/circuit-dsl-worker.ts)
  - [client/src/components/panels/SerialMonitorPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/SerialMonitorPanel.tsx)
  - [client/src/lib/arduino/serial-logger.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/arduino/serial-logger.ts)
  - [server/routes/arduino.ts](/home/wtyler/Projects/ProtoPulse/server/routes/arduino.ts)
  - [server/storage/arduino.ts](/home/wtyler/Projects/ProtoPulse/server/storage/arduino.ts)
  - [server/routes/firmware-runtime.ts](/home/wtyler/Projects/ProtoPulse/server/routes/firmware-runtime.ts)

### Status
- Current confidence: medium
- Needs deeper revalidation:
  - hardware disconnect/reconnect
  - compile/runtime failure UX
  - rich editor mutations inside `Circuit Code` beyond the starter-template path
  - live connect/send/receive behavior with a real serial device

## 10. Tasks / Kanban Workflow

### Workflow
1. open the task board
2. create a task
3. move it between columns
4. edit/delete/filter as needed

### Evidence
- Live verified now:
  - `/projects/18/kanban` loads and remains stable
  - the current pass began with a persisted audit task already present, confirming the board is truly backed by `localStorage['protopulse-kanban-board']`
  - `Add task` opens a real `Create Task` dialog
  - the create action stays disabled until a task title is entered
  - creating a backlog task persists it to the board and increases the visible total task count from `0` to `1`
  - moving the new task right shifts it from `Backlog` to `To Do` and updates the column counts correctly
  - editing a persisted task updates its title, description, priority, tags, and assignee on the rendered card
  - adding tags and assignee unlocks the extra filter controls
  - filtering by assignee `Tyler` keeps the matching task visible
  - switching the priority filter to a non-matching value (`Low`) hides the task and drops the visible column counts to `0`
  - `Clear` restores the unfiltered board
  - deleting the persisted audit task returns the board to `0 tasks`, clears the stored task array, and reload preserves the empty baseline
  - browser console stayed free of fresh warnings/errors during the tasks pass
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/views/KanbanView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/KanbanView.tsx)
  - [client/src/lib/kanban-board.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/kanban-board.ts)

### Status
- Current confidence: medium
- Needs deeper revalidation:
  - custom column add/remove flows remain unverified in the current pass
  - due-date behavior and longer-lived multi-task ordering remain unverified

## 11. AI Chat and AI Actions

### Workflow
1. send prompt
2. stream response
3. parse suggested actions
4. execute project mutations

### Evidence
- Live verified now:
  - the `Project Summary` quick action sends a real prompt from the chat panel
  - the chat panel shows a live analyzing state before the response lands
  - the assistant returns a project summary plus follow-up chips
  - the `Run Validation` follow-up chip sends a new chat prompt and response copy, but no non-chat validation workflow request or route change was observed
  - the prompt `Switch to the Validation view now.` returned copy claiming success, but the route stayed on `/projects/18/community` until Validation was clicked manually
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/panels/ChatPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/ChatPanel.tsx)
  - [client/src/components/panels/chat/hooks/useActionExecutor.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/chat/hooks/useActionExecutor.ts)
  - [client/src/components/panels/chat/hooks/action-handlers/navigation.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/chat/hooks/action-handlers/navigation.ts)
  - [server/routes/chat.ts](/home/wtyler/Projects/ProtoPulse/server/routes/chat.ts)
  - [server/ai.ts](/home/wtyler/Projects/ProtoPulse/server/ai.ts)
  - [server/ai-tools/*](/home/wtyler/Projects/ProtoPulse/server/ai-tools)

### Status
- Current confidence: medium-low
- Needs deeper revalidation:
  - server-side tool execution extraction is currently suspect; fresh inspection shows `server/ai.ts` returns `done` with empty actions/toolCalls in the failed navigation pass
  - permission boundaries
  - confirmation enforcement
  - cross-project safety

## 12. History / Comments / Collaboration

### Workflow
1. inspect history
2. review comments
3. collaborate in real time

### Evidence
- Live verified now:
  - `/projects/18/design_history` loads and remains stable
  - onboarding hint can be dismissed
  - empty-state history UI renders with `Design Version History` and `Save Snapshot`
  - `Save Snapshot` opens a real save dialog with required-name validation
  - saving `Audit Snapshot 1` moves the visible count from `0` to `1` and renders the new snapshot row
  - saving a snapshot surfaces `Snapshot saved`
  - `Compare to Current` renders `No differences found` for that new snapshot
  - the delete confirmation can be dismissed without deleting the snapshot
  - `/projects/18/audit_trail` now loads and remains stable after the desktop route-map fix
  - the desktop `Audit Trail` tab remains selected on direct deep link
  - expanding `Motor Controller` reveals structured diff rows
  - searching `ATmega` filters the audit list to `1 entry (filtered from 5)` and exposes `Clear`
  - setting both date inputs to `2026-03-15` through `2026-03-16` reduces the audit list to `0 entries (filtered from 5)` and shows the empty state
  - clicking `Clear` restores the baseline `5 entries`
  - `Export CSV` generates a blob download named `audit-trail-2026-03-23.csv`; a fresh instrumentation pass observed `URL.createObjectURL()` plus anchor download click with `text/csv;charset=utf-8;` payload
  - `/projects/18/comments` loads and remains stable
  - existing comment data hydrates after a brief loading state
  - `Reply` opens reply mode with a reply textbox
  - reply mode can be cancelled cleanly
  - browser console stayed free of fresh warnings/errors during the history pass
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/views/AuditTrailView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/AuditTrailView.tsx)
  - [client/src/components/layout/sidebar/sidebar-constants.ts](/home/wtyler/Projects/ProtoPulse/client/src/components/layout/sidebar/sidebar-constants.ts)
  - [client/src/lib/sidebar-groups.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/sidebar-groups.ts)
  - [server/routes/design-history.ts](/home/wtyler/Projects/ProtoPulse/server/routes/design-history.ts)
  - [server/routes/comments.ts](/home/wtyler/Projects/ProtoPulse/server/routes/comments.ts)
  - [server/collaboration.ts](/home/wtyler/Projects/ProtoPulse/server/collaboration.ts)

### Status
- Current confidence: medium
- Needs deeper revalidation:
  - websocket auth transport
  - concurrent edit and lock semantics
  - comment mutation flows beyond reply-mode open/cancel
  - design-history delete affordance labeling; the current row-level delete trigger presented as an unlabeled icon-only button in the fresh pass

## 13. Export / Ordering / Manufacturing / Lifecycle

### Workflow
1. open export center
2. choose format
3. generate artifacts
4. optionally order PCB
5. inspect inventory and lifecycle support surfaces

### Evidence
- Live verified now:
  - `/projects/18/output` loads and remains stable
  - `EXPORT CENTER` renders with populated export categories and formats
  - `Download Firmware Scaffold` opens a real export precheck panel
  - the export precheck panel dismisses cleanly
  - `Export SPICE` from the Simulation screen initially reproduced a real server-side `500` when posted with an empty body
  - after a targeted server fix plus a fresh dev-server restart, `Export SPICE` now returns `200` and surfaces `Export Complete`
  - `/projects/18/ordering` loads and remains stable
  - `Order PCB` step 1 renders the board specification form
  - `Next` now advances from `1. Board Specs` to `2. Select Fab` in the current pass
  - `Select Fab` renders compatible/incompatible fabricator cards
  - selecting `JLCPCB`, running DFM, and advancing through `Quotes` to `Summary` all work in the current pass
  - the quote table is populated with deterministic client-side pricing (`JLCPCB` best at `$27.00` grand total for the default `5` boards)
  - clicking `Place Order` creates a `submitted` order in `localStorage['protopulse-pcb-orders']` with embedded DFM and quote data
  - a browser fetch/XHR probe stayed empty through the full quote/place-order flow, and the real backend endpoint `GET /api/projects/18/orders` remained empty, so the current route is not using the server-side ordering API
  - the fabricator API-key panel can store/remove a fab key through `/api/settings/api-keys`, but order placement does not depend on that key and still remains local-only
  - cleanup removed the temporary local order and restored the route to its initial baseline
  - the empty `Design Suggestions` overlay no longer covers the lower-right action area on Ordering
  - `/projects/18/storage` loads and remains stable
  - `Storage Manager` renders its empty state when the project BOM is empty
  - `Scan` opens the `Barcode Scanner` dialog and that dialog closes cleanly
  - with a temporary seeded BOM item, the non-empty path renders a grouped `Bin A1` section, `3 / 5` quantity readout, `Critical` status badge, and visible low-stock count
  - `Labels` opens a real print workflow with label-size, columns, selection, and preview controls
  - preview renders the selected part label correctly
  - a browser probe confirmed `Print 1 Label` reaches `window.open()`, writes printable HTML, focuses the print window, and invokes `print()`
  - cleanup deleted the temporary BOM item and restored the empty inventory baseline
  - `/projects/18/lifecycle` loads and remains stable
  - lifecycle onboarding hint dismisses cleanly
  - `Add Component` opens a real lifecycle tracking dialog
  - the lifecycle dialog closes cleanly via keyboard escape in the current pass
  - creating `AUDIT-LC-001` is a real persisted mutation; the table updates, the status cards move to `NRND 1 / 100%`, and the API returns the same record
  - reload preserves the created lifecycle record
  - editing that record to `EOL` updates the manufacturer/source fields, triggers the attention banner, and persists after reload
  - `Export CSV` is a real client-side blob download named `lifecycle-report-2026-03-23.csv`
  - deleting the temporary lifecycle entry is a real persisted mutation and reload restores the empty baseline
  - browser console stayed free of fresh warnings/errors during the export pass
  - browser console stayed free of fresh warnings/errors during the ordering, inventory, and lifecycle passes
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/panels/ExportPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/panels/ExportPanel.tsx)
  - [server/circuit-routes/exports.ts](/home/wtyler/Projects/ProtoPulse/server/circuit-routes/exports.ts)
  - [server/export/*](/home/wtyler/Projects/ProtoPulse/server/export)
  - [server/routes/ordering.ts](/home/wtyler/Projects/ProtoPulse/server/routes/ordering.ts)
  - [client/src/components/views/StorageManagerPanel.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/StorageManagerPanel.tsx)
  - [client/src/components/views/LifecycleDashboard.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/LifecycleDashboard.tsx)

### Status
- Current confidence: medium
- Needs deeper revalidation:
  - artifact correctness against external tools
  - ordering artifact handoff remains incomplete because the current route does not use the server-side order API or any real fabricator submission flow
  - pricing realism/truthfulness still needs external validation because quote generation is currently deterministic client math, not live fab pricing
  - inventory editing/reassignment flows remain limited because the current route is a BOM-backed viewer plus scanner/label tooling, not a full standalone inventory editor
  - lifecycle replacement recommendation quality / data richness

## 14. 3D View / Patterns / Calculators / Knowledge / Labs / Community / Generative / Digital Twin

### Workflow
Explore advanced support and ecosystem tabs.

### Evidence
- Live verified now:
  - `/projects/18/viewer_3d` loads and remains stable
  - `3D Board Viewer` renders real camera-angle controls, layer toggles, dimensions, and edit-board controls
  - switching from `Iso` to `Front` updates the active camera-angle selection
  - editing board dimensions from `100 x 80 x 1.6` to `120 x 90 x 2` and pressing `Apply` updates the inline scene dimensions plus the side-panel dimensions card
  - toggling `Top Copper` changes the live checkbox state and can be restored cleanly
  - `Export` generates a blob download named `board-3d-scene.json`; a fresh instrumentation pass observed `URL.createObjectURL()` plus anchor download click with `application/json` payload
  - the board dimensions and layer state were restored to the original `100 x 80 x 1.6` / `Top Copper` enabled baseline after the verification pass
  - `/projects/18/design_patterns` loads and remains stable
  - filtering patterns with `divider` reduces the library to `Voltage Divider` and updates the counter to `1 of 10`
  - applying the `Signal` category filter keeps the results consistent with the current search
  - switching to `My Snippets` reveals a populated snippet library with the expected `5 of 5` baseline count
  - `Create` opens a real snippet dialog with the expected form controls
  - creating a temporary snippet persists it, increments the count to `6 of 6`, and the dialog closes cleanly after the snippet-form state fix
  - expanding the temporary snippet reveals `Edit`, `Delete`, and `Duplicate` actions
  - `Duplicate` creates a persisted `Codex Audit Temp (Copy)` row and increments the count to `7 of 7`
  - `Edit` opens a real metadata dialog, saving `Codex Audit Temp Edited` persists the renamed row, and `Delete` removes it cleanly
  - after cleanup, the snippet library returns to the original `5 of 5` baseline
  - `/projects/18/calculators` loads and remains stable
  - dismissing the calculators onboarding hint works
  - `Ohm's Law` with `5 V` and `20 mA` returns `250 Ω` and `100 mW`
  - `Apply to Component` on that Ohm's Law result copies `250 Ω` to the clipboard and surfaces the real `Copied to clipboard` toast
  - `Add to BOM` on that Ohm's Law result now succeeds after the shared BOM schema fix and surfaces `Added to BOM`
  - the default `LED Resistor` inputs return `150 Ω` and `60 mW`
  - the default forward `Voltage Divider` inputs return `2.5 V`, `50.0%`, and `250 µA`
  - `/projects/18/knowledge` updates route and selected tab correctly
  - after hydration, `Electronics Knowledge Hub` renders with article count, search, filters, and article cards
  - `/projects/18/labs` updates route and selected tab correctly
  - `Lab Templates` renders with a populated lab list and working filters/search controls visible
  - selecting `LED Circuit Basics` opens a full lab detail view with objectives, steps, hints, and grading criteria
  - `Start Lab` switches the lab into tracked progress mode and `Mark Complete` advances the first step to `1/5` and `20%`
  - reloading after progress advances preserves the updated lab progress in both the detail view and the card list
  - `Reset` returns the lab to the pre-start state
  - reloading after `Reset` preserves the cleared state and leaves `localStorage['protopulse-lab-sessions']` empty again
  - `/projects/18/community` updates route and selected tab correctly
  - after hydration, `Community Library` renders with populated library content
  - the default `Browse` tab shows a populated catalog with real search and filter controls
  - the `Featured` tab opens and reveals populated featured/trending/new-arrivals sections
  - opening `USB-C Connector Module` reveals the real detail view and `Download Component`
  - clicking `Download Component` increments the local download count but does not create a blob, anchor download, fetch, or XHR, so it is currently not a real download/export workflow
  - the seeded library content does not include the metadata required by `shouldPromptBomAdd()` (`manufacturer` / `mpn`), so the BOM-prompt path is effectively unreachable in the shipped sample data
  - `Collections` opens correctly and `New` creates a persisted collection
  - post-submit DOM checks show the create dialog really does close; the earlier contrary impression came from a stale click snapshot
  - the current UI exposes no live add/remove/delete collection controls even though the data layer implements them
  - cleanup restored the library back to zero collections after the audit pass
  - `/projects/18/digital_twin` loads and remains stable
  - the Digital Twin empty state renders with `Connect`, `Generate Firmware`, and the expected no-data messages
  - a controlled runtime probe confirmed the `Connect` button reaches `navigator.serial.requestPort()` with real user activation
  - canceling that request path surfaces the expected `No port selected` toast
  - `Generate Firmware` opens the real firmware dialog
  - the firmware dialog exposes real board, baud-rate, sample-rate, and pin-configuration controls
  - `Add Pin` increments the pin count and exposes editable pin rows
  - `Generate Sketch` produces firmware output from default settings
  - adding a pin and regenerating updates the generated code with pin-specific constants, telemetry, manifest, and command handling
  - the firmware dialog closes cleanly
  - `/projects/18/generative_design` loads and remains stable
  - clicking `Generate` with an empty description still produces candidates in the current pass
  - that blank-input generate pass did not emit any fresh XHR/fetch request in the live network log
  - `Compare` expands a visible diff against the current design and surfaced `1 component added` / `ADDED D101`
  - `Export` generates a blob download named `candidate-cand-b171216f.json`; a fresh instrumentation pass observed `URL.createObjectURL()` plus anchor download click with `application/json` payload
  - browser console stayed free of fresh warnings/errors during the patterns, calculators, labs, and learn passes
  - browser console stayed free of fresh warnings/errors during the 3D View, community, Digital Twin, and generative passes
- Prior QA verified: yes
- Code inspected:
  - [client/src/components/views/BoardViewer3DView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/BoardViewer3DView.tsx)
  - [client/src/components/views/DesignPatternsView.tsx](/home/wtyler/Projects/ProtoPulse/client/src/components/views/DesignPatternsView.tsx)
  - [client/src/lib/design-reuse.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/design-reuse.ts)
  - [client/src/lib/design-patterns/index.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/design-patterns/index.ts)

### Status
- Current confidence: medium-low
- Needs deeper revalidation:
  - 3D viewer import truth remains unverified in the current pass
  - 3D viewer board edits still need persistence/reload verification
  - Design Patterns currently exposes no snippet/pattern placement or import bridge into Schematic or Architecture; fresh live UI and code inspection both show only library-management actions
  - calculator apply-actions are now only partially covered: the Ohm's Law `Apply to Component` and `Add to BOM` paths are live-verified, but equivalent apply paths from other calculator result types still need revalidation
  - lab authoring/branching/submission behavior beyond progress persistence and reset
  - community collection management remains incomplete in the current UI: add/remove/delete controls are missing even though the data layer supports them
  - ~~community `Download Component` remains mislabeled~~ **FIXED (Wave 155)**: now produces a real JSON blob download via createObjectURL
  - seeded community sample data needs richer sourcing metadata before the BOM-prompt bridge can be exercised live
  - real hardware connection via native serial picker and attached device data in Digital Twin
  - generative input validation and candidate-score truthfulness
  - generative likely still runs as a local/mock client feature rather than a backend/AI-backed workflow in the current implementation
  - generative adopt side effects and user feedback
  - actual data fidelity and user value versus placeholder risk

## 15. Global Overlays and Utilities

### Workflow
Command palette, shortcuts, theme, hints, onboarding, dialogs, panels.

### Evidence
- Prior QA verified: yes
- Live verified now:
  - pressing `?` with non-editable workspace focus opens the `Keyboard Shortcuts` overlay
  - pressing `?` with the chat textarea focused inserts `?` into the input and does not open the overlay
- Code inspected:
  - [client/src/components/ui/*](/home/wtyler/Projects/ProtoPulse/client/src/components/ui)
  - [client/src/lib/keyboard-shortcuts.ts](/home/wtyler/Projects/ProtoPulse/client/src/lib/keyboard-shortcuts.ts)
  - [client/src/pages/ProjectWorkspace.tsx](/home/wtyler/Projects/ProtoPulse/client/src/pages/ProjectWorkspace.tsx)

### Status
- Current confidence: medium
- Needs deeper revalidation:
  - keyboard/focus behavior beyond the verified `?` overlay path
  - accessibility consistency

## 16. Overall Confidence Matrix

### Highest confidence
- project picker route
- deep-linked component editor route stability
- current HMR/CSP/runtime health
- overall route/tab model existence and mapping

### Medium confidence
- workspace shell
- BOM, validation, simulation, exports
- Arduino and firmware surfaces
- basic AI quick-action execution in chat

### Lowest confidence / highest need for next audit wave
- full-repo typecheck/build truth
- AI tool execution boundaries
- AI follow-up chips currently appear chat-only in the fresh `Run Validation` pass
- AI view-navigation requests currently include a fresh false-positive success case
- collaboration auth and role truth
- advanced tab maturity and completeness
- exporter correctness parity
