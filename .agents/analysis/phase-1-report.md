# Phase 1: Current State Inventory — ProtoPulse

> Generated: 2026-07-18  
> Method: static repository analysis plus the 2026-07-18 measured baseline. No live browser, hardware, or end-to-end product session was run in this phase.

## Reading rule

This inventory separates four kinds of truth:

- **Shipped/current:** present in the shipping legacy application or marked shipped in the canonical roadmap.
- **In progress:** implemented foundations exist, but the roadmap still names open work or a product decision.
- **Proposed:** a design hypothesis awaiting acceptance; it is not current product scope.
- **Historical snapshot:** useful for structure, but its counts may have drifted.

All findings get addressed — do not rank by priority/value/impact, do not fix only a subset, do not shrink the list. P0–P3 in the companion checklist records dependency/build order only.

## Re-entry map

| State | What exists now | Evidence |
|---|---|---|
| Shipping product | The authenticated React application routes users through the project picker, project workspace, settings shell, and public embed viewer. The workspace exposes the legacy design suite. | `client/src/App.tsx:63-89`, `client/src/App.tsx:93-126`, `client/src/App.tsx:129-171` |
| Shipped engine foundation | Roadmap v0.1–v0.4 are marked shipped: graph/op-log, editor, ERC/export/CLI, simulation, crew runtime, review, PCB/DRC/routing, and fabrication export foundations. | `ROADMAP.md:9-49`, `ROADMAP.md:49-81`, `ROADMAP.md:81-136`, `ROADMAP.md:136-234` |
| In-progress engine work | v0.5 still has real-device WebSerial/WebUSB flashing and an opportunistic ESP32 long tail open; v0.6 has sync, share links, packs, and fab decks, while registry/sharing, board packs, and quote/ordering decisions remain open. | `ROADMAP.md:235-265`, `ROADMAP.md:2045-2051`, `ROADMAP.md:2051-2111` |
| Transition not yet completed | The legacy importer exists, but Tyler's real projects have not passed through it; default-UI flip, read-only grace, and area retirement remain open. | `ROADMAP.md:2113-2142` |
| Proposed only | ADR-0017 proposes an internal physical-system design-graph reframe. Its status is **Proposed**, Tyler is pending, its same-user assumption is unproven, and it requires schema-evolution foundations first. It must not be reported as current product scope. | `docs/adr/0017-physical-system-design-graph.md:1-6`, `docs/adr/0017-physical-system-design-graph.md:56-92`, `docs/adr/0017-physical-system-design-graph.md:117-150` |
| Structural snapshot | `.ref/project-dna.md` was generated 2026-06-28. It remains a useful structural index, but the current baseline and repository history include changes through 2026-07-10. | `.ref/project-dna.md:1-20`, `.agents/analysis/phase-0-metrics.md:116-125` |

The dominant current-state fact is the dual product layer: the shipping legacy React/Express/Postgres application and the 16-package graph/op-log engine/editor coexist in one repository. The baseline explicitly counts both (`.agents/analysis/phase-0-metrics.md:7-12`). Migration, rather than another isolated feature, is the main product-coherence seam.

## Migration disposition for incomplete promises

Legacy retirement is planned but has not begun (`ROADMAP.md:2113-2142`), so “the engine will replace it” is not a valid excuse for leaving a false promise live. Every gap has two decisions: what the shipping surface does immediately, and what must exist—or be explicitly retired—before the engine becomes canonical.

