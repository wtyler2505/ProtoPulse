# Cross-Phase Analysis Reference

Read this on iteration 6+ to deepen analysis by cross-referencing findings between phases. Each connection below explains what to look for, what tool commands to run, and what checklist items to create.

The goal: surface insights that only emerge when you look at findings from two phases together. A complexity hotspot (Phase 4) near a feature gap (Phase 2) is more urgent than either finding alone.

---

## Cross-Reference Matrix

```
         P1 State  P2 Gaps  P3 UX  P4 Debt  P5 Innovation
P1 State    —        ①       ②       ③         ④
P2 Gaps              —       ⑤       ⑥         ⑦
P3 UX                         —      ⑧         ⑨
P4 Debt                               —        ⑩
P5 Innov                                        —
```

Each numbered connection is detailed below.

---

## ① State → Gaps: Feature Completeness Audit

**What to look for:** Features in Phase 1 inventory marked "Partial" or "Basic" that competitors (Phase 2) implement fully. These are worse than missing features because users discover limitations after committing.

**Tool commands:**
```bash
# Find features with TODO/partial markers
rg 'TODO.*feature|partial|stub|placeholder|not.implemented' src/ -i --stats

# Find incomplete integrations
ast-grep --pattern 'throw new Error($$$"not implemented"$$$)' --lang typescript
ast-grep --pattern 'raise NotImplementedError' --lang python

# Compare feature count vs competitor feature count
# (Reference your Phase 2 comparison table)
```

