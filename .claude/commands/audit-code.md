---
description: Comprehensive read-only code quality audit using ast-grep, rg, scc, lizard, eslint, and pattern detection
argument-hint: "[target-directory]"
---
# Code Quality Audit - Deep Static Analysis
**Description**: Comprehensive code quality analysis using ast-grep, rg, scc, lizard, eslint, and pattern detection. **This audit is READ-ONLY   it reports findings and suggested fixes; it never modifies code.**

## INITIALIZATION
```bash
AUDIT_DIR="audits/$(date +%Y-%m-%d_%H%M)_code-audit"
mkdir -p "${AUDIT_DIR}/reports"
TARGET="${1:-.}"  # Default to current directory
```

## PHASE 1: PROJECT OVERVIEW

### 1.1 File Importance (import frequency + churn)
```bash
# Most-imported local modules = highest-impact files
rg -o "from ['"](\\.[^'\"]+)['"]" -r '$1' -g '*.{ts,tsx,js,jsx}' --no-filename $ARGUMENTS | sort | uniq -c | sort -rn | head -20

# Highest-churn files (90 days)   change frequency correlates with risk
git log --since="90 days ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20
```
**DOCUMENT**: Top 20 most important files to focus on.

### 1.2 Structure Visualization
```bash
tree -L 4 -I 'node_modules|.git|dist|build|coverage' $ARGUMENTS > ${AUDIT_DIR}/reports/structure.txt
```

### 1.3 Code Statistics
```bash
scc --by-file --no-cocomo $ARGUMENTS > ${AUDIT_DIR}/reports/scc-full.txt
scc $ARGUMENTS --format json > ${AUDIT_DIR}/reports/scc.json
```
**DOCUMENT**:
- Total LOC
- Language breakdown
- Comment ratio
- Complexity estimate

## PHASE 2: COMPLEXITY ANALYSIS

### 2.1 Function Complexity
```bash
lizard -l javascript -l typescript -l python $ARGUMENTS -C 10 > ${AUDIT_DIR}/reports/complexity-warning.txt
lizard -l javascript -l typescript -l python $ARGUMENTS -C 15 > ${AUDIT_DIR}/reports/complexity-critical.txt
```
**Severity Thresholds**:
| CCN | Severity | Action |
|-----|----------|--------|
| 1-10 | Good | No action |
| 11-15 | Warning | Consider refactoring |
| 16-20 | High | Should refactor |
| 21+ | Critical | Must refactor |

**DOCUMENT**: Every function with CCN > 15 with file:line

### 2.2 Long Functions
```bash
lizard $ARGUMENTS -L 50 > ${AUDIT_DIR}/reports/long-functions.txt
```
Functions over 50 lines should be split.

## PHASE 3: PATTERN ANALYSIS (ast-grep)

### 3.1 Code Smells
```bash
# TODO/FIXME comments (tech debt)   comments are text, so rg, not ast-grep
rg -n "TODO|FIXME|HACK|XXX" -g '*.{ts,tsx,js,jsx,py,rs,go}' $ARGUMENTS

# Console statements (should be removed in production)
ast-grep --pattern 'console.log($$$)' --lang typescript $ARGUMENTS
ast-grep --pattern 'console.warn($$$)' --lang typescript $ARGUMENTS
ast-grep --pattern 'console.error($$$)' --lang typescript $ARGUMENTS
```

### 3.2 Type Safety Issues
```bash
# Any types (type safety holes)
ast-grep --pattern ': any' --lang typescript $ARGUMENTS
ast-grep --pattern 'as any' --lang typescript $ARGUMENTS

# Non-null assertions (potential runtime errors)
ast-grep --pattern '$EXPR!' --lang typescript $ARGUMENTS

# Type assertions (bypassing type checking)
ast-grep --pattern 'as $TYPE' --lang typescript $ARGUMENTS
```

### 3.3 Import/Export Issues
```bash
# Unused imports (run eslint for better detection)
npx eslint $ARGUMENTS --rule 'no-unused-vars: error' --format json 2>&1 || true

# Circular dependency check (madge is OPTIONAL   not always installed)
npx madge --circular $ARGUMENTS 2>&1 || true

# Fallback without madge: map the import graph with rg and eyeball A-B-A pairs
rg -o "from ['"](\\.[^'\"]+)['"]" -r '$1' -g '*.{ts,tsx}' $ARGUMENTS | sort | uniq -c | sort -rn | head -30
```

