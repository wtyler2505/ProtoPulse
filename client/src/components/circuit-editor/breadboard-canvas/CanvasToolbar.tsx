/**
 * CanvasToolbar — breadboard canvas top toolbar.
 *
 * Extracted from breadboard-canvas/index.tsx (audit #32, phase 2 — W1.12b).
 * Purely presentational: all state lives in the parent; callbacks are passed in.
 */

import {
  MousePointer2,
  Pencil,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import ToolButton from '../ToolButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BoardAuditSummary } from '@/lib/breadboard-board-audit';
import type { BreadboardCoord } from '@/lib/circuit-editor/breadboard-model';
import type { Tool, WireInProgress } from './canvas-helpers';

export interface CanvasToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  showDrc: boolean;
  onToggleDrc: () => void;
  showConnectivityExplainer: boolean;
  onToggleConnectivityExplainer: () => void;
  boardAudit: BoardAuditSummary | null;
  onRunBoardAudit: () => void;
  hoveredCoord: BreadboardCoord | null;
  wireInProgress: WireInProgress | null;
}

export function CanvasToolbar({
  tool,
  onToolChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  showDrc,
  onToggleDrc,
  showConnectivityExplainer,
  onToggleConnectivityExplainer,
  boardAudit,
  onRunBoardAudit,
  hoveredCoord,
  wireInProgress,
}: CanvasToolbarProps) {
  const auditCriticalCount = boardAudit?.issues.filter((issue) => issue.severity === 'critical').length ?? 0;
  const auditWarningCount = boardAudit?.issues.filter((issue) => issue.severity === 'warning').length ?? 0;
  const auditToolbarLabel = boardAudit == null
    ? 'Run audit'
    : auditCriticalCount > 0
      ? `${String(auditCriticalCount)} critical`
      : auditWarningCount > 0
        ? `${String(auditWarningCount)} warning${auditWarningCount === 1 ? '' : 's'}`
        : 'Healthy';
  const auditToolbarTone = boardAudit == null
    ? 'border-border text-muted-foreground'
    : auditCriticalCount > 0
      ? 'border-red-500/40 bg-red-500/10 text-red-300'
      : auditWarningCount > 0
        ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
        : 'border-green-500/40 bg-green-500/10 text-green-300';

  return (
    <div className="h-8 border-b border-border bg-card/40 flex items-center px-2 gap-1 shrink-0">
      <ToolButton icon={MousePointer2} label="Select (1)" active={tool === 'select'} onClick={() => onToolChange('select')} testId="tool-select" />
      <ToolButton icon={Pencil} label="Wire (2)" active={tool === 'wire'} onClick={() => onToolChange('wire')} testId="tool-wire" />
      <ToolButton icon={Trash2} label="Delete (3)" active={tool === 'delete'} onClick={() => onToolChange('delete')} testId="tool-delete" />
      <div className="w-px h-4 bg-border mx-1" />
      <ToolButton icon={ZoomIn} label="Zoom in" onClick={onZoomIn} testId="tool-zoom-in" />
      <ToolButton icon={ZoomOut} label="Zoom out" onClick={onZoomOut} testId="tool-zoom-out" />
      <ToolButton icon={RotateCcw} label="Reset view" onClick={onResetView} testId="tool-reset-view" />
      <div className="w-px h-4 bg-border mx-1" />
      <ToolButton icon={ShieldAlert} label="DRC Check" active={showDrc} onClick={onToggleDrc} testId="tool-drc-toggle" />
      <ToolButton icon={HelpCircle} label="How a breadboard works" active={showConnectivityExplainer} onClick={onToggleConnectivityExplainer} testId="tool-connectivity-explainer-toggle" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="button-run-audit-inline"
        onClick={onRunBoardAudit}
        className={cn('ml-1 h-6 gap-1.5 px-2 text-[10px] uppercase tracking-[0.14em]', auditToolbarTone)}
      >
        <ShieldAlert className="h-3 w-3" />
        <span>{auditToolbarLabel}</span>
        {boardAudit && (
          <span className="tabular-nums opacity-90">{String(boardAudit.score)}</span>
        )}
      </Button>
      <div className="flex-1" />
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {zoom.toFixed(1)}x
        {hoveredCoord && (
          <> | {hoveredCoord.type === 'terminal'
            ? `${hoveredCoord.col}${hoveredCoord.row}`
            : `${hoveredCoord.rail}[${hoveredCoord.index}]`
          }</>
        )}
      </span>
      {wireInProgress && (
        <span className="text-[10px] text-primary ml-2">
          Drawing wire ({wireInProgress.points.length} pts) — dbl-click to finish, Esc to cancel
        </span>
      )}
    </div>
  );
}
