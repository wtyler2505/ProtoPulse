# ProtoPulse Enhancement Report — Everything That Can Be Better

> Compiled from the full 15-section QA audit + browser testing on 2026-03-22.
> Every item here is something that works but could be improved. Grouped by area, ordered by impact.

---

## 1. Project Picker (`/projects`)

### High Impact
- **E2E test project clutter** — 12 "E2E Test Project" entries with identical names, dates, and no descriptions. Add a "Clean up test projects" button or auto-hide projects with duplicate names. Users shouldn't see CI artifacts.
- **No project deletion from picker** — You can only delete from within a project. Add a context menu (right-click or three-dot) on project cards with Delete, Duplicate, Archive options.
- **No project thumbnails** — Every project card looks the same (text only). Generate a mini architecture diagram or circuit preview thumbnail for visual differentiation.

### Medium Impact
- **"Select a project to continue"** — Feels passive. Consider "Your Projects" or "Welcome back, Tyler" with a personalized greeting.
- **Sample projects don't indicate "sample"** in the ALL PROJECTS list — Only the SAMPLE PROJECTS section has badges. In ALL PROJECTS, "Audio Amplifier (Sample)" relies on the "(Sample)" suffix in the name which could be stripped for a cleaner look + a badge instead.
- **No sorting options in ALL PROJECTS** — Only "Recent / Name / Pinned" toggles. Missing: sort by component count, last modified, size.
- **Search box is narrow** — Full-width but no visual cue that it searches across name AND description. Add placeholder like "Search by name or description..."
- **Version badge always shows "v1"** — Every project says "v1". If versioning isn't functional, remove the badge to avoid false promises.

### Tiny Details
- **No loading skeleton for project cards** — Cards pop in when API responds. A card-shaped skeleton would feel smoother.
- **"New Project" button is in the top-right corner** — On wide screens it's far from the content. Consider a centered empty-state CTA when there are 0 user projects.
- **Recent Projects section shows pin/remove buttons** — The pin icon and × are small and have no tooltip on the buttons themselves. Add hover text.
- **Difficulty badge colors** — Beginner (green), Intermediate (yellow), Advanced (red) — good. But the text inside is small and hard to read on the colored background.
- **No keyboard navigation** — Can't arrow-key through project cards. Tab works but arrow keys would feel more natural for a card grid.

---

## 2. Workspace Layout

### High Impact
- **30+ tabs require horizontal scrolling** — Most users will never use all tabs. Consider: (a) tab grouping/collapsing, (b) a "More..." dropdown for rarely-used tabs, (c) user-configurable tab visibility, or (d) the sidebar group structure (which exists!) replacing tabs entirely.
- **Tab bar takes up vertical space even when sidebar is open** — The sidebar already has navigation. When sidebar is expanded, the tab bar is redundant. Consider hiding tabs when sidebar is open.
- **No tab reordering** — Users can't drag tabs to rearrange or pin favorites to the left. Every user's workflow is different.
- **Deep link URL regression** — Navigating to `/projects/18/validation` via SPA pushState doesn't switch the view. Only works on full page reload. The `useEffect([], [])` on mount reads the URL but doesn't react to subsequent URL changes.

### Medium Impact
- **Sidebar skeleton loading is ugly** — On every view switch, the sidebar briefly shows animated skeleton bars (the cyan rectangles). This flickers visually. Consider keeping the sidebar content between view switches instead of re-rendering.
- **Workflow breadcrumb (Architecture → Schematic → PCB → Validation → Export)** — This linear flow is great for guided workflows but doesn't help when jumping to non-workflow views (Arduino, Calculators, Knowledge Hub). Consider showing context breadcrumbs for all views.
- **Chat panel takes 350px on every view** — Many views (Arduino, Calculators, 3D View) don't benefit from the AI chat. Auto-collapse chat on views where it's rarely used, or remember per-view chat state.
- **No "Back to Projects" button in the main workspace area** — The sidebar has a link, but when sidebar is collapsed, there's no way to return to the project picker without expanding the sidebar first or typing the URL.

