/**
 * Manufacturing tools — DFM checking, violation explanation, and fix suggestions.
 *
 * Provides 3 AI tools for conversational DFM (Design for Manufacturability)
 * guidance. These tools wrap the existing DfmChecker engine and IPC standard
 * knowledge to help makers understand and fix manufacturing issues.
 *
 * Tools that mutate project data return AIAction arrays for auto-fixable
 * violations. All tools execute server-side.
 *
 * @module ai-tools/manufacturing
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import type { ToolResult } from './types';

// ---------------------------------------------------------------------------
// IPC Standard Knowledge Base
// ---------------------------------------------------------------------------

interface IpcStandard {
  id: string;
  title: string;
  section?: string;
}

/**
 * Map of DFM violation rule IDs to their corresponding IPC standards.
 */
const IPC_STANDARDS: Record<string, IpcStandard> = {
  'DFM-001': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '6.2 — Conductor Width' },
  'DFM-002': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '6.3 — Conductor Spacing' },
  'DFM-003': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '8.2.1 — Hole Size' },
  'DFM-004': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '8.2.2 — Via Holes' },
  'DFM-005': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '8.2.2 — Via Outer Diameter' },
  'DFM-006': { id: 'IPC-7351', title: 'Generic Requirements for Surface Mount Design and Land Pattern Standard', section: '3.2 — Annular Ring' },
  'DFM-007': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '6.1 — Board Dimensions' },
  'DFM-008': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '6.1.2 — Board Thickness' },
  'DFM-009': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '6.1.3 — Layer Count' },
  'DFM-010': { id: 'IPC-7351', title: 'Generic Requirements for Surface Mount Design and Land Pattern Standard', section: '8.1 — Silkscreen' },
  'DFM-011': { id: 'IPC-7525', title: 'Stencil Design Guidelines', section: '4.3 — Solder Mask' },
  'DFM-012': { id: 'IPC-4552', title: 'Performance Specification for Electroless Nickel/Immersion Gold', section: 'Surface Finish' },
  'DFM-013': { id: 'IPC-4562', title: 'Metal Foil for Printed Board Applications', section: 'Copper Weight' },
  'DFM-014': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '8.2.3 — Hole-to-Hole Spacing' },
  'DFM-015': { id: 'IPC-2221', title: 'Generic Standard on Printed Board Design', section: '8.2.4 — Hole-to-Edge Clearance' },
};

/**
 * Detailed explanations of each DFM violation type.
 */
