/**
 * Custom Board Definitions Manager (BL-0614)
 *
 * Manages custom board definitions for Arduino/embedded targets.
 * Provides:
 *   - 6 MCU templates (ATmega328P, ATmega2560, ESP32, ESP32-S3, STM32F103, RP2040)
 *   - Pin definitions with capability flags (digital, analog, PWM, I2C, SPI, UART, DAC)
 *   - PCB-to-board inference from circuit instances
 *   - Board definition validation (pin conflicts, missing fields, capability consistency)
 *   - Code generation: PlatformIO platformio.ini, Arduino boards.txt, pins_arduino.h
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Pin capability flags. */
export type PinCapability = 'digital' | 'analog' | 'pwm' | 'i2c' | 'spi' | 'uart' | 'dac' | 'touch' | 'interrupt';

/** I2C role for a pin. */
export type I2CRole = 'SDA' | 'SCL';

/** SPI role for a pin. */
export type SPIRole = 'MOSI' | 'MISO' | 'SCK' | 'SS';

/** UART role for a pin. */
export type UARTRole = 'TX' | 'RX';

/** A single pin definition. */
export interface PinDefinition {
  /** Pin number (physical or logical). */
  readonly pin: number;
  /** Human-readable name (e.g., 'D13', 'A0', 'GPIO2'). */
  readonly name: string;
  /** GPIO number (may differ from physical pin). */
  readonly gpio: number;
  /** Capabilities this pin supports. */
  readonly capabilities: readonly PinCapability[];
  /** Analog channel number (if analog capable). */
  readonly analogChannel?: number;
  /** PWM channel/timer (if PWM capable). */
  readonly pwmChannel?: number;
  /** I2C bus index and role (if I2C capable). */
  readonly i2c?: { readonly bus: number; readonly role: I2CRole };
  /** SPI bus index and role (if SPI capable). */
  readonly spi?: { readonly bus: number; readonly role: SPIRole };
  /** UART index and role (if UART capable). */
  readonly uart?: { readonly index: number; readonly role: UARTRole };
}

/** MCU architecture type. */
export type McuArchitecture = 'avr' | 'esp32' | 'stm32' | 'rp2040';

/** MCU template with default pin definitions and specifications. */
export interface McuTemplate {
  readonly id: string;
  readonly name: string;
  readonly architecture: McuArchitecture;
  readonly clockSpeedMHz: number;
  readonly flashKB: number;
  readonly ramKB: number;
  readonly operatingVoltage: number;
  readonly pins: readonly PinDefinition[];
  /** Fully Qualified Board Name base. */
  readonly fqbnBase: string;
  /** Upload protocol. */
  readonly uploadProtocol: string;
  readonly uploadSpeed: number;
  /** Number of analog channels. */
  readonly adcChannels: number;
  /** ADC resolution in bits. */
  readonly adcResolution: number;
  /** Number of PWM channels. */
  readonly pwmChannels: number;
}

/** A custom board definition built from an MCU template. */
export interface CustomBoardDefinition {
  /** Unique identifier for this board. */
  readonly id: string;
  /** Human-readable board name. */
  readonly name: string;
  /** Base MCU template ID. */
  readonly mcuTemplateId: string;
  /** Custom pin mapping (overrides template defaults). */
  readonly pins: readonly PinDefinition[];
  /** Board variant name (used in code generation). */
  readonly variant: string;
  /** Custom FQBN. */
  readonly fqbn: string;
  /** User notes/description. */
  readonly description: string;
  /** Created timestamp (ISO string). */
  readonly createdAt: string;
  /** Updated timestamp (ISO string). */
  readonly updatedAt: string;
}

/** Validation issue for a board definition. */
export interface BoardValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly field: string;
  readonly message: string;
}

/** A circuit instance used for PCB-to-board inference. */
export interface CircuitInstanceForInference {
  readonly componentType: string;
  readonly properties?: Record<string, string | number>;
}

/** PlatformIO environment configuration. */
export interface PlatformIOConfig {
  readonly platform: string;
  readonly board: string;
  readonly framework: string;
  readonly uploadSpeed: number;
  readonly monitorSpeed: number;
  readonly buildFlags: readonly string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-custom-boards';

// ---------------------------------------------------------------------------
// MCU Templates
// ---------------------------------------------------------------------------

const ATMEGA328P_PINS: PinDefinition[] = [
  // Digital pins D0-D13
  { pin: 0, name: 'D0', gpio: 0, capabilities: ['digital', 'uart', 'interrupt'], uart: { index: 0, role: 'RX' } },
  { pin: 1, name: 'D1', gpio: 1, capabilities: ['digital', 'uart'], uart: { index: 0, role: 'TX' } },
  { pin: 2, name: 'D2', gpio: 2, capabilities: ['digital', 'interrupt'] },
  { pin: 3, name: 'D3', gpio: 3, capabilities: ['digital', 'pwm', 'interrupt'], pwmChannel: 2 },
  { pin: 4, name: 'D4', gpio: 4, capabilities: ['digital'] },
  { pin: 5, name: 'D5', gpio: 5, capabilities: ['digital', 'pwm'], pwmChannel: 0 },
  { pin: 6, name: 'D6', gpio: 6, capabilities: ['digital', 'pwm'], pwmChannel: 0 },
  { pin: 7, name: 'D7', gpio: 7, capabilities: ['digital'] },
  { pin: 8, name: 'D8', gpio: 8, capabilities: ['digital'] },
  { pin: 9, name: 'D9', gpio: 9, capabilities: ['digital', 'pwm'], pwmChannel: 1 },
  { pin: 10, name: 'D10', gpio: 10, capabilities: ['digital', 'pwm', 'spi'], pwmChannel: 1, spi: { bus: 0, role: 'SS' } },
  { pin: 11, name: 'D11', gpio: 11, capabilities: ['digital', 'pwm', 'spi'], pwmChannel: 2, spi: { bus: 0, role: 'MOSI' } },
  { pin: 12, name: 'D12', gpio: 12, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'MISO' } },
  { pin: 13, name: 'D13', gpio: 13, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'SCK' } },
  // Analog pins A0-A5
  { pin: 14, name: 'A0', gpio: 14, capabilities: ['digital', 'analog'], analogChannel: 0 },
  { pin: 15, name: 'A1', gpio: 15, capabilities: ['digital', 'analog'], analogChannel: 1 },
  { pin: 16, name: 'A2', gpio: 16, capabilities: ['digital', 'analog'], analogChannel: 2 },
  { pin: 17, name: 'A3', gpio: 17, capabilities: ['digital', 'analog'], analogChannel: 3 },
  { pin: 18, name: 'A4', gpio: 18, capabilities: ['digital', 'analog', 'i2c'], analogChannel: 4, i2c: { bus: 0, role: 'SDA' } },
  { pin: 19, name: 'A5', gpio: 19, capabilities: ['digital', 'analog', 'i2c'], analogChannel: 5, i2c: { bus: 0, role: 'SCL' } },
];

