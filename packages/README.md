# The ProtoPulse engine (`packages/`)

This is the ground-up redesign described in the vision volumes: **one
canonical design graph, many projections** — schematic, breadboard, PCB,
BOM, and simulation as views of a single model, with a git-style
operation log underneath. It lives alongside the legacy app
(`client/ server/ shared/`), which keeps running untouched; proven pieces
of the old code are ported in deliberately, and the app migrates onto
this engine in later milestones.

<table>
<tr>
<td width="50%"><img src="../docs/screenshots/schematic.png" alt="Schematic canvas: the traffic-light-555 golden fixture, zoom-fit"></td>
<td width="50%"><img src="../docs/screenshots/pcb-mode.png" alt="PCB canvas: routed-led fixture — pads, F.Cu trace, via"></td>
</tr>
<tr>
<td align="center"><em>Schematic canvas — the <code>traffic-light-555</code> golden fixture</em></td>
<td align="center"><em>PCB canvas (v0.4) — <code>routed-led</code>: pads, stroked trace, via</em></td>
</tr>
</table>

Screenshots are artifacts of [`tools/screenshots/`](../tools/screenshots/README.md)
— regenerate the set when a UI change alters these views.

## Packages

| Package | What it is | Depends on |
|---|---|---|
| `@protopulse/graph` | **The product.** Typed ops, materializer, invariants, branch/diff/merge, value parser, `.ppx` stores | uuid, zod |
| `@protopulse/parts` | Minimal part model + seed library (pins with ERC types, symbol geometry, provenance tiers) | graph |
| `@protopulse/erc` | Pin-conflict matrix + net rules; findings carry executable fixes; every code maps to a concept article | graph, parts |
| `@protopulse/export` | Deterministic KiCad legacy-E netlist + CSV BOM — exports are contracts | graph, parts |
| `@protopulse/cli` | `protopulse check` / `export` — CI for circuits (exit 0/1/2) | erc, export |
| `@protopulse/renderer` | WebGL2 retained scene graph, flatbush picking, nm→px camera | graph, parts |
| `@protopulse/app` | The schematic editor: place/wire/undo/branch/diff/ERC panel/Draftsman | everything |
| `@protopulse/ai` | Tool registry (scoped slices, explain()), context assembler, the Draftsman, provider adapters | graph, erc, parts |
| `@protopulse/relay` | The sync relay: in-memory WebSocket rooms that union op-log envelopes — real-time collaboration with zero conflict resolution (the total order IS the merge) | graph, ws |
| `@protopulse/content` | Schemas + loaders for rule decks, concept articles, track steps | zod, js-yaml |

`tools/golden/` holds golden-file tests: known op-logs → known exports,
byte-exact. `content/` holds the content layer (decks, concepts wiki
seed, Track 1 steps).

CI for circuits comes with the badge to prove it — this one is the
real output of `protopulse check --badge` on the traffic-light-555
golden fixture:

![circuit: ERC clean](../docs/badges/traffic-light-555.svg)

```bash
node packages/cli/dist/protopulse.js check <design> --badge circuit.svg
```

The badge always tells the truth — it goes red with the error count
even while the same run fails your pipeline.

## Conventions

- **Integer nanometers everywhere.** `MM = 1_000_000`; the schematic grid
  is 1.27 mm. Floats break diff determinism; zod rejects them at the
  boundary.
- **Ports are `componentId:pinKey`.** They exist iff their component
  exists — dangling references are unrepresentable.
- **The design IS its op log.** The graph is a materialized view; undo
  emits inverse ops; branches are pointers; merge conflicts surface as
  data and are never resolved silently.
- **Packages ship TypeScript source** (`main: ./src/index.ts`). Vite,
  Vitest, and tsx consume it directly; only the CLI builds a bundle.

## Working on it

```bash
npm run check:packages           # typecheck every package (one program)
npm run test:packages            # all workspace test suites
npm run -w @protopulse/app dev   # editor on http://localhost:5174
npm run -w @protopulse/cli build && node packages/cli/dist/protopulse.js check <design>
```

CI: `.github/workflows/packages-ci.yml` (path-filtered; the legacy
`ci.yml` is independent). The graph package enforces its own coverage
gate — 100% branch on ops/apply/materialize/diff.
