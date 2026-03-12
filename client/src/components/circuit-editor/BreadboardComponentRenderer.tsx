import { memo, useMemo } from 'react';
import { coordToPixel } from '@/lib/circuit-editor/breadboard-model';
import { useSimulation } from '@/lib/contexts/simulation-context';
import { cn } from '@/lib/utils';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

interface BreadboardComponentProps {
  instance: CircuitInstanceRow;
  part?: ComponentPart;
  selected?: boolean;
  onClick?: (id: number) => void;
}

const BreadboardComponent = memo(({ instance, part, selected, onClick }: BreadboardComponentProps) => {
  const { componentStates, isLive } = useSimulation();
  const liveState = componentStates[instance.referenceDesignator];

  const pos = useMemo(() => {
    if (instance.breadboardX == null || instance.breadboardY == null) return null;
    return { x: instance.breadboardX, y: instance.breadboardY };
  }, [instance.breadboardX, instance.breadboardY]);

  if (!pos) return null;

  const type = (part?.meta as any)?.type?.toLowerCase() || 'generic';
  const color = (instance.properties as any)?.color || '#ff0000';

  // Component-specific rendering logic
  const renderShape = () => {
    switch (type) {
      case 'led': {
        const isActive = isLive && (liveState?.isActive || (liveState?.brightness ?? 0) > 0.1);
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            {/* LED Glow */}
            {isActive && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={12}
                fill={color}
                opacity={0.3 * (liveState?.brightness || 1)}
                className="animate-pulse"
              />
            )}
            {/* LED Body */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={4.5}
              fill={color}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={0.5}
              opacity={isActive ? 1 : 0.7}
            />
            {/* Highlight */}
            <circle cx={pos.x - 1.5} cy={pos.y - 1.5} r={1.2} fill="white" opacity={0.4} />
          </g>
        );
      }
      case 'resistor': {
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <rect
              x={pos.x - 10}
              y={pos.y - 3}
              width={20}
              height={6}
              rx={1.5}
              fill="#d4a373"
              stroke="#8b5e34"
              strokeWidth={0.5}
            />
            {/* Color bands (placeholders) */}
            <rect x={pos.x - 6} y={pos.y - 3} width={2} height={6} fill="#8b5e34" />
            <rect x={pos.x - 2} y={pos.y - 3} width={2} height={6} fill="#ff0000" />
            <rect x={pos.x + 4} y={pos.y - 3} width={2} height={6} fill="#facc15" />
          </g>
        );
      }
      case 'ic':
      case 'mcu': {
        const pinCount = (part?.connectors as any[])?.length || 8;
        const rows = Math.ceil(pinCount / 2);
        const height = rows * 10;
        return (
          <g className="cursor-pointer" onClick={() => onClick?.(instance.id)}>
            <rect
              x={pos.x - 12}
              y={pos.y - 5}
              width={24}
              height={height}
              rx={2}
              fill="#1a1a1a"
              stroke="#333"
              strokeWidth={1}
            />
            <circle cx={pos.x} cy={pos.y - 2} r={2} fill="#333" /> {/* Notch */}
            <text
              x={pos.x}
              y={pos.y + height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={5}
              fill="#666"
              className="font-mono select-none"
            >
              {instance.referenceDesignator}
            </text>
          </g>
        );
      }
      default: {
        return (
          <rect
            x={pos.x - 5}
            y={pos.y - 5}
            width={10}
            height={10}
            fill="#444"
            className="cursor-pointer"
            onClick={() => onClick?.(instance.id)}
          />
        );
      }
    }
  };

  return (
    <g 
      data-testid={`bb-instance-${instance.id}`}
      className={cn(selected && "filter drop-shadow-[0_0_2px_#00F0FF]")}
    >
      {renderShape()}
    </g>
  );
});

export const BreadboardComponentOverlay = memo(({ 
  instances, 
  parts, 
  selectedId, 
  onInstanceClick 
}: { 
  instances: CircuitInstanceRow[], 
  parts: ComponentPart[],
  selectedId: number | null,
  onInstanceClick: (id: number) => void
}) => {
  const partsMap = useMemo(() => new Map(parts.map(p => [p.id, p])), [parts]);

  return (
    <g data-testid="bb-component-overlay">
      {instances.map(inst => (
        <BreadboardComponent
          key={inst.id}
          instance={inst}
          part={inst.partId ? partsMap.get(inst.partId) : undefined}
          selected={inst.id === selectedId}
          onClick={onInstanceClick}
        />
      ))}
    </g>
  );
});
