---
description: "Complete 36V power distribution for hoverboard rover — 4-tier regulation (36V/12V/5V/3.3V), emergency stop, BMS integration, voltage monitoring via ADC"
topics: ["[[wiring-guides]]"]
parts_involved: ["[[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]", "[[lm2596-adjustable-buck-converter-module-3a-step-down]]", "[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]"]
status: needs-test
quantity: 0
voltage: [3.3, 5, 12, 36]
interfaces: [Analog]
---

# Wiring 36V Battery Power Distribution — 4-Tier System

This guide covers the complete power distribution for a 4WD hoverboard rover. Four voltage tiers serve different subsystems, all sourced from a single 36V battery pack. The design prioritizes safety (emergency stop, low-voltage disconnect, fusing at every tier) and clean power (separate regulation for motor power vs. logic power).

## The 4 Voltage Tiers

| Tier | Voltage | Source | Loads | Peak Current |
|------|---------|--------|-------|-------------|
| 1 — Motor | 36V (30-42V) | Battery direct | 4x ZS-X11H motor controllers | 60A (4 x 15A) |
| 2 — Intermediate | 12V | LM2596 or DC-DC converter from 36V | Fans, relays, high-power LEDs, 12V accessories | 3-5A |
| 3 — Logic | 5V | LM2596 from 36V (or from 12V tier) | ESP32 (via Vin), level shifters, servo power, 5V sensors | 2-3A |
| 4 — MCU | 3.3V | ESP32 onboard regulator (from 5V Vin) | ESP32 core, 3.3V sensors, 3.3V I/O | 500mA |

## Battery Options

### Option 1: 10S Li-Ion Pack (Recommended)

The [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] is purpose-built for this application.

| Parameter | Value |
|-----------|-------|
| Chemistry | Lithium-Ion (18650 cells) |
| Configuration | 10S (10 series) — 2P, 3P, or 4P depending on capacity |
| Nominal Voltage | 36V (3.6V x 10) |
| Full Charge | 42V (4.2V x 10) |
| Low Voltage Cutoff | 30V (3.0V x 10) — BMS enforced |
| Typical Capacity | 4-6 Ah (2P-3P pack) |
| BMS | Integrated — handles cell balancing, overcurrent, over/under voltage |
| Charge Voltage | 42V via standard hoverboard charger |
| Weight | ~2-3 kg |

**Pros:** Compact, lightweight, high energy density, BMS included.
**Cons:** More expensive, requires proper lithium charger, fire risk if damaged.

### Option 2: 3x 12V Lead Acid in Series

| Parameter | Value |
|-----------|-------|
| Chemistry | Sealed Lead Acid (SLA) or AGM |
| Configuration | 3 batteries in series (12V + 12V + 12V = 36V) |
| Nominal Voltage | 36V (12V x 3) |
| Full Charge | 41.4V (13.8V x 3) |
| Low Voltage Cutoff | 31.5V (10.5V x 3) |
| Typical Capacity | 7-12 Ah |
| BMS | None — must add external LVD (Low Voltage Disconnect) |
| Charge Voltage | 41.4V (3-bank charger or series charger) |
| Weight | ~6-9 kg |

**Pros:** Cheap, rugged, tolerant of abuse, readily available.
**Cons:** Heavy, lower energy density, no built-in BMS, sulfation if stored discharged.

### Option 3: LiFePO4 (Lithium Iron Phosphate)

| Parameter | Value |
|-----------|-------|
| Chemistry | LiFePO4 |
| Configuration | 12S (12 series, 3.2V nominal per cell) |
| Nominal Voltage | 38.4V (close enough to 36V nominal) |
| Full Charge | 43.8V (3.65V x 12) |
| Low Voltage Cutoff | 30V (2.5V x 12) |
| Typical Capacity | 6-20 Ah |
| BMS | Required — most packs include one |
| Weight | Between Li-Ion and Lead Acid |

**Pros:** Safest lithium chemistry (no thermal runaway), longest cycle life (2000+ cycles), fast charge capable.
**Cons:** Higher voltage nominal (38.4V vs 36V — check ZS-X11H compatibility), heavier than Li-Ion, more expensive per Wh.

## Power Distribution Architecture

