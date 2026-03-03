# ProtoPulse Visual Audit Checklist

> Generated: 2026-02-28
> Source: docs/audit-screenshots/2026-02-28-full-catalog/
> Method: Screenshot-by-screenshot analysis of every captured UI surface
> Status: COMPLETE

## Evaluation Criteria

Each screenshot is evaluated against:

- **Layout**: Spacing, alignment, proportions, overflow, clipping
- **Typography**: Font sizes, weights, hierarchy, readability, truncation
- **Color/Contrast**: WCAG AA compliance, visual hierarchy, consistency
- **Components**: shadcn/ui consistency, interaction affordance, states
- **Responsiveness**: Breakpoint behavior, content reflow, touch targets
- **Polish**: Micro-interactions, empty states, loading, error handling
- **Accessibility**: Labels, focus indicators, ARIA, keyboard navigation
- **UX**: Information density, cognitive load, discoverability, flow

## Legend

- [ ] = Not yet reviewed
- [x] = Reviewed, no issues
- [!] = Issue found (see details)
- Priority: P0 (critical) / P1 (high) / P2 (medium) / P3 (low/polish)

---

## Section 1: App Shell (01-app-shell/)

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 001_full-app-default_3-panel_1920x1080.png | Full app, 3-panel layout, 1920x1080 | [!] |
| 2 | 001_full-app-default.png | Full app default (data loaded) | [!] |
| 3 | 002_full-app-default_3-panel_fullpage_1920x1080.png | Full page scroll capture | [x] |
| 4 | 002_full-app-fullpage.png | Full page (larger capture) | [x] |
| 5 | 003_el_header-branding.png | Header branding element | [!] |
| 6 | 004_el_tab-bar.png | Tab bar element | [!] |
| 7 | 005_el_tab-output.png | Output tab element | [!] |
| 8 | 006_el_tab-architecture.png | Architecture tab element | [x] |
| 9 | 007_el_tab-component_editor.png | Component Editor tab element | [x] |
| 10 | 008_el_tab-schematic.png | Schematic tab element | [x] |
| 11 | 009_el_tab-breadboard.png | Breadboard tab element | [x] |
| 12 | 010_el_tab-pcb.png | PCB tab element | [x] |
| 13 | 011_el_tab-procurement.png | Procurement tab element | [x] |
| 14 | 012_el_tab-validation.png | Validation tab element | [x] |
| 15 | 013_el_btn-toggle-sidebar.png | Sidebar toggle button | [!] |
| 16 | 014_el_btn-toggle-chat.png | Chat toggle button | [!] |
| 17 | 015_el_skip-to-main.png | Skip to main content link | [x] |

### Findings

#### AS-01: Bare loading spinner in main content area [P1]

**Screenshot:** 001_full-app-default_3-panel_1920x1080.png
**Location:** `ProjectWorkspace.tsx:77-83` — `ViewLoadingFallback`
**What:** The architecture view shows a tiny `w-8 h-8` CSS spinner (32px) centered in the entire main content area. No loading text, no skeleton, no progress indication. The user sees a small cyan ring spinning in a vast dark void.
**Why it matters:** This is the **first thing users see** when they open a project. A blank screen with a tiny spinner signals "broken" or "empty" — not "loading." The spinner has no context about what is loading or how long to expect.
**Code:**

```tsx
function ViewLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
    </div>
  );
}
```

**Fix:** Replace with a skeleton layout showing the approximate shape of what will render (diagram canvas placeholder with pulsing rectangles), or at minimum add "Loading architecture..." text below the spinner. Consider:

- Skeleton with pulsing node placeholders (3-4 rounded rectangles with connector lines)
- Text label: `text-sm text-muted-foreground mt-3` — "Loading view..."
- Slight background differentiation for the content area (e.g., `bg-card/50`)

---

#### AS-02: "Output" tab is positioned first in tab bar [P1]

**Screenshot:** 004_el_tab-bar.png, 005_el_tab-output.png
**Location:** `ProjectWorkspace.tsx:124-134` — `tabs` array
**What:** Tab order is: Output, Architecture, Component Editor, Schematic, Breadboard, PCB, Procurement, Validation. "Output" (a console/log view) occupies the most prominent leftmost position — the spot users' eyes go to first.
**Why it matters:** Every major EDA tool (KiCad, Altium, Eagle, Figma) puts the primary design view first. "Output" is a secondary/debug view. Having it first:

- Confuses new users about the app's primary purpose
- Wastes prime nav real estate on a low-priority view
- Breaks the established mental model: leftmost = primary
**Fix:** Reorder tabs to reflect the design workflow: Architecture, Schematic, Component Editor, Breadboard, PCB, Procurement, Validation, Output. The natural flow follows how a hardware engineer works: design architecture → draw schematic → edit components → prototype on breadboard → lay out PCB → procure parts → validate → review output/logs.

---

#### AS-03: Header branding element has no data-testid [P2]

**Screenshot:** 003_el_header-branding.png (94 bytes — blank/invisible)
**Location:** `SidebarHeader.tsx:10-17`
**What:** The screenshot captured a near-invisible element because `data-testid="header-branding"` does not exist in the codebase. The actual branding element (Layers icon + "ProtoPulse" + "SYSTEM ARCHITECT") in `SidebarHeader.tsx` has no `data-testid`.
**Why it matters:** Untestable element. Both the screenshot catalog script AND any future automated testing can't reliably target the branding. The captured image (94 bytes of dark pixels) is useless.
**Fix:**

1. Add `data-testid="header-branding"` to the sidebar header `<div>` in `SidebarHeader.tsx`
2. Update screenshot script to use correct testid
3. Re-capture

---

#### AS-04: Sidebar and chat toggle buttons are too small and low-contrast [P2]

**Screenshots:** 013_el_btn-toggle-sidebar.png, 014_el_btn-toggle-chat.png
**Location:** `ProjectWorkspace.tsx:187-196` (sidebar), `ProjectWorkspace.tsx:223-232` (chat)
**What:** Both toggle buttons use `w-4 h-4` icons (16px) with `p-1.5` padding, creating ~28px touch targets. The icons use `text-muted-foreground` (low-contrast gray) against the dark tab bar background. The panel-collapse/expand icon metaphor isn't universally understood.
**Why it matters:** These are **frequently used controls** — users toggle panels many times per session. At 28px, the buttons are:

- Below the 44px minimum recommended touch target (WCAG 2.5.8)
- Hard to see against the dark background
- Hard to identify at a glance (icon metaphor unclear)
**Fix:** Bump to `w-5 h-5` icon (20px) with `p-2` padding (40px total target). Add a subtle hover background that's more prominent (`hover:bg-muted/50`). Consider adding a `border border-border/50` for definition, or a subtle `bg-muted/20` resting state.

---

#### AS-05: Tab overflow has no scroll indicator [P2]

**Screenshot:** 004_el_tab-bar.png
**Location:** `ProjectWorkspace.tsx:197-221` — tab bar container
**What:** 8 tabs with icons + text in a horizontal bar. The container uses `overflow-x-auto` with `no-scrollbar` CSS class. At desktop widths below ~1400px, tabs will overflow with **no visual affordance** indicating more content exists (no scroll arrows, no fade gradient, no ellipsis).
**Why it matters:** Users at 1366x768 or 1280x720 (common laptop resolutions) may not discover that Procurement and Validation tabs exist. Hidden functionality = lost functionality.
**Fix options (pick one):**

- **Fade gradient:** Add `before:` and `after:` gradient overlays at left/right edges when scrollable
- **Scroll arrows:** Add `<` `>` icon buttons at edges
- **Responsive collapse:** At smaller widths, collapse to icon-only tabs (remove text, keep icons + tooltip)
- **Overflow menu:** After N visible tabs, show "..." dropdown for remaining

---

#### AS-06: Chat quick actions bar has no scroll affordance [P2]

**Screenshot:** 001_full-app-default_3-panel_1920x1080.png (visible at chat bottom)
**Location:** `QuickActionsBar.tsx:14-29`
**What:** 7 quick action buttons ("Generate Architecture", "Optimize BOM", "Run Validation", "Add MCU Node", "Project Summary", "Show Help", "Export BOM CSV") in a horizontally-scrollable container with `overflow-x-auto no-scrollbar`. At the default chat width, the last 2-3 buttons are hidden off-screen.
**Why it matters:** Same as AS-05 — hidden buttons mean users may never discover features like "Export BOM CSV" or "Show Help". The "Run..." truncation visible in the screenshot compounds the confusion.
**Fix:** Add a fade gradient on the right edge, or wrap to 2 rows instead of horizontal scroll. Given these are important discovery mechanisms for new users, **wrapping to multiple rows** (`flex-wrap gap-1.5`) may be better than scrolling.

---

#### AS-07: "Local Mode (No API Key)" status lacks guidance [P2]

**Screenshot:** 001_full-app-default_3-panel_1920x1080.png (chat panel bottom)
**Location:** Chat panel footer area
**What:** The text "Local Mode (No API Key)" appears at the very bottom of the chat panel in small gray text. It indicates AI features won't work, but provides no link, button, or instructions for how to fix it.
**Why it matters:** New users see an AI chat panel that won't respond. The status text tells them something is missing but doesn't help them solve it. This is a **dead-end UX** — the user is stuck without external guidance.
**Fix:** Make it an actionable link or button: "Local Mode — Add API Key" that either opens the settings panel or shows a setup guide. Consider a subtle yellow/amber color to signal "needs attention" without being alarming.

---

#### AS-08: No project context when sidebar is collapsed [P2]

**Screenshot:** 001_full-app-default_3-panel_1920x1080.png
**Location:** `ProjectWorkspace.tsx` — main content area header
**What:** The project name "Smart_Agro_Node_v1" appears only in the sidebar's Project Explorer. If the sidebar is collapsed (which is a primary use case when working on the architecture canvas), the user loses all context about which project they're in.
**Why it matters:** Orientation. "Where am I?" is a fundamental UX question. When the sidebar is collapsed, there's zero project identification in the viewport — just tabs and content.
**Fix:** Add a subtle project name breadcrumb or indicator in the tab bar area. Could be as simple as the project name to the right of the sidebar toggle button, styled as `text-xs text-muted-foreground truncate max-w-[200px]`.

---

#### AS-09: Timeline count notation inconsistent with tree counts [P3]

**Screenshot:** 001_full-app-default_3-panel_1920x1080.png (sidebar)
**Location:** Sidebar — Timeline header vs. Blocks tree
**What:** Timeline shows "TIMELINE (4)" with parenthetical count. The Blocks tree shows "Blocks 5" (no parentheses). The MCU/Sensors/Power/Communications/Connectors categories each show a plain "1". Three different count display patterns in the same sidebar.
**Fix:** Pick one convention and use it everywhere. Recommendation: all counters use the same `text-xs text-muted-foreground` badge style, either all parenthetical or all plain.

---

#### AS-10: Tab text size is small at `text-xs` (12px) [P3]

**Screenshots:** 005 through 012 (individual tab elements)
**Location:** `ProjectWorkspace.tsx:208` — tab className
**What:** Tab labels use `text-xs` (12px). For primary navigation that users reference constantly, this is at the lower end of comfortable reading size.
**Fix:** Consider `text-[13px]` or keeping `text-xs` but ensuring sufficient icon + padding size compensates. Not urgent — the 2x retina captures make these look smaller than they appear on-screen.

---

#### AS-11: Inactive tab icon visual weight varies [P3]

**Screenshots:** 005 through 012 (individual tab elements)
**What:** Looking at the individual tab captures, icons like `LayoutGrid` (Architecture) and `Grid3X3` (Breadboard) have more visual density/weight than `Microchip` (PCB) or `Activity` (Validation). The PCB tab appears lighter/thinner than adjacent tabs.
**Fix:** Low priority. Lucide icons are designed for consistency, but at `w-4 h-4` with `text-muted-foreground`, subtle weight differences emerge. Could normalize by adjusting `stroke-width` on specific icons, but this is marginal.

---

#### AS-12: Active tab styling is clean but top accent is subtle [P3]

**Screenshot:** 006_el_tab-architecture.png
**Location:** `ProjectWorkspace.tsx:208-213`
**What:** Active tab has a 2px primary-colored top bar via `before:` pseudo-element, plus `bg-card` background and `text-primary` color. The overall treatment is clean, but the 2px top bar (`before:h-[2px]`) is subtle relative to the visual density of the tab bar.
**Fix:** Optional: bump to `before:h-[3px]` for slightly more presence. Or add `rounded-t-sm` to the pseudo-element for a softer accent. Current treatment is perfectly functional — this is pure polish.

---

#### AS-13: Skip-to-main link implementation is correct [No Issue]

**Screenshot:** 015_el_skip-to-main.png (correctly invisible at rest)
**Location:** `ProjectWorkspace.tsx:141-143`
**What:** Uses `sr-only focus:not-sr-only` with proper `focus:` styling (primary bg, z-50, absolute positioning). Invisible by default, visible on keyboard focus. This is the textbook correct implementation.
**Status:** Pass. Good accessibility practice.

---

#### AS-14: Chat panel header icons are small and unlabeled [P3]

**Screenshot:** 001_full-app-default_3-panel_1920x1080.png (chat panel top-right)
**What:** The chat header "ProtoPulse AI" has 3 small icon buttons (search, download, settings) that are the same `w-4 h-4` size. Their function isn't obvious without hovering for tooltips.
**Fix:** Low priority since tooltips exist. Could add visible labels on wider chat widths or slightly increase icon size.

---

### Section 1 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 2 | AS-01, AS-02 |
| P2 (Medium) | 5 | AS-03, AS-04, AS-05, AS-06, AS-07, AS-08 |
| P3 (Polish) | 5 | AS-09, AS-10, AS-11, AS-12, AS-14 |
| Pass | 2 | AS-13, fullpage captures |
| **Total** | **14** | |

---

## Section 2: Sidebar (02-sidebar/)

### Screenshots Reviewed

**Viewport captures (12):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 003_sidebar-expanded_default_1920x1080.png | Default expanded sidebar | [x] |
| 2 | 004_sidebar-block-category-expanded_mcu_1920x1080.png | MCU category selected | [x] |
| 3 | 005_sidebar-block-node-selected_1920x1080.png | Node selected in tree | [x] |
| 4 | 006_sidebar-timeline-filter-user_1920x1080.png | User filter active | [x] |
| 5 | 007_sidebar-timeline-filter-ai_1920x1080.png | AI filter active | [x] |
| 6 | 008_sidebar-timeline-filter-all_1920x1080.png | All filter active | [x] |
| 7 | 009_sidebar-project-settings-open_1920x1080.png | Settings expanded | [!] |
| 8 | 010_sidebar-collapsed_icon-only_1920x1080.png | Collapsed sidebar | [!] |
| 9 | 011_sidebar-re-expanded_1920x1080.png | Re-expanded sidebar | [x] |
| 10 | 012_sidebar-search-active_esp_1920x1080.png | Search filtering "ESP" | [x] |
| 11 | 016_sidebar-expanded-default.png | Higher-res default state | [x] |
| 12 | 042_sidebar-settings-open.png | Settings open (higher-res) | [!] |
| 13 | 045_sidebar-search-active.png | Search active (higher-res) | [x] |
| 14 | 046_sidebar-collapsed.png | Collapsed (higher-res) | [!] |

**Element captures (22):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 15 | 017_el_sidebar-search.png | Search input | [x] |
| 16 | 018_el_inline-edit-name.png | Project name inline edit | [x] |
| 17 | 019_el_block-category-mcu.png | MCU category row | [x] |
| 18 | 020_el_block-category-sensor.png | Sensors category row | [x] |
| 19 | 021_el_block-category-power.png | Power category row | [x] |
| 20 | 022_el_block-category-comm.png | Communications category row | [x] |
| 21 | 023_el_block-category-connector.png | Connectors category row | [x] |
| 22 | 024_el_block-node-1.png | ESP32-S3-WROOM-1 node | [x] |
| 23 | 025_el_block-node-2.png | TP4056 PMU node | [x] |
| 24 | 026_el_block-node-3.png | SX1262 LoRa node | [x] |
| 25 | 027_el_block-node-4.png | SHT40 node | [x] |
| 26 | 028_el_block-node-5.png | USB-C Connector node | [x] |
| 27 | 029_el_timeline-filter-all.png | "All" filter button (active) | [!] |
| 28 | 030_el_timeline-filter-user.png | "User" filter button | [!] |
| 29 | 031_el_timeline-filter-ai.png | "AI" filter button | [!] |
| 30 | 032_el_timeline-item-1.png | "Project Created" entry | [x] |
| 31 | 033_el_timeline-undo-1.png | Undo button 1 | [!] |
| 32 | 034_el_timeline-item-2.png | "Added ESP32-S3" entry | [x] |
| 33 | 035_el_timeline-undo-2.png | Undo button 2 | [!] |
| 34 | 036_el_timeline-item-3.png | "Auto-connected Power Rails" | [x] |
| 35 | 037_el_timeline-undo-3.png | Undo button 3 | [!] |
| 36 | 038_el_timeline-item-4.png | "Added mcu node: the arduino..." | [!] |
| 37 | 039_el_timeline-undo-4.png | Undo button 4 | [!] |
| 38 | 040_el_timeline-live-indicator.png | Timeline live indicator | [!] |
| 39 | 041_el_btn-project-settings.png | Project Settings button | [!] |
| 40 | 043_el_settings-project-name-input.png | Project name input field | [x] |
| 41 | 044_el_settings-description-textarea.png | Description textarea | [x] |
| 42 | 047_el_sidebar-icon-architecture.png | Collapsed: Architecture icon | [x] |
| 43 | 048_el_sidebar-icon-component-editor.png | Collapsed: Comp. Editor icon | [x] |
| 44 | 049_el_sidebar-icon-procurement.png | Collapsed: Procurement icon | [x] |
| 45 | 050_el_sidebar-icon-validation.png | Collapsed: Validation icon | [x] |
| 46 | 051_el_sidebar-icon-output.png | Collapsed: Output icon | [x] |

### Findings

#### SB-01: Timeline undo buttons are invisible — zero discoverability [P1]

**Screenshots:** 033, 035, 037, 039 (all 116 bytes — blank/near-invisible)
**What:** All 4 timeline undo button captures produced blank images. The undo buttons are either not rendered at all, or only appear on hover over the parent timeline item. Playwright's element screenshot captured nothing.
**Why it matters:** Undo is a **critical user action**. If undo buttons only appear on hover:

- Users don't know undo exists
- Mobile/touch users can never access them (no hover)
- Keyboard-only users have no path to undo
- The feature is functionally invisible to most users
**Fix:** Show undo buttons persistently (not hover-only). Use a small but visible icon (e.g., `Undo2` from lucide-react at `w-3.5 h-3.5`) next to each timeline entry's timestamp. Alternatively, add an undo keyboard shortcut (Ctrl+Z) with visual indicator in the timeline.

---

#### SB-02: Timeline entry text truncation with no expand mechanism [P2]

**Screenshot:** 038_el_timeline-item-4.png
**What:** The entry "Added mcu node: the arduino ..." is truncated with ellipsis. There's no visible tooltip, click-to-expand, or "show more" affordance to reveal the full text.
**Why it matters:** Truncated text without recovery is information loss. Users can't see what was actually added, which defeats the purpose of an action history. This becomes worse as AI generates longer action descriptions.
**Fix options:**

- **Tooltip on hover** showing full text (quick win)
- **Click/tap to expand** the truncated entry inline
- **Increase max-width** or allow text to wrap to 2 lines before truncating

---

#### SB-03: Collapsed sidebar doesn't show a navigation rail [P2]

**Screenshots:** 010_sidebar-collapsed_icon-only_1920x1080.png, 046_sidebar-collapsed.png
**What:** When the sidebar collapses, the "Asset Library" panel (a canvas overlay on the architecture view) becomes the dominant left-side element. The collapsed sidebar itself shows small component icons from the tree, but there's no clear icon-only nav rail like VS Code, Figma, or other tool-based UIs use.
**Why it matters:** Users expect collapsed sidebars to show recognizable icon shortcuts for quick navigation. The current collapsed state is confusing — it's unclear what the small icons represent or how to navigate. The Asset Library overlay competing for the same left-side space creates visual confusion about what's the sidebar vs. what's the canvas.
**Fix:** When collapsed, show a clean vertical icon rail with: Project Explorer icon, Timeline icon, Settings icon. Each icon should open the sidebar to that section on click. Consider hiding/minimizing the Asset Library overlay when sidebar is collapsed to reduce visual competition.

---

#### SB-04: Project Settings section has no visual boundary [P2]

