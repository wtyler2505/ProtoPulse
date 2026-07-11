# Page/View Skills Audit Report
**Generated:** 2025-12-13  
**Auditor:** skill-builder invoked by Eve  
**Total Skills Audited:** 20

---

## Executive Summary

| Rating | Count | Skills |
|--------|-------|--------|
| 🟢 EXCELLENT | 6 | telemetry-view, wiring-diagram-view, task-board-view, model-viewer-view, mission-timeline-view, motor-control-view |
| 🟡 GOOD | 8 | ai-chat-view, camera-view, dashboard-view, design-assistant-view, documentation-view, rover-3d-view, settings-view, ui-components-view |
| 🟠 NEEDS WORK | 4 | diagnostics-view, map-view, navigation-map-view, parts-creator-view |
| 🔴 POOR | 2 | system-diagnostics-view, interactive-tour |

**Critical Issues Found:**
1. Inconsistent YAML frontmatter formats across skills
2. Several skills missing `auto-trigger-paths` field
3. 2 skills using non-gerund naming (violates convention)
4. Missing `version` field in most skills
5. Duplicate skills (map-view vs navigation-map-view)

---

## YAML Frontmatter Analysis

### Format Consistency Issues

| Skill | name | description | version | triggers | auto-trigger-paths |
|-------|------|-------------|---------|----------|-------------------|
| ai-chat-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| camera-view | ✅ | ✅ | ✅ 1.0.0 | ✅ array | ✅ |
| dashboard-view | ✅ | ✅ | ❌ | ❌ in desc | ✅ |
| design-assistant-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| diagnostics-view | ✅ | ✅ | ✅ 1.0.0 | ✅ array | ✅ |
| documentation-view | ✅ | ✅ | ❌ | ❌ in desc | ❌ |
| interactive-tour | ✅ | ✅ multiline | ❌ | ✅ array | ❌ |
| map-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| mission-timeline-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| model-viewer-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| motor-control-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| navigation-map-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| parts-creator-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| rover-3d-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| settings-view | ✅ | ✅ | ✅ 1.0.0 | ❌ in desc | ✅ |
| system-diagnostics-view | ✅ | ✅ | ❌ | ❌ in desc | ❌ |
| task-board-view | ✅ | ✅ multiline | ❌ | ✅ array | ❌ |
| telemetry-view | ✅ | ✅ multiline | ✅ 1.0.0 | ❌ in desc | ✅ |
| ui-components-view | ✅ | ✅ | ❌ | ✅ array | ❌ |
| wiring-diagram-view | ✅ | ✅ multiline | ✅ 1.0.0 | ❌ in desc | ✅ |

### Issues Identified:

1. **Mixed trigger formats:** Some use `triggers:` array (5), others embed in description (15)
2. **Missing version:** 8 skills missing version field
3. **Missing auto-trigger-paths:** 5 skills missing (documentation, interactive-tour, system-diagnostics, task-board, ui-components)
4. **Multiline descriptions:** 5 skills use `|` or `>` - acceptable but inconsistent

---

## Naming Convention Analysis

All skills use `-view` suffix convention. **All are compliant with gerund convention... wait—**

### ⚠️ NAMING VIOLATION FOUND:

| Skill | Issue | Recommendation |
|-------|-------|----------------|
| `interactive-tour` | NOT a view, not gerund form | Rename to `onboarding-tour-view` or `guiding-users-through-tour` |

The skill-builder standard requires **gerund form (verb + -ing)**:
- ✅ `processing-pdfs`, `analyzing-data`  
- ❌ `interactive-tour` (adjective + noun)

---

## Trigger Keyword Analysis

### Best Trigger Coverage (EXCELLENT):

**telemetry-view:**
```
"telemetry", "chart", "sparkline", "heatmap", "playback", "annotation", "threshold",
"time series", "Chart.js", "correlation", "attitude glyph", "data export"
```
*12 distinct triggers covering all use cases*

**wiring-diagram-view:**
```
"wiring", "circuit", "schematic", "ReactFlow", "pin", "wire", "connection",
"component node", "fault", "signal flow", "editor", "ELK layout"
```
*12 triggers with library-specific keywords*

### Weak Trigger Coverage (NEEDS IMPROVEMENT):

