---
type: enrichment
target_note: "[[bldc-stop-active-low-brake-active-high]]"
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
addition: "Add the explicit CT brake state table (HIGH=normal, LOW=brake) and the 'ramp speed before engaging brake, release within 2-3 seconds' operating discipline"
source_lines: "292-300"
---

# Enrichment 044: [[bldc-stop-active-low-brake-active-high]]

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 292-300)

## Reduce Notes

Enrichment for the BLDC STOP/BRAKE polarity note. Note: claim-024 already flagged that this source contradicts the KJL-01 brake polarity with ZS-X11H CT brake being active-LOW. Source reaffirms the ZS-X11H convention with an explicit state table:

| ESP32 Output | Level-Shifted | ZS-X11H CT | Motor Behavior |
|---|---|---|---|
| HIGH (3.3V) | HIGH (5V) | Normal | Motor runs per EL/Z/F |
| LOW (0V) | LOW (0V) | Brake | Motor phases shorted |

Plus the braking-rule operating discipline: "Always reduce speed before engaging brake. High-speed braking generates large back-EMF. Release brake within 2-3 seconds of motor stopping."

Rationale: This is subtle — the existing note claims BRAKE is active-high (for the KJL-01), while claim-024 and this source confirm ZS-X11H CT is active-LOW. The enrichment should update the note to explicitly note the vendor-specific polarity (not a BLDC convention) and link to claim-024 as the tension. Core claim about inverted-pair traps is unchanged but scope narrows.

---

## Enrich
- Updated `knowledge/bldc-stop-active-low-brake-active-high.md` to clarify that polarity is vendor-specific.
- Added the exact ZS-X11H state table indicating CT is active-LOW.
- Added the "Braking Operating Discipline" stating to reduce speed before braking and release within 2-3 seconds.

## Connect
- Re-evaluated connection to [[hall-sensor-wiring-order-matters-for-bldc]] and other notes. 
- Connected explicitly to `claim-024` context by noting the tension between vendors.

## Revisit
- Existing notes generally assumed KJL-01 behavior was universal. This was corrected in the main text.
- Re-aligned the core claim to emphasize inverted-pair traps while acknowledging the polarity is not universal.

## Verify
- Read prediction: Future searches for "brake polarity" will find the explicit ZS-X11H table and the warning about vendor specificity.
- Schema compliance: The file `knowledge/bldc-stop-active-low-brake-active-high.md` retains its frontmatter and structure.
- Health checks: Links intact, content flows logically.
