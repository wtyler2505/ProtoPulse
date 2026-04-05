/**
 * PcbOrderingView — PCB ordering workflow with fab selection and DFM checks.
 * Step-based: Board specs -> Select fab -> DFM check -> Quote comparison -> Order summary.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  ArrowLeft,
  Ruler,
  Layers,
  DollarSign,
  ClipboardCheck,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import ReleaseConfidenceCard from '@/components/ui/ReleaseConfidenceCard';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { usePcbOrdering } from '@/lib/pcb-ordering';
import { buildOrderingTrustReceipt } from '@/lib/trust-receipts';
import { buildWorkspaceReleaseConfidence } from '@/lib/workspace-release-confidence';
import { FabApiSettings } from '@/components/views/procurement/FabApiSettings';
import TrustReceiptCard from '@/components/ui/TrustReceiptCard';
import type {
  BoardSpecification,
  FabricatorId,
  FabricatorProfile,
  DfmCheckResult,
  PriceQuote,
  BoardFinish,
  SolderMaskColor,
  SilkscreenColor,
  CopperWeightOz,
} from '@/lib/pcb-ordering';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = ['Board Specs', 'Select Fab', 'DFM Check', 'Quotes', 'Summary'] as const;

const FINISH_OPTIONS: Array<{ value: BoardFinish; label: string }> = [
  { value: 'HASL', label: 'HASL (Hot Air Solder Leveling)' },
  { value: 'ENIG', label: 'ENIG (Gold)' },
  { value: 'OSP', label: 'OSP (Organic)' },
  { value: 'ENEPIG', label: 'ENEPIG' },
  { value: 'Immersion_Tin', label: 'Immersion Tin' },
  { value: 'Immersion_Silver', label: 'Immersion Silver' },
];

const MASK_COLORS: Array<{ value: SolderMaskColor; label: string; hex: string }> = [
  { value: 'green', label: 'Green', hex: '#1a6b1a' },
  { value: 'red', label: 'Red', hex: '#b91c1c' },
  { value: 'blue', label: 'Blue', hex: '#1e3a8a' },
  { value: 'black', label: 'Black', hex: '#1a1a1a' },
  { value: 'white', label: 'White', hex: '#e5e5e5' },
  { value: 'yellow', label: 'Yellow', hex: '#ca8a04' },
  { value: 'purple', label: 'Purple', hex: '#6b21a8' },
  { value: 'matte-black', label: 'Matte Black', hex: '#333333' },
  { value: 'matte-green', label: 'Matte Green', hex: '#2d5016' },
];

const SILK_COLORS: Array<{ value: SilkscreenColor; label: string }> = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'red', label: 'Red' },
];

const COPPER_WEIGHTS: CopperWeightOz[] = [0.5, 1, 2, 3, 4];

const DEFAULT_SPEC: BoardSpecification = {
  width: 100,
  height: 80,
  layers: 2,
  thickness: 1.6,
  copperWeight: 1 as CopperWeightOz,
  finish: 'HASL',
  solderMaskColor: 'green',
  silkscreenColor: 'white',
  minTraceWidth: 0.2,
  minDrillSize: 0.3,
  castellatedHoles: false,
  impedanceControl: false,
  viaInPad: false,
  goldFingers: false,
};

// ---------------------------------------------------------------------------
// Step 1: Board Specs Form
// ---------------------------------------------------------------------------

interface BoardSpecFormProps {
  spec: BoardSpecification;
  onChange: (spec: BoardSpecification) => void;
}

const BoardSpecForm = memo(function BoardSpecForm({ spec, onChange }: BoardSpecFormProps) {
  const update = useCallback(
    <K extends keyof BoardSpecification>(key: K, value: BoardSpecification[K]) => {
      onChange({ ...spec, [key]: value });
    },
    [spec, onChange],
  );

  return (
    <div data-testid="board-spec-form" className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="spec-width">Width (mm)</Label>
          <Input
            data-testid="spec-width"
            id="spec-width"
            type="number"
            value={spec.width}
            onChange={(e) => { update('width', parseFloat(e.target.value) || 0); }}
          />
        </div>
        <div>
          <Label htmlFor="spec-height">Height (mm)</Label>
          <Input
            data-testid="spec-height"
            id="spec-height"
            type="number"
            value={spec.height}
            onChange={(e) => { update('height', parseFloat(e.target.value) || 0); }}
          />
        </div>
        <div>
          <Label htmlFor="spec-layers">Layers</Label>
          <Select
            value={String(spec.layers)}
            onValueChange={(v) => { update('layers', parseInt(v, 10)); }}
          >
            <SelectTrigger data-testid="spec-layers" id="spec-layers">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 4, 6, 8].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} layer{n > 1 ? 's' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="spec-thickness">Thickness (mm)</Label>
          <Select
            value={String(spec.thickness)}
            onValueChange={(v) => { update('thickness', parseFloat(v)); }}
          >
            <SelectTrigger data-testid="spec-thickness" id="spec-thickness">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0.6, 0.8, 1.0, 1.2, 1.6, 2.0, 2.4].map((t) => (
                <SelectItem key={t} value={String(t)}>{t}mm</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="spec-copper">Copper Weight</Label>
          <Select
            value={String(spec.copperWeight)}
            onValueChange={(v) => { update('copperWeight', parseFloat(v) as CopperWeightOz); }}
          >
            <SelectTrigger data-testid="spec-copper" id="spec-copper">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COPPER_WEIGHTS.map((w) => (
                <SelectItem key={w} value={String(w)}>{w} oz</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="spec-finish">Surface Finish</Label>
          <Select
            value={spec.finish}
            onValueChange={(v) => { update('finish', v as BoardFinish); }}
          >
            <SelectTrigger data-testid="spec-finish" id="spec-finish">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINISH_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <Label>Solder Mask Color</Label>
          <div data-testid="spec-mask-color" className="flex flex-wrap gap-2 mt-2">
            {MASK_COLORS.map((c) => (
              <button
                key={c.value}
                data-testid={`mask-color-${c.value}`}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-all',
                  spec.solderMaskColor === c.value ? 'border-primary scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c.hex }}
                title={c.label}
                onClick={() => { update('solderMaskColor', c.value); }}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>Silkscreen Color</Label>
          <Select
            value={spec.silkscreenColor}
            onValueChange={(v) => { update('silkscreenColor', v as SilkscreenColor); }}
          >
            <SelectTrigger data-testid="spec-silk" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SILK_COLORS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="spec-trace">Min Trace Width (mm)</Label>
          <Input
            data-testid="spec-trace"
            id="spec-trace"
            type="number"
            step="0.01"
            value={spec.minTraceWidth}
            onChange={(e) => { update('minTraceWidth', parseFloat(e.target.value) || 0); }}
          />
        </div>
        <div>
          <Label htmlFor="spec-drill">Min Drill Size (mm)</Label>
          <Input
            data-testid="spec-drill"
            id="spec-drill"
            type="number"
            step="0.01"
            value={spec.minDrillSize}
            onChange={(e) => { update('minDrillSize', parseFloat(e.target.value) || 0); }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Special Features</Label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: 'castellatedHoles', label: 'Castellated Holes' },
              { key: 'impedanceControl', label: 'Impedance Control' },
              { key: 'viaInPad', label: 'Via-in-Pad' },
              { key: 'goldFingers', label: 'Gold Fingers' },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                data-testid={`spec-${key}`}
                id={`spec-${key}`}
                checked={spec[key]}
                onCheckedChange={(checked) => { update(key, Boolean(checked)); }}
              />
              <Label htmlFor={`spec-${key}`} className="text-sm cursor-pointer">{label}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Step 2: Fabricator Selection
// ---------------------------------------------------------------------------

interface FabSelectorProps {
  fabricators: FabricatorProfile[];
  selected: FabricatorId | null;
  spec: BoardSpecification;
  compareFabricators: (spec: BoardSpecification) => Array<{ fabricator: FabricatorProfile; compatible: boolean; issues: string[] }>;
  onSelect: (id: FabricatorId) => void;
}

const FabSelector = memo(function FabSelector({ fabricators, selected, spec, compareFabricators, onSelect }: FabSelectorProps) {
  const comparison = useMemo(() => compareFabricators(spec), [compareFabricators, spec]);

  return (
    <div data-testid="fab-selector" className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {comparison.map(({ fabricator, compatible, issues }) => (
        <Card
          key={fabricator.id}
          data-testid={`fab-card-${fabricator.id}`}
          className={cn(
            'cursor-pointer transition-all',
            selected === fabricator.id ? 'border-primary bg-primary/5' : 'bg-card/60 border-border/50',
            !compatible && 'opacity-60',
          )}
          onClick={() => { if (compatible) { onSelect(fabricator.id); } }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{fabricator.name}</CardTitle>
              {compatible ? (
                <Badge data-testid={`fab-compatible-${fabricator.id}`} variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Compatible
                </Badge>
              ) : (
                <Badge data-testid={`fab-incompatible-${fabricator.id}`} variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
                  <XCircle className="w-3 h-3 mr-1" />
                  Incompatible
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Max layers:</span>
              <span>{fabricator.capabilities.maxLayers}</span>
              <span className="text-muted-foreground">Min trace:</span>
              <span>{fabricator.capabilities.minTrace}mm</span>
              <span className="text-muted-foreground">Min drill:</span>
              <span>{fabricator.capabilities.minDrill}mm</span>
              <span className="text-muted-foreground">Turnaround:</span>
              <span>{fabricator.capabilities.turnaroundDays.standard}d standard</span>
            </div>
            {issues.length > 0 && (
              <div data-testid={`fab-issues-${fabricator.id}`} className="space-y-1">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-1 text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {issue}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Step 3: DFM Results
// ---------------------------------------------------------------------------

interface DfmResultsProps {
  result: DfmCheckResult | null;
  fabName: string;
}

const DfmResults = memo(function DfmResults({ result, fabName }: DfmResultsProps) {
  if (!result) {
    return (
      <div data-testid="dfm-pending" className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ClipboardCheck className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">Click "Run DFM Check" to validate your design against {fabName} capabilities.</p>
      </div>
    );
  }

  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const infos = result.issues.filter((i) => i.severity === 'info');

  return (
    <div data-testid="dfm-results" className="space-y-4">
      <div className="flex items-center gap-3">
        {result.passed ? (
          <Badge data-testid="dfm-passed" className="bg-green-500/20 text-green-400 border-green-500/30 text-sm px-3 py-1">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            DFM Check Passed
          </Badge>
        ) : (
          <Badge data-testid="dfm-failed" variant="destructive" className="text-sm px-3 py-1">
            <XCircle className="w-4 h-4 mr-1" />
            DFM Check Failed
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {errors.length} error{errors.length !== 1 ? 's' : ''}, {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {result.issues.length > 0 && (
        <div className="space-y-2">
          {result.issues.map((issue, i) => {
            const Icon = issue.severity === 'error' ? XCircle : issue.severity === 'warning' ? AlertTriangle : Info;
            const colorClass = issue.severity === 'error'
              ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : issue.severity === 'warning'
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                : 'text-blue-400 bg-blue-500/10 border-blue-500/20';

            return (
              <div
                key={i}
                data-testid={`dfm-issue-${i}`}
                className={cn('flex items-start gap-2 p-2 rounded border text-sm', colorClass)}
              >
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div>{issue.message}</div>
                  {issue.unit && issue.actual !== 0 && (
                    <div className="text-xs mt-0.5 opacity-80">
                      Actual: {issue.actual}{issue.unit} | Required: {issue.required}{issue.unit}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Step 4: Quote Comparison
// ---------------------------------------------------------------------------

interface QuoteComparisonProps {
  quotes: PriceQuote[];
  fabricators: FabricatorProfile[];
}

const QuoteComparison = memo(function QuoteComparison({ quotes, fabricators }: QuoteComparisonProps) {
  if (quotes.length === 0) {
    return (
      <div data-testid="quotes-empty" className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <DollarSign className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No quotes available. Run DFM check first.</p>
      </div>
    );
  }

  const getFabName = (id: FabricatorId) => fabricators.find((f) => f.id === id)?.name ?? id;

  return (
    <div data-testid="quote-comparison">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fabricator</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Shipping</TableHead>
            <TableHead className="text-right">Grand Total</TableHead>
            <TableHead className="text-right">Lead Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q, i) => (
            <TableRow key={q.fabricator} data-testid={`quote-row-${q.fabricator}`}>
              <TableCell className="font-medium">
                {getFabName(q.fabricator)}
                {i === 0 && (
                  <Badge variant="outline" className="ml-2 text-xs bg-green-500/10 text-green-400 border-green-500/30">
                    Best
                  </Badge>
                )}
              </TableCell>
              <TableCell data-testid={`quote-unit-${q.fabricator}`} className="text-right font-mono">
                ${q.unitPrice.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">${q.totalPrice.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono">${q.shippingCost.toFixed(2)}</TableCell>
              <TableCell data-testid={`quote-total-${q.fabricator}`} className="text-right font-mono font-bold">
                ${q.grandTotal.toFixed(2)}
              </TableCell>
              <TableCell data-testid={`quote-lead-${q.fabricator}`} className="text-right">
                {q.turnaroundDays} days
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Step 5: Order Summary
// ---------------------------------------------------------------------------

interface OrderSummaryProps {
  spec: BoardSpecification;
  fabName: string;
  quote: PriceQuote | null;
  quantity: number;
}

const OrderSummary = memo(function OrderSummary({ spec, fabName, quote, quantity }: OrderSummaryProps) {
  return (
    <div data-testid="order-summary" className="space-y-4 max-w-lg">
      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Board Specifications</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Dimensions:</span>
          <span data-testid="summary-dimensions">{spec.width} x {spec.height} mm</span>
          <span className="text-muted-foreground">Layers:</span>
          <span data-testid="summary-layers">{spec.layers}</span>
          <span className="text-muted-foreground">Thickness:</span>
          <span>{spec.thickness}mm</span>
          <span className="text-muted-foreground">Copper:</span>
          <span>{spec.copperWeight}oz</span>
          <span className="text-muted-foreground">Finish:</span>
          <span>{spec.finish}</span>
          <span className="text-muted-foreground">Solder Mask:</span>
          <span>{spec.solderMaskColor}</span>
          <span className="text-muted-foreground">Silkscreen:</span>
          <span>{spec.silkscreenColor}</span>
        </CardContent>
      </Card>

      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Order Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Fabricator:</span>
          <span data-testid="summary-fab">{fabName}</span>
          <span className="text-muted-foreground">Quantity:</span>
          <span data-testid="summary-qty">{quantity}</span>
          {quote && (
            <>
              <span className="text-muted-foreground">Unit Price:</span>
              <span>${quote.unitPrice.toFixed(2)}</span>
              <span className="text-muted-foreground">Shipping:</span>
              <span>${quote.shippingCost.toFixed(2)}</span>
              <Separator className="col-span-2" />
              <span className="font-semibold">Grand Total:</span>
              <span data-testid="summary-total" className="font-bold text-primary font-mono">
                ${quote.grandTotal.toFixed(2)}
              </span>
              <span className="text-muted-foreground">Lead Time:</span>
              <span>{quote.turnaroundDays} days</span>
            </>
          )}
        </CardContent>
      </Card>

      {quote && quote.breakdown.length > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Price Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="price-breakdown" className="space-y-1">
              {quote.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.item}</span>
                  <span className="font-mono">${item.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// PcbOrderingView
// ---------------------------------------------------------------------------

export default function PcbOrderingView() {
  const { nodes, edges } = useArchitecture();
  const { bom } = useBom();
  const { issues } = useValidation();
  const {
    fabricators,
    runDfmCheck,
    getQuote,
    compareQuotes,
    createOrder,
    submitOrder,
    compareFabricators,
  } = usePcbOrdering();

  const [step, setStep] = useState(0);
  const [spec, setSpec] = useState<BoardSpecification>({ ...DEFAULT_SPEC });
  const [selectedFab, setSelectedFab] = useState<FabricatorId | null>(null);
  const [dfmResult, setDfmResult] = useState<DfmCheckResult | null>(null);
  const [quotes, setQuotes] = useState<PriceQuote[]>([]);
  const [quantity, setQuantity] = useState(5);

  const selectedFabProfile = useMemo(
    () => fabricators.find((f) => f.id === selectedFab) ?? null,
    [fabricators, selectedFab],
  );
  const compatibleFabCount = useMemo(
    () => compareFabricators(spec).filter((result) => result.compatible).length,
    [compareFabricators, spec],
  );

  const currentQuote = useMemo(() => {
    if (!selectedFab) {
      return null;
    }
    return quotes.find((q) => q.fabricator === selectedFab) ?? null;
  }, [quotes, selectedFab]);

  const handleSelectFab = useCallback((fab: FabricatorId) => {
    setSelectedFab(fab);
    setDfmResult(null);
    setQuotes([]);
  }, []);

  const handleRunDfm = useCallback(() => {
    if (!selectedFab) {
      return;
    }
    const result = runDfmCheck(spec, selectedFab);
    setDfmResult(result);
    if (result.passed) {
      const allQuotes = compareQuotes(spec, quantity);
      setQuotes(allQuotes);
    }
  }, [selectedFab, spec, runDfmCheck, compareQuotes, quantity]);

  const handleCreateOrder = useCallback(() => {
    if (!selectedFab) {
      return;
    }
    const order = createOrder(selectedFab, spec, quantity);
    submitOrder(order.id);
  }, [selectedFab, spec, quantity, createOrder, submitOrder]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return spec.width > 0 && spec.height > 0;
      case 1:
        return selectedFab !== null;
      case 2:
        return dfmResult?.passed === true;
      case 3:
        return quotes.length > 0;
      default:
        return true;
    }
  }, [step, spec, selectedFab, dfmResult, quotes]);

  const orderingReceipt = useMemo(
    () =>
      buildOrderingTrustReceipt({
        compatibleFabCount,
        dfmResult,
        quotes,
        selectedFabName: selectedFabProfile?.name ?? null,
        totalFabCount: fabricators.length,
      }),
    [compatibleFabCount, dfmResult, fabricators.length, quotes, selectedFabProfile?.name],
  );

  const releaseConfidence = useMemo(
    () =>
      buildWorkspaceReleaseConfidence({
        bomItems: bom,
        validationIssues: issues,
        nodes,
        edges,
      }),
    [bom, edges, issues, nodes],
  );

  return (
    <div data-testid="pcb-ordering-view" className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-5 h-5 text-primary" />
        <h2 data-testid="ordering-title" className="text-lg font-semibold">Order PCB</h2>
      </div>

      <ReleaseConfidenceCard
        result={releaseConfidence}
        title="Order Readiness Confidence"
        sourceNote="Based on BOM, validation, architecture, and manufacturing signals visible in this workspace. Use the ordering trust receipt below for fab-specific and DFM-specific truth."
      />

      <TrustReceiptCard receipt={orderingReceipt} data-testid="trust-receipt-ordering" />

      <Tabs
        value={String(step)}
        onValueChange={(v) => { setStep(parseInt(v, 10)); }}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList data-testid="ordering-steps" className="w-full justify-start">
          {STEPS.map((label, i) => (
            <TabsTrigger
              key={i}
              data-testid={`step-${i}`}
              value={String(i)}
              disabled={i > step + 1}
              className="text-xs"
            >
              <span className="mr-1.5 text-xs opacity-60">{i + 1}.</span>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Step 0: Board Specs */}
        <TabsContent value="0" className="flex-1 min-h-0 mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Board Specifications</h3>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  data-testid="spec-quantity"
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => { setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1)); }}
                  className="w-24"
                />
              </div>
              <BoardSpecForm spec={spec} onChange={setSpec} />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Step 1: Select Fab */}
        <TabsContent value="1" className="flex-1 min-h-0 mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Select Fabricator</h3>
              </div>
              <FabSelector
                fabricators={fabricators}
                selected={selectedFab}
                spec={spec}
                compareFabricators={compareFabricators}
                onSelect={handleSelectFab}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Step 2: DFM Check */}
        <TabsContent value="2" className="flex-1 min-h-0 mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">DFM Validation</h3>
                </div>
                <Button
                  data-testid="run-dfm-btn"
                  size="sm"
                  onClick={handleRunDfm}
                  disabled={!selectedFab}
                >
                  Run DFM Check
                </Button>
              </div>
              <DfmResults
                result={dfmResult}
                fabName={selectedFabProfile?.name ?? 'fabricator'}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Step 3: Quote Comparison */}
        <TabsContent value="3" className="flex-1 min-h-0 mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Quote Comparison ({quantity} boards)</h3>
              </div>
              <QuoteComparison quotes={quotes} fabricators={fabricators} />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Step 4: Order Summary */}
        <TabsContent value="4" className="flex-1 min-h-0 mt-3">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Order Summary</h3>
              </div>
              <OrderSummary
                spec={spec}
                fabName={selectedFabProfile?.name ?? ''}
                quote={currentQuote}
                quantity={quantity}
              />
              {selectedFab && selectedFabProfile && (
                <FabApiSettings fabId={selectedFab} fabName={selectedFabProfile.name} />
              )}
              <Button
                data-testid="place-order-btn"
                size="lg"
                className="w-full max-w-lg"
                onClick={handleCreateOrder}
                disabled={!selectedFab || !currentQuote}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Place Order
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Navigation */}
      <div data-testid="step-navigation" className="flex items-center justify-between border-t border-border/50 pt-3">
        <Button
          data-testid="step-prev"
          variant="outline"
          size="sm"
          disabled={step === 0}
          onClick={() => { setStep((s) => Math.max(0, s - 1)); }}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-muted-foreground/20',
              )}
            />
          ))}
        </div>
        <Button
          data-testid="step-next"
          size="sm"
          disabled={step >= STEPS.length - 1 || !canAdvance}
          onClick={() => { setStep((s) => Math.min(STEPS.length - 1, s + 1)); }}
        >
          Next
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
