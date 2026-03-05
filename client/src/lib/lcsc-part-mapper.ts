/**
 * LCSC/JLCPCB Part Number Mapper
 *
 * Auto-maps BOM items to LCSC/JLCPCB part numbers for assembly ordering.
 * Includes a built-in database of ~200 common components, fuzzy matching,
 * package normalization, SI prefix value parsing, JLCPCB part classification,
 * and CSV export for JLCPCB assembly service.
 *
 * Usage:
 *   const mapper = LcscPartMapper.getInstance();
 *   const match = mapper.matchSingle({ value: '10kΩ', package: '0805' });
 *
 * React hook:
 *   const { matchSingle, matchBom, statistics, ... } = useLcscMapper();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JlcpcbPartType = 'basic' | 'extended' | 'consignment';
export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';
export type ComponentCategory =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'led'
  | 'diode'
  | 'transistor'
  | 'ic'
  | 'connector'
  | 'crystal'
  | 'fuse'
  | 'switch'
  | 'relay'
  | 'sensor'
  | 'other';

export interface LcscPart {
  lcsc: string; // e.g. "C25804"
  mpn: string; // manufacturer part number
  manufacturer: string;
  description: string;
  category: ComponentCategory;
  value?: string; // e.g. "10kΩ"
  package: string; // e.g. "0805"
  partType: JlcpcbPartType;
  unitPrice?: number; // USD
  stock?: number;
}

export interface BomItem {
  id: string;
  designator: string; // e.g. "R1,R2,R5"
  value?: string;
  package?: string;
  mpn?: string;
  manufacturer?: string;
  description?: string;
  comment?: string;
  quantity?: number;
  x?: number; // placement position
  y?: number;
  rotation?: number;
  side?: 'top' | 'bottom';
}

export interface MatchResult {
  bomItem: BomItem;
  lcscPart: LcscPart | null;
  confidence: MatchConfidence;
  score: number; // 0-100
  matchReasons: string[];
  manualOverride: boolean;
}

export interface BomMatchResult {
  matches: MatchResult[];
  mappedCount: number;
  unmappedCount: number;
  totalCount: number;
  basicCount: number;
  extendedCount: number;
  consignmentCount: number;
  estimatedSurcharge: number; // USD — extended parts surcharge
}

export interface MappingOverride {
  bomItemId: string;
  lcscPartNumber: string;
}

export interface MapperStatistics {
  totalMappings: number;
  manualOverrides: number;
  basicParts: number;
  extendedParts: number;
  consignmentParts: number;
  averageConfidence: number;
  unmappedItems: number;
  estimatedSurcharge: number;
}

export interface ExportedMappings {
  version: number;
  timestamp: string;
  overrides: MappingOverride[];
  lastResults: MatchResult[];
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-lcsc-mapper';
const LCSC_FORMAT_RE = /^C\d{1,8}$/;
const EXTENDED_PART_SURCHARGE = 3.0; // $3 per unique extended part (JLCPCB pricing)

/** SI prefix multipliers for value parsing */
const SI_PREFIXES: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  '\u00B5': 1e-6, // µ
  '\u03BC': 1e-6, // μ (Greek mu)
  m: 1e-3,
  '': 1,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
};

/** Package name normalization map (metric ↔ imperial aliases) */
const PACKAGE_ALIASES: Record<string, string> = {
  // Imperial → canonical
  '0201': '0201',
  '0402': '0402',
  '0603': '0603',
  '0805': '0805',
  '1206': '1206',
  '1210': '1210',
  '1812': '1812',
  '2010': '2010',
  '2512': '2512',
  // Metric → canonical imperial
  '0603M': '0201',
  '1005M': '0402',
  '1608M': '0603',
  '2012M': '0805',
  '3216M': '1206',
  '3225M': '1210',
  '4532M': '1812',
  '5025M': '2010',
  '6332M': '2512',
  // Bare metric (no M suffix) → canonical
  '0603m': '0201',
  '1005': '0402',
  '1608': '0603',
  '2012': '0805',
  '3216': '1206',
  '3225': '1210',
  '4532': '1812',
  '5025': '2010',
  '6332': '2512',
  // SOT packages
  'SOT-23': 'SOT-23',
  'SOT23': 'SOT-23',
  'SOT-23-3': 'SOT-23',
  'SOT-23-5': 'SOT-23-5',
  'SOT23-5': 'SOT-23-5',
  'SOT-23-6': 'SOT-23-6',
  'SOT23-6': 'SOT-23-6',
  'SOT-223': 'SOT-223',
  'SOT223': 'SOT-223',
  'SOT-89': 'SOT-89',
  'SOT89': 'SOT-89',
  // SOP / SOIC
  'SOP-8': 'SOP-8',
  'SOIC-8': 'SOP-8',
  'SOIC8': 'SOP-8',
  'SOP-16': 'SOP-16',
  'SOIC-16': 'SOP-16',
  'SOIC16': 'SOP-16',
  'SSOP-8': 'SSOP-8',
  'TSSOP-8': 'TSSOP-8',
  'TSSOP-16': 'TSSOP-16',
  'TSSOP-20': 'TSSOP-20',
  'MSOP-8': 'MSOP-8',
  // QFP
  'LQFP-32': 'LQFP-32',
  'LQFP-48': 'LQFP-48',
  'LQFP-64': 'LQFP-64',
  'LQFP-100': 'LQFP-100',
  'TQFP-32': 'TQFP-32',
  'TQFP-44': 'TQFP-44',
  // QFN / DFN
  'QFN-16': 'QFN-16',
  'QFN-20': 'QFN-20',
  'QFN-24': 'QFN-24',
  'QFN-32': 'QFN-32',
  'QFN-48': 'QFN-48',
  'DFN-8': 'DFN-8',
  // TO packages
  'TO-220': 'TO-220',
  'TO220': 'TO-220',
  'TO-92': 'TO-92',
  'TO92': 'TO-92',
  'TO-252': 'TO-252',
  'DPAK': 'TO-252',
  'TO-263': 'TO-263',
  'D2PAK': 'TO-263',
  // Electrolytic / others
  'DO-214AC': 'DO-214AC',
  'SMA': 'DO-214AC',
  'DO-214AA': 'DO-214AA',
  'SMB': 'DO-214AA',
  'DO-214AB': 'DO-214AB',
  'SMC': 'DO-214AB',
  'DO-35': 'DO-35',
  'DO-41': 'DO-41',
};

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

/**
 * Parse a component value string into a numeric value.
 * Handles SI prefixes: "10k" → 10000, "4.7u" → 0.0000047, "100n" → 0.0000001
 * Also handles formats like "10kΩ", "100nF", "4.7uH", "47R"
 */