const ATMEGA2560_PINS: PinDefinition[] = [
  // Key digital pins (subset for template — full 54 digital + 16 analog)
  { pin: 0, name: 'D0', gpio: 0, capabilities: ['digital', 'uart', 'interrupt'], uart: { index: 0, role: 'RX' } },
  { pin: 1, name: 'D1', gpio: 1, capabilities: ['digital', 'uart'], uart: { index: 0, role: 'TX' } },
  { pin: 2, name: 'D2', gpio: 2, capabilities: ['digital', 'pwm', 'interrupt'], pwmChannel: 3 },
  { pin: 3, name: 'D3', gpio: 3, capabilities: ['digital', 'pwm', 'interrupt'], pwmChannel: 3 },
  { pin: 4, name: 'D4', gpio: 4, capabilities: ['digital', 'pwm'], pwmChannel: 0 },
  { pin: 5, name: 'D5', gpio: 5, capabilities: ['digital', 'pwm'], pwmChannel: 3 },
  { pin: 6, name: 'D6', gpio: 6, capabilities: ['digital', 'pwm'], pwmChannel: 4 },
  { pin: 7, name: 'D7', gpio: 7, capabilities: ['digital', 'pwm'], pwmChannel: 4 },
  { pin: 8, name: 'D8', gpio: 8, capabilities: ['digital', 'pwm'], pwmChannel: 4 },
  { pin: 9, name: 'D9', gpio: 9, capabilities: ['digital', 'pwm'], pwmChannel: 2 },
  { pin: 10, name: 'D10', gpio: 10, capabilities: ['digital', 'pwm'], pwmChannel: 2 },
  { pin: 11, name: 'D11', gpio: 11, capabilities: ['digital', 'pwm'], pwmChannel: 1 },
  { pin: 12, name: 'D12', gpio: 12, capabilities: ['digital', 'pwm'], pwmChannel: 1 },
  { pin: 13, name: 'D13', gpio: 13, capabilities: ['digital', 'pwm'], pwmChannel: 0 },
  { pin: 14, name: 'D14', gpio: 14, capabilities: ['digital', 'uart'], uart: { index: 3, role: 'TX' } },
  { pin: 15, name: 'D15', gpio: 15, capabilities: ['digital', 'uart'], uart: { index: 3, role: 'RX' } },
  { pin: 16, name: 'D16', gpio: 16, capabilities: ['digital', 'uart'], uart: { index: 2, role: 'TX' } },
  { pin: 17, name: 'D17', gpio: 17, capabilities: ['digital', 'uart'], uart: { index: 2, role: 'RX' } },
  { pin: 18, name: 'D18', gpio: 18, capabilities: ['digital', 'uart', 'interrupt'], uart: { index: 1, role: 'TX' } },
  { pin: 19, name: 'D19', gpio: 19, capabilities: ['digital', 'uart', 'interrupt'], uart: { index: 1, role: 'RX' } },
  { pin: 20, name: 'D20', gpio: 20, capabilities: ['digital', 'i2c', 'interrupt'], i2c: { bus: 0, role: 'SDA' } },
  { pin: 21, name: 'D21', gpio: 21, capabilities: ['digital', 'i2c', 'interrupt'], i2c: { bus: 0, role: 'SCL' } },
  { pin: 50, name: 'D50', gpio: 50, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'MISO' } },
  { pin: 51, name: 'D51', gpio: 51, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'MOSI' } },
  { pin: 52, name: 'D52', gpio: 52, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'SCK' } },
  { pin: 53, name: 'D53', gpio: 53, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'SS' } },
  // Analog pins A0-A15
  { pin: 54, name: 'A0', gpio: 54, capabilities: ['digital', 'analog'], analogChannel: 0 },
  { pin: 55, name: 'A1', gpio: 55, capabilities: ['digital', 'analog'], analogChannel: 1 },
  { pin: 56, name: 'A2', gpio: 56, capabilities: ['digital', 'analog'], analogChannel: 2 },
  { pin: 57, name: 'A3', gpio: 57, capabilities: ['digital', 'analog'], analogChannel: 3 },
  { pin: 58, name: 'A4', gpio: 58, capabilities: ['digital', 'analog'], analogChannel: 4 },
  { pin: 59, name: 'A5', gpio: 59, capabilities: ['digital', 'analog'], analogChannel: 5 },
  { pin: 60, name: 'A6', gpio: 60, capabilities: ['digital', 'analog'], analogChannel: 6 },
  { pin: 61, name: 'A7', gpio: 61, capabilities: ['digital', 'analog'], analogChannel: 7 },
];

