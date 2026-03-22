# QA Audit: Section 2 — Workspace Layout & Navigation

## Summary
- **Tested**: 2026-03-22
- **Status**: PARTIAL (mostly works, some issues)
- **Issues found**: 1 critical (from S1), 1 warning, 2 cosmetic

## Checks Performed
- [x] 3-panel layout renders correctly (sidebar | main | chat)
- [x] Sidebar collapse/expand — works, persists state
- [x] Sidebar collapsed shows icon-only navigation — works
- [x] Tab bar renders 20+ tabs with scroll arrows — works
- [x] View switching via tabs — works (Dashboard → Architecture → Simulation)
- [x] URL updates on view switch — works (`/projects/18/dashboard` → `/projects/18/architecture` etc.)
- [x] Deep link navigation — works (`/projects/18/calculators` loads correct view)
- [x] Chat panel toggle (hide/show) — works, button text updates
- [x] Chat panel collapsed shows "AI ASSISTANT" label — works
- [x] Theme switching (dark ↔ light) — works, button text updates
- [x] Light mode rendering — clean, readable, teal accents preserved
- [x] Browser back/forward — works, correct history entries
- [x] Console errors on project 18: **ZERO** — clean
- [x] Workflow breadcrumb (Architecture → Schematic → PCB → Validation → Output) — renders correctly
- [x] Project name displayed in tab bar when sidebar collapsed — works ("Audio Amplifier (Sample)")
- [ ] Resize handles — not tested (requires drag interaction)
- [ ] Responsive/narrow viewport — not tested

## Issues Found

### Critical

**C1 (carried from Section 1): "Back to Projects" link doesn't navigate**
- Already documented in Section 1 as C4
- The sidebar link at `url="/projects"` does not navigate to the project picker
- Same root cause as C1/C4 in Section 1 report

### Warnings

**W1: Tab bar doesn't scroll to show the active tab on deep link**
- When navigating directly to `/projects/18/calculators`, the "Calculators" tab is scrolled out of the visible tab area
- The tab bar doesn't auto-scroll to make the active tab visible
- User might not realize which tab is selected without scrolling
- **Fix**: After setting `activeView`, scroll the tab bar to ensure the selected tab is in viewport

### Cosmetic

**CO1: Collapsed sidebar icon buttons have no visible labels or tooltips**
- In collapsed mode, the sidebar shows ~27 icon buttons with no text
- Some icons are very similar and hard to distinguish at a glance
- Would benefit from tooltip on hover showing the view name

**CO2: Onboarding hint partially overlaps view content**
- "Showing 3 more views" hint bar at top of some views takes space but doesn't provide actionable value
- Minor layout impact but adds visual noise

## What Works Well
- View switching is fast — no visible loading between tabs
- URL deep linking works perfectly — shareable view URLs
- Theme toggle is instant with no flash/flicker
- Sidebar collapse/expand is smooth
- Chat panel toggle is clean — collapsed state shows minimal "AI ASSISTANT" header
- Browser history integration works correctly for back/forward navigation
- Zero console errors on a valid project (project 18)
- Tab bar scroll arrows appear/disappear correctly based on scroll position

## Screenshots
- `s2-01-dashboard-3panel.jpg` — Full 3-panel layout on dashboard
- `s2-02-sidebar-collapsed.jpg` — Sidebar collapsed state
- `s2-03-simulation-empty.jpg` — Simulation view (full content visible)
- `s2-04-light-mode.jpg` — Light theme rendering
- `s2-05-deeplink-calculators.jpg` — Deep link to calculators view

## Notes
- Testing was done on project 18 ("Audio Amplifier (Sample)") which loads cleanly
- Project 2 ("DevelopmentTest") is broken for the devtest user (ownership mismatch from S1)
- Sidebar collapse state persists across view switches
- Chat panel state (open/closed) persists across view switches
- Theme preference persists across view switches
