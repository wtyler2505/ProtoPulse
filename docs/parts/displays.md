---
description: Visual output devices — LCD, LED, OLED, 7-segment, and matrix displays
type: moc
---

# displays

Everything that shows information visually.

## Parts

| Part | Type | Interface | Resolution | Voltage | Status | Qty |
|------|------|-----------|------------|---------|--------|-----|
| [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] | OLED | I2C, SPI | 128x64 | 3.3-5V | needs-test | 1 |
| [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] | LCD | Parallel, I2C | 16x2 char | 5V | needs-test | 1 |
| [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] | LED Matrix | SPI, Digital | 8x8 | 3.3-5V | needs-test | 1 |
| [[5161as-single-digit-7-segment-led-display-red-common-cathode]] | 7-Segment | Digital | 1 digit | 2.1V | needs-test | 1 |
| [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] | Driver IC | SPI | 8 digits/8x8 | 4-5.5V | needs-test | 1 |
| [[4-digit-7-segment-display-hs420561k-common-cathode]] | 7-Segment | Digital | 4 digits | 5V | needs-test | 1 |
| [[2p8-inch-tft-lcd-touch-shield-ili9341-320x240-spi]] | TFT LCD | SPI | 320x240 | 3.3-5V | needs-test | 1 |
| [[raspberry-pi-7-inch-touchscreen-800x480-dsi]] | LCD | DSI | 800x480 | 5V | needs-test | 1 |
| [[ws2812b-neopixel-ring-status-led-array-for-system-feedback]] | Addressable RGB | Digital (1-wire) | 8-24 LEDs | 5V | needs-test | 1 |

## Quick Reference

| Display Type | Interface | Pin Count | Driver IC | Library |
|-------------|-----------|-----------|-----------|---------|
| 16x2 LCD (HD44780) | Parallel / I2C | 16 / 4 | HD44780 | LiquidCrystal |
| 7-segment (single) | Direct | 10 | None | Manual multiplex |
| 7-segment (4-digit) | SPI-like | 5 | MAX7219/TM1637 | TM1637Display |
| 8x8 LED matrix | SPI | 5 | MAX7219 | LedControl |
| TFT LCD | SPI | 9+ | ILI9341 | Adafruit_ILI9341 |
| OLED | I2C | 4 | SSD1306 | Adafruit_SSD1306 |

---

Categories:
- [[index]]