### 3.4 Error Handling
```bash
# Empty catch blocks
ast-grep --pattern 'catch ($ERR) { }' --lang typescript $ARGUMENTS

# Catch without error handling
ast-grep --pattern 'catch { }' --lang typescript $ARGUMENTS

# Async without try-catch (risky)
ast-grep --pattern 'async function $NAME($$$) { $$$await$$$ }' --lang typescript $ARGUMENTS
```

### 3.5 React-Specific (if applicable)
```bash
# useEffect without deps array
ast-grep --pattern 'useEffect($$$)' --lang typescript $ARGUMENTS

# Missing key prop in lists
ast-grep --pattern '.map($$$)' --lang typescript $ARGUMENTS
```

## PHASE 4: LINTING

### 4.1 ESLint
```bash
npx eslint $ARGUMENTS --format json > ${AUDIT_DIR}/reports/eslint.json 2>&1 || true
npx eslint $ARGUMENTS --format stylish > ${AUDIT_DIR}/reports/eslint.txt 2>&1 || true
```

### 4.2 TypeScript
```bash
npx tsc --noEmit 2>&1 > ${AUDIT_DIR}/reports/typescript.txt || true
```

### 4.3 Shell Scripts (if any)
```bash
fd -e sh -e bash $ARGUMENTS --exec shellcheck {} 2>&1 > ${AUDIT_DIR}/reports/shellcheck.txt || true
```

## PHASE 5: FINDINGS & SUGGESTED FIXES (Report Only)
**This audit does NOT modify code.** Every issue   even trivially auto-fixable ones (unused imports, trailing whitespace, console.log)   is REPORTED with a suggested fix, not applied. Fixing is a separate, deliberate task after the audit is reviewed. For mechanical issues, note the one-shot remediation command the human can run later (e.g. `npx eslint . --fix`, `npx prettier --write .`)   but do not run it.

Record every finding in NEEDS_REVIEW.md:
```markdown
## Issue: [Title]
**Severity**: [level]
**Location**: [file:line]
**Current code**:
```typescript
[code]
```
**Suggested fix**:
```typescript
[fixed code]
```
**Reason**: [explanation]
**Risk**: [low/medium/high]
**Status**: Awaiting Approval
```

## PHASE 6: DEPENDENCY ANALYSIS

### 6.1 Outdated Packages
```bash
npm outdated --json > ${AUDIT_DIR}/reports/outdated.json 2>&1 || true
```

### 6.2 Unused Dependencies
```bash
# depcheck is OPTIONAL   not always installed
npx depcheck $ARGUMENTS --json > ${AUDIT_DIR}/reports/depcheck.json 2>&1 || true

# Fallback without depcheck: for each dependency in package.json, check usage
jq -r '.dependencies // {} | keys[]' package.json | while read -r dep; do rg -q "['\"]$dep" -g '*.{ts,tsx,js,jsx}' . || echo "possibly unused: $dep"; done
```

### 6.3 Duplicate Dependencies
```bash
npm ls --all 2>&1 | grep -E "deduped|UNMET" > ${AUDIT_DIR}/reports/duplicates.txt || true
```

## SUMMARY TEMPLATE
```markdown
# Code Quality Audit Summary

## Metrics
| Metric | Value | Status |
|--------|-------|--------|
| Total LOC | X | - |
| Functions > 50 lines | X |   if > 0 |
| Functions CCN > 15 | X |   if > 0 |
| TypeScript Errors | X |   if > 0 |
| ESLint Errors | X |   if > 10 |
| `any` types | X |   if > 5 |
| TODO/FIXME | X | - |
| Circular deps | X |   if > 0 |

## Needs Review
- [Y] findings with suggested fixes (see NEEDS_REVIEW.md)   audit applied NO changes

## Top Priority
1. [Most critical issue]
2. [Second most critical]
3. [Third most critical]
```

## TARGET $ARGUMENTS
Default: Current working directory
