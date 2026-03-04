import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  BoardDimensions,
  Component3D,
  ViewAngle,
  LayerType3D,
  PackageModel,
  Point3D,
} from '../board-viewer-3d';

// ---------------------------------------------------------------------------
// Global stubs
// ---------------------------------------------------------------------------

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => {
    uuidCounter++;
    return `uuid-${uuidCounter.toString().padStart(4, '0')}`;
  }),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let BoardViewer3D: typeof import('../board-viewer-3d').BoardViewer3D;

beforeEach(async () => {
  // Reset state
  uuidCounter = 0;
  for (const k of Object.keys(store)) {
    delete store[k];
  }
  vi.clearAllMocks();

  // Re-import to get clean module
  const mod = await import('../board-viewer-3d');
  BoardViewer3D = mod.BoardViewer3D;
  BoardViewer3D.resetForTesting();
});

// ---------------------------------------------------------------------------
// Board setup / get
// ---------------------------------------------------------------------------

describe('Board Setup', () => {
  it('should have default board dimensions', () => {
    const viewer = BoardViewer3D.getInstance();
    const board = viewer.getBoard();
    expect(board.width).toBe(100);
    expect(board.height).toBe(80);
    expect(board.thickness).toBe(1.6);
    expect(board.cornerRadius).toBe(0);
  });

  it('should set custom board dimensions', () => {
    const viewer = BoardViewer3D.getInstance();
    const dims: BoardDimensions = { width: 50, height: 40, thickness: 2.0, cornerRadius: 3 };
    viewer.setBoard(dims);
    const board = viewer.getBoard();
    expect(board.width).toBe(50);
    expect(board.height).toBe(40);
    expect(board.thickness).toBe(2.0);
    expect(board.cornerRadius).toBe(3);
  });

  it('should return a copy of board dimensions (not a reference)', () => {
    const viewer = BoardViewer3D.getInstance();
    const board1 = viewer.getBoard();
    board1.width = 999;
    const board2 = viewer.getBoard();
    expect(board2.width).toBe(100);
  });

  it('should set board color', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setBoardColor('#ff0000');
    expect(viewer.getRenderOptions().boardColor).toBe('#ff0000');
  });

  it('should set solder mask color', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setSolderMaskColor('#00ff00');
    expect(viewer.getRenderOptions().solderMaskColor).toBe('#00ff00');
  });
});

// ---------------------------------------------------------------------------
// Component CRUD
// ---------------------------------------------------------------------------

