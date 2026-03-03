import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// ESD Sensitivity Detection Logic
// ---------------------------------------------------------------------------

/**
 * Determines whether a component is ESD-sensitive based on its description
 * and part number. Components like ICs, MOSFETs, op-amps, FPGAs,
 * microcontrollers, CMOS, and JFET devices are flagged.
 */
const ESD_PATTERNS: RegExp[] = [
  // IC families
  /\bic\b/i,
  /\bmcu\b/i,
  /\bsoc\b/i,
  /\bmicrocontroller\b/i,
  /\bmicroprocessor\b/i,
  /\bfpga\b/i,
  /\bcpld\b/i,
  /\basic\b/i,
  /\bdsp\b/i,
  // Transistor types
  /\bmosfet\b/i,
  /\bjfet\b/i,
  /\bcmos\b/i,
  /\bmos\b/i,
  /\bigbt\b/i,
  // Amplifiers / analog
  /\bop[- ]?amp\b/i,
  /\bopamp\b/i,
  /\bcomparator\b/i,
  /\badc\b/i,
  /\bdac\b/i,
  // Communication ICs
  /\buart\b/i,
  /\bspi\b/i,
  /\bi2c\b/i,
  /\busb\b/i,
  /\beeprom\b/i,
  /\bflash\b/i,
  /\bsram\b/i,
  /\bdram\b/i,
  // Specific chip families
  /\besp32\b/i,
  /\besp8266\b/i,
  /\bstm32\b/i,
  /\batmega\b/i,
  /\battiny\b/i,
  /\brp2040\b/i,
  /\bnrf52\b/i,
  /\bsamd\b/i,
  // Voltage regulators (ICs)
  /\bldo\b/i,
  /\bvoltage regulator\b/i,
  /\bdc[- ]?dc\b/i,
  /\bbuck\b/i,
  /\bboost converter\b/i,
];

export function detectEsdSensitivity(description: string, partNumber: string): boolean {
  const combined = `${description} ${partNumber}`;
  return ESD_PATTERNS.some((pattern) => pattern.test(combined));
}

// ---------------------------------------------------------------------------
// Assembly Category Detection Logic
// ---------------------------------------------------------------------------

export type AssemblyCategory = 'smt' | 'through_hole' | 'hand_solder' | 'mechanical';

const SMT_PATTERNS: RegExp[] = [
  // Package sizes (metric/imperial)
  /\b0201\b/,
  /\b0402\b/,
  /\b0603\b/,
  /\b0805\b/,
  /\b1206\b/,
  /\b1210\b/,
  /\b1812\b/,
  /\b2010\b/,
  /\b2512\b/,
  // SMD package types
  /\bsmd\b/i,
  /\bsmt\b/i,
  /\bsurface mount\b/i,
  /\bqfp\b/i,
  /\btqfp\b/i,
  /\blqfp\b/i,
  /\bqfn\b/i,
  /\bdfn\b/i,
  /\bson\b/i,
  /\bbga\b/i,
  /\bfbga\b/i,
  /\bwlcsp\b/i,
  /\bsop\b/i,
  /\bssop\b/i,
  /\btssop\b/i,
  /\bmsop\b/i,
  /\bsoic\b/i,
  /\bsot[- ]?23\b/i,
  /\bsot[- ]?223\b/i,
  /\bsot[- ]?323\b/i,
  /\bsot[- ]?353\b/i,
  /\bsot[- ]?363\b/i,
  /\bsot[- ]?563\b/i,
  /\bsc[- ]?70\b/i,
  /\bd[- ]?pak\b/i,
  /\bto[- ]?252\b/i,
  /\bto[- ]?263\b/i,
];

const THROUGH_HOLE_PATTERNS: RegExp[] = [
  /\bthrough[- ]?hole\b/i,
  /\btht\b/i,
  /\bdip\b/i,
  /\bpdip\b/i,
  /\bsip\b/i,
  /\bto[- ]?92\b/i,
  /\bto[- ]?220\b/i,
  /\bto[- ]?247\b/i,
  /\bto[- ]?3\b/i,
  /\bradial\b/i,
  /\baxial\b/i,
  /\bthrough hole\b/i,
];

