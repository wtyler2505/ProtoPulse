// =============================================================================
// KiCad Exporter — PCB board assembly (.kicad_pcb)
// =============================================================================

import { deterministicUuid, esc, ind, num } from './sexpr';
import { mapWireLayer } from './meta';
import { buildNetIndex } from './netlist';
import { generatePcbFootprint } from './footprints';
import {
  DEFAULT_BOARD_HEIGHT,
  DEFAULT_BOARD_THICKNESS,
  DEFAULT_BOARD_WIDTH,
  DEFAULT_TRACE_WIDTH,
  EDGE_CUTS_WIDTH,
  GENERATOR,
  PCB_VERSION,
  type KicadInput,
} from './types';

/**
 * Generates the layers section of the PCB file.
 * KiCad 7 uses a fixed set of layer IDs.
 */
export function generatePcbLayers(): string {
  const lines: string[] = [];
  lines.push(`${ind(1)}(layers`);
  lines.push(`${ind(2)}(0 "F.Cu" signal)`);
  lines.push(`${ind(2)}(31 "B.Cu" signal)`);
  lines.push(`${ind(2)}(32 "B.Adhes" user "B.Adhesive")`);
  lines.push(`${ind(2)}(33 "F.Adhes" user "F.Adhesive")`);
  lines.push(`${ind(2)}(34 "B.Paste" user)`);
  lines.push(`${ind(2)}(35 "F.Paste" user)`);
  lines.push(`${ind(2)}(36 "B.SilkS" user "B.Silkscreen")`);
  lines.push(`${ind(2)}(37 "F.SilkS" user "F.Silkscreen")`);
  lines.push(`${ind(2)}(38 "B.Mask" user)`);
  lines.push(`${ind(2)}(39 "F.Mask" user)`);
  lines.push(`${ind(2)}(40 "Dwgs.User" user "User.Drawings")`);
  lines.push(`${ind(2)}(41 "Cmts.User" user "User.Comments")`);
  lines.push(`${ind(2)}(42 "Eco1.User" user "User.Eco1")`);
  lines.push(`${ind(2)}(43 "Eco2.User" user "User.Eco2")`);
  lines.push(`${ind(2)}(44 "Edge.Cuts" user)`);
  lines.push(`${ind(2)}(45 "Margin" user)`);
  lines.push(`${ind(2)}(46 "B.CrtYd" user "B.Courtyard")`);
  lines.push(`${ind(2)}(47 "F.CrtYd" user "F.Courtyard")`);
  lines.push(`${ind(2)}(48 "B.Fab" user)`);
  lines.push(`${ind(2)}(49 "F.Fab" user)`);
  lines.push(`${ind(1)})`);
  return lines.join('\n');
}

/** Generates the PCB setup section with basic defaults. */
export function generatePcbSetup(): string {
  const lines: string[] = [];
  lines.push(`${ind(1)}(setup`);
  lines.push(`${ind(2)}(stackup`);
  lines.push(`${ind(3)}(layer "F.SilkS" (type "Top Silk Screen"))`);
  lines.push(`${ind(3)}(layer "F.Paste" (type "Top Solder Paste"))`);
  lines.push(`${ind(3)}(layer "F.Mask" (type "Top Solder Mask") (thickness 0.01))`);
  lines.push(`${ind(3)}(layer "F.Cu" (type "copper") (thickness 0.035))`);
  lines.push(`${ind(3)}(layer "dielectric 1" (type "core") (thickness 1.51) (material "FR4") (epsilon_r 4.5) (loss_tangent 0.02))`);
  lines.push(`${ind(3)}(layer "B.Cu" (type "copper") (thickness 0.035))`);
  lines.push(`${ind(3)}(layer "B.Mask" (type "Bottom Solder Mask") (thickness 0.01))`);
  lines.push(`${ind(3)}(layer "B.Paste" (type "Bottom Solder Paste"))`);
  lines.push(`${ind(3)}(layer "B.SilkS" (type "Bottom Silk Screen"))`);
  lines.push(`${ind(2)})`);
  lines.push(`${ind(2)}(pad_to_mask_clearance 0.051)`);
  lines.push(`${ind(2)}(pcbplotparams`);
  lines.push(`${ind(3)}(layerselection 0x00010fc_ffffffff)`);
  lines.push(`${ind(3)}(outputformat 1)`);
  lines.push(`${ind(3)}(mirror false)`);
  lines.push(`${ind(3)}(drillshape 1)`);
  lines.push(`${ind(3)}(scaleselection 1)`);
  lines.push(`${ind(3)}(outputdirectory "")`);
  lines.push(`${ind(2)})`);
  lines.push(`${ind(1)})`);
  return lines.join('\n');
}

