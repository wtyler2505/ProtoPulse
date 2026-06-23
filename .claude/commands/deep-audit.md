---
description: Master audit orchestrator - code, UI, security, performance, integrations - with parallel agents and persistent reporting
argument-hint: [target-directory-or-url] (defaults to current directory)
---

# EXTREME Deep Audit - Master Orchestrator

**Description**: Comprehensive project audit using ALL available tools - browser MCPs, CLI tools, parallel agents. Persistent documentation, intelligent auto-fix. Report templates for findings/fixes/summary/index live in the "Report Templates" appendix at the bottom of this file.

## INITIALIZATION

### Step 1: Create Audit Directory Structure

```bash
AUDIT_DATE=$(date +%Y-%m-%d_%H%M)
AUDIT_DIR="audits/${AUDIT_DATE}_extreme-audit"
mkdir -p "${AUDIT_DIR}"/{screenshots,reports,fixes}
```

Create these files:
- `${AUDIT_DIR}/AUDIT_LOG.md` - Master log (update CONSTANTLY)
- `${AUDIT_DIR}/PROGRESS.md` - Resume checkpoint
- `${AUDIT_DIR}/reports/01-code-quality.md`
- `${AUDIT_DIR}/reports/02-ui-ux.md`
- `${AUDIT_DIR}/reports/03-security.md`
- `${AUDIT_DIR}/reports/04-performance.md`
- `${AUDIT_DIR}/reports/05-integrations.md`
- `${AUDIT_DIR}/fixes/AUTO_FIXED.md`
- `${AUDIT_DIR}/fixes/NEEDS_REVIEW.md`

Update `audits/AUDIT_INDEX.md` with link to this audit.

### Step 2: Initialize AUDIT_LOG.md Header

```markdown
# EXTREME Audit Log - [PROJECT NAME]
**Started**: [TIMESTAMP]
**Target**: $ARGUMENTS
**Mode**: EXTREME (parallel agents, full documentation)

## Quick Stats
| Metric | Value |
|--------|-------|
| Critical Issues | 0 |
| High Issues | 0 |
| Medium Issues | 0 |
| Low Issues | 0 |
| Auto-Fixed | 0 |
| Needs Review | 0 |
| Screenshots | 0 |

## Progress
- [ ] Code Quality Audit
- [ ] UI/UX Audit  
- [ ] Security Audit
- [ ] Performance Audit
- [ ] Integration Audit
- [ ] Summary Report

---
## Findings (Updated in Real-Time)
```

### Step 3: Initialize TodoWrite for Progress Tracking

Create todos for each audit phase. Mark in_progress as you work. This survives context loss.

---

## PHASE 1: CODE QUALITY AUDIT

Use these tools IN ORDER:

### 1.1 Project Overview (import frequency + churn)
```bash
# Most-imported local modules → audit these first
rg -o "from ['\"](\.[^'\"]+)['\"]" -r '$1' -g '*.{ts,tsx,js,jsx}' --no-filename $ARGUMENTS | sort | uniq -c | sort -rn | head -20
# Highest-churn files (90 days)
git log --since="90 days ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20
tree -L 3 -I 'node_modules|.git|dist' $ARGUMENTS
```
**DOCUMENT**: File count, most important files, structure overview

### 1.2 Code Metrics (CLI)
```bash
scc --by-file $ARGUMENTS > ${AUDIT_DIR}/reports/scc-output.txt
lizard -l javascript -l typescript $ARGUMENTS -C 15 > ${AUDIT_DIR}/reports/complexity.txt
```
**DOCUMENT**: Total LOC, language breakdown, functions with CCN > 15

### 1.3 Pattern Analysis (ast-grep)
```bash
# Find TODO/FIXME (comments are text → rg, not ast-grep)
rg -n "TODO|FIXME|HACK|XXX" -g '*.{ts,tsx,js,jsx,py}' $ARGUMENTS

# Find console.log (should be removed)
ast-grep --pattern 'console.log($$$)' --lang typescript $ARGUMENTS

# Find any types
ast-grep --pattern ': any' --lang typescript $ARGUMENTS

# Find unused imports
ast-grep --pattern 'import { $$$ } from $$$' --lang typescript $ARGUMENTS
```
**DOCUMENT**: Each finding with file:line, severity, recommended fix

### 1.4 Linting
```bash
npx eslint $ARGUMENTS --format json > ${AUDIT_DIR}/reports/eslint.json 2>&1 || true
npx tsc --noEmit 2>&1 | head -100 > ${AUDIT_DIR}/reports/typescript-errors.txt || true
```
**DOCUMENT**: Error count, most common issues

### 1.5 Auto-Fix Simple Issues
**AUTO-FIX** (no approval needed):
- Unused imports → Remove them
- Missing semicolons → Add them
- Trailing whitespace → Remove it
- console.log statements → Remove or comment out

