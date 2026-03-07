import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestId?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, actionTestId, className }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-4 p-8 text-center',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon className="w-7 h-7 text-primary/60" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 data-testid="empty-state-title" className="text-base font-semibold text-foreground">
          {title}
        </h3>
        <p data-testid="empty-state-description" className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {actionLabel && onAction && (
        <button
          data-testid={actionTestId ?? 'empty-state-action'}
          onClick={onAction}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
