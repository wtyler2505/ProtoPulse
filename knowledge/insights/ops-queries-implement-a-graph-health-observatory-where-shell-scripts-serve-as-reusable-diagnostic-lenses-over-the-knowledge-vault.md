---
summary: Five shell scripts in ops/queries/ (orphan-insights, stale-insights, category-distribution, file-impact, wave-coverage) form a diagnostic observatory that turns the flat-file knowledge vault into a queryable graph without requiring a database
category: architecture
areas:
  - agent-workflows
  - conventions
---

# Ops queries implement a graph health observatory where shell scripts serve as reusable diagnostic lenses over the knowledge vault

The `knowledge/ops/queries/` directory contains five shell scripts that each answer a different structural question about the knowledge vault's health. Together, they form a diagnostic observatory — a set of reusable lenses that reveal graph properties (connectivity, staleness, coverage, impact) from a flat-file markdown vault without requiring a database or graph engine.

**The five lenses:**

| Script | Question It Answers | Method |
|--------|-------------------|--------|
| `orphan-insights.sh` | Which insights have no incoming wiki links? | For each .md, ripgrep for `[[filename]]` across all other files; zero hits = orphan |
| `stale-insights.sh` | Which insights are old with sparse connections? | `find -mtime +30` + count `[[` links per file + read confidence field |
| `category-distribution.sh` | How balanced is extraction across categories? | ripgrep `^category:` + sort + uniq -c |
| `file-impact.sh` | Which source files generate the most insights? | ripgrep `affected_files:` + parse JSON arrays + count per filename |
| `wave-coverage.sh` | Which development waves have no insights documented? | ripgrep `^wave:` + iterate 1..max_wave + report gaps |

The design insight is that wiki links in markdown files implicitly encode a directed graph, and standard Unix tools (ripgrep, find, grep, sort, uniq) can extract graph metrics from this structure without any special indexing. The orphan detection script is effectively computing in-degree per node using text search. The stale detection combines temporal metadata (filesystem mtime) with topological metadata (link count) to surface decay candidates.

These queries serve the `/next` skill's signal collection (Step 3) and the `/rethink` skill's Phase 0 drift check. Rather than embedding diagnostic logic in the skills themselves, the observatory pattern externalizes diagnostics into composable scripts. This means the same queries can be run manually from the terminal, invoked by hooks, or composed into health reports — three consumption modes from one implementation.

The `wave-coverage.sh` script reveals an additional meta-pattern: it treats knowledge extraction as a coverage metric analogous to test coverage. Just as `npm run test:coverage` shows which code paths lack tests, `wave-coverage.sh` shows which development waves lack documented insights. This reframes the knowledge vault as a coverage problem, not just a collection problem — gaps in coverage represent undocumented decisions that will be invisible to future sessions.

---

Related:
- [[hook-architecture-uses-layered-gates-where-pretooluse-prevents-damage-posttooluse-catches-regressions-and-stop-enforces-quality-before-handoff]] — hooks consume graph health data from these queries
- [[arscontexta-vault-marker-file-acts-as-a-feature-flag-that-conditionally-activates-knowledge-system-hooks-without-code-changes]] — vault marker gates whether these diagnostics are meaningful

Areas: [[agent-workflows]], [[conventions]]
