---
description: 'Radix UI Toast''s default aria-live=''off'' on the Viewport (open issue #3634) means toast announcements never reach screen readers unless...'
type: claim
audience:
- intermediate
- expert
confidence: verified
created: 2026-04-19
topics:
- a11y
- wcag
- architecture-decisions
- maker-ux
provenance:
- source: 'GitHub — radix-ui/primitives Issue #3634: Toast not announced to screen readers due to aria-live=''off'''
  url: https://github.com/radix-ui/primitives/issues/3634
- source: MDN — ARIA live regions
  url: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions
- source: W3C WCAG 2.1 Understanding SC 4.1.3 Status Messages
  url: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
- source: Sara Soueidan — Accessible notifications with ARIA Live Regions
  url: https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/
---
# Radix Toast ships aria-live='off' by default which silently hides notifications from screen readers

Radix UI's `Toast` primitive has a known and unresolved accessibility defect as of April 2026: the `Toast.Viewport` root element is rendered with `aria-live="off"` regardless of the Toast.Root's `type` prop, which means toasts announced by the library never reach screen readers unless each individual `Toast.Root` overrides `aria-live` or `role="status"` manually. GitHub issue #3634 documents the bug with reproductions against NVDA, JAWS, and VoiceOver. The issue is open because fixing it at the Viewport level would regress users who intentionally suppress announcements by setting `type="foreground"` per-toast, and the Radix API doesn't currently expose a Viewport-level `aria-live` override. The practical consequence is that every ProtoPulse surface that renders toasts today is in silent WCAG 4.1.3 Status Messages violation.

The underlying ARIA contract that Radix is failing to honor: `aria-live="polite"` is the default for non-critical status messages (success confirmations, background task completions) and waits for screen reader idle before announcing; `aria-live="assertive"` interrupts the current announcement immediately and is reserved for time-sensitive errors. "If in doubt, default to polite" is the consensus guidance from MDN, Sara Soueidan, and the APG. A live region with `aria-live="off"` is a no-op — it exists structurally but announces nothing. The Radix Toast Viewport's `off` default short-circuits the entire announcement chain even when individual Toast.Root components specify their `type`.

This matters doubly because toasts commonly carry error semantics — "Save failed", "Connection lost", "Part not found in database" — and an unannounced error is indistinguishable from no error for a screen reader user. WCAG 4.1.3 Status Messages (Level AA) specifically requires that "status messages can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus." A toast that renders but doesn't announce fails this criterion outright. The failure mode is especially treacherous because axe-core and similar automated a11y scanners check *presence* of ARIA attributes but not their *effective runtime value*, so the bug ships green.

The workaround has three forms, in order of effort. The simplest is to override `aria-live` on the `Toast.Root` itself: `<Toast.Root aria-live="polite">` for informational toasts and `<Toast.Root aria-live="assertive">` for errors. This must be added everywhere — a project-wide find-replace that every toast consumer must honor. The second form is to wrap the Radix Toast in a custom abstraction that sets `aria-live` based on a new `severity` prop, centralizing the concern so it cannot be forgotten per-call site. The third form — required for genuinely critical flows like destructive-action confirmations — is to abandon toast for those messages and use `role="alertdialog"` with a proper focus trap, because a screen reader user should not discover a destructive-action error via a background announcement.

Auto-dismiss compounds the problem. If a toast auto-dismisses at 3 seconds and polite-mode announcement waits for screen reader idle (which may exceed 3 seconds during a lengthy announcement), the toast can disappear before it is announced at all. APG guidance and Sara Soueidan's write-up both recommend: (a) never auto-dismiss toasts shorter than 5 seconds if they carry semantic weight, (b) provide a dismiss button so keyboard/screen-reader users can control dismissal, and (c) consider a "toast history" affordance so users can re-review missed messages. Radix Toast's `duration` prop defaults to 5000ms, which is the minimum acceptable floor — never reduce it. The cross-check: if a hearing-sighted developer finds the 5-second duration "too slow", they are optimizing for themselves and degrading the experience for the users WCAG 4.1.3 protects.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[multi-channel-severity-encoding-is-the-standard-pattern-for-a11y-compliant-status-ui]] — toasts are the status-message surface where severity encoding matters most
- [[nested-radix-dialogs-stack-focus-traps-lifo-and-escape-unwinds-one-level]] — critical errors escalate from toast to alertdialog, which has the stacked focus-trap contract
- [[wcag-2-1-sc-1-4-1-color-cannot-be-sole-channel-for-meaning]] — toast color alone is insufficient severity signal; aria-live is the parallel "meaning must have a second channel, in this case the audible one"
- [[protopulse-uses-dialog-for-modal-and-popover-for-anchored-overlays]] — toast is the fourth primitive; escalates to alertdialog when criticality crosses the threshold

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]
