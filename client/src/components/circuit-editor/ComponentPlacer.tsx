import { useState, useMemo, useCallback } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useComponentParts } from '@/lib/component-editor/hooks';
import {
  type BreadboardBenchFilter,
  type BreadboardBenchInsight,
  filterBreadboardBenchInsights,
} from '@/lib/breadboard-bench';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { Search, GripVertical, Cpu, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComponentPart } from '@shared/schema';
import type { PartMeta, Connector } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Drag data type — shared with SchematicCanvas onDrop handler
// ---------------------------------------------------------------------------

export const COMPONENT_DRAG_TYPE = 'application/x-protopulse-part';

export interface ComponentDragData {
  partId: number;
}

// ---------------------------------------------------------------------------
// Family grouping helpers
// ---------------------------------------------------------------------------

function getPartFamily(part: ComponentPart): string {
  const meta = part.meta as Partial<PartMeta> | null;
  return meta?.family || 'Other';
}

function getPartTitle(part: ComponentPart): string {
  const meta = part.meta as Partial<PartMeta> | null;
  return meta?.title || 'Untitled';
}

function getPartPinCount(part: ComponentPart): number {
  return ((part.connectors ?? []) as Connector[]).length;
}

function getBenchFilterLabel(filter: BreadboardBenchFilter): string {
  switch (filter) {
    case 'owned':
      return 'Owned';
    case 'ready':
      return 'Bench-ready';
    case 'verified':
      return 'Verified';
    case 'starter':
      return 'Starter';
    case 'all':
    default:
      return 'All';
  }
}

// ---------------------------------------------------------------------------
// Draggable part item
// ---------------------------------------------------------------------------

function PartItem({
  part,
  breadboardMode,
  insight,
}: {
  part: ComponentPart;
  breadboardMode: boolean;
  insight?: BreadboardBenchInsight;
}) {
  const title = getPartTitle(part);
  const pinCount = getPartPinCount(part);
  const meta = part.meta as Partial<PartMeta> | null;
  const packageLabel = meta?.packageType || meta?.mountingType || 'generic';

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      const dragData: ComponentDragData = { partId: part.id };
      e.dataTransfer.setData(COMPONENT_DRAG_TYPE, JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
    },
    [part.id],
  );

  return (
    <StyledTooltip
      content={
        <div className="text-xs space-y-0.5">
          <div className="font-medium">{title}</div>
          {meta?.manufacturer && <div>Mfr: {meta.manufacturer}</div>}
          {meta?.packageType && <div>Package: {meta.packageType}</div>}
          <div>{pinCount} pin{pinCount !== 1 ? 's' : ''}</div>
        </div>
      }
      side="right"
    >
      <div
        draggable
        onDragStart={onDragStart}
        data-testid={`component-placer-part-${part.id}`}
        className={cn(
          'flex items-start gap-2 rounded-xl border border-transparent px-2.5 py-2.5 transition-all',
          'cursor-grab active:cursor-grabbing hover:border-primary/20 hover:bg-muted/60 group',
        )}
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <GripVertical className="mt-1 w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary/80">
            <Cpu className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground truncate">{title}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {packageLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {pinCount} pin{pinCount === 1 ? '' : 's'}
              </span>
              {breadboardMode && insight && (
                <>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]',
                      insight.fit === 'native'
                        ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                        : insight.fit === 'requires_jumpers'
                          ? 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
                          : 'border border-amber-400/30 bg-amber-400/10 text-amber-200',
                    )}
                  >
                    {insight.fit === 'native'
                      ? 'Native fit'
                      : insight.fit === 'requires_jumpers'
                        ? 'Needs jumpers'
                        : insight.fit === 'breakout_required'
                          ? 'Breakout'
                          : 'Bench-hostile'}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]',
                      insight.modelQuality === 'verified'
                        ? 'border border-violet-400/30 bg-violet-400/10 text-violet-200'
                        : insight.modelQuality === 'basic'
                          ? 'border border-sky-400/30 bg-sky-400/10 text-sky-200'
                          : 'border border-border/70 bg-background/60 text-muted-foreground',
                    )}
                  >
                    {insight.modelQuality === 'verified'
                      ? 'Verified'
                      : insight.modelQuality === 'basic'
                        ? 'Pin-mapped'
                        : insight.modelQuality === 'community'
                          ? 'Community'
                          : 'Draft'}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]',
                      insight.isOwned
                        ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                        : 'border border-border/70 bg-background/60 text-muted-foreground',
                    )}
                  >
                    {insight.isOwned ? `${String(insight.ownedQuantity)} on hand` : 'Need to buy'}
                  </span>
                </>
              )}
            </div>
            {meta?.manufacturer && (
              <div className="mt-1 text-[10px] text-muted-foreground truncate">
                {meta.manufacturer}
              </div>
            )}
            {breadboardMode && insight?.storageLocation && (
              <div className="mt-1 text-[10px] text-muted-foreground truncate">
                Stored in {insight.storageLocation}
              </div>
            )}
          </div>
        </div>
      </div>
    </StyledTooltip>
  );
}

