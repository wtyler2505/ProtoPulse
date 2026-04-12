---
description: "Cheap and effective adjustable step-down voltage regulator module — 4.5-40V input, 1.25-37V output, 3A max. Turn the potentiometer to set output voltage. The workhorse for powering 5V/3.3V logic from battery packs"
topics: ["[[power]]"]
status: needs-test
quantity: 2
voltage: [4.5, 40]
interfaces: []
manufacturer: "Generic (based on TI LM2596)"
part_number: "LM2596"
pinout: |
  IN+  → Input positive (4.5-40V)
  IN-  → Input negative (GND)
  OUT+ → Output positive (adjustable via pot)
  OUT- → Output negative (GND)
compatible_with: ["[[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]"]
used_in: []
warnings: ["ALWAYS set output voltage BEFORE connecting load — default output may be too high", "3A is the ABSOLUTE max — derate to 2A for continuous use without heatsink", "Input must be at least 2V higher than desired output (dropout voltage)", "The pot is fragile — don't force it past its stops"]
datasheet_url: ""
---

# LM2596 Adjustable Buck Converter Module 3A Step-Down

The LM2596 module is the default "just give me 5V from this battery" solution. It's a switching buck converter, so it's far more efficient than linear regulators (no massive heat waste). You get an input range of 4.5-40V, adjustable output from 1.25-37V, and up to 3A output current. The module comes pre-built on a small PCB with the inductor, capacitors, diode, and adjustment potentiometer all on board — just connect power in, twist the pot to set your voltage, and connect your load.

## Specifications

| Parameter | Value |
|-----------|-------|
| Input Voltage | 4.5V - 40V DC |
| Output Voltage | 1.25V - 37V DC (adjustable) |
| Output Current | 3A max (derate to 2A without heatsink) |
| Switching Frequency | 150 kHz |
| Efficiency | Up to 92% (load and Vin/Vout dependent) |
| Dropout Voltage | ~2V minimum (Vin must be >= Vout + 2V) |
| Output Ripple | ~30mV typical (can be higher under heavy load) |
| Quiescent Current | ~5mA |
| Operating Temp | -40C to +85C |
| Module Size | ~43mm x 21mm x 14mm (typical) |

## How to Set Output Voltage

1. **Connect input power** (battery, power supply, etc.) to IN+ and IN-.
2. **Do NOT connect your load yet.**
3. **Measure output voltage** with a multimeter on OUT+ and OUT-.
4. **Turn the potentiometer** — clockwise typically increases voltage, counter-clockwise decreases. It takes many turns (20+ full turns on most modules) to sweep the full range.
5. **Set your target voltage** — 5.0V for Arduino/ESP8266, 3.3V for ESP32/bare sensors.
6. **Now connect your load** and verify the voltage holds steady under load.

The pot is a multi-turn trimmer. It takes patience. Don't force it past the mechanical stops at either end or you'll break it.

## Common Configurations

| Use Case | Input Source | Output Setting | Current Budget |
|----------|-------------|---------------|----------------|
| Power Arduino from 36V battery | [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] (30-42V) | 7-9V to Arduino Vin | Up to 2A |
| Power Arduino from 36V (via 5V) | [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] (30-42V) | 5V to Arduino 5V pin | Up to 2A |
| Power ESP8266 from 36V battery | [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] (30-42V) | 3.3V to ESP8266 3V3 | Up to 1A |
| Power ESP32 from 12V | 12V adapter/battery | 3.3V or 5V (via Vin) | Up to 2A |
| General 5V rail | Any 7-40V source | 5.0V | Up to 2A continuous |
| General 3.3V rail | Any 5.5-40V source | 3.3V | Up to 2A continuous |

## Efficiency Considerations

This is a switching regulator, not a linear one. The difference matters:

- **Linear regulator (e.g., LM7805):** Excess voltage is burned as heat. 36V in, 5V out at 1A = 31W wasted as heat. That's a small space heater.
- **LM2596 (switching):** Converts voltage efficiently. 36V in, 5V out at 1A = ~3-4W wasted. Much better.

Efficiency varies with load and voltage differential. Expect 80-92% efficiency in typical use cases. Worst case is very low load current or very high voltage differential.

## Module Variants

These modules come in several flavors. The adjustable version is the most versatile:

| Variant | Output | Adjustment | Use When |
|---------|--------|-----------|----------|
| LM2596 ADJ | 1.25-37V | Potentiometer | You need flexibility (this is the one you want) |
| LM2596-5.0 | Fixed 5V | None | Dedicated 5V rail, slightly more stable |
| LM2596-3.3 | Fixed 3.3V | None | Dedicated 3.3V rail |
| LM2596-12 | Fixed 12V | None | Dedicated 12V rail |

## Wiring

```
        ┌─────────────────────┐
  IN+ ──┤ +IN          OUT+ ├── Load +
        │     LM2596         │
  IN- ──┤ -IN          OUT- ├── Load -
        │        [POT]       │
        └─────────────────────┘
```

- **IN+ / IN-**: Input from battery or power supply. Polarity matters — reverse polarity will kill the module.
- **OUT+ / OUT-**: Regulated output to your load.
- **POT**: Multi-turn potentiometer on the module PCB for voltage adjustment.

