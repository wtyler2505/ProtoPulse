/**
 * Self-Healing Assistant — barrel.
 *
 * SelfHealingAssistant detects 12 circuit hazards from schematic data
 * (instances, nets, architecture nodes) and proposes fixes with specific
 * component additions. Each fix proposal has an approval gate with a
 * configurable expiry (default 5 min). Singleton + subscribe pattern for
 * useSyncExternalStore compatibility.
 *
 * Hazard types:
 *   1.  voltage_mismatch      — component Vmax < rail voltage
 *   2.  missing_decoupling    — IC/MCU without nearby bypass cap
 *   3.  unprotected_io        — I/O pins without series resistor or clamp
 *   4.  floating_input        — input pins with no pull-up/pull-down
 *   5.  reverse_polarity      — no protection diode on power input
 *   6.  overcurrent           — load current exceeds pin max
 *   7.  esd_exposure          — external connectors without TVS/ESD clamp
 *   8.  missing_level_shifter — logic level mismatch between connected ICs
 *   9.  power_overload        — total load exceeds regulator capacity
 *   10. adc_reference         — ADC input exceeds reference voltage
 *   11. thermal_risk          — high-dissipation component without heatsink
 *   12. bus_contention        — multiple outputs driving the same net
 */

export type {
  AnalysisInstance,
  AnalysisNet,
  AnalysisNode,
  FixProposal,
  Hazard,
  HazardSeverity,
  HazardType,
  HealingConfig,
  HealingSnapshot,
  ProposedComponent,
} from './types';

export { parseCurrent, parsePower, parseVoltage } from './parsers';

export { resetIdCounter } from './id';

export {
  detectFloatingInputs,
  detectMissingDecoupling,
  detectOvercurrent,
  detectReversePolarity,
  detectUnprotectedIo,
  detectVoltageMismatch,
} from './detectors-a';

export {
  detectAdcReference,
  detectBusContention,
  detectEsdExposure,
  detectMissingLevelShifter,
  detectPowerOverload,
  detectThermalRisk,
} from './detectors-b';

export {
  SelfHealingAssistant,
  getSelfHealingAssistant,
  resetSelfHealingAssistant,
} from './assistant';
