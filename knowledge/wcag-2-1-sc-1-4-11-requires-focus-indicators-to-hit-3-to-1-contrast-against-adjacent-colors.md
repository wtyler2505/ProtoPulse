---
description: "SC 1.4.11 Non-text Contrast mandates a 3:1 ratio between the focus indicator and whatever colors touch it — a single solid outline fails whenever the background sits near the indicator's hue, so a dual-outline cage is the only pattern that survives arbitrary backgrounds"
type: claim
audience: [intermediate, expert]
confidence: verified
created: 2026-04-19
topics: ["[[maker-ux]]", "[[architecture-decisions]]"]
provenance:
  - source: "W3C WCAG 2.1 Understanding SC 1.4.11 Non-text Contrast"
    url: "https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html"
  - source: "W3C WCAG 2.2 Understanding SC 2.4.11 Focus Not Obscured (Minimum)"
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html"
  - source: "W3C WCAG 2.2 Understanding SC 2.4.13 Focus Appearance (AAA)"
    url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html"
  - source: "Sara Soueidan — A Guide to Designing Accessible, WCAG-Compliant Focus Indicators"
    url: "https://www.sarasoueidan.com/blog/focus-indicators/"
---

# WCAG 2.1 SC 1.4.11 requires focus indicators to hit 3:1 contrast against adjacent colors

SC 1.4.11 Non-text Contrast treats the focus ring as a user-interface component state and demands at least a **3:1 contrast ratio** between the indicator and every color it sits against. The computed ratio is not rounded — 2.999:1 fails. When the indicator is drawn *outside* a control (the common `outline` case) the ratio is measured against the **background the control sits on**, not the control itself. When drawn *inside* the control it is measured against the control's own fill. Partial indicators that straddle the boundary pass if *either* of the two regions clears 3:1.

This is the criterion that ProtoPulse's current token `outline: 2px solid #00F0FF; outline-offset: 2px;` silently violates. Cyan #00F0FF reports ~1.3:1 against the app's cyan-adjacent panel gradients and ~1.1:1 against the neon accent chips used in BOM headers and the BreadboardLab toolbar — nowhere near 3:1. The outline is *visible* to a sighted developer, which is why it passes casual review, but [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] (which covers SC 2.4.7 removal) and this criterion are independent failures: you can have a focus indicator that exists (passes 2.4.7) yet fails 1.4.11 because it blends into the background. Both must hold.

SC 1.4.11 is also distinct from SC 2.4.13 Focus Appearance (AAA, WCAG 2.2). 2.4.13 measures the *change* between focused and unfocused states for the same pixels (a before/after delta); 1.4.11 measures *adjacent* contrast in the focused state. An indicator can pass one and fail the other — a light-gray outline on a light-blue button passes 2.4.13 (because the gray differs 3:1 from the button fill in the unfocused state) but fails 1.4.11 (because gray on the page's white surround is well under 3:1). Treating "we changed the pixels enough" as sufficient is the classic 2.4.13-only bug.

The robust fix is the **dual-outline cage** (also called the Oreo pattern, attributed to Adrian Roselli, Sara Soueidan, and Erik Kroes). You stack two indicators in opposing luminance:

```css
:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px #fff;
}
```

The inner `box-shadow` paints a white halo, the `outline` paints a black ring around that halo. Against any background, at least one of the two rings clears 3:1 — a dark background contrasts with the white halo, a light background contrasts with the black outline, a mid-tone background contrasts with both. This is why cage patterns work where single-color indicators fail: they remove the author's need to predict which backgrounds will ever sit behind the control, which is especially valuable in theme-switched UIs, canvas-heavy surfaces like BreadboardLab, and syntax-highlighted code panels where the adjacent color is user data.

Two implementation caveats survive from primary sources. First, use `:focus-visible`, not `:focus` — `:focus` triggers on mouse click too and produces the annoying outline that developers reach for `outline: none` to suppress, restarting the whole accessibility regression. Second, `outline-offset` behaved buggily in Safari before 16.4 (the outline could render under the element in some compositing paths); `box-shadow` is the safer spacer when you must support older WebKit. If you must use a single-color outline, the thickness floor is 2 CSS pixels (SC 2.4.13) and you must verify the 3:1 ratio against **every** background the control may appear over — which in a themed app is effectively untestable, which is why the cage is preferred.

SC 1.4.11 does not stand alone. SC 2.4.11 Focus Not Obscured (Minimum) adds that sticky headers, cookie banners, and non-modal overlays must not *entirely* hide the focused component — partial obscuring is tolerated. A beautifully cage-wrapped focus ring trapped behind a sticky toolbar still fails the broader "keyboard user can see where they are" contract, so the indicator's contrast design and the layout's z-order interact. ProtoPulse's sticky BOM toolbar and floating ChatDock are exactly the surfaces where 2.4.11 and 1.4.11 co-fail.

---

Source: [[2026-04-19-wcag-focus-ring-3to1-contrast]]

Relevant Notes:
- [[focus-outline-none-strips-keyboard-indicators-wcag-violation]] — covers SC 2.4.7 (indicator must exist); this note covers SC 1.4.11 (indicator must contrast). Both failures are independent and both apply.
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] — accessibility-by-default is part of the maker-friendly thesis; silent contrast failures punish the same users the product claims to serve.
- [[makers-need-one-tool-because-context-switching-kills-momentum]] — keyboard-only users forced to an alternate tool because focus is invisible break the single-tool promise.

Topics:
- [[maker-ux]]
- [[architecture-decisions]]
