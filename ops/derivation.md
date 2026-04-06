---
description: How this knowledge system was derived -- enables architect and reseed commands
created: 2026-04-05
engine_version: "1.0.0"
---

# System Derivation

## Configuration Dimensions
| Dimension | Position | Conversation Signal | Confidence |
|-----------|----------|--------------------|--------------------|
| Granularity | atomic | "research" + knowledge work patterns (EDA claims, arch decisions) | High |
| Organization | flat | Research default — connections > folders | High |
| Linking | explicit+implicit | "go all in" — both wiki links and semantic search | High |
| Processing | heavy | "go all in", "as useful as possible" | High |
| Navigation | 3-tier | "go all in", high projected volume | High |
| Maintenance | condition-based | Research default — triggers on orphans, stale notes, tensions | Inferred |
| Schema | dense | "go all in" — maximum queryability, 8 extraction categories | High |
| Automation | full | Claude Code platform, "go all in" | High |

## Personality Dimensions
| Dimension | Position | Signal |
|-----------|----------|--------|
| Warmth | warm | Tyler's direct, engaged communication style |
| Opinionatedness | opinionated | "i trust your judgement", wants Claude to have opinions |
| Formality | casual | Tyler's language register: casual, direct, no ceremony |
| Emotional Awareness | task-focused | Engineering/research domain, not personal |

## Vocabulary Mapping
| Universal Term | Domain Term | Category |
|---------------|-------------|----------|
| notes | knowledge | folder |
| inbox | inbox | folder |
| archive | archive | folder |
| note (type) | note | note type |
| reduce | extract | process phase |
| reflect | connect | process phase |
| reweave | revisit | process phase |
| verify | verify | process phase |
| validate | validate | process phase |
| rethink | rethink | process phase |
| MOC | topic map | navigation |
| description | description | schema field |
| topics | topics | schema field |

## Platform
- Tier: Claude Code
- Automation level: full
- Automation: full (default)

## Active Feature Blocks
- [x] wiki-links -- always included (kernel)
- [x] atomic-notes -- atomic granularity selected
- [x] mocs -- 3-tier navigation
- [x] processing-pipeline -- always included
- [x] schema -- always included
- [x] maintenance -- always included
- [x] self-evolution -- always included
- [x] methodology-knowledge -- always included
- [x] session-rhythm -- always included
- [x] templates -- always included
- [x] ethical-guardrails -- always included
- [x] helper-functions -- always included
- [x] graph-analysis -- always included
- [x] semantic-search -- explicit+implicit linking
- [x] personality -- derived from conversation
- [x] self-space -- enabled for persistent agent identity

## Coherence Validation Results
- Hard constraints checked: 3. Violations: none
  - atomic + 3-tier navigation: coherent (deep nav supports atomic volume)
  - full automation + Claude Code: coherent (platform supports hooks + skills)
  - heavy processing + full automation: coherent (pipeline skills handle volume)
- Soft constraints checked: 4. Auto-adjusted: none. User-confirmed: none
  - atomic + heavy processing: coherent (mutual support)
  - dense schema + full automation: coherent (hooks enforce validation)
  - explicit+implicit linking + semantic search: coherent (qmd provides implicit)
  - high projected volume + condition-based maintenance: coherent (triggers catch growth)
- Compensating mechanisms active: none needed (all dimensions aligned)

## Failure Mode Risks
1. Collector's Fallacy (HIGH) — EDA sources, datasheets, docs are abundant
2. Orphan Drift (HIGH) — high creation volume during development sessions
3. Verbatim Risk (HIGH) — datasheets tempt copy-paste over transformation
4. Productivity Porn (HIGH) — meta-system building vs actual ProtoPulse development

## Extraction Categories
1. claims — factual assertions from datasheets, docs, research
2. architecture-decisions — why X over Y, trade-offs, constraints
3. domain-knowledge — EDA/electronics concepts, component specs, protocols
4. competitive-insights — how Fritzing/Wokwi/KiCad/TinkerCad work, gaps, strengths
5. ux-patterns — what makes features accessible to maker-beginners
6. technical-debt — why debt exists, what it blocks, fix priority
7. implementation-patterns — code conventions, anti-patterns, proven approaches
8. user-needs — what makers/hobbyists actually need from the tool

## Generation Parameters
- Folder names: knowledge/, inbox/, archive/, self/, ops/, templates/, manual/
- Skills to generate: all 16 (vocabulary-transformed)
- Hooks to generate: session-orient, validate-note, auto-commit, session-capture
- Templates to create: knowledge-note.md, topic-map.md, source-capture.md, observation.md
- Topology: single-agent / skills / fresh-context
