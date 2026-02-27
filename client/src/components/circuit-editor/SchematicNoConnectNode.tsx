import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Node data type
// ---------------------------------------------------------------------------

export interface NoConnectNodeData {
  markerId: string;
  instanceId: number;
  pin: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// No-connect node — X marker indicating an intentionally unconnected pin
// ---------------------------------------------------------------------------

const SIZE = 16;

function SchematicNoConnectNode({
  data,
  selected,
}: NodeProps<Node<NoConnectNodeData>>) {
  return (
    <div
      data-testid={`schematic-no-connect-${data.markerId}`}
      className={cn(
        'relative',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background rounded-sm',
      )}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} className="block">
        {/* X cross mark */}
        <line
          x1={2}
          y1={2}
          x2={SIZE - 2}
          y2={SIZE - 2}
          stroke="#f59e0b"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={SIZE - 2}
          y1={2}
          x2={2}
          y2={SIZE - 2}
          stroke="#f59e0b"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>

      {/* Pin handle at center for connection detection */}
      <Handle
        id="nc-pin"
        type="source"
        position={Position.Left}
        style={{
          left: SIZE / 2,
          top: SIZE / 2,
          transform: 'translate(-50%, -50%)',
          position: 'absolute',
        }}
        className="!w-1.5 !h-1.5 !bg-amber-400/40 !border-amber-400 hover:!bg-amber-400 !opacity-0"
      />
    </div>
  );
}

export default memo(SchematicNoConnectNode);
