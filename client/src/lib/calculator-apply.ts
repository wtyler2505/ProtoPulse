/**
 * Calculator Apply — Maps calculator results to BOM items and schematic instance properties.
 *
 * Provides the bridge between engineering calculator outputs and actionable design data:
 * - mapResultToBomItem: converts a CalcResult to a partial BOM item for adding to the project BOM
 * - mapResultToInstanceProperty: converts a CalcResult to a property key/value for schematic instances
 * - getApplicableActions: determines which apply actions are valid for a given result
 */

import { formatEngineering } from '@/lib/calculators/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The set of calculators whose results can be applied. */
export type CalculatorName =
  | 'ohms-law'
  | 'led-resistor'
  | 'voltage-divider'
  | 'rc-time-constant'
  | 'filter-cutoff'
  | 'power-dissipation';

/** A single result value from a calculator, ready for application to the design. */
export interface CalcResult {
  /** Which calculator produced this result. */
  calculatorName: CalculatorName;
  /** Human-readable name of the result field (e.g., "Resistance", "Nearest E24"). */
  resultName: string;
  /** Numeric value in base SI units. */
  value: number;
  /** SI unit string (e.g., 'Ω', 'V', 'A', 'W', 'F', 'Hz', 's'). */
  unit: string;
  /** Optional component type hint for BOM categorization. */
  componentType?: string;
}

/** Actions that can be performed with a calculator result. */
export type CalcApplyAction = 'add_to_bom' | 'apply_to_instance';

/** A partial BOM item derived from a calculator result. */
export interface PartialBomItem {
  description: string;
  partNumber: string;
  manufacturer: string;
  quantity: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'On Order';
}

/** An instance property key/value pair for schematic component properties. */
export interface InstanceProperty {
  property: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Unit → component type mapping
// ---------------------------------------------------------------------------

const UNIT_TO_COMPONENT_TYPE: Record<string, string> = {
  'Ω': 'Resistor',
  'F': 'Capacitor',
  'H': 'Inductor',
};

const COMPONENT_TYPE_DESCRIPTIONS: Record<string, string> = {
  Resistor: 'Resistor',
  Capacitor: 'Capacitor',
  Inductor: 'Inductor',
};

// ---------------------------------------------------------------------------
// Units that represent passive component values (can be added to BOM)
// ---------------------------------------------------------------------------

const BOM_APPLICABLE_UNITS = new Set(['Ω', 'F', 'H']);

// ---------------------------------------------------------------------------
// Units that can be applied as instance properties
// ---------------------------------------------------------------------------

const INSTANCE_APPLICABLE_UNITS = new Set(['Ω', 'V', 'A', 'W', 'F', 'H', 'Hz', 's']);

// ---------------------------------------------------------------------------
// Unit → property name mapping for instance properties
// ---------------------------------------------------------------------------

const UNIT_TO_PROPERTY: Record<string, string> = {
  'Ω': 'resistance',
  'V': 'voltage',
  'A': 'current',
  'W': 'power',
  'F': 'capacitance',
  'H': 'inductance',
  'Hz': 'frequency',
  's': 'time_constant',
  'rad/s': 'angular_frequency',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine which apply actions are available for a given calculator result.
 *
 * - add_to_bom: only for results that represent a passive component value (Ω, F, H)
 * - apply_to_instance: for any result with a recognized electrical unit
 */
export function getApplicableActions(result: CalcResult): CalcApplyAction[] {
  const actions: CalcApplyAction[] = [];

  if (!Number.isFinite(result.value) || result.value <= 0) {
    return actions;
  }

  if (BOM_APPLICABLE_UNITS.has(result.unit)) {
    actions.push('add_to_bom');
  }

  if (INSTANCE_APPLICABLE_UNITS.has(result.unit)) {
    actions.push('apply_to_instance');
  }

  return actions;
}

/**
 * Map a calculator result to a partial BOM item.
 *
 * Only valid for results with passive component units (Ω, F, H).
 * Returns null if the result cannot be mapped to a BOM item.
 */
export function mapResultToBomItem(result: CalcResult): PartialBomItem | null {
  if (!Number.isFinite(result.value) || result.value <= 0) {
    return null;
  }

  const componentType = result.componentType ?? UNIT_TO_COMPONENT_TYPE[result.unit];
  if (!componentType) {
    return null;
  }

  const typeDesc = COMPONENT_TYPE_DESCRIPTIONS[componentType] ?? componentType;
  const formatted = formatEngineering(result.value, result.unit);

  return {
    description: `${typeDesc} ${formatted} (from ${formatCalculatorDisplayName(result.calculatorName)} calculator)`,
    partNumber: `CALC-${componentType.toUpperCase().slice(0, 3)}-${formatPartNumberValue(result.value, result.unit)}`,
    manufacturer: 'TBD',
    quantity: 1,
    status: 'In Stock',
  };
}

/**
 * Map a calculator result to a schematic instance property key/value pair.
 *
 * Returns null if the result's unit is not recognized.
 */
export function mapResultToInstanceProperty(result: CalcResult): InstanceProperty | null {
  if (!Number.isFinite(result.value) || result.value <= 0) {
    return null;
  }

  const property = UNIT_TO_PROPERTY[result.unit];
  if (!property) {
    return null;
  }

  return {
    property,
    value: formatEngineering(result.value, result.unit),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a calculator name for display in descriptions. */
function formatCalculatorDisplayName(name: CalculatorName): string {
  const displayNames: Record<CalculatorName, string> = {
    'ohms-law': "Ohm's Law",
    'led-resistor': 'LED Resistor',
    'voltage-divider': 'Voltage Divider',
    'rc-time-constant': 'RC Time Constant',
    'filter-cutoff': 'Filter Cutoff',
    'power-dissipation': 'Power Dissipation',
  };
  return displayNames[name];
}

/** Generate a compact part number suffix from a value and unit. */
function formatPartNumberValue(value: number, unit: string): string {
  const formatted = formatEngineering(value, unit);
  // Strip spaces and special characters for part number
  return formatted.replace(/\s+/g, '').replace(/[^a-zA-Z0-9.µΩ]/g, '');
}
