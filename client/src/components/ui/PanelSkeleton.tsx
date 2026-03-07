import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PanelSkeletonProps {
  className?: string;
  /** Number of content rows to show (default: 4) */
  rows?: number;
}

export function PanelSkeleton({ className, rows = 4 }: PanelSkeletonProps) {
  return (
    <div
      data-testid="panel-skeleton"
      className={cn('flex flex-col h-full w-full p-4 gap-4', className)}
    >
      {/* Header bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-md" />
        <Skeleton className="h-5 w-40 rounded" />
        <div className="flex-1" />
        <Skeleton className="h-7 w-20 rounded" />
      </div>

      {/* Toolbar / filter strip */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
        <Skeleton className="h-8 w-16 rounded" />
      </div>

      {/* Content rows */}
      <div className="flex-1 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
            <Skeleton className="h-5 w-12 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
