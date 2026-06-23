# DESIGN.md Spec Reference (v alpha)

Condensed reference for the official Google Labs DESIGN.md spec. Source:
https://github.com/google-labs-code/design.md/blob/main/docs/spec.md

Load this file when writing YAML front matter, when a token type is
ambiguous, when section order needs confirmation, or when a linter
finding needs to be interpreted.

## Contents

- File Structure
- Token Schema
- Token Types
- Section Order
- Per-Section Contents
- Component Properties
- Consumer Behavior for Unknown Content
- Linter Rules
- CLI Reference
- Export Formats

## File Structure

A DESIGN.md file has two layers:

1. **YAML front matter** — machine-readable tokens, delimited by `---`
   fences at the top of the file.
2. **Markdown body** — human-readable rationale organized into `##`
   sections.

Tokens are the normative values. Prose is for context and application
guidance.

## Token Schema

```yaml
version: <string>          # optional, current: "alpha"
name: <string>             # required
description: <string>      # optional
colors:
  <token-name>: <Color>
typography:
  <token-name>: <Typography>
rounded:
  <scale-level>: <Dimension>
spacing:
  <scale-level>: <Dimension | number>
components:
  <component-name>:
    <token-name>: <string | token-reference>
```

`<scale-level>` is any descriptive string key. Common conventions:
`xs`, `sm`, `md`, `lg`, `xl`, `full`.

## Token Types

| Type            | Format                                   | Example            |
|-----------------|------------------------------------------|--------------------|
| Color           | `#` + hex, sRGB                          | `"#1A1C1E"`        |
| Dimension       | number + unit (`px`, `em`, `rem`)        | `48px`, `-0.02em`  |
| Token Reference | `{path.to.token}` in curly braces        | `{colors.primary}` |
| Typography      | object (see below)                       | see below          |

### Color

Must start with `#` followed by a hex code in sRGB color space. Quote
it in YAML (`"#1A1C1E"`) to avoid YAML's comment-parsing edge cases.

### Dimension

Number with a unit suffix. Valid units: `px`, `em`, `rem`. Negative
dimensions are allowed (`-0.02em` for tight letterSpacing).

### Typography

Object with these fields. All are optional individually, but an empty
Typography object is a warning.

- `fontFamily` — string
- `fontSize` — Dimension
- `fontWeight` — number (e.g. `400`, `700`). Bare numbers and quoted
  strings are equivalent in YAML.
- `lineHeight` — Dimension *or* unitless number (e.g. `1.5` means 1.5x
  the `fontSize`). Unitless is recommended CSS practice.
- `letterSpacing` — Dimension
- `fontFeature` — string, configures CSS `font-feature-settings`
- `fontVariation` — string, configures CSS `font-variation-settings`

### Token References

Wrap the path in curly braces: `"{colors.primary}"`. References must
resolve to a primitive value in every section *except* `components`,
where references to composite values like `"{typography.body-md}"` are
allowed.

Broken references are the spec's only hard error-level linter finding.

## Section Order

Eight canonical sections, `##` heading level. Any can be omitted, but
those present must appear in this order. Duplicates are a rejection
error.

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

An optional `<h1>` may appear for document titling; it is not parsed
as a section.

## Per-Section Contents

### 1. Overview (aka Brand & Style)

Holistic prose description of look and feel. Brand personality, target
audience, emotional posture. Foundational context for high-level
stylistic decisions when a specific rule isn't explicit. No tokens.

### 2. Colors

Prose description of each color's role. At minimum, `primary` must be
defined in the `colors:` front-matter map. Common convention for
multiple palettes:
`primary`, `secondary`, `tertiary`, `neutral`.

Additional recommended semantic names: `surface`, `on-surface`,
`error`, and `on-*` variants for text-on-surface colors.

### 3. Typography

Prose description of font families and per-level roles. Most systems
define 9–15 typography levels. Semantic naming categories: `headline`,
`display`, `body`, `label`, `caption`, optionally subdivided by size
(`-sm`, `-md`, `-lg`).

Recommended token names: `headline-display`, `headline-lg`,
`headline-md`, `body-lg`, `body-md`, `body-sm`, `label-lg`,
`label-md`, `label-sm`.

### 4. Layout (aka Layout & Spacing)

Prose description of the layout model (fluid grid, fixed-max-width,
container-queries, safe-area-aware, etc.). Backed by `spacing:` tokens
— a `map<string, Dimension | number>`. Unitless numbers are valid for
column counts or ratios.

Common scale: `base`, `xs`, `sm`, `md`, `lg`, `xl`, plus named roles
like `gutter`, `margin`.

### 5. Elevation & Depth (aka Elevation)

