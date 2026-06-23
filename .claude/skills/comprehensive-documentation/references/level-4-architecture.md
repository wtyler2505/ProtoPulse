# Level 4: Architecture Documentation (ADRs)

**ALWAYS document architectural decisions:**

## ADR Template

```markdown
# ADR 001: [Decision Title]

## Status
Accepted (YYYY-MM-DD)

## Context
What is the issue we're facing? What forces are at play?

## Decision Drivers
- **Correctness**: Must work correctly
- **Simplicity**: Minimize complexity
- **Performance**: Meet requirements
- **Ergonomics**: Easy to use correctly

## Options Considered

### Option 1: [Name]
\`\`\`code
// Example implementation
\`\`\`

**Pros:**
- Pro 1
- Pro 2

**Cons:**
- Con 1
- Con 2

### Option 2: [Name] (CHOSEN)
...

## Decision
Chose **Option 2** because [rationale].

## Consequences

**Positive:**
- Benefit 1
- Benefit 2

**Negative:**
- Drawback 1 (with mitigation)

## Compliance
How is this decision enforced?
- Code structure
- Linting rules
- Review checklist

## Related Decisions
- ADR 002: Related decision
- ADR 003: Another related decision
```

## When to Create ADR

Create an ADR when a decision:
- Has architectural impact (structure, data, integration)
- Would be costly to reverse
- Will be questioned later by future developers

## ADR Best Practices

1. Store in repo: `/docs/architecture/adrs/`
2. Link ADRs to code and diagrams
3. Prefer many small ADRs over few large ones
4. Use status lifecycle: Proposed → Accepted → Superseded

## Success Criteria

- [ ] All significant decisions have ADRs
- [ ] Alternatives considered and documented
- [ ] Consequences (positive and negative) analyzed
- [ ] Compliance mechanism specified
- [ ] Related decisions linked
