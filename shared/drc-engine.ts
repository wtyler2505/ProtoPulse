import type { Shape, CircleShape, Connector, DRCRule, DRCViolation, PartState, PcbDrcRuleType } from './component-types';
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

// =============================================================================
// PCB-Level DRC — Net-Aware Board Design Rule Checking
// =============================================================================

/** A PCB trace segment on a specific layer belonging to a net. */
export interface PcbTrace {
  id: string;
  netId: string;
  layer: string;
  width: number; // mils
  points: Array<{ x: number; y: number }>;
}

/** A PCB via connecting layers, belonging to a net. */
export interface PcbVia {
  id: string;
  netId: string;
  x: number;
  y: number;
  drillDiameter: number; // mils
  outerDiameter: number; // mils
}

/** A PCB pad belonging to a component instance and net. */
export interface PcbPad {
  id: string;
  netId: string;
  instanceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Board outline as a closed polygon. */
export interface PcbBoardOutline {
  points: Array<{ x: number; y: number }>;
}

/** Complete set of PCB DRC rule thresholds (all values in mils). */
export interface PcbDrcRuleSet {
  traceClearance: number;
  traceWidthMin: number;
  traceWidthMax: number;
  viaDrillMin: number;
  viaAnnularRing: number;
  padClearance: number;
  silkClearance: number;
  boardEdgeClearance: number;
  copperPourClearance: number;
}

/** Net class with per-net-class rule overrides. */
export interface NetClassRules {
  name: string;
  traceWidth: number; // mils
  clearance: number; // mils
  viaDrill: number; // mils
  viaAnnular: number; // mils
}

/** Manufacturer preset combining a name, description, and rule set. */
export interface ManufacturerPreset {
  name: string;
  description: string;
  rules: PcbDrcRuleSet;
}

/** Input data for a full PCB DRC run. */
export interface PcbDrcInput {
  traces: PcbTrace[];
  vias: PcbVia[];
  pads: PcbPad[];
  outline?: PcbBoardOutline;
}

// -----------------------------------------------------------------------------
// Manufacturer Presets
// -----------------------------------------------------------------------------

export const MANUFACTURER_PRESETS: Record<string, ManufacturerPreset> = {
  basic: {
    name: 'Basic (8/8 mil)',
    description: 'Beginner-friendly rules accepted by most fabs',
    rules: {
      traceClearance: 8,
      traceWidthMin: 8,
      traceWidthMax: 250,
      viaDrillMin: 12,
      viaAnnularRing: 6,
      padClearance: 8,
      silkClearance: 6,
      boardEdgeClearance: 15,
      copperPourClearance: 10,
    },
  },
  standard: {
    name: 'Standard (6/6 mil)',
    description: 'Standard capability for most board houses',
    rules: {
      traceClearance: 6,
      traceWidthMin: 6,
      traceWidthMax: 250,
      viaDrillMin: 10,
      viaAnnularRing: 5,
      padClearance: 6,
      silkClearance: 5,
      boardEdgeClearance: 10,
      copperPourClearance: 8,
    },
  },
  advanced: {
    name: 'Advanced (4/4 mil)',
    description: 'Advanced capability for high-density designs',
    rules: {
      traceClearance: 4,
      traceWidthMin: 4,
      traceWidthMax: 250,
      viaDrillMin: 8,
      viaAnnularRing: 4,
      padClearance: 4,
      silkClearance: 4,
      boardEdgeClearance: 8,
      copperPourClearance: 6,
    },
  },
};

/** Default net class definitions. */
export const DEFAULT_NET_CLASSES: NetClassRules[] = [
  { name: 'default', traceWidth: 10, clearance: 8, viaDrill: 12, viaAnnular: 6 },
  { name: 'power', traceWidth: 20, clearance: 10, viaDrill: 16, viaAnnular: 8 },
  { name: 'signal', traceWidth: 8, clearance: 6, viaDrill: 10, viaAnnular: 5 },
  { name: 'high_speed', traceWidth: 6, clearance: 8, viaDrill: 8, viaAnnular: 4 },
];

// -----------------------------------------------------------------------------
// Geometry Helpers
// -----------------------------------------------------------------------------

/** Euclidean distance between two points. */
function pointDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Minimum distance from a point to a line segment defined by (sx,sy)-(ex,ey).
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): number {
  const dx = ex - sx;
  const dy = ey - sy;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return pointDistance(px, py, sx, sy);
  }
  let t = ((px - sx) * dx + (py - sy) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = sx + t * dx;
  const projY = sy + t * dy;
  return pointDistance(px, py, projX, projY);
}

