# ProtoPulse Product Analysis — 2026-07-18 Re-entry Baseline

> Generated: 2026-07-18
>
> Product scope: `client/src`, `server`, `shared`, `packages`, and `src-tauri`
>
> Stack: TypeScript 5.6, React 19.2, Express 5, PostgreSQL/Drizzle, Vite 7, Vitest 4, Tauri 2, npm workspaces
>
> Evidence boundary: static repository analysis, current canonical project records, current GitHub Actions evidence, and labeled outside-source research. No live browser, screen-reader, packaged-desktop, or physical-hardware session was run for this analysis.
>
> Historical boundary: the prior checklist reached 166/166 completed items on 2026-03-07 and remains in git history. This report establishes a separate 2026-07-18 baseline.

## Baseline Metrics

The trusted count excludes dependency folders, generated output, coverage, and Rust build artifacts. It includes both the shipping legacy application and the 16-package graph/op-log engine.

| Metric | Current value |
|---|---:|
| Files counted by `scc` | 2,527 |
| Code-like files | 2,466 |
| Product code, `scc` | 701,993 lines |
| Product code, `tokei` | 703,214 lines |
| TypeScript code, `scc` | 680,423 lines |
| Test files, canonical cross-language classifier | 874 |
| Approximate non-test code-like files | 1,592 |
| Approximate test:non-test file ratio | 0.55:1 |
| `scc` aggregate complexity | 98,541 |
| Git commits, rolling 30 / 90 days | 389 / 1,048 |
| Root production / development dependencies | 100 / 49 |
| Engine workspaces | 16, plus `tools/golden` |
| PostgreSQL `pgTable` declarations | 47 |
| Raw server route-handler declarations | 829 |
| Product-code intent markers | 90 |
| GitHub open issues / pull requests | 0 / 0 |
| Latest main CI / Packages CI / Tauri matrix | pass / pass / fail |

`scc` also emitted a $26.3M / 47.65-month / 49.06-person COCOMO estimate. That is only a scale signal, not a valuation, staffing recommendation, or schedule forecast. Full raw output and counting caveats are in Appendix C.

## Executive Summary

ProtoPulse is no longer the small browser EDA application described by the February analysis. It is roughly 702,000 lines of product code split across two substantial layers: the shipping React/Express/PostgreSQL suite and a 16-package engine built around one canonical graph, typed operations, deterministic exports, simulation, MCU emulation, review, routing, collaboration, and a provider-neutral crew runtime. The engine foundation is real. The product transition is not.

The central recommendation is explicit: **compatibility and recovery, honest capability states, and real-project migration form the return gate.** ProtoPulse should compose its shipped graph, simulation, review, and emulation primitives into complete workflows rather than start a third architecture. First make `.ppx` evolution safe, preserve unreadable data, and stop autosave from replacing the only copy. Then make every visible promise report a literal state—`available`, `local-only`, `emulated`, `preview`, `blocked`, or `live`. Finally, run Tyler's representative projects through the importer and new editor, retain before/after evidence, and let that result control the canonical-editor decision.

Three findings make this urgent. First, future or corrupt saved data can fall through to a starter and later be flushed. Second, samples, templates, radial actions, milestones, Settings, and Draftsman each expose more capability than their current handlers provide. Third, current desktop packaging completes for all five targets, but release evidence fails later on Rust advisories and skips packaged smoke. These are truth and recovery problems, not cosmetic cleanup.

Outside documentation, repositories, papers, maker projects, forums, and new social ideas are used here as knowledge and creative material. The strongest shared lesson is to make changes carry proof: intent, sources, typed operations, checks, simulation/scenario output, review, and a reversible decision. ProtoPulse already has most of those primitives. The work is to connect them, protect their data, and prove them on real use.

The final checklist contains 108 required findings: 20 FG, 17 UI, 28 TD, 23 EN, and 20 IN. P0–P3 are dependency stages only. Cross-category repetition is retained as lens evidence and coordinated through 12 implementation bundles.

## Where Tyler left it

The old product-analysis push is finished. Its 166/166 checklist closed on 2026-03-07 and stays in history.

Since then, ProtoPulse grew into a much larger system. The legacy application still ships. Beside it, the new engine now has the graph, operation log, branch/diff/merge, ERC/DRC, simulation, emulation, co-simulation, PCB routing, exports, review, relay, parts, CLI, content, and crew packages.

The unfinished work is the seam between them:

- the engine is not yet the canonical product surface;
- Tyler's real projects have not completed the migration proving loop;
- architecture and breadboard parity remain incomplete in the engine;
- saved-data evolution and recovery are unsafe;
- several visible legacy and engine promises are stubs, partial, or mislabeled;
- desktop packages build, but the release-evidence lane is red;
- ADR-0017 remains Proposed and must stay outside present product claims.

The clean place to resume is therefore not “pick another feature.” It is the return gate: preserve data, tell the truth in the UI, prove real projects, then flip the canonical surface only when the evidence says it is ready.

## Phase 1: Current State Inventory

### Evidence rule

This phase distinguishes four states:

- **Shipped/current:** present in the shipping application or marked shipped by the canonical roadmap.
- **In progress:** meaningful foundations exist, but named work or a product decision remains open.
- **Proposed:** a hypothesis awaiting acceptance; it is not present scope.
- **Historical:** useful for provenance, but not a current-state source.

Phase 1 used static source and current project records. It did not run the product or hardware.

### Re-entry map

| State | What exists now | Evidence |
|---|---|---|
| Shipping product | Authenticated project picker, project workspace, settings shell, public embed viewer, and the broad legacy design suite. | `client/src/App.tsx:63-171`; `client/src/pages/workspace/ViewRenderer.tsx:55-313` |
| Shipped engine foundation | Graph/op-log, editor, ERC/export/CLI, simulation, crew runtime, review, PCB/DRC/routing, and fabrication-export foundations. | `ROADMAP.md:9-234` |
| In-progress engine work | Real-device flashing, ESP32 long tail, pack publication, board packs, and quote/order decisions. | `ROADMAP.md:235-265`; `ROADMAP.md:2045-2111` |
| Transition open | Importer exists; real-project proving, default flip, read-only grace, and area retirement remain open. | `ROADMAP.md:2113-2142` |
| Proposed only | ADR-0017 physical-system graph direction; Tyler decision and same-user evidence are pending. | `docs/adr/0017-physical-system-design-graph.md:1-6,117-150` |

The dominant fact is the dual product layer. Legacy state travels through nested providers, React Query, Express, Drizzle, and PostgreSQL. Engine state travels through typed operations in a branch log, materializes one canonical `DesignGraph`, then feeds renderer, ERC, DRC, route, simulation, export, and review projections.

```text
legacy: user -> route/workspace -> domain providers -> React Query -> Express -> Drizzle -> PostgreSQL
engine: gesture/crew -> typed op -> BranchLog -> materialize -> DesignGraph -> projections/artifacts
```

The engine spine is cleaner, but it is not the shipping default. Migration is the product-coherence seam.

### Current feature inventory

| Surface | Current read | Main truth gap |
|---|---|---|
| Project picker and recents | Functional selection, search, create, archive/restore, and resume paths. | Sample payloads are declared but not created. |
| Team templates | Rich policy objects exist. | Creation consumes only the description. |
| Legacy workspace | Broad, routed, responsive, resizable, and guarded by per-view boundaries. | Eight implemented views are filtered out of every role. |
| Architecture, schematic, breadboard, PCB, component editor | Real routed surfaces. | They remain on the legacy side of the transition. |
| Procurement, validation, simulation, lifecycle, history, comments, tasks, storage, learning | Real routed surfaces. | Canonical engine disposition is not complete. |
| Radial menu | Context detection and menu rendering work. | Selection only reports an action; it does not execute it. |
| Milestones | Some architecture/BOM selectors are real. | Many completion flags are hard-coded false. |
| Settings | Route and tab skeleton exist. | Profile, appearance, and API-key controls are placeholders. |
| Graph, branches, diff/merge/replay | Mature engine foundation. | `.ppx` evolution and recovery remain unsafe. |
| Simulation, MCU emulation, co-simulation | Broad functional foundation. | Real-device flashing and fidelity long tail remain open. |
| AI crew | Shared runtime and roles exist. | Draftsman editor panel is a disabled global-hook shell. |
| Review, share fragments, relay | Functional foundations. | Room authorization/resource bounds and portable review workflow need hardening. |
| Part packs | Local parse/load/persist/remove exists. | Publication, moderation, richer projections, and field-level evidence remain open. |
| Tauri | Desktop shell and five target package jobs exist. | Release evidence currently fails after packaging. |

### Migration disposition for incomplete promises

| Promise | Shipping action now | Engine parity or retirement gate |
|---|---|---|
| Samples | Implement the declared legacy payload and freeze it as a parity fixture. | Recreate the same fixture through typed operations before flip. |
| Team templates | Reduce the current claim to description-only. | Recreate full policies as typed engine operations; backport only if grace requires it. |
| Hidden role views | Restore working legacy reachability now. | Map each capability to an engine projection or explicit retirement. |
| Radial actions | Disable/remove handlerless items. | Recreate useful commands as typed, eligible, undoable operations. |
| Milestones | Hide facts backed only by constants. | Derive progress from graph/check/simulation/export/review evidence. |
| Settings | Remove from normal navigation or label Preview. | Recreate canonical settings; provider secrets use the gateway boundary. |
| Community | Label `local-only`. | Enable `live` only after publication and authorization decisions are implemented. |
| Device programming | Label `emulated` or `preview`. | Enable `live` only after named-hardware WebSerial/WebUSB evidence. |
| Orders | Label `export-only` or `blocked`. | Enable `live` only with account, consent, freshness, failure, and returned evidence. |
| Draftsman | Hide/disable the shell. | Expose only after the proof-carrying crew path is wired. |

