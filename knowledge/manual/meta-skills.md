---
summary: Deep guide to /ask, /architect, /rethink, and /remember
type: manual
generated_from: "arscontexta-1.0.0"
---

# Meta-Skills

## /arscontexta:ask

Queries two knowledge layers:
1. **Bundled methodology knowledge base** — 249 research-backed notes on knowledge system design
2. **Local methodology notes** — your system's own learnings in `ops/methodology/`

Answers are grounded in specific claims and applied to your system's configuration.

Example: `/arscontexta:ask why is atomic granularity important for my setup?`

## /arscontexta:architect

Research-backed evolution advice. Reads your derivation rationale, current config, and accumulated friction observations. Proposes changes with reasoning — never auto-implements.

Use when: friction patterns persist, you want to adjust dimensions, or you're considering adding features like semantic search.

## /rethink

Reviews accumulated evidence in `ops/observations/` and `ops/tensions/`. Triages each item:
- **PROMOTE** — becomes a proper insight in `insights/`
- **IMPLEMENT** — updates the context file or methodology
- **ARCHIVE** — no longer relevant
- **KEEP PENDING** — needs more evidence

Run when observation count exceeds 10 or tension count exceeds 5.

## /arscontexta:remember

Captures operational corrections and methodology learnings. When something goes wrong (search fails, content placed wrong, workflow breaks), /remember creates a structured observation.

These observations accumulate evidence for system evolution. Rule Zero: methodology is a spec — corrections update it.

See [[configuration]] for config changes.
See [[troubleshooting]] for drift-related issues.
