import type { BoardScene, Component3D, ComponentSide, LayerType3D } from '@/lib/board-viewer-3d';

export interface Point2D {
  x: number;
  y: number;
}

export interface PadRenderInstance {
  id: string;
  componentId: string;
  refDes: string;
  pinId: string;
  type: Component3D['pins'][number]['type'];
  side: ComponentSide;
  layer: Extract<LayerType3D, 'top-copper' | 'bottom-copper'>;
  position: Point2D;
  diameter: number;
}

export function rotatePoint2D(point: Point2D, rotationDegrees: number): Point2D {
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function getCopperLayerForComponentSide(
  side: ComponentSide,
): Extract<LayerType3D, 'top-copper' | 'bottom-copper'> {
  return side === 'bottom' ? 'bottom-copper' : 'top-copper';
}

export function getComponentPadBoardPosition(
  component: Component3D,
  pin: Component3D['pins'][number],
): Point2D {
  const rotatedPin = rotatePoint2D(pin.position, component.rotation);
  return {
    x: component.position.x + rotatedPin.x,
    y: component.position.y + rotatedPin.y,
  };
}

export function buildPadRenderInstances(scene: BoardScene): PadRenderInstance[] {
  return scene.components.flatMap((component) =>
    component.pins
      .filter((pin) => Number.isFinite(pin.diameter) && pin.diameter > 0)
      .map((pin) => ({
        id: `${component.id}-${pin.id}`,
        componentId: component.id,
        refDes: component.refDes,
        pinId: pin.id,
        type: pin.type,
        side: component.side,
        layer: getCopperLayerForComponentSide(component.side),
        position: getComponentPadBoardPosition(component, pin),
        diameter: pin.diameter,
      })),
  );
}
