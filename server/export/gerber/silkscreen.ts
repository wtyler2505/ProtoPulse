// =============================================================================
// Gerber Silkscreen Layer Generator
// =============================================================================

import { fmtCoord, formatMm, rotatePoint } from './coordinates';
import { filterInstancesForSide } from './filters';
import { gerberFooter, gerberHeader } from './format';
import { textToStrokes } from './stroke-font';
import type { GerberInput } from './types';
import {
  DEFAULT_BODY_HEIGHT,
  DEFAULT_BODY_WIDTH,
  SILKSCREEN_APERTURE,
  SILKSCREEN_BODY_MARGIN,
} from './types';

/**
 * Generate a silkscreen layer for a given side.
 *
 * Contents:
 * - Component body outlines (simplified rectangles)
 * - Reference designator text
 */
export function generateSilkscreenLayer(input: GerberInput, side: 'front' | 'back'): string {
  const sideInstances = filterInstancesForSide(input.instances, side);

  const lines: string[] = [];

  // Header
  const layerPos = side === 'front' ? 'Top' : 'Bot';
  lines.push(gerberHeader({
    comment: `${side === 'front' ? 'Front' : 'Back'} Silkscreen`,
    fileFunction: `Legend,${layerPos}`,
  }));

  // Aperture for silkscreen lines
  lines.push(`%ADD10C,${formatMm(SILKSCREEN_APERTURE)}*%`);

  // Set linear interpolation mode
  lines.push('G01*');
  lines.push('D10*');

  for (let i = 0; i < sideInstances.length; i++) {
    const inst = sideInstances[i];
    const bw = (inst.bodyWidth ?? DEFAULT_BODY_WIDTH) + SILKSCREEN_BODY_MARGIN * 2;
    const bh = (inst.bodyHeight ?? DEFAULT_BODY_HEIGHT) + SILKSCREEN_BODY_MARGIN * 2;

    // Compute body outline corners (before rotation)
    const halfW = bw / 2;
    const halfH = bh / 2;
    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ];

    // Rotate corners around instance center
    const rotatedCorners = [];
    for (let c = 0; c < corners.length; c++) {
      const rot = rotatePoint(corners[c].x, corners[c].y, 0, 0, inst.pcbRotation);
      rotatedCorners.push({
        x: inst.pcbX + rot.x,
        y: inst.pcbY + rot.y,
      });
    }

    // Draw body outline (closed rectangle)
    lines.push(`X${fmtCoord(rotatedCorners[0].x)}Y${fmtCoord(rotatedCorners[0].y)}D02*`);
    for (let c = 1; c < rotatedCorners.length; c++) {
      lines.push(`X${fmtCoord(rotatedCorners[c].x)}Y${fmtCoord(rotatedCorners[c].y)}D01*`);
    }
    // Close the rectangle
    lines.push(`X${fmtCoord(rotatedCorners[0].x)}Y${fmtCoord(rotatedCorners[0].y)}D01*`);

    // Draw pin-1 marker (small dash at corner 0 → midpoint of edge 0-1)
    const midX = (rotatedCorners[0].x + rotatedCorners[1].x) / 2;
    const midY = (rotatedCorners[0].y + rotatedCorners[1].y) / 2;
    const markerX = (rotatedCorners[0].x + midX) / 2;
    const markerY = (rotatedCorners[0].y + midY) / 2;
    lines.push(`X${fmtCoord(rotatedCorners[0].x)}Y${fmtCoord(rotatedCorners[0].y)}D02*`);
    lines.push(`X${fmtCoord(markerX)}Y${fmtCoord(markerY)}D01*`);

    // Draw reference designator text
    // Position text above the component body
    const textOriginX = inst.pcbX - (inst.referenceDesignator.length * 0.6);
    const textOriginY = inst.pcbY - halfH - SILKSCREEN_BODY_MARGIN - 0.8;

    const charWidth = 0.8;
    const charHeight = 1.0;
    const charSpacing = 0.2;

    const strokes = textToStrokes(
      inst.referenceDesignator,
      textOriginX,
      textOriginY,
      charWidth,
      charHeight,
      charSpacing,
    );

    for (let s = 0; s < strokes.length; s++) {
      const seg = strokes[s];
      lines.push(`X${fmtCoord(seg.x1)}Y${fmtCoord(seg.y1)}D02*`);
      lines.push(`X${fmtCoord(seg.x2)}Y${fmtCoord(seg.y2)}D01*`);
    }
  }

  // Footer
  lines.push(gerberFooter());

  return lines.join('\n');
}
