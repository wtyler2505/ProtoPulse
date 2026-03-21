/**
 * WebGLViewerEngine — Low-level WebGL rendering framework for 3D PCB
 * visualization.
 *
 * Provides layer presets (9 layers), camera presets (8 views), package
 * dimension database (20+ packages), board/component geometry creation,
 * layer stack calculation, raycasting, and material properties.
 *
 * This is the rendering engine layer beneath board-viewer-3d.ts. It manages
 * WebGL state, geometry buffers, materials, and the render loop. The
 * board-viewer-3d scene graph feeds into this engine for actual GPU rendering.
 *
 * Singleton + subscribe pattern.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayerPresetName =
  | 'F.Cu'
  | 'B.Cu'
  | 'F.SilkS'
  | 'B.SilkS'
  | 'F.Mask'
  | 'B.Mask'
  | 'Substrate'
  | 'In1.Cu'
  | 'In2.Cu';

export type CameraPresetName =
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'isometric'
  | 'perspective';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Mat4 {
  elements: Float32Array;
}

export interface LayerPreset {
  name: LayerPresetName;
  displayName: string;
  zOffset: number; // mm from board bottom
  thickness: number; // mm
  color: Vec4; // RGBA 0-1
  visible: boolean;
  opacity: number;
  selectable: boolean;
}

export interface CameraPreset {
  name: CameraPresetName;
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number; // degrees
}

export interface PackageDimensions {
  packageType: string;
  bodyWidth: number; // mm
  bodyLength: number; // mm
  bodyHeight: number; // mm
  leadPitch?: number; // mm
  pinCount: number;
  mountingType: 'smd' | 'tht';
}

export interface Material {
  color: Vec4;
  metallic: number; // 0-1
  roughness: number; // 0-1
  emissive: Vec4;
  opacity: number;
}

export interface Geometry {
  id: string;
  type: 'box' | 'cylinder' | 'plane' | 'extruded' | 'custom';
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  uvs?: Float32Array;
}

export interface RenderObject {
  id: string;
  geometry: Geometry;
  material: Material;
  position: Vec3;
  rotation: Vec3; // Euler angles in radians
  scale: Vec3;
  layer: LayerPresetName;
  visible: boolean;
  pickable: boolean;
  userData?: Record<string, unknown>;
}

export interface RaycastHit {
  objectId: string;
  point: Vec3;
  normal: Vec3;
  distance: number;
  layer: LayerPresetName;
}

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  vertices: number;
  objects: number;
  fps: number;
  frameTime: number;
}

export interface ViewportSize {
  width: number;
  height: number;
  pixelRatio: number;
}

export interface BoardGeometryParams {
  width: number; // mm
  height: number; // mm
  thickness: number; // mm
  cornerRadius: number; // mm
  layerCount: number;
}

export interface ComponentGeometryParams {
  packageType: string;
  position: Vec3;
  rotation: number; // degrees
  side: 'top' | 'bottom';
  refDes: string;
}

export interface LayerStackEntry {
  layer: LayerPresetName;
  zBottom: number; // mm
  zTop: number; // mm
  thickness: number; // mm
  material: Material;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COPPER_THICKNESS = 0.035; // 1oz copper in mm
const SOLDER_MASK_THICKNESS = 0.02; // mm
const SILKSCREEN_THICKNESS = 0.01; // mm
const PREPREG_THICKNESS = 0.2; // mm
const DEFAULT_BOARD_THICKNESS = 1.6; // mm

// ---------------------------------------------------------------------------
// Layer presets
// ---------------------------------------------------------------------------

export const LAYER_PRESETS: Record<LayerPresetName, LayerPreset> = {
  'F.Cu': {
    name: 'F.Cu',
    displayName: 'Front Copper',
    zOffset: 0,
    thickness: COPPER_THICKNESS,
    color: { x: 0.84, y: 0.56, z: 0.18, w: 1.0 },
    visible: true,
    opacity: 1.0,
    selectable: true,
  },
  'B.Cu': {
    name: 'B.Cu',
    displayName: 'Back Copper',
    zOffset: 0,
    thickness: COPPER_THICKNESS,
    color: { x: 0.18, y: 0.56, z: 0.84, w: 1.0 },
    visible: true,
    opacity: 1.0,
    selectable: true,
  },
  'F.SilkS': {
    name: 'F.SilkS',
    displayName: 'Front Silkscreen',
    zOffset: 0,
    thickness: SILKSCREEN_THICKNESS,
    color: { x: 1.0, y: 1.0, z: 1.0, w: 1.0 },
    visible: true,
    opacity: 1.0,
    selectable: false,
  },
  'B.SilkS': {
    name: 'B.SilkS',
    displayName: 'Back Silkscreen',
    zOffset: 0,
    thickness: SILKSCREEN_THICKNESS,
    color: { x: 1.0, y: 1.0, z: 1.0, w: 1.0 },
    visible: true,
    opacity: 1.0,
    selectable: false,
  },
  'F.Mask': {
    name: 'F.Mask',
    displayName: 'Front Solder Mask',
    zOffset: 0,
    thickness: SOLDER_MASK_THICKNESS,
    color: { x: 0.0, y: 0.5, z: 0.0, w: 0.8 },
    visible: true,
    opacity: 0.8,
    selectable: false,
  },
  'B.Mask': {
    name: 'B.Mask',
    displayName: 'Back Solder Mask',
    zOffset: 0,
    thickness: SOLDER_MASK_THICKNESS,
    color: { x: 0.0, y: 0.5, z: 0.0, w: 0.8 },
    visible: true,
    opacity: 0.8,
    selectable: false,
  },
  Substrate: {
    name: 'Substrate',
    displayName: 'FR4 Substrate',
    zOffset: 0,
    thickness: DEFAULT_BOARD_THICKNESS,
    color: { x: 0.6, y: 0.55, z: 0.3, w: 1.0 },
    visible: true,
    opacity: 1.0,
    selectable: false,
  },
  'In1.Cu': {
    name: 'In1.Cu',
    displayName: 'Inner Copper 1',
    zOffset: 0,
    thickness: COPPER_THICKNESS,
    color: { x: 0.84, y: 0.3, z: 0.3, w: 1.0 },
    visible: false,
    opacity: 1.0,
    selectable: true,
  },
  'In2.Cu': {
    name: 'In2.Cu',
    displayName: 'Inner Copper 2',
    zOffset: 0,
    thickness: COPPER_THICKNESS,
    color: { x: 0.3, y: 0.84, z: 0.3, w: 1.0 },
    visible: false,
    opacity: 1.0,
    selectable: true,
  },
};

// ---------------------------------------------------------------------------
// Camera presets
// ---------------------------------------------------------------------------

export const CAMERA_PRESETS: Record<CameraPresetName, CameraPreset> = {
  top: {
    name: 'top',
    position: { x: 0, y: 0, z: 100 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    fov: 45,
  },
  bottom: {
    name: 'bottom',
    position: { x: 0, y: 0, z: -100 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    fov: 45,
  },
  front: {
    name: 'front',
    position: { x: 0, y: -100, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    fov: 45,
  },
  back: {
    name: 'back',
    position: { x: 0, y: 100, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    fov: 45,
  },
  left: {
    name: 'left',
    position: { x: -100, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    fov: 45,
  },
  right: {
    name: 'right',
    position: { x: 100, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    fov: 45,
  },
  isometric: {
    name: 'isometric',
    position: { x: 70, y: -70, z: 70 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    fov: 45,
  },
  perspective: {
    name: 'perspective',
    position: { x: 80, y: -60, z: 50 },
    target: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    fov: 60,
  },
};

// ---------------------------------------------------------------------------
// Package dimensions database
// ---------------------------------------------------------------------------

export const PACKAGE_DIMENSIONS: Record<string, PackageDimensions> = {
  'SOT-23': { packageType: 'SOT-23', bodyWidth: 1.3, bodyLength: 2.9, bodyHeight: 1.1, leadPitch: 0.95, pinCount: 3, mountingType: 'smd' },
  'SOT-223': { packageType: 'SOT-223', bodyWidth: 3.5, bodyLength: 6.5, bodyHeight: 1.8, leadPitch: 2.3, pinCount: 4, mountingType: 'smd' },
  'SOIC-8': { packageType: 'SOIC-8', bodyWidth: 3.9, bodyLength: 4.9, bodyHeight: 1.75, leadPitch: 1.27, pinCount: 8, mountingType: 'smd' },
  'SOIC-14': { packageType: 'SOIC-14', bodyWidth: 3.9, bodyLength: 8.65, bodyHeight: 1.75, leadPitch: 1.27, pinCount: 14, mountingType: 'smd' },
  'SOIC-16': { packageType: 'SOIC-16', bodyWidth: 3.9, bodyLength: 9.9, bodyHeight: 1.75, leadPitch: 1.27, pinCount: 16, mountingType: 'smd' },
  'TSSOP-8': { packageType: 'TSSOP-8', bodyWidth: 3.0, bodyLength: 3.0, bodyHeight: 1.1, leadPitch: 0.65, pinCount: 8, mountingType: 'smd' },
  'TSSOP-16': { packageType: 'TSSOP-16', bodyWidth: 4.4, bodyLength: 5.0, bodyHeight: 1.1, leadPitch: 0.65, pinCount: 16, mountingType: 'smd' },
  'QFP-44': { packageType: 'QFP-44', bodyWidth: 10.0, bodyLength: 10.0, bodyHeight: 1.6, leadPitch: 0.8, pinCount: 44, mountingType: 'smd' },
  'QFP-64': { packageType: 'QFP-64', bodyWidth: 10.0, bodyLength: 10.0, bodyHeight: 1.6, leadPitch: 0.5, pinCount: 64, mountingType: 'smd' },
  'QFN-16': { packageType: 'QFN-16', bodyWidth: 3.0, bodyLength: 3.0, bodyHeight: 0.75, leadPitch: 0.5, pinCount: 16, mountingType: 'smd' },
  'QFN-32': { packageType: 'QFN-32', bodyWidth: 5.0, bodyLength: 5.0, bodyHeight: 0.75, leadPitch: 0.5, pinCount: 32, mountingType: 'smd' },
  'BGA-256': { packageType: 'BGA-256', bodyWidth: 17.0, bodyLength: 17.0, bodyHeight: 1.6, leadPitch: 1.0, pinCount: 256, mountingType: 'smd' },
  'DIP-8': { packageType: 'DIP-8', bodyWidth: 6.35, bodyLength: 9.53, bodyHeight: 3.3, leadPitch: 2.54, pinCount: 8, mountingType: 'tht' },
  'DIP-14': { packageType: 'DIP-14', bodyWidth: 6.35, bodyLength: 19.05, bodyHeight: 3.3, leadPitch: 2.54, pinCount: 14, mountingType: 'tht' },
  'DIP-16': { packageType: 'DIP-16', bodyWidth: 6.35, bodyLength: 19.05, bodyHeight: 3.3, leadPitch: 2.54, pinCount: 16, mountingType: 'tht' },
  'DIP-28': { packageType: 'DIP-28', bodyWidth: 6.35, bodyLength: 34.67, bodyHeight: 3.3, leadPitch: 2.54, pinCount: 28, mountingType: 'tht' },
  'TO-92': { packageType: 'TO-92', bodyWidth: 4.19, bodyLength: 3.81, bodyHeight: 4.83, leadPitch: 1.27, pinCount: 3, mountingType: 'tht' },
  'TO-220': { packageType: 'TO-220', bodyWidth: 10.16, bodyLength: 15.24, bodyHeight: 4.83, leadPitch: 2.54, pinCount: 3, mountingType: 'tht' },
  '0402': { packageType: '0402', bodyWidth: 0.5, bodyLength: 1.0, bodyHeight: 0.5, pinCount: 2, mountingType: 'smd' },
  '0603': { packageType: '0603', bodyWidth: 0.8, bodyLength: 1.6, bodyHeight: 0.8, pinCount: 2, mountingType: 'smd' },
  '0805': { packageType: '0805', bodyWidth: 1.25, bodyLength: 2.0, bodyHeight: 1.0, pinCount: 2, mountingType: 'smd' },
  '1206': { packageType: '1206', bodyWidth: 1.6, bodyLength: 3.2, bodyHeight: 1.1, pinCount: 2, mountingType: 'smd' },
  'SMA': { packageType: 'SMA', bodyWidth: 2.6, bodyLength: 4.6, bodyHeight: 2.3, pinCount: 2, mountingType: 'smd' },
};

// ---------------------------------------------------------------------------
// Material presets
// ---------------------------------------------------------------------------

export const MATERIAL_PRESETS: Record<string, Material> = {
  copper: {
    color: { x: 0.84, y: 0.56, z: 0.18, w: 1.0 },
    metallic: 0.9,
    roughness: 0.3,
    emissive: { x: 0, y: 0, z: 0, w: 0 },
    opacity: 1.0,
  },
  solderMask: {
    color: { x: 0.0, y: 0.5, z: 0.0, w: 0.85 },
    metallic: 0.0,
    roughness: 0.6,
    emissive: { x: 0, y: 0, z: 0, w: 0 },
    opacity: 0.85,
  },
  silkscreen: {
    color: { x: 1.0, y: 1.0, z: 1.0, w: 1.0 },
    metallic: 0.0,
    roughness: 0.8,
    emissive: { x: 0, y: 0, z: 0, w: 0 },
    opacity: 1.0,
  },
  fr4: {
    color: { x: 0.6, y: 0.55, z: 0.3, w: 1.0 },
    metallic: 0.0,
    roughness: 0.7,
    emissive: { x: 0, y: 0, z: 0, w: 0 },
    opacity: 1.0,
  },
  lead: {
    color: { x: 0.75, y: 0.75, z: 0.75, w: 1.0 },
    metallic: 0.8,
    roughness: 0.4,
    emissive: { x: 0, y: 0, z: 0, w: 0 },
    opacity: 1.0,
  },
  plastic: {
    color: { x: 0.15, y: 0.15, z: 0.15, w: 1.0 },
    metallic: 0.0,
    roughness: 0.5,
    emissive: { x: 0, y: 0, z: 0, w: 0 },
    opacity: 1.0,
  },
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function createBoxGeometry(width: number, height: number, depth: number): Geometry {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  // 24 vertices (4 per face, 6 faces)
  const vertices = new Float32Array([
    // Front face
    -hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd,
    // Back face
    -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd, hw, -hh, -hd,
    // Top face
    -hw, hh, -hd, -hw, hh, hd, hw, hh, hd, hw, hh, -hd,
    // Bottom face
    -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd,
    // Right face
    hw, -hh, -hd, hw, hh, -hd, hw, hh, hd, hw, -hh, hd,
    // Left face
    -hw, -hh, -hd, -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd,
  ]);

  const normals = new Float32Array([
    // Front
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,       // front
    4, 5, 6, 4, 6, 7,       // back
    8, 9, 10, 8, 10, 11,    // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23, // left
  ]);

  return {
    id: `box-${width}-${height}-${depth}`,
    type: 'box',
    vertices,
    normals,
    indices,
  };
}

export function createCylinderGeometry(radius: number, height: number, segments = 16): Geometry {
  const vertexCount = (segments + 1) * 2 + (segments + 1) * 2; // side + caps
  const vertices = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indexCount = segments * 6 + segments * 3 * 2; // side triangles + cap triangles
  const indices = new Uint16Array(indexCount);

  const hh = height / 2;
  let vIdx = 0;
  let nIdx = 0;
  let iIdx = 0;

  // Side vertices
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Bottom vertex
    vertices[vIdx++] = x;
    vertices[vIdx++] = -hh;
    vertices[vIdx++] = z;
    normals[nIdx++] = Math.cos(angle);
    normals[nIdx++] = 0;
    normals[nIdx++] = Math.sin(angle);

    // Top vertex
    vertices[vIdx++] = x;
    vertices[vIdx++] = hh;
    vertices[vIdx++] = z;
    normals[nIdx++] = Math.cos(angle);
    normals[nIdx++] = 0;
    normals[nIdx++] = Math.sin(angle);
  }

  // Side indices
  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices[iIdx++] = base;
    indices[iIdx++] = base + 1;
    indices[iIdx++] = base + 3;
    indices[iIdx++] = base;
    indices[iIdx++] = base + 3;
    indices[iIdx++] = base + 2;
  }

  // Top cap center + ring
  const topCenterIdx = vIdx / 3;
  vertices[vIdx++] = 0;
  vertices[vIdx++] = hh;
  vertices[vIdx++] = 0;
  normals[nIdx++] = 0;
  normals[nIdx++] = 1;
  normals[nIdx++] = 0;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices[vIdx++] = Math.cos(angle) * radius;
    vertices[vIdx++] = hh;
    vertices[vIdx++] = Math.sin(angle) * radius;
    normals[nIdx++] = 0;
    normals[nIdx++] = 1;
    normals[nIdx++] = 0;
  }

  for (let i = 0; i < segments; i++) {
    indices[iIdx++] = topCenterIdx;
    indices[iIdx++] = topCenterIdx + 1 + i;
    indices[iIdx++] = topCenterIdx + 2 + i;
  }

  // Bottom cap center + ring
  const botCenterIdx = vIdx / 3;
  vertices[vIdx++] = 0;
  vertices[vIdx++] = -hh;
  vertices[vIdx++] = 0;
  normals[nIdx++] = 0;
  normals[nIdx++] = -1;
  normals[nIdx++] = 0;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices[vIdx++] = Math.cos(angle) * radius;
    vertices[vIdx++] = -hh;
    vertices[vIdx++] = Math.sin(angle) * radius;
    normals[nIdx++] = 0;
    normals[nIdx++] = -1;
    normals[nIdx++] = 0;
  }

  for (let i = 0; i < segments; i++) {
    indices[iIdx++] = botCenterIdx;
    indices[iIdx++] = botCenterIdx + 2 + i;
    indices[iIdx++] = botCenterIdx + 1 + i;
  }

  return {
    id: `cylinder-${radius}-${height}-${segments}`,
    type: 'cylinder',
    vertices: vertices.slice(0, vIdx),
    normals: normals.slice(0, nIdx),
    indices: indices.slice(0, iIdx),
  };
}

export function createPlaneGeometry(width: number, height: number): Geometry {
  const hw = width / 2;
  const hh = height / 2;

  const vertices = new Float32Array([
    -hw, 0, -hh,
    hw, 0, -hh,
    hw, 0, hh,
    -hw, 0, hh,
  ]);

  const normals = new Float32Array([
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ]);

  const indices = new Uint16Array([0, 2, 1, 0, 3, 2]);

  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);

  return {
    id: `plane-${width}-${height}`,
    type: 'plane',
    vertices,
    normals,
    indices,
    uvs,
  };
}

// ---------------------------------------------------------------------------
// Layer stack calculation
// ---------------------------------------------------------------------------

export function calculateLayerStack(boardThickness: number, layerCount: number): LayerStackEntry[] {
  const stack: LayerStackEntry[] = [];
  const effectiveLayerCount = Math.max(2, layerCount);

  // Bottom solder mask
  const bMaskZ = 0;
  stack.push({
    layer: 'B.Mask',
    zBottom: bMaskZ - SOLDER_MASK_THICKNESS,
    zTop: bMaskZ,
    thickness: SOLDER_MASK_THICKNESS,
    material: { ...MATERIAL_PRESETS.solderMask },
  });

  // Bottom silkscreen (below mask)
  stack.push({
    layer: 'B.SilkS',
    zBottom: bMaskZ - SOLDER_MASK_THICKNESS - SILKSCREEN_THICKNESS,
    zTop: bMaskZ - SOLDER_MASK_THICKNESS,
    thickness: SILKSCREEN_THICKNESS,
    material: { ...MATERIAL_PRESETS.silkscreen },
  });

  // Bottom copper
  stack.push({
    layer: 'B.Cu',
    zBottom: bMaskZ,
    zTop: bMaskZ + COPPER_THICKNESS,
    thickness: COPPER_THICKNESS,
    material: { ...MATERIAL_PRESETS.copper },
  });

  // Substrate
  const substrateBottom = COPPER_THICKNESS;
  const substrateThickness = boardThickness - COPPER_THICKNESS * 2;
  stack.push({
    layer: 'Substrate',
    zBottom: substrateBottom,
    zTop: substrateBottom + substrateThickness,
    thickness: substrateThickness,
    material: { ...MATERIAL_PRESETS.fr4 },
  });

  // Inner copper layers (if any)
  if (effectiveLayerCount > 2) {
    const innerSpacing = substrateThickness / (effectiveLayerCount - 1);
    const innerLayers: LayerPresetName[] = ['In1.Cu', 'In2.Cu'];
    const innerCount = Math.min(effectiveLayerCount - 2, innerLayers.length);

    for (let i = 0; i < innerCount; i++) {
      const z = substrateBottom + innerSpacing * (i + 1);
      stack.push({
        layer: innerLayers[i],
        zBottom: z - COPPER_THICKNESS / 2,
        zTop: z + COPPER_THICKNESS / 2,
        thickness: COPPER_THICKNESS,
        material: { ...MATERIAL_PRESETS.copper },
      });
    }
  }

  // Top copper
  const tCuZ = substrateBottom + substrateThickness;
  stack.push({
    layer: 'F.Cu',
    zBottom: tCuZ,
    zTop: tCuZ + COPPER_THICKNESS,
    thickness: COPPER_THICKNESS,
    material: { ...MATERIAL_PRESETS.copper },
  });

  // Top solder mask
  const tMaskZ = tCuZ + COPPER_THICKNESS;
  stack.push({
    layer: 'F.Mask',
    zBottom: tMaskZ,
    zTop: tMaskZ + SOLDER_MASK_THICKNESS,
    thickness: SOLDER_MASK_THICKNESS,
    material: { ...MATERIAL_PRESETS.solderMask },
  });

  // Top silkscreen
  stack.push({
    layer: 'F.SilkS',
    zBottom: tMaskZ + SOLDER_MASK_THICKNESS,
    zTop: tMaskZ + SOLDER_MASK_THICKNESS + SILKSCREEN_THICKNESS,
    thickness: SILKSCREEN_THICKNESS,
    material: { ...MATERIAL_PRESETS.silkscreen },
  });

  return stack;
}

// ---------------------------------------------------------------------------
// Board geometry creation
// ---------------------------------------------------------------------------

export function createBoardGeometry(params: BoardGeometryParams): RenderObject[] {
  const objects: RenderObject[] = [];
  const stack = calculateLayerStack(params.thickness, params.layerCount);

  for (const entry of stack) {
    const geo = createBoxGeometry(params.width, params.height, entry.thickness);
    const zCenter = (entry.zBottom + entry.zTop) / 2;

    objects.push({
      id: `board-${entry.layer}`,
      geometry: geo,
      material: entry.material,
      position: { x: 0, y: 0, z: zCenter },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      layer: entry.layer,
      visible: true,
      pickable: false,
    });
  }

  return objects;
}

// ---------------------------------------------------------------------------
// Component geometry creation
// ---------------------------------------------------------------------------

export function createComponentGeometry(params: ComponentGeometryParams): RenderObject | null {
  const dims = PACKAGE_DIMENSIONS[params.packageType];
  if (!dims) {
    return null;
  }

  const geo = createBoxGeometry(dims.bodyWidth, dims.bodyLength, dims.bodyHeight);
  const rotRad = (params.rotation * Math.PI) / 180;

  // Z position: on top or bottom of board
  let zPos: number;
  if (params.side === 'top') {
    zPos = params.position.z + dims.bodyHeight / 2;
  } else {
    zPos = params.position.z - dims.bodyHeight / 2;
  }

  const material = { ...MATERIAL_PRESETS.plastic };

  return {
    id: `component-${params.refDes}`,
    geometry: geo,
    material,
    position: { x: params.position.x, y: params.position.y, z: zPos },
    rotation: { x: 0, y: 0, z: rotRad },
    scale: { x: 1, y: 1, z: 1 },
    layer: params.side === 'top' ? 'F.Cu' : 'B.Cu',
    visible: true,
    pickable: true,
    userData: { refDes: params.refDes, packageType: params.packageType },
  };
}

// ---------------------------------------------------------------------------
// Raycasting
// ---------------------------------------------------------------------------

export function vec3Subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/**
 * Ray-AABB intersection test. Returns distance or null if no hit.
 * Uses slab method.
 */