### Phase 1 findings

| ID | Finding and required outcome |
|---|---|
| EN-01 | `.ppx` needs explicit version dispatch, migrations, unknown-op policy, assets, and frozen fixtures before vocabulary growth. |
| EN-02 | Startup recovery must preserve unreadable data and block replacement until the user chooses an action. |
| EN-03 | `/api/seed` must become an explicit idempotent development bootstrap, not a hidden project-load gate. |
| EN-04 | Legacy samples must create their declared design transactionally and become engine parity fixtures. |
| EN-05 | Template claims must match description-only behavior now; full policy semantics belong in typed engine operations. |
| EN-06 | Restore eight hidden legacy views and derive engine navigation from one capability/projection registry. |
| EN-07 | Hide Draftsman now; later connect it to real provider, tool, approval, and evidence state. |
| EN-08 | Complete migration with real projects, per-capability disposition, loss reports, acceptance, grace, and ADR-backed retirement. |
| EN-09 | Keep ADR-0017 outside current scope until accepted and supported by schema and same-user evidence. |
| EN-10 | Separate emulation from live flashing and verify named hardware before using a live state. |
| EN-11 | Bound the ESP32 emulator long tail so support claims enumerate remaining limits. |
| EN-12 | Label pack travel `local-only`; decide hosting, identity, provenance, moderation, removal, and versioning before publication. |
| EN-13 | Build verified board/module starter packs only with the mandatory hardware evidence protocol. |
| EN-14 | Keep ordering export-only/blocked until quote/order account, consent, freshness, failure, and returned-evidence flows exist. |
| EN-15 | Label or remove Settings now; later expose only real canonical settings behind the provider gateway. |
| EN-16 | Clear or formally exception current Rust blockers and require complete release evidence before calling desktop delivery healthy. |
| EN-17 | Finish manual `pcbnew` import verification and retain the exact fixture and acceptance output with the golden contracts. |
| EN-18 | Generate current-state counts and maturity labels instead of maintaining drifting prose by hand. |

### Phase 1 conclusion

ProtoPulse is a large, broad product with a credible new state spine. The immediate job is coherence: repair false or hidden shipping paths, establish the data/recovery gate, and turn real-project migration into the evidence hub for the canonical-surface decision.

## Phase 2: Outside Inspiration & Knowledge Landscape

### Research frame and evidence labels

Outside work is used as evidence, teaching material, and creative input. No outside product or repository was live-tested in this phase.

| Label | Meaning |
|---|---|
| **ProtoPulse fact** | Verified in current local source or a current canonical project record. |
| **Verified documentation** | Described by a current official source; not independently exercised here. |
| **Upstream implementation claim** | Described by the project's own repository or documentation; promising until exercised. |
| **Research result** | Reported by a paper; not reproduced here. |
| **Community signal** | A forum or original social post; useful for questions and workflow clues, not prevalence claims. |
| **Raw inspiration** | Very new or unvalidated material; contributes an idea, not proof. |

### Local substrate that changes what to learn outside

| ProtoPulse substrate | Verified state | Consequence |
|---|---|---|
| Canonical graph and operation log | Typed mutations, inverse operations, branches, diff/merge/replay, and deterministic exports share one mechanism. | Evidence and review can attach to a change set instead of a later screenshot pile. |
| Review engine | Versioned reports, opened/closed deltas, decks, outside checks, and executable fixes exist. | Portable review can compose existing artifacts. |
| Firmware, simulation, and co-simulation | MCU cores, analog simulation, and a closed firmware-to-circuit loop exist. | Scenario CI and causal debugging are compositions, not a new simulator. |
| Local sharing and relay | URL-fragment sharing and branch-aware rooms exist. | Keep files primary; narrow authorization and bound resource use. |
| Part packs | Packs parse, collision-check, persist locally, and load atomically. | Extend evidence and projections rather than invent another package system. |
| Editor projections | Engine currently exposes Schematic and PCB. | Architecture, breadboard, and semantic access are coherence gaps. |
| Crew runtime | Tools emit exact operations; editor Draftsman remains a shell; mutation confirmation can be absent. | Agent editing must become fail-closed and proof-carrying. |
| `.ppx` and browser storage | No migration dispatch; unknown ops hard-fail; assets are a stub; unreadable local data can fall through to starter state. | Compatibility and recovery precede richer stored ideas. |
| Knowledge pipeline | `inbox/` → `/extract` → `knowledge/`, with the PP-NLM bridge returning material through the same path. | Product schemas should reference canonical evidence, not create a third corpus. |
| Production policy | Web and Tauri CSP reject string-to-code execution. | Custom checks/models need a constrained interpreter or isolated process. |

### Source-to-ingredient map

All links below were accessed 2026-07-18 unless a row states otherwise.

