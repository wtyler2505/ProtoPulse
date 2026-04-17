import { memo, useMemo } from 'react';

import { computeShapesBounds, renderPartShape } from '@/components/circuit-editor/PartSymbolRenderer';
import { getBenchConnectorAnchorPositions, type BenchConnectorAnchorPosition } from '@/lib/circuit-editor/breadboard-bench-connectors';
import { cn } from '@/lib/utils';
import { getVerificationStatus, shouldPreferExactBreadboardView } from '@shared/component-trust';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

interface BreadboardBenchPartRendererProps {
  instance: CircuitInstanceRow;
  part?: ComponentPart;
  selected?: boolean;
  onClick?: (id: number) => void;
  showConnectorTargets?: boolean;
  onConnectorClick?: (anchor: BenchConnectorAnchorPosition) => void;
}

const BreadboardBenchPartRenderer = memo(function BreadboardBenchPartRenderer({
  instance,
  part,
  selected = false,
  onClick,
  showConnectorTargets = false,
  onConnectorClick,
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
  const benchAnchors = useMemo(
    () => getBenchConnectorAnchorPositions(instance, part),
    [instance, part],
  );
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
            {benchAnchors.map((anchor) => {
              return (
                <g key={`bench-anchor-${instance.id}-${anchor.connectorId}`}>
                  <circle
                    cx={anchor.localX}
                    cy={anchor.localY}
                    r={showConnectorTargets ? 3.1 : 2.3}
                    fill={showConnectorTargets ? 'rgba(14,165,233,0.28)' : 'rgba(14,165,233,0.2)'}
                    stroke={selected || showConnectorTargets ? 'var(--color-editor-accent)' : '#94a3b8'}
                    strokeWidth={selected || showConnectorTargets ? 1.1 : 0.8}
                  />
                  {onConnectorClick && (
                    <circle
                      data-testid={`bench-connector-hit-${instance.id}-${anchor.connectorId}`}
                      cx={anchor.localX}
                      cy={anchor.localY}
                      r={6}
                      fill="transparent"
                      style={{ cursor: 'crosshair' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onConnectorClick(anchor);
                      }}
                    />
                  )}
                </g>
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
      {benchAnchors.slice(0, 8).map((anchor) => {
        return (
          <g key={`fallback-anchor-${instance.id}-${anchor.connectorId}`}>
            <circle
              cx={anchor.localX}
              cy={anchor.localY}
              r={showConnectorTargets ? 2.6 : 2}
              fill="var(--color-editor-accent)"
              opacity={showConnectorTargets ? 0.95 : 0.7}
            />
            {onConnectorClick && (
              <circle
                data-testid={`bench-connector-hit-${instance.id}-${anchor.connectorId}`}
                cx={anchor.localX}
                cy={anchor.localY}
                r={6}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onClick={(event) => {
                  event.stopPropagation();
                  onConnectorClick(anchor);
                }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
});

export default BreadboardBenchPartRenderer;
