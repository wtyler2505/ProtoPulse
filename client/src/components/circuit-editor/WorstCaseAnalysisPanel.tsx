import { useState, useSyncExternalStore, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Play, BarChart3, AlertTriangle } from 'lucide-react';
import {
  worstCaseAnalyzer,
  type WCAParameter,
  type WCAResult,
  type ToleranceType,
  type CornerType,
} from '@/lib/simulation/worst-case-analysis';

// ---------------------------------------------------------------------------
// Store hook
// ---------------------------------------------------------------------------

function useWorstCaseAnalyzer() {
  const subscribe = useCallback(
    (cb: () => void) => worstCaseAnalyzer.subscribe(cb),
    [],
  );
  const getSnapshot = useCallback(() => worstCaseAnalyzer.getState(), []);
  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// Corner type display labels
// ---------------------------------------------------------------------------

const CORNER_LABELS: Record<CornerType, string> = {
  nominal: 'Nominal',
  all_min: 'All Min',
  all_max: 'All Max',
  rss_min: 'RSS Min',
  rss_max: 'RSS Max',
};

const CORNER_COLORS: Record<CornerType, string> = {
  nominal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  all_min: 'bg-red-500/20 text-red-400 border-red-500/30',
  all_max: 'bg-red-500/20 text-red-400 border-red-500/30',
  rss_min: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  rss_max: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

// ---------------------------------------------------------------------------
// Add Parameter Form
// ---------------------------------------------------------------------------

interface AddParamFormState {
  id: string;
  name: string;
  nominal: string;
  tolerance: string;
  toleranceType: ToleranceType;
}

const EMPTY_FORM: AddParamFormState = {
  id: '',
  name: '',
  nominal: '',
  tolerance: '',
  toleranceType: 'percentage',
};

function AddParameterForm({ onAdd }: { onAdd: (p: WCAParameter) => void }) {
  const [form, setForm] = useState<AddParamFormState>({ ...EMPTY_FORM });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseFloat(form.nominal);
    const tolerance = parseFloat(form.tolerance);
    if (!form.id.trim() || isNaN(nominal) || isNaN(tolerance) || tolerance < 0) {
      return;
    }
    onAdd({
      id: form.id.trim(),
      name: form.name.trim() || form.id.trim(),
      nominal,
      tolerance: form.toleranceType === 'percentage' ? tolerance / 100 : tolerance,
      toleranceType: form.toleranceType,
    });
    setForm({ ...EMPTY_FORM });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2" data-testid="wca-add-form">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="wca-param-id" className="text-xs text-muted-foreground">ID</Label>
          <Input
            id="wca-param-id"
            data-testid="wca-param-id"
            value={form.id}
            onChange={(e) => { setForm((f) => ({ ...f, id: e.target.value })); }}
            placeholder="R1"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label htmlFor="wca-param-name" className="text-xs text-muted-foreground">Name</Label>
          <Input
            id="wca-param-name"
            data-testid="wca-param-name"
            value={form.name}
            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); }}
            placeholder="R1 Resistance"
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="wca-param-nominal" className="text-xs text-muted-foreground">Nominal</Label>
          <Input
            id="wca-param-nominal"
            data-testid="wca-param-nominal"
            type="number"
            value={form.nominal}
            onChange={(e) => { setForm((f) => ({ ...f, nominal: e.target.value })); }}
            placeholder="10000"
            className="h-7 text-xs"
          />
        </div>
        <div>
          <Label htmlFor="wca-param-tolerance" className="text-xs text-muted-foreground">
            Tolerance{form.toleranceType === 'percentage' ? ' (%)' : ''}
          </Label>
          <Input
            id="wca-param-tolerance"
            data-testid="wca-param-tolerance"
            type="number"
            value={form.tolerance}
            onChange={(e) => { setForm((f) => ({ ...f, tolerance: e.target.value })); }}
            placeholder={form.toleranceType === 'percentage' ? '5' : '500'}
            className="h-7 text-xs"
            min="0"
          />
        </div>
        <div>
          <Label htmlFor="wca-param-type" className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={form.toleranceType}
            onValueChange={(v) => { setForm((f) => ({ ...f, toleranceType: v as ToleranceType })); }}
          >
            <SelectTrigger id="wca-param-type" data-testid="wca-param-type" className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">%</SelectItem>
              <SelectItem value="absolute">Abs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="submit"
        size="sm"
        variant="secondary"
        className="w-full h-7 text-xs"
        data-testid="wca-add-button"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Parameter
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Parameter Table
// ---------------------------------------------------------------------------

