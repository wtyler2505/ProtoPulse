---
description: Agent definitions for Kafka, LoopBack, NestJS, MongoDB, Jest, and Next.js exist but none of these technologies are used in ProtoPulse
type: claim
source: ".claude/agents/"
confidence: proven
topics: ["[[dev-infrastructure]]"]
related_components: [".claude/agents/kafka/", ".claude/agents/loopback/", ".claude/agents/nestjs-expert.md", ".claude/agents/database/database-mongodb-expert.md", ".claude/agents/testing/jest-testing-expert.md", ".claude/agents/framework/framework-nextjs-expert.md"]
---

# six agents cover technologies not in ProtoPulse stack

ProtoPulse uses Express 5 (not NestJS/LoopBack), PostgreSQL (not MongoDB), Vitest (not Jest), React+Vite (not Next.js), and no message queuing (not Kafka). Yet agent definitions exist for all these unused technologies, totaling approximately 4,400 lines of agent instructions that will never be relevant in this codebase.

These agents were likely installed as part of a generic agent pack or carried over from another project. They are not harmful when dormant -- they only consume disk space, not context tokens. But they add noise to the agents directory listing and could cause confusion if accidentally invoked (e.g., the Jest expert advising on Vitest test patterns).

The webpack agent is borderline -- ProtoPulse uses Vite, but the webpack-expert could theoretically provide general bundler knowledge. Similarly, the docker-expert and github-actions-expert are relevant for future CI/CD even though they are not actively used.

---

Relevant Notes:
- [[thirty-seven-agents-have-no-trigger-patterns]] -- no auto-selection means no auto-exclusion
- [[agent-definitions-total-twenty-thousand-lines]] -- the full size inventory

Topics:
- [[dev-infrastructure]]