const HAND_SOLDER_PATTERNS: RegExp[] = [
  /\bconnector\b/i,
  /\bjst\b/i,
  /\bmolex\b/i,
  /\bheader\b/i,
  /\bterminal\b/i,
  /\bwire\b/i,
  /\bcable\b/i,
  /\bsocket\b/i,
  /\bplug\b/i,
  /\bjack\b/i,
  /\bbarrel jack\b/i,
  /\bdb9\b/i,
  /\bdb25\b/i,
  /\busb[- ]?[abc]\b/i,
  /\bhdmi\b/i,
  /\brj45\b/i,
  /\brj11\b/i,
  /\bswitch\b/i,
  /\bbutton\b/i,
  /\bpotentiometer\b/i,
  /\btrimmer\b/i,
  /\bbattery holder\b/i,
  /\bfuse holder\b/i,
  /\brelay\b/i,
  /\btransformer\b/i,
  /\bbuzzer\b/i,
  /\bspeaker\b/i,
  /\btest point\b/i,
];

const MECHANICAL_PATTERNS: RegExp[] = [
  /\bstandoff\b/i,
  /\bscrew\b/i,
  /\bnut\b/i,
  /\bwasher\b/i,
  /\bspacer\b/i,
  /\bbracket\b/i,
  /\bmounting\b/i,
  /\bheatsink\b/i,
  /\bheat sink\b/i,
  /\benclosure\b/i,
  /\bclip\b/i,
  /\brivet\b/i,
  /\bgasket\b/i,
  /\brubber feet\b/i,
  /\bbumper\b/i,
  /\bthermal pad\b/i,
  /\bthermal tape\b/i,
];

