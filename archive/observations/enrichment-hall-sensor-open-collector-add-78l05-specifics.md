---
observed_date: 2026-04-12
category: enrichment
target_note: "hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position"
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
---

# Enrichment: hall-sensor-open-collector add 78L05 specifics

The existing note mentions that the controller's onboard 78L05 provides the 5V Hall sensor power. The ZS-X11H source adds that:

1. The 78L05 is a single point of failure -- if it dies, Hall sensors lose power, commutation stops, motor won't run
2. At high input voltages (36-60V), the 78L05 dissipates significant heat: (Vin - 5V) * 30mA = up to 1.65W in a TO-92 package
3. The failure mode mimics other problems (dead motor, bad wiring, wrong Hall order) making diagnosis difficult
4. The 78L05 also powers the SC speed pulse output's pull-up, so speed feedback dies simultaneously

This strengthens the note's practical value by adding the specific failure mode and its non-obvious diagnostic signature.
