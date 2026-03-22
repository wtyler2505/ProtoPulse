# ProtoPulse QA Audit — Master Report

## Audit Overview
- **Date**: 2026-03-22
- **Auditor**: Claude (automated browser testing via Chrome DevTools MCP)
- **Scope**: 15 sections covering all 150+ UI surfaces
- **Method**: Live browser testing at `http://localhost:5000` with DOM inspection, console monitoring, and visual verification

## Overall Status

| # | Section | Status | Critical | Warning | Cosmetic |
|---|---------|--------|----------|---------|----------|
| 1 | Auth & Project Picker | FAIL | 4 | 2 | 1 |
| 2 | Workspace Layout & Navigation | PARTIAL | 1* | 1 | 2 |
| 3 | Architecture View | PASS | 0 | 1 | 2 |
| 4 | AI Chat Panel | PARTIAL | 1 | 3 | 1 |
| 5 | Schematic & Circuit Editor | PASS | 0 | 1 | 1 |
| 6 | PCB & Manufacturing | PARTIAL | 1 | 0 | 0 |
| 7 | BOM & Procurement | PASS | 0 | 0 | 0 |
| 8 | Validation & DRC | PASS | 0 | 0 | 1 |
| 9 | Simulation & Analysis | PASS | 0 | 0 | 0 |
| 10 | Arduino & Firmware | PASS | 0 | 0 | 0 |
| 11 | Code & DSL Tools | PASS | 0 | 0 | 0 |
| 12 | History & Collaboration | PASS | 0 | 0 | 0 |
| 13 | Advanced Views | PASS | 0 | 0 | 0 |
| 14 | Global Features & Overlays | PARTIAL | 0 | 2 | 2 |
| 15 | Settings, Export & Edge Cases | PARTIAL | 1* | 1 | 1 |
| | **TOTALS** | | **8** | **11** | **11** |

*\* = duplicate of a critical issue found in another section*

## Unique Critical Issues (7 distinct)

After deduplication, there are **7 distinct critical issues**:

### C1: Project Picker Unreachable (S1)
- `/projects` always redirects to last project instead of showing the project picker
- Users cannot browse, create, or switch projects
- **Root cause**: Route handling auto-redirects to `lastProject` from localStorage

### C2: Stale Project ID Causes 45+ Console Errors (S1, S2, S15)
- `protopulse-last-project` stores project ID that the current session may not own
- Loading that project triggers 45+ "Project not found" 404 API errors
- **Root cause**: No ownership validation before redirect; no stale ID cleanup on auth failure

### C3: Raw JSON Error Messages in Chat (S1)
- AI chat errors show raw JSON: `"Something went wrong: Internal server error"`
- Should show user-friendly error with retry option (retry button exists but message is ugly)

### C4: API Key Validation False Positive (S4)
- `STORED_KEY_SENTINEL` ("********") triggers "too short" validation
- Prevents users from using server-stored API keys without re-entering them

### C5: Export Center Shows System Log (S6, S15)
- OutputView renders a decorative "CONSOLE OUTPUT" terminal with system log messages
- Should show export format buttons (KiCad, Eagle, Gerber, SPICE, BOM CSV, etc.)
- **Root cause**: OutputView component renders console output instead of ExportPanel

### C6: CSP Blocks Blob Workers (S14)
- `worker-src` not set in CSP, falls back to `script-src 'self'`
- Blocks the Circuit Code DSL Web Worker (blob: URL)
- **Root cause**: Missing `worker-src 'self' blob:` in Helmet CSP config

### C7: "Explain This Panel" Button Non-Functional (S14)
- Button has `haspopup="dialog"` but clicking produces no visible dialog
- Onboarding hint system may not be fully wired

## Warning Issues (11)

| # | Section | Issue |
|---|---------|-------|
| W1 | S1 | Session created without credentials — no login form |
| W2 | S1 | No visible "Sign Out" button in workspace |
| W3 | S3 | ReactFlow attribution link (required by license) |
| W4 | S4 | Chat search returns no UI feedback for empty results |
| W5 | S4 | Chat export produces empty/minimal file |
| W6 | S4 | Temperature slider shows raw float (0.7000000000000001) |
| W7 | S5 | Breadboard view shows empty state — no visual breadboard grid |
| W8 | S14 | CSP blocks blob: workers (elevated to C6) |
| W9 | S14 | "Explain this panel" non-functional (elevated to C7) |
| W10 | S15 | Stale `lastProject` causes cascade on redirect |
| W11 | S2 | Sidebar collapsed state not persisting on some navigations |

## Cosmetic Issues (11)

| # | Section | Issue |
|---|---------|-------|
| Co1 | S1 | Project name "DevelopmentTest" looks like test data |
| Co2 | S2 | "Audio Amplifier (Sample)" suffix could be cleaner |
| Co3 | S2 | Tab overflow — 30+ tabs require horizontal scrolling |
| Co4 | S3 | Mini map shows in bottom-right even when canvas is empty |
| Co5 | S3 | ReactFlow attribution link styling doesn't match dark theme |
| Co6 | S5 | Schematic toolbar has redundant zoom controls (toolbar + ReactFlow panel) |
| Co7 | S8 | Validation severity badges could use more distinct colors |
| Co8 | S14 | Theme toggle label always shows "Switch to light mode" |
| Co9 | S14 | Command palette uses Ctrl+Shift+P (unconventional; Ctrl+K is industry standard) |
| Co10 | S15 | "Not found" toast on sidebar PCB click |
| Co11 | S15 | Export Center heading says "Export Center" but content is system log |

## Sections Passing Clean (8/15)

Sections 7, 8, 9, 10, 11, 12, 13 passed with zero critical or warning issues. These represent the BOM, Validation, Simulation, Arduino, Code/DSL, History/Collaboration, and Advanced Views — all rendering correctly with proper empty states and zero console errors.

## Priority Fix Order

### Phase 1: Critical Fixes (blocks release)
1. **C1 + C2**: Fix project picker routing and stale ID cleanup
2. **C5**: Wire ExportPanel into OutputView instead of console output
3. **C6**: Add `worker-src 'self' blob:` to CSP config
4. **C4**: Fix API key sentinel validation

### Phase 2: Warning Fixes (polish)
5. **C7/W9**: Wire onboarding hint dialogs to "Explain this panel" button
6. **W6**: Fix temperature slider float precision
7. **C3**: Improve chat error message formatting
8. **W7**: Add visual breadboard grid to empty breadboard view

### Phase 3: Cosmetic (nice-to-have)
9. **Co8**: Update theme toggle button label on state change
10. **Co3**: Consider grouping tabs or adding tab search
11. Other cosmetic items

## Test Coverage Summary

| Area | Views Tested | Result |
|------|-------------|--------|
| Auth & Routing | Project picker, 404, deep links, back/forward | 1 FAIL, rest PASS |
| Canvas Views | Architecture, Schematic, PCB, Breadboard | All render |
| Data Views | BOM, Validation, Simulation, History | All PASS |
| Tool Views | Arduino, Circuit Code, Calculators | All PASS |
| Advanced | Knowledge Hub, Generative, Digital Twin, 3D, Community | All PASS |
| Global | Command palette, shortcuts, theme, context menus | PARTIAL |
| Persistence | Chat settings, view state, theme, panel layout | All PASS |
| Edge Cases | 404 page, API 404, rapid switching, stale data | PARTIAL |

## Screenshots Directory
All screenshots saved to `docs/qa-audit/screenshots/`:
- `s1-*` through `s15-*` — section-specific captures
- Total: ~25 screenshots documenting every major view and issue
