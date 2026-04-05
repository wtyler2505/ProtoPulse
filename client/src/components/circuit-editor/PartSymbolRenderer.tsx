import { memo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Shape } from '@shared/component-types';

interface PartSymbolRendererProps {
  shapes: Shape[];
  width: number;
  height: number;
  viewBox?: string;
  className?: string;
}

function shapeStyleToCSS(style?: Shape['style']): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.fill) css.fill = style.fill;
  if (style.stroke) css.stroke = style.stroke;
  if (style.strokeWidth) css.strokeWidth = style.strokeWidth;
  if (style.opacity !== undefined) css.opacity = style.opacity;
  return css;
}

export function renderPartShape(shape: Shape): ReactNode {
  const style = shapeStyleToCSS(shape.style);
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const transform = shape.rotation ? `rotate(${shape.rotation} ${cx} ${cy})` : undefined;

  switch (shape.type) {
    case 'rect':
      return (
        <rect
          key={shape.id}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          style={style}
          transform={transform}
        />
      );
    case 'circle':
      return (
        <circle
          key={shape.id}
          cx={shape.cx}
          cy={shape.cy}
          r={Math.min(shape.width, shape.height) / 2}
          style={style}
          transform={transform}
        />
      );
    case 'path':
      return <path key={shape.id} d={shape.d} style={style} transform={transform} />;
    case 'text':
      return (
        <text
          key={shape.id}
          x={shape.x}
          y={shape.y + (shape.style?.fontSize ?? 12)}
          style={{
            ...style,
            fontSize: shape.style?.fontSize ?? 12,
            fontFamily: shape.style?.fontFamily ?? 'monospace',
          }}
          transform={transform}
        >
          {shape.text}
        </text>
      );
    case 'group':
      return (
        <g key={shape.id} transform={transform}>
          {shape.children.map(renderPartShape)}
        </g>
      );
  }
}

export function computeShapesBounds(shapes: Shape[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function expand(s: Shape) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
    if (s.type === 'group') {
      s.children.forEach(expand);
    }
  }

  shapes.forEach(expand);

  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const PartSymbolRenderer = memo(function PartSymbolRenderer({
  shapes,
  width,
  height,
  viewBox,
  className,
}: PartSymbolRendererProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox ?? `0 0 ${width} ${height}`}
      className={className}
    >
      {shapes.map(renderPartShape)}
    </svg>
  );
});

export default PartSymbolRenderer;