const ESP32_PINS: PinDefinition[] = [
  { pin: 0, name: 'GPIO0', gpio: 0, capabilities: ['digital', 'analog', 'pwm', 'touch', 'interrupt'], analogChannel: 1, pwmChannel: 0 },
  { pin: 2, name: 'GPIO2', gpio: 2, capabilities: ['digital', 'analog', 'pwm', 'touch', 'interrupt'], analogChannel: 2, pwmChannel: 0 },
  { pin: 4, name: 'GPIO4', gpio: 4, capabilities: ['digital', 'analog', 'pwm', 'touch', 'interrupt'], analogChannel: 0, pwmChannel: 0 },
  { pin: 5, name: 'GPIO5', gpio: 5, capabilities: ['digital', 'pwm', 'spi'], pwmChannel: 0, spi: { bus: 0, role: 'SS' } },
  { pin: 12, name: 'GPIO12', gpio: 12, capabilities: ['digital', 'analog', 'pwm', 'touch', 'spi'], analogChannel: 5, pwmChannel: 1, spi: { bus: 1, role: 'MISO' } },
  { pin: 13, name: 'GPIO13', gpio: 13, capabilities: ['digital', 'analog', 'pwm', 'touch', 'spi'], analogChannel: 4, pwmChannel: 1, spi: { bus: 1, role: 'MOSI' } },
  { pin: 14, name: 'GPIO14', gpio: 14, capabilities: ['digital', 'analog', 'pwm', 'touch', 'spi'], analogChannel: 6, pwmChannel: 1, spi: { bus: 1, role: 'SCK' } },
  { pin: 15, name: 'GPIO15', gpio: 15, capabilities: ['digital', 'analog', 'pwm', 'touch', 'spi'], analogChannel: 3, pwmChannel: 1, spi: { bus: 1, role: 'SS' } },
  { pin: 16, name: 'GPIO16', gpio: 16, capabilities: ['digital', 'pwm', 'uart'], pwmChannel: 2, uart: { index: 2, role: 'RX' } },
  { pin: 17, name: 'GPIO17', gpio: 17, capabilities: ['digital', 'pwm', 'uart'], pwmChannel: 2, uart: { index: 2, role: 'TX' } },
  { pin: 18, name: 'GPIO18', gpio: 18, capabilities: ['digital', 'pwm', 'spi'], pwmChannel: 2, spi: { bus: 0, role: 'SCK' } },
  { pin: 19, name: 'GPIO19', gpio: 19, capabilities: ['digital', 'pwm', 'spi'], pwmChannel: 2, spi: { bus: 0, role: 'MISO' } },
  { pin: 21, name: 'GPIO21', gpio: 21, capabilities: ['digital', 'pwm', 'i2c'], pwmChannel: 3, i2c: { bus: 0, role: 'SDA' } },
  { pin: 22, name: 'GPIO22', gpio: 22, capabilities: ['digital', 'pwm', 'i2c'], pwmChannel: 3, i2c: { bus: 0, role: 'SCL' } },
  { pin: 23, name: 'GPIO23', gpio: 23, capabilities: ['digital', 'pwm', 'spi'], pwmChannel: 3, spi: { bus: 0, role: 'MOSI' } },
  { pin: 25, name: 'GPIO25', gpio: 25, capabilities: ['digital', 'analog', 'pwm', 'dac'], analogChannel: 8, pwmChannel: 4 },
  { pin: 26, name: 'GPIO26', gpio: 26, capabilities: ['digital', 'analog', 'pwm', 'dac'], analogChannel: 9, pwmChannel: 4 },
  { pin: 27, name: 'GPIO27', gpio: 27, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 7, pwmChannel: 4 },
  { pin: 32, name: 'GPIO32', gpio: 32, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 4, pwmChannel: 5 },
  { pin: 33, name: 'GPIO33', gpio: 33, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 5, pwmChannel: 5 },
  { pin: 34, name: 'GPIO34', gpio: 34, capabilities: ['digital', 'analog'], analogChannel: 6 },
  { pin: 35, name: 'GPIO35', gpio: 35, capabilities: ['digital', 'analog'], analogChannel: 7 },
  { pin: 36, name: 'GPIO36', gpio: 36, capabilities: ['digital', 'analog'], analogChannel: 0 },
  { pin: 39, name: 'GPIO39', gpio: 39, capabilities: ['digital', 'analog'], analogChannel: 3 },
  // UART0
  { pin: 1, name: 'GPIO1', gpio: 1, capabilities: ['digital', 'uart'], uart: { index: 0, role: 'TX' } },
  { pin: 3, name: 'GPIO3', gpio: 3, capabilities: ['digital', 'uart'], uart: { index: 0, role: 'RX' } },
];

