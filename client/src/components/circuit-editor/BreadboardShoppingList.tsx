import { Download, PackageX } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DistributorId } from '@/lib/supplier-api';

export interface ShoppingListItem {
  partName: string;
  mpn: string;
  quantityNeeded: number;
  bestPrice: {
    distributor: DistributorId;
    unitPrice: number;
    totalPrice: number;
    sku: string;
  } | null;
}

interface BreadboardShoppingListProps {
  missingParts: ShoppingListItem[];
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function generateCsv(parts: ShoppingListItem[]): string {
  const header = 'Part Name,MPN,Quantity,Distributor,Unit Price,Total Price,SKU';
  const rows = parts.map((p) => {
    const dist = p.bestPrice?.distributor ?? '';
    const unit = p.bestPrice ? p.bestPrice.unitPrice.toFixed(2) : '';
    const total = p.bestPrice ? p.bestPrice.totalPrice.toFixed(2) : '';
    const sku = p.bestPrice?.sku ?? '';
    return `"${p.partName}","${p.mpn}",${String(p.quantityNeeded)},"${dist}","${unit}","${total}","${sku}"`;
  });
  return [header, ...rows].join('\n');
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BreadboardShoppingList({ missingParts }: BreadboardShoppingListProps) {
  if (missingParts.length === 0) {
    return (
      <div data-testid="breadboard-shopping-list" className="flex flex-col items-center gap-2 py-6 text-center">
        <PackageX className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">No missing parts — nothing to shop for</p>
      </div>
    );
  }

  const totalCost = missingParts.reduce((sum, p) => sum + (p.bestPrice?.totalPrice ?? 0), 0);

  function handleExportCsv(): void {
    const csv = generateCsv(missingParts);
    downloadCsv(csv, 'breadboard-shopping-list.csv');
  }

  return (
    <div data-testid="breadboard-shopping-list" className="space-y-3">
      <div className="flex items-center justify-between">
        <p data-testid="total-cost" className="text-sm font-medium text-foreground">
          Est. total: {formatCurrency(totalCost)}
        </p>
        <Button
          data-testid="export-csv"
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExportCsv}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </Button>
      </div>

      <div className="space-y-1">
        {missingParts.map((part, index) => (
          <div
            key={part.mpn}
            data-testid={`shopping-row-${String(index)}`}
            className="flex items-center justify-between rounded-md border border-border/40 bg-background/30 px-3 py-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-xs text-foreground">{part.partName}</span>
              <span className="text-[10px] text-muted-foreground">{part.mpn}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                x{String(part.quantityNeeded)}
              </Badge>
              {part.bestPrice ? (
                <span className="text-xs tabular-nums text-foreground">
                  {formatCurrency(part.bestPrice.totalPrice)}{' '}
                  <span className="text-muted-foreground">
                    ({part.bestPrice.distributor})
                  </span>
                </span>
              ) : (
                <span className="text-xs text-amber-400">No price found</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
