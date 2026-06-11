import assert from 'node:assert/strict';
import sample from '../examples/sample-architecture.json';
import { migrateXyflowArchitectureToTldraw } from '../src/architecture/xyflow-to-tldraw';
import { extractBoundariesFromTldrawShapes } from '../src/components/canvas/CanvasBindings';

const result = migrateXyflowArchitectureToTldraw(sample.legacyArchitecture);
const boundaries = extractBoundariesFromTldrawShapes(result.tldrawShapes);

assert.equal(result.migratedNodeCount, sample.legacyArchitecture.nodes.length);
assert.equal(result.migratedEdgeCount, sample.legacyArchitecture.edges.length);
assert.equal(result.tldrawShapes.length, sample.legacyArchitecture.nodes.length + sample.legacyArchitecture.edges.length);
assert.equal(boundaries.length, result.tldrawShapes.length);
assert.ok(boundaries.some((boundary) => boundary.kind === 'hardware'));
assert.ok(boundaries.some((boundary) => boundary.kind === 'power'));
assert.ok(boundaries.some((boundary) => boundary.kind === 'signal'));

console.log(JSON.stringify({
  migratedNodeCount: result.migratedNodeCount,
  migratedEdgeCount: result.migratedEdgeCount,
  migratedBoundaryKinds: boundaries.map((boundary) => boundary.kind),
}, null, 2));
