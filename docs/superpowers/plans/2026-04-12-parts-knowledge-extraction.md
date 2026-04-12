# Parts Knowledge Extraction — Full Inventory Processing Plan

> **For agentic workers:** This is a **knowledge processing plan**, not a code implementation plan. Each task is a batch invocation of `/extract [filepath]`. Execute sequentially — shared vault state makes parallel extraction unsafe. Use `/extract` skill directly; do NOT write code.

**Goal:** Extract structured knowledge notes from all 138 parts documentation files in `docs/parts/` into the Ars Contexta vault (`knowledge/`), enriching the `[[eda-fundamentals]]` topic map and creating new hardware domain topic maps.

**Architecture:** Sequential wave-based extraction. Files grouped by domain category (MCUs first, then sensors, motors, etc.) to maximize semantic dedup effectiveness — extracting similar parts back-to-back means the dedup engine catches repeated domain patterns (I2C pull-ups, level shifting, active-low traps) on the second occurrence instead of the fifteenth. Queue drain checkpoints between waves prevent `queue_max_depth: 150` overflow.

**Tech Stack:** Ars Contexta `/extract` skill, `mcp__qmd__vector_search` for semantic dedup, `knowledge/` vault (154 existing notes, 20 topic maps)

---

## Critical Prerequisites

### Vault Config (read-only, already set)
- `ops/config.yaml` — `pipeline_batch_size: 5`, `queue_max_depth: 150`, `auto_connect_on_extract: true`
- `ops/derivation-manifest.md` — vocabulary: notes=knowledge, reduce=extract, reflect=connect
- `ops/queue/queue.json` — current queue state (3 tasks, all done)

### Existing Topic Maps in `knowledge/`
Only ONE hardware topic map exists: `knowledge/eda-fundamentals.md` (12 linked notes). There are NO topic maps for: sensors, microcontrollers, actuators, displays, power, shields, communication, passives, input-devices, wiring-guides, or unidentified-parts.

**This is the biggest structural risk.** Every parts file has `topics: ["[[sensors]]"]` etc. in its frontmatter — those point to `docs/parts/sensors.md`, not to anything in `knowledge/`. Extracted notes need `knowledge/`-level topic maps to link to, or every note will either:
- Route everything to `[[eda-fundamentals]]` (overloading one MOC)
- Create dangling `[[sensors]]` links (vault health violation)

---

## Wave 0: Create Hardware Topic Maps (PREREQUISITE)

**Purpose:** Create stub topic maps in `knowledge/` for each hardware domain category BEFORE any extraction begins. This gives `/extract` proper routing targets for extracted claims.

**Files to create (10 new topic maps):**

| Topic Map | File | Parent Topics |
|-----------|------|---------------|
| Microcontrollers | `knowledge/microcontrollers.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Sensors | `knowledge/sensors.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Actuators & Motors | `knowledge/actuators.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Displays & LEDs | `knowledge/displays.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Power Systems | `knowledge/power-systems.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Shields & Breakouts | `knowledge/shields.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Communication Modules | `knowledge/communication.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Passive Components | `knowledge/passives.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Input Devices | `knowledge/input-devices.md` | `[[eda-fundamentals]]`, `[[index]]` |
| Wiring & Integration | `knowledge/wiring-integration.md` | `[[eda-fundamentals]]`, `[[breadboard-intelligence]]` |

**Template for each stub:**
```markdown
---
description: "[Domain] knowledge — specs, gotchas, selection criteria, and design patterns for [domain]"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# [domain-name]

[One sentence describing what this topic map covers.]

## Knowledge Notes
(populated by /extract)

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
```

- [ ] **Step 1:** Create all 10 topic map stubs in `knowledge/`
- [ ] **Step 2:** Update `knowledge/eda-fundamentals.md` to link to all 10 new topic maps under a "## Hardware Domain Maps" section
- [ ] **Step 3:** Update `knowledge/index.md` to reference the new topic maps
- [ ] **Step 4:** Run `/arscontexta:health` to verify zero dangling links from the new stubs

---

## Extraction Strategy

### Processing Order Rationale
1. **MOC/index files first** (Wave A) — low yield but establishes category context in the vault
2. **Microcontrollers** (Wave B) — foundation parts that everything else connects to; establishes MCU-specific claims early so sensors/motors dedup against them
3. **Sensors** (Wave C) — large group with heavy I2C/protocol overlap; doing them together maximizes dedup
4. **Actuators + Power** (Wave D) — the OmniTrek rover domain; motor control + power distribution are deeply linked
5. **Displays + Passives + Input + Shields + Misc** (Wave E) — diverse parts, moderate density
6. **Wiring Guides** (Wave F) — richest files with the most integration insights; saved for last so all component claims are already in the vault for dedup
7. **Unidentified Parts** (Wave G) — lowest density, quick processing
8. **docs_and_data.md** (Wave H) — conditional; 7,385 lines, heavy overlap expected; assess after all individual files are done

