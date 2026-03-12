# FE-05 Audit: Shared UI System

Date: 2026-03-06  
Auditor: Codex  
Section: FE-05 (from master map)  
Method: Code + test-surface inspection only (no vitest runtime per user direction).

## Scope Reviewed
- Full file sweep: `client/src/components/ui/*.tsx` (all UI components/wrappers in this directory).
- Style system file: `client/src/index.css`.
- Deep-read hotspots (higher complexity or cross-cutting behavior):
  - `client/src/components/ui/command-palette.tsx`
  - `client/src/components/ui/TutorialOverlay.tsx`
  - `client/src/components/ui/EmbedDialog.tsx`
  - `client/src/components/ui/sidebar.tsx`
  - `client/src/components/ui/DatasheetLink.tsx`
  - `client/src/components/ui/PredictionCard.tsx`
  - `client/src/components/ui/PredictionPanel.tsx`
  - `client/src/components/ui/field.tsx`
  - `client/src/components/ui/form.tsx`
  - `client/src/components/ui/item.tsx`
  - `client/src/components/ui/command.tsx`
  - `client/src/components/ui/dialog.tsx`
  - `client/src/components/ui/empty.tsx`
- Test surface reviewed:
  - `client/src/components/ui/__tests__/datasheet-link.test.tsx`
  - `client/src/components/ui/__tests__/PredictionCard.test.tsx`

## Severity Key
- `P0`: security/data-loss now
- `P1`: high user-impact break risk
- `P2`: medium reliability/UX risk
- `P3`: low risk, cleanup/quality

## Findings

### 1) `P1` Tutorial tooltip can render off-screen on left/right placements
Evidence:
- `client/src/components/ui/TutorialOverlay.tsx:17`
- `client/src/components/ui/TutorialOverlay.tsx:97`
- `client/src/components/ui/TutorialOverlay.tsx:99`
- `client/src/components/ui/TutorialOverlay.tsx:102`
- `client/src/components/ui/TutorialOverlay.tsx:247`

What is happening:
- Tooltip width is fixed to `360px`.
- `left`/`right` placement branches do not clamp position to viewport bounds.

Why this matters:
- On smaller viewports, the tutorial card can move partly off-screen.
- If next/finish controls are off-screen, onboarding can become blocked.

Fix recommendation:
- Add viewport clamping for `left` and `right` paths (same style as `top`/`bottom`).
- Use responsive width (`min(360px, calc(100vw - 16px))`).
- Add tests for narrow viewport placement cases.

---

### 2) `P1` Datasheet URL is passed directly to `href` without protocol allowlist
Evidence:
- `client/src/components/ui/DatasheetLink.tsx:19`
- `client/src/components/ui/DatasheetLink.tsx:22`
- `client/src/components/ui/__tests__/datasheet-link.test.tsx:23`

What is happening:
- Any truthy `datasheetUrl` is placed directly into `<a href=...>`.
- Current tests validate direct passthrough but do not test blocking unsafe protocols.

Why this matters:
- If this component is wired to untrusted metadata, `javascript:`/`data:` link payloads can be introduced.
- This repeats an already-known hardening class in project UI link surfaces.

Fix recommendation:
- Add URL protocol validation (`http:`/`https:` only).
- Render fallback text instead of link for invalid protocols.
- Add tests for blocked protocols.

---

### 3) `P1` Global keyboard listeners are unscoped and can fire while typing
Evidence:
- `client/src/components/ui/command-palette.tsx:57`
- `client/src/components/ui/command-palette.tsx:63`
- `client/src/components/ui/sidebar.tsx:98`
- `client/src/components/ui/sidebar.tsx:108`
- `client/src/components/ui/TutorialOverlay.tsx:178`
- `client/src/components/ui/TutorialOverlay.tsx:212`

What is happening:
- `Ctrl/Cmd+K` (palette), `Ctrl/Cmd+B` (sidebar), and tutorial arrow/enter handlers bind at `window`.
- Handlers do not guard against active text inputs/contenteditable targets.

