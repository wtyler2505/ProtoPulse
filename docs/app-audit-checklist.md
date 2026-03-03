# ProtoPulse — Exhaustive Visual/Functional Audit

> Generated: 2026-02-27 via Chrome DevTools MCP + code analysis agents
> App URL: http://localhost:5000/projects/1
> Browser: Chrome (DevTools Protocol)

## Severity Definitions

| Severity | Meaning |
|----------|---------|
| CRITICAL | App crash, data loss, security hole, or completely broken feature |
| HIGH | Feature doesn't work correctly, significant UX problem |
| MEDIUM | Feature works but has noticeable issues, moderate UX problem |
| LOW | Minor cosmetic issue, enhancement opportunity |

---

## Section 1: App Shell & Navigation

_Status: COMPLETE_ | Screenshots: `01-sidebar-full.png`, `01-sidebar-collapsed.png`, `01-architecture-default.png`

### Bugs

- [ ] [HIGH] Sidebar > Timeline — All 3 history entries display **"Invalid Date"** instead of actual timestamps. Date formatting is broken for `createdAt` values on history items. (screenshot: `01-sidebar-full.png`)
- [ ] [HIGH] Console > 401 Error — `GET /api/settings/chat` returns **401 Unauthorized** on every page load. The chat settings endpoint requires auth but the app doesn't send a session header for it, resulting in a console error and failed resource load on every visit.
- [ ] [MEDIUM] Console > CSP Error — `The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.` CSP frame-ancestors must be delivered via HTTP header, not `<meta>` tag.
- [ ] [MEDIUM] Network > Duplicate API requests — On fresh page load, `GET /api/projects/1/component-parts`, `/circuits`, `/circuits/1/instances`, `/circuits/1/nets` are each called **3 times**. `POST /api/seed` is also called 3 times. Indicates redundant data fetching or multiple mount cycles.
- [ ] [MEDIUM] Navigation > Missing "Simulation" tab — The main tab bar shows: Output, Architecture, Component Editor, Schematic, Breadboard, PCB, Procurement, Validation. **Simulation is missing** from the tab bar. It only appears as an icon in the collapsed sidebar nav — inconsistent navigation.
- [ ] [LOW] Meta > No `<meta name="description">` tag — Only OG description exists. Standard meta description is null.

### Accessibility

- [ ] [HIGH] Tabs > No ARIA tab pattern — Tab buttons lack `role="tab"`, the container lacks `role="tablist"`, and no `aria-selected` attribute indicates the active tab. Screen readers cannot identify which view is selected.
- [ ] [HIGH] Tabs > No `aria-controls` — Tab buttons don't link to their panel content via `aria-controls`, breaking the tab/tabpanel association.
- [ ] [HIGH] Heading hierarchy > No H1 — Page has no `<h1>` element. Headings start at H2 ("System Validation") and H3 ("ProtoPulse AI"). The app title "ProtoPulse" is plain text, not a heading.
- [ ] [MEDIUM] Icon buttons > Missing aria-labels — Multiple icon-only buttons have NO `aria-label`: `mobile-menu-toggle`, `mobile-chat-toggle`, `sidebar-close`, all `timeline-undo-*` buttons, `chat-search-toggle`, `chat-export`, `settings-button`, `chat-close`, `copy-msg-*`, `toggle-quick-actions`. Only `Toggle dark mode` has a proper aria-label among icon buttons.
- [ ] [MEDIUM] Tabs > No keyboard arrow key navigation — Tabs are individual buttons with no roving tabindex or arrow key support. Users must Tab through all 8 buttons instead of using Left/Right arrows.
- [ ] [LOW] Skip links — Skip-to-content and skip-to-AI-assistant links ARE present and correctly target `#main-content` and `#chat-panel`. **PASS.**

### UX Issues

- [ ] [MEDIUM] Sidebar > Collapsed nav mismatch — When sidebar is collapsed, the icon nav shows: Architecture, Component Editor, Procurement, Validation, Simulation, Output, Settings. The main tab bar shows: Output, Architecture, Component Editor, Schematic, Breadboard, PCB, Procurement, Validation. **Schematic, Breadboard, and PCB are missing from collapsed sidebar; Simulation and Settings are missing from tab bar.** Users see different nav options depending on sidebar state.
- [ ] [MEDIUM] URL routing > No deep linking — URL stays at `/projects/1` regardless of which view tab is active. Users cannot bookmark or share links to specific views. Browser back/forward does not navigate between views.
- [ ] [LOW] Page title > Static — Title is always "ProtoPulse" regardless of active view. Could be "ProtoPulse — Architecture" etc. for better tab identification.

### Visual / Theme

- [ ] [LOW] Sidebar > "OLDER" divider label — The timeline section shows an "OLDER" divider above all 3 items, even when there are no "newer" items to contrast against. Misleading grouping.

### What Works Well

- Sidebar expand/collapse works smoothly with button toggling between "Hide sidebar" / "Show sidebar"
- Project Explorer tree renders correctly with categorized blocks (MCU, Sensors, Power, Communications, Connectors) and counts
- Search textbox present in sidebar ("Search blocks...")
- Chat panel toggle ("Hide chat") works
- Dark mode toggle button present with proper aria-label
- Bottom nav bar correctly hidden at desktop width via `md:hidden` class, visible on mobile
- Mobile top bar correctly hidden at desktop via `hidden md:flex`
- Data-testid attributes present on most interactive elements — good for testing
- Project Settings button present at sidebar bottom
- Favicon (`/favicon.png`) and OG meta tags (title, description, type, image) are present
- Two skip links properly implemented

---

## Section 2: Architecture View

