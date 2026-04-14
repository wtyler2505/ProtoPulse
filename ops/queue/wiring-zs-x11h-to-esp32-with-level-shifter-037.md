---
type: enrichment
target_note: "[[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]]"
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
addition: "Add ZS-X11H as a second use case with DIR=HIGH/OE=LOW wiring, and the 'overkill for 4 signals' sizing framing that justifies TXS0108E over 74HCT245 for this specific design"
source_lines: "74-83"
---

# Enrichment 037: [[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]]

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 74-83)

## Reduce Notes

Enrichment for the 74HCT buffer note. Source adds a second worked use case (ZS-X11H control signals) and explicit control-pin wiring (DIR=HIGH for A→B direction, OE=LOW to enable). Currently the note only shows the NeoPixel use case and comparison table. Adding the ZS-X11H case shows the buffer pattern generalizes beyond display signaling to motor control, and the "overkill for 4 signals" framing gives sizing guidance (use 74HCT245 when you already have 5+ signals to shift; use TXS0108E or smaller buffer for 4 or fewer).

Rationale: This enriches rather than creates a new note because the core claim is unchanged — HCT buffers are purpose-built for 3.3V→5V timing-critical signals. The source provides an additional worked example within that same claim.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
