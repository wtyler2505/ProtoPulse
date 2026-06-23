---
name: crafting-design-md
description: >-
  Authors production-grade DESIGN.md files — the open Google Labs format
  (Apache-2.0) that encodes a visual identity as YAML design tokens plus
  markdown rationale, so coding agents like Claude Code, Cursor, Windsurf,
  Codex, Copilot, and Google Stitch generate on-brand UIs. Use whenever
  the user asks to create, write, generate, draft, or scaffold a
  DESIGN.md / design.md file; capture a design system, brand, or style
  guide as agent-readable context; set up Claude Code, Cursor, or Stitch
  for consistent UI generation; turn screenshots, a URL, Figma, CSS
  variables, or a Tailwind config into a DESIGN.md; or discuss YAML
  front matter tokens (colors, typography, spacing, rounded, components),
  the eight canonical sections, token references like {colors.primary},
  or `npx @google/design.md lint`. Triggers on phrases like "write me a
  design.md", "make a design system doc", "brand file for Claude Code",
  "Stitch design spec", and on auditing or extracting a DESIGN.md from
  an existing product or codebase.
metadata:
  version: "2.0.0"
  spec_version: "alpha"
  spec_source: "https://github.com/google-labs-code/design.md"
  spec_open_sourced: "2026-04-21"
  community_examples: "https://github.com/VoltAgent/awesome-design-md"
---

# Crafting DESIGN.md

Produces DESIGN.md files that conform to the official Google Labs spec
(`google-labs-code/design.md`, Apache-2.0, spec version `alpha`). The
output is a single markdown file that any spec-aware coding agent can use
as persistent design context — identical outputs in Stitch, Claude Code,
Cursor, and the rest.

## How to Use This File

This SKILL.md is the router. It covers the workflow, the spec shape, and
the quality bar. When you need deeper material — the full schema, the
linter rules, richer examples, or extraction heuristics — load the
matching reference. Don't try to carry every token name in your head.

**Reference index:**
- `references/spec-reference.md` — condensed schema, token types, all
  eight sections in order, the seven linter rules, consumer behavior for
  unknown content. Load when writing the YAML front matter or when a
  token type / section order is in doubt.
- `references/examples-gallery.md` — three complete DESIGN.md files in
  very different registers (editorial light, technical dark, playful
  warm). Load when the user gives a vibe but no concrete tokens, or
  when you need a model to mirror.
- `references/token-patterns.md` — palette construction, typography
  scales, WCAG AA/AAA math, token-reference syntax, common naming
  conventions. Load when the user wants exhaustive token coverage or
  is concerned about accessibility.
- `references/extraction-playbook.md` — turning screenshots, URLs,
  Figma/Tailwind dumps, or prose brand briefs into a DESIGN.md. Load
  when the user hands over source material instead of describing a
  system from scratch.
- `references/integration-guide.md` — wiring a finished DESIGN.md into
  Claude Code, Cursor, Windsurf, Stitch, Copilot, Kiro, Cline, Replit,
  Firebase Studio, Gemini/Codex CLI. Includes pre-commit hooks and CI
  snippets. Load when the user wants to know how to make agents
  actually use the file they just authored.
- `references/anti-patterns.md` — 25 common ways DESIGN.md files go
  wrong, organized by category (structural, token, prose,
  accessibility, integration, maintenance). Load when auditing an
  existing DESIGN.md, reviewing a draft, or diagnosing why an agent
  isn't honoring the file.
- `references/agent-consumption.md` — how AI coding agents actually
  read DESIGN.md, which parts carry weight, tuning notes per-agent
  (Claude, Cursor, Stitch, Windsurf, Copilot, Gemini). Load when the
  user asks why an agent is ignoring their DESIGN.md or when tuning
  for a specific agent.

**Assets:**
- `assets/template.md` — an empty skeleton with every section stubbed
  in canonical order. Copy and fill; faster than writing from blank.
- `assets/minimal-example.md` — the smallest valid DESIGN.md (front
  matter + Overview + Colors + Typography). Useful when the user wants
  something tiny to drop into a repo.
- `assets/components-library.md` — a catalog of ~40 canonical
  component entries (buttons, inputs, navigation, data display,
  feedback, overlays, content containers) written as YAML blocks
  ready to lift into a DESIGN.md. Load when populating the
  `components:` section and you want a complete set, not just
  button-primary + input-default.