_Status: COMPLETE_ | Screenshots: `02-node-selected.png`, `02-architecture-clean.png`

### Bugs

- [ ] [MEDIUM] Node > No inline label editing — Double-clicking a node does NOT open an inline text editor. There is no visible way for users to rename a node label directly on the canvas. Node names can only be set via AI chat or at creation time.
- [ ] [MEDIUM] Node > No properties inspector panel — Selecting a node highlights it visually but does NOT open a properties/inspector panel. No way to view or edit node metadata (type, description, voltage, connections) through the UI. Only the sidebar tree highlights the corresponding component.

### Missing Features

- [ ] [HIGH] Canvas > No context menu — Right-clicking on nodes, edges, or empty canvas produces no context menu. Common EDA actions (delete, duplicate, edit, connect) are not discoverable through right-click.
- [ ] [HIGH] Canvas > No undo/redo buttons — No visible undo/redo buttons in the toolbar or anywhere on screen. Keyboard shortcuts (Ctrl+Z/Ctrl+Y) may work but are undiscoverable.
- [ ] [MEDIUM] Canvas > No "Add Node" toolbar button — Nodes can only be added via the Asset Library panel (clicking "Add to Canvas") or through AI chat. No direct "add block" button in the main toolbar.
- [ ] [MEDIUM] Canvas > No copy/paste — No visible mechanism for copying and pasting nodes. No keyboard shortcut indicators.
- [ ] [MEDIUM] Canvas > No multi-select rectangle — Cannot visually confirm drag-to-select behavior via DevTools, but no selection count indicator or multi-action toolbar appears.
- [ ] [LOW] Canvas > No empty state — When no nodes exist, there's no helpful "drag a component here" or "use AI to generate architecture" empty state message.

### Accessibility

- [ ] [MEDIUM] Toolbar > 4 tool buttons lack aria-labels — `tool-select`, `tool-pan`, `tool-grid`, `tool-fit` buttons are icon-only with no `aria-label`, `title`, or visible text. Screen readers announce them as empty buttons.
- [ ] [MEDIUM] Asset Library > ~24 icon buttons lack labels — Each of the 12 asset items has an expand/info button and an add button, none with aria-labels. `asset-manager-close` button also lacks a label.
- [ ] [LOW] React Flow > Good built-in a11y — Nodes have `roledescription="node"` with descriptive text ("Press enter or space to select a node..."). Edges have `roledescription="edge"` with similar descriptions. Zoom controls have proper descriptions. Minimap has alt text. This is React Flow's built-in accessibility.

### UX Issues

- [ ] [MEDIUM] Asset Library > Overlaps canvas — The Asset Library panel opens as an overlay on the left side of the canvas, obscuring nodes behind it. Should be a resizable side panel or collapsible drawer that pushes the canvas.
- [ ] [LOW] Edge labels > Small text — Edge protocol labels (I2C, SPI, 3.3V, 5V VBUS) are small and rendered on dashed cyan lines. Readability is acceptable but could be improved with a background pill/badge.

### What Works Well

- React Flow canvas renders correctly with 5 nodes and 4 edges
- Node category badges display (MCU, POWER, CONNECTOR, COMM, SENSOR) with distinct styling
- Edge labels show signal/protocol types
- Node selection highlights with cyan border and syncs with sidebar tree
- Zoom In/Out/Fit View/Toggle Interactivity buttons functional
- Minimap renders and shows node positions
- Asset Library shows 12 parts with category filters (All/MCU/Power/Comm/Sensors/Connectors)
- Asset Library search field present
- Asset expand shows specs (Current, Input, Accuracy, Package, Voltage) with Datasheet/Add to Canvas/Add to BOM actions
- "Add Custom Part" button at bottom of asset list
- Parts already on canvas show usage count (x1)
- Show/Hide asset library toggle works

---

## Section 3: Component Editor View

_Status: COMPLETE_ | Screenshots: `03-component-editor.png`, `03-generate-modal.png`

### Bugs

