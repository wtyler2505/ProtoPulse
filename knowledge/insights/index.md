---
summary: Entry point to the ProtoPulse knowledge system — start here to navigate
type: moc
---

# index

Welcome to the ProtoPulse knowledge system. Every architectural decision, bug pattern, implementation detail, and gotcha about this codebase lives here.

## Knowledge Areas

- [[architecture]] — Design decisions, trade-offs, system structure
- [[testing-patterns]] — Test strategies, mock patterns, coverage approaches
- [[bug-patterns]] — Recurring bugs, root causes, fix patterns
- [[conventions]] — Code style, naming, project-specific patterns
- [[dependencies]] — Library gotchas, version constraints, integration patterns
- [[gotchas]] — Non-obvious behaviors, traps, things that will bite you
- [[simulation]] — SPICE, circuit solver, Monte Carlo, transient analysis
- [[pcb-layout]] — Footprints, routing, DRC, copper pour, 3D viewer
- [[ai-system]] — AI tools, prompts, streaming, multi-model routing
- [[export-system]] — KiCad, Eagle, Gerber, SPICE, PDF, FMEA exporters
- [[agent-workflows]] — Claude Code agent teams, parallel execution, session management
- [[security]] — Authorization patterns, IDOR prevention, access control design
- [[collaboration]] — Real-time editing, membership, branching, access control
- [[backlog-methodology]] — Planning views, health monitoring, complexity ratings

## Recent Insights

