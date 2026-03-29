/**
 * VirtualizedIssueList — virtualized rendering of validation issues
 * grouped by type (architecture, component, DRC, ERC, compliance).
 *
 * Extracted from ValidationView.tsx to reduce file size.
 */

import { useState, useMemo, useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ViewMode } from '@/lib/project-context';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, ShieldCheck, ShieldOff, HelpCircle, Wrench } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { copyToClipboard } from '@/lib/clipboard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DRC_EXPLANATIONS } from '@shared/drc-engine';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReviewResolutionControls } from '@/components/views/ReviewResolutionControls';
import { hasRecipe } from '@/lib/remediation-wizard';
import type { DrcSuppressionTarget } from '@/components/views/DrcSuppressionDialog';
import type { ComplianceFinding } from '@/lib/standards-compliance';

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export type ArchIssue = { id: number | string; severity: string; message: string; suggestion?: string; componentId?: string };
export type CompIssue = { id: string; severity: string; message: string; suggestion?: string; componentId: string };
export type ERCIssue = { id: string; severity: string; message: string; ruleType: string };
export type DRCIssue = { id: string; severity: string; message: string; ruleType: string; view: string; componentId: string };
export type VirtualRow =
  | { type: 'arch'; issue: ArchIssue }
  | { type: 'section_header'; count: number }
  | { type: 'drc_header'; count: number }
  | { type: 'drc_rule_header'; ruleType: string; count: number }
  | { type: 'erc_header'; count: number }
  | { type: 'compliance_header'; count: number }
  | { type: 'comp'; issue: CompIssue }
  | { type: 'drc'; issue: DRCIssue }
  | { type: 'erc'; issue: ERCIssue }
  | { type: 'compliance'; issue: ComplianceFinding };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RULE_CATEGORY_EXPLANATIONS: Record<string, string> = {
  clearance: 'Minimum distance between conductive elements',
  overlap: 'Shapes or pads that overlap incorrectly',
  'missing-connection': 'Required connections that are absent',
  'unconnected-pin': 'Component pins with no net attachment',
  'minimum-width': 'Traces narrower than the design rule minimum',
  'thermal-relief': 'Insufficient thermal relief on pads connected to planes',
  'silkscreen-overlap': 'Silkscreen text overlapping pads or other silkscreen',
  'courtyard-violation': 'Component courtyards overlapping other components',
  'drill-size': 'Drill holes smaller than fabrication minimum',
  'annular-ring': 'Annular ring too small for reliable plating',
};

function getRuleExplanation(ruleType: string, fallbackPrefix: string): string {
  return DRC_EXPLANATIONS[ruleType] ?? RULE_CATEGORY_EXPLANATIONS[ruleType] ?? `${fallbackPrefix} rule: ${ruleType}`;
}

// ---------------------------------------------------------------------------
// RuleGroupHeader
// ---------------------------------------------------------------------------

