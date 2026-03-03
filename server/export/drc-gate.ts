/**
 * DRC Safety Gate (Phase 12.10a)
 *
 * Before generating manufacturing outputs (Gerber, drill, pick-and-place),
 * the PCB layout must pass a DRC check. This module provides a pre-export
 * validation gate that enforces this requirement.
 *
 * Each DRC rule is implemented as a standalone function that receives the
 * input context and pushes violations to a shared array. `runDrcGate`
 * orchestrates them in sequence and summarises the result.
 */

export interface DrcViolation {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  location?: { x: number; y: number };
}

export interface DrcGateResult {
  passed: boolean;
  errors: number;
  warnings: number;
  violations: DrcViolation[];
  message: string;
}

export interface DrcGateInput {
  instances: Array<{
    id: number;
    referenceDesignator: string;
    pcbX: number | null;
    pcbY: number | null;
    pcbSide: string | null;
    connectors: Array<{ id: string; padType?: string }>;
  }>;
  nets: Array<{
    id: number;
    name: string;
    segments: Array<{
      fromInstanceId: number;
      fromPin: string;
      toInstanceId: number;
      toPin: string;
    }>;
  }>;
  wires: Array<{
    netId: number;
    view: string;
    layer: string;
    points: Array<{ x: number; y: number }>;
    width: number;
  }>;
  boardWidth: number;
  boardHeight: number;
  clearance?: number;      // mm, default 0.2
  minTraceWidth?: number;  // mm, default 0.15
}

// ---------------------------------------------------------------------------
// Resolved parameters shared across rule functions
// ---------------------------------------------------------------------------

interface DrcContext {
  input: DrcGateInput;
  violations: DrcViolation[];
  clearance: number;
  minTraceWidth: number;
  pcbWires: DrcGateInput['wires'];
}

// ---------------------------------------------------------------------------
// Individual DRC rule functions
// ---------------------------------------------------------------------------

/**
 * Check that every instance has been placed on the PCB (non-null coordinates).
 * Also checks that placed instances are within board bounds.
 */
function checkComponentPlacement(ctx: DrcContext): void {
  for (const inst of ctx.input.instances) {
    if (inst.pcbX == null || inst.pcbY == null) {
      ctx.violations.push({
        severity: 'error',
        rule: 'unplaced-component',
        message: `${inst.referenceDesignator} has no PCB placement`,
      });
      continue;
    }

    if (inst.pcbX < 0 || inst.pcbY < 0 ||
        inst.pcbX > ctx.input.boardWidth || inst.pcbY > ctx.input.boardHeight) {
      ctx.violations.push({
        severity: 'warning',
        rule: 'out-of-bounds',
        message: `${inst.referenceDesignator} is outside board outline (${inst.pcbX.toFixed(1)}, ${inst.pcbY.toFixed(1)})`,
        location: { x: inst.pcbX, y: inst.pcbY },
      });
    }
  }
}

/**
 * Check that every net with logical segments has at least one PCB trace routed.
 */
function checkUnroutedNets(ctx: DrcContext): void {
  const routedNetIds = new Set<number>();
  for (const wire of ctx.pcbWires) {
    routedNetIds.add(wire.netId);
  }

  for (const net of ctx.input.nets) {
    if (net.segments.length > 0 && !routedNetIds.has(net.id)) {
      ctx.violations.push({
        severity: 'error',
        rule: 'unrouted-net',
        message: `Net "${net.name}" has no PCB traces`,
      });
    }
  }
}

/**
 * Check that no PCB trace is narrower than the minimum allowed width.
 */
function checkMinTraceWidth(ctx: DrcContext): void {
  for (const wire of ctx.pcbWires) {
    if (wire.width < ctx.minTraceWidth) {
      const startPt = wire.points[0];
      ctx.violations.push({
        severity: 'error',
        rule: 'min-trace-width',
        message: `Trace width ${wire.width.toFixed(3)}mm is below minimum ${ctx.minTraceWidth}mm`,
        location: startPt ? { x: startPt.x, y: startPt.y } : undefined,
      });
    }
  }
}

/**
 * Check that trace points fall within the board outline (with clearance tolerance).
 * Emits at most one warning per wire to avoid flooding.
 */
