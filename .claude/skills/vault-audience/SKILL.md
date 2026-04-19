---
name: vault-audience
description: Validate + generate audience-gated vault note bodies for progressive disclosure. Notes use `### [beginner]` / `### [intermediate]` / `### [expert]` section markers; the `<VaultExplainer audience={userMode}>` UI component renders only the matching section, with a "show more detail" escalator. This skill validates the marker protocol, checks coverage vs the note's declared `audience:` frontmatter, and can generate stubs for missing tiers. Triggers on "/vault-audience", "/vault-audience check [slug]", "validate audience sections", "generate audience stubs for X", "which notes have beginner-ready content".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[slug-or-path] [--audit] [--fill-stubs] [--tier beginner|intermediate|expert] [--json]"
---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse flags:
- `--audit` — vault-wide coverage report (which notes have which tiers).
- `--fill-stubs` — for notes declaring audience tiers that don't have corresponding body sections, append section stubs. Does NOT write content — just the headings + `_TODO_` placeholder.
- `--tier <t>` — restrict to one tier.
- `--json` — machine-readable output.

**Execute these steps:**

1. **Resolve target** — single slug, glob, or whole vault.
2. **Parse note body** — find section markers matching `^#{2,3}\s+\[(beginner|intermediate|expert)\]\s*` (H2 or H3 level; case-insensitive).
3. **Compare declared vs present** — frontmatter `audience: [...]` is the contract; body sections fulfill it.
4. **Report**:
   - **missing**: declared in frontmatter but no matching section.
   - **orphan section**: section in body but tier not in frontmatter `audience`.
   - **uncovered note**: no section markers at all (legacy / not-yet-upgraded).
5. **With `--fill-stubs`** — append missing section headings with `_TODO_` placeholder. Does not overwrite existing content.

**Pipeline discipline** — read-only by default. `--fill-stubs` writes only to the body area, never frontmatter, and never to `knowledge/archive/`.

**START NOW.** Reference below defines marker protocol, UI contract, rollout plan.

---

## Marker protocol

A note targets multiple audiences by declaring them in frontmatter:

```yaml
audience: [beginner, intermediate, expert]
```

And by organizing body content into matching sections:

```markdown
## Claim
(Universal content — always shown)

### [beginner] What this means
Plain-English. Mentioned specs; no math.

### [intermediate] Why it happens
Physics-level. Some math. References adjacent notes.

### [expert] Edge cases
Quirks, workarounds, failure modes, contested data.

## Evidence
(Universal content — always shown)
```

The `<VaultExplainer audience={userMode}>` component (from `16-design-system.md` Phase 8) renders:
- All non-tiered H2 sections (always).
- The single tiered section matching the user's mode (hides others).
- A "Show all tiers" escalator toggle for curious users.

## Why markers, not separate notes

Splitting one concept across three note files breaks the atomic-note principle and fractures incoming links. A single note with internal tiers preserves the claim as a unit while letting the UI deliver audience-appropriate depth.

## UI contract (consumed by 16-design-system Phase 8)

```tsx
<VaultExplainer slug="esp32-gpio12-must-be-low-at-boot-..." audience={userMode}>
  {/* internal: fetches note body, filters sections by tier */}
</VaultExplainer>
```

Rules:
- `userMode === 'student'` → render beginner section + universal.
- `userMode === 'hobbyist' | 'intermediate'` → render intermediate + universal. Fallback to beginner if intermediate absent.
- `userMode === 'pro' | 'expert'` → render expert + universal. Fallback to intermediate → beginner chain.
- `userMode === 'educator'` → render ALL tiers with tier-label chips (for lesson prep).
- Always include an "Expand detail ▾" button that reveals the next-higher tier.

## Audit output example

`/vault-audience --audit`:

```
## Vault Audience Coverage

Total notes:                    682
With any tiered section:          14 (2.1%)
Untiered (legacy):               668

Declared audience, coverage:
  beginner:      14 declared, 12 sections present (2 missing)
  intermediate:  14 declared,  9 sections present (5 missing)
  expert:        14 declared, 11 sections present (3 missing)

Orphan sections (present but not declared):
  - esp32-gpio12-... has [expert] section but 'expert' not in audience frontmatter

Recommended actions:
  1. /vault-audience --fill-stubs — append stub sections for the 10 coverage gaps
  2. /vault-validate --fix — remove orphan audience declarations OR add them to frontmatter
  3. T13 /vault-teach: once coverage >40%, audience-ordered learn-paths become reliable
```

## Fill-stubs behavior

For a note declaring `audience: [beginner, intermediate]` but missing the `[intermediate]` section, append:

```markdown
### [intermediate] _TODO_

_Stub written by /vault-audience on 2026-04-18. Please fill with intermediate-tier content: physics-level explanation + 1-2 cross-links to adjacent notes._
```

Never overwrites existing text. Never fills with AI-generated content (that's `/extract`'s job with a revise-pass).

## Rollout plan (integration with broader system)

- **Phase 1** (now) — validator + audit live. Coverage ≈2% baseline.
- **Phase 2** — T13 `/vault-teach` learn-path generator benefits once ~20% of notes have beginner tiers.
- **Phase 3** — `<VaultExplainer>` component ships in `16-design-system.md` Phase 8 and consumes tier markers.
- **Phase 4** — `/revisit` pipeline regularly visits low-coverage notes and proposes tier expansions.

## Integration points

- **T2 `/vault-validate`** — adds audience-coverage as a `warning` severity when declared but unfulfilled.
- **T7 `/vault-health`** — reports audience coverage trend weekly.
- **T13 `/vault-teach`** — consumes tier markers to build ordered reading sequences.
- **16-design-system `<VaultExplainer>`** — primary UI consumer.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|--------------|--------------|---------|
| Split one note into three (beginner/intermediate/expert files) | Destroys atomic-note property; fractures backlinks | Single note, tiered body sections |
| Fill stubs with AI content without verification | Introduces unverified content | Only append empty stubs; real content goes through /extract or manual review |
| Declare `audience: [expert]` only but write beginner content | Mode detection misses the note | Align frontmatter with actual body tiers |
| Nest tiered sections (e.g. `[beginner]` inside `[expert]`) | Parser doesn't handle; UI breaks | Flat tier structure; one level deep |
| Use tier labels for categorization (e.g. `[passive-components]`) | Abuses the schema; collides with audience | Use `topics:` frontmatter for categorization |

## Version history

- **1.0 (2026-04-18)** — initial ship. Defines marker protocol, validator, fill-stubs, UI contract.
