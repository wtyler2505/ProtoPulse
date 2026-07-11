# ADR-0017: ProtoPulse Is a Physical-System Design Graph, EDA Is Vertical #1

**Status:** Proposed
**Date:** 2026-06-23
**Deciders:** Tyler (pending), Maya (Claude)
**Tracking:** (assign BL-XXXX on acceptance)

## Context

ProtoPulse is currently framed — to users and to ourselves — as a
browser-based **EDA platform** (schematic capture, ERC, netlist/BOM
export, PCB layout, breadboard realism, ESP32 emulation). The
engine-redesign monorepo (`packages/`, 16 `@protopulse/*` packages)
shipped Milestone 1: a canonical design graph where every mutation is a
typed op, the design **is** its op-log, and the graph is a materialized
view.

A framing tension surfaced (2026-06-23): the "EDA bucket" feels like it
is approaching the limit of *novel* problems worth solving, and the EDA
label may be artificially capping where the project's ideas can go.
Robotics design/prototyping was raised as a much larger adjacent space.

The diagnosis matters more than the surface request. The flatness is
**not** market exhaustion of EDA — real EDA still has routing, signal
integrity, thermal, multi-board systems, and manufacturing handoff
largely untouched (`ROADMAP.md`). The flatness is that the *interesting
architecture problem* (the graph engine) is solved, and we then
described a **domain-neutral engine** with a **domain-specific label**.

Read the architecture back: a diffable, replayable, typed-graph engine
over integer-nanometer geometry, with branch/diff/merge and
content-addressed export. That is not an EDA primitive. It is a
**physical-system design graph**. EDA is the first thing we pointed it
at — not the only thing it can hold. A robot is
`electronics (we own this) + mechanical body (CAD) + control firmware
(we have an ESP32 emulator) + kinematics`. We already own a third of
robotics today.

### What the engine can and cannot absorb today (investigated 2026-06-23)

A primary-source investigation of `packages/graph` produced a verdict of
**EXTENSIBLE WITH FRAGILITY**. Four facts constrain any domain
extension:

| Aspect | Finding | Evidence |
| --- | --- | --- |
| **Op/node type model** | Closed 29-member discriminated union + exhaustive `applyOp`/`invertOp` switches. Adding a type = edit 5+ files. Compile-safe, **not** a plugin registry. | `packages/graph/src/ops.ts:322`, `apply.ts`, `inverse.ts` |
| **Determinism** | Achieved **by constraint** (integer-nm coords, zod rejects floats; total order via `(lamport, actorId)`; sorted collections), not by design. Electrical fits perfectly. | `packages/graph/src/types.ts:8`, `materialize.ts`, `ops.ts:403` |
| **Golden / schema evolution** | Unknown ops are a **hard zod error** (no `.passthrough()`, no forward-compat). No migration code. Schema change re-freezes all fixtures; pre-existing designs with a new op become unloadable by old code. | `tools/golden/update-golden.ts`, `decodeBundle` |
| **External artifacts** | The `.ppx` `assets/` content-addressing directory is a **documented stub, not implemented**. Firmware binaries / STL meshes have no deterministic home yet. | `packages/graph/README.md` (`.ppx` spec), `store/serialize.ts` |

The implication: the engine is broadenable, but **not casually**. The
real gate to any new domain is not "write a node type" — it is "build the
schema-evolution foundation the engine deliberately does not have yet."

## Decision

1. **Reframe the engine, internally, as a physical-system design
   graph.** EDA is **vertical #1**, not the definition of the product.
   Robotics, generative-CAD/enclosure, and firmware co-design are
   candidate verticals #2+.

2. **The reframe is internal until a vertical actually ships.** We do not
   tell users "ProtoPulse does robotics now" before a robotics vertical
   is daily-drivable. The label change is a decision-making unlock, not a
   marketing claim. (If/when a vertical ships, the user-facing
   positioning and a `docs/vision/*` amendment follow — this ADR does not
   itself amend the frozen vision.)

