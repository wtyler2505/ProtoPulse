# Planned Work Snapshot — 2026-06-12

Point-in-time inventory of everything still planned/open. Canonical homes:
ROADMAP.md (build order/status), docs/MASTER_BACKLOG.md (BL items),
docs/plans/ (epics). This file is a snapshot, not a source of truth.

## A. Engine roadmap (open items only)
- v0.5 The Bridge 🔨: WebSerial/WebUSB flashing (BLOCKED: needs real hardware);
  ESP32-S3 long tail — ROM functions, RTC/eFuse/SYSTEM stubs, dual core,
  remaining peripherals (core itself SHIPPED: full Xtensa LX7 interpreter,
  windowed ABI, L1 interrupts, interrupt matrix, SAR ADC1, TIMG0, .bin loader)
- v0.6 The World 🔨: community library registry (PRODUCT DECISION);
  manufacturing pipeline / fab ordering APIs (PRODUCT DECISION + accounts)
- v0.7 The Probe ⬜: open-hardware companion (BLOCKED: hardware)
- Migration milestone ⬜ (between v0.6/v0.7): default-UI flip + legacy
  read-only grace; area-by-area retirement with ADRs; importer shipped,
  needs Tyler's real DB for criterion 2
- M1 straggler: pcbnew import manual verify once (tools/golden/README.md)

## B. Active plans / epics
- Tauri v2 desktop migration — Phase 1 of 12 active
  (docs/plans/2026-05-10-tauri-v2-desktop-migration.md); no Tauri-aware
  skill/agent/hook exists yet (gap)
- Breadboard Lab deep audit — Wave 1 = 14/18 done (2026-04-18); resume at
  Task 1.12 Canvas extraction; ~385 findings remain
  (docs/audits/2026-04-17-breadboard-lab-deep-audit.md)
- 3D viewer photoreal (BL-0887) — Phase 1 scaffold UNCOMMITTED in worktree
  .claude/worktrees/3d-viewer; webgl-viewer.ts (1298 lines) is dead code
- Widget system — research/architecture COMPLETE; awaiting Tyler green light
  (build order: core→tiles→floating→no-code→embed→plugins)

## C. Backlog
- docs/MASTER_BACKLOG.md: 508/508 DONE (Wave 153, 2026-06-11). Zero open.
  Future C5 epics live as closed-scope ideas: Arduino sim in browser
  (BL-0635), hardware debugger (BL-0632), ESP-IDF support (BL-0633),
  RBAC/tenancy (BL-0381), public API/webhooks (BL-0370), plugin SDK
  (BL-0371), multi-board orchestrator (BL-0454), etc.

## D. Audits
- Skill audit 2026-06-11 — EXECUTED (all 4 waves, 28a49c04)
- Slash-command audit 2026-06-12 — EXECUTED (project+global+pp lanes;
  pp lane by Codex ea5e9921; .agents twins regenerated eeba8cd0)
- Breadboard audit — see B

## E. Infra / ops / security
- API KEY ROTATION PENDING (Tyler): GEMINI_API_KEY, NANOBANANA_GEMINI_API_KEY,
  CONTEXT7_API_KEY, DATABASE_URL password, API_KEY_ENCRYPTION_KEY (values
  remain in remote git history; .env untracked 20cad8f6)
- initref session-start hook: script installed, settings.json registration
  awaits Tyler approval (jq snippet in session log)
- Legacy main CI: tauri-build.yml missing tauri:prepare-sidecars, ~9.7k lint
  errors, flaky env-dependent tests (failing since ≥2026-05-12)
- Root-dir collab artifacts (CODEX_*/CLAUDE_RESPONSE_*) → docs/collab/ cleanup
- gitsafe-backup remote dead (host unresolvable) — revive or remove

## F. Product decisions awaiting Tyler
1. Community library registry (where/who/moderation)
2. Fab ordering integration (which fabs, accounts, scope)
3. Widget system build green light
4. Platform breadth: Arduino-only vs ESP-IDF/FreeRTOS vs PlatformIO-class
5. WebSerial flashing verification session (hardware on bench)

## G. ADR revisit markers
ADR-0012..0016 (M1 rendering/picking: Flatbush picking, canvas vs MSDF
atlas, merge-conflicts-as-data, SDF atlas, GPU pick buffer) each carry
explicit "Revisit when" clauses.
