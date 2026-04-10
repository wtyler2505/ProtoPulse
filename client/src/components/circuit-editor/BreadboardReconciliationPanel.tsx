import { CheckCircle2, MapPin, ShoppingCart, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BreadboardBenchInsight } from '@/lib/breadboard-bench';

interface BreadboardReconciliationPanelProps {
  insights: BreadboardBenchInsight[];
  onShop?: () => void;
}

export default function BreadboardReconciliationPanel({
  insights,
  onShop,
}: BreadboardReconciliationPanelProps) {
  const missingParts = insights.filter((i) => i.missingQuantity > 0);
  const allReady = missingParts.length === 0;

  return (
    <div data-testid="breadboard-reconciliation-panel" className="space-y-3">
      <div data-testid="reconciliation-summary" className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {allReady
            ? `All ${String(insights.length)} parts in stock`
            : `${String(missingParts.length)} of ${String(insights.length)} parts need stock`}
        </p>
        {!allReady && onShop && (
          <Button
            data-testid="shop-missing-button"
            type="button"
            size="sm"
            variant="secondary"
            onClick={onShop}
            className="h-7 gap-1 px-2 text-xs"
          >
            <ShoppingCart className="h-3 w-3" />
            Shop for missing
          </Button>
        )}
      </div>

      {allReady && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-medium text-emerald-300">Ready to build — all parts accounted for</p>
        </div>
      )}

      <div className="space-y-1">
        {insights.map((insight) => {
          const isMissing = insight.missingQuantity > 0;
          return (
            <div
              key={insight.partId}
              className="flex items-center justify-between rounded-md border border-border/40 bg-background/30 px-3 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-xs text-foreground">{insight.title}</span>
                {insight.storageLocation && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />
                    {insight.storageLocation}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {String(insight.ownedQuantity)} / {String(insight.requiredQuantity)}
                </span>
                {isMissing ? (
                  <Badge
                    data-testid="missing-badge"
                    variant="destructive"
                    className="h-5 gap-0.5 px-1.5 text-[10px]"
                  >
                    <XCircle className="h-2.5 w-2.5" />
                    {String(insight.missingQuantity)} short
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] border-emerald-500/40 text-emerald-400"
                  >
                    OK
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
