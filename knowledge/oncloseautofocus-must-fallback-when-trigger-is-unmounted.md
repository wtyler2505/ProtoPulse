---
description: Radix's default onCloseAutoFocus returns focus to the element that was focused before the dialog opened...
type: claim
created: 2026-04-19
topics:
- a11y
- gotchas
- maker-ux
related_components:
- client/src/components/ui/dialog.tsx
---
# onCloseAutoFocus must fallback when trigger is unmounted

Radix's `FocusScope` captures `document.activeElement` at mount and restores it at unmount. This works perfectly when the trigger stays in the DOM for the dialog's entire lifetime — which is most cases. It fails silently in three situations that all occur in ProtoPulse:

1. **Destructive confirm dialogs.** User clicks "Delete component" on a row, confirms in the dialog, row is removed from the list. The trigger button inside that row is gone. `onCloseAutoFocus` tries to `.focus()` an element no longer attached to the DOM. Browsers silently bail — focus ends up on `document.body`. Keyboard user hits Tab and lands somewhere far away from the list they were working in.

2. **Route-changing dialogs.** User opens a dialog that contains a link; clicking the link navigates away. The trigger's tree was unmounted by the router before the dialog closed.

3. **List-reordering dialogs.** User edits an item via dialog; on save, the parent re-sorts the list and the trigger moves (new React key, new DOM node). The old DOM node is detached.

**The fix is always the same shape:**

```tsx
<Dialog.Content
  onCloseAutoFocus={(event) => {
    event.preventDefault();
    // Try the trigger first — in the 99% case it's still there
    if (triggerRef.current?.isConnected) {
      triggerRef.current.focus();
      return;
    }
    // Fall back in order: sibling → parent landmark → app toolbar
    const fallback =
      siblingRef.current?.isConnected ? siblingRef.current :
      listLandmarkRef.current?.isConnected ? listLandmarkRef.current :
      document.querySelector<HTMLElement>('[data-app-toolbar]');
    fallback?.focus();
  }}
>
```

**The fallback hierarchy matters.** A good fallback reflects the user's mental model: after deleting row 7, focus row 8 (or row 6 if 7 was last). After closing a route-changing dialog, focus the new route's main landmark. After a reorder, re-find the item by ID and focus it. A bad fallback — like just focusing `document.body` or the page title — restarts the user's navigation from scratch.

**The `isConnected` check is load-bearing.** Calling `.focus()` on a detached element is a silent no-op in all modern browsers (it does not throw). Without `isConnected`, the code looks correct but fails invisibly. Always guard the primary target and every fallback.

**This is a destructive-action pattern, not a dialog pattern.** Any component that removes its own trigger from the DOM needs a focus-return strategy: context menus that delete the row they were spawned from, confirm dialogs for destructive actions, dropdowns whose parent re-renders on selection. The Radix `onCloseAutoFocus` is the Dialog-flavored instance of a more general problem.

**Test coverage template:**

```ts
test('destructive dialog returns focus to sibling row', async ({ page }) => {
  // Arrange: list with 5 rows, each with a delete button
  const rows = page.getByRole('listitem');
  await expect(rows).toHaveCount(5);

  // Act: open delete dialog on row 3, confirm
  await rows.nth(2).getByRole('button', { name: /delete/i }).click();
  await page.getByRole('button', { name: /confirm/i }).click();

  // Assert: row 3 gone, focus on new row 3 (was row 4)
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(2)).toBeFocused();
});
```

---

Source: [[2026-04-19-keyboard-nav-radix-dialog-focus-trap]]

Relevant Notes:
- [[radix-dialog-focus-trap-and-escape-hierarchy]] — the full lifecycle this note addresses the edge case of
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — without visible focus indicators, bad focus return is undetectable by sighted keyboard users
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — canvas focus restoration uses the same "is the target still in the DOM?" guard pattern

Topics:
- [[a11y]]
- [[gotchas]]
- [[maker-ux]]
