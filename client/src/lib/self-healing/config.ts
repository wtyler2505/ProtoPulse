/**
 * Self-Healing Assistant — default configuration and constants.
 * Split from self-healing.ts.
 */

import type { HazardType, HealingConfig } from './types';

export const ALL_HAZARD_TYPES: HazardType[] = [
  'voltage_mismatch',
  'missing_decoupling',
  'unprotected_io',
  'floating_input',
  'reverse_polarity',
  'overcurrent',
  'esd_exposure',
  'missing_level_shifter',
  'power_overload',
  'adc_reference',
  'thermal_risk',
  'bus_contention',
];

export function defaultEnabledChecks(): Record<HazardType, boolean> {
  const checks: Partial<Record<HazardType, boolean>> = {};
  for (const t of ALL_HAZARD_TYPES) {
    checks[t] = true;
  }
  return checks as Record<HazardType, boolean>;
}

export const DEFAULT_CONFIG: HealingConfig = {
  approvalExpiryMs: 5 * 60 * 1000, // 5 minutes
  enabledChecks: defaultEnabledChecks(),
  defaultMaxPinCurrentMa: 20,
  defaultAdcRefVoltage: 3.3,
  defaultMaxRegulatorCurrentMa: 500,
  thermalThresholdWatts: 0.5,
};

export const DEFAULT_APPROVAL_EXPIRY_MS = 5 * 60 * 1000;
