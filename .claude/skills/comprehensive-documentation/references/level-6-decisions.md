# Level 6: Decision Log

**ALWAYS maintain decision log:**

## Decision Log Format

```markdown
# Decision Log

Record of all significant decisions made during development.
This log is append-only - never delete entries.

---

## YYYY-MM-DD: [Decision Title]

**Decision:** Brief statement of what was decided.

**Context:**
- Why this came up
- What problem we're solving

**Alternatives Considered:**
1. **Option A**: Description
   - Pro: ...
   - Con: ...
2. **Option B** (CHOSEN): Description
   - Pro: ...
   - Con: ...

**Tradeoffs:**
- **Pro**: Benefit of chosen approach
- **Con**: Drawback of chosen approach

**Testing Results:** (if applicable)
- Test 1: Result
- Test 2: Result

**Implementation:** `path/to/file.rs:23-45`

**Status:** Implemented / In Progress / Deferred

---
```

## What to Log

- Algorithm choices
- Library/framework selections
- Architecture patterns
- Performance tradeoffs
- Rejected alternatives (so they don't get re-proposed)

## Decision Log Best Practices

1. **Append-only**: Never delete entries
2. **Include context**: Why did this come up?
3. **Document alternatives**: What else was considered?
4. **Link to code**: Where is this implemented?
5. **Record testing**: What data supports this decision?

## Success Criteria

- [ ] Every significant decision documented
- [ ] Context and alternatives provided
- [ ] Tradeoffs analyzed
- [ ] Testing results included when available
- [ ] Implementation location referenced
