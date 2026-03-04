/**
 * Parametric Component Search Engine
 *
 * Client-side search engine for finding electronic components by electrical/physical
 * parameters. Supports filtering by resistance, capacitance, voltage, etc. with
 * SI prefix parsing, faceted results, pagination, sorting, and autocomplete.
 *
 * Usage:
 *   const engine = ParametricSearchEngine.getInstance();
 *   engine.indexComponent({ id: '1', name: '10k Resistor', ... });
 *   const results = engine.search([{ parameter: 'resistance', operator: 'eq', value: 10000 }]);
 *
 * React hook:
 *   const { search, indexComponent, count } = useParametricSearch();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParameterUnit =
  | 'ohm'
  | 'farad'
  | 'henry'
  | 'volt'
  | 'amp'
  | 'watt'
  | 'hertz'
  | 'celsius'
  | 'mm'
  | 'mil'
  | 'inch'
  | 'gram'
  | 'none';

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'range' | 'contains' | 'startsWith';

export interface ComponentParameter {
  name: string;
  value: number | string;
  unit: ParameterUnit;
  min?: number;
  max?: number;
  tolerance?: number; // percentage
}

export interface IndexedComponent {
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  partNumber?: string;
  description: string;
  parameters: ComponentParameter[];
  datasheet?: string;
  inStock?: boolean;
  unitPrice?: number;
}

export interface ParametricFilter {
  parameter: string;
  operator: FilterOperator;
  value: number | string;
  value2?: number; // for 'range' operator (upper bound)
  unit?: ParameterUnit;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface FacetResult {
  parameter: string;
  values: FacetValue[];
  min?: number;
  max?: number;
  unit?: ParameterUnit;
}

export interface SearchResult {
  components: IndexedComponent[];
  totalCount: number;
  facets: FacetResult[];
  appliedFilters: ParametricFilter[];
  page: number;
  pageSize: number;
  totalPages: number;
}

export type SortField = 'name' | 'category' | 'unitPrice' | string; // string for parameter names
export type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-parametric-search';

/** SI prefix multipliers */
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

/** Maps unit suffixes to ParameterUnit */
const UNIT_SUFFIX_MAP: Record<string, ParameterUnit> = {
  '\u2126': 'ohm', // Ω
  ohm: 'ohm',
  ohms: 'ohm',
  R: 'ohm',
  F: 'farad',
  farad: 'farad',
  farads: 'farad',
  H: 'henry',
  henry: 'henry',
  henrys: 'henry',
  V: 'volt',
  volt: 'volt',
  volts: 'volt',
  A: 'amp',
  amp: 'amp',
  amps: 'amp',
  W: 'watt',
  watt: 'watt',
  watts: 'watt',
  Hz: 'hertz',
  hertz: 'hertz',
  '\u00B0C': 'celsius', // °C
  C: 'celsius',
  mm: 'mm',
  mil: 'mil',
  inch: 'inch',
  in: 'inch',
  g: 'gram',
  gram: 'gram',
  grams: 'gram',
};

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Parameter Extractors
// ---------------------------------------------------------------------------

/**
 * Extract resistor parameters from a component name/description.
 * Handles formats like "10k", "4.7kΩ", "100R 1% 0.25W 0805"
 */
export function extractResistorParams(name: string): ComponentParameter[] {
  const params: ComponentParameter[] = [];
  const text = name.trim();

  // Resistance value: digits with optional decimal, optional SI prefix, optional Ω/R/ohm
  const resistancePattern = /(\d+(?:\.\d+)?)\s*([kKMG]?)\s*(?:[\u2126Rohm]|ohms?)?/i;
  const rMatch = resistancePattern.exec(text);
  if (rMatch) {
    const rawValue = parseFloat(rMatch[1]);
    const prefix = rMatch[2] || '';
    const multiplier = SI_PREFIXES[prefix] ?? 1;
    params.push({ name: 'resistance', value: rawValue * multiplier, unit: 'ohm' });
  }

  // Tolerance: e.g. "1%", "5%", "0.1%"
  const tolerancePattern = /(\d+(?:\.\d+)?)\s*%/;
  const tMatch = tolerancePattern.exec(text);
  if (tMatch) {
    params.push({ name: 'tolerance', value: parseFloat(tMatch[1]), unit: 'none', tolerance: parseFloat(tMatch[1]) });
  }

  // Power rating: e.g. "0.25W", "1W", "0.5 watt"
  const powerPattern = /(\d+(?:\.\d+)?)\s*[Ww](?:att)?/;
  const pMatch = powerPattern.exec(text);
  if (pMatch) {
    params.push({ name: 'power', value: parseFloat(pMatch[1]), unit: 'watt' });
  }

  // Package: 4-digit code like 0805, 0603, 1206
  const packagePattern = /\b(0201|0402|0603|0805|1206|1210|2010|2512)\b/;
  const pkgMatch = packagePattern.exec(text);
  if (pkgMatch) {
    params.push({ name: 'package', value: pkgMatch[1], unit: 'none' });
  }

  return params;
}

