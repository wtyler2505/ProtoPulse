---
description: "The ZS-042 DS3231 breakout has a trickle-charging circuit for LIR2032 rechargeable cells, but most people insert non-rechargeable CR2032s -- the battery can overheat, leak, or rupture unless resistor R5 is removed"
type: claim
source: "docs/parts/ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[eda-fundamentals]]"
related_components:
  - "ds3231-rtc-module-zs042"
---

# ZS-042 charging circuit will damage non-rechargeable CR2032 batteries unless resistor R5 is removed

The ZS-042 breakout board for the DS3231 RTC includes a trickle-charging circuit: a 200-ohm resistor (R5) and a diode that feed current from VCC into the coin cell holder. This circuit is designed for rechargeable LIR2032 lithium-ion cells. The problem: the overwhelming majority of users (and kits) use standard non-rechargeable CR2032 lithium cells.

Charging a non-rechargeable CR2032 causes it to overheat, swell, leak electrolyte, or in extreme cases rupture. The failure mode is slow -- the battery may work for weeks before it starts degrading, making it look like a "dead battery" rather than a design hazard.

**Fix:** Remove resistor R5 from the ZS-042 board with a soldering iron. This disconnects the charging circuit while leaving the battery backup path intact. The CR2032 will still power the DS3231 during VCC loss (3-5 year backup life at typical timekeeping-only draw).

**Why this is a beginner trap:** The charging circuit is undocumented on most cheap ZS-042 clones. The only symptom is a battery that dies faster than expected or gets warm when you check it. A beginner will buy more batteries, not examine the PCB for a charging circuit. Even experienced hobbyists miss this unless they've been burned before.

**ProtoPulse implication:** If the BOM contains a DS3231 on a ZS-042 board paired with a CR2032 battery (or no battery type specified, since CR2032 is the default assumption), the AI coach should proactively warn about R5 removal. This is exactly the kind of hardware safety catch that distinguishes ProtoPulse from a passive BOM list.

---

Relevant Notes:
- [[ds3231-tcxo-accuracy-is-orders-of-magnitude-better-than-ds1307-crystal-drift-making-ds1307-obsolete-for-most-projects]] -- DS3231 is the recommended RTC; this is the gotcha for its most common breakout board
- [[mpu6050-and-ds3231-share-i2c-address-0x68-requiring-ad0-pin-configuration]] -- same module, different gotcha (I2C conflict)

Topics:
- [[sensors]]
- [[eda-fundamentals]]