### Known Dedup Hotspots
These topics will appear in MANY source files. After the first extraction, subsequent files should produce enrichment tasks (not new notes) for:
- **I2C pull-up resistors** — every I2C sensor/display mentions them
- **3.3V vs 5V level shifting** — every ESP32/RPi + 5V component pair
- **Active-low signals** — shift registers, motor controllers, enable pins
- **Decoupling capacitors** — every IC datasheet recommends 100nF near VCC
- **PWM frequency selection** — motors, servos, LED dimming
- **Common ground requirement** — every multi-board wiring scenario
- **ESP32 GPIO restrictions** — ADC2/WiFi conflict, strapping pins, flash GPIOs (3 notes already exist)
- **Arduino Mega pin mapping** — UART assignments, interrupt pins, PWM-capable pins

### Queue Management
- `queue_max_depth: 150` — enrichment tasks accumulate in `ops/queue/queue.json`
- **Note:** `ops/config.yaml` sets `queue_depth_warning: 15`. `/arscontexta:health` will report warnings above 15. The plan's operational thresholds (35/45) intentionally exceed the config warning because extraction waves produce burst enrichment loads that are expected to drain between waves. Ignore health warnings about queue depth mid-wave; respect them at wave boundaries.
- After each wave: check queue depth with `cat ops/queue/queue.json | jq '.tasks | length'`
- If queue > 100: STOP extraction, drain queue by running `/connect` on pending enrichments
- If queue > 130: MANDATORY drain before continuing

### Per-Session Protocol
Each session processes exactly **5 files** (matching `pipeline_batch_size`):

1. Check queue depth: `cat ops/queue/queue.json | jq '[.tasks[] | select(.status != "done")] | length'`
2. If depth > 100, drain queue first (run `/connect` on enrichment tasks)
3. Run `/extract docs/parts/[file1].md`
4. Review extraction report — approve or adjust
5. Repeat for files 2-5
6. After session: quick dangling-link check: `grep -ohP '\[\[([^\]]+)\]\]' knowledge/*.md | sort -u | sed 's/\[\[//;s/\]\]//' | while read t; do [ ! -f "knowledge/$t.md" ] && echo "DANGLING: [[$t]]"; done`
7. Spot-check 1-2 created notes for quality (title is a claim, body has reasoning, topics linked)

---

## Wave A: Category Indexes & MOCs (13 files, 3 sessions)

**Expected yield:** Low (5-15 total notes). MOC files are navigation structures, not dense with extractable claims. But they contain category-level insights about voltage tiers, interface coverage, and inventory gaps.

**Route extracted notes to:** `[[eda-fundamentals]]` or the newly created domain topic maps

### Session A1 (5 files)
| # | File | Lines | Type |
|---|------|-------|------|
| 1 | `docs/parts/index.md` | ~60 | Master index |
| 2 | `docs/parts/microcontrollers.md` | ~60 | MCU category MOC |
| 3 | `docs/parts/sensors.md` | ~60 | Sensor category MOC |
| 4 | `docs/parts/actuators.md` | ~50 | Actuator category MOC |
| 5 | `docs/parts/displays.md` | ~50 | Display category MOC |

### Session A2 (5 files)
| # | File | Lines | Type |
|---|------|-------|------|
| 6 | `docs/parts/power.md` | ~50 | Power category MOC |
| 7 | `docs/parts/shields.md` | ~50 | Shield category MOC |
| 8 | `docs/parts/communication.md` | ~40 | Comms category MOC |
| 9 | `docs/parts/passives.md` | ~40 | Passive category MOC |
| 10 | `docs/parts/input-devices.md` | ~40 | Input device MOC |

### Session A3 (3 files)
| # | File | Lines | Type |
|---|------|-------|------|
| 11 | `docs/parts/wiring-guides.md` | ~40 | Wiring guide MOC |
| 12 | `docs/parts/unidentified-parts.md` | ~40 | Unidentified MOC |
| 13 | `docs/parts/compatibility.md` | ~40 | Compatibility ref |

