# Digital Twin Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Digital Twin work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Digital Twin behavior.

## Pending Proposals

- Add screenshots for the main Digital Twin states.
- Add more specific gotchas after the next real Digital Twin implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05-23 — Full Codex-Handoff Audit Pass (/pp-view-digital-twin)

**Fast Workflow Executed (strict contract order):**
1. `node .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs` → **Status: ok** (0 tracked tests at page-skill level, main source `DigitalTwinView.tsx` 625 lines).
2. Read references in exact order: `page-map.md` → `ux-contract.md` → `testing.md` → `gotchas.md`.
3. Quantitative + structural analysis:
   - scc: 553 code LOC / **87 CCN** (moderate; clean data-focused view).
   - Full read of `client/src/components/views/DigitalTwinView.tsx`: four-section layout (ConnectionBar, LiveValuesGrid with stale indicators, ComparisonTable with overallHealth, FirmwareDialog). Uses `useDeviceShadow`, `compareCircuit`/`overallHealth`, `TelemetryShadowBridge`, integrates with `useValidation` (BL-0577: out-of-spec telemetry creates validation issues).
   - Supporting lib: `client/src/lib/digital-twin/` (device-shadow, comparison-engine, firmware-templates, telemetry-logger, telemetry-protocol) — has its own test suite (`__tests__/*.test.ts`).
   - No 3D/Three.js rendering inside the view (despite "3D/Behavior Preview" pillar in UX contract).
   - Cross-referenced prior campaign (3D hybrid rescue, breadboard-lab, Component Editor exact-part safety, Dashboard health, Arduino firmware, provenance/trust).
4. Final inspector re-run (see below).

**Key Technical Findings vs. UX Contract (Virtual Hardware State / 3D/Behavior Preview / Sync Health / State Confidence):**

- **Strong Sync Health + State Confidence implementation (major strength):** The view excels at the "live vs sim" contract. `ChannelCard` explicitly shows `stale` indicators. `ComparisonTable` + `overallHealth` produces clear PASS/WARN/FAIL with deviation percentages. The comparison engine and device shadow provide the foundation for trustworthy "is my simulation matching reality?" feedback.

- **Virtual Hardware State is visible and actionable:** Live values grid + ability to `setDesired` values, connection status with Hz frame rate, manifest-driven channel names, firmware generation for the physical side. Ties directly into Arduino (firmware sketch generation) and validation (out-of-spec telemetry auto-creates issues).

- **"3D/Behavior Preview" pillar is a gap vs current contract (P1):** The UX contract explicitly requires "3D/Behavior Preview" to be "visible enough." The current implementation is purely data/table/grid focused. There is **no 3D rendering, no embedding of BoardViewer3DView, no behavioral visualization** of the twin state on a 3D board model. After the major "ALL IN ON 3D" hardening campaign (hybrid CSS + R3F airwires, net-aware computation, performance fixes), this view does not yet consume or drive the 3D surface for twin visualization.

- **No page-level tests recorded (notable gap):** The lib has good unit tests (comparison-engine, device-shadow, firmware, telemetry), but the skill auto-sync and page-map record **zero tests** for the view itself. The contract and gotchas emphasize that passing lib tests do not prove layout, scroll, stale-state rendering, or comparison table behavior.

- **Good integration hygiene:** Uses the Validation context to surface real hardware problems as first-class issues. TelemetryShadowBridge + logger for persistence. Clean separation via hooks (does not directly import WebSerialManager in the view).

- **Layout is simple and low-risk for scroll traps:** Vertical flex with overflow-y-auto, card-based sections. Still subject to the laptop viewport and "no nested cards" rules if future 3D or richer preview panels are added.

**P0 / P1 / P2 Backlog Items for Codex (added to master report):**

**P1 — Fulfill the "3D/Behavior Preview" pillar of the UX contract**
- Embed or deeply integrate the hardened BoardViewer3DView (or a focused behavioral overlay) so the twin's live channel state, desired vs reported, and comparison results can be visualized on the actual 3D board geometry (component highlights, airwire coloring by deviation, real-time pin state on 3D model).
- This is the natural next step after the 3D rescue — the Digital Twin is the perfect consumer of the production-grade 3D surface for "sim vs reality" visualization.

**P1 — Add page-level tests + visual verification for the view**
- Record test globs in the skill (at minimum for the four sections, stale rendering, comparison table states, connection flow).
- Add integration tests that exercise the full shadow + comparison + validation-issue creation path.
- Browser checklist must be run for any addition of 3D preview or richer state visualization (laptop height, scrolling with live updates, focus on live values vs comparison).

**P2 — Elevate "Next Action" guidance from health data**
- When comparison shows FAIL/WARN or stale channels, surface clear recommended actions in the UI ("Re-run simulation", "Check wiring on breadboard", "Re-verify exact part in Component Editor", "Regenerate firmware for updated pin map").
- Link directly into the Dashboard's future "Recommended next actions" surface.

**P2 — Round-trip with Breadboard + Component Editor**
- When a channel is out of spec or comparison fails, provide one-click paths to open the relevant breadboard placement or the exact part in Component Editor (with provenance context).

**Strengths (relative to peers):**
- Excellent, focused implementation of the core digital twin value proposition (live shadow + trustworthy sim-vs-actual comparison + firmware round-trip).
- Strong "State Confidence" UX (explicit stale flags, deviation %, overall health badge).
- Proper use of existing system primitives (Validation context, telemetry bridge, firmware templates).
- Clean architecture (view is thin; heavy logic lives in testable lib modules).

