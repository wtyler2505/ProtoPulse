---
type: enrichment
target_note: "[[bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus]]"
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
addition: "Add the concrete RioRand-to-TXS0108E-to-ESP32 pin mapping table (Hall A/B/C/Temp through B1-B4/A1-A4 to GPIO 34/35/36/39) as the canonical wiring reference"
source_lines: "28-42"
---

# Enrichment 053: [[bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus]]

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 28-42)

## Reduce Notes

Enrichment for [[bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus]]. The existing note explains WHY TXS-class is correct. Source adds the concrete complete wiring — the exact pin mapping table from RioRand ZS-X11H Hall outputs through TXS0108E B1-B4/A1-A4 pairs to ESP32 GPIO 34/35/36/39 — that lets a reader actually build the circuit.

Specific additions:
- Pin mapping table (ASCII art form from source)
- VCCB = 5V from RioRand thin red wire
- VCCA = 3.3V from ESP32
- OE to VCCA explicit
- Common GND requirement

Rationale: The existing note is a "why this topology" argument. The enrichment makes it actionable by including the reference wiring diagram. Strong enrichment because the original note mentions ZS-X11H by name but doesn't show the wiring.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
