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
    { type: 'annular-ring', params: { minAnnularRing: 5 }, severity: 'error', enabled: true },
    { type: 'thermal-relief', params: { minSpokeWidth: 8, minSpokeCount: 2 }, severity: 'warning', enabled: true },
    { type: 'trace-to-edge', params: { minEdgeClearance: 10 }, severity: 'error', enabled: true },
    { type: 'via-in-pad', params: {}, severity: 'warning', enabled: true },
    { type: 'solder-mask', params: { minSolderMaskDam: 4, minSolderMaskExpansion: 2 }, severity: 'warning', enabled: true },
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

      const dist = aabbDistance(a, b);
      if (dist < minCourtyard) {
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

function isEdgeLayer(layer: string): boolean {
  return layer === 'edge' || layer === 'board-outline' || layer === 'edge-cuts';
}

function isSolderMaskLayer(layer: string): boolean {
  return layer.startsWith('mask') || layer.startsWith('solder-mask');
}

function checkAnnularRing(
  connectors: Connector[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const minAnnularRing = rule.params.minAnnularRing ?? 5;

  for (const conn of connectors) {
    if (!conn.padSpec) continue;
    const pad = conn.padSpec;
    if (pad.type !== 'tht') continue;
    if (pad.diameter === undefined || pad.drill === undefined) continue;

    const annularRing = (pad.diameter - pad.drill) / 2;
    if (annularRing < minAnnularRing) {
      const pos = conn.terminalPositions[view];
      violations.push({
        id: nanoid(),
        ruleType: 'annular-ring',
        severity: rule.severity,
        message: `Pad "${conn.name}" annular ring ${annularRing.toFixed(1)}px is below minimum ${minAnnularRing}px (pad: ${pad.diameter}px, drill: ${pad.drill}px)`,
        shapeIds: [],
        view,
        location: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
        actual: Math.round(annularRing * 10) / 10,
        required: minAnnularRing,
      });
    }
  }

  return violations;
}

function checkThermalRelief(
  shapes: Shape[],
  connectors: Connector[],
  rule: DRCRule,
  grid: SpatialGrid,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const minSpokeWidth = rule.params.minSpokeWidth ?? 8;
  const minSpokeCount = rule.params.minSpokeCount ?? 2;

  // Find copper pour shapes (large copper rectangles that act as ground/power planes).
  // A shape is considered a copper pour if it is on a copper layer and its area exceeds
  // a threshold (arbitrarily: area > 10,000 px^2, roughly 100x100).
  const copperPours = shapes.filter((s) => {
    const layer = getShapeLayer(s);
    if (!isCopperLayer(layer) && layer !== 'default') return false;
    const area = s.width * s.height;
    return area > 10000;
  });

  if (copperPours.length === 0) return violations;

  for (const conn of connectors) {
    if (!conn.padSpec) continue;
    const pad = conn.padSpec;
    if (pad.type !== 'tht') continue;

    const pos = conn.terminalPositions[view];
    if (!pos) continue;

    // Check if this pad sits within a copper pour
    const padRadius = (pad.diameter ?? 40) / 2;
    const padAABB: AABB = {
      minX: pos.x - padRadius,
      minY: pos.y - padRadius,
      maxX: pos.x + padRadius,
      maxY: pos.y + padRadius,
    };

    for (const pour of copperPours) {
      const pourAABB = shapeToAABB(pour);
      if (!aabbOverlaps(padAABB, pourAABB)) continue;

      // Pad is inside a copper pour — check for thermal relief traces.
      // Look for path shapes (traces) that connect to this pad within the pour.
      const searchAABB: AABB = {
        minX: padAABB.minX - minSpokeWidth * 2,
        minY: padAABB.minY - minSpokeWidth * 2,
        maxX: padAABB.maxX + minSpokeWidth * 2,
        maxY: padAABB.maxY + minSpokeWidth * 2,
      };
      const nearby = Array.from(grid.query(searchAABB));
      let spokeCount = 0;
      let thinSpoke = false;

      for (const sid of nearby) {
        const shape = shapes.find((s) => s.id === sid);
        if (!shape || shape.type !== 'path') continue;
        const sw = shape.style?.strokeWidth ?? 1;
        spokeCount++;
        if (sw < minSpokeWidth) {
          thinSpoke = true;
        }
      }

      if (spokeCount > 0 && spokeCount < minSpokeCount) {
        violations.push({
          id: nanoid(),
          ruleType: 'thermal-relief',
          severity: rule.severity,
          message: `Pad "${conn.name}" has ${spokeCount} thermal relief spoke(s) in copper pour, minimum is ${minSpokeCount}`,
          shapeIds: [pour.id],
          view,
          location: { x: pos.x, y: pos.y },
          actual: spokeCount,
          required: minSpokeCount,
        });
      }

      if (thinSpoke) {
        violations.push({
          id: nanoid(),
          ruleType: 'thermal-relief',
          severity: rule.severity,
          message: `Pad "${conn.name}" has thermal relief spoke(s) thinner than minimum ${minSpokeWidth}px`,
          shapeIds: [pour.id],
          view,
          location: { x: pos.x, y: pos.y },
          actual: undefined,
          required: minSpokeWidth,
        });
      }
    }
  }

  return violations;
}

function checkTraceToEdge(
  shapes: Shape[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const minEdgeClearance = rule.params.minEdgeClearance ?? 10;

  const edgeShapes = shapes.filter((s) => isEdgeLayer(getShapeLayer(s)));
  if (edgeShapes.length === 0) return violations;

  const copperShapes = shapes.filter((s) => {
    const layer = getShapeLayer(s);
    return isCopperLayer(layer) || layer === 'default';
  });

  for (const copper of copperShapes) {
    const copperAABB = shapeToAABB(copper);
    for (const edge of edgeShapes) {
      const edgeAABB = shapeToAABB(edge);
      const dist = aabbDistance(copperAABB, edgeAABB);

      // If copper overlaps edge or is too close, it is a violation.
      // We also check if the copper is inside the edge bounds but too close to the boundary.
      if (dist < minEdgeClearance) {
        const center = aabbCenter(copperAABB);
        violations.push({
          id: nanoid(),
          ruleType: 'trace-to-edge',
          severity: rule.severity,
          message: `Copper shape is ${dist.toFixed(1)}px from board edge, minimum is ${minEdgeClearance}px`,
          shapeIds: [copper.id, edge.id],
          view,
          location: center,
          actual: Math.round(dist * 10) / 10,
          required: minEdgeClearance,
        });
      }
    }
  }

  return violations;
}

function checkViaInPad(
  connectors: Connector[],
  shapes: Shape[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];

  // Find SMD pad connectors
  const smdConnectors = connectors.filter((c) => c.padSpec?.type === 'smd');
  if (smdConnectors.length === 0) return violations;

  // Find via shapes — circles on copper layers with small diameter (heuristic: diameter <= 30px)
  // and that have a THT-like appearance. In the component model, vias are typically small circle shapes
  // on copper layers.
  const viaShapes = shapes.filter((s) => {
    if (s.type !== 'circle') return false;
    const layer = getShapeLayer(s);
    if (!isCopperLayer(layer) && layer !== 'default') return false;
    const diameter = Math.min(s.width, s.height);
    return diameter <= 30;
  });

  for (const conn of smdConnectors) {
    const pos = conn.terminalPositions[view];
    if (!pos) continue;

    const padWidth = conn.padSpec?.width ?? conn.padSpec?.diameter ?? 20;
    const padHeight = conn.padSpec?.height ?? conn.padSpec?.diameter ?? 20;
    const padAABB: AABB = {
      minX: pos.x - padWidth / 2,
      minY: pos.y - padHeight / 2,
      maxX: pos.x + padWidth / 2,
      maxY: pos.y + padHeight / 2,
    };

    for (const via of viaShapes) {
      const viaAABB = shapeToAABB(via);
      if (aabbOverlaps(padAABB, viaAABB)) {
        violations.push({
          id: nanoid(),
          ruleType: 'via-in-pad',
          severity: rule.severity,
          message: `Via detected in SMD pad "${conn.name}" — may cause solder wicking unless filled/capped`,
          shapeIds: [via.id],
          view,
          location: { x: pos.x, y: pos.y },
        });
      }
    }
  }

  return violations;
}

function checkSolderMask(
  shapes: Shape[],
  connectors: Connector[],
  rule: DRCRule,
  view: 'breadboard' | 'schematic' | 'pcb'
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const minDam = rule.params.minSolderMaskDam ?? 4;
  const minExpansion = rule.params.minSolderMaskExpansion ?? 2;

  // Check solder mask expansion: mask openings should extend beyond pads by at least minExpansion.
  // Mask shapes represent mask openings. Each should be larger than its corresponding copper pad.
  const maskShapes = shapes.filter((s) => isSolderMaskLayer(getShapeLayer(s)));
  const copperShapes = shapes.filter((s) => {
    const layer = getShapeLayer(s);
    return isCopperLayer(layer) || layer === 'default';
  });

  // Check mask expansion: each mask shape that overlaps copper should be at least minExpansion bigger
  for (const mask of maskShapes) {
    const maskAABB = shapeToAABB(mask);
    for (const copper of copperShapes) {
      const copperAABB = shapeToAABB(copper);
      if (!aabbOverlaps(maskAABB, copperAABB)) continue;

      // Mask should extend beyond copper on each side by at least minExpansion
      const leftExp = copperAABB.minX - maskAABB.minX;
      const rightExp = maskAABB.maxX - copperAABB.maxX;
      const topExp = copperAABB.minY - maskAABB.minY;
      const bottomExp = maskAABB.maxY - copperAABB.maxY;
      const minActualExp = Math.min(leftExp, rightExp, topExp, bottomExp);

      if (minActualExp < minExpansion) {
        const center = aabbCenter(maskAABB);
        violations.push({
          id: nanoid(),
          ruleType: 'solder-mask',
          severity: rule.severity,
          message: `Solder mask expansion ${minActualExp.toFixed(1)}px is below minimum ${minExpansion}px`,
          shapeIds: [mask.id, copper.id],
          view,
          location: center,
          actual: Math.round(minActualExp * 10) / 10,
          required: minExpansion,
        });
      }
    }
  }

  // Check solder mask dam width between adjacent pads
  // Dam is the mask material remaining between two pad openings
  const positioned = connectors
    .filter((c) => c.padSpec !== undefined)
    .map((c) => {
      const pos = c.terminalPositions[view];
      const padW = c.padSpec?.width ?? c.padSpec?.diameter ?? 20;
      const padH = c.padSpec?.height ?? c.padSpec?.diameter ?? 20;
      const expansion = minExpansion;
      return {
        conn: c,
        pos,
        openingAABB: pos
          ? {
              minX: pos.x - padW / 2 - expansion,
              minY: pos.y - padH / 2 - expansion,
              maxX: pos.x + padW / 2 + expansion,
              maxY: pos.y + padH / 2 + expansion,
            }
          : null,
      };
    })
    .filter((p) => p.pos !== undefined && p.openingAABB !== null);

  for (let i = 0; i < positioned.length; i++) {
    for (let j = i + 1; j < positioned.length; j++) {
      const a = positioned[i];
      const b = positioned[j];
      const dist = aabbDistance(a.openingAABB!, b.openingAABB!);

      if (dist < minDam) {
        violations.push({
          id: nanoid(),
          ruleType: 'solder-mask',
          severity: rule.severity,
          message: `Solder mask dam between pads "${a.conn.name}" and "${b.conn.name}" is ${dist.toFixed(1)}px, minimum is ${minDam}px`,
          shapeIds: [],
          view,
          location: {
            x: (a.pos!.x + b.pos!.x) / 2,
            y: (a.pos!.y + b.pos!.y) / 2,
          },
          actual: Math.round(dist * 10) / 10,
          required: minDam,
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
      case 'annular-ring':
        violations.push(...checkAnnularRing(connectors, rule, view));
        break;
      case 'thermal-relief':
        violations.push(...checkThermalRelief(shapes, connectors, rule, grid, view));
        break;
      case 'trace-to-edge':
        violations.push(...checkTraceToEdge(shapes, rule, view));
        break;
      case 'via-in-pad':
        violations.push(...checkViaInPad(connectors, shapes, rule, view));
        break;
      case 'solder-mask':
        violations.push(...checkSolderMask(shapes, connectors, rule, view));
        break;
    }
  }

  return violations;
}
