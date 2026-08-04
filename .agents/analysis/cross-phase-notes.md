# ProtoPulse Cross-Phase Working Notes

> Lead evidence captured before the phase merge. These notes are additive; phase findings still need a full cross-check and one refinement pass.

## Language and Method Guardrails

- Phase 2 is the **Outside Inspiration & Knowledge Landscape**. Other products, repositories, papers, maker projects, forum posts, and original social posts are sources of knowledge and creative ingredients, not opponents.
- P0–P3 expresses dependency/build order only. It never means a finding may be ignored.
- All findings get addressed. A synthesis may merge true duplicates, but it must preserve every distinct problem, possibility, and required next action.
- Separate shipped, in-progress, proposed, and historical claims. Do not turn a proposed ADR or a stale generated map into current product truth.

## Re-entry Truth

1. ProtoPulse is one repository containing two product layers: the large shipping legacy React/Express/Postgres application and the newer 16-package graph/op-log engine plus editor.
2. Engine roadmap v0.1 through v0.4 are marked shipped. v0.5 and v0.6 have substantial foundations in place, but the hardware long tail, real-device flashing, registry/sharing, board packs, and quote/ordering work remain open (`ROADMAP.md:2045-2111`).
3. Legacy retirement has not begun. The importer exists, but Tyler's real projects have not been run through it; default-UI flip, read-only grace, and area-by-area retirement remain open (`ROADMAP.md:2113-2142`).
4. The last product changes on 2026-07-10 completed fab-layer export and through-hole drill/annular-ring DRC, then opened BL-1094. The current backlog reports 282 open and 607 done (`docs/MASTER_BACKLOG.md:428-436`).
5. ADR-0017 is **Proposed**, not accepted product scope. Its physical-system graph reframe is a hypothesis with pending schema-evolution gates and a still-unvalidated same-user assumption (`docs/adr/0017-physical-system-design-graph.md:1-6,117-150`).

## Verified Architecture Seam

- `.ppx` writes format version 1 but accepts any positive version and performs no version dispatch or migration (`packages/graph/src/store/serialize.ts:95-129`).
- The current op vocabulary is a closed union of 35 named schemas plus `batch`; unknown ops hard-fail during line parsing (`packages/graph/src/ops.ts:312-360`, `packages/graph/src/store/serialize.ts:20-26`).
- The directory writer creates an empty `assets/` folder, but the graph package has no asset read/write/reference implementation (`packages/graph/src/store/fs-store.ts:79-112`).
- In the new editor, an unreadable saved bundle becomes an empty starter fixture (`packages/app/src/state/persistence.ts:53-62`, `packages/app/src/main.tsx:24-25`). A `beforeunload` handler always flushes the active starter bundle (`packages/app/src/main.tsx:48-53`), so an unsupported/corrupt saved value can be replaced without a recovery UI. This is tracked by BL-0938, BL-1056, BL-1057, BL-1058, and BL-1092; the live op count in BL-1057 is stale.
- Treat asset storage, versioned migration, explicit unknown-op preservation/quarantine, frozen cross-version fixtures, and non-destructive recovery UI as one dependency-ordered compatibility group.

## Documentation Drift Already Verified

- `.ref/project-dna.md` was generated 2026-06-28; product and backlog changes landed through 2026-07-10. Its structure remains useful, but its counts are a snapshot.
- The February/March product report describes a much smaller repository and its 166-item checklist was fully completed by 2026-03-07. It is historical input, not a current map.
- `docs/CHANGELOG.md` stops before the July 10 fab/DRC landings.
- `ROADMAP.md:2149-2153` describes an older Tauri failure state. Current GitHub evidence shows the latest Tauri matrix instead fails at `cargo audit` with two blocking advisories and 23 allowed warnings; main CI and Packages CI pass on the same commit.
- `docs/MASTER_BACKLOG.md` Quick Stats are current, while some narrative/planning sections and embedded source counts are not. The synthesized report should cite the exact current row/evidence, not repeat whole planning prose.

## Initial Impact Chains

1. Two live product layers → duplicated capability and truth surfaces → users and maintainers cannot tell which experience is canonical → migration remains the central coherence problem.
2. Closed op schema + no migration/unknown-op policy → a normal vocabulary change can make saved designs unreadable → current fail-open boot can expose users to silent local-data replacement → schema evolution and recovery must precede any graph broadening.
3. Large local backlog + empty GitHub issue/PR queues → public repository state looks quiet while canonical work is dense → outside contributors and a returning Tyler cannot discover the real next action without local docs.
4. Stale maps + extremely detailed roadmap prose → lots of information but low re-entry clarity → a compact current snapshot and dependency-ordered checklist are part of product operations, not cosmetic documentation.
5. Engine foundations for graph history, simulation, emulation, review, collaboration, and fab output → many possible integrations are already cheap enough to explore → innovation should compose existing primitives before creating another subsystem.

