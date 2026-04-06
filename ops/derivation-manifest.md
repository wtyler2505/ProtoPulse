---
engine_version: "1.0.0"
research_snapshot: "2026-04-05"
generated_at: "2026-04-05T22:30:00Z"
platform: claude-code
kernel_version: "1.0"

dimensions:
  granularity: atomic
  organization: flat
  linking: explicit+implicit
  processing: heavy
  navigation: 3-tier
  maintenance: condition-based
  schema: dense
  automation: full

active_blocks:
  - wiki-links
  - atomic-notes
  - mocs
  - processing-pipeline
  - schema
  - maintenance
  - self-evolution
  - methodology-knowledge
  - session-rhythm
  - templates
  - ethical-guardrails
  - helper-functions
  - graph-analysis
  - semantic-search
  - personality
  - self-space

coherence_result: passed

vocabulary:
  notes: "knowledge"
  inbox: "inbox"
  archive: "archive"
  ops: "ops"

  note: "note"
  note_plural: "notes"

  description: "description"
  topics: "topics"
  relevant_notes: "relevant notes"

  topic_map: "topic map"
  hub: "index"

  reduce: "extract"
  reflect: "connect"
  reweave: "revisit"
  verify: "verify"
  validate: "validate"
  rethink: "rethink"

  cmd_reduce: "/extract"
  cmd_reflect: "/connect"
  cmd_reweave: "/revisit"
  cmd_verify: "/verify"
  cmd_rethink: "/rethink"

  extraction_categories:
    - name: "claims"
      what_to_find: "Factual assertions from datasheets, docs, research"
      output_type: "claim"
    - name: "architecture-decisions"
      what_to_find: "Why X over Y, trade-offs, constraints"
      output_type: "decision"
    - name: "domain-knowledge"
      what_to_find: "EDA/electronics concepts, component specs, protocols"
      output_type: "concept"
    - name: "competitive-insights"
      what_to_find: "How Fritzing/Wokwi/KiCad/TinkerCad work, gaps, strengths"
      output_type: "insight"
    - name: "ux-patterns"
      what_to_find: "What makes features accessible to maker-beginners"
      output_type: "pattern"
    - name: "technical-debt"
      what_to_find: "Why debt exists, what it blocks, fix priority"
      output_type: "debt-note"
    - name: "implementation-patterns"
      what_to_find: "Code conventions, anti-patterns, proven approaches"
      output_type: "pattern"
    - name: "user-needs"
      what_to_find: "What makers/hobbyists actually need from the tool"
      output_type: "need"

platform_hints:
  context: fork
  allowed_tools:
    - Read
    - Write
    - Edit
    - Bash
    - Grep
    - Glob
    - Agent
  semantic_search_tool: null
  semantic_search_autoapprove: []

personality:
  warmth: warm
  opinionatedness: opinionated
  formality: casual
  emotional_awareness: task-focused
---
