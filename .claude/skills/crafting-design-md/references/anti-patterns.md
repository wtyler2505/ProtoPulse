# Anti-Patterns

Common ways DESIGN.md files go wrong. Load when auditing an existing
DESIGN.md, reviewing a draft you wrote, or catching problems before
delivery.

Each anti-pattern has: **What it looks like**, **Why it fails**, **The
fix.**

## Contents

- Structural Anti-Patterns
- Token Anti-Patterns
- Prose Anti-Patterns
- Accessibility Anti-Patterns
- Integration Anti-Patterns
- Maintenance Anti-Patterns

---

## Structural Anti-Patterns

### 1. Tokens Without Rationale

**What it looks like:** A DESIGN.md that's 95% YAML front matter and
200 words of boilerplate prose underneath.

**Why it fails:** The prose sections are the interpretive layer. When
an agent encounters an edge case the tokens don't cover (a new
component, a weird viewport size, a state you didn't define), it
falls back to the prose. No prose = no judgment.

**The fix:** At least one honest paragraph per section that names
*why* the tokens are what they are. Not marketing copy — rationale.
"Near-black on warm off-white because long-form reading is the
first-class citizen" beats "Bold. Confident. Refined."

---

### 2. Prose Without Tokens

**What it looks like:** Long descriptions of colors, typography, and
spacing "vibes" in the body, with an empty or near-empty YAML front
matter.

**Why it fails:** Agents parse the YAML mechanically. Without tokens,
there's nothing concrete to reference; agents default to system
colors and fonts regardless of how evocative the prose is.

**The fix:** At least the minimum viable set — one color (`primary`),
one typography level (`body-md`), one corner radius (`rounded.md`) —
with concrete values. Prose is for why; YAML is for values.

---

### 3. Duplicate Section Headings

**What it looks like:**

```markdown
## Colors
…primary palette…
## Colors
…semantic tokens…
```

**Why it fails:** The spec treats this as a hard error — the consumer
rejects the file entirely.

**The fix:** Merge into a single `## Colors` section with
subheadings (`### Primary palette`, `### Semantic tokens`) or split
into different canonical sections (`## Colors` and a separate
`## Components` if the content is actually about states).

---

### 4. Sections Out of Canonical Order

**What it looks like:**

```markdown
## Components
…
## Colors
…
## Typography
…
```

**Why it fails:** The linter's `section-order` rule emits a warning.
More importantly, agents that scan sequentially expect the Overview
first — if `## Components` leads, the agent has no context for the
component decisions.

**The fix:** Reorder to canonical:

1. Overview (Brand & Style)
2. Colors
3. Typography
4. Layout (Layout & Spacing)
5. Elevation & Depth
6. Shapes
7. Components
8. Do's and Don'ts

---

### 5. Inventing Non-Canonical Top-Level Sections

**What it looks like:**

```markdown
## Brand Voice
## Product Principles
## Illustration
## Motion
## Voice & Tone
```

**Why it fails:** Agents ignore unrecognized sections in the sense
that they don't map to token categories, so the content is carried as
prose fallback only. More critically, they push canonical sections
further down, reducing the chance an agent's limited context window
captures them.

**The fix:** If the content belongs in DESIGN.md at all, fold it
into `## Overview` or `## Do's and Don'ts`. If it deserves its own
life, make it a separate document (`BRAND.md`, `VOICE.md`) and
cross-link from `## Overview`.

Alpha spec explicitly tolerates unknown sections — the linter won't
reject them — but they are rarely the right call.

---

## Token Anti-Patterns

### 6. Literal Values Where References Belong

**What it looks like:**

```yaml
components:
  button-primary:
    backgroundColor: "#D64F27"
    textColor: "#FFF8EF"
  button-primary-hover:
    backgroundColor: "#B8421F"
    textColor: "#FFF8EF"
```

**Why it fails:** Changing `colors.primary` now requires touching
every component. References exist precisely to avoid this.

**The fix:**

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-primary-hover:
    backgroundColor: "{colors.primary-dim}"
    textColor: "{colors.on-primary}"
```

Literals are defensible for one-off hover/active variants that
intentionally deviate. As a rule: if the same hex appears twice,
promote it to a color token.

---

### 7. Dimensions Without Units

**What it looks like:**

```yaml
rounded:
  sm: 4
  md: 8
spacing:
  md: 16
```

**Why it fails:** Dimensions without units are ambiguous. The spec
requires `px`, `em`, or `rem` for dimensions. Exceptions: `lineHeight`
accepts unitless multipliers, `spacing` scale levels accept unitless
numbers intended for column counts or multipliers.

**The fix:**

```yaml
rounded:
  sm: 4px
  md: 8px
spacing:
  md: 16px
```

---

### 8. Unquoted Hex Colors

**What it looks like:**

```yaml
colors:
  primary: #D64F27
  neutral: #FFF8EF
```

**Why it fails:** YAML parses `#` as a line comment. `primary:`
becomes empty, everything after `#` disappears. Silent data loss.

