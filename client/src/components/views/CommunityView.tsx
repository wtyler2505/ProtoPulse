/**
 * CommunityView — Community component library browser.
 * Search, browse, rate, download, and manage collections of community components.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import {
  Globe,
  Search,
  Star,
  Download,
  ArrowLeft,
  Filter,
  Plus,
  FolderOpen,
  Package,
  TrendingUp,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useCommunityLibrary } from '@/lib/community-library';
import type {
  CommunityComponent,
  ComponentType,
  SortOption,
  SearchFilters,
  LibraryCollection,
} from '@/lib/community-library';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<ComponentType, { label: string; color: string }> = {
  'schematic-symbol': { label: 'Schematic', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  footprint: { label: 'Footprint', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'pcb-module': { label: 'PCB Module', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  snippet: { label: 'Snippet', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  '3d-model': { label: '3D Model', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'downloads', label: 'Most Downloads' },
  { value: 'name', label: 'Name (A-Z)' },
];

const COMPONENT_TYPES: ComponentType[] = ['schematic-symbol', 'footprint', 'pcb-module', 'snippet', '3d-model'];

// ---------------------------------------------------------------------------
// StarRating
// ---------------------------------------------------------------------------

const StarRating = memo(function StarRating({
  rating,
  count,
  interactive,
  onRate,
}: {
  rating: number;
  count: number;
  interactive?: boolean;
  onRate?: (n: number) => void;
}) {
  return (
    <div data-testid="star-rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          data-testid={`star-${n}`}
          className={cn(
            'w-3.5 h-3.5 transition-colors',
            n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
            interactive && 'cursor-pointer hover:text-amber-400',
          )}
          onClick={interactive && onRate ? () => { onRate(n); } : undefined}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">
        {rating.toFixed(1)} ({count})
      </span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// ComponentCard
// ---------------------------------------------------------------------------

interface ComponentCardProps {
  component: CommunityComponent;
  onClick: (c: CommunityComponent) => void;
}

const ComponentCard = memo(function ComponentCard({ component, onClick }: ComponentCardProps) {
  const typeInfo = TYPE_LABELS[component.type];

  return (
    <Card
      data-testid={`community-card-${component.id}`}
      className="bg-card/60 border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => { onClick(component); }}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div data-testid={`component-name-${component.id}`} className="text-sm font-semibold truncate">
              {component.name}
            </div>
            <div data-testid={`component-author-${component.id}`} className="text-xs text-muted-foreground">
              by {component.author.name}
            </div>
          </div>
          <Badge
            data-testid={`component-type-${component.id}`}
            variant="outline"
            className={cn('text-xs flex-shrink-0', typeInfo.color)}
          >
            {typeInfo.label}
          </Badge>
        </div>

        <StarRating rating={component.rating} count={component.ratingCount} />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span data-testid={`component-downloads-${component.id}`} className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            {component.downloads}
          </span>
          <span data-testid={`component-version-${component.id}`}>v{component.version}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">{component.license}</Badge>
        </div>

        {component.tags.length > 0 && (
          <div data-testid={`component-tags-${component.id}`} className="flex flex-wrap gap-1">
            {component.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                {tag}
              </Badge>
            ))}
            {component.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{component.tags.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// ComponentDetail
// ---------------------------------------------------------------------------

interface ComponentDetailProps {
  component: CommunityComponent;
  onBack: () => void;
  onDownload: (id: string) => void;
  onRate: (componentId: string, rating: number) => void;
}

const ComponentDetail = memo(function ComponentDetail({
  component,
  onBack,
  onDownload,
  onRate,
}: ComponentDetailProps) {
  const typeInfo = TYPE_LABELS[component.type];

  return (
    <div data-testid="component-detail" className="flex flex-col h-full">
      <Button
        data-testid="detail-back"
        variant="ghost"
        size="sm"
        className="self-start mb-4"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to library
      </Button>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 data-testid="detail-name" className="text-xl font-bold">{component.name}</h2>
              <p className="text-sm text-muted-foreground">
                by <span data-testid="detail-author">{component.author.name}</span>
              </p>
            </div>
            <Badge variant="outline" className={cn('text-sm', typeInfo.color)}>{typeInfo.label}</Badge>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <StarRating
              rating={component.rating}
              count={component.ratingCount}
              interactive
              onRate={(n) => { onRate(component.id, n); }}
            />
            <span data-testid="detail-downloads" className="flex items-center gap-1 text-sm text-muted-foreground">
              <Download className="w-4 h-4" />
              {component.downloads} downloads
            </span>
          </div>

          <Button
            data-testid="detail-download-btn"
            onClick={() => { onDownload(component.id); }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Component
          </Button>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-2">Description</h3>
            <p data-testid="detail-description" className="text-sm text-muted-foreground leading-relaxed">
              {component.description || 'No description provided.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Version:</span>{' '}
              <span data-testid="detail-version">{component.version}</span>
            </div>
            <div>
              <span className="text-muted-foreground">License:</span>{' '}
              <span data-testid="detail-license">{component.license}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Category:</span>{' '}
              <span data-testid="detail-category">{component.category}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span>{' '}
              <span data-testid="detail-size">{(component.size / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          {component.compatibility.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Compatibility</h3>
              <div data-testid="detail-compatibility" className="flex flex-wrap gap-1">
                {component.compatibility.map((c) => (
                  <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {component.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Tags</h3>
              <div data-testid="detail-tags" className="flex flex-wrap gap-1">
                {component.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CollectionsPanel
// ---------------------------------------------------------------------------

interface CollectionsPanelProps {
  collections: LibraryCollection[];
  onCreate: (name: string, description: string) => void;
}

const CollectionsPanel = memo(function CollectionsPanel({ collections, onCreate }: CollectionsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      return;
    }
    onCreate(name.trim(), desc.trim());
    setName('');
    setDesc('');
    setDialogOpen(false);
  }, [name, desc, onCreate]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">My Collections</h3>
        <Button
          data-testid="create-collection-btn"
          variant="outline"
          size="sm"
          className="h-7"
          onClick={() => { setDialogOpen(true); }}
        >
          <Plus className="w-3 h-3 mr-1" />
          New
        </Button>
      </div>

      {collections.length === 0 && (
        <div data-testid="collections-empty" className="text-sm text-muted-foreground text-center py-4">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          No collections yet. Create one to organize your favorite components.
        </div>
      )}

      {collections.map((col) => (
        <Card key={col.id} data-testid={`collection-${col.id}`} className="bg-card/60">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{col.name}</div>
                <div className="text-xs text-muted-foreground">{col.componentIds.length} components</div>
              </div>
              <Badge variant="outline" className="text-xs">
                {col.isPublic ? 'Public' : 'Private'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="create-collection-dialog" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="col-name">Name</Label>
              <Input
                data-testid="collection-name-input"
                id="col-name"
                value={name}
                onChange={(e) => { setName(e.target.value); }}
                placeholder="My Components"
              />
            </div>
            <div>
              <Label htmlFor="col-desc">Description</Label>
              <Input
                data-testid="collection-desc-input"
                id="col-desc"
                value={desc}
                onChange={(e) => { setDesc(e.target.value); }}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); }}>Cancel</Button>
            <Button data-testid="collection-create-submit" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CommunityView
// ---------------------------------------------------------------------------

export default function CommunityView() {
  const {
    components,
    search,
    rateComponent,
    downloadComponent,
    collections,
    createCollection,
    featured,
    trending,
    newArrivals,
    stats,
  } = useCommunityLibrary();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ComponentType | '__all__'>('__all__');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [selectedComponent, setSelectedComponent] = useState<CommunityComponent | null>(null);
  const [activeTab, setActiveTab] = useState('browse');

  const searchResults = useMemo(() => {
    const filters: SearchFilters = {
      sort: sortBy,
    };
    if (query.trim()) {
      filters.query = query.trim();
    }
    if (typeFilter !== '__all__') {
      filters.type = typeFilter;
    }
    return search(filters);
  }, [query, typeFilter, sortBy, search]);

  const handleDownload = useCallback((id: string) => {
    downloadComponent(id);
  }, [downloadComponent]);

  const handleRate = useCallback((componentId: string, rating: number) => {
    rateComponent(componentId, 'local-user', rating);
  }, [rateComponent]);

  const handleCreateCollection = useCallback((name: string, description: string) => {
    createCollection({ name, description });
  }, [createCollection]);

  // Detail view
  if (selectedComponent) {
    return (
      <div data-testid="community-view" className="flex flex-col h-full p-4">
        <ComponentDetail
          component={selectedComponent}
          onBack={() => { setSelectedComponent(null); }}
          onDownload={handleDownload}
          onRate={handleRate}
        />
      </div>
    );
  }

  return (
    <div data-testid="community-view" className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 data-testid="community-title" className="text-lg font-semibold">Community Library</h2>
          <Badge data-testid="community-count" variant="secondary">
            {stats.totalComponents} components
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span data-testid="community-downloads">{stats.totalDownloads} downloads</span>
          <span data-testid="community-authors">{stats.totalAuthors} authors</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList data-testid="community-tabs">
          <TabsTrigger data-testid="tab-browse" value="browse">
            <Search className="w-3 h-3 mr-1" />
            Browse
          </TabsTrigger>
          <TabsTrigger data-testid="tab-featured" value="featured">
            <Sparkles className="w-3 h-3 mr-1" />
            Featured
          </TabsTrigger>
          <TabsTrigger data-testid="tab-collections" value="collections">
            <FolderOpen className="w-3 h-3 mr-1" />
            Collections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="flex-1 flex flex-col gap-3 min-h-0 mt-3">
          {/* Search + filters */}
          <div data-testid="community-filters" className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="community-search"
                placeholder="Search components..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); }}
                className="pl-8 h-9"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(v) => { setTypeFilter(v as ComponentType | '__all__'); }}
            >
              <SelectTrigger data-testid="community-type-filter" className="w-36 h-9 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {COMPONENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortOption); }}>
              <SelectTrigger data-testid="community-sort" className="w-36 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          <ScrollArea className="flex-1">
            <div data-testid="community-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.components.map((comp) => (
                <ComponentCard key={comp.id} component={comp} onClick={setSelectedComponent} />
              ))}
            </div>
            {searchResults.components.length === 0 && (
              <div data-testid="community-empty" className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No components found matching your search.</p>
              </div>
            )}
            {searchResults.totalPages > 1 && (
              <div data-testid="community-page-info" className="text-center text-xs text-muted-foreground mt-4">
                Page {searchResults.page} of {searchResults.totalPages} ({searchResults.totalCount} results)
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="featured" className="flex-1 flex flex-col gap-4 min-h-0 mt-3">
          <ScrollArea className="flex-1">
            {/* Featured */}
            {featured.length > 0 && (
              <div className="space-y-2 mb-6">
                <h3 data-testid="featured-heading" className="text-sm font-semibold flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Featured
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {featured.map((comp) => (
                    <ComponentCard key={comp.id} component={comp} onClick={setSelectedComponent} />
                  ))}
                </div>
              </div>
            )}

            {/* Trending */}
            {trending.length > 0 && (
              <div className="space-y-2 mb-6">
                <h3 data-testid="trending-heading" className="text-sm font-semibold flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  Trending
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {trending.map((comp) => (
                    <ComponentCard key={comp.id} component={comp} onClick={setSelectedComponent} />
                  ))}
                </div>
              </div>
            )}

            {/* New Arrivals */}
            {newArrivals.length > 0 && (
              <div className="space-y-2">
                <h3 data-testid="new-arrivals-heading" className="text-sm font-semibold flex items-center gap-1">
                  <Clock className="w-4 h-4 text-blue-400" />
                  New Arrivals
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {newArrivals.map((comp) => (
                    <ComponentCard key={comp.id} component={comp} onClick={setSelectedComponent} />
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="collections" className="flex-1 min-h-0 mt-3">
          <ScrollArea className="h-full">
            <CollectionsPanel
              collections={collections}
              onCreate={handleCreateCollection}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
