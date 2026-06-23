---
name: architecture
description: Software architecture design using C4 model, ADRs, and modern patterns. Use when designing systems, documenting architecture decisions, creating architecture diagrams, or evaluating architectural trade-offs. Triggers on "architecture", "system design", "C4 diagram", "ADR", "architecture decision", "hexagonal", "microservices design", "component diagram".
version: 1.1.0
allowed-tools: Read, Write, Edit, mcp__clear-thought__sequentialthinking, mcp__clear-thought__decisionframework, mcp__memory__create_entities, mcp__memory__create_relations, TodoWrite
---

# Architecture

## Overview

Design software systems using modern architecture patterns, C4 diagrams for visualization, and Architecture Decision Records (ADRs) for governance. This skill provides structured approaches to architectural thinking, trade-off analysis, and decision documentation.

## Quick Reference

| Task | Approach |
|------|----------|
| New system design | Start with C4 Context → Container → Component |
| Document decision | Create ADR with context, decision, consequences |
| Evaluate patterns | Use trade-off matrix (complexity vs flexibility vs performance) |
| Review architecture | Walk C4 levels, check ADR currency |

## When to Use

- **Use when:** Designing new systems, documenting major decisions, evaluating architectural alternatives, creating technical documentation, onboarding developers to system structure

## When NOT to Use

Do NOT use this skill when:
- **Small code changes** → No architectural impact, just edit the code
- **Debugging specific issues** → Use `systematic-debugging` instead
- **Quick feature additions** → Only if no structural changes needed
- **Already documented** → Check existing ADRs before creating new ones

## C4 Model

The C4 model provides four levels of abstraction for architecture diagrams:

### Level 1: System Context
Shows the system and its relationships with users and external systems.

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   User      │────▶│   Your System   │────▶│ External API│
└─────────────┘     └─────────────────┘     └─────────────┘
```

### Level 2: Container
Shows high-level technology choices: applications, databases, message queues.

```
┌────────────────────────────────────────────────────┐
│                    Your System                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Web App  │  │   API    │  │    Database      │  │
│  │ (React)  │─▶│ (Node)   │─▶│  (PostgreSQL)    │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────┘
```

### Level 3: Component
Shows internal structure of a container (modules, services, adapters).

### Level 4: Code (Optional)
UML or similar for critical/complex areas only.

## Architecture Decision Records (ADRs)

### ADR Template

```markdown
# ADR-XXXX: [Title]

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-YYYY
**Date:** YYYY-MM-DD
**Deciders:** [names]

## Context
What is the issue we're facing? What forces are at play?

## Decision
What is our decision and why?

## Consequences
What are the positive and negative outcomes?

## Alternatives Considered
What other options did we evaluate?
```

### When to Create an ADR

Create an ADR when a decision:
- Has architectural impact (structure, data, integration, cross-cutting)
- Would be costly to reverse
- Will be questioned later by future developers

### ADR Best Practices

1. Store in repo: `/docs/architecture/adrs/`
2. Link ADRs to C4 diagrams
3. Prefer many small ADRs over few large ones
4. Use status lifecycle: Proposed → Accepted → Superseded

## Modern Architecture Patterns

### Default: Hexagonal/Clean Architecture
- Isolates business logic from frameworks and infrastructure
- Ports define interfaces, adapters implement them
- Good default for most systems

### When to Use Microservices
Only when you need:
- Independent scaling per service
- Different technology stacks per service
- Independent deployment and team ownership
- Clear bounded context boundaries

### Event-Driven Architecture
Use for:
- Loose coupling between services
- Async workflows
- Audit trails and event sourcing
- High scalability requirements

## Trade-off Analysis Framework

When evaluating architectural options:

| Dimension | Questions |
|-----------|-----------|
| Complexity | How hard to understand, build, operate? |
| Flexibility | How easy to change later? |
| Performance | Latency, throughput, resource usage? |
| Reliability | Failure modes, recovery, data durability? |
| Cost | Infrastructure, development, operational? |
| Security | Attack surface, compliance, data protection? |

## Architecture Review Checklist

- [ ] C4 Context diagram exists and is current
- [ ] C4 Container diagram shows technology choices
- [ ] Key decisions have ADRs
- [ ] ADRs link to relevant diagrams
- [ ] Non-functional requirements documented
- [ ] Security boundaries identified
- [ ] Data flow documented
- [ ] Failure modes analyzed

## Project Structure

```
/docs/architecture/
├── c4-system-context.md
├── c4-containers.md
├── c4-components-[service].md
└── adrs/
    ├── adr-0001-architecture-principles.md
    ├── adr-0002-choose-hexagonal.md
    └── adr-0003-event-driven-communication.md
```

## Error Handling

**If architecture seems overcomplicated:**
- Apply YAGNI - remove speculative complexity
- Check if microservices could be a modular monolith
- Review ADRs for decisions that no longer apply

**If unclear where to start:**
- Begin with C4 Level 1 (Context)
- Identify external systems and users first
- Work inward to containers and components

## Related Skills

- `comprehensive-documentation` - Full documentation levels
- `writing-plans` - Implementation planning after architecture
- `research-and-development` - Exploring technology options

## Changelog

- **1.1.0** (2025-12-06): Added formal When NOT to Use section
- **1.0.0** (2024-12-06): Initial version with C4, ADRs, patterns
