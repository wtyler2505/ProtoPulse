import { memo } from 'react';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import type { KeyStatus } from '@/hooks/useApiKeyStatus';

interface ConnectionStatusDotProps {
  keyStatus: KeyStatus;
  hasKey: boolean;
}

function getStatusConfig(hasKey: boolean, keyStatus: KeyStatus): { className: string; tooltip: string } {
  if (!hasKey) {
    return { className: 'bg-muted-foreground/50', tooltip: 'No API key configured' };
  }
  switch (keyStatus) {
    case 'unchecked':
      return { className: 'bg-amber-400', tooltip: 'API key set (unverified)' };
    case 'validating':
      return { className: 'bg-amber-400 animate-pulse', tooltip: 'Verifying...' };
    case 'valid':
      return { className: 'bg-emerald-400', tooltip: 'API key valid' };
    case 'invalid':
      return { className: 'bg-destructive', tooltip: 'API key invalid' };
    case 'error':
      return { className: 'bg-destructive', tooltip: 'Connection error' };
  }
}

function ConnectionStatusDot({ keyStatus, hasKey }: ConnectionStatusDotProps) {
  const { className, tooltip } = getStatusConfig(hasKey, keyStatus);

  return (
    <StyledTooltip content={tooltip} side="bottom">
      <span
        data-testid="connection-status-dot"
        className={cn('inline-block w-2 h-2 rounded-full shrink-0', className)}
        aria-label={tooltip}
        role="status"
      />
    </StyledTooltip>
  );
}

export default memo(ConnectionStatusDot);
