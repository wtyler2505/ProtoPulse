---
description: "Shield and breakout knowledge -- motor shields, sensor shields, proto boards, level shifters, and stackable expansion board selection"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# shields

Shield comparison, pin conflict avoidance, level shifter selection, and expansion board stacking strategies for the inventory. Covers motor shields, sensor breakouts, proto shields, and bidirectional level shifters.

## Knowledge Notes
- [[shield-pin-conflicts-are-invisible-until-stacking-fails]] — HW-130, Ethernet, and TFT shields share pins silently; stacking causes mysterious failures
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] — four motor shields form a 600mA→16A ladder that maps to actuator voltage tiers
- [[spi-bus-sharing-on-a-single-shield-requires-per-device-chip-select-discipline-where-unused-devices-must-be-explicitly-deselected]] — W5100 + SD card on Ethernet shield share SPI; CS discipline prevents bus contention
- [[mixed-protocol-boards-require-one-level-shifter-per-signal-class-not-one-shifter-for-all-signals]] — a single BSS138 module cannot serve I2C + fast SPI + NeoPixel; partition by topology and speed

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
