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

## Evolution Log

### 2026-04-06: Comprehensive audit ingested (25 notes)
**Source:** `conductor/comprehensive-audit.md` (40 sections, 30 passes)
**Action:** Extracted 25 atomic knowledge notes covering security (4), AI/Genkit (8), performance (6), architecture debt (5), EDA (2)
**Connection pass:** 71 cross-references added, 5 topic maps updated (architecture-decisions, eda-fundamentals, gaps-and-opportunities, maker-ux, competitive-landscape)
**Cluster structure:** Notes organize into 5 groups: (1) AI quality chain, (2) security attack chain, (3) main-thread blocking, (4) resource leaks, (5) desktop pivot risks
**Impact:** Vault grew from 118 to 143 notes. architecture-decisions MOC approaching split threshold (37 notes).

### 2026-04-06: /architect analysis — 4 recommendations implemented
**Trigger:** Full-system architect analysis after audit ingestion
**Health findings:** 0 FAIL, 3 WARN (3 MOCs over 40-note threshold: gaps-and-opportunities=62, architecture-decisions=50, dev-infrastructure=43), methodology MOC at 2 notes (below merge threshold)
**Drift:** None — all 8 dimensions match derivation
**Failure modes active:** MOC Sprawl (gaps-and-opportunities at 62 notes)
**Research grounding:** failure-modes.md (MOC Sprawl #5), interaction-constraints.md (Volume Cascade), dimension-claim-map.md (navigational vertigo), evolution-lifecycle.md (Gall's Law)

**Changes implemented:**
1. **Split gaps-and-opportunities** — created 3 sub-topic maps: `security-debt.md`, `performance-debt.md`, `ai-system-debt.md`. Replaced 20 inline entries with 5 sub-map links. MOC dropped from 62 to ~47 entries.
2. **Archive source note** — created `archive/comprehensive-audit-2026-04-05.md` with extraction manifest mapping all 25 notes to their source sections.
3. **Promoted methodology MOC** — added 5 existing methodology notes to `## Notes` section (was counting only 2 due to subsection formatting).
4. **Synthesis note** — created `comprehensive-audit-reveals-zero-validation-at-any-layer.md` (type: insight) capturing the 3 cross-cutting patterns: validation vacuum, desktop pivot security trade-off, synchronous computation bottleneck.
5. **Deferred:** architecture-decisions split (50 notes, but structurally coherent via subsections). Revisit at 60 notes.

**Vault state after:** 147 notes, 15 topic maps (was 12), 0 orphans, 0 dangling links.

## Generation Parameters
- Folder names: knowledge/, inbox/, archive/, self/, ops/, templates/, manual/
- Skills to generate: all 16 (vocabulary-transformed)
- Hooks to generate: session-orient, validate-note, auto-commit, session-capture
- Templates to create: knowledge-note.md, topic-map.md, source-capture.md, observation.md
- Topology: single-agent / skills / fresh-context
