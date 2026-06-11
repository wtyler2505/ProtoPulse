# Phase 3: UX & Workflow Evaluation -- rest-express

> Generated: 2026-05-17
> Personas evaluated: Hobbyist maker, Professional electrical engineer, Hardware startup founder

## Accessibility Scorecard

| Metric | Count | Assessment |
|--------|-------|------------|
| aria-* attributes | 653 | Good coverage of ARIA attributes across 177 files. |
| role= attributes | 147 | Solid semantic role definitions in 95 files. |
| tabIndex usage | 35 | Limited explicit focus management (24 files), indicating reliance on native focusable elements. |
| alt= on images | 10 | Extremely low image accessibility (only 7 files have alt text). Major gap. |
| Keyboard shortcut handlers | 1756 | Extensive keyboard shortcut support across 343 files, very strong for power users. |
| Loading/skeleton states | 450 | Strong loading state management across 96 files. |
| Error toast/notification patterns | 156 | Decent error visibility and toast notifications across 38 files. |
| **Overall grade** | | B |

## Persona 1: Hobbyist maker

### Workflow: Onboarding
1. **Lands on AuthPage** -> Clean login/register interface.
2. **Directed to ProjectPickerPage** -> Simple view to choose or create their first EDA project.
3. **Creates a new project** -> Starts with BreadboardQuickIntake or a blank canvas.
*Friction*: Might be overwhelming if templates are missing; limited discoverability of what to do first.

### Workflow: Core Daily Loop
1. **Opens project** -> Drops components onto the circuit editor.
2. **Wires components** -> Drags nets between pins.
3. **Saves & Tests** -> Relies on quick visual feedback and error notifications.
*Friction*: Alt text on images/components is missing, making icon-only UI hard to discover or use if icons are ambiguous.

### Workflow: Advanced Usage
1. **Keyboard shortcuts** -> Relies heavily on the 1700+ shortcuts for fast placement and routing.
2. **Component search** -> Uses UnifiedComponentSearch for specific parts.

### Workflow: Error Recovery
When a short circuit or wrong placement happens, they rely on toast notifications. 
*Friction*: If error message is overly technical, the hobbyist may struggle to recover.

### Key Friction Points
| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Lack of `alt` attributes on component icons | High | ProjectPicker/Editor | Makes onboarding harder for users learning the UI visually. |
| Technical error toasts | Medium | Global | Hobbyists might abandon tasks if errors aren't actionable. |

## Persona 2: Professional electrical engineer

### Workflow: Onboarding
1. **Logs in** -> Looks for import options (KiCad/Eagle).
2. **Navigates to ProjectPickerPage** -> Expects hierarchical project organization.

### Workflow: Core Daily Loop
1. **Schematic & Layout** -> Relies on intense keyboard shortcuts (useHotkeys).
2. **Worst Case Analysis** -> Uses `WorstCaseAnalysisPanel`.
3. **Component Management** -> Interacts with detailed parameters.
*Friction*: Needs dense information display; any excessive loading states (450 matches) that block workflow will frustrate them.

### Workflow: Advanced Usage
1. **Hierarchical Sheets** -> Uses `HierarchicalSheetPanel`.
2. **Keyboard intensive routing** -> High reliance on shortcuts to rapidly connect nets.

### Workflow: Error Recovery
Expects precise, actionable errors (e.g., specific pin mismatch, DRC violations).
*Friction*: The 1500+ error message instances need to be specific to DRC and schematic validation.

### Key Friction Points
| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Focus management gaps (low tabIndex) | Medium | Core Editor | Pro users use keyboard-only navigation; missing tabIndex breaks flow. |
| Complex interactions lack ARIA context | Low | Editor Canvas | Screen-reader and advanced keyboard accessibility might suffer. |

## Persona 3: Hardware startup founder

### Workflow: Onboarding
1. **Team setup** -> Looks for collaboration features and project sharing in ProjectPicker.
2. **Settings** -> Navigates to SettingsPage for organization settings.

### Workflow: Core Daily Loop
1. **Reviewing designs** -> Switching between projects and reviewing team members' boards.
2. **Checking DRC/WCA** -> Verifying the board is ready for manufacturing.

### Workflow: Advanced Usage
1. **Exporting** -> Preparing BOMs and Gerbers.
2. **Multi-project tracking** -> Archiving and restoring projects via `archive-project-id` buttons.

### Workflow: Error Recovery
When team sync fails, they rely on notifications. Need clear state on whether data is saved.

### Key Friction Points
| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Unclear loading boundaries | Medium | ProjectPickerPage | Startup users moving fast might click elements before state is fully loaded. |

## Cross-Persona Issues

- **Missing Image Accessibility (`alt` text)**: With only 10 occurrences of `alt=`, image and icon accessibility is extremely poor. This affects all users relying on screen readers and can also impact general usability when icons fail to load or are ambiguous.
- **Keyboard Tab Flow**: While keyboard shortcuts are abundant (1756 matches), basic `tabIndex` usage (35 matches) suggests the application may not have a fully optimized logical tab flow for non-shortcut keyboard navigation.

## Quick Wins

| Improvement | Effort | Impact | Files to Change |
|-------------|--------|--------|-----------------|
| Add descriptive `alt` tags to all UI icons/images | S | High | Global UI components |
| Implement logical `tabIndex` in ProjectPicker and Editor | S | Medium | `ProjectPickerPage.tsx`, `HierarchicalSheetPanel.tsx` |
| Standardize error toasts to include actionable recovery steps | M | Medium | Notification handlers |

## Information Architecture Assessment

The application has a flat, straightforward primary navigation structure based on top-level pages: `AuthPage`, `ProjectPickerPage`, `EmbedViewerPage`, and `SettingsPage`. The core complexity is nested within the circuit editor views (`HierarchicalSheetPanel`, `WorstCaseAnalysisPanel`, `BreadboardQuickIntake`). Discoverability of these deep editor panels likely relies heavily on keyboard shortcuts and contextual menus rather than a deep traditional routing structure.