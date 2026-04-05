import { useState, useCallback, useMemo } from 'react';
import {
  createWizardState,
  startWizard,
  advanceStep,
  resetWizard,
  getCurrentStep,
  getStepById,
  buildDiagnosisSummary,
  getProgress,
  getStepsRemaining,
} from '@/lib/arduino/serial-troubleshooter';
import type {
  SerialContext,
  WizardState,
  StepResult,
  DiagnosisSummary,
} from '@/lib/arduino/serial-troubleshooter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  RotateCcw,
  ChevronRight,
  AlertTriangle,
  Wrench,
  Cpu,
  Settings,
  Cable,
  HelpCircle,
} from 'lucide-react';
import type { DiagnosticCategory } from '@/lib/arduino/serial-troubleshooter';

// ---------------------------------------------------------------------------
// Category Icons & Colors
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  DiagnosticCategory,
  { icon: typeof Cable; label: string; color: string }
> = {
  physical: { icon: Cable, label: 'Physical', color: 'text-orange-400' },
  software: { icon: Settings, label: 'Software', color: 'text-blue-400' },
  firmware: { icon: Cpu, label: 'Firmware', color: 'text-purple-400' },
  configuration: { icon: Wrench, label: 'Config', color: 'text-yellow-400' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TroubleshootWizardProps {
  /** Context from the serial monitor for smart step filtering. */
  context: SerialContext;
  /** Called when the user dismisses the wizard. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TroubleshootWizard({
  context,
  onClose,
}: TroubleshootWizardProps) {
  const [wizardState, setWizardState] = useState<WizardState>(() =>
    startWizard(createWizardState(context)),
  );

  const currentStep = useMemo(
    () => getCurrentStep(wizardState),
    [wizardState],
  );
  const hasPreflightContext = Boolean(
    context.detectedDeviceLabel || context.arduinoProfileLabel || context.boardSafetyLabel,
  );

  const progress = useMemo(() => getProgress(wizardState), [wizardState]);
  const remaining = useMemo(
    () => getStepsRemaining(wizardState),
    [wizardState],
  );

  const summary: DiagnosisSummary | null = useMemo(
    () => (wizardState.phase === 'complete' ? buildDiagnosisSummary(wizardState) : null),
    [wizardState],
  );

  const handleAnswer = useCallback(
    (result: StepResult) => {
      setWizardState((prev) => advanceStep(prev, result));
    },
    [],
  );

  const handleReset = useCallback(() => {
    setWizardState(startWizard(resetWizard(context)));
  }, [context]);

  // -----------------------------------------------------------------------
  // Render: Completed State
  // -----------------------------------------------------------------------

  if (wizardState.phase === 'complete' && summary) {
    return (
      <div
        data-testid="troubleshoot-wizard-complete"
        className="flex flex-col gap-3 p-3 bg-card/80 border border-border rounded-lg"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Diagnosis Complete
          </h3>
          <div className="flex items-center gap-1">
            <Button
              data-testid="troubleshoot-restart-btn"
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 px-2"
              onClick={handleReset}
            >
              <RotateCcw className="w-3 h-3" />
              Restart
            </Button>
            <Button
              data-testid="troubleshoot-close-btn"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>

        {/* Conclusion */}
        <div
          data-testid="troubleshoot-conclusion"
          className={cn(
            'text-xs p-2 rounded border',
            summary.hasActionableFailure
              ? 'bg-destructive/10 border-destructive/20 text-destructive'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          )}
        >
          {summary.conclusion}
        </div>

        {/* Failed Steps */}
        {summary.failedSteps.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Issues Found
            </span>
            {summary.failedSteps.map((step) => {
              const cat = CATEGORY_CONFIG[step.category];
              const CatIcon = cat.icon;
              return (
                <div
                  key={step.id}
                  data-testid={`troubleshoot-failure-${step.id}`}
                  className="flex items-start gap-2 text-xs p-2 bg-destructive/5 border border-destructive/10 rounded"
                >
                  <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CatIcon className={cn('w-3 h-3', cat.color)} />
                      <span className="font-medium text-foreground">
                        {step.title}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      {step.fixSuggestion}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Passed Steps (collapsed summary) */}
        {summary.passedSteps.length > 0 && (
          <div className="text-[10px] text-muted-foreground">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 inline mr-1" />
            {summary.passedSteps.length} check{summary.passedSteps.length !== 1 ? 's' : ''} passed
            {summary.skippedSteps.length > 0 && (
              <span>
                , {summary.skippedSteps.length} skipped
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render: Running State (active step)
  // -----------------------------------------------------------------------

  if (!currentStep) {
    return null;
  }

  const cat = CATEGORY_CONFIG[currentStep.category];
  const CatIcon = cat.icon;

  return (
    <div
      data-testid="troubleshoot-wizard"
      className="flex flex-col gap-2.5 p-3 bg-card/80 border border-border rounded-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#00F0FF]" />
          <h3 className="text-sm font-semibold text-foreground">
            Troubleshoot: No Data
          </h3>
        </div>
        <Button
          data-testid="troubleshoot-close-btn"
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div
          data-testid="troubleshoot-progress-bar"
          className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-[#00F0FF] rounded-full transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span
          data-testid="troubleshoot-steps-remaining"
          className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap"
        >
          {remaining} step{remaining !== 1 ? 's' : ''} left
        </span>
      </div>

      {/* Current Step */}
      <div className="space-y-2">
        {hasPreflightContext && (
          <div
            data-testid="troubleshoot-preflight-summary"
            className={cn(
              'rounded border p-2 text-xs',
              context.boardBlockerReason
                ? 'border-yellow-500/20 bg-yellow-500/5'
                : 'border-border bg-muted/20',
            )}
          >
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Current hardware truth
            </div>
            <div className="grid gap-1 sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Detected device:</span>{' '}
                <span className="text-foreground">{context.detectedDeviceLabel ?? 'Unknown'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Arduino profile:</span>{' '}
                <span className="text-foreground">{context.arduinoProfileLabel ?? 'None'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Board safety:</span>{' '}
                <span className="text-foreground">{context.boardSafetyLabel ?? 'Not checked'}</span>
              </div>
            </div>
            {context.boardBlockerReason && (
              <div className="mt-1.5 flex items-start gap-1.5 text-yellow-300">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{context.boardBlockerReason}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <CatIcon className={cn('w-3.5 h-3.5', cat.color)} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {cat.label}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <span
            data-testid="troubleshoot-step-title"
            className="text-xs font-medium text-foreground"
          >
            {currentStep.title}
          </span>
        </div>

        <p
          data-testid="troubleshoot-step-description"
          className="text-xs text-muted-foreground leading-relaxed"
        >
          {currentStep.description}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        <Button
          data-testid="troubleshoot-pass-btn"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => handleAnswer('pass')}
        >
          <CheckCircle2 className="w-3 h-3" />
          OK / Yes
        </Button>
        <Button
          data-testid="troubleshoot-fail-btn"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => handleAnswer('fail')}
        >
          <XCircle className="w-3 h-3" />
          No / Problem
        </Button>
        <Button
          data-testid="troubleshoot-skip-btn"
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 px-2 text-muted-foreground"
          onClick={() => handleAnswer('skip')}
          title="Skip this check"
        >
          <SkipForward className="w-3 h-3" />
        </Button>
      </div>

      {/* Fix suggestion shown inline when there's a fail in history */}
      {wizardState.outcomes.length > 0 && (() => {
        const lastOutcome = wizardState.outcomes[wizardState.outcomes.length - 1];
        if (lastOutcome.result !== 'fail') {
          return null;
        }
        const failedStep = getStepById(lastOutcome.stepId);
        if (!failedStep) {
          return null;
        }
        return (
          <div
            data-testid="troubleshoot-last-fix"
            className="flex items-start gap-2 text-xs p-2 bg-yellow-500/5 border border-yellow-500/15 rounded"
          >
            <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-yellow-300">{failedStep.title}:</span>{' '}
              <span className="text-muted-foreground">{failedStep.fixSuggestion}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
