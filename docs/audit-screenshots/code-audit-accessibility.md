# Accessibility Code Audit — ProtoPulse

**Date:** 2026-02-27
**Scope:** All component files in `client/src/components/`
**Method:** Source-only static analysis (no browser/DevTools)
**Standard:** WCAG 2.1 AA

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 12 |
| HIGH     | 48 |
| MEDIUM   | 31 |
| LOW      | 14 |
| **Total** | **105** |

---

## 1. ARIA Labels on Icon-Only Buttons

### CRITICAL — Shared Component Propagates to All Toolbars

- [ ] CRITICAL `client/src/components/circuit-editor/ToolButton.tsx:17-27` — ToolButton uses `title={label}` but has no `aria-label`. This component is reused across BreadboardView and PCBLayoutView toolbars, propagating the accessibility gap to every toolbar button in both views. Screen readers do not read `title` reliably.

### HIGH — Chat Panel Buttons

- [ ] HIGH `client/src/components/panels/chat/ChatHeader.tsx:30-33` — Search toggle button is icon-only (`Search` icon) with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/ChatHeader.tsx:35-38` — Export button is icon-only (`Download` icon) with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/ChatHeader.tsx:40-46` — Settings toggle button is icon-only (`Settings` icon) with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/ChatHeader.tsx:48-52` — Close button is icon-only (`X` icon) with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/MessageBubble.tsx:141-148` — Copy message button is icon-only with no `aria-label` (has tooltip but not programmatic)
- [ ] HIGH `client/src/components/panels/chat/MessageBubble.tsx:150-154` — Regenerate button is icon-only with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/MessageBubble.tsx:156-161` — Retry button is icon-only with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/MessageBubble.tsx:125-130` — Accept and Reject action buttons are icon-only with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/MessageInput.tsx:73-76` — Quick actions toggle is icon-only with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/MessageInput.tsx:92-101` — Image upload button uses `title` but has no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/MessageInput.tsx:103-113` — Voice input button uses `title` but has no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/MessageInput.tsx:115-123` — Send button is icon-only (`Send` icon) with no `aria-label`
- [ ] HIGH `client/src/components/panels/chat/ChatSearchBar.tsx:24-27` — Clear search button is icon-only (`X` icon) with no `aria-label`
- [ ] HIGH `client/src/components/panels/ChatPanel.tsx:785-792` — Scroll-to-bottom button is icon-only (`ArrowDown` icon) with no `aria-label`

### HIGH — Architecture View Buttons

- [ ] HIGH `client/src/components/views/ArchitectureView.tsx:308-323` — Multiple toolbar buttons (auto-layout, add node, reset view, etc.) are icon-only, rely on `StyledTooltip` only, and have no `aria-label`
- [ ] HIGH `client/src/components/views/ArchitectureView.tsx:299-307` — Toggle asset manager button is icon-only with `title` but no `aria-label`

### HIGH — Output View Buttons

- [ ] HIGH `client/src/components/views/OutputView.tsx:63-69` — Copy all logs button is icon-only with no `aria-label`
- [ ] HIGH `client/src/components/views/OutputView.tsx:73-80` — Clear logs button is icon-only with no `aria-label`

### HIGH — Procurement View Buttons

- [ ] HIGH `client/src/components/views/ProcurementView.tsx:377-394` — Mobile card action buttons (edit, cart, delete) are icon-only with no `aria-label`
- [ ] HIGH `client/src/components/views/ProcurementView.tsx:701-727` — Desktop table edit, add-to-cart, and delete buttons are icon-only with tooltips but no `aria-label`

### HIGH — Component Editor View Buttons

- [ ] HIGH `client/src/components/views/ComponentEditorView.tsx:778-811` — Save, undo, and redo icon buttons (`size="icon"`) have no `aria-label`
- [ ] HIGH `client/src/components/views/ComponentEditorView.tsx:819` — New part button is icon-only (`Plus` icon) with no `aria-label`

