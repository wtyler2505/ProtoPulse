# ADR-0014: M1 merge surfaces conflicts as data; resolver UI deferred

**Status:** Accepted
**Date:** 2026-06-10
**Deciders:** Tyler (via Milestone 1 plan approval)
**Deviates from:** Vision Vol II §A.7 (three-pane schematic resolver, per-port decisions)

## Context

Vol II §A.7 specifies three-way merge with a structural-conflict
resolver: a three-pane schematic view with per-port decisions, because
"a wrong silent merge in EDA = a fried board; the resolver is allowed
to be slow."

## Decision

`threeWayMerge(base, ours, theirs)` ships complete in
`@protopulse/graph`: the auto path (disjoint entities, different
properties, theirs-only membership moves, geometry-yields-to-graph) is
applied; property/structural/remove-vs-modify conflicts are returned
**as typed data**. No interactive resolver UI in M1 — callers must
refuse to merge while the conflict list is non-empty.

## Rationale

The spec's core safety property — *nothing structural resolves
silently* — is fully honored by the data contract and enforced by
tests. The UI is presentation; the invariant is the engine's. M1's bar
(branch, diff, decide later) doesn't require merging branches with
conflicting edits.

## Revisit when

Real-time collaboration (v0.6) or any workflow that merges concurrently
edited branches — build the three-pane resolver on top of the existing
`MergeConflict` data, no engine changes expected.
