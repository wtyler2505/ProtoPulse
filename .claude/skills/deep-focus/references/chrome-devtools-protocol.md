# Chrome DevTools MCP - Exhaustive UI Audit Protocol

Complete protocol for capturing and analyzing EVERY visual element in a focus area.

---

## CRITICAL RULES (NON-NEGOTIABLE)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. ALWAYS take_snapshot BEFORE any click/fill/hover                │
│    • "No snapshot found" = YOU FORGOT. Snapshot gives UIDs.        │
│                                                                      │
│ 2. React/Vue apps RE-RENDER on state changes                        │
│    • Scroll position WILL reset                                     │
│    • Use resize_page with large height OR fullPage screenshots      │
│                                                                      │
│ 3. CHECKLIST before EVERY interaction:                              │
│    ☐ take_snapshot called?                                          │
│    ☐ Have element UID from snapshot?                                │
│    ☐ Page updating live? → Use fullPage/resize                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Setup & Navigation

### 1.1 Find or Create Browser Tab

```
mcp__chrome-devtools__list_pages
```

Look for existing tab with app. If not found:

```
mcp__chrome-devtools__new_page url="http://localhost:5173"
```

### 1.2 Select the Page

```
mcp__chrome-devtools__select_page pageIdx=0
```

### 1.3 Navigate to Focus Area

```
mcp__chrome-devtools__navigate_page type="url" url="http://localhost:5173/[route]"
```

### 1.4 Wait for Content

```
mcp__chrome-devtools__wait_for text="[expected content]" timeout=10000
```

### 1.5 Resize for Full Capture

```
# Large height to capture without scrolling (prevents React re-render scroll reset)
mcp__chrome-devtools__resize_page width=1920 height=4000
```

---

## Phase 2: Full Page Baseline

### 2.1 Accessibility Snapshot (Get All UIDs)

```
mcp__chrome-devtools__take_snapshot
```

**SAVE THIS OUTPUT** - Contains UIDs for every interactive element.

### 2.2 Full Page Screenshot

```
mcp__chrome-devtools__take_screenshot fullPage=true format="png"
```

### 2.3 Parse Snapshot for Elements

From the snapshot, extract and categorize every element:

| Category | Look for in Snapshot |
|----------|----------------------|
| Buttons | `button`, `role: button` |
| Inputs | `textbox`, `input`, `searchbox` |
| Selects | `combobox`, `listbox` |
| Checkboxes | `checkbox` |
| Switches/Toggles | `switch` |
| Links | `link` |
| Tabs | `tab`, `tablist` |
| Modals | `dialog` |
| Menus | `menu`, `menuitem` |
| Tables | `table`, `row`, `cell` |
| Lists | `list`, `listitem` |
| Headings | `heading` |
| Images | `img` |
| Icons | `button` with icon classes |

---

## Phase 3: Systematic Element Capture

### 3.1 Button Audit

**For EACH button in the snapshot:**

```
# Step 1: Take fresh snapshot
mcp__chrome-devtools__take_snapshot

# Step 2: Default state screenshot
mcp__chrome-devtools__take_screenshot uid="[button-uid]"

# Step 3: Hover state
mcp__chrome-devtools__hover uid="[button-uid]"
mcp__chrome-devtools__take_screenshot uid="[button-uid]"

# Step 4: Focus state (click to focus, then screenshot)
mcp__chrome-devtools__click uid="[button-uid]"
mcp__chrome-devtools__take_screenshot uid="[button-uid]"

# Step 5: Document findings
```

**Button Analysis Checklist:**
- [ ] Background color consistent with type (primary/secondary/ghost)?
- [ ] Text color has sufficient contrast?
- [ ] Padding appropriate (not cramped)?
- [ ] Border-radius consistent with design system?
- [ ] Hover state visually distinct?
- [ ] Focus ring visible and accessible?
- [ ] Icon (if present) aligned and sized correctly?
- [ ] Disabled state (if applicable) clearly indicates disabled?

### 3.2 Input Field Audit

**For EACH input in the snapshot:**

```
# Fresh snapshot
mcp__chrome-devtools__take_snapshot

# Empty state
mcp__chrome-devtools__take_screenshot uid="[input-uid]"

# Focus state
mcp__chrome-devtools__click uid="[input-uid]"
mcp__chrome-devtools__take_screenshot uid="[input-uid]"

# With value
mcp__chrome-devtools__fill uid="[input-uid]" value="Sample text"
mcp__chrome-devtools__take_screenshot uid="[input-uid]"

# Clear for next (if needed)
mcp__chrome-devtools__fill uid="[input-uid]" value=""
```

**Input Analysis Checklist:**
- [ ] Placeholder text visible and descriptive?
- [ ] Border color appropriate for state (default/focus/error)?
- [ ] Focus ring visible?
- [ ] Label properly associated?
- [ ] Padding consistent?
- [ ] Font size readable (min 16px recommended)?
- [ ] Error state styling defined?

