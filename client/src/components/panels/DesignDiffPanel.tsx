import { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  GitCompareArrows,
  ChevronDown,
  ChevronRight,
  X,
  Minus,
  Plus,
  Pencil,
  Equal,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
  DesignDiffResult,
  DiffSection,
  DiffRow,
  DiffChangeType,
} from '@/lib/design-diff-viewer';
import { changeTypeColor, changeTypeLabel } from '@/lib/design-diff-viewer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DesignDiffPanelProps {
  result: DesignDiffResult;
  baselineName: string;
  currentName: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Change type icon helper
// ---------------------------------------------------------------------------

function ChangeIcon({ type }: { type: DiffChangeType }) {
  switch (type) {
    case 'added': return <Plus className="w-3 h-3" />;
    case 'removed': return <Minus className="w-3 h-3" />;
    case 'modified': return <Pencil className="w-3 h-3" />;
    case 'unchanged': return <Equal className="w-3 h-3" />;
  }
}

// ---------------------------------------------------------------------------
// Filter controls
// ---------------------------------------------------------------------------

const CHANGE_TYPES: DiffChangeType[] = ['added', 'removed', 'modified', 'unchanged'];

// ---------------------------------------------------------------------------
// Synchronized scroll hook
// ---------------------------------------------------------------------------

function useSyncScroll() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (isScrolling.current) {
      return;
    }
    isScrolling.current = true;

    const from = source === 'left' ? leftRef.current : rightRef.current;
    const to = source === 'left' ? rightRef.current : leftRef.current;

    if (from && to) {
      to.scrollTop = from.scrollTop;
    }

    // Use rAF to prevent scroll event re-entrancy
    requestAnimationFrame(() => {
      isScrolling.current = false;
    });
  }, []);

  return { leftRef, rightRef, handleScroll };
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

interface SectionViewProps {
  section: DiffSection;
  visibleTypes: Set<DiffChangeType>;
  baselineName: string;
  currentName: string;
}

