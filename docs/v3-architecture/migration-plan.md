# v3 Architecture Migration Plan

Decision: keep the current xyflow Architecture view live while v3 tldraw runs as a bridged lane.

## Source

- `architecture_nodes.nodeId`
- `architecture_nodes.nodeType`
- `architecture_nodes.label`
- `architecture_nodes.positionX`
- `architecture_nodes.positionY`
- `architecture_nodes.data`
- `architecture_edges.edgeId`
- `architecture_edges.source`
- `architecture_edges.target`
- `architecture_edges.signalType`
- `architecture_edges.voltage`
- `architecture_edges.busWidth`
- `architecture_edges.netName`

## Target

- one tldraw shape per architecture node
- one tldraw arrow shape per architecture edge
- all v3 data stored under `shape.meta.protopulse`
- node provenance starts as `xyflow-node:<nodeId>`
- edge provenance starts as `xyflow-edge:<edgeId>`

## Gates

- migration adapter preserves node and edge count
- migrated shapes extract into v3 boundaries
- v3 boundary rules can block unsafe or incomplete metadata
- compile report shows accepted facts, missing facts, blocked tasks, and emitted TSX state

## Rollout

1. Keep xyflow as the default live view.
2. Add an export path from live nodes/edges into the v3 migration adapter.
3. Open migrated tldraw shapes behind a feature flag or alternate route.
4. Run the one-file compile check on the migrated sample.
5. Replace the default only after the migration gates pass on a real project.