**The fix:** Quote every hex:

```yaml
colors:
  primary: "#D64F27"
  neutral: "#FFF8EF"
```

---

### 9. Broken Token References

**What it looks like:**

```yaml
colors:
  primary: "#D64F27"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"    # on-primary not defined
```

**Why it fails:** `broken-ref` is the spec's only hard **error** —
the file fails the linter with exit code 1.

**The fix:** Every token path inside `{}` must resolve. For text
colors, always define the `on-*` variant whenever you define the
background:

```yaml
colors:
  primary: "#D64F27"
  on-primary: "#FFF8EF"
```

---

### 10. Orphaned Tokens

**What it looks like:** Fifteen colors defined in the palette, three
referenced by components, the other twelve never used anywhere.

**Why it fails:** `orphaned-tokens` warning. Agents still use orphans
for prose-driven styling, but it's a signal that either:
- The tokens are dead weight (delete them)
- Missing components should reference them (add those components)

**The fix:** Pick one:
- **Delete** unused tokens.
- **Reference them** in appropriate components.
- **Document intentionally-prose-only tokens** in `## Colors`:
  "Boston Clay is reserved for editorial headlines; it is not used in
  components."

---

### 11. Nesting Component Variants as Sub-Objects

**What it looks like:**

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    states:
      hover:
        backgroundColor: "#B8421F"
      active:
        backgroundColor: "#9C3925"
```

**Why it fails:** The spec's component model is flat — one level of
property keys. Nested `states:` objects aren't recognized; agents
ignore them.

**The fix:** Separate keys for each variant, suffixed:

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-primary-hover:
    backgroundColor: "#B8421F"
  button-primary-active:
    backgroundColor: "#9C3925"
```

Agents treat related suffixed keys as variants of the same element.

---

### 12. Over-Engineered Scale Names

**What it looks like:**

```yaml
spacing:
  spacing-scale-level-0: 0px
  spacing-scale-level-1: 4px
  spacing-scale-level-2: 8px
  spacing-scale-level-3: 12px
```

**Why it fails:** Noise with no signal. Longer identifiers don't
make tokens more precise — they just make every reference verbose.

**The fix:** Conventional scale names:

```yaml
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
```

---

## Prose Anti-Patterns

### 13. Marketing Copy as Rationale

**What it looks like:**

> Our brand embodies excellence, innovation, and thoughtful design.
> We believe in bold simplicity and empowered confidence.

**Why it fails:** Agents can't act on this. No concrete guidance for
edge cases. The prose should tell an agent *what to do when you
haven't defined a token*, not how the brand feels to the marketing
team.

**The fix:**

> Near-black text on warm off-white because long-form reading is the
> first-class citizen. Whitespace is a feature, not a gap — when in
> doubt, give content more margin, not less. Interactive elements
> defer to content; the terracotta accent is used exclusively for
> primary actions and critical highlights.

---

### 14. Re-stating Hex Codes in Prose

**What it looks like:**

