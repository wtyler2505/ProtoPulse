# Innovation ideas — demo media + engine-native features (Tyler + Claude, 2026-06-10)

Captured mid-Milestone-build. Source: Tyler ("the animated gif idea...
got any more good creative/innovative ideas?").

1. **Animated GIF/WebM of the co-sim run** (Tyler-endorsed) — the single
   best marketing asset: firmware square wave + analog response drawing
   themselves. Implementation: canvas MediaRecorder or frame capture in
   the screenshot rig.
   ✅ SHIPPED 2026-06-10 as `docs/screenshots/cosim-demo.gif`
   (`tools/screenshots/capture-gif.ts` — frame capture + pure-JS gifenc
   encode with inter-frame diffing, 18 frames / ~220 KB, embedded in the
   root README).
2. **Time-lapse replay as the GIF generator** — the op-log IS a replay
   (vision Vol I §1.2): an app scrubber that re-materializes the design
   op-by-op, animated. One feature = teaching tool + demo generator +
   "most honest tutorial format ever made."
   ✅ SHIPPED 2026-06-10 — History tab in `@protopulse/app` (scrubber,
   play/pause, per-op jump list, read-only time travel) + the GIF half:
   `tools/screenshots/capture-replay-gif.ts` → `docs/screenshots/
   replay-demo.gif` (the 555 fixture building itself, embedded in
   README + USER_GUIDE).
3. **Serverless share links** — design bundle compressed into a URL
   fragment (#design=...) + read-only viewer route. Forum-pasteable
   live schematics before v0.6's server exists.
   ✅ SHIPPED 2026-06-10 (core) — `packages/app/src/state/share.ts`
   (#d= fragment, CompressionStream deflate + base64url), Copy-share-
   link in Export panel, confirm-guarded receive. 67-op 555 ≈ 2.1k-char
   URL, verified across browser contexts. Read-only viewer route still
   open (links load into the full editor for now).
4. **Blame on canvas** — click any net/component → who/when/why from op
   envelopes (agent ops already carry meta.rationale). Cheap now.
5. **Sim ghost overlay** — render the last simulation's node voltages
   as live badges at net labels on the schematic: the Probe's live
   overlay UX, fed by simulation today, hardware later. One UX, two
   data sources.
6. **CI circuit badges** — `protopulse check --badge` emits a
   shields-style SVG (ERC clean / N errors) for hardware repo READMEs.
   CI-for-circuits becomes visible.
7. **Failure puzzle #1 shippable now** — a broken design + instruments +
   "annotate the root cause" checker (Vol III catalog); everything it
   needs (sim, ERC, annotations) already exists.
