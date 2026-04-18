---
type: enrichment
target_note: "[[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]]"
source_task: wiring-36v-battery-power-distribution-4-tier-system
addition: "Specific mention of esp_adc_cal_characterize() as the factory calibration API, and ADS1115 I2C ADC as the external alternative with 16-bit precision — current note references 'calibration' generically without naming the API or the standard external-ADC part"
source_lines: "282-283"
---

# Enrichment 012: ESP32 ADC nonlinearity note — add calibration API and ADS1115 reference

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 282-283)

## Reduce Notes

Enrichment for [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]]. Source provides two concrete implementations of the two escape routes: esp_adc_cal_characterize() for in-chip calibration and ADS1115 for external precision. The current note mentions both strategies abstractly but does not name the specific APIs or parts.

Rationale: Named, searchable parts and APIs are more actionable than generic strategy descriptions. A future reader searching for "ADS1115" or "esp_adc_cal_characterize" should find this note.

---

## Enrich

Enrichment already present in target insight `knowledge/esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc.md`. The existing description (line 2) and body (line 16) both name `esp_adc_cal_characterize()` and ADS1115 (16-bit linear I2C ADC) explicitly. Phase reconciled by ralph lead 2026-04-14.

## Connect

**Discovery Trace:**
- Topic maps — target note has [[microcontrollers]] and [[eda-fundamentals]] as footer topics. [[microcontrollers]] topic map should list this note.
- Target note inline links: [[esp32-adc2-unavailable-when-wifi-active]], [[mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v]]
- Sibling candidates: [[130k-to-10k-voltage-divider...]] (claim-001) — STRONG reverse-direction connection (the divider note cites this note as the nonlinearity reason). Bidirectional satisfied. [[10s-lithium-ion-pack-voltage-range...]] (enrich-013) — also cites this note. Bidirectional satisfied in those directions.

**Connections verified:** 2 inline prose links + 2 topics, plus at least 2 incoming-link references from claim-001 and enrich-013. Articulation test PASS.

**MOC updates:** Note deserves entry in [[microcontrollers]] MOC under ADC characterization section — verify at next MOC polish pass. Not edited here because a broader MOC pass is already queued (Wave 0 task #2 per task list context — creating/polishing 10 hardware topic maps).

**Agent note:** This note has the lowest outgoing link count (4 wikilinks) in the batch but acts as a connection HUB — multiple batch siblings cite it as the grounding reason for their ADC-measurement decisions. Incoming links matter more than outgoing for hub-role notes.

## Revisit

**Claim status:** unchanged — core claim about ESP32 ADC nonlinearity above 2.5V holds. Enrich phase already added `esp_adc_cal_characterize()` API name and ADS1115 part reference to the prose; reweave did not need to revisit those.

**Outgoing links before:** 2 inline (esp32-adc2-unavailable, mega-5v-regulator-thermal) + 2 topics.
**Outgoing links after:** 6 related-notes (added 4) + 1 new inline cross-reference.

**Connections added:**
- Inline: `[[esp32-adc-attenuation-setting-determines-input-voltage-range]]` in opening paragraph — the 11dB attenuation claim referenced throughout had no link to the attenuation note despite the sibling linking back. Bidirectional pair now complete.
- Inline: `[[pico-has-only-3-adc-channels...]]` and `[[raspberry-pi-has-zero-built-in-adc...]]` in the ADS1115 sentence — both sibling notes already cite this note as a grounding reference. Bidirectional pairs now complete, and the shared-escape-route cluster (ADS1115 via I2C) is agent-traversable from any entry point.
- Inline + footer: `[[130k-to-10k-voltage-divider...]]` as practical consequence example — strongest reverse-direction incoming link in the batch per connect phase; forward link adds a concrete-application traversal path (claim → design rule → part sizing).
- Footer: `[[linear-voltage-to-percentage-approximation...]]` — downstream consumer that already cites this note; footer entry explains the measurement-error + model-error compounding argument for agents traversing the battery-percent decision chain.

**Network effect:** Target note now participates in three distinct subgraphs — (a) ESP32 ADC characterization cluster (attenuation, ADC2/WiFi, nonlinearity), (b) cross-MCU external-ADC escape route cluster (ESP32 / Pico / RPi all pointing at ADS1115), (c) 36V battery power-distribution measurement chain (divider → ADC → linear percent → decision). Hub-role reinforced: 4 new outgoing paths plus existing incoming links from claim-001 and enrich-013 siblings.

**MOC membership:** unchanged — [[microcontrollers]] MOC already includes this note (line 45); [[eda-fundamentals]] footer topic unchanged. No MOC edit needed; broader MOC polish already queued as Wave 0 task #2.

**Agent traversal check:** Every new link articulates a decision or mechanism — "selects which voltage window the nonlinearity appears in", "pushes designs toward ADS1115 over I2C", "RPi is forced there by architecture, ESP32 by accuracy". No "see also" noise added.

**Split / challenge:** not indicated. The note is a single claim backed by consistent evidence; no split-recommended or merge-candidate signal from enrich. Voice preserved.

## Verify

**Target note:** `knowledge/esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc.md`

**Gate 1 — Description quality:** PASS. Description is specific, adds information beyond the title (includes numbers, rationale, mechanism), and a cold reader could predict the claim's title from it.

**Gate 2 — Schema compliance:** FLAGGED. Missing `created:` field. Other required fields present (description, type, source, confidence: proven, topics, related_components: [] explicit). FIX NEEDED: add `created:` date.

**Gate 3 — Graph integrity:** PASS. All 15 wiki-links resolve.

**Result:** Gate 1 PASS, Gate 2 FAIL (missing created), Gate 3 PASS. Non-blocking.