/**
 * Extract capacitor parameters from a component name/description.
 * Handles formats like "100nF", "4.7uF 25V", "10pF C0G 0402"
 */
export function extractCapacitorParams(name: string): ComponentParameter[] {
  const params: ComponentParameter[] = [];
  const text = name.trim();

  // Capacitance value: digits with optional decimal, SI prefix, optional F
  const capPattern = /(\d+(?:\.\d+)?)\s*([pnu\u00B5\u03BC])\s*F?/i;
  const cMatch = capPattern.exec(text);
  if (cMatch) {
    const rawValue = parseFloat(cMatch[1]);
    const prefix = cMatch[2];
    const multiplier = SI_PREFIXES[prefix] ?? 1;
    params.push({ name: 'capacitance', value: rawValue * multiplier, unit: 'farad' });
  }

  // Voltage rating: e.g. "25V", "16V", "50 volt"
  const voltagePattern = /(\d+(?:\.\d+)?)\s*[Vv](?:olt)?/;
  const vMatch = voltagePattern.exec(text);
  if (vMatch) {
    params.push({ name: 'voltage', value: parseFloat(vMatch[1]), unit: 'volt' });
  }

  // Tolerance: e.g. "10%", "5%"
  const tolerancePattern = /(\d+(?:\.\d+)?)\s*%/;
  const tMatch = tolerancePattern.exec(text);
  if (tMatch) {
    params.push({ name: 'tolerance', value: parseFloat(tMatch[1]), unit: 'none', tolerance: parseFloat(tMatch[1]) });
  }

  // Dielectric type: C0G, NP0, X5R, X7R, Y5V
  const dielectricPattern = /\b(C0G|NP0|X5R|X7R|X7S|Y5V|Z5U)\b/i;
  const dMatch = dielectricPattern.exec(text);
  if (dMatch) {
    params.push({ name: 'dielectric', value: dMatch[1].toUpperCase(), unit: 'none' });
  }

  // Package
  const packagePattern = /\b(0201|0402|0603|0805|1206|1210|2010|2512)\b/;
  const pkgMatch = packagePattern.exec(text);
  if (pkgMatch) {
    params.push({ name: 'package', value: pkgMatch[1], unit: 'none' });
  }

  return params;
}

/**
 * Extract inductor parameters from a component name/description.
 * Handles formats like "100uH", "4.7mH 2A", "10nH 0402"
 */
export function extractInductorParams(name: string): ComponentParameter[] {
  const params: ComponentParameter[] = [];
  const text = name.trim();

  // Inductance value: digits with optional decimal, SI prefix, optional H
  const indPattern = /(\d+(?:\.\d+)?)\s*([pnu\u00B5\u03BCmM]?)\s*H/i;
  const iMatch = indPattern.exec(text);
  if (iMatch) {
    const rawValue = parseFloat(iMatch[1]);
    const prefix = iMatch[2] || '';
    const multiplier = SI_PREFIXES[prefix] ?? 1;
    params.push({ name: 'inductance', value: rawValue * multiplier, unit: 'henry' });
  }

  // Current rating: e.g. "2A", "500mA", "1.5 amp"
  const currentPattern = /(\d+(?:\.\d+)?)\s*([m]?)\s*[Aa](?:mp)?/;
  const cMatch = currentPattern.exec(text);
  if (cMatch) {
    const rawValue = parseFloat(cMatch[1]);
    const prefix = cMatch[2] || '';
    const multiplier = SI_PREFIXES[prefix] ?? 1;
    params.push({ name: 'current', value: rawValue * multiplier, unit: 'amp' });
  }

  // DCR: e.g. "DCR 0.5Ω", "DCR: 100mΩ"
  const dcrPattern = /DCR[:\s]*(\d+(?:\.\d+)?)\s*([m]?)\s*[\u2126Rohm]/i;
  const dMatch = dcrPattern.exec(text);
  if (dMatch) {
    const rawValue = parseFloat(dMatch[1]);
    const prefix = dMatch[2] || '';
    const multiplier = SI_PREFIXES[prefix] ?? 1;
    params.push({ name: 'dcr', value: rawValue * multiplier, unit: 'ohm' });
  }

  // Package
  const packagePattern = /\b(0201|0402|0603|0805|1206|1210|2010|2512)\b/;
  const pkgMatch = packagePattern.exec(text);
  if (pkgMatch) {
    params.push({ name: 'package', value: pkgMatch[1], unit: 'none' });
  }

  return params;
}

/**
 * Extract IC parameters from a component name/description.
 * Handles formats like "ATmega328P TQFP-32 5V", "LM7805 TO-220"
 */
