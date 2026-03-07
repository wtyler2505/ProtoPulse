import { useState, useMemo, useCallback, useRef, memo, lazy, Suspense } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useOutput } from '@/lib/contexts/output-context';
import { Package, RefreshCw, Store, GitCompareArrows } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useComponentParts } from '@/lib/component-editor/hooks';
import type { BomItem } from '@/lib/project-context';
import { STORAGE_KEYS, DEFAULT_PREFERRED_SUPPLIERS, OPTIMIZATION_GOALS } from '@/lib/constants';
import { buildCSV, downloadBlob } from '@/lib/csv';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAlternateParts } from '@/lib/alternate-parts';
import { useSupplierApi } from '@/lib/supplier-api';
import { useDamageAssessment } from '@/lib/damage-assessment';
import type { AlternatePart } from '@/lib/alternate-parts';
import type { BomQuote } from '@/lib/supplier-api';
import type { DamageReport, DamageObservation, ComponentType } from '@/lib/damage-assessment';
import {
  BomToolbar,
  BomSettings,
  CostSummary,
  AssemblyGroups,
  BomCards,
  BomTable,
  AlternatePartsPanel,
  SupplierPricingPanel,
  DamageAssessmentPanel,
  AddItemDialog,
  ComponentReference,
  BomEmptyState,
  detectEsdSensitivity,
  detectAssemblyCategory,
} from './procurement';
import type { AssemblyCategory, EnrichedBomItem, EditValues, NewItemValues, CostBreakdown } from './procurement';

const BomDiffPanel = lazy(() => import('@/components/views/BomDiffPanel'));

