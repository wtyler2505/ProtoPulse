---
name: deep-focus
description: Ultra-comprehensive focus mode for deep work on specific pages, features, or components. Uses ALL available tools - 17 CLI tools, Chrome DevTools MCP for exhaustive UI screenshots, MCP servers, and skills. This skill should be used when user wants to focus on, analyze, audit, or deeply work on any specific area of the codebase. Triggers on "focus on", "deep dive", "audit", "analyze component", "work on [area]", or any request to concentrate on a specific page/feature/component.
version: 1.1.0
allowed-tools: Bash(fd:*), Bash(tree:*), Bash(scc:*), Bash(tokei:*), Bash(lizard:*), Bash(madge:*), Bash(depcheck:*), Bash(ast-grep:*), Bash(git:*), Bash(npx:*), Bash(npm:*), Bash(prettier:*), mcp__chrome-devtools__list_pages, mcp__chrome-devtools__select_page, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__wait_for, mcp__chrome-devtools__resize_page, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__hover, mcp__chrome-devtools__click, mcp__chrome-devtools__press_key, mcp__chrome-devtools__list_console_messages, mcp__chrome-devtools__list_network_requests, mcp__chrome-devtools__performance_start_trace, mcp__chrome-devtools__performance_analyze_insight, mcp__memory__create_entities, mcp__context7__resolve-library-id, mcp__context7__get-library-docs, mcp__perplexity__search, mcp__clear-thought__sequentialthinking, TodoWrite, Read
---

# Deep Focus Mode

**Ultra-comprehensive focus session using EVERY available tool.**

## When NOT to Use

Do NOT use this skill when:
- **Quick fix or single file** → Overkill for small changes
- **No UI component** → Backend-only work doesn't need visual forensics
- **Time-sensitive hotfix** → Full audit takes significant time
- **Research-only task** → Use `cli-research-mastery` instead

**Always use when:** Deep audit, comprehensive analysis, or systematic improvement of a feature/component.

This skill transforms you into a forensic analyst with complete visibility into code, visuals, dependencies, complexity, git history, and more.

---

## PHASE 0: Area Resolution

Map `$ARGUMENTS` to component tree using Area Registry:

| Shortcut | Primary Files | Related |
|----------|---------------|---------|
| `dashboard` | `Dashboard.tsx`, `DashboardGridLayout.tsx` | `components/dashboard/*`, `widgets/*` |
| `motor` | `MotorControlPanel.tsx` | `hooks/useMotorControl.ts`, `contexts/SafetyContext.tsx` |
| `telemetry` | `TelemetryView.tsx` | `components/telemetry/*`, `hooks/useMetricHistory.ts` |
| `ai`, `eve`, `chat` | `AIChat.tsx` | `services/geminiService.ts`, `evePersonalityTemplates.ts` |
| `3d`, `model`, `rover` | `Rover3DView.tsx`, `ModelViewer.tsx` | `hooks/useWebGLContext.ts` |
| `map`, `navigation` | `MapView/*` | `contexts/LocationContext.tsx` |
| `camera`, `video` | `CameraViewer.tsx` | `hooks/useCameraStream.ts` |
| `wiring`, `diagram` | `WiringDiagram/*` | - |
| `diagnostics`, `diag` | `UnifiedDiagnostics/*` | `contexts/DiagnosticContext.tsx` |
| `settings`, `config` | `Settings.tsx` | `contexts/SettingsContext.tsx` |
| `tasks`, `taskboard` | `TaskBoard/*` | `SortableTaskCard.tsx` |
| `sidebar`, `nav` | `Sidebar/*` | `CollapsibleSection.tsx`, `NavItem.tsx` |
| `docs`, `documentation` | `DocumentationView.tsx` | `documentationManifest.ts` |
| `websocket`, `ws` | `contexts/WebSocketContext.tsx` | `services/websocketService.ts` |
| `parts`, `creator` | `PartsCreator/*` | `services/modelSynth/*` |
| `ui`, `common` | `components/ui/*`, `components/common/*` | All shared components |

**If no match:** Ask user to clarify before proceeding.

---

## PHASE 1: Code Intelligence Gathering

### 1.1 File Discovery & Structure

