# Phase 3: UX & Workflow Evaluation -- ProtoPulse

> Generated: 2026-02-28
> Refined: 2026-02-28 (cross-phase integration with Phases 1, 4, 5)
> Personas evaluated: Hobbyist maker, Professional electrical engineer, Hardware startup founder

## Accessibility Scorecard

| Metric | Count | Assessment |
|--------|-------|------------|
| aria-* attributes | 120 across 41 files | Moderate -- most come from shadcn/ui primitives, not custom components |
| role= attributes | 35 across 20 files | Low -- only structural roles (tablist, tabpanel), missing landmark roles on many interactive regions |
| tabIndex usage | 13 across 10 files | Very low -- most custom interactive elements (canvas tools, context menus, tree items) lack explicit tab ordering |
| alt= on images | 6 across 4 files | Adequate for current image count (dynamic images only, no static images in app) |
| Keyboard shortcut handlers | 62 across 23 files | Good -- extensive shortcuts across views (Architecture, Schematic, Component Editor, Breadboard, PCB) |
| Loading/skeleton states | 85 across 21 files | Good -- Suspense fallbacks with skeleton UIs, per-view loading indicators |
| Error toast/notification patterns | 24 across 12 files | Moderate -- toast system exists but not all error paths surface user feedback |
| data-testid coverage | 587 across 67 files | Excellent -- very high test hook coverage |
| Focus-visible indicators | 61 across 33 files | Moderate -- present on major controls but missing from many custom buttons |
| `<form>` elements | 0 | Zero -- all input handling is imperative (no native form submission, no FormData) |
| `<label>` associations | 43 across 12 files | Low -- many inputs (sidebar search, chat input, log filter) lack associated labels |
| Skip links | 2 | Present -- "Skip to main content" and "Skip to AI assistant" |
| **Overall grade** | | **C+** |

**Assessment rationale:** The app has a strong foundation from shadcn/ui (Radix primitives provide base-level accessibility). However, custom-built interactive surfaces (canvas tools, drag-drop, context menus, tree views) largely bypass these primitives and lack equivalent accessibility support. Zero `<form>` elements means no native form validation, no `Enter` to submit behavior, and no assistive technology form mode. The keyboard shortcut system is impressive for an EDA tool but undiscoverable without the `?` modal.

**Zero-form cross-reference (Phase 4/5):** Phase 4 found `@hookform/resolvers` installed but unused -- a dependency for a feature that does not exist. Meanwhile Phase 5 proposes IN-12 (command palette via `cmdk`, which is also already installed but unused) as a keyboard-first interaction pattern that could bypass the form problem entirely for power users. The combination of zero forms, an unused form library, and an unused command palette library points to abandoned or never-started form infrastructure.

---

## Performance-Caused Friction (Phase 4 Root Causes)

Phase 4's complexity and performance analysis reveals that several UX friction points documented below are **symptoms of architectural problems**, not simply missing features. Fixing the UX without addressing the root cause will compound existing tech debt.

| UX Symptom | Root Cause (Phase 4) | Tech Debt Ref | Implication |
|------------|---------------------|---------------|-------------|
| Tab switching feels sluggish | ProjectProvider monolith (40+ values in one context) causes re-render storms -- ANY state change triggers ALL consuming components to re-render | TD-07 | Cannot fix with UI optimization alone; must split context into domain-specific providers first |
| AI actions cause visible UI jank | Same re-render storm -- AI action execution updates state, which cascades through the monolith | TD-07 | Action execution should only re-render the affected view, not the entire app |
| PCB trace routing has no DRC feedback (UI-11) | PCBLayoutView has CCN=135 (9x danger threshold) -- adding ANY feature to this component compounds an already unmaintainable file | TD-01 | Must refactor PCBLayoutView before adding DRC visualization; otherwise the file becomes even more resistant to change |
| Local mode behavior is confusing (UI-09) | `parseLocalIntent` has CCN=102 -- a 208-line decision tree that grew organically without architectural planning | TD-05 | The parser needs decomposition before local mode capabilities can be clearly communicated; the logic itself is too tangled to document |
| AI actions sometimes fail silently | `useActionExecutor` is 1,299 lines with inconsistent error handling across 53+ action types | TD-06 | No systematic error handling per action type; some actions swallow errors, others surface generic messages |
| DRC visualization needed in Component Editor | ShapeCanvas has aggregate CCN=381 (6 functions with CCN>20) -- the highest complexity in the entire codebase | TD-04 | Adding DRC overlays here without decomposition will create catastrophic complexity |

