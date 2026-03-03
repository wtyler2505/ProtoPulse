import { useState, useMemo, useCallback, useRef, useEffect, memo, lazy, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useOutput } from '@/lib/contexts/output-context';
import { Download, Search, ShoppingCart, SlidersHorizontal, AlertCircle, CheckCircle2, Plus, Trash2, Package, XCircle, Cpu, ChevronDown, ChevronUp, Copy, Pencil, Check, X, GripVertical, ArrowUpDown, DollarSign, TrendingUp, BarChart3, Zap, Layers } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { useToast } from '@/hooks/use-toast';
import { useComponentParts } from '@/lib/component-editor/hooks';
import type { PartMeta } from '@shared/component-types';
import type { BomItem } from '@/lib/project-context';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { STORAGE_KEYS, DEFAULT_PREFERRED_SUPPLIERS, OPTIMIZATION_GOALS, getSupplierSearchUrl, type SupplierName } from '@/lib/constants';
import { buildCSV, downloadBlob } from '@/lib/csv';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GitCompareArrows } from 'lucide-react';

const BomDiffPanel = lazy(() => import('@/components/views/BomDiffPanel'));

// ---------------------------------------------------------------------------
// ESD & Assembly Detection Utilities
// ---------------------------------------------------------------------------

const ESD_PATTERNS: RegExp[] = [
  /\bic\b/i, /\bmcu\b/i, /\bsoc\b/i, /\bmicrocontroller\b/i, /\bmicroprocessor\b/i,
  /\bfpga\b/i, /\bcpld\b/i, /\basic\b/i, /\bdsp\b/i,
  /\bmosfet\b/i, /\bjfet\b/i, /\bcmos\b/i, /\bmos\b/i, /\bigbt\b/i,
  /\bop[- ]?amp\b/i, /\bopamp\b/i, /\bcomparator\b/i, /\badc\b/i, /\bdac\b/i,
  /\buart\b/i, /\bspi\b/i, /\bi2c\b/i, /\busb\b/i,
  /\beeprom\b/i, /\bflash\b/i, /\bsram\b/i, /\bdram\b/i,
  /\besp32\b/i, /\besp8266\b/i, /\bstm32\b/i, /\batmega\b/i, /\battiny\b/i,
  /\brp2040\b/i, /\bnrf52\b/i, /\bsamd\b/i,
  /\bldo\b/i, /\bvoltage regulator\b/i, /\bdc[- ]?dc\b/i, /\bbuck\b/i, /\bboost converter\b/i,
];

function detectEsdSensitivity(description: string, partNumber: string): boolean {
  const combined = `${description} ${partNumber}`;
  return ESD_PATTERNS.some((p) => p.test(combined));
}

type AssemblyCategory = 'smt' | 'through_hole' | 'hand_solder' | 'mechanical';

const SMT_PATTERNS: RegExp[] = [
  /\b0201\b/, /\b0402\b/, /\b0603\b/, /\b0805\b/, /\b1206\b/, /\b1210\b/, /\b1812\b/, /\b2010\b/, /\b2512\b/,
  /\bsmd\b/i, /\bsmt\b/i, /\bsurface mount\b/i,
  /\bqfp\b/i, /\btqfp\b/i, /\blqfp\b/i, /\bqfn\b/i, /\bdfn\b/i, /\bson\b/i,
  /\bbga\b/i, /\bfbga\b/i, /\bwlcsp\b/i,
  /\bsop\b/i, /\bssop\b/i, /\btssop\b/i, /\bmsop\b/i, /\bsoic\b/i,
  /\bsot[- ]?23\b/i, /\bsot[- ]?223\b/i, /\bsc[- ]?70\b/i, /\bd[- ]?pak\b/i,
  /\bto[- ]?252\b/i, /\bto[- ]?263\b/i,
];

const THROUGH_HOLE_PATTERNS: RegExp[] = [
  /\bthrough[- ]?hole\b/i, /\btht\b/i, /\bdip\b/i, /\bpdip\b/i, /\bsip\b/i,
  /\bto[- ]?92\b/i, /\bto[- ]?220\b/i, /\bto[- ]?247\b/i, /\bto[- ]?3\b/i,
  /\bradial\b/i, /\baxial\b/i,
];

const HAND_SOLDER_PATTERNS: RegExp[] = [
  /\bconnector\b/i, /\bjst\b/i, /\bmolex\b/i, /\bheader\b/i, /\bterminal\b/i,
  /\bwire\b/i, /\bcable\b/i, /\bsocket\b/i, /\bplug\b/i, /\bjack\b/i,
  /\bdb9\b/i, /\bdb25\b/i, /\busb[- ]?[abc]\b/i, /\bhdmi\b/i, /\brj45\b/i,
  /\bswitch\b/i, /\bbutton\b/i, /\bpotentiometer\b/i, /\btrimmer\b/i,
  /\bbattery holder\b/i, /\bfuse holder\b/i, /\brelay\b/i, /\btransformer\b/i,
  /\bbuzzer\b/i, /\bspeaker\b/i, /\btest point\b/i,
];

const MECHANICAL_PATTERNS: RegExp[] = [
  /\bstandoff\b/i, /\bscrew\b/i, /\bnut\b/i, /\bwasher\b/i, /\bspacer\b/i,
  /\bbracket\b/i, /\bmounting\b/i, /\bheatsink\b/i, /\bheat sink\b/i,
  /\benclosure\b/i, /\bclip\b/i, /\brivet\b/i, /\bgasket\b/i,
  /\brubber feet\b/i, /\bbumper\b/i, /\bthermal pad\b/i, /\bthermal tape\b/i,
];

function detectAssemblyCategory(description: string, partNumber: string): AssemblyCategory | null {
  const combined = `${description} ${partNumber}`;
  if (MECHANICAL_PATTERNS.some((p) => p.test(combined))) { return 'mechanical'; }
  if (HAND_SOLDER_PATTERNS.some((p) => p.test(combined))) { return 'hand_solder'; }
  if (THROUGH_HOLE_PATTERNS.some((p) => p.test(combined))) { return 'through_hole'; }
  if (SMT_PATTERNS.some((p) => p.test(combined))) { return 'smt'; }
  return null;
}

