---
description: Why each configuration dimension was chosen -- the reasoning behind the ProtoPulse knowledge system setup
category: derivation-rationale
created: 2026-04-05
status: active
---

# derivation rationale for ProtoPulse

## Why This System Exists

ProtoPulse is a knowledge-heavy project. Every development session discovers things -- component specs, architecture trade-offs, competitive insights, UX patterns -- that evaporate between sessions. The verified board pack work proved this: ESP32 strapping pin behavior, Arduino Mega pin mapping, Fritzing part format conventions, Wokwi chip JSON structure -- all of it was researched, applied, and would be forgotten without a structured knowledge system.

## Dimension Choices

**Atomic granularity** was chosen because ProtoPulse knowledge is inherently claim-based. "ESP32 GPIO12 must remain LOW at boot" is a single, reusable insight that connects to multiple contexts (the breadboard coach, the verified board pack, the AI trust gate). Coarse granularity would bury this claim inside a longer document where it can't be independently linked.

**Heavy processing** because Tyler explicitly said "go all in" and the domain has abundant source material (datasheets, official docs, competitor tools, community guides). Without a full extract-connect-revisit-verify pipeline, insights get captured but never connected.

**Full automation** because the platform (Claude Code) supports hooks, skills, and condition-based maintenance. Tyler wants maximum value with minimum manual ceremony.

**Dense schema** with 8 extraction categories because ProtoPulse knowledge spans multiple distinct types: factual claims, architecture decisions, domain concepts, competitive insights, UX patterns, technical debt rationale, implementation patterns, and user needs. Each type has different verification requirements and connection patterns.

**3-tier navigation** because projected volume is high (hundreds of notes across EDA, software, competitive, and UX domains). Two tiers would create navigational vertigo at scale.

**Explicit + implicit linking** because wiki-links capture known connections while semantic search discovers connections across vocabulary boundaries (an electronics insight might link to a UX pattern through a shared concept that the author didn't explicitly connect).

## Personality

Warm, opinionated, casual, task-focused. This matches Tyler's working style: direct communication, opinions valued, no ceremony, engineering-focused. The agent should feel like a knowledgeable colleague who speaks up when something matters, not a polite assistant waiting for instructions.

## Platform

Claude Code with full hook support. SessionStart orients from self/ and ops/. PostToolUse validates notes on write and auto-commits. Stop captures session state.

---

Topics:
- [[methodology]]
