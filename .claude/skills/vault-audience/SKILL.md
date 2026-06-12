---
name: vault-audience
description: Generate audience-tier section stubs for progressive disclosure in vault notes. Notes use `### [beginner]` / `### [intermediate]` / `### [expert]` body markers; the shipped `<VaultExplainer tier={...}>` component renders the section matching the caller's tier. This skill appends stub headings (`--fill-stubs`) for tiers a note declares in `audience:` frontmatter but lacks in its body. Validation of declared-vs-present tiers is /vault-validate's job (lint warning), not this skill's. Triggers on "/vault-audience", "/vault-audience --fill-stubs [slug]", "generate audience stubs for X", "add tier sections to Y".
version: "1.1"
user-invocable: true
context: fork
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[slug-or-path] [--fill-stubs] [--tier beginner|intermediate|expert] [--json]"
---

## EXECUTE NOW

**Target: $ARGUMENTS**

Parse flags:
- `--fill-stubs` — for notes declaring audience tiers that don't have corresponding body sections, append section stubs. Does NOT write content — just the headings + `_TODO_` placeholder.
- `--tier <t>` — restrict to one tier.
- `--json` — machine-readable output.

**Execute these steps:**

1. **Resolve target** — single slug, glob, or whole vault.
2. **Parse note body** — find section markers matching `^#{2,3}\s+\[(beginner|intermediate|expert)\]\s*` (H2 or H3 level; case-insensitive).
3. **Compare declared vs present** — frontmatter `audience: [...]` is the contract; body sections fulfill it. (For a report-only audit of this, use `/vault-validate` — its lint pass WARNs on declared-but-unfulfilled tiers. This skill only acts on the gaps.)
4. **With `--fill-stubs`** — append missing section headings with `_TODO_` placeholder. Does not overwrite existing content. Without `--fill-stubs`, just list the gaps that WOULD be filled and stop.

**Pipeline discipline** — read-only by default. `--fill-stubs` writes only to the body area, never frontmatter, and never to `knowledge/archive/`.

**START NOW.** Reference below defines marker protocol, the shipped UI contract, live-count commands, rollout plan.

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

## Why markers, not separate notes

Splitting one concept across three note files breaks the atomic-note principle and fractures incoming links. A single note with internal tiers preserves the claim as a unit while letting the UI deliver audience-appropriate depth.

## UI contract — the SHIPPED component

The consumer is `<VaultExplainer>` at `client/src/components/ui/vault-explainer.tsx`
(this is shipped code; read it before changing the marker protocol — the regex there
is `^#{2,3}\s*\[(beginner|intermediate|expert)\]\s*$`, case-insensitive, multiline).

```tsx
<VaultExplainer
  slug="esp32-gpio12-must-be-low-at-boot-..."
  tier="beginner"          // 'beginner' | 'intermediate' | 'expert'
>
  Why is this wrong?
</VaultExplainer>
```

Actual behavior (per the component source):

- **`tier` prop** (`VaultAudienceTier = 'beginner' | 'intermediate' | 'expert'`), **defaults to `'intermediate'`**. There is no `userMode`/persona prop and no "educator renders all tiers" mode — `useWorkspaceMode()` wiring is a future task under 17-shell-header-nav (per the component's own header comment).
- **No markers in the body → the whole body renders.** Untiered legacy notes degrade gracefully; tiering is purely additive.
- **Requested tier missing → the FIRST tiered section renders** (not a beginner→intermediate→expert fallback chain).
- Renders collapsed by default (`defaultOpen` prop); expands to title + summary + tier section + topic chips.
- On 404 it shows a "Suggest this note" CTA when `onSuggestNote` is provided (pairs with `/vault-gap --source user`).
- `<VaultHoverCard>` (the tooltip sibling) does NOT do tier filtering — it renders `description` only. Markers matter only for explainer-class surfaces.

## Live coverage counts (never hardcode these)

Coverage numbers drift — compute them at run time:

```bash
# Notes with at least one tier marker in the body:
rg -l --pcre2 '^#{2,3}\s*\[(beginner|intermediate|expert)\]' knowledge/ | wc -l

# Total notes:
fd -e md . knowledge/ --exclude archive --exclude index.md | wc -l

# Notes DECLARING audience tiers in frontmatter:
rg -l '^audience:' knowledge/ | wc -l
```

Report whatever those return. (At the 2026-06-11 audit the body-marker count was 0 —
the protocol is defined and the UI ships, but no note has been tiered yet. Treat any
example numbers you see in older docs as illustrative, not current.)

## Fill-stubs behavior

For a note declaring `audience: [beginner, intermediate]` but missing the `[intermediate]` section, append:

```markdown
### [intermediate] _TODO_

_Stub written by /vault-audience on YYYY-MM-DD. Please fill with intermediate-tier content: physics-level explanation + 1-2 cross-links to adjacent notes._
```

Never overwrites existing text. Never fills with AI-generated content (that's `/extract`'s job with a revise-pass).

## Rollout plan (integration with broader system)

- **Phase 1** (done) — marker protocol defined; `<VaultExplainer>` shipped and parses markers.
- **Phase 2** (current) — seed tier sections via `--fill-stubs` + `/extract`/`/revisit` passes. Body-marker coverage starts at 0.
- **Phase 3** — T13 `/vault-teach` learn-path generator benefits once ~20% of notes have beginner tiers.
- **Phase 4** — `useWorkspaceMode()` wiring (17-shell-header-nav) makes `tier` follow the workspace persona automatically.

## Integration points

- **T2 `/vault-validate`** — owns validation: its lint pass WARNs when frontmatter declares a tier with no matching body section. This skill only generates stubs.
- **T7 `/vault-health`** — can report audience coverage using the live-count commands above.
- **T13 `/vault-teach`** — consumes tier markers to build ordered reading sequences.
- **`client/src/components/ui/vault-explainer.tsx`** — primary UI consumer (shipped).

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|--------------|--------------|---------|
| Split one note into three (beginner/intermediate/expert files) | Destroys atomic-note property; fractures backlinks | Single note, tiered body sections |
| Fill stubs with AI content without verification | Introduces unverified content | Only append empty stubs; real content goes through /extract or manual review |
| Declare `audience: [expert]` only but write beginner content | Tier selection misses the note | Align frontmatter with actual body tiers |
| Nest tiered sections (e.g. `[beginner]` inside `[expert]`) | Parser doesn't handle; UI breaks | Flat tier structure; one level deep |
| Use tier labels for categorization (e.g. `[passive-components]`) | Abuses the schema; collides with audience | Use `topics:` frontmatter for categorization |
| Hardcode coverage stats in docs/skills | Numbers rot immediately | Run the live-count rg commands |

## Version history

- **1.1 (2026-06-11)** — validation half moved to `/vault-validate` lint (declared-vs-present WARN); UI contract rewritten to match the SHIPPED `vault-explainer.tsx` (`tier` prop, intermediate default, first-section fallback, no educator mode); hardcoded coverage numbers replaced with live-count commands.
- **1.0 (2026-04-18)** — initial ship. Defined marker protocol, validator, fill-stubs, speculative UI contract.
