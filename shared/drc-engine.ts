import type { Shape, CircleShape, Connector, DRCRule, DRCViolation, PartState } from './component-types';
import { nanoid } from 'nanoid';

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shapeToAABB(shape: Shape): AABB {
  if (shape.type === 'circle') {
    const c = shape as CircleShape;
    const r = Math.min(c.width, c.height) / 2;
    return { minX: c.cx - r, minY: c.cy - r, maxX: c.cx + r, maxY: c.cy + r };
  }
  return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.width, maxY: shape.y + shape.height };
}

function aabbDistance(a: AABB, b: AABB): number {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.sqrt(dx * dx + dy * dy);
}

function aabbOverlaps(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function aabbCenter(a: AABB): { x: number; y: number } {
  return { x: (a.minX + a.maxX) / 2, y: (a.minY + a.maxY) / 2 };
}

class SpatialGrid {
  private cellSize: number;
  private cells: Map<string, Set<string>> = new Map();
  private bounds: Map<string, AABB> = new Map();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  insert(id: string, aabb: AABB): void {
    this.bounds.set(id, aabb);
    const x0 = Math.floor(aabb.minX / this.cellSize);
    const y0 = Math.floor(aabb.minY / this.cellSize);
    const x1 = Math.floor(aabb.maxX / this.cellSize);
    const y1 = Math.floor(aabb.maxY / this.cellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        if (!this.cells.has(k)) this.cells.set(k, new Set());
        this.cells.get(k)!.add(id);
      }
    }
  }

  query(aabb: AABB): Set<string> {
    const result = new Set<string>();
    const x0 = Math.floor(aabb.minX / this.cellSize);
    const y0 = Math.floor(aabb.minY / this.cellSize);
    const x1 = Math.floor(aabb.maxX / this.cellSize);
    const y1 = Math.floor(aabb.maxY / this.cellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (cell) cell.forEach(id => result.add(id));
      }
    }
    return result;
  }

  getBounds(id: string): AABB | undefined {
    return this.bounds.get(id);
  }
}

function getShapeLayer(shape: Shape): string {
  return shape.layer || 'default';
}

function isCopperLayer(layer: string): boolean {
  return layer === 'copper-front' || layer === 'copper-back';
}

function isSilkLayer(layer: string): boolean {
  return layer.startsWith('silk');
}

function isCourtyardLayer(layer: string): boolean {
  return layer.startsWith('courtyard');
}

function sharesLayer(layerA: string, layerB: string): boolean {
  if (layerA === 'default' || layerB === 'default') return true;
  return layerA === layerB;
}

export function getDefaultDRCRules(): DRCRule[] {
  return [
    { type: 'min-clearance', params: { minClearance: 8 }, severity: 'error', enabled: true },
    { type: 'min-trace-width', params: { minWidth: 6 }, severity: 'error', enabled: true },
    { type: 'pad-size', params: { minPadDiameter: 40, minDrillDiameter: 20 }, severity: 'warning', enabled: true },
    { type: 'pin-spacing', params: { standardPitchMils: 100 }, severity: 'warning', enabled: true },
    { type: 'silk-overlap', params: {}, severity: 'warning', enabled: true },
    { type: 'courtyard-overlap', params: { minCourtyard: 10 }, severity: 'error', enabled: true },
  ];
}

