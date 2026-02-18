import type { Shape, CircleShape, Constraint, ConstraintType } from '@shared/component-types';
import { nanoid } from 'nanoid';

const MAX_ITERATIONS = 10;
const CONVERGENCE_THRESHOLD = 0.01;

export function getShapeCenter(shape: Shape): { x: number; y: number } {
  if (shape.type === 'circle') {
    const c = shape as CircleShape;
    return { x: c.cx, y: c.cy };
  }
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

function setShapeCenter(shape: Shape, x: number, y: number): void {
  if (shape.type === 'circle') {
    const c = shape as CircleShape;
    c.cx = x;
    c.cy = y;
    c.x = x - c.width / 2;
    c.y = y - c.height / 2;
  } else {
    shape.x = x - shape.width / 2;
    shape.y = y - shape.height / 2;
  }
}

function findShape(shapes: Shape[], id: string): Shape | undefined {
  return shapes.find(s => s.id === id);
}

function solveDistance(shapes: Shape[], constraint: Constraint, anchorId: string): string[] {
  const adjusted: string[] = [];
  const distance = Number(constraint.params.distance) || 0;
  const axis = (constraint.params.axis as string) || 'any';

  const anchor = findShape(shapes, anchorId);
  if (!anchor) return adjusted;
  const anchorCenter = getShapeCenter(anchor);

  for (const sid of constraint.shapeIds) {
    if (sid === anchorId) continue;
    const target = findShape(shapes, sid);
    if (!target) continue;

    const targetCenter = getShapeCenter(target);

    if (axis === 'x') {
      const sign = targetCenter.x >= anchorCenter.x ? 1 : -1;
      const newX = anchorCenter.x + sign * distance;
      if (Math.abs(targetCenter.x - newX) > CONVERGENCE_THRESHOLD) {
        setShapeCenter(target, newX, targetCenter.y);
        adjusted.push(sid);
      }
    } else if (axis === 'y') {
      const sign = targetCenter.y >= anchorCenter.y ? 1 : -1;
      const newY = anchorCenter.y + sign * distance;
      if (Math.abs(targetCenter.y - newY) > CONVERGENCE_THRESHOLD) {
        setShapeCenter(target, targetCenter.x, newY);
        adjusted.push(sid);
      }
    } else {
      const dx = targetCenter.x - anchorCenter.x;
      const dy = targetCenter.y - anchorCenter.y;
      const currentDist = Math.sqrt(dx * dx + dy * dy);

      if (currentDist < CONVERGENCE_THRESHOLD) {
        const newX = anchorCenter.x + distance;
        if (Math.abs(targetCenter.x - newX) > CONVERGENCE_THRESHOLD) {
          setShapeCenter(target, newX, targetCenter.y);
          adjusted.push(sid);
        }
      } else {
        const scale = distance / currentDist;
        const newX = anchorCenter.x + dx * scale;
        const newY = anchorCenter.y + dy * scale;
        if (Math.abs(targetCenter.x - newX) > CONVERGENCE_THRESHOLD || Math.abs(targetCenter.y - newY) > CONVERGENCE_THRESHOLD) {
          setShapeCenter(target, newX, newY);
          adjusted.push(sid);
        }
      }
    }
  }

  return adjusted;
}

function solveAlignment(shapes: Shape[], constraint: Constraint, anchorId: string): string[] {
  const adjusted: string[] = [];
  const axis = (constraint.params.axis as string) || 'x';

  const anchor = findShape(shapes, anchorId);
  if (!anchor) return adjusted;
  const anchorCenter = getShapeCenter(anchor);

  for (const sid of constraint.shapeIds) {
    if (sid === anchorId) continue;
    const target = findShape(shapes, sid);
    if (!target) continue;

    const targetCenter = getShapeCenter(target);

    if (axis === 'x') {
      if (Math.abs(targetCenter.x - anchorCenter.x) > CONVERGENCE_THRESHOLD) {
        setShapeCenter(target, anchorCenter.x, targetCenter.y);
        adjusted.push(sid);
      }
    } else {
      if (Math.abs(targetCenter.y - anchorCenter.y) > CONVERGENCE_THRESHOLD) {
        setShapeCenter(target, targetCenter.x, anchorCenter.y);
        adjusted.push(sid);
      }
    }
  }

  return adjusted;
}

function solvePitch(shapes: Shape[], constraint: Constraint, anchorId: string): string[] {
  const adjusted: string[] = [];
  const pitch = Number(constraint.params.pitch) || 0;
  const axis = (constraint.params.axis as string) || 'x';

  const anchor = findShape(shapes, anchorId);
  if (!anchor) return adjusted;
  const anchorCenter = getShapeCenter(anchor);

  const anchorIdx = constraint.shapeIds.indexOf(anchorId);
  if (anchorIdx === -1) return adjusted;

  for (let i = 0; i < constraint.shapeIds.length; i++) {
    const sid = constraint.shapeIds[i];
    if (sid === anchorId) continue;
    const target = findShape(shapes, sid);
    if (!target) continue;

    const offset = (i - anchorIdx) * pitch;
    const targetCenter = getShapeCenter(target);

    if (axis === 'x') {
      const newX = anchorCenter.x + offset;
      if (Math.abs(targetCenter.x - newX) > CONVERGENCE_THRESHOLD) {
        setShapeCenter(target, newX, targetCenter.y);
        adjusted.push(sid);
      }
    } else {
      const newY = anchorCenter.y + offset;
      if (Math.abs(targetCenter.y - newY) > CONVERGENCE_THRESHOLD) {
        setShapeCenter(target, targetCenter.x, newY);
        adjusted.push(sid);
      }
    }
  }

  return adjusted;
}

function solveFixed(shapes: Shape[], constraint: Constraint): string[] {
  const adjusted: string[] = [];
  const fixedX = Number(constraint.params.x) || 0;
  const fixedY = Number(constraint.params.y) || 0;

  for (const sid of constraint.shapeIds) {
    const target = findShape(shapes, sid);
    if (!target) continue;

    const center = getShapeCenter(target);
    if (Math.abs(center.x - fixedX) > CONVERGENCE_THRESHOLD || Math.abs(center.y - fixedY) > CONVERGENCE_THRESHOLD) {
      setShapeCenter(target, fixedX, fixedY);
      adjusted.push(sid);
    }
  }

  return adjusted;
}

function solveConstraint(shapes: Shape[], constraint: Constraint, anchorId: string): string[] {
  switch (constraint.type) {
    case 'distance':
      return solveDistance(shapes, constraint, anchorId);
    case 'alignment':
      return solveAlignment(shapes, constraint, anchorId);
    case 'pitch':
      return solvePitch(shapes, constraint, anchorId);
    case 'fixed':
      return solveFixed(shapes, constraint);
    case 'symmetric':
    case 'equal':
      return [];
    default:
      return [];
  }
}

export function applyConstraints(shapes: Shape[], constraints: Constraint[], movedShapeId: string): Shape[] {
  const workingShapes: Shape[] = JSON.parse(JSON.stringify(shapes));
  const enabledConstraints = constraints.filter(c => c.enabled);

  if (enabledConstraints.length === 0) return workingShapes;

  const constraintsByShape = new Map<string, Constraint[]>();
  for (const c of enabledConstraints) {
    for (const sid of c.shapeIds) {
      const existing = constraintsByShape.get(sid) || [];
      existing.push(c);
      constraintsByShape.set(sid, existing);
    }
  }

  let dirtySet = new Set<string>([movedShapeId]);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const nextDirty = new Set<string>();

    for (const shapeId of Array.from(dirtySet)) {
      const relatedConstraints = constraintsByShape.get(shapeId) || [];
      for (const constraint of relatedConstraints) {
        const adjustedIds = solveConstraint(workingShapes, constraint, shapeId);
        for (const id of adjustedIds) {
          if (id !== movedShapeId) {
            nextDirty.add(id);
          }
        }
      }
    }

    if (nextDirty.size === 0) break;
    dirtySet = nextDirty;
  }

  return workingShapes;
}

