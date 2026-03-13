/**
 * PartFamilyRegistry — singleton+subscribe pattern for part family swapping.
 *
 * Groups components by "family" (e.g. all resistors, all capacitors) and provides
 * lookup of compatible swap candidates within a family. Swapping preserves all
 * wire connections — only the component type/value changes.
 */

import type { ComponentCategory } from '@shared/component-categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentSwapCandidate {
  /** Component title (e.g. "Resistor 10kΩ"). */
  title: string;
  /** The component type identifier used in the standard library / part meta. */
  componentType: string;
  /** Parsed numeric value in base units (ohms, farads, henries). null if non-numeric. */
  numericValue: number | null;
  /** Original human-readable value string (e.g. "10kΩ", "100nF"). */
  displayValue: string;
  /** Pin count of this candidate. */
  pinCount: number;
  /** Package type if known (e.g. "DIP-8", "TO-92"). */
  packageType: string | null;
  /** Manufacturer if known. */
  manufacturer: string | null;
}

export interface SwapResult {
  /** Whether the swap is feasible (same pin count, same family). */
  feasible: boolean;
  /** Reason if not feasible. */
  reason: string | null;
  /** The instance ID that was swapped. */
  instanceId: string;
  /** Previous component type. */
  previousType: string;
  /** New component type. */
  newType: string;
  /** Whether pin count matches (drop-in). */
  pinCompatible: boolean;
}

// ---------------------------------------------------------------------------
// SI prefix parsing
// ---------------------------------------------------------------------------

const SI_PREFIXES: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  '\u03BC': 1e-6,  // μ
  m: 1e-3,
  '': 1,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
};

/**
 * Parse a value string with SI prefix into a numeric value in base units.
 * Handles: "100", "1k", "4.7u", "100nF", "10kΩ", "22pF", "1M", "2.2kΩ"
 * Returns null if the string cannot be parsed as a numeric value.
 */
export function parseSIValue(raw: string): number | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  // Strip common unit suffixes (Ω, F, H, V, A, ohm, etc.)
  const cleaned = raw
    .replace(/[\u03A9Ω]/g, '')     // omega
    .replace(/ohm(s)?/gi, '')
    .replace(/[FHVAWfhvaw]$/g, '') // single-letter units at end
    .trim();

  if (cleaned.length === 0) {
    return null;
  }

  // Try direct numeric parse first
  const directParse = Number(cleaned);
  if (!isNaN(directParse) && cleaned.length > 0) {
    return directParse;
  }

  // Match number + optional SI prefix
  // e.g. "4.7k", "100n", "2.2M", "10μ"
  const match = /^([0-9]*\.?[0-9]+)\s*([pnuμmkKMGT]?)$/.exec(cleaned);
  if (!match) {
    return null;
  }

  const num = parseFloat(match[1]);
  const prefix = match[2];

  if (isNaN(num)) {
    return null;
  }

  const multiplier = SI_PREFIXES[prefix];
  if (multiplier === undefined) {
    return null;
  }

  return num * multiplier;
}

/**
 * Format a numeric base-unit value back to a human-readable SI string.
 */
export function formatSIValue(value: number, unit: string = ''): string {
  if (value === 0) {
    return `0${unit}`;
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e12) {
    return `${sign}${(abs / 1e12).toPrecision(3)}T${unit}`;
  }
  if (abs >= 1e9) {
    return `${sign}${(abs / 1e9).toPrecision(3)}G${unit}`;
  }
  if (abs >= 1e6) {
    return `${sign}${(abs / 1e6).toPrecision(3)}M${unit}`;
  }
  if (abs >= 1e3) {
    return `${sign}${(abs / 1e3).toPrecision(3)}k${unit}`;
  }
  if (abs >= 1) {
    return `${sign}${abs.toPrecision(3)}${unit}`;
  }
  if (abs >= 1e-3) {
    return `${sign}${(abs / 1e-3).toPrecision(3)}m${unit}`;
  }
  if (abs >= 1e-6) {
    return `${sign}${(abs / 1e-6).toPrecision(3)}\u03BC${unit}`;
  }
  if (abs >= 1e-9) {
    return `${sign}${(abs / 1e-9).toPrecision(3)}n${unit}`;
  }
  return `${sign}${(abs / 1e-12).toPrecision(3)}p${unit}`;
}

