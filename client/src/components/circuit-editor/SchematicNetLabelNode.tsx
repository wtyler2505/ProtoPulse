import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Node data type
// ---------------------------------------------------------------------------

export interface NetLabelNodeData {
  labelId: string;
  netName: string;
  rotation: number;
  onNetNameChange?: (labelId: string, newName: string) => void;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Net label node — flag-shaped label showing the net name
// ---------------------------------------------------------------------------

const FLAG_W = 80;
const FLAG_H = 20;

function SchematicNetLabelNode({
  data,
  selected,
}: NodeProps<Node<NetLabelNodeData>>) {
  const { netName, rotation, labelId, onNetNameChange } = data;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(netName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== netName) {
      onNetNameChange?.(labelId, trimmed);
    }
    setIsEditing(false);
    setEditValue(netName);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(netName);
  };

  return (
    <div
      data-testid="schematic-net-label"
      className={cn(
        'relative',
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background rounded-sm',
      )}
      style={{
        width: FLAG_W,
        height: FLAG_H,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          data-testid="net-label-input"
          className="absolute top-0 left-0 w-full h-full text-[10px] font-mono text-cyan-400 bg-transparent border-0 outline-none ring-1 ring-cyan-400 rounded px-1 py-0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { commitEdit(); }
            if (e.key === 'Escape') { cancelEdit(); }
            e.stopPropagation();
          }}
          onBlur={commitEdit}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <svg
            width={FLAG_W}
            height={FLAG_H}
            className="block"
            onDoubleClick={() => { setEditValue(netName); setIsEditing(true); }}
            data-testid="net-label-display"
          >
            {/* Flag shape: rectangle with pointed right edge */}
            <polygon
              points={`0,0 ${FLAG_W - 10},0 ${FLAG_W},${FLAG_H / 2} ${FLAG_W - 10},${FLAG_H} 0,${FLAG_H}`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={4}
              y={FLAG_H / 2 + 4}
              fontSize={10}
              fontFamily="monospace"
              fill="#06b6d4"
            >
              {netName}
            </text>
          </svg>
        </>
      )}

      {/* Connection handle on the left */}
      <Handle
        id="net-label-pin"
        type="source"
        position={Position.Left}
        style={{
          left: 0,
          top: FLAG_H / 2,
          transform: 'translate(-50%, -50%)',
          position: 'absolute',
        }}
        className="!w-2 !h-2 !bg-cyan-400/60 !border-cyan-400 hover:!bg-cyan-400"
      />
    </div>
  );
}

export default memo(SchematicNetLabelNode);
