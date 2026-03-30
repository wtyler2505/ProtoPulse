// =============================================================================
// Gerber Board Outline Generator
// =============================================================================

import { fmtCoord, formatMm } from './coordinates';
import { gerberFooter, gerberHeader } from './format';
import type { GerberInput } from './types';
import { OUTLINE_APERTURE } from './types';

/**
 * Generate the board outline (Edge.Cuts) Gerber layer.
 *
 * If a custom outline polygon is provided, uses that.
 * Otherwise, generates a rectangle from boardWidth x boardHeight.
 */
export function generateBoardOutline(input: GerberInput): string {
  const lines: string[] = [];

  // Header
  lines.push(gerberHeader({
    comment: 'Board Outline',
    fileFunction: 'Profile,NP',
  }));

  // Thin outline aperture
  lines.push(`%ADD10C,${formatMm(OUTLINE_APERTURE)}*%`);

  // Set linear interpolation mode
  lines.push('G01*');
  lines.push('D10*');

  if (input.boardOutline && input.boardOutline.length >= 3) {
    // Custom outline polygon
    const outline = input.boardOutline;
    lines.push(`X${fmtCoord(outline[0].x)}Y${fmtCoord(outline[0].y)}D02*`);
    for (let i = 1; i < outline.length; i++) {
      lines.push(`X${fmtCoord(outline[i].x)}Y${fmtCoord(outline[i].y)}D01*`);
    }
    // Close the polygon
    lines.push(`X${fmtCoord(outline[0].x)}Y${fmtCoord(outline[0].y)}D01*`);
  } else {
    // Default rectangle
    const w = input.boardWidth;
    const h = input.boardHeight;

    lines.push(`X${fmtCoord(0)}Y${fmtCoord(0)}D02*`);
    lines.push(`X${fmtCoord(w)}Y${fmtCoord(0)}D01*`);
    lines.push(`X${fmtCoord(w)}Y${fmtCoord(h)}D01*`);
    lines.push(`X${fmtCoord(0)}Y${fmtCoord(h)}D01*`);
    lines.push(`X${fmtCoord(0)}Y${fmtCoord(0)}D01*`);
  }

  // Footer
  lines.push(gerberFooter());

  return lines.join('\n');
}
