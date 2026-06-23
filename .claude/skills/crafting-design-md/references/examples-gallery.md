# Examples Gallery

Three complete DESIGN.md files in deliberately different registers.
Use them as reference shapes — mirror the structure, not the tokens.

## Contents

- Example 1 — Editorial Light (Heritage)
- Example 2 — Technical Dark (Phosphor Terminal)
- Example 3 — Playful Warm (Sunday Market)

---

## Example 1 — Editorial Light

Architectural minimalism, journalistic gravitas, high-contrast
neutrals with a single earthy accent. Long-form reading product.

```markdown
---
version: alpha
name: Heritage
description: A premium editorial identity — architectural minimalism meets journalistic gravitas.
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
  surface: "#FFFFFF"
  on-primary: "#F7F5F2"
  on-tertiary: "#FFFFFF"
typography:
  display:
    fontFamily: Public Sans
    fontSize: 3.5rem
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Public Sans
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.015em
  body-md:
    fontFamily: Public Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Public Sans
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.1em
rounded:
  none: 0px
  sm: 4px
  md: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 24px
  margin: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.sm}"
    padding: 12px
    typography: "{typography.label-caps}"
  button-primary-hover:
    backgroundColor: "#9C3925"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview

Architectural Minimalism meets Journalistic Gravitas. The UI evokes a
premium matte finish — a high-end broadsheet or contemporary gallery.
Long-form reading is the first-class citizen. Whitespace is a feature,
not a gap.

The audience is a reader, not a user. Every interaction defers to the
content.

## Colors

The palette is rooted in high-contrast neutrals and a single, evocative
accent.

- **Primary (#1A1C1E):** Deep ink for headlines and core text. Maximum
  readability; a sense of permanence.
- **Secondary (#6C7278):** Sophisticated slate for borders, captions,
  metadata — the utilitarian tier.
- **Tertiary (#B8422E):** "Boston Clay." The sole driver for
  interaction; used exclusively for primary actions and critical
  highlights.
- **Neutral (#F7F5F2):** Warm limestone foundation. Softer, more
  organic than pure white.

## Typography

Two weights of **Public Sans** carry the narrative; **Space Grotesk**
handles technical and label material.

- **Headlines and display:** Public Sans Semi-Bold. Institutional,
  trustworthy.
- **Body:** Public Sans Regular at 16px. Contemporary professionalism,
  long-form readability.
- **Labels & metadata:** Space Grotesk, strictly uppercase with
  generous tracking. Its geometric construction reads as the precision
  of a digital stopwatch.

## Layout

Fluid grid on mobile, fixed-max-width grid on desktop (max 1200px).
Strict 8px spacing scale with a 4px half-step for micro-adjustments.
Components group via containment — related items housed in cards with
generous 24px internal padding.

## Elevation & Depth

Depth comes from tonal layers, not shadow. The background uses the
warm limestone neutral; primary content sits on pure white cards.
Borders are one-pixel slate where separation is needed.

## Shapes

Architectural sharpness. All interactive elements, containers, and
inputs use a minimal 4px corner radius. Enough softness to feel
modern; enough rigidity to stay engineered.

## Components

- **Primary button:** Boston Clay background, white label text,
  uppercase tracking. Hover dims to a deeper ember.
- **Secondary button:** White surface, ink text, slate border. The
  quiet sibling — never competes with primary.
- **Input:** White surface, ink text, slate border, 4px radius. Rest
  state reads like a card that accepts input.

## Do's and Don'ts

- Do use Boston Clay only for the single most important action per
  screen.
- Don't mix rounded and sharp corners in a single view.
- Do preserve WCAG AA contrast (4.5:1 for body, 3:1 for large type).
- Don't mix more than two weights of Public Sans in the same layout.
- Do let whitespace do the work; don't fill every column.
```

---

## Example 2 — Technical Dark

Developer tooling, CRT phosphor accent, zero-elevation, keyboard-first.
Mono everywhere the user might expect to copy a value.