**Screenshots:** 009_sidebar-project-settings-open_1920x1080.png, 042_sidebar-settings-open.png
**What:** The Project Settings section expands at the bottom of the sidebar, pushing tree/timeline content upward. There's no clear visual separator (no border, no background change, no divider) between the end of the timeline and the beginning of the settings area. The only distinction is the "Project Settings" button itself.
**Why it matters:** Users scrolling the sidebar may not realize they've transitioned from timeline to settings. The mental model of "sidebar sections" gets muddled.
**Fix:** Add a `border-t border-border` divider above the Project Settings section. Consider giving the settings area a slightly different background (`bg-muted/10`) to visually distinguish it as a separate panel.

---

#### SB-05: Timeline filter buttons are undersized with low active/inactive contrast [P2]

**Screenshots:** 029_el_timeline-filter-all.png, 030_el_timeline-filter-user.png, 031_el_timeline-filter-ai.png
**What:** The three filter buttons ("All", "User", "AI") are small segmented controls. The active state ("All" with cyan background) is clearly distinguishable, but the inactive states ("User" and "AI") are nearly identical — both are small dark pills with gray text. At a glance, it's hard to tell which filters are available vs. which is selected.
**Why it matters:** Filter controls should make the current selection obvious and the alternatives clearly clickable. The inactive buttons look more like disabled text than interactive controls.
**Fix:** Give inactive buttons a visible border (`border border-border`) and slightly lighter background (`bg-muted/20`) so they read as clickable alternatives rather than decorative text. Consider using an outlined button style for inactive states.

---

#### SB-06: "Project Settings" button position is easy to miss [P2]

**Screenshot:** 041_el_btn-project-settings.png
**What:** "Project Settings" with a gear icon sits at the very bottom of the sidebar in `text-muted-foreground`. It's a full-width button but styled to look like a passive label rather than an interactive control.
**Why it matters:** Project settings (name, description, metadata) are important for project management. The button's passive styling and bottom placement make it easy to overlook, especially if the sidebar content is tall enough to require scrolling.
**Fix:** Add a subtle hover background, a border-top separator from the main sidebar content, or pin it at the bottom of the sidebar (sticky positioning) so it's always visible regardless of scroll position.

---

#### SB-07: Timeline live indicator is functionally invisible [P3]

**Screenshot:** 040_el_timeline-live-indicator.png (177 bytes — barely visible gray bar)
**What:** The timeline "live" indicator appears to be a tiny gray rectangle or progress bar. At 177 bytes and ~1-2px height, it's invisible in normal use.
**Why it matters:** If this is meant to indicate "live updates" or "current position," users will never notice it. It adds DOM weight with zero user value.
**Fix:** Either make it meaningful (animate with a pulse, show a "Live" badge with a green dot) or remove it entirely. A small green dot with "Live" text near the "TIMELINE" header would be more effective.

---

#### SB-08: Block tree nodes lack interactive affordance cues [P3]

**Screenshots:** 024-028 (individual node items)
**What:** Each block node in the tree (ESP32-S3-WROOM-1, SHT40, etc.) shows only a small blue bullet and text. There's no hover preview, no drag handle icon, no right-click indicator, no disclosure arrow to suggest these items are interactive.
**Why it matters:** New users may not discover that clicking a node selects it on the canvas, or that right-clicking opens a context menu, or that dragging is possible. The tree items look like static text labels.
**Fix:** Add a subtle `hover:bg-muted/30` background and consider a right-chevron or "..." icon on hover to hint at available actions. If drag-and-drop is supported, show a grip/drag handle on hover.

---

#### SB-09: Count badge styling is inconsistent across sidebar sections [P3]

**Screenshots:** 019-023 (category rows), viewport captures showing "Blocks 5" and "TIMELINE (4)"
**What:** Three different count display patterns exist:

- Category level: right-aligned plain number "1" in muted color
- "Blocks" section header: "Blocks 5" (space-separated, same line)
- "TIMELINE" section header: "TIMELINE (4)" (parenthetical)
**Fix:** Normalize to one pattern. Recommended: all counts as small `text-xs text-muted-foreground` badges right-aligned in their row, matching the category count pattern.

---

#### SB-10: Search input is functional but visually flat [P3]

**Screenshot:** 017_el_sidebar-search.png
**What:** The search input shows a magnifying glass icon with "Search blocks..." placeholder. It has only a bottom border — no side/top borders, no background differentiation from the sidebar.
**Why it matters:** Minor — the flat styling is consistent with the minimal dark theme. But the input could feel more like an interactive control with slight additional definition.
**Fix:** Optional: Add `bg-muted/10` background to differentiate from surrounding content, or add `rounded` corners with a full border on focus.

---

#### SB-11: Category icons are well-chosen and consistent [No Issue]

**Screenshots:** 019-023 (all category elements)
**What:** MCU (chip), Sensors (pulse), Power (lightning), Communications (radio waves), Connectors (link). Each icon is visually distinct, semantically appropriate, and consistent in size/weight. The expand/collapse chevrons are clear. Count badges align cleanly to the right.
**Status:** Pass. This is well-done design work.

---

#### SB-12: Timeline entries have good visual hierarchy and color coding [No Issue]

**Screenshots:** 032, 034, 036, 038 (timeline items)
**What:** Each timeline entry shows: action icon (green circle-plus for additions, chain-link for connections) + bold action text + actor label (green "User" or gray "AI") + relative timestamp. The color coding immediately distinguishes human vs. AI actions.
**Status:** Pass. Clean, informative, good use of color.

---

#### SB-13: Settings form fields are clean and functional [No Issue]

**Screenshots:** 043_el_settings-project-name-input.png, 044_el_settings-description-textarea.png
**What:** Project name input shows "Smart_Agro_Node_v1" with clear text. Description textarea shows "IoT Agriculture Sensor Node" with good contrast. Both have consistent dark input styling.
**Status:** Pass.

---

### Section 2 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 1 | SB-01 |
| P2 (Medium) | 5 | SB-02, SB-03, SB-04, SB-05, SB-06 |
| P3 (Polish) | 4 | SB-07, SB-08, SB-09, SB-10 |
| Pass | 3 | SB-11, SB-12, SB-13 |
| **Total** | **13** | |

## Section 3: Architecture View (03-architecture/)

### Screenshots Reviewed

**Viewport captures (16):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 013_architecture-default_with-assets_1920x1080.png | Default (loading spinner) | [x] |
| 2 | 014_architecture-asset-filter_mcu_1920x1080.png | MCU filter active | [x] |
| 3 | 015_architecture-asset-filter_power_1920x1080.png | Power filter active | [x] |
| 4 | 016_architecture-asset-filter_comm_1920x1080.png | Comm filter active | [x] |
| 5 | 052_architecture-default.png | Default view (high-res) | [x] |
| 6 | 076_architecture-assets-mcu.png | Asset Library: MCU | [x] |
| 7 | 077_architecture-assets-power.png | Asset Library: Power | [x] |
| 8 | 078_architecture-assets-comm.png | Asset Library: Comm | [x] |
| 9 | 079_architecture-assets-sensor.png | Asset Library: Sensor | [x] |
| 10 | 080_architecture-assets-connector.png | Asset Library: Connector | [x] |
| 11 | 096_architecture-full-canvas.png | Full canvas, no asset panel | [x] |
| 12 | 098_architecture-pan-mode.png | Pan mode active | [!] |
| 13 | 099_architecture-node-selected.png | Node selected (cyan glow) | [x] |
| 14 | 101_architecture-context-menu.png | Right-click context menu | [x] |
| 15 | 103_architecture-fit-view.png | Fit-to-view | [x] |
| 16 | 097_el_rf-canvas-full.png | Canvas element (no chrome) | [x] |

**Asset Library elements (22):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 17 | 053_el_asset-search.png | Search input with "/" hint | [x] |
| 18 | 054_el_asset-sort-btn.png | Sort button (A-Z) | [x] |
| 19 | 055_el_btn-toggle-asset-manager.png | Asset manager toggle | [!] |
| 20 | 056_el_btn-add-custom-part.png | "+ Add Custom Part" button | [x] |
| 21 | 057_el_asset-category-all.png | "All" category filter | [!] |
| 22 | 058_el_asset-category-mcu.png | MCU category filter | [!] |
| 23 | 059_el_asset-category-power.png | Power category filter | [!] |
| 24 | 060_el_asset-category-comm.png | Comm category filter | [!] |
| 25 | 061_el_asset-category-sensor.png | Sensor category filter | [!] |
| 26 | 062_el_asset-category-connector.png | Connector category filter | [!] |
| 27 | 063_el_asset-item-1.png | ESP32-S3-WROOM-1 (on canvas) | [!] |
| 28 | 064_el_asset-item-2.png | STM32L432KC | [x] |
| 29 | 065_el_asset-item-3.png | TP4056 (on canvas) | [x] |
| 30 | 066_el_asset-item-4.png | SIM7000G | [!] |
| 31 | 067-074 (8 items) | Various asset items | [x] |
| 32 | 075_el_btn-add-asset-to-canvas.png | Add-to-canvas button | [!] |

**Canvas tools (6):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 33 | 081_el_tool-select.png | Select tool (cyan/active) | [!] |
| 34 | 082_el_tool-pan.png | Pan tool (gray/inactive) | [!] |
| 35 | 083_el_tool-grid.png | Grid toggle (cyan) | [!] |
| 36 | 084_el_tool-fit.png | Fit-to-view button | [!] |
| 37 | 085_el_rf-controls.png | React Flow zoom controls | [x] |
| 38 | 086_el_rf-minimap.png | Canvas minimap | [x] |

**Architecture nodes (6):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 39 | 087_el_arch-node-1.png | ESP32-S3-WROOM-1 | [x] |
| 40 | 088_el_arch-node-2.png | TP4056 PMU | [!] |
| 41 | 089_el_arch-node-3.png | SX1262 LoRa | [x] |
| 42 | 090_el_arch-node-4.png | SHT40 | [x] |
| 43 | 091_el_arch-node-5.png | USB-C Connector | [!] |
| 44 | 100_el_arch-node-selected-detail.png | Selected state (cyan glow) | [x] |

**Edges & context menu (5):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 45 | 092_el_arch-edge-e5-2.png | 5V VBUS edge (red dashed) | [x] |
| 46 | 093_el_arch-edge-e2-1.png | 3.3V edge (red) + I2C (cyan) | [!] |
| 47 | 094_el_arch-edge-e1-3.png | SPI edge | [x] |
| 48 | 095_el_arch-edge-e1-4.png | I2C edge | [x] |
| 49 | 102_el_context-menu.png | Node context menu | [x] |

### Findings

#### AV-01: "Add to canvas" button is hover-only — invisible to most users [P1]

**Screenshot:** 075_el_btn-add-asset-to-canvas.png (354 bytes — near-invisible)
**Location:** `AssetGrid.tsx:162-169`
**What:** The primary "add asset to canvas" action on each asset item uses `opacity-0 group-hover:opacity-100` — it's completely invisible until the user hovers over the asset row. The Playwright capture produced a near-blank image because there's nothing visible at rest.
**Code:**

```tsx
// opacity-0 group-hover:opacity-100 — invisible at rest
<button data-testid={`button-add-asset-${asset.id}`}
  className="opacity-0 group-hover:opacity-100 ..." />
```

**Why it matters:** This is the **primary action** in the Asset Library — the whole point of browsing parts is to add them to your design. Making it hover-only means:

- Mobile/touch users cannot add assets at all (no hover on touch)
- New users browsing the library won't discover how to add parts
- The expanded detail card and context menu DO have visible add buttons, but users must know to click-to-expand or right-click first
**Fix:** Show the add button persistently with reduced opacity (`opacity-50 group-hover:opacity-100`) or as a small always-visible `+` icon at the right edge of each asset row. The dashed-border "+ Add Custom Part" button (056) proves persistent add affordance works well in this UI.

---

#### AV-02: Asset Library category filter icons are too small to identify [P2]

**Screenshots:** 057-062 (all ~24px squares with tiny icons)
**Location:** `AssetManager.tsx` — category filter buttons
**What:** Each category filter is a ~24px square icon with a count badge. At this size, the icon details (chip, lightning bolt, radio waves, etc.) are nearly impossible to distinguish. The "All" category (057) is recognizable as a grid pattern, but MCU vs. Sensor vs. Connector are ambiguous without hovering for tooltips.
**Why it matters:** Category filtering is fundamental to the asset browsing workflow. If users can't tell which filter is which without hovering, they'll click randomly or give up and scroll the full list. This slows down a core workflow.
**Fix options:**

- Add text labels below or beside each icon: "All", "MCU", "Power", "Comm", "Sensor", "Conn"
- Increase icon size to at least 32px where the details become legible
- Use a horizontal pill-style segmented control with icon + text (similar to the timeline filters but larger)

---

#### AV-03: Asset Library panel obscures canvas nodes positioned behind it [P2]

**Screenshots:** 088_el_arch-node-2.png, 091_el_arch-node-5.png, 092_el_arch-edge-e5-2.png
**Location:** `AssetManager.tsx:175` — `md:absolute md:top-4 md:left-4`
**What:** The Asset Library is a floating overlay positioned at the top-left of the canvas. Architecture nodes positioned near the left edge of the canvas are partially or fully obscured by this panel. Screenshots 088 and 091 show asset library text (part names, star/add icons, descriptions) bleeding into node element captures because the panel overlaps those canvas areas. The panel HAS a resize handle, but users must discover it.
**Why it matters:** Users may not realize their nodes are hidden behind the panel, especially if they were placed there by AI-generated architecture. Critical information (connections, labels) becomes invisible.
**Fix:** When the Asset Library is open, shift the canvas viewport to the right to avoid overlap, or auto-fit the view to the visible canvas area. Consider adding a "minimize" mode that collapses the panel to just the category filter bar.

---

#### AV-04: Pan mode vs. select mode is visually indistinguishable in screenshots [P2]

**Screenshots:** 096_architecture-full-canvas.png vs 098_architecture-pan-mode.png
**Location:** Canvas toolbar
**What:** The full-canvas and pan-mode screenshots are virtually identical. While the code does change the cursor to `grabbing` and highlights the active tool button with `bg-primary/20`, neither of these cues is visible at the viewport level. Users looking at the canvas (not staring at the tiny toolbar) won't know which mode they're in.
**Why it matters:** Mode confusion is a classic UX problem in drawing/diagramming tools. Users in pan mode may try to select nodes and wonder why clicking drags the canvas instead. This creates frustration, especially for users coming from non-modal tools.
**Fix:** Add a visible mode indicator beyond just the toolbar button highlight:

- Show the mode name near the cursor: "Pan" or "Select" as a small floating label on mode switch (auto-dismiss after 1.5s)
- Change canvas background subtly (slightly lighter grid when in pan mode)
- Show a small status badge in the toolbar: "Mode: Pan" or "Mode: Select"

---

#### AV-05: Canvas toolbar icons are small and unlabeled [P2]

**Screenshots:** 081-084 (individual tool buttons, each ~28px)
**Location:** Architecture view toolbar
**What:** The select (cursor), pan (cross-arrows), grid (grid icon), and fit (brackets) tool buttons are each `w-4 h-4` (16px icon) with `p-1.5` padding (~28px total). No text labels, no keyboard shortcut hints visible. The tools are essential for canvas interaction but are visually minimal.
**Why it matters:** Same pattern as AS-04 (sidebar/chat toggles) — small, low-contrast, unlabeled buttons for frequently-used actions. New users may not recognize what each icon does without trial-and-error.
**Fix:** Add tooltips with keyboard shortcuts (e.g., "Select (V)", "Pan (H)", "Toggle Grid (G)", "Fit View (F)"). Consider bumping to `w-5 h-5` icons. If space allows, add a visible keyboard shortcut hint below the icon.

---

#### AV-06: Edge color coding has no legend or explanation [P2]

**Screenshots:** 092 (red dashed — 5V VBUS), 093 (red dashed — 3.3V, cyan dashed — I2C)
**Location:** Architecture view canvas
**What:** Power connections use red dashed lines (5V VBUS, 3.3V) and data connections use cyan dashed lines (SPI, I2C). This is meaningful and well-chosen, but there's no legend, tooltip, or onboarding hint explaining what the colors mean.
**Why it matters:** Color coding only works if users understand the code. Without a legend, the colors are decorative rather than informative. Users may think the colors are arbitrary or based on which component they connect.
**Fix:** Add a small collapsible legend in the canvas toolbar area or bottom-right corner:

- Red dashed = Power
- Cyan dashed = Data/Signal
- (Future: Green = Ground, Amber = Bus)

Or add a tooltip on edge hover showing the connection type alongside the label.

---

#### AV-07: Asset manager toggle button is tiny and ambiguous [P2]

**Screenshot:** 055_el_btn-toggle-asset-manager.png (~24px, icon only)
**What:** The Asset Manager toggle is a small diamond/grid icon with no label. It's the same size and visual weight as the other toolbar icons. Users may not realize this button opens/closes the entire Asset Library panel.
**Fix:** Make it slightly larger than other toolbar icons (since it controls panel visibility, not a tool mode) and add "Assets" text label or use a clearly different visual treatment (e.g., bordered button vs. plain icon).

---

#### AV-08: Asset items show canvas content bleeding through panel [P3]

**Screenshots:** 063_el_asset-item-1.png, 066_el_asset-item-4.png
**What:** Several asset item element captures show canvas node text (component names, category labels, star/plus icons) visible behind the Asset Library panel. This suggests the panel's backdrop may not fully occlude the canvas content in certain conditions, or the glass-morphism blur isn't dense enough.
**Why it matters:** Visual noise. The bleed-through makes asset item text harder to read and creates a cluttered appearance. This may be a screenshot capture artifact (z-index stacking), but worth verifying in the live app.
**Fix:** Verify in the live app. If bleed-through occurs in real use, increase the panel's `bg-opacity` or add `backdrop-blur-lg` to fully obscure the canvas behind it.

---

#### AV-09: Context menu lacks keyboard shortcut hints [P3]

**Screenshot:** 102_el_context-menu.png
**What:** The context menu shows: Copy Label, Duplicate Node, Search Datasheet, Change Type >, Delete Node. Clean layout with good section dividers and red text for the destructive action. However, no keyboard shortcuts are shown (e.g., "Ctrl+C" next to Copy Label, "Del" next to Delete Node).
**Why it matters:** Power users expect keyboard shortcuts visible in context menus (standard in KiCad, Altium, VS Code, every major tool app). This is how users learn shortcuts organically.
**Fix:** Add right-aligned `text-xs text-muted-foreground` shortcut hints:

```
Copy Label          Ctrl+C
Duplicate Node      Ctrl+D
Search Datasheet    Ctrl+F
Change Type           >
Delete Node            Del
```

---

#### AV-10: Node connection handles are subtle at rest [P3]

**Screenshots:** 087, 089, 090 (node element captures showing gray squares at corners)
**What:** Connection handles are small gray squares at the corners/edges of each node. At rest, they blend into the node border and dark background. They become cyan when the node is selected (100_el_arch-node-selected-detail.png), which is good.
**Fix:** Optional: Add a very subtle glow or slightly increase handle size on canvas hover (not node hover — just when the cursor is near the canvas). Or keep as-is — the current behavior is standard for @xyflow and experienced users expect this pattern.

---

#### AV-11: Node design is clean and information-rich [No Issue]

**Screenshots:** 087, 089, 090 (MCU, COMM, SENSOR nodes)
**What:** Each node shows: category icon (left) + category label (top-right, small caps) + component name (bottom-right, larger). The icon-left, text-right layout provides clear visual hierarchy. Category labels (MCU, COMM, SENSOR, POWER, CONNECTOR) give immediate context. Node borders are subtle but visible.
**Status:** Pass. Well-designed node treatment.

---

#### AV-12: Selected node state is excellent [No Issue]

**Screenshot:** 100_el_arch-node-selected-detail.png
**What:** Selected node has a bright cyan glow border with cyan connection handles. The glow effect clearly communicates selection without overwhelming the design. The node content remains fully readable.
**Status:** Pass. Clean, professional selection indicator.

---

#### AV-13: Search input with keyboard shortcut hint is a nice touch [No Issue]

**Screenshot:** 053_el_asset-search.png — "Search parts... (/)"
**What:** The search placeholder includes the "/" keyboard shortcut hint in parentheses. This follows the established pattern from Slack, GitHub, and other modern tools.
**Status:** Pass.

---

#### AV-14: "+ Add Custom Part" button has good visual affordance [No Issue]

**Screenshot:** 056_el_btn-add-custom-part.png
**What:** Dashed border button with "+" icon and "Add Custom Part" text. The dashed border pattern is a universally recognized "add new" affordance.
**Status:** Pass.