```bash
# Find all related files
fd -e tsx -e ts -e css "[FocusArea]" --type f

# Show structure with tree
tree -I 'node_modules|dist|.git' components/[FocusArea]/ -L 3

# Count lines and complexity
scc components/[FocusArea]/ --by-file
tokei components/[FocusArea]/
```

### 1.2 Code Complexity Analysis

```bash
# Cyclomatic complexity with lizard
lizard components/[FocusArea]/ -l typescript -w

# Find complex functions (CCN > 10)
lizard components/[FocusArea]/ -T nloc=50 -T cyclomatic_complexity=10
```

### 1.3 Dependency Graph

```bash
# Generate dependency graph
madge --image /tmp/focus-deps.svg components/[FocusArea]/

# Find circular dependencies
madge --circular components/[FocusArea]/

# Check for unused deps in package.json
depcheck --ignore-patterns=dist
```

### 1.4 AST-Based Code Search

```bash
# Find all React components
ast-grep --pattern 'const $NAME: React.FC<$_> = ($$$) => { $$$ }' components/[FocusArea]/

# Find useState hooks
ast-grep --pattern 'const [$STATE, $SETTER] = useState($$$)' --lang tsx components/[FocusArea]/

# Find useEffect with dependencies
ast-grep --pattern 'useEffect(() => { $$$ }, [$$$])' --lang tsx components/[FocusArea]/

# Find context usage
ast-grep --pattern 'useContext($CTX)' --lang tsx components/[FocusArea]/
```

### 1.5 Git History Analysis

```bash
# Recent changes to focus area
git log --oneline -20 -- components/[FocusArea]/

# Who contributed most
git shortlog -sn -- components/[FocusArea]/

# File change frequency (hotspots)
git log --format=format: --name-only -- components/[FocusArea]/ | sort | uniq -c | sort -rn | head -20

# Recent diffs
git diff HEAD~5 -- components/[FocusArea]/ | delta
```

### 1.6 Quality Checks

```bash
# TypeScript errors in focus area
npx tsc --noEmit 2>&1 | grep -E "[FocusArea]" || echo "✅ No type errors"

# ESLint issues
npm run lint 2>&1 | grep -E "[FocusArea]" || echo "✅ No lint errors"

# Prettier check
prettier --check "components/[FocusArea]/**/*.{ts,tsx}" 2>&1 || echo "⚠️ Formatting issues found"
```

---

## PHASE 2: Visual UI Forensics (Chrome DevTools MCP)

**CRITICAL: This phase captures EVERY visual element for deep analysis.**

### 2.1 Setup & Navigation

```
1. mcp__chrome-devtools__list_pages → Find or create page with app
2. mcp__chrome-devtools__select_page → Select the app page
3. mcp__chrome-devtools__navigate_page → Navigate to focus area's route
4. mcp__chrome-devtools__wait_for → Wait for content to load
```

### 2.2 Full Page Capture

```
# Resize for complete capture (prevents scroll issues with React)
mcp__chrome-devtools__resize_page width=1920 height=4000

# Take full page screenshot
mcp__chrome-devtools__take_screenshot fullPage=true format="png"

# Take accessibility snapshot for element UIDs
mcp__chrome-devtools__take_snapshot
```

### 2.3 Individual Element Screenshots

**MANDATORY: Screenshot EVERY distinct UI element:**

| Category | Elements to Capture | Why |
|----------|---------------------|-----|
| **Buttons** | Primary, secondary, icon, ghost, disabled states | Verify consistent styling, hover/active states |
| **Inputs** | Text, number, search, textarea, with/without values | Check placeholder, focus, error states |
| **Selects/Dropdowns** | Closed + opened states, with selections | Verify dropdown behavior, option styling |
| **Toggles/Switches** | On/off states | Check visual feedback, animations |
| **Cards/Panels** | Each distinct card type | Layout, shadows, borders, spacing |
| **Headers/Titles** | All heading levels, section headers | Typography hierarchy |
| **Icons** | Each unique icon | Size, color, alignment consistency |
| **Badges/Tags** | Status badges, labels, pills | Color coding, text contrast |
| **Navigation** | Active/inactive states, hover | Visual state indicators |
| **Modals/Dialogs** | Opened state, backdrop | Overlay, focus trap |
| **Tables/Lists** | With data, empty states | Column alignment, row styling |
| **Charts/Graphs** | Data visualization elements | Axes, legends, colors |
| **Loading States** | Skeletons, spinners, progress | Animation, placeholders |
| **Error States** | Error messages, empty states | Color, iconography |
| **Tooltips** | Hovered state | Position, arrow, content |
| **Spacing/Layout** | Container edges, gutters | Padding, margins, alignment |

