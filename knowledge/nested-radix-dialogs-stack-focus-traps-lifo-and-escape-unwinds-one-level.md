---
description: "Radix FocusScope instances stack LIFO when dialogs nest — the innermost scope has exclusive event handling, Escape closes only the top dialog, and app-level Escape shortcuts must check event.defaultPrevented or register at document level to avoid closing everything at once."
type: claim
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[architecture-decisions]]"
  - "[[ux-patterns]]"
related_components:
  - "client/src/components/ui/dialog.tsx"
---

# Nested Radix dialogs stack focus traps LIFO and Escape unwinds one level

Multiple Radix `FocusScope` instances can coexist at runtime. Each scope maintains a stack pointer, and only the topmost (most recently mounted) scope is "active": it receives Tab cycling, Escape handling, and pointer-down-outside events. Lower scopes are paused — their traps are still logically in place, but they don't react until the scope above them unmounts.

**The stacking contract:**

1. Dialog A opens. Scope A is the top; focus trapped inside A's Content.
2. Dialog B opens (triggered from inside A). Scope B pushes onto the stack, becomes top. Focus trap transfers to B. Scope A is still mounted but paused.
3. Tab / Shift+Tab loops within B only. Elements inside A but outside B are unreachable from the keyboard.
4. Escape fires B's `onEscapeKeyDown` exclusively. A does not see the event — Radix stops propagation at the scope boundary.
5. B closes. Scope B unmounts, fires `onCloseAutoFocus` — returns focus to the element inside A that had focus when B mounted (typically B's trigger button).
6. Scope A resumes as top. Focus now trapped inside A again.
7. Second Escape fires A's `onEscapeKeyDown`. A closes.

**The implication for app-level shortcuts:** a global Escape handler (Command Palette close, toast dismissal, sidebar collapse) registered with `useEffect` + `window.addEventListener('keydown')` will fire on EVERY Escape because Radix's propagation stop happens at the React tree scope, not at the `document` level for non-focus events. A single Escape press inside Dialog B will:

- Close Dialog B (Radix's scope handler)
- Also fire the window-level handler (no scope stopped it)
- So the global Command Palette handler runs, potentially closing that too — and Dialog A is still open underneath, orphaned

**Two ways to fix it, pick one:**

```tsx
// Option 1: guard on event.defaultPrevented
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (e.defaultPrevented) return; // Radix called preventDefault
    closeCommandPalette();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);

// Option 2: register at document-capture-phase and check for open dialogs
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    closeCommandPalette();
  };
  document.addEventListener('keydown', handler, true); // capture phase
  return () => document.removeEventListener('keydown', handler, true);
}, []);
```

Option 1 is cleaner but relies on Radix calling `preventDefault` on the Escape event — verify by checking `@radix-ui/react-dialog`'s implementation for the current version before relying on it. Option 2 is defensive: it short-circuits whenever any Radix dialog is open, regardless of implementation details. ProtoPulse uses Option 2 because it also handles non-Radix modal overlays (our custom drawer, the TaurusCanvas modal-mode).

**Anti-pattern: disabling the nested dialog's trap.** Teams sometimes reach for `modal={false}` on the inner dialog to "avoid double-trapping". This does NOT solve the stacking problem — it creates a worse one, where clicks outside the inner dialog are forwarded to the outer dialog's still-inert backdrop, bypassing the outer trap entirely. Nested modal-modal is a valid and supported pattern; nested modal-non-modal is a UX smell that suggests the inner thing should have been a Popover.

**Test coverage for nested dialogs:**

```ts
test('nested dialogs unwind Escape one level at a time', async ({ page }) => {
  await openDialogA(page);
  await openDialogBFromA(page);

  // First Escape closes B, not A
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dialog-b')).not.toBeVisible();
  await expect(page.getByTestId('dialog-a')).toBeVisible();

  // Focus returned to B's trigger inside A
  await expect(page.getByTestId('dialog-b-trigger')).toBeFocused();

  // Second Escape closes A
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dialog-a')).not.toBeVisible();
});
```

---

Source: [[2026-04-19-keyboard-nav-radix-dialog-focus-trap]]

Relevant Notes:
- [[radix-dialog-focus-trap-and-escape-hierarchy]] — the single-dialog lifecycle this extends
- [[oncloseautofocus-must-fallback-when-trigger-is-unmounted]] — stacking makes unmount-during-dialog more common (outer close may re-render inner trigger)
- [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]] — when tempted to reach for `modal={false}`, the right fix is usually swapping the inner dialog for a popover

Topics:
- [[a11y]]
- [[architecture-decisions]]
- [[ux-patterns]]
