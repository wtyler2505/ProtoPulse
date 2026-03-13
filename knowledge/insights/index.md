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

## About This System

- [[identity]] — who the agent is and how it approaches work
- [[methodology]] — how the agent processes and connects knowledge
- [[goals]] — current active threads

## Getting Started

1. Read `self/identity.md` to understand the system's purpose
2. Capture your first insight in `insights/`
3. Connect it to one of the topic maps above