export function rayBoxIntersect(
  rayOrigin: Vec3,
  rayDir: Vec3,
  boxMin: Vec3,
  boxMax: Vec3,
): number | null {
  let tMin = -Infinity;
  let tMax = Infinity;

  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  for (const axis of axes) {
    const invD = 1.0 / rayDir[axis];
    let t0 = (boxMin[axis] - rayOrigin[axis]) * invD;
    let t1 = (boxMax[axis] - rayOrigin[axis]) * invD;

    if (invD < 0) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }

    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);

    if (tMax < tMin) {
      return null;
    }
  }

  if (tMin < 0) {
    return tMax >= 0 ? tMax : null;
  }

  return tMin;
}

export function raycastObjects(
  rayOrigin: Vec3,
  rayDir: Vec3,
  objects: RenderObject[],
): RaycastHit[] {
  const hits: RaycastHit[] = [];

  for (const obj of objects) {
    if (!obj.visible || !obj.pickable) {
      continue;
    }

    // Compute AABB from geometry bounds + position
    const geo = obj.geometry;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < geo.vertices.length; i += 3) {
      const vx = geo.vertices[i] * obj.scale.x + obj.position.x;
      const vy = geo.vertices[i + 1] * obj.scale.y + obj.position.y;
      const vz = geo.vertices[i + 2] * obj.scale.z + obj.position.z;
      minX = Math.min(minX, vx);
      minY = Math.min(minY, vy);
      minZ = Math.min(minZ, vz);
      maxX = Math.max(maxX, vx);
      maxY = Math.max(maxY, vy);
      maxZ = Math.max(maxZ, vz);
    }

    const dist = rayBoxIntersect(
      rayOrigin,
      rayDir,
      { x: minX, y: minY, z: minZ },
      { x: maxX, y: maxY, z: maxZ },
    );

    if (dist !== null) {
      const point = vec3Add(rayOrigin, vec3Scale(rayDir, dist));
      hits.push({
        objectId: obj.id,
        point,
        normal: { x: 0, y: 0, z: 1 }, // Simplified normal
        distance: dist,
        layer: obj.layer,
      });
    }
  }

  hits.sort((a, b) => a.distance - b.distance);
  return hits;
}

