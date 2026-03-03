---
name: status
description: Show project status — checklist progress, git state, agent teams, and dev server health
---

# /status

Quick project status dashboard. Shows checklist progress, git state, active agents, and dev server health.

## Procedure

### 1. Checklist Progress

1. Glob for active checklists:
   ```
   /home/wtyler/Projects/ProtoPulse/docs/*checklist*.md
   /home/wtyler/Projects/ProtoPulse/docs/*CHECKLIST*.md
   /home/wtyler/Projects/ProtoPulse/docs/*audit*.md
   ```
2. For each checklist found:
   - Count `- [x]` lines (completed)
   - Count `- [ ]` lines (remaining)
   - Calculate percentage
   - Count by priority if P0-P3 sections exist
3. Display:
   ```
   Checklists:
     visual-audit-checklist.md: 45/107 (42%) — P0: 0 remaining, P1: 12, P2: 30, P3: 20
     frontend-audit-checklist.md: 89/113 (79%)
   ```
4. If no checklists found, display: `No active checklists found.`

### 2. Git Status

1. Run `git -C /home/wtyler/Projects/ProtoPulse status --short`
2. Run `git -C /home/wtyler/Projects/ProtoPulse branch --show-current`
3. Run `git -C /home/wtyler/Projects/ProtoPulse log --oneline -3`
4. Check for unpushed commits: `git -C /home/wtyler/Projects/ProtoPulse log @{u}..HEAD --oneline 2>/dev/null`
5. Display:
   ```
   Git:
     Branch: main
     Uncommitted: 5 modified, 2 untracked
     Unpushed: 3 commits ahead of origin/main
     Recent commits:
       abc1234 Fix contrast ratio in sidebar
       def5678 Add touch target sizing to buttons
       ghi9012 Update BOM table hover states
   ```

### 3. TypeScript Health

1. Run a quick `npm run check` in the background or check for recent results
2. Display pass/fail:
   ```
   TypeScript: PASS (0 errors)
   ```
   or
   ```
   TypeScript: FAIL (12 errors in 4 files)
   ```

### 4. Dev Server Status

1. Check if port 5000 is in use: `lsof -i :5000 -t 2>/dev/null`
2. If running, health check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000`
3. Check for tmux dev session: `tmux has-session -t dev 2>/dev/null`
4. Display:
   ```
   Dev server: RUNNING (port 5000, HTTP 200, tmux session "dev")
   ```
   or
   ```
   Dev server: DOWN (port 5000 not in use)
   ```

### 5. Active Agent Teams

1. Check if any agent teammates are currently active in this session
2. If the TaskList tool shows tasks with assigned owners, report them
3. Display:
   ```
   Agent teams: 2 active
     views-agent: fixing VA-001, VA-005 (in_progress)
     sidebar-agent: fixing VA-012 (in_progress)
   ```
   or
   ```
   Agent teams: none active
   ```

## Output Format

Present everything in a clean, scannable format:

```
=== ProtoPulse Status ===

Checklists:
  {checklist info}

Git:
  {git info}

TypeScript: {PASS/FAIL}

Dev server: {RUNNING/DOWN}

Agent teams: {info}
```

## Notes

- This is a read-only operation — it changes nothing
- Keep output concise — no verbose explanations
- If any check fails to run (e.g., git not available), skip it with a note
- The TypeScript check may take ~30-40 seconds — warn the user if running it
