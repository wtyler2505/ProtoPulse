import { useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrustBadge, type TrustBadgeKind } from '@/components/ui/TrustBadge';
import { cn } from '@/lib/utils';
import type { BoardAuditSummary } from '@/lib/breadboard-board-audit';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';

type WorkSurfacePartTrust = Pick<
  BreadboardSelectedPartModel,
  'pinMapConfidence' | 'readyNow' | 'trustTier' | 'verificationLevel' | 'verificationStatus'
>;

interface BreadboardWorkSurfaceStatusProps {
  boardAudit: BoardAuditSummary | null;
  selectedRefDes: string | null;
  selectedPartTrust: WorkSurfacePartTrust | null;
  coachMoveCount: number;
  coachPlanVisible: boolean;
  canToggleCoachPlan: boolean;
  canViewIn3D: boolean;
  onRunBoardAudit: () => void;
  onToggleCoachPlan: () => void;
  onViewIn3D: () => void;
}

function getAuditTone(boardAudit: BoardAuditSummary | null): {
  label: string;
  className: string;
  criticalCount: number;
  warningCount: number;
} {
  if (!boardAudit) {
    return {
      label: 'Not checked',
      className: 'border-border/70 bg-background/75 text-muted-foreground',
      criticalCount: 0,
      warningCount: 0,
    };
  }

  const criticalCount = boardAudit.issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = boardAudit.issues.filter((issue) => issue.severity === 'warning').length;

  if (criticalCount > 0) {
    return {
      label: `${String(criticalCount)} critical`,
      className: 'border-red-500/40 bg-red-500/15 text-red-200',
      criticalCount,
      warningCount,
    };
  }

  if (warningCount > 0) {
    return {
      label: `${String(warningCount)} warning${warningCount === 1 ? '' : 's'}`,
      className: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-200',
      criticalCount,
      warningCount,
    };
  }

  return {
    label: 'Healthy',
    className: 'border-green-500/40 bg-green-500/15 text-green-200',
    criticalCount,
    warningCount,
  };
}

function formatStatus(value: string): string {
  return value.replace(/[-_]/g, ' ');
}

function trustKindForTier(tier: BreadboardSelectedPartModel['trustTier']): TrustBadgeKind {
  if (tier === 'verified-exact') {
    return 'verified';
  }
  if (tier === 'connector-defined') {
    return 'estimated';
  }
  return 'unverified';
}

function trustLabelForTier(tier: BreadboardSelectedPartModel['trustTier']): string {
  switch (tier) {
    case 'verified-exact':
      return 'VERIFIED EXACT';
    case 'connector-defined':
      return 'CONNECTOR DEFINED';
    case 'stash-absent':
      return 'STASH ABSENT';
    case 'heuristic':
    default:
      return 'HEURISTIC';
  }
}

