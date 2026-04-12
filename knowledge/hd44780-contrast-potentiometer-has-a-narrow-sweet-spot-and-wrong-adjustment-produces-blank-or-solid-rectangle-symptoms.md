---
description: "The V0 contrast pin on HD44780 LCDs has a narrow adjustment range — too high shows solid dark rectangles, too low shows a completely blank screen. This is the number one 'my LCD does not work' false alarm."
type: claim
source: "docs/parts/hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
---

# hd44780 contrast potentiometer has a narrow sweet spot and wrong adjustment produces blank or solid rectangle symptoms

The HD44780 character LCD has a V0 pin that controls display contrast via an analog voltage. A 10K potentiometer between VDD (5V) and VSS (GND) with the wiper connected to V0 provides the adjustment. The problem is that the usable contrast range occupies a narrow slice of the pot's rotation:

**Symptom guide:**
- **Solid dark rectangles** (all pixels fully opaque) — contrast is too high. The V0 voltage is too low (close to GND). Turn the potentiometer up (toward VDD).
- **Completely blank screen** (backlight on but no visible characters) — contrast is too low. The V0 voltage is too high (close to VDD). Turn the potentiometer down (toward GND).
- **Faint but readable characters** — you are close to the sweet spot. Fine-tune slowly.

This is the single most common "my LCD doesn't work" complaint in the Arduino community, and it has nothing to do with code, wiring, or the LCD itself. The display is functioning correctly — it is just invisible because contrast is outside the narrow usable range. The fix is mechanical: adjust the pot slowly until text appears.

**The 3.3V complication:** At 3.3V supply, the contrast voltage range shifts and the sweet spot may be unreachable or extremely narrow. The HD44780 was designed for 5V operation, and the contrast circuit assumes a 5V VDD-VSS span. This is why the display genuinely does not work at 3.3V — it is not just "faint," the contrast mechanism cannot produce a visible image.

**I2C backpack mitigation:** PCF8574-based I2C backpacks include an onboard contrast potentiometer that is pre-adjusted or easily accessible. This eliminates the V0 wiring step and puts the pot in a convenient location on the backpack PCB rather than on a breadboard.

**ProtoPulse implication:** When the bench coach detects an HD44780 in the schematic, the contrast pot should be a mandatory checklist item. If the user reports "display is blank," the first diagnostic should be "adjust the contrast potentiometer" before investigating code or wiring.

---

Source: [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]

Relevant Notes:
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] — the 5V requirement is directly related to contrast behavior
- [[hd44780-parallel-mode-consumes-6-gpio-pins-minimum-making-i2c-backpack-the-default-wiring-choice]] — the I2C backpack mitigates this with an onboard pot

Topics:
- [[displays]]
