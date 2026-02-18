import type { Shape, CircleShape } from '@shared/component-types';

export interface SnapTarget {
  axis: 'x' | 'y';
  value: number;
  sourceEdge: string;
  targetShapeId: string;
  targetEdge: string;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  guides: SnapTarget[];
}

const SNAP_THRESHOLD = 5;

export function getShapeBounds(shape: Shape) {
  if (shape.type === 'circle') {
    const c = shape as CircleShape;
    const r = Math.min(c.width, c.height) / 2;
    return { left: c.cx - r, right: c.cx + r, top: c.cy - r, bottom: c.cy + r, centerX: c.cx, centerY: c.cy };
  }
  return {
    left: shape.x,
    right: shape.x + shape.width,
    top: shape.y,
    bottom: shape.y + shape.height,
    centerX: shape.x + shape.width / 2,
    centerY: shape.y + shape.height / 2,
  };
}

export function computeSnap(
  movingBounds: { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number },
  otherShapes: Shape[],
  excludeIds: string[],
  threshold: number = SNAP_THRESHOLD
): SnapResult {
  let dx = 0;
  let dy = 0;
  let bestXDist = Infinity;
  let bestYDist = Infinity;
  let xGuides: SnapTarget[] = [];
  let yGuides: SnapTarget[] = [];

  const others = otherShapes.filter(s => !excludeIds.includes(s.id));

  const movingXEdges = [
    { value: movingBounds.left, edge: 'left' },
    { value: movingBounds.centerX, edge: 'center' },
    { value: movingBounds.right, edge: 'right' },
  ];

  const movingYEdges = [
    { value: movingBounds.top, edge: 'top' },
    { value: movingBounds.centerY, edge: 'middle' },
    { value: movingBounds.bottom, edge: 'bottom' },
  ];

  for (const other of others) {
    const ob = getShapeBounds(other);
    const targetXEdges = [
      { value: ob.left, edge: 'left' },
      { value: ob.centerX, edge: 'center' },
      { value: ob.right, edge: 'right' },
    ];
    const targetYEdges = [
      { value: ob.top, edge: 'top' },
      { value: ob.centerY, edge: 'middle' },
      { value: ob.bottom, edge: 'bottom' },
    ];

    for (const me of movingXEdges) {
      for (const te of targetXEdges) {
        const dist = Math.abs(me.value - te.value);
        if (dist > threshold) continue;
        const guide: SnapTarget = { axis: 'x', value: te.value, sourceEdge: me.edge, targetShapeId: other.id, targetEdge: te.edge };
        if (dist < bestXDist) {
          bestXDist = dist;
          dx = te.value - me.value;
          xGuides = [guide];
        } else if (dist === bestXDist) {
          xGuides.push(guide);
        }
      }
    }

    for (const me of movingYEdges) {
      for (const te of targetYEdges) {
        const dist = Math.abs(me.value - te.value);
        if (dist > threshold) continue;
        const guide: SnapTarget = { axis: 'y', value: te.value, sourceEdge: me.edge, targetShapeId: other.id, targetEdge: te.edge };
        if (dist < bestYDist) {
          bestYDist = dist;
          dy = te.value - me.value;
          yGuides = [guide];
        } else if (dist === bestYDist) {
          yGuides.push(guide);
        }
      }
    }
  }

  return {
    snappedX: movingBounds.left + dx,
    snappedY: movingBounds.top + dy,
    guides: [...xGuides, ...yGuides],
  };
}
