# Serial Monitor Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Serial Monitor work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Serial Monitor behavior.

## Pending Proposals

- Add screenshots for the main Serial Monitor states.
- Add more specific gotchas after the next real Serial Monitor implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

## Fast Workflow Execution Report — 2026-05-23 (pp-view-serial-monitor Audit)

**User Command:** `/pp-view-serial-monitor`

**Inspector (entry + final exit):**
- Status: **ok** both times.
- Tracked tests: **0** (none recorded)
- Primary source: `client/src/components/panels/SerialMonitorPanel.tsx` (1400 lines / 1251 code / **207 CCN** — dense Tier 2 hardware feedback panel)
- References all present and valid. Re-run after discovery remained clean.

**Exact Fast Workflow Sequence Followed (non-negotiable contract):**
1. `node .agents/skills/pp-view-serial-monitor/scripts/inspect-serial-monitor.mjs` → ok
2. Read `references/page-map.md` (25 lines)
3. Read `references/ux-contract.md` (24 lines) — before any connection/logs/layout synthesis
4. Read `references/testing.md` (27 lines)
5. Read `references/gotchas.md` (17 lines) — before any sync/persistence/trust analysis
6. Read `SKILL.md` (Tier 2, single 1400-line file, zero tests)
7. Deep source inspection (full 1400-line SerialMonitorPanel) + ast-grep for trust/provenance patterns + scc metrics + targeted reads of connection, trust receipt, preflight, device feedback, log rendering, send controls
8. Cross-campaign synthesis vs. Arduino context, web-serial, trust-receipts, digital twin (DeviceShadow), hardware co-debug, ESP decoder, baud detection, telemetry, command sandbox, breadboard/Arduino views, provenance campaign
9. Durable appends to this log + master report (section 34)
10. Final inspector re-run (ok)

**Quantitative Snapshot (scc):**
- Single file: 1251 code LOC / **207 CCN**
- Notable density for a Tier 2 panel (comparable to some Tier 1 coordinators). Heavy on state management, Web Serial integration, multiple decoders/parsers (ESP exceptions, baud mismatch, telemetry), trust receipt building, recording, presets, sandbox, and rich UI for logs + controls.

**Source Ownership:**
- Sole file: `SerialMonitorPanel.tsx` (per page-map and auto-sync)
- Depends on: `@/lib/web-serial` (useWebSerial, types), `@/lib/trust-receipts` (buildSerialTrustReceipt), `@/lib/arduino/*` (serial-logger, telemetry-parser, esp-exception-decoder, baud-detector, hardware-co-debug, serial-device-preflight, serial-troubleshooter), `@/lib/digital-twin/device-shadow`, Arduino context, DeviceCommandSandbox component.
- Used in workspace as a dockable panel (likely Arduino view or global serial dock).

**Deep Analysis vs. UX Contract (Serial Connection / Logs / Send Controls / Device Feedback):**

- **Serial Connection & Device Feedback (strongest area of this surface — notable positive for the provenance campaign):**
  - Full Web Serial API integration via `useWebSerial` (connect/disconnect, baud selection from COMMON_BAUD_RATES, board filters via KNOWN_BOARD_FILTERS, port info).
  - **Genuine trust integration**: `buildSerialTrustReceipt` is called with connectionState, portInfo, bytes stats, preflight result, error, isSupported, selected profile. The receipt is rendered via `<TrustReceiptCard receipt={serialTrustReceipt} />`.
  - Preflight assessment (`assessSerialDevicePreflight`) covers browser support, board filter match, port info.
  - Rich device intelligence: ESP exception decoder (`detectEspException`, `parseEspException`), baud mismatch detector (`detectBaudMismatch`, auto-suggest + switch), non-printable ratio, telemetry parser (`TelemetryStore`, `parseLine`), DeviceShadow (digital twin), `buildHardwareCoDebugReadiness`.
  - `DeviceCommandSandbox` for safe command experimentation.
  - This is one of the **better-integrated hardware feedback surfaces** in the entire audit for closing the loop on serial device identity and basic trust boundary.

- **Logs (core value, UI Container risk):**
  - High-volume serial log rendering with timestamps, filtering, search, recording (with duration/size formatting), export, clear, pause.
  - Uses `ScrollArea` (good for reachability). However, with 1251 code in one file and many features layered on the log view, fixed-height containers or nested scroll risks exist (classic gotcha for log panels). Laptop viewports with long logs + controls + trust receipt + decoders can easily create unreachable content or cramped send input.

- **Send Controls (feature-rich):**
  - Input with line ending selection (CRLF/LF/CR/None), send button, presets (load/save last-used), recording toggle, history?
  - Integrated with the sandbox and command safety features.
  - Clear labels and icons present (per imports: Send, RotateCcw, etc.).

- **Provenance / Trust Story (partial but real win):**
  - Unlike Schematic, PCB placer, Procurement, Right Sidebar (chat), and several others that had **zero** matches, this panel actively builds and displays a `SerialTrustReceipt` based on live connection facts and preflight.
  - However, the receipt appears focused on *serial transport* trust (browser support, port, baud confidence, bytes, errors) rather than linking the *firmware/sketch* provenance (e.g., was the sketch on the connected board built from a verified Component Editor design, Generative adoption with review, exact-part, 3D mechanical validation, breadboard health?). Higher-level project context linkage may be thin.