3. **Hard guardrail — one engine, no parallel codebase.** Every new
   vertical lands as **node-types + ops on the existing
   `@protopulse/graph`**. If a feature cannot be expressed as typed graph
   ops on that engine, it is **rejected**, not forked. The day robotics
   needs its own engine, this strategy has failed and we stop.

4. **Schema-evolution foundation is the prerequisite gate, not the
   firmware node.** Before any non-electrical node type ships, the engine
   must gain, in this order:
   - a **content-addressed asset layer** (implement the `.ppx`
     `assets/` stub — blobs by `sha256`, referenced from ops, never
     embedded),
   - a **manifest version + migration path** (decode old `.ppx`,
     migrate forward; today `version` is a field with no migration
     code), and
   - an explicit **unknown-op forward-compat policy** (decide:
     hard-fail vs. quarantine-and-preserve for ops a reader doesn't
     know — today it is an unconditional hard error).

5. **First vertical probe = the firmware lane**, because we already own
   the rarest asset (the `emu` ESP32 emulator). It has the lowest
   marginal cost and highest learning, and it proves the generality
   thesis using shipped assets rather than a foreign kernel.

## Rationale

- **The engine is the asset; the genre is a view.** Unity shipped a
  scene-graph + component system, not "an FPS engine," and let genres
  emerge. Our op-log graph is that scene-graph; verticals are genres.
  The teams that died hard-coded their engine to one genre and could not
  escape the label.
- **Exaptation, not pivot.** The op-log's defining trait — typed nodes +
  constraints + replayable diffable history — was built for schematic
  determinism and is *pre-adapted* to mechanical assemblies and firmware
  state, which need the same thing. We are not abandoning EDA; we are
  noticing what we already built is general.
- **Firmware before CAD on cost grounds.** `emu` (ESP32 silicon
  emulation) is shipped and rare. Pairing an in-browser EDA tool with a
  cycle-aware MCU emulator and a firmware-authoring discipline is a
  genuine moat. CAD requires importing a foreign Python/OCC kernel
  (CadQuery) whose float geometry collides with our integer-nm
  determinism — higher risk, later.
- **The guardrail is the whole strategy.** Generality is only valuable
  if it rides one chassis (cf. a shared automotive platform underpinning
  many models). A parallel robotics codebase would convert one strong
  engine into three weak half-tools.

## The load-bearing assumption (validate before major investment)

**Assumed, currently unproven:** the same person who designs a schematic
in ProtoPulse wants the enclosure and/or the firmware *in the same tool*.
If false, generality buys nothing and we have built three half-products.
This must be tested cheaply before committing roadmap mass.

## Consequences

- **A schema-evolution epic precedes any vertical work.** Asset layer +
  manifest migration + unknown-op policy become prerequisite roadmap
  items. This is real engine work, not a spike. It also *pays back EDA*
  (footprints, 3D step models, manufacturing artifacts all want the
  asset layer too).
- **Golden re-freeze becomes a deliberate, reviewed event** each time the
  op schema grows. The `tools/golden/` contract discipline already exists
  for this; we honor it (no casual re-freeze).
- **Vision-doc status:** this ADR proposes an *internal* reframe and does
  **not** edit `docs/vision/*`. A user-facing scope change later requires
  a versioned vision amendment per the documentation rules.
- **Determinism risk is contained at the boundary.** Any foreign kernel
  (CadQuery/OCC for CAD) stays a service behind an MCP/subprocess
  boundary and never enters the graph core's determinism guarantees;
  geometry that crosses into the graph must be integer-quantized at the
  edge.
- **Scope-diffusion risk is the primary kill mode.** Guardrail #3 is the
  mitigation and must be enforced in review: a vertical feature that
  cannot be expressed as graph ops does not land.

## Revisit when

- The firmware-lane probe (vertical #1.5) either validates or refutes the
  load-bearing assumption — if refuted, this reframe is shelved and EDA
  depth resumes as the sole focus.
- A vertical needs state the op-log genuinely cannot represent as typed
  ops — that is the signal that "one engine" has failed and the decision
  must be reopened (parallel engine, or abandon the vertical).
- We are ready to make the reframe user-facing — at which point a
  `docs/vision/*` amendment supersedes the "internal only" clause here.
