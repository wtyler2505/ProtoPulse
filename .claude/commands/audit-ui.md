---
description: Deep visual UI/UX audit via Chrome DevTools MCP - clicks every button, tests every interaction, captures every state
allowed-tools: Read, Write, Bash, TodoWrite, mcp__chrome-devtools__*, mcp__claude-in-chrome__computer
argument-hint: "[app-url]"
---
# UI/UX Audit - Visual Element Inspector
**Description**: Deep visual audit using the Chrome DevTools MCP (snapshot/click/hover/screenshot). Clicks every button, tests every interaction, captures every state. (`mcp__claude-in-chrome__computer` may be used additionally for human-like interaction, but snapshots, clicks, and hovers are chrome-devtools tools.)

## PREREQUISITES
Ensure app is running and accessible in browser.

## INITIALIZATION
```bash
AUDIT_DIR="audits/$(date +%Y-%m-%d_%H%M)_ui-audit"
mkdir -p "${AUDIT_DIR}/screenshots"
```

## BROWSER SETUP
mcp__chrome-devtools__list_pages
mcp__chrome-devtools__new_page url="$ARGUMENTS"   # or navigate_page on an existing page

## FOR EACH PAGE/VIEW

### 1. Initial Capture
**Snapshot** (accessibility tree):
mcp__chrome-devtools__take_snapshot

Document in AUDIT_LOG.md:
- Total interactive elements
- Missing ARIA labels
- Semantic HTML issues
- Focus order problems

**Screenshot**:
mcp__chrome-devtools__take_screenshot fullPage=true filePath="..."
Save: `screenshots/[page]_initial.png`

### 2. Console & Network Check
mcp__chrome-devtools__list_console_messages
mcp__chrome-devtools__list_network_requests

Document: Errors, warnings, failed requests

### 3. Interactive Element Audit
**CLICK EVERY ELEMENT** systematically:
mcp__chrome-devtools__take_snapshot  # Get fresh UIDs (MANDATORY before any click/hover)
mcp__chrome-devtools__click uid="[element_uid]"
mcp__chrome-devtools__take_screenshot  # Capture result

**For each element type:**
| Element | Test | Expected |
|---------|------|----------|
| Button | Click | Action occurs, no console error |
| Link | Click | Navigation or action |
| Dropdown | Click | Opens menu |
| Input | Type text | Text appears, validation fires |
| Checkbox | Click | Toggles state |
| Radio | Click | Selects option |
| Modal trigger | Click | Modal opens |
| Modal close | Click X / ESC / outside | Modal closes |
| Tab | Click | Tab switches |
| Accordion | Click | Expands/collapses |

### 4. State Testing
Capture and document ALL states:
- **Default** - Initial render
- **Hover** - Mouse over (`mcp__chrome-devtools__hover uid="..."`)
- **Focus** - Tab to element
- **Active** - During click
- **Disabled** - Disabled elements
- **Loading** - During async operations
- **Error** - After invalid input
- **Success** - After valid submission
- **Empty** - No data scenarios

### 5. Responsive Testing
Test at these widths (use resize_page):
mcp__chrome-devtools__resize_page width=320 height=568   # Mobile
mcp__chrome-devtools__resize_page width=768 height=1024  # Tablet
mcp__chrome-devtools__resize_page width=1024 height=768  # Small desktop
mcp__chrome-devtools__resize_page width=1440 height=900  # Large desktop

Screenshot each breakpoint. Document:
- Layout changes
- Hidden/shown elements
- Touch target sizes (min 44x44px)
- Text readability

### 6. Keyboard Navigation
mcp__chrome-devtools__press_key key="Tab"        # Navigate forward
mcp__chrome-devtools__press_key key="Shift+Tab"  # Navigate back
mcp__chrome-devtools__press_key key="Enter"      # Activate
mcp__chrome-devtools__press_key key="Escape"     # Close/cancel
mcp__chrome-devtools__press_key key="Space"      # Toggle

Document:
- Tab order logical?
- Focus visible?
- All interactive elements reachable?
- Escape closes modals?

### 7. Form Testing
For each form:
1. Submit empty   Error states shown?
2. Submit invalid   Validation messages?
3. Submit valid   Success feedback?
4. Reset/clear works?

## CHECKLIST (Copy to AUDIT_LOG.md)
```markdown
## [Page Name] - UI Audit

### Visual Inspection
- [ ] Renders without errors
- [ ] Correct layout/spacing
- [ ] Fonts load correctly
- [ ] Icons display correctly
- [ ] Images load (with fallbacks)
- [ ] Colors consistent with design system
- [ ] Dark/light mode works (if applicable)

### Interactive Elements
- [ ] All buttons clickable
- [ ] All links work
- [ ] All dropdowns open
- [ ] All inputs accept text
- [ ] All checkboxes toggle
- [ ] All modals open/close
- [ ] All tabs switch

### States
- [ ] Loading states visible
- [ ] Error states display
- [ ] Empty states display
- [ ] Success feedback shown

### Accessibility
- [ ] Semantic HTML used
- [ ] ARIA labels present
- [ ] Focus states visible
- [ ] Keyboard navigation works
- [ ] Tab order logical
- [ ] Color contrast sufficient

### Responsive
- [ ] Mobile (320px) works
- [ ] Tablet (768px) works
- [ ] Desktop (1024px) works
- [ ] Large (1440px) works

### Console/Network
- [ ] No console errors
- [ ] No failed network requests
- [ ] No excessive warnings
```

## FINDING FORMAT
```markdown
### Issue #[N]: [Title]
**Severity**: Critical/High/Medium/Low
**Page**: [page name]
**Element**: [element description]
**Screenshot**: screenshots/[filename].png

**Problem**: [Description]
**Expected**: [What should happen]
**Actual**: [What actually happens]
**Fix**: [Suggested fix]
**Status**: Open / FIXED
```

## TARGET $ARGUMENTS
Default: http://localhost:3000 (or whatever dev server is running)
