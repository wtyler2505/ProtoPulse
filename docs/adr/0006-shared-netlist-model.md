# ADR-0006: Shared Netlist Model for Bidirectional View Sync

**Status:** Accepted
**Date:** 2026-04-10
**Deciders:** Tyler
**Backlog:** BL-0571

## Context

ProtoPulse maintains circuit connectivity across three views: schematic, breadboard, and PCB. Each view has its own spatial representation of the same logical connections. When a user draws a wire on the breadboard, the schematic should reflect that connection — and vice versa.

The naive approach would give each view its own independent netlist and attempt to reconcile them after the fact. This creates an O(n^2) reconciliation problem, race conditions during concurrent edits, and an unclear "source of truth" when views disagree.

The alternative is a single shared netlist that all views reference. Each view provides its own spatial representation (wire routing, geometry) but the logical connectivity — which pins are connected — lives in one place: the `circuit_nets` table with its `segments` JSONB column.

## Decision

Adopt a **single shared netlist model** where `circuit_nets.segments` is the authoritative source of connectivity. Views (breadboard, schematic, PCB) maintain only spatial data (wire points, routing geometry) in `circuit_wires`, keyed by `view` column and linked to the shared net via `netId`.

The bidirectional sync engine (`client/src/lib/circuit-editor/view-sync.ts`) translates between the shared netlist and view-specific wire representations:

- **`syncSchematicToBreadboard()`**: reads `circuit_nets.segments`, computes which breadboard wires to create/delete.
- **`syncBreadboardToSchematic()`**: reads breadboard `circuit_wires`, resolves pin endpoints, computes which schematic net segments to create.
- **`detectConflicts()`**: standalone mismatch detection without side effects.

Wire provenance tracking (`provenance` column: `'manual'` | `'synced'` | `'coach'` | `'jumper'`) distinguishes user-drawn wires from engine-generated ones, enabling the UI to show which wires are auto-synced and which are user-intentional.

## Rationale

- **Single source of truth**: eliminates reconciliation complexity. The netlist is never ambiguous.
- **View independence**: each view's wires are spatial-only. Deleting a breadboard wire doesn't destroy the logical connection — it creates a sync conflict that the user must resolve.
- **Provenance-aware sync**: the engine can protect user-drawn wires from being overwritten by auto-sync, and the UI can visually distinguish manual vs synced wires.
- **Conflict detection without side effects**: `detectConflicts()` enables UI indicators ("3 sync issues") without triggering any create/delete operations. The user stays in control.
- **Export compatibility**: Fritzing (.fzz) and other EDA formats expect view-specific wire data linked to a shared netlist. Our model maps directly to their data structure.

## Consequences

- **Net segments are the contract**: any new view (e.g., a future 3D board view) must consume `circuit_nets.segments` and produce view-specific `circuit_wires`.
- **Sync is lazy**: changes don't propagate automatically. A user action or explicit "sync" call triggers `syncSchematicToBreadboard()` or the reverse. This is intentional — automatic sync would override user intent.
- **Conflict resolution is manual**: when the sync engine detects mismatches (e.g., a breadboard wire that doesn't match any schematic segment), it reports a `SyncConflict` rather than silently fixing it. The UI must present these to the user.
- **Wire provenance must be preserved**: all code that creates wires must set the correct `provenance` value. The sync engine sets `'synced'`; the breadboard coach sets `'coach'`; user-drawn wires default to `'manual'`.
- **Performance**: sync is O(nets * segments * instances) which is fast for typical hobby circuits (<100 nets). For very large designs, incremental sync (delta-only) would be needed — not yet implemented.
