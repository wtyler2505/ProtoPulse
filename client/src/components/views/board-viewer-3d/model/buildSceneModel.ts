import type {
  AddComponentInput,
  AddTraceInput,
  AddViaInput,
  BoardDimensions,
  BoardScene,
  Component3D,
  LayerType3D,
  RenderOptions,
  Trace3D,
  Via3D,
} from '@/lib/board-viewer-3d';
import type { CircuitInstanceRow, CircuitViaRow, CircuitWireRow } from '@shared/schema';
import type { Footprint } from '@/lib/pcb/footprint-library';
import { FootprintLibrary } from '@/lib/pcb/footprint-library';
import { getPackageHeight } from './package-heights';
import { buildLayerStack } from './layer-stack';

type FootprintResolver = (packageType: string) => Footprint | null;

export interface BuildSceneModelInput {
  board: BoardDimensions;
  instances: readonly CircuitInstanceRow[];
  wires: readonly CircuitWireRow[];
  vias: readonly CircuitViaRow[];
  renderOptions: Pick<RenderOptions, 'boardColor' | 'solderMaskColor' | 'copperColor' | 'silkscreenColor'>;
  visibleLayers?: readonly LayerType3D[];
  layerCount?: number;
  footprintResolver?: FootprintResolver;
}

export interface BuildSceneModelResult {
  scene: BoardScene;
  componentInputs: AddComponentInput[];
  traceInputs: AddTraceInput[];
  viaInputs: AddViaInput[];
  stats: {
    placedComponentCount: number;
    traceCount: number;
    viaCount: number;
    totalSceneItemCount: number;
  };
}

function readInstanceProperties(instance: Pick<CircuitInstanceRow, 'properties'>): Record<string, unknown> {
  return instance.properties && typeof instance.properties === 'object' && !Array.isArray(instance.properties)
    ? (instance.properties as Record<string, unknown>)
    : {};
}

export function resolvePackageType(instance: CircuitInstanceRow, footprintResolver: FootprintResolver): string {
  const props = readInstanceProperties(instance);
  const explicitPackage = typeof props.packageType === 'string' ? props.packageType : null;
  if (explicitPackage && footprintResolver(explicitPackage)) {
    return explicitPackage;
  }

  const refDes = instance.referenceDesignator.toUpperCase();
  if (refDes.startsWith('U') || refDes.startsWith('IC')) {
    return 'SOIC-8';
  }
  if (refDes.startsWith('R') || refDes.startsWith('C')) {
    return '0603';
  }
  if (refDes.startsWith('Q')) {
    return 'SOT-23';
  }
  return 'SOIC-8';
}

export function generatePinsFromFootprint(
  footprint: Footprint | null,
  bodyWidth: number,
  bodyHeight: number,
): Component3D['pins'] {
  if (footprint?.pads?.length) {
    return footprint.pads.map((pad, index) => ({
      id: `pin-${index}`,
      position: { x: pad.position.x, y: pad.position.y },
      diameter: Math.max(pad.width || 1.2, pad.height || 1.2),
      type: pad.type === 'tht' ? 'through-hole' : 'smd',
    }));
  }

  const pins: Component3D['pins'] = [];
  const count = Math.min(8, Math.max(4, Math.floor((bodyWidth + bodyHeight) / 3)));
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    pins.push({
      id: `pin-${index}`,
      position: {
        x: Math.cos(angle) * (bodyWidth / 2 - 1),
        y: Math.sin(angle) * (bodyHeight / 2 - 1),
      },
      diameter: 1.0,
      type: 'smd',
    });
  }
  return pins;
}