---

#### AV-15: Minimap provides useful canvas overview [No Issue]

**Screenshot:** 086_el_rf-minimap.png
**What:** Shows 5 cyan rectangles representing architecture nodes in their spatial layout. Provides at-a-glance orientation for the canvas. Uses React Flow's built-in minimap component.
**Status:** Pass.

---

#### AV-16: Context menu is well-organized [No Issue]

**Screenshot:** 102_el_context-menu.png
**What:** Actions grouped logically: Copy/Duplicate (creation), Search Datasheet (research), Change Type (modification), Delete (destructive). Red text for Delete Node provides clear destructive action warning. Submenu arrow on Change Type. Clean spacing and dividers.
**Status:** Pass (except keyboard shortcuts — see AV-09).

---

### Section 3 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 1 | AV-01 |
| P2 (Medium) | 6 | AV-02, AV-03, AV-04, AV-05, AV-06, AV-07 |
| P3 (Polish) | 3 | AV-08, AV-09, AV-10 |
| Pass | 6 | AV-11, AV-12, AV-13, AV-14, AV-15, AV-16 |
| **Total** | **16** | |

## Section 4: Component Editor (04-component-editor/)

### Catalog Integrity Note

**CRITICAL: 14 of 16 screenshots in this directory are miscategorized.** Only screenshots 104 and 105 actually show the Component Editor tab. The remaining 14 screenshots capture content from other top-level views:

| Screenshots | Actual View | Correct Section |
|------------|-------------|-----------------|
| 106-107, 112-113 | **Breadboard** (top-level tab) | Section 6 |
| 108-109, 114-115 | **Schematic** (top-level tab) | Section 5 |
| 110-111, 116-117 | **PCB Layout** (top-level tab) | Section 7 |
| 118-119 | **Chat panel quick action buttons** | Section 11 |

Additionally, screenshots 112-117 are **exact duplicates** of 106-111. Six wasted captures.

The confusion likely arose because the Component Editor has internal sub-tabs named "Breadboard", "Schematic", and "PCB" (for editing component *shapes/footprints* per view), and the screenshot script navigated to the top-level Breadboard/Schematic/PCB tabs instead. The Component Editor's actual UI — its parts sidebar, ShapeCanvas with drawing tools, ComponentInspector panel, MetadataForm, PinTable, GeneratorModal — was **never captured**.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 104_component-editor-default.png | Component Editor tab — loading state | [!] |
| 2 | 105_component-editor-fullpage.png | Fullpage — resolved to Architecture view | [!] |
| 3 | 106_component-editor-tab-breadboard.png | **MISCATEGORIZED**: Breadboard top-level tab | [!] |
| 4 | 107_el_editor-content-breadboard.png | **MISCATEGORIZED**: Breadboard content close-up | [!] |
| 5 | 108_component-editor-tab-schematic.png | **MISCATEGORIZED**: Schematic top-level tab | [!] |
| 6 | 109_el_editor-content-schematic.png | **MISCATEGORIZED**: Schematic content close-up | [!] |
| 7 | 110_component-editor-tab-pcb.png | **MISCATEGORIZED**: PCB Layout top-level tab | [!] |
| 8 | 111_el_editor-content-pcb.png | **MISCATEGORIZED**: PCB Layout content close-up | [!] |
| 9 | 112_component-editor-tab-breadboard.png | **DUPLICATE** of 106 | [!] |
| 10 | 113_el_editor-content-breadboard.png | **DUPLICATE** of 107 | [!] |
| 11 | 114_component-editor-tab-schematic.png | **DUPLICATE** of 108 | [!] |
| 12 | 115_el_editor-content-schematic.png | **DUPLICATE** of 109 | [!] |
| 13 | 116_component-editor-tab-pcb.png | **DUPLICATE** of 110 | [!] |
| 14 | 117_el_editor-content-pcb.png | **DUPLICATE** of 111 | [!] |
| 15 | 118_el_btn-generate.png | **MISCATEGORIZED**: Chat quick action "Generate Architecture" | [!] |
| 16 | 119_el_btn-export-component.png | **MISCATEGORIZED**: Chat quick action "Export BOM CSV" | [!] |

### Findings — Component Editor Proper

#### CE-01: Component Editor view was never captured — only loading spinner visible [P0]

**Screenshot:** 104_component-editor-default.png
**Location:** `ComponentEditorView.tsx` → `ComponentEditorProvider` → lazy load chain
**What:** The only actual Component Editor screenshot (104) shows the same bare `ViewLoadingFallback` spinner (small cyan ring centered in vast dark space) documented in AS-01. The Component Editor never rendered its actual UI for the catalog.

**The Component Editor is the most feature-rich view in the application.** Per source code analysis, its actual UI includes:

- Left sidebar with parts list (w-48, part creation, selection)
- 5 sub-tabs: Breadboard, Schematic, PCB, Metadata, Pin Table
- Header toolbar with **12 action buttons**: Generate, AI Modify, Datasheet, Pins, Validate, Export, Publish, Library, Import FZPZ, Import SVG, DRC, History
- Save/Undo/Redo controls with dirty indicator
- ShapeCanvas with 8 drawing tools (Select, Rectangle, Circle, Text, Line, Pin, Measure, Path)
- ComponentInspector panel (position, size, rotation, style, constraints)
- GeneratorModal with quick templates and parametric package generation
- DRC and History side panels

**None of this was captured.** This is the largest audit gap in the entire catalog.

**Why it matters:** The Component Editor is where users create and edit the actual component shapes — the core creative workflow of the EDA tool. Without screenshots of this view, we cannot audit:

- Drawing tool UX and discoverability
- Shape inspector layout and usability
- Generator modal template browsing experience
- Metadata form design
- Pin table ergonomics
- DRC/constraint visualization
- The overall information architecture of a 12-button toolbar

**Root cause:** The screenshot script likely navigated to the "Component Editor" tab but the `ComponentEditorProvider` data wasn't loaded (no parts/circuits existed that would populate the editor). The lazy-loaded content stalled at the loading spinner, and the script proceeded to capture what it could — falling back to the standalone Breadboard/Schematic/PCB views.

**Fix:**

1. Re-run the screenshot catalog with proper setup:
   - Ensure at least one component part exists in the database before capturing
   - Wait for `data-testid="component-editor"` to be present (not just the tab)
   - Capture each sub-tab: `tab-breadboard`, `tab-schematic`, `tab-pcb`, `tab-metadata`, `tab-pin-table`
2. Capture the GeneratorModal (`data-testid="generator-modal"`) by clicking `button-generate`
3. Capture the ComponentInspector with a shape selected
4. Capture empty states for each sub-tab (`placeholder-breadboard`, `placeholder-schematic`, `placeholder-pcb`, `empty-metadata`, `empty-pin-table`)

---

#### CE-02: Fullpage capture resolved to Architecture view instead of Component Editor [P2]

**Screenshot:** 105_component-editor-fullpage.png
**What:** The fullpage capture (105) shows the Architecture view with all 5 nodes, the Asset Library panel, edges, and minimap — not the Component Editor. The screenshot script captured the fullpage after the Component Editor tab's lazy load stalled, and the visible content was the previously-rendered Architecture view bleeding through.
**Fix:** Same as CE-01 — ensure the Component Editor is fully loaded before fullpage capture.

---

#### CE-03: Screenshot catalog miscategorization — 14 of 16 images in wrong directory [P1]

**Screenshots:** 106-119 (all)
**What:** The screenshot catalog placed Breadboard, Schematic, PCB, and Chat screenshots into `04-component-editor/`. This creates three problems:

1. **Inflated coverage**: The catalog appears to have 16 Component Editor screenshots (suggesting thorough coverage) when it has only 2 (one of which is just a spinner)
2. **Misattribution**: Issues found in these screenshots would be filed against the wrong view
3. **Missing sections**: If sections 5-7 rely on this directory for their screenshots, they may appear to have no content

**Fix:** Move screenshots to their correct directories:

```
106-107 → 06-breadboard/
108-109 → 05-schematic/
110-111 → 07-pcb/
118-119 → 11-chat/
```

Delete duplicates 112-117.

---

#### CE-04: Six exact duplicate screenshots waste catalog space [P3]

**Screenshots:** 112 = 106, 113 = 107, 114 = 108, 115 = 109, 116 = 110, 117 = 111
**What:** Screenshots 112-117 are pixel-identical duplicates of 106-111. The catalog script likely ran the same Breadboard → Schematic → PCB capture sequence twice.
**Fix:** Delete 112-117 from the catalog.

---

### Findings — Cross-Referenced from Miscategorized Screenshots

The following observations are derived from the miscategorized screenshots. They are documented here for completeness but properly belong in their respective sections. Each will be cross-referenced when those sections are audited.

#### CE-05 → BB-01: Breadboard canvas has massive unused empty space [P2]

**Screenshots:** 106-107 (actually Breadboard view)
**What:** The breadboard visualization occupies approximately 40% of the canvas width. The remaining 60% is solid black empty space with no content, no grid, no guidance. At 3.0x zoom, the breadboard is pushed to the far left of the canvas.
**Why it matters:** Wasted screen real estate. Users see a narrow breadboard strip against a void, which makes the canvas feel broken or incomplete. In Fritzing and Tinkercad (the reference tools), the breadboard either fills the available width or is centered with contextual elements around it.
**Fix:** Auto-center the breadboard in the viewport when the view loads. Consider `fitView()` on initial render to fill the canvas area proportionally.

---

#### CE-06 → BB-02: Breadboard view has no empty-state onboarding guidance [P2]

**Screenshots:** 106-107
**What:** The breadboard shows the physical board (power rails, hole grid, column/row labels) but zero components and no instructional text. There's no "Drag a component onto the breadboard" message, no "Click to add" affordance, no tutorial hint.
**Why it matters:** New users see an empty breadboard and have no idea how to start. The Schematic view (108) at least has a status bar saying "Drag a component onto the canvas" — the Breadboard view lacks even that.
**Fix:** Add a subtle instructional overlay or status bar: "Drag components from the sidebar onto the breadboard to start prototyping."

---

#### CE-07 → BB-03: Breadboard toolbar icons are small and unlabeled [P2]

**Screenshots:** 107 (breadboard content close-up)
**What:** The toolbar shows 6 icons (select, pen/edit, delete, zoom-in, zoom-out, reset) at approximately 20px each with no text labels, no keyboard shortcut hints, and minimal spacing. Same pattern as AV-05.
**Fix:** Add tooltips with tool names and keyboard shortcuts. Consider bumping icon size.

---

#### CE-08 → SC-01: Schematic component bodies are oversized relative to pin count [P2]

**Screenshots:** 108-109 (actually Schematic view)
**What:** The two ATtiny85 components (U1, U2) are rendered as large white rectangles that each consume roughly 25% of the visible canvas area. An ATtiny85 is an 8-pin DIP — its schematic symbol should be compact, not a 300px-tall box. The internal pin labels (PB0-PB5, VCC, GND) are not visible on the component body — the only visible text is the reference designator (U1/U2) and the component name (ATtiny85) at the exterior.
**Why it matters:** In KiCad and Altium, an 8-pin IC symbol is roughly 2cm x 3cm at 1:1. Here, the components are so large that only 2 fit on screen. This makes complex schematics (10+ components) unwieldy. The missing internal pin labels mean users must rely on connection tracing to understand pin assignments.
**Fix:**

1. Show pin names inside the component body (standard schematic convention)
2. Size component bodies proportionally to pin count (fewer pins = smaller body)
3. Consider auto-scaling or a display density setting

---

#### CE-09 → SC-02: Schematic view has a rich component sidebar — good design [No Issue]

**Screenshots:** 108-109
**What:** The left sidebar shows a "Components" panel with three sub-tabs (Parts, Power, Sheets), a search input, and a categorized tree (MICROCONTROLLER with count, OTHER with count). This is well-organized and follows KiCad's component browser pattern.
**Status:** Pass. Good information architecture.

---

#### CE-10 → SC-03: Schematic toolbar has 10+ tool icons — rich but dense [P3]

**Screenshots:** 109 (schematic content close-up)
**What:** The schematic toolbar shows approximately 10 icons in a horizontal row: select, move, settings, component?, mirror?, wire, circle?, zoom, grid, fit-view. At `w-4 h-4` with `p-1.5`, this creates a dense toolbar that's hard to parse at a glance.
**Fix:** Group related tools with visual dividers (selection tools | drawing tools | view tools). Add tooltips with shortcuts. Same recommendation as AV-05.

---

#### CE-11 → SC-04: "Drag a component onto the canvas" status bar is well-placed [No Issue]

**Screenshots:** 109
**What:** A status bar at the bottom of the schematic canvas shows "Drag a component onto the canvas" in cyan text. This provides clear guidance for the empty-canvas state and is positioned where users would look after scanning the main canvas.
**Status:** Pass. The Breadboard and PCB views should replicate this pattern.

---

#### CE-12 → PCB-01: PCB view shows empty board outline with no guidance [P2]

**Screenshots:** 110-111 (actually PCB Layout view)
**What:** The PCB canvas shows two dashed rectangles — a green-tinted courtyard/keepout dashed line and a yellow/amber board edge dashed line — with a completely empty interior. No components, no ratsnest, no guidance text, no grid dots visible inside the board area. The board outline dominates the upper-left quadrant of the canvas with vast empty space surrounding it.
**Why it matters:** A new user opening the PCB view sees two mysterious dashed rectangles and nothing else. There's no explanation of what the outlines represent, no instruction for how to import components from the schematic, no "run netlisting" prompt.
**Fix:**

1. Add empty-state guidance: "Import components from schematic to start PCB layout" or "No components placed. Generate or import a netlist."
2. Add a board-outline legend or tooltip explaining the dashed lines (board edge vs. courtyard)
3. Center the board outline in the viewport

---

#### CE-13 → PCB-02: PCB "F.Cu" layer selector is compact but cryptic [P2]

**Screenshots:** 111 (PCB content close-up)
**What:** The active copper layer is shown as a small red-highlighted badge reading "F.Cu" in the toolbar. While "F.Cu" is standard PCB terminology (Front Copper), the badge is only ~40px wide and its interactive nature isn't obvious — it looks like a status label rather than a clickable selector.
**Why it matters:** Layer selection is fundamental to PCB layout. New users may not realize they can click this to change layers, or may not know what "F.Cu" means.
**Fix:** Make it clearly a dropdown with a small chevron arrow. Consider showing the full name on hover/click: "Front Copper (F.Cu)".

---

#### CE-14 → PCB-03: PCB trace width uses a slider — unusual for this control [P3]

**Screenshots:** 111
**What:** Trace width is controlled by a slider showing "2.0mm" text. Most PCB tools use a dropdown with predefined widths (0.2mm, 0.25mm, 0.5mm, 1.0mm, 2.0mm) or a numeric input field, because trace width is a precise engineering parameter.
**Fix:** Consider replacing with a dropdown of standard trace widths, or adding preset buttons alongside the slider. The slider provides smooth adjustment but makes it hard to hit exact values.

---

#### CE-15: Chat quick action buttons are clean and readable [No Issue]

**Screenshots:** 118 ("Generate Architecture"), 119 ("Export BOM CSV")
**What:** Both buttons show a lightning-bolt icon and label text on a dark background with subtle border. Clean, legible, good touch-target size (~40px height). These are from the Chat panel's quick actions bar, miscategorized in this directory.
**Status:** Pass. Well-styled action buttons.

---

### Section 4 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 1 | CE-01 |
| P1 (High) | 1 | CE-03 |
| P2 (Medium) | 6 | CE-02, CE-05/BB-01, CE-06/BB-02, CE-07/BB-03, CE-08/SC-01, CE-12/PCB-01, CE-13/PCB-02 |
| P3 (Polish) | 3 | CE-04, CE-10/SC-03, CE-14/PCB-03 |
| Pass | 3 | CE-09/SC-02, CE-11/SC-04, CE-15 |
| **Total** | **14** | |

**Key takeaway:** The Component Editor — the most feature-rich view in the application — has **zero visual coverage** of its actual UI. This is the single largest gap in the audit catalog. A targeted re-capture session is required before this view can be meaningfully audited.

## Section 5: Schematic (05-schematic/)

### Catalog Integrity Note

The `05-schematic/` directory contains **zero actual schematic screenshots**. Screenshots 120-121 both show the Architecture view (same content as the architecture captures in Section 3). Screenshot 122 is just the "Schematic" tab label element. The only actual Schematic view captures are the miscategorized 108-109 from `04-component-editor/`.

**Available schematic content:** Screenshots 108-109 (from Section 4) showing the schematic canvas with two ATtiny85 ICs, GND power symbol, and Net_PB5_PB0 wire.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 120_schematic-default.png | **MISCATEGORIZED**: Shows Architecture view | [!] |
| 2 | 121_schematic-fullpage.png | **MISCATEGORIZED**: Shows Architecture view (identical to 120) | [!] |
| 3 | 122_el_schematic-canvas.png | Tab label element only ("Schematic") | [x] |
| — | 108 (from 04-component-editor/) | Actual schematic view with components | [!] |
| — | 109 (from 04-component-editor/) | Schematic content close-up | [!] |

### Findings

#### SC-01: Schematic directory captures show Architecture view — zero schematic coverage [P1]

**Screenshots:** 120, 121
**What:** Both viewport captures in `05-schematic/` display the Architecture view (ESP32 node, SX1262, SHT40, Asset Library panel, architecture edges) instead of the Schematic tab content. The screenshot script navigated to the Schematic tab but the schematic content wasn't rendered — likely because circuit designs hadn't loaded before capture, so the underlying Architecture view bled through.
**Fix:** Re-capture with proper timing. Wait for `data-testid="schematic-view"` OR `data-testid="schematic-empty"` to be present before screenshot.

---

#### SC-02: Schematic component bodies lack internal pin labels — major convention violation [P1]

**Screenshots:** 108-109 (cross-referenced from Section 4)
**Location:** `SchematicCanvas.tsx` → `SchematicInstanceNode` rendering
**What:** The two ATtiny85 components (U1, U2) are rendered as large white rectangles with only the component name ("ATtiny85") as centered interior text. **No pin names or pin numbers are visible on the component body.** The only pin indicators are small gray/cyan handle rectangles at the body edges.

In every standard EDA tool (KiCad, Altium, Eagle, LTspice), schematic symbols display:

- Pin names (PB0, PB1, VCC, GND, etc.) inside or immediately adjacent to the body
- Pin numbers (1-8) on the opposite side
- Functional grouping (inputs left, outputs right, power top/bottom)

Without pin labels, users cannot identify pin assignments at a glance. They must hover individual handles or cross-reference a datasheet. This fundamentally breaks the purpose of a schematic — to communicate the circuit's logical connections.

**Fix:**

1. Render pin names as `<text>` elements inside the component body, positioned next to each handle
2. Render pin numbers as small text outside the body, adjacent to each pin
3. Size the component body proportionally: `height ≈ max(leftPins, rightPins) × pinSpacing + padding`
4. Follow IEEE/IEC convention: inputs left, outputs right, VCC top, GND bottom

---

#### SC-03: Component bodies are oversized relative to pin count [P2]

**Screenshots:** 108-109
**What:** (Cross-referenced from CE-08) Each ATtiny85 (8-pin DIP) occupies approximately 25% of the visible canvas area as a large white rectangle (~300px tall). At this scale, only 2 components fit on screen simultaneously. A complex schematic with 10+ components would be completely unwieldy.
**Root cause:** The component body sizing appears fixed rather than scaled to pin count. An 8-pin component should be roughly half the height of a 40-pin component.
**Fix:** Calculate body height from `pinCount`: `bodyHeight = max(pinsPerSide) × pinPitch + topPadding + bottomPadding`. Use a standard pin pitch of ~20-25 SVG units.

---

#### SC-04: Over half the schematic toolbar tools are disabled ("coming soon") [P2]

**Location:** `SchematicCanvas.tsx` → SchematicToolbar `TOOLS` array
**What:** Per source code, the schematic floating toolbar has 9 tools. **4 of 7 non-divider tools are disabled** with "coming soon" tooltips:

- Place Component (disabled)
- Place Power Symbol (disabled)
- No Connect marker (disabled)
- Net Label (disabled)

Only Select, Pan, and Draw Net are functional. Grid Snap and Fit View work but are utility tools, not design tools. Users see a toolbar where the majority of buttons are grayed out, which signals "incomplete software."
**Why it matters:** The disabled tools represent core schematic editing operations. Users may feel the schematic editor is a prototype rather than a functional tool. The Component Placer sidebar partially compensates (drag-and-drop placement works), but the toolbar's own place-component button doesn't function.
**Fix options:**