- `assets/quality-checklist.md` — pre-flight checklist covering
  structure, tokens, prose, accessibility, and integration. Severity
  table for deciding what's a blocker vs. a follow-up. Load before
  delivering any DESIGN.md.

**Scripts:**
- `scripts/contrast.py` — offline WCAG contrast checker. Pass two hex
  colors, get the ratio plus AA/AAA pass/fail for normal and large
  text. Use when you're specifying `button-primary` component colors
  and want to catch contrast problems before the linter does.
- `scripts/validate.py` — **offline linter** implementing the seven
  canonical rules (`broken-ref`, `missing-primary`, `contrast-ratio`,
  `orphaned-tokens`, `missing-typography`, `section-order`,
  `missing-sections`, `token-summary`). Zero dependencies — ships a
  minimal YAML-subset parser. Use this in every delivery; it catches
  errors before `npx @google/design.md lint` is even available. Exit
  code 1 on any error.
- `scripts/export.py` — **offline exporter** to three formats:
  `tailwind` (theme.extend config), `dtcg` (W3C Design Tokens JSON),
  `css` (custom properties under `:root`). Use when the user wants
  to generate a build artifact without depending on npx. Replaces
  `npx @google/design.md export --format …`.

## When This Skill Fires

The description above is the trigger. In practice, the user is doing one
of four things:

1. **Authoring from scratch** — they describe a brand or vibe in prose
   and want a DESIGN.md out the other end.
2. **Extracting from source material** — screenshots, a live URL, a
   Tailwind config, CSS variables, a Figma export, a color palette
   image.
3. **Filling a template** — they've pasted a partial DESIGN.md or list
   of tokens and want it completed and conformant.
4. **Fixing / auditing** — they have a DESIGN.md and want it validated,
   reorganized into canonical section order, or upgraded (e.g. adding
   component variants, hardening contrast).

The workflow below handles all four; the entry point differs but the
shape of the output is identical.

## Core Workflow

### 1. Capture the design intent

Before writing any YAML, get the four things a good DESIGN.md needs to
anchor against:

- **Name & one-line essence.** "Heritage — architectural minimalism
  meets journalistic gravitas." This becomes `name:` in the front
  matter and the opening line of `## Overview`.
- **Primary color + at least one accent.** Hex in sRGB. If the user
  gives a color name ("forest green"), pin it to a specific hex before
  continuing.
- **One font family decision.** Display and body can share a family,
  but agents need at least one concrete `fontFamily` to stop defaulting
  to system sans.
- **A shape posture.** Sharp (2–4px radius), soft (12–24px), or pill
  (`full` / 9999px). This shows up in `rounded` tokens and in
  `## Shapes`.

If any of those four is missing and the user gave enough signal to
guess, propose a concrete value and confirm — don't stall the whole
skill waiting for every token. A reasonable first draft they can react
to beats a five-question interview.

If the user handed over source material instead of prose, switch to
`references/extraction-playbook.md` for the intake procedure, then come
back here for the write-up.

### 2. Draft the front matter (YAML tokens)

The front matter is the normative layer — the values agents read
mechanically. The prose sections come later and explain *why*.

Canonical shape, in this order inside the YAML block:

```yaml
version: alpha              # optional but recommended; current spec version
name: <string>              # required
description: <string>       # optional
colors:
  <token-name>: "#RRGGBB"
typography:
  <token-name>:
    fontFamily: <string>
    fontSize: <Dimension>
    fontWeight: <number>
    lineHeight: <Dimension | unitless-number>
    letterSpacing: <Dimension>
rounded:
  <scale-level>: <Dimension>
spacing:
  <scale-level>: <Dimension | number>
components:
  <component-name>:
    <property>: <value | token-reference>
```

Rules the agent-side parser cares about:

- Colors must be hex-in-sRGB: `"#1A1C1E"` (quoted, `#` required).
- Dimensions need a unit: `px`, `em`, or `rem`. Exception: `lineHeight`
  accepts a unitless multiplier (e.g. `1.5`) and `spacing` scale levels
  accept unitless numbers for things like column counts.
