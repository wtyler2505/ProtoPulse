import { AlertTriangle, Search, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BomItem } from '@/lib/project-context';
import type { BomQuote } from '@/lib/supplier-api';

export interface DistributorInfo {
  distributorId: string;
  name: string;
  enabled: boolean;
}

export interface SupplierPricingPanelProps {
  bom: BomItem[];
  bomQuote: BomQuote | null;
  pricingSearching: boolean;
  pricingPartMpn: string;
  onPricingPartMpnChange: (value: string) => void;
  onQuoteBom: () => void;
  onSearchPartPricing: (mpn: string) => void;
  distributors: DistributorInfo[];
  currency: string;
}

export function SupplierPricingPanel({
  bom,
  bomQuote,
  pricingSearching,
  pricingPartMpn,
  onPricingPartMpnChange,
  onQuoteBom,
  onSearchPartPricing,
  distributors,
  currency,
}: SupplierPricingPanelProps) {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Simulated data disclaimer */}
      <div
        className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-4 py-3"
        role="alert"
        data-testid="supplier-mock-disclaimer"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-yellow-500">Simulated pricing data</p>
          <p className="text-muted-foreground mt-0.5">
            Stock, pricing, and lead-time data shown here is generated from static fixtures for demonstration purposes.
            It does not reflect real-time distributor availability. Connect to live supplier APIs in Settings for actual data.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button
          onClick={onQuoteBom}
          disabled={bom.length === 0 || pricingSearching}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="button-quote-bom"
        >
          <Store className={cn('w-4 h-4 mr-2', pricingSearching && 'animate-spin')} />
          Quote Entire BOM ({bom.length} items)
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="Search individual part pricing..."
            value={pricingPartMpn}
            onChange={(e) => onPricingPartMpnChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && pricingPartMpn.trim()) { onSearchPartPricing(pricingPartMpn.trim()); } }}
            className="flex-1"
            data-testid="input-pricing-search"
          />
          <Button
            variant="outline"
            onClick={() => { if (pricingPartMpn.trim()) { onSearchPartPricing(pricingPartMpn.trim()); } }}
            disabled={!pricingPartMpn.trim() || pricingSearching}
            data-testid="button-search-pricing"
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </div>

      {/* Distributor overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2" data-testid="distributor-cards">
        {distributors.filter((d) => d.enabled).map((dist) => (
          <div
            key={dist.distributorId}
            className="border border-border bg-card/80 backdrop-blur p-3 text-center"
            data-testid={`distributor-card-${dist.distributorId}`}
          >
            <div className="text-xs font-medium text-foreground">{dist.name}</div>
            <div className={cn('text-[10px] mt-1 flex items-center justify-center gap-1', dist.enabled ? 'text-emerald-500' : 'text-muted-foreground')}>
              {dist.enabled ? 'Active' : 'Disabled'}
              <Badge variant="outline" className="text-[8px] px-1 py-0 text-yellow-500 border-yellow-500/30" data-testid={`demo-badge-${dist.distributorId}`}>DEMO</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* BOM Quote Results */}
      {bomQuote && (
        <div className="border border-border bg-card/80 backdrop-blur overflow-hidden" data-testid="bom-quote-results">
          <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-foreground">BOM Quote Summary</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {bomQuote.itemsFound} found, {bomQuote.itemsMissing} missing
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono font-bold text-primary" data-testid="quote-total-cost">
                ${bomQuote.totalCost.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase">{currency} total</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[600px]" data-testid="table-bom-quote">
              <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-2">Part</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Best Distributor</th>
                  <th className="px-4 py-2 text-right">Unit Price</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bomQuote.items.map((item, idx) => (
                  <tr key={`${item.mpn}-${idx}`} className="hover:bg-muted/30 transition-colors" data-testid={`row-quote-${idx}`}>
                    <td className="px-4 py-2 font-mono text-xs font-medium text-foreground">{item.mpn}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{item.quantity}</td>
                    <td className="px-4 py-2 text-xs text-foreground">
                      {item.bestPrice ? item.bestPrice.distributor : <span className="text-destructive">Not found</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-foreground">
                      {item.bestPrice ? `$${item.bestPrice.unitPrice.toFixed(3)}` : '\u2014'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs font-bold text-foreground">
                      {item.bestPrice ? `$${item.bestPrice.totalPrice.toFixed(2)}` : '\u2014'}
                    </td>
                    <td className="px-4 py-2">
                      {item.inStock ? (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]" data-testid={`quote-stock-${idx}`}>In Stock</Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]" data-testid={`quote-stock-${idx}`}>Out</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!bomQuote && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="pricing-empty-state">
          <Store className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm text-foreground font-medium">No pricing data yet</p>
          <p className="text-xs mt-1">Click &quot;Quote Entire BOM&quot; to fetch pricing from all distributors.</p>
        </div>
      )}
    </div>
  );
}
