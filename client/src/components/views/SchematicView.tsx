import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useProject } from '@/lib/project-context';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { topSheetData, sheetDataMap } from './schematic/data';
import type { SheetData, SchematicNet } from './schematic/data';

export default function SchematicView() {
  const { activeSheetId, schematicSheets, setActiveView, setActiveSheetId, addBomItem, addOutputLog } = useProject();

  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [hoveredNetId, setHoveredNetId] = useState<string | null>(null);
  const [netTooltip, setNetTooltip] = useState<{ x: number; y: number; name: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showPinLabels, setShowPinLabels] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const translateXRef = useRef(translateX);
  const translateYRef = useRef(translateY);

  const sheetData = sheetDataMap[activeSheetId] || topSheetData;
  const components = sheetData.components;
  const nets = sheetData.nets;

  const filteredMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(components.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      (c.partNumber && c.partNumber.toLowerCase().includes(q))
    ).map(c => c.id));
  }, [searchQuery, components]);

  const selectedComponent = components.find(c => c.id === selectedComponentId) || null;

  useEffect(() => {
    setSelectedComponentId(null);
    setHoveredComponentId(null);
    setHoveredNetId(null);
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, [activeSheetId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'BUTTON' || target.isContentEditable) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        if (!containerRef.current?.contains(target)) return;
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.code === 'Escape') {
        setSelectedComponentId(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceDown(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.2), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - translateX, y: e.clientY - translateY });
    }
  }, [spaceDown, translateX, translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      translateXRef.current = newX;
      translateYRef.current = newY;
      if (svgRef.current) {
        svgRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${scale})`;
      }
    }
  }, [isPanning, panStart, scale]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setTranslateX(translateXRef.current);
      setTranslateY(translateYRef.current);
    }
    setIsPanning(false);
  }, [isPanning]);

  const fitToView = useCallback(() => {
    if (components.length === 0) {
      setScale(1);
      setTranslateX(0);
      setTranslateY(0);
      return;
    }
    const containerEl = containerRef.current;
    if (!containerEl) return;
    const { width: containerW, height: containerH } = containerEl.getBoundingClientRect();
    const minX = Math.min(...components.map(c => c.x));
    const minY = Math.min(...components.map(c => c.y));
    const maxX = Math.max(...components.map(c => c.x + c.width));
    const maxY = Math.max(...components.map(c => c.y + c.height));
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padding = 60;
    const scaleX = (containerW - padding * 2) / contentW;
    const scaleY = (containerH - padding * 2) / contentH;
    const newScale = Math.min(scaleX, scaleY, 2);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setScale(newScale);
    setTranslateX(containerW / 2 - centerX * newScale);
    setTranslateY(containerH / 2 - centerY * newScale);
  }, [components]);

  const zoomIn = useCallback(() => setScale(prev => Math.min(prev * 1.25, 5)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(prev * 0.8, 0.2)), []);

  const handleComponentClick = useCallback((id: string) => {
    setSelectedComponentId(prev => prev === id ? null : id);
  }, []);

  const handleAddToBom = useCallback(() => {
    if (!selectedComponent) return;
    addBomItem({
      partNumber: selectedComponent.partNumber || selectedComponent.name,
      manufacturer: 'TBD',
      description: `${selectedComponent.name} - ${selectedComponent.type}`,
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      supplier: 'Digi-Key',
      stock: 0,
      status: 'In Stock',
    });
    addOutputLog(`[BOM] Added ${selectedComponent.name} (${selectedComponent.partNumber}) to BOM`);
  }, [selectedComponent, addBomItem, addOutputLog]);

  const handleViewInArchitecture = useCallback(() => {
    setActiveView('architecture');
  }, [setActiveView]);

  const handleNetHover = useCallback((netId: string | null, e?: React.MouseEvent) => {
    setHoveredNetId(netId);
    if (netId && e) {
      const net = nets.find(n => n.id === netId);
      if (net) {
        setNetTooltip({ x: e.clientX, y: e.clientY, name: net.name });
      }
    } else {
      setNetTooltip(null);
    }
  }, [nets]);

  const highlightedNetName = useMemo(() => {
    if (!hoveredNetId) return null;
    const net = nets.find(n => n.id === hoveredNetId);
    return net?.name || null;
  }, [hoveredNetId, nets]);

  const getNetHighlight = useCallback((net: SchematicNet) => {
    if (hoveredNetId === net.id) return true;
    if (highlightedNetName && net.name === highlightedNetName) return true;
    return false;
  }, [hoveredNetId, highlightedNetName]);

  useEffect(() => {
    translateXRef.current = translateX;
    translateYRef.current = translateY;
  }, [translateX, translateY]);

  const activeSheet = schematicSheets.find(s => s.id === activeSheetId);

  return (
    <div className="w-full h-full bg-[#1e1e1e] relative overflow-hidden flex" data-testid="schematic-view">
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        role="application"
        aria-label="Schematic editor"
        tabIndex={0}
        style={{ cursor: isPanning ? 'grabbing' : spaceDown ? 'grab' : 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#4a4a4a 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          role="img"
          aria-label="Circuit schematic diagram"
          style={{
            transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <filter id="glow-cyan">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-cyan-strong">
              <feGaussianBlur stdDeviation="6" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {nets.map(net => {
            const highlighted = getNetHighlight(net);
            const pathData = net.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return (
              <path
                key={net.id}
                d={pathData}
                stroke={highlighted ? '#06b6d4' : net.color || '#6b7280'}
                strokeWidth={highlighted ? 3 : 1.5}
                fill="none"
                filter={highlighted ? 'url(#glow-cyan-strong)' : undefined}
                className="transition-all duration-150"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => handleNetHover(net.id, e)}
                onMouseMove={(e) => { if (hoveredNetId === net.id) setNetTooltip({ x: e.clientX, y: e.clientY, name: net.name }); }}
                onMouseLeave={() => handleNetHover(null)}
                data-testid={`net-${net.id}`}
              />
            );
          })}

          {components.map(comp => {
            const isSelected = selectedComponentId === comp.id;
            const isHovered = hoveredComponentId === comp.id;
            const isSearchMatch = filteredMatchIds.has(comp.id);
            const dimmed = searchQuery.trim() && !isSearchMatch;

            return (
              <g
                key={comp.id}
                tabIndex={0}
                role="button"
                aria-label={`${comp.name} - ${comp.type}`}
                transform={`translate(${comp.x}, ${comp.y})`}
                onClick={() => handleComponentClick(comp.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleComponentClick(comp.id);
                  }
                }}
                onMouseEnter={() => setHoveredComponentId(comp.id)}
                onMouseLeave={() => setHoveredComponentId(null)}
                style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1 }}
                className="transition-opacity duration-200"
                data-testid={`component-${comp.id}`}
              >
                {isSelected && (
                  <rect
                    x={-4} y={-4}
                    width={comp.width + 8} height={comp.height + 8}
                    fill="none" stroke="#06b6d4" strokeWidth="2"
                    filter="url(#glow-cyan)"
                  />
                )}
                <rect
                  x={0} y={0}
                  width={comp.width} height={comp.height}
                  fill={isHovered ? 'rgba(6,182,212,0.08)' : 'rgba(30,30,30,0.9)'}
                  stroke={isSelected ? '#06b6d4' : isSearchMatch ? '#06b6d4' : isHovered ? '#06b6d4' : '#6b7280'}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                  className="transition-all duration-150"
                />
                <text
                  x={comp.width / 2} y={comp.height / 2 - 5}
                  textAnchor="middle"
                  fill={isSelected ? '#06b6d4' : '#e5e5e5'}
                  className="font-mono"
                  fontSize="13"
                  fontWeight="bold"
                >
                  {comp.name}
                </text>
                <text
                  x={comp.width / 2} y={comp.height / 2 + 12}
                  textAnchor="middle"
                  fill="#9ca3af"
                  className="font-mono"
                  fontSize="9"
                >
                  {comp.type}
                </text>

                {comp.pins.map((pin, i) => {
                  const px = pin.side === 'left' ? 0 : pin.side === 'right' ? comp.width : pin.x;
                  const py = pin.side === 'top' ? 0 : pin.side === 'bottom' ? comp.height : pin.y;
                  const stubX = pin.side === 'left' ? pin.x : pin.side === 'right' ? pin.x : px;
                  const stubY = pin.side === 'top' ? pin.y : pin.side === 'bottom' ? pin.y : py;

                  return (
                    <g key={i}>
                      <line
                        x1={px} y1={py}
                        x2={stubX} y2={stubY}
                        stroke="#6b7280"
                        strokeWidth="1"
                      />
                      <circle cx={stubX} cy={stubY} r="2" fill="#06b6d4" opacity="0.7" />
                      {showPinLabels && (
                        <text
                          x={pin.side === 'left' ? stubX - 4 : pin.side === 'right' ? stubX + 4 : stubX}
                          y={pin.side === 'top' ? stubY - 4 : pin.side === 'bottom' ? stubY + 10 : stubY + 3}
                          textAnchor={pin.side === 'left' ? 'end' : pin.side === 'right' ? 'start' : 'middle'}
                          fill="#9ca3af"
                          className="font-mono"
                          fontSize="8"
                        >
                          {pin.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {netTooltip && (
          <div
            role="tooltip"
            aria-live="polite"
            className="fixed z-50 px-2 py-1 bg-card/90 backdrop-blur border border-cyan-500/50 text-cyan-400 font-mono text-xs pointer-events-none"
            style={{ left: netTooltip.x + 12, top: netTooltip.y - 24 }}
          >
            NET: {netTooltip.name}
          </div>
        )}

        <TooltipProvider delayDuration={200}>
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-2" data-testid="toolbar">
            <div className="flex items-center gap-1 px-2 py-1 bg-card/70 backdrop-blur-xl border border-border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={zoomIn} className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors" data-testid="btn-zoom-in">+</button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Zoom In</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={zoomOut} className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors" data-testid="btn-zoom-out">−</button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Zoom Out</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={fitToView} className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors" data-testid="btn-fit-view">FIT</button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Fit to View</p></TooltipContent>
              </Tooltip>
              <div className="w-px h-4 bg-border mx-1" />
              <span className="text-xs font-mono text-muted-foreground" data-testid="zoom-indicator">{Math.round(scale * 100)}%</span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 bg-card/70 backdrop-blur-xl border border-border">
              <span className="text-[10px] font-mono text-muted-foreground mr-1">SHEET:</span>
              <select
                value={activeSheetId}
                onChange={(e) => setActiveSheetId(e.target.value)}
                className="bg-transparent text-xs font-mono text-cyan-400 border-none outline-none cursor-pointer"
                data-testid="select-sheet"
              >
                {schematicSheets.map(s => (
                  <option key={s.id} value={s.id} className="bg-card text-foreground">{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 px-2 py-1 bg-card/70 backdrop-blur-xl border border-border">
              <span className="text-[10px] font-mono text-muted-foreground">COMPONENTS: {components.length}</span>
              <div className="w-px h-3 bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowPinLabels(prev => !prev)}
                    className={`text-[10px] font-mono transition-colors ${showPinLabels ? 'text-cyan-400' : 'text-muted-foreground'} hover:text-cyan-400`}
                    data-testid="btn-toggle-pins"
                  >
                    PINS {showPinLabels ? 'ON' : 'OFF'}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{showPinLabels ? 'Hide' : 'Show'} Pin Labels</p></TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center px-2 py-1 bg-card/70 backdrop-blur-xl border border-border">
              <span className="text-[10px] font-mono text-muted-foreground mr-1">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search components..."
                className="bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground/50 w-36"
                data-testid="input-search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-muted-foreground hover:text-cyan-400 ml-1"
                  data-testid="btn-clear-search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </TooltipProvider>
      </div>

      {selectedComponent && (
        <div
          className="w-80 h-full bg-card/80 backdrop-blur-xl border-l border-border overflow-y-auto flex-shrink-0 animate-in slide-in-from-right-5 duration-200"
          data-testid="inspection-panel"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-mono font-bold text-cyan-400">{selectedComponent.name}</h3>
              <p className="text-xs font-mono text-muted-foreground">{selectedComponent.type}</p>
            </div>
            <button
              onClick={() => setSelectedComponentId(null)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
              data-testid="btn-close-panel"
            >
              ✕
            </button>
          </div>

          {selectedComponent.partNumber && (
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Part Number</div>
              <div className="text-xs font-mono text-foreground">{selectedComponent.partNumber}</div>
              {selectedComponent.package && (
                <>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 mt-2">Package</div>
                  <div className="text-xs font-mono text-foreground">{selectedComponent.package}</div>
                </>
              )}
            </div>
          )}

          {selectedComponent.specs && Object.keys(selectedComponent.specs).length > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Specifications</div>
              <div className="space-y-1">
                {Object.entries(selectedComponent.specs).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-b border-border">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Pins ({selectedComponent.pins.length})
            </div>
            <div className="space-y-1">
              {selectedComponent.pins.map((pin, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-foreground">{pin.name}</span>
                  <span className="text-cyan-400/70">{pin.net || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 border-b border-border">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Datasheet</div>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent((selectedComponent.partNumber || selectedComponent.name) + ' datasheet')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-cyan-400 hover:underline"
              data-testid="link-datasheet"
            >
              Search Datasheet →
            </a>
          </div>

          <div className="px-4 py-3 space-y-2">
            <button
              onClick={handleAddToBom}
              className="w-full px-3 py-2 bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 text-xs font-mono hover:bg-cyan-400/20 transition-colors"
              data-testid="btn-add-to-bom"
            >
              + Add to BOM
            </button>
            <button
              onClick={handleViewInArchitecture}
              className="w-full px-3 py-2 bg-card border border-border text-muted-foreground text-xs font-mono hover:text-foreground hover:border-foreground/30 transition-colors"
              data-testid="btn-view-architecture"
            >
              View in Architecture →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}