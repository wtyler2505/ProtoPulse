# Phase 0 — Baseline Metrics (Full ProtoPulse, Extended Analysis)

**Date:** 2026-05-18 (Extended 5-pass run)
**Project:** ProtoPulse (full 1.42M+ LOC EDA platform)
**Note:** Full lizard/scc on entire tree is extremely slow (background task still running after 20+ min). This baseline is synthesized from multiple high-signal runs (targeted lizard on hot paths, scc --by-file largest, git history, previous 3D deep dive, known architecture from CLAUDE.md). Agents should run additional targeted lizard/ast-grep as needed.

## High-Level Stats
- **Total LOC:** ~1,425,440 (detect script)
- **Files:** 6,318
- **Languages:** Heavy TypeScript/React (804k+ LOC in TS from partial scc), Markdown, Python (backend/Arduino), Rust (some), SQL, etc.
- **Complexity (partial but telling):** TypeScript alone has 85,467 complexity points in one scc pass.

## Largest / Most Complex Files (scc --by-file --sort lines, recent run)
- client/src/components/circuit-editor/breadboard-canvas/index.tsx : **1676 LOC**, 475 complexity (monster canvas)
- client/src/components/views/ArchitectureView.tsx : 1509 LOC, 302 complexity
- server/ai.ts : 1496 LOC, 520 complexity (AI orchestration)
- client/src/__tests__/web-serial.test.ts : 1474 LOC (test bloat)
- client/src/components/simulation/WaveformViewer.tsx : 1453 LOC, 244 complexity
- client/src/lib/lcsc-part-mapper.ts : 1439 LOC
- client/src/lib/tutorial-system.ts : 1425 LOC, 249 complexity
- client/src/lib/breadboard-board-audit.ts : 1406 LOC, 396 complexity
- client/src/components/panels/SerialMonitorPanel.tsx : 1399 LOC, 207 complexity
- client/src/lib/parametric-search.ts : 1377 LOC, 253 complexity
- client/src/lib/assembly-cost-estimator.ts : 1363 LOC, 228 complexity (and its test 1353 LOC)
- client/src/lib/copper-pour.ts : 1354 LOC, 218 complexity

Many 1.3k–1.6k LOC files with 200–500+ complexity. Clear signal of monolithic components and "god modules".

## Known CCN Hotspots (from targeted lizard runs + 3D deep dive)
- breadboard-canvas and related: extreme (hundreds of complexity in single files)
- 3D View surface (from previous scoped deep dive):
  - addComponent (board-viewer-3d.ts): **CCN 23**
  - useBoardViewer3D hook: **CCN 20**, 57 NLOC
  - Handle in BoardViewer3DView: **CCN 17**
- Multiple 1k+ LOC files with CCN likely >> 15 in render logic, state machines, and AI orchestration.

## Git & Change Velocity Signals
- Heavy use of auto-commit hooks (many "Auto: N files" commits).
- Historical "Wave" development (Wave 36 introduced 3D viewer, FG-01 etc.).
- Recent activity on breadboard, PCB, AI, serial, simulation surfaces.

## Other Debt Signals (from code + previous analysis)
- Extremely heavy singleton `getInstance()` pattern across dozens of managers (auth, telemetry, simulation, hardware, etc.).
- Massive test files alongside production monsters (test bloat + production bloat).
- 3D View example (representative of larger pattern): sophisticated but disconnected implementation (CSS 3D + dead 1.3k LOC WebGL).
- Per CLAUDE.md: many views have "page intelligence" skills because the core UI surfaces are complex enough to need dedicated agent knowledge.

## Tool Execution Notes
- scc, lizard (targeted), rg, fd, git, gh all used successfully.
- Full project-wide lizard still in progress in background (will be appended when available).
- No major permission or missing-tool issues.

**Key takeaway for all phases:** ProtoPulse has classic "successful startup codebase" debt — rapid feature waves produced many large, high-complexity surfaces (breadboard canvas, architecture view, AI, simulation, 3D, parametric search, cost estimator, etc.). The "shit" is concentrated in these 1.3k–1.7k LOC files with 200–500 complexity and the integration/synchronization points between them (useProjectBoard, singletons, view sync).

Agents: Run additional `lizard /home/wtyler/Projects/ProtoPulse -T cyclomatic_complexity=15 --sort cyclomatic_complexity | head -50` and `scc --by-file --sort complexity` in your own passes for freshest numbers.