/** Generates the net declarations section of the PCB. */
export function generatePcbNets(netList: Array<{ name: string; code: number }>): string {
  const lines: string[] = [];

  // Net 0 = unconnected (KiCad standard)
  lines.push(`${ind(1)}(net 0 "")`);

  netList.forEach(function emitNetDeclaration(net) {
    lines.push(`${ind(1)}(net ${net.code} "${esc(net.name)}")`);
  });

  return lines.join('\n');
}

/**
 * Generates PCB traces from the wires array.
 * Only wires in the 'pcb' view are included.
 */
export function generatePcbTraces(
  input: KicadInput,
  netList: Array<{ name: string; code: number }>,
): string {
  const lines: string[] = [];

  // Build a netId (array index) -> net code lookup
  const netCodeByIndex = new Map<number, number>();
  input.nets.forEach(function indexNetCode(_net, idx) {
    if (idx < netList.length) {
      netCodeByIndex.set(idx, netList[idx].code);
    }
  });

  input.wires.forEach(function emitPcbTrace(wire) {
    if (wire.view !== 'pcb') return;
    if (wire.points.length < 2) return;

    const layer = mapWireLayer(wire.layer);
    const width = wire.width > 0 ? wire.width : DEFAULT_TRACE_WIDTH;
    const netCode = netCodeByIndex.get(wire.netId) ?? 0;

    for (let i = 0; i < wire.points.length - 1; i++) {
      const p1 = wire.points[i];
      const p2 = wire.points[i + 1];

      lines.push(
        `${ind(1)}(segment (start ${num(p1.x)} ${num(p1.y)}) (end ${num(p2.x)} ${num(p2.y)})` +
        ` (width ${num(width)}) (layer "${layer}") (net ${netCode})` +
        ` (uuid "${deterministicUuid(input.circuit.id, wire.netId, 200 + i)}"))`,
      );
    }
  });

  return lines.join('\n');
}

/**
 * Generates the board outline on the Edge.Cuts layer as four gr_line segments.
 */
export function generateBoardOutline(width: number, height: number): string {
  const lines: string[] = [];

  // Rectangle outline: (0,0) -> (width,0) -> (width,height) -> (0,height) -> (0,0)
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  for (let i = 0; i < corners.length; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % corners.length];
    lines.push(
      `${ind(1)}(gr_line (start ${num(start.x)} ${num(start.y)}) (end ${num(end.x)} ${num(end.y)})` +
      ` (stroke (width ${num(EDGE_CUTS_WIDTH)}) (type default)) (layer "Edge.Cuts"))`,
    );
  }

  return lines.join('\n');
}

/** Generates the complete .kicad_pcb file content. */
export function generateKicadPcb(input: KicadInput): string {
  const { netList, pinToNet } = buildNetIndex(input);
  const lines: string[] = [];

  const boardW = input.boardWidth ?? DEFAULT_BOARD_WIDTH;
  const boardH = input.boardHeight ?? DEFAULT_BOARD_HEIGHT;

  lines.push(`(kicad_pcb (version ${PCB_VERSION}) (generator "${GENERATOR}")`);
  lines.push('');

  lines.push(`${ind(1)}(general`);
  lines.push(`${ind(2)}(thickness ${DEFAULT_BOARD_THICKNESS})`);
  lines.push(`${ind(1)})`);
  lines.push('');

  lines.push(generatePcbLayers());
  lines.push('');

  lines.push(generatePcbSetup());
  lines.push('');

  lines.push(generatePcbNets(netList));
  lines.push('');

  input.instances.forEach(function emitPcbFootprint(inst) {
    const part = inst.partId != null ? input.parts.get(inst.partId) : undefined;
    if (!part) return;
    lines.push(generatePcbFootprint(inst, part, pinToNet, input));
    lines.push('');
  });

  const traces = generatePcbTraces(input, netList);
  if (traces) {
    lines.push(traces);
    lines.push('');
  }

  lines.push(generateBoardOutline(boardW, boardH));

  lines.push(')');
  return lines.join('\n');
}
