# The Methodology Learning Loop and Rule Zero (Shared Reference)

> Shared by `/remember` (capture layer) and `/rethink` (enforcement layer). Extracted 2026-06-11 during the progressive-disclosure restructure (docs/audits/2026-06-11-skill-audit.md Top-10 item 10). The remember-side text is the canonical full loop; the rethink-side framing follows it.

## The Methodology Learning Loop

This is the complete cycle that /remember participates in:

```
Work happens
  → user corrects agent behavior (explicit or implicit)
  → /remember captures correction as methodology note
  → methodology note filed to ops/methodology/
  → agent reads methodology notes at session start (via context file reference)
  → agent behavior improves
  → fewer corrections needed
  → when methodology notes accumulate (3+ in same category)
  → /rethink triages and detects patterns
  → patterns elevated to context file changes
  → system methodology evolves at the architectural level
  → the cycle continues with new friction at the edges
```

Each layer of this loop serves a different purpose:
- **/remember** captures individual friction points — fast, low ceremony
- **ops/methodology/** stores accumulated behavioral guidance — persists across sessions
- **/rethink** detects patterns and proposes structural changes — periodic, deliberate
- **ops/context.md** (or equivalent) embodies the system's stable methodology — changes rarely, by human approval

The loop is healthy when methodology notes accumulate slowly (friction is being addressed) and /rethink elevates patterns to context-level changes when thresholds are exceeded.

The loop is unhealthy when the same category keeps getting methodology notes without elevation (the system is capturing friction but not learning from it).

## Rule Zero: Methodology as Canonical Specification

The methodology folder is more than a friction capture log. It is the system's authoritative self-model — the canonical specification from which drift is measured.

**What this means for /remember:**
- Every methodology note you create becomes part of the spec. Write directives, not incident reports.
- The title should be an actionable behavior ("check for semantic duplicates before creating any note") not a problem description ("duplicate creation issue").
- Future /rethink sessions will compare system behavior against what methodology notes declare. Vague notes create unmeasurable specs.

**What this means for the system:**
- ops/methodology/ is consulted by meta-skills (/ask, /architect, /rethink) as the source of truth for how the system works.
- Drift detection compares methodology note assertions against actual config.yaml and context file state.
- When methodology notes are stale (older than config changes), the system surfaces this as a maintenance condition.

The methodology folder is the spec. /remember writes the spec. /rethink enforces the spec. The loop is closed.

## The Meta-Layer (rethink perspective)

Rethink is the system's immune system. It detects when assumptions have become infections — beliefs that made sense once but now cause harm. Healthy systems challenge themselves. Unhealthy systems calcify around untested assumptions.

The methodology learning loop closes here:
```
Work happens → friction captured as observations/tensions
  → /remember captures immediate corrections
  → observations accumulate
  → /rethink triages + detects patterns + proposes changes
  → human approves changes
  → system evolves
  → less friction → fewer observations → healthy system
```

Run rethink. Let evidence win.