Prose description of how hierarchy is conveyed. If using shadows,
specify spread, blur, color. If flat, name the alternative mechanism
(tonal layers, borders, color contrast). No token type in the current
spec — this section is prose-only.

### 6. Shapes

Prose describing the corner-radius posture. Backed by `rounded:`
tokens — a `map<string, Dimension>`. Recommended names: `none`, `sm`,
`md`, `lg`, `xl`, `full` (typically `9999px`).

### 7. Components

Prose plus `components:` tokens. Each entry is a component name mapped
to a group of property tokens. Values may be literal or references.

Variants for UI states (hover, active, pressed, disabled, focus) live
under separate but related keys:
`button-primary`, `button-primary-hover`, `button-primary-active`.

Agents consider all related variants when styling.

### 8. Do's and Don'ts

Practical guardrails as a bulleted list. No tokens. Four to eight
items is the typical range.

## Component Properties

Valid properties on a component entry:

| Property          | Type          |
|-------------------|---------------|
| `backgroundColor` | Color         |
| `textColor`       | Color         |
| `typography`      | Typography    |
| `rounded`         | Dimension     |
| `padding`         | Dimension     |
| `size`            | Dimension     |
| `height`          | Dimension     |
| `width`           | Dimension     |

Values may be literals or token references. The `components` section
is the one place references to composite typography tokens
(`"{typography.body-md}"`) are allowed.

Unknown properties are accepted with a warning — the spec is alpha and
domain-specific extensions are explicitly tolerated.

## Consumer Behavior for Unknown Content

| Scenario                   | Behavior                     | Example                         |
|----------------------------|------------------------------|---------------------------------|
| Unknown section heading    | Preserve; no error           | `## Iconography`                |
| Unknown color token name   | Accept if value is valid     | `surface-container-high`        |
| Unknown typography level   | Accept as valid typography   | `telemetry-data`                |
| Unknown spacing value      | Accept; store as string      | `grid-columns: '5'`             |
| Unknown component property | Accept with warning          | `borderColor`                   |
| Duplicate section heading  | Error; reject file           | Two `## Colors` blocks          |

## Linter Rules

Seven rules run by `npx @google/design.md lint`. Each has a fixed
severity.

| Rule                  | Severity | What it checks                                                                  |
|-----------------------|----------|---------------------------------------------------------------------------------|
| `broken-ref`          | error    | Token references that don't resolve                                             |
| `missing-primary`     | warning  | Colors defined but no `primary` — agents auto-generate one                      |
| `contrast-ratio`      | warning  | Component bg / text pairs below WCAG AA (4.5:1)                                 |
| `orphaned-tokens`     | warning  | Color tokens defined but never referenced by any component                      |
| `missing-typography`  | warning  | Colors defined but no typography tokens — agents use default fonts              |
| `section-order`       | warning  | Sections appear out of canonical order                                          |
| `token-summary`       | info     | Count of tokens in each section                                                 |
| `missing-sections`    | info     | Optional sections (spacing, rounded) absent when other tokens exist             |

Exit code `1` if any errors are present, `0` otherwise.

## CLI Reference

### `lint`

```
npx @google/design.md lint DESIGN.md
npx @google/design.md lint --format json DESIGN.md
cat DESIGN.md | npx @google/design.md lint -
```

Returns JSON with `findings[]` and `summary` keys.

### `diff`

```
npx @google/design.md diff before.md after.md
```

Reports token-level changes between two versions. Exit `1` if the
"after" file has more errors or warnings than "before".

### `export`

```
npx @google/design.md export --format tailwind DESIGN.md > theme.json
npx @google/design.md export --format dtcg    DESIGN.md > tokens.json
```

Formats: `tailwind` (Tailwind theme config) or `dtcg` (W3C Design
Tokens Format).

### `spec`

```
npx @google/design.md spec
npx @google/design.md spec --rules
npx @google/design.md spec --rules-only --format json
```

Outputs the DESIGN.md format specification — useful when injecting
spec context into an agent prompt programmatically.

### Programmatic API

```js
import { lint } from '@google/design.md/linter';
const report = lint(markdownString);
// report.findings    — Finding[]
// report.summary     — { errors, warnings, info }
// report.designSystem — parsed DesignSystemState
```

## Export Formats

DESIGN.md tokens are inspired by the W3C Design Token Format
(designtokens.org). The `export` command converts tokens to:

- **Tailwind** — `tailwind.theme.json` suitable for `tailwind.config.js`
- **DTCG** — `tokens.json` following the W3C Design Tokens Format Module

This makes DESIGN.md interchangeable with Figma variables, Style
Dictionary, and any other DTCG-aware tooling.
