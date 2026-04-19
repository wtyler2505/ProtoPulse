---
description: 'ProtoPulse convention: every modal overlay that blocks the page (component property editor, delete confirm...'
type: claim
created: 2026-04-19
topics:
- a11y
- architecture-decisions
- maker-ux
- ux-patterns
related_components:
- client/src/components/ui/dialog.tsx
- client/src/components/ui/popover.tsx
---
# ProtoPulse uses Dialog for modal and Popover for anchored overlays

The choice between Dialog and Popover is not stylistic — it's a behavioral contract. Dialog says "the rest of the page is blocked until you dismiss me." Popover says "I'm floating near my trigger, click anywhere else to dismiss me." Mixing these gets teams into the `modal={false}` escape hatch, which is almost always the wrong fix.

**The decision matrix:**

| Property | Dialog | Popover |
|----------|--------|---------|
| Focus trap | Yes (FocusScope trapped) | No (focus freely leaves) |
| Pointer events outside | Blocked by overlay | Pass through |
| Dim/dark backdrop | Yes (Dialog.Overlay) | No |
| Dismissal | Escape, X button, pointer-outside | Escape, pointer-outside, focus-outside |
| Screen reader role | `role="dialog"` + `aria-modal="true"` | `role="dialog"` with `aria-modal="false"` (or no role) |
| Positioning | Centered or grid-placed | Anchored to trigger with floating-ui |
| Use when | Decision must be made before continuing | Supplementary info/action that doesn't block |

**ProtoPulse-specific mapping:**

| UI element | Use | Why |
|------------|-----|-----|
| Component property editor | Dialog | User is editing; outside clicks should not commit and lose edits |
| Delete / destructive confirm | Dialog | Must not be dismissed by accident |
| Import / export wizard | Dialog | Multi-step; outside click shouldn't lose progress |
| Tool tooltip (wire, place, probe) | Popover | Just shows help text; click-through should work |
| BOM row quick-editor | Popover | User wants to edit one field and move on |
| Coach inline tips | Popover | Read, dismiss, continue |
| Part picker (in canvas) | Popover | User may drag-drop while it's open; trapping breaks that |
| Context menu on canvas | Popover (specifically ContextMenu primitive) | Same reasoning as quick-editor |

**The test that forces the right choice:** ask "if the user clicks outside this overlay, should the outside click also do its normal thing?"

- YES, outside click should still work → Popover.
- NO, outside click should be absorbed by the overlay → Dialog.

If you find yourself wanting a Dialog with `modal={false}` or a Popover with manual focus trapping, you've picked wrong. Switch primitive.

**The `modal={false}` anti-pattern:** Radix Dialog accepts `modal={false}` to disable the overlay and trap. This is meant for extremely rare cases (e.g., Sheet-like side panels that allow background interaction). Reaching for it to make a Dialog "feel less heavy" is wrong — you're losing focus trap, losing backdrop, losing aria-modal, and keeping only the centered positioning. What you actually want is a Popover, or (if you need positioning flexibility) a custom floating-ui layer.

**Historical note:** before this convention was written down, ProtoPulse had three separate "floating layer" implementations (one for tool tooltips, one for the Coach, one for component inspectors) with inconsistent dismissal behavior. E2E-074 and E2E-1017 both traced to ambiguity about which primitive should have been used. The convention settled on Radix's Dialog/Popover split because both are battle-tested, both inherit the focus-management behavior documented in [[radix-dialog-focus-trap-and-escape-hierarchy]], and the decision is crisp.

---

Source: [[2026-04-19-keyboard-nav-radix-dialog-focus-trap]]

Relevant Notes:
- [[radix-dialog-focus-trap-and-escape-hierarchy]] — the behavioral contract that makes Dialog "modal" concrete
- [[popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision]] — composition gotcha specific to Popover
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] — why you can't "fix" nested dialog problems by making the inner one non-modal
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — the canvas is deliberately NOT a modal; it follows the Popover mental model for interactions

Topics:
- [[a11y]]
- [[architecture-decisions]]
- [[maker-ux]]
- [[ux-patterns]]