- Token references are `{path.to.token}` in curly braces:
  `"{colors.primary}"`. References resolve to primitives in every
  section *except* `components`, which may reference composite
  typography tokens (`"{typography.body-md}"`).
- Component variants (hover, active, pressed) live under related keys —
  `button-primary`, `button-primary-hover`, `button-primary-active` —
  not as nested objects.

Load `references/spec-reference.md` for the full schema, the complete
list of valid component properties, and the consumer-behavior table for
unknown content. Load `references/token-patterns.md` for palette and
type-scale patterns if the user wants fuller coverage than a minimum
viable token set.

### 3. Write the prose sections

Sections use `##` headings. Any section can be omitted — but every one
that *is* present must appear in this canonical order:

| # | Section              | Aliases                    |
|---|----------------------|----------------------------|
| 1 | Overview             | Brand & Style              |
| 2 | Colors               |                            |
| 3 | Typography           |                            |
| 4 | Layout               | Layout & Spacing           |
| 5 | Elevation & Depth    | Elevation                  |
| 6 | Shapes               |                            |
| 7 | Components           |                            |
| 8 | Do's and Don'ts      |                            |

Duplicate section headings (two `## Colors`) are a spec error — the
consumer rejects the file. Order matters — out-of-order sections emit a
linter warning (`section-order`).

What goes in each section's prose:

- **Overview** — brand personality, target audience, emotional posture.
  The big-picture "why" the tokens exist. Two or three short paragraphs
  is plenty. This is the section the agent leans on when a specific
  rule or token isn't explicit.
- **Colors** — a short prose description per color, naming the role and
  the vibe. The `colors:` tokens in the front matter are the normative
  values; the prose explains *where and why* each color gets used.
  Descriptive names in prose ("Boston Clay", "Midnight Forest Green")
  are fine as long as they map back to systematic token names.
- **Typography** — the font families, the role of each family (display
  vs. body vs. label / metadata), and any per-level quirks (uppercase
  labels, tight headline tracking, etc.).
- **Layout** — the spacing scale, the grid or layout model (fluid,
  fixed-max-width, container-queries), gutter/margin conventions.
- **Elevation & Depth** — how hierarchy is conveyed. If shadows, specify
  spread/blur/color. If flat, name the alternative (tonal layers,
  borders, color contrast).
- **Shapes** — the corner-radius posture and any exceptions.
- **Components** — prose explaining the component tokens defined in the
  front matter. Call out variants and state transitions.
- **Do's and Don'ts** — practical guardrails as a simple bulleted list.
  Four to eight items is the sweet spot; fewer feels thin, more starts
  to sound like a full brand book.

If a section has no tokens behind it (e.g. Elevation on a flat design),
keep the prose but skip the "### Design Tokens" subsection.

### 4. Validate and harden

Before delivering, run the offline validator in this skill — it
implements the seven canonical rules with zero dependencies:

```
python3 scripts/validate.py DESIGN.md
python3 scripts/validate.py DESIGN.md --format json
```

The validator catches every condition the official linter does:

1. **`broken-ref`** (error) — every `{path.to.token}` in `components`
   must resolve. Only hard-error rule.
2. **`missing-primary`** (warning) — colors defined without `primary`.
3. **`contrast-ratio`** (warning) — component `backgroundColor` +
   `textColor` pairs below WCAG AA 4.5:1 for normal text.
4. **`orphaned-tokens`** (warning) — color tokens never referenced.
5. **`missing-typography`** (warning) — colors defined, no typography.
6. **`section-order`** (warning) — `##` headings out of canonical order.
7. **`missing-sections`** / **`token-summary`** (info) — counts and
   absent sections.

For spot-checks: `scripts/contrast.py <bg-hex> <fg-hex>` gives the
raw AA/AAA breakdown for one pair.

If the user has `npx` available, cross-check with the official linter:

```
npx @google/design.md lint DESIGN.md
npx @google/design.md lint --format json DESIGN.md
```

A lint-clean file — zero errors, minimal warnings — is the bar to
ship. See `references/anti-patterns.md` if you're staring at a
warning and unsure whether to fix it or document it, and
`assets/quality-checklist.md` for the full pre-flight pass.

### 5. Deliver

Write the finished file to disk as `DESIGN.md` (canonical filename;
uppercase is the convention used by the official spec and the Stitch
docs). Save it to `/mnt/user-data/outputs/DESIGN.md` and hand the user
the file via `present_files` so they can drop it into their project
root.