/**
 * Minimum distance between two line segments.
 */
export function segmentToSegmentDistance(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number,
): number {
  // Check if segments intersect using cross-product orientation test
  if (segmentsIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y)) {
    return 0;
  }

  // Minimum of point-to-segment distances for all four endpoint-segment pairs
  return Math.min(
    pointToSegmentDistance(a1x, a1y, b1x, b1y, b2x, b2y),
    pointToSegmentDistance(a2x, a2y, b1x, b1y, b2x, b2y),
    pointToSegmentDistance(b1x, b1y, a1x, a1y, a2x, a2y),
    pointToSegmentDistance(b2x, b2y, a1x, a1y, a2x, a2y),
  );
}

/** Cross product of vectors (bx-ax,by-ay) and (cx-ax,cy-ay). */
function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** Check if value c is between a and b (inclusive). */
function onSegment(a: number, b: number, c: number): boolean {
  return Math.min(a, b) <= c + 1e-9 && c - 1e-9 <= Math.max(a, b);
}

/** Test whether two line segments intersect. */
function segmentsIntersect(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number,
): boolean {
  const d1 = cross(b1x, b1y, b2x, b2y, a1x, a1y);
  const d2 = cross(b1x, b1y, b2x, b2y, a2x, a2y);
  const d3 = cross(a1x, a1y, a2x, a2y, b1x, b1y);
  const d4 = cross(a1x, a1y, a2x, a2y, b2x, b2y);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Collinear cases
  if (d1 === 0 && onSegment(b1x, b2x, a1x) && onSegment(b1y, b2y, a1y)) {
    return true;
  }
  if (d2 === 0 && onSegment(b1x, b2x, a2x) && onSegment(b1y, b2y, a2y)) {
    return true;
  }
  if (d3 === 0 && onSegment(a1x, a2x, b1x) && onSegment(a1y, a2y, b1y)) {
    return true;
  }
  if (d4 === 0 && onSegment(a1x, a2x, b2x) && onSegment(a1y, a2y, b2y)) {
    return true;
  }

  return false;
}

/**
 * Minimum distance from a point to a closed polygon edge.
 */
