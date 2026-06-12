---
name: status
description: Project status dashboard + context rebuild (absorbs the old /resume). Shows ROADMAP/backlog headline, git state, TypeScript health (root + packages engine), dev server, and recent file activity; --resume additionally reads memory, .ref/project-dna.md, and the Codex lane. Use for "project status", "where are we", "what's the state of things" — and with --resume for "where was I", "resume", after a session continuation or context compaction.
---

# /status

One dashboard for "where are we" (default) and "where was I" (`--resume`). Read-only — it changes nothing.

## Arguments

- (none) — status dashboard (sections 1–6)
- `--resume` — everything above PLUS context rebuild (section 7): project DNA, memory, Codex lane check, recent-file deep read, suggested next steps. This replaces the old `/resume` skill.

## Procedure

### 1. Headline — roadmap / backlog (detect what exists)

1. If `/home/wtyler/Projects/ProtoPulse/ROADMAP.md` exists (canonical for status on the post-reset main):
   - `rg -n '^## ' ROADMAP.md` — report the first 🔨 (in-progress) milestone heading(s) as the headline, plus a count of ✅ / 🔨 / ⬜ stages.
2. If `/home/wtyler/Projects/ProtoPulse/docs/MASTER_BACKLOG.md` exists, also surface one line from its **Quick Stats** section (`rg -n -A 12 '^## Quick Stats' docs/MASTER_BACKLOG.md`).
3. If only one of the two exists, use that one alone. If neither exists: `Headline: no ROADMAP.md or MASTER_BACKLOG.md found.`

```
Headline:
  ROADMAP: v0.5 — The Bridge 🔨 (4 shipped, 2 in progress, 2 not started)
  Backlog: 508 tracked items (Quick Stats)
```

### 2. Git State

1. `git -C /home/wtyler/Projects/ProtoPulse status --short`
2. `git -C /home/wtyler/Projects/ProtoPulse branch --show-current`
3. `git -C /home/wtyler/Projects/ProtoPulse log --oneline -3`
4. Unpushed: `git -C /home/wtyler/Projects/ProtoPulse log @{u}..HEAD --oneline 2>/dev/null`
5. Stashes: `git -C /home/wtyler/Projects/ProtoPulse stash list`

```
Git:
  Branch: main
  Uncommitted: 5 modified, 2 untracked
  Unpushed: 3 commits ahead of origin/main
  Recent: abc1234 Fix contrast ratio in sidebar | def5678 ... | ghi9012 ...
```

### 3. TypeScript Health (root + engine)

1. Root app: `npm run check` — pass/fail. Warn the user first: takes ~30–40 s.
2. Engine: `npm run check:packages` (`tsc -p packages` — the `@protopulse/*` workspace monorepo) — pass/fail.
3. Workspace count: `jq -r '.workspaces[]' /home/wtyler/Projects/ProtoPulse/package.json` (globs `packages/*` + `tools/golden`), then `ls -d /home/wtyler/Projects/ProtoPulse/packages/*/ | wc -l` for the live package count.

```
TypeScript (root):   PASS (0 errors)
TypeScript (engine): PASS — check:packages, 16 packages + tools/golden
```

### 4. Dev Server Status

1. Check if port 5000 is in use: `lsof -i :5000 -t 2>/dev/null`
2. If running, health check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000`
3. Check for tmux dev session: `tmux has-session -t dev 2>/dev/null`

```
Dev server: RUNNING (port 5000, HTTP 200, tmux session "dev")
```

### 5. Recent File Activity

Scan client, server, AND the packages engine. The `-o` predicates MUST be parenthesized or `find` mis-groups them:

```bash
find /home/wtyler/Projects/ProtoPulse/client/src \( -name "*.ts" -o -name "*.tsx" \) | xargs ls -t 2>/dev/null | head -5
find /home/wtyler/Projects/ProtoPulse/server \( -name "*.ts" \) | xargs ls -t 2>/dev/null | head -3
find /home/wtyler/Projects/ProtoPulse/packages -path "*/src/*" \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/dist/*" | xargs ls -t 2>/dev/null | head -5
```

List the top hits with mtimes. (Deep-reading them is `--resume`-only — see section 7.)

### 6. Active Agent Teams

1. Check TaskList for tasks with assigned owners; check for live teammates in this session.
2. Display `Agent teams: N active (...)` or `Agent teams: none active`.

### 7. `--resume` mode — context rebuild (additional)

0. **Read `.ref/project-dna.md` FIRST** (project rule: orientation before any "current state" claims). Pull in `.ref/project-map.md` if structural detail is needed.
1. **Memory**: read `/home/wtyler/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/MEMORY.md`, plus any topic-specific memory files in that directory that match the work at hand. Note active tasks, patterns, warnings.
2. **Codex lane check**: if `/home/wtyler/Projects/ProtoPulse/CODEX_HANDOFF.md` exists, read its Lane Reservation header — active channels, claimed files, forbidden files. Do NOT plan work inside Codex's claimed lane.
3. **Recent-file deep read**: read the first 50 lines of each top file from section 5 to infer what was in progress (TODOs, half-finished edits, work-in-progress patterns).
4. **Active tasks**: TaskList for pending/in-progress; note that agent teammates active before a compaction are likely dead and need re-spawning.
5. **Suggested next steps** — evidence-based only (failing checks, unpushed commits, in-progress tasks, the ROADMAP's 🔨 milestone), never generic advice. Then ask Tyler what to focus on.

## Output Format

```
=== ProtoPulse Status ===

Headline:
  {ROADMAP 🔨 milestone / Backlog Quick Stats}

Git:
  {git info}

TypeScript (root):   {PASS/FAIL}
TypeScript (engine): {PASS/FAIL — N packages}

Dev server: {RUNNING/DOWN}

Recent files:
  {top hits across client/src, server, packages/*/src}

Agent teams: {info}

[--resume only]
Memory: {key points}
Codex lane: {claimed/forbidden files, or "no CODEX_HANDOFF.md"}
Last working on: {inferred}
Suggested next steps:
  1. {...}  2. {...}  3. {...}
```

## Notes

- Read-only operation — it changes nothing.
- Keep output concise — no verbose explanations.
- If any check fails to run (e.g., git not available), skip it with a note.
- The TypeScript checks may take ~30–40 seconds combined — warn the user when running them.
