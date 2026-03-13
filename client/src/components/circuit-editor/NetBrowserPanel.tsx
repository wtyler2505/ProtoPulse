/**
 * NetBrowserPanel — sidebar panel listing all nets with pin count,
 * connected instances, search/filter, and click-to-highlight.
 * Equivalent to KiCad's Net Inspector. (BL-0496)
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Search, Network, Zap, Minus, Cable, Hash, RotateCcw } from 'lucide-react';
import type { CircuitNetRow, CircuitInstanceRow } from '@shared/schema';
import type { NetType } from '@shared/circuit-types';
import { cn } from '@/lib/utils';
import { netColorManager } from '@/lib/circuit-editor/net-colors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NetSegment {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
}

interface NetSummary {
  id: number;
  name: string;
  netType: NetType;
  /** Unique pin count — each (instanceId, pinId) pair is counted once. */
  pinCount: number;
  /** Unique segment count — how many wire segments belong to this net. */
  segmentCount: number;
  instanceIds: number[];
  instanceRefDes: string[];
  color: string;
  voltage: string | null;
  busWidth: number | null;
}

interface NetBrowserPanelProps {
  nets: CircuitNetRow[];
  instances: CircuitInstanceRow[];
  selectedNetName: string | null;
  onSelectNet: (netName: string | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NET_TYPE_ICONS: Record<NetType, typeof Network> = {
  signal: Cable,
  power: Zap,
  ground: Minus,
  bus: Network,
};

const NET_TYPE_DEFAULT_COLORS: Record<NetType, string> = {
  power: '#ef4444',
  ground: '#22c55e',
  signal: '#06b6d4',
  bus: '#a855f7',
};

/** 12-color palette for per-net color assignment (BL-0490). */
const NET_COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
];

// ---------------------------------------------------------------------------
// NetColorPicker — popover with preset color swatches + reset
// ---------------------------------------------------------------------------

interface NetColorPickerProps {
  netId: number;
  currentColor: string;
  defaultColor: string;
  hasCustomColor: boolean;
}

function NetColorPicker({ netId, currentColor, defaultColor, hasCustomColor }: NetColorPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelectColor = useCallback(
    (color: string) => {
      netColorManager.setNetColor(netId, color);
      setOpen(false);
    },
    [netId],
  );

  const handleReset = useCallback(() => {
    netColorManager.clearNetColor(netId);
    setOpen(false);
  }, [netId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid={`net-color-picker-${String(netId)}`}
          className="flex-shrink-0 mt-0.5 group/color"
          onClick={(e) => e.stopPropagation()}
          aria-label="Pick net color"
          type="button"
        >
          <div
            className="w-2.5 h-2.5 rounded-full border border-border/50 group-hover/color:ring-2 group-hover/color:ring-primary/40 transition-shadow"
            style={{ backgroundColor: currentColor }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        side="right"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-4 gap-1.5" data-testid={`net-color-palette-${String(netId)}`}>
          {NET_COLOR_PALETTE.map((color) => (
            <button
              key={color}
              data-testid={`net-color-swatch-${color.slice(1)}`}
              className={cn(
                'w-5 h-5 rounded-full border-2 transition-transform hover:scale-125',
                currentColor === color ? 'border-white ring-1 ring-primary' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
              onClick={() => handleSelectColor(color)}
              aria-label={`Set color ${color}`}
              type="button"
            />
          ))}
        </div>
        {hasCustomColor && (
          <button
            data-testid={`net-color-reset-${String(netId)}`}
            className="flex items-center gap-1 mt-2 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full rounded hover:bg-muted/50"
            onClick={handleReset}
            type="button"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to default ({defaultColor})
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function buildNetSummaries(nets: CircuitNetRow[], instances: CircuitInstanceRow[]): NetSummary[] {
  const instMap = new Map<number, CircuitInstanceRow>();
  for (const inst of instances) {
    instMap.set(inst.id, inst);
  }

  return nets.map((net) => {
    const segments = (net.segments ?? []) as NetSegment[];
    const instanceIdSet = new Set<number>();
    // Deduplicate pins — a pin is identified by "instanceId:pinId"
    const uniquePins = new Set<string>();

    for (const seg of segments) {
      instanceIdSet.add(seg.fromInstanceId);
      instanceIdSet.add(seg.toInstanceId);
      uniquePins.add(`${String(seg.fromInstanceId)}:${seg.fromPin}`);
      uniquePins.add(`${String(seg.toInstanceId)}:${seg.toPin}`);
    }

    const instanceIds = Array.from(instanceIdSet);
    const instanceRefDes = instanceIds
      .map((id) => instMap.get(id)?.referenceDesignator ?? `#${String(id)}`)
      .sort();

    const customColor = netColorManager.getNetColor(net.id);
    const defaultColor = NET_TYPE_DEFAULT_COLORS[net.netType as NetType] ?? '#06b6d4';

    return {
      id: net.id,
      name: net.name,
      netType: net.netType as NetType,
      pinCount: uniquePins.size,
      segmentCount: segments.length,
      instanceIds,
      instanceRefDes,
      color: customColor ?? defaultColor,
      voltage: net.voltage,
      busWidth: net.busWidth,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NetBrowserPanel({
  nets,
  instances,
  selectedNetName,
  onSelectNet,
}: NetBrowserPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<NetType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'pins' | 'type'>('name');

  // Subscribe to net color changes so the panel re-renders when colors are assigned
  useSyncExternalStore(
    (cb) => netColorManager.subscribe(cb),
    () => netColorManager.version,
  );

  const summaries = useMemo(
    () => buildNetSummaries(nets, instances),
    [nets, instances],
  );

  const filtered = useMemo(() => {
    let result = summaries;

    // Search filter — matches net name, ref designators, and voltage
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.netType.toLowerCase().includes(q) ||
          s.instanceRefDes.some((r) => r.toLowerCase().includes(q)) ||
          (s.voltage && s.voltage.toLowerCase().includes(q)),
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((s) => s.netType === typeFilter);
    }

    // Sort
    if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'pins') {
      result = [...result].sort((a, b) => b.pinCount - a.pinCount);
    } else if (sortBy === 'type') {
      result = [...result].sort((a, b) => a.netType.localeCompare(b.netType));
    }

    return result;
  }, [summaries, searchQuery, typeFilter, sortBy]);

  // Stats for the header
  const stats = useMemo(() => {
    let totalPins = 0;
    for (const s of summaries) {
      totalPins += s.pinCount;
    }
    return { totalNets: summaries.length, totalPins };
  }, [summaries]);

  return (
    <div
      data-testid="net-browser-panel"
      className="flex flex-col h-full bg-card border-l border-border"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">
          Nets ({stats.totalNets})
        </h3>
        <span className="text-[10px] text-muted-foreground" data-testid="net-browser-stats">
          {stats.totalPins} pins total
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            data-testid="net-browser-search"
            type="text"
            placeholder="Search nets, refs, voltage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted/50 border border-border rounded outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
            aria-label="Search nets"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
        <select
          data-testid="net-browser-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as NetType | 'all')}
          className="text-[10px] bg-muted/50 border border-border rounded px-1.5 py-0.5 text-muted-foreground outline-none"
          aria-label="Filter by net type"
        >
          <option value="all">All types</option>
          <option value="signal">Signal</option>
          <option value="power">Power</option>
          <option value="ground">Ground</option>
          <option value="bus">Bus</option>
        </select>
        <select
          data-testid="net-browser-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'pins' | 'type')}
          className="text-[10px] bg-muted/50 border border-border rounded px-1.5 py-0.5 text-muted-foreground outline-none"
          aria-label="Sort nets"
        >
          <option value="name">Sort: Name</option>
          <option value="pins">Sort: Pin count</option>
          <option value="type">Sort: Type</option>
        </select>
        {filtered.length !== summaries.length && (
          <span className="text-[10px] text-muted-foreground ml-auto" data-testid="net-browser-filter-count">
            {filtered.length}/{summaries.length}
          </span>
        )}
      </div>

      {/* Net list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div
            data-testid="net-browser-empty"
            className="px-3 py-6 text-center text-xs text-muted-foreground"
          >
            {summaries.length === 0 ? 'No nets in this design' : 'No nets match your search'}
          </div>
        )}

        {filtered.map((net) => {
          const Icon = NET_TYPE_ICONS[net.netType] ?? Cable;
          const isSelected = selectedNetName === net.name;

          return (
            <div
              key={net.id}
              role="button"
              tabIndex={0}
              data-testid={`net-browser-item-${String(net.id)}`}
              className={cn(
                'w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b border-border/30 cursor-pointer',
                isSelected && 'bg-primary/10 border-l-2 border-l-primary',
              )}
              onClick={() => onSelectNet(isSelected ? null : net.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectNet(isSelected ? null : net.name);
                }
              }}
              aria-label={`Select net ${net.name}`}
              aria-pressed={isSelected}
            >
              {/* Color indicator — click to open color picker (BL-0490) */}
              <NetColorPicker
                netId={net.id}
                currentColor={net.color}
                defaultColor={NET_TYPE_DEFAULT_COLORS[net.netType] ?? '#06b6d4'}
                hasCustomColor={netColorManager.getNetColor(net.id) != null}
              />

              {/* Net info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span
                    className={cn(
                      'text-xs font-medium truncate',
                      isSelected ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {net.name}
                  </span>
                  {net.voltage && (
                    <span className="text-[9px] font-mono text-amber-400/80 ml-auto flex-shrink-0">
                      {net.voltage}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {net.pinCount} {net.pinCount === 1 ? 'pin' : 'pins'}
                  </span>
                  {net.segmentCount > 0 && (
                    <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                      {net.segmentCount} {net.segmentCount === 1 ? 'seg' : 'segs'}
                    </span>
                  )}
                  {net.busWidth != null && (
                    <span className="text-[10px] text-purple-400/80 whitespace-nowrap flex items-center gap-0.5">
                      <Hash className="w-2.5 h-2.5" />
                      {net.busWidth}
                    </span>
                  )}
                </div>
                {net.instanceRefDes.length > 0 && (
                  <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                    {net.instanceRefDes.join(', ')}
                  </div>
                )}
              </div>

              {/* Type badge */}
              <span
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5',
                  net.netType === 'power' && 'bg-red-500/15 text-red-400',
                  net.netType === 'ground' && 'bg-green-500/15 text-green-400',
                  net.netType === 'signal' && 'bg-cyan-500/15 text-cyan-400',
                  net.netType === 'bus' && 'bg-purple-500/15 text-purple-400',
                )}
              >
                {net.netType}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
