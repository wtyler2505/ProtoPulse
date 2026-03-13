import { useCallback, useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import {
  LayoutGrid,
  CircuitBoard,
  Package,
  BookOpen,
  History,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useHistory } from '@/lib/contexts/history-context';
import { STANDARD_LIBRARY_COMPONENTS } from '@shared/standard-library';
import type { ViewMode } from '@/lib/project-context';
import type { Node } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  label: string;
  description: string;
  category: SearchCategory;
  view: ViewMode;
  icon: React.ComponentType<{ className?: string }>;
}

type SearchCategory =
  | 'Architecture Nodes'
  | 'BOM Items'
  | 'Standard Library'
  | 'Design History';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GlobalSearchDialogProps {
  onNavigate: (view: ViewMode) => void;
}

// ---------------------------------------------------------------------------
// Fuse.js options
// ---------------------------------------------------------------------------

const FUSE_OPTIONS: IFuseOptions<SearchResult> = {
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  shouldSort: true,
  minMatchCharLength: 2,
  keys: ['label', 'description'],
};

const MAX_RESULTS_PER_CATEGORY = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildArchitectureResults(nodes: Node[]): SearchResult[] {
  return nodes.map((node) => ({
    id: `arch-${node.id}`,
    label: String(node.data?.label ?? node.id),
    description: `${String(node.data?.type ?? 'node')} block`,
    category: 'Architecture Nodes' as const,
    view: 'architecture' as const,
    icon: LayoutGrid,
  }));
}

function buildBomResults(bom: Array<{
  id: string;
  partNumber: string;
  description: string;
  manufacturer: string;
}>): SearchResult[] {
  return bom.map((item) => ({
    id: `bom-${item.id}`,
    label: item.partNumber || item.description,
    description: `${item.manufacturer} - ${item.description}`,
    category: 'BOM Items' as const,
    view: 'procurement' as const,
    icon: Package,
  }));
}

function buildStandardLibraryResults(): SearchResult[] {
  return STANDARD_LIBRARY_COMPONENTS.map((comp, idx) => ({
    id: `stdlib-${idx}`,
    label: comp.title,
    description: `${comp.category} - ${comp.description.slice(0, 80)}`,
    category: 'Standard Library' as const,
    view: 'schematic' as const,
    icon: CircuitBoard,
  }));
}

function buildHistoryResults(history: Array<{
  id: string;
  action: string;
  user: string;
  timestamp: string;
}>): SearchResult[] {
  return history.slice(0, 50).map((item) => ({
    id: `history-${item.id}`,
    label: item.action,
    description: `${item.user} - ${item.timestamp}`,
    category: 'Design History' as const,
    view: 'design_history' as const,
    icon: History,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GlobalSearchDialog({ onNavigate }: GlobalSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { nodes } = useArchitecture();
  const { bom } = useBom();
  const { history } = useHistory();

  // Keyboard shortcut: Ctrl+Shift+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Build all searchable items
  const allItems = useMemo(() => [
    ...buildArchitectureResults(nodes),
    ...buildBomResults(bom),
    ...buildStandardLibraryResults(),
    ...buildHistoryResults(history),
  ], [nodes, bom, history]);

  // Fuse instance
  const fuse = useMemo(() => new Fuse(allItems, FUSE_OPTIONS), [allItems]);

  // Search results grouped by category
  const groupedResults = useMemo(() => {
    if (!query.trim()) {
      // Show a sample from each category when no query
      const groups: Record<SearchCategory, SearchResult[]> = {
        'Architecture Nodes': [],
        'BOM Items': [],
        'Standard Library': [],
        'Design History': [],
      };
      for (const item of allItems) {
        if (groups[item.category].length < MAX_RESULTS_PER_CATEGORY) {
          groups[item.category].push(item);
        }
      }
      return groups;
    }

    const results = fuse.search(query);
    const groups: Record<SearchCategory, SearchResult[]> = {
      'Architecture Nodes': [],
      'BOM Items': [],
      'Standard Library': [],
      'Design History': [],
    };

    for (const result of results) {
      const cat = result.item.category;
      if (groups[cat].length < MAX_RESULTS_PER_CATEGORY) {
        groups[cat].push(result.item);
      }
    }
    return groups;
  }, [query, fuse, allItems]);

  const handleSelect = useCallback((result: SearchResult) => {
    onNavigate(result.view);
    setOpen(false);
    setQuery('');
  }, [onNavigate]);

  const totalResults = Object.values(groupedResults).reduce((sum, arr) => sum + arr.length, 0);

  if (!open) {
    return null;
  }

  return (
    <div
      data-testid="global-search-dialog"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { setOpen(false); setQuery(''); }}
        aria-hidden="true"
      />

      <Command
        label="Global search"
        loop
        shouldFilter={false}
        className="relative w-full max-w-xl rounded-lg border border-border bg-background shadow-2xl shadow-primary/5 overflow-hidden"
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
            data-testid="global-search-input"
            placeholder="Search architecture, BOM, components, history..."
            autoFocus
            value={query}
            onValueChange={setQuery}
            className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 ml-2">
            Ctrl+Shift+F
          </kbd>
        </div>

        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          {totalResults === 0 && (
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
          )}

          {(Object.entries(groupedResults) as Array<[SearchCategory, SearchResult[]]>).map(([category, items]) => {
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
                    data-testid={`global-search-result-${item.id}`}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer',
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
              <kbd className="font-mono bg-muted border border-border rounded px-1 py-px">↵</kbd>
              select
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