function RuleGroupHeader({ ruleType, count }: { ruleType: string; count: number }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const explanation = DRC_EXPLANATIONS[ruleType];
  return (
    <div data-testid={`drc-rule-group-${ruleType}`} className="border-b border-border/30 bg-muted/10">
      <div className="flex items-center gap-2 px-6 py-2">
        <span className="text-[10px] font-mono text-muted-foreground">{ruleType}</span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{count}</Badge>
        {explanation && (
          <button
            data-testid={`rule-explanation-toggle-${ruleType}`}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
            onClick={() => setShowExplanation((v) => !v)}
            aria-label={`${showExplanation ? 'Hide' : 'Show'} explanation for ${ruleType}`}
          >
            <HelpCircle className="w-3 h-3" />
            <span>Why does this matter?</span>
          </button>
        )}
      </div>
      {showExplanation && explanation && (
        <p
          data-testid={`rule-explanation-${ruleType}`}
          className="px-6 pb-2 text-xs text-muted-foreground leading-relaxed"
        >
          {explanation}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VirtualizedIssueList
// ---------------------------------------------------------------------------

export interface VirtualizedIssueListProps {
  issues: ArchIssue[];
  componentIssues: CompIssue[];
  drcIssues: DRCIssue[];
  ercIssues: ERCIssue[];
  complianceResult: { findings: ComplianceFinding[] } | null;
  hasComponentParts: boolean;
  getIcon: (severity: string) => React.ReactNode;
  deleteValidationIssue: (id: number | string) => void;
  addOutputLog: (msg: string) => void;
  setActiveView: (view: ViewMode) => void;
  setPendingDismissId: (id: number | string | null) => void;
  runValidation: () => void;
  toast: ReturnType<typeof useToast>['toast'];
  onIssueFocus?: (componentId: string | undefined) => void;
  onSuppress?: (target: DrcSuppressionTarget) => void;
  onFix?: (ruleType: string, violationMessage: string, violationId: string) => void;
}

export const VirtualizedIssueList = memo(function VirtualizedIssueList(props: VirtualizedIssueListProps) {
  const {
    issues, componentIssues, drcIssues, ercIssues, complianceResult, hasComponentParts, getIcon,
    deleteValidationIssue, addOutputLog, setActiveView, setPendingDismissId, runValidation,
    onIssueFocus, onSuppress, onFix,
  } = props;

  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<VirtualRow[]>(() => {
    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    const bySeverity = <T extends { severity: string }>(a: T, b: T) =>
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);

    const sortedArch = [...issues].sort(bySeverity);
    const result: VirtualRow[] = sortedArch.map((issue) => ({ type: 'arch' as const, issue }));

    if (hasComponentParts && componentIssues.length > 0) {
      const sortedComp = [...componentIssues].sort(bySeverity);
      result.push({ type: 'section_header' as const, count: sortedComp.length });
      for (const issue of sortedComp) {
        result.push({ type: 'comp' as const, issue });
      }
    }
    if (drcIssues.length > 0) {
      const sortedDrc = [...drcIssues].sort(bySeverity);
      result.push({ type: 'drc_header' as const, count: sortedDrc.length });
      const byRule = new Map<string, DRCIssue[]>();
      for (const issue of sortedDrc) {
        const group = byRule.get(issue.ruleType);
        if (group) { group.push(issue); } else { byRule.set(issue.ruleType, [issue]); }
      }
      for (const [ruleType, ruleIssues] of Array.from(byRule.entries())) {
        if (byRule.size > 1) {
          result.push({ type: 'drc_rule_header' as const, ruleType, count: ruleIssues.length });
        }
        for (const issue of ruleIssues) {
          result.push({ type: 'drc' as const, issue });
        }
      }
    }
    if (ercIssues.length > 0) {
      const sortedErc = [...ercIssues].sort(bySeverity);
      result.push({ type: 'erc_header' as const, count: sortedErc.length });
      for (const issue of sortedErc) {
        result.push({ type: 'erc' as const, issue });
      }
    }
    if (complianceResult && complianceResult.findings.length > 0) {
      const sortedComp = [...complianceResult.findings].sort((a, b) => {
        const sevOrder: Record<string, number> = { violation: 0, warning: 1, recommendation: 2 };
        return (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3);
      });
      result.push({ type: 'compliance_header' as const, count: sortedComp.length });
      for (const issue of sortedComp) {
        result.push({ type: 'compliance' as const, issue });
      }
    }
    return result;
  }, [issues, componentIssues, drcIssues, ercIssues, complianceResult, hasComponentParts]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const t = rows[index].type;
      if (t === 'section_header' || t === 'erc_header' || t === 'drc_header') { return 48; }
      if (t === 'drc_rule_header') { return 36; }
      return 72;
    },
    overscan: 10,
  });

  if (issues.length === 0 && componentIssues.length === 0 && drcIssues.length === 0 && ercIssues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="empty-state-validation">
        <EmptyState
          icon={ShieldCheck}
          title="All Systems Nominal"
          description="No design rule violations detected. Run DRC checks to validate your architecture against design rules."
          actionLabel="Run DRC Checks"
          actionTestId="button-run-drc-empty"
          onAction={runValidation}
        />
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'section_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Component Part Issues</h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'arch' && (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div data-testid={`row-issue-${row.issue.id}`} onClick={() => { if (row.issue.componentId) { onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture'); } }} className={cn("flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group", row.issue.componentId ? "cursor-pointer" : "cursor-default")} role={row.issue.componentId ? "button" : undefined} tabIndex={row.issue.componentId ? 0 : undefined} onKeyDown={row.issue.componentId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture'); } } : undefined}>
                      <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                        {getIcon(row.issue.severity)}
                        <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                        {row.issue.suggestion && (
                          <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-emerald-500/80">Suggestion: {row.issue.suggestion}</span>
                          </div>
                        )}
                        <ReviewResolutionControls issueId={String(row.issue.id)} />
                      </div>
                      <div className="md:w-32 text-xs font-mono text-primary bg-primary/10 px-2 py-1 self-start text-center">
                        {row.issue.componentId || 'GLOBAL'}
                      </div>
                      <div className="md:w-32">
                        <StyledTooltip content="Mark this issue as resolved" side="left">
                          <button data-testid={`button-resolve-${row.issue.id}`} aria-label={`Mark resolved: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); deleteValidationIssue(row.issue.id); addOutputLog(`[RESOLVED] Marked resolved: ${row.issue.message}`); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full">
                            Mark Resolved
                          </button>
                        </StyledTooltip>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                    <ContextMenuItem onSelect={() => { deleteValidationIssue(row.issue.id); addOutputLog(`[RESOLVED] Marked resolved: ${row.issue.message}`); }}>Mark Resolved</ContextMenuItem>
                    <ContextMenuItem onSelect={() => { onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture'); }}>View in Architecture</ContextMenuItem>
                    <ContextMenuItem onSelect={() => copyToClipboard(row.issue.message)}>Copy Issue Details</ContextMenuItem>
                    {onSuppress && (
                      <ContextMenuItem onSelect={() => { onSuppress({ ruleId: 'arch', instanceId: String(row.issue.id), message: row.issue.message, severity: row.issue.severity }); }}>
                        <ShieldOff className="w-3.5 h-3.5 mr-1.5 text-yellow-500" />
                        Suppress
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive" onSelect={() => setPendingDismissId(row.issue.id)}>Dismiss Issue</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )}
              {row.type === 'comp' && (
                <div data-testid={`row-component-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => setActiveView('component_editor')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('component_editor'); } }} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    {row.issue.suggestion && (
                      <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-emerald-500/80">Suggestion: {row.issue.suggestion}</span>
                      </div>
                    )}
                    <ReviewResolutionControls issueId={String(row.issue.id)} />
                  </div>
                  <div className="md:w-32 text-xs font-mono text-primary bg-primary/10 px-2 py-1 self-start text-center">
                    {row.issue.componentId}
                  </div>
                  <div className="md:w-32">
                    <button
                      data-testid={`button-view-component-${row.issue.id}`}
                      aria-label={`View in editor: ${row.issue.message}`}
                      onClick={(e) => { e.stopPropagation(); setActiveView('component_editor'); }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                    >
                      View
                    </button>
                  </div>
                </div>
              )}
              {row.type === 'drc_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Design Rule Check (DRC)</h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'drc_rule_header' && (
                <RuleGroupHeader ruleType={row.ruleType} count={row.count} />
              )}
              {row.type === 'drc' && (
                <div data-testid={`row-drc-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => setActiveView('component_editor')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('component_editor'); } }} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <StyledTooltip content={getRuleExplanation(row.issue.ruleType, 'DRC')} side="bottom">
                      <div className="mt-1 text-[10px] text-muted-foreground font-mono cursor-help inline-block">{row.issue.ruleType} ({row.issue.view})</div>
                    </StyledTooltip>
                    <ReviewResolutionControls issueId={String(row.issue.id)} />
                  </div>
                  <div className="md:w-32 text-xs font-mono text-rose-500 bg-rose-500/10 px-2 py-1 self-start text-center">
                    {row.issue.componentId}
                  </div>
                  <div className="md:w-32 flex flex-col gap-1">
                    <button data-testid={`button-view-drc-${row.issue.id}`} aria-label={`View in editor: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); setActiveView('component_editor'); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full">View</button>
                    {onSuppress && (
                      <button data-testid={`button-suppress-drc-${row.issue.id}`} aria-label={`Suppress: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); onSuppress({ ruleId: row.issue.ruleType, instanceId: row.issue.id, message: row.issue.message, severity: row.issue.severity }); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-yellow-500/50 bg-background hover:bg-yellow-600 hover:text-white hover:border-yellow-600 px-3 py-1.5 w-full flex items-center justify-center gap-1">
                        <ShieldOff className="w-3 h-3" />Suppress
                      </button>
                    )}
                    {onFix && hasRecipe(row.issue.ruleType) && (
                      <button data-testid={`button-fix-drc-${row.issue.id}`} aria-label={`Fix: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); onFix(row.issue.ruleType, row.issue.message, row.issue.id); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-emerald-500/50 bg-background hover:bg-emerald-600 hover:text-white hover:border-emerald-600 px-3 py-1.5 w-full flex items-center justify-center gap-1">
                        <Wrench className="w-3 h-3" />Fix
                      </button>
                    )}
                  </div>
                </div>
              )}
              {row.type === 'erc_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Electrical Rule Check (ERC)</h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'erc' && (
                <div data-testid={`row-erc-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => setActiveView('schematic')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('schematic'); } }} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <StyledTooltip content={getRuleExplanation(row.issue.ruleType, 'ERC')} side="bottom">
                      <div className="mt-1 text-[10px] text-muted-foreground font-mono cursor-help inline-block">{row.issue.ruleType}</div>
                    </StyledTooltip>
                    <ReviewResolutionControls issueId={String(row.issue.id)} />
                  </div>
                  <div className="md:w-32 text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-1 self-start text-center">ERC</div>
                  <div className="md:w-32 flex flex-col gap-1">
                    <button data-testid={`button-view-erc-${row.issue.id}`} aria-label={`View in schematic: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); setActiveView('schematic'); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full">View</button>
                    {onSuppress && (
                      <button data-testid={`button-suppress-erc-${row.issue.id}`} aria-label={`Suppress: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); onSuppress({ ruleId: row.issue.ruleType, instanceId: row.issue.id, message: row.issue.message, severity: row.issue.severity }); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-yellow-500/50 bg-background hover:bg-yellow-600 hover:text-white hover:border-yellow-600 px-3 py-1.5 w-full flex items-center justify-center gap-1">
                        <ShieldOff className="w-3 h-3" />Suppress
                      </button>
                    )}
                    {onFix && hasRecipe(row.issue.ruleType) && (
                      <button data-testid={`button-fix-erc-${row.issue.id}`} aria-label={`Fix: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); onFix(row.issue.ruleType, row.issue.message, row.issue.id); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-emerald-500/50 bg-background hover:bg-emerald-600 hover:text-white hover:border-emerald-600 px-3 py-1.5 w-full flex items-center justify-center gap-1">
                        <Wrench className="w-3 h-3" />Fix
                      </button>
                    )}
                  </div>
                </div>
              )}
              {row.type === 'compliance_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Standards Compliance</h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'compliance' && (
                <div data-testid={`row-compliance-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => { if (row.issue.componentId) onIssueFocus?.(row.issue.componentId); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (row.issue.componentId) onIssueFocus?.(row.issue.componentId); } }} className={cn("flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group", row.issue.componentId ? "cursor-pointer" : "cursor-default")}>
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity === 'violation' ? 'error' : row.issue.severity === 'warning' ? 'warning' : 'info')}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="text-[10px] text-muted-foreground font-mono inline-block bg-muted px-1.5 py-0.5 rounded">{row.issue.standardRef}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{row.issue.domain}</div>
                      {row.issue.componentLabel && (
                        <div className="text-[10px] text-muted-foreground/80 ml-2">Target: {row.issue.componentLabel}</div>
                      )}
                    </div>
                    {row.issue.remediation && (
                      <p className="mt-2 text-xs text-muted-foreground/80 bg-background/50 border border-border/30 p-2 rounded-md">
                        <span className="font-semibold text-foreground/70 mr-1">Fix:</span>
                        {row.issue.remediation}
                      </p>
                    )}
                  </div>
                  <div className="md:w-32 flex flex-col gap-1">
                    {row.issue.componentId && (
                      <button data-testid={`button-view-compliance-${row.issue.id}`} aria-label={`View component: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); onIssueFocus?.(row.issue.componentId); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full">View</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
