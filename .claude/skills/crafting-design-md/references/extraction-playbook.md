# Extraction Playbook

Turning source material into a DESIGN.md. Load this when the user
hands over a screenshot, a URL, a Tailwind config, CSS variables, a
Figma export, or a prose brand brief, instead of describing a system
from scratch.

## Contents

- Source Inventory — What You're Working With
- Screenshot Extraction
- Live URL Extraction
- CSS Variables Extraction
- Tailwind Config Extraction
- Figma Export Extraction
- Prose Brief Extraction
- Inference Flags — What to Call Out

## Source Inventory — What You're Working With

Before extracting, identify which inputs are present. Each source
yields different tokens cleanly and leaves others blank.

| Source              | Colors | Typography | Spacing | Rounded | Components | Prose |
|---------------------|--------|------------|---------|---------|------------|-------|
| Screenshot(s)       | ✓ (sampled) | partial | partial | partial | partial | infer |
| Live URL            | ✓ | ✓ | ✓ | ✓ | partial | infer |
| CSS variables       | ✓ | ✓ | ✓ | ✓ | partial | n/a |
| Tailwind config     | ✓ | ✓ | ✓ | ✓ | n/a | n/a |
| Figma export (JSON) | ✓ | ✓ | ✓ | ✓ | partial | n/a |
| Prose brief         | partial | partial | partial | partial | n/a | ✓ |

Tokens the source doesn't supply are either inferred (and flagged) or
left out of the DESIGN.md with a note to the user.

## Screenshot Extraction

When the only input is one or more screenshots.

### Procedure

1. **Sample dominant colors.** 4–6 colors usually covers a
   screenshot. Look for:
   - The surface / background color
   - The most-used text color
   - The primary action (button fill or accent)
   - Any secondary action or tag color
   - A border / hairline color if visible
2. **Name semantically.** Don't just copy hex values into random
   tokens — assign roles. `primary` is whatever drives the
   call-to-action. `neutral` is whatever the page sits on. Everything
   else gets a semantic role before it gets a color.
3. **Read two typography treatments.** Pick the single most prominent
   headline and the primary body style. Estimate:
   - `fontFamily` (if recognizable — Inter, Helvetica, Georgia, etc.;
     otherwise `sans-serif` / `serif` / `monospace` as a placeholder
     the user will replace)
   - `fontSize` (rough estimate in rem)
   - `fontWeight` (400 default, 500 for medium, 600–700 for bold)
   - `lineHeight` (1.5 for body, 1.1 for display is safe default)
4. **Measure rounding.** Look at the corner radius on buttons and
   cards. Pick one `rounded.md` that captures the posture; add
   `rounded.full` if pills are visible.
5. **Infer spacing.** Hard from a static image. Pick an 8px-grid
   `spacing:` scale by default and flag it as inferred.
6. **Component lift.** If a clear button style and input style are
   visible, lift them into `components:` with references to the
   extracted color tokens.
7. **Flag inferences.** Layout, Elevation, and Do's and Don'ts are
   all inferred for screenshot-only sources. Say so in the Overview
   prose and invite correction.

### Output note

End the Overview with a line like:

> *This DESIGN.md was extracted from a single screenshot. Colors,
> typography, and corner radius are measured; layout, elevation, and
> guidelines are inferred and should be reviewed.*

## Live URL Extraction

When the user gives a URL.

### Procedure

1. **Fetch the page** with `web_fetch` if allowed.
2. **Look in the `<head>`** for linked stylesheets and inline
   `:root { --... }` blocks. Modern design systems publish their
   tokens here.
3. **Grep for common patterns:**
   - `--color-*` / `--primary-*` / `--bg-*` → color tokens
   - `--font-*` / `--text-*` / `font-family:` on `body` / `h1` →
     typography
   - `--space-*` / `--gap-*` / `padding:` on common utility classes →
     spacing
   - `--radius-*` / `border-radius:` → rounded
4. **Sanity-check with the DOM.** If the published tokens don't seem
   to match the visible page (stale tokens, multi-brand rollouts),
   fall back to computed-style extraction on key elements: `<body>`,
   `<button>`, `<h1>`, `<a>`.
5. **Respect ownership.** The tokens are publicly visible CSS — fair
   to use as reference — but a DESIGN.md extracted from a third-party
   site should carry an attribution note in its Overview. Don't
   extract DESIGN.md files from a competitor's site and ship them as
   your own.

## CSS Variables Extraction

When the user pastes a `:root` block or a list of CSS custom
properties.

