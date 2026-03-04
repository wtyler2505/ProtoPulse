/**
 * 3D PCB Board Viewer — Data Model & Scene Graph Builder
 *
 * Client-side 3D PCB board visualization engine for mechanical fit verification.
 * Manages the scene graph (board, components, vias, traces, drill holes) and
 * provides camera presets, layer visibility, measurement, and package models.
 *
 * This is the data model and rendering logic — not the actual Three.js rendering
 * (which would be a React component). Think of it as the scene graph builder.
 *
 * Usage:
 *   const viewer = BoardViewer3D.getInstance();
 *   viewer.setBoard({ width: 100, height: 80, thickness: 1.6, cornerRadius: 2 });
 *   viewer.addComponent({ refDes: 'U1', package: 'SOIC-8', ... });
 *   const scene = viewer.buildScene();
 *
 * React hook:
 *   const { board, components, scene, ... } = useBoardViewer3D();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayerType3D =
  | 'top-copper'
  | 'bottom-copper'
  | 'top-silk'
  | 'bottom-silk'
  | 'top-mask'
  | 'bottom-mask'
  | 'substrate'
  | 'internal';

export type ComponentSide = 'top' | 'bottom';

export type ViewAngle = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' | 'isometric';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface BoardDimensions {
  width: number; // mm
  height: number; // mm
  thickness: number; // mm
  cornerRadius: number; // mm
}

export interface Component3D {
  id: string;
  refDes: string;
  package: string;
  position: Point3D;
  rotation: number; // degrees
  side: ComponentSide;
  bodyWidth: number; // mm
  bodyHeight: number; // mm
  bodyDepth: number; // mm — height above board
  color: string;
  pins: Array<{
    id: string;
    position: { x: number; y: number };
    diameter: number;
    type: 'through-hole' | 'smd';
  }>;
  label?: string;
}

export interface Via3D {
  id: string;
  position: { x: number; y: number };
  drillDiameter: number;
  outerDiameter: number;
  startLayer: string;
  endLayer: string;
}

export interface Trace3D {
  id: string;
  points: Array<{ x: number; y: number }>;
  width: number;
  layer: LayerType3D;
}

export interface DrillHole3D {
  id: string;
  position: { x: number; y: number };
  diameter: number;
  plated: boolean;
}

export interface BoardScene {
  board: BoardDimensions;
  layers: Array<{
    type: LayerType3D;
    zOffset: number;
    thickness: number;
    color: string;
    opacity: number;
    visible: boolean;
  }>;
  components: Component3D[];
  vias: Via3D[];
  traces: Trace3D[];
  drillHoles: DrillHole3D[];
}

export interface CameraState {
  position: Point3D;
  target: Point3D;
  up: Point3D;
  fov: number;
  zoom: number;
}

export interface RenderOptions {
  showComponents: boolean;
  showTraces: boolean;
  showVias: boolean;
  showDrills: boolean;
  showSilkscreen: boolean;
  showSolderMask: boolean;
  showBoardEdge: boolean;
  transparentBoard: boolean;
  componentOpacity: number;
  boardColor: string;
  solderMaskColor: string;
  copperColor: string;
  silkscreenColor: string;
  backgroundColor: string;
}

export interface MeasurementResult {
  from: Point3D;
  to: Point3D;
  distance: number;
  dx: number;
  dy: number;
  dz: number;
}

export interface PackageModel {
  name: string;
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
  pinCount: number;
  pinPitch: number;
  pinDiameter: number;
  category: 'smd' | 'through-hole' | 'connector';
  color: string;
}

// ---------------------------------------------------------------------------
// Input types (partial — IDs assigned internally)
// ---------------------------------------------------------------------------

export interface AddComponentInput {
  refDes: string;
  package: string;
  position: Point3D;
  rotation?: number;
  side?: ComponentSide;
  bodyWidth?: number;
  bodyHeight?: number;
  bodyDepth?: number;
  color?: string;
  pins?: Array<{
    position: { x: number; y: number };
    diameter: number;
    type: 'through-hole' | 'smd';
  }>;
  label?: string;
}

export interface AddViaInput {
  position: { x: number; y: number };
  drillDiameter: number;
  outerDiameter: number;
  startLayer?: string;
  endLayer?: string;
}

export interface AddTraceInput {
  points: Array<{ x: number; y: number }>;
  width: number;
  layer: LayerType3D;
}

export interface AddDrillHoleInput {
  position: { x: number; y: number };
  diameter: number;
  plated?: boolean;
}

export interface UpdateComponentInput {
  refDes?: string;
  package?: string;
  position?: Point3D;
  rotation?: number;
  side?: ComponentSide;
  bodyWidth?: number;
  bodyHeight?: number;
  bodyDepth?: number;
  color?: string;
  label?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-board-viewer-3d';

const DEFAULT_BOARD: BoardDimensions = {
  width: 100,
  height: 80,
  thickness: 1.6,
  cornerRadius: 0,
};

const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  showComponents: true,
  showTraces: true,
  showVias: true,
  showDrills: true,
  showSilkscreen: true,
  showSolderMask: true,
  showBoardEdge: true,
  transparentBoard: false,
  componentOpacity: 1.0,
  boardColor: '#2d5016',
  solderMaskColor: '#1a6b1a',
  copperColor: '#b87333',
  silkscreenColor: '#ffffff',
  backgroundColor: '#1a1a2e',
};

// Standard 2-layer board layer stack (Z-offsets in mm, bottom of board at Z=0)
const DEFAULT_LAYER_STACK: Array<{
  type: LayerType3D;
  zOffset: number;
  thickness: number;
  color: string;
  opacity: number;
}> = [
  { type: 'bottom-silk', zOffset: -0.02, thickness: 0.01, color: '#ffffff', opacity: 0.9 },
  { type: 'bottom-mask', zOffset: -0.01, thickness: 0.01, color: '#1a6b1a', opacity: 0.8 },
  { type: 'bottom-copper', zOffset: 0.0, thickness: 0.035, color: '#b87333', opacity: 1.0 },
  { type: 'substrate', zOffset: 0.035, thickness: 1.53, color: '#2d5016', opacity: 1.0 },
  { type: 'top-copper', zOffset: 1.565, thickness: 0.035, color: '#b87333', opacity: 1.0 },
  { type: 'top-mask', zOffset: 1.6, thickness: 0.01, color: '#1a6b1a', opacity: 0.8 },
  { type: 'top-silk', zOffset: 1.61, thickness: 0.01, color: '#ffffff', opacity: 0.9 },
];

// ---------------------------------------------------------------------------
// Built-in package models (15 standard packages)
// ---------------------------------------------------------------------------

const BUILTIN_PACKAGES: PackageModel[] = [
  // DIP through-hole
  { name: 'DIP-8', bodyWidth: 9.53, bodyHeight: 6.35, bodyDepth: 3.3, pinCount: 8, pinPitch: 2.54, pinDiameter: 0.5, category: 'through-hole', color: '#1a1a1a' },
  { name: 'DIP-14', bodyWidth: 19.05, bodyHeight: 6.35, bodyDepth: 3.3, pinCount: 14, pinPitch: 2.54, pinDiameter: 0.5, category: 'through-hole', color: '#1a1a1a' },
  { name: 'DIP-28', bodyWidth: 35.56, bodyHeight: 6.35, bodyDepth: 3.3, pinCount: 28, pinPitch: 2.54, pinDiameter: 0.5, category: 'through-hole', color: '#1a1a1a' },
  // SOIC SMD
  { name: 'SOIC-8', bodyWidth: 4.9, bodyHeight: 3.9, bodyDepth: 1.75, pinCount: 8, pinPitch: 1.27, pinDiameter: 0.3, category: 'smd', color: '#1a1a1a' },
  { name: 'SOIC-16', bodyWidth: 9.9, bodyHeight: 3.9, bodyDepth: 1.75, pinCount: 16, pinPitch: 1.27, pinDiameter: 0.3, category: 'smd', color: '#1a1a1a' },
  // SOT
  { name: 'SOT-23', bodyWidth: 2.9, bodyHeight: 1.3, bodyDepth: 1.1, pinCount: 3, pinPitch: 0.95, pinDiameter: 0.25, category: 'smd', color: '#1a1a1a' },
  { name: 'SOT-223', bodyWidth: 6.5, bodyHeight: 3.5, bodyDepth: 1.8, pinCount: 4, pinPitch: 2.3, pinDiameter: 0.4, category: 'smd', color: '#1a1a1a' },
  // QFP
  { name: 'QFP-32', bodyWidth: 7.0, bodyHeight: 7.0, bodyDepth: 1.4, pinCount: 32, pinPitch: 0.8, pinDiameter: 0.25, category: 'smd', color: '#1a1a1a' },
  { name: 'QFP-48', bodyWidth: 9.0, bodyHeight: 9.0, bodyDepth: 1.4, pinCount: 48, pinPitch: 0.5, pinDiameter: 0.2, category: 'smd', color: '#1a1a1a' },
  { name: 'TQFP-44', bodyWidth: 10.0, bodyHeight: 10.0, bodyDepth: 1.0, pinCount: 44, pinPitch: 0.8, pinDiameter: 0.25, category: 'smd', color: '#1a1a1a' },
  // TO
  { name: 'TO-220', bodyWidth: 10.0, bodyHeight: 4.5, bodyDepth: 15.0, pinCount: 3, pinPitch: 2.54, pinDiameter: 0.7, category: 'through-hole', color: '#333333' },
  // Passives (chip)
  { name: '0402', bodyWidth: 1.0, bodyHeight: 0.5, bodyDepth: 0.35, pinCount: 2, pinPitch: 0.5, pinDiameter: 0.15, category: 'smd', color: '#8b7355' },
  { name: '0603', bodyWidth: 1.6, bodyHeight: 0.8, bodyDepth: 0.45, pinCount: 2, pinPitch: 0.8, pinDiameter: 0.2, category: 'smd', color: '#8b7355' },
  { name: '0805', bodyWidth: 2.0, bodyHeight: 1.25, bodyDepth: 0.5, pinCount: 2, pinPitch: 1.0, pinDiameter: 0.25, category: 'smd', color: '#8b7355' },
  { name: '1206', bodyWidth: 3.2, bodyHeight: 1.6, bodyDepth: 0.55, pinCount: 2, pinPitch: 1.6, pinDiameter: 0.3, category: 'smd', color: '#8b7355' },
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// BoardViewer3D
// ---------------------------------------------------------------------------

/**
 * Manages the 3D board scene graph with components, vias, traces, and drill holes.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists to localStorage.
 */
