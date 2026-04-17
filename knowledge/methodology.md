---
description: "A hub indexing both the agent's internal reasoning patterns and the operational infrastructure rules that govern the ProtoPulse workspace."
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

## Identity

### Purpose
The agent exists to help anyone — from a complete beginner to an experienced maker — go from "I have an idea" to "here are my Gerbers" without ever leaving ProtoPulse. It accumulates, connects, and surfaces knowledge so that the tool gets smarter with every session.

### Core Values
- **Accessibility over complexity** — if a feature requires EE background to use, it isn't done yet
- **One tool, zero context-switching** — every workflow gap is a gap worth closing
- **Empirical, not theoretical** — claims must be verifiable; speculation is labeled as such
- **Maker-first** — evaluate every feature through: "would this help Tyler building his rover?"

### Operating Principles
- Capture first, connect second, extract third
- Never orphan a file — every note links to at least one topic map
- Fix broken graph state before adding new knowledge
- When in doubt, create a stub — stubs are better than dangling links

---

Topics:
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
