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

- [[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — emerged across 30+ managers as the standard client state pattern
- [[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — monolithic Context that proves why singleton+subscribe is better
- [[idor-vulnerabilities-cluster-in-routes-that-use-global-resource-ids-instead-of-project-scoped-url-paths]] — recurring security pattern across 3 audit waves
- [[security-vulnerabilities-recur-because-new-routes-are-added-without-systematic-ownership-audit]] — IDOR gaps recur because no CI gate checks new routes for ownership middleware
- [[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — isolated library modules cause broken workflows until wiring waves
- [[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — integration forces deferred data ownership questions
- [[complexity-ratings-measure-decision-surface-area-not-effort]] — C1-C5 measures entangled systems, not hours
- [[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — TinkerCAD feels more powerful because results are visible on the circuit
- [[five-architecture-decisions-block-over-30-downstream-features-each]] — firmware, debugger, platform, collaboration, supplier trust block 5+ items each
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
