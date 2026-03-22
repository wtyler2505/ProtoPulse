# QA Audit: Section 14 — Global Features & Overlays

## Summary
- **Tested**: 2026-03-22
- **Status**: PARTIAL
- **Issues found**: 0 critical, 2 warnings, 2 cosmetic

## Checks Performed

### Command Palette (`Ctrl+Shift+P`)
- [x] Opens with Ctrl+Shift+P keyboard shortcut
- [x] Search combobox present and focused
- [x] Category filter tabs: All, Design, Simulate, Manufacture, Collaborate, Navigation, Settings
- [x] Suggestions listbox visible
- [x] Footer shows navigation hints (↑↓ navigate, ↵ select, esc close)
- [x] Closes cleanly with Escape
- [ ] Ctrl+K listed in shortcuts overlay as "Find component" — opens UnifiedComponentSearch, not command palette (different feature, no confusion)

### Keyboard Shortcuts Overlay (`?` key)
- [x] Opens with `?` key press (not Ctrl+?)
- [x] Displays "Keyboard Shortcuts" heading
- [x] GLOBAL section: Command palette (Ctrl+Shift+P), Find component (Ctrl+K), Save (Ctrl+S), Undo (Ctrl+Z), Redo (Ctrl+Shift+Z), Toggle shortcuts (?)
- [x] ARCHITECTURE section (context-aware): New node (N), New edge (E), Delete (Del), Rename (R), Select all (Ctrl+A), Fit view (F), Toggle snap grid (G)
- [x] Close hint: "Press ? or Esc to close"
- [x] Closes with Escape

### What's New Panel
- [x] Button present with Gift icon in toolbar (data-testid="whats-new-button")
- [x] Uses shadcn Sheet component (slide-in from right)
- [x] Parses CHANGELOG.md for version entries
- [x] Shows unseen badge count (localStorage-backed)
- [x] Content not verified in browser (Sheet portal may render outside a11y snapshot scope)

### Onboarding / View Hints
- [x] "Explain this panel" button present (haspopup="dialog")
- [ ] "Explain this panel" click did not produce visible dialog — **not tested further**

### Mentions Badge
- [x] "Mentions" button present in toolbar
- [ ] No badge count visible (expected — no mentions in test data)

### Activity Feed
- [x] Activity feed toggle button present (data-testid="toggle-activity-feed")

### Collaboration Indicator
- [x] "1 collaborator online" button visible in toolbar

### Theme Toggle
- [x] "Switch to light mode" button present
- [x] Click triggers theme change (visual)
- [ ] Button label does not update after toggle — always shows "Switch to light mode" (cosmetic)

### Context Menu (Right-Click)
- [x] Radix ContextMenu implemented on Architecture canvas (9 items)
- [x] SchematicCanvas context menu (6 items)
- [x] PCBLayoutView context menu (5 items)
- [ ] Not tested interactively (right-click via automation is unreliable)

### Console Errors
- [x] CSP `upgrade-insecure-requests` ignored in report-only mode (cosmetic, dev-mode)
- [x] WebSocket HMR connection failed (dev-mode artifact)
- [ ] **Worker blob URL blocked by CSP** — `worker-src` not set, falls back to `script-src 'self'`, blocks blob: workers (warning)

## Issues Found

### Critical
(none)

### Warnings
1. **CSP blocks blob: workers** — `worker-src` not explicitly set in CSP; falls back to `script-src 'self'` which blocks blob: URL workers. This affects the Circuit Code DSL worker (`circuit-dsl-worker.ts` creates a Blob URL Web Worker). Needs `worker-src 'self' blob:` in CSP config.
2. **"Explain this panel" button non-functional** — Button has `haspopup="dialog"` attribute but clicking produces no visible dialog or popover. The onboarding hint system may not be fully wired.

### Cosmetic
1. **Theme toggle label doesn't update** — Button always shows "Switch to light mode" regardless of current theme state. Should toggle between "Switch to light mode" / "Switch to dark mode".
2. **Command palette shortcut mismatch** — Plan says Ctrl+K for command palette, but actual shortcut is Ctrl+Shift+P. Ctrl+K opens UnifiedComponentSearch (Find component). Not a bug — shortcuts are internally consistent and documented in the overlay — but differs from the common Ctrl+K = command palette convention used by VS Code, Figma, etc.

## Screenshots
- `s14-01-command-palette.jpg` — Command palette with category tabs
- `s14-02-keyboard-shortcuts.jpg` — Keyboard shortcuts overlay showing Global + Architecture shortcuts
- `s14-03-theme-toggle.jpg` — App after theme toggle click

## What Works Well
- **Command palette** is well-organized with 6 category tabs (Design, Simulate, Manufacture, Collaborate, Navigation, Settings) — comprehensive for the 30+ views
- **Keyboard shortcuts overlay** is context-aware — shows view-specific shortcuts alongside global ones
- **What's New panel** auto-parses CHANGELOG.md and tracks unseen entries via localStorage — zero maintenance needed
- **Context menus** on Architecture (9 items), Schematic (6), and PCB (5) canvases provide contextual actions
- **Accessibility**: Skip links ("Skip to main content", "Skip to AI assistant") present, keyboard-navigable toolbars