If the user's workflow is Claude Code / Cursor / Windsurf, also mention
the canonical mount points:
- Claude Code: add a line to `CLAUDE.md` pointing at `./DESIGN.md`
- Cursor: reference from `.cursor/rules/` or `.cursorrules`
- Kiro: place under `.kiro/steering/`
- Windsurf: reference from `global_rules.md`
- Google Stitch: import via the Design System panel

## Quality Bar — What "Good" Looks Like

A shippable DESIGN.md has:

- **Working front matter.** YAML parses cleanly. Every color is a sRGB
  hex string. Every dimension has a unit or is an explicit unitless
  multiplier in a field that allows it.
- **At least a `primary` color.** The linter warns `missing-primary` if
  colors exist without one, and agents will auto-generate a primary —
  which is rarely what the user wants.
- **At least one typography token** if colors exist. Same reason:
  agents default to system fonts otherwise.
- **Rationale, not just values.** The prose under each section explains
  *why* the tokens are what they are. A DESIGN.md is a brief for an
  agent; values alone give it no judgment for edge cases.
- **Components wired through references.**
  `backgroundColor: "{colors.primary}"` not
  `backgroundColor: "#1A1C1E"`. References compose; literals duplicate.
- **Contrast that passes AA.** 4.5:1 for normal text, 3:1 for large
  text (18pt+ / 14pt+ bold). Fail AA and the file is a trap, not a
  spec.

## Examples

**Example 1 — Prose brief → full DESIGN.md**

User: "Build me a DESIGN.md for a dark terminal-style developer tool.
JetBrains Mono for code, Inter for UI chrome. Green accent — CRT
phosphor kind of green. Sharp corners. No shadows, hierarchy from
borders and color."

Result: Front matter with a `primary: "#0A0E0A"` surface,
`accent: "#39FF14"` phosphor green, `border: "#1F2920"`, Inter in the UI
typography tokens and JetBrains Mono in a `code-inline` and `code-block`
pair. `rounded` maxes out at 4px. `## Elevation & Depth` explains the
zero-shadow posture and names borders as the hierarchy mechanism.
Components include `button-primary` (green background, near-black text
— contrast ratio 15+, easy AA), `input-default`, and a `code-inline`
style.

**Example 2 — Tailwind config → DESIGN.md**

User pastes a `tailwind.config.js` with `theme.extend.colors` and
`fontFamily`. Result: translate each color entry into a `colors:` token
(dropping Tailwind's numeric scale suffixes or preserving them as
`primary-500` style names), translate each `fontFamily` stack into a
`fontFamily` on the most relevant typography level, synthesize the
prose sections from the token names and rough usage inference. Flag to
the user that prose-level rationale is inferred and should be reviewed.

**Example 3 — Screenshot → DESIGN.md**

User: "Here's a screenshot of our product. Make a DESIGN.md."

Result: Load `references/extraction-playbook.md` for the screenshot
intake procedure. Sample 4–6 dominant colors and name them
semantically. Read the two most distinct typographic treatments from
the screenshot and code them as `headline` and `body-md` minimum. Pick
a `rounded` level from visible corner radii. Write the prose with the
explicit caveat that Layout, Elevation, and Do's and Don'ts are
inferred rather than extracted, and invite the user to correct.

## Guidelines

- **Don't pad.** A skinny DESIGN.md that's honest about what's defined
  beats a bloated one full of placeholder tokens the user never chose.
  Every token is a promise to an agent.
- **Prose is for rationale, tokens are for values.** If a prose line is
  just restating a hex code, cut it.
- **Evergreen, not time-stamped.** The spec is at version `alpha`;
  pinning to dated patterns ages the file. Use `version: alpha` in the
  front matter (current) and keep the prose decision-focused rather
  than trend-focused.
- **Escalate contrast failures.** If the brand the user describes
  produces a sub-AA pair, surface it before shipping. A pretty palette
  that fails accessibility is worse than a slightly-modified one that
  doesn't.
- **Don't invent components the user didn't ask for.** A minimum viable
  DESIGN.md can ship with zero `components:` entries. Add them when the
  user needs a contract for specific UI atoms (buttons, chips, inputs),
  not as decoration.
