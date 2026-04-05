import { useEffect, useCallback, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { useBom, useProjectId, useProjectMeta } from '@/lib/project-context';
import { useCommunityLibrary } from '@/lib/community-library';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { mapCommunityPartToBom } from '@/lib/community-bom-bridge';
import {
  Search,
  Package,
  Cpu,
  Globe,
  Plus,
  ArrowRightToLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';

interface SearchResult {
  id: string;
  label: string;
  description: string;
  category: 'Standard Library' | 'Community Library' | 'BOM Items';
  icon: React.ComponentType<{ className?: string }>;
  partId?: number; // For placing from Standard Library
  communityPart?: any; // For placing/adding from Community Library
  bomItem?: any;
}

const FUSE_OPTIONS: IFuseOptions<SearchResult> = {
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  shouldSort: true,
  minMatchCharLength: 2,
  keys: ['label', 'description'],
};

function getDefaultActionType(result: SearchResult): 'place' | 'bom' {
  return result.category === 'Community Library' ? 'bom' : 'place';
}

export default function UnifiedComponentSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const projectId = useProjectId();
  const { setActiveView } = useProjectMeta();
  const { bom, addBomItem } = useBom();
  const { components: communityComponents } = useCommunityLibrary();
  const { data: standardParts } = useComponentParts(projectId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for focus requests
  useEffect(() => {
    const handleFocus = () => setOpen(true);
    window.addEventListener('protopulse:focus-component-search', handleFocus);
    return () => window.removeEventListener('protopulse:focus-component-search', handleFocus);
  }, []);

  const allItems = useMemo(() => {
    const items: SearchResult[] = [];

    // 1. Standard Library
    if (standardParts) {
      for (const part of standardParts) {
        items.push({
          id: `std-${part.id}`,
          label: (part.meta as any)?.title || `Part ${part.id}`,
          description: (part.meta as any)?.description || `Standard Library Component`,
          category: 'Standard Library',
          icon: Cpu,
          partId: part.id,
        });
      }
    }

    // 2. Community Library
    for (const comp of communityComponents) {
      items.push({
        id: `comm-${comp.id}`,
        label: comp.name,
        description: comp.description,
        category: 'Community Library',
        icon: Globe,
        communityPart: comp,
      });
    }

    // 3. BOM Items
    for (const item of bom) {
      items.push({
        id: `bom-${item.id}`,
        label: item.partNumber || item.description,
        description: `${item.manufacturer} - ${item.description}`,
        category: 'BOM Items',
        icon: Package,
        bomItem: item,
      });
    }

    return items;
  }, [standardParts, communityComponents, bom]);

  const fuse = useMemo(() => new Fuse(allItems, FUSE_OPTIONS), [allItems]);

  const groupedResults = useMemo(() => {
    if (!query.trim()) {
      return {
        'Standard Library': allItems.filter(i => i.category === 'Standard Library').slice(0, 5),
        'Community Library': allItems.filter(i => i.category === 'Community Library').slice(0, 5),
        'BOM Items': allItems.filter(i => i.category === 'BOM Items').slice(0, 5),
      };
    }
    const results = fuse.search(query).map(r => r.item);
    return {
      'Standard Library': results.filter(i => i.category === 'Standard Library').slice(0, 10),
      'Community Library': results.filter(i => i.category === 'Community Library').slice(0, 10),
      'BOM Items': results.filter(i => i.category === 'BOM Items').slice(0, 10),
    };
  }, [query, fuse, allItems]);

  const handleAction = useCallback((result: SearchResult, actionType: 'place' | 'bom') => {
    if (actionType === 'place') {
      setActiveView('schematic');
      if (result.partId) {
        window.dispatchEvent(new CustomEvent('protopulse:place-component-instance', { detail: { partId: result.partId } }));
      } else if (result.communityPart) {
        // Just adding to BOM for now since community parts lack direct partId locally.
        const mapped = mapCommunityPartToBom(result.communityPart);
        addBomItem(mapped);
      } else if (result.bomItem) {
         // Place existing BOM item by inferring its related standard part if possible, 
         // but for now we just dispatch a generic placement request (might need actual mapping).
         window.dispatchEvent(new CustomEvent('protopulse:place-component-instance', { detail: { refDesPrefix: result.bomItem.partNumber || 'U' } }));
      }
    } else if (actionType === 'bom') {
      if (result.communityPart) {
        const mapped = mapCommunityPartToBom(result.communityPart);
        addBomItem(mapped);
        setActiveView('procurement');
      } else if (result.partId) {
        addBomItem({
          partNumber: result.label,
          manufacturer: 'Generic',
          description: result.description,
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          stock: 0,
          supplier: 'Unknown',
          status: 'In Stock',
        });
        setActiveView('procurement');
      }
    }
    setOpen(false);
    setQuery('');
  }, [setActiveView, addBomItem]);

  const totalResults = Object.values(groupedResults).reduce((sum, arr) => sum + arr.length, 0);

  if (!open) return null;

  return (
    <div
      data-testid="unified-component-search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { setOpen(false); setQuery(''); }}
        aria-hidden="true"
      />
      <Command
        label="Find component"
        loop
        shouldFilter={false}
        className="relative w-full max-w-2xl rounded-lg border border-border bg-background shadow-2xl shadow-primary/5 overflow-hidden flex flex-col"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            setQuery('');
          }
        }}
      >
        <div className="flex items-center border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
          <Command.Input
            data-testid="component-search-input"
            placeholder="Search components across standard library, community, and BOM..."
            autoFocus
            value={query}
            onValueChange={setQuery}
            className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 ml-2">
            Ctrl+K
          </kbd>
        </div>

        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          {totalResults === 0 && (
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No components found.
            </Command.Empty>
          )}

          {(Object.entries(groupedResults) as Array<[SearchResult['category'], SearchResult[]]>).map(([category, items]) => {
            if (items.length === 0) { return null; }

            const CategoryIcon = items[0].icon;
            return (
              <Command.Group
                key={category}
                heading={category}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => { handleAction(item, getDefaultActionType(item)); }}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer',
                      'text-foreground/80',
                      'aria-selected:bg-primary/10 aria-selected:text-primary',
                      'hover:bg-muted/50',
                    )}
                  >
                    <CategoryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{item.label}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 pr-2 transition-opacity">
                      {(item.category === 'Standard Library' || item.category === 'BOM Items') && (
                        <button
                          type="button"
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-muted hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                          aria-label={`Place ${item.label} on schematic`}
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => { e.stopPropagation(); handleAction(item, 'place'); }}
                        >
                          <ArrowRightToLine className="w-3 h-3" />
                          Place
                        </button>
                      )}
                      {(item.category === 'Standard Library' || item.category === 'Community Library') && (
                        <button
                          type="button"
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-muted hover:bg-green-500/20 hover:text-green-400 transition-colors cursor-pointer"
                          aria-label={`Add ${item.label} to BOM`}
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => { e.stopPropagation(); handleAction(item, 'bom'); }}
                        >
                          <Plus className="w-3 h-3" />
                          Add to BOM
                        </button>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })}
        </Command.List>

        <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-muted border border-border rounded px-1 py-px">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-muted border border-border rounded px-1 py-px">esc</kbd>
              close
            </span>
          </div>
          <span>{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
        </div>
      </Command>
    </div>
  );
}
