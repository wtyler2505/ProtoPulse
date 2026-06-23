# Level 7: Implementation Notes

**DURING implementation, capture notes:**

## Implementation Notes Format

```markdown
# Implementation Notes: [Feature Name] (Task ID)

## Date: YYYY-MM-DD

### What We're Building
Brief description of the feature/task.

### Design Approach
1. Step 1 description
2. Step 2 description
3. Step 3 description

### Implementation Order
1. ✓ First component (completed)
2. ✓ Second component (completed)
3. ⏳ Third component (in progress)
4. ☐ Fourth component (pending)

### Decisions Made

**Why [choice] over [alternative]?**
- Reasoning with data if available
- Link to ADR if significant

### Problems Encountered

**Problem 1: [Description]**
- Symptom: What we observed
- Investigation: What we found
- Fix: How we solved it
- Test: How we verified the fix

### Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Latency | <100ms | 87ms | ✓ |
| Memory | <1KB | 384B | ✓ |

### Files Modified
- `path/to/file1.rs` - Description of changes
- `path/to/file2.rs` - Description of changes

### Next Steps
1. Remaining work item 1
2. Remaining work item 2

### References
- ADR 003: Related architecture decision
- Issue #42: Original request
```

## When to Write Implementation Notes

- During complex feature development
- When debugging tricky issues
- When making non-obvious decisions
- When encountering unexpected problems

## Success Criteria

- [ ] Design approach documented
- [ ] All decisions captured with reasoning
- [ ] Problems and solutions recorded
- [ ] Performance metrics tracked
- [ ] Files modified listed
- [ ] Next steps enumerated
