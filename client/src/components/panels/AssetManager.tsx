import { useState, useRef, useEffect, useCallback } from 'react';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useOutput } from '@/lib/contexts/output-context';
import AssetSearch from './asset-manager/AssetSearch';
import AssetGrid from './asset-manager/AssetGrid';
import { STORAGE_KEYS } from '@/lib/constants';
import { type Asset, categories, builtInAssets } from './asset-manager/asset-constants';
import { usePanelResize } from './asset-manager/hooks/usePanelResize';
import { useDragGhost } from './asset-manager/hooks/useDragGhost';
import { useAssetKeyboardShortcuts } from './asset-manager/hooks/useAssetKeyboardShortcuts';

interface AssetManagerProps {
  onDragStart: (event: React.DragEvent, nodeType: string, label: string) => void;
  onClose?: () => void;
  onAddNode?: (type: string, label: string) => void;
}

export default function AssetManager({ onDragStart, onClose, onAddNode }: AssetManagerProps) {
  const { nodes } = useArchitecture();
  const { addOutputLog } = useOutput();

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'recent'>('name');
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.ASSET_FAVORITES) || '[]'); } catch { return []; }
  });
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.ASSET_RECENT) || '[]'); } catch { return []; }
  });
  const [customAssets, setCustomAssets] = useState<Asset[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.ASSET_CUSTOM) || '[]'); } catch { return []; }
  });

  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);

  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('mcu');
  const [customDesc, setCustomDesc] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { panelWidth, startResize } = usePanelResize();
  const { handleDragStart: ghostDragStart, handleDragEnd } = useDragGhost();

  const allAssets: Asset[] = [...builtInAssets, ...customAssets];

  // Persist to localStorage
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.ASSET_FAVORITES, JSON.stringify(favorites)); } catch {} }, [favorites]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.ASSET_RECENT, JSON.stringify(recentlyUsed)); } catch {} }, [recentlyUsed]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.ASSET_CUSTOM, JSON.stringify(customAssets)); } catch {} }, [customAssets]);

  const addToRecent = useCallback((assetId: string) => {
    setRecentlyUsed(prev => {
      const next = [assetId, ...prev.filter(id => id !== assetId)].slice(0, 5);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((assetId: string) => {
    setFavorites(prev => prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]);
  }, []);

  const getDesignCount = useCallback((assetName: string) => {
    return nodes.filter(n => n.data?.label?.toString().toLowerCase().includes(assetName.toLowerCase())).length;
  }, [nodes]);

  const filteredAssets = allAssets
    .filter(asset =>
      (activeCategory === 'all' || asset.type === activeCategory) &&
      (asset.name.toLowerCase().includes(search.toLowerCase()) || asset.desc.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'category') return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      if (sortBy === 'recent') {
        const ai = recentlyUsed.indexOf(a.id);
        const bi = recentlyUsed.indexOf(b.id);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  const getCategoryCount = (catId: string) => {
    const total = allAssets.filter(a => catId === 'all' || a.type === catId).length;
    if (!search) return { filtered: total, total };
    const filtered = allAssets.filter(a =>
      (catId === 'all' || a.type === catId) &&
      (a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()))
    ).length;
    return { filtered, total };
  };

  const handleAddNode = useCallback((type: string, label: string, assetId: string) => {
    onAddNode?.(type, label);
    addToRecent(assetId);
  }, [onAddNode, addToRecent]);

  const handleDragStart = useCallback((event: React.DragEvent, asset: Asset) => {
    ghostDragStart(event, asset.name, () => {
      onDragStart(event, asset.type, asset.name);
      addToRecent(asset.id);
    });
  }, [ghostDragStart, onDragStart, addToRecent]);

  const handleBatchAdd = useCallback(() => {
    selectedAssets.forEach(id => {
      const asset = allAssets.find(a => a.id === id);
      if (asset) {
        onAddNode?.(asset.type, asset.name);
        addToRecent(asset.id);
      }
    });
    setSelectedAssets(new Set());
  }, [selectedAssets, allAssets, onAddNode, addToRecent]);

  const handleCustomSubmit = useCallback(() => {
    if (!customName.trim()) return;
    const newAsset: Asset = {
      id: `custom-${Date.now()}`,
      type: customType,
      name: customName.trim(),
      desc: customDesc.trim() || 'Custom part',
      specs: [],
      custom: true,
    };
    setCustomAssets(prev => [...prev, newAsset]);
    setCustomName('');
    setCustomType('mcu');
    setCustomDesc('');
    setShowCustomForm(false);
  }, [customName, customType, customDesc]);

  const getFilteredAsset = useCallback((index: number) => {
    return filteredAssets[index];
  }, [filteredAssets]);

  useAssetKeyboardShortcuts({
    searchRef,
    search,
    setSearch,
    showCustomForm,
    setShowCustomForm,
    expandedAsset,
    setExpandedAsset,
    focusedIndex,
    setFocusedIndex,
    filteredAssetsLength: filteredAssets.length,
    handleAddNode,
    getFilteredAsset,
    activeCategory,
  });

  const cycleSortBy = useCallback(() => {
    setSortBy(prev => prev === 'name' ? 'category' : prev === 'category' ? 'recent' : 'name');
  }, []);

  const sortLabel = sortBy === 'name' ? 'A-Z' : sortBy === 'category' ? 'Cat' : 'Recent';

  const showLabels = panelWidth >= 280;

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 top-0 bottom-0 z-30 md:absolute md:top-4 md:left-4 md:bottom-auto md:right-auto md:inset-x-auto bg-card/50 backdrop-blur-xl border border-border shadow-xl flex flex-col max-h-full md:max-h-[calc(100%-2rem)] animate-in fade-in slide-in-from-left-2 duration-300"
      style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${panelWidth}px` : undefined }}
      tabIndex={0}
    >
      <AssetSearch
        ref={searchRef}
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        cycleSortBy={cycleSortBy}
        sortLabel={sortLabel}
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        getCategoryCount={getCategoryCount}
        showLabels={showLabels}
        onClose={onClose}
      />
      <AssetGrid
        filteredAssets={filteredAssets}
        allAssets={allAssets}
        favorites={favorites}
        recentlyUsed={recentlyUsed}
        expandedAsset={expandedAsset}
        setExpandedAsset={setExpandedAsset}
        selectedAssets={selectedAssets}
        setSelectedAssets={setSelectedAssets}
        focusedIndex={focusedIndex}
        toggleFavorite={toggleFavorite}
        getDesignCount={getDesignCount}
        handleAddNode={handleAddNode}
        handleDragStart={handleDragStart}
        handleDragEnd={handleDragEnd}
        addOutputLog={addOutputLog}
        search={search}
        setSearch={setSearch}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        showCustomForm={showCustomForm}
        setShowCustomForm={setShowCustomForm}
        customName={customName}
        setCustomName={setCustomName}
        customType={customType}
        setCustomType={setCustomType}
        customDesc={customDesc}
        setCustomDesc={setCustomDesc}
        handleCustomSubmit={handleCustomSubmit}
        categories={categories}
        favoritesOpen={favoritesOpen}
        setFavoritesOpen={setFavoritesOpen}
        recentOpen={recentOpen}
        setRecentOpen={setRecentOpen}
        handleBatchAdd={handleBatchAdd}
      />
      <div
        data-testid="asset-resize-handle"
        className="hidden md:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 transition-colors group"
        onMouseDown={startResize}
      >
        <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1 h-8 bg-border group-hover:bg-primary/50 transition-colors" />
      </div>
    </div>
  );
}