### HIGH — Schematic View & Toolbar

- [ ] HIGH `client/src/components/circuit-editor/SchematicToolbar.tsx:51-66` — All schematic tool buttons (select, pan, draw net, rotate, mirror, etc.) are icon-only with tooltips but no `aria-label`
- [ ] HIGH `client/src/components/circuit-editor/SchematicToolbar.tsx:69-79` — Grid snap toggle button is icon-only with no `aria-label`
- [ ] HIGH `client/src/components/circuit-editor/SchematicToolbar.tsx:80-88` — Fit view button is icon-only with no `aria-label`
- [ ] HIGH `client/src/components/views/SchematicView.tsx:91-103` — Toggle parts panel button is icon-only with no `aria-label`
- [ ] HIGH `client/src/components/views/SchematicView.tsx:136-153` — Toggle ERC panel button has `title` but no `aria-label`

### HIGH — Asset Manager Buttons

- [ ] HIGH `client/src/components/panels/asset-manager/AssetGrid.tsx:155-159` — Favorite toggle buttons are icon-only with no `aria-label`
- [ ] HIGH `client/src/components/panels/asset-manager/AssetGrid.tsx:161-167` — Add asset buttons are icon-only with no `aria-label`
- [ ] HIGH `client/src/components/panels/asset-manager/AssetSearch.tsx:87-103` — Category filter buttons are icon-only (conditionally have text via `showLabels`) with no `aria-label`
- [ ] HIGH `client/src/components/panels/asset-manager/AssetSearch.tsx:71-79` — Sort button is icon-only with no `aria-label`

### HIGH — Sidebar Buttons

- [ ] HIGH `client/src/components/layout/sidebar/HistoryList.tsx:194-203` — Undo button is icon-only with no `aria-label`
- [ ] HIGH `client/src/components/layout/sidebar/HistoryList.tsx:218-238` — Copy and close buttons in expanded view are icon-only with no `aria-label`

### HIGH — Component Editor Sub-panels

- [ ] HIGH `client/src/components/circuit-editor/ERCPanel.tsx:172-181` — Settings button is icon-only with `title` but no `aria-label`
- [ ] HIGH `client/src/components/circuit-editor/ERCPanel.tsx:202-225` — Rule toggle and severity toggle buttons are icon-only with `title` but no `aria-label`
- [ ] HIGH `client/src/components/views/component-editor/LayerPanel.tsx:114-123` — Layer visibility toggle buttons are icon-only with `title` but no `aria-label`
- [ ] HIGH `client/src/components/views/component-editor/LayerPanel.tsx:124-133` — Layer lock toggle buttons are icon-only with `title` but no `aria-label`
- [ ] HIGH `client/src/components/views/component-editor/ComponentInspector.tsx:349-355` — Accept suggestion button is icon-only with `title` but no `aria-label`
- [ ] HIGH `client/src/components/views/component-editor/ComponentInspector.tsx:356-362` — Dismiss suggestion button is icon-only with `title` but no `aria-label`
- [ ] HIGH `client/src/components/views/component-editor/ComponentInspector.tsx:429-435` — Toggle constraint button is icon-only with `title` but no `aria-label`
- [ ] HIGH `client/src/components/views/component-editor/ComponentInspector.tsx:436-442` — Delete constraint button is icon-only with `title` but no `aria-label`
- [ ] HIGH `client/src/components/views/component-editor/PinTable.tsx:94-103` — Delete pin button is `size="icon"` with no `aria-label`

### HIGH — Component Library Browser

- [ ] HIGH `client/src/components/views/component-editor/ComponentLibraryBrowser.tsx:86-93` — Clear search button is icon-only with no `aria-label`

### HIGH — Simulation Panel

- [ ] HIGH `client/src/components/simulation/SimulationPanel.tsx:787-795` — Remove probe button is icon-only with `title="Remove probe"` but no `aria-label`