**Refactor-first prerequisite list:** Before fixing these UX issues, the corresponding tech debt items MUST be addressed:
- UI-11 (DRC visualization) needs TD-01 (PCBLayoutView refactor) AND TD-04 (ShapeCanvas decomposition)
- UI-09 (Local vs API mode clarity) needs TD-05 (parseLocalIntent refactor)
- General UI sluggishness needs TD-07 (ProjectProvider split)
- AI error handling needs TD-06 (useActionExecutor split)

---

## Orphaned Features (Phase 1 Inventory Cross-Reference)

Phase 1's state inventory identified features that exist server-side or in AI tool registrations but have no user-facing path. These are not "missing features" -- they are **built features with no UI affordance**.

| Feature | Where It Exists | What's Missing | Impact |
|---------|----------------|----------------|--------|
| FZPZ component import | Server-side endpoint in routes.ts | No file picker, no import button, no drag-drop for .fzpz files anywhere in the UI | Professional engineers cannot import Fritzing parts despite the capability being implemented |
| `copy_architecture_json` / `copy_architecture_summary` | Registered AI tools (Phase 1 inventory) | No native Ctrl+C support for architecture nodes; clipboard operations are AI-mediated only | Users must ask the AI to copy their own design data -- unintuitive and undiscoverable |
| `start_tutorial` | Registered AI action type in constants.ts | Action is registered but the handler is unimplemented -- triggering it does nothing | "Show Help" in chat references tutorial capability that doesn't work; a broken promise in the UI |
| 12 export generators | Server-side: KiCad, SPICE, Gerber, Eagle, Fritzing, BOM CSV, pick-and-place, design report, etc. | All 12 are only accessible via AI chat commands; no export button, no export panel, no file picker | Users who don't know the right AI command cannot access exports they need for manufacturing |

---

## Persona 1: Hobbyist Maker

**Profile:** Weekend builder, Arduino/Raspberry Pi projects. Familiar with Fritzing/Tinkercad. Low tolerance for complexity, wants visual feedback, prefers learning by doing. May not own a paid EDA license.

### Workflow: Onboarding / First-Time Experience

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Open app | Auto-redirected to `/projects/1` | **High friction**: No signup, no login, no project creation. User lands directly in someone else's project (hardcoded PROJECT_ID=1). No welcome screen, no tutorial, no explanation of what ProtoPulse is. |
| 2. See workspace | 3-panel layout: sidebar + tabbed views + collapsed chat | **Medium friction**: Architecture tab is active by default but canvas is empty. Empty state message says "Ask Chat to generate a system architecture or drag components from the Asset Library" -- good guidance. |
| 3. Try "Generate Architecture" | Button in empty state triggers AI chat | **High friction**: Without an API key, falls back to local command parsing with `parseLocalIntent`. The local "Generate Architecture" produces a generic response but does add nodes via action system. However, user gets no clear indication they need an API key for full AI features. |
| 4. Explore tabs | Click through Architecture, Schematic, Breadboard, PCB, etc. | **Medium friction**: 8 tabs across the top is overwhelming for a hobbyist. No progressive disclosure -- all views are visible whether relevant or not. Schematic view shows "No Circuit Designs" empty state with clear CTAs. |
| 5. Try chat | Open AI assistant panel | **Low friction**: Empty state has three suggestion buttons ("Generate Architecture", "Project Summary", "Show Help"). Quick actions bar provides discoverable entry points. Status line clearly shows "Local Mode (No API Key) -- Configure in Settings". |
| 6. Settings | Click gear or "Configure in Settings" link | **Low friction**: Settings panel slides over messages, API key input is prominent. Provider/model selection is clear. |

