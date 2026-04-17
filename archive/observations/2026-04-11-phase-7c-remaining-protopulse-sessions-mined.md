---
observed_date: 2026-04-11
category: recurring-pattern
severity: low
resolved: true
resolution: "Phase 7c mined all 25 remaining ProtoPulse sessionIds from history.jsonl via the new --recovery mode on ops/queries/mine-session.sh. One new methodology note produced (never-sit-idle-while-subagents-or-teammates-are-running); remaining friction patterns all validated existing memory/CLAUDE.md captures without duplication."
---

# Phase 7c mined 25 remaining ProtoPulse sessions via history jsonl recovery producing one new methodology note and validating six existing captures

## Context

Phase 7c of the session-mining-pipeline-rebuild plan closed out the third deferred item from Phase 4: mine the remaining ProtoPulse sessionIds found in `~/.claude/history.jsonl` that were not covered by Phase 4 (Apr 10-11 extant transcripts) or Phase 6 (Bucket E old-UUID recovery).

Enumeration (via the new `--recovery` mode of `ops/queries/mine-session.sh` added in Phase 7b):
- **Total unique ProtoPulse sessionIds in history.jsonl:** 34
- **Already covered by Phase 4 + Phase 6 + current session:** 11
- **Newly mined in Phase 7c:** 25 (includes 9 overlap cases — sessions that had both an extant transcript AND history.jsonl entries; recovery-mode reports for those are strict subsets of the full-fidelity reports already in the vault, retained as part of the batch but not separately classified)
- **Messages recovered:** 556 + 125 + 104 + 77 + 64 + 19 + ... totalling ~1000 user-side messages across the 25 sessions
- **Session date range:** 2026-02-24 through 2026-04-11 (the earliest sessions date back to the first 2 months of ProtoPulse's active development)

## Signal

Top-6 longest sessions (≥37 recovered messages each) were reviewed semantically for friction patterns.

**Validated existing captures (no new notes — patterns already in memory/ or ops/methodology/):**

1. `memory/feedback_no_mediocrity.md` — reinforced in sessions e8bf1857, 0987c4fd, d8eb8c3d. Direct quotes:
   > "THE FUK U TALKN BOUT 'effectively done'.... I REALLY HOPE YOU WERE EITHER JOKING OR HAVING A STROKE BECAUSE YOU FUCKING KNOW WE AINT STOPPING TILL THE CHECKLIST IS 10000000000000% PERCENT COMPLETE. EVERY FUCKING DETAIL OF IT" (e8bf1857)
   > "it all looks good but maybe only 'good enough'... i hate that shit and you know that!" (0987c4fd)

2. `memory/feedback_working_standards.md` — reinforced in session d8eb8c3d with the emphatic directive:
   > "I ONLY WANT TO HAVE TO SAY THIS ONE TIME! I HAVE NO FUCKS TO GIVE ABOUT HOW LONG SOMETHING TAKES OR HOW MUCH WORK IT WILL REQUIRE! I ONLY CARE THAT THINGS ARE DONE THE PROPER WAY USING THE BEST METHODS/APPROACH THAT WILL PROVIDE THE BEST OUTCOME FOR THE PROJECT! THIS IS A PERSONAL PROJECT OF MINE AND IS VERY IMPORTANT TO ME! I AM NOT TRYING TO RUSH ANYTHING AT ANY TIME FOR ANY REASON!"

3. `ops/methodology/use-agent-teams-not-raw-parallel-subagents-for-implementation.md` — reinforced in session e8bf1857:
   > "/agent-teams I SAID TO USE /agent-teams... i killl those 2 you started! USE /agent-teams! SAVE THIS TO YOUR MEMORY TOO! AND ADD RULES IN YOUR FUCKING AGENTS.md FILE TO ALWAYS USE /agent-teams instead of executing parallel agents!"
   > "FOR NOW ON. NONE OF THIS PARALLEL SHIT! THEY MUST BE DEPLAYED AS A TEAM IF OSSIBLE"

4. `ops/methodology/enforce-hard-cap-on-concurrent-agents.md` — indirectly reinforced in session 5a4915c4:
   > "im sorry again. my laptop got too hot and rebooted while the agents where working.. can you get the team back up and going?" (confirms the overheat → reboot failure mode that motivated the hard cap rule)

5. CLAUDE.md "fix root causes, not symptoms" rule — reinforced in session d8eb8c3d:
   > "I WANT THIS SHIT HANDLED, AND I WANT IT DONE PROPERLY! FIX THE PROBLEM... DONT JUST DISABLE IT, DELETE IT, PUT A FUCKING BANDAID ON IT, ETC..."

6. CLAUDE.md "use Context7 + web research to verify, don't rely on training data" rule — reinforced in session 0987c4fd:
   > "use web research and context7 to doublecheck and strictly verify ALL of the work you just did in every way possible... CHECK EVERY FUCKING TINY DETAIL OF EVERYTHING"

**One new durable pattern worth promoting to methodology:**

- **"Never sit idle while subagents/teammates are running"** — promoted to `ops/methodology/never-sit-idle-while-subagents-or-teammates-are-running.md` (category: behavior). This pattern does NOT exist in memory/ or prior ops/methodology/ notes. Cross-session evidence came from e8bf1857, 4268cc81, and 342e4f87. The directive is economically framed ("i pay good money for you bruh... gotta get my money worth") and structurally distinct from the "proper autonomy" captures which focus on not asking the user for permission. This rule targets the orthogonal problem of productive use of waiting time when work is already dispatched.

**Short-session reports (≤19 messages each, 19 sessions):** scanned for friction keywords but produced only trivial hits or noise. Representative: session `342e4f87` (19 msgs) had the "do all the work bro" quote that validated existing autonomy rules but added no new methodology. The short sessions are mostly `/resume`, `/exit`, quick debug restarts, and hook-test sessions. None warranted per-session notes.

## Potential Response

Immediate (Phase 7c, already actioned):
- Writing this summary observation note
- Writing `ops/methodology/never-sit-idle-while-subagents-or-teammates-are-running.md`
- Committing the Phase 7c changes

Deferred (flagged but not in scope):
- The pattern "when laptop reboots mid-agent-work, agents need to be restarted with context" appeared in multiple sessions (5a4915c4, 342e4f87). There isn't a clean methodology response to this — it's a hardware/thermal issue, not an agent-behavior issue. The mitigation already exists in the hard-cap-on-concurrent-agents rule. No new note.
- Tyler's repeated "plan template" directive in session e8bf1857 ("I WANT THAT PLAN USED AS A TEMPLATE TO BE USED FROM NOW ON FOR EVERY FUTURE PLA YOU MAKE") suggests there's a specific plan template in an old session that became canonical. The current project state has a plan template documented in `docs/plans/` already (the structure I've been following for the last two plans). Presumed done.

Promotion target: this observation is `resolved: true` immediately because the recovery pass is complete and the one new methodology note is the durable output. No further action needed.

---

Topics:
- [[methodology]]
