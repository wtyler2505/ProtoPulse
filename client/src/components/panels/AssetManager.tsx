import { useState, useRef, useEffect, useCallback } from 'react';
import { useProject } from '@/lib/project-context';
import {
  Cpu, Battery, Radio, Activity, Zap, Component,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AssetSearch from './asset-manager/AssetSearch';
import AssetGrid from './asset-manager/AssetGrid';
import { STORAGE_KEYS } from '@/lib/constants';

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
  const resizing = useRef(false);

  const allAssets: Asset[] = [...builtInAssets, ...customAssets];

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
    const handleKeyDown = (e: KeyboardEvent) => {
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [search, showCustomForm, expandedAsset, filteredAssets, focusedIndex, handleAddNode]);

  useEffect(() => { setFocusedIndex(-1); }, [search, activeCategory]);

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