**Key friction points:**
| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| No onboarding flow / welcome screen | Critical | App.tsx, ProjectWorkspace.tsx | First-time users have no context about what ProtoPulse does or how to start |
| Hardcoded PROJECT_ID=1 | Critical | project-context.tsx | No project creation, no project selection -- user cannot start fresh |
| No indication of AI vs Local mode capabilities | High | ChatPanel.tsx:200-217 | User doesn't know what local mode can/cannot do vs. API-powered mode. **Root cause:** parseLocalIntent CCN=102 (TD-05) makes the local mode behavior itself inconsistent and hard to document. |
| 8 tabs visible at once overwhelms beginners | Medium | ProjectWorkspace.tsx:234-244 | Hobbyists don't need PCB/Schematic/Validation on day one |
| No interactive tutorial or guided tour | High | App-wide | Fritzing has guided examples; ProtoPulse throws users into a blank canvas. The `start_tutorial` AI action is registered but unimplemented -- a broken promise. |

### Workflow: Core Daily Loop (Design a simple LED circuit)

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Create architecture | Ask AI or use asset library | **Low**: Asset manager has categories (MCU, Sensors, Power, etc.) with drag-drop. Good. |
| 2. Connect components | Draw edges in ReactFlow | **Low**: Click-drag from node handle to node handle. Standard pattern. |
| 3. Add BOM items | Switch to Procurement tab | **Medium**: No automatic BOM generation from architecture nodes. User must manually add items or ask AI. |
| 4. Validate design | Switch to Validation tab | **Low**: "Run Full Validation" button is prominent. Results categorized by severity. |
| 5. Export | Switch to Output tab | **Medium**: Output tab is a console log, not an export UI. Exports happen through AI commands ("Export BOM CSV") or individual view features. No unified export panel. |

### Workflow: Advanced Usage

**Hobbyist advanced = sharing and iterations.**

| Step | What Happens | Friction |
|------|-------------|----------|
| Share design | No share feature exists | **Critical dead-end**: No export to image, no shareable URL, no project export/import (except through AI chat commands for specific formats). |
| Version comparison | History list in sidebar shows actions | **Low**: History is append-only activity log. No branching, no diff view, no "restore to this point" for hobbyist. |
| Component library | Browse community parts | **Dead-end**: Component library browser exists but only shows project-local parts. No community library, no Fritzing part import UI (server supports FZPZ but no UI affordance -- see Orphaned Features). |

### Workflow: Error Recovery

| Step | What Happens | Friction |
|------|-------------|----------|
| Undo mistake | Ctrl+Z in Architecture view | **Low**: Undo/redo works via pushUndoState pattern. Good. |
| AI request fails | Error message in chat | **Medium**: Error shows as red message bubble but generic "Failed to communicate with AI. Check your settings." No specific guidance on what to check. **Root cause:** useActionExecutor (1,299 lines, TD-06) has inconsistent error handling across 53+ action types. |
| Browser crash | Reload page | **High**: All state depends on server. If server is down, entire app is non-functional. No offline mode, no local state persistence. |
| ErrorBoundary catches error | "Something went wrong" + Try Again button | **Low**: ErrorBoundary per view means one view crashing doesn't kill others. Good isolation. |

---

## Persona 2: Professional Electrical Engineer

**Profile:** Uses KiCad/Altium daily. Expects professional-grade schematic capture, DRC, netlist export. Keyboard-driven workflow. High standards for precision, reliability, and data integrity. Works on multi-sheet designs with 100+ components.

### Workflow: Onboarding

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Evaluate tool | Land on workspace | **High friction**: No feature overview, no documentation accessible from UI. Professional needs to know: Does it support multi-sheet schematics? What DRC rules? What export formats? All discoverable only through exploration. |
| 2. Import existing design | Look for import | **Critical dead-end**: No KiCad import, no EAGLE import, no netlist import from UI. Server has FZPZ import but no UI affordance for it (see Orphaned Features). Professional has no way to migrate existing work. |
| 3. Check precision tools | Snap grid, measurement | **Medium**: Snap-to-grid exists (20x20). Component editor has measurement tool. But no coordinate display, no explicit grid spacing selector in Architecture view. |

