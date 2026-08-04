# Phase 5: Feature Innovation — Composing ProtoPulse's Existing Primitives

> Generated: 2026-07-18
> Ordering rule: proposals are arranged by technical dependency, not by value, impact, popularity, or presumed appeal.
> Completeness rule: every proposal has a matching action in `phase-5-checklist.md`. Nothing in a later build stage is disposable.

## Design Thesis

ProtoPulse does not need another disconnected subsystem. Its strongest future features come from composing what already exists:

- a typed operation log with branch, diff, merge, replay, and deterministic exports;
- review findings with executable fixes and opened/closed deltas;
- a provider-neutral agent runtime that emits graph operations;
- analog simulation, MCU emulation, and closed-loop co-simulation;
- portable design bundles, part packs, share fragments, and a relay that carries copies;
- verified hardware facts and explicit fidelity cuts.
- an existing Ars Contexta `inbox/` → `/extract` → `knowledge/` pipeline plus the PP-NLM bidirectional bridge.

The innovation direction is therefore **proof-carrying physical design**: every design claim can point to its intent, canonical source evidence, operation history, executable check, scenario, review record, and physical observation. Outside sources supply ingredients, warnings, and experiment forms; they do not define ProtoPulse's identity. Delivery constraints travel with the idea: recovery is preserve-first, custom logic keeps production CSP strong, collaboration is narrowly authorized and resource-bounded, accessibility is a graph projection, and desktop claims require packaged-policy evidence.

## Dependency Stages

| Stage | Meaning |
|---|---|
| P0 | Compatibility, recovery, mutation safety, or private-service boundary required before broader product work. |
| P1 | Core workflows that build directly on P0 and complete the engine's intended design loop. |
| P2 | Composite capabilities that depend on P1 artifacts and verified projections. |
| P3 | Required hypothesis experiments after the substrate is safe. A documented decision to shelve a direction is a valid completed result. |

## Proposals in Dependency Order

### IN-01: Evolution-Safe `.ppx` With Recovery Mode

- **What**: Turn `.ppx` into an explicitly evolvable, recoverable format: content-addressed assets, version dispatch, forward migrations, unknown-operation preservation/quarantine, frozen cross-version fixtures, and a recovery-only editor state.
- **Why**: Every richer pack, model, requirement, review, or physical-system experiment increases stored-data pressure. Current format parsing accepts any positive version, unknown operations hard-fail, `assets/` is a stub, and unreadable browser data can fall through to a starter fixture (`packages/graph/src/store/serialize.ts:20-26,93-129`; `packages/graph/src/store/fs-store.ts:79-112`; `packages/app/src/state/persistence.ts:53-62`).
- **How**: Add migration registries for bundle and directory forms; hash blobs by SHA-256; keep opaque future records round-trippable when policy permits; store the original unreadable payload; block autosave in recovery mode; require explicit export, migration, or reset. Apply the same recovery contract to review/design capsules, packs, relay conflicts, browser storage, and packaged Tauri storage.
- **Outside input**: KiCad's durable project/archive formats and the local-first principle that user data must outlive a service or one application version: [KiCad 10 docs](https://docs.kicad.org/10.0/en/kicad/kicad.html), [local-first essay](https://www.inkandswitch.com/essay/local-first/).
- **Personas served**: Hobbyist maker, professional electrical engineer, hardware startup founder.
- **Effort / stage**: XL / P0.
- **Acceptance signal**: Version-1 fixtures load under a version-2 reader; a future-operation fixture is preserved without silent loss; corrupted storage never triggers a write until the user chooses a recovery action; asset hashes round-trip byte-identically; browser and packaged-Tauri recovery fixtures behave the same.

### IN-02: Proof-Carrying Crew Change Sets

