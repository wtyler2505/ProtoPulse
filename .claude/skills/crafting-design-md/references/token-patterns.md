# Token Patterns

Palette patterns, typography scales, contrast math, and token-reference
conventions. Load when the user wants thorough coverage or is concerned
about accessibility.

## Contents

- Color Palette Patterns
- Typography Scale Patterns
- Spacing Scale Patterns
- Rounded Scale Patterns
- WCAG Contrast Math
- Token Naming Conventions
- Token Reference Hygiene

## Color Palette Patterns

The spec asks for at least `primary`. Beyond that, these are the
palette shapes that compose well with how agents reason about UI.

### Minimum viable (4 tokens)

Enough to get a single-surface app styled.

```yaml
colors:
  primary: "#<hex>"      # brand anchor; primary action
  neutral: "#<hex>"      # background canvas
  surface: "#<hex>"      # card / panel
  on-primary: "#<hex>"   # text on primary
```

### Semantic quartet (Material-style)

The convention the spec itself recommends. Covers most UI without
token sprawl.

```yaml
colors:
  primary: "#<hex>"
  secondary: "#<hex>"
  tertiary: "#<hex>"
  neutral: "#<hex>"
  surface: "#<hex>"
  on-primary: "#<hex>"
  on-secondary: "#<hex>"
  on-tertiary: "#<hex>"
  on-surface: "#<hex>"
  error: "#<hex>"
  on-error: "#<hex>"
```

### Dark-UI pattern

Dark apps usually need a two-step tonal system so cards read as
"lifted" without shadow.

```yaml
colors:
  primary: "#<dark-hex>"        # app background
  surface: "#<slightly-lighter>"
  surface-raised: "#<lighter-still>"
  border: "#<hairline>"
  on-surface: "#<high-contrast text>"
  on-surface-muted: "#<secondary text>"
  accent: "#<the one chromatic color>"
  on-accent: "#<text on accent>"
```

The tonal steps should be small — one or two luminance steps apart.
Three-step systems usually muddy.

### Numeric-scale pattern (Tailwind-style)

When the user is coming from Tailwind or a numbered-scale design
system, preserving the `-50 … -900` suffixes is fine — the spec is
neutral on naming convention as long as keys resolve as strings.

```yaml
colors:
  primary-50:  "#<hex>"
  primary-100: "#<hex>"
  primary-500: "#<hex>"    # the "base" primary
  primary-900: "#<hex>"
```

If you go this route, still define a semantic alias at the top so
components have a canonical reference:

```yaml
colors:
  primary: "{colors.primary-500}"   # NOTE: not supported at root
```

Token references at the root of `colors:` are **not** part of the
spec — references are for use *inside* `components` or typography.
Instead, just duplicate the hex at `primary:` and treat `primary-500`
as a documentation breadcrumb.

## Typography Scale Patterns

### Minimum viable (2 tokens)

```yaml
typography:
  headline-lg:
    fontFamily: <family>
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
  body-md:
    fontFamily: <family>
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
```

### Standard scale (9–11 tokens)

The spec's recommended scale names. Most design systems land here.

```yaml
typography:
  display:         { ... }   # hero / landing
  headline-lg:     { ... }   # page titles
  headline-md:     { ... }   # section titles
  headline-sm:     { ... }   # subsection titles
  body-lg:         { ... }   # intro paragraphs
  body-md:         { ... }   # default body
  body-sm:         { ... }   # dense / secondary
  label-lg:        { ... }   # form labels
  label-md:        { ... }   # button text, tags
  label-sm:        { ... }   # metadata, captions
  caption:         { ... }   # timestamps, fine print
```

### Modular scale ratios

When asked "what size should each step be?", these ratios give pleasant
results. Base at 1rem (16px) and multiply outward.

| Ratio       | Feel              | Example sequence (rem)                         |
|-------------|-------------------|------------------------------------------------|
| 1.125       | Close, utility    | 0.79 • 0.89 • 1 • 1.125 • 1.27 • 1.42          |
| 1.25 (maj3) | Balanced default  | 0.64 • 0.8 • 1 • 1.25 • 1.563 • 1.953          |
| 1.333 (4th) | Expressive        | 0.563 • 0.75 • 1 • 1.333 • 1.777 • 2.369       |
| 1.414 (√2)  | Publication       | 0.5 • 0.707 • 1 • 1.414 • 2 • 2.828            |
| 1.618 (φ)   | Dramatic          | 0.382 • 0.618 • 1 • 1.618 • 2.618 • 4.236      |

### Line-height rule of thumb

- Display and large headlines: **1.05 – 1.15** (unitless)
- Body text: **1.5 – 1.65**
- Labels / captions / buttons: **1.0 – 1.3**

Unitless lineHeight is the recommended CSS practice and is spec-valid.

### Letter-spacing rule of thumb

- Large headlines: tighten (`-0.02em` to `-0.01em`)
- Body: default (omit, or `0`)
- Uppercase labels: open up (`+0.05em` to `+0.15em`)