**Checklist items to create:**
- `EN-XX: Complete partial implementation of [feature] — competitors offer [specific capability] we lack`
- Priority: P1 if the feature is discoverable by users (they'll hit the limitation)

---

## ② State → UX: Orphaned Features

**What to look for:** Features that exist in code (Phase 1) but have no discoverable path in the UI (Phase 3). Dead features waste maintenance effort and confuse developers.

**Tool commands:**
```bash
# Find exported components never imported elsewhere
ast-grep --pattern 'export function $NAME' --lang typescript src/components/
# Then check each for imports:
rg 'import.*ComponentName' src/ --count

# Find routes with no navigation link
rg 'path:.*"/[^"]*"' src/ -o  # all defined routes
rg 'href=.*"/[^"]*"' src/ -o  # all linked routes
# Routes defined but never linked = orphaned

# Find feature flags that are always false
rg 'FEATURE_|feature_flag|isEnabled' src/ --stats
```

**Checklist items to create:**
- `TD-XX: Remove orphaned feature [name] — exists in code but unreachable in UI`
- `UI-XX: Add navigation path to [feature] — exists but users can't find it`

---

## ③ State → Debt: Architecture vs Reality

**What to look for:** Discrepancies between intended architecture (Phase 1) and actual implementation (Phase 4). Common: monolithic files that should be split, circular dependencies, layers that bypass each other.

**Tool commands:**
```bash
# Find oversized files (architecture smell)
fd -e ts -e tsx -e py -e rs --type f -x wc -l {} | sort -rn | head -20

# Find circular imports
# TypeScript:
ast-grep --pattern 'import $$$from "$$$"' --lang typescript src/ | sort | uniq -d
# Python:
rg 'from \. import|from \.\. import' app/ --stats

# Find direct database access outside storage layer
rg 'db\.|database\.|prisma\.|drizzle' src/ --stats
# Compare against expected data access patterns from Phase 1
```

**Checklist items to create:**
- `TD-XX: Split [file] (NNN lines) — violates single-responsibility, contains [N] distinct concerns`
- `TD-XX: Fix circular dependency between [module A] and [module B]`

---

## ④ State → Innovation: Untapped Infrastructure

**What to look for:** Existing capabilities (Phase 1) that could power innovative features (Phase 5) with minimal new code. The cheapest innovations reuse what you already have.

**What to check:**
- Does the existing AI integration (if any) support more use cases than currently implemented?
- Could the existing data model support features users haven't asked for yet?
- Are there API endpoints with no UI — could they power a public API or integration?

**Checklist items to create:**
- `IN-XX: Leverage existing [infrastructure] to power [innovation] — minimal new code required`
- Priority: P2 (these are high-value because they're cheap to build)

---

## ⑤ Gaps → UX: Competitive UX Patterns

**What to look for:** UX patterns that competitors (Phase 2) use which solve workflow friction identified in Phase 3. The competitor has already solved the design problem — learn from their approach.

**Tool commands:**
```bash
# Screenshot competitor UIs for comparison
shot-scraper "https://competitor.com/feature-page" -o competitor-feature.png 2>/dev/null

# Extract competitor feature descriptions
trafilatura -u "https://competitor.com/features" 2>/dev/null | head -100

# Compare interaction patterns
# Phase 3 identified N clicks for task X
# Competitor achieves same task in M clicks (from research)
```

**Checklist items to create:**
- `UI-XX: Adopt [competitor]'s [pattern] for [workflow] — reduces from [N] to [M] steps`
- `FG-XX: Implement [feature] using [competitor]'s approach as reference`

---

## ⑥ Gaps → Debt: Feasibility Assessment

**What to look for:** Feature gaps (Phase 2) that would be hard to implement given current technical debt (Phase 4). High-complexity areas near where new features need to go create compounding risk.

**Tool commands:**
```bash
# For each major feature gap, check complexity of the area where it would be implemented
lizard src/components/area-where-feature-goes/ -T cyclomatic_complexity=8

# Check test coverage in the affected area
fd -g '*test*' -g '*spec*' src/components/area-where-feature-goes/ --type f | wc -l

# Check for existing abstractions that would help or hinder
ast-grep --pattern 'interface $NAME' --lang typescript src/
```

**Checklist items to create:**
- `TD-XX: Refactor [module] before implementing FG-XX — current complexity (CCN=N) makes safe changes impossible`
- Adjust priority: If a P1 feature gap requires touching a CCN>15 function, the refactor becomes P0

---

## ⑦ Gaps → Innovation: Beyond Parity

**What to look for:** Feature gaps (Phase 2) where you should NOT just copy the competitor but instead innovate past them. Parity keeps you in the game; innovation wins the market.

**Decision framework:**
1. Is the competitor's approach the obvious best solution? → Copy it (FG- item)
2. Is the competitor's approach mediocre and ripe for disruption? → Innovate (IN- item)
3. Is the entire feature category being disrupted by AI/new tech? → Leapfrog (IN- item, P1)

**Checklist items to create:**
- `IN-XX: Instead of copying [competitor]'s [feature], build [innovative alternative] that [specific advantage]`

---

## ⑧ UX → Debt: Performance-Caused Friction

**What to look for:** UX friction (Phase 3) caused by technical issues (Phase 4). Slow renders from high-complexity functions, UI freezes from synchronous operations, confusing error messages from poor error handling.

**Tool commands:**
```bash
# Correlate complexity hotspots with user-facing components
lizard src/components/ -T cyclomatic_complexity=10

# Find synchronous operations that block UI
ast-grep --pattern 'await $$$' --lang typescript src/components/
rg 'useState.*loading' src/components/ --stats

# Find error handling gaps in UI
rg 'catch.*\{.*\}' src/components/ --stats
rg 'ErrorBoundary' src/components/ --stats
```

**Checklist items to create:**
- `TD-XX: Refactor [component] (CCN=N) — causes [specific UX issue] from Phase 3 finding UI-XX`
- Priority: Promote to P0 if the technical issue causes data loss or security risk

---

## ⑨ UX → Innovation: Workflow Automation

**What to look for:** Repetitive workflows (Phase 3) that could be automated or AI-assisted (Phase 5). If a persona repeats the same 5-step workflow daily, that's a prime automation target.

**What to check:**
- Phase 3 workflow traces with > 5 steps for common tasks
- Tasks that all 3 personas perform (high-impact automation)
- Workflows that involve copy-paste or manual data entry

**Checklist items to create:**
- `IN-XX: Automate [workflow] (currently [N] steps) — [M] users perform this daily`
- `IN-XX: AI-assist [workflow] — suggest [specific automation] based on patterns`

---

## ⑩ Debt → Innovation: Architecture Enables/Blocks

**What to look for:** Technical debt (Phase 4) that blocks innovative features (Phase 5), OR clean architecture that enables innovations with minimal effort.

**Tool commands:**
```bash
# Check if architecture supports plugin/extension model
ast-grep --pattern 'interface $NAME' --lang typescript src/
rg 'plugin|extension|hook|middleware|interceptor' src/ --stats

# Check if data model is extensible
rg 'jsonb|json|metadata|extra|custom_fields' src/ -i --stats

# Check if AI integration exists that could be extended
rg 'anthropic|openai|gemini|ai|llm' src/ -i --stats
```

**Checklist items to create:**
- `TD-XX: Refactor [module] to enable IN-XX — current architecture blocks [specific innovation]`
- `IN-XX: Leverage existing [clean abstraction] to implement [innovation] cheaply`

---

## Meta-Analysis Strategies

Use these on iteration 6+ after all individual cross-references are explored.

### Priority Recalibration

Re-examine all checklist items with cross-phase context:

1. **Promote to P0**: Any item that appears in 3+ cross-references (systemic issue)
2. **Promote to P0**: Any security finding from Phase 4 regardless of other factors
3. **Demote to P3**: Any innovation that requires XL refactoring with no clear user demand
4. **Bundle items**: Group related items across categories for efficient implementation
   - Example: TD-03 (refactor module) + FG-02 (add feature in same module) = single sprint

### Impact Chains

Trace the longest chains of cause → effect:

```
Example chain:
  High complexity in auth module (TD-05, CCN=18)
  → Developers avoid touching auth (State finding)
  → No OAuth support (FG-03, missing)
  → Users can't SSO with their company (UX friction)
  → Enterprise customers don't adopt (business impact)
```

Document 3-5 impact chains. These are the most compelling arguments for investment.

### Risk Heatmap

Create a risk assessment by combining:
- **Complexity** (Phase 4: CCN scores)
- **Change frequency** (Phase 1: git log for that area)
- **User exposure** (Phase 3: how many personas touch it)

```
| Module | Complexity | Change Freq | User Exposure | Risk |
|--------|-----------|-------------|---------------|------|
| auth   | High (18) | Low (2/mo)  | All personas  | HIGH |
| board  | Med (12)  | High (15/mo)| All personas  | HIGH |
| export | Low (4)   | Low (1/mo)  | Power users   | LOW  |
```

High complexity + high change frequency + high user exposure = critical risk area.

### Tool Commands for Meta-Analysis

```bash
# Most-changed files (correlate with complexity)
git log --since="90 days ago" --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20

# Files with both high complexity AND high change frequency
# (manually cross-reference lizard output with git log output)

# Unused exports (dead code candidates)
ast-grep --pattern 'export function $NAME' --lang typescript src/
# Then check each for imports across the codebase

# Dependency graph depth
fd -e ts -e tsx src/ -x grep -l 'import' | wc -l
```

---

## Deepening Checklist

On each iteration 6+, systematically check:

- [ ] Have I cross-referenced every Phase 4 hotspot (CCN>10) against Phase 3 workflows?
- [ ] Have I identified which Phase 2 gaps are blocked by Phase 4 debt?
- [ ] Have I traced at least 3 impact chains from technical issue to user impact?
- [ ] Have I recalibrated priorities based on cross-phase evidence?
- [ ] Have I bundled related items for efficient implementation?
- [ ] Have I identified at least 2 "cheap innovations" from existing infrastructure (④)?
- [ ] Is the Executive Summary updated with cross-phase insights?
