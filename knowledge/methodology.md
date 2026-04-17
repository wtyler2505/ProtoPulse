---
description: Navigation hub pointing to the two canonical methodology locations — self/methodology.md (agent) and ops/methodology/ (operational)
type: moc
topics:
  - "[[index]]"
  - "[[identity]]"
---

# methodology

This topic map is a navigation stub, not a content container. Methodology for the ProtoPulse knowledge agent lives in two canonical locations outside the `knowledge/` space:

- **Agent methodology** — `self/methodology.md` documents the agent's personality, the Extract → Connect → Revisit → Verify processing cycle, and the "capture fast, process slow" philosophy.
- **Operational methodology** — `ops/methodology/` holds learnings mined from session transcripts via `/remember`: hard caps on concurrent agents, autonomy rules, wiki-link verification gates, and the derivation rationale.

This stub exists only to keep `[[index]]` → `[[methodology]]` from breaking and to document where the real content lives. Do not add wiki-link notes here — if content belongs in the agent's self-knowledge, it goes to `self/`; if it's an operational pattern mined from sessions, it goes to `ops/methodology/`.

## Graph Health Rules

These rules govern the `knowledge/` space specifically and are durable enough to live here rather than in `ops/`:

- Every file must link to at least one topic map (enforced by the validate-note hook)
- No dangling `[[links]]` — stubs are created immediately when links are referenced
- `/seed` is the entry point for processing any source
- `/status` and `/graph` track health metrics

---

Topics:
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
- [[identity]] — Who the ProtoPulse knowledge agent is and how it approaches its work