export function mapInstanceTo3DComponent(
  instance: CircuitInstanceRow,
  footprintResolver: FootprintResolver = FootprintLibrary.getFootprint.bind(FootprintLibrary),
): Component3D {
  const packageType = resolvePackageType(instance, footprintResolver);
  const footprint = footprintResolver(packageType);
  const bodyWidth = footprint?.boundingBox.width ?? 5.0;
  const bodyHeight = footprint?.boundingBox.height ?? 5.0;
  const bodyDepth = getPackageHeight(packageType);

  return {
    id: `component-${instance.id}`,
    refDes: instance.referenceDesignator,
    package: packageType,
    position: {
      x: instance.pcbX ?? instance.schematicX ?? 0,
      y: instance.pcbY ?? instance.schematicY ?? 0,
      z: 0,
    },
    rotation: instance.pcbRotation ?? instance.schematicRotation ?? 0,
    side: instance.pcbSide === 'back' ? 'bottom' : 'top',
    bodyWidth,
    bodyHeight,
    bodyDepth,
    color: '#1a1a1a',
    pins: generatePinsFromFootprint(footprint, bodyWidth, bodyHeight),
  };
}

export function componentToAddInput(component: Component3D): AddComponentInput {
  return {
    refDes: component.refDes,
    package: component.package,
    position: { ...component.position },
    rotation: component.rotation,
    side: component.side,
    bodyWidth: component.bodyWidth,
    bodyHeight: component.bodyHeight,
    bodyDepth: component.bodyDepth,
    color: component.color,
    pins: component.pins.map((pin) => ({
      id: pin.id,
      position: { ...pin.position },
      diameter: pin.diameter,
      type: pin.type,
    })),
    label: component.label,
  };
}

export function mapWireTo3DTrace(wire: CircuitWireRow): Trace3D {
  const rawPoints = Array.isArray(wire.points) ? (wire.points as Array<{ x: number; y: number }>) : [];
  return {
    id: `trace-${wire.id}`,
    points: rawPoints.map((point) => ({ x: point.x, y: point.y })),
    width: wire.width ?? 0.2,
    layer: wire.layer === 'back' || wire.layer === 'bottom' ? 'bottom-copper' : 'top-copper',
  };
}

export function traceToAddInput(trace: Trace3D): AddTraceInput {
  return {
    points: trace.points.map((point) => ({ ...point })),
    width: trace.width,
    layer: trace.layer,
  };
}

export function mapViaTo3DVia(via: CircuitViaRow): Via3D {
  return {
    id: `via-${via.id}`,
    position: { x: via.x, y: via.y },
    outerDiameter: via.outerDiameter,
    drillDiameter: via.drillDiameter,
    startLayer: via.layerStart ?? 'top-copper',
    endLayer: via.layerEnd ?? 'bottom-copper',
  };
}

export function viaToAddInput(via: Via3D): AddViaInput {
  return {
    position: { ...via.position },
    outerDiameter: via.outerDiameter,
    drillDiameter: via.drillDiameter,
    startLayer: via.startLayer,
    endLayer: via.endLayer,
  };
}

export function buildSceneModel({
  board,
  instances,
  wires,
  vias,
  renderOptions,
  visibleLayers,
  layerCount,
  footprintResolver = FootprintLibrary.getFootprint.bind(FootprintLibrary),
}: BuildSceneModelInput): BuildSceneModelResult {
  const components = instances
    .filter((instance) => instance.pcbX != null && instance.pcbY != null)
    .map((instance) => mapInstanceTo3DComponent(instance, footprintResolver));
  const traces = wires.filter((wire) => wire.view === 'pcb' || !wire.view).map(mapWireTo3DTrace);
  const sceneVias = vias.map(mapViaTo3DVia);
  const scene: BoardScene = {
    board: { ...board },
    layers: buildLayerStack({ board, layerCount, renderOptions, visibleLayers }),
    components,
    traces,
    vias: sceneVias,
    drillHoles: [],
  };

  return {
    scene,
    componentInputs: components.map(componentToAddInput),
    traceInputs: traces.map(traceToAddInput),
    viaInputs: sceneVias.map(viaToAddInput),
    stats: {
      placedComponentCount: components.length,
      traceCount: traces.length,
      viaCount: sceneVias.length,
      totalSceneItemCount: components.length + traces.length + sceneVias.length,
    },
  };
}
