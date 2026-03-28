import { Clock, Trash2, RotateCcw } from 'lucide-react';

import { CollapsibleSection } from './AnalysisParamsForms';
import { ANALYSIS_TYPES } from './simulation-types';

import type { SimulationRun } from './simulation-types';

// ---------------------------------------------------------------------------
// Result History Section
// ---------------------------------------------------------------------------

export default function ResultHistorySection({
  resultHistory,
  onLoadEntry,
  onClear,
}: {
  resultHistory: SimulationRun[];
  onLoadEntry: (run: SimulationRun) => void;
  onClear: () => void;
}) {
  return (
    <CollapsibleSection title="Result History" defaultOpen={false} testId="section-result-history">
      <div data-testid="result-history">
        {resultHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No previous runs. Results will appear here after each simulation.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground">
                {resultHistory.length} run{resultHistory.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                data-testid="clear-result-history"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {resultHistory.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => onLoadEntry(run)}
                  className="flex items-center gap-3 px-3 py-2 text-xs bg-background border border-border hover:bg-muted/30 hover:border-primary/30 transition-colors text-left group"
                  data-testid={`history-entry-${run.id}`}
                >
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">
                      {ANALYSIS_TYPES.find((a) => a.id === run.analysisType)?.label}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(run.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <RotateCcw className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
