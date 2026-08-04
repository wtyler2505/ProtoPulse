# Phase 2: Outside Inspiration & Knowledge Landscape — ProtoPulse

> Generated: 2026-07-18
> Research frame: outside work is evidence, teaching material, and creative input. It is not an opponent set.
> Evidence boundary: local ProtoPulse claims were checked in source and project records; outside capabilities were checked in current official or upstream sources unless a row says otherwise. No outside product was live-tested in this phase.

## Outcome

The useful lesson is not “copy a larger tool.” It is that ProtoPulse already owns unusually composable primitives: one typed operation log, deterministic artifacts, review findings with executable fixes, MCU emulation, analog simulation, and a closed firmware-to-circuit loop. The next work should connect those primitives into complete workflows while protecting data compatibility and evidence quality.

The outside landscape repeatedly points toward the same shapes:

1. A design change should travel with intent, source evidence, checks, simulation results, and a reversible diff.
2. Review should be a portable design artifact, not a chat transcript or screenshot pile.
3. Firmware and circuit behavior should be runnable as deterministic scenarios in CI.
4. A part should be a living multi-projection package: electrical facts, symbol, footprint, breadboard shape, model behavior, sources, license, and tests.
5. Files should remain primary, portable, recoverable, and useful without a hosted service.
6. Physical-system expansion should remain a measured hypothesis until the same-user workflow is demonstrated.
7. Outside knowledge should enter through the repository's existing Ars Contexta and PP-NLM bridge, while product records carry reproducible references back to that evidence.

## Method and Evidence Labels

| Label | Meaning in this report |
|---|---|
| **ProtoPulse fact** | Verified in current local source or a current canonical project record. |
| **Verified documentation** | Described by a current official source. It was not independently exercised here. |
| **Upstream implementation claim** | Described in the project's own repository or documentation. Treat as promising until exercised. |
| **Research result** | Reported by a paper. It was not reproduced in this phase. |
| **Community signal** | A forum or original social post. Useful for questions and workflow clues, not prevalence claims. |
| **Raw inspiration** | A very new or unvalidated artifact. It contributes an idea, not proof. |

`P0` through `P3` in the companion checklist means dependency/build order only. Every distinct finding is retained and must be addressed. A required experiment may legitimately end with a documented decision to shelve the tested direction.

## Current ProtoPulse Substrate

