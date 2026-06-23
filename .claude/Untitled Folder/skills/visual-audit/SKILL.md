---
name: visual-audit
description: Run a systematic visual UI audit across all ProtoPulse views using Chrome DevTools MCP. Use after UI changes to any view/panel/component, before releases, or when Tyler asks for a UI audit, visual audit, or accessibility (a11y) sweep. Produces a prioritized VA-XXX findings checklist in docs/audits/.
---

# /visual-audit

Run a systematic visual UI audit of all ProtoPulse views. Captures snapshots, runs accessibility/UX assertions, and generates a prioritized findings checklist.

## Prerequisites

- Dev server running on port 5000 (if not, tell the user to run `/devserver` first)
- Chrome DevTools MCP connected (check with `list_pages`)

## Views to Audit — derive the live list, never hardcode it

The set of views changes as the app grows. Do NOT rely on a static list. At the start of every audit, derive the current view inventory from the source of truth:

```bash
# 1. The ViewMode union — the complete list of views (36 as of 2026-06-11):
rg -o "export type ViewMode = .*" client/src/lib/project-context.tsx

# 2. The view -> component mapping (which component each ViewMode renders):
rg -n "activeView === '" client/src/pages/workspace/ViewRenderer.tsx

# 3. Where each component actually lives on disk:
rg -n "import\('@/" client/src/pages/workspace/lazy-imports.ts
```

Audit EVERY ViewMode in the union. Also audit these non-ViewMode surfaces:

- **Sidebar** — component tree, library browser, history, project settings (`client/src/components/layout/Sidebar.tsx`)
- **Chat Panel** — AI chat, settings panel, quick actions (`client/src/components/panels/ChatPanel.tsx`)

Resolution gotchas (verify against lazy-imports.ts, don't assume):
- The `output` view renders **ExportPanel** (`client/src/components/panels/ExportPanel.tsx`) — export options and manufacturing files. `components/views/OutputView.tsx` is dead code.
- `breadboard` and `pcb` render from `client/src/components/circuit-editor/`, NOT `components/views/`.

## Procedure

### Step 1: Verify Environment

```
1. curl -s http://localhost:5000 > /dev/null — confirm dev server is up
2. list_pages via Chrome DevTools MCP — confirm browser connection
3. navigate_page to http://localhost:5000
4. Wait 3 seconds for React hydration
```

### Step 2: Audit Each View

For EACH view in the derived list, perform these checks. Navigate to the view tab first (take_snapshot, find the tab element, click it).

#### A. Snapshot & Screenshot (per view)
1. `take_snapshot` — capture DOM accessibility tree
2. `take_screenshot` — capture visual state
3. Save screenshot with descriptive name: `docs/audit-screenshots/{view}-{timestamp}.png`

#### B. Contrast & Readability (per view)
Run via `evaluate_script`:
```javascript
// Check text contrast against WCAG AA (4.5:1 for normal, 3:1 for large text)
// Check for text smaller than 12px
// Check for low-opacity text (opacity < 0.5 on non-decorative elements)
```
Flag any element with insufficient contrast, tiny text, or near-invisible opacity.

#### C. Touch Targets (per view)
```javascript
// All interactive elements (buttons, links, inputs) must be >= 32x32px
// Preferred: >= 44x44px (WCAG AAA)
document.querySelectorAll('button, a, input, [role="button"], [tabindex]')
  .forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 32 || rect.height < 32) flag(el);
  });
```

#### D. Focus Rings (per view)
```javascript
// Tab through interactive elements, verify visible focus indicator
// Check for outline: none without replacement focus style
```

#### E. Overflow & Layout (per view)
```javascript
// Check for horizontal overflow (scrollWidth > clientWidth)
// Check for content clipped by overflow: hidden
// Check for elements extending beyond viewport
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > el.clientWidth + 1) flag(el, 'horizontal-overflow');
  if (el.scrollHeight > el.clientHeight + 1) flag(el, 'vertical-overflow');
});
```

#### F. UI Container Rule (per view) — project-mandated, see CLAUDE.md §UI Container Rule
Every panel, box, drawer, modal, inspector, sidebar, floating gate, and window must be reachable by default. Violations are **defects, not polish** — file them at P1 minimum.

Check each container surface in the view:
```javascript
// 1. Clipped controls: interactive elements partially/fully outside their
//    container's visible box (compare getBoundingClientRect() against the
//    nearest scroll container's rect; flag overflow:hidden ancestors).
// 2. Missing scroll: container whose content can overflow
//    (scrollHeight > clientHeight) but computed overflow-y is 'hidden' or
//    'visible' with no scrollable ancestor inside the panel.
// 3. Hidden bottom buttons: buttons/footers below the fold of a
//    fixed-height panel with no way to scroll to them.
```
Manual checks per container:
- Resizable when users may need more or less working space (look for a resize handle or panel-resize affordance)
- Collapsible when the surface can block the main canvas/workspace
- Open every modal/drawer/inspector reachable from the view and repeat the three script checks inside it

#### G. Dark Theme Consistency (per view)
```javascript
// Check for hardcoded light colors (white backgrounds, light grays) that break dark theme
// Look for: background: #fff, background: white, color: #000
// Check shadcn/ui CSS variable usage (should use --background, --foreground, etc.)
```

#### H. Empty States & Loading (per view)
- Verify empty states show meaningful messages (not blank areas)
- Check loading spinners/skeletons exist for async data
- Verify error boundaries display user-friendly messages

#### I. Responsive Behavior (per view)
Use `resize_page` to test at:
- 1920x1080 (desktop)
- 1366x768 (laptop)
- 1024x768 (tablet landscape)

Check for layout breaks, overlap, or disappearing elements.

### Step 3: Generate Findings Checklist

Create `docs/audits/YYYY-MM-DD-visual-audit.md` (today's date — this is where all audits land) with this structure:

```markdown
# Visual Audit Checklist — ProtoPulse
> Generated: {date}
> Audited views: {count}/{total derived from ViewMode union}

## Summary
- Total issues: {n}
- P0 (Critical): {n} — Broken functionality, data loss risk
- P1 (High): {n} — Accessibility violations, unusable UI, UI Container Rule violations
- P2 (Medium): {n} — UX degradation, inconsistencies
- P3 (Low): {n} — Polish, minor visual issues

## P0 — Critical
- [ ] **VA-001** [{view}] {description} `{file}:{line}`

## P1 — High
...

## P2 — Medium
...

## P3 — Low
...

## Screenshots
| View | Screenshot | Issues |
|------|-----------|--------|
| Architecture | [link] | VA-001, VA-005 |
...
```

### Step 4: Summary Report

Print a summary to the user:
- Total issues found per priority
- Views with most issues
- Top 3 most impactful fixes
- Estimated effort (quick wins vs. larger efforts)

## Error Handling

- If Chrome DevTools MCP is not connected: stop and tell user to connect Chrome
- If dev server is down: stop and tell user to run `/devserver`
- If a view fails to load: note it in the checklist as a P0 issue and continue
- If screenshot capture fails: continue audit without screenshots, note the failure

## Important Notes

- ALWAYS `take_snapshot` before ANY click or interaction
- Use Chrome DevTools MCP for snapshots/assertions, Claude-in-Chrome for interactions
- Do NOT skip views — audit every ViewMode in the derived list even if some look fine
- Each issue ID uses prefix `VA-` followed by sequential 3-digit number
- Follow-up: fix findings with `/fix-audit-failures`, then mark them done with `/checklist-update`