| Incomplete promise | Immediate disposition | Engine parity / retirement disposition | Coverage |
|---|---|---|---|
| Sample projects preload a working design | **Implement now in legacy.** This is the shipping first-run path: create nodes, edges, and BOM transactionally, then freeze the same sample as a migration/parity fixture. | Recreate from the fixture through normal typed operations before the default flip; the same expected graph and learning step must pass in both layers. | EN-04 / UI-02 |
| Team templates preconfigure DRC, BOM, export, naming, and parts | **Honestly reduce/disable now.** Until the fields really persist, label legacy creation “description template” and remove the rich preconfiguration claim. | Recreate full templates as typed engine operations/policies after compatibility safety; only backport the full legacy implementation if the feature must remain active through the read-only grace period. | EN-05 / UI-03 |
| Pro exposes every implemented view | **Repair now in legacy.** Restore the eight working views and require an explicit visible/preview/retired decision for every registry entry. | Map each legacy view to an engine projection/capability or a deliberate retirement record before removing it; do not clone legacy `ViewMode` as the engine architecture. | EN-06 / UI-01 |
| Radial menu selections execute actions | **Disable/remove now.** Do not render action items whose handlers only toast. | Recreate useful commands against the engine dispatcher as typed, eligibility-checked, undoable operations before claiming parity. | UI-04 |
| Milestones reflect completed project work | **Disable inaccurate milestones now.** Keep only facts backed by live selectors. | Recreate progress as a graph-derived projection over operations, checks, simulation, export, and review evidence rather than a second persisted progress model. | UI-05 |
| Settings contains profile, appearance, and API-key controls | **Remove from normal navigation or label Preview now.** The route-presence skeleton is not a settings product. | Recreate only settings that belong in the canonical editor; provider secrets follow the private gateway boundary, not a browser-key placeholder. | EN-15 / UI-12 |
| Community means publication/registry | **Label local-only now.** Keep file-based part packs, but do not imply hosting, publishing, or moderation. | Add a live engine state only after the registry product decision and authorization model are settled. | EN-12 / UI-16 |
| Device programming is live hardware flashing | **Label emulated/preview now.** Separate firmware authoring/emulation from physical flashing. | Enable the live state only after WebSerial/WebUSB is verified on named hardware with disconnect/retry evidence. | EN-10 / UI-16 |
| Order PCB provides live quotes/orders | **Label export-only/blocked now.** Preserve fab decks and deterministic files without implying an external transaction. | Add quote/order states only after account, consent, freshness, failure, and returned-evidence flows exist. | EN-14 / UI-16 |
| Draftsman is available in the engine editor | **Hide/disable honestly now.** The package runtime being shipped does not make the visible global-hook shell usable. | Wire the real proof-carrying crew path and expose the tab only when its provider/tool/approval boundary is ready. | EN-07 / UI-11 |

The target navigation model is a registry of **capabilities and projections**, each with a machine-readable state such as `available`, `local-only`, `emulated`, `preview`, `blocked`, or `live`. Audit/history can project the op-log; supply, inventory, alternates, usage, and templates can project parts/BOM/Buyer data; architecture and breadboard need explicit engine parity work; Labs and Vault are content/knowledge capabilities. The registry may control routes and labels, but it must not become another design database. The graph remains canonical (`packages/graph/src/index.ts:1-54`).

Accessibility follows the same rule. A semantic circuit tree, focus model, selection narration, and available-command list can materialize from the current graph plus ephemeral selection/tool/status state (`packages/app/src/state/session.ts:211-251`, `packages/app/src/state/ui.ts:8-40`, `packages/app/src/state/ui.ts:84-145`). This first slice does not require new persisted graph vocabulary and can begin while `.ppx` evolution work proceeds; any later stored annotations or preferences must pass the compatibility gate.

## Quantitative summary

| Metric | Current measured value | Evidence |
|---|---:|---|
| Product files counted by `scc` | 2,527 | `.agents/analysis/phase-0-metrics.md:13-24` |
| Product code | 701,993 lines (`scc`); 703,214 (`tokei`) | `.agents/analysis/phase-0-metrics.md:17-22` |
| Test files | 875 | `.agents/analysis/phase-0-metrics.md:23-25` |
| Root dependencies | 100 production + 49 development | `.agents/analysis/phase-0-metrics.md:33-35` |
| Engine workspaces | 16, plus `tools/golden` | `.agents/analysis/phase-0-metrics.md:33-38`, `.agents/analysis/phase-0-metrics.md:142-150` |
| PostgreSQL tables | 47 | `.agents/analysis/phase-0-metrics.md:35-38` |
| Raw route-handler declarations | 829 | `.agents/analysis/phase-0-metrics.md:35-38` |
| Intent markers | 90 TODO/FIXME/HACK/XXX occurrences | `.agents/analysis/phase-0-metrics.md:35-38` |

These figures are product-scoped to `client/src`, `server`, `shared`, `packages`, and `src-tauri`; generated output, dependencies, coverage, and Rust build artifacts are excluded (`.agents/analysis/phase-0-metrics.md:7-12`).