**DOCUMENT in AUTO_FIXED.md**:
```markdown
## [TIMESTAMP] - Auto-Fixed: Unused Imports
**File**: src/components/Button.tsx:5
**Before**: `import { useState, useEffect } from 'react'`
**After**: `import { useState } from 'react'`
**Reason**: useEffect was imported but never used
**Status**: ✅ FIXED
```

**ASK APPROVAL** for:
- Type changes
- Logic changes
- Architecture changes
- Anything affecting behavior

---

## PHASE 2: UI/UX AUDIT

Use Claude in Chrome for visual inspection.

### 2.1 Get Browser Context
```
mcp__claude-in-chrome__tabs_context_mcp
mcp__claude-in-chrome__tabs_create_mcp (if needed)
```

### 2.2 Navigate to Target
```
mcp__claude-in-chrome__navigate → Go to app URL
```

### 2.3 For EACH Page/View:

**Take Snapshot** (accessibility tree — chrome-devtools, not claude-in-chrome):
```
mcp__chrome-devtools__take_snapshot
```
**DOCUMENT**: All elements found, missing ARIA labels, semantic issues

**Take Screenshot**:
```
mcp__claude-in-chrome__computer action="screenshot"
```
Save to `${AUDIT_DIR}/screenshots/[page-name]_[number].png`

**Check Console Errors**:
```
mcp__claude-in-chrome__read_console_messages pattern="error|warning" onlyErrors=true
```
**DOCUMENT**: Every error with stack trace

**Check Network Failures**:
```
mcp__claude-in-chrome__read_network_requests
```
**DOCUMENT**: Failed requests, slow requests (>1s)

### 2.4 Interactive Element Audit

For EVERY button, link, dropdown, form:
1. Take snapshot to get element UID
2. Click/interact with element
3. Verify expected behavior
4. Document result (✅ Works / ❌ Broken / ⚠️ Issue)

**Checklist per page**:
- [ ] All buttons clickable
- [ ] All links navigate correctly
- [ ] All forms submit
- [ ] All dropdowns open
- [ ] All modals open/close
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus states visible
- [ ] Loading states display
- [ ] Error states display
- [ ] Empty states display
- [ ] Responsive (test 320px, 768px, 1024px, 1440px)

---

## PHASE 3: SECURITY AUDIT

### 3.1 Secrets Detection
```bash
gitleaks detect --source $ARGUMENTS --verbose > ${AUDIT_DIR}/reports/gitleaks.txt 2>&1 || true
```
**CRITICAL**: Any finding here is severity CRITICAL

### 3.2 Dependency Vulnerabilities
```bash
npm audit --json > ${AUDIT_DIR}/reports/npm-audit.json 2>&1 || true
# OR for Python:
safety check --json > ${AUDIT_DIR}/reports/safety.json 2>&1 || true
```
**DOCUMENT**: All vulnerabilities with severity

### 3.3 Code Security Patterns (ast-grep)
```bash
# Find eval usage
ast-grep --pattern 'eval($$$)' $ARGUMENTS

# Find innerHTML
ast-grep --pattern 'innerHTML' $ARGUMENTS

# Find dangerouslySetInnerHTML
ast-grep --pattern 'dangerouslySetInnerHTML' $ARGUMENTS

# Find hardcoded credentials
rg -i "password|secret|api_key|apikey|token" --type ts --type js $ARGUMENTS
```

### 3.4 Sensitive File Check (Desktop Commander)
```
mcp__desktop-commander__read_file → Check .env files exist and aren't committed
mcp__desktop-commander__start_search → Find any .env in git history
```

---

## PHASE 4: PERFORMANCE AUDIT

### 4.1 Build Performance
```bash
hyperfine --warmup 1 'npm run build' --export-json ${AUDIT_DIR}/reports/build-time.json
```

### 4.2 Bundle Analysis
```bash
npm run build -- --stats 2>&1 | tail -50 > ${AUDIT_DIR}/reports/bundle-stats.txt || true
```

### 4.3 Large Files
```bash
fd --type f --size +500k $ARGUMENTS > ${AUDIT_DIR}/reports/large-files.txt
ncdu -o ${AUDIT_DIR}/reports/disk-usage.json $ARGUMENTS 2>/dev/null || true
```

### 4.4 Complexity Hotspots
```bash
lizard -l javascript -l typescript $ARGUMENTS -s cyclomatic_complexity -w > ${AUDIT_DIR}/reports/hotspots.txt
```

---

## PHASE 5: INTEGRATION AUDIT

### 5.1 API Endpoints
Use Claude in Chrome to test each API endpoint visible in network tab.

### 5.2 MCP Connections
List and test all MCP server connections.

### 5.3 Environment Configuration
```
mcp__desktop-commander__read_file → Read .env.example
```
**DOCUMENT**: Required vs optional env vars, missing documentation