function checkTraceOutOfBounds(ctx: DrcContext): void {
  for (const wire of ctx.pcbWires) {
    for (const pt of wire.points) {
      if (pt.x < -ctx.clearance || pt.y < -ctx.clearance ||
          pt.x > ctx.input.boardWidth + ctx.clearance ||
          pt.y > ctx.input.boardHeight + ctx.clearance) {
        ctx.violations.push({
          severity: 'warning',
          rule: 'trace-out-of-bounds',
          message: `Trace point (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) is outside board outline`,
          location: { x: pt.x, y: pt.y },
        });
        break; // One warning per wire is enough
      }
    }
  }
}

/**
 * Check that board dimensions are positive.
 */
function checkBoardOutline(ctx: DrcContext): void {
  if (ctx.input.boardWidth <= 0 || ctx.input.boardHeight <= 0) {
    ctx.violations.push({
      severity: 'error',
      rule: 'invalid-board-outline',
      message: `Board dimensions are invalid (${ctx.input.boardWidth}x${ctx.input.boardHeight}mm)`,
    });
  }
}

/**
 * Simplified trace-to-trace clearance check.
 * Compares endpoint proximity between wires on the same layer from different nets.
 * A full implementation would use a spatial index; this checks point-to-point distances.
 */
function checkTraceClearance(ctx: DrcContext): void {
  for (let i = 0; i < ctx.pcbWires.length; i++) {
    for (let j = i + 1; j < ctx.pcbWires.length; j++) {
      const wireA = ctx.pcbWires[i];
      const wireB = ctx.pcbWires[j];

      // Only check wires on the same layer
      if (wireA.layer !== wireB.layer) continue;
      // Same net doesn't matter
      if (wireA.netId === wireB.netId) continue;

      checkWirePairClearance(ctx, wireA, wireB);
    }
  }
}

/**
 * Check clearance between two specific wires by comparing all point pairs.
 * Stops after the first violation for the pair to avoid flooding.
 */
function checkWirePairClearance(
  ctx: DrcContext,
  wireA: DrcGateInput['wires'][number],
  wireB: DrcGateInput['wires'][number],
): void {
  for (const ptA of wireA.points) {
    for (const ptB of wireB.points) {
      const dx = ptA.x - ptB.x;
      const dy = ptA.y - ptB.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = (wireA.width + wireB.width) / 2 + ctx.clearance;

      if (dist < minDist) {
        ctx.violations.push({
          severity: 'error',
          rule: 'clearance-violation',
          message: `Clearance violation (${dist.toFixed(3)}mm < ${minDist.toFixed(3)}mm) between traces on ${wireA.layer}`,
          location: { x: ptA.x, y: ptA.y },
        });
        // Break inner loops to avoid flooding
        return;
      }
    }
    // If we just added a clearance violation for this wire pair, stop
    if (ctx.violations.length > 0 && ctx.violations[ctx.violations.length - 1].rule === 'clearance-violation') return;
  }
}

// ---------------------------------------------------------------------------
// Rule registry — ordered list of all DRC rule functions
// ---------------------------------------------------------------------------

type DrcRuleFunction = (ctx: DrcContext) => void;

const DRC_RULES: DrcRuleFunction[] = [
  checkComponentPlacement,
  checkUnroutedNets,
  checkMinTraceWidth,
  checkTraceOutOfBounds,
  checkBoardOutline,
  checkTraceClearance,
];

// ---------------------------------------------------------------------------
// Result summary
// ---------------------------------------------------------------------------

function buildResultMessage(errors: number, warnings: number): string {
  if (errors === 0 && warnings === 0) {
    return 'DRC passed — ready for manufacturing export';
  }
  if (errors === 0) {
    return `DRC passed with ${warnings} warning${warnings !== 1 ? 's' : ''} — review before export`;
  }
  return `DRC failed: ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} — fix errors before export`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run pre-export DRC checks on the PCB layout.
 * Returns a result indicating whether it's safe to generate manufacturing files.
 */
export function runDrcGate(input: DrcGateInput): DrcGateResult {
  const ctx: DrcContext = {
    input,
    violations: [],
    clearance: input.clearance ?? 0.2,
    minTraceWidth: input.minTraceWidth ?? 0.15,
    pcbWires: input.wires.filter(function filterPcbWires(w) { return w.view === 'pcb'; }),
  };

  for (const rule of DRC_RULES) {
    rule(ctx);
  }

  const errors = ctx.violations.filter(function countErrors(v) { return v.severity === 'error'; }).length;
  const warnings = ctx.violations.filter(function countWarnings(v) { return v.severity === 'warning'; }).length;
  const passed = errors === 0;
  const message = buildResultMessage(errors, warnings);

  return { passed, errors, warnings, violations: ctx.violations, message };
}
