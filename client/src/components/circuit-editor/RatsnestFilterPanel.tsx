/**
 * RatsnestFilterPanel — UI for toggling per-net ratsnest visibility.
 *
 * Shows all nets in the current design with toggle switches,
 * search input, unrouted connection count, and bulk show/hide controls.
 */

import { useState, useMemo, useSyncExternalStore, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, EyeOff, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ratsnestFilter } from '@/lib/pcb/ratsnest-filter';
import { netColorManager } from '@/lib/circuit-editor/net-colors';
import type { RatsnestNet } from '@/components/circuit-editor/RatsnestOverlay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RatsnestFilterPanelProps {
  nets: RatsnestNet[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count unrouted connections in a net (MST edges minus routed pairs). */
function countUnrouted(net: RatsnestNet): number {
  if (net.pins.length < 2) {
    return 0;
  }
  // MST has (N-1) edges for N pins
  const mstEdges = net.pins.length - 1;
  return Math.max(0, mstEdges - net.routedPairs.size);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RatsnestFilterPanel({ nets, className }: RatsnestFilterPanelProps) {
  const [search, setSearch] = useState('');

  // Subscribe to filter state changes for reactivity
  useSyncExternalStore(
    (cb) => ratsnestFilter.subscribe(cb),
    () => ratsnestFilter.version,
  );

  // Subscribe to color manager for live color updates
  useSyncExternalStore(
    (cb) => netColorManager.subscribe(cb),
    () => netColorManager.version,
  );

  const allNetIds = useMemo(() => nets.map((n) => n.netId), [nets]);

  const filteredNets = useMemo(() => {
    if (!search.trim()) {
      return nets;
    }
    const term = search.toLowerCase();
    return nets.filter((n) => n.name.toLowerCase().includes(term));
  }, [nets, search]);

  const visibleCount = useMemo(
    () => allNetIds.filter((id) => ratsnestFilter.isNetVisible(id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allNetIds, ratsnestFilter.version],
  );

  const handleShowAll = useCallback(() => {
    ratsnestFilter.showAll();
  }, []);

  const handleHideAll = useCallback(() => {
    ratsnestFilter.hideAll(allNetIds);
  }, [allNetIds]);

  if (nets.length === 0) {
    return (
      <div
        className={cn('p-3 text-center text-xs text-muted-foreground', className)}
        data-testid="ratsnest-filter-empty"
      >
        No nets in this design
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col gap-2 bg-card/90 backdrop-blur-xl border border-border rounded-md shadow-lg p-2 w-64', className)}
      data-testid="ratsnest-filter-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-foreground" data-testid="ratsnest-filter-title">
          Ratsnest Filter
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums" data-testid="ratsnest-filter-count">
          {visibleCount}/{nets.length}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter nets..."
          className="h-7 pl-7 text-xs"
          data-testid="ratsnest-filter-search"
        />
      </div>

      {/* Bulk actions */}
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-6 text-[10px] gap-1"
          onClick={handleShowAll}
          data-testid="ratsnest-filter-show-all"
        >
          <Eye className="w-3 h-3" />
          Show All
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-6 text-[10px] gap-1"
          onClick={handleHideAll}
          data-testid="ratsnest-filter-hide-all"
        >
          <EyeOff className="w-3 h-3" />
          Hide All
        </Button>
      </div>

      {/* Net list */}
      <ScrollArea className="max-h-60">
        <div className="flex flex-col gap-0.5" data-testid="ratsnest-filter-list">
          {filteredNets.map((net) => {
            const isVisible = ratsnestFilter.isNetVisible(net.netId);
            const unrouted = countUnrouted(net);
            const effectiveColor = netColorManager.getNetColor(net.netId) ?? net.color;

            return (
              <label
                key={net.netId}
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer transition-colors',
                  !isVisible && 'opacity-50',
                )}
                data-testid={`ratsnest-filter-net-${net.netId}`}
              >
                {/* Color indicator */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: effectiveColor }}
                  data-testid={`ratsnest-filter-color-${net.netId}`}
                />

                {/* Net name + unrouted count */}
                <span className="flex-1 text-xs text-foreground truncate" title={net.name}>
                  {net.name}
                </span>
                {unrouted > 0 && (
                  <span
                    className="text-[9px] text-yellow-400/80 tabular-nums shrink-0"
                    title={`${unrouted} unrouted connection${unrouted !== 1 ? 's' : ''}`}
                    data-testid={`ratsnest-filter-unrouted-${net.netId}`}
                  >
                    {unrouted}
                  </span>
                )}

                {/* Toggle switch */}
                <Switch
                  checked={isVisible}
                  onCheckedChange={(checked) => ratsnestFilter.setNetVisibility(net.netId, checked)}
                  className="h-4 w-7 shrink-0"
                  data-testid={`ratsnest-filter-switch-${net.netId}`}
                />
              </label>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