### Quality Gate A
- [ ] All 13 MOC files extracted
- [ ] New topic maps in `knowledge/` have at least 1 linked note each (or note why empty)
- [ ] Queue depth < 100
- [ ] Zero new dangling links
- [ ] Spot-check: titles are claims not topic labels

---

## Wave B: Microcontrollers (12 files, 3 sessions)

**Expected yield:** High (40-80 notes). MCUs are the densest files — pin counts, memory, voltage levels, UART/SPI/I2C peripherals, gotchas, clone differences. Existing notes on ESP32 GPIO restrictions (3 notes) and Mega UART/pin-gap (2 notes) will trigger dedup/enrichment.

**Route extracted notes to:** `[[microcontrollers]]`, `[[eda-fundamentals]]`

**Dedup watch:** ESP32 GPIO restrictions already in vault — expect enrichment tasks, not new notes.

### Session B1 (5 files — primary MCU platforms)
| # | File | Lines | Type |
|---|------|-------|------|
| 14 | `arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts.md` | ~120 | Primary MCU |
| 15 | `nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md` | ~130 | Primary MCU |
| 16 | `arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b.md` | ~100 | Primary MCU |
| 17 | `esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3.md` | ~100 | Primary MCU |
| 18 | `raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3.md` | ~100 | Primary MCU |

### Session B2 (5 files — secondary/clones)
| # | File | Lines | Type |
|---|------|-------|------|
| 19 | `arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb.md` | ~90 | MCU |
| 20 | `raspberry-pi-3b-plus-is-a-quad-core-sbc-with-wifi-bt-ethernet.md` | ~100 | SBC |
| 21 | `elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb.md` | ~80 | Clone |
| 22 | `dccduino-nano-is-an-arduino-nano-clone-with-ch340-usb.md` | ~70 | Clone |
| 23 | `osepp-uno-r3-plus-is-an-arduino-uno-clone-at-5v.md` | ~70 | Clone |

### Session B3 (2 files — specialty boards)
| # | File | Lines | Type |
|---|------|-------|------|
| 24 | `adafruit-pygamer-samd51-handheld-gaming-board-with-tft.md` | ~90 | Specialty |
| 25 | `sparkfun-blynk-board-esp8266-wifi-iot-preconfigured.md` | ~70 | Specialty |

### Quality Gate B
- [ ] All 12 MCU files extracted
- [ ] `knowledge/microcontrollers.md` updated with linked notes
- [ ] Existing ESP32 notes received enrichment (not duplicated)
- [ ] Existing Mega notes received enrichment (not duplicated)
- [ ] Queue depth < 100
- [ ] Clone files produced enrichment tasks (not duplicate claims about ATmega328P/CH340)

---

## Wave C: Sensors & Communication (27 files, 6 sessions)

**Expected yield:** High (80-150 notes). Sensors are spec-rich with protocol details, calibration info, and wiring gotchas. Communication modules add Bluetooth/IR/Ethernet protocol knowledge.

**Route extracted notes to:** `[[sensors]]`, `[[communication]]`, `[[eda-fundamentals]]`

**Dedup watch:** I2C pull-ups, 3.3V/5V level shifting, analog read resolution (10-bit on AVR, 12-bit on ESP32)

### Session C1 (5 files — distance/motion sensors)
| # | File | Lines | Type |
|---|------|-------|------|
| 26 | `hc-sr04-ultrasonic-sensor-measures-2cm-to-400cm-at-5v.md` | ~100 | Ultrasonic |
| 27 | `hc-sr501-pir-motion-sensor-detects-up-to-7m-at-5v.md` | ~90 | PIR |
| 28 | `sharp-gp2y0a51sk0f-ir-proximity-sensor-2-to-15cm-analog.md` | ~80 | IR proximity |
| 29 | `osepp-ir-detector-ird01-obstacle-avoidance-ir-sensor.md` | ~70 | IR obstacle |
| 30 | `flame-sensor-module-ir-760-1100nm-fire-detector-analog-digital.md` | ~80 | IR flame |

### Session C2 (5 files — I2C IMUs and navigation)
| # | File | Lines | Type |
|---|------|-------|------|
| 31 | `bno055-9dof-absolute-orientation-imu-with-sensor-fusion-i2c.md` | ~130 | 9-DOF IMU |
| 32 | `mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3.md` | ~120 | 6-DOF IMU |
| 33 | `hmc5883l-qmc5883l-3-axis-compass-magnetometer-i2c.md` | ~100 | Compass |
| 34 | `neo-6m-gps-module-uart-3v3-for-position-tracking.md` | ~100 | GPS |
| 35 | `ina219-high-side-current-sensor-26v-i2c-for-power-monitoring.md` | ~100 | Current sensor |