**Screenshot Protocol:**

```
For EACH element:
1. mcp__chrome-devtools__take_snapshot → Get current UIDs
2. mcp__chrome-devtools__hover uid="[element]" → Trigger hover state
3. mcp__chrome-devtools__take_screenshot uid="[element]" → Capture element
4. Record: element type, UID, visual observations
```

### 2.4 Interactive State Capture

```
# Capture hover states
mcp__chrome-devtools__hover uid="[button-uid]"
mcp__chrome-devtools__take_screenshot uid="[button-uid]"

# Capture focus states
mcp__chrome-devtools__click uid="[input-uid]"
mcp__chrome-devtools__take_screenshot uid="[input-uid]"

# Capture dropdown opened
mcp__chrome-devtools__click uid="[select-uid]"
mcp__chrome-devtools__take_snapshot → Get dropdown options
mcp__chrome-devtools__take_screenshot fullPage=true

# Capture modal opened
mcp__chrome-devtools__click uid="[modal-trigger-uid]"
mcp__chrome-devtools__take_screenshot fullPage=true
mcp__chrome-devtools__press_key key="Escape" → Close modal
```

### 2.5 Responsive Captures

```
# Desktop (1920px)
mcp__chrome-devtools__resize_page width=1920 height=1080
mcp__chrome-devtools__take_screenshot fullPage=true

# Tablet (768px)  
mcp__chrome-devtools__resize_page width=768 height=1024
mcp__chrome-devtools__take_screenshot fullPage=true

# Mobile (375px)
mcp__chrome-devtools__resize_page width=375 height=812
mcp__chrome-devtools__take_screenshot fullPage=true
```

### 2.6 Console & Network Analysis

```
# Check for console errors
mcp__chrome-devtools__list_console_messages types=["error", "warn"]

# Check network failures
mcp__chrome-devtools__list_network_requests resourceTypes=["fetch", "xhr"]
```

### 2.7 Performance Trace

```
# Run performance trace
mcp__chrome-devtools__performance_start_trace reload=true autoStop=true

# Analyze insights
mcp__chrome-devtools__performance_analyze_insight insightSetId="[id]" insightName="LCPBreakdown"
```

---

## PHASE 3: Deep Visual Analysis

For EACH captured screenshot, analyze and document:

### 3.1 Typography Analysis
- Font family, size, weight, line-height
- Text color and contrast ratio
- Heading hierarchy consistency
- Truncation/overflow handling

### 3.2 Color Analysis
- Primary, secondary, accent colors used
- Consistency with design system
- Contrast ratios for accessibility (WCAG AA/AAA)
- Dark mode compatibility (if applicable)

### 3.3 Spacing Analysis
- Padding inside elements
- Margins between elements
- Grid/flexbox gap consistency
- Visual rhythm and whitespace

### 3.4 Component Consistency
- Same element styled differently in different places?
- Inconsistent border-radius, shadows?
- Button sizes consistent?
- Icon sizes consistent?

### 3.5 Interactive States
- Hover feedback visible?
- Focus indicators present and accessible?
- Active/pressed states defined?
- Disabled states clear?

### 3.6 Responsiveness
- Layout adapts correctly at breakpoints?
- Text remains readable?
- Touch targets large enough on mobile (44x44px)?
- No horizontal scroll on mobile?

### 3.7 Accessibility Observations
- Color not sole indicator of state
- Sufficient contrast
- Focus visible
- Alt text present for images
- ARIA attributes correct

---

## PHASE 4: MCP & Skill Integration

### 4.1 Memory MCP - Store Findings

```
mcp__memory__create_entities entities=[{
  "name": "[FocusArea]_audit_[date]",
  "entityType": "UIAudit",
  "observations": ["[key findings]"]
}]
```

