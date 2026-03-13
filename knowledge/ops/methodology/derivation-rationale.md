---
summary: Why each configuration dimension was chosen — the reasoning behind initial system setup
category: derivation-rationale
created: 2026-03-13
status: active
---

# derivation rationale for ProtoPulse codebase knowledge

## Domain

ProtoPulse is a browser-based EDA platform with 60+ waves of development, 200+ source files, 8800+ tests, and a codebase that evolves rapidly. The knowledge system tracks architectural decisions, bug patterns, implementation details, dependency gotchas, conventions, optimizations, and testing strategies.

## Key Dimension Choices

**Atomic granularity** was chosen because Tyler wants to track "every detail." Atomic insights (one idea per note) maximize composability — a bug pattern can be linked to both an architectural decision and a testing strategy without duplicating content. The codebase is large enough that coarser granularity would lose important connections.

**Heavy processing** follows from atomic granularity and Tyler's explicit "ALL OF IT" directive. Atomic insights need extraction, connection, and verification to recreate the context that decomposition removes. Without heavy processing, insights would be created but never connected.

**Dense schema** supports the 8 extraction categories needed to distinguish architectural decisions from bug patterns from gotchas. Fields like `wave`, `affected_files`, `confidence`, and `category` enable targeted queries ("show me all proven gotchas affecting server/storage.ts").

**Full automation** is enabled by the Claude Code platform. Hooks validate schema on write, capture session state, and auto-commit. Skills handle the extract/connect/verify/revisit pipeline. Condition-based maintenance surfaces tasks automatically.

**3-tier navigation** handles the expected high volume. Hub (index) links to domain-area topic maps (architecture, testing, simulation, etc.), which link to individual insights.

**Flat organization** prevents category boundaries from becoming barriers. A bug pattern involving the storage layer and the AI system should be findable from both areas without duplicating the file.

**Personality: warm, opinionated, casual, task-focused** reflects Tyler's communication style and values. Direct, gives a damn about quality, no corporate bullshit, strong opinions backed by reasoning.

## Platform

Claude Code with full hook and skill support. Vault located at `knowledge/` subdirectory of the ProtoPulse project root to keep knowledge co-located without polluting the codebase.

## Coherence

All hard constraints pass. Atomic + heavy + full automation + 3-tier + dense schema is a mutually reinforcing configuration. The main risk is temporal staleness (fast-moving codebase) and collector's fallacy (desire to capture everything).

---

Areas:
- [[methodology]]
