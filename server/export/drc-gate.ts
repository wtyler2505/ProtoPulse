/**
 * DRC Safety Gate (Phase 12.10a)
 *
 * Before generating manufacturing outputs (Gerber, drill, pick-and-place),
 * the PCB layout must pass a DRC check. This module provides a pre-export
 * validation gate that enforces this requirement.
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

/**
 * Run pre-export DRC checks on the PCB layout.
 * Returns a result indicating whether it's safe to generate manufacturing files.
 */
export function runDrcGate(input: DrcGateInput): DrcGateResult {
  const violations: DrcViolation[] = [];
  const clearance = input.clearance ?? 0.2;
  const minTraceWidth = input.minTraceWidth ?? 0.15;
  const pcbWires = input.wires.filter(w => w.view === 'pcb');

  // 1. Check: All instances placed on board
  for (const inst of input.instances) {
    if (inst.pcbX == null || inst.pcbY == null) {
      violations.push({
        severity: 'error',
        rule: 'unplaced-component',
        message: `${inst.referenceDesignator} has no PCB placement`,
      });
      continue;
    }

    // Check: Component within board bounds
    if (inst.pcbX < 0 || inst.pcbY < 0 || inst.pcbX > input.boardWidth || inst.pcbY > input.boardHeight) {
      violations.push({
        severity: 'warning',
        rule: 'out-of-bounds',
        message: `${inst.referenceDesignator} is outside board outline (${inst.pcbX.toFixed(1)}, ${inst.pcbY.toFixed(1)})`,
        location: { x: inst.pcbX, y: inst.pcbY },
      });
    }
  }

  // 2. Check: Unrouted nets
  const routedNetIds = new Set<number>();
  for (const wire of pcbWires) {
    routedNetIds.add(wire.netId);
  }

  for (const net of input.nets) {
    if (net.segments.length > 0 && !routedNetIds.has(net.id)) {
      violations.push({
        severity: 'error',
        rule: 'unrouted-net',
        message: `Net "${net.name}" has no PCB traces`,
      });
    }
  }

  // 3. Check: Minimum trace width
  for (const wire of pcbWires) {
    if (wire.width < minTraceWidth) {
      const startPt = wire.points[0];
      violations.push({
        severity: 'error',
        rule: 'min-trace-width',
        message: `Trace width ${wire.width.toFixed(3)}mm is below minimum ${minTraceWidth}mm`,
        location: startPt ? { x: startPt.x, y: startPt.y } : undefined,
      });
    }
  }

  // 4. Check: Trace points within board bounds
  for (const wire of pcbWires) {
    for (const pt of wire.points) {
      if (pt.x < -clearance || pt.y < -clearance ||
          pt.x > input.boardWidth + clearance || pt.y > input.boardHeight + clearance) {
        violations.push({
          severity: 'warning',
          rule: 'trace-out-of-bounds',
          message: `Trace point (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) is outside board outline`,
          location: { x: pt.x, y: pt.y },
        });
        break; // One warning per wire is enough
      }
    }
  }

  // 5. Check: Board outline valid
  if (input.boardWidth <= 0 || input.boardHeight <= 0) {
    violations.push({
      severity: 'error',
      rule: 'invalid-board-outline',
      message: `Board dimensions are invalid (${input.boardWidth}x${input.boardHeight}mm)`,
    });
  }

  // 6. Check: Trace clearance between parallel segments (simplified — check endpoint proximity)
  // Full clearance checking would require a spatial index; this is a simplified version.
  for (let i = 0; i < pcbWires.length; i++) {
    for (let j = i + 1; j < pcbWires.length; j++) {
      const wireA = pcbWires[i];
      const wireB = pcbWires[j];

      // Only check wires on the same layer
      if (wireA.layer !== wireB.layer) continue;
      // Same net doesn't matter
      if (wireA.netId === wireB.netId) continue;

      // Check endpoints of A against segments of B
      for (const ptA of wireA.points) {
        for (const ptB of wireB.points) {
          const dx = ptA.x - ptB.x;
          const dy = ptA.y - ptB.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = (wireA.width + wireB.width) / 2 + clearance;

          if (dist < minDist) {
            violations.push({
              severity: 'error',
              rule: 'clearance-violation',
              message: `Clearance violation (${dist.toFixed(3)}mm < ${minDist.toFixed(3)}mm) between traces on ${wireA.layer}`,
              location: { x: ptA.x, y: ptA.y },
            });
            // Break inner loops to avoid flooding
            break;
          }
        }
        // If we just added a clearance violation for this wire pair, stop
        if (violations.length > 0 && violations[violations.length - 1].rule === 'clearance-violation') break;
      }
    }
  }

  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.filter(v => v.severity === 'warning').length;
  const passed = errors === 0;

  let message: string;
  if (passed && warnings === 0) {
    message = 'DRC passed — ready for manufacturing export';
  } else if (passed) {
    message = `DRC passed with ${warnings} warning${warnings !== 1 ? 's' : ''} — review before export`;
  } else {
    message = `DRC failed: ${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''} — fix errors before export`;
  }

  return { passed, errors, warnings, violations, message };
}
