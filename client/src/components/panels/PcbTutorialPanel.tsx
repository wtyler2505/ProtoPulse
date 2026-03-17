/**
 * PcbTutorialPanel — Interactive "Your First PCB" step-by-step panel
 *
 * Renders a floating side panel with:
 *  - Step list with progress indicators (locked/active/completed/skipped)
 *  - Current step instruction + tips
 *  - "Check" button per step that runs the validation function
 *  - Skip button for skippable steps
 *  - View navigation on step click
 *  - Overall progress bar
 */

import { useReducer, useCallback, useEffect, useMemo } from 'react';
import {
  Check,
  ChevronRight,
  CircuitBoard,
  Lock,
  Lightbulb,
  SkipForward,
  X,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  PCB_TUTORIAL_STEPS,
  PCB_TUTORIAL_TITLE,
  PCB_TUTORIAL_DESCRIPTION,
  PCB_TUTORIAL_ESTIMATED_MINUTES,
  pcbTutorialReducer,
  loadPcbTutorialState,
  savePcbTutorialState,
  getCurrentStep,
  getProgressPercent,
  getCompletedCount,
  isTutorialComplete,
} from '@/lib/pcb-tutorial';
import type { PcbTutorialState, PcbTutorialStepStatus, PcbValidationContext } from '@/lib/pcb-tutorial';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PcbTutorialPanelProps {
  /** Whether the panel is visible */
  open: boolean;
  /** Called when the user closes the panel */
  onClose: () => void;
  /** Called when the tutorial navigates to a new view */
  onNavigate: (view: string) => void;
  /** Current project validation context for step checking */
  validationContext: PcbValidationContext;
}

// ---------------------------------------------------------------------------
// Step Status Icon
// ---------------------------------------------------------------------------

