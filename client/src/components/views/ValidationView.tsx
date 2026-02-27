import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useValidation } from '@/lib/contexts/validation-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import type { ViewMode } from '@/lib/project-context';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, XCircle, ShieldCheck } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { copyToClipboard } from '@/lib/clipboard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { validatePart } from '@/lib/component-editor/validation';
import { runDRC, getDefaultDRCRules } from '@/lib/component-editor/drc';
import type { PartState } from '@shared/component-types';
import { useCircuitDesigns, useCircuitInstances, useCircuitNets } from '@/lib/circuit-editor/hooks';
import { runERC, type ERCInput } from '@/lib/circuit-editor/erc-engine';
import { DEFAULT_ERC_RULES, DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';
import type { ERCViolation, CircuitSettings } from '@shared/circuit-types';
import type { ComponentPart } from '@shared/schema';

export default function ValidationView() {
  const { issues, runValidation, deleteValidationIssue } = useValidation();
  const { addOutputLog } = useOutput();
  const { setActiveView } = useProjectMeta();
  const { toast } = useToast();
  const [pendingDismissId, setPendingDismissId] = useState<number | string | null>(null);
  const projectId = useProjectId();
  const { data: componentParts } = useComponentParts(projectId);

  const componentIssues = useMemo(() => {
    if (!componentParts || componentParts.length === 0) return [];
    return componentParts.flatMap((part) => {
      const partState: PartState = {
        meta: part.meta as PartState['meta'],
        connectors: part.connectors as PartState['connectors'],
        buses: part.buses as PartState['buses'],
        views: part.views as PartState['views'],
        constraints: part.constraints as PartState['constraints'],
      };
      const partName = partState.meta?.title || `Part #${part.id}`;
      return validatePart(partState).map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestion,
        componentId: partName,
      }));
    });
  }, [componentParts]);

  // DRC violations from component part geometry
  const drcDefaultRules = useMemo(() => getDefaultDRCRules(), []);
  const drcIssues = useMemo(() => {
    if (!componentParts || componentParts.length === 0) return [];
    const views = ['breadboard', 'schematic', 'pcb'] as const;
    return componentParts.flatMap((part) => {
      const partState: PartState = {
        meta: part.meta as PartState['meta'],
        connectors: part.connectors as PartState['connectors'],
        buses: part.buses as PartState['buses'],
        views: part.views as PartState['views'],
        constraints: part.constraints as PartState['constraints'],
      };
      const partName = partState.meta?.title || `Part #${part.id}`;
      return views.flatMap((view) => {
        if (!partState.views[view]?.shapes?.length) return [];
        return runDRC(partState, drcDefaultRules, view).map((v) => ({
          id: v.id,
          severity: v.severity,
          message: v.message,
          ruleType: v.ruleType,
          view,
          componentId: partName,
        }));
      });
    });
  }, [componentParts, drcDefaultRules]);

  // ERC violations from circuit schematics
  const { data: circuits } = useCircuitDesigns(projectId);
  const firstCircuitId = circuits?.[0]?.id ?? 0;
  const { data: circuitInstances } = useCircuitInstances(firstCircuitId);
  const { data: circuitNets } = useCircuitNets(firstCircuitId);

  const ercViolations = useMemo(() => {
    if (!circuitInstances || circuitInstances.length === 0 || !componentParts) return [];

    const partsMap = new Map<number, ComponentPart>();
    componentParts.forEach((p: ComponentPart) => partsMap.set(p.id, p));

    const circuitSettings: CircuitSettings = {
      ...DEFAULT_CIRCUIT_SETTINGS,
      ...(circuits?.[0]?.settings as Partial<CircuitSettings> | null),
    };

    const input: ERCInput = {
      instances: circuitInstances,
      nets: circuitNets ?? [],
      partsMap,
      settings: circuitSettings,
      rules: DEFAULT_ERC_RULES,
    };

    return runERC(input);
  }, [circuitInstances, circuitNets, componentParts, circuits]);

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info': return <AlertCircle className="w-5 h-5 text-primary" />;
      default: return null;
    }
  };

  return (
    <div className="h-full p-3 md:p-6 bg-background/50 flex flex-col items-center">
      <div className="w-full max-w-5xl flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold flex items-center gap-3">
             <ActivityIcon /> 
             System Validation
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">Found {issues.length + componentIssues.length + drcIssues.length + ercViolations.length} potential issues in your design.</p>
        </div>
        <StyledTooltip content="Run design rule validation checks" side="bottom">
            <button 
              data-testid="run-drc-checks"
              onClick={() => { runValidation(); toast({ title: 'Validation Running', description: 'Design rule checks initiated.' }); }}
              className="px-6 py-2 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]"
            >
              Run DRC Checks
            </button>
        </StyledTooltip>
      </div>

      <div className="w-full max-w-5xl flex-1 overflow-hidden bg-card/40 border border-border backdrop-blur-xl shadow-xl flex flex-col">
        <div className="hidden md:flex items-center gap-6 p-4 border-b border-border bg-muted/10 backdrop-blur text-xs font-semibold text-muted-foreground uppercase tracking-wider">
           <div className="w-8 text-center">Sev</div>
           <div className="flex-1">Description</div>
           <div className="w-32">Component</div>
           <div className="w-32">Action</div>
        </div>
        
        <VirtualizedIssueList
          issues={issues}
          componentIssues={componentIssues}
          drcIssues={drcIssues}
          ercIssues={ercViolations.map((v) => ({ id: v.id, severity: v.severity, message: v.message, ruleType: v.ruleType }))}
          hasComponentParts={!!componentParts && componentParts.length > 0}
          getIcon={getIcon}
          deleteValidationIssue={deleteValidationIssue}
          addOutputLog={addOutputLog}
          setActiveView={setActiveView}
          setPendingDismissId={setPendingDismissId}
          runValidation={runValidation}
          toast={toast}
        />
      </div>

      <AlertDialog open={pendingDismissId !== null} onOpenChange={(open) => { if (!open) setPendingDismissId(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Validation Issue</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this validation issue without resolving the underlying problem. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingDismissId !== null) { deleteValidationIssue(pendingDismissId); setPendingDismissId(null); toast({ title: 'Issue Dismissed', description: 'Validation issue has been dismissed.' }); } }}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type ArchIssue = { id: number | string; severity: string; message: string; suggestion?: string; componentId?: string };
type CompIssue = { id: string; severity: string; message: string; suggestion?: string; componentId: string };
type ERCIssue = { id: string; severity: string; message: string; ruleType: string };
type DRCIssue = { id: string; severity: string; message: string; ruleType: string; view: string; componentId: string };
type VirtualRow =
  | { type: 'arch'; issue: ArchIssue }
  | { type: 'section_header'; count: number }
  | { type: 'drc_header'; count: number }
  | { type: 'erc_header'; count: number }
  | { type: 'comp'; issue: CompIssue }
  | { type: 'drc'; issue: DRCIssue }
  | { type: 'erc'; issue: ERCIssue };

function VirtualizedIssueList({
  issues, componentIssues, drcIssues, ercIssues, hasComponentParts, getIcon,
  deleteValidationIssue, addOutputLog, setActiveView, setPendingDismissId, runValidation, toast,
}: {
  issues: ArchIssue[];
  componentIssues: CompIssue[];
  drcIssues: DRCIssue[];
  ercIssues: ERCIssue[];
  hasComponentParts: boolean;
  getIcon: (severity: string) => React.ReactNode;
  deleteValidationIssue: (id: number | string) => void;
  addOutputLog: (msg: string) => void;
  setActiveView: (view: ViewMode) => void;
  setPendingDismissId: (id: number | string | null) => void;
  runValidation: () => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<VirtualRow[]>(() => {
    const result: VirtualRow[] = issues.map((issue) => ({ type: 'arch' as const, issue }));
    if (hasComponentParts && componentIssues.length > 0) {
      result.push({ type: 'section_header' as const, count: componentIssues.length });
      for (const issue of componentIssues) {
        result.push({ type: 'comp' as const, issue });
      }
    }
    if (drcIssues.length > 0) {
      result.push({ type: 'drc_header' as const, count: drcIssues.length });
      for (const issue of drcIssues) {
        result.push({ type: 'drc' as const, issue });
      }
    }
    if (ercIssues.length > 0) {
      result.push({ type: 'erc_header' as const, count: ercIssues.length });
      for (const issue of ercIssues) {
        result.push({ type: 'erc' as const, issue });
      }
    }
    return result;
  }, [issues, componentIssues, drcIssues, ercIssues, hasComponentParts]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const t = rows[index].type;
      return (t === 'section_header' || t === 'erc_header' || t === 'drc_header') ? 48 : 72;
    },
    overscan: 10,
  });

  if (issues.length === 0 && componentIssues.length === 0 && drcIssues.length === 0 && ercIssues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-muted-foreground" data-testid="empty-state-validation">
        <ShieldCheck className="w-16 h-16 mb-4 text-emerald-500/20" />
        <p className="text-lg font-medium text-foreground">All Systems Nominal</p>
        <p className="text-sm mt-1">No design rule violations detected.</p>
        <p className="text-xs mt-3 max-w-sm text-center">
          Run DRC checks to validate your architecture against design rules, or use AI chat to analyze your design for potential issues.
        </p>
        <button
          onClick={() => { runValidation(); toast({ title: 'Validation Running', description: 'Design rule checks initiated.' }); }}
          className="mt-4 px-4 py-2 text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
          data-testid="button-run-drc-empty"
        >
          Run DRC Checks
        </button>
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
                    <div data-testid={`row-issue-${row.issue.id}`} onClick={() => { if (row.issue.componentId) { setActiveView('architecture'); } }} className={cn("flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group", row.issue.componentId ? "cursor-pointer" : "cursor-default")} role={row.issue.componentId ? "button" : undefined} tabIndex={row.issue.componentId ? 0 : undefined} onKeyDown={row.issue.componentId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('architecture'); } } : undefined}>
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
                    <ContextMenuItem onSelect={() => setActiveView('architecture')}>View in Architecture</ContextMenuItem>
                    <ContextMenuItem onSelect={() => copyToClipboard(row.issue.message)}>Copy Issue Details</ContextMenuItem>
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
              {row.type === 'drc' && (
                <div data-testid={`row-drc-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => setActiveView('component_editor')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('component_editor'); } }} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <div className="mt-1 text-[10px] text-muted-foreground font-mono">{row.issue.ruleType} ({row.issue.view})</div>
                  </div>
                  <div className="md:w-32 text-xs font-mono text-rose-500 bg-rose-500/10 px-2 py-1 self-start text-center">
                    {row.issue.componentId}
                  </div>
                  <div className="md:w-32">
                    <button
                      data-testid={`button-view-drc-${row.issue.id}`}
                      aria-label={`View in editor: ${row.issue.message}`}
                      onClick={(e) => { e.stopPropagation(); setActiveView('component_editor'); }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                    >
                      View
                    </button>
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
                    <div className="mt-1 text-[10px] text-muted-foreground font-mono">{row.issue.ruleType}</div>
                  </div>
                  <div className="md:w-32 text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-1 self-start text-center">
                    ERC
                  </div>
                  <div className="md:w-32">
                    <button
                      data-testid={`button-view-erc-${row.issue.id}`}
                      aria-label={`View in schematic: ${row.issue.message}`}
                      onClick={(e) => { e.stopPropagation(); setActiveView('schematic'); }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                    >
                      View
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-primary">
      <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