## Feature inventory

### Shipping legacy application

| Feature family | Maturity | Evidence | Current read |
|---|---|---|---|
| Authentication and application shell | Functional | `client/src/App.tsx:63-89`, `client/src/App.tsx:129-171` | Auth gate, loading state, routing, global providers, and toasts are wired. |
| Project picker and recents | Functional | `client/src/pages/ProjectPickerPage.tsx:470-533`, `client/src/pages/ProjectPickerPage.tsx:546-589` | Project selection, recent cleanup, create mutation, archive/restore, and auto-resume exist. |
| Sample-project onboarding | **Partial** | `client/src/lib/sample-projects.ts:1-14`, `client/src/lib/sample-projects.ts:59-73`, `client/src/pages/ProjectPickerPage.tsx:613-621` | Samples define nodes, edges, and BOM data, but opening one submits only name and description. The advertised design is not initialized. |
| Team-template onboarding | **Partial** | `client/src/lib/team-templates.ts:67-76`, `client/src/lib/team-templates.ts:370-386`, `client/src/pages/ProjectPickerPage.tsx:598-604` | DRC rules, BOM requirements, export presets, naming rules, and suggested components are returned, but the create path consumes only `projectDescription`. |
| Project workspace shell | Mature | `client/src/pages/ProjectWorkspace.tsx:510-542`, `client/src/pages/ProjectWorkspace.tsx:622-695`, `client/src/pages/ProjectWorkspace.tsx:774-795` | Responsive collapse, resize handles, skip links, isolated error boundaries, suspense, URL/view sync, and dual side panels are present. |
| Architecture, schematic, breadboard, PCB, component editor | Functional | `client/src/pages/workspace/ViewRenderer.tsx:72-108` | All primary design views are wired into the workspace. Maturity varies inside each view, but they are real routed surfaces rather than placeholders. |
| Procurement, validation, simulation, lifecycle | Functional | `client/src/pages/workspace/ViewRenderer.tsx:109-145` | Each has a concrete view; validation also mounts a troubleshooter panel on wide screens. |
| History, comments, tasks, storage, learning, patterns, calculators | Functional | `client/src/pages/workspace/ViewRenderer.tsx:146-194` | Project operations, reference material, and workflow support are routed and lazy-loaded. |
| 3D, community, ordering, serial, code, generative, digital twin | Partial | `client/src/pages/workspace/ViewRenderer.tsx:195-243`, `ROADMAP.md:2091-2111` | Views exist, but current roadmap truth limits registry/sharing and real fab ordering; surface labels must not imply those open integrations are complete. |
| Arduino and starter circuits | Functional, with device gap | `client/src/pages/workspace/ViewRenderer.tsx:244-257`, `ROADMAP.md:235-265` | Workbench and starter circuits exist; real-device WebSerial/WebUSB flashing remains open. |
| Labs, audit, supply chain, BOM templates, personal inventory, alternates, usage, vault | Functional but undiscoverable | `client/src/pages/workspace/ViewRenderer.tsx:258-313`, `client/src/components/layout/sidebar/sidebar-constants.ts:62-83`, `client/src/lib/role-presets.ts:126-154` | Eight wired views are absent from every role set. Restore legacy reachability now, then give each capability an engine-projection or explicit-retirement disposition. |
| Radial context actions | **Stub behavior** | `client/src/pages/ProjectWorkspace.tsx:372-400`, `client/src/pages/ProjectWorkspace.tsx:756-763` | Context detection and menu rendering exist; selection only shows an “Action” toast and executes no domain action. |
| Progress milestones | **Partial** | `client/src/pages/ProjectWorkspace.tsx:548-593` | Architecture and BOM state are read, but circuit, simulation, export, PCB, fabrication, design-variable, and community flags are hard-coded false. |
| Settings | **Stub** | `client/src/pages/settings/SettingsPage.tsx:7-18`, `client/src/pages/settings/SettingsPage.tsx:23-52`, `client/src/pages/settings/sections/ProfileSection.tsx:1-12` | `/settings` is intentionally a skeleton; Profile, Appearance, and API Keys do not provide controls yet. |
| Public embeds | Functional | `client/src/App.tsx:93-126` | Direct-data and short-code embed routes bypass the auth gate intentionally. |
| Desktop shell | Partial / build-blocked | `.agents/analysis/phase-0-metrics.md:127-140` | Tauri exists, but current packaging is red at `cargo audit`; browser/server and package CI are green in the sampled runs. |

