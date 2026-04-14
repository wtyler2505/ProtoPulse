---
type: enrichment
target_note: "[[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]]"
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
addition: "Confirmation that missing-flyback-cap appears in a field Common Mistakes table with the specific symptom (motor inductive spikes damage controller) -- strengthens the note's evidence base by adding a real-world failure-mode framing alongside the theoretical one"
source_lines: "221"
---

# Enrichment 030: [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]]

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 221)

## Reduce Notes

Enrichment for [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]]. Source adds a field-Common-Mistakes entry: "Missing flyback capacitor on ZS-X11H V+/V- -> Motor inductive spikes damage controller -> 470uF 63V electrolytic cap across V+/V-".

Rationale: The existing note already specifies 470uF 63V. The source validates this spec by listing it in the beginner-facing Common Mistakes table with the consequence phrased as damage to the controller, strengthening the evidence base. It reinforces why the cap is not optional on ZS-X11H specifically. Adding this field-observed confirmation alongside the theoretical V = L*di/dt derivation gives the note both first-principles reasoning and empirical grounding.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