// ---------------------------------------------------------------------------
// WebGLViewerEngine
// ---------------------------------------------------------------------------

export class WebGLViewerEngine {
  private static instance: WebGLViewerEngine | null = null;

  private objects: Map<string, RenderObject> = new Map();
  private layerVisibility: Map<LayerPresetName, boolean> = new Map();
  private currentCamera: CameraPreset;
  private viewport: ViewportSize;
  private stats: RenderStats;
  private listeners: Set<Listener> = new Set();
  private boardParams: BoardGeometryParams | null = null;

  constructor() {
    this.currentCamera = { ...CAMERA_PRESETS.isometric };
    this.viewport = { width: 800, height: 600, pixelRatio: 1 };
    this.stats = { drawCalls: 0, triangles: 0, vertices: 0, objects: 0, fps: 0, frameTime: 0 };

    // Initialize layer visibility from presets
    const layerNames = Object.keys(LAYER_PRESETS) as LayerPresetName[];
    for (const name of layerNames) {
      this.layerVisibility.set(name, LAYER_PRESETS[name].visible);
    }
  }

  static getInstance(): WebGLViewerEngine {
    if (!WebGLViewerEngine.instance) {
      WebGLViewerEngine.instance = new WebGLViewerEngine();
    }
    return WebGLViewerEngine.instance;
  }