---

## 2. Form Fields Without Labels

### HIGH — Chat Inputs

- [ ] HIGH `client/src/components/panels/chat/MessageInput.tsx:55-70` — Chat textarea has no `aria-label` or associated `<label>` element
- [ ] HIGH `client/src/components/panels/chat/ChatSearchBar.tsx:15-22` — Search input has no `aria-label` or associated `<label>`

### HIGH — Settings Panel Label Association

- [ ] HIGH `client/src/components/panels/chat/SettingsPanel.tsx:68-79` — Model `<select>` has a visual `<label>` but it is not associated via `htmlFor`/`id`
- [ ] HIGH `client/src/components/panels/chat/SettingsPanel.tsx:85-103` — API key input has a visual `<label>` not associated via `htmlFor`/`id`; toggle visibility button also lacks `aria-label`
- [ ] HIGH `client/src/components/panels/chat/SettingsPanel.tsx:122-136` — Temperature slider/input has visual `<label>` not associated via `htmlFor`/`id`
- [ ] HIGH `client/src/components/panels/chat/SettingsPanel.tsx:141-148` — Custom instructions textarea has visual `<label>` not associated via `htmlFor`/`id`

### HIGH — Sidebar Inputs

- [ ] HIGH `client/src/components/layout/Sidebar.tsx:234-241` — Search input in sidebar has no `aria-label` or associated `<label>`

### HIGH — Output View

- [ ] HIGH `client/src/components/views/OutputView.tsx:94-101` — Filter logs input has no `aria-label` or associated `<label>`

### MEDIUM — Project Settings

- [ ] MEDIUM `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx:68-76` — Project name input has no `<label>` or `aria-label`
- [ ] MEDIUM `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx:78-85` — Project description textarea has no `<label>` or `aria-label`

### MEDIUM — Component Editor Mount Type

- [ ] MEDIUM `client/src/components/views/ComponentEditorView.tsx:120-132` — Mounting type Select has a visual `<Label>` element but is not associated via `htmlFor`/`id`

### MEDIUM — Asset Manager Form

- [ ] MEDIUM `client/src/components/panels/asset-manager/AssetGrid.tsx:321-342` — Custom asset form inputs (name, type, description) have no `<label>` or `aria-label`
- [ ] MEDIUM `client/src/components/panels/asset-manager/AssetSearch.tsx:61-68` — Asset search input has no `aria-label`

### MEDIUM — Procurement Inline Edits

- [ ] MEDIUM `client/src/components/views/ProcurementView.tsx:688-698` — Inline edit inputs in table rows have no `<label>` or `aria-label`

### MEDIUM — Component Placer

- [ ] MEDIUM `client/src/components/circuit-editor/ComponentPlacer.tsx:184-189` — Component search input has no `aria-label`

### MEDIUM — Power Symbol Palette

- [ ] MEDIUM `client/src/components/circuit-editor/PowerSymbolPalette.tsx:121-127` — Custom power net name input has no `aria-label`

### MEDIUM — Component Library Browser

- [ ] MEDIUM `client/src/components/views/component-editor/ComponentLibraryBrowser.tsx:78-84` — Library search input has no `aria-label` (has `placeholder` but that is not a substitute)

### MEDIUM — Pin Table Inputs

- [ ] MEDIUM `client/src/components/views/component-editor/PinTable.tsx:20-25` — Pin name input has no `aria-label`; table column header provides visual context but not programmatic association
- [ ] MEDIUM `client/src/components/views/component-editor/PinTable.tsx:43-49` — Pin description input has no `aria-label`

### MEDIUM — Simulation Probe Inputs

