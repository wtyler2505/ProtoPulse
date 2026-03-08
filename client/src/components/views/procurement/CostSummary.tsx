import { DollarSign, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BomItem } from '@/lib/project-context';

export interface CostBreakdown {
  statusCategories: Record<string, { total: number; count: number; color: string }>;
  avgUnitCost: number;
  totalBomCost: number;
  topItems: BomItem[];
  maxItemCost: number;
}

export interface CostSummaryProps {
  costBreakdown: CostBreakdown;
  /** Previous snapshot total cost — used to calculate delta. Omit if no snapshot exists. */
  previousTotalCost?: number;
}

export function CostSummary({ costBreakdown, previousTotalCost }: CostSummaryProps) {
  const delta = previousTotalCost !== undefined ? costBreakdown.totalBomCost - previousTotalCost : null;
  const deltaPct = previousTotalCost !== undefined && previousTotalCost > 0
    ? ((costBreakdown.totalBomCost - previousTotalCost) / previousTotalCost) * 100
    : null;

  return (
    <div className="mb-4 space-y-4" data-testid="section-cost-summary">
      {/* Summary cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="card-total-bom-cost">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total BOM Cost</span>
          </div>
          <div className="text-xl font-mono font-bold text-foreground" data-testid="text-summary-total-cost">
            ${costBreakdown.totalBomCost.toFixed(2)}
          </div>
          {delta !== null && (
            <div
              className={cn(
                'flex items-center gap-1 mt-1 text-[10px] font-mono font-medium',
                delta > 0 ? 'text-destructive' : delta < 0 ? 'text-emerald-500' : 'text-muted-foreground',
              )}
              data-testid="text-cost-delta"
            >
              {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
              {delta > 0 ? '+' : ''}{delta.toFixed(2)}
              {deltaPct !== null && ` (${delta > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
              <span className="text-muted-foreground/60 ml-1">vs snapshot</span>
            </div>
          )}
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="card-avg-unit-cost">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Unit Price</span>
          </div>
          <div className="text-xl font-mono font-bold text-foreground" data-testid="text-summary-avg-cost">
            ${costBreakdown.avgUnitCost.toFixed(2)}
          </div>
        </div>
        {Object.entries(costBreakdown.statusCategories)
          .filter(([, data]) => data.count > 0)
          .slice(0, 2)
          .map(([status, data]) => (
            <div key={status} className="border border-border bg-card/80 backdrop-blur p-4" data-testid={`card-status-cost-${status.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={cn('w-2.5 h-2.5 rounded-full', data.color)} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{status}</span>
              </div>
              <div className="text-xl font-mono font-bold text-foreground" data-testid={`text-status-cost-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                ${data.total.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {data.count} item{data.count !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
      </div>

      {/* Cost by status breakdown + top 5 items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Cost by status */}
        <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="panel-cost-by-status">
          <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            Cost by Status
          </h4>
          <div className="space-y-2.5">
            {Object.entries(costBreakdown.statusCategories).map(([status, data]) => {
              const pct = costBreakdown.totalBomCost > 0
                ? (data.total / costBreakdown.totalBomCost) * 100
                : 0;
              return (
                <div key={status} data-testid={`bar-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', data.color)} />
                      <span className="text-muted-foreground">{status}</span>
                      <span className="text-[10px] text-muted-foreground/60">({data.count})</span>
                    </div>
                    <span className="font-mono text-foreground">${data.total.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', data.color)}
                      style={{ width: `${Math.max(pct, 0.5)}%` }}
                      data-testid={`bar-fill-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 most expensive items */}
        <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="panel-top-cost-items">
          <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-primary" />
            Top {Math.min(5, costBreakdown.topItems.length)} by Cost
          </h4>
          {costBreakdown.topItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">No items to display.</p>
          ) : (
            <div className="space-y-2.5">
              {costBreakdown.topItems.map((item) => {
                const pct = costBreakdown.maxItemCost > 0
                  ? (Number(item.totalPrice) / costBreakdown.maxItemCost) * 100
                  : 0;
                return (
                  <div key={item.id} data-testid={`bar-item-${item.id}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono text-foreground truncate max-w-[60%]">{item.partNumber}</span>
                      <span className="font-mono text-foreground">${(Math.round(Number(item.totalPrice) * 100) / 100).toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                        data-testid={`bar-fill-item-${item.id}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
