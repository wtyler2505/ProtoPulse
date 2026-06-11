# Phase 3 Checklist -- UX Issues (UI-)

> Priority: P0 (critical) -> P3 (nice-to-have)
> Effort: S (hours) / M (days) / L (weeks) / XL (months)

- [ ] UI-01: Audit and add descriptive `alt` attributes to all images and icon buttons to improve accessibility. | Effort: S | Priority: P1
- [ ] UI-02: Review and implement explicit `tabIndex` flows in the core editor panels (e.g., HierarchicalSheetPanel) to support keyboard-only navigation that doesn't rely on hotkeys. | Effort: M | Priority: P2
- [ ] UI-03: Ensure all error toasts generated in `catch` blocks provide actionable user recovery steps rather than raw technical traces. | Effort: M | Priority: P2
- [ ] UI-04: Add empty states/onboarding templates to `ProjectPickerPage` for users with no existing projects. | Effort: S | Priority: P2
- [ ] UI-05: Standardize loading skeletons across `ProjectPickerPage` and core editor views to prevent layout shift during data fetching. | Effort: M | Priority: P3