/**
 * Altium Import Parsers
 *
 * Parses Altium ASCII schematic (SchDoc) and PCB (PcbDoc) formats.
 *
 * @module altium-parser
 */

import type { ImportedComponent, ImportedDesign, ImportedNet } from './import-types';
import { PIN_TYPE_MAP, createEmptyDesign } from './import-types';

// ---------------------------------------------------------------------------
// Altium Schematic
// ---------------------------------------------------------------------------

/**
 * Parse Altium ASCII schematic (SchDoc) format.
 */
export function parseAltiumSchematic(content: string): ImportedDesign {
  const design = createEmptyDesign('altium-schematic', '');

  if (!content.includes('|RECORD=')) {
    design.errors.push('Invalid Altium schematic: does not contain |RECORD= markers');
    return design;
  }

  const lines = content.split('\n');
  const componentMap = new Map<string, ImportedComponent>();
  const netMap = new Map<string, ImportedNet>();

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine.includes('|RECORD=')) {
      return;
    }

    const fields = parseAltiumRecord(trimmedLine);
    const recordType = fields.RECORD;

    // Component record (RECORD=1)
    if (recordType === '1') {
      const refDes = fields.DESIGNITEMID ?? fields.LIBREFERENCE ?? '';
      const component: ImportedComponent = {
        refDes: fields.DESIGNATOR ?? refDes,
        name: fields.LIBREFERENCE ?? fields.DESIGNITEMID ?? '',
        value: fields.COMPONENTDESCRIPTION ?? '',
        package: fields.FOOTPRINT ?? '',
        library: fields.SOURCELIBRARYNAME ?? '',
        position: fields.LOCATION_X && fields.LOCATION_Y
          ? { x: parseFloat(fields.LOCATION_X), y: parseFloat(fields.LOCATION_Y) }
          : undefined,
        rotation: fields.ORIENTATION ? parseFloat(fields.ORIENTATION) : undefined,
        properties: { ...fields },
        pins: [],
      };
      const ownerIndex = fields.OWNERINDEX ?? fields.CURRENTPARTID ?? crypto.randomUUID();
      componentMap.set(ownerIndex, component);
      design.components.push(component);
    }

    // Pin record (RECORD=2)
    if (recordType === '2') {
      const ownerIndex = fields.OWNERINDEX ?? '';
      const ownerComponent = componentMap.get(ownerIndex);
      if (ownerComponent) {
        const pinType = fields.ELECTRICAL ?? 'unspecified';
        ownerComponent.pins.push({
          number: fields.DESIGNATOR ?? fields.FORMALTYPE ?? '',
          name: fields.NAME ?? '',
          type: PIN_TYPE_MAP[pinType.toLowerCase()] ?? 'unspecified',
          position: fields.LOCATION_X && fields.LOCATION_Y
            ? { x: parseFloat(fields.LOCATION_X), y: parseFloat(fields.LOCATION_Y) }
            : undefined,
        });
      }
    }

    // Wire record (RECORD=27)
    if (recordType === '27') {
      if (fields.LOCATION_X && fields.LOCATION_Y && fields.CORNER_X && fields.CORNER_Y) {
        design.wires.push({
          start: { x: parseFloat(fields.LOCATION_X), y: parseFloat(fields.LOCATION_Y) },
          end: { x: parseFloat(fields.CORNER_X), y: parseFloat(fields.CORNER_Y) },
        });
      }
    }

    // Net label record (RECORD=25)
    if (recordType === '25') {
      const netName = fields.TEXT ?? fields.NAME ?? '';
      if (netName && !netMap.has(netName)) {
        netMap.set(netName, { name: netName, pins: [] });
      }
    }

    // Power object (RECORD=17)
    if (recordType === '17') {
      const netName = fields.TEXT ?? fields.NAME ?? '';
      if (netName && !netMap.has(netName)) {
        netMap.set(netName, { name: netName, pins: [] });
      }
    }

    // Sheet info (RECORD=31)
    if (recordType === '31') {
      if (fields.TITLE) {
        design.title = fields.TITLE;
      }
      if (fields.DATE) {
        design.date = fields.DATE;
      }
    }

    // Junction (RECORD=29) — add as warning for unsupported feature
    if (recordType === '29' || recordType === '30') {
      // Silently handle junctions and bus entries
    }
  });

  netMap.forEach((net) => {
    design.nets.push(net);
  });

  return design;
}

// ---------------------------------------------------------------------------
// Altium PCB
// ---------------------------------------------------------------------------

/**
 * Parse Altium ASCII PCB (PcbDoc) format.
 */
export function parseAltiumPcb(content: string): ImportedDesign {
  const design = createEmptyDesign('altium-pcb', '');

  if (!content.includes('|RECORD=')) {
    design.errors.push('Invalid Altium PCB: does not contain |RECORD= markers');
    return design;
  }

  const lines = content.split('\n');
  const netMap = new Map<string, ImportedNet>();

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine.includes('|RECORD=')) {
      return;
    }

    const fields = parseAltiumRecord(trimmedLine);
    const recordType = fields.RECORD;

    // Component record
    if (recordType === 'Component') {
      const component: ImportedComponent = {
        refDes: fields.DESIGNATOR ?? fields.NAME ?? '',
        name: fields.PATTERN ?? fields.SOURCEDESIGNATOR ?? '',
        value: fields.COMMENT ?? '',
        package: fields.PATTERN ?? '',
        library: fields.SOURCELIBRARY ?? '',
        position: fields.X && fields.Y
          ? { x: parseFloat(fields.X), y: parseFloat(fields.Y) }
          : undefined,
        rotation: fields.ROTATION ? parseFloat(fields.ROTATION) : undefined,
        layer: fields.LAYER,
        properties: { ...fields },
        pins: [],
      };
      design.components.push(component);
    }

    // Net record
    if (recordType === 'Net') {
      const netName = fields.NAME ?? '';
      if (netName && !netMap.has(netName)) {
        netMap.set(netName, { name: netName, pins: [], netClass: fields.NETCLASS });
      }
    }

    // Track (wire) record
    if (recordType === 'Track') {
      if (fields.X1 && fields.Y1 && fields.X2 && fields.Y2) {
        design.wires.push({
          start: { x: parseFloat(fields.X1), y: parseFloat(fields.Y1) },
          end: { x: parseFloat(fields.X2), y: parseFloat(fields.Y2) },
          width: fields.WIDTH ? parseFloat(fields.WIDTH) : undefined,
          layer: fields.LAYER,
          net: fields.NET,
        });
      }
    }

    // Pad record
    if (recordType === 'Pad') {
      const componentRef = fields.COMPONENT ?? '';
      const netName = fields.NET ?? '';
      if (componentRef && netName) {
        let net = netMap.get(netName);
        if (!net) {
          net = { name: netName, pins: [] };
          netMap.set(netName, net);
        }
        net.pins.push({
          componentRef,
          pinNumber: fields.DESIGNATOR ?? fields.NAME ?? '',
        });
      }
    }

    // Board record
    if (recordType === 'Board') {
      if (fields.TITLE) {
        design.title = fields.TITLE;
      }
    }
  });

  netMap.forEach((net) => {
    design.nets.push(net);
  });

  return design;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseAltiumRecord(line: string): Record<string, string> {
  const fields: Record<string, string> = {};

  // Split by | and parse key=value pairs
  const parts = line.split('|');
  parts.forEach((part) => {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const key = part.substring(0, eqIdx).trim();
      const value = part.substring(eqIdx + 1).trim();
      if (key) {
        fields[key] = value;
      }
    }
  });

  return fields;
}
