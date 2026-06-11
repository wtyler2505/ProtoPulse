/**
 * diagram/anchors.ts
 *
 * Node anchor resolution for edges, wires, labels, and ports.
 *
 * This is the **ratified Phase 0 design** (from inventory + Agent B handoff):
 *   getNodeAnchor(node, measuredSize?, kind?) eliminates every hardcoded
 *   +75 / +35 / +180 / +120 magic number currently in ArchitectureView.tsx
 *   (and future views) for 150×70 assumed boxes and variable-height nodes.
 *
 * Guarantees:
 * - Accepts GraphNode (from @/lib/graph-types), DiagramNode, or any minimal
 *   { position: {x,y}, ... } without forcing imports of either source type
 *   (callers map in one line if needed).
 * - measuredSize?: MeasuredSize | null — caller-supplied runtime size
 *   (from getBoundingClientRect / ResizeObserver) takes precedence.
 * - Falls back to node.size (if present on DiagramNode) then 150×70 default.
 * - Supports all 9 AnchorKind values.
 * - Returns NodeAnchor {x, y, kind} in world coordinates.
 * - **Zero mutation** of input node (critical: never touch persisted GraphNode.shape or data).
 * - Pure function.
 *
 * Architecture 20px grid friendly: results are exact (callers may snapValue the result if attaching new nodes).
 */

import type { Point, MeasuredSize, AnchorKind, NodeAnchor } from './types';

const DEFAULT_NODE_SIZE: MeasuredSize = { width: 150, height: 70 };

type Anchorable = {
  id?: string;
  position: Point | { x: number; y: number };
  size?: MeasuredSize;
  [key: string]: unknown; // tolerate GraphNode extras, data, etc.
};

/**
 * Resolve a named anchor point on a node for edge attachment etc.
 *
 * @param node - GraphNode | DiagramNode | plain positioned object (read-only)
 * @param measuredSize - Optional runtime measured size override (preferred when supplied)
 * @param kind - Which anchor to compute (default 'center')
 */
export function getNodeAnchor(
  node: Anchorable | any,
  measuredSize?: MeasuredSize | null,
  kind: AnchorKind = 'center'
): NodeAnchor {
  const pos = (node && (node as any).position) || { x: 0, y: 0 };
  const px = Number(pos.x) || 0;
  const py = Number(pos.y) || 0;

  // Priority: explicit arg > node embedded size > 150×70 Architecture default
  const size: MeasuredSize =
    measuredSize && typeof measuredSize.width === 'number' && typeof measuredSize.height === 'number'
      ? measuredSize
      : (node as any)?.size &&
        typeof (node as any).size.width === 'number' &&
        typeof (node as any).size.height === 'number'
      ? (node as any).size
      : DEFAULT_NODE_SIZE;

  const w = typeof size.width === 'number' && isFinite(size.width) ? size.width : 150;
  const h = typeof size.height === 'number' && isFinite(size.height) ? size.height : 70;

  const cx = px + w / 2;
  const cy = py + h / 2;

  let ax = cx;
  let ay = cy;

  switch (kind) {
    case 'left':
      ax = px;
      ay = cy;
      break;
    case 'right':
      ax = px + w;
      ay = cy;
      break;
    case 'top':
      ax = cx;
      ay = py;
      break;
    case 'bottom':
      ax = cx;
      ay = py + h;
      break;
    case 'top-left':
      ax = px;
      ay = py;
      break;
    case 'top-right':
      ax = px + w;
      ay = py;
      break;
    case 'bottom-left':
      ax = px;
      ay = py + h;
      break;
    case 'bottom-right':
      ax = px + w;
      ay = py + h;
      break;
    case 'center':
    default:
      ax = cx;
      ay = cy;
      break;
  }

  return { x: ax, y: ay, kind };
}
