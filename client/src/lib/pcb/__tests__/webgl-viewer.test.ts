import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WebGLViewerEngine,
  LAYER_PRESETS,
  CAMERA_PRESETS,
  PACKAGE_DIMENSIONS,
  MATERIAL_PRESETS,
  createBoxGeometry,
  createCylinderGeometry,
  createPlaneGeometry,
  calculateLayerStack,
  createBoardGeometry,
  createComponentGeometry,
  vec3Subtract,
  vec3Dot,
  vec3Cross,
  vec3Length,
  vec3Normalize,
  vec3Add,
  vec3Scale,
  rayBoxIntersect,
  raycastObjects,
} from '../webgl-viewer';
import type {
  LayerPresetName,
  CameraPresetName,
  Vec3,
  RenderObject,
  Geometry,
  Material,
  BoardGeometryParams,
  ComponentGeometryParams,
  PackageDimensions,
  LayerStackEntry,
} from '../webgl-viewer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRenderObject(overrides: Partial<RenderObject> = {}): RenderObject {
  return {
    id: 'test-obj',
    geometry: createBoxGeometry(1, 1, 1),
    material: { ...MATERIAL_PRESETS.plastic },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    layer: 'F.Cu',
    visible: true,
    pickable: true,
    ...overrides,
  };
}

function makeBoardParams(overrides: Partial<BoardGeometryParams> = {}): BoardGeometryParams {
  return {
    width: 100,
    height: 80,
    thickness: 1.6,
    cornerRadius: 2,
    layerCount: 2,
    ...overrides,
  };
}