function SectionView({ section, visibleTypes, baselineName, currentName }: SectionViewProps) {
  const [expanded, setExpanded] = useState(true);
  const { leftRef, rightRef, handleScroll } = useSyncScroll();

  const filteredRows = section.rows.filter((r) => visibleTypes.has(r.changeType));
  const hasChanges = section.summary.added + section.summary.removed + section.summary.modified > 0;

  return (
    <div
      className="border border-border/50 bg-card/30 backdrop-blur"
      data-testid={`diff-section-${section.id}`}
    >
      {/* Section header */}
      <button
        data-testid={`diff-section-toggle-${section.id}`}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${section.label}`}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        <span className="flex-1 text-left">{section.label}</span>
        {!hasChanges && (
          <span className="text-[10px] text-muted-foreground/60">No changes</span>
        )}
        {section.summary.added > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono text-green-400 border-green-400/30 px-1.5 py-0" data-testid={`diff-badge-added-${section.id}`}>
            +{section.summary.added}
          </Badge>
        )}
        {section.summary.removed > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono text-red-400 border-red-400/30 px-1.5 py-0" data-testid={`diff-badge-removed-${section.id}`}>
            -{section.summary.removed}
          </Badge>
        )}
        {section.summary.modified > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono text-amber-400 border-amber-400/30 px-1.5 py-0" data-testid={`diff-badge-modified-${section.id}`}>
            ~{section.summary.modified}
          </Badge>
        )}
      </button>

      {/* Section body — two-column layout */}
      {expanded && filteredRows.length > 0 && (
        <div className="border-t border-border/30">
          {/* Column headers */}
          <div className="grid grid-cols-2 divide-x divide-border/30 bg-muted/20">
            <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground/70 truncate" data-testid={`diff-header-baseline-${section.id}`}>
              {baselineName}
            </div>
            <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground/70 truncate" data-testid={`diff-header-current-${section.id}`}>
              {currentName}
            </div>
          </div>

          {/* Synchronized scrollable columns */}
          <div className="grid grid-cols-2 divide-x divide-border/30">
            <div
              ref={leftRef}
              className="overflow-y-auto max-h-[300px]"
              onScroll={() => handleScroll('left')}
              data-testid={`diff-left-${section.id}`}
            >
              {filteredRows.map((row) => (
                <DiffRowLeft key={row.key} row={row} columns={section.columns} />
              ))}
            </div>
            <div
              ref={rightRef}
              className="overflow-y-auto max-h-[300px]"
              onScroll={() => handleScroll('right')}
              data-testid={`diff-right-${section.id}`}
            >
              {filteredRows.map((row) => (
                <DiffRowRight key={row.key} row={row} columns={section.columns} />
              ))}
            </div>
          </div>
        </div>
      )}

      {expanded && filteredRows.length === 0 && (
        <div className="border-t border-border/30 px-3 py-3 text-[10px] text-muted-foreground/50 text-center">
          {section.rows.length === 0 ? 'No elements in this section' : 'No rows match the active filters'}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row renderers — left (baseline) and right (current)
// ---------------------------------------------------------------------------

function DiffRowLeft({ row, columns }: { row: DiffRow; columns: string[] }) {
  if (row.changeType === 'added') {
    // No baseline for added rows — show placeholder
    return (
      <div className="px-3 py-2 min-h-[44px] flex items-center text-[10px] text-muted-foreground/30 italic bg-green-400/5" data-testid={`diff-row-left-${row.key}`}>
        (not in baseline)
      </div>
    );
  }

  const isRemoved = row.changeType === 'removed';
  const isModified = row.changeType === 'modified';

  return (
    <div
      className={cn(
        'px-3 py-2 min-h-[44px]',
        isRemoved && 'bg-red-400/10',
        isModified && 'bg-amber-400/5',
      )}
      data-testid={`diff-row-left-${row.key}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('shrink-0', changeTypeColor(row.changeType))}>
          <ChangeIcon type={row.changeType} />
        </span>
        <span className="text-[11px] font-medium text-foreground truncate">{row.label}</span>
      </div>
      {row.baselineFields && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {columns.map((col) => {
            const val = row.baselineFields?.[col];
            const isChanged = isModified && row.fieldChanges.some((c) => c.field === col);
            return (
              <span key={col} className={cn('text-[10px]', isChanged ? 'text-amber-400 line-through' : 'text-muted-foreground')}>
                {col}: {val ?? '—'}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiffRowRight({ row, columns }: { row: DiffRow; columns: string[] }) {
  if (row.changeType === 'removed') {
    // No current for removed rows — show placeholder
    return (
      <div className="px-3 py-2 min-h-[44px] flex items-center text-[10px] text-muted-foreground/30 italic bg-red-400/5" data-testid={`diff-row-right-${row.key}`}>
        (removed)
      </div>
    );
  }

  const isAdded = row.changeType === 'added';
  const isModified = row.changeType === 'modified';

  return (
    <div
      className={cn(
        'px-3 py-2 min-h-[44px]',
        isAdded && 'bg-green-400/10',
        isModified && 'bg-amber-400/5',
      )}
      data-testid={`diff-row-right-${row.key}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('shrink-0', changeTypeColor(row.changeType))}>
          <ChangeIcon type={row.changeType} />
        </span>
        <span className="text-[11px] font-medium text-foreground truncate">{row.label}</span>
      </div>
      {row.currentFields && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {columns.map((col) => {
            const val = row.currentFields?.[col];
            const isChanged = isModified && row.fieldChanges.some((c) => c.field === col);
            return (
              <span key={col} className={cn('text-[10px]', isChanged ? 'text-green-400 font-semibold' : 'text-muted-foreground')}>
                {col}: {val ?? '—'}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

function DesignDiffPanel({ result, baselineName, currentName, onClose }: DesignDiffPanelProps) {
  const [visibleTypes, setVisibleTypes] = useState<Set<DiffChangeType>>(new Set(CHANGE_TYPES));

  const toggleType = useCallback((type: DiffChangeType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Suppress body scroll when panel is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const { totalSummary } = result;

  return (
    <div
      className="h-full w-full bg-background/80 backdrop-blur p-4 overflow-auto flex flex-col gap-3"
      data-testid="design-diff-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-display font-bold text-foreground tracking-wide">DESIGN DIFF</h2>
        </div>
        <button
          data-testid="diff-close-button"
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          onClick={onClose}
          aria-label="Close design diff"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground" data-testid="diff-summary">
        <ArrowUpDown className="w-3.5 h-3.5 text-primary/70 shrink-0" />
        <span>{totalSummary.total} element{totalSummary.total !== 1 ? 's' : ''} compared</span>
        {totalSummary.added > 0 && <span className="text-green-400">+{totalSummary.added} added</span>}
        {totalSummary.removed > 0 && <span className="text-red-400">-{totalSummary.removed} removed</span>}
        {totalSummary.modified > 0 && <span className="text-amber-400">~{totalSummary.modified} modified</span>}
        {totalSummary.unchanged > 0 && <span>{totalSummary.unchanged} unchanged</span>}
      </div>

      {/* Filter toggles */}
      <div className="flex items-center gap-1.5" data-testid="diff-filters">
        {CHANGE_TYPES.map((type) => {
          const active = visibleTypes.has(type);
          return (
            <button
              key={type}
              data-testid={`diff-filter-${type}`}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-[10px] font-medium border rounded-sm transition-colors',
                active ? changeTypeColor(type) + ' border-current' : 'text-muted-foreground/40 border-border/30',
              )}
              onClick={() => toggleType(type)}
              aria-pressed={active}
              aria-label={`${active ? 'Hide' : 'Show'} ${changeTypeLabel(type).toLowerCase()} items`}
            >
              <ChangeIcon type={type} />
              {changeTypeLabel(type)}
            </button>
          );
        })}
      </div>

      {/* Sections */}
      {result.sections.map((section) => (
        <SectionView
          key={section.id}
          section={section}
          visibleTypes={visibleTypes}
          baselineName={baselineName}
          currentName={currentName}
        />
      ))}

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground/50 text-center mt-auto pt-2">
        Comparing &quot;{baselineName}&quot; vs &quot;{currentName}&quot;
      </p>
    </div>
  );
}

export default memo(DesignDiffPanel);
