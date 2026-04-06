/**
 * NodeMCU ESP32-S (38-pin) — Verified Board Definition
 *
 * ESP-WROOM-32 module, 240 MHz dual-core, 3.3V logic, WiFi + Bluetooth.
 * 38 pins (2x19), 22.86mm row spacing.
 *
 * Sources:
 * - https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf
 * - https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html
 * - https://randomnerdtutorials.com/esp32-pinout-reference-gpios/
 * - https://www.espboards.dev/blog/esp32-strapping-pins/
 */

import type { VerifiedBoardDefinition, VerifiedPin, VerifiedBus, HeaderGroup, BootPinConfig } from './types';

// ---------------------------------------------------------------------------
// Pin definitions — Left header (L1-L19, top to bottom, USB at top)
// ---------------------------------------------------------------------------

const LEFT_HEADER: VerifiedPin[] = [
  // L1: 3V3
  { id: '3V3', name: '3V3', headerGroup: 'left', headerPosition: 0, role: 'power', direction: 'power', voltage: 3.3, functions: [], warnings: ['Max 600mA from AMS1117 regulator'] },
  // L2: EN
  { id: 'EN', name: 'EN', headerGroup: 'left', headerPosition: 1, role: 'control', direction: 'input', voltage: 3.3, functions: [], warnings: ['Module enable — active HIGH. Connected to reset button.'] },
  // L3: GPIO36 (VP)
  { id: 'GPIO36', name: 'VP', headerGroup: 'left', headerPosition: 2, role: 'analog', direction: 'input', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC1_CH0' },
    { type: 'hall', signal: 'VP', notes: 'Internal hall sensor VP leg' },
  ], warnings: ['Input only — no output capability, no internal pull resistors'] },
  // L4: GPIO39 (VN)
  { id: 'GPIO39', name: 'VN', headerGroup: 'left', headerPosition: 3, role: 'analog', direction: 'input', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC1_CH3' },
    { type: 'hall', signal: 'VN', notes: 'Internal hall sensor VN leg' },
  ], warnings: ['Input only — no output capability, no internal pull resistors'] },
  // L5: GPIO34
  { id: 'GPIO34', name: 'IO34', headerGroup: 'left', headerPosition: 4, role: 'analog', direction: 'input', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC1_CH6' },
  ], warnings: ['Input only — no output capability, no internal pull resistors'] },
  // L6: GPIO35
  { id: 'GPIO35', name: 'IO35', headerGroup: 'left', headerPosition: 5, role: 'analog', direction: 'input', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC1_CH7' },
  ], warnings: ['Input only — no output capability, no internal pull resistors'] },
  // L7: GPIO32
  { id: 'GPIO32', name: 'IO32', headerGroup: 'left', headerPosition: 6, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC1_CH4' },
    { type: 'touch', channel: 'T9' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // L8: GPIO33
  { id: 'GPIO33', name: 'IO33', headerGroup: 'left', headerPosition: 7, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC1_CH5' },
    { type: 'touch', channel: 'T8' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // L9: GPIO25
  { id: 'GPIO25', name: 'IO25', headerGroup: 'left', headerPosition: 8, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'dac', channel: 'DAC1', notes: '8-bit resolution' },
    { type: 'adc', channel: 'ADC2_CH8', notes: 'Unavailable when WiFi active' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // L10: GPIO26
  { id: 'GPIO26', name: 'IO26', headerGroup: 'left', headerPosition: 9, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'dac', channel: 'DAC2', notes: '8-bit resolution' },
    { type: 'adc', channel: 'ADC2_CH9', notes: 'Unavailable when WiFi active' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // L11: GPIO27
  { id: 'GPIO27', name: 'IO27', headerGroup: 'left', headerPosition: 10, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC2_CH7', notes: 'Unavailable when WiFi active' },
    { type: 'touch', channel: 'T7' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // L12: GPIO14
  { id: 'GPIO14', name: 'IO14', headerGroup: 'left', headerPosition: 11, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC2_CH6', notes: 'Unavailable when WiFi active' },
    { type: 'touch', channel: 'T6' },
    { type: 'spi', signal: 'CLK', bus: 'hspi' },
    { type: 'jtag', signal: 'TMS' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // L13: GPIO12 — STRAPPING PIN
  { id: 'GPIO12', name: 'IO12', headerGroup: 'left', headerPosition: 12, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC2_CH5', notes: 'Unavailable when WiFi active' },
    { type: 'touch', channel: 'T5' },
    { type: 'spi', signal: 'MISO', bus: 'hspi' },
    { type: 'jtag', signal: 'TDI' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ], warnings: ['STRAPPING PIN — must be LOW at boot for 3.3V flash. HIGH selects 1.8V flash and will crash most modules.'] },
  // L14: GND
  { id: 'GND_L', name: 'GND', headerGroup: 'left', headerPosition: 13, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  // L15: GPIO13
  { id: 'GPIO13', name: 'IO13', headerGroup: 'left', headerPosition: 14, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC2_CH4', notes: 'Unavailable when WiFi active' },
    { type: 'touch', channel: 'T4' },
    { type: 'spi', signal: 'MOSI', bus: 'hspi' },
    { type: 'jtag', signal: 'TCK' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // L16: GPIO9 — FLASH
  { id: 'GPIO9', name: 'SD2', headerGroup: 'left', headerPosition: 15, role: 'nc', direction: 'bidirectional', voltage: 3.3, functions: [], restricted: true, restrictionReason: 'Connected to internal SPI flash (SD2). Using this pin will crash the module.' },
  // L17: GPIO10 — FLASH
  { id: 'GPIO10', name: 'SD3', headerGroup: 'left', headerPosition: 16, role: 'nc', direction: 'bidirectional', voltage: 3.3, functions: [], restricted: true, restrictionReason: 'Connected to internal SPI flash (SD3). Using this pin will crash the module.' },
  // L18: GPIO11 — FLASH
  { id: 'GPIO11', name: 'CMD', headerGroup: 'left', headerPosition: 17, role: 'nc', direction: 'bidirectional', voltage: 3.3, functions: [], restricted: true, restrictionReason: 'Connected to internal SPI flash (CMD). Using this pin will crash the module.' },
  // L19: 5V / VIN
  { id: 'VIN', name: '5V', headerGroup: 'left', headerPosition: 18, role: 'power', direction: 'power', voltage: 5, functions: [], warnings: ['5V from USB or external supply via VIN. ESP32 GPIOs are NOT 5V tolerant.'] },
];

// ---------------------------------------------------------------------------
// Pin definitions — Right header (R1-R19, top to bottom, USB at top)
// ---------------------------------------------------------------------------

const RIGHT_HEADER: VerifiedPin[] = [
  // R1: GND
  { id: 'GND_R1', name: 'GND', headerGroup: 'right', headerPosition: 0, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  // R2: GPIO23
  { id: 'GPIO23', name: 'IO23', headerGroup: 'right', headerPosition: 1, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'spi', signal: 'MOSI', bus: 'vspi' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // R3: GPIO22
  { id: 'GPIO22', name: 'IO22', headerGroup: 'right', headerPosition: 2, role: 'communication', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'i2c', signal: 'SCL', bus: 'i2c0' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // R4: GPIO1 (TX0)
  { id: 'GPIO1', name: 'TX0', headerGroup: 'right', headerPosition: 3, role: 'communication', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'uart', signal: 'TX', channel: 'UART0', bus: 'uart0' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ], warnings: ['Connected to CP2102 USB-Serial. Outputs debug data on boot.'] },
  // R5: GPIO3 (RX0)
  { id: 'GPIO3', name: 'RX0', headerGroup: 'right', headerPosition: 4, role: 'communication', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'uart', signal: 'RX', channel: 'UART0', bus: 'uart0' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ], warnings: ['Connected to CP2102 USB-Serial. HIGH at boot.'] },
  // R6: GPIO21
  { id: 'GPIO21', name: 'IO21', headerGroup: 'right', headerPosition: 5, role: 'communication', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'i2c', signal: 'SDA', bus: 'i2c0' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // R7: GND
  { id: 'GND_R2', name: 'GND', headerGroup: 'right', headerPosition: 6, role: 'ground', direction: 'power', voltage: 0, functions: [] },
  // R8: GPIO19
  { id: 'GPIO19', name: 'IO19', headerGroup: 'right', headerPosition: 7, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'spi', signal: 'MISO', bus: 'vspi' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // R9: GPIO18
  { id: 'GPIO18', name: 'IO18', headerGroup: 'right', headerPosition: 8, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'spi', signal: 'CLK', bus: 'vspi' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // R10: GPIO5 — STRAPPING PIN
  { id: 'GPIO5', name: 'IO5', headerGroup: 'right', headerPosition: 9, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'spi', signal: 'CS', bus: 'vspi' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ], warnings: ['STRAPPING PIN — must be HIGH at boot. Internal pull-up present.'] },
  // R11: GPIO17
  { id: 'GPIO17', name: 'IO17', headerGroup: 'right', headerPosition: 10, role: 'communication', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'uart', signal: 'TX', channel: 'UART2', bus: 'uart2' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // R12: GPIO16
  { id: 'GPIO16', name: 'IO16', headerGroup: 'right', headerPosition: 11, role: 'communication', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'uart', signal: 'RX', channel: 'UART2', bus: 'uart2' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // R13: GPIO4
  { id: 'GPIO4', name: 'IO4', headerGroup: 'right', headerPosition: 12, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC2_CH0', notes: 'Unavailable when WiFi active' },
    { type: 'touch', channel: 'T0' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ] },
  // R14: GPIO0 — STRAPPING PIN (BOOT)
  { id: 'GPIO0', name: 'IO0', headerGroup: 'right', headerPosition: 13, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC2_CH1', notes: 'Unavailable when WiFi active' },
    { type: 'touch', channel: 'T1' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ], warnings: ['STRAPPING PIN — LOW enters download/programming mode (BOOT button). Must be HIGH or floating for normal boot.'] },
  // R15: GPIO2 — STRAPPING PIN
  { id: 'GPIO2', name: 'IO2', headerGroup: 'right', headerPosition: 14, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC2_CH2', notes: 'Unavailable when WiFi active' },
    { type: 'touch', channel: 'T2' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ], warnings: ['STRAPPING PIN — must be LOW or floating during boot. Connected to on-board LED on most dev boards.'] },
  // R16: GPIO15 — STRAPPING PIN
  { id: 'GPIO15', name: 'IO15', headerGroup: 'right', headerPosition: 15, role: 'digital', direction: 'bidirectional', voltage: 3.3, functions: [
    { type: 'adc', channel: 'ADC2_CH3', notes: 'Unavailable when WiFi active' },
    { type: 'touch', channel: 'T3' },
    { type: 'spi', signal: 'CS', bus: 'hspi' },
    { type: 'jtag', signal: 'TDO' },
    { type: 'pwm', notes: 'Via LEDC peripheral' },
  ], warnings: ['STRAPPING PIN — LOW silences boot log output. HIGH enables boot messages on UART0.'] },
  // R17: GPIO8 — FLASH
  { id: 'GPIO8', name: 'SD1', headerGroup: 'right', headerPosition: 16, role: 'nc', direction: 'bidirectional', voltage: 3.3, functions: [], restricted: true, restrictionReason: 'Connected to internal SPI flash (SD1). Using this pin will crash the module.' },
  // R18: GPIO7 — FLASH
  { id: 'GPIO7', name: 'SD0', headerGroup: 'right', headerPosition: 17, role: 'nc', direction: 'bidirectional', voltage: 3.3, functions: [], restricted: true, restrictionReason: 'Connected to internal SPI flash (SD0). Using this pin will crash the module.' },
  // R19: GPIO6 — FLASH
  { id: 'GPIO6', name: 'CLK', headerGroup: 'right', headerPosition: 18, role: 'nc', direction: 'bidirectional', voltage: 3.3, functions: [], restricted: true, restrictionReason: 'Connected to internal SPI flash (CLK). Using this pin will crash the module.' },
];

const ALL_PINS: VerifiedPin[] = [...LEFT_HEADER, ...RIGHT_HEADER];

// ---------------------------------------------------------------------------
// Bus definitions
// ---------------------------------------------------------------------------

const BUSES: VerifiedBus[] = [
  {
    id: 'vspi',
    name: 'VSPI (SPI2)',
    type: 'spi',
    pinIds: ['GPIO23', 'GPIO19', 'GPIO18', 'GPIO5'],
    protocol: 'SPI Mode 0/1/2/3, up to 80 MHz',
    notes: 'Default user SPI bus. GPIO 23 (MOSI), 19 (MISO), 18 (CLK), 5 (CS). Fully remappable via GPIO matrix.',
  },
  {
    id: 'hspi',
    name: 'HSPI (SPI3)',
    type: 'spi',
    pinIds: ['GPIO13', 'GPIO12', 'GPIO14', 'GPIO15'],
    protocol: 'SPI Mode 0/1/2/3',
    notes: 'Alternate SPI bus. Shares pins with JTAG. GPIO 13 (MOSI), 12 (MISO), 14 (CLK), 15 (CS).',
  },
  {
    id: 'i2c0',
    name: 'I2C (Wire)',
    type: 'i2c',
    pinIds: ['GPIO21', 'GPIO22'],
    protocol: 'I2C up to 400 kHz (Fast Mode)',
    notes: 'Default I2C bus. GPIO 21 (SDA), 22 (SCL). Fully remappable to any GPIO via software.',
  },
  {
    id: 'uart0',
    name: 'UART0 (USB Serial)',
    type: 'uart',
    pinIds: ['GPIO1', 'GPIO3'],
    notes: 'Connected to CP2102 USB-Serial bridge. Used for programming and Serial Monitor. GPIO 1 (TX), 3 (RX).',
  },
  {
    id: 'uart2',
    name: 'UART2',
    type: 'uart',
    pinIds: ['GPIO17', 'GPIO16'],
    notes: 'Second hardware UART available for external devices. GPIO 17 (TX), 16 (RX).',
  },
  {
    id: 'hall-sensor',
    name: 'Internal Hall Sensor',
    type: 'hall',
    pinIds: ['GPIO36', 'GPIO39'],
    notes: 'Built-in hall effect sensor inside the ESP32 die. Uses ADC1 channels 0 and 3 internally. Do not connect external signals to GPIO36/39 when using the hall sensor.',
  },
];

// ---------------------------------------------------------------------------
// Header layout
// ---------------------------------------------------------------------------

const HEADER_LAYOUT: HeaderGroup[] = [
  { id: 'left', name: 'Left Header (L1-L19)', side: 'left', pinCount: 19, pinIds: LEFT_HEADER.map((p) => p.id) },
  { id: 'right', name: 'Right Header (R1-R19)', side: 'right', pinCount: 19, pinIds: RIGHT_HEADER.map((p) => p.id) },
];

// ---------------------------------------------------------------------------
// Boot / strapping pin configuration
// ---------------------------------------------------------------------------

const BOOT_PINS: BootPinConfig[] = [
  {
    pinId: 'GPIO0',
    highBehavior: 'Normal boot from SPI flash',
    lowBehavior: 'Enter download/programming mode (serial flashing)',
    internalDefault: 'high',
    designRule: 'Do not pull low during normal operation. The BOOT button pulls this low for programming. If your circuit holds GPIO0 low at power-on, the chip enters download mode instead of running your program.',
  },
  {
    pinId: 'GPIO2',
    highBehavior: 'Normal operation',
    lowBehavior: 'Required for serial flashing (must be low or floating)',
    internalDefault: 'low',
    designRule: 'Must be LOW or floating during boot for serial programming to work. Safe to use as output after boot. Connected to on-board LED on most dev boards.',
  },
  {
    pinId: 'GPIO5',
    highBehavior: 'Normal boot timing (SDIO slave mode disabled)',
    lowBehavior: 'Enables SDIO slave timing — usually not desired on dev boards',
    internalDefault: 'high',
    designRule: 'Leave HIGH at boot (internal pull-up handles this). Pulling low changes boot timing and may cause issues.',
  },
  {
    pinId: 'GPIO12',
    highBehavior: 'Sets flash voltage to 1.8V — WILL CRASH most modules that use 3.3V flash',
    lowBehavior: 'Sets flash voltage to 3.3V (correct for ESP-WROOM-32)',
    internalDefault: 'low',
    designRule: 'CRITICAL: Must remain LOW at boot for ESP-WROOM-32 modules. If an external pull-up or connected device holds GPIO12 HIGH during power-on, the module will brown-out and fail to boot.',
  },
  {
    pinId: 'GPIO15',
    highBehavior: 'Enable boot log output on UART0 (normal debugging)',
    lowBehavior: 'Silence boot log output on UART0',
    internalDefault: 'high',
    designRule: 'Keep HIGH for normal development (you want to see boot messages). Pulling low silences boot output, which can make debugging harder.',
  },
];

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

export const NODEMCU_ESP32S: VerifiedBoardDefinition = {
  id: 'nodemcu-esp32s',
  title: 'NodeMCU ESP32-S',
  manufacturer: 'Espressif (module) / Ai-Thinker (dev board)',
  mpn: 'ESP-WROOM-32',
  aliases: [
    'NodeMCU ESP32',
    'ESP32 DevKit',
    'ESP32-S',
    'ESP32 Dev Board',
    'ESP-WROOM-32',
    'ESP32 38-pin',
    'NodeMCU-32S',
    'ESP32-DevKitC',
  ],
  family: 'board-module',
  description: 'NodeMCU ESP32-S — 38-pin development board based on Espressif ESP-WROOM-32 module. Dual-core 240 MHz Xtensa LX6, 520 KB SRAM, WiFi 802.11 b/g/n, Bluetooth 4.2/BLE, 34 GPIO (25 usable), 18 ADC channels, 2 DAC, 10 touch sensors, 4 SPI, 2 I2C, 3 UART, CAN, I2S.',

  dimensions: { width: 25.4, height: 54, thickness: 1.6 },
  breadboardFit: 'requires_jumpers',
  breadboardNotes: 'At 22.86mm row spacing, the 38-pin NodeMCU ESP32-S barely fits on a standard 830-point breadboard — only 1 free column remains on each side. Many makers use two breadboards side-by-side or a dedicated ESP32 breakout expansion board.',
  pinSpacing: 2.54,
  headerLayout: HEADER_LAYOUT,

  operatingVoltage: 3.3,
  inputVoltageRange: [4.5, 9],
  maxCurrentPerPin: 40,
  maxTotalCurrent: 1200,

  pins: ALL_PINS,
  buses: BUSES,

  evidence: [
    {
      type: 'datasheet',
      label: 'ESP32-WROOM-32 Datasheet v3.6 (Espressif)',
      href: 'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf',
      supports: ['pins', 'dimensions', 'labels'],
      confidence: 'high',
      reviewStatus: 'accepted',
    },
    {
      type: 'pinout',
      label: 'ESP-IDF GPIO & RTC GPIO Reference',
      href: 'https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/gpio.html',
      supports: ['pins', 'labels'],
      confidence: 'high',
      reviewStatus: 'accepted',
    },
    {
      type: 'pinout',
      label: 'ESP32 Pinout Reference — Random Nerd Tutorials',
      href: 'https://randomnerdtutorials.com/esp32-pinout-reference-gpios/',
      supports: ['pins', 'labels', 'breadboard-fit'],
      confidence: 'high',
      reviewStatus: 'accepted',
    },
    {
      type: 'pinout',
      label: 'ESP32 Strapping Pins — espboards.dev',
      href: 'https://www.espboards.dev/blog/esp32-strapping-pins/',
      supports: ['pins'],
      confidence: 'high',
      reviewStatus: 'accepted',
    },
  ],

  verificationNotes: [
    'GPIO 6-11 are connected to internal SPI flash — NEVER use these pins.',
    'GPIO 34, 35, 36 (VP), 39 (VN) are INPUT ONLY — no output, no pull resistors.',
    'ADC2 channels (GPIO 0, 2, 4, 12-15, 25-27) are UNAVAILABLE when WiFi is active. Always prefer ADC1 (GPIO 32-39) in WiFi applications.',
    '5 strapping pins (GPIO 0, 2, 5, 12, 15) affect boot behavior — see bootPins for details.',
    'GPIO12 is the most dangerous strapping pin: pulling HIGH at boot sets flash to 1.8V and crashes ESP-WROOM-32 modules.',
    'All SPI/I2C/UART pins are fully remappable via the ESP32 GPIO matrix — default assignments are conventions, not hardware constraints.',
    'ESP32 GPIOs are NOT 5V tolerant. Use level shifters when interfacing with 5V logic (e.g. Arduino Mega).',
    '16 PWM channels available via LEDC peripheral on any GPIO except 34-39 (input-only).',
    'Internal hall sensor uses GPIO36/39 — avoid external signals on these pins when using hallRead().',
  ],

  warnings: [
    'ESP32 GPIOs are 3.3V ONLY. Connecting 5V signals directly will damage the chip.',
    'Do not use GPIO 6-11 — they are connected to internal flash and will crash the module.',
    'GPIO12 HIGH at boot will set flash voltage to 1.8V and brick the boot process on most modules.',
    'ADC2 is completely disabled when WiFi is active — design around ADC1 channels.',
  ],

  bootPins: BOOT_PINS,
};
