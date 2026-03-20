/**
 * PCB Thermal Bridge
 *
 * Bridges actual PCB placement data (circuit instances) into ThermalComponent
 * entries for the thermal analysis engine. Extracts package types from instance
 * properties, looks up thermal characteristics from a built-in database, and
 * maps positions from instance coordinates.
 */

import type { ThermalComponent } from './thermal-analysis';

// ---------------------------------------------------------------------------
// Circuit instance data shape (matches DB schema fields used for placement)
// ---------------------------------------------------------------------------

export interface CircuitInstanceData {
  id: number;
  instanceId: string;
  label: string;
  componentId: string;
  properties: unknown;
  positionX: number;
  positionY: number;
}

// ---------------------------------------------------------------------------
// Package thermal database
// ---------------------------------------------------------------------------

export interface PackageThermalData {
  /** Junction-to-case thermal resistance (degC/W) */
  thetaJC: number;
  /** Case-to-ambient thermal resistance (degC/W, still air) */
  thetaCA: number;
  /** Maximum junction temperature (degC) */
  maxJunctionTemp: number;
}

/**
 * Built-in thermal characteristics for 15+ common IC packages.
 * Values are representative of typical devices in each package family.
 */
export const PACKAGE_THERMAL_DB: Record<string, PackageThermalData> = {
  'DIP-8': { thetaJC: 25, thetaCA: 55, maxJunctionTemp: 150 },
  'DIP-14': { thetaJC: 22, thetaCA: 50, maxJunctionTemp: 150 },
  'DIP-16': { thetaJC: 20, thetaCA: 48, maxJunctionTemp: 150 },
  'SOIC-8': { thetaJC: 30, thetaCA: 90, maxJunctionTemp: 150 },
  'SOIC-16': { thetaJC: 25, thetaCA: 70, maxJunctionTemp: 150 },
  'SOT-23': { thetaJC: 50, thetaCA: 200, maxJunctionTemp: 150 },
  'SOT-223': { thetaJC: 15, thetaCA: 60, maxJunctionTemp: 150 },
  'QFP-44': { thetaJC: 12, thetaCA: 40, maxJunctionTemp: 150 },
  'QFP-64': { thetaJC: 10, thetaCA: 35, maxJunctionTemp: 150 },
  'QFN-32': { thetaJC: 5, thetaCA: 30, maxJunctionTemp: 150 },
  'QFN-48': { thetaJC: 4, thetaCA: 25, maxJunctionTemp: 150 },
  'TO-220': { thetaJC: 1.5, thetaCA: 40, maxJunctionTemp: 175 },
  'TO-92': { thetaJC: 20, thetaCA: 160, maxJunctionTemp: 150 },
  'TO-252': { thetaJC: 3, thetaCA: 50, maxJunctionTemp: 175 },
  'BGA-256': { thetaJC: 2, thetaCA: 20, maxJunctionTemp: 125 },
};

/** Fallback thermal values for unknown package types. */
const FALLBACK_THERMAL: PackageThermalData = {
  thetaJC: 30,
  thetaCA: 80,
  maxJunctionTemp: 150,
};

/** Default power dissipation (watts) when not specified. */
const DEFAULT_POWER_DISSIPATION = 0.1;

// ---------------------------------------------------------------------------
// Case-insensitive package lookup
// ---------------------------------------------------------------------------

/** Map of upper-cased package keys for case-insensitive matching. */
const PACKAGE_LOOKUP = new Map<string, PackageThermalData>(
  Object.entries(PACKAGE_THERMAL_DB).map(([key, val]) => [key.toUpperCase(), val]),
);

function lookupPackage(packageType: string): PackageThermalData {
  return PACKAGE_LOOKUP.get(packageType.toUpperCase()) ?? FALLBACK_THERMAL;
}

// ---------------------------------------------------------------------------
// Property extraction helpers
// ---------------------------------------------------------------------------

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && val !== undefined && typeof val === 'object' && !Array.isArray(val);
}

function getStringProp(props: Record<string, unknown>, key: string): string | undefined {
  const val = props[key];
  return typeof val === 'string' ? val : undefined;
}

function getNumberProp(props: Record<string, unknown>, key: string): number | undefined {
  const val = props[key];
  return typeof val === 'number' && !isNaN(val) ? val : undefined;
}

// ---------------------------------------------------------------------------
// extractThermalComponents
// ---------------------------------------------------------------------------

/**
 * Map circuit instances (with PCB placement data) to ThermalComponent entries
 * for thermal analysis.
 *
 * Extracts packageType from instance `properties` JSONB. Instances without a
 * packageType are skipped (they're typically wires, nets, or unpopulated refs).
 *
 * @param instances - Array of circuit instance data from the database.
 * @param defaultPower - Default power dissipation in watts (default 0.1W).
 * @returns Array of ThermalComponent entries ready for ThermalAnalyzer.
 */
export function extractThermalComponents(
  instances: CircuitInstanceData[],
  defaultPower: number = DEFAULT_POWER_DISSIPATION,
): ThermalComponent[] {
  const components: ThermalComponent[] = [];

  for (const inst of instances) {
    if (!isRecord(inst.properties)) {
      continue;
    }

    const packageType = getStringProp(inst.properties, 'packageType');
    if (!packageType) {
      continue;
    }

    const thermal = lookupPackage(packageType);
    const power = getNumberProp(inst.properties, 'powerDissipation') ?? defaultPower;
    const layer = getStringProp(inst.properties, 'layer') ?? 'F.Cu';

    components.push({
      id: inst.instanceId,
      name: inst.label,
      packageType,
      powerDissipation: power,
      thetaJC: thermal.thetaJC,
      thetaCA: thermal.thetaCA,
      maxJunctionTemp: thermal.maxJunctionTemp,
      position: { x: inst.positionX, y: inst.positionY },
      layer,
    });
  }

  return components;
}
