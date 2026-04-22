import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, X, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCatalog } from '@/lib/parts/use-parts-catalog';
import { useProjectId } from '@/lib/contexts/project-id-context';
import type { PartWithStock } from '@shared/parts/part-row';
import type { TrustLevel } from '@shared/parts/part-row';
import PartUsagePanel from '@/components/views/PartUsagePanel';
import PartAlternatesPanel from '@/components/views/PartAlternatesPanel';

// ---------------------------------------------------------------------------
// Trust level display config
// ---------------------------------------------------------------------------

const TRUST_BADGE_CONFIG: Record<TrustLevel, { label: string; className: string }> = {
  manufacturer_verified: { label: 'Manufacturer', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  protopulse_gold: { label: 'Gold', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  verified: { label: 'Verified', className: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  library: { label: 'Library', className: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  community: { label: 'Community', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  user: { label: 'User', className: 'bg-zinc-600/15 text-zinc-500 border-zinc-600/30' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search query (300ms)
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => { clearTimeout(timer); };
  }, [query]);

  // Fetch parts from canonical catalog
  const { parts, isLoading } = useCatalog({
    filter: { text: debouncedQuery },
    pagination: { limit: 20 },
    enabled: open && debouncedQuery.length > 0,
  });

  // Reset state when opening/closing
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setActiveIndex(0);
      // Focus input on next frame
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [parts]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) { return; }
    const activeItem = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSelect = useCallback((_part: PartWithStock) => {
    // For now, just close the palette. Navigation comes later.
    handleClose();
  }, [handleClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < parts.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : parts.length - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (parts.length > 0 && activeIndex >= 0 && activeIndex < parts.length) {
        handleSelect(parts[activeIndex]);
      }
      return;
    }
  }, [parts, activeIndex, handleClose, handleSelect]);

  if (!open) {
    return null;
  }

  const hasQuery = debouncedQuery.length > 0;
  const showEmpty = hasQuery && !isLoading && parts.length === 0;
  const showResults = hasQuery && parts.length > 0;
  const showHint = !hasQuery && !isLoading;

  return (
    <div
      data-testid="command-palette-overlay"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Palette card */}
      <div
        role="dialog"
        aria-label="Part search"
        aria-modal="true"
        className="relative w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl shadow-[var(--color-editor-accent)]/5 overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-zinc-700 px-4">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            type="text"
            placeholder="Search parts across all projects..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
            autoComplete="off"
            spellCheck={false}
            className={cn(
              'flex-1 bg-transparent py-3 text-sm text-zinc-100 outline-none',
              'placeholder:text-zinc-500',
              'focus:ring-0',
            )}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="text-[10px] font-mono text-zinc-500 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 ml-1 shrink-0">
            Ctrl+K
          </kbd>
        </div>

        {/* Results area */}
        <ScrollArea className="max-h-[360px]">
          <div
            ref={listRef}
            data-testid="command-palette-results"
            role="listbox"
            aria-label="Search results"
            className="p-2"
          >
            {/* Loading state */}
            {isLoading && (
              <div
                data-testid="command-palette-loading"
                className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching parts...</span>
              </div>
            )}

            {/* Empty hint (no query yet) */}
            {showHint && (
              <div
                data-testid="command-palette-empty"
                className="py-8 text-center text-sm text-zinc-500"
              >
                Type to search parts across all projects...
              </div>
            )}

            {/* No results */}
            {showEmpty && (
              <div
                data-testid="command-palette-empty"
                className="py-8 text-center text-sm text-zinc-500"
              >
                No parts match your search
              </div>
            )}

            {/* Results list */}
            {showResults && parts.map((part, index) => {
              const isActive = index === activeIndex;
              const trustConfig = TRUST_BADGE_CONFIG[part.trustLevel];

              return (
                <div
                  key={part.id}
                  data-testid={`command-palette-result-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors',
                    isActive
                      ? 'bg-[var(--color-editor-accent)]/10 text-zinc-100'
                      : 'text-zinc-300 hover:bg-zinc-800/60',
                  )}
                  onClick={() => { handleSelect(part); }}
                  onMouseEnter={() => { setActiveIndex(index); }}
                >
                  {/* Part info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-sm">
                        {part.title}
                      </span>
                      {part.mpn && (
                        <span className="shrink-0 text-[11px] font-mono text-zinc-500">
                          {part.mpn}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {part.manufacturer && (
                        <span className="truncate text-xs text-zinc-500">
                          {part.manufacturer}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 h-5 font-medium',
                        'bg-zinc-800/50 text-zinc-400 border-zinc-700',
                      )}
                    >
                      {part.canonicalCategory}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 h-5 font-medium',
                        trustConfig.className,
                      )}
                    >
                      {trustConfig.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-zinc-700 px-3 py-2 flex items-center justify-between text-[10px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-zinc-800 border border-zinc-700 rounded px-1 py-px">
                &uarr;&darr;
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-zinc-800 border border-zinc-700 rounded px-1 py-px">
                &crarr;
              </kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-zinc-800 border border-zinc-700 rounded px-1 py-px">
                esc
              </kbd>
              close
            </span>
          </div>
          {showResults && (
            <span>{parts.length} result{parts.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}
