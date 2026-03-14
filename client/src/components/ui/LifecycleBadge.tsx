import { memo } from 'react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { cn } from '@/lib/utils';
import {
  classifyLifecycle,
  getLifecycleColor,
  getLifecycleLabel,
  getLifecycleAdvice,
} from '@/lib/lifecycle-badges';
import type { LifecycleStatus } from '@/lib/lifecycle-badges';

export interface LifecycleBadgeProps {
  partNumber: string;
  manufacturer?: string;
  /** Override the auto-classified status (useful for testing or server-provided data). */
  status?: LifecycleStatus;
  className?: string;
}

/**
 * Small inline badge showing the lifecycle status of a component.
 * Automatically classifies based on part number if no explicit status is provided.
 * Hidden for 'unknown' and 'active' statuses to reduce visual noise — only
 * actionable statuses (NRND, EOL, obsolete, preliminary) are shown.
 */
function LifecycleBadgeInner({ partNumber, manufacturer, status: overrideStatus, className }: LifecycleBadgeProps) {
  const status = overrideStatus ?? classifyLifecycle(partNumber, manufacturer);

  // Don't render for active or unknown — only show badges that need attention
  if (status === 'active' || status === 'unknown') {
    return null;
  }

  const colors = getLifecycleColor(status);
  const label = getLifecycleLabel(status);
  const advice = getLifecycleAdvice(status);

  return (
    <StyledTooltip content={advice} side="right">
      <span
        className={cn(
          'inline-flex items-center px-1 py-0 text-[9px] font-medium border uppercase tracking-wider shrink-0',
          colors.bg,
          colors.text,
          colors.border,
          className,
        )}
        data-testid={`lifecycle-badge-${status}`}
      >
        {label}
      </span>
    </StyledTooltip>
  );
}

export const LifecycleBadge = memo(LifecycleBadgeInner);
