/**
 * LTspice Import Parser
 *
 * Parses LTspice schematic (.asc) format.
 *
 * LTspice .asc files start with `Version N` + `SHEET ...`, then contain:
 * - `SYMBOL name x y Rn` -- component placement (R0/R90/R180/R270 = rotation)
 * - `SYMATTR InstName Xn` -- reference designator for preceding SYMBOL
 * - `SYMATTR Value val` -- value for preceding SYMBOL
 * - `SYMATTR SpiceModel model` -- SPICE model name
 * - `WIRE x1 y1 x2 y2` -- net wire segment
 * - `FLAG x y netName` -- net label at a position
 * - `TEXT x y ...` -- text annotation (ignored)
 *
 * Coordinates are in LTspice internal units (16 units = 1 grid square).
 *
 * @module ltspice-parser
 */

import type { ImportedComponent, ImportedDesign, ImportedNet } from './import-types';
import { createEmptyDesign } from './import-types';

/**
 * Parse LTspice schematic (.asc) format.
 */
export function parseLtspiceSchematic(content: string): ImportedDesign {
  const design = createEmptyDesign('ltspice-schematic', '');

  const lines = content.split('\n');
  if (lines.length === 0) {
    design.errors.push('Empty LTspice file');
    return design;
  }

  // Parse version
  const versionMatch = /^Version\s+(\d+)/i.exec(lines[0].trim());
  if (versionMatch) {
    design.version = versionMatch[1];
  }

  const netMap = new Map<string, ImportedNet>();
  let currentComponent: ImportedComponent | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // SYMBOL name x y rotation
    const symbolMatch = /^SYMBOL\s+(\S+)\s+(-?\d+)\s+(-?\d+)\s+(R\d+|M\d+)?/.exec(trimmedLine);
    if (symbolMatch) {
      // Save previous component
      if (currentComponent) {
        design.components.push(currentComponent);
      }

      const symbolName = symbolMatch[1];
      const x = parseFloat(symbolMatch[2]) / 16; // Convert to grid units
      const y = parseFloat(symbolMatch[3]) / 16;
      const rotStr = symbolMatch[4] ?? 'R0';
      const rotation = parseInt(rotStr.replace(/[RM]/, ''), 10) || 0;

      currentComponent = {
        refDes: '',
        name: symbolName,
        value: '',
        package: '',
        library: 'ltspice',
        position: { x, y },
        rotation,
        properties: { symbolName },
        pins: [],
      };
      continue;
    }

    // SYMATTR key value -- attributes for preceding SYMBOL
    const symattrMatch = /^SYMATTR\s+(\S+)\s+(.*)$/.exec(trimmedLine);
    if (symattrMatch && currentComponent) {
      const key = symattrMatch[1];
      const value = symattrMatch[2].trim();
      currentComponent.properties[key] = value;

      if (key === 'InstName') {
        currentComponent.refDes = value;
      } else if (key === 'Value') {
        currentComponent.value = value;
      } else if (key === 'Value2') {
        currentComponent.properties.value2 = value;
      } else if (key === 'SpiceModel') {
        currentComponent.properties.spiceModel = value;
      }
      continue;
    }

    // WIRE x1 y1 x2 y2
    const wireMatch = /^WIRE\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/.exec(trimmedLine);
    if (wireMatch) {
      design.wires.push({
        start: { x: parseFloat(wireMatch[1]) / 16, y: parseFloat(wireMatch[2]) / 16 },
        end: { x: parseFloat(wireMatch[3]) / 16, y: parseFloat(wireMatch[4]) / 16 },
      });
      continue;
    }

    // FLAG x y netName -- net label
    const flagMatch = /^FLAG\s+(-?\d+)\s+(-?\d+)\s+(\S+)/.exec(trimmedLine);
    if (flagMatch) {
      const netName = flagMatch[3];
      if (!netMap.has(netName)) {
        netMap.set(netName, { name: netName, pins: [] });
      }
      continue;
    }

    // IOPIN x y direction -- I/O pin on hierarchical sheet
    const iopinMatch = /^IOPIN\s+(-?\d+)\s+(-?\d+)\s+(\S+)/.exec(trimmedLine);
    if (iopinMatch && currentComponent) {
      const direction = iopinMatch[3].toLowerCase();
      const pinType = direction === 'in' ? 'input' : direction === 'out' ? 'output' : 'bidirectional';
      currentComponent.pins.push({
        number: String(currentComponent.pins.length + 1),
        name: direction,
        type: pinType,
        position: { x: parseFloat(iopinMatch[1]) / 16, y: parseFloat(iopinMatch[2]) / 16 },
      });
      continue;
    }

    // WINDOW -- pin/port info line (provides pin display info)
    const windowMatch = /^WINDOW\s+(\d+)\s+(-?\d+)\s+(-?\d+)/.exec(trimmedLine);
    if (windowMatch && currentComponent) {
      const pinIdx = parseInt(windowMatch[1], 10);
      if (pinIdx > 0 && currentComponent.pins.length < pinIdx) {
        // Add placeholder pins up to this index
        while (currentComponent.pins.length < pinIdx) {
          const n = currentComponent.pins.length + 1;
          currentComponent.pins.push({
            number: String(n),
            name: `pin${String(n)}`,
            type: 'passive',
          });
        }
      }
      continue;
    }
  }

  // Push the last component
  if (currentComponent) {
    design.components.push(currentComponent);
  }

  // Add standard SPICE pins for known component types
  design.components.forEach((comp) => {
    if (comp.pins.length === 0) {
      const pinCount = inferLtspicePinCount(comp.name);
      for (let p = 1; p <= pinCount; p++) {
        comp.pins.push({
          number: String(p),
          name: `pin${String(p)}`,
          type: 'passive',
        });
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

/**
 * Infer pin count for common LTspice component types.
 * Resistors/capacitors/inductors/voltage/current sources = 2 pins.
 * Diodes = 2, BJTs = 3, MOSFETs = 3, op-amps = 5.
 */
export function inferLtspicePinCount(symbolName: string): number {
  const lower = symbolName.toLowerCase();
  // Passive 2-terminal
  if (lower === 'res' || lower === 'res2' || lower === 'cap' || lower === 'ind' || lower === 'ind2') {
    return 2;
  }
  // Sources
  if (lower === 'voltage' || lower === 'current' || lower === 'bv' || lower === 'bi') {
    return 2;
  }
  // Diode
  if (lower === 'diode' || lower === 'zener' || lower === 'schottky' || lower === 'led') {
    return 2;
  }
  // BJT
  if (lower === 'npn' || lower === 'pnp') {
    return 3;
  }
  // MOSFET
  if (lower === 'nmos' || lower === 'pmos' || lower === 'nmos3' || lower === 'pmos3') {
    return 3;
  }
  // Op-amp (non-inverting, inverting, V+, V-, out)
  if (lower === 'opamp' || lower === 'opamp2') {
    return 5;
  }
  // Default: 2 pins
  return 2;
}
