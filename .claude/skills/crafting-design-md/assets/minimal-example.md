---
version: alpha
name: Minimal
description: The smallest DESIGN.md that passes the spec linter cleanly.
colors:
  primary: "#1A1C1E"
  neutral: "#F7F5F2"
  surface: "#FFFFFF"
  on-primary: "#F7F5F2"
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.2
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 4px
  md: 8px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview

A stripped-down identity for prototyping. Near-black primary on warm
off-white, one typeface, minimal component surface.

## Colors

- **Primary (#1A1C1E):** Near-black ink for text, icons, and the
  single primary action.
- **Neutral (#F7F5F2):** Warm off-white canvas.
- **Surface (#FFFFFF):** Pure white for cards.

## Typography

Inter throughout. Semi-bold at headline weight, regular at body
weight. Line-height stays generous (1.6) on body to keep long-form
reading comfortable.

## Components

- **Primary button:** Ink background, off-white label, 4px radius.
