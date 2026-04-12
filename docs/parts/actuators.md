---
description: Motors, servos, steppers, and relays — anything that moves or switches in the physical world
type: moc
---

# actuators

Components that create physical motion or switch circuits.

## Parts

| Part | Type | Voltage | Drive Method | Status | Qty |
|------|------|---------|-------------|--------|-----|
| [[28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver]] | Stepper | 5V | ULN2003 step sequence | needs-test | 1 |
| [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]] | Motor Driver IC | 5-46V | PWM + direction | needs-test | 2 |
| [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] | BLDC Hub Motor | 36V | 3-phase + Hall | needs-test | 2 |
| [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] | BLDC Controller | 6-60V | PWM + Hall + 3-phase | verified | 4 |
| [[f130s-small-dc-motor-3-5v-130-can-size]] | Brushed DC Motor | 3-5V | Direct DC / H-bridge | needs-test | 3 |
| [[osepp-ls-955cr-continuous-rotation-servo-360-degree]] | Continuous Servo | 4.8-6V | PWM (1-2ms pulse) | needs-test | 1 |
| [[osepp-analog-micro-servo-position-4p8-6v]] | Position Servo (Micro) | 4.8-6V | PWM (1-2ms pulse) | needs-test | 1 |
| [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]] | Motor Shield | 4.5-13.5V | PWM + direction (MOSFET) | needs-test | 1 |
| [[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]] | Motor+Servo Shield | 5-46V | PWM + direction + servo | needs-test | 1 |
| [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]] | Motor Shield | 4.5-25V | PWM + shift register | needs-test | 4 |
| [[l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes]] | Motor Driver IC | 4.5-36V | PWM + direction | needs-test | 2 |
| [[uln2003apg-stepper-driver-board-for-28byj-48-at-5v]] | Stepper Driver | 5V | Darlington sink | needs-test | 1 |
| [[songle-srd-05vdc-relay-5v-coil-spdt-10a-250vac]] | Relay | 5V coil | Digital via transistor/MOSFET | needs-test | 2 |
| [[active-piezo-buzzer-5v-2p5khz-built-in-oscillator]] | Piezo Buzzer (Active) | 5V | DC GPIO (fixed 2.5kHz tone) | needs-test | 1 |
| [[passive-piezo-buzzer-3-5v-pwm-driven-tone-generator]] | Piezo Buzzer (Passive) | 3-5V | PWM (variable frequency) | needs-test | 1 |

## Quick Reference

| Actuator Type | Drive IC | Control Signal | Typical Voltage |
|--------------|----------|---------------|-----------------|
| DC motor | L293D, TB6612 | PWM + direction | 5-12V |
| Stepper (28BYJ-48) | ULN2003 | Step sequence | 5V |
| Servo (standard) | Direct | PWM (1-2ms pulse) | 4.8-6V |
| Servo (continuous) | Direct | PWM (center = stop) | 4.8-6V |
| Relay | Transistor/MOSFET | Digital HIGH/LOW | 5V coil |
| Brushless motor | ESC/ZS-X11H | PWM + Hall sensors | 12-60V |
| Buzzer (active) | Direct | DC voltage on/off | 5V |
| Buzzer (passive) | Direct | PWM (tone() / ledcWriteTone) | 3-5V |

---

Categories:
- [[index]]
