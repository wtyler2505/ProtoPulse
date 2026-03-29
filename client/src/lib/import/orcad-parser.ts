/**
 * OrCAD Import Parser
 *
 * Parses OrCAD/CadStar schematic (.dsn) s-expression format.
 *
 * OrCAD DSN export uses a Lisp-like s-expression structure:
 * ```
 * (design "name"
 *   (library
 *     (component "package" (pin "name" "number" ...))
 *     ...)
 *   (placement
 *     (component "package" (place "refdes" x y side rotation)))
 *   (network
 *     (net "name" (pins "ref-pin" ...))))
 * ```
 *
 * Reuses the S-expression tokenizer/parser from the KiCad parsers.
 *
 * @module orcad-parser
 */

import type { ImportedComponent, ImportedDesign, ImportedNet } from './import-types';
import { createEmptyDesign } from './import-types';
import { findChild, findChildren, parseSExprTokens, tokenizeSExpr } from './sexpr-parser';

/**
 * Parse OrCAD/CadStar schematic (.dsn) s-expression format.
 */
export function parseOrcadSchematic(content: string): ImportedDesign {
  const design = createEmptyDesign('orcad-schematic', '');

  const trimmed = content.trim();
  if (!trimmed.startsWith('(')) {
    design.errors.push('Invalid OrCAD DSN: does not start with s-expression');
    return design;
  }

  const tokens = tokenizeSExpr(trimmed);
  const tree = parseSExprTokens(tokens);

  if (tree.length === 0) {
    design.errors.push('Failed to parse OrCAD DSN s-expression');
    return design;
  }

  const root = tree[0];

  // Extract design name
  if (root.values.length > 0) {
    design.title = root.values[0];
  }

  // Extract components from (placement ...) section
  const placement = findChild(root, 'placement');
  if (placement) {
    const components = findChildren(placement, 'component');
    components.forEach((comp) => {
      const packageName = comp.values[0] ?? '';

      // Each component has (place refdes x y side rotation)
      const places = findChildren(comp, 'place');
      places.forEach((place) => {
        const refDes = place.values[0] ?? '';
        const x = parseFloat(place.values[1] ?? '0');
        const y = parseFloat(place.values[2] ?? '0');
        const side = place.values[3] ?? 'front';
        const rotation = parseFloat(place.values[4] ?? '0');

        const component: ImportedComponent = {
          refDes,
          name: packageName,
          value: '',
          package: packageName,
          library: 'orcad',
          position: { x, y },
          rotation,
          layer: side,
          properties: {},
          pins: [],
        };

        design.components.push(component);
      });
    });
  }

  // Extract pin definitions from (library ...) section
  const library = findChild(root, 'library');
  if (library) {
    const libComponents = findChildren(library, 'component');
    libComponents.forEach((libComp) => {
      const packageName = libComp.values[0] ?? '';

      // Find matching placed components
      const matchingComponents = design.components.filter((c) => c.package === packageName);

      // Extract pins from (pin ...)
      const pins = findChildren(libComp, 'pin');
      pins.forEach((pin) => {
        const pinName = pin.values[0] ?? '';
        const pinNumber = pin.values[1] ?? pinName;

        matchingComponents.forEach((comp) => {
          comp.pins.push({
            number: pinNumber,
            name: pinName,
            type: 'passive',
          });
        });
      });
    });
  }

  // Extract nets from (network ...) section
  const network = findChild(root, 'network');
  if (network) {
    const nets = findChildren(network, 'net');
    nets.forEach((net) => {
      const netName = net.values[0] ?? '';
      const importedNet: ImportedNet = { name: netName, pins: [] };

      // (pins "REF-PIN" "REF-PIN" ...)
      const pinsNode = findChild(net, 'pins');
      if (pinsNode) {
        pinsNode.values.forEach((pinRef) => {
          const dashIdx = pinRef.lastIndexOf('-');
          if (dashIdx > 0) {
            importedNet.pins.push({
              componentRef: pinRef.substring(0, dashIdx),
              pinNumber: pinRef.substring(dashIdx + 1),
            });
          }
        });
      }

      if (netName) {
        design.nets.push(importedNet);
      }
    });
  }

  return design;
}
