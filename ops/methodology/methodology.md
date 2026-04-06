---
description: Hub topic map for methodology notes -- how the knowledge system works and evolves
type: moc
---

# Methodology

How the ProtoPulse knowledge system works, why it works that way, and how it evolves.

## Notes

- [[derivation-rationale]] -- why these specific dimension positions were chosen

## Behavior

- [[enforce-hard-cap-on-concurrent-agents]] -- never exceed 6 agents / 8 background tasks simultaneously
- [[use-agent-teams-not-raw-parallel-subagents-for-implementation]] -- /agent-teams for all parallel implementation, not raw subagents
- [[run-standard-dev-commands-autonomously]] -- run db:push, check, test without asking permission

## Quality

- [[verify-wiki-links-before-completing-knowledge-work]] -- all [[links]] must resolve to real files before a task is done

## Principles

The system is built on four core principles:
1. **Prose-as-title**: Note titles are complete claims, not topic labels
2. **Wiki links as graph edges**: Every link is a deliberate connection
3. **Topic maps as attention managers**: Curated views, not folder hierarchies
4. **Capture fast, process slow**: Messy inbox, rigorous extraction

## Processing Cycle

Extract -> Connect -> Revisit -> Verify

Each phase has its own skill. The cycle isn't strictly linear --
you might extract and connect in the same session, or verify
something months after initial capture.
## Open Questions

- What's the right inbox pressure threshold for this project's pace?
- Should architecture decisions be auto-extracted from ADRs in docs/adr/?
- How often does the revisit pass actually surface useful updates?

---

Topics:
- [[index]]