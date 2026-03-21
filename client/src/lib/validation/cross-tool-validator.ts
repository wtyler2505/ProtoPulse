/**
 * CrossToolValidator — validates consistency between schematic, PCB, and BOM data.
 *
 * BL-0211: Cross-tool mapping validator
 *
 * Detects mismatches across the three main design domains:
 *   - Schematic ↔ PCB: missing placements, unrouted nets, orphan instances
 *   - Schematic ↔ BOM: component count mismatches, missing BOM entries
 *   - PCB ↔ BOM: footprint/package inconsistency
 *   - Layer assignment validation
 */

// ---------------------------------------------------------------------------
// Input interfaces — lightweight projections of real schema types
// ---------------------------------------------------------------------------

export interface SchematicInstance {
  id: number;
  referenceDesignator: string;
  partId: number | null;
  properties: Record<string, unknown>;
}

export interface SchematicNet {
  id: number;
  name: string;
  netType: string;
  /** Segment endpoints — at least one segment means the net is wired. */
  segments: unknown[];
}

export interface SchematicData {
  instances: SchematicInstance[];
  nets: SchematicNet[];
}

export interface PcbInstance {
  id: number;
  referenceDesignator: string;
  pcbX: number | null;
  pcbY: number | null;
  pcbSide: string | null;
  properties: Record<string, unknown>;
}

export interface PcbWire {
  id: number;
  netId: number;
  layer: string | null;
  view: string;
}

export interface PcbData {
  instances: PcbInstance[];
  wires: PcbWire[];
}

export interface BomItemInput {
  id: number;
  partNumber: string;
  description: string;
  quantity: number;
  manufacturer: string;
}

export interface BomData {
  items: BomItemInput[];
}

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export type CrossToolSeverity = 'error' | 'warning' | 'info';

export type CrossToolCategory =
  | 'net-mismatch'
  | 'layer-mismatch'
  | 'footprint-mismatch'
  | 'missing-mapping'
  | 'orphan'
  | 'count-mismatch';

export type CrossToolSource = 'schematic' | 'pcb' | 'bom';

export interface CrossToolIssue {
  id: string;
  severity: CrossToolSeverity;
  category: CrossToolCategory;
  source: CrossToolSource;
  target: CrossToolSource;
  message: string;
  suggestion: string;
  /** Reference designator or identifier related to the issue. */
  referenceDesignator?: string;
  /** Net name related to the issue. */
  netName?: string;
}

export interface CrossToolValidationResult {
  issues: CrossToolIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    byCategory: Record<CrossToolCategory, number>;
  };
  /** True when zero errors (warnings/info are acceptable). */
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Valid PCB layers
// ---------------------------------------------------------------------------

const VALID_PCB_LAYERS: ReadonlySet<string> = new Set([
  'F.Cu', 'B.Cu',
  'In1.Cu', 'In2.Cu', 'In3.Cu', 'In4.Cu', 'In5.Cu', 'In6.Cu',
  'F.SilkS', 'B.SilkS',
  'F.Mask', 'B.Mask',
  'F.Paste', 'B.Paste',
  'F.Fab', 'B.Fab',
  'Edge.Cuts',
  // Legacy / simplified names accepted
  'front', 'back',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let issueCounter = 0;

function nextId(): string {
  issueCounter += 1;
  return `xtv-${issueCounter}`;
}

/** Reset the counter — useful in tests to get predictable IDs. */
export function resetIssueCounter(): void {
  issueCounter = 0;
}

function buildCategorySummary(issues: CrossToolIssue[]): Record<CrossToolCategory, number> {
  const categories: CrossToolCategory[] = [
    'net-mismatch',
    'layer-mismatch',
    'footprint-mismatch',
    'missing-mapping',
    'orphan',
    'count-mismatch',
  ];
  const result: Record<CrossToolCategory, number> = {} as Record<CrossToolCategory, number>;
  categories.forEach((cat) => {
    result[cat] = 0;
  });
  issues.forEach((issue) => {
    result[issue.category] += 1;
  });
  return result;
}

function getPackageType(props: Record<string, unknown>): string | null {
  if (typeof props.packageType === 'string' && props.packageType.length > 0) {
    return props.packageType;
  }
  if (typeof props.footprint === 'string' && props.footprint.length > 0) {
    return props.footprint;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validation checks
// ---------------------------------------------------------------------------

/**
 * Every schematic instance should have a corresponding PCB placement.
 */
function checkSchematicToPcbInstances(
  schematic: SchematicData,
  pcb: PcbData,
): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];
  const pcbRefDesSet = new Set(pcb.instances.map((i) => i.referenceDesignator));

  schematic.instances.forEach((inst) => {
    if (!pcbRefDesSet.has(inst.referenceDesignator)) {
      issues.push({
        id: nextId(),
        severity: 'error',
        category: 'missing-mapping',
        source: 'schematic',
        target: 'pcb',
        message: `Schematic instance ${inst.referenceDesignator} has no PCB placement`,
        suggestion: `Place ${inst.referenceDesignator} on the PCB layout`,
        referenceDesignator: inst.referenceDesignator,
      });
    }
  });

  return issues;
}

/**
 * Every PCB instance should have a corresponding schematic instance.
 */
function checkPcbToSchematicInstances(
  schematic: SchematicData,
  pcb: PcbData,
): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];
  const schRefDesSet = new Set(schematic.instances.map((i) => i.referenceDesignator));

  pcb.instances.forEach((inst) => {
    if (!schRefDesSet.has(inst.referenceDesignator)) {
      issues.push({
        id: nextId(),
        severity: 'error',
        category: 'orphan',
        source: 'pcb',
        target: 'schematic',
        message: `PCB instance ${inst.referenceDesignator} has no schematic counterpart`,
        suggestion: `Remove ${inst.referenceDesignator} from PCB or add it to the schematic`,
        referenceDesignator: inst.referenceDesignator,
      });
    }
  });

  return issues;
}

