---
description: Radix Dialog's focus trap is implemented by FocusScope — it captures focus inside Content on open, cycles Tab/Shift+Tab within the trap...
type: claim
created: 2026-04-19
topics:
- a11y
- maker-ux
- architecture-decisions
- ux-patterns
related_components:
- client/src/components/ui/dialog.tsx
- client/src/components/ui/popover.tsx
---
# Radix Dialog focus trap and Escape hierarchy

Radix `Dialog.Content` wraps its children in a `FocusScope` with `trapped` and `loop` enabled by default. The lifecycle is deterministic and every step is overridable — which is what makes it both the right default and a landmine when teams reach for the override props without understanding the sequence.

**The canonical open sequence:**

1. User activates `Dialog.Trigger` (Enter/Space/click).
2. `Dialog.Root` calls `onOpenChange(true)`.
3. `Dialog.Content` mounts inside `Dialog.Portal` (default container: `document.body`).
4. `FocusScope` fires `onMountAutoFocus`, which Radix exposes as `onOpenAutoFocus` on `Content`.
5. Default target: the first focusable descendant of `Content`. If none exists, focus lands on `Content` itself (which gets `tabIndex={-1}` automatically so it can receive focus).
6. While open, Tab and Shift+Tab loop focus within `Content`; elements outside the scope (including the trigger) are unreachable via keyboard.
7. The overlay marks inert portions of the page with `aria-hidden`; pointer events outside the content are blocked by `Dialog.Overlay`.

**The canonical close sequence:**

1. Escape key fires `onEscapeKeyDown` (cancellable — if `preventDefault()` is called, the dialog stays open).
2. If not cancelled, Radix calls `onOpenChange(false)`.
3. `Content` unmounts.
4. `FocusScope` fires `onUnmountAutoFocus`, exposed as `onCloseAutoFocus` on `Content`.
5. Default target: the element that had focus immediately before the scope mounted — which is almost always the trigger.
6. If that element is no longer in the DOM (common after a destructive action that re-renders the trigger's parent), focus falls back to `document.body` and the user loses their place.

**Same sequence fires for all close causes:** Escape key, pointer-down-outside, `Dialog.Close` button click, or programmatic `onOpenChange(false)`. Because `onCloseAutoFocus` is the SINGLE exit point, overriding it once covers every path — but also means one broken handler breaks every close.

**The three override props and when to reach for each:**

| Prop | Default behavior | When to override |
|------|------------------|------------------|
| `onOpenAutoFocus` | Focus first focusable in content | Dialog has no meaningful first focusable (e.g., only body text + Close button — focus the Close instead of the title's heading) |
| `onCloseAutoFocus` | Return focus to trigger | Trigger was removed (destructive delete flow) — `preventDefault()` and manually focus a sensible fallback (sibling row, parent list, landmark) |
| `onEscapeKeyDown` | Close dialog | Dialog contains a destructive form with unsaved changes — `preventDefault()` and show a "discard?" confirm, then close manually if confirmed |

**Do NOT override `onOpenAutoFocus` to `preventDefault()` without focusing something else yourself.** If you cancel the default and forget to call `.focus()` on a fallback, focus lands on `document.body` and keyboard users are stranded.

**The Escape hierarchy (when overlays nest):**

Radix dialogs stack. Opening Dialog A, then Dialog B inside A, creates two focus scopes. Escape inside B fires B's `onEscapeKeyDown` ONLY — A never sees the event because Radix uses `event.stopPropagation()` at the scope boundary. Close B, and focus returns to the element inside A that opened B (B's trigger). A second Escape then closes A. This is the correct behavior for every modal pattern: Escape unwinds one level at a time, not everything at once.

The consequence: Escape-to-close shortcuts at the app level (e.g., Command Palette) must either be registered as `document`-level keydown handlers or check `event.defaultPrevented` first — otherwise the user pressing Escape inside a dialog will close BOTH the dialog and the palette, losing context.

**Don't fight the trap — channel it.** Teams sometimes reach for `disableOutsidePointerEvents={false}` or `trapped={false}` (FocusScope-level props, not Radix Content props) to "make the dialog non-modal". If a dialog should not be modal, it should not be a Dialog — it should be a Popover. See [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]].

**Playwright test template for the full lifecycle:**

```ts
test('Dialog Escape returns focus to trigger', async ({ page }) => {
  await page.goto('/some-route');
  const trigger = page.getByRole('button', { name: /open dialog/i });
  await trigger.focus();
  await trigger.press('Enter');

  // Dialog opened, first focusable got focus
  const firstInput = page.getByRole('dialog').getByRole('textbox').first();
  await expect(firstInput).toBeFocused();

  // Tab loops within trap
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const stillInside = await page.evaluate(() =>
    document.activeElement?.closest('[role="dialog"]') !== null
  );
  expect(stillInside).toBe(true);

  // Escape closes and returns focus to trigger
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
```

Axe-core's `dialog-name` rule validates that `role="dialog"` has an accessible name, but no axe rule validates focus-trap correctness itself — that coverage belongs to Playwright (focus assertions) and manual NVDA/VoiceOver walkthroughs.

---

Source: [[2026-04-19-keyboard-nav-radix-dialog-focus-trap]]

Relevant Notes:
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — establishes that the canvas is explicitly NOT a focus trap; dialogs are the ONLY modal traps in ProtoPulse
- [[oncloseautofocus-must-fallback-when-trigger-is-unmounted]] — the single most common way Radix focus return breaks in practice
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] — explains the Escape-hierarchy contract when dialogs compose
- [[popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision]] — companion pattern; same slot-forwarding mechanics, different component
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — prerequisite: focus indicators must be visible for the focus-return behavior to be observable

Topics:
- [[a11y]]
- [[maker-ux]]
- [[architecture-decisions]]
- [[ux-patterns]]