1. **Remove disabled tools** until implemented — show a smaller toolbar with only working tools
2. **Enable the tools** by wiring them to existing sidebar functionality (Place Component → open ComponentPlacer, Place Power → open PowerSymbolPalette)
3. Keep as-is but replace "coming soon" with a clearer message like "Use sidebar to place components"

---

#### SC-05: Floating toolbar may overlap canvas content [P2]

**Location:** `SchematicCanvas.tsx` → toolbar positioned `absolute top-4 left-4`
**What:** The schematic toolbar is an absolute-positioned floating panel (`bg-card/50 backdrop-blur-xl`) at the top-left of the canvas. If components are placed near the top-left origin, the toolbar will overlap them. Unlike the sidebar (which pushes canvas content), this overlay occludes content without any visual indicator of what's behind it.
**Fix:** Add a slight margin/offset to the default view bounds so newly placed components don't spawn behind the toolbar. Or make the toolbar collapsible/movable.

---

#### SC-06: Net wire label "Net_PB5_PB0" is auto-generated and cryptic [P3]

**Screenshots:** 108-109
**What:** The wire connecting U1 pin to U2 pin is labeled "Net_PB5_PB0" — an auto-generated name from pin names. While technically correct, this label style is unfriendly for complex schematics where dozens of nets would produce labels like "Net_PA3_PB7_PC2".
**Fix:** Allow user-assigned net names (via the planned Net Label tool). Auto-generated names are fine as defaults but should be easily renameable. Show the user-friendly name prominently and the auto-generated name as fallback.

---

#### SC-07: Power symbol GND rendering follows standard conventions [No Issue]

**Screenshots:** 108-109
**What:** The GND symbol renders as the standard IEEE 3-bar ground symbol in cyan, with "GND" text. Properly positioned, clearly identifiable. The Power Symbol Palette (source code) includes VCC, VDD, 3.3V, 5V, 12V (red) and GND, AGND, DGND (green) — a good selection.
**Status:** Pass.

---

#### SC-08: Component sidebar with Parts/Power/Sheets tabs is well-organized [No Issue]

**Screenshots:** 108 (left sidebar visible)
**What:** The left sidebar (`w-56`) shows three tabs — Parts (component placer with search and categorized tree), Power (supply/ground symbol palette with drag-and-drop), and Sheets (hierarchical sheet navigation). The component tree groups by family with collapsible sections and count badges. The "Drag a component onto the canvas" footer text provides clear guidance.
**Status:** Pass. Good information architecture following KiCad's component browser pattern.

---

#### SC-09: React Flow controls and minimap are present [No Issue]

**Screenshots:** 108-109
**What:** Standard React Flow zoom controls (bottom-left: +, -, fit-to-view) and minimap (bottom-right: cyan rectangles representing components). Both are positioned in their standard locations.
**Status:** Pass.

---

### Section 5 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 2 | SC-01, SC-02 |
| P2 (Medium) | 3 | SC-03, SC-04, SC-05 |
| P3 (Polish) | 1 | SC-06 |
| Pass | 3 | SC-07, SC-08, SC-09 |
| **Total** | **9** | |

---

## Section 6: Breadboard (06-breadboard/)

### Catalog Note

The `06-breadboard/` directory is the **only one of sections 4-7 that correctly captured its target view**. Screenshots 123-124 show the actual Breadboard tab content (identical to the miscategorized 106-107 from Section 4). Screenshot 125 is the tab label element. Additionally, the miscategorized 106-107 from `04-component-editor/` are duplicates of 123-124.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 123_breadboard-default.png | Breadboard view with empty board | [!] |
| 2 | 124_breadboard-fullpage.png | Fullpage capture (identical to 123) | [!] |
| 3 | 125_el_breadboard-canvas.png | Tab label element ("Breadboard", active/cyan) | [x] |
| — | 106-107 (from 04-component-editor/) | Duplicate of 123-124 | — |

### Findings

#### BB-01: Breadboard canvas has massive unused empty space [P2]

**Screenshots:** 123-124
**Location:** `BreadboardCanvas.tsx` → SVG viewport, `BreadboardGrid.tsx`
**What:** (Cross-referenced from CE-05) The breadboard visualization (63 rows × 10 columns + 4 power rails) occupies approximately 40% of the canvas width at the default 3.0x zoom. The remaining 60% is solid black `#0a0a0a` void with no grid, no guidance, no content. The board is positioned at the top-left of the canvas rather than centered.
**Why it matters:** The dominant visual impression is emptiness, not a breadboard. Users' eyes are drawn to the void rather than the board. In Fritzing and Tinkercad, the breadboard fills or is centered in the viewport.
**Fix:** Auto-center and auto-fit the breadboard in the viewport on initial render. Call a `fitView()` equivalent after the board grid mounts. The default zoom of 3.0x seems too high for the viewport width — a lower initial zoom that shows the entire board centered would be better.

---

#### BB-02: No empty-state guidance on the breadboard canvas [P2]

**Screenshots:** 123-124
**Location:** `BreadboardView.tsx` — canvas area
**What:** (Cross-referenced from CE-06) The breadboard shows the physical board with holes but zero components and no instructional text. The Schematic view has a "Drag a component onto the canvas" status bar footer (confirmed in source: `ComponentPlacer.tsx` footer), but the Breadboard has no equivalent canvas-level guidance.
**Why it matters:** New users opening the Breadboard view see holes and nothing else. There's no indication of how to add components, draw wires, or start prototyping. The empty state (`breadboard-empty`) only appears when NO circuits exist — once a circuit exists but has no breadboard content, there's no guidance.
**Fix:** Add a subtle overlay or status bar: "Select Wire tool (2) and click holes to route connections" or "Drag components from the schematic to place on the breadboard." Mirror the Schematic view's footer guidance pattern.

---

#### BB-03: Breadboard has no component placement mechanism — relies entirely on Schematic [P2]

**Location:** `BreadboardView.tsx` — no sidebar, no component placer
**What:** Per source code analysis, the Breadboard view has NO sidebar panel, NO component placer, and NO drag-and-drop placement. Components must be placed in the Schematic view first, then they appear on the breadboard based on their `breadboardX/Y` coordinates from the `circuit_instances` table. If a user navigates directly to the Breadboard tab, they cannot add components — only draw wires between existing placements.
**Why it matters:** This creates a confusing workflow for users who expect to interact with the breadboard directly. Fritzing's breadboard view allows direct component placement by dragging from a parts bin. The current ProtoPulse workflow requires: Schematic → place components → switch to Breadboard → arrange → wire. This isn't communicated anywhere in the Breadboard UI.
**Fix options:**

1. Add a minimal component sidebar or "place from schematic" panel
2. At minimum, show clear guidance: "Components placed in Schematic appear here. Switch to Schematic to add components."
3. Long-term: support direct component drag-and-drop from a breadboard parts panel

---

#### BB-04: Toolbar icons are small (`w-3.5 h-3.5`) and unlabeled [P2]

**Screenshots:** 123 (toolbar visible at top)
**Location:** `BreadboardCanvas.tsx` → `ToolButton` — `h-6 w-6 rounded`, icon `w-3.5 h-3.5`
**What:** (Cross-referenced from CE-07) The breadboard toolbar has 6 buttons (Select, Wire, Delete, ZoomIn, ZoomOut, ResetView) using 14px icons in 24px buttons. No text labels, no visible keyboard shortcut hints. The buttons are small enough to be difficult to target on touch devices (24px < 44px WCAG minimum).
**Why it matters:** Same pattern as AS-04, AV-05. Frequently-used tools in a drawing application should be easily identifiable and clickable.
**Fix:** Increase to `h-8 w-8` buttons with `w-4 h-4` icons minimum. Add tooltips: "Select (1)", "Wire (2)", "Delete (3)". Consider text labels if toolbar width allows.

---

#### BB-05: Breadboard grid rendering is physically accurate and visually clean [No Issue]

**Screenshots:** 123 (close-up in 107/113)
**What:** The breadboard accurately renders: red power rail (+) with red-tinted holes, blue ground rail (-) with blue-tinted holes, column labels a-j, row numbers at intervals (1, 5, 10, 15, 20, 25), central channel gap between columns e and f, and uniform hole grid. The olive/army-green board color is realistic. Power rail labels (+/-) are clear.
**Status:** Pass. The physical layout accurately models a standard 830-point solderless breadboard.

---

#### BB-06: Zoom level and coordinate display are helpful [No Issue]

**Screenshots:** 123 (toolbar right side)
**Location:** `BreadboardCanvas.tsx` — status text in toolbar
**What:** The toolbar displays the current zoom level ("3.0x") and, when hovering, the coordinate of the hovered hole (e.g., "d15" or "top_pos[3]"). This is useful feedback for precise wire placement.
**Status:** Pass.

---

### Section 6 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 0 | — |
| P2 (Medium) | 4 | BB-01, BB-02, BB-03, BB-04 |
| P3 (Polish) | 0 | — |
| Pass | 2 | BB-05, BB-06 |
| **Total** | **6** | |

---

## Section 7: PCB (07-pcb/)

### Catalog Integrity Note

Same issue as Section 5: the `07-pcb/` directory contains **zero actual PCB Layout screenshots**. Screenshots 126-127 both show the Architecture view (identical to Section 3 architecture captures). Screenshot 128 is just the "PCB" tab label element. The only actual PCB Layout captures are the miscategorized 110-111 from `04-component-editor/`.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 126_pcb-default.png | **MISCATEGORIZED**: Shows Architecture view | [!] |
| 2 | 127_pcb-fullpage.png | **MISCATEGORIZED**: Shows Architecture view (identical to 126) | [!] |
| 3 | 128_el_pcb-canvas.png | Tab label element only ("PCB", gray/inactive) | [x] |
| — | 110-111 (from 04-component-editor/) | Actual PCB Layout view | [!] |

### Findings

#### PCB-01: PCB directory captures show Architecture view — zero PCB Layout coverage [P1]

**Screenshots:** 126, 127
**What:** Same systematic catalog bug as SC-01. Both viewport captures display the Architecture view instead of the PCB Layout tab content. The PCB Layout's actual UI (board outline, F.Cu/B.Cu layer system, trace routing, component footprints) is only visible in the miscategorized 110-111.
**Fix:** Re-capture. Wait for `data-testid="pcb-layout-view"` OR `data-testid="pcb-empty"` before screenshot.

---

#### PCB-02: Empty PCB board outline with no guidance or legend [P2]

**Screenshots:** 110-111 (cross-referenced from CE-12)
**Location:** `PCBCanvas.tsx` → board outline rect + empty canvas
**What:** The PCB canvas shows a single yellow dashed rectangle (`stroke="#facc15"`, `strokeDasharray="8 4"`) representing the board outline (500×400 units = 50mm × 40mm) with a completely empty interior. No components, no pads, no ratsnest, no grid dots visible inside the board area, and no guidance text.
**Why it matters:** A user opening the PCB view sees a mysterious dashed yellow rectangle in a dark void with no explanation. There's no indication of:

- What the dashed outline represents (board edge)
- How to import components from the schematic
- How to start placing footprints or routing traces
- What the board dimensions are
**Fix:**

1. Add canvas-level empty guidance: "Import components from Schematic, then place footprints and route traces"
2. Display board dimensions as a subtle label (e.g., "50mm × 40mm" near the board corner)
3. Show the dot grid pattern inside the board area more prominently (the `#333` dots on `#1a1a1a` background are nearly invisible)

---

#### PCB-03: Layer selector "F.Cu" badge is compact but not obviously interactive [P2]

**Screenshots:** 111 (cross-referenced from CE-13)
**Location:** `PCBCanvas.tsx` → `pcb-layer-toggle` button
**What:** The active copper layer is displayed as a small colored badge labeled "F.Cu" (red for front copper). While "F.Cu" and "B.Cu" are standard PCB terminology, the badge looks like a status indicator rather than a clickable toggle. No dropdown arrow, no border change on hover visible in the screenshot.
**Why it matters:** Layer selection is the most fundamental PCB operation. Users must discover by trial-and-error that clicking the badge toggles between front and back copper.
**Fix:** Add a small chevron or swap icon to indicate interactivity. Consider showing both layers with the active one highlighted: `[F.Cu] B.Cu` or `F.Cu | B.Cu` with toggle styling. On hover, show the full name: "Front Copper" / "Back Copper".

---

#### PCB-04: Trace width slider may be imprecise for engineering values [P3]

**Screenshots:** 111 (cross-referenced from CE-14)
**Location:** `PCBCanvas.tsx` → `pcb-trace-width` range input, `min=0.5 max=8 step=0.1`
**What:** Trace width is controlled by an HTML range slider (0.5mm-8mm, 0.1mm steps) with a "2.0mm" text readout. While the slider provides smooth adjustment, PCB design uses specific standard trace widths: 0.15mm, 0.2mm, 0.25mm, 0.3mm, 0.5mm, 1.0mm, 2.0mm. The slider makes it easy to accidentally set non-standard widths like 1.3mm or 0.7mm.
**Fix:** Add preset buttons for common widths alongside the slider, or replace with a dropdown of standard values. Alternatively, snap the slider to standard values (0.2, 0.25, 0.3, 0.5, 1.0, 2.0mm).

---

#### PCB-05: PCB has no component placement mechanism — same limitation as Breadboard [P2]

**Location:** `PCBLayoutView.tsx` — no sidebar, no component placer
**What:** Same issue as BB-03. The PCB view has no sidebar, no footprint browser, and no drag-and-drop placement. Components must exist in the Schematic first, then appear on the PCB board based on their `pcbX/pcbY` coordinates. Users cannot add, remove, or change component footprints from within the PCB view.
**Why it matters:** In KiCad and Altium, the PCB editor has its own footprint browser and allows direct placement. The current workflow forces users to bounce between Schematic and PCB for any component changes.
**Fix:** At minimum, display clear guidance about the Schematic-first workflow. Long-term, add a footprint browser sidebar.

---

#### PCB-06: Dual-layer rendering with opacity is a good approach [No Issue]

**Location:** `PCBCanvas.tsx` — front/back layer rendering
**What:** Per source code, back-layer traces render at 30% opacity when the front layer is active (and vice versa). Front-layer traces render on top of component footprints, back-layer traces behind them. Component footprints are colored red (front side) or blue (back side). This follows the standard PCB editor convention of dimming inactive layers.
**Status:** Pass. Correct layer visualization approach.

---

#### PCB-07: Board dimensions are hardcoded at 50mm × 40mm [P3]

**Location:** `PCBCanvas.tsx` — `BOARD_W = 500, BOARD_H = 400` (at 0.1mm/unit)
**What:** The board outline is a fixed 50mm × 40mm rectangle. There's no UI to resize the board, change its shape, or set custom dimensions. For a PCB layout tool, board dimensions are a fundamental parameter that varies per project.
**Fix:** Add a board properties dialog or inline controls to set board width, height, and shape. This could be triggered from the board outline's context menu or a toolbar button.

---

### Section 7 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 1 | PCB-01 |
| P2 (Medium) | 3 | PCB-02, PCB-03, PCB-05 |
| P3 (Polish) | 2 | PCB-04, PCB-07 |
| Pass | 1 | PCB-06 |
| **Total** | **7** | |

## Section 8: Procurement (08-procurement/)

### Catalog Integrity Note

Same systematic capture failure. The Procurement view — a feature-rich BOM management table with drag-and-drop reordering, inline editing, cost optimization sliders, status badges, search/filter, add-item dialog, and responsive card layout — was **never captured**. Screenshot 129 shows the loading spinner, 130 shows the Architecture view, and 131-132 are miscategorized elements from other sections.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 129_procurement-default.png | Loading spinner (ViewLoadingFallback) | [!] |
| 2 | 130_procurement-fullpage.png | **MISCATEGORIZED**: Shows Architecture view | [!] |
| 3 | 131_el_btn-export.png | **MISCATEGORIZED**: Chat quick action "Export BOM CSV" (dup of 119) | [!] |
| 4 | 132_el_btn-settings.png | **MISCATEGORIZED**: Sidebar "Project Settings" button (dup of SB-06) | [!] |

### Findings

#### PR-01: Procurement view was never captured — zero BOM table coverage [P1]

**Screenshot:** 129
**Location:** `ProcurementView.tsx` — entire view
**What:** The only Procurement screenshot shows the `ViewLoadingFallback` spinner. The actual Procurement UI includes:

- **BOM table** with sortable drag-and-drop rows (via @dnd-kit), inline editing, status badges (In Stock/Low Stock/Out of Stock), and right-click context menus
- **Cost Optimization panel** with production batch size slider, max BOM cost slider, in-stock-only toggle, preferred suppliers checklist, and 4-way optimization goal selector (Cost/Power/Size/Avail)
- **Search/filter bar** with real-time filtering
- **Add Item dialog** with part number, manufacturer, supplier, description, quantity, price fields
- **Component Parts reference panel** showing imported component metadata
- **Responsive card layout** for mobile
- **Estimated BOM Cost** display with per-unit pricing

This is one of the most data-rich views in the application, and none of it was captured.

**Fix:** Re-capture after ensuring BOM items exist in the database. Wait for `data-testid="procurement-view"` OR `data-testid="empty-state-bom"`. Capture multiple states:

1. Empty BOM state (`empty-state-bom`)
2. Table with items and status badges
3. Cost Optimization panel expanded
4. Inline row editing active
5. Add Item dialog open

---

#### PR-02: Procurement element captures are from other views [P2]

**Screenshots:** 131 ("Export BOM CSV"), 132 ("Project Settings")
**What:** These element captures are identical to screenshots found in other sections (119 from chat quick actions, 041 from sidebar). They provide no Procurement-specific information.
**Fix:** Replace with actual Procurement element captures: `button-export-csv`, `button-toggle-settings`, `button-add-bom-item`, a status badge example, the cost optimization panel.

---

### Section 8 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 1 | PR-01 |
| P2 (Medium) | 1 | PR-02 |
| **Total** | **2** | |

---

## Section 9: Validation (09-validation/)

### Catalog Note

The Validation directory is unique in this audit — it captured a **runtime crash**. Screenshots 133-134 show the ErrorBoundary fallback ("Something went wrong rendering this section."), not the actual Validation view. This is the only section where we captured a genuine application error rather than a loading spinner or wrong view.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 133_validation-default.png | **ErrorBoundary crash** — runtime error visible | [!] |
| 2 | 134_validation-fullpage.png | Same ErrorBoundary crash (identical to 133) | [!] |
| 3 | 135_el_btn-run.png | **MISCATEGORIZED**: Chat quick action "Run Validation" | [!] |

### Findings

#### VL-01: Validation view crashes with an unhandled rendering error [P0]

**Screenshots:** 133-134
**Location:** `ValidationView.tsx` → `ErrorBoundary.tsx` catch
**What:** The Validation tab, when selected, displays: **"Something went wrong rendering this section."** with a "Try Again" button. This is the `ErrorBoundary` fallback from `client/src/components/ErrorBoundary.tsx`, which catches React render errors.

The Validation view performs three `useMemo` computations at render time:

1. `componentIssues` — calls `validatePart()` on every component part
2. `drcIssues` — calls `runDRC()` across breadboard/schematic/pcb views for every part
3. `ercViolations` — calls `runERC()` against circuit instances and nets

If **any** of these computations throws (e.g., unexpected data shape from `useComponentParts`, missing circuit data, or a validation rule encountering null/undefined fields), the entire view crashes because `useMemo` does not catch exceptions.

**Why this is P0:** The Validation view is a **core EDA feature** — it's where users check their design for errors before manufacturing. A crash here means:

- Users cannot validate their designs at all
- The "Run Validation" AI action that navigates to this view leads to a crash screen
- The error message provides zero debugging information to the user
- The "Try Again" button will likely re-crash immediately since the data hasn't changed

**Root cause hypothesis:** The crash is likely triggered by `runERC()` or `runDRC()` receiving incomplete circuit/component data. The view eagerly computes all three issue types on mount, even if the underlying data is still loading or malformed.

**Fix (immediate):**

1. Wrap each `useMemo` computation in try/catch, returning an empty array on error
2. Add error state to the view that shows which computation failed and why
3. Guard against loading states: check `partsLoading`, `circuitsLoading`, `instancesLoading`, `netsLoading` before computing

**Fix (proper):**

1. Use React Query's `enabled` option to defer ERC/DRC until all dependent data is loaded
2. Add graceful degradation: show architecture issues immediately, add component/DRC/ERC sections as their data becomes available
3. Add per-computation error boundaries so one failed section doesn't take down the entire view

---

#### VL-02: ErrorBoundary fallback provides no diagnostic information [P2]

