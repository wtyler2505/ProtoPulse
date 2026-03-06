/**
 * CopperPourBridge — Converts PCB routing data into copper pour obstacles.
 *
 * Bridges the gap between trace-router / via-model / footprint-library types
 * and the CopperPourEngine's obstacle system. Converts traces to rectangles,
 * vias to circles, and pads to shape-appropriate obstacles, then classifies
 * them for pour fill (subtract vs thermal relief).
 *
 * Pure static methods — no state, no side effects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PourObstacle {
  type: 'trace' | 'via' | 'pad';
  geometry: 'rect' | 'circle';
  x: number; // mm — center x
  y: number; // mm — center y
  width: number; // mm
  height: number; // mm
  rotation?: number; // degrees
  netId?: string;
  layer: string;
}

export interface ThermalReliefConfig {
  spokeWidth: number; // mm (default 0.3)
  gap: number; // mm (default 0.3)
  spokeCount: number; // default 4
}

export interface FilterResult {
  subtract: PourObstacle[]; // different-net obstacles to fully subtract
  thermal: PourObstacle[]; // same-net obstacles needing thermal relief
}

// ---------------------------------------------------------------------------
// Input types (loose to avoid tight coupling to specific module types)
// ---------------------------------------------------------------------------

interface TraceInput {
  points: Array<{ x: number; y: number }>;
  layer: string;
  width: number;
  netId?: string;
}

interface ViaInput {
  position: { x: number; y: number };
  outerDiameter: number;
  netId?: number;
}

interface PadInput {
  position: { x: number; y: number };
  width: number;
  height: number;
  shape: string;
  layer: string;
  netId?: string;
}

// ---------------------------------------------------------------------------
// CopperPourBridge
// ---------------------------------------------------------------------------

export class CopperPourBridge {
  /**
   * Convert a single trace segment (p1 -> p2) to a rotated rectangle obstacle.
   *
   * The rectangle is centered at the midpoint of the segment, with width = segment
   * length and height = trace width. Rotation = angle of the segment in degrees.
   * Zero-length segments produce a square of (traceWidth x traceWidth).
   */
  static segmentToRect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    traceWidth: number,
  ): PourObstacle {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 1e-9) {
      // Zero-length segment — produce a square
      return {
        type: 'trace',
        geometry: 'rect',
        x: p1.x,
        y: p1.y,
        width: traceWidth,
        height: traceWidth,
        rotation: 0,
        layer: '',
      };
    }

    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

    return {
      type: 'trace',
      geometry: 'rect',
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      width: length,
      height: traceWidth,
      rotation: angleDeg,
      layer: '',
    };
  }

  /**
   * Convert traces (multi-point polylines) to rectangular obstacles.
   *
   * Each consecutive pair of points in a trace becomes one rectangle obstacle.
   * Traces with fewer than 2 points are skipped.
   */
  static tracesToObstacles(traces: TraceInput[]): PourObstacle[] {
    const obstacles: PourObstacle[] = [];

    for (const trace of traces) {
      if (trace.points.length < 2) {
        continue;
      }

      for (let i = 0; i < trace.points.length - 1; i++) {
        const rect = this.segmentToRect(trace.points[i], trace.points[i + 1], trace.width);
        rect.layer = trace.layer;
        rect.netId = trace.netId;
        obstacles.push(rect);
      }
    }

    return obstacles;
  }

  /**
   * Convert vias to circular obstacles.
   *
   * Each via becomes a circle centered at its position with diameter = outerDiameter.
   * Vias span all layers, so layer is set to 'both'.
   * Numeric netId is converted to string for consistency.
   */
  static viasToObstacles(vias: ViaInput[]): PourObstacle[] {
    const obstacles: PourObstacle[] = [];

    for (const via of vias) {
      obstacles.push({
        type: 'via',
        geometry: 'circle',
        x: via.position.x,
        y: via.position.y,
        width: via.outerDiameter,
        height: via.outerDiameter,
        layer: 'both',
        netId: via.netId !== undefined ? String(via.netId) : undefined,
      });
    }

    return obstacles;
  }

  /**
   * Convert pads to obstacles with shape-appropriate geometry.
   *
   * Circle pads → circle geometry. All other shapes (rect, square, oblong,
   * roundrect) → rect geometry.
   */
  static padsToObstacles(pads: PadInput[]): PourObstacle[] {
    const obstacles: PourObstacle[] = [];

    for (const pad of pads) {
      const isCircle = pad.shape === 'circle';
      obstacles.push({
        type: 'pad',
        geometry: isCircle ? 'circle' : 'rect',
        x: pad.position.x,
        y: pad.position.y,
        width: pad.width,
        height: pad.height,
        layer: pad.layer,
        netId: pad.netId,
      });
    }

    return obstacles;
  }

  /**
   * Build a complete obstacle set from all routing data sources.
   *
   * Combines traces, vias, and pads into a single flat array.
   * All input arrays are optional.
   */
  static buildObstacles(data: {
    traces?: TraceInput[];
    vias?: ViaInput[];
    pads?: PadInput[];
  }): PourObstacle[] {
    const obstacles: PourObstacle[] = [];

    if (data.traces) {
      obstacles.push(...this.tracesToObstacles(data.traces));
    }
    if (data.vias) {
      obstacles.push(...this.viasToObstacles(data.vias));
    }
    if (data.pads) {
      obstacles.push(...this.padsToObstacles(data.pads));
    }

    return obstacles;
  }

  /**
   * Filter obstacles for a specific copper pour layer and net.
   *
   * Separates obstacles into two groups:
   * - `subtract`: different-net (or no-net) obstacles on the same layer — fully removed from pour
   * - `thermal`: same-net obstacles on the same layer — get thermal relief connections
   *
   * Obstacles on a different layer are excluded entirely.
   * Obstacles with layer='both' match any pour layer.
   * If pourNetId is undefined, all matching-layer obstacles go to subtract.
   */
  static filterForPour(
    obstacles: PourObstacle[],
    pourLayer: string,
    pourNetId?: string,
  ): FilterResult {
    const subtract: PourObstacle[] = [];
    const thermal: PourObstacle[] = [];

    for (const obs of obstacles) {
      // Layer filtering: obstacle must be on same layer or 'both'
      if (obs.layer !== pourLayer && obs.layer !== 'both') {
        continue;
      }

      // If pour has no net, everything is subtract
      if (pourNetId === undefined) {
        subtract.push(obs);
        continue;
      }

      // Same-net → thermal relief, different-net or no-net → subtract
      if (obs.netId !== undefined && obs.netId === pourNetId) {
        thermal.push(obs);
      } else {
        subtract.push(obs);
      }
    }

    return { subtract, thermal };
  }

  /**
   * Get default thermal relief configuration (IPC-compliant defaults).
   */
  static getDefaultThermalConfig(): ThermalReliefConfig {
    return {
      spokeWidth: 0.3,
      gap: 0.3,
      spokeCount: 4,
    };
  }
}
