import { ChevronRight } from 'lucide-react';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/lib/project-context';

interface WorkflowStep {
  id: ViewMode;
  label: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'schematic', label: 'Schematic' },
  { id: 'pcb', label: 'PCB Layout' },
  { id: 'validation', label: 'Validation' },
  { id: 'output', label: 'Output' },
];

export default function WorkflowBreadcrumb() {
  const { activeView, setActiveView } = useProjectMeta();

  const activeStepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === activeView);
  const isWorkflowView = activeStepIndex !== -1;

  return (
    <nav
      data-testid="workflow-breadcrumb"
      aria-label="Design workflow"
      className="hidden md:flex items-center gap-1 px-4 py-1.5 bg-card/40 border-b border-border"
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const isActive = step.id === activeView;
        const isPast = isWorkflowView && index < activeStepIndex;

        return (
          <div key={step.id} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight
                className={cn(
                  'w-3.5 h-3.5 shrink-0',
                  isPast ? 'text-primary/50' : 'text-muted-foreground/40',
                )}
                aria-hidden="true"
              />
            )}
            <button
              data-testid={`workflow-step-${step.id}`}
              onClick={() => setActiveView(step.id)}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                isActive && 'text-primary bg-primary/10',
                isPast && !isActive && 'text-primary/70 hover:text-primary hover:bg-primary/5',
                !isActive && !isPast && 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
              )}
            >
              {step.label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