```
                         ┌─────────────────────────┐
                         │    36V BATTERY PACK      │
                         │    (10S Li-Ion + BMS)     │
                         └──────────┬────┬──────────┘
                                    │    │
                              ┌─────┘    └─────┐
                              │                │
                         [E-STOP SWITCH]       │
                              │                │
                         [40A MAIN FUSE]       │
                              │                │
                    ┌─────────┴────────┐       │
                    │  MAIN BUS (+36V)  │       │
                    │                  │       │
              ┌─────┼─────┬─────┬─────┤       │
              │     │     │     │     │       │
         [10A][10A][10A][10A] [5A]    │
          MC1  MC2  MC3  MC4  AUX     │
                                │      │
                          ┌─────┴─────┐│
                          │ LM2596 #1 ││
                          │ 36V → 12V ││
                          │ (5A rated)││
                          └─────┬─────┘│
                                │      │
                          ┌─────┴─────┐│
                          │  12V BUS  ││
                          │           ││
                     ┌────┼────┐      ││
                     │    │    │      ││
                   Fans Relay LEDs    ││
                                      ││
                          ┌───────────┘│
                          │            │
                    ┌─────┴─────┐     │
                    │ LM2596 #2 │     │
                    │ 36V → 5V  │     │
                    │ (3A rated)│     │
                    └─────┬─────┘     │
                          │           │
                    ┌─────┴─────┐     │
                    │   5V BUS  │     │
                    │           │     │
               ┌────┼────┬─────┤     │
               │    │    │     │     │
            ESP32  Lvl  Servo  5V    │
            (Vin)  Shft  Pwr  Sens   │
                    │                 │
              ┌─────┴─────┐          │
              │  3.3V BUS │          │
              │ (ESP32    │          │
              │  onboard) │          │
              └───────────┘          │
                                     │
              ALL GROUNDS ───────────┘
              (STAR TOPOLOGY)
```

## Emergency Stop Circuit

The emergency stop (E-STOP) is a normally-closed (NC) pushbutton or toggle switch in the main positive power line. When pressed, it breaks the circuit and all motors stop immediately.

```
    Battery + ──→ [E-STOP (NC)] ──→ [40A Fuse] ──→ Main Bus +

    E-STOP is a big red mushroom button — clearly visible, easy to hit
```

### E-STOP Requirements

| Parameter | Specification |
|-----------|--------------|
| Type | Normally Closed (NC), twist-to-release or key-release |
| Current Rating | 40A minimum (total motor draw) |
| Voltage Rating | 60V DC minimum |
| Mounting | Panel mount, accessible from outside chassis |
| Response | Mechanical — instant, no software dependency |

**The E-STOP must be hardware, not software.** A software emergency stop depends on the MCU working correctly. A hardware switch in the power line works even if the MCU crashes, the firmware hangs, or WiFi drops.

### Optional: E-STOP Signal to MCU

In addition to breaking power, the E-STOP can signal the ESP32 so firmware knows the stop occurred:

```
    E-STOP aux contact ──→ 10K ──→ 3.3V
                               └──→ ESP32 GPIO (interrupt)
                                    │
                               10K to GND (pull-down when E-STOP open)
```

This lets the firmware enter a safe state, save logs, and require a deliberate restart rather than auto-resuming when E-STOP is released.

## Low Voltage Disconnect (LVD)

The BMS in a Li-Ion pack handles low-voltage cutoff. But for lead acid batteries (no BMS) or as a secondary safety layer, add an LVD module:

| Parameter | Setting |
|-----------|---------|
| LVD Cutoff Voltage | 30V (3.0V per cell for Li-Ion, 10.5V per battery for SLA) |
| LVD Reconnect Voltage | 33V (hysteresis prevents oscillation) |
| Current Rating | Must exceed total system draw (40A+ for motor bus) |

**Budget option:** An automotive low-voltage cutoff relay module rated for 36V/40A. Connect between battery and main bus.

## BMS Integration (Li-Ion Pack)

The [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] has an integrated BMS that handles:

1. **Cell balancing** — keeps all 10 cells at equal voltage during charge
2. **Overcurrent protection** — trips at ~30-40A (varies by BMS)
3. **Overvoltage protection** — stops charging above 42V
4. **Undervoltage protection** — cuts output below ~30V
5. **Short circuit protection** — instant cutoff on dead short
6. **Temperature monitoring** — some BMS have thermistors on the cells

