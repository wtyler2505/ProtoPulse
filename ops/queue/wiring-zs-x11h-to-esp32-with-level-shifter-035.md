---
claim: "ESP32 dual-core architecture separates real-time motor control from wireless communication by pinning each to its own core eliminating timing interference"
classification: closed
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
semantic_neighbor: null
---

# Claim 035: ESP32 dual-core architecture separates real-time motor control from wireless communication by pinning each to its own core eliminating timing interference

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 264-268)

## Reduce Notes

Extracted from wiring-zs-x11h-to-esp32-with-level-shifter. This is a CLOSED claim.

Rationale: The vault has notes on ESP32 GPIO safety, ADC behavior, deep sleep, and specific pin restrictions but NOTHING on the dual-core architectural decision. For the rover, this is a first-class design choice: WiFi/BLE stacks have their own core affinity and can stall a single-threaded loop, which is catastrophic for motor PWM timing. Pinning motor control to Core 1 and networking to Core 0 (via FreeRTOS xTaskCreatePinnedToCore) turns a software concurrency problem into a hardware partition. This claim belongs in microcontrollers topic and is what actually distinguishes ESP32 from Mega for the rover use case beyond "has WiFi."

Semantic neighbor: None found. No dual-core or task-partitioning notes exist yet in the vault.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
