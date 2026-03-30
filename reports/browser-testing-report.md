# ProtoPulse Browser Testing Report

**Date:** 2026-03-30
**Tester:** Claude Opus 4.6
**Environment:** localhost:5000 (dev server), Chrome via DevTools MCP
**Account:** devtest
**Project:** Audio Amplifier (Sample) — Project ID 18

---

## Critical Bugs Found & Fixed During Testing

### BUG-001: Design Suggestions panel blocking ALL view content [CRITICAL — FIXED]
- **Symptom:** Every view except Architecture showed a completely blank/black content area
- **Root cause:** The prediction panel container had `shrink-0` CSS class, preventing it from shrinking. With 5 suggestion cards (~896px total height), it consumed all available space in the flex column, crushing the view panel to height 0
- **Fix:** Changed `shrink-0` to `shrink` with `max-h-[35vh]` and `overflow-y-auto`
- **Commit:** `f76b9dc`

### BUG-002: Full-width gray background bar behind suggestions [HIGH — FIXED]
- **Symptom:** A gray `bg-background/90 border-t` bar spanned the entire width of the workspace behind the suggestion cards, obscuring content
- **Root cause:** The prediction panel was a full-width flex child with background styling
- **Fix:** Changed from flex dock to absolute-positioned floating overlay (`absolute bottom-4 right-4 z-20 max-w-sm`)
- **Commit:** `7c74ffa`

### BUG-003: Design Suggestions always expanded, covering content [MEDIUM — FIXED]
- **Symptom:** The full prediction panel with all cards was always visible, overlapping the bottom-right of the workspace
- **Root cause:** No toggle — panel rendered whenever predictions existed
- **Fix:** Added `predictionPanelOpen` to WorkspaceState with `TOGGLE_PREDICTION_PANEL` action. Collapsed by default to a small badge showing count ("5 Design Suggestions"). Expands on click.
- **Commit:** `aea69ba`

---

## Functional Test Results

### Architecture View

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| Add component from Asset Library | Click "Add to canvas" for BME280 | Node appears on canvas | BME280 node appeared, sidebar updated with "Sensors" category | **PASS** |
| Node selection | Click BME280 node on canvas | Node Properties inspector opens | Inspector showed: Label (editable), Type (dropdown: Sensor), Description (textarea), Position (X=572, Y=329), Connections (0 edges), ID (UUID), Delete button | **PASS** |
| Prediction engine reactivity | After adding BME280 | Predictions update based on new design state | New suggestion appeared: "Add a power indicator LED" (80%, Best Practice). "Understand dropout voltage" tip dropped off | **PASS** |
| Analyze design button | Click "Analyze design" | Design analysis panel opens | Showed: Design type "Sensor Hub" (simple), 3 subsystems (Control Unit, Power Management, Sensor Array), 1 suggestion, Component Roles, Educational Notes | **PASS** |
| Design workflow breadcrumb | Visual inspection | Shows Architecture > Schematic > PCB Layout > Validation > Export | Correctly rendered with Architecture highlighted | **PASS** |
| Asset library categories | Visual inspection | Category filter buttons | All, Microcontrollers, Power, Communication, Sensors, Connectors — all present | **PASS** |
| Asset library search | Visual inspection | Search field present | "Search parts..." textbox present | **PASS** |
| Canvas toolbar | Visual inspection | Mode buttons visible | Select mode, Pan mode, Snap to grid, Fit view, Analyze design — all present | **PASS** |
| React Flow controls | Visual inspection | Zoom/fit controls | Zoom In (disabled at max), Zoom Out, Fit View, Toggle Interactivity, Mini Map — all present | **PASS** |
| Auto-save | After adding BME280 | Status updates | Changed from "All changes saved" to "Saving changes..." then "Last saved at 10:39 PM" | **PASS** |

