---
description: When subagents, agent-teams teammates, or background tasks are running, do NOT sit idle waiting for them — identify independent work you can progress on in parallel and execute it while they finish
type: methodology
category: behavior
source: session-mining
session_source: e8bf1857-cfaf-41e7-8073-7dda8cc8b6c8 + 4268cc81-ba65-48f3-9569-8bec3bdbbf29
created: 2026-04-11
status: active
---

# Never sit idle while subagents or agent teams teammates are running find independent work and progress it in parallel

## What to Do

When you have spawned subagents (via the Agent tool with `run_in_background: true`) or teammates (via `/agent-teams`), and you are waiting for their results, **do not just wait**. Find work you can progress on that does not depend on their output and execute it in parallel. The waiting time is productive capacity — use it.

Concrete patterns:

1. **Check TodoWrite for independent tasks.** If there's a task in the todo list that doesn't depend on the currently-running subagent's output, start it.

2. **Do research or analysis work.** Read files, Grep for patterns, explore parts of the codebase the subagent isn't touching, fetch Context7 docs, run `/architect` queries — all are non-blocking.

3. **Draft the next phase.** If the subagent is Phase N, draft the Phase N+1 plan while you wait. When Phase N returns, you're already ready to execute Phase N+1.

4. **Review and improve work-in-progress.** If there's a plan file, observation note, or methodology note that could use another pass, do that pass while the subagent runs.

5. **Prepare infrastructure.** Make directories, touch placeholder files, clone repos, run `git status`, prepare commit messages — all the "non-critical path" work that would otherwise accumulate and slow down the next phase.

The rule: **at any given moment, if a subagent is running AND you are not producing output, you are wasting Tyler's paid compute capacity.** Find something.

## What to Avoid

1. **Do not simply announce "I'm waiting for the subagent to finish" and stop.** The announcement is useless — Tyler can see that a subagent is running. The waiting time has to produce value.

2. **Do not start speculative parallel work on the SAME task the subagent is working on.** That's the anti-pattern captured in `memory/feedback_no_stepping_on_teammates.md` — do not interfere with their file ownership.

3. **Do not dispatch yet-another subagent just to have more things running.** The hard cap on concurrent agents (`ops/methodology/enforce-hard-cap-on-concurrent-agents.md`) still applies. Use the existing waiting time better; do not compound it.

4. **Do not ask Tyler "what should I work on while waiting?"** That's exactly the handoff pattern Tyler has escalated about multiple times. Decide and execute. If the decision is wrong, he'll correct.

5. **Do not conflate "I have nothing left to do" with "the task is done."** The task is only done when the subagent has returned AND been reviewed AND the downstream work has landed. If you think you have nothing left to do, check: have you drafted the commit message? Have you updated the plan file? Have you verified the subagent's assumptions against the current codebase? Have you prepared a test case for the output you expect?

## Why This Matters

Observed across multiple historical sessions recovered via `history.jsonl` in Phase 7c of the session-mining-pipeline-rebuild plan:

**Session `e8bf1857-cfaf-41e7-8073-7dda8cc8b6c8` (March 4-11, 2026), direct quote:**
> "I WISH YOU WOULD HAVE EXECUTED THEM AS A TEAM * /agent-teams .... too fuckng late now.. is there now something YOU can be working on while those 4 agents are workng? why are you not doing anything right now? ffs!"

**Session `4268cc81-ba65-48f3-9569-8bec3bdbbf29` (Feb 28 - March 3, 2026), direct quote:**
> "what is taking that fucker so long?" (repeated 3x, escalating)
> "can you not be doing other shit while waiting for the fucking lizard?"

**Session `342e4f87-27e8-43f3-bd74-ca3fcc740a92` (Feb 24-27, 2026), direct quote:**
> "continue i want YOU to do all the work bro... duh! start the server. do whatever you gotta do. then use chromedevtools or claude in chrome to test the shit yourself. i pay good money for you bruh... gotta get my money worth"

The pattern: when Tyler has spawned agents and the main session is waiting, he expects the main session to ALSO be working. Idle time is friction — he's paying for it and he sees it as lost productivity. The "i pay good money for you bruh... gotta get my money worth" quote is explicit about the economic framing.

This is distinct from (and complements) the existing `ops/methodology/enforce-hard-cap-on-concurrent-agents.md` rule, which caps HOW MANY agents can run. This rule addresses WHAT the main session does while they run. Both can be true: limit the number, use the waiting time.

## Scope

Applies ALWAYS when:

1. You have spawned 1+ subagents or teammates that are still running, AND
2. The main session is not currently producing tool calls or text output, AND
3. There is any independent work you could progress on.

Does NOT apply when:

- You are genuinely blocked on the subagent's output (e.g., you need the subagent's research results before you can write the next plan section). In that case, clearly state the dependency in one sentence and wait — blocked is acceptable, idle is not.
- Tyler has explicitly said "just wait and review when they finish" — he occasionally wants that posture for specific review-centric workflows.
- The context budget is already overloaded and adding more work would trigger compaction. In that case, stop and wait — preserving context wins over grinding.

The bar is "am I producing value right now?" If no, find something. If you genuinely cannot find something, say so in one sentence — do not go silent.

---

Related: [[methodology]]
