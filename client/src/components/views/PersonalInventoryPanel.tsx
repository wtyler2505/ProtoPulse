import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Warehouse, Loader2, MapPin, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePersonalInventory, useAddPersonalStock } from '@/lib/parts/use-personal-inventory';
import { useCatalog } from '@/lib/parts/use-parts-catalog';
import type { PartStockRow } from '@shared/parts/part-row';
import { useToast } from '@/hooks/use-toast';

function StockRow({ stock }: { stock: PartStockRow }) {
  return (
    <div
      data-testid={`personal-stock-${stock.id}`}
      className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-foreground truncate block" data-testid={`personal-stock-part-${stock.id}`}>
          {stock.partId.slice(0, 8)}...
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          {stock.storageLocation && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {stock.storageLocation}
            </span>
          )}
          {stock.supplier && (
            <span className="text-xs text-muted-foreground">{stock.supplier}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" data-testid={`personal-stock-qty-${stock.id}`}>
          {stock.quantityOnHand ?? 0} on hand
        </Badge>
        {stock.unitPrice && (
          <Badge variant="secondary" className="text-[10px]">
            ${Number(stock.unitPrice).toFixed(2)}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function PersonalInventoryPanel() {
  const { data: personalStock, isLoading } = usePersonalInventory();
  const addMutation = useAddPersonalStock();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  // Search canonical catalog for adding parts
  const { parts: searchResults, isLoading: searching } = useCatalog({
    filter: { text: searchQuery },
    pagination: { limit: 5 },
    enabled: searchQuery.length >= 2,
  });

  const handleAddPart = (partId: string) => {
    addMutation.mutate(
      { partId, quantityOnHand: 1 },
      {
        onSuccess: () => {
          toast({ title: 'Added to personal inventory' });
          setSearchQuery('');
        },
        onError: () => {
          toast({ title: 'Failed to add part', variant: 'destructive' });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Card data-testid="personal-inventory-panel">
        <CardContent className="flex items-center justify-center py-6" data-testid="personal-inventory-loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading inventory...</span>
        </CardContent>
      </Card>
    );
  }

  const stockCount = personalStock?.length ?? 0;

  // Group by storage location
  const byLocation = new Map<string, PartStockRow[]>();
  for (const item of personalStock ?? []) {
    const loc = item.storageLocation || 'Unassigned';
    const group = byLocation.get(loc) ?? [];
    group.push(item);
    byLocation.set(loc, group);
  }

  return (
    <Card data-testid="personal-inventory-panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Warehouse className="h-4 w-4" />
          Personal Inventory
          <Badge variant="secondary" data-testid="personal-inventory-count">
            {stockCount} {stockCount === 1 ? 'item' : 'items'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add part to personal stock */}
        <div className="relative" data-testid="personal-inventory-search">
          <Input
            data-testid="personal-inventory-search-input"
            placeholder="Search parts to add to your bin..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); }}
            className="h-8 text-sm"
          />
          {searchQuery.length >= 2 && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 rounded-md border border-border bg-popover shadow-md">
              {searchResults.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  data-testid={`personal-add-${part.id}`}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                  onClick={() => { handleAddPart(part.id); }}
                >
                  <span className="font-medium">{part.title}</span>
                  {part.mpn && <span className="ml-2 text-xs text-muted-foreground font-mono">{part.mpn}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stock list grouped by location */}
        {stockCount === 0 ? (
          <p data-testid="personal-inventory-empty" className="text-sm text-muted-foreground py-4 text-center">
            Your personal inventory is empty. Search above to add parts.
          </p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-4" data-testid="personal-inventory-list">
              {Array.from(byLocation.entries()).map(([location, items]) => (
                <div key={location}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{location}</span>
                    <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((stock) => <StockRow key={stock.id} stock={stock} />)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