- [ ] MEDIUM `client/src/components/simulation/SimulationPanel.tsx:760-767` — Probe name input has no `aria-label` (only `placeholder`)
- [ ] MEDIUM `client/src/components/simulation/SimulationPanel.tsx:779-785` — Probe node/component input has no `aria-label` (only `placeholder`)
- [ ] MEDIUM `client/src/components/simulation/SimulationPanel.tsx:768-778` — Probe type `<select>` has no associated `<label>` or `aria-label`

### MEDIUM — DRC Rule Parameter Inputs

- [ ] MEDIUM `client/src/components/views/component-editor/DRCPanel.tsx:164-173` — DRC rule parameter `<input type="number">` fields have a visual `<label>` wrapper but the label text is not directly associated; screen readers may struggle to identify which parameter belongs to which rule

---

## 3. Missing Alt Text on Images

### LOW

- [ ] LOW — No `<img>` elements found in most component files. Icons use Lucide React components (`<Icon className="..." />`), which render as SVG and do not require alt text as they are decorative when paired with visible text.

### POSITIVE FINDINGS

- `DatasheetExtractModal.tsx:276-279` — Preview images have `alt="Datasheet preview"` (good)
- `PinExtractModal.tsx:231-234` — Preview images have `alt="Chip photo preview"` (good)

---

## 4. Heading Hierarchy

### LOW

- [ ] LOW `client/src/components/panels/chat/MessageBubble.tsx` — AI responses rendered via markdown can produce arbitrary heading levels (`h1`, `h2`, `h3`, etc.) that may skip levels relative to the page's heading structure. The page uses `h2` for section titles; AI-generated content beginning with `# Heading` would produce an `h1` within a subsection.
- [ ] LOW `client/src/components/simulation/SimulationPanel.tsx:659` — Uses `h2` for "Circuit Simulation" which is appropriate; however the `CollapsibleSection` uses uppercase text without heading elements, which is fine but could benefit from `<h3>` for hierarchical structure in the section titles.

### POSITIVE FINDINGS

- `ValidationView.tsx` — Uses `h2` and `h3` headings properly
- `not-found.tsx` — Uses `h1` appropriately
- `PowerSymbolPalette.tsx:162` — Uses `h3` for "Power Symbols"
- `ComponentLibraryBrowser.tsx` — Uses `DialogTitle` which renders as an `h2`

---

## 5. Focus Indicators

### MEDIUM — Custom Inputs Override Default Focus

- [ ] MEDIUM `client/src/components/simulation/SimulationPanel.tsx:233-239` — ParamField input uses `focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20`. The `ring-primary/20` (20% opacity) may be too subtle for WCAG 2.4.7 focus visible compliance, especially on dark backgrounds.
- [ ] MEDIUM `client/src/components/views/component-editor/DRCPanel.tsx:170-171` — Inline rule parameter `<input>` has no explicit focus styling; relies on browser default which may be invisible on the dark theme.
- [ ] MEDIUM `client/src/components/views/component-editor/ComponentInspector.tsx:379-386` — Constraint distance and pitch inputs lack explicit focus styling.

### LOW — Global Pattern

- [ ] LOW — Multiple components use `focus:outline-none` with a replacement `focus:border-primary` or `focus:ring-primary`. While this provides a focus indicator, the primary color ring at low opacity (e.g., `/20`) may not meet the 3:1 contrast ratio required by WCAG 2.4.11 for focus indicator visibility. Consider using at least `ring-primary/50` or `ring-2` globally.

### POSITIVE FINDINGS

- Most `<Button>` components from shadcn/ui include `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` which is compliant.
- `SimulationPanel.tsx` CollapsibleSection buttons have adequate focus styling from default browser + transition-colors.

---

## 6. Color Contrast

### MEDIUM — Low Opacity Text