```markdown
---
version: alpha
name: Phosphor
description: A dark terminal-style developer tool. Sharp, borderless, keyboard-first.
colors:
  primary: "#0A0E0A"
  surface: "#0F1410"
  surface-raised: "#141A15"
  border: "#1F2920"
  on-surface: "#C8D1CA"
  on-surface-muted: "#7A8A80"
  accent: "#39FF14"
  accent-dim: "#2ACC10"
  on-accent: "#0A0E0A"
  error: "#FF5555"
  warning: "#FFB454"
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.02em
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'liga' 0, 'calt' 0"
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: 0px
  sm: 2px
  md: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  gutter: 16px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    padding: 8px
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "{colors.accent-dim}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 8px
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 8px
  input-focus:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
  code-inline:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: 2px
    typography: "{typography.code-inline}"
---

## Overview

Phosphor is a developer-tool identity built for long command sessions.
The mental model is a modern terminal wearing dress clothes — dark
surface, phosphor-green interaction, no decoration that doesn't carry
signal.

The target user is a power user typing more than clicking. Chrome
recedes; data and code come forward.

## Colors

- **Primary (#0A0E0A):** Deep neutral black-green. Application
  background.
- **Surface / Surface Raised:** Two-step tonal system for
  app-chrome / cards / panels. One step of difference, never more.
- **Border (#1F2920):** A single hairline value for every separator
  line. Never tinted lighter.
- **Accent (#39FF14):** CRT phosphor green. The only truly chromatic
  color in the palette; reserved for primary action, focus state, and
  inline code highlights.
- **Error / Warning:** Desaturated red and amber. High enough chroma
  to read in diagnostics, low enough not to fight the phosphor.

## Typography

- **UI chrome:** Inter across the board. Headlines, body, labels.
- **Code:** JetBrains Mono for everything the user might paste into a
  terminal or copy out of the UI. Ligatures are disabled in
  `code-inline` by design — engineers want the code they see to match
  the code they type.

## Layout

Compact information density. A 4px base unit, doubled at each scale
step up. Content hugs the left rail of the viewport with a 16px
gutter; no horizontal centering in dense-data views.

## Elevation & Depth

No shadows. Hierarchy comes from two tonal layers (`surface` and
`surface-raised`) plus a single hairline border. Focus state is an
accent-colored outline, not a glow.

## Shapes

Sharp. Primary elements use 2px; larger containers round up to 4px.
Nothing rounder. Pill shapes would break the posture.

## Components

- **Primary button:** Accent-filled, near-black label. Hover dims to
  `accent-dim`; no shadow, no translate.
- **Secondary button:** `surface-raised` background; identical shape
  to primary so keyboard users can predict layout.
- **Input:** Surface background, subtle hairline border, focus swaps
  to `surface-raised` and an accent outline.
- **Inline code:** Surface-raised chip, accent text, code font.

## Do's and Don'ts

- Do use accent-green only for primary action, focus, and code
  highlight. Three contexts total.
- Don't introduce a second chromatic color to the palette.
- Do keep tonal hierarchy to two steps (`surface` and
  `surface-raised`). Three becomes mud.
- Don't add drop shadows. The brand is flat.
- Do disable ligatures in code surfaces; the promise is that what is
  displayed matches what is typed.
- Don't let text fall below 13px in primary UI.
```

---

## Example 3 — Playful Warm

Consumer product, soft curves, warm palette, generous type, friendly
voice. Pretend it's a plant-care app or a neighborhood-market
marketplace.

```markdown
---
version: alpha
name: Sunday Market
description: A warm, friendly consumer product. Soft curves, generous type, an unhurried weekend feel.
colors:
  primary: "#D64F27"
  secondary: "#2E5D4F"
  tertiary: "#F4C95D"
  neutral: "#FFF8EF"
  surface: "#FFFFFF"
  on-primary: "#FFF8EF"
  on-secondary: "#FFF8EF"
  on-neutral: "#2A1E15"
  muted: "#8A7864"
  error: "#C73E3E"
typography:
  display:
    fontFamily: Fraunces
    fontSize: 3rem
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Fraunces
    fontSize: 1.75rem
    fontWeight: 500
    lineHeight: 1.2
  body-lg:
    fontFamily: Nunito
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Nunito
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Nunito
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Nunito
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: 8px
  md: 16px
  lg: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  gutter: 20px
  margin: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: 16px
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "#B8421F"
  button-secondary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    padding: 16px
  chip-tag:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-neutral}"
    rounded: "{rounded.full}"
    padding: 8px
  card-default:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 24px
  input-default:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-neutral}"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview

Sunday Market feels like the farmer's market in a small town two
hours from anywhere — unhurried, warm, a little bit hand-lettered.
The brand voice is a neighbor who knows your name.

The audience is a weekend user: browsing, saving, coming back. Speed
matters less than mood.

## Colors

- **Primary (#D64F27):** Sun-baked terracotta. The main brand color
  and the call-to-action anchor.
- **Secondary (#2E5D4F):** Deep forest. Used for secondary emphasis,
  trust cues, and balance against the warm primary.
- **Tertiary (#F4C95D):** Golden-hour yellow. Tags, chips, seasonal
  flags — the "bright thing on the shelf."
- **Neutral (#FFF8EF):** Warm ivory. The canvas. Calmer than white,
  warmer than grey.
- **Muted (#8A7864):** Soft umber for metadata and captions.

## Typography

A serif-sans pairing. **Fraunces** (a warm, variable serif) carries
display and headline weight — it reads like a hand-drawn sign.
**Nunito** handles body and UI chrome — round, friendly, high
legibility at small sizes.

## Layout

Generous. 8px base scale with doubled jumps. 24px gutter on mobile,
wider margins on desktop. Content flows in asymmetric rows; a strict
grid would fight the tone.

## Elevation & Depth

Soft, short shadows on cards — 0 2px 8px rgba(42, 30, 21, 0.06).
Never harsh. Most separation is tonal (surface vs. neutral) rather
than shadow.

## Shapes

Round. 16px is the workhorse radius; 24px on larger surfaces; pill
shapes (`full`) on buttons and chips. Sharp corners feel clinical
here and should be avoided.

## Components

- **Primary button:** Terracotta pill, ivory label, 16px padding
  (generous, tappable).
- **Secondary button:** Ivory pill with forest label. Same silhouette
  as primary; never competes visually.
- **Tag chip:** Golden pill with dark umber text. For seasonal labels,
  categories, and "new" markers.
- **Card:** White surface with soft shadow, 16px radius, 24px inner
  padding.
- **Input:** Ivory fill (never stark white), 16px radius. A pill
  input would feel too casual for text entry.

## Do's and Don'ts

- Do use terracotta as the single strongest attention color.
- Don't stack more than two chips in a row — it gets loud.
- Do give layouts room to breathe; 40px+ between major sections.
- Don't mix Fraunces and Nunito in the same line of text.
- Do keep shadows soft and warm-tinted; never pure black shadows.
- Don't use sharp corners anywhere; the brand is curvy by policy.
```
