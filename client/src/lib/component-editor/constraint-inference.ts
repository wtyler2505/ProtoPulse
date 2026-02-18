import type { Shape, Connector, Constraint, ConstraintType } from '@shared/component-types';
import { getShapeCenter, createConstraint } from './constraint-solver';

export interface InferredConstraint {
  type: ConstraintType;
  shapeIds: string[];
  params: Record<string, number | string>;
  confidence: number;
  reason: string;
}

const PITCH_TOLERANCE = 2;
const ALIGNMENT_TOLERANCE = 3;

export function inferConstraints(
  shapes: Shape[],
  connectors: Connector[],
  view: 'breadboard' | 'schematic' | 'pcb',
  existingConstraints: Constraint[] = []
): InferredConstraint[] {
  const suggestions: InferredConstraint[] = [];
  const existingPairs = new Set(
    existingConstraints.map(c => [...c.shapeIds].sort().join(':'))
  );

  suggestions.push(...inferPitchFromPins(connectors, view, existingPairs));
  suggestions.push(...inferAlignmentFromShapes(shapes, existingPairs));
  suggestions.push(...inferSymmetryFromShapes(shapes, existingPairs));
  suggestions.push(...inferEqualSizes(shapes, existingPairs));

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, 20);
}

function inferPitchFromPins(
  connectors: Connector[],
  view: string,
  existingPairs: Set<string>
): InferredConstraint[] {
  const suggestions: InferredConstraint[] = [];
  const positioned = connectors
    .map(c => ({ conn: c, pos: c.terminalPositions[view] }))
    .filter(p => p.pos !== undefined);

  if (positioned.length < 2) return suggestions;

  const sortedByX = [...positioned].sort((a, b) => a.pos.x - b.pos.x);
  const sortedByY = [...positioned].sort((a, b) => a.pos.y - b.pos.y);

  const xAligned = findAlignedGroups(sortedByX, 'y', ALIGNMENT_TOLERANCE);
  for (const group of xAligned) {
    if (group.length < 2) continue;
    const pitch = detectConsistentPitch(group.map(g => g.pos.x));
    if (pitch !== null) {
      const shapeIds = group.flatMap(g => {
        const viewShapes = g.conn.shapeIds[view] || [];
        return viewShapes;
      }).filter(Boolean);
      if (shapeIds.length >= 2) {
        const pairKey = shapeIds.slice(0, 2).sort().join(':');
        if (!existingPairs.has(pairKey)) {
          suggestions.push({
            type: 'pitch',
            shapeIds: shapeIds.slice(0, Math.min(shapeIds.length, 8)),
            params: { pitch, axis: 'x' },
            confidence: 0.9,
            reason: `${group.length} pins aligned horizontally with ${pitch.toFixed(0)}px pitch`,
          });
        }
      }
    }
  }

  const yAligned = findAlignedGroups(sortedByY, 'x', ALIGNMENT_TOLERANCE);
  for (const group of yAligned) {
    if (group.length < 2) continue;
    const pitch = detectConsistentPitch(group.map(g => g.pos.y));
    if (pitch !== null) {
      const shapeIds = group.flatMap(g => {
        const viewShapes = g.conn.shapeIds[view] || [];
        return viewShapes;
      }).filter(Boolean);
      if (shapeIds.length >= 2) {
        const pairKey = shapeIds.slice(0, 2).sort().join(':');
        if (!existingPairs.has(pairKey)) {
          suggestions.push({
            type: 'pitch',
            shapeIds: shapeIds.slice(0, Math.min(shapeIds.length, 8)),
            params: { pitch, axis: 'y' },
            confidence: 0.9,
            reason: `${group.length} pins aligned vertically with ${pitch.toFixed(0)}px pitch`,
          });
        }
      }
    }
  }

  return suggestions;
}

function inferAlignmentFromShapes(
  shapes: Shape[],
  existingPairs: Set<string>
): InferredConstraint[] {
  const suggestions: InferredConstraint[] = [];
  if (shapes.length < 2) return suggestions;

  const centers = shapes.map(s => ({ id: s.id, ...getShapeCenter(s) }));

  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      const a = centers[i];
      const b = centers[j];
      const pairKey = [a.id, b.id].sort().join(':');
      if (existingPairs.has(pairKey)) continue;

      if (Math.abs(a.x - b.x) < ALIGNMENT_TOLERANCE && Math.abs(a.y - b.y) > ALIGNMENT_TOLERANCE * 2) {
        suggestions.push({
          type: 'alignment',
          shapeIds: [a.id, b.id],
          params: { axis: 'x' },
          confidence: 0.7 + (1 - Math.abs(a.x - b.x) / ALIGNMENT_TOLERANCE) * 0.2,
          reason: `Shapes nearly aligned on X axis (${Math.abs(a.x - b.x).toFixed(1)}px off)`,
        });
      }

      if (Math.abs(a.y - b.y) < ALIGNMENT_TOLERANCE && Math.abs(a.x - b.x) > ALIGNMENT_TOLERANCE * 2) {
        suggestions.push({
          type: 'alignment',
          shapeIds: [a.id, b.id],
          params: { axis: 'y' },
          confidence: 0.7 + (1 - Math.abs(a.y - b.y) / ALIGNMENT_TOLERANCE) * 0.2,
          reason: `Shapes nearly aligned on Y axis (${Math.abs(a.y - b.y).toFixed(1)}px off)`,
        });
      }
    }
  }

  return suggestions;
}

