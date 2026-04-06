---
description: Current active threads, priorities, and open questions in ProtoPulse development
type: moc
topics:
  - "[[index]]"
  - "[[identity]]"
  - "[[architecture-decisions]]"
---

# goals

Active threads, current priorities, and open questions. This map is updated each session as work progresses.

## Active Priorities

### Graph Health (immediate)
- Resolve all dangling [[links]] in knowledge/index.md — 8 stubs needed
- Mine unprocessed session files in ops/sessions/

### Development Backlog
- See `docs/MASTER_BACKLOG.md` for the single source of truth (493 items: 321 open, 172 done)
- Current phase: Wave 50 complete (Circuit Design as Code). Waves 51+ planned.
- 3 items remaining at P2: IN-23, IN-24, IN-26 (moonshots)

### Knowledge Vault
- Populate [[eda-fundamentals]] with verified component specs and protocol notes
- Populate [[architecture-decisions]] from existing ADRs in `docs/adr/`
- Populate [[competitive-landscape]] from product analysis reports

## Open Questions
- What is the next highest-value Wave after IN-25?
- How does the vault grow as ProtoPulse gains more capabilities?

## Recently Completed
- Wave 50: Circuit Design as Code (IN-25) — 30 files, +6756 lines, 215 tests
- Wave A-E: Security hardening (IDOR guards, CORS, XSS, session resilience)
- PCB layout engine (FG-01) complete through Phase 5

---

Topics:
- [[index]]
- [[identity]]
- [[architecture-decisions]]
