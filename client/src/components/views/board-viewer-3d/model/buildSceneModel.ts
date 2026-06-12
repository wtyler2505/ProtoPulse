/**
 * buildSceneModel — PURE project-data → SceneModel transform (PP3D-3).
 *
 * This is the "real scene bridge" from the upgrade plan (§4/§6): a deterministic
 * function that turns the raw `boards` row + circuit instances/wires/vias/nets
 * into the three.js-free {@link SceneModel} the R3F scene renders. It is seeded
 * from the original in-component `mapTo3D*` logic (formerly in
 * `BoardViewer3DView.tsx`) but is now:
 *   - PURE: no three.js imports, no singleton mutation, no localStorage.
 *   - DETERMINISTIC: stable ids derived from source rows (NO `crypto.randomUUID`),
 *     so memoisation, instancing keys, and selection survive re-renders.
 *
 * Geometry numbers (extrude params, ribbon widths, cylinder radii) are produced
 * as plain descriptors here; the actual `THREE.BufferGeometry` is built in
 * `geometry.ts` from these descriptors in the R3F layer.
 *
 * The footprint resolver is injected (defaulting to `FootprintLibrary`) so the
 * transform stays decoupled and a test can supply deterministic fixtures.
 */


import type { Footprint } from '@/lib/pcb/footprint-library';
import { FootprintLibrary } from '@/lib/pcb/footprint-library';

import type { CircuitInstanceRow, CircuitNetRow, CircuitViaRow, CircuitWireRow } from '@shared/schema';

import { buildLayerStack } from './layer-stack';
import { getPackageHeight } from './package-heights';

import type {
  MaterialKey,
  SceneBoard,
  SceneComponent,
  SceneDrillHole,
  SceneModel,
  ScenePad,
  SceneTrace,
  SceneVia,
} from './scene-model';

// ---------------------------------------------------------------------------
// Input contract
// ---------------------------------------------------------------------------

/** The minimal board shape the transform needs (subset of `boards` row). */
export interface BuildSceneBoard {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  cornerRadiusMm: number;
  layers: number;
  finish: string;
  solderMaskColor: string;
  silkscreenColor: string;
}

/** Resolves a package name to a footprint (or null). Defaults to the library. */
export type FootprintResolver = (packageType: string) => Footprint | null;

export interface BuildSceneModelInput {
  board: BuildSceneBoard;
  instances: CircuitInstanceRow[];
  wires: CircuitWireRow[];
  vias: CircuitViaRow[];
  /** Circuit nets — used to resolve `netId` → net name on traces/vias (PP3D-5). */
  nets?: CircuitNetRow[];
  /** Optional injectable footprint resolver (defaults to FootprintLibrary). */
  resolveFootprint?: FootprintResolver;
}

// ---------------------------------------------------------------------------
// Colour maps (Board enum value → sRGB hex)
// ---------------------------------------------------------------------------

const MASK_COLOR_HEX: Readonly<Record<string, string>> = {
  green: '#1a6b1a',
  red: '#7a1f1f',
  blue: '#1f3f7a',
  black: '#141414',
  white: '#e8e8e8',
  yellow: '#c7b21f',
  purple: '#4a1f6b',
  'matte-black': '#0d0d0d',
  'matte-green': '#16551a',
};

const SILK_COLOR_HEX: Readonly<Record<string, string>> = {
  white: '#f5f5f5',
  black: '#141414',
  yellow: '#d6c233',
  red: '#c43838',
};

/** Map a board surface finish to the exposed-pad metal material. */
function finishToPadMaterial(finish: string): MaterialKey {
  const f = finish.toUpperCase();
  if (f === 'ENIG' || f === 'ENEPIG' || f === 'IMMERSION_SILVER') {
    return 'gold';
  }
  if (f === 'HASL' || f === 'IMMERSION_TIN') {
    return 'tin';
  }
  // OSP leaves bare copper.
  return 'copper';
}

// ---------------------------------------------------------------------------
// Component package / body resolution (seeded from original mapTo3D logic)
// ---------------------------------------------------------------------------

const DEFAULT_BODY_EXTENT_MM = 5.0;

/** Coarse package guess from refDes when properties carry no packageType. */
function guessPackageFromRefDes(refDes: string): string {
  const ref = refDes.toUpperCase();
  if (ref.startsWith('U') || ref.startsWith('IC')) return 'SOIC-8';
  if (ref.startsWith('R') || ref.startsWith('C')) return '0603';
  if (ref.startsWith('Q')) return 'SOT-23';
  return 'SOIC-8';
}

function resolvePackage(
  inst: CircuitInstanceRow,
  resolveFootprint: FootprintResolver,
): string {
  const props = inst.properties as Record<string, unknown>;
  const declared = props.packageType;
  if (typeof declared === 'string' && declared && resolveFootprint(declared)) {
    return declared;
  }
  return guessPackageFromRefDes(inst.referenceDesignator);
}

