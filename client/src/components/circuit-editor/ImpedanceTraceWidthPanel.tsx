/**
 * ImpedanceTraceWidthPanel — UI for impedance-aware trace width enforcement.
 *
 * Displays stackup parameter inputs, a net impedance target table with
 * current/suggested width columns, compliance indicators, and an
 * "Apply Suggestions" button.
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { Activity, Check, X, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  ImpedanceTraceWidthManager,
  calculateImpedance,
} from '@/lib/pcb/impedance-trace-width';
import type {
  StackupParams,
  TraceType,
  WidthSuggestion,
  NetWithTarget,
} from '@/lib/pcb/impedance-trace-width';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImpedanceTraceWidthPanelProps {
  /** Nets with impedance targets to display. If omitted, shows demo data. */
  nets?: NetWithTarget[];
  /** Callback when user clicks "Apply Suggestions". */
  onApplySuggestions?: (suggestions: WidthSuggestion[]) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MATERIAL_PRESETS: Array<{ label: string; er: number }> = [
  { label: 'FR4 (4.4)', er: 4.4 },
  { label: 'Rogers 4003C (3.55)', er: 3.55 },
  { label: 'Rogers 3003 (3.0)', er: 3.0 },
  { label: 'Isola 370HR (3.92)', er: 3.92 },
  { label: 'Megtron 6 (3.71)', er: 3.71 },
];