### BMS Wiring

```
    Charger (42V) ──→ BMS Charge Port ──→ BMS ──→ Cells
    Cells ──→ BMS ──→ Discharge Port ──→ E-STOP ──→ Main Bus

    BMS balance leads: thin wires connected to each cell junction
    DO NOT disconnect balance leads — BMS cannot balance without them
```

**Critical:** The BMS discharge port is your main power output. All motor and logic power comes through this port. If the BMS trips (overcurrent, undervoltage), ALL power is cut — including the ESP32. This is intentional safety behavior.

### Charge Port Wiring

```
    42V Charger ──→ [Charge Connector] ──→ BMS C+ / C-
                    (XT60 or barrel jack)

    NEVER charge while motors are running
    NEVER bypass the BMS for charging
    Use the original hoverboard charger or a compatible 42V/2A charger
```

## ADC Voltage Monitoring

The ESP32 can monitor battery voltage through a voltage divider connected to an ADC pin. This gives you real-time battery level, low-voltage warnings, and data logging.

### Voltage Divider for 42V → 3.3V

```
    Battery + ──── 100K ──┬── 10K ──── GND
                          │
                    ESP32 GPIO39 (ADC, input-only)

    Vout = 42V x (10K / (100K + 10K)) = 3.82V  ← TOO HIGH for ESP32!
```

Adjust for max 3.0V at full charge (42V):

```
    Battery + ──── 130K ──┬── 10K ──── GND
                          │
                    ESP32 GPIO39 (ADC)

    At 42V: Vout = 42 x (10/140) = 3.0V ✓
    At 36V: Vout = 36 x (10/140) = 2.57V
    At 30V: Vout = 30 x (10/140) = 2.14V (BMS cutoff)
```

### ADC Calibration Code

```cpp
const int BATTERY_PIN = 39;      // GPIO39 (VP) — input-only ADC
const float DIVIDER_RATIO = 14.0; // (130K + 10K) / 10K
const float ADC_REF = 3.3;
const int ADC_MAX = 4095;        // 12-bit ADC

float readBatteryVoltage() {
  int raw = analogRead(BATTERY_PIN);
  float voltage = (raw / (float)ADC_MAX) * ADC_REF * DIVIDER_RATIO;
  return voltage;
}

float batteryPercent(float voltage) {
  // Linear approximation for Li-Ion 10S pack
  // 42V = 100%, 30V = 0% (BMS cutoff)
  float percent = ((voltage - 30.0) / (42.0 - 30.0)) * 100.0;
  return constrain(percent, 0.0, 100.0);
}

void checkBattery() {
  float v = readBatteryVoltage();
  float pct = batteryPercent(v);

  Serial.printf("Battery: %.1fV (%.0f%%)\n", v, pct);

  if (v < 32.0) {
    Serial.println("WARNING: Battery low! Reduce speed or charge soon.");
  }
  if (v < 30.5) {
    Serial.println("CRITICAL: Battery near cutoff! Stopping motors.");
    emergencyStop();
  }
}
```

**ESP32 ADC accuracy note:** The ESP32's ADC is not precision-grade. Expect +/- 0.5V accuracy without calibration. For better accuracy, use `esp_adc_cal_characterize()` to apply factory calibration, or add an external ADS1115 I2C ADC for 16-bit precision.

## ANL Fuse and DC Contactor Specifications

For a 4WD rover with 60A+ peak draw, standard automotive blade fuses may be undersized for the main bus. Consider these industrial-grade options:

### Main Bus Fuse: ANL Fuse

| Parameter | Specification |
|-----------|--------------|
| Type | ANL (marine/industrial) — slow-blow |
| Rating | **100A** (allows 60A continuous with margin for inrush) |
| Voltage | 32V DC minimum (most ANL fuses rated 125V DC) |
| Blow characteristic | Slow-blow — tolerates motor startup surges without nuisance trips |
| Mounting | Bolt-down fuse holder (ANL fuse block) |
| Wire size | 4 AWG to fuse block |

**Why 100A slow-blow:** Motor startup inrush can momentarily exceed 60A across all 4 motors. A fast-blow 60A fuse would nuisance-trip on startup. The 100A slow-blow handles the inrush but still protects against sustained overcurrent and shorts.

### DC Contactor: Albright SW200

