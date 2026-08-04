# Phase 3: UX & Workflow Evaluation — ProtoPulse

> Generated: 2026-07-18  
> Personas: Hobbyist maker; professional electrical engineer; hardware startup founder  
> Boundary: static code analysis only. No live browser, screen reader, keyboard-only walkthrough, hardware session, or performance trace was run, so this report identifies code-backed risks and strengths rather than claiming observed runtime behavior.

## Method and interpretation

The shipping legacy UI (`client/src`) and new engine editor (`packages/app/src`) were scanned separately. Raw attribute/keyword counts are **occurrences**, not the percentage of interactive controls that are accessible, not unique components, and not a conformance result. They help locate asymmetry; the file-level findings below establish the actual problems.

All findings get addressed — do not rank by priority/value/impact, do not fix only a subset, do not shrink the list. P0–P3 in the companion checklist records dependency/build order only. “Severity” describes the likely user consequence if the static path executes; it never authorizes omitting lower-severity findings.

## Accessibility scorecard

| Static signal (tests excluded) | Legacy `client/src` | Engine `packages/app/src` | Assessment |
|---|---:|---:|---|
| `aria-*=` occurrences | 541 | 24 | Legacy has broad semantic instrumentation; the engine surface is much thinner. |
| `role=` occurrences | 128 | 5 | Counts are signals only; the engine's custom side tabs lack the expected tab roles. |
| `tabIndex` occurrences | 30 | 0 | Engine canvas has no focus entry point. |
| `alt=` / `<img` occurrences | 10 / 9 | 0 / 0 | No missing engine image-alt claim is made because the engine has no `<img>` occurrence. |
| Keyboard-handler signals | 115 | 9 | Engine does implement global edit shortcuts, but not a focusable/announced editing region. |
| Loading-state keywords | 539 | 2 | Legacy has extensive loading/skeleton language; engine interactions are mostly local/synchronous. Count does not prove every wait state is covered. |
| User-feedback signals | 63 | 32 | Both layers include feedback mechanisms; some legacy “actions” use feedback instead of performing the action. |
| Overall grade | Not graded | Not graded | A grade would require live keyboard, screen-reader, reflow, contrast, and task testing. |

Reproduction pattern used for each scope:

```bash
rg -o 'aria-[A-Za-z-]+=' <scope> -g '*.tsx' -g '!**/__tests__/**' -g '!*test*' -g '!*spec*' | wc -l
rg -o 'role=' <scope> -g '*.tsx' -g '!**/__tests__/**' -g '!*test*' -g '!*spec*' | wc -l
rg -o 'tabIndex' <scope> -g '*.tsx' -g '!**/__tests__/**' -g '!*test*' -g '!*spec*' | wc -l
```

There are real legacy strengths: the workspace provides skip links, a focusable main region, tab-panel semantics, isolated error boundaries, and responsive side-panel controls (`client/src/pages/ProjectWorkspace.tsx:622-695`, `client/src/pages/ProjectWorkspace.tsx:774-795`). The shared `InteractiveCard` is a real button with keyboard activation and a focus-visible ring (`client/src/components/ui/interactive-card.tsx:5-22`, `client/src/components/ui/interactive-card.tsx:48-71`). The engine simulation plot also labels its canvas as an image (`packages/app/src/sim/Plot.tsx:310-315`).