### AI Chat Panel

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| Project Summary quick action | Click "Project Summary" button | AI generates summary | Gemini returned full summary: project name, description, current view, selected component, architecture components list, validation issues, follow-up questions | **PASS** |
| AI follow-up "Run Validation" | Click "Run Validation" chip | AI dispatches run_validation action | AI responded with "initiated a full design validation check", action metadata showed "Ran validation — Action run_validation dispatched to client", toast notification "Review required" appeared | **PASS** |
| Token cost display | After AI response | Shows token usage | "51 tokens · ~$0.0000" displayed | **PASS** |
| Chat message timestamps | Visual inspection | Timestamps on messages | All messages show time (09:25 AM, 09:34 AM, etc.) | **PASS** |
| Copy message button | Visual inspection | Present on each message | Copy and Branch buttons on every message | **PASS** |
| Chat/Design Agent tabs | Visual inspection | Tab switcher visible | "Chat" and "Design Agent" tabs present | **PASS** |
| API key status | Visual inspection | Shows key status | "API key set (unverified)" status badge | **PASS** |
| Model indicator | Visual inspection | Shows active model | "API — Gemini 3.1 Pro (Custom Tools)" at bottom | **PASS** |
| Quick action buttons | Visual inspection | Multiple quick actions | Generate Architecture, Optimize BOM, Run Validation, Add MCU Node, Project Summary, Show Help, Export BOM CSV — all present | **PASS** |
| Multimodal input buttons | Visual inspection | Upload/camera/voice | Upload image, Multimodal input (camera), Voice input buttons present | **PASS** |

### Calculators View

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| Ohm's Law: V=5, I=0.02 | Fill values, click Calculate | R=250Ω, P=100mW | Voltage: 5V, Current: 20mA, Resistance: 250Ω, Power: 100mW — all correct | **PASS** |
| Result action buttons | After calculation | BOM/Component actions | "Add to BOM" and "Apply to Component" buttons appeared | **PASS** |
| LED Resistor defaults | Visual inspection | Pre-filled values | Supply=5V, Vf=2V, If=0.02A — defaults present | **PASS** |
| Voltage Divider tabs | Visual inspection | Forward/Reverse tabs | Forward (selected) and Reverse tabs, R1=10kΩ, R2=10kΩ, Vin=5V defaults | **PASS** |
| RC Time Constant defaults | Visual inspection | Pre-filled values | R=10kΩ, C=0.000001F (1µF) — defaults present | **PASS** |
| Filter Cutoff tabs | Visual inspection | RC Filter/Bandpass tabs | RC Filter (selected) with Low-pass/High-pass buttons, R=10kΩ, C=0.0000001F | **PASS** |
| Power Dissipation | Visual inspection | Empty fields ready for input | Power, Current, Voltage, Resistance — all empty spinbuttons | **PASS** |
| All 6 calculators render | Visual inspection | No empty/broken sections | Ohm's Law, LED Resistor, Voltage Divider, RC Time Constant, Filter Cutoff, Power Dissipation — all rendered | **PASS** |

### Schematic View

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| Canvas renders | Navigate to /schematic | Schematic editor with components | ATtiny85 DIP-8 component rendered with pin labels (VCC, PB5, PB0, GND, PB1, PB2) | **PASS** |
| Toolbar | Visual inspection | Editing tools present | Full toolbar with draw, select, component, and layout tools visible | **PASS** |
| Parts panel | Visual inspection | Component library | MICROCONTROLLER category with ATtiny85 listed, search field | **PASS** |
| Circuit selector | Visual inspection | Circuit dropdown | "New Circuit" dropdown with "+ New" and "Push to PCB" actions | **PASS** |
| Parts/Power/Sheets/Sim tabs | Visual inspection | Panel sub-tabs | Parts, Power, Sheets, Sim tabs visible | **PASS** |

### Validation View

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| View renders with content | Navigate to /validation | DRC results, controls visible | System Validation with 139 issues, Custom Rules button, Run DRC Checks button, preset selector | **PASS** |
| Design Gateway section | Visual inspection | Proactive validation | 7 gateway rules listed (Missing decoupling cap, Floating input pin, Unconnected power pin, etc.) with colored severity badges | **PASS** |
| DFM Check section | Visual inspection | DFM controls | DFM Check with "Check from BOM" and "Run" buttons, fabricator selector dropdown | **PASS** |
| Manufacturer Rule Compare | Visual inspection | Manufacturer comparison | "Compare With: Select manufacturer..." dropdown | **PASS** |
| BOM Completeness | Visual inspection | BOM check | "No BOM data available" message (correct — BOM is empty) | **PASS** |
| Design Troubleshooter panel | Visual inspection | Side panel (xl screens) | Design Troubleshooter with search, category filters (All, Digital, Power, Analog, Passive, Communication, Protection, Signal), 17 issues found, issue cards (Floating Inputs, Missing Decoupling Capacitors) | **PASS** |
| Preset selector | Visual inspection | DRC preset dropdown | "General (Balanced)" preset with "Apply" button and description | **PASS** |

