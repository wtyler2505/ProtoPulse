---
description: How this knowledge system was derived — enables architect and reseed commands
created: 2026-03-13
engine_version: "1.0.0"
---

# System Derivation

## Configuration Dimensions

| Dimension | Position | Conversation Signal | Confidence |
|-----------|----------|--------------------|--------------------|
| Granularity | Atomic | "every detail" + "ALL OF IT" | High |
| Organization | Flat | Default — codebase knowledge crosses categories | Inferred |
| Linking | Explicit + Implicit | Cascade from atomic + "think about" implies connections | High |
| Processing | Heavy | "ALL OF IT" for capture frequency | High |
| Navigation | 3-tier | Cascade from atomic + high expected volume | High |
| Maintenance | Condition-based | Default + full automation supports it | Inferred |
| Schema | Dense | "ALL OF IT" needs rich categorization | High |
| Automation | Full | Claude Code platform + "ALL OF IT" | High |

## Personality Dimensions

| Dimension | Position | Signal |
|-----------|----------|--------|
| Warmth | warm | User has genuine emotional investment in project, deeply cares about quality |
| Opinionatedness | opinionated | "NEVER take shortcuts", "do things the right way" |
| Formality | casual | User uses fragments, swears, contractions, very informal |
| Emotional Awareness | task-focused | Engineering domain, not emotional content |

## Vocabulary Mapping

| Universal Term | Domain Term | Category |
|---------------|-------------|----------|
| notes | insights | folder |
| inbox | captures | folder |
| archive | archive | folder |
| note (type) | insight | note type |
| note (plural) | insights | note type |
| reduce | extract | process phase |
| reflect | connect | process phase |
| reweave | revisit | process phase |
| verify | verify | process phase |
| validate | validate | process phase |
| rethink | rethink | process phase |
| MOC | map | navigation |
| description | summary | schema field |
| topics | areas | schema field |
| topic map | topic map | navigation |
| hub | hub | navigation |
| orient | orient | session phase |
| persist | persist | session phase |

## Platform

- Tier: Claude Code
- Automation level: full
- Automation: full (default)

## Active Feature Blocks

- [x] wiki-links — always included (kernel)
- [x] atomic-notes — included (granularity: atomic)
- [x] mocs — included (navigation: 3-tier)
- [x] processing-pipeline — always included
- [x] schema — always included
- [x] maintenance — always included
- [x] self-evolution — always included
- [x] methodology-knowledge — always included
- [x] session-rhythm — always included
- [x] templates — always included
- [x] personality — included (strong personality signals)
- [x] self-space — included (session handoff + operational knowledge important)
- [x] ethical-guardrails — always included
- [x] helper-functions — always included
- [x] graph-analysis — always included
- [ ] semantic-search — conditional (qmd not yet installed)
- [ ] multi-domain — excluded (single project: ProtoPulse)

## Coherence Validation Results

- Hard constraints checked: 3. Violations: none
- Soft constraints checked: 7. Auto-adjusted: none. User-confirmed: none
- Compensating mechanisms active: ripgrep keyword search compensates for absent semantic search (consistent engineering vocabulary in a single codebase reduces vocabulary divergence risk)

## Failure Mode Risks

1. **Temporal Staleness (HIGH)** — ProtoPulse evolves fast (60+ waves). Insights from early waves become outdated as architecture changes. Schema includes `confidence` field and `/revisit` skill flags stale content.
2. **Collector's Fallacy (HIGH)** — "ALL OF IT" risks capture without processing. Pipeline enforces extract-connect-verify workflow with WIP limits.
3. **Orphan Drift (MEDIUM-HIGH)** — High creation volume from capturing every detail needs mandatory connections. Health checks catch orphans, topics footer enforced.
4. **Productivity Porn (MEDIUM)** — The knowledge system serves ProtoPulse, not the other way around. Track content-creation vs system-modification ratio.

## Generation Parameters

- Folder names: insights/, captures/, archive/
- Skills to generate: all 16 — vocabulary-transformed
- Hooks to generate: session-orient, session-capture, validate-note, auto-commit
- Templates to create: insight-note.md, topic-map.md, source-capture.md, observation.md
- Topology: single-agent
- Vault location: knowledge/ (subdirectory of ProtoPulse project root)
- Domain: Software engineering codebase knowledge
- Project: ProtoPulse (browser-based EDA platform)

## Extraction Categories

1. **architectural-decision** — Design choices, trade-offs, reasoning behind structural decisions
2. **bug-pattern** — Bugs encountered, root causes, fix patterns, prevention strategies
3. **implementation-detail** — How features were built, edge cases, non-obvious approaches
4. **dependency-knowledge** — Library gotchas, version constraints, integration patterns
5. **convention** — Code patterns, naming, style decisions specific to ProtoPulse
6. **gotcha** — Non-obvious behaviors, traps, things that will bite you later
7. **optimization** — Performance findings, bottleneck resolutions
8. **testing-pattern** — Test strategies, mock patterns, coverage approaches
