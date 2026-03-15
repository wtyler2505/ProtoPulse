/**
 * SmartHintToast — Non-intrusive toast overlay for smart hints.
 *
 * Displays contextual hints triggered by repeated user mistakes.
 * Shows the most recent active hint with a dismiss button.
 * Renders as a fixed-position element in the bottom-left corner
 * to avoid overlapping with the standard toast viewport (bottom-right).
 */

import { useEffect, useState } from 'react';
import { X, Lightbulb, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartHints } from '@/lib/smart-hints';
import type { ActiveHint, HintSeverity } from '@/lib/smart-hints';

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

const severityStyles: Record<HintSeverity, { border: string; bg: string; text: string; icon: typeof Lightbulb }> = {
  tip: {
    border: 'border-primary/50',
    bg: 'bg-primary/10',
    text: 'text-primary',
    icon: Lightbulb,
  },
  warning: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    icon: AlertTriangle,
  },
  info: {
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    icon: Info,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SmartHintToast() {
  const { activeHints, dismissHint } = useSmartHints();
  const [visible, setVisible] = useState(false);
  const [currentHint, setCurrentHint] = useState<ActiveHint | null>(null);

  // Show the most recent active hint
  useEffect(() => {
    if (activeHints.length > 0) {
      const newest = activeHints[0];
      // Only update if it's a different hint
      if (!currentHint || currentHint.patternId !== newest.patternId) {
        setCurrentHint(newest);
        setVisible(true);
      }
    } else {
      setVisible(false);
    }
  }, [activeHints, currentHint]);

  const handleDismiss = () => {
    if (currentHint) {
      setVisible(false);
      // Brief delay to allow exit animation
      setTimeout(() => {
        dismissHint(currentHint.patternId);
        setCurrentHint(null);
      }, 200);
    }
  };

  if (!visible || !currentHint) {
    return null;
  }

  const style = severityStyles[currentHint.severity];
  const Icon = style.icon;

  return (
    <div
      data-testid="smart-hint-toast"
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border p-4 shadow-lg backdrop-blur-sm transition-all duration-200',
        style.border,
        style.bg,
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.text)} />
        <div className="flex-1 min-w-0">
          <p data-testid="smart-hint-label" className={cn('text-sm font-medium', style.text)}>
            {currentHint.label}
          </p>
          <p data-testid="smart-hint-message" className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {currentHint.hint}
          </p>
          {currentHint.category && (
            <span
              data-testid="smart-hint-category"
              className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider"
            >
              {currentHint.category}
            </span>
          )}
        </div>
        <button
          data-testid="smart-hint-dismiss"
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Dismiss hint"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
