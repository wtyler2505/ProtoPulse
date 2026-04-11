---
description: When a Claude Code transcript has been deleted by retention cleanup, partial recovery is possible by extracting user-side messages from ~/.claude/history.jsonl keyed by sessionId
type: methodology
category: maintenance
source: session-mining
session_source: 0364162b-c4cd-499d-a08e-5d700252e6bb + partial-recovery-pass-2026-04-11
created: 2026-04-11
status: active
---

# Recover user-side session messages from history jsonl when the full transcript was deleted by Claude Code retention

## What to Do

When a session transcript at `~/.claude/projects/<slug>/<uuid>.jsonl` has been deleted by Claude Code retention cleanup (the typical window appears to be ~2-3 days of inactivity for older sessions), the conversation is NOT fully unrecoverable. `~/.claude/history.jsonl` stores every user prompt indexed by `sessionId`. It can be used as a partial recovery vector for friction mining.

The working pattern:

```bash
# 1. Extract all user prompts for a target session
grep '"sessionId":"<uuid>"' ~/.claude/history.jsonl | \
  jq -r '.display' > /tmp/recovered-<uuid>.txt

# 2. Scan for friction signals (mirrors ops/queries/mine-session.sh taxonomy)
grep -iE "(^|[^a-z])(no,?|wrong|stop|don't|never|incorrect|actually|fuck|shit|absolutely|mandatory|must)([^a-z]|$)" /tmp/recovered-<uuid>.txt

# 3. Review hits semantically and write observation/methodology notes for
#    genuine friction patterns. Discard false positives.
```

Important nuances:

- **Use grep, not streaming jq.** `jq -r 'select(.sessionId == "...")' ~/.claude/history.jsonl` silently returns zero results when the file contains any malformed JSON lines (observed: 119 parse errors in a 9664-line file). Pre-filter with `grep '"sessionId":"<uuid>"'` to get only the candidate lines, then pipe through `jq -r '.display'` for clean extraction.
- **Recovery is partial, not total.** You get the user half of the conversation — every message typed or pasted, with pastedContents inlined. You do NOT get assistant responses, tool calls, tool results, or inline file content that Claude read. For friction mining this is usually enough because most friction signals (corrections, redirections, escalations, directives) originate on the user side.
- **Message counts vary wildly per session.** In the 2026-04-11 Bucket E recovery pass: 10 target UUIDs yielded counts of 135, 172, 30, 0, 6, 0, 78, 63, 1, 1. Two sessions had zero recoverable messages (3aa5de23, 4335d89e) — those UUIDs apparently never had corresponding history.jsonl entries, possibly because they were very short or errored out.
- **The `.project` field in history.jsonl narrows by project** when `sessionId` alone isn't specific enough across different repos.

## What to Avoid

1. **Do not assume transcripts are permanently lost** after Claude Code retention cleanup runs. Always check history.jsonl first.

2. **Do not restore recovered files to `~/.claude/projects/<slug>/`** — they are not full transcripts and would confuse Claude Code's session management. Work with them in `/tmp/` only.

3. **Do not fall back to destructive filesystem recovery** (`extundelete`, `photorec`) until history.jsonl has been checked. It's a much simpler and higher-success path.

4. **Do not rely on Timeshift snapshots** for transcript recovery on systems where `/home/<user>/**` is in the exclude list. On Linux Mint's Timeshift default config, ALL of `/home/wtyler/**` is excluded (confirmed via `cat /timeshift/snapshots/<date>/exclude.list`). Timeshift backs up system files, not user data.

5. **Do not stream-parse the entire history.jsonl** with `jq` expecting filters to work. The file has corruption from partial writes or malformed entries; streaming jq queries return zero matches when any line parse fails. Grep-then-jq is the reliable pattern.

## Why This Matters

Observed during the session-mining pipeline rebuild (`docs/plans/2026-04-11-session-mining-pipeline-rebuild.md`) while auditing the 10 "Bucket E" stubs — old-format session captures from March 2026 with valid UUIDs whose transcripts had already been deleted by retention. Initial analysis assumed they were unrecoverable ("the transcripts are gone"). A deeper dig revealed that `~/.claude/history.jsonl` contained 405 entries matching those 10 UUIDs, yielding 486 recovered user messages across 8 of the 10 sessions.

The recovered messages contained strong friction signals that validated three existing memory-space user-preference files:
- `memory/feedback_no_mediocrity.md` — traced to session c5fc7f99 (2026-03-23), direct quote recovered: "Never do just enough to be able to say something is done. NOTHING IS DONE UNTIL THERE IS NOTHING LEFT THAT CAN BE DONE!"
- `memory/feedback_autonomous_waves.md` — traced to session c5fc7f99 and c3aee506, with explicit escalation about unauthorized stopping
- `memory/feedback_no_stepping_on_teammates.md` — traced to session c3aee506, direct quote: "the validation-decomp agent is working on shit... what are you ding?" (repeated 7 times escalating to profanity)
- `memory/enforce-hard-cap-on-concurrent-agents.md` (and its ops/methodology sibling) — traced to session c5fc7f99, direct quote: "Can't start 12 fucking agents at the same time... hard cap at 8 background tasks | 6 agents"

These recoveries prove the memory system captured real operational learning. They also prove history.jsonl is a durable recovery vector that should be part of the standard session-mining pipeline going forward.

Cost of NOT using this technique: the 10 Bucket E stubs would have been terminally marked `transcript-unavailable` and 486 messages of user-side friction would have stayed unmined forever.

## Scope

Applies ALWAYS when:

1. A session transcript at `~/.claude/projects/<slug>/<uuid>.jsonl` is missing or has been deleted, AND
2. The session happened on this machine (history.jsonl is per-user, not synced), AND
3. The goal is friction mining OR user-prompt archaeology (recovering what was asked, not what was done).

Does NOT apply when:

- Full transcript reconstruction is needed (assistant responses, tool calls). history.jsonl does not contain those.
- The session happened on a different machine. History.jsonl is local.
- The session is within retention and the transcript still exists. Read the .jsonl directly.
- The file `~/.claude/history.jsonl` is itself missing, corrupt past repair, or has been rotated out.

The recovery is a supplement to the normal mining pipeline, not a replacement. The `ops/queries/mine-session.sh` runner reads real `.jsonl` transcripts for full-fidelity mining; this recovery pattern is for when that file no longer exists.

---

Related: [[methodology]]
