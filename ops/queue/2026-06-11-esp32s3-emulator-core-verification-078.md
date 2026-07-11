---
claim: "ESP32-S3 ADC1 channel N reads GPIO N plus 1 so an emulator resolves analog reads to the correct bench pin"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 078: esp32-s3 adc1 channel n reads gpio n plus one mapping analog reads to bench pins

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 241-242)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Channel-to-pin mapping (slice 7) required so co-sim analogRead reaches the right wired pin; ADC2 0-9 maps to GPIO11-20.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[esp32-s3-adc1-channel-n-reads-gpio-n-plus-1-so-an-emulator-resolves-analog-reads-to-the-correct-bench-pin]]
Path: knowledge/esp32-s3-adc1-channel-n-reads-gpio-n-plus-1-so-an-emulator-resolves-analog-reads-to-the-correct-bench-pin.md

Summary: Verified the exact mapping against source lines 241–242 — ESP32-S3 ADC1 channel n = GPIO(n+1), channels 0–9 → GPIO1–10 (ADC2 0–9 → GPIO11–20), from ESP-IDF v5.2 `soc/adc_channel.h`. Note explains why the emulator must apply the +1 at the channel→pin boundary: firmware reads a channel (one-hot SAR1_EN_PAD) but co-sim sensors are wired to physical pins, so equating channel==pin would route a read to the wrong node. Distinguishes the S3 layout from ESP32-classic (GPIO32–39). claim-079 (oneshot instant conversion) and claim-083 (sampler/bench wiring) have no knowledge note yet, so they are referenced conceptually in-body rather than wiki-linked; linked instead to esp32-adc2-unavailable-when-wifi-active, the faithful-emulator note, and the ADC attenuation note. Topics: esp32-s3, emulation (both MOCs exist).

## connect

Ran /connect --handoff. Dual discovery: re-read both topic maps (knowledge/emulation.md + knowledge/esp32-s3.md) and listed knowledge/ to verify sibling filenames (qmd indexes the main repo, not this worktree).

Links added (all genuine, three of them converted from in-prose references the create phase had flagged as "referenced conceptually because the notes didn't exist yet" — they exist now):

Inline (in-body) wiki-links:
- para 2 "a potentiometer, a divider" → [[a-potentiometer-wired-as-voltage-divider-...-for-mcu-analogread]] — cross-domain link to the physical analog source on the far end of the bench pin this map resolves to.
- para 3 "modeled as instant — start-bit edge and DONE flag, not SAR clock timing" → [[an-emulator-can-model-sar-adc-oneshot-reads-as-instant-conversions-...]] (claim-079).
- para 3 "treated as bench wiring that survives reset" → [[a-shared-mcucore-contract-keeps-peripheral-co-sim-identical-across-cores-with-the-adc-sampler-surviving-reset-as-bench-wiring]] (claim-083).

Relevant Notes additions (durable beyond prose): 079, 083, and the potentiometer note, each with a why-linked annotation.

Reciprocation: 083 already linked TO 078 one-directionally; 078→083 now reciprocates it. 079 did NOT link to 078 — so 078→079 is a genuine *new* sibling link, not a reciprocation. (Topology verified against both sibling files; the create-summary's assumption was the inverse.)

Topic-map membership:
- emulation.md — 078 ALREADY present (line 53, "Peripheral co-sim" cluster). No change.
- esp32-s3.md — was an auto-stub with empty Knowledge Notes; 078 declares esp32-s3 as a topic, so added 078 under Knowledge Notes to keep navigation in sync. (Scoped to 078 only; did not curate the rest of the stub.)

The potentiometer cross-link left one-directional (078→pot); editing the pot note back is out of 078's scope.

## revisit

Ran /revisit --handoff (BACKWARD pass). Goal: find OLDER/sibling notes that should reference 078 but don't, and add inline links FROM them TO 078. Only genuine instantiate/depend connections — no inflation.

Discovery: re-read both topic maps (emulation.md, esp32-s3.md), grepped knowledge/ for existing inbound links (`rg -l "esp32-s3-adc1-channel-n-reads-gpio-n-plus-1"` → only 079, 083, and the two MOCs), then a broad grep (`rg -il "adc1|channel.*gpio|analogread|sar1_en_pad"`) to surface candidates that *should* link but don't. qmd indexes the main repo not this worktree, so grep is the oracle here.

Backward link added (1, genuine):
- [[the-esp32-s3-memory-map-and-peripheral-register-set-spans-...-register-banks-at-fixed-base-addresses]] (the memory-map/register reference, expert-tier). Its SENS/SAR-ADC1 table states the bare constant inline — "Channel→pin: ADC1 channel n = GPIO n+1 …" — but never linked to the note that explains *why* the emulator applies it. A reference table carrying a fact, pointing at the note that justifies it, is a textbook backward connection. Added BOTH: (a) inline `[[…|…]]` wiki-link wrapping the line-88 mapping text + a clause on the channel→pin boundary, and (b) a durable Relevant Notes entry. This is a NET-NEW link (the reference note had no 078 link in either direction).

Considered and rejected (recorded, not silently omitted):
- esp32-adc-attenuation-setting-determines-input-voltage-range — orthogonal axis (sets voltage *range* via the per-pin attenuator, not *which pin* a channel selects). 078 already links to it outbound as "the other half"; no backward dependency. Reject.
- esp32-adc2-unavailable-when-wifi-active — the ESP32-classic contrast layout 078 deliberately diverges from. 078 links to it outbound; it does not depend on the S3 channel offset. Reject.
- a-potentiometer-wired-as-voltage-divider-… — generic ATmega/A0 analogRead, 10-bit, no channel-index concept. Does not instantiate the S3 channel→GPIO mapping; linking would be inflation. (Connect already left 078→pot one-directional by design.) Reject.
- 079 (oneshot instant conversion) and 083 (shared-mcucore contract) — already link TO 078 (verified by the inbound grep); reciprocation complete, no action.

Outbound set of 078 untouched (connect owns that direction). No split warranted — 078 is already atomic and well-scoped. verify NOT run (one phase only).

## verify
(to be filled by verify phase)
