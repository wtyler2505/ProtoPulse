# Innovation Roadmap

> **Unlike plans 01-17, this is NOT a TDD implementation plan.** These items are prioritized design briefs. Each one is large enough to become its own plan. Convert briefs to plans as engineering capacity frees up. No checkboxes; no failing tests. Just scope, competitive rationale, and source-finding de-duplication.

**Goal:** Capture every 🚀 moonshot + 🟢 competitive/strategic finding from the audit, de-duplicate across the 14 sub-passes where the same idea was flagged under slightly different IDs (AR wiring appears 4× in the source), and rank them so the team can pick what to elevate to a full plan next quarter.

**Parent:** `00-master-index.md` §4.2 (dedup canonical table), Tier H (last wave).

---

## De-dup canonical catalog (summary of master-index §4.2)

Each canonical item lists ALL source IDs so none are silently dropped.

### Canonical #1 — AR guided wiring (phone camera over physical breadboard)
**Sources:** E2E-542, E2E-600, E2E-711 (haptic variant).
**Vision:** Mobile app mode — point phone at real breadboard → AR overlay shows next wire to place per the schematic. Step-by-step build guide.
**Rationale:** Nobody in the field does this (neither Wokwi nor Fritzing nor Tinkercad). PR-magnet feature. Aligns with maker/educator audience.
**Scope estimate:** 1 quarter. Requires mobile shell (Expo or React Native), CV library (OpenCV.js or MediaPipe), a calibration target printed on breadboard.
**Priority:** HIGH — unique moat.

### Canonical #2 — Wokwi-class live simulation (runs Arduino sketch; virtual GPIO drives visuals)
**Sources:** E2E-527 (MQTT/HTTP/WiFi sim), E2E-586, E2E-642-645, E2E-900-902, E2E-910.
**Vision:** Run user's Arduino sketch in-browser → virtual breadboard LEDs glow, displays render, motors spin. Wokwi parity.
**Scope estimate:** 1-2 quarters. AVR emulator (avr8js / SimAVR), ESP32 emulator (less mature), virtual peripheral framework.
**Priority:** HIGHEST — biggest competitive moat for ProtoPulse.

### Canonical #3 — Animated current/signal flow visualization
**Sources:** E2E-591 (breadboard), E2E-696 (iteration), E2E-822 (arch edges), E2E-909 (schematic), E2E-658 (data bus pulse), E2E-678 (wire color by current direction).
**Vision:** During live sim, wires render flowing dashes showing current direction. Visual debugger.
**Scope estimate:** 2 weeks once Canonical #2 runs.
**Priority:** HIGH — unlocked by #2.

### Canonical #4 — Hover-pin Vault tooltip (per-pin pedagogy)
**Sources:** E2E-544, E2E-649, E2E-704, E2E-891, E2E-961.
**Vision:** Hover any component pin → HoverCard with 3-line summary (function / voltage range / common gotcha) from Ars Contexta Vault.
**Scope estimate:** 1-2 weeks. Requires vault-to-pin mapping metadata on component library.
**Priority:** HIGH — dramatic teaching upgrade with low engineering cost.

### Canonical #5 — Photo-to-digital reconstruction (reverse capture)
**Sources:** E2E-594 (breadboard photo), E2E-730 (webcam inspection), E2E-907 (hand-drawn schematic), E2E-839 (competitor product photo).
**Vision:** Point camera at physical breadboard OR hand-drawn schematic OR competitor product → AI extracts digital model.
**Scope estimate:** 1 quarter. Multi-modal vision LLM (Claude/GPT-4V) + prompt engineering + iterative refinement UI.
**Priority:** MEDIUM — magic demo factor; requires robust fallback for misreads.

### Canonical #6 — Real-time multiplayer collaboration
**Sources:** E2E-522 (general), E2E-599 (breadboard), E2E-674 (breadboard sessions), E2E-817 (arch cursors).
**Vision:** CRDT-based co-editing with live cursors, presence, comments tied to design objects. Flux's killer feature.
**Scope estimate:** 1-2 quarters. Yjs or Automerge, WebSocket relay, conflict resolution for React Flow nodes + wires.
**Priority:** HIGH — team-scale adoption lever.