### New graph/op-log engine and editor

| Capability | Maturity | Evidence | Current read |
|---|---|---|---|
| Canonical graph, typed ops, materialization, invariants | Mature | `packages/graph/src/index.ts:1-20`, `ROADMAP.md:11-24` | The design is represented as an operation log and materialized graph with validation and inversion. |
| Branch, diff, merge, history/replay | Mature | `packages/graph/src/index.ts:20-35`, `packages/app/src/state/session.ts:143-191`, `ROADMAP.md:21-29` | Branch history, replay, diff, and conflict resolution are first-class engine concepts. |
| Parts, ERC, export, CLI, content | Functional | `.agents/analysis/phase-0-metrics.md:42-58`, `ROADMAP.md:11-24` | Foundational package surfaces are shipped and covered by golden/export contracts. |
| Simulation | Mature foundation | `ROADMAP.md:49-80` | SPICE, multiple analyses, plots, streaming batch progress, and sim overlays are marked shipped. |
| MCU emulation and co-simulation | Functional / in progress | `ROADMAP.md:235-265`, `ROADMAP.md:2045-2049` | The base bridge is shipped; device flashing and the ESP32 long tail remain open. |
| PCB, DRC, routing, fab export | Mature foundation | `ROADMAP.md:136-234` | PCB graph ops, DRC, interactive routing, zones, and manufacturing exports are marked shipped. |
| AI crew runtime | Functional | `ROADMAP.md:81-134` | Analyst, Professor, Router, Architect, Buyer, and the shared loop exist. |
| Draftsman editor surface | **Stub** | `packages/app/src/panels/DraftsmanPanel.tsx:1-5`, `packages/app/src/panels/DraftsmanPanel.tsx:20-50` | The runtime is listed as shipped, but the visible panel is a disabled shell unless an undocumented global hook is installed. |
| Review and collaboration | Functional | `ROADMAP.md:81-95`, `ROADMAP.md:2056-2082` | Review artifacts, share links, sync relay, persistence, auth, and branch sync exist within stated limits. |
| Part-pack ecosystem | Partial | `ROADMAP.md:2083-2100` | File format, local load, provenance, persistence, and removal are shipped; hosting, publishing, moderation, and broader packs are open. |
| Quote and order integrations | Missing | `ROADMAP.md:2101-2111` | Fab rule decks exist, but real quote/order APIs remain a product and account decision. |
| Legacy migration | Partial | `ROADMAP.md:2113-2142` | Importer shipped; real-project proving, default flip, grace period, and retirement have not. |
| `.ppx` compatibility foundation | Partial / unsafe seam | `packages/graph/src/store/serialize.ts:20-26`, `packages/graph/src/store/serialize.ts:95-129`, `packages/graph/src/store/fs-store.ts:79-112` | Version is written but has no version dispatch/migration, unknown ops hard-fail, and the writer creates an assets directory without asset-reference handling. |
| Editor recovery from unreadable local data | **Unsafe partial** | `packages/app/src/state/persistence.ts:53-62`, `packages/app/src/main.tsx:24-25`, `packages/app/src/main.tsx:48-53` | An unreadable bundle falls back to a starter, then unload flushes the active bundle. Without a recovery choice, unsupported/corrupt local data can be replaced. |
| Physical-system graph expansion | **Proposed, not implemented scope** | `docs/adr/0017-physical-system-design-graph.md:56-92`, `docs/adr/0017-physical-system-design-graph.md:117-150` | Keep outside shipped/in-progress feature claims until Tyler accepts the ADR and its schema and user-value gates are met. |

## Data flow map

### Shipping legacy layer

```text
User action
  -> Wouter route / project workspace
  -> nested project domain providers
  -> React Query + apiRequest
  -> Express route barrel / domain routers
  -> storage + Drizzle
  -> PostgreSQL
  -> invalidation / provider state / rendered view
```

