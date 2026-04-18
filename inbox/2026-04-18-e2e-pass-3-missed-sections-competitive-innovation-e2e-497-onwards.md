---
name: E2E walkthrough — PASS 3 — Missed sections + competitive innovation (E2E-497 onwards)
description: Frontend E2E findings for 'PASS 3 — Missed sections + competitive innovation (E2E-497 onwards)' chunk from 2026-04-18 walkthrough. 78 E2E IDs; 8 🔴, 9 🟡, 37 🟢, 1 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 8
  ux: 9
  idea: 37
  works: 1
  e2e_ids: 78
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 3 — Missed sections + competitive innovation (E2E-497 onwards)

Pass 3 covers areas missed in passes 1-2 (Projects list, Settings 404, sidebar groups, AI chat panel, hover-peek docks) PLUS injects competitive inspiration from Flux.ai, Wokwi, KiCad 9, and modern web-EDA platforms.

### Missed: Project list (`/projects`)

Screenshot: `33-projects-list.png`

The list page renders Sample Projects (5 cards: Blink LED, Temperature Logger, Motor Controller, Audio Amplifier, IoT Weather Station) + filter pills (All / Beginner / Intermediate / Advanced) + filter taxonomy (Recent / Sample / Learning / Beginner / Experimental / Archived) + project grid with ~25 user-created projects (many "E2E Test Project" cards from earlier testing).

- **E2E-497 ✅ visual** — Sample project cards include cost estimate, time estimate, parts count, and learning topics (e.g. "10 min / $23.45 / 3 parts / Architecture Design / BOM Management / Validation"). Excellent at-a-glance metadata.
- **E2E-498 🟡 visual** — Project grid is dense — 25+ active projects no obvious sort/group. Add "Recent activity" sort + "Group by status" toggle.
- **E2E-499 🔴 UX** — Lots of "E2E Test Project" duplicates from my testing — no way to filter or bulk-delete. Add multi-select + "Delete N selected".
- **E2E-500 🟢 IDEA** — Sample projects don't show a "remix / fork" CTA. Should let user clone any sample as starting point (cf. CodePen pattern).
- **E2E-501 🟢 IDEA** — Add project templates by industry: IoT / Robotics / Audio / Motor control / Power supply / Sensor logger. Pre-populate matching architecture + BOM.

### Missed: Settings page (BUG)

Screenshot: `34-settings.png`

- **E2E-502 🔴 P0 BUG** — `/settings` returns **404 Page Not Found**. The Settings gear icon at bottom of left sidebar is presumably the entry point but the route doesn't exist. Either route is wrong or page never built.
- **E2E-503 🟡 UX** — 404 page has "Return to Dashboard" button but it goes to **`/projects`** (project list), not a dashboard. Misleading button copy.
- **E2E-504 🟢 IDEA** — Settings should include: profile / account / API keys (Gemini, Anthropic, OpenAI) / theme (light/dark/auto) / hotkey customization / notification preferences / data export (GDPR) / delete account.

### Missed: Sidebar (left icon strip)

The 21-icon sidebar groups visible in DOM: design / analysis / hardware / manufacturing / ai_code / documentation. But UI shows them as tight icon column with no visible group labels.

- **E2E-505 🔴 visual** — Sidebar groups (design / analysis / hardware / etc.) exist in DOM but **no visible group separators or labels**. Beginners can't see structure. Add expandable group headers (cf. VS Code Activity Bar).
- **E2E-506 🟡 UX** — Sidebar icons are 21 — equal weight. The most-used (Architecture, Schematic, PCB) deserve top-pinning + larger size.
- **E2E-507 🟢 IDEA** — Add user-customizable pin/unpin per icon. Power users can hide tabs they never use.

### Missed: AI Assistant chat panel (deeper)

Right-side chat panel (`AI Assistant` vertical strip when collapsed → full chat panel when expanded).

