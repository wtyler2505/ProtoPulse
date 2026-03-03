import type { DRCRule } from './component-types';

export interface ManufacturerDRCTemplate {
  name: string;
  manufacturer: string;
  description: string;
  rules: DRCRule[];
}

/**
 * Manufacturer-specific DRC rule templates.
 *
 * All dimensional values are in millimeters. The DRC engine works in px internally,
 * but templates store manufacturer specs in mm for clarity and auditability against
 * official fab-house capability documents. Consumers must convert mm → px using
 * their board's DPI/scale before passing rules to runDRC.
 *
 * Sources:
 *  - JLCPCB: https://jlcpcb.com/capabilities/pcb-capabilities
 *  - PCBWay: https://www.pcbway.com/capabilities.html
 *  - OSHPark: https://docs.oshpark.com/services/
 */
const templates: ManufacturerDRCTemplate[] = [
  {
    name: 'JLCPCB 2-Layer',
    manufacturer: 'JLCPCB',
    description: 'Standard 2-layer PCB capabilities for JLCPCB. Minimum trace/space 5mil (0.127mm), min drill 0.3mm, min annular ring 0.13mm.',
    rules: [
      { type: 'min-trace-width', params: { minWidth: 0.127 }, severity: 'error', enabled: true },
      { type: 'min-clearance', params: { minClearance: 0.127 }, severity: 'error', enabled: true },
      { type: 'pad-size', params: { minPadDiameter: 0.6, minDrillDiameter: 0.3 }, severity: 'error', enabled: true },
      { type: 'annular-ring', params: { minAnnularRing: 0.13 }, severity: 'error', enabled: true },
      { type: 'trace-to-edge', params: { minEdgeClearance: 0.3 }, severity: 'error', enabled: true },
      { type: 'solder-mask', params: { minSolderMaskDam: 0.1, minSolderMaskExpansion: 0.05 }, severity: 'warning', enabled: true },
      { type: 'via-in-pad', params: {}, severity: 'warning', enabled: true },
      { type: 'silk-overlap', params: {}, severity: 'warning', enabled: true },
      { type: 'courtyard-overlap', params: { minCourtyard: 0.25 }, severity: 'warning', enabled: true },
      { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning', enabled: true },
    ],
  },
  {
    name: 'JLCPCB 4-Layer',
    manufacturer: 'JLCPCB',
    description: 'Standard 4-layer PCB capabilities for JLCPCB. Tighter tolerances than 2-layer for inner layers.',
    rules: [
      { type: 'min-trace-width', params: { minWidth: 0.09 }, severity: 'error', enabled: true },
      { type: 'min-clearance', params: { minClearance: 0.09 }, severity: 'error', enabled: true },
      { type: 'pad-size', params: { minPadDiameter: 0.6, minDrillDiameter: 0.2 }, severity: 'error', enabled: true },
      { type: 'annular-ring', params: { minAnnularRing: 0.13 }, severity: 'error', enabled: true },
      { type: 'trace-to-edge', params: { minEdgeClearance: 0.3 }, severity: 'error', enabled: true },
      { type: 'solder-mask', params: { minSolderMaskDam: 0.1, minSolderMaskExpansion: 0.05 }, severity: 'warning', enabled: true },
      { type: 'via-in-pad', params: {}, severity: 'warning', enabled: true },
      { type: 'silk-overlap', params: {}, severity: 'warning', enabled: true },
      { type: 'courtyard-overlap', params: { minCourtyard: 0.25 }, severity: 'warning', enabled: true },
      { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning', enabled: true },
    ],
  },
  {
    name: 'PCBWay Standard',
    manufacturer: 'PCBWay',
    description: 'Standard PCB capabilities for PCBWay. Minimum trace/space 4mil (0.1mm), min drill 0.2mm.',
    rules: [
      { type: 'min-trace-width', params: { minWidth: 0.1 }, severity: 'error', enabled: true },
      { type: 'min-clearance', params: { minClearance: 0.1 }, severity: 'error', enabled: true },
      { type: 'pad-size', params: { minPadDiameter: 0.5, minDrillDiameter: 0.2 }, severity: 'error', enabled: true },
      { type: 'annular-ring', params: { minAnnularRing: 0.1 }, severity: 'error', enabled: true },
      { type: 'trace-to-edge', params: { minEdgeClearance: 0.25 }, severity: 'error', enabled: true },
      { type: 'solder-mask', params: { minSolderMaskDam: 0.08, minSolderMaskExpansion: 0.05 }, severity: 'warning', enabled: true },
      { type: 'via-in-pad', params: {}, severity: 'warning', enabled: true },
      { type: 'silk-overlap', params: {}, severity: 'warning', enabled: true },
      { type: 'courtyard-overlap', params: { minCourtyard: 0.2 }, severity: 'warning', enabled: true },
      { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning', enabled: true },
    ],
  },
  {
    name: 'OSHPark 2-Layer',
    manufacturer: 'OSHPark',
    description: 'After Dark 2-layer service from OSHPark. Minimum trace/space 6mil (0.152mm), min drill 10mil (0.254mm).',
    rules: [
      { type: 'min-trace-width', params: { minWidth: 0.152 }, severity: 'error', enabled: true },
      { type: 'min-clearance', params: { minClearance: 0.152 }, severity: 'error', enabled: true },
      { type: 'pad-size', params: { minPadDiameter: 0.7, minDrillDiameter: 0.254 }, severity: 'error', enabled: true },
      { type: 'annular-ring', params: { minAnnularRing: 0.178 }, severity: 'error', enabled: true },
      { type: 'trace-to-edge', params: { minEdgeClearance: 0.381 }, severity: 'error', enabled: true },
      { type: 'solder-mask', params: { minSolderMaskDam: 0.1, minSolderMaskExpansion: 0.05 }, severity: 'warning', enabled: true },
      { type: 'via-in-pad', params: {}, severity: 'warning', enabled: true },
      { type: 'silk-overlap', params: {}, severity: 'warning', enabled: true },
      { type: 'courtyard-overlap', params: { minCourtyard: 0.25 }, severity: 'warning', enabled: true },
      { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning', enabled: true },
    ],
  },
  {
    name: 'OSHPark 4-Layer',
    manufacturer: 'OSHPark',
    description: '4-layer stackup from OSHPark. Minimum trace/space 5mil (0.127mm), min drill 10mil (0.254mm).',
    rules: [
      { type: 'min-trace-width', params: { minWidth: 0.127 }, severity: 'error', enabled: true },
      { type: 'min-clearance', params: { minClearance: 0.127 }, severity: 'error', enabled: true },
      { type: 'pad-size', params: { minPadDiameter: 0.7, minDrillDiameter: 0.254 }, severity: 'error', enabled: true },
      { type: 'annular-ring', params: { minAnnularRing: 0.178 }, severity: 'error', enabled: true },
      { type: 'trace-to-edge', params: { minEdgeClearance: 0.381 }, severity: 'error', enabled: true },
      { type: 'solder-mask', params: { minSolderMaskDam: 0.1, minSolderMaskExpansion: 0.05 }, severity: 'warning', enabled: true },
      { type: 'via-in-pad', params: {}, severity: 'warning', enabled: true },
      { type: 'silk-overlap', params: {}, severity: 'warning', enabled: true },
      { type: 'courtyard-overlap', params: { minCourtyard: 0.25 }, severity: 'warning', enabled: true },
      { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning', enabled: true },
    ],
  },
];

/**
 * Look up a manufacturer DRC template by name (exact match, case-insensitive).
 */
export function getManufacturerTemplate(name: string): ManufacturerDRCTemplate | undefined {
  const lower = name.toLowerCase();
  return templates.find((t) => t.name.toLowerCase() === lower);
}

/**
 * Return all available manufacturer DRC templates.
 * Returns a defensive copy so callers cannot mutate the internal list.
 */
export function getAllTemplates(): ManufacturerDRCTemplate[] {
  return templates.map((t) => ({
    ...t,
    rules: t.rules.map((r) => ({ ...r, params: { ...r.params } })),
  }));
}

/**
 * Return all templates for a given manufacturer (case-insensitive).
 */
export function getTemplatesByManufacturer(manufacturer: string): ManufacturerDRCTemplate[] {
  const lower = manufacturer.toLowerCase();
  return templates
    .filter((t) => t.manufacturer.toLowerCase() === lower)
    .map((t) => ({
      ...t,
      rules: t.rules.map((r) => ({ ...r, params: { ...r.params } })),
    }));
}
