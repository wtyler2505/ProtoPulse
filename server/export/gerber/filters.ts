// =============================================================================
// Gerber Filtering Helpers — pad, wire, and instance side filters
// =============================================================================

import type { GerberInstance, GerberWire, ResolvedPad } from './types';

/**
 * Filter pads for a copper layer.
 * THT pads appear on both front and back. SMD pads only on their side.
 */
export function filterPadsForCopper(pads: ResolvedPad[], side: 'front' | 'back'): ResolvedPad[] {
  const result: ResolvedPad[] = [];
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (pad.padType === 'tht' || pad.side === side) {
      result.push(pad);
    }
  }
  return result;
}

/**
 * Filter wires for a specific PCB side/layer.
 * Matches by exact layer name (e.g. 'front', 'back', 'In1.Cu', 'F.Cu').
 */
export function filterWiresForSide(wires: GerberWire[], side: string): GerberWire[] {
  const result: GerberWire[] = [];
  for (let i = 0; i < wires.length; i++) {
    if (wires[i].layer === side) {
      result.push(wires[i]);
    }
  }
  return result;
}

/**
 * Filter instances for a specific PCB side.
 */
export function filterInstancesForSide(instances: GerberInstance[], side: 'front' | 'back'): GerberInstance[] {
  const result: GerberInstance[] = [];
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const instSide = inst.pcbSide === 'back' ? 'back' : 'front';
    if (instSide === side) {
      result.push(inst);
    }
  }
  return result;
}

/**
 * Filter for only SMD pads on a given side.
 */
export function filterSmdPadsForSide(pads: ResolvedPad[], side: 'front' | 'back'): ResolvedPad[] {
  const result: ResolvedPad[] = [];
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    if (pad.padType === 'smd' && pad.side === side) {
      result.push(pad);
    }
  }
  return result;
}
