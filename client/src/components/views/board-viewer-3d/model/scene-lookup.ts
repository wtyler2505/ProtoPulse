/**
 * scene-lookup — PURE selection/lookup helpers over a {@link SceneModel} (PP3D-5).
 *
 * The raycast layer (drei `<Bvh>` + per-instance R3F events) only yields
 * "(kind, id) was clicked"; everything the viewer then needs — toggling
 * selection state, the inspector's display data, and the world-space bounds
 * used by the highlight + double-click fit-to-selection — is computed here
 * from plain data. No three.js imports, so the whole module unit-tests in a
 * node/happy-dom environment, which is where the picking behaviour gets its
 * deterministic coverage.
 */

import { COPPER_THICKNESS_MM } from '../scene/trace-geometry';

import type {
  SceneComponent,
  SceneModel,
  ScenePad,
  SceneSelection,
  SceneTrace,
  SceneVia,
} from './scene-model';

// ---------------------------------------------------------------------------
// Selection state transitions
// ---------------------------------------------------------------------------

/**
 * Pure selection reducer: clicking an element selects it; clicking the
 * already-selected element deselects; clicking nothing clears.
 */
export function nextSelection(
  current: SceneSelection | null,
  clicked: SceneSelection | null,
): SceneSelection | null {
  if (!clicked) return null;
  if (current && current.kind === clicked.kind && current.id === clicked.id) {
    return null;
  }
  return clicked;
}

// ---------------------------------------------------------------------------
// Element lookup
// ---------------------------------------------------------------------------

export function findComponent(model: SceneModel, id: string): SceneComponent | null {
  return model.components.find((c) => c.id === id) ?? null;
}

export function findPad(model: SceneModel, id: string): ScenePad | null {
  return model.pads.find((p) => p.id === id) ?? null;
}

export function findTrace(model: SceneModel, id: string): SceneTrace | null {
  return model.traces.find((t) => t.id === id) ?? null;
}

