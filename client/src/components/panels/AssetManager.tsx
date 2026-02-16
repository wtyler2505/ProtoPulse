import { useState } from 'react';
import { useProject } from '@/lib/project-context';
import { Search, Plus, Cpu, Battery, Radio, Activity, Zap, Component, X } from 'lucide-react';

const categories = [
  { id: 'all', label: 'All', icon: Component },
  { id: 'mcu', label: 'Microcontrollers', icon: Cpu },
  { id: 'power', label: 'Power', icon: Battery },
  { id: 'comm', label: 'Communication', icon: Radio },
  { id: 'sensor', label: 'Sensors', icon: Activity },
  { id: 'connector', label: 'Connectors', icon: Zap },
];

const assets = [
  { id: '1', type: 'mcu', name: 'ESP32-S3-WROOM-1', desc: 'Dual-core, Wi-Fi/BLE, AI instructions' },
  { id: '2', type: 'mcu', name: 'STM32L432KC', desc: 'Ultra-low-power, ARM Cortex-M4' },
  { id: '3', type: 'power', name: 'TP4056', desc: '1A Li-Ion Battery Charger' },
  { id: '4', type: 'power', name: 'LDO 3.3V', desc: 'Low-dropout regulator, 500mA' },
  { id: '5', type: 'comm', name: 'SX1262 LoRa', desc: 'Long-range low-power transceiver' },
  { id: '6', type: 'comm', name: 'SIM7000G', desc: 'NB-IoT / LTE-M Module' },
  { id: '7', type: 'sensor', name: 'SHT40', desc: 'High-accuracy humidity/temp' },
  { id: '8', type: 'sensor', name: 'L86 GNSS', desc: 'GPS/GLONASS patch antenna module' },
];

interface AssetManagerProps {
  onDragStart: (event: React.DragEvent, nodeType: string, label: string) => void;
  onClose?: () => void;
}

export default function AssetManager({ onDragStart, onClose }: AssetManagerProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  const filteredAssets = assets.filter(asset => 
    (activeCategory === 'all' || asset.type === activeCategory) &&
    (asset.name.toLowerCase().includes(search.toLowerCase()) || asset.desc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 z-30 md:absolute md:top-4 md:left-4 md:bottom-auto md:right-auto md:inset-x-auto md:w-64 bg-card/90 backdrop-blur border border-border shadow-xl flex flex-col max-h-full md:max-h-[calc(100%-2rem)] animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-sm flex items-center gap-2">
            <Component className="w-4 h-4 text-primary" />
            Asset Library
          </h3>
          {onClose && (
            <button
              data-testid="asset-manager-close"
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input 
            className="w-full pl-8 pr-2 py-1.5 bg-muted/50 border border-border text-xs focus:outline-none focus:border-primary transition-colors"
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-1 p-2 overflow-x-auto no-scrollbar border-b border-border">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`p-1.5 transition-colors ${activeCategory === cat.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            title={cat.label}
          >
            <cat.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredAssets.map((asset) => (
          <div 
            key={asset.id}
            draggable
            onDragStart={(event) => onDragStart(event, asset.type, asset.name)}
            className="p-2 bg-muted/20 border border-transparent hover:border-primary/50 hover:bg-muted/40 cursor-grab active:cursor-grabbing group transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-xs text-foreground group-hover:text-primary transition-colors">{asset.name}</span>
              <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{asset.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