function checkMinClearance(
  shapes: Shape[],
  rule: DRCRule,
  grid: SpatialGrid,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const minClearance = rule.params.minClearance ?? 8;
  const checked = new Set<string>();

  for (const shape of shapes) {
    const layerA = getShapeLayer(shape);
    if (!isCopperLayer(layerA) && layerA !== 'default') continue;

    const aabb = shapeToAABB(shape);
    const expanded: AABB = {
      minX: aabb.minX - minClearance,
      minY: aabb.minY - minClearance,
      maxX: aabb.maxX + minClearance,
      maxY: aabb.maxY + minClearance,
    };

    const candidates = Array.from(grid.query(expanded));
    for (const candidateId of candidates) {
      if (candidateId === shape.id) continue;
      const pairKey = [shape.id, candidateId].sort().join(':');
      if (checked.has(pairKey)) continue;
      checked.add(pairKey);

      const other = shapes.find(s => s.id === candidateId);
      if (!other) continue;

      const layerB = getShapeLayer(other);
      if (!isCopperLayer(layerB) && layerB !== 'default') continue;
      if (!sharesLayer(layerA, layerB)) continue;

      const otherAABB = grid.getBounds(candidateId);
      if (!otherAABB) continue;

      const dist = aabbDistance(aabb, otherAABB);
      if (dist < minClearance && dist >= 0) {
        const center = aabbCenter(aabb);
        violations.push({
          id: nanoid(),
          ruleType: 'min-clearance',
          severity: rule.severity,
          message: `Clearance ${dist.toFixed(1)}px between shapes is below minimum ${minClearance}px`,
          shapeIds: [shape.id, candidateId],
          view,
          location: center,
          actual: Math.round(dist * 10) / 10,
          required: minClearance,
        });
      }
    }
  }

  return violations;
}

