import { memo, useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  Ruler,
  Check,
  AlertTriangle,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DiffPairLengthMatcher } from '@/lib/pcb/diff-pair-length-match';
import type { DiffPairDef, MatchResult, MeanderConstraints } from '@/lib/pcb/diff-pair-length-match';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DiffPairLengthMatchPanelProps {
  pairs: DiffPairDef[];
  onApplyMeander?: (pairId: string, trace: 'positive' | 'negative', addedLength: number) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PairRowProps {
  result: MatchResult;
  onMatch: (pairId: string) => void;
  expanded: boolean;
  onToggle: () => void;
}

const PairRow = memo(function PairRow({ result, onMatch, expanded, onToggle }: PairRowProps) {
  const { before, suggestion, achievable } = result;
  const matched = before.matched;

  return (
    <div
      className="border border-border rounded-md overflow-hidden"
      data-testid={`pair-row-${result.pairId}`}
    >
      {/* Header */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        onClick={onToggle}
        data-testid={`pair-toggle-${result.pairId}`}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        <Ruler className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

        <span className="font-medium truncate">{result.name}</span>

        <span className="ml-auto text-xs text-muted-foreground">
          {'\u0394'} {before.delta.toFixed(3)}mm
        </span>

        {matched ? (
          <Badge
            variant="outline"
            className="ml-1 text-green-400 border-green-400/30 text-[10px] px-1.5 py-0"
            data-testid={`pair-status-${result.pairId}`}
          >
            <Check className="h-3 w-3 mr-0.5" />
            Matched
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="ml-1 text-yellow-400 border-yellow-400/30 text-[10px] px-1.5 py-0"
            data-testid={`pair-status-${result.pairId}`}
          >
            <AlertTriangle className="h-3 w-3 mr-0.5" />
            Unmatched
          </Badge>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2 bg-muted/20">
          {/* Length measurements */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div data-testid={`pair-positive-length-${result.pairId}`}>
              <span className="text-muted-foreground">P+ length:</span>{' '}
              <span className="font-mono">{before.positiveLength.toFixed(3)}mm</span>
            </div>
            <div data-testid={`pair-negative-length-${result.pairId}`}>
              <span className="text-muted-foreground">P- length:</span>{' '}
              <span className="font-mono">{before.negativeLength.toFixed(3)}mm</span>
            </div>
          </div>

          {/* Meander suggestion */}
          {suggestion && (
            <div
              className="rounded bg-muted/40 p-2 text-xs space-y-1"
              data-testid={`pair-suggestion-${result.pairId}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Meander on:</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {suggestion.trace === 'positive' ? 'P+' : 'P-'}
                </Badge>
                <span className="text-muted-foreground ml-1">adds:</span>
                <span className="font-mono">{suggestion.addedLength.toFixed(3)}mm</span>
              </div>

              {!achievable && (
                <p className="text-yellow-400/80 text-[10px]">
                  Cannot fully compensate within current constraints.
                </p>
              )}
            </div>
          )}

          {/* Match button */}
          {!matched && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => {
                onMatch(result.pairId);
              }}
              disabled={!achievable}
              data-testid={`pair-match-btn-${result.pairId}`}
            >
              <Play className="h-3 w-3 mr-1" />
              Match
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const DiffPairLengthMatchPanel = memo(function DiffPairLengthMatchPanel({
  pairs,
  onApplyMeander,
  className,
}: DiffPairLengthMatchPanelProps) {
  const matcher = useMemo(() => DiffPairLengthMatcher.instance(), []);

  // Subscribe to matcher state
  const results = useSyncExternalStore(
    useCallback((cb: () => void) => matcher.subscribe(cb), [matcher]),
    () => matcher.getSnapshot(),
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [targetDelta, setTargetDelta] = useState(matcher.targetDelta);
  const [maxAmplitude, setMaxAmplitude] = useState(matcher.constraints.maxAmplitude);
  const [spacing, setSpacing] = useState(matcher.constraints.spacing);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleMatchAll = useCallback(() => {
    matcher.autoMatchAll(pairs);
  }, [matcher, pairs]);

  const handleMatchSingle = useCallback(
    (pairId: string) => {
      const pair = pairs.find((p) => p.id === pairId);
      if (!pair) {
        return;
      }
      const result = matcher.matchSingle(pair);
      if (result.suggestion && onApplyMeander) {
        onApplyMeander(result.pairId, result.suggestion.trace, result.suggestion.addedLength);
      }
    },
    [matcher, pairs, onApplyMeander],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleApplySettings = useCallback(() => {
    matcher.setConstraints({
      targetDelta,
      maxAmplitude,
      spacing,
    });
    // Re-run match with new settings
    matcher.autoMatchAll(pairs);
  }, [matcher, targetDelta, maxAmplitude, spacing, pairs]);

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const matchedCount = results.filter((r) => r.before.matched).length;
  const totalCount = results.length;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="diff-pair-length-match-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Ruler className="h-4 w-4" />
          Diff Pair Length Matching
        </h3>
        <button
          className="p-1 rounded hover:bg-muted/50 transition-colors"
          onClick={() => {
            setShowSettings((s) => !s);
          }}
          data-testid="length-match-settings-btn"
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="border border-border rounded-md p-3 space-y-2 bg-muted/20"
          data-testid="length-match-settings"
        >
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Target {'\u0394'} (mm)</Label>
              <Input
                type="number"
                step={0.01}
                min={0}
                value={targetDelta}
                onChange={(e) => {
                  setTargetDelta(parseFloat(e.target.value) || 0);
                }}
                className="h-7 text-xs"
                data-testid="target-delta-input"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Max Amplitude (mm)</Label>
              <Input
                type="number"
                step={0.1}
                min={0.1}
                value={maxAmplitude}
                onChange={(e) => {
                  setMaxAmplitude(parseFloat(e.target.value) || 0.1);
                }}
                className="h-7 text-xs"
                data-testid="max-amplitude-input"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Spacing (mm)</Label>
              <Input
                type="number"
                step={0.1}
                min={0.1}
                value={spacing}
                onChange={(e) => {
                  setSpacing(parseFloat(e.target.value) || 0.1);
                }}
                className="h-7 text-xs"
                data-testid="spacing-input"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7"
            onClick={handleApplySettings}
            data-testid="apply-settings-btn"
          >
            Apply Settings
          </Button>
        </div>
      )}

      {/* Status bar */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span data-testid="match-status">
            {matchedCount}/{totalCount} matched
          </span>
          <span className="font-mono" data-testid="target-delta-display">
            Target {'\u0394'}: {matcher.targetDelta.toFixed(2)}mm
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-7"
          onClick={handleMatchAll}
          disabled={pairs.length === 0}
          data-testid="match-all-btn"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Analyze All
        </Button>
        <Button
          variant="default"
          size="sm"
          className="flex-1 text-xs h-7"
          onClick={() => {
            handleMatchAll();
            // Apply suggestions for all achievable pairs
            for (const result of matcher.lastResults) {
              if (result.suggestion && result.achievable && onApplyMeander) {
                onApplyMeander(result.pairId, result.suggestion.trace, result.suggestion.addedLength);
              }
            }
          }}
          disabled={pairs.length === 0}
          data-testid="match-apply-all-btn"
        >
          <Play className="h-3 w-3 mr-1" />
          Match All
        </Button>
      </div>

      {/* Pair list */}
      {results.length > 0 ? (
        <div className="space-y-1.5" data-testid="pair-list">
          {results.map((result) => (
            <PairRow
              key={result.pairId}
              result={result}
              onMatch={handleMatchSingle}
              expanded={expandedIds.has(result.pairId)}
              onToggle={() => {
                toggleExpanded(result.pairId);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-xs text-muted-foreground py-4" data-testid="no-results">
          {pairs.length === 0
            ? 'No differential pairs defined.'
            : 'Click "Analyze All" to measure pair lengths.'}
        </div>
      )}
    </div>
  );
});
