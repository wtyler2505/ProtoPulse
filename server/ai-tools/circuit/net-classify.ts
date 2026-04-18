/**
 * Net classification helpers — name-pattern/type/voltage based classification,
 * instance role inference, and plain-English net explanation builder.
 *
 * Exported for unit testing.
 *
 * @module ai-tools/circuit/net-classify
 */

/** Classification result for a net. */
export interface NetClassification {
  /** High-level type: power, ground, signal, bus, clock, reset, analog. */
  type: 'power' | 'ground' | 'signal' | 'bus' | 'clock' | 'reset' | 'analog';
  /** Detected protocol, if any (I2C, SPI, UART, JTAG, etc.). */
  protocol: string | null;
  /** Human-readable description of what this net carries. */
  description: string;
}

/** Well-known net name patterns and their classifications. */
const NET_PATTERNS: Array<{ pattern: RegExp; type: NetClassification['type']; protocol: string | null; description: string }> = [
  // Power rails
  { pattern: /^(VCC|VDD|VBUS|VMAIN|V_IN|VIN|VBAT|VSYS)$/i, type: 'power', protocol: null, description: 'positive power rail' },
  { pattern: /^(\d+V?\d*|3\.?3V?|5V?|12V?|24V?|1\.?8V?|2\.?5V?)$/i, type: 'power', protocol: null, description: 'voltage power rail' },
  { pattern: /^V(\d+[._]?\d*)$/i, type: 'power', protocol: null, description: 'voltage power rail' },
  // Ground
  { pattern: /^(GND|VSS|AGND|DGND|PGND|SGND|EARTH|GROUND)$/i, type: 'ground', protocol: null, description: 'ground reference' },
  // I2C
  { pattern: /^(SDA\d*|I2C[_.]?SDA)$/i, type: 'signal', protocol: 'I2C', description: 'I2C data line' },
  { pattern: /^(SCL\d*|I2C[_.]?SCL)$/i, type: 'signal', protocol: 'I2C', description: 'I2C clock line' },
  // SPI
  { pattern: /^(MOSI|SDO|COPI|SPI[_.]?MOSI)$/i, type: 'signal', protocol: 'SPI', description: 'SPI data out (controller to peripheral)' },
  { pattern: /^(MISO|SDI|CIPO|SPI[_.]?MISO)$/i, type: 'signal', protocol: 'SPI', description: 'SPI data in (peripheral to controller)' },
  { pattern: /^(SCK|SCLK|SPI[_.]?CLK)$/i, type: 'clock', protocol: 'SPI', description: 'SPI clock line' },
  { pattern: /^(CS\d*|SS\d*|NSS|SPI[_.]?CS|CHIP[_.]?SELECT)$/i, type: 'signal', protocol: 'SPI', description: 'SPI chip select (active low)' },
  // UART
  { pattern: /^(TX\d*|TXD\d*|UART[_.]?TX)$/i, type: 'signal', protocol: 'UART', description: 'UART transmit line' },
  { pattern: /^(RX\d*|RXD\d*|UART[_.]?RX)$/i, type: 'signal', protocol: 'UART', description: 'UART receive line' },
  { pattern: /^(CTS|RTS|DTR|DSR)$/i, type: 'signal', protocol: 'UART', description: 'UART flow control line' },
  // JTAG / SWD
  { pattern: /^(TCK|TMS|TDI|TDO|TRST|SWDIO|SWCLK)$/i, type: 'signal', protocol: 'JTAG/SWD', description: 'debug interface signal' },
  // Clock / Reset
  { pattern: /^(CLK\d*|CLOCK|XTAL|OSC|HCLK|PCLK|FCLK)$/i, type: 'clock', protocol: null, description: 'clock signal' },
  { pattern: /^(RST|RESET|NRST|NRESET|RST_N)$/i, type: 'reset', protocol: null, description: 'reset signal (typically active low)' },
  // Analog
  { pattern: /^(AIN\d*|ADC\d*|AOUT\d*|DAC\d*|VREF|AREF|AN\d+)$/i, type: 'analog', protocol: null, description: 'analog signal' },
  // PWM
  { pattern: /^(PWM\d*|EN\d*|ENABLE)$/i, type: 'signal', protocol: null, description: 'PWM or enable signal' },
  // USB
  { pattern: /^(D\+|D-|USB[_.]?D[PM]|USB[_.]?VBUS)$/i, type: 'signal', protocol: 'USB', description: 'USB data line' },
  // CAN
  { pattern: /^(CAN[_.]?H|CAN[_.]?L|CANH|CANL)$/i, type: 'signal', protocol: 'CAN', description: 'CAN bus differential signal' },
];

/**
 * Classify a net by its name, stored type, and voltage.
 */