### Tiny Details
- **"Audio Amplifier (Sample)" in the header** — The "(Sample)" suffix feels like debug text. Show project name without the suffix, add a small badge.
- **Resize handles (sidebar/chat)** — Work but have no visual affordance (no drag cursor icon, no grip dots). Users may not discover they can resize.
- **No panel minimize animation** — Sidebar and chat collapse/expand instantly. A slide animation (100-200ms) would feel polished.
- **Settings gear icon in collapsed sidebar** — When sidebar is collapsed, the settings gear at the bottom is unlabeled. Add a tooltip.
- **"Hide chat" / "Show chat" button** — Position is fine but the icon is small and lacks an aria-label description of what's in the chat panel.

---

## 3. Architecture View

### High Impact
- **Canvas is empty on first load for sample projects** — The "Audio Amplifier" sample has nodes (LDO, ESP32) but the canvas doesn't auto-fit to show them. User sees blank canvas and has to scroll/zoom to find nodes.
- **No auto-layout** — Adding multiple nodes piles them in the same position. A "Clean up layout" button that auto-arranges nodes (force-directed, tree, or grid) would be huge.
- **Design Suggestions panel is always collapsed** — The 5 suggestions (capacitors, thermal management, crystal) are genuinely useful but hidden behind a click. Consider showing the top suggestion as a subtle banner.

