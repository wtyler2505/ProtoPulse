# Pattern Detection and Proposal Generation (Reference for /rethink Phases 3 and 4)

> Read when running Phase 3 (pattern detection) or Phase 4 (proposal generation). The approval gate (Phase 5) lives in SKILL.md — proposals are NEVER auto-implemented.

## Phase 3: Pattern Detection

Analyze remaining pending evidence (post-triage) plus promoted/implemented history for systemic patterns. This is where individual data points become actionable signals.

### Evidence Sources

1. **Still-pending observations** — items with `status: pending` after triage
2. **Still-pending tensions** — items with `status: open` or `status: pending` after triage
3. **Recently promoted/implemented items** — may share themes with pending items
4. **Methodology notes** — patterns in `ops/methodology/` by category

### Pattern Types

| Pattern Type | Signal | Threshold | What It Means |
|-------------|--------|-----------|---------------|
| Recurring themes | 3+ observations about the same area or concept | Systemic issue requiring structural response | Something is fundamentally misaligned in that area |
| Contradiction clusters | Multiple tensions pointing at the same architectural assumption | Assumption may be wrong | The system has a flawed foundation in that area |
| Friction accumulation | Multiple observations about the same workflow step | Workflow needs redesign | A specific process is consistently painful |
| Drift signals | Observations suggesting vocabulary, structure, or threshold sensitivity no longer fits | /architect or /reseed territory | The system's configuration may have outgrown the user's actual needs |
| Methodology convergence | Multiple /remember captures in ops/methodology/ pointing at the same behavioral pattern | Methodology note needs elevation to context file | A methodology learning has been validated enough to become a system-level rule |

### Detection Method

1. **Group by category field:** Sort observations by their `category` (methodology, process-gap, friction, surprise, quality). 3+ items in the same category = potential pattern.

2. **Group by referenced topic maps or system areas:** Extract wiki links and file references from observation bodies. 3+ observations referencing the same area = recurring theme.

3. **Cross-reference tensions:** Check if multiple tensions share the same assumption. Multiple tensions pointing at the same thing = assumption may be wrong.

4. **Check friction frequency for acceleration:** Are friction observations about the same step appearing more frequently? An accelerating pattern is a stronger signal than steady-state friction.

5. **Compare methodology notes against context file:** If `ops/methodology/` has 3+ notes in the same category that are not reflected in the context file, the methodology has converged enough for elevation.

6. **Check for vocabulary drift:** If observations use different terms than the derivation manifest or context file, the system's language may have drifted from the user's actual vocabulary.

### Pattern Quality Check

**Do not fabricate patterns from insufficient evidence.** A single observation is a data point, not a pattern. Two observations are a coincidence. Three observations are a pattern worth investigating.

For each candidate pattern, assess:
- **Evidence count:** How many observations/tensions support this?
- **Time span:** Over how many sessions did these accumulate?
- **Specificity:** Can you point to a specific system area or assumption?
- **Impact:** What breaks or degrades because of this?

Only report patterns that pass all four checks.

### Pattern Report

```
--=={ rethink — Patterns }==--

  Patterns detected: [N]

  1. [Pattern type]: [description]
     Evidence: [filenames, one per line]
     Area: [system area affected]
     Impact: [what breaks or degrades]
     Confidence: [high | medium — never low, since low means not enough evidence]

  2. [Pattern type]: [description]
     ...

  No patterns found in: [areas with < 3 data points]
```

If no patterns are detected, report this clearly. Pattern detection requires sufficient evidence — an empty result after triage is a sign the system is healthy, not that rethink failed.

---

## Phase 4: Proposal Generation

For each detected pattern, generate one specific, actionable proposal.

### Proposal Structure

```
  Proposal [N]: [title — what would change]

  Evidence:
    - [filename] — [one-line summary of this observation's contribution]
    - [filename] — [one-line summary]
    - [filename] — [one-line summary]

  Pattern: [which pattern type from Phase 3]

  Current assumption:
    [Quote the specific section of context file, skill, or template
     that embodies the assumption being challenged.
     Include the file path and section heading.]

  Proposed change:
    [Specific file and section. What changes, what stays.
     Before/after if possible. Concrete enough that someone
     could implement this without additional context.]

  What would improve:
    [Concrete expected benefit — not "things would be better"
     but "reduces processing time for inbox items because..."
     or "prevents the duplicate creation issue observed in obs-003, obs-007"]

  What could go wrong:
    [Risk assessment — what might break? What second-order effects?
     What assumptions does this proposal itself make?]

  Reversible: [yes | no | partially — explain if partially]

  Scope: [context-file | skill | template | architecture | methodology]
```

### Proposal Quality Gates

Every proposal MUST have:

1. **Specific file references** — not "update the context file" but "update ops/context.md, section 'Processing Pipeline', paragraph 3"
2. **Evidence backing** — at least 2 observations/tensions supporting the change. No intuition-only proposals.
3. **Risk awareness** — what could go wrong. Proposals without risk assessment are overconfident.
4. **Proportionality** — the scope of the proposed change should match the weight of evidence. A single observation does not justify rewriting the context file.
5. **Reversibility assessment** — can this be undone if it makes things worse?

### Proposal Scope Rules

| Evidence Strength | Maximum Proposal Scope |
|-------------------|----------------------|
| 2 observations, same area | Methodology note update |
| 3+ observations, clear pattern | Skill or template change |
| 5+ observations + tensions | Context file section change |
| Pervasive pattern across areas | Architectural change (recommend /architect consultation) |

Do not propose architectural changes based on thin evidence. The threshold scales with the blast radius.

### /next Integration

If 10+ pending observations or 5+ pending tensions remain after triage AND pattern detection did not consume them into proposals:

```
  Threshold signal for /next:
    [N] pending observations, [N] pending tensions remain
    /next should prioritize rethink at session priority
```