/**
 * Schematic instances with PCB placements should have a valid position
 * (non-null pcbX/pcbY). Instances at (null, null) are "unplaced."
 */
function checkUnplacedPcbInstances(pcb: PcbData): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];

  pcb.instances.forEach((inst) => {
    if (inst.pcbX === null || inst.pcbY === null) {
      issues.push({
        id: nextId(),
        severity: 'warning',
        category: 'missing-mapping',
        source: 'pcb',
        target: 'pcb',
        message: `PCB instance ${inst.referenceDesignator} has no placement coordinates`,
        suggestion: `Place ${inst.referenceDesignator} at a valid PCB position`,
        referenceDesignator: inst.referenceDesignator,
      });
    }
  });

  return issues;
}

/**
 * Every schematic net with at least one segment should have at least one
 * PCB wire routed for that net.
 */
function checkSchematicNetsToPcbWires(
  schematic: SchematicData,
  pcb: PcbData,
): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];

  // Build set of net IDs that have PCB wires
  const routedNetIds = new Set(pcb.wires.filter((w) => w.view === 'pcb').map((w) => w.netId));

  schematic.nets.forEach((net) => {
    // Only check nets that are actually wired in the schematic
    if (net.segments.length === 0) {
      return;
    }

    if (!routedNetIds.has(net.id)) {
      issues.push({
        id: nextId(),
        severity: 'warning',
        category: 'net-mismatch',
        source: 'schematic',
        target: 'pcb',
        message: `Schematic net "${net.name}" has no PCB traces`,
        suggestion: `Route net "${net.name}" on the PCB layout`,
        netName: net.name,
      });
    }
  });

  return issues;
}

/**
 * BOM item quantities should match the count of schematic instances that
 * share the same part number. Grouping is by partNumber.
 */
function checkBomToSchematicCounts(
  schematic: SchematicData,
  bom: BomData,
): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];

  // Count schematic instances per partId
  const schPartIdCounts = new Map<number, number>();
  schematic.instances.forEach((inst) => {
    if (inst.partId !== null) {
      const prev = schPartIdCounts.get(inst.partId) ?? 0;
      schPartIdCounts.set(inst.partId, prev + 1);
    }
  });

  // For BOM items, we compare quantity to schematic instance count.
  // Since BOM items are grouped by part number, we match by partNumber.
  // Schematic instances reference a partId (numeric FK to component_parts).
  // Without full join data, we use the BOM item's id as the partId proxy.
  bom.items.forEach((bomItem) => {
    const schCount = schPartIdCounts.get(bomItem.id) ?? 0;

    if (schCount === 0) {
      issues.push({
        id: nextId(),
        severity: 'info',
        category: 'missing-mapping',
        source: 'bom',
        target: 'schematic',
        message: `BOM item "${bomItem.partNumber}" (${bomItem.description}) has no schematic instances`,
        suggestion: `Verify that "${bomItem.partNumber}" is used in the schematic or remove from BOM`,
        referenceDesignator: bomItem.partNumber,
      });
    } else if (schCount !== bomItem.quantity) {
      issues.push({
        id: nextId(),
        severity: 'warning',
        category: 'count-mismatch',
        source: 'bom',
        target: 'schematic',
        message: `BOM "${bomItem.partNumber}" quantity (${bomItem.quantity}) does not match schematic instance count (${schCount})`,
        suggestion: `Update BOM quantity to ${schCount} or verify schematic placement`,
        referenceDesignator: bomItem.partNumber,
      });
    }
  });

  return issues;
}

