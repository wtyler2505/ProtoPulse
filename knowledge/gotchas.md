---
description: Topic map for ProtoPulse gotchas — surface-specific traps where a supposedly reusable pattern, primitive...
type: moc
topics:
- index
- architecture-decisions
---
# gotchas

Gotchas are single-surface landmines that do not generalize into patterns. They are worth capturing because they are invisible in documentation, pass type-checks, pass linters, and only fail at runtime when a specific composition or prop combination collides. Every note here answers "what broke unexpectedly, and what should I look for next time?"

## Synthesis

A gotcha earns its spot here when **the correct-looking code produces incorrect-looking behavior**. Type systems, linters, and tests did not flag it. The fix is usually a one-line adjustment with a one-paragraph explanation. The value is that the explanation survives across session boundaries and prevents rediscovery.

## Core Ideas

- [[popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision]] — Radix Popover's `Trigger asChild` collides with Tooltip's slot forwarding when Tooltip wraps the trigger; the fix is to put Tooltip on the Popover content parent, not the trigger
- [[oncloseautofocus-must-fallback-when-trigger-is-unmounted]] — Radix's default post-close focus restoration points at the opener, but if that opener was unmounted during the session, focus silently lands on `<body>` — the mitigation is a ref-based fallback to the nearest stable focus target

## Cross-cutting relationships

- Gotchas often signal that an [[implementation-patterns]] entry should expand to cover the edge case, or that a [[ux-patterns]] composition rule needs to be stricter
- When two gotchas share a root cause, promote to [[implementation-patterns]] with the shared pattern named

## When a note belongs here vs elsewhere

| Condition | Goes to |
|-----------|---------|
| Recurring across features, has a named pattern | [[implementation-patterns]] |
| Surface-specific trap, single composition | gotchas (here) |
| a11y-specific regression, cited by WCAG/ARIA | [[a11y]] MOC |
| Library quirk that will be fixed upstream | gotchas with version range noted |

## Open Questions

- Should gotchas expire? A Radix API surface that changes in a major version may retire a gotcha; the note should then be archived, not just edited.
- Is there a useful way to tag gotchas by library (Radix, TanStack Query, Drizzle) so a version bump can trigger an audit?

## Agent Notes

Before writing code that composes two Radix primitives, grep this MOC for the primitive pair. Slot-forwarding and focus-restoration bugs are the most common categories here.

---

Topics:
- [[index]]
- [[architecture-decisions]]
