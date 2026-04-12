---
description: Power supply components — batteries, regulators, breadboard power modules, and voltage converters
type: moc
---

# power

Everything related to supplying and regulating power.

## Parts

| Part | Input Voltage | Output Voltage | Max Current | Status | Qty |
|------|--------------|----------------|-------------|--------|-----|
| [[max17113-tft-lcd-pmic-generates-all-supply-rails-for-lcd-panels]] | 8-16.5V | AVDD/VGH/VGL/VCOM | — | needs-test | 1 |
| [[songle-srd-05vdc-relay-5v-coil-spdt-10a-250vac]] | 5V coil | 250VAC / 30VDC | 10A | needs-test | 2 |
| [[p30n06le-n-channel-logic-level-mosfet-60v-30a]] | N/A (switch) | 60V Vds | 30A | needs-test | 10 |
| [[elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable]] | 6.5-12V / USB | 3.3V or 5V | ~700mA | needs-test | 2 |
| [[kia7809a-9v-linear-voltage-regulator-1a]] | 11.5-35V | 9V | 1A | needs-test | 1 |
| [[power-distribution-board-fused-terminal-block-for-36v-system]] | 30-42V (36V nom) | 36V (fused outputs) | 100A input | needs-test | 1 |
| [[main-power-switch-anl-fuse-100a-disconnect-for-36v]] | 30-42V (36V nom) | 36V (switched) | 100A | needs-test | 1 |
| [[emergency-stop-nc-button-with-dc-contactor-for-36v]] | 12/24V (control) + 36V (power) | 36V (contactor output) | 250A contactor | needs-test | 1 |

## Voltage Architecture Reference

| Rail | Typical Use | Source |
|------|------------|--------|
| 3.3V | ESP modules, sensors | LDO regulator, board output |
| 5V | Arduino, servos, most modules | USB, buck converter |
| 7-12V | Arduino Vin, motor drivers | Battery pack, wall adapter |
| 12-36V | DC motors, brushless motors | Battery pack |

---

Categories:
- [[index]]