- [ ] MEDIUM `client/src/components/panels/asset-manager/AssetSearch.tsx:99-101` — Badge counters use `bg-[#21212199]` (hardcoded semi-transparent dark background) with `text-[#dbdbdb]` (light gray text). The semi-transparent background on a dark theme may result in contrast below 4.5:1.
- [ ] MEDIUM `client/src/components/simulation/SimulationPanel.tsx:709` — Analysis type descriptions use `opacity-70` on an already `text-muted-foreground` base, which compounds to very low contrast.
- [ ] MEDIUM — Multiple components use `text-muted-foreground/40` or `text-muted-foreground/50` for secondary information. On the dark theme (where `muted-foreground` is typically around `#a1a1aa`), 40-50% opacity yields a contrast ratio below 3:1 against the dark background, failing WCAG AA for normal text.

### LOW — Very Small Text

- [ ] LOW — Extensive use of `text-[9px]` and `text-[10px]` across many components (DRCPanel, HistoryPanel, LayerPanel, ERCPanel, AssetSearch, ComponentInspector, ProbeOverlay). While small text size is not itself a WCAG violation, WCAG 1.4.4 requires text to be resizable to 200% without loss of content, and text this small becomes unreadable for many users. Consider a minimum of 11px for any interactive or informational text.

---

## 7. Keyboard Accessibility

### CRITICAL — Interactive `<div>` Elements Without Keyboard Support

- [ ] CRITICAL `client/src/components/layout/Sidebar.tsx:54-58` — Collapsed sidebar is a `<div onClick={onToggleCollapse}>` with no `role`, `tabIndex`, or `onKeyDown`. Keyboard users cannot expand the sidebar.
- [ ] CRITICAL `client/src/components/panels/ChatPanel.tsx:649-663` — Collapsed chat panel is a `<div onClick={onToggleCollapse}>` with no `role`, `tabIndex`, or `onKeyDown`. Keyboard users cannot expand the chat.
- [ ] CRITICAL `client/src/components/layout/Sidebar.tsx:275-278` — Blocks expanded/collapsed toggle is a `<div onClick>` with no keyboard support.
- [ ] CRITICAL `client/src/components/layout/sidebar/ComponentTree.tsx:89-101` — Component category items are `<div onClick>` with `cursor: 'grab'` but no `role="button"`, `tabIndex`, or `onKeyDown`. Completely inaccessible to keyboard.
- [ ] CRITICAL `client/src/components/layout/sidebar/ComponentTree.tsx:107-123` — Component node items are `<div onClick>` with `draggable` but no `role`, `tabIndex`, or `onKeyDown`.
- [ ] CRITICAL `client/src/components/layout/sidebar/HistoryList.tsx:185-188` — Timeline items are `<div onClick className="cursor-pointer">` with no `role`, `tabIndex`, or `onKeyDown`.
- [ ] CRITICAL `client/src/components/views/OutputView.tsx:112-132` — Log entry rows are `<div onClick>` for copying, with no `role`, `tabIndex`, or `onKeyDown`.
- [ ] CRITICAL `client/src/components/views/ProcurementView.tsx:297-301` — "Edit List" toggle is a `<span onClick>` with no keyboard handler, `role`, or `tabIndex`.
- [ ] CRITICAL `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx:118-125` — Version number copy is a `<div onClick>` with no keyboard handler.

### MEDIUM — Resize Handle

- [ ] MEDIUM `client/src/pages/ProjectWorkspace.tsx:36-75` — ResizeHandle uses `<div onMouseDown>` for drag resizing but provides no keyboard-based resizing mechanism (e.g., arrow keys). Keyboard users cannot resize sidebar or chat panel widths.

### MEDIUM — Double-Click Only Interactions

- [ ] MEDIUM `client/src/components/layout/Sidebar.tsx:263-270` — Node rename is triggered by `onDoubleClick` on a `<span>`. There is no keyboard equivalent (e.g., F2 key or Enter).

### MEDIUM — Canvas-Based Interactions