- **E2E-508 🔴 visual** — When collapsed, AI Assistant is a 24px vertical strip with rotated text — most users will never discover it. Add a floating chat-bubble icon at bottom-right (industry standard cf. Intercom, Crisp).
- **E2E-509 🟡 UX** — Chat panel has 7 quick-action buttons (Generate Architecture / Optimize BOM / Run Validation / Add MCU Node / Project Summary / Show Help / Export BOM CSV) — but these aren't context-aware. Same buttons on every tab. Should change based on tab (e.g. on Schematic show "Auto-route", on PCB show "Auto-place").
- **E2E-510 🟢 IDEA** — Add multi-modal: drag-drop a datasheet PDF → AI extracts pins + creates component. Drag a hand-drawn circuit photo → AI digitizes to schematic. (Flux Copilot does this.)
- **E2E-511 🟢 IDEA** — Voice input button visible but untested. Industry standard is push-to-talk. Add waveform visualizer during recording.
- **E2E-512 🟡 UX** — "Local • —" status footer is opaque. What does "Local" mean? Local model? Local cache? Add tooltip.

### Missed: Welcome dialog / Mode picker

The first-visit welcome overlay has Student / Hobbyist / Pro presets but my testing didn't visually verify what each mode actually changes.

- **E2E-513 🔴 visual UNVERIFIED** — Workspace Mode (Student / Hobbyist / Pro) — no visible UI difference observed across modes. If mode is supposed to hide tabs / labels / advanced features, the implementation isn't visible. Either deliver the difference or remove the picker.
- **E2E-514 🟢 IDEA** — Add one more mode: "Educator" — exports student worksheets, includes grading rubrics, no AI by default to encourage learning.

### Missed: Hover-peek docks

Discovered in testid scan: `hover-peek-dock-left`, `hover-peek-panel-left`, `hover-peek-hotspot-left`, `hover-peek-dock-right`, `hover-peek-panel-right`. These appear to be hover-reveal sidebars for collapsed Sidebar + AI panel.

- **E2E-515 🟡 visual** — Hover-peek pattern is clever but undocumented in UI. First-time users won't discover. Add a subtle handle on the edge with `<` / `>` chevron.
- **E2E-516 🟢 IDEA** — Hover-peek delay should be configurable (some users want instant, others want 500ms grace).

### Missed: Theme toggle

`theme-toggle` button at top right ("Switch to light mode"). Untested. Cyberpunk dark theme is the default.

- **E2E-517 🟡 UX** — Theme toggle is icon-only sun/moon. No "Auto (system)" option visible — modern apps offer 3 modes (Light / Dark / Auto).
- **E2E-518 🟢 IDEA** — Save theme as project preference (some Pro EDA users want dark for schematics, light for docs).
- **E2E-519 🟢 IDEA** — Add "Print mode" preset — high contrast, white background, optimized for paper export.

### Missed: Mobile bottom nav

`mobile-bottom-nav` testid found in DOM with 5 buttons (Dashboard / Architecture / Component Editor / Procurement / More). Only visible on narrow viewport.

- **E2E-520 🔴 UX** — Mobile bottom nav has only 5 items — but the desktop has 35 tabs. Mobile users get a tiny subset; rest are inaccessible.
- **E2E-521 🟢 IDEA** — Mobile-first patterns: swipe between tabs, FAB for AI chat, drawer-based navigation. Untested.

### Pass 3 — Competitive innovation findings (E2E-522+)

Inspired by Flux.ai, Wokwi, KiCad 9, Altium 365, Cadence Allegro X.

