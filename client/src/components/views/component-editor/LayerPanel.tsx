import { useMemo, useEffect } from 'react';
import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';

const DEFAULT_LAYERS: Record<string, Array<{ name: string; color: string }>> = {
  breadboard: [
    { name: 'default', color: '#666' },
    { name: 'body', color: '#888' },
    { name: 'pins', color: '#FFD700' },
    { name: 'labels', color: '#ccc' },
    { name: 'artwork', color: '#4CAF50' },
  ],
  schematic: [
    { name: 'default', color: '#666' },
    { name: 'symbols', color: '#888' },
    { name: 'pins', color: '#FFD700' },
    { name: 'labels', color: '#ccc' },
  ],
  pcb: [
    { name: 'default', color: '#666' },
    { name: 'copper-front', color: '#FF4444' },
    { name: 'copper-back', color: '#4444FF' },
    { name: 'silkscreen', color: '#FFFFFF' },
    { name: 'courtyard', color: '#FF00FF' },
    { name: 'fab', color: '#FFFF00' },
  ],
};

function getDefaultLayerConfig(view: 'breadboard' | 'schematic' | 'pcb'): Record<string, { visible: boolean; locked: boolean; color?: string }> {
  const layers = DEFAULT_LAYERS[view] || [];
  const config: Record<string, { visible: boolean; locked: boolean; color?: string }> = {};
  layers.forEach((l) => {
    config[l.name] = { visible: true, locked: false, color: l.color };
  });
  return config;
}

export { getDefaultLayerConfig, DEFAULT_LAYERS };

export default function LayerPanel({ view }: { view: 'breadboard' | 'schematic' | 'pcb' }) {
  const { state, dispatch } = useComponentEditor();
  const activeLayer = state.ui.activeLayer;
  const layerConfig = state.present.views[view].layerConfig;

  const config = useMemo(() => {
    if (layerConfig && Object.keys(layerConfig).length > 0) return layerConfig;
    return getDefaultLayerConfig(view);
  }, [layerConfig, view]);

  useEffect(() => {
    if (!layerConfig || Object.keys(layerConfig).length === 0) {
      dispatch({ type: 'SET_LAYER_CONFIG', payload: { view, layerConfig: getDefaultLayerConfig(view) } });
    }
  }, [view, layerConfig, dispatch]);

  const layers = useMemo(() => {
    const defaultLayers = DEFAULT_LAYERS[view] || [];
    const allNames = new Set([...defaultLayers.map((l) => l.name), ...Object.keys(config)]);
    return Array.from(allNames).map((name) => {
      const defaultDef = defaultLayers.find((l) => l.name === name);
      const cfg = config[name] || { visible: true, locked: false };
      return {
        name,
        color: cfg.color || defaultDef?.color || '#666',
        visible: cfg.visible,
        locked: cfg.locked,
      };
    });
  }, [config, view]);

  const toggleVisibility = (name: string) => {
    const newConfig = { ...config };
    const current = newConfig[name] || { visible: true, locked: false };
    newConfig[name] = { ...current, visible: !current.visible };
    dispatch({ type: 'SET_LAYER_CONFIG', payload: { view, layerConfig: newConfig } });
  };

  const toggleLock = (name: string) => {
    const newConfig = { ...config };
    const current = newConfig[name] || { visible: true, locked: false };
    newConfig[name] = { ...current, locked: !current.locked };
    dispatch({ type: 'SET_LAYER_CONFIG', payload: { view, layerConfig: newConfig } });
  };

  const setActive = (name: string) => {
    dispatch({ type: 'SET_ACTIVE_LAYER', payload: name });
  };

  return (
    <div className="w-56 bg-card border border-border rounded-md shadow-lg overflow-hidden" data-testid="layer-panel">
      <div className="px-3 py-2 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Layers
      </div>
      <div className="max-h-64 overflow-y-auto">
        {layers.map((layer) => (
          <div
            key={layer.name}
            data-testid={`layer-row-${layer.name}`}
            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer transition-colors ${
              activeLayer === layer.name
                ? 'bg-primary/15 text-primary border-l-2 border-l-primary'
                : 'text-foreground hover:bg-muted border-l-2 border-l-transparent'
            }`}
            onClick={() => setActive(layer.name)}
          >
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0 border border-border"
              style={{ backgroundColor: layer.color }}
              data-testid={`layer-color-${layer.name}`}
            />
            <span className="flex-1 truncate select-none" data-testid={`layer-name-${layer.name}`}>
              {layer.name}
            </span>
            <button
              data-testid={`layer-visibility-${layer.name}`}
              className={`p-0.5 rounded transition-colors ${
                layer.visible ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/40 hover:text-foreground'
              }`}
              onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.name); }}
              title={layer.visible ? 'Hide layer' : 'Show layer'}
            >
              {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              data-testid={`layer-lock-${layer.name}`}
              className={`p-0.5 rounded transition-colors ${
                layer.locked ? 'text-yellow-400 hover:text-yellow-300' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={(e) => { e.stopPropagation(); toggleLock(layer.name); }}
              title={layer.locked ? 'Unlock layer' : 'Lock layer'}
            >
              {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
