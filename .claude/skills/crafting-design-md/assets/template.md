---
version: alpha
name: <Brand Name>
description: <One-sentence essence — what this design system feels like.>
colors:
  primary: "#<hex>"
  secondary: "#<hex>"
  neutral: "#<hex>"
  surface: "#<hex>"
  on-primary: "#<hex>"
  on-surface: "#<hex>"
  error: "#<hex>"
typography:
  display:
    fontFamily: <family>
    fontSize: 3rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: <family>
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.2
  body-md:
    fontFamily: <family>
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: <family>
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: <family>
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.2
rounded:
  sm: 4px
  md: 8px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 24px
  margin: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 12px
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "#<hex>"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview

<Two or three short paragraphs describing the brand personality,
target audience, and the emotional posture of the UI. This is what
the agent leans on when a specific rule or token isn't explicit.>

## Colors

<Short prose per color, naming role and vibe.>

- **Primary (#<hex>):** <role and where it gets used>
- **Secondary (#<hex>):** <role>
- **Neutral (#<hex>):** <role>
- **Surface (#<hex>):** <role>

## Typography

<Describe the font families, their roles (display vs body vs label),
and any per-level quirks (uppercase labels, tight headline tracking,
etc.).>

## Layout

<Describe the spacing scale, the layout model (fluid, fixed-max-width,
container-queries), gutter and margin conventions.>

## Elevation & Depth

<Describe how hierarchy is conveyed. If shadows, specify spread/blur/
color. If flat, name the alternative (tonal layers, borders, color
contrast).>

## Shapes

<Describe the corner-radius posture and any exceptions.>

## Components

<Prose explaining the component tokens defined in the front matter.
Call out variants and state transitions.>

- **Primary button:** <description>
- **Secondary button:** <description>
- **Input:** <description>

## Do's and Don'ts

- Do <practical guardrail>.
- Don't <practical pitfall>.
- Do <practical guardrail>.
- Don't <practical pitfall>.
