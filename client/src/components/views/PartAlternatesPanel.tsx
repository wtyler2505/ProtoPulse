import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { cn } from '@/lib/utils';
import { usePartAlternates, useSubstitutePart, type PartAlternateCandidate } from '@/lib/parts/use-part-alternates';
import {
  alternateTrustKind,
  describeAlternateMatchReason,
  describeAlternateTradeoff,
  formatAlternateMatchScore,
  formatAlternateTrustLabel,
} from '@/lib/parts/alternate-trust';
import { useToast } from '@/hooks/use-toast';

interface PartAlternatesPanelProps {
  partId: string;
  projectId: number;
  partTitle: string;
}

function AlternateRow({
  alt,
  onPreview,
  isSubstituting,
}: {
  alt: PartAlternateCandidate;
  onPreview: (alt: PartAlternateCandidate) => void;
  isSubstituting: boolean;
}) {
  return (
    <div
      data-testid={`alternate-row-${alt.id}`}
      className="grid gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
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
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground" data-testid={`alternate-reason-${alt.id}`}>
          {describeAlternateMatchReason(alt)}
        </p>
        <p className="text-[11px] leading-4 text-muted-foreground" data-testid={`alternate-tradeoff-${alt.id}`}>
          {describeAlternateTradeoff(alt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0 sm:justify-end">
        <Badge variant="outline" className="text-[10px]" data-testid={`alternate-match-${alt.id}`}>
          {formatAlternateMatchScore(alt.matchScore)}
        </Badge>
        <span data-testid={`alternate-trust-${alt.id}`}>
          <TrustBadge kind={alternateTrustKind(alt.trustLevel)} label={formatAlternateTrustLabel(alt.trustLevel)} />
        </span>
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
          onClick={() => { onPreview(alt); }}
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

function ReplacementPreview({
  partTitle,
  alt,
  isSubstituting,
  onCancel,
  onConfirm,
}: {
  partTitle: string;
  alt: PartAlternateCandidate;
  isSubstituting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"
      data-testid="replacement-preview"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            Preview replacement
          </p>
          <p className="text-xs leading-5 text-muted-foreground" data-testid="replacement-preview-summary">
            Replace {partTitle} with {alt.title}. {describeAlternateMatchReason(alt)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]" data-testid="replacement-preview-match">
              {formatAlternateMatchScore(alt.matchScore)}
            </Badge>
            <TrustBadge kind={alternateTrustKind(alt.trustLevel)} label={formatAlternateTrustLabel(alt.trustLevel)} />
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground" data-testid="replacement-preview-tradeoff">
            Consequence check: project placements and stock merge will update after confirmation. {describeAlternateTradeoff(alt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={isSubstituting}
            onClick={onCancel}
            data-testid="replacement-preview-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isSubstituting}
            onClick={onConfirm}
            data-testid="replacement-preview-confirm"
          >
            {isSubstituting && <Loader2 className="h-3 w-3 animate-spin" />}
            Confirm replacement
          </Button>
        </div>
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
  const [previewAlt, setPreviewAlt] = useState<PartAlternateCandidate | null>(null);

  const handleConfirmSubstitute = () => {
    if (!previewAlt) {
      return;
    }

    substituteMutation.mutate(
      { oldPartId: partId, substituteId: previewAlt.id, projectId },
      {
        onSuccess: (result) => {
          setPreviewAlt(null);
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
            {previewAlt && (
              <ReplacementPreview
                partTitle={partTitle}
                alt={previewAlt}
                isSubstituting={substituteMutation.isPending}
                onCancel={() => { setPreviewAlt(null); }}
                onConfirm={handleConfirmSubstitute}
              />
            )}
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
                  onPreview={setPreviewAlt}
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