export function pointToPolygonDistance(px: number, py: number, polygon: Array<{ x: number; y: number }>): number {
  if (polygon.length < 2) {
    return polygon.length === 1 ? pointDistance(px, py, polygon[0].x, polygon[0].y) : Infinity;
  }

  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const dist = pointToSegmentDistance(px, py, polygon[i].x, polygon[i].y, polygon[j].x, polygon[j].y);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

// -----------------------------------------------------------------------------
// PCB DRC Violation Factory
// -----------------------------------------------------------------------------

function pcbViolation(
  ruleType: PcbDrcRuleType,
  severity: 'error' | 'warning',
  message: string,
  location: { x: number; y: number },
  elementIds: string[],
  actual?: number,
  required?: number,
): DRCViolation {
  return {
    id: nanoid(),
    ruleType,
    severity,
    message,
    shapeIds: elementIds,
    view: 'pcb',
    location,
    actual,
    required,
  };
}

// -----------------------------------------------------------------------------
// PCB DRC Check Functions
// -----------------------------------------------------------------------------

/**
 * Check minimum clearance between traces on the same layer belonging to different nets.
 */
export function checkTraceClearance(traces: PcbTrace[], rules: PcbDrcRuleSet, netClasses?: Map<string, NetClassRules>): DRCViolation[] {
  const violations: DRCViolation[] = [];

  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) {
      const a = traces[i];
      const b = traces[j];

      // Only check traces on the same layer and different nets
      if (a.layer !== b.layer) {
        continue;
      }
      if (a.netId === b.netId) {
        continue;
      }

      // Determine required clearance (use net-class override if available)
      let requiredClearance = rules.traceClearance;
      if (netClasses) {
        const classA = netClasses.get(a.netId);
        const classB = netClasses.get(b.netId);
        if (classA) {
          requiredClearance = Math.max(requiredClearance, classA.clearance);
        }
        if (classB) {
          requiredClearance = Math.max(requiredClearance, classB.clearance);
        }
      }

      // Check each segment pair between the two traces
      let violated = false;
      for (let si = 0; si < a.points.length - 1 && !violated; si++) {
        for (let sj = 0; sj < b.points.length - 1 && !violated; sj++) {
          const dist = segmentToSegmentDistance(
            a.points[si].x,
            a.points[si].y,
            a.points[si + 1].x,
            a.points[si + 1].y,
            b.points[sj].x,
            b.points[sj].y,
            b.points[sj + 1].x,
            b.points[sj + 1].y,
          );

          // Account for trace widths: center-to-center distance minus half-widths
          const edgeDist = dist - a.width / 2 - b.width / 2;

          if (edgeDist < requiredClearance) {
            const midX = (a.points[si].x + b.points[sj].x) / 2;
            const midY = (a.points[si].y + b.points[sj].y) / 2;
            violations.push(
              pcbViolation(
                'trace_clearance',
                'error',
                `Trace clearance ${edgeDist.toFixed(1)}mil is below minimum ${requiredClearance}mil between nets ${a.netId} and ${b.netId}`,
                { x: midX, y: midY },
                [a.id, b.id],
                Math.round(edgeDist * 10) / 10,
                requiredClearance,
              ),
            );
            violated = true;
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Check trace widths against minimum and maximum constraints.
 */
export function checkTraceWidth(traces: PcbTrace[], rules: PcbDrcRuleSet, netClasses?: Map<string, NetClassRules>): DRCViolation[] {
  const violations: DRCViolation[] = [];

  for (const trace of traces) {
    let minWidth = rules.traceWidthMin;
    if (netClasses) {
      const nc = netClasses.get(trace.netId);
      if (nc) {
        minWidth = nc.traceWidth;
      }
    }

    if (trace.width < minWidth) {
      const loc = trace.points.length > 0 ? trace.points[0] : { x: 0, y: 0 };
      violations.push(
        pcbViolation(
          'trace_width_min',
          'error',
          `Trace width ${trace.width}mil is below minimum ${minWidth}mil on net ${trace.netId}`,
          loc,
          [trace.id],
          trace.width,
          minWidth,
        ),
      );
    }

    if (trace.width > rules.traceWidthMax) {
      const loc = trace.points.length > 0 ? trace.points[0] : { x: 0, y: 0 };
      violations.push(
        pcbViolation(
          'trace_width_max',
          'warning',
          `Trace width ${trace.width}mil exceeds maximum ${rules.traceWidthMax}mil on net ${trace.netId}`,
          loc,
          [trace.id],
          trace.width,
          rules.traceWidthMax,
        ),
      );
    }
  }

  return violations;
}

/**
 * Check via drill diameters against minimum.
 */
export function checkViaDrill(vias: PcbVia[], rules: PcbDrcRuleSet, netClasses?: Map<string, NetClassRules>): DRCViolation[] {
  const violations: DRCViolation[] = [];

  for (const via of vias) {
    let minDrill = rules.viaDrillMin;
    if (netClasses) {
      const nc = netClasses.get(via.netId);
      if (nc) {
        minDrill = nc.viaDrill;
      }
    }

    if (via.drillDiameter < minDrill) {
      violations.push(
        pcbViolation(
          'via_drill_min',
          'error',
          `Via drill diameter ${via.drillDiameter}mil is below minimum ${minDrill}mil on net ${via.netId}`,
          { x: via.x, y: via.y },
          [via.id],
          via.drillDiameter,
          minDrill,
        ),
      );
    }
  }

  return violations;
}

/**
 * Check via annular ring: (outerDiameter - drillDiameter) / 2 must meet minimum.
 */
export function checkViaAnnularRing(vias: PcbVia[], rules: PcbDrcRuleSet, netClasses?: Map<string, NetClassRules>): DRCViolation[] {
  const violations: DRCViolation[] = [];

  for (const via of vias) {
    let minAnnular = rules.viaAnnularRing;
    if (netClasses) {
      const nc = netClasses.get(via.netId);
      if (nc) {
        minAnnular = nc.viaAnnular;
      }
    }

    const annularRing = (via.outerDiameter - via.drillDiameter) / 2;
    if (annularRing < minAnnular) {
      violations.push(
        pcbViolation(
          'via_annular_ring',
          'error',
          `Via annular ring ${annularRing.toFixed(1)}mil is below minimum ${minAnnular}mil (outer: ${via.outerDiameter}mil, drill: ${via.drillDiameter}mil)`,
          { x: via.x, y: via.y },
          [via.id],
          Math.round(annularRing * 10) / 10,
          minAnnular,
        ),
      );
    }
  }

  return violations;
}

/**
 * Check minimum clearance between pads on different nets.
 */
export function checkPadClearance(pads: PcbPad[], rules: PcbDrcRuleSet, netClasses?: Map<string, NetClassRules>): DRCViolation[] {
  const violations: DRCViolation[] = [];

  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const a = pads[i];
      const b = pads[j];

      // Same net: exempt from clearance check
      if (a.netId === b.netId) {
        continue;
      }

      let requiredClearance = rules.padClearance;
      if (netClasses) {
        const classA = netClasses.get(a.netId);
        const classB = netClasses.get(b.netId);
        if (classA) {
          requiredClearance = Math.max(requiredClearance, classA.clearance);
        }
        if (classB) {
          requiredClearance = Math.max(requiredClearance, classB.clearance);
        }
      }

      // Calculate edge-to-edge distance using AABB
      const aLeft = a.x - a.width / 2;
      const aRight = a.x + a.width / 2;
      const aTop = a.y - a.height / 2;
      const aBottom = a.y + a.height / 2;

      const bLeft = b.x - b.width / 2;
      const bRight = b.x + b.width / 2;
      const bTop = b.y - b.height / 2;
      const bBottom = b.y + b.height / 2;

      const dx = Math.max(0, Math.max(aLeft - bRight, bLeft - aRight));
      const dy = Math.max(0, Math.max(aTop - bBottom, bTop - aBottom));
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < requiredClearance) {
        violations.push(
          pcbViolation(
            'pad_clearance',
            'error',
            `Pad clearance ${dist.toFixed(1)}mil is below minimum ${requiredClearance}mil between nets ${a.netId} and ${b.netId}`,
            { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            [a.id, b.id],
            Math.round(dist * 10) / 10,
            requiredClearance,
          ),
        );
      }
    }
  }

  return violations;
}

/**
 * Check board edge clearance for traces, pads, and vias.
 */
export function checkBoardEdgeClearance(
  traces: PcbTrace[],
  pads: PcbPad[],
  vias: PcbVia[],
  outline: PcbBoardOutline,
  rules: PcbDrcRuleSet,
): DRCViolation[] {
  const violations: DRCViolation[] = [];
  const poly = outline.points;
  if (poly.length < 3) {
    return violations;
  }

  // Check trace points against board edge
  for (const trace of traces) {
    for (const pt of trace.points) {
      const dist = pointToPolygonDistance(pt.x, pt.y, poly);
      const edgeDist = dist - trace.width / 2;
      if (edgeDist < rules.boardEdgeClearance) {
        violations.push(
          pcbViolation(
            'board_edge_clearance',
            'error',
            `Trace is ${edgeDist.toFixed(1)}mil from board edge, minimum is ${rules.boardEdgeClearance}mil`,
            pt,
            [trace.id],
            Math.round(edgeDist * 10) / 10,
            rules.boardEdgeClearance,
          ),
        );
        break; // One violation per trace
      }
    }
  }

  // Check pads against board edge
  for (const pad of pads) {
    const dist = pointToPolygonDistance(pad.x, pad.y, poly);
    const padRadius = Math.max(pad.width, pad.height) / 2;
    const edgeDist = dist - padRadius;
    if (edgeDist < rules.boardEdgeClearance) {
      violations.push(
        pcbViolation(
          'board_edge_clearance',
          'error',
          `Pad is ${edgeDist.toFixed(1)}mil from board edge, minimum is ${rules.boardEdgeClearance}mil`,
          { x: pad.x, y: pad.y },
          [pad.id],
          Math.round(edgeDist * 10) / 10,
          rules.boardEdgeClearance,
        ),
      );
    }
  }

  // Check vias against board edge
  for (const via of vias) {
    const dist = pointToPolygonDistance(via.x, via.y, poly);
    const edgeDist = dist - via.outerDiameter / 2;
    if (edgeDist < rules.boardEdgeClearance) {
      violations.push(
        pcbViolation(
          'board_edge_clearance',
          'error',
          `Via is ${edgeDist.toFixed(1)}mil from board edge, minimum is ${rules.boardEdgeClearance}mil`,
          { x: via.x, y: via.y },
          [via.id],
          Math.round(edgeDist * 10) / 10,
          rules.boardEdgeClearance,
        ),
      );
    }
  }

  return violations;
}

/**
 * Run all PCB-level DRC checks and return combined violations.
 */
export function runPcbDrc(
  data: PcbDrcInput,
  rules: PcbDrcRuleSet,
  netClasses?: Map<string, NetClassRules>,
): DRCViolation[] {
  const violations: DRCViolation[] = [];

  violations.push(...checkTraceClearance(data.traces, rules, netClasses));
  violations.push(...checkTraceWidth(data.traces, rules, netClasses));
  violations.push(...checkViaDrill(data.vias, rules, netClasses));
  violations.push(...checkViaAnnularRing(data.vias, rules, netClasses));
  violations.push(...checkPadClearance(data.pads, rules, netClasses));

  if (data.outline) {
    violations.push(...checkBoardEdgeClearance(data.traces, data.pads, data.vias, data.outline, rules));
  }

  return violations;
}