**Screenshots:** 133-134
**Location:** `ErrorBoundary.tsx`
**What:** The error fallback shows only "Something went wrong rendering this section." and a "Try Again" button. There is no:

- Error message or stack trace (even in development mode)
- Indication of which view/component crashed
- Link to documentation or troubleshooting steps
- "Report Issue" button or feedback mechanism
- Console error log instruction for users

The minimal styling is appropriate (not alarming), but the lack of any actionable information makes this a dead-end screen.

**Fix:**

1. In development mode, show the error message and component stack: `this.state.error?.message`
2. Add a "View Details" expandable section with the error info
3. Add specific guidance: "Try refreshing the page. If the problem persists, check the browser console for details."
4. Log the error to the Output view so users can see it in the console log

---

#### VL-03: Validation view was never captured in its working state [P1]

**What:** Because of the crash, we have zero coverage of the actual Validation UI, which per source code includes:

- Virtualized issue list with section headers (Architecture, Component Parts DRC, ERC)
- Severity icons (error/warning/info) with color coding (red/yellow/cyan)
- Issue rows with description, suggestion text, component badge, and action buttons
- "Run DRC Checks" button with cyan glow shadow effect
- Context menu on architecture issues (Mark Resolved, View in Architecture, Copy, Dismiss)
- Dismiss confirmation dialog
- Empty "All Systems Nominal" state with green shield icon

**Fix:** Fix the crash (VL-01), then re-capture the following states:

1. Empty state ("All Systems Nominal")
2. Populated issue list with mixed severity levels
3. Architecture issues with suggestion text
4. DRC violations with rule type labels
5. ERC violations with net references

---

### Section 9 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 1 | VL-01 |
| P1 (High) | 1 | VL-03 |
| P2 (Medium) | 1 | VL-02 |
| **Total** | **3** | |

---

## Section 10: Output (10-output/)

### Catalog Note

The Output view is **the first data-rich view since Section 3 (Architecture) to be captured correctly**. Both screenshots show the actual Output console with log entries rendered. This section has the best catalog quality of Sections 4-10.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 136_output-default.png | Output console with 3 log entries | [!] |
| 2 | 137_output-fullpage.png | Same view (identical to 136) | [x] |

### Findings

#### OU-01: "BASH / LINUX" label appears interactive but is static text [P2]

**Screenshots:** 136-137
**Location:** `OutputView.tsx` — header right-hand group
**What:** The header displays "BASH / LINUX" as a label in the same row as the copy and clear action buttons. Its styling (`text-muted-foreground`) and position between interactive elements makes it look like a clickable tab toggle — as if users could switch between "BASH" and "LINUX" output modes. In reality, this is completely static text with no click handler.
**Why it matters:** Users may click on it expecting functionality and be confused when nothing happens. The " / " separator particularly suggests a toggle or tab selector pattern. In a terminal emulator, the shell type (bash, zsh, fish) is usually shown as metadata, not as an interactive-looking element.
**Fix options:**

1. **Remove it entirely** — it adds no functional value and creates false affordance
2. **Restyle as metadata** — move to the far right, use `text-[10px] opacity-50` to clearly signal it's non-interactive status text
3. **Make it meaningful** — if multiple output modes are planned, implement the toggle; otherwise remove

---

#### OU-02: Console log entries have limited initial content — 3 canned messages [P3]

**Screenshots:** 136-137
**Location:** `OutputContext` initialization
**What:** The Output view shows three pre-seeded entries:

```
[000] [SYSTEM] Initializing ProtoPulse Core...
[001] [PROJECT] Smart_Agro_Node_v1 loaded.
[002] [AI] Ready for queries.
```

These are hardcoded initialization messages that appear in every session. The blinking cursor below suggests more output will come, but in a fresh session with no user actions, this is all users see.
**Why it matters:** The Output view is positioned first in the tab bar (per AS-02). New users who land here see a sparse terminal with 3 lines — not an inspiring first impression. The messages are informative but minimal.
**Fix:** This is more of a UX consideration than a bug. The Output view correctly renders what it receives. Consider adding:

- Timestamp prefix for each entry (currently just line numbers)
- Link to "perform an action to see output here" or similar guidance below the initial entries

---

#### OU-03: Console terminal aesthetic is clean and appropriate [No Issue]

**Screenshots:** 136-137
**What:** The Output view successfully creates a terminal/console aesthetic:

- Dark background with monospace font (`font-mono text-xs`)
- Zero-padded 3-digit line numbers in muted color (`[000]`, `[001]`, `[002]`)
- Log entries with bracket-tagged sources (`[SYSTEM]`, `[PROJECT]`, `[AI]`)
- Blinking cursor at the bottom (`animate-pulse`)
- Search/filter input with monospace font and transparent styling
- "CONSOLE OUTPUT" header label matching the terminal vibe
- Copy and clear action buttons in the header

This is a well-executed console UI that matches expectations for a developer/engineering tool.
**Status:** Pass.

---

#### OU-04: Header controls are functional and well-placed [No Issue]

**Screenshots:** 136-137
**What:** The header shows: "CONSOLE OUTPUT" title, copy-all button (with clipboard icon swap feedback), clear button (with confirmation dialog), entry count ("3 entries"), and the filter input. All controls are in expected positions. The clear button uses a `ConfirmDialog` to prevent accidental log deletion.
**Status:** Pass.

---

#### OU-05: Log entry click-to-copy is discoverable via hover state [No Issue]

**Location:** `OutputView.tsx` — log entry rendering
**What:** Per source code, each log entry has `hover:bg-white/10 cursor-pointer` styling and shows a brief "copied!" text in cyan when clicked. The hover state and cursor change provide sufficient affordance for the copy interaction.
**Status:** Pass (not captured in screenshots but confirmed in source).

---

### Section 10 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 0 | — |
| P2 (Medium) | 1 | OU-01 |
| P3 (Polish) | 1 | OU-02 |
| Pass | 3 | OU-03, OU-04, OU-05 |
| **Total** | **5** | |

## Section 11: Chat Panel (11-chat/)

### Catalog Note

This is the **best-covered section in the entire audit** — 30 screenshots capturing the default state, settings panel, search mode, typing state, collapsed state, workspace-maximized state, header elements, input controls, and all 7 quick action buttons individually. The only gap is message copy buttons (143-147) which captured blank due to hover-only visibility.

### Screenshots Reviewed

**Viewport captures (7):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 138_chat-default.png | Full app with chat panel visible (default help + welcome) | [x] |
| 2 | 161_chat-settings-open.png | Settings panel replacing messages area | [!] |
| 3 | 163_chat-search-active.png | After AI action — [ACTION] result with follow-up | [x] |
| 4 | 164_chat-typing.png | User typing a multi-line prompt | [x] |
| 5 | 166_chat-collapsed.png | Chat panel collapsed, workspace maximized | [x] |
| 6 | 167_workspace-maximized.png | Higher-res collapsed chat — "AI ASSISTANT" vertical text visible | [x] |

**Header elements (4):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 7 | 139_el_chat-header.png | "ProtoPulse AI" header text | [x] |
| 8 | 140_el_btn-chat-search.png | Search icon button (~20px) | [!] |
| 9 | 141_el_btn-chat-export.png | Export/download icon button (~20px) | [!] |
| 10 | 142_el_btn-chat-settings.png | Settings icon button (~20px) | [!] |

**Message copy buttons (5):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 11-15 | 143-147_el_copy-msg-btn-{1-5}.png | All blank — hover-only buttons invisible at rest | [!] |

**Input area elements (5):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 16 | 148_el_chat-input.png | Input area with placeholder, all buttons visible | [x] |
| 17 | 149_el_btn-send.png | Send button (cyan square, ~32px) | [x] |
| 18 | 150_el_btn-image-upload.png | Image upload button (~24px) | [x] |
| 19 | 151_el_btn-voice-input.png | Microphone/voice button (~24px) | [x] |
| 20 | 165_el_chat-input-with-text.png | Input with multi-line typed text | [!] |

**Quick actions (9):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 21 | 152_el_btn-toggle-quick-actions.png | "+" toggle button (~20px) | [x] |
| 22 | 153_el_quick-actions-bar.png | Quick actions bar (3 visible, truncated) | [!] |
| 23 | 154_el_quick-action-generate-architecture.png | "Generate Architecture" button | [x] |
| 24 | 155_el_quick-action-optimize-bom.png | "Optimize BOM" button | [x] |
| 25 | 156_el_quick-action-run-validation.png | "Run Validation" button | [x] |
| 26 | 157_el_quick-action-add-mcu-node.png | "Add MCU Node" button | [x] |
| 27 | 158_el_quick-action-project-summary.png | "Project Summary" button | [x] |
| 28 | 159_el_quick-action-show-help.png | "Show Help" button | [x] |
| 29 | 160_el_quick-action-export-bom-csv.png | "Export BOM CSV" button | [x] |

**Settings panel (1):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 30 | 162_el_settings-panel.png | Settings gear icon (duplicate of 142) | [x] |

### Findings

#### CH-01: Message copy/regenerate buttons are hover-only — invisible and inaccessible [P1]

**Screenshots:** 143-147 (all blank/near-black images, ~40-50 bytes each)
**Location:** `chat/MessageBubble.tsx` — below-bubble action row
**What:** The copy button, regenerate button, and retry button on every message use `opacity-0 group-hover/msg:opacity-100`. Playwright captured nothing because the buttons are invisible at rest. Per source code, the copy button is `w-3 h-3` (12px icon) at `p-1` padding — extremely small even when visible.

```tsx
// opacity-0 group-hover/msg:opacity-100 — invisible at rest
<button data-testid={`copy-msg-${msg.id}`}
  className="opacity-0 group-hover/msg:opacity-100 ..." />
```

**Why it matters:** This is the same pattern documented in AV-01 (asset add button) and SB-01 (undo buttons). For the chat panel specifically:

- **Mobile/touch users cannot copy AI responses** — no hover on touch devices
- **Keyboard-only users have no path to copy** — the buttons don't appear in tab order when invisible
- **The regenerate button on the last AI message is a key interaction** — users need to retry AI responses frequently, and this button is hidden
- At 12px, even when revealed on hover, the buttons are below comfortable click size

**Fix:** Show action buttons persistently with reduced opacity (`opacity-40 group-hover/msg:opacity-100`) or as a small always-visible action row below each message. Increase icon size to at least `w-4 h-4`. Consider a visible "Copy" text label on AI messages since copying AI responses is one of the most frequent chat interactions.

---

#### CH-02: Quick actions bar has no scroll affordance — last 4 of 7 buttons hidden [P2]

**Screenshot:** 153_el_quick-actions-bar.png
**Location:** `chat/QuickActionsBar.tsx` — `overflow-x-auto no-scrollbar` container
**What:** (Cross-referenced from AS-06) The quick actions bar shows "Generate Architecture", "Optimize BOM", and the beginning of "Run..." — then cuts off. The remaining 4 buttons (Run Validation, Add MCU Node, Project Summary, Show Help, Export BOM CSV) are hidden off-screen with **no visual indicator** that more content exists. The `no-scrollbar` CSS class explicitly hides the scrollbar.
**Why it matters:** Users may never discover the Project Summary, Show Help, or Export BOM CSV actions. These are key discovery mechanisms for new users. Over half the actions are invisible by default.
**Fix options:**

1. **Wrap to multiple rows** (`flex-wrap gap-1.5`) — shows all 7 buttons, uses ~2 rows
2. **Fade gradient** at right edge to hint at scrollable content
3. **Scroll arrows** — left/right buttons at edges
4. Remove `no-scrollbar` — let the browser scrollbar appear as an affordance

---

#### CH-03: Header action buttons are tiny (~28px) and icon-only [P2]

**Screenshots:** 140 (search ~20px), 141 (export ~20px), 142 (settings ~20px)
**Location:** `chat/ChatHeader.tsx` — buttons with `p-1.5`, icon `w-4 h-4`
**What:** Same pattern as AS-04 and AS-14. The three header buttons (Search, Export, Settings) are 16px icons with 6px padding = ~28px total target. They have tooltips but no visible text labels. At this size:

- Below 44px WCAG 2.5.8 touch target minimum
- Hard to visually identify at a glance
- The settings gear (142) and export arrow (141) look almost identical at this size
**Fix:** Bump to `p-2` padding (36px total) and `w-5 h-5` icons. Consider adding visible text labels in wide chat panel widths.

---

#### CH-04: "Local Mode (No API Key)" status is nearly invisible [P2]

**Location:** `chat/MessageInput.tsx` — status line below textarea
**What:** (Cross-referenced from AS-07) The status text uses `text-[10px] text-muted-foreground/40` — 10px font at 40% opacity. This is the status line that says "Local Mode (No API Key)" when no API key is configured, or "{Provider} — {Model}" when configured. At 40% opacity on a dark background, this text is functionally invisible.
**Why it matters:** The API key status is critical feedback — it tells users whether AI features will work. New users who miss this indicator will try to chat with the AI, get no response, and have no idea why.
**Fix:**

1. Increase to `text-xs text-muted-foreground/70` (12px at 70% opacity) for the "no API key" state
2. Make it amber-colored when in Local Mode: `text-amber-400/60`
3. Make it clickable — tapping "Local Mode (No API Key)" should open the settings panel
4. When configured, the provider/model text can remain subtle

---

#### CH-05: Settings panel replaces messages instead of overlaying — context loss [P2]

**Screenshot:** 161_chat-settings-open.png
**Location:** `ChatPanel.tsx` — settings panel rendering
**What:** When the user opens Settings (gear icon), the entire messages area is replaced by the Settings panel. The chat history disappears completely — no split view, no overlay, no slide-over. Users lose all context about their conversation while adjusting settings.
**Why it matters:** Users often check settings mid-conversation (e.g., to change the model before asking a complex question). Losing the conversation view forces them to remember what they were doing. In ChatGPT, Claude.ai, and other AI chat UIs, settings are shown as an overlay or modal, not a view replacement.
**Fix options:**

1. **Modal/dialog overlay** — show settings as a centered dialog over the messages
2. **Slide-over panel** — slide settings in from the right, pushing messages partially
3. **Keep current** but add a visual indicator that messages exist behind the panel (e.g., blurred preview of the last message at the top)

---

#### CH-06: Input area buttons overlap text at certain widths [P3]

**Screenshot:** 165_el_chat-input-with-text.png
**Location:** `chat/MessageInput.tsx` — textarea `pr-20` padding vs. absolute-positioned buttons
**What:** When the user types a long multi-line message ("design a solar-powered sensor node for agricultural monitoring"), the image upload button (`ImagePlus` icon) appears very close to the end of the text on the second line. The textarea has `pr-20` (80px) right padding to accommodate the 3 buttons (image, mic, send), but at narrow chat widths the text wraps close to the button zone.
**Fix:** Minor — the 80px padding should prevent true overlap. If this occurs in practice, increase to `pr-24`. Alternatively, move the image upload and mic buttons to a separate row below the textarea.

---

#### CH-07: Token/cost info is extremely small and over-dimmed [P3]

**Location:** `chat/MessageBubble.tsx` — token info display
**What:** The token count and cost display (`{total} tokens · ~${cost}`) uses `text-[10px] text-muted-foreground/50` — 10px at 50% opacity. This useful information (cost awareness for API usage) is hidden so aggressively that most users will never notice it.
**Fix:** Increase to `text-[11px] text-muted-foreground/60`. The information is genuinely useful for power users managing API costs — it doesn't need to be prominent, but it shouldn't be invisible.

---

#### CH-08: Attached image remove button is hover-only [P3]

**Location:** `chat/MessageInput.tsx` — remove image button
**What:** When a user attaches an image, the "X" remove button uses `opacity-0 group-hover/img:opacity-100`. Same hover-only pattern as CH-01, AV-01, SB-01. Mobile users cannot remove an incorrectly attached image without submitting and restarting.
**Fix:** Show the remove button persistently as a small red "X" badge at the top-right of the image preview.

---

#### CH-09: Settings panel is well-organized with good visual hierarchy [No Issue]

**Screenshot:** 161_chat-settings-open.png
**What:** The Settings panel shows:

- Provider toggle (Anthropic/Gemini) with clear active state (cyan border + glow)
- Model dropdown showing "Claude 4.5 Sonnet"
- Model Routing with dropdown (Manual/Auto/Quality/Speed/Cost) and dynamic description text
- API Key field with password toggle
- Temperature slider with labeled endpoints (Precise/Balanced/Creative)
- Custom Instructions textarea
- Prominent "Save & Close" button (full-width cyan)

All fields are well-spaced, properly labeled, and follow the established dark theme. The provider toggle with cyan glow on the active option is visually distinctive.
**Status:** Pass. Well-designed settings interface.

---

#### CH-10: Chat input area has excellent placeholder and layout [No Issue]

**Screenshot:** 148_el_chat-input.png
**What:** The input area shows:

- "+" quick actions toggle on the left
- "Describe your system... (Shift+Enter for new line)" placeholder — informative and includes keyboard shortcut
- Image upload, microphone, and send buttons on the right
- Send button in solid cyan — clearly the primary action
- Good contrast between placeholder text and background

The auto-growing textarea (44px min, 120px max) prevents the input from dominating the panel while accommodating longer prompts.
**Status:** Pass.

---

#### CH-11: Quick action buttons have consistent, clean styling [No Issue]

**Screenshots:** 154-160 (all 7 individual buttons)
**What:** All 7 quick action buttons use the same pattern: `Zap` lightning bolt icon + text label, dark background with subtle border, `text-[11px]` font. Each is clearly labeled and immediately communicates its function. The lightning bolt icon creates a consistent "AI action" visual language.
**Status:** Pass.

---

#### CH-12: Chat collapsed state is clean and space-efficient [No Issue]

**Screenshots:** 166, 167
**What:** The collapsed chat shows a thin `w-10` (40px) vertical strip with:

- `Sparkles` icon at the top (matching the header branding)
- "AI ASSISTANT" text rotated vertically in uppercase tracking
- The entire strip is clickable to expand

The workspace gains the full chat panel width for the architecture canvas. The collapsed strip is subtle but discoverable.
**Status:** Pass.

---

#### CH-13: AI action result formatting is clear and actionable [No Issue]

**Screenshot:** 163_chat-search-active.png
**What:** After an AI action, the message shows: "[ACTION] Added new MCU node: 'the arduino uno V3' to the architecture." followed by a description of what happened and a cyan action button for follow-up. The action result chips below messages (per source: `bg-primary/10 border border-primary/20 text-[10px] text-primary`) provide visual confirmation of executed actions.
**Status:** Pass. Clear action feedback with follow-up affordance.

---

#### CH-14: Destructive action confirmation dialog is a good safety pattern [No Issue]

**Location:** `chat/MessageBubble.tsx` — pending destructive actions block
**What:** Per source code, when the AI proposes destructive actions (like deleting nodes), an amber-bordered confirmation block appears with "Confirm destructive actions" header, individual action chips color-coded by risk, and "Apply Changes" / "Cancel" buttons. This prevents accidental destructive operations.
**Status:** Pass. Good safety mechanism.

---

### Section 11 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 1 | CH-01 |
| P2 (Medium) | 4 | CH-02, CH-03, CH-04, CH-05 |
| P3 (Polish) | 3 | CH-06, CH-07, CH-08 |
| Pass | 6 | CH-09, CH-10, CH-11, CH-12, CH-13, CH-14 |
| **Total** | **14** | |

## Section 12: Themes (12-themes/)

### Catalog Note

Only one screenshot captured for themes — the dark theme default state. No light theme variant exists in the app (dark-only design), so this is complete coverage for the current implementation.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 168_dark-theme-default.png | Full app in dark theme, Architecture view with Asset Library open | [!] |

### Findings

#### TH-01: Dark theme is well-executed and consistent across the app shell [No Issue]

**Screenshot:** 168
**What:** The dark theme screenshot shows the full 3-panel layout (sidebar, architecture canvas with Asset Library overlay, chat panel) with consistent dark theme application:

- Sidebar: `bg-sidebar/60` with `backdrop-blur-xl`, tree items in `text-muted-foreground`
- Architecture canvas: dark background with cyan-tinted grid dots, nodes with dark card backgrounds and cyan accent borders
- Asset Library: dark overlay with component list, green checkmarks and cyan "x1" badges for in-use parts
- Chat panel: dark card background, cyan-colored category labels, cyan send button
- Header tab bar: dark background, active "Architecture" tab with cyan text and top border accent

