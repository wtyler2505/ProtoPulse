---
description: Capture comprehensive visual documentation of web apps - all viewports, states, routes, themes with checkpoint/resume
allowed-tools: Read, Write, Glob, Bash, TodoWrite, mcp__chrome-devtools__*, mcp__desktop-commander__*
argument-hint: "[url] [--quick|--full|--continue|--dark-only|--light-only]"
---
# UI Screenshot Cataloger
**Input**: $ARGUMENTS

## Methodology
Based on visual regression testing best practices: treating screenshots as **living documentation** and **visual specifications** - not just test artifacts. Each capture represents "how it should look" for design review and historical reference.

## Arguments
| Argument | Action |
|----------|--------|
| (empty) | Auto-detect dev server (3000, 3001, 5173...) |
| `http://...` | Use specified URL |
| `--quick` | 3 viewports only, skip states |
| `--full` | 9 viewports, all states, both themes |
| `--continue` | Resume from checkpoint |
| `--dark-only` | Capture only dark mode variants |
| `--light-only` | Capture only light mode variants |

## Quick Mode vs Full Mode
| Feature | Quick | Standard | Full |
|---------|-------|----------|------|
| Viewports | 3 | 6 | 9 |
| Page captures |  | Interactive states |  |
| Theme variants |  | Component isolation |  |
| Duration | ~5min | ~20min | ~45min |

## 7-Phase Protocol

### Phase 1: Pre-Flight
- Verify chrome-devtools MCP available
- Detect project root
- Probe dev server ports (3000 3001 5173 5174 8080 4200)
- Create output directory structure
- Check for resume checkpoint

### Phase 2: Research
```bash
# Stack analysis
Read package.json for framework, router, UI library

# Route discovery via ast-grep
ast-grep --pattern 'path="$PATH"' src/ --lang tsx
ast-grep --pattern '<Link to="$PATH"' src/ --lang tsx
ast-grep --pattern 'navigate("$PATH")' src/ --lang tsx

# Component inventory
ast-grep --pattern '<Dialog' src/ --lang tsx
ast-grep --pattern '<Modal' src/ --lang tsx
ast-grep --pattern '<form' src/ --lang tsx

# Theme detection
Read tailwind.config.* for dark mode config
```

### Phase 3: Browser Discovery
1. Navigate to BASE_URL
2. Extract all internal links from DOM
3. Deduplicate by route pattern (/user/:id)
4. Merge with code-discovered routes
5. Build capture queue (max 100 routes)

### Phase 4: Systematic Capture
For EACH route:
1. Navigate with load detection
2. For EACH viewport:
   - Resize page
   - Capture viewport screenshot
   - Capture fullPage screenshot
3. Extract new links (continuous discovery)
4. Update checkpoint every 5 routes

**Viewport Breakpoints:**
| Name | Dimensions |
|------|------------|
| Desktop XL | 1920 1080 |
| Desktop L | 1440 900 |
| Desktop M | 1366 768 |
| Tablet Landscape | 1024 768 |
| Tablet Portrait | 768 1024 |
| Mobile L | 430 932 |
| Mobile M | 393 852 |
| Mobile S | 375 667 |
| Mobile XS | 320 568 |

### Phase 5: Interactive States
- Modals/Dialogs - click trigger, capture open state
- Dropdowns - capture expanded
- Hover states - hover on buttons, cards, links
- Forms - empty, filled, validation error
- Loading states - throttle network, capture spinners
- Error states - 404 page, network error
- Empty states - views with no data

### Phase 6: Theme Variants
- Detect toggle method (Tailwind class, data-theme, context)
- Switch to dark mode   recapture primary routes
- Switch to light mode   recapture primary routes
- Reset to default theme

### Phase 7: Manifest Generation
# UI Screenshot Catalog
| Category | Count |
|----------|-------|
| Pages | X |
| Components | X |
| States | X |
| Themes | X |
| **Total** | **X** |

Coverage: X%
Duration: Xm Xs

## Output Structure
`docs/screenshots/`
- `01-app-shell/`
- `02-navigation/`
- `03-pages/`
- `04-components/`
- `05-modals-dialogs/`
- `06-forms/`
- `07-interactive-states/`
- `08-loading-states/`
- `09-error-states/`
- `10-empty-states/`
- `11-dark-mode/`
- `12-light-mode/`
- `.screenshot-progress.json`
- `MANIFEST.md`

## Naming Convention
**Pattern:** `{NUM}_{description}_{state}_{viewport}.png`
- `001_dashboard-overview_default_1920x1080.png`
- `002_dashboard-overview_default_768x1024.png`
- `015_settings-modal_open_1920x1080.png`
- `042_submit-button_hover_1920x1080.png`

## Checkpoint/Resume
Progress saved to `.screenshot-progress.json` after:
- Each phase completion
- Every 5 routes captured
Resume with `--continue` to pick up where you left off.

## Chrome DevTools Quick Reference
# MANDATORY: Always snapshot first
mcp__chrome-devtools__take_snapshot

# Capture
mcp__chrome-devtools__take_screenshot fullPage=true filePath="..."
mcp__chrome-devtools__take_screenshot uid="element-uid" filePath="..."

# Viewport
mcp__chrome-devtools__resize_page width=1920 height=1080

# Navigation
mcp__chrome-devtools__navigate_page url="..." timeout=60000

# Interaction
mcp__chrome-devtools__click uid="..."
mcp__chrome-devtools__hover uid="..."
mcp__chrome-devtools__press_key key="Escape"

# Script execution
mcp__chrome-devtools__evaluate_script function="() => ..."

## Error Handling
| Error | Recovery |
|-------|----------|
| Page timeout | Retry with 90s timeout |
| Element not found | Re-snapshot, search again |
| Modal stuck | Press Escape, navigate away |
| Screenshot fails | Retry once, then skip |
| MCP connection lost | FATAL - restart Claude |

**Rule:** Never halt entire process for single failure.

## Best Practices (from Visual Regression Testing)
1. **Stories as catalog** - Each state is a documented specification
2. **Consistent naming** - Reads like documentation
3. **Group by domain** - Browsable as feature catalog
4. **Baseline discipline** - Update only when signed off
5. **Coverage focus** - Design system, high-traffic flows, complex layouts
6. **Determinism** - Disable animations, stabilize dynamic content

## Sources
- BrowserStack Visual Testing Guide (2024)
- Chromatic/Percy visual regression patterns