function makeComponentParams(overrides: Partial<ComponentGeometryParams> = {}): ComponentGeometryParams {
  return {
    packageType: 'SOIC-8',
    position: { x: 10, y: 20, z: 1.6 },
    rotation: 0,
    side: 'top',
    refDes: 'U1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Layer presets
// ---------------------------------------------------------------------------

describe('LAYER_PRESETS', () => {
  it('has 9 layers', () => {
    expect(Object.keys(LAYER_PRESETS)).toHaveLength(9);
  });

  const expectedLayers: LayerPresetName[] = [
    'F.Cu', 'B.Cu', 'F.SilkS', 'B.SilkS', 'F.Mask', 'B.Mask', 'Substrate', 'In1.Cu', 'In2.Cu',
  ];

  expectedLayers.forEach((name) => {
    it(`${name} has required properties`, () => {
      const layer = LAYER_PRESETS[name];
      expect(layer.name).toBe(name);
      expect(layer.displayName.length).toBeGreaterThan(0);
      expect(typeof layer.zOffset).toBe('number');
      expect(layer.thickness).toBeGreaterThan(0);
      expect(layer.color.w).toBeGreaterThan(0);
      expect(typeof layer.visible).toBe('boolean');
      expect(layer.opacity).toBeGreaterThan(0);
      expect(typeof layer.selectable).toBe('boolean');
    });
  });

  it('inner layers are hidden by default', () => {
    expect(LAYER_PRESETS['In1.Cu'].visible).toBe(false);
    expect(LAYER_PRESETS['In2.Cu'].visible).toBe(false);
  });

  it('copper layers are selectable', () => {
    expect(LAYER_PRESETS['F.Cu'].selectable).toBe(true);
    expect(LAYER_PRESETS['B.Cu'].selectable).toBe(true);
  });

  it('silkscreen layers are not selectable', () => {
    expect(LAYER_PRESETS['F.SilkS'].selectable).toBe(false);
    expect(LAYER_PRESETS['B.SilkS'].selectable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Camera presets
// ---------------------------------------------------------------------------

describe('CAMERA_PRESETS', () => {
  it('has 8 presets', () => {
    expect(Object.keys(CAMERA_PRESETS)).toHaveLength(8);
  });

  const expectedPresets: CameraPresetName[] = [
    'top', 'bottom', 'front', 'back', 'left', 'right', 'isometric', 'perspective',
  ];

  expectedPresets.forEach((name) => {
    it(`${name} has position, target, up, fov`, () => {
      const preset = CAMERA_PRESETS[name];
      expect(preset.name).toBe(name);
      expect(typeof preset.position.x).toBe('number');
      expect(typeof preset.target.x).toBe('number');
      expect(typeof preset.up.x).toBe('number');
      expect(preset.fov).toBeGreaterThan(0);
    });
  });

  it('top view looks down Z axis', () => {
    expect(CAMERA_PRESETS.top.position.z).toBeGreaterThan(0);
    expect(CAMERA_PRESETS.top.target.z).toBe(0);
  });

  it('bottom view looks up Z axis', () => {
    expect(CAMERA_PRESETS.bottom.position.z).toBeLessThan(0);
  });

  it('isometric has offset from all axes', () => {
    const iso = CAMERA_PRESETS.isometric;
    expect(iso.position.x).not.toBe(0);
    expect(iso.position.y).not.toBe(0);
    expect(iso.position.z).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Package dimensions
// ---------------------------------------------------------------------------

describe('PACKAGE_DIMENSIONS', () => {
  it('has 23+ packages', () => {
    expect(Object.keys(PACKAGE_DIMENSIONS).length).toBeGreaterThanOrEqual(23);
  });

  it('has common SMD packages', () => {
    expect(PACKAGE_DIMENSIONS['SOIC-8']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['QFP-44']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['0805']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['SOT-23']).toBeDefined();
  });

  it('has common THT packages', () => {
    expect(PACKAGE_DIMENSIONS['DIP-8']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['TO-220']).toBeDefined();
    expect(PACKAGE_DIMENSIONS['TO-92']).toBeDefined();
  });

  it('all packages have positive dimensions', () => {
    Object.values(PACKAGE_DIMENSIONS).forEach((pkg) => {
      expect(pkg.bodyWidth).toBeGreaterThan(0);
      expect(pkg.bodyLength).toBeGreaterThan(0);
      expect(pkg.bodyHeight).toBeGreaterThan(0);
      expect(pkg.pinCount).toBeGreaterThan(0);
    });
  });

  it('THT packages are marked correctly', () => {
    expect(PACKAGE_DIMENSIONS['DIP-8'].mountingType).toBe('tht');
    expect(PACKAGE_DIMENSIONS['TO-220'].mountingType).toBe('tht');
  });

  it('SMD packages are marked correctly', () => {
    expect(PACKAGE_DIMENSIONS['SOIC-8'].mountingType).toBe('smd');
    expect(PACKAGE_DIMENSIONS['0805'].mountingType).toBe('smd');
  });
});

// ---------------------------------------------------------------------------
// Material presets
// ---------------------------------------------------------------------------

describe('MATERIAL_PRESETS', () => {
  it('has 6 material presets', () => {
    expect(Object.keys(MATERIAL_PRESETS)).toHaveLength(6);
  });

  it('copper is metallic', () => {
    expect(MATERIAL_PRESETS.copper.metallic).toBeGreaterThan(0.5);
  });

  it('fr4 is not metallic', () => {
    expect(MATERIAL_PRESETS.fr4.metallic).toBe(0);
  });

  it('solder mask has < 1 opacity', () => {
    expect(MATERIAL_PRESETS.solderMask.opacity).toBeLessThan(1);
  });

  it('all materials have valid RGBA color', () => {
    Object.values(MATERIAL_PRESETS).forEach((mat) => {
      expect(mat.color.x).toBeGreaterThanOrEqual(0);
      expect(mat.color.x).toBeLessThanOrEqual(1);
      expect(mat.color.w).toBeGreaterThan(0);
      expect(mat.opacity).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Geometry creation
// ---------------------------------------------------------------------------

describe('createBoxGeometry', () => {
  it('creates geometry with correct vertex count (24)', () => {
    const geo = createBoxGeometry(2, 3, 4);
    expect(geo.vertices.length).toBe(24 * 3); // 24 vertices * 3 components
  });

  it('creates geometry with correct index count (36)', () => {
    const geo = createBoxGeometry(1, 1, 1);
    expect(geo.indices.length).toBe(36); // 6 faces * 2 triangles * 3 indices
  });

  it('creates geometry with matching normals', () => {
    const geo = createBoxGeometry(1, 1, 1);
    expect(geo.normals.length).toBe(geo.vertices.length);
  });

  it('has type box', () => {
    const geo = createBoxGeometry(1, 1, 1);
    expect(geo.type).toBe('box');
  });

  it('generates unique id from dimensions', () => {
    const geo = createBoxGeometry(2, 3, 4);
    expect(geo.id).toBe('box-2-3-4');
  });
});

describe('createCylinderGeometry', () => {
  it('creates geometry with vertices', () => {
    const geo = createCylinderGeometry(1, 2);
    expect(geo.vertices.length).toBeGreaterThan(0);
  });

  it('creates geometry with indices', () => {
    const geo = createCylinderGeometry(1, 2);
    expect(geo.indices.length).toBeGreaterThan(0);
  });

  it('has type cylinder', () => {
    const geo = createCylinderGeometry(1, 2);
    expect(geo.type).toBe('cylinder');
  });

  it('vertex count scales with segments', () => {
    const low = createCylinderGeometry(1, 2, 8);
    const high = createCylinderGeometry(1, 2, 32);
    expect(high.vertices.length).toBeGreaterThan(low.vertices.length);
  });
});

describe('createPlaneGeometry', () => {
  it('creates 4 vertices', () => {
    const geo = createPlaneGeometry(10, 10);
    expect(geo.vertices.length).toBe(4 * 3);
  });

  it('creates 2 triangles (6 indices)', () => {
    const geo = createPlaneGeometry(10, 10);
    expect(geo.indices.length).toBe(6);
  });

  it('includes UVs', () => {
    const geo = createPlaneGeometry(5, 5);
    expect(geo.uvs).toBeDefined();
    expect(geo.uvs!.length).toBe(8);
  });

  it('has type plane', () => {
    const geo = createPlaneGeometry(1, 1);
    expect(geo.type).toBe('plane');
  });
});

// ---------------------------------------------------------------------------
// Layer stack calculation
// ---------------------------------------------------------------------------

describe('calculateLayerStack', () => {
  it('returns entries for 2-layer board', () => {
    const stack = calculateLayerStack(1.6, 2);
    expect(stack.length).toBeGreaterThanOrEqual(7); // B.Mask, B.SilkS, B.Cu, Substrate, F.Cu, F.Mask, F.SilkS
  });

  it('returns more entries for 4-layer board', () => {
    const stack2 = calculateLayerStack(1.6, 2);
    const stack4 = calculateLayerStack(1.6, 4);
    expect(stack4.length).toBeGreaterThan(stack2.length);
  });

  it('has substrate as thickest layer', () => {
    const stack = calculateLayerStack(1.6, 2);
    const substrate = stack.find((e) => e.layer === 'Substrate');
    expect(substrate).toBeDefined();
    expect(substrate!.thickness).toBeGreaterThan(1);
  });

  it('stack z-ordering: bottom layers below top layers', () => {
    const stack = calculateLayerStack(1.6, 2);
    const bCu = stack.find((e) => e.layer === 'B.Cu');
    const fCu = stack.find((e) => e.layer === 'F.Cu');
    expect(bCu).toBeDefined();
    expect(fCu).toBeDefined();
    expect(fCu!.zBottom).toBeGreaterThan(bCu!.zTop);
  });

  it('each entry has material', () => {
    const stack = calculateLayerStack(1.6, 2);
    stack.forEach((entry) => {
      expect(entry.material).toBeDefined();
      expect(entry.material.opacity).toBeGreaterThan(0);
    });
  });

  it('handles minimum 2 layers even if layerCount < 2', () => {
    const stack = calculateLayerStack(1.6, 1);
    const copperLayers = stack.filter((e) => e.layer === 'F.Cu' || e.layer === 'B.Cu');
    expect(copperLayers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Board geometry creation
// ---------------------------------------------------------------------------

describe('createBoardGeometry', () => {
  it('creates render objects for all layers', () => {
    const objects = createBoardGeometry(makeBoardParams());
    expect(objects.length).toBeGreaterThanOrEqual(7);
  });

  it('all objects have board- prefix', () => {
    const objects = createBoardGeometry(makeBoardParams());
    objects.forEach((obj) => {
      expect(obj.id).toMatch(/^board-/);
    });
  });

  it('objects are not pickable', () => {
    const objects = createBoardGeometry(makeBoardParams());
    objects.forEach((obj) => {
      expect(obj.pickable).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Component geometry creation
// ---------------------------------------------------------------------------

describe('createComponentGeometry', () => {
  it('creates geometry for known package', () => {
    const obj = createComponentGeometry(makeComponentParams());
    expect(obj).not.toBeNull();
    expect(obj!.id).toBe('component-U1');
  });

  it('returns null for unknown package', () => {
    const obj = createComponentGeometry(makeComponentParams({ packageType: 'UNKNOWN-99' }));
    expect(obj).toBeNull();
  });

  it('positions top components above board', () => {
    const obj = createComponentGeometry(makeComponentParams({ side: 'top', position: { x: 0, y: 0, z: 1.6 } }));
    expect(obj!.position.z).toBeGreaterThan(1.6);
  });

  it('positions bottom components below board', () => {
    const obj = createComponentGeometry(makeComponentParams({ side: 'bottom', position: { x: 0, y: 0, z: 0 } }));
    expect(obj!.position.z).toBeLessThan(0);
  });

  it('sets correct layer for top/bottom', () => {
    const top = createComponentGeometry(makeComponentParams({ side: 'top' }));
    const bot = createComponentGeometry(makeComponentParams({ side: 'bottom', refDes: 'U2' }));
    expect(top!.layer).toBe('F.Cu');
    expect(bot!.layer).toBe('B.Cu');
  });

  it('is pickable', () => {
    const obj = createComponentGeometry(makeComponentParams());
    expect(obj!.pickable).toBe(true);
  });

  it('stores refDes in userData', () => {
    const obj = createComponentGeometry(makeComponentParams({ refDes: 'R42' }));
    expect(obj!.userData?.refDes).toBe('R42');
  });
});

// ---------------------------------------------------------------------------
// Vec3 math
// ---------------------------------------------------------------------------

describe('vec3 math', () => {
  it('vec3Subtract', () => {
    const result = vec3Subtract({ x: 3, y: 4, z: 5 }, { x: 1, y: 2, z: 3 });
    expect(result).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('vec3Dot', () => {
    expect(vec3Dot({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0);
    expect(vec3Dot({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBe(32);
  });

  it('vec3Cross', () => {
    const result = vec3Cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expect(result).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('vec3Length', () => {
    expect(vec3Length({ x: 3, y: 4, z: 0 })).toBe(5);
    expect(vec3Length({ x: 0, y: 0, z: 0 })).toBe(0);
  });

  it('vec3Normalize', () => {
    const n = vec3Normalize({ x: 0, y: 0, z: 5 });
    expect(n.z).toBeCloseTo(1);
    expect(vec3Length(n)).toBeCloseTo(1);
  });

  it('vec3Normalize handles zero vector', () => {
    const n = vec3Normalize({ x: 0, y: 0, z: 0 });
    expect(n).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('vec3Add', () => {
    const result = vec3Add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 });
    expect(result).toEqual({ x: 5, y: 7, z: 9 });
  });

  it('vec3Scale', () => {
    const result = vec3Scale({ x: 1, y: 2, z: 3 }, 2);
    expect(result).toEqual({ x: 2, y: 4, z: 6 });
  });
});

// ---------------------------------------------------------------------------
// Raycasting
// ---------------------------------------------------------------------------

describe('rayBoxIntersect', () => {
  it('hits a box along Z axis', () => {
    const dist = rayBoxIntersect(
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: -1 },
      { x: -1, y: -1, z: -1 },
      { x: 1, y: 1, z: 1 },
    );
    expect(dist).not.toBeNull();
    expect(dist).toBeCloseTo(9);
  });

  it('misses a box', () => {
    const dist = rayBoxIntersect(
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: -1 },
      { x: 5, y: 5, z: -1 },
      { x: 6, y: 6, z: 1 },
    );
    expect(dist).toBeNull();
  });

  it('returns null for ray pointing away', () => {
    const dist = rayBoxIntersect(
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 1 },
      { x: -1, y: -1, z: -1 },
      { x: 1, y: 1, z: 1 },
    );
    expect(dist).toBeNull();
  });

  it('hits when ray starts inside box', () => {
    const dist = rayBoxIntersect(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: -1, y: -1, z: -1 },
      { x: 1, y: 1, z: 1 },
    );
    expect(dist).not.toBeNull();
  });
});

describe('raycastObjects', () => {
  it('returns hits sorted by distance', () => {
    const objects: RenderObject[] = [
      makeRenderObject({ id: 'far', position: { x: 0, y: 0, z: 0 } }),
      makeRenderObject({ id: 'near', position: { x: 0, y: 0, z: 5 } }),
    ];
    const hits = raycastObjects(
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: -1 },
      objects,
    );
    expect(hits.length).toBe(2);
    expect(hits[0].objectId).toBe('near');
    expect(hits[1].objectId).toBe('far');
  });

  it('skips invisible objects', () => {
    const objects = [makeRenderObject({ visible: false })];
    const hits = raycastObjects({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -1 }, objects);
    expect(hits).toHaveLength(0);
  });

  it('skips non-pickable objects', () => {
    const objects = [makeRenderObject({ pickable: false })];
    const hits = raycastObjects({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -1 }, objects);
    expect(hits).toHaveLength(0);
  });

  it('hit includes layer info', () => {
    const objects = [makeRenderObject({ layer: 'F.Cu' })];
    const hits = raycastObjects({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -1 }, objects);
    expect(hits[0].layer).toBe('F.Cu');
  });
});

// ---------------------------------------------------------------------------
// WebGLViewerEngine
// ---------------------------------------------------------------------------

describe('WebGLViewerEngine', () => {
  let engine: WebGLViewerEngine;

  beforeEach(() => {
    WebGLViewerEngine.resetInstance();
    engine = new WebGLViewerEngine();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns same instance', () => {
      const a = WebGLViewerEngine.getInstance();
      const b = WebGLViewerEngine.getInstance();
      expect(a).toBe(b);
    });

    it('resets instance', () => {
      const a = WebGLViewerEngine.getInstance();
      WebGLViewerEngine.resetInstance();
      const b = WebGLViewerEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on object add', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.addObject(makeRenderObject());
      expect(listener).toHaveBeenCalledOnce();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      unsub();
      engine.addObject(makeRenderObject());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Object management
  // -----------------------------------------------------------------------

  describe('object management', () => {
    it('adds and retrieves objects', () => {
      engine.addObject(makeRenderObject({ id: 'obj-1' }));
      expect(engine.getObject('obj-1')).not.toBeNull();
      expect(engine.getObjectCount()).toBe(1);
    });

    it('removes objects', () => {
      engine.addObject(makeRenderObject({ id: 'obj-1' }));
      expect(engine.removeObject('obj-1')).toBe(true);
      expect(engine.getObject('obj-1')).toBeNull();
    });

    it('returns false for removing non-existent object', () => {
      expect(engine.removeObject('nope')).toBe(false);
    });

    it('getAllObjects returns all objects', () => {
      engine.addObject(makeRenderObject({ id: 'a' }));
      engine.addObject(makeRenderObject({ id: 'b' }));
      expect(engine.getAllObjects()).toHaveLength(2);
    });

    it('getVisibleObjects respects visibility', () => {
      engine.addObject(makeRenderObject({ id: 'visible', visible: true }));
      engine.addObject(makeRenderObject({ id: 'hidden', visible: false }));
      expect(engine.getVisibleObjects()).toHaveLength(1);
    });

    it('getObjectsByLayer filters by layer', () => {
      engine.addObject(makeRenderObject({ id: 'a', layer: 'F.Cu' }));
      engine.addObject(makeRenderObject({ id: 'b', layer: 'B.Cu' }));
      expect(engine.getObjectsByLayer('F.Cu')).toHaveLength(1);
    });

    it('clearObjects removes all', () => {
      engine.addObject(makeRenderObject({ id: 'a' }));
      engine.addObject(makeRenderObject({ id: 'b' }));
      engine.clearObjects();
      expect(engine.getObjectCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Layer visibility
  // -----------------------------------------------------------------------

  describe('layer visibility', () => {
    it('respects default visibility', () => {
      expect(engine.isLayerVisible('F.Cu')).toBe(true);
      expect(engine.isLayerVisible('In1.Cu')).toBe(false);
    });

    it('sets layer visibility', () => {
      engine.setLayerVisibility('In1.Cu', true);
      expect(engine.isLayerVisible('In1.Cu')).toBe(true);
    });

    it('toggleLayer flips visibility', () => {
      const result = engine.toggleLayer('F.Cu');
      expect(result).toBe(false);
      expect(engine.isLayerVisible('F.Cu')).toBe(false);
    });

    it('showAllLayers makes all visible', () => {
      engine.hideAllLayers();
      engine.showAllLayers();
      expect(engine.isLayerVisible('F.Cu')).toBe(true);
      expect(engine.isLayerVisible('In1.Cu')).toBe(true);
    });

    it('hideAllLayers hides everything', () => {
      engine.hideAllLayers();
      expect(engine.isLayerVisible('F.Cu')).toBe(false);
      expect(engine.isLayerVisible('B.Cu')).toBe(false);
    });

    it('updates object visibility when layer toggled', () => {
      engine.addObject(makeRenderObject({ id: 'on-fcu', layer: 'F.Cu' }));
      engine.setLayerVisibility('F.Cu', false);
      expect(engine.getObject('on-fcu')!.visible).toBe(false);
    });

    it('getLayerVisibility returns map copy', () => {
      const vis = engine.getLayerVisibility();
      expect(vis.size).toBe(9);
    });
  });

  // -----------------------------------------------------------------------
  // Camera
  // -----------------------------------------------------------------------

  describe('camera', () => {
    it('defaults to isometric', () => {
      const cam = engine.getCameraPreset();
      expect(cam.name).toBe('isometric');
    });

    it('switches to preset', () => {
      engine.setCamera('top');
      expect(engine.getCameraPreset().name).toBe('top');
    });

    it('setCameraPosition updates position', () => {
      engine.setCameraPosition({ x: 1, y: 2, z: 3 });
      expect(engine.getCameraPreset().position).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('setCameraTarget updates target', () => {
      engine.setCameraTarget({ x: 5, y: 5, z: 5 });
      expect(engine.getCameraPreset().target).toEqual({ x: 5, y: 5, z: 5 });
    });

    it('setCameraFov clamps between 10 and 120', () => {
      engine.setCameraFov(5);
      expect(engine.getCameraPreset().fov).toBe(10);
      engine.setCameraFov(150);
      expect(engine.getCameraPreset().fov).toBe(120);
    });

    it('getAvailableCameraPresets returns 8 names', () => {
      expect(engine.getAvailableCameraPresets()).toHaveLength(8);
    });
  });

  // -----------------------------------------------------------------------
  // Viewport
  // -----------------------------------------------------------------------

  describe('viewport', () => {
    it('has default viewport', () => {
      const vp = engine.getViewport();
      expect(vp.width).toBe(800);
      expect(vp.height).toBe(600);
    });

    it('updates viewport', () => {
      engine.setViewport({ width: 1920, height: 1080, pixelRatio: 2 });
      const vp = engine.getViewport();
      expect(vp.width).toBe(1920);
      expect(vp.pixelRatio).toBe(2);
    });

    it('getAspectRatio computes correctly', () => {
      engine.setViewport({ width: 1920, height: 1080, pixelRatio: 1 });
      expect(engine.getAspectRatio()).toBeCloseTo(16 / 9, 2);
    });
  });

  // -----------------------------------------------------------------------
  // Board & component
  // -----------------------------------------------------------------------

  describe('setBoard', () => {
    it('creates board objects', () => {
      const objects = engine.setBoard(makeBoardParams());
      expect(objects.length).toBeGreaterThanOrEqual(7);
      expect(engine.getObjectCount()).toBeGreaterThanOrEqual(7);
    });

    it('stores board params', () => {
      engine.setBoard(makeBoardParams({ width: 50 }));
      expect(engine.getBoardParams()!.width).toBe(50);
    });

    it('replaces old board objects on re-call', () => {
      engine.setBoard(makeBoardParams());
      const countBefore = engine.getObjectCount();
      engine.setBoard(makeBoardParams({ width: 200 }));
      expect(engine.getObjectCount()).toBe(countBefore);
    });
  });

  describe('addComponent', () => {
    it('adds component for known package', () => {
      const obj = engine.addComponent(makeComponentParams());
      expect(obj).not.toBeNull();
      expect(engine.getObjectCount()).toBe(1);
    });

    it('returns null for unknown package', () => {
      const obj = engine.addComponent(makeComponentParams({ packageType: 'NOPE' }));
      expect(obj).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Raycasting
  // -----------------------------------------------------------------------

  describe('raycast', () => {
    it('finds pickable objects', () => {
      engine.addObject(makeRenderObject({ id: 'pickable', pickable: true }));
      const hits = engine.raycast({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -1 });
      expect(hits.length).toBeGreaterThan(0);
    });

    it('ignores non-pickable objects', () => {
      engine.addObject(makeRenderObject({ id: 'board', pickable: false }));
      const hits = engine.raycast({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -1 });
      expect(hits).toHaveLength(0);
    });
  });

  describe('pickAtScreenCoord', () => {
    it('returns null when nothing to pick', () => {
      const hit = engine.pickAtScreenCoord(400, 300);
      expect(hit).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  describe('stats', () => {
    it('starts with zero stats', () => {
      const stats = engine.getStats();
      expect(stats.objects).toBe(0);
      expect(stats.triangles).toBe(0);
    });

    it('updates stats when objects added', () => {
      engine.addObject(makeRenderObject());
      const stats = engine.getStats();
      expect(stats.objects).toBe(1);
      expect(stats.triangles).toBeGreaterThan(0);
    });

    it('updateFrameStats sets fps', () => {
      engine.updateFrameStats(60, 16.67);
      const stats = engine.getStats();
      expect(stats.fps).toBe(60);
      expect(stats.frameTime).toBeCloseTo(16.67);
    });
  });

  // -----------------------------------------------------------------------
  // Package lookup
  // -----------------------------------------------------------------------

  describe('package lookup', () => {
    it('getPackageDimensions returns known package', () => {
      expect(engine.getPackageDimensions('DIP-8')).not.toBeNull();
    });

    it('getPackageDimensions returns null for unknown', () => {
      expect(engine.getPackageDimensions('NOPE')).toBeNull();
    });

    it('getAllPackageTypes returns all', () => {
      expect(engine.getAllPackageTypes().length).toBeGreaterThanOrEqual(23);
    });

    it('getSmdPackages filters correctly', () => {
      const smd = engine.getSmdPackages();
      smd.forEach((p) => expect(p.mountingType).toBe('smd'));
    });

    it('getThtPackages filters correctly', () => {
      const tht = engine.getThtPackages();
      tht.forEach((p) => expect(p.mountingType).toBe('tht'));
    });
  });

  // -----------------------------------------------------------------------
  // Layer stack & presets
  // -----------------------------------------------------------------------

  describe('layer stack', () => {
    it('getLayerStack uses board params', () => {
      engine.setBoard(makeBoardParams({ layerCount: 4 }));
      const stack = engine.getLayerStack();
      const innerLayers = stack.filter((e) => e.layer === 'In1.Cu' || e.layer === 'In2.Cu');
      expect(innerLayers.length).toBeGreaterThan(0);
    });

    it('getLayerStack defaults to 2-layer', () => {
      const stack = engine.getLayerStack();
      const innerLayers = stack.filter((e) => e.layer === 'In1.Cu' || e.layer === 'In2.Cu');
      expect(innerLayers).toHaveLength(0);
    });

    it('getLayerPresets returns all 9', () => {
      const presets = engine.getLayerPresets();
      expect(Object.keys(presets)).toHaveLength(9);
    });
  });

  // -----------------------------------------------------------------------
  // Material
  // -----------------------------------------------------------------------

  describe('material', () => {
    it('getMaterialPresets returns 6 presets', () => {
      expect(Object.keys(engine.getMaterialPresets())).toHaveLength(6);
    });

    it('setObjectMaterial updates material', () => {
      engine.addObject(makeRenderObject({ id: 'obj' }));
      const newMat: Material = { ...MATERIAL_PRESETS.copper };
      expect(engine.setObjectMaterial('obj', newMat)).toBe(true);
      expect(engine.getObject('obj')!.material.metallic).toBe(MATERIAL_PRESETS.copper.metallic);
    });

    it('setObjectMaterial returns false for unknown object', () => {
      expect(engine.setObjectMaterial('nope', { ...MATERIAL_PRESETS.copper })).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  describe('toJSON', () => {
    it('serializes current state', () => {
      engine.addObject(makeRenderObject({ id: 'x' }));
      engine.setBoard(makeBoardParams());
      const json = engine.toJSON();
      expect(json.objects.length).toBeGreaterThan(0);
      expect(json.camera.name).toBe('isometric');
      expect(json.boardParams).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  describe('reset', () => {
    it('clears all state', () => {
      engine.addObject(makeRenderObject());
      engine.setBoard(makeBoardParams());
      engine.setCamera('top');
      engine.reset();
      expect(engine.getObjectCount()).toBe(0);
      expect(engine.getBoardParams()).toBeNull();
      expect(engine.getCameraPreset().name).toBe('isometric');
    });

    it('restores default layer visibility', () => {
      engine.setLayerVisibility('In1.Cu', true);
      engine.reset();
      expect(engine.isLayerVisible('In1.Cu')).toBe(false);
    });
  });
});