## Phase 1/2/3/5 Connections to Test in Refinement

### Truthfulness is one cross-cutting product seam

Sample cards, project templates, radial actions, milestone progress, Settings, Draftsman, community publication, device flashing, and order/quote surfaces each present more completion than their handler or integration currently provides. These are separate implementation defects, but they share one product rule: every surface needs a machine-readable capability state (`available`, `local-only`, `emulated`, `preview`, `blocked`, `live`) derived from the real integration rather than copy. That rule can be reused by onboarding, navigation, settings, AI, hardware, community, and manufacturing without merging away their separate checklist actions.

### Real-project migration is the evidence hub

The importer is not merely a legacy-retirement task. Running representative real projects through it can simultaneously test:

- `.ppx` durability and recovery;
- architecture and breadboard projection parity;
- part mapping and evidence loss;
- editable interchange and export truth;
- performance on non-fixture graphs;
- whether the new editor is actually a coherent daily surface.

Phase 5's migration proving corpus should therefore produce fixtures and evidence consumed by the format, UX, projection, and release work—not become a one-time pass/fail checkbox.

### Accessibility can remain a projection

The semantic circuit mode should materialize from the canonical graph and current selection/tool state. It does not require a parallel accessibility document model or new stored graph vocabulary for its first useful slice. Engine focus-visible styles, actual tab semantics, scalable panel navigation, and a focusable named canvas region can land first; component/net/finding navigation and equivalent edits then grow on the same projection.

### Evidence garden must not become a third knowledge system

ProtoPulse already has a repository knowledge pipeline (`inbox/` → extraction → `knowledge/`) and source-backed hardware rules. Phase 5 IN-17 is valuable only if product-facing source cards reference or materialize the same evidence, not if they create another disconnected source database beside Ars Contexta and graph/part provenance. Refinement must name the ownership boundary: repository research knowledge remains canonical; graph/pack/deck records carry durable source identifiers, revisions, hashes, applicability, and verification state needed to reproduce a product claim.

### Legacy truth fixes and migration need one disposition rule

The sample, template, role-navigation, radial-action, and milestone defects are real today and cannot be ignored because legacy retirement is planned. Their completion may be either:

1. implement the promised behavior in legacy and freeze a parity fixture for the engine; or
2. remove/label the false promise immediately, then implement the equivalent only in the engine before the default flip.

The checklist must preserve each outcome and its verification rather than mandate large legacy investment regardless of migration sequence.

### Collaboration features inherit authorization and recovery requirements

Portable review capsules, comments, offline queues, and proposal branches depend on narrow room/user capabilities, local recovery, actor identity, and non-destructive conflict handling. They should be bundled with relay authorization and `.ppx` compatibility work instead of added on top of a global-token/open room model.

### Proof-carrying AI is a composition, not a new authority

The agent path should reuse branches, exact operations, existing checks, simulations, review reports, source evidence, and explicit merge. The private provider gateway is optional infrastructure for provider custody; it must never become the design authority or a prerequisite for manual/local workflows.

## Merge Questions for the Refinement Pass

- Which feature/UX findings are consequences of the dual-product split rather than isolated missing controls?
- Which outside ideas map directly onto already-shipped primitives, and which require schema or migration foundations first?
- Which July 1 backlog items have stale evidence because July 10 work partially or fully landed?
- Which risks are visible only in static code and still need a live browser/hardware/manual verification label?
- Does every distinct phase finding appear in the final checklist or an explicit “already tracked by BL-…” bridge?

## Phase 4 Connections

### Security and product truth are coupled

- DRC scripts and the circuit DSL use `Function`, while both web and Tauri production CSP forbid string-to-code execution. This is simultaneously a security boundary and a user-facing truth gap: a feature can look present in development yet fail under the delivered policy. Keep CSP strong; replace the execution model and add production-policy browser/desktop tests.
- Arduino endpoints accept request-derived sketch/FQBN/artifact values while two paths still assemble shell strings. The rest of the service already demonstrates path resolution and argument-array process spawning. Closing those exceptions is a bounded boundary repair, not an Arduino rewrite.
- The relay's optional global token/open default and unbounded aggregate room/log state block the real sharing patterns proposed by review capsules and local-first rooms. Authorization, quotas, eviction, storage limits, and resource tests belong in the same collaboration foundation.

