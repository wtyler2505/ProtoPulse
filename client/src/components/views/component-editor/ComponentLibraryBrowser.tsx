import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Package, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useLibraryEntries, useForkLibraryEntry } from '@/lib/component-editor/hooks';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = ['All', 'IC', 'Passive', 'Connector', 'Sensor', 'Module', 'Other'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  IC: 'bg-blue-500/20 text-blue-400',
  Passive: 'bg-green-500/20 text-green-400',
  Connector: 'bg-orange-500/20 text-orange-400',
  Sensor: 'bg-purple-500/20 text-purple-400',
  Module: 'bg-cyan-500/20 text-cyan-400',
  Other: 'bg-gray-500/20 text-gray-400',
};

interface ComponentLibraryBrowserProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  onForked: (partId: number) => void;
}

export default function ComponentLibraryBrowser({ open, onClose, projectId, onForked }: ComponentLibraryBrowserProps) {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useLibraryEntries({
    search: debouncedSearch || undefined,
    category: category === 'All' ? undefined : category,
    page,
  });

  const forkMutation = useForkLibraryEntry();

  const handleFork = async (libraryId: number) => {
    try {
      const result = await forkMutation.mutateAsync({ libraryId, projectId });
      toast({ title: 'Forked', description: 'Component added to your project.' });
      onForked(result.id);
      onClose();
    } catch {
      toast({ title: 'Fork failed', description: 'Could not fork component.', variant: 'destructive' });
    }
  };

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-background border-border" data-testid="dialog-library-browser">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-editor-accent" />
            Component Library
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-library-search"
            placeholder="Search components…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 bg-card border-border"
          />
          {searchInput && (
            <button
              data-testid="button-clear-search"
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              data-testid={`filter-category-${cat.toLowerCase()}`}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                category === cat
                  ? 'bg-editor-accent/20 text-editor-accent border border-editor-accent/50'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent'
              }`}
              onClick={() => { setCategory(cat); setPage(1); }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12" data-testid="loading-library">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2" data-testid="empty-library">
              <Package className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">No components found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {entries.map((entry) => {
                const connectors = Array.isArray(entry.connectors) ? entry.connectors : [];
                return (
                  <div
                    key={entry.id}
                    data-testid={`card-library-${entry.id}`}
                    className="bg-card border border-border hover:border-editor-accent/50 transition rounded-lg p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-sm font-medium truncate flex-1" data-testid={`text-title-${entry.id}`}>{entry.title}</h4>
                      {entry.category && (
                        <span
                          data-testid={`badge-category-${entry.id}`}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Other}`}
                        >
                          {entry.category}
                        </span>
                      )}
                    </div>

                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                        {entry.tags.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">+{entry.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span data-testid={`text-pins-${entry.id}`}>{connectors.length} pins</span>
                      <span className="flex items-center gap-0.5" data-testid={`text-downloads-${entry.id}`}>
                        <Download className="w-3 h-3" />
                        {entry.downloadCount}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-fork-${entry.id}`}
                      className="h-7 text-xs mt-auto text-editor-accent hover:bg-editor-accent/10"
                      disabled={forkMutation.isPending}
                      onClick={() => handleFork(entry.id)}
                    >
                      {forkMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Fork into project
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-prev-page"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-7 gap-1 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground" data-testid="text-page-indicator">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-next-page"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-7 gap-1 text-xs"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