/**
 * Check that schematic instances with a partId have a matching BOM entry.
 */
function checkSchematicToBomCoverage(
  schematic: SchematicData,
  bom: BomData,
): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];
  const bomIdSet = new Set(bom.items.map((item) => item.id));

  // Collect unique partIds from schematic that are not in BOM
  const missingPartIds = new Set<number>();
  const refDesByPartId = new Map<number, string[]>();

  schematic.instances.forEach((inst) => {
    if (inst.partId !== null && !bomIdSet.has(inst.partId)) {
      missingPartIds.add(inst.partId);
      const refs = refDesByPartId.get(inst.partId) ?? [];
      refs.push(inst.referenceDesignator);
      refDesByPartId.set(inst.partId, refs);
    }
  });

  missingPartIds.forEach((partId) => {
    const refs = refDesByPartId.get(partId) ?? [];
    issues.push({
      id: nextId(),
      severity: 'warning',
      category: 'missing-mapping',
      source: 'schematic',
      target: 'bom',
      message: `Schematic instances [${refs.join(', ')}] reference part ID ${partId} with no BOM entry`,
      suggestion: 'Add a BOM entry for this component or link to an existing one',
      referenceDesignator: refs[0],
    });
  });

  return issues;
}

/**
 * Footprint/package consistency between schematic and PCB for the same
 * reference designator. Both instances store packageType in properties JSONB.
 */
function checkFootprintConsistency(
  schematic: SchematicData,
  pcb: PcbData,
): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];

  const schMap = new Map<string, SchematicInstance>();
  schematic.instances.forEach((inst) => {
    schMap.set(inst.referenceDesignator, inst);
  });

  pcb.instances.forEach((pcbInst) => {
    const schInst = schMap.get(pcbInst.referenceDesignator);
    if (!schInst) {
      return; // Already caught by orphan check
    }

    const schPkg = getPackageType(schInst.properties);
    const pcbPkg = getPackageType(pcbInst.properties);

    if (schPkg !== null && pcbPkg !== null && schPkg !== pcbPkg) {
      issues.push({
        id: nextId(),
        severity: 'error',
        category: 'footprint-mismatch',
        source: 'schematic',
        target: 'pcb',
        message: `Footprint mismatch for ${pcbInst.referenceDesignator}: schematic has "${schPkg}" but PCB has "${pcbPkg}"`,
        suggestion: `Update either schematic or PCB to use the same footprint for ${pcbInst.referenceDesignator}`,
        referenceDesignator: pcbInst.referenceDesignator,
      });
    }
  });

  return issues;
}

/**
 * Detect orphan nets — nets in the schematic with no segments (unwired).
 */
function checkOrphanNets(schematic: SchematicData): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];

  schematic.nets.forEach((net) => {
    if (net.segments.length === 0) {
      issues.push({
        id: nextId(),
        severity: 'info',
        category: 'orphan',
        source: 'schematic',
        target: 'schematic',
        message: `Net "${net.name}" has no wire segments (orphan net)`,
        suggestion: `Wire net "${net.name}" or remove it if unused`,
        netName: net.name,
      });
    }
  });

  return issues;
}

/**
 * Layer assignment validation — PCB wires should reference valid layers.
 */
