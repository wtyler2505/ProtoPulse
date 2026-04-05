import { Badge } from '@/components/ui/badge';
import { confidenceBandColor } from '@/lib/risk-scorecard';
import type { ScorecardResult } from '@/lib/risk-scorecard';

interface ReleaseConfidenceCardProps {
  result: ScorecardResult;
  title?: string;
  sourceNote?: string;
  dataTestId?: string;
}

export default function ReleaseConfidenceCard({
  result,
  title = 'Release Confidence',
  sourceNote = result.confidence.sourceNote,
  dataTestId = 'release-confidence-panel',
}: ReleaseConfidenceCardProps) {
  const accent = confidenceBandColor(result.confidence.band);

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4" data-testid={dataTestId}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold" data-testid="release-confidence-title">
            {title}
          </h4>
          <p className="text-xs text-muted-foreground" data-testid="release-confidence-source">
            {sourceNote}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="text-xs"
            style={{ color: accent, borderColor: `${accent}66`, backgroundColor: `${accent}14` }}
            data-testid="release-confidence-band"
          >
            {result.confidence.label}
          </Badge>
          <Badge variant="outline" className="text-xs" data-testid="release-confidence-evidence">
            {result.confidence.evidenceLabel}
          </Badge>
        </div>
      </div>

      <p className="text-sm leading-6 text-foreground/90" data-testid="release-confidence-summary">
        {result.confidence.summary}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2" data-testid="release-confidence-blockers">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Top blockers
          </div>
          {result.confidence.blockers.length > 0 ? (
            <ul className="space-y-2">
              {result.confidence.blockers.map((blocker) => (
                <li key={blocker} className="text-sm text-amber-100/90">
                  {blocker}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No critical or major blockers are currently visible in this workspace snapshot.
            </p>
          )}
        </div>

        <div className="space-y-2" data-testid="release-confidence-actions">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next actions
          </div>
          <ul className="space-y-2">
            {result.confidence.nextActions.map((action) => (
              <li key={action} className="text-sm text-foreground/90">
                {action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