const ESP32S3_PINS: PinDefinition[] = [
  { pin: 0, name: 'GPIO0', gpio: 0, capabilities: ['digital', 'pwm', 'interrupt'] },
  { pin: 1, name: 'GPIO1', gpio: 1, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 0, pwmChannel: 0 },
  { pin: 2, name: 'GPIO2', gpio: 2, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 1, pwmChannel: 0 },
  { pin: 3, name: 'GPIO3', gpio: 3, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 2, pwmChannel: 0 },
  { pin: 4, name: 'GPIO4', gpio: 4, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 3, pwmChannel: 1 },
  { pin: 5, name: 'GPIO5', gpio: 5, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 4, pwmChannel: 1 },
  { pin: 6, name: 'GPIO6', gpio: 6, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 5, pwmChannel: 1 },
  { pin: 7, name: 'GPIO7', gpio: 7, capabilities: ['digital', 'analog', 'pwm', 'touch'], analogChannel: 6, pwmChannel: 2 },
  { pin: 8, name: 'GPIO8', gpio: 8, capabilities: ['digital', 'analog', 'pwm'], analogChannel: 7 },
  { pin: 9, name: 'GPIO9', gpio: 9, capabilities: ['digital', 'analog', 'pwm'], analogChannel: 8 },
  { pin: 10, name: 'GPIO10', gpio: 10, capabilities: ['digital', 'analog', 'pwm', 'spi'], analogChannel: 9, spi: { bus: 1, role: 'SS' } },
  { pin: 11, name: 'GPIO11', gpio: 11, capabilities: ['digital', 'spi'], spi: { bus: 1, role: 'MOSI' } },
  { pin: 12, name: 'GPIO12', gpio: 12, capabilities: ['digital', 'spi'], spi: { bus: 1, role: 'SCK' } },
  { pin: 13, name: 'GPIO13', gpio: 13, capabilities: ['digital', 'spi'], spi: { bus: 1, role: 'MISO' } },
  { pin: 17, name: 'GPIO17', gpio: 17, capabilities: ['digital', 'uart', 'pwm'], uart: { index: 1, role: 'TX' } },
  { pin: 18, name: 'GPIO18', gpio: 18, capabilities: ['digital', 'uart', 'pwm'], uart: { index: 1, role: 'RX' } },
  { pin: 21, name: 'GPIO21', gpio: 21, capabilities: ['digital', 'pwm', 'i2c'], i2c: { bus: 0, role: 'SDA' } },
  { pin: 36, name: 'GPIO36', gpio: 36, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'SCK' } },
  { pin: 37, name: 'GPIO37', gpio: 37, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'MOSI' } },
  { pin: 38, name: 'GPIO38', gpio: 38, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'MISO' } },
  { pin: 43, name: 'GPIO43', gpio: 43, capabilities: ['digital', 'uart'], uart: { index: 0, role: 'TX' } },
  { pin: 44, name: 'GPIO44', gpio: 44, capabilities: ['digital', 'uart'], uart: { index: 0, role: 'RX' } },
  { pin: 47, name: 'GPIO47', gpio: 47, capabilities: ['digital', 'pwm', 'i2c'], i2c: { bus: 0, role: 'SCL' } },
  { pin: 48, name: 'GPIO48', gpio: 48, capabilities: ['digital', 'pwm'] },
];

const STM32F103_PINS: PinDefinition[] = [
  // Port A
  { pin: 0, name: 'PA0', gpio: 0, capabilities: ['digital', 'analog', 'pwm', 'interrupt'], analogChannel: 0, pwmChannel: 2 },
  { pin: 1, name: 'PA1', gpio: 1, capabilities: ['digital', 'analog', 'pwm'], analogChannel: 1, pwmChannel: 2 },
  { pin: 2, name: 'PA2', gpio: 2, capabilities: ['digital', 'analog', 'pwm', 'uart'], analogChannel: 2, pwmChannel: 2, uart: { index: 1, role: 'TX' } },
  { pin: 3, name: 'PA3', gpio: 3, capabilities: ['digital', 'analog', 'pwm', 'uart'], analogChannel: 3, pwmChannel: 2, uart: { index: 1, role: 'RX' } },
  { pin: 4, name: 'PA4', gpio: 4, capabilities: ['digital', 'analog', 'spi', 'dac'], analogChannel: 4, spi: { bus: 0, role: 'SS' } },
  { pin: 5, name: 'PA5', gpio: 5, capabilities: ['digital', 'analog', 'spi', 'dac'], analogChannel: 5, spi: { bus: 0, role: 'SCK' } },
  { pin: 6, name: 'PA6', gpio: 6, capabilities: ['digital', 'analog', 'pwm', 'spi'], analogChannel: 6, pwmChannel: 3, spi: { bus: 0, role: 'MISO' } },
  { pin: 7, name: 'PA7', gpio: 7, capabilities: ['digital', 'analog', 'pwm', 'spi'], analogChannel: 7, pwmChannel: 3, spi: { bus: 0, role: 'MOSI' } },
  { pin: 8, name: 'PA8', gpio: 8, capabilities: ['digital', 'pwm'], pwmChannel: 1 },
  { pin: 9, name: 'PA9', gpio: 9, capabilities: ['digital', 'pwm', 'uart'], pwmChannel: 1, uart: { index: 0, role: 'TX' } },
  { pin: 10, name: 'PA10', gpio: 10, capabilities: ['digital', 'pwm', 'uart'], pwmChannel: 1, uart: { index: 0, role: 'RX' } },
  { pin: 11, name: 'PA11', gpio: 11, capabilities: ['digital', 'pwm'], pwmChannel: 1 },
  { pin: 13, name: 'PA13', gpio: 13, capabilities: ['digital'] },
  { pin: 14, name: 'PA14', gpio: 14, capabilities: ['digital'] },
  { pin: 15, name: 'PA15', gpio: 15, capabilities: ['digital', 'spi'], spi: { bus: 0, role: 'SS' } },
  // Port B
  { pin: 16, name: 'PB0', gpio: 16, capabilities: ['digital', 'analog', 'pwm'], analogChannel: 8, pwmChannel: 3 },
  { pin: 17, name: 'PB1', gpio: 17, capabilities: ['digital', 'analog', 'pwm'], analogChannel: 9, pwmChannel: 3 },
  { pin: 22, name: 'PB6', gpio: 22, capabilities: ['digital', 'pwm', 'i2c'], pwmChannel: 4, i2c: { bus: 0, role: 'SCL' } },
  { pin: 23, name: 'PB7', gpio: 23, capabilities: ['digital', 'pwm', 'i2c'], pwmChannel: 4, i2c: { bus: 0, role: 'SDA' } },
  { pin: 26, name: 'PB10', gpio: 26, capabilities: ['digital', 'uart', 'i2c'], uart: { index: 2, role: 'TX' }, i2c: { bus: 1, role: 'SCL' } },
  { pin: 27, name: 'PB11', gpio: 27, capabilities: ['digital', 'uart', 'i2c'], uart: { index: 2, role: 'RX' }, i2c: { bus: 1, role: 'SDA' } },
];

