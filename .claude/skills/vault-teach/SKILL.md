---
name: vault-teach
description: Generate an ordered learn-path for a topic from the Ars Contexta vault. Picks notes in pedagogical order (foundation → mechanism → application → deep-dive → pre-test), tiered by audience (beginner → intermediate → expert), with estimated read time per step. Powers the Learn Hub (plan 13-learning-surfaces) + the tutorial side of /arscontexta:tutorial. Triggers on "/vault-teach", "/vault-teach [topic] --audience beginner", "teach me X", "build learn path for Y", "generate reading sequence".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Grep, Glob, Bash, mcp__qmd__qmd_search, mcp__qmd__qmd_deep_search, mcp__qmd__qmd_collections
argument-hint: "[topic] [--audience beginner|intermediate|expert] [--max-steps N] [--json] [--start-from-slug <slug>]"
---

## EXECUTE NOW

**Topic: $ARGUMENTS**

If no topic provided, ask the user what they want to learn (1 sentence).

Parse flags:
- `--audience <tier>` — target learner tier; sequences through `[beginner]` → `[intermediate]` → `[expert]` sections per T11 markers.
- `--max-steps <N>` — cap path length (default 8).
- `--json` — structured output.
- `--start-from-slug <slug>` — anchor the path at a specific note (learner already read this).

**Execute these steps:**

1. **Resolve topic** — find matching MOC in `knowledge/<topic>.md` OR most-similar MOC via qmd.
2. **Gather candidate notes** — collect MOC's linked notes + qmd_deep_search results on topic.
3. **Score by pedagogical stage** — see §Staging rubric.
4. **Order the path**:
   - **Step 1-2 Foundation** — definitional + canonical first-principles
   - **Step 3-4 Mechanism** — how/why it works
   - **Step 5-6 Application** — when + where to use
   - **Step 7 Deep-dive** — edge cases, quirks (if tier=expert)
   - **Step 8 Pre-test** — DRC rule or gotcha that checks understanding
5. **For each step, select the tier section** — prefer the learner's declared `--audience`; fall back beginner if intermediate absent; fall back intermediate if expert absent.
6. **Estimate read time** — 500 wpm · declared audience · section word count.
7. **Emit** — Markdown learn-path OR JSON.

**Pipeline discipline** — read-only. No vault writes.

**START NOW.** Reference below explains staging rubric, tier fallback, integration.

---

## Staging rubric

Scoring each candidate note for its staging position:

| Stage | Signals to detect | Weight |
|---|---|---|
| Foundation | `type: moc`, title contains "what is", "definition of", "introduction to"; note has no `supersedes[]` targets | 5 × |
| Mechanism | headings contain "why", "how", "derivation"; frontmatter `type: reference` | 4 × |
| Application | headings contain "application", "when to use", "usage", "example"; frontmatter has `used-by-surface[]` | 4 × |
| Deep-dive | `confidence: verified` + `provenance[authoritative]`; headings contain "edge", "gotcha", "failure mode" | 3 × |
| Pre-test | DRC-rule notes, "watch out for", "common mistake", explicit `[[check-this]]` cross-links | 3 × |

Tier-match bonus: note's `audience:` array includes learner's tier → ×1.5 multiplier.

Ordering within same stage: higher backlink count first (consumed notes > orphans); then freshest `reviewed` date.

## Tier fallback

For each selected note, render the body section matching learner's tier:
- `--audience beginner` → `[beginner]` section. If missing, render all-universal content (no tier sections) + flag.
- `--audience intermediate` → `[intermediate]`. Fallback: `[beginner]`. Flag as "simplified" if fallback.
- `--audience expert` → `[expert]`. Fallback: `[intermediate]` → `[beginner]`. Flag cascading fallbacks.

Consumers of the learn-path (Learn Hub) show a "Show higher tier" escalator that swaps the section in place.

## Output format (Markdown)

```markdown
## Learn path: decoupling capacitors (audience: intermediate)

**Topic:** decoupling-capacitors
**Audience:** intermediate
**Steps:** 6
**Total read time:** ~28 minutes

### Step 1 — Foundation: What is capacitance (5 min)
Slug: `what-is-capacitance`
Body (intermediate tier): Capacitors store charge proportional to voltage. The relation
Q = CV has consequences for transient response …
→ Read the full note: `<VaultHoverCard slug="what-is-capacitance">`

### Step 2 — Foundation: Why capacitors smooth voltage (5 min)
Slug: `why-capacitors-smooth-voltage`
...

### Step 3 — Mechanism: ESR and high-frequency decoupling (8 min)
Slug: `esr-and-high-frequency-decoupling`
...

### Step 4 — Application: 10uF ceramic on ESP32 VIN (10 min)
Slug: `10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts`
This is the canonical worked example. If your takeaway from steps 1-3 didn't prepare you
for this, re-read Step 2.

### Step 5 — Deep-dive: ESR vs MLCC frequency response (fallback to intermediate)
Slug: `mlcc-esr-frequency-response`
_Note: expert tier unavailable for this slug; rendering intermediate._

### Step 6 — Pre-test: DRC rule — missing decoupling cap
Slug: `drc-should-flag-missing-decoupling-cap-on-ic-vcc-pin`
If you understood steps 1-5, you should be able to explain WHY this DRC rule fires.
```

## JSON output

```json
{
  "topic": "decoupling-capacitors",
  "audience": "intermediate",
  "steps": [
    {
      "step": 1,
      "stage": "foundation",
      "slug": "what-is-capacitance",
      "rendered_tier": "intermediate",
      "tier_fallback": false,
      "est_read_min": 5,
      "body_excerpt": "..."
    }
  ],
  "total_min": 28,
  "flags": ["step 5: fell back to intermediate tier (expert unavailable)"]
}
```

## Integration points

- **T11 `/vault-audience`** — this skill consumes the tier markers T11 validates.
- **T2 `/vault-validate`** — notes with missing required fields are deprioritized in selection.
- **T3 `/vault-index`** — backlink counts break ties within a stage.
- **T7 `/vault-health`** — reports learn-path coverage per MOC (how many MOCs have full 8-step paths possible).
- **Plan 13-learning-surfaces Learn Hub** — primary UI consumer; Learn articles become entry points that render /vault-teach paths.
- **/arscontexta:tutorial** — can invoke /vault-teach to bootstrap a tutorial on a domain.

## When coverage is thin

Run in a low-coverage domain → learn-path will have:
- Steps with "(no note available — T4 MOC expansion needed)" placeholders
- Recommended /vault-gap topics to seed
- Flag: "path is incomplete — only 3 of 8 stages filled"

This is SIGNAL, not noise — the system is honestly reporting gaps.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|---|---|---|
| Generate path from orphan MOC alone | Path collapses to 1-2 steps | Cross-reference qmd_deep_search + MOC links |
| Fabricate notes to fill missing stages | Destroys vault trust | Leave stage slot empty; emit /vault-gap recommendation |
| Use note body as-is when tier missing | Confuses learners (wrong depth) | Flag fallback explicitly; render closest-available tier |
| Long linear paths (20+ steps) | Cognitive overload | Cap at 8 steps; recurse into next path if needed |
| Score only on MOC linkage | Misses valuable orphan notes | qmd_deep_search complements MOC walk |

## Version history

- **1.0 (2026-04-18)** — initial ship. Depends on T2 (frontmatter), T3 (backlinks), T11 (tier markers).