### Procedure

1. **Bucket each variable** by naming convention:
   - Starts with `--color-`, `--c-`, `--bg-`, `--fg-`, `--text-` → color
   - Starts with `--font-`, `--text-`, `--type-` → typography
   - Starts with `--space-`, `--gap-`, `--size-` → spacing
   - Starts with `--radius-`, `--round-` → rounded
2. **Drop the `--` prefix** when naming the DESIGN.md token.
   `--color-primary` → `primary` in `colors:`.
3. **Preserve the scale** if the user has a numeric one
   (`--color-primary-500` → `primary-500`).
4. **Quote hex values** in the YAML output.
5. **If the CSS has `hsl()` / `oklch()` values**, convert to hex-sRGB
   — the spec only accepts `#RRGGBB` for colors.

## Tailwind Config Extraction

When the user pastes `tailwind.config.js` or `.ts`.

### Procedure

1. **Read `theme.extend.colors`** (or `theme.colors` if not extended).
   Each top-level key becomes a DESIGN.md color token. Nested
   `{ 500: '#...' }` scales can be preserved as `<name>-500` keys or
   flattened to a single token at the `500` (or `DEFAULT`) step.
2. **Read `theme.extend.fontFamily`**. Each key becomes the
   `fontFamily` on the corresponding typography level:
   - `sans` → used by `body-md`, `headline-*`, `label-*`
   - `serif` → usually `display` / `headline-*`
   - `mono` → `code-inline`, `code-block`
3. **Read `theme.extend.fontSize`**. Tailwind gives you tuples like
   `['1rem', { lineHeight: '1.5rem' }]`. Lift both fields.
4. **Read `theme.extend.spacing`**. Map numeric keys to named scale
   levels. Common mapping: `1: xs`, `2: sm`, `4: md`, `6: lg`, `8: xl`.
5. **Read `theme.extend.borderRadius`**. Direct mapping to `rounded:`.
6. **Prose is not in Tailwind.** Synthesize prose sections from the
   token names plus a best-effort inference of intent. Flag the prose
   as inferred.

## Figma Export Extraction

When the user pastes a Figma variables or styles export (JSON, or
DTCG format).

### Procedure

1. **If the export is DTCG format** (`{ "$value": "...", "$type":
   "color" }`), the mapping is nearly direct — DESIGN.md's token
   model is explicitly inspired by DTCG.
2. **Colors:** `$type: "color"` tokens → `colors:` map. Strip the
   variable group path (e.g. `color/primary/500`) down to a flat key
   or preserve the hierarchy as `primary-500`.
3. **Typography:** Figma typography styles bundle family, size,
   weight, line-height, letter-spacing into one style. Lift each as a
   Typography object in `typography:`.
4. **Numbers:** Figma number tokens with a units suffix → Dimensions.
   Unitless numbers → spacing scale-level numbers (valid per spec).
5. **Components:** Figma component styles don't map cleanly to
   DESIGN.md's thin component property model (only `backgroundColor`,
   `textColor`, `typography`, `rounded`, `padding`, `size`, `height`,
   `width`). Lift what fits; drop complex per-part styling.

## Prose Brief Extraction

When the user describes a brand in words with no concrete tokens.

### Procedure

1. **Pin the vibe to four anchors** (from SKILL.md §1): name, primary
   + accent, a font family decision, a shape posture.
2. **Propose concrete values.** "Friendly and warm" becomes a
   terracotta primary (`#D64F27` range) on a warm ivory neutral
   (`#FFF8EF`). Present the proposal; don't stall for ten questions.
3. **Mirror a gallery example.** If the vibe matches one of the three
   in `examples-gallery.md`, use it as a starting scaffold and
   modify. Much faster than generating from zero.
4. **Explicitly mark inferences.** Everything is inferred when the
   brief is prose-only. The user should feel invited to correct any
   token before shipping.

## Inference Flags — What to Call Out

When tokens are inferred rather than extracted, surface that to the
user before shipping. A short banner at the end of the draft covers it:

> **Inference flags for this draft:**
> - Font families: inferred from vibe description (user should confirm).
> - Spacing scale: standard 8px grid applied as a default.
> - Components: only `button-primary` and `input-default` were
>   specified — others left out rather than invented.
> - Prose under Elevation and Do's and Don'ts is inferred; review
>   before shipping.

Users tolerate inference far better when it's labeled. A
source-of-truth file that quietly invents its own truth is a bug
waiting to happen.
