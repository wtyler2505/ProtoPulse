import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart3, ChevronDown, ChevronRight, Loader2, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUsageBrowse, type UsageBrowseRow } from '@/lib/parts/use-usage-browse';
import { usePartUsage } from '@/lib/parts/use-part-usage';

function UsageRow({ row }: { row: UsageBrowseRow }) {
  const [expanded, setExpanded] = useState(false);
  const { data: projectUsage, isLoading } = usePartUsage(expanded ? row.part.id : null);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          data-testid={`usage-row-${row.part.id}`}
          className="flex w-full items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{row.part.title}</span>
              <div className="mt-1 flex items-center gap-2.5">
                {row.part.mpn && (
                  <span className="font-mono text-xs text-muted-foreground">{row.part.mpn}</span>
                )}
                {row.part.manufacturer && (
                  <span className="text-xs text-muted-foreground">{row.part.manufacturer}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary" className="h-5 text-[11px]" data-testid={`usage-projects-${row.part.id}`}>
              {row.projectCount} {row.projectCount === 1 ? 'project' : 'projects'}
            </Badge>
            {row.totalQuantityNeeded > 0 && (
              <Badge variant="outline" className="h-5 text-[11px]" data-testid={`usage-qty-${row.part.id}`}>
                {row.totalQuantityNeeded} needed
              </Badge>
            )}
            {row.totalPlacements > 0 && (
              <Badge variant="outline" className="h-5 text-[11px]" data-testid={`usage-placements-${row.part.id}`}>
                {row.totalPlacements} placed
              </Badge>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mb-2.5 ml-6 mt-1.5 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading project details...
            </div>
          ) : projectUsage && projectUsage.length > 0 ? (
            projectUsage.map((proj) => (
              <div
                key={proj.projectId}
                data-testid={`usage-project-${row.part.id}-${proj.projectId}`}
                className="flex items-center justify-between rounded-md border border-border/20 bg-background/50 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{proj.projectName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    Need {proj.stockQuantityNeeded}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Have {proj.stockQuantityOnHand ?? '—'}
                  </span>
                  {proj.placementCount > 0 && (
                    <Badge variant="outline" className="h-5 text-[11px]">{proj.placementCount} placed</Badge>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">No project details available</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PartUsageBrowserView() {
  const { data, isLoading, error } = useUsageBrowse();

  if (isLoading) {
    return (
      <Card data-testid="usage-browser">
        <CardContent className="flex items-center justify-center py-12" data-testid="usage-browser-loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading usage data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="usage-browser">
        <CardContent className="py-8 text-center" data-testid="usage-browser-error">
          <p className="text-sm text-destructive">Failed to load usage data</p>
        </CardContent>
      </Card>
    );
  }

  const rows = data ?? [];
  const totalProjects = new Set(rows.flatMap((r) =>
    Array.from({ length: r.projectCount }, (_, i) => `${r.part.id}-${i}`),
  )).size;

  return (
    <Card data-testid="usage-browser" className="flex h-full flex-col">
      <CardHeader className="shrink-0 pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-3.5 w-3.5" />
          Cross-Project Usage
          <Badge variant="secondary" className="h-5 text-[11px]" data-testid="usage-browser-count">
            {rows.length} {rows.length === 1 ? 'part' : 'parts'} in use
          </Badge>
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Parts used across multiple projects, sorted by usage count. Expand for per-project breakdown.
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {rows.length === 0 ? (
          <p data-testid="usage-browser-empty" className="text-sm text-muted-foreground py-8 text-center">
            No parts are in use across projects yet.
          </p>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-1.5 pr-2" data-testid="usage-browser-list">
              {rows.map((row) => <UsageRow key={row.part.id} row={row} />)}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