Why this matters:
- Shortcut actions can trigger during typing/editing flows and interrupt user work.
- Tutorial key capture can steal arrow/enter behavior unexpectedly.

Fix recommendation:
- Add target guards (`input`, `textarea`, `select`, `[contenteditable=true]`) before handling.
- Prefer scoped handlers tied to focused app shells where possible.
- Add keyboard behavior tests for “typing in input should not trigger global shortcut”.

---

### 4) `P2` Two custom modal implementations bypass shared dialog accessibility primitives
Evidence:
- `client/src/components/ui/command-palette.tsx:117`
- `client/src/components/ui/command-palette.tsx:128`
- `client/src/components/ui/EmbedDialog.tsx:172`
- `client/src/components/ui/EmbedDialog.tsx:186`
- `client/src/components/ui/command.tsx:26`
- `client/src/components/ui/dialog.tsx:7`
- `client/src/components/ui/dialog.tsx:30`

What is happening:
- `command-palette` and `EmbedDialog` implement custom overlays/containers directly.
- Shared dialog primitives already exist (`CommandDialog`, `Dialog`) with built-in accessibility behavior.

Why this matters:
- Focus trap/restore, escape semantics, and modal consistency become fragmented.
- More custom modal logic means more regressions over time.

Fix recommendation:
- Rebuild both on top of shared `Dialog`/`CommandDialog` wrappers.
- Keep custom visual styling, but centralize modal behavior in one primitive path.

---

### 5) `P2` Many UI buttons omit explicit `type="button"`
Evidence:
- `client/src/components/ui/EmbedDialog.tsx:204`
- `client/src/components/ui/EmbedDialog.tsx:221`
- `client/src/components/ui/EmbedDialog.tsx:252`
- `client/src/components/ui/EmbedDialog.tsx:283`
- `client/src/components/ui/EmbedDialog.tsx:299`
- `client/src/components/ui/PredictionCard.tsx:147`
- `client/src/components/ui/PredictionCard.tsx:173`
- `client/src/components/ui/PredictionCard.tsx:194`
- `client/src/components/ui/PredictionPanel.tsx:54`
- `client/src/components/ui/PredictionPanel.tsx:91`
- `client/src/components/ui/sidebar.tsx:287`

What is happening:
- Several shared UI buttons rely on default button type.

Why this matters:
- Default type is `submit`, which can cause accidental form submission if reused inside forms.
- This creates hidden integration bugs that are hard to debug later.

Fix recommendation:
- Add `type="button"` to non-submit buttons in shared UI components.
- Add lint rule or codemod check for `<button>` without explicit `type`.

---

### 6) `P2` Sidebar state persistence is write-only (cookie is never read)
Evidence:
- `client/src/components/ui/sidebar.tsx:28`
- `client/src/components/ui/sidebar.tsx:86`

What is happening:
- Code writes `sidebar_state` cookie on toggle.
- No corresponding read path exists in this component/system to initialize from cookie.

Why this matters:
- The component comments imply persistence, but behavior is not actually restored.
- Users can see state “forgetfulness” across reloads.

Fix recommendation:
- Read cookie on provider init and seed initial `open` state.
- Keep `defaultOpen` as fallback only when cookie is absent/invalid.

---

### 7) `P2` Embed encoding failure path is mostly silent to the user
Evidence:
- `client/src/components/ui/EmbedDialog.tsx:69`
- `client/src/components/ui/EmbedDialog.tsx:75`
- `client/src/components/ui/EmbedDialog.tsx:76`

What is happening:
- On encode failure, code only ends loading state.
- No user-facing error state is set for failed encode.

Why this matters:
- User can end up with empty/invalid output with no clear reason.
- Creates support friction and trust issues during share/embed flow.

Fix recommendation:
- Add explicit encode error state and visible recovery message.
- Consider retry action and telemetry hook for encode failures.

---

