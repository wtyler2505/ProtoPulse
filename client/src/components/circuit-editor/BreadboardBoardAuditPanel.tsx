import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircuitBoard,
  Info,
  RefreshCw,
  ShieldAlert,
  XCircle,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BoardAuditIssue, BoardAuditSummary } from '@/lib/breadboard-board-audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 85) {
    return 'text-green-400';
  }
  if (score >= 65) {
    return 'text-yellow-400';
  }
  if (score >= 40) {
    return 'text-orange-400';
  }
  return 'text-red-400';
}

function scoreBgRing(score: number): string {
  if (score >= 85) {
    return 'border-green-500/30 bg-green-500/10';
  }
  if (score >= 65) {
    return 'border-yellow-500/30 bg-yellow-500/10';
  }
  if (score >= 40) {
    return 'border-orange-500/30 bg-orange-500/10';
  }
  return 'border-red-500/30 bg-red-500/10';
}

function severityIcon(severity: BoardAuditIssue['severity']) {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />;
    case 'info':
      return <Info className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
  }
}

function categoryIcon(category: BoardAuditIssue['category']) {
  switch (category) {
    case 'power':
      return <Zap className="h-3 w-3 shrink-0 text-amber-400" />;
    case 'signal':
      return <CircuitBoard className="h-3 w-3 shrink-0 text-cyan-400" />;
    case 'layout':
      return <CircuitBoard className="h-3 w-3 shrink-0 text-purple-400" />;
    case 'safety':
      return <ShieldAlert className="h-3 w-3 shrink-0 text-red-400" />;
    case 'missing':
      return <AlertTriangle className="h-3 w-3 shrink-0 text-orange-400" />;
  }
}

function severityBadgeClass(severity: BoardAuditIssue['severity']): string {
  switch (severity) {
    case 'critical':
      return 'border-red-500/30 bg-red-500/15 text-red-300';
    case 'warning':
      return 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300';
    case 'info':
      return 'border-blue-500/30 bg-blue-500/15 text-blue-300';
  }
}

// ---------------------------------------------------------------------------
// Issue row
// ---------------------------------------------------------------------------

function IssueRow({ issue }: { issue: BoardAuditIssue }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid={`audit-issue-${issue.id}`}
      className="rounded-lg border border-border/50 bg-background/30"
    >
      <button
        type="button"
        onClick={() => {
          setExpanded((prev) => !prev);
        }}
        className="flex w-full items-start gap-2 p-2.5 text-left"
        data-testid={`audit-issue-toggle-${issue.id}`}
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        {severityIcon(issue.severity)}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{issue.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              {categoryIcon(issue.category)}
              {issue.category}
            </span>
            {issue.affectedInstanceIds.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {String(issue.affectedInstanceIds.length)} instance{issue.affectedInstanceIds.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/40 px-2.5 py-2" data-testid={`audit-issue-detail-${issue.id}`}>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{issue.detail}</p>
          {issue.affectedPinIds.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {issue.affectedPinIds.map((pinId) => (
                <Badge key={pinId} variant="outline" className="px-1.5 py-0 text-[9px]">
                  {pinId}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit panel
// ---------------------------------------------------------------------------

interface BreadboardBoardAuditPanelProps {
  audit: BoardAuditSummary | null;
  onRunAudit: () => void;
}

export default function BreadboardBoardAuditPanel({
  audit: auditResult,
  onRunAudit,
}: BreadboardBoardAuditPanelProps) {
  const criticalCount = auditResult?.issues.filter((i) => i.severity === 'critical').length ?? 0;
  const warningCount = auditResult?.issues.filter((i) => i.severity === 'warning').length ?? 0;
  const infoCount = auditResult?.issues.filter((i) => i.severity === 'info').length ?? 0;

  return (
    <div data-testid="breadboard-board-audit-panel" className="flex flex-col gap-3">
      {/* Score badge + refresh */}
      <div className="flex items-center justify-between gap-3">
        {auditResult ? (
          <div className="flex items-center gap-3">
            <div
              data-testid="audit-score-badge"
              className={cn(
                'inline-flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-lg font-bold',
                scoreBgRing(auditResult.score),
                scoreColor(auditResult.score),
              )}
            >
              {String(auditResult.score)}
            </div>
            <div>
              <p className={cn('text-sm font-semibold', scoreColor(auditResult.score))} data-testid="audit-label">
                {auditResult.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {String(auditResult.stats.totalInstances)} placed, {String(auditResult.stats.totalWires)} wires
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-xs">Run an audit to check board health</p>
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="button-run-audit"
          onClick={onRunAudit}
          className="gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          Audit
        </Button>
      </div>

      {/* Severity counts */}
      {auditResult && auditResult.issues.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="audit-severity-counts">
          {criticalCount > 0 && (
            <Badge className={severityBadgeClass('critical')}>
              {String(criticalCount)} critical
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge className={severityBadgeClass('warning')}>
              {String(warningCount)} warning{warningCount === 1 ? '' : 's'}
            </Badge>
          )}
          {infoCount > 0 && (
            <Badge className={severityBadgeClass('info')}>
              {String(infoCount)} info
            </Badge>
          )}
        </div>
      )}

      {/* Issue list */}
      {auditResult && auditResult.issues.length > 0 && (
        <div
          className="flex max-h-[340px] flex-col gap-1.5 overflow-y-auto pr-1"
          data-testid="audit-issue-list"
        >
          {auditResult.issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      {/* Clean board message */}
      {auditResult && auditResult.issues.length === 0 && (
        <div
          className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2"
          data-testid="audit-clean-board"
        >
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <p className="text-xs text-green-300">Board is healthy — no issues detected.</p>
        </div>
      )}
    </div>
  );
}
