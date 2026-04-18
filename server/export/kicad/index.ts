// =============================================================================
// KiCad Exporter — Barrel
//
// Public API for generating KiCad 7+ project files. Each phase of the export
// lives in its own focused module:
//
//   types.ts       — Shared types + constants
//   sexpr.ts       — S-expression + numeric formatting helpers
//   meta.ts        — Part metadata + layer mapping
//   netlist.ts     — Net index + legacy KiCad netlist emitter
//   symbols.ts     — Schematic symbol library + placed instances
//   footprints.ts  — Per-instance PCB footprint emission (placement)
//   board.ts       — PCB layers/setup/traces/outline assembly
//   project.ts     — .kicad_pro project settings file
//
// No side effects, no Express routes. Pure function library.
// =============================================================================

import { generateKicadSchematic } from './symbols';
import { generateKicadPcb } from './board';
import { generateKicadProjectFile } from './project';
import type { KicadInput, KicadOutput } from './types';

export type { KicadInput, KicadOutput } from './types';
export {
  generateLibSymbols,
  generateSchematicSymbolInstances,
  generateSchematicWires,
  generateKicadSchematic,
  generateKicadSch,
  layoutPins,
} from './symbols';
export {
  generatePcbLayers,
  generatePcbSetup,
  generatePcbNets,
  generatePcbTraces,
  generateBoardOutline,
  generateKicadPcb,
} from './board';
export { generatePcbFootprint } from './footprints';
export { generateKicadProjectFile } from './project';
export {
  buildNetIndex,
  makePinKey,
  generateKicadNetlist,
  type PinKey,
  type NetInfo,
} from './netlist';

/**
 * Generates a complete KiCad 7+ project from ProtoPulse circuit data.
 *
 * Returns three strings that should be saved as:
 *   - `<name>.kicad_sch`  — the schematic file
 *   - `<name>.kicad_pcb`  — the PCB layout file
 *   - `<name>.kicad_pro`  — the project settings file
 *
 * The files are self-contained: component symbols are embedded in the
 * schematic (lib_symbols section) and footprints are embedded inline
 * in the PCB. No external library files are needed.
 */
export function generateKicadProject(input: KicadInput): KicadOutput {
  return {
    schematic: generateKicadSchematic(input),
    pcb: generateKicadPcb(input),
    project: generateKicadProjectFile(input),
  };
}
