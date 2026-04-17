import { memo, useMemo } from 'react';

import { computeShapesBounds, renderPartShape } from '@/components/circuit-editor/PartSymbolRenderer';
import { cn } from '@/lib/utils';
import { getVerificationStatus, shouldPreferExactBreadboardView } from '@shared/component-trust';
import type { Connector } from '@shared/component-types';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

interface BreadboardBenchPartRendererProps {
  instance: CircuitInstanceRow;
  part?: ComponentPart;
  selected?: boolean;
  onClick?: (id: number) => void;
}

const BreadboardBenchPartRenderer = memo(function BreadboardBenchPartRenderer({
  instance,
  part,
  selected = false,
  onClick,
}: BreadboardBenchPartRendererProps) {
  const pos = useMemo(() => {
    if (instance.benchX == null || instance.benchY == null) {
      return null;
    }
    return { x: instance.benchX, y: instance.benchY };
  }, [instance.benchX, instance.benchY]);

  const meta = (part?.meta as Record<string, unknown> | undefined) ?? {};
  const exactShapes = (((part?.views as { breadboard?: { shapes?: unknown[] } } | undefined)?.breadboard?.shapes ?? []) as unknown[])
    .filter((shape): shape is Parameters<typeof renderPartShape>[0] => shape != null && typeof shape === 'object');
  const renderExactView = part != null && shouldPreferExactBreadboardView(meta, part.views) && exactShapes.length > 0;
  const exactBounds = renderExactView ? computeShapesBounds(exactShapes) : null;
  const innerTransform = exactBounds
    ? `translate(${-1 * (exactBounds.x + exactBounds.width / 2)} ${-1 * (exactBounds.y + exactBounds.height / 2)})`
    : undefined;
  const rotationTransform = instance.breadboardRotation != null && instance.breadboardRotation !== 0
    ? `rotate(${String(instance.breadboardRotation)} ${String(pos?.x ?? 0)} ${String(pos?.y ?? 0)})`
    : undefined;
  const benchConnectors = (((part?.connectors ?? []) as Connector[]) ?? []).filter((connector) => connector.terminalPositions?.breadboard);
  const title = typeof meta.title === 'string' ? meta.title : instance.referenceDesignator;
  const verificationLabel = getVerificationStatus(meta) === 'verified' ? 'Verified geometry' : 'Candidate geometry';

  if (!pos) {
    return null;
  }

  if (renderExactView && exactBounds) {
    return (
      <g
        data-testid={`bench-exact-view-${instance.id}`}
        transform={rotationTransform}
        className={cn('cursor-pointer', selected && 'filter drop-shadow-[0_0_4px_var(--color-editor-accent)]')}
        onClick={() => onClick?.(instance.id)}
      >
        <g transform={`translate(${String(pos.x)} ${String(pos.y)})`}>
          <g transform={innerTransform}>
            {exactShapes.map((shape) => renderPartShape(shape))}
            {benchConnectors.map((connector) => {
              const anchor = connector.terminalPositions.breadboard;
              return (
                <circle
                  key={`bench-anchor-${instance.id}-${connector.id}`}
                  cx={anchor.x}
                  cy={anchor.y}
                  r={2.3}
                  fill="rgba(14,165,233,0.2)"
                  stroke={selected ? 'var(--color-editor-accent)' : '#94a3b8'}
                  strokeWidth={selected ? 1.1 : 0.8}
                />
              );
            })}
          </g>
          <text
            x={0}
            y={exactBounds.height / 2 + 12}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={7}
            fontFamily="monospace"
          >
            {instance.referenceDesignator}
          </text>
          <text
            x={0}
            y={exactBounds.height / 2 + 20}
            textAnchor="middle"
            fill={getVerificationStatus(meta) === 'verified' ? '#86efac' : '#fde68a'}
            fontSize={5}
            fontFamily="monospace"
          >
            {verificationLabel}
          </text>
        </g>
      </g>
    );
  }

  return (
    <g
      data-testid={`bench-component-${instance.id}`}
      transform={`translate(${String(pos.x)} ${String(pos.y)})`}
      onClick={() => onClick?.(instance.id)}
      className="cursor-pointer"
    >
      <rect
        x={-34}
        y={-22}
        width={68}
        height={44}
        rx={6}
        fill="#1e293b"
        stroke={selected ? 'var(--color-editor-accent)' : '#475569'}
        strokeWidth={selected ? 1.5 : 1}
        opacity={0.94}
      />
      <rect x={-26} y={-20} width={52} height={10} rx={2} fill="#334155" />
      <text x={0} y={-13} textAnchor="middle" fill="#94a3b8" fontSize={6} fontFamily="monospace">BENCH</text>
      <text x={0} y={2} textAnchor="middle" fill="#e2e8f0" fontSize={7} fontFamily="monospace">{instance.referenceDesignator}</text>
      <text x={0} y={12} textAnchor="middle" fill="#67e8f9" fontSize={5} fontFamily="monospace">{title.slice(0, 14)}</text>
      {benchConnectors.slice(0, 8).map((connector, index) => {
        const x = index < 4 ? -28 : 28;
        const y = -10 + (index % 4) * 7;
        return (
          <circle
            key={`fallback-anchor-${instance.id}-${connector.id}`}
            cx={x}
            cy={y}
            r={2}
            fill="var(--color-editor-accent)"
            opacity={0.7}
          />
        );
      })}
    </g>
  );
});

export default BreadboardBenchPartRenderer;
