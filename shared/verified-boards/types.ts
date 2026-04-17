/**
 * Verified Board Definition Types — research-informed type system for
 * pin-accurate, evidence-backed development board definitions.
 *
 * Design informed by Fritzing FZPZ (SVG + XML connectors + buses),
 * Wokwi chip JSON (ordered pin arrays), and KiCad symbol/footprint conventions.
 */

import type { ExactPartFamily, PartSourceEvidence } from '../component-trust';

// ---------------------------------------------------------------------------
// Pin role taxonomy
// ---------------------------------------------------------------------------

/** Electrical role of a pin on a development board. */
export type PinRole =
  | 'power'
  | 'ground'
  | 'digital'
  | 'analog'
  | 'communication'
  | 'clock'
  | 'control'
  | 'passive'
  | 'nc';

/** Direction of current/signal flow for a pin. */
export type PinDirection = 'input' | 'output' | 'bidirectional' | 'power';

// ---------------------------------------------------------------------------
// Pin alternate functions
// ---------------------------------------------------------------------------

/** Type of alternate function a pin can serve. */
export type PinFunctionType =
  | 'pwm'
  | 'adc'
  | 'dac'
  | 'spi'
  | 'i2c'
  | 'uart'
  | 'can'
  | 'i2s'
  | 'touch'
  | 'interrupt'
  | 'timer'
  | 'pcint'
  | 'jtag'
  | 'hall';

/**
 * A structured alternate function for a pin. More expressive than a string
 * tag — carries bus, channel, signal, and usage notes so the bench coach
 * and AI can make real routing decisions.
 */
export interface PinFunction {
  /** Function type (e.g. 'spi', 'uart', 'pwm'). */
  type: PinFunctionType;
  /** Signal name within the bus (e.g. 'MOSI', 'SDA', 'TX'). */
  signal?: string;
  /** Channel identifier (e.g. 'ADC1_CH0', 'UART2', 'PWM5'). */
  channel?: string;
  /** Bus instance this function belongs to (e.g. 'VSPI', 'I2C0'). */
  bus?: string;
  /** Usage notes or caveats (e.g. 'Unavailable when WiFi active'). */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Pin definition
// ---------------------------------------------------------------------------

/**
 * A single pin on a verified development board.
 *
 * Every pin carries its electrical role, direction, voltage, alternate
 * functions, and optional safety warnings. Restricted pins (e.g. ESP32
 * flash-connected GPIO 6-11) are explicitly flagged.
 */
export interface VerifiedPin {
  /** Unique ID within this board definition (e.g. 'D13', 'A0', 'GPIO23', 'VIN'). */
  id: string;
  /** Silkscreen label as printed on the board (e.g. '13', 'A0', 'VIN', 'GND'). */
  name: string;
  /** Which physical header group this pin belongs to. References HeaderGroup.id. */
  headerGroup: string;
  /** Zero-indexed position within the header group. */
  headerPosition: number;

  // Electrical
  /** Primary electrical role. */
  role: PinRole;
  /** Signal direction. */
  direction: PinDirection;
  /** Operating voltage level in volts (e.g. 5, 3.3). */
  voltage: number;
  /** Max current in mA for this specific pin, if different from board default. */
  maxCurrent?: number;

  /** Typed alternate functions this pin can serve. */
  functions: PinFunction[];