> - **Primary (#D64F27):** The primary color is hex `#D64F27`.

**Why it fails:** Pure duplication. The YAML already defines the
value; the prose adds nothing.

**The fix:** Name the role, not the value:

> - **Primary (#D64F27):** Sun-baked terracotta. The main brand
>   color and call-to-action anchor. Used exclusively for buttons,
>   links, and critical highlights — never for backgrounds.

---

### 15. Per-Token Prose Bloat

**What it looks like:** A prose paragraph per color (nine paragraphs),
a paragraph per typography level (eleven paragraphs), three paragraphs
on corner radius.

**Why it fails:** Burying agents in prose they don't need. Agents
read the YAML mechanically; the prose is for judgment calls. Three
sentences of high-signal rationale per section beats fifty sentences
of low-signal description.

**The fix:** Prose at the section level, not the token level. If a
token deserves specific prose, it usually means the token's *name*
should carry the meaning instead.

---

## Accessibility Anti-Patterns

### 16. Contrast Failures Hidden in Hover States

**What it looks like:**

```yaml
button-primary:
  backgroundColor: "{colors.primary}"
  textColor: "{colors.on-primary}"     # passes AA
button-primary-hover:
  backgroundColor: "#FF8A5C"           # doesn't — textColor still resolves
                                       # to "{colors.on-primary}" and now fails
```

**Why it fails:** Hover states inherit properties not explicitly
overridden. If the hover background flips to a lighter tint but the
text color stays, you've silently created an AA-failing pair.

**The fix:** Compute contrast for every state variant, not just the
base. Use `scripts/contrast.py` on each background + text pairing.

---

### 17. "Large Text Only" as an Excuse

**What it looks like:** A mid-gray body text pair that fails AA for
normal text (4.5:1) but passes for large text (3.0:1), deployed at
14px body size with no guardrail.

**Why it fails:** Most body text isn't large text. Using the lower
threshold is only legitimate when the token is specifically reserved
for large type — and you document that reservation.

**The fix:** Either (a) bump contrast to AA-normal, or (b) rename
the token to make the reservation explicit (`display-muted` instead
of `body-muted`) and document it in `## Do's and Don'ts`.

---

### 18. Pure Color for State Signaling

**What it looks like:** Error, warning, and success states
distinguished *only* by color — no icon, no shape, no text.

**Why it fails:** Color-blind users can't see the distinction.
Against DESIGN.md's job of driving agent-generated UI, the prose
sections are the hook for this: if you write "use `color.error` for
destructive actions" without adding "paired with an icon", agents
often skip the icon.

**The fix:** In `## Components` or `## Do's and Don'ts`, make the
multi-signal rule explicit:

> Error states combine `{colors.error}` with the `AlertCircle` icon.
> Do not use color alone to signal state; every status indicator
> must include a non-color signal (icon, text, or shape).

---

## Integration Anti-Patterns

### 19. DESIGN.md in a Subdirectory

**What it looks like:** `docs/design.md` or `design-system/DESIGN.md`
with no root-level symlink.

**Why it fails:** Agents scan root-level markdown first and have
inconsistent behavior about deeper paths. Stitch expects root.
Copilot sampling favors root. Windsurf's Cascade reads root
`global_rules.md` but doesn't recurse.

**The fix:** Root-level `DESIGN.md`. If the canonical location must
be nested (monorepo with a shared package), symlink:

```
ln -s packages/design-system/DESIGN.md DESIGN.md
```

---

### 20. Duplicating Tokens into Agent Config

**What it looks like:** `CLAUDE.md` contains:

```markdown
## Design Tokens

- Primary: #D64F27
- Secondary: #2E5D4F
- Headline font: Fraunces
- Body font: Nunito
```

**Why it fails:** Two sources of truth that will drift. When you
update DESIGN.md, CLAUDE.md silently becomes stale.

**The fix:** Pointer only. In `CLAUDE.md`:

```markdown
## Design System

See [DESIGN.md](./DESIGN.md) for tokens and component styles.
```

---

### 21. Version-Controlled Export Files Without a Source-of-Truth Policy

**What it looks like:** `tailwind.config.ts` and `DESIGN.md` both
committed, both edited freely, both claiming to hold the design
tokens.

**Why it fails:** Either one can drift. Usually the config file
wins because it's the one that actually affects the built UI.

**The fix:** Pick one:
- **DESIGN.md is canonical.** Generate `tailwind.config.ts` from
  DESIGN.md via `npx @google/design.md export --format tailwind` as
  a pre-build step. Never hand-edit the config.
- **Tailwind is canonical.** Re-extract DESIGN.md from Tailwind on
  every change (using the extraction playbook). Tedious but honest.

Most teams are better off making DESIGN.md canonical.

---

## Maintenance Anti-Patterns

### 22. Pinning to a Dated Spec Version

**What it looks like:**

```yaml
version: "2024-Q3"
version: "1.0.0-beta.4"
```

**Why it fails:** The spec is at version `alpha` and uses named
milestones. Inventing your own version strings breaks tooling that
reads `version:` to apply version-specific rules.

**The fix:** Use the spec's current version string (`alpha` as of
this writing). If you need to track your team's iteration, add a
comment or a separate field that doesn't collide with the spec:

```yaml
version: alpha
# internal-rev: 2024-Q3
```

---

### 23. Shipping With `missing-primary` Warning

**What it looks like:**

```yaml
colors:
  brand-red: "#D64F27"
  brand-green: "#2E5D4F"
  brand-yellow: "#F4C95D"
```

**Why it fails:** `missing-primary` warning — no `primary` token.
Agents fall back to auto-generating a primary (usually something
off-brand).

**The fix:** Always define `primary:`. If your brand genuinely has no
single anchor color, promote one with the understanding that agents
will reach for it first:

```yaml
colors:
  primary: "#D64F27"          # was brand-red; promoted
  secondary: "#2E5D4F"         # was brand-green
  accent: "#F4C95D"            # was brand-yellow
```

---

### 24. Leaving `TODO` or Placeholder Values in Prose

**What it looks like:**

> ## Overview
> TODO: write this section.

**Why it fails:** Agents read placeholders as-is. A `TODO` in the
Overview section becomes guidance: "the overview is a TODO."

**The fix:** Either fill the section honestly or omit it entirely —
DESIGN.md sections are all optional. Better to have seven good
sections than eight with one placeholder.

---

### 25. No Pre-Commit / CI Validation

**What it looks like:** DESIGN.md edited freely, no automated lint
on change, errors discovered downstream by Stitch or Claude Code at
generation time.

**Why it fails:** The feedback loop between editing DESIGN.md and
seeing the consequence is minutes to hours, during which broken
references or contrast failures silently ship.

**The fix:** A pre-commit hook or CI job that runs
`python3 .claude/skills/crafting-design-md/scripts/validate.py
DESIGN.md` on every change. Exit code 1 on errors only (warnings
are informational). See `references/integration-guide.md` for the
hook snippets.