  static resetInstance(): void {
    WebGLViewerEngine.instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    Array.from(this.listeners).forEach((fn) => fn());
  }

  // -------------------------------------------------------------------------
  // Object management
  // -------------------------------------------------------------------------

  addObject(obj: RenderObject): void {
    this.objects.set(obj.id, obj);
    this.updateStats();
    this.notify();
  }

  removeObject(id: string): boolean {
    const removed = this.objects.delete(id);
    if (removed) {
      this.updateStats();
      this.notify();
    }
    return removed;
  }

  getObject(id: string): RenderObject | null {
    return this.objects.get(id) ?? null;
  }

  getAllObjects(): RenderObject[] {
    return Array.from(this.objects.values());
  }

  getVisibleObjects(): RenderObject[] {
    return Array.from(this.objects.values()).filter(
      (obj) => obj.visible && this.isLayerVisible(obj.layer),
    );
  }

  getObjectsByLayer(layer: LayerPresetName): RenderObject[] {
    return Array.from(this.objects.values()).filter((obj) => obj.layer === layer);
  }

  clearObjects(): void {
    this.objects.clear();
    this.updateStats();
    this.notify();
  }

  getObjectCount(): number {
    return this.objects.size;
  }

  // -------------------------------------------------------------------------
  // Layer visibility
  // -------------------------------------------------------------------------