/** Mutable builder type for constructing PinDefinition objects. */
type MutablePin = {
  pin: number;
  name: string;
  gpio: number;
  capabilities: PinCapability[];
  pwmChannel?: number;
  analogChannel?: number;
  i2c?: { bus: number; role: I2CRole };
  spi?: { bus: number; role: SPIRole };
  uart?: { index: number; role: UARTRole };
};

const RP2040_PINS: PinDefinition[] = Array.from({ length: 30 }, (_, i): PinDefinition => {
  const pin: MutablePin = {
    pin: i,
    name: `GP${i}`,
    gpio: i,
    capabilities: ['digital', 'pwm', 'interrupt'],
    pwmChannel: Math.floor(i / 2), // RP2040: 8 PWM slices, 2 channels each
  };

  // ADC channels on GP26-GP29
  if (i >= 26 && i <= 29) {
    pin.capabilities.push('analog');
    pin.analogChannel = i - 26;
  }

  // I2C: GP0/GP1 = I2C0, GP2/GP3 = I2C1
  if (i === 0) { pin.capabilities.push('i2c'); pin.i2c = { bus: 0, role: 'SDA' }; }
  if (i === 1) { pin.capabilities.push('i2c'); pin.i2c = { bus: 0, role: 'SCL' }; }
  if (i === 2) { pin.capabilities.push('i2c'); pin.i2c = { bus: 1, role: 'SDA' }; }
  if (i === 3) { pin.capabilities.push('i2c'); pin.i2c = { bus: 1, role: 'SCL' }; }

  // SPI: GP16-GP19 = SPI0
  if (i === 16) { pin.capabilities.push('spi'); pin.spi = { bus: 0, role: 'MISO' }; }
  if (i === 17) { pin.capabilities.push('spi'); pin.spi = { bus: 0, role: 'SS' }; }
  if (i === 18) { pin.capabilities.push('spi'); pin.spi = { bus: 0, role: 'SCK' }; }
  if (i === 19) { pin.capabilities.push('spi'); pin.spi = { bus: 0, role: 'MOSI' }; }

  // UART: GP0/GP1 = UART0 TX/RX, GP4/GP5 = UART1 TX/RX
  if (i === 0) { pin.capabilities.push('uart'); pin.uart = { index: 0, role: 'TX' }; }
  if (i === 1) { pin.capabilities.push('uart'); pin.uart = { index: 0, role: 'RX' }; }
  if (i === 4) { pin.capabilities.push('uart'); pin.uart = { index: 1, role: 'TX' }; }
  if (i === 5) { pin.capabilities.push('uart'); pin.uart = { index: 1, role: 'RX' }; }

  return pin;
});