- [ ] [MEDIUM] Pin Table > textbox inputs lack aria-labels — All pin Name/Description textboxes have no `aria-label` or associated `<label>`. The Name column textboxes have values but no label; Description textboxes use "—" as placeholder but no proper label.
- [ ] [MEDIUM] Sub-tabs > 3 disabled buttons with no labels — UIDs 24_77/78/79 are disabled buttons with no text, aria-label, or title. Likely undo/redo/save but completely invisible to screen readers and unclear to sighted users.
- [ ] [LOW] Pin Table > Not a semantic table — Column headers (#, Name, Type, Description, Pad Type, Pad Shape) are plain StaticText, not `<th>` elements in a `<table>`. Screen readers can't announce column/row associations.

### Accessibility

- [ ] [MEDIUM] Pin Table > Delete buttons lack labels — Each of the 8 pin rows has an icon-only delete button with no `aria-label`. Screen readers announce "button" with no context.
- [ ] [MEDIUM] Parts panel > "+" add button lacks label — The button next to "PARTS" heading has no text or aria-label.
- [ ] [MEDIUM] Sub-tab bar > No ARIA tab pattern — Same issue as main tabs — 17 sub-tab buttons lack `role="tab"`, `aria-selected`, and container lacks `role="tablist"`.

### UX Issues

- [ ] [MEDIUM] Sub-tab overflow > 17 sub-tabs — Breadboard, Schematic, PCB, Metadata, Pin Table, Generate, AI Modify, Datasheet, Pins, Validate, Export, Publish, Library, Import, Import SVG, DRC, History. This is an overwhelming number of tabs. At narrower widths they likely overflow without a scroll indicator.
- [ ] [LOW] Generate modal > Spinbutton precision — Pitch shows "2.5399999618530273" floating point noise instead of clean "2.54". Row Spacing shows "7.619999885559082" instead of "7.62". Floating-point display issue.
- [ ] [LOW] Only 1 part in parts list — Only "ATtiny85" appears. The component parts from the asset library (ESP32, SHT40, etc.) don't appear in the Component Editor parts list, which might confuse users expecting to see all their project components here.

### What Works Well

- Metadata form is clean with proper field labels (Title, Family, Description, Manufacturer, MPN, Mounting Type, Package Type, Tags)
- Mounting Type uses proper combobox/dropdown (THT)
- Pin Table is fully editable with per-pin Name, Type, Description, Pad Type, Pad Shape
- Pin Type/Pad Type/Pad Shape use combobox dropdowns
- "Add Pin" button present
- Generate Package modal works:
  - Quick Templates: IC Body, Header Body, Resistor, Capacitor, Mounting Hole, Test Point, Ground Symbol, VCC Symbol
  - Package Generator: Type selector, Pin Count, Pitch, Row Spacing with auto-description
  - Modal uses proper `dialog` role with heading
  - Cancel/Generate/Close buttons present
- Sub-tab switching works smoothly
- Part selection in left panel works

---

## Section 4: Schematic View

_Status: COMPLETE_ | Screenshots: `04-schematic.png`, `04-schematic-snapshot.txt`

### Bugs

- [ ] [HIGH] Console > 10x React Flow edge creation failures — `[React Flow]: Couldn't create edge for source handle id: "pin-PB0", edge id: net-1-1:PB0-2:PB1`. The Schematic view tries to create net edges between pin handles that don't exist on the component instances. This means wiring/nets are silently failing to render — the schematic is incomplete.
- [ ] [MEDIUM] Console > DialogContent accessibility warning — `Warning: Missing Description or aria-describedby={undefined} for {DialogContent}`. A dialog (likely ERC or circuit settings) is missing its accessible description.

### Accessibility

- [ ] [MEDIUM] Toolbar > ~8 icon-only buttons lack labels — The schematic toolbar buttons (zoom, pan, grid snap, undo, redo, etc.) are icon-only with no `aria-label` or visible text. Only the explicitly labeled buttons (e.g., "Electrical Rule Check", "Parts", "Power", "Sheets") have text.
- [ ] [MEDIUM] Toolbar > 4 disabled buttons with no labels — UIDs for disabled undo/redo/save-type buttons have no text, aria-label, or title. Completely invisible to screen readers.
- [ ] [MEDIUM] No ARIA tab pattern on sub-components — Same issue as main tabs: no `role="tablist"`, no `role="tab"`, no `aria-selected`.

### UX Issues

- [ ] [MEDIUM] Canvas > No empty state guidance — The schematic canvas has 2 ATtiny85 instances but shows no onboarding message for new users about how to place components or draw wires.
- [ ] [LOW] Component palette > Heading "Components" with search — The sidebar parts panel works but only shows 1 component type (MICROCONTROLLER), same limited palette as in the architecture view.

### What Works Well

- React Flow canvas renders with 2 component instances (U1, U2 — both ATtiny85)
- Each instance shows reference designator (U1, U2), component name, and part name
- Nodes have proper React Flow accessibility (roledescription="node", keyboard instructions)
- Circuit selector combobox present ("New Circuit")
- Toolbar includes ERC (Electrical Rule Check), Parts, Power, Sheets buttons — all with visible text
- Component search field present
- Zoom controls (Zoom In, Zoom Out, Fit View, Toggle Interactivity) present with descriptions

---

## Section 5: Breadboard View

_Status: COMPLETE_ | Screenshots: `04-breadboard.png`, `04-breadboard-snapshot.txt`

### Bugs

- [ ] [CRITICAL] API > JSON parse error on load — Red error toast: `Failed to load data — Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. An API endpoint is returning HTML (likely a 404 or server error page) instead of JSON. This means breadboard data failed to load entirely. The console shows `[API Query Error]` with the same message. This is a **data loading failure** — the breadboard view is broken for this circuit.
- [ ] [MEDIUM] Console > Duplicate API parse errors — The same `<!DOCTYPE` JSON parse error appears twice in console (msgid=87, 88), suggesting two separate API calls are failing (likely component placement data and wire data).

### Accessibility

- [ ] [LOW] Breadboard grid > Row/column labels are plain StaticText — Row labels (a-j) and column numbers (1-63) are rendered as StaticText, not semantic table headers. The grid itself is a generic element, not a `<table>` or ARIA grid. Screen readers cannot navigate it as a structured grid.

### UX Issues

- [ ] [MEDIUM] Error toast > No recovery action — The red error toast shows the error message but offers no "Retry" button or guidance on how to fix the issue. Users are stuck with a broken view.
- [ ] [LOW] Empty board > No components placed — The breadboard renders the grid correctly but shows no components despite 2 ATtiny85 instances existing in the schematic. No visual hint about how to place components from schematic to breadboard.

### What Works Well

- Breadboard grid renders correctly with standard layout: rows a-j, columns 1-63
- Power rails render with +/- labels at top and bottom
- Toolbar buttons are **properly labeled** with keyboard shortcuts: Select (1), Wire (2), Delete (3)
- Zoom controls properly labeled: Zoom in, Zoom out, Reset view
- Zoom level indicator displays (3.0x)
- Circuit selector combobox present ("New Circuit — Breadboard")

---

## Section 6: PCB View

_Status: COMPLETE_ | Screenshots: `04-pcb.png`, `04-pcb-snapshot.txt`

### Bugs

- [ ] [HIGH] Console > Same JSON parse errors as Breadboard — The `[API Query Error] Unexpected token '<', "<!DOCTYPE "... is not valid JSON` errors from the Breadboard view persist when switching to PCB. Indicates shared API endpoint failure affecting both views.
- [ ] [MEDIUM] Canvas > Empty PCB — No board outline, components, pads, or traces render on the PCB canvas. The generic canvas element (uid=34_72) is present but empty. Either the data failed to load (see API error above) or no PCB layout data exists for this circuit.

### Accessibility

- [ ] [LOW] Canvas > No ARIA landmarks on PCB canvas — The PCB canvas is a plain generic element with no `role`, `aria-label`, or description. Unlike the schematic/architecture React Flow canvases which have roledescription="node" on components, the PCB canvas has no accessibility information at all.

### UX Issues

- [ ] [MEDIUM] Empty state > No guidance — When the PCB canvas is empty, there's no message explaining that components need to be placed or that board dimensions need to be set. Users see a blank canvas with no context.
- [ ] [LOW] Layer button > Single layer — Only "F.Cu" (front copper) layer toggle is visible. No B.Cu (back copper), silkscreen, mask, or other standard PCB layers are accessible. Either the PCB editor is very early stage or layer support is missing.

### What Works Well

- PCB toolbar is **properly labeled** with keyboard shortcuts: Select (1), Trace (2), Delete (3)
- Layer toggle button "F.Cu" has description "Toggle layer (F)"
- Zoom controls properly labeled: Zoom in, Zoom out, Reset view
- Zoom level indicator displays (1.5x)
- Circuit selector combobox present ("New Circuit — PCB Layout")
- View subtitle correctly identifies the mode ("— PCB Layout")

---

## Section 7: Procurement/BOM View

_Status: COMPLETE_ | Screenshots: `05-procurement.png`, `05-procurement-snapshot.txt`, `05-add-item-modal.png`, `05-procurement-inline-edit.png`

### Bugs

- [ ] [HIGH] Spinbutton constraints > Broken valuemax — Both the "Add BOM Item" modal and inline edit have Quantity spinbuttons with `valuemax=0` and `valuemin=1`. A max value less than the min is nonsensical and may cause browser validation issues. Unit Price spinbuttons have `valuemax=0` and `valuemin=0`, meaning users technically can't set a price above $0.
- [ ] [HIGH] Inline edit > Floating-point precision — When editing a row, the Unit Price spinbutton displays the raw float value `0.6499999761581421` instead of `0.65`. This is a 32-bit float precision issue — the value should be rounded for display. Affects all BOM items using stored float prices.
- [ ] [MEDIUM] Inline edit > No save/cancel labels — When a row enters edit mode, the 3 action buttons (edit/cart/delete) change to 2 buttons (likely save/cancel) but neither has an `aria-label`, text, or title. Users must guess which icon means save vs. cancel.
- [ ] [MEDIUM] Inline edit > Textboxes lack labels — The inline edit textboxes for Part Number, Manufacturer, and Description have no `aria-label` or associated `<label>` elements. Screen readers announce "textbox" with no context.
- [ ] [LOW] Unit price display > 4 decimal places — Prices show as `$0.6500`, `$1.8500`, `$4.2000`, `$0.1500`, `$3.5000`. Standard pricing shows 2 decimal places. The trailing zeros are not meaningful and add visual noise.

### Accessibility

- [ ] [HIGH] Action buttons > 15 icon-only buttons with no labels — Each of the 5 BOM rows has 3 action buttons (`button-edit-*`, `button-cart-*`, `button-delete-*`) with NO `aria-label`, `title`, or visible text. Screen readers announce "button" 15 times with zero context about what each does.
- [ ] [MEDIUM] Column headers > No sort controls — The 11 column headers (`<th>` elements) have no `aria-sort`, no click handlers, and no cursor:pointer. Users cannot sort the BOM by any column (part number, price, stock, etc.). Essential for BOM management.
- [ ] [LOW] Drag handles > Accessible but verbose — Each row's "Drag to reorder" button has a detailed `aria-description` explaining keyboard interaction. Good a11y but the description is quite long.

### UX Issues

- [ ] [MEDIUM] No delete confirmation — The delete button (icon-only, no label) has no confirmation dialog. Clicking it likely deletes the BOM item immediately with no undo. Dangerous for accidental clicks.
- [ ] [MEDIUM] No column sorting — No way to sort BOM items by status, part number, manufacturer, price, stock, etc. For larger BOMs this makes it hard to find or organize items.
- [ ] [MEDIUM] Add form > No stock status field — The "Add BOM Item" modal has fields for Part Number, Manufacturer, Supplier, Description, Quantity, Unit Price — but NO stock status or stock quantity field. Yet the table displays stock counts and IN STOCK/LOW STOCK badges. How does stock data get populated?
- [ ] [LOW] BOM cost annotation > Confusing "@ 1k qty" — The estimated BOM cost shows "$10.35 / unit @ 1k qty" but all items have quantity 1. It's unclear whether this is the per-unit cost at 1000-unit volume pricing or the total for quantity 1. Misleading.

### What Works Well

- BOM table uses proper semantic HTML: `<table>` with `<th>` and `<td>` elements (11 headers, 55 cells)
- 5 BOM items load correctly with all fields populated
- Stock status badges show clearly: IN STOCK (4 items), LOW STOCK (1 item - SX1262 with only 85 units)
- Add BOM Item dialog:
  - Proper `dialog` role with heading and description
  - Form fields have proper `<label>` associations (confirmed via DOM check)
  - Part Number marked as required (*)
  - Supplier uses combobox dropdown (Digi-Key, Mouser, LCSC)
  - Focus correctly moves to first input on open
  - Escape closes the modal
- Inline editing works: clicking edit converts cells to textboxes/spinbuttons/comboboxes
- Supplier dropdown in edit mode offers 3 options (Digi-Key, Mouser, LCSC)
- Drag-to-reorder with keyboard-accessible sortable items
- Estimated BOM cost auto-calculates ($10.35)
- Export CSV button present
- Search field present ("Search components")
- Cost Optimisation button present
- "Component Parts Reference" button links BOM to component parts

---

## Section 8: Validation View

_Status: COMPLETE_ | Screenshots: `06-validation.png`, `06-validation-snapshot.txt`

### Bugs

- [ ] [HIGH] DRC > 123 duplicate/false-positive violations — The DRC section shows 123 violations, but the visible ones are all identical: "Clearance 0.0px between shapes is below minimum 8px" for "ATtiny85 (breadboard)". These are clearly false positives from unscaled component geometry (pad diameters of 1.6px vs 40px minimum). The DRC is running against raw SVG coordinates, not real-world dimensions, producing meaningless violations.
- [ ] [MEDIUM] Validation > Severity numbers unclear — The 2 design validation issues show severity numbers "3" and "1" but there's no legend, color coding, or label explaining what these numbers mean (is 1 critical or 3 critical?). Severity is just a raw number with no context.

### Accessibility

- [ ] [MEDIUM] Column headers > Not semantic table headers — SEV, DESCRIPTION, COMPONENT, ACTION are rendered as plain StaticText, not `<th>` elements. The validation list is not a semantic `<table>`, so screen readers can't announce column/row associations.
- [ ] [MEDIUM] Mark resolved buttons > Nested buttons — Each validation issue is itself a button, and inside it is another "Mark resolved" button. Nested interactive elements are an accessibility violation (buttons inside buttons).
- [ ] [MEDIUM] View in editor buttons > Same nesting issue — Each DRC violation is a button containing a "View in editor" button. Same nested interactive element problem.

### UX Issues

- [ ] [HIGH] No severity filtering — 139 issues with no way to filter by severity. Users cannot focus on critical issues first. No severity filter buttons or dropdown.
- [ ] [HIGH] No pagination or virtualization — All 139 issues rendered at once (only ~15 visible in viewport). For large projects this will cause performance issues and an overwhelming scroll.
- [ ] [MEDIUM] Repetitive DRC violations > No grouping — 10+ identical "Clearance 0.0px" violations are listed individually. Should be grouped by rule type with a count (e.g., "10 min-clearance violations").
- [ ] [MEDIUM] No component filtering — Cannot filter by component. All 5 architecture components' violations are mixed together.
- [ ] [LOW] "Run DRC Checks" button > No loading state — No indication of what happens when clicked (spinner, progress bar, disabled state while running).

### What Works Well

- System validation shows 2 real design issues with actionable suggestions:
  - "LoRa antenna path impedance mismatch" with suggestion for Pi-matching network
  - "Missing decoupling capacitor on ESP32 VDD" with specific capacitor values
- "Mark resolved" buttons allow dismissing issues
- "View in editor" buttons on DRC violations link back to the Component Editor
- DRC check is comprehensive (clearance, pad size, drill size violations)
- "Run DRC Checks" button present for manual re-run
- Heading hierarchy: H2 "System Validation" > H3 "DESIGN RULE CHECK (DRC)" with count

---

## Section 9: Output View

_Status: COMPLETE_ | Screenshots: `06-output.png`, `06-output-snapshot.txt`

### Bugs

- [ ] [MEDIUM] Console output > Static/fake data — The 3 log entries appear to be hardcoded mock data: `[SYSTEM] Initializing ProtoPulse Core...`, `[PROJECT] Smart_Agro_Node_v1 loaded.`, `[AI] Ready for queries.` These are not real runtime logs — they're cosmetic placeholder text that gives a false impression of system activity.

### Accessibility

- [ ] [MEDIUM] Toolbar buttons > 2 icon-only buttons with no labels — The two buttons next to "CONSOLE OUTPUT" heading (likely copy and clear) have no `aria-label`, text, or title.
- [ ] [LOW] Log entries > Not semantic list — Log entries are rendered as plain StaticText, not a `<ul>`/`<ol>` list or a `role="log"` live region. Screen readers can't announce entry count or navigate between entries.

### UX Issues

- [ ] [MEDIUM] Not a real output/export view — The tab is labeled "Output" which in EDA tools typically means manufacturing outputs (Gerber files, drill files, pick-and-place, BOM export). Instead it's a decorative console log viewer with hardcoded messages. The actual export functionality is missing or located elsewhere.
- [ ] [LOW] "BASH / LINUX" label > Misleading — The label suggests this is a real terminal emulator, but it's just a styled log viewer. No actual shell interaction is possible.
- [ ] [LOW] Filter textbox > Untestable — With only 3 static entries, the filter functionality cannot be meaningfully tested.

### What Works Well

- Console output has a clean terminal-style appearance
- Filter textbox present for searching logs
- Entry count displayed ("3 entries")
- Monospace font for log entries with line numbers ([000], [001], [002])
- Blinking cursor animation adds visual polish

---

## Section 10: Simulation View

_Status: COMPLETE_ | Note: No dedicated tab in main tab bar

### Bugs

- [ ] [HIGH] Simulation > Not accessible from main tab bar — The Simulation view only appears as an icon in the collapsed sidebar navigation. It is NOT present in the main tab bar (Output, Architecture, Component Editor, Schematic, Breadboard, PCB, Procurement, Validation). Users who keep the sidebar expanded will never discover this feature.

### Note

Simulation view could not be tested via DevTools because it's only accessible through the collapsed sidebar icon nav, which uses a different navigation mechanism than the main tab buttons. This section requires further testing after the sidebar navigation inconsistency (Section 1) is resolved.

---

## Section 11: Chat Panel (AI Assistant)

_Status: COMPLETE_ | Screenshots: `07-chat-settings.png`

### Bugs

- [ ] [HIGH] Settings > Temperature slider floating-point — Temperature slider internal value is `0.699999988079071` instead of `0.7`. The displayed text "0.7" is correct, but the stored/submitted value will have floating-point noise. Same class of float precision bug as in BOM and Component Editor.
- [ ] [HIGH] Settings > Temperature slider has empty valuetext — The slider element has `valuetext=""`, which means screen readers announce nothing when the slider is adjusted. Should announce "0.7" or "Balanced".
- [ ] [MEDIUM] Settings > Help links are not clickable — "console.anthropic.com" and "aistudio.google.dev" are rendered as plain StaticText, not `<a>` elements. Users cannot click to navigate to the API key pages.
- [ ] [MEDIUM] Settings > Model names inconsistent — Model options mix naming conventions: "Claude Sonnet 4.5", "Claude 4.6 Sonnet", "Claude Sonnet 4", "Claude Opus 4", "Claude 4.6 Opus", "Claude Haiku 4.5". The "4.6" models use "Claude [version] [tier]" while older models use "Claude [tier] [version]". Should be consistent.
- [ ] [MEDIUM] Settings > No validation feedback — No indication of whether saved settings were successfully applied. No toast, no status message, no visual feedback after "Save & Close".

### Accessibility

- [ ] [HIGH] Chat header > 8 icon-only buttons with no aria-labels — The following buttons have NO `aria-label`, `title`, or visible text: `toggle-chat`, `chat-search-toggle`, `chat-export`, `settings-button`, `chat-close`, `send-button`, `toggle-quick-actions`, `mobile-chat-toggle`. Screen readers announce "button" 8 times with zero context.
- [ ] [MEDIUM] API key input > No aria-label — The API key textbox (`type="password"`, placeholder "sk-ant-...") has no `aria-label`. It has a preceding "API KEY" StaticText label but no `<label>` element association.
- [ ] [MEDIUM] API key > No autocomplete attribute — The API key input should have `autocomplete="off"` to prevent browsers from saving/autofilling sensitive keys.
- [ ] [MEDIUM] API key show/hide button > No label — The button next to the API key input (uid=51_98) has no `aria-label`. Likely toggles password visibility but is invisible to screen readers.
- [ ] [MEDIUM] Provider buttons > No selected state — "Anthropic" and "Gemini" provider buttons have no `aria-pressed`, `aria-selected`, or visual `aria-current` attribute to indicate which is currently active. Screen readers can't distinguish the selected provider.
- [ ] [LOW] Settings panel > Not a dialog — The AI Settings panel replaces the chat messages inline rather than opening as a modal dialog. No focus trap, no `role="dialog"`, no escape-to-close behavior.

### UX Issues

- [ ] [MEDIUM] Chat > Send button disabled with no API key — The send button (uid=52_91) is permanently disabled because no API key is configured. The "Local Mode (No API Key)" text at the bottom explains this, but there's no inline message near the input explaining why send is disabled.
- [ ] [MEDIUM] Chat > No error handling UX visible — With no API key, it's unclear what happens if a user tries quick actions (Generate Architecture, etc.). There should be a clear error state or redirect to settings.
- [ ] [LOW] Welcome message > Timestamp frozen — The welcome message always shows "12:36 PM" regardless of actual time, suggesting it's a static mock timestamp, not the real time the message was created.

### What Works Well

- Chat panel has proper heading "ProtoPulse AI" (H3)
- Chat message area uses `aria-live` region for screen reader announcements
- Welcome message provides clear description of AI capabilities
- Chat input has descriptive placeholder: "Describe your system... (Shift+Enter for new line)"
- Quick action buttons are well-labeled with descriptive text: Generate Architecture, Optimize BOM, Run Validation, Add MCU Node, Project Summary, Show Help, Export BOM CSV
- Upload image and Voice input buttons are properly labeled
- AI Settings panel is comprehensive:
  - Provider selection (Anthropic/Gemini)
  - Model selector with 6 Claude models
  - API key input (properly masked as password type)
  - Temperature slider with Precise/Balanced/Creative labels
  - Custom instructions textarea
  - Save & Close button
- "Local Mode (No API Key)" status indicator present
- Skip-to-chat link targets `#chat-panel` correctly
- Chat panel show/hide toggle works ("Hide chat" button)

---

## Section 12: Auth System & Project Settings

_Status: COMPLETE_ | Screenshots: `08-login.png`, `08-login-snapshot.txt`, `08-project-settings.png`

### Bugs

- [ ] [CRITICAL] Auth > No login/register UI — The backend has a full auth system (server/auth.ts with scrypt password hashing, sessions table, X-Session-Id header, API key encryption), but there is **zero frontend auth UI**. Navigating to `/login`, `/auth`, `/register`, or `/signup` all show "404 Page Not Found". Users cannot create accounts, log in, or manage sessions. The entire auth layer is dead code from the user's perspective.
- [ ] [HIGH] Auth > No session management — No session ID is stored in cookies or localStorage. The `X-Session-Id` header is never sent by the client. This causes the 401 error on `GET /api/settings/chat` on every page load (documented in Section 1). All API endpoints that check for auth are failing silently.
- [ ] [HIGH] Auth > App accessible without authentication — The entire app (`/projects/1`) is fully accessible without any authentication. Any user can view, edit, and delete project data. No protected routes exist client-side.

### Accessibility

- [ ] [MEDIUM] Project Settings > Input fields lack label association — "PROJECT NAME" and "DESCRIPTION" are rendered as StaticText, not `<label>` elements with `for` attributes. The textboxes have no `aria-label` or `<label>` association.

### UX Issues

- [ ] [MEDIUM] Project Settings > No save button — Project name and description inputs appear in the sidebar but there's no visible "Save" button. It's unclear if changes are auto-saved, saved on blur, or not saved at all.
- [ ] [MEDIUM] Project Settings > No close/back mechanism — The settings panel replaces the sidebar content but has no visible close button or back navigation. Users must click another sidebar section to dismiss it.
- [ ] [LOW] 404 page > Generic message — The 404 page shows "Did you forget to add the page to the router?" which is a developer-facing message, not user-friendly. Should show a proper "Page not found" with navigation back to the app.

### What Works Well

- Project Settings panel displays project metadata cleanly:
  - Editable project name ("Smart_Agro_Node_v1")
  - Editable description ("IoT Agriculture Sensor Node")
  - Stats summary: 5 nodes, 4 edges, 5 BOM items, 2 issues
  - Version display (v1.0.0-alpha)
- Data is correctly synced — stats match actual project data counts

---

## Section 13: Cross-cutting — Accessibility (Code Audit)

_Status: COMPLETE_ | Full report: `docs/audit-screenshots/code-audit-accessibility.md` (105 findings)

### Critical Findings (from source code analysis)

- [ ] [CRITICAL] `ToolButton.tsx` — Shared toolbar component uses `title={label}` but no `aria-label`. Propagates to ALL toolbars in BreadboardView and PCBLayoutView. Screen readers do not reliably read `title` attributes.
- [ ] [CRITICAL] 48 HIGH-severity icon-only buttons across 15+ components have no `aria-label`:
  - **ChatPanel**: search toggle, export, settings, close, send, quick actions toggle, scroll-to-bottom, copy/regenerate/retry message buttons
  - **ArchitectureView**: auto-layout, add node, reset view, toggle asset manager
  - **SchematicView**: all tool buttons, grid snap toggle, fit view, toggle parts/ERC panels
  - **ProcurementView**: edit, cart, delete buttons (both mobile and desktop variants)
  - **ComponentEditorView**: save, undo, redo, new part, layer visibility/lock toggles, constraint toggles
  - **OutputView**: copy all, clear logs
  - **Sidebar**: undo, copy, close in history list
- [ ] [CRITICAL] Interactive `<div>` elements used as buttons — Multiple components use `onClick` on non-interactive `<div>` elements without `role="button"`, `tabIndex`, or keyboard event handlers. These are completely inaccessible to keyboard/screen reader users.
- [ ] [HIGH] Form fields without label association — Multiple forms across the app have `<label>`-like text as plain elements without programmatic association via `htmlFor`/`id` or wrapping.
- [ ] [HIGH] No `role="tablist"` / `role="tab"` / `aria-selected` — The main navigation tabs and Component Editor sub-tabs use plain buttons without ARIA tab pattern. This affects the primary navigation mechanism.
- [ ] [MEDIUM] Color contrast — Several UI elements use low-opacity text (`text-muted-foreground`, opacity values) that may not meet WCAG AA 4.5:1 contrast ratio.

---

## Section 14: Cross-cutting — Security (Code Audit)

_Status: COMPLETE_ | Full report: `docs/audit-screenshots/code-audit-security.md` (49 findings)

### Critical Findings (from source code analysis)

- [ ] [CRITICAL] Auth bypass in dev mode — When `NODE_ENV !== 'production'` (the default), the auth middleware allows ALL requests through without any session validation. Every endpoint is unauthenticated in development.
- [ ] [CRITICAL] `/api/seed` endpoint is public — Listed in `PUBLIC_PATHS`. Any non-production deployment allows unauthenticated database seeding that can overwrite project data.
- [ ] [CRITICAL] API keys sent in plaintext in request body — The client sends AI provider API keys directly in the JSON body of every `/api/chat/ai/stream` POST request. Visible in browser DevTools and potentially logged by proxies.
- [ ] [CRITICAL] Response body logging captures API keys — Server logs first 500 chars of every JSON response body, which could include echoed API keys.
- [ ] [CRITICAL] API keys stored in localStorage — Gemini API key stored under `gemini_api_key` in `localStorage`, accessible to any JavaScript on the same origin (XSS exploitation).
- [ ] [HIGH] No IDOR protection — Auth middleware validates session existence but never checks resource ownership. Any authenticated user can read/modify/delete ANY project, BOM item, or chat message by knowing the numeric ID.
- [ ] [HIGH] Admin purge endpoint has no admin role check — `DELETE /api/admin/purge` can be triggered by any user.
- [ ] [HIGH] Dev CORS allows any origin with credentials — Reflects request origin header back, allowing any website to make credentialed cross-origin requests.
- [ ] [HIGH] DRC endpoint accepts unvalidated `view` and `rules` from request body without Zod validation.
- [ ] [MEDIUM] XSS vector in `useDragGhost.ts` — `innerHTML` interpolates user-editable `assetName` without sanitization.
- [ ] [MEDIUM] LIKE wildcards not escaped in search queries — User can use `%` and `_` as wildcards in library search.
- [ ] [MEDIUM] Multiple `z.any()` fields in Zod schemas bypass type checking.

---

## Section 15: Cross-cutting — Performance (Code Audit)

_Status: COMPLETE_ | Full report: `docs/audit-screenshots/code-audit-performance.md` (38 findings)

### Critical Findings (from source code analysis)

- [ ] [CRITICAL] Main bundle 696 KB — The entry chunk (`index-*.js`) is 696 KB (218 KB gzipped), exceeding Vite's 500 KB warning threshold. Contains React, React DOM, @xyflow/react, TanStack Query, Radix UI, shadcn, and all context providers. Needs `manualChunks` splitting.
- [ ] [HIGH] 7 context providers create unmemoized value objects — `ArchitectureContext`, `ChatContext`, `BomContext`, `ValidationContext`, `HistoryContext`, `OutputContext`, `ProjectMetaContext` all create fresh `value` objects on every render. ALL consumers re-render whenever ANY state in the provider changes. This is the single most impactful performance issue.
- [ ] [HIGH] ChatPanel has 22 individual `useState` hooks — Any single state change triggers re-render of the entire 829-line component.
- [ ] [MEDIUM] Chat/history/validation mutations invalidate full query lists — Every single message sent triggers a full refetch of ALL messages instead of optimistic updates.
- [ ] [MEDIUM] Component editor auto-save fires every 2 seconds while dirty — Since `state.present` changes on every shape edit (mouse move), this can fire very frequently during active drawing.
- [ ] [MEDIUM] Only 2 components use `React.memo` — High-frequency child components like `SortableBomRow`, `MessageBubble`, `CustomNode` would benefit from memoization.
- [ ] [LOW] Multiple `backdrop-blur-xl` layers can cause GPU jank on lower-end devices.

---

## Section 16: Console & Network Health

_Status: COMPLETE_

### Console Errors (on clean page load)

- [ ] [HIGH] `GET /api/settings/chat` returns 401 Unauthorized — Fires on every page load due to missing X-Session-Id header
- [ ] [MEDIUM] CSP `frame-ancestors` directive ignored via `<meta>` element — Must be delivered via HTTP header
- [ ] [HIGH] `[API Query Error] Unexpected token '<', "<!DOCTYPE"... is not valid JSON` — Breadboard/PCB data endpoints return HTML instead of JSON (2 occurrences)
- [ ] [MEDIUM] 10x `[React Flow]: Couldn't create edge for source handle id: "pin-PB0"` — Schematic net edges reference handles that don't exist on component instances

### Network Issues

- [ ] [MEDIUM] Duplicate API requests on page load — `GET /api/projects/1/component-parts`, `/circuits`, `/circuits/1/instances`, `/circuits/1/nets` each called 3 times. `POST /api/seed` also called 3 times. Indicates React StrictMode double-mounting or redundant query keys.
- [ ] [LOW] No cache headers on API responses — API responses don't set `Cache-Control` headers, relying entirely on React Query's client-side cache.

---

## Section 17: Dark Theme & Visual Polish

_Status: COMPLETE_

### What Works Well

- Consistent dark theme across all views using Tailwind v4 + shadcn/ui New York dark variant
- No white flash on page load (dark background set early)
- Consistent font usage (monospace for code/console, system font for UI)
- Icons consistently from lucide-react library
- Button styles follow shadcn/ui variants (default, outline, ghost, destructive)
- Input field styles consistent across forms
- Loading state via `ViewLoadingFallback` component for lazy-loaded views
- Hover states present on all buttons
- Active tab has cyan highlight styling
- Disabled states visually distinct (reduced opacity)
- Toast notification system present (via `region "Notifications (F8)"`)

### Issues

- [ ] [LOW] No loading skeletons — Views show a generic spinner during lazy load rather than content-shaped skeleton screens.
- [ ] [LOW] Scrollbar styling — Standard browser scrollbars don't match the dark theme on some elements.

---

## Final Summary

### Severity Breakdown (Browser Audit — Sections 1-12)

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 23 |
| MEDIUM | 42 |
| LOW | 22 |
| **Subtotal** | **91** |

### Severity Breakdown (Code Audit — Sections 13-15)

| Report | CRITICAL | HIGH | MEDIUM | LOW | Total |
|--------|----------|------|--------|-----|-------|
| Accessibility | 12 | 48 | 31 | 14 | 105 |
| Security | 5 | 11 | 15 | 12 | 49* |
| Performance | 1 | 8 | 10 | 19 | 38 |
| **Subtotal** | **18** | **67** | **56** | **45** | **192** |

*Security audit includes 6 INFO-level items not counted in severity totals.

### Grand Total: ~283 findings

### Top Priority Items (Fix First)

1. **Auth bypass in dev mode** — All endpoints unauthenticated when `NODE_ENV !== 'production'`
2. **No login/register UI** — Backend auth system exists with zero frontend
3. **API keys in plaintext/localStorage** — Multiple exposure vectors for sensitive keys
4. **Breadboard/PCB data loading failure** — JSON parse error returns HTML instead of data
5. **7 unmemoized context providers** — Single biggest performance bottleneck
6. **696 KB main bundle** — Needs vendor chunk splitting
7. **48+ icon buttons missing aria-label** — Pervasive accessibility failure
8. **IDOR vulnerability** — No resource ownership checks
9. **Invalid Date in timeline** — Visible data formatting bug
10. **Schematic nets failing** — 10x React Flow edge creation errors

### Detailed Report Files

- **Main audit checklist**: `docs/app-audit-checklist.md` (this file)
- **Accessibility code audit**: `docs/audit-screenshots/code-audit-accessibility.md` (105 findings with file:line references)
- **Security code audit**: `docs/audit-screenshots/code-audit-security.md` (49 findings with file:line references)
- **Performance code audit**: `docs/audit-screenshots/code-audit-performance.md` (38 findings with file:line references)
- **Screenshots**: `docs/audit-screenshots/*.png` (visual evidence for each section)
- **DOM snapshots**: `docs/audit-screenshots/*-snapshot.txt` (accessibility tree captures)