The route shell is in `client/src/App.tsx:81-89`. The project layer nests metadata, output, chat, history, parts, BOM, validation, Arduino, simulation, and architecture providers (`client/src/lib/project-context.tsx:139-171`). Project metadata reads and writes through React Query and `apiRequest` (`client/src/lib/contexts/project-meta-context.tsx:31-70`). Express registers the domain router set and then the circuit and circuit-AI routers (`server/routes.ts:47-90`).

One load-path exception is significant: every project-ID change first POSTs `/api/seed`, waits up to five seconds, and fail-opens before mounting domain providers (`client/src/lib/project-context.tsx:217-244`). The route is development-only and may seed the first project returned rather than the requested project (`server/routes/seed.ts:382-395`). This is a hidden bootstrap side effect, not normal project data flow.

### Graph/op-log engine layer

```text
Editor gesture or crew tool
  -> Zustand session dispatch
  -> typed OpBody envelope in BranchLog
  -> materialize(branch ops)
  -> canonical DesignGraph
  -> projections: renderer / ERC / DRC / route / sim / export / review
  -> .ppx persistence, share link, or relay sync
```

The session owns the mutable branch log, appends actor/lamport-stamped ops, and materializes a graph per branch (`packages/app/src/state/session.ts:79-121`, `packages/app/src/state/session.ts:143-180`). The graph package exports the op, materialization, invariant, inversion, branch, diff, merge, and serialization contracts (`packages/graph/src/index.ts:1-54`). This is a materially cleaner state spine than the legacy many-provider/API path, but it is not yet the shipping default (`ROADMAP.md:2113-2142`).

## Integration points

| Integration | Type | Status | Evidence |
|---|---|---|---|
| PostgreSQL + Drizzle | Database | Active in legacy | `.agents/analysis/phase-0-metrics.md:33-38`; `server/routes.ts:47-90` |
| Express API | Application API | Active | `server/routes.ts:1-37`, `server/routes.ts:47-90` |
| Legacy AI providers and Genkit | External API/runtime | Active legacy path | `server/index.ts:19-19`, `.ref/project-dna.md:10-13` |
| `@protopulse/ai` crew | Internal engine runtime + Anthropic provider | Functional; Draftsman UI stub | `ROADMAP.md:81-134`; `packages/app/src/panels/DraftsmanPanel.tsx:20-50` |
| WebSocket sync relay | Network collaboration | Functional with stated v1 limits | `ROADMAP.md:2061-2082` |
| URL-fragment share links | Serverless sharing | Functional | `ROADMAP.md:2056-2060` |
| ngspice-WASM | Simulation | Functional | `ROADMAP.md:49-80` |
| MCU emulators / co-sim | Emulation | Functional foundation; long tail open | `ROADMAP.md:235-265`, `ROADMAP.md:2045-2049` |
| WebSerial/WebUSB | Hardware | Missing real-device flashing | `ROADMAP.md:254-254` |
| Fab rule decks and export | Manufacturing | Functional | `ROADMAP.md:2101-2109` |
| Fab quote/order APIs | External API | Missing / decision needed | `ROADMAP.md:2110-2111` |
| Community pack registry | External service | Missing / decision needed | `ROADMAP.md:2083-2098` |
| Tauri | Desktop | Configured, current build blocked | `.agents/analysis/phase-0-metrics.md:127-140` |

## Navigation and entry points

### Legacy

- `/` and `/projects` open the project picker; `/projects/:projectId/*?` opens the workspace; `/settings` opens the settings skeleton; unknown routes render Not Found (`client/src/App.tsx:81-89`).
- `/embed/:data` and `/embed/s/:code` are public viewer routes (`client/src/App.tsx:93-126`).
- The workspace declares 36 `ViewMode` values (`client/src/lib/project-context.tsx:139-139`) and 35 sidebar entries grouped across design, analysis, hardware, manufacturing, AI/code, and documentation (`client/src/components/layout/sidebar/sidebar-constants.ts:48-84`). `project_explorer` is a shell concern rather than a standard sidebar destination.
- Every view is routed through `ViewRenderer` with an error boundary and suspense fallback (`client/src/pages/workspace/ViewRenderer.tsx:55-313`).
- Role presets filter both collapsed and expanded sidebars (`client/src/components/layout/Sidebar.tsx:135-154`, `client/src/components/layout/Sidebar.tsx:423-450`). The current `ALL_VIEWS` list ends at 27 entries and omits eight valid sidebar views (`client/src/lib/role-presets.ts:126-154`), creating a findability defect rather than a missing implementation.

