// =============================================================================
// KiCad Project Exporter — compatibility barrel
//
// The implementation was split into focused per-phase modules under
// `./kicad/`. This file preserves the original public import path so existing
// call sites (server/ai-tools/export.ts, server/export-generators.ts, tests)
// keep working unchanged.
//
// Structure of the new module:
//
//   kicad/types.ts       — KicadInput, KicadOutput, constants
//   kicad/sexpr.ts       — S-expression + number formatting helpers
//   kicad/meta.ts        — Part metadata + layer mapping
//   kicad/netlist.ts     — Net index + legacy KiCad netlist emitter
//   kicad/symbols.ts     — Schematic symbol library + placed instances
//   kicad/footprints.ts  — Per-instance PCB footprint emission
//   kicad/board.ts       — PCB layers/setup/traces/outline assembly
//   kicad/project.ts     — .kicad_pro project settings file
//   kicad/index.ts       — barrel + generateKicadProject unified entry point
// =============================================================================

export type { KicadInput, KicadOutput, PinKey, NetInfo } from './kicad';
export {
  generateKicadSchematic,
  generateKicadPcb,
  generateKicadProjectFile,
  generateKicadProject,
  generateKicadSch,
  generateKicadNetlist,
  generateLibSymbols,
  generateSchematicSymbolInstances,
  generateSchematicWires,
  generatePcbLayers,
  generatePcbSetup,
  generatePcbNets,
  generatePcbTraces,
  generateBoardOutline,
  generatePcbFootprint,
  buildNetIndex,
  makePinKey,
  layoutPins,
} from './kicad';
