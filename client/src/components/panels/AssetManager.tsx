import { useState, useRef, useEffect, useCallback } from 'react';
import { useProject } from '@/lib/project-context';
import {
  Search, Plus, Cpu, Battery, Radio, Activity, Zap, Component, X,
  Star, Check, ExternalLink, ArrowUpDown, Package, ChevronDown, ChevronRight,
  Copy, GripVertical, Keyboard, Clock
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

interface Asset {
  id: string;
  type: string;
  name: string;
  desc: string;
  specs: { label: string; value: string }[];
  package?: string;
  voltage?: string;
  datasheet?: string;
  custom?: boolean;
}

const categories = [
  { id: 'all', label: 'All', icon: Component },
  { id: 'mcu', label: 'Microcontrollers', icon: Cpu },
  { id: 'power', label: 'Power', icon: Battery },
  { id: 'comm', label: 'Communication', icon: Radio },
  { id: 'sensor', label: 'Sensors', icon: Activity },
  { id: 'connector', label: 'Connectors', icon: Zap },
];

const builtInAssets: Asset[] = [
  { id: '1', type: 'mcu', name: 'ESP32-S3-WROOM-1', desc: 'Dual-core, Wi-Fi/BLE, AI instructions', specs: [{ label: 'Core', value: 'Xtensa LX7 Dual' }, { label: 'Flash', value: '8MB' }, { label: 'RAM', value: '512KB' }, { label: 'GPIO', value: '36' }], package: 'Module', voltage: '3.0-3.6V', datasheet: 'https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf' },
  { id: '2', type: 'mcu', name: 'STM32L432KC', desc: 'Ultra-low-power, ARM Cortex-M4', specs: [{ label: 'Core', value: 'Cortex-M4 80MHz' }, { label: 'Flash', value: '256KB' }, { label: 'RAM', value: '64KB' }, { label: 'GPIO', value: '26' }], package: 'UFQFPN32', voltage: '1.71-3.6V', datasheet: 'https://www.st.com/resource/en/datasheet/stm32l432kc.pdf' },
  { id: '3', type: 'power', name: 'TP4056', desc: '1A Li-Ion Battery Charger', specs: [{ label: 'Current', value: '1A max' }, { label: 'Input', value: '4.5-5.5V' }, { label: 'Accuracy', value: '±1.5%' }], package: 'SOP-8', voltage: '4.5-5.5V', datasheet: 'https://dlnmh9ip6v2uc.cloudfront.net/datasheets/Prototyping/TP4056.pdf' },
  { id: '4', type: 'power', name: 'LDO 3.3V', desc: 'Low-dropout regulator, 500mA', specs: [{ label: 'Output', value: '3.3V' }, { label: 'Current', value: '500mA' }, { label: 'Dropout', value: '250mV' }], package: 'SOT-223', voltage: '3.5-6V' },
  { id: '5', type: 'comm', name: 'SX1262 LoRa', desc: 'Long-range low-power transceiver', specs: [{ label: 'Freq', value: '150-960MHz' }, { label: 'Power', value: '+22dBm' }, { label: 'Range', value: '15km+' }, { label: 'Interface', value: 'SPI' }], package: 'QFN24', voltage: '1.8-3.7V', datasheet: 'https://semtech.my.salesforce.com/sfc/p/E0000000JelG/a/2R000000HT76/WIeRBkuMEaVPUvKqyfq_cjYvYqfMjiAFQlFSp3To3Oc' },
  { id: '6', type: 'comm', name: 'SIM7000G', desc: 'NB-IoT / LTE-M Module', specs: [{ label: 'Bands', value: 'Multi-band' }, { label: 'GNSS', value: 'GPS/GLONASS' }, { label: 'Interface', value: 'UART' }], package: 'LCC+LGA', voltage: '3.0-4.3V' },
  { id: '7', type: 'sensor', name: 'SHT40', desc: 'High-accuracy humidity/temp', specs: [{ label: 'Accuracy', value: '±1.8% RH' }, { label: 'Range', value: '-40 to 125°C' }, { label: 'Interface', value: 'I2C' }], package: 'DFN 1.5x1.5', voltage: '1.08-3.6V' },
  { id: '8', type: 'sensor', name: 'L86 GNSS', desc: 'GPS/GLONASS patch antenna module', specs: [{ label: 'Systems', value: 'GPS+GLONASS' }, { label: 'Accuracy', value: '2.5m CEP' }, { label: 'Interface', value: 'UART' }], package: 'Module 18.4x18.4', voltage: '3.0-4.3V' },
  { id: '9', type: 'connector', name: 'USB-C Receptacle', desc: 'USB Type-C power/data connector', specs: [{ label: 'Current', value: '5A max' }, { label: 'Pins', value: '16/24' }], package: 'SMD Mid-mount' },
  { id: '10', type: 'connector', name: 'JST-PH 2mm', desc: '2-pin battery connector', specs: [{ label: 'Pitch', value: '2mm' }, { label: 'Current', value: '2A' }], package: 'THT' },
  { id: '11', type: 'sensor', name: 'BME280', desc: 'Pressure/humidity/temp sensor', specs: [{ label: 'Pressure', value: '300-1100hPa' }, { label: 'Accuracy', value: '±1hPa' }, { label: 'Interface', value: 'I2C/SPI' }], package: 'LGA 2.5x2.5', voltage: '1.71-3.6V' },
  { id: '12', type: 'power', name: 'TPS63020', desc: 'Buck-boost converter', specs: [{ label: 'Input', value: '1.8-5.5V' }, { label: 'Output', value: '1.2-5.5V' }, { label: 'Current', value: '3A' }], package: 'QFN14', voltage: '1.8-5.5V' },
];

const categoryIconMap: Record<string, typeof Cpu> = {
  mcu: Cpu,
  power: Battery,
  comm: Radio,
  sensor: Activity,
  connector: Zap,
};

interface AssetManagerProps {
  onDragStart: (event: React.DragEvent, nodeType: string, label: string) => void;
  onClose?: () => void;
  onAddNode?: (type: string, label: string) => void;
}

export default function AssetManager({ onDragStart, onClose, onAddNode }: AssetManagerProps) {
  const { nodes, addOutputLog } = useProject();

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'recent'>('name');
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(256);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('asset-favorites') || '[]'); } catch { return []; }
  });
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('asset-recent') || '[]'); } catch { return []; }
  });
  const [customAssets, setCustomAssets] = useState<Asset[]>(() => {
    try { return JSON.parse(localStorage.getItem('asset-custom') || '[]'); } catch { return []; }
  });

  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);

  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('mcu');
  const [customDesc, setCustomDesc] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);
  const lastClickIndex = useRef<number>(-1);

  const allAssets: Asset[] = [...builtInAssets, ...customAssets];

  useEffect(() => { localStorage.setItem('asset-favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('asset-recent', JSON.stringify(recentlyUsed)); }, [recentlyUsed]);
  useEffect(() => { localStorage.setItem('asset-custom', JSON.stringify(customAssets)); }, [customAssets]);

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

  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  const cleanupDragGhost = useCallback(() => {
    if (dragGhostRef.current && dragGhostRef.current.parentNode) {
      document.body.removeChild(dragGhostRef.current);
      dragGhostRef.current = null;
    }
  }, []);

  const handleDragStart = useCallback((event: React.DragEvent, asset: Asset) => {
    cleanupDragGhost();
    const dragEl = document.createElement('div');
    dragEl.style.cssText = 'position:absolute;top:-1000px;left:-1000px;padding:6px 12px;background:#1a1a2e;border:1px solid #06b6d4;color:#e2e8f0;font-size:12px;font-family:monospace;display:flex;align-items:center;gap:6px;z-index:9999;';
    dragEl.innerHTML = `<span style="color:#06b6d4">◆</span> ${asset.name}`;
    document.body.appendChild(dragEl);
    dragGhostRef.current = dragEl;
    event.dataTransfer.setDragImage(dragEl, 60, 16);

    onDragStart(event, asset.type, asset.name);
    addToRecent(asset.id);
  }, [onDragStart, addToRecent, cleanupDragGhost]);

  const handleDragEnd = useCallback(() => {
    cleanupDragGhost();
  }, [cleanupDragGhost]);

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
    setExpandedAsset(prev => prev === asset.id ? null : asset.id);
    lastClickIndex.current = index;
  }, [filteredAssets]);

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

  const handleResize = useCallback((e: MouseEvent) => {
    if (!resizing.current) return;
    const newWidth = Math.min(400, Math.max(200, e.clientX));
    setPanelWidth(newWidth);
  }, []);

  const stopResize = useCallback(() => {
    resizing.current = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }, [handleResize]);

  const startResize = useCallback(() => {
    resizing.current = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  }, [handleResize, stopResize]);

  useEffect(() => {
    return () => {
      cleanupDragGhost();
      if (resizing.current) {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        resizing.current = false;
      }
    };
  }, [cleanupDragGhost, handleResize, stopResize]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') {
        if (showCustomForm) { setShowCustomForm(false); return; }
        if (search) { setSearch(''); return; }
        if (expandedAsset) { setExpandedAsset(null); return; }
      }
      if (e.key === 'ArrowDown' && !isInput) {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filteredAssets.length - 1));
      }
      if (e.key === 'ArrowUp' && !isInput) {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      }
      if (e.key === 'Enter' && !isInput && focusedIndex >= 0 && focusedIndex < filteredAssets.length) {
        const asset = filteredAssets[focusedIndex];
        handleAddNode(asset.type, asset.name, asset.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [search, showCustomForm, expandedAsset, filteredAssets, focusedIndex, handleAddNode]);

  useEffect(() => { setFocusedIndex(-1); }, [search, activeCategory]);

  const cycleSortBy = () => {
    setSortBy(prev => prev === 'name' ? 'category' : prev === 'category' ? 'recent' : 'name');
  };

  const sortLabel = sortBy === 'name' ? 'A-Z' : sortBy === 'category' ? 'Cat' : 'Recent';

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
              "p-2 border cursor-grab active:cursor-grabbing group transition-all",
              isExpanded ? "bg-muted/30 border-primary/30" : "bg-muted/20 border-transparent hover:border-primary/50 hover:bg-muted/40",
              isSelected && "border-primary bg-primary/10",
              isFocused && "ring-1 ring-primary/50"
            )}
            data-testid={`asset-item-${asset.id}`}
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-xs text-foreground group-hover:text-primary transition-colors truncate">{asset.name}</span>
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
                >
                  <Star className={cn("w-3 h-3", isFav && "fill-yellow-400")} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddNode(asset.type, asset.name, asset.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
                  data-testid={`button-add-asset-${asset.id}`}
                >
                  <Plus className="w-3 h-3 text-muted-foreground hover:text-primary" />
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
                  {asset.datasheet && (
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(asset.datasheet, '_blank'); }}
                      className="text-[9px] px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Datasheet
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAddNode(asset.type, asset.name, asset.id); }}
                    className="text-[9px] px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5" /> Add to Canvas
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); addOutputLog(`[BOM] Added ${asset.name} to BOM`); }}
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
            onSelect={() => asset.datasheet && window.open(asset.datasheet, '_blank')}
            disabled={!asset.datasheet}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2" /> View Datasheet
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => navigator.clipboard.writeText(asset.name)}>
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

  const showLabels = panelWidth >= 280;

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 top-0 bottom-0 z-30 md:absolute md:top-4 md:left-4 md:bottom-auto md:right-auto md:inset-x-auto bg-card/50 backdrop-blur-xl border border-border shadow-xl flex flex-col max-h-full md:max-h-[calc(100%-2rem)] animate-in fade-in slide-in-from-left-2 duration-300"
      style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${panelWidth}px` : undefined }}
      tabIndex={0}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-sm flex items-center gap-2">
            <Component className="w-4 h-4 text-primary" />
            Asset Library
          </h3>
          <div className="flex items-center gap-1">
            {onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-testid="asset-manager-close"
                    className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    onClick={onClose}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                  <p>Close asset library</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              ref={searchRef}
              className="w-full pl-8 pr-2 py-1.5 bg-muted/50 border border-border text-xs focus:outline-none focus:border-primary transition-colors"
              placeholder="Search parts... ( / )"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="asset-search"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={cycleSortBy}
                className="p-1.5 bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center gap-1"
                data-testid="asset-sort"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="text-[8px]">{sortLabel}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>Sort: {sortBy === 'name' ? 'Alphabetical' : sortBy === 'category' ? 'By Category' : 'Recently Used'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex gap-1 p-2 overflow-x-auto no-scrollbar border-b border-border bg-muted/10">
        {categories.map(cat => {
          const counts = getCategoryCount(cat.id);
          return (
            <Tooltip key={cat.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "relative p-1.5 transition-colors flex flex-col items-center",
                    showLabels && "px-2 py-2",
                    activeCategory === cat.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
                  )}
                  data-testid={`asset-category-${cat.id}`}
                  title={cat.label}
                >
                  <cat.icon className="w-4 h-4" />
                  {showLabels && <span className="text-[8px] mt-0.5">{cat.label.length > 8 ? cat.label.slice(0, 7) + '…' : cat.label}</span>}
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center text-[9px] bg-[#21212199] text-[#dbdbdb]">
                    {search ? counts.filtered : counts.total}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                <p>{cat.label} ({search ? `${counts.filtered}/${counts.total}` : counts.total})</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {favoriteAssets.length > 0 && (
          <div data-testid="asset-favorites-section" className="mb-2">
            <button
              onClick={() => setFavoritesOpen(!favoritesOpen)}
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
                className="text-[10px] px-3 py-1.5 bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                Clear filters
              </button>
              <button
                onClick={() => setShowCustomForm(true)}
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
              className="w-full px-2 py-1.5 bg-muted/50 border border-border text-xs focus:outline-none focus:border-primary transition-colors"
              placeholder="Part name *"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <select
              className="w-full px-2 py-1.5 bg-muted/50 border border-border text-xs focus:outline-none focus:border-primary transition-colors"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
            >
              {categories.filter(c => c.id !== 'all').map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <textarea
              className="w-full px-2 py-1.5 bg-muted/50 border border-border text-xs focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Description"
              rows={2}
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
            />
            <div className="flex gap-1">
              <button
                onClick={handleCustomSubmit}
                disabled={!customName.trim()}
                className="flex-1 text-[10px] px-2 py-1.5 bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                Add Part
              </button>
              <button
                onClick={() => { setShowCustomForm(false); setCustomName(''); setCustomType('mcu'); setCustomDesc(''); }}
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
            className="text-[10px] px-3 py-1.5 bg-primary/30 text-primary hover:bg-primary/40 transition-colors font-medium"
          >
            Add {selectedAssets.size} to Canvas
          </button>
          <button
            onClick={() => setSelectedAssets(new Set())}
            className="text-[10px] px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      )}
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