For a proper emergency stop that can handle 60A+ without arcing:

| Parameter | Specification |
|-----------|--------------|
| Model | Albright SW200 (or equivalent) |
| Rating | 200A continuous, 36-48V DC |
| Coil voltage | 12V or 24V DC (powered from the 12V tier) |
| Contact type | Single-pole, normally open (NO) |
| Arc suppression | Built-in — designed for DC switching at high current |
| Weight | ~400g |

The Albright SW200 replaces the E-STOP switch for high-current applications. The E-STOP button activates/deactivates the contactor coil (at 12V, low current) rather than switching 60A directly. This is safer, allows for remote/software-triggered shutdown, and prevents contact welding.

```
Battery + --> [ANL 100A Fuse] --> [SW200 Contactor] --> Main Bus +
                                       |
                                  Coil (+12V)
                                       |
                                  [E-STOP Switch (NC)]
                                       |
                                  12V Rail (from LM2596 #1)
```

## Fusing Strategy

Every branch of the power distribution gets its own fuse. This prevents a fault in one subsystem from taking down the entire rover.

| Location | Fuse Rating | Type | Protects |
|----------|------------|------|----------|
| Main (after E-STOP) | 40A | Automotive blade | Battery, wiring, BMS |
| MC1 branch | 10A | Inline blade | MC1 controller and motor |
| MC2 branch | 10A | Inline blade | MC2 controller and motor |
| MC3 branch | 10A | Inline blade | MC3 controller and motor |
| MC4 branch | 10A | Inline blade | MC4 controller and motor |
| 12V branch (LM2596 #1 input) | 5A | Inline blade | 12V subsystem |
| 5V branch (LM2596 #2 input) | 3A | Inline or glass | 5V logic subsystem |

**Why individual motor fuses:** If one motor stalls or shorts, its 10A fuse blows instead of the 40A main fuse. The other 3 motors keep running, and you can limp home.

## Capacitor Placement

| Location | Capacitor | Purpose |
|----------|----------|---------|
| Each ZS-X11H V+/V- | 470uF 63V electrolytic | Absorb motor inductive flyback spikes |
| LM2596 #1 input | 100uF 63V electrolytic | Smooth input for 12V converter |
| LM2596 #2 input | 100uF 63V electrolytic | Smooth input for 5V converter |
| LM2596 #2 output (5V) | 100uF 16V electrolytic + 100nF ceramic | Clean 5V for ESP32 and logic |
| ESP32 Vin | 10uF ceramic | Prevent WiFi TX brownouts |

## Wire Gauge Reference

| Circuit | Voltage | Max Current | Minimum Gauge | Recommended |
|---------|---------|------------|--------------|-------------|
| Battery to main bus | 36V | 40A+ | 10 AWG | 8 AWG |
| Main bus to each MC | 36V | 15A | 14 AWG | 12 AWG |
| MC to motor phases | 36V | 15A | 14 AWG | 14 AWG |
| Battery to LM2596 | 36V | 3A | 18 AWG | 16 AWG |
| LM2596 to ESP32 | 5V | 1A | 22 AWG | 20 AWG |
| Signal wires | 3.3-5V | < 20mA | 24 AWG | 22 AWG |
| GND bus | 0V | 40A+ | 10 AWG | 8 AWG |

## Ground Topology — Star Grounding

**All grounds meet at ONE point** (the ground bus bar). This prevents ground loops where motor current flowing through shared ground wires creates voltage offsets that confuse logic signals.

```
    Battery GND ──→ GROUND BUS BAR ←── MC1 GND
                         ↑           ←── MC2 GND
                    ESP32 GND        ←── MC3 GND
                    LM2596 GND       ←── MC4 GND
                    Sensor GND       ←── Level Shifter GND
```

**Never daisy-chain grounds** (MC1 GND → MC2 GND → MC3 GND → ...). When MC1 draws 15A, the voltage drop across the wire between MC1 and MC2 shifts MC2's ground reference, causing erratic behavior.

---

Related Parts:
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — primary battery
- [[lm2596-adjustable-buck-converter-module-3a-step-down]] — voltage regulation (need 2: one for 12V, one for 5V)
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — motor controllers (need 4)
- [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]] — the signal wiring this power system feeds

Categories:
- [[wiring-guides]]