function inferSymmetryFromShapes(
  shapes: Shape[],
  existingPairs: Set<string>
): InferredConstraint[] {
  const suggestions: InferredConstraint[] = [];
  if (shapes.length < 3) return suggestions;

  const centers = shapes.map(s => ({ id: s.id, ...getShapeCenter(s) }));

  let allMinX = Infinity, allMaxX = -Infinity;
  let allMinY = Infinity, allMaxY = -Infinity;
  for (const c of centers) {
    allMinX = Math.min(allMinX, c.x);
    allMaxX = Math.max(allMaxX, c.x);
    allMinY = Math.min(allMinY, c.y);
    allMaxY = Math.max(allMaxY, c.y);
  }
  const midX = (allMinX + allMaxX) / 2;
  const midY = (allMinY + allMaxY) / 2;

  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      const a = centers[i];
      const b = centers[j];
      const pairKey = [a.id, b.id].sort().join(':');
      if (existingPairs.has(pairKey)) continue;

      const pairMidX = (a.x + b.x) / 2;
      if (Math.abs(pairMidX - midX) < ALIGNMENT_TOLERANCE * 2 && Math.abs(a.y - b.y) < ALIGNMENT_TOLERANCE) {
        suggestions.push({
          type: 'symmetric',
          shapeIds: [a.id, b.id],
          params: { axis: 'x' },
          confidence: 0.6,
          reason: `Shapes appear symmetric around X center axis`,
        });
      }

      const pairMidY = (a.y + b.y) / 2;
      if (Math.abs(pairMidY - midY) < ALIGNMENT_TOLERANCE * 2 && Math.abs(a.x - b.x) < ALIGNMENT_TOLERANCE) {
        suggestions.push({
          type: 'symmetric',
          shapeIds: [a.id, b.id],
          params: { axis: 'y' },
          confidence: 0.6,
          reason: `Shapes appear symmetric around Y center axis`,
        });
      }
    }
  }

  return suggestions;
}

function inferEqualSizes(
  shapes: Shape[],
  existingPairs: Set<string>
): InferredConstraint[] {
  const suggestions: InferredConstraint[] = [];
  if (shapes.length < 2) return suggestions;

  const SIZE_TOLERANCE = 2;

  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i];
      const b = shapes[j];
      if (a.type !== b.type) continue;
      const pairKey = [a.id, b.id].sort().join(':');
      if (existingPairs.has(pairKey)) continue;

      const widthMatch = Math.abs(a.width - b.width) < SIZE_TOLERANCE;
      const heightMatch = Math.abs(a.height - b.height) < SIZE_TOLERANCE;

      if (widthMatch && heightMatch && a.width > 0 && a.height > 0) {
        suggestions.push({
          type: 'equal',
          shapeIds: [a.id, b.id],
          params: { property: 'both' },
          confidence: 0.65,
          reason: `Same-type shapes with nearly equal dimensions (${a.width.toFixed(0)}x${a.height.toFixed(0)} vs ${b.width.toFixed(0)}x${b.height.toFixed(0)})`,
        });
      } else if (widthMatch && !heightMatch && a.width > 0) {
        suggestions.push({
          type: 'equal',
          shapeIds: [a.id, b.id],
          params: { property: 'width' },
          confidence: 0.5,
          reason: `Same-type shapes with nearly equal width (${a.width.toFixed(0)}px)`,
        });
      }
    }
  }

  return suggestions;
}

function findAlignedGroups(
  items: { conn: Connector; pos: { x: number; y: number } }[],
  alignAxis: 'x' | 'y',
  tolerance: number
): { conn: Connector; pos: { x: number; y: number } }[][] {
  const groups: { conn: Connector; pos: { x: number; y: number } }[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const group = [items[i]];
    used.add(i);

    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      const diff = Math.abs(items[i].pos[alignAxis] - items[j].pos[alignAxis]);
      if (diff < tolerance) {
        group.push(items[j]);
        used.add(j);
      }
    }

    if (group.length >= 2) groups.push(group);
  }

  return groups;
}

function detectConsistentPitch(values: number[]): number | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(sorted[i] - sorted[i - 1]);
  }
  if (diffs.length === 0) return null;

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  if (avgDiff < 5) return null;

  const allClose = diffs.every(d => Math.abs(d - avgDiff) < PITCH_TOLERANCE);
  return allClose ? Math.round(avgDiff) : null;
}
