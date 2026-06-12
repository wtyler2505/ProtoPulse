# ADR-0013: M1 text via canvas-2D glyph atlas, MSDF deferred

**Status:** Superseded by [ADR-0015](./0015-sdf-glyph-atlas.md) (2026-06-11)
**Date:** 2026-06-10
**Deciders:** Tyler (via Milestone 1 plan approval)
**Deviates from:** Vision Vol II §B.1 (MSDF font atlas, crisp at every zoom)

## Context

Vol II §B.1 specifies an MSDF font atlas (JetBrains Mono + a vector
pin-number face) — crisp at every zoom, GPU-cheap.

## Decision

Milestone 1 rasterizes ASCII glyphs once into a canvas-2D atlas at a
single font size and draws textured quads. MSDF generation + shader are
deferred.

## Rationale

MSDF atlas tooling plus the distance-field shader is multi-day work that
buys nothing at M1 zoom ranges and label volumes. The atlas approach
shipped in hours and reads fine at working zooms (label sizing/centering
tuned post-smoke, commit e9f6a4c).

## Trade-offs accepted

Text softens at extreme zoom-in; single font face; ASCII only (the µ/Ω
class of symbols falls back). These are visible-but-tolerable at M1.

## Revisit when

Pin numbers land on symbols (they want small-size crispness), or any
LOD pass where text quality is the limiting factor — likely alongside
the v0.4 board view.
