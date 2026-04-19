---
description: "NVDA (Windows, free, 40%+ share), VoiceOver (macOS/iOS, built-in, ~30%), and JAWS (Windows, commercial, ~40%) are the three screen readers teams must test against — and they have documented behavioral differences on aria-live timing, aria-activedescendant tracking, and role=application scope that mean 'works on NVDA' is not 'works for all screen-reader users'."
type: claim
audience: [intermediate, expert]
confidence: verified
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[wcag]]"
  - "[[architecture-decisions]]"
  - "[[maker-ux]]"
provenance:
  - source: "WebAIM — Screen Reader User Survey #10 (2024)"
    url: "https://webaim.org/projects/screenreadersurvey10/"
  - source: "TPGi — Screen reader support for ARIA live regions"
    url: "https://www.tpgi.com/screen-reader-support-aria-live-regions/"
---

# Screen reader testing must cover NVDA and VoiceOver minimum because JAWS and NVDA disagree on aria-live timing

Screen reader behavior is not standardized — the ARIA spec defines attribute semantics but leaves implementation to each AT vendor. NVDA (NonVisual Desktop Access, Windows, free and open-source, ~41% market share per WebAIM's 2024 survey), JAWS (Windows, commercial, ~41%), and VoiceOver (Apple macOS and iOS, built-in, ~31% combined across desktop and mobile) are the three screen readers any testing protocol must cover. TalkBack (Android) is a fourth if the product has mobile support; Narrator (Windows, built-in) is a distant fifth. Testing on only one is insufficient because each has documented behavioral divergences on the most load-bearing ARIA features.

**aria-live timing diverges.** NVDA announces `aria-live="polite"` updates immediately when the user is idle, with ~500ms debounce. JAWS buffers polite updates more aggressively and may delay announcements by several seconds if the user is actively interacting elsewhere. VoiceOver on macOS has historically had the longest idle thresholds and routinely misses polite announcements that appear and disappear within a 2-second window — which means toast auto-dismiss timers below 5 seconds can silently skip VoiceOver users entirely. The practical implication for [[radix-toast-ships-aria-live-off-by-default-which-silently-hides-notifications-from-screen-readers]] compounds here: even after fixing the `aria-live="off"` bug, short-duration toasts will still fail to announce on VoiceOver. Test with a VoiceOver session and verify announcements fire before auto-dismiss elapses.

**aria-activedescendant tracking diverges.** NVDA follows `aria-activedescendant` changes reliably within composite widgets (combobox, listbox). JAWS has historical bugs with `aria-activedescendant` inside elements that also have `role="application"` — the combination can cause JAWS to miss announcements entirely, which is part of why [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]] exists. VoiceOver is generally reliable but has a specific issue with `aria-activedescendant` inside elements rendered via React portals — the announcement chain breaks if the active descendant is in a different DOM subtree than the controlling element, which is exactly Radix's Portal pattern. This is a real-world ProtoPulse concern for any combobox that uses Popover's portal.

**role="application" scope diverges most severely.** NVDA honors the role strictly — browse mode suppression applies only inside the `role="application"` element. JAWS has sometimes applied application-mode more broadly in older versions, suppressing shortcuts in ancestor or sibling regions. VoiceOver's "interaction" mode (the equivalent concept) is user-initiated rather than auto-triggered by role="application", which means VoiceOver users may have a different experience than NVDA/JAWS users encountering the same widget.

**Heading navigation and landmark announcement differ.** NVDA announces landmark roles when entering them (Insert+F7 opens landmarks list). JAWS has richer landmark navigation but sometimes skips `role="main"` without a `<main>` element. VoiceOver announces landmarks differently by default — the rotor (Ctrl+Option+U) is the primary landmark navigation, and default reading does not always call out landmark entry. This affects how users navigate ProtoPulse's multi-region layouts (schematic panel vs BOM vs chat dock) — a structure that announces well on NVDA may be harder to navigate by landmark on VoiceOver.

The testing priority for ProtoPulse, given Windows-first developer environment and macOS-user reality: NVDA primary (install free, test every feature), VoiceOver secondary (borrow a Mac, test every critical flow), JAWS tertiary (40-day free trial, test the critical flows again to catch divergences from NVDA). TalkBack only if/when PartScout or mobile ProtoPulse ships. The anti-pattern is testing only NVDA and assuming VoiceOver works — the combobox and live-region bugs above will slip through that protocol. A reasonable CI budget is a twice-yearly full-screen-reader sweep across NVDA+VoiceOver, with automated axe-core runs on every PR as the structural-correctness gate that complements but does not replace manual testing.

One testing lever worth knowing: Playwright can drive browser-native ARIA inspection via its `accessibility` API, which reads from the same accessibility tree screen readers consume. This does not replace a screen reader test (it does not execute the AT's announcement logic) but it catches the structural failures (missing labels, wrong roles, absent `aria-live`) that precede any AT-specific divergence. [[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]] applies — JSDOM does not build the accessibility tree, so these tests must run in a real Playwright browser.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[radix-toast-ships-aria-live-off-by-default-which-silently-hides-notifications-from-screen-readers]] — VoiceOver compounds this with idle-threshold timing
- [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]] — JAWS divergence makes this more important
- [[playwright-focus-trap-testing-requires-real-tab-sequences-not-jsdom]] — complementary automated test layer
- [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] — portal+aria-activedescendant is a VoiceOver concern

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]
