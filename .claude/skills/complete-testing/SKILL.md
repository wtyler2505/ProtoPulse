---
name: complete-testing
description: >
  DEPRECATED - This skill has been consolidated into testing-mastery.
  Use testing-mastery instead for all testing tasks.
version: 999.0.0-deprecated
deprecated: true
deprecated-date: 2025-12-10
replacement: testing-mastery
---

# ⚠️ DEPRECATED - Use testing-mastery Instead

This skill has been consolidated into **testing-mastery** which provides:

- Four Iron Laws of testing
- Five-level testing framework (unit → soak)
- 5 comprehensive reference files
- Test quality requirements
- Mocking rules and best practices
- Nine common anti-patterns with fixes
- Coverage targets and enforcement
- Gate functions for test quality

## Migration

**Use this skill instead:**
```
~/.claude/skills/testing-mastery/SKILL.md
```

**Triggers that now work:**
- "test", "testing"
- "unit test", "integration test"
- "mock", "coverage"
- "edge case", "test failure"
- "flaky test"
- And 25+ more trigger phrases

## Why Consolidated?

The previous `complete-testing` and `testing-anti-patterns` skills had overlapping content. The new `testing-mastery` skill:

1. Combines all testing knowledge into one location
2. Uses progressive reference loading for efficiency
3. Includes comprehensive mocking best practices
4. Provides coverage targets and enforcement patterns

## Archive Location

The original skill is preserved at:
```
~/.claude/skills/.archive/complete-testing/
```
