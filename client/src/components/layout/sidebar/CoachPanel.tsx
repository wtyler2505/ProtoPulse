import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  GraduationCap,
  Lightbulb,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react';
import RolePresetSelector from '@/components/ui/RolePresetSelector';
import { useBeginnerMode } from '@/lib/beginner-mode';
import type { ProjectStateSnapshot } from '@/lib/first-run-checklist';
import { useFirstRunChecklist } from '@/lib/first-run-checklist';
import { useArchitecture, useBom, useProjectId, useProjectMeta, useValidation } from '@/lib/project-context';
import { useRolePreset } from '@/lib/role-presets';
import { MAX_HINT_VISITS, useViewOnboarding } from '@/lib/view-onboarding';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/lib/project-context';

const COACH_ACTIONS: ReadonlyArray<{ label: string; view: ViewMode; icon: typeof BookOpen }> = [
  { label: 'Starter Circuits', view: 'starter_circuits', icon: Sparkles },
  { label: 'Knowledge Hub', view: 'knowledge', icon: BookOpen },
  { label: 'Quick Math', view: 'calculators', icon: Calculator },
];

function useCoachSnapshot(hasExported: boolean): ProjectStateSnapshot {
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

export default function CoachPanel() {
  const projectId = useProjectId();
  const { activeView, setActiveView } = useProjectMeta();
  const { activeRole, preset } = useRolePreset();
  const { isEnabled: plainLabelsEnabled, toggle: togglePlainLabels } = useBeginnerMode();
  const [collapsed, setCollapsed] = useState(false);
  const [hasExported, setHasExported] = useState(() => {
    try {
      return localStorage.getItem(`protopulse-exported-${projectId}`) === 'true';
    } catch {
      return false;
    }
  });

  const snapshot = useCoachSnapshot(hasExported);
  const checklist = useFirstRunChecklist(projectId, snapshot);
  const { visible: showHint, hint, dismiss: dismissHint, visitCount } = useViewOnboarding(activeView);

  useEffect(() => {
    try {
      setHasExported(localStorage.getItem(`protopulse-exported-${projectId}`) === 'true');
    } catch {
      setHasExported(false);
    }
  }, [projectId]);

  useEffect(() => {
    const handler = () => {
      setHasExported(true);
      try {
        localStorage.setItem(`protopulse-exported-${projectId}`, 'true');
      } catch {
        // ignore localStorage write failures for coach state
      }
    };

    window.addEventListener('protopulse:export', handler);
    return () => window.removeEventListener('protopulse:export', handler);
  }, [projectId]);

  if (activeRole === 'pro') {
    return null;
  }

  const progressPercent = Math.round(checklist.progress * 100);
  const remainingHintViews = Math.max(MAX_HINT_VISITS - visitCount, 0);

  return (
    <section
      data-testid="coach-panel"
      className="mx-4 mb-4 rounded-xl border border-primary/15 bg-card/70 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl"
      aria-label="Coach panel"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Coach Panel</p>
          </div>
          <p data-testid="coach-role-description" className="mt-1 text-xs text-muted-foreground">
            {preset.label} mode keeps the workspace guided and easier to scan.
          </p>
        </div>
        <button
          data-testid="coach-collapse-toggle"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          aria-label={collapsed ? 'Expand coach panel' : 'Collapse coach panel'}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-4 px-4 py-4">
          <div data-testid="coach-mode-section" className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Workspace Mode
              </p>
              <button
                data-testid="coach-plain-language-toggle"
                type="button"
                onClick={togglePlainLabels}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  plainLabelsEnabled
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-background/60 text-muted-foreground hover:text-foreground',
                )}
              >
                {plainLabelsEnabled ? 'Plain Labels On' : 'Use Plain Labels'}
              </button>
            </div>
            <RolePresetSelector className="flex-wrap bg-background/50" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {preset.description}
            </p>
          </div>

          <div
            data-testid="coach-current-tip"
            className="rounded-lg border border-primary/15 bg-primary/5 p-3"
          >
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
                      Current View Tip
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {hint?.title ?? 'Keep building'}
                    </p>
                  </div>
                  {showHint && (
                    <button
                      data-testid="coach-dismiss-tip"
                      type="button"
                      onClick={dismissHint}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                      aria-label="Dismiss current coach tip"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {hint?.description ?? 'Use the role switcher above any time you want more guidance or more power.'}
                </p>
                {showHint && remainingHintViews > 0 && (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                    Showing {remainingHintViews} more {remainingHintViews === 1 ? 'time' : 'times'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div data-testid="coach-checklist-section" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Next Steps
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {checklist.completedCount}/{checklist.totalCount} starter milestones completed
                </p>
              </div>
              {checklist.dismissed ? (
                <button
                  data-testid="coach-reset-checklist"
                  type="button"
                  onClick={checklist.reset}
                  className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Show Again
                </button>
              ) : (
                <button
                  data-testid="coach-dismiss-checklist"
                  type="button"
                  onClick={checklist.dismiss}
                  className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Hide
                </button>
              )}
            </div>

            {checklist.dismissed ? (
              <div
                data-testid="coach-checklist-hidden"
                className="rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-3 text-xs leading-relaxed text-muted-foreground"
              >
                Beginner milestones are hidden for now. You can bring them back any time with
                {' '}
                <span className="font-medium text-foreground">Show Again</span>
                .
              </div>
            ) : (
              <>
                <div
                  data-testid="coach-progress-bar"
                  className="h-1.5 overflow-hidden rounded-full bg-muted/60"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${progressPercent}% complete`}
                >
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>

                <ul className="space-y-1.5">
                  {checklist.items.map((item) => (
                    <li
                      key={item.id}
                      data-testid={`coach-step-${item.id}`}
                      className={cn(
                        'flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                        item.completed ? 'bg-muted/30 text-muted-foreground' : 'bg-background/40 text-foreground',
                      )}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                      )}
                      <div className="min-w-0">
                        <p className={cn(item.completed && 'line-through')}>{item.label}</p>
                        {!item.completed && (
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div data-testid="coach-actions" className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Helpful Shortcuts
            </p>
            <div className="grid grid-cols-1 gap-2">
              {COACH_ACTIONS.map(({ label, view, icon: Icon }) => (
                <button
                  key={view}
                  data-testid={`coach-action-${view}`}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="flex-1">{label}</span>
                </button>
              ))}
              <button
                data-testid="coach-action-validation"
                type="button"
                onClick={() => setActiveView('validation')}
                className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <WandSparkles className="h-4 w-4 text-primary" />
                <span className="flex-1">Run a design check</span>
              </button>
            </div>
          </div>

          {checklist.completedCount === checklist.totalCount && (
            <div
              data-testid="coach-ready-banner"
              className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2"
            >
              <p className="text-sm font-medium text-emerald-300">You are ready for more advanced tools.</p>
              <p className="mt-1 text-xs text-emerald-100/80">
                Stay in {preset.label} mode for guided building, or switch to Pro when you want the full workbench.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