function StepStatusIcon({ status }: { status: PcbTutorialStepStatus }) {
  switch (status) {
    case 'completed':
      return (
        <div
          data-testid="step-status-completed"
          className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      );
    case 'skipped':
      return (
        <div
          data-testid="step-status-skipped"
          className="w-6 h-6 rounded-full bg-zinc-600/30 flex items-center justify-center shrink-0"
        >
          <SkipForward className="w-3.5 h-3.5 text-zinc-400" />
        </div>
      );
    case 'active':
      return (
        <div
          data-testid="step-status-active"
          className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 animate-pulse"
        >
          <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
        </div>
      );
    case 'locked':
    default:
      return (
        <div
          data-testid="step-status-locked"
          className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0"
        >
          <Lock className="w-3 h-3 text-zinc-600" />
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Completion Screen
// ---------------------------------------------------------------------------

function CompletionScreen({ onReset, onClose }: { onReset: () => void; onClose: () => void }) {
  return (
    <div data-testid="pcb-tutorial-complete" className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <Trophy className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-100">PCB Tutorial Complete!</h3>
      <p className="text-sm text-zinc-400 max-w-xs">
        You have learned the full journey from schematic to manufacturing-ready Gerber files.
        You are ready to design your own PCBs!
      </p>
      <div className="flex items-center gap-3 pt-2">
        <Button
          data-testid="pcb-tutorial-reset"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="text-xs"
        >
          <RotateCcw className="w-3 h-3 mr-1.5" />
          Start Over
        </Button>
        <Button
          data-testid="pcb-tutorial-close-complete"
          size="sm"
          onClick={onClose}
          className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white border-none"
        >
          Done
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PcbTutorialPanel({
  open,
  onClose,
  onNavigate,
  validationContext,
}: PcbTutorialPanelProps) {
  const [state, dispatch] = useReducer(pcbTutorialReducer, undefined, loadPcbTutorialState);

  // Persist state on every change
  useEffect(() => {
    savePcbTutorialState(state);
  }, [state]);

  // Auto-start the tutorial when panel opens for the first time
  useEffect(() => {
    if (open && !state.isActive && !isTutorialComplete(state) && state.startedAt === null) {
      dispatch({ type: 'START' });
    }
  }, [open, state.isActive, state.startedAt]);

  const currentStep = useMemo(() => getCurrentStep(state), [state]);
  const progressPercent = useMemo(() => getProgressPercent(state), [state]);
  const completedCount = useMemo(() => getCompletedCount(state), [state]);
  const isComplete = useMemo(() => isTutorialComplete(state), [state]);

  const handleCheck = useCallback(
    (stepId: string) => {
      dispatch({ type: 'VALIDATE_STEP', stepId, ctx: validationContext });
    },
    [validationContext],
  );

  const handleSkip = useCallback((stepId: string) => {
    dispatch({ type: 'SKIP_STEP', stepId });
  }, []);

  const handleGoToStep = useCallback(
    (stepIndex: number) => {
      dispatch({ type: 'GO_TO_STEP', stepIndex });
      const step = PCB_TUTORIAL_STEPS[stepIndex];
      if (step) {
        onNavigate(step.targetView);
      }
    },
    [onNavigate],
  );

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    dispatch({ type: 'START' });
  }, []);

  const handleQuit = useCallback(() => {
    dispatch({ type: 'QUIT' });
    onClose();
  }, [onClose]);

  // Navigate to the current step's view when it changes
  useEffect(() => {
    if (open && state.isActive && currentStep) {
      onNavigate(currentStep.targetView);
    }
  }, [open, state.isActive, currentStep?.id]);

  if (!open) {
    return null;
  }

  return (
    <div
      data-testid="pcb-tutorial-panel"
      className="w-80 h-full border-l border-zinc-800 bg-zinc-950/95 flex flex-col"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CircuitBoard className="w-4 h-4 text-cyan-400" />
            <h2 data-testid="pcb-tutorial-title" className="text-sm font-semibold text-zinc-100">
              {PCB_TUTORIAL_TITLE}
            </h2>
          </div>
          <button
            data-testid="pcb-tutorial-close"
            type="button"
            onClick={handleQuit}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            aria-label="Close tutorial"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <p className="text-xs text-zinc-400 mb-3">{PCB_TUTORIAL_DESCRIPTION}</p>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span data-testid="pcb-tutorial-progress-text">
              {completedCount} of {PCB_TUTORIAL_STEPS.length} steps completed
            </span>
            <span>~{PCB_TUTORIAL_ESTIMATED_MINUTES} min</span>
          </div>
          <div data-testid="pcb-tutorial-progress-bar" className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${String(progressPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {isComplete ? (
        <CompletionScreen onReset={handleReset} onClose={onClose} />
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {PCB_TUTORIAL_STEPS.map((step, index) => {
              const status = state.stepStatuses[step.id] ?? 'locked';
              const isCurrent = index === state.currentStepIndex && state.isActive;
              const isClickable = status !== 'locked';

              return (
                <div key={step.id} data-testid={`pcb-step-${step.id}`}>
                  {/* Step row */}
                  <button
                    type="button"
                    data-testid={`pcb-step-button-${step.id}`}
                    disabled={!isClickable}
                    onClick={() => {
                      handleGoToStep(index);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                      isCurrent && 'bg-cyan-500/10 border border-cyan-400/20',
                      !isCurrent && isClickable && 'hover:bg-zinc-800/50',
                      !isClickable && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <StepStatusIcon status={status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-xs font-medium truncate',
                            isCurrent ? 'text-cyan-300' : status === 'locked' ? 'text-zinc-600' : 'text-zinc-300',
                          )}
                        >
                          {step.stepNumber}. {step.title}
                        </span>
                        {status === 'skipped' && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-zinc-400 border-zinc-700">
                            Skipped
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-600 truncate mt-0.5">{step.summary}</p>
                    </div>
                  </button>

                  {/* Expanded detail for current step */}
                  {isCurrent && (
                    <div
                      data-testid={`pcb-step-detail-${step.id}`}
                      className="mx-3 mt-1 mb-2 p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-3"
                    >
                      {/* Instruction */}
                      <p className="text-xs text-zinc-300 leading-relaxed">{step.instruction}</p>

                      {/* Tips */}
                      {step.tips.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
                            <Lightbulb className="w-3 h-3" />
                            <span className="font-medium">Tips</span>
                          </div>
                          <ul className="space-y-1">
                            {step.tips.map((tip, tipIdx) => (
                              <li key={tipIdx} className="text-[11px] text-zinc-400 pl-4 relative before:content-[''] before:absolute before:left-1.5 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-zinc-600">
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          data-testid={`pcb-step-check-${step.id}`}
                          size="sm"
                          onClick={() => {
                            handleCheck(step.id);
                          }}
                          className="h-7 px-3 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border-none"
                        >
                          <Check className="w-3 h-3 mr-1.5" />
                          Check
                        </Button>
                        {step.canSkip && (
                          <Button
                            data-testid={`pcb-step-skip-${step.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              handleSkip(step.id);
                            }}
                            className="h-7 px-2 text-xs text-zinc-400"
                          >
                            <SkipForward className="w-3 h-3 mr-1" />
                            Skip
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
