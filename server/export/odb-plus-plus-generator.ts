// =============================================================================
// ODB++ Generator — Wave 29: FG-08
// =============================================================================
//
// Generates ODB++ format output from PCB layout data. ODB++ is an industry-
// standard PCB manufacturing format (originally Valor/Mentor Graphics, now
// Siemens). The output is a ZIP archive containing:
//
//   matrix/matrix         — Layer stack definition
//   steps/pcb/layers/     — Per-layer feature files (signal, mask, silk, drill)
//   steps/pcb/eda/data    — Component placement (EDA) data
//   misc/info             — Job metadata
//
// Pure function library — no Express routes, no database access, no side effects.
// =============================================================================

import JSZip from 'jszip';
import {
  type ArchNodeData,
  type ArchEdgeData,
  type BomItemData,
  type CircuitInstanceData,
  type CircuitNetData,
  type CircuitWireData,
  type ComponentPartData,
  escapeXml,
  metaStr,
  sanitizeFilename,
} from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OdbInput {
  projectName: string;
  instances: CircuitInstanceData[];
  nets: CircuitNetData[];
  wires: CircuitWireData[];
  parts: Map<number, {
    meta: Record<string, unknown>;
    connectors: Array<{ id: string; name: string; padType?: string }>;
  }>;
  bom: BomItemData[];
  boardWidth?: number;
  boardHeight?: number;
}

