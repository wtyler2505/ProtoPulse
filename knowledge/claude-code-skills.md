---
description: How 250+ Claude Code skills organize into workflows -- plugins, project skills, slash commands, mastery skills, thinking tools, and the gaps between them
type: moc
topics: []
---

# claude-code-skills

The Claude Code skill ecosystem powering ProtoPulse sessions. Skills are reusable instruction sets that Claude loads on demand, triggered by slash commands, plugin activation, or explicit invocation. Unlike hooks (automatic, fire on events) or agents (domain experts, manual dispatch), skills are workflow recipes -- they encode HOW to do something, not WHAT to check or WHO to ask.

The ecosystem has four layers, each with different ownership and update cadence.

## Layer 1: Plugin Skills (externally maintained)

Plugins inject skills that appear alongside native ones. 32 plugins from 8 marketplaces provide ~142 skill entry points, but fewer than 12 are actively used.

- [[superpowers-plugin-provides-the-core-development-lifecycle]] -- brainstorm, plan, execute, test, review, ship
- [[ars-contexta-plugin-provides-ten-knowledge-system-operations]] -- setup through health, the vault backbone
- [[context7-plugin-provides-real-time-library-docs-that-beat-stale-training-data]] -- compensates for stale training data on modern libs
- [[thirty-two-plugins-installed-but-fewer-than-twelve-actively-used-in-protopulse]] -- cognitive overhead of unused plugins
- [[plugin-marketplaces-fragment-across-eight-registries-with-no-unified-catalog]] -- update drift and duplication
- [[plugin-hooks-can-conflict-with-project-hooks-on-shared-events]] -- shared lifecycle event bus with no conflict detection
- [[three-separate-code-review-paths-create-routing-confusion]] -- requesting, receiving, and plugin code-review overlap
- [[four-overlapping-task-management-systems-fragment-attention]] -- /tasks, /next, /ralph, taskmaster plugin

## Layer 2: Mastery Skills (deep-dive expertise, globally installed)

19 mastery skills provide comprehensive domain knowledge for specific tools and practices.

- [[nineteen-mastery-skills-are-the-deepest-knowledge-layer]] -- from debugging to browser automation
- [[twelve-deprecated-skills-still-exist-alongside-their-replacements]] -- zombie skills inflate the skill count

## Layer 3: Project Skills (ProtoPulse-specific, in .claude/skills/)

23 project-level skills split heavily toward knowledge management over development.

- [[vault-skills-outnumber-project-skills-seven-to-one]] -- 20 vault vs 3 project
- [[extract-is-the-largest-skill-at-1128-lines]] -- processing pipeline entry point
- [[knowledge-pipeline-has-ten-skills-covering-the-full-lifecycle]] -- extract through verify, a complete methodology
- [[ship-and-verify-overlap-on-commit-validation-territory]] -- potential confusion on which to use

## Layer 4: Slash Commands (quick-action entry points)

46 global + 12 project commands provide direct invocation shortcuts, many wrapping skills.

- [[slash-commands-are-the-primary-user-interface-to-the-skill-system]] -- the actual invocation mechanism

## Thinking and Creativity Tools

A cluster of skills exists purely for structured reasoning -- not implementation.

- [[five-thinking-skills-provide-structured-reasoning-toolbox]] -- when-stuck dispatches to collision-zone, scale-game, inversion, meta-pattern
- [[when-stuck-is-a-meta-router-that-dispatches-to-specialized-techniques]] -- symptom-matching for problem types

## Agent Integration

Skills and agents are complementary -- skills encode process, agents provide expertise.

- [[agent-teams-skill-is-the-mandated-parallel-execution-mechanism]] -- non-negotiable for implementation work
- [[three-agents-have-persistent-project-memory]] -- oracle, eda-domain-reviewer, code-review-expert accumulate context
- [[oracle-agent-escalation-is-the-strongest-debugging-path]] -- memory + effort:high + GPT-5 fallback

## Workflow Chains

Some skills form explicit sequences. The most important chains:

1. **Development lifecycle**: brainstorm -> write-plan -> execute-plan -> verify -> ship
2. **Knowledge pipeline**: seed -> extract -> connect -> revisit -> verify
3. **Debugging escalation**: systematic-debugging -> when-stuck -> oracle
4. **Code review**: requesting-code-review -> code-review-expert agent -> receiving-code-review
5. **Spec workflow**: spec:create -> spec:validate -> spec:decompose -> spec:execute
6. **Infrastructure maintenance**: infra-audit.sh -> hook-debug -> hook-create/fix -> claude-md-improver

- [[the-full-quality-pipeline-is-brainstorm-plan-execute-test-review-verify-ship]] -- seven phases with stopping criteria
- [[the-knowledge-capture-pipeline-is-seed-extract-connect-revisit-verify]] -- five phases with distinct cognitive functions
- [[the-debugging-escalation-path-trades-speed-for-depth-across-four-levels]] -- four levels trading speed for depth
- [[infrastructure-maintenance-follows-audit-debug-create-improve-cycle]] -- reactive and proactive maintenance
- [[two-parallel-implementation-paths-exist-with-no-routing-guidance-between-them]] -- superpowers vs spec, no decision criteria
- [[writing-plans-must-precede-executing-plans-as-contract]] -- the plan is the contract
- [[extract-connect-revisit-verify-mirrors-academic-methodology]] -- reduce-reflect-reweave-verify

## Meta-Layer (routing, enforcement, and system coherence)

The meta-layer is the configuration that wires hooks, skills, agents, and MCP servers into a coherent system.

- [[skills-organize-in-three-tiers-project-plugin-and-system]] -- 23 project + 142 plugin + built-in = 215+
- [[the-skill-system-has-no-automatic-routing-the-agent-must-know-which-skill-to-invoke]] -- no middleware, all manual
- [[claude-md-is-the-routing-table-that-maps-situations-to-skills]] -- ~40 situations routed, ~160 unrouted
- [[hooks-enforce-rules-automatically-but-skills-require-explicit-invocation]] -- the enforcement gap
- [[the-meta-layer-connects-hooks-skills-agents-and-mcp-into-a-coherent-system]] -- settings.json + CLAUDE.md + .mcp.json
- [[context-compaction-erases-skill-routing-knowledge-causing-capability-amnesia]] -- long sessions lose skill associations

## Gaps

- [[no-skill-routes-to-performance-profiling-despite-agent-existing]] -- react-performance-expert is orphaned
- [[no-database-migration-skill-despite-drizzle-being-core]] -- drizzle push/pull has no workflow wrapper
- [[infrastructure-skills-exist-but-are-not-referenced-in-any-workflow]] -- hook-debug, hook-create, cmd-create are discoverable but invisible
- [[no-deployment-pipeline-skill-beyond-basic-ship]] -- /ship is git push, not CI/CD

## Audit

Run the infrastructure audit: `bash ops/queries/infra-audit.sh`
Count active skills: `ls ~/.claude/skills/ | wc -l` (global) + `ls .claude/skills/ | wc -l` (project)

---

Topics:
- [[index]]
- [[dev-infrastructure]]
- [[gaps-and-opportunities]]
