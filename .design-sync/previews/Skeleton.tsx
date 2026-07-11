import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function PartCardLoading() {
  return (
    <Surface>
      <div className="w-72 space-y-3 rounded-md border border-border bg-card/40 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </Surface>
  );
}

export function BomTableLoading() {
  return (
    <Surface>
      <div className="w-80 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-8" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </Surface>
  );
}