## Spacing Scale Patterns

### 4px / 8px grid (standard)

```yaml
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
```

### 4-step geometric (compact)

```yaml
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
```

### Golden-ratio (editorial / generous)

```yaml
spacing:
  sm: 8px
  md: 13px
  lg: 21px
  xl: 34px
  2xl: 55px
```

Named roles that commonly sit alongside the scale:

```yaml
spacing:
  base: 16px           # 1rem anchor
  gutter: 24px         # between columns
  margin: 32px         # from viewport edge
```

## Rounded Scale Patterns

### Sharp / engineered (0–4px)

```yaml
rounded:
  none: 0px
  sm: 2px
  md: 4px
```

### Balanced / default (4–16px)

```yaml
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
```

### Soft / friendly (8–24px + pill)

```yaml
rounded:
  sm: 8px
  md: 16px
  lg: 24px
  full: 9999px
```

`full: 9999px` is the convention for pill shapes; agents read any
value above ~1000px as "pill."

## WCAG Contrast Math

The linter's `contrast-ratio` rule uses the WCAG 2.x relative-luminance
formula. Thresholds:

| Pair                              | WCAG AA  | WCAG AAA |
|-----------------------------------|----------|----------|
| Normal text (< 18pt / < 14pt bold) | 4.5 : 1  | 7.0 : 1  |
| Large text (≥ 18pt / ≥ 14pt bold)  | 3.0 : 1  | 4.5 : 1  |
| Graphical objects, UI components  | 3.0 : 1  | n/a      |

### Quick formula

For each sRGB channel `C` ∈ {R, G, B} as a 0–1 value:

```
C_linear = C/12.92                    if C ≤ 0.03928
         = ((C + 0.055) / 1.055)^2.4  otherwise

L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear

contrast = (L_lighter + 0.05) / (L_darker + 0.05)
```

Use `scripts/contrast.py` in this skill for a quick offline check.

### Patterns that usually pass AA

- Near-black text (`#1A1C1E`) on warm off-white (`#F7F5F2`) — 15+ : 1
- White text on saturated accent (hue-dependent; test) — usually 4.5+
- Dark-mode: light-gray text (`#C8D1CA`) on near-black surface — 10+

### Patterns that usually fail AA

- Mid-gray on white
- Light accent on white (yellow, cyan, lime)
- Saturated color on saturated color of similar luminance
- White text on bright primary in the 40–60% luminance band (e.g.
  saturated teal, red-orange) — marginal

When a user insists on a failing pair, the options are:

1. Darken the background or lighten the foreground by 1–2 luminance
   steps.
2. Restrict the pair to large text only and document it in `## Do's
   and Don'ts`.
3. Add a darker chroma-matched variant as a separate token and use
   that for text surfaces.

## Token Naming Conventions

The spec accepts any descriptive string key. These conventions are
non-normative but produce the most predictable agent behavior.

### Colors

- `primary` / `secondary` / `tertiary` / `neutral` — semantic roles
- `surface`, `surface-raised`, `surface-sunken` — layered surfaces
- `on-<token>` — text/icon color paired with a background token
  (`on-primary`, `on-surface`)
- `error` / `warning` / `success` / `info` — state colors
- `border` / `divider` — hairline separators
- `muted` — secondary text / captions

### Typography

- Size tiers: `-sm` / `-md` / `-lg` / `-xl`
- Role prefixes: `display-`, `headline-`, `body-`, `label-`, `caption`
- Special roles: `code-inline`, `code-block`, `link`

### Spacing & rounded

- Scale: `none` / `xs` / `sm` / `md` / `lg` / `xl` / `2xl` / `3xl` /
  `full`
- Named roles: `base`, `gutter`, `margin`, `inset`

### Components

- `<element>-<variant>`: `button-primary`, `button-secondary`,
  `input-default`, `chip-tag`, `card-elevated`
- State suffix: `-hover`, `-active`, `-pressed`, `-focus`,
  `-disabled`, `-error`
- Size suffix: `-sm`, `-md`, `-lg`

## Token Reference Hygiene

References give you one source of truth per value. Use them whenever
a value would otherwise be duplicated.

### Do

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
```

### Don't

```yaml
components:
  button-primary:
    backgroundColor: "#D64F27"       # literal duplicates the token
    textColor: "#FFF8EF"
    rounded: 4px
```

Literal values in `components` are allowed but they break the promise
that changing `colors.primary` updates every consumer.

### Scope of references

- References must resolve to a primitive (color hex, dimension) in
  every section *except* `components`.
- Inside `components`, references may resolve to composite typography
  tokens: `typography: "{typography.body-md}"`.
- References to unresolved paths trigger `broken-ref` — the only
  hard error the linter emits.

### Orphans

A color token defined but never referenced by a component triggers
the `orphaned-tokens` warning. It's not fatal — agents still use
orphan tokens for prose-driven styling — but it's a hint that either
the token is dead weight or a component is missing.
