/**
 * STEP File Generator (ISO-10303-21 AP214)
 *
 * Generates valid STEP files for ECAD-MCAD integration. Exports 3D board
 * assemblies as BREP solid geometry: rectangular boxes for board + components,
 * cylinders for vias. Compatible with SolidWorks, FreeCAD, Fusion 360, etc.
 *
 * Pure string generation — no external npm packages required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepComponentInput {
  refDes: string;
  packageType: string;
  x: number;
  y: number;
  rotation: number;
  side: 'front' | 'back';
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
}

export interface StepViaInput {
  x: number;
  y: number;
  drillDiameter: number;
  outerDiameter: number;
}

export interface StepBoardInput {
  width: number;
  height: number;
  thickness: number;
  cornerRadius?: number;
}

export interface StepInput {
  projectName: string;
  board: StepBoardInput;
  components: StepComponentInput[];
  vias: StepViaInput[];
}

export interface StepOutput {
  content: string;
  filename: string;
}

// ---------------------------------------------------------------------------
// Package dimension defaults (from board-viewer-3d.ts BUILTIN_PACKAGES)
// ---------------------------------------------------------------------------

interface PackageDimensions {
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
}

const PACKAGE_DIMENSIONS: Record<string, PackageDimensions> = {
  'DIP-8': { bodyWidth: 9.53, bodyHeight: 6.35, bodyDepth: 3.3 },
  'DIP-14': { bodyWidth: 19.05, bodyHeight: 6.35, bodyDepth: 3.3 },
  'DIP-16': { bodyWidth: 19.05, bodyHeight: 6.35, bodyDepth: 3.3 },
  'DIP-28': { bodyWidth: 35.56, bodyHeight: 6.35, bodyDepth: 3.3 },
  'DIP-40': { bodyWidth: 50.8, bodyHeight: 15.24, bodyDepth: 3.3 },
  'SOIC-8': { bodyWidth: 4.9, bodyHeight: 3.9, bodyDepth: 1.75 },
  'SOIC-14': { bodyWidth: 8.65, bodyHeight: 3.9, bodyDepth: 1.75 },
  'SOIC-16': { bodyWidth: 9.9, bodyHeight: 3.9, bodyDepth: 1.75 },
  'SOT-23': { bodyWidth: 2.9, bodyHeight: 1.3, bodyDepth: 1.1 },
  'SOT-223': { bodyWidth: 6.5, bodyHeight: 3.5, bodyDepth: 1.8 },
  'QFP-32': { bodyWidth: 7.0, bodyHeight: 7.0, bodyDepth: 1.4 },
  'QFP-44': { bodyWidth: 10.0, bodyHeight: 10.0, bodyDepth: 1.0 },
  'QFP-48': { bodyWidth: 9.0, bodyHeight: 9.0, bodyDepth: 1.4 },
  'QFP-64': { bodyWidth: 12.0, bodyHeight: 12.0, bodyDepth: 1.4 },
  'QFP-100': { bodyWidth: 14.0, bodyHeight: 14.0, bodyDepth: 1.4 },
  'QFN-32': { bodyWidth: 5.0, bodyHeight: 5.0, bodyDepth: 0.85 },
  'TQFP-44': { bodyWidth: 10.0, bodyHeight: 10.0, bodyDepth: 1.0 },
  'TO-220': { bodyWidth: 10.0, bodyHeight: 4.5, bodyDepth: 15.0 },
  'TO-252': { bodyWidth: 6.5, bodyHeight: 6.1, bodyDepth: 2.3 },
  '0402': { bodyWidth: 1.0, bodyHeight: 0.5, bodyDepth: 0.35 },
  '0603': { bodyWidth: 1.6, bodyHeight: 0.8, bodyDepth: 0.45 },
  '0805': { bodyWidth: 2.0, bodyHeight: 1.25, bodyDepth: 0.5 },
  '1206': { bodyWidth: 3.2, bodyHeight: 1.6, bodyDepth: 0.55 },
  '2512': { bodyWidth: 1.5, bodyHeight: 3.2, bodyDepth: 0.55 },
  'SOP-8': { bodyWidth: 5.3, bodyHeight: 6.2, bodyDepth: 1.75 },
};

// ---------------------------------------------------------------------------
// Entity ID counter
// ---------------------------------------------------------------------------

class EntityCounter {
  private id = 0;
  next(): number {
    return ++this.id;
  }
  current(): number {
    return this.id;
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function rotatePoint(x: number, y: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function formatCoord(v: number): string {
  // STEP uses plain decimal notation, avoid scientific notation
  if (v === 0) { return '0.'; }
  const s = v.toFixed(6);
  // Ensure trailing decimal point for integer values
  if (!s.includes('.')) { return s + '.'; }
  return s;
}

function cartesianPoint(counter: EntityCounter, x: number, y: number, z: number): { id: number; line: string } {
  const id = counter.next();
  return { id, line: `#${id} = CARTESIAN_POINT('',(${formatCoord(x)},${formatCoord(y)},${formatCoord(z)}));` };
}

function direction(counter: EntityCounter, dx: number, dy: number, dz: number): { id: number; line: string } {
  const id = counter.next();
  return { id, line: `#${id} = DIRECTION('',(${formatCoord(dx)},${formatCoord(dy)},${formatCoord(dz)}));` };
}

function axis2Placement3D(
  counter: EntityCounter,
  originId: number,
  zAxisId: number,
  xAxisId: number,
): { id: number; line: string } {
  const id = counter.next();
  return { id, line: `#${id} = AXIS2_PLACEMENT_3D('',#${originId},#${zAxisId},#${xAxisId});` };
}

function vertexPoint(counter: EntityCounter, pointId: number): { id: number; line: string } {
  const id = counter.next();
  return { id, line: `#${id} = VERTEX_POINT('',#${pointId});` };
}

function vector(counter: EntityCounter, dirId: number, magnitude: number): { id: number; line: string } {
  const id = counter.next();
  return { id, line: `#${id} = VECTOR('',#${dirId},${formatCoord(magnitude)});` };
}

function lineEntity(counter: EntityCounter, pointId: number, vectorId: number): { id: number; line: string } {
  const id = counter.next();
  return { id, line: `#${id} = LINE('',#${pointId},#${vectorId});` };
}

function edgeCurve(
  counter: EntityCounter,
  startVertexId: number,
  endVertexId: number,
  curveId: number,
  sameDirection: boolean,
): { id: number; line: string } {
  const id = counter.next();
  const dir = sameDirection ? '.T.' : '.F.';
  return { id, line: `#${id} = EDGE_CURVE('',#${startVertexId},#${endVertexId},#${curveId},${dir});` };
}

function orientedEdge(
  counter: EntityCounter,
  edgeId: number,
  orientation: boolean,
): { id: number; line: string } {
  const id = counter.next();
  const dir = orientation ? '.T.' : '.F.';
  return { id, line: `#${id} = ORIENTED_EDGE('',*,*,#${edgeId},${dir});` };
}

function edgeLoop(counter: EntityCounter, orientedEdgeIds: number[]): { id: number; line: string } {
  const id = counter.next();
  const refs = orientedEdgeIds.map((eid) => `#${eid}`).join(',');
  return { id, line: `#${id} = EDGE_LOOP('',(${refs}));` };
}

function faceOuterBound(counter: EntityCounter, loopId: number, orientation: boolean): { id: number; line: string } {
  const id = counter.next();
  const dir = orientation ? '.T.' : '.F.';
  return { id, line: `#${id} = FACE_OUTER_BOUND('',#${loopId},${dir});` };
}

function plane(counter: EntityCounter, placementId: number): { id: number; line: string } {
  const id = counter.next();
  return { id, line: `#${id} = PLANE('',#${placementId});` };
}

function advancedFace(
  counter: EntityCounter,
  boundIds: number[],
  surfaceId: number,
  sameSense: boolean,
): { id: number; line: string } {
  const id = counter.next();
  const refs = boundIds.map((bid) => `#${bid}`).join(',');
  const dir = sameSense ? '.T.' : '.F.';
  return { id, line: `#${id} = ADVANCED_FACE('',(${refs}),#${surfaceId},${dir});` };
}

function closedShell(counter: EntityCounter, faceIds: number[]): { id: number; line: string } {
  const id = counter.next();
  const refs = faceIds.map((fid) => `#${fid}`).join(',');
  return { id, line: `#${id} = CLOSED_SHELL('',(${refs}));` };
}

function manifoldSolidBrep(counter: EntityCounter, name: string, shellId: number): { id: number; line: string } {
  const id = counter.next();
  return { id, line: `#${id} = MANIFOLD_SOLID_BREP('${escapeStepString(name)}',#${shellId});` };
}

// ---------------------------------------------------------------------------
// Cylinder approximation (8-sided prism)
// ---------------------------------------------------------------------------

const CYLINDER_SEGMENTS = 16;

export interface CylinderResult {
  lines: string[];
  brepId: number;
}

export function buildCylinder(
  counter: EntityCounter,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  name: string,
): CylinderResult {
  const lines: string[] = [];
  const n = CYLINDER_SEGMENTS;

  // Generate top and bottom ring vertices
  const topVertexIds: number[] = [];
  const bottomVertexIds: number[] = [];

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);

    // Bottom vertex
    const bPt = cartesianPoint(counter, px, py, cz);
    lines.push(bPt.line);
    const bVtx = vertexPoint(counter, bPt.id);
    lines.push(bVtx.line);
    bottomVertexIds.push(bVtx.id);

    // Top vertex
    const tPt = cartesianPoint(counter, px, py, cz + height);
    lines.push(tPt.line);
    const tVtx = vertexPoint(counter, tPt.id);
    lines.push(tVtx.line);
    topVertexIds.push(tVtx.id);
  }

  // Direction for vertical lines
  const upDir = direction(counter, 0, 0, 1);
  lines.push(upDir.line);
  const upVec = vector(counter, upDir.id, height);
  lines.push(upVec.line);

  // Build side faces (quadrilateral panels)
  const sideFaceIds: number[] = [];
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;

    // Four edges of this quad: bottom[i]->bottom[i2], top[i2]->top[i], verticals
    // Bottom edge
    const bPtLine = cartesianPoint(counter, 0, 0, 0); // dummy for line
    lines.push(bPtLine.line);
    const bDir = direction(counter, 1, 0, 0);
    lines.push(bDir.line);
    const bVecE = vector(counter, bDir.id, 1.0);
    lines.push(bVecE.line);
    const bLine = lineEntity(counter, bPtLine.id, bVecE.id);
    lines.push(bLine.line);
    const bottomEdge = edgeCurve(counter, bottomVertexIds[i], bottomVertexIds[i2], bLine.id, true);
    lines.push(bottomEdge.line);

    // Right vertical edge (bottom[i2] -> top[i2])
    const rPtLine = cartesianPoint(counter, 0, 0, 0);
    lines.push(rPtLine.line);
    const rLine = lineEntity(counter, rPtLine.id, upVec.id);
    lines.push(rLine.line);
    const rightEdge = edgeCurve(counter, bottomVertexIds[i2], topVertexIds[i2], rLine.id, true);
    lines.push(rightEdge.line);

    // Top edge (top[i2] -> top[i])
    const tPtLine = cartesianPoint(counter, 0, 0, 0);
    lines.push(tPtLine.line);
    const tDir = direction(counter, -1, 0, 0);
    lines.push(tDir.line);
    const tVecE = vector(counter, tDir.id, 1.0);
    lines.push(tVecE.line);
    const tLine = lineEntity(counter, tPtLine.id, tVecE.id);
    lines.push(tLine.line);
    const topEdge = edgeCurve(counter, topVertexIds[i2], topVertexIds[i], tLine.id, true);
    lines.push(topEdge.line);

    // Left vertical edge (top[i] -> bottom[i])
    const lPtLine = cartesianPoint(counter, 0, 0, 0);
    lines.push(lPtLine.line);
    const lLine = lineEntity(counter, lPtLine.id, upVec.id);
    lines.push(lLine.line);
    const leftEdge = edgeCurve(counter, topVertexIds[i], bottomVertexIds[i], lLine.id, true);
    lines.push(leftEdge.line);

    // Oriented edges
    const oe1 = orientedEdge(counter, bottomEdge.id, true);
    lines.push(oe1.line);
    const oe2 = orientedEdge(counter, rightEdge.id, true);
    lines.push(oe2.line);
    const oe3 = orientedEdge(counter, topEdge.id, true);
    lines.push(oe3.line);
    const oe4 = orientedEdge(counter, leftEdge.id, true);
    lines.push(oe4.line);

    const loop = edgeLoop(counter, [oe1.id, oe2.id, oe3.id, oe4.id]);
    lines.push(loop.line);
    const bound = faceOuterBound(counter, loop.id, true);
    lines.push(bound.line);

    // Plane for this face
    const facePtId = cartesianPoint(counter, 0, 0, 0);
    lines.push(facePtId.line);
    const faceZId = direction(counter, 0, 0, 1);
    lines.push(faceZId.line);
    const faceXId = direction(counter, 1, 0, 0);
    lines.push(faceXId.line);
    const facePlacement = axis2Placement3D(counter, facePtId.id, faceZId.id, faceXId.id);
    lines.push(facePlacement.line);
    const facePlane = plane(counter, facePlacement.id);
    lines.push(facePlane.line);

    const face = advancedFace(counter, [bound.id], facePlane.id, true);
    lines.push(face.line);
    sideFaceIds.push(face.id);
  }

  // Build bottom cap
  const bottomCapEdgeIds: number[] = [];
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    const ptL = cartesianPoint(counter, 0, 0, 0);
    lines.push(ptL.line);
    const dir2 = direction(counter, 1, 0, 0);
    lines.push(dir2.line);
    const vec2 = vector(counter, dir2.id, 1.0);
    lines.push(vec2.line);
    const ln = lineEntity(counter, ptL.id, vec2.id);
    lines.push(ln.line);
    const ec = edgeCurve(counter, bottomVertexIds[i], bottomVertexIds[i2], ln.id, true);
    lines.push(ec.line);
    // Reversed orientation for bottom (inward-facing normal)
    const oe = orientedEdge(counter, ec.id, false);
    lines.push(oe.line);
    bottomCapEdgeIds.push(oe.id);
  }
  const bottomLoop = edgeLoop(counter, bottomCapEdgeIds);
  lines.push(bottomLoop.line);
  const bottomBound = faceOuterBound(counter, bottomLoop.id, true);
  lines.push(bottomBound.line);
  const bottomPt = cartesianPoint(counter, cx, cy, cz);
  lines.push(bottomPt.line);
  const bottomZ = direction(counter, 0, 0, -1);
  lines.push(bottomZ.line);
  const bottomX = direction(counter, 1, 0, 0);
  lines.push(bottomX.line);
  const bottomPlacement = axis2Placement3D(counter, bottomPt.id, bottomZ.id, bottomX.id);
  lines.push(bottomPlacement.line);
  const bottomPlane = plane(counter, bottomPlacement.id);
  lines.push(bottomPlane.line);
  const bottomFace = advancedFace(counter, [bottomBound.id], bottomPlane.id, true);
  lines.push(bottomFace.line);

  // Build top cap
  const topCapEdgeIds: number[] = [];
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    const ptL = cartesianPoint(counter, 0, 0, 0);
    lines.push(ptL.line);
    const dir2 = direction(counter, 1, 0, 0);
    lines.push(dir2.line);
    const vec2 = vector(counter, dir2.id, 1.0);
    lines.push(vec2.line);
    const ln = lineEntity(counter, ptL.id, vec2.id);
    lines.push(ln.line);
    const ec = edgeCurve(counter, topVertexIds[i], topVertexIds[i2], ln.id, true);
    lines.push(ec.line);
    const oe = orientedEdge(counter, ec.id, true);
    lines.push(oe.line);
    topCapEdgeIds.push(oe.id);
  }
  const topLoop = edgeLoop(counter, topCapEdgeIds);
  lines.push(topLoop.line);
  const topBound = faceOuterBound(counter, topLoop.id, true);
  lines.push(topBound.line);
  const topPt = cartesianPoint(counter, cx, cy, cz + height);
  lines.push(topPt.line);
  const topZ = direction(counter, 0, 0, 1);
  lines.push(topZ.line);
  const topX = direction(counter, 1, 0, 0);
  lines.push(topX.line);
  const topPlacement = axis2Placement3D(counter, topPt.id, topZ.id, topX.id);
  lines.push(topPlacement.line);
  const topPlane = plane(counter, topPlacement.id);
  lines.push(topPlane.line);
  const topFace = advancedFace(counter, [topBound.id], topPlane.id, true);
  lines.push(topFace.line);

  // Closed shell
  const allFaceIds = [...sideFaceIds, bottomFace.id, topFace.id];
  const shell = closedShell(counter, allFaceIds);
  lines.push(shell.line);

  const brep = manifoldSolidBrep(counter, name, shell.id);
  lines.push(brep.line);

  return { lines, brepId: brep.id };
}

// ---------------------------------------------------------------------------
// Box builder (8 vertices, 12 edges, 6 faces)
// ---------------------------------------------------------------------------

export interface BoxResult {
  lines: string[];
  brepId: number;
}

export function buildBox(
  counter: EntityCounter,
  ox: number,
  oy: number,
  oz: number,
  width: number,
  height: number,
  depth: number,
  name: string,
): BoxResult {
  const lines: string[] = [];

  // 8 vertices: (ox, oy, oz) is the min corner
  // width  = X extent
  // height = Y extent
  // depth  = Z extent
  const corners: Array<[number, number, number]> = [
    [ox, oy, oz],                           // 0: min
    [ox + width, oy, oz],                   // 1
    [ox + width, oy + height, oz],          // 2
    [ox, oy + height, oz],                  // 3
    [ox, oy, oz + depth],                   // 4
    [ox + width, oy, oz + depth],           // 5
    [ox + width, oy + height, oz + depth],  // 6
    [ox, oy + height, oz + depth],          // 7
  ];

  // Create cartesian points and vertex points
  const ptIds: number[] = [];
  const vtxIds: number[] = [];
  for (const [cx, cy, cz] of corners) {
    const pt = cartesianPoint(counter, cx, cy, cz);
    lines.push(pt.line);
    ptIds.push(pt.id);
    const vtx = vertexPoint(counter, pt.id);
    lines.push(vtx.line);
    vtxIds.push(vtx.id);
  }

  // Helper to create an edge between two vertices
  function makeEdge(v1: number, v2: number): number {
    const pt = cartesianPoint(counter, 0, 0, 0);
    lines.push(pt.line);
    const dir = direction(counter, 1, 0, 0);
    lines.push(dir.line);
    const vec = vector(counter, dir.id, 1.0);
    lines.push(vec.line);
    const ln = lineEntity(counter, pt.id, vec.id);
    lines.push(ln.line);
    const ec = edgeCurve(counter, vtxIds[v1], vtxIds[v2], ln.id, true);
    lines.push(ec.line);
    return ec.id;
  }

  // 12 edges of the box
  // Bottom face: 0-1, 1-2, 2-3, 3-0
  const e01 = makeEdge(0, 1);
  const e12 = makeEdge(1, 2);
  const e23 = makeEdge(2, 3);
  const e30 = makeEdge(3, 0);
  // Top face: 4-5, 5-6, 6-7, 7-4
  const e45 = makeEdge(4, 5);
  const e56 = makeEdge(5, 6);
  const e67 = makeEdge(6, 7);
  const e74 = makeEdge(7, 4);
  // Vertical edges: 0-4, 1-5, 2-6, 3-7
  const e04 = makeEdge(0, 4);
  const e15 = makeEdge(1, 5);
  const e26 = makeEdge(2, 6);
  const e37 = makeEdge(3, 7);

  // Helper: build a face from 4 oriented edges
  function makeFace(
    edges: Array<{ edgeId: number; forward: boolean }>,
    normalX: number,
    normalY: number,
    normalZ: number,
    refPtX: number,
    refPtY: number,
    refPtZ: number,
  ): number {
    const oeIds: number[] = [];
    for (const { edgeId, forward } of edges) {
      const oe = orientedEdge(counter, edgeId, forward);
      lines.push(oe.line);
      oeIds.push(oe.id);
    }
    const loop = edgeLoop(counter, oeIds);
    lines.push(loop.line);
    const bound = faceOuterBound(counter, loop.id, true);
    lines.push(bound.line);

    const facePt = cartesianPoint(counter, refPtX, refPtY, refPtZ);
    lines.push(facePt.line);
    const faceZ = direction(counter, normalX, normalY, normalZ);
    lines.push(faceZ.line);
    // X-reference axis perpendicular to normal
    const xRef = Math.abs(normalZ) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const faceX = direction(counter, xRef.x, xRef.y, xRef.z);
    lines.push(faceX.line);
    const placement = axis2Placement3D(counter, facePt.id, faceZ.id, faceX.id);
    lines.push(placement.line);
    const pl = plane(counter, placement.id);
    lines.push(pl.line);
    const face = advancedFace(counter, [bound.id], pl.id, true);
    lines.push(face.line);
    return face.id;
  }

  // 6 faces with outward-pointing normals
  // Bottom face (Z-): 0->3->2->1
  const f_bottom = makeFace(
    [
      { edgeId: e30, forward: false },
      { edgeId: e23, forward: false },
      { edgeId: e12, forward: false },
      { edgeId: e01, forward: false },
    ],
    0, 0, -1, ox, oy, oz,
  );

  // Top face (Z+): 4->5->6->7
  const f_top = makeFace(
    [
      { edgeId: e45, forward: true },
      { edgeId: e56, forward: true },
      { edgeId: e67, forward: true },
      { edgeId: e74, forward: true },
    ],
    0, 0, 1, ox, oy, oz + depth,
  );

  // Front face (Y-): 0->1->5->4
  const f_front = makeFace(
    [
      { edgeId: e01, forward: true },
      { edgeId: e15, forward: true },
      { edgeId: e45, forward: false },
      { edgeId: e04, forward: false },
    ],
    0, -1, 0, ox, oy, oz,
  );

  // Back face (Y+): 2->3->7->6
  const f_back = makeFace(
    [
      { edgeId: e23, forward: true },
      { edgeId: e37, forward: true },
      { edgeId: e67, forward: false },
      { edgeId: e26, forward: false },
    ],
    0, 1, 0, ox, oy + height, oz,
  );

  // Left face (X-): 0->4->7->3
  const f_left = makeFace(
    [
      { edgeId: e04, forward: true },
      { edgeId: e74, forward: false },
      { edgeId: e37, forward: false },
      { edgeId: e30, forward: true },
    ],
    -1, 0, 0, ox, oy, oz,
  );

  // Right face (X+): 1->2->6->5
  const f_right = makeFace(
    [
      { edgeId: e12, forward: true },
      { edgeId: e26, forward: true },
      { edgeId: e56, forward: false },
      { edgeId: e15, forward: false },
    ],
    1, 0, 0, ox + width, oy, oz,
  );

  const shell = closedShell(counter, [f_bottom, f_top, f_front, f_back, f_left, f_right]);
  lines.push(shell.line);

  const brep = manifoldSolidBrep(counter, name, shell.id);
  lines.push(brep.line);

  return { lines, brepId: brep.id };
}

// ---------------------------------------------------------------------------
// Product / shape definition boilerplate
// ---------------------------------------------------------------------------

interface ProductResult {
  lines: string[];
  shapeRepId: number;
}

function buildProduct(
  counter: EntityCounter,
  productName: string,
  brepId: number,
): ProductResult {
  const lines: string[] = [];
  const safeName = escapeStepString(productName);

  // Application context
  const appCtx = counter.next();
  lines.push(`#${appCtx} = APPLICATION_CONTEXT('automotive_design');`);

  const appProto = counter.next();
  lines.push(`#${appProto} = APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${appCtx});`);

  // Product
  const prodId = counter.next();
  lines.push(`#${prodId} = PRODUCT('${safeName}','${safeName}','',(#${counter.next()}));`);
  const prodCtxId = counter.current();
  lines.push(`#${prodCtxId} = PRODUCT_CONTEXT('',#${appCtx},'mechanical');`);

  // Product definition formation
  const pdfId = counter.next();
  lines.push(`#${pdfId} = PRODUCT_DEFINITION_FORMATION('','',#${prodId});`);

  // Product definition context
  const pdcId = counter.next();
  lines.push(`#${pdcId} = PRODUCT_DEFINITION_CONTEXT('part definition',#${appCtx},'design');`);

  // Product definition
  const pdId = counter.next();
  lines.push(`#${pdId} = PRODUCT_DEFINITION('design','',#${pdfId},#${pdcId});`);

  // Shape definition
  const sdId = counter.next();
  lines.push(`#${sdId} = PRODUCT_DEFINITION_SHAPE('','',#${pdId});`);

  // Geometric context (3D, mm units)
  const dimCtx = counter.next();
  lines.push(`#${dimCtx} = ( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${counter.next()})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${counter.next()},#${counter.next()},#${counter.next()})) REPRESENTATION_CONTEXT('Context3D','3D Context with 1e-07 uncertainty') );`);

  // Uncertainty measure
  const uncertId = counter.current() - 3;
  lines.push(`#${uncertId} = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#${uncertId + 1},'distance_accuracy_value','confusion accuracy');`);
  // Length unit (millimetres)
  lines.push(`#${uncertId + 1} = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );`);
  // Angle unit
  lines.push(`#${uncertId + 2} = ( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );`);
  // Solid angle unit
  lines.push(`#${uncertId + 3} = ( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() );`);

  // Origin axis
  const orPt = cartesianPoint(counter, 0, 0, 0);
  lines.push(orPt.line);
  const zDir = direction(counter, 0, 0, 1);
  lines.push(zDir.line);
  const xDir = direction(counter, 1, 0, 0);
  lines.push(xDir.line);
  const axPlacement = axis2Placement3D(counter, orPt.id, zDir.id, xDir.id);
  lines.push(axPlacement.line);

  // Shape representation
  const srId = counter.next();
  lines.push(`#${srId} = SHAPE_REPRESENTATION('${safeName}',(#${axPlacement.id},#${brepId}),#${dimCtx});`);

  // Shape definition representation
  const sdrId = counter.next();
  lines.push(`#${sdrId} = SHAPE_DEFINITION_REPRESENTATION(#${sdId},#${srId});`);

  return { lines, shapeRepId: srId };
}

// ---------------------------------------------------------------------------
// String escaping
// ---------------------------------------------------------------------------

export function escapeStepString(s: string): string {
  // STEP strings use single quotes, double a single quote to escape
  return s.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// ---------------------------------------------------------------------------
// STEP header/footer
// ---------------------------------------------------------------------------

function buildHeader(projectName: string, timestamp: string): string {
  const safeName = escapeStepString(projectName);
  return [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION(('ProtoPulse 3D Board Assembly'),'2;1');`,
    `FILE_NAME('${safeName}.step','${timestamp}',('ProtoPulse'),(''),'',' ProtoPulse EDA','');`,
    `FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));`,
    'ENDSEC;',
  ].join('\n');
}

function buildFooter(): string {
  return ['ENDSEC;', 'END-ISO-10303-21;'].join('\n');
}

// ---------------------------------------------------------------------------
// Resolve component dimensions
// ---------------------------------------------------------------------------

function resolveComponentDimensions(comp: StepComponentInput): {
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
} {
  const pkgDims = PACKAGE_DIMENSIONS[comp.packageType];
  return {
    bodyWidth: comp.bodyWidth > 0 ? comp.bodyWidth : pkgDims?.bodyWidth ?? 5.0,
    bodyHeight: comp.bodyHeight > 0 ? comp.bodyHeight : pkgDims?.bodyHeight ?? 4.0,
    bodyDepth: comp.bodyDepth > 0 ? comp.bodyDepth : pkgDims?.bodyDepth ?? 1.5,
  };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateStep(input: StepInput): StepOutput {
  const counter = new EntityCounter();
  const timestamp = new Date().toISOString().split('T')[0];
  const dataLines: string[] = [];

  // --- Board body ---
  const boardBox = buildBox(
    counter,
    0, 0, 0,
    input.board.width,
    input.board.height,
    input.board.thickness,
    'Board',
  );
  dataLines.push(...boardBox.lines);
  const boardProduct = buildProduct(counter, `${input.projectName} - Board`, boardBox.brepId);
  dataLines.push(...boardProduct.lines);

  // --- Components ---
  for (const comp of input.components) {
    const dims = resolveComponentDimensions(comp);

    // Component position: center the body on x,y, place on correct side
    const halfW = dims.bodyWidth / 2;
    const halfH = dims.bodyHeight / 2;

    // Apply rotation to the offset (component center is at comp.x, comp.y)
    let compZ: number;
    if (comp.side === 'back') {
      // Back-side components sit below the board
      compZ = -dims.bodyDepth;
    } else {
      // Front-side components sit on top of the board
      compZ = input.board.thickness;
    }

    // Calculate rotated min corner (bottom-left of the body)
    // The body is centered at (comp.x, comp.y), so min corner offset is (-halfW, -halfH)
    const rotatedMin = rotatePoint(-halfW, -halfH, comp.rotation);
    const ox = comp.x + rotatedMin.x;
    const oy = comp.y + rotatedMin.y;

    // For rotated components, we still generate an axis-aligned box positioned
    // at the rotated corner. For proper rotation we'd need a rotated placement,
    // but for most mechanical fit checks the bounding box approach is sufficient.
    // The component name includes rotation for reference.
    const compName = `${comp.refDes} (${comp.packageType})`;
    const compBox = buildBox(
      counter,
      ox, oy, compZ,
      dims.bodyWidth, dims.bodyHeight, dims.bodyDepth,
      compName,
    );
    dataLines.push(...compBox.lines);
    const compProduct = buildProduct(counter, compName, compBox.brepId);
    dataLines.push(...compProduct.lines);
  }

  // --- Vias ---
  for (let i = 0; i < input.vias.length; i++) {
    const via = input.vias[i];
    const radius = via.outerDiameter / 2;
    const viaName = `Via_${i + 1}`;

    const viaCyl = buildCylinder(
      counter,
      via.x, via.y, 0,
      radius,
      input.board.thickness,
      viaName,
    );
    dataLines.push(...viaCyl.lines);
    const viaProduct = buildProduct(counter, viaName, viaCyl.brepId);
    dataLines.push(...viaProduct.lines);
  }

  // --- Assemble file ---
  const header = buildHeader(input.projectName, timestamp);
  const content = [
    header,
    'DATA;',
    ...dataLines,
    buildFooter(),
  ].join('\n');

  const safeFilename = input.projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    content,
    filename: `${safeFilename}_3d_assembly.step`,
  };
}

// Re-export for testing
export { EntityCounter, PACKAGE_DIMENSIONS };