export function findVia(model: SceneModel, id: string): SceneVia | null {
  return model.vias.find((v) => v.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Inspector description
// ---------------------------------------------------------------------------

/** A label/value row the InspectorPanel renders verbatim. */
export interface SelectionField {
  label: string;
  value: string;
  /** When set, the panel renders the value as an external link. */
  href?: string;
}

/** Everything the InspectorPanel needs to render a picked element. */
export interface SelectionDetails {
  kind: SceneSelection['kind'];
  /** Headline, e.g. "U1" or "Trace — NET_VCC". */
  title: string;
  /** Subheading, e.g. the package or element family. */
  subtitle: string;
  fields: SelectionField[];
}

function mm(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)} mm`;
}

/** Total polyline length of a trace centreline (mm). */
export function traceLength(trace: SceneTrace): number {
  let length = 0;
  for (let i = 1; i < trace.points.length; i++) {
    const a = trace.points[i - 1];
    const b = trace.points[i];
    length += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return length;
}

/**
 * Resolve a selection into the inspector's display model. Returns null when
 * the id no longer exists in the model (stale selection after a data change).
 */
export function describeSelection(
  model: SceneModel,
  selection: SceneSelection | null,
): SelectionDetails | null {
  if (!selection) return null;

  switch (selection.kind) {
    case 'component': {
      const c = findComponent(model, selection.id);
      if (!c) return null;
      const fields: SelectionField[] = [
        { label: 'Reference', value: c.refDes },
        { label: 'Package', value: c.package },
      ];
      if (c.value) fields.push({ label: 'Value', value: c.value });
      fields.push(
        { label: 'Side', value: c.side },
        { label: 'Position', value: `${mm(c.x)}, ${mm(c.z)}` },
        { label: 'Rotation', value: `${c.rotationDeg}°` },
        { label: 'Body', value: `${mm(c.bodyW, 1)} × ${mm(c.bodyD, 1)} × ${mm(c.bodyH, 1)}` },
      );
      const padCount = model.pads.filter((p) => p.componentId === c.id).length;
      if (padCount > 0) fields.push({ label: 'Pads', value: String(padCount) });
      if (c.datasheetUrl) {
        fields.push({ label: 'Datasheet', value: 'open datasheet', href: c.datasheetUrl });
      }
      if (c.supplier) fields.push({ label: 'Supplier', value: c.supplier });
      return { kind: 'component', title: c.refDes, subtitle: c.package, fields };
    }

    case 'pad': {
      const p = findPad(model, selection.id);
      if (!p) return null;
      const parent = findComponent(model, p.componentId);
      const fields: SelectionField[] = [
        { label: 'Component', value: parent?.refDes ?? p.componentId },
        { label: 'Type', value: p.through ? 'through-hole' : 'SMD' },
        { label: 'Diameter', value: mm(p.diameter) },
        { label: 'Side', value: p.side },
        { label: 'Position', value: `${mm(p.x)}, ${mm(p.z)}` },
      ];
      return {
        kind: 'pad',
        title: parent ? `${parent.refDes} pad` : 'Pad',
        subtitle: p.through ? 'Through-hole pad' : 'SMD pad',
        fields,
      };
    }

    case 'trace': {
      const t = findTrace(model, selection.id);
      if (!t) return null;
      const fields: SelectionField[] = [];
      if (t.netName) fields.push({ label: 'Net', value: t.netName });
      fields.push(
        { label: 'Width', value: mm(t.width) },
        { label: 'Length', value: mm(traceLength(t)) },
        { label: 'Layer', value: t.side === 'top' ? 'top copper' : 'bottom copper' },
        { label: 'Segments', value: String(Math.max(t.points.length - 1, 0)) },
      );
      return {
        kind: 'trace',
        title: t.netName ? `Trace — ${t.netName}` : 'Trace',
        subtitle: `${t.side} copper`,
        fields,
      };
    }

    case 'via': {
      const v = findVia(model, selection.id);
      if (!v) return null;
      const fields: SelectionField[] = [];
      if (v.netName) fields.push({ label: 'Net', value: v.netName });
      fields.push(
        { label: 'Drill', value: mm(v.drillDiameter) },
        { label: 'Outer', value: mm(v.outerDiameter) },
        { label: 'Span', value: `${mm(v.yBottom)} → ${mm(v.yTop)}` },
        { label: 'Position', value: `${mm(v.x)}, ${mm(v.z)}` },
      );
      return {
        kind: 'via',
        title: v.netName ? `Via — ${v.netName}` : 'Via',
        subtitle: 'Plated via',
        fields,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// World-space bounds (for highlight + double-click fit-to-selection)
// ---------------------------------------------------------------------------

/** Axis-aligned world-space bounds of a selection (scene mm, y = thickness). */
export interface SelectionBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/** Pad puck height used by the renderer (kept in sync with SceneModelView). */
const PAD_HEIGHT_MM = 0.05;

/**
 * Compute the axis-aligned bounds of the selected element in scene space.
 * Component rotation is folded in conservatively by using the rotated
 * footprint's AABB. Returns null for stale selections.
 */
export function selectionBounds(
  model: SceneModel,
  selection: SceneSelection | null,
): SelectionBounds | null {
  if (!selection) return null;
  const half = model.board.thicknessMm / 2;

  switch (selection.kind) {
    case 'component': {
      const c = findComponent(model, selection.id);
      if (!c) return null;
      // Rotated-footprint AABB about the board normal.
      const rad = (Math.abs(c.rotationDeg) * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const hw = (c.bodyW * cos + c.bodyD * sin) / 2;
      const hd = (c.bodyW * sin + c.bodyD * cos) / 2;
      const yLo = c.side === 'top' ? half : -(half + c.bodyH);
      const yHi = c.side === 'top' ? half + c.bodyH : -half;
      return {
        min: { x: c.x - hw, y: yLo, z: c.z - hd },
        max: { x: c.x + hw, y: yHi, z: c.z + hd },
      };
    }

    case 'pad': {
      const p = findPad(model, selection.id);
      if (!p) return null;
      const r = p.diameter / 2;
      const yLo = p.side === 'top' ? half : -(half + PAD_HEIGHT_MM);
      const yHi = p.side === 'top' ? half + PAD_HEIGHT_MM : -half;
      return {
        min: { x: p.x - r, y: yLo, z: p.z - r },
        max: { x: p.x + r, y: yHi, z: p.z + r },
      };
    }

    case 'trace': {
      const t = findTrace(model, selection.id);
      if (!t || t.points.length === 0) return null;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const pt of t.points) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minZ = Math.min(minZ, pt.z);
        maxZ = Math.max(maxZ, pt.z);
      }
      const hw = t.width / 2;
      const yLo = t.y - (t.side === 'bottom' ? COPPER_THICKNESS_MM : 0);
      const yHi = t.y + (t.side === 'top' ? COPPER_THICKNESS_MM : 0);
      return {
        min: { x: minX - hw, y: yLo, z: minZ - hw },
        max: { x: maxX + hw, y: yHi, z: maxZ + hw },
      };
    }

    case 'via': {
      const v = findVia(model, selection.id);
      if (!v) return null;
      const r = v.outerDiameter / 2;
      return {
        min: { x: v.x - r, y: v.yBottom - COPPER_THICKNESS_MM, z: v.z - r },
        max: { x: v.x + r, y: v.yTop + COPPER_THICKNESS_MM, z: v.z + r },
      };
    }
  }
}
