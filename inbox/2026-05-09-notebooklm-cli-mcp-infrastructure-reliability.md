---
description: Research capture on PP-NLM CLI/MCP reliability after the ProtoPulse notebook consolidation pause.
source_type: web-search
exa_prompt: "Research NotebookLM CLI/MCP infrastructure reliability for ProtoPulse consolidation: source limits, source add behavior, timeout handling, manifests, and multi-notebook routing."
exa_tool: "web-search plus local operational logs"
generated: 2026-05-09T19:12:36Z
domain: "ProtoPulse"
topics:
  - "[[methodology]]"
  - "[[dev-infrastructure]]"
  - "[[notebooklm]]"
---

# NotebookLM CLI MCP Infrastructure Reliability

## Key Findings

NotebookLM notebook boundaries matter. Google's NotebookLM help says individual notebooks are independent and cannot access information across multiple notebooks at the same time. This supports Tyler's consolidation instinct: if ProtoPulse knowledge needs shared context, spreading it across many notebooks creates a retrieval and workflow penalty.

NotebookLM supports text, Markdown, PDF, web URLs, YouTube URLs, and other sources. Google's source documentation says each source can contain up to 500,000 words or up to 200 MB for uploaded files. That means dense source packs are a plausible consolidation strategy, provided retrieval quality is validated.

The current ProtoPulse helper scripts pass entire files as command-line text arguments through `nlm source add --text "$content"`. This already failed on `MASTER_BACKLOG snapshot` with `Argument list too long`, so file-backed or pack-backed ingestion should replace shell-argument ingestion for large content.

The current scripts use `--wait` as the default for source adds. Local evidence shows that adds may time out or return not-ready even after the remote source lands. Therefore a timeout must be treated as an unknown state requiring reconciliation, not as a definite failed add.

The local alias/tag system has drifted from the source and notebook manifests. Live aliases now point most old aliases at two consolidated hubs, but the local notebook manifest still maps aliases to old notebook IDs, and the source manifest remains keyed by old aliases. This breaks durable idempotency.

Logging should have one owner. The Phase 2 runner's duplicate-looking logs appear consistent with internal `tee -a "$LOG"` combined with external redirection to the same log file. This creates confusing evidence during debugging.

Auth probes need explicit timeouts. `nlm doctor` passed in this run, while a direct `nlm login --check` hung until killed. Long-running hooks and runners should bound auth checks and report degraded state rather than hang.

## Sources

- Google NotebookLM Help: Create a notebook in NotebookLM. https://support.google.com/notebooklm/answer/16206563
- Google NotebookLM Help: Add or discover new sources for your notebook. https://support.google.com/notebooklm/answer/16215270
- Local command help: `nlm source add --help`.
- Local logs: `~/.claude/logs/pp-nlm-errors.log`, `~/.claude/logs/pp-nlm-full-population.log`, `~/.claude/logs/pp-nlm-phase2-runner.log`, `~/.claude/logs/pp-nlm-apply-configs.log`.
- Local manifests: `~/.claude/state/pp-nlm/source-manifest.json`, `~/.claude/state/pp-nlm/notebook-manifest.json`.

## Research Directions

- Test one Core source pack added through `nlm source add --file` and verify retrieval quality.
- Design a write helper that records `unknown` on timeout and reconciles before retry.
- Decide whether any old `pp:feature` notebooks remain useful as true deep dives or whether every feature alias should be compatibility-only.
- Update PP-NLM skills after Tyler approves the topology change.
