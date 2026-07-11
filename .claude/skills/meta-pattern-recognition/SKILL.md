---
name: meta-pattern-recognition
description: Spot patterns appearing in 3+ domains to find universal principles. Use when noticing the same pattern across 3+ different domains or experiencing déjà vu in problem-solving. Triggers on "pattern recognition", "universal principles", "cross-domain patterns", "recurring themes", "abstract patterns".
version: 1.2.0
allowed-tools: Read
---

# Meta-Pattern Recognition

## Overview

When the same pattern appears in 3+ domains, it's probably a universal principle worth extracting.

**Core principle:** Find patterns in how patterns emerge.

## Quick Reference

| Pattern Appears In | Abstract Form | Where Else? |
|-------------------|---------------|-------------|
| CPU/DB/HTTP/DNS caching | Store frequently-accessed data closer | LLM prompt caching, CDN |
| Layering (network/storage/compute) | Separate concerns into abstraction levels | Architecture, organization |
| Queuing (message/task/request) | Decouple producer from consumer with buffer | Event systems, async processing |
| Pooling (connection/thread/object) | Reuse expensive resources | Memory management, resource governance |

## Process

1. **Spot repetition** - See same shape in 3+ places
2. **Extract abstract form** - Describe independent of any domain
3. **Identify variations** - How does it adapt per domain?
4. **Check applicability** - Where else might this help?

## Example

**Pattern spotted:** Rate limiting in API throttling, traffic shaping, circuit breakers, admission control

**Abstract form:** Bound resource consumption to prevent exhaustion

**Variation points:** What resource, what limit, what happens when exceeded

**New application:** LLM token budgets (same pattern - prevent context window exhaustion)

## When NOT to Use

Do NOT use this skill when:
- **Domain is truly novel** → Some problems are genuinely new
- **Pattern-matching slows you down** → Sometimes just build the thing
- **Premature abstraction risk** → Wait for 3+ concrete cases
- **Need specific solution** → Patterns are starting points, not answers

## Red Flags You're Missing Meta-Patterns

- "This problem is unique" (probably not)
- Multiple teams independently solving "different" problems identically
- Reinventing wheels across domains
- "Haven't we done something like this?" (yes, find it)

## Remember

- 3+ domains = likely universal
- Abstract form reveals new applications
- Variations show adaptation points
- Universal patterns are battle-tested

## Related Skills

- `simplification-cascades` - Apply after recognizing patterns
- `collision-zone-thinking` - When patterns aren't enough
- `when-stuck` - Dispatch to right technique

## Changelog

- v1.2.0 (2025-01): Added "When NOT to Use" section, related skills
- v1.1.0 (2024-12): Added quick reference table, examples
- v1.0.0 (2024-11): Initial meta-pattern recognition guide
