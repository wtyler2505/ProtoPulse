# UI/UX Audit: Workspace Shell and Navigation

Date: 2026-03-30  
Auditor: Codex  
Method: Live browser inspection + shell code review

## Scope Reviewed
- `client/src/pages/ProjectWorkspace.tsx`
- `client/src/pages/workspace/WorkspaceHeader.tsx`
- `client/src/pages/workspace/MobileNav.tsx`
- `client/src/components/layout/Sidebar.tsx`
- `client/src/components/layout/sidebar/sidebar-constants.ts`
- `client/src/pages/ProjectPickerPage.tsx`
- Runtime routes:
  - project picker
  - project-open flow
  - workspace header/tab shell
  - collapsed sidebar
  - workflow breadcrumb
  - floating checklist

## Findings

### 1) `P1` Project picker can present projects that cannot actually open
Evidence:
- Live route behavior from picker to `/projects/19`
- “Not found” toast on return to picker
- API mismatch observed during audit

Impact:
- First meaningful action in the product breaks trust.

### 2) `P1` New-project shell boot is driven by stale persisted state instead of product intent
Evidence:
- New project initially landed in `serial_monitor` rather than dashboard.
- Sidebar/chat visibility reflected previous workspace state rather than first-run defaults.

Impact:
- First impression feels random and overly advanced.

### 3) `P1` The shell stacks too many navigation systems at once
Evidence:
- Top icon rail
- tab strip
- workflow breadcrumb row
- floating checklist
- collapsed sidebar icons

Impact:
- Orientation cost is high.
- “Where should I click next?” is unclear even when the product offers many answers.

Recommendation:
- Keep one primary navigation layer and one secondary contextual layer, not four.

### 4) `P2` Icon-only top navigation prioritizes density over comprehension
Evidence:
- In the shell, many top actions are exposed as unlabeled icons.
- The tab strip itself is icon-only on desktop, with meaning deferred to tooltip/ARIA labels.

Impact:
- Returning expert users may adapt.
- New users are forced to learn symbols before workflows.

Recommendation:
- Add optional text labels, at least for top-level high-traffic actions.
- Consider “compact” vs “labeled” shell modes.

### 5) `P2` Collapsed sidebar is efficient but harsh
Evidence:
- Collapsed mode turns the left rail into a tall stack of unlabeled icons.
- It works visually, but it is cognitively expensive and easy to misread.

Impact:
- Good for experts, poor for onboarding.

Recommendation:
- Use collapsed sidebar only after user opt-in or after sufficient project familiarity.

### 6) `P2` The floating checklist occludes high-value content in multiple views
Evidence:
- Visible overlap pressure in dashboard, architecture, procurement, validation, exports, community, Arduino

Impact:
- The checklist acts like a sticky ad for the product’s own onboarding.

Recommendation:
- Default it to a minimized footer chip or docked left-rail module.

### 7) `P2` Picker layout is visually stronger than picker state logic
Evidence:
- Good card hierarchy, clean filters, and strong CTA placement in `01-project-picker.png`
- Broken project-open flow undercuts otherwise solid layout work

Impact:
- UX looks polished, behavior does not match.

## What Is Working
- Skip links are present and visible in the accessibility tree.
- Header chrome is visually coherent.
- The workflow breadcrumb is conceptually helpful.
- Project picker hierarchy is easy to scan.

## Priority Recommendations
1. Fix picker/open trust path.
2. Introduce project-scoped shell state.
3. Simplify first-run navigation layers.
4. Reduce icon dependence in the shell.
