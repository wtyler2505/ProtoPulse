import type { BoardDimensions, LayerType3D, RenderOptions } from '@/lib/board-viewer-3d';

export interface BuildLayerStackOptions {
  board: BoardDimensions;
  layerCount?: number;
  renderOptions: Pick<RenderOptions, 'boardColor' | 'solderMaskColor' | 'copperColor' | 'silkscreenColor'>;
  visibleLayers?: readonly LayerType3D[];
}

const COPPER_THICKNESS_MM = 0.035;
const MASK_THICKNESS_MM = 0.01;
const SILK_THICKNESS_MM = 0.01;

export function buildLayerStack({
  board,
  layerCount = 2,
  renderOptions,
  visibleLayers,
}: BuildLayerStackOptions): Array<{
  type: LayerType3D;
  zOffset: number;
  thickness: number;
  color: string;
  opacity: number;
  visible: boolean;
}> {
  const visibleSet = visibleLayers ? new Set(visibleLayers) : null;
  const isVisible = (type: LayerType3D) => visibleSet?.has(type) ?? true;
  const innerLayerCount = Math.max(0, Math.floor(layerCount) - 2);
  const innerLayers = Array.from({ length: innerLayerCount }, (_, index) => {
    const fraction = (index + 1) / (innerLayerCount + 1);
    return {
      type: 'internal' as const,
      zOffset: board.thickness * fraction,
      thickness: COPPER_THICKNESS_MM,
      color: renderOptions.copperColor,
      opacity: 1.0,
      visible: isVisible('internal'),
    };
  });

  return [
    {
      type: 'bottom-silk',
      zOffset: -MASK_THICKNESS_MM - SILK_THICKNESS_MM,
      thickness: SILK_THICKNESS_MM,
      color: renderOptions.silkscreenColor,
      opacity: 0.9,
      visible: isVisible('bottom-silk'),
    },
    {
      type: 'bottom-mask',
      zOffset: -MASK_THICKNESS_MM,
      thickness: MASK_THICKNESS_MM,
      color: renderOptions.solderMaskColor,
      opacity: 0.8,
      visible: isVisible('bottom-mask'),
    },
    {
      type: 'bottom-copper',
      zOffset: 0,
      thickness: COPPER_THICKNESS_MM,
      color: renderOptions.copperColor,
      opacity: 1.0,
      visible: isVisible('bottom-copper'),
    },
    {
      type: 'substrate',
      zOffset: COPPER_THICKNESS_MM,
      thickness: Math.max(0.1, board.thickness - COPPER_THICKNESS_MM * 2),
      color: renderOptions.boardColor,
      opacity: 1.0,
      visible: isVisible('substrate'),
    },
    ...innerLayers,
    {
      type: 'top-copper',
      zOffset: Math.max(0, board.thickness - COPPER_THICKNESS_MM),
      thickness: COPPER_THICKNESS_MM,
      color: renderOptions.copperColor,
      opacity: 1.0,
      visible: isVisible('top-copper'),
    },
    {
      type: 'top-mask',
      zOffset: board.thickness,
      thickness: MASK_THICKNESS_MM,
      color: renderOptions.solderMaskColor,
      opacity: 0.8,
      visible: isVisible('top-mask'),
    },
    {
      type: 'top-silk',
      zOffset: board.thickness + MASK_THICKNESS_MM,
      thickness: SILK_THICKNESS_MM,
      color: renderOptions.silkscreenColor,
      opacity: 0.9,
      visible: isVisible('top-silk'),
    },
  ];
}