describe('Component CRUD', () => {
  it('should add a component and return it with an ID', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 10, y: 20, z: 0 },
    });
    expect(comp.id).toBeDefined();
    expect(comp.refDes).toBe('U1');
    expect(comp.package).toBe('SOIC-8');
    expect(comp.position.x).toBe(10);
    expect(comp.position.y).toBe(20);
  });

  it('should use package model dimensions when available', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 0, y: 0, z: 0 },
    });
    // SOIC-8 body dimensions
    expect(comp.bodyWidth).toBe(4.9);
    expect(comp.bodyHeight).toBe(3.9);
    expect(comp.bodyDepth).toBe(1.75);
  });

  it('should use provided dimensions over package defaults', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 0, y: 0, z: 0 },
      bodyWidth: 10,
      bodyHeight: 8,
      bodyDepth: 3,
    });
    expect(comp.bodyWidth).toBe(10);
    expect(comp.bodyHeight).toBe(8);
    expect(comp.bodyDepth).toBe(3);
  });

  it('should default to top side', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'R1',
      package: '0603',
      position: { x: 0, y: 0, z: 0 },
    });
    expect(comp.side).toBe('top');
  });

  it('should get a component by ID', () => {
    const viewer = BoardViewer3D.getInstance();
    const added = viewer.addComponent({
      refDes: 'U1',
      package: 'DIP-8',
      position: { x: 5, y: 10, z: 0 },
    });
    const found = viewer.getComponent(added.id);
    expect(found).toBeDefined();
    expect(found!.refDes).toBe('U1');
  });

  it('should return undefined for non-existent component', () => {
    const viewer = BoardViewer3D.getInstance();
    expect(viewer.getComponent('non-existent')).toBeUndefined();
  });

  it('should update a component', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 0, y: 0, z: 0 },
    });
    const updated = viewer.updateComponent(comp.id, {
      refDes: 'U2',
      rotation: 90,
      side: 'bottom',
    });
    expect(updated).toBe(true);
    const found = viewer.getComponent(comp.id);
    expect(found!.refDes).toBe('U2');
    expect(found!.rotation).toBe(90);
    expect(found!.side).toBe('bottom');
  });

  it('should return false when updating non-existent component', () => {
    const viewer = BoardViewer3D.getInstance();
    expect(viewer.updateComponent('fake-id', { refDes: 'X1' })).toBe(false);
  });

  it('should remove a component', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 0, y: 0, z: 0 },
    });
    expect(viewer.removeComponent(comp.id)).toBe(true);
    expect(viewer.getComponent(comp.id)).toBeUndefined();
    expect(viewer.getAllComponents()).toHaveLength(0);
  });

  it('should return false when removing non-existent component', () => {
    const viewer = BoardViewer3D.getInstance();
    expect(viewer.removeComponent('fake-id')).toBe(false);
  });

  it('should get all components', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 0, y: 0, z: 0 } });
    viewer.addComponent({ refDes: 'R1', package: '0603', position: { x: 10, y: 0, z: 0 } });
    viewer.addComponent({ refDes: 'C1', package: '0805', position: { x: 20, y: 0, z: 0 } });
    expect(viewer.getAllComponents()).toHaveLength(3);
  });

  it('should get components by side', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 0, y: 0, z: 0 }, side: 'top' });
    viewer.addComponent({ refDes: 'U2', package: 'SOIC-8', position: { x: 10, y: 0, z: 0 }, side: 'bottom' });
    viewer.addComponent({ refDes: 'R1', package: '0603', position: { x: 20, y: 0, z: 0 }, side: 'top' });

    const topComps = viewer.getComponentsBySide('top');
    expect(topComps).toHaveLength(2);
    expect(topComps.map((c) => c.refDes).sort()).toEqual(['R1', 'U1']);

    const bottomComps = viewer.getComponentsBySide('bottom');
    expect(bottomComps).toHaveLength(1);
    expect(bottomComps[0].refDes).toBe('U2');
  });

  it('should add component with pins', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'U1',
      package: 'DIP-8',
      position: { x: 0, y: 0, z: 0 },
      pins: [
        { position: { x: 0, y: 0 }, diameter: 0.5, type: 'through-hole' },
        { position: { x: 2.54, y: 0 }, diameter: 0.5, type: 'through-hole' },
      ],
    });
    expect(comp.pins).toHaveLength(2);
    expect(comp.pins[0].id).toBeDefined();
    expect(comp.pins[0].type).toBe('through-hole');
  });

  it('should add component with label', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 0, y: 0, z: 0 },
      label: 'ATmega328P',
    });
    expect(comp.label).toBe('ATmega328P');
  });

  it('should update component label to null (clear it)', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 0, y: 0, z: 0 },
      label: 'ATmega328P',
    });
    viewer.updateComponent(comp.id, { label: null });
    const updated = viewer.getComponent(comp.id);
    expect(updated!.label).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Via CRUD
// ---------------------------------------------------------------------------

