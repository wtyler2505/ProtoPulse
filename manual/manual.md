---
type: manual
generated_from: "arscontexta-1.0.0"
---

# ProtoPulse Knowledge System Manual

Welcome to the knowledge system for ProtoPulse development. This manual covers everything from first-time setup to advanced vault operations.

## Quick Start

New here? Start with [[getting-started]] -- it walks you through creating your first note and connecting it to the graph.

## Manual Pages

### [[getting-started]]
Your first 10 minutes with the vault. Create a note, link it, see it show up in a topic map.

### [[skills]]
Every skill (slash command) available for knowledge work. Extract, connect, revisit, verify, and more.

### [[workflows]]
Common multi-step workflows: processing a datasheet, capturing an architecture decision, running a full pipeline pass.

### [[configuration]]
Vault structure, config.yaml settings, hook configuration, feature flags.

### [[meta-skills]]
System-level operations: health checks, graph analysis, refactoring, reseeding.

### [[troubleshooting]]
When things go sideways -- orphaned notes, schema validation failures, hook errors, merge conflicts.

## Core Concepts

**Knowledge notes** live in `knowledge/` -- each one captures a single atomic claim, decision, concept, or pattern with structured frontmatter.

**Topic maps** are navigation hubs that curate related notes into coherent views -- like a table of contents for a domain area.

**The inbox** (`inbox/`) holds raw source material waiting to be extracted into knowledge notes.

**The processing cycle** -- extract, connect, revisit, verify -- keeps knowledge alive and connected rather than rotting in isolation.

## Domain Context

This vault serves ProtoPulse, an AI-assisted EDA platform for makers and hobbyists. The knowledge captured here spans:
- Electronics fundamentals and component behavior
- Circuit design patterns and PCB layout rules
- Software architecture decisions and trade-offs
- Competitive insights from tools like Fritzing, KiCad, Wokwi
- UX patterns that make complex tools accessible to beginners
- Technical debt and implementation patterns

---

Topics:
- [[index]]
