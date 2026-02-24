import { useState, useMemo } from 'react';
import { useProject, PROJECT_ID } from '@/lib/project-context';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, XCircle, ShieldCheck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import type { PartState } from '@shared/component-types';

export default function ValidationView() {
  const { issues, runValidation, deleteValidationIssue, addOutputLog, setActiveView } = useProject();
  const { toast } = useToast();
  const [pendingDismissId, setPendingDismissId] = useState<number | string | null>(null);
  const { data: componentParts } = useComponentParts(PROJECT_ID);

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
          <p className="text-muted-foreground mt-1 text-sm">Found {issues.length + componentIssues.length} potential issues in your design.</p>
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
        
        <ScrollArea className="flex-1">
          {issues.map((issue) => (
            <ContextMenu key={issue.id}>
              <ContextMenuTrigger asChild>
                <div data-testid={`row-issue-${issue.id}`} onClick={() => { if (issue.componentId) { setActiveView('architecture'); } }} className={cn("flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group", issue.componentId ? "cursor-pointer" : "cursor-default")} role={issue.componentId ? "button" : undefined} tabIndex={issue.componentId ? 0 : undefined} onKeyDown={issue.componentId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('architecture'); } } : undefined}>
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{issue.message}</h3>
                    {issue.suggestion && (
                      <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-emerald-500/80">Suggestion: {issue.suggestion}</span>
                      </div>
                    )}
                  </div>
                  <div className="md:w-32 text-xs font-mono text-primary bg-primary/10 px-2 py-1 self-start text-center">
                    {issue.componentId || 'GLOBAL'}
                  </div>
                  <div className="md:w-32">
                    <StyledTooltip content="Mark this issue as resolved" side="left">
                        <button data-testid={`button-resolve-${issue.id}`} aria-label={`Mark resolved: ${issue.message}`} onClick={(e) => { e.stopPropagation(); deleteValidationIssue(issue.id); addOutputLog(`[RESOLVED] Marked resolved: ${issue.message}`); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full">
                            Mark Resolved
                        </button>
                    </StyledTooltip>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                <ContextMenuItem onSelect={() => { deleteValidationIssue(issue.id); addOutputLog(`[RESOLVED] Marked resolved: ${issue.message}`); }}>Mark Resolved</ContextMenuItem>
                <ContextMenuItem onSelect={() => setActiveView('architecture')}>View in Architecture</ContextMenuItem>
                <ContextMenuItem onSelect={() => copyToClipboard(issue.message)}>Copy Issue Details</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-destructive" onSelect={() => setPendingDismissId(issue.id)}>Dismiss Issue</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          {componentParts && componentParts.length > 0 && (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Component Part Issues</h3>
                <span className="text-xs text-muted-foreground">({componentIssues.length})</span>
              </div>
              {componentIssues.map((issue) => (
                <div key={issue.id} data-testid={`row-component-issue-${issue.id}`} role="button" tabIndex={0} onClick={() => setActiveView('component_editor')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('component_editor'); } }} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{issue.message}</h3>
                    {issue.suggestion && (
                      <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-emerald-500/80">Suggestion: {issue.suggestion}</span>
                      </div>
                    )}
                  </div>
                  <div className="md:w-32 text-xs font-mono text-primary bg-primary/10 px-2 py-1 self-start text-center">
                    {issue.componentId}
                  </div>
                  <div className="md:w-32">
                    <button
                      data-testid={`button-view-component-${issue.id}`}
                      aria-label={`View in editor: ${issue.message}`}
                      onClick={(e) => { e.stopPropagation(); setActiveView('component_editor'); }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {issues.length === 0 && componentIssues.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground" data-testid="empty-state-validation">
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
          )}
        </ScrollArea>
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

function ActivityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-primary">
      <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