| Outside source | Evidence | Ingredient for ProtoPulse | Caution | IDs |
|---|---|---|---|---|
| [KiCad 10 project documentation](https://docs.kicad.org/10.0/en/kicad/kicad.html) | Verified documentation | Reusable design capsules, durable archives, editable round trips, release job artifacts. | Preserve native editability and report unsupported records. | FG-11, FG-14 |
| [Wokwi CI](https://docs.wokwi.com/wokwi-ci/cli-usage) and [Custom Chips API](https://docs.wokwi.com/chips-api/getting-started) | Verified documentation | Headless scenarios, serial expectations, VCD evidence, and bounded device-model authoring. | Simulation fidelity must remain explicit; outside custom code does not justify weakening CSP. | FG-07, FG-08, FG-09 |
| [Altium 365 design reviews](https://www.altium.com/documentation/altium-365/project-design-reviews?version=22) and [requirements](https://www.altium.com/documentation/altium-365/requirements-portal?version=7.0) | Verified documentation | Snapshot-bound reviews, checklists, roles, comments, closure, requirements, and verification traceability. | Keep the review artifact locally portable. | FG-05, FG-06, FG-16 |
| [AllSpice](https://www.allspice.io/) | Verified official description | Put visual diff, checks, comments, history, and sign-off in one review workflow. | Official descriptions are not independent usability evidence. | FG-06 |
| [Flux assistant](https://www.flux.ai/copilot), [project reuse](https://docs.flux.ai/flux/tutorials/reusing-community-projects), and [sharing permissions](https://docs.flux.ai/reference/reference-sharing-and-permissions) | Verified documentation | Context-rich proposals, explicit approval, reusable design seeds, and scoped sharing. | Generated changes still need deterministic checks and source evidence. | FG-03, FG-04, FG-11, FG-16 |
| [Fritzing synchronized views](https://fritzing.org/learning/get-started/project-view), [part creator](https://fritzing.org/learning/get-started/part-creator/), and [parts](https://fritzing.org/parts) | Verified documentation | Synchronized breadboard/schematic/PCB projections and cross-view connector mapping. | Visual agreement does not establish electrical or dimensional correctness. | FG-10, FG-12, FG-13 |
| [atopile](https://github.com/atopile/atopile), [tscircuit](https://github.com/tscircuit/tscircuit), and [circuit-synth](https://github.com/circuit-synth/circuit-synth) | Upstream implementation claims | Typed requirements, reusable modules, machine checks, registries, and ordinary software workflows. | Text/code must compile into the canonical operation log, not become a second design truth. | FG-05, FG-11, FG-14 |
| [KiCanvas](https://github.com/theacodes/kicanvas) | Upstream claim; project labels itself early alpha | Open browser embedding and a reference point for KiCad rendering. | Viewing does not prove lossless editing. | FG-14 |
| [jlceda-cocomment](https://github.com/ZZC43013/jlceda-cocomment) | **Raw inspiration**; created 2026-07-17, zero-star at inspection, README says it was not exercised in a real editor | Small local spatial-comment artifacts with threads and resolution state. | Idea card only; attach comments to stable graph anchors, not screen coordinates alone. | FG-06, FG-16 |
| [CircuitLM](https://arxiv.org/abs/2601.04505), [PCBSchemaGen](https://arxiv.org/abs/2602.00510), and [WiseEDA](https://openreview.net/forum?id=0gUM1XqtHr) | Research results | Agents orchestrate verified facts, typed tools, structural checks, constraints, and numeric solvers. | Benchmarks/prototypes may not transfer to this workload. | FG-03, FG-05, FG-10 |
| [HWE-Bench](https://arxiv.org/abs/2603.18102), [PCEval](https://openreview.net/forum?id=biJqDcw6i9), and [PCB-QA](https://arxiv.org/abs/2606.23704) | Research results | Proof-carrying edits, physical-layout tests, and a queryable semantic circuit representation. | HWE-Bench's reported 8.15% result is a warning, not a universal constant. | FG-03, FG-12, FG-15 |
| [Local-first software](https://www.inkandswitch.com/essay/local-first/) | Primary design essay | Primary local copies, offline use, portability, sync that carries rather than owns. | Browser localStorage alone is not durable long-term storage. | FG-02, FG-16 |
| [OSHWA process](https://certification.oshwa.org/process.html) and [Kitspace](https://kitspace.org/) | Verified documentation | Reproducible release capsules with source, license, fabrication, and sourcing records. | Do not imply certification or ordering before returned evidence exists. | FG-17, FG-20 |
| [PCB ReTrace](https://hackaday.io/project/204738-pcb-retrace) | Maker-project claim | Photo overlays, physical reconciliation, repair documentation, and discrepancy capture. | Computer-vision suggestions must remain reviewable. | FG-13 |
| [KiCad review discussion](https://forum.kicad.info/t/crowdsource-design-reviews/67923), [KiCad Prism discussion](https://forum.kicad.info/t/kicad-prism-a-self-hosted-web-based-platform-for-design-reviews-visualization/66518), and [board-review posting rules](https://www.reddit.com/r/PrintedCircuitBoard/comments/zj6ac8/please_read_before_posting_especially_if_using_a/) | Community signals | Review packets should state purpose and include readable views, checks, anchors, and durable context. | Anecdotes suggest workflow tests, not frequency. | FG-05, FG-06 |
| [MDN canvas guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage) and [W3C keyboard guidance](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html) | Verified standards/guidance | A graph-derived semantic tree and keyboard circuit operations. | Naming the canvas alone is insufficient; a parallel persisted model would drift. | FG-15 |
| [CadQuery](https://cadquery.readthedocs.io/en/stable/), [JSCAD](https://jscad.app/), and [ROS URDF](https://docs.ros.org/en/jazzy/p/urdf_tutorial/) | Verified documentation | Cheap external-kernel enclosure and kinematic experiments. | ADR-0017 is Proposed; floats and foreign kernels stay outside the graph core until validated. | FG-19 |
| [kicad-happy](https://github.com/aklofas/kicad-happy) | Upstream implementation claim; young repository | Composable, versioned review/check decks that agents can invoke. | Inspect each check before reuse. | FG-03, FG-06, FG-17 |

### What to adapt and combine

1. **Changes carry proof.** A proposal branch should contain intent, sources, exact operations, ERC/DRC/review/simulation/scenario output, fidelity cuts, diff, and a reversible decision.
2. **Review is portable.** Freeze the design state, attach purpose and checks, anchor comments to graph IDs, and let request/response artifacts travel without an account.
3. **Behavior is testable.** Compose emulator, co-sim, analog feedback, CLI, and deterministic artifacts into data-only scenarios.
4. **Devices are living packages.** Cross-validate electrical facts, symbol, footprint, breadboard/3D/model projections, sources, licenses, and tests against stable pin IDs.
5. **Ownership and escape paths stay real.** Recover primary files, preserve invalid imports, round-trip native formats, and keep relay permissions narrow and bounded.
6. **Knowledge stays one system.** Raw material follows `inbox/` and `/extract`; product records carry resolvable evidence IDs rather than copied source cards.
7. **Scope expands only through evidence.** Test the firmware workflow first; enclosure and kinematics remain gated experiments.

### Phase 2 findings

| ID | Finding and required outcome |
|---|---|
| FG-01 | `.ppx` cannot safely evolve; land migrations, asset hashing, unknown-op handling, and cross-version fixtures as one gate. |
| FG-02 | Saved-design failure is destructive; preserve raw data, suspend writes, and require an explicit recovery choice. |
| FG-03 | Agent editing is incomplete and not fail-closed; make proposal branches carry sources, operations, checks, and approval. |
| FG-04 | Browser-direct provider keys are not a durable boundary; add a thin private gateway without service-dependent files. |
| FG-05 | Intent and requirements are not graph entities; make them typed and traceable to checks, scenarios, and decisions. |
| FG-06 | Review reports exist, but a complete portable request/response capsule does not. |
| FG-07 | CLI checks designs but cannot run deterministic firmware/circuit scenarios. |
| FG-08 | Firmware, buses, GPIO, analog waveforms, assertions, and graph history need one causal trace. |
| FG-09 | Device-model authoring needs a bounded CSP-safe workshop with fixtures and fidelity declarations. |
| FG-10 | Part provenance is coarse and multi-projection coverage is incomplete; build living cross-validated packs. |
| FG-11 | Reuse stops at individual parts; add versioned verified system/design capsules. |
| FG-12 | The engine lacks architecture as a graph-derived projection. |
| FG-13 | The engine lacks breadboard/build projection and intended-versus-observed reconciliation. |
| FG-14 | Editable interchange is too narrow; add version-pinned KiCad round trips and open embedding. |
| FG-15 | The canvas lacks semantic and keyboard-operable circuit access; derive it from graph plus UI state. |
| FG-16 | Collaboration needs explicit bind/auth policy, room roles, quotas, backpressure, eviction, queues, and file fallback. |
| FG-17 | Evidence freshness is prose; bind machine fields to the existing Ars Contexta and PP-NLM path. |
| FG-18 | The engine has not proved migration on Tyler's representative projects. |
| FG-19 | Physical-system expansion is an unvalidated hypothesis; use gated firmware, enclosure, and URDF experiments. |
| FG-20 | Open-hardware release output is not one reproducible, signed, truthfully labeled capsule. |

### Research limits

- Outside capability statements are documentation-backed, not live usability findings.
- Repository age, stars, and activity are discovery clues only.
- Papers were not reproduced against ProtoPulse.
- Community and raw-inspiration sources are deliberately labeled.
- The July 17 comment repository is included because even day-one work can teach a useful idea; it is not implementation proof.

## Phase 3: UX & Workflow Evaluation

### Method boundary

This phase traced the shipping legacy UI and the engine editor statically for three personas: hobbyist maker, professional electrical engineer, and hardware startup founder. No live browser, screen reader, keyboard-only walkthrough, hardware session, or performance trace was run. Counts below are source occurrences, not conformance percentages or runtime observations.

### Accessibility scorecard

| Static signal, tests excluded | Legacy `client/src` | Engine `packages/app/src` | Read |
|---|---:|---:|---|
| `aria-*=` occurrences | 541 | 24 | Legacy has much broader semantic instrumentation. |
| `role=` occurrences | 128 | 5 | Engine custom side tabs lack the expected tab roles. |
| `tabIndex` occurrences | 30 | 0 | Engine canvas has no focus entry point. |
| `alt=` / `<img` occurrences | 10 / 9 | 0 / 0 | No engine image-alt claim is made because no engine `<img>` occurrence was found. |
| Keyboard-handler signals | 115 | 9 | Engine has global shortcuts, not a focusable/announced editing region. |
| Loading-state keywords | 539 | 2 | Legacy has extensive wait-state language; occurrence count does not prove full coverage. |
| User-feedback signals | 63 | 32 | Both layers report feedback; some legacy “actions” report instead of acting. |

Legacy strengths are real: skip links, focusable main regions, tab-panel semantics, isolated error boundaries, responsive panels, keyboard resize handles, and semantic shared controls. The engine simulation plot labels its canvas. The main design canvas, however, is one bare `<canvas>` with no accessible name, role, focus target, instructions, or alternate selection state (`packages/app/src/editor/CanvasHost.tsx:524`).

The target is not a separately stored accessibility document. Stable graph entities plus ephemeral selection, tool, tab, and status state can generate a semantic tree, focus model, available commands, and announcements. Reflow, visible focus, real tabs, and a named canvas can land before stored vocabulary changes; later persisted preferences still pass through the `.ppx` gate.

### Persona 1: Hobbyist maker

The project picker gives a useful re-entry path: skeletons, retry state, recents, search, samples, and auto-resume. Trust breaks at the promoted onboarding path. The sample gallery promises concrete nodes, edges, BOM, time, and cost, but the open handler creates only name and description. Team templates similarly promise DRC/BOM/export policy while persisting only a generated description.

The daily legacy loop spans architecture, schematic, breadboard, Arduino, simulation, validation, and export. Responsive panel collapse and keyboard resize handles are good foundations. Progress is not trustworthy because many milestone fields are constants. Advanced Arduino, serial, generative, digital-twin, PCB, and radial-menu surfaces exist, but live-hardware status is unclear and radial selections only report an action.

Recovery is mixed. Project-list loading and view error boundaries are explicit. Malformed IDs redirect to project 1, and every project change waits for a hidden development seed request that can mutate the wrong project. The maker also sees two collaboration models—legacy shipping and engine sharing—without one canonical handoff.

### Persona 2: Professional electrical engineer

The “Pro” role claims full access, yet its 27-view set omits eight implemented destinations: Vault, Labs, Audit Trail, Supply Chain, BOM Templates, My Parts, Alternates, and Part Usage. This is a registry defect, not missing implementation.

The legacy daily loop spans schematic, PCB, validation, simulation, procurement, outputs, lifecycle, history, and comments. The engine loop has the stronger state spine—typed operations, branch history, graph, checks, diff, renderer, simulation, review, and exports—but both applications remain visible without a completed product transition.

Engine side-panel navigation places 17 schematic or 18 PCB tabs into a fixed 320px column. Equal-flex tabs have no wrap/overflow rule and expose only a `<nav>` plus buttons, not complete tab semantics or arrow-key behavior. Draftsman adds another truth split: the runtime is shipped, while the panel is a disabled shell. Saved-data failure is the highest-risk professional path because an unsupported bundle can become starter state without a recovery choice.

### Persona 3: Hardware startup founder

The founder needs state, cost, supply risk, team policy, review, and a clear manufacturing handoff. Project recents, archive/restore, status, and auto-resume work. Template policy does not survive creation. The role registry hides precisely the supply, inventory, alternates, usage, and audit surfaces needed for operations.

Review, collaboration, provenance-aware packs, and fab decks exist in the engine foundation. Pack publication, board packs, live quote/order APIs, and the canonical migration remain open. The routable legacy Community, Order PCB, and Settings screens therefore need literal capability states and honest empty states. A shared engine design and a legacy project cannot be treated as the same source of truth until migration evidence proves the handoff.

### Cross-persona migration and honesty matrix

| Promise | Immediate action | Durable gate |
|---|---|---|
| Samples | Implement real payload creation. | Typed-op parity fixture. |
| Templates | Reduce claim to description-only. | Full engine policy operations. |
| Hidden views | Restore reachability. | One capability/projection registry and explicit retirement states. |
| Radial actions | Remove or disable. | Typed commands with eligibility, undo, and result state. |
| Milestones | Hide hard-coded facts. | Graph-derived progress. |
| Settings | Remove from normal navigation or label Preview. | Real canonical settings and private provider boundary. |
| Community, flashing, quotes/orders | Label `local-only`, `emulated`, `preview`, or `blocked`. | Enable `live` only from returned evidence. |
| Draftsman | Hide/disable. | Real proof-carrying crew integration. |

### Phase 3 findings

| ID | Finding and required outcome |
|---|---|
| UI-01 | Restore the eight hidden legacy views and drive engine navigation from one capability/projection registry. |
| UI-02 | Make sample opening create the advertised design and freeze each sample as migration evidence. |
| UI-03 | Make template claims honest now and recreate full policy semantics before flip. |
| UI-04 | Remove handlerless radial items and rebuild useful actions through typed engine dispatch. |
| UI-05 | Remove hard-coded milestone claims and derive progress from real evidence. |
| UI-06 | Render one explicit canonical-product transition with per-capability disposition, loss reporting, proving, flip, and grace. |
| UI-07 | Make palette and inspector collapsible/resizable, persist widths, and support narrow layouts without traps. |
| UI-08 | Replace the 17–18-tab strip with scalable hierarchy/overflow and complete tab semantics. |
| UI-09 | Derive semantic circuit mode from graph plus transient UI state, with equivalent keyboard edits and assistive evidence. |
| UI-10 | Add visible focus across engine controls and verify keyboard flow and contrast. |
| UI-11 | Hide Draftsman now; expose it only when provider, tools, approval, and review form a complete path. |
| UI-12 | Label/remove Settings now; later persist real settings and keep provider secrets behind the gateway. |
| UI-13 | Redirect malformed/non-positive IDs to the picker with explanation instead of guessing project 1. |
| UI-14 | Remove the hidden seed wait and move fixtures to an explicit visible bootstrap. |
| UI-15 | Replace the project-card `div role=button` with semantic sibling controls. |
| UI-16 | Make capability state machine-readable and enable `live` only from integration evidence. |
| UI-17 | Preserve unreadable/future saved data and offer export, retry/migrate, or explicit reset before any write. |

### Information-architecture direction

Repairing the legacy registries is an immediate truth fix, not the engine design. The engine registry should describe capability, projection component, availability state, required substrate, and migration disposition, then derive routes, tabs, labels, and mounting. Audit/history can project the op-log. Supply/inventory can project parts and BOM. Architecture and breadboard require explicit parity projections. Semantic access projects the graph and current UI state. None of these should fork the design database.

## Phase 4: Technical Debt & Architecture

### Method boundary

Phase 4 used static source analysis plus current GitHub Actions evidence. The full monorepo build/typecheck/test was not rerun locally because the documented `earlyoom` behavior can terminate those commands and produce false signals. Bounded source-area tools and current-commit CI were used instead: `scc`, `tokei`, `lizard`, `rg`, `ast-grep`, `npm audit`, `cargo audit`, `cargo tree`, `git`, and `gh`. Current MDN CSP behavior was checked through Context7.

### Executive technical truth

- The trusted scope is 2,527 files and 701,993 `scc` code lines. TypeScript accounts for 680,423 code lines.
- Main CI and Packages CI pass on `fbd2f76e`. Root CI recorded 31,247 passing tests and 2 skipped. All five Tauri platform package jobs completed, but the workflow failed later in Linux x64 supply-chain checking.
- Complexity is concentrated in current product seams: legacy breadboard and PCB editors, the engine canvas, numerical solvers, legacy AI, and the ESP32-S3 emulator.
- The server boundary has real strengths: auth, origin checks, rate limits, size limits, Helmet CSP, strict SVG sanitization, and argument-array process use in several paths.
- Concrete security gaps remain at the Arduino process/path boundary, CSP-conflicting custom code, relay exposure/resource bounds, DOMPurify version, and autocomplete HTML sink.
- `.ppx` compatibility and browser recovery are not ready for vocabulary expansion.
- Current production npm audit reports 64 affected package nodes: 5 high and 59 moderate. The high Genkit/OpenTelemetry set is time-boxed only through 2026-07-31.

### Complexity hotspots

These are actual bounded `lizard --csv` results. Tests, generated output, dependencies, coverage, `dist`, and `src-tauri/target` were excluded.

| Function or reported area | File | CCN | NLOC | Params |
|---|---|---:|---:|---:|
| Breadboard canvas closure | `client/src/components/circuit-editor/breadboard-canvas/index.tsx:355` | 459 | 744 | 0 |
| Engine canvas closure | `packages/app/src/editor/CanvasHost.tsx:95` | 253 | 368 | 0 |
| `runTransientAnalysis` | `client/src/lib/simulation/transient-analysis.ts:553` | 204 | 503 | 1 |
| `stampNonlinearCompanions` | `client/src/lib/simulation/circuit-solver.ts:340` | 97 | 123 | 8 |
| PCB canvas closure | `client/src/components/circuit-editor/PCBLayoutView.tsx:281` | 93 | 513 | 1 |
| AC-analysis area | `client/src/lib/simulation/ac-analysis.ts:131` | 55 | 249 | 20 |
| `solveTransient` | `client/src/lib/simulation/circuit-solver.ts:695` | 52 | 134 | 6 |
| `sha256BlockInto` | `packages/emu/src/esp32s3.ts:1069` | 50 | 26 | 0 |
| Linear-system area | `client/src/lib/simulation/circuit-solver.ts:108` | 48 | 159 | 25 |
| Legacy AI closure area | `server/ai.ts:650` | 43 | 239 | 8 |
| `aesEncryptBlock` | `packages/emu/src/esp32s3.ts:1242` | 37 | 25 | 0 |
| `aesDecryptBlock` | `packages/emu/src/esp32s3.ts:1290` | 37 | 25 | 0 |
| Component editor body | `client/src/components/views/ComponentEditorView.tsx:860` | 36 | 363 | 1 |
| `computeNodeImpedance` | `client/src/lib/simulation/ac-analysis.ts:611` | 34 | 116 | 4 |
| `runParsedNetlist` | `client/src/lib/simulation/spice-netlist-parser.ts:920` | 31 | 79 | 1 |
| `segmentToSegmentDistance` area | `shared/drc-engine.ts:995` | 23 | 58 | 23 |

`lizard` can fold nested React/TypeScript callbacks into one area. These values locate control-flow-heavy spans; they are not bug counts and should not drive mechanical splitting.

### Large boundaries

`scc --by-file` found 26 non-test TypeScript/Rust files at or above 1,000 code lines. The largest current boundaries include:

| Boundary | Current signal |
|---|---|
| `packages/emu/src/esp32s3.test.ts` | 13,408 lines / 12,071 code |
| `packages/emu/src/esp32s3.ts` | 9,475 lines / 8,185 code |
| `packages/parts/src/seed/index.ts` | 2,943 lines / 2,901 code |
| `client/src/components/circuit-editor/PCBLayoutView.tsx` | 1,530 lines / 1,342 code |
| `client/src/components/circuit-editor/breadboard-canvas/index.tsx` | 1,477 lines / 1,268 code |
| `client/src/components/panels/SerialMonitorPanel.tsx` | 1,399 lines / 1,251 code |
| `shared/drc-engine.ts` | 1,541 lines / 1,250 code |
| `server/export/eagle-exporter.ts` | 1,291 lines / 1,241 code |
| `client/src/components/simulation/WaveformViewer.tsx` | 1,453 lines / 1,217 code |
| `client/src/components/views/ComponentEditorView.tsx` | 1,263 lines / 1,208 code |
| `packages/app/src/styles.css` | 1,423 lines / 1,166 code |

Static catalogs and serialization-heavy exporters need generated/domain boundaries, not arbitrary function splitting. Editors, solvers, AI, DRC, and emulator code need characterization tests and smaller stable interfaces.

### Code-smell and warning summary

| Signal | Current source-only result | Meaning |
|---|---:|---|
| Explicit `any` | 1 | `ProfileSettingsDialog.tsx`; replace with actual device type. |
| `as any` | 1 | Generated binding catch; fix generator/template. |
| `@ts-ignore` / `@ts-expect-error` | 0 | Clean. |
| Direct `eval(...)` | 0 | String execution uses `Function`, handled below. |
| `!.`-shaped non-null assertions | 118 | Ratchet by changed file; many may be guard-backed. |
| Browser/engine raw console calls | 22 | Route through the redacting structured logger. |
| Developer TODO comments | 5 | Draftsman and four data/UI follow-ups. |
| Lint-warning visibility | Hidden | Both CI workflows use `--quiet`; warning rules do not surface. |

### Security findings

| Finding | Evidence | Required treatment |
|---|---|---|
| Request values reach Arduino shell strings and unbounded paths | `server/routes/arduino.ts:258-353`; `server/arduino-service.ts:472-508` | One schema, workspace-owned resolution, `execFile` arrays, traversal/quote/option/symlink/ownership tests. |
| Production CSP conflicts with DRC and circuit-DSL execution | `client/src/lib/drc-scripting.ts:143-151`; workers at `drc-script-worker.ts:249-259` and `circuit-dsl-worker.ts:295-313`; CSP omits `'unsafe-eval'` | Keep CSP strong; replace string execution with a constrained interpreter/AST evaluator or isolated process; test production browser and packaged Tauri. |
| Relay can start open and aggregate state is unbounded | `packages/relay/src/main.ts:12-28`; `packages/relay/src/server.ts:52-58,99-123,225-233` | Explicit bind policy, non-loopback auth, room roles, quotas, backpressure, eviction, storage limits, hostile-client tests. |
| DOMPurify control is advisory-affected | `isomorphic-dompurify@3.9.0` resolves `dompurify@3.4.0`; sanitizer guards imported SVG | Upgrade and rerun the malicious SVG corpus. |
| Arduino autocomplete uses `innerHTML` | `client/src/lib/arduino/autocomplete.ts:82-84` | Build nodes with `textContent`; add adversarial label tests. |
| Chart CSS sink | Developer-owned `ChartConfig` | Keep non-user-controlled or validate values if contract changes. |
| SVG preview sink | Strict sanitized and bounded path | Preserve client/shared parity and regression tests. |
| Credential/private-key scans | No production secret finding | Keep CI scanning; retain test fixtures. |

Current MDN documentation states that `Function()` is blocked when `script-src` lacks `'unsafe-eval'`, and blob workers inherit the creator's CSP: [MDN `script-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_eval_expressions), [MDN CSP workers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP#workers). This supports the static conflict; a live production browser and packaged-Tauri run must still capture the actual user-facing behavior.

### Test health

| Metric | Current value | Interpretation |
|---|---:|---|
| TS/TSX non-test files | 1,579 | Phase 4 denominator. |
| Conventional TS/TSX test files | 874 | Broad corpus, not proof of risk coverage. |
| Static test declarations | 31,360 | Source count. |
| Latest root CI | 765 files; 31,247 passed; 2 skipped | Current-commit GitHub evidence. |
| Latest Packages CI | Passed | Workspace checks, tests, AI eval, CLI smoke, editor build. |
| Root coverage floor | 60/50/55/60 | Broad aggregate only. |
| Graph coverage floor | 95/90/95/95; selected critical files 100% | Strong contract-package model. |
| Playwright workflow references | 0 | Config/scripts exist; required CI lane does not. |
| Packaged desktop smoke | `continue-on-error`, currently skipped | It follows the failing supply-chain step. |

The two root skips are the conditional database-backed migration parity suite. Real closed-loop co-simulation is also conditional on ADC support. Required named lanes and artifacts must distinguish “not exercised” from “passed.”

### Dependency and release evidence

Rust audit currently reports `RUSTSEC-2026-0194` and `RUSTSEC-2026-0195` through `quick-xml@0.38.4`, patched at `>=0.41.0`, plus 19 unmaintained and 4 unsound warnings. `cargo tree --target all -i quick-xml@0.38.4` traces the blocker through `plist@1.8.0` to `tauri@2.10.3` and its plugins.

The current supply-chain script exits on Rust before npm and SBOM work, despite comments implying a severity threshold. Strict all-vulnerability policy may be valid, but behavior, documentation, and aggregate evidence must agree.

Production `npm audit` reports:

| Result | Count |
|---|---:|
| Critical | 0 |
| High affected nodes | 5 |
| Moderate affected nodes | 59 |
| Total affected nodes | 64 |
| Production dependency nodes | 812 |

The five high nodes are in the Genkit/OpenTelemetry path and are temporarily allowed only while the exact path remains no-fix and only through 2026-07-31. `js-yaml` and the DOMPurify chain already report fixes available.

### Performance and artifacts

The current CI Vite build passed in 19.37 seconds and emitted its over-500-kB warning:

| Chunk | Raw | Gzip |
|---|---:|---:|
| `WebGLBoardViewer` | 1,026.77 kB | 281.16 kB |
| `CodeEditor` | 680.74 kB | 234.26 kB |
| main `index` | 629.06 kB | 185.20 kB |
| `react-vendor` | 393.58 kB | 127.37 kB |
| `BreadboardView` | 389.58 kB | 106.40 kB |

Local artifacts measured 60 MB `dist`, 1.4 GB `node_modules`, and 26 GB `src-tauri/target`. The local `dist` predates the current commit and is not bundle truth. The target tree is cache pressure, not shipped application size.

### Architecture consequences

- The legacy application and engine remain two product/data paths. Each new cross-cutting capability risks two implementations until migration is executed.
- Relay message caps do not bound total room, branch, envelope, storage, or lifetime state.
- The physical-system direction stays behind compatibility and user-evidence gates.
- Green unit volume does not cover the required system boundaries: browser journeys, production CSP, database parity, packaged desktop, relay resource behavior, or real hardware.
- The highest-change-frequency files are also the largest emulator boundaries: `esp32s3.test.ts` appeared in 168 rolling 90-day commits and `esp32s3.ts` in 159.
- GitHub has no open issue or pull-request queue; the local backlog is the actual work surface.
- Project hooks can report false green after termination or after skipping package tests. That is a feedback-loop defect.

### Phase 4 technical findings

| ID | Finding and required outcome |
|---|---|
| TD-01 | Validate and constrain every Arduino path/argument; replace remaining shell strings with argument arrays and add adversarial ownership tests. |
| TD-02 | Remove both `quick-xml@0.38.4` blockers and re-prove all Tauri package targets plus audit state. |
| TD-03 | Resolve or precisely time-box all 23 Rust warnings with reachability and recheck evidence. |
| TD-04 | Aggregate Rust, npm, and both SBOM checks before returning one supply-chain status. |
| TD-05 | Resolve every npm affected family, including fixable `js-yaml` and DOMPurify chains and the 2026-07-31 exception decision. |
| TD-06 | Replace DRC/DSL string execution without weakening CSP; prove production browser and packaged Tauri. |
| TD-07 | Add explicit `.ppx` version dispatch, ordered migrations, and frozen fixtures. |
| TD-08 | Preserve/quarantine unknown operations, including nested batches, with diagnostics and round trips. |
| TD-09 | Retain malformed/future data, block autosave, and make export/retry/migrate/reset explicit. |
| TD-10 | Implement content-addressed assets and graph-reference integrity for missing, orphaned, and mismatched blobs. |
| TD-11 | Add relay bind/auth policy, room roles, quotas, backpressure, eviction, storage limits, and resource tests. |
| TD-12 | Upgrade DOMPurify, rerun malicious SVG tests, remove autocomplete `innerHTML`, and add adversarial labels. |
| TD-13 | Make Playwright a required CI lane for legacy/engine journeys, accessibility, CSP, recovery, and import/export. |
| TD-14 | Give database migration parity and real closed-loop co-sim named CI lanes with explicit unavailable states. |
| TD-15 | Run packaged desktop smoke independently of fail-fast audit and require current target-family artifacts. |
| TD-16 | Surface ESLint warnings, remove the duplicate override, freeze a baseline, and ratchet changed scopes. |
| TD-17 | Remove current `any` escapes at source and ratchet the 118 non-null assertions through guards/invariants. |
| TD-18 | Route 22 browser/engine console calls through the redacting structured logger. |
| TD-19 | Close five real source TODOs or convert them into durable IDs and literal unavailable states. |
| TD-20 | Decompose all stateful UI hotspots behind tested hooks/controllers/renderers before reflow and semantic work. |
| TD-21 | Decompose numerical/analysis hotspots behind typed interfaces, characterization tests, and golden vectors. |
| TD-22 | Partition ESP32 core/peripheral/crypto/instruction code and tests; use the partition as an ownership map. |
| TD-23 | Partition large seed/catalog/schema boundaries while retaining intentionally cohesive serializers with tests. |
| TD-24 | Add risk-specific coverage gates for auth, recovery, import/export, process, relay, and storage paths. |
| TD-25 | Replace false-green hooks with exit-code-aware package commands that fail or mark inconclusive correctly. |
| TD-26 | Execute one migration architecture: real projects, canonical editor, engine-only new AI, freeze, grace, retirement. |
| TD-27 | Add bounded cache hygiene while reporting source, dependency, target, and shipped sizes separately. |
| TD-28 | Write ownership/recovery notes for all hotspots and verify backup-branch value before archive labeling. |

### Phase 4 enhancement findings and final IDs

Phase 4 originally used a local EN-01..05 range. To preserve Phase 1 EN-01..18, these five become final EN-19..23.

| Phase 4 source | Final ID | Finding and required outcome |
|---|---|---|
| Phase 4 EN-01 | EN-19 | Publish bounded source-only `lizard`/`scc` artifacts, track the complete current hotspot set, and fail only on newly worsened budgets. |
| Phase 4 EN-02 | EN-20 | Publish route/chunk analysis and budgets, then prove lazy-loading/tree-shaking gains before changing strategy. |
| Phase 4 EN-03 | EN-21 | Publish one release-readiness artifact separating package success from advisory, SBOM, smoke, signature, and attestation evidence. |
| Phase 4 EN-04 | EN-22 | Report dependency footprint by capability family using reachability, install cost, advisories, and actual product use. |
| Phase 4 EN-05 | EN-23 | Build a regression corpus for CSP, injection, Arduino process paths, relay exhaustion/auth, secrets, and future-version recovery. |

### Phase 4 conclusion

The technical foundation is stronger than a red/green summary suggests: tens of thousands of tests, strict TypeScript, hardened server middleware, deterministic graph contracts, and successful browser/package CI are real. The dangerous seams are the boundaries those broad signals do not prove—data evolution, process ownership, production policy, relay resources, packaged runtime, and migration. Fixing them directly enables the UX and innovation work; it is not a separate cleanup program.

## Phase 5: Feature Innovation

### Design thesis

ProtoPulse does not need another disconnected subsystem. Its strongest future work composes the primitives already present:

- typed operations, branch/diff/merge/replay, and deterministic exports;
- review reports, deltas, decks, and executable fixes;
- a provider-neutral crew runtime that emits graph operations;
- analog simulation, MCU emulation, and closed-loop co-simulation;
- portable bundles, part packs, share fragments, and a relay that carries copies;
- verified hardware facts and explicit fidelity cuts;
- the existing Ars Contexta and PP-NLM evidence path.

The resulting direction is **proof-carrying physical design**: every claim can point to intent, canonical source evidence, operation history, executable checks, scenarios, review decisions, and physical observations. Recovery, CSP, collaboration limits, semantic access, and packaged-runtime proof travel with each idea.

### Dependency stages

| Stage | Meaning |
|---|---|
| P0 | Compatibility, recovery, mutation safety, or private-service boundary needed before broader work. |
| P1 | Core workflows that build directly on P0 and complete the intended engine loop. |
| P2 | Composite capabilities depending on P1 artifacts and verified projections. |
| P3 | Required hypothesis experiments after the substrate is safe; documented `ship`, `reshape`, or `shelf` is completion. |

### Twenty innovation proposals

| ID | Proposal | Composition and acceptance signal |
|---|---|---|
| IN-01 | Evolution-safe `.ppx` with recovery mode | Combine migrations, asset hashes, future-op preservation, raw-payload retention, blocked autosave, and browser/Tauri parity. Version-1/future/corrupt fixtures must survive without silent loss. |
| IN-02 | Proof-carrying crew change sets | Complete ordinary edit/remove tools, require mutation approval, write a proposal branch, attach Ars evidence and checks, and merge only by explicit decision. |
| IN-03 | Private provider gateway without file dependence | Keep keys out of clients, scope identity/budgets/audit, support self-hosting, and leave local files, manual work, checks, simulation, and export usable during outage. |
| IN-04 | Intent, requirement, and verification graph | Add typed goals, limits, tolerances, assumptions, methods, evidence, and trace edges. Changing a tolerance must deterministically invalidate stale proof. |
| IN-05 | Portable review request capsules | Carry purpose, frozen branch, comparisons, checks, stable-anchor threads, fixes, decisions, and closure in a versioned file/response pair with preserve-first import. |
| IN-06 | Circuit scenario CI | Add data-only time actions and serial/bus/GPIO/analog/requirement assertions with stable JSON, VCD, waveform, serial, screenshot, exit, and fidelity output. |
| IN-07 | Device-model workshop | Author bounded I2C/SPI/GPIO/analog models with register helpers, deterministic state/time, traces, fixtures, resource caps, and fidelity declarations through a CSP-safe boundary. |
| IN-08 | Living multi-projection part/device packs | Cross-validate electrical facts, symbol, footprint, breadboard, 3D, SPICE, firmware model, sources, licenses, and tests against stable pins and canonical evidence IDs. |
| IN-09 | Architecture as a live projection | Derive system blocks, interfaces, budgets, requirements, and evidence from the graph and prove representative legacy-project parity. |
| IN-10 | Breadboard build mode with observed-reality reconciliation | Use verified geometry for legal placement/wiring and preserve continuity, measurement, photo, and intended-versus-observed discrepancies as reversible evidence. |
| IN-11 | Semantic circuit projection | Stage reflow/focus/tabs/named canvas, then derive DOM entities, focus, narration, and equivalent keyboard edits from graph plus transient UI state; store no parallel model. |
| IN-12 | Local-first rooms with narrow capabilities | Add explicit bind/auth, room roles, actor identity, quotas, backpressure, eviction, durable queues, preserve-first conflicts, hostile-client tests, and account-free review-file exchange. |
| IN-13 | Causal time machine | Align operation history, firmware source/program counter/registers, interrupts/buses, GPIO, analog waveforms, device state, and assertions; save and diff traces. |
| IN-14 | Forkable verified design capsules | Package operations, design fragments, requirements, scenarios, review, BOM options, pack/evidence hashes, license, and learning material; instantiate through typed operations. |
| IN-15 | Photo-to-graph physical reconciliation | Hash and calibrate top/bottom images, attach human-confirmed observations to stable graph anchors, and keep intended and observed state separate but linked. |
| IN-16 | Editable KiCad bridge and open embed | Support one pinned native version at a time, typed import/export, opaque unsupported records, semantic/native round-trip fixtures, and stable-anchor cross-probing. |
| IN-17 | Living evidence garden on the existing knowledge pipeline | Capture raw outside material in `inbox/`, extract into canonical knowledge, publish versioned PP-NLM sources, return Studio material through `inbox/`, and store only resolvable evidence handles in product records. |
| IN-18 | Reproducible open-hardware release capsule | Sign exact design/pack/deck/model revisions, sources/licenses, checks/scenarios/reviews, fabrication files, hashes, and honest external status; regenerate contract outputs cleanly. |
| IN-19 | Real-project migration proving ground | Preserve representative originals, compare every projection/output, exercise recovery and production CSP in browser/Tauri, freeze failures as fixtures, and gate canonical UI on explained losslessness. |
| IN-20 | ADR-0017 physical-system hypothesis ladder | After IN-01, test real firmware workflows, then bounded CadQuery/JSCAD enclosure and URDF link/joint experiments only when evidence supports the next stage; record `ship`, `reshape`, or `shelf`. |

### Persona reach

| Persona | Most direct proposal value |
|---|---|
| Hobbyist maker | Recoverable files, guided breadboard build, scenarios, living parts, semantic/keyboard access, shareable review, and honest hardware states. |
| Professional electrical engineer | Requirements, review capsules, causal traces, editable KiCad travel, deterministic checks, local-first rooms, and complete migration evidence. |
| Hardware startup founder | Private provider boundary, traceable requirements, review/sign-off, bounded collaboration, reproducible releases, parts evidence, and one canonical product surface. |

### Long-horizon experiments

| Proposal | Question | Stop or reshape condition |
|---|---|---|
| IN-13 causal trace | Does aligned firmware/bus/analog/design history shorten diagnosis on real failures? | Users cannot diagnose faster or explain the trace. |
| IN-15 photo reconciliation | Can users record observed hardware without confusing it with design intent? | Automatic suggestions require more correction than manual anchoring; retain manual capture if useful. |
| IN-20 physical-system ladder | Does the same person benefit from continuous electronics, firmware, enclosure, and kinematic context? | Shelf the next stage when the same-user assumption or one-engine representation fails. |

### Phase 5 conclusion

These are not twenty disconnected bets. They are a layered composition of compatibility, proof, behavior, review, physical evidence, and open travel. The strongest near-term output is not a new domain. It is a trustworthy change set that can be recovered, reviewed, simulated, explained, and migrated.

## Cross-Phase Analysis

### Central return gate

The return gate has three inseparable parts:

1. **Compatibility and recovery:** evolve `.ppx`, preserve unknown/future/corrupt material, implement assets, and block destructive writes.
2. **Honest capability states:** make routes, tabs, empty states, and docs derive `available`, `local-only`, `emulated`, `preview`, `blocked`, or `live` from real integration evidence.
3. **Real-project migration:** run Tyler's projects through the engine, preserve before/after evidence, freeze failures as fixtures, and let explained losslessness control the canonical flip.

This is the practical answer to “where do I resume?” Compose the shipped graph, simulation, review, and emulation primitives around that gate. Do not start a third architecture.

### Impact chains

```text
No version dispatch + unknown-op hard failure + starter fallback + unload flush
  -> a normal vocabulary change can make the only local copy unreadable
  -> starter state can become the next saved state
  -> every richer pack, review, requirement, or physical experiment increases risk
  -> compatibility/recovery must precede graph expansion
```

```text
Sample/template/radial/milestone/Settings/Draftsman claims outrun handlers
  -> users enter promoted paths that do not complete
  -> migration promises become harder to trust
  -> literal capability states and immediate disable/reduction are prerequisites
```

```text
Legacy app + engine app + unfinished real-project proving
  -> two state models and two support contracts remain active
  -> every cross-cutting feature risks duplicate implementation
  -> real-project evidence must control the canonical-product transition
```

```text
Custom DRC/DSL uses Function + production CSP forbids it
  -> a development feature can fail under delivered policy
  -> scenario and device-model ideas inherit the same boundary
  -> one constrained/isolated execution architecture must serve all custom logic
```

```text
Five target packages complete + Rust audit fails + later smoke is skipped
  -> packaging exists but release readiness is not demonstrated
  -> UI/docs can overstate desktop health
  -> one aggregate release artifact must expose package, audit, SBOM, smoke, and signature state
```

```text
High CCN + large source boundaries + high emulator change frequency
  -> reviews and regressions become expensive in exactly the areas needed by scenarios and migration
  -> characterization, stable interfaces, partitioning, and ownership notes become feature prerequisites
```

### Risk heatmap

| Area | Data loss | Truth gap | Security/release | Complexity/change frequency | Migration effect | Overall |
|---|---:|---:|---:|---:|---:|---|
| `.ppx` + browser persistence | Critical | High | Medium | Medium | Critical | **Critical** |
| Legacy/engine transition | High | Critical | Medium | High | Critical | **Critical** |
| Arduino host-process boundary | Medium | High | Critical | Medium | Medium | **High** |
| DRC/DSL custom execution | Low | High | Critical | High | High | **High** |
| Relay collaboration | High | High | High | Medium | High | **High** |
| Engine canvas and semantic access | Low | High | Low | Critical | High | **High** |
| ESP32 emulator/co-sim | Low | Medium | Medium | Critical | High | **High** |
| Tauri release lane | Low | High | Critical | Medium | High | **High** |
| Part/evidence ecosystem | Medium | High | Medium | High | High | **High** |
| Physical-system hypothesis | Medium | High if presented early | Medium | High | Medium | **Gated experiment** |

### Dependency-stage plan

| Stage | Required outcome | Representative IDs |
|---|---|---|
| P0 | Protect data, mutation, process, dependency, relay, and provider boundaries; make current false promises safe. | FG-01..04; UI-01..06; TD-01..12; EN-01..03; IN-01..03 |
| P1 | Complete the engine interaction, proof, review, behavior, projection, and system-test foundations. | FG-05..07, FG-09..13, FG-15..16; UI-07..14; TD-13..25; EN-04..09; IN-04..12 |
| P2 | Compose causal traces, capsules, open travel, evidence/release packets, migration proof, and architecture cleanup. | FG-08, FG-11, FG-14, FG-17..18, FG-20; UI-15..17; TD-26..28; EN-10..17, EN-19..21; IN-13..19 |
| P3 | Generate current-state/dependency evidence and run bounded scope hypotheses with explicit outcomes. | FG-19; EN-18, EN-22..23; IN-20 |

Stage placement coordinates dependency order. Every row remains required. An experiment can close through a documented decision not to ship the tested direction.

### Twelve implementation bundles

Bundles coordinate shared implementation and evidence. They do not merge or delete checklist rows.

| Bundle | Final checklist IDs | Shared outcome |
|---|---|---|
| B1 — Evolution-safe design data | EN-01/02; FG-01/02; UI-17; TD-07/08/09/10; IN-01 | One versioned, asset-aware, preserve-first compatibility and recovery contract across browser, directory, capsules, packs, sync, and Tauri. |
| B2 — Canonical product transition | EN-08; FG-12/13/18; UI-06; TD-14/26; IN-09/10/15/19 | One real-project evidence corpus controls architecture/breadboard parity, canonical editor, flip, grace, and retirement. |
| B3 — Proof-carrying crew | EN-07/15; FG-03/04; UI-11/12; IN-02/03 | Private provider boundary plus complete ordinary tools, fail-closed approval, proposal branches, evidence, and honest UI exposure. |
| B4 — Honest onboarding and navigation | EN-03/04/05/06/10/12/14/15/18; UI-01..05 and UI-12..16 | One capability/projection registry, truthful states, working samples, bounded templates, repaired navigation, and visible bootstrap behavior. |
| B5 — Engine interaction model | FG-15; UI-07/08/09/10; TD-13/20; IN-11 | Reflow, focus, semantic tabs/canvas/tree, keyboard-equivalent edits, tested stateful boundaries, and system evidence. |
| B6 — Review and local-first collaboration | FG-05/06/16; TD-11; IN-04/05/12 | Typed intent, portable review, stable anchors, narrow roles, bounded relay, durable queues, preserve-first conflicts, and file fallback. |
| B7 — Behavior and causal proof | EN-11; FG-07/08/09; TD-14/22; IN-06/07/13 | Data-only scenarios, bounded device models, named co-sim evidence, partitioned emulator ownership, and aligned causal traces. |
| B8 — Living hardware packages and releases | EN-12/13/14; FG-10/11/17/20; TD-23; IN-08/14/17/18 | Cross-validated packs/capsules, canonical evidence handles, safe publication states, and reproducible truthful release artifacts. |
| B9 — Editable/open escape paths | EN-17; FG-14; IN-16 | Version-pinned KiCad round trips, golden fixtures, loss accounting, and open embedding. |
| B10 — Security and release boundary | EN-16/21/23; TD-01..06, TD-12/15 | Safe host processes, CSP-safe execution, complete advisory/SBOM evidence, sanitizer regression, packaged smoke, and release truth. |
| B11 — Recoverable code boundaries | EN-18/19/20/22; TD-16..25, TD-27/28 | Visible warnings, typed/structured boundaries, full hotspot partitioning, risk gates, honest hooks, budgets, dependency evidence, cache and ownership notes. |
| B12 — Physical-system hypothesis | EN-09; FG-19; TD-22; IN-20 | Compatibility first, real firmware workflow study, then bounded enclosure/URDF experiments with `ship`, `reshape`, or `shelf`. |

The overlap is deliberate. For example, TD-22 belongs to behavior, recoverable code ownership, and the physical-system hypothesis because the ESP32 boundary affects all three.

## Source-Coverage Ledger

This ledger proves that every source checklist row survived synthesis and shows where shared execution is coordinated. Coverage is 108/108: Phase 1 contributes 18 EN, Phase 2 contributes 20 FG, Phase 3 contributes 17 UI, Phase 4 contributes 28 TD plus 5 EN, and Phase 5 contributes 20 IN.

### Phase 1 source coverage

| Phase source ID(s) | Final ID(s) | Bundle(s) |
|---|---|---|
| Phase 1 EN-01/02 | EN-01/02 | B1 |
| Phase 1 EN-03 | EN-03 | B4 |
| Phase 1 EN-04/05/06 | EN-04/05/06 | B4 |
| Phase 1 EN-07 | EN-07 | B3 |
| Phase 1 EN-08 | EN-08 | B2 |
| Phase 1 EN-09 | EN-09 | B12 |
| Phase 1 EN-10 | EN-10 | B4 |
| Phase 1 EN-11 | EN-11 | B7 |
| Phase 1 EN-12 | EN-12 | B4, B8 |
| Phase 1 EN-13 | EN-13 | B8 |
| Phase 1 EN-14 | EN-14 | B4, B8 |
| Phase 1 EN-15 | EN-15 | B3, B4 |
| Phase 1 EN-16 | EN-16 | B10 |
| Phase 1 EN-17 | EN-17 | B9 |
| Phase 1 EN-18 | EN-18 | B4, B11 |

### Phase 2 source coverage

| Phase source ID(s) | Final ID(s) | Bundle(s) |
|---|---|---|
| FG-01/02 | FG-01/02 | B1 |
| FG-03/04 | FG-03/04 | B3 |
| FG-05/06/16 | FG-05/06/16 | B6 |
| FG-07/08/09 | FG-07/08/09 | B7 |
| FG-10/11/17/20 | FG-10/11/17/20 | B8 |
| FG-12/13 | FG-12/13 | B2 |
| FG-14 | FG-14 | B9 |
| FG-15 | FG-15 | B5 |
| FG-18 | FG-18 | B2 |
| FG-19 | FG-19 | B12 |

### Phase 3 source coverage

| Phase source ID(s) | Final ID(s) | Bundle(s) |
|---|---|---|
| UI-01..05 | UI-01..05 | B4 |
| UI-06 | UI-06 | B2 |
| UI-07..10 | UI-07..10 | B5 |
| UI-11 | UI-11 | B3 |
| UI-12 | UI-12 | B3, B4 |
| UI-13..16 | UI-13..16 | B4 |
| UI-17 | UI-17 | B1 |

### Phase 4 technical source coverage

| Phase source ID(s) | Final ID(s) | Bundle(s) |
|---|---|---|
| TD-01..06 | TD-01..06 | B10 |
| TD-07..10 | TD-07..10 | B1 |
| TD-11 | TD-11 | B6 |
| TD-12 | TD-12 | B10 |
| TD-13 | TD-13 | B5 |
| TD-14 | TD-14 | B2, B7 |
| TD-15 | TD-15 | B10 |
| TD-16..19 | TD-16..19 | B11 |
| TD-20 | TD-20 | B5, B11 |
| TD-21 | TD-21 | B11 |
| TD-22 | TD-22 | B7, B11, B12 |
| TD-23 | TD-23 | B8, B11 |
| TD-24/25 | TD-24/25 | B11 |
| TD-26 | TD-26 | B2 |
| TD-27/28 | TD-27/28 | B11 |

### Phase 4 enhancement renumbering

| Phase source ID | Final ID | Bundle |
|---|---|---|
| Phase 4 EN-01 | EN-19 | B11 |
| Phase 4 EN-02 | EN-20 | B11 |
| Phase 4 EN-03 | EN-21 | B10 |
| Phase 4 EN-04 | EN-22 | B11 |
| Phase 4 EN-05 | EN-23 | B10 |

The earlier cross-phase shorthand `EN-03/05` in B10 meant **Phase 4 source** EN-03/05, now final EN-21/23. The shorthand `EN-01/02/04` in B11 meant **Phase 4 source** EN-01/02/04, now final EN-19/20/22. Neither shorthand referred to Phase 1 EN IDs.

### Phase 5 source coverage

| Phase source ID(s) | Final ID(s) | Bundle(s) |
|---|---|---|
| IN-01 | IN-01 | B1 |
| IN-02/03 | IN-02/03 | B3 |
| IN-04/05/12 | IN-04/05/12 | B6 |
| IN-06/07/13 | IN-06/07/13 | B7 |
| IN-08/14/17/18 | IN-08/14/17/18 | B8 |
| IN-09/10/15/19 | IN-09/10/15/19 | B2 |
| IN-11 | IN-11 | B5 |
| IN-16 | IN-16 | B9 |
| IN-20 | IN-20 | B12 |

No source finding is bundle-less. Repeated IDs across bundles indicate shared implementation or evidence, not duplicate checklist rows.

## Appendix A: Methodology

### Scope

The quantitative product scope is `client/src`, `server`, `shared`, `packages`, and `src-tauri`. Dependency folders, generated builds, coverage, and Rust target artifacts were excluded from headline counts. The repository's knowledge system and historical records remain important project context but are not product-code lines.

### Analysis sequence

1. **Baseline:** collect product-scoped `scc`, `tokei`, bounded `lizard`, file/test/dependency/schema/route counts, git activity, GitHub workflow state, and artifact size.
2. **Current state:** map the shipping legacy layer, engine layer, data flows, navigation, integrations, maturity, stubs, proposals, and migration state.
3. **Outside landscape:** use official docs, upstream repositories, research, maker projects, community posts, and raw ideas with explicit evidence labels and direct URLs.
4. **UX:** trace all three personas through onboarding, daily work, advanced work, recovery, and collaboration; count static accessibility signals without treating them as runtime conformance.
5. **Technical truth:** inspect complexity, large boundaries, unsafe patterns, execution sinks, security controls, dependencies, CI, system-test gaps, build artifacts, and change frequency.
6. **Innovation:** compose current primitives into twenty proposals with dependency stages, constraints, and acceptance evidence.
7. **Synthesis:** derive impact chains, a risk heatmap, the return gate, 12 bundles, and the 108-row coverage ledger.

### Evidence discipline

- Local claims use file/line references, current project records, command output, or current CI logs.
- Current library/tool behavior was checked through Context7 where available; MDN primary documentation supports the CSP finding.
- Outside capability statements retain their source class and were not converted into live-test claims.
- `scc` and `tokei` differences are retained rather than averaged away.
- `lizard` results are bounded and caveated for nested TypeScript/React closures.
- Test-file counts are not treated as behavioral coverage.
- The Phase 0 snapshot is the headline for rolling git counts; Phase 4's later query is shown as a moving-clock comparison.
- P0–P3 mean dependency/build stages. Every checklist row remains required.
- A P3 experiment can close through a documented `ship`, `reshape`, or `shelf` result.
- The prior completed checklist is historical evidence, not current backlog input.

### Validation target

The deliverables must contain substantive content for all five phases; all five checklist categories; exact 20/17/28/23/20 counts; sequential unique IDs; valid row schema; a 200–400-word executive summary; all three personas; all twenty innovations; at least three direct outside sources; actual raw metrics; impact chains; risk heatmap; dependency stages; 12 bundles; complete source coverage; no placeholders; and no forbidden framing.

## Appendix B: Directory Structure

```text
ProtoPulse/
├── client/src/                 shipping React application
│   ├── pages/                  project picker, workspace, settings, embeds
│   ├── components/views/       architecture, parts, procurement, validation, learning, operations
│   ├── components/circuit-editor/
│   │   ├── breadboard-canvas/  current highest reported control-flow span
│   │   └── PCBLayoutView.tsx   legacy PCB editor
│   └── lib/                    state, simulation, DRC/DSL, import/export, device and product logic
├── server/                     Express API, auth, storage, collaboration, Arduino, frozen legacy AI
├── shared/                     Drizzle schema and shared domain/algorithm contracts
├── packages/                   graph/op-log engine workspaces
│   ├── graph/                  canonical design graph, ops, branches, diff/merge, persistence
│   ├── parts/                  parts and seed data
│   ├── erc/ drc/ route/        electrical/physical checks and routing
│   ├── sim/ emu/ cosim/        analog simulation, MCU emulation, closed loop
│   ├── export/ cli/            deterministic artifacts and command line
│   ├── ai/ review/ relay/      crew, proof/review, local-first sync
│   ├── renderer/ app/          WebGL projection and new editor
│   └── content/                learning content
├── src-tauri/                  desktop shell, commands, lifecycle/storage bridge
├── tools/golden/               contract fixtures and deliberate refresh tool
├── docs/vision/                frozen founding specification
├── docs/adr/                   append-only decision records
├── ROADMAP.md                  canonical build order and status
├── docs/FEATURE_MATURITY.md     current maturity matrix
├── inbox/ knowledge/ ops/       Ars Contexta evidence and operations
├── data/pp-nlm/                PP-NLM data, Codex-owned
└── .ref/                       generated project navigation maps
```

## Appendix C: Raw Tool Outputs

These blocks preserve the measured output used by the analysis. They are not reconstructed estimates.

### Scope counts

```text
client/src  1,683
server        336
shared        104
packages      335
src-tauri       8
total       2,466 code-like files
```

The code-like classifier counts TypeScript/TSX/JavaScript/JSX/Rust/styles/HTML. `scc` also counts JSON, TOML, XML, and selected Markdown in its 2,527-file total.

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
TypeScript Typings           1         1        0         1        0          0
Total                     2527    892476   100763     89720   701993      98541

Estimated Cost to Develop (organic) $26,317,506
Estimated Schedule Effort (organic) 47.65 months
Estimated People Required (organic) 49.06
```

COCOMO is kept only as raw tool output and a size signal.

### `tokei` independent count

```text
Language            Files        Lines         Code     Comments       Blanks
CSS                     4         2457         1727          398          332
JSON                   41        17800        17788            0           12
TOML                   14          232          143           52           37
TSX                   604       152472       130611         8478        13383
TypeScript           1849       717043       551446        79206        86391
HTML                    1           15           15            0            0
Markdown                5          500            0          395          105
Rust                    8         1799         1475          146          178
Total                2528       892327       703214        88675       100438
```

The 1-file / 1,221-code-line difference from `scc` comes from language classification and counting, not a changed source scope.

### Actual bounded `lizard --csv` excerpts

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

The stock whole-repository scan was discarded after it admitted the 26 GB Rust target cache. Six bounded source-only runs completed. Nested TypeScript/React callbacks can be folded into one reported area.

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

Classified HTML/string-execution locations:

```text
client/src/lib/arduino/autocomplete.ts:82                innerHTML (replace)
client/src/components/views/StorageManagerPanel.tsx:732 sanitized SVG sink
client/src/components/ui/chart.tsx:81                   developer-config CSS sink
client/src/lib/drc-scripting.ts:147                     Function syntax check
client/src/lib/drc-script-worker.ts:257                 Function worker execution
client/src/lib/circuit-dsl/circuit-dsl-worker.ts:305    Function in blob worker
```

### Dependency audit summaries

```text
npm audit --omit=dev:
  critical 0, high 5, moderate 59, total affected nodes 64
  production dependency nodes 812
  direct affected: @genkit-ai/google-genai, genkit, js-yaml
  policy result at capture: five high nodes allowed, no unapproved high/critical

cargo audit --file src-tauri/Cargo.lock:
  vulnerabilities 2: RUSTSEC-2026-0194, RUSTSEC-2026-0195
  warnings 23: 19 unmaintained, 4 unsound

cargo tree --target all -i quick-xml@0.38.4:
  quick-xml@0.38.4 -> plist@1.8.0 -> tauri@2.10.3 / Tauri plugins
```

The npm policy result is time-sensitive: the current Genkit/OpenTelemetry exception expires 2026-07-31. The Rust result explains the current release-evidence failure; it does not mean the five platform package jobs failed to build.

### Current GitHub Actions evidence

```text
repository=https://github.com/wtyler2505/ProtoPulse
visibility=PUBLIC
default_branch=main
commit=fbd2f76e

main_ci_run=29139503550
main_ci_status=success
root_test_files=765
root_tests_passed=31247
root_tests_skipped=2
vite_build_seconds=19.37

packages_ci_run=29139503577
packages_ci_status=success

tauri_matrix_run=29139503578
tauri_matrix_status=failure
platform_package_jobs_completed=5
failure_stage=linux-x64 supply-chain check
blocking_ids=RUSTSEC-2026-0194,RUSTSEC-2026-0195
packaged_smoke=skipped downstream of failure
```

Main and package workflow success is current-commit evidence, not a local rerun. Tauri wording is intentionally precise: platform packages completed; the later release-evidence path failed and did not produce packaged-smoke proof.

### Test and coverage output summary

```text
canonical cross-language test files=874
TS/TSX non-test files=1579
static TS/TSX test declarations=31360
root CI=765 files, 31247 passed, 2 skipped
root coverage floor=lines 60%, branches 50%, functions 55%, statements 60%
graph aggregate floor=95/90/95/95
Playwright workflow references=0
packaged desktop smoke=currently skipped
```

The 874 count is the canonical conventional classifier across the product scope. A broader directory-name classifier also sees the Rust command-manifest test and yields 875; this report keeps Phase 0's cross-language baseline. Neither count proves critical journeys.

### Git activity output

```text
commits_30d=389
commits_90d=1048
contributors_all=3
latest_commit=fbd2f76e|2026-07-10T23:22:06-05:00|backlog: BL-0913
```

Later in the same analysis, the moving `--since` clock produced:

```text
Phase 4 rolling snapshot at same HEAD: 388 / 30 days; 1,040 / 90 days
Phase 0 earlier rolling snapshot at same HEAD: 389 / 30 days; 1,048 / 90 days

90-day file change frequency in the Phase 4 cut:
  168 packages/emu/src/esp32s3.test.ts
  159 packages/emu/src/esp32s3.ts
   71 packages/README.md
   49 packages/parts/src/seed/index.ts
   49 packages/parts/src/parts.test.ts
```

The difference is a rolling time-boundary effect at one commit, not repository activity. Headline metrics use Phase 0.

### Dependency manifest and local artifacts

```text
root dependencies=100
root devDependencies=49
root scripts=29
root workspaces=["packages/*", "tools/golden"]
engine packages=16

local artifacts:
  536K packages/cli/dist
   60M dist
  1.4G node_modules
   26G src-tauri/target
```

Workspace-local dependency manifests are not summed because doing so would double-count shared packages. Local `dist` predates the current commit. `src-tauri/target` is a build cache, not application payload, but it affected tool scope and local disk pressure.

### Current Vite chunk output

```text
WebGLBoardViewer  1026.77 kB raw   281.16 kB gzip
CodeEditor         680.74 kB raw   234.26 kB gzip
index              629.06 kB raw   185.20 kB gzip
react-vendor       393.58 kB raw   127.37 kB gzip
BreadboardView     389.58 kB raw   106.40 kB gzip
```

The build passed. These outputs justify analysis and route budgets; they do not justify changing chunk strategy without measured startup and interaction results.
