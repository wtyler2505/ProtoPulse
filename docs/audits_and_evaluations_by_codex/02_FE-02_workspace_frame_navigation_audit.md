# FE-02 Audit: Workspace Frame + Navigation

Date: 2026-03-05  
Auditor: Codex  
Section: FE-02 (from master map)  
Status: Completed first full line-by-line pass for this section.

## Scope Reviewed (line-by-line)
- `client/src/pages/ProjectWorkspace.tsx`
- `client/src/components/layout/Sidebar.tsx`
- `client/src/components/layout/WorkflowBreadcrumb.tsx`
- `client/src/components/layout/sidebar/sidebar-constants.ts`
- `client/src/components/layout/sidebar/SidebarHeader.tsx`
- `client/src/components/layout/sidebar/ProjectExplorer.tsx`
- `client/src/components/layout/sidebar/ComponentTree.tsx`
- `client/src/components/layout/sidebar/ProjectSettingsPanel.tsx`
- `client/src/components/layout/sidebar/HistoryList.tsx`
- `client/src/components/layout/__tests__/Sidebar.test.tsx`
- `client/src/components/ui/command-palette.tsx` (navigation entry point used by workspace)

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P1` “Import design file” action parses data but does not apply it to project state
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:510`
- `client/src/pages/ProjectWorkspace.tsx:520`
- `client/src/pages/ProjectWorkspace.tsx:522`
- `client/src/pages/ProjectWorkspace.tsx:523`

What is happening:
- Import reads file content and converts to ProtoPulse shape.
- Converted result (`proto`) is never written to architecture/circuit/BOM/project storage.
- UI only switches view to `output`.

Why this matters:
- User can think import worked, but workspace data does not actually update.
- This is a high trust-break issue in a core workflow.

Fix recommendation:
- Add a real apply step (mutation/storage update) after conversion.
- Show clear success toast with imported counts.
- If apply fails, keep current state and show explicit failure message.

---

### 2) `P2` Import failure path is mostly silent to the user
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:527`
- `client/src/pages/ProjectWorkspace.tsx:530`
- `client/src/pages/ProjectWorkspace.tsx:531`

What is happening:
- Failures are logged to console only or swallowed in empty catches.
- No in-app toast or UI feedback for many failure paths.

Why this matters:
- Users get no clear reason when import fails.
- Looks like button did nothing.

Fix recommendation:
- Replace empty catches with user-facing toasts.
- Include reason buckets: file read fail, parse fail, unsupported format, apply fail.

---

### 3) `P2` Progressive-disclosure rules are not consistent across navigation entry points
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:353`
- `client/src/pages/ProjectWorkspace.tsx:365`
- `client/src/pages/ProjectWorkspace.tsx:367`
- `client/src/components/layout/sidebar/sidebar-constants.ts:27`
- `client/src/components/layout/Sidebar.tsx:63`
- `client/src/components/ui/command-palette.tsx:72`
- `client/src/components/layout/WorkflowBreadcrumb.tsx:46`

What is happening:
- Top tab bar hides some views until design content exists.
- Other nav paths (collapsed sidebar icons, command palette, breadcrumb) still allow those views.
- Effect then forces user back to `architecture` when view is not allowed.

Why this matters:
- Navigation feels inconsistent and jumpy.
- Users can click valid-looking options and get bounced.

Fix recommendation:
- Centralize `allowedViews` logic in one helper.
- Use same gating in tabs, sidebar icons, command palette, and breadcrumb.
- Disable or hide blocked destinations consistently.

---

### 4) `P2` Collapsed sidebar settings icon is a dead control
Evidence:
- `client/src/components/layout/Sidebar.tsx:85`
- `client/src/components/layout/Sidebar.tsx:90`

What is happening:
- Icon tooltip says “Open project settings.”
- Click handler only stops propagation; no settings panel opens.

Why this matters:
- This is misleading UI.
- It makes users think the app is broken.

Fix recommendation:
- Either wire the button to open settings, or remove it in collapsed mode.

---

### 5) `P2` Workspace frame/nav behavior has almost no direct test coverage
Evidence:
- `client/src/components/layout/__tests__/Sidebar.test.tsx` (only focused sidebar tests exist)
- Search over `client/src/**/__tests__/**` found no `ProjectWorkspace` route/frame tests.

What is happening:
- We have useful `Sidebar` unit tests.
- We do not have direct tests for workspace layout/nav integration (tabs, mobile nav, chat/sidebar collapse, breadcrumb, command palette navigation).

Why this matters:
- Regressions in core navigation can ship unnoticed.

Fix recommendation:
- Add `ProjectWorkspace` integration tests for:
  - desktop tabs and mobile bottom-nav routing
  - sidebar/chat collapse + expand behavior
  - progressive-disclosure gating from every entry point
  - import button success + failure UI feedback

---

### 6) `P3` Resize handles are mouse-only (weak keyboard accessibility)
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:73`
- `client/src/pages/ProjectWorkspace.tsx:77`
- `client/src/pages/ProjectWorkspace.tsx:99`

What is happening:
- Resize uses mouse events only.
- No keyboard resize action, no touch alternative.

Why this matters:
- Harder for keyboard-only users.
- Accessibility quality is weaker than the rest of the frame.

Fix recommendation:
- Add keyboard shortcuts for panel resizing.
- Add explicit accessible resize controls (buttons/sliders) for non-pointer users.

---

### 7) `P3` Workspace panel layout preferences do not persist
Evidence:
- `client/src/pages/ProjectWorkspace.tsx:247`
- `client/src/pages/ProjectWorkspace.tsx:252`
- `client/src/pages/ProjectWorkspace.tsx:253`

What is happening:
- Sidebar/chat widths + collapsed states reset to defaults on reload.

Why this matters:
- Users need to re-adjust layout each session.

Fix recommendation:
- Persist layout state in localStorage keyed by project ID.
- Restore safely with min/max clamping.

## Test Coverage Assessment (this section)

Strong coverage:
- `Sidebar` unit tests cover key collapsed/expanded interactions.

Gaps:
- No direct `ProjectWorkspace` integration tests.
- No tests for tab strip + breadcrumb + command palette consistency.
- No tests for import button behavior in workspace header.

Execution notes:
- Attempted targeted run:  
  `npx vitest run client/src/components/layout/__tests__/Sidebar.test.tsx --project client`
- In this environment, vitest startup hangs/times out (observed timeout exit code `124` using `timeout 60s` wrapper).
- Findings here are based on code + existing test inspection.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Build a single navigation contract
- Create one `getAllowedViews(projectState)` helper.
- Reuse it in tabs, sidebar, breadcrumb, command palette, and mobile nav.

### B) Add a safer import UX
- Show pre-import summary (detected format, node/edge counts).
- Let user confirm “Apply to current project” vs “Create new project.”

### C) Add panel layout presets
- Quick options like `Focus Design`, `Focus AI`, `Balanced`.
- Good for different task modes without manual resize every time.

### D) Add “why locked” hints for hidden views
- If view is blocked until design content exists, show short helper text/action.

## Suggested Fix Order (practical)
1. Fix import no-op and import error feedback (`P1/P2`).
2. Unify view gating across all navigation entry points (`P2`).
3. Fix dead collapsed settings button (`P2`).
4. Add `ProjectWorkspace` integration test coverage (`P2`).
5. Add accessibility + preference persistence improvements (`P3`).

## Bottom Line
The workspace shell is feature-rich, but navigation behavior is not fully consistent across all entry points, and the import button currently has a high-risk trust gap. Fixing those first will materially improve reliability and user confidence.