The dark theme tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-primary`) are applied consistently. Cyan (`hsl(185 100% 43%)`) is used effectively as the primary accent throughout.
**Status:** Pass.

---

#### TH-02: No theme toggle or light mode option exists [P3]

**Location:** App-wide — no theme toggle UI element found
**What:** The app uses a `ThemeProvider` (from `next-themes`) configured with `defaultTheme="system"` and `enableSystem`, but there is no visible UI control for users to switch themes. The entire app is designed exclusively for dark mode — the color tokens in `index.css` only define dark theme values. While this is consistent with EDA tool conventions (KiCad, Altium, VS Code all default to dark), users with visual preferences or accessibility needs (e.g., light-sensitive environments) have no way to switch.
**Fix:** This is a design decision, not a bug. If a light mode is ever planned, it would require defining `:root` (light) color tokens in addition to the existing `.dark` tokens. Low priority since EDA tools conventionally use dark themes.

---

#### TH-03: Asset Library component badges use inconsistent color semantics [P3]

**Screenshot:** 168
**Location:** Asset Library component list
**What:** Components already placed in the architecture (ESP32-S3-WROOM-1, SHT40, SX1262 LoRa, TP4056) show green checkmark + cyan "x1" badge. The green checkmark suggests "complete" or "verified" when it actually means "placed in project." This is a minor semantic mismatch — a blue/cyan dot or count-only badge would better communicate "in use" without implying validation status.
**Fix:** Consider replacing the green checkmark with a cyan dot or making the "x1" badge sufficient on its own (remove the checkmark). Minor polish.

---

### Section 12 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 0 | — |
| P2 (Medium) | 0 | — |
| P3 (Polish) | 2 | TH-02, TH-03 |
| Pass | 1 | TH-01 |
| **Total** | **3** | |

---

## Section 13: Modals/Dialogs (13-modals/)

### Catalog Note

Two screenshots captured: the Keyboard Shortcuts modal at full-app context (169) and a close-up element capture (170). This is the only modal/dialog captured in the catalog. Other modals known to exist (ConfirmDialog, GeneratorModal, DismissConfirmation) were not triggered during the screenshot session.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 169_keyboard-shortcuts-modal.png | Keyboard Shortcuts modal overlaying the full app | [!] |
| 2 | 170_el_keyboard-shortcuts-dialog.png | Close-up of the Keyboard Shortcuts dialog content | [x] |

### Findings

#### MD-01: Keyboard Shortcuts dialog is well-designed and readable [No Issue]

**Screenshots:** 169, 170
**Location:** `client/src/components/ui/keyboard-shortcuts-modal.tsx`
**What:** The Keyboard Shortcuts dialog displays cleanly:

- Title "Keyboard Shortcuts" with subtitle "Quick reference for available shortcuts."
- "ARCHITECTURE VIEW" section header in bold uppercase
- 7 shortcuts listed with descriptions left-aligned and key badges right-aligned
- Key badges use `font-mono text-[10px]` in dark `bg-muted border-border` capsules — visually distinct and readable
- Redo shows both alternatives: `Ctrl + Y` / `Ctrl + Shift + Z`
- Delete shows both: `Delete` / `Backspace`
- "NAVIGATION" section with the `?` shortcut to show the dialog itself
- Clean close button (X) in top-right corner with cyan focus ring

The dialog uses shadcn/ui `Dialog` component with `bg-card border-border max-w-md` — consistent with the app's dark theme.
**Status:** Pass.

---

#### MD-02: Keyboard Shortcuts only cover Architecture View — no other views [P2]

**Screenshots:** 169, 170
**Location:** `keyboard-shortcuts-modal.tsx` — hardcoded shortcut list
**What:** The dialog lists shortcuts under "ARCHITECTURE VIEW" and "NAVIGATION" only. No shortcuts are listed for:

- **Schematic View**: Has its own toolbar with 9 tools (likely has keyboard shortcuts or should)
- **Breadboard View**: Has Select/Wire/Delete tools
- **PCB View**: Has trace routing tools
- **Component Editor**: Has 8 drawing tools + ShapeCanvas interactions
- **Chat Panel**: Could benefit from shortcuts (e.g., focus chat input, send message)
- **Global**: No shortcut for switching views (e.g., `1`-`8` for view tabs), toggling sidebar, toggling chat

For a tool that aspires to compete with KiCad/Altium, comprehensive keyboard shortcuts across all views are essential. EDA power users rely heavily on keyboard shortcuts.
**Fix:**

1. Add view-specific sections that dynamically show based on the active view
2. Add global shortcuts: `Ctrl+1` through `Ctrl+8` for view switching, `Ctrl+B` for sidebar toggle, `Ctrl+J` for chat toggle
3. Consider a searchable shortcut list for discoverability (like VS Code's keybinding editor)

---

#### MD-03: No other modals/dialogs were captured — significant coverage gap [P2]

**What:** The app contains multiple modal/dialog types per source code that were not captured:

- **ConfirmDialog** — used for destructive actions (clear output, delete items)
- **GeneratorModal** — component generator wizard in Component Editor
- **DismissConfirmation** — validation issue dismissal confirmation
- **Destructive Action Confirmation** — amber-bordered AI action confirmation block
- **Delete Node Confirmation** — architecture node deletion
- **Export dialogs** — if any exist for file format selection

Without screenshots of these modals, we cannot audit their visual consistency, button placement, or accessibility.
**Fix:** Re-capture the catalog with trigger scripts that open each modal type.

---

### Section 13 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 0 | — |
| P2 (Medium) | 2 | MD-02, MD-03 |
| P3 (Polish) | 0 | — |
| Pass | 1 | MD-01 |
| **Total** | **3** | |

---

## Section 14: Responsive (14-responsive/)

### Catalog Note

This section has 37 screenshots across 4 breakpoints: tablet landscape (5), tablet portrait (4), mobile large (14), and mobile small (14). The mobile element captures (bottom nav individual icons at 186-194 and 200-208) are nearly invisible — tiny dark fragments that show almost nothing. The main viewport screenshots (181-182, 195-196) all show loading spinners, consistent with the systematic catalog timing issue. The tablet screenshots provide the best responsive coverage.

### Screenshots Reviewed

**Tablet Landscape — 1024×768 (5):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 172_responsive-tablet-landscape-default.png | Default view, loading spinner, 3-panel layout | [!] |
| 2 | 173_responsive-tablet-landscape-fullpage.png | Same as 172 (fullpage capture) | [x] |
| 3 | 174_responsive-tablet-landscape-architecture.png | Architecture with Asset Library open | [!] |
| 4 | 175_responsive-tablet-landscape-validation.png | Validation tab — ErrorBoundary crash | [!] |
| 5 | 176_responsive-tablet-landscape-component_editor.png | Component Editor — Metadata tab visible | [!] |

**Tablet Portrait — 768×1024 (4):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 6 | 177_responsive-tablet-portrait-default.png | 2-panel layout (sidebar + chat), loading spinner | [!] |
| 7 | 178_responsive-tablet-portrait-fullpage.png | Full-page capture, same layout (tiny) | [x] |
| 8 | 179_responsive-tablet-portrait-procurement.png | Procurement tab selected, chat dominates screen | [!] |
| 9 | 180_responsive-tablet-portrait-validation.png | Validation tab — ErrorBoundary crash visible | [!] |

**Mobile Large — 430×932 (14):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 10 | 181_responsive-mobile-large-default.png | Mobile layout: header + spinner + bottom nav | [!] |
| 11 | 182_responsive-mobile-large-fullpage.png | Same as 181 (fullpage) | [x] |
| 12 | 183_el_mobile-large-mobile-header.png | Mobile header bar: "Asset Library" + X | [x] |
| 13 | 184_el_mobile-large-menu-toggle.png | Hamburger menu button element (~24px) | [!] |
| 14 | 185_el_mobile-large-chat-toggle.png | Chat toggle X button element (~24px) | [!] |
| 15 | 186_el_mobile-large-bottom-nav.png | Bottom nav bar — too dark to evaluate | [!] |
| 16-22 | 187-194_el_mobile-large-bottom-nav-*.png | Individual bottom nav icons — nearly invisible | [!] |

**Mobile Small — 375×667 (14):**

| # | File | Description | Status |
|---|------|-------------|--------|
| 23 | 195_responsive-mobile-small-default.png | Same mobile layout as large, smaller viewport | [!] |
| 24 | 196_responsive-mobile-small-fullpage.png | Same as 195 (fullpage) | [x] |
| 25 | 197_el_mobile-small-mobile-header.png | Mobile header bar element | [x] |
| 26 | 198_el_mobile-small-menu-toggle.png | Hamburger button (~24px) | [!] |
| 27 | 199_el_mobile-small-chat-toggle.png | Chat toggle X button (~24px) | [!] |
| 28 | 200_el_mobile-small-bottom-nav.png | Bottom nav — partial text visible ("Long-range...", "TP4056") | [!] |
| 29-35 | 201-208_el_mobile-small-bottom-nav-*.png | Individual icons — nearly invisible fragments | [!] |

### Findings

#### RS-01: Mobile layout architecture is well-implemented [No Issue]

**Screenshots:** 181, 195
**Location:** `ProjectWorkspace.tsx` lines 148-171 (mobile header), 324-342 (bottom nav)
**What:** The mobile layout correctly implements a standard mobile app pattern:

- **Top**: Fixed header (`h-12`) with hamburger menu (left), centered "ProtoPulse" branding with icon, chat toggle (right)
- **Center**: Full-width content area with loading spinner
- **Bottom**: Fixed bottom navigation bar (`h-14`) with 8 view icons

The sidebar opens as a left-drawer overlay (`fixed inset-y-0 left-0 z-50 w-64`) with dark backdrop (`bg-black/50`). The chat opens as a right-drawer overlay (`fixed inset-y-0 right-0 z-50 max-w-[350px]`). Both use smooth `transition-transform` slide animations. This is a correct mobile-first pattern.
**Status:** Pass.

---

#### RS-02: Bottom navigation has 8 icon-only tabs — too many and unlabeled on phones [P1]

**Screenshots:** 181, 186, 195, 200
**Location:** `ProjectWorkspace.tsx` lines 324-342 — bottom nav rendering
**What:** The bottom nav displays 8 icons: Output, Architecture, Component Editor, Schematic, Breadboard, PCB, Procurement, Validation. Per source code, tab labels use `hidden sm:block text-[10px]` — labels are hidden below 640px (all phone viewports) and only shown on larger screens.

On a 375px phone:

- 8 icons at `w-5 h-5` (20px) with `px-3 py-1.5` padding = ~32px per icon
- 8 × 32px = 256px — fits but is cramped
- **No labels visible** — users must guess what each icon means
- Icons like `Cpu` (Component Editor), `Microchip` (PCB), and `CircuitBoard` (Schematic) look very similar at 20px
- The distinction between `Grid3X3` (Breadboard), `LayoutGrid` (Architecture), and `CircuitBoard` (Schematic) requires careful scrutiny

For comparison: iOS tab bars typically show 5 items maximum, with labels always visible. Material Design recommends 3-5 bottom nav items.

**Why it matters:** New users on mobile will struggle to find the right view. 8 unlabeled icons is a significant cognitive load. The similar icon shapes for electronics-related views (Schematic, Breadboard, PCB, Component Editor) compound the problem.

**Fix options:**

1. **Reduce to 5 primary tabs** + "More" overflow menu: Output, Architecture, Schematic, Procurement, Validation (hide Breadboard, PCB, Component Editor behind "More")
2. **Always show labels** — remove the `hidden sm:block` and use `text-[8px]` to fit labels on phones
3. **Scrollable bottom nav** with gradient fade affordance (like the quick actions bar, but with a visible scroll hint)
4. **Two-row grid** on mobile: 4 icons per row × 2 rows

---

#### RS-03: Tablet landscape 3-panel layout is cramped — sidebar and chat squeeze the canvas [P2]

**Screenshots:** 172, 174, 176
**Location:** `ProjectWorkspace.tsx` — 3-panel layout at 1024px width
**What:** At tablet landscape (1024×768), the 3-panel layout is preserved:

- Sidebar: 256px
- Chat: 350px
- Content: 1024 - 256 - 350 = ~418px

The architecture canvas in screenshot 174 shows the Asset Library overlay consuming the left half of the content area, leaving only ~200px for the actual canvas nodes. In screenshot 176, the Component Editor Metadata tab shows form fields (Title, Family, Description, etc.) at reasonable width, but the overall content area is tight.

**Why it matters:** At 1024px, allocating 606px (59%) to sidebar + chat leaves only 418px for the main workspace. EDA canvases need horizontal space for component placement and wiring. The Asset Library overlay further reduces usable canvas area.

**Fix:**

1. Auto-collapse sidebar at tablet widths (`< 1024px`): start with sidebar in collapsed icon-only state (`w-10`) instead of full width
2. Auto-collapse chat at tablet widths: start with chat collapsed, show the "AI ASSISTANT" strip
3. Reduce default sidebar width to 200px at tablet breakpoint
4. This is partially mitigable by the user manually collapsing panels, but defaults should optimize for the most common screen size

---

#### RS-04: Tablet portrait shows chat panel consuming >50% of visible width [P2]

**Screenshots:** 177, 179, 180
**Location:** `ProjectWorkspace.tsx` — layout at 768×1024
**What:** At 768px width (just above the mobile breakpoint), the desktop 3-panel layout is used:

- Sidebar: 256px (visible in 177, with full tree expanded)
- Chat: 350px
- Content: 768 - 256 - 350 = **162px**

Screenshots 179-180 show the chat panel taking roughly half the screen width. The content area between sidebar and chat is barely visible — just a loading spinner or error boundary. The tab bar at the top shows truncated tab names (only "Output", "Architecture" visible before truncation).

**Why it matters:** 162px of content area is unusable for any meaningful work. The architecture canvas, BOM table, schematic editor — none of these are functional at 162px width. Users at this breakpoint must manually collapse both sidebar and chat to use the app.

**Fix:**

1. Set the mobile breakpoint higher (e.g., 1024px instead of 768px) so tablet portrait uses the mobile layout with drawer overlays instead of the 3-panel squeeze
2. Or auto-collapse both sidebar and chat when viewport width is 768-1024px
3. The current `useIsMobile()` hook uses `MOBILE_BREAKPOINT = 768` — consider adding a `useIsTablet()` for 768-1024px with an intermediate layout

---

#### RS-05: Bottom nav individual icon screenshots are unusable — capture script issue [P2]

**Screenshots:** 186-194, 200-208 (16 screenshots)
**What:** The individual bottom nav icon captures (e.g., `187_el_mobile-large-bottom-nav-output.png`) are tiny near-black fragments — typically ~60×20px showing just a dark background with barely perceptible shapes. The capture script appears to have captured the DOM element at its natural size without any zoom or padding, resulting in images too small to evaluate.

The bottom nav bar itself (186, 200) is slightly more visible but still very dark — showing the bar area but with icons at such low contrast against the dark background that they're nearly invisible in the screenshots.

**Fix:** This is a catalog issue, not an app issue. Re-capture with:

1. Zoom into each icon area with padding
2. Use a white/contrasting background for element isolation
3. Or capture the full bottom nav bar at 2x resolution

---

#### RS-06: Mobile header hamburger and chat toggle buttons are appropriately sized [No Issue]

**Screenshots:** 183-185, 197-199
**Location:** `ProjectWorkspace.tsx` lines 152-169 — mobile header buttons
**What:** The mobile header buttons use `p-2` padding with `w-5 h-5` (20px) icons = ~36px total touch target. While still below the 44px WCAG 2.5.8 recommendation, this is standard for mobile app headers and matches iOS/Android conventions. The centered "ProtoPulse" branding with the `Layers` icon creates clear visual identity. The `MessageCircle` icon for chat is universally recognized.
**Status:** Pass (acceptable for mobile headers, though 44px would be ideal).

---

#### RS-07: Validation view crashes at all tested breakpoints — consistent with VL-01 [No Issue — Duplicate]

**Screenshots:** 175 (tablet landscape), 180 (tablet portrait)
**What:** Both tablet screenshots that navigated to Validation show the same ErrorBoundary crash screen ("Something went wrong rendering this section." + "Try Again" button). This confirms the VL-01 finding is not viewport-dependent — the crash occurs at all breakpoints.
**Status:** Duplicate of VL-01. No additional issue.

---

#### RS-08: Mobile bottom nav has no active state indicator beyond color [P3]

**Screenshots:** 181, 195
**Location:** `ProjectWorkspace.tsx` lines 330-337 — bottom nav button styling
**What:** The active bottom nav tab uses `text-primary` (cyan) while inactive tabs use `text-muted-foreground` (gray). There is no other visual distinction — no background highlight, no underline, no scale change. At 20px icon size with similar-looking icons, the color-only indicator may be insufficient for colorblind users or in bright ambient lighting on mobile.
**Fix:** Add a subtle background indicator: `bg-primary/10 rounded-lg` on the active icon, or a 2px dot below it. This is a standard material design pattern for bottom navigation.

---

#### RS-09: Tab bar truncates at tablet portrait — tab names cut off [P3]

**Screenshots:** 177, 179, 180
**Location:** `ProjectWorkspace.tsx` — desktop header tab bar
**What:** At 768px viewport width, the desktop header tab bar shows "Output" and "Architecture" then the remaining tabs are pushed off-screen or severely truncated. The 8 tabs with icons + labels don't fit in the ~500px available (768px minus sidebar toggle and chat toggle buttons). The tab bar has no scroll or overflow handling — tabs simply disappear.
**Fix:**

1. At tablet widths, switch to icon-only tabs (remove labels) in the header
2. Or use a scrollable tab bar with overflow indicator
3. Best fix: use mobile layout (bottom nav) at 768-1024px (see RS-04)

---

### Section 14 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 1 | RS-02 |
| P2 (Medium) | 3 | RS-03, RS-04, RS-05 |
| P3 (Polish) | 2 | RS-08, RS-09 |
| Pass | 2 | RS-01, RS-06 |
| Duplicate | 1 | RS-07 (VL-01) |
| **Total** | **9** | |

---

## Section 15: Error States (15-error-states/)

### Catalog Note

Only one error state captured — the 404 Page Not Found. Other error states (network errors, API failures, empty states) were not triggered during the screenshot session.

### Screenshots Reviewed

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | 171_404-not-found.png | 404 Page Not Found — light background, dark card | [!] |

### Findings

#### ES-01: 404 page uses light background — breaks dark theme completely [P1]

**Screenshot:** 171
**Location:** `client/src/pages/not-found.tsx`
**What:** The 404 page uses hardcoded light-theme Tailwind classes:

```tsx
<div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
  <Card className="w-full max-w-md mx-4">
    <CardContent className="pt-6">
      <AlertCircle className="h-8 w-8 text-red-500" />
      <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
      <p className="mt-4 text-sm text-gray-600">Did you forget to add the page to the router?</p>
    </CardContent>
  </Card>
</div>
```

The screenshot shows a stark white/light-gray (`bg-gray-50`) full-page background with a centered dark card. This is a jarring theme break — every other surface in the app is dark. The light background blinds users who have been working in the dark-themed workspace. It looks like a different application entirely.

**Why it matters:**

- **Visual consistency**: The 404 page is the one page that should feel branded and reassuring — instead it looks like a template placeholder
- **Accessibility**: Users in dark environments will be flash-blinded by the sudden white background
- **Developer message**: "Did you forget to add the page to the router?" is a developer-facing message, not user-facing

**Fix:**

1. Replace `bg-gray-50` with `bg-background` (inherits dark theme)
2. Replace `text-gray-900` with `text-foreground`
3. Replace `text-gray-600` with `text-muted-foreground`
4. Replace the developer message with user-friendly text: "The page you're looking for doesn't exist."
5. Add a "Go to Dashboard" button linking to `/projects/1`
6. Consider adding the ProtoPulse logo/branding for consistency

---

#### ES-02: 404 page has no navigation back to the app [P2]

**Screenshot:** 171
**Location:** `client/src/pages/not-found.tsx`
**What:** The 404 page shows just the error card with no navigation options. There is:

- No "Go Home" or "Back to Dashboard" button
- No link to the main workspace
- No ProtoPulse header/branding
- No breadcrumb or app shell

Users who land here (via a mistyped URL or stale bookmark) are stranded with no way back except manually editing the URL or using the browser back button.

**Fix:** Add a primary action button below the error message:

```tsx
<Button asChild className="mt-4">
  <a href="/projects/1">Back to Dashboard</a>
