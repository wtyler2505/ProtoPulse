---
description: Arduino compile output for a real sketch with warnings routinely exceeds 1000 lines; without DOM virtualization the panel stutters or hangs, which makes the IDE feel broken during exactly the workflow it was built for
type: claim
created: 2026-04-18
topics:
  - "[[maker-ux]]"
---

# compile output panels need virtualization at the line count real sketches produce not at demo sketch scale

Compile output in Arduino-flavored IDEs is trivial when the sketch is Blink — a dozen lines, one warning maybe. So the naive DOM-per-line implementation works and never gets revisited. Then a user compiles a real project — a library-heavy sketch with WiFi, OLED, FreeRTOS, a half-dozen sensor drivers — and the output is 2000-8000 lines, much of it deprecation warnings and template instantiation chatter. A plain `<div>` per line will jank or hang the tab.

This is the worst kind of performance failure because it shows up exactly when the user has graduated from beginner projects — the moment they're most invested and most impatient. They'll read "my tool can't handle a real sketch" and switch to the reference Arduino IDE or PlatformIO, which learned this lesson years ago.

The threshold for virtualization is not "when someone complains." It's **before a common real-world sketch hits the stutter point**. For compile output, that means virtualization-by-default, same pattern as [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] — the principle transfers cleanly from canvas nodes to log lines. react-window or @tanstack/react-virtual over a fixed-height line renderer is the standard answer, not a sophisticated optimization.

Secondary wins from virtualization beyond performance:
- Search-within-output stays instant because only rendered lines reflow.
- Sticky headers for warning groups become cheap.
- "Jump to first error" is a scroll target, not a DOM hunt.

The methodology principle: **measure at realistic scale, not demo scale.** Benchmarking the compile panel with Blink output proves nothing. The relevant scale is a real user's WiFi-plus-sensors sketch with ArduinoJson pulled in, which is the modal compile for anyone past their first week.

---

Source: [[2026-04-18-e2e-arduino-tab-tested]] (edge cases worth testing, line 40)

Relevant Notes:
- [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] — same virtualization failure mode in a different surface; canvas stuttering and compile-log stuttering share the root cause
- [[makers-need-one-tool-because-context-switching-kills-momentum]] — the moment the compile panel hangs is exactly when the user reaches for PlatformIO

Topics:
- [[maker-ux]]
