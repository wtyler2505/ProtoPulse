---
description: Severity indicators must carry meaning on at least two of {color, icon/shape, text label, pattern, position} so the signal survives any single channel failing — this is the operational contract that satisfies WCAG 1.4.1.
type: methodology
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[ux-patterns]]"
  - "[[architecture-decisions]]"
  - "[[maker-ux]]"
---

# Multi-channel severity encoding is the standard pattern for a11y-compliant status UI

Given that [[WCAG 2.1 SC 1.4.1 says color cannot be the sole channel for meaning]], the question shifts from "is color allowed?" to "which second channel should ride alongside it?" The standard answer is a layered encoding: color + icon + text label, with shape/position/pattern as fallback channels when text is impractical (dense canvases, chart legends, PCB layer stacks).

The rule of thumb is **two-of-five**: any semantic state — error, warning, success, info, disabled, selected — must be distinguishable using at least two of {hue, icon/shape, text label, pattern/texture, position}. A lone yellow triangle fails (one channel: hue; the triangle *shape* is the icon container, not a distinct icon). A yellow triangle + a bold "Warning" label + an exclamation-mark glyph passes on three channels, so the meaning survives grayscale printing, deuteranopia, and reduced-transparency modes simultaneously.

Concrete application to ProtoPulse surfaces:

**Validation card severity badges.** The current yellow warning triangle without text is the canonical SC 1.4.1 failure pattern. Fix: pair with a text label ("Warning", "Error", "Info") and keep the icon glyph distinct per severity — filled circle for error, triangle with exclamation for warning, circle-i for info. Never reuse the same glyph across severities differentiated only by fill color.

```tsx
// fails SC 1.4.1 — color-only
<span className="text-yellow-500">▲</span>

// passes — color + icon + label
<Badge variant="warning">
  <AlertTriangleIcon aria-hidden />
  <span>Warning</span>
  <span className="sr-only">Severity:</span>
</Badge>
```

**PCB layer stack.** Red F.Cu and green Inner GND fail if a user cannot distinguish red/green (deuteranopia, ~6% of men). The layer *name* must appear adjacent to the swatch in the legend, and the rendered layer should carry a pattern differentiator (solid vs diagonal hatch) visible in dense overlaps. KiCad's convention of layer-name-adjacent-to-color-swatch is the authoritative precedent; follow it.

**DRC result severity counts.** Dashboards showing "12 errors, 3 warnings, 1 info" typically color-code the counts. Pair each count with its severity word, its icon, and — if space — a bar-chart bar whose *position* (leftmost = error, rightmost = info) reinforces the ordering beyond hue.

The palette choice matters but is secondary to the channel count. When color is used, prefer the **Okabe-Ito Color Universal Design palette** — eight hues designed to remain distinguishable across all common color vision deficiencies: `#000000` Black, `#E69F00` Orange, `#56B4E9` Sky Blue, `#009E73` Bluish Green, `#F0E442` Yellow, `#0072B2` Blue, `#D55E00` Vermilion (a safer "red"), `#CC79A7` Reddish Purple. Notably, Okabe-Ito *replaces* the default red-green pairing with vermilion + bluish-green, which is the single highest-leverage swap an EDA tool can make since red/green is the dominant layer-color convention.

Verification is simpler than the design: run every status surface through **Sim Daltonism** (macOS) or **Coblis** (web) in deuteranopia, protanopia, and grayscale modes. If the state is still distinguishable without squinting, the encoding passes. If not, the color was doing all the work and a channel is missing.

The deeper principle: this pattern is not "a11y tax" — it is defense-in-depth for meaning itself. Screenshots in documentation render differently than production. Printouts drop to grayscale. Mobile screens under direct sunlight collapse saturation. Every delivery channel is another failure mode for hue-as-sole-signal. Multi-channel encoding is how UI state survives the trip from designer's monitor to user's actual perception.

---

Source: [[2026-04-19-wcag-1-4-1-use-of-color]]

Relevant Notes:
- [[wcag-2-1-sc-1-4-1-color-cannot-be-sole-channel-for-meaning]] — the criterion this pattern operationalizes
- [[wcag-2-1-sc-1-4-11-requires-focus-indicators-to-hit-3-to-1-contrast-against-adjacent-colors]] — sibling contrast criterion; applies when color IS a channel
- [[precise-real-world-pcb-and-silkscreen-colors-improve-hardware-verification-fidelity-in-virtual-breadboards]] — tension: fidelity colors are not chosen for a11y, so layer stacks need label+pattern reinforcement

Topics:
- [[a11y]]
- [[ux-patterns]]
- [[architecture-decisions]]
- [[maker-ux]]
