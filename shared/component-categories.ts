/**
 * Canonical component category list — single source of truth for both
 * standard-library definitions and UI filter dropdowns.
 *
 * When adding a new category, add it here and the type system will enforce
 * that standard-library.ts component definitions use a valid value.
 */
export const COMPONENT_CATEGORIES = [
  'Logic ICs',
  'Passives',
  'Microcontrollers',
  'Power',
  'Op-Amps',
  'Transistors',
  'Diodes',
  'LEDs',
  'Connectors',
  'Displays & UI',
  'Sensors',
  'Communication',
  'Misc',
] as const;

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];