### Canonical #7 — AI critique persona (Dr. Kirchhoff / Friendly Maker / Stern Professor)
**Sources:** E2E-720 (personas), E2E-814 (Dr. Kirchhoff), E2E-927 (karaoke narration), E2E-933 (real-time review).
**Vision:** Pick a persona; AI tone adapts. Real-time design critique scoped to your current tab.
**Scope estimate:** 2 weeks. Prompt engineering + tab-context injection + streaming response.
**Priority:** HIGH — retention + differentiation.

### Canonical #8 — Voltage/signal probe overlay
**Sources:** E2E-655, E2E-694.
**Vision:** During live sim, hover any hole/wire → floating mini-meter shows Vinst / Vavg / Vpp / Vrms. Virtual Fluke.
**Scope estimate:** 1 week once #2 runs.
**Priority:** HIGH — unlocked by #2.

### Canonical #9 — Time-travel scrubber
**Sources:** E2E-537, E2E-645, E2E-833 (arch evolution), E2E-928 (schematic sim).
**Vision:** Scrub slider back/forward through design OR simulation history. See what changed. Replay.
**Scope estimate:** 2-4 weeks. Event-log capture + indexed replay.
**Priority:** MEDIUM.

### Canonical #10 — Mistake catalog (proactive teaching before Audit)
**Sources:** E2E-652, E2E-705, E2E-722 (failure-mode predictor), E2E-842 (arch lints real-time), E2E-929 (schematic live lint).
**Vision:** Fire DRC tips DURING wire creation, not just on Audit click. Prevents the fix-then-reaudit cycle.
**Scope estimate:** Partly in 07 Wave 6 Task 6.2. Canonical here covers full catalog + AI-driven discovery of new mistakes.
**Priority:** HIGH.

### Canonical #11 — Drag-to-trash + bench tray off-canvas
**Sources:** E2E-639/E2E-806 (trash), E2E-640/E2E-807 (tray).
**Vision:** Discoverable trash drop-zone. Bench tray for removed components awaiting re-placement.
**Scope estimate:** Covered partly in 07 Wave 5.
**Priority:** Landing in 07 — innovation here = expansion (cross-tab tray; trash with bulk undo).

### Canonical #12 — Skin packs / theme moods
**Sources:** E2E-738 (retro Eagle / cyberpunk / Soviet / blueprint / whiteboard), E2E-939 (same for schematic).
**Vision:** User chooses visual skin; applies globally. Could ship 3-5 pre-baked.
**Scope estimate:** 1 quarter (needs design investment, not just engineering).
**Priority:** LOW (polish).

### Canonical #13 — Voice input / voice wiring
**Sources:** E2E-511 (voice input button), E2E-541 ("what's wrong?"), E2E-719 (voice-controlled wiring), E2E-906 (schematic narration), E2E-940 (multi-modal "add low-pass filter at 1kHz").
**Vision:** Speak to the canvas. Accessibility + speed.
**Scope estimate:** 1 quarter. Web Speech API + LLM interpretation + canvas action mapping.
**Priority:** MEDIUM — strong accessibility story.

### Canonical #14 — Real Arduino USB twin
**Sources:** E2E-586, E2E-726 (USB-attached twin), E2E-934 (USB scope).
**Vision:** USB-attached real Arduino mirrors virtual breadboard. Best of both worlds.
**Scope estimate:** 1 quarter. Requires Tauri or WebSerial + firmware.
**Priority:** HIGH — bridges digital↔physical; retention winner.

