# QA Audit: Section 6 — PCB Layout & Manufacturing

## Summary
- **Tested**: 2026-03-22
- **Status**: PARTIAL (Order PCB excellent, Export view has content mismatch)
- **Issues found**: 1 critical, 0 warnings, 0 cosmetic

## Checks Performed

### Order PCB View
- [x] View renders at `/projects/18/ordering`
- [x] Step wizard breadcrumb: Board Specs → Select Fab → DFM Checks → Quotes → Summary
- [x] Board Specifications form:
  - [x] Quantity field: pre-filled with 5
  - [x] Width (mm): 100, Height (mm): 80 — editable inputs
  - [x] Layers dropdown: "2 layers" selected
  - [x] Thickness dropdown: "1.6mm" selected
  - [x] Copper Weight dropdown: "1 oz" selected
  - [x] Surface Finish dropdown: "HASL" selected
  - [x] Solder Mask Color: 8 color swatches (green, red, blue, black, white, yellow, purple, matte black)
  - [x] Silkscreen Color dropdown: "White" selected
  - [x] Min Trace Width: 0.2 mm
  - [x] Min Drill Size: 0.3 mm
- [x] Previous/Next navigation buttons with step indicators
- [x] All form controls are interactive and properly labeled
- [x] Console errors: zero

### Export Center View
- [x] View renders at `/projects/18/output` (mapped to "Exports" tab)
- [x] Heading: "Export Center" with description listing supported formats
- [x] Console output section with Copy all logs + Clear logs + Filter
- [x] System log entries rendering with timestamps and categories
- [ ] **Export format buttons NOT visible** — see C1 below
- [ ] Gerber/drill/BOM CSV/pick-and-place export buttons — not found
- [ ] Export precheck/validation — not tested
- [ ] Export results panel — not tested

### PCB Layout (covered in Section 5)
- Already verified: layer stack, board outline, toolbar, empty state

## Issues Found

### Critical

**C1: Export Center shows system log terminal instead of export format options**
- **What happens**: The "Exports" tab (Export Center view) displays a system log terminal with 3 hardcoded messages:
  - `[SYSTEM] Initializing ProtoPulse Core...`
  - `[PROJECT] Smart_Agro_Node_v1 loaded.`
  - `[AI] Ready for queries.`
- **Expected**: Export format selection buttons (KiCad, Eagle, Gerber, BOM CSV, SPICE, PDF, etc.) as described in the view's own description text
- **Impact**: Users cannot access any export functionality from this view. The description promises "Export your design in multiple formats" but delivers a log terminal.
- **Possible root cause**: The OutputView component may be rendering a decorative terminal instead of the actual ExportPanel. The export functionality likely exists in a separate panel/modal but isn't wired into this view's main content area.
- **Note**: The project name in the log says "Smart_Agro_Node_v1" which doesn't match the current project "Audio Amplifier (Sample)" — this is hardcoded demo content, not live data
- **Screenshot**: `s6-02-exports.jpg`

### Warnings
None.

### Cosmetic
None.

## What Works Well
- **Order PCB wizard** is genuinely professional — the board spec form covers everything a real PCB fab needs (layers, thickness, copper weight, surface finish, mask color, trace width, drill size)
- **8 solder mask color options** with visual swatches — matches real fab offerings (JLCPCB, PCBWay, etc.)
- **Step-by-step wizard flow** (Board Specs → Select Fab → DFM Checks → Quotes → Summary) is well-designed for guiding users who've never ordered a PCB before
- **Sensible defaults** — 2-layer, 1.6mm, 1oz, HASL, 100x80mm, qty 5 — these are the most common hobby/maker specs
- **Zero console errors** across both views

## Screenshots
- `s6-01-order-pcb.jpg` — Order PCB wizard with board specifications form
- `s6-02-exports.jpg` — Export Center showing system log instead of export buttons

## Notes
- The PCB layout editor was already verified in Section 5 with layer stack, toolbar, and empty state
- DFM checks, fab selection, and quote comparison steps of the ordering wizard were not tested (requires progressing through the wizard with board data)
- Export functionality may be accessible through the AI chat ("Export BOM CSV" quick action) or through individual view toolbars (e.g., schematic "Export SPICE" button) even if the dedicated Export Center view isn't working
