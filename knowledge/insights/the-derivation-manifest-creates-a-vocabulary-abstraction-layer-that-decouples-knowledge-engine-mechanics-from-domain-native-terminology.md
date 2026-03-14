---
summary: The ops/derivation.md vocabulary mapping translates universal knowledge-system terms (notes, inbox, reduce, reflect) to domain-native terms (insights, captures, extract, connect), enabling the same skill engine to operate across domains with different cognitive vocabularies
category: architecture
areas:
  - agent-workflows
  - conventions
---

# The derivation manifest creates a vocabulary abstraction layer that decouples knowledge engine mechanics from domain native terminology

The `knowledge/ops/derivation.md` file contains a vocabulary mapping table that translates universal knowledge-engine terms to domain-specific terms. Every skill in the system reads this mapping at Step 0 before executing any logic, and all user-facing output uses the domain-native terms:

| Universal Term | Domain Term | Category |
|---------------|-------------|----------|
| notes | insights | folder |
| inbox | captures | folder |
| note | insight | note type |
| reduce | extract | process phase |
| reflect | connect | process phase |
| reweave | revisit | process phase |
| verify | verify | process phase |
| MOC | map | navigation |
| description | summary | schema field |
| topics | areas | schema field |

This is an abstraction layer at the language level, not the code level. The skills themselves reference `{vocabulary.notes}`, `{vocabulary.note}`, `{vocabulary.reduce}`, etc. When `/extract` runs in the ProtoPulse vault, it talks about "extracting insights from captures." In a different domain vault with different vocabulary mappings, the same skill engine would use that domain's language.

The design insight is that cognitive vocabulary affects understanding. A system that talks about "notes" and "inboxes" feels generic; one that talks about "insights" and "captures" feels native to the domain. The vocabulary layer creates this native feeling without forking the skill codebase.

The derivation manifest also contains the configuration dimensions that drove the system's initial setup (granularity: atomic, processing: heavy, automation: full, etc.), personality dimensions (warm, opinionated, casual, task-focused), and coherence validation results. This means the manifest serves dual purposes: (1) runtime vocabulary configuration consumed by every skill, and (2) architectural decision record explaining WHY the system was configured this way.

The failure mode risks section of the derivation is particularly revealing — it identifies four specific risks: temporal staleness (fast-moving codebase), collector's fallacy ("ALL OF IT" desire risks capture without processing), orphan drift (high creation volume without connections), and productivity porn (knowledge system serving itself instead of the project). Each risk has a named compensating mechanism. This self-awareness of failure modes within the configuration document itself is a meta-level quality gate — the system documents not just what it does, but what could go wrong with how it does it.

Skills that cannot find the derivation manifest fall back to universal terms without failing. This graceful degradation means the vocabulary layer is additive, not load-bearing — the system works without it, but speaks the domain's language with it.

---

Related:
- [[arscontexta-skills-implement-a-knowledge-processing-pipeline-where-each-phase-runs-in-isolated-context-with-structured-handoff-blocks-for-state-transfer]] — every skill in the pipeline reads the vocabulary mapping at Step 0
- [[the-rethink-skill-implements-a-scientific-method-feedback-loop-that-triages-accumulated-friction-into-five-dispositions-preventing-knowledge-system-ossification]] — /rethink's Phase 0 drift check compares the derivation manifest against actual system state

Areas: [[agent-workflows]], [[conventions]]
