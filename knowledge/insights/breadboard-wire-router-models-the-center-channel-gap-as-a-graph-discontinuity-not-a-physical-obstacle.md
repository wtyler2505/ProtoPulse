---
summary: The breadboard A* wire router enforces the center channel (columns e-f) as a graph adjacency restriction rather than as an obstacle cell, making it impossible to route across the channel through terminal strips alone
category: implementation-detail
areas: ["[[index]]"]
related insights:
  - "[[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — the breadboard model with its physical constraints is one of the three geometry representations"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation.md
---

The breadboard wire router (`client/src/lib/circuit-editor/wire-router.ts`) implements A* pathfinding on a 10-column x 63-row grid where columns 0-4 (a-e) and 5-9 (f-j) represent the two halves of a standard breadboard. The center channel between columns e(4) and f(5) is modeled as a **graph adjacency restriction**: the `getNeighbors()` function explicitly blocks the `4→5` and `5→4` column transitions.

This is subtly different from treating the channel as an obstacle:
- An obstacle cell could be routed around.
- A graph discontinuity means no path exists between the two halves through terminal strips **at all**. `routeWire()` will correctly return `[]` for any start/end pair on opposite sides of the channel.
- Manhattan distance remains an admissible heuristic even across the channel gap (it never overestimates), so A* terminates correctly with an empty result rather than entering an infinite search.

The router also applies a **turn penalty** (`1.5x` cost for direction changes vs `1.0x` for straight moves) tracked via arrival direction at each node. This produces visually cleaner routes with fewer zigzags — important because breadboard wires are physical objects and cleaner routes are easier to follow and debug.

Multi-net routing (`routeAllNets`) uses a progressive obstacle approach: after routing each net, its path cells are added to the global obstacle set, forcing subsequent nets to route around already-placed wires. Nets are connected internally via Steiner-tree-like expansion — first two pins are connected, then each additional pin routes to the nearest already-connected point.

The color assignment system uses a 12-color palette that cycles for nets beyond 12, matching physical breadboard wire sets that typically come in 8-12 distinct colors.

---

Related:
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — the breadboard model with its physical constraints is one of the three geometry representations
- [[view-sync-engine-uses-canonical-connection-signatures-to-reconcile-schematic-and-breadboard-representations]] — view-sync must resolve pixel coordinates to pin pairs, and those pixel coordinates are determined by the breadboard grid model
- [[drc-explanations-embed-pedagogical-content-directly-in-the-engine-making-the-validation-system-a-teaching-tool-not-just-a-checker]] — the breadboard model is inherently pedagogical: clean wire routing helps beginners debug their physical circuits

## Topics

- [[index]]
