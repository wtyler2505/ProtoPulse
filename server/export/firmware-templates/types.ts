/**
 * Board template type definitions for firmware scaffold generation.
 *
 * These types describe the physical capabilities of a specific development
 * board — its pins, buses, supported peripherals, and PlatformIO configuration.
 * Board templates allow the firmware generator to produce accurate,
 * board-specific code instead of generic Arduino scaffolding.
 */

// ---------------------------------------------------------------------------
// Pin capabilities
// ---------------------------------------------------------------------------

/** All capabilities a pin may support. */
export type PinCapability =
  | 'digital'
  | 'analog'
  | 'pwm'
  | 'i2c_sda'
  | 'i2c_scl'
  | 'spi_mosi'
  | 'spi_miso'
  | 'spi_sck'
  | 'spi_cs'
  | 'uart_tx'
  | 'uart_rx'
  | 'dac'
  | 'touch'
  | 'adc';

// ---------------------------------------------------------------------------
// Pin definition
// ---------------------------------------------------------------------------

export interface PinDefinition {
  /** Physical or logical pin number/name on the board (e.g. 2, 'A0', 'GPIO2', 'PA5'). */
  pin: number | string;
  /** Human-readable pin name (e.g. 'GPIO2', 'D13', 'PA5'). */
  name: string;
  /** Capabilities this pin supports. */
  capabilities: PinCapability[];
  /** ADC channel index, if the pin has ADC capability. */
  adcChannel?: number;
  /** PWM channel/timer index, if the pin supports hardware PWM. */
  pwmChannel?: number;
  /** Optional note (e.g. "onboard LED", "strapping pin — avoid for input"). */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Bus definition
// ---------------------------------------------------------------------------

export interface BusDefinition {
  /** Bus protocol type. */
  type: 'i2c' | 'spi' | 'uart';
  /** Arduino-level peripheral name (e.g. 'Wire', 'Wire1', 'Serial1', 'SPI'). */
  name: string;
  /** Pin assignments for this bus instance. */
  pins: ReadonlyArray<{ role: string; pin: string }>;
}

// ---------------------------------------------------------------------------
// Board template
// ---------------------------------------------------------------------------

export interface BoardTemplate {
  /** Unique identifier (e.g. 'esp32-devkit', 'arduino-mega'). */
  boardId: string;
  /** Display-friendly name (e.g. 'ESP32 DevKit V1'). */
  displayName: string;
  /** Build platform for PlatformIO / Arduino CLI. */
  platform: 'arduino' | 'platformio';
  /** MCU chip identifier (e.g. 'ESP32', 'ATmega2560'). */
  mcu: string;
  /** Complete pin map for the board. */
  pins: PinDefinition[];
  /** Available hardware buses with their default pin assignments. */
  buses: BusDefinition[];
  /** Libraries that should be suggested by default for this board. */
  defaultLibraries: string[];
  /** PlatformIO board identifier (e.g. 'esp32dev', 'megaatmega2560'). */
  platformioBoard: string;
  /** PlatformIO platform string (e.g. 'espressif32', 'atmelavr'). */
  platformioPlatform: string;
  /** PlatformIO framework string. */
  platformioFramework: string;
  /** Board-specific notes shown in generated comments. */
  notes: string[];
}