export const MCU_TEMPLATES: readonly McuTemplate[] = [
  {
    id: 'atmega328p',
    name: 'ATmega328P',
    architecture: 'avr',
    clockSpeedMHz: 16,
    flashKB: 32,
    ramKB: 2,
    operatingVoltage: 5.0,
    pins: ATMEGA328P_PINS,
    fqbnBase: 'arduino:avr:uno',
    uploadProtocol: 'arduino',
    uploadSpeed: 115200,
    adcChannels: 6,
    adcResolution: 10,
    pwmChannels: 6,
  },
  {
    id: 'atmega2560',
    name: 'ATmega2560',
    architecture: 'avr',
    clockSpeedMHz: 16,
    flashKB: 256,
    ramKB: 8,
    operatingVoltage: 5.0,
    pins: ATMEGA2560_PINS,
    fqbnBase: 'arduino:avr:mega',
    uploadProtocol: 'wiring',
    uploadSpeed: 115200,
    adcChannels: 16,
    adcResolution: 10,
    pwmChannels: 15,
  },
  {
    id: 'esp32',
    name: 'ESP32',
    architecture: 'esp32',
    clockSpeedMHz: 240,
    flashKB: 4096,
    ramKB: 520,
    operatingVoltage: 3.3,
    pins: ESP32_PINS,
    fqbnBase: 'esp32:esp32:esp32',
    uploadProtocol: 'esptool',
    uploadSpeed: 921600,
    adcChannels: 18,
    adcResolution: 12,
    pwmChannels: 16,
  },
  {
    id: 'esp32s3',
    name: 'ESP32-S3',
    architecture: 'esp32',
    clockSpeedMHz: 240,
    flashKB: 8192,
    ramKB: 512,
    operatingVoltage: 3.3,
    pins: ESP32S3_PINS,
    fqbnBase: 'esp32:esp32:esp32s3',
    uploadProtocol: 'esptool',
    uploadSpeed: 921600,
    adcChannels: 20,
    adcResolution: 12,
    pwmChannels: 8,
  },
  {
    id: 'stm32f103',
    name: 'STM32F103',
    architecture: 'stm32',
    clockSpeedMHz: 72,
    flashKB: 64,
    ramKB: 20,
    operatingVoltage: 3.3,
    pins: STM32F103_PINS,
    fqbnBase: 'stm32duino:stm32:bluepill_f103c8',
    uploadProtocol: 'stlink',
    uploadSpeed: 115200,
    adcChannels: 10,
    adcResolution: 12,
    pwmChannels: 15,
  },
  {
    id: 'rp2040',
    name: 'RP2040',
    architecture: 'rp2040',
    clockSpeedMHz: 133,
    flashKB: 2048,
    ramKB: 264,
    operatingVoltage: 3.3,
    pins: RP2040_PINS,
    fqbnBase: 'rp2040:rp2040:rpipico',
    uploadProtocol: 'picotool',
    uploadSpeed: 115200,
    adcChannels: 4,
    adcResolution: 12,
    pwmChannels: 16,
  },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a custom board definition.
 * Returns an array of issues (empty = valid).
 */
export function validateBoardDefinition(board: CustomBoardDefinition): BoardValidationIssue[] {
  const issues: BoardValidationIssue[] = [];

  // Required fields
  if (!board.id.trim()) {
    issues.push({ severity: 'error', field: 'id', message: 'Board ID is required.' });
  }
  if (!board.name.trim()) {
    issues.push({ severity: 'error', field: 'name', message: 'Board name is required.' });
  }
  if (!board.variant.trim()) {
    issues.push({ severity: 'error', field: 'variant', message: 'Variant name is required.' });
  }
  if (!board.fqbn.trim()) {
    issues.push({ severity: 'error', field: 'fqbn', message: 'FQBN is required.' });
  }

  // FQBN format: vendor:arch:board
  const fqbnRegex = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/;
  if (board.fqbn.trim() && !fqbnRegex.test(board.fqbn)) {
    issues.push({ severity: 'error', field: 'fqbn', message: 'FQBN must match format vendor:arch:board.' });
  }

  // Variant name: alphanumeric + underscores only
  const variantRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  if (board.variant.trim() && !variantRegex.test(board.variant)) {
    issues.push({ severity: 'error', field: 'variant', message: 'Variant must start with a letter and contain only alphanumeric and underscores.' });
  }

  // MCU template must exist
  const template = MCU_TEMPLATES.find((t) => t.id === board.mcuTemplateId);
  if (!template) {
    issues.push({ severity: 'error', field: 'mcuTemplateId', message: `Unknown MCU template: ${board.mcuTemplateId}.` });
  }

  // Pin validation
  if (board.pins.length === 0) {
    issues.push({ severity: 'warning', field: 'pins', message: 'Board has no pin definitions.' });
  }

  // Check for duplicate pin numbers
  const pinNumbers = new Set<number>();
  for (const pin of board.pins) {
    if (pinNumbers.has(pin.pin)) {
      issues.push({ severity: 'error', field: 'pins', message: `Duplicate pin number: ${pin.pin} (${pin.name}).` });
    }
    pinNumbers.add(pin.pin);
  }

  // Check for duplicate pin names
  const pinNames = new Set<string>();
  for (const pin of board.pins) {
    if (pinNames.has(pin.name)) {
      issues.push({ severity: 'error', field: 'pins', message: `Duplicate pin name: ${pin.name}.` });
    }
    pinNames.add(pin.name);
  }

  // Check capability consistency
  for (const pin of board.pins) {
    if (pin.capabilities.includes('analog') && pin.analogChannel === undefined) {
      issues.push({
        severity: 'warning',
        field: 'pins',
        message: `Pin ${pin.name} has analog capability but no analogChannel defined.`,
      });
    }
    if (pin.capabilities.includes('i2c') && !pin.i2c) {
      issues.push({
        severity: 'warning',
        field: 'pins',
        message: `Pin ${pin.name} has I2C capability but no I2C role defined.`,
      });
    }
    if (pin.capabilities.includes('spi') && !pin.spi) {
      issues.push({
        severity: 'warning',
        field: 'pins',
        message: `Pin ${pin.name} has SPI capability but no SPI role defined.`,
      });
    }
    if (pin.capabilities.includes('uart') && !pin.uart) {
      issues.push({
        severity: 'warning',
        field: 'pins',
        message: `Pin ${pin.name} has UART capability but no UART role defined.`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// PCB-to-Board Inference
// ---------------------------------------------------------------------------

/** MCU identifier patterns for inference. */
const MCU_PATTERNS: { pattern: RegExp; templateId: string }[] = [
  { pattern: /atmega328/i, templateId: 'atmega328p' },
  { pattern: /atmega2560/i, templateId: 'atmega2560' },
  { pattern: /esp32[\s-]?s3/i, templateId: 'esp32s3' },
  { pattern: /esp32/i, templateId: 'esp32' },
  { pattern: /stm32f103/i, templateId: 'stm32f103' },
  { pattern: /rp2040/i, templateId: 'rp2040' },
];

/**
 * Infers the MCU template from circuit instances.
 * Examines component types and properties for MCU identifiers.
 * Returns the matching template ID or null.
 */
export function inferMcuFromCircuit(instances: readonly CircuitInstanceForInference[]): string | null {
  for (const instance of instances) {
    const searchText = [
      instance.componentType,
      ...Object.values(instance.properties ?? {}),
    ].join(' ');

    for (const { pattern, templateId } of MCU_PATTERNS) {
      if (pattern.test(searchText)) {
        return templateId;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Code Generation — PlatformIO platformio.ini
// ---------------------------------------------------------------------------

/**
 * Generates a PlatformIO platformio.ini configuration for a custom board.
 */
export function generatePlatformIOConfig(board: CustomBoardDefinition): string {
  const template = MCU_TEMPLATES.find((t) => t.id === board.mcuTemplateId);
  if (!template) {
    throw new Error(`Unknown MCU template: ${board.mcuTemplateId}`);
  }

  const platformMap: Record<McuArchitecture, string> = {
    avr: 'atmelavr',
    esp32: 'espressif32',
    stm32: 'ststm32',
    rp2040: 'raspberrypi',
  };

  const frameworkMap: Record<McuArchitecture, string> = {
    avr: 'arduino',
    esp32: 'arduino',
    stm32: 'arduino',
    rp2040: 'arduino',
  };

  const lines: string[] = [
    `; PlatformIO configuration for ${board.name}`,
    `; Generated by ProtoPulse — Custom Board Definitions`,
    `; MCU: ${template.name} @ ${template.clockSpeedMHz}MHz`,
    '',
    '[env:default]',
    `platform = ${platformMap[template.architecture]}`,
    `board = ${board.variant}`,
    `framework = ${frameworkMap[template.architecture]}`,
    `upload_speed = ${template.uploadSpeed}`,
    `monitor_speed = 115200`,
    `upload_protocol = ${template.uploadProtocol}`,
  ];

  // Build flags
  const flags: string[] = [`-D${board.variant.toUpperCase()}`];
  if (template.architecture === 'esp32') {
    flags.push(`-DBOARD_HAS_PSRAM`);
  }
  lines.push(`build_flags = ${flags.join(' ')}`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Code Generation — Arduino boards.txt
// ---------------------------------------------------------------------------

/**
 * Generates an Arduino boards.txt entry for a custom board.
 */
export function generateBoardsTxt(board: CustomBoardDefinition): string {
  const template = MCU_TEMPLATES.find((t) => t.id === board.mcuTemplateId);
  if (!template) {
    throw new Error(`Unknown MCU template: ${board.mcuTemplateId}`);
  }

  const mcuMap: Record<string, string> = {
    atmega328p: 'atmega328p',
    atmega2560: 'atmega2560',
    esp32: 'esp32',
    esp32s3: 'esp32s3',
    stm32f103: 'STM32F103C8',
    rp2040: 'rp2040',
  };

  const prefix = board.variant;
  const lines: string[] = [
    `## ${board.name}`,
    `## Generated by ProtoPulse — Custom Board Definitions`,
    '',
    `${prefix}.name=${board.name}`,
    '',
    `${prefix}.upload.tool=${template.uploadProtocol}`,
    `${prefix}.upload.protocol=${template.uploadProtocol}`,
    `${prefix}.upload.maximum_size=${template.flashKB * 1024}`,
    `${prefix}.upload.speed=${template.uploadSpeed}`,
    '',
    `${prefix}.build.mcu=${mcuMap[template.id] ?? template.id}`,
    `${prefix}.build.f_cpu=${template.clockSpeedMHz * 1000000}L`,
    `${prefix}.build.board=${board.variant.toUpperCase()}`,
    `${prefix}.build.core=arduino`,
    `${prefix}.build.variant=${board.variant}`,
  ];

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Code Generation — pins_arduino.h
// ---------------------------------------------------------------------------

/**
 * Generates a pins_arduino.h header file for a custom board.
 */
export function generatePinsArduinoH(board: CustomBoardDefinition): string {
  const template = MCU_TEMPLATES.find((t) => t.id === board.mcuTemplateId);
  if (!template) {
    throw new Error(`Unknown MCU template: ${board.mcuTemplateId}`);
  }

  const guard = `PINS_${board.variant.toUpperCase()}_H`;
  const lines: string[] = [
    `/*`,
    ` * pins_arduino.h — ${board.name}`,
    ` * Generated by ProtoPulse — Custom Board Definitions`,
    ` * MCU: ${template.name}`,
    ` */`,
    '',
    `#ifndef ${guard}`,
    `#define ${guard}`,
    '',
    `#include <stdint.h>`,
    '',
  ];

  // Counts
  const digitalPins = board.pins.filter((p) => p.capabilities.includes('digital'));
  const analogPins = board.pins.filter((p) => p.capabilities.includes('analog'));
  const pwmPins = board.pins.filter((p) => p.capabilities.includes('pwm'));

  lines.push(`#define NUM_DIGITAL_PINS  ${digitalPins.length}`);
  lines.push(`#define NUM_ANALOG_INPUTS ${analogPins.length}`);
  lines.push(`#define NUM_PWM_PINS      ${pwmPins.length}`);
  lines.push('');

  // LED pin (default to pin 13 if it exists, otherwise first digital pin)
  const ledPin = board.pins.find((p) => p.gpio === 13) ?? board.pins[0];
  if (ledPin) {
    lines.push(`#define LED_BUILTIN ${ledPin.gpio}`);
    lines.push('');
  }

  // Analog pin defines (A0, A1, ...)
  if (analogPins.length > 0) {
    lines.push('/* Analog pins */');
    for (const pin of analogPins) {
      const aName = `A${pin.analogChannel ?? 0}`;
      lines.push(`#define PIN_${aName} ${pin.gpio}`);
    }
    lines.push('');
    lines.push(`static const uint8_t ${analogPins.map((p) => `A${p.analogChannel ?? 0}`).join(', ')} = ${analogPins.map((p) => String(p.gpio)).join(', ')};`);
    lines.push('');
  }

  // I2C pins
  const sdaPins = board.pins.filter((p) => p.i2c?.role === 'SDA');
  const sclPins = board.pins.filter((p) => p.i2c?.role === 'SCL');
  if (sdaPins.length > 0 && sclPins.length > 0) {
    lines.push('/* I2C */');
    lines.push(`#define PIN_WIRE_SDA ${sdaPins[0].gpio}`);
    lines.push(`#define PIN_WIRE_SCL ${sclPins[0].gpio}`);
    lines.push(`static const uint8_t SDA = PIN_WIRE_SDA;`);
    lines.push(`static const uint8_t SCL = PIN_WIRE_SCL;`);
    lines.push('');
  }

  // SPI pins
  const mosiPin = board.pins.find((p) => p.spi?.role === 'MOSI');
  const misoPin = board.pins.find((p) => p.spi?.role === 'MISO');
  const sckPin = board.pins.find((p) => p.spi?.role === 'SCK');
  const ssPin = board.pins.find((p) => p.spi?.role === 'SS');
  if (mosiPin && misoPin && sckPin) {
    lines.push('/* SPI */');
    lines.push(`#define PIN_SPI_MOSI ${mosiPin.gpio}`);
    lines.push(`#define PIN_SPI_MISO ${misoPin.gpio}`);
    lines.push(`#define PIN_SPI_SCK  ${sckPin.gpio}`);
    if (ssPin) {
      lines.push(`#define PIN_SPI_SS   ${ssPin.gpio}`);
    }
    lines.push(`static const uint8_t MOSI = PIN_SPI_MOSI;`);
    lines.push(`static const uint8_t MISO = PIN_SPI_MISO;`);
    lines.push(`static const uint8_t SCK  = PIN_SPI_SCK;`);
    if (ssPin) {
      lines.push(`static const uint8_t SS   = PIN_SPI_SS;`);
    }
    lines.push('');
  }

  // UART pins
  const txPin = board.pins.find((p) => p.uart?.index === 0 && p.uart?.role === 'TX');
  const rxPin = board.pins.find((p) => p.uart?.index === 0 && p.uart?.role === 'RX');
  if (txPin && rxPin) {
    lines.push('/* UART */');
    lines.push(`#define PIN_SERIAL_TX ${txPin.gpio}`);
    lines.push(`#define PIN_SERIAL_RX ${rxPin.gpio}`);
    lines.push('');
  }

  lines.push(`#endif /* ${guard} */`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// CustomBoardManager (singleton + subscribe)
// ---------------------------------------------------------------------------

export class CustomBoardManager {
  private boards: CustomBoardDefinition[] = [];
  private listeners = new Set<Listener>();

  // Singleton
  private static instance: CustomBoardManager | null = null;

  static getInstance(): CustomBoardManager {
    if (!CustomBoardManager.instance) {
      CustomBoardManager.instance = new CustomBoardManager();
      CustomBoardManager.instance.loadFromStorage();
    }
    return CustomBoardManager.instance;
  }

  static resetInstance(): void {
    CustomBoardManager.instance = null;
  }

  // Subscribe pattern
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    this.listeners.forEach((fn) => { fn(); });
  }

  getBoards(): readonly CustomBoardDefinition[] {
    return this.boards;
  }

  getBoard(id: string): CustomBoardDefinition | undefined {
    return this.boards.find((b) => b.id === id);
  }

  getTemplates(): readonly McuTemplate[] {
    return MCU_TEMPLATES;
  }

  getTemplate(id: string): McuTemplate | undefined {
    return MCU_TEMPLATES.find((t) => t.id === id);
  }

  /**
   * Create a new custom board from an MCU template.
   */
  createBoard(
    name: string,
    mcuTemplateId: string,
    variant: string,
    description: string = '',
  ): CustomBoardDefinition {
    const template = MCU_TEMPLATES.find((t) => t.id === mcuTemplateId);
    if (!template) {
      throw new Error(`Unknown MCU template: ${mcuTemplateId}`);
    }

    const now = new Date().toISOString();
    const board: CustomBoardDefinition = {
      id: crypto.randomUUID(),
      name,
      mcuTemplateId,
      pins: [...template.pins],
      variant,
      fqbn: `custom:${template.architecture}:${variant}`,
      description,
      createdAt: now,
      updatedAt: now,
    };

    this.boards.push(board);
    this.saveToStorage();
    this.notify();

    return board;
  }

  /**
   * Update an existing board definition.
   */
  updateBoard(id: string, updates: Partial<Pick<CustomBoardDefinition, 'name' | 'pins' | 'variant' | 'fqbn' | 'description'>>): CustomBoardDefinition {
    const idx = this.boards.findIndex((b) => b.id === id);
    if (idx === -1) {
      throw new Error(`Board not found: ${id}`);
    }

    const existing = this.boards[idx];
    const updated: CustomBoardDefinition = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.boards[idx] = updated;
    this.saveToStorage();
    this.notify();

    return updated;
  }

  /**
   * Delete a board definition.
   */
  deleteBoard(id: string): boolean {
    const idx = this.boards.findIndex((b) => b.id === id);
    if (idx === -1) {
      return false;
    }

    this.boards.splice(idx, 1);
    this.saveToStorage();
    this.notify();

    return true;
  }

  /**
   * Validate a board definition.
   */
  validate(id: string): BoardValidationIssue[] {
    const board = this.getBoard(id);
    if (!board) {
      return [{ severity: 'error', field: 'id', message: `Board not found: ${id}` }];
    }
    return validateBoardDefinition(board);
  }

  /**
   * Infer an MCU template from circuit instances.
   */
  inferFromCircuit(instances: readonly CircuitInstanceForInference[]): McuTemplate | null {
    const templateId = inferMcuFromCircuit(instances);
    if (!templateId) {
      return null;
    }
    return MCU_TEMPLATES.find((t) => t.id === templateId) ?? null;
  }

  /**
   * Generate PlatformIO config for a board.
   */
  generatePlatformIO(id: string): string {
    const board = this.getBoard(id);
    if (!board) {
      throw new Error(`Board not found: ${id}`);
    }
    return generatePlatformIOConfig(board);
  }

  /**
   * Generate Arduino boards.txt entry for a board.
   */
  generateBoardsTxt(id: string): string {
    const board = this.getBoard(id);
    if (!board) {
      throw new Error(`Board not found: ${id}`);
    }
    return generateBoardsTxt(board);
  }

  /**
   * Generate pins_arduino.h for a board.
   */
  generatePinsHeader(id: string): string {
    const board = this.getBoard(id);
    if (!board) {
      throw new Error(`Board not found: ${id}`);
    }
    return generatePinsArduinoH(board);
  }

  /**
   * Export a board definition as JSON.
   */
  exportBoard(id: string): string {
    const board = this.getBoard(id);
    if (!board) {
      throw new Error(`Board not found: ${id}`);
    }
    return JSON.stringify({ version: 1, board }, null, 2);
  }

  /**
   * Import a board definition from JSON.
   */
  importBoard(json: string): CustomBoardDefinition {
    const parsed = JSON.parse(json) as { version: number; board: CustomBoardDefinition };
    if (parsed.version !== 1 || !parsed.board) {
      throw new Error('Invalid board definition format.');
    }

    const board: CustomBoardDefinition = {
      ...parsed.board,
      id: crypto.randomUUID(), // Generate new ID to avoid conflicts
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate before importing
    const issues = validateBoardDefinition(board);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      throw new Error(`Invalid board definition: ${errors.map((e) => e.message).join('; ')}`);
    }

    this.boards.push(board);
    this.saveToStorage();
    this.notify();

    return board;
  }

  // Storage helpers
  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CustomBoardDefinition[];
        if (Array.isArray(parsed)) {
          this.boards = parsed;
        }
      }
    } catch {
      // Ignore parse errors — start with empty list
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.boards));
    } catch {
      // Ignore storage errors
    }
  }
}
