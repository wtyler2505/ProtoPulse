---
description: "Each resistive touchscreen panel has slightly different coordinate-to-pixel mapping due to manufacturing tolerances, so a calibration sketch must be run per physical unit to get accurate touch coordinates"
type: claim
source: "docs/parts/2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
---

# resistive touchscreen requires per-unit calibration because coordinate mapping varies between individual panels

Resistive touchscreens read touch position as analog voltage divider values across the X and Y axes of the resistive film. The raw ADC values do not map directly to pixel coordinates — the relationship depends on the physical resistance distribution of that specific panel, which varies with manufacturing tolerances, film tension, and contact area geometry.

This means a calibration sketch must be run on each physical unit to establish the mapping between raw ADC readings and screen pixel positions. The calibration typically asks the user to touch several known points (corners and center), then computes a linear transform (or affine matrix) to map raw touch coordinates to display pixels.

Without calibration, touch coordinates will be offset, scaled incorrectly, or even inverted relative to the display. This is a common beginner trap — the display works perfectly but touch input "points to the wrong place." The fix is not a code bug; it is a per-unit hardware characteristic that must be measured.

This contrasts with capacitive touchscreens (like the one on the [[raspberry-pi-7-inch-touchscreen-800x480-dsi]]), where the touch controller IC handles calibration internally and reports pixel-accurate coordinates to the host. Resistive touch puts the calibration burden on the user's firmware.

**ProtoPulse implication:** When a resistive touchscreen is added to a schematic, the bench coach should warn that touch calibration is required and link to the appropriate calibration sketch for the touch library in use (Adafruit_TouchScreen, XPT2046_Touchscreen, etc.).

---

Source: [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]]

Relevant Notes:
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — calibration is an invisible step in the display dependency chain
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] — another display gotcha category

Topics:
- [[displays]]
