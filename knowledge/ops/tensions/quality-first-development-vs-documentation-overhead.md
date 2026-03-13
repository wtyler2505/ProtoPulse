---
summary: Tyler's absolute rules demand zero errors + docs accuracy + proper methods, but documentation maintenance scales linearly with wave count while feature work is parallelized via agent teams
type: tension
created: 2026-03-13
status: pending
---

ProtoPulse's development philosophy is "never rush, never take shortcuts" — every wave must pass typecheck, update docs, update the backlog, and fix all errors before moving on. Agent teams parallelize the feature work (5 teammates implementing simultaneously), but documentation updates remain sequential and manual: updating MASTER_BACKLOG Quick Stats, CHANGELOG, AGENTS.md file counts, ADRs, and cross-references. As the codebase grew from 0 to 508 tracked items across 79 waves, the documentation overhead per wave increased while the feature parallelism stayed constant. The tension: relaxing docs standards risks Tyler's trust in the single source of truth, but maintaining them creates a documentation tax that grows with every wave.
