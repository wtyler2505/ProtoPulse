/**
 * Alternate Parts Cross-Reference Engine
 *
 * Client-side engine for finding equivalent or compatible replacement components.
 * Supports parametric matching via cross-reference rules, explicit equivalence
 * databases, package equivalences, and pin compatibility checking.
 *
 * Usage:
 *   const engine = AlternatePartsEngine.getInstance();
 *   engine.addPart({ partNumber: 'LM7805', manufacturer: 'TI', ... });
 *   const result = engine.findAlternates('LM7805');
 *
 * React hook:
 *   const { findAlternates, parts, rules } = useAlternateParts();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EquivalenceLevel = 'exact' | 'functional' | 'pin-compatible' | 'similar' | 'upgrade';
export type PartStatus = 'active' | 'nrnd' | 'eol' | 'obsolete' | 'unknown';
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface PartReference {
  id: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  category: string;
  parameters: Record<string, number | string>;
  package: string;
  pinCount: number;
  pinout?: string[];
  status: PartStatus;
  datasheet?: string;
  unitPrice?: number;
  leadTime?: number;
}

export interface AlternatePart {
  part: PartReference;
  equivalenceLevel: EquivalenceLevel;
  confidence: MatchConfidence;
  score: number;
  matchingParameters: string[];
  differingParameters: Array<{
    name: string;
    original: number | string;
    alternate: number | string;
    withinSpec: boolean;
  }>;
  notes: string[];
  pinMapping?: Record<string, string>;
}

export interface CrossReferenceRule {
  id: string;
  name: string;
  category: string;
  requiredParameters: string[];
  flexibleParameters: Array<{
    name: string;
    tolerance: number;
    direction: 'any' | 'up' | 'down';
  }>;
  packageEquivalences: Record<string, string[]>;
  pinoutMustMatch: boolean;
}

export interface CrossReferenceResult {
  originalPart: PartReference;
  alternates: AlternatePart[];
  searchTime: number;
  rulesApplied: string[];
  warnings: string[];
}

export interface EquivalenceEntry {
  partNumber1: string;
  manufacturer1: string;
  partNumber2: string;
  manufacturer2: string;
  level: EquivalenceLevel;
  bidirectional: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Input types (omit generated fields)
// ---------------------------------------------------------------------------

type PartInput = Omit<PartReference, 'id'>;
type RuleInput = Omit<CrossReferenceRule, 'id'>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-alternate-parts';

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

const EQUIVALENCE_LEVEL_SCORE: Record<EquivalenceLevel, number> = {
  exact: 100,
  functional: 85,
  'pin-compatible': 70,
  similar: 50,
  upgrade: 60,
};

// ---------------------------------------------------------------------------
// Built-in data
// ---------------------------------------------------------------------------

function createBuiltInRules(): RuleInput[] {
  return [
    {
      name: 'Resistor Cross-Reference',
      category: 'resistor',
      requiredParameters: ['resistance', 'tolerance'],
      flexibleParameters: [
        { name: 'power', tolerance: 50, direction: 'up' },
        { name: 'voltage', tolerance: 25, direction: 'up' },
      ],
      packageEquivalences: {
        '0402': ['0402', 'R0402'],
        '0603': ['0603', 'R0603'],
        '0805': ['0805', 'R0805'],
        '1206': ['1206', 'R1206'],
      },
      pinoutMustMatch: false,
    },
    {
      name: 'Capacitor Cross-Reference',
      category: 'capacitor',
      requiredParameters: ['capacitance'],
      flexibleParameters: [
        { name: 'voltage', tolerance: 25, direction: 'up' },
        { name: 'tolerance', tolerance: 50, direction: 'any' },
        { name: 'esr', tolerance: 30, direction: 'down' },
      ],
      packageEquivalences: {
        '0402': ['0402', 'C0402'],
        '0603': ['0603', 'C0603'],
        '0805': ['0805', 'C0805'],
        '1206': ['1206', 'C1206'],
      },
      pinoutMustMatch: false,
    },
    {
      name: 'LED Cross-Reference',
      category: 'led',
      requiredParameters: ['color'],
      flexibleParameters: [
        { name: 'forwardVoltage', tolerance: 20, direction: 'any' },
        { name: 'forwardCurrent', tolerance: 30, direction: 'up' },
        { name: 'luminosity', tolerance: 40, direction: 'up' },
      ],
      packageEquivalences: {
        '0603': ['0603', 'LED0603'],
        '0805': ['0805', 'LED0805'],
        '1206': ['1206', 'LED1206'],
        '3mm': ['3mm', 'T-1'],
        '5mm': ['5mm', 'T-1 3/4'],
      },
      pinoutMustMatch: true,
    },
    {
      name: 'Voltage Regulator Cross-Reference',
      category: 'voltage-regulator',
      requiredParameters: ['outputVoltage'],
      flexibleParameters: [
        { name: 'inputVoltageMax', tolerance: 20, direction: 'up' },
        { name: 'outputCurrent', tolerance: 25, direction: 'up' },
        { name: 'dropoutVoltage', tolerance: 30, direction: 'down' },
        { name: 'quiescentCurrent', tolerance: 50, direction: 'down' },
      ],
      packageEquivalences: {
        'TO-220': ['TO-220', 'TO-220-3'],
        'SOT-223': ['SOT-223', 'SOT-223-4'],
        'SOT-89': ['SOT-89', 'SOT-89-3'],
      },
      pinoutMustMatch: true,
    },
    {
      name: 'Op-Amp Cross-Reference',
      category: 'op-amp',
      requiredParameters: ['channels'],
      flexibleParameters: [
        { name: 'gbw', tolerance: 30, direction: 'up' },
        { name: 'slewRate', tolerance: 30, direction: 'up' },
        { name: 'inputOffsetVoltage', tolerance: 50, direction: 'down' },
        { name: 'supplyVoltageMin', tolerance: 20, direction: 'down' },
        { name: 'supplyVoltageMax', tolerance: 20, direction: 'up' },
      ],
      packageEquivalences: {
        'SOIC-8': ['SOIC-8', 'SOP-8'],
        'DIP-8': ['DIP-8', 'PDIP-8'],
        'TSSOP-8': ['TSSOP-8', 'MSOP-8'],
        'SOIC-14': ['SOIC-14', 'SOP-14'],
        'DIP-14': ['DIP-14', 'PDIP-14'],
      },
      pinoutMustMatch: true,
    },
  ];
}

function createBuiltInParts(): PartInput[] {
  return [
    // Voltage regulators
    { partNumber: 'LM7805', manufacturer: 'Texas Instruments', description: '5V 1.5A Linear Voltage Regulator', category: 'voltage-regulator', parameters: { outputVoltage: 5, inputVoltageMax: 35, outputCurrent: 1.5, dropoutVoltage: 2 }, package: 'TO-220', pinCount: 3, pinout: ['IN', 'GND', 'OUT'], status: 'active', unitPrice: 0.45 },
    { partNumber: 'L7805CV', manufacturer: 'STMicroelectronics', description: '5V 1.5A Positive Voltage Regulator', category: 'voltage-regulator', parameters: { outputVoltage: 5, inputVoltageMax: 35, outputCurrent: 1.5, dropoutVoltage: 2 }, package: 'TO-220', pinCount: 3, pinout: ['IN', 'GND', 'OUT'], status: 'active', unitPrice: 0.42 },
    { partNumber: 'KA7805', manufacturer: 'ON Semiconductor', description: '5V 1A Fixed Voltage Regulator', category: 'voltage-regulator', parameters: { outputVoltage: 5, inputVoltageMax: 35, outputCurrent: 1, dropoutVoltage: 2 }, package: 'TO-220', pinCount: 3, pinout: ['IN', 'GND', 'OUT'], status: 'active', unitPrice: 0.38 },
    { partNumber: 'LM1117-3.3', manufacturer: 'Texas Instruments', description: '3.3V 800mA LDO Regulator', category: 'voltage-regulator', parameters: { outputVoltage: 3.3, inputVoltageMax: 15, outputCurrent: 0.8, dropoutVoltage: 1.2 }, package: 'SOT-223', pinCount: 3, pinout: ['GND', 'OUT', 'IN'], status: 'active', unitPrice: 0.55 },
    { partNumber: 'AMS1117-3.3', manufacturer: 'Advanced Monolithic Systems', description: '3.3V 1A LDO Regulator', category: 'voltage-regulator', parameters: { outputVoltage: 3.3, inputVoltageMax: 15, outputCurrent: 1, dropoutVoltage: 1.1 }, package: 'SOT-223', pinCount: 3, pinout: ['GND', 'OUT', 'IN'], status: 'active', unitPrice: 0.25 },

    // 555 Timers
    { partNumber: 'NE555', manufacturer: 'Texas Instruments', description: 'Precision Timer', category: 'timer', parameters: { supplyVoltageMin: 4.5, supplyVoltageMax: 16, maxFrequency: 500000 }, package: 'DIP-8', pinCount: 8, pinout: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THRES', 'DISCH', 'VCC'], status: 'active', unitPrice: 0.35 },
    { partNumber: 'LM555', manufacturer: 'Texas Instruments', description: 'Timer', category: 'timer', parameters: { supplyVoltageMin: 4.5, supplyVoltageMax: 16, maxFrequency: 500000 }, package: 'DIP-8', pinCount: 8, pinout: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THRES', 'DISCH', 'VCC'], status: 'active', unitPrice: 0.40 },
    { partNumber: 'TLC555', manufacturer: 'Texas Instruments', description: 'CMOS Timer', category: 'timer', parameters: { supplyVoltageMin: 2, supplyVoltageMax: 15, maxFrequency: 2000000 }, package: 'DIP-8', pinCount: 8, pinout: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THRES', 'DISCH', 'VCC'], status: 'active', unitPrice: 0.50 },

    // Op-amps
    { partNumber: 'LM358', manufacturer: 'Texas Instruments', description: 'Dual Op-Amp', category: 'op-amp', parameters: { channels: 2, gbw: 1000000, slewRate: 0.3, inputOffsetVoltage: 7, supplyVoltageMin: 3, supplyVoltageMax: 32 }, package: 'DIP-8', pinCount: 8, pinout: ['OUT1', 'IN1-', 'IN1+', 'VEE', 'IN2+', 'IN2-', 'OUT2', 'VCC'], status: 'active', unitPrice: 0.30 },
    { partNumber: 'LM2904', manufacturer: 'Texas Instruments', description: 'Dual Op-Amp', category: 'op-amp', parameters: { channels: 2, gbw: 1000000, slewRate: 0.3, inputOffsetVoltage: 7, supplyVoltageMin: 3, supplyVoltageMax: 32 }, package: 'DIP-8', pinCount: 8, pinout: ['OUT1', 'IN1-', 'IN1+', 'VEE', 'IN2+', 'IN2-', 'OUT2', 'VCC'], status: 'active', unitPrice: 0.28 },
    { partNumber: 'MCP6002', manufacturer: 'Microchip', description: 'Dual 1MHz Rail-to-Rail Op-Amp', category: 'op-amp', parameters: { channels: 2, gbw: 1000000, slewRate: 0.6, inputOffsetVoltage: 4.5, supplyVoltageMin: 1.8, supplyVoltageMax: 6 }, package: 'DIP-8', pinCount: 8, pinout: ['OUT1', 'IN1-', 'IN1+', 'VSS', 'IN2+', 'IN2-', 'OUT2', 'VDD'], status: 'active', unitPrice: 0.45 },
    { partNumber: 'TL072', manufacturer: 'Texas Instruments', description: 'Dual JFET Op-Amp', category: 'op-amp', parameters: { channels: 2, gbw: 3000000, slewRate: 13, inputOffsetVoltage: 10, supplyVoltageMin: 6, supplyVoltageMax: 36 }, package: 'DIP-8', pinCount: 8, pinout: ['OUT1', 'IN1-', 'IN1+', 'VEE', 'IN2+', 'IN2-', 'OUT2', 'VCC'], status: 'active', unitPrice: 0.50 },

    // Resistors
    { partNumber: 'RC0805JR-071KL', manufacturer: 'Yageo', description: '1K Ohm 5% 0805 Resistor', category: 'resistor', parameters: { resistance: 1000, tolerance: 5, power: 0.125, voltage: 150 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.01 },
    { partNumber: 'CRCW08051K00FKEA', manufacturer: 'Vishay', description: '1K Ohm 1% 0805 Resistor', category: 'resistor', parameters: { resistance: 1000, tolerance: 1, power: 0.125, voltage: 150 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.02 },
    { partNumber: 'ERJ-6ENF1001V', manufacturer: 'Panasonic', description: '1K Ohm 1% 0805 Resistor', category: 'resistor', parameters: { resistance: 1000, tolerance: 1, power: 0.125, voltage: 150 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.02 },
    { partNumber: 'RC0805FR-0710KL', manufacturer: 'Yageo', description: '10K Ohm 1% 0805 Resistor', category: 'resistor', parameters: { resistance: 10000, tolerance: 1, power: 0.125, voltage: 150 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.01 },
    { partNumber: 'CRCW080510K0FKEA', manufacturer: 'Vishay', description: '10K Ohm 1% 0805 Resistor', category: 'resistor', parameters: { resistance: 10000, tolerance: 1, power: 0.125, voltage: 150 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.02 },
    { partNumber: 'RC0603JR-07100RL', manufacturer: 'Yageo', description: '100 Ohm 5% 0603 Resistor', category: 'resistor', parameters: { resistance: 100, tolerance: 5, power: 0.1, voltage: 75 }, package: '0603', pinCount: 2, status: 'active', unitPrice: 0.008 },

    // Capacitors
    { partNumber: 'CL21B104KBCNNNC', manufacturer: 'Samsung', description: '100nF 50V 0805 MLCC', category: 'capacitor', parameters: { capacitance: 100e-9, voltage: 50, tolerance: 10 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.01 },
    { partNumber: 'C0805C104K5RACTU', manufacturer: 'KEMET', description: '100nF 50V 0805 MLCC', category: 'capacitor', parameters: { capacitance: 100e-9, voltage: 50, tolerance: 10 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.015 },
    { partNumber: 'GRM21BR71H104KA01L', manufacturer: 'Murata', description: '100nF 50V 0805 MLCC', category: 'capacitor', parameters: { capacitance: 100e-9, voltage: 50, tolerance: 10 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.012 },
    { partNumber: 'CL21A106KAYNNNE', manufacturer: 'Samsung', description: '10uF 25V 0805 MLCC', category: 'capacitor', parameters: { capacitance: 10e-6, voltage: 25, tolerance: 10 }, package: '0805', pinCount: 2, status: 'active', unitPrice: 0.05 },
    { partNumber: 'ECA-1HM100', manufacturer: 'Panasonic', description: '10uF 50V Electrolytic', category: 'capacitor', parameters: { capacitance: 10e-6, voltage: 50, tolerance: 20, esr: 5 }, package: 'Radial', pinCount: 2, pinout: ['+', '-'], status: 'active', unitPrice: 0.08 },

    // LEDs
    { partNumber: 'LTST-C171KRKT', manufacturer: 'Lite-On', description: 'Red LED 0805', category: 'led', parameters: { color: 'red', forwardVoltage: 2.0, forwardCurrent: 20, luminosity: 45 }, package: '0805', pinCount: 2, pinout: ['A', 'K'], status: 'active', unitPrice: 0.05 },
    { partNumber: 'SML-LX0805SRC', manufacturer: 'Lumex', description: 'Red LED 0805', category: 'led', parameters: { color: 'red', forwardVoltage: 1.9, forwardCurrent: 20, luminosity: 40 }, package: '0805', pinCount: 2, pinout: ['A', 'K'], status: 'active', unitPrice: 0.06 },
    { partNumber: 'LTST-C171KGKT', manufacturer: 'Lite-On', description: 'Green LED 0805', category: 'led', parameters: { color: 'green', forwardVoltage: 2.2, forwardCurrent: 20, luminosity: 35 }, package: '0805', pinCount: 2, pinout: ['A', 'K'], status: 'active', unitPrice: 0.05 },

    // MOSFETs
    { partNumber: 'IRLZ44N', manufacturer: 'Infineon', description: 'N-Channel MOSFET 55V 47A', category: 'mosfet', parameters: { type: 'N-Channel', vds: 55, id: 47, rdsOn: 0.022 }, package: 'TO-220', pinCount: 3, pinout: ['G', 'D', 'S'], status: 'active', unitPrice: 1.20 },
    { partNumber: 'IRF540N', manufacturer: 'Infineon', description: 'N-Channel MOSFET 100V 33A', category: 'mosfet', parameters: { type: 'N-Channel', vds: 100, id: 33, rdsOn: 0.044 }, package: 'TO-220', pinCount: 3, pinout: ['G', 'D', 'S'], status: 'active', unitPrice: 0.95 },

    // Obsolete parts for testing filtering
    { partNumber: 'LM340T-5', manufacturer: 'National Semiconductor', description: '5V 1A Regulator (Obsolete)', category: 'voltage-regulator', parameters: { outputVoltage: 5, inputVoltageMax: 35, outputCurrent: 1, dropoutVoltage: 2 }, package: 'TO-220', pinCount: 3, pinout: ['IN', 'GND', 'OUT'], status: 'obsolete', unitPrice: 0.60 },
    { partNumber: 'MC7805', manufacturer: 'ON Semiconductor', description: '5V 1A Regulator (NRND)', category: 'voltage-regulator', parameters: { outputVoltage: 5, inputVoltageMax: 35, outputCurrent: 1, dropoutVoltage: 2 }, package: 'TO-220', pinCount: 3, pinout: ['IN', 'GND', 'OUT'], status: 'nrnd', unitPrice: 0.50 },
  ];
}

function createBuiltInEquivalences(): EquivalenceEntry[] {
  return [
    { partNumber1: 'LM7805', manufacturer1: 'Texas Instruments', partNumber2: 'L7805CV', manufacturer2: 'STMicroelectronics', level: 'exact', bidirectional: true, notes: '5V 1.5A regulator, same pinout' },
    { partNumber1: 'LM7805', manufacturer1: 'Texas Instruments', partNumber2: 'KA7805', manufacturer2: 'ON Semiconductor', level: 'functional', bidirectional: true, notes: 'KA7805 rated 1A vs 1.5A' },
    { partNumber1: 'NE555', manufacturer1: 'Texas Instruments', partNumber2: 'LM555', manufacturer2: 'Texas Instruments', level: 'exact', bidirectional: true, notes: 'Identical bipolar 555 timer' },
    { partNumber1: 'NE555', manufacturer1: 'Texas Instruments', partNumber2: 'TLC555', manufacturer2: 'Texas Instruments', level: 'functional', bidirectional: true, notes: 'CMOS version, lower power, higher frequency' },
    { partNumber1: 'LM555', manufacturer1: 'Texas Instruments', partNumber2: 'TLC555', manufacturer2: 'Texas Instruments', level: 'functional', bidirectional: true, notes: 'CMOS version of LM555' },
    { partNumber1: 'LM358', manufacturer1: 'Texas Instruments', partNumber2: 'LM2904', manufacturer2: 'Texas Instruments', level: 'exact', bidirectional: true, notes: 'Industrial temperature range variant' },
    { partNumber1: 'LM1117-3.3', manufacturer1: 'Texas Instruments', partNumber2: 'AMS1117-3.3', manufacturer2: 'Advanced Monolithic Systems', level: 'functional', bidirectional: true, notes: 'AMS1117 has slightly lower dropout' },
    { partNumber1: 'RC0805JR-071KL', manufacturer1: 'Yageo', partNumber2: 'CRCW08051K00FKEA', manufacturer2: 'Vishay', level: 'functional', bidirectional: true, notes: 'Vishay is 1% vs 5% tolerance' },
    { partNumber1: 'CRCW08051K00FKEA', manufacturer1: 'Vishay', partNumber2: 'ERJ-6ENF1001V', manufacturer2: 'Panasonic', level: 'exact', bidirectional: true, notes: 'Same specs: 1K 1% 0805' },
    { partNumber1: 'RC0805FR-0710KL', manufacturer1: 'Yageo', partNumber2: 'CRCW080510K0FKEA', manufacturer2: 'Vishay', level: 'exact', bidirectional: true, notes: '10K 1% 0805 equivalents' },
    { partNumber1: 'CL21B104KBCNNNC', manufacturer1: 'Samsung', partNumber2: 'C0805C104K5RACTU', manufacturer2: 'KEMET', level: 'exact', bidirectional: true, notes: '100nF 50V 0805 MLCC' },
    { partNumber1: 'CL21B104KBCNNNC', manufacturer1: 'Samsung', partNumber2: 'GRM21BR71H104KA01L', manufacturer2: 'Murata', level: 'exact', bidirectional: true, notes: '100nF 50V 0805 MLCC' },
    { partNumber1: 'C0805C104K5RACTU', manufacturer1: 'KEMET', partNumber2: 'GRM21BR71H104KA01L', manufacturer2: 'Murata', level: 'exact', bidirectional: true, notes: '100nF 50V 0805 MLCC' },
    { partNumber1: 'LTST-C171KRKT', manufacturer1: 'Lite-On', partNumber2: 'SML-LX0805SRC', manufacturer2: 'Lumex', level: 'functional', bidirectional: true, notes: 'Red 0805 LED, slight Vf difference' },
    { partNumber1: 'LM340T-5', manufacturer1: 'National Semiconductor', partNumber2: 'LM7805', manufacturer2: 'Texas Instruments', level: 'functional', bidirectional: false, notes: 'LM340T-5 is obsolete predecessor of LM7805' },
  ];
}

// ---------------------------------------------------------------------------
// AlternatePartsEngine
// ---------------------------------------------------------------------------

export class AlternatePartsEngine {
  private static instance: AlternatePartsEngine | null = null;

  private parts = new Map<string, PartReference>();
  private rules = new Map<string, CrossReferenceRule>();
  private equivalences: EquivalenceEntry[] = [];
  private searchHistory: CrossReferenceResult[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
    if (this.parts.size === 0) {
      this.seedBuiltInData();
    }
  }

  static getInstance(): AlternatePartsEngine {
    if (!AlternatePartsEngine.instance) {
      AlternatePartsEngine.instance = new AlternatePartsEngine();
    }
    return AlternatePartsEngine.instance;
  }

  static resetForTesting(): void {
    AlternatePartsEngine.instance = null;
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
  // Part database
  // -------------------------------------------------------------------------

  addPart(input: PartInput): PartReference {
    const part: PartReference = {
      ...input,
      id: crypto.randomUUID(),
    };
    this.parts.set(part.id, part);
    this.save();
    this.notify();
    return part;
  }

  removePart(id: string): boolean {
    const existed = this.parts.delete(id);
    if (existed) {
      this.save();
      this.notify();
    }
    return existed;
  }

  getPart(id: string): PartReference | null {
    return this.parts.get(id) ?? null;
  }

  getPartByNumber(partNumber: string, manufacturer?: string): PartReference | null {
    const pnLower = partNumber.toLowerCase();
    let result: PartReference | null = null;
    this.parts.forEach((part) => {
      if (result) {
        return;
      }
      if (part.partNumber.toLowerCase() === pnLower) {
        if (!manufacturer || part.manufacturer.toLowerCase() === manufacturer.toLowerCase()) {
          result = part;
        }
      }
    });
    return result;
  }

  getAllParts(): PartReference[] {
    const result: PartReference[] = [];
    this.parts.forEach((p) => {
      result.push(p);
    });
    return result;
  }

  getPartCount(): number {
    return this.parts.size;
  }

  // -------------------------------------------------------------------------
  // Cross-reference rules
  // -------------------------------------------------------------------------

  addRule(input: RuleInput): CrossReferenceRule {
    const rule: CrossReferenceRule = {
      ...input,
      id: crypto.randomUUID(),
    };
    this.rules.set(rule.id, rule);
    this.save();
    this.notify();
    return rule;
  }

  removeRule(id: string): boolean {
    const existed = this.rules.delete(id);
    if (existed) {
      this.save();
      this.notify();
    }
    return existed;
  }

  getRule(id: string): CrossReferenceRule | null {
    return this.rules.get(id) ?? null;
  }

  getRules(): CrossReferenceRule[] {
    const result: CrossReferenceRule[] = [];
    this.rules.forEach((r) => {
      result.push(r);
    });
    return result;
  }

  getRulesByCategory(category: string): CrossReferenceRule[] {
    const catLower = category.toLowerCase();
    const result: CrossReferenceRule[] = [];
    this.rules.forEach((r) => {
      if (r.category.toLowerCase() === catLower) {
        result.push(r);
      }
    });
    return result;
  }

  // -------------------------------------------------------------------------
  // Equivalence database
  // -------------------------------------------------------------------------

  addEquivalence(entry: EquivalenceEntry): void {
    this.equivalences.push(entry);
    this.save();
    this.notify();
  }

  getEquivalences(partNumber: string): EquivalenceEntry[] {
    const pnLower = partNumber.toLowerCase();
    return this.equivalences.filter((e) => {
      if (e.partNumber1.toLowerCase() === pnLower) {
        return true;
      }
      if (e.bidirectional && e.partNumber2.toLowerCase() === pnLower) {
        return true;
      }
      return false;
    });
  }

  removeEquivalence(partNumber1: string, partNumber2: string): boolean {
    const pn1Lower = partNumber1.toLowerCase();
    const pn2Lower = partNumber2.toLowerCase();
    const initialLength = this.equivalences.length;
    this.equivalences = this.equivalences.filter((e) => {
      const match1 = e.partNumber1.toLowerCase() === pn1Lower && e.partNumber2.toLowerCase() === pn2Lower;
      const match2 = e.partNumber1.toLowerCase() === pn2Lower && e.partNumber2.toLowerCase() === pn1Lower;
      return !match1 && !match2;
    });
    const removed = this.equivalences.length < initialLength;
    if (removed) {
      this.save();
      this.notify();
    }
    return removed;
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  findAlternates(
    partNumber: string,
    options?: {
      maxResults?: number;
      minConfidence?: MatchConfidence;
      includeObsolete?: boolean;
    },
  ): CrossReferenceResult {
    const startTime = performance.now();
    const maxResults = options?.maxResults ?? 20;
    const minConfidence = options?.minConfidence ?? 'low';
    const includeObsolete = options?.includeObsolete ?? false;

    const originalPart = this.getPartByNumber(partNumber);
    if (!originalPart) {
      const result: CrossReferenceResult = {
        originalPart: {
          id: '',
          partNumber,
          manufacturer: '',
          description: '',
          category: '',
          parameters: {},
          package: '',
          pinCount: 0,
          status: 'unknown',
        },
        alternates: [],
        searchTime: performance.now() - startTime,
        rulesApplied: [],
        warnings: [`Part "${partNumber}" not found in database`],
      };
      this.searchHistory.push(result);
      this.notify();
      return result;
    }

    const alternateMap = new Map<string, AlternatePart>();
    const rulesApplied: string[] = [];
    const warnings: string[] = [];

    // 1. Check explicit equivalence database
    const equivalences = this.getEquivalences(partNumber);
    equivalences.forEach((eq) => {
      const altPartNumber = eq.partNumber1.toLowerCase() === partNumber.toLowerCase() ? eq.partNumber2 : eq.partNumber1;
      const altManufacturer = eq.partNumber1.toLowerCase() === partNumber.toLowerCase() ? eq.manufacturer2 : eq.manufacturer1;
      const altPart = this.getPartByNumber(altPartNumber, altManufacturer);
      if (altPart && altPart.id !== originalPart.id) {
        if (!includeObsolete && altPart.status === 'obsolete') {
          return;
        }
        const matchingParams: string[] = [];
        const differingParams: Array<{ name: string; original: number | string; alternate: number | string; withinSpec: boolean }> = [];

        const allParamKeys = new Set<string>();
        Object.keys(originalPart.parameters).forEach((k) => allParamKeys.add(k));
        Object.keys(altPart.parameters).forEach((k) => allParamKeys.add(k));

        allParamKeys.forEach((key) => {
          const origVal = originalPart.parameters[key];
          const altVal = altPart.parameters[key];
          if (origVal !== undefined && altVal !== undefined) {
            if (origVal === altVal) {
              matchingParams.push(key);
            } else {
              differingParams.push({ name: key, original: origVal, alternate: altVal, withinSpec: true });
            }
          }
        });

        const pinMapping = this.buildPinMapping(originalPart, altPart);
        const notes: string[] = [];
        if (eq.notes) {
          notes.push(eq.notes);
        }

        alternateMap.set(altPart.id, {
          part: altPart,
          equivalenceLevel: eq.level,
          confidence: eq.level === 'exact' ? 'high' : 'medium',
          score: EQUIVALENCE_LEVEL_SCORE[eq.level],
          matchingParameters: matchingParams,
          differingParameters: differingParams,
          notes,
          pinMapping: pinMapping ?? undefined,
        });
      }
    });

    // 2. Apply cross-reference rules for parametric matching
    const applicableRules = this.getRulesByCategory(originalPart.category);
    applicableRules.forEach((rule) => {
      rulesApplied.push(rule.name);

      this.parts.forEach((candidate) => {
        if (candidate.id === originalPart.id) {
          return;
        }
        if (alternateMap.has(candidate.id)) {
          return;
        }
        if (candidate.category !== originalPart.category) {
          return;
        }
        if (!includeObsolete && candidate.status === 'obsolete') {
          return;
        }

        const matchResult = this.matchPartAgainstRule(originalPart, candidate, rule);
        if (matchResult) {
          alternateMap.set(candidate.id, matchResult);
        }
      });
    });

    // Filter by confidence
    const confidenceOrder: MatchConfidence[] = ['high', 'medium', 'low'];
    const minConfidenceIndex = confidenceOrder.indexOf(minConfidence);

    let alternates: AlternatePart[] = [];
    alternateMap.forEach((alt) => {
      const altConfidenceIndex = confidenceOrder.indexOf(alt.confidence);
      if (altConfidenceIndex <= minConfidenceIndex) {
        alternates.push(alt);
      }
    });

    // Sort by score descending
    alternates.sort((a, b) => b.score - a.score);

    // Limit results
    if (alternates.length > maxResults) {
      alternates = alternates.slice(0, maxResults);
    }

    const result: CrossReferenceResult = {
      originalPart,
      alternates,
      searchTime: performance.now() - startTime,
      rulesApplied,
      warnings,
    };

    this.searchHistory.push(result);
    this.notify();
    return result;
  }

  // -------------------------------------------------------------------------
  // Batch search
  // -------------------------------------------------------------------------

  findAlternatesForBom(
    parts: Array<{ partNumber: string; manufacturer?: string }>,
  ): CrossReferenceResult[] {
    return parts.map((p) => this.findAlternates(p.partNumber));
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  getSearchHistory(): CrossReferenceResult[] {
    return [...this.searchHistory];
  }

  clearHistory(): void {
    this.searchHistory = [];
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Export / Import
  // -------------------------------------------------------------------------

  exportDatabase(): string {
    const partsArr: PartReference[] = [];
    this.parts.forEach((p) => partsArr.push(p));

    const rulesArr: CrossReferenceRule[] = [];
    this.rules.forEach((r) => rulesArr.push(r));

    return JSON.stringify({
      parts: partsArr,
      rules: rulesArr,
      equivalences: this.equivalences,
    }, null, 2);
  }

  importDatabase(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON'] };
    }

    if (typeof data !== 'object' || data === null) {
      return { imported: 0, errors: ['Data must be an object'] };
    }

    const obj = data as Record<string, unknown>;

    // Import parts
    if (Array.isArray(obj.parts)) {
      (obj.parts as unknown[]).forEach((p: unknown, i: number) => {
        if (typeof p === 'object' && p !== null) {
          const part = p as Record<string, unknown>;
          if (typeof part.partNumber === 'string' && typeof part.manufacturer === 'string' && typeof part.category === 'string') {
            const ref: PartReference = {
              id: typeof part.id === 'string' ? part.id : crypto.randomUUID(),
              partNumber: part.partNumber,
              manufacturer: part.manufacturer,
              description: typeof part.description === 'string' ? part.description : '',
              category: part.category,
              parameters: typeof part.parameters === 'object' && part.parameters !== null ? (part.parameters as Record<string, number | string>) : {},
              package: typeof part.package === 'string' ? part.package : '',
              pinCount: typeof part.pinCount === 'number' ? part.pinCount : 0,
              pinout: Array.isArray(part.pinout) ? (part.pinout as string[]) : undefined,
              status: isPartStatus(part.status) ? part.status : 'unknown',
              datasheet: typeof part.datasheet === 'string' ? part.datasheet : undefined,
              unitPrice: typeof part.unitPrice === 'number' ? part.unitPrice : undefined,
              leadTime: typeof part.leadTime === 'number' ? part.leadTime : undefined,
            };
            this.parts.set(ref.id, ref);
            imported++;
          } else {
            errors.push(`Part at index ${i}: missing required fields`);
          }
        }
      });
    }

    // Import rules
    if (Array.isArray(obj.rules)) {
      (obj.rules as unknown[]).forEach((r: unknown, i: number) => {
        if (typeof r === 'object' && r !== null) {
          const rule = r as Record<string, unknown>;
          if (typeof rule.name === 'string' && typeof rule.category === 'string') {
            const ref: CrossReferenceRule = {
              id: typeof rule.id === 'string' ? rule.id : crypto.randomUUID(),
              name: rule.name,
              category: rule.category,
              requiredParameters: Array.isArray(rule.requiredParameters) ? (rule.requiredParameters as string[]) : [],
              flexibleParameters: Array.isArray(rule.flexibleParameters) ? (rule.flexibleParameters as CrossReferenceRule['flexibleParameters']) : [],
              packageEquivalences: typeof rule.packageEquivalences === 'object' && rule.packageEquivalences !== null ? (rule.packageEquivalences as Record<string, string[]>) : {},
              pinoutMustMatch: typeof rule.pinoutMustMatch === 'boolean' ? rule.pinoutMustMatch : false,
            };
            this.rules.set(ref.id, ref);
            imported++;
          } else {
            errors.push(`Rule at index ${i}: missing required fields`);
          }
        }
      });
    }

    // Import equivalences
    if (Array.isArray(obj.equivalences)) {
      (obj.equivalences as unknown[]).forEach((e: unknown, i: number) => {
        if (typeof e === 'object' && e !== null) {
          const eq = e as Record<string, unknown>;
          if (
            typeof eq.partNumber1 === 'string' &&
            typeof eq.partNumber2 === 'string' &&
            typeof eq.manufacturer1 === 'string' &&
            typeof eq.manufacturer2 === 'string'
          ) {
            this.equivalences.push({
              partNumber1: eq.partNumber1,
              manufacturer1: eq.manufacturer1,
              partNumber2: eq.partNumber2,
              manufacturer2: eq.manufacturer2,
              level: isEquivalenceLevel(eq.level) ? eq.level : 'similar',
              bidirectional: typeof eq.bidirectional === 'boolean' ? eq.bidirectional : true,
              notes: typeof eq.notes === 'string' ? eq.notes : undefined,
            });
            imported++;
          } else {
            errors.push(`Equivalence at index ${i}: missing required fields`);
          }
        }
      });
    }

    this.save();
    this.notify();
    return { imported, errors };
  }

  // -------------------------------------------------------------------------
  // Clear
  // -------------------------------------------------------------------------

  clear(): void {
    this.parts.clear();
    this.rules.clear();
    this.equivalences = [];
    this.searchHistory = [];
    this.save();
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private matchPartAgainstRule(
    original: PartReference,
    candidate: PartReference,
    rule: CrossReferenceRule,
  ): AlternatePart | null {
    const matchingParameters: string[] = [];
    const differingParameters: AlternatePart['differingParameters'] = [];
    const notes: string[] = [];

    // Check required parameters (must match exactly)
    for (const paramName of rule.requiredParameters) {
      const origVal = original.parameters[paramName];
      const candVal = candidate.parameters[paramName];

      if (origVal === undefined || candVal === undefined) {
        return null;
      }

      if (origVal === candVal) {
        matchingParameters.push(paramName);
      } else {
        // Required parameters must match exactly
        return null;
      }
    }

    // Check flexible parameters
    for (const flex of rule.flexibleParameters) {
      const origVal = original.parameters[flex.name];
      const candVal = candidate.parameters[flex.name];

      if (origVal === undefined || candVal === undefined) {
        continue;
      }

      if (typeof origVal === 'number' && typeof candVal === 'number') {
        if (origVal === candVal) {
          matchingParameters.push(flex.name);
        } else {
          const withinSpec = this.isWithinTolerance(origVal, candVal, flex.tolerance, flex.direction);
          differingParameters.push({
            name: flex.name,
            original: origVal,
            alternate: candVal,
            withinSpec,
          });
          if (!withinSpec) {
            notes.push(`${flex.name}: ${candVal} outside tolerance of ${origVal} (${flex.tolerance}%)`);
          }
        }
      } else if (origVal === candVal) {
        matchingParameters.push(flex.name);
      } else {
        differingParameters.push({
          name: flex.name,
          original: origVal,
          alternate: candVal,
          withinSpec: false,
        });
      }
    }

    // Check package compatibility
    let packageMatch = original.package === candidate.package;
    if (!packageMatch) {
      const equivPackages = rule.packageEquivalences[original.package];
      if (equivPackages && equivPackages.includes(candidate.package)) {
        packageMatch = true;
        notes.push(`Package ${candidate.package} is equivalent to ${original.package}`);
      }
    }

    if (!packageMatch) {
      return null;
    }

    // Check pin compatibility
    if (rule.pinoutMustMatch && original.pinout && candidate.pinout) {
      if (original.pinCount !== candidate.pinCount) {
        return null;
      }
    }

    // Score calculation
    const totalParams = rule.requiredParameters.length + rule.flexibleParameters.length;
    const matchingCount = matchingParameters.length;
    const withinSpecCount = differingParameters.filter((d) => d.withinSpec).length;
    const outsideSpecCount = differingParameters.filter((d) => !d.withinSpec).length;

    if (outsideSpecCount > 0) {
      // Parts with parameters outside spec are "similar" at best
      const score = Math.max(20, 50 - outsideSpecCount * 15);
      return {
        part: candidate,
        equivalenceLevel: 'similar',
        confidence: 'low',
        score,
        matchingParameters,
        differingParameters,
        notes,
        pinMapping: this.buildPinMapping(original, candidate) ?? undefined,
      };
    }

    // Determine equivalence level
    let equivalenceLevel: EquivalenceLevel;
    let confidence: MatchConfidence;
    let score: number;

    if (differingParameters.length === 0 && matchingCount === totalParams) {
      // All parameters match exactly
      if (original.package === candidate.package && this.pinoutsMatch(original, candidate)) {
        equivalenceLevel = 'exact';
        confidence = 'high';
        score = 95;
      } else {
        equivalenceLevel = 'pin-compatible';
        confidence = 'high';
        score = 85;
      }
    } else if (withinSpecCount > 0 && outsideSpecCount === 0) {
      // Some parameters differ but within tolerance
      const ratio = totalParams > 0 ? matchingCount / totalParams : 0;
      if (ratio >= 0.7) {
        equivalenceLevel = 'functional';
        confidence = 'medium';
        score = 70 + Math.round(ratio * 15);
      } else {
        equivalenceLevel = 'similar';
        confidence = 'medium';
        score = 50 + Math.round(ratio * 20);
      }
    } else {
      equivalenceLevel = matchingCount > 0 ? 'functional' : 'similar';
      confidence = matchingCount > 0 ? 'medium' : 'low';
      score = totalParams > 0 ? Math.round((matchingCount / totalParams) * 70) : 30;
    }

    // Boost for pin-compatible parts with matching pinout
    if (this.pinoutsMatch(original, candidate) && equivalenceLevel !== 'exact') {
      if (equivalenceLevel === 'functional' || equivalenceLevel === 'similar') {
        equivalenceLevel = 'pin-compatible';
        score = Math.min(score + 10, 95);
      }
    }

    // Check if candidate is an upgrade
    const allFlexBetter = rule.flexibleParameters.length > 0 && differingParameters.every((d) => {
      if (typeof d.original === 'number' && typeof d.alternate === 'number') {
        const flex = rule.flexibleParameters.find((f) => f.name === d.name);
        if (flex) {
          if (flex.direction === 'up') {
            return d.alternate > d.original;
          }
          if (flex.direction === 'down') {
            return d.alternate < d.original;
          }
        }
      }
      return false;
    });

    if (allFlexBetter && differingParameters.length > 0) {
      equivalenceLevel = 'upgrade';
      notes.push('All differing parameters are improved over original');
    }

    return {
      part: candidate,
      equivalenceLevel,
      confidence,
      score,
      matchingParameters,
      differingParameters,
      notes,
      pinMapping: this.buildPinMapping(original, candidate) ?? undefined,
    };
  }

  private isWithinTolerance(
    original: number,
    candidate: number,
    tolerancePercent: number,
    direction: 'any' | 'up' | 'down',
  ): boolean {
    if (original === 0) {
      return candidate === 0;
    }

    const percentDiff = ((candidate - original) / Math.abs(original)) * 100;

    switch (direction) {
      case 'up':
        // Candidate must be >= original, and within tolerance above
        return percentDiff >= 0 && percentDiff <= tolerancePercent;
      case 'down':
        // Candidate must be <= original, and within tolerance below
        return percentDiff <= 0 && Math.abs(percentDiff) <= tolerancePercent;
      case 'any':
        return Math.abs(percentDiff) <= tolerancePercent;
    }
  }

  private pinoutsMatch(a: PartReference, b: PartReference): boolean {
    if (!a.pinout || !b.pinout) {
      return a.pinCount === b.pinCount;
    }
    if (a.pinout.length !== b.pinout.length) {
      return false;
    }
    for (let i = 0; i < a.pinout.length; i++) {
      if (a.pinout[i] !== b.pinout[i]) {
        return false;
      }
    }
    return true;
  }

  private buildPinMapping(original: PartReference, alternate: PartReference): Record<string, string> | null {
    if (!original.pinout || !alternate.pinout) {
      return null;
    }
    if (original.pinout.length !== alternate.pinout.length) {
      return null;
    }
    const mapping: Record<string, string> = {};
    for (let i = 0; i < original.pinout.length; i++) {
      mapping[original.pinout[i]] = alternate.pinout[i];
    }
    return mapping;
  }

  /**
   * Live pin compatibility check for schematic replacement (BL-0105).
   * Compares two parts and returns detailed compatibility info.
   */
  checkPinCompatibility(original: PartReference, replacement: PartReference): {
    compatible: boolean;
    level: 'exact' | 'partial' | 'incompatible';
    matches: string[];
    missing: string[];
    extra: string[];
    warnings: string[];
  } {
    const origPins = original.pinout || [];
    const replPins = replacement.pinout || [];
    
    if (origPins.length === 0 || replPins.length === 0) {
      return {
        compatible: original.pinCount === replacement.pinCount,
        level: original.pinCount === replacement.pinCount ? 'partial' : 'incompatible',
        matches: [],
        missing: [],
        extra: [],
        warnings: ['No pinout data available for one or both parts. Matching by pin count only.'],
      };
    }

    const origSet = new Set(origPins.map(p => p.toUpperCase()));
    const replSet = new Set(replPins.map(p => p.toUpperCase()));

    const matches = origPins.filter(p => replSet.has(p.toUpperCase()));
    const missing = origPins.filter(p => !replSet.has(p.toUpperCase()));
    const extra = replPins.filter(p => !origSet.has(p.toUpperCase()));

    let level: 'exact' | 'partial' | 'incompatible' = 'incompatible';
    if (missing.length === 0 && extra.length === 0) {
      level = 'exact';
    } else if (matches.length > 0 && matches.length >= origPins.length * 0.7) {
      level = 'partial';
    }

    return {
      compatible: level !== 'incompatible',
      level,
      matches,
      missing,
      extra,
      warnings: level === 'partial' ? [`${missing.length} original pins missing in replacement.`] : [],
    };
  }

  // -------------------------------------------------------------------------
  // Seeding
  // -------------------------------------------------------------------------

  private seedBuiltInData(): void {
    const partInputs = createBuiltInParts();
    for (const input of partInputs) {
      const part: PartReference = { ...input, id: crypto.randomUUID() };
      this.parts.set(part.id, part);
    }

    const ruleInputs = createBuiltInRules();
    for (const input of ruleInputs) {
      const rule: CrossReferenceRule = { ...input, id: crypto.randomUUID() };
      this.rules.set(rule.id, rule);
    }

    const eqEntries = createBuiltInEquivalences();
    this.equivalences = eqEntries;

    this.save();
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private save(): void {
    try {
      const partsArr: PartReference[] = [];
      this.parts.forEach((p) => partsArr.push(p));

      const rulesArr: CrossReferenceRule[] = [];
      this.rules.forEach((r) => rulesArr.push(r));

      const data = {
        parts: partsArr,
        rules: rulesArr,
        equivalences: this.equivalences,
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

      if (Array.isArray(data.parts)) {
        (data.parts as unknown[]).forEach((p: unknown) => {
          if (typeof p === 'object' && p !== null) {
            const part = p as PartReference;
            if (typeof part.id === 'string' && typeof part.partNumber === 'string') {
              this.parts.set(part.id, part);
            }
          }
        });
      }

      if (Array.isArray(data.rules)) {
        (data.rules as unknown[]).forEach((r: unknown) => {
          if (typeof r === 'object' && r !== null) {
            const rule = r as CrossReferenceRule;
            if (typeof rule.id === 'string' && typeof rule.name === 'string') {
              this.rules.set(rule.id, rule);
            }
          }
        });
      }

      if (Array.isArray(data.equivalences)) {
        this.equivalences = (data.equivalences as unknown[]).filter(
          (e: unknown): e is EquivalenceEntry =>
            typeof e === 'object' &&
            e !== null &&
            typeof (e as EquivalenceEntry).partNumber1 === 'string' &&
            typeof (e as EquivalenceEntry).partNumber2 === 'string',
        );
      }
    } catch {
      // Corrupt data — start fresh
    }
  }
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isPartStatus(v: unknown): v is PartStatus {
  return typeof v === 'string' && ['active', 'nrnd', 'eol', 'obsolete', 'unknown'].includes(v);
}

function isEquivalenceLevel(v: unknown): v is EquivalenceLevel {
  return typeof v === 'string' && ['exact', 'functional', 'pin-compatible', 'similar', 'upgrade'].includes(v);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useAlternateParts(): {
  findAlternates: (
    partNumber: string,
    options?: { maxResults?: number; minConfidence?: MatchConfidence; includeObsolete?: boolean },
  ) => CrossReferenceResult;
  findAlternatesForBom: (
    parts: Array<{ partNumber: string; manufacturer?: string }>,
  ) => CrossReferenceResult[];
  addPart: (input: PartInput) => PartReference;
  addRule: (input: RuleInput) => CrossReferenceRule;
  addEquivalence: (entry: EquivalenceEntry) => void;
  parts: PartReference[];
  rules: CrossReferenceRule[];
  searchHistory: CrossReferenceResult[];
  exportDatabase: () => string;
  importDatabase: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const engine = AlternatePartsEngine.getInstance();
    const unsubscribe = engine.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const findAlternates = useCallback(
    (partNumber: string, options?: { maxResults?: number; minConfidence?: MatchConfidence; includeObsolete?: boolean }) => {
      return AlternatePartsEngine.getInstance().findAlternates(partNumber, options);
    },
    [],
  );

  const findAlternatesForBom = useCallback(
    (parts: Array<{ partNumber: string; manufacturer?: string }>) => {
      return AlternatePartsEngine.getInstance().findAlternatesForBom(parts);
    },
    [],
  );

  const addPart = useCallback((input: PartInput) => {
    return AlternatePartsEngine.getInstance().addPart(input);
  }, []);

  const addRule = useCallback((input: RuleInput) => {
    return AlternatePartsEngine.getInstance().addRule(input);
  }, []);

  const addEquivalence = useCallback((entry: EquivalenceEntry) => {
    AlternatePartsEngine.getInstance().addEquivalence(entry);
  }, []);

  const exportDatabase = useCallback(() => {
    return AlternatePartsEngine.getInstance().exportDatabase();
  }, []);

  const importDatabase = useCallback((json: string) => {
    return AlternatePartsEngine.getInstance().importDatabase(json);
  }, []);

  const engine = AlternatePartsEngine.getInstance();

  return {
    findAlternates,
    findAlternatesForBom,
    addPart,
    addRule,
    addEquivalence,
    parts: engine.getAllParts(),
    rules: engine.getRules(),
    searchHistory: engine.getSearchHistory(),
    exportDatabase,
    importDatabase,
  };
}