describe('Via CRUD', () => {
  it('should add a via', () => {
    const viewer = BoardViewer3D.getInstance();
    const via = viewer.addVia({
      position: { x: 10, y: 20 },
      drillDiameter: 0.3,
      outerDiameter: 0.6,
    });
    expect(via.id).toBeDefined();
    expect(via.position.x).toBe(10);
    expect(via.drillDiameter).toBe(0.3);
    expect(via.outerDiameter).toBe(0.6);
    expect(via.startLayer).toBe('top-copper');
    expect(via.endLayer).toBe('bottom-copper');
  });

  it('should add a via with custom layers', () => {
    const viewer = BoardViewer3D.getInstance();
    const via = viewer.addVia({
      position: { x: 0, y: 0 },
      drillDiameter: 0.2,
      outerDiameter: 0.4,
      startLayer: 'top-copper',
      endLayer: 'internal',
    });
    expect(via.startLayer).toBe('top-copper');
    expect(via.endLayer).toBe('internal');
  });

  it('should remove a via', () => {
    const viewer = BoardViewer3D.getInstance();
    const via = viewer.addVia({
      position: { x: 0, y: 0 },
      drillDiameter: 0.3,
      outerDiameter: 0.6,
    });
    expect(viewer.removeVia(via.id)).toBe(true);
    expect(viewer.getAllVias()).toHaveLength(0);
  });

  it('should return false when removing non-existent via', () => {
    const viewer = BoardViewer3D.getInstance();
    expect(viewer.removeVia('fake-id')).toBe(false);
  });

  it('should get all vias', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addVia({ position: { x: 0, y: 0 }, drillDiameter: 0.3, outerDiameter: 0.6 });
    viewer.addVia({ position: { x: 5, y: 5 }, drillDiameter: 0.25, outerDiameter: 0.5 });
    expect(viewer.getAllVias()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Trace CRUD
// ---------------------------------------------------------------------------

describe('Trace CRUD', () => {
  it('should add a trace', () => {
    const viewer = BoardViewer3D.getInstance();
    const trace = viewer.addTrace({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      width: 0.254,
      layer: 'top-copper',
    });
    expect(trace.id).toBeDefined();
    expect(trace.points).toHaveLength(3);
    expect(trace.width).toBe(0.254);
    expect(trace.layer).toBe('top-copper');
  });

  it('should remove a trace', () => {
    const viewer = BoardViewer3D.getInstance();
    const trace = viewer.addTrace({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      width: 0.254,
      layer: 'top-copper',
    });
    expect(viewer.removeTrace(trace.id)).toBe(true);
    expect(viewer.getAllTraces()).toHaveLength(0);
  });

  it('should return false when removing non-existent trace', () => {
    const viewer = BoardViewer3D.getInstance();
    expect(viewer.removeTrace('fake-id')).toBe(false);
  });

  it('should get all traces', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addTrace({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.254, layer: 'top-copper' });
    viewer.addTrace({ points: [{ x: 0, y: 0 }, { x: 0, y: 10 }], width: 0.5, layer: 'bottom-copper' });
    expect(viewer.getAllTraces()).toHaveLength(2);
  });

  it('should get traces by layer', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addTrace({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.254, layer: 'top-copper' });
    viewer.addTrace({ points: [{ x: 0, y: 0 }, { x: 0, y: 10 }], width: 0.5, layer: 'bottom-copper' });
    viewer.addTrace({ points: [{ x: 5, y: 5 }, { x: 15, y: 5 }], width: 0.3, layer: 'top-copper' });

    const topTraces = viewer.getTracesByLayer('top-copper');
    expect(topTraces).toHaveLength(2);

    const bottomTraces = viewer.getTracesByLayer('bottom-copper');
    expect(bottomTraces).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Drill Hole CRUD
// ---------------------------------------------------------------------------

describe('Drill Hole CRUD', () => {
  it('should add a drill hole', () => {
    const viewer = BoardViewer3D.getInstance();
    const hole = viewer.addDrillHole({
      position: { x: 5, y: 5 },
      diameter: 3.2,
      plated: true,
    });
    expect(hole.id).toBeDefined();
    expect(hole.position.x).toBe(5);
    expect(hole.diameter).toBe(3.2);
    expect(hole.plated).toBe(true);
  });

  it('should default plated to false', () => {
    const viewer = BoardViewer3D.getInstance();
    const hole = viewer.addDrillHole({
      position: { x: 0, y: 0 },
      diameter: 3.0,
    });
    expect(hole.plated).toBe(false);
  });

  it('should remove a drill hole', () => {
    const viewer = BoardViewer3D.getInstance();
    const hole = viewer.addDrillHole({ position: { x: 0, y: 0 }, diameter: 3.0 });
    expect(viewer.removeDrillHole(hole.id)).toBe(true);
    expect(viewer.getAllDrillHoles()).toHaveLength(0);
  });

  it('should return false when removing non-existent drill hole', () => {
    const viewer = BoardViewer3D.getInstance();
    expect(viewer.removeDrillHole('fake-id')).toBe(false);
  });

  it('should get all drill holes', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addDrillHole({ position: { x: 0, y: 0 }, diameter: 3.0 });
    viewer.addDrillHole({ position: { x: 10, y: 10 }, diameter: 2.5 });
    viewer.addDrillHole({ position: { x: 20, y: 20 }, diameter: 4.0, plated: true });
    expect(viewer.getAllDrillHoles()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// buildScene
// ---------------------------------------------------------------------------

describe('buildScene', () => {
  it('should build a scene with default board and layers', () => {
    const viewer = BoardViewer3D.getInstance();
    const scene = viewer.buildScene();

    expect(scene.board.width).toBe(100);
    expect(scene.board.height).toBe(80);
    expect(scene.board.thickness).toBe(1.6);
    expect(scene.layers.length).toBe(7); // 7 layers in default 2-layer stack
    expect(scene.components).toHaveLength(0);
    expect(scene.vias).toHaveLength(0);
    expect(scene.traces).toHaveLength(0);
    expect(scene.drillHoles).toHaveLength(0);
  });

  it('should include correct layer types', () => {
    const viewer = BoardViewer3D.getInstance();
    const scene = viewer.buildScene();
    const layerTypes = scene.layers.map((l) => l.type);
    expect(layerTypes).toContain('top-copper');
    expect(layerTypes).toContain('bottom-copper');
    expect(layerTypes).toContain('substrate');
    expect(layerTypes).toContain('top-silk');
    expect(layerTypes).toContain('bottom-silk');
    expect(layerTypes).toContain('top-mask');
    expect(layerTypes).toContain('bottom-mask');
  });

  it('should have correct layer Z-offsets (bottom-up ordering)', () => {
    const viewer = BoardViewer3D.getInstance();
    const scene = viewer.buildScene();

    // Bottom layers should be at or below 0, top layers above
    const bottomCopper = scene.layers.find((l) => l.type === 'bottom-copper')!;
    const topCopper = scene.layers.find((l) => l.type === 'top-copper')!;
    const substrate = scene.layers.find((l) => l.type === 'substrate')!;

    expect(bottomCopper.zOffset).toBeLessThan(substrate.zOffset);
    expect(substrate.zOffset).toBeLessThan(topCopper.zOffset);
  });

  it('should position top-side components on top of the board', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 10, y: 20, z: 0 },
      side: 'top',
    });

    const scene = viewer.buildScene();
    const comp = scene.components[0];
    expect(comp.position.z).toBe(1.6); // board thickness
  });

  it('should position bottom-side components below the board', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addComponent({
      refDes: 'U2',
      package: 'SOIC-8',
      position: { x: 10, y: 20, z: 0 },
      side: 'bottom',
    });

    const scene = viewer.buildScene();
    const comp = scene.components[0];
    expect(comp.position.z).toBe(-comp.bodyDepth); // hanging below
  });

  it('should include all added entities in the scene', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 0, y: 0, z: 0 } });
    viewer.addVia({ position: { x: 5, y: 5 }, drillDiameter: 0.3, outerDiameter: 0.6 });
    viewer.addTrace({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.254, layer: 'top-copper' });
    viewer.addDrillHole({ position: { x: 3, y: 3 }, diameter: 3.0 });

    const scene = viewer.buildScene();
    expect(scene.components).toHaveLength(1);
    expect(scene.vias).toHaveLength(1);
    expect(scene.traces).toHaveLength(1);
    expect(scene.drillHoles).toHaveLength(1);
  });

  it('should reflect layer visibility in scene', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setLayerVisible('top-silk', false);

    const scene = viewer.buildScene();
    const topSilk = scene.layers.find((l) => l.type === 'top-silk')!;
    expect(topSilk.visible).toBe(false);

    const topCopper = scene.layers.find((l) => l.type === 'top-copper')!;
    expect(topCopper.visible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Camera views
// ---------------------------------------------------------------------------

describe('Camera Views', () => {
  const allAngles: ViewAngle[] = ['top', 'bottom', 'front', 'back', 'left', 'right', 'isometric'];

  allAngles.forEach((angle) => {
    it(`should return valid CameraState for "${angle}" view`, () => {
      const viewer = BoardViewer3D.getInstance();
      const cam = viewer.getCameraForView(angle);

      expect(cam.position).toBeDefined();
      expect(typeof cam.position.x).toBe('number');
      expect(typeof cam.position.y).toBe('number');
      expect(typeof cam.position.z).toBe('number');

      expect(cam.target).toBeDefined();
      expect(typeof cam.target.x).toBe('number');

      expect(cam.up).toBeDefined();
      expect(cam.fov).toBe(45);
      expect(cam.zoom).toBe(1);
    });
  });

  it('should have top view camera above the board', () => {
    const viewer = BoardViewer3D.getInstance();
    const cam = viewer.getCameraForView('top');
    expect(cam.position.z).toBeGreaterThan(cam.target.z);
  });

  it('should have bottom view camera below the board', () => {
    const viewer = BoardViewer3D.getInstance();
    const cam = viewer.getCameraForView('bottom');
    expect(cam.position.z).toBeLessThan(cam.target.z);
  });

  it('should have front view camera in front of the board (negative Y)', () => {
    const viewer = BoardViewer3D.getInstance();
    const cam = viewer.getCameraForView('front');
    expect(cam.position.y).toBeLessThan(cam.target.y);
  });

  it('should have camera target at board center', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setBoard({ width: 60, height: 40, thickness: 1.6, cornerRadius: 0 });
    const cam = viewer.getCameraForView('isometric');
    expect(cam.target.x).toBe(30); // width / 2
    expect(cam.target.y).toBe(20); // height / 2
    expect(cam.target.z).toBe(0.8); // thickness / 2
  });
});

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

describe('Render Options', () => {
  it('should have default render options', () => {
    const viewer = BoardViewer3D.getInstance();
    const opts = viewer.getRenderOptions();
    expect(opts.showComponents).toBe(true);
    expect(opts.showTraces).toBe(true);
    expect(opts.showVias).toBe(true);
    expect(opts.showDrills).toBe(true);
    expect(opts.showSilkscreen).toBe(true);
    expect(opts.showSolderMask).toBe(true);
    expect(opts.showBoardEdge).toBe(true);
    expect(opts.transparentBoard).toBe(false);
    expect(opts.componentOpacity).toBe(1.0);
  });

  it('should allow partial update of render options', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setRenderOptions({ showComponents: false, transparentBoard: true });
    const opts = viewer.getRenderOptions();
    expect(opts.showComponents).toBe(false);
    expect(opts.transparentBoard).toBe(true);
    // Other options should remain at defaults
    expect(opts.showTraces).toBe(true);
  });

  it('should return a copy of render options', () => {
    const viewer = BoardViewer3D.getInstance();
    const opts1 = viewer.getRenderOptions();
    opts1.showComponents = false;
    const opts2 = viewer.getRenderOptions();
    expect(opts2.showComponents).toBe(true);
  });

  it('should support color customization', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setRenderOptions({
      boardColor: '#ff0000',
      copperColor: '#00ff00',
      silkscreenColor: '#0000ff',
      backgroundColor: '#111111',
    });
    const opts = viewer.getRenderOptions();
    expect(opts.boardColor).toBe('#ff0000');
    expect(opts.copperColor).toBe('#00ff00');
    expect(opts.silkscreenColor).toBe('#0000ff');
    expect(opts.backgroundColor).toBe('#111111');
  });
});

// ---------------------------------------------------------------------------
// Layer visibility
// ---------------------------------------------------------------------------

describe('Layer Visibility', () => {
  it('should have all layers visible by default', () => {
    const viewer = BoardViewer3D.getInstance();
    const visible = viewer.getVisibleLayers();
    expect(visible).toContain('top-copper');
    expect(visible).toContain('bottom-copper');
    expect(visible).toContain('substrate');
    expect(visible).toContain('top-silk');
    expect(visible).toContain('bottom-silk');
    expect(visible).toContain('top-mask');
    expect(visible).toContain('bottom-mask');
  });

  it('should toggle layer visibility', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setLayerVisible('top-silk', false);
    const visible = viewer.getVisibleLayers();
    expect(visible).not.toContain('top-silk');
    expect(visible).toContain('top-copper');
  });

  it('should re-enable a hidden layer', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setLayerVisible('substrate', false);
    expect(viewer.getVisibleLayers()).not.toContain('substrate');

    viewer.setLayerVisible('substrate', true);
    expect(viewer.getVisibleLayers()).toContain('substrate');
  });
});

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

