# Screenshot rig

The PNGs in `docs/screenshots/` are **artifacts of a script, never hand
crops** — the same philosophy as `tools/golden/`: screenshots drift like
prose unless a machine regenerates them.

## Refresh

```bash
npx tsx tools/screenshots/capture.ts
```

The rig starts the new editor's dev server (`npm run -w @protopulse/app
dev`, port 5174 — an already-running server is reused and left running),
drives the real UI headlessly through Playwright (`playwright-core` over
the system Chrome, viewport 1600×900 @1x), and writes every shot to
`docs/screenshots/`. While iterating, capture a subset with
`PP_SHOTS=cosim,pcb-mode npx tsx tools/screenshots/capture.ts`. A custom
Chrome path goes in `PP_CHROME`.

## The rule

**A UI change that alters any of these views regenerates the whole set
in the same PR.** A stale screenshot in the docs is worse than none —
treat the set like a golden file: re-run the rig, eyeball the diff,
commit the new PNGs alongside the change.

## What gets shot

| Shot | Design (golden fixture) | View |
|---|---|---|
| `schematic.png` | `traffic-light-555` | Schematic canvas, zoom-fit: the 555 astable driving three LED branches |
| `sim-panel.png` | `traffic-light-555` → `led-resistor` fallback¹ | Sim tab after a default transient: fidelity bar, trace toggles, plot |
| `pcb-mode.png` | `routed-led` | PCB canvas, zoom-fit: filled pads, F.Cu trace, via |
| `branch-diff.png` | `led-resistor` | Branches tab: `try-alt` forked, R1 edited to 1k, diff-vs-main overlay on |
| `cosim.png` | `led-resistor` | Co-sim tab: blink firmware (assembled in-script from `@protopulse/emu`), B5 → LED_A bound, 500 µs window — square wave over the analog response |

¹ The fallback fires when the 555 solve errors, or when its macromodel's
~25 internal vectors make the trace list too tall to frame the fidelity
bar and the plot together.

## Determinism

Designs come from `tools/golden/fixtures/*/design.ppx.json`, injected
into `localStorage['pp-design']` before the app boots — so the pictures
and the export contracts can never disagree about the design. Fixtures
that freeze netlists without schematic geometry get deterministic
`place_symbol` / `set_wire_geometry` ops appended **in memory** by the
rig (actor `screenshot-rig`; layout tables at the top of `capture.ts`).
The fixture files on disk are never touched.

Shots are deterministic in content (same designs, same panels, same
traces), not pixel-identical — wall-clock readouts (e.g. the co-sim
slowdown factor) vary run to run. Each shot is an independent step:
one failure logs and the rig continues, exiting non-zero at the end.
