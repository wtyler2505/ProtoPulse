import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePartUsage } from '@/lib/parts/use-part-usage';
import type { PartUsageRow } from '@/lib/parts/use-part-usage';

interface PartUsagePanelProps {
  partId: string;
}

function UsageProjectRow({ row }: { row: PartUsageRow }) {
  return (
    <div
      data-testid={`part-usage-project-${row.projectId}`}
      className="flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2"
    >
      <span
        data-testid={`part-usage-project-name-${row.projectId}`}
        className="truncate text-sm font-medium text-foreground"
      >
        {row.projectName}
      </span>
      <div className="flex items-center gap-2">
        <Badge variant="outline" data-testid={`part-usage-qty-needed-${row.projectId}`}>
          Need {row.stockQuantityNeeded}
        </Badge>
        <Badge
          variant="outline"
          data-testid={`part-usage-qty-on-hand-${row.projectId}`}
          className={cn(
            row.stockQuantityOnHand !== null &&
              row.stockQuantityOnHand < row.stockQuantityNeeded &&
              'border-destructive/50 text-destructive',
          )}
        >
          Have {row.stockQuantityOnHand ?? '—'}
        </Badge>
        {row.placementCount > 0 && (
          <Badge variant="secondary" data-testid={`part-usage-placements-${row.projectId}`}>
            {row.placementCount} placed
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function PartUsagePanel({ partId }: PartUsagePanelProps) {
  const { data: usage, isLoading, error } = usePartUsage(partId);
  const [open, setOpen] = useState(true);

  if (isLoading) {
    return (
      <Card data-testid="part-usage-panel">
        <CardContent className="flex items-center justify-center py-6" data-testid="part-usage-loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading usage data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="part-usage-panel">
        <CardContent className="py-4" data-testid="part-usage-error">
          <p className="text-sm text-destructive">Failed to load usage data.</p>
        </CardContent>
      </Card>
    );
  }

  const projectCount = usage?.length ?? 0;

  return (
    <Card data-testid="part-usage-panel">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex w-full items-center justify-between" data-testid="part-usage-toggle">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Cross-Project Usage
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" data-testid="part-usage-count">
                {projectCount} {projectCount === 1 ? 'project' : 'projects'}
              </Badge>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {projectCount === 0 ? (
              <p
                data-testid="part-usage-empty"
                className="text-sm text-muted-foreground"
              >
                Not used in any project.
              </p>
            ) : (
              usage?.map((row) => <UsageProjectRow key={row.projectId} row={row} />)
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