### High test volume does not prove the missing workflows

Current CI reports 31,247 passing tests and strong graph-package gates, yet no required Playwright lane exercises the user journeys that Phase 3 found misleading. Database migration parity and one closed-loop co-sim suite are conditional, packaged smoke is downstream of a fail-fast audit step, and production CSP behavior is not exercised. The next test work should connect existing unit depth to these system seams rather than merely add more isolated cases.

### Complexity and change frequency collide in the emulator

The ESP32-S3 source/test files are simultaneously the largest TypeScript pair and the highest 90-day change-frequency pair. That makes decomposition an ownership and recovery task, not style cleanup. Preserve deterministic vectors while extracting crypto, instruction, and peripheral boundaries; use the partitions as a map a returning maintainer can understand.

### Tauri is packaged but not release-ready

All five platform packaging jobs complete on the current commit. The workflow goes red later on two `quick-xml` advisories; the fail-fast supply-chain script then hides npm/SBOM results and leaves packaged smoke skipped. The final report must say **packaging succeeds; release evidence fails**, not “Tauri cannot build.” The required bundle is dependency remediation, aggregate audit reporting, independent packaged smoke, and one release-readiness artifact.

### Warning visibility affects the UX findings

Both main workflows use ESLint `--quiet`, hiding warnings for console use, non-null assertions, accessibility, hooks, and other rules. Phase 3's engine focus/tab/canvas gaps therefore coexist with an automated warning channel that is deliberately invisible. A non-increasing warning baseline and changed-file ratchet should make the UX/accessibility work observable without demanding a one-shot cleanup.

## Cross-Phase Bundles for Final Synthesis

Merging duplicate wording is allowed only through these explicit coverage bundles. Each source finding must map to the resulting final action(s).

| Bundle | Phase coverage | Required complete outcome |
|---|---|---|
| Evolution-safe design data | EN-01/02, FG-01/02, UI-17, TD-07/08/09/10, IN-01 | Version dispatch/migrations, future-op policy, assets, frozen fixtures, retained raw payload, blocked autosave, explicit recovery/reset. |
| Canonical product transition | EN-08, FG-18, UI-06, TD-26, IN-19 | Real-project corpus, explained loss/parity evidence, architecture+breadboard coverage, default flip, read-only grace, deliberate retirement. |
| Proof-carrying crew | EN-07, FG-03/04, UI-11, IN-02/03 | Complete edit verbs, mandatory mutation approval, proposal branches, checks/evidence, real panel wiring, private/self-hostable provider boundary. |
| Honest onboarding and navigation | EN-04/05/06, UI-01/02/03/04/05/13/14/15/16 | Every sample/template promise persists, every view has an explicit reachability decision, fake actions/progress removed, entry/bootstrap corrected, capability states visible. |
| Engine interaction model | FG-15, UI-07/08/09/10, IN-11, TD-13/20 | Reflowing panels, scalable semantic tabs, focus-visible controls, graph-derived semantic circuit projection, characterization and live keyboard/AT tests. |
| Review and local-first collaboration | FG-05/06/16, IN-04/05/12, TD-11 | Intent/requirements, portable review state, stable anchors, room-scoped roles, quotas, offline queues, non-service file exchange. |
| Behavior and causal proof | FG-07/08/09, IN-06/07/13 | Scenario CLI, device-model workshop, deterministic artifacts/fidelity, aligned firmware/bus/GPIO/analog/operation trace. |
| Living hardware packages and releases | FG-10/11/17/20, IN-08/14/17/18, TD-23 | Cross-projection packs, reusable verified capsules, source-card boundary tied to canonical research evidence, signed reproducible releases. |
| Editable/open escape paths | FG-14, IN-16 | Version-pinned KiCad round trips, explicit loss reports, opaque preservation policy, open embed with stable anchors. |
| Security/release boundary | TD-01/02/03/04/05/06/12/15, EN-03/05 | Safe process arguments/paths, resolved advisories, aggregate audit/SBOM evidence, CSP-safe custom logic, sanitized DOM construction, independent packaged smoke, regression corpus. |
| Recoverable code boundaries | TD-16 through TD-25, EN-01/02/04 | Visible warnings, typed boundary cleanup, structured logs, TODO dispositions, complete hotspot partitioning, critical-path coverage, truthful hooks, measured bundles/dependencies. |
| Physical-system hypothesis | EN-09, FG-19, IN-20 | ADR remains Proposed; after compatibility safety, run measured firmware then bounded enclosure/URDF experiments with ship/reshape/shelf decisions and preserved negative evidence. |