**documentation-view:**
```
"documentation", "docs", "markdown viewer", "split pane"
```
*Only 4 triggers, missing: "readme", "help", "guide", "reference"*

**system-diagnostics-view:**
```
(No explicit triggers field - embedded in description only)
"diagnostics", "system logs", "thermal", "oscilloscope"
```
*Inconsistent format, limited scope*

---

## Duplicate/Overlapping Skills

### 🔴 CRITICAL: map-view vs navigation-map-view

| Aspect | map-view | navigation-map-view |
|--------|----------|---------------------|
| Lines | 237 | 333 |
| Focus | GPS tracking, waypoints | Navigation, Leaflet |
| Triggers | map, leaflet, gps | navigation, map, leaflet |
| auto-trigger-paths | Different files | Different files |

**RECOMMENDATION:** Merge these into single `map-navigation-view` skill or clearly differentiate responsibilities.

### Potential Overlap: diagnostics-view vs system-diagnostics-view

Both cover diagnostics but different CCN noted:
- diagnostics-view: General logs, performance
- system-diagnostics-view: GraphNodeComponent 151 CCN, specialized

**Keep separate** but update descriptions to clarify scope difference.

---

## Per-Skill Detailed Analysis

### 🟢 EXCELLENT Skills

#### telemetry-view
- **YAML:** ✅ Perfect multiline description with version
- **Triggers:** ✅ 12 keywords, excellent coverage
- **auto-trigger-paths:** ✅ 20 paths covering all files
- **Content:** ✅ Comprehensive with CCN warnings (215 CCN main component)
- **Opinion:** Gold standard skill structure

#### wiring-diagram-view  
- **YAML:** ✅ Clean multiline with version
- **Triggers:** ✅ 12 specific keywords
- **auto-trigger-paths:** ✅ All wiring files covered
- **Content:** ✅ Excellent architecture diagrams, copy-paste snippets
- **Opinion:** Best documented skill, could be template

#### task-board-view
- **YAML:** ✅ Multiline description
- **Triggers:** ✅ Array format with 8 keywords
- **auto-trigger-paths:** ❌ Missing
- **Content:** ✅ Great DnD-kit patterns, CCN warnings
- **Opinion:** Add auto-trigger-paths, otherwise excellent

#### model-viewer-view
- **YAML:** ✅ Version included
- **Triggers:** ✅ Embedded but comprehensive
- **auto-trigger-paths:** ✅ Well-defined
- **Content:** ✅ Three.js patterns, loader examples
- **Opinion:** Solid skill, good examples

#### mission-timeline-view
- **YAML:** ✅ Complete
- **Triggers:** ✅ Good coverage
- **auto-trigger-paths:** ✅ Present
- **Content:** ✅ Gantt implementation details
- **Opinion:** Well-structured

#### motor-control-view
- **YAML:** ✅ Complete with version
- **Triggers:** ✅ Hardware-specific keywords
- **auto-trigger-paths:** ✅ Present
- **Content:** ✅ Hardware safety patterns included
- **Opinion:** Good embedded safety context

---

### 🟡 GOOD Skills

#### ai-chat-view
- **Gap:** Triggers embedded in description, not array
- **Recommendation:** Extract triggers to array for consistency

#### camera-view
- **Gap:** Could use more keywords ("video", "streaming", "frame")
- **Recommendation:** Expand trigger list

#### dashboard-view
- **Gap:** Missing version, triggers embedded
- **Recommendation:** Add version, normalize format

#### design-assistant-view
- **Gap:** Triggers embedded
- **Recommendation:** Extract to array

#### documentation-view
- **Gap:** Missing version and auto-trigger-paths
- **Recommendation:** Add both, expand triggers

#### rover-3d-view
- **Gap:** Good content but triggers embedded
- **Recommendation:** Extract triggers

#### settings-view
- **Gap:** Could use more tab-specific triggers
- **Recommendation:** Add AI, controls, network tab keywords

#### ui-components-view
- **Gap:** Missing auto-trigger-paths despite 34 components
- **Recommendation:** Add paths for all component files

---

### 🟠 NEEDS WORK

#### diagnostics-view
- **Issues:** 
  - Description could be more invocation-focused
  - Missing "logging", "monitoring", "alerts" triggers