### Session C3 (5 files — environmental sensors)
| # | File | Lines | Type |
|---|------|-------|------|
| 36 | `dht11-temperature-humidity-sensor-single-wire-0-50c.md` | ~90 | Temp/humidity |
| 37 | `ntc-103-10k-thermistor-temperature-sensor-for-3d-printers.md` | ~70 | Thermistor |
| 38 | `soil-moisture-sensor-capacitive-analog-3v3-5v.md` | ~70 | Soil moisture |
| 39 | `water-level-detection-sensor-resistive-analog-output.md` | ~60 | Water level |
| 40 | `sound-sensor-module-lm393-electret-mic-analog-digital-out.md` | ~70 | Sound |

### Session C4 (5 files — light/magnetic/misc sensors)
| # | File | Lines | Type |
|---|------|-------|------|
| 41 | `photoresistor-ldr-light-dependent-resistor-analog-light-sensor.md` | ~70 | LDR |
| 42 | `rc522-mfrc522-rfid-reader-13mhz-spi-3v3.md` | ~100 | RFID |
| 43 | `adafruit-pdm-microphone-sph0645lm4h-digital-audio-3v3.md` | ~80 | PDM mic |
| 44 | `sw-520d-tilt-switch-ball-type-orientation-detector.md` | ~50 | Tilt switch |
| 45 | `hamlin-59030-reed-switch-magnetic-sensor-dry-contact.md` | ~50 | Reed switch |

### Session C5 (5 files — IR + communication)
| # | File | Lines | Type |
|---|------|-------|------|
| 46 | `generic-ir-receiver-module-38khz-demodulator.md` | ~80 | IR receiver |
| 47 | `ir-remote-control-handheld-38khz-nec-protocol.md` | ~70 | IR remote |
| 48 | `osepp-ir-transmitter-irf01-38khz-led-module.md` | ~60 | IR transmitter |
| 49 | `osepp-bluetooth-bth-01-hc05-compatible-uart-bt-module.md` | ~90 | BT master/slave |
| 50 | `osepp-bluetooth-btm-01-hc06-compatible-uart-bt-slave.md` | ~70 | BT slave |

### Session C6 (2 files)
| # | File | Lines | Type |
|---|------|-------|------|
| 51 | `velleman-pka042-ethernet-shield-w5100-for-arduino.md` | ~80 | Ethernet |
| 52 | `ds3231-rtc-module-zs042-i2c-real-time-clock-with-battery.md` | ~137 | I2C RTC |

### Quality Gate C
- [ ] All 27 sensor/communication files extracted
- [ ] `knowledge/sensors.md` and `knowledge/communication.md` updated
- [ ] I2C protocol insights converged (not duplicated across IMU/compass/current sensor extractions)
- [ ] Queue depth < 100 (drain if needed — this wave may produce heavy enrichment)
- [ ] NEC protocol, Bluetooth UART, and SPI patterns each captured once (not per-device)

---

## Wave D: Actuators & Power (20 files, 4 sessions)

**Expected yield:** High (60-120 notes). Motor drivers and power systems are the OmniTrek rover core — BLDC control, H-bridge logic, battery management, emergency stop. Existing notes on BLDC active-low brake and hall sensor wiring order will trigger dedup.

**Route extracted notes to:** `[[actuators]]`, `[[power-systems]]`, `[[eda-fundamentals]]`

**Dedup watch:** BLDC stop/brake polarity (already in vault), H-bridge concepts shared between L293D/L298N/TB6612, PWM motor speed control

### Session D1 (5 files — motor control core)
| # | File | Lines | Type |
|---|------|-------|------|
| 53 | `riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md` | ~150 | BLDC driver |
| 54 | `hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md` | ~120 | BLDC motor |
| 55 | `l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a.md` | ~130 | H-bridge |
| 56 | `l293d-dual-h-bridge-ic-600ma-per-channel-with-built-in-diodes.md` | ~100 | H-bridge IC |
| 57 | `28byj-48-5v-unipolar-stepper-motor-with-uln2003-driver.md` | ~110 | Stepper motor |