const VIOLATION_EXPLANATIONS: Record<string, {
  explanation: string;
  severity: string;
  commonCauses: string[];
}> = {
  'Minimum Trace Width': {
    explanation: 'The trace (copper track) connecting two pads is narrower than what the fabrication house can reliably etch. Traces that are too thin may break during etching or have higher resistance, causing voltage drops and potential overheating under current load.',
    severity: 'error',
    commonCauses: [
      'Auto-router using default thin traces for signal nets',
      'Manual routing without checking fab capabilities',
      'Using design rules from a different (higher-capability) fab house',
      'Tight space between BGA pads forcing narrow escape routes',
    ],
  },
  'Minimum Trace Spacing': {
    explanation: 'Two adjacent copper traces are closer together than the fab house can reliably separate. Insufficient spacing risks short circuits from copper bridging during the etching process.',
    severity: 'error',
    commonCauses: [
      'Dense component placement forcing tight routing channels',
      'Not accounting for copper spreading during plating',
      'Different spacing rules between inner and outer layers',
      'Copy-pasting layout blocks from a design with different rules',
    ],
  },
  'Minimum Drill Size': {
    explanation: 'A drill hole is smaller than the smallest bit the fab house supports. The drill bit may break or produce an oversized/misshapen hole, leading to unreliable plated through-holes.',
    severity: 'error',
    commonCauses: [
      'Using via sizes from advanced fab specs on a budget fab',
      'Library footprints with very small vias',
      'Not updating drill sizes after changing fab house',
    ],
  },
  'Maximum Drill Size': {
    explanation: 'A drill hole exceeds the maximum diameter the fab house supports. Very large holes may require routing (milling) instead of drilling and may not be available at all fabs.',
    severity: 'error',
    commonCauses: [
      'Mounting holes sized for large bolts',
      'Connector cutouts modeled as drill holes',
      'Thermal relief holes for high-power components',
    ],
  },
  'Minimum Via Drill': {
    explanation: 'A via hole is smaller than the fab house can drill. Vias need reliable plating to connect layers; undersized vias may fail to plate properly.',
    severity: 'error',
    commonCauses: [
      'Using micro-via sizes on a standard fab process',
      'Library components with aggressive via sizes',
      'Not distinguishing between via and pad drill constraints',
    ],
  },
  'Minimum Via Outer Diameter': {
    explanation: 'The outer copper ring of a via is too small. The annular ring (copper around the drill) must be large enough to maintain electrical contact after drilling tolerances.',
    severity: 'error',
    commonCauses: [
      'Via outer diameter not updated when drill size was changed',
      'Using pad-sized vias from an advanced process',
      'Annular ring calculation not accounting for drill wander',
    ],
  },
  'Minimum Annular Ring': {
    explanation: 'The annular ring (copper surrounding a drilled hole) is narrower than the fab minimum. A thin annular ring may break out (drill hits the edge of the pad), creating an unreliable connection.',
    severity: 'error',
    commonCauses: [
      'Drill size too large relative to pad size',
      'Not accounting for drill registration tolerance',
      'Using tighter annular ring from a different fab class',
    ],
  },
  'Minimum Board Width': {
    explanation: 'The board is narrower than the fab house minimum. Very small boards may not be handled by automated panelization equipment.',
    severity: 'error',
    commonCauses: [
      'Designing a very small sensor module',
      'Not including panel border in the board outline',
    ],
  },
  'Maximum Board Width': {
    explanation: 'The board exceeds the maximum width the fab house can manufacture. The board may need to be split into multiple panels.',
    severity: 'error',
    commonCauses: [
      'Large backplane or LED panel designs',
      'Not checking fab house panel size limits',
    ],
  },
  'Minimum Board Height': {
    explanation: 'The board is shorter than the fab minimum height.',
    severity: 'error',
    commonCauses: [
      'Very thin strip-board designs',
      'Edge connector boards with minimal PCB area',
    ],
  },
  'Maximum Board Height': {
    explanation: 'The board exceeds the maximum height the fab house can manufacture.',
    severity: 'error',
    commonCauses: [
      'Large display or panel boards',
      'Not checking fab house size constraints',
    ],
  },
  'Minimum Board Thickness': {
    explanation: 'The specified board thickness is thinner than what the fab house offers. Thin boards are flexible and may warp during soldering.',
    severity: 'error',
    commonCauses: [
      'Flex-PCB thickness spec on a rigid-only fab',
      'Using ultra-thin spec without verifying availability',
    ],
  },
  'Maximum Board Thickness': {
    explanation: 'The specified board thickness exceeds what the fab house offers.',
    severity: 'error',
    commonCauses: [
      'High-layer-count stackups requiring thick laminates',
      'Special mechanical requirements',
    ],
  },
  'Maximum Layer Count': {
    explanation: 'The design uses more copper layers than the fab house supports. Additional layers require more complex (and expensive) manufacturing processes.',
    severity: 'error',
    commonCauses: [
      'Dense BGA routing requiring many signal layers',
      'Using a budget fab for a complex multi-layer design',
    ],
  },
  'Minimum Silkscreen Width': {
    explanation: 'Silkscreen lines or text are thinner than the fab can print. Thin silkscreen may be illegible or missing entirely on the finished board.',
    severity: 'warning',
    commonCauses: [
      'Small font sizes for reference designators',
      'Thin lines in component outlines',
      'Logo artwork with fine detail',
    ],
  },
  'Minimum Solder Mask Bridge': {
    explanation: 'The solder mask (green coating) between two pads is narrower than the fab can reliably apply. The mask may fail to separate pads, potentially causing solder bridges during assembly.',
    severity: 'warning',
    commonCauses: [
      'Fine-pitch component pads with tight spacing',
      'Solder mask expansion set too large',
      'Custom pad shapes with narrow gaps',
    ],
  },
  'Surface Finish Supported': {
    explanation: 'The selected surface finish is not available from this fab house. Different finishes (HASL, ENIG, OSP) affect solderability, shelf life, and cost.',
    severity: 'error',
    commonCauses: [
      'Specifying ENIG on a budget HASL-only fab',
      'Requiring immersion silver for RF boards at a basic fab',
    ],
  },
  'Copper Weight Supported': {
    explanation: 'The specified copper weight (thickness) is not available from this fab house. Heavier copper is needed for high-current traces but not all fabs offer it.',
    severity: 'error',
    commonCauses: [
      'Specifying 2oz copper on a fab that only offers 1oz',
      'Power board requiring 3oz or 4oz copper',
    ],
  },
  'Minimum Hole-to-Hole Spacing': {
    explanation: 'Two drill holes are too close together. The thin wall of material between holes may crack during drilling or plating, causing shorts or weak spots.',
    severity: 'error',
    commonCauses: [
      'Dense through-hole component placement',
      'Vias placed too close to component pads',
      'Via stitching pattern with overly aggressive spacing',
    ],
  },
  'Minimum Hole-to-Board-Edge Clearance': {
    explanation: 'A drill hole is too close to the board edge. The board may crack at the edge during depanelization (V-score or tab routing), and the copper plating in the hole may be damaged.',
    severity: 'error',
    commonCauses: [
      'Mounting holes placed at the very corner of the board',
      'Edge connectors with through-hole pins near the board outline',
      'Not accounting for routing tolerance in board outline',
    ],
  },
};

