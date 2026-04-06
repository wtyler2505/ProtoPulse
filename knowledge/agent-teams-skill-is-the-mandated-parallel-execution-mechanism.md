---
description: The agent-teams skill is the only sanctioned approach for parallel implementation work -- background Agent subagents are explicitly forbidden for implementation tasks
type: decision
source: "CLAUDE.md guardrails, MEMORY.md agent team notes"
confidence: proven
topics: ["[[claude-code-skills]]", "[[dev-infrastructure]]"]
related_components: ["~/.claude/skills/agent-teams/SKILL.md"]
---

# agent teams skill is the mandated parallel execution mechanism

CLAUDE.md and MEMORY.md contain an explicit, non-negotiable rule: "ALWAYS use /agent-teams for ALL parallel implementation work. NEVER use background Agent subagents for implementation." This was a correction Tyler made after observing that background subagents were being used for implementation, which he considers inferior to the real agent-teams system.

The agent-teams skill provides in-process teammates with: Shift+Up/Down navigation between teammates, shared task lists visible via Ctrl+T, direct inter-agent messaging, and file ownership enforcement (two teammates NEVER edit the same file). The concurrency hard cap is 6 simultaneous agents or 8 total background tasks.

Background Agent subagents are restricted to read-only research and exploration tasks. The distinction matters because agent-teams teammates can coordinate -- they see each other's progress, avoid file conflicts via ownership rules, and can challenge each other's findings. Background subagents are fire-and-forget with no coordination.

This is reinforced by the plan template: every phase in an implementation plan must include "/agent-teams prompts per phase with file ownership + dependency ordering." Plans that don't specify team structure are incomplete.

---

Relevant Notes:
- [[writing-plans-must-precede-executing-plans-as-contract]] -- plans define agent team structure
- [[thirty-seven-agents-have-no-trigger-patterns]] -- agents are dispatched, not auto-triggered

Topics:
- [[claude-code-skills]]
- [[dev-infrastructure]]
