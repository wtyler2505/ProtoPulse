import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowRightLeft, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlternatesBrowse, type AlternatesBrowseRow } from '@/lib/parts/use-alternates-browse';
import { usePartAlternates } from '@/lib/parts/use-part-alternates';

function AlternateGroupRow({ row }: { row: AlternatesBrowseRow }) {
  const [expanded, setExpanded] = useState(false);
  const { data: alternates, isLoading } = usePartAlternates(expanded ? row.part.id : '');

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          data-testid={`alt-group-${row.part.id}`}
          className="w-full flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <span className="text-sm font-medium text-foreground truncate block">{row.part.title}</span>
              <div className="flex items-center gap-2 mt-0.5">
                {row.part.mpn && (
                  <span className="text-xs text-muted-foreground font-mono">{row.part.mpn}</span>
                )}
                {row.part.manufacturer && (
                  <span className="text-xs text-muted-foreground">{row.part.manufacturer}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {row.part.category && (
              <Badge variant="outline" className="text-[10px]">{row.part.category}</Badge>
            )}
            <Badge variant="secondary" data-testid={`alt-count-${row.part.id}`}>
              {row.alternateCount} {row.alternateCount === 1 ? 'alternate' : 'alternates'}
            </Badge>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 space-y-1 mb-2">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading alternates...
            </div>
          ) : alternates && alternates.length > 0 ? (
            alternates.map((alt) => (
              <div
                key={alt.id}
                data-testid={`alt-item-${alt.id}`}
                className="flex items-center justify-between rounded-md border border-border/20 bg-background/50 px-3 py-1.5"
              >
                <div className="min-w-0">
                  <span className="text-sm text-foreground">{alt.title}</span>
                  {alt.mpn && <span className="ml-2 text-xs text-muted-foreground font-mono">{alt.mpn}</span>}
                </div>
                {alt.manufacturer && (
                  <span className="text-xs text-muted-foreground shrink-0">{alt.manufacturer}</span>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">No alternates found</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PartAlternatesBrowserView() {
  const { data, isLoading, error } = useAlternatesBrowse();

  if (isLoading) {
    return (
      <Card data-testid="alternates-browser">
        <CardContent className="flex items-center justify-center py-12" data-testid="alternates-browser-loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading alternates catalog...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="alternates-browser">
        <CardContent className="py-8 text-center" data-testid="alternates-browser-error">
          <p className="text-sm text-destructive">Failed to load alternates data</p>
        </CardContent>
      </Card>
    );
  }

  const rows = data ?? [];

  return (
    <Card data-testid="alternates-browser" className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRightLeft className="h-4 w-4" />
          Part Alternates
          <Badge variant="secondary" data-testid="alternates-browser-count">
            {rows.length} {rows.length === 1 ? 'part' : 'parts'} with alternates
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Browse all parts with defined substitutes. Expand a part to see its equivalents.
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {rows.length === 0 ? (
          <p data-testid="alternates-browser-empty" className="text-sm text-muted-foreground py-8 text-center">
            No alternates defined yet. Use the ingress pipeline or AI tools to populate the alternates graph.
          </p>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-1.5 pr-2" data-testid="alternates-browser-list">
              {rows.map((row) => <AlternateGroupRow key={row.part.id} row={row} />)}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
