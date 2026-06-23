---
name: comprehensive-documentation
description: Excellence-focused documentation ensuring every decision, pattern, and implementation detail is recorded for future understanding. Use BEFORE starting implementation, DURING development for decisions, AFTER completion for review. Triggers on "document", "ADR", "architecture decision", "README", "API docs", "decision log".
version: 1.2.0
allowed-tools: Read, Write, Edit
---

# Comprehensive Documentation

## Overview

Documentation with the excellence standard means capturing the complete context of WHY decisions were made, HOW systems work, and WHAT tradeoffs were considered. Future developers (including yourself) should understand the system as deeply as you do now.

**Core principle:** If it's not documented, it doesn't exist. If the reasoning isn't captured, the decision will be questioned and potentially reversed incorrectly.

## When NOT to Use

Do NOT use this skill when:
- **Throwaway prototype** → Code will be deleted, no docs needed
- **Trivial changes** → One-line fixes don't need ADRs
- **External docs exist** → Link, don't duplicate
- **Standard patterns** → "Using React hooks" doesn't need explanation

**But ALWAYS use when:**
- Making architectural decisions
- Creating new modules or systems
- Implementing non-obvious solutions
- Making tradeoff decisions

## Quick Reference - The 7 Levels

| Level | What | When | Reference |
|-------|------|------|-----------|
| 1. Inline | Code comments, doc strings | Every function | [level-1-inline.md](references/level-1-inline.md) |
| 2. Module | Module overview, patterns | Every module | [level-2-module.md](references/level-2-module.md) |
| 3. README | Quick start, structure | Every project | [level-3-readme.md](references/level-3-readme.md) |
| 4. Architecture | ADRs, system design | Major decisions | [level-4-architecture.md](references/level-4-architecture.md) |
| 5. API | Public API docs, changelog | Public interfaces | [level-5-api.md](references/level-5-api.md) |
| 6. Decision Log | All decisions chronologically | Ongoing | [level-6-decisions.md](references/level-6-decisions.md) |
| 7. Implementation | Notes during development | During work | [level-7-implementation.md](references/level-7-implementation.md) |

## Pre-Documentation Checklist

**BEFORE writing code, ensure you document:**
1. Problem being solved (context and requirements)
2. Design alternatives considered (with tradeoffs)
3. Decision made and reasoning
4. Architecture overview (components and relationships)
5. Success criteria (how we'll know it works)

**Red flags indicating insufficient planning:**
- Starting to code without written design
- Design only exists in chat history
- Alternatives not documented
- Tradeoffs not analyzed

## Level Summaries

### Level 1: Inline Documentation
Every public function has doc comment with examples. Complex logic explained with WHY. Magic numbers justified. Tricky code has TRICKY comment.

### Level 2: Module Documentation  
Module purpose in first paragraph. Architecture diagram. Key patterns with examples. Design decisions with alternatives.

### Level 3: README Documentation
Quick start with minimal steps. Project structure explained. Core concepts documented. Common troubleshooting.

### Level 4: Architecture (ADRs)
Status, context, decision drivers. Options considered with pros/cons. Consequences documented. Compliance mechanism specified.

### Level 5: API Documentation
Every public API with examples. Stability guarantees. Error conditions. Performance characteristics. Changelog maintained.

### Level 6: Decision Log
All significant decisions with context. Alternatives and tradeoffs. Testing results. Append-only (never delete).

### Level 7: Implementation Notes
Design approach during work. Problems encountered and solutions. Performance metrics. Files modified.

## Anti-Patterns

| Don't | Why Wrong |
|-------|-----------|
| Document after implementation | Memory fades, context lost |
| Doc without examples | Unusable by readers |
| Magic numbers without justification | Decisions get questioned |
| Missing design rationale | "Why does this work this way?" |
| "Code is self-documenting" | It isn't. Ever. |
| "I'll document later" | You won't |

## Completeness Checklist

Before claiming work complete:
- [ ] Every public function has doc comment with examples
- [ ] All complex logic explained with WHY
- [ ] Module purpose and architecture documented
- [ ] README with quick start and troubleshooting
- [ ] ADRs for significant decisions
- [ ] Decision log entries added
- [ ] Implementation notes captured

## Success Criteria

**You're documenting with excellence when:**
- Every decision has recorded reasoning
- Every pattern has usage examples
- Future developers can understand system deeply
- No "why does this work this way?" questions unanswered

**Excellence means: If the reasoning isn't documented, the work isn't complete.**

## Related Skills

- `writing-plans` - Implementation planning with bite-sized tasks
- `claude-md-mastery` - Project-level CLAUDE.md optimization
- `verification-before-completion` - Verify docs complete before done

## Changelog

- **1.2.0** (2025-12-06): Extracted 7 levels to references/ for progressive disclosure
- **1.1.0** (2025-01): Added "When NOT to Use" section, related skills
- **1.0.0** (2024-11): Initial comprehensive documentation framework