### 3.3 Dropdown/Select Audit

```
# Fresh snapshot
mcp__chrome-devtools__take_snapshot

# Closed state
mcp__chrome-devtools__take_screenshot uid="[select-uid]"

# Open dropdown
mcp__chrome-devtools__click uid="[select-uid]"

# CRITICAL: Take new snapshot to get option UIDs
mcp__chrome-devtools__take_snapshot

# Screenshot opened state
mcp__chrome-devtools__take_screenshot fullPage=true

# Close with Escape
mcp__chrome-devtools__press_key key="Escape"
```

**Dropdown Analysis Checklist:**
- [ ] Indicator (chevron) clearly visible?
- [ ] Dropdown opens in visible area (not cut off)?
- [ ] Options have hover state?
- [ ] Selected option highlighted?
- [ ] Max-height with scroll for long lists?
- [ ] Keyboard navigation works?

### 3.4 Toggle/Switch Audit

```
# Fresh snapshot
mcp__chrome-devtools__take_snapshot

# OFF state
mcp__chrome-devtools__take_screenshot uid="[toggle-uid]"

# Toggle ON
mcp__chrome-devtools__click uid="[toggle-uid]"
mcp__chrome-devtools__take_screenshot uid="[toggle-uid]"

# Toggle back OFF
mcp__chrome-devtools__click uid="[toggle-uid]"
```

**Toggle Analysis Checklist:**
- [ ] ON/OFF states visually distinct?
- [ ] Uses color AND position to indicate state?
- [ ] Transition animation smooth?
- [ ] Touch target size adequate (44x44 min)?

### 3.5 Card/Panel Audit

```
# Cards don't have built-in UID usually, use coordinates or parent container
mcp__chrome-devtools__take_snapshot
mcp__chrome-devtools__take_screenshot fullPage=true
```

**Card Analysis Checklist:**
- [ ] Consistent padding on all sides?
- [ ] Shadow/border defines boundaries?
- [ ] Header/body/footer sections clear?
- [ ] Content doesn't overflow?
- [ ] Hover state (if interactive)?

### 3.6 Modal/Dialog Audit

```
# Find and click modal trigger
mcp__chrome-devtools__take_snapshot
mcp__chrome-devtools__click uid="[trigger-uid]"

# Wait for modal
mcp__chrome-devtools__wait_for text="[modal title]"

# Fresh snapshot with modal
mcp__chrome-devtools__take_snapshot

# Screenshot modal
mcp__chrome-devtools__take_screenshot fullPage=true

# Close modal
mcp__chrome-devtools__press_key key="Escape"
```

**Modal Analysis Checklist:**
- [ ] Backdrop dims background?
- [ ] Modal centered properly?
- [ ] Close button visible (X or button)?
- [ ] Focus trapped inside modal?
- [ ] Escape key closes modal?
- [ ] Content scrollable if overflow?

### 3.7 Navigation/Tabs Audit

```
# Capture each nav state
mcp__chrome-devtools__take_snapshot

# Screenshot current active tab
mcp__chrome-devtools__take_screenshot uid="[active-tab-uid]"

# Click inactive tab
mcp__chrome-devtools__click uid="[inactive-tab-uid]"

# Screenshot new active state
mcp__chrome-devtools__take_snapshot
mcp__chrome-devtools__take_screenshot uid="[now-active-tab-uid]"
```

**Navigation Analysis Checklist:**
- [ ] Active state clearly indicated?
- [ ] Inactive items still visible/clickable?
- [ ] Hover state on inactive items?
- [ ] Focus visible when tabbing?
- [ ] Consistent spacing between items?

### 3.8 Table/Data Grid Audit

```
mcp__chrome-devtools__take_snapshot
mcp__chrome-devtools__take_screenshot fullPage=true
```

**Table Analysis Checklist:**
- [ ] Headers visually distinct from rows?
- [ ] Alternating row colors (if applicable)?
- [ ] Column alignment correct (numbers right, text left)?
- [ ] Sortable columns have indicators?
- [ ] Responsive behavior on narrow screens?
- [ ] Empty state defined?

### 3.9 Typography Audit

```
# Full page to see all text
mcp__chrome-devtools__take_screenshot fullPage=true
```

**Typography Analysis Checklist:**
- [ ] Heading hierarchy clear (h1 > h2 > h3)?
- [ ] Body text readable (16px minimum)?
- [ ] Line height comfortable (1.5+ for body)?
- [ ] Font weights used consistently?
- [ ] Colors have sufficient contrast?
- [ ] No orphaned words on lines?

### 3.10 Icon Audit

```
mcp__chrome-devtools__take_snapshot
mcp__chrome-devtools__take_screenshot fullPage=true
```

