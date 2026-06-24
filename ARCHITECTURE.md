# Architecture — where to read

This file is deliberately thin: architecture lives next to the code it
describes. One home per fact; pointers everywhere else.

**The engine (the redesign, `packages/`):**
- [`packages/README.md`](./packages/README.md) — package map, the
  one-graph/op-log thesis, conventions, commands.
- [`packages/graph/README.md`](./packages/graph/README.md) — the `.ppx`
  format spec: identity, ordering, invariants, branch/diff/merge. The
  data outlives the tool.
- [`docs/vision/`](./docs/vision/README.md) — the frozen founding spec
  (three volumes). Deviations get ADRs.

**The legacy app (`client/ server/ shared/` — still the shipping product):**
- [`DESIGN.md`](./DESIGN.md) — design language + the engine chapter.
- [`docs/figma-design-system.md`](./docs/figma-design-system.md) — design-system
  rules for Figma MCP integration (Tailwind v4 `@theme` tokens, shadcn/ui, lucide;
  target the legacy `client/` system, not the engine editor).
- [`docs/DEVELOPER.md`](./docs/DEVELOPER.md) — dev setup for both stacks.
- [`docs/adr/`](./docs/adr/) — decision records, legacy and engine alike.

**Status & direction:** [`ROADMAP.md`](./ROADMAP.md) ·
[`docs/FEATURE_MATURITY.md`](./docs/FEATURE_MATURITY.md)
