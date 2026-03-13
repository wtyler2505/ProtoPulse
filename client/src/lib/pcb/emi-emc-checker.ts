/**
 * EmiEmcChecker — Proactive EMI/EMC compliance checker that evaluates PCB
 * designs against common EMC rules before manufacturing.
 *
 * Singleton + subscribe pattern (useSyncExternalStore compatible).
 * All dimensions in mm. Pure class, no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmcCategory = 'conducted' | 'radiated' | 'ESD';

export type EmcSeverity = 'info' | 'warning' | 'error';

export interface EmcTrace {
  id: string;
  netId: string;
  layer: string;
  points: Array<{ x: number; y: number }>;
  width: number; // mm
  /** Signal type hint — the checker uses this to apply category-specific rules. */
  signalType?: 'clock' | 'power' | 'data' | 'analog' | 'general';
}

export interface EmcComponent {
  id: string;
  name: string;
  type: 'ic' | 'capacitor' | 'resistor' | 'inductor' | 'connector' | 'other';
  position: { x: number; y: number };
  layer: string;
  /** Pin positions for proximity checks. */
  pins?: Array<{
    id: string;
    position: { x: number; y: number };
    name: string;
    /** Mark Vcc/VDD pins so the checker can verify bypass cap placement. */
    isPower?: boolean;
  }>;
}

export interface EmcPlane {
  id: string;
  netId: string;
  layer: string;
  boundary: Array<{ x: number; y: number }>;
  /** Slots or cuts in the plane that break return-path continuity. */
  slots?: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    width: number;
  }>;
}

export interface EmcStackupLayer {
  name: string;
  type: 'signal' | 'plane' | 'mixed';
  thickness: number; // mm
}

export interface EmcDesignData {
  traces: EmcTrace[];
  components: EmcComponent[];
  planes: EmcPlane[];
  stackup: EmcStackupLayer[];
  /** Board dimensions for edge clearance checks. */
  boardOutline?: Array<{ x: number; y: number }>;
}

export interface EmcRule {
  id: string;
  name: string;
  description: string;
  category: EmcCategory;
  severity: EmcSeverity;
  enabled: boolean;
}

export interface EmcViolation {
  ruleId: string;
  severity: EmcSeverity;
  message: string;
  location?: { x: number; y: number };
  recommendation: string;
}

export interface EmcReport {
  violations: EmcViolation[];
  passCount: number;
  failCount: number;
  score: number; // 0-100
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function polylineLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  return total;
}

function polylineMidpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1) {
    return { ...points[0] };
  }
  const mid = Math.floor(points.length / 2);
  return { ...points[mid] };
}

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) {
    return dist({ x: px, y: py }, { x: ax, y: ay });
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return dist({ x: px, y: py }, { x: cx, y: cy });
}