| Existing substrate | Verified state | Why it changes what should be learned outside |
|---|---|---|
| Canonical design graph and operation log | Typed mutations, exact inverse operations, branches, visual diff, merge, replay, and deterministic exports share one mechanism (`packages/README.md:3-16,40-55`). | ProtoPulse can make evidence and review native to a change set instead of bolting them onto files later. |
| Review engine | Reports are versioned and diffable (`packages/review/src/report.ts:5-31`); opened and closed findings are computed across runs (`packages/review/src/diff.ts:3-26`); review decks and outside checks are first-class (`packages/review/src/run.ts:335-361`). | Structured review workflows can reuse deterministic reports and executable fixes. |
| Firmware, simulation, and co-simulation | MCU cores, analog simulation, and a firmware-to-analog feedback loop exist as separate packages (`packages/README.md:46-49`). I2C and SPI device models resolve from placed parts in the current roadmap record (`ROADMAP.md:2025-2044`). | Scenario CI and causal debugging are compositions of shipped machinery, not a new simulator project. |
| Local sharing and sync | A complete design can travel inside a URL fragment without upload (`packages/app/src/state/share.ts:5-15,50-75`). Relay rooms sync all branches and can use a shared token plus JSONL persistence, but the token is relay-wide, open startup is allowed, and aggregate room/log state has no quota or eviction policy (`packages/relay/src/server.ts:15-24,47-53,159-203,225-233`; `packages/relay/src/main.ts:12-28`). | Local-first review files and bounded sync should extend this design, with narrow authorization and resource limits, rather than make a hosted database authoritative. |
| Part packs | Packs are parsed, collision-checked, persisted locally, and loaded all-or-nothing (`packages/app/src/state/packs.ts:6-12,59-105`). The part model includes pins, symbol, footprint, basic parametrics, datasheet URL, and coarse provenance (`packages/parts/src/types.ts:92-118`). | The missing step is richer, field-level evidence and multiple physical/behavioral projections, not another unrelated package system. |
| Editor projections | The engine editor exposes only Schematic and PCB buttons (`packages/app/src/App.tsx:110-127`). The migration record still requires feature coverage before legacy retirement (`ROADMAP.md:2113-2139`). | Architecture and breadboard are coherence gaps, not decorative view requests. |
| Agent runtime | Tools produce exact operations and describe them; Draftsman operations are proposals at the package boundary (`packages/ai/src/tools/draftsman.ts:28-33`). The destructive gate is skipped when no callback is supplied (`packages/ai/src/agent.ts:34-35,105-115`), and the Draftsman editor panel remains a disabled integration shell (`packages/app/src/panels/DraftsmanPanel.tsx:1-23`). | Outside AI editing patterns should be adopted only with a fail-closed proposal/review path and complete ordinary edit verbs. |
| File compatibility | `.ppx` writes version 1, accepts any positive version, and has no dispatch or migration (`packages/graph/src/store/serialize.ts:93-129`). Unknown operations fail schema parsing (`packages/graph/src/store/serialize.ts:20-26`), and the directory writer creates an unused `assets/` folder (`packages/graph/src/store/fs-store.ts:13-23,79-112`). | Schema evolution, content-addressed assets, and explicit unknown-operation handling must precede graph broadening. |
| Browser recovery | An unreadable saved design becomes `null` and starts fresh (`packages/app/src/state/persistence.ts:53-62`; `packages/app/src/main.tsx:24-25`), after which unload flushes the active bundle (`packages/app/src/main.tsx:48-53`). | Durable recovery is a prerequisite for every feature that imports, expands, or synchronizes stored state. Invalid capsules, packs, and sync conflicts must inherit the same preserve-first rule. |
| Canvas accessibility | The engine surface is a bare canvas element (`packages/app/src/editor/CanvasHost.tsx:524`). | Accessibility can be an intentional graph projection: derive a semantic tree and keyboard model from the canonical graph plus transient selection/tool state, without creating a parallel stored model. |
| Repository knowledge pipeline | Raw material already routes through `inbox/` and `/extract` before becoming canonical `knowledge/`; PP-NLM publishes versioned sources to `pp-core` or `pp-hardware`, and Studio output returns through `inbox/` before extraction (`AGENTS.md:153-182,193-202`). | Product evidence fields should resolve to this pipeline. A new source-card database would create a third truth surface and is explicitly out of bounds. |
| Production execution and desktop boundary | The legacy DRC and circuit-DSL paths use `Function`, while web and Tauri production CSP omit string-to-code permission (`client/src/lib/drc-scripting.ts:143-151`; `client/src/lib/drc-script-worker.ts:249-259`; `client/src/lib/circuit-dsl/circuit-dsl-worker.ts:295-313`; `src-tauri/tauri.conf.json:23`). Current Tauri packages build, but release evidence fails later at audit and packaged smoke is skipped behind that failure (`.agents/analysis/phase-4-report.md`). | Custom models, checks, scenarios, and capsule logic must use a constrained interpreter or isolated process and prove behavior under production CSP in both browser and packaged desktop. Packaging alone is not release proof. |

## Knowledge Landscape

### Source-to-Ingredient Map

