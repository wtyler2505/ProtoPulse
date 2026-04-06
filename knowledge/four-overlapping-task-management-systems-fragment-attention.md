---
description: Four independent task management systems (/tasks, /next, /ralph, taskmaster plugin) compete for the same workflow space with no clear routing
type: insight
source: ".claude/skills/, plugin system prompt"
confidence: proven
topics: ["[[claude-code-skills]]", "[[gaps-and-opportunities]]"]
related_components: [".claude/skills/tasks/", ".claude/skills/next/", ".claude/skills/ralph/"]
---

# four overlapping task management systems fragment attention

Four systems manage "what to do next" with overlapping scope:

1. **/tasks**: View and manage the task stack and processing queue. Shows pending work, active tasks, completed items.
2. **/next**: Surface the most valuable next action by combining task stack, queue state, inbox pressure, health, and goals. A prioritization engine.
3. **/ralph**: Queue processing with fresh context per phase. Spawns isolated subagents to process N tasks from the queue.
4. **ralph-loop / ralph-wiggum plugins**: Start a persistent loop that continuously processes tasks in the current session. Two separate plugins (ralph-loop and ralph-wiggum) provide nearly identical cancel/help/loop commands.

The confusion: /tasks is a viewer, /next is a prioritizer, /ralph is a batch processor, and the ralph plugins are continuous processors. These are genuinely different tools, but their naming doesn't communicate their distinctions. A user asking "what should I work on" could invoke /tasks (see everything), /next (get AI recommendation), or /ralph (just start processing). The two ralph plugins (ralph-loop vs ralph-wiggum) are particularly confusing -- both offer `ralph-loop`, `cancel-ralph`, and `help` commands with different implementations.

---

Relevant Notes:
- [[three-separate-code-review-paths-create-routing-confusion]] -- same fragmentation pattern in code review
- [[knowledge-pipeline-has-ten-skills-covering-the-full-lifecycle]] -- contrast with the well-ordered pipeline

Topics:
- [[claude-code-skills]]
- [[gaps-and-opportunities]]
