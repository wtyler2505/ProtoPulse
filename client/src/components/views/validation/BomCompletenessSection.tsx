import { AlertTriangle, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BomCompletionIssue } from '@/lib/bom-validation';

interface BomCompletenessSectionProps {
  bomLength: number;
  bomCompletionIssues: BomCompletionIssue[];
  bomWarningCount: number;
  bomInfoCount: number;
}

export function BomCompletenessSection({ bomLength, bomCompletionIssues, bomWarningCount, bomInfoCount }: BomCompletenessSectionProps) {
  return (
    <div data-testid="bom-completeness-section" className="w-full max-w-5xl mt-4 bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-primary" />
        BOM Completeness
        {bomCompletionIssues.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-normal ml-auto">
            {bomWarningCount > 0 && <>{bomWarningCount} warning{bomWarningCount !== 1 ? 's' : ''}</>}
            {bomWarningCount > 0 && bomInfoCount > 0 && ', '}
            {bomInfoCount > 0 && <>{bomInfoCount} info item{bomInfoCount !== 1 ? 's' : ''}</>}
          </span>
        )}
      </h3>
      {bomLength === 0 ? (
        <p className="text-xs text-muted-foreground">No BOM data available. Add components to your BOM to see completeness checks.</p>
      ) : bomCompletionIssues.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-green-500">
          <CheckCircle2 className="w-4 h-4" />
          All BOM items are complete — no issues found.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-auto">
          {bomCompletionIssues.map((issue) => (
            <div
              key={issue.id}
              data-testid={`bom-issue-${issue.id}`}
              className="flex items-start gap-2 text-xs py-1 px-2 border border-border/30 rounded hover:bg-muted/10"
            >
              {issue.severity === 'warning' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
              )}
              <span className="flex-1 text-muted-foreground">{issue.message}</span>
              {issue.partNumber && (
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{issue.partNumber}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
