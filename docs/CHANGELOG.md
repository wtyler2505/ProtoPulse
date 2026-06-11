# Changelog

All notable changes to ProtoPulse are documented in this file.

## 2026-06-11 — board outline in the core

### Added
- **set_board_outline** (singleton; null clears) through the full
  graph closure: apply deep-copies, inverse restores the previous
  polygon (or the no-outline state), diff gains
  pcbView.outlineChanged, merge replays theirs-only outline changes
  (ours wins when both touched it), JSON round-trips, invariants
  check integer coordinates. The 100%-branch gate on the core held.
- **Gerber Edge.Cuts** (`exportEdgeCuts`): the outline as a Profile
  layer stroked at 0.1mm (the KiCad convention fabs expect); returns
  null when the design has no outline — an honest absence, not an
  empty file. Existing golden fixtures have no outline and stay
  byte-identical.

### Honest cuts (substrate-first, like buses+sheets)
- No outline drawing tool, renderer display, or DRC copper-to-edge
  check yet — listed on the ROADMAP; panelization now has its
  prerequisite.

### Verified
- 6 graph closure tests (set/reshape/clear, inverse round-trip both
  ways, diff both directions, merge set/clear/ours-wins, JSON,
  invariants) + 1 export test (null absence, Profile header, closed
  stroke, byte determinism). Full test:packages green; goldens
  untouched; eslint 0 errors.

## 2026-06-11 — cascading shove

### Added
- **Cascading shove** (@protopulse/route): when a shove victim's
  detour is cornered (its endpoints swallowed by merged obstacle
  hulls), shovable traces overlapping its corridor AABB are recruited
  into the victim set and the whole plan re-runs — sequential
  cumulative planning keeps every round mutually consistent by
  construction. Rounds capped at MAX_CASCADE_ROUNDS=4; corridors that
  stay blocked after the cap refuse honestly. Stated trade-off: the
  corridor heuristic can over-shove a neighbor that didn't strictly
  need to move — safe churn, undone by spring-back.

### Verified
- New test: a victim walled into a channel between two long traces (a
  short crossing trace hits ONLY the victim) recruits both walls;
  all three reroute and the final configuration is verified mutually
  clear path-by-path. The single-level "nowhere to go" refusal test
  still blocks (endpoints inside the shover's own hull — no cascade
  can fix that). Full test:packages green; eslint 0 errors.

## 2026-06-11 — sim worker streaming: v0.2 complete

### Added
- **Batch progress streaming**: Monte Carlo and parameter-step runs
  stream one progress frame per completed deck from the sim worker;
  the Sim panel shows "Run 7/20 complete…" instead of a frozen
  spinner. Protocol: a `progress` frame per deck before the final
  reply, correlated by id; the client routes frames to an onProgress
  callback threaded from the panel through the cached runner.

### Honest scope
- Single-deck runs can't stream — ngspice-WASM runs a deck to
  completion; the boot message stays for those.

### Milestone
- **v0.2 (The Lab) is COMPLETE.** The two remaining ⬜ markers in the
  ROADMAP were stale (math channels/FFT/branch overlays and the
  AC-source emitter for graph-driven noise all landed earlier) — the
  section is reconciled and closed. v0.1 retains only its three
  M1 stragglers (pcbnew manual check, MSDF/GPU picking, ESP32-S3
  part).

### Verified
- 2 new tests: the pure worker handler emits exactly one frame per
  batch deck (none for single runs), and SimWorkerClient routes
  frames to onProgress while resolving the final batch once, over the
  real handler behind a shim worker. Full test:packages green;
  full-tree eslint 0 errors.

## 2026-06-11 — review decks + community rules: v0.3 complete

### Added
- **Versioned review decks**: runReview accepts a named deck that
  enables/disables checks and overrides severities (a deck states its
  DEVIATIONS — absent checks run at defaults). Reports now pin the
  deck name + rev ('builtin' when none). ReviewDeckSchema lives in
  @protopulse/content; content/review-decks/protopulse-standard.json
  is the no-deviation house deck and the template community decks
  copy.
- **Community-extensible rules**: extraChecks — pure functions over
  the public graph/parts types whose findings join the report as
  first-class citizens, configurable by the deck exactly like
  built-ins.

### Honest cut
- The ReviewPanel still runs the builtin deck; a deck-picker UI is
  later work.

### Milestone
- **v0.3 (The Crew) is COMPLETE**: six crew members, design review as
  a versioned artifact, three teaching depths, buses+sheets, and the
  88-article wiki.

### Verified
- 2 new review tests (deck disable + severity override + deck/rev
  pinning; a community no-electrolytics rule joins, sorts, and is
  deck-silenceable) + 1 content test (the standard deck parses and
  lists every built-in). Full test:packages green; full-tree eslint
  0 errors.

## 2026-06-11 — the Buyer: the crew is complete (6/6)

### Added
- **The Buyer** (`@protopulse/ai`): sixth and final crew member from
  the vision's roster. read_bom (lines grouped by part + canonical
  value, so 10k ≡ 10K), find_offers (by ref or partId+value),
  assign_sourcing (writes fields.lcsc/mpn as reviewable ops — the
  vision's "Buyer-proposed substitutions, each one a reviewable op";
  guards part/value mismatches and preserves existing fields), and
  sourcing_report (basic vs extended counts, unsourced refs — numbers
  about classes, never about money).
