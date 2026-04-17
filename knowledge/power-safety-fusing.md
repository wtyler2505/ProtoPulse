---
description: "Emergency stops, fusing strategies, and mains safety"
type: moc
topics:
  - "[[power-systems]]"
---

# power-safety-fusing

Fusing, emergency stops, DC contactors, and AC-mains safety capacitors.

## Notes
### Emergency stop + safety
- [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] — NC contacts ensure any failure mode = power cut
- [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]] — 12/24V control circuit operates 36V/100A contactor
- [[dc-contactor-must-have-magnetic-blowout-arc-suppression-or-contacts-will-weld-under-dc-load]] — DC arcs do not self-extinguish at zero-crossing
- [[twist-to-release-estop-prevents-accidental-restart-after-emergency-shutdown]] — latching mechanism requires deliberate rotation to re-engage
- [[estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal]] — aux contact lets firmware enter safe-state gracefully rather than brown out

### Fusing + main disconnect
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] — unprotected wire between battery and fuse must be minimized
- [[ac-switches-cannot-interrupt-dc-arcs-and-will-cause-fire-or-explosion-in-battery-systems]] — DC disconnect must have DC-specific interrupt rating
- [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]] — time-delay characteristics coordinate with motor inrush
- [[anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc]] — ANL marine fuse > automotive blade fuse above 60A DC

### AC-mains safety capacitors (Wave H)
- [[class-x2-capacitors-connect-across-live-and-neutral-where-short-circuit-failure-only-trips-a-fuse-not-shocks-a-user]] — X2 safety class: line-to-line position where shorted-failure mode is safe
- [[x-class-capacitors-filter-line-to-line-while-y-class-filter-line-to-ground-and-swapping-them-is-a-certification-violation]] — X vs Y distinction is safety-critical and regulatory, not interchangeable
- [[metallized-polypropylene-mkp-is-the-standard-x2-dielectric-because-it-combines-self-healing-with-high-pulse-voltage-tolerance]] — MKP dielectric is the de facto standard for AC-mains X2 caps
- [[x2-capacitor-rated-275v-ac-targets-230v-mains-with-headroom-for-peak-voltage-and-transients-not-just-rms]] — 275V AC rating is an RMS + transient budget, not a simple voltage ceiling
- [[ac-line-emi-filter-capacitors-degrade-silently-by-losing-capacitance-so-periodic-measurement-is-the-only-way-to-catch-a-worn-filter]] — X2 capacitor aging is invisible without periodic LCR measurement
- [[ac-line-emi-filters-are-bidirectional-protecting-the-device-from-grid-noise-and-preventing-device-noise-from-entering-the-grid]] — EMI filter has to block ingress AND egress, not just one direction