- [[pure-local-desktop-app-chosen-over-hybrid-because-installation-friction-is-better-than-compromised-hardware-access]] — pure-local desktop app chosen over hybrid: installation friction is one-time, compromised hardware access is permanent
- [[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — emerged across 30+ managers as the standard client state pattern
- [[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — monolithic Context that proves why singleton+subscribe is better
- [[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — recurring security pattern across 3 audit waves
- [[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — IDOR gaps recur because no CI gate checks new routes for ownership middleware
- [[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — isolated library modules cause broken workflows until wiring waves
- [[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — integration forces deferred data ownership questions
- [[complexity-ratings-measure-decision-surface-area-not-effort]] — C1-C5 measures entangled systems, not hours
- [[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — TinkerCAD feels more powerful because results are visible on the circuit
- [[five-architecture-decisions-block-over-30-downstream-features-each]] — 5 architecture blockers: 4 resolved (desktop pivot, collaboration, supplier APIs), hardware debug remains
- [[soft-deletes-create-a-persistent-querying-tax-where-forgetting-isNull-causes-data-ghosts]] — forgetting isNull(deletedAt) causes silent ghost data
- [[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — vertical slices ship fast but defer horizontal integration
- [[definition-of-done-must-include-cross-tool-link-verification]] — features aren't done until cross-tool links are checked
- [[epic-decomposition-is-required-when-a-single-backlog-row-cannot-communicate-scope]] — decompose when one row can't convey scope to another engineer
- [[the-backlog-health-dashboard-surfaces-systemic-risks-before-they-become-technical-debt]] — meta-operational monitoring prevents backlog governance decay
- [[browser-based-eda-hits-a-platform-boundary-at-firmware-execution]] — firmware compilation forces hybrid architecture decision
- [[manufacturing-trust-requires-real-data-because-fake-confidence-is-worse-than-no-confidence]] — demo data that looks real undermines trust
- [[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — accessibility and power are in genuine conflict

### Extracted 2026-03-13

- [[agent-team-teammates-die-on-context-compaction-so-parallel-work-requires-liveness-checks-after-session-continuation]] — teammates are killed on context compaction, requiring liveness checks
- [[proxy-based-mock-chains-intercept-then-causing-await-to-hang-so-drizzle-query-mocks-need-explicit-select-chain-stubs]] — Proxy .then interception causes await hangs in Drizzle mocks
- [[vitest-4-changed-vi-fn-generic-signature-from-two-type-params-to-one-function-type-param-breaking-typed-mock-factories]] — Vitest 4 breaking change to vi.fn() generics
- [[drizzle-orm-0-45-is-blocked-by-zod-v4-dependency-so-the-orm-must-be-pinned-until-full-zod-migration]] — drizzle-orm 0.45+ blocked by Zod v4 requirement
- [[express-5-req-params-returns-string-or-string-array-so-every-route-param-access-needs-string-wrapping]] — Express 5 params typing requires String() wrapping
- [[typescript-exhaustive-switch-on-discriminated-unions-fails-at-default-because-shared-base-properties-are-inaccessible-after-narrowing-to-never]] — exhaustive switch narrows default to never, hiding base properties
- [[barrel-files-enable-incremental-decomposition-because-they-preserve-the-public-api-while-splitting-internal-modules]] — barrel files preserve public API during decomposition
- [[large-component-decomposition-follows-a-consistent-pattern-of-extracting-domain-modules-while-keeping-the-original-file-as-a-thin-orchestrator]] — decomposition pattern: extract modules, keep thin orchestrator
- [[concurrent-tsc-runs-during-agent-teams-cause-oom-so-node-max-old-space-size-must-be-increased-when-four-or-more-teammates-compile-simultaneously]] — 4+ concurrent tsc runs cause OOM without increased heap
- [[auto-loaded-claude-md-files-in-subdirectories-consume-context-window-causing-premature-session-compaction]] — subdirectory CLAUDE.md files are a permanent context tax
- [[backlog-summary-statistics-must-be-updated-atomically-with-individual-item-status-changes-or-the-single-source-of-truth-becomes-untrustworthy]] — stale Quick Stats erode backlog trust
- [[web-serial-api-mocking-requires-double-cast-through-unknown-because-file-scoped-classes-cannot-be-imported-for-test-type-narrowing]] — Web Serial mocks need double-cast through unknown

- [[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle]] — automated CI enforcement that breaks the IDOR recurrence cycle
- [[localstorage-features-follow-an-identical-five-step-migration-to-server-scoped-storage]] — reusable 5-step playbook for localStorage-to-server migration

### Extracted 2026-03-14 (frontend sweep)

- [[context-decomposition-uses-a-bridge-component-to-solve-cross-provider-dependency-ordering]] — ArchitectureBridge exists because ArchitectureProvider needs setActiveView from ProjectMetaProvider
- [[ai-action-executor-uses-mutable-accumulators-to-prevent-stale-closure-bugs-in-multi-action-batches]] — local mutable copies + single commit prevents multi-action sequences from dropping earlier mutations
- [[progressive-disclosure-hides-downstream-views-until-architecture-nodes-exist-preventing-empty-state-errors]] — Schematic/PCB/Procurement tabs hidden until nodes.length > 0
- [[tiered-idle-time-prefetch-prevents-first-click-navigation-jank-across-27-lazy-loaded-views]] — requestIdleCallback chain prefetches chunks by traffic priority
- [[query-keys-are-url-strings-used-as-both-cache-identifiers-and-fetch-targets-eliminating-key-endpoint-drift]] — queryKey[0] is the fetch URL, so cache keys and endpoints can never diverge
- [[errorboundary-suppresses-resizeobserver-loop-errors-because-they-are-benign-browser-noise-that-would-crash-every-canvas-view]] — ResizeObserver loop errors filtered to prevent false crash screens on canvas views
- [[deprecated-useproject-facade-enables-incremental-migration-from-monolithic-to-decomposed-contexts]] — useProject() composes all domain hooks into the original flat shape for backward compat

### Extracted 2026-03-14 (backend sweep)

- [[ai-model-routing-uses-a-phase-complexity-matrix-not-message-length-to-select-the-cheapest-sufficient-model]] — design phase + task complexity matrix selects fast/standard/premium model tier
- [[ai-request-deduplication-uses-an-in-flight-promise-map-keyed-by-provider-project-and-message-prefix]] — concurrent identical AI requests share a single API call via promise map
- [[circuit-breaker-pattern-isolates-ai-provider-failures-preventing-cascading-outages-across-anthropic-and-gemini]] — per-provider circuit breakers with CLOSED/OPEN/HALF_OPEN state machine
- [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling]] — PG error codes translated to HTTP status in one place
- [[view-aware-prompt-tiering-sends-full-data-for-the-active-view-and-summaries-for-everything-else-to-reduce-token-cost]] — full data for active view, summaries for others
- [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles]] — per-type watchdog timeouts and 4x exponential backoff
- [[session-token-rotation-on-refresh-prevents-session-fixation-by-invalidating-the-old-hash-atomically-with-new-hash-creation]] — SHA-256 hashed tokens, rotation within 24h refresh window
- [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop]] — job queue -> WebSocket -> metrics -> HTTP -> DB pool, with 30s forced exit

### Extracted 2026-03-14 (infrastructure sweep)

- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — three-layer defense-in-depth: prevent, catch, gate
- [[tsc-watch-in-tmux-provides-near-instant-type-feedback-by-decoupling-the-compiler-lifecycle-from-individual-tool-invocations]] — persistent tsc --watch avoids 33-44s cold start per edit
- [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes]] — .arscontexta marker gates 4 hooks without code changes
- [[agent-specifications-use-yaml-frontmatter-to-control-model-selection-tool-access-and-hook-suppression-creating-a-capability-profile-per-agent]] — YAML frontmatter creates constrained capability profiles per agent
- [[the-build-script-uses-an-allowlist-inversion-to-bundle-frequently-imported-deps-while-externalizing-everything-else-reducing-cold-start-syscalls]] — allowlist inversion bundles 34 deps to reduce openat syscalls
- [[ci-pipeline-gates-build-behind-typecheck-but-runs-lint-and-tests-independently-optimizing-for-fast-failure-on-the-cheapest-check]] — CI dependency graph optimizes for fast feedback on cheap checks
- [[e2e-tests-use-playwright-setup-projects-to-share-auth-state-across-specs-via-localstorage-injection-rather-than-cookie-based-session-persistence]] — localStorage injection mirrors X-Session-Id auth pattern in E2E
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — RALPH HANDOFF protocol enables cross-context state transfer in knowledge pipeline
- [[sessionstart-dependency-verification-creates-a-self-healing-bootstrap-that-surfaces-missing-tools-before-they-cause-cryptic-hook-failures]] — preflight dependency check prevents silent hook degradation

### Extracted 2026-03-14 (shared/ref/scribe sweep)

- [[three-diff-engines-share-identical-algorithm-shape-but-are-not-abstracted-creating-a-subtle-maintenance-trap]] — bom-diff, arch-diff, netlist-diff share the same Map-iterate-sort algorithm but are copy-pasted
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — serial PKs for DB foreign keys, text UUIDs for canvas/AI/diff logic
- [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary]] — 15+ JSONB columns validated by Zod on write but unvalidated casts on read
- [[crdt-merge-uses-intent-preserving-rules-where-insert-always-beats-concurrent-delete-a-deliberate-philosophical-choice]] — creation intent beats destruction intent in collaboration merge
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — breadboard/schematic/pcb ViewData required per component, only schematic populated
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — 28 beginner-friendly rule explanations in drc-engine.ts
- [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive]] — createInsertSchema().omit().extend() creates asymmetric read/write type contracts
- [[the-arduino-workbench-schema-is-the-only-domain-that-bridges-database-records-to-the-host-filesystem-via-rootPath]] — only schema domain that stores filesystem paths, encoding the native desktop assumption

### Extracted 2026-03-14 (shared/tests/ops/migrations sweep)

- [[drc-engine-exports-two-completely-separate-rule-systems-from-one-file-creating-a-hidden-api-surface-split]] — shared/drc-engine.ts is actually two DRC engines (component + PCB) with different input types, rule schemas, and naming conventions
- [[migration-0002-must-drop-and-recreate-check-constraints-because-drizzle-kit-cannot-model-them-creating-a-manual-maintenance-trap]] — Drizzle Kit drops CHECK constraints on every migration, requiring manual re-addition
- [[shared-test-suites-use-domain-specific-factory-helpers-that-reconstruct-full-object-graphs-rather-than-partial-mocks-enforcing-integration-fidelity]] — shared tests use complete factory helpers instead of Partial<T> mocks, catching structural regressions
- [[e2e-test-projects-accumulate-without-cleanup-because-playwright-setup-creates-but-never-deletes-test-data]] — E2E tests create "E2E Test Project" entries that accumulate without cleanup
- [[design-variables-test-suite-validates-a-complete-expression-language-with-si-prefix-parsing-and-dependency-graph-resolution]] — VariableStore is a full expression language with SI prefixes, DAG resolution, and typed error hierarchy

### Extracted 2026-03-14 (client deep pass)

- [[useSyncedFlowState-implements-bidirectional-sync-with-interaction-gating-to-prevent-context-overwrite-of-user-drags]] — mutable ref gating prevents server state from overwriting in-progress ReactFlow drags
- [[local-intent-parsing-produces-aiactions-not-direct-mutations-to-unify-offline-and-online-execution-paths]] — offline commands flow through the same AIAction executor as AI-generated actions
- [[circuit-dsl-worker-splits-transpilation-from-evaluation-because-sucrase-is-safe-on-main-thread-but-eval-is-not]] — Sucrase on main thread, eval in sandboxed Worker with 12 dangerous globals deleted
- [[view-sync-engine-uses-canonical-connection-signatures-to-reconcile-schematic-and-breadboard-representations]] — sorted-pair signatures enable direction-independent schematic↔breadboard comparison
- [[api-key-management-uses-sentinel-values-and-dual-persistence-to-keep-real-keys-invisible-to-the-client]] — STORED_KEY_SENTINEL placeholder + one-time localStorage→server migration
- [[breadboard-wire-router-models-the-center-channel-gap-as-a-graph-discontinuity-not-a-physical-obstacle]] — A* with turn penalty, center channel as adjacency restriction not obstacle cell
- [[architecture-context-has-two-parallel-undo-systems-that-do-not-interact]] — global UndoRedoStack vs architecture-local useState snapshots, Ctrl+Z only triggers global
- [[error-message-mapping-uses-cascading-pattern-matchers-to-translate-raw-api-errors-into-actionable-guidance]] — 7-stage cascade with retryable flags and request ID propagation
- [[design-gateway-rules-use-string-matching-heuristics-instead-of-schematic-netlist-analysis-because-architecture-nodes-lack-electrical-types]] — 12 heuristic rules using substring matching because nodes have no pin models

### Extracted 2026-03-14 (server deep pass)

- [[ai-tool-registry-uses-client-side-dispatch-stubs-for-tools-that-cannot-execute-server-side]] — clientAction() validates server-side but dispatches to client, server never sees execution failures
- [[design-agent-hardcodes-confirmed-true-bypassing-destructive-tool-confirmation-enforcement]] — agentic AI loop sets confirmed=true, all 88 tools execute without confirmation
- [[batch-analysis-tracking-lives-in-an-in-memory-map-that-does-not-survive-server-restarts]] — Anthropic Message Batches tracking in module-scoped Map, restart orphans in-flight batches
- [[arduino-job-streams-buffer-all-events-for-late-join-replay-creating-an-sse-catch-up-mechanism]] — JobStream buffers all events for late-joining SSE clients, unique to Arduino
- [[drc-gate-is-a-pure-function-pipeline-stage-that-blocks-manufacturing-export-without-touching-the-database]] — pure function (no IO) running 6 ordered rules as pre-export validation
- [[storage-uses-bind-delegation-composition-not-inheritance-creating-a-flat-facade-from-10-domain-classes]] — ~90 explicit .bind() delegations compose 10 domain classes into one facade
- [[circuit-ai-selectively-enables-extended-thinking-based-on-operation-type-not-model-or-prompt-size]] — extended thinking for generate/analyze but not review or multi-turn agent
- [[export-modules-use-a-shared-data-adapter-layer-decoupled-from-drizzle-row-types]] — 17 export modules consume simplified interfaces from types.ts, not Drizzle row types

### Extracted 2026-03-14 (meta/operational deep pass)

- [[the-rethink-skill-implements-a-scientific-method-feedback-loop-that-triages-accumulated-friction-into-five-dispositions-preventing-knowledge-system-ossification]] — 6-phase protocol with 5 dispositions acts as knowledge system immune system
- [[ops-queries-implement-a-graph-health-observatory-where-shell-scripts-serve-as-reusable-diagnostic-lenses-over-the-knowledge-vault]] — 5 shell scripts extract graph metrics from flat markdown using Unix tools
- [[the-next-skill-uses-consequence-speed-classification-to-prioritize-recommendations-where-session-urgency-beats-multi-session-which-beats-slow-decay]] — consequence speed classification with priority cascade and deduplication
- [[session-capture-hooks-create-a-mining-backlog-with-mined-false-flags-enabling-retroactive-insight-extraction-from-work-sessions]] — session-capture.sh writes mined:false JSON creating deferred extraction backlog
- [[the-derivation-manifest-creates-a-vocabulary-abstraction-layer-that-decouples-knowledge-engine-mechanics-from-domain-native-terminology]] — derivation.md maps universal terms to domain terms, read by every skill at Step 0

### Extracted 2026-03-13 (Codex sessions)

- [[backlog-planning-layers-must-be-additive-scaffolding-over-canonical-item-inventory-not-replacements]] — planning views are lenses over data, not transformations of it
- [[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — localStorage-only features create false "done" signals
- [[gap-audits-that-compare-code-surfaces-against-backlog-produce-higher-signal-findings-than-code-only-audits]] — code-vs-backlog comparison catches both directions of drift
- [[in-memory-server-state-is-an-authorization-bypass-because-it-shares-a-single-namespace-across-all-users-and-projects]] — shared in-memory Maps enable cross-tenant data access
- [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — default editor role without invite table is an access control gap
- [[the-hybrid-runtime-architecture-for-firmware-is-the-only-viable-path-because-browser-only-wasm-and-pure-local-approaches-each-sacrifice-a-core-value-proposition]] — hybrid browser+local is the only viable firmware path
- [[circuits-zero-defaulting-in-export-and-ordering-is-a-latent-multi-project-regression-because-it-silently-picks-the-wrong-circuit]] — circuits[0] default will break multi-circuit designs
- [[phased-collaboration-delivery-must-sequence-session-hardening-before-membership-before-branching-because-each-layer-depends-on-the-one-below]] — collaboration layers have strict dependency ordering
- [[ai-chat-endpoints-accepting-projectid-in-the-request-body-instead-of-the-url-path-bypass-ownership-middleware-by-construction]] — body-param projectId structurally bypasses ownership middleware
- [[architecture-expansion-using-placeholder-first-pin-mapping-produces-semantically-wrong-schematics-that-erode-trust-in-ai-generated-designs]] — placeholder pin mapping produces authoritative-looking but wrong schematics

## About This System

- [[identity]] — who the agent is and how it approaches work
- [[methodology]] — how the agent processes and connects knowledge
- [[goals]] — current active threads

## Getting Started

1. Read `self/identity.md` to understand the system's purpose
2. Capture your first insight in `insights/`
3. Connect it to one of the topic maps above
