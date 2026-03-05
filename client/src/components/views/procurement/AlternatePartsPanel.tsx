import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BomItem } from '@/lib/project-context';
import type { AlternatePart, EquivalenceLevel, MatchConfidence } from '@/lib/alternate-parts';

export interface AlternatePartsPanelProps {
  bom: BomItem[];
  altSearchPartNumber: string;
  onAltSearchChange: (value: string) => void;
  altResults: AlternatePart[];
  altSearching: boolean;
  onFindAlternates: (partNumber: string) => void;
}

export function AlternatePartsPanel({
  bom,
  altSearchPartNumber,
  onAltSearchChange,
  altResults,
  altSearching,
  onFindAlternates,
}: AlternatePartsPanelProps) {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3" data-testid="alternates-search-bar">
        <Input
          placeholder="Enter part number to find alternates..."
          value={altSearchPartNumber}
          onChange={(e) => onAltSearchChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && altSearchPartNumber.trim()) { onFindAlternates(altSearchPartNumber.trim()); } }}
          className="flex-1"
          data-testid="input-alternate-search"
        />
        <Button
          onClick={() => { if (altSearchPartNumber.trim()) { onFindAlternates(altSearchPartNumber.trim()); } }}
          disabled={!altSearchPartNumber.trim() || altSearching}
          data-testid="button-find-alternates"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', altSearching && 'animate-spin')} />
          Find Alternates
        </Button>
      </div>

      {/* Quick search from BOM items */}
      {bom.length > 0 && (
        <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="alternates-bom-list">
          <h4 className="text-xs font-medium text-foreground mb-3 uppercase tracking-wider">BOM Items</h4>
          <div className="flex flex-wrap gap-2">
            {bom.map((item) => (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                className="text-xs font-mono"
                onClick={() => { onAltSearchChange(item.partNumber); onFindAlternates(item.partNumber); }}
                data-testid={`button-alt-bom-${item.id}`}
              >
                <RefreshCw className="w-3 h-3 mr-1.5" />
                {item.partNumber}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Results table */}
      {altResults.length > 0 && (
        <div className="border border-border bg-card/80 backdrop-blur overflow-hidden" data-testid="alternates-results">
          <div className="p-4 border-b border-border bg-muted/10">
            <h4 className="text-sm font-medium text-foreground">
              Found {altResults.length} alternate{altResults.length !== 1 ? 's' : ''}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[700px]" data-testid="table-alternates">
              <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-2">Part Number</th>
                  <th className="px-4 py-2">Manufacturer</th>
                  <th className="px-4 py-2">Equivalence</th>
                  <th className="px-4 py-2">Confidence</th>
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2">Matching Params</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {altResults.map((alt, idx) => (
                  <tr key={`${alt.part.partNumber}-${idx}`} className="hover:bg-muted/30 transition-colors" data-testid={`row-alternate-${idx}`}>
                    <td className="px-4 py-2 font-mono font-medium text-foreground text-xs" data-testid={`alt-part-number-${idx}`}>
                      {alt.part.partNumber}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs" data-testid={`alt-manufacturer-${idx}`}>
                      {alt.part.manufacturer}
                    </td>
                    <td className="px-4 py-2" data-testid={`alt-equivalence-${idx}`}>
                      <EquivalenceBadge level={alt.equivalenceLevel} />
                    </td>
                    <td className="px-4 py-2" data-testid={`alt-confidence-${idx}`}>
                      <ConfidenceBadge confidence={alt.confidence} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-foreground" data-testid={`alt-score-${idx}`}>
                      {alt.score.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-foreground" data-testid={`alt-price-${idx}`}>
                      {alt.part.unitPrice != null ? `$${alt.part.unitPrice.toFixed(2)}` : '\u2014'}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground" data-testid={`alt-params-${idx}`}>
                      {alt.matchingParameters.slice(0, 3).join(', ')}
                      {alt.matchingParameters.length > 3 && ` +${alt.matchingParameters.length - 3}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {altResults.length === 0 && altSearchPartNumber && !altSearching && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="alternates-empty-state">
          <RefreshCw className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm text-foreground font-medium">No alternates found</p>
          <p className="text-xs mt-1">Try a different part number or add parts to the reference database.</p>
        </div>
      )}
    </div>
  );
}

function EquivalenceBadge({ level }: { level: EquivalenceLevel }) {
  const styles: Record<EquivalenceLevel, string> = {
    exact: 'text-emerald-500 border-emerald-500/30',
    functional: 'text-blue-400 border-blue-400/30',
    'pin-compatible': 'text-cyan-400 border-cyan-400/30',
    similar: 'text-yellow-500 border-yellow-500/30',
    upgrade: 'text-purple-400 border-purple-400/30',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px]', styles[level])} data-testid="equivalence-badge">
      {level}
    </Badge>
  );
}

function ConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  const styles: Record<MatchConfidence, string> = {
    high: 'text-emerald-500 border-emerald-500/30',
    medium: 'text-yellow-500 border-yellow-500/30',
    low: 'text-orange-500 border-orange-500/30',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px]', styles[confidence])} data-testid="confidence-badge">
      {confidence}
    </Badge>
  );
}
