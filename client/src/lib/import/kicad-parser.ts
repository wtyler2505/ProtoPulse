/**
 * KiCad Import Parsers
 *
 * Parses KiCad schematic (.kicad_sch), PCB (.kicad_pcb), and
 * symbol library (.kicad_sym) S-expression formats.
 *
 * @module kicad-parser
 */

import type { ImportedComponent, ImportedDesign, ImportedWire } from './import-types';
import { PIN_TYPE_MAP, createEmptyDesign } from './import-types';
import type { SExprNode } from './sexpr-parser';
import { findChild, findChildren, getChildValue, parseSExprTokens, tokenizeSExpr } from './sexpr-parser';

// ---------------------------------------------------------------------------
// KiCad Schematic
// ---------------------------------------------------------------------------

/**
 * Parse KiCad schematic (.kicad_sch) S-expression format.
 */
export function parseKicadSchematic(content: string): ImportedDesign {
  const design = createEmptyDesign('kicad-schematic', '');
  const trimmed = content.trim();

  if (!trimmed.startsWith('(kicad_sch')) {
    design.errors.push('Invalid KiCad schematic: does not start with (kicad_sch');
    return design;
  }

  const tokens = tokenizeSExpr(trimmed);
  const tree = parseSExprTokens(tokens);

  if (tree.length === 0) {
    design.errors.push('Failed to parse S-expression');
    return design;
  }

  const root = tree[0];

  // Extract version
  const versionVal = getChildValue(root, 'version');
  if (versionVal) {
    design.version = versionVal;
  }

  // Extract title block
  const titleBlock = findChild(root, 'title_block');
  if (titleBlock) {
    const titleVal = getChildValue(titleBlock, 'title');
    if (titleVal) {
      design.title = titleVal;
    }
    const dateVal = getChildValue(titleBlock, 'date');
    if (dateVal) {
      design.date = dateVal;
    }
  }

  // Extract symbols (components)
  const symbols = findChildren(root, 'symbol');
  symbols.forEach((sym) => {
    const component = parseKicadSchematicSymbol(sym);
    if (component) {
      design.components.push(component);
    }
  });

  // Extract wires
  const wires = findChildren(root, 'wire');
  wires.forEach((wire) => {
    const parsed = parseKicadWire(wire);
    if (parsed) {
      design.wires.push(parsed);
    }
  });

  // Extract net labels as nets
  const labels = findChildren(root, 'label');
  const globalLabels = findChildren(root, 'global_label');

  const netMap = new Map<string, { name: string; pins: Array<{ componentRef: string; pinNumber: string }> }>();

  labels.forEach((label) => {
    const name = label.values[0];
    if (name && !netMap.has(name)) {
      netMap.set(name, { name, pins: [] });
    }
  });

  globalLabels.forEach((label) => {
    const name = label.values[0];
    if (name && !netMap.has(name)) {
      netMap.set(name, { name, pins: [] });
    }
  });

  netMap.forEach((net) => {
    design.nets.push(net);
  });

  return design;
}

// ---------------------------------------------------------------------------
// KiCad PCB
// ---------------------------------------------------------------------------

/**
 * Parse KiCad PCB (.kicad_pcb) S-expression format.
 */
export function parseKicadPcb(content: string): ImportedDesign {
  const design = createEmptyDesign('kicad-pcb', '');
  const trimmed = content.trim();

  if (!trimmed.startsWith('(kicad_pcb')) {
    design.errors.push('Invalid KiCad PCB: does not start with (kicad_pcb');
    return design;
  }

  const tokens = tokenizeSExpr(trimmed);
  const tree = parseSExprTokens(tokens);

  if (tree.length === 0) {
    design.errors.push('Failed to parse S-expression');
    return design;
  }

  const root = tree[0];

  // Extract version
  const versionVal = getChildValue(root, 'version');
  if (versionVal) {
    design.version = versionVal;
  }

  // Extract footprints (components)
  const footprints = findChildren(root, 'footprint');
  footprints.forEach((fp) => {
    const component = parseKicadFootprint(fp);
    if (component) {
      design.components.push(component);
    }
  });

  // Extract nets
  const nets = findChildren(root, 'net');
  nets.forEach((net) => {
    const id = net.values[0];
    const name = net.values[1];
    if (name && name !== '') {
      design.nets.push({ name, pins: [] });
      design.metadata[`net_${id ?? ''}`] = name;
    }
  });

  // Extract segments as wires
  const segments = findChildren(root, 'segment');
  segments.forEach((seg) => {
    const parsed = parseKicadSegment(seg);
    if (parsed) {
      design.wires.push(parsed);
    }
  });

  return design;
}