### Workflow: Core Daily Loop (Schematic capture for a sensor board)

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Create schematic | Schematic view, place components | **Medium**: Component placer exists with search. ERC panel available. But component library is limited to project-local parts. No standard symbol library (74xx, passives, connectors). |
| 2. Draw nets | Wire drawing tool with W key | **Low**: Net drawing tool with snapping. Keyboard shortcut documented. |
| 3. Name nets | Assign net labels | **Medium**: Net labels exist but naming is done through AI actions or manual entry. No inline net naming while drawing. |
| 4. Run ERC | Electrical Rules Check | **Low**: ERC panel with configurable rules. Violations highlighted on canvas with overlays. Good. |
| 5. Generate netlist | Export for PCB | **Medium**: Export panel exists in schematic view. KiCad netlist export available through AI commands. But no visual netlist preview. |
| 6. PCB layout | Switch to PCB tab | **Medium**: PCB layout view has footprint placement, trace routing, layer management. But no design rule constraints visible. No clearance indicators during routing. **Root cause:** PCBLayoutView CCN=135 (TD-01) means the component is too complex to safely add DRC visualization -- the file is essentially unmaintainable in its current state. |

### Workflow: Advanced (Multi-sheet hierarchical design)

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Create sheets | Hierarchical sheet panel | **Low**: HierarchicalSheetPanel component exists with sheet management. Good. |
| 2. Cross-sheet references | Connect between sheets | **Medium**: Sheet panel exists but cross-referencing behavior unclear from code. |
| 3. Simulation | SPICE simulation | **Medium**: SimulationPanel exists with waveform viewer. Probe overlay for measurement. But unclear if SPICE netlist generation is complete. |

### Key Friction Points

| Issue | Severity | Location | Impact | Phase 4 Blocker |
|-------|----------|----------|--------|-----------------|
| No standard component/symbol library | Critical | ComponentPlacer, SchematicCanvas | Professional cannot work without 74xx, passives, IC libraries | Scaling the library requires TD-09 (split ai-tools.ts) first |
| No import from KiCad/EAGLE/Altium | Critical | Server exports exist but no imports | Cannot evaluate tool with existing designs | Architecturally clean -- not blocked by debt |
| No coordinate/measurement readout on canvas | High | ArchitectureView, SchematicView | Precision work requires knowing exact positions | -- |
| No design rule constraints during PCB routing | High | PCBLayoutView | Traces routed without clearance feedback | **Blocked by TD-01** (CCN=135) |
| No net class assignment | High | SchematicCanvas | Power nets vs signal nets need different width/clearance rules | -- |
| API key stored client-side in component state | High | ChatPanel.tsx:55 | Professional would flag this as security concern -- key lost on refresh, visible in devtools | -- |

---

## Persona 3: Hardware Startup Founder

**Profile:** Manages a small team. Needs project overview, cost tracking, procurement, collaboration, and export for manufacturing. Values speed, AI assistance, and team workflow. Budget-conscious but willing to pay for productivity.

### Workflow: Onboarding

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Create new project | No project creation UI | **Critical**: Founder needs to create projects for different products. Hardcoded PROJECT_ID=1 is a complete blocker for multi-project workflow. |
| 2. Invite team members | No collaboration features | **Critical dead-end**: No user management visible in UI. Auth exists server-side but no team/org concept. No sharing. |
| 3. Understand AI capabilities | Explore chat | **Medium**: Quick actions and "Show Help" provide some guidance. But no feature comparison or pricing model for AI usage. |

### Workflow: Core Daily Loop (Review project status and costs)

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Check BOM cost | Procurement view | **Low**: Total cost display, per-item costing, supplier links. Optimization goals (Cost/Speed/Quality). Good for cost tracking. |
| 2. Run validation | Validation view | **Low**: Full validation with severity categorization. Clear pass/fail visual indicators. |
| 3. Export for review | Export design artifacts | **Medium**: Exports available via AI commands (KiCad, SPICE, Gerber, BOM CSV, Eagle, Fritzing). But no "Export All" button. No design report generator in UI (exists as AI action). |
| 4. Track changes | History in sidebar | **Medium**: History list shows timestamped actions. But no filtering, no "changes since last review," no export of changelog. |

