# ADR-0015: SDF glyph atlas (supersedes ADR-0013's deferral)

**Status:** Accepted
**Date:** 2026-06-11
**Deciders:** Tyler (standing autonomy grant for the remaining board)
**Relates to:** Vision Vol II §B.1 (MSDF font atlas, crisp at every zoom)

## Context

ADR-0013 shipped M1 with a plain canvas-alpha glyph atlas and deferred
distance-field text. Its "revisit when" fired: the v0.4 board view
landed, every remaining roadmap item is gated on hardware or product
decisions, and the renderer epic was the last tractable engine slice.

## Decision

The atlas is now a **single-channel signed distance field**: glyphs
rasterize once at 48px via canvas-2D, an exact Euclidean distance
transform (Felzenszwalb & Huttenlocher, `renderer/src/sdf.ts`,
DOM-free and unit-tested against brute force) converts each cell to an
SDF with **TinySDF-style sub-pixel seeding** (antialiased boundary
pixels seed the transform at their coverage offset, so contours don't
stair-step along the source raster), uploaded as one R8 texture. The
fragment shader reconstructs the edge with an `fwidth`-sized
`smoothstep` around 0.5.

## Deviation from the vision, accepted

Vol II §B.1 says *multi-channel* SDF (MSDF). True MSDF needs vector
glyph outlines (msdfgen-class tooling, a bundled font). Single-channel
SDF from a high-res raster needs neither and delivers the actual goal —
crisp, GPU-cheap text at every zoom — at one visible cost: **sharp
corners round off by ≤1 source pixel at extreme magnification**.
Browser-verified at ~70× zoom: edges crisp, counters round, no blur.

## Revisit when

A bundled vector font lands for other reasons (print-quality export,
pin-number face), or corner quality at extreme zoom draws real
complaints — then generate a true MSDF atlas at build time.