export function classifyNet(name: string, storedType: string, voltage: string | null): NetClassification {
  // First, check explicit stored type
  if (storedType === 'power') {
    return { type: 'power', protocol: null, description: `power rail${voltage ? ` (${voltage})` : ''}` };
  }
  if (storedType === 'ground') {
    return { type: 'ground', protocol: null, description: 'ground reference' };
  }
  if (storedType === 'bus') {
    return { type: 'bus', protocol: null, description: 'multi-bit bus' };
  }

  // Pattern match on the net name
  for (const entry of NET_PATTERNS) {
    if (entry.pattern.test(name)) {
      const desc = voltage && entry.type === 'power' ? `${entry.description} (${voltage})` : entry.description;
      return { type: entry.type, protocol: entry.protocol, description: desc };
    }
  }

  // Default: generic signal
  return { type: 'signal', protocol: null, description: 'general-purpose signal' };
}

/**
 * Classify an instance's role on a net as driver, load, or unknown.
 *
 * Uses the reference designator prefix and part name as heuristics:
 * - U (ICs), MCU, CPU, FPGA → driver (they typically source signals)
 * - R (resistors), C (capacitors), L (inductors) → load (passive)
 * - LED, D (diodes) → load
 * - Connectors (J, P) → unknown (could be either)
 * - Power-type nets: voltage regulators are drivers, everything else is a load
 */
export function classifyInstanceRole(
  refDes: string,
  partName: string,
  netClass: NetClassification,
): 'driver' | 'load' | 'unknown' {
  const prefix = refDes.replace(/\d+$/, '').toUpperCase();
  const nameLower = partName.toLowerCase();

  // On power/ground nets: regulators and power sources drive, everything else loads
  if (netClass.type === 'power' || netClass.type === 'ground') {
    if (/regulator|vreg|ldo|buck|boost|smps|power.?supply|battery/i.test(nameLower)) {
      return 'driver';
    }
    return 'load';
  }

  // IC-like prefixes are typically drivers
  if (['U', 'IC'].includes(prefix)) {
    if (/mcu|cpu|fpga|soc|controller|driver|transmitter|codec/i.test(nameLower)) {
      return 'driver';
    }
    // ICs can be either — default to driver for signal nets
    return 'driver';
  }

  // Passives are loads
  if (['R', 'C', 'L', 'FB'].includes(prefix)) {
    return 'load';
  }

  // LEDs and diodes are loads
  if (['D', 'LED'].includes(prefix)) {
    return 'load';
  }

  // Transistors / MOSFETs can be either — but check if the name reveals a load role
  if (['Q', 'M'].includes(prefix)) {
    if (/driver|buffer/i.test(nameLower)) { return 'driver'; }
    if (/motor|relay|speaker|buzzer|actuator|solenoid/i.test(nameLower)) { return 'load'; }
    return 'unknown';
  }

  // Connectors — role depends on direction of the board interface
  if (['J', 'P', 'X'].includes(prefix)) {
    return 'unknown';
  }

  // Sensors are typically drivers (they output data)
  if (/sensor|accel|gyro|temp|adc|encoder/i.test(nameLower)) {
    return 'driver';
  }

  // Motors, relays, speakers are loads
  if (/motor|relay|speaker|buzzer|actuator|solenoid/i.test(nameLower)) {
    return 'load';
  }

  return 'unknown';
}

/** Parameters for building a net explanation string. */
interface NetExplanationParams {
  netName: string;
  classification: NetClassification;
  voltage: string | null;
  drivers: string[];
  loads: string[];
  unknownRole: string[];
  wireCount: number;
  instanceCount: number;
}

/**
 * Build a plain-English explanation of a net.
 */
export function buildNetExplanation(params: NetExplanationParams): string {
  const { netName, classification, voltage, drivers, loads, unknownRole, wireCount, instanceCount } = params;
  const lines: string[] = [];

  // Header
  lines.push(`Net "${netName}" — ${classification.description}`);
  lines.push('');

  // What it carries
  if (classification.protocol) {
    lines.push(`Protocol: ${classification.protocol}`);
  }
  if (classification.type === 'power' && voltage) {
    lines.push(`Voltage: ${voltage}`);
  }
  if (classification.type === 'ground') {
    lines.push('This net serves as the ground reference (0V) for the circuit.');
  }
  if (classification.type === 'clock') {
    lines.push('This net carries a clock signal used for synchronization.');
  }
  if (classification.type === 'reset') {
    lines.push('This net carries a reset signal, typically active low. When asserted, connected components return to their initial state.');
  }

  // Drivers and loads
  if (drivers.length > 0) {
    lines.push('');
    lines.push(`Driven by: ${drivers.join(', ')}`);
  }
  if (loads.length > 0) {
    lines.push(`Loads: ${loads.join(', ')}`);
  }
  if (unknownRole.length > 0) {
    lines.push(`Also connected: ${unknownRole.join(', ')}`);
  }

  // Statistics
  if (instanceCount === 0 && wireCount === 0) {
    lines.push('');
    lines.push('No components or wires are currently connected to this net.');
  } else {
    lines.push('');
    lines.push(`Connectivity: ${instanceCount} component(s), ${wireCount} wire(s)`);
  }

  return lines.join('\n');
}