### 8) `P3` UI library contains orphan components not wired into product flows
Evidence:
- `client/src/components/ui/EmbedDialog.tsx:12`
- `client/src/components/ui/EmbedDialog.tsx:38`
- `client/src/components/ui/__tests__/PredictionCard.test.tsx:21`
- `client/src/components/ui/__tests__/PredictionCard.test.tsx:22`
- `client/src/components/ui/__tests__/datasheet-link.test.tsx:10`

What is happening:
- `EmbedDialog` has no non-test imports in `client/src`.
- `PredictionCard`, `PredictionPanel`, and `DatasheetLink` are referenced by tests but not by current product surfaces.

Why this matters:
- Dead/parked components increase maintenance and test noise.
- Tests can pass while real product paths remain unchanged.

Fix recommendation:
- Decide per component: integrate, move to experimental area, or remove.
- Tag parked components clearly to avoid false assumptions of production coverage.

---

### 9) `P3` Semantic mismatch in `EmptyDescription` component
Evidence:
- `client/src/components/ui/empty.tsx:71`
- `client/src/components/ui/empty.tsx:73`

What is happening:
- Component is typed as `React.ComponentProps<"p">` but renders a `<div>`.

Why this matters:
- Semantic drift can hurt accessibility consistency and confuse consumers.
- Type signature implies paragraph semantics that are not actually rendered.

Fix recommendation:
- Render `<p>` or change prop typing to `<div>` intentionally.
- Add simple UI semantic test for this primitive.

## Test Coverage Assessment (this section)

What exists:
- `client/src/components/ui/__tests__/datasheet-link.test.tsx`
- `client/src/components/ui/__tests__/PredictionCard.test.tsx`

Key gaps:
- No tests found for high-risk shared UI pieces:
  - `command-palette.tsx`
  - `TutorialOverlay.tsx`
  - `EmbedDialog.tsx`
  - `sidebar.tsx`
  - `keyboard-shortcuts-modal.tsx`
  - `theme-toggle.tsx`
  - `index.css` behavior contracts (focus ring/high-contrast hooks)
- No keyboard-safety tests around global listeners and typing contexts.
- No tests for modal focus management in custom modal implementations.
- No tests for tooltip viewport clamping in tutorial overlay.

Execution notes:
- Per user direction, this pass is inspection-only and does not run vitest.

## Improvements / Enhancements / Additions (beyond bug fixes)

### A) Standardize all modal surfaces on one primitive layer
- Migrate custom dialog-like UIs to shared `Dialog`/`CommandDialog`.
- This centralizes accessibility and keyboard behavior.

### B) Add a shared keyboard-guard helper
- One utility for “ignore shortcut if target is editable”.
- Reuse across palette/sidebar/tutorial and future global shortcuts.

### C) Add a shared `safeExternalUrl` helper for UI links
- Keep protocol rules in one place.
- Reuse for datasheet, markdown links, and action-generated links.

### D) Add a lightweight “shared-ui contract tests” suite
- Focus on:
  - Modal focus/escape behavior
  - Global shortcut safety while typing
  - Unsafe URL blocking
  - Tutorial tooltip viewport clamping

## Suggested Fix Order (practical)
1. Fix tutorial tooltip viewport clamping (`P1`).
2. Add URL protocol allowlist to datasheet links (`P1`).
3. Add editable-target guards to all global shortcut listeners (`P1`).
4. Add explicit `type="button"` on shared UI buttons (`P2`).
5. Add visible encode-failure UX in embed dialog (`P2`).
6. Implement sidebar cookie read path (`P2`).
7. Clean up or integrate orphan components (`P3`).
8. Add FE-05 contract tests for shared UI behavior (`P2`/`P3`).

## Bottom Line
FE-05 has a strong base of reusable UI primitives, but cross-cutting behavior is uneven where custom modal and global-keyboard logic bypasses shared safety patterns. The top risk theme here is consistency: the design system exists, but several high-impact interactions do not consistently use it.