### Session D2 (5 files ��� servos, small motors, outputs)
| # | File | Lines | Type |
|---|------|-------|------|
| 58 | `uln2003apg-stepper-driver-board-for-28byj-48-at-5v.md` | ~80 | Stepper driver |
| 59 | `f130s-small-dc-motor-3-5v-130-can-size.md` | ~60 | DC motor |
| 60 | `osepp-analog-micro-servo-position-4p8-6v.md` | ~80 | Servo |
| 61 | `osepp-ls-955cr-continuous-rotation-servo-360-degree.md` | ~70 | Cont. servo |
| 62 | `active-piezo-buzzer-5v-2p5khz-built-in-oscillator.md` | ~60 | Buzzer |

### Session D3 (5 files ��� power + relay)
| # | File | Lines | Type |
|---|------|-------|------|
| 63 | `passive-piezo-buzzer-3-5v-pwm-driven-tone-generator.md` | ~60 | Buzzer |
| 64 | `songle-srd-05vdc-relay-5v-coil-spdt-10a-250vac.md` | ~90 | Relay |
| 65 | `hoverboard-10s-lithium-ion-battery-pack-36v-with-bms.md` | ~120 | Battery |
| 66 | `lm2596-adjustable-buck-converter-module-3a-step-down.md` | ~90 | Buck converter |
| 67 | `kia7809a-9v-linear-voltage-regulator-1a.md` | ~70 | Regulator |

### Session D4 (5 files — power distribution + safety)
| # | File | Lines | Type |
|---|------|-------|------|
| 68 | `elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable.md` | ~70 | Bread power |
| 69 | `emergency-stop-nc-button-with-dc-contactor-for-36v.md` | ~90 | E-stop |
| 70 | `main-power-switch-anl-fuse-100a-disconnect-for-36v.md` | ~80 | Main switch |
| 71 | `power-distribution-board-fused-terminal-block-for-36v-system.md` | ~90 | PDB |
| 72 | `p30n06le-n-channel-logic-level-mosfet-60v-30a.md` | ~80 | MOSFET |

### Quality Gate D
- [ ] All 20 actuator/power files extracted
- [ ] `knowledge/actuators.md` and `knowledge/power-systems.md` updated
- [ ] Existing BLDC notes enriched (not duplicated)
- [ ] H-bridge concepts extracted ONCE (L298N session), then enriched by L293D/TB6612
- [ ] Safety-critical claims (E-stop wiring, BMS protection, fuse sizing) captured with `confidence: proven`
- [ ] Queue depth < 100

---

## Wave E: Displays, Passives, Input, Shields, Misc (43 files, 9 sessions)

**Expected yield:** Moderate (80-150 notes). Diverse parts with less overlap than previous waves. Display protocols (SPI TFT, I2C OLED, parallel LCD, multiplexed 7-seg) each have unique knowledge. Passives are thin. Shields overlap with motor drivers.

**Route extracted notes to:** `[[displays]]`, `[[passives]]`, `[[input-devices]]`, `[[shields]]`, `[[eda-fundamentals]]`

### Session E1 (5 files — TFT/LCD/OLED displays)
| # | File | Lines | Type |
|---|------|-------|------|
| 73 | `2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi.md` | ~120 | TFT |
| 74 | `hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c.md` | ~130 | Character LCD |
| 75 | `sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi.md` | ~100 | OLED |
| 76 | `raspberry-pi-7-inch-touchscreen-800x480-dsi.md` | ~90 | DSI display |
| 77 | `adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes.md` | ~80 | Specialty |

### Session E2 (5 files — 7-segment/matrix/LED)
| # | File | Lines | Type |
|---|------|-------|------|
| 78 | `4-digit-7-segment-display-hs420561k-common-cathode.md` | ~90 | 7-segment |
| 79 | `5161as-single-digit-7-segment-led-display-red-common-cathode.md` | ~70 | 7-segment |
| 80 | `1088as-8x8-red-led-dot-matrix-common-cathode-3mm.md` | ~80 | LED matrix |
| 81 | `max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins.md` | ~100 | LED driver |
| 82 | `ws2812b-neopixel-ring-status-led-array-for-system-feedback.md` | ~90 | NeoPixel |

### Session E3 (5 files — LEDs + LCD PMIC + passives)
| # | File | Lines | Type |
|---|------|-------|------|
| 83 | `5mm-led-assortment-through-hole-red-green-blue-yellow-white-rgb.md` | ~80 | LEDs |
| 84 | `max17113-tft-lcd-pmic-generates-all-supply-rails-for-lcd-panels.md` | ~80 | LCD PMIC |
| 85 | `22pf-ceramic-capacitor-npo-50v-crystal-load-cap.md` | ~60 | Capacitor |
| 86 | `100nf-ceramic-capacitor-104-50v-decoupling-bypass.md` | ~60 | Capacitor |
| 87 | `200mxr470m-electrolytic-capacitor-470uf-200v-radial.md` | ~60 | Electrolytic |

