---
description: "The OSEPP BTH-01 (and many HC-05 clones) are marketed as 'Bluetooth 4.0' but the actual silicon is Bluetooth 2.0+EDR using SPP only — no BLE, no iOS CoreBluetooth, no low-power sleep"
type: claim
source: "docs/parts/osepp-bluetooth-bth-01-hc05-compatible-uart-bt-module.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "osepp-bth-01"
  - "osepp-btm-01"
---

# HC-05 Bluetooth 4.0 box label is marketing fiction covering Bluetooth 2.0 EDR with SPP only

The OSEPP BTH-01 box says "Bluetooth 4.0" but the module spec sheet reveals Bluetooth 2.0+EDR with Serial Port Profile (SPP). This is a widespread labeling practice across Chinese Bluetooth module vendors -- the "4.0" refers to the packaging era, not the protocol version.

**Why this matters:**

1. **iOS connectivity:** Apple deprecated SPP in favor of BLE (CoreBluetooth). HC-05/HC-06 modules will NOT appear in iOS Bluetooth settings and cannot connect to iPhones natively. They work with Android (which still supports SPP) and desktop operating systems. For iOS projects, you need a genuine BLE module (HM-10, ESP32 BLE, nRF52).

2. **Power consumption:** BLE was designed for coin-cell-powered sensors sleeping 99% of the time. Classic Bluetooth 2.0 draws 30-40mA continuously when connected. Battery-powered projects expecting BLE-level efficiency will be disappointed.

3. **Data throughput:** SPP over Bluetooth 2.0+EDR achieves ~2-3 Mbps theoretical, which is more than adequate for serial data. BLE's throughput is lower (~1 Mbps) but with dramatically better power efficiency. For streaming sensor data, classic BT is actually fine if power isn't a constraint.

**ProtoPulse implications:**
- BOM validation should cross-check "Bluetooth 4.0" claims against actual module silicon
- If a project specifies "iOS compatible" or "BLE," the AI should flag HC-05/HC-06 as incompatible and suggest BLE alternatives
- The bench coach should proactively warn: "Despite the label, this module is classic Bluetooth, not BLE. It won't connect to iPhones."

---

Relevant Notes:
- [[all-procurement-data-is-ai-fabricated]] — marketing labels on module packaging are another form of untrustworthy procurement data
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] — buying an HC-05 for an iOS project wastes money and time

Topics:
- [[communication]]
- [[breadboard-intelligence]]
