/**
 * ViewOnboardingHint — Dismissible banner shown at the top of a view
 * during the user's first few visits.
 *
 * Renders a contextual onboarding hint with a title, description,
 * visit counter, and dismiss button. Automatically fades in on mount.
 */

import { X, Lightbulb } from 'lucide-react';
import { useViewOnboarding } from '@/lib/view-onboarding';
import { MAX_HINT_VISITS } from '@/lib/view-onboarding';
import { cn } from '@/lib/utils';

interface ViewOnboardingHintProps {
  /** The view name to show onboarding for. */
  viewName: string;
  /** Additional CSS classes for the outer container. */
  className?: string;
}

export default function ViewOnboardingHint({ viewName, className }: ViewOnboardingHintProps) {
  const { visible, hint, dismiss, visitCount } = useViewOnboarding(viewName);

  if (!visible || !hint) {
    return null;
  }

  const remaining = MAX_HINT_VISITS - visitCount;

  return (
    <div
      data-testid="view-onboarding-hint"
      className={cn(
        'flex items-start gap-3 px-4 py-3 mx-4 mt-3 rounded-lg',
        'border border-primary/30 bg-primary/5',
        'animate-in fade-in slide-in-from-top-2 duration-300',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground" data-testid="onboarding-hint-title">
          {hint.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5" data-testid="onboarding-hint-description">
          {hint.description}
        </p>
        {remaining > 0 && (
          <p className="text-[10px] text-muted-foreground/60 mt-1" data-testid="onboarding-hint-counter">
            Showing {remaining} more {remaining === 1 ? 'time' : 'times'}
          </p>
        )}
      </div>
      <button
        data-testid="onboarding-hint-dismiss"
        onClick={dismiss}
        className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Dismiss onboarding hint"
        type="button"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
