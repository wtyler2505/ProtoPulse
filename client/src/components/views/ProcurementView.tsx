import { useState, useMemo, useCallback, useRef, useEffect, memo, lazy, Suspense } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useArchitecture, useBom, useOutput, useProjectId, useProjectMeta } from '@/lib/project-context';
import { Scale, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { useCircuitDesigns, useCircuitInstances } from '@/lib/circuit-editor/hooks';
import { useBomShortfalls, indexShortfallsByPartNumber } from '@/lib/parts/use-bom-shortfalls';
import type { BomItem } from '@/lib/project-context';
import type { ProjectExportData } from '@/lib/export-validation';
import { runExportPrecheck, type ExportPrecheck } from '@/lib/export-precheck';
import { buildValidationSafetyGateData } from '@/lib/validation-safety-gates';
import { STORAGE_KEYS, DEFAULT_PREFERRED_SUPPLIERS, OPTIMIZATION_GOALS } from '@/lib/constants';
import { classifyLifecycle } from '@/lib/lifecycle-badges';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { Badge } from '@/components/ui/badge';
import { copyToClipboard } from '@/lib/clipboard';
import { buildCSV, downloadBlob } from '@/lib/csv';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAlternateParts } from '@/lib/alternate-parts';
import { useSupplierApi } from '@/lib/supplier-api';
import { useDamageAssessment } from '@/lib/damage-assessment';
import type { AlternatePart } from '@/lib/alternate-parts';
import type { BomQuote } from '@/lib/supplier-api';
import type { DamageReport, DamageObservation, ComponentType } from '@/lib/damage-assessment';
import type { CircuitInstanceRow } from '@shared/schema';
import { Button } from '@/components/ui/button';
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
  AssemblyCostPanel,
  AddItemDialog,
  ComponentReference,
  BomEmptyState,
  detectEsdSensitivity,
  detectAssemblyCategory,
} from './procurement';
import { SupplierDrawer } from './procurement/SupplierDrawer';
import { ManufacturingValidatorPanel } from './procurement/ManufacturingValidatorPanel';
import type { ManufacturingPackageInput } from '@/lib/manufacturing-validator';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { getRadialAiDeliveryVerb, getRadialAiPromptDelivery, runRadialAiCommand } from '@/lib/radial-ai-commands';
import { AssemblyRiskHeatmap } from './procurement/AssemblyRiskHeatmap';
import { CostOptimizerPanel } from './procurement/CostOptimizerPanel';
import { OrderHistoryPanel } from './procurement/OrderHistoryPanel';
import { PcbOrderTrackerPanel } from './procurement/PcbOrderTrackerPanel';
import { RiskScorecardPanel } from './procurement/RiskScorecardPanel';
import PartUsagePanel from './PartUsagePanel';
import PartAlternatesPanel from './PartAlternatesPanel';
import SupplyChainAlertsPanel from './SupplyChainAlertsPanel';
import BomTemplatesPanel from './BomTemplatesPanel';
import PersonalInventoryPanel from './PersonalInventoryPanel';
import type { AssemblyCategory, EnrichedBomItem, EditValues, NewItemValues, CostBreakdown } from './procurement';
import { logger } from '@/lib/logger';

const BomDiffPanel = lazy(() => import('@/components/views/BomDiffPanel'));
const AssemblyGroupPanel = lazy(() =>
  import('./procurement/AssemblyGroupPanel').then((m) => ({ default: m.AssemblyGroupPanel })),
);
const AvlCompliancePanel = lazy(() => import('./procurement/AvlCompliancePanel'));
const PROCUREMENT_BISECT_MINIMAL = false;
const SESSION_KEY = 'protopulse-session-id';

function readHasSession(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(SESSION_KEY));
}

function readInstanceProperties(instance: CircuitInstanceRow): Record<string, unknown> {
  return instance.properties && typeof instance.properties === 'object'
    ? (instance.properties as Record<string, unknown>)
    : {};
}

function isCircuitSourceInstance(instance: CircuitInstanceRow): boolean {
  const props = readInstanceProperties(instance);
  const componentType = String(props.componentType ?? '');
  return (
    /^[VI]/i.test(instance.referenceDesignator) ||
    /voltage.source|current.source|dc.source|ac.source|signal.source|function.generator/i.test(componentType)
  );
}

function hasPcbPlacement(instance: CircuitInstanceRow): boolean {
  return instance.pcbX != null && instance.pcbY != null;
}

function formatBomItemAiDetails(item: BomItem): string[] {
  return [
    `Part number: ${item.partNumber}`,
    `Manufacturer: ${item.manufacturer || 'Unknown'}`,
    `Description: ${item.description || 'None'}`,
    `Quantity: ${String(item.quantity)}`,
    `Unit price: ${String(item.unitPrice)}`,
    `Total price: ${String(item.totalPrice)}`,
    `Supplier: ${item.supplier || 'Unknown'}`,
    `Stock: ${String(item.stock)}`,
    `Status: ${item.status || 'Unknown'}`,
  ];
}

function formatBomItemCopyText(item: BomItem): string {
  return formatBomItemAiDetails(item).join('\n');
}