describe('Measurement', () => {
  it('should measure distance between two points', () => {
    const viewer = BoardViewer3D.getInstance();
    const from: Point3D = { x: 0, y: 0, z: 0 };
    const to: Point3D = { x: 3, y: 4, z: 0 };
    const result = viewer.measureDistance(from, to);

    expect(result.distance).toBeCloseTo(5.0);
    expect(result.dx).toBe(3);
    expect(result.dy).toBe(4);
    expect(result.dz).toBe(0);
  });

  it('should measure 3D distance with Z component', () => {
    const viewer = BoardViewer3D.getInstance();
    const from: Point3D = { x: 0, y: 0, z: 0 };
    const to: Point3D = { x: 1, y: 2, z: 2 };
    const result = viewer.measureDistance(from, to);

    expect(result.distance).toBeCloseTo(3.0);
    expect(result.dx).toBe(1);
    expect(result.dy).toBe(2);
    expect(result.dz).toBe(2);
  });

  it('should measure zero distance for same point', () => {
    const viewer = BoardViewer3D.getInstance();
    const point: Point3D = { x: 5, y: 5, z: 1 };
    const result = viewer.measureDistance(point, point);

    expect(result.distance).toBe(0);
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.dz).toBe(0);
  });

  it('should handle negative deltas', () => {
    const viewer = BoardViewer3D.getInstance();
    const from: Point3D = { x: 10, y: 10, z: 5 };
    const to: Point3D = { x: 0, y: 0, z: 0 };
    const result = viewer.measureDistance(from, to);

    expect(result.dx).toBe(-10);
    expect(result.dy).toBe(-10);
    expect(result.dz).toBe(-5);
    expect(result.distance).toBeCloseTo(15.0);
  });

  it('should return copies of the from/to points', () => {
    const viewer = BoardViewer3D.getInstance();
    const from: Point3D = { x: 1, y: 2, z: 3 };
    const to: Point3D = { x: 4, y: 5, z: 6 };
    const result = viewer.measureDistance(from, to);

    result.from.x = 999;
    expect(from.x).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Package models
// ---------------------------------------------------------------------------

describe('Package Models', () => {
  it('should have 15 built-in package models', () => {
    const viewer = BoardViewer3D.getInstance();
    const models = viewer.getAllPackageModels();
    expect(models.length).toBe(15);
  });

  it('should get a specific built-in package model', () => {
    const viewer = BoardViewer3D.getInstance();
    const dip8 = viewer.getPackageModel('DIP-8');
    expect(dip8).toBeDefined();
    expect(dip8!.name).toBe('DIP-8');
    expect(dip8!.pinCount).toBe(8);
    expect(dip8!.category).toBe('through-hole');
  });

  it('should return undefined for non-existent package', () => {
    const viewer = BoardViewer3D.getInstance();
    expect(viewer.getPackageModel('DOES-NOT-EXIST')).toBeUndefined();
  });

  it('should add a custom package model', () => {
    const viewer = BoardViewer3D.getInstance();
    const custom: PackageModel = {
      name: 'CUSTOM-4',
      bodyWidth: 5.0,
      bodyHeight: 5.0,
      bodyDepth: 2.0,
      pinCount: 4,
      pinPitch: 1.0,
      pinDiameter: 0.3,
      category: 'smd',
      color: '#ff0000',
    };
    viewer.addPackageModel(custom);

    const found = viewer.getPackageModel('CUSTOM-4');
    expect(found).toBeDefined();
    expect(found!.pinCount).toBe(4);
    expect(viewer.getAllPackageModels().length).toBe(16);
  });

  it('should return a copy of package model', () => {
    const viewer = BoardViewer3D.getInstance();
    const model = viewer.getPackageModel('DIP-8')!;
    model.pinCount = 999;
    const model2 = viewer.getPackageModel('DIP-8')!;
    expect(model2.pinCount).toBe(8);
  });

  it('should include all expected built-in package names', () => {
    const viewer = BoardViewer3D.getInstance();
    const names = viewer.getAllPackageModels().map((m) => m.name).sort();
    expect(names).toEqual([
      '0402', '0603', '0805', '1206',
      'DIP-14', 'DIP-28', 'DIP-8',
      'QFP-32', 'QFP-48',
      'SOIC-16', 'SOIC-8',
      'SOT-223', 'SOT-23',
      'TO-220',
      'TQFP-44',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

describe('Export / Import Scene', () => {
  it('should export scene as valid JSON string', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 10, y: 20, z: 0 } });
    const json = viewer.exportScene();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.board).toBeDefined();
    expect(parsed.components).toBeDefined();
    expect((parsed.components as Component3D[]).length).toBe(1);
  });

  it('should round-trip export/import', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setBoard({ width: 50, height: 40, thickness: 2.0, cornerRadius: 1 });
    viewer.addComponent({ refDes: 'U1', package: 'DIP-8', position: { x: 10, y: 10, z: 0 } });
    viewer.addVia({ position: { x: 5, y: 5 }, drillDiameter: 0.3, outerDiameter: 0.6 });
    viewer.addTrace({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 0.254, layer: 'top-copper' });
    viewer.addDrillHole({ position: { x: 3, y: 3 }, diameter: 3.0 });

    const exported = viewer.exportScene();

    // Clear and re-import
    viewer.clear();
    expect(viewer.getAllComponents()).toHaveLength(0);

    const result = viewer.importScene(exported);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    expect(viewer.getBoard().width).toBe(50);
    expect(viewer.getAllComponents()).toHaveLength(1);
    expect(viewer.getAllVias()).toHaveLength(1);
    expect(viewer.getAllTraces()).toHaveLength(1);
    expect(viewer.getAllDrillHoles()).toHaveLength(1);
  });

  it('should reject invalid JSON', () => {
    const viewer = BoardViewer3D.getInstance();
    const result = viewer.importScene('not valid json{{{');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Invalid JSON');
  });

  it('should reject non-object JSON', () => {
    const viewer = BoardViewer3D.getInstance();
    const result = viewer.importScene('"just a string"');
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Expected a JSON object');
  });

  it('should reject invalid board dimensions', () => {
    const viewer = BoardViewer3D.getInstance();
    const result = viewer.importScene(JSON.stringify({
      board: { width: 'not a number', height: 10, thickness: 1.6, cornerRadius: 0 },
    }));
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject components that are not an array', () => {
    const viewer = BoardViewer3D.getInstance();
    const result = viewer.importScene(JSON.stringify({
      components: 'not an array',
    }));
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Components must be an array');
  });

  it('should import render options', () => {
    const viewer = BoardViewer3D.getInstance();
    const result = viewer.importScene(JSON.stringify({
      renderOptions: { boardColor: '#123456' },
    }));
    expect(result.success).toBe(true);
    expect(viewer.getRenderOptions().boardColor).toBe('#123456');
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

describe('localStorage Persistence', () => {
  it('should save to localStorage on mutation', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.setBoard({ width: 42, height: 42, thickness: 1.0, cornerRadius: 0 });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'protopulse-board-viewer-3d',
      expect.any(String),
    );
  });

  it('should load from localStorage on construction', () => {
    const viewer1 = BoardViewer3D.getInstance();
    viewer1.setBoard({ width: 77, height: 55, thickness: 2.0, cornerRadius: 1 });
    viewer1.addComponent({ refDes: 'R1', package: '0805', position: { x: 1, y: 2, z: 0 } });

    // Reset singleton without clearing storage
    BoardViewer3D.resetForTesting();

    const viewer2 = BoardViewer3D.getInstance();
    const board = viewer2.getBoard();
    expect(board.width).toBe(77);
    expect(board.height).toBe(55);
    expect(viewer2.getAllComponents()).toHaveLength(1);
    expect(viewer2.getAllComponents()[0].refDes).toBe('R1');
  });

  it('should persist layer visibility', () => {
    const viewer1 = BoardViewer3D.getInstance();
    viewer1.setLayerVisible('top-silk', false);

    BoardViewer3D.resetForTesting();

    const viewer2 = BoardViewer3D.getInstance();
    expect(viewer2.getVisibleLayers()).not.toContain('top-silk');
  });

  it('should handle corrupt localStorage data gracefully', () => {
    store['protopulse-board-viewer-3d'] = 'not valid json{{';

    BoardViewer3D.resetForTesting();

    // Should not throw, just use defaults
    const viewer = BoardViewer3D.getInstance();
    expect(viewer.getBoard().width).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Notify
// ---------------------------------------------------------------------------

describe('Subscribe / Notify', () => {
  it('should notify subscribers on state changes', () => {
    const viewer = BoardViewer3D.getInstance();
    const listener = vi.fn();
    viewer.subscribe(listener);

    viewer.setBoard({ width: 50, height: 50, thickness: 1.6, cornerRadius: 0 });
    expect(listener).toHaveBeenCalledTimes(1);

    viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 0, y: 0, z: 0 } });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('should support unsubscribing', () => {
    const viewer = BoardViewer3D.getInstance();
    const listener = vi.fn();
    const unsub = viewer.subscribe(listener);

    viewer.setBoard({ width: 50, height: 50, thickness: 1.6, cornerRadius: 0 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    viewer.setBoard({ width: 60, height: 60, thickness: 1.6, cornerRadius: 0 });
    expect(listener).toHaveBeenCalledTimes(1); // no more calls
  });

  it('should support multiple subscribers', () => {
    const viewer = BoardViewer3D.getInstance();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    viewer.subscribe(listener1);
    viewer.subscribe(listener2);

    viewer.addVia({ position: { x: 0, y: 0 }, drillDiameter: 0.3, outerDiameter: 0.6 });
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('should notify on remove operations', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 0, y: 0, z: 0 } });

    const listener = vi.fn();
    viewer.subscribe(listener);

    viewer.removeComponent(comp.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should not notify on failed remove', () => {
    const viewer = BoardViewer3D.getInstance();
    const listener = vi.fn();
    viewer.subscribe(listener);

    viewer.removeComponent('non-existent');
    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify on clear', () => {
    const viewer = BoardViewer3D.getInstance();
    const listener = vi.fn();
    viewer.subscribe(listener);

    viewer.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Hook shape
// ---------------------------------------------------------------------------

describe('useBoardViewer3D hook shape', () => {
  it('should export the hook', async () => {
    const mod = await import('../board-viewer-3d');
    expect(typeof mod.useBoardViewer3D).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('should handle empty board (no components, vias, traces, or drills)', () => {
    const viewer = BoardViewer3D.getInstance();
    const scene = viewer.buildScene();
    expect(scene.components).toHaveLength(0);
    expect(scene.vias).toHaveLength(0);
    expect(scene.traces).toHaveLength(0);
    expect(scene.drillHoles).toHaveLength(0);
    expect(scene.layers.length).toBeGreaterThan(0);
    expect(scene.board).toBeDefined();
  });

  it('should handle clear and rebuild', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 0, y: 0, z: 0 } });
    viewer.addVia({ position: { x: 5, y: 5 }, drillDiameter: 0.3, outerDiameter: 0.6 });

    viewer.clear();

    expect(viewer.getAllComponents()).toHaveLength(0);
    expect(viewer.getAllVias()).toHaveLength(0);
    expect(viewer.getAllTraces()).toHaveLength(0);
    expect(viewer.getAllDrillHoles()).toHaveLength(0);

    // Board should be reset to defaults
    const board = viewer.getBoard();
    expect(board.width).toBe(100);
    expect(board.height).toBe(80);
  });

  it('should handle component on bottom side with Z-flip in scene', () => {
    const viewer = BoardViewer3D.getInstance();
    viewer.addComponent({
      refDes: 'U1',
      package: 'SOIC-8',
      position: { x: 10, y: 10, z: 0 },
      side: 'bottom',
      bodyDepth: 1.75,
    });

    const scene = viewer.buildScene();
    const comp = scene.components[0];

    // Bottom-side component Z should be negative (below board)
    expect(comp.position.z).toBe(-1.75);
  });

  it('should use fallback dimensions for unknown package', () => {
    const viewer = BoardViewer3D.getInstance();
    const comp = viewer.addComponent({
      refDes: 'X1',
      package: 'UNKNOWN-PACKAGE',
      position: { x: 0, y: 0, z: 0 },
    });
    // Should use default fallback values (5.0, 5.0, 2.0)
    expect(comp.bodyWidth).toBe(5.0);
    expect(comp.bodyHeight).toBe(5.0);
    expect(comp.bodyDepth).toBe(2.0);
  });

  it('should handle singleton correctly', () => {
    const viewer1 = BoardViewer3D.getInstance();
    const viewer2 = BoardViewer3D.getInstance();
    expect(viewer1).toBe(viewer2);
  });

  it('should isolate after resetForTesting', () => {
    const viewer1 = BoardViewer3D.getInstance();
    viewer1.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 0, y: 0, z: 0 } });

    // Clear storage too, to prevent reload
    for (const k of Object.keys(store)) {
      delete store[k];
    }

    BoardViewer3D.resetForTesting();
    const viewer2 = BoardViewer3D.getInstance();
    expect(viewer2).not.toBe(viewer1);
    expect(viewer2.getAllComponents()).toHaveLength(0);
  });

  it('should handle render options merge on import', () => {
    const viewer = BoardViewer3D.getInstance();
    // Import with only partial render options
    const result = viewer.importScene(JSON.stringify({
      renderOptions: { boardColor: '#aabbcc' },
    }));
    expect(result.success).toBe(true);
    const opts = viewer.getRenderOptions();
    expect(opts.boardColor).toBe('#aabbcc');
    // Other options should fall back to defaults
    expect(opts.showComponents).toBe(true);
    expect(opts.copperColor).toBe('#b87333');
  });

  it('should handle multiple sequential adds and removes', () => {
    const viewer = BoardViewer3D.getInstance();

    const c1 = viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', position: { x: 0, y: 0, z: 0 } });
    const c2 = viewer.addComponent({ refDes: 'U2', package: 'DIP-8', position: { x: 10, y: 0, z: 0 } });
    const c3 = viewer.addComponent({ refDes: 'U3', package: '0603', position: { x: 20, y: 0, z: 0 } });

    expect(viewer.getAllComponents()).toHaveLength(3);

    viewer.removeComponent(c2.id);
    expect(viewer.getAllComponents()).toHaveLength(2);
    expect(viewer.getComponent(c1.id)).toBeDefined();
    expect(viewer.getComponent(c2.id)).toBeUndefined();
    expect(viewer.getComponent(c3.id)).toBeDefined();
  });
});
