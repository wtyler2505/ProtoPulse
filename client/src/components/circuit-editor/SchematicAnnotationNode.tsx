/**
 * SchematicAnnotationNode — ReactFlow custom node for freetext annotations
 * on the schematic canvas. Double-click to edit text, supports font size
 * and color customization. Stored in circuit design settings JSON. (BL-0492)
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Node data type
// ---------------------------------------------------------------------------

export interface AnnotationNodeData {
  annotationId: string;
  text: string;
  fontSize: number;
  color: string;
  onTextChange?: (annotationId: string, text: string) => void;
  onFontSizeChange?: (annotationId: string, fontSize: number) => void;
  onColorChange?: (annotationId: string, color: string) => void;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_SIZES = [10, 12, 14, 16, 20, 24, 32];
const ANNOTATION_COLORS = [
  '#ffffff', // white
  '#00F0FF', // neon cyan (theme)
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#6b7280', // gray
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SchematicAnnotationNodeInner({
  data,
  selected,
}: NodeProps<Node<AnnotationNodeData>>) {
  const {
    annotationId,
    text,
    fontSize,
    color,
    onTextChange,
    onFontSizeChange,
    onColorChange,
  } = data;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const [showControls, setShowControls] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditText(text);
    }
  }, [text, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const trimmed = editText.trim();
    if (trimmed && trimmed !== text) {
      onTextChange?.(annotationId, trimmed);
    } else if (!trimmed) {
      setEditText(text);
    }
  }, [editText, text, annotationId, onTextChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditText(text);
      }
      // Stop propagation so ReactFlow doesn't handle these keys
      e.stopPropagation();
    },
    [commitEdit, text],
  );

  return (
    <div
      data-testid={`schematic-annotation-${annotationId}`}
      className={cn(
        'relative group cursor-grab',
        selected && 'ring-1 ring-primary/50 rounded-sm',
      )}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {isEditing ? (
        <textarea
          ref={inputRef}
          data-testid={`annotation-edit-${annotationId}`}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="bg-transparent border border-primary/40 rounded px-1 py-0.5 outline-none resize-none min-w-[60px] min-h-[24px]"
          style={{
            fontSize: `${String(fontSize)}px`,
            color,
            lineHeight: 1.3,
          }}
          rows={editText.split('\n').length}
        />
      ) : (
        <div
          data-testid={`annotation-text-${annotationId}`}
          className="whitespace-pre-wrap select-none px-1 py-0.5"
          style={{
            fontSize: `${String(fontSize)}px`,
            color,
            lineHeight: 1.3,
            minWidth: 20,
            minHeight: fontSize + 4,
          }}
        >
          {text || 'Double-click to edit'}
        </div>
      )}

      {/* Font size and color controls — visible on hover or selection */}
      {(showControls || selected) && !isEditing && (
        <div
          data-testid={`annotation-controls-${annotationId}`}
          className="absolute -top-8 left-0 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded px-1 py-0.5 z-10 nodrag"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="toolbar"
          aria-label="Annotation controls"
        >
          {/* Font size selector */}
          <select
            data-testid={`annotation-fontsize-${annotationId}`}
            value={fontSize}
            onChange={(e) => onFontSizeChange?.(annotationId, Number(e.target.value))}
            className="bg-transparent text-[10px] text-muted-foreground border-none outline-none cursor-pointer"
            aria-label="Font size"
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>

          {/* Color swatches */}
          <div className="flex items-center gap-0.5 ml-1">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                data-testid={`annotation-color-${c.replace('#', '')}`}
                className={cn(
                  'w-3 h-3 rounded-full border',
                  color === c ? 'border-primary ring-1 ring-primary' : 'border-border/50',
                )}
                style={{ backgroundColor: c }}
                onClick={() => onColorChange?.(annotationId, c)}
                aria-label={`Set color to ${c}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SchematicAnnotationNode = memo(SchematicAnnotationNodeInner);
export default SchematicAnnotationNode;