**Icon Analysis Checklist:**
- [ ] Consistent size throughout?
- [ ] Consistent stroke weight?
- [ ] Proper alignment with text?
- [ ] Color matches context (primary/secondary)?
- [ ] Not sole indicator of meaning (accessibility)?

---

## Phase 4: Responsive Captures

### 4.1 Desktop (1920px)

```
mcp__chrome-devtools__resize_page width=1920 height=1080
mcp__chrome-devtools__take_screenshot fullPage=true
```

### 4.2 Laptop (1440px)

```
mcp__chrome-devtools__resize_page width=1440 height=900
mcp__chrome-devtools__take_screenshot fullPage=true
```

### 4.3 Tablet Landscape (1024px)

```
mcp__chrome-devtools__resize_page width=1024 height=768
mcp__chrome-devtools__take_screenshot fullPage=true
```

### 4.4 Tablet Portrait (768px)

```
mcp__chrome-devtools__resize_page width=768 height=1024
mcp__chrome-devtools__take_screenshot fullPage=true
```

### 4.5 Mobile (375px)

```
mcp__chrome-devtools__resize_page width=375 height=812
mcp__chrome-devtools__take_screenshot fullPage=true
```

### 4.6 Small Mobile (320px)

```
mcp__chrome-devtools__resize_page width=320 height=568
mcp__chrome-devtools__take_screenshot fullPage=true
```

---

## Phase 5: State Variations

### 5.1 Loading States

```
# Navigate to trigger loading
mcp__chrome-devtools__navigate_page type="reload"
# Screenshot immediately to catch skeleton/spinner
mcp__chrome-devtools__take_screenshot fullPage=true
```

### 5.2 Error States

```
# Trigger error (e.g., disconnect network)
mcp__chrome-devtools__emulate networkConditions="Offline"
mcp__chrome-devtools__navigate_page type="reload"
mcp__chrome-devtools__take_screenshot fullPage=true

# Restore network
mcp__chrome-devtools__emulate networkConditions="No emulation"
```

### 5.3 Empty States

```
# If applicable, clear data to show empty state
# Screenshot empty state
mcp__chrome-devtools__take_screenshot fullPage=true
```

---

## Phase 6: Console & Network Check

### 6.1 Console Errors

```
mcp__chrome-devtools__list_console_messages types=["error"]
```

**Document ALL errors found.**

### 6.2 Console Warnings

```
mcp__chrome-devtools__list_console_messages types=["warn"]
```

### 6.3 Failed Network Requests

```
mcp__chrome-devtools__list_network_requests resourceTypes=["fetch", "xhr"]
```

Look for 4xx/5xx status codes.

---

## Phase 7: Performance Trace

```
mcp__chrome-devtools__performance_start_trace reload=true autoStop=true
```

Wait for trace to complete, then:

```
mcp__chrome-devtools__performance_analyze_insight insightSetId="[id]" insightName="LCPBreakdown"
mcp__chrome-devtools__performance_analyze_insight insightSetId="[id]" insightName="DocumentLatency"
```

---

## Analysis Template

For each captured element, fill out:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ELEMENT: [Name/Type]                                                │
│ UID: [uid from snapshot]                                            │
│ Location: [component/file]                                          │
├─────────────────────────────────────────────────────────────────────┤
│ VISUAL OBSERVATIONS:                                                │
│ • Colors: [list colors used]                                        │
│ • Typography: [font, size, weight]                                  │
│ • Spacing: [padding, margins observed]                              │
│ • Borders: [style, radius, color]                                   │
│ • Shadows: [if any]                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ STATE OBSERVATIONS:                                                 │
│ • Default: [description]                                            │
│ • Hover: [description]                                              │
│ • Focus: [description]                                              │
│ • Active: [description]                                             │
│ • Disabled: [description, if applicable]                            │
├─────────────────────────────────────────────────────────────────────┤
│ ISSUES FOUND:                                                       │
│ • [Issue 1]                                                         │
│ • [Issue 2]                                                         │
├─────────────────────────────────────────────────────────────────────┤
│ RECOMMENDATIONS:                                                    │
│ • [Recommendation 1]                                                │
│ • [Recommendation 2]                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference - Tool → Use Case

| I need to... | Use this tool |
|--------------|---------------|
| Get element UIDs | `take_snapshot` |
| Screenshot element | `take_screenshot uid=` |
| Screenshot full page | `take_screenshot fullPage=true` |
| Click element | `click uid=` |
| Hover element | `hover uid=` |
| Type in input | `fill uid= value=` |
| Press key | `press_key key=` |
| Navigate | `navigate_page url=` |
| Resize viewport | `resize_page width= height=` |
| Check console | `list_console_messages` |
| Check network | `list_network_requests` |
| Throttle network | `emulate networkConditions=` |
| Wait for content | `wait_for text=` |
| Performance trace | `performance_start_trace` |
| Close modal | `press_key key="Escape"` |
| Handle alert | `handle_dialog action=` |
