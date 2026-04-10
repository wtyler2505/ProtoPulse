import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircuitBoard,
  Info,
  Rocket,
  RefreshCw,
  ShieldAlert,
  XCircle,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BoardAuditIssue, BoardAuditSummary } from '@/lib/breadboard-board-audit';
import type { PreflightResult } from '@/lib/breadboard-preflight';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';
import CoachLearnMoreCard, { getLearnMoreContent } from './CoachLearnMoreCard';
import BreadboardReconciliationPanel from './BreadboardReconciliationPanel';

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
// Trap ID extraction — strip instance-specific suffixes from audit issue IDs
// ---------------------------------------------------------------------------

/**
 * Extract the base trap ID from an audit issue ID for learning card lookup.
 * Audit IDs have instance-specific suffixes (e.g. `missing-decoupling-5`,
 * `motor-bldc-polarity-7`). We progressively strip trailing `-segment` parts
 * until we find a match in the learning card map, or return the original.
 */
function extractTrapId(issueId: string): string {
  // Direct match first
  if (getLearnMoreContent(issueId)) {
    return issueId;
  }

  // Strip trailing segments one by one
  const parts = issueId.split('-');
  for (let i = parts.length - 1; i >= 1; i--) {
    const candidate = parts.slice(0, i).join('-');
    if (getLearnMoreContent(candidate)) {
      return candidate;
    }
  }

  return issueId;
}

// ---------------------------------------------------------------------------
// Issue row
// ---------------------------------------------------------------------------

function IssueRow({
  issue,
  onFocusIssue,
}: {
  issue: BoardAuditIssue;
  onFocusIssue?: (issue: BoardAuditIssue) => void;
}) {
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
          {onFocusIssue && issue.affectedInstanceIds.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid={`audit-focus-${issue.id}`}
                onClick={() => {
                  onFocusIssue(issue);
                }}
                className="h-7 px-2 text-[10px] uppercase tracking-[0.16em]"
              >
                Focus part
              </Button>
            </div>
          )}
          <CoachLearnMoreCard trapId={extractTrapId(issue.id)} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit panel
// ---------------------------------------------------------------------------

function preflightStatusIcon(status: 'pass' | 'warn' | 'fail') {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />;
    case 'warn':
      return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />;
    case 'fail':
      return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
  }
}

function preflightStatusBadgeClass(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'border-green-500/30 bg-green-500/15 text-green-300';
    case 'warn':
      return 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300';
    case 'fail':
      return 'border-red-500/30 bg-red-500/15 text-red-300';
  }
}

interface BreadboardBoardAuditPanelProps {
  audit: BoardAuditSummary | null;
  onFocusIssue?: (issue: BoardAuditIssue) => void;
  onRunAudit: () => void;
  onRunPreflight?: () => void;
  preflightResult?: PreflightResult | null;
  benchInsights?: BreadboardBenchInsight[];
  onShopMissing?: () => void;
}

export default function BreadboardBoardAuditPanel({
  audit: auditResult,
  onFocusIssue,
  onRunAudit,
  onRunPreflight,
  preflightResult,
  benchInsights,
  onShopMissing,
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
            <IssueRow key={issue.id} issue={issue} onFocusIssue={onFocusIssue} />
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

      {/* Pre-flight section */}
      {onRunPreflight && (
        <div className="border-t border-border/40 pt-3" data-testid="preflight-section">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Pre-flight Check</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="button-run-preflight"
              onClick={onRunPreflight}
              className="gap-1.5"
            >
              <Rocket className="h-3 w-3" />
              Ready to Build?
            </Button>
          </div>

          {/* Preflight results */}
          {preflightResult && (
            <div className="mt-2 flex flex-col gap-1.5" data-testid="preflight-results">
              {/* Overall status */}
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2',
                  preflightResult.overallStatus === 'pass' && 'border-green-500/20 bg-green-500/10',
                  preflightResult.overallStatus === 'warn' && 'border-yellow-500/20 bg-yellow-500/10',
                  preflightResult.overallStatus === 'fail' && 'border-red-500/20 bg-red-500/10',
                )}
                data-testid="preflight-overall-status"
              >
                {preflightStatusIcon(preflightResult.overallStatus)}
                <p
                  className={cn(
                    'text-xs font-medium',
                    preflightResult.overallStatus === 'pass' && 'text-green-300',
                    preflightResult.overallStatus === 'warn' && 'text-yellow-300',
                    preflightResult.overallStatus === 'fail' && 'text-red-300',
                  )}
                >
                  {preflightResult.overallStatus === 'pass' && 'All clear — ready to build!'}
                  {preflightResult.overallStatus === 'warn' && 'Review warnings before building'}
                  {preflightResult.overallStatus === 'fail' && 'Issues found — fix before building'}
                </p>
              </div>

              {/* Individual check rows */}
              {preflightResult.checks.map((check) => (
                <div
                  key={check.id}
                  data-testid={`preflight-check-${check.id}`}
                  className="flex items-start gap-2 rounded-md border border-border/30 bg-background/20 p-2"
                >
                  {preflightStatusIcon(check.status)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-medium text-foreground">{check.label}</p>
                      <Badge className={cn('px-1.5 py-0 text-[9px]', preflightStatusBadgeClass(check.status))}>
                        {check.status}
                      </Badge>
                    </div>
                    {check.status !== 'pass' && (
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{check.detail}</p>
                    )}
                    {check.status !== 'pass' && (
                      <CoachLearnMoreCard trapId={check.id} variant="compact" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stash reconciliation panel (S4-03) — shows after preflight */}
      {preflightResult && benchInsights && benchInsights.length > 0 && (
        <div className="border-t border-border pt-3 mt-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Stash Reconciliation
          </p>
          <BreadboardReconciliationPanel insights={benchInsights} onShop={onShopMissing} />
        </div>
      )}
    </div>
  );
}