/** Material key for a component body, by package family. */
function bodyMaterialForPackage(pkg: string): MaterialKey {
  const c = pkg.trim().toUpperCase();
  if (/^\d{4}$/.test(c) || c.startsWith('SOD') || c.startsWith('SMA')) {
    return 'body-passive';
  }
  if (c.startsWith('CONN') || c.startsWith('HDR') || c.startsWith('JST') || c.startsWith('USB')) {
    return 'body-connector';
  }
  return 'body-ic';
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Map a raw circuit point (top-left mm space, y down) into centred scene space
 * (x = width centred on 0, z = depth centred on 0). The board occupies
 * [-w/2, w/2] × [-h/2, h/2].
 */
function toScene(
  x: number,
  y: number,
  widthMm: number,
  heightMm: number,
): { x: number; z: number } {
  return { x: x - widthMm / 2, z: y - heightMm / 2 };
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/**
 * Build the deterministic {@link SceneModel} for a board + its circuit data.
 *
 * Honours the gotcha "render the scene shell if traces/vias/components exist,
 * not just on components": the board substrate + stack are ALWAYS produced, so
 * an empty project still yields a valid, renderable shell (with `isEmpty:true`).
 */
export function buildSceneModel(input: BuildSceneModelInput): SceneModel {
  const { board, instances, wires, vias } = input;
  const netNameById = new Map<number, string>((input.nets ?? []).map((n) => [n.id, n.name]));
  const resolveFootprint = input.resolveFootprint ?? ((p) => FootprintLibrary.getFootprint(p));

  const widthMm = board.widthMm;
  const heightMm = board.heightMm;
  const thicknessMm = board.thicknessMm;
  const halfThickness = thicknessMm / 2;

  const maskColor = MASK_COLOR_HEX[board.solderMaskColor] ?? MASK_COLOR_HEX.green;
  const silkColor = SILK_COLOR_HEX[board.silkscreenColor] ?? SILK_COLOR_HEX.white;
  const padMaterial = finishToPadMaterial(board.finish);

  const stack = buildLayerStack(board.layers, thicknessMm, maskColor);

  const sceneBoard: SceneBoard = {
    widthMm,
    heightMm,
    thicknessMm,
    cornerRadiusMm: board.cornerRadiusMm,
    layerCount: stack.layerCount,
    maskColor,
    silkColor,
    finish: board.finish,
    padMaterial,
  };

  // --- Components (only those placed on the PCB) ---
  const components: SceneComponent[] = [];
  const pads: ScenePad[] = [];

  const placed = instances.filter((i) => i.pcbX !== null && i.pcbY !== null);
  for (const inst of placed) {
    const pkg = resolvePackage(inst, resolveFootprint);
    const footprint = resolveFootprint(pkg);
    const bodyW = footprint?.boundingBox.width ?? DEFAULT_BODY_EXTENT_MM;
    const bodyD = footprint?.boundingBox.height ?? DEFAULT_BODY_EXTENT_MM;
    const bodyH = getPackageHeight(pkg);
    const side: 'top' | 'bottom' = inst.pcbSide === 'back' ? 'bottom' : 'top';
    const material = bodyMaterialForPackage(pkg);

    // pcbX/pcbY are guaranteed non-null by the filter above; the guard keeps
    // the types honest without non-null assertions.
    const { pcbX, pcbY } = inst;
    if (pcbX === null || pcbY === null) continue;
    const { x, z } = toScene(pcbX, pcbY, widthMm, heightMm);

    const componentId = `circuit-instance-${inst.id}`;
    const props = inst.properties as Record<string, unknown>;
    const propString = (key: string): string | undefined => {
      const v = props[key];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'number') return String(v);
      return undefined;
    };
    components.push({
      id: componentId,
      refDes: inst.referenceDesignator,
      package: pkg,
      value: propString('value'),
      datasheetUrl: propString('datasheetUrl') ?? propString('datasheet'),
      supplier: propString('supplier') ?? propString('manufacturer'),
      x,
      z,
      rotationDeg: inst.pcbRotation ?? inst.schematicRotation,
      side,
      bodyW,
      bodyD,
      bodyH,
      color: material === 'body-passive' ? '#8b7355' : '#1a1a1a',
      material,
    });

    // Pads from footprint, positioned relative to the component centre.
    if (footprint && footprint.pads.length > 0) {
      for (const pad of footprint.pads) {
        pads.push({
          id: `${componentId}-pad-${pad.number}`,
          componentId,
          x: x + pad.position.x,
          z: z + pad.position.y,
          diameter: Math.max(pad.width || 0.6, pad.height || 0.6),
          through: pad.type === 'tht',
          side,
          material: padMaterial,
        });
      }
    }
  }

  // --- Traces (PCB-view wires only) ---
  const traces: SceneTrace[] = [];
  const pcbWires = wires.filter((w) => w.view === 'pcb' || !w.view);
  for (const wire of pcbWires) {
    const rawPoints = (wire.points as { x: number; y: number }[] | null) ?? [];
    if (rawPoints.length < 2) {
      continue;
    }
    const side: 'top' | 'bottom' = wire.layer === 'back' || wire.layer === 'bottom' ? 'bottom' : 'top';
    traces.push({
      id: `circuit-wire-${wire.id}`,
      points: rawPoints.map((p) => toScene(p.x, p.y, widthMm, heightMm)),
      width: wire.width,
      side,
      // Copper sits just proud of the board face on the chosen side.
      y: side === 'top' ? halfThickness : -halfThickness,
      material: 'copper',
      netName: netNameById.get(wire.netId),
    });
  }

  // --- Vias (all circuit vias are PCB-relevant) ---
  const sceneVias: SceneVia[] = vias.map((via): SceneVia => {
    const { x, z } = toScene(via.x, via.y, widthMm, heightMm);
    return {
      id: `circuit-via-${via.id}`,
      x,
      z,
      drillDiameter: via.drillDiameter,
      outerDiameter: via.outerDiameter,
      yBottom: -halfThickness,
      yTop: halfThickness,
      material: padMaterial,
      netName: netNameById.get(via.netId),
    };
  });

  // --- Drill holes (none derived from circuit data yet — reserved) ---
  const drillHoles: SceneDrillHole[] = [];

  const isEmpty =
    components.length === 0 &&
    traces.length === 0 &&
    sceneVias.length === 0 &&
    drillHoles.length === 0;

  return {
    board: sceneBoard,
    stack,
    components,
    pads,
    traces,
    vias: sceneVias,
    drillHoles,
    isEmpty,
  };
}
