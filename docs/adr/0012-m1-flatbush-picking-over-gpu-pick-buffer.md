# ADR-0012: M1 picking via flatbush R-tree, GPU pick buffer deferred

**Status:** Superseded by [ADR-0016](./0016-gpu-pick-buffer-dual-picking.md) (2026-06-11)
**Date:** 2026-06-10
**Deciders:** Tyler (via Milestone 1 plan approval)
**Deviates from:** Vision Vol II §B.2 (dual system: GPU color-pick buffer + CPU R-tree)

## Context

Vol II §B.2 specifies a dual picking system: a GPU color-pick buffer
(entity IDs as RGBA in an offscreen pass, O(1) hover at any density)
plus a CPU R-tree for marquee select, snap candidates, and DRC reuse.

## Decision

Milestone 1 ships only the CPU side — a flatbush R-tree over scene-node
bounds, with segment-proximity refinement for wires. No GPU pick pass.

## Rationale

- The R-tree was needed regardless (marquee, snapping); it alone meets
  the M1 bar at M1 scale (tens of components).
- It is headless-testable in vitest; a GPU pass is not.
- The GPU buffer's payoff (O(1) hover on 1,000-component boards) is a
  v0.4-era requirement, not an M1 one.

## Revisit when

Pointer-hover latency degrades on real designs, or the PCB view (v0.4)
lands — re-validate against the Vol II §B.3 budget (60 fps at 1k
components / 10k trace segments) and add the GPU pass then.
