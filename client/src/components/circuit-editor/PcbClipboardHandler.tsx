/**
 * PcbClipboardHandler — Invisible keyboard handler for PCB copy/paste/duplicate.
 *
 * Hooks Ctrl+C / Ctrl+V / Ctrl+D keyboard events and coordinates with
 * PcbClipboardManager. During paste mode, renders a semi-transparent SVG
 * ghost preview at the cursor position. Click to place, Escape to cancel.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PcbClipboardManager } from '@/lib/pcb/pcb-clipboard';
import type { ClipboardItem, TraceData, ZoneData, ViaData, InstanceData } from '@/lib/pcb/pcb-clipboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PcbClipboardHandlerProps {
  /** Currently selected PCB items (for Ctrl+C). */
  selectedItems: ReadonlyArray<ClipboardItem>;
  /** Current design ID (for cross-design net clearing). */
  designId: string;
  /** SVG container ref to compute cursor position in board coordinates. */
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** Callback when items are pasted (caller integrates into design state). */
  onPaste: (items: ClipboardItem[]) => void;
  /** Callback when items are duplicated in place. */
  onDuplicate: (items: ClipboardItem[]) => void;
  /** Optional toast callback for copy/paste feedback. */
  onToast?: (message: string) => void;
  /** Whether this handler is active (e.g. PCB view is focused). */
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mgr = PcbClipboardManager.getInstance();

function clientToSvg(
  svgEl: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) {
    return { x: clientX, y: clientY };
  }
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PcbClipboardHandler({
  selectedItems,
  designId,
  svgRef,
  onPaste,
  onDuplicate,
  onToast,
  active = true,
}: PcbClipboardHandlerProps) {
  const [pasteMode, setPasteMode] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const pasteModeRef = useRef(false);

  // Keep ref in sync for event handlers that capture stale closures
  pasteModeRef.current = pasteMode;

  // Subscribe to clipboard changes
  const clipboardState = useSyncExternalStore(
    useCallback((cb: () => void) => mgr.subscribe(cb), []),
    useCallback(() => mgr.getSnapshot(), []),
  );

  // Get preview items for ghost rendering
  const previewItems = pasteMode ? mgr.getClipboardPreview(cursorPos) : [];

  // -----------------------------------------------------------------------
  // Keyboard handler
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!active) {
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Escape cancels paste mode
      if (e.key === 'Escape' && pasteModeRef.current) {
        e.preventDefault();
        setPasteMode(false);
        return;
      }

      // Ctrl+C — copy selected items
      if (isCtrl && e.key === 'c' && selectedItems.length > 0) {
        // Don't prevent default if user is selecting text in an input
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        mgr.copy(selectedItems, designId);
        onToast?.(`${String(selectedItems.length)} item${selectedItems.length > 1 ? 's' : ''} copied`);
        return;
      }

      // Ctrl+V — enter paste mode
      if (isCtrl && e.key === 'v' && mgr.canPaste()) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        setPasteMode(true);
        return;
      }

      // Ctrl+D — duplicate in place
      if (isCtrl && e.key === 'd' && selectedItems.length > 0) {
        e.preventDefault();
        const result = mgr.duplicateInPlace(selectedItems);
        if (result) {
          onDuplicate(result);
          onToast?.(`${String(result.length)} item${result.length > 1 ? 's' : ''} duplicated`);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, selectedItems, designId, onPaste, onDuplicate, onToast]);

  // -----------------------------------------------------------------------
  // Mouse tracking during paste mode
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!pasteMode || !svgRef.current) {
      return;
    }

    function handleMouseMove(e: MouseEvent) {
      if (!svgRef.current) {
        return;
      }
      const pos = clientToSvg(svgRef.current, e.clientX, e.clientY);
      setCursorPos(pos);
    }

    function handleClick(e: MouseEvent) {
      if (!svgRef.current) {
        return;
      }
      e.preventDefault();
      const pos = clientToSvg(svgRef.current, e.clientX, e.clientY);
      const result = mgr.paste(pos, designId);
      if (result) {
        onPaste(result.items);
        onToast?.(`${String(result.items.length)} item${result.items.length > 1 ? 's' : ''} placed`);
      }
      setPasteMode(false);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick, { once: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
    };
  }, [pasteMode, svgRef, designId, onPaste, onToast]);

  // -----------------------------------------------------------------------
  // Render ghost preview
  // -----------------------------------------------------------------------

  if (!pasteMode || previewItems.length === 0) {
    return null;
  }

  return (
    <g data-testid="pcb-paste-preview" opacity={0.5} pointerEvents="none">
      {previewItems.map((item, idx) => (
        <GhostItem key={idx} item={item} />
      ))}
      <text
        x={cursorPos.x}
        y={cursorPos.y - 8}
        fill="#00F0FF"
        fontSize={3}
        textAnchor="middle"
        data-testid="pcb-clipboard-toast"
      >
        Click to place ({clipboardState?.items.length ?? 0} items)
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Ghost renderers
// ---------------------------------------------------------------------------

function GhostItem({ item }: { item: ClipboardItem }) {
  const d = item.data;
  switch (d.kind) {
    case 'trace':
      return <GhostTrace data={d} />;
    case 'zone':
      return <GhostZone data={d} />;
    case 'via':
      return <GhostVia data={d} />;
    case 'instance':
      return <GhostInstance data={d} />;
  }
}

function GhostTrace({ data }: { data: TraceData }) {
  if (data.points.length < 2) {
    return null;
  }
  const d = data.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${String(p.x)},${String(p.y)}`)
    .join(' ');
  return (
    <path
      d={d}
      fill="none"
      stroke="#00F0FF"
      strokeWidth={data.width}
      strokeDasharray="1 1"
      strokeLinecap="round"
    />
  );
}

function GhostZone({ data }: { data: ZoneData }) {
  if (data.polygon.length < 3) {
    return null;
  }
  const points = data.polygon.map((p) => `${String(p.x)},${String(p.y)}`).join(' ');
  return (
    <polygon
      points={points}
      fill="#00F0FF"
      fillOpacity={0.15}
      stroke="#00F0FF"
      strokeWidth={0.2}
      strokeDasharray="1 1"
    />
  );
}

function GhostVia({ data }: { data: ViaData }) {
  return (
    <circle
      cx={data.position.x}
      cy={data.position.y}
      r={data.outerDiameter / 2}
      fill="none"
      stroke="#00F0FF"
      strokeWidth={0.15}
      strokeDasharray="0.5 0.5"
    />
  );
}

function GhostInstance({ data }: { data: InstanceData }) {
  return (
    <rect
      x={data.position.x - 2}
      y={data.position.y - 1.5}
      width={4}
      height={3}
      fill="none"
      stroke="#00F0FF"
      strokeWidth={0.2}
      strokeDasharray="0.5 0.5"
      transform={`rotate(${String(data.rotation)} ${String(data.position.x)} ${String(data.position.y)})`}
    />
  );
}
