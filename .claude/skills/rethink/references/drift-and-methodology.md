# Drift Check and Methodology Updates (Reference for /rethink Phases 0 and 2)

> Read when running Phase 0 (drift check steps 0a-0d) or Phase 2 (methodology folder updates). The Phase 0 report format (0e) and the triage gate live in SKILL.md.

## Phase 0: Drift Check (steps 0a-0d)

### 0a. Load Methodology State

```bash
# Get all methodology notes with their metadata
for f in ops/methodology/*.md; do
  echo "=== $f ==="
  head -20 "$f"  # frontmatter with category, created, updated, status
  echo ""
done
```

Read all methodology notes fully. Extract:
- Each note's category, created date, updated date, status
- The behavioral assertions each note makes (the "What to Do" sections)

### 0b. Load System Configuration

Read:
- `ops/config.yaml` — current configuration state
- The context file (CLAUDE.md) — current behavioral instructions
- `ops/derivation-manifest.md` — vocabulary and feature state

### 0c. Compare Across Three Drift Types

**Type 1: Staleness**

```bash
# Compare config.yaml modification time vs newest methodology note
CONFIG_MTIME=$(stat -f %m ops/config.yaml 2>/dev/null || stat -c %Y ops/config.yaml 2>/dev/null || echo 0)
NEWEST_METH=$(ls -t ops/methodology/*.md 2>/dev/null | head -1)
METH_MTIME=$(stat -f %m "$NEWEST_METH" 2>/dev/null || stat -c %Y "$NEWEST_METH" 2>/dev/null || echo 0)
```

If `CONFIG_MTIME > METH_MTIME`: config has changed since methodology was last updated. Flag as staleness drift.

**Type 2: Coverage Gap**

For each active feature in config.yaml (features with `enabled: true` or features present in the active configuration), check whether a corresponding methodology note exists. Features without methodology coverage represent gaps — the system does things it cannot explain to itself.

Check these feature areas:
- Processing pipeline (is there a methodology note about processing behavior?)
- Maintenance conditions (methodology notes about when maintenance triggers?)
- Session rhythm (methodology notes about session workflow?)
- Domain-specific behaviors (methodology notes about domain vocabulary and patterns?)

**Type 3: Assertion Mismatch**

For each methodology note that makes a behavioral assertion ("What to Do" section), check:
- Does the context file contain instructions that align with or contradict this directive?
- Does config.yaml contain settings that align with or contradict this directive?
- Are there other methodology notes that contradict this one?

Report: which assertions align, which contradict, which have no corresponding system element.

### 0d. Create Drift Observations

For each drift finding, create an observation note in `ops/observations/`:

```markdown
---
description: [specific drift finding]
category: drift
status: pending
observed: {today's date}
related_notes: ["[[methodology note]]", "[[config element]]"]
---
# [drift finding as prose sentence]

**Drift type:** staleness | coverage-gap | assertion-mismatch
**Methodology note:** [[affected note]]
**System element:** [config.yaml field, context file section, or missing coverage]
**Discrepancy:** [what the methodology says vs what the system does]

Resolution: update methodology note | update system config | flag for human review
```

---

## Phase 2: Methodology Folder Updates

For items triaged as METHODOLOGY, create or update notes in `ops/methodology/`.

### Creating New Methodology Notes

```markdown
---
description: [what this methodology note teaches — specific enough to be actionable]
type: methodology
category: [processing | capture | connection | maintenance | voice | behavior | quality]
source: rethink
created: YYYY-MM-DD
status: active
evidence: ["obs-filename-1", "obs-filename-2"]
---

# [prose-as-title describing the learned behavior]

[Body developing the methodology learning:
- What the agent should do
- What the agent should avoid
- Why this matters (what went wrong without this)
- When this applies (scope/context)]

---

Related: [[methodology]]
```

### Extending Existing Methodology Notes

If a methodology note with similar content already exists:
1. Do NOT create a duplicate
2. Instead, add the new evidence to the existing note
3. Update the evidence array in frontmatter
4. Strengthen or nuance the existing guidance based on the new observation
5. Update the observation: set `status: implemented`, add `implemented_in: ops/methodology/[existing-file]`

### Checking for Methodology Duplicates

Before creating a new methodology note:
1. Read all files in `ops/methodology/` (these are small)
2. Check if any existing note covers the same behavioral area
3. If overlap > 80%, extend rather than duplicate

### Update Methodology MOC

After creating or updating methodology notes, update `ops/methodology.md`:
- Add new notes to the appropriate category section
- Update context phrases for modified notes