// ---------------------------------------------------------------------------
// KiCad Symbol Library
// ---------------------------------------------------------------------------

/**
 * Parse KiCad symbol library (.kicad_sym) S-expression format.
 */
export function parseKicadSymbol(content: string): ImportedDesign {
  const design = createEmptyDesign('kicad-symbol', '');
  const trimmed = content.trim();

  if (!trimmed.startsWith('(kicad_symbol_lib')) {
    design.errors.push('Invalid KiCad symbol library: does not start with (kicad_symbol_lib');
    return design;
  }

  const tokens = tokenizeSExpr(trimmed);
  const tree = parseSExprTokens(tokens);

  if (tree.length === 0) {
    design.errors.push('Failed to parse S-expression');
    return design;
  }

  const root = tree[0];

  // Extract version
  const versionVal = getChildValue(root, 'version');
  if (versionVal) {
    design.version = versionVal;
  }

  // Extract symbols
  const symbols = findChildren(root, 'symbol');
  symbols.forEach((sym) => {
    const name = sym.values[0] ?? 'unknown';

    // Skip sub-symbols (contain _0_, _1_ etc.)
    if (name.includes('_0_') || name.includes('_1_')) {
      return;
    }

    const component: ImportedComponent = {
      refDes: '',
      name,
      value: '',
      package: '',
      library: '',
      properties: {},
      pins: [],
    };

    // Extract properties
    const properties = findChildren(sym, 'property');
    properties.forEach((prop) => {
      const propName = prop.values[0];
      const propValue = prop.values[1] ?? '';
      if (propName) {
        component.properties[propName] = propValue;
        if (propName === 'Reference') {
          component.refDes = propValue;
        }
        if (propName === 'Value') {
          component.value = propValue;
        }
        if (propName === 'Footprint') {
          component.package = propValue;
        }
      }
    });

    // Extract pins from sub-symbols
    const subSymbols = findChildren(sym, 'symbol');
    subSymbols.forEach((subSym) => {
      const pins = findChildren(subSym, 'pin');
      pins.forEach((pin) => {
        const pinType = pin.values[0] ?? 'unspecified';
        const nameNode = findChild(pin, 'name');
        const numberNode = findChild(pin, 'number');
        const atNode = findChild(pin, 'at');

        component.pins.push({
          number: numberNode?.values[0] ?? '',
          name: nameNode?.values[0] ?? '',
          type: PIN_TYPE_MAP[pinType] ?? 'unspecified',
          position: atNode ? { x: parseFloat(atNode.values[0] ?? '0'), y: parseFloat(atNode.values[1] ?? '0') } : undefined,
        });
      });
    });

    design.components.push(component);
  });

  return design;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseKicadSchematicSymbol(sym: SExprNode): ImportedComponent | null {
  // The first value is the reference like "R1" or "C1" or library ref
  const refOrLib = sym.values[0] ?? '';

  // Skip power symbols and non-components
  if (refOrLib.startsWith('#')) {
    return null;
  }

  const component: ImportedComponent = {
    refDes: refOrLib,
    name: '',
    value: '',
    package: '',
    library: '',
    properties: {},
    pins: [],
  };

  // Check for lib_id
  const libId = getChildValue(sym, 'lib_id');
  if (libId) {
    component.library = libId;
    const parts = libId.split(':');
    component.name = parts.length > 1 ? parts[1] : parts[0];
  }

  // Extract properties
  const properties = findChildren(sym, 'property');
  properties.forEach((prop) => {
    const propName = prop.values[0];
    const propValue = prop.values[1] ?? '';
    if (propName) {
      component.properties[propName] = propValue;
      if (propName === 'Reference') {
        component.refDes = propValue;
      }
      if (propName === 'Value') {
        component.value = propValue;
      }
      if (propName === 'Footprint') {
        component.package = propValue;
      }
    }
  });

  // Extract position from at node
  const atNode = findChild(sym, 'at');
  if (atNode) {
    component.position = {
      x: parseFloat(atNode.values[0] ?? '0'),
      y: parseFloat(atNode.values[1] ?? '0'),
    };
    if (atNode.values[2]) {
      component.rotation = parseFloat(atNode.values[2]);
    }
  }

  // Extract pins
  const pins = findChildren(sym, 'pin');
  pins.forEach((pin) => {
    const pinType = pin.values[0] ?? 'unspecified';
    const nameNode = findChild(pin, 'name');
    const numberNode = findChild(pin, 'number');
    const pinAt = findChild(pin, 'at');

    component.pins.push({
      number: numberNode?.values[0] ?? '',
      name: nameNode?.values[0] ?? '',
      type: PIN_TYPE_MAP[pinType] ?? 'unspecified',
      position: pinAt ? { x: parseFloat(pinAt.values[0] ?? '0'), y: parseFloat(pinAt.values[1] ?? '0') } : undefined,
    });
  });

  return component;
}

function parseKicadWire(wire: SExprNode): ImportedWire | null {
  const pts = findChild(wire, 'pts');
  if (!pts) {
    return null;
  }

  const xyNodes = findChildren(pts, 'xy');
  if (xyNodes.length < 2) {
    return null;
  }

  return {
    start: { x: parseFloat(xyNodes[0].values[0] ?? '0'), y: parseFloat(xyNodes[0].values[1] ?? '0') },
    end: { x: parseFloat(xyNodes[1].values[0] ?? '0'), y: parseFloat(xyNodes[1].values[1] ?? '0') },
  };
}

function parseKicadFootprint(fp: SExprNode): ImportedComponent | null {
  const libRef = fp.values[0] ?? '';

  const component: ImportedComponent = {
    refDes: '',
    name: libRef,
    value: '',
    package: libRef,
    library: '',
    properties: {},
    pins: [],
  };

  // Extract reference and value from fp_text
  const fpTexts = findChildren(fp, 'fp_text');
  fpTexts.forEach((text) => {
    if (text.values[0] === 'reference') {
      component.refDes = text.values[1] ?? '';
    }
    if (text.values[0] === 'value') {
      component.value = text.values[1] ?? '';
    }
  });

  // Also check property nodes (KiCad 7+)
  const properties = findChildren(fp, 'property');
  properties.forEach((prop) => {
    const propName = prop.values[0];
    const propValue = prop.values[1] ?? '';
    if (propName) {
      component.properties[propName] = propValue;
      if (propName === 'Reference') {
        component.refDes = propValue;
      }
      if (propName === 'Value') {
        component.value = propValue;
      }
    }
  });

  // Extract position
  const atNode = findChild(fp, 'at');
  if (atNode) {
    component.position = {
      x: parseFloat(atNode.values[0] ?? '0'),
      y: parseFloat(atNode.values[1] ?? '0'),
    };
    if (atNode.values[2]) {
      component.rotation = parseFloat(atNode.values[2]);
    }
  }

  // Extract layer
  const layer = getChildValue(fp, 'layer');
  if (layer) {
    component.layer = layer;
  }

  // Extract pads as pins
  const pads = findChildren(fp, 'pad');
  pads.forEach((pad) => {
    const padNumber = pad.values[0] ?? '';
    const padType = pad.values[1] ?? '';
    const padAt = findChild(pad, 'at');

    component.pins.push({
      number: padNumber,
      name: padNumber,
      type: padType === 'smd' || padType === 'thru_hole' ? 'passive' : 'unspecified',
      position: padAt ? { x: parseFloat(padAt.values[0] ?? '0'), y: parseFloat(padAt.values[1] ?? '0') } : undefined,
    });
  });

  return component;
}

function parseKicadSegment(seg: SExprNode): ImportedWire | null {
  const startNode = findChild(seg, 'start');
  const endNode = findChild(seg, 'end');

  if (!startNode || !endNode) {
    return null;
  }

  const wire: ImportedWire = {
    start: { x: parseFloat(startNode.values[0] ?? '0'), y: parseFloat(startNode.values[1] ?? '0') },
    end: { x: parseFloat(endNode.values[0] ?? '0'), y: parseFloat(endNode.values[1] ?? '0') },
  };

  const widthVal = getChildValue(seg, 'width');
  if (widthVal) {
    wire.width = parseFloat(widthVal);
  }

  const netVal = getChildValue(seg, 'net');
  if (netVal) {
    wire.net = netVal;
  }

  const layerVal = getChildValue(seg, 'layer');
  if (layerVal) {
    wire.layer = layerVal;
  }

  return wire;
}
