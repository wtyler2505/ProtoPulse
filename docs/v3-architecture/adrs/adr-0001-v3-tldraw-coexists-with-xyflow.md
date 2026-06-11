# ADR-0001: v3 tldraw coexists with xyflow before replacement

Status: Accepted
Date: 2026-05-18

## Context

The live ProtoPulse app already has an Architecture view backed by `architecture_nodes`, `architecture_edges`, server routes, storage code, AI tools, export flows, validation links, and `@xyflow/react` compatibility.

The v3 architecture draft adds a tldraw canvas, boundary metadata, hardware fact gates, tscircuit compile proof, and agent dispatch gates. It is stronger for physical hardware reasoning, but it is not ready to replace every live `ArchitectureView` workflow in one move.

## Decision

v3 will coexist with the current xyflow Architecture view first.

The current xyflow view remains the live default. The v3 tldraw canvas becomes an alternate architecture lane behind a bridge or feature flag. Replacement happens only after migration, compile, storage, and real sample project checks pass.

## Replacement Gates

- xyflow nodes and edges migrate to v3 tldraw shapes without data loss.
- v3 compile checks cover hardware facts, blocked states, and tscircuit render proof.
- the live app can open v3 behind a feature flag or alternate route.
- export/import round trip passes for a real sample project.

## Consequences

- Low risk to the current app because existing Architecture workflows stay alive.
- v3 can keep moving fast inside `docs/v3-architecture` without breaking live users.
- Migration work is explicit instead of hidden inside a risky replacement.
- There is temporary duplication between xyflow and tldraw until the bridge is proven.

## Next Step

Build the node/edge to tldraw-shape migration adapter.
