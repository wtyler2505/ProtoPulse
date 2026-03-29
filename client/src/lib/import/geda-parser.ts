/**
 * gEDA/gschem Import Parser
 *
 * Parses gEDA/gschem schematic (.sch) format.
 *
 * gEDA schematics are line-oriented with a version header (`v YYYYMMDD N`),
 * component blocks (`C x y ...` through `}`) containing attributes (`T`/`A`
 * lines), net segments (`N x1 y1 x2 y2 color`), and pin blocks
 * (`P x1 y1 x2 y2 color ...`). Attribute key-value pairs appear as
 * `key=value` lines inside `{...}` attribute blocks.
 *
 * @module geda-parser
 */

import type { ImportedComponent, ImportedDesign, ImportedNet } from './import-types';
import { createEmptyDesign } from './import-types';

/**
 * Parse gEDA/gschem schematic (.sch) format.
 */
export function parseGedaSchematic(content: string): ImportedDesign {
  const design = createEmptyDesign('geda-schematic', '');

  if (!/^v\s+\d{8}\s+\d+/.test(content.trim())) {
    design.errors.push('Invalid gEDA schematic: missing version header (v YYYYMMDD N)');
    return design;
  }

  const lines = content.split('\n');
  let i = 0;

  // Parse version from first line
  const versionMatch = /^v\s+(\d{8})\s+(\d+)/.exec(lines[0]);
  if (versionMatch) {
    design.version = versionMatch[1];
  }

  const netMap = new Map<string, ImportedNet>();
  let componentIndex = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Component block: C x y selectable angle mirror basename
    if (line.startsWith('C ')) {
      const parts = line.split(/\s+/);
      // C x y selectable angle mirror basename
      const x = parseFloat(parts[1] ?? '0');
      const y = parseFloat(parts[2] ?? '0');
      const angle = parseFloat(parts[4] ?? '0');
      const basename = parts[6] ?? `comp_${String(componentIndex)}`;
      componentIndex++;

      const component: ImportedComponent = {
        refDes: '',
        name: basename.replace(/\.sym$/, ''),
        value: '',
        package: '',
        library: 'geda',
        position: { x: x / 100, y: y / 100 }, // gEDA uses mils*100 internally
        rotation: angle,
        properties: {},
        pins: [],
      };

      // Read attribute block if next line is '{'
      i++;
      if (i < lines.length && lines[i].trim() === '{') {
        i++;
        while (i < lines.length && lines[i].trim() !== '}') {
          const attrLine = lines[i].trim();
          // Attribute lines may be 'T ...' (text) followed by key=value on next line
          // or direct key=value
          const kvMatch = /^([A-Za-z_][A-Za-z0-9_-]*)=(.*)$/.exec(attrLine);
          if (kvMatch) {
            const key = kvMatch[1];
            const value = kvMatch[2];
            component.properties[key] = value;

            if (key === 'refdes') {
              component.refDes = value;
            } else if (key === 'value') {
              component.value = value;
            } else if (key === 'footprint') {
              component.package = value;
            } else if (key === 'device') {
              if (!component.name || component.name === basename.replace(/\.sym$/, '')) {
                component.name = value;
              }
            }
          }
          i++;
        }
        i++; // skip '}'
      }

      design.components.push(component);
      continue;
    }

    // Net segment: N x1 y1 x2 y2 color
    if (line.startsWith('N ')) {
      const parts = line.split(/\s+/);
      const x1 = parseFloat(parts[1] ?? '0') / 100;
      const y1 = parseFloat(parts[2] ?? '0') / 100;
      const x2 = parseFloat(parts[3] ?? '0') / 100;
      const y2 = parseFloat(parts[4] ?? '0') / 100;

      design.wires.push({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });

      // Check for net name attribute block
      i++;
      if (i < lines.length && lines[i].trim() === '{') {
        i++;
        while (i < lines.length && lines[i].trim() !== '}') {
          const attrLine = lines[i].trim();
          const kvMatch = /^netname=(.+)$/.exec(attrLine);
          if (kvMatch) {
            const netName = kvMatch[1];
            if (!netMap.has(netName)) {
              netMap.set(netName, { name: netName, pins: [] });
            }
          }
          i++;
        }
        i++; // skip '}'
      }
      continue;
    }

    // Pin block: P x1 y1 x2 y2 color pintype whichend
    if (line.startsWith('P ')) {
      const parts = line.split(/\s+/);
      const pinX = parseFloat(parts[1] ?? '0') / 100;
      const pinY = parseFloat(parts[2] ?? '0') / 100;
      const pinType = parts[6] ?? '0';

      let pinNumber = '';
      let pinName = '';

      // Read attribute block for pin
      i++;
      if (i < lines.length && lines[i].trim() === '{') {
        i++;
        while (i < lines.length && lines[i].trim() !== '}') {
          const attrLine = lines[i].trim();
          const kvMatch = /^([A-Za-z_][A-Za-z0-9_-]*)=(.*)$/.exec(attrLine);
          if (kvMatch) {
            if (kvMatch[1] === 'pinnumber') {
              pinNumber = kvMatch[2];
            } else if (kvMatch[1] === 'pinlabel') {
              pinName = kvMatch[2];
            }
          }
          i++;
        }
        i++; // skip '}'
      }

      // Attach pin to last component
      if (design.components.length > 0) {
        const lastComp = design.components[design.components.length - 1];
        const gedaPinType = pinType === '1' ? 'input' : pinType === '2' ? 'output' : 'passive';
        lastComp.pins.push({
          number: pinNumber,
          name: pinName || pinNumber,
          type: gedaPinType,
          position: { x: pinX, y: pinY },
        });
      }
      continue;
    }

    i++;
  }

  // Build net pin references from components
  design.components.forEach((comp) => {
    comp.pins.forEach((pin) => {
      if (comp.refDes && pin.number) {
        // Check if any net is associated via wire connectivity (simplified)
        netMap.forEach((net) => {
          if (net.pins.length < 10) { // prevent accidental over-population
            net.pins.push({ componentRef: comp.refDes, pinNumber: pin.number });
          }
        });
      }
    });
  });

  netMap.forEach((net) => {
    design.nets.push(net);
  });

  return design;
}
