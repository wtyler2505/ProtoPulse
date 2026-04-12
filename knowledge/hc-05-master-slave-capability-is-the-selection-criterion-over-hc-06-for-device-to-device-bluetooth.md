---
description: "HC-05 can initiate AND receive Bluetooth connections (master/slave), while HC-06 can only receive (slave-only) — this determines which module to use based on the communication topology"
type: claim
source: "docs/parts/osepp-bluetooth-bth-01-hc05-compatible-uart-bt-module.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "osepp-bth-01"
  - "osepp-btm-01"
  - "arduino-mega-2560"
---

# HC-05 master-slave capability is the selection criterion over HC-06 for device-to-device Bluetooth

The HC-05 and HC-06 are the two dominant Bluetooth serial modules in the maker ecosystem. They share the same Bluetooth 2.0+EDR silicon, the same SPP profile, the same UART interface, and similar pricing. The deciding factor is **connection role:**

| Module | Role | Can initiate? | Can receive? | Use when... |
|--------|------|---------------|--------------|-------------|
| HC-05 | Master OR Slave | Yes | Yes | Two Arduinos talking to each other, or scanning for devices |
| HC-06 | Slave only | No | Yes | Phone/PC connecting TO the Arduino (the common case) |

**Selection decision tree:**

1. **Phone/PC to Arduino?** Either module works (phone initiates, Arduino is slave). HC-06 is simpler and slightly cheaper.
2. **Arduino to Arduino?** At least one MUST be HC-05 (master). The other can be HC-05 (slave mode) or HC-06.
3. **Arduino scanning for BT devices?** Only HC-05 can scan. HC-06 has no inquiry capability.
4. **Multiple Arduinos in a mesh?** Not natively supported by either. Both are point-to-point SPP. For multi-device, consider ESP32 with BLE mesh.

**ProtoPulse implications:**
- BOM selection: When the AI detects a Bluetooth requirement, it should ask "Who initiates the connection?" to recommend HC-05 vs HC-06
- DRC: If two HC-06 modules appear in a project with a "device-to-device" communication spec, flag it: "HC-06 is slave-only; at least one device needs HC-05 for master mode"
- The bench coach should explain the master/slave concept in beginner terms: "Master = the one that 'calls.' Slave = the one that 'answers.' Your phone is always the master; your Arduino is the slave."

---

Relevant Notes:
- [[uart-dominates-wireless-modules-consuming-dedicated-serial-ports]] — both modules consume a UART; the role choice doesn't change the pin cost
- [[wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default]] — both modules are 3.3V logic despite 5V VCC tolerance

Topics:
- [[communication]]
- [[breadboard-intelligence]]
