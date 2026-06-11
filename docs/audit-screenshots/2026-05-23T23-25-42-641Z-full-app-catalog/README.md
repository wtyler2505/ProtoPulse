# 2026-05-23 Full Desktop Pass — High-Fidelity Interaction Catalog

**Status**: Partial success (desktop only, high caps). The run produced the richest set of targeted desktop interaction screenshots to date for the core ProtoPulse maker surfaces before the dev server became unreachable.

**Key Characteristics**
- Scope: full-app, mixed seed, synthetic-rich project
- Caps: max-elements=120, max-interactions=45
- Viewports completed: desktop (laptop/short-laptop/tablet/mobile not reached)
- Evidence quality: Extremely high — 100–138 files per major view, including dozens of real "after-click-*" and "overlay-*" states demonstrating actual user flows (sidebar toggle, tab switching between editors, stash, hardware inspection, cross-view navigation, asset manager, exact-part flows, generate/AI/extract/validate/publish, metadata editing, trust badges, etc.).

**Why This Catalog Matters**
This is the first non-pilot desktop pass with production caps. The interaction states (especially for Breadboard, Component Editor, PCB, Schematic, Exports, Procurement, AI Chat, sidebars) provide concrete, citable evidence for the P0/P1/P2 items in the FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md around:
- UI Container Rule compliance (scroll, density, side panels + canvas)
- Provenance / exact-part / verification visibility
- Coach, stash, hardware inspection, and cross-surface flows
- Canvas extraction debt and multi-editor round-tripping

**Files of Particular Value (examples)**
- Breadboard: 124-after-click-toggle-sidebar.png ... 138-overlay-... (real stash, hardware inspection, tab switches, cross-nav)
- Component Editor: files covering exact-part trust strip/badges, metadata form, generate/AI/extract/validate/publish/import, tab switching between breadboard/schematic/pcb, hardware inspection from editor, after-click + overlay states
- PCB: asset manager, v3 architecture readiness, tool interactions, after-click states, tab switching
- Similar for 3D viewer, AI Chat, sidebars, procurement, exports, etc.

**Live Browser Complements**
While the server was up, additional current-state full-page PNGs + verbose a11y trees were captured for Dashboard + expanded left sidebar, Architecture, Schematic, Breadboard, and Validation in a real sample project (see live-*-current-*.png and .txt in the parent audit-screenshots directory).

**Failure Root Cause & Lesson**
The internal Playwright capture crashed with `page.goto: net::ERR_CONNECTION_REFUSED` after the desktop pass had already written the bulk of the evidence. The dev server (npm run dev on :5000) became unreachable mid-run.

**Recommendation for Future Captures**
Always run the full dev stack in a persistent tmux session:
  tmux new-session -d -s protopulse-dev 'npm run dev'
Then attach as needed (`tmux attach -t protopulse-dev`).

Re-run the exact capture command once the server is persistent to obtain the complete 5-viewport (desktop + laptop + short-laptop + tablet + mobile) dataset with the same high caps.

**Relation to "latest-full-app-catalog"**
As of 2026-05-24, `latest-full-app-catalog` still points to an earlier limited pilot run. This timestamped directory contains significantly higher-fidelity desktop interaction evidence and should be considered the authoritative recent full desktop pass for audit and regression purposes.

See the main backlog report for specific path-cited findings drawn from this catalog.
