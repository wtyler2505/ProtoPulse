/**
 * RemediationWizardDialog — step-by-step guided fix dialog for DRC/ERC violations.
 *
 * Opens as a modal when the user clicks "Fix" on a violation row in ValidationView.
 * Walks through the recipe steps one at a time with progress tracking.
 *
 * BL-0253
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Lightbulb,
  Wrench,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import type { RemediationRecipe, WizardState } from '@/lib/remediation-wizard';
import {
  createWizardState,
  nextStep,
  prevStep,
  toggleStepComplete,
  goToStep,
  isComplete,
  getProgress,
} from '@/lib/remediation-wizard';
import type { ViewMode } from '@/lib/project-context';

export interface RemediationWizardDialogProps {
  /** The recipe to display. Null = dialog closed. */
  recipe: RemediationRecipe | null;
  /** Original violation message for context. */
  violationMessage?: string;
  /** Original violation ID. */
  violationId?: string;
  /** Called when the dialog is closed (via X, Escape, or Done button). */
  onClose: () => void;
  /** Called when the user clicks "Go to [view]" to navigate. */
  onNavigate?: (view: ViewMode) => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  intermediate: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  advanced: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

const VIEW_LABELS: Record<string, string> = {
  component_editor: 'Component Editor',
  schematic: 'Schematic',
  pcb: 'PCB Layout',
  architecture: 'Architecture',
  breadboard: 'Breadboard',
};

export function RemediationWizardDialog({
  recipe,
  violationMessage,
  violationId,
  onClose,
  onNavigate,
}: RemediationWizardDialogProps) {
  const [wizardState, setWizardState] = useState<WizardState | null>(null);

  // Initialize / reset state when recipe changes
  const activeState = useMemo(() => {
    if (!recipe) { return null; }
    return createWizardState(recipe, violationMessage ?? '', violationId ?? '');
  }, [recipe, violationMessage, violationId]);

  // Use local state if user has interacted, otherwise the memoized initial state
  const state = wizardState?.recipe.id === recipe?.id ? wizardState : activeState;

  const handleNext = useCallback(() => {
    if (!state) { return; }
    const next = nextStep(state);
    if (next) { setWizardState(next); }
  }, [state]);

  const handlePrev = useCallback(() => {
    if (!state) { return; }
    const prev = prevStep(state);
    if (prev) { setWizardState(prev); }
  }, [state]);

  const handleToggleStep = useCallback((stepIndex: number) => {
    if (!state) { return; }
    setWizardState(toggleStepComplete(state, stepIndex));
  }, [state]);

  const handleGoToStep = useCallback((stepIndex: number) => {
    if (!state) { return; }
    const jumped = goToStep(state, stepIndex);
    if (jumped) { setWizardState(jumped); }
  }, [state]);

  const handleClose = useCallback(() => {
    setWizardState(null);
    onClose();
  }, [onClose]);

  const handleNavigate = useCallback(() => {
    if (!recipe || !onNavigate) { return; }
    onNavigate(recipe.targetView as ViewMode);
  }, [recipe, onNavigate]);

  if (!recipe || !state) {
    return null;
  }

  const currentStepData = recipe.steps[state.currentStep];
  const progress = getProgress(state);
  const allDone = isComplete(state);
  const isFirstStep = state.currentStep === 0;
  const isLastStep = state.currentStep === recipe.steps.length - 1;

  return (
    <Dialog open={!!recipe} onOpenChange={(open) => { if (!open) { handleClose(); } }}>
      <DialogContent
        className="sm:max-w-[560px] bg-card border-border"
        data-testid="remediation-wizard-dialog"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base" data-testid="wizard-title">
              {recipe.title}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Step-by-step guide to fix this design violation
          </DialogDescription>

          {/* Metadata badges */}
          <div className="flex items-center gap-2 flex-wrap" data-testid="wizard-meta">
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0 border', DIFFICULTY_COLORS[recipe.difficulty])}
              data-testid="wizard-difficulty"
            >
              {recipe.difficulty}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
              {recipe.category.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
              {recipe.steps.length} steps
            </Badge>
          </div>
        </DialogHeader>

        {/* Violation context */}
        {violationMessage && (
          <div
            className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive"
            data-testid="wizard-violation-context"
          >
            <span className="font-semibold">Violation:</span> {violationMessage}
          </div>
        )}

        {/* Why it matters */}
        <div className="flex items-start gap-2 px-3 py-2 bg-muted/20 border border-border rounded" data-testid="wizard-why">
          <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">{recipe.whyItMatters}</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1" data-testid="wizard-progress">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Step {state.currentStep + 1} of {recipe.steps.length}</span>
            <span>{Math.round(progress * 100)}% complete</span>
          </div>
          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progress * 100}%` }}
              data-testid="wizard-progress-bar"
            />
          </div>
        </div>

        {/* Step list (compact sidebar) */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 min-w-[32px]" data-testid="wizard-step-indicators">
            {recipe.steps.map((step, i) => {
              const isDone = state.completedSteps.has(i);
              const isCurrent = i === state.currentStep;
              return (
                <button
                  key={i}
                  onClick={() => handleGoToStep(i)}
                  aria-label={`Go to step ${step.number}`}
                  data-testid={`wizard-step-indicator-${i}`}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors border',
                    isDone && 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
                    isCurrent && !isDone && 'bg-primary/20 border-primary/50 text-primary',
                    !isCurrent && !isDone && 'bg-transparent border-border text-muted-foreground hover:border-primary/30',
                  )}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.number}
                </button>
              );
            })}
          </div>

          {/* Current step detail */}
          <div className="flex-1 space-y-2" data-testid="wizard-current-step">
            <div className="flex items-start gap-2">
              {currentStepData.isVerification ? (
                <ClipboardCheck className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{currentStepData.instruction}</p>
                {currentStepData.detail && (
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{currentStepData.detail}</p>
                )}
                {currentStepData.isVerification && (
                  <Badge variant="outline" className="mt-1 text-[9px] px-1 py-0 border-blue-500/30 text-blue-400">
                    Verification step
                  </Badge>
                )}
              </div>
            </div>

            {/* Mark step done checkbox */}
            <button
              onClick={() => handleToggleStep(state.currentStep)}
              data-testid="wizard-toggle-step"
              className={cn(
                'flex items-center gap-2 text-xs px-2 py-1 rounded transition-colors',
                state.completedSteps.has(state.currentStep)
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-muted/10 text-muted-foreground hover:text-foreground',
              )}
            >
              {state.completedSteps.has(state.currentStep)
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <Circle className="w-3.5 h-3.5" />}
              {state.completedSteps.has(state.currentStep) ? 'Done' : 'Mark as done'}
            </button>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={isFirstStep}
              data-testid="wizard-prev"
              className="h-8"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={isLastStep}
              data-testid="wizard-next"
              className="h-8"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {onNavigate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNavigate}
                data-testid="wizard-navigate"
                className="h-8 text-primary"
              >
                Go to {VIEW_LABELS[recipe.targetView] ?? recipe.targetView}
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleClose}
              data-testid="wizard-done"
              className={cn('h-8', allDone && 'bg-emerald-600 hover:bg-emerald-700')}
            >
              {allDone ? 'Complete' : 'Close'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