- **Layout / Density / UI Container Rule (Tier 2 but dense):**
  - 207 CCN in one file + many sub-features (connection bar, log area, send bar, trust receipt, baud warning, ESP decoder output, telemetry, sandbox, recording stats, presets) creates exactly the "piling up" and scroll trap risks called out in gotchas and the global UI Container Rule.
  - Must be validated on laptop heights with active high-volume serial traffic + all feedback panels open.

- **Tests (structural gap):**
  - 0 tracked tests (consistent with the skill's page-map and auto-sync).
  - Browser checks (load, reachability of connection controls + log scroll + send input, no overflow, keyboard) are the current contract per testing.md.

**Cross-References to Prior Campaign Work:**
- Arduino / breadboard-lab views (this is the live serial feedback companion to the bench).
- Trust receipts / provenance campaign (one of the few surfaces that actually renders `TrustReceiptCard` for hardware I/O; compare to zero in Schematic/PCB placer/Procurement/Right Sidebar).
- Digital twin (DeviceShadow) and hardware co-debug readiness.
- Web Serial + ESP/Arduino tooling (exception decoder, baud auto-detect, telemetry) — strong device intelligence.
- Workspace panel system (dockable, similar to ActivityFeed, Chat, ExportPrecheck, etc.).
- UI Container Rule enforcement on log-heavy panels (same class of risk as dense chat logs or activity feeds).

**P0 / P1 / P2 Backlog Items for Codex:**

**P1 — Strengthen the serial trust receipt to include upstream firmware/sketch provenance**
- When a device is connected, the `SerialTrustReceipt` (and the UI around it) should ideally surface or link to whether the running sketch came from a verified/exact-part/generative-reviewed design in the current project (or at least note "firmware provenance unknown").
- This would close a meaningful part of the hardware feedback loop.

**P1 — Enforce UI Container Rule on the log area + all feedback sections on laptop viewports**
- With 207 CCN of features, the log must remain fully scrollable/reachable, send input must never be trapped, trust receipt and decoder panels must be collapsible or properly sized when the viewport is constrained. Validate with real high-volume serial traffic.

**P2 — Add at least smoke + interaction tests for the core flows** (connect/disconnect with preflight, trust receipt computation, baud mismatch detection + switch, ESP exception decode, send with different line endings, recording start/stop/export, preset save/load).
- A 1251-line hardware feedback panel with zero tests is a real gap for a surface used during every Arduino/breadboard debug session.

**P2 — Consider extraction of sub-components** (connection bar, log viewer with virtualized/high-volume handling, send bar + presets, trust + decoder feedback cards) to reduce the god-panel risk in this single file.

**Strengths (relative to peers):**
- One of the **strongest hardware trust/provenance integrations** seen in the audit so far — actively builds and renders a `TrustReceiptCard` for serial connections using preflight, port info, and live stats.
- Extremely rich device feedback: ESP exception decoder, baud auto-detection, telemetry parsing, digital twin shadow, command sandbox, hardware co-debug readiness.
- Feature-complete serial monitor (connection, logs, send, recording, presets, troubleshooting hints) with good attention to real-world Arduino/ESP pain points.
- Uses `TrustReceiptCard` component consistently with the rest of the provenance UI language.

**Durable Lessons for Future Agents:**
- Serial Monitor is a high-leverage place to close the "device feedback" part of the safety story. The fact that it already builds `buildSerialTrustReceipt` and renders the card is a model other hardware I/O surfaces should follow.
- A 1400-line / 207 CCN single-file panel is the classic "works great until it doesn't" pattern — extraction + tests become urgent once real usage volume hits (high-speed logging, many decoders active).
- Zero tests on a panel that is the primary live window into a physical device during debug is a notable gap for a Tier 2 but frequently used surface.

**Evidence & Contract Artifacts:**
- Inspector clean on entry and final re-run (both "ok", 0 tests).
- ast-grep + targeted reads confirmed real `buildSerialTrustReceipt` + `TrustReceiptCard` usage, preflight, DeviceShadow, co-debug, ESP/baud/telemetry intelligence.
- Full scc report (1251 code / 207 CCN) captured.
- Sequential reads of all four references + SKILL.md before synthesis.
- No production code mutated (pure discovery pass).
- All findings cross-referenced to the Arduino/breadboard context, trust-receipts + digital twin work, hardware co-debug, the broader provenance campaign (where this surface is a relative bright spot), and UI Container Rule patterns from denser panels (Chat, Activity Feed, Schematic, PCB).
- Detailed Fast Workflow Execution Report appended here; master report section 34 written.

---

*Serial Monitor analysis complete. This is a dense 1400-line / 207 CCN Tier 2 panel that stands out positively in the provenance campaign for actively building and rendering a `SerialTrustReceipt` (with preflight, port info, baud confidence, etc.) and rich device feedback (ESP decoder, baud auto-detect, telemetry, DeviceShadow, command sandbox). The serial connection / logs / send / device feedback pillars are well-served functionally. The main risks are single-file density, zero tests, and UI Container reachability for the log + feedback sections on laptop viewports under real traffic. Inspector remained clean. Ready for the next `/pp-view-xxx` or explicit Codex continuation.*

---

*End of appended Serial Monitor section (2026-05-23).*

## 2026-05-25 — Keyboard-Nav Accessible Switch Names

- `e2e/p1-keyboard-nav.spec.ts` caught four Serial Monitor switches with empty accessible names: DTR, RTS, auto-scroll, and timestamps.
- The visible labels were not enough for the switch button role in the browser accessibility tree, so each switch now carries an explicit `aria-label`.

Durable lesson: For Radix switch-style controls, keep a direct accessible name on the focusable switch itself even when a nearby visible label exists.