const DEMO_NETS: NetWithTarget[] = [
  { netId: 'demo-clk', netName: 'CLK', currentWidth: 0.2, targetImpedance: 50 },
  { netId: 'demo-data', netName: 'DATA', currentWidth: 0.15, targetImpedance: 50 },
  { netId: 'demo-usb-dp', netName: 'USB_D+', currentWidth: 0.12, targetImpedance: 90 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImpedanceTraceWidthPanel = memo(function ImpedanceTraceWidthPanel({
  nets,
  onApplySuggestions,
  className,
}: ImpedanceTraceWidthPanelProps) {
  const mgr = ImpedanceTraceWidthManager.getInstance();

  // Stackup parameters state
  const [dielectricConstant, setDielectricConstant] = useState(4.4);
  const [dielectricHeight, setDielectricHeight] = useState(0.2);
  const [copperThickness, setCopperThickness] = useState(0.035);
  const [traceType, setTraceType] = useState<TraceType>('microstrip');
  const [tolerance, setTolerance] = useState(5); // percentage

  // Suggestions state
  const [suggestions, setSuggestions] = useState<WidthSuggestion[]>([]);

  const stackup: StackupParams = {
    dielectricConstant,
    dielectricHeight,
    copperThickness,
    traceType,
  };

  const activeNets = nets ?? DEMO_NETS;

  // Recalculate suggestions when params change
  const recalculate = useCallback(() => {
    mgr.setStackupParams(stackup);
    mgr.setTolerance(tolerance / 100);
    const result = mgr.getWidthSuggestions(activeNets, stackup);
    setSuggestions(result);
  }, [dielectricConstant, dielectricHeight, copperThickness, traceType, tolerance, activeNets, mgr, stackup]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  const handleApply = useCallback(() => {
    if (onApplySuggestions) {
      onApplySuggestions(suggestions);
    }
  }, [onApplySuggestions, suggestions]);

  const handleMaterialPreset = useCallback((value: string) => {
    const preset = MATERIAL_PRESETS.find((p) => p.label === value);
    if (preset) {
      setDielectricConstant(preset.er);
    }
  }, []);

  const nonCompliantCount = suggestions.filter((s) => !s.compliant).length;

  // Compute a quick impedance preview for the current stackup at a reference width
  const previewZ = calculateImpedance(0.2, stackup);
  const previewZDisplay = Number.isNaN(previewZ) ? '—' : `${previewZ.toFixed(1)}Ω`;

  return (
    <div
      className={cn('flex flex-col gap-4 p-4 text-sm', className)}
      data-testid="impedance-trace-width-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2" data-testid="impedance-panel-header">
        <Zap className="h-4 w-4 text-[#00F0FF]" />
        <h3 className="font-semibold text-white">Impedance Trace Width</h3>
        {nonCompliantCount > 0 && (
          <Badge variant="destructive" data-testid="non-compliant-count">
            {nonCompliantCount} non-compliant
          </Badge>
        )}
      </div>

      {/* Stackup Parameters */}
      <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3">
        <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Stackup Parameters
        </h4>

        {/* Material preset */}
        <div className="space-y-1">
          <Label htmlFor="material-preset" className="text-xs text-zinc-400">
            Material Preset
          </Label>
          <Select onValueChange={handleMaterialPreset} data-testid="material-preset-select">
            <SelectTrigger id="material-preset" data-testid="material-preset-trigger">
              <SelectValue placeholder="Select material..." />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_PRESETS.map((p) => (
                <SelectItem key={p.label} value={p.label} data-testid={`material-${p.er}`}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dielectric constant */}
        <div className="space-y-1">
          <Label htmlFor="dielectric-constant" className="text-xs text-zinc-400">
            Dielectric Constant (εr)
          </Label>
          <Input
            id="dielectric-constant"
            type="number"
            step="0.01"
            min="1"
            max="20"
            value={dielectricConstant}
            onChange={(e) => {
              setDielectricConstant(Math.max(1, parseFloat(e.target.value) || 1));
            }}
            data-testid="input-dielectric-constant"
          />
        </div>

        {/* Dielectric height */}
        <div className="space-y-1">
          <Label htmlFor="dielectric-height" className="text-xs text-zinc-400">
            Dielectric Height (mm)
          </Label>
          <Input
            id="dielectric-height"
            type="number"
            step="0.01"
            min="0.01"
            max="5"
            value={dielectricHeight}
            onChange={(e) => {
              setDielectricHeight(Math.max(0.01, parseFloat(e.target.value) || 0.01));
            }}
            data-testid="input-dielectric-height"
          />
        </div>

        {/* Copper thickness */}
        <div className="space-y-1">
          <Label htmlFor="copper-thickness" className="text-xs text-zinc-400">
            Copper Thickness (mm)
          </Label>
          <Input
            id="copper-thickness"
            type="number"
            step="0.001"
            min="0"
            max="0.5"
            value={copperThickness}
            onChange={(e) => {
              setCopperThickness(Math.max(0, parseFloat(e.target.value) || 0));
            }}
            data-testid="input-copper-thickness"
          />
        </div>

        {/* Trace type */}
        <div className="space-y-1">
          <Label htmlFor="trace-type" className="text-xs text-zinc-400">
            Trace Type
          </Label>
          <Select
            value={traceType}
            onValueChange={(v) => { setTraceType(v as TraceType); }}
          >
            <SelectTrigger id="trace-type" data-testid="trace-type-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="microstrip" data-testid="trace-type-microstrip">
                Microstrip (outer layer)
              </SelectItem>
              <SelectItem value="stripline" data-testid="trace-type-stripline">
                Stripline (inner layer)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tolerance */}
        <div className="space-y-1">
          <Label htmlFor="tolerance" className="text-xs text-zinc-400">
            Tolerance (%)
          </Label>
          <Input
            id="tolerance"
            type="number"
            step="1"
            min="0"
            max="100"
            value={tolerance}
            onChange={(e) => {
              setTolerance(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)));
            }}
            data-testid="input-tolerance"
          />
        </div>

        {/* Preview */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Activity className="h-3 w-3" />
          <span>Z₀ at 0.2mm width: {previewZDisplay}</span>
        </div>
      </div>

      {/* Net Impedance Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Net Compliance
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={recalculate}
            className="h-6 px-2 text-xs"
            data-testid="btn-recalculate"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>

        {suggestions.length === 0 ? (
          <p className="text-xs text-zinc-400 italic" data-testid="no-nets-message">
            No nets with impedance targets configured.
          </p>
        ) : (
          <div className="rounded-lg border border-zinc-700 overflow-hidden">
            <table className="w-full text-xs" data-testid="impedance-table">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800/50">
                  <th className="px-2 py-1.5 text-left font-medium text-zinc-400">Net</th>
                  <th className="px-2 py-1.5 text-right font-medium text-zinc-400">Target</th>
                  <th className="px-2 py-1.5 text-right font-medium text-zinc-400">Current</th>
                  <th className="px-2 py-1.5 text-right font-medium text-zinc-400">Suggested</th>
                  <th className="px-2 py-1.5 text-center font-medium text-zinc-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr
                    key={s.netId}
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30"
                    data-testid={`row-${s.netId}`}
                  >
                    <td className="px-2 py-1.5 font-mono text-zinc-200">{s.netName}</td>
                    <td className="px-2 py-1.5 text-right text-zinc-400">
                      {s.targetZ}Ω
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-300">
                      {s.currentWidth.toFixed(3)}mm
                      <span className="ml-1 text-zinc-400">({s.actualZ}Ω)</span>
                    </td>
                    <td
                      className={cn(
                        'px-2 py-1.5 text-right font-mono',
                        s.compliant ? 'text-zinc-400' : 'text-[#00F0FF]',
                      )}
                    >
                      {s.suggestedWidth.toFixed(3)}mm
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {s.compliant ? (
                        <Check
                          className="inline h-3.5 w-3.5 text-green-400"
                          data-testid={`status-pass-${s.netId}`}
                        />
                      ) : (
                        <X
                          className="inline h-3.5 w-3.5 text-red-400"
                          data-testid={`status-fail-${s.netId}`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply button */}
      {nonCompliantCount > 0 && onApplySuggestions && (
        <Button
          onClick={handleApply}
          className="w-full bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30"
          data-testid="btn-apply-suggestions"
        >
          <Zap className="h-4 w-4 mr-2" />
          Apply Suggestions ({nonCompliantCount} net{nonCompliantCount !== 1 ? 's' : ''})
        </Button>
      )}
    </div>
  );
});