export function parseComponentValue(input: string): number | null {
  if (!input) {
    return null;
  }

  const text = input.trim();

  // Handle "47R" style (R = decimal point in some notations, or unit)
  const rNotation = /^(\d+)R(\d+)$/i.exec(text);
  if (rNotation) {
    return parseFloat(`${rNotation[1]}.${rNotation[2]}`);
  }

  // Handle "4R7" → 4.7 ohms
  const dotNotation = /^(\d+)([RrKkMm])(\d+)$/i.exec(text);
  if (dotNotation) {
    const whole = dotNotation[1];
    const prefix = dotNotation[2].toUpperCase();
    const frac = dotNotation[3];
    const raw = parseFloat(`${whole}.${frac}`);
    if (prefix === 'R') {
      return raw;
    }
    const multiplier = SI_PREFIXES[prefix === 'K' ? 'k' : prefix] ?? 1;
    return raw * multiplier;
  }

  // General pattern: digits [. digits] [SI prefix] [unit suffix]
  const general = /^(\d+(?:\.\d+)?)\s*([pnuµμmkKMGT]?)\s*(?:[ΩΩRFHVAWhz°C]|ohm|ohms|farad|farads|henry|henrys)?$/i.exec(text);
  if (general) {
    const raw = parseFloat(general[1]);
    const prefix = general[2] || '';
    const multiplier = SI_PREFIXES[prefix] ?? 1;
    return raw * multiplier;
  }

  // Plain number
  const plain = parseFloat(text);
  if (!isNaN(plain)) {
    return plain;
  }

  return null;
}

/**
 * Normalize a package/footprint string to a canonical form.
 */
export function normalizePackage(pkg: string): string {
  if (!pkg) {
    return '';
  }
  const trimmed = pkg.trim();
  const upper = trimmed.toUpperCase();

  // Direct alias lookup (case-insensitive)
  for (const [alias, canonical] of Object.entries(PACKAGE_ALIASES)) {
    if (alias.toUpperCase() === upper) {
      return canonical;
    }
  }

  return trimmed;
}

/**
 * Validate LCSC part number format (C followed by 1-8 digits).
 */
export function isValidLcscNumber(partNumber: string): boolean {
  return LCSC_FORMAT_RE.test(partNumber.trim());
}

/**
 * Detect component category from value/description text.
 */
export function detectCategory(text: string): ComponentCategory {
  const lower = text.toLowerCase();

  if (/resistor|ohm|[\u2126]|(\d+[rR]\d*)/i.test(text)) {
    return 'resistor';
  }
  if (/capacitor|farad|(\d+[pnu\u00B5\u03BC]?[fF])/i.test(text)) {
    return 'capacitor';
  }
  if (/inductor|henry|(\d+[pnu\u00B5\u03BC]?[hH])/i.test(text)) {
    return 'inductor';
  }
  if (/\bled\b/i.test(text) || /light.?emit/i.test(lower)) {
    return 'led';
  }
  if (/diode|rectifier|schottky|zener/i.test(text)) {
    return 'diode';
  }
  if (/transistor|mosfet|bjt|jfet|npn|pnp|n-ch|p-ch/i.test(text)) {
    return 'transistor';
  }
  if (/crystal|xtal|oscillator/i.test(text)) {
    return 'crystal';
  }
  if (/connector|header|socket|pin/i.test(text)) {
    return 'connector';
  }
  if (/fuse/i.test(text)) {
    return 'fuse';
  }
  if (/switch|button/i.test(text)) {
    return 'switch';
  }
  if (/relay/i.test(text)) {
    return 'relay';
  }
  if (/sensor|thermistor|ntc|ptc/i.test(text)) {
    return 'sensor';
  }
  if (/ic|chip|mcu|regulator|op.?amp|timer|driver|adc|dac|uart|spi|i2c/i.test(text)) {
    return 'ic';
  }

  return 'other';
}

// ---------------------------------------------------------------------------
// Built-in LCSC part database (~200 common components)
// ---------------------------------------------------------------------------