| Source family | Evidence status | What the source actually shows | Ingredient for ProtoPulse | Caution | Finding links |
|---|---|---|---|---|---|
| [KiCad 10 project documentation](https://docs.kicad.org/10.0/en/kicad/kicad.html) | Verified documentation, accessed 2026-07-18 | Reusable design blocks can contain both schematic and layout fragments; project archives and output jobsets are durable project artifacts. | Reusable design capsules that include operations, PCB layout, constraints, tests, review results, and release outputs. | File interchange must preserve editability and round-trip truth; netlist-only export is not enough. | FG-11, FG-14 |
| [Wokwi CI](https://docs.wokwi.com/wokwi-ci/cli-usage) and [Custom Chips API](https://docs.wokwi.com/chips-api/getting-started) | Verified documentation, accessed 2026-07-18 | Headless runs support scenarios, serial expectations, screenshots, and VCD output; custom devices can model digital and analog behavior. | Deterministic firmware/circuit scenarios and a first-class device-model workshop. | ProtoPulse must expose fidelity limits and must not imply physical validation from simulation alone. Its production CSP also means outside custom-code designs are inspiration for a constrained interpreter or isolated process, not permission to add browser string execution. | FG-07, FG-08, FG-09 |
| [Altium 365 design reviews](https://www.altium.com/documentation/altium-365/project-design-reviews?version=22) and [requirements portal](https://www.altium.com/documentation/altium-365/requirements-portal?version=7.0) | Verified documentation, accessed 2026-07-18 | Reviews bind to a design snapshot and include reviewers, checklists, comparisons, comments, tasks, approvals, and a closed audit record; requirements can be traced to verification. | A portable review request capsule plus requirements and verification entities in the graph. | Preserve local ownership and avoid making an account service the only place review evidence exists. | FG-05, FG-06, FG-16 |
| [AllSpice](https://www.allspice.io/) | Verified official description, accessed 2026-07-18 | Visual design diffs, checks, comments, review history, and audit records are presented as one workflow. | Compose ProtoPulse branch diffs, deterministic checks, spatial comments, and sign-off into one review surface. | Official product descriptions are not independent usability evidence. | FG-06 |
| [Flux AI assistant](https://www.flux.ai/copilot), [project reuse](https://docs.flux.ai/flux/tutorials/reusing-community-projects), and [sharing permissions](https://docs.flux.ai/reference/reference-sharing-and-permissions) | Verified documentation, accessed 2026-07-18 | The assistant consumes schematic/BOM/datasheet context and proposes design changes; projects can be reused and shared with scoped permissions. | Context-rich proposals, explicit approval, reusable design seeds, and bounded sharing. | PCB understanding is described as limited; generated changes still need deterministic checks and source evidence. | FG-03, FG-04, FG-11, FG-16 |
| [Fritzing synchronized project views](https://fritzing.org/learning/get-started/project-view), [part creator](https://fritzing.org/learning/get-started/part-creator/), and [parts library](https://fritzing.org/parts) | Verified documentation, accessed 2026-07-18 | Breadboard, schematic, and PCB are synchronized projections; custom parts carry graphics and connector mapping across views. | Complete the engine's architecture and breadboard projections and make multi-view part integrity testable. | Visual agreement is not electrical correctness; pin identity and dimensions still require source-backed validation. | FG-10, FG-12, FG-13 |
| [atopile](https://github.com/atopile/atopile), [tscircuit](https://github.com/tscircuit/tscircuit), and [circuit-synth](https://github.com/circuit-synth/circuit-synth) | Upstream implementation claims, accessed 2026-07-18 | Hardware-as-code projects emphasize reusable modules, units and constraints, ordinary software workflows, registries, browser rendering, and manufacturing output. | Typed requirements, reusable capsules, machine-checkable assertions, and open package travel. | Do not introduce a second source of design truth beside the operation log. Text or code should compile into the same graph operations. | FG-05, FG-11, FG-14 |
| [KiCanvas](https://github.com/theacodes/kicanvas) | Upstream implementation claim; project labels itself early alpha | KiCad designs can be rendered and embedded in a browser through a TypeScript/WebGL viewer. | An open embed/view lane and a reference point for editable KiCad interchange. | A viewer does not prove lossless editing or round trips. | FG-14 |
| [jlceda-cocomment](https://github.com/ZZC43013/jlceda-cocomment) | **Raw inspiration**; repository created 2026-07-17, zero-star at inspection, README says it has not been exercised in a real editor | The README sketches spatial PCB annotations, threaded resolution state, project isolation, local storage, and JSON import/export. | Review comments can travel as a small local artifact even before a relay exists. ProtoPulse can attach them to stable graph anchors rather than screen coordinates alone. | This is not capability proof. Treat only as an idea card and re-check if used. | FG-06, FG-16 |
| [CircuitLM](https://arxiv.org/abs/2601.04505), [PCBSchemaGen](https://arxiv.org/abs/2602.00510), and [WiseEDA](https://openreview.net/forum?id=0gUM1XqtHr) | Research results, not reproduced | These systems combine language models with verified component knowledge, structural/electrical validation, constraints, and numeric optimizers. | Agents should orchestrate typed tools, sources, checks, and solvers; they should not replace them. | Benchmarks and prototypes may not transfer to the exact ProtoPulse workload. | FG-03, FG-05, FG-10 |
| [HWE-Bench](https://arxiv.org/abs/2603.18102), [PCEval](https://openreview.net/forum?id=biJqDcw6i9), and [PCB-QA](https://arxiv.org/abs/2606.23704) | Research results, not reproduced | HWE-Bench reports an 8.15% overall pass rate for its strongest evaluated model; PCEval reports difficulty with physical breadboard placement; PCB-QA explores structured textual circuit representations. | Keep agent edits proof-carrying, add physical-layout tests, and expose the graph as a queryable semantic representation. | Do not generalize one benchmark score into every model or workflow. It is a strong warning, not a universal constant. | FG-03, FG-12, FG-15 |
| [Ink & Switch local-first essay](https://www.inkandswitch.com/essay/local-first/) | Primary design essay | The local copy should remain primary, usable offline, portable, and synchronizable without becoming subordinate to a service. | Recoverable local files, durable offline storage, file-based review, and a relay that carries rather than owns. | Browser localStorage alone is not durable long-term storage. | FG-02, FG-16 |
| [OSHWA certification process](https://certification.oshwa.org/process.html) and [Kitspace](https://kitspace.org/) | Verified official documentation, accessed 2026-07-18 | Open hardware release requires clear source, documentation, software, license, and branding information; ready-to-order projects connect designs to parts procurement. | Reproducible release capsules with licenses, source manifests, fabrication outputs, and sourcing references. | A release checklist must not imply certification or an actual order until the external process completes. | FG-17, FG-20 |
| [PCB ReTrace](https://hackaday.io/project/204738-pcb-retrace) | Maker-project claim, accessed 2026-07-18 | A local browser workflow maps PCB photos into components, nets, and schematic information for repair and reverse documentation. | Photo overlays, physical build reconciliation, and discrepancy capture as operations/evidence. | Its page is author-provided, not an independent assessment. Computer vision output must remain reviewable. | FG-13 |
| [KiCad community design-review discussion](https://forum.kicad.info/t/crowdsource-design-reviews/67923), [KiCad Prism discussion](https://forum.kicad.info/t/kicad-prism-a-self-hosted-web-based-platform-for-design-reviews-visualization/66518), and [original board-review posting rules](https://www.reddit.com/r/PrintedCircuitBoard/comments/zj6ac8/please_read_before_posting_especially_if_using_a/) | Community signals, accessed 2026-07-18 | Reviewers ask for purpose, requirements, readable views, automated checks before human review, anchored comments, and durable review context. | Generate a review request capsule that explains intent and presents exact views/diffs/checks before asking for judgment. | Anecdotes do not establish frequency. They are workflow prompts to validate with ProtoPulse users. | FG-05, FG-06 |
| [MDN canvas fallback guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage) and [W3C keyboard guidance](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html) | Verified standards/guidance, accessed 2026-07-18 | Canvas needs accessible fallback/parallel content, and functionality must be operable from a keyboard. | Treat semantics as an intentional projection of stable graph entities and current UI state, paired with keyboard circuit navigation. | A label on the canvas alone does not make its internal content operable, while a separate persisted accessibility model would create avoidable drift. | FG-15 |
| [CadQuery](https://cadquery.readthedocs.io/en/stable/), [JSCAD](https://jscad.app/), and [ROS URDF](https://docs.ros.org/en/jazzy/p/urdf_tutorial/) | Verified project documentation, accessed 2026-07-18 | Parametric solid modeling and link/joint robot descriptions offer candidate boundary formats for enclosure and kinematic experiments. | Cheap external-kernel experiments for the proposed physical-system direction. | ADR-0017 is still Proposed. Float geometry and foreign kernels stay outside the deterministic graph core until the workflow assumption is validated. | FG-19 |
| [kicad-happy](https://github.com/aklofas/kicad-happy) | Upstream implementation claim; young repository, accessed 2026-07-18 | A skill bundle assembles review, EMC, SPICE, datasheet, sourcing, and fabrication checks around KiCad work. | Keep ProtoPulse checks composable as versioned decks and evidence-producing tools that agents can invoke. | Popularity or activity does not establish engineering correctness; inspect every check before reuse. | FG-03, FG-06, FG-17 |

## Synthesis: What to Adapt and Combine

### 1. Make changes carry proof

The papers warn against trusting unverified board generation. The local engine already produces exact operations, review findings, simulation results, and branch diffs. ProtoPulse should make an agent-created branch carry:

- the user's stated intent;
- every source and datasheet passage used;
- the exact operations proposed;
- ERC, DRC, review, simulation, and scenario results;
- known model-fidelity cuts;
- the before/after diff and a reversible apply decision.

This is more durable than a chat answer and more honest than presenting a plausible schematic as finished. It maps to FG-03 and depends on FG-01 through FG-04.

### 2. Turn review into a portable artifact

The strongest review patterns combine a frozen design state, stated purpose, comparisons, checklists, comments, and sign-off. ProtoPulse already has branch snapshots, stable graph anchors, report deltas, and executable fixes. The missing unit is a versioned review capsule that can travel as a file, URL, or bounded room without losing its source state. Invalid/future capsule imports must preserve their raw bytes and never replace an active design, and room travel inherits authorization, quota, eviction, and conflict-recovery requirements. This maps to FG-05, FG-06, and FG-16.

### 3. Test behavior, not only connectivity

Wokwi's headless scenarios show the value of serial expectations, inputs, screenshots, and waveforms. ProtoPulse can go further with already-shipped analog feedback: a scenario can stimulate a sensor, observe firmware, assert a GPIO edge, inspect a solved voltage, and preserve VCD/waveform evidence in one run. This maps to FG-07 and FG-08.

### 4. Treat devices as living packages

Fritzing teaches synchronized visual projections; Wokwi teaches executable device behavior; OSHWA teaches source and license clarity. ProtoPulse's part pack can combine all three. Each field should say where it came from and when it was checked, using a durable identifier that resolves to the existing Ars Contexta evidence flow. Each projection should be cross-validated against the same stable pins. Executable models must use a CSP-safe interpreter or isolated process and pass packaged-desktop tests. This maps to FG-09, FG-10, and FG-17.

### 5. Reuse whole verified systems

KiCad design blocks and the hardware-as-code projects show that users want more than isolated components. ProtoPulse's reusable unit can include operations, layout, requirements, checks, simulation scenarios, device models, review history, BOM alternatives, and a lesson path. This maps to FG-11.

### 6. Bring the physical workbench back into the graph

Fritzing, PCEval, PCB ReTrace, and maker review threads all expose the gap between a logical circuit and the thing on the desk. Architecture and breadboard projections should share the canonical graph, then build mode should record observed discrepancies as evidence instead of silently altering design truth. This maps to FG-12 and FG-13.

### 7. Keep ownership and escape paths real

The local-first source, KiCanvas, KiCad, and file-based comment experiments all reinforce portable data. ProtoPulse should have recoverable primary files, native-format round-trip fixtures, local review artifacts, and relay permissions narrow enough for real sharing. Recovery means preserving invalid imports and conflicted local branches, not silently accepting last-write-wins. Network sharing also needs explicit bind policy, room-scoped roles, quotas, backpressure, idle eviction, and storage limits. This maps to FG-02, FG-14, and FG-16.

### 8. Test graph expansion before naming it as scope

CadQuery, JSCAD, and URDF are useful experiment materials, not proof that enclosure or robotics belongs in ProtoPulse. ADR-0017 remains Proposed (`docs/adr/0017-physical-system-design-graph.md:1-6,117-150`). The required work is a staged hypothesis program: first make schema evolution safe, then test firmware co-design with real workflows, then run bounded enclosure and kinematic spikes only if the same-user assumption survives. This maps to FG-19.

### 9. Grow one knowledge system, not three

The living evidence idea belongs on the existing repository path. Raw URLs, papers, repositories, posts, and notes enter `inbox/`; `/extract` turns them into discoverable atomic knowledge; the vault remains canonical. PP-NLM provides `pp-core` and `pp-hardware` query/synthesis surfaces and returns Studio output to `inbox/` with provenance before extraction. Product-facing graph, pack, deck, review, and release records carry only the durable identifiers, source revision/hash, applicability, and verification state needed to reproduce a claim. They do not copy the knowledge corpus into a new database. This maps to FG-10, FG-17, and FG-20 (`AGENTS.md:153-182,193-202`).

### 10. Delivery policy is part of the feature

An idea is not complete because it works in a development tab. Custom model/check logic must work without weakening CSP; imported artifacts must follow non-destructive recovery; collaboration must survive hostile or exhausted rooms; and desktop claims require production-policy packaged smoke plus current audit evidence. The current Tauri signal is precise: platform packages complete, while the release workflow fails later and skips packaged smoke. This maps to FG-01, FG-02, FG-06, FG-07, FG-09, FG-11, FG-14, FG-16, and FG-20.

## Cross-Phase Constraint Bindings

| Constraint already verified elsewhere | Findings that inherit it | Binding for this phase |
|---|---|---|
| Evolution-safe data and non-destructive recovery | FG-01, FG-02, FG-06, FG-11, FG-14, FG-16, FG-20 | Version every imported artifact, retain unreadable originals, block automatic overwrite/merge, and expose export/migrate/reset or conflict-branch choices. |
| Production CSP forbids current string-to-code paths | FG-07, FG-09, FG-11 | Scenario and model formats are data; executable extensions use a constrained interpreter/AST evaluator or isolated process. Prove them in production-CSP browser and packaged Tauri without weakening policy. |
| Relay can be open/global-token and retains unbounded aggregate state | FG-06, FG-16 | Add explicit bind rules, non-loopback auth, room roles, quotas, backpressure, eviction, storage limits, and resource tests before review/collaboration leaves localhost. |
| Tauri packages build but release evidence currently fails later | FG-02, FG-07, FG-09, FG-15, FG-18, FG-20 | Distinguish package success from release readiness. Require independent packaged smoke, current audit evidence, and the same recovery/CSP/accessibility behavior as the browser. |
| Accessibility is a projection of graph plus UI state | FG-12, FG-13, FG-15 | Land reflow, focus-visible controls, real tab semantics, and a named focusable canvas first; then grow entity navigation/equivalent edits without new stored accessibility vocabulary. |
| Ars Contexta plus PP-NLM is the existing knowledge path | FG-10, FG-17, FG-20 | Raw material flows `inbox/` to `/extract` to `knowledge/`; PP-NLM mirrors/synthesizes through its bridge; product records reference canonical evidence rather than becoming a third corpus. |

## Findings Crosswalk

Every distinct finding below has a matching action in `phase-2-checklist.md`. None is dropped because another item looks more exciting.

| ID | Finding | Local evidence and outside lesson | Dependency outcome |
|---|---|---|---|
| FG-01 | `.ppx` cannot safely evolve yet. | No version dispatch, no migration, unknown operations hard-fail, and `assets/` is a stub. Outside reusable blocks and physical models increase format pressure. | Versioned migrations, asset hashing, unknown-operation preservation/quarantine, and frozen cross-version fixtures precede graph expansion. |
| FG-02 | Saved-design recovery can replace unreadable local data with a starter bundle. | Current load returns `null`; boot selects a fixture; unload flushes the active bundle. Local-first work treats local data as primary, not disposable. | Preserve the raw value, stop autosave, offer export/recovery/migration, and require an explicit reset. |
| FG-03 | Agent editing lacks a complete, fail-closed, proof-carrying product path. | The package can propose operations, but confirmation is optional, common edit/delete verbs are missing, and the Draftsman panel is a stub. Research results argue for tool-backed verification. | Complete ordinary edits, require approval for mutation, run checks, and bind sources/results to a proposal branch. |
| FG-04 | Browser-direct provider keys are not a durable product boundary. | `docs/FEATURE_MATURITY.md:208` records the browser-direct adapter; BL-0911 remains open. Outside sharing systems separate user permissions and service custody. | Add a thin private provider gateway and self-host path without making the design file server-owned. |
| FG-05 | Intent and requirements are not first-class graph entities. | Review discussions ask for purpose before judgment; requirements systems trace claims to verification. | Add typed requirements, tolerances, constraints, and evidence links that checks and scenarios can satisfy or refute. |
| FG-06 | Review checks exist, but a full review request and response artifact does not. | ProtoPulse has reports/deltas/fixes; outside review flows add snapshot, comparisons, comments, checklist, roles, and sign-off. | Create a versioned portable review capsule with stable anchors, preserve-first import recovery, local JSON travel, and bounded-room policy. |
| FG-07 | The CLI checks circuits but does not run firmware/circuit scenarios. | Current CLI exposes `check`, `export`, and `import-legacy` (`packages/cli/src/index.ts:15-22,37-40,91-119`). Wokwi demonstrates headless scenario assertions and artifacts. | Add a data-only deterministic scenario format and CI command covering serial, pins, buses, analog nodes, timeouts, and artifacts; prove any extensibility under production CSP and packaged Tauri. |
| FG-08 | Firmware, digital events, analog waveforms, and design history are not one causal timeline. | Emulator and co-sim exist, but their evidence is split across panels/packages. Debugger and VCD patterns show the usefulness of aligned time. | Add a synchronized trace that moves among program counter/register state, bus transactions, GPIO edges, analog nodes, and graph operations. |
| FG-09 | Device-model authoring is code-first and catalog growth is manual. | Current I2C/SPI models and registries prove the path; custom-chip systems show a bounded authoring surface, while current production CSP rejects string execution. | Provide a resource-bounded register-map/device-model SDK using a constrained interpreter or isolated process, with fixtures, protocol traces, fidelity declarations, and production-policy browser/Tauri tests. |
| FG-10 | Part provenance is coarse and the model lacks breadboard, 3D, SPICE, firmware-device, and license projections. | Current schema has a single provenance tier/note and limited geometry. Multi-view part creators and open-hardware practice show the missing whole. | Build a versioned living pack with field-level references into canonical Ars evidence, cross-projection pin tests, and CSP-safe model execution. |
| FG-11 | Reuse stops at part packs; verified circuit/system capsules are absent. | KiCad design blocks and code-based registries package reusable systems. | Package graph operations, board fragment, requirements, data-only scenarios, review, BOM choices, and canonical evidence references as one versioned forkable unit with preserve-first import recovery. |
| FG-12 | The engine has no architecture projection. | Only Schematic and PCB are exposed; legacy architecture is rated Production (`docs/FEATURE_MATURITY.md:31`). | Materialize system blocks, interfaces, budgets, requirements, and drill-down links from the same graph. |
| FG-13 | The engine has no breadboard/build projection or physical reconciliation loop. | Legacy breadboard is Partial (`docs/FEATURE_MATURITY.md:34`); PCEval warns that physical layout is hard; PCB ReTrace demonstrates photo-linked documentation. | Add a dimension-verified breadboard projection, guided build checks, photo overlays, continuity observations, and discrepancy operations. |
| FG-14 | Native editable interchange is too narrow. | Engine export currently includes a KiCad netlist, not a full editable schematic/board round trip (`packages/README.md:43,53`). | Add version-pinned KiCad import/export with round-trip fixtures and an embeddable read-only projection. |
| FG-15 | The canvas lacks a semantic and keyboard-operable circuit representation. | Current canvas is one bare element; MDN/W3C guidance requires more than pixels. | Make accessibility an intentional transient projection of the graph and current UI state: staged reflow/focus/tab semantics, semantic DOM entities, keyboard operations, and narrated changes, with no parallel stored model. |
| FG-16 | Collaboration is local-first in architecture but too broadly gated and unbounded for real multi-user sharing. | The relay has an optional global token, not per-room/user authorization, and no aggregate quotas/eviction; review comments are not portable artifacts. | Add explicit bind/auth policy, room capabilities/roles, quotas/backpressure/eviction/storage limits, durable local queues, preserve-first conflict branches, and file exchange without the relay. |
| FG-17 | Evidence freshness is encoded in prose rather than machine-checkable fields, but a canonical knowledge path already exists. | Seed parts contain dated notes; `inbox/` → `/extract` → `knowledge/` plus the PP-NLM bridge already owns research knowledge. | Route raw evidence through that pipeline; product records store resolvable source IDs, accessed dates, revisions/hashes, applicability, recheck state, and license compatibility—not a new corpus. |
| FG-18 | The new engine has not proved migration on Tyler's real projects. | The importer exists, but real projects, default flip, grace period, and retirement are open (`ROADMAP.md:2126-2139`). | Run representative projects through the engine, record every parity and data issue, and make that evidence gate the canonical-surface decision. |
| FG-19 | The physical-system direction is a proposed, unvalidated hypothesis. | ADR-0017 explicitly names an unproven same-user assumption and schema prerequisites. | Run a gated firmware workflow study, then bounded enclosure and URDF spikes only after evidence supports them; document a ship, reshape, or shelf decision and route positive and negative results through the existing Ars Contexta and PP-NLM path. |
| FG-20 | Open-hardware release output is not one reproducible artifact. | ProtoPulse already emits deterministic manufacturing files and sourcing data; OSHWA and Kitspace show the broader publication/sourcing packet. | Produce a signed release capsule with exact design/pack/deck revisions, canonical evidence IDs, licenses, checks, fabrication outputs, honest external-process status, and reproducibility in a clean/policy-equivalent environment. |

## Existing Capabilities to Protect

These are not claims of superiority. They are foundations that outside ideas should compose rather than dilute.

- **One graph, one operation history.** New projections, code interfaces, comments, and requirements must compile to or reference the canonical graph, never become a parallel design database (`packages/README.md:3-16,74-86`).
- **Deterministic artifacts.** Golden outputs and stable review reports make change evidence reproducible (`packages/README.md:57-72`).
- **Executable findings.** ERC/review fixes can become part of review and agent proposals rather than static warnings (`packages/review/src/run.ts:343-361`; `packages/app/src/panels/ReviewPanel.tsx:74-89`).
- **Honest model cuts.** Simulation and emulation limits should remain visible in every scenario and proposal (`packages/README.md:84-89`).
- **Closed firmware/circuit loop.** This enables scenario assertions and causal traces that neither a schematic-only nor firmware-only workflow can express (`packages/README.md:46-49`).
- **Files remain meaningful.** Share fragments, `.ppx`, packs, exports, and the relay-carries model all point toward user-owned artifacts (`packages/app/src/state/share.ts:5-15`; `packages/relay/src/server.ts:15-24`).
- **One repository knowledge pipeline.** Ars Contexta owns extracted research truth; PP-NLM provides versioned query/synthesis hubs and returns generated material through the same inbox bridge. Product schemas should reference that evidence, not fork it (`AGENTS.md:153-182,193-202`).
- **Strong production policy.** Web and desktop CSP intentionally reject string execution. New model or extension formats should preserve that boundary and prove packaged behavior rather than weakening it (`src-tauri/tauri.conf.json:23`; [MDN `script-src` guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_eval_expressions)).

## Research Limits

- Outside capability statements are documentation-backed, not live usability findings.
- Repository activity, stars, and freshness are discovery clues only. They are not evidence of correctness.
- Forum and original social posts are deliberately labeled community signals.
- The July 17 `jlceda-cocomment` repository is deliberately retained because the user asked for day-one work as creative input; it is explicitly not treated as a working reference implementation.
- Paper results were not reproduced against ProtoPulse.
- `.ref/project-dna.md` remains useful for navigation but was generated before July work. Current claims in this report use live source or current canonical rows instead of restating stale counts.

## Source Register

All links were accessed 2026-07-18 unless noted above.

### Official and Primary Documentation

- [KiCad 10 documentation](https://docs.kicad.org/10.0/en/kicad/kicad.html)
- [Wokwi CLI](https://docs.wokwi.com/wokwi-ci/cli-usage)
- [Wokwi custom chips](https://docs.wokwi.com/chips-api/getting-started)
- [Flux AI assistant](https://www.flux.ai/copilot)
- [Flux project reuse](https://docs.flux.ai/flux/tutorials/reusing-community-projects)
- [Flux sharing and permissions](https://docs.flux.ai/reference/reference-sharing-and-permissions)
- [Fritzing project views](https://fritzing.org/learning/get-started/project-view)
- [Fritzing part creator](https://fritzing.org/learning/get-started/part-creator/)
- [Altium 365 design reviews](https://www.altium.com/documentation/altium-365/project-design-reviews?version=22)
- [Altium 365 requirements](https://www.altium.com/documentation/altium-365/requirements-portal?version=7.0)
- [AllSpice](https://www.allspice.io/)
- [OSHWA certification process](https://certification.oshwa.org/process.html)
- [Kitspace](https://kitspace.org/)
- [MDN canvas guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage)
- [W3C keyboard guidance](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [MDN CSP `script-src` guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_eval_expressions)
- [CadQuery](https://cadquery.readthedocs.io/en/stable/)
- [JSCAD](https://jscad.app/)
- [ROS URDF tutorial](https://docs.ros.org/en/jazzy/p/urdf_tutorial/)

### Upstream Repositories

- [atopile](https://github.com/atopile/atopile)
- [tscircuit](https://github.com/tscircuit/tscircuit)
- [circuit-synth](https://github.com/circuit-synth/circuit-synth)
- [KiCanvas](https://github.com/theacodes/kicanvas)
- [kicad-happy](https://github.com/aklofas/kicad-happy)
- [jlceda-cocomment](https://github.com/ZZC43013/jlceda-cocomment) — raw inspiration, created 2026-07-17

### Research

- [CircuitLM](https://arxiv.org/abs/2601.04505)
- [PCBSchemaGen](https://arxiv.org/abs/2602.00510)
- [HWE-Bench](https://arxiv.org/abs/2603.18102)
- [PCB-QA](https://arxiv.org/abs/2606.23704)
- [PCEval](https://openreview.net/forum?id=biJqDcw6i9)
- [WiseEDA](https://openreview.net/forum?id=0gUM1XqtHr)
- [Local-first software essay](https://www.inkandswitch.com/essay/local-first/)

### Maker and Community Signals

- [PCB ReTrace](https://hackaday.io/project/204738-pcb-retrace)
- [KiCad community design-review discussion](https://forum.kicad.info/t/crowdsource-design-reviews/67923)
- [KiCad Prism discussion](https://forum.kicad.info/t/kicad-prism-a-self-hosted-web-based-platform-for-design-reviews-visualization/66518)
- [Original board-review posting rules](https://www.reddit.com/r/PrintedCircuitBoard/comments/zj6ac8/please_read_before_posting_especially_if_using_a/)
