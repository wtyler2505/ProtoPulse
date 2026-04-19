---
description: "Focus-trap correctness cannot be validated in jsdom — Tab/Shift+Tab key events do not move focus in jsdom the way they do in real browsers — so every focus-management assertion must run in Playwright with real page.keyboard.press('Tab') sequences and document.activeElement polling."
type: claim
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[testing-patterns]]"
  - "[[architecture-decisions]]"
related_components:
  - "tests/e2e/a11y/*.spec.ts"
---

# Playwright focus-trap testing requires real Tab sequences not jsdom

jsdom implements the DOM specification but does not implement the browser's focus-management algorithm. `element.focus()` works. `element.tabIndex = 0` works. But firing a `KeyboardEvent({key: 'Tab'})` does NOT move focus in jsdom — focus only moves via explicit `.focus()` calls or user-agent shell interaction, neither of which jsdom simulates.

This makes Vitest + @testing-library/user-event's `userEvent.tab()` **partially reliable**: it walks through elements with `tabIndex >= 0` in document order, but does not respect focus traps, does not respect portal boundaries, and does not respect `inert`. A jsdom test that asserts "Tab inside dialog stays inside dialog" will pass or fail for the wrong reasons — it passes because user-event's simulation happens to stay in range, or fails because the simulation walks past the trap boundary into portaled content that a real browser would never reach.

**The consequence for test strategy:**

| Test concern | Test layer | Why |
|--------------|------------|-----|
| Component renders with correct ARIA | Vitest + jsdom | Pure structural assertion, no focus involved |
| Hook returns next focus target | Vitest + jsdom | Pure logic, no DOM focus |
| `.focus()` on element moves focus | Vitest + jsdom | jsdom supports this correctly |
| Tab/Shift+Tab moves to next tabbable | Playwright | Real browser focus algorithm |
| Focus trap prevents Tab escape | Playwright | Requires real focus algorithm + portals |
| onCloseAutoFocus returns to trigger | Playwright | Requires real browser focus restoration |
| Screen reader announcements | Manual NVDA/VoiceOver | No automated tool replicates AT output fidelity |

**The Playwright pattern for focus assertions:**

```ts
// Assert focus on a specific element
await expect(page.getByRole('textbox', { name: /email/i })).toBeFocused();

// Assert focus stays within a container after N Tabs
const dialogStillHasFocus = async () =>
  page.evaluate(() =>
    Boolean(document.activeElement?.closest('[role="dialog"]'))
  );

for (let i = 0; i < 10; i++) {
  await page.keyboard.press('Tab');
  expect(await dialogStillHasFocus()).toBe(true);
}
```

**Don't trust `userEvent.tab()` for trap assertions.** If a test uses `userEvent.tab()` and passes, that says nothing about whether a real browser keeps focus inside the trap. The only way to get meaningful coverage is to lift the test into Playwright.

**Axe-core has the inverse gap.** Axe validates static accessibility properties (roles, names, contrast) and does NOT validate focus-trap correctness because focus-trap is a runtime behavior, not a static attribute. A dialog can have `role="dialog"`, `aria-modal="true"`, a valid name, pass every axe rule — and still let Tab leak out because someone set `trapped={false}` on the FocusScope. Axe is necessary but not sufficient; Playwright focus assertions are the second half of the coverage.

**The economic implication for test suite design:** a11y coverage is expensive because the "real" tests run in Playwright (slower, requires browser, more flake surface). Minimize the number of Playwright specs by making each one test the full lifecycle (open → tab cycle → escape → focus return) rather than splitting into ten micro-tests. One spec per dialog/popover component, exercising every focus-management transition, costs ~3s and catches every regression.

---

Source: [[2026-04-19-keyboard-nav-radix-dialog-focus-trap]]

Relevant Notes:
- [[radix-dialog-focus-trap-and-escape-hierarchy]] — the behavior this testing strategy validates
- [[popover-trigger-aschild-requires-tooltip-outside-to-avoid-slot-forwarding-collision]] — canonical example of a bug invisible in jsdom that Playwright catches
- [[breadboard-keyboard-nav-contract-arrow-keys-within-zones-tab-between-zones]] — specifies Playwright tests for the canvas's keyboard contract for the same reason

Topics:
- [[a11y]]
- [[testing-patterns]]
- [[architecture-decisions]]