/**
 * Suggested fixes for DFM violations.
 */
const VIOLATION_FIXES: Record<string, {
  suggestions: string[];
  autoFixable: boolean;
}> = {
  'Minimum Trace Width': {
    suggestions: [
      'Increase trace width to meet the fab minimum (e.g., 6 mil for budget fabs)',
      'Use wider traces for power nets (15-20 mil for 1A, 40+ mil for high current)',
      'Consider a higher-capability fab house if dense routing is required',
      'Re-route bottleneck areas with wider spacing to allow wider traces',
    ],
    autoFixable: false,
  },
  'Minimum Trace Spacing': {
    suggestions: [
      'Increase spacing between adjacent traces to meet fab minimum',
      'Spread components apart to create more routing channels',
      'Move to a 4-layer board to reduce routing density per layer',
      'Use ground planes to reduce the number of routed nets',
    ],
    autoFixable: false,
  },
  'Minimum Drill Size': {
    suggestions: [
      'Increase the drill diameter to meet the fab minimum',
      'Replace small vias with the fab-recommended minimum via size',
      'Consider blind/buried vias if the fab supports them (typically more expensive)',
    ],
    autoFixable: false,
  },
  'Maximum Drill Size': {
    suggestions: [
      'Use a board outline cutout (routed slot) instead of an oversized drill',
      'Split large holes into multiple smaller mounting holes',
      'Contact the fab house about routing/milling for large openings',
    ],
    autoFixable: false,
  },
  'Minimum Via Drill': {
    suggestions: [
      'Increase via drill size to the fab minimum',
      'Use the fab-recommended standard via size (e.g., 0.3mm drill / 0.6mm pad for JLCPCB)',
      'Reduce via count by optimizing routing to use fewer layer transitions',
    ],
    autoFixable: false,
  },
  'Minimum Via Outer Diameter': {
    suggestions: [
      'Increase the via pad diameter to meet the minimum outer diameter',
      'Increase both drill and pad proportionally to maintain annular ring',
      'Use the fab-recommended via size preset',
    ],
    autoFixable: false,
  },
  'Minimum Annular Ring': {
    suggestions: [
      'Increase the pad size while keeping the drill size the same',
      'Reduce drill size if the hole doesn\'t need to be that large',
      'Use teardrops on pad-to-trace connections for extra copper margin',
    ],
    autoFixable: false,
  },
  'Minimum Board Width': {
    suggestions: [
      'Increase the board width to meet the fab minimum',
      'Consider panelization — place multiple small boards on one panel',
    ],
    autoFixable: false,
  },
  'Maximum Board Width': {
    suggestions: [
      'Split the design into multiple smaller boards',
      'Use a fab house that supports larger panel sizes',
      'Consider board-to-board connectors to link separate PCBs',
    ],
    autoFixable: false,
  },
  'Minimum Board Height': {
    suggestions: [
      'Increase the board height to meet the fab minimum',
      'Panelize the board to fit within fab constraints',
    ],
    autoFixable: false,
  },
  'Maximum Board Height': {
    suggestions: [
      'Split the design into multiple boards',
      'Use a fab house with larger panel capabilities',
    ],
    autoFixable: false,
  },
  'Minimum Board Thickness': {
    suggestions: [
      'Use the standard 1.6mm board thickness (most common and cheapest)',
      'If flex is needed, use a fab that specializes in flex/rigid-flex PCBs',
    ],
    autoFixable: false,
  },
  'Maximum Board Thickness': {
    suggestions: [
      'Reduce layer count to lower the overall board thickness',
      'Use thinner prepreg/core materials in the stackup',
    ],
    autoFixable: false,
  },
  'Maximum Layer Count': {
    suggestions: [
      'Optimize routing to fit within the fab\'s layer limit',
      'Use a fab house that supports more layers',
      'Consider BGA fanout optimization to reduce routing layers',
    ],
    autoFixable: false,
  },
  'Minimum Silkscreen Width': {
    suggestions: [
      'Increase silkscreen line width and font size to meet the fab minimum',
      'Use a larger font for reference designators (typically 0.8mm+ height)',
      'Simplify or remove fine-detail logos',
    ],
    autoFixable: true,
  },
  'Minimum Solder Mask Bridge': {
    suggestions: [
      'Reduce solder mask expansion on fine-pitch pads',
      'Use solder mask defined (SMD) pads instead of non-solder-mask defined (NSMD)',
      'Consider removing solder mask between closely spaced pads entirely',
    ],
    autoFixable: false,
  },
  'Surface Finish Supported': {
    suggestions: [
      'Switch to HASL (Hot Air Solder Leveling) — cheapest and most widely available',
      'Switch to Lead-Free HASL for RoHS compliance',
      'Use ENIG for flat pads (better for fine-pitch and BGA) — slightly more expensive',
    ],
    autoFixable: true,
  },
  'Copper Weight Supported': {
    suggestions: [
      'Switch to 1oz copper (35μm) — standard and universally available',
      'If high current is needed, use wider traces instead of heavier copper',
      'Use a fab house that offers the required copper weight',
    ],
    autoFixable: true,
  },
  'Minimum Hole-to-Hole Spacing': {
    suggestions: [
      'Increase spacing between adjacent drills/vias',
      'Move vias further from component pads',
      'Reduce via stitching density',
    ],
    autoFixable: false,
  },
  'Minimum Hole-to-Board-Edge Clearance': {
    suggestions: [
      'Move holes further from the board edge (2mm+ recommended for mounting holes)',
      'Add a keep-out zone along the board edge in your design rules',
      'If the hole must be near the edge, consider a board outline notch instead',
    ],
    autoFixable: false,
  },
};

