import type { FootprintPlacement, Vec } from '@protopulse/graph';

/**
 * Shared PCB-export geometry + number formatting. The placement
 * transform reimplements the renderer convention (scene-pcb.ts):
 *
 *   world = rotate_ccw(rotMilli) ∘ mirrorX(side=bottom) ∘ local + at
 *
 * Only 90° steps are supported; other angles snap to the nearest quarter
 * turn (the pinned op contract only emits 0/90/180/270). All formatting
 * is integer math on nanometers — no float dust in emitted artifacts.
 */

export type PcbPlacementLike = Pick<FootprintPlacement, 'at' | 'rotMilli' | 'side'>;

/** rotMilli → quarter turns (0..3); non-90° angles snap to the nearest. */
export function quarterTurnsOf(rotMilli: number): 0 | 1 | 2 | 3 {
  const turns = Math.round(rotMilli / 90_000) % 4;
  return ((turns + 4) % 4) as 0 | 1 | 2 | 3;
}

/** Apply side mirror (X-flip, first) then CCW rotation then translation. */
export function applyPcbPlacement(p: Vec, placement: PcbPlacementLike): Vec {
  const x = placement.side === 'bottom' ? -p.x : p.x;
  const y = p.y;
  let rx: number;
  let ry: number;
  switch (quarterTurnsOf(placement.rotMilli)) {
    case 0:
      rx = x;
      ry = y;
      break;
    case 1:
      rx = -y;
      ry = x;
      break;
    case 2:
      rx = -x;
      ry = -y;
      break;
    case 3:
      rx = y;
      ry = -x;
      break;
  }
  return { x: rx + placement.at.x, y: ry + placement.at.y };
}

/** Integer-exact fixed-point format: value/10^digits, fixed decimals. */
function formatFixed(value: number, digits: number): string {
  const n = Math.round(value);
  const scale = 10 ** digits;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const int = Math.floor(abs / scale);
  const frac = String(abs % scale).padStart(digits, '0');
  return `${sign}${int}.${frac}`;
}

/** Strip trailing fractional zeros (and a bare trailing dot). */
function stripZeros(s: string): string {
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** nm → mm, 6 decimals, trailing zeros stripped ("1.25", "0.1", "1"). */
export function formatMm(nm: number): string {
  return stripZeros(formatFixed(nm, 6));
}

/** nm → mm in fixed 3.3 Excellon style ("0.800", "-3.810"). */
export function formatMm3(nm: number): string {
  return formatFixed(Math.round(nm / 1000), 3);
}

/** millidegrees → degrees, 3 decimals, trailing zeros stripped ("90", "45.5"). */
export function formatDeg(milli: number): string {
  return stripZeros(formatFixed(milli, 3));
}