export function detectConflicts(constraints: Constraint[], shapes: Shape[]): string[] {
  const enabledConstraints = constraints.filter(c => c.enabled);
  if (enabledConstraints.length === 0) return [];

  const conflictIds: string[] = [];

  for (const constraint of enabledConstraints) {
    const validShapeIds = constraint.shapeIds.filter(sid => findShape(shapes, sid));
    if (validShapeIds.length === 0) continue;

    const testShapes: Shape[] = JSON.parse(JSON.stringify(shapes));
    const anchorId = validShapeIds[0];

    let converged = false;
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const adjusted = solveConstraint(testShapes, constraint, anchorId);
      if (adjusted.length === 0) {
        converged = true;
        break;
      }
    }

    if (!converged) {
      conflictIds.push(constraint.id);
    }
  }

  return conflictIds;
}

export function createConstraint(
  type: ConstraintType,
  shapeIds: string[],
  params?: Record<string, number | string>
): Constraint {
  const defaults: Record<ConstraintType, Record<string, number | string>> = {
    distance: { distance: 100, axis: 'any' },
    alignment: { axis: 'x' },
    pitch: { pitch: 50, axis: 'x' },
    symmetric: { axis: 'x' },
    equal: { property: 'width' },
    fixed: { x: 0, y: 0 },
  };

  return {
    id: nanoid(),
    type,
    shapeIds,
    params: { ...defaults[type], ...params },
    enabled: true,
  };
}
