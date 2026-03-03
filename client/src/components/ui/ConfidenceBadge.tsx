import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { cn } from '@/lib/utils';

/**
 * Confidence score data shape, mirroring the server-side ConfidenceScore interface.
 * Defined locally to avoid a cross-boundary import from server code into the client.
 */
export interface ConfidenceScore {
  score: number;
  explanation: string;
  factors: string[];
}

/** Returns Tailwind color classes based on the confidence score tier. */
function getConfidenceColors(score: number): { bg: string; text: string; border: string } {
  if (score >= 80) {
    return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  }
  if (score >= 50) {
    return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' };
  }
  if (score >= 25) {
    return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' };
  }
  return { bg: 'bg-destructive/15', text: 'text-destructive', border: 'border-destructive/30' };
}

/** Returns a human-readable label for the confidence tier. */
function getConfidenceLabel(score: number): string {
  if (score >= 80) { return 'High'; }
  if (score >= 50) { return 'Medium'; }
  if (score >= 25) { return 'Low'; }
  return 'Very Low';
}

interface ConfidenceBadgeProps {
  confidence: ConfidenceScore;
  className?: string;
}

/**
 * Displays an AI confidence score as a colored badge with a hover tooltip.
 *
 * Colors reflect certainty tiers:
 * - Green (80-100): High confidence
 * - Yellow (50-79): Medium confidence
 * - Orange (25-49): Low confidence
 * - Red (0-24): Very low confidence
 *
 * The tooltip shows the explanation and contributing factors.
 */
const ConfidenceBadge = memo(function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(confidence.score)));
  const colors = getConfidenceColors(clampedScore);
  const label = getConfidenceLabel(clampedScore);

  const tooltipContent = (
    <div className="max-w-[280px] space-y-1.5 p-1" data-testid="confidence-tooltip">
      <div className="text-xs font-medium">{label} Confidence ({clampedScore}%)</div>
      <p className="text-[11px] text-muted-foreground leading-snug">{confidence.explanation}</p>
      {confidence.factors.length > 0 && (
        <ul className="space-y-0.5">
          {confidence.factors.map((factor, i) => (
            <li key={i} className="text-[10px] text-muted-foreground/80 flex items-start gap-1">
              <span className="shrink-0 mt-0.5">--</span>
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <StyledTooltip content={tooltipContent} side="top">
      <div data-testid="confidence-badge">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0 font-medium cursor-default',
            colors.bg,
            colors.text,
            colors.border,
            className,
          )}
        >
          {clampedScore}%
        </Badge>
      </div>
    </StyledTooltip>
  );
});

export default ConfidenceBadge;