### Session E4 (5 files — more passives + transistors)
| # | File | Lines | Type |
|---|------|-------|------|
| 88 | `381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage.md` | ~60 | HV cap |
| 89 | `753j-400v-polyester-film-capacitor-75nf.md` | ~50 | Film cap |
| 90 | `pn2222a-npn-transistor-40v-600ma-general-purpose-to92.md` | ~80 | NPN BJT |
| 91 | `s8050-npn-transistor-25v-500ma-medium-power-to92.md` | ~70 | NPN BJT |
| 92 | `potentiometer-10k-rotary-b10k-linear-taper.md` | ~70 | Pot |

### Session E5 (5 files — shift register + input devices)
| # | File | Lines | Type |
|---|------|-------|------|
| 93 | `74hc595-8-bit-shift-register-serial-to-parallel-dip16.md` | ~120 | Shift register |
| 94 | `analog-joystick-module-xy-axes-plus-pushbutton.md` | ~80 | Joystick |
| 95 | `membrane-switch-keypad-module-tactile-button-array.md` | ~80 | Keypad |
| 96 | `ky-040-rotary-encoder-module-incremental-with-pushbutton.md` | ~80 | Encoder |
| 97 | `toneluck-6-way-self-locking-push-button-switch-18-pin.md` | ~60 | Switch |

### Session E6 (5 files — shields: motor + sensor)
| # | File | Lines | Type |
|---|------|-------|------|
| 98 | `dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma.md` | ~100 | Motor shield |
| 99 | `osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos.md` | ~90 | Motor shield |
| 100 | `osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel.md` | ~90 | Motor shield |
| 101 | `osepp-sensor-shield-3-pin-breakout-for-arduino-uno.md` | ~70 | Sensor shield |
| 102 | `sainsmart-mega-sensor-shield-v2-3-pin-breakout.md` | ~70 | Sensor shield |

### Session E7 (5 files — level shifters + proto boards)
| # | File | Lines | Type |
|---|------|-------|------|
| 103 | `arduino-mega-proto-shield-v3-solder-pad-board.md` | ~60 | Proto shield |
| 104 | `hw-221-8-channel-bidirectional-level-shifter-bss138-based.md` | ~90 | Level shifter |
| 105 | `txs0108e-8-channel-bidirectional-level-shifter-auto-direction.md` | ~90 | Level shifter |
| 106 | `solderless-breadboard-full-size-mb-102-830-point.md` | ~60 | Breadboard |
| 107 | `solderless-breadboard-mini-400-point-interlockable.md` | ~50 | Breadboard |

### Session E8 (5 files — more breadboards + connectors + salvage)
| # | File | Lines | Type |
|---|------|-------|------|
| 108 | `osepp-solderable-breadboard-large-perfboard.md` | ~50 | Perfboard |
| 109 | `osepp-solderable-breadboard-mini-perfboard.md` | ~50 | Perfboard |
| 110 | `d-436-raychem-solder-sleeve-butt-splice-heat-shrink.md` | ~50 | Connector |
| 111 | `johnson-cinch-banana-plug-green-15a-0304-001.md` | ~40 | Connector |
| 112 | `amphenol-11260-60-position-floating-receptacle-smd-connector.md` | ~50 | Connector |

### Session E9 (3 files — industrial + salvage)
| # | File | Lines | Type |
|---|------|-------|------|
| 113 | `allen-bradley-1794-tb3s-flex-io-terminal-base-16-channel.md` | ~60 | Industrial |
| 114 | `salvaged-hoverboard-metal-frame-for-rover-chassis.md` | ~50 | Salvage |
| 115 | `dust-bin-assembly-rev-3-290-0018-salvage-mechanical-part.md` | ~40 | Salvage |

### Quality Gate E
- [ ] All 43 files extracted
- [ ] Topic maps `[[displays]]`, `[[passives]]`, `[[input-devices]]`, `[[shields]]` all updated
- [ ] Level shifter comparison (BSS138 vs TXS0108E) captured as a single comparison note, not two separate claims
- [ ] Motor shield files produced enrichment tasks for existing motor driver claims
- [ ] Breadboard/perfboard files routed to `[[breadboard-intelligence]]` topic map
- [ ] Queue depth < 100

---

## Wave F: Wiring Guides (7 files, 2 sessions)