- [ ] MEDIUM `client/src/components/circuit-editor/BreadboardView.tsx:377-386` — Canvas div has `tabIndex={0}` but no `role` or `aria-label` to describe its purpose.
- [ ] MEDIUM `client/src/components/circuit-editor/PCBLayoutView.tsx:306-317` — Canvas div has `tabIndex={0}` but no `role` or `aria-label`.
- [ ] MEDIUM `client/src/components/views/component-editor/LayerPanel.tsx:96-104` — Layer rows are `<div onClick>` for selection with no `role="option"`, `tabIndex`, or `onKeyDown`.
- [ ] MEDIUM `client/src/components/views/component-editor/ShapeCanvas.tsx:257-266` — Toolbar tool buttons within ShapeCanvas use `title` but no `aria-label` (same pattern as ToolButton.tsx).

### POSITIVE FINDINGS

- `ValidationView.tsx:309,345,381,412` — Issue rows properly use `role="button"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space. This is the gold standard to follow.
- `CustomNode.tsx:57-59` — Architecture nodes have `role="button"`, `tabIndex={0}`, and `aria-label`.
- `ValidationModal.tsx:62-64` — Clickable validation issue divs conditionally add `role="button"` and `tabIndex={0}`.
- `DiffPreview.tsx:88` — CollapsibleSection toggle uses `aria-expanded`.
- `SimulationPanel.tsx:191` — CollapsibleSection uses `aria-expanded`.
- `ComponentEditorView.tsx` keyboard shortcuts properly filter out input/textarea targets.

---

## 8. Modal Focus Trap

### POSITIVE FINDINGS — All Modals Use Radix UI

- `dialog.tsx` — Uses Radix `Dialog` which automatically traps focus, returns focus on close, and handles Escape key.
- `confirm-dialog.tsx` — Uses Radix `AlertDialog` which provides focus trapping.
- `keyboard-shortcuts-modal.tsx` — Uses `Dialog` with proper `DialogTitle` and `DialogDescription`.
- `GeneratorModal.tsx` — Uses `Dialog` with focus management.
- `ModifyModal.tsx` — Uses `Dialog` with focus management.
- `DatasheetExtractModal.tsx` — Uses `Dialog` with focus management.
- `PinExtractModal.tsx` — Uses `Dialog` with focus management.
- `ValidationModal.tsx` — Uses `Dialog` with focus management.
- `ComponentLibraryBrowser.tsx` — Uses `Dialog` with focus management.

No issues found. All modals correctly use Radix UI primitives with built-in focus trapping.

---

## 9. Skip Links

### POSITIVE FINDINGS

- [ ] PASS `client/src/pages/ProjectWorkspace.tsx:140-145` — Two skip links are provided: "Skip to main content" (`#main-content`) and "Skip to AI assistant" (`#chat-panel`). Both use `sr-only` with `focus:not-sr-only` for visibility on focus.
- [ ] PASS `client/src/pages/ProjectWorkspace.tsx:182` — `<main>` element has `id="main-content"` matching the skip link target.
- [ ] PASS `client/src/pages/ProjectWorkspace.tsx:300` — Chat panel wrapper has `id="chat-panel"` matching the skip link target.

### LOW — Missing Skip Links for Complex Sub-Views

- [ ] LOW — Views with many interactive elements (SchematicView, BreadboardView, PCBLayoutView, SimulationPanel) do not provide internal skip links to bypass toolbar regions and jump directly to content areas. For complex EDA tools, additional skip navigation could significantly improve keyboard navigation efficiency.

---

## 10. ARIA Roles Misuse

### MEDIUM — Container with tabIndex but No Role

- [ ] MEDIUM `client/src/components/panels/AssetManager.tsx:174-178` — Container div has `tabIndex={0}` but no `role` or `aria-label`. Adding `tabIndex` without a role creates a focusable element that screen readers cannot describe.
- [ ] MEDIUM `client/src/components/circuit-editor/BreadboardView.tsx:377-386` — Canvas container has `tabIndex={0}` but no `role` or `aria-label`.
- [ ] MEDIUM `client/src/components/circuit-editor/PCBLayoutView.tsx:306-317` — Canvas container has `tabIndex={0}` but no `role` or `aria-label`.

