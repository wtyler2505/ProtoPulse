---
description: "ARM, RP2040 and Pico constraints and capabilities"
type: moc
topics:
  - "[[eda-fundamentals]]"
---

# eda-arm-constraints

RP2040, Raspberry Pi Pico constraints, PIO, and peripheral mapping.

## Notes
- [[rp2040-pio-state-machines-implement-custom-protocols-at-hardware-speed]] -- PIO state machines for sub-microsecond protocol timing
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] -- 12mA/50mA is strictest among maker MCUs
- [[rp2040-peripheral-pin-mapping-eliminates-most-conflicts-because-all-peripherals-remap]] -- all peripherals remappable
- [[pico-has-only-3-adc-channels-requiring-external-adc-for-analog-heavy-projects]] -- only 3 ADC channels
- [[pico-uf2-drag-and-drop-bootloader-eliminates-external-programmers]] -- UF2 bootloader is beginner-proof
- [[pico-vsys-accepts-1v8-to-5v5-enabling-direct-battery-operation]] -- buck-boost regulator accepts 1.8-5.5V
- [[pico-3v3-en-pin-disables-regulator-for-external-sleep-control]] -- regulator disable for hardware sleep