### Canonical #15 — Flux Copilot parity (datasheet-drag + sourcing inline)
**Sources:** E2E-510 (multi-modal datasheet drag), E2E-524 (inline pricing), E2E-525 (datasheet AI), E2E-544.
**Vision:** Drag a PDF datasheet → AI extracts pins + creates component. Inline sourcing/lifecycle per BOM item.
**Scope estimate:** 1-2 quarters.
**Priority:** HIGH — Flux 2026 parity mandatory for credibility.

### Canonical #16 — KiCad 9 parity features
**Sources:** E2E-528 (Component Classes), E2E-529 (Jobsets — scoped into 15), E2E-530 (Selection Filter), E2E-531 (Design Blocks).
**Vision:** Component classes, jobsets pipelines, selection filter, saved design blocks.
**Priority:** MEDIUM-HIGH — professional adoption gate.

### Canonical #17 — VS Code extension (Wokwi pattern)
**Sources:** E2E-526.
**Vision:** `protopulse` VS Code extension — edit firmware in VS Code while ProtoPulse handles schematic/PCB.
**Scope estimate:** 2-4 weeks.
**Priority:** MEDIUM.

### Canonical #18 — Self-correcting AI loop
**Sources:** E2E-534, E2E-722, E2E-842, E2E-929.
**Vision:** Accept AI suggestion → AI re-analyzes impact → proposes follow-up corrections. Chained.
**Scope estimate:** 2-4 weeks.
**Priority:** MEDIUM.

### Canonical #19 — 1:1 scale rendering / physical-sense checks
**Sources:** E2E-532.
**Vision:** Zoom toggle: on-screen mm = real mm. Helps physical sense-checking.
**Scope estimate:** 1 week.
**Priority:** LOW-MEDIUM.

### Canonical #20 — Eagle / PADS / KiCad import/export
**Sources:** E2E-533.
**Priority:** HIGH — import/export breadth is a real adoption blocker.

### Canonical #21 — Git integration + programmatic API
**Sources:** E2E-560 (Git), E2E-561 (REST/WebSocket API), E2E-545 (GitHub Actions DRC).
**Vision:** Commit/PR workflow natively. Headless REST+WS API for CI. GitHub Action posts DRC + cost diff on PR.
**Priority:** HIGH (pro users + CI).

### Canonical #22 — Mood / aesthetic / sound / haptic
**Sources:** E2E-535 (sound effects), E2E-536 (haptic on tablet), E2E-709-713 (sensory immersive), E2E-740-742 (splash, mascot, bg music).
**Priority:** LOW.

### Canonical #23 — Time-lapse export + remix economy
**Sources:** E2E-673 (MP4), E2E-735 (royalty manifest), E2E-736 (rent-a-circuit).
**Priority:** LOW-MEDIUM.

### Canonical #24 — Magic / quantum / brain-computer sub-modes
**Sources:** E2E-731 (BCI), E2E-732 (quantum).
**Priority:** MINIMAL — defer indefinitely.

### Canonical #25 — Educator mode / class dashboards / grading
**Sources:** E2E-514, E2E-718.
**Priority:** HIGH (stakeholder — educator adoption = large user base).

### Canonical #26 — Mentor matching + Twitch for circuits
**Sources:** E2E-714 (Twitch), E2E-715 (mentor matching), E2E-716 (async design review).
**Priority:** MEDIUM.

### Canonical #27 — Build challenges + achievements
**Sources:** E2E-653 (daily puzzles), E2E-675 (weekly challenges), E2E-717 (tournaments), E2E-708 (mistake badges), E2E-739 (achievement carousel).
**Priority:** MEDIUM (engagement layer).

### Canonical #28 — Print-and-stick template
**Sources:** E2E-539, E2E-595.
**Priority:** MEDIUM — cheap / high charm.

### Canonical #29 — Simulated breadboard realism (contact resistance, tie-point fatigue)
**Sources:** E2E-596, E2E-597.
**Priority:** LOW-MEDIUM.

### Canonical #30 — "What-if" branching + variants
**Sources:** E2E-538, E2E-802 (arch what-if), E2E-834 (A/B side-by-side), E2E-932 (schematic A/B), E2E-837 (generative variants).
**Priority:** HIGH — workflow differentiator.