interface AssemblyCategoryInfo {
  label: string;
  note: string;
  color: string;
  bgColor: string;
}

const ASSEMBLY_CATEGORY_INFO: Record<AssemblyCategory | 'unassigned', AssemblyCategoryInfo> = {
  smt: {
    label: 'SMT (Surface Mount)',
    note: 'Requires solder paste stencil and reflow oven. Inspect with magnification after reflow.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
  },
  through_hole: {
    label: 'Through-Hole',
    note: 'Wave soldering or hand soldering. Trim leads after soldering. Check for cold joints.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
  },
  hand_solder: {
    label: 'Hand-Solder',
    note: 'Connectors, wires, and large components. Solder by hand with appropriate tip size and temperature.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  mechanical: {
    label: 'Mechanical',
    note: 'Standoffs, screws, spacers, and enclosure parts. No soldering required — assemble with tools.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
  },
  unassigned: {
    label: 'Unassigned',
    note: 'Category could not be auto-detected. Set manually or update the component description.',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/10 border-border',
  },
};

function ProcurementView() {
  const { bom, bomSettings, setBomSettings, addBomItem, deleteBomItem, updateBomItem } = useBom();
  const { addOutputLog } = useOutput();
  const { toast } = useToast();
  const projectId = useProjectId();
  const { data: componentParts, isLoading: partsLoading } = useComponentParts(projectId);
  const [showSettings, setShowSettings] = useState(false);
  const [showComponentRef, setShowComponentRef] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
  const [esdFilterOnly, setEsdFilterOnly] = useState(false);
  const [showAssemblyGroups, setShowAssemblyGroups] = useState(false);
  const [optimizationGoal, setOptimizationGoal] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OPTIMIZATION_GOAL);
      if (stored && Object.hasOwn(OPTIMIZATION_GOALS, stored)) return stored;
    } catch { /* fall through to default */ }
    return 'Cost';
  });
  const [showSupplierEdit, setShowSupplierEdit] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [preferredSuppliers, setPreferredSuppliers] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERRED_SUPPLIERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch { /* fall through to default */ }
    return { ...DEFAULT_PREFERRED_SUPPLIERS };
  });
  const updateOptimizationGoal = useCallback((goal: string) => {
    setOptimizationGoal(goal);
    try { localStorage.setItem(STORAGE_KEYS.OPTIMIZATION_GOAL, goal); } catch { /* quota exceeded, silently fail */ }
  }, []);
  const updatePreferredSuppliers = useCallback((updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    setPreferredSuppliers(prev => {
      const next = updater(prev);
      try { localStorage.setItem(STORAGE_KEYS.PREFERRED_SUPPLIERS, JSON.stringify(next)); } catch { /* quota exceeded, silently fail */ }
      return next;
    });
  }, []);

  // ── BOM row click highlighting ──
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHighlightItem = useCallback((id: number) => {
    if (highlightTimer.current) { clearTimeout(highlightTimer.current); }
    setHighlightedItemId(id);
    highlightTimer.current = setTimeout(() => setHighlightedItemId(null), 1500);
  }, []);

  // ── Sort order state (persisted, enables DnD reorder) ──
  const [sortOrder, setSortOrder] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BOM_SORT_ORDER);
      if (stored) { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) return parsed; }
    } catch { /* fall through */ }
    return [];
  });

  const saveSortOrder = useCallback((order: number[]) => {
    setSortOrder(order);
    try { localStorage.setItem(STORAGE_KEYS.BOM_SORT_ORDER, JSON.stringify(order)); } catch { /* quota */ }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Enriched BOM data with auto-detected ESD + assembly category ──
  const enrichedBom = useMemo(() => bom.map(item => ({
    ...item,
    _isEsd: item.esdSensitive ?? detectEsdSensitivity(item.description, item.partNumber),
    _assemblyCategory: (item.assemblyCategory ?? detectAssemblyCategory(item.description, item.partNumber)) as AssemblyCategory | null,
  })), [bom]);

  const filteredBom = useMemo(() => {
    let filtered = enrichedBom;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.partNumber.toLowerCase().includes(term) ||
        item.manufacturer.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.supplier.toLowerCase().includes(term),
      );
    }
    if (esdFilterOnly) {
      filtered = filtered.filter(item => item._isEsd);
    }
    if (sortOrder.length === 0) { return filtered; }
    const orderMap = new Map(sortOrder.map((id, idx) => [id, idx]));
    return [...filtered].sort((a, b) => {
      const aIdx = orderMap.get(Number(a.id)) ?? Number.MAX_SAFE_INTEGER;
      const bIdx = orderMap.get(Number(b.id)) ?? Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
  }, [enrichedBom, searchTerm, esdFilterOnly, sortOrder]);

  // ── Assembly grouping data ──
  const assemblyGroups = useMemo(() => {
    const groups: Record<string, typeof enrichedBom> = {
      smt: [],
      through_hole: [],
      hand_solder: [],
      mechanical: [],
      unassigned: [],
    };
    for (const item of enrichedBom) {
      const cat = item._assemblyCategory ?? 'unassigned';
      groups[cat].push(item);
    }
    return groups;
  }, [enrichedBom]);

  const esdCount = useMemo(() => enrichedBom.filter(i => i._isEsd).length, [enrichedBom]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredBom.findIndex(item => Number(item.id) === active.id);
    const newIndex = filteredBom.findIndex(item => Number(item.id) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(filteredBom, oldIndex, newIndex);
    saveSortOrder(reordered.map(item => Number(item.id)));
    toast({ title: 'Reordered', description: 'BOM item order updated.' });
  }, [filteredBom, saveSortOrder, toast]);

  const totalCost = filteredBom.reduce((acc, item) => acc + Number(item.totalPrice), 0);

  const costBreakdown = useMemo(() => {
    const statusCategories: Record<string, { total: number; count: number; color: string }> = {
      'In Stock': { total: 0, count: 0, color: 'bg-emerald-500' },
      'Low Stock': { total: 0, count: 0, color: 'bg-yellow-500' },
      'Out of Stock': { total: 0, count: 0, color: 'bg-destructive' },
      'On Order': { total: 0, count: 0, color: 'bg-blue-500' },
    };

    for (const item of bom) {
      const cat = statusCategories[item.status];
      if (cat) {
        cat.total += Number(item.totalPrice);
        cat.count += 1;
      }
    }

    const avgUnitCost = bom.length > 0
      ? bom.reduce((sum, item) => sum + Number(item.unitPrice), 0) / bom.length
      : 0;

    const totalBomCost = bom.reduce((sum, item) => sum + Number(item.totalPrice), 0);

    const topItems = [...bom]
      .sort((a, b) => Number(b.totalPrice) - Number(a.totalPrice))
      .slice(0, 5);

    const maxItemCost = topItems.length > 0 ? Number(topItems[0].totalPrice) : 0;

    return { statusCategories, avgUnitCost, totalBomCost, topItems, maxItemCost };
  }, [bom]);

  const handleExportCSV = useCallback(() => {
    try {
      const headers = ['Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Supplier', 'Stock', 'Status'];
      const rows = filteredBom.map(item => [
        item.partNumber, item.manufacturer, item.description, item.quantity,
        Number(item.unitPrice).toFixed(2), Number(item.totalPrice).toFixed(2), item.supplier,
        item.stock, item.status,
      ]);
      const csv = buildCSV(headers, rows);
      downloadBlob(new Blob([csv], { type: 'text/csv' }), 'bom_export.csv');
      toast({ title: 'Export Complete', description: 'BOM exported as CSV file.' });
    } catch (err) {
      console.warn('Export failed:', err);
      toast({ title: 'Export Failed', description: 'Could not export CSV. Please try again.', variant: 'destructive' });
    }
  }, [filteredBom, toast]);

  // ── Inline editing state ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ partNumber: '', manufacturer: '', description: '', quantity: 1, unitPrice: 0, supplier: 'Digi-Key' });

  const startEdit = useCallback((item: BomItem) => {
    setEditingId(Number(item.id));
    setEditValues({
      partNumber: item.partNumber,
      manufacturer: item.manufacturer,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Math.round(Number(item.unitPrice) * 100) / 100,
      supplier: item.supplier,
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId === null) return;
    updateBomItem(editingId, {
      partNumber: editValues.partNumber.trim(),
      manufacturer: editValues.manufacturer.trim() || 'Unknown',
      description: editValues.description.trim(),
      quantity: Math.max(1, editValues.quantity),
      unitPrice: Math.max(0, editValues.unitPrice),
      supplier: editValues.supplier as 'Digi-Key' | 'Mouser' | 'LCSC' | 'Unknown',
    });
    toast({ title: 'Item Updated', description: `Updated "${editValues.partNumber.trim()}"` });
    setEditingId(null);
  }, [editingId, editValues, updateBomItem, toast]);

  const cancelEdit = useCallback(() => { setEditingId(null); }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }, [saveEdit, cancelEdit]);

  const defaultNewItem: { partNumber: string; manufacturer: string; description: string; quantity: number; unitPrice: number; supplier: string } = { partNumber: '', manufacturer: '', description: '', quantity: 1, unitPrice: 0, supplier: 'Digi-Key' };
  const [newItem, setNewItem] = useState(defaultNewItem);

  const resetNewItem = () => setNewItem({ ...defaultNewItem });

  const handleAddItem = () => {
    if (!newItem.partNumber.trim()) {
      toast({ title: 'Missing Part Number', description: 'Please enter a part number.', variant: 'destructive' });
      return;
    }
    addBomItem({
      partNumber: newItem.partNumber.trim(),
      manufacturer: newItem.manufacturer.trim() || 'Unknown',
      description: newItem.description.trim() || '',
      quantity: Math.max(1, newItem.quantity),
      unitPrice: Math.max(0, newItem.unitPrice),
      totalPrice: 0,
      supplier: newItem.supplier as 'Digi-Key' | 'Mouser' | 'LCSC' | 'Unknown',
      stock: 0,
      status: 'Out of Stock',
    });
    toast({ title: 'Item Added', description: `Added "${newItem.partNumber.trim()}" to the BOM.` });
    resetNewItem();
    setShowAddItemDialog(false);
  };

  return (
    <Tabs defaultValue="management" className="h-full flex flex-col bg-background/50" data-testid="procurement-view">
      <div className="px-4 pt-3 pb-0 border-b border-border bg-card/30 backdrop-blur">
        <TabsList className="mb-3" data-testid="procurement-tabs">
          <TabsTrigger value="management" data-testid="tab-bom-management">
            <Package className="h-4 w-4 mr-1.5" />
            BOM Management
          </TabsTrigger>
          <TabsTrigger value="comparison" data-testid="tab-bom-comparison">
            <GitCompareArrows className="h-4 w-4 mr-1.5" />
            BOM Comparison
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="management" className="flex-1 flex flex-col overflow-hidden mt-0">
      <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/30 backdrop-blur">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search components..." 
              aria-label="Search components"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-bom"
              className="pl-9 pr-4 py-2 bg-muted/30 border border-border text-sm focus:outline-none focus:border-primary w-full sm:w-64 transition-all"
            />
          </div>
          <StyledTooltip content="Configure BOM optimization settings" side="bottom">
            <Button
              variant="outline"
              size="sm"
              className={showSettings ? "bg-primary/10 border-primary text-primary" : ""}
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-toggle-settings"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Cost Optimisation
            </Button>
          </StyledTooltip>
          <StyledTooltip content={esdFilterOnly ? 'Show all components' : `Show ESD-sensitive only (${esdCount})`} side="bottom">
            <Button
              variant="outline"
              size="sm"
              className={esdFilterOnly ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : ''}
              onClick={() => setEsdFilterOnly(!esdFilterOnly)}
              data-testid="button-toggle-esd-filter"
            >
              <Zap className="w-4 h-4 mr-2" />
              ESD{esdCount > 0 && <span className="ml-1 text-[10px] font-mono">({esdCount})</span>}
            </Button>
          </StyledTooltip>
          <StyledTooltip content={showAssemblyGroups ? 'Show flat BOM list' : 'Group by assembly category'} side="bottom">
            <Button
              variant="outline"
              size="sm"
              className={showAssemblyGroups ? 'bg-primary/10 border-primary text-primary' : ''}
              onClick={() => setShowAssemblyGroups(!showAssemblyGroups)}
              data-testid="button-toggle-assembly-groups"
            >
              <Layers className="w-4 h-4 mr-2" />
              Assembly
            </Button>
          </StyledTooltip>
          <StyledTooltip content="Add new BOM component" side="bottom">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { resetNewItem(); setShowAddItemDialog(true); }}
              data-testid="button-add-bom-item"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </StyledTooltip>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className="text-right flex-1 md:flex-none">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Estimated BOM Cost</div>
            <div className="text-xl font-mono font-bold text-primary flex items-baseline justify-end gap-1" data-testid="text-total-cost">
              ${totalCost.toFixed(2)}
              <span className="text-xs text-muted-foreground font-sans font-normal">/ unit @ 1k qty</span>
            </div>
          </div>
          <StyledTooltip content="Download BOM as CSV file" side="bottom">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleExportCSV} data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </StyledTooltip>
        </div>
      </div>

      {showSettings && (
        <div className="bg-muted/10 backdrop-blur-xl border-b border-border p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-in slide-in-from-top-2" data-testid="panel-settings">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Production Batch Size</h4>
            <div className="flex items-center gap-4">
              <Slider 
                value={[bomSettings.batchSize]} 
                max={10000} 
                step={100} 
                className="flex-1"
                onValueChange={([v]) => setBomSettings({...bomSettings, batchSize: v})}
                data-testid="slider-batch-size"
              />
              <span className="font-mono text-sm w-16 text-right" data-testid="text-batch-size">{bomSettings.batchSize}</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Max BOM Cost Target</h4>
             <div className="flex items-center gap-4">
              <Slider 
                value={[bomSettings.maxCost]} 
                max={100} 
                step={1} 
                className="flex-1"
                 onValueChange={([v]) => setBomSettings({...bomSettings, maxCost: v})}
                data-testid="slider-max-cost"
              />
              <span className="font-mono text-sm w-16 text-right" data-testid="text-max-cost">${bomSettings.maxCost}</span>
            </div>
          </div>

          <div className="space-y-4">
             <h4 className="text-sm font-medium text-foreground">Sourcing Constraints</h4>
             <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Stock Only</span>
                <Switch checked={bomSettings.inStockOnly} onCheckedChange={(v) => setBomSettings({...bomSettings, inStockOnly: v})} data-testid="switch-in-stock-only" />
             </div>
             <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Preferred Suppliers</span>
                <StyledTooltip content="Edit preferred supplier list" side="top">
                  <span
                    className="text-xs text-primary cursor-pointer hover:underline"
                    data-testid="link-edit-suppliers"
                    onClick={() => setShowSupplierEdit(!showSupplierEdit)}
                  >Edit List</span>
                </StyledTooltip>
             </div>
             {showSupplierEdit && (
               <div className="mt-2 space-y-1.5 pl-1 animate-in slide-in-from-top-1" data-testid="panel-supplier-edit">
                 {Object.entries(preferredSuppliers).map(([supplier, checked]) => (
                   <label key={supplier} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                     <input
                       type="checkbox"
                       checked={checked}
                       onChange={(e) => updatePreferredSuppliers(prev => ({ ...prev, [supplier]: e.target.checked }))}
                       className="accent-primary w-3.5 h-3.5"
                       data-testid={`checkbox-supplier-${supplier.toLowerCase().replace(/[^a-z]/g, '-')}`}
                     />
                     {supplier}
                   </label>
                 ))}
               </div>
             )}
          </div>

           <div className="space-y-4">
             <h4 className="text-sm font-medium text-foreground">Optimization Goal</h4>
             <div className="flex gap-2">
                {['Cost', 'Power', 'Size', 'Avail'].map(goal => (
                  <StyledTooltip key={goal} content={OPTIMIZATION_GOALS[goal]} side="bottom">
                    <button
                      onClick={() => updateOptimizationGoal(goal)}
                      data-testid={`button-goal-${goal.toLowerCase()}`}
                      className={cn(
                        "px-3 py-1 border border-border text-xs hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors",
                        optimizationGoal === goal && "bg-primary/10 border-primary text-primary"
                      )}
                    >
                      {goal}
                    </button>
                  </StyledTooltip>
                ))}
             </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 lg:p-6">
        {/* Cost summary section */}
        {bom.length > 0 && (
          <div className="mb-4 space-y-4" data-testid="section-cost-summary">
            {/* Summary cards row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="card-total-bom-cost">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total BOM Cost</span>
                </div>
                <div className="text-xl font-mono font-bold text-foreground" data-testid="text-summary-total-cost">
                  ${costBreakdown.totalBomCost.toFixed(2)}
                </div>
              </div>
              <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="card-avg-unit-cost">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Unit Price</span>
                </div>
                <div className="text-xl font-mono font-bold text-foreground" data-testid="text-summary-avg-cost">
                  ${costBreakdown.avgUnitCost.toFixed(2)}
                </div>
              </div>
              {Object.entries(costBreakdown.statusCategories)
                .filter(([, data]) => data.count > 0)
                .slice(0, 2)
                .map(([status, data]) => (
                  <div key={status} className="border border-border bg-card/80 backdrop-blur p-4" data-testid={`card-status-cost-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn('w-2.5 h-2.5 rounded-full', data.color)} />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{status}</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-foreground" data-testid={`text-status-cost-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                      ${data.total.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {data.count} item{data.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
            </div>

            {/* Cost by status breakdown + top 5 items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Cost by status */}
              <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="panel-cost-by-status">
                <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  Cost by Status
                </h4>
                <div className="space-y-2.5">
                  {Object.entries(costBreakdown.statusCategories).map(([status, data]) => {
                    const pct = costBreakdown.totalBomCost > 0
                      ? (data.total / costBreakdown.totalBomCost) * 100
                      : 0;
                    return (
                      <div key={status} data-testid={`bar-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', data.color)} />
                            <span className="text-muted-foreground">{status}</span>
                            <span className="text-[10px] text-muted-foreground/60">({data.count})</span>
                          </div>
                          <span className="font-mono text-foreground">${data.total.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', data.color)}
                            style={{ width: `${Math.max(pct, 0.5)}%` }}
                            data-testid={`bar-fill-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top 5 most expensive items */}
              <div className="border border-border bg-card/80 backdrop-blur p-4" data-testid="panel-top-cost-items">
                <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  Top {Math.min(5, costBreakdown.topItems.length)} by Cost
                </h4>
                {costBreakdown.topItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No items to display.</p>
                ) : (
                  <div className="space-y-2.5">
                    {costBreakdown.topItems.map((item) => {
                      const pct = costBreakdown.maxItemCost > 0
                        ? (Number(item.totalPrice) / costBreakdown.maxItemCost) * 100
                        : 0;
                      return (
                        <div key={item.id} data-testid={`bar-item-${item.id}`}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-mono text-foreground truncate max-w-[60%]">{item.partNumber}</span>
                            <span className="font-mono text-foreground">${Number(item.totalPrice).toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                              data-testid={`bar-fill-item-${item.id}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assembly grouping view */}
        {showAssemblyGroups && enrichedBom.length > 0 && (
          <div className="mb-4 space-y-3" data-testid="section-assembly-groups">
            {(Object.entries(assemblyGroups) as [AssemblyCategory | 'unassigned', typeof enrichedBom][]).map(([category, items]) => {
              if (items.length === 0) { return null; }
              const info = ASSEMBLY_CATEGORY_INFO[category];
              return (
                <div key={category} className={cn('border p-4', info.bgColor)} data-testid={`assembly-group-${category}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers className={cn('w-4 h-4', info.color)} />
                      <h4 className={cn('text-sm font-medium', info.color)} data-testid={`assembly-group-label-${category}`}>{info.label}</h4>
                      <span className="text-[10px] font-mono bg-background/30 px-1.5 py-0.5 text-muted-foreground" data-testid={`assembly-group-count-${category}`}>
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3" data-testid={`assembly-group-note-${category}`}>{info.note}</p>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-background/20 hover:bg-background/40 transition-colors" data-testid={`assembly-item-${item.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          {item._isEsd && (
                            <StyledTooltip content="ESD Sensitive — Handle with anti-static precautions. Use ESD wrist strap and grounded work surface." side="right">
                              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`esd-badge-assembly-${item.id}`} />
                            </StyledTooltip>
                          )}
                          <span className="font-mono font-medium text-foreground truncate">{item.partNumber}</span>
                          <span className="text-muted-foreground truncate hidden sm:inline">{item.description}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-muted-foreground">x{item.quantity}</span>
                          <span className="font-mono text-foreground">${Number(item.totalPrice).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile/tablet card layout */}
        <div className="lg:hidden space-y-2" data-testid="bom-cards">
          {filteredBom.map((item) => (
            <div key={item.id} className="border border-border bg-card/80 backdrop-blur p-3 space-y-2" data-testid={`card-bom-${item.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {item._isEsd && (
                    <StyledTooltip content="ESD Sensitive — Handle with anti-static precautions. Use ESD wrist strap and grounded work surface." side="right">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`esd-badge-card-${item.id}`} />
                    </StyledTooltip>
                  )}
                  <div className="min-w-0">
                    <div className="font-mono font-medium text-foreground text-xs truncate">{item.partNumber}</div>
                    <div className="text-muted-foreground text-xs truncate">{item.manufacturer}</div>
                  </div>
                </div>
                <span className={cn("shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border uppercase tracking-wide",
                  item.status === 'In Stock'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : item.status === 'Low Stock'
                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                )}>
                  {item.status === 'In Stock' && <CheckCircle2 className="w-3 h-3" />}
                  {item.status === 'Low Stock' && <AlertCircle className="w-3 h-3" />}
                  {item.status === 'Out of Stock' && <XCircle className="w-3 h-3" />}
                  {item.status}
                </span>
              </div>
              {item.description && <div className="text-muted-foreground text-xs truncate">{item.description}</div>}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>Qty: <span className="font-mono text-foreground">{item.quantity}</span></span>
                  <span>@ <span className="font-mono text-foreground">${Number(item.unitPrice).toFixed(2)}</span></span>
                  <span>{item.supplier}</span>
                </div>
                <span className="font-mono font-bold text-foreground">${Number(item.totalPrice).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 pt-1 border-t border-border">
                <button
                  aria-label="Add to cart"
                  className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                  onClick={() => {
                    const baseUrl = getSupplierSearchUrl(item.supplier);
                    if (!baseUrl) return;
                    window.open(baseUrl + encodeURIComponent(item.partNumber), '_blank', 'noopener,noreferrer');
                  }}
                  data-testid={`card-button-cart-${item.id}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                </button>
                <button
                  aria-label="Copy part number"
                  className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-muted-foreground hover:bg-muted/30 transition-colors"
                  onClick={() => { copyToClipboard(item.partNumber); toast({ title: 'Copied', description: 'Part number copied.' }); }}
                  data-testid={`card-button-copy-${item.id}`}
                >
                  <Copy className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <ConfirmDialog
                  trigger={
                    <button aria-label="Delete item" className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors" data-testid={`card-button-delete-${item.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  }
                  title="Remove BOM Item"
                  description={`Remove "${item.partNumber}" from the Bill of Materials?`}
                  confirmLabel="Remove"
                  variant="destructive"
                  onConfirm={() => deleteBomItem(item.id)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table layout — virtualized */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
          <VirtualizedBomTable
            filteredBom={filteredBom}
            editingId={editingId}
            editValues={editValues}
            setEditValues={setEditValues}
            handleEditKeyDown={handleEditKeyDown}
            saveEdit={saveEdit}
            cancelEdit={cancelEdit}
            startEdit={startEdit}
            deleteBomItem={deleteBomItem}
            addOutputLog={addOutputLog}
            getSupplierSearchUrl={getSupplierSearchUrl}
            copyToClipboard={copyToClipboard}
            toast={toast}
            highlightedItemId={highlightedItemId}
            handleHighlightItem={handleHighlightItem}
          />
        </DndContext>
        {filteredBom.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="empty-state-bom">
            <Package className="w-12 h-12 mb-4 opacity-30" />
            {searchTerm ? (
              <>
                <p className="text-sm font-medium text-foreground">No matching components</p>
                <p className="text-xs mt-1">No BOM items match "{searchTerm}". Try a different search term.</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-3 px-4 py-1.5 text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                  data-testid="button-clear-search"
                >
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No items in your Bill of Materials</p>
                <p className="text-xs mt-1 max-w-sm text-center">
                  Add your first component manually, or use AI chat to populate the BOM from your architecture.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => { resetNewItem(); setShowAddItemDialog(true); }}
                    className="px-4 py-1.5 text-xs border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    data-testid="button-add-first-item"
                  >
                    <Plus className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                    Add First Item
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-4 border border-border bg-card/80 backdrop-blur shadow-sm" data-testid="panel-component-reference">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            onClick={() => setShowComponentRef(!showComponentRef)}
            data-testid="button-toggle-component-ref"
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Component Parts Reference</span>
              {componentParts && componentParts.length > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 font-mono" data-testid="text-component-count">
                  {componentParts.length}
                </span>
              )}
            </div>
            {showComponentRef ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showComponentRef && (
            <div className="border-t border-border animate-in slide-in-from-top-1" data-testid="panel-component-ref-content">
              {partsLoading ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading component parts…</div>
              ) : !componentParts || componentParts.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No component parts defined</p>
                  <p className="text-xs mt-1">Create parts in the Component Editor to see them here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left min-w-[600px]" data-testid="table-component-parts">
                    <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-2">Title</th>
                        <th className="px-4 py-2">Manufacturer</th>
                        <th className="px-4 py-2">MPN</th>
                        <th className="px-4 py-2">Package</th>
                        <th className="px-4 py-2">Mounting</th>
                        <th className="px-4 py-2 w-48">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {componentParts.map((part) => {
                        const meta = (part.meta || {}) as PartMeta;
                        return (
                          <tr key={part.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-component-part-${part.id}`}>
                            <td className="px-4 py-2 font-medium text-foreground text-xs" data-testid={`text-part-title-${part.id}`}>
                              {meta.title || '—'}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs" data-testid={`text-part-manufacturer-${part.id}`}>
                              {meta.manufacturer || '—'}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-foreground" data-testid={`text-part-mpn-${part.id}`}>
                              {meta.mpn || '—'}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs" data-testid={`text-part-package-${part.id}`}>
                              {meta.packageType || '—'}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs" data-testid={`text-part-mounting-${part.id}`}>
                              {meta.mountingType || '—'}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs max-w-[12rem] truncate" data-testid={`text-part-description-${part.id}`}>
                              {meta.description || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="bg-card border-border sm:max-w-md" data-testid="dialog-add-bom-item">
          <DialogHeader>
            <DialogTitle>Add BOM Item</DialogTitle>
            <DialogDescription>Enter the component details to add to your Bill of Materials.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-part-number">Part Number <span className="text-destructive">*</span></Label>
              <Input
                id="add-part-number"
                placeholder="e.g. STM32F407VGT6"
                value={newItem.partNumber}
                onChange={(e) => setNewItem(prev => ({ ...prev, partNumber: e.target.value }))}
                data-testid="input-add-part-number"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-manufacturer">Manufacturer</Label>
                <Input
                  id="add-manufacturer"
                  placeholder="e.g. STMicroelectronics"
                  value={newItem.manufacturer}
                  onChange={(e) => setNewItem(prev => ({ ...prev, manufacturer: e.target.value }))}
                  data-testid="input-add-manufacturer"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-supplier">Supplier</Label>
                <Select value={newItem.supplier} onValueChange={(v) => setNewItem(prev => ({ ...prev, supplier: v }))}>
                  <SelectTrigger id="add-supplier" data-testid="select-add-supplier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Digi-Key">Digi-Key</SelectItem>
                    <SelectItem value="Mouser">Mouser</SelectItem>
                    <SelectItem value="LCSC">LCSC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-description">Description</Label>
              <Input
                id="add-description"
                placeholder="e.g. ARM Cortex-M4 MCU, 1MB Flash, 168MHz"
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                data-testid="input-add-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-quantity">Quantity</Label>
                <Input
                  id="add-quantity"
                  type="number"
                  min={1}
                  max={999999}
                  value={newItem.quantity}
                  onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  data-testid="input-add-quantity"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-unit-price">Unit Price ($)</Label>
                <Input
                  id="add-unit-price"
                  type="number"
                  min={0}
                  max={99999.99}
                  step={0.01}
                  value={newItem.unitPrice}
                  onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-add-unit-price"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)} data-testid="button-cancel-add-item">Cancel</Button>
            <Button onClick={handleAddItem} data-testid="button-confirm-add-item">
              <Plus className="w-4 h-4 mr-2" />
              Add to BOM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>

      <TabsContent value="comparison" className="flex-1 overflow-hidden mt-0">
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Loading comparison...</div>}>
          <BomDiffPanel />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}

const BOM_ROW_HEIGHT = 48;

type EnrichedBomItem = BomItem & { _isEsd: boolean; _assemblyCategory: AssemblyCategory | null };

function VirtualizedBomTable({
  filteredBom, editingId, editValues, setEditValues, handleEditKeyDown, saveEdit, cancelEdit, startEdit, deleteBomItem, addOutputLog, getSupplierSearchUrl, copyToClipboard, toast, highlightedItemId, handleHighlightItem,
}: {
  filteredBom: EnrichedBomItem[];
  editingId: number | null;
  editValues: { partNumber: string; manufacturer: string; description: string; quantity: number; unitPrice: number; supplier: string };
  setEditValues: React.Dispatch<React.SetStateAction<typeof editValues>>;
  handleEditKeyDown: (e: React.KeyboardEvent) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  startEdit: (item: EnrichedBomItem) => void;
  deleteBomItem: (id: number | string) => void;
  addOutputLog: (msg: string) => void;
  getSupplierSearchUrl: (supplier: string) => string | null;
  copyToClipboard: (text: string) => Promise<boolean>;
  toast: ReturnType<typeof import('@/hooks/use-toast').useToast>['toast'];
  highlightedItemId: number | null;
  handleHighlightItem: (id: number) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredBom.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => BOM_ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="hidden lg:block border border-border overflow-hidden bg-card/80 backdrop-blur shadow-sm">
      <table aria-label="Bill of Materials" className="w-full text-sm text-left min-w-[800px]" data-testid="table-bom">
        <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
          <tr>
            <th className="w-8 px-1 py-3"><StyledTooltip content="Drag to reorder" side="right"><ArrowUpDown className="w-3 h-3 mx-auto" /></StyledTooltip></th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Part Number</th>
            <th className="px-4 py-3">Manufacturer</th>
            <th className="px-4 py-3 w-64">Description</th>
            <th className="px-4 py-3">Supplier</th>
            <th className="px-4 py-3 text-right">Stock</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Unit Price</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
      </table>
      <div ref={parentRef} className="overflow-auto max-h-[calc(100vh-20rem)]" style={{ contain: 'strict' }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          <table className="w-full text-sm text-left min-w-[800px]" style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
            <SortableContext items={filteredBom.map(item => Number(item.id))} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-border" style={{ transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)` }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filteredBom[virtualRow.index];
                  return (
                    <SortableBomRow key={item.id} item={item} editingId={editingId} editValues={editValues} setEditValues={setEditValues} handleEditKeyDown={handleEditKeyDown} saveEdit={saveEdit} cancelEdit={cancelEdit} startEdit={startEdit} deleteBomItem={deleteBomItem} addOutputLog={addOutputLog} getSupplierSearchUrl={getSupplierSearchUrl} copyToClipboard={copyToClipboard} toast={toast} highlighted={highlightedItemId === Number(item.id)} onHighlight={handleHighlightItem} />
                  );
                })}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </div>
    </div>
  );
}

function SortableBomRow({ item, editingId, editValues, setEditValues, handleEditKeyDown, saveEdit, cancelEdit, startEdit, deleteBomItem, addOutputLog, getSupplierSearchUrl: getUrl, copyToClipboard: copy, toast: t, highlighted, onHighlight }: {
  item: EnrichedBomItem;
  editingId: number | null;
  editValues: { partNumber: string; manufacturer: string; description: string; quantity: number; unitPrice: number; supplier: string };
  setEditValues: React.Dispatch<React.SetStateAction<typeof editValues>>;
  handleEditKeyDown: (e: React.KeyboardEvent) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  startEdit: (item: EnrichedBomItem) => void;
  deleteBomItem: (id: number | string) => void;
  addOutputLog: (msg: string) => void;
  getSupplierSearchUrl: (supplier: string) => string | null;
  copyToClipboard: (text: string) => Promise<boolean>;
  toast: ReturnType<typeof import('@/hooks/use-toast').useToast>['toast'];
  highlighted: boolean;
  onHighlight: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: Number(item.id) });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isEditing = editingId === Number(item.id);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <tr
          ref={setNodeRef}
          style={style}
          className={cn(
            "hover:bg-muted/30 transition-colors group cursor-pointer",
            isEditing && "bg-primary/10 ring-1 ring-inset ring-primary/40",
            highlighted && "ring-1 ring-inset ring-[#00F0FF]/60 bg-[#00F0FF]/5 animate-pulse",
          )}
          data-testid={`row-bom-${item.id}`}
          data-bom-item-highlight={highlighted ? "true" : undefined}
          onClick={() => onHighlight(Number(item.id))}
        >
          <td className="w-8 px-1 py-3 text-center">
            {isEditing ? (
              <Pencil className="w-3.5 h-3.5 text-primary mx-auto animate-pulse" data-testid={`edit-indicator-${item.id}`} />
            ) : (
              <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`drag-handle-${item.id}`} aria-label="Drag to reorder">
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
          </td>
          <td className="px-4 py-3">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border uppercase tracking-wide",
              item.status === 'In Stock' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : item.status === 'Low Stock' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                : 'bg-destructive/10 text-destructive border-destructive/20'
            )} data-testid={`status-bom-${item.id}`}>
              {item.status === 'In Stock' && <CheckCircle2 className="w-3 h-3" />}
              {item.status === 'Low Stock' && <AlertCircle className="w-3 h-3" />}
              {item.status === 'Out of Stock' && <XCircle className="w-3 h-3" />}
              {item.status}
            </span>
          </td>
          {isEditing ? (
            <>
              <td className="px-4 py-1"><input data-testid={`edit-part-number-${item.id}`} className="w-full bg-primary/5 border border-primary/30 px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary" value={editValues.partNumber} onChange={e => setEditValues(v => ({ ...v, partNumber: e.target.value }))} onKeyDown={handleEditKeyDown} autoFocus /></td>
              <td className="px-4 py-1"><input data-testid={`edit-manufacturer-${item.id}`} className="w-full bg-primary/5 border border-primary/30 px-2 py-1 text-xs focus:outline-none focus:border-primary" value={editValues.manufacturer} onChange={e => setEditValues(v => ({ ...v, manufacturer: e.target.value }))} onKeyDown={handleEditKeyDown} /></td>
              <td className="px-4 py-1"><input data-testid={`edit-description-${item.id}`} className="w-full bg-primary/5 border border-primary/30 px-2 py-1 text-xs focus:outline-none focus:border-primary" value={editValues.description} onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))} onKeyDown={handleEditKeyDown} /></td>
              <td className="px-4 py-1">
                <select data-testid={`edit-supplier-${item.id}`} className="w-full bg-primary/5 border border-primary/30 px-2 py-1 text-xs focus:outline-none focus:border-primary" value={editValues.supplier} onChange={e => setEditValues(v => ({ ...v, supplier: e.target.value }))} onKeyDown={handleEditKeyDown}>
                  <option value="Digi-Key">Digi-Key</option><option value="Mouser">Mouser</option><option value="LCSC">LCSC</option>
                </select>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">{item.stock.toLocaleString()}</td>
              <td className="px-4 py-1"><input data-testid={`edit-quantity-${item.id}`} type="number" min={1} max={999999} className="w-16 bg-primary/5 border border-primary/30 px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-primary" value={editValues.quantity} onChange={e => setEditValues(v => ({ ...v, quantity: parseInt(e.target.value) || 1 }))} onKeyDown={handleEditKeyDown} /></td>
              <td className="px-4 py-1"><input data-testid={`edit-unit-price-${item.id}`} type="number" min={0} max={99999.99} step={0.01} className="w-24 bg-primary/5 border border-primary/30 px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-primary" value={editValues.unitPrice} onChange={e => setEditValues(v => ({ ...v, unitPrice: parseFloat(e.target.value) || 0 }))} onKeyDown={handleEditKeyDown} /></td>
              <td className="px-4 py-3 text-right font-mono text-xs font-bold text-foreground">${(editValues.quantity * editValues.unitPrice).toFixed(2)}</td>
              <td className="px-4 py-3 text-right flex gap-1">
                <StyledTooltip content="Save changes" side="left"><button aria-label="Save changes" className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 transition-colors" onClick={saveEdit} data-testid={`button-save-${item.id}`}><Check className="w-4 h-4" /></button></StyledTooltip>
                <StyledTooltip content="Cancel editing" side="left"><button aria-label="Cancel editing" className="p-1.5 text-muted-foreground hover:bg-muted/30 transition-colors" onClick={cancelEdit} data-testid={`button-cancel-edit-${item.id}`}><X className="w-4 h-4" /></button></StyledTooltip>
              </td>
            </>
          ) : (
            <>
              <td className="px-4 py-3 font-mono font-medium text-foreground text-xs" data-testid={`text-part-number-${item.id}`}>
                <span className="inline-flex items-center gap-1.5">
                  {item._isEsd && (
                    <StyledTooltip content="ESD Sensitive — Handle with anti-static precautions. Use ESD wrist strap and grounded work surface." side="right">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`esd-badge-${item.id}`} />
                    </StyledTooltip>
                  )}
                  {item.partNumber}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground" data-testid={`text-manufacturer-${item.id}`}>{item.manufacturer}</td>
              <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" data-testid={`text-description-${item.id}`}>{item.description}</td>
              <td className="px-4 py-3 text-muted-foreground" data-testid={`text-supplier-${item.id}`}>{item.supplier}</td>
              <td className="px-4 py-3 text-right font-mono text-xs" data-testid={`text-stock-${item.id}`}>{item.stock.toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-mono text-xs" data-testid={`text-quantity-${item.id}`}>{item.quantity}</td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground" data-testid={`text-unit-price-${item.id}`}>${Number(item.unitPrice).toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-mono text-xs font-bold text-foreground" data-testid={`text-total-price-${item.id}`}>${Number(item.totalPrice).toFixed(2)}</td>
              <td className="px-4 py-3 text-right flex gap-1">
                <StyledTooltip content="Edit item" side="left"><button aria-label="Edit item" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEdit(item)} data-testid={`button-edit-${item.id}`}><Pencil className="w-4 h-4" /></button></StyledTooltip>
                <StyledTooltip content="Buy from supplier" side="left">
                  <button aria-label="Add to cart" className="p-1.5 text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { const baseUrl = getUrl(item.supplier); if (!baseUrl) return; window.open(baseUrl + encodeURIComponent(item.partNumber), '_blank', 'noopener,noreferrer'); }} data-testid={`button-cart-${item.id}`}><ShoppingCart className="w-4 h-4" /></button>
                </StyledTooltip>
                <ConfirmDialog
                  trigger={<StyledTooltip content="Remove from BOM" side="left"><button aria-label="Delete item" className="p-1.5 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-delete-${item.id}`}><Trash2 className="w-4 h-4" /></button></StyledTooltip>}
                  title="Remove BOM Item"
                  description={`Are you sure you want to remove "${item.partNumber}" from the Bill of Materials? This action cannot be undone.`}
                  confirmLabel="Remove"
                  variant="destructive"
                  onConfirm={() => deleteBomItem(item.id)}
                />
              </td>
            </>
          )}
        </tr>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
        <ContextMenuItem onSelect={() => { copy(JSON.stringify(item, null, 2)); addOutputLog('[BOM] Copied details: ' + item.partNumber); }}>Copy Details</ContextMenuItem>
        <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(item.partNumber + ' ' + item.manufacturer + ' datasheet'), '_blank', 'noopener,noreferrer')}>Search Datasheet</ContextMenuItem>
        <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(item.partNumber + ' alternative equivalent'), '_blank', 'noopener,noreferrer')}>Find Alternatives</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => { const baseUrl = getUrl(item.supplier); if (!baseUrl) return; window.open(baseUrl + encodeURIComponent(item.partNumber), '_blank', 'noopener,noreferrer'); }}>Buy from {item.supplier}</ContextMenuItem>
        <ContextMenuItem onSelect={() => copy(item.partNumber)}>Copy Part Number</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onSelect={() => deleteBomItem(item.id)}>Remove from BOM</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default memo(ProcurementView);
