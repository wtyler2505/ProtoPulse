/**
 * HitTester — Point-in-shape detection and marquee selection logic.
 *
 * Pure functions operating on Shape arrays — no React state or side effects.
 */
import type { Shape } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Marquee (box) selection
// ---------------------------------------------------------------------------

export function shapesInMarquee(
  shapes: Shape[],
  marqueeStart: { x: number; y: number },
  marqueeCurrent: { x: number; y: number },
): string[] {
  const mx = Math.min(marqueeStart.x, marqueeCurrent.x);
  const my = Math.min(marqueeStart.y, marqueeCurrent.y);
  const mw = Math.abs(marqueeCurrent.x - marqueeStart.x);
  const mh = Math.abs(marqueeCurrent.y - marqueeStart.y);

  return shapes
    .filter((s) => {
      const sx = s.x;
      const sy = s.y;
      const sw = s.width;
      const sh = s.height;
      return sx < mx + mw && sx + sw > mx && sy < my + mh && sy + sh > my;
    })
    .map((s) => s.id);
}