### Workflow: Advanced (Prepare for manufacturing)

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Generate Gerber files | AI command "Export Gerber" | **High friction**: Manufacturing output should be a first-class UI feature, not an AI command. No Gerber preview in UI (exists as AI action). |
| 2. Generate pick-and-place | AI command | **Same issue**: Manufacturing files are AI-command-only. |
| 3. Generate design report | AI command "Export Design Report" | **Medium**: Report generation exists but only through chat. No direct button in Output view. |
| 4. Cost optimization | Ask AI to "Optimize BOM" | **Low**: AI can suggest alternative parts and optimize costs. Good AI integration here. |

### Workflow: Collaboration

| Step | What Happens | Friction |
|------|-------------|----------|
| 1. Share with teammate | No feature | **Critical dead-end**: No multi-user support, no sharing, no commenting, no role-based access. |
| 2. Review teammate's changes | No feature | **Critical dead-end**: Single-user app with no collaboration awareness. |
| 3. Export for external review | Chat export to .txt | **Low**: Chat export exists. But no design export for non-technical reviewers (no PDF, no image). |

### Key Friction Points

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| No multi-project support | Critical | project-context.tsx | Cannot manage multiple products |
| No collaboration / team features | Critical | App-wide | Startup founder cannot work with team |
| Manufacturing exports buried in AI chat | High | ChatPanel, AI actions | Critical manufacturing files should be in Output/Export UI |
| No design report PDF export | High | OutputView | Cannot share professional reports with investors/manufacturers |
| No project import/export | High | App-wide | Cannot backup, migrate, or share projects as files |
| No cost tracking over time | Medium | ProcurementView | Cannot see how BOM cost changed over design iterations |

---

## Cross-Persona Issues

These issues affect ALL personas regardless of skill level:

### 1. No Onboarding or First-Time Experience (Critical)
Every persona lands on a pre-existing project with no introduction. There is no:
- Welcome screen explaining ProtoPulse
- Project creation flow
- Interactive tutorial or guided tour
- Feature discovery mechanism beyond "?" keyboard shortcut

**Evidence:** Zero files match "onboarding|tutorial|walkthrough|welcome|getting started" in meaningful UI contexts. The only onboarding-related code is `start_tutorial` as an AI action type in constants.ts, which is registered but **unimplemented** -- the handler does nothing. Phase 5 proposes IN-10 to fill this gap with proper interactive tutorials.

### 2. Hardcoded Single-Project Limitation (Critical)
`PROJECT_ID = 1` is hardcoded. While `App.tsx` routes to `/projects/:projectId`, there is no project list, no project creation UI, and invalid IDs redirect to `/projects/1`.

**Evidence:** `App.tsx:14` redirects root to `/projects/1`. `ProjectWorkspace.tsx:523` redirects invalid IDs to `/projects/1`.

### 3. No Collaboration (Critical)
Auth exists server-side (sessions, API keys, users table) but there is no user-facing login UI, no team management, no real-time sync, no commenting.

**Evidence:** Zero files match collaboration-related UI patterns (invite, share, team, multi-user). WebSocket/real-time sync is absent.

### 4. Manufacturing Exports Only via AI Chat (High)

Export capabilities are extensive (KiCad, SPICE, Gerber, Eagle, Fritzing, BOM CSV, pick-and-place, design report) but ALL are triggered through AI chat commands rather than a dedicated export UI.

**Evidence:** `constants.ts` lists export actions (export_kicad, export_spice, export_gerber, etc.) as AI action types. ExportPanel.tsx exists in the schematic editor but is limited. No unified export manager view.

**Cross-phase refinement (Phase 1 + Phase 4):** The export friction is deeper than "missing UI." Phase 1 discovered a **dual export system**: an old monolithic `export-generators.ts` (1,209 lines) coexists with newer `server/export/` modules. Phase 4 confirms both are active (TD-10). This means:
1. There is no single source of truth for export logic
2. Any export UI built today would need to wire up to two competing backend systems
3. The export decomposition (TD-10) should be completed BEFORE building a unified export panel (UI-06)