export function extractICParams(name: string): ComponentParameter[] {
  const params: ComponentParameter[] = [];
  const text = name.trim();

  // Supply voltage: e.g. "5V", "3.3V", "1.8V"
  const voltagePattern = /(\d+(?:\.\d+)?)\s*[Vv](?:olt)?/;
  const vMatch = voltagePattern.exec(text);
  if (vMatch) {
    params.push({ name: 'voltage', value: parseFloat(vMatch[1]), unit: 'volt' });
  }

  // Package: QFP, TQFP, SOIC, DIP, SOT, BGA, QFN, TO-xxx, etc.
  const packagePattern =
    /\b(DIP-?\d+|SOIC-?\d+|TQFP-?\d+|QFP-?\d+|QFN-?\d+|BGA-?\d+|SOT-?\d+|TO-?\d+|LQFP-?\d+|SOP-?\d+|SSOP-?\d+|MSOP-?\d+)\b/i;
  const pkgMatch = packagePattern.exec(text);
  if (pkgMatch) {
    params.push({ name: 'package', value: pkgMatch[1].toUpperCase(), unit: 'none' });
  }

  // Pin count from package (if not already captured)
  const pinCountPattern = /(\d+)\s*-?\s*pin/i;
  const pinMatch = pinCountPattern.exec(text);
  if (pinMatch) {
    params.push({ name: 'pinCount', value: parseInt(pinMatch[1], 10), unit: 'none' });
  } else if (pkgMatch) {
    // Try to extract pin count from the package designation
    const pinFromPkg = /(\d+)$/.exec(pkgMatch[1]);
    if (pinFromPkg) {
      params.push({ name: 'pinCount', value: parseInt(pinFromPkg[1], 10), unit: 'none' });
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// Built-in Sample Components
// ---------------------------------------------------------------------------

function createSampleComponents(): IndexedComponent[] {
  return [
    // Resistors
    {
      id: 'sample-r1',
      name: '10k Resistor 1% 0805',
      category: 'Resistor',
      manufacturer: 'Yageo',
      partNumber: 'RC0805FR-0710KL',
      description: '10k ohm resistor, 1% tolerance, 0805 package, 0.125W',
      parameters: [
        { name: 'resistance', value: 10000, unit: 'ohm' },
        { name: 'tolerance', value: 1, unit: 'none', tolerance: 1 },
        { name: 'power', value: 0.125, unit: 'watt' },
        { name: 'package', value: '0805', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.01,
    },
    {
      id: 'sample-r2',
      name: '4.7k Resistor 5% 0603',
      category: 'Resistor',
      manufacturer: 'Yageo',
      partNumber: 'RC0603JR-074K7L',
      description: '4.7k ohm resistor, 5% tolerance, 0603 package, 0.1W',
      parameters: [
        { name: 'resistance', value: 4700, unit: 'ohm' },
        { name: 'tolerance', value: 5, unit: 'none', tolerance: 5 },
        { name: 'power', value: 0.1, unit: 'watt' },
        { name: 'package', value: '0603', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.005,
    },
    {
      id: 'sample-r3',
      name: '100 Resistor 1% 1206',
      category: 'Resistor',
      manufacturer: 'Vishay',
      partNumber: 'CRCW1206100RFKEA',
      description: '100 ohm resistor, 1% tolerance, 1206 package, 0.25W',
      parameters: [
        { name: 'resistance', value: 100, unit: 'ohm' },
        { name: 'tolerance', value: 1, unit: 'none', tolerance: 1 },
        { name: 'power', value: 0.25, unit: 'watt' },
        { name: 'package', value: '1206', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.02,
    },
    {
      id: 'sample-r4',
      name: '1M Resistor 5% 0402',
      category: 'Resistor',
      manufacturer: 'Samsung',
      partNumber: 'RC1005J105CS',
      description: '1M ohm resistor, 5% tolerance, 0402 package',
      parameters: [
        { name: 'resistance', value: 1000000, unit: 'ohm' },
        { name: 'tolerance', value: 5, unit: 'none', tolerance: 5 },
        { name: 'package', value: '0402', unit: 'none' },
      ],
      inStock: false,
      unitPrice: 0.003,
    },
    {
      id: 'sample-r5',
      name: '220 Resistor 1% 0805',
      category: 'Resistor',
      manufacturer: 'Yageo',
      partNumber: 'RC0805FR-07220RL',
      description: '220 ohm resistor, 1% tolerance, 0805 package, 0.125W',
      parameters: [
        { name: 'resistance', value: 220, unit: 'ohm' },
        { name: 'tolerance', value: 1, unit: 'none', tolerance: 1 },
        { name: 'power', value: 0.125, unit: 'watt' },
        { name: 'package', value: '0805', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.01,
    },
    // Capacitors
    {
      id: 'sample-c1',
      name: '100nF Capacitor X7R 0805 25V',
      category: 'Capacitor',
      manufacturer: 'Murata',
      partNumber: 'GRM21BR71E104KA01',
      description: '100nF ceramic capacitor, X7R dielectric, 0805 package, 25V',
      parameters: [
        { name: 'capacitance', value: 100e-9, unit: 'farad' },
        { name: 'voltage', value: 25, unit: 'volt' },
        { name: 'dielectric', value: 'X7R', unit: 'none' },
        { name: 'package', value: '0805', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.02,
    },
    {
      id: 'sample-c2',
      name: '10uF Capacitor X5R 0805 16V',
      category: 'Capacitor',
      manufacturer: 'Samsung',
      partNumber: 'CL21A106KAYNNNE',
      description: '10uF ceramic capacitor, X5R dielectric, 0805 package, 16V',
      parameters: [
        { name: 'capacitance', value: 10e-6, unit: 'farad' },
        { name: 'voltage', value: 16, unit: 'volt' },
        { name: 'dielectric', value: 'X5R', unit: 'none' },
        { name: 'package', value: '0805', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.05,
    },
    {
      id: 'sample-c3',
      name: '1uF Capacitor X7R 0603 50V',
      category: 'Capacitor',
      manufacturer: 'TDK',
      partNumber: 'C1608X7R1H105K080AB',
      description: '1uF ceramic capacitor, X7R dielectric, 0603 package, 50V',
      parameters: [
        { name: 'capacitance', value: 1e-6, unit: 'farad' },
        { name: 'voltage', value: 50, unit: 'volt' },
        { name: 'dielectric', value: 'X7R', unit: 'none' },
        { name: 'package', value: '0603', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.03,
    },
    {
      id: 'sample-c4',
      name: '22pF Capacitor C0G 0402 50V',
      category: 'Capacitor',
      manufacturer: 'Murata',
      partNumber: 'GRM1555C1H220JA01',
      description: '22pF ceramic capacitor, C0G dielectric, 0402 package, 50V',
      parameters: [
        { name: 'capacitance', value: 22e-12, unit: 'farad' },
        { name: 'voltage', value: 50, unit: 'volt' },
        { name: 'dielectric', value: 'C0G', unit: 'none' },
        { name: 'package', value: '0402', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.01,
    },
    {
      id: 'sample-c5',
      name: '4.7uF Capacitor X5R 1206 25V',
      category: 'Capacitor',
      manufacturer: 'Murata',
      partNumber: 'GRM31CR61E475KA12',
      description: '4.7uF ceramic capacitor, X5R dielectric, 1206 package, 25V',
      parameters: [
        { name: 'capacitance', value: 4.7e-6, unit: 'farad' },
        { name: 'voltage', value: 25, unit: 'volt' },
        { name: 'dielectric', value: 'X5R', unit: 'none' },
        { name: 'package', value: '1206', unit: 'none' },
      ],
      inStock: false,
      unitPrice: 0.04,
    },
    // Inductors
    {
      id: 'sample-l1',
      name: '10uH Inductor 1A 0805',
      category: 'Inductor',
      manufacturer: 'Murata',
      partNumber: 'LQM21FN100N00',
      description: '10uH inductor, 1A current rating, 0805 package',
      parameters: [
        { name: 'inductance', value: 10e-6, unit: 'henry' },
        { name: 'current', value: 1, unit: 'amp' },
        { name: 'package', value: '0805', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.15,
    },
    {
      id: 'sample-l2',
      name: '100uH Inductor 500mA 1210',
      category: 'Inductor',
      manufacturer: 'Bourns',
      partNumber: 'SRN3015-101M',
      description: '100uH inductor, 500mA current rating, 1210 package',
      parameters: [
        { name: 'inductance', value: 100e-6, unit: 'henry' },
        { name: 'current', value: 0.5, unit: 'amp' },
        { name: 'package', value: '1210', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.25,
    },
    {
      id: 'sample-l3',
      name: '4.7uH Inductor 2A 1206',
      category: 'Inductor',
      manufacturer: 'TDK',
      partNumber: 'VLF3010AT-4R7MR80',
      description: '4.7uH inductor, 2A current rating, 1206 package',
      parameters: [
        { name: 'inductance', value: 4.7e-6, unit: 'henry' },
        { name: 'current', value: 2, unit: 'amp' },
        { name: 'package', value: '1206', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.30,
    },
    {
      id: 'sample-l4',
      name: '1mH Inductor 100mA',
      category: 'Inductor',
      manufacturer: 'Bourns',
      partNumber: 'SDR0302-102KL',
      description: '1mH inductor, 100mA current rating',
      parameters: [
        { name: 'inductance', value: 1e-3, unit: 'henry' },
        { name: 'current', value: 0.1, unit: 'amp' },
      ],
      inStock: false,
      unitPrice: 0.40,
    },
    {
      id: 'sample-l5',
      name: '22nH Inductor 0402',
      category: 'Inductor',
      manufacturer: 'Murata',
      partNumber: 'LQW15AN22NJ00',
      description: '22nH inductor, 0402 package, RF applications',
      parameters: [
        { name: 'inductance', value: 22e-9, unit: 'henry' },
        { name: 'package', value: '0402', unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.08,
    },
    // ICs
    {
      id: 'sample-ic1',
      name: 'ATmega328P TQFP-32 5V',
      category: 'IC',
      manufacturer: 'Microchip',
      partNumber: 'ATMEGA328P-AU',
      description: 'ATmega328P microcontroller, TQFP-32 package, 5V supply',
      parameters: [
        { name: 'voltage', value: 5, unit: 'volt' },
        { name: 'package', value: 'TQFP-32', unit: 'none' },
        { name: 'pinCount', value: 32, unit: 'none' },
      ],
      inStock: true,
      unitPrice: 2.50,
    },
    {
      id: 'sample-ic2',
      name: 'ESP32-WROOM-32 Module',
      category: 'IC',
      manufacturer: 'Espressif',
      partNumber: 'ESP32-WROOM-32',
      description: 'ESP32 WiFi+BLE module, 38-pin, 3.3V',
      parameters: [
        { name: 'voltage', value: 3.3, unit: 'volt' },
        { name: 'pinCount', value: 38, unit: 'none' },
      ],
      inStock: true,
      unitPrice: 3.00,
    },
    {
      id: 'sample-ic3',
      name: 'LM7805 TO-220 5V Regulator',
      category: 'IC',
      manufacturer: 'Texas Instruments',
      partNumber: 'LM7805CT',
      description: 'LM7805 5V linear voltage regulator, TO-220 package',
      parameters: [
        { name: 'voltage', value: 5, unit: 'volt' },
        { name: 'package', value: 'TO-220', unit: 'none' },
        { name: 'pinCount', value: 3, unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.50,
    },
    {
      id: 'sample-ic4',
      name: 'NE555 Timer DIP-8',
      category: 'IC',
      manufacturer: 'Texas Instruments',
      partNumber: 'NE555P',
      description: 'NE555 timer IC, DIP-8 package, 4.5-16V',
      parameters: [
        { name: 'voltage', value: 16, unit: 'volt' },
        { name: 'package', value: 'DIP-8', unit: 'none' },
        { name: 'pinCount', value: 8, unit: 'none' },
      ],
      inStock: true,
      unitPrice: 0.40,
    },
    {
      id: 'sample-ic5',
      name: 'STM32F103C8T6 LQFP-48 3.3V',
      category: 'IC',
      manufacturer: 'STMicroelectronics',
      partNumber: 'STM32F103C8T6',
      description: 'STM32F103 ARM Cortex-M3 microcontroller, LQFP-48, 3.3V, 72MHz',
      parameters: [
        { name: 'voltage', value: 3.3, unit: 'volt' },
        { name: 'package', value: 'LQFP-48', unit: 'none' },
        { name: 'pinCount', value: 48, unit: 'none' },
      ],
      inStock: false,
      unitPrice: 4.00,
    },
  ];
}

// ---------------------------------------------------------------------------
// ParametricSearchEngine
// ---------------------------------------------------------------------------

/**
 * Parametric component search engine with filtering, faceting, pagination,
 * sorting, and autocomplete. Singleton per application.
 */
export class ParametricSearchEngine {
  private static instance: ParametricSearchEngine | null = null;

  private components: Map<string, IndexedComponent> = new Map();
  private listeners = new Set<Listener>();

  constructor() {
    this.loadSampleComponents();
  }

  /** Get or create the singleton instance. */
  static getInstance(): ParametricSearchEngine {
    if (!ParametricSearchEngine.instance) {
      ParametricSearchEngine.instance = new ParametricSearchEngine();
    }
    return ParametricSearchEngine.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    ParametricSearchEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
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

  // -----------------------------------------------------------------------
  // Index Management
  // -----------------------------------------------------------------------

  /** Add a single component to the index. */
  indexComponent(component: IndexedComponent): void {
    this.components.set(component.id, { ...component });
    this.save();
    this.notify();
  }

  /** Add multiple components to the index. */
  indexComponents(components: IndexedComponent[]): void {
    for (const component of components) {
      this.components.set(component.id, { ...component });
    }
    this.save();
    this.notify();
  }

  /** Remove a component from the index. Returns true if found and removed. */
  removeComponent(id: string): boolean {
    const existed = this.components.delete(id);
    if (existed) {
      this.save();
      this.notify();
    }
    return existed;
  }

  /** Get a component by ID. */
  getComponent(id: string): IndexedComponent | undefined {
    const comp = this.components.get(id);
    return comp ? { ...comp } : undefined;
  }

  /** Get the total number of indexed components. */
  getComponentCount(): number {
    return this.components.size;
  }

  /** Remove all components from the index. */
  clear(): void {
    this.components.clear();
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  /**
   * Search the index with parametric filters. Supports pagination, sorting,
   * and AND/OR filter combination modes.
   */
  search(
    filters: ParametricFilter[],
    options?: {
      page?: number;
      pageSize?: number;
      sort?: SortField;
      direction?: SortDirection;
      combineMode?: 'and' | 'or';
    },
  ): SearchResult {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const sort = options?.sort ?? 'name';
    const direction = options?.direction ?? 'asc';
    const combineMode = options?.combineMode ?? 'and';

    // Collect all components
    const allComponents: IndexedComponent[] = [];
    this.components.forEach((comp) => {
      allComponents.push(comp);
    });

    // Apply filters
    let matched: IndexedComponent[];
    if (filters.length === 0) {
      matched = allComponents;
    } else {
      matched = allComponents.filter((comp) => {
        if (combineMode === 'and') {
          return filters.every((f) => this.matchesFilter(comp, f));
        } else {
          return filters.some((f) => this.matchesFilter(comp, f));
        }
      });
    }

    // Sort
    matched.sort((a, b) => {
      const multiplier = direction === 'asc' ? 1 : -1;
      const aVal = this.getSortValue(a, sort);
      const bVal = this.getSortValue(b, sort);

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * multiplier;
      }
      return String(aVal).localeCompare(String(bVal)) * multiplier;
    });

    // Compute facets from matched results
    const facets = this.computeFacets(matched, filters);

    // Paginate
    const totalCount = matched.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startIndex = (page - 1) * pageSize;
    const pageComponents = matched.slice(startIndex, startIndex + pageSize);

    return {
      components: pageComponents,
      totalCount,
      facets,
      appliedFilters: filters,
      page,
      pageSize,
      totalPages,
    };
  }

  // -----------------------------------------------------------------------
  // Facets
  // -----------------------------------------------------------------------

  /**
   * Get faceted values for a specific parameter, optionally pre-filtered
   * by existing filters.
   */
  getFacets(parameter: string, existingFilters?: ParametricFilter[]): FacetResult {
    // Collect matching components
    const allComponents: IndexedComponent[] = [];
    this.components.forEach((comp) => {
      allComponents.push(comp);
    });

    let filtered: IndexedComponent[];
    if (existingFilters && existingFilters.length > 0) {
      filtered = allComponents.filter((comp) => existingFilters.every((f) => this.matchesFilter(comp, f)));
    } else {
      filtered = allComponents;
    }

    return this.computeSingleFacet(filtered, parameter);
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get all unique category names in the index. */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.components.forEach((comp) => {
      categories.add(comp.category);
    });
    return Array.from(categories).sort();
  }

  /** Get all unique parameter names across all components. */
  getParameterNames(): string[] {
    const names = new Set<string>();
    this.components.forEach((comp) => {
      for (const param of comp.parameters) {
        names.add(param.name);
      }
    });
    return Array.from(names).sort();
  }

  /**
   * Get component suggestions based on a partial name match (prefix-based).
   * Returns up to `limit` results.
   */
  getSuggestions(partialName: string, limit?: number): IndexedComponent[] {
    const maxResults = limit ?? 10;
    const lower = partialName.toLowerCase();
    const results: IndexedComponent[] = [];

    this.components.forEach((comp) => {
      if (results.length >= maxResults) {
        return;
      }
      if (comp.name.toLowerCase().startsWith(lower)) {
        results.push({ ...comp });
      }
    });

    return results;
  }

  // -----------------------------------------------------------------------
  // Value Parsing
  // -----------------------------------------------------------------------

  /**
   * Parse a value string with unit suffix into a numeric value and unit.
   * Handles SI prefixes: p, n, u/µ, m, k, M, G, T
   * Examples: "10kΩ" → { value: 10000, unit: 'ohm' }
   *           "4.7uF" → { value: 4.7e-6, unit: 'farad' }
   *           "100nH" → { value: 100e-9, unit: 'henry' }
   *           "3.3V"  → { value: 3.3, unit: 'volt' }
   */
  parseValueWithUnit(input: string): { value: number; unit: ParameterUnit } | null {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    // Pattern: number, optional SI prefix, unit suffix
    // Match: digits with optional decimal, then optional SI prefix, then unit
    const pattern =
      /^(\d+(?:\.\d+)?)\s*([pnu\u00B5\u03BCmkKMGT]?)\s*([\u2126\u00B0]?[A-Za-z]*)\s*$/;
    const match = pattern.exec(trimmed);

    if (!match) {
      return null;
    }

    const numericValue = parseFloat(match[1]);
    const prefix = match[2] || '';
    const unitStr = match[3] || '';

    if (isNaN(numericValue)) {
      return null;
    }

    // Determine unit
    let unit: ParameterUnit = 'none';
    if (unitStr) {
      const mappedUnit = UNIT_SUFFIX_MAP[unitStr];
      if (mappedUnit) {
        unit = mappedUnit;
      } else {
        // Try case-insensitive lookup
        const lowerUnitStr = unitStr.toLowerCase();
        const entries = Object.entries(UNIT_SUFFIX_MAP);
        for (const [key, value] of entries) {
          if (key.toLowerCase() === lowerUnitStr) {
            unit = value;
            break;
          }
        }
        // If still not found but we have a prefix, it might be a standalone unit letter
        if (unit === 'none' && !unitStr) {
          return null;
        }
      }
    }

    // Apply SI prefix
    const multiplier = SI_PREFIXES[prefix] ?? 1;
    const value = numericValue * multiplier;

    return { value, unit };
  }

  /**
   * Normalize a value using SI prefix conversion. Converts between the same
   * unit with different magnitudes.
   */
  normalizeValue(value: number, fromUnit: ParameterUnit, _toUnit?: ParameterUnit): number {
    // Since we store values in base units already, normalization is identity
    // unless converting between unit systems (not applicable for same-type units).
    // This method is primarily for SI prefix handling which is already done at parse time.
    // For cross-unit conversion, we'd need a conversion table.
    if (_toUnit && _toUnit !== fromUnit) {
      // Length conversions
      if (fromUnit === 'mm' && _toUnit === 'mil') {
        return value * 39.3701;
      }
      if (fromUnit === 'mil' && _toUnit === 'mm') {
        return value * 0.0254;
      }
      if (fromUnit === 'mm' && _toUnit === 'inch') {
        return value / 25.4;
      }
      if (fromUnit === 'inch' && _toUnit === 'mm') {
        return value * 25.4;
      }
      if (fromUnit === 'mil' && _toUnit === 'inch') {
        return value / 1000;
      }
      if (fromUnit === 'inch' && _toUnit === 'mil') {
        return value * 1000;
      }
    }
    return value;
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export the entire index as a JSON string. */
  exportIndex(): string {
    const components: IndexedComponent[] = [];
    this.components.forEach((comp) => {
      components.push(comp);
    });
    return JSON.stringify({ version: 1, components });
  }

  /** Import components from a JSON string. Returns import stats. */
  importIndex(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { imported: 0, errors: ['JSON must be an object'] };
    }

    const data = parsed as Record<string, unknown>;
    if (!Array.isArray(data.components)) {
      return { imported: 0, errors: ['Missing "components" array'] };
    }

    for (const item of data.components) {
      if (typeof item !== 'object' || item === null) {
        errors.push('Invalid component entry (not an object)');
        continue;
      }

      const comp = item as Record<string, unknown>;
      if (typeof comp.id !== 'string' || typeof comp.name !== 'string' || typeof comp.category !== 'string') {
        errors.push(`Invalid component: missing id, name, or category`);
        continue;
      }

      if (!Array.isArray(comp.parameters)) {
        errors.push(`Component "${comp.name}": missing parameters array`);
        continue;
      }

      this.components.set(comp.id as string, item as IndexedComponent);
      imported++;
    }

    if (imported > 0) {
      this.save();
      this.notify();
    }

    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /** Check if a component matches a single filter. */
  private matchesFilter(comp: IndexedComponent, filter: ParametricFilter): boolean {
    // Special handling for non-parameter fields
    if (filter.parameter === 'category') {
      return this.matchValue(comp.category, filter);
    }
    if (filter.parameter === 'name') {
      return this.matchValue(comp.name, filter);
    }
    if (filter.parameter === 'manufacturer') {
      return this.matchValue(comp.manufacturer ?? '', filter);
    }
    if (filter.parameter === 'inStock') {
      const stockVal = comp.inStock ? 'true' : 'false';
      return this.matchValue(stockVal, filter);
    }

    // Find matching parameter(s)
    const matchingParams = comp.parameters.filter(
      (p) => p.name.toLowerCase() === filter.parameter.toLowerCase(),
    );

    if (matchingParams.length === 0) {
      return false;
    }

    return matchingParams.some((param) => this.matchValue(param.value, filter));
  }

  /** Match a value against a filter's operator and value. */
  private matchValue(componentValue: number | string, filter: ParametricFilter): boolean {
    const filterValue = filter.value;

    switch (filter.operator) {
      case 'eq':
        if (typeof componentValue === 'number' && typeof filterValue === 'number') {
          return Math.abs(componentValue - filterValue) < Number.EPSILON * 100;
        }
        return String(componentValue).toLowerCase() === String(filterValue).toLowerCase();

      case 'neq':
        if (typeof componentValue === 'number' && typeof filterValue === 'number') {
          return Math.abs(componentValue - filterValue) >= Number.EPSILON * 100;
        }
        return String(componentValue).toLowerCase() !== String(filterValue).toLowerCase();

      case 'gt':
        if (typeof componentValue === 'number' && typeof filterValue === 'number') {
          return componentValue > filterValue;
        }
        return String(componentValue) > String(filterValue);

      case 'gte':
        if (typeof componentValue === 'number' && typeof filterValue === 'number') {
          return componentValue >= filterValue;
        }
        return String(componentValue) >= String(filterValue);

      case 'lt':
        if (typeof componentValue === 'number' && typeof filterValue === 'number') {
          return componentValue < filterValue;
        }
        return String(componentValue) < String(filterValue);

      case 'lte':
        if (typeof componentValue === 'number' && typeof filterValue === 'number') {
          return componentValue <= filterValue;
        }
        return String(componentValue) <= String(filterValue);

      case 'range':
        if (typeof componentValue === 'number' && typeof filterValue === 'number' && typeof filter.value2 === 'number') {
          return componentValue >= filterValue && componentValue <= filter.value2;
        }
        return false;

      case 'contains':
        return String(componentValue).toLowerCase().includes(String(filterValue).toLowerCase());

      case 'startsWith':
        return String(componentValue).toLowerCase().startsWith(String(filterValue).toLowerCase());

      default:
        return false;
    }
  }

  /** Get a sortable value for a component given a sort field. */
  private getSortValue(comp: IndexedComponent, field: SortField): number | string {
    switch (field) {
      case 'name':
        return comp.name;
      case 'category':
        return comp.category;
      case 'unitPrice':
        return comp.unitPrice ?? 0;
      default: {
        // Try to find a parameter with this name
        const param = comp.parameters.find((p) => p.name === field);
        if (param) {
          return typeof param.value === 'number' ? param.value : param.value;
        }
        return '';
      }
    }
  }

  /** Compute facets from a set of matched components for all parameters present. */
  private computeFacets(components: IndexedComponent[], _filters: ParametricFilter[]): FacetResult[] {
    const paramNames = new Set<string>();
    for (const comp of components) {
      for (const param of comp.parameters) {
        paramNames.add(param.name);
      }
    }

    const facets: FacetResult[] = [];
    paramNames.forEach((name) => {
      facets.push(this.computeSingleFacet(components, name));
    });

    return facets;
  }

  /** Compute a single facet result for a given parameter name. */
  private computeSingleFacet(components: IndexedComponent[], parameter: string): FacetResult {
    const valueCounts = new Map<string, number>();
    let min: number | undefined;
    let max: number | undefined;
    let unit: ParameterUnit | undefined;

    for (const comp of components) {
      for (const param of comp.parameters) {
        if (param.name.toLowerCase() !== parameter.toLowerCase()) {
          continue;
        }

        if (!unit) {
          unit = param.unit;
        }

        const strValue = String(param.value);
        valueCounts.set(strValue, (valueCounts.get(strValue) ?? 0) + 1);

        if (typeof param.value === 'number') {
          if (min === undefined || param.value < min) {
            min = param.value;
          }
          if (max === undefined || param.value > max) {
            max = param.value;
          }
        }
      }
    }

    const values: FacetValue[] = [];
    valueCounts.forEach((count, value) => {
      values.push({ value, count });
    });

    // Sort values: numeric values by number, strings alphabetically
    values.sort((a, b) => {
      const aNum = parseFloat(a.value);
      const bNum = parseFloat(b.value);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.value.localeCompare(b.value);
    });

    return {
      parameter,
      values,
      min,
      max,
      unit,
    };
  }

  /** Load built-in sample components into the index. */
  private loadSampleComponents(): void {
    const samples = createSampleComponents();
    for (const sample of samples) {
      this.components.set(sample.id, sample);
    }
  }

  /** Persist index state to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const components: IndexedComponent[] = [];
      this.components.forEach((comp) => {
        components.push(comp);
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, components }));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the parametric search engine in React components.
 * Subscribes to the ParametricSearchEngine singleton and triggers re-renders.
 */
export function useParametricSearch(): {
  search: (
    filters: ParametricFilter[],
    options?: {
      page?: number;
      pageSize?: number;
      sort?: SortField;
      direction?: SortDirection;
      combineMode?: 'and' | 'or';
    },
  ) => SearchResult;
  indexComponent: (component: IndexedComponent) => void;
  removeComponent: (id: string) => boolean;
  count: number;
  categories: string[];
  parameterNames: string[];
  suggestions: (partialName: string, limit?: number) => IndexedComponent[];
  parseValue: (input: string) => { value: number; unit: ParameterUnit } | null;
  facets: (parameter: string, existingFilters?: ParametricFilter[]) => FacetResult;
  exportIndex: () => string;
  importIndex: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const engine = ParametricSearchEngine.getInstance();
    const unsubscribe = engine.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const search = useCallback(
    (
      filters: ParametricFilter[],
      options?: {
        page?: number;
        pageSize?: number;
        sort?: SortField;
        direction?: SortDirection;
        combineMode?: 'and' | 'or';
      },
    ) => {
      return ParametricSearchEngine.getInstance().search(filters, options);
    },
    [],
  );

  const indexComponent = useCallback((component: IndexedComponent) => {
    ParametricSearchEngine.getInstance().indexComponent(component);
  }, []);

  const removeComponent = useCallback((id: string) => {
    return ParametricSearchEngine.getInstance().removeComponent(id);
  }, []);

  const suggestions = useCallback((partialName: string, limit?: number) => {
    return ParametricSearchEngine.getInstance().getSuggestions(partialName, limit);
  }, []);

  const parseValue = useCallback((input: string) => {
    return ParametricSearchEngine.getInstance().parseValueWithUnit(input);
  }, []);

  const facets = useCallback((parameter: string, existingFilters?: ParametricFilter[]) => {
    return ParametricSearchEngine.getInstance().getFacets(parameter, existingFilters);
  }, []);

  const exportIndexFn = useCallback(() => {
    return ParametricSearchEngine.getInstance().exportIndex();
  }, []);

  const importIndexFn = useCallback((json: string) => {
    return ParametricSearchEngine.getInstance().importIndex(json);
  }, []);

  const engine = typeof window !== 'undefined' ? ParametricSearchEngine.getInstance() : null;

  return {
    search,
    indexComponent,
    removeComponent,
    count: engine?.getComponentCount() ?? 0,
    categories: engine?.getCategories() ?? [],
    parameterNames: engine?.getParameterNames() ?? [],
    suggestions,
    parseValue,
    facets,
    exportIndex: exportIndexFn,
    importIndex: importIndexFn,
  };
}