// ---------------------------------------------------------------------------
// Collapsible family group
// ---------------------------------------------------------------------------

function FamilyGroup({
  family,
  parts,
  defaultOpen,
  breadboardMode,
  benchInsights,
}: {
  family: string;
  parts: ComponentPart[];
  defaultOpen: boolean;
  breadboardMode: boolean;
  benchInsights?: Record<number, BreadboardBenchInsight>;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div data-testid={`component-placer-group-${family.toLowerCase().replace(/\s+/g, '-')}`}>
      <button
        className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {family}
        </span>
        <span className="text-[10px] text-muted-foreground/60 ml-auto">{parts.length}</span>
      </button>
      {open && (
        <div className="pl-1">
          {parts.map((part) => (
            <PartItem
              key={part.id}
              part={part}
              breadboardMode={breadboardMode}
              insight={benchInsights?.[part.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component Placer — sidebar panel
// ---------------------------------------------------------------------------

interface ComponentPlacerProps {
  benchInsights?: Record<number, BreadboardBenchInsight>;
  breadboardMode?: boolean;
  className?: string;
  emptyMessage?: string;
  footerHint?: string;
  parts?: ComponentPart[];
  subtitle?: string;
  title?: string;
}

export default function ComponentPlacer({
  benchInsights,
  breadboardMode = false,
  className,
  emptyMessage = 'No component parts in project',
  footerHint = 'Drag a component onto the canvas',
  parts: providedParts,
  subtitle,
  title = 'Components',
}: ComponentPlacerProps = {}) {
  const projectId = useProjectId();
  const { data: parts, isLoading } = useComponentParts(projectId);
  const [search, setSearch] = useState('');
  const [benchFilter, setBenchFilter] = useState<BreadboardBenchFilter>('all');
  const sourceParts = providedParts ?? parts ?? [];
  const loading = providedParts == null ? isLoading : false;

  const visibleBenchPartIds = useMemo(() => {
    if (!breadboardMode || !benchInsights) {
      return null;
    }
    return new Set(
      filterBreadboardBenchInsights(Object.values(benchInsights), benchFilter).map((item) => item.partId),
    );
  }, [benchFilter, benchInsights, breadboardMode]);

  // Filter by search term
  const filtered = useMemo(() => {
    const filteredByBench = visibleBenchPartIds
      ? sourceParts.filter((part) => visibleBenchPartIds.has(part.id))
      : sourceParts;

    if (!search.trim()) {
      return filteredByBench;
    }
    const q = search.toLowerCase();
    return filteredByBench.filter((p) => {
      const title = getPartTitle(p).toLowerCase();
      const family = getPartFamily(p).toLowerCase();
      const meta = p.meta as Partial<PartMeta> | null;
      const mpn = (meta?.mpn || '').toLowerCase();
      const storageLocation = (breadboardMode ? benchInsights?.[p.id]?.storageLocation : null)?.toLowerCase() ?? '';
      const benchCategory = (breadboardMode ? benchInsights?.[p.id]?.benchCategory : undefined)?.toLowerCase() ?? '';
      return (
        title.includes(q) ||
        family.includes(q) ||
        mpn.includes(q) ||
        storageLocation.includes(q) ||
        benchCategory.includes(q)
      );
    });
  }, [benchInsights, breadboardMode, search, sourceParts, visibleBenchPartIds]);

  // Group by family
  const groups = useMemo(() => {
    const map = new Map<string, ComponentPart[]>();
    for (const part of filtered) {
      const family = breadboardMode ? benchInsights?.[part.id]?.benchCategory ?? getPartFamily(part) : getPartFamily(part);
      if (!map.has(family)) map.set(family, []);
      map.get(family)!.push(part);
    }
    // Sort families alphabetically, but "Other" always last
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  return (
    <div
      className={cn('flex flex-col h-full bg-card/40 border-r border-border', className)}
      data-testid="component-placer"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-foreground mb-1.5">{title}</h3>
        {subtitle && (
          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
        {breadboardMode && (
          <div className="mb-2 flex flex-wrap gap-1">
            {(['all', 'owned', 'ready', 'verified', 'starter'] as BreadboardBenchFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                data-testid={`component-placer-filter-${filter}`}
                onClick={() => setBenchFilter(filter)}
                className={cn(
                  'rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors',
                  benchFilter === filter
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/70 bg-background/50 text-muted-foreground hover:text-foreground',
                )}
              >
                {getBenchFilterLabel(filter)}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            data-testid="component-placer-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts..."
            aria-label="Search components"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Parts list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {loading && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Loading parts...
            </div>
          )}

          {!loading && groups.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              {sourceParts.length > 0
                ? 'No parts match your search'
                : emptyMessage}
            </div>
          )}

          {groups.map(([family, familyParts]) => (
            <FamilyGroup
              key={family}
              family={family}
              parts={familyParts}
              defaultOpen={groups.length <= 5}
              breadboardMode={breadboardMode}
              benchInsights={benchInsights}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground/60 shrink-0">
        {footerHint}
      </div>
    </div>
  );
}