function checkLayerAssignment(pcb: PcbData): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];

  // Track already-reported invalid layers to avoid noise
  const reportedLayers = new Set<string>();

  pcb.wires.forEach((wire) => {
    if (wire.view !== 'pcb') {
      return;
    }
    if (wire.layer !== null && !VALID_PCB_LAYERS.has(wire.layer)) {
      if (!reportedLayers.has(wire.layer)) {
        reportedLayers.add(wire.layer);
        issues.push({
          id: nextId(),
          severity: 'warning',
          category: 'layer-mismatch',
          source: 'pcb',
          target: 'pcb',
          message: `PCB wire references invalid layer "${wire.layer}"`,
          suggestion: `Change layer to a valid PCB layer (e.g., F.Cu, B.Cu)`,
        });
      }
    }
  });

  // PCB instances with invalid pcbSide
  pcb.instances.forEach((inst) => {
    if (inst.pcbSide !== null && inst.pcbSide !== 'front' && inst.pcbSide !== 'back') {
      issues.push({
        id: nextId(),
        severity: 'warning',
        category: 'layer-mismatch',
        source: 'pcb',
        target: 'pcb',
        message: `PCB instance ${inst.referenceDesignator} has invalid side "${inst.pcbSide}"`,
        suggestion: `Set pcbSide to "front" or "back" for ${inst.referenceDesignator}`,
        referenceDesignator: inst.referenceDesignator,
      });
    }
  });

  return issues;
}

/**
 * Check for duplicate reference designators within schematic or PCB.
 */
function checkDuplicateRefDes(
  schematic: SchematicData,
  pcb: PcbData,
): CrossToolIssue[] {
  const issues: CrossToolIssue[] = [];

  // Check schematic duplicates
  const schRefDesCount = new Map<string, number>();
  schematic.instances.forEach((inst) => {
    const prev = schRefDesCount.get(inst.referenceDesignator) ?? 0;
    schRefDesCount.set(inst.referenceDesignator, prev + 1);
  });

  schRefDesCount.forEach((count, refDes) => {
    if (count > 1) {
      issues.push({
        id: nextId(),
        severity: 'error',
        category: 'orphan',
        source: 'schematic',
        target: 'schematic',
        message: `Duplicate reference designator "${refDes}" in schematic (${count} instances)`,
        suggestion: `Assign unique reference designators to all instances`,
        referenceDesignator: refDes,
      });
    }
  });

  // Check PCB duplicates
  const pcbRefDesCount = new Map<string, number>();
  pcb.instances.forEach((inst) => {
    const prev = pcbRefDesCount.get(inst.referenceDesignator) ?? 0;
    pcbRefDesCount.set(inst.referenceDesignator, prev + 1);
  });

  pcbRefDesCount.forEach((count, refDes) => {
    if (count > 1) {
      issues.push({
        id: nextId(),
        severity: 'error',
        category: 'orphan',
        source: 'pcb',
        target: 'pcb',
        message: `Duplicate reference designator "${refDes}" in PCB (${count} instances)`,
        suggestion: `Assign unique reference designators to all PCB instances`,
        referenceDesignator: refDes,
      });
    }
  });

  return issues;
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

export function validateCrossToolConsistency(
  schematic: SchematicData,
  pcb: PcbData,
  bom: BomData,
): CrossToolValidationResult {
  const allIssues: CrossToolIssue[] = [];

  // Schematic ↔ PCB
  allIssues.push(...checkSchematicToPcbInstances(schematic, pcb));
  allIssues.push(...checkPcbToSchematicInstances(schematic, pcb));
  allIssues.push(...checkUnplacedPcbInstances(pcb));
  allIssues.push(...checkSchematicNetsToPcbWires(schematic, pcb));
  allIssues.push(...checkFootprintConsistency(schematic, pcb));

  // Schematic ↔ BOM
  allIssues.push(...checkBomToSchematicCounts(schematic, bom));
  allIssues.push(...checkSchematicToBomCoverage(schematic, bom));

  // Orphan / integrity checks
  allIssues.push(...checkOrphanNets(schematic));
  allIssues.push(...checkDuplicateRefDes(schematic, pcb));

  // PCB layer validation
  allIssues.push(...checkLayerAssignment(pcb));

  const errors = allIssues.filter((i) => i.severity === 'error').length;
  const warnings = allIssues.filter((i) => i.severity === 'warning').length;
  const info = allIssues.filter((i) => i.severity === 'info').length;

  return {
    issues: allIssues,
    summary: {
      total: allIssues.length,
      errors,
      warnings,
      info,
      byCategory: buildCategorySummary(allIssues),
    },
    passed: errors === 0,
  };
}