- **What**: Every agent mutation becomes a proposal branch containing intent, sources, rationale, exact operations, before/after diff, verification runs, fidelity notes, and an explicit human apply/merge decision.
- **Why**: The current runtime can produce exact operations, but the destructive gate is skipped if no callback is supplied (`packages/ai/src/agent.ts:34-35,105-115`), Draftsman lacks ordinary iterative edit/remove tools, and its editor panel remains a shell (`packages/app/src/panels/DraftsmanPanel.tsx:1-23`). HWE-Bench reports only an 8.15% overall pass rate for its strongest evaluated model, a strong warning against treating plausible output as verified design.
- **How**: Make confirmation mandatory for mutation; add change-value, remove, disconnect, constraint-edit, and bus/sheet-edit tools; write to a named proposal branch; run ERC, DRC, review, simulation, and relevant scenarios; attach source identifiers that resolve into the canonical Ars Contexta evidence flow plus known gaps; make merge the sole product commit point. Evidence from custom checks counts only when that execution path passes production-policy tests.
- **Outside input**: [HWE-Bench](https://arxiv.org/abs/2603.18102), [CircuitLM](https://arxiv.org/abs/2601.04505), [PCBSchemaGen](https://arxiv.org/abs/2602.00510), [Flux AI assistant](https://www.flux.ai/copilot).
- **Personas served**: All three, with the evidence depth adjusted to user mode.
- **Effort / stage**: XL / P0.
- **Acceptance signal**: No mutating tool can commit without a decision; a request such as “change R7, remove C2, and re-check the design” produces a reviewable branch with complete evidence and an exact reversible diff.

### IN-03: Private Provider Gateway Without File Dependence

- **What**: A thin provider gateway keeps model keys out of the browser while leaving local files, manual editing, checks, simulation, and exports fully usable without it.
- **Why**: Current maturity records say the Anthropic adapter is browser-direct with a user key (`docs/FEATURE_MATURITY.md:208`). This is a poor boundary for team use and conflicts with the project's stated thin-server direction.
- **How**: Add passkey/OAuth-capable identity, encrypted provider credentials, per-user budgets, scoped agent endpoints, request audit records, streaming, and a documented self-host configuration. The gateway receives bounded design context and returns proposals; it never becomes the design authority. Browser and desktop clients store only scoped session material; native credential integration requires its own packaged smoke and audit evidence.
- **Outside input**: Flux sharing permissions show the usefulness of scoped access, while local-first design warns against making server availability a condition for owning work: [Flux permissions](https://docs.flux.ai/reference/reference-sharing-and-permissions), [local-first essay](https://www.inkandswitch.com/essay/local-first/).
- **Personas served**: Professional electrical engineer, hardware startup founder; hobbyist maker through self-host and direct local modes.
- **Effort / stage**: L / P0.
- **Acceptance signal**: Browser storage/network inspection reveals no provider secret; service outage disables only provider calls; existing `.ppx` work remains editable and verifiable; self-host setup passes a documented smoke test.

### IN-04: Intent, Requirement, and Verification Graph

- **What**: Add first-class graph entities for goals, functional requirements, limits, tolerances, environmental assumptions, verification methods, and evidence links.
- **Why**: Reviews become far more useful when they can answer “what was this supposed to do?” Current checks see topology and values, but product intent lives outside the graph. Community review discussions explicitly ask for purpose before judgment.
- **How**: Define typed operations for requirement creation/change/retirement and trace edges to blocks, parts, nets, scenarios, review findings, and release claims. A requirement can be `unverified`, `satisfied`, `failed`, or `waived`, with the evidence record and reviewer attached.
- **Outside input**: [Altium 365 requirements](https://www.altium.com/documentation/altium-365/requirements-portal?version=7.0), [atopile](https://github.com/atopile/atopile), [KiCad design-review discussion](https://forum.kicad.info/t/crowdsource-design-reviews/67923).
- **Personas served**: Professional electrical engineer and hardware startup founder; maker-friendly templates expose the same model without paperwork theater.
- **Effort / stage**: XL / P1.
- **Acceptance signal**: A power requirement traces to source components, budget checks, a simulation/scenario result, and a review decision; changing a tolerance invalidates stale evidence deterministically.

### IN-05: Portable Review Request Capsules

- **What**: Package a review as a durable artifact: purpose/requirements, frozen branch, schematic/PCB/BOM/fabrication comparisons, versioned deck results, checklist, stable-anchor comment threads, tasks, executable fixes, decisions, and closure state.
- **Why**: ProtoPulse already has deterministic review reports and deltas (`packages/review/src/report.ts:5-31`; `packages/review/src/diff.ts:3-26`) but lacks the complete request/response envelope used by real review workflows.
- **How**: Add a versioned `pp-review-capsule` format referenced by `.ppx`; anchor comments to graph IDs plus a view position; support read/comment/edit capabilities; export/import as JSON; sync through a room only under the IN-12 bind/auth/quota policy; freeze a closed capsule read-only while preserving follow-up branches. An unsupported or malformed capsule retains its original bytes, opens recovery instead of normal merge, and cannot replace the active design.
- **Outside input**: [Altium 365 design reviews](https://www.altium.com/documentation/altium-365/project-design-reviews?version=22), [AllSpice](https://www.allspice.io/), [KiCad Prism discussion](https://forum.kicad.info/t/kicad-prism-a-self-hosted-web-based-platform-for-design-reviews-visualization/66518), and the July 17 [jlceda-cocomment](https://github.com/ZZC43013/jlceda-cocomment) idea card. The last source is raw inspiration only.
- **Personas served**: All three; a maker can send one file, while a team can require named reviewers and checklists.
- **Effort / stage**: XL / P1.
- **Acceptance signal**: A reviewer with no account can open a capsule, see the exact design state and evidence, add anchored comments in a separate response artifact, and return it without corrupting the design; invalid/future capsules preserve the original; room resource/auth tests pass; closure remains auditable.

### IN-06: Circuit Scenario CI

- **What**: A declarative scenario format and `protopulse run` command drive firmware and circuit inputs over simulated time and assert serial text, bus traffic, pins, analog nodes, requirements, and time budgets.
- **Why**: The CLI currently checks and exports designs but does not exercise runtime behavior (`packages/cli/src/index.ts:15-22,37-40,91-119`). ProtoPulse already has the harder substrate: MCU emulation plus closed-loop analog feedback.
- **How**: Define a data-only schema for time-based actions (`set analog`, `toggle pin`, `write device register`, `advance`, `reset`) and expectations (`serial contains`, `node within`, `edge before`, `bus transaction`, `requirement satisfied`). Produce stable JSON, VCD, waveform, serial, and screenshot artifacts with explicit model/fidelity metadata. Extension expressions use the IN-07 constrained interpreter boundary rather than `Function` or another string-to-code shortcut.
- **Outside input**: [Wokwi CLI scenarios and artifacts](https://docs.wokwi.com/wokwi-ci/cli-usage) and [Wokwi CI introduction](https://docs.wokwi.com/wokwi-ci/getting-started).
- **Personas served**: All three; makers get repeatable examples, engineers get regression tests, founders get release gates.
- **Effort / stage**: XL / P1.
- **Acceptance signal**: A sensor scenario drives an analog condition, firmware reads the modeled device, a GPIO changes, the solved circuit response enters tolerance, and the command exits deterministically with preserved evidence in CLI, production-CSP browser, and packaged Tauri where that surface is exposed.

### IN-07: Device Model Workshop

- **What**: A bounded authoring environment for I2C, SPI, GPIO, analog, and mixed-signal device behavior, packaged with register maps, tests, protocol traces, and fidelity declarations.
- **Why**: Current device models prove end-to-end graph resolution, but expanding the catalog requires hand-written package code. A workshop lowers the path while keeping behavior explicit and testable.
- **How**: Provide register-map helpers, state machines, deterministic clocks/random seeds, bus hooks, analog transfer functions, resource/time limits, a trace inspector, fixture generator, and pack signing/source fields. Use a constrained interpreter/AST evaluator or isolated process. Do not add browser string execution or weaken web/Tauri CSP to make outside custom-code patterns fit.
- **Outside input**: [Wokwi Custom Chips API](https://docs.wokwi.com/chips-api/getting-started), [CircuitLM](https://arxiv.org/abs/2601.04505).
- **Personas served**: Hobbyist maker and professional electrical engineer; startup teams can encode proprietary peripherals locally.
- **Effort / stage**: XL / P1.
- **Acceptance signal**: A user models a small I2C sensor from a datasheet, passes generated register/bus fixtures, declares unsupported behavior, loads it through a pack, and runs it in co-simulation without modifying core packages; adversarial resource tests and production-CSP browser/packaged-Tauri smoke pass without `'unsafe-eval'`.

### IN-08: Living Multi-Projection Part and Device Packs

- **What**: One versioned package carries electrical pin facts, symbol, footprint, breadboard geometry, 3D model, SPICE model, firmware device model, sourcing identifiers, tutorials, licenses, sources, and cross-projection tests.
- **Why**: The existing part schema has symbol, basic footprint, and one coarse provenance note (`packages/parts/src/types.ts:92-118`). Physical and behavioral projections are fragmented or absent, making pin drift and stale facts hard to detect.
- **How**: Give every field a source identifier and verification state that resolves to canonical Ars Contexta knowledge produced through `inbox/` and `/extract`; share stable pin keys across projections; add geometry/license/model hashes; run tests that all projections cover the same pins and units; expose maturity per projection rather than one package-wide badge. Executable behavior uses the IN-07 CSP-safe boundary.
- **Outside input**: [Fritzing part creator](https://fritzing.org/learning/get-started/part-creator/), [Wokwi custom chips](https://docs.wokwi.com/chips-api/getting-started), [OSHWA process](https://certification.oshwa.org/process.html).
- **Personas served**: All three.
- **Effort / stage**: XL / P1.
- **Acceptance signal**: Changing a pin mapping fails symbol, footprint, breadboard, model, and scenario checks until reconciled; the UI shows exactly which projections are verified and against which source revision.

### IN-09: Architecture as a Live Projection

- **What**: Restore architecture on the engine as a graph-derived system view of blocks, interfaces, budgets, requirements, and drill-down paths into schematic, board, firmware, and review evidence.
- **Why**: The engine editor currently offers only Schematic and PCB (`packages/app/src/App.tsx:110-127`), while legacy architecture is rated Production (`docs/FEATURE_MATURITY.md:31`). The absence blocks coherent migration and hides system intent from reviews and agents.
- **How**: Materialize blocks from sheets, buses, requirement groups, power trees, and firmware boundaries; support explicit architecture-only layout operations that never duplicate connectivity; show interface contracts and evidence status; keep every block linked to concrete graph entities.
- **Outside input**: Requirements traceability and code-based module systems suggest useful abstractions without creating a second source of truth: [Altium requirements](https://www.altium.com/documentation/altium-365/requirements-portal?version=7.0), [atopile](https://github.com/atopile/atopile), [tscircuit](https://github.com/tscircuit/tscircuit).
- **Personas served**: All three, especially professional engineers and founders communicating system intent.
- **Effort / stage**: XL / P1.
- **Acceptance signal**: A representative legacy architecture opens on the engine with equivalent user-visible information, and editing a block/interface produces normal graph operations visible in every dependent projection.

### IN-10: Breadboard Build Mode With Observed-Reality Reconciliation

- **What**: A dimension-verified breadboard projection guides placement and wiring, then records continuity checks, measured values, photos, and discrepancies between the plan and the physical build.
- **Why**: Breadboard is one of the intended canonical projections but has no engine surface. PCEval reports that physical breadboard placement remains difficult for language models, so the workflow needs deterministic geometry and human-observed evidence, not generated confidence.
- **How**: Model board holes/rails/breaks and exact component lead spacing; derive legal placements from pin geometry; generate stepwise build groups; accept observed connections and measurements; attach photos to graph anchors; represent discrepancies as reviewable operations/evidence instead of silently changing the intended design.
- **Outside input**: [Fritzing project views](https://fritzing.org/learning/get-started/project-view), [PCEval](https://openreview.net/forum?id=biJqDcw6i9), [PCB ReTrace](https://hackaday.io/project/204738-pcb-retrace).
- **Personas served**: Hobbyist maker, professional engineer doing prototypes, startup bench teams.
- **Effort / stage**: XL / P1.
- **Acceptance signal**: A real reference circuit can be assembled from the generated steps, continuity observations reconcile to the graph, and any physical deviation remains visible and reversible.

### IN-11: Semantic Circuit Projection

- **What**: An intentional semantic projection exposes every component, net, pin, trace, finding, and change through a DOM tree, keyboard navigation, structured commands, and announced updates.
- **Why**: The engine renderer currently returns one bare canvas (`packages/app/src/editor/CanvasHost.tsx:524`). The canonical graph already has stable IDs, names, relationships, and coordinates, so semantic access can be generated from source truth rather than inferred from pixels.
- **How**: First land panel reflow, visible focus, real tab semantics, and a named focusable canvas region. Then derive a focus model and virtualized semantic tree from the canonical graph plus transient selection/tool state; navigate by component/net/sheet/finding; support select, inspect, move, connect, and review actions from the keyboard; mirror canvas selection; add a concise live operation stream. The first useful slice adds no stored graph vocabulary and no parallel accessibility document.
- **Outside input**: [MDN canvas guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage), [W3C keyboard guidance](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html), and PCB-QA's exploration of structured circuit representations: [PCB-QA](https://arxiv.org/abs/2606.23704).
- **Personas served**: All three, including users who cannot or prefer not to operate a visual canvas.
- **Effort / stage**: L / P1.
- **Acceptance signal**: A keyboard-only user can inspect and edit a small circuit, locate and fix a review finding, and understand the resulting change without relying on pointer input or canvas pixels; graph/canvas/semantic selection stay in sync; browser and packaged-Tauri keyboard/screen-reader sessions pass.

### IN-12: Local-First Rooms With Narrow Capabilities

- **What**: Collaboration keeps the local `.ppx` copy primary while adding room-scoped capability tokens, read/comment/edit roles, durable queues, resumable sync, and review exchange as files.
- **Why**: The relay correctly carries copies and can use a shared token, but one token spans all rooms, the service can run open, and aggregate rooms/branches/envelopes/bytes have no quota or idle eviction (`packages/relay/src/server.ts:47-53,159-164,225-233`; `packages/relay/src/main.ts:12-28`). Real sharing needs narrower authorization and bounded resources without making the service authoritative.
- **How**: Make bind host explicit and require auth outside loopback; issue signed room capabilities with role and expiry; bind operations to actor identity; isolate persisted room records; cap clients, rooms, branches, envelopes, total bytes, and storage; add backpressure and idle eviction; keep an IndexedDB/file queue; surface sync state and conflicts; preserve conflicting branches instead of overwriting; allow a review response file to merge without any live room.
- **Outside input**: [Local-first essay](https://www.inkandswitch.com/essay/local-first/), [Flux sharing permissions](https://docs.flux.ai/reference/reference-sharing-and-permissions), [jlceda-cocomment](https://github.com/ZZC43013/jlceda-cocomment) as raw file-exchange inspiration.
- **Personas served**: All three.
- **Effort / stage**: XL / P1.
- **Acceptance signal**: A comment-only invite cannot mutate the design or join another room; quota/backpressure/eviction and hostile-client tests pass; two offline editors resume and converge with surfaced, preserve-first conflict branches; both retain complete local copies when the relay disappears.

### IN-13: Causal Time Machine

- **What**: A synchronized debugger aligns graph history, firmware source/program counter/registers, interrupt and bus events, GPIO edges, analog waveforms, device-model state, and scenario assertions.
- **Why**: ProtoPulse has each evidence stream in some form, but users must mentally correlate them. The operation log and deterministic co-simulation make a shared time axis technically plausible.
- **How**: Add trace event schemas with deterministic timestamps/sequence IDs; map events to graph anchors and source symbols; support jump from failed assertion to analog sample to pin edge to firmware instruction; save the trace as a scenario artifact and diff it across branches.
- **Outside input**: Wokwi exposes debugging, logic traces, VCD, and scenarios as related tools: [debugger](https://docs.wokwi.com/guides/debugger), [CLI](https://docs.wokwi.com/wokwi-ci/cli-usage).
- **Personas served**: Professional electrical engineer, hardware startup founder, advanced hobbyist maker.
- **Effort / stage**: XL / P2.
- **Acceptance signal**: From one failed voltage assertion, a user can navigate to the controlling firmware instruction and exact graph entities, change the design or code, rerun, and diff the causal trace.

### IN-14: Forkable Verified Design Capsules

- **What**: Reusable sub-systems carry graph operations, schematic/PCB fragments, requirements, scenarios, review records, BOM alternatives, pack references, sources, license, and learning material as one versioned capsule.
- **Why**: Current part packs move individual parts, but repeated circuits need reusable evidence and behavior, not only copied geometry.
- **How**: Define a capsule manifest with dependency hashes and parameter schema; instantiate through typed operations with deterministic ID remapping; preserve canonical evidence IDs and upstream revision; keep scenario/model extensions inside the IN-06/IN-07 CSP-safe boundaries; run capsule tests after parameterization; make local folders and plain archives valid distribution channels before any registry. Unsupported/corrupt capsules enter IN-01 recovery and retain their original bytes.
- **Outside input**: [KiCad 10 design blocks](https://docs.kicad.org/10.0/en/kicad/kicad.html), [Flux project reuse](https://docs.flux.ai/flux/tutorials/reusing-community-projects), [atopile](https://github.com/atopile/atopile), [tscircuit](https://github.com/tscircuit/tscircuit), [Kitspace](https://kitspace.org/).
- **Personas served**: All three.
- **Effort / stage**: XL / P2.
- **Acceptance signal**: A verified sensor front-end can be forked, parameterized, instantiated into another design, and re-verified without losing its requirements, sources, review history, or license.

### IN-15: Photo-to-Graph Physical Reconciliation

- **What**: Overlay calibrated top/bottom board or breadboard photos, anchor components/traces/wires to graph entities, and record observed differences for repair, bring-up, and documentation.
- **Why**: The design graph currently describes intent. Physical work needs a disciplined way to record what was actually assembled and where it diverges.
- **How**: Store source images as hashed assets; calibrate scale and fiducials; align layers; let users confirm or reject computer-vision suggestions; convert accepted observations into evidence/discrepancy operations; keep observed state separate from intended state but cross-linked.
- **Outside input**: [PCB ReTrace](https://hackaday.io/project/204738-pcb-retrace) is a maker-project claim, not independent validation; it demonstrates a compelling workflow shape for photos, nets, and repair documentation.
- **Personas served**: Hobbyist maker, professional repair/bring-up work, startup manufacturing and field teams.
- **Effort / stage**: XL / P2.
- **Acceptance signal**: A reference board's two photos can be calibrated, anchored, and reconciled; every auto-suggestion requires confirmation; accepted discrepancies appear in review and can generate a corrective proposal branch.

### IN-16: Editable KiCad Bridge and Open Embed

- **What**: Version-pinned KiCad schematic and board import/export with loss accounting, golden round-trip fixtures, and a read-only embeddable viewer from the same graph.
- **Why**: Current engine export includes a connectivity netlist, which is not an editable native project bridge (`packages/README.md:43,53`). An open escape path protects user ownership and allows ProtoPulse evidence workflows to coexist with established tools.
- **How**: Implement one KiCad file version at a time; parse into typed operations; preserve unsupported records as assets/opaque extensions under explicit policy; export deterministically; compare semantic graph and native-file round trips; expose the renderer as an embed package with stable selection anchors.
- **Outside input**: [KiCad 10 file documentation](https://docs.kicad.org/10.0/en/kicad/kicad.html), [KiCanvas](https://github.com/theacodes/kicanvas), [circuit-synth](https://github.com/circuit-synth/circuit-synth).
- **Personas served**: Professional electrical engineer, startup team, makers collaborating with KiCad users.
- **Effort / stage**: XL / P2.
- **Acceptance signal**: A defined KiCad fixture imports, edits, exports, and reimports with an explicit zero-loss or enumerated-loss report; the embedded view cross-probes stable graph anchors.

### IN-17: Living Evidence Garden on the Existing Knowledge Pipeline

- **What**: Extend the existing Ars Contexta and PP-NLM flow so every outside ingredient—official docs, repositories of any age, papers, maker projects, forum posts, and original social posts—can become durable, discoverable evidence with status, exact learned idea, source date, license, applicability, and recheck state.
- **Why**: Tyler explicitly wants the whole outside world used for knowledge and creativity without turning it into a contest. ProtoPulse already has the correct ownership model: raw material enters `inbox/`, `/extract` produces canonical `knowledge/`, PP-NLM exposes versioned `pp-core`/`pp-hardware` synthesis, and Studio output returns through `inbox/` before re-publication (`AGENTS.md:153-182,193-202`). Creating a separate source-card database would add a third truth system.
- **How**: Capture raw sources in `inbox/` with provenance; run `/extract` so titles, descriptions, MOC links, and atomic claims live in canonical knowledge; publish versioned sources through the existing PP-NLM bridge and manifest tracking; route Studio artifacts back to `inbox/`. Graph, part, deck, review, proposal, ADR, and release records store only resolvable evidence IDs plus revision/hash, applicability, verification class, and recheck state. Use the existing labels `verified documentation`, `upstream claim`, `research result`, `community signal`, `raw inspiration`, and `hypothesis`; preserve discarded ideas with reasons in the canonical flow.
- **Outside input**: This method is demonstrated by the deliberately mixed source set in Phase 2, from [KiCad documentation](https://docs.kicad.org/10.0/en/kicad/kicad.html) to the July 17 [jlceda-cocomment](https://github.com/ZZC43013/jlceda-cocomment) idea card.
- **Personas served**: Primarily maintainers and contributors; product users benefit through fresher facts and visible evidence.
- **Effort / stage**: L / P2.
- **Acceptance signal**: Every external claim in a new part, deck, proposal, or ADR experiment resolves to canonical Ars evidence; PP-NLM sources are versioned/manifest-tracked and Studio material demonstrably returns through `inbox/`; product records contain no copied shadow corpus; stale sources produce a visible recheck task; raw inspiration can never be displayed as verified capability.

### IN-18: Reproducible Open-Hardware Release Capsule

- **What**: One signed artifact captures the exact design, operation head, part/device packs, rule/review decks, scenarios, model fidelity, sources, licenses, BOM, fabrication outputs, hashes, reviewer decisions, and external-process status.
- **Why**: ProtoPulse already emits deterministic manufacturing files and has sourcing/review structures. The missing step is a release unit that another person can inspect and regenerate without reconstructing context.
- **How**: Add a release manifest and deterministic build command; embed or reference immutable revisions and canonical Ars evidence IDs; run checks/scenarios under policy-equivalent execution; generate source/license inventory and OSHWA-readiness checklist; preserve quote/order/certification as explicit pending/completed external records rather than implied actions. Desktop generation is claimed only after current audit evidence and independent packaged smoke, not merely after packaging succeeds.
- **Outside input**: [OSHWA certification process](https://certification.oshwa.org/process.html), [Kitspace](https://kitspace.org/), [KiCad job/archive documentation](https://docs.kicad.org/10.0/en/kicad/kicad.html).
- **Personas served**: All three.
- **Effort / stage**: L / P2.
- **Acceptance signal**: A clean environment regenerates byte-identical contract outputs from the capsule; source/license gaps fail clearly; no external certification, quote, or order is marked complete without returned evidence.

### IN-19: Real-Project Migration Proving Ground

- **What**: Treat Tyler's representative legacy projects as a public-to-the-project proving corpus for engine coherence, not as a one-time import chore.
- **Why**: The importer exists, but real-project migration, default-UI transition, grace period, and area retirement remain open (`ROADMAP.md:2126-2139`). Architecture, breadboard, persistence, and editable interchange claims need real data before the new editor becomes canonical.
- **How**: Select representative project types; preserve original snapshots; import and materialize; compare connectivity, placement, architecture, breadboard intent, parts, exports, and review results; exercise browser and packaged-Tauri recovery plus production-CSP paths; record every skip/loss; turn failures into fixtures; repeat until the agreed parity envelope is met.
- **Outside input**: Native round-trip discipline from KiCad/circuit-synth and local-first ownership principles inform the evidence packet: [KiCad 10 docs](https://docs.kicad.org/10.0/en/kicad/kicad.html), [circuit-synth](https://github.com/circuit-synth/circuit-synth), [local-first essay](https://www.inkandswitch.com/essay/local-first/).
- **Personas served**: Tyler first, then every persona whose projects must survive product evolution.
- **Effort / stage**: XL / P2.
- **Acceptance signal**: Each selected project has a signed before/after report with no unexplained loss; discovered edge cases are frozen as fixtures; the canonical-UI decision cites this evidence rather than schedule pressure.

### IN-20: ADR-0017 Physical-System Hypothesis Ladder

- **What**: A staged evidence program tests whether the same person benefits from electronics, firmware, enclosure, and kinematic context in one operation-graph workflow. It does not declare those domains shipped.
- **Why**: ADR-0017 is still **Proposed** and explicitly names the same-user assumption as unproven (`docs/adr/0017-physical-system-design-graph.md:1-6,117-150`). Its schema prerequisites are also confirmed in live source.
- **How**:
  1. Complete IN-01 before adding non-electrical graph vocabulary.
  2. Run three to five real firmware co-design workflows using existing emulator/co-sim assets. Measure context switching, errors found, evidence reuse, and whether users want one-file continuity.
  3. If supported, run a bounded enclosure experiment behind a CadQuery or JSCAD process boundary. Quantize only boundary geometry into integer nanometers; keep the foreign kernel and floats out of the graph core.
  4. If supported again, map a tiny URDF link/joint assembly to typed experimental records and test whether electronics/firmware evidence remains useful in that view.
  5. At every stage, decide `ship`, `reshape`, or `shelf`; route experiment material and negative results through IN-17's existing Ars Contexta and PP-NLM path, then reference the canonical evidence IDs from the decision record.
- **Outside input**: [CadQuery](https://cadquery.readthedocs.io/en/stable/), [JSCAD](https://jscad.app/), [ROS URDF](https://docs.ros.org/en/jazzy/p/urdf_tutorial/).
- **Personas served**: Advanced maker, professional engineer, hardware startup founder—only if the observed workflow supports the assumption.
- **Effort / stage**: L for the experiments, excluding any later shipped domain / P3.
- **Acceptance signal**: Each stage has named users/tasks, recorded measures, canonical evidence references, and a decision. Any accepted ADR revision describes firmware in terms of reusable emulator capability and learning yield, and no user-facing scope claim appears before a daily-usable workflow exists.

## Long-Horizon Experiments

These are not unbounded promises. They are the P2/P3 proposals whose value comes from testing a difficult workflow with existing primitives.

| Proposal | Experiment question | Required stop condition |
|---|---|---|
| IN-13 Causal Time Machine | Does aligning firmware, buses, analog state, and design history materially shorten diagnosis on real failures? | Stop or reshape if users cannot trace a failure faster than with separate logs/waveforms. |
| IN-15 Photo-to-Graph Reconciliation | Can a user reliably record observed hardware without confusing observation with design intent? | Stop automation if suggestions create more correction work than manual anchoring; keep manual evidence capture if useful. |
| IN-20 Physical-System Hypothesis Ladder | Does one person genuinely benefit from continuous electronics/firmware/enclosure/kinematics context? | Shelf the next stage when the same-user assumption or one-engine representation fails. |

## Existing Infrastructure That Makes These Plausible

| Existing component | Enables | Evidence |
|---|---|---|
| `@protopulse/graph` operations, branches, diff, merge, replay | IN-01, IN-02, IN-04, IN-05, IN-13, IN-14, IN-20 | `packages/README.md:11-16,40` |
| Deterministic exports and golden contracts | IN-05, IN-06, IN-16, IN-18, IN-19 | `packages/README.md:43,57-72` |
| `@protopulse/review` reports, deltas, decks, executable fixes | IN-02, IN-04, IN-05, IN-18 | `packages/review/src/report.ts:5-31`; `packages/review/src/diff.ts:3-26`; `packages/review/src/run.ts:335-361` |
| MCU emulation, simulation, and closed-loop co-simulation | IN-06, IN-07, IN-08, IN-13, IN-20 | `packages/README.md:46-49`; `ROADMAP.md:2025-2044` |
| Part packs and verified part schema | IN-07, IN-08, IN-14, IN-17, IN-18 | `packages/app/src/state/packs.ts:6-12,59-105`; `packages/parts/src/types.ts:92-118` |
| Share fragments and branch-aware relay | IN-05, IN-12 | `packages/app/src/state/share.ts:5-15,50-75`; `packages/relay/src/server.ts:15-24,159-203` |
| WebGL renderer, canonical graph, and transient UI state | IN-09, IN-10, IN-11, IN-15, IN-16 | `packages/README.md:3-16,51`; `packages/app/src/editor/CanvasHost.tsx:524` |
| Ars Contexta pipeline and PP-NLM bridge | IN-02, IN-04, IN-08, IN-14, IN-17, IN-18, IN-20 | `AGENTS.md:153-182,193-202` |
| Strong production CSP and Tauri packaging path | IN-03, IN-06, IN-07, IN-11, IN-14, IN-18, IN-19 | `server/index.ts:61-64`; `src-tauri/tauri.conf.json:23`; `.github/workflows/tauri-build.yml:141-177` |

## Constraint Crosswalk

| Constraint | Proposals gated | Required response |
|---|---|---|
| No `.ppx` migrations, asset implementation, or future-operation policy | IN-04 through IN-20 where stored vocabulary/assets grow | Complete IN-01 first. |
| Unreadable browser state can fall through to starter data | Every editor/import/sync proposal | Complete IN-01 recovery mode before widening persisted state; reuse preserve-first recovery for capsules, packs, relay conflicts, browser, and packaged Tauri. |
| Agent confirmation can be absent; Draftsman UI/tools incomplete | IN-02 and any agent-assisted proposal | Make mutation fail closed and complete ordinary edit verbs. |
| Browser-direct provider key | Provider-assisted paths | Complete IN-03 or keep those paths explicitly local/manual. |
| Only schematic/PCB engine projections exist | IN-09, IN-10, IN-11, IN-15, IN-19 | Add architecture and breadboard as graph projections; derive accessibility from the graph plus transient UI state; create no independent persisted projection models before canonical migration. |
| Relay authorization is global-token/open and aggregate state is unbounded | IN-05 and IN-12 for real sharing | Add explicit bind policy, non-loopback auth, room roles, quotas, backpressure, eviction, storage limits, and resource tests before non-local deployment. |
| Current custom DRC/DSL code conflicts with production CSP | IN-02, IN-06, IN-07, IN-14 | Use data schemas plus a constrained interpreter/AST evaluator or isolated process; never weaken CSP; prove browser and packaged-Tauri policy behavior. |
| Tauri platform packages complete but release evidence fails later and packaged smoke is skipped | IN-01, IN-03, IN-06, IN-07, IN-11, IN-18, IN-19 | Say package success, not desktop readiness. Require current audit state and independently executed packaged smoke for every desktop claim. |
| Accessibility has no engine semantic surface today | IN-09, IN-10, IN-11, IN-19 | Treat semantics as a graph/UI-state projection; stage reflow/focus/tab fixes first; add no parallel persisted accessibility model. |
| Ars Contexta and PP-NLM already own repository knowledge | IN-02, IN-04, IN-08, IN-14, IN-17, IN-18, IN-20 | Raw sources go through `inbox/` and `/extract`; PP-NLM mirrors/synthesizes through its bridge; product records store resolvable evidence references only. |
| ADR-0017 has not been accepted | IN-20 | Treat every stage as a test, not product scope; no graph broadening before its gates. |

## Finding-to-Proposal Coverage

| Phase 2 finding | Addressed by |
|---|---|
| FG-01, FG-02 | IN-01 |
| FG-03 | IN-02 |
| FG-04 | IN-03 |
| FG-05 | IN-04 |
| FG-06 | IN-05 |
| FG-07 | IN-06 |
| FG-08 | IN-13 |
| FG-09 | IN-07 |
| FG-10 | IN-08 |
| FG-11 | IN-14 |
| FG-12 | IN-09 |
| FG-13 | IN-10, IN-15 |
| FG-14 | IN-16 |
| FG-15 | IN-11 |
| FG-16 | IN-12 |
| FG-17 | IN-17 |
| FG-18 | IN-19 |
| FG-19 | IN-20 |
| FG-20 | IN-18 |

## Research Links

All outside links were accessed 2026-07-18. Capability claims come from official or upstream sources unless labeled research, community signal, maker-project claim, or raw inspiration.

### Official Documentation

- [KiCad 10 documentation](https://docs.kicad.org/10.0/en/kicad/kicad.html)
- [Wokwi CLI](https://docs.wokwi.com/wokwi-ci/cli-usage)
- [Wokwi CI](https://docs.wokwi.com/wokwi-ci/getting-started)
- [Wokwi custom chips](https://docs.wokwi.com/chips-api/getting-started)
- [Wokwi debugger](https://docs.wokwi.com/guides/debugger)
- [Flux AI assistant](https://www.flux.ai/copilot)
- [Flux project reuse](https://docs.flux.ai/flux/tutorials/reusing-community-projects)
- [Flux sharing permissions](https://docs.flux.ai/reference/reference-sharing-and-permissions)
- [Fritzing project views](https://fritzing.org/learning/get-started/project-view)
- [Fritzing part creator](https://fritzing.org/learning/get-started/part-creator/)
- [Altium 365 design reviews](https://www.altium.com/documentation/altium-365/project-design-reviews?version=22)
- [Altium 365 requirements](https://www.altium.com/documentation/altium-365/requirements-portal?version=7.0)
- [AllSpice](https://www.allspice.io/)
- [OSHWA certification process](https://certification.oshwa.org/process.html)
- [Kitspace](https://kitspace.org/)
- [MDN canvas guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage)
- [W3C keyboard guidance](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [CadQuery](https://cadquery.readthedocs.io/en/stable/)
- [JSCAD](https://jscad.app/)
- [ROS URDF tutorial](https://docs.ros.org/en/jazzy/p/urdf_tutorial/)

### Upstream Repositories

- [atopile](https://github.com/atopile/atopile)
- [tscircuit](https://github.com/tscircuit/tscircuit)
- [circuit-synth](https://github.com/circuit-synth/circuit-synth)
- [KiCanvas](https://github.com/theacodes/kicanvas)
- [jlceda-cocomment](https://github.com/ZZC43013/jlceda-cocomment) — raw inspiration, created 2026-07-17

### Research and Design Essays

- [CircuitLM](https://arxiv.org/abs/2601.04505)
- [PCBSchemaGen](https://arxiv.org/abs/2602.00510)
- [HWE-Bench](https://arxiv.org/abs/2603.18102)
- [PCB-QA](https://arxiv.org/abs/2606.23704)
- [PCEval](https://openreview.net/forum?id=biJqDcw6i9)
- [Local-first software](https://www.inkandswitch.com/essay/local-first/)

### Maker and Community Signals

- [PCB ReTrace](https://hackaday.io/project/204738-pcb-retrace) — maker-project claim
- [KiCad community design-review discussion](https://forum.kicad.info/t/crowdsource-design-reviews/67923) — community signal
- [KiCad Prism discussion](https://forum.kicad.info/t/kicad-prism-a-self-hosted-web-based-platform-for-design-reviews-visualization/66518) — community signal
