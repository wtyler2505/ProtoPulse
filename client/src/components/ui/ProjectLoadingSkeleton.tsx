import { Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function ProjectLoadingSkeleton() {
  return (
    <div
      className="flex flex-col h-screen w-full bg-background"
      data-testid="project-loading-skeleton"
    >
      {/* Header skeleton */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-2">
        <Layers className="w-4 h-4 text-primary animate-pulse" />
        <span className="font-bold text-sm text-foreground">ProtoPulse</span>
        <span className="text-xs text-muted-foreground ml-2">Loading project...</span>
      </div>

      {/* 3-panel skeleton */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar skeleton */}
        <div className="w-64 border-r border-border p-4 space-y-3 hidden lg:block">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-3/4" />
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>

        {/* Chat panel skeleton */}
        <div className="w-[350px] border-l border-border p-4 space-y-3 hidden lg:block">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

export default ProjectLoadingSkeleton;
