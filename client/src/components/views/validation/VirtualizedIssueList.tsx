/* eslint-disable jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { useState, useMemo, useRef, useEffect, memo } from 'react';
import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldOff,
  HelpCircle,
  Wrench,
} from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { copyToClipboard } from '@/lib/clipboard';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { TrustBadge, type TrustBadgeKind } from '@/components/ui/TrustBadge';
import { DRC_EXPLANATIONS } from '@shared/drc-engine';
import { ReviewResolutionControls } from '@/components/views/ReviewResolutionControls';
import { hasRecipe } from '@/lib/remediation-wizard';
import { getRuleExplanation } from './validation-helpers';
import type { ArchIssue, CompIssue, ERCIssue, DRCIssue, VirtualRow } from './validation-helpers';
import type { ComplianceFinding } from '@/lib/standards-compliance';
import type { ViewMode } from '@/lib/project-context';
import type { DrcSuppressionTarget } from '@/components/views/DrcSuppressionDialog';
import type { useToast } from '@/hooks/use-toast';
import type { PrecheckResult, PrecheckStatus } from '@/lib/export-precheck';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import {
  getRadialAiDeliveryVerb,
  getRadialAiPromptDelivery,
  runRadialAiCommand,
  type RadialAiPromptDelivery,
} from '@/lib/radial-ai-commands';

/** Expandable DRC rule group header with "Why does this matter?" explanation toggle. */
function RuleGroupHeader({ ruleType, count }: { ruleType: string; count: number }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const explanation = DRC_EXPLANATIONS[ruleType];
  return (
    <div data-testid={`drc-rule-group-${ruleType}`} className="border-b border-border/30 bg-muted/10">
      <div className="flex items-center gap-2 px-6 py-2">
        <span className="text-[10px] font-mono text-muted-foreground">{ruleType}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
          {count}
        </Badge>
        {explanation && (
          <button
            data-testid={`rule-explanation-toggle-${ruleType}`}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
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

function safetyGateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function safetyGateSeverity(status: PrecheckStatus): 'error' | 'warning' {
  return status === 'fail' ? 'error' : 'warning';
}

function safetyGateKind(status: PrecheckStatus): TrustBadgeKind {
  if (status === 'fail') {
    return 'unverified';
  }
  if (status === 'warn') {
    return 'estimated';
  }
  return 'verified';
}

function safetyGateLabel(status: PrecheckStatus): string {
  if (status === 'fail') {
    return 'BLOCKED';
  }
  if (status === 'warn') {
    return 'WARN';
  }
  return 'PASS';
}

function getSafetyGateIcon(status: PrecheckStatus): ReactNode {
  if (status === 'fail') {
    return <XCircle className="h-5 w-5 text-destructive" />;
  }
  if (status === 'warn') {
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  }
  return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
}

function safetyGateTargetView(name: string): ViewMode {
  const normalized = safetyGateId(name);
  if (normalized.includes('exact-part') || normalized.includes('mechanical')) {
    return 'component_editor';
  }
  if (normalized.includes('breadboard')) {
    return 'breadboard';
  }
  if (normalized.includes('ai-generated')) {
    return 'generative_design';
  }
  if (normalized.includes('inventory') || normalized.includes('lifecycle')) {
    return 'procurement';
  }
  return 'validation';
}

function sendValidationIssueToAi(
  target: ValidationRadialTarget,
  context: RadialCommandEventDetail['context'],
  delivery: RadialAiPromptDelivery = 'draft',
): void {
  runRadialAiCommand({
    intent: 'fix_issue',
    intro:
      'Explain this validation issue, why it matters, and the safest concrete fix path. Keep the answer practical for an electronics design workflow.',
    summary: `Validation issue: ${target.message}`,
    historyLabel: `Fix issue: ${target.message}`,
    context,
    delivery,
    targetDetails: [
      `Severity: ${target.severity}`,
      `Issue kind: ${target.kind}`,
      `Instance id: ${target.instanceId}`,
      target.componentId ? `Component: ${target.componentId}` : '',
      target.ruleType ? `Rule: ${target.ruleType}` : '',
      target.safetyGateName ? `Safety gate: ${target.safetyGateName}` : '',
    ].filter(Boolean),
    sections: [
      {
        title: 'Local explanation',
        lines: [target.explanation],
      },
      {
        title: 'Issue copy text',
        lines: target.copyText.split('\n').filter(Boolean),
      },
    ],
    finalInstruction:
      'Explain the failure in plain language, propose the exact fix, name the view or artifact to inspect next, and call out any hardware assumptions that must be verified.',
  });
}

type ValidationRadialTargetKind = 'safety' | 'arch' | 'comp' | 'drc' | 'erc' | 'compliance';

interface ValidationRadialTarget {
  id: string;
  kind: ValidationRadialTargetKind;
  instanceId: string;
  message: string;
  severity: string;
  copyText: string;
  explanation: string;
  componentId?: string;
  ruleType?: string;
  safetyGateName?: string;
}

export const VirtualizedIssueList = memo(function VirtualizedIssueList({
  issues,
  componentIssues,
  drcIssues,
  ercIssues,
  safetyGateIssues,
  complianceResult,
  hasComponentParts,
  getIcon,
  deleteValidationIssue,
  addOutputLog,
  setActiveView,
  setPendingDismissId,
  runValidation,
  toast,
  onIssueFocus,
  onSuppress,
  onFix,
}: {
  issues: ArchIssue[];
  componentIssues: CompIssue[];
  drcIssues: DRCIssue[];
  ercIssues: ERCIssue[];
  safetyGateIssues?: readonly PrecheckResult[];
  complianceResult: { findings: ComplianceFinding[] } | null;
  hasComponentParts: boolean;
  getIcon: (severity: string) => ReactNode;
  deleteValidationIssue: (id: number | string) => void;
  addOutputLog: (msg: string) => void;
  setActiveView: (view: ViewMode) => void;
  setPendingDismissId: (id: number | string | null) => void;
  runValidation: () => void;
  toast: ReturnType<typeof useToast>['toast'];
  onIssueFocus?: (componentId: string | undefined) => void;
  onSuppress?: (target: DrcSuppressionTarget) => void;
  onFix?: (ruleType: string, violationMessage: string, violationId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const safetyGateRows = safetyGateIssues ?? [];

  const rows = useMemo<VirtualRow[]>(() => {
    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    const bySeverity = <T extends { severity: string }>(a: T, b: T) =>
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);

    const sortedArch = [...issues].sort(bySeverity);
    const result: VirtualRow[] = [];

    if (safetyGateRows.length > 0) {
      result.push({ type: 'safety_gate_header' as const, count: safetyGateRows.length });
      for (const issue of safetyGateRows) {
        result.push({ type: 'safety_gate' as const, issue });
      }
    }

    result.push(...sortedArch.map((issue) => ({ type: 'arch' as const, issue })));

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
        if (group) {
          group.push(issue);
        } else {
          byRule.set(issue.ruleType, [issue]);
        }
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
  }, [issues, componentIssues, drcIssues, ercIssues, safetyGateRows, complianceResult, hasComponentParts]);

  const radialTargets = useMemo(() => {
    const targets = new Map<string, ValidationRadialTarget>();
    for (const row of rows) {
      if (row.type === 'safety_gate') {
        const id = `safety:${safetyGateId(row.issue.name)}`;
        targets.set(id, {
          id,
          kind: 'safety',
          instanceId: safetyGateId(row.issue.name),
          message: row.issue.message,
          severity: safetyGateSeverity(row.issue.status),
          safetyGateName: row.issue.name,
          explanation: row.issue.message,
          copyText: `${row.issue.name}\nStatus: ${row.issue.status}\n${row.issue.message}`,
        });
      } else if (row.type === 'arch') {
        const id = `arch:${row.issue.id}`;
        const suggestion = row.issue.suggestion ? `\nSuggestion: ${row.issue.suggestion}` : '';
        const component = row.issue.componentId ? `\nComponent: ${row.issue.componentId}` : '\nComponent: GLOBAL';
        targets.set(id, {
          id,
          kind: 'arch',
          instanceId: String(row.issue.id),
          message: row.issue.message,
          severity: row.issue.severity,
          componentId: row.issue.componentId,
          explanation: row.issue.suggestion ?? getRuleExplanation('completeness', 'Validation'),
          copyText: `${row.issue.severity.toUpperCase()}: ${row.issue.message}${component}${suggestion}`,
        });
      } else if (row.type === 'comp') {
        const id = `comp:${row.issue.id}`;
        const suggestion = row.issue.suggestion ? `\nSuggestion: ${row.issue.suggestion}` : '';
        targets.set(id, {
          id,
          kind: 'comp',
          instanceId: row.issue.id,
          message: row.issue.message,
          severity: row.issue.severity,
          componentId: row.issue.componentId,
          explanation: row.issue.suggestion ?? getRuleExplanation('completeness', 'Component validation'),
          copyText: `${row.issue.severity.toUpperCase()}: ${row.issue.message}\nComponent: ${row.issue.componentId}${suggestion}`,
        });
      } else if (row.type === 'drc') {
        const id = `drc:${row.issue.id}`;
        targets.set(id, {
          id,
          kind: 'drc',
          instanceId: row.issue.id,
          message: row.issue.message,
          severity: row.issue.severity,
          componentId: row.issue.componentId,
          ruleType: row.issue.ruleType,
          explanation: getRuleExplanation(row.issue.ruleType, 'DRC'),
          copyText: `${row.issue.severity.toUpperCase()}: ${row.issue.message}\nRule: ${row.issue.ruleType}\nView: ${row.issue.view}\nComponent: ${row.issue.componentId}`,
        });
      } else if (row.type === 'erc') {
        const id = `erc:${row.issue.id}`;
        targets.set(id, {
          id,
          kind: 'erc',
          instanceId: row.issue.id,
          message: row.issue.message,
          severity: row.issue.severity,
          ruleType: row.issue.ruleType,
          explanation: getRuleExplanation(row.issue.ruleType, 'ERC'),
          copyText: `${row.issue.severity.toUpperCase()}: ${row.issue.message}\nRule: ${row.issue.ruleType}`,
        });
      } else if (row.type === 'compliance') {
        const id = `compliance:${row.issue.id}`;
        targets.set(id, {
          id,
          kind: 'compliance',
          instanceId: row.issue.id,
          message: row.issue.message,
          severity: row.issue.severity,
          componentId: row.issue.componentId,
          ruleType: row.issue.ruleId,
          explanation: row.issue.remediation,
          copyText: `${row.issue.severity.toUpperCase()}: ${row.issue.message}\nStandard: ${row.issue.standardRef}\nDomain: ${row.issue.domain}\nFix: ${row.issue.remediation}`,
        });
      }
    }
    return targets;
  }, [rows]);

  useEffect(() => {
    const jumpToTarget = (target: ValidationRadialTarget) => {
      switch (target.kind) {
        case 'safety':
          setActiveView(safetyGateTargetView(target.safetyGateName ?? target.instanceId));
          break;
        case 'arch':
          onIssueFocus ? onIssueFocus(target.componentId) : setActiveView('architecture');
          break;
        case 'comp':
        case 'drc':
          setActiveView('component_editor');
          break;
        case 'erc':
          setActiveView('schematic');
          break;
        case 'compliance':
          if (target.componentId) {
            onIssueFocus ? onIssueFocus(target.componentId) : setActiveView('validation');
          } else {
            setActiveView('validation');
          }
          break;
      }
    };

    const suppressTarget = (target: ValidationRadialTarget): boolean => {
      if (!onSuppress) {
        return false;
      }
      if (target.kind === 'arch') {
        onSuppress({
          ruleId: 'arch',
          instanceId: target.instanceId,
          message: target.message,
          severity: target.severity,
        });
        return true;
      }
      if (target.kind === 'comp') {
        onSuppress({
          ruleId: 'comp',
          instanceId: target.instanceId,
          message: target.message,
          severity: target.severity,
        });
        return true;
      }
      if ((target.kind === 'drc' || target.kind === 'erc') && target.ruleType) {
        onSuppress({
          ruleId: target.ruleType,
          instanceId: target.instanceId,
          message: target.message,
          severity: target.severity,
        });
        return true;
      }
      return false;
    };

    const handleRadialCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      const detail = event.detail as RadialCommandEventDetail | undefined;
      if (!detail || detail.context.view !== 'validation') {
        return;
      }

      if (detail.commandId === 'rerun_validation') {
        runValidation();
        toast({ title: 'Validation Running', description: 'Design rule and compliance checks initiated.' });
        detail.handled = true;
        return;
      }

      if (detail.commandId === 'open_validation_summary') {
        const summary =
          document.querySelector<HTMLElement>('[data-testid="validation-safety-gates"]') ??
          document.querySelector<HTMLElement>('[data-testid="validation-view"]');
        summary?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        summary?.focus?.({ preventScroll: true });
        toast({ title: 'Validation Summary', description: 'Safety gates and issue totals are centered for review.' });
        detail.handled = true;
        return;
      }

      const target = detail.context.targetId ? radialTargets.get(detail.context.targetId) : undefined;
      if (!target) {
        return;
      }

      switch (detail.commandId) {
        case 'jump_to_source':
          jumpToTarget(target);
          detail.handled = true;
          break;
        case 'copy_issue':
          copyToClipboard(target.copyText);
          toast({ title: 'Issue Copied', description: 'Validation issue details copied.' });
          detail.handled = true;
          break;
        case 'explain_issue': {
          const delivery = getRadialAiPromptDelivery(detail);
          const deliveryVerb = getRadialAiDeliveryVerb(delivery);
          sendValidationIssueToAi(target, detail.context, delivery);
          addOutputLog(`[VALIDATION] ${deliveryVerb} issue AI prompt: ${target.message}`);
          toast({
            title: `AI Issue ${deliveryVerb}`,
            description:
              delivery === 'send-now' ? 'Sent validation prompt to AI chat.' : 'Drafted validation prompt in AI chat.',
          });
          detail.handled = true;
          break;
        }
        case 'ai_issue_fix': {
          const delivery = getRadialAiPromptDelivery(detail);
          const deliveryVerb = getRadialAiDeliveryVerb(delivery);
          sendValidationIssueToAi(target, detail.context, delivery);
          addOutputLog(`[VALIDATION] ${deliveryVerb} issue fix AI prompt: ${target.message}`);
          toast({
            title: `AI Fix ${deliveryVerb}`,
            description:
              delivery === 'send-now'
                ? 'Sent validation fix prompt to AI chat.'
                : 'Drafted validation fix prompt in AI chat.',
          });
          detail.handled = true;
          break;
        }
        case 'create_task':
          addOutputLog(`[TASK] Validation follow-up: ${target.message}`);
          toast({ title: 'Task Drafted', description: target.message });
          detail.handled = true;
          break;
        case 'suppress_issue':
          if (suppressTarget(target)) {
            toast({ title: 'Suppression Opened', description: target.message });
          } else {
            toast({
              title: 'Suppress Unavailable',
              description: 'This validation item does not support suppression yet.',
            });
          }
          detail.handled = true;
          break;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
  }, [addOutputLog, onIssueFocus, onSuppress, radialTargets, runValidation, setActiveView, toast]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const t = rows[index].type;
      if (t === 'section_header' || t === 'erc_header' || t === 'drc_header' || t === 'safety_gate_header') {
        return 48;
      }
      if (t === 'drc_rule_header') {
        return 36;
      }
      return 72;
    },
    overscan: 10,
  });

  if (
    issues.length === 0 &&
    componentIssues.length === 0 &&
    drcIssues.length === 0 &&
    ercIssues.length === 0 &&
    safetyGateRows.length === 0
  ) {
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
                <div className="flex items-center gap-3 border-b border-border bg-muted/20 p-4.5 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Component Part Issues
                  </h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'safety_gate_header' && (
                <div className="flex items-center gap-3 border-b border-border bg-muted/20 p-4.5 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Release Safety Gates
                  </h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'safety_gate' && (
                <div
                  data-testid={`row-safety-gate-${safetyGateId(row.issue.name)}`}
                  data-issue-id={`safety:${safetyGateId(row.issue.name)}`}
                  data-issue-label={row.issue.name}
                  className="group flex flex-col gap-2 border-b border-border/50 p-3 transition-colors hover:bg-muted/30 md:flex-row md:items-start md:gap-6 md:p-4"
                >
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getSafetyGateIcon(row.issue.status)}
                    <span className="text-xs font-medium uppercase md:hidden">
                      {safetyGateSeverity(row.issue.status)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-medium text-foreground">{row.issue.name}</h3>
                      <TrustBadge kind={safetyGateKind(row.issue.status)} label={safetyGateLabel(row.issue.status)} />
                    </div>
                    <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{row.issue.message}</p>
                    <ReviewResolutionControls issueId={`safety-${safetyGateId(row.issue.name)}`} />
                  </div>
                  <div className="self-start bg-primary/10 px-2 py-1 text-center font-mono text-xs text-primary md:w-32">
                    SAFETY
                  </div>
                  <div className="md:w-32">
                    <button
                      type="button"
                      data-testid={`button-review-safety-gate-${safetyGateId(row.issue.name)}`}
                      aria-label={`Review safety gate: ${row.issue.name}`}
                      onClick={() => setActiveView(safetyGateTargetView(row.issue.name))}
                      className="w-full border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      Review
                    </button>
                  </div>
                </div>
              )}
              {row.type === 'arch' && (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      data-testid={`row-issue-${row.issue.id}`}
                      data-issue-id={`arch:${row.issue.id}`}
                      data-issue-label={row.issue.message}
                      onClick={() => {
                        if (row.issue.componentId) {
                          onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture');
                        }
                      }}
                      className={cn(
                        'flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group',
                        row.issue.componentId ? 'cursor-pointer' : 'cursor-default',
                      )}
                      role={row.issue.componentId ? 'button' : undefined}
                      tabIndex={row.issue.componentId ? 0 : undefined}
                      onKeyDown={
                        row.issue.componentId
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture');
                              }
                            }
                          : undefined
                      }
                    >
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
                          <button
                            type="button"
                            data-testid={`button-resolve-${row.issue.id}`}
                            aria-label={`Mark resolved: ${row.issue.message}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteValidationIssue(row.issue.id);
                              addOutputLog(`[RESOLVED] Marked resolved: ${row.issue.message}`);
                            }}
                            className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                          >
                            Mark Resolved
                          </button>
                        </StyledTooltip>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                    <ContextMenuItem
                      onSelect={() => {
                        deleteValidationIssue(row.issue.id);
                        addOutputLog(`[RESOLVED] Marked resolved: ${row.issue.message}`);
                      }}
                    >
                      Mark Resolved
                    </ContextMenuItem>
                    <ContextMenuItem
                      onSelect={() => {
                        onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture');
                      }}
                    >
                      View in Architecture
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => copyToClipboard(row.issue.message)}>
                      Copy Issue Details
                    </ContextMenuItem>
                    {onSuppress && (
                      <ContextMenuItem
                        onSelect={() => {
                          onSuppress({
                            ruleId: 'arch',
                            instanceId: String(row.issue.id),
                            message: row.issue.message,
                            severity: row.issue.severity,
                          });
                        }}
                      >
                        <ShieldOff className="w-3.5 h-3.5 mr-1.5 text-yellow-500" />
                        Suppress
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive" onSelect={() => setPendingDismissId(row.issue.id)}>
                      Dismiss Issue
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )}
              {row.type === 'comp' && (
                <div
                  data-testid={`row-component-issue-${row.issue.id}`}
                  data-issue-id={`comp:${row.issue.id}`}
                  data-issue-label={row.issue.message}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveView('component_editor')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveView('component_editor');
                    }
                  }}
                  className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer"
                >
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveView('component_editor');
                      }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                    >
                      View
                    </button>
                  </div>
                </div>
              )}
              {row.type === 'drc_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Design Rule Check (DRC)
                  </h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'drc_rule_header' && <RuleGroupHeader ruleType={row.ruleType} count={row.count} />}
              {row.type === 'drc' && (
                <div
                  data-testid={`row-drc-issue-${row.issue.id}`}
                  data-issue-id={`drc:${row.issue.id}`}
                  data-issue-label={row.issue.message}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveView('component_editor')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveView('component_editor');
                    }
                  }}
                  className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <StyledTooltip content={getRuleExplanation(row.issue.ruleType, 'DRC')} side="bottom">
                      <div className="mt-1 text-[11px] text-muted-foreground font-mono cursor-help inline-block">
                        {row.issue.ruleType} ({row.issue.view})
                      </div>
                    </StyledTooltip>
                    <ReviewResolutionControls issueId={String(row.issue.id)} />
                  </div>
                  <div className="md:w-32 text-xs font-mono text-rose-500 bg-rose-500/10 px-2 py-1 self-start text-center">
                    {row.issue.componentId}
                  </div>
                  <div className="md:w-32 flex flex-col gap-1">
                    <button
                      data-testid={`button-view-drc-${row.issue.id}`}
                      aria-label={`View in editor: ${row.issue.message}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveView('component_editor');
                      }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-2 w-full"
                    >
                      View
                    </button>
                    {onSuppress && (
                      <button
                        data-testid={`button-suppress-drc-${row.issue.id}`}
                        aria-label={`Suppress: ${row.issue.message}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSuppress({
                            ruleId: row.issue.ruleType,
                            instanceId: row.issue.id,
                            message: row.issue.message,
                            severity: row.issue.severity,
                          });
                        }}
                        className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-yellow-500/50 bg-background hover:bg-yellow-600 hover:text-white hover:border-yellow-600 px-3 py-2 w-full flex items-center justify-center gap-1"
                      >
                        <ShieldOff className="w-3 h-3" />
                        Suppress
                      </button>
                    )}
                    {onFix && hasRecipe(row.issue.ruleType) && (
                      <button
                        data-testid={`button-fix-drc-${row.issue.id}`}
                        aria-label={`Fix: ${row.issue.message}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFix(row.issue.ruleType, row.issue.message, row.issue.id);
                        }}
                        className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-emerald-500/50 bg-background hover:bg-emerald-600 hover:text-white hover:border-emerald-600 px-3 py-2 w-full flex items-center justify-center gap-1"
                      >
                        <Wrench className="w-3 h-3" />
                        Fix
                      </button>
                    )}
                  </div>
                </div>
              )}
              {row.type === 'erc_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Electrical Rule Check (ERC)
                  </h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'erc' && (
                <div
                  data-testid={`row-erc-issue-${row.issue.id}`}
                  data-issue-id={`erc:${row.issue.id}`}
                  data-issue-label={row.issue.message}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveView('schematic')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveView('schematic');
                    }
                  }}
                  className="group flex cursor-pointer flex-col gap-2.5 border-b border-border/50 p-3.5 transition-colors hover:bg-muted/30 md:flex-row md:items-start md:gap-6 md:p-4.5"
                >
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <StyledTooltip content={getRuleExplanation(row.issue.ruleType, 'ERC')} side="bottom">
                      <div className="mt-1 text-[11px] text-muted-foreground font-mono cursor-help inline-block">
                        {row.issue.ruleType}
                      </div>
                    </StyledTooltip>
                    <ReviewResolutionControls issueId={String(row.issue.id)} />
                  </div>
                  <div className="md:w-32 text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-1 self-start text-center">
                    ERC
                  </div>
                  <div className="md:w-32 flex flex-col gap-1.5">
                    <button
                      data-testid={`button-view-erc-${row.issue.id}`}
                      aria-label={`View in schematic: ${row.issue.message}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveView('schematic');
                      }}
                      className="w-full border border-border bg-background px-3 py-2 text-xs transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      View
                    </button>
                    {onSuppress && (
                      <button
                        data-testid={`button-suppress-erc-${row.issue.id}`}
                        aria-label={`Suppress: ${row.issue.message}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSuppress({
                            ruleId: row.issue.ruleType,
                            instanceId: row.issue.id,
                            message: row.issue.message,
                            severity: row.issue.severity,
                          });
                        }}
                        className="flex w-full items-center justify-center gap-1 border border-yellow-500/50 bg-background px-3 py-2 text-xs transition-colors hover:border-yellow-600 hover:bg-yellow-600 hover:text-white"
                      >
                        <ShieldOff className="w-3 h-3" />
                        Suppress
                      </button>
                    )}
                    {onFix && hasRecipe(row.issue.ruleType) && (
                      <button
                        data-testid={`button-fix-erc-${row.issue.id}`}
                        aria-label={`Fix: ${row.issue.message}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFix(row.issue.ruleType, row.issue.message, row.issue.id);
                        }}
                        className="flex w-full items-center justify-center gap-1 border border-emerald-500/50 bg-background px-3 py-2 text-xs transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
                      >
                        <Wrench className="w-3 h-3" />
                        Fix
                      </button>
                    )}
                  </div>
                </div>
              )}
              {row.type === 'compliance_header' && (
                <div className="flex items-center gap-3 border-b border-border bg-muted/20 p-4.5 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Standards Compliance
                  </h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'compliance' && (
                <div
                  data-testid={`row-compliance-issue-${row.issue.id}`}
                  data-issue-id={`compliance:${row.issue.id}`}
                  data-issue-label={row.issue.message}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (row.issue.componentId) onIssueFocus?.(row.issue.componentId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (row.issue.componentId) onIssueFocus?.(row.issue.componentId);
                    }
                  }}
                  className={cn(
                    'group flex flex-col gap-2.5 border-b border-border/50 p-3.5 transition-colors hover:bg-muted/30 md:flex-row md:items-start md:gap-6 md:p-4.5',
                    row.issue.componentId ? 'cursor-pointer' : 'cursor-default',
                  )}
                >
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(
                      row.issue.severity === 'violation'
                        ? 'error'
                        : row.issue.severity === 'warning'
                          ? 'warning'
                          : 'info',
                    )}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="text-[10px] text-muted-foreground font-mono inline-block bg-muted px-1.5 py-0.5 rounded">
                        {row.issue.standardRef}
                      </div>
                      <div className="text-[10px] text-muted-foreground capitalize">{row.issue.domain}</div>
                      {row.issue.componentLabel && (
                        <div className="text-[10px] text-muted-foreground/80 ml-2">
                          Target: {row.issue.componentLabel}
                        </div>
                      )}
                    </div>
                    {row.issue.remediation && (
                      <p className="mt-2 text-xs text-muted-foreground/80 bg-background/50 border border-border/30 p-2 rounded-md">
                        <span className="font-semibold text-foreground/70 mr-1">Fix:</span>
                        {row.issue.remediation}
                      </p>
                    )}
                  </div>
                  <div className="md:w-32 flex flex-col gap-1.5">
                    {row.issue.componentId && (
                      <button
                        data-testid={`button-view-compliance-${row.issue.id}`}
                        aria-label={`View component: ${row.issue.message}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onIssueFocus?.(row.issue.componentId);
                        }}
                        className="w-full border border-border bg-background px-3 py-2 text-xs transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        View
                      </button>
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

export function ActivityIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8 text-primary"
    >
      <path
        d="M22 12H18L15 21L9 3L6 12H2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