  // Safety
  /** Human-readable warnings (e.g. 'Strapping pin — affects boot mode'). */
  warnings?: string[];
  /** Whether this pin should not be used for general I/O. */
  restricted?: boolean;
  /** Why the pin is restricted (e.g. 'Connected to internal SPI flash'). */
  restrictionReason?: string;
}

// ---------------------------------------------------------------------------
// Bus / interface groupings
// ---------------------------------------------------------------------------

/** Type of communication bus or interface. */
export type BusType =
  | 'spi'
  | 'i2c'
  | 'uart'
  | 'can'
  | 'i2s'
  | 'jtag'
  | 'power'
  | 'hall'
  | 'custom';

/**
 * A named bus or interface grouping pins that work together
 * (e.g. SPI with MOSI/MISO/CLK/CS, or a UART with TX/RX).
 */
export interface VerifiedBus {
  /** Unique bus ID within this board (e.g. 'spi0', 'i2c0', 'uart2'). */
  id: string;
  /** Human-readable name (e.g. 'SPI (VSPI)', 'Serial2'). */
  name: string;
  /** Bus protocol type. */
  type: BusType;
  /** Pin IDs that belong to this bus. References VerifiedPin.id. */
  pinIds: string[];
  /** Protocol details (e.g. 'SPI Mode 0', 'I2C 400kHz'). */
  protocol?: string;
  /** Usage notes (e.g. 'Shares JTAG pins on ESP32'). */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Physical layout
// ---------------------------------------------------------------------------

/**
 * A physical pin header on the board. Groups pins that are physically
 * adjacent on the same header strip.
 */
export interface HeaderGroup {
  /** Unique header ID (e.g. 'digital-high', 'analog', 'power'). */
  id: string;
  /** Human-readable name (e.g. 'Digital Pins 22-53', 'Analog Header'). */
  name: string;
  /** Which side of the board this header is on. */
  side: 'left' | 'right' | 'top' | 'bottom';
  /** Total number of pins in this header. */
  pinCount: number;
  /** Ordered pin IDs from first to last in this header. References VerifiedPin.id. */
  pinIds: string[];
}

// ---------------------------------------------------------------------------
// Boot / strapping pin configuration
// ---------------------------------------------------------------------------

/**
 * Boot-mode strapping pin configuration. ESP32 has 5 of these;
 * most EDA tools ignore them. We make them first-class so the
 * bench coach can warn beginners before they brick their board.
 */
export interface BootPinConfig {
  /** The pin affected. References VerifiedPin.id. */
  pinId: string;
  /** What happens when this pin is HIGH at boot. */
  highBehavior: string;
  /** What happens when this pin is LOW at boot. */
  lowBehavior: string;
  /** The pin's internal default state at power-on. */
  internalDefault: 'high' | 'low' | 'floating';
  /** Design rule for safe usage (e.g. 'Do not pull low unless programming'). */
  designRule: string;
}

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

/** Breadboard physical fit classification. */
export type BreadboardFit =
  | 'native'
  | 'requires_jumpers'
  | 'breakout_required'
  | 'not_breadboard_friendly';

/**
 * A complete, verified development board definition with pin-accurate
 * data, evidence chain, and safety metadata.
 *
 * This is the authoritative format for boards that have been researched,
 * cross-referenced against official documentation, and stamped as verified.
 */
export interface VerifiedBoardDefinition {
  // Identity
  /** Stable ID (e.g. 'arduino-mega-2560-r3'). */
  id: string;
  /** Full display title (e.g. 'Arduino Mega 2560 R3'). */
  title: string;
  /** Board manufacturer (e.g. 'Arduino', 'Espressif'). */
  manufacturer: string;
  /** Manufacturer part number (e.g. 'A000067'). */
  mpn: string;
  /** Alternative names/revisions this board is known by. */
  aliases: string[];
  /** Exact-part family classification. */
  family: ExactPartFamily;
  /** Human-readable description of the board. */
  description: string;

  // Physical (all dimensions in mm)
  /** Board PCB dimensions in millimeters. */
  dimensions: {
    width: number;
    height: number;
    thickness?: number;
  };
  /** Breadboard physical compatibility classification. */
  breadboardFit: BreadboardFit;
  /** Explains why the breadboard fit is what it is. */
  breadboardNotes: string;
  /** Pin header pitch in mm (standard: 2.54). */
  pinSpacing: number;
  /** Physical header groupings. */
  headerLayout: HeaderGroup[];

  // Electrical
  /** Operating logic voltage in volts (e.g. 5, 3.3). */
  operatingVoltage: number;
  /** Acceptable input voltage range [min, max] in volts. */
  inputVoltageRange: [number, number];
  /** Maximum current per I/O pin in milliamps. */
  maxCurrentPerPin: number;
  /** Maximum total current across all I/O pins in milliamps. */
  maxTotalCurrent?: number;

  // Pin definitions (the core value)
  /** Complete pin map for this board. */
  pins: VerifiedPin[];
  /** Bus/interface groupings. */
  buses: VerifiedBus[];

  // Trust chain
  /** Evidence records backing this board definition. */
  evidence: PartSourceEvidence[];
  /** Human-readable verification notes or caveats. */
  verificationNotes: string[];
  /** Board-level safety warnings. */
  warnings: string[];
  /** Strapping/boot pins that affect power-on behavior. */
  bootPins?: BootPinConfig[];

  // Visuals
  /** Optional visual representation hints */
  visual?: {
    pcbColor?: string;
    silkscreenColor?: string;
  };
}
