import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { CircuitInstanceRow, CircuitWireRow } from '@shared/schema';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { HttpError, parseIdParam, payloadLimit } from './utils';
import { requireCircuitOwnership } from '../routes/auth-middleware';

const autorouteSchema = z.object({
  view: z.enum(['breadboard', 'pcb']).default('breadboard'),
});

const layoutSuggestionSchema = z.object({
  view: z.enum(['breadboard', 'pcb']).default('breadboard'),
});

// ---------------------------------------------------------------------------
// Trace width defaults (mm)
// ---------------------------------------------------------------------------

const DEFAULT_TRACE_WIDTH = 0.254; // 10 mil — standard signal trace
const POWER_TRACE_WIDTH = 0.508;   // 20 mil — power nets need more copper

// ---------------------------------------------------------------------------
// Net segment type
// ---------------------------------------------------------------------------

interface NetSegment {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
}

// ---------------------------------------------------------------------------
// Color palette for visual distinction of routed nets
// ---------------------------------------------------------------------------

const NET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#2980b9', '#27ae60', '#8e44ad',
];

// ---------------------------------------------------------------------------
// Overlap detection helpers
// ---------------------------------------------------------------------------

interface Segment {
  x1: number; y1: number;
  x2: number; y2: number;
}

/**
 * Check if a horizontal segment overlaps with any existing wire segment.
 * Uses a simple axis-aligned bounding-box overlap with a tolerance band.
 */
function segmentOverlapsAny(seg: Segment, existing: Segment[], tolerance: number): boolean {
  for (const e of existing) {
    if (segmentsOverlap(seg, e, tolerance)) {
      return true;
    }
  }
  return false;
}

function segmentsOverlap(a: Segment, b: Segment, tol: number): boolean {
  // Check if bounding boxes overlap (with tolerance)
  const aMinX = Math.min(a.x1, a.x2) - tol;
  const aMaxX = Math.max(a.x1, a.x2) + tol;
  const aMinY = Math.min(a.y1, a.y2) - tol;
  const aMaxY = Math.max(a.y1, a.y2) + tol;

  const bMinX = Math.min(b.x1, b.x2);
  const bMaxX = Math.max(b.x1, b.x2);
  const bMinY = Math.min(b.y1, b.y2);
  const bMaxY = Math.max(b.y1, b.y2);

  // No overlap if separated
  if (aMaxX < bMinX || aMinX > bMaxX) { return false; }
  if (aMaxY < bMinY || aMinY > bMaxY) { return false; }

  // Both are axis-aligned — check collinear overlap
  const aIsHoriz = Math.abs(a.y1 - a.y2) < tol;
  const aIsVert = Math.abs(a.x1 - a.x2) < tol;
  const bIsHoriz = Math.abs(b.y1 - b.y2) < tol;
  const bIsVert = Math.abs(b.x1 - b.x2) < tol;

  // Two parallel horizontal segments close in Y
  if (aIsHoriz && bIsHoriz && Math.abs(a.y1 - b.y1) < tol) {
    const overlap = Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX);
    return overlap > tol;
  }

  // Two parallel vertical segments close in X
  if (aIsVert && bIsVert && Math.abs(a.x1 - b.x1) < tol) {
    const overlap = Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY);
    return overlap > tol;
  }

  return false;
}

/**
 * Build Manhattan (L-shaped) path with overlap avoidance.
 * Returns 3 points: [start, bend, end].
 * Tries horizontal-first; if that overlaps existing wires, tries vertical-first.
 */
function buildManhattanPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  existingSegments: Segment[],
  traceWidth: number,
): Array<{ x: number; y: number }> {
  // Same position — return direct connection (2 points)
  if (from.x === to.x && from.y === to.y) {
    return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
  }

  // Already axis-aligned — straight line (2 points)
  if (from.x === to.x || from.y === to.y) {
    return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
  }

  // Horizontal-first: go right/left then up/down
  const horizFirstBend = { x: to.x, y: from.y };
  const horizFirstSegs: Segment[] = [
    { x1: from.x, y1: from.y, x2: horizFirstBend.x, y2: horizFirstBend.y },
    { x1: horizFirstBend.x, y1: horizFirstBend.y, x2: to.x, y2: to.y },
  ];

  const horizOverlaps = horizFirstSegs.some(s => segmentOverlapsAny(s, existingSegments, traceWidth));

  if (!horizOverlaps) {
    return [{ x: from.x, y: from.y }, horizFirstBend, { x: to.x, y: to.y }];
  }

  // Vertical-first: go up/down then right/left
  const vertFirstBend = { x: from.x, y: to.y };
  return [{ x: from.x, y: from.y }, vertFirstBend, { x: to.x, y: to.y }];
}

/**
 * Extract axis-aligned line segments from a wire's points array.
 */
function wireToSegments(wire: CircuitWireRow): Segment[] {
  const pts = (wire.points ?? []) as Array<{ x: number; y: number }>;
  const segs: Segment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
  }
  return segs;
}

/**
 * Resolve the position of an instance for the given view.
 */
