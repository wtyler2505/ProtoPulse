/**
 * Proteus Import Parser
 *
 * Parses Proteus design (.dsn) keyword-based format.
 *
 * Proteus DSN files are structured with keyword blocks:
 * - `DESIGN` header with metadata
 * - `COMPONENT` blocks containing `PARTNAME`, `REFDES`, and pin connectivity
 * - `NET` blocks containing `NODE` entries (component+pin references)
 *
 * This parser handles the text-based export format. Binary .dsn files are
 * not supported (a warning is emitted).
 *
 * @module proteus-parser
 */

import type { ImportedComponent, ImportedDesign, ImportedNet } from './import-types';
import { createEmptyDesign } from './import-types';

/**
 * Parse Proteus design (.dsn) keyword-based format.
 */
export function parseProteusSchematic(content: string): ImportedDesign {
  const design = createEmptyDesign('proteus-schematic', '');

  if (content.charCodeAt(0) < 32 && content.charCodeAt(0) !== 10 && content.charCodeAt(0) !== 13) {
    design.errors.push('Binary Proteus file detected — only text-based DSN exports are supported');
    return design;
  }

  const lines = content.split('\n');
  const netMap = new Map<string, ImportedNet>();
  let currentComponent: ImportedComponent | null = null;
  let currentNetName = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // DESIGN title
    const designMatch = /^DESIGN\s+"?([^"]*)"?/.exec(trimmedLine);
    if (designMatch) {
      design.title = designMatch[1].trim();
      continue;
    }

    // COMPONENT block start
    const componentMatch = /^COMPONENT\s+"?([^"]*)"?/.exec(trimmedLine);
    if (componentMatch) {
      if (currentComponent) {
        design.components.push(currentComponent);
      }
      currentComponent = {
        refDes: componentMatch[1].trim(),
        name: '',
        value: '',
        package: '',
        library: 'proteus',
        properties: {},
        pins: [],
      };
      continue;
    }

    // PARTNAME inside component block
    const partMatch = /^PARTNAME\s+"?([^"]*)"?/.exec(trimmedLine);
    if (partMatch && currentComponent) {
      currentComponent.name = partMatch[1].trim();
      continue;
    }

    // REFDES override
    const refdesMatch = /^REFDES\s+"?([^"]*)"?/.exec(trimmedLine);
    if (refdesMatch && currentComponent) {
      currentComponent.refDes = refdesMatch[1].trim();
      continue;
    }

    // PACKAGE
    const pkgMatch = /^PACKAGE\s+"?([^"]*)"?/.exec(trimmedLine);
    if (pkgMatch && currentComponent) {
      currentComponent.package = pkgMatch[1].trim();
      continue;
    }

    // VALUE
    const valMatch = /^VALUE\s+"?([^"]*)"?/.exec(trimmedLine);
    if (valMatch && currentComponent) {
      currentComponent.value = valMatch[1].trim();
      continue;
    }

    // LOCATION x y
    const locMatch = /^LOCATION\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(trimmedLine);
    if (locMatch && currentComponent) {
      currentComponent.position = { x: parseFloat(locMatch[1]), y: parseFloat(locMatch[2]) };
      continue;
    }

    // ROTATION angle
    const rotMatch = /^ROTATION\s+(-?[\d.]+)/.exec(trimmedLine);
    if (rotMatch && currentComponent) {
      currentComponent.rotation = parseFloat(rotMatch[1]);
      continue;
    }

    // PIN number name
    const pinMatch = /^PIN\s+"?([^"]*)"?\s+"?([^"]*)"?/.exec(trimmedLine);
    if (pinMatch && currentComponent) {
      currentComponent.pins.push({
        number: pinMatch[1].trim(),
        name: pinMatch[2].trim() || pinMatch[1].trim(),
        type: 'passive',
      });
      continue;
    }

    // NET block start
    const netMatch = /^NET\s+"?([^"]*)"?/.exec(trimmedLine);
    if (netMatch) {
      if (currentComponent) {
        design.components.push(currentComponent);
        currentComponent = null;
      }
      currentNetName = netMatch[1].trim();
      if (!netMap.has(currentNetName)) {
        netMap.set(currentNetName, { name: currentNetName, pins: [] });
      }
      continue;
    }

    // NODE component pin -- inside NET block
    const nodeMatch = /^NODE\s+"?([^"]*)"?\s+"?([^"]*)"?/.exec(trimmedLine);
    if (nodeMatch && currentNetName) {
      const net = netMap.get(currentNetName);
      if (net) {
        net.pins.push({
          componentRef: nodeMatch[1].trim(),
          pinNumber: nodeMatch[2].trim(),
        });
      }
      continue;
    }
  }

  // Push last component
  if (currentComponent) {
    design.components.push(currentComponent);
  }

  netMap.forEach((net) => {
    design.nets.push(net);
  });

  return design;
}
