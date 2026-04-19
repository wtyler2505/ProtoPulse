import { memo, useCallback, useRef } from 'react';
import {
  Plus, Star, Check, ExternalLink, Package, ChevronDown, ChevronRight,
  Copy, GripVertical, Clock,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import { isSafeUrl } from '@shared/url-validation';
import { VaultHoverCard } from '@/components/ui/vault-hover-card';
import type { Asset } from './asset-constants';

interface AssetGridProps {
  filteredAssets: Asset[];
  allAssets: Asset[];
  favorites: string[];
  recentlyUsed: string[];
  expandedAsset: string | null;
  setExpandedAsset: (id: string | null) => void;
  selectedAssets: Set<string>;
  setSelectedAssets: React.Dispatch<React.SetStateAction<Set<string>>>;
  focusedIndex: number;
  toggleFavorite: (id: string) => void;
  getDesignCount: (name: string) => number;
  handleAddNode: (type: string, label: string, assetId: string) => void;
  handleDragStart: (event: React.DragEvent, asset: Asset) => void;
  handleDragEnd: () => void;
  addOutputLog: (msg: string) => void;
  search: string;
  setSearch: (v: string) => void;
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  showCustomForm: boolean;
  setShowCustomForm: (v: boolean) => void;
  customName: string;
  setCustomName: (v: string) => void;
  customType: string;
  setCustomType: (v: string) => void;
  customDesc: string;
  setCustomDesc: (v: string) => void;
  handleCustomSubmit: () => void;
  categories: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  favoritesOpen: boolean;
  setFavoritesOpen: (v: boolean) => void;
  recentOpen: boolean;
  setRecentOpen: (v: boolean) => void;
  handleBatchAdd: () => void;
}

const AssetGrid = memo(function AssetGrid({
  filteredAssets,
  allAssets,
  favorites,
  recentlyUsed,
  expandedAsset,
  setExpandedAsset,
  selectedAssets,
  setSelectedAssets,
  focusedIndex,
  toggleFavorite,
  getDesignCount,
  handleAddNode,
  handleDragStart,
  handleDragEnd,
  addOutputLog,
  search,
  setSearch,
  activeCategory,
  setActiveCategory,
  showCustomForm,
  setShowCustomForm,
  customName,
  setCustomName,
  customType,
  setCustomType,
  customDesc,
  setCustomDesc,
  handleCustomSubmit,
  categories,
  favoritesOpen,
  setFavoritesOpen,
  recentOpen,
  setRecentOpen,
  handleBatchAdd,
}: AssetGridProps) {
  const lastClickIndex = useRef<number>(-1);

  const handleAssetClick = useCallback((e: React.MouseEvent, asset: Asset, index: number) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedAssets(prev => {
        const next = new Set(prev);
        if (next.has(asset.id)) next.delete(asset.id); else next.add(asset.id);
        return next;
      });
      lastClickIndex.current = index;
      return;
    }
    if (e.shiftKey && lastClickIndex.current >= 0) {
      const start = Math.min(lastClickIndex.current, index);
      const end = Math.max(lastClickIndex.current, index);
      setSelectedAssets(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (filteredAssets[i]) next.add(filteredAssets[i].id);
        }
        return next;
      });
      return;
    }
    setExpandedAsset(expandedAsset === asset.id ? null : asset.id);
    lastClickIndex.current = index;
  }, [filteredAssets, expandedAsset, setExpandedAsset, setSelectedAssets]);

  const favoriteAssets = allAssets.filter(a => favorites.includes(a.id));
  const recentAssets = recentlyUsed.map(id => allAssets.find(a => a.id === id)).filter(Boolean) as Asset[];

  const renderAssetCard = (asset: Asset, index: number) => {
    const designCount = getDesignCount(asset.name);
    const isFav = favorites.includes(asset.id);
    const isExpanded = expandedAsset === asset.id;
    const isSelected = selectedAssets.has(asset.id);
    const isFocused = focusedIndex === index;

    return (
      <ContextMenu key={asset.id}>
        <ContextMenuTrigger asChild>
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, asset)}
            onDragEnd={handleDragEnd}
            onDoubleClick={() => handleAddNode(asset.type, asset.name, asset.id)}
            onClick={(e) => handleAssetClick(e, asset, index)}
            className={cn(
              "p-2 border cursor-grab active:cursor-grabbing group transition-all focus-ring",
              isExpanded ? "bg-muted/30 border-primary/30" : "bg-muted/20 border-transparent hover:border-primary/50 hover:bg-muted/40",
              isSelected && "border-primary bg-primary/10",
              isFocused && "ring-1 ring-primary/50"
            )}
            data-testid={`asset-item-${asset.id}`}
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <VaultHoverCard topic={asset.name}>
                  <span
                    className="font-medium text-xs text-foreground group-hover:text-primary transition-colors truncate cursor-help"
                    data-testid={`asset-name-${asset.id}`}
                  >
                    {asset.name}
                  </span>
                </VaultHoverCard>
                {asset.custom && (
                  <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 py-0.5 shrink-0">Custom</span>
                )}
                {designCount > 0 && (
                  <span className="text-[9px] bg-green-500/20 text-green-400 px-1 py-0.5 flex items-center gap-0.5 shrink-0">
                    <Check className="w-2.5 h-2.5" />
                    ×{designCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id); }}
                  className={cn("p-0.5 transition-all", isFav ? "text-yellow-400" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400")}
                  aria-label="Toggle favorite"
                >
                  <Star className={cn("w-3 h-3", isFav && "fill-yellow-400")} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddNode(asset.type, asset.name, asset.id); }}
                  className="opacity-60 hover:opacity-100 transition-opacity hover:text-primary"
                  data-testid={`button-add-asset-${asset.id}`}
                  aria-label="Add to canvas"
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                </button>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{asset.desc}</div>

            {isExpanded && (
              <div className="mt-2 pt-2 border-t border-border/50 space-y-2" data-testid={`asset-detail-${asset.id}`}>
                {asset.specs.length > 0 && (
                  <div className="grid grid-cols-2 gap-1">
                    {asset.specs.map((spec, i) => (
                      <div key={i} className="text-[10px]">
                        <span className="text-muted-foreground">{spec.label}: </span>
                        <span className="text-foreground">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {asset.package && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Package: </span>
                    <span className="text-foreground">{asset.package}</span>
                  </div>
                )}
                {asset.voltage && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Voltage: </span>
                    <span className="text-foreground">{asset.voltage}</span>
                  </div>
                )}
                <div className="flex gap-1 flex-wrap">
                  {asset.datasheet && isSafeUrl(asset.datasheet) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(asset.datasheet, '_blank', 'noopener,noreferrer'); }}
                      aria-label={`Open datasheet for ${asset.name}`}
                      className="text-[9px] px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Datasheet
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAddNode(asset.type, asset.name, asset.id); }}
                    aria-label={`Add ${asset.name} to canvas`}
                    className="text-[9px] px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5" /> Add to Canvas
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); addOutputLog(`[BOM] Added ${asset.name} to BOM`); }}
                    aria-label={`Add ${asset.name} to BOM`}
                    className="text-[9px] px-2 py-1 bg-muted/50 text-muted-foreground hover:bg-muted/80 transition-colors flex items-center gap-1"
                  >
                    <Package className="w-2.5 h-2.5" /> Add to BOM
                  </button>
                </div>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[160px]">
          <ContextMenuItem onSelect={() => handleAddNode(asset.type, asset.name, asset.id)}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Add to Canvas
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => asset.datasheet && isSafeUrl(asset.datasheet) && window.open(asset.datasheet, '_blank', 'noopener,noreferrer')}
            disabled={!asset.datasheet}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2" /> Search Datasheet
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => copyToClipboard(asset.name)}>
            <Copy className="w-3.5 h-3.5 mr-2" /> Copy Part Number
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => addOutputLog(`[BOM] Added ${asset.name} to BOM`)}>
            <Package className="w-3.5 h-3.5 mr-2" /> Add to BOM
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => toggleFavorite(asset.id)}>
            <Star className="w-3.5 h-3.5 mr-2" /> {isFav ? 'Remove Favorite' : 'Add Favorite'}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {favoriteAssets.length > 0 && (
          <div data-testid="asset-favorites-section" className="mb-2">
            <button
              onClick={() => setFavoritesOpen(!favoritesOpen)}
              aria-label={favoritesOpen ? 'Collapse favorites' : 'Expand favorites'}
              className="flex items-center gap-1 text-[10px] text-yellow-400 font-medium mb-1 w-full hover:text-yellow-300 transition-colors"
            >
              {favoritesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Star className="w-3 h-3 fill-yellow-400" />
              Favorites ({favoriteAssets.length})
            </button>
            {favoritesOpen && (
              <div className="space-y-1">
                {favoriteAssets.map((asset, i) => renderAssetCard(asset, -1))}
              </div>
            )}
          </div>
        )}

        {recentAssets.length > 0 && (
          <div data-testid="asset-recent-section" className="mb-2">
            <button
              onClick={() => setRecentOpen(!recentOpen)}
              aria-label={recentOpen ? 'Collapse recently used' : 'Expand recently used'}
              className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium mb-1 w-full hover:text-foreground transition-colors"
            >
              {recentOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Clock className="w-3 h-3" />
              Recently Used ({recentAssets.length})
            </button>
            {recentOpen && (
              <div className="space-y-1">
                {recentAssets.map((asset, i) => renderAssetCard(asset, -1))}
              </div>
            )}
          </div>
        )}

        {(favoriteAssets.length > 0 || recentAssets.length > 0) && filteredAssets.length > 0 && (
          <div className="border-t border-border/30 my-2" />
        )}

        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Package className="w-10 h-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium">No parts found</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Try a different search or category</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setSearch(''); setActiveCategory('all'); }}
                aria-label="Clear filters"
                className="text-[10px] px-3 py-1.5 bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                Clear filters
              </button>
              <button
                onClick={() => setShowCustomForm(true)}
                aria-label="Add custom part"
                className="text-[10px] px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              >
                Add custom part
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAssets.map((asset, index) => renderAssetCard(asset, index))}
          </div>
        )}

        {showCustomForm && (
          <div className="mt-2 p-2 border border-primary/30 bg-muted/20 space-y-2">
            <p className="text-[10px] font-medium text-primary">Add Custom Part</p>
            <input
              className="w-full px-2 py-1.5 bg-muted/50 border border-border text-xs focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-cyan-400/50 transition-colors"
              placeholder="Part name *"
              aria-label="Custom part name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <select
              className="w-full px-2 py-1.5 bg-muted/50 border border-border text-xs focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-cyan-400/50 transition-colors"
              aria-label="Custom part category"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            >
              {categories.filter(c => c.id !== 'all').map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <textarea
              className="w-full px-2 py-1.5 bg-muted/50 border border-border text-xs focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-cyan-400/50 transition-colors resize-none"
              placeholder="Description"
              aria-label="Custom part description"
              rows={2}
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
            />
            <div className="flex gap-1">
              <button
                onClick={handleCustomSubmit}
                disabled={!customName.trim()}
                aria-label="Submit custom part"
                className="flex-1 text-[10px] px-2 py-1.5 bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                Add Part
              </button>
              <button
                onClick={() => { setShowCustomForm(false); setCustomName(''); setCustomType('mcu'); setCustomDesc(''); }}
                aria-label="Cancel custom part form"
                className="flex-1 text-[10px] px-2 py-1.5 bg-muted/50 text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showCustomForm && (
          <button
            onClick={() => setShowCustomForm(true)}
            className="w-full mt-2 p-2 border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary text-[10px] flex items-center justify-center gap-1 transition-colors"
            data-testid="asset-add-custom"
            aria-label="Add custom part"
          >
            <Plus className="w-3 h-3" /> Add Custom Part
          </button>
        )}
      </div>
      {selectedAssets.size > 1 && (
        <div
          className="p-2 border-t border-border bg-primary/10 flex items-center justify-between"
          data-testid="asset-batch-bar"
        >
          <button
            onClick={handleBatchAdd}
            aria-label={`Add ${selectedAssets.size} selected assets to canvas`}
            className="text-[10px] px-3 py-1.5 bg-primary/30 text-primary hover:bg-primary/40 transition-colors font-medium"
          >
            Add {selectedAssets.size} to Canvas
          </button>
          <button
            onClick={() => setSelectedAssets(new Set())}
            aria-label="Clear selection"
            className="text-[10px] px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
});

export default AssetGrid;