### Medium Impact
- **Asset Library duplicates** — BME280 appears twice in the recently used list. ESP32-S3-WROOM-1 appears twice. Dedup the recently used list.
- **No visual differentiation between node types** — All nodes look the same (rounded rectangles with text). MCU, sensor, power, connector should have distinct visual styles (colors, icons, shapes).
- **ReactFlow attribution link** — Required by license but positioned at bottom-right over content. Style it to match the dark theme (it's bright white text on dark background).
- **Mini map position** — Bottom-right, overlapping with Design Suggestions panel. Can conflict visually.

### Tiny Details
- **"Node LDO 3.3V" in a11y tree** — The "Node" prefix is unnecessary. Screen readers already know it's a node from the role.
- **Zoom controls** — "Zoom In" is disabled at max zoom but there's no visual indicator of the current zoom level (e.g., "100%").
- **Grid dots** — Visible but very faint. Consider making them slightly more visible or using subtle crosshair grid lines.
- **Edge connection handles** — Small and hard to grab. Slightly larger handles (8px → 12px) would improve the drag experience.

---

## 4. Schematic View

### High Impact
- **Empty schematic state is text-only** — "Your schematic is empty. Add components from the library." A visual breadboard/schematic illustration would be more inviting.
- **Component library search** — Works but returns results only by name, not by function ("voltage regulator" doesn't find "LDO 3.3V"). Add alias/function search.

### Medium Impact
- **Toolbar has redundant controls** — Both the schematic toolbar AND the ReactFlow zoom panel have zoom in/out/fit buttons. Remove one set.
- **Wire routing angle radio buttons** — "Free angle / 45° / 90°" are good but have no visual preview of what each mode does. Add tiny icons showing the angle constraint.
- **"Push to PCB" button** — Disabled with tooltip "All components already placed on PCB." Confusing when there are no components — should say "No components to push" instead.
- **Multi-sheet dropdown** — Shows "New Circuit" but the tabs (Parts, Power, Sheets, Sim) below are text-only. Consider icons + text.

### Tiny Details
- **ERC toggle button** — "Toggle ERC panel" has no visual indicator of whether ERC is open or closed.
- **"Draw Net (W) — drag between pins"** — The shortcut hint is good but the tooltip is long. Shorten to "Draw Net (W)".
- **Undo/Redo buttons** — Show as disabled with no count of available actions. A small "3" badge showing available undos would be informative.

---

## 5. PCB View

### Medium Impact
- **PCB canvas is empty with no visual board outline** — Should show a default board outline (100mm × 100mm) with a grid even when empty.
- **Layer stack panel** — Present but hidden behind a button. The current layer should be shown in the toolbar (e.g., "F.Cu" badge).
- **No component placement preview** — When dragging a component, there's no ghost/shadow showing where it will land.

### Tiny Details
- **Via tool button** — Labeled as "4" (keyboard shortcut) with no icon. Add a via icon.
- **DRC constraint overlay toggle** — Hard to discover. Add to the toolbar rather than just a menu option.

---

## 6. BOM / Procurement

### High Impact
- **BOM table is empty for sample projects** — The "Audio Amplifier" sample has architecture nodes (LDO, ESP32) but the BOM isn't auto-populated from them. Consider auto-generating BOM items when architecture nodes are added.

### Medium Impact
- **No quick-add from component library** — Adding a BOM item requires manual data entry. An "Add from Library" button that pre-fills part number, description, and pricing from the standard library would save time.
- **BOM cards view** — Exists but no toggle is visible to switch between table and card views.
- **Supplier pricing panel** — Shows placeholders but no real data flow. Mock pricing data for common parts (Arduino, ESP32, resistors) would demonstrate the feature.

### Tiny Details
- **"0 items" badge** — Correct but the badge appears even when empty. Consider hiding the badge when count is 0.
- **Column widths** — Not user-adjustable. Drag-to-resize column headers would be standard table UX.

---

## 7. Validation View

### Medium Impact
- **Severity filter bar** — Present but could use chip-style toggle buttons (Critical / Warning / Info) with counts instead of a dropdown.
- **"Run Validation" button** — Should show a loading spinner while running, with "Re-run" label after first run.
- **Click-to-focus** — Validation issues list items should highlight/flash the offending element in the schematic/PCB when clicked. The wiring exists but the visual feedback (flash animation) is subtle.

### Tiny Details
- **DRC rule explanations** — 28 rules have explanations but they're hidden behind an expand toggle. Consider showing the explanation inline for the first occurrence.
- **No validation history** — Previous run results are lost when you re-run. A simple "Previous: 3 issues → Current: 1 issue" comparison would show progress.

---

## 8. Simulation View

### Medium Impact
- **Four analysis types (DC, Transient, AC, DC Sweep)** — All collapsed by default. The most common one (DC Operating Point) should be expanded by default.
- **No visual waveform preview** — The simulation results panel mentions waveforms but there's no actual chart/oscilloscope display in the UI.
- **Parameters section** — Collapsible but has no defaults filled in. Pre-fill with sensible defaults (e.g., Transient: 0-10ms, AC: 1Hz-1MHz).

### Tiny Details
- **"Start Simulation" dropdown** — Good for multiple sim types, but the button text should change to reflect the selected type ("Run DC Analysis" not "Start Simulation").
- **"Import SPICE Netlist" section** — Should be in the Export view, not Simulation. Or at least cross-linked.

---

## 9. Arduino Workbench

### Medium Impact
- **5 sub-panels (Examples, Library, Board Manager, Serial Monitor, Library Manager)** — All collapsed. The "Examples" panel should auto-expand on first visit to guide beginners.
- **Verify/Upload buttons disabled** — Correct when no file is selected, but the disabled state has no tooltip explaining WHY they're disabled.
- **Output tabs** — 6 tabs (OUTPUT, SERIAL MONITOR, LIBRARIES, BOARDS, PIN CONSTANTS, SIMULATE) but only OUTPUT is active. The other tabs should show placeholder content or be hidden until relevant.

### Tiny Details
- **Board status badge** — Shows "FIRMWARE DEVELOPMENT" but doesn't indicate which board is selected.
- **Save (Ctrl+S) + Format Code (Ctrl+T)** — Good shortcuts but not visible until hovering. Add them to a toolbar.

---

## 10. Circuit Code / DSL

### Medium Impact
- **No autocomplete dropdown** — The CodeMirror editor has autocomplete logic implemented but no visible dropdown appears when typing. The completions module (4 context-aware modes) exists but may not be wired to the editor config.
- **Schematic preview panel** — Shows "No components" when code hasn't been evaluated. Consider showing a placeholder circuit diagram.

### Tiny Details
- **Status bar shows "0 components 0 nets"** — Fine for empty state, but the labels should include a pipe separator or spacing: "0 components | 0 nets | Ready".
- **Dark theme** — CodeMirror uses a custom dark theme but the gutter background color is slightly different from the editor background, creating a visual seam.

---

## 11. Knowledge Hub

### Tiny Details
- **"20 articles" badge** — Good. But articles don't have read/unread tracking. A subtle "New" badge on unread articles would increase engagement.
- **No reading time estimates** — Articles have difficulty levels but no "5 min read" indicator.
- **Search bar** — Works but doesn't highlight matching terms in the results.

---

## 12. Chat Panel

### High Impact
- **Error messages still visible from previous sessions** — "Something went wrong: Internal server error" from an earlier test is permanently in the chat history. There's no way to clear/delete individual messages. Add a "Delete message" option or a "Clear chat history" button.
- **No markdown rendering in user messages** — User messages render as plain text (no bold, links, code blocks). Only assistant messages get markdown.

### Medium Impact
- **Quick action buttons scroll horizontally** — "Generate Architecture, Optimize BOM, Run Validation, Add MCU Node, Project Summary, Show Help, Export BOM CSV" — these scroll off-screen. Consider a 2-row grid or a "More actions..." menu.
- **Model/provider display** — "API — Gemini Gemini 3.1 Pro (Custom Tools)" has "Gemini" appearing twice (provider name + model name). Clean up to just show "Gemini 3.1 Pro".
- **Settings panel** — Accessible only via the gear icon in the chat header. No way to access it from the main settings or sidebar.

### Tiny Details
- **Timestamps** — Show "08:08 AM" format. Consider relative timestamps ("2 hours ago") for recent messages, absolute for older ones.
- **Copy message button** — Works but has no success feedback (no "Copied!" toast or icon change).
- **Branch conversation button** — Present on every message but no tooltip explaining what branching does.
- **Voice input button** — Has a microphone icon but clicking it likely does nothing without browser permission. Should prompt for mic permission or show "Voice input coming soon" toast.

---

## 13. Export Center

### Medium Impact
- **Pre-check messages are verbose** — "Pre-check KiCad Project: No circuit design with instances found." could be shortened to "Needs circuit components" with a link to the Schematic view.
- **Quick Export Profiles** — "Fab Ready, Sim Bundle, Documentation, Full Package" — great feature but no visual distinction between them. Add icons or color-coded borders.
- **Import Design section** — At the bottom of the exports view. Consider moving it to a separate "Import" tab or putting it at the top since import typically comes before export.

### Tiny Details
- **Format categories** — "Schematic & Netlist, PCB Fabrication, Documentation & BOM, 3D & CAD, Firmware" — all expanded by default. If you have 17 formats, this is a lot of scrolling. Consider collapsing all but the first, or adding a search.
- **File extension labels** — ".kicad_sch / .kicad_pcb / .kicad_pro" is informative but long. Show on hover, not inline.
- **"Compare with File" button** — In the Import section, next to "Choose File to Import". Not clear what it compares against. Add a tooltip.

---

## 14. Global Features

### High Impact
- **Command palette uses Ctrl+Shift+P** — Industry standard is Ctrl+K (VS Code, Figma, Linear, Notion). Consider supporting both Ctrl+K AND Ctrl+Shift+P, or swap them.
- **No global search** — Ctrl+K opens UnifiedComponentSearch (parts only). A true global search that finds views, components, BOM items, chat messages, and settings would be powerful.

### Medium Impact
- **Keyboard shortcuts overlay** — Shows context-aware shortcuts but lacks a "Customize shortcuts" link. The shortcut customization system exists (Wave 30) but there's no UI to access it.
- **What's New panel** — Parses CHANGELOG.md which is great, but the changelog may not be user-friendly (it's developer-oriented). Consider a curated "Feature highlights" format.
- **Theme toggle** — Only switches between light and dark. The oled-black and high-contrast themes aren't accessible from the toggle — only from settings.

### Tiny Details
- **Notification region** — "Notifications (F8)" region exists but F8 shortcut isn't documented in the shortcuts overlay.
- **"1 collaborator online" badge** — Shows even in single-user mode. If collaboration isn't actively used, this badge is noise.
- **Toolbar icon buttons** — Several toolbar buttons have no labels (uid shows just "button" without aria-label). These are accessibility gaps.

---

## 15. Overall UX Polish

### High Impact
- **No onboarding for power features** — The Getting Started checklist covers basics (create project, add node, export) but doesn't introduce the AI chat, simulation, Arduino workbench, or circuit code — the features that make ProtoPulse unique. Consider a "Pro Features Tour" that unlocks after the basic checklist.
- **No dark/light mode preview** — Theme switch is instantaneous with no preview. A split-screen preview or a small tooltip showing the other theme would help users decide.
- **No keyboard shortcut cheat sheet** — The `?` overlay exists but isn't printable or exportable. A PDF/image version would be useful.

### Medium Impact
- **Empty states are inconsistent** — Some views (Schematic) have rich empty states with icons and CTA buttons. Others (Dashboard, PCB) show skeleton loaders that never resolve to content. Standardize: every view should have a clear empty state with guidance.
- **Toast notifications** — Use sonner but toasts disappear quickly (3-5 seconds). Important toasts (errors, export completion) should persist until dismissed.
- **Loading states** — Some views show `ViewLoadingFallback` (skeleton). Others show blank space. Standardize to a consistent loading pattern.

### Tiny Details
- **Font inconsistency** — Monospace used in code editors and some badges, but the font stack varies. Ensure all monospace uses the same font.
- **Scrollbar styling** — Custom scrollbars in some panels (chat) but native scrollbars in others (sidebar, BOM table). Standardize.
- **Focus ring visibility** — Most interactive elements have `focus-visible:ring-2 focus-visible:ring-ring` but the ring color (cyan) can be hard to see on the dark background on some monitors.
- **Transition durations** — Mix of `transition-colors` (150ms default) and no transitions. Buttons that change state should all have consistent transition timing.
- **Tooltip delays** — StyledTooltip has a delay but it varies. Some tooltips appear instantly, others take 200ms. Standardize to 200ms.
- **No favicon** — The browser tab shows a generic React/Vite favicon. Add a ProtoPulse-branded favicon.
- **Page title** — Always shows "ProtoPulse" regardless of the active view. Should show "Schematic — ProtoPulse" or "Audio Amplifier — ProtoPulse" for better tab identification.
- **No breadcrumb in the page title** — The document title doesn't include the project name or view, making it hard to identify tabs when multiple projects are open.

---

## Summary by Priority

| Priority | Count | Examples |
|----------|-------|---------|
| **High Impact** | 18 | Tab overflow, global search, auto-layout, BOM auto-populate, onboarding tour, deep link fix |
| **Medium Impact** | 35 | Sidebar skeleton, chat cleanup, export pre-check UX, empty states, component search aliases |
| **Tiny Details** | 42 | Tooltips, timestamps, badge styling, scrollbar consistency, favicon, page title |
| **Total** | **95** | |

---

## Top 10 Quick Wins (high impact, low effort)

1. **Page title with project name + view** — 1 line change in ProjectWorkspace
2. **Dedup recently used components** in Asset Library
3. **Auto-fit canvas on load** for Architecture view
4. **"Gemini Gemini" duplicate** in chat model display
5. **Hide "v1" badge** in project cards if versioning isn't functional
6. **Expand first analysis type** in Simulation view by default
7. **Add favicon** — drop a .ico/.svg in public/
8. **Format tooltip for "Push to PCB" button** — "No components to push" when empty
9. **Add "5 min read" to Knowledge Hub articles**
10. **Pre-fill simulation defaults** (Transient: 0-10ms, AC: 1Hz-1MHz)