The engine's primary design canvas is different: it renders as a bare `<canvas>` with no accessible name, role, focus target, instructions, or alternate selection state (`packages/app/src/editor/CanvasHost.tsx:524-524`). Keyboard shortcuts are attached globally and guarded against editable targets (`packages/app/src/editor/CanvasHost.tsx:337-400`), which supports power use but does not provide an assistive-technology bridge. W3C's current guidance requires keyboard-operable UI to expose visible focus, and its tabs pattern calls for `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`, and arrow-key behavior ([WCAG focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [WAI-ARIA tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)).

### Navigation and accessibility are graph projections

The engine should not copy the legacy pattern of separately maintained `ViewMode`, sidebar, role, and renderer lists. Its target is one capability/projection registry that drives navigation, availability labels, role decisions, and panel mounting. Audit/history can derive from the op-log; supply/inventory views can derive from parts, BOM, and Buyer state; architecture and breadboard are explicit parity projections. The eight hidden legacy views are therefore both an immediate legacy registry bug and evidence for the engine registry design (`client/src/lib/project-context.tsx:139-139`, `client/src/components/layout/sidebar/sidebar-constants.ts:48-84`, `client/src/lib/role-presets.ts:126-154`).

The accessible circuit mode is also a projection, not a parallel accessibility document. Stable graph entities plus the session's selection and the UI store's current tool/tab/status provide the semantic tree, focus target, available commands, and announcements (`packages/app/src/state/session.ts:211-251`, `packages/app/src/state/ui.ts:8-40`, `packages/app/src/state/ui.ts:84-145`). A named/focusable canvas, semantic tabs, and graph-derived DOM tree can land without changing persisted op vocabulary. Any later stored annotations or preferences must use the `.ppx` migration/unknown-op/asset foundation, and the resulting behavior belongs in the required Playwright plus manual assistive-technology evidence bundle.

## Migration disposition matrix

Immediate honesty is mandatory even when the durable implementation belongs in the engine.

| Promise | Shipping action now | Engine parity / retirement gate |
|---|---|---|
| Samples | Implement the declared legacy payload now and freeze each sample as a parity fixture. | Materialize the same fixture through typed operations before canonical flip. |
| Team templates | Remove the rich preconfiguration claim; expose description-only behavior. | Recreate full policies/operations in the engine; backport only if required during grace. |
| Hidden role views | Restore working legacy views and mark every entry visible/preview/retired. | Map each to a capability projection or deliberate retirement record. |
| Radial actions | Remove/disable handlerless legacy actions. | Recreate useful commands as typed, eligibility-checked, undoable engine operations. |
| Milestones | Hide facts backed only by hard-coded flags. | Derive progress from graph operations, checks, simulation, export, review, and evidence. |
| Settings | Remove from normal navigation or label Preview. | Recreate canonical settings; provider secrets use the gateway boundary. |
| Community, flashing, quotes/orders | Label `local-only`, `emulated`, `preview`, or `blocked` from real capability state. | Enable `live` only after each roadmap decision/integration and its evidence exists. |
| Draftsman | Hide/disable the engine tab while it is a global-hook shell. | Expose only after the real proof-carrying crew integration is wired. |

## Persona 1: Hobbyist maker

### Workflow: onboarding

1. Authenticate, then arrive at the project picker (`client/src/App.tsx:63-89`).
2. See skeletons while loading, a retryable error state, auto-resume with “View All Projects,” searchable projects, and samples that remain visible (`client/src/pages/ProjectPickerPage.tsx:651-704`, `client/src/pages/ProjectPickerPage.tsx:706-735`). These are strong re-entry affordances.
3. Open a sample. The gallery promises named workflows, time, cost, and a concrete part count based on `preloadedData` (`client/src/components/views/SampleProjectGallery.tsx:63-76`, `client/src/components/views/SampleProjectGallery.tsx:122-150`). The sample model says nodes, edges, and BOM items are created on open (`client/src/lib/sample-projects.ts:1-7`, `client/src/lib/sample-projects.ts:59-73`). The handler actually creates only a name and description (`client/src/pages/ProjectPickerPage.tsx:613-621`). **Dead end and disposition:** implement this core shipping path now, then reuse the same sample fixture as engine parity evidence.
4. Create a project from a team template. The dialog promises preconfigured DRC rules, BOM requirements, and export presets (`client/src/pages/ProjectPickerPage.tsx:843-912`), and the selector previews those plus suggested components (`client/src/components/views/TeamTemplateSelector.tsx:93-108`, `client/src/components/views/TeamTemplateSelector.tsx:120-180`). The handler consumes only the generated description (`client/src/pages/ProjectPickerPage.tsx:598-604`). **Dead end and disposition:** remove the rich legacy promise now; recreate full template semantics as typed engine policy/operations before the flip.

### Workflow: core daily loop

The hobbyist moves through architecture, schematic, breadboard, Arduino, simulation, validation, and export using grouped navigation and a persistent URL/view mapping (`client/src/components/layout/sidebar/sidebar-constants.ts:48-84`, `client/src/pages/ProjectWorkspace.tsx:402-448`). The workspace auto-collapses panels at 1024/1280px and allows keyboard-operable resize handles (`client/src/pages/ProjectWorkspace.tsx:510-542`, `client/src/pages/ProjectWorkspace.tsx:659-680`, `client/src/pages/ProjectWorkspace.tsx:774-795`).

The progress layer is not yet trustworthy. Its state records real architecture/BOM counts but hard-codes circuit, DRC history, simulation, export, PCB, fabrication, variables, and community progress false (`client/src/pages/ProjectWorkspace.tsx:548-593`). Hide unsupported legacy milestones now; rebuild progress as a graph-derived engine projection so a returning user sees evidence-backed state rather than a second hand-maintained model.

### Workflow: advanced usage

Arduino, serial, simulation, digital-twin, generative, and PCB surfaces are routed (`client/src/pages/workspace/ViewRenderer.tsx:216-257`). Real-device WebSerial/WebUSB flashing is still open (`ROADMAP.md:235-265`), so the UI needs a sharp boundary between authoring/emulation and verified device programming.

The radial menu looks like a fast expert path: it detects view and target context and renders appropriate actions (`client/src/pages/ProjectWorkspace.tsx:372-392`, `client/src/pages/ProjectWorkspace.tsx:756-763`). Selection only displays a toast describing the action (`client/src/pages/ProjectWorkspace.tsx:394-400`). Remove handlerless legacy actions now; recreate the useful subset through the engine's typed dispatch/undo path.

### Workflow: error recovery and help

Project-list loading and error recovery are explicit (`client/src/pages/ProjectPickerPage.tsx:651-681`), and workspace regions are separately guarded (`client/src/pages/ProjectWorkspace.tsx:659-695`, `client/src/pages/ProjectWorkspace.tsx:776-795`). Two static gaps remain:

- A malformed or non-positive project ID redirects to project 1 instead of the picker, creating a confusing ownership/not-found detour (`client/src/pages/ProjectWorkspace.tsx:851-860`).
- Every project-ID change first waits for a hidden `/api/seed` call, with a five-second timeout and fail-open behavior (`client/src/lib/project-context.tsx:217-244`). In development that route may mutate the first returned project, not the requested one (`server/routes/seed.ts:382-395`).

### Workflow: collaboration and sharing

The engine has URL-fragment share links and live relay sync (`ROADMAP.md:2056-2082`), but the shipping legacy experience remains the default until the migration gate (`ROADMAP.md:2113-2142`). A hobbyist cannot infer from the two separate applications which collaboration path is canonical.

### Key friction points

| Issue | Severity | Surface | Consequence |
|---|---|---|---|
| Sample opens without its declared design | Critical | Legacy | The first learning path breaks at the moment of trust. |
| Template settings are discarded | High | Legacy | “Pre-configured” creation is not true. |
| Radial actions only toast | High | Legacy | A fast path appears functional but changes nothing. |
| Milestone state is mostly hard-coded | High | Legacy | Re-entry guidance cannot reflect completed work. |
| Real-device boundary is unclear | Medium | Legacy + engine | Emulation can be mistaken for device readiness. |

## Persona 2: Professional electrical engineer

### Workflow: onboarding

The professional enters the same project shell but is likely to choose the “Pro” role because it claims full access. `ALL_VIEWS` contains 27 entries (`client/src/lib/role-presets.ts:125-154`), while the sidebar registry contains 35 (`client/src/components/layout/sidebar/sidebar-constants.ts:48-84`). Eight implemented views—Vault, Labs, Audit Trail, Supply Chain, BOM Templates, My Parts, Alternates, and Part Usage—are omitted. Both sidebar modes filter through that set (`client/src/components/layout/Sidebar.tsx:135-154`, `client/src/components/layout/Sidebar.tsx:423-450`). **Findability failure and disposition:** restore working legacy reachability now, then map every view to an engine projection or explicit retirement record.

### Workflow: core daily loop

The legacy daily loop spans schematic, PCB, validation, simulation, procurement, output, lifecycle, history, and comments (`client/src/pages/workspace/ViewRenderer.tsx:86-159`). The engine daily loop is technically stronger: gestures and crew tools dispatch typed ops into a branch log, then derive graph, ERC, diff, renderer, sim, review, and export projections (`packages/app/src/state/session.ts:79-121`, `packages/app/src/state/session.ts:143-191`; `packages/graph/src/index.ts:1-54`).

The product does not yet present that as one coherent workflow. Legacy remains shipping while the engine editor is a second fixed shell, and the migration checklist is still open (`client/src/App.tsx:81-89`, `packages/app/src/App.tsx:333-348`, `ROADMAP.md:2113-2142`). Experts must mentally reconcile which surface owns the durable design.

### Workflow: advanced usage

The engine's side panel puts 17 schematic tabs, or 18 PCB tabs, into one horizontal strip (`packages/app/src/App.tsx:38-63`, `packages/app/src/App.tsx:291-329`). The CSS gives every tab equal flex inside a fixed 320px column, with no wrapping or overflow rule in the tab block (`packages/app/src/styles.css:72-89`, `packages/app/src/styles.css:222-247`). Static code therefore predicts cramped labels and poor feature scanning.

The panel behaves visually like tabs but exposes only a `<nav>` and buttons: no `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`, or arrow-key management appears in the implementation (`packages/app/src/App.tsx:291-329`). This affects keyboard and screen-reader users and also makes the information architecture harder to reason about.

Draftsman is another split truth. The roadmap marks the agent runtime shipped (`ROADMAP.md:11-20`), but the engine panel is disabled unless a global hook appears and otherwise says the agent “arrives” later (`packages/app/src/panels/DraftsmanPanel.tsx:20-50`).

### Workflow: error recovery and help

The engine preserves branch history and exposes status flashes (`packages/app/src/state/session.ts:79-121`, `packages/app/src/App.tsx:280-287`), but unreadable saved data falls back to a starter and the unload path flushes the active bundle (`packages/app/src/state/persistence.ts:53-62`, `packages/app/src/main.tsx:24-25`, `packages/app/src/main.tsx:48-53`). A professional needs a recovery choice and retained original, not a silent empty starting point.

### Workflow: collaboration and sharing

Share links, relay sync, branch sync, and persisted relay rooms are functional within their stated limits (`ROADMAP.md:2056-2082`). Community pack registry, publication, and moderation remain open (`ROADMAP.md:2083-2098`). The UI should state that split directly instead of treating a local part-pack format as a complete distribution system.

### Key friction points

| Issue | Severity | Surface | Consequence |
|---|---|---|---|
| Shipping and engine editors lack one canonical handoff | Critical | Both | Durable-source ambiguity affects every expert workflow. |
| Eight implemented views are hidden from Pro | High | Legacy | Advanced supply-chain, audit, inventory, and knowledge work is undiscoverable. |
| Saved-data failure has no recovery choice | Critical | Engine | A future/corrupt payload can be replaced by starter state. |
| Side-panel tab strip is overloaded and semantically incomplete | High | Engine | Features are cramped and keyboard/screen-reader navigation is weak. |
| Draftsman runtime/panel truth is split | Medium | Engine | A shipped crew promise opens to a disabled shell. |

## Persona 3: Hardware startup founder

### Workflow: onboarding

The founder needs project state, cost, supply risk, team visibility, and a clear route to manufacturing. The project picker handles recents, archive/restore, status badges, and auto-resume (`client/src/pages/ProjectPickerPage.tsx:470-533`, `client/src/pages/ProjectPickerPage.tsx:546-589`, `client/src/pages/ProjectPickerPage.tsx:684-704`). But template creation silently drops the very DRC/BOM/export policy data a team would select (`client/src/lib/team-templates.ts:67-76`, `client/src/pages/ProjectPickerPage.tsx:598-604`).

### Workflow: core daily loop

The visible suite includes procurement, lifecycle, comments, history, output, and ordering (`client/src/pages/workspace/ViewRenderer.tsx:109-159`, `client/src/pages/workspace/ViewRenderer.tsx:202-215`). Yet Supply Chain, BOM Templates, My Parts, Alternates, Part Usage, and Audit Trail are among the role-filter omissions (`client/src/components/layout/sidebar/sidebar-constants.ts:71-83`, `client/src/lib/role-presets.ts:126-154`). These are precisely the cross-project and operations surfaces a founder needs.

### Workflow: advanced usage

The engine has review artifacts, collaboration, provenance-aware part packs, and fab-specific rule decks (`ROADMAP.md:81-134`, `ROADMAP.md:2056-2109`). Real pack registry/sharing, board packs, and live quote/ordering APIs remain open decisions (`ROADMAP.md:2091-2111`). The legacy UI can route to Community and Order PCB today (`client/src/components/layout/sidebar/sidebar-constants.ts:64-66`), so maturity labels and empty states must state what is local, simulated, static, or live.

### Workflow: error recovery and help

Workspace regions use error boundaries and loading fallbacks (`client/src/pages/workspace/ViewRenderer.tsx:55-313`). The settings route, however, advertises Profile, Appearance, and API Keys while every tab is an intentional placeholder (`client/src/pages/settings/SettingsPage.tsx:7-18`, `client/src/pages/settings/SettingsPage.tsx:23-52`). Remove it from normal legacy navigation or label it Preview now; recreate only canonical settings, with provider secrets owned by the private gateway boundary.

### Workflow: collaboration and sharing

The engine collaboration substrate is strong, but legacy retirement has not begun and Tyler's real projects have not been importer-proven (`ROADMAP.md:2113-2142`). Until that transition is explicit, a founder cannot know whether a shared engine design and a legacy project are the same source of truth.

### Key friction points

| Issue | Severity | Surface | Consequence |
|---|---|---|---|
| Team template policy is discarded | Critical | Legacy | Team standards do not survive project creation. |
| Operations views are hidden | High | Legacy | Supply and inventory work appears absent. |
| Community/order labels outrun live integrations | High | Both | Static/local capability can be mistaken for live service. |
| Settings is an intentional placeholder | High | Legacy | Configuration path ends without controls. |
| Legacy/engine source-of-truth transition is unresolved | Critical | Both | Collaboration and manufacturing handoff lack one canonical design. |

## Cross-persona issues

| Finding | Consequence | Evidence | Checklist |
|---|---|---|---|
| Two product layers without a completed transition | Users cannot tell which editor or design representation is canonical. | `client/src/App.tsx:81-89`; `packages/app/src/App.tsx:333-348`; `ROADMAP.md:2113-2142` | UI-06 |
| Sample payload discarded | A promoted onboarding path creates an empty project. | `client/src/lib/sample-projects.ts:59-73`; `client/src/pages/ProjectPickerPage.tsx:613-621` | UI-02 |
| Template configuration discarded | Project creation promises standards it does not persist. | `client/src/lib/team-templates.ts:67-76`; `client/src/pages/ProjectPickerPage.tsx:598-604` | UI-03 |
| Eight views hidden by role presets | Implemented features are unreachable through normal navigation. | `client/src/components/layout/sidebar/sidebar-constants.ts:62-83`; `client/src/lib/role-presets.ts:126-154` | UI-01 |
| Radial menu is feedback-only | A visible action surface executes no actions. | `client/src/pages/ProjectWorkspace.tsx:394-400` | UI-04 |
| Progress model is mostly hard-coded | Re-entry guidance is inaccurate after real work. | `client/src/pages/ProjectWorkspace.tsx:548-593` | UI-05 |
| Engine layout is fixed and panel-dense | Reflow and feature scanning are fragile. | `packages/app/src/App.tsx:38-63`; `packages/app/src/styles.css:72-89`; `packages/app/src/styles.css:222-247` | UI-07, UI-08 |
| Main engine canvas has no semantic/focus bridge | Pointer rendering is not translated into an accessible editing model. | `packages/app/src/editor/CanvasHost.tsx:337-400`, `packages/app/src/editor/CanvasHost.tsx:524-524` | UI-09 |
| Stub settings and Draftsman surfaces are routable | Users can enter intentionally nonfunctional screens. | `client/src/pages/settings/SettingsPage.tsx:7-18`; `packages/app/src/panels/DraftsmanPanel.tsx:20-50` | UI-11, UI-12 |
| Engine saved-data recovery is fail-open | Unsupported/corrupt data can fall through to a starter with no recovery choice. | `packages/app/src/state/persistence.ts:53-62`; `packages/app/src/main.tsx:48-53` | UI-17 |

## Quick implementation starts

These are small dependency starts, not a subset of the required work.

| Start | Effort | Why it can move first | Files |
|---|---|---|---|
| Add a nav-registry invariant test and restore the eight omitted role entries | S | No backend dependency; restores existing surfaces. | `client/src/lib/role-presets.ts`, `client/src/components/layout/sidebar/sidebar-constants.ts` |
| Redirect malformed project IDs to `/projects` with an explanatory toast/state | S | Removes a confusing detour without schema work. | `client/src/pages/ProjectWorkspace.tsx` |
| Label or temporarily remove radial actions until handlers exist | S | Stops a false action promise while real handlers are built. | `client/src/pages/ProjectWorkspace.tsx` |
| Label Settings and Draftsman as preview/disabled at the entry point | S | Makes current maturity honest before full implementation. | `client/src/pages/settings/SettingsPage.tsx`, `packages/app/src/panels/DraftsmanPanel.tsx` |
| Add engine `:focus-visible` styling and tab semantics | M | Improves keyboard orientation before the larger canvas bridge. | `packages/app/src/styles.css`, `packages/app/src/App.tsx` |

## Information architecture assessment

### What works

- Legacy groups a very broad feature set instead of presenting a flat 35-item list, supports collapsed and expanded modes, and preserves active view in URL/local state (`client/src/components/layout/sidebar/sidebar-constants.ts:48-84`, `client/src/pages/ProjectWorkspace.tsx:402-458`).
- The workspace provides a breadcrumb, command/search entry points, resizable side regions, mobile controls, and skip links (`client/src/pages/ProjectWorkspace.tsx:622-695`, `client/src/pages/ProjectWorkspace.tsx:801-845`).
- Engine tools share one side panel and one canonical graph session, reducing modal/window sprawl (`packages/app/src/App.tsx:291-348`, `packages/app/src/state/session.ts:79-121`).

### What breaks the model

1. **Registry drift:** `ViewMode`, sidebar items, role sets, and renderer branches are separately maintained. The eight omitted views are the concrete result (`client/src/lib/project-context.tsx:139-139`, `client/src/components/layout/sidebar/sidebar-constants.ts:48-84`, `client/src/lib/role-presets.ts:126-154`, `client/src/pages/workspace/ViewRenderer.tsx:258-313`).
2. **Two front doors:** legacy and engine expose overlapping design, simulation, AI, review, collaboration, and export concepts without a completed product-level transition (`ROADMAP.md:2113-2142`).
3. **Engine tab density:** 17–18 equal-width tabs inside 320px is not a scalable navigation hierarchy (`packages/app/src/App.tsx:38-63`, `packages/app/src/styles.css:72-89`, `packages/app/src/styles.css:222-247`).
4. **Truth gaps:** sample, template, radial menu, milestones, Settings, and Draftsman all render a more complete experience than their handlers/state provide. Each is a separate implementation seam and stays a separate checklist action.
5. **Proposed scope boundary:** the physical-system design-graph idea remains proposed and should not be introduced into current navigation or onboarding until Tyler accepts it and the prerequisite/user-value gates are met (`docs/adr/0017-physical-system-design-graph.md:1-6`, `docs/adr/0017-physical-system-design-graph.md:117-150`).

### Target registry and projection constraints

- The temporary legacy registry repair prevents current feature loss; it is not the engine architecture.
- The engine registry describes a capability, its projection component, availability state, required graph/package substrate, and migration disposition. It derives tabs/routes/labels so role and renderer lists cannot drift independently.
- Semantic accessibility derives from the graph and ephemeral selection/tool state; it does not fork design truth or wait for a new op type.
- Architecture, breadboard, requirements, and any persisted semantic annotations do change the durable parity envelope. They remain gated by evolution-safe `.ppx`, frozen migration fixtures, and real-project proving.
- UI-06 is the cross-phase migration outcome shared with FG-18, IN-19, and TD-26; UI-09 is the interaction edge shared with FG-15, IN-11, TD-13, and TD-20. Cross-references merge execution evidence, not the distinct UI findings.

The UX direction is therefore coherence before more surface area: make every existing promise true, make every implemented view findable, give the engine a responsive and accessible interaction model, and make the migration state explicit.