function ProcurementView() {
  const { bom, bomSettings, setBomSettings, addBomItem, deleteBomItem, updateBomItem } = useBom();
  const { addOutputLog } = useOutput();
  const { toast } = useToast();
  const projectId = useProjectId();
  const { data: componentParts, isLoading: partsLoading } = useComponentParts(projectId);

  // ── Previous BOM cost (for cost delta indicator) ──
  // Read from localStorage — populated when user takes a BOM snapshot via the
  // BOM Comparison tab. No network requests needed.
  const previousTotalCost = useMemo(() => {
    try {
      const raw = localStorage.getItem(`protopulse:bom-snapshot-cost:${String(projectId)}`);
      if (raw) {
        const val = Number(raw);
        if (!Number.isNaN(val)) { return val; }
      }
    } catch { /* ignore */ }
    return undefined;
  }, [projectId]);

  // ── UI state ──
  const [showSettings, setShowSettings] = useState(false);
  const [showComponentRef, setShowComponentRef] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
  const [esdFilterOnly, setEsdFilterOnly] = useState(false);
  const [showAssemblyGroups, setShowAssemblyGroups] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showSupplierEdit, setShowSupplierEdit] = useState(false);

  // ── Alternate parts ──
  const { findAlternates } = useAlternateParts();
  const [altSearchPartNumber, setAltSearchPartNumber] = useState('');
  const [altResults, setAltResults] = useState<AlternatePart[]>([]);
  const [altSearching, setAltSearching] = useState(false);

  // ── Supplier pricing ──
  const { searchPart, quoteBom, distributors, currency } = useSupplierApi();
  const [bomQuote, setBomQuote] = useState<BomQuote | null>(null);
  const [pricingSearching, setPricingSearching] = useState(false);
  const [pricingPartMpn, setPricingPartMpn] = useState('');

  // ── Damage assessment ──
  const { assess: assessDamage } = useDamageAssessment();
  const [damageDialogItem, setDamageDialogItem] = useState<BomItem | null>(null);
  const [damageComponentType, setDamageComponentType] = useState<ComponentType>('generic');
  const [damageObservations, setDamageObservations] = useState<DamageObservation[]>([]);
  const [currentDamageReport, setCurrentDamageReport] = useState<DamageReport | null>(null);

  // ── Optimization / suppliers ──
  const [optimizationGoal, setOptimizationGoal] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OPTIMIZATION_GOAL);
      if (stored && Object.hasOwn(OPTIMIZATION_GOALS, stored)) { return stored; }
    } catch { /* fall through */ }
    return 'Cost';
  });
  const [preferredSuppliers, setPreferredSuppliers] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERRED_SUPPLIERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) { return parsed; }
      }
    } catch { /* fall through */ }
    return { ...DEFAULT_PREFERRED_SUPPLIERS };
  });

  // ── Inline editing ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ partNumber: '', manufacturer: '', description: '', quantity: 1, unitPrice: 0, supplier: 'Digi-Key' });

  // ── Add item ──
  const defaultNewItem: NewItemValues = { partNumber: '', manufacturer: '', description: '', quantity: 1, unitPrice: 0, supplier: 'Digi-Key' };
  const [newItem, setNewItem] = useState<NewItemValues>(defaultNewItem);

  // ── Sort order (DnD) ──
  const [sortOrder, setSortOrder] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BOM_SORT_ORDER);
      if (stored) { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) { return parsed; } }
    } catch { /* fall through */ }
    return [];
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Highlight timer ──
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHighlightItem = useCallback((id: number) => {
    if (highlightTimer.current) { clearTimeout(highlightTimer.current); }
    setHighlightedItemId(id);
    highlightTimer.current = setTimeout(() => setHighlightedItemId(null), 1500);
  }, []);

  // ── Enriched + filtered BOM ──
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
    if (esdFilterOnly) { filtered = filtered.filter(item => item._isEsd); }
    if (sortOrder.length === 0) { return filtered; }
    const orderMap = new Map(sortOrder.map((id, idx) => [id, idx]));
    return [...filtered].sort((a, b) => {
      const aIdx = orderMap.get(Number(a.id)) ?? Number.MAX_SAFE_INTEGER;
      const bIdx = orderMap.get(Number(b.id)) ?? Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
  }, [enrichedBom, searchTerm, esdFilterOnly, sortOrder]);

  const assemblyGroups = useMemo(() => {
    const groups: Record<string, EnrichedBomItem[]> = { smt: [], through_hole: [], hand_solder: [], mechanical: [], unassigned: [] };
    for (const item of enrichedBom) { groups[item._assemblyCategory ?? 'unassigned'].push(item); }
    return groups;
  }, [enrichedBom]);

  const esdCount = useMemo(() => enrichedBom.filter(i => i._isEsd).length, [enrichedBom]);
  const totalCost = filteredBom.reduce((acc, item) => acc + Number(item.totalPrice), 0);

  const costBreakdown = useMemo((): CostBreakdown => {
    const statusCategories: Record<string, { total: number; count: number; color: string }> = {
      'In Stock': { total: 0, count: 0, color: 'bg-emerald-500' },
      'Low Stock': { total: 0, count: 0, color: 'bg-yellow-500' },
      'Out of Stock': { total: 0, count: 0, color: 'bg-destructive' },
      'On Order': { total: 0, count: 0, color: 'bg-blue-500' },
    };
    for (const item of bom) {
      const cat = statusCategories[item.status];
      if (cat) { cat.total += Number(item.totalPrice); cat.count += 1; }
    }
    const avgUnitCost = bom.length > 0 ? bom.reduce((sum, item) => sum + Number(item.unitPrice), 0) / bom.length : 0;
    const totalBomCost = bom.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const topItems = [...bom].sort((a, b) => Number(b.totalPrice) - Number(a.totalPrice)).slice(0, 5);
    const maxItemCost = topItems.length > 0 ? Number(topItems[0].totalPrice) : 0;
    return { statusCategories, avgUnitCost, totalBomCost, topItems, maxItemCost };
  }, [bom]);

  // ── Callbacks ──
  const saveSortOrder = useCallback((order: number[]) => {
    setSortOrder(order);
    try { localStorage.setItem(STORAGE_KEYS.BOM_SORT_ORDER, JSON.stringify(order)); } catch { /* quota */ }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) { return; }
    const oldIndex = filteredBom.findIndex(item => Number(item.id) === active.id);
    const newIndex = filteredBom.findIndex(item => Number(item.id) === over.id);
    if (oldIndex === -1 || newIndex === -1) { return; }
    const reordered = arrayMove(filteredBom, oldIndex, newIndex);
    saveSortOrder(reordered.map(item => Number(item.id)));
    toast({ title: 'Reordered', description: 'BOM item order updated.' });
  }, [filteredBom, saveSortOrder, toast]);

  const handleExportCSV = useCallback(() => {
    try {
      const headers = ['Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Supplier', 'Stock', 'Status'];
      const rows = filteredBom.map(item => [
        item.partNumber, item.manufacturer, item.description, item.quantity,
        Number(item.unitPrice).toFixed(2), Number(item.totalPrice).toFixed(2), item.supplier, item.stock, item.status,
      ]);
      const csv = buildCSV(headers, rows);
      downloadBlob(new Blob([csv], { type: 'text/csv' }), 'bom_export.csv');
      toast({ title: 'Export Complete', description: 'BOM exported as CSV file.' });
    } catch (err) {
      console.warn('Export failed:', err);
      toast({ title: 'Export Failed', description: 'Could not export CSV. Please try again.', variant: 'destructive' });
    }
  }, [filteredBom, toast]);

  const startEdit = useCallback((item: BomItem) => {
    setEditingId(Number(item.id));
    setEditValues({ partNumber: item.partNumber, manufacturer: item.manufacturer, description: item.description, quantity: item.quantity, unitPrice: Math.round(Number(item.unitPrice) * 100) / 100, supplier: item.supplier });
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId === null) { return; }
    updateBomItem(editingId, { partNumber: editValues.partNumber.trim(), manufacturer: editValues.manufacturer.trim() || 'Unknown', description: editValues.description.trim(), quantity: Math.max(1, editValues.quantity), unitPrice: Math.max(0, editValues.unitPrice), supplier: editValues.supplier as 'Digi-Key' | 'Mouser' | 'LCSC' | 'Unknown' });
    toast({ title: 'Item Updated', description: `Updated "${editValues.partNumber.trim()}"` });
    setEditingId(null);
  }, [editingId, editValues, updateBomItem, toast]);

  const cancelEdit = useCallback(() => { setEditingId(null); }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }, [saveEdit, cancelEdit]);

  const handleAddItem = useCallback(() => {
    if (!newItem.partNumber.trim()) {
      toast({ title: 'Missing Part Number', description: 'Please enter a part number.', variant: 'destructive' });
      return;
    }
    addBomItem({ partNumber: newItem.partNumber.trim(), manufacturer: newItem.manufacturer.trim() || 'Unknown', description: newItem.description.trim() || '', quantity: Math.max(1, newItem.quantity), unitPrice: Math.max(0, newItem.unitPrice), totalPrice: 0, supplier: newItem.supplier as 'Digi-Key' | 'Mouser' | 'LCSC' | 'Unknown', stock: 0, status: 'Out of Stock' });
    toast({ title: 'Item Added', description: `Added "${newItem.partNumber.trim()}" to the BOM.` });
    setNewItem({ ...defaultNewItem });
    setShowAddItemDialog(false);
  }, [newItem, addBomItem, toast, defaultNewItem]);

  const handleFindAlternates = useCallback((partNumber: string) => {
    setAltSearching(true);
    try { setAltResults(findAlternates(partNumber).alternates); } finally { setAltSearching(false); }
  }, [findAlternates]);

  const handleQuoteBom = useCallback(() => {
    setPricingSearching(true);
    try { setBomQuote(quoteBom(bom.map((item) => ({ mpn: item.partNumber, quantity: item.quantity })))); } finally { setPricingSearching(false); }
  }, [bom, quoteBom]);

  const handleSearchPartPricing = useCallback((mpn: string) => {
    setPricingSearching(true);
    try { searchPart(mpn); setPricingPartMpn(mpn); } finally { setPricingSearching(false); }
  }, [searchPart]);

  const handleOpenDamageDialog = useCallback((item: BomItem) => {
    setDamageDialogItem(item);
    setDamageComponentType('generic');
    setDamageObservations([]);
    setCurrentDamageReport(null);
  }, []);

  const handleRunDamageAssessment = useCallback(() => {
    if (!damageDialogItem) { return; }
    setCurrentDamageReport(assessDamage(damageComponentType, damageObservations));
  }, [damageDialogItem, damageComponentType, damageObservations, assessDamage]);

  const updateOptimizationGoal = useCallback((goal: string) => {
    setOptimizationGoal(goal);
    try { localStorage.setItem(STORAGE_KEYS.OPTIMIZATION_GOAL, goal); } catch { /* quota */ }
  }, []);

  const updatePreferredSuppliers = useCallback((updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    setPreferredSuppliers(prev => {
      const next = updater(prev);
      try { localStorage.setItem(STORAGE_KEYS.PREFERRED_SUPPLIERS, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const resetAndShowAddDialog = useCallback(() => { setNewItem({ ...defaultNewItem }); setShowAddItemDialog(true); }, [defaultNewItem]);

  // ── Render ──
  return (
    <Tabs defaultValue="management" className="h-full flex flex-col bg-background/50" data-testid="procurement-view">
      <div className="px-4 pt-3 pb-0 border-b border-border bg-card/30 backdrop-blur">
        <TabsList className="mb-3" data-testid="procurement-tabs">
          <TabsTrigger value="management" data-testid="tab-bom-management"><Package className="h-4 w-4 mr-1.5" />BOM Management</TabsTrigger>
          <TabsTrigger value="comparison" data-testid="tab-bom-comparison"><GitCompareArrows className="h-4 w-4 mr-1.5" />BOM Comparison</TabsTrigger>
          <TabsTrigger value="alternates" data-testid="tab-alternates"><RefreshCw className="h-4 w-4 mr-1.5" />Alternates</TabsTrigger>
          <TabsTrigger value="pricing" data-testid="tab-live-pricing"><Store className="h-4 w-4 mr-1.5" />Live Pricing</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="management" className="flex-1 flex flex-col overflow-hidden mt-0">
        <BomToolbar searchTerm={searchTerm} onSearchChange={setSearchTerm} showSettings={showSettings} onToggleSettings={() => setShowSettings(!showSettings)} esdFilterOnly={esdFilterOnly} onToggleEsdFilter={() => setEsdFilterOnly(!esdFilterOnly)} esdCount={esdCount} showAssemblyGroups={showAssemblyGroups} onToggleAssemblyGroups={() => setShowAssemblyGroups(!showAssemblyGroups)} onAddItem={resetAndShowAddDialog} totalCost={totalCost} onExportCSV={handleExportCSV} />
        {showSettings && <BomSettings bomSettings={bomSettings} onBomSettingsChange={setBomSettings} optimizationGoal={optimizationGoal} onOptimizationGoalChange={updateOptimizationGoal} preferredSuppliers={preferredSuppliers} onPreferredSuppliersChange={updatePreferredSuppliers} showSupplierEdit={showSupplierEdit} onToggleSupplierEdit={() => setShowSupplierEdit(!showSupplierEdit)} />}

        <div className="flex-1 overflow-auto p-3 lg:p-6">
          {bom.length > 0 && <CostSummary costBreakdown={costBreakdown} previousTotalCost={previousTotalCost} />}
          {showAssemblyGroups && enrichedBom.length > 0 && <AssemblyGroups assemblyGroups={assemblyGroups} />}
          <BomCards filteredBom={filteredBom} deleteBomItem={deleteBomItem} toast={toast} />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <BomTable filteredBom={filteredBom} editingId={editingId} editValues={editValues} setEditValues={setEditValues} handleEditKeyDown={handleEditKeyDown} saveEdit={saveEdit} cancelEdit={cancelEdit} startEdit={startEdit} deleteBomItem={deleteBomItem} addOutputLog={addOutputLog} toast={toast} highlightedItemId={highlightedItemId} handleHighlightItem={handleHighlightItem} onAssessDamage={handleOpenDamageDialog} onFindAlternates={handleFindAlternates} />
          </DndContext>
          {filteredBom.length === 0 && <BomEmptyState searchTerm={searchTerm} onClearSearch={() => setSearchTerm('')} onAddItem={resetAndShowAddDialog} />}
          <ComponentReference showComponentRef={showComponentRef} onToggleComponentRef={() => setShowComponentRef(!showComponentRef)} componentParts={componentParts} partsLoading={partsLoading} />
        </div>

        <AddItemDialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog} newItem={newItem} onNewItemChange={setNewItem} onAddItem={handleAddItem} />
      </TabsContent>

      <TabsContent value="comparison" className="flex-1 overflow-hidden mt-0">
        <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Loading comparison...</div>}>
          <BomDiffPanel />
        </Suspense>
      </TabsContent>

      <TabsContent value="alternates" className="flex-1 overflow-auto mt-0 p-4 space-y-4">
        <AlternatePartsPanel bom={bom} altSearchPartNumber={altSearchPartNumber} onAltSearchChange={setAltSearchPartNumber} altResults={altResults} altSearching={altSearching} onFindAlternates={handleFindAlternates} />
      </TabsContent>

      <TabsContent value="pricing" className="flex-1 overflow-auto mt-0 p-4 space-y-4">
        <SupplierPricingPanel bom={bom} bomQuote={bomQuote} pricingSearching={pricingSearching} pricingPartMpn={pricingPartMpn} onPricingPartMpnChange={setPricingPartMpn} onQuoteBom={handleQuoteBom} onSearchPartPricing={handleSearchPartPricing} distributors={distributors} currency={currency} />
      </TabsContent>

      <DamageAssessmentPanel damageDialogItem={damageDialogItem} onClose={() => setDamageDialogItem(null)} damageComponentType={damageComponentType} onComponentTypeChange={setDamageComponentType} damageObservations={damageObservations} onObservationsChange={setDamageObservations} currentDamageReport={currentDamageReport} onRunAssessment={handleRunDamageAssessment} />
    </Tabs>
  );
}

export default memo(ProcurementView);
