/**
 * ShapeRenderer — Pure SVG rendering for shapes, DRC overlays, constraint
 * visualizations, draw previews, marquee selection, and path overlays.
 *
 * All functions are pure: they take data and return React nodes. No state
 * mutation occurs here.
 */
import type { Shape, RectShape, CircleShape, PathShape, TextShape, GroupShape, DRCViolation, Constraint } from '@shared/component-types';
import { getShapeCenter, detectConflicts } from '@/lib/component-editor/constraint-solver';
import type { SnapTarget } from '@/lib/component-editor/snap-engine';
import type { PathNode, PathPoint } from './PathEditor';

const SEL = '#00F0FF';

// ---------------------------------------------------------------------------
// Individual shape rendering
// ---------------------------------------------------------------------------

export function renderShape(
  shape: Shape,
  selectedIds: string[],
  onMD?: (e: React.MouseEvent, id: string) => void,
): React.ReactNode {
  const sel = selectedIds.includes(shape.id);
  const st = shape.style || {};
  const cmn = { opacity: st.opacity ?? 1, cursor: 'pointer' as const };
  const posLabel = `${Math.round(shape.x)}, ${Math.round(shape.y)}`;
  const shapeLabel = (() => {
    switch (shape.type) {
      case 'rect': return `Rectangle at position ${posLabel}`;
      case 'circle': return `Circle at position ${posLabel}`;
      case 'path': return `Path at position ${posLabel}`;
      case 'text': return `Text "${shape.text}" at position ${posLabel}`;
      case 'group': return `Group at position ${posLabel}`;
    }
  })();
  const wrap = (id: string, children: React.ReactNode) => (
    <g key={id} data-testid={`shape-${id}`} role="img" aria-label={shapeLabel} onMouseDown={(e) => onMD?.(e, id)}>{children}</g>
  );
  const selBox = sel ? (
    <rect x={shape.x - 2} y={shape.y - 2} width={shape.width + 4} height={shape.height + 4}
      fill="none" stroke={SEL} strokeWidth={1.5} strokeDasharray="4 2" pointerEvents="none" />
  ) : null;

  switch (shape.type) {
    case 'rect': {
      const s = shape as RectShape;
      return wrap(s.id, <>
        <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx ?? 0}
          fill={st.fill ?? '#555'} stroke={st.stroke ?? '#888'} strokeWidth={st.strokeWidth ?? 1} style={cmn} />
        {selBox}
      </>);
    }
    case 'circle': {
      const s = shape as CircleShape;
      const r = Math.min(s.width, s.height) / 2;
      return wrap(s.id, <>
        <circle cx={s.cx} cy={s.cy} r={r} fill={st.fill ?? '#555'} stroke={st.stroke ?? '#888'}
          strokeWidth={st.strokeWidth ?? 1} style={cmn} />
        {sel && <rect x={s.cx - r - 2} y={s.cy - r - 2} width={r * 2 + 4} height={r * 2 + 4}
          fill="none" stroke={SEL} strokeWidth={1.5} strokeDasharray="4 2" pointerEvents="none" />}
      </>);
    }
    case 'path': {
      const s = shape as PathShape;
      return wrap(s.id, <>
        <path d={s.d} fill={st.fill ?? 'none'} stroke={st.stroke ?? '#888'}
          strokeWidth={st.strokeWidth ?? 1} style={cmn} />
        {selBox}
      </>);
    }
    case 'text': {
      const s = shape as TextShape;
      return wrap(s.id, <>
        <text x={s.x} y={s.y} fill={st.fill ?? '#ccc'} fontSize={st.fontSize ?? 14}
          fontFamily={st.fontFamily ?? 'sans-serif'} style={cmn}>{s.text}</text>
        {selBox}
      </>);
    }
    case 'group': {
      const s = shape as GroupShape;
      return wrap(s.id, <>
        {s.children.map((c) => renderShape(c, selectedIds, onMD))}
        {selBox}
      </>);
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// DRC overlay
// ---------------------------------------------------------------------------

export function buildDrcOverlay(violations: DRCViolation[], zoom: number): React.ReactNode {
  if (violations.length === 0) { return null; }
  return (
    <g data-testid="drc-overlays" className="drc-overlays" pointerEvents="none">
      {violations.map((v) => {
        const color = v.severity === 'error' ? '#ef4444' : '#f59e0b';
        const size = 20;
        return (
          <g key={v.id} data-testid={`drc-overlay-${v.id}`}>
            <circle cx={v.location.x} cy={v.location.y} r={size} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2 / zoom} strokeDasharray={`${4 / zoom} ${2 / zoom}`} />
            {v.actual !== undefined && v.required !== undefined && (
              <text x={v.location.x} y={v.location.y - size - 4 / zoom} textAnchor="middle" fill={color} fontSize={10 / zoom} fontFamily="JetBrains Mono, monospace">
                {v.actual.toFixed(1)} / {v.required}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Constraint visualization lines
// ---------------------------------------------------------------------------

export function buildConstraintLines(
  constraints: Constraint[],
  shapesForView: Shape[],
  zoom: number,
): React.ReactNode {
  if (constraints.length === 0) { return null; }
  const shapeMap = new Map(shapesForView.map((s) => [s.id, s]));
  const conflictIds = new Set(detectConflicts(constraints.filter((c) => c.enabled), shapesForView));

  return (
    <g data-testid="constraint-overlays" pointerEvents="none">
      {constraints.filter((c) => c.enabled).map((c) => {
        const centers = c.shapeIds.map((id) => {
          const s = shapeMap.get(id);
          return s ? getShapeCenter(s) : null;
        }).filter(Boolean) as { x: number; y: number }[];

        const isSatisfied = !conflictIds.has(c.id);
        const lineColor = isSatisfied ? '#22c55e' : '#ef4444';
        const labelColor = isSatisfied ? '#22c55e' : '#ef4444';

        if (centers.length < 2) {
          if (c.type === 'fixed' && centers.length === 1) {
            const fixedX = Number(c.params.x) || 0;
            const fixedY = Number(c.params.y) || 0;
            const dx = centers[0].x - fixedX;
            const dy = centers[0].y - fixedY;
            const isFixed = Math.abs(dx) < 1 && Math.abs(dy) < 1;
            const fixColor = isFixed ? '#22c55e' : '#ef4444';
            return (
              <g key={c.id}>
                <circle cx={centers[0].x} cy={centers[0].y} r={4 / zoom} fill="none" stroke={fixColor} strokeWidth={1.5 / zoom} />
                <line x1={centers[0].x - 4 / zoom} y1={centers[0].y} x2={centers[0].x + 4 / zoom} y2={centers[0].y} stroke={fixColor} strokeWidth={1 / zoom} />
                <line x1={centers[0].x} y1={centers[0].y - 4 / zoom} x2={centers[0].x} y2={centers[0].y + 4 / zoom} stroke={fixColor} strokeWidth={1 / zoom} />
              </g>
            );
          }
          return null;
        }

        const dx = centers[1].x - centers[0].x;
        const dy = centers[1].y - centers[0].y;
        const currentDist = Math.sqrt(dx * dx + dy * dy);

        let label: string = c.type;
        if (c.type === 'distance' && c.params.distance !== undefined) {
          label = `${currentDist.toFixed(0)}/${c.params.distance}`;
        } else if (c.type === 'pitch' && c.params.pitch !== undefined) {
          label = `pitch ${c.params.pitch}`;
        } else if (c.type === 'alignment') {
          const axis = String(c.params.axis ?? '') || 'x';
          const diff = axis === 'x' ? Math.abs(centers[0].x - centers[1].x) : Math.abs(centers[0].y - centers[1].y);
          label = `align-${axis} \u0394${diff.toFixed(0)}`;
        } else if (c.type === 'symmetric') {
          label = `sym-${c.params.axis || 'x'}`;
        } else if (c.type === 'equal') {
          label = `eq-${c.params.property || 'width'}`;
        }

        return (
          <g key={c.id}>
            <line x1={centers[0].x} y1={centers[0].y} x2={centers[1].x} y2={centers[1].y}
              stroke={lineColor} strokeWidth={1.2 / zoom} strokeDasharray={isSatisfied ? 'none' : `${4 / zoom} ${3 / zoom}`} opacity={0.8} />
            {isSatisfied && (
              <>
                <circle cx={(centers[0].x + centers[1].x) / 2} cy={(centers[0].y + centers[1].y) / 2} r={4 / zoom} fill="#22c55e" opacity={0.3} />
                <circle cx={(centers[0].x + centers[1].x) / 2} cy={(centers[0].y + centers[1].y) / 2} r={2 / zoom} fill="#22c55e" opacity={0.6} />
              </>
            )}
            <text x={(centers[0].x + centers[1].x) / 2} y={(centers[0].y + centers[1].y) / 2 - 6 / zoom}
              fill={labelColor} fontSize={9 / zoom} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight={isSatisfied ? 'normal' : 'bold'}>
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Draw preview (rect / circle / line in-progress)
// ---------------------------------------------------------------------------

export function buildDrawPreview(
  drawStart: { x: number; y: number } | null,
  drawCurrent: { x: number; y: number } | null,
  activeTool: string,
): React.ReactNode {
  if (!drawStart || !drawCurrent) { return null; }
  const x = Math.min(drawStart.x, drawCurrent.x);
  const y = Math.min(drawStart.y, drawCurrent.y);
  const w = Math.abs(drawCurrent.x - drawStart.x);
  const h = Math.abs(drawCurrent.y - drawStart.y);
  if (activeTool === 'circle') {
    const sz = Math.max(w, h);
    return <circle cx={x + sz / 2} cy={y + sz / 2} r={sz / 2}
      fill="rgba(0,240,255,0.1)" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" />;
  }
  if (activeTool === 'line') {
    return <line x1={drawStart.x} y1={drawStart.y} x2={drawCurrent.x} y2={drawCurrent.y}
      stroke={SEL} strokeWidth={2} strokeDasharray="4 2" />;
  }
  return <rect x={x} y={y} width={w} height={h}
    fill="rgba(0,240,255,0.1)" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" />;
}

// ---------------------------------------------------------------------------
// Marquee selection rectangle
// ---------------------------------------------------------------------------

export function buildMarqueeRect(
  marqueeStart: { x: number; y: number } | null,
  marqueeCurrent: { x: number; y: number } | null,
): React.ReactNode {
  if (!marqueeStart || !marqueeCurrent) { return null; }
  const x = Math.min(marqueeStart.x, marqueeCurrent.x);
  const y = Math.min(marqueeStart.y, marqueeCurrent.y);
  const w = Math.abs(marqueeCurrent.x - marqueeStart.x);
  const h = Math.abs(marqueeCurrent.y - marqueeStart.y);
  return <rect x={x} y={y} width={w} height={h}
    fill="rgba(0,240,255,0.1)" stroke="#00F0FF" strokeWidth={1} strokeDasharray="4 2" />;
}

// ---------------------------------------------------------------------------
// Connector ghost cursor
// ---------------------------------------------------------------------------

export function buildConnectorGhost(
  activeTool: string,
  cursorPos: { x: number; y: number } | null,
): React.ReactNode {
  if (activeTool !== 'connector' || !cursorPos) { return null; }
  return <circle cx={cursorPos.x} cy={cursorPos.y} r={3}
    fill="none" stroke={SEL} strokeWidth={1} strokeDasharray="4 2" pointerEvents="none" />;
}

// ---------------------------------------------------------------------------
// Path creation preview
// ---------------------------------------------------------------------------

export function buildPathPreview(
  pathPoints: PathPoint[],
  pathCursorPos: { x: number; y: number } | null,
  isDrawingPath: boolean,
  pathClickStart: { x: number; y: number } | null,
  pathDraggingHandle: boolean,
): React.ReactNode {
  if (!isDrawingPath && pathPoints.length === 0 && !pathClickStart) { return null; }
  const allPts = [...pathPoints];
  const elements: React.ReactNode[] = [];
  if (allPts.length > 0) {
    let dStr = `M ${allPts[0].x} ${allPts[0].y}`;
    for (let i = 1; i < allPts.length; i++) {
      const pt = allPts[i];
      if (pt.cp1 || pt.cp2) {
        const prev = allPts[i - 1];
        const cp1 = pt.cp1 || { x: prev.x, y: prev.y };
        const cp2 = pt.cp2 || { x: pt.x, y: pt.y };
        dStr += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${pt.x} ${pt.y}`;
      } else {
        dStr += ` L ${pt.x} ${pt.y}`;
      }
    }
    elements.push(<path key="path-preview-solid" d={dStr} fill="none" stroke={SEL} strokeWidth={2} pointerEvents="none" />);
  }
  if (pathCursorPos && allPts.length > 0) {
    const last = allPts[allPts.length - 1];
    elements.push(<line key="path-preview-dashed" x1={last.x} y1={last.y} x2={pathCursorPos.x} y2={pathCursorPos.y}
      stroke={SEL} strokeWidth={1} strokeDasharray="4 2" pointerEvents="none" />);
  }
  allPts.forEach((pt, i) => {
    elements.push(<rect key={`path-pt-${i}`} x={pt.x - 2} y={pt.y - 2} width={4} height={4}
      fill={SEL} stroke="none" pointerEvents="none" />);
    if (pt.cp1) {
      elements.push(<line key={`path-cp1-line-${i}`} x1={pt.x} y1={pt.y} x2={pt.cp1.x} y2={pt.cp1.y}
        stroke={SEL} strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
      elements.push(<circle key={`path-cp1-${i}`} cx={pt.cp1.x} cy={pt.cp1.y} r={2.5}
        fill={SEL} stroke="none" pointerEvents="none" />);
    }
    if (pt.cp2) {
      elements.push(<line key={`path-cp2-line-${i}`} x1={pt.x} y1={pt.y} x2={pt.cp2.x} y2={pt.cp2.y}
        stroke={SEL} strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
      elements.push(<circle key={`path-cp2-${i}`} cx={pt.cp2.x} cy={pt.cp2.y} r={2.5}
        fill={SEL} stroke="none" pointerEvents="none" />);
    }
  });
  if (pathClickStart && pathDraggingHandle && pathCursorPos) {
    const dx = pathCursorPos.x - pathClickStart.x;
    const dy = pathCursorPos.y - pathClickStart.y;
    const mirrorX = pathClickStart.x - dx;
    const mirrorY = pathClickStart.y - dy;
    elements.push(<rect key="path-drag-pt" x={pathClickStart.x - 2} y={pathClickStart.y - 2} width={4} height={4}
      fill={SEL} stroke="none" pointerEvents="none" />);
    elements.push(<line key="path-drag-handle-line" x1={mirrorX} y1={mirrorY} x2={pathCursorPos.x} y2={pathCursorPos.y}
      stroke={SEL} strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
    elements.push(<circle key="path-drag-cp1" cx={mirrorX} cy={mirrorY} r={2.5}
      fill={SEL} stroke="none" pointerEvents="none" />);
    elements.push(<circle key="path-drag-cp2" cx={pathCursorPos.x} cy={pathCursorPos.y} r={2.5}
      fill={SEL} stroke="none" pointerEvents="none" />);
  }
  return <g data-testid="path-preview">{elements}</g>;
}

// ---------------------------------------------------------------------------
// Path node editing overlay (for an existing selected PathShape)
// ---------------------------------------------------------------------------

export function buildPathEditOverlay(
  editingPathNodes: PathNode[] | null,
  selectedPathShapeId: string | null,
  onNodeDragStart: (nodeIndex: number, handle: 'point' | 'cp1' | 'cp2') => void,
  onToggleNodeType: (nodeIndex: number) => void,
): React.ReactNode {
  if (!editingPathNodes || !selectedPathShapeId) { return null; }
  const elements: React.ReactNode[] = [];
  editingPathNodes.forEach((node, i) => {
    if (node.cp1) {
      elements.push(<line key={`edit-cp1-line-${i}`} x1={node.x} y1={node.y} x2={node.cp1.x} y2={node.cp1.y}
        stroke="#FFD700" strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
      elements.push(<circle key={`edit-cp1-${i}`} cx={node.cp1.x} cy={node.cp1.y} r={3}
        fill="#FFD700" stroke="none" style={{ cursor: 'pointer' }}
        onMouseDown={(e) => { e.stopPropagation(); onNodeDragStart(i, 'cp1'); }} />);
    }
    if (node.cp2) {
      elements.push(<line key={`edit-cp2-line-${i}`} x1={node.x} y1={node.y} x2={node.cp2.x} y2={node.cp2.y}
        stroke="#FFD700" strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />);
      elements.push(<circle key={`edit-cp2-${i}`} cx={node.cp2.x} cy={node.cp2.y} r={3}
        fill="#FFD700" stroke="none" style={{ cursor: 'pointer' }}
        onMouseDown={(e) => { e.stopPropagation(); onNodeDragStart(i, 'cp2'); }} />);
    }
    const isSmooth = node.type === 'C' || node.type === 'Q';
    const titleText = isSmooth ? 'Smooth node (double-click to make corner)' : 'Corner node (double-click to make smooth)';
    if (isSmooth) {
      elements.push(<circle key={`edit-pt-${i}`} data-testid={`path-node-${i}`} cx={node.x} cy={node.y} r={3}
        fill={SEL} stroke="none" style={{ cursor: 'move' }}
        onMouseDown={(e) => { e.stopPropagation(); onNodeDragStart(i, 'point'); }}
        onDoubleClick={(e) => { e.stopPropagation(); onToggleNodeType(i); }}>
        <title>{titleText}</title>
      </circle>);
    } else {
      elements.push(<rect key={`edit-pt-${i}`} data-testid={`path-node-${i}`} x={node.x - 3} y={node.y - 3} width={6} height={6}
        fill={SEL} stroke="none" style={{ cursor: 'move' }}
        onMouseDown={(e) => { e.stopPropagation(); onNodeDragStart(i, 'point'); }}
        onDoubleClick={(e) => { e.stopPropagation(); onToggleNodeType(i); }}>
        <title>{titleText}</title>
      </rect>);
    }
  });
  return <g data-testid="path-edit-overlay">{elements}</g>;
}