**Cross-Cutting Value (very high after 3D campaign):**
- This is the **live synchronization and confidence layer** that makes the 3D View, breadboard, and component work "real" with physical hardware.
- It is the missing bridge that turns the static 3D hardened viewer into a true digital twin experience (real-time behavior preview driven by actual device state).
- Natural home for future "physical vs simulated" coaching that feeds the breadboard-lab coach and the 3D airwire system.

**Durable Lesson:**
A polished data/comparison view that fully delivers "Sync Health" and "State Confidence" but leaves the "3D/Behavior Preview" pillar of its own UX contract unimplemented is a classic symptom of parallel feature tracks (the 3D rescue and the digital-twin telemetry work) not yet being joined. The contract was written with the vision of a unified twin; the implementation delivered the trustworthy data layer first. Closing the 3D integration is now the highest-leverage step to make the entire system feel like one coherent digital twin.

**Recommended for Codex (immediate high-ROI tasks after handoff):**
1. Design and implement the 3D/Behavior Preview section — embed or compose the hardened BoardViewer3DView (or a focused behavioral mode) driven by the current DeviceShadow state (highlight components by channel value, color airwires or connections by comparison status, show real-time pin states on the 3D model).
2. Add page-level test coverage and record the globs in the skill (start with the comparison table states, stale rendering, and connection flows).
3. When comparison health is not PASS, surface clear, one-click next actions that link into Breadboard, Component Editor (for re-verification), and 3D View.
4. Ensure any 3D preview panel respects the UI Container Rule (proper scrolling, no fixed-height traps when live data updates, laptop viewport).
5. Consider surfacing Digital Twin health (overall comparison status, stale channel count) into the Dashboard's future Project Health / Recommended Actions surface.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run.
- Full self-improvement-log entry written with scc numbers (87 CCN), file paths, lib test discovery, explicit gap vs the "3D/Behavior Preview" contract pillar, and cross-references to the 3D hardening + breadboard + Component Editor campaigns.
- No production code mutated during this discovery-only pass.
- All findings tied directly to the 3D rescue, breadboard-lab provenance, Component Editor safety, Dashboard health, Arduino firmware, and UI Container Rule work from the same handoff audit.

---

*Digital Twin analysis complete. This is the trustworthy live-sync and confidence layer that makes the 3D + breadboard + component authoring work "real" with hardware. The 3D/Behavior Preview integration is the clear next step to fulfill the view's own contract. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Digital Twin section (2026-05-23).*

## 2026-05-24 — R18 Digital Twin -> 3D Bridge Slice

- Added the first dedicated page-level Digital Twin test handle: `client/src/components/views/__tests__/DigitalTwinView.test.tsx`.
- Digital Twin now has a 3D behavior preview section that derives live/stale channel counts, manifest pin count, comparison-backed net count, state confidence, and health state from the current shadow.
- The "Open in 3D" action publishes a generic `sourceView: 'digital-twin'` target into the shared 3D bridge rather than creating a separate telemetry bus.
- Fix links route directly to Breadboard and Component Editor; keep them visible near health/confidence state so warning/stale telemetry has an obvious next step.

Durable lesson: Digital Twin 3D previews should carry confidence labels with the handoff. A live visualization without `live`, `stale`, `manifest-only`, or `unconfigured` state is too easy to over-trust.

## 2026-05-24 — R22 Digital Twin Bridge Coverage Hardening

- Restored practical page-level regression coverage after the bridge-focused test rewrite narrowed the file too far.
- `DigitalTwinView.test.tsx` now covers connection/header state, empty telemetry state, boolean desired-value toggles, firmware dialog open/edit/generate/remove/close, validation issue creation from out-of-bounds telemetry, 3D preview rendering, and 3D bridge/fix-link behavior.
- Keep future Digital Twin bridge work from replacing core view tests with only the new feature tests; the telemetry/firmware/validation basics are part of the view contract.

Durable lesson: Digital Twin's 3D bridge is only trustworthy if the underlying live-state surface stays covered. Do not trade away connection, firmware, and validation regression checks while adding richer preview tests.

## 2026-05-25 — R27 3D Viewer Live-State Overlay

- `BoardViewer3DView` now consumes Digital Twin bridge payloads as a viewport overlay, not only as a provenance card.
- The overlay shows live/total channels, pins, nets, state confidence, health, and behavior-preview model kind directly in the 3D work surface.
- The 3D bridge card now includes direct navigation back to Digital Twin, Breadboard, and Component Editor so stale or incomplete telemetry has an obvious repair path.

Durable lesson: Keep Digital Twin's page preview and the 3D viewer overlay in sync conceptually. The page preview is the source-side summary; the 3D overlay is the inspection-side summary.

## 2026-05-25 — R33 Digital Twin Preview Container Hardening

- The Digital Twin 3D behavior preview now carries explicit `data-resizable` and `data-collapsed` state.
- The preview body is internally bounded and scrollable/resizable instead of acting as a fixed-height card.
- The preview can collapse without losing the confidence/health header, giving laptop-height users a way to recover workspace while keeping Digital Twin state visible.

Durable lesson: Digital Twin preview work must satisfy the UI Container Rule at the same time as the telemetry/3D bridge contract. A live preview that cannot collapse or resize will become a scroll trap as soon as channel count grows.

## 2026-05-25 — R37 Digital Twin Next Actions

- The 3D behavior preview now surfaces compact next-action buttons derived from the preview summary.
- Unconfigured or manifest-only state points to firmware manifest generation.
- Stale telemetry points to Breadboard review; warning/failing comparison points to 3D inspection and Component Editor verification.
- The actions live inside the existing resizable/collapsible preview container, avoiding another fixed panel.

Durable lesson: Digital Twin confidence is only useful if it offers a recovery path at the moment uncertainty is shown. Keep next actions close to state confidence, but do not turn the preview into another stacked sidebar.
