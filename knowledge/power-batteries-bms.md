---
description: "Battery chemistries, BMS, and low-voltage disconnects"
type: moc
topics:
  - "[[power-systems]]"
---

# power-batteries-bms

LiPo, Li-ion, lead-acid batteries, Battery Management Systems (BMS), charging profiles, and low-voltage disconnects.

## Notes
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] — 36V nominal is only a moment on the discharge curve; full range is 30-42V
- [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve]] — SOC linearization is adequate for fuel-gauge UI despite curve nonlinearity
- [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] — canonical divider for 10S Li-ion → 3V3 ADC
- [[salvaged-bms-has-unknown-thresholds-and-must-be-verified-before-trusting-with-project-safety]] — unknown overcurrent, undervoltage, thermal thresholds on salvaged BMS
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] — single-path BMS output means any trip cuts logic supply
- [[bms-overcurrent-protection-tripping-on-acceleration-is-a-software-problem-solved-by-ramp-rate-limiting-not-a-hardware-fault]] — firmware ramp control is the correct fix, not a hardware upgrade
- [[lead-acid-36v-pack-from-3-series-12v-batteries-requires-external-lvd-because-no-integrated-bms-exists]] — lead-acid chemistry has no native BMS; LVD is mandatory
- [[lvd-hysteresis-with-reconnect-voltage-above-cutoff-prevents-oscillation-at-the-threshold-boundary]] — hysteresis window prevents chattering at the disconnect threshold
- [[lithium-ion-charging-requires-cc-cv-profile-and-a-raw-power-supply-will-overcharge-cells]] — bench PSU skips CC phase; use purpose-built 10S charger
- [[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]] — chemistry choice cascades into charger, BMS, motor performance, and safety
- [[jst-ph-battery-connectors-have-no-universal-polarity-standard-so-reversed-connection-damages-charger-circuits]] — JST-PH polarity convention varies by vendor; verify with meter before connecting
- [[onboard-lipo-charging-via-mcp73831-makes-dev-board-battery-deployment-ready-without-external-circuits]] — MCP73831 integration on dev boards eliminates a discrete charger IC