interface ProcurementSafetyGatePanelProps {
  precheck: ExportPrecheck;
}

const ProcurementSafetyGatePanel = memo(function ProcurementSafetyGatePanel({
  precheck,
}: ProcurementSafetyGatePanelProps) {
  const blockers = precheck.checks.filter((check) => check.status === 'fail');
  const warnings = precheck.checks.filter((check) => check.status === 'warn');
  const passes = precheck.checks.length - blockers.length - warnings.length;
  const Icon = blockers.length > 0 ? XCircle : warnings.length > 0 ? AlertTriangle : CheckCircle2;
  const statusLabel = blockers.length > 0 ? 'Blocked' : warnings.length > 0 ? 'Warnings' : 'Ready';

  return (
    <section
      id="procurement-safety-gate"
      data-testid="procurement-safety-gate"
      aria-labelledby="procurement-safety-gate-title"
      aria-live="polite"
      className={cn(
        'rounded-md border p-3 text-sm',
        blockers.length > 0
          ? 'border-destructive/40 bg-destructive/10'
          : warnings.length > 0
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-green-500/30 bg-green-500/10',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <h3 id="procurement-safety-gate-title" className="text-sm font-semibold">
              Procurement Safety Gate
            </h3>
            <p data-testid="procurement-safety-summary" className="text-xs text-muted-foreground">
              {passes} passed, {warnings.length} warning{warnings.length === 1 ? '' : 's'}, {blockers.length} blocker
              {blockers.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Badge
          data-testid="procurement-safety-status"
          variant={blockers.length > 0 ? 'destructive' : 'outline'}
          className={cn(
            warnings.length > 0 &&
              blockers.length === 0 &&
              'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            blockers.length === 0 &&
              warnings.length === 0 &&
              'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300',
          )}
        >
          {statusLabel}
        </Badge>
      </div>

      {blockers.length > 0 && (
        <ul data-testid="procurement-safety-blockers" className="mt-2 space-y-1">
          {blockers.map((check) => (
            <li
              key={`${check.name}-${check.message}`}
              data-testid="procurement-safety-blocker"
              className="text-xs text-destructive"
            >
              <span className="font-medium">{check.name}:</span> {check.message}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul data-testid="procurement-safety-warnings" className="mt-2 space-y-1">
          {warnings.map((check) => (
            <li
              key={`${check.name}-${check.message}`}
              data-testid="procurement-safety-warning"
              className="text-xs text-amber-700 dark:text-amber-300"
            >
              <span className="font-medium">{check.name}:</span> {check.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});

function ProcurementView() {
  const { projectName } = useProjectMeta();
  const { nodes } = useArchitecture();
  const { bom, bomSettings, setBomSettings, addBomItem, deleteBomItem, updateBomItem } = useBom();
  const { addOutputLog } = useOutput();
  const { toast } = useToast();
  const projectId = useProjectId();
  const { data: componentParts = [], isLoading: partsLoading } = useComponentParts(projectId);
  const { data: circuitDesigns = [] } = useCircuitDesigns(projectId);
  const activeCircuitId = circuitDesigns[0]?.id ?? 0;
  const { data: activeCircuitInstances = [] } = useCircuitInstances(activeCircuitId);
  const { data: shortfallsResp } = useBomShortfalls(projectId);
  const shortfallsByPartNumber = useMemo(
    () => indexShortfallsByPartNumber(shortfallsResp?.data),
    [shortfallsResp?.data],
  );
  const [crossProjectPartId, setCrossProjectPartId] = useState<string | null>(null);

  // ── Previous BOM cost (for cost delta indicator) ──
  // Read from localStorage — populated when user takes a BOM snapshot via the
  // BOM Comparison tab. No network requests needed.
  const previousTotalCost = useMemo(() => {
    try {
      const raw = localStorage.getItem(`protopulse:bom-snapshot-cost:${String(projectId)}`);
      if (raw) {
        const val = Number(raw);
        if (!Number.isNaN(val)) {
          return val;
        }
      }
    } catch {
      /* ignore */
    }
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
  const [showSupplierDrawer, setShowSupplierDrawer] = useState(false);
  const [activeTab, setActiveTab] = useState('management');

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
      if (stored && Object.hasOwn(OPTIMIZATION_GOALS, stored)) {
        return stored;
      }
    } catch {
      /* fall through */
    }
    return 'Cost';
  });
  const [preferredSuppliers, setPreferredSuppliers] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERRED_SUPPLIERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
    } catch {
      /* fall through */
    }
    return { ...DEFAULT_PREFERRED_SUPPLIERS };
  });

  // ── Inline editing ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({
    partNumber: '',
    manufacturer: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    supplier: 'Digi-Key',
  });

  // ── Add item ──
  const defaultNewItem: NewItemValues = {
    partNumber: '',
    manufacturer: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    supplier: 'Digi-Key',
  };
  const [newItem, setNewItem] = useState<NewItemValues>(defaultNewItem);

  // ── Sort order (DnD) ──
  const [sortOrder, setSortOrder] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BOM_SORT_ORDER);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      /* fall through */
    }
    return [];
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Highlight timer ──
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHighlightItem = useCallback((id: number) => {
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }
    setHighlightedItemId(id);
    highlightTimer.current = setTimeout(() => setHighlightedItemId(null), 1500);
  }, []);

  // ── Enriched + filtered BOM ──
  const enrichedBom = useMemo(
    () =>
      bom.map((item) => ({
        ...item,
        _isEsd: item.esdSensitive ?? detectEsdSensitivity(item.description, item.partNumber),
        _assemblyCategory: (item.assemblyCategory ??
          detectAssemblyCategory(item.description, item.partNumber)) as AssemblyCategory | null,
      })),
    [bom],
  );

  const filteredBom = useMemo(() => {
    let filtered = enrichedBom;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.partNumber.toLowerCase().includes(term) ||
          item.manufacturer.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.supplier.toLowerCase().includes(term),
      );
    }
    if (esdFilterOnly) {
      filtered = filtered.filter((item) => item._isEsd);
    }
    if (sortOrder.length === 0) {
      return filtered;
    }
    const orderMap = new Map(sortOrder.map((id, idx) => [id, idx]));
    return [...filtered].sort((a, b) => {
      const aIdx = orderMap.get(Number(a.id)) ?? Number.MAX_SAFE_INTEGER;
      const bIdx = orderMap.get(Number(b.id)) ?? Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
  }, [enrichedBom, searchTerm, esdFilterOnly, sortOrder]);

  const assemblyGroups = useMemo(() => {
    const groups: Record<string, EnrichedBomItem[]> = {
      smt: [],
      through_hole: [],
      hand_solder: [],
      mechanical: [],
      unassigned: [],
    };
    for (const item of enrichedBom) {
      groups[item._assemblyCategory ?? 'unassigned'].push(item);
    }
    return groups;
  }, [enrichedBom]);

  const esdCount = useMemo(() => enrichedBom.filter((i) => i._isEsd).length, [enrichedBom]);

  const lifecycleWarnings = useMemo(() => {
    let nrnd = 0;
    let eol = 0;
    let obsolete = 0;
    for (const item of bom) {
      const status = classifyLifecycle(item.partNumber, item.manufacturer);
      if (status === 'nrnd') {
        nrnd++;
      }
      if (status === 'eol') {
        eol++;
      }
      if (status === 'obsolete') {
        obsolete++;
      }
    }
    const total = nrnd + eol + obsolete;
    const hasEolOrObsolete = eol > 0 || obsolete > 0;
    return { nrnd, eol, obsolete, total, hasEolOrObsolete };
  }, [bom]);

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
      if (cat) {
        cat.total += Number(item.totalPrice);
        cat.count += 1;
      }
    }
    const avgUnitCost = bom.length > 0 ? bom.reduce((sum, item) => sum + Number(item.unitPrice), 0) / bom.length : 0;
    const totalBomCost = bom.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const topItems = [...bom].sort((a, b) => Number(b.totalPrice) - Number(a.totalPrice)).slice(0, 5);
    const maxItemCost = topItems.length > 0 ? Number(topItems[0].totalPrice) : 0;
    return { statusCategories, avgUnitCost, totalBomCost, topItems, maxItemCost };
  }, [bom]);

  // ── Manufacturing validator input (built from BOM) ──
  const mfgPackageInput = useMemo(
    (): ManufacturingPackageInput => ({
      gerberLayers: [],
      drillFile: null,
      bomEntries: bom.map((item) => ({
        refDes: item.partNumber,
        partNumber: item.partNumber,
        quantity: item.quantity,
        description: item.description,
      })),
      placements: [],
      board: null,
    }),
    [bom],
  );

  const procurementSafetyGates = useMemo(
    () =>
      buildValidationSafetyGateData({
        circuitInstances: activeCircuitInstances,
        componentParts,
        bomItems: bom,
      }),
    [activeCircuitInstances, bom, componentParts],
  );
  const selectedCircuitHasInstances = activeCircuitInstances.length > 0;
  const selectedCircuitHasPcbLayout = activeCircuitInstances.some(hasPcbPlacement);
  const selectedCircuitHasSource = activeCircuitInstances.some(isCircuitSourceInstance);
  const selectedCircuitHasComponents = activeCircuitInstances.some((instance) => !isCircuitSourceInstance(instance));
  const procurementExportData = useMemo<ProjectExportData>(
    () => ({
      projectName,
      hasSession: readHasSession(),
      architectureNodeCount: nodes.length,
      hasCircuitInstances: selectedCircuitHasInstances,
      hasPcbLayout: selectedCircuitHasPcbLayout,
      bomItemCount: bom.length,
      bomItemsWithPartNumber: bom.filter((item) => item.partNumber.trim().length > 0).length,
      hasCircuitSource: selectedCircuitHasSource,
      hasCircuitComponent: selectedCircuitHasComponents,
      hasBoardProfile: true,
      bomItemsWithFailureData: 0,
      ...procurementSafetyGates,
      bomShortfallUnits: shortfallsResp?.totalShortfallUnits,
      bomShortfallLineCount: shortfallsResp?.total,
    }),
    [
      bom,
      nodes.length,
      procurementSafetyGates,
      projectName,
      selectedCircuitHasComponents,
      selectedCircuitHasInstances,
      selectedCircuitHasPcbLayout,
      selectedCircuitHasSource,
      shortfallsResp?.totalShortfallUnits,
      shortfallsResp?.total,
    ],
  );
  const procurementPrecheck = useMemo(
    () => runExportPrecheck('procurement-package', procurementExportData),
    [procurementExportData],
  );
  const procurementBlockerCount = procurementPrecheck.blockers.length;
  const procurementWarningCount = procurementPrecheck.warnings.length;
  const hasProcurementBlockers = procurementBlockerCount > 0;

  // ── Callbacks ──
  const saveSortOrder = useCallback((order: number[]) => {
    setSortOrder(order);
    try {
      localStorage.setItem(STORAGE_KEYS.BOM_SORT_ORDER, JSON.stringify(order));
    } catch {
      /* quota */
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const oldIndex = filteredBom.findIndex((item) => Number(item.id) === active.id);
      const newIndex = filteredBom.findIndex((item) => Number(item.id) === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return;
      }
      const reordered = arrayMove(filteredBom, oldIndex, newIndex);
      saveSortOrder(reordered.map((item) => Number(item.id)));
      toast({ title: 'Reordered', description: 'BOM item order updated.' });
    },
    [filteredBom, saveSortOrder, toast],
  );

  const handleExportCSV = useCallback(() => {
    if (hasProcurementBlockers) {
      toast({
        title: 'Export Blocked',
        description: procurementPrecheck.blockers[0] ?? 'Resolve procurement safety blockers before exporting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const headers = [
        'Part Number',
        'Manufacturer',
        'Description',
        'Quantity',
        'Unit Price',
        'Total Price',
        'Supplier',
        'Stock',
        'Status',
      ];
      const rows = filteredBom.map((item) => [
        item.partNumber,
        item.manufacturer,
        item.description,
        item.quantity,
        (Math.round(Number(item.unitPrice) * 100) / 100).toFixed(2),
        (Math.round(Number(item.totalPrice) * 100) / 100).toFixed(2),
        item.supplier,
        item.stock,
        item.status,
      ]);
      const csv = buildCSV(headers, rows);
      downloadBlob(new Blob([csv], { type: 'text/csv' }), 'bom_export.csv');
      toast({ title: 'Export Complete', description: 'BOM exported as CSV file.' });
    } catch (err) {
      logger.warn('Export failed:', err);
      toast({ title: 'Export Failed', description: 'Could not export CSV. Please try again.', variant: 'destructive' });
    }
  }, [filteredBom, hasProcurementBlockers, procurementPrecheck.blockers, toast]);

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
    if (editingId === null) {
      return;
    }
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

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    },
    [saveEdit, cancelEdit],
  );

  const handleAddItem = useCallback(() => {
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
    setNewItem({ ...defaultNewItem });
    setShowAddItemDialog(false);
  }, [newItem, addBomItem, toast, defaultNewItem]);

  const handleFindAlternates = useCallback(
    (partNumber: string) => {
      setAltSearching(true);
      try {
        setAltResults(findAlternates(partNumber).alternates);
      } finally {
        setAltSearching(false);
      }
    },
    [findAlternates],
  );

  const handleQuoteBom = useCallback(() => {
    if (hasProcurementBlockers) {
      toast({
        title: 'Quote Blocked',
        description: procurementPrecheck.blockers[0] ?? 'Resolve procurement safety blockers before quoting the BOM.',
        variant: 'destructive',
      });
      return;
    }

    setPricingSearching(true);
    try {
      setBomQuote(quoteBom(bom.map((item) => ({ mpn: item.partNumber, quantity: item.quantity }))));
    } finally {
      setPricingSearching(false);
    }
  }, [bom, hasProcurementBlockers, procurementPrecheck.blockers, quoteBom, toast]);

  const handleSearchPartPricing = useCallback(
    (mpn: string) => {
      setPricingSearching(true);
      try {
        searchPart(mpn);
        setPricingPartMpn(mpn);
      } finally {
        setPricingSearching(false);
      }
    },
    [searchPart],
  );

  const handleOpenDamageDialog = useCallback((item: BomItem) => {
    setDamageDialogItem(item);
    setDamageComponentType('generic');
    setDamageObservations([]);
    setCurrentDamageReport(null);
  }, []);

  const handleRunDamageAssessment = useCallback(() => {
    if (!damageDialogItem) {
      return;
    }
    setCurrentDamageReport(assessDamage(damageComponentType, damageObservations));
  }, [damageDialogItem, damageComponentType, damageObservations, assessDamage]);

  const updateOptimizationGoal = useCallback((goal: string) => {
    setOptimizationGoal(goal);
    try {
      localStorage.setItem(STORAGE_KEYS.OPTIMIZATION_GOAL, goal);
    } catch {
      /* quota */
    }
  }, []);

  const updatePreferredSuppliers = useCallback(
    (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      setPreferredSuppliers((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(STORAGE_KEYS.PREFERRED_SUPPLIERS, JSON.stringify(next));
        } catch {
          /* quota */
        }
        return next;
      });
    },
    [],
  );

  const resetAndShowAddDialog = useCallback(() => {
    setNewItem({ ...defaultNewItem });
    setShowAddItemDialog(true);
  }, [defaultNewItem]);

  useEffect(() => {
    const handleRadialCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      const detail = event.detail as RadialCommandEventDetail | undefined;
      if (!detail || detail.context.view !== 'bom') {
        return;
      }

      if (detail.context.target === 'canvas') {
        switch (detail.commandId) {
          case 'add_bom_item':
            setActiveTab('management');
            resetAndShowAddDialog();
            addOutputLog('[BOM] Opened add-item dialog from the radial canvas menu.');
            toast({ title: 'Add BOM Item', description: 'Ready to add a new part to the BOM.' });
            detail.handled = true;
            break;
          case 'ai_bom_plan': {
            const delivery = getRadialAiPromptDelivery(detail);
            const deliveryVerb = getRadialAiDeliveryVerb(delivery);
            runRadialAiCommand({
              intent: 'supply_risk',
              intro:
                'Review this whole BOM like a pragmatic hardware procurement copilot. Look for sourcing risk, missing data, order-readiness gaps, lifecycle concerns, and the next concrete procurement move.',
              summary: `BOM canvas review: ${String(bom.length)} items, ${String(filteredBom.length)} visible, ${String(procurementBlockerCount)} blockers, ${String(procurementWarningCount)} warnings.`,
              historyLabel: 'BOM procurement plan',
              context: detail.context,
              delivery,
              sections: [
                {
                  title: 'BOM snapshot',
                  lines: [
                    `Project: ${projectName}`,
                    `Total BOM lines: ${String(bom.length)}`,
                    `Visible lines after filters: ${String(filteredBom.length)}`,
                    `Total visible cost: $${totalCost.toFixed(2)}`,
                    `Lifecycle warnings: ${String(lifecycleWarnings.total)}`,
                    `Procurement blockers: ${String(procurementBlockerCount)}`,
                    `Procurement warnings: ${String(procurementWarningCount)}`,
                  ],
                },
                {
                  title: 'Representative parts',
                  lines:
                    bom.length > 0
                      ? bom
                          .slice(0, 10)
                          .map(
                            (item) =>
                              `${item.partNumber} (${item.manufacturer || 'Unknown'}) x${String(item.quantity)} - ${item.status}`,
                          )
                      : ['No BOM items yet.'],
                },
                {
                  title: 'Safety gate findings',
                  lines:
                    procurementPrecheck.checks.length > 0
                      ? procurementPrecheck.checks.map((check) => `${check.status}: ${check.message}`)
                      : ['No procurement checks were available.'],
                },
              ],
              finalInstruction:
                'Give Tyler a tight procurement action plan: what to add or fix first, which parts need alternates, whether the BOM is order-ready, and one concrete next click inside ProtoPulse.',
            });
            addOutputLog(`[BOM] ${deliveryVerb} AI canvas procurement plan.`);
            toast({
              title: `AI BOM Plan ${deliveryVerb}`,
              description:
                delivery === 'send-now'
                  ? 'Sent whole-BOM procurement plan to AI chat.'
                  : 'Drafted whole-BOM procurement plan in AI chat.',
            });
            detail.handled = true;
            break;
          }
          case 'open_bom_alternates':
            setActiveTab('alternates');
            if (bom[0]) {
              setAltSearchPartNumber(bom[0].partNumber);
              handleFindAlternates(bom[0].partNumber);
            }
            addOutputLog('[BOM] Opened alternates from the radial canvas menu.');
            toast({ title: 'Alternates Opened', description: 'BOM alternates are ready for review.' });
            detail.handled = true;
            break;
          case 'open_bom_templates':
            setActiveTab('templates');
            addOutputLog('[BOM] Opened BOM templates from the radial canvas menu.');
            toast({ title: 'BOM Templates', description: 'Reusable BOM templates are open.' });
            detail.handled = true;
            break;
          case 'quote_bom':
            setActiveTab('pricing');
            handleQuoteBom();
            if (!hasProcurementBlockers) {
              addOutputLog('[BOM] Started whole-BOM quote from the radial canvas menu.');
              toast({ title: 'BOM Quote Started', description: 'Checking supplier pricing for the full BOM.' });
            }
            detail.handled = true;
            break;
          case 'open_supply_chain':
            setActiveTab('supply-chain');
            addOutputLog('[BOM] Opened supply-chain alerts from the radial canvas menu.');
            toast({ title: 'Supply Chain Alerts', description: 'Supply-chain signals are open.' });
            detail.handled = true;
            break;
          case 'open_bom_settings':
            setActiveTab('management');
            setShowSettings(true);
            addOutputLog('[BOM] Opened BOM settings from the radial canvas menu.');
            toast({ title: 'BOM Settings', description: 'Supplier and optimization settings are visible.' });
            detail.handled = true;
            break;
          case 'export_bom_csv':
            handleExportCSV();
            if (!hasProcurementBlockers) {
              addOutputLog('[BOM] Exported CSV from the radial canvas menu.');
            }
            detail.handled = true;
            break;
          default:
            return;
        }
        return;
      }

      if (detail.context.target !== 'bom_row') {
        return;
      }

      const targetId = detail.context.targetId;
      const item = targetId ? bom.find((candidate) => String(candidate.id) === String(targetId)) : undefined;
      if (!item) {
        return;
      }

      switch (detail.commandId) {
        case 'add_to_inventory':
          setActiveTab('personal-inventory');
          handleHighlightItem(Number(item.id));
          addOutputLog(`[BOM] Opened personal inventory for ${item.partNumber}.`);
          toast({ title: 'Inventory Opened', description: `${item.partNumber} is highlighted for stock review.` });
          detail.handled = true;
          break;
        case 'find_alternates':
          setActiveTab('alternates');
          setAltSearchPartNumber(item.partNumber);
          handleFindAlternates(item.partNumber);
          handleHighlightItem(Number(item.id));
          toast({ title: 'Alternates Opened', description: `Searching substitutes for ${item.partNumber}.` });
          detail.handled = true;
          break;
        case 'view_datasheet':
          window.open(
            'https://www.google.com/search?q=' +
              encodeURIComponent(`${item.partNumber} ${item.manufacturer} datasheet`),
            '_blank',
            'noopener,noreferrer',
          );
          addOutputLog(`[BOM] Datasheet search opened for ${item.partNumber}.`);
          detail.handled = true;
          break;
        case 'check_supply_risk':
          setActiveTab('pricing');
          handleSearchPartPricing(item.partNumber);
          handleHighlightItem(Number(item.id));
          addOutputLog(`[BOM] Supply/pricing risk search opened for ${item.partNumber}.`);
          toast({ title: 'Pricing Search Opened', description: `Checking supplier data for ${item.partNumber}.` });
          detail.handled = true;
          break;
        case 'ai_part_tradeoffs': {
          const delivery = getRadialAiPromptDelivery(detail);
          const deliveryVerb = getRadialAiDeliveryVerb(delivery);
          runRadialAiCommand({
            intent: 'summarize_tradeoffs',
            intro:
              'Summarize sourcing tradeoffs for this BOM item. Compare cost, stock, lifecycle, supplier risk, and practical substitutes.',
            summary: `BOM item: ${item.partNumber}`,
            historyLabel: `Part tradeoffs: ${item.partNumber}`,
            context: detail.context,
            delivery,
            targetDetails: formatBomItemAiDetails(item),
            finalInstruction:
              'Give Tyler practical procurement guidance: risks, likely alternates, what to verify before ordering, and whether the part looks safe for prototype use.',
          });
          addOutputLog(`[BOM] ${deliveryVerb} AI tradeoff review for ${item.partNumber}.`);
          toast({
            title: `AI Tradeoffs ${deliveryVerb}`,
            description:
              delivery === 'send-now'
                ? `Sent ${item.partNumber} prompt to AI chat.`
                : `Drafted ${item.partNumber} prompt in AI chat.`,
          });
          detail.handled = true;
          break;
        }
        case 'remove':
          deleteBomItem(item.id);
          addOutputLog(`[BOM] Removed via radial menu: ${item.partNumber}.`);
          toast({ title: 'Removed From BOM', description: `${item.partNumber} was removed.` });
          detail.handled = true;
          break;
        case 'edit_quantity':
          setActiveTab('management');
          startEdit(item);
          handleHighlightItem(Number(item.id));
          toast({ title: 'Quantity Editor Opened', description: `Editing ${item.partNumber}.` });
          detail.handled = true;
          break;
        case 'copy_bom_row':
          void copyToClipboard(formatBomItemCopyText(item));
          addOutputLog(`[BOM] Copied row summary for ${item.partNumber}.`);
          toast({ title: 'BOM Row Copied', description: `${item.partNumber} summary copied.` });
          detail.handled = true;
          break;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
  }, [
    addOutputLog,
    bom,
    deleteBomItem,
    filteredBom,
    handleFindAlternates,
    handleExportCSV,
    handleQuoteBom,
    handleHighlightItem,
    handleSearchPartPricing,
    hasProcurementBlockers,
    lifecycleWarnings.total,
    startEdit,
    procurementBlockerCount,
    procurementPrecheck.checks,
    procurementWarningCount,
    projectName,
    resetAndShowAddDialog,
    toast,
    totalCost,
  ]);

  // ── Render ──
  if (PROCUREMENT_BISECT_MINIMAL) {
    return (
      <div className="h-full p-4" data-testid="procurement-view">
        <div className="border border-border bg-card/80 p-4 text-sm text-muted-foreground">Procurement bisect mode</div>
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="h-full flex flex-col bg-background/50"
      data-testid="procurement-view"
      data-active-tab={activeTab}
    >
      <div className="flex items-end gap-2 border-b border-border bg-card/30 px-3 pt-2 pb-0 backdrop-blur">
        <TabsList className="mb-1.5 max-w-full overflow-x-auto whitespace-nowrap" data-testid="procurement-tabs">
          <TabsTrigger className="h-7 px-2 text-[11px]" value="management" data-testid="tab-bom-management">
            BOM Management
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="comparison" data-testid="tab-bom-comparison">
            BOM Comparison
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="alternates" data-testid="tab-alternates">
            Alternates
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="pricing" data-testid="tab-live-pricing">
            Live Pricing
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="assembly-cost" data-testid="tab-assembly-cost">
            Assembly Cost
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="mfg-validator" data-testid="tab-mfg-validator">
            Mfg Validator
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="assembly-risk" data-testid="tab-assembly-risk">
            Assembly Risk
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="assembly-groups" data-testid="tab-assembly-groups">
            Assembly Groups
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="cost-optimizer" data-testid="tab-cost-optimizer">
            Cost Optimizer
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="order-history" data-testid="tab-order-history">
            Order History
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="pcb-tracking" data-testid="tab-pcb-tracking">
            PCB Tracking
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="risk-scorecard" data-testid="tab-risk-scorecard">
            Risk Scorecard
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="avl-compliance" data-testid="tab-avl-compliance">
            AVL Compliance
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="cross-project" data-testid="tab-cross-project">
            Cross-Project
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="supply-chain" data-testid="tab-supply-chain">
            Supply Chain
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="templates" data-testid="tab-templates">
            Templates
          </TabsTrigger>
          <TabsTrigger className="h-7 px-2 text-[11px]" value="personal-inventory" data-testid="tab-personal-inventory">
            My Inventory
          </TabsTrigger>
        </TabsList>
        {lifecycleWarnings.total > 0 && (
          <StyledTooltip
            content={
              <div className="space-y-0.5">
                {lifecycleWarnings.nrnd > 0 && <div>{lifecycleWarnings.nrnd} NRND</div>}
                {lifecycleWarnings.eol > 0 && <div>{lifecycleWarnings.eol} EOL</div>}
                {lifecycleWarnings.obsolete > 0 && <div>{lifecycleWarnings.obsolete} Obsolete</div>}
              </div>
            }
            side="bottom"
          >
            <span
              className={cn(
                'mb-1.5 inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium',
                lifecycleWarnings.hasEolOrObsolete
                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
              )}
              data-testid="lifecycle-warning-summary"
            >
              <AlertTriangle className="h-3 w-3" />
              {lifecycleWarnings.total} lifecycle warning{lifecycleWarnings.total !== 1 ? 's' : ''}
            </span>
          </StyledTooltip>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto mb-1.5 h-7 px-2.5 text-[11px]"
          onClick={() => setShowSupplierDrawer(true)}
          data-testid="button-compare-suppliers"
        >
          <Scale className="h-3.5 w-3.5 mr-1" />
          Compare Suppliers
        </Button>
      </div>

      <TabsContent value="management" className="flex-1 flex flex-col overflow-hidden mt-0">
        <BomToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings(!showSettings)}
          esdFilterOnly={esdFilterOnly}
          onToggleEsdFilter={() => setEsdFilterOnly(!esdFilterOnly)}
          esdCount={esdCount}
          showAssemblyGroups={showAssemblyGroups}
          onToggleAssemblyGroups={() => setShowAssemblyGroups(!showAssemblyGroups)}
          onAddItem={resetAndShowAddDialog}
          totalCost={totalCost}
          onExportCSV={handleExportCSV}
          exportBlocked={hasProcurementBlockers}
          exportBlockerCount={procurementBlockerCount}
          exportWarningCount={procurementWarningCount}
        />
        {showSettings && (
          <BomSettings
            bomSettings={bomSettings}
            onBomSettingsChange={setBomSettings}
            optimizationGoal={optimizationGoal}
            onOptimizationGoalChange={updateOptimizationGoal}
            preferredSuppliers={preferredSuppliers}
            onPreferredSuppliersChange={updatePreferredSuppliers}
            showSupplierEdit={showSupplierEdit}
            onToggleSupplierEdit={() => setShowSupplierEdit(!showSupplierEdit)}
          />
        )}

        <div className="flex-1 space-y-3 overflow-auto p-2.5 lg:p-3">
          <ProcurementSafetyGatePanel precheck={procurementPrecheck} />
          {bom.length > 0 && <CostSummary costBreakdown={costBreakdown} previousTotalCost={previousTotalCost} />}
          {showAssemblyGroups && enrichedBom.length > 0 && <AssemblyGroups assemblyGroups={assemblyGroups} />}
          <BomCards filteredBom={filteredBom} deleteBomItem={deleteBomItem} toast={toast} />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <BomTable
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
              toast={toast}
              highlightedItemId={highlightedItemId}
              handleHighlightItem={handleHighlightItem}
              onAssessDamage={handleOpenDamageDialog}
              onFindAlternates={handleFindAlternates}
              shortfallsByPartNumber={shortfallsByPartNumber}
            />
          </DndContext>
          {filteredBom.length === 0 && (
            <BomEmptyState
              searchTerm={searchTerm}
              onClearSearch={() => setSearchTerm('')}
              onAddItem={resetAndShowAddDialog}
            />
          )}
          <ComponentReference
            showComponentRef={showComponentRef}
            onToggleComponentRef={() => setShowComponentRef(!showComponentRef)}
            componentParts={componentParts}
            partsLoading={partsLoading}
          />
        </div>

        <AddItemDialog
          open={showAddItemDialog}
          onOpenChange={setShowAddItemDialog}
          newItem={newItem}
          onNewItemChange={setNewItem}
          onAddItem={handleAddItem}
        />
      </TabsContent>

      <TabsContent value="comparison" className="flex-1 overflow-hidden mt-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64 text-muted-foreground">Loading comparison...</div>
          }
        >
          <BomDiffPanel />
        </Suspense>
      </TabsContent>

      <TabsContent value="alternates" className="mt-0 flex-1 space-y-2.5 overflow-auto p-3">
        <AlternatePartsPanel
          bom={bom}
          altSearchPartNumber={altSearchPartNumber}
          onAltSearchChange={setAltSearchPartNumber}
          altResults={altResults}
          altSearching={altSearching}
          onFindAlternates={handleFindAlternates}
        />
      </TabsContent>

      <TabsContent value="pricing" className="mt-0 flex-1 space-y-2.5 overflow-auto p-3">
        <SupplierPricingPanel
          bom={bom}
          bomQuote={bomQuote}
          pricingSearching={pricingSearching}
          pricingPartMpn={pricingPartMpn}
          onPricingPartMpnChange={setPricingPartMpn}
          onQuoteBom={handleQuoteBom}
          onSearchPartPricing={handleSearchPartPricing}
          distributors={distributors}
          currency={currency}
          quoteBlocked={hasProcurementBlockers}
          quoteBlockerCount={procurementBlockerCount}
          quoteWarningCount={procurementWarningCount}
        />
      </TabsContent>

      <TabsContent value="assembly-cost" className="mt-0 flex-1 overflow-auto p-3">
        <AssemblyCostPanel bom={bom} />
      </TabsContent>

      <TabsContent value="assembly-risk" className="flex-1 overflow-auto mt-0">
        <AssemblyRiskHeatmap bom={bom} />
      </TabsContent>

      <TabsContent value="mfg-validator" className="mt-0 flex-1 overflow-auto p-3">
        <ManufacturingValidatorPanel packageInput={mfgPackageInput} />
      </TabsContent>

      <TabsContent value="assembly-groups" className="flex-1 overflow-auto mt-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Loading assembly groups...
            </div>
          }
        >
          <AssemblyGroupPanel bom={bom} />
        </Suspense>
      </TabsContent>

      <TabsContent value="cost-optimizer" className="flex-1 overflow-auto mt-0">
        <CostOptimizerPanel bom={bom} />
      </TabsContent>

      <TabsContent value="order-history" className="flex-1 overflow-auto mt-0">
        <OrderHistoryPanel />
      </TabsContent>

      <TabsContent value="pcb-tracking" className="flex-1 overflow-auto mt-0">
        <PcbOrderTrackerPanel />
      </TabsContent>

      <TabsContent value="risk-scorecard" className="flex-1 overflow-auto mt-0">
        <RiskScorecardPanel />
      </TabsContent>

      <TabsContent value="avl-compliance" className="flex-1 overflow-auto mt-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64 text-muted-foreground">Loading AVL compliance...</div>
          }
        >
          <AvlCompliancePanel bom={bom} />
        </Suspense>
      </TabsContent>

      <TabsContent value="cross-project" className="mt-0 flex-1 space-y-2.5 overflow-auto p-3">
        {bom.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Add parts to BOM to see cross-project usage and alternates.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" data-testid="cross-project-part-selector">
              {bom.map((item) => (
                <Button
                  key={item.id}
                  variant={crossProjectPartId === item.id ? 'default' : 'outline'}
                  size="sm"
                  data-testid={`cross-project-part-btn-${item.id}`}
                  onClick={() => {
                    setCrossProjectPartId(crossProjectPartId === item.id ? null : item.id);
                  }}
                >
                  {item.partNumber}
                </Button>
              ))}
            </div>
            {crossProjectPartId && (
              <div className="space-y-3" data-testid="cross-project-detail">
                <PartUsagePanel partId={crossProjectPartId} />
                <PartAlternatesPanel
                  partId={crossProjectPartId}
                  projectId={projectId}
                  partTitle={bom.find((b) => b.id === crossProjectPartId)?.partNumber ?? ''}
                />
              </div>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="supply-chain" className="mt-0 flex-1 overflow-auto p-3">
        <SupplyChainAlertsPanel projectId={projectId} />
      </TabsContent>

      <TabsContent value="templates" className="mt-0 flex-1 overflow-auto p-3">
        <BomTemplatesPanel projectId={projectId} bom={bom} />
      </TabsContent>

      <TabsContent value="personal-inventory" className="mt-0 flex-1 overflow-auto p-3">
        <PersonalInventoryPanel />
      </TabsContent>

      <DamageAssessmentPanel
        damageDialogItem={damageDialogItem}
        onClose={() => setDamageDialogItem(null)}
        damageComponentType={damageComponentType}
        onComponentTypeChange={setDamageComponentType}
        damageObservations={damageObservations}
        onObservationsChange={setDamageObservations}
        currentDamageReport={currentDamageReport}
        onRunAssessment={handleRunDamageAssessment}
      />
      <SupplierDrawer open={showSupplierDrawer} onOpenChange={setShowSupplierDrawer} />
    </Tabs>
  );
}

export default memo(ProcurementView);
