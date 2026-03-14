import { useState, useMemo, useCallback } from 'react';
import { Calculator, ChevronDown, DollarSign, Factory, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  bomToAssemblyParts,
  useAssemblyCost,
} from '@/lib/assembly-cost-estimator';

import type { BomItem } from '@/lib/project-context';
import type {
  AssemblyProfileId,
  BoardParameters,
  CostBreakdown,
  BomItemInput,
} from '@/lib/assembly-cost-estimator';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssemblyCostPanelProps {
  bom: BomItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BOARD: BoardParameters = {
  widthMm: 50,
  heightMm: 30,
  layers: 2,
  finish: 'HASL',
  impedanceControl: false,
  viaInPad: false,
  goldFingers: false,
};

const PROFILE_LABELS: Record<AssemblyProfileId, string> = {
  jlcpcb_assembly: 'JLCPCB',
  pcbway_assembly: 'PCBWay',
  manual_diy: 'Manual / DIY',
};

const QUANTITY_OPTIONS = [1, 5, 10, 25, 50, 100, 250, 500, 1000] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssemblyCostPanel({ bom }: AssemblyCostPanelProps) {
  const { calculateCostFromData } = useAssemblyCost();

  const [selectedProfile, setSelectedProfile] = useState<AssemblyProfileId>('jlcpcb_assembly');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(10);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null);
  const [convertedParts, setConvertedParts] = useState<BomItemInput[] | null>(null);

  const assemblyParts = useMemo(() => bomToAssemblyParts(bom), [bom]);

  const smtCount = useMemo(() => assemblyParts.filter((p) => p.mountType === 'smt').length, [assemblyParts]);
  const thtCount = useMemo(() => assemblyParts.filter((p) => p.mountType === 'through_hole').length, [assemblyParts]);
  const unknownCount = useMemo(
    () => assemblyParts.filter((p) => p.mountType === 'unknown' || p.mountType === 'mixed').length,
    [assemblyParts],
  );
  const totalPins = useMemo(() => assemblyParts.reduce((sum, p) => sum + p.pinCount * p.quantity, 0), [assemblyParts]);

  const handleCalculate = useCallback(() => {
    if (assemblyParts.length === 0) {
      return;
    }
    const result = calculateCostFromData(assemblyParts, DEFAULT_BOARD, {}, selectedQuantity, selectedProfile);
    setBreakdown(result);
    setConvertedParts(assemblyParts);
  }, [assemblyParts, selectedQuantity, selectedProfile, calculateCostFromData]);

  return (
    <div className="max-w-5xl mx-auto space-y-4" data-testid="assembly-cost-panel">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-total-parts">
          <div className="flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">BOM Parts</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{assemblyParts.length}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-smt-count">
          <div className="flex items-center gap-1.5 mb-1">
            <Factory className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SMT</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{smtCount}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-tht-count">
          <div className="flex items-center gap-1.5 mb-1">
            <Factory className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Through-Hole</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{thtCount}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-total-pins">
          <div className="flex items-center gap-1.5 mb-1">
            <Calculator className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Pins</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{totalPins}</div>
        </div>
      </div>

      {unknownCount > 0 && (
        <div className="text-xs text-muted-foreground border border-border bg-card/60 px-3 py-2" data-testid="unknown-parts-notice">
          {unknownCount} part{unknownCount !== 1 ? 's' : ''} could not be classified (SMD/THT) — defaulted to hand-soldering cost.
        </div>
      )}

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        {/* Profile selector */}
        <div className="flex-1 relative">
          <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Assembly Service</label>
          <button
            type="button"
            onClick={() => { setShowProfileDropdown((v) => !v); }}
            className="w-full flex items-center justify-between border border-border bg-card/80 px-3 py-2 text-sm text-foreground hover:bg-card"
            data-testid="select-profile"
          >
            {PROFILE_LABELS[selectedProfile]}
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {showProfileDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border bg-card shadow-lg" data-testid="profile-dropdown">
              {(Object.entries(PROFILE_LABELS) as Array<[AssemblyProfileId, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-muted/50',
                    id === selectedProfile && 'bg-primary/10 text-primary',
                  )}
                  onClick={() => { setSelectedProfile(id); setShowProfileDropdown(false); }}
                  data-testid={`profile-option-${id}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quantity selector */}
        <div>
          <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Quantity</label>
          <select
            value={selectedQuantity}
            onChange={(e) => { setSelectedQuantity(Number(e.target.value)); }}
            className="border border-border bg-card/80 px-3 py-2 text-sm text-foreground"
            data-testid="select-quantity"
          >
            {QUANTITY_OPTIONS.map((q) => (
              <option key={q} value={q}>{q} boards</option>
            ))}
          </select>
        </div>

        {/* Calculate button */}
        <Button
          onClick={handleCalculate}
          disabled={assemblyParts.length === 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="btn-calculate-from-bom"
        >
          <Calculator className="w-4 h-4 mr-1.5" />
          Calculate from BOM
        </Button>
      </div>

      {/* Results */}
      {breakdown && (
        <div className="border border-border bg-card/80 backdrop-blur p-4 space-y-3" data-testid="cost-breakdown">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Cost Breakdown — {PROFILE_LABELS[breakdown.profileId as AssemblyProfileId]} x {breakdown.quantity}
            </h4>
            <Badge variant="outline" className="font-mono text-primary border-primary/30" data-testid="grand-total-badge">
              ${breakdown.grandTotal.toFixed(2)} total
            </Badge>
          </div>

          {/* Per-unit cost */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="per-unit-cost">
            <span>Per unit:</span>
            <span className="font-mono text-foreground font-medium">${breakdown.grandTotalPerUnit.toFixed(2)}</span>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="breakdown-table">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 pr-4">Category</th>
                  <th className="text-right py-1.5 px-2">Per Unit</th>
                  <th className="text-right py-1.5 px-2">Total</th>
                  <th className="text-left py-1.5 pl-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-border/50" data-testid={`line-item-${item.category}`}>
                    <td className="py-1.5 pr-4 text-foreground">{item.label}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-foreground">${item.unitCost.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-foreground">${item.totalCost.toFixed(2)}</td>
                    <td className="py-1.5 pl-4 text-muted-foreground">{item.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="py-2 pr-4 text-foreground">Grand Total</td>
                  <td className="py-2 px-2 text-right font-mono text-primary">${breakdown.grandTotalPerUnit.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right font-mono text-primary">${breakdown.grandTotal.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* NRE */}
          {breakdown.nreTotal > 0 && (
            <div className="text-xs text-muted-foreground border-t border-border pt-2" data-testid="nre-section">
              <span className="font-medium text-foreground">NRE (one-time):</span>{' '}
              ${breakdown.nreTotal.toFixed(2)}
              <span className="ml-2 text-muted-foreground/60">
                (stencil ${breakdown.nre.stencil.toFixed(2)} + programming ${breakdown.nre.programming.toFixed(2)} + fixture ${breakdown.nre.testFixture.toFixed(2)})
              </span>
            </div>
          )}

          {/* Part mapping summary */}
          {convertedParts && convertedParts.length > 0 && (
            <details className="text-xs" data-testid="parts-mapping-details">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View mapped parts ({convertedParts.length} items)
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-1 pr-2">Part</th>
                      <th className="text-left py-1 px-2">Mount</th>
                      <th className="text-right py-1 px-2">Pins</th>
                      <th className="text-right py-1 px-2">Qty</th>
                      <th className="text-right py-1 pl-2">Unit $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertedParts.map((p, i) => (
                      <tr key={i} className="border-b border-border/30" data-testid={`mapped-part-${i}`}>
                        <td className="py-1 pr-2 font-mono text-foreground truncate max-w-[200px]">{p.partNumber || '(unnamed)'}</td>
                        <td className="py-1 px-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px]',
                              p.mountType === 'smt' && 'text-cyan-400 border-cyan-400/30',
                              p.mountType === 'through_hole' && 'text-amber-400 border-amber-400/30',
                              p.mountType === 'unknown' && 'text-muted-foreground border-muted-foreground/30',
                            )}
                          >
                            {p.mountType === 'smt' ? 'SMT' : p.mountType === 'through_hole' ? 'THT' : p.mountType}
                          </Badge>
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-foreground">{p.pinCount}</td>
                        <td className="py-1 px-2 text-right font-mono text-foreground">{p.quantity}</td>
                        <td className="py-1 pl-2 text-right font-mono text-foreground">${p.unitPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Empty state */}
      {bom.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm" data-testid="empty-bom-message">
          Add items to the BOM to calculate assembly costs.
        </div>
      )}
    </div>
  );
}