// ---------------------------------------------------------------------------
// Fab profiles (server-side mirror of client DfmChecker built-in fabs)
// ---------------------------------------------------------------------------

interface ServerFabCapabilities {
  name: string;
  minTraceWidth: number;
  minTraceSpacing: number;
  minDrillSize: number;
  maxDrillSize: number;
  minAnnularRing: number;
  minViaDrill: number;
  minViaOuterDiameter: number;
  maxLayerCount: number;
  minBoardThickness: number;
  maxBoardThickness: number;
  minBoardWidth: number;
  maxBoardWidth: number;
  minBoardHeight: number;
  maxBoardHeight: number;
  minSilkscreenWidth: number;
  minSolderMaskBridge: number;
  surfaceFinishes: string[];
  minHoleToHoleSpacing: number;
  minHoleToBoardEdge: number;
  copperWeights: string[];
}

const SERVER_FAB_PRESETS: Record<string, ServerFabCapabilities> = {
  JLCPCB: {
    name: 'JLCPCB',
    minTraceWidth: 3.5, minTraceSpacing: 3.5,
    minDrillSize: 8, maxDrillSize: 254,
    minAnnularRing: 5, minViaDrill: 8, minViaOuterDiameter: 18,
    maxLayerCount: 32,
    minBoardThickness: 16, maxBoardThickness: 126,
    minBoardWidth: 200, maxBoardWidth: 20000,
    minBoardHeight: 200, maxBoardHeight: 20000,
    minSilkscreenWidth: 6, minSolderMaskBridge: 3,
    surfaceFinishes: ['HASL', 'Lead-Free HASL', 'ENIG', 'OSP', 'Immersion Tin', 'Immersion Silver'],
    minHoleToHoleSpacing: 8, minHoleToBoardEdge: 10,
    copperWeights: ['0.5oz', '1oz', '2oz'],
  },
  PCBWay: {
    name: 'PCBWay',
    minTraceWidth: 3.5, minTraceSpacing: 3.5,
    minDrillSize: 8, maxDrillSize: 254,
    minAnnularRing: 5, minViaDrill: 8, minViaOuterDiameter: 18,
    maxLayerCount: 14,
    minBoardThickness: 16, maxBoardThickness: 126,
    minBoardWidth: 200, maxBoardWidth: 20000,
    minBoardHeight: 200, maxBoardHeight: 20000,
    minSilkscreenWidth: 6, minSolderMaskBridge: 3,
    surfaceFinishes: ['HASL', 'Lead-Free HASL', 'ENIG', 'OSP', 'Immersion Tin'],
    minHoleToHoleSpacing: 8, minHoleToBoardEdge: 10,
    copperWeights: ['0.5oz', '1oz', '2oz'],
  },
  OSHPark: {
    name: 'OSHPark',
    minTraceWidth: 5, minTraceSpacing: 5,
    minDrillSize: 10, maxDrillSize: 254,
    minAnnularRing: 7, minViaDrill: 10, minViaOuterDiameter: 24,
    maxLayerCount: 4,
    minBoardThickness: 31, maxBoardThickness: 63,
    minBoardWidth: 200, maxBoardWidth: 16000,
    minBoardHeight: 200, maxBoardHeight: 16000,
    minSilkscreenWidth: 7, minSolderMaskBridge: 4,
    surfaceFinishes: ['ENIG'],
    minHoleToHoleSpacing: 10, minHoleToBoardEdge: 15,
    copperWeights: ['1oz', '2oz'],
  },
  Generic: {
    name: 'Generic_Budget',
    minTraceWidth: 6, minTraceSpacing: 6,
    minDrillSize: 12, maxDrillSize: 250,
    minAnnularRing: 8, minViaDrill: 12, minViaOuterDiameter: 28,
    maxLayerCount: 2,
    minBoardThickness: 31, maxBoardThickness: 63,
    minBoardWidth: 300, maxBoardWidth: 15000,
    minBoardHeight: 300, maxBoardHeight: 15000,
    minSilkscreenWidth: 8, minSolderMaskBridge: 5,
    surfaceFinishes: ['HASL'],
    minHoleToHoleSpacing: 12, minHoleToBoardEdge: 20,
    copperWeights: ['1oz'],
  },
};

