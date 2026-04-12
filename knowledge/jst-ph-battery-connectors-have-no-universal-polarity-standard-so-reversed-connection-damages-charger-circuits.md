---
description: "JST PH 2-pin connectors are the de facto standard for LiPo batteries in dev boards, but manufacturers disagree on polarity. Connecting a reversed battery can destroy the onboard charger IC."
type: claim
source: "docs/parts/adafruit-pygamer-samd51-handheld-gaming-board-with-tft.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[power-systems]]"
related_components: []
---

# JST PH battery connectors have no universal polarity standard so reversed connection damages charger circuits

The JST PH 2-pin connector (2.0mm pitch) is the most common LiPo battery connector in the maker ecosystem. Adafruit, SparkFun, and most Chinese dev boards use it for 3.7V LiPo connections. The problem: there is no enforced polarity standard across manufacturers.

**The danger:**
- Adafruit uses positive on the left (looking at the board connector)
- Some Chinese battery manufacturers wire positive on the right
- The connector physically fits either way -- there's no keying that prevents reversed insertion
- A reversed battery applies -3.7V to the charger IC (typically MCP73831 or TP4056), which can destroy it instantly
- Some boards have no reverse-polarity protection at all

**What gets damaged:**
- The LiPo charger IC (most common casualty)
- The voltage regulator (if the charger doesn't absorb the fault first)
- Potentially the MCU itself if the regulator fails open

**Prevention:**
1. Always check polarity markings on the PCB silkscreen before connecting a new battery
2. Use a multimeter to verify battery connector polarity before first connection
3. If buying loose LiPo cells, verify the JST PH wiring matches your board
4. Some boards (newer Adafruit designs) include a protection diode or MOSFET -- most don't

**ProtoPulse implications:** The AI bench coach should warn about polarity verification whenever a JST PH battery connector appears in a schematic. The BOM system could flag battery/board combinations from different manufacturers as needing polarity verification.

---

Relevant Notes:
- [[all-in-one-dev-boards-trade-gpio-freedom-for-integrated-peripheral-convenience]] -- integrated boards often include battery connectors with charger ICs

Topics:
- [[microcontrollers]]
- [[power-systems]]