- **Sourcing catalog seed** (`content/catalog/jlc-assembly-seed.json`
  + CatalogSchema/loaders in @protopulse/content): 9 LCSC part
  numbers hand-verified against LCSC/JLCPCB product pages this
  session (findings + sources routed through inbox/ per the
  verification protocol). NO prices or stock by design — a static
  catalog quoting those would be lying within a week; the rev stamp
  and "verify at order time" note say so, and a test enforces that
  entries stay price-free.
- **Buyer tab** in the editor: Analyst-pattern live chat; assignments
  land as one undoable batch with meta {agent: 'buyer'}.

### Honest cuts
- Live vendor APIs ("in stock at JLC right now") are v0.6+
  manufacturing-pipeline work; two catalog classes are marked
  "assumed" pending confirmation; offer packages may differ from the
  design's generic footprints (0603 offers vs 0805 seeds) and the
  Buyer is told to surface that, not hide it.

### Verified
- 6 AI tests (tool guards + FakeProvider story: read → offers →
  assign to both 10k refs → report sees the working copy; confirm
  gate) and 2 content tests (real catalog parses, rev-stamped,
  price-free). Full test:packages green; full-tree eslint 0 errors;
  Buyer tab browser-verified.

## 2026-06-11 — Firmware-panel core picker

### Added
- The Firmware tab grew a **core** selector: ATmega328P (16 MHz) or
  RP2040 (125 MHz), applied at load time. The emu session rebuilds
  the core when the kind changes; a build missing the requested
  constructor errors as a value, not a crash. Serial monitor and the
  logic-analyzer traces work for both cores (RP2040 pins show as
  GP0…GP29). Honest note: co-sim bindings still speak AVR pin names.

### Verified
- New runner test: rp2040 selection constructs the other core,
  switching kinds rebuilds, missing-constructor builds error cleanly.
  Browser-verified: the picker renders both cores in the Firmware
  tab. 385 app tests green; typecheck + lint clean.

## 2026-06-11 — RP2040 core: the second MCU