**Expected yield:** Very high (50-100 notes). Wiring guides are the densest files (130-388 lines each) with integration patterns, safety-critical wiring rules, code examples, troubleshooting tables, and system architecture insights. These produce the most valuable claims because they capture *how parts work together*, not just individual specs.

**Route extracted notes to:** `[[wiring-integration]]`, `[[actuators]]`, `[[power-systems]]`, `[[eda-fundamentals]]`

**Dedup watch:** Common ground requirement, BLDC wiring (already extracted in Wave D), level shifting (already in Wave E). Expect heavy enrichment task production here.

### Session F1 (5 files — motor wiring + power distribution)
| # | File | Lines | Type |
|---|------|-------|------|
| 116 | `wiring-dual-zs-x11h-for-hoverboard-robot.md` | ~350 | Motor wiring |
| 117 | `wiring-zs-x11h-to-arduino-mega-for-single-motor-control.md` | ~300 | Motor wiring |
| 118 | `wiring-zs-x11h-to-esp32-with-level-shifter.md` | ~250 | Motor + shift |
| 119 | `wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover.md` | ~300 | 4WD system |
| 120 | `wiring-36v-battery-power-distribution-4-tier-system.md` | ~250 | Power dist |

### Session F2 (2 files — I2C bus + hall sensors)
| # | File | Lines | Type |
|---|------|-------|------|
| 121 | `wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter.md` | ~200 | Hall + shift |
| 122 | `wiring-i2c-multi-device-bus-compass-imu-current-sensor.md` | ~200 | I2C bus |

### Quality Gate F
- [ ] All 7 wiring guides extracted
- [ ] `knowledge/wiring-integration.md` has substantial linked notes
- [ ] Safety-critical wiring rules (common ground, fuse placement, E-stop wiring) all captured
- [ ] Tank steering logic and 4WD architecture captured as distinct claims
- [ ] Enrichment tasks generated for existing motor/sensor claims (expected — not a problem)
- [ ] Queue depth < 120 (elevated from the standard 100 threshold because wiring guides produce heavy enrichment bursts — this is expected and acceptable for this wave only)

---

## Wave G: Unidentified Parts (15 files, 3 sessions)

**Expected yield:** Very low (5-15 total notes). Unidentified parts have minimal content (35-42 lines each, mostly empty frontmatter). Extractable claims are limited to: "this part exists and needs identification", physical characteristics, and elimination candidates.

**Route extracted notes to:** `[[eda-fundamentals]]` or skip if truly empty

**Strategy:** Process quickly. Many may produce zero extraction — that's expected and valid for files that are essentially "unknown component, needs investigation."

### Session G1 (5 files)
| # | File | Lines | Type |
|---|------|-------|------|
| 123 | `1a48-central-semiconductor-unknown-component.md` | ~40 | Unknown |
| 124 | `34-660-376301-unknown-component.md` | ~40 | Unknown |
| 125 | `3405-unknown-component-possibly-trimpot-or-ic.md` | ~40 | Unknown |
| 126 | `18007pa-unknown-component.md` | ~40 | Unknown |
| 127 | `19123-unknown-component.md` | ~40 | Unknown |

### Session G2 (5 files)
| # | File | Lines | Type |
|---|------|-------|------|
| 128 | `unidentified-8x8-matrix-board-lw-45-24p.md` | ~40 | Unknown |
| 129 | `unidentified-audio-sensor-1803-ccc.md` | ~40 | Unknown |
| 130 | `unidentified-board-bj3450f01ap6.md` | ~40 | Unknown |
| 131 | `unidentified-board-bj3450m020p5.md` | ~40 | Unknown |
| 132 | `unidentified-board-sunblast-v9.md` | ~40 | Unknown |

### Session G3 (5 files)
| # | File | Lines | Type |
|---|------|-------|------|
| 133 | `unidentified-component-lf-0174-1770-2902.md` | ~40 | Unknown |
| 134 | `unidentified-module-lw-9601-rev-1p1.md` | ~40 | Unknown |
| 135 | `unidentified-part-jh-1326r.md` | ~40 | Unknown |
| 136 | `unidentified-rgb-led-module-lex-rgb-01.md` | ~40 | Unknown |
| 137 | `unidentified-sensor-kar00044e.md` | ~40 | Unknown |

