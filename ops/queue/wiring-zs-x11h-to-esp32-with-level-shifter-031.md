---
claim: "3.3V output sits in the TTL-to-CMOS threshold boundary making direct connection to 5V logic inputs a per-unit gamble rather than a reliable connection"
classification: closed
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
semantic_neighbor: "raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently"
---

# Claim 031: 3.3V output sits in the TTL-to-CMOS threshold boundary making direct connection to 5V logic inputs a per-unit gamble rather than a reliable connection

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 13-22)

## Reduce Notes

Extracted from wiring-zs-x11h-to-esp32-with-level-shifter. This is a CLOSED claim.

Rationale: The vault's RPi GPIO note covers damage when 5V hits a 3.3V pin. This is the inverse and distinct case: when 3.3V hits a 5V input, there is no damage but reliability is a lottery. 5V TTL spec is 2.0V minimum HIGH and 3.3V clears it with zero noise margin. 5V CMOS spec is 3.5V minimum HIGH and 3.3V is BELOW threshold entirely. The same schematic works on one ZS-X11H unit and fails on another because the receiver input stage implementation varies by silicon lot. This is a different failure mode than "no voltage at all" and deserves its own note because beginners who see "it worked on my bench" assume the design is correct.

Semantic neighbor: raspberry-pi-gpio-is-3v3-unprotected (DISTINCT — that note covers 5V damaging a 3.3V input; this covers 3.3V failing to reliably register on a 5V input, which is a receiver-tolerance problem not a driver-damage problem).

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