function ParameterTable({
  parameters,
  onRemove,
}: {
  parameters: WCAParameter[];
  onRemove: (id: string) => void;
}) {
  if (parameters.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4" data-testid="wca-empty-params">
        No parameters defined. Add components with tolerances above.
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="wca-param-table">
      {parameters.map((p) => {
        const displayTol = p.toleranceType === 'percentage'
          ? `${(p.tolerance * 100).toFixed(1)}%`
          : `\u00B1${p.tolerance}`;
        return (
          <div
            key={p.id}
            className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 text-xs"
            data-testid={`wca-param-row-${p.id}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-medium text-[#00F0FF] shrink-0">{p.id}</span>
              <span className="text-muted-foreground truncate">{p.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                {p.nominal}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                {displayTol}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={() => { onRemove(p.id); }}
                aria-label={`Remove ${p.id}`}
                data-testid={`wca-remove-${p.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results Display
// ---------------------------------------------------------------------------

function CornerResultsTable({ result }: { result: WCAResult }) {
  return (
    <div className="space-y-1" data-testid="wca-corner-results">
      <div className="text-xs font-medium text-muted-foreground mb-1">Corner Analysis</div>
      {result.corners.map((corner) => {
        const isWorst =
          corner.result === result.minResult || corner.result === result.maxResult;
        return (
          <div
            key={corner.type}
            className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
              isWorst && corner.type !== 'nominal' ? 'ring-1 ring-[#00F0FF]/40' : 'bg-muted/30'
            }`}
            data-testid={`wca-corner-${corner.type}`}
          >
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${CORNER_COLORS[corner.type]}`}
            >
              {CORNER_LABELS[corner.type]}
            </Badge>
            <div className="flex items-center gap-3">
              <span className="font-mono">{corner.result.toPrecision(6)}</span>
              {corner.type !== 'nominal' && (
                <span
                  className={`font-mono text-[10px] ${
                    corner.deviation >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {corner.deviation >= 0 ? '+' : ''}{corner.deviation.toPrecision(4)}
                </span>
              )}
              {isWorst && corner.type !== 'nominal' && (
                <AlertTriangle className="h-3 w-3 text-amber-400" />
              )}
            </div>
          </div>
        );
      })}

      <div
        className="flex items-center justify-between px-2 py-2 mt-2 rounded bg-[#00F0FF]/5 border border-[#00F0FF]/20 text-xs"
        data-testid="wca-spread"
      >
        <span className="font-medium text-[#00F0FF]">Total Spread</span>
        <span className="font-mono font-medium text-[#00F0FF]">
          {result.spread.toPrecision(6)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sensitivity Bar Chart (SVG)
// ---------------------------------------------------------------------------

function SensitivityChart({ result }: { result: WCAResult }) {
  const sensitivities = result.sensitivities
    .slice()
    .sort((a, b) => b.influence - a.influence);

  if (sensitivities.length === 0) {
    return null;
  }

  const barHeight = 20;
  const labelWidth = 60;
  const chartWidth = 200;
  const padding = 4;
  const totalHeight = sensitivities.length * (barHeight + padding) + padding;

  return (
    <div data-testid="wca-sensitivity-chart">
      <div className="text-xs font-medium text-muted-foreground mb-1">
        <BarChart3 className="h-3 w-3 inline mr-1" />
        Parameter Sensitivity
      </div>
      <svg
        width="100%"
        height={totalHeight}
        viewBox={`0 0 ${labelWidth + chartWidth + 60} ${totalHeight}`}
        className="text-xs"
      >
        {sensitivities.map((s, i) => {
          const y = i * (barHeight + padding) + padding;
          const barW = Math.max(1, s.influence * chartWidth);
          const color = s.direction === 'positive' ? '#22c55e' : '#ef4444';

          return (
            <g key={s.parameterId} data-testid={`wca-sensitivity-bar-${s.parameterId}`}>
              {/* Label */}
              <text
                x={labelWidth - 4}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                fill="currentColor"
                className="text-[10px] fill-muted-foreground"
              >
                {s.parameterId}
              </text>
              {/* Bar */}
              <rect
                x={labelWidth}
                y={y + 2}
                width={barW}
                height={barHeight - 4}
                rx={2}
                fill={color}
                opacity={0.7}
              />
              {/* Value */}
              <text
                x={labelWidth + barW + 4}
                y={y + barHeight / 2 + 4}
                fill="currentColor"
                className="text-[10px] fill-muted-foreground"
              >
                {(s.influence * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function WorstCaseAnalysisPanel() {
  const { parameters, result, running } = useWorstCaseAnalyzer();
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback((param: WCAParameter) => {
    worstCaseAnalyzer.addParameter(param);
    setError(null);
  }, []);

  const handleRemove = useCallback((id: string) => {
    worstCaseAnalyzer.removeParameter(id);
    setError(null);
  }, []);

  const handleRun = useCallback(() => {
    setError(null);
    try {
      // Default evaluation function: sum of all parameters (basic sanity)
      // In real usage, the parent component would provide the circuit eval function
      // via worstCaseAnalyzer.runAnalysis(circuitEvalFn) before rendering this panel.
      // For standalone demo, we use identity sum.
      worstCaseAnalyzer.runAnalysis((values) => {
        let sum = 0;
        for (const key of Object.keys(values)) {
          sum += values[key]!;
        }
        return sum;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
  }, []);

  return (
    <Card className="border-border/50" data-testid="wca-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#00F0FF]" />
          Worst-Case Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add parameter form */}
        <AddParameterForm onAdd={handleAdd} />

        {/* Parameter list */}
        <ParameterTable parameters={parameters} onRemove={handleRemove} />

        {/* Run button */}
        <Button
          onClick={handleRun}
          disabled={parameters.length === 0 || running}
          className="w-full h-8 text-xs bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30"
          variant="outline"
          data-testid="wca-run-button"
        >
          <Play className="h-3 w-3 mr-1" />
          {running ? 'Running...' : 'Run Analysis'}
        </Button>

        {/* Error */}
        {error && (
          <div
            className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5"
            data-testid="wca-error"
          >
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              <CornerResultsTable result={result} />
              <SensitivityChart result={result} />
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