/** Minimum distance from a point to any segment of a polyline. */
function pointToPolylineDist(
  px: number,
  py: number,
  points: Array<{ x: number; y: number }>,
): number {
  let minDist = Infinity;
  for (let i = 1; i < points.length; i++) {
    const d = pointToSegmentDist(px, py, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    if (d < minDist) {
      minDist = d;
    }
  }
  return minDist;
}

/**
 * Compute the loop area of a signal trace + nearest return path.
 * Approximated as trace length * distance to nearest ground plane.
 * Returns area in mm^2.
 */
function estimateLoopArea(trace: EmcTrace, planes: EmcPlane[], stackup: EmcStackupLayer[]): number {
  const traceLen = polylineLength(trace.points);
  if (traceLen === 0) {
    return 0;
  }

  // Find the nearest ground/power plane on an adjacent layer
  const traceLayerIdx = stackup.findIndex((l) => l.name === trace.layer);
  if (traceLayerIdx < 0) {
    // No stackup info — use default 1.6mm separation estimate
    return traceLen * 1.6;
  }

  // Find nearest plane layer
  let minLayerDist = Infinity;
  for (const plane of planes) {
    const planeLayerIdx = stackup.findIndex((l) => l.name === plane.layer);
    if (planeLayerIdx < 0) {
      continue;
    }
    // Sum thicknesses between trace layer and plane layer
    const lo = Math.min(traceLayerIdx, planeLayerIdx);
    const hi = Math.max(traceLayerIdx, planeLayerIdx);
    let separation = 0;
    for (let i = lo; i < hi; i++) {
      separation += stackup[i].thickness;
    }
    if (separation > 0 && separation < minLayerDist) {
      minLayerDist = separation;
    }
  }

  if (minLayerDist === Infinity) {
    minLayerDist = 1.6; // default PCB thickness fallback
  }

  return traceLen * minLayerDist;
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

function buildDefaultRules(): EmcRule[] {
  return [
    {
      id: 'loop-area',
      name: 'Loop Area Minimization',
      description: 'Signal traces should have a continuous return path on an adjacent plane to minimize loop area. Large loops act as antennas.',
      category: 'radiated',
      severity: 'error',
      enabled: true,
    },
    {
      id: 'decoupling-cap-placement',
      name: 'Decoupling Capacitor Placement',
      description: 'Decoupling capacitors should be placed within 5mm of IC power pins to be effective at high frequencies.',
      category: 'conducted',
      severity: 'error',
      enabled: true,
    },
    {
      id: 'clock-trace-length',
      name: 'Clock Trace Length Limit',
      description: 'Clock traces should be kept short to reduce radiated emissions. Maximum recommended length depends on edge rate.',
      category: 'radiated',
      severity: 'error',
      enabled: true,
    },
    {
      id: 'ground-plane-continuity',
      name: 'Ground Plane Continuity',
      description: 'Ground planes should not have slots or cuts under high-speed signal traces, as this forces return current to detour around the gap.',
      category: 'radiated',
      severity: 'error',
      enabled: true,
    },
    {
      id: 'split-plane-detection',
      name: 'Split Plane Detection',
      description: 'Traces should not cross power plane splits, as this creates a large loop area and increases emissions.',
      category: 'radiated',
      severity: 'warning',
      enabled: true,
    },
    {
      id: 'guard-trace',
      name: 'Guard Trace for Sensitive Signals',
      description: 'Analog or sensitive signals should have guard traces (grounded traces) on both sides to shield from crosstalk.',
      category: 'radiated',
      severity: 'info',
      enabled: true,
    },
    {
      id: 'connector-grounding',
      name: 'Connector Grounding',
      description: 'Connectors should have ground pins adjacent to signal pins and short ground paths to the chassis/board ground plane.',
      category: 'ESD',
      severity: 'warning',
      enabled: true,
    },
    {
      id: 'trace-spacing-emi',
      name: 'High-Speed Trace Spacing',
      description: 'High-speed or clock traces should maintain at least 3x trace-width spacing from other signals to reduce crosstalk-induced emissions.',
      category: 'radiated',
      severity: 'warning',
      enabled: true,
    },
    {
      id: 'edge-rate-trace-length',
      name: 'Edge Rate vs Trace Length',
      description: 'Fast-edge-rate signals on long traces may cause ringing and overshoot, increasing emissions. Trace length should be below lambda/10.',
      category: 'radiated',
      severity: 'warning',
      enabled: true,
    },
    {
      id: 'power-plane-decoupling',
      name: 'Power Plane Decoupling',
      description: 'Power planes should have sufficient decoupling capacitors distributed across the board, not just near ICs.',
      category: 'conducted',
      severity: 'info',
      enabled: true,
    },
    {
      id: 'return-path-proximity',
      name: 'Return Path Proximity',
      description: 'Signal traces should have a return path (ground plane) directly beneath them. Layer transitions without adjacent vias break the return path.',
      category: 'radiated',
      severity: 'error',
      enabled: true,
    },
    {
      id: 'esd-protection-connector',
      name: 'ESD Protection at Connectors',
      description: 'External connectors should have ESD protection components (TVS diodes) placed close to the connector.',
      category: 'ESD',
      severity: 'warning',
      enabled: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Maximum decoupling cap distance from IC Vcc pin (mm). */
const MAX_DECAP_DISTANCE_MM = 5.0;

/** Maximum recommended loop area (mm^2) for general signals. */
const MAX_LOOP_AREA_MM2 = 100.0;

/** Maximum clock trace length (mm) for standard edge rates. */
const MAX_CLOCK_TRACE_LENGTH_MM = 50.0;

/** Minimum spacing multiplier (times trace width) for high-speed traces. */
const HS_SPACING_MULTIPLIER = 3.0;

/** Maximum trace length (mm) for edge-rate checks (lambda/10 at 1ns edge). */
const MAX_EDGE_RATE_TRACE_LENGTH_MM = 30.0;

/** Minimum number of decoupling caps per power plane. */
const MIN_POWER_PLANE_DECAPS = 2;

/** Max distance (mm) from connector to nearest ground pin/pad. */
const MAX_CONNECTOR_GND_DISTANCE_MM = 3.0;

/** Max distance (mm) from connector to nearest ESD protection component. */
const MAX_ESD_PROTECTION_DISTANCE_MM = 10.0;

// ---------------------------------------------------------------------------
// Rule checker functions
// ---------------------------------------------------------------------------

function checkLoopArea(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];
  for (const trace of design.traces) {
    if (trace.points.length < 2) {
      continue;
    }
    const area = estimateLoopArea(trace, design.planes, design.stackup);
    if (area > MAX_LOOP_AREA_MM2) {
      violations.push({
        ruleId: 'loop-area',
        severity: 'error',
        message: `Trace "${trace.netId}" has estimated loop area ${area.toFixed(1)} mm² (max ${String(MAX_LOOP_AREA_MM2)} mm²)`,
        location: polylineMidpoint(trace.points),
        recommendation: 'Route the trace closer to its return path (ground plane). Consider adding a ground plane on an adjacent layer or reducing trace length.',
      });
    }
  }
  return violations;
}

function checkDecouplingCapPlacement(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  // Find all capacitors
  const caps = design.components.filter((c) => c.type === 'capacitor');

  // Find all ICs with power pins
  for (const ic of design.components) {
    if (ic.type !== 'ic') {
      continue;
    }
    const powerPins = ic.pins?.filter((p) => p.isPower) ?? [];
    if (powerPins.length === 0) {
      continue;
    }

    for (const pin of powerPins) {
      // Find nearest capacitor
      let nearestDist = Infinity;
      for (const cap of caps) {
        const d = dist(pin.position, cap.position);
        if (d < nearestDist) {
          nearestDist = d;
        }
      }

      if (nearestDist > MAX_DECAP_DISTANCE_MM) {
        violations.push({
          ruleId: 'decoupling-cap-placement',
          severity: 'error',
          message: `IC "${ic.name}" power pin "${pin.name}" has no decoupling capacitor within ${String(MAX_DECAP_DISTANCE_MM)}mm (nearest: ${nearestDist === Infinity ? 'none' : nearestDist.toFixed(1) + 'mm'})`,
          location: pin.position,
          recommendation: `Place a 100nF decoupling capacitor within ${String(MAX_DECAP_DISTANCE_MM)}mm of this power pin, with short vias to the ground plane.`,
        });
      }
    }
  }
  return violations;
}

function checkClockTraceLength(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];
  for (const trace of design.traces) {
    if (trace.signalType !== 'clock') {
      continue;
    }
    const len = polylineLength(trace.points);
    if (len > MAX_CLOCK_TRACE_LENGTH_MM) {
      violations.push({
        ruleId: 'clock-trace-length',
        severity: 'error',
        message: `Clock trace "${trace.netId}" is ${len.toFixed(1)}mm long (max ${String(MAX_CLOCK_TRACE_LENGTH_MM)}mm)`,
        location: polylineMidpoint(trace.points),
        recommendation: 'Shorten the clock trace, use series termination, or reduce the clock frequency. Consider placing the clock source closer to its load.',
      });
    }
  }
  return violations;
}

function checkGroundPlaneContinuity(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  // Check each high-speed or clock trace for slots in nearby planes
  const hsTraces = design.traces.filter(
    (t) => t.signalType === 'clock' || t.signalType === 'data',
  );

  for (const trace of hsTraces) {
    for (const plane of design.planes) {
      if (!plane.slots || plane.slots.length === 0) {
        continue;
      }

      for (const slot of plane.slots) {
        // Check if the trace runs near/over the slot
        for (const pt of trace.points) {
          const slotDist = pointToSegmentDist(
            pt.x, pt.y,
            slot.start.x, slot.start.y,
            slot.end.x, slot.end.y,
          );
          if (slotDist < slot.width + trace.width) {
            violations.push({
              ruleId: 'ground-plane-continuity',
              severity: 'error',
              message: `Trace "${trace.netId}" crosses a slot in plane "${plane.netId}" — return path is broken`,
              location: pt,
              recommendation: 'Route the trace away from the slot, or bridge the slot with stitching vias on both sides.',
            });
            break; // one violation per trace-slot pair
          }
        }
      }
    }
  }
  return violations;
}

function checkSplitPlaneDetection(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  // A "split" is when we have multiple planes on the same layer with different nets.
  const layerPlaneMap = new Map<string, EmcPlane[]>();
  for (const plane of design.planes) {
    const existing = layerPlaneMap.get(plane.layer) ?? [];
    existing.push(plane);
    layerPlaneMap.set(plane.layer, existing);
  }

  for (const [layer, planes] of Array.from(layerPlaneMap.entries())) {
    if (planes.length < 2) {
      continue;
    }

    // Multiple planes on same layer = potential split
    const netIds = Array.from(new Set(planes.map((p) => p.netId)));
    if (netIds.length < 2) {
      continue;
    }

    // Check if any high-speed traces are on an adjacent signal layer
    for (const trace of design.traces) {
      if (trace.signalType !== 'clock' && trace.signalType !== 'data') {
        continue;
      }

      // Check layer adjacency
      const traceLayerIdx = design.stackup.findIndex((l) => l.name === trace.layer);
      const planeLayerIdx = design.stackup.findIndex((l) => l.name === layer);
      if (traceLayerIdx < 0 || planeLayerIdx < 0) {
        continue;
      }
      if (Math.abs(traceLayerIdx - planeLayerIdx) > 1) {
        continue;
      }

      violations.push({
        ruleId: 'split-plane-detection',
        severity: 'warning',
        message: `Trace "${trace.netId}" runs adjacent to a split power plane on layer "${layer}" (nets: ${netIds.join(', ')})`,
        location: polylineMidpoint(trace.points),
        recommendation: 'Avoid routing high-speed signals over power plane splits. Re-route on a layer with a continuous reference plane.',
      });
    }
  }
  return violations;
}

function checkGuardTrace(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  const analogTraces = design.traces.filter((t) => t.signalType === 'analog');
  const otherTraces = design.traces.filter((t) => t.signalType !== 'analog');

  for (const aTrace of analogTraces) {
    // Check if any non-analog trace is too close without a guard trace
    for (const oTrace of otherTraces) {
      if (oTrace.layer !== aTrace.layer) {
        continue;
      }
      for (const pt of aTrace.points) {
        const d = pointToPolylineDist(pt.x, pt.y, oTrace.points);
        if (d < aTrace.width * HS_SPACING_MULTIPLIER && d > 0) {
          violations.push({
            ruleId: 'guard-trace',
            severity: 'info',
            message: `Analog trace "${aTrace.netId}" is ${d.toFixed(2)}mm from trace "${oTrace.netId}" — consider adding guard traces`,
            location: pt,
            recommendation: 'Add grounded guard traces on both sides of the analog signal, with vias to the ground plane every 10-15mm.',
          });
          break; // one violation per trace pair
        }
      }
    }
  }
  return violations;
}

function checkConnectorGrounding(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  const connectors = design.components.filter((c) => c.type === 'connector');
  const gndPlanes = design.planes.filter(
    (p) => p.netId.toLowerCase().includes('gnd') || p.netId.toLowerCase().includes('ground'),
  );

  for (const conn of connectors) {
    const gndPins = conn.pins?.filter(
      (p) => p.name.toLowerCase().includes('gnd') || p.name.toLowerCase().includes('ground') || p.name.toLowerCase() === 'shield',
    ) ?? [];

    if (gndPins.length === 0 && gndPlanes.length > 0) {
      violations.push({
        ruleId: 'connector-grounding',
        severity: 'warning',
        message: `Connector "${conn.name}" has no identified ground pins — ensure proper grounding for ESD protection`,
        location: conn.position,
        recommendation: 'Add ground pins adjacent to signal pins on the connector. Use short, wide traces or direct vias to the ground plane.',
      });
    } else {
      // Check that ground pins have short paths
      for (const gndPin of gndPins) {
        let nearestPlaneDist = Infinity;
        for (const plane of gndPlanes) {
          if (plane.boundary.length === 0) {
            continue;
          }
          // Approximate: distance from pin to nearest boundary point
          for (const bp of plane.boundary) {
            const d = dist(gndPin.position, bp);
            if (d < nearestPlaneDist) {
              nearestPlaneDist = d;
            }
          }
        }

        if (nearestPlaneDist > MAX_CONNECTOR_GND_DISTANCE_MM && nearestPlaneDist !== Infinity) {
          violations.push({
            ruleId: 'connector-grounding',
            severity: 'warning',
            message: `Connector "${conn.name}" ground pin "${gndPin.name}" is ${nearestPlaneDist.toFixed(1)}mm from nearest ground plane edge`,
            location: gndPin.position,
            recommendation: `Keep ground pin connections under ${String(MAX_CONNECTOR_GND_DISTANCE_MM)}mm with direct vias to the ground plane.`,
          });
        }
      }
    }
  }
  return violations;
}

function checkTraceSpacingEmi(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  const hsTraces = design.traces.filter(
    (t) => t.signalType === 'clock' || t.signalType === 'data',
  );

  for (let i = 0; i < hsTraces.length; i++) {
    for (let j = i + 1; j < hsTraces.length; j++) {
      const traceA = hsTraces[i];
      const traceB = hsTraces[j];

      if (traceA.layer !== traceB.layer) {
        continue;
      }

      const requiredSpacing = Math.max(traceA.width, traceB.width) * HS_SPACING_MULTIPLIER;

      for (const ptA of traceA.points) {
        const d = pointToPolylineDist(ptA.x, ptA.y, traceB.points);
        if (d < requiredSpacing && d > 0) {
          violations.push({
            ruleId: 'trace-spacing-emi',
            severity: 'warning',
            message: `High-speed traces "${traceA.netId}" and "${traceB.netId}" are ${d.toFixed(2)}mm apart (recommended: ${requiredSpacing.toFixed(2)}mm)`,
            location: ptA,
            recommendation: `Maintain at least ${HS_SPACING_MULTIPLIER}x trace width spacing between high-speed signals to reduce crosstalk emissions.`,
          });
          break; // one violation per pair
        }
      }
    }
  }
  return violations;
}

function checkEdgeRateTraceLength(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  // Apply to clock and data traces
  const fastTraces = design.traces.filter(
    (t) => t.signalType === 'clock' || t.signalType === 'data',
  );

  for (const trace of fastTraces) {
    const len = polylineLength(trace.points);
    if (len > MAX_EDGE_RATE_TRACE_LENGTH_MM) {
      violations.push({
        ruleId: 'edge-rate-trace-length',
        severity: 'warning',
        message: `Fast-edge trace "${trace.netId}" is ${len.toFixed(1)}mm long — may cause ringing (limit: ${String(MAX_EDGE_RATE_TRACE_LENGTH_MM)}mm for 1ns edges)`,
        location: polylineMidpoint(trace.points),
        recommendation: 'Add series termination resistors near the source, or reduce edge rate with gate drive strength settings. Keep traces under lambda/10.',
      });
    }
  }
  return violations;
}

function checkPowerPlaneDecoupling(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  const powerPlanes = design.planes.filter(
    (p) => !p.netId.toLowerCase().includes('gnd') && !p.netId.toLowerCase().includes('ground'),
  );

  if (powerPlanes.length === 0) {
    return violations;
  }

  const caps = design.components.filter((c) => c.type === 'capacitor');

  for (const plane of powerPlanes) {
    if (plane.boundary.length === 0) {
      continue;
    }
    // Count caps that are within the plane boundary (approximate: near any boundary point)
    let capCount = 0;
    for (const cap of caps) {
      for (const bp of plane.boundary) {
        if (dist(cap.position, bp) < 20) { // within 20mm of plane edge
          capCount++;
          break;
        }
      }
    }

    if (capCount < MIN_POWER_PLANE_DECAPS) {
      const centroid = planeCentroid(plane);
      violations.push({
        ruleId: 'power-plane-decoupling',
        severity: 'info',
        message: `Power plane "${plane.netId}" has only ${String(capCount)} nearby decoupling cap(s) (recommended: at least ${String(MIN_POWER_PLANE_DECAPS)})`,
        location: centroid,
        recommendation: 'Distribute decoupling capacitors across the power plane, not just near ICs. Use a mix of values (100nF, 10uF) for broadband filtering.',
      });
    }
  }
  return violations;
}

function checkReturnPathProximity(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  // Check that each signal trace has a reference plane on an adjacent layer
  for (const trace of design.traces) {
    if (trace.points.length < 2) {
      continue;
    }

    const traceLayerIdx = design.stackup.findIndex((l) => l.name === trace.layer);
    if (traceLayerIdx < 0) {
      continue;
    }

    // Check adjacent layers for a plane
    let hasAdjacentPlane = false;
    for (const plane of design.planes) {
      const planeLayerIdx = design.stackup.findIndex((l) => l.name === plane.layer);
      if (planeLayerIdx < 0) {
        continue;
      }
      if (Math.abs(traceLayerIdx - planeLayerIdx) === 1) {
        hasAdjacentPlane = true;
        break;
      }
    }

    if (!hasAdjacentPlane) {
      violations.push({
        ruleId: 'return-path-proximity',
        severity: 'error',
        message: `Trace "${trace.netId}" on layer "${trace.layer}" has no reference plane on an adjacent layer`,
        location: polylineMidpoint(trace.points),
        recommendation: 'Ensure every signal layer has an adjacent ground or power plane for a continuous return path. Add a ground plane on the nearest inner layer.',
      });
    }
  }
  return violations;
}

function checkEsdProtectionConnector(design: EmcDesignData): EmcViolation[] {
  const violations: EmcViolation[] = [];

  const connectors = design.components.filter((c) => c.type === 'connector');

  // Heuristic: look for components with "TVS" or "ESD" in the name
  const esdComponents = design.components.filter(
    (c) => c.name.toLowerCase().includes('tvs') || c.name.toLowerCase().includes('esd'),
  );

  for (const conn of connectors) {
    let nearestEsdDist = Infinity;
    for (const esd of esdComponents) {
      const d = dist(conn.position, esd.position);
      if (d < nearestEsdDist) {
        nearestEsdDist = d;
      }
    }

    if (nearestEsdDist > MAX_ESD_PROTECTION_DISTANCE_MM) {
      violations.push({
        ruleId: 'esd-protection-connector',
        severity: 'warning',
        message: `Connector "${conn.name}" has no ESD protection within ${String(MAX_ESD_PROTECTION_DISTANCE_MM)}mm (nearest: ${nearestEsdDist === Infinity ? 'none' : nearestEsdDist.toFixed(1) + 'mm'})`,
        location: conn.position,
        recommendation: 'Place TVS diodes or ESD protection clamps as close as possible to the connector, before any series components.',
      });
    }
  }
  return violations;
}

function planeCentroid(plane: EmcPlane): { x: number; y: number } {
  if (plane.boundary.length === 0) {
    return { x: 0, y: 0 };
  }
  let sumX = 0;
  let sumY = 0;
  for (const p of plane.boundary) {
    sumX += p.x;
    sumY += p.y;
  }
  return { x: sumX / plane.boundary.length, y: sumY / plane.boundary.length };
}

// ---------------------------------------------------------------------------
// Rule → checker function map
// ---------------------------------------------------------------------------

const RULE_CHECKERS: Record<string, (design: EmcDesignData) => EmcViolation[]> = {
  'loop-area': checkLoopArea,
  'decoupling-cap-placement': checkDecouplingCapPlacement,
  'clock-trace-length': checkClockTraceLength,
  'ground-plane-continuity': checkGroundPlaneContinuity,
  'split-plane-detection': checkSplitPlaneDetection,
  'guard-trace': checkGuardTrace,
  'connector-grounding': checkConnectorGrounding,
  'trace-spacing-emi': checkTraceSpacingEmi,
  'edge-rate-trace-length': checkEdgeRateTraceLength,
  'power-plane-decoupling': checkPowerPlaneDecoupling,
  'return-path-proximity': checkReturnPathProximity,
  'esd-protection-connector': checkEsdProtectionConnector,
};

// ---------------------------------------------------------------------------
// EmiEmcChecker
// ---------------------------------------------------------------------------

export class EmiEmcChecker {
  private rules: EmcRule[];
  private lastReport: EmcReport | null = null;
  private listeners = new Set<Listener>();

  private static instance: EmiEmcChecker | null = null;

  private constructor() {
    this.rules = buildDefaultRules();
  }

  static getInstance(): EmiEmcChecker {
    if (!EmiEmcChecker.instance) {
      EmiEmcChecker.instance = new EmiEmcChecker();
    }
    return EmiEmcChecker.instance;
  }

  /** Reset singleton — primarily for testing. */
  static resetInstance(): void {
    EmiEmcChecker.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Rule management
  // -----------------------------------------------------------------------

  getRuleSet(): EmcRule[] {
    return this.rules.map((r) => ({ ...r }));
  }

  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) {
      throw new Error(`Unknown EMC rule: "${ruleId}"`);
    }
    rule.enabled = enabled;
    this.notify();
  }

  setRuleSeverity(ruleId: string, severity: EmcSeverity): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) {
      throw new Error(`Unknown EMC rule: "${ruleId}"`);
    }
    rule.severity = severity;
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Run check
  // -----------------------------------------------------------------------

  runCheck(design: EmcDesignData): EmcReport {
    const allViolations: EmcViolation[] = [];
    let passCount = 0;
    let failCount = 0;

    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      const checker = RULE_CHECKERS[rule.id];
      if (!checker) {
        continue;
      }

      const ruleViolations = checker(design);

      // Override severity from the rule configuration
      const adjustedViolations = ruleViolations.map((v) => ({
        ...v,
        severity: rule.severity,
      }));

      if (adjustedViolations.length === 0) {
        passCount++;
      } else {
        failCount++;
        allViolations.push(...adjustedViolations);
      }
    }

    const totalRules = passCount + failCount;
    const score = totalRules === 0 ? 100 : Math.round((passCount / totalRules) * 100);

    this.lastReport = {
      violations: allViolations,
      passCount,
      failCount,
      score,
    };

    this.notify();
    return { ...this.lastReport, violations: [...allViolations] };
  }

  getLastReport(): EmcReport | null {
    if (!this.lastReport) {
      return null;
    }
    return {
      ...this.lastReport,
      violations: [...this.lastReport.violations],
    };
  }
}