### POSITIVE FINDINGS

- `ComponentInspector.tsx:464-466` — Uses `role="complementary"` with `aria-label="Shape properties inspector"` (excellent).
- `CustomNode.tsx:57-59` — Uses `role="button"` with `aria-label` on interactive nodes.
- `ValidationView.tsx` — Uses `role="button"` on clickable issue rows.
- `ValidationModal.tsx:62-64` — Conditionally adds `role="button"` when items are clickable.
- `ShapeCanvas.tsx:203` — Uses `role="img"` with `aria-label` on SVG shape groups.
- `ProjectWorkspace.tsx:182` — Uses `aria-live="polite"` on main content area.
- `DiffPreview.tsx:88` — Uses `aria-expanded` on collapsible sections.
- `SimulationPanel.tsx:191` — Uses `aria-expanded` on collapsible sections.

---

## Cross-Cutting Concerns

### Draggable Elements Missing Keyboard Alternatives

- [ ] MEDIUM `client/src/components/circuit-editor/PowerSymbolPalette.tsx:64-84` — Power symbol items are `draggable` but provide no keyboard-based alternative to drag-and-drop for placing symbols on the canvas.
- [ ] MEDIUM `client/src/components/circuit-editor/ComponentPlacer.tsx` — Component items are draggable to the canvas but have no keyboard alternative.
- [ ] MEDIUM `client/src/components/layout/sidebar/ComponentTree.tsx:107-123` — Architecture nodes are draggable with no keyboard alternative.

### Screen Reader Live Region Gaps

- [ ] MEDIUM — When AI actions modify project state (adding nodes, running DRC, etc.), there are no `aria-live` announcements for the state changes. The main content area has `aria-live="polite"` but individual action completions within chat (MessageBubble action results) do not trigger live region updates.

### SettingsPanel Provider Selection State

- [ ] MEDIUM `client/src/components/panels/chat/SettingsPanel.tsx:42-62` — AI provider toggle buttons do not communicate the selected state via `aria-pressed` or `aria-selected`. The active state is only communicated visually (background color change).

---

## Recommendations (Priority Order)

1. **Fix ToolButton.tsx** — Add `aria-label={label}` to the component. This single change fixes accessibility for all toolbar buttons across BreadboardView, PCBLayoutView, and ShapeCanvas.

2. **Fix collapsed panel divs** — Add `role="button"`, `tabIndex={0}`, and `onKeyDown` (Enter/Space) handlers to the collapsed sidebar and chat panel click targets.

3. **Fix all icon-only buttons** — Systematic pass through ChatHeader, MessageBubble, MessageInput, OutputView, ArchitectureView, ProcurementView, ComponentEditorView, SchematicToolbar, LayerPanel, ERCPanel, HistoryList, AssetGrid, AssetSearch, ComponentInspector, and PinTable to add `aria-label` attributes.

4. **Fix form field label association** — Either use `htmlFor`/`id` pairs or add `aria-label` to all inputs that currently lack programmatic labels.

5. **Add keyboard support to interactive divs** — Follow the pattern from ValidationView.tsx: `role="button"`, `tabIndex={0}`, `onKeyDown` with Enter/Space handling for ComponentTree items, HistoryList items, OutputView log entries, and LayerPanel rows.

6. **Add `role` to focusable containers** — Add `role="application"` and `aria-label` to canvas containers (BreadboardView, PCBLayoutView) that have `tabIndex={0}`.

7. **Improve focus indicator contrast** — Increase ring opacity from `/20` to at least `/50` for custom focus styles, or use `ring-2 ring-ring` consistently.

8. **Add `aria-pressed`** to toggle buttons (provider selection, overlay toggles, snap toggles).
