---
description: Claude Code agents in ProtoPulse — 37 agent definitions across 17 directories, trigger patterns, memory configuration, and stack-alignment gaps
type: moc
topics:
  - "[[dev-infrastructure]]"
---

# infrastructure-agents

ProtoPulse has 37 Claude Code agent definitions — specialists summoned by the Agent tool. They are the domain-expert layer of the infrastructure, sitting between hooks (automatic) and skills (workflow recipes). Three agents have persistent project memory (oracle, eda-domain-reviewer, code-review-expert); the rest are stateless.

## Notes

- [[thirty-seven-agents-have-no-trigger-patterns]] -- agents cannot self-activate, must be manually invoked
- [[six-agents-cover-technologies-not-in-protopulse-stack]] -- kafka, loopback, nestjs, mongodb, jest, nextjs
- [[agent-definitions-total-twenty-thousand-lines]] -- context cost if loaded, but rarely referenced
- [[three-agents-have-persistent-project-memory]] -- oracle, eda-domain-reviewer, code-review-expert
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- memory + effort:high + GPT-5 fallback
- [[agent-teams-skill-is-the-mandated-parallel-execution-mechanism]] -- the only sanctioned parallel approach

---

Topics:
- [[dev-infrastructure]] — How the Claude Code infrastructure is configured, wired, and maintained -- hooks, skills, agents, MCP servers, and settings