### Canonical #31 — Mood-board → architecture onboarding
**Sources:** E2E-838.
**Priority:** HIGH — magical onboarding for newcomers.

### Canonical #32 — Architecture-as-Code DSL split pane
**Sources:** E2E-815.
**Priority:** MEDIUM (power user).

### Canonical #33 — Schematic-to-code / schematic-to-LaTeX / schematic-to-narrative
**Sources:** E2E-931 (Arduino code), E2E-937 (TikZ LaTeX), E2E-930 (narrative).
**Priority:** MEDIUM.

### Canonical #34 — 3D extrude → enclosure size
**Sources:** E2E-840.
**Priority:** MEDIUM.

### Canonical #35 — Auto-tidy / schematic reflow
**Sources:** E2E-905, E2E-925.
**Priority:** Partly covered in 06 Wave 6; full auto-route reflows → here.

### Canonical #36 — Component personality tooltips / anthropomorphic helpers
**Sources:** E2E-666, E2E-741 (desk mascot).
**Priority:** LOW.

### Canonical #37 — Hardware "linter" GitHub Action
**Sources:** E2E-545.
**Priority:** See Canonical #21.

### Canonical #38 — Animated logic analyzer / oscilloscope
**Sources:** E2E-589, E2E-590 (Wokwi scenarios).
**Priority:** Unlocked by Canonical #2.

### Canonical #39 — Smart breadboard hardware
**Sources:** E2E-728, E2E-729 (OLED dongle), E2E-727 (robot-arm wiring).
**Priority:** LOW — hardware POC bet.

### Canonical #40 — Class mode for educators + per-project theme override
**Sources:** E2E-718, E2E-518.
**Priority:** MEDIUM — pairs with Canonical #25.

---

## Quarterly picks (Tier H packaging)

Top 5 for Q1 post-Tier A-G:
1. Canonical #2 — Wokwi-class live simulation (HIGHEST priority)
2. Canonical #4 — Hover-pin Vault tooltip (HIGH, low cost)
3. Canonical #1 — AR guided wiring (HIGH, PR magnet)
4. Canonical #14 — Real Arduino USB twin (HIGH)
5. Canonical #7 — AI critique persona (HIGH, retention)

Top 5 for Q2:
6. Canonical #6 — Multiplayer collaboration
7. Canonical #15 — Flux Copilot parity
8. Canonical #30 — What-if branching
9. Canonical #25 — Educator mode
10. Canonical #10 — Mistake catalog (full expansion past 07 Wave 6)

## Source coverage

All 🚀 + 🟢 STRATEGIC + 🟢 INNOVATION findings from passes 3 / 5 / 6 / 8 / 9 / 11 / 12 appear in exactly one canonical above. Before declaring this plan complete, run:

```bash
for id in $(grep -oE "E2E-(5[2-4][0-9]|66[0-9]|67[0-9]|70[9]|71[0-9]|72[0-9]|73[0-9]|74[0-2]|77[6-8]|80[9]|81[0-9]|83[2-9]|84[0-4]|87[0-3]|90[5-9]|91[0-4]|92[7-9]|93[0-9]|94[0-1])" docs/audits/2026-04-18-frontend-e2e-walkthrough.md | sort -u); do
  if ! grep -q "$id" docs/superpowers/plans/2026-04-18-e2e-walkthrough/18-innovation-roadmap.md; then
    echo "MISSING from 18: $id"
  fi
done
```

Any `MISSING` output means a strategic/innovation finding was dropped — route it into an existing canonical or create a new one.

## When each canonical graduates

A canonical item graduates from this brief to a real TDD plan (`docs/superpowers/plans/YYYY-MM-DD-<canonical-slug>.md`) when:
- Engineering capacity opens
- Tyler picks it (priority override always wins)
- Dependency unlock (e.g. Canonical #3, #8, #38 unlock when #2 ships)

Graduated items: none as of 2026-04-18.