export function BreadboardWorkSurfaceStatus({
  boardAudit,
  selectedRefDes,
  selectedPartTrust,
  coachMoveCount,
  coachPlanVisible,
  canToggleCoachPlan,
  canViewIn3D,
  onRunBoardAudit,
  onToggleCoachPlan,
  onViewIn3D,
}: BreadboardWorkSurfaceStatusProps) {
  const [collapsed, setCollapsed] = useState(false);
  const auditTone = getAuditTone(boardAudit);
  const coachLabel = selectedRefDes
    ? `${selectedRefDes}: ${String(coachMoveCount)} coach move${coachMoveCount === 1 ? '' : 's'}`
    : 'Select a part for coach moves';
  const positionClass = selectedRefDes ? 'bottom-3 left-3' : 'left-3 top-3';

  return (
    <aside
      aria-label="Breadboard work surface status"
      className={cn(
        'pointer-events-auto absolute z-30 max-h-[min(11rem,calc(100%-1.5rem))] min-h-[3.5rem] min-w-[14rem] max-w-[min(22rem,calc(100%-1.5rem))] resize overflow-auto rounded-md border border-border/70 bg-background/95 p-2 text-xs shadow-lg shadow-black/25 backdrop-blur',
        positionClass,
        collapsed ? 'w-[15rem]' : 'w-[18rem]',
      )}
      data-collapsed={String(collapsed)}
      data-resize-axis="both"
      data-resizable="true"
      data-testid="breadboard-work-surface-status"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase text-foreground">
              Board Health
            </p>
            <p className="truncate text-[10px] text-muted-foreground">{coachLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canViewIn3D && (
            <button
              type="button"
              aria-label="View selected breadboard part in 3D"
              className="inline-flex h-7 min-w-7 items-center justify-center rounded border border-cyan-400/50 px-1.5 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-400/10"
              data-testid="button-breadboard-surface-view-in-3d"
              onClick={onViewIn3D}
              title="View selected part in 3D"
            >
              <Box className="h-3.5 w-3.5" />
              <span className="ml-1">3D</span>
            </button>
          )}
          <button
            type="button"
            aria-label={collapsed ? 'Expand breadboard status' : 'Collapse breadboard status'}
            aria-expanded={!collapsed}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            data-testid="button-breadboard-surface-status-toggle"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-2 space-y-2" data-testid="breadboard-work-surface-status-body">
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 bg-card/45 px-2 py-1.5"
            data-testid="breadboard-work-surface-health"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px]', auditTone.className)}>
                {auditTone.label}
              </Badge>
              {boardAudit && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  score {String(boardAudit.score)}
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 gap-1.5 px-2 text-[10px]"
              data-testid="button-breadboard-surface-audit"
              onClick={onRunBoardAudit}
            >
              <RefreshCw className="h-3 w-3" />
              Audit
            </Button>
          </div>

          {selectedPartTrust && (
            <div
              className="rounded border border-border/50 bg-card/45 px-2 py-1.5"
              data-testid="breadboard-work-surface-provenance"
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                Part provenance
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <TrustBadge
                  kind={trustKindForTier(selectedPartTrust.trustTier)}
                  label={trustLabelForTier(selectedPartTrust.trustTier)}
                />
                <Badge
                  variant="outline"
                  className="h-5 border-border/70 bg-background/60 px-1.5 text-[10px] text-muted-foreground"
                  data-testid="breadboard-work-surface-pin-map"
                >
                  pin {formatStatus(selectedPartTrust.pinMapConfidence)}
                </Badge>
                <Badge
                  variant="outline"
                  className="h-5 border-border/70 bg-background/60 px-1.5 text-[10px] text-muted-foreground"
                  data-testid="breadboard-work-surface-verification"
                >
                  {formatStatus(selectedPartTrust.verificationLevel)}
                </Badge>
                <Badge
                  variant={selectedPartTrust.readyNow ? 'default' : 'outline'}
                  className="h-5 px-1.5 text-[10px]"
                  data-testid="breadboard-work-surface-stash"
                >
                  {selectedPartTrust.readyNow ? 'ready now' : 'stash missing'}
                </Badge>
                <Badge
                  variant="outline"
                  className="h-5 border-border/70 bg-background/60 px-1.5 text-[10px] text-muted-foreground"
                  data-testid="breadboard-work-surface-verification-status"
                >
                  {formatStatus(selectedPartTrust.verificationStatus)}
                </Badge>
              </div>
            </div>
          )}

          {canViewIn3D && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-400/30 bg-cyan-400/5 px-2 py-1.5"
              data-testid="breadboard-work-surface-3d"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <Box className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                <span className="truncate text-[10px] text-muted-foreground">
                  {selectedRefDes ? `${selectedRefDes} 3D context` : '3D context'}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Open selected breadboard part in 3D from work surface"
                className="h-6 gap-1.5 px-2 text-[10px]"
                data-testid="button-breadboard-surface-view-in-3d-body"
                onClick={onViewIn3D}
              >
                <Box className="h-3 w-3" />
                Open 3D
              </Button>
            </div>
          )}

          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 bg-card/45 px-2 py-1.5"
            data-testid="breadboard-work-surface-coach"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
              <span className="truncate text-[10px] text-muted-foreground">{coachLabel}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 gap-1.5 px-2 text-[10px]"
              aria-expanded={coachPlanVisible}
              data-testid="button-breadboard-surface-coach-toggle"
              disabled={!canToggleCoachPlan}
              onClick={onToggleCoachPlan}
            >
              {coachPlanVisible ? 'Hide plan' : 'Show plan'}
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
