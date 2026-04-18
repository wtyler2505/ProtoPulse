// =============================================================================
// KiCad Exporter — Public types and constants
// =============================================================================

export interface KicadInput {
  circuit: { id: number; name: string };
  instances: Array<{
    id: number;
    referenceDesignator: string;
    partId: number | null;
    schematicX: number;
    schematicY: number;
    schematicRotation: number;
    pcbX: number | null;
    pcbY: number | null;
    pcbRotation: number | null;
    pcbSide: string | null;
  }>;
  nets: Array<{
    name: string;
    netType: string;
    segments: Array<{
      fromInstanceId: number;
      fromPin: string;
      toInstanceId: number;
      toPin: string;
    }>;
  }>;
  wires: Array<{
    netId: number;
    view: string;
    points: Array<{ x: number; y: number }>;
    layer: string;
    width: number;
  }>;
  parts: Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>;
  boardWidth?: number;
  boardHeight?: number;
}

export interface KicadOutput {
  schematic: string;
  pcb: string;
  project: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** KiCad schematic file format version (KiCad 7+) */
export const SCHEMATIC_VERSION = 20230121;

/** KiCad PCB file format version (KiCad 7+) */
export const PCB_VERSION = 20221018;

/** Generator tag embedded in output files */
export const GENERATOR = 'ProtoPulse';

/**
 * Scale factor: ProtoPulse schematic coordinates (pixels) -> KiCad mm.
 * Dividing by 10 gives a reasonable spacing on a KiCad schematic sheet.
 */
export const SCHEMATIC_SCALE = 0.1;

/** Default paper size for schematics */
export const PAPER_SIZE = 'A3';

/** Default board thickness in mm */
export const DEFAULT_BOARD_THICKNESS = 1.6;

/** Default trace width in mm */
export const DEFAULT_TRACE_WIDTH = 0.25;

/** Default board dimensions in mm (when not specified) */
export const DEFAULT_BOARD_WIDTH = 100;
export const DEFAULT_BOARD_HEIGHT = 100;

/** Board outline stroke width in mm */
export const EDGE_CUTS_WIDTH = 0.1;

/** Default pad sizes in mm */
export const DEFAULT_THT_PAD_SIZE = 1.6;
export const DEFAULT_THT_DRILL = 0.8;
export const DEFAULT_SMD_PAD_WIDTH = 1.2;
export const DEFAULT_SMD_PAD_HEIGHT = 0.6;

/** KiCad standard font size for property text */
export const FONT_SIZE = 1.27;

/** Pin length in mm */
export const PIN_LENGTH = 2.54;

/**
 * The minimum rectangle body half-size. Symbols with few pins will still
 * get a visible body at least this big (in mm).
 */
export const MIN_SYMBOL_HALF_SIZE = 2.54;