function getInstancePosition(
  inst: CircuitInstanceRow,
  view: 'breadboard' | 'pcb',
): { x: number; y: number } | null {
  if (view === 'breadboard') {
    if (inst.breadboardX != null && inst.breadboardY != null) {
      return { x: inst.breadboardX, y: inst.breadboardY };
    }
  } else {
    if (inst.pcbX != null && inst.pcbY != null) {
      return { x: inst.pcbX, y: inst.pcbY };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerCircuitAutorouteRoutes(app: Express, storage: IStorage): void {
  // -------------------------------------------------------------------------
  // POST /api/circuits/:circuitId/autoroute — Manhattan-style server autoroute
  // -------------------------------------------------------------------------
  app.post('/api/circuits/:circuitId/autoroute', requireCircuitOwnership, payloadLimit(4 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = autorouteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const view = parsed.data.view;

    // Verify design exists
    const design = await storage.getCircuitDesign(circuitId);
    if (!design) {
      throw new HttpError('Circuit design not found', 404);
    }

    // Fetch all circuit data in parallel
    const [nets, wires, instances] = await Promise.all([
      storage.getCircuitNets(circuitId),
      storage.getCircuitWires(circuitId),
      storage.getCircuitInstances(circuitId),
    ]);

    // Build instance lookup map
    const instanceMap = new Map<number, CircuitInstanceRow>();
    for (const inst of instances) {
      instanceMap.set(inst.id, inst);
    }

    // Determine already-routed nets for this view
    const existingWireNetIds = new Set(
      wires.filter(w => w.view === view).map(w => w.netId),
    );

    // Separate unrouted nets (have segments and not yet wired)
    const unroutedNets = nets.filter(n => !existingWireNetIds.has(n.id));

    if (unroutedNets.length === 0) {
      return res.json({
        routedCount: 0,
        unroutedCount: 0,
        viaCount: 0,
        wireIds: [] as number[],
        message: 'All nets already routed',
      });
    }

    // Collect existing wire segments for overlap avoidance
    const existingSegments: Segment[] = [];
    for (const w of wires) {
      if (w.view === view) {
        const segs = wireToSegments(w);
        for (const s of segs) {
          existingSegments.push(s);
        }
      }
    }

    const createdWires: CircuitWireRow[] = [];
    let unroutedCount = 0;
    let colorIdx = 0;

    for (const net of unroutedNets) {
      const segments = (net.segments ?? []) as NetSegment[];

      if (segments.length === 0) {
        unroutedCount++;
        continue;
      }

      // Determine trace width: wider for power nets
      const traceWidth = (net.netType === 'power' || net.netType === 'ground')
        ? POWER_TRACE_WIDTH
        : DEFAULT_TRACE_WIDTH;

      // Route each segment in the net
      let netRouted = false;

      for (const seg of segments) {
        const fromInst = instanceMap.get(seg.fromInstanceId);
        const toInst = instanceMap.get(seg.toInstanceId);

        const fromPos = fromInst ? getInstancePosition(fromInst, view) : null;
        const toPos = toInst ? getInstancePosition(toInst, view) : null;

        if (!fromPos || !toPos) {
          // Cannot route this segment — missing position data
          continue;
        }

        const points = buildManhattanPath(fromPos, toPos, existingSegments, traceWidth);

        const wire = await storage.createCircuitWire({
          circuitId,
          netId: net.id,
          view,
          points,
          layer: 'front',
          width: traceWidth,
          color: NET_COLORS[colorIdx % NET_COLORS.length],
          wireType: view === 'pcb' ? 'trace' : 'wire',
        });

        createdWires.push(wire);

        // Add new wire segments to the collision set
        const newSegs = wireToSegments(wire);
        for (const s of newSegs) {
          existingSegments.push(s);
        }

        netRouted = true;
      }

      if (netRouted) {
        colorIdx++;
      } else {
        unroutedCount++;
      }
    }

    const wireIds = createdWires.map(w => w.id);

    res.json({
      routedCount: createdWires.length,
      unroutedCount,
      viaCount: 0, // Server-side Manhattan routing is single-layer, no vias
      wireIds,
      message: `Auto-routed ${createdWires.length} wire${createdWires.length === 1 ? '' : 's'} (${unroutedCount} unrouted)`,
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/circuits/:circuitId/suggest-layout — AI Layout Suggestion
  // -------------------------------------------------------------------------
  app.post('/api/circuits/:circuitId/suggest-layout', requireCircuitOwnership, payloadLimit(16 * 1024), async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = layoutSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const instances = await storage.getCircuitInstances(circuitId);
    const nets = await storage.getCircuitNets(circuitId);

    if (instances.length === 0) {
      return res.status(400).json({ message: 'No components to layout' });
    }

    const suggestions: Array<{
      instanceId: number;
      referenceDesignator: string;
      x: number;
      y: number;
      rotation: number;
    }> = [];

    const spacing = parsed.data.view === 'breadboard' ? 80 : 120;
    const cols = Math.max(1, Math.ceil(Math.sqrt(instances.length)));

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      suggestions.push({
        instanceId: inst.id,
        referenceDesignator: inst.referenceDesignator,
        x: 50 + col * spacing,
        y: 50 + row * spacing,
        rotation: 0,
      });
    }

    res.json({
      view: parsed.data.view,
      suggestions,
      netCount: nets.length,
      instanceCount: instances.length,
    });
  });
}
