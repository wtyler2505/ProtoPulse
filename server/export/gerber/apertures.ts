// =============================================================================
// Gerber Aperture Management
// =============================================================================

import { formatMm } from './coordinates';
import type { ApertureDef, GerberVia, GerberWire, ResolvedPad } from './types';

/**
 * Builds a unique set of aperture definitions from pads and traces.
 * Returns the definitions and a lookup map from aperture key to D-code.
 */
export function buildApertures(
  pads: ResolvedPad[],
  wires: GerberWire[],
  side: 'front' | 'back',
  extra?: { clearance?: number; vias?: GerberVia[]; tentedFilter?: boolean },
): { defs: ApertureDef[]; lookup: Map<string, number> } {
  const clearance = extra?.clearance ?? 0;
  const vias = extra?.vias ?? [];
  const tentedFilter = extra?.tentedFilter ?? false;
  const seen = new Map<string, number>();
  const defs: ApertureDef[] = [];
  let nextCode = 10; // D10 is the first user aperture per Gerber convention

  function addAperture(shape: 'C' | 'R', params: string): number {
    const key = `${shape}:${params}`;
    const existing = seen.get(key);
    if (existing !== undefined) return existing;
    const code = nextCode++;
    seen.set(key, code);
    defs.push({ code, shape, params, key });
    return code;
  }

  // Trace apertures
  for (let i = 0; i < wires.length; i++) {
    const wire = wires[i];
    if (wire.layer !== side) continue;
    const w = wire.width + clearance * 2;
    addAperture('C', formatMm(w));
  }

  // Pad apertures
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    // THT pads appear on both layers; SMD pads only on their side
    if (pad.padType === 'smd' && pad.side !== side) continue;

    const pw = pad.width + clearance * 2;
    const ph = pad.height + clearance * 2;

    if (pad.padShape === 'circle') {
      addAperture('C', formatMm(pw));
    } else {
      // rect, square, oblong all rendered as rectangles
      addAperture('R', `${formatMm(pw)}X${formatMm(ph)}`);
    }
  }

  // Via apertures — vias are circular pads on both copper layers
  for (let i = 0; i < vias.length; i++) {
    const via = vias[i];
    // When tentedFilter is true, skip tented vias (used for soldermask)
    if (tentedFilter && via.tented) continue;
    const d = via.outerDiameter + clearance * 2;
    addAperture('C', formatMm(d));
  }

  return { defs, lookup: seen };
}

/**
 * Look up the D-code for a given pad's aperture.
 */
export function padApertureKey(pad: ResolvedPad, clearance: number): string {
  const pw = pad.width + clearance * 2;
  const ph = pad.height + clearance * 2;
  if (pad.padShape === 'circle') {
    return `C:${formatMm(pw)}`;
  }
  return `R:${formatMm(pw)}X${formatMm(ph)}`;
}

/**
 * Look up the D-code for a trace aperture.
 */
export function traceApertureKey(width: number, clearance: number): string {
  return `C:${formatMm(width + clearance * 2)}`;
}

/**
 * Look up the D-code for a via pad aperture.
 */
export function viaApertureKey(via: GerberVia, clearance: number): string {
  return `C:${formatMm(via.outerDiameter + clearance * 2)}`;
}
