---
description: "Display and LED knowledge -- TFT/OLED/LCD protocols, 7-segment multiplexing, LED matrix driving, NeoPixel timing, and display controller selection"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# displays

Display protocols, driver ICs, multiplexing strategies, and visual feedback design for the inventory. Covers TFT SPI, I2C OLED, parallel character LCD, 7-segment, LED matrices, NeoPixels, and touchscreens.

## Knowledge Notes
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — display selection is a dependency chain, not a feature comparison
- [[most-maker-displays-accept-3v3-5v-but-character-lcds-and-7-segments-are-5v-only-gotchas]] — HD44780 and raw 7-segments are 5V-only, a trap for ESP32/Pi Pico users
- [[max7219-is-the-universal-led-display-driver-for-both-matrices-and-7-segments]] — one IC, two display types, cascading support

### Touch Input
- [[resistive-touchscreen-requires-per-unit-calibration-because-coordinate-mapping-varies-between-individual-panels]] — each resistive panel needs a calibration sketch run per unit
- [[resistive-touch-consumes-analog-pins-creating-a-hidden-resource-conflict-with-analog-sensors]] — 4-wire resistive touch eats A0-A3, devastating on Uno
- [[resistive-touch-trades-input-quality-for-hardware-simplicity-by-eliminating-a-separate-touch-controller-ic]] — no touch controller IC needed, but worse UX than capacitive

### TFT / Color Displays
- [[tft-shield-form-factor-consumes-most-uno-pins-making-mega-the-practical-host-board-for-projects-needing-additional-io]] — ILI9341 TFT shield leaves almost no free pins on Uno
- [[dual-spi-displays-require-cortex-m4f-class-processing-with-fpu-and-dma-for-usable-animation-frame-rates]] — multi-display animation needs DMA and FPU
- [[qspi-flash-as-dedicated-graphics-asset-storage-separates-texture-data-from-program-flash]] — external QSPI for bitmaps keeps program flash free

### Character LCD (HD44780)
- [[hd44780-parallel-mode-consumes-6-gpio-pins-minimum-making-i2c-backpack-the-default-wiring-choice]] — I2C backpack reduces 6 pins to 2
- [[hd44780-contrast-potentiometer-has-a-narrow-sweet-spot-and-wrong-adjustment-produces-blank-or-solid-rectangle-symptoms]] — the number one "my LCD doesn't work" false alarm
- [[pcf8574-i2c-backpack-defaults-to-address-0x27-but-pcf8574a-variant-defaults-to-0x3f-and-solder-jumpers-allow-8-addresses-per-chip]] — I2C address confusion between PCF8574 and PCF8574A variants

### OLED (SH1106 / SSD1306)
- [[sh1106-132-column-buffer-with-only-128-visible-creates-a-2-pixel-offset-that-causes-garbled-display-with-ssd1306-libraries]] — the core SH1106 vs SSD1306 library mismatch gotcha
- [[oled-screen-size-predicts-driver-ic-where-1p3-inch-modules-use-sh1106-and-0p96-inch-use-ssd1306]] — screen diagonal as driver IC heuristic
- [[u8g2-library-handles-sh1106-and-ssd1306-transparently-making-it-the-safest-default-for-unknown-oled-driver-ics]] — U8g2 is the safe library choice when driver IC is unknown
- [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]] — too many pull-ups is worse than too few
- [[oled-i2c-address-0x3c-is-changeable-to-0x3d-via-solder-jumper-enabling-two-displays-on-one-bus]] — dual OLED setup via address jumper

### DSI (Raspberry Pi)
- [[dsi-display-interface-consumes-zero-gpio-pins-and-no-hdmi-port-making-it-the-only-zero-pin-display-option-in-the-maker-inventory]] — zero pin cost, unique among all display interfaces
- [[dsi-connector-locks-display-choice-to-the-raspberry-pi-ecosystem-eliminating-cross-platform-portability]] — zero portability tradeoff

### Animated / Reactive Displays
- [[multi-sensor-reactive-behavior-creates-emergent-realism-when-sensor-outputs-map-directly-to-animation-parameters]] — independent sensor-to-animation channels produce emergent lifelikeness
- [[pre-loaded-firmware-with-config-file-customization-enables-zero-code-hardware-deployment]] — works out of the box, customize without coding
- [[nose-bridge-connector-enables-board-to-board-synchronization-for-matched-multi-display-animations]] — purpose-built inter-board connector for GPIO-exhausted boards

### 7-Segment Displays
- [[common-cathode-and-common-anode-7-segment-displays-are-electrically-incompatible-and-swapping-them-silently-breaks-firmware]] — polarity mismatch produces total failure, not partial
- [[multiplexed-led-displays-need-100hz-minimum-refresh-rate-or-flicker-becomes-visible-due-to-persistence-of-vision-limits]] — the scan rate threshold and why driver ICs exist
- [[direct-driving-a-4-digit-7-segment-display-consumes-12-gpio-pins-and-requires-constant-software-multiplexing]] — why raw 4-digit displays demand a driver IC
- [[multiplexed-led-digit-selection-uses-transistors-because-gpio-cannot-sink-enough-current-for-all-segments-simultaneously]] — NPN transistors for manual cathode switching
- [[pulsed-led-current-at-low-duty-cycle-allows-5x-the-continuous-rating-making-multiplexed-displays-brighter-than-dc-math-predicts]] — peak vs continuous current in multiplexed LEDs
- [[seven-segment-digit-encoding-is-a-fixed-lookup-table-that-firmware-must-embed]] — no formula, just a byte array

### LED Matrix
- [[direct-driving-an-8x8-led-matrix-consumes-16-io-pins-and-locks-the-cpu-to-display-refresh]] — direct drive is a learning exercise, not production
- [[1088as-pin-numbering-is-non-sequential-across-rows-and-columns-making-orientation-verification-mandatory]] — scrambled pin mapping, must test before coding

### MAX7219 Driver IC
- [[rset-resistor-sets-all-max7219-segment-current-globally-and-wrong-value-destroys-leds]] — the single component that controls LED brightness and survival
- [[max7219-only-works-with-common-cathode-displays-because-dig-pins-are-current-sinks]] — hard polarity constraint, no workaround
- [[both-max7219-gnd-pins-must-be-connected-because-they-are-not-internally-bridged]] — a wiring gotcha unique to this IC
- [[max7219-requires-both-ceramic-and-electrolytic-decoupling-caps-or-spi-communication-becomes-unreliable]] — dual-cap decoupling is mandatory

### Addressable LEDs (NeoPixel / WS2812B)
- [[ws2812b-grab-and-pass-protocol-means-one-gpio-pin-controls-an-entire-led-chain]] — integrated controller cascade, 800kHz NZR timing
- [[neopixel-data-line-needs-a-300-500-ohm-series-resistor-to-suppress-signal-reflections]] — signal integrity protection on the data wire
- [[neopixel-rings-need-a-bulk-electrolytic-capacitor-across-power-to-absorb-inrush-current]] — 1000uF cap for power surge protection
- [[neopixel-per-led-current-at-full-white-makes-ring-size-a-power-supply-design-decision]] — 50mA per LED means ring size is a power architecture choice
- [[first-led-in-a-neopixel-chain-is-a-single-point-of-failure-that-kills-the-entire-downstream-chain]] — serial chain vulnerability
- [[74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals]] — the correct level shifter for ESP32 → NeoPixel

## Open Questions
- How generalizable is the "dedicated single-purpose inter-board connector" pattern beyond Adafruit's M4SK and Gizmo?

---

Topics:
- [[eda-fundamentals]]
- [[index]]
