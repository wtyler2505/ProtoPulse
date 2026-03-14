# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting key technical decisions in ProtoPulse.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-express-over-nextjs.md) | Express 5 over Next.js | Accepted |
| [0002](0002-react-query-over-redux.md) | TanStack React Query over Redux/Zustand | Accepted |
| [0003](0003-dual-ai-providers.md) | Dual AI Providers (Claude + Gemini) | Accepted |
| [0004](0004-drizzle-orm.md) | Drizzle ORM with Zod Schema Integration | Accepted |
| [0005](0005-shadcn-ui-dark-theme.md) | shadcn/ui with Dark Neon Cyan Theme | Accepted |
| [006](006-delete-policy.md) | Soft-Delete vs Hard-Delete Policy | Accepted |
| [0007](0007-firmware-runtime-architecture.md) | Firmware Runtime Architecture — Pure-Local Native Execution | Accepted |
| [0008](0008-multi-platform-scope.md) | Multi-Platform Embedded Scope — Beyond Arduino | Accepted |

## Template

New ADRs should follow this structure:

```markdown
# ADR-NNNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded
**Date:** YYYY-MM-DD
**Deciders:** Names

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Rationale
Why is this the best choice among alternatives?

## Consequences
What becomes easier or harder because of this change?
```