export class BoardViewer3D {
  private static instance: BoardViewer3D | null = null;

  private board: BoardDimensions;
  private components = new Map<string, Component3D>();
  private vias = new Map<string, Via3D>();
  private traces = new Map<string, Trace3D>();
  private drillHoles = new Map<string, DrillHole3D>();
  private packageModels = new Map<string, PackageModel>();
  private renderOptions: RenderOptions;
  private layerVisibility = new Map<LayerType3D, boolean>();
  private listeners = new Set<Listener>();

  constructor() {
    this.board = { ...DEFAULT_BOARD };
    this.renderOptions = { ...DEFAULT_RENDER_OPTIONS };

    // Initialize built-in package models
    BUILTIN_PACKAGES.forEach((pkg) => {
      this.packageModels.set(pkg.name, { ...pkg });
    });

    // Initialize layer visibility (all visible by default)
    DEFAULT_LAYER_STACK.forEach((layer) => {
      this.layerVisibility.set(layer.type, true);
    });

    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): BoardViewer3D {
    if (!BoardViewer3D.instance) {
      BoardViewer3D.instance = new BoardViewer3D();
    }
    return BoardViewer3D.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    BoardViewer3D.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any mutation.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Board
  // -----------------------------------------------------------------------

  /** Set board dimensions. */
  setBoard(dimensions: BoardDimensions): void {
    this.board = { ...dimensions };
    this.save();
    this.notify();
  }

  /** Get current board dimensions. */
  getBoard(): BoardDimensions {
    return { ...this.board };
  }

  /** Set the board color in render options. */
  setBoardColor(color: string): void {
    this.renderOptions.boardColor = color;
    this.save();
    this.notify();
  }

  /** Set the solder mask color in render options. */
  setSolderMaskColor(color: string): void {
    this.renderOptions.solderMaskColor = color;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Components
  // -----------------------------------------------------------------------

  /** Add a component to the board. Returns the created Component3D. */
  addComponent(input: AddComponentInput): Component3D {
    const pkg = this.packageModels.get(input.package);
    const id = crypto.randomUUID();

    const component: Component3D = {
      id,
      refDes: input.refDes,
      package: input.package,
      position: { ...input.position },
      rotation: input.rotation ?? 0,
      side: input.side ?? 'top',
      bodyWidth: input.bodyWidth ?? pkg?.bodyWidth ?? 5.0,
      bodyHeight: input.bodyHeight ?? pkg?.bodyHeight ?? 5.0,
      bodyDepth: input.bodyDepth ?? pkg?.bodyDepth ?? 2.0,
      color: input.color ?? pkg?.color ?? '#1a1a1a',
      pins: (input.pins ?? []).map((p) => ({
        id: crypto.randomUUID(),
        position: { ...p.position },
        diameter: p.diameter,
        type: p.type,
      })),
      label: input.label,
    };

    this.components.set(id, component);
    this.save();
    this.notify();
    return { ...component };
  }

  /** Remove a component by ID. Returns true if removed. */
  removeComponent(id: string): boolean {
    const deleted = this.components.delete(id);
    if (deleted) {
      this.save();
      this.notify();
    }
    return deleted;
  }

  /** Update a component. Returns true if found and updated. */
  updateComponent(id: string, updates: UpdateComponentInput): boolean {
    const component = this.components.get(id);
    if (!component) {
      return false;
    }

    if (updates.refDes !== undefined) {
      component.refDes = updates.refDes;
    }
    if (updates.package !== undefined) {
      component.package = updates.package;
    }
    if (updates.position !== undefined) {
      component.position = { ...updates.position };
    }
    if (updates.rotation !== undefined) {
      component.rotation = updates.rotation;
    }
    if (updates.side !== undefined) {
      component.side = updates.side;
    }
    if (updates.bodyWidth !== undefined) {
      component.bodyWidth = updates.bodyWidth;
    }
    if (updates.bodyHeight !== undefined) {
      component.bodyHeight = updates.bodyHeight;
    }
    if (updates.bodyDepth !== undefined) {
      component.bodyDepth = updates.bodyDepth;
    }
    if (updates.color !== undefined) {
      component.color = updates.color;
    }
    if (updates.label !== undefined) {
      component.label = updates.label === null ? undefined : updates.label;
    }

    this.save();
    this.notify();
    return true;
  }

  /** Get a component by ID. Returns undefined if not found. */
  getComponent(id: string): Component3D | undefined {
    const c = this.components.get(id);
    return c ? { ...c } : undefined;
  }

  /** Get all components. */
  getAllComponents(): Component3D[] {
    const result: Component3D[] = [];
    this.components.forEach((c) => {
      result.push({ ...c });
    });
    return result;
  }

  /** Get components on a specific side of the board. */
  getComponentsBySide(side: ComponentSide): Component3D[] {
    const result: Component3D[] = [];
    this.components.forEach((c) => {
      if (c.side === side) {
        result.push({ ...c });
      }
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Vias
  // -----------------------------------------------------------------------

  /** Add a via. Returns the created Via3D. */
  addVia(input: AddViaInput): Via3D {
    const id = crypto.randomUUID();
    const via: Via3D = {
      id,
      position: { ...input.position },
      drillDiameter: input.drillDiameter,
      outerDiameter: input.outerDiameter,
      startLayer: input.startLayer ?? 'top-copper',
      endLayer: input.endLayer ?? 'bottom-copper',
    };
    this.vias.set(id, via);
    this.save();
    this.notify();
    return { ...via };
  }

  /** Remove a via by ID. Returns true if removed. */
  removeVia(id: string): boolean {
    const deleted = this.vias.delete(id);
    if (deleted) {
      this.save();
      this.notify();
    }
    return deleted;
  }

  /** Get all vias. */
  getAllVias(): Via3D[] {
    const result: Via3D[] = [];
    this.vias.forEach((v) => {
      result.push({ ...v });
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Traces
  // -----------------------------------------------------------------------

  /** Add a trace. Returns the created Trace3D. */
  addTrace(input: AddTraceInput): Trace3D {
    const id = crypto.randomUUID();
    const trace: Trace3D = {
      id,
      points: input.points.map((p) => ({ ...p })),
      width: input.width,
      layer: input.layer,
    };
    this.traces.set(id, trace);
    this.save();
    this.notify();
    return { ...trace };
  }

  /** Remove a trace by ID. Returns true if removed. */
  removeTrace(id: string): boolean {
    const deleted = this.traces.delete(id);
    if (deleted) {
      this.save();
      this.notify();
    }
    return deleted;
  }

  /** Get all traces. */
  getAllTraces(): Trace3D[] {
    const result: Trace3D[] = [];
    this.traces.forEach((t) => {
      result.push({ ...t });
    });
    return result;
  }

  /** Get traces on a specific layer. */
  getTracesByLayer(layer: LayerType3D): Trace3D[] {
    const result: Trace3D[] = [];
    this.traces.forEach((t) => {
      if (t.layer === layer) {
        result.push({ ...t });
      }
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Drill Holes
  // -----------------------------------------------------------------------

  /** Add a drill hole. Returns the created DrillHole3D. */
  addDrillHole(input: AddDrillHoleInput): DrillHole3D {
    const id = crypto.randomUUID();
    const hole: DrillHole3D = {
      id,
      position: { ...input.position },
      diameter: input.diameter,
      plated: input.plated ?? false,
    };
    this.drillHoles.set(id, hole);
    this.save();
    this.notify();
    return { ...hole };
  }

  /** Remove a drill hole by ID. Returns true if removed. */
  removeDrillHole(id: string): boolean {
    const deleted = this.drillHoles.delete(id);
    if (deleted) {
      this.save();
      this.notify();
    }
    return deleted;
  }

  /** Get all drill holes. */
  getAllDrillHoles(): DrillHole3D[] {
    const result: DrillHole3D[] = [];
    this.drillHoles.forEach((h) => {
      result.push({ ...h });
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Scene Builder
  // -----------------------------------------------------------------------

  /** Build the complete 3D scene with computed layer Z-offsets and positioned components. */
  buildScene(): BoardScene {
    const layers = DEFAULT_LAYER_STACK.map((layer) => ({
      type: layer.type,
      zOffset: layer.zOffset,
      thickness: layer.thickness,
      color: this.getLayerColor(layer.type),
      opacity: layer.opacity,
      visible: this.layerVisibility.get(layer.type) ?? true,
    }));

    // Position components: top-side components sit on top of the board,
    // bottom-side components hang below
    const components: Component3D[] = [];
    this.components.forEach((c) => {
      const positioned = { ...c };
      if (c.side === 'bottom') {
        // Bottom-side components: Z position is flipped below the board
        positioned.position = {
          x: c.position.x,
          y: c.position.y,
          z: -c.bodyDepth,
        };
      } else {
        // Top-side components sit on top of the board
        positioned.position = {
          x: c.position.x,
          y: c.position.y,
          z: this.board.thickness,
        };
      }
      components.push(positioned);
    });

    const vias = this.getAllVias();
    const traces = this.getAllTraces();
    const drillHoles = this.getAllDrillHoles();

    return {
      board: { ...this.board },
      layers,
      components,
      vias,
      traces,
      drillHoles,
    };
  }

  /** Get the color for a layer type based on render options. */
  private getLayerColor(type: LayerType3D): string {
    switch (type) {
      case 'top-copper':
      case 'bottom-copper':
        return this.renderOptions.copperColor;
      case 'top-silk':
      case 'bottom-silk':
        return this.renderOptions.silkscreenColor;
      case 'top-mask':
      case 'bottom-mask':
        return this.renderOptions.solderMaskColor;
      case 'substrate':
        return this.renderOptions.boardColor;
      case 'internal':
        return this.renderOptions.copperColor;
    }
  }

  // -----------------------------------------------------------------------
  // Camera
  // -----------------------------------------------------------------------

  /** Get a pre-set camera state for a given view angle. */
  getCameraForView(angle: ViewAngle): CameraState {
    const cx = this.board.width / 2;
    const cy = this.board.height / 2;
    const cz = this.board.thickness / 2;
    const dist = Math.max(this.board.width, this.board.height) * 1.5;

    const target: Point3D = { x: cx, y: cy, z: cz };
    const upY: Point3D = { x: 0, y: 1, z: 0 };
    const upZ: Point3D = { x: 0, y: 0, z: 1 };

    switch (angle) {
      case 'top':
        return { position: { x: cx, y: cy, z: dist }, target, up: upY, fov: 45, zoom: 1 };
      case 'bottom':
        return { position: { x: cx, y: cy, z: -dist }, target, up: upY, fov: 45, zoom: 1 };
      case 'front':
        return { position: { x: cx, y: -dist, z: cz }, target, up: upZ, fov: 45, zoom: 1 };
      case 'back':
        return { position: { x: cx, y: dist, z: cz }, target, up: upZ, fov: 45, zoom: 1 };
      case 'left':
        return { position: { x: -dist, y: cy, z: cz }, target, up: upZ, fov: 45, zoom: 1 };
      case 'right':
        return { position: { x: dist, y: cy, z: cz }, target, up: upZ, fov: 45, zoom: 1 };
      case 'isometric':
        return {
          position: {
            x: cx + dist * 0.577,
            y: cy - dist * 0.577,
            z: cz + dist * 0.577,
          },
          target,
          up: upZ,
          fov: 45,
          zoom: 1,
        };
    }
  }

  // -----------------------------------------------------------------------
  // Render Options
  // -----------------------------------------------------------------------

  /** Set render options (partial update). */
  setRenderOptions(options: Partial<RenderOptions>): void {
    this.renderOptions = { ...this.renderOptions, ...options };
    this.save();
    this.notify();
  }

  /** Get current render options. */
  getRenderOptions(): RenderOptions {
    return { ...this.renderOptions };
  }

  // -----------------------------------------------------------------------
  // Layer Visibility
  // -----------------------------------------------------------------------

  /** Set visibility of a layer type. */
  setLayerVisible(type: LayerType3D, visible: boolean): void {
    this.layerVisibility.set(type, visible);
    this.save();
    this.notify();
  }

  /** Get all currently visible layer types. */
  getVisibleLayers(): LayerType3D[] {
    const result: LayerType3D[] = [];
    this.layerVisibility.forEach((visible, type) => {
      if (visible) {
        result.push(type);
      }
    });
    return result;
  }

  // -----------------------------------------------------------------------
  // Measurements
  // -----------------------------------------------------------------------

  /** Measure the 3D distance between two points. */
  measureDistance(from: Point3D, to: Point3D): MeasurementResult {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return {
      from: { ...from },
      to: { ...to },
      distance,
      dx,
      dy,
      dz,
    };
  }

  // -----------------------------------------------------------------------
  // Package Models
  // -----------------------------------------------------------------------

  /** Get a package model by name. */
  getPackageModel(name: string): PackageModel | undefined {
    const model = this.packageModels.get(name);
    return model ? { ...model } : undefined;
  }

  /** Get all available package models. */
  getAllPackageModels(): PackageModel[] {
    const result: PackageModel[] = [];
    this.packageModels.forEach((m) => {
      result.push({ ...m });
    });
    return result;
  }

  /** Add or replace a package model. */
  addPackageModel(model: PackageModel): void {
    this.packageModels.set(model.name, { ...model });
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export the full scene state as a JSON string. */
  exportScene(): string {
    const data = {
      board: this.board,
      components: this.getAllComponents(),
      vias: this.getAllVias(),
      traces: this.getAllTraces(),
      drillHoles: this.getAllDrillHoles(),
      renderOptions: this.renderOptions,
    };
    return JSON.stringify(data, null, 2);
  }

  /** Import a scene from a JSON string. Returns success status and any errors. */
  importScene(json: string): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { success: false, errors: ['Invalid JSON'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, errors: ['Expected a JSON object'] };
    }

    const data = parsed as Record<string, unknown>;

    // Validate board
    if (data.board !== undefined) {
      const b = data.board as Record<string, unknown>;
      if (
        typeof b.width !== 'number' ||
        typeof b.height !== 'number' ||
        typeof b.thickness !== 'number' ||
        typeof b.cornerRadius !== 'number'
      ) {
        errors.push('Invalid board dimensions: width, height, thickness, and cornerRadius must be numbers');
      }
    }

    // Validate components
    if (data.components !== undefined && !Array.isArray(data.components)) {
      errors.push('Components must be an array');
    }

    // Validate vias
    if (data.vias !== undefined && !Array.isArray(data.vias)) {
      errors.push('Vias must be an array');
    }

    // Validate traces
    if (data.traces !== undefined && !Array.isArray(data.traces)) {
      errors.push('Traces must be an array');
    }

    // Validate drillHoles
    if (data.drillHoles !== undefined && !Array.isArray(data.drillHoles)) {
      errors.push('Drill holes must be an array');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply the import
    if (data.board !== undefined) {
      this.board = data.board as BoardDimensions;
    }

    if (Array.isArray(data.components)) {
      this.components.clear();
      (data.components as Component3D[]).forEach((c) => {
        this.components.set(c.id, c);
      });
    }

    if (Array.isArray(data.vias)) {
      this.vias.clear();
      (data.vias as Via3D[]).forEach((v) => {
        this.vias.set(v.id, v);
      });
    }

    if (Array.isArray(data.traces)) {
      this.traces.clear();
      (data.traces as Trace3D[]).forEach((t) => {
        this.traces.set(t.id, t);
      });
    }

    if (Array.isArray(data.drillHoles)) {
      this.drillHoles.clear();
      (data.drillHoles as DrillHole3D[]).forEach((h) => {
        this.drillHoles.set(h.id, h);
      });
    }

    if (data.renderOptions !== undefined && typeof data.renderOptions === 'object') {
      this.renderOptions = { ...DEFAULT_RENDER_OPTIONS, ...(data.renderOptions as Partial<RenderOptions>) };
    }

    this.save();
    this.notify();
    return { success: true, errors: [] };
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Clear all scene data, resetting to defaults. */
  clear(): void {
    this.board = { ...DEFAULT_BOARD };
    this.components.clear();
    this.vias.clear();
    this.traces.clear();
    this.drillHoles.clear();
    this.renderOptions = { ...DEFAULT_RENDER_OPTIONS };

    // Reset layer visibility
    DEFAULT_LAYER_STACK.forEach((layer) => {
      this.layerVisibility.set(layer.type, true);
    });

    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist state to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data = {
        board: this.board,
        components: this.getAllComponents(),
        vias: this.getAllVias(),
        traces: this.getAllTraces(),
        drillHoles: this.getAllDrillHoles(),
        renderOptions: this.renderOptions,
        layerVisibility: Object.fromEntries(this.layerVisibility),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load state from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Load board
      if (data.board !== undefined && typeof data.board === 'object') {
        const b = data.board as Record<string, unknown>;
        if (
          typeof b.width === 'number' &&
          typeof b.height === 'number' &&
          typeof b.thickness === 'number' &&
          typeof b.cornerRadius === 'number'
        ) {
          this.board = data.board as BoardDimensions;
        }
      }

      // Load components
      if (Array.isArray(data.components)) {
        this.components.clear();
        (data.components as Component3D[]).forEach((c) => {
          if (typeof c.id === 'string' && typeof c.refDes === 'string') {
            this.components.set(c.id, c);
          }
        });
      }

      // Load vias
      if (Array.isArray(data.vias)) {
        this.vias.clear();
        (data.vias as Via3D[]).forEach((v) => {
          if (typeof v.id === 'string') {
            this.vias.set(v.id, v);
          }
        });
      }

      // Load traces
      if (Array.isArray(data.traces)) {
        this.traces.clear();
        (data.traces as Trace3D[]).forEach((t) => {
          if (typeof t.id === 'string') {
            this.traces.set(t.id, t);
          }
        });
      }

      // Load drill holes
      if (Array.isArray(data.drillHoles)) {
        this.drillHoles.clear();
        (data.drillHoles as DrillHole3D[]).forEach((h) => {
          if (typeof h.id === 'string') {
            this.drillHoles.set(h.id, h);
          }
        });
      }

      // Load render options
      if (data.renderOptions !== undefined && typeof data.renderOptions === 'object') {
        this.renderOptions = { ...DEFAULT_RENDER_OPTIONS, ...(data.renderOptions as Partial<RenderOptions>) };
      }

      // Load layer visibility
      if (data.layerVisibility !== undefined && typeof data.layerVisibility === 'object') {
        const vis = data.layerVisibility as Record<string, boolean>;
        Object.entries(vis).forEach(([key, value]) => {
          if (typeof value === 'boolean') {
            this.layerVisibility.set(key as LayerType3D, value);
          }
        });
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the 3D board viewer in React components.
 * Subscribes to the BoardViewer3D singleton and triggers re-renders on state changes.
 */
export function useBoardViewer3D(): {
  board: BoardDimensions;
  setBoard: (dimensions: BoardDimensions) => void;
  components: Component3D[];
  addComponent: (input: AddComponentInput) => Component3D;
  removeComponent: (id: string) => boolean;
  vias: Via3D[];
  traces: Trace3D[];
  drillHoles: DrillHole3D[];
  scene: BoardScene;
  cameraForView: (angle: ViewAngle) => CameraState;
  renderOptions: RenderOptions;
  setRenderOptions: (options: Partial<RenderOptions>) => void;
  layerVisibility: LayerType3D[];
  measureDistance: (from: Point3D, to: Point3D) => MeasurementResult;
  packageModels: PackageModel[];
  exportScene: () => string;
  importScene: (json: string) => { success: boolean; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const viewer = BoardViewer3D.getInstance();
    const unsubscribe = viewer.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const setBoard = useCallback((dimensions: BoardDimensions) => {
    BoardViewer3D.getInstance().setBoard(dimensions);
  }, []);

  const addComponent = useCallback((input: AddComponentInput) => {
    return BoardViewer3D.getInstance().addComponent(input);
  }, []);

  const removeComponent = useCallback((id: string) => {
    return BoardViewer3D.getInstance().removeComponent(id);
  }, []);

  const cameraForView = useCallback((angle: ViewAngle) => {
    return BoardViewer3D.getInstance().getCameraForView(angle);
  }, []);

  const setRenderOptions = useCallback((options: Partial<RenderOptions>) => {
    BoardViewer3D.getInstance().setRenderOptions(options);
  }, []);

  const measureDistance = useCallback((from: Point3D, to: Point3D) => {
    return BoardViewer3D.getInstance().measureDistance(from, to);
  }, []);

  const exportSceneFn = useCallback(() => {
    return BoardViewer3D.getInstance().exportScene();
  }, []);

  const importSceneFn = useCallback((json: string) => {
    return BoardViewer3D.getInstance().importScene(json);
  }, []);

  const viewer = typeof window !== 'undefined' ? BoardViewer3D.getInstance() : null;

  return {
    board: viewer?.getBoard() ?? { ...DEFAULT_BOARD },
    setBoard,
    components: viewer?.getAllComponents() ?? [],
    addComponent,
    removeComponent,
    vias: viewer?.getAllVias() ?? [],
    traces: viewer?.getAllTraces() ?? [],
    drillHoles: viewer?.getAllDrillHoles() ?? [],
    scene: viewer?.buildScene() ?? {
      board: { ...DEFAULT_BOARD },
      layers: [],
      components: [],
      vias: [],
      traces: [],
      drillHoles: [],
    },
    cameraForView,
    renderOptions: viewer?.getRenderOptions() ?? { ...DEFAULT_RENDER_OPTIONS },
    setRenderOptions,
    layerVisibility: viewer?.getVisibleLayers() ?? [],
    measureDistance,
    packageModels: viewer?.getAllPackageModels() ?? [],
    exportScene: exportSceneFn,
    importScene: importSceneFn,
  };
}