- **E2E-522 🟢 STRATEGIC** — **Real-time multiplayer collaboration** (Flux's killer feature). Need true CRDT-based co-editing with live cursors, comments tied to design objects, presence indicators on canvas. ProtoPulse has "1 collaborator online" badge but no co-editing visible.
- **E2E-523 🟢 STRATEGIC** — **AI auto-routing that needs less cleanup** (Flux 2026 update). Current ProtoPulse has A* autorouter (BL-0081); compare quality + add "explain this trace" AI overlay.
- **E2E-524 🟢 STRATEGIC** — **Sourcing-aware design** (Flux 2026): show real-time pricing + stock + lifecycle on every BOM item INLINE in the schematic / component editor. Current ProtoPulse: Live Pricing is its own sub-tab. Surface inline.
- **E2E-525 🟢 STRATEGIC** — **Read-the-datasheet AI** (Flux Copilot): drag a PDF datasheet → AI extracts pin map + electrical specs + BOM-ready manufacturer/MPN. ProtoPulse Component Editor has "Datasheet" button but unverified depth.
- **E2E-526 🟢 STRATEGIC** — **VS Code integration** (Wokwi pattern): publish a `protopulse` VS Code extension so users can edit firmware in their preferred IDE while ProtoPulse handles schematic/PCB.
- **E2E-527 🟢 STRATEGIC** — **MQTT/HTTP/WiFi simulation built-in** (Wokwi). For IoT projects, simulate the whole network — virtual MQTT broker, mock cloud responses. ProtoPulse has Digital Twin tab but unverified depth.
- **E2E-528 🟢 STRATEGIC** — **Component Classes** (KiCad 9): tag components by class (Critical / Decoupling / High-speed / Mounting) and apply class-wide DRC rules. ProtoPulse has component metadata but no class-based rule sets.
- **E2E-529 🟢 STRATEGIC** — **Jobsets** (KiCad 9): one-click multi-format export pipelines ("On release: generate Gerbers + BOM CSV + Pick&Place + 3D STEP + Schematic PDF"). ProtoPulse Exports has 17 formats but no orchestrated bundles beyond Quick Profiles.
- **E2E-530 🟢 STRATEGIC** — **Selection Filter** (KiCad 9): on dense schematics, filter what's selectable by type (only nets, only labels, only components). ProtoPulse Schematic select tool has no filter.
- **E2E-531 🟢 STRATEGIC** — **Design Blocks** (KiCad 9): saveable schematic fragments to drag-place in new circuits. ProtoPulse has Patterns + My Snippets but no in-canvas-paste workflow verified.
- **E2E-532 🟢 STRATEGIC** — **True 1:1 scale rendering** (Flux 2026): viewer setting where on-screen mm = real mm with zoom-to-fit. Helps physical-sense-checking. ProtoPulse 3D View has dimensions but no 1:1 scale toggle.
- **E2E-533 🟢 STRATEGIC** — **Eagle/PADS import** (Flux 2026): ProtoPulse should import all major EDA formats. Current Import button untested across formats.
- **E2E-534 🟢 STRATEGIC** — **Self-correcting AI agent**: when user accepts an AI suggestion, AI can re-analyze impact and propose follow-up corrections. ProtoPulse has prediction-engine but no chained correction loop visible.
- **E2E-535 🟢 INNOVATION** — **Sound Effects (optional, opt-in)**: a satisfying audio cue when DRC passes, a low buzz when a wire fails, a click when components snap. (Linear / Asana have started this.)
- **E2E-536 🟢 INNOVATION** — **Haptic feedback on touch devices**: vibrate when snapping to grid / dropping a component. Untested for tablet UX.
- **E2E-537 🟢 INNOVATION** — **Time-travel debugger for circuits**: scrub a slider to see how DC operating point changes as you change a resistor value. Live derivative view.
- **E2E-538 🟢 INNOVATION** — **"What if" branching**: from any design state, fork "What if I use ESP32-C3 instead of ESP32-S3?" — instant comparison panel showing pin map differences, cost delta, power delta.
- **E2E-539 🟢 INNOVATION** — **Print-to-paper guide**: for makers, print-out of breadboard layout at 1:1 scale that you tape to your physical breadboard for component placement reference.
- **E2E-540 🟢 INNOVATION** — **Hardware diff viewer**: drag in two snapshots → see visual diff (added components highlighted green, removed red, modified yellow). Like a Git diff for circuits.
- **E2E-541 🟢 INNOVATION** — **Voice "What's wrong with my circuit?"** — open mic, describe symptoms verbally, AI listens + analyzes against architecture + simulation results.
- **E2E-542 🟢 INNOVATION** — **AR mode**: open project on phone, point camera at physical breadboard → AR overlays show next wire to place per the schematic. Wokwi has nothing like this; would be the killer feature.
- **E2E-543 🟢 INNOVATION** — **Embedded video tutorial player per tab**: Coach button could open a 30-90s loom-style screen recording showing "How to use the PCB tab" specifically.
- **E2E-544 🟢 INNOVATION** — **AI-explained components**: hover any component on canvas → AI generates plain-English explanation of role + pin functions + common mistakes. Per-component tooltip from Vault.
- **E2E-545 🟢 INNOVATION** — **Hardware "linter"** at GitHub PR level: integrate with GitHub Actions so PRs touching `.protopulse` files get auto-DRC + cost diff + lifecycle warnings posted as PR comment.

### Pass 3 — Build/expand on existing themes

- **E2E-546 (expands E2E-298 audit-trail leak)** — Build a project-scoped middleware: every list endpoint MUST take `projectId` filter. Add a server test that asserts no entity from other projects appears in the response.
- **E2E-547 (expands E2E-485 confidence contradictions)** — Single confidence-evaluator service that emits structured signals; UI labels derive from one schema. No more competing strings.
- **E2E-548 (expands E2E-093 dashboard-vs-validation)** — Validation summary = Dashboard's Issues counter. They must consume the same selector / hook.
- **E2E-549 (expands E2E-484 tab strip)** — Implement collapsible activity-bar nav (VS Code-style) with optional "Tab strip" mode for legacy users. Add power-user `Ctrl+P` quick-tab-switcher.
- **E2E-550 (expands E2E-074 Coach popover dead)** — Once fixed, design the TutorialMenu as a tracked-progress checklist of all major workflows: "1/12 — Place your first component", "2/12 — Run validation", etc. Gamify completion.
- **E2E-551 (expands E2E-091 128 false-positives)** — DRC engine should emit findings with `requiresPlacedComponents: boolean` flag so empty-design suppresses irrelevant rules.
- **E2E-552 (expands E2E-261 cards lack role=button)** — Add ESLint rule `jsx-a11y/no-static-element-interactions` and fix at codebase scale.
- **E2E-553 (expands E2E-228 board source-of-truth split)** — Single `useProjectBoard()` hook reads from server; PCB / 3D / Order all consume it. Server side: one `boards` table, one selector.
- **E2E-554 (expands E2E-074b keyboard activation)** — Add a keyboard navigation test suite (Playwright + tab order + Enter/Space activation per interactive element). Add to CI.
- **E2E-555 (expands E2E-205 favorite without state indicator)** — Use Lucide's `Star` (filled when favorited) + `StarOff` (outline when not). Universal pattern.

### Pass 3 — Workflow critiques (newbie → expert journey)

- **E2E-556 🔴 newbie journey** — A first-time user lands at `/projects` and sees "Select a project to continue." There's no "Take a tour" button. They have to click a Sample to start. Add an above-the-fold "New here? Watch 2 min intro" video.
- **E2E-557 🟡 newbie journey** — Sample project "Blink LED" loads with already-populated 1-component architecture (BME280 actually visible). But that's a SENSOR, not an LED — wrong starter content. Sample data is broken/seeded incorrectly.
- **E2E-558 🔴 newbie → first PCB journey** — From empty project to ordering a PCB requires: Architecture → add nodes → Schematic → push to PCB → place components → route traces → DRC → Order PCB → 5-step wizard. **No guided wizard for "Build my first PCB end to end"** — should be the killer first-week experience.
- **E2E-559 🟡 expert journey** — Power user wants keyboard-first navigation. Keyboard shortcuts dialog (E2E-221) is per-tab; need global Ctrl+P palette + Ctrl+Shift+P command palette + tab-cycling Ctrl+Tab.
- **E2E-560 🟢 expert journey** — Power user wants Git integration: "save current project as commit message" → push to a tracked repo. Untested but huge for serious teams.
- **E2E-561 🟢 expert journey** — Power user wants programmatic API access (REST + WebSocket) for CI integration. Untested.

Sources: [Flux.ai 2026 features](https://www.flux.ai/p/blog/we-raised-37m-to-take-the-hard-out-of-hardware), [Flux Copilot AI](https://www.flux.ai/p/blog/flux-copilot-under-the-hood), [Wokwi simulator](https://wokwi.com/), [KiCad 9 features](https://www.elektormagazine.com/articles/kicad-9-new-updated-features), [Quilter vs Flux 2026](https://www.quilter.ai/blog/the-2026-guide-to-autonomous-pcb-design-quilter-vs-deeppcb-vs-flux-ai)

---

