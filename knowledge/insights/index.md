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

## About This System

- [[identity]] — who the agent is and how it approaches work
- [[methodology]] — how the agent processes and connects knowledge
- [[goals]] — current active threads

## Getting Started

1. Read `self/identity.md` to understand the system's purpose
2. Capture your first insight in `insights/`
3. Connect it to one of the topic maps above
