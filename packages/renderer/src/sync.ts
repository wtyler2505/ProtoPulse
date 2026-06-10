import type { DesignGraph, GraphDelta, Uuid } from '@protopulse/graph';
import type { PartDb } from '@protopulse/parts';
import { buildSymbolNode, buildWireNode, type SceneGraph } from './scene.js';

/**
 * Incremental scene sync: re-tessellate ONLY the entities a GraphDelta
 * names. The delta is diff(prevGraph, nextGraph); `graph` is nextGraph.
 * Untouched nodes keep their object identity (tested), so GPU buffers
 * and pick entries for them can be reused.
 */

function syncSymbol(scene: SceneGraph, graph: DesignGraph, parts: PartDb, id: Uuid): void {
  const component = graph.components.get(id);
  const placement = graph.schematic.placements.get(id);
  if (!component || !placement) {
    scene.remove(id);
    return;
  }
  const part = parts.get(component.partId, component.partRev);
  if (!part) {
    scene.remove(id);
    return;
  }
  scene.update(buildSymbolNode(component, part, placement));
}

function syncWire(scene: SceneGraph, graph: DesignGraph, netId: Uuid): void {
  const segments = graph.schematic.wires.get(netId);
  if (!graph.nets.has(netId) || !segments || segments.length === 0) {
    scene.remove(netId);
    return;
  }
  scene.update(buildWireNode(netId, segments));
}

export function applyDelta(
  scene: SceneGraph,
  delta: GraphDelta,
  graph: DesignGraph,
  parts: PartDb,
): void {
  // ── Symbols ──
  for (const id of delta.components.removed) scene.remove(id);
  for (const id of delta.schematicView.unplaced) scene.remove(id);

  const symbolResync = new Set<Uuid>([
    ...delta.components.added,
    ...delta.components.changed.keys(),
    ...delta.schematicView.placed,
    ...delta.schematicView.moved,
  ]);
  for (const id of symbolResync) syncSymbol(scene, graph, parts, id);

  // ── Wires ──
  for (const netId of delta.nets.removed) scene.remove(netId);
  for (const [oldId, newId] of delta.nets.recreated) {
    scene.remove(oldId);
    syncWire(scene, graph, newId);
  }

  const wireResync = new Set<Uuid>([...delta.nets.added, ...delta.schematicView.wiresChanged]);
  for (const netId of wireResync) syncWire(scene, graph, netId);
}
