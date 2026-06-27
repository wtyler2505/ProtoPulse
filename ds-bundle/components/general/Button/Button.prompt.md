Button from rest-express. Use via `window.ProtoPulse.Button` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<TooltipProvider>` (full provider chain in README.md — components read theme/i18n from that context).

Shadcn Button wrapper.

IMPORTANT — default `type="button"` (audit #61 fix, 2026-04-17):
HTML's `<button>` defaults to `type="submit"` when rendered inside a
`<form>` — this silently submits the form on Enter or Space. React 19
does NOT fix that default. Consumers almost never want submit behavior
from shadcn Buttons (they're used for menus, dialogs, toolbars, etc.),
and the 4 legitimate submit callsites (AuthPage.tsx, BreadboardQuickIntake,
WorstCaseAnalysisPanel, ExactPartDraftModal) all set `type="submit"`
explicitly. Defaulting to `"button"` here eliminates 500+ accidental
submission vectors across the app with zero regressions.

When `asChild` is true, the Slot primitive renders whatever child
element is given — the type default is harmless because Slot's child
(often an `<a>`) ignores the `type` prop.

Consumers that need a submit button MUST pass `type="submit"` explicitly.

## Related

`ButtonGroup`