- **Recommendation:** Rewrite description, expand triggers

#### map-view
- **Issues:**
  - Overlaps with navigation-map-view
  - Shorter than navigation variant
- **Recommendation:** Merge or clearly differentiate

#### navigation-map-view
- **Issues:**
  - Overlaps with map-view
  - Confusing which to use when
- **Recommendation:** Merge or clearly differentiate

#### parts-creator-view
- **Issues:**
  - Called "MOST COMPLEX" but skill doesn't emphasize this enough
  - Missing CAD/parametric-specific triggers
- **Recommendation:** Add "CAD", "STL", "parametric", "3D printing" triggers

---

### 🔴 POOR

#### system-diagnostics-view
- **Issues:**
  - Missing version
  - Missing auto-trigger-paths
  - Very similar name to diagnostics-view (confusing)
  - Description doesn't differentiate from diagnostics-view
- **Recommendation:** 
  - Rename to `advanced-diagnostics-view` or merge with diagnostics-view
  - Add missing fields

#### interactive-tour
- **Issues:**
  - Name violates gerund convention
  - Missing auto-trigger-paths
  - Missing version
  - Not really a "view" - it's an overlay system
- **Recommendation:**
  - Rename to `onboarding-tour-system` or `guiding-dashboard-tour`
  - Add auto-trigger-paths
  - Add version
  - Consider if it should be separate skill type (not `-view`)

---

## Complexity Hotspots by Skill

| Skill | Worst CCN | Component |
|-------|-----------|-----------|
| wiring-diagram-view | **358** | index.tsx (MOST COMPLEX IN PROJECT) |
| telemetry-view | **215** | TelemetryView main function |
| task-board-view | **145** | TaskDependencyGraph.tsx |
| ui-components-view | **103** | TUICPUMonitor.tsx |
| dashboard-view | **524** | Total dashboard complexity |
| parts-creator-view | High | Noted as MOST COMPLEX feature |

**All skills properly document their complexity hotspots.** ✅

---

## Recommendations Summary

### Immediate Actions (P0):

1. **Merge or differentiate:** map-view vs navigation-map-view
2. **Rename:** interactive-tour → onboarding-tour-system (or similar gerund)
3. **Add missing auto-trigger-paths:** 5 skills need this
4. **Add missing version:** 8 skills need `version: 1.0.0`

### Short-term Improvements (P1):

5. **Standardize trigger format:** Pick one approach (array vs embedded) and apply consistently
6. **Update system-diagnostics-view:** Differentiate from diagnostics-view or merge
7. **Expand weak trigger lists:** documentation-view, camera-view, parts-creator-view

### Long-term Enhancements (P2):

8. **Add screenshots to all skills:** Some missing visual references
9. **Create skill template:** Based on telemetry-view or wiring-diagram-view structure
10. **Automated validation:** Script to check YAML compliance

---

## Recommended Standard Format

Based on best examples (telemetry-view, wiring-diagram-view):

```yaml
---
name: feature-name-view
description: |
  Use when working on [Feature], [sub-features], [related functionality].
  Triggers: "keyword1", "keyword2", "keyword3", "keyword4"
version: 1.0.0
auto-trigger-paths:
  - components/FeatureName.tsx
  - components/FeatureName/**
  - hooks/useFeature*.ts
  - contexts/FeatureContext.tsx
---

# Feature Name View Context

## Quick Reference
- **Primary Component:** path/to/main.tsx
- **Keyboard Shortcut:** Key

## Code Statistics (via scc)
| Metric | Value |
|--------|-------|
| Files | X |
| Total Lines | Y |
| Total Complexity | Z |

## Complexity Warnings (via lizard)
[Table of high CCN files]

## File Map
[Directory tree]

## Architecture
[ASCII diagram]

## Patterns & Conventions
[Key code patterns]

## Code Snippets (Copy-Paste Ready)
[Working examples]

## Decision History
[Why choices were made]

## Gotchas & Warnings
[Common pitfalls]

## Last Synced
- **Date:** YYYY-MM-DD
- **Verified by:** CLI tools
```

---

## Audit Complete

**20 skills audited. 4 need immediate attention, 8 need minor fixes, 6 are excellent reference implementations.**
