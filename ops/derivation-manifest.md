---
description: Machine-readable manifest of vocabulary mappings, dimensions, and platform hints
type: manifest
generated_from: "arscontexta-1.0.0"
generated_date: 2026-04-05
---

# Derivation Manifest

Machine-readable reference for skills, hooks, and automation.

## Vocabulary Mappings

| Universal Term | Domain Term | Usage Context |
|----------------|-------------|---------------|
| notes | knowledge | Folder name: `knowledge/` |
| inbox | inbox | Folder name: `inbox/` |
| archive | archive | Folder name: `archive/` |
| note | note | Generic note type |
| reduce | extract | Processing phase: raw -> atomic notes |
| reflect | connect | Processing phase: find relationships |
| reweave | revisit | Processing phase: backward pass |
| verify | verify | Processing phase: challenge claims |
| validate | validate | Schema compliance check || rethink | rethink | System assumption challenge |
| MOC | topic map | Navigation hub (Map of Content) |
| description | description | Schema field: one-sentence context |
| topics | topics | Schema field: wiki links to topic maps |

## Dimension Positions

| Dimension | Position | Confidence |
|-----------|----------|------------|
| Granularity | atomic | High |
| Organization | flat | High |
| Linking | explicit+implicit | High |
| Processing | heavy | High |
| Navigation | 3-tier | High |
| Maintenance | condition-based | Inferred |
| Schema | dense | High |
| Automation | full | High |

## Platform Hints

| Property | Value |
|----------|-------|
| Platform | Claude Code |
| Automation level | full |
| Topology | single-agent / skills / fresh-context || Hook engine | .claude/settings.json |
| Skill engine | .claude/commands/ |

## Extraction Categories

| Category | Description | Example Source |
|----------|-------------|---------------|
| claims | Factual assertions from datasheets, docs, research | "ATmega328P ADC is 10-bit" |
| architecture-decisions | Why X over Y, trade-offs, constraints | "React Query over Redux because..." |
| domain-knowledge | EDA/electronics concepts, specs, protocols | "I2C pull-up resistor sizing" |
| competitive-insights | How competitor tools work, gaps, strengths | "Fritzing breadboard auto-maps nets" |
| ux-patterns | What makes features accessible to beginners | "Progressive disclosure in DRC results" |
| technical-debt | Why debt exists, what it blocks, fix priority | "ProjectProvider monolith blocks multi-project" |
| implementation-patterns | Code conventions, anti-patterns, proven approaches | "Exhaustive switch on discriminated unions" |
| user-needs | What makers/hobbyists actually need | "One-click BOM export for JLCPCB" |

## Schema Entity Types

| Entity Type | Applies To | Required Fields |
|-------------|-----------|-----------------|
| knowledge-note | knowledge/*.md | description, type, topics |
| topic-map | knowledge/*.md (type: moc) | description |
| source-capture | inbox/*.md | source_url, captured_date, extraction_status |
| observation | ops/observations/*.md | observed_date, category |
## Failure Mode Watchlist

| Risk | Severity | Mitigation |
|------|----------|------------|
| Collector's Fallacy | HIGH | Extraction transforms, no verbatim copying |
| Orphan Drift | HIGH | Auto-connect on extract, health checks |
| Verbatim Risk | HIGH | Validate-note hook, extraction guidelines |
| Productivity Porn | HIGH | Task-focused personality, /next prioritization |