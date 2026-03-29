/**
 * EAGLE Import Parsers
 *
 * Parses EAGLE schematic (.sch), board (.brd), and library (.lbr) XML formats.
 *
 * @module eagle-parser
 */

import type { ImportedComponent, ImportedDesign, ImportedNet } from './import-types';
import { PIN_TYPE_MAP, createEmptyDesign } from './import-types';
import { findXmlDescendant, findXmlDescendants, parseXml } from './xml-parser';

// ---------------------------------------------------------------------------
// EAGLE Schematic
// ---------------------------------------------------------------------------

/**
 * Parse EAGLE schematic (.sch) XML format.
 */
export function parseEagleSchematic(content: string): ImportedDesign {
  const design = createEmptyDesign('eagle-schematic', '');

  if (!content.includes('<eagle')) {
    design.errors.push('Invalid EAGLE file: does not contain <eagle> element');
    return design;
  }

  const root = parseXml(content);
  if (!root) {
    design.errors.push('Failed to parse XML');
    return design;
  }

  // Get version from eagle element
  if (root.attributes.version) {
    design.version = root.attributes.version;
  }

  // Find schematic
  const schematic = findXmlDescendant(root, 'schematic');

  if (schematic) {
    // Extract parts
    const parts = findXmlDescendants(schematic, 'part');
    parts.forEach((part) => {
      const component: ImportedComponent = {
        refDes: part.attributes.name ?? '',
        name: part.attributes.deviceset ?? part.attributes.name ?? '',
        value: part.attributes.value ?? '',
        package: part.attributes.device ?? '',
        library: part.attributes.library ?? '',
        properties: { ...part.attributes },
        pins: [],
      };
      design.components.push(component);
    });

    // Extract nets
    const nets = findXmlDescendants(schematic, 'net');
    nets.forEach((net) => {
      const importedNet: ImportedNet = {
        name: net.attributes.name ?? '',
        pins: [],
      };

      const pinRefs = findXmlDescendants(net, 'pinref');
      pinRefs.forEach((pinRef) => {
        importedNet.pins.push({
          componentRef: pinRef.attributes.part ?? '',
          pinNumber: pinRef.attributes.pin ?? '',
        });
      });

      design.nets.push(importedNet);
    });

    // Extract wires
    const wires = findXmlDescendants(schematic, 'wire');
    wires.forEach((wire) => {
      design.wires.push({
        start: { x: parseFloat(wire.attributes.x1 ?? '0'), y: parseFloat(wire.attributes.y1 ?? '0') },
        end: { x: parseFloat(wire.attributes.x2 ?? '0'), y: parseFloat(wire.attributes.y2 ?? '0') },
        width: wire.attributes.width ? parseFloat(wire.attributes.width) : undefined,
        layer: wire.attributes.layer,
      });
    });
  }

  return design;
}

// ---------------------------------------------------------------------------
// EAGLE Board
// ---------------------------------------------------------------------------

/**
 * Parse EAGLE board (.brd) XML format.
 */
