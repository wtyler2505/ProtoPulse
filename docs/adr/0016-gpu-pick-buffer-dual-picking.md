# ADR-0016: GPU pick buffer + flatbush — the dual picking system (supersedes ADR-0012's deferral)

**Status:** Accepted
**Date:** 2026-06-11
**Deciders:** Tyler (standing autonomy grant for the remaining board)
**Relates to:** Vision Vol II §B.2 (dual system: GPU color-pick buffer + CPU R-tree)

## Context

ADR-0012 shipped M1 with only the flatbush R-tree and deferred the GPU
color-pick pass; its "revisit when" named the v0.4 PCB view, which has
since landed (pads, zones, pours — fills the R-tree ranks only by AABB).

## Decision

Both halves of the Vol II §B.2 dual system now exist, each doing the
job it is built for:

- **GPU ID buffer** (`gl/renderer.ts pickAt`): every scene node draws
  into an offscreen RGBA8 pass with its index encoded in the color
  (24-bit, `pick-encode.ts`, index 0 reserved for "nothing");
  `readPixels` at the cursor answers hover in O(1) regardless of
  density. The pass reuses the visible pass's cached vertex buffers and
  draw order (topmost wins) and re-renders only when scene version,
  camera version, or canvas size move. Drill holes draw as zero — a
  drill picks as board, exactly as it renders.
- **flatbush R-tree** (`pick.ts`): tolerance picking, ranked hit lists,
  marquee select, snapping — everything tools need that an exact pixel
  cannot answer.

The hover highlight composes them: GPU first (exact on fills — pads,
zones, traces, copper), CPU tolerance pick as fallback when the cursor
is over empty pixels (1px symbol strokes and wires are unhittable
pixel-exactly). Tool picking is unchanged — tools keep the R-tree.

## Verification

Encode/decode round-trip is unit-tested (every channel an exact k/255 —
no quantization drift through the 8-bit framebuffer). The GL pass was
browser-verified: pad fill → its footprint id, empty board → null,
hover highlight lights and clears live in both editors.

## Revisit when

Hover wants sub-node precision (per-pin, per-pad) — encode a
sub-object index in the alpha channel then.