  setLayerVisibility(layer: LayerPresetName, visible: boolean): void {
    this.layerVisibility.set(layer, visible);
    // Update objects on this layer
    for (const obj of Array.from(this.objects.values())) {
      if (obj.layer === layer) {
        obj.visible = visible;
      }
    }
    this.notify();
  }

  isLayerVisible(layer: LayerPresetName): boolean {
    return this.layerVisibility.get(layer) ?? false;
  }

  getLayerVisibility(): Map<LayerPresetName, boolean> {
    return new Map(this.layerVisibility);
  }

  toggleLayer(layer: LayerPresetName): boolean {
    const current = this.isLayerVisible(layer);
    this.setLayerVisibility(layer, !current);
    return !current;
  }

  showAllLayers(): void {
    const layerNames = Array.from(this.layerVisibility.keys());
    for (const name of layerNames) {
      this.layerVisibility.set(name, true);
    }
    for (const obj of Array.from(this.objects.values())) {
      obj.visible = true;
    }
    this.notify();
  }

  hideAllLayers(): void {
    const layerNames = Array.from(this.layerVisibility.keys());
    for (const name of layerNames) {
      this.layerVisibility.set(name, false);
    }
    for (const obj of Array.from(this.objects.values())) {
      obj.visible = false;
    }
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------

  setCamera(preset: CameraPresetName): void {
    const presetData = CAMERA_PRESETS[preset];
    if (presetData) {
      this.currentCamera = { ...presetData };
      this.notify();
    }
  }

  getCameraPreset(): CameraPreset {
    return { ...this.currentCamera };
  }

  setCameraPosition(position: Vec3): void {
    this.currentCamera.position = { ...position };
    this.notify();
  }

  setCameraTarget(target: Vec3): void {
    this.currentCamera.target = { ...target };
    this.notify();
  }

  setCameraFov(fov: number): void {
    this.currentCamera.fov = Math.max(10, Math.min(120, fov));
    this.notify();
  }

  getAvailableCameraPresets(): CameraPresetName[] {
    return Object.keys(CAMERA_PRESETS) as CameraPresetName[];
  }

  // -------------------------------------------------------------------------
  // Viewport
  // -------------------------------------------------------------------------

  setViewport(size: ViewportSize): void {
    this.viewport = { ...size };
    this.notify();
  }

  getViewport(): ViewportSize {
    return { ...this.viewport };
  }

  getAspectRatio(): number {
    return this.viewport.width / this.viewport.height;
  }

  // -------------------------------------------------------------------------
  // Board & component creation
  // -------------------------------------------------------------------------

  setBoard(params: BoardGeometryParams): RenderObject[] {
    this.boardParams = { ...params };
    // Remove old board objects
    const toRemove: string[] = [];
    for (const [id] of Array.from(this.objects.entries())) {
      if (id.startsWith('board-')) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.objects.delete(id);
    }

    // Create new board objects
    const boardObjects = createBoardGeometry(params);
    for (const obj of boardObjects) {
      this.objects.set(obj.id, obj);
    }

    this.updateStats();
    this.notify();
    return boardObjects;
  }

  getBoardParams(): BoardGeometryParams | null {
    return this.boardParams ? { ...this.boardParams } : null;
  }

  addComponent(params: ComponentGeometryParams): RenderObject | null {
    const obj = createComponentGeometry(params);
    if (obj) {
      this.objects.set(obj.id, obj);
      this.updateStats();
      this.notify();
    }
    return obj;
  }

  // -------------------------------------------------------------------------
  // Raycasting
  // -------------------------------------------------------------------------

  raycast(origin: Vec3, direction: Vec3): RaycastHit[] {
    const visibleObjects = this.getVisibleObjects().filter((o) => o.pickable);
    return raycastObjects(origin, direction, visibleObjects);
  }

  pickAtScreenCoord(screenX: number, screenY: number): RaycastHit | null {
    // Convert screen coords to normalized device coords
    const ndcX = (screenX / this.viewport.width) * 2 - 1;
    const ndcY = 1 - (screenY / this.viewport.height) * 2;

    // Simple ray from camera through NDC point
    const camera = this.currentCamera;
    const dir = vec3Normalize(
      vec3Subtract(
        { x: camera.target.x + ndcX * 50, y: camera.target.y + ndcY * 50, z: camera.target.z },
        camera.position,
      ),
    );

    const hits = this.raycast(camera.position, dir);
    return hits.length > 0 ? hits[0] : null;
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  getStats(): RenderStats {
    return { ...this.stats };
  }

  private updateStats(): void {
    let triangles = 0;
    let vertices = 0;

    for (const obj of Array.from(this.objects.values())) {
      vertices += obj.geometry.vertices.length / 3;
      triangles += obj.geometry.indices.length / 3;
    }

    this.stats = {
      ...this.stats,
      objects: this.objects.size,
      triangles,
      vertices,
      drawCalls: this.objects.size,
    };
  }

  updateFrameStats(fps: number, frameTime: number): void {
    this.stats.fps = fps;
    this.stats.frameTime = frameTime;
  }

  // -------------------------------------------------------------------------
  // Package dimensions lookup
  // -------------------------------------------------------------------------

  getPackageDimensions(packageType: string): PackageDimensions | null {
    return PACKAGE_DIMENSIONS[packageType] ?? null;
  }

  getAllPackageTypes(): string[] {
    return Object.keys(PACKAGE_DIMENSIONS);
  }

  getSmdPackages(): PackageDimensions[] {
    return Object.values(PACKAGE_DIMENSIONS).filter((p) => p.mountingType === 'smd');
  }

  getThtPackages(): PackageDimensions[] {
    return Object.values(PACKAGE_DIMENSIONS).filter((p) => p.mountingType === 'tht');
  }

  // -------------------------------------------------------------------------
  // Layer stack
  // -------------------------------------------------------------------------

  getLayerStack(): LayerStackEntry[] {
    const thickness = this.boardParams?.thickness ?? DEFAULT_BOARD_THICKNESS;
    const layerCount = this.boardParams?.layerCount ?? 2;
    return calculateLayerStack(thickness, layerCount);
  }

  getLayerPresets(): Record<LayerPresetName, LayerPreset> {
    return { ...LAYER_PRESETS };
  }

  // -------------------------------------------------------------------------
  // Material
  // -------------------------------------------------------------------------

  getMaterialPresets(): Record<string, Material> {
    return { ...MATERIAL_PRESETS };
  }

  setObjectMaterial(objectId: string, material: Material): boolean {
    const obj = this.objects.get(objectId);
    if (!obj) {
      return false;
    }
    obj.material = { ...material };
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  toJSON(): {
    objects: RenderObject[];
    camera: CameraPreset;
    viewport: ViewportSize;
    boardParams: BoardGeometryParams | null;
  } {
    return {
      objects: Array.from(this.objects.values()),
      camera: { ...this.currentCamera },
      viewport: { ...this.viewport },
      boardParams: this.boardParams ? { ...this.boardParams } : null,
    };
  }

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  reset(): void {
    this.objects.clear();
    this.boardParams = null;
    this.currentCamera = { ...CAMERA_PRESETS.isometric };
    this.stats = { drawCalls: 0, triangles: 0, vertices: 0, objects: 0, fps: 0, frameTime: 0 };

    const layerNames = Object.keys(LAYER_PRESETS) as LayerPresetName[];
    for (const name of layerNames) {
      this.layerVisibility.set(name, LAYER_PRESETS[name].visible);
    }

    this.notify();
  }
}
