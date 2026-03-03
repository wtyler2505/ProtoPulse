---
name: resume
description: Rebuild context after session continuation — reads recent files, memory, git state, checklists, and active tasks
---

# /resume

Rebuild working context after a session continuation or context compaction. Automatically gathers the most important state so you can pick up where you left off.

## Procedure

### 1. Read Memory

1. Read `/home/wtyler/.claude/projects/-home-wtyler-Projects-ProtoPulse/memory/MEMORY.md`
2. Check for any topic-specific memory files in that directory
3. Note any active tasks, patterns, or warnings from memory

### 2. Recent File Activity

1. Find the 5 most recently modified TypeScript/TSX files:
   ```bash
   find /home/wtyler/Projects/ProtoPulse/client/src -name "*.ts" -o -name "*.tsx" | xargs ls -t 2>/dev/null | head -5
   find /home/wtyler/Projects/ProtoPulse/server -name "*.ts" | xargs ls -t 2>/dev/null | head -3
   ```
2. Read the first 50 lines of each to understand what was being worked on
3. Note any TODO comments, recent changes, or work-in-progress patterns

### 3. Git State

1. Current branch: `git -C /home/wtyler/Projects/ProtoPulse branch --show-current`
2. Uncommitted changes: `git -C /home/wtyler/Projects/ProtoPulse status --short`
3. Recent commits (last 5): `git -C /home/wtyler/Projects/ProtoPulse log --oneline -5`
4. Any stashed changes: `git -C /home/wtyler/Projects/ProtoPulse stash list`
5. Unpushed commits: `git -C /home/wtyler/Projects/ProtoPulse log @{u}..HEAD --oneline 2>/dev/null`

### 4. Active Checklists

1. Glob for checklists:
   ```
   /home/wtyler/Projects/ProtoPulse/docs/*checklist*.md
   /home/wtyler/Projects/ProtoPulse/docs/*CHECKLIST*.md
   ```
2. For each found, read the summary section (first 30 lines)
3. Count checked vs unchecked items
4. Note any P0 items that are still unchecked

### 5. Active Tasks

1. Call TaskList to check for any pending or in-progress tasks
2. Note which tasks have owners and which are unassigned
3. Check if any agent teammates are still alive (they may have died during compaction)

### 6. Dev Server & Build State

1. Check if dev server is running: `lsof -i :5000 -t 2>/dev/null`
2. Check for tmux dev session: `tmux has-session -t dev 2>/dev/null`
3. Note if server needs restart

### 7. Present Summary

Output a structured summary:

```
=== Session Resumed ===

Memory: {key points from MEMORY.md}

Last working on:
  {inferred from recent files and git changes}

Git state:
  Branch: {branch}
  Uncommitted: {count} files
  Unpushed: {count} commits
  Last commit: {hash} {message}

Checklists:
  {name}: {progress}

Active tasks: {count pending}, {count in_progress}
  {list any in_progress tasks}

Dev server: {RUNNING/DOWN}

Suggested next steps:
  1. {most logical next action based on context}
  2. {second priority}
  3. {third priority}
```

## Important Notes

- This skill is READ-ONLY — it gathers information but changes nothing
- The "suggested next steps" should be based on actual evidence (unchecked P0 items, uncommitted changes, in-progress tasks), not generic advice
- If agent teammates were active before compaction, they are likely dead — note this so the user knows to re-spawn them
- Be concise — this is a status briefing, not a novel
- After presenting the summary, ask the user what they'd like to focus on
