# QA Audit: Section 15 — Settings, Export & Edge Cases

## Summary
- **Tested**: 2026-03-22
- **Status**: PARTIAL
- **Issues found**: 1 critical (from S1), 1 warning, 1 cosmetic

## Checks Performed

### Export Center (`/projects/18/output`)
- [x] Exports tab renders and is selectable
- [ ] **Export Center shows "CONSOLE OUTPUT" with system log instead of export format buttons** (critical, same as S6)
- [ ] Export buttons (KiCad, Eagle, SPICE, Gerber, etc.) — not visible
- [ ] Import design — not tested (no UI button found in Exports view)
- [ ] Embed dialog — not tested
- [ ] Share project — not tested

### Chat Settings Persistence
- [x] AI model persists across page loads (`gemini-3.1-pro-preview-customtools` in localStorage)
- [x] AI provider correctly set to Gemini
- [x] Both API keys (Gemini + Anthropic) stored in localStorage
- [x] Panel layout persists (sidebar collapsed, chat width, active view)

### View Persistence
- [x] Active view stored in `protopulse-panel-layout` localStorage key
- [x] Theme persists (`oled-black`)
- [x] High contrast setting persists (`false`)
- [x] Last project ID persists (`protopulse-last-project`)

### 404 Page
- [x] `/totally-nonexistent-page` shows proper 404 page
- [x] "404 Page Not Found" heading
- [x] Descriptive message: "The page you are looking for does not exist or has been moved."
- [x] "Return to Dashboard" button links to `/`

### API 404 (BL-0010 fix)
- [x] `/api/nonexistent-route` returns JSON `{"message":"API endpoint not found"}` with 404 status
- [x] Content-Type: `application/json` (not HTML)
- [x] Unauthenticated requests get 401 JSON before hitting 404

### Deep Link Navigation
- [x] `/projects/18/simulation` → Simulation tab selected correctly
- [x] `/projects/18/architecture` → Architecture tab selected correctly
- [x] `/projects/18/schematic` → Schematic tab selected correctly
- [x] URL updates in browser when switching views via tabs
- [ ] `/projects/18/nonexistent_view` → Falls back to last active view (no error shown) — acceptable behavior

### Browser Back/Forward
- [x] Back button returns to previous URL
- [x] Forward button navigates forward correctly
- [x] Page content matches the navigated URL

### Rapid View Switching
- [x] Switching Architecture → Schematic via tab: no crash
- [x] Clicking sidebar PCB button: triggers "Not found" toast (project context mismatch, see below)
- [x] No white screen / no React error boundary triggered

### Project Picker Redirect
- [x] `/projects` redirects to last project (`/projects/2/architecture`)
- [ ] **Project picker page unreachable** — always redirects to last project (critical, same as S1)

### Onboarding Checklist
- [x] "Getting Started" checklist visible on project 2
- [x] Shows 1/6 completed (17% progress bar)
- [x] 6 tasks: Create project, Add node, Connect nodes, Add BOM item, Run validation, Export
- [x] Collapse button works
- [x] Dismiss button present
- [x] Per-project progress (project 2 and 18 have different states in localStorage)

### Console Errors
- [ ] **45 errors on project 2** — "Project not found" 404s from ownership check failure
- [x] Project 18 loads cleanly (3 errors: CSP, HMR, worker — all known)

## Issues Found

### Critical
1. **Export Center broken** (same as S6) — Shows "CONSOLE OUTPUT" with system log instead of export format buttons. This is the OutputView rendering a decorative terminal rather than the ExportPanel.

### Warnings
1. **Stale `lastProject` causes cascade** — `protopulse-last-project` stores project ID 2, which the current session doesn't own. Navigating to `/projects` redirects to project 2, triggering 45+ "Project not found" API errors. The app should validate project ownership before redirecting, or clear stale project IDs on auth failure.

### Cosmetic
1. **"Not found" toast on sidebar navigation** — Clicking PCB in the sidebar while on the Schematic view shows a "Not found" toast. This may be a data lookup for a circuit design that doesn't exist for this project.

## Screenshots
- `s15-01-exports-view.jpg` — Export Center showing Console Output instead of export buttons
- `s15-02-404-page.jpg` — 404 page with proper messaging
- `s15-03-onboarding-checklist.jpg` — Getting Started checklist on project 2

## What Works Well
- **404 page** is clean and helpful with a "Return to Dashboard" link
- **API 404** correctly returns JSON (BL-0010 fix verified working)
- **Deep linking** works — URL-based view selection works for all tested views
- **Browser history** (back/forward) navigates correctly between views
- **Chat settings, theme, panel layout, and view state all persist** via localStorage
- **Onboarding checklist** is per-project with progress tracking and dismissal
- **View switching is stable** — no crashes or white screens during rapid tab switching