Keep input and output wires short. If running long wires from a battery, add a 100uF electrolytic cap at IN+ to IN- close to the module.

## Warnings and Gotchas

- **No reverse polarity protection** on most modules. Connecting IN+ and IN- backwards will instantly destroy the LM2596 IC and possibly the diode. Some modules add a protection diode, most don't. If you're worried, add a series diode or P-MOSFET on the input.
- **The potentiometer defaults to an unknown voltage.** New modules from the factory could be set anywhere in the 1.25-37V range. ALWAYS measure output before connecting your precious microcontroller.
- **Output ripple** is ~30mV but can be worse under heavy load or with a high input-to-output ratio. If you're powering sensitive analog circuits, add a secondary LC filter or use a separate LDO after the LM2596.
- **Heat at high current**: At 3A with a large voltage differential, the LM2596 IC and the Schottky diode on the module will get warm. The PCB acts as a basic heatsink. For sustained 2A+ operation, ensure airflow or add a small heatsink.
- **Counterfeit LM2596 chips** are extremely common on cheap modules. They may work fine at low current but fail or oscillate under heavy load. If you need reliable 3A, test it at full load before deploying.

## Dual-Unit Configuration for 36V Rover

In the hoverboard rover, two LM2596 modules handle all logic power, fed directly from the 36V battery:

| Unit | Input | Output | Feeds | Why Not Cascade? |
|------|-------|--------|-------|-----------------|
| LM2596 #1 | 36V (30-42V) | **12V** | Arduino Mega Vin, fans, relays | Separate from 5V rail for noise isolation |
| LM2596 #2 | 36V (30-42V) | **5V** | ESP32 Vin, level shifters, 5V sensors | Direct from 36V, not from 12V tier |

Both units run directly from the battery rather than cascading (36V -> 12V -> 5V) because:
1. Cascading means a single point of failure takes down both rails
2. The 12V rail has motor-adjacent noise from fans/relays
3. Each LM2596 handles its own voltage differential independently

## Thermal Dissipation Calculations

At specific loads expected in the rover build:

| Unit | Vin | Vout | Iout | Pin (W) | Pout (W) | Ploss (W) | Efficiency | Heatsink? |
|------|-----|------|------|---------|----------|-----------|-----------|-----------|
| #1 (12V) | 36V | 12V | 0.5A | 6.5W | 6.0W | 0.5W | ~92% | No — low load |
| #1 (12V) | 36V | 12V | 2.0A | 27.6W | 24.0W | 3.6W | ~87% | **Yes** — add heatsink |
| #2 (5V) | 36V | 5V | 0.3A | 1.7W | 1.5W | 0.2W | ~88% | No — low load |
| #2 (5V) | 36V | 5V | 1.0A | 6.0W | 5.0W | 1.0W | ~83% | Recommended |
| #2 (5V) | 36V | 5V | 2.0A | 12.8W | 10.0W | 2.8W | ~78% | **Yes** — required |

**Formula:** Ploss = (Vin x Iout) - (Vout x Iout), adjusted by switching efficiency (~85-92%).

At the typical rover electronics load (~0.5A on 12V, ~0.3A on 5V), neither unit needs a heatsink. But if you add power-hungry 12V accessories (fans, LED strips) or multiple 5V sensors, heatsink accordingly.

The large voltage differential (36V -> 5V = 31V drop) reduces efficiency on Unit #2 compared to Unit #1. This is inherent to switching regulators — larger differential = more switching losses. At 2A load the efficiency drops to ~78%, meaning nearly 3W of heat. Ensure airflow or mount to a metal chassis for heat sinking.

## Project Role: 36V Rover Power Regulation

In the hoverboard rover project, LM2596 modules serve as the primary voltage regulation stage between the [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] (30-42V) and the logic subsystems. Two modules are needed:

| Module | Input | Output | Feeds |
|--------|-------|--------|-------|
| LM2596 #1 | 36V battery (30-42V) | 12V | Fans, relays, 12V accessories |
| LM2596 #2 | 36V battery (30-42V) | 5V | ESP32 Vin, level shifters, 5V sensors |

The ESP32's onboard 3.3V regulator handles the final step-down from 5V to 3.3V for the MCU core.

**Critical:** Set the output voltage BEFORE connecting to the ESP32 or any logic. Verify with a multimeter. A module defaulting to 20V+ output will destroy your microcontroller instantly.

See [[wiring-36v-battery-power-distribution-4-tier-system]] for the complete power distribution architecture.

## Testing Protocol

Before using in a project:

1. Connect to a bench supply or battery at your expected input voltage.
2. With NO load connected, measure output voltage and adjust pot to target.
3. Connect a test load (resistor or electronic load) and verify voltage regulation holds.
4. Test at expected max current draw — verify voltage doesn't sag more than 0.1V.
5. Feel the module for excessive heat after 5 minutes at load.

---

Related Parts:
- [[hoverboard-10s-lithium-ion-battery-pack-36v-with-bms]] — primary high-voltage input source for rover projects
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — common load at 5V
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — common load at 3.3V

Categories:
- [[power]]
