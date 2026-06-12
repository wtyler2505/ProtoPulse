# @protopulse/graph — the design graph and the `.ppx` format

The canonical model: components, nets (connectivity = sets of ports),
constraints, and per-view geometry maps. Every mutation is a typed,
serializable **operation**; the design IS its op log and the graph is a
materialized view. The data outlives the tool — this file is the format
spec.

## Identity & ordering

- Entities: UUIDv7 (time-sortable, mergeable). Component IDs must not
  contain `:`.
- Ports: `componentId:pinKey` (`"u3:7"`). A port exists iff its component
  exists.
- Operations: identified by `(actor, lamport)` — actor is a device/agent
  ID, lamport a per-actor monotonic counter. Materialization total order
  is `(lamport asc, actorId lexicographic)`: deterministic on every
  replica, no wall clocks. `ts` is advisory.

## Units

All geometry is **integer nanometers** (`1 mm = 1_000_000 nm`). The
schematic grid is 1.27 mm (50 mil) — editor behavior, never data.
Rotations are `0 | 90 | 180 | 270` in schematic space.

## Invariants (violations = corrupt log)

1. Every net port resolves to a live component pin.
2. A port belongs to at most one net (shorting is an explicit
   `merge_nets`).
3. Ref designators unique per design.
4. Geometry (wires) sits on live nets; dead-net geometry is GC'd with a
   warning.
5. All coordinates integers, rotations in domain.

## Op rules

Ops are **minimal** (a drag emits one final `move_symbol`),
**self-contained** (creating ops carry pre-allocated IDs — `connect`
with no `netId` requires `newNetId`), and **forward-only** (undo emits
the inverse op via `invertOp`; history never rewinds). `batch` is atomic
and one undo unit. Failed ops are skipped with warnings at
materialization — only invariant violations are fatal.

## On-disk: the `.ppx` directory

```
mydesign.ppx/
  manifest.json            { format: "ppx", version: 1, designId, head,
                             branches: { <name>: { base: { branch, opCount } } } }
  ops/<branch>/000001.opl  JSON Lines, one OpEnvelope per line, 4 MB segments
  snapshots/               optional acceleration (plain JSON in M1)
  assets/                  content-addressed attachments
```

JSON Lines because **greppable beats compact** for a format meant to
outlive the app. A branch's effective ops = the base branch's first
`opCount` effective ops (recursively) + its own segments — branching is
O(1), a pointer.

## Single-file form: `.ppx.json`

`DesignBundle { format: "ppx-bundle", version, designId, head,
branches: [{ name, base, ops }] }` — the browser save/load and share
format. `encodeBundle`/`decodeBundle` validate with zod; unknown shapes
are rejected, never guessed at.

## Branch / diff / merge

- `BranchLog.createBranch(name, from)` — O(1).
- `diff(a, b)` → `GraphDelta` (entity-wise; net identity by UUID with a
  connectivity-fingerprint fallback so delete+recreate reads as
  *changed*).
- `threeWayMerge(base, ours, theirs)` → `{ autoOps, conflicts }`. Auto:
  disjoint entities, different properties, theirs-only membership moves,
  view geometry (ours wins races). Conflicts (same property different
  values; a port moved to different nets on both sides; remove vs
  modify) are **data** — nothing structural resolves silently, because a
  wrong silent merge is a fried board.