// ---------------------------------------------------------------------------
// Family definitions
// ---------------------------------------------------------------------------

/**
 * Canonical mapping from component family names to the ComponentCategory
 * they belong to, plus the keywords used to classify components.
 */
export interface FamilyDef {
  /** Display name for this family. */
  name: string;
  /** Which component category this family maps to. */
  category: ComponentCategory;
  /** Keywords that, if found in the component title (case-insensitive), classify it. */
  keywords: string[];
  /** The unit of measurement for this family's primary value (e.g. "Ω", "F", "H"). */
  unit: string;
}

export const PART_FAMILIES: FamilyDef[] = [
  { name: 'Resistors', category: 'Passives', keywords: ['resistor'], unit: '\u03A9' },
  { name: 'Capacitors', category: 'Passives', keywords: ['capacitor'], unit: 'F' },
  { name: 'Inductors', category: 'Passives', keywords: ['inductor'], unit: 'H' },
  { name: 'Diodes', category: 'Diodes', keywords: ['diode', 'rectifier', 'zener', 'schottky'], unit: 'V' },
  { name: 'LEDs', category: 'LEDs', keywords: ['led'], unit: '' },
  { name: 'Transistors', category: 'Transistors', keywords: ['transistor', 'mosfet', 'bjt', 'npn', 'pnp', 'n-channel', 'p-channel'], unit: '' },
  { name: 'Op-Amps', category: 'Op-Amps', keywords: ['op-amp', 'opamp', 'comparator', 'operational amplifier'], unit: '' },
  { name: 'Microcontrollers', category: 'Microcontrollers', keywords: ['mcu', 'microcontroller', 'arduino', 'esp32', 'esp8266', 'stm32', 'attiny', 'atmega'], unit: '' },
  { name: 'Connectors', category: 'Connectors', keywords: ['connector', 'header', 'jack', 'usb', 'terminal block', 'jst'], unit: '' },
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Registry implementation
// ---------------------------------------------------------------------------

/**
 * Metadata extracted from a ComponentPart-like object for family classification.
 */
export interface PartInfo {
  id: number;
  title: string;
  family?: string;
  value?: string;
  pinCount: number;
  packageType?: string;
  manufacturer?: string;
  category?: string;
}

class PartFamilyRegistryImpl {
  private parts: PartInfo[] = [];
  private listeners = new Set<Listener>();
  private _version = 0;

  /** Current version — changes on every mutation. */
  get version(): number {
    return this._version;
  }

  // ---- Data loading ----

  /**
   * Load parts into the registry. Typically called when component parts are
   * fetched from the API. Replaces the entire part list.
   */
  loadParts(parts: PartInfo[]): void {
    this.parts = [...parts];
    this._version++;
    this.notify();
  }

  /** Get all loaded parts. */
  getParts(): readonly PartInfo[] {
    return this.parts;
  }

  // ---- Family classification ----

  /**
   * Determine which family a component belongs to.
   * First checks the explicit `family` field, then falls back to
   * keyword matching on the title, then category matching.
   */
  getFamily(componentType: string): string | null {
    const lower = componentType.toLowerCase();

    // Direct family field match
    for (const part of this.parts) {
      if (part.title.toLowerCase() === lower && part.family) {
        const familyDef = PART_FAMILIES.find(
          (f) => f.name.toLowerCase() === part.family?.toLowerCase(),
        );
        if (familyDef) {
          return familyDef.name;
        }
      }
    }

    // Keyword-based classification
    for (const familyDef of PART_FAMILIES) {
      for (const keyword of familyDef.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          return familyDef.name;
        }
      }
    }

    // Category-based fallback
    for (const part of this.parts) {
      if (part.title.toLowerCase() === lower && part.category) {
        const familyDef = PART_FAMILIES.find(
          (f) => f.category.toLowerCase() === part.category?.toLowerCase(),
        );
        if (familyDef) {
          return familyDef.name;
        }
      }
    }

    return null;
  }

  /**
   * Get all parts that belong to a given family.
   * Sorted by numeric value (ascending) when parseable, then alphabetically.
   */
  getFamilyMembers(family: string): ComponentSwapCandidate[] {
    const familyDef = PART_FAMILIES.find(
      (f) => f.name.toLowerCase() === family.toLowerCase(),
    );
    if (!familyDef) {
      return [];
    }

    const candidates: ComponentSwapCandidate[] = [];

    for (const part of this.parts) {
      if (this.partMatchesFamily(part, familyDef)) {
        candidates.push(this.toCandidate(part));
      }
    }

    return this.sortCandidates(candidates);
  }

  /**
   * Get swap candidates for a component — all family members excluding the
   * current component itself.
   */
  getSwapCandidates(current: { type: string; value?: string }): ComponentSwapCandidate[] {
    const family = this.getFamily(current.type);
    if (!family) {
      return [];
    }

    const members = this.getFamilyMembers(family);
    return members.filter(
      (m) => m.componentType.toLowerCase() !== current.type.toLowerCase(),
    );
  }

  /**
   * Compute a SwapResult describing whether a swap is feasible.
   */
  performSwap(
    instanceId: string,
    newComponentType: string,
    currentType?: string,
    currentPinCount?: number,
  ): SwapResult {
    const newPart = this.parts.find(
      (p) => p.title.toLowerCase() === newComponentType.toLowerCase(),
    );

    if (!newPart) {
      return {
        feasible: false,
        reason: `Component "${newComponentType}" not found in registry.`,
        instanceId,
        previousType: currentType ?? '',
        newType: newComponentType,
        pinCompatible: false,
      };
    }

    // Check family compatibility
    const currentFamily = currentType ? this.getFamily(currentType) : null;
    const newFamily = this.getFamily(newComponentType);

    if (currentFamily && newFamily && currentFamily !== newFamily) {
      return {
        feasible: false,
        reason: `Cannot swap across families: "${currentFamily}" to "${newFamily}".`,
        instanceId,
        previousType: currentType ?? '',
        newType: newComponentType,
        pinCompatible: false,
      };
    }

    const pinCompatible =
      currentPinCount === undefined || currentPinCount === newPart.pinCount;

    if (!pinCompatible) {
      return {
        feasible: false,
        reason: `Pin count mismatch: current has ${currentPinCount} pins, replacement has ${newPart.pinCount} pins.`,
        instanceId,
        previousType: currentType ?? '',
        newType: newComponentType,
        pinCompatible: false,
      };
    }

    return {
      feasible: true,
      reason: null,
      instanceId,
      previousType: currentType ?? '',
      newType: newComponentType,
      pinCompatible: true,
    };
  }

  // ---- Subscribe pattern ----

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- Internal helpers ----

  private notify(): void {
    Array.from(this.listeners).forEach((listener) => {
      listener();
    });
  }

  private partMatchesFamily(part: PartInfo, familyDef: FamilyDef): boolean {
    // Check explicit family field
    if (part.family) {
      if (part.family.toLowerCase() === familyDef.name.toLowerCase()) {
        return true;
      }
    }

    // Check title keywords
    const titleLower = part.title.toLowerCase();
    for (const keyword of familyDef.keywords) {
      if (titleLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    // Check category
    if (part.category && part.category.toLowerCase() === familyDef.category.toLowerCase()) {
      // Only match category if no family-level keyword contradicts
      // (e.g. "Passives" category contains resistors, capacitors, AND inductors)
      // We require at least one keyword match for category-only classification
      // to avoid lumping all passives together.
      return false;
    }

    return false;
  }

  private toCandidate(part: PartInfo): ComponentSwapCandidate {
    return {
      title: part.title,
      componentType: part.title,
      numericValue: part.value ? parseSIValue(part.value) : null,
      displayValue: part.value ?? '',
      pinCount: part.pinCount,
      packageType: part.packageType ?? null,
      manufacturer: part.manufacturer ?? null,
    };
  }

  private sortCandidates(candidates: ComponentSwapCandidate[]): ComponentSwapCandidate[] {
    return candidates.sort((a, b) => {
      // Sort by numeric value when both are parseable
      if (a.numericValue !== null && b.numericValue !== null) {
        return a.numericValue - b.numericValue;
      }
      // Numeric values come before non-numeric
      if (a.numericValue !== null) {
        return -1;
      }
      if (b.numericValue !== null) {
        return 1;
      }
      // Alphabetical fallback
      return a.title.localeCompare(b.title);
    });
  }
}

/** Singleton instance. */
export const partFamilyRegistry = new PartFamilyRegistryImpl();