</Button>
```

Also consider showing a minimal header with the ProtoPulse branding to maintain context.

---

#### ES-03: ErrorBoundary fallback is the only other error state captured — no network/API error states [P3]

**What:** Beyond the 404 page and the ErrorBoundary crash (VL-01/VL-02), no other error states were captured:

- **Network disconnection** — what happens when the API is unreachable?
- **API error responses** — how do 500/400 errors display in the chat, BOM, or validation views?
- **AI streaming failure** — what if the AI provider returns an error mid-stream?
- **Image upload failure** — what if an attached image exceeds size limits?
- **Database connection loss** — how does the app degrade?

These states likely exist in the source code (error toasts, error messages in chat bubbles, loading fallbacks) but weren't triggered during the catalog capture.

**Fix:** This is a catalog coverage gap. A targeted error state capture session should:

1. Kill the API server and capture the resulting UI states
2. Provide an invalid API key and capture the AI chat error response
3. Upload an oversized image and capture the error feedback
4. Navigate to an invalid project ID and capture the response

---

### Section 15 Summary

| Priority | Count | IDs |
|----------|-------|-----|
| P0 (Critical) | 0 | — |
| P1 (High) | 1 | ES-01 |
| P2 (Medium) | 1 | ES-02 |
| P3 (Polish) | 1 | ES-03 |
| **Total** | **3** | |

---

## Additional Directories

The screenshot catalog contains 10 additional directories (02-navigation through 10-empty-states) that overlap with the primary 15 sections above. These were **not audited separately** because:

1. **02-navigation/** — Covered by Section 1 (App Shell) tab bar analysis and Section 14 (Responsive) mobile nav
2. **03-pages/** — Covered by Sections 3-11 (each view is a "page")
3. **04-components/** — Covered by Sections 3-11 component-level element captures
4. **05-modals-dialogs/** — Covered by Section 13 (Modals/Dialogs)
5. **06-forms/** — Covered by Section 11 (Chat settings form) and Section 4 (Component Editor metadata form)
6. **07-interactive-states/** — Partially covered by hover/click state analysis in each section
7. **08-loading-states/** — Extensively documented as part of the systematic catalog failure (Sections 4-9 loading spinners)
8. **09-error-states/** — Covered by Section 15 (Error States) and VL-01/VL-02
9. **10-empty-states/** — Not captured; would require fresh project with no data

These directories likely contain duplicate or near-duplicate screenshots already reviewed in the primary sections. A separate audit pass is recommended only if they contain **unique UI states** not captured elsewhere.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Screenshots | 208 |
| Sections | 15 primary + 10 supplementary |
| **Sections Reviewed** | **15 / 15** |
| **Unique Issues (P0-P3)** | **88** |
| P0 (Critical) | 2 |
| P1 (High) | 13 |
| P2 (Medium) | 47 |
| P3 (Polish) | 26 |
| Pass (No Issues) | 32 |
| Duplicate | 1 |
| Total Findings | 115 |

> **Note on counts:** Total Findings (115) includes per-section entries where some cross-referenced observations in Section 4 (CE-05→CE-14) overlap with canonical findings in Sections 5-7. The "Unique Issues" count (88) deduplicates these and includes 7 additional issues identified during consolidation of the earlier `UI_AUDIT_REPORT.md` tool-assisted audit. The Master Issue Checklist below lists each issue exactly once.

### Top Priority Issues

| ID | Priority | Summary |
|----|----------|---------|
| CE-01 | P0 | Component Editor view never rendered — only loading spinner captured |
| VL-01 | P0 | Validation view crashes with runtime error (ErrorBoundary catch) |
| ES-01 | P1 | 404 page uses light background — breaks dark theme |
| RS-02 | P1 | Bottom nav has 8 icon-only tabs — too many and unlabeled on phones |
| CH-01 | P1 | Message copy/regenerate buttons are hover-only — invisible and inaccessible |
| SC-02 | P1 | Schematic components lack pin labels — major convention violation |
| AV-01 | P1 | Asset add buttons are hover-only — invisible at rest |
| SB-01 | P1 | Timeline undo/redo buttons are hover-only |

### Systemic Patterns

**1. Hover-Only UI Anti-Pattern (4+ instances):**
Buttons using `opacity-0 group-hover:opacity-100` are invisible at rest, inaccessible on touch devices, and excluded from keyboard tab order. Found in: asset add buttons (AV-01), timeline undo/redo (SB-01), message copy/regenerate (CH-01), attached image remove (CH-08).

**2. Undersized Touch Targets (5+ instances):**
Buttons using `p-1.5` with `w-4 h-4` icons yield ~28px targets, well below the 44px WCAG 2.5.8 minimum. Found across: header tab bar, sidebar toggle, chat toggle, chat header buttons, component tree expand arrows.

**3. Screenshot Catalog Timing Failure (6 sections):**
Sections 4-9 mostly captured loading spinners or the Architecture view instead of their target views. The Playwright capture script did not wait for React Suspense lazy-loaded views to finish loading. Only Architecture, Sidebar, Breadboard, Output, and Chat were reliably captured.

**4. Over-Dimmed Information (3 instances):**
Important status text rendered at extremely low opacity: "Local Mode (No API Key)" at `text-[10px]/40%` (CH-04), token/cost info at `text-[10px]/50%` (CH-07), bottom nav labels hidden on mobile (RS-02).

### Catalog Quality Assessment

| Category | Quality | Notes |
|----------|---------|-------|
| App Shell (Sec 1) | Excellent | 16 screenshots, all correct |
| Sidebar (Sec 2) | Excellent | 17 screenshots, all correct |
| Architecture (Sec 3) | Excellent | 24 screenshots, all correct |
| Component Editor (Sec 4) | Poor | Loading spinner only; miscategorized shots from other views |
| Schematic (Sec 5) | Partial | Only via miscategorized shots in Section 4 |
| Breadboard (Sec 6) | Good | Correctly captured via miscategorized Section 4 shots |
| PCB (Sec 7) | Partial | Only via miscategorized shots in Section 4 |
| Procurement (Sec 8) | Poor | Loading spinner only |
| Validation (Sec 9) | Diagnostic | Captured a real P0 crash |
| Output (Sec 10) | Excellent | Correct capture with data |
| Chat (Sec 11) | Excellent | 30 screenshots, best-covered section |
| Themes (Sec 12) | Adequate | 1 screenshot, dark-only app |
| Modals (Sec 13) | Minimal | Only keyboard shortcuts modal |
| Responsive (Sec 14) | Mixed | Good viewport shots, unusable element captures |
| Error States (Sec 15) | Minimal | Only 404 page |

### Recommended Re-Capture Priority

1. **Fix VL-01** (Validation crash), then re-capture Validation view in all states
2. **Re-capture Component Editor** with explicit wait for Suspense/lazy load completion
3. **Re-capture Procurement** (BOM table with data loaded)
4. **Trigger and capture all modal types** (ConfirmDialog, GeneratorModal, etc.)
5. **Capture error states** by simulating network/API failures
6. **Re-capture mobile bottom nav** at higher resolution with padding

### Systemic Catalog Issue

**Sections 4-9 share a systematic screenshot catalog failure.** Of the ~30 screenshots across sections 4-9, only Breadboard (Section 6) and Output (Section 10) correctly captured their target views. The Component Editor, Schematic, PCB, and Procurement directories contain loading spinners or Architecture view screenshots. The Validation directory captured a **runtime crash** (ErrorBoundary fallback), revealing a real P0 bug in the application.

**Views never captured:** Component Editor, Procurement (BOM table), Validation (working state)
**Views only captured via miscategorization:** Schematic (in 04-component-editor/108-109), PCB (in 04-component-editor/110-111)
**Views correctly captured:** Architecture, Sidebar, Breadboard, Output, Chat

**A targeted re-capture of Sections 4, 5, 7, 8, and 9 is required** after fixing the Validation crash (VL-01).

---

## Master Issue Checklist

Every issue found during this audit, organized by priority. Check the box when resolved. Issues marked with `(catalog)` are screenshot catalog problems, not application bugs.

> **Note:** Section 4 cross-references (CE-05 through CE-14) pointed to findings in Sections 5-7 and are listed under their canonical section IDs below to avoid double-counting. Includes 7 additional issues from `UI_AUDIT_REPORT.md` consolidation (see appendix). **88 unique issues total.**

### P0 — Critical (2)

- [ ] **CE-01** — Component Editor view never rendered — only loading spinner captured *(catalog)*
  - Section 4 | `ProjectWorkspace.tsx` ViewLoadingFallback | Re-capture with explicit Suspense wait
- [x] **VL-01** — Validation view crashes with unhandled rendering error
  - Section 9 | `ValidationView.tsx` useMemo computations | Wrap in try/catch, guard loading states

### P1 — High (13)

- [x] **AS-01** — Bare loading spinner in main content area — no skeleton, no text, no context
  - Section 1 | `ProjectWorkspace.tsx:77-83` ViewLoadingFallback | Add skeleton + "Loading view..." text
- [x] **AS-02** — "Output" tab positioned first in tab bar — should be last
  - Section 1 | `ProjectWorkspace.tsx:124-134` tabs array | Reorder: Architecture first, Output last
- [x] **SB-01** — Timeline undo/redo buttons are invisible (hover-only `opacity-0`)
  - Section 2 | Sidebar timeline entries | Show persistently at reduced opacity
- [x] **AV-01** — "Add to canvas" button is hover-only — invisible to most users
  - Section 3 | Asset Library item row | Show persistently at reduced opacity
- [ ] **CE-03** — Screenshot catalog miscategorization — 14 of 16 images in wrong directory *(catalog)*
  - Section 4 | Capture script | Fix navigation timing + view detection
- [ ] **SC-01** — Schematic directory captures show Architecture view — zero schematic coverage *(catalog)*
  - Section 5 | Capture script | Wait for `data-testid="schematic-view"` before capture
- [x] **SC-02** — Schematic component bodies lack internal pin labels — major convention violation
  - Section 5 | `SchematicCanvas.tsx` SchematicInstanceNode | Render pin names/numbers inside body
- [ ] **PCB-01** — PCB directory captures show Architecture view — zero PCB Layout coverage *(catalog)*
  - Section 7 | Capture script | Wait for `data-testid="pcb-layout-view"` before capture
- [ ] **PR-01** — Procurement view was never captured — zero BOM table coverage *(catalog)*
  - Section 8 | Capture script | Wait for `data-testid="procurement-view"` before capture
- [ ] **VL-03** — Validation view was never captured in its working state *(catalog)*
  - Section 9 | Depends on VL-01 fix | Re-capture after crash fix
- [x] **CH-01** — Message copy/regenerate buttons are hover-only — invisible and inaccessible
  - Section 11 | `chat/MessageBubble.tsx` | Show persistently at `opacity-40`, increase to `w-4 h-4`
- [x] **RS-02** — Bottom nav has 8 icon-only tabs — too many, unlabeled on phones
  - Section 14 | `ProjectWorkspace.tsx:324-342` | Reduce to 5 tabs + "More", or always show labels
- [x] **ES-01** — 404 page uses hardcoded light background — breaks dark theme completely
  - Section 15 | `client/src/pages/not-found.tsx` | Replace `bg-gray-50` with `bg-background`, `text-gray-900` with `text-foreground`

### P2 — Medium (41)

**App Shell (6):**

- [x] **AS-03** — Header branding element has no `data-testid`
  - `SidebarHeader.tsx` | Add `data-testid="header-branding"`
- [x] **AS-04** — Sidebar and chat toggle buttons are too small (~28px) and low-contrast
  - `ProjectWorkspace.tsx` | Bump to `p-2` padding, `w-5 h-5` icons
- [x] **AS-05** — Tab overflow has no scroll indicator at narrow widths
  - `ProjectWorkspace.tsx` tab bar | Add gradient fade or scroll arrows
- [x] **AS-06** — Chat quick actions bar has no scroll affordance (hidden scrollbar)
  - `QuickActionsBar.tsx` | Remove `no-scrollbar`, add fade hint
- [x] **AS-07** — "Local Mode (No API Key)" status lacks guidance — no link to settings
  - `MessageInput.tsx` | Make clickable, link to settings panel
- [x] **AS-08** — No project context visible when sidebar is collapsed
  - Sidebar collapsed state | Show project name tooltip or mini-label

**Sidebar (5):**

- [x] **SB-02** — Timeline entry text truncation with no expand mechanism
  - Sidebar timeline | Add tooltip or click-to-expand
- [x] **SB-03** — Collapsed sidebar doesn't show a navigation rail with view icons
  - `Sidebar.tsx` collapsed state | Add icon rail for quick view switching
- [x] **SB-04** — Project Settings section has no visual boundary separating it from timeline
  - `Sidebar.tsx` | Add `border-t` or spacing above Project Settings
- [x] **SB-05** — Timeline filter buttons (All/User/AI) are undersized with low contrast
  - Sidebar timeline filters | Increase padding, improve active/inactive contrast
- [x] **SB-06** — "Project Settings" button position is easy to miss at bottom of sidebar
  - `Sidebar.tsx` | Add subtle top border or icon to increase visibility

**Architecture View (6):**

- [x] **AV-02** — Asset Library category filter icons are too small to identify
  - Asset Library header icons | Increase size, add tooltips with category names
- [x] **AV-03** — Asset Library panel obscures canvas nodes behind it
  - Asset Library overlay | Consider push-aside layout or transparency controls
- [x] **AV-04** — Pan mode vs. select mode is visually indistinguishable in static screenshots
  - Canvas toolbar | Add cursor change indicator or mode label in status bar
- [x] **AV-05** — Canvas toolbar icons are small and unlabeled
  - Architecture toolbar | Add tooltips with keyboard shortcuts, consider labels
- [x] **AV-06** — Edge color coding (cyan/red/yellow) has no legend or explanation
  - Architecture canvas | Add legend overlay or tooltip on edge hover
- [x] **AV-07** — Asset manager toggle button is tiny (~24px) and ambiguous icon
  - Architecture toolbar | Increase size, use clearer icon or add label

**Component Editor (1):**

- [ ] **CE-02** — Fullpage capture resolved to Architecture view instead of Component Editor *(catalog)*
  - Capture script | Fix fullpage capture timing

**Schematic (3):**

- [x] **SC-03** — Component bodies are oversized relative to pin count
  - `SchematicCanvas.tsx` | Scale body height from pin count: `max(pinsPerSide) * pinPitch`
- [x] **SC-04** — Over half the schematic toolbar tools are disabled ("coming soon")
  - `SchematicCanvas.tsx` toolbar | Remove disabled tools or wire to sidebar functionality
- [x] **SC-05** — Floating toolbar may overlap canvas content at top-left origin
  - `SchematicCanvas.tsx` | Offset default view bounds or make toolbar movable

**Breadboard (4):**

- [x] **BB-01** — Breadboard canvas has massive unused empty space — board not centered
  - `BreadboardCanvas.tsx` | Auto-center and fitView() on mount
- [x] **BB-02** — No empty-state guidance on the breadboard canvas
  - `BreadboardView.tsx` | Add status bar: "Select Wire tool (2) to route connections"
- [x] **BB-03** — No component placement mechanism — relies entirely on Schematic view
  - `BreadboardView.tsx` | Add guidance text or minimal component sidebar
- [x] **BB-04** — Toolbar icons are small (`w-3.5 h-3.5` = 14px) and unlabeled
  - `BreadboardCanvas.tsx` ToolButton | Increase to `w-4 h-4`, add tooltips with shortcuts

**PCB (3):**

- [x] **PCB-02** — Empty PCB board outline with no guidance or legend
  - `PCBCanvas.tsx` | Add empty-state text + board dimension label
- [x] **PCB-03** — Layer selector "F.Cu" badge is compact but not obviously interactive
  - `PCBCanvas.tsx` pcb-layer-toggle | Add chevron arrow, show full name on hover
- [x] **PCB-05** — PCB has no component placement mechanism — same limitation as Breadboard
  - `PCBLayoutView.tsx` | Add guidance about Schematic-first workflow

**Procurement (1):**

- [ ] **PR-02** — Procurement element captures are from other views *(catalog)*
  - Capture script | Replace with actual Procurement elements

**Validation (1):**

- [x] **VL-02** — ErrorBoundary fallback provides no diagnostic information
  - `ValidationView.tsx` | Added `ValidationErrorBoundary` with diagnostic error message (dev mode), retry button, and helpful guidance text

**Output (1):**

- [x] **OU-01** — "BASH / LINUX" label appears interactive but is static text (false affordance)
  - `OutputView.tsx` header | Remove entirely or restyle as non-interactive metadata

**Chat Panel (4):**

- [x] **CH-02** — Quick actions bar has no scroll affordance — last 4 of 7 buttons hidden
  - `QuickActionsBar.tsx` | Wrap to multiple rows or add scroll gradient hint
- [x] **CH-03** — Header action buttons (search/export/settings) are tiny (~28px) and icon-only
  - `chat/ChatHeader.tsx` | Bump to `p-2` padding, `w-5 h-5` icons
- [x] **CH-04** — "Local Mode (No API Key)" status is nearly invisible at `text-[10px]/40%`
  - `chat/MessageInput.tsx` | Increase to `text-xs/70%`, amber color when no API key
- [x] **CH-05** — Settings panel replaces messages instead of overlaying — context loss
  - `ChatPanel.tsx` | Use modal/dialog overlay instead of view replacement

**Modals/Dialogs (2):**

- [x] **MD-02** — Keyboard Shortcuts only cover Architecture View — no other views listed
  - `keyboard-shortcuts-modal.tsx` | Add sections for Schematic, Breadboard, PCB, global shortcuts
- [ ] **MD-03** — No other modals/dialogs were captured — significant coverage gap *(catalog)*
  - Capture script | Trigger ConfirmDialog, GeneratorModal, etc. during capture

**Responsive (3):**

- [x] **RS-03** — Tablet landscape (1024px) 3-panel layout is cramped — 418px content area
  - `ProjectWorkspace.tsx` | Auto-collapse sidebar at tablet widths
- [x] **RS-04** — Tablet portrait (768px) chat panel consumes >50% width — 162px content area
  - `ProjectWorkspace.tsx` | Raise mobile breakpoint to 1024px or auto-collapse panels
- [ ] **RS-05** — Bottom nav individual icon screenshots are unusable — tiny dark fragments *(catalog)*
  - Capture script | Re-capture with zoom/padding

**Error States (1):**

- [x] **ES-02** — 404 page has no navigation back to the app — user is stranded
  - `not-found.tsx` | Add "Back to Dashboard" button linking to `/projects/1`

### P3 — Polish (25)

**App Shell (5):**

- [x] **AS-09** — Timeline count notation "(4)" inconsistent with tree count badges "5"
  - Sidebar sections | Unify to one badge style
- [x] **AS-10** — Tab text size is small at `text-xs` (12px) — hard to read at distance
  - `ProjectWorkspace.tsx` tabs | Consider `text-sm` (14px)
- [x] **AS-11** — Inactive tab icon visual weight varies across different Lucide icons
  - Tab icons | Review icon selection for consistent stroke weight
- [x] **AS-12** — Active tab top accent line (`h-[2px]`) is subtle — easy to miss
  - Tab active state | Consider `h-[3px]` or adding background tint
- [x] **AS-14** — Chat panel header icons are small (~28px) and unlabeled
  - `ChatHeader.tsx` | Already fixed by CH-03 (buttons bumped to `w-9 h-9` = 36px)

**Sidebar (4):**

- [x] **SB-07** — Timeline live indicator (pulsing green dot) is functionally invisible
  - Sidebar timeline | Increase dot size or add "Live" text label
- [x] **SB-08** — Block tree nodes lack interactive affordance cues (no hover highlight)
  - Sidebar tree | Add hover background tint
- [x] **SB-09** — Count badge styling is inconsistent across sidebar sections
  - Sidebar | Unify badge size, color, and positioning
- [x] **SB-10** — Search input is functional but visually flat — blends into background
  - Sidebar search | Add subtle border or inner shadow

**Architecture View (3):**

- [x] **AV-08** — Asset items show canvas content bleeding through panel (`bg-card/60`)
  - Asset Library | Increase opacity or add solid background
- [x] **AV-09** — Context menu lacks keyboard shortcut hints
  - Architecture context menu | Add shortcut text (e.g., "Delete    Del")
- [x] **AV-10** — Node connection handles are subtle at rest (4px circles)
  - Architecture nodes | Increase handle size on hover, add pulsing on empty ports

**Component Editor (1):**

- [ ] **CE-04** — Six exact duplicate screenshots in catalog (112-117 = 106-111) *(catalog)*
  - Capture script | Deduplicate

**Schematic (1):**

- [x] **SC-06** — Net wire label "Net_PB5_PB0" is auto-generated and cryptic
  - Schematic wires | Allow user-assigned net names via Net Label tool

**PCB (2):**

- [x] **PCB-04** — Trace width slider may be imprecise for standard engineering values
  - `PCBCanvas.tsx` | Add preset buttons for standard widths (0.2, 0.25, 0.5, 1.0, 2.0mm)
- [x] **PCB-07** — Board dimensions are hardcoded at 50mm x 40mm — no UI to change
  - `PCBCanvas.tsx` | Add board properties dialog for custom dimensions

**Output (1):**

- [x] **OU-02** — Console log entries have limited initial content — only 3 canned messages
  - OutputContext | Consider timestamps, guidance text below initial entries

**Chat Panel (3):**

- [x] **CH-06** — Input area buttons may overlap text at narrow chat widths
  - `chat/MessageInput.tsx` | Increase `pr-20` to `pr-24` or move buttons to separate row
- [x] **CH-07** — Token/cost info is extremely small and over-dimmed (`text-[10px]/50%`)
  - `chat/MessageBubble.tsx` | Increase to `text-[11px]/60%`
- [x] **CH-08** — Attached image remove button is hover-only — same pattern as CH-01
  - `chat/MessageInput.tsx` | Show "X" badge persistently

**Themes (2):**

- [~] **TH-02** — No theme toggle or light mode option exists — **Won't Fix (Design Decision)**: Dark theme is the standard for EDA tools; a ThemeToggle component already exists in the header for future use if needed
  - App-wide | Design decision; low priority for EDA tool
- [ ] **TH-03** — Asset Library component badges use green checkmark (suggests "verified" not "placed") *(Deferred: AssetGrid.tsx owned by another agent)*
  - Asset Library | Replace with cyan dot or count-only badge

**Responsive (2):**

- [x] **RS-08** — Mobile bottom nav has no active state indicator beyond color change
  - `ProjectWorkspace.tsx` bottom nav | Add `bg-primary/10` background on active icon
- [x] **RS-09** — Tab bar truncates at tablet portrait — names cut off, no overflow handling
  - Desktop header tabs | Switch to icon-only at narrow widths

**Error States (1):**

- [ ] **ES-03** — No network/API error states captured — only 404 and ErrorBoundary seen *(catalog)*
  - Capture script | Simulate API failures, capture resulting UI states

### New Issues from UI_AUDIT_REPORT.md Consolidation (7)

The following issues were identified in the earlier `UI_AUDIT_REPORT.md` audit (23 screenshots, tool-assisted metrics) and are **not covered** by the 208-screenshot visual audit above. They are added here as canonical findings.

**P2 (6):**

- [x] **CC-01** — Systemic low-contrast secondary text/metadata across all dark surfaces — WCAG AA failure
  - App-wide | `mean_lum` 5.0-21.7, OCR captured 0 chars on most dark views | Raise `--text-muted-foreground` to ≥4.5:1 ratio against `--background`
- [x] **CC-02** — Focus-visible ring states are unverified and likely insufficient
  - App-wide | No focus-ring evidence in any screenshot | Add `focus-visible:ring-2 ring-primary ring-offset-2` to all interactive elements
- [x] **PR-03** — Procurement inline edit state is visually indistinguishable from read state (pHash distance 0)
  - `ProcurementView.tsx` | Edit row needs `bg-cyan-950/40 ring-1 ring-cyan-400/60` + "Editing" badge
- [x] **PR-04** — Procurement/validation tables have weak scanability — no row grouping, no density controls
  - `ProcurementView.tsx`, `ValidationView.tsx` | Add zebra striping, sticky header, section separators, density toggle
- [ ] **BB-07** — Breadboard error toast lacks actionable remediation CTA
  - `BreadboardView.tsx` | Error toast should include "Retry" / "Open diagnostics" action buttons
- [x] **FM-01** — Form fields across app lack visible inline validation error states
  - `ComponentEditorView.tsx`, Add BOM Item modal | Add per-field validation feedback with `text-rose-300` error text + `aria-describedby`

**P3 (1):**

- [x] **MD-04** — Generate Package modal has high card density with weak section hierarchy
  - `GeneratorModal` | Group template cards with section separators, increase scrollbar contrast

---

## Appendix A: UI_AUDIT_REPORT.md Consolidation

> **Source:** `docs/audit-screenshots/UI_AUDIT_REPORT.md` — a tool-assisted audit of 23 screenshots using `tesseract` OCR, `cv2`/`skimage` visual metrics, `imagehash` pHash similarity, and `pngcheck`/`exiftool` integrity checks. Conducted prior to the 208-screenshot full catalog audit above.

### Cross-Reference Mapping (UI-001 → UI-012)

The earlier audit identified 12 issues (UI-001 through UI-012). Below shows how each maps to findings in this consolidated checklist:

| UI_AUDIT ID | Severity | Finding | Mapped To |
|-------------|----------|---------|-----------|
| UI-001 | Critical | Login route resolves to 404 | **ES-01** (light bg), **ES-02** (no nav back) |
| UI-002 | High | Low contrast secondary text/metadata in dark theme | **CC-01** (new, systemic contrast) |
| UI-003 | High | Inline edit mode not visually distinct (pHash distance 0) | **PR-03** (new, procurement edit) |
| UI-004 | High | Weak empty/loading state guidance | **AS-01** (loading spinner), **BB-02** (breadboard empty), **PCB-02** (PCB empty) |
| UI-005 | High | Collapsed sidebar icon-only nav hurts discoverability | **SB-03** (no icon rail) |
| UI-006 | Medium | Dense tabular content slows scanning | **PR-04** (new, table scanability) |
| UI-007 | Medium | AI settings panel overloads right rail | **CH-05** (settings replaces messages) |
| UI-008 | Medium | Sidebar settings are cramped and low-emphasis | **SB-04** (no boundary), **SB-06** (easy to miss) |
| UI-009 | Medium | Error toast lacks clear remediation action | **BB-07** (new, breadboard toast CTA) |
| UI-010 | Medium | Validation/error states not visible in forms | **FM-01** (new, inline validation) |
| UI-011 | Medium | Screenshot evidence contains seam/duplication artifact | Catalog quality issue (noted in Sec 8) |
| UI-012 | Low | PNG files have large optimization potential | Not tracked (docs asset optimization, out of scope) |

### Per-Screenshot Evaluation Grid (Summary)

The earlier audit evaluated each of its 23 screenshots across 15 dimensions. Key:

- `VH` visual hierarchy, `AG` alignment/grid, `SS` spacing scale, `TH` typography, `CC` contrast/semantic color, `CS` component consistency, `IA` interaction affordance, `FB` feedback visibility, `ESL` error/empty/loading, `NAV` location awareness, `CDS` content density/scanability, `TO` truncation/overflow, `TT` touch target sizing, `AC` accessibility cues, `TS` trust/safety cues

**Systemic failures (failed on >50% of screenshots):**

- `CC` (contrast/semantic color) — failed on 22/23 screenshots
- `AC` (accessibility cues) — failed on 22/23 screenshots
- `TH` (typography) — failed on 17/23 screenshots
- `CDS` (content density) — failed on 13/23 screenshots

**Consistently passing:**

- `AG` (alignment/grid) — passed on 22/23 screenshots
- `SS` (spacing scale) — passed on 22/23 screenshots

### Consistency / Drift Analysis

**Components varying without clear rationale:**

- Sidebar collapsed patterns differ significantly between captures (pHash distance 28), suggesting version/style drift
- Procurement inline-edit vs default views are visually near-identical (pHash distance 0), reducing affordance clarity
- Output and project-settings captures are near-duplicates (pHash distance 4), indicating settings may be under-signaled

**Token drift:**

- Contrast drift: secondary text and placeholder readability varies across views
- Surface depth drift: modal/card overlays use inconsistent darkness and border emphasis
- Spacing drift: sidebar settings and table rows use tighter spacing than editor forms

**Style mismatches:**

- 404 page is a light page, breaking dark-shell continuity (→ ES-01)
- Breadboard introduces a distinct visual style not aligned to other editors
- Screenshot pipeline inconsistencies introduce false visual regressions

---

## Appendix B: Design Token Harvest

Suggested token set inferred from repeated patterns across all audited screenshots. These would standardize the visual language and resolve many P2 contrast/consistency issues.

### Color Tokens

| Token | Suggested Value | Rationale |
|-------|----------------|-----------|
| `--color-bg-canvas` | `#05080f` | Primary dark workspace background |
| `--color-bg-surface` | `#0b1220` | Panels, modals, tables |
| `--color-border-subtle` | `#223149` | Card and field boundaries |
| `--color-text-primary` | `#e8f1ff` | Main readable text |
| `--color-text-secondary` | `#a8bbd6` | Body secondary copy (≥4.5:1 on canvas) |
| `--color-text-muted` | `#7f93b0` | Meta labels (≥3:1 for large text) |
| `--color-accent` | `#16d9ff` | Active tab, button, focus ring |
| `--color-success` | `#17d98a` | In-stock, success badges |
| `--color-warning` | `#f5c451` | Warning badges |
| `--color-danger` | `#ff4d6d` | Critical, error states |

