---
description: When wrapping a Popover in a Tooltip, the Tooltip.Trigger asChild must be the OUTER layer with Popover.Trigger asChild nested inside...
type: claim
created: 2026-04-19
topics:
- a11y
- architecture-decisions
- gotchas
- ux-patterns
related_components:
- client/src/components/ui/popover.tsx
- client/src/components/ui/tooltip.tsx
---
# PopoverTrigger asChild requires Tooltip outside to avoid Slot forwarding collision

Radix primitives that accept `asChild` use `@radix-ui/react-slot` to merge their own props (refs, `onClick`, `aria-*`, `data-state`) onto a single child element. `Slot` is designed to merge ONE parent's props onto ONE child. When two Radix primitives both try to `asChild` the same element at different nesting depths, the inner Slot wins for ref forwarding and one primitive's state management silently stops working.

**The pattern that works (per Radix's official composition guide):**

```tsx
<Popover.Root>
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <Popover.Trigger asChild>
        <MyButton>Trigger</MyButton>
      </Popover.Trigger>
    </Tooltip.Trigger>
    <Tooltip.Portal>…</Tooltip.Portal>
  </Tooltip.Root>
  <Popover.Portal>…</Popover.Portal>
</Popover.Root>
```

**The pattern that breaks (and hit E2E-074):**

```tsx
// WRONG — Popover outside, Tooltip inside
<Popover.Root>
  <Popover.Trigger asChild>
    <StyledTooltip content="Open coach">
      <MyButton>Trigger</MyButton>
    </StyledTooltip>
  </Popover.Trigger>
</Popover.Root>
```

The reason: `Popover.Trigger asChild` wraps `StyledTooltip` in a Slot. `StyledTooltip` internally renders `<Tooltip.Trigger asChild><MyButton /></Tooltip.Trigger>`. Now BOTH Popover.Trigger and Tooltip.Trigger want to forward to `MyButton` via separate Slot instances — but Popover.Trigger's Slot only sees `StyledTooltip` as its child, not `MyButton`. Popover's click handler lands on `StyledTooltip`'s root element, which may not even render as the outermost DOM node once Tooltip's portal is factored in. Result: clicking the button opens the tooltip but not the popover, or vice versa, depending on React 18's event ordering.

**Why "outer is composition parent" is the invariant:** The outer `asChild` wraps the inner `asChild` wraps the actual DOM element. Slot is associative in this direction only — A(B(C)) composes cleanly when A's Slot sees B (another Slot), which sees C (the real element). It does NOT compose when A's Slot sees a component (not a Slot) that internally has a Slot.

**Diagnostic signal:** if a Popover/Dialog trigger stops opening when wrapped in a custom tooltip component, and the button visually still receives hover states correctly, the tooltip is the outer layer. Invert the nesting.

**The style-composition escape hatch:** if the tooltip wrapper needs to apply className/styles (e.g., `StyledTooltip` adds a wrapper div for theming), DO NOT use `asChild` on it. Use the explicit structure from Radix's composition docs — the tooltip layer that provides styling is a normal wrapping component, not an `asChild`-forwarding component. Move styling concerns to a non-Slot wrapper OUTSIDE both triggers, or merge the className onto the button via `cn()` at call site.

**Testing strategy:** E2E-074-class bugs don't show up in jsdom unit tests because Slot's ref forwarding works in isolation. They show up in Playwright because real DOM event dispatch follows the actual element tree. Tests for every composed-trigger pattern must use Playwright-level click assertions: click the element, assert the popover appears, then hover and assert the tooltip appears. Both must work on the same element.

---

Source: [[2026-04-19-keyboard-nav-radix-dialog-focus-trap]]

Relevant Notes:
- [[radix-dialog-focus-trap-and-escape-hierarchy]] — primary pattern; this note is the composition gotcha that breaks focus management when violated
- [[shadcn-ui-components-use-radix-slot-under-the-hood]] — wrapper components in `components/ui/*` almost all `asChild`-forward, inheriting this constraint
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] — related composition problem (stacking) as opposed to flattening

Topics:
- [[a11y]]
- [[architecture-decisions]]
- [[gotchas]]
- [[ux-patterns]]