The proper fix path is: TD-10 (complete export decomposition) -> UI-06 (build unified export panel) -> FG-07/08/09 (export improvements).

### 5. Zero `<form>` Elements (Medium-High)
All user input is handled through raw `onChange` handlers on inputs/textareas. This means:
- No native form validation
- No `required` attribute enforcement
- No browser autofill support
- No assistive technology form mode
- No `Enter` to submit on form fields (only chat textarea handles Enter)

**Evidence:** `rg '<form' client/src/ --glob '*.tsx'` returns zero matches.

**Cross-phase context (Phase 4 + Phase 5):**
- Phase 4 found `@hookform/resolvers` installed as a dependency but **completely unused** -- a form library for an app with zero forms. This should be removed as dead dependency weight.
- Phase 5 proposes IN-12 (command palette via `cmdk`) as a keyboard-first alternative. The `cmdk` package is already installed but also unused. For power users (professional engineers, keyboard-driven workflows), a command palette could bypass the need for traditional forms entirely for many operations (setting values, selecting options, triggering actions).
- The strategic choice: either invest in proper `<form>` elements (with react-hook-form or just native forms), or lean into the command palette pattern for power users and use forms only where truly needed (settings, API key input). Both the form library and command palette library are already installed -- neither is being used.

### 6. API Key Management is Fragile (High)
API key is stored in React component state (`const [aiApiKey, setAiApiKey] = useState('')`), which means:
- Lost on page refresh
- Not persisted to localStorage or server
- Visible in React DevTools
- Must be re-entered every session

**Evidence:** `ChatPanel.tsx:55` - `const [aiApiKey, setAiApiKey] = useState('');`

### 7. Error Messages Are Generic (Medium)
Most catch blocks produce generic "Failed to communicate with AI" or "Something went wrong" messages. No error codes, no specific recovery guidance, no link to documentation.

**Evidence:** 18 catch blocks across 10 client files. Only 12 files use toast for user notification. ErrorBoundary shows generic fallback.

**Root cause (Phase 4):** `useActionExecutor` at 1,299 lines (TD-06) handles all 53+ AI action types in a single monolith. Error handling is inconsistent -- some actions have detailed error messages, others swallow errors entirely. Splitting the action executor into per-domain handlers (TD-06) would enable consistent, specific error messages per action category.

---

## Quick Wins

| # | Improvement | Effort | Impact | Files to Change |
|---|-------------|--------|--------|-----------------|
| 1 | Add a welcome/empty-state overlay when project has zero nodes AND zero chat messages | S (hours) | High | ProjectWorkspace.tsx or ArchitectureView.tsx |
| 2 | Persist API key to localStorage (with clear security disclaimer) | S (hours) | High | ChatPanel.tsx, useChatSettings.ts |
| 3 | Add `aria-label` to all unlabeled inputs (sidebar search, log filter, chat input) | S (hours) | Medium | Sidebar.tsx, OutputView.tsx, MessageInput.tsx |
| 4 | Add a dedicated "Export" button/dropdown in the header bar with all available export formats | M (days) | High | ProjectWorkspace.tsx + new ExportDropdown component. **Note:** Should wire to the newer `server/export/` modules, not the old monolith. |
| 5 | Show "Local Mode" limitations explicitly (list what works vs. what needs API key) | S (hours) | Medium | ChatPanel.tsx empty state |
| 6 | Add focus-visible outlines to all custom toolbar/tool buttons (Architecture, Schematic, PCB) | S (hours) | Medium | ArchitectureView.tsx, SchematicToolbar.tsx, BreadboardView.tsx, PCBLayoutView.tsx |
| 7 | Progressive disclosure: hide advanced tabs (PCB, Simulation) until user has content in prerequisite views | M (days) | High | ProjectWorkspace.tsx |
| 8 | Add coordinate readout to canvas views (mouse position in grid units) | S (hours) | Medium | ArchitectureView.tsx, SchematicCanvas.tsx |
| 9 | Wrap input groups in `<form>` elements with proper `<label>` associations | M (days) | Medium | SettingsPanel.tsx, ProcurementView.tsx, ProjectSettingsPanel.tsx |
| 10 | Add "What's new" or feature discovery tooltip on first visit using localStorage flag | S (hours) | Medium | ProjectWorkspace.tsx |
| 11 | Activate `cmdk` command palette (already installed, zero usage) with basic actions | M (days) | High | New CommandPalette component + ProjectWorkspace.tsx. Provides keyboard-first alternative that bypasses zero-form problem for power users. |
| 12 | Remove `@hookform/resolvers` from dependencies (unused, zero forms exist) | S (minutes) | Low | package.json |