### Spacing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Micro gaps, inline icon padding |
| `--space-2` | `8px` | Control spacing, button padding |
| `--space-3` | `12px` | Tight content blocks |
| `--space-4` | `16px` | Default section spacing |
| `--space-6` | `24px` | Panel padding |

### Shape Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Inputs, chips, badges |
| `--radius-md` | `10px` | Cards, modals, dropdowns |

### Typography Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--font-size-body` | `14px` | Dense desktop readability baseline |
| `--font-size-meta` | `12px` | Meta labels (with increased contrast) |

> **Relationship to shadcn/ui:** These tokens complement rather than replace the existing shadcn/ui CSS variables (`--background`, `--foreground`, `--muted-foreground`, etc.). The issue is that current values for `--muted-foreground` and `--border` are too dim for WCAG AA compliance on the dark surfaces used throughout ProtoPulse. Updating the shadcn/ui variables in `tailwind.config.ts` or `globals.css` to match these suggested values would resolve CC-01 and multiple P2 contrast issues.

---

## Appendix C: Implementation Code Examples

Implementation-oriented snippets aligned with the project stack (React + Tailwind + shadcn/ui). Each addresses one or more checklist issues.

### 1) Stronger Dark Theme Text Tokens (CC-01)

```css
/* In globals.css or tailwind config — update existing shadcn/ui dark theme values */
:root {
  --bg-canvas: #05080f;
  --bg-surface: #0b1220;
  --text-primary: #e8f1ff;
  --text-secondary: #a8bbd6;
  --text-muted: #7f93b0;
  --border-subtle: #223149;
  --focus-ring: #16d9ff;
}
```

### 2) Focus Visible Pattern — WCAG 2.2 (CC-02)

```tsx
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05080f]">
  Run DRC Checks
</button>
```

### 3) Reusable Empty State Component (AS-01, BB-02, PCB-02)

```tsx
export function EmptyState({ title, detail, cta }: { title: string; detail: string; cta?: React.ReactNode }) {
  return (
    <section className="mx-auto mt-16 max-w-lg rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</p>
      {cta ? <div className="mt-4">{cta}</div> : null}
    </section>
  );
}
```

### 4) Inline Edit Emphasis for Procurement Row (PR-03)

```tsx
<tr className={isEditing ? "bg-cyan-950/40 ring-1 ring-cyan-400/60" : ""}>
  {/* cells */}
  {isEditing && <td className="text-xs text-cyan-300">Editing</td>}
</tr>
```

### 5) Table Header/Row Scanability (PR-04)

```tsx
<thead className="sticky top-0 bg-[#0d1626] text-[11px] uppercase tracking-wide text-[#b7c9e4]">
```

### 6) Collapsed Sidebar with Label Tooltips (SB-03)

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <button aria-label="Validation" className="h-9 w-9">...</button>
  </TooltipTrigger>
  <TooltipContent side="right">Validation</TooltipContent>
</Tooltip>
```

### 7) Loading State with Timeout Fallback (AS-01)

```tsx
{isLoading ? (
  <EmptyState
    title="Loading Architecture"
    detail="Fetching nodes and connections..."
    cta={isSlow ? <button onClick={refetch}>Retry</button> : undefined}
  />
) : children}
```

### 8) Form Validation Message Pattern (FM-01)

```tsx
{error?.partNumber && (
  <p id="partNumber-error" className="mt-1 text-xs text-rose-300" role="alert">
    Part number is required and must be at least 3 characters.
  </p>
)}
```

### 9) Not-Found Recovery Screen (ES-01, ES-02)

```tsx
<section className="mx-auto mt-24 max-w-md rounded-lg border border-rose-500/40 bg-background p-6">
  <h1 className="text-xl font-semibold text-foreground">Page Not Found</h1>
  <p className="mt-2 text-sm text-muted-foreground">
    We couldn't find that route. Return to your workspace or sign in again.
  </p>
  <div className="mt-4 flex gap-2">
    <Link to="/">Go to Workspace</Link>
    <Link to="/auth/login">Sign In</Link>
  </div>
</section>
```

### 10) Breadboard Error Toast with Actions (BB-07)

```tsx
toast.error("Failed to load breadboard data", {
  action: {
    label: "Retry",
    onClick: () => refetch(),
  },
  description: "Check network connection or open diagnostics.",
});
```

---

## Appendix D: Coverage Matrix (States × Viewports)

Coverage of application states across viewports, combining both audit sources. Gaps indicate areas needing targeted re-capture or implementation.

| View | Default | Selected | Inline Edit | Modal | Loading | Error | Empty | Collapsed Sidebar | Full Sidebar | Desktop | Tablet | Mobile |
|------|---------|----------|-------------|-------|---------|-------|-------|-------------------|--------------|---------|--------|--------|
| Architecture | Yes | Yes | N/A | N/A | Yes | N/A | Partial | Yes | Yes | Yes | Yes (Sec 14) | Yes (Sec 14) |
| Component Editor | **No** (spinner) | N/A | N/A | Yes (generate) | Yes | N/A | N/A | N/A | N/A | Yes | No | No |
| Schematic | Partial (mis-cat) | N/A | N/A | N/A | N/A | N/A | Partial | N/A | N/A | Yes | No | No |
| Breadboard | Yes | N/A | N/A | N/A | N/A | Yes (toast) | N/A | N/A | N/A | Yes | No | No |
| PCB | Partial (mis-cat) | N/A | N/A | N/A | N/A | N/A | Yes (weak) | N/A | N/A | Yes | No | No |
| Procurement | **No** (spinner) | N/A | Unverified | Yes (add item) | N/A | N/A | N/A | N/A | N/A | Yes | No | No |
| Validation | **No** (crash) | N/A | N/A | N/A | N/A | Yes (crash) | N/A | Yes | Yes | Yes | No | No |
| Output | Yes | N/A | N/A | Settings drawer | N/A | N/A | Partial | N/A | N/A | Yes | No | No |
| Chat Panel | Yes | N/A | N/A | N/A | N/A | N/A | Yes | N/A | N/A | Yes | No | No |
| Login/Auth | **No** (broken) | N/A | N/A | N/A | N/A | Yes (404) | N/A | N/A | N/A | Yes | No | No |

**Missing coverage flags:**

- Hover/focus/disabled states: **Missing** across all views
- Mobile/tablet responsive for non-Architecture views: **Missing**
- Form validation error states: **Largely missing**
- Confirm/danger dialog flows: **Missing**
- Multi-project switching: **N/A** (single project hardcoded)

---

## Appendix E: Layout Mockups

### Current Layout Pattern (Before)

```
+---------------------------------------------------------------+
| Top tabs                                                      |
+------+---------------------------------------+----------------+
| Left | Main content (dense/low contrast)     | Right AI panel |
| nav  |                                       | always open     |
+------+---------------------------------------+----------------+
```

### Improved Layout Pattern (After)

```
+---------------------------------------------------------------+
| Top tabs + context actions                                    |
+------+-----------------------------------------------+--------+
| Left | Main content with stronger hierarchy           | AI     |
| nav  | - clear headings                              | panel  |
|      | - grouped table sections                      | toggle |
|      | - empty/loading/error helper blocks           |        |
+------+-----------------------------------------------+--------+
```

### Table Row Editing (Target for PR-03)

```
[STATUS] [PART] [MFG] [DESC] [QTY] [PRICE] [TOTAL] [ACTIONS]
<normal row — default styling>
<EDITING ROW — cyan tint + "Editing" badge + save/cancel pinned>
<normal row — default styling>
```

### Mobile Layout (768px breakpoint)

```
+---------------------------+
| ☰  ProtoPulse        💬  |  ← hamburger + chat toggle
+---------------------------+
|                           |
|   Main content area       |
|   (single view)           |
|                           |
+---------------------------+
| 🔲 🔲 🔲 🔲 🔲 🔲 🔲 🔲 |  ← 8 icons (RS-02: too many)
+---------------------------+

Target (5 + "More"):
+---------------------------+
| ☰  ProtoPulse        💬  |
+---------------------------+
|                           |
|   Main content area       |
|   (single view)           |
|                           |
+---------------------------+
| 🔲  🔲  🔲  🔲  🔲  ⋯  |  ← 5 primary + overflow menu
+---------------------------+
```

---

## Appendix F: Typography Scale Analysis

Observed effective type scale appears clustered around tiny labels + body text without sufficient separation for visual hierarchy.

### Current (Observed)

| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Tab labels | 12px (`text-xs`) | 400 | Hard to read at distance (AS-10) |
| Body text | 14px (`text-sm`) | 400 | Acceptable |
| Meta labels | 10-11px | 400 | Over-dimmed (CH-04, CH-07) |
| Headings | ~14-16px | 500-600 | Insufficient separation from body |

### Recommended Scale

| Role | Size/Leading | Weight | Contrast Target |
|------|-------------|--------|----------------|
| Page title | 24px / 32px | 600 | `--text-primary` |
| Section heading | 18px / 24px | 600 | `--text-primary` |
| Body text | 14px / 20px | 400 | `--text-primary` |
| Secondary text | 14px / 20px | 400 | `--text-secondary` (≥4.5:1) |
| Meta labels | 12px / 16px | 500 | `--text-muted` (≥3:1 for large text) |
| Micro text | 11px / 14px | 400 | `--text-muted` (use sparingly) |

> **Key principle:** Every step down in the scale should be compensated by maintaining or increasing contrast ratio. Current implementation drops both size AND contrast simultaneously (e.g., CH-04: `text-[10px]` at 40% opacity), creating compounding legibility failures.

---

## Appendix G: Accessibility Checklist (Static-Evidence Based)

Based on static screenshot evidence only. Items marked "Unverified" require live testing with screen reader / keyboard / Lighthouse.

| Criterion | Status | Evidence | Related Issues |
|-----------|--------|----------|----------------|
| Text contrast ≥4.5:1 (body) | **Failing** | `mean_lum` 5-21, OCR captured 0 chars on most dark views | CC-01 |
| Text contrast ≥3:1 (large text) | **Failing** | Secondary/muted text below threshold | CC-01, CH-04 |
| Focus ring visibility | **Unverified** | No focus states captured in any screenshot | CC-02 |
| Touch target ≥44px | **Likely Failing** | `p-1.5` + `w-4 h-4` icons = ~28px | AS-04, CH-03, BB-04 |
| Keyboard navigation order | **Unverified** | Requires live testing | — |
| ARIA label associations | **Partially present** | `aria-label` found on some buttons | — |
| Form error messaging | **Failing** | No inline validation visible | FM-01 |
| Semantic status cues (color + text) | **Partial** | Validation uses severity text; BOM status lacks text label | PR-04 |
| Skip navigation link | **Unverified** | Not visible in screenshots | — |
| Reduced motion support | **Unverified** | Animations present (sidebar slide, loading spinner) | — |
| Screen reader compatibility | **Unverified** | Requires NVDA/VoiceOver testing | — |

---

## Appendix H: Audit Methodology Comparison

| Dimension | Full Catalog Audit (this document) | UI_AUDIT_REPORT.md |
|-----------|-----------------------------------|--------------------|
| Screenshots | 208 (auto-captured) | 23 (manually curated) |
| Capture tool | Playwright script | Manual or semi-automated |
| Analysis method | Visual inspection + source code cross-reference | Tool-assisted metrics + OCR + pHash clustering |
| Metrics collected | None (visual only) | `edge_density`, `mean_lum`, `std_lum`, `white_ratio`, `ocr_chars`, `pHash` |
| Scope | All views, all states, responsive, themes | Desktop only, subset of views |
| Unique issues found | 81 (original) | 12 (7 novel after deduplication) |
| Combined total | **88 unique issues** | — |

> **Conclusion:** The two audits are complementary. The full catalog provides breadth (208 screenshots, 15 sections, responsive coverage) while the tool-assisted audit provides depth (quantitative metrics, pHash drift analysis, contrast ratios). The consolidated checklist above represents the union of both.