export interface OdbOutput {
  /** ZIP archive buffer (Node.js Buffer) */
  buffer: Buffer;
  /** Number of layers generated */
  layerCount: number;
  /** Number of components placed */
  componentCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENERATOR = 'ProtoPulse';
const ODB_VERSION = '7.0';
const UNITS = 'MM';
const DEFAULT_BOARD_WIDTH = 50;
const DEFAULT_BOARD_HEIGHT = 40;

// ODB++ layer row types
const LAYER_TYPE_SIGNAL = 'SIGNAL';
const LAYER_TYPE_SOLDER_MASK = 'SOLDER_MASK';
const LAYER_TYPE_SILK_SCREEN = 'SILK_SCREEN';
const LAYER_TYPE_DRILL = 'DRILL';
const LAYER_TYPE_SOLDER_PASTE = 'SOLDER_PASTE';

// Polarity
const POLARITY_POSITIVE = 'POSITIVE';

// Layer contexts
const CONTEXT_BOARD = 'BOARD';

// Feature symbol type IDs for ODB++
const SYM_ROUND = 'r';
const SYM_SQUARE = 's';
const SYM_RECT = 'rect';

// ---------------------------------------------------------------------------
// Layer definition
// ---------------------------------------------------------------------------

interface OdbLayer {
  name: string;
  type: string;
  polarity: string;
  context: string;
  side: 'top' | 'bottom' | 'none';
}

function getStandardLayers(): OdbLayer[] {
  return [
    { name: 'comp_+_top', type: LAYER_TYPE_SIGNAL, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'top' },
    { name: 'comp_+_bot', type: LAYER_TYPE_SIGNAL, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'bottom' },
    { name: 'solder_mask_top', type: LAYER_TYPE_SOLDER_MASK, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'top' },
    { name: 'solder_mask_bot', type: LAYER_TYPE_SOLDER_MASK, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'bottom' },
    { name: 'silk_screen_top', type: LAYER_TYPE_SILK_SCREEN, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'top' },
    { name: 'silk_screen_bot', type: LAYER_TYPE_SILK_SCREEN, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'bottom' },
    { name: 'solder_paste_top', type: LAYER_TYPE_SOLDER_PASTE, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'top' },
    { name: 'solder_paste_bot', type: LAYER_TYPE_SOLDER_PASTE, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'bottom' },
    { name: 'drill', type: LAYER_TYPE_DRILL, polarity: POLARITY_POSITIVE, context: CONTEXT_BOARD, side: 'none' },
  ];
}

// ---------------------------------------------------------------------------
// Matrix file generator
// ---------------------------------------------------------------------------

function generateMatrix(layers: OdbLayer[]): string {
  const lines: string[] = [];
  lines.push('UNITS=MM');
  lines.push('');

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    lines.push(`STEP {`);
    lines.push(`   COL=${i + 1}`);
    lines.push(`   NAME=${layer.name}`);
    lines.push(`   TYPE=${layer.type}`);
    lines.push(`   POLARITY=${layer.polarity}`);
    lines.push(`   CONTEXT=${layer.context}`);
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Feature file generators
// ---------------------------------------------------------------------------

/** Format a number to 6 decimal places for ODB++ coordinates */
function fmtCoord(val: number): string {
  return val.toFixed(6);
}

/** Generate feature file for a copper signal layer */
function generateSignalLayer(
  side: 'top' | 'bottom',
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
  parts: OdbInput['parts'],
  boardWidth: number,
  boardHeight: number,
): string {
  const lines: string[] = [];
  lines.push('UNITS=MM');
  lines.push('');

  // Symbol definitions (aperture list)
  const symbols: string[] = [];
  symbols.push(`$0 ${SYM_ROUND} 0.250000`);   // default round pad
  symbols.push(`$1 ${SYM_SQUARE} 1.600000`);   // default THT pad
  symbols.push(`$2 ${SYM_RECT} 1.200000 0.600000`); // default SMD pad
  symbols.push(`$3 ${SYM_ROUND} 0.100000`);    // trace width
  lines.push(symbols.join('\n'));
  lines.push('');

  // Board outline
  lines.push(`#`);
  lines.push(`# Board outline`);
  lines.push(`#`);
  lines.push(`OB ${fmtCoord(0)} ${fmtCoord(0)} I`);
  lines.push(`OS ${fmtCoord(boardWidth)} ${fmtCoord(0)}`);
  lines.push(`OS ${fmtCoord(boardWidth)} ${fmtCoord(boardHeight)}`);
  lines.push(`OS ${fmtCoord(0)} ${fmtCoord(boardHeight)}`);
  lines.push(`OS ${fmtCoord(0)} ${fmtCoord(0)}`);
  lines.push(`OE`);
  lines.push('');

  // Pads for each instance on this side
  const sideInstances = instances.filter(i => {
    const instSide = (i.pcbSide ?? 'front') === 'back' ? 'bottom' : 'top';
    return instSide === side;
  });

  for (const inst of sideInstances) {
    const part = inst.partId != null ? parts.get(inst.partId) : undefined;
    const connectors = part?.connectors ?? [];
    const x = inst.pcbX ?? 0;
    const y = inst.pcbY ?? 0;

    lines.push(`# ${inst.referenceDesignator}`);
    for (let ci = 0; ci < connectors.length; ci++) {
      const conn = connectors[ci];
      const isSmd = conn.padType === 'smd';
      const symIdx = isSmd ? 2 : 1;
      const padX = x + ci * 2.54; // Basic pin spacing
      const padY = y;
      lines.push(`P ${fmtCoord(padX)} ${fmtCoord(padY)} $${symIdx} P 0 ;0=${inst.referenceDesignator}-${conn.name}`);
    }
    lines.push('');
  }

  // Traces from wires on this layer
  const layerName = side === 'top' ? 'front' : 'back';
  const layerWires = wires.filter(w => w.view === 'pcb' && (w.layer ?? 'front') === layerName);
  if (layerWires.length > 0) {
    lines.push('# Traces');
    for (const wire of layerWires) {
      const pts = (wire.points ?? []) as Array<{ x: number; y: number }>;
      for (let pi = 1; pi < pts.length; pi++) {
        lines.push(`L ${fmtCoord(pts[pi - 1].x)} ${fmtCoord(pts[pi - 1].y)} ${fmtCoord(pts[pi].x)} ${fmtCoord(pts[pi].y)} $3 P 0`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Generate solder mask layer */
function generateSolderMask(
  side: 'top' | 'bottom',
  instances: CircuitInstanceData[],
  parts: OdbInput['parts'],
): string {
  const lines: string[] = [];
  lines.push('UNITS=MM');
  lines.push('');
  lines.push(`$0 ${SYM_ROUND} 0.300000`); // mask opening slightly larger than pad
  lines.push(`$1 ${SYM_SQUARE} 1.800000`);
  lines.push(`$2 ${SYM_RECT} 1.400000 0.800000`);
  lines.push('');

  const sideInstances = instances.filter(i => {
    const instSide = (i.pcbSide ?? 'front') === 'back' ? 'bottom' : 'top';
    return instSide === side;
  });

  for (const inst of sideInstances) {
    const part = inst.partId != null ? parts.get(inst.partId) : undefined;
    const connectors = part?.connectors ?? [];
    const x = inst.pcbX ?? 0;
    const y = inst.pcbY ?? 0;

    for (let ci = 0; ci < connectors.length; ci++) {
      const conn = connectors[ci];
      const isSmd = conn.padType === 'smd';
      const symIdx = isSmd ? 2 : 1;
      const padX = x + ci * 2.54;
      const padY = y;
      lines.push(`P ${fmtCoord(padX)} ${fmtCoord(padY)} $${symIdx} P 0`);
    }
  }

  return lines.join('\n');
}

/** Generate silkscreen layer */
function generateSilkScreen(
  side: 'top' | 'bottom',
  instances: CircuitInstanceData[],
  parts: OdbInput['parts'],
): string {
  const lines: string[] = [];
  lines.push('UNITS=MM');
  lines.push('');
  lines.push(`$0 ${SYM_ROUND} 0.150000`); // silk line width
  lines.push('');

  const sideInstances = instances.filter(i => {
    const instSide = (i.pcbSide ?? 'front') === 'back' ? 'bottom' : 'top';
    return instSide === side;
  });

  for (const inst of sideInstances) {
    const part = inst.partId != null ? parts.get(inst.partId) : undefined;
    const meta = (part?.meta ?? {}) as Record<string, unknown>;
    const title = metaStr(meta, 'title', inst.referenceDesignator);
    const x = inst.pcbX ?? 0;
    const y = inst.pcbY ?? 0;

    // Outline rectangle representing the component body
    const bodyW = 5.0;
    const bodyH = 3.0;
    lines.push(`# ${inst.referenceDesignator}: ${title}`);
    lines.push(`L ${fmtCoord(x - bodyW / 2)} ${fmtCoord(y - bodyH / 2)} ${fmtCoord(x + bodyW / 2)} ${fmtCoord(y - bodyH / 2)} $0 P 0`);
    lines.push(`L ${fmtCoord(x + bodyW / 2)} ${fmtCoord(y - bodyH / 2)} ${fmtCoord(x + bodyW / 2)} ${fmtCoord(y + bodyH / 2)} $0 P 0`);
    lines.push(`L ${fmtCoord(x + bodyW / 2)} ${fmtCoord(y + bodyH / 2)} ${fmtCoord(x - bodyW / 2)} ${fmtCoord(y + bodyH / 2)} $0 P 0`);
    lines.push(`L ${fmtCoord(x - bodyW / 2)} ${fmtCoord(y + bodyH / 2)} ${fmtCoord(x - bodyW / 2)} ${fmtCoord(y - bodyH / 2)} $0 P 0`);

    // Reference designator text (simplified — real ODB++ uses barcode font)
    lines.push(`T ${fmtCoord(x)} ${fmtCoord(y + bodyH / 2 + 0.5)} ${inst.referenceDesignator} 0 1.000 0.800 0.150`);
    lines.push('');
  }

  return lines.join('\n');
}

/** Generate drill layer feature data */
function generateDrillLayer(
  instances: CircuitInstanceData[],
  parts: OdbInput['parts'],
): string {
  const lines: string[] = [];
  lines.push('UNITS=MM');
  lines.push('');
  lines.push(`$0 ${SYM_ROUND} 0.800000`); // default drill diameter
  lines.push(`$1 ${SYM_ROUND} 1.000000`); // larger drill
  lines.push('');

  for (const inst of instances) {
    const part = inst.partId != null ? parts.get(inst.partId) : undefined;
    const connectors = part?.connectors ?? [];
    const x = inst.pcbX ?? 0;
    const y = inst.pcbY ?? 0;

    // Only THT pads get drills
    const thtConnectors = connectors.filter(c => c.padType !== 'smd');
    for (let ci = 0; ci < thtConnectors.length; ci++) {
      const padX = x + ci * 2.54;
      const padY = y;
      lines.push(`P ${fmtCoord(padX)} ${fmtCoord(padY)} $0 P 0 ;0=${inst.referenceDesignator}-${thtConnectors[ci].name}`);
    }
  }

  return lines.join('\n');
}

/** Generate solder paste layer (SMD pads only) */
function generateSolderPaste(
  side: 'top' | 'bottom',
  instances: CircuitInstanceData[],
  parts: OdbInput['parts'],
): string {
  const lines: string[] = [];
  lines.push('UNITS=MM');
  lines.push('');
  lines.push(`$0 ${SYM_RECT} 1.100000 0.500000`); // paste slightly smaller than pad
  lines.push('');

  const sideInstances = instances.filter(i => {
    const instSide = (i.pcbSide ?? 'front') === 'back' ? 'bottom' : 'top';
    return instSide === side;
  });

  for (const inst of sideInstances) {
    const part = inst.partId != null ? parts.get(inst.partId) : undefined;
    const connectors = part?.connectors ?? [];
    const x = inst.pcbX ?? 0;
    const y = inst.pcbY ?? 0;

    const smdConnectors = connectors.filter(c => c.padType === 'smd');
    for (let ci = 0; ci < smdConnectors.length; ci++) {
      const padX = x + ci * 2.54;
      const padY = y;
      lines.push(`P ${fmtCoord(padX)} ${fmtCoord(padY)} $0 P 0`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// EDA data generator
// ---------------------------------------------------------------------------

function generateEdaData(
  instances: CircuitInstanceData[],
  nets: CircuitNetData[],
  parts: OdbInput['parts'],
  bom: BomItemData[],
): string {
  const lines: string[] = [];
  lines.push('UNITS=MM');
  lines.push(`#`);
  lines.push(`# EDA Component Placement Data`);
  lines.push(`# Generated by ${GENERATOR}`);
  lines.push(`#`);
  lines.push('');

  // Component placement records
  lines.push('# CMP — Component Records');
  for (const inst of instances) {
    const part = inst.partId != null ? parts.get(inst.partId) : undefined;
    const meta = (part?.meta ?? {}) as Record<string, unknown>;
    const pkgName = metaStr(meta, 'package', metaStr(meta, 'packageType', 'UNKNOWN'));
    const partName = metaStr(meta, 'title', inst.referenceDesignator);
    const side = (inst.pcbSide ?? 'front') === 'back' ? 'B' : 'T';
    const x = inst.pcbX ?? 0;
    const y = inst.pcbY ?? 0;
    const rotation = inst.pcbRotation ?? 0;

    lines.push(`CMP ${inst.referenceDesignator} ${pkgName} ${fmtCoord(x)} ${fmtCoord(y)} ${rotation.toFixed(1)} ${side} ;${partName}`);
  }
  lines.push('');

  // Net records
  lines.push('# NET — Net Records');
  for (const net of nets) {
    const segments = (net.segments ?? []) as Array<{
      fromInstanceId: number;
      fromPin: string;
      toInstanceId: number;
      toPin: string;
    }>;
    lines.push(`NET ${net.name}`);
    for (const seg of segments) {
      const fromInst = instances.find(i => i.id === seg.fromInstanceId);
      const toInst = instances.find(i => i.id === seg.toInstanceId);
      if (fromInst) {
        lines.push(`  SNT ${fromInst.referenceDesignator} ${seg.fromPin}`);
      }
      if (toInst) {
        lines.push(`  SNT ${toInst.referenceDesignator} ${seg.toPin}`);
      }
    }
    lines.push('');
  }

  // BOM records
  if (bom.length > 0) {
    lines.push('# BOM — Bill of Materials');
    for (const item of bom) {
      lines.push(`BOM ${item.partNumber} ${item.manufacturer} QTY=${item.quantity} ;${item.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Info file generator
// ---------------------------------------------------------------------------

function generateInfoFile(projectName: string): string {
  const lines: string[] = [];
  lines.push(`UNITS=${UNITS}`);
  lines.push(`ODB_VERSION_NUM=${ODB_VERSION}`);
  lines.push(`PRODUCT_MODEL_NAME=${sanitizeFilename(projectName)}`);
  lines.push(`JOB_NAME=${sanitizeFilename(projectName)}`);
  lines.push(`CREATION_DATE=${new Date().toISOString().split('T')[0]}`);
  lines.push(`SAVE_DATE=${new Date().toISOString().split('T')[0]}`);
  lines.push(`SAVE_APP=${GENERATOR}`);
  lines.push(`SAVE_USER=ProtoPulse`);
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an ODB++ archive from project data.
 *
 * Returns a ZIP buffer containing the ODB++ directory structure.
 */
export async function generateOdbPlusPlus(input: OdbInput): Promise<OdbOutput> {
  const boardWidth = input.boardWidth ?? DEFAULT_BOARD_WIDTH;
  const boardHeight = input.boardHeight ?? DEFAULT_BOARD_HEIGHT;
  const layers = getStandardLayers();

  const zip = new JSZip();

  // matrix/matrix
  zip.file('matrix/matrix', generateMatrix(layers));

  // misc/info
  zip.file('misc/info', generateInfoFile(input.projectName));

  // steps/pcb/layers/<layer>/features
  zip.file(
    'steps/pcb/layers/comp_+_top/features',
    generateSignalLayer('top', input.instances, input.wires, input.parts, boardWidth, boardHeight),
  );
  zip.file(
    'steps/pcb/layers/comp_+_bot/features',
    generateSignalLayer('bottom', input.instances, input.wires, input.parts, boardWidth, boardHeight),
  );
  zip.file(
    'steps/pcb/layers/solder_mask_top/features',
    generateSolderMask('top', input.instances, input.parts),
  );
  zip.file(
    'steps/pcb/layers/solder_mask_bot/features',
    generateSolderMask('bottom', input.instances, input.parts),
  );
  zip.file(
    'steps/pcb/layers/silk_screen_top/features',
    generateSilkScreen('top', input.instances, input.parts),
  );
  zip.file(
    'steps/pcb/layers/silk_screen_bot/features',
    generateSilkScreen('bottom', input.instances, input.parts),
  );
  zip.file(
    'steps/pcb/layers/solder_paste_top/features',
    generateSolderPaste('top', input.instances, input.parts),
  );
  zip.file(
    'steps/pcb/layers/solder_paste_bot/features',
    generateSolderPaste('bottom', input.instances, input.parts),
  );
  zip.file(
    'steps/pcb/layers/drill/features',
    generateDrillLayer(input.instances, input.parts),
  );

  // steps/pcb/eda/data
  zip.file(
    'steps/pcb/eda/data',
    generateEdaData(input.instances, input.nets, input.parts, input.bom),
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  return {
    buffer,
    layerCount: layers.length,
    componentCount: input.instances.length,
  };
}