### 4.2 Context7 - Framework Documentation

```
# If using specific library, fetch docs
mcp__context7__resolve-library-id libraryName="[library]"
mcp__context7__get-library-docs context7CompatibleLibraryID="[id]" topic="[relevant topic]"
```

### 4.3 Perplexity - Research Best Practices

```
mcp__perplexity-ask__perplexity_ask messages=[{
  "role": "user",
  "content": "Best practices for [specific UI pattern] in React 2024"
}]
```

### 4.4 Clear Thought - Structured Analysis

```
mcp__clear-thought__clear_thought operation="systems_thinking" prompt="[UI/UX problem]"
```

---

## PHASE 5: Comprehensive Report

Generate detailed findings:

```
═══════════════════════════════════════════════════════════════
🎯 DEEP FOCUS REPORT: [Area Name]
═══════════════════════════════════════════════════════════════

📊 CODE METRICS
├─ Files: X
├─ Lines: X (code: X, comments: X, blank: X)
├─ Avg Complexity: X
├─ Max Complexity: X (in [function])
└─ Dependencies: X direct, X transitive

🔧 HEALTH STATUS  
├─ TypeScript: ✅/⚠️/❌ [X errors]
├─ ESLint: ✅/⚠️/❌ [X warnings]
├─ Prettier: ✅/⚠️/❌
├─ Tests: X/Y passing
└─ Circular Deps: ✅/⚠️ [list if any]

🎨 VISUAL AUDIT
├─ Screenshots Captured: X
├─ Console Errors: X
├─ Network Failures: X
└─ Performance Score: X

📸 ELEMENT-BY-ELEMENT FINDINGS
┌────────────────────────────────────────────────────────────┐
│ BUTTONS                                                     │
├─────────────────────────────────────────────────────────────┤
│ • Primary Button: [observations]                            │
│ • Secondary Button: [observations]                          │
│ • Icon Button: [observations]                               │
│ Issues: [list any inconsistencies]                          │
└─────────────────────────────────────────────────────────────┘

[Repeat for each element category]

🚨 CRITICAL ISSUES
1. [Issue with severity and impact]
2. [Issue with severity and impact]

⚡ QUICK WINS
1. [Low effort, high impact fix]
2. [Low effort, high impact fix]

📈 IMPROVEMENT OPPORTUNITIES
1. [Enhancement opportunity]
2. [Enhancement opportunity]

♿ ACCESSIBILITY GAPS
1. [A11y issue]

🎯 RECOMMENDED ACTIONS (Priority Order)
1. [Action]
2. [Action]
3. [Action]
```

---

## PHASE 6: Session Setup

Create TodoWrite items with priorities:

```
Priority 1 (Critical): Blocking issues, security, crashes
Priority 2 (High): Accessibility, major UX issues  
Priority 3 (Medium): Code quality, consistency
Priority 4 (Low): Polish, nice-to-haves
```

---

## PHASE 7: Interactive Menu

```
═══════════════════════════════════════════════════════════════
🎯 DEEP FOCUS: [Area Name] - Analysis Complete
═══════════════════════════════════════════════════════════════

What do you want to tackle?

[1] 🚨 Fix critical issues first
[2] 🎨 Address visual/UI inconsistencies  
[3] ♿ Fix accessibility gaps
[4] ⚡ Performance optimizations
[5] 🧪 Improve test coverage
[6] 📝 Refactor/clean up code
[7] 🔧 Update dependencies
[8] 📸 Re-run visual audit only
[9] 🔄 Full enhancement pass (systematic)
[0] 📋 Show todos and let me direct

Select or describe what you want to work on:
```

---

## CLI Tool Quick Reference

See: `references/cli-tools.md`

## Chrome DevTools Protocol

See: `references/chrome-devtools-protocol.md`

## Related Skills

- `chromedevtools-mastery` - Core browser automation this skill uses
- `systematic-debugging` - Debugging methodology for issues found
- `thorough-verification` - Verify fixes after deep focus session
- `ui-screenshot-cataloger` - Systematic visual documentation

## Changelog

- v1.1.0 (2025-01): Added "When NOT to Use", related skills, changelog
- v1.0.0 (2024-12): Initial deep focus methodology