### Engine editor

- The editor is a fixed three-column shell: palette, canvas/editor column, side panel (`packages/app/src/App.tsx:333-348`; `packages/app/src/styles.css:72-89`).
- Schematic mode exposes 17 side-panel tabs; PCB inserts DRC for 18 (`packages/app/src/App.tsx:38-63`). The tab bar switches panels directly (`packages/app/src/App.tsx:291-329`).

## Module breakdown

The module counts below reproduce the baseline `scc` total with `node_modules`, `dist`, `coverage`, and `target` excluded. “Files” includes every language counted by `scc`; its “code” column also counts JSON lock/config content as code, so the Tauri row is split to avoid implying that metadata is shell implementation.

| Module | `scc` files | `scc` code lines | Purpose |
|---|---:|---:|---|
| `client/src` | 1,684 | 505,599 | Shipping React application, views, editors, UI state |
| `server` | 336 | 85,096 | Express API, auth, persistence adapters, collaboration, legacy AI |
| `shared` | 104 | 22,203 | Database schema and shared domain logic |
| `packages` | 373 | 72,095 | 16-package graph/op-log engine and new editor |
| `src-tauri` | 30 total: 8 Rust + 22 manifest/metadata | 17,000 total: **1,479 Rust** + 15,521 manifest/metadata | Desktop shell, sidecars, lifecycle/storage bridge |
| **Total** | **2,527** | **701,993** | Matches the trusted product baseline (`.agents/analysis/phase-0-metrics.md:77-95`) |

## Developer intent signals

- The measured product scope contains 90 TODO/FIXME/HACK/XXX markers; this is a discovery index, not evidence that every occurrence is a defect (`.agents/analysis/phase-0-metrics.md:35-40`).
- The Draftsman panel explicitly labels itself a stub and asks for the real AI integration (`packages/app/src/panels/DraftsmanPanel.tsx:1-5`, `packages/app/src/panels/DraftsmanPanel.tsx:20-23`).
- Settings explicitly describe themselves as a Playwright/route skeleton whose full controls are deferred (`client/src/pages/settings/SettingsPage.tsx:7-18`).
- The roadmap is unusually honest about remaining cuts: flashing, registry/sharing, packs, quote/order APIs, real-project migration, UI flip, and retirement are all still unchecked (`ROADMAP.md:254-254`, `ROADMAP.md:2091-2111`, `ROADMAP.md:2135-2142`).
- `.ref/project-dna.md` remains useful for navigation, but its 2026-06-28 generated counts must not override the 2026-07-18 baseline or post-generation changes (`.ref/project-dna.md:1-20`, `.agents/analysis/phase-0-metrics.md:1-12`).

## Inventory conclusions

1. ProtoPulse is not a small prototype. It is a roughly 702k-line product with a shipping legacy suite and a capable second engine/editor (`.agents/analysis/phase-0-metrics.md:13-38`).
2. The engine foundation is real and broad; the migration into the shipping experience is not complete (`ROADMAP.md:11-234`, `ROADMAP.md:2113-2142`).
3. Several “present” legacy features are not actually usable as advertised: sample initialization, template application, radial actions, and milestone tracking each stop at a different implementation seam (`client/src/pages/ProjectPickerPage.tsx:598-621`, `client/src/pages/ProjectWorkspace.tsx:394-400`, `client/src/pages/ProjectWorkspace.tsx:548-593`). The disposition is explicit: implement the core sample path now; disable false template/radial/milestone claims immediately; recreate the durable behaviors as engine parity.
4. `.ppx` evolution and local-data recovery are dependency gates before broadening the graph vocabulary; this matters even if ADR-0017 remains unaccepted (`packages/graph/src/store/serialize.ts:20-26`, `packages/graph/src/store/serialize.ts:95-129`, `packages/app/src/state/persistence.ts:53-62`).
5. ADR-0017 stays **Proposed**. The current re-entry map must distinguish it from shipped EDA capabilities and open roadmap work (`docs/adr/0017-physical-system-design-graph.md:1-6`, `docs/adr/0017-physical-system-design-graph.md:117-150`).
