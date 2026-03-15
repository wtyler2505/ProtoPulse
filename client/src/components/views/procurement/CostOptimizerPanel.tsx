import { useState, useCallback, useMemo } from 'react';
import { DollarSign, AlertTriangle, CheckCircle, TrendingDown, ArrowDownRight, RefreshCw, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCostOptimizer } from '@/lib/cost-optimizer';

import type { BomItem } from '@/lib/project-context';
import type { CostAnalysis, SuggestionType, SuggestionPriority } from '@/lib/cost-optimizer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CostOptimizerPanelProps {
  bom: BomItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTION_TYPE_LABELS: Record<SuggestionType, { label: string; icon: React.ReactNode }> = {
  substitute: { label: 'Substitute', icon: <RefreshCw className="w-3.5 h-3.5" /> },
  reduce_qty: { label: 'Reduce Qty', icon: <ArrowDownRight className="w-3.5 h-3.5" /> },
  change_package: { label: 'Change Package', icon: <Package className="w-3.5 h-3.5" /> },
  eliminate: { label: 'Eliminate', icon: <Trash2 className="w-3.5 h-3.5" /> },
};

const PRIORITY_STYLES: Record<SuggestionPriority, string> = {
  high: 'text-red-400 border-red-400/30 bg-red-400/10',
  medium: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  low: 'text-muted-foreground border-muted-foreground/30 bg-muted/10',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostOptimizerPanel({ bom }: CostOptimizerPanelProps) {
  const { analyze, lastAnalysis } = useCostOptimizer();

  const [budget, setBudget] = useState<number>(100);
  const [pcbCost, setPcbCost] = useState<number>(5);
  const [assemblyCost, setAssemblyCost] = useState<number>(0);

  const totalBomCost = useMemo(
    () => bom.reduce((sum, item) => sum + Number(item.totalPrice), 0),
    [bom],
  );

  const handleAnalyze = useCallback(() => {
    analyze(bom, { budget, pcbCost, assemblyCost });
  }, [analyze, bom, budget, pcbCost, assemblyCost]);

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-4" data-testid="cost-optimizer-panel">
      {/* Budget input section */}
      <div className="border border-border bg-card/80 backdrop-blur p-4 space-y-3" data-testid="budget-input-section">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          Cost Optimization
        </h3>
        <p className="text-xs text-muted-foreground">
          Set your target budget and costs to get ranked suggestions for reducing project cost.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="cost-opt-budget" className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Target Budget ($)
            </label>
            <input
              id="cost-opt-budget"
              type="number"
              min={0}
              step={1}
              value={budget}
              onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
              className="w-full border border-border bg-card/80 px-3 py-2 text-sm text-foreground font-mono"
              data-testid="input-budget"
            />
          </div>
          <div>
            <label htmlFor="cost-opt-pcb" className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              PCB Fabrication ($)
            </label>
            <input
              id="cost-opt-pcb"
              type="number"
              min={0}
              step={0.5}
              value={pcbCost}
              onChange={(e) => setPcbCost(Math.max(0, Number(e.target.value)))}
              className="w-full border border-border bg-card/80 px-3 py-2 text-sm text-foreground font-mono"
              data-testid="input-pcb-cost"
            />
          </div>
          <div>
            <label htmlFor="cost-opt-assembly" className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Assembly Cost ($)
            </label>
            <input
              id="cost-opt-assembly"
              type="number"
              min={0}
              step={0.5}
              value={assemblyCost}
              onChange={(e) => setAssemblyCost(Math.max(0, Number(e.target.value)))}
              className="w-full border border-border bg-card/80 px-3 py-2 text-sm text-foreground font-mono"
              data-testid="input-assembly-cost"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            Current BOM cost: <span className="font-mono text-foreground">${totalBomCost.toFixed(2)}</span>
          </span>
          <Button
            onClick={handleAnalyze}
            disabled={bom.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="btn-analyze"
          >
            <TrendingDown className="w-4 h-4 mr-1.5" />
            Analyze Costs
          </Button>
        </div>
      </div>

      {/* Results */}
      {lastAnalysis && <CostAnalysisResults analysis={lastAnalysis} />}

      {/* Empty state */}
      {bom.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm" data-testid="empty-bom-message">
          Add items to the BOM to use cost optimization.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results sub-component
// ---------------------------------------------------------------------------

function CostAnalysisResults({ analysis }: { analysis: CostAnalysis }) {
  return (
    <div className="space-y-4" data-testid="cost-analysis-results">
      {/* Over / under budget banner */}
      <div
        className={cn(
          'border p-3 flex items-center gap-3',
          analysis.overBudget
            ? 'border-red-500/40 bg-red-500/10 text-red-400'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
        )}
        data-testid="budget-status-banner"
      >
        {analysis.overBudget ? (
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
        )}
        <div className="text-sm font-medium">
          {analysis.overBudget
            ? `Over budget by $${analysis.delta.toFixed(2)}`
            : `Under budget by $${Math.abs(analysis.delta).toFixed(2)}`}
        </div>
        <div className="ml-auto font-mono text-sm">
          ${analysis.totalCost.toFixed(2)} / ${analysis.budget.toFixed(2)}
        </div>
      </div>

      {/* Cost breakdown by bucket */}
      <div className="border border-border bg-card/80 backdrop-blur p-4 space-y-3" data-testid="cost-breakdown-section">
        <h4 className="text-sm font-medium text-foreground">Cost Breakdown</h4>
        <div className="space-y-2">
          {analysis.buckets.map((bucket) => (
            <div key={bucket.bucket} className="flex items-center gap-3" data-testid={`bucket-${bucket.bucket}`}>
              <span className="text-xs text-muted-foreground w-28">{bucket.label}</span>
              <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    bucket.bucket === 'component' && 'bg-primary',
                    bucket.bucket === 'pcb' && 'bg-amber-400',
                    bucket.bucket === 'assembly' && 'bg-cyan-400',
                  )}
                  style={{ width: `${Math.min(bucket.percentage, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-foreground w-20 text-right">
                ${bucket.amount.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {bucket.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="border border-border bg-card/80 backdrop-blur p-4 space-y-3" data-testid="suggestions-section">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            Cost Reduction Suggestions
            <Badge variant="outline" className="ml-1 text-[10px]" data-testid="suggestion-count">
              {analysis.suggestions.length}
            </Badge>
          </h4>
          <div className="space-y-2">
            {analysis.suggestions.map((sug) => {
              const typeInfo = SUGGESTION_TYPE_LABELS[sug.type];
              return (
                <div
                  key={sug.id}
                  className="border border-border/50 bg-card/60 p-3 space-y-1.5"
                  data-testid={`suggestion-${sug.id}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] gap-1', PRIORITY_STYLES[sug.priority])}
                      data-testid={`priority-${sug.priority}`}
                    >
                      {sug.priority}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1 text-foreground">
                      {typeInfo.icon}
                      {typeInfo.label}
                    </Badge>
                    <span className="text-xs font-mono text-primary ml-auto" data-testid="suggestion-savings">
                      -${sug.estimatedSavings.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground" data-testid="suggestion-description">
                    {sug.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground" data-testid="suggestion-rationale">
                    {sug.rationale}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No suggestions */}
      {analysis.suggestions.length === 0 && (
        <div
          className="border border-border bg-card/80 backdrop-blur p-4 text-center text-sm text-muted-foreground"
          data-testid="no-suggestions"
        >
          No cost reduction suggestions — your BOM looks efficient!
        </div>
      )}
    </div>
  );
}
