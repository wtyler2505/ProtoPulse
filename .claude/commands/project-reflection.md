---
description: Deep project analysis   optimized CLAUDE.md + tracked evolution
allowed-tools: Read, Bash, Grep, Glob, Write, Edit, mcp__desktop-commander__*, mcp__memory__*, mcp__clear-thought__clear_thought
argument-hint: "[project-path] (defaults to current directory)"
---
# Project Reflection: [project-name]
Analyze project state, compare to previous reflection, generate CLAUDE.md improvements.

## Execution Flow

### Phase 1: Quantitative Snapshot
**Gather hard metrics (not vibes):**
```bash
# Code stats
scc --format json . | jq '{
  languages: [.[] | {name: .Name, files: .Count, lines: .Code, comments: .Comment}],
  total_lines: ([.[].Code] | add),
  total_files: ([.[].Count] | add)
}'

# Complexity hotspots (top 10)
lizard -l javascript -l typescript -l python . 2>/dev/null | head -30

# Git activity (last 30 days)
git log --since="30 days ago" --pretty=format:"%h" | wc -l
git diff --stat HEAD~20 2>/dev/null | tail -1

# Test presence
fd -e test.ts -e spec.ts -e test.js -e spec.js -e _test.py -e _test.go | wc -l

# Doc coverage
fd README.md CLAUDE.md -t f | wc -l
```

**Store as structured data:**
`metrics.snapshot = { timestamp, loc, file_count, languages, complexity_hotspots[], test_file_count, recent_commit_count, doc_files[] }`

### Phase 2: Pattern Detection
**Architecture patterns (ast-grep):**
```bash
# React patterns
ast-grep --pattern 'useState($$$)' --lang tsx -c
ast-grep --pattern 'useEffect($$$)' --lang tsx -c

# Error handling
ast-grep --pattern 'try { $$$ } catch ($$$) { $$$ }' -c
ast-grep --pattern 'catch (e) { console.log($$$) }' -c  # Anti-pattern

# TODO/FIXME debt
rg -c "TODO|FIXME|HACK|XXX" --type-add 'code:*.{ts,tsx,js,py}' -t code
```

**Detect what's NOT in CLAUDE.md:**
```bash
# Key files by importance (most-imported modules + git churn as proxies)
rg -o "from ['"](\\.[^'\"]+)['\"]" -r '$1' -g '*.{ts,tsx,js,py}' --no-filename | sort | uniq -c | sort -rn | head -10
git log --since="90 days ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -10
# Compare against CLAUDE.md critical files section
# Flag any top-10 files missing from docs
```

### Phase 3: Compare to Previous Reflection
**Retrieve last reflection:**
```bash
mcp__memory__search_nodes --query "project_reflection $(basename $PWD)"
```

**Diff metrics:**
 LOC: +1,200 (was 8,500   now 9,700)
 Complexity: 2 new hotspots in src/services/
 Test files: -1 (regression?)
 TODO count: +5 (debt accumulating)

**Flag significant changes:**
- [ ] >10% LOC change
- [ ] New complexity hotspots (CCN > 15)
- [ ] Test file count decreased
- [ ] New languages introduced
- [ ] Key files changed but CLAUDE.md not updated

### Phase 4: Generate Recommendations
**Priority Levels:**
| Level | Criteria | Action |
|-------|----------|--------|
| P0 | Blocks AI effectiveness | Fix immediately |
| P1 | Causes confusion/errors | Fix this session |
| P2 | Nice to have | Backlog |

**Recommendation Categories:**
1. **CLAUDE.md Gaps**
   - Missing critical files
   - Outdated patterns (code changed, docs didn't)
   - Missing pitfalls discovered in practice
2. **Code Health**
   - Complexity hotspots to document or refactor
   - Anti-patterns to note as warnings
   - Test coverage gaps
3. **Documentation Drift**
   - Commands that no longer work
   - Architecture descriptions that don't match reality
   - Stale version numbers

### Phase 5: Output
# Project Reflection: [project-name]
**Date:** YYYY-MM-DD | **Previous:** YYYY-MM-DD (X days ago)

## Metrics Snapshot
| Metric | Current | Previous | Difference |
|--------|---------|----------|------------|
| LOC | X | Y | +Z |
| Files | X | Y | +Z |
| Complexity Hotspots | X | Y | +Z |
| Test Files | X | Y | +Z |
| TODO/FIXME | X | Y | +Z |

## Key Findings
###   P0 - Critical
- [Finding with file:line reference]

###   P1 - Important
- [Finding with file:line reference]

###   P2 - Minor
- [Finding]

## CLAUDE.md Diff
```diff
## Critical Files
+ | 5 | services/newService.ts | Handles X (added since last reflection) |
```

## Pitfalls
```diff
+ | New Pattern | `useNewHook` requires cleanup in useEffect return |
```

Stored to Memory Reflection saved. Next run will diff against this snapshot.

## Action Items
- [ ] P0: [Specific action]
- [ ] P1: [Specific action]
- [ ] P2: [Specific action]

### Phase 6: Persist to Memory
```bash
mcp__memory__create_entities --entities '[{ "name": "project_reflection_[project]_[date]", "entityType": "reflection", "observations": ["metrics_json", "findings", "recommendations"] }]'
```

## When to Run
| Trigger | Why |
|---------|-----|
| After major refactor | Architecture may have changed |
| New team member onboarding | Ensure CLAUDE.md is current |
| Monthly maintenance | Catch drift before it accumulates |
| Before major feature | Ensure AI has accurate context |
| After dependency upgrades | New patterns/pitfalls may exist |

## Anti-Patterns to Avoid
Running without acting on findings
Ignoring P0 items
Updating CLAUDE.md without verification
Skipping memory persistence (loses history)