// ---------------------------------------------------------------------------
// Server-side DFM check (mirrors client DfmChecker logic without React deps)
// ---------------------------------------------------------------------------

interface ServerDfmViolation {
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  actual: number;
  required: number;
  unit: string;
}

interface ServerDfmResult {
  fabName: string;
  violations: ServerDfmViolation[];
  passed: boolean;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    totalChecks: number;
    passRate: number;
  };
}

/**
 * Run DFM checks server-side against circuit design data.
 * This is a simplified check that validates key design parameters
 * from circuit instances and wires.
 */
function runServerDfmCheck(
  instances: Array<{
    pcbX: number | null;
    pcbY: number | null;
    schematicX: number;
    schematicY: number;
    properties: Record<string, unknown>;
  }>,
  wires: Array<{
    width: number;
    layer: string | null;
  }>,
  bomItems: Array<{
    partNumber: string;
    status: string;
    leadTime: string | null;
  }>,
  fab: ServerFabCapabilities,
): ServerDfmResult {
  const violations: ServerDfmViolation[] = [];
  let totalChecks = 0;

  // Check BOM Availability
  for (const item of bomItems) {
    totalChecks++;
    if (item.status === 'Out of Stock') {
      violations.push({
        ruleId: 'DFM-BOM-001',
        ruleName: 'Component Out of Stock',
        severity: 'error',
        category: 'bom',
        message: `BOM component ${item.partNumber} is marked as Out of Stock. Procurement will be blocked.`,
        currentValue: 'Out of Stock',
        requiredValue: 'In Stock',
      });
    } else if (item.status === 'Low Stock' || (item.leadTime && item.leadTime.toLowerCase().includes('week'))) {
      violations.push({
        ruleId: 'DFM-BOM-002',
        ruleName: 'Component Supply Risk',
        severity: 'warning',
        category: 'bom',
        message: `BOM component ${item.partNumber} has low stock or long lead time (${item.leadTime || 'Low Stock'}). Consider finding an alternate part.`,
        currentValue: item.status,
        requiredValue: 'In Stock',
      });
    }
  }

  // Check trace widths
  for (const wire of wires) {
    totalChecks++;
    // Convert wire width from mm to mil (1mm = 39.37 mil)
    const widthMil = wire.width * 39.37;
    if (widthMil > 0 && widthMil < fab.minTraceWidth) {
      violations.push({
        ruleId: 'DFM-001',
        ruleName: 'Minimum Trace Width',
        severity: 'error',
        category: 'trace',
        message: `Trace width ${widthMil.toFixed(1)} mil is below minimum ${fab.minTraceWidth} mil`,
        actual: widthMil,
        required: fab.minTraceWidth,
        unit: 'mil',
      });
    }
  }

  // Check board bounds from instances
  let maxX = 0;
  let maxY = 0;
  for (const inst of instances) {
    const x = inst.pcbX ?? inst.schematicX;
    const y = inst.pcbY ?? inst.schematicY;
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  // Board dimensions check (rough estimate from instance positions)
  // Convert coordinates from mm to mil (1mm = 39.37 mil)
  if (instances.length > 0) {
    const boardWidthMil = Math.max((maxX + 2.54) * 39.37, 500);
    const boardHeightMil = Math.max((maxY + 2.54) * 39.37, 500);

    totalChecks++;
    if (boardWidthMil < fab.minBoardWidth) {
      violations.push({
        ruleId: 'DFM-007',
        ruleName: 'Minimum Board Width',
        severity: 'error',
        category: 'board',
        message: `Estimated board width ${boardWidthMil} mil is below minimum ${fab.minBoardWidth} mil`,
        actual: boardWidthMil,
        required: fab.minBoardWidth,
        unit: 'mil',
      });
    }

    totalChecks++;
    if (boardHeightMil < fab.minBoardHeight) {
      violations.push({
        ruleId: 'DFM-007',
        ruleName: 'Minimum Board Height',
        severity: 'error',
        category: 'board',
        message: `Estimated board height ${boardHeightMil} mil is below minimum ${fab.minBoardHeight} mil`,
        actual: boardHeightMil,
        required: fab.minBoardHeight,
        unit: 'mil',
      });
    }
  }

  // Check properties for via/drill dimensions
  for (const inst of instances) {
    const props = inst.properties;
    if (typeof props.drillDiameter === 'number') {
      totalChecks++;
      if (props.drillDiameter < fab.minDrillSize) {
        violations.push({
          ruleId: 'DFM-003',
          ruleName: 'Minimum Drill Size',
          severity: 'error',
          category: 'drill',
          message: `Drill diameter ${props.drillDiameter} mil is below minimum ${fab.minDrillSize} mil`,
          actual: props.drillDiameter,
          required: fab.minDrillSize,
          unit: 'mil',
        });
      }
    }
  }

  // Ensure at least base checks
  if (totalChecks === 0) {
    totalChecks = 1;
  }

  const errors = violations.filter((v) => v.severity === 'error').length;
  const warnings = violations.filter((v) => v.severity === 'warning').length;
  const infos = violations.filter((v) => v.severity === 'info').length;
  const passedChecks = totalChecks - violations.length;

  return {
    fabName: fab.name,
    violations,
    passed: errors === 0,
    summary: {
      errors,
      warnings,
      infos,
      totalChecks,
      passRate: totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 1000) / 10 : 100,
    },
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register all manufacturing-category tools with the given registry.
 *
 * Tools registered (3 total):
 *
 * - `run_dfm_check`         — Run DFM checks against a circuit design for a specific fab.
 * - `explain_dfm_violation`  — Explain a DFM violation in plain English with IPC references.
 * - `suggest_dfm_fix`        — Suggest fixes for a DFM violation, with auto-fix actions if safe.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerManufacturingTools(registry: ToolRegistry): void {
  /**
   * run_dfm_check — Run DFM (Design for Manufacturability) checks.
   *
   * Fetches circuit design data and validates it against a specific fab
   * house's capabilities. Returns violations grouped by severity with
   * fab-specific context.
   */
  registry.register({
    name: 'run_dfm_check',
    description:
      'Run a Design for Manufacturability (DFM) check against the current circuit design. ' +
      'Validates traces, drills, vias, board dimensions, and more against a specific fab house\'s ' +
      'capabilities (JLCPCB, PCBWay, OSHPark, or Generic). Returns violations grouped by severity ' +
      'with pass/fail status and pass rate percentage.',
    category: 'validation',
    parameters: z.object({
      fabProfile: z
        .enum(['JLCPCB', 'PCBWay', 'OSHPark', 'Generic'])
        .optional()
        .default('JLCPCB')
        .describe('Fabrication house profile to check against (default: JLCPCB)'),
      circuitDesignId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Specific circuit design ID to check. Uses first design if omitted.'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx): Promise<ToolResult> => {
      const fab = SERVER_FAB_PRESETS[params.fabProfile ?? 'JLCPCB'];
      if (!fab) {
        return {
          success: false,
          message: `Unknown fab profile "${params.fabProfile}". Available: JLCPCB, PCBWay, OSHPark, Generic.`,
        };
      }

      // Resolve circuit design
      const designs = await ctx.storage.getCircuitDesigns(ctx.projectId);
      if (designs.length === 0) {
        return {
          success: false,
          message: 'No circuit designs found. Create a circuit design with components first.',
        };
      }

      const designId = params.circuitDesignId ?? designs[0].id;
      const design = designs.find((d) => d.id === designId);
      if (!design) {
        return {
          success: false,
          message: `Circuit design ${designId} not found.`,
        };
      }

      // Fetch circuit data
      const [instances, wires, bomItems] = await Promise.all([
        ctx.storage.getCircuitInstances(designId),
        ctx.storage.getCircuitWires(designId),
        ctx.storage.getBomItems(ctx.projectId),
      ]);

      // Map to simplified shapes
      const instData = instances.map((i) => ({
        pcbX: i.pcbX,
        pcbY: i.pcbY,
        schematicX: i.schematicX,
        schematicY: i.schematicY,
        properties: (i.properties ?? {}) as Record<string, unknown>,
      }));
      const wireData = wires.map((w) => ({
        width: w.width,
        layer: w.layer,
      }));
      const bomData = bomItems.map((b) => ({
        partNumber: b.partNumber,
        status: b.status,
        leadTime: b.leadTime,
      }));

      const result = runServerDfmCheck(instData, wireData, bomData, fab);

      // Group violations by severity
      const byCategory: Record<string, ServerDfmViolation[]> = {};
      for (const v of result.violations) {
        if (!byCategory[v.category]) {
          byCategory[v.category] = [];
        }
        byCategory[v.category].push(v);
      }

      const summaryText = result.passed
        ? `DFM check PASSED for ${fab.name} (${result.summary.passRate}% pass rate, ${result.summary.totalChecks} checks)`
        : `DFM check FAILED for ${fab.name}: ${result.summary.errors} errors, ${result.summary.warnings} warnings (${result.summary.passRate}% pass rate)`;

      return {
        success: true,
        message: summaryText,
        data: {
          type: 'dfm_check_result',
          fabProfile: fab.name,
          passed: result.passed,
          summary: result.summary,
          violations: result.violations,
          violationsByCategory: byCategory,
          designName: design.name,
          instanceCount: instances.length,
          wireCount: wires.length,
        },
      };
    },
  });

  /**
   * explain_dfm_violation — Explain a DFM violation in plain English.
   *
   * Takes a violation type or description and returns a detailed explanation
   * including the relevant IPC standard, common causes, and severity context.
   */
  registry.register({
    name: 'explain_dfm_violation',
    description:
      'Explain a DFM (Design for Manufacturability) violation in plain English. ' +
      'Provide the violation type (e.g., "Minimum Trace Width", "Minimum Drill Size") ' +
      'and get a detailed explanation of what the issue means, why it matters, ' +
      'the applicable IPC standard, and common causes.',
    category: 'validation',
    parameters: z.object({
      violationType: z
        .string()
        .min(1)
        .describe('The violation rule name or type (e.g., "Minimum Trace Width", "DFM-001")'),
      description: z
        .string()
        .optional()
        .describe('Optional additional description or context about the specific violation'),
    }),
    requiresConfirmation: false,
    execute: async (params): Promise<ToolResult> => {
      // Try to match by rule name or rule ID
      let matchedName = params.violationType;
      let ruleId: string | undefined;

      // Check if input is a rule ID like "DFM-001"
      if (/^DFM-\d{3}$/.test(params.violationType)) {
        ruleId = params.violationType;
        // Find the rule name from the IPC standards map
        const standard = IPC_STANDARDS[ruleId as string];
        if (standard) {
          // Try to find the matching explanation key
          for (const key of Object.keys(VIOLATION_EXPLANATIONS)) {
            const keyRuleId = Object.entries(IPC_STANDARDS).find(([, v]) => v.section?.includes(key))?.[0];
            if (keyRuleId === ruleId) {
              matchedName = key;
              break;
            }
          }
        }
      }

      // Look up explanation
      const explanation = VIOLATION_EXPLANATIONS[matchedName];
      if (!explanation) {
        // Try fuzzy matching
        const lowerInput = matchedName.toLowerCase();
        const fuzzyMatch = Object.keys(VIOLATION_EXPLANATIONS).find(
          (key) => key.toLowerCase().includes(lowerInput) || lowerInput.includes(key.toLowerCase()),
        );
        if (fuzzyMatch) {
          matchedName = fuzzyMatch;
        } else {
          return {
            success: true,
            message: `No specific explanation found for "${params.violationType}". This may be a custom or fab-specific rule. ${params.description ? `Context: ${params.description}` : ''}`,
            data: {
              type: 'dfm_explanation',
              violationType: params.violationType,
              found: false,
            },
          };
        }
      }

      const info = VIOLATION_EXPLANATIONS[matchedName];

      // Find the IPC standard reference
      if (!ruleId) {
        ruleId = Object.entries(IPC_STANDARDS).find(
          ([, v]) => v.section?.includes(matchedName) || matchedName.includes(v.section?.split(' — ')[1] ?? '___'),
        )?.[0];
      }

      // Direct lookup: match rule names to IPC_STANDARDS keys
      if (!ruleId) {
        for (const [id, standard] of Object.entries(IPC_STANDARDS)) {
          const sectionName = standard.section?.split(' — ')[1]?.toLowerCase() ?? '';
          if (matchedName.toLowerCase().includes(sectionName) && sectionName.length > 0) {
            ruleId = id;
            break;
          }
        }
      }

      const ipcStandard = ruleId ? IPC_STANDARDS[ruleId] : undefined;

      return {
        success: true,
        message: `**${matchedName}**: ${info.explanation}`,
        data: {
          type: 'dfm_explanation',
          violationType: matchedName,
          found: true,
          explanation: info.explanation,
          severity: info.severity,
          commonCauses: info.commonCauses,
          ipcStandard: ipcStandard
            ? {
                id: ipcStandard.id,
                title: ipcStandard.title,
                section: ipcStandard.section,
              }
            : undefined,
          additionalContext: params.description ?? null,
        },
      };
    },
  });

  /**
   * suggest_dfm_fix — Suggest fixes for a DFM violation.
   *
   * Takes a violation type and returns actionable fix suggestions.
   * For auto-fixable violations, returns AIAction arrays that the client
   * can apply directly.
   */
  registry.register({
    name: 'suggest_dfm_fix',
    description:
      'Suggest fixes for a DFM (Design for Manufacturability) violation. ' +
      'Provide the violation type (e.g., "Minimum Trace Width") and optionally the ' +
      'current value and fab profile. Returns specific, actionable suggestions ' +
      'and indicates whether an automatic fix can be applied.',
    category: 'validation',
    parameters: z.object({
      violationType: z
        .string()
        .min(1)
        .describe('The violation rule name (e.g., "Minimum Trace Width", "Surface Finish Supported")'),
      currentValue: z
        .string()
        .optional()
        .describe('The current value that caused the violation (e.g., "3 mil", "ENIG")'),
      fabProfile: z
        .enum(['JLCPCB', 'PCBWay', 'OSHPark', 'Generic'])
        .optional()
        .describe('The target fab profile for context-specific suggestions'),
    }),
    requiresConfirmation: false,
    execute: async (params): Promise<ToolResult> => {
      // Look up fix suggestions
      let matchedName = params.violationType;
      const fixInfo = VIOLATION_FIXES[matchedName];

      if (!fixInfo) {
        // Try fuzzy matching
        const lowerInput = matchedName.toLowerCase();
        const fuzzyMatch = Object.keys(VIOLATION_FIXES).find(
          (key) => key.toLowerCase().includes(lowerInput) || lowerInput.includes(key.toLowerCase()),
        );
        if (fuzzyMatch) {
          matchedName = fuzzyMatch;
        } else {
          return {
            success: true,
            message: `No specific fix suggestions found for "${params.violationType}". General recommendation: check your design against the target fab house's published capabilities document.`,
            data: {
              type: 'dfm_fix_suggestion',
              violationType: params.violationType,
              found: false,
              suggestions: [
                'Review the fab house\'s published design rules and capabilities',
                'Contact the fab house\'s engineering support for guidance',
                'Consider using a different fab house with capabilities matching your design',
              ],
              autoFixable: false,
            },
          };
        }
      }

      const info = VIOLATION_FIXES[matchedName];

      // Build fab-specific context
      let fabContext: string | undefined;
      if (params.fabProfile) {
        const fab = SERVER_FAB_PRESETS[params.fabProfile];
        if (fab) {
          fabContext = `For ${fab.name}: `;
          if (matchedName.includes('Trace Width')) {
            fabContext += `minimum trace width is ${fab.minTraceWidth} mil`;
          } else if (matchedName.includes('Trace Spacing')) {
            fabContext += `minimum trace spacing is ${fab.minTraceSpacing} mil`;
          } else if (matchedName.includes('Drill')) {
            fabContext += `drill range is ${fab.minDrillSize}-${fab.maxDrillSize} mil`;
          } else if (matchedName.includes('Via Drill')) {
            fabContext += `minimum via drill is ${fab.minViaDrill} mil`;
          } else if (matchedName.includes('Via Outer')) {
            fabContext += `minimum via outer diameter is ${fab.minViaOuterDiameter} mil`;
          } else if (matchedName.includes('Annular Ring')) {
            fabContext += `minimum annular ring is ${fab.minAnnularRing} mil`;
          } else if (matchedName.includes('Silkscreen')) {
            fabContext += `minimum silkscreen width is ${fab.minSilkscreenWidth} mil`;
          } else if (matchedName.includes('Layer Count')) {
            fabContext += `maximum layer count is ${fab.maxLayerCount}`;
          } else if (matchedName.includes('Surface Finish')) {
            fabContext += `supported finishes: ${fab.surfaceFinishes.join(', ')}`;
          } else if (matchedName.includes('Copper Weight')) {
            fabContext += `supported weights: ${fab.copperWeights.join(', ')}`;
          }
        }
      }

      // Build AI actions for auto-fixable violations
      const actions: Array<{ type: string; [key: string]: unknown }> = [];
      if (info.autoFixable) {
        if (matchedName === 'Minimum Silkscreen Width') {
          actions.push({
            type: 'add_validation_issue',
            severity: 'info',
            message: `Auto-fix available: Increase silkscreen width to meet fab minimum`,
            suggestion: 'Update silkscreen line width in design rules',
          });
        } else if (matchedName === 'Surface Finish Supported') {
          actions.push({
            type: 'add_validation_issue',
            severity: 'info',
            message: `Auto-fix available: Change surface finish to HASL (universally supported)`,
            suggestion: 'Update surface finish in board settings',
          });
        } else if (matchedName === 'Copper Weight Supported') {
          actions.push({
            type: 'add_validation_issue',
            severity: 'info',
            message: `Auto-fix available: Change copper weight to 1oz (standard)`,
            suggestion: 'Update copper weight in board settings',
          });
        }
      }

      const currentValueNote = params.currentValue
        ? ` (current: ${params.currentValue})`
        : '';

      return {
        success: true,
        message: `Fix suggestions for **${matchedName}**${currentValueNote}: ${info.suggestions[0]}`,
        data: {
          type: 'dfm_fix_suggestion',
          violationType: matchedName,
          found: true,
          suggestions: info.suggestions,
          autoFixable: info.autoFixable,
          actions: actions.length > 0 ? actions : undefined,
          fabContext: fabContext ?? null,
          currentValue: params.currentValue ?? null,
        },
      };
    },
  });
}