### 5.4 External Dependencies
```bash
jq '.dependencies, .devDependencies' package.json > ${AUDIT_DIR}/reports/dependencies.json
```

---

## PHASE 6: GENERATE SUMMARY

Create `${AUDIT_DIR}/reports/06-summary.md`:

```markdown
# Audit Summary - [PROJECT NAME]
**Completed**: [TIMESTAMP]
**Duration**: [X hours]

## Executive Summary
[2-3 sentences on overall health]

## Critical Findings (Fix Immediately)
| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | ... | file:line | ❌ Open |

## High Priority (Fix This Week)
...

## Medium Priority (Fix This Month)
...

## Low Priority (Backlog)
...

## Auto-Fixed Issues
[Count] issues were automatically fixed. See fixes/AUTO_FIXED.md

## Metrics Comparison
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| TypeScript Errors | X | Y | -Z |
| ESLint Errors | X | Y | -Z |
| CCN > 15 Functions | X | Y | -Z |

## Recommendations
1. ...
2. ...
3. ...

## Next Audit
Recommended: [DATE]
Focus areas: [...]
```

---

## DOCUMENTATION RULES (CRITICAL)

1. **UPDATE AUDIT_LOG.md AFTER EVERY FINDING** - Not batched, immediately
2. **Save screenshots with descriptive names** - `tasks-view-kanban-tab_003.png`
3. **Include file:line for every code finding**
4. **Severity rating for every issue** - Critical/High/Medium/Low
5. **Update PROGRESS.md checkpoint after each section**
6. **Mark auto-fixes clearly** - ✅ FIXED in both AUDIT_LOG.md and AUTO_FIXED.md

---

## PARALLEL EXECUTION (EXTREME MODE)

When possible, spawn parallel Task agents:
- Agent 1: Code Quality (Phase 1)
- Agent 2: Security (Phase 3)
- Agent 3: Performance (Phase 4)

**Hard cap: max 6 concurrent agents; spawn them with `run_in_background: true` and consume results as they complete.**

Then consolidate findings before UI audit (needs sequential interaction).

---

## RESUME CAPABILITY

If context is lost, read these files in order:
1. `PROGRESS.md` - See which phases completed
2. `AUDIT_LOG.md` - See all findings so far
3. `TodoWrite` - See current task status

Continue from last checkpoint.

---

## TARGET

$ARGUMENTS

If no target specified, audit current working directory.

---

## Report Templates (absorbed from the retired /audit-report)

Use these when initializing or updating audit documentation. Modes: init (create structure), update (append finding), fix (log fix), summary, index.

### Finding entry (append to AUDIT_LOG.md, then update Quick Stats + PROGRESS.md)

```markdown
### Issue #[N]: [title]
**Timestamp**: [NOW] | **Severity**: Critical/High/Medium/Low | **Category**: Code/UI/Security/Performance/Integration
**Location**: [file:line or page/element]
**Description**: [what's wrong]
**Expected**: [...] | **Actual**: [...]
**Evidence**: [screenshot / console / code snippet]
**Recommended Fix**: [...]
**Status**: ❌ Open
```

### Fix log entry (fixes/AUTO_FIXED.md or fixes/NEEDS_REVIEW.md)

```markdown
## Fix #[N]: [title]
**Timestamp**: [NOW] | **Type**: Auto-Fix | Pending Review | **Severity**: [...] | **Risk**: Low/Medium/High
**Location**: [file:line]
**Before**: ```[old code]``` → **After/Proposed**: ```[new code]```
**Verification / Rationale**: [...]
**Status**: ✅ FIXED | ⏳ Awaiting Approval
```
On logging a fix, flip the original issue's status in AUDIT_LOG.md (`❌ Open` → `✅ FIXED` or `⏳ Pending Review`).

### Summary skeleton (reports/06-summary.md)

```markdown
# Audit Summary — [project] ([date])
**Overall Health Score**: X/100
| Category | Score | Status |
|----------|-------|--------|
| Code Quality | X/25 | 🟢/🟡/🔴 |
| UI/UX | X/25 | |
| Security | X/25 | |
| Performance | X/25 | |

| Severity | Count | Fixed | Pending |
|----------|-------|-------|---------|
| 🚨 Critical | | | |
| 🔴 High | | | |
| 🟠 Medium | | | |
| 🟡 Low | | | |

## Critical Findings / High Priority / Pending Review
[lists with file:line + status]

## Recommendations
Immediate (this week) / Short-term (this month) / Long-term (backlog)

## Appendix
AUDIT_LOG.md · fixes/ · screenshots/ · reports/
```

### Audit index (audits/AUDIT_INDEX.md)

```markdown
| Date | Type | Health | Critical | High | Med | Low | Fixed |
|------|------|--------|----------|------|-----|-----|-------|
```
One row per audit, newest first, each linking to its audit directory.
