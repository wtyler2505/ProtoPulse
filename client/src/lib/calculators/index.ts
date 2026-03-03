/**
 * Engineering Calculators — barrel export
 *
 * Pure-function calculator modules for common electronics calculations.
 */

// Types
export type {
  CalculatorResult,
  CalculatorError,
  ResistorResult,
  FilterType,
} from './types';
export { E24_VALUES, E96_VALUES, findNearestStandard, formatEngineering } from './types';

// Ohm's Law
export type { OhmsLawInput, OhmsLawResult } from './ohms-law';
export { solveOhmsLaw } from './ohms-law';

// LED Resistor
export type { LedResistorInput, LedResistorOutput } from './led-resistor';
export { solveLedResistor } from './led-resistor';

// Voltage Divider
export type {
  VoltageDividerInput,
  VoltageDividerResult,
  VoltageDividerReverseInput,
  ResistorPairSuggestion,
} from './voltage-divider';
export { solveVoltageDivider, suggestVoltageDividerPairs, findNearestResistorValues } from './voltage-divider';

// RC Time Constant
export type { RcTimeConstantInput, RcTimeConstantResult, RcVoltageAtTimeInput } from './rc-time-constant';
export { solveRcTimeConstant, solveRcVoltageAtTime } from './rc-time-constant';

// Filter Cutoff
export type {
  RcFilterInput,
  BandpassFilterInput,
  RcFilterResult,
  BandpassFilterResult,
  GainAtFrequencyInput,
  GainAtFrequencyResult,
} from './filter-cutoff';
export { solveRcFilter, solveBandpassFilter, calculateGainAtFrequency } from './filter-cutoff';

// Power Dissipation
export type { PowerDissipationInput, PowerDissipationResult } from './power-dissipation';
export { solvePowerDissipation } from './power-dissipation';