function buildBuiltInDatabase(): LcscPart[] {
  const parts: LcscPart[] = [];

  // --- Resistors (0402, 0603, 0805, 1206) ---
  const resistorValues = [
    { val: '0Ω', num: 0 },
    { val: '1Ω', num: 1 },
    { val: '10Ω', num: 10 },
    { val: '22Ω', num: 22 },
    { val: '47Ω', num: 47 },
    { val: '100Ω', num: 100 },
    { val: '220Ω', num: 220 },
    { val: '330Ω', num: 330 },
    { val: '470Ω', num: 470 },
    { val: '1kΩ', num: 1000 },
    { val: '2.2kΩ', num: 2200 },
    { val: '3.3kΩ', num: 3300 },
    { val: '4.7kΩ', num: 4700 },
    { val: '10kΩ', num: 10000 },
    { val: '22kΩ', num: 22000 },
    { val: '47kΩ', num: 47000 },
    { val: '100kΩ', num: 100000 },
    { val: '220kΩ', num: 220000 },
    { val: '470kΩ', num: 470000 },
    { val: '1MΩ', num: 1000000 },
  ];

  // 0805 resistors — JLCPCB basic
  const r0805Lcsc = [
    'C17168', 'C17228', 'C17415', 'C17561', 'C17390', 'C17408', 'C17557',
    'C17630', 'C17710', 'C17407', 'C17520', 'C17422', 'C17673', 'C25804',
    'C31733', 'C17724', 'C17409', 'C17556', 'C17711', 'C17470',
  ];
  resistorValues.forEach((rv, i) => {
    parts.push({
      lcsc: r0805Lcsc[i],
      mpn: `RC0805FR-07${rv.val.replace('Ω', 'R').replace('k', 'K').replace('M', 'M')}L`,
      manufacturer: 'YAGEO',
      description: `${rv.val} ±1% 0805 Resistor`,
      category: 'resistor',
      value: rv.val,
      package: '0805',
      partType: 'basic',
      unitPrice: 0.002,
    });
  });

  // 0603 resistors — basic
  const r0603Lcsc = [
    'C21189', 'C22938', 'C22859', 'C23345', 'C25118', 'C22775', 'C22962',
    'C23138', 'C23179', 'C22548', 'C22978', 'C23150', 'C23162', 'C25772',
    'C31739', 'C25957', 'C25803', 'C22961', 'C23178', 'C22935',
  ];
  resistorValues.forEach((rv, i) => {
    parts.push({
      lcsc: r0603Lcsc[i],
      mpn: `RC0603FR-07${rv.val.replace('Ω', 'R')}L`,
      manufacturer: 'YAGEO',
      description: `${rv.val} ±1% 0603 Resistor`,
      category: 'resistor',
      value: rv.val,
      package: '0603',
      partType: 'basic',
      unitPrice: 0.001,
    });
  });

  // 0402 resistors — basic (common values)
  const r0402Values = [
    { val: '0Ω', lcsc: 'C106232' },
    { val: '10Ω', lcsc: 'C25077' },
    { val: '100Ω', lcsc: 'C25076' },
    { val: '1kΩ', lcsc: 'C11702' },
    { val: '4.7kΩ', lcsc: 'C25900' },
    { val: '10kΩ', lcsc: 'C25744' },
    { val: '47kΩ', lcsc: 'C25792' },
    { val: '100kΩ', lcsc: 'C25741' },
    { val: '470kΩ', lcsc: 'C25794' },
    { val: '1MΩ', lcsc: 'C11795' },
  ];
  r0402Values.forEach((rv) => {
    parts.push({
      lcsc: rv.lcsc,
      mpn: `RC0402FR-07${rv.val.replace('Ω', 'R')}L`,
      manufacturer: 'YAGEO',
      description: `${rv.val} ±1% 0402 Resistor`,
      category: 'resistor',
      value: rv.val,
      package: '0402',
      partType: 'basic',
      unitPrice: 0.001,
    });
  });

  // 1206 resistors — basic (common values)
  const r1206Values = [
    { val: '0Ω', lcsc: 'C17888' },
    { val: '100Ω', lcsc: 'C17901' },
    { val: '1kΩ', lcsc: 'C17900' },
    { val: '10kΩ', lcsc: 'C17902' },
    { val: '100kΩ', lcsc: 'C17903' },
  ];
  r1206Values.forEach((rv) => {
    parts.push({
      lcsc: rv.lcsc,
      mpn: `RC1206FR-07${rv.val.replace('Ω', 'R')}L`,
      manufacturer: 'YAGEO',
      description: `${rv.val} ±1% 1206 Resistor`,
      category: 'resistor',
      value: rv.val,
      package: '1206',
      partType: 'basic',
      unitPrice: 0.003,
    });
  });

  // --- Capacitors (MLCC) ---
  const capValues = [
    { val: '10pF', num: 10e-12 },
    { val: '22pF', num: 22e-12 },
    { val: '33pF', num: 33e-12 },
    { val: '100pF', num: 100e-12 },
    { val: '1nF', num: 1e-9 },
    { val: '10nF', num: 10e-9 },
    { val: '100nF', num: 100e-9 },
    { val: '1µF', num: 1e-6 },
    { val: '4.7µF', num: 4.7e-6 },
    { val: '10µF', num: 10e-6 },
    { val: '22µF', num: 22e-6 },
    { val: '47µF', num: 47e-6 },
    { val: '100µF', num: 100e-6 },
  ];

  // 0805 caps — basic
  const c0805Lcsc = [
    'C1783', 'C1804', 'C1815', 'C1730', 'C1747', 'C1710', 'C49678',
    'C28323', 'C1779', 'C15850', 'C45783', 'C16780', 'C15008',
  ];
  capValues.forEach((cv, i) => {
    parts.push({
      lcsc: c0805Lcsc[i],
      mpn: `CL21B${cv.val.replace('µ', 'u')}`,
      manufacturer: 'Samsung Electro-Mechanics',
      description: `${cv.val} 0805 Capacitor`,
      category: 'capacitor',
      value: cv.val,
      package: '0805',
      partType: i < 10 ? 'basic' : 'extended',
      unitPrice: 0.003,
    });
  });

  // 0603 caps — basic
  const c0603Lcsc = [
    'C1634', 'C1653', 'C1658', 'C1588', 'C1590', 'C1591', 'C14663',
    'C15849', 'C19666', 'C19702', 'C42998', 'C107190', 'C262189',
  ];
  capValues.forEach((cv, i) => {
    parts.push({
      lcsc: c0603Lcsc[i],
      mpn: `CL10B${cv.val.replace('µ', 'u')}`,
      manufacturer: 'Samsung Electro-Mechanics',
      description: `${cv.val} 0603 Capacitor`,
      category: 'capacitor',
      value: cv.val,
      package: '0603',
      partType: i < 8 ? 'basic' : 'extended',
      unitPrice: 0.002,
    });
  });

  // --- LEDs ---
  const leds: Array<{ lcsc: string; mpn: string; desc: string; val: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C2286', mpn: '0805CW', desc: 'White LED 0805', val: 'White', pkg: '0805', type: 'basic' },
    { lcsc: 'C2297', mpn: '0805CR', desc: 'Red LED 0805', val: 'Red', pkg: '0805', type: 'basic' },
    { lcsc: 'C2293', mpn: '0805CG', desc: 'Green LED 0805', val: 'Green', pkg: '0805', type: 'basic' },
    { lcsc: 'C2290', mpn: '0805CB', desc: 'Blue LED 0805', val: 'Blue', pkg: '0805', type: 'basic' },
    { lcsc: 'C2296', mpn: '0805CY', desc: 'Yellow LED 0805', val: 'Yellow', pkg: '0805', type: 'basic' },
    { lcsc: 'C72038', mpn: '0603CW', desc: 'White LED 0603', val: 'White', pkg: '0603', type: 'basic' },
    { lcsc: 'C72037', mpn: '0603CR', desc: 'Red LED 0603', val: 'Red', pkg: '0603', type: 'basic' },
    { lcsc: 'C72043', mpn: '0603CG', desc: 'Green LED 0603', val: 'Green', pkg: '0603', type: 'basic' },
    { lcsc: 'C72041', mpn: '0603CB', desc: 'Blue LED 0603', val: 'Blue', pkg: '0603', type: 'extended' },
    { lcsc: 'C72039', mpn: '0603CY', desc: 'Yellow LED 0603', val: 'Yellow', pkg: '0603', type: 'basic' },
  ];
  leds.forEach((l) => {
    parts.push({
      lcsc: l.lcsc,
      mpn: l.mpn,
      manufacturer: 'Hubei KENTO',
      description: l.desc,
      category: 'led',
      value: l.val,
      package: l.pkg,
      partType: l.type,
      unitPrice: 0.005,
    });
  });

  // --- Diodes ---
  const diodes: Array<{ lcsc: string; mpn: string; mfr: string; desc: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C8598', mpn: '1N4148WS', mfr: 'CBI', desc: '1N4148 Signal Diode SOD-323', pkg: 'SOD-323', type: 'basic' },
    { lcsc: 'C14516', mpn: 'SS14', mfr: 'MDD', desc: 'SS14 1A 40V Schottky SMA', pkg: 'DO-214AC', type: 'basic' },
    { lcsc: 'C22452', mpn: 'SS34', mfr: 'MDD', desc: 'SS34 3A 40V Schottky SMA', pkg: 'DO-214AC', type: 'basic' },
    { lcsc: 'C35722', mpn: '1N5819WS', mfr: 'CBI', desc: '1N5819 Schottky SOD-323', pkg: 'SOD-323', type: 'basic' },
    { lcsc: 'C83528', mpn: 'BZT52C3V3', mfr: 'CBI', desc: '3.3V Zener SOD-323', pkg: 'SOD-323', type: 'basic' },
    { lcsc: 'C83529', mpn: 'BZT52C5V1', mfr: 'CBI', desc: '5.1V Zener SOD-323', pkg: 'SOD-323', type: 'basic' },
    { lcsc: 'C8678', mpn: 'US1M', mfr: 'MDD', desc: 'US1M 1A 1000V Rectifier SMA', pkg: 'DO-214AC', type: 'basic' },
    { lcsc: 'C9900', mpn: 'ES1J', mfr: 'MDD', desc: 'ES1J Fast Recovery SMA', pkg: 'DO-214AC', type: 'basic' },
  ];
  diodes.forEach((d) => {
    parts.push({
      lcsc: d.lcsc,
      mpn: d.mpn,
      manufacturer: d.mfr,
      description: d.desc,
      category: 'diode',
      package: d.pkg,
      partType: d.type,
      unitPrice: 0.01,
    });
  });

  // --- Transistors ---
  const transistors: Array<{ lcsc: string; mpn: string; mfr: string; desc: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C8545', mpn: '2N7002', mfr: 'Changjiang', desc: '2N7002 N-MOSFET SOT-23', pkg: 'SOT-23', type: 'basic' },
    { lcsc: 'C20917', mpn: 'S8050', mfr: 'Changjiang', desc: 'S8050 NPN SOT-23', pkg: 'SOT-23', type: 'basic' },
    { lcsc: 'C20918', mpn: 'S8550', mfr: 'Changjiang', desc: 'S8550 PNP SOT-23', pkg: 'SOT-23', type: 'basic' },
    { lcsc: 'C2150', mpn: 'BSS138', mfr: 'Changjiang', desc: 'BSS138 N-MOSFET SOT-23', pkg: 'SOT-23', type: 'basic' },
    { lcsc: 'C6749', mpn: 'AO3400A', mfr: 'AOS', desc: 'AO3400A 5.8A N-MOSFET SOT-23', pkg: 'SOT-23', type: 'basic' },
    { lcsc: 'C15127', mpn: 'AO3401A', mfr: 'AOS', desc: 'AO3401A -4A P-MOSFET SOT-23', pkg: 'SOT-23', type: 'basic' },
    { lcsc: 'C181093', mpn: 'MMBT3904', mfr: 'Changjiang', desc: 'MMBT3904 NPN SOT-23', pkg: 'SOT-23', type: 'basic' },
    { lcsc: 'C181094', mpn: 'MMBT3906', mfr: 'Changjiang', desc: 'MMBT3906 PNP SOT-23', pkg: 'SOT-23', type: 'basic' },
    { lcsc: 'C15959', mpn: 'SI2302CDS', mfr: 'Vishay', desc: 'SI2302 2.6A N-MOSFET SOT-23', pkg: 'SOT-23', type: 'extended' },
    { lcsc: 'C10487', mpn: 'IRF540NPBF', mfr: 'IR', desc: 'IRF540N 33A N-MOSFET TO-220', pkg: 'TO-220', type: 'extended' },
  ];
  transistors.forEach((t) => {
    parts.push({
      lcsc: t.lcsc,
      mpn: t.mpn,
      manufacturer: t.mfr,
      description: t.desc,
      category: 'transistor',
      package: t.pkg,
      partType: t.type,
      unitPrice: 0.02,
    });
  });

  // --- ICs (regulators, timers, op-amps, MCUs) ---
  const ics: Array<{ lcsc: string; mpn: string; mfr: string; desc: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C15184', mpn: 'AMS1117-3.3', mfr: 'AMS', desc: 'AMS1117 3.3V LDO SOT-223', pkg: 'SOT-223', type: 'basic' },
    { lcsc: 'C6186', mpn: 'AMS1117-5.0', mfr: 'AMS', desc: 'AMS1117 5.0V LDO SOT-223', pkg: 'SOT-223', type: 'basic' },
    { lcsc: 'C7466', mpn: 'NE555DR', mfr: 'TI', desc: 'NE555 Timer SOP-8', pkg: 'SOP-8', type: 'basic' },
    { lcsc: 'C5171', mpn: 'LM358DR', mfr: 'TI', desc: 'LM358 Dual Op-Amp SOP-8', pkg: 'SOP-8', type: 'basic' },
    { lcsc: 'C6482', mpn: 'LM324DR', mfr: 'TI', desc: 'LM324 Quad Op-Amp SOP-14', pkg: 'SOP-14', type: 'basic' },
    { lcsc: 'C8733', mpn: 'LM7805CT', mfr: 'CJ', desc: 'LM7805 5V Regulator TO-220', pkg: 'TO-220', type: 'basic' },
    { lcsc: 'C2688', mpn: '74HC595D', mfr: 'NXP', desc: '74HC595 Shift Register SOP-16', pkg: 'SOP-16', type: 'basic' },
    { lcsc: 'C10342', mpn: '74HC245D', mfr: 'NXP', desc: '74HC245 Bus Transceiver SOP-20', pkg: 'SOP-20', type: 'basic' },
    { lcsc: 'C6568', mpn: 'CH340G', mfr: 'WCH', desc: 'CH340G USB-UART SOP-16', pkg: 'SOP-16', type: 'basic' },
    { lcsc: 'C81598', mpn: 'CH340C', mfr: 'WCH', desc: 'CH340C USB-UART SOP-16', pkg: 'SOP-16', type: 'basic' },
    { lcsc: 'C14954', mpn: 'STM32F103C8T6', mfr: 'ST', desc: 'STM32F103C8 ARM MCU LQFP-48', pkg: 'LQFP-48', type: 'extended' },
    { lcsc: 'C8734', mpn: 'ATMEGA328P-AU', mfr: 'Microchip', desc: 'ATmega328P MCU TQFP-32', pkg: 'TQFP-32', type: 'extended' },
    { lcsc: 'C44854', mpn: 'ESP32-WROOM-32', mfr: 'Espressif', desc: 'ESP32 WiFi+BT Module', pkg: 'MODULE', type: 'extended' },
    { lcsc: 'C529584', mpn: 'RP2040', mfr: 'Raspberry Pi', desc: 'RP2040 Dual-core MCU QFN-56', pkg: 'QFN-56', type: 'extended' },
    { lcsc: 'C2062', mpn: 'TL431AIDR', mfr: 'TI', desc: 'TL431 Voltage Ref SOP-8', pkg: 'SOP-8', type: 'basic' },
    { lcsc: 'C12084', mpn: 'MCP2515-I/SO', mfr: 'Microchip', desc: 'MCP2515 CAN Controller SOP-18', pkg: 'SOP-18', type: 'extended' },
    { lcsc: 'C84256', mpn: 'PCF8574T', mfr: 'NXP', desc: 'PCF8574 I2C GPIO Expander SOP-16', pkg: 'SOP-16', type: 'extended' },
    { lcsc: 'C9865', mpn: 'MAX232ESE', mfr: 'Maxim', desc: 'MAX232 RS232 Transceiver SOP-16', pkg: 'SOP-16', type: 'extended' },
    { lcsc: 'C52717', mpn: 'SN65HVD230DR', mfr: 'TI', desc: 'SN65HVD230 CAN Transceiver SOP-8', pkg: 'SOP-8', type: 'extended' },
    { lcsc: 'C36045', mpn: 'MP1584EN-LF-Z', mfr: 'MPS', desc: 'MP1584 3A Step-Down SOP-8', pkg: 'SOP-8', type: 'extended' },
  ];
  ics.forEach((ic) => {
    parts.push({
      lcsc: ic.lcsc,
      mpn: ic.mpn,
      manufacturer: ic.mfr,
      description: ic.desc,
      category: 'ic',
      package: ic.pkg,
      partType: ic.type,
      unitPrice: ic.type === 'basic' ? 0.05 : 0.5,
    });
  });

  // --- Connectors ---
  const connectors: Array<{ lcsc: string; mpn: string; mfr: string; desc: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C124375', mpn: 'USB-C-SMD', mfr: 'Korean Hroparts', desc: 'USB Type-C 16P SMD', pkg: 'SMD', type: 'extended' },
    { lcsc: 'C393939', mpn: 'USB-MICRO-B', mfr: 'Korean Hroparts', desc: 'Micro USB Type-B SMD', pkg: 'SMD', type: 'basic' },
    { lcsc: 'C2337', mpn: 'HDR-1x4P', mfr: 'BOOMELE', desc: '1x4P 2.54mm Header', pkg: 'DIP', type: 'basic' },
    { lcsc: 'C2336', mpn: 'HDR-1x6P', mfr: 'BOOMELE', desc: '1x6P 2.54mm Header', pkg: 'DIP', type: 'basic' },
    { lcsc: 'C2335', mpn: 'HDR-1x8P', mfr: 'BOOMELE', desc: '1x8P 2.54mm Header', pkg: 'DIP', type: 'basic' },
    { lcsc: 'C35165', mpn: 'HDR-2x4P', mfr: 'BOOMELE', desc: '2x4P 2.54mm Header', pkg: 'DIP', type: 'basic' },
    { lcsc: 'C49257', mpn: 'JST-PH-2P', mfr: 'JST', desc: 'JST PH 2.0mm 2P Connector', pkg: 'SMD', type: 'extended' },
    { lcsc: 'C131337', mpn: 'JST-PH-3P', mfr: 'JST', desc: 'JST PH 2.0mm 3P Connector', pkg: 'SMD', type: 'extended' },
    { lcsc: 'C145997', mpn: 'JST-PH-4P', mfr: 'JST', desc: 'JST PH 2.0mm 4P Connector', pkg: 'SMD', type: 'extended' },
    { lcsc: 'C160404', mpn: 'SCREW-2P-5.08', mfr: 'Dinkle', desc: '2P 5.08mm Screw Terminal', pkg: 'DIP', type: 'extended' },
  ];
  connectors.forEach((c) => {
    parts.push({
      lcsc: c.lcsc,
      mpn: c.mpn,
      manufacturer: c.mfr,
      description: c.desc,
      category: 'connector',
      package: c.pkg,
      partType: c.type,
      unitPrice: 0.1,
    });
  });

  // --- Crystals ---
  const crystals: Array<{ lcsc: string; mpn: string; mfr: string; desc: string; val: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C13738', mpn: 'X49SM8MSD2SC', mfr: 'YXC', desc: '8MHz Crystal SMD', val: '8MHz', pkg: 'SMD-3215', type: 'basic' },
    { lcsc: 'C32346', mpn: 'X49SM16MSD2SC', mfr: 'YXC', desc: '16MHz Crystal SMD', val: '16MHz', pkg: 'SMD-3215', type: 'basic' },
    { lcsc: 'C14858', mpn: 'X49SM12MSD2SC', mfr: 'YXC', desc: '12MHz Crystal SMD', val: '12MHz', pkg: 'SMD-3215', type: 'basic' },
    { lcsc: 'C255909', mpn: 'X49SM25MSD2SC', mfr: 'YXC', desc: '25MHz Crystal SMD', val: '25MHz', pkg: 'SMD-3215', type: 'extended' },
    { lcsc: 'C7462', mpn: 'X49SM32768KSD2SC', mfr: 'YXC', desc: '32.768kHz Crystal SMD', val: '32.768kHz', pkg: 'SMD-1610', type: 'basic' },
  ];
  crystals.forEach((x) => {
    parts.push({
      lcsc: x.lcsc,
      mpn: x.mpn,
      manufacturer: x.mfr,
      description: x.desc,
      category: 'crystal',
      value: x.val,
      package: x.pkg,
      partType: x.type,
      unitPrice: 0.05,
    });
  });

  // --- Inductors ---
  const inductors: Array<{ lcsc: string; mpn: string; mfr: string; desc: string; val: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C1046', mpn: 'SWPA4010S100MT', mfr: 'Sunlord', desc: '10µH Power Inductor 4010', val: '10µH', pkg: '4010', type: 'basic' },
    { lcsc: 'C1049', mpn: 'SWPA4010S4R7MT', mfr: 'Sunlord', desc: '4.7µH Power Inductor 4010', val: '4.7µH', pkg: '4010', type: 'basic' },
    { lcsc: 'C1044', mpn: 'SWPA4010S220MT', mfr: 'Sunlord', desc: '22µH Power Inductor 4010', val: '22µH', pkg: '4010', type: 'basic' },
    { lcsc: 'C1068', mpn: 'SWPA5020S100MT', mfr: 'Sunlord', desc: '10µH Power Inductor 5020', val: '10µH', pkg: '5020', type: 'basic' },
    { lcsc: 'C167175', mpn: 'NR3015T4R7M', mfr: 'TAI-TECH', desc: '4.7µH Inductor 3015', val: '4.7µH', pkg: '3015', type: 'extended' },
  ];
  inductors.forEach((ind) => {
    parts.push({
      lcsc: ind.lcsc,
      mpn: ind.mpn,
      manufacturer: ind.mfr,
      description: ind.desc,
      category: 'inductor',
      value: ind.val,
      package: ind.pkg,
      partType: ind.type,
      unitPrice: 0.02,
    });
  });

  // --- Fuses ---
  const fuses: Array<{ lcsc: string; mpn: string; mfr: string; desc: string; val: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C107148', mpn: 'SMD0603-010', mfr: 'SXN', desc: '100mA PTC Resettable Fuse 0603', val: '100mA', pkg: '0603', type: 'basic' },
    { lcsc: 'C70075', mpn: 'SMD1206-050', mfr: 'SXN', desc: '500mA PTC Resettable Fuse 1206', val: '500mA', pkg: '1206', type: 'basic' },
    { lcsc: 'C103420', mpn: 'SMD1206-100', mfr: 'SXN', desc: '1A PTC Resettable Fuse 1206', val: '1A', pkg: '1206', type: 'basic' },
  ];
  fuses.forEach((f) => {
    parts.push({
      lcsc: f.lcsc,
      mpn: f.mpn,
      manufacturer: f.mfr,
      description: f.desc,
      category: 'fuse',
      value: f.val,
      package: f.pkg,
      partType: f.type,
      unitPrice: 0.01,
    });
  });

  // --- Switches ---
  const switches: Array<{ lcsc: string; mpn: string; mfr: string; desc: string; pkg: string; type: JlcpcbPartType }> = [
    { lcsc: 'C318884', mpn: 'TS-1187A-B-A-B', mfr: 'XKB', desc: 'Tactile Switch 6x6mm SMD', pkg: 'SMD-6x6', type: 'basic' },
    { lcsc: 'C455280', mpn: 'TS-1088-AR02016', mfr: 'XKB', desc: 'Tactile Switch 3x4mm SMD', pkg: 'SMD-3x4', type: 'extended' },
  ];
  switches.forEach((s) => {
    parts.push({
      lcsc: s.lcsc,
      mpn: s.mpn,
      manufacturer: s.mfr,
      description: s.desc,
      category: 'switch',
      package: s.pkg,
      partType: s.type,
      unitPrice: 0.03,
    });
  });

  return parts;
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/**
 * Compute a match score (0-100) between a BOM item and an LCSC part.
 */
function computeMatchScore(
  bomItem: BomItem,
  lcscPart: LcscPart,
  reasons: string[],
): number {
  let score = 0;

  // MPN exact match is strongest signal (80 points)
  if (bomItem.mpn && lcscPart.mpn) {
    const bomMpn = bomItem.mpn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const lcscMpn = lcscPart.mpn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (bomMpn === lcscMpn) {
      score += 80;
      reasons.push('MPN exact match');
    } else if (bomMpn.includes(lcscMpn) || lcscMpn.includes(bomMpn)) {
      score += 50;
      reasons.push('MPN partial match');
    }
  }

  // Value match (30 points)
  if (bomItem.value && lcscPart.value) {
    const bomVal = parseComponentValue(bomItem.value);
    const lcscVal = parseComponentValue(lcscPart.value);
    if (bomVal !== null && lcscVal !== null) {
      if (bomVal === lcscVal || (lcscVal !== 0 && Math.abs(bomVal - lcscVal) / Math.abs(lcscVal) < 0.001)) {
        score += 30;
        reasons.push('Value exact match');
      } else if (lcscVal !== 0 && Math.abs(bomVal - lcscVal) / Math.abs(lcscVal) < 0.05) {
        score += 15;
        reasons.push('Value approximate match');
      }
    } else {
      // Fallback: string comparison
      const bomStr = bomItem.value.trim().toLowerCase().replace(/\s+/g, '');
      const lcscStr = lcscPart.value.trim().toLowerCase().replace(/\s+/g, '');
      if (bomStr === lcscStr) {
        score += 30;
        reasons.push('Value string match');
      }
    }
  }

  // Package match (20 points)
  if (bomItem.package && lcscPart.package) {
    const bomPkg = normalizePackage(bomItem.package);
    const lcscPkg = normalizePackage(lcscPart.package);
    if (bomPkg === lcscPkg) {
      score += 20;
      reasons.push('Package match');
    }
  }

  // Category/description keyword match (10 points)
  if (bomItem.description || bomItem.comment) {
    const searchText = `${bomItem.description ?? ''} ${bomItem.comment ?? ''}`.toLowerCase();
    const lcscDesc = lcscPart.description.toLowerCase();
    const commonWords = lcscDesc.split(/\s+/).filter((w) => w.length > 2 && searchText.includes(w));
    if (commonWords.length >= 2) {
      score += 10;
      reasons.push(`Description keywords: ${commonWords.join(', ')}`);
    } else if (commonWords.length === 1) {
      score += 5;
      reasons.push(`Description keyword: ${commonWords[0]}`);
    }
  }

  // Category match (5 points)
  const bomCategory = detectCategory(
    `${bomItem.value ?? ''} ${bomItem.description ?? ''} ${bomItem.comment ?? ''} ${bomItem.mpn ?? ''}`,
  );
  if (bomCategory === lcscPart.category && bomCategory !== 'other') {
    score += 5;
    reasons.push('Category match');
  }

  // Prefer basic parts (small bonus)
  if (lcscPart.partType === 'basic') {
    score += 2;
    reasons.push('Basic part (preferred)');
  }

  return Math.min(score, 100);
}

/**
 * Determine match confidence from score.
 */
function scoreToConfidence(score: number): MatchConfidence {
  if (score >= 70) {
    return 'high';
  }
  if (score >= 40) {
    return 'medium';
  }
  if (score > 0) {
    return 'low';
  }
  return 'none';
}

// ---------------------------------------------------------------------------
// LcscPartMapper — singleton + subscribe
// ---------------------------------------------------------------------------

export class LcscPartMapper {
  private static instance: LcscPartMapper | null = null;

  private database: LcscPart[] = [];
  private overrides = new Map<string, string>(); // bomItemId → LCSC number
  private lastResults: MatchResult[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.database = buildBuiltInDatabase();
    this.load();
  }

  static getInstance(): LcscPartMapper {
    if (!LcscPartMapper.instance) {
      LcscPartMapper.instance = new LcscPartMapper();
    }
    return LcscPartMapper.instance;
  }

  static resetForTesting(): void {
    LcscPartMapper.instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -------------------------------------------------------------------------
  // Database access
  // -------------------------------------------------------------------------

  getDatabase(): LcscPart[] {
    return [...this.database];
  }

  getDatabaseSize(): number {
    return this.database.length;
  }

  findByLcsc(lcscNumber: string): LcscPart | null {
    const upper = lcscNumber.trim().toUpperCase();
    return this.database.find((p) => p.lcsc.toUpperCase() === upper) ?? null;
  }

  findByMpn(mpn: string): LcscPart | null {
    const normalized = mpn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return this.database.find((p) => {
      const pMpn = p.mpn.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return pMpn === normalized;
    }) ?? null;
  }

  searchDatabase(query: string): LcscPart[] {
    if (!query.trim()) {
      return [];
    }
    const lower = query.toLowerCase();
    return this.database.filter((p) =>
      p.lcsc.toLowerCase().includes(lower) ||
      p.mpn.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      (p.value && p.value.toLowerCase().includes(lower)),
    );
  }

  // -------------------------------------------------------------------------
  // Single item matching
  // -------------------------------------------------------------------------

  matchSingle(bomItem: BomItem): MatchResult {
    // Check manual override first
    const override = this.overrides.get(bomItem.id);
    if (override) {
      const part = this.findByLcsc(override);
      if (part) {
        return {
          bomItem,
          lcscPart: part,
          confidence: 'high',
          score: 100,
          matchReasons: ['Manual override'],
          manualOverride: true,
        };
      }
    }

    // Score all candidates
    let bestPart: LcscPart | null = null;
    let bestScore = 0;
    let bestReasons: string[] = [];

    for (const candidate of this.database) {
      const reasons: string[] = [];
      const score = computeMatchScore(bomItem, candidate, reasons);
      if (score > bestScore) {
        bestScore = score;
        bestPart = candidate;
        bestReasons = reasons;
      }
    }

    const minThreshold = 10;
    if (bestScore < minThreshold) {
      return {
        bomItem,
        lcscPart: null,
        confidence: 'none',
        score: 0,
        matchReasons: [],
        manualOverride: false,
      };
    }

    return {
      bomItem,
      lcscPart: bestPart,
      confidence: scoreToConfidence(bestScore),
      score: bestScore,
      matchReasons: bestReasons,
      manualOverride: false,
    };
  }

  // -------------------------------------------------------------------------
  // BOM-wide batch matching
  // -------------------------------------------------------------------------

  matchBom(items: BomItem[]): BomMatchResult {
    const matches = items.map((item) => this.matchSingle(item));
    this.lastResults = matches;
    this.save();
    this.notify();

    let mappedCount = 0;
    let unmappedCount = 0;
    let basicCount = 0;
    let extendedCount = 0;
    let consignmentCount = 0;

    // Track unique extended parts for surcharge calculation
    const uniqueExtended = new Set<string>();

    for (const m of matches) {
      if (m.lcscPart) {
        mappedCount++;
        switch (m.lcscPart.partType) {
          case 'basic':
            basicCount++;
            break;
          case 'extended':
            extendedCount++;
            uniqueExtended.add(m.lcscPart.lcsc);
            break;
          case 'consignment':
            consignmentCount++;
            break;
        }
      } else {
        unmappedCount++;
      }
    }

    return {
      matches,
      mappedCount,
      unmappedCount,
      totalCount: items.length,
      basicCount,
      extendedCount,
      consignmentCount,
      estimatedSurcharge: uniqueExtended.size * EXTENDED_PART_SURCHARGE,
    };
  }

  // -------------------------------------------------------------------------
  // Manual overrides
  // -------------------------------------------------------------------------

  setOverride(bomItemId: string, lcscPartNumber: string): boolean {
    if (!isValidLcscNumber(lcscPartNumber)) {
      return false;
    }
    this.overrides.set(bomItemId, lcscPartNumber.trim());
    this.save();
    this.notify();
    return true;
  }

  removeOverride(bomItemId: string): boolean {
    const existed = this.overrides.delete(bomItemId);
    if (existed) {
      this.save();
      this.notify();
    }
    return existed;
  }

  getOverride(bomItemId: string): string | null {
    return this.overrides.get(bomItemId) ?? null;
  }

  getAllOverrides(): MappingOverride[] {
    const result: MappingOverride[] = [];
    this.overrides.forEach((lcscPartNumber, bomItemId) => {
      result.push({ bomItemId, lcscPartNumber });
    });
    return result;
  }

  clearAllOverrides(): void {
    this.overrides.clear();
    this.save();
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  getStatistics(): MapperStatistics {
    let basicParts = 0;
    let extendedParts = 0;
    let consignmentParts = 0;
    let unmappedItems = 0;
    let totalScore = 0;
    let scoredCount = 0;
    const uniqueExtended = new Set<string>();

    for (const r of this.lastResults) {
      if (r.lcscPart) {
        totalScore += r.score;
        scoredCount++;
        switch (r.lcscPart.partType) {
          case 'basic':
            basicParts++;
            break;
          case 'extended':
            extendedParts++;
            uniqueExtended.add(r.lcscPart.lcsc);
            break;
          case 'consignment':
            consignmentParts++;
            break;
        }
      } else {
        unmappedItems++;
      }
    }

    return {
      totalMappings: this.lastResults.length,
      manualOverrides: this.overrides.size,
      basicParts,
      extendedParts,
      consignmentParts,
      averageConfidence: scoredCount > 0 ? totalScore / scoredCount : 0,
      unmappedItems,
      estimatedSurcharge: uniqueExtended.size * EXTENDED_PART_SURCHARGE,
    };
  }

  getLastResults(): MatchResult[] {
    return [...this.lastResults];
  }

  // -------------------------------------------------------------------------
  // JLCPCB BOM CSV Export
  // -------------------------------------------------------------------------

  /**
   * Export JLCPCB-compatible BOM CSV.
   * Format: Comment, Designator, Footprint, LCSC Part Number
   */
  exportJlcpcbBom(results?: MatchResult[]): string {
    const data = results ?? this.lastResults;
    const lines: string[] = ['Comment,Designator,Footprint,LCSC Part Number'];

    for (const r of data) {
      if (!r.lcscPart) {
        continue;
      }
      const comment = csvEscape(r.bomItem.comment ?? r.bomItem.value ?? r.bomItem.description ?? '');
      const designator = csvEscape(r.bomItem.designator);
      const footprint = csvEscape(r.bomItem.package ?? r.lcscPart.package);
      const lcsc = r.lcscPart.lcsc;
      lines.push(`${comment},${designator},${footprint},${lcsc}`);
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // JLCPCB CPL (Component Placement List) CSV Export
  // -------------------------------------------------------------------------

  /**
   * Export JLCPCB CPL CSV.
   * Format: Designator, Mid X, Mid Y, Rotation, Layer
   */
  exportJlcpcbCpl(items: BomItem[]): string {
    const lines: string[] = ['Designator,Mid X,Mid Y,Rotation,Layer'];

    for (const item of items) {
      // Expand comma-separated designators
      const designators = item.designator.split(',').map((d) => d.trim()).filter(Boolean);
      for (const des of designators) {
        const x = (item.x ?? 0).toFixed(4);
        const y = (item.y ?? 0).toFixed(4);
        const rot = (item.rotation ?? 0).toFixed(1);
        const layer = item.side === 'bottom' ? 'Bottom' : 'Top';
        lines.push(`${csvEscape(des)},${x},${y},${rot},${layer}`);
      }
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // JSON Import/Export of mappings
  // -------------------------------------------------------------------------

  exportMappings(): string {
    const data: ExportedMappings = {
      version: 1,
      timestamp: new Date().toISOString(),
      overrides: this.getAllOverrides(),
      lastResults: this.lastResults,
    };
    return JSON.stringify(data, null, 2);
  }

  importMappings(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const parsed: unknown = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push('Invalid JSON: expected object');
        return { imported, errors };
      }

      const data = parsed as Record<string, unknown>;
      if (typeof data.version !== 'number') {
        errors.push('Missing or invalid version field');
        return { imported, errors };
      }

      if (Array.isArray(data.overrides)) {
        for (const o of data.overrides as unknown[]) {
          if (typeof o === 'object' && o !== null) {
            const override = o as Record<string, unknown>;
            if (typeof override.bomItemId === 'string' && typeof override.lcscPartNumber === 'string') {
              if (isValidLcscNumber(override.lcscPartNumber)) {
                this.overrides.set(override.bomItemId, override.lcscPartNumber);
                imported++;
              } else {
                errors.push(`Invalid LCSC number: ${override.lcscPartNumber}`);
              }
            }
          }
        }
      }

      this.save();
      this.notify();
    } catch (e) {
      errors.push(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
    }

    return { imported, errors };
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private save(): void {
    try {
      const data = {
        overrides: this.getAllOverrides(),
        lastResults: this.lastResults,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      if (Array.isArray(data.overrides)) {
        for (const o of data.overrides as unknown[]) {
          if (typeof o === 'object' && o !== null) {
            const override = o as Record<string, unknown>;
            if (typeof override.bomItemId === 'string' && typeof override.lcscPartNumber === 'string') {
              this.overrides.set(override.bomItemId, override.lcscPartNumber);
            }
          }
        }
      }

      if (Array.isArray(data.lastResults)) {
        this.lastResults = data.lastResults as MatchResult[];
      }
    } catch {
      // localStorage may be unavailable or corrupt
    }
  }

  /**
   * Clear all data and reset to built-in database only.
   */
  reset(): void {
    this.overrides.clear();
    this.lastResults = [];
    this.database = buildBuiltInDatabase();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// CSV helper
// ---------------------------------------------------------------------------

function csvEscape(field: string): string {
  if (!field) {
    return '""';
  }
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useLcscMapper(): {
  matchSingle: (bomItem: BomItem) => MatchResult;
  matchBom: (items: BomItem[]) => BomMatchResult;
  setOverride: (bomItemId: string, lcscPartNumber: string) => boolean;
  removeOverride: (bomItemId: string) => boolean;
  clearAllOverrides: () => void;
  findByLcsc: (lcscNumber: string) => LcscPart | null;
  findByMpn: (mpn: string) => LcscPart | null;
  searchDatabase: (query: string) => LcscPart[];
  statistics: MapperStatistics;
  lastResults: MatchResult[];
  databaseSize: number;
  exportJlcpcbBom: (results?: MatchResult[]) => string;
  exportJlcpcbCpl: (items: BomItem[]) => string;
  exportMappings: () => string;
  importMappings: (json: string) => { imported: number; errors: string[] };
  reset: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const mapper = LcscPartMapper.getInstance();
    const unsubscribe = mapper.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const matchSingle = useCallback((bomItem: BomItem) => {
    return LcscPartMapper.getInstance().matchSingle(bomItem);
  }, []);

  const matchBom = useCallback((items: BomItem[]) => {
    return LcscPartMapper.getInstance().matchBom(items);
  }, []);

  const setOverride = useCallback((bomItemId: string, lcscPartNumber: string) => {
    return LcscPartMapper.getInstance().setOverride(bomItemId, lcscPartNumber);
  }, []);

  const removeOverride = useCallback((bomItemId: string) => {
    return LcscPartMapper.getInstance().removeOverride(bomItemId);
  }, []);

  const clearAllOverrides = useCallback(() => {
    LcscPartMapper.getInstance().clearAllOverrides();
  }, []);

  const findByLcsc = useCallback((lcscNumber: string) => {
    return LcscPartMapper.getInstance().findByLcsc(lcscNumber);
  }, []);

  const findByMpn = useCallback((mpn: string) => {
    return LcscPartMapper.getInstance().findByMpn(mpn);
  }, []);

  const searchDatabase = useCallback((query: string) => {
    return LcscPartMapper.getInstance().searchDatabase(query);
  }, []);

  const exportJlcpcbBom = useCallback((results?: MatchResult[]) => {
    return LcscPartMapper.getInstance().exportJlcpcbBom(results);
  }, []);

  const exportJlcpcbCpl = useCallback((items: BomItem[]) => {
    return LcscPartMapper.getInstance().exportJlcpcbCpl(items);
  }, []);

  const exportMappings = useCallback(() => {
    return LcscPartMapper.getInstance().exportMappings();
  }, []);

  const importMappings = useCallback((json: string) => {
    return LcscPartMapper.getInstance().importMappings(json);
  }, []);

  const reset = useCallback(() => {
    LcscPartMapper.getInstance().reset();
  }, []);

  const mapper = LcscPartMapper.getInstance();

  return {
    matchSingle,
    matchBom,
    setOverride,
    removeOverride,
    clearAllOverrides,
    findByLcsc,
    findByMpn,
    searchDatabase,
    statistics: mapper.getStatistics(),
    lastResults: mapper.getLastResults(),
    databaseSize: mapper.getDatabaseSize(),
    exportJlcpcbBom,
    exportJlcpcbCpl,
    exportMappings,
    importMappings,
    reset,
  };
}
