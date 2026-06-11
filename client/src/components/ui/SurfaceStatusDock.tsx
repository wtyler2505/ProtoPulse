import type { ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TrustBadge, type TrustBadgeKind } from '@/components/ui/TrustBadge';
import { cn } from '@/lib/utils';

export interface SurfaceStatusDockProps {
  ariaLabel: string;
  title: ReactNode;
  trustKind: TrustBadgeKind;
  trustLabel: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  bodyTestId: string;
  className?: string;
  collapsedClassName?: string;
  expandedClassName?: string;
  origin?: ReactNode;
  testId?: string;
  titleTestId?: string;
  originTestId?: string;
  toggleTestId?: string;
}

export function SurfaceStatusDock({
  ariaLabel,
  title,
  trustKind,
  trustLabel,
  collapsed,
  onToggle,
  children,
  bodyTestId,
  className,
  collapsedClassName = 'w-auto min-w-0',
  expandedClassName = 'w-full min-w-0 sm:w-[clamp(13rem,24vw,22rem)]',
  origin,
  testId = 'surface-status-dock',
  titleTestId,
  originTestId,
  toggleTestId = 'button-toggle-surface-status',
}: SurfaceStatusDockProps) {
  return (
    <aside
      aria-label={ariaLabel}
      aria-live="polite"
      className={cn(
        'pointer-events-auto max-h-52 max-w-full resize-x overflow-auto rounded-md border border-border/80 bg-background/95 p-2 text-[11px] shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80',
        collapsed ? collapsedClassName : expandedClassName,
        className,
      )}
      data-collapsed={String(collapsed)}
      data-resize-axis="horizontal"
      data-resizable="true"
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <TrustBadge kind={trustKind} label={trustLabel} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground" data-testid={titleTestId}>
            {title}
          </p>
          {!collapsed && origin != null ? (
            <p className="truncate text-muted-foreground" data-testid={originTestId}>
              {origin}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 rounded-sm p-0 text-muted-foreground hover:text-foreground"
          data-testid={toggleTestId}
          aria-label={collapsed ? `Expand ${ariaLabel}` : `Collapse ${ariaLabel}`}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <ChevronUp className={cn('h-3.5 w-3.5 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      {!collapsed ? (
        <div className="mt-2 space-y-2" data-testid={bodyTestId}>
          {children}
        </div>
      ) : null}
    </aside>
  );
}
