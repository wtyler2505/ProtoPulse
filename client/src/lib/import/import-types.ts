/**
 * Design Import Types
 *
 * Shared type definitions, constants, and helpers for all design import parsers.
 *
 * @module import-types
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportFormat =
  | 'kicad-schematic'
  | 'kicad-pcb'
  | 'kicad-symbol'
  | 'eagle-schematic'
  | 'eagle-board'
  | 'eagle-library'
  | 'altium-schematic'
  | 'altium-pcb'
  | 'geda-schematic'
  | 'ltspice-schematic'
  | 'proteus-schematic'
  | 'orcad-schematic';

export type ImportStatus = 'pending' | 'parsing' | 'converting' | 'complete' | 'error';

export interface ImportedComponent {
  refDes: string;
  name: string;
  value: string;
  package: string;
  library: string;
  position?: { x: number; y: number };
  rotation?: number;
  layer?: string;
  properties: Record<string, string>;
  pins: Array<{
    number: string;
    name: string;
    type: 'input' | 'output' | 'bidirectional' | 'power' | 'passive' | 'unspecified';
    position?: { x: number; y: number };
  }>;
}

export interface ImportedNet {
  name: string;
  pins: Array<{ componentRef: string; pinNumber: string }>;
  netClass?: string;
}

export interface ImportedWire {
  start: { x: number; y: number };
  end: { x: number; y: number };
  net?: string;
  width?: number;
  layer?: string;
}

export interface ImportedDesign {
  format: ImportFormat;
  fileName: string;
  version?: string;
  title?: string;
  date?: string;
  components: ImportedComponent[];
  nets: ImportedNet[];
  wires: ImportedWire[];
  metadata: Record<string, string>;
  warnings: string[];
  errors: string[];
}

export interface ImportResult {
  status: ImportStatus;
  design: ImportedDesign | null;
  parseTime: number;
  componentCount: number;
  netCount: number;
  wireCount: number;
  warningCount: number;
  errorCount: number;
}

export interface FormatDetectionResult {
  format: ImportFormat | null;
  confidence: number;
  indicators: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'protopulse-design-imports';

export const PIN_TYPE_MAP: Record<string, ImportedComponent['pins'][0]['type']> = {
  input: 'input',
  output: 'output',
  bidirectional: 'bidirectional',
  bi_directional: 'bidirectional',
  power_in: 'power',
  power_out: 'power',
  power: 'power',
  passive: 'passive',
  tri_state: 'bidirectional',
  open_collector: 'output',
  open_emitter: 'output',
  unspecified: 'unspecified',
  no_connect: 'unspecified',
  free: 'unspecified',
};

export const SUPPORTED_FORMATS: Array<{ format: ImportFormat; extensions: string[]; description: string }> = [
  { format: 'kicad-schematic', extensions: ['.kicad_sch'], description: 'KiCad Schematic' },
  { format: 'kicad-pcb', extensions: ['.kicad_pcb'], description: 'KiCad PCB Layout' },
  { format: 'kicad-symbol', extensions: ['.kicad_sym'], description: 'KiCad Symbol Library' },
  { format: 'eagle-schematic', extensions: ['.sch'], description: 'EAGLE Schematic' },
  { format: 'eagle-board', extensions: ['.brd'], description: 'EAGLE Board Layout' },
  { format: 'eagle-library', extensions: ['.lbr'], description: 'EAGLE Component Library' },
  { format: 'altium-schematic', extensions: ['.SchDoc'], description: 'Altium Schematic' },
  { format: 'altium-pcb', extensions: ['.PcbDoc'], description: 'Altium PCB Layout' },
  { format: 'geda-schematic', extensions: ['.sch'], description: 'gEDA/gschem Schematic' },
  { format: 'ltspice-schematic', extensions: ['.asc'], description: 'LTspice Schematic' },
  { format: 'proteus-schematic', extensions: ['.dsn'], description: 'Proteus Design' },
  { format: 'orcad-schematic', extensions: ['.dsn'], description: 'OrCAD/CadStar Schematic' },
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

export type Listener = () => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createEmptyDesign(format: ImportFormat, fileName: string): ImportedDesign {
  return {
    format,
    fileName,
    components: [],
    nets: [],
    wires: [],
    metadata: {},
    warnings: [],
    errors: [],
  };
}