export function parseEagleBoard(content: string): ImportedDesign {
  const design = createEmptyDesign('eagle-board', '');

  if (!content.includes('<eagle')) {
    design.errors.push('Invalid EAGLE file: does not contain <eagle> element');
    return design;
  }

  const root = parseXml(content);
  if (!root) {
    design.errors.push('Failed to parse XML');
    return design;
  }

  if (root.attributes.version) {
    design.version = root.attributes.version;
  }

  // Find board
  const board = findXmlDescendant(root, 'board');

  if (board) {
    // Extract elements (component placements)
    const elements = findXmlDescendants(board, 'element');
    elements.forEach((elem) => {
      const component: ImportedComponent = {
        refDes: elem.attributes.name ?? '',
        name: elem.attributes.value ?? elem.attributes.name ?? '',
        value: elem.attributes.value ?? '',
        package: elem.attributes.package ?? '',
        library: elem.attributes.library ?? '',
        position: {
          x: parseFloat(elem.attributes.x ?? '0'),
          y: parseFloat(elem.attributes.y ?? '0'),
        },
        rotation: elem.attributes.rot ? parseFloat(elem.attributes.rot.replace(/[^0-9.]/g, '')) : undefined,
        properties: { ...elem.attributes },
        pins: [],
      };
      design.components.push(component);
    });

    // Extract signals (nets)
    const signals = findXmlDescendants(board, 'signal');
    signals.forEach((signal) => {
      const importedNet: ImportedNet = {
        name: signal.attributes.name ?? '',
        pins: [],
      };

      const contactRefs = findXmlDescendants(signal, 'contactref');
      contactRefs.forEach((ref) => {
        importedNet.pins.push({
          componentRef: ref.attributes.element ?? '',
          pinNumber: ref.attributes.pad ?? '',
        });
      });

      design.nets.push(importedNet);
    });

    // Extract wires
    const wires = findXmlDescendants(board, 'wire');
    wires.forEach((wire) => {
      design.wires.push({
        start: { x: parseFloat(wire.attributes.x1 ?? '0'), y: parseFloat(wire.attributes.y1 ?? '0') },
        end: { x: parseFloat(wire.attributes.x2 ?? '0'), y: parseFloat(wire.attributes.y2 ?? '0') },
        width: wire.attributes.width ? parseFloat(wire.attributes.width) : undefined,
        layer: wire.attributes.layer,
      });
    });
  }

  return design;
}

// ---------------------------------------------------------------------------
// EAGLE Library
// ---------------------------------------------------------------------------

/**
 * Parse EAGLE library (.lbr) XML format.
 */
export function parseEagleLibrary(content: string): ImportedDesign {
  const design = createEmptyDesign('eagle-library', '');

  if (!content.includes('<eagle')) {
    design.errors.push('Invalid EAGLE file: does not contain <eagle> element');
    return design;
  }

  const root = parseXml(content);
  if (!root) {
    design.errors.push('Failed to parse XML');
    return design;
  }

  if (root.attributes.version) {
    design.version = root.attributes.version;
  }

  // Find library
  const library = findXmlDescendant(root, 'library');

  if (library) {
    design.metadata.libraryName = library.attributes.name ?? '';

    // Extract devicesets
    const devicesets = findXmlDescendants(library, 'deviceset');
    devicesets.forEach((deviceset) => {
      const component: ImportedComponent = {
        refDes: deviceset.attributes.prefix ?? '',
        name: deviceset.attributes.name ?? '',
        value: '',
        package: '',
        library: library.attributes.name ?? '',
        properties: { ...deviceset.attributes },
        pins: [],
      };

      // Get gates to find pins
      const gates = findXmlDescendants(deviceset, 'gate');
      gates.forEach((gate) => {
        component.properties[`gate_${gate.attributes.name ?? ''}`] = gate.attributes.symbol ?? '';
      });

      // Get devices for package info
      const devices = findXmlDescendants(deviceset, 'device');
      if (devices.length > 0) {
        component.package = devices[0].attributes.package ?? '';
      }

      design.components.push(component);
    });

    // Extract symbols for pin info
    const symbols = findXmlDescendants(library, 'symbol');
    symbols.forEach((symbol) => {
      const pins = findXmlDescendants(symbol, 'pin');
      pins.forEach((pin) => {
        // Try to find which component uses this symbol
        const symbolName = symbol.attributes.name ?? '';
        const matchingComponent = design.components.find((c) => {
          return Object.values(c.properties).some((v) => v === symbolName);
        });

        if (matchingComponent) {
          const direction = pin.attributes.direction ?? 'unspecified';
          matchingComponent.pins.push({
            number: pin.attributes.name ?? '',
            name: pin.attributes.name ?? '',
            type: PIN_TYPE_MAP[direction] ?? (PIN_TYPE_MAP[direction.toLowerCase()] ?? 'unspecified'),
            position: pin.attributes.x && pin.attributes.y
              ? { x: parseFloat(pin.attributes.x), y: parseFloat(pin.attributes.y) }
              : undefined,
          });
        }
      });
    });
  }

  return design;
}
