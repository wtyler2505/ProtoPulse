# ADR-0002: v3 enters the live app after gates pass

Status: Accepted
Date: 2026-05-18

## Context

The v3 architecture scaffold now has flow exports, visual and layout analysis wiring, tldraw boundary extraction, metadata rules, tscircuit compile gates, verified hardware facts, provenance/storage tables, swarm gates, OpenAI and Codex dispatch planning, firmware contracts, pin ownership checks, real tscircuit render proof, xyflow migration, Markdown inspection reports, and ready-sample validation.

It is still safer to keep this work in `docs/v3-architecture` until the live app integration has a narrow entry point.

## Decision

v3 leaves `docs/v3-architecture` only after the gates below are true.

The first live app step is not replacement. The first live step is an alternate Architecture route or feature-flagged panel that can load v3 data beside the current xyflow view.

## Exit Gates

- real sample validation is ready end-to-end
- xyflow migration preserves node and edge counts
- visual inspection reports render and store
- blocked and ready compile states are visible
- Tyler verifies the v3 UI shell

## Not Yet

Do not replace the default xyflow Architecture view until migrated real projects pass the gates.

## First Live Step

Add v3 as an alternate Architecture route or feature-flagged panel.
