import { useState, useMemo, useCallback } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useComponentParts } from '@/lib/component-editor/hooks';
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

// ---------------------------------------------------------------------------
// Draggable part item
// ---------------------------------------------------------------------------

function PartItem({ part }: { part: ComponentPart }) {
  const title = getPartTitle(part);
  const pinCount = getPartPinCount(part);
  const meta = part.meta as Partial<PartMeta> | null;

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
          'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-grab active:cursor-grabbing',
          'hover:bg-muted/60 transition-colors group',
        )}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
        <Cpu className="w-3.5 h-3.5 text-primary/60 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground truncate">{title}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {meta?.packageType || meta?.mountingType || ''}{' '}
            {pinCount > 0 && `${pinCount}P`}
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
}: {
  family: string;
  parts: ComponentPart[];
  defaultOpen: boolean;
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
            <PartItem key={part.id} part={part} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component Placer — sidebar panel
// ---------------------------------------------------------------------------

export default function ComponentPlacer() {
  const projectId = useProjectId();
  const { data: parts, isLoading } = useComponentParts(projectId);
  const [search, setSearch] = useState('');

  // Filter by search term
  const filtered = useMemo(() => {
    if (!parts) return [];
    if (!search.trim()) return parts;
    const q = search.toLowerCase();
    return parts.filter((p) => {
      const title = getPartTitle(p).toLowerCase();
      const family = getPartFamily(p).toLowerCase();
      const meta = p.meta as Partial<PartMeta> | null;
      const mpn = (meta?.mpn || '').toLowerCase();
      return title.includes(q) || family.includes(q) || mpn.includes(q);
    });
  }, [parts, search]);

  // Group by family
  const groups = useMemo(() => {
    const map = new Map<string, ComponentPart[]>();
    for (const part of filtered) {
      const family = getPartFamily(part);
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
      className="flex flex-col h-full bg-card/40 border-r border-border"
      data-testid="component-placer"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-foreground mb-1.5">Components</h3>
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
          {isLoading && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Loading parts...
            </div>
          )}

          {!isLoading && groups.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              {parts && parts.length > 0
                ? 'No parts match your search'
                : 'No component parts in project'}
            </div>
          )}

          {groups.map(([family, familyParts]) => (
            <FamilyGroup
              key={family}
              family={family}
              parts={familyParts}
              defaultOpen={groups.length <= 5}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground/60 shrink-0">
        Drag a component onto the canvas
      </div>
    </div>
  );
}
