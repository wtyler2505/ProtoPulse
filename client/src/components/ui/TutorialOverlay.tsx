import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/lib/tutorial-context';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 360;

function useTargetRect(selector: string | undefined): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    const measure = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    };

    measure();

    // Re-measure on resize/scroll
    const handleReposition = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    // Observe target element size changes
    const el = document.querySelector(selector);
    if (el) {
      observerRef.current = new ResizeObserver(handleReposition);
      observerRef.current.observe(el);
    }

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      cancelAnimationFrame(rafRef.current);
      observerRef.current?.disconnect();
    };
  }, [selector]);

  return rect;
}

function computeTooltipPosition(
  targetRect: TargetRect | null,
  position: 'top' | 'bottom' | 'left' | 'right',
): React.CSSProperties {
  if (!targetRect) {
    // Center on screen
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;

  switch (position) {
    case 'top':
      return {
        bottom: window.innerHeight - targetRect.top + TOOLTIP_GAP + SPOTLIGHT_PADDING,
        left: Math.max(8, Math.min(centerX - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 8)),
      };
    case 'bottom':
      return {
        top: targetRect.top + targetRect.height + TOOLTIP_GAP + SPOTLIGHT_PADDING,
        left: Math.max(8, Math.min(centerX - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 8)),
      };
    case 'left':
      return {
        top: Math.max(8, centerY - 80),
        right: window.innerWidth - targetRect.left + TOOLTIP_GAP + SPOTLIGHT_PADDING,
      };
    case 'right':
      return {
        top: Math.max(8, centerY - 80),
        left: targetRect.left + targetRect.width + TOOLTIP_GAP + SPOTLIGHT_PADDING,
      };
  }
}

function SpotlightOverlay({ targetRect }: { targetRect: TargetRect | null }) {
  if (!targetRect) {
    return <div data-testid="tutorial-overlay-backdrop" className="fixed inset-0 z-[9998] bg-black/60" />;
  }

  const padded = {
    top: targetRect.top - SPOTLIGHT_PADDING,
    left: targetRect.left - SPOTLIGHT_PADDING,
    width: targetRect.width + SPOTLIGHT_PADDING * 2,
    height: targetRect.height + SPOTLIGHT_PADDING * 2,
  };

  // Use CSS clip-path to create a cutout in the overlay
  const clipPath = `polygon(
    0% 0%,
    0% 100%,
    ${padded.left}px 100%,
    ${padded.left}px ${padded.top}px,
    ${padded.left + padded.width}px ${padded.top}px,
    ${padded.left + padded.width}px ${padded.top + padded.height}px,
    ${padded.left}px ${padded.top + padded.height}px,
    ${padded.left}px 100%,
    100% 100%,
    100% 0%
  )`;

  return (
    <div
      data-testid="tutorial-overlay-backdrop"
      className="fixed inset-0 z-[9998] bg-black/60 transition-all duration-200"
      style={{ clipPath }}
    />
  );
}

function TooltipArrow({
  position,
  targetRect,
}: {
  position: 'top' | 'bottom' | 'left' | 'right';
  targetRect: TargetRect | null;
}) {
  if (!targetRect) {
    return null;
  }

  const baseClasses = 'absolute w-3 h-3 rotate-45 bg-zinc-900 border-zinc-700';

  switch (position) {
    case 'top':
      return <div className={cn(baseClasses, 'bottom-[-7px] left-1/2 -translate-x-1/2 border-b border-r')} />;
    case 'bottom':
      return <div className={cn(baseClasses, 'top-[-7px] left-1/2 -translate-x-1/2 border-t border-l')} />;
    case 'left':
      return <div className={cn(baseClasses, 'right-[-7px] top-6 border-t border-r')} />;
    case 'right':
      return <div className={cn(baseClasses, 'left-[-7px] top-6 border-b border-l')} />;
  }
}

export default function TutorialOverlay() {
  const { isActive, activeTutorial, currentStep, currentStepIndex, progress, nextStep, prevStep, skipTutorial, endTutorial } =
    useTutorial();

  const targetRect = useTargetRect(currentStep?.targetSelector);
  const isLastStep = activeTutorial ? currentStepIndex === activeTutorial.steps.length - 1 : false;
  const isFirstStep = currentStepIndex === 0;
  const position = currentStep?.position ?? 'bottom';

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          skipTutorial();
          break;
        case 'Enter':
        case 'ArrowRight':
          e.preventDefault();
          if (isLastStep) {
            endTutorial();
          } else {
            nextStep();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevStep();
          break;
      }
    },
    [isActive, isLastStep, nextStep, prevStep, skipTutorial, endTutorial],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isActive, handleKeyDown]);

  if (!isActive || !currentStep) {
    return null;
  }

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const tooltipStyle = computeTooltipPosition(targetRect, position);

  return createPortal(
    <>
      <SpotlightOverlay targetRect={targetRect} />

      {/* Highlighted region gets pointer-events so users can interact */}
      {targetRect && (
        <div
          data-testid="tutorial-spotlight"
          className="fixed z-[9998] pointer-events-none rounded-md ring-2 ring-cyan-400/50"
          style={{
            top: targetRect.top - SPOTLIGHT_PADDING,
            left: targetRect.left - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        data-testid="tutorial-tooltip"
        className="fixed z-[9999] pointer-events-auto"
        style={{ ...tooltipStyle, width: TOOLTIP_WIDTH }}
      >
        <div className="relative bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div data-testid="tutorial-progress-bar" className="h-1 bg-zinc-800">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${String(progressPercent)}%` }}
            />
          </div>

          <div className="p-4 space-y-3">
            {/* Step title */}
            <div className="flex items-start justify-between gap-2">
              <h3 data-testid="tutorial-step-title" className="text-sm font-semibold text-zinc-100">
                {currentStep.title}
              </h3>
              <span data-testid="tutorial-step-count" className="text-xs text-zinc-400 whitespace-nowrap">
                Step {progress.current} of {progress.total}
              </span>
            </div>

            {/* Step content */}
            <p data-testid="tutorial-step-content" className="text-sm text-zinc-400 leading-relaxed">
              {currentStep.content}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                data-testid="tutorial-button-skip"
                type="button"
                onClick={skipTutorial}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Skip Tutorial
              </button>

              <div className="flex items-center gap-2">
                <Button
                  data-testid="tutorial-button-prev"
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  disabled={isFirstStep}
                  className="h-7 px-2 text-xs"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Previous
                </Button>

                {isLastStep ? (
                  <Button
                    data-testid="tutorial-button-finish"
                    size="sm"
                    onClick={endTutorial}
                    className="h-7 px-3 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border-none"
                  >
                    Finish
                  </Button>
                ) : (
                  <Button
                    data-testid="tutorial-button-next"
                    size="sm"
                    onClick={nextStep}
                    className="h-7 px-3 text-xs bg-cyan-600 hover:bg-cyan-500 text-white border-none"
                  >
                    Next
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <TooltipArrow position={position} targetRect={targetRect} />
        </div>
      </div>
    </>,
    document.body,
  );
}
