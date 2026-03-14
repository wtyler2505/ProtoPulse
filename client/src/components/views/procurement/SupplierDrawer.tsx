import { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Trophy, ExternalLink, Package, AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  buildComparison,
  sortComparisonRows,
  getAvailableMpns,
} from '@/lib/supplier-comparison';
import type {
  ComparisonResult,
  ComparisonRow,
  SortField,
  SortState,
} from '@/lib/supplier-comparison';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentSort: SortState;
  onSort: (field: SortField) => void;
  className?: string;
}

function SortHeader({ label, field, currentSort, onSort, className }: SortHeaderProps) {
  const isActive = currentSort.field === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      data-testid={`sort-${field}`}
    >
      {label}
      {isActive ? (
        currentSort.direction === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function StockBadge({ status, stock }: { status: string; stock: number }) {
  const variant = status === 'in-stock'
    ? 'text-emerald-500 border-emerald-500/30'
    : status === 'low-stock'
      ? 'text-yellow-500 border-yellow-500/30'
      : 'text-destructive border-destructive/30';
  const label = status === 'in-stock'
    ? `${stock.toLocaleString()} in stock`
    : status === 'low-stock'
      ? `${stock.toLocaleString()} (low)`
      : 'Out of stock';
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] whitespace-nowrap', variant)}
      data-testid="stock-badge"
    >
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface SupplierDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill with a specific MPN when opening from a BOM row. */
  initialMpn?: string;
}

export function SupplierDrawer({ open, onOpenChange, initialMpn }: SupplierDrawerProps) {
  const [mpnInput, setMpnInput] = useState(initialMpn ?? '');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sort, setSort] = useState<SortState>({ field: 'totalPrice', direction: 'asc' });
  const [notFound, setNotFound] = useState(false);

  const availableMpns = useMemo(() => getAvailableMpns(), []);

  const handleCompare = useCallback(() => {
    const trimmed = mpnInput.trim();
    if (!trimmed) { return; }
    const result = buildComparison(trimmed, quantity);
    if (result) {
      setComparison(result);
      setNotFound(false);
    } else {
      setComparison(null);
      setNotFound(true);
    }
  }, [mpnInput, quantity]);

  const handleQuantityChange = useCallback((newQty: number) => {
    const clamped = Math.max(1, Math.round(newQty));
    setQuantity(clamped);
    if (comparison) {
      const result = buildComparison(comparison.mpn, clamped);
      if (result) {
        setComparison(result);
      }
    }
  }, [comparison]);

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const sortedRows = useMemo(() => {
    if (!comparison) { return []; }
    return sortComparisonRows(comparison.rows, sort);
  }, [comparison, sort]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCompare();
    }
  }, [handleCompare]);

  // Reset state when drawer opens with a new initialMpn
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen && initialMpn) {
      setMpnInput(initialMpn);
      const result = buildComparison(initialMpn, quantity);
      if (result) {
        setComparison(result);
        setNotFound(false);
      }
    }
    if (!isOpen) {
      setComparison(null);
      setNotFound(false);
    }
    onOpenChange(isOpen);
  }, [initialMpn, quantity, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
        data-testid="supplier-drawer"
      >
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle data-testid="supplier-drawer-title">Compare Suppliers</SheetTitle>
          <SheetDescription>
            Search a part number to compare pricing, stock, and lead times across distributors.
          </SheetDescription>
        </SheetHeader>

        {/* Search bar */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter part number (e.g. ATmega328P)"
              value={mpnInput}
              onChange={(e) => setMpnInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
              data-testid="input-comparison-mpn"
            />
            <Button
              onClick={handleCompare}
              disabled={!mpnInput.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-compare"
            >
              Compare
            </Button>
          </div>

          {/* Quantity input */}
          <div className="flex items-center gap-3">
            <label htmlFor="comparison-quantity" className="text-xs text-muted-foreground whitespace-nowrap">
              Quantity:
            </label>
            <Input
              id="comparison-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => handleQuantityChange(Number(e.target.value))}
              className="w-24"
              data-testid="input-comparison-quantity"
            />
            <div className="flex gap-1">
              {[1, 10, 100, 1000].map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'text-xs px-2 h-7',
                    quantity === q && 'bg-primary/10 border-primary text-primary',
                  )}
                  onClick={() => handleQuantityChange(q)}
                  data-testid={`button-qty-${q}`}
                >
                  {q >= 1000 ? `${q / 1000}k` : q}
                </Button>
              ))}
            </div>
          </div>

          {/* Available parts hint */}
          <div className="text-[10px] text-muted-foreground">
            <span className="font-medium">Demo parts:</span>{' '}
            {availableMpns.join(', ')}
          </div>
        </div>

        {/* Mock data disclaimer */}
        <div
          className="flex items-start gap-2 mt-4 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2"
          role="alert"
          data-testid="comparison-mock-disclaimer"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            Pricing data is simulated for demonstration. Connect live supplier APIs in Settings for real data.
          </p>
        </div>

        {/* Not found state */}
        {notFound && (
          <div
            className="mt-6 flex flex-col items-center justify-center py-8 text-muted-foreground"
            data-testid="comparison-not-found"
          >
            <Package className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm font-medium text-foreground">Part not found</p>
            <p className="text-xs mt-1">
              &quot;{mpnInput.trim()}&quot; is not in the demo catalog. Try one of the available parts above.
            </p>
          </div>
        )}

        {/* Comparison table */}
        {comparison && (
          <div className="mt-4 space-y-3" data-testid="comparison-results">
            {/* Part header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground" data-testid="comparison-mpn">
                  {comparison.mpn}
                </h3>
                <p className="text-xs text-muted-foreground">{comparison.manufacturer}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{comparison.description}</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Qty</div>
                <div className="text-lg font-mono font-bold text-primary" data-testid="comparison-quantity-display">
                  {comparison.quantity}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="border border-border rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left" data-testid="comparison-table">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-3 py-2">
                        <SortHeader label="Distributor" field="distributorName" currentSort={sort} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-2 text-right">
                        <SortHeader label="Unit Price" field="unitPrice" currentSort={sort} onSort={handleSort} className="justify-end" />
                      </th>
                      <th className="px-3 py-2 text-right">
                        <SortHeader label="Total" field="totalPrice" currentSort={sort} onSort={handleSort} className="justify-end" />
                      </th>
                      <th className="px-3 py-2">
                        <SortHeader label="Stock" field="stock" currentSort={sort} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-2">
                        <SortHeader label="Lead Time" field="leadTimeDays" currentSort={sort} onSort={handleSort} />
                      </th>
                      <th className="px-3 py-2">
                        <SortHeader label="MOQ" field="moq" currentSort={sort} onSort={handleSort} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedRows.map((row, idx) => (
                      <tr
                        key={row.distributorId}
                        className={cn(
                          'transition-colors',
                          row.isBestValue
                            ? 'bg-primary/5 hover:bg-primary/10'
                            : 'hover:bg-muted/30',
                        )}
                        data-testid={`comparison-row-${idx}`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {row.isBestValue && (
                              <Trophy className="h-3.5 w-3.5 text-primary shrink-0" data-testid="best-value-icon" />
                            )}
                            <div>
                              <div className="text-xs font-medium text-foreground flex items-center gap-1">
                                {row.distributorName}
                                {row.isBestValue && (
                                  <Badge
                                    variant="outline"
                                    className="text-[8px] px-1 py-0 text-primary border-primary/30"
                                    data-testid="best-value-badge"
                                  >
                                    BEST VALUE
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">{row.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={cn(
                              'font-mono text-xs',
                              row.isBestValue ? 'font-bold text-primary' : 'text-foreground',
                            )}
                            data-testid={`unit-price-${idx}`}
                          >
                            ${row.unitPrice.toFixed(3)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={cn(
                              'font-mono text-xs font-bold',
                              row.isBestValue ? 'text-primary' : 'text-foreground',
                            )}
                            data-testid={`total-price-${idx}`}
                          >
                            ${row.totalPrice.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <StockBadge status={row.stockStatus} stock={row.stock} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-muted-foreground" data-testid={`lead-time-${idx}`}>
                            {row.leadTimeDays !== null ? `${row.leadTimeDays}d` : '\u2014'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-muted-foreground" data-testid={`moq-${idx}`}>
                            {row.moq}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pricing tier breakdown */}
            {comparison.rows.length > 0 && (
              <details className="text-xs text-muted-foreground" data-testid="pricing-tiers-details">
                <summary className="cursor-pointer hover:text-foreground transition-colors py-1">
                  View pricing tier breakdown
                </summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {comparison.rows.map((row) => (
                    <div
                      key={row.distributorId}
                      className="border border-border rounded p-2 bg-card/50"
                      data-testid={`tier-card-${row.distributorId}`}
                    >
                      <div className="font-medium text-foreground text-[11px] mb-1">{row.distributorName}</div>
                      {row.pricingTiers.map((tier, ti) => (
                        <div key={ti} className="flex justify-between text-[10px]">
                          <span>
                            {tier.minQuantity}{tier.maxQuantity !== null ? `-${tier.maxQuantity}` : '+'}
                          </span>
                          <span className="font-mono">${tier.unitPrice.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Empty state */}
        {!comparison && !notFound && (
          <div
            className="mt-8 flex flex-col items-center justify-center py-12 text-muted-foreground"
            data-testid="comparison-empty-state"
          >
            <Package className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-medium text-foreground">No comparison yet</p>
            <p className="text-xs mt-1">Enter a part number and click Compare to see distributor pricing.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
