---
name: visual-audit
description: Run a comprehensive 107-step visual UI audit across all ProtoPulse views using Chrome DevTools MCP
---

# /visual-audit

Run a systematic visual UI audit of all ProtoPulse views. Captures snapshots, runs accessibility/UX assertions, and generates a prioritized findings checklist.

## Prerequisites

- Dev server running on port 5000 (if not, tell the user to run `/devserver` first)
- Chrome DevTools MCP connected (check with `list_pages`)

## Views to Audit (10)

1. **Architecture** — block diagram canvas (`/` default view)
2. **Schematic** — circuit schematic editor
3. **Breadboard** — breadboard layout
4. **PCB Layout** — PCB board editor
5. **Component Editor** — shape canvas, constraints, DRC rules
6. **Procurement** — BOM table, supplier search
7. **Validation** — DRC results, issue list
8. **Output** — export options, manufacturing files
9. **Sidebar** — component tree, library browser, history, project settings
10. **Chat Panel** — AI chat, settings panel, quick actions

## Procedure

### Step 1: Verify Environment

```
1. curl -s http://localhost:5000 > /dev/null — confirm dev server is up
2. list_pages via Chrome DevTools MCP — confirm browser connection
3. navigate_page to http://localhost:5000
4. Wait 3 seconds for React hydration
```

### Step 2: Audit Each View

For EACH view listed above, perform these checks. Navigate to the view tab first (take_snapshot, find the tab element, click it).

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

#### F. Dark Theme Consistency (per view)
```javascript
// Check for hardcoded light colors (white backgrounds, light grays) that break dark theme
// Look for: background: #fff, background: white, color: #000
// Check shadcn/ui CSS variable usage (should use --background, --foreground, etc.)
```

#### G. Empty States & Loading (per view)
- Verify empty states show meaningful messages (not blank areas)
- Check loading spinners/skeletons exist for async data
- Verify error boundaries display user-friendly messages

#### H. Responsive Behavior (per view)
Use `resize_page` to test at:
- 1920x1080 (desktop)
- 1366x768 (laptop)
- 1024x768 (tablet landscape)

Check for layout breaks, overlap, or disappearing elements.

### Step 3: Generate Findings Checklist

Create `docs/visual-audit-checklist.md` with this structure:

```markdown
# Visual Audit Checklist — ProtoPulse
> Generated: {date}
> Audited views: {count}/10

## Summary
- Total issues: {n}
- P0 (Critical): {n} — Broken functionality, data loss risk
- P1 (High): {n} — Accessibility violations, unusable UI
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
- Do NOT skip views — audit all 10 even if some look fine
- Each issue ID uses prefix `VA-` followed by sequential 3-digit number
