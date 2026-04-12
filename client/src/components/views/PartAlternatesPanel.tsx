import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePartAlternates, useSubstitutePart } from '@/lib/parts/use-part-alternates';
import type { PartRow } from '@shared/parts/part-row';
import { useToast } from '@/hooks/use-toast';

interface PartAlternatesPanelProps {
  partId: string;
  projectId: number;
  partTitle: string;
}

function AlternateRow({
  alt,
  onSubstitute,
  isSubstituting,
}: {
  alt: PartRow;
  onSubstitute: (altId: string) => void;
  isSubstituting: boolean;
}) {
  return (
    <div
      data-testid={`alternate-row-${alt.id}`}
      className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            data-testid={`alternate-title-${alt.id}`}
            className="truncate text-sm font-medium text-foreground"
          >
            {alt.title}
          </span>
          {alt.mpn && (
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {alt.mpn}
            </span>
          )}
        </div>
        {alt.manufacturer && (
          <span className="text-xs text-muted-foreground">{alt.manufacturer}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {alt.canonicalCategory && (
          <Badge variant="outline" className="text-[10px]">
            {alt.canonicalCategory}
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          data-testid={`substitute-btn-${alt.id}`}
          disabled={isSubstituting}
          onClick={() => { onSubstitute(alt.id); }}
          className="h-7 gap-1 text-xs"
        >
          {isSubstituting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ArrowRightLeft className="h-3 w-3" />
          )}
          Replace
        </Button>
      </div>
    </div>
  );
}

export default function PartAlternatesPanel({
  partId,
  projectId,
  partTitle,
}: PartAlternatesPanelProps) {
  const { data: alternates, isLoading, error } = usePartAlternates(partId);
  const substituteMutation = useSubstitutePart();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const handleSubstitute = (substituteId: string) => {
    substituteMutation.mutate(
      { oldPartId: partId, substituteId, projectId },
      {
        onSuccess: (result) => {
          toast({
            title: 'Part replaced',
            description: result.message,
          });
        },
        onError: (err) => {
          toast({
            title: 'Replacement failed',
            description: err instanceof Error ? err.message : 'Unknown error',
            variant: 'destructive',
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Card data-testid="part-alternates-panel">
        <CardContent className="flex items-center justify-center py-6" data-testid="part-alternates-loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Finding alternates...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="part-alternates-panel">
        <CardContent className="py-4" data-testid="part-alternates-error">
          <p className="text-sm text-destructive">Failed to load alternates.</p>
        </CardContent>
      </Card>
    );
  }

  const count = alternates?.length ?? 0;

  return (
    <Card data-testid="part-alternates-panel">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex w-full items-center justify-between" data-testid="part-alternates-toggle">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" />
              Alternates for {partTitle}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" data-testid="part-alternates-count">
                {count} {count === 1 ? 'alternate' : 'alternates'}
              </Badge>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {count === 0 ? (
              <p
                data-testid="part-alternates-empty"
                className={cn('text-sm text-muted-foreground')}
              >
                No alternates found for this part.
              </p>
            ) : (
              alternates?.map((alt) => (
                <AlternateRow
                  key={alt.id}
                  alt={alt}
                  onSubstitute={handleSubstitute}
                  isSubstituting={substituteMutation.isPending}
                />
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