### Procurement View

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| View renders | Navigate to /procurement | BOM table and controls | BOM Management tab with search, Cost Optimisation, ESD, Assembly, Add Item buttons | **PASS** |
| Tab navigation | Visual inspection | Multiple tabs | BOM Management, BOM Comparison, Alternates, Live Pricing, Assembly Cost, Mfg Validator, Assembly Risk, Assembly Groups | **PASS** |
| Empty BOM state | Visual inspection | Friendly empty state | "No items in your Bill of Materials" with "Add First Item" CTA | **PASS** |
| BOM table columns | Visual inspection | Proper columns | Status, Part Number, Manufacturer, Description, Supplier, Stock, Qty, Unit Price, Total, Actions | **PASS** |
| Estimated BOM Cost | Visual inspection | Cost display | "$0.00 / unit @ 1k qty" with Export CSV button | **PASS** |
| Component Parts Reference | Visual inspection | Reference section | "Component Parts Reference (1)" section at bottom | **PASS** |

### Dashboard View

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| Project stats | Visual inspection | Stats bar | Components 2→3, Connections 0, BOM Items 0, Est. Cost $0.00, Issues 1 | **PASS** |
| Architecture card | Visual inspection | Node/edge counts | 2→3 nodes (updated after BME280 add), 0 edges, 0% density, node types (power 1, mcu 1, sensor 1) | **PASS** |
| BOM card | Visual inspection | Cost summary | 0 total qty, 0 unique, $0.00 est cost | **PASS** |
| Validation card | Visual inspection | Issue summary | "Warnings Present", 1 issue to review, severity breakdown | **PASS** |
| Recent Activity | Visual inspection | History entries | Added resistor: 330R, Added led: Power LED, Added led: undefined led | **PASS** |

### Kanban View

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| Board renders | Navigate to /kanban | 4-column kanban | Task Board with Backlog(0), To Do(0), In Progress(0), Done(0) columns | **PASS** |
| Empty state | Visual inspection | Add task buttons | "Add task" button in each column | **PASS** |
| Filters | Visual inspection | Priority filter | "All priorities" dropdown visible | **PASS** |
| Column management | Visual inspection | Add column button | "+ Column" button visible | **PASS** |

### Knowledge Hub

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| View renders | Navigate to /knowledge | Article grid | "Electronics Knowledge Hub" with "20 articles" badge | **PASS** |
| Search and filters | Visual inspection | Search field + dropdowns | Search textbox, "All categories" dropdown, "All levels" dropdown | **PASS** |
| Article cards | Visual inspection | Card content | Resistors (Beginner/Passive), Capacitors (Beginner/Passive), Inductors (Intermediate/Passive), Diodes, Transistors (BJT), MOSFETs, Voltage Regulators, Voltage Dividers — all with tags | **PASS** |

### 3D Board Viewer

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| View renders | Navigate to /viewer_3d | 3D board visualization | 3D Board Viewer with "0 components" badge, board visible | **PASS** |
| Camera controls | Visual inspection | View angle buttons | Top, Bottom, Front, Back, Left, Right, Iso buttons | **PASS** |
| Layer toggles | Visual inspection | Layer checkboxes | Top Silkscreen, Top Solder Mask, Top Copper, Substrate, Internal, Bottom Copper, Bottom Solder Mask, Bottom Silkscreen | **PASS** |
| Dimensions panel | Visual inspection | Board dimensions | Width: 100mm, Height: 80mm, Thickness: 1.6mm, Radius: 0mm | **PASS** |
| Export/Import | Visual inspection | Action buttons | Export and Import buttons present | **PASS** |

### Simulation View

| Test | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| View renders | Navigate to /simulation | Simulation controls | "Circuit Simulation" heading, "Start Simulation" button, "Export SPICE", "Share" buttons | **PASS** |
| Analysis types | Visual inspection | 4 analysis options | DC Operating Point (selected), Transient, AC Analysis, DC Sweep | **PASS** |
| Parameters section | Visual inspection | Collapsible | "DC Operating Point analysis requires no additional parameters" | **PASS** |
| Probes section | Visual inspection | Probe management | "No probes placed" with "Add Probe" button | **PASS** |
| Run button | Visual inspection | Run action | "Run DC Operating Point" button (green/cyan) | **PASS** |
| Additional sections | Visual inspection | Extra features | Corner Analysis, Results, Import SPICE Netlist, Result History, Presets — all collapsible | **PASS** |