function checkMinTraceWidth(
  shapes: Shape[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const minWidth = rule.params.minWidth ?? 6;

  for (const shape of shapes) {
    if (shape.type !== 'path') continue;
    const sw = shape.style?.strokeWidth ?? 1;
    if (sw < minWidth) {
      violations.push({
        id: nanoid(),
        ruleType: 'min-trace-width',
        severity: rule.severity,
        message: `Trace width ${sw}px is below minimum ${minWidth}px`,
        shapeIds: [shape.id],
        view,
        location: { x: shape.x, y: shape.y },
        actual: sw,
        required: minWidth,
      });
    }
  }

  return violations;
}

function checkPadSize(
  connectors: Connector[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const minPadDiameter = rule.params.minPadDiameter ?? 40;
  const minDrillDiameter = rule.params.minDrillDiameter ?? 20;

  for (const conn of connectors) {
    if (!conn.padSpec) continue;
    const pad = conn.padSpec;
    const pos = conn.terminalPositions[view];

    if (pad.diameter !== undefined && pad.diameter < minPadDiameter) {
      violations.push({
        id: nanoid(),
        ruleType: 'pad-size',
        severity: rule.severity,
        message: `Pad "${conn.name}" diameter ${pad.diameter}px is below minimum ${minPadDiameter}px`,
        shapeIds: [],
        view,
        location: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
        actual: pad.diameter,
        required: minPadDiameter,
      });
    }

    if (pad.type === 'tht' && pad.drill !== undefined && pad.drill < minDrillDiameter) {
      violations.push({
        id: nanoid(),
        ruleType: 'pad-size',
        severity: rule.severity,
        message: `Pad "${conn.name}" drill diameter ${pad.drill}px is below minimum ${minDrillDiameter}px`,
        shapeIds: [],
        view,
        location: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
        actual: pad.drill,
        required: minDrillDiameter,
      });
    }
  }

  return violations;
}

function checkPinSpacing(
  connectors: Connector[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const standardPitch = rule.params.standardPitchMils ?? 100;

  const positioned = connectors
    .map(c => ({ conn: c, pos: c.terminalPositions[view] }))
    .filter(p => p.pos !== undefined);

  for (let i = 0; i < positioned.length; i++) {
    for (let j = i + 1; j < positioned.length; j++) {
      const a = positioned[i];
      const b = positioned[j];
      const dx = Math.abs(a.pos.x - b.pos.x);
      const dy = Math.abs(a.pos.y - b.pos.y);

      if (dx > 0 && dy === 0) {
        const remainder = dx % standardPitch;
        if (remainder > 1 && remainder < standardPitch - 1) {
          violations.push({
            id: nanoid(),
            ruleType: 'pin-spacing',
            severity: rule.severity,
            message: `Pins "${a.conn.name}" and "${b.conn.name}" spacing ${dx.toFixed(0)}px doesn't match standard pitch ${standardPitch}px`,
            shapeIds: [],
            view,
            location: { x: (a.pos.x + b.pos.x) / 2, y: a.pos.y },
            actual: dx,
            required: standardPitch,
          });
        }
      } else if (dy > 0 && dx === 0) {
        const remainder = dy % standardPitch;
        if (remainder > 1 && remainder < standardPitch - 1) {
          violations.push({
            id: nanoid(),
            ruleType: 'pin-spacing',
            severity: rule.severity,
            message: `Pins "${a.conn.name}" and "${b.conn.name}" spacing ${dy.toFixed(0)}px doesn't match standard pitch ${standardPitch}px`,
            shapeIds: [],
            view,
            location: { x: a.pos.x, y: (a.pos.y + b.pos.y) / 2 },
            actual: dy,
            required: standardPitch,
          });
        }
      }
    }
  }

  return violations;
}

function checkSilkOverlap(
  shapes: Shape[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];

  const silkShapes = shapes.filter(s => isSilkLayer(getShapeLayer(s)));
  const copperShapes = shapes.filter(s => {
    const l = getShapeLayer(s);
    return isCopperLayer(l) || l === 'default';
  });

  for (const silk of silkShapes) {
    const silkAABB = shapeToAABB(silk);
    for (const copper of copperShapes) {
      const copperAABB = shapeToAABB(copper);
      if (aabbOverlaps(silkAABB, copperAABB)) {
        const center = aabbCenter(silkAABB);
        violations.push({
          id: nanoid(),
          ruleType: 'silk-overlap',
          severity: rule.severity,
          message: `Silkscreen shape overlaps copper pad`,
          shapeIds: [silk.id, copper.id],
          view,
          location: center,
        });
      }
    }
  }

  return violations;
}

function checkCourtyardOverlap(
  shapes: Shape[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const minCourtyard = rule.params.minCourtyard ?? 10;

  const courtyardShapes = shapes.filter(s => isCourtyardLayer(getShapeLayer(s)));

  for (let i = 0; i < courtyardShapes.length; i++) {
    for (let j = i + 1; j < courtyardShapes.length; j++) {
      const a = shapeToAABB(courtyardShapes[i]);
      const b = shapeToAABB(courtyardShapes[j]);

      const expandedA: AABB = {
        minX: a.minX - minCourtyard / 2,
        minY: a.minY - minCourtyard / 2,
        maxX: a.maxX + minCourtyard / 2,
        maxY: a.maxY + minCourtyard / 2,
      };

      if (aabbOverlaps(expandedA, b)) {
        const dist = aabbDistance(a, b);
        const center = aabbCenter(a);
        violations.push({
          id: nanoid(),
          ruleType: 'courtyard-overlap',
          severity: rule.severity,
          message: `Courtyard shapes are too close (${dist.toFixed(1)}px, minimum ${minCourtyard}px)`,
          shapeIds: [courtyardShapes[i].id, courtyardShapes[j].id],
          view,
          location: center,
          actual: Math.round(dist * 10) / 10,
          required: minCourtyard,
        });
      }
    }
  }

  return violations;
}

export function runDRC(
  partState: PartState,
  rules: DRCRule[],
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const viewData = partState.views[view];
  const shapes = viewData.shapes;
  const connectors = partState.connectors;
  const violations: DRCViolation[] = [];

  const grid = new SpatialGrid(50);
  for (const shape of shapes) {
    grid.insert(shape.id, shapeToAABB(shape));
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case 'min-clearance':
        violations.push(...checkMinClearance(shapes, rule, grid, view));
        break;
      case 'min-trace-width':
        violations.push(...checkMinTraceWidth(shapes, rule, view));
        break;
      case 'pad-size':
        violations.push(...checkPadSize(connectors, rule, view));
        break;
      case 'pin-spacing':
        violations.push(...checkPinSpacing(connectors, rule, view));
        break;
      case 'silk-overlap':
        violations.push(...checkSilkOverlap(shapes, rule, view));
        break;
      case 'courtyard-overlap':
        violations.push(...checkCourtyardOverlap(shapes, rule, view));
        break;
    }
  }

  return violations;
}