### Quality Gate G
- [ ] All 15 unidentified files processed (many may yield zero notes — that's fine)
- [ ] Any extractable claims (physical characteristics, potential identifications) captured
- [ ] No forced extraction from empty files
- [ ] Queue depth < 40

---

## Wave H: docs_and_data.md (CONDITIONAL — Decision Required)

**This file is 7,385 lines.** It's a consolidated encyclopedic reference that likely contains the source material from which the individual 137 parts files were derived. After extracting all individual files, this file will have massive overlap.

### Decision Point (evaluate BEFORE starting Wave H)

- [ ] **Step 1:** Read first 200 lines of `docs/parts/docs_and_data.md` to assess structure
- [ ] **Step 2:** Sample 3 random "Document Set" sections and compare against existing knowledge notes
- [ ] **Step 3:** Estimate overlap percentage:
  - **>80% overlap** → SKIP (individual files already captured everything)
  - **50-80% overlap** → SELECTIVE extract (chunk only unique sections)
  - **<50% overlap** → FULL extract (chunk into 7 segments of ~1,050 lines each)

### If Full Extract Needed (7 chunks)

Chunking strategy: `docs_and_data.md` is organized as "Document Set N" sections. Chunk along document set boundaries, not arbitrary line counts. Each chunk = 1 session.

| Chunk | Lines | Session |
|-------|-------|---------|
| 1 | 1-1050 | H1 |
| 2 | 1051-2100 | H2 |
| 3 | 2101-3150 | H3 |
| 4 | 3151-4200 | H4 |
| 5 | 4201-5250 | H5 |
| 6 | 5251-6300 | H6 |
| 7 | 6301-7385 | H7 |

**Note:** `/extract` handles chunking automatically for files >2500 lines (700-1200 line chunks with fresh context per chunk). You just run `/extract docs/parts/docs_and_data.md` and it handles the rest. The table above is for planning session time, not manual splitting.

### Quality Gate H
- [ ] Overlap assessment completed before starting
- [ ] If extracted: new notes are genuinely novel (not repeating earlier extractions)
- [ ] Enrichment task count is reasonable (not 200+ enrichments flooding the queue)

---

## Post-Extraction: Connect Phase

After ALL waves complete, the vault will have potentially 300-600+ new knowledge notes. The `/connect` phase relates them to each other and to existing vault content.

- [ ] **Step 1:** Run `/arscontexta:health` — full vault health check
- [ ] **Step 2:** Check for orphan notes (notes with zero incoming links)
- [ ] **Step 3:** Run `/connect` on each new topic map to populate cross-references
- [ ] **Step 4:** Process any remaining enrichment tasks in `ops/queue/queue.json`
- [ ] **Step 5:** Run `/revisit` on `knowledge/eda-fundamentals.md` — the parent topic map likely needs restructuring with 10 new child topic maps

---

## Summary Statistics

| Wave | Files | Sessions | Expected Notes | Key Risk |
|------|-------|----------|----------------|----------|
| 0 (prereq) | 0 (create 10) | 1 | 0 | Missing topic maps = dangling links |
| A (MOCs) | 13 | 3 | 5-15 | Low yield is expected, not a bug |
| B (MCUs) | 12 | 3 | 40-80 | ESP32/Mega dedup against existing notes |
| C (Sensors/Comms) | 27 | 6 | 80-150 | I2C/protocol dedup across 20+ files |
| D (Actuators/Power) | 20 | 4 | 60-120 | BLDC/H-bridge dedup, safety claims |
| E (Displays/etc) | 43 | 9 | 80-150 | Diverse, less overlap |
| F (Wiring) | 7 | 2 | 50-100 | Highest density, heavy enrichment |
| G (Unidentified) | 15 | 3 | 5-15 | Many zero-yield files expected |
| H (Reference) | 1 | 1-7 | 0-80 | Conditional; overlap assessment first |
| **TOTAL** | **137+1** | **31-38** | **320-710** | Queue overflow unlikely at 150 cap |

**Estimated total sessions:** 31-38 (at 5 files each, ~15-30 min per session)

**Estimated calendar time:** 8-15 days (assuming 3-5 sessions per work day with quality gates between waves)

---

## Verification Checklist (Run After Final Wave)

- [ ] `knowledge/` note count increased by expected amount
- [ ] All 10 hardware topic maps have linked notes
- [ ] `/arscontexta:health` passes (zero orphans, zero dangling links, connection density >= 2.0)
- [ ] `ops/queue/queue.json` — all extraction tasks marked done
- [ ] Remaining enrichment tasks < 20 (or drain them)
- [ ] `knowledge/eda-fundamentals.md` links to all 10 new topic maps
- [ ] Spot-check 10 random new notes: title is a claim, body has reasoning, topics linked, confidence set
- [ ] No duplicate claims (search for common patterns: "I2C pull-up", "level shift", "active low")