export function detectAssemblyCategory(description: string, partNumber: string): AssemblyCategory | null {
  const combined = `${description} ${partNumber}`;

  // Check in priority order: mechanical first (most specific), then hand_solder,
  // then through_hole, then smt. This avoids false positives (e.g. a "connector"
  // that happens to mention "0402" shouldn't be classified as SMT).
  if (MECHANICAL_PATTERNS.some((p) => p.test(combined))) {
    return 'mechanical';
  }
  if (HAND_SOLDER_PATTERNS.some((p) => p.test(combined))) {
    return 'hand_solder';
  }
  if (THROUGH_HOLE_PATTERNS.some((p) => p.test(combined))) {
    return 'through_hole';
  }
  if (SMT_PATTERNS.some((p) => p.test(combined))) {
    return 'smt';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Assembly category metadata (labels, notes, colors)
// ---------------------------------------------------------------------------

export interface AssemblyCategoryInfo {
  label: string;
  note: string;
  color: string;
}

export const ASSEMBLY_CATEGORIES: Record<AssemblyCategory, AssemblyCategoryInfo> = {
  smt: {
    label: 'SMT (Surface Mount)',
    note: 'Requires solder paste stencil and reflow oven. Inspect with magnification after reflow.',
    color: 'text-blue-400',
  },
  through_hole: {
    label: 'Through-Hole',
    note: 'Wave soldering or hand soldering. Trim leads after soldering. Check for cold joints.',
    color: 'text-emerald-400',
  },
  hand_solder: {
    label: 'Hand-Solder',
    note: 'Connectors, wires, and large components. Solder by hand with appropriate tip size and temperature.',
    color: 'text-amber-400',
  },
  mechanical: {
    label: 'Mechanical',
    note: 'Standoffs, screws, spacers, and enclosure parts. No soldering required — assemble with tools.',
    color: 'text-purple-400',
  },
};

// =============================================================================
// Tests — ESD Sensitivity Detection
// =============================================================================

describe('detectEsdSensitivity', () => {
  describe('returns true for ESD-sensitive components', () => {
    it.each([
      ['STM32F407VGT6', 'ARM Cortex-M4 MCU, 1MB Flash'],
      ['ESP32-S3-WROOM-1', 'WiFi+BLE SoC module'],
      ['ATmega328P', 'AVR Microcontroller 32KB Flash'],
      ['IRFZ44N', 'N-Channel MOSFET 55V 49A'],
      ['LM358', 'Dual Op-Amp'],
      ['LM339', 'Quad Comparator IC'],
      ['74HC595', 'CMOS 8-bit shift register'],
      ['EP4CE6E22C8', 'Altera Cyclone IV FPGA'],
      ['ADS1115', '16-bit ADC I2C'],
      ['MCP4725', '12-bit DAC I2C'],
      ['FT232RL', 'USB to UART bridge'],
      ['AT24C256', 'EEPROM 256Kbit I2C'],
      ['W25Q128', 'Flash memory 128Mbit SPI'],
      ['NRF52840', 'Bluetooth SoC ARM Cortex-M4'],
      ['RP2040', 'Dual-core ARM Cortex-M0+ MCU'],
      ['AMS1117-3.3', '3.3V LDO Voltage Regulator'],
      ['TPS5430', 'Buck Converter 3A'],
      ['LM2596', 'DC-DC Step-Down Regulator'],
      ['2N7000', 'N-Channel MOSFET Small Signal'],
      ['BSS138', 'N-Channel MOSFET SOT-23'],
      ['SAMD21G18', 'ARM Cortex-M0+ MCU'],
      ['ICM-20948', 'IMU IC with SPI/I2C'],
      ['IRLZ44N', 'Logic-Level MOSFET N-Channel IGBT'],
    ])('%s — %s', (partNumber, description) => {
      expect(detectEsdSensitivity(description, partNumber)).toBe(true);
    });
  });

  describe('returns false for non-ESD-sensitive components', () => {
    it.each([
      ['RC0402FR-0710KL', 'Resistor 10k 0402 1%'],
      ['GRM155R71C104KA88D', 'Capacitor 100nF 0402'],
      ['SRR1210-100M', 'Inductor 10uH 3A'],
      ['LTST-C171KRKT', 'LED Red 0805'],
      ['1N4148', 'Switching Diode'],
      ['1N5819', 'Schottky Diode 40V 1A'],
      ['BAT54', 'Schottky Barrier Diode'],
      ['CRCW040210K0FKED', 'Chip Resistor 10K Ohms'],
      ['CRYSTAL-16MHZ', 'Crystal Oscillator 16MHz'],
      ['FUSE-250V-1A', 'Fuse 250V 1A'],
    ])('%s — %s', (partNumber, description) => {
      expect(detectEsdSensitivity(description, partNumber)).toBe(false);
    });
  });

  it('handles empty strings without error', () => {
    expect(detectEsdSensitivity('', '')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(detectEsdSensitivity('MOSFET N-CHANNEL', '')).toBe(true);
    expect(detectEsdSensitivity('mosfet n-channel', '')).toBe(true);
    expect(detectEsdSensitivity('Mosfet N-Channel', '')).toBe(true);
  });

  it('detects from partNumber alone', () => {
    expect(detectEsdSensitivity('Module', 'ESP32-S3-WROOM-1')).toBe(true);
  });

  it('detects from description alone', () => {
    expect(detectEsdSensitivity('Dual Op-Amp Low Power', 'GENERIC-PART')).toBe(true);
  });
});

// =============================================================================
// Tests — Assembly Category Detection
// =============================================================================

describe('detectAssemblyCategory', () => {
  describe('classifies SMT components', () => {
    it.each([
      ['RC0402FR-0710KL', 'Resistor 10k 0402 1%'],
      ['GRM155R71C104KA88D', 'Capacitor 100nF 0603'],
      ['STM32F407VGT6', 'MCU LQFP-100 package'],
      ['ESP32-S3', 'WiFi SoC QFN-48'],
      ['BSS138', 'N-Channel MOSFET SOT-23'],
      ['TLV62569', 'Buck Converter DFN-6'],
      ['BGA-256', 'FPGA BGA package'],
      ['SOIC-8', 'Dual Op-Amp SOIC-8'],
      ['TSSOP-20', 'Shift Register TSSOP package'],
      ['LM358', 'Dual Op-Amp MSOP-8 SMD'],
    ])('%s — %s → smt', (partNumber, description) => {
      expect(detectAssemblyCategory(description, partNumber)).toBe('smt');
    });
  });

  describe('classifies through-hole components', () => {
    it.each([
      ['DIP-16', 'IC DIP-16 package'],
      ['TO-220', 'Voltage Regulator TO-220 package'],
      ['TO-92', 'NPN Transistor TO-92'],
      ['RADIAL-CAP', 'Electrolytic Capacitor radial 100uF'],
      ['AXIAL-RES', 'Resistor axial 1/4W'],
      ['SIP-8', 'Resistor Network SIP-8'],
      ['THT-COMPONENT', 'Through-hole LED 5mm'],
    ])('%s — %s → through_hole', (partNumber, description) => {
      expect(detectAssemblyCategory(description, partNumber)).toBe('through_hole');
    });
  });

  describe('classifies hand-solder components', () => {
    it.each([
      ['JST-XH-4', 'JST XH 4-pin Connector'],
      ['PJ-002A', 'Barrel Jack DC Power Connector'],
      ['USB-C-001', 'USB-C Connector Right Angle'],
      ['MOLEX-53261', 'Molex PicoBlade 4-pin Header'],
      ['SW-TACT-6MM', 'Tactile Push Button Switch 6x6mm'],
      ['3362P-103', 'Trimmer Potentiometer 10K'],
      ['BH-18650', 'Battery Holder 18650 Single'],
      ['G5V-1-DC5', 'Signal Relay 5V SPDT'],
      ['RJ45-8P8C', 'RJ45 Ethernet Jack'],
      ['DB9-MALE', 'DB9 Serial Connector Male'],
      ['TEST-POINT', 'PCB Test Point Gold Plated'],
    ])('%s — %s → hand_solder', (partNumber, description) => {
      expect(detectAssemblyCategory(description, partNumber)).toBe('hand_solder');
    });
  });

  describe('classifies mechanical components', () => {
    it.each([
      ['M3-STANDOFF', 'M3 Hex Standoff 10mm'],
      ['M3-SCREW', 'M3x8mm Phillips Screw'],
      ['M3-NUT', 'M3 Hex Nut Stainless'],
      ['NYLON-SPACER', 'Nylon Spacer 5mm'],
      ['HS-TO220', 'Heatsink for TO-220 package'],
      ['ENCL-ABS', 'ABS Enclosure 100x60x25mm'],
      ['RUBBER-FEET-4', 'Rubber Bumper Feet Set of 4'],
      ['THERMAL-PAD', 'Thermal Pad 20x20mm'],
      ['BRACKET-L', 'L-shaped Mounting Bracket Steel'],
    ])('%s — %s → mechanical', (partNumber, description) => {
      expect(detectAssemblyCategory(description, partNumber)).toBe('mechanical');
    });
  });

  it('returns null for unclassifiable components', () => {
    expect(detectAssemblyCategory('Generic Part', 'UNKNOWN-001')).toBeNull();
    expect(detectAssemblyCategory('', '')).toBeNull();
  });

  it('mechanical takes priority over SMT when both match', () => {
    // A heatsink that mentions a package size shouldn't be classified as SMT
    expect(detectAssemblyCategory('Heatsink for 0805 component', '')).toBe('mechanical');
  });

  it('hand_solder takes priority over through_hole when both match', () => {
    // A connector that mentions through-hole should be hand_solder (more specific)
    expect(detectAssemblyCategory('Through-hole JST connector', '')).toBe('hand_solder');
  });

  it('is case-insensitive', () => {
    expect(detectAssemblyCategory('RESISTOR 0402', '')).toBe('smt');
    expect(detectAssemblyCategory('resistor 0402', '')).toBe('smt');
    expect(detectAssemblyCategory('Through-Hole LED', '')).toBe('through_hole');
  });
});

// =============================================================================
// Tests — Assembly Category Metadata
// =============================================================================

describe('ASSEMBLY_CATEGORIES', () => {
  it('has entries for all four categories', () => {
    expect(Object.keys(ASSEMBLY_CATEGORIES)).toEqual(['smt', 'through_hole', 'hand_solder', 'mechanical']);
  });

  it('each category has label, note, and color', () => {
    for (const [key, info] of Object.entries(ASSEMBLY_CATEGORIES)) {
      expect(info.label).toBeTruthy();
      expect(info.note).toBeTruthy();
      expect(info.color).toBeTruthy();
      expect(typeof info.label).toBe('string');
      expect(typeof info.note).toBe('string');
      expect(typeof info.color).toBe('string');
      // label should include the key concept
      expect(info.label.toLowerCase()).toContain(key === 'smt' ? 'smt' : key === 'through_hole' ? 'through' : key === 'hand_solder' ? 'hand' : 'mechanical');
    }
  });

  it('SMT note mentions reflow', () => {
    expect(ASSEMBLY_CATEGORIES.smt.note.toLowerCase()).toContain('reflow');
  });

  it('through_hole note mentions soldering', () => {
    expect(ASSEMBLY_CATEGORIES.through_hole.note.toLowerCase()).toContain('solder');
  });

  it('hand_solder note mentions hand', () => {
    expect(ASSEMBLY_CATEGORIES.hand_solder.note.toLowerCase()).toContain('hand');
  });

  it('mechanical note mentions no soldering', () => {
    expect(ASSEMBLY_CATEGORIES.mechanical.note.toLowerCase()).toContain('no solder');
  });
});
