/**
 * FirstRunChecklist — floating onboarding panel
 *
 * Shows a progress bar and 6-step checklist for new users.
 * Auto-detects completion from project state via the ChecklistManager.
 * Dismissible, collapsible, and draggable-positioned at bottom-right.
 */

import { useEffect, useMemo, useState } from 'react';
import { useFirstRunChecklist } from '@/lib/first-run-checklist';
import type { ProjectStateSnapshot } from '@/lib/first-run-checklist';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, X, ChevronDown, ChevronUp, Rocket } from 'lucide-react';

// ---------------------------------------------------------------------------
// Snapshot Builder
// ---------------------------------------------------------------------------

function useProjectSnapshot(hasExported: boolean): ProjectStateSnapshot {
  const { nodes, edges } = useArchitecture();
  const { bom } = useBom();
  const { issues } = useValidation();

  return useMemo(
    () => ({
      hasProject: true,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      bomItemCount: bom.length,
      validationIssueCount: issues.length,
      hasExported,
    }),
    [nodes.length, edges.length, bom.length, issues.length, hasExported],
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FirstRunChecklist() {
  const projectId = useProjectId();
  const [hasExported, setHasExported] = useState(() => {
    try {
      return localStorage.getItem(`protopulse-exported-${projectId}`) === 'true';
    } catch {
      return false;
    }
  });
  const [collapsed, setCollapsed] = useState(false);

  const snapshot = useProjectSnapshot(hasExported);
  const {
    items,
    completedCount,
    totalCount,
    progress,
    visible,
    dismiss,
  } = useFirstRunChecklist(projectId, snapshot);

  // Listen for export events via a custom event (fired by ExportPanel)
  useEffect(() => {
    const handler = () => {
      setHasExported(true);
      try {
        localStorage.setItem(`protopulse-exported-${projectId}`, 'true');
      } catch {
        // ignore
      }
    };
    window.addEventListener('protopulse:export', handler);
    return () => window.removeEventListener('protopulse:export', handler);
  }, [projectId]);

  if (!visible) {
    return null;
  }

  const progressPercent = Math.round(progress * 100);

  return (
    <div
      data-testid="first-run-checklist"
      className={cn(
        'fixed bottom-4 right-4 z-40 w-80 rounded-lg border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/5 transition-all duration-200',
        collapsed ? 'h-auto' : '',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Getting Started</span>
          <span
            data-testid="checklist-progress-label"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="checklist-collapse-toggle"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            data-testid="checklist-dismiss"
            onClick={dismiss}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2">
        <div
          data-testid="checklist-progress-bar"
          className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progressPercent}% complete`}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul data-testid="checklist-items" className="px-4 pb-3 space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              data-testid={`checklist-item-${item.id}`}
              className={cn(
                'flex items-start gap-2.5 py-1.5 px-2 rounded-md transition-colors text-sm',
                item.completed
                  ? 'text-muted-foreground/60'
                  : 'text-foreground',
              )}
            >
              <span className="mt-0.5 shrink-0">
                {item.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" data-testid={`checklist-check-${item.id}`} />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/40" />
                )}
              </span>
              <div className="min-w-0">
                <span className={cn('block leading-tight', item.completed && 'line-through')}>
                  {item.label}
                </span>
                {!item.completed && (
                  <span className="block text-xs text-muted-foreground mt-0.5">{item.description}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Completion celebration */}
      {completedCount === totalCount && (
        <div className="px-4 pb-3 text-center">
          <p className="text-sm text-primary font-medium">All done! You're ready to build.</p>
        </div>
      )}
    </div>
  );
}

// Export for manual marking from ExportPanel or other places
export { type ProjectStateSnapshot } from '@/lib/first-run-checklist';