### Added
- **Rp2040Core** (`@protopulse/emu`): the McuCore contract's second
  implementation, on wokwi's rp2040js (Cortex-M0+). GPIO pin events
  cycle-stamped off the real core counter; setPin drives pads (input
  levels survive reset — bench wiring, not machine state); PL011
  UART0 both directions; the SAR ADC consults the host sampler at
  12 bits against 3.3 V (the AVR core is 10-bit @ 5 V — each core
  states its own architecture's truth, PC in bytes vs words included).
- **thumb-asm.ts**: hand-assembler for the Thumb-16 subset the tests
  need (asm.ts's Cortex sibling, encodings from the ARMv6-M ARM) plus
  loadConst for 32-bit register constants.

### Honest cuts (stated in the adapter)
- Firmware images are raw Thumb entered at the flash base (no
  bootrom/boot2/UF2); ADC conversions complete instantly instead of
  after the silicon's ~2 µs; reset = rebuild (rp2040js has no full
  power-on reset); engine-level only — the Firmware panel still
  drives the AVR until a core picker lands.

### Verified
- 7 tests, all real hand-assembled firmware against real RP2040
  registers: GP25 blink (cycle-stamped alternation), GP2→GP25 input
  mirror through SIO+PADS, UART TX, full UART echo (firmware enables
  the PL011 and echoes a fed byte), ADC start→READY-poll→RESULT→UART
  round trip through the sampler, reset/firmware-survival, guards.
  Full test:packages green; full-tree eslint 0 errors.

## 2026-06-11 — sync relay round 2: persistence + auth

### Added
- **Room persistence** (`PP_RELAY_DATA`): rooms append to one JSONL
  file each (append-only — the write story matches the op-log's
  accrue-only nature); a restarted relay re-seeds rooms from disk
  before any client rejoins. Crash-safe by format: appends lead with
  a newline so a cut-short write isolates as one skippable line — a
  bug the restart test caught (a partial tail used to swallow the
  next record). The relay still never owns designs.
- **Shared-token auth** (`PP_RELAY_TOKEN`): when set, joins must carry
  the token; rejected joins get an explicit unauthorized error and the
  socket closes. The Sync panel grew a token field, and the client
  treats relay-level errors as terminal — no retry storm against a
  closed door.

### Honest cut
- Branch sync remains open (ROADMAP): non-main branches stay local.

### Verified
- 2 new relay tests (token gate incl. no-room-leak on rejection;
  rooms survive a relay restart with a corrupt-tail file) + 1
  end-to-end client test against a real token-gated relay (wrong
  token errors without reconnect-looping; right token syncs). Full
  test:packages green; full-tree eslint 0 errors.

## 2026-06-11 — thermal reliefs

### Added
- **Thermal reliefs on zone pours**: zones carry `connect: solid |
  thermal` (optional, absent = solid) through the full graph closure —
  apply/inverse/merge/serialize all preserve it, the 100%-branch gate
  on the core held. Thermal pours carve an annular gap (pad inflated
  by the pour clearance) around every same-net pad, bridged by 4
  orthogonal spokes (default width 0.4mm, a solderability convention)
  — computePour returns a reliefs count and the notch geometry is
  exact-area tested. Same-net traces and vias stay solid-connect; the
  honest cut is stated in the code, the wiki, and here.
- **Zone Inspector**: selecting a zone now shows net/layer/corners and
  a solid|thermal toggle — switching styles lands as ONE undoable
  batch (remove + re-place under the same id; selection survives).
- Obstacles now carry their copper kind (trace/via/pad) — the pour
  partitions same-net pads from same-net track without label-parsing.

### Verified
- 2 new pour tests (exact notch area vs the solid pour; traces/vias
  unaffected), 1 graph closure test (connect through apply, inverse,
  merge replay, JSON). Browser-verified: thermal pour renders the 4
  corner notches; Inspector toggle flips solid↔thermal as one batch
  with live re-pour. Gerber goldens byte-identical (solid default).
  Full test:packages green; full-tree eslint 0 errors.
- The zones-and-thermal-reliefs wiki article's "See it" updated — it
  honestly claimed reliefs didn't exist; now it honestly claims they
  do.

## 2026-06-11 — concepts wiki complete: 88/88

### Added
- **Final PCB tranche (12 articles)**: return-paths, loop-area,
  trace-width-vs-current, vias-thermal-and-signal,
  zones-and-thermal-reliefs, courtyards, annular-rings,
  silk-discipline, stackup-basics, diff-pairs-at-hobby-scale,
  acid-traps, panelization. The Vol III §2 seed list (88 articles,
  nine categories) is complete. "See it" sections stay honest about
  today's editor: solid-connect zones (no thermal reliefs yet), no
  diff-pair mode, no panelization, 2-layer only.
- **drcCodes frontmatter** (optional): PCB articles can claim the DRC
  codes that deep-link to them, mirroring ercCodes. Validation is
  bidirectional and lives in @protopulse/drc (content can't depend on
  drc without a cycle): every DRC code maps to a real article, every
  drcCodes claim is a real DRC code.

### Changed
- DRC codes re-pointed from placeholder fundamentals slugs to the real
  PCB articles: DRC-TRACE-WIDTH → trace-width-vs-current, DRC-ANNULAR
  and DRC-DRILL → annular-rings, DRC-ZONE-OVERLAP and
  DRC-ZONE-ISOLATED → zones-and-thermal-reliefs. (DRC-CLEARANCE stays
  on tolerance-stacking — the honest home; the seed list has no
  dedicated clearance article.)

### Verified
- Content tests now require the pcb category, ≥88 articles, and all
  12 PCB block slugs; the drc concept-mapping test scans the whole
  wiki (was: fundamentals only). Full test:packages green; full-tree
  eslint 0 errors.

## 2026-06-11 — the Architect: fifth crew member

### Added
- **The Architect** (`@protopulse/ai`): organizes designs on the shared
  agent loop — read_structure (sheet tree + buses + unbussed nets +
  root components), create_bus (named bus over nets BY NAME, whole-call
  failure on unknowns), create_sheet (add_sheet + interface ports +
  component moves in one call, parents resolved by name), and
  move_components (onto a sheet or back to the root). Unlike the
  Analyst (injected sim) and the Router (injected routing stack), its
  tools need NO host hooks — buses and sheets are graph entities, so
  the agent loop's working copy is the whole substrate. The purest
  proof yet of "once the substrate exists, a crew member is an
  assembly job".
- **Architect tab** in the editor: same live-chat shape as the
  Analyst/Router; structure lands in the session as one undoable batch
  with meta {agent: 'architect'} — blameable and syncable like any
  edit.

### Fixed
- Renderer scene tests: the hand-rolled mock graph lacked the `sheets`
  map the buses+sheets diff now iterates — 8 latent failures on main,
  green again.

### Verified
- 6 new AI tests (tool registry + FakeProvider end-to-end story:
  read → bus POWER → sheet PSU with interface → verify on the working
  copy; confirm-gate honored). 116 AI / 99 renderer / 383 app tests
  green; typecheck + lint clean; tab browser-verified.

## 2026-06-11 — buses + sheets in the graph core; wiki at 76/88

### Added
- **Buses + sheets** (the Architect's substrate, Vol II §A.5): the
  vision's five ops — create_bus, assign_to_bus, add_sheet,
  set_sheet_interface, move_to_sheet — plus remove_bus/remove_sheet
  (the inverse algebra demands them; zones set the precedent). Full
  closure: bidirectional bus membership maintained through assign/GC/
  merge_nets; sheet interface ports GC with their nets and re-point on
  merges; occupied sheets refuse removal; component sheetId rides the
  component prop deltas so diff/merge get sheet moves for free
  (replayed as move_to_sheet, deferred until theirs-added sheets
  exist — an op-ordering bug a closure test caught). Invariants:
  bidirectional membership, parent existence + cycle walk, binding
  existence. Serialization back-compatible.
- **Concepts wiki 63 → 76**: analog-sensing/ (9 — ADC reference
  quality through aliasing) and practice/ (4 — abs-max ratings,
  footprint choices, ESD truth vs ritual, asking good debugging
  questions). One tranche left: PCB (12), completing the 88.

### Verified
- 30 new graph tests; the 100%-branch gate on ops/apply/materialize/
  diff HELD (all four at 100/100/100/100); 189 graph + 21 content +
  383 app tests green; typecheck + lint clean.

## 2026-06-11 — copper zones, end to end

### Added
- **Zones/pours in four gated phases.** The graph stores INTENT (an
  outline polygon for one net on one layer, optional clearance
  override); the pour — outline minus foreign copper at clearance — is
  derived everywhere it's needed. place_zone/remove_zone close fully
  (apply/GC/inverse/diff/merge/invariants/serialize; the coverage gate
  caught merge_nets not re-pointing zones to the survivor).
  computePour (@protopulse/route): martinez boolean geometry, integer-
  nm boundary, square-corner keep-outs (conservative by construction),
  same-net copper left in the fill — that's how a zone connects.
- **On screen + in hand**: pours render as dimmed copper UNDER traces/
  pads (outline-only until the deck clearance loads — never a guess;
  the scene rebuilds the moment clearance arrives), and the Zone tool
  draws them (pad click seeds the net, corners snap, first-corner
  click closes).
- **DRC**: DRC-ZONE-OVERLAP (different-net zones overlapping pour
  overlapping copper — a short) and DRC-ZONE-ISOLATED (no same-net
  copper inside the outline — an island), both wiki-mapped.
- **Gerber**: zone pours emit as G36/G37 regions, holes via LPC/LPD
  polarity restored before the dark copper draws on top. Frozen in the
  new `zoned-led` golden fixture; every pre-zone fixture stayed
  byte-identical.
- Honest cuts stated where they live: solid connects (thermal reliefs
  are a later slice), square-corner keep-outs.

### Verified
- Pour math by analytic area to the nanometer; 36 DRC tests; golden
  29/29; browser-verified: the zoned-led pour fills with clearance
  moats around every piece of foreign copper, and DRC reports clean.

## 2026-06-11 — failure puzzle #1: the bus that never reads high

### Added
- **The failure-puzzle system** (Vol III §1.4): a broken design + a
  symptom + the instruments; solved when you ANNOTATE the actual
  root-cause net/component on the schematic — solved-ness is a property
  of the design's own op-log (annotate ops), not a quiz UI. PuzzleSchema
  in @protopulse/content, puzzles ship as content/puzzles/<id>/
  {puzzle.json, design.ppx.json}, Puzzles tab in the editor (symptom,
  suggested instruments, progressive hints, mark-selection-as-root-
  cause, explanation revealed on solve; wrong marks stay in history —
  debugging leaves tracks).
- **slow-rise-11** from the catalog: an open-collector bus whose 100k
  pull-up against ~10nF of bus capacitance (τ ≈ 1ms) never reaches a
  valid high between driver pulses. ERC passes — the bug is legal
  electricity with wrong values; the transient tells the story.

### Verified
- The puzzle premise is PHYSICS-TESTED in real ngspice: the broken bus
  peaks <2.5V in steady state; swapping the pull-up to 4.7k puts it
  >3.5V. Schema/anchor/ERC/checker tests alongside. Browser-verified
  end-to-end: load → hint → select R1 on canvas → mark → ✔ solved.

## 2026-06-11 — the Router: fourth crew member

### Added
- **The Router** (`runRouter` in @protopulse/ai + Router tab in the
  editor): copper is geometry, clearance is law, the ratsnest is a
  to-do list. Four tools — read_board (placements/traces/ratsnest
  digest), route_connection (walk-first; shove when walk reports no
  corridor; refusals surface as tool errors the model adapts to),
  run_drc, remove_trace. Engines are dependency-injected (RouterHooks,
  pinned like sim-types): the app wires the REAL walkaround/shove/DRC
  stack — the same machinery the human trace tool drives.
- Routes apply to a working copy inside the loop (Draftsman pattern);
  on completion they land in the session as ONE undoable batch with
  meta {agent: 'router'} — blameable and syncable like any edit.
- Ratsnest segments now carry their endpoint port refs (aPort/bPort),
  so airwires can be named ("R1:2 → R2:1") by every consumer.

### Verified
- 5 ai tests (FakeProvider end-to-end: read → walk refusal → shove →
  DRC-clean on the working copy; destructive confirm gate) + 5 app
  host tests over the REAL engines (labeled ratsnest, walk routes
  emptying the ratsnest, shove with victim ops, deck-loading refusal,
  real DRC findings). Live Anthropic runs need Tyler's key (same as
  Analyst/Professor).

## 2026-06-11 — CI circuit badges

### Added
- `protopulse check --badge <file>`: a shields-style SVG of the check
  result — green "ERC clean", amber "clean · N warnings", red
  "N errors" or "corrupt log". Deterministic by construction (flat
  per-char text metrics, no timestamps) and honest by design: the
  badge writes even when the same run fails the pipeline, so a
  hardware repo's README always shows the truth. Real artifact for the
  555 fixture committed at docs/badges/ and embedded in
  packages/README.

## 2026-06-11 — the sync relay: real-time collaboration

### Added
- **`@protopulse/relay`**: a tiny in-memory WebSocket room server. One
  room = one shared op-log; the relay unions envelopes by (actor,
  lamport) and broadcasts the news — it never interprets ops and never
  resolves conflicts, because materialize's (lamport, actorId) total
  order makes same-set ⇒ same-graph. Schema-validated frames, batch/
  message caps, rooms survive everyone leaving. `npm run -w
  @protopulse/relay dev` → ws://localhost:8787.
- **Sync tab in the editor**: connect to a relay room and edits flow
  both ways live. Joining sends your log, the snapshot brings theirs,
  every local dispatch pushes deltas; remote ops ingest without
  touching the undo stack (you can't undo someone else's edit — your
  own undos sync as inverse ops). SessionCore grew `ingest` (dedupe +
  lamport clock advance).
- Honest v1 notes shipped in the panel itself: main branch only,
  in-memory rooms, one tab per design per browser profile.

### Verified
- 6 relay tests (snapshot/union/dedupe/peers/validation/room
  persistence) + 4 app integration tests running TWO REAL session
  stores through a real in-process relay over Node's native WebSocket —
  bidirectional edits, concurrent-edit convergence, undo propagation.
- Two-browser live demo: an empty editor joined a room and received
  the full design; an edit in browser A appeared on browser B's canvas
  within a second.

## 2026-06-10 — shove + spring-back routing (E.1 steps 2–3)

### Added
- **Shove mode** on the PCB trace tool: the new trace goes where you
  drew it; different-net traces in the way are re-routed around it by
  the walkaround engine (`planShove` in @protopulse/route) — victims
  plan sequentially with cumulative obstacle insertion so the final
  configuration is mutually clear by construction. Hull-cluster merging
  makes detours around shover-touching pads possible. Honest cuts:
  pads/vias never move, victims re-route end-to-end, single-level shove
  (cascades refuse with a reason).
- **Spring-back**: deleting the shover restores its victims to their
  pre-shove paths — read straight from the op-log (shove commits are
  batches labeled 'shove'). A victim only springs back if the user
  hasn't re-routed it since AND the original path is still
  clearance-legal. Rides in the same delete batch, so undo is atomic.
- The 'manual | walk | shove' mode chips on the trace toolbar — and the
  walk mode is now actually wired to the tool (the engine landed in the
  v0.4 slice; the toggle claim preceded the wiring — debt paid).

### Verified
- 11 new engine tests + 4 tool tests + 6 spring-back tests; browser
  end-to-end: shove flashed "Shoved 1 trace(s) aside" with the victim
  visibly detouring, deleting the shover restored its straight path.

## 2026-06-10 — sim ghost overlay (voltages painted on the wires)

### Added
- **Canvas ghost**: after an op or transient run, every net on the
  schematic tints by its solved voltage — cold blue at the range floor,
  warm orange at the ceiling — with a gradient legend (instant label +
  min/max) in the Sim panel and a hide button. Honesty built in: only
  op/tran produce a ghost (AC/noise/sweeps have no single per-net
  voltage), and the ghost carries a (branch, opsVersion) stamp — edit
  anything and it vanishes instead of lying. Renderer grew a generic
  per-node `tint` overlay channel (lowest priority, under selection/
  highlight/diff).

## 2026-06-10 — blame on canvas (the op-log trilogy completes)

### Added
- **History (blame) in the Inspector**: select any component or net and
  see every op that ever touched it — who (actor), when (timestamp),
  what (op summary, batch-aware), and why (meta.rationale on AI/fix
  ops, agent chip included). Click an entry to time-travel to that
  exact moment in the History tab. Pure op-log filter (`blameFor`) —
  no new state, the envelopes always had the answers. With replay
  (watch history), merge (combine histories), and blame (interrogate
  history), the op-log thesis is now fully user-facing.

## 2026-06-10 — serverless share links (v0.6 first slice, early)

### Added
- **Copy share link** in the Export panel: the whole DesignBundle —
  op-log, branches and all — deflate-compressed (native
  CompressionStream, no deps) and base64url-encoded into the URL
  fragment. No server, no upload; the fragment never leaves the
  browser. Receiving end loads after a confirm guard (never silently
  replaces a working design; empty sessions load directly) and strips
  the hash. Browser-verified: the 67-op traffic-light-555 travels as a
  2,129-char URL and lands intact in a pristine browser.

## 2026-06-10 — interactive merge resolver (M1 straggler closed)

### Added
- **Merge in the Branches panel**: any branch merges into the current
  one. Engine half in `@protopulse/graph`: `BranchLog.mergeBaseOps`
  (nearest-common-ancestor prefix across forks, siblings, nested
  branches) and `resolveConflict` (one conflict + one ours/theirs pick →
  ops; returns null for picks M1 cannot express, so the UI disables
  them instead of lying). UI half: auto-merged changes listed, every
  conflict an explicit pick, Apply gated until all are decided; the
  merge lands as ONE undoable batch with `parents: [ours, theirs]`
  recorded in the op-log. Verified end-to-end in the browser: forked
  value conflict (47k vs 1k) surfaced, resolved theirs, landed.
- 17 new tests (engine merge-base topologies + every resolveConflict
  path; store merge workflow incl. stale-merge invalidation); graph
  coverage gate held.

## 2026-06-10 — time-lapse replay (History tab) + demo media rig

### Added
- **History tab** in the new editor: time-lapse replay of the op-log.
  The design IS its op-log, so any moment is a prefix materialization —
  scrub the slider, press play (3 speeds), or click any op to jump.
  Every graph reader (canvas, Inspector) follows the scrub position;
  the session is read-only until "Back to live" (dispatch/undo/redo
  refuse, branch switches exit replay). Status bar shows ⏪ replay k/N.
- `describeOp` — one human-readable line per op kind for the History
  list (pure, payload-only; ops are self-contained by design).
- Demo media rig: `tools/screenshots/capture-gif.ts` (co-sim story →
  `cosim-demo.gif`) and `capture-replay-gif.ts` (the 555 fixture
  building itself via the real History scrubber → `replay-demo.gif`),
  encoded pure-JS (gifenc + pngjs) with global palette + inter-frame
  diff transparency. Embedded in README and USER_GUIDE §19.

## 2026-06-10 — walkaround routing + the Lab stragglers

### Added
- `@protopulse/route`: walkaround interactive routing (Vol II E.1 first
  slice) — obstacle hulls inflated by clearance+width, flatbush broad
  phase, CW/CCW corner walks with recursion cap; 'manual | walk' toggle
  on the PCB trace tool with blocked-corridor refusal. 39 tests.
- Sim worker (ngspice off the main thread, node fallback preserved),
  plot FFT (radix-2 + Hann over resampled windows, per-trace toggle,
  log-x dB spectrum plot), AC-capable battery/rail emitters via
  fields.ac — graph-driven .ac and .noise now run end-to-end.
- Seam fixes from the parallel build: distributive worker-request types,
  traceMode initializer, and the FFT spectrum plot actually rendered
  (the computation existed; the lint gate caught the missing render).

## 2026-06-10 — v0.5 third slice: the loop closes

### Added
- `@protopulse/emu`: ADC peripheral (datasheet-accurate 25/13-clock
  conversions, completion-time host sampler — the D.3 hard sync point),
  assembler grows CPI/branch opcodes; bang-bang firmware verified
  reacting to analog input. 69 emu tests.
- `@protopulse/cosim`: runCosimClosedLoop — conservative quantum loop
  with comparator-fed digital inputs (VIH/VIL + hysteresis), ADC
  sampling against the previous solve, and loudly-counted from-zero
  re-solves. THE closed-loop test passes: firmware charges an RC node
  through its own pin, reads it back, and regulates — sustained
  oscillation around its 2.5V threshold. 65 cosim tests.
- App: closed-loop mode in the Co-sim panel (input/ADC bindings,
  quantum field, re-solve/ADC-read honesty readout). 304 app tests.

### Known gaps (ROADMAP.md)
- WebSerial flashing (hardware required), RP2040/ESP32 cores, solver
  state continuity (currently O(quanta²) re-solves, counted honestly).

## 2026-06-10 — v0.5 second slice: the co-sim bus (the crown jewel, one way)

### Added
- `@protopulse/cosim`: firmware GPIO edges become PWL sources behind a
  series-Rout behavioral boundary, injected via sim's additive
  extraCards hook. The thesis test runs real avr8js blink firmware into
  a real ngspice RC low-pass: 0.94Vpp settled ripple measured vs ~0.9Vpp
  predicted. 31 tests.
- App: Co-sim panel — pin→net bindings, window/step controls, the Vol II
  D.3 slowdown-factor honesty readout, digital traces stacked above the
  analog response in one plot. Shared emu session with a documented
  suspend/reset borrow protocol. 36 new tests (app at 284).

### Known gaps (ROADMAP.md)
- Feedback direction (digital inputs + ADC hard sync), WebSerial
  flashing, RP2040/ESP32 cores.

## 2026-06-10 — v0.5 first slice: The Bridge — firmware in the loop

### Added
- `@protopulse/emu`: ATmega328P emulation on avr8js — McuCore contract,
  cycle-stamped GPIO events, UART queues, Intel-HEX parser, and a
  documented mini-assembler so tests assemble their own firmware (the
  blink test asserts real edges on B5 at ~1206-cycle spacing). 47 tests.
- App: Firmware panel — HEX load, frame-budgeted run/pause, serial
  monitor with input, stacked square-wave pin traces. 33 new tests.

### Known gaps (ROADMAP.md)
- Co-sim bus, WebSerial flashing, ADC + remaining peripherals,
  RP2040/ESP32 cores.

## 2026-06-10 — v0.4 second slice: fab outputs + board rendering truth

### Added
- `@protopulse/export`: Gerber X2 copper layers (integer-nm FSLAX46, no
  float arithmetic in emission), Excellon drill, pick-and-place CSV;
  routed-led golden fixture freezes all fab artifacts byte-exact.
- Renderer: GL triangle pipeline — filled pads, real stroked trace
  widths with round caps/joins, vias as annuli with background drills;
  PCB scene delta sync (identity-preserving); side-flip (F key +
  Inspector) with mirrored bottom rendering.

### Known gaps (ROADMAP.md)
- Push-and-shove routing, zones/pours, panelization.

## 2026-06-10 — v0.4 first slice: The Board

### Added
- Graph: PCB ops are live — place/move/unplace_footprint, route_trace,
  place_via, remove_trace/via as id-keyed entities with GC, inverse,
  diff, and merge support; 100% core coverage gate held.
- Parts: footprint model with generic IPC-class seeds (0805, SOT-23,
  DIP-8), explicitly unverified-until-per-MPN.
- `@protopulse/drc`: width/clearance/annular/drill/unrouted checks
  against the shipped JLC deck. 34 tests.
- App: PCB mode — unplaced tray, footprint placement with rotation,
  octilinear trace tool with cross-net refusal, vias, dashed ratsnest,
  layer toggle, DRC panel with deck rev. 63 new app/renderer tests.

### Known gaps (ROADMAP.md)
- Push-and-shove, stroked widths/filled pads, Gerber export, in-browser
  visual QA of PCB mode.

## 2026-06-10 — v0.3 first slice: Design Review + the Professor

### Added
- `@protopulse/review`: the Vol II G.4 Design Review — embedded ERC,
  decoupling-per-IC (executable 100nF fix), power-tree rollup,
  unverified-parts-in-load-bearing-roles, unwired ICs, DNP-killed rails;
  stored/diffable ReviewReport with opened/closed deltas. 40 tests;
  golden Probe fixture reviews with zero errors.
- The Professor — depth-adjustable crew member with lookup_concept /
  explain_finding grounded in the concepts wiki; ReviewPanel's
  per-finding "Ask the Professor" handoff seeds it with the finding.
- The three teaching depths (do-it/show-me/teach-me): persisted dial,
  apply-fix narration through the status bar, teach-me auto-opens the
  mapped concept article.

## 2026-06-10 — v0.2 second slice: Monte Carlo, stepping, noise, the 555 lives

### Added
- `@protopulse/sim`: seeded Monte Carlo (R 5% / C 20% / L 10% defaults,
  deterministic mulberry32, value-override netlists), parameter stepping,
  .noise analysis (engine verified; input source must carry an AC value),
  and the NE555 behavioral macromodel — hysteretic discharge switch +
  regenerative latch; the golden traffic-light fixture oscillates at
  0.719-0.720s measured vs 0.721s theory. 69 sim tests.
- App: math channels (safe parser — v(a)-v(b), db/abs/mag, complex-aware),
  branch overlay with dashed traces and dual fidelity bars, Monte Carlo
  spaghetti + step trace families, noise UI. 129 app tests.

### Known gaps (ROADMAP.md)
- Sim worker + streaming; plot FFT; AC-source emitter for graph-driven
  noise.

## 2026-06-10 — v0.2 first slice: The Lab is live

### Added
- `@protopulse/sim`: deterministic graph→SPICE netlist generation with the
  model-tier honesty system (spice/behavioral/stub + fidelity manifest),
  op/tran/dc/ac analyses, ngspice-WASM engine wrapper (eecircuit-engine,
  MIT). 48 tests including real-WASM integration against the golden
  led-resistor fixture.
- App: "Sim" panel (analysis picker, fidelity bar with tier chips, trace
  list) and a dependency-free canvas plot workspace (engineering-notation
  axes, crosshair readout, dB/log-x for AC).
- The Analyst — second crew member ("skeptical of everything until it's
  plotted"): run_simulation/measure/read_design tools, shared runAgentLoop
  extracted from the Draftsman, first live Anthropic-wired panel
  (localStorage key with plain-text warning).
- Verified in-browser: golden LED circuit simulated end-to-end (1008-point
  transient; v(led_a)≈2.2 V, loop ≈20 mA — physically correct).

### Known gaps (tracked in ROADMAP.md)
- Noise/Monte-Carlo/param-step analyses, sim worker + streaming, NE555
  model (stub), plot math channels/FFT/branch overlays.

## 2026-06-10 — Milestone 1: the engine redesign lands

The first milestone of the ground-up redesign ("the vision", three volumes) landed on branch `claude/protopulse-vision-geapzy`: a greenfield npm-workspaces monorepo at `packages/` (`@protopulse/*`), living alongside the legacy app (`client/ server/ shared/` — untouched, still the shipping product; it migrates onto the engine in later milestones).

### Added
- `@protopulse/graph` — the core: one canonical design graph; every mutation a typed op; the design IS its op-log (JSON Lines), graph as materialized view. Integer-nm coordinates, UUIDv7 entities, deterministic materialization by (lamport, actorId), inverse-op undo, O(1) branches, visual diff (GraphDelta), three-way merge with conflicts as data. On-disk `.ppx` directory or `.ppx.json` bundle (spec: `packages/graph/README.md`). 100% branch coverage gate in CI.
- `@protopulse/parts` — minimal part model (ERC electrical pin types, 1.27mm-grid symbols, provenance tiers); 17 seed parts, NE555 + BAT54S pin maps datasheet-verified.
- `@protopulse/erc` — 10×10 pin-conflict matrix + net rules (floating inputs, unpowered supplies, single-port nets, open-collector pull-up with an executable fix, current budgets); every finding code maps to a concepts-wiki article.
- `@protopulse/export` — deterministic KiCad legacy-E netlist + CSV BOM; byte-exact golden-file tests in `tools/golden/`.
- `@protopulse/cli` — `protopulse check` / `export`: headless ERC in CI ("CI for circuits"), exit codes 0/1/2.
- `@protopulse/renderer` — WebGL2 retained scene graph, flatbush picking, canvas-glyph-atlas text, nm→px camera with LOD.
- `@protopulse/app` — the new schematic editor (port 5174): place/wire (Manhattan routing), undo/redo, branch switcher with green/amber diff overlay, ERC panel with apply-fix + concept links, KiCad/BOM/bundle export, Draftsman panel.
- `@protopulse/ai` — provider-agnostic agent runtime: zod tool registry with scope slices, destructive-confirm gating, explain() narration, budgeted context assembly; the Draftsman agent (exactly 8 tools); Anthropic adapter (browser-direct, user key); every applied op carries `meta {agent, rationale}` for op-log blame.
- `@protopulse/content` + `content/` — JLCPCB 2-layer DRC rule deck, 14 concept articles, curriculum Track 1 "First Light" steps 01–05 (machine-checkable `erc: clean` goals).
- Root commands `npm run check:packages` / `npm run test:packages`; packages CI workflow (`.github/workflows/packages-ci.yml`); ESLint coverage of `packages/` (zero errors). 346 package tests.

### Known gaps (M1)
- KiCad pcbnew import of the golden netlists awaits one manual verification (`tools/golden/README.md`).
- Merge conflicts surface as data; no interactive resolver UI yet.
- MSDF text and GPU picking deferred; ESP32-S3 part deferred.

## [Unreleased]

### Added (Wave 140)
- Snapshot restore cascade engine — `analyzeSnapshotDomains`, `generateRestorePlan`, cross-domain warnings, 46 tests (BL-0568)
- PCB geometry bridge — `extractTraceGeometries`, `traceGeometryToPdnInput`/`SiInput` converters, 34 tests (BL-0561)
- GPU Monte Carlo engine — async init with 3-attempt retry, GPU/CPU dispatch, dispose lifecycle, 28 tests (BL-0550)
- ISR safety scanner — 8 ISR rules, `findIsrBodies`, `scanForIsrViolations`, 58 tests (BL-0413)
- Dependency resolver — `extractIncludes`, 57 known library headers, `resolveDependencies` with conflict detection, 42 tests (BL-0404)

### Added (Wave 139)
- BOM tolerance bridge — `parseTolerance`, `bomItemsToToleranceSpecs`, tolerance column added to `bom_items`, 26 tests (BL-0574)
- PCB thermal bridge — `PACKAGE_THERMAL_DB` 15 packages, `extractThermalComponents`, 30 tests (BL-0562)
- BOM back-annotation — `BackAnnotationManager` singleton, `findMatchingInstances`, `generateBomBackAnnotationPatch`, 38 tests (BL-0563)
- PCB back-annotation — `syncRefDesChange`, `syncPropertyChange`, 29 tests (BL-0559)
- Design reuse schematic snippets — `SnippetCircuitInstance`/`SnippetCircuitNet`, `prepareForPlacement` circuit ID remapping, 3 built-in snippets with circuit data, 60 tests (BL-0583)

### Fixed (Wave 139)
- Chat message ordering — `chat-context.tsx` now sorts messages ascending by ID

### Added (Waves 25-26)
- Design review commenting system — `CommentsPanel`, `design_comments` table, comments route (FG-12)
- Multi-model AI routing with design-phase awareness (IN-08)
- Interactive design tutorials — `TutorialMenu`, `TutorialOverlay`, tutorial context (IN-13)
- Backup/restore automation — backup route, scripts, runbook (CAPX-OPS-03)
- AC small-signal frequency analysis engine — MNA solver, 480 lines, 41 tests (FG-13)
- Project ownership model — `ownerId`, auth middleware, 20 tests (CAPX-SEC-01)
- Unified undo/redo stack — command pattern, React context, keyboard shortcuts, 36 tests (TD-25)
- ShapeCanvas decomposed from 1,275→755 lines into 6 extracted modules (TD-04)
- Theme picker panel with theme context
- SPICE import functionality
- Design history view and lifecycle dashboard
- Architecture snapshot diff engine (`shared/arch-diff.ts`)
- `design_snapshots` and `design_comments` tables (schema now 27 tables)

### Added (Waves 1-24)
- Architecture Decision Records (ADRs) in `docs/adr/`
- DRC manufacturer templates (JLCPCB, PCBWay, OSHPark) with pre-configured rules
- 5 new DRC rule types: annular-ring, thermal-relief, trace-to-edge, via-in-pad, solder-mask
- Session refresh/rotation mechanism for improved auth security
- Storage integration tests (67 tests covering cache, soft deletes, pagination, bulk ops)
- Auth session tests (18 tests covering token rotation)
- Shared test project in Vitest config (136 tests now running that were previously skipped)
- WCAG AA contrast ratio audit — all critical color pairs pass 4.5:1 minimum
- Collaboration roadmap re-sequenced behind identity/authorization foundation
- AI tool: `generate_test_plan` — fetches full project state for AI to write hardware test plans (FG-26)
- AI tool: `compare_components` — fetches BOM/architecture data for AI component comparison tables (FG-27)
- Dedicated ExportPanel component with 3 categories, 10 formats, per-format download state (UI-06)
- @dnd-kit drag-and-drop from component library to architecture canvas (IN-10)
- `component_lifecycle` table for tracking component lifecycle status, alternate parts, and data sources (FG-32)
- CRUD routes for component lifecycle at `/api/projects/:id/lifecycle` (FG-32)
- Netlist comparison engine in `shared/netlist-diff.ts` — diff two circuit netlists by component and net (FG-33)
- Netlist diff endpoint `POST /api/circuits/:circuitId/netlist-diff` with baseline comparison (FG-33)
- BOM Comparison tab in ProcurementView — Tabs layout with BOM Management + BOM Comparison/BomDiffPanel (UI-34)
- Net class management UI (`NetClassPanel.tsx`) — create/edit net classes with trace width, clearance, via diameter, color-coded badges (UI-14)
- JSDoc documentation across all 11 AI tool modules in `server/ai-tools/` (TD-29)
- AI tool: `suggest_components` — analyzes architecture/BOM/circuits for missing components across 9 categories (IN-05)
- AI tool: `design_review` — comprehensive design review across 7 categories with severity-rated findings (IN-18)
- X-Request-Id header on all HTTP responses with client-side error propagation (CAPX-OBS-04)
- Database transactions for `updateBomItem` and `updateComponentPart` preventing race conditions (CAPX-ARCH-02-EXP)
- Auth regression test suite — 92 tests covering 6 security implementations (CAPX-TEST-01)
- Storage transaction tests — 15 tests covering atomic BOM/component updates (CAPX-ARCH-02-EXP)

### Changed
- React.memo coverage increased to 29+ components across 24 files (from 9 initial)
- Export generators decomposed from 1,211-line monolith into 15 individual modules + types under `server/export/`
- `circuit-routes.ts` (1,804 lines) decomposed into 13 domain files under `server/circuit-routes/` (TD-16)
- `parseLocalIntent` (CCN=102) refactored to IntentHandler registry pattern with 11 handler modules (TD-05/EN-19)
- Test suite expanded from ~350 tests (Wave 1) to 1,553 tests across 54 files
- AI tool count increased from 53 to 82
- Database schema expanded from 11 to 27 tables
- Domain routers expanded from 18 to 21; circuit routers from 11 to 13
- ProcurementView refactored from single-panel to tabbed layout (BOM Management + BOM Comparison)

### Fixed
- DRCRuleType union extended to include all implemented rule types
- Various TypeScript strict mode compliance fixes across test files

## [0.1.0] - 2026-02-15

### Added
- Initial release: architecture block diagrams, BOM management, circuit schematic editor
- AI chat with 82 AI tools (Anthropic Claude + Google Gemini)
- Design validation (DRC/ERC)
- Multi-format export: KiCad, Eagle, SPICE, Gerber, drill, pick-and-place
- Dark theme with Neon Cyan accent
