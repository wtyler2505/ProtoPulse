import type { LayerType3D } from '@/lib/board-viewer-3d';

export interface WebGLLayerSetting {
  visible: boolean;
  opacity: number;
}

export type WebGLLayerSettings = Partial<Record<LayerType3D, WebGLLayerSetting>>;

export const WEBGL_LAYER_LABELS: Record<LayerType3D, string> = {
  'top-copper': 'Top copper',
  'bottom-copper': 'Bottom copper',
  'top-silk': 'Top silkscreen',
  'bottom-silk': 'Bottom silkscreen',
  'top-mask': 'Top solder mask',
  'bottom-mask': 'Bottom solder mask',
  substrate: 'Substrate',
  internal: 'Internal',
};

export function getLayerTestIdSegment(layer: LayerType3D): string {
  return layer.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getLayerOpacity(settings: WebGLLayerSettings, layer: LayerType3D): number {
  return settings[layer]?.opacity ?? 1;
}

export function isLayerVisible(settings: WebGLLayerSettings, layer: LayerType3D): boolean {
  return settings[layer]?.visible ?? true;
}