## Risk Heatmap

| Surface | Complexity | Change frequency | User exposure | Cross-phase response |
|---|---|---|---|---|
| Legacy breadboard canvas | Very high reported closure | Active legacy surface | Direct maker workflow | Characterize, split controller/hooks/renderers, preserve keyboard/selection/undo, then use behavior as engine breadboard parity evidence. |
| Engine `CanvasHost` | Very high reported closure | Active engine foundation | Direct canonical-editor candidate | Split interaction/state/rendering seams while building focus/semantic projection and Playwright coverage. |
| Legacy PCB + simulation solvers | High | Mature but broad | Design correctness and perceived performance | Stable typed solver interfaces, golden vectors, stateful UI decomposition, route/bundle budgets. |
| ESP32-S3 emulator + test | High algorithms and extreme file size | Highest measured | Firmware/co-sim and proposed vertical evidence | Partition by domain with deterministic fixtures before more breadth. |
| `.ppx` store/persistence | Moderate code size, high semantic load | Foundational | All engine designs | Treat compatibility/recovery bundle as first dependency gate. |
| Arduino process boundary | Localized | Shipping legacy path | Host process/files and hardware users | Schema, owned-path resolution, argument arrays, adversarial ownership/injection tests. |
| Relay | Moderate | v0.6 foundation | Collaboration/network resources | Narrow auth/roles, quotas/eviction/backpressure, offline/file modes. |
| Tauri supply chain | Dependency-driven | Repeated red runs | Desktop releases | Fix blockers/warnings, aggregate audit evidence, independent package smoke. |

## Refinement Requests

1. Inventory/UX: reconcile legacy truth fixes with the migration disposition rule; ensure the final UX actions do not require wasteful legacy build-out when an honest disable plus engine implementation can satisfy the finding.
2. Outside/innovation: bind the evidence-garden proposal to the existing repository research pipeline; ensure accessibility starts as a graph projection; keep all outside evidence labels and ADR hypothesis gates.
3. Technical: replace generic `churn` wording with `change frequency`; reconcile test/source counts and rolling git counts; review Phase 4 against the cross-phase bundles so security/CI findings connect to the UX and innovation consequences without dropping any item.

## Refinement Results

- Inventory and UX now include explicit `implement now`, `disable/relabel now`, and `engine parity or deliberate retirement` dispositions for each incomplete legacy promise. The engine target is one capability/projection registry, not copied legacy view lists.
- Accessibility now starts as a projection of the canonical graph plus transient selection/tool/status state. Reflow, focus, tab semantics, and a named canvas can land before new stored vocabulary; durable additions remain behind the `.ppx` compatibility gate.
- Outside research and innovation now bind the living evidence garden to the existing `inbox/` -> `/extract` -> `knowledge/` pipeline and manifest-tracked PP-NLM bridge. Product schemas keep resolvable evidence identifiers, revisions, hashes, applicability, and recheck state rather than a shadow corpus.
- Technical findings now distinguish Phase 0's canonical all-product count from Phase 4's TS/TSX-only denominator, explain the one-file test-classifier difference, and label rolling git counts as moving time-window snapshots.
- Technical consequences are now connected directly to capability truth, migration, recovery, collaboration, accessibility, scenario/device-model work, and release capsules. All original phase checklist rows remain.

## Final Synthesis Directives

1. Replace the February/March report and completed 166-item checklist as historical snapshots; git preserves them. State that the old checklist reached 166/166 on 2026-03-07 and that the current analysis is a new baseline, not a reopening of those rows.
2. Preserve all current source findings: 20 FG, 17 UI, 28 TD, 23 EN (18 inventory plus 5 technical), and 20 IN. Renumber the five Phase 4 enhancement rows after the Phase 1 enhancement rows so final IDs are unique.
3. Cross-category overlap remains intentional evidence from different lenses. Use the twelve bundles above to plan combined implementation, but do not delete source findings. Include a source-coverage ledger mapping every original phase ID to its final checklist ID and bundle.
4. Use `P0` through `P3` only as dependency/build stages. Every row is required; a P3 experiment is complete when it records a supported `ship`, `reshape`, or `shelf` decision.
5. Name Phase 2 **Outside Inspiration & Knowledge Landscape**. Avoid opponent, race, market-ranking, moat, and generic `churn` language throughout both final documents.
6. Keep actual raw `scc`, `tokei`, `lizard`, security, dependency, CI, artifact, and git evidence in the appendices. Summaries must preserve method limits and must not turn complexity or file counts into bug/quality scores.