---

## UX/UI Audit Findings

### Layout & Navigation

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| UX-001 | Sidebar categories well-organized | POSITIVE | Design, Analysis, Hardware, Manufacturing, AI & Code, Documentation — logical grouping with collapsible sections |
| UX-002 | Tab bar has horizontal scroll | INFO | 30+ tabs with "Scroll tabs right" button — functional but tabs are small |
| UX-003 | Skip navigation links present | POSITIVE | "Skip to main content" and "Skip to AI assistant" — good accessibility |
| UX-004 | Resize handles for all panels | POSITIVE | Sidebar (180-480px), chat panel (280-600px) with keyboard support |
| UX-005 | Design workflow breadcrumb | POSITIVE | Architecture > Schematic > PCB Layout > Validation > Export — clear workflow progression |
| UX-006 | "1 collaborator online" badge | INFO | Collaboration indicator visible — implies real-time awareness |

### AI Chat UX

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| UX-007 | "Something went wrong" error persists in chat history | LOW | Error from a previous session (11:06 AM) still visible — no way to clear/hide individual error messages |
| UX-008 | "Switch to the Validati" truncated message | LOW | Message text cut off at 09:53 AM — possibly a UI width issue or the original message was sent incomplete |
| UX-009 | Token cost transparency | POSITIVE | "51 tokens · ~$0.0000" displayed after each AI response — excellent for cost awareness |
| UX-010 | Action dispatch feedback | POSITIVE | "Ran validation — Action run_validation dispatched to client" clearly shows what the AI did |
| UX-011 | Quick actions bar scrollable | INFO | 7 quick action buttons with "Scroll for more actions" — could benefit from a more menu |
| UX-012 | No clear chat history button | MEDIUM | No obvious way to clear old/stale chat messages from the conversation |

### Data & State

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| UX-013 | "undefined led" in timeline | LOW | Stale history entry from pre-fix prediction bug — label was "undefined" before the fix |
| UX-014 | Components count updates dynamically | POSITIVE | Sidebar shows "Architecture 3" after adding BME280 (was 2) |
| UX-015 | Auto-save indicator | POSITIVE | Status bar shows "All changes saved" → "Saving changes..." → "Last saved at [time]" |
| UX-016 | BME280 appears in Asset Library with ×1 badge | POSITIVE | Shows component is already on canvas with count — prevents accidental duplicates |

### Accessibility

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| A11Y-001 | Skip navigation links | PASS | "Skip to main content" and "Skip to AI assistant" present |
| A11Y-002 | Canvas nodes have keyboard instructions | PASS | "Press enter or space to select a node. You can then use the arrow keys to move the node around." |
| A11Y-003 | Draggable items have role descriptions | PASS | `roledescription="draggable"` on sidebar drag handles |
| A11Y-004 | Button labels | PASS | Most buttons have descriptive labels ("Toggle favorite", "Add to canvas", "Focus node: ESP32-S3-WROOM-1") |
| A11Y-005 | Color theme picker available | PASS | "Open color theme picker" and "Enable high-contrast mode" buttons in header |
| A11Y-006 | Tab selection states | PASS | Selected tabs have `selectable selected` aria state |
| A11Y-007 | Three toolbar buttons without labels | MEDIUM | uid 22_119, 22_120, 22_121 — buttons with no accessible label (likely icon-only buttons for undo/redo/share) |
| A11Y-008 | Notifications region | PASS | `region "Notifications (F8)"` with list — proper live region |

---

## Views Not Yet Tested (Workflows Pending)

- [ ] Breadboard view — component rendering and wire drawing
- [ ] PCB Layout view — component placement and trace routing
- [ ] Component Editor — part creation and editing
- [ ] Circuit Code — DSL editing and preview
- [ ] Arduino Workbench — file management and build
- [ ] Serial Monitor — connection flow
- [ ] Digital Twin — firmware generation
- [ ] Starter Circuits — template selection and launch
- [ ] Labs — tutorial progression
- [ ] Community — download and collections
- [ ] Ordering — full ordering wizard workflow
- [ ] Design Patterns — snippet management
- [ ] Design History — snapshot save/compare
- [ ] Audit Trail — filtering and export
- [ ] Lifecycle — component tracking
- [ ] Exports — multi-format export
- [ ] Generative Design — candidate generation
- [ ] Comments — thread management
- [ ] Inventory/Storage — barcode and label workflows
