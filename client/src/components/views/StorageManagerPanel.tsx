import { useState, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Package, Search, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { BomItem } from '@shared/schema';

interface StorageManagerPanelProps {
  projectId: number;
  className?: string;
}

/** Returns stock status: 'ok' | 'low' | 'critical' | 'untracked'. */
function getStockStatus(item: BomItem): 'ok' | 'low' | 'critical' | 'untracked' {
  if (item.quantityOnHand == null || item.minimumStock == null) {
    return 'untracked';
  }
  if (item.quantityOnHand <= item.minimumStock) {
    return 'critical';
  }
  if (item.quantityOnHand < item.minimumStock * 2) {
    return 'low';
  }
  return 'ok';
}

/** Badge variant and label for each stock status. */
function getStockBadgeProps(status: 'ok' | 'low' | 'critical' | 'untracked'): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'ok':
      return {
        label: 'OK',
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      };
    case 'low':
      return {
        label: 'Low',
        className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      };
    case 'critical':
      return {
        label: 'Critical',
        className: 'bg-destructive/15 text-destructive border-destructive/30',
      };
    case 'untracked':
      return {
        label: 'Not tracked',
        className: 'bg-muted/50 text-muted-foreground border-muted',
      };
  }
}

interface LocationGroupProps {
  location: string;
  items: BomItem[];
  defaultOpen?: boolean;
}

const LocationGroup = memo(function LocationGroup({ location, items, defaultOpen = false }: LocationGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={`location-group-${location}`}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          data-testid={`location-trigger-${location}`}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
          <span className="font-medium">{location}</span>
          <Badge variant="outline" className="ml-auto text-[10px]" data-testid={`location-count-${location}`}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 space-y-1 pb-2" data-testid={`location-items-${location}`}>
          {items.map((item) => {
            const status = getStockStatus(item);
            const badgeProps = getStockBadgeProps(status);

            return (
              <div
                key={item.id}
                data-testid={`storage-item-${String(item.id)}`}
                className="flex items-center gap-3 rounded-md px-3 py-1.5 text-xs hover:bg-muted/30 transition-colors"
              >
                <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" data-testid={`item-part-${String(item.id)}`}>
                    {item.partNumber}
                  </div>
                  <div className="text-muted-foreground truncate" data-testid={`item-desc-${String(item.id)}`}>
                    {item.description}
                  </div>
                </div>
                <div className="text-right shrink-0 text-muted-foreground" data-testid={`item-qty-${String(item.id)}`}>
                  {item.quantityOnHand != null && item.minimumStock != null
                    ? `${String(item.quantityOnHand)} / ${String(item.minimumStock)}`
                    : '--'}
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 shrink-0', badgeProps.className)}
                  data-testid={`item-status-${String(item.id)}`}
                >
                  {badgeProps.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

/**
 * StorageManagerPanel — shows BOM items organized by storage location with stock level indicators.
 *
 * Features:
 * - Groups BOM items by storageLocation (null => "Unassigned")
 * - Collapsible location sections with item count
 * - Stock warning badges: green (OK), yellow (Low), red (Critical), gray (Not tracked)
 * - Search/filter by part number or location
 */
const StorageManagerPanel = memo(function StorageManagerPanel({ projectId, className }: StorageManagerPanelProps) {
  const [search, setSearch] = useState('');

  const { data: bomItems = [], isLoading } = useQuery<BomItem[]>({
    queryKey: ['/api/projects', projectId, 'bom'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${String(projectId)}/bom`);
      if (!res.ok) {
        throw new Error('Failed to fetch BOM items');
      }
      const json = (await res.json()) as { data: BomItem[] };
      return json.data;
    },
  });

  const filteredAndGrouped = useMemo(() => {
    const lowerSearch = search.toLowerCase().trim();
    const filtered = lowerSearch
      ? bomItems.filter(
          (item) =>
            item.partNumber.toLowerCase().includes(lowerSearch) ||
            item.description.toLowerCase().includes(lowerSearch) ||
            (item.storageLocation ?? '').toLowerCase().includes(lowerSearch),
        )
      : bomItems;

    const groups = new Map<string, BomItem[]>();
    for (const item of filtered) {
      const loc = item.storageLocation ?? 'Unassigned';
      const existing = groups.get(loc);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(loc, [item]);
      }
    }

    // Sort groups: named locations first (alphabetically), "Unassigned" last
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'Unassigned') { return 1; }
      if (b === 'Unassigned') { return -1; }
      return a.localeCompare(b);
    });

    return sorted;
  }, [bomItems, search]);

  const totalItems = bomItems.length;
  const lowStockCount = bomItems.filter((item) => {
    const status = getStockStatus(item);
    return status === 'low' || status === 'critical';
  }).length;

  return (
    <Card className={cn('border-border/50', className)} data-testid="storage-manager-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-400" />
            Storage Manager
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span data-testid="storage-total-count">{totalItems} items</span>
            {lowStockCount > 0 && (
              <Badge
                variant="outline"
                className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5 py-0"
                data-testid="storage-low-stock-count"
              >
                {lowStockCount} low stock
              </Badge>
            )}
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter by part number or location..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            className="h-8 pl-8 text-xs"
            data-testid="storage-search-input"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && (
          <div className="py-8 text-center text-xs text-muted-foreground" data-testid="storage-loading">
            Loading inventory...
          </div>
        )}

        {!isLoading && filteredAndGrouped.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground" data-testid="storage-empty">
            {search ? 'No items match your search.' : 'No BOM items to display.'}
          </div>
        )}

        {!isLoading && filteredAndGrouped.length > 0 && (
          <div className="space-y-1" data-testid="storage-locations-list">
            {filteredAndGrouped.map(([location, items]) => (
              <LocationGroup key={location} location={location} items={items} defaultOpen={filteredAndGrouped.length <= 3} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default StorageManagerPanel;
