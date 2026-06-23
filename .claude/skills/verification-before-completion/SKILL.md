---
name: verification-before-completion
description: >
  DEPRECATED - This skill has been consolidated into verification-mastery.
  Use verification-mastery instead for all verification-related tasks.
version: 999.0.0-deprecated
deprecated: true
deprecated-date: 2025-12-10
replacement: verification-mastery
---

# ⚠️ DEPRECATED - Use verification-mastery Instead

This skill has been consolidated into **verification-mastery** which provides:

- Complete verification lifecycle (iron law + 5 levels)
- 6 comprehensive reference files
- Bug fix red-green verification
- Pre-commit checklists
- Agent delegation verification
- Performance verification
- CI/CD integration

## Migration

**Use this skill instead:**
```
~/.claude/skills/verification-mastery/SKILL.md
```

**Triggers that now work:**
- "done", "complete", "fixed", "passing"
- "ready to commit", "ready for PR"
- "all tests pass", "build succeeds"
- "verification report", "evidence"
- And 30+ more trigger phrases

## Why Consolidated?

The previous `thorough-verification` and `verification-before-completion` skills had overlapping content. The new `verification-mastery` skill:

1. Combines iron law with 5-level framework
2. Uses progressive reference loading for efficiency
3. Provides language-specific examples
4. Includes comprehensive evidence templates

## Archive Location

The original skill is preserved at:
```
~/.claude/skills/.archive/verification-before-completion/
```