---

## Information Architecture Assessment

### Navigation Structure

```
/ --> Redirect to /projects/1
/projects/:id --> ProjectWorkspace (3-panel layout)
  |-- Sidebar (left)
  |     |-- Project Explorer (component tree, search)
  |     |-- History (activity log)
  |     |-- Settings (project name, description, stats)
  |
  |-- Main Content (center, tabbed)
  |     |-- Architecture (ReactFlow canvas + asset manager)
  |     |-- Schematic (circuit editor + component placer + ERC)
  |     |-- Breadboard (virtual breadboard)
  |     |-- PCB (footprint placement + trace routing)
  |     |-- Component Editor (SVG shape editor + DRC)
  |     |-- Procurement (BOM table + cost tracking)
  |     |-- Validation (DRC results)
  |     |-- Output (console log)
  |
  |-- Chat Panel (right)
        |-- AI chat with 53 action types
        |-- Settings (API key, model, temperature)
        |-- Search
        |-- Quick actions bar
```

**Strengths:**
- 3-panel layout is standard for professional tools (VS Code, KiCad, Altium pattern)
- Tab-based view switching is familiar and scalable
- Chat panel as persistent assistant is well-positioned
- Responsive design collapses sidebar at 1024px, chat at 768px
- Mobile bottom nav with primary/secondary tab split is thoughtful
- Scrollable tab bar with fade gradients handles overflow well

**Weaknesses:**
- No breadcrumb or path indicator showing where user is in the workflow
- No "dashboard" or "home" view for project overview
- Output tab is misnamed -- it's a console log, not output artifacts
- No visual workflow progression (e.g., Architecture -> Schematic -> PCB -> Manufacturing)
- Tab order doesn't clearly communicate the intended design flow
- "Project Explorer" in sidebar only shows architecture nodes, not a full project tree (no schematics, no PCB designs in tree)
- Tab switching perceived as sluggish due to ProjectProvider re-render storms (TD-07)

### Discoverability

| Feature | Discoverable? | How |
|---------|--------------|-----|
| Keyboard shortcuts | Low | Only via `?` key -- no menu item, no onboarding hint |
| AI capabilities | Medium | Quick actions bar + empty chat suggestions |
| Context menus | Low | Right-click only -- no hint that context menus exist |
| Export formats | Very Low | Only through AI chat or specific view panels. 12 export formats exist but none are surfaced in any menu or button. |
| Undo/redo | Medium | Standard Ctrl+Z works but no toolbar buttons |
| Drag-drop from asset library | Medium | Asset library panel is visible but drag hint is text-only |
| Voice input | High | Mic button visible in chat input |
| Image upload | High | Image button visible in chat input |
| Theme toggle | High | Visible in header bar |
| FZPZ import | None | Server-side only, no UI affordance whatsoever |
| Clipboard operations | None | AI-mediated only via `copy_architecture_json` / `copy_architecture_summary` tools |
| Command palette | None | `cmdk` installed but not activated -- zero usage |

### Information Density

The app successfully manages density through:
- Collapsible panels (sidebar, chat)
- Resizable panels (drag handles)
- Scrollable tab bar
- Context menus for less-common actions
- Tooltips on all icon buttons

But struggles with:
- Too many tabs visible at once for new users
- Procurement view has high density (BOM table + settings + filters + actions) without clear visual hierarchy
- Validation view mixes component DRC, circuit ERC, and architecture validation in a single list
