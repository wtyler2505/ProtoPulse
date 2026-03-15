/**
 * CalculatorsView — Built-in electronics calculators for makers and learners.
 *
 * Grid of calculator cards covering Ohm's law, LED resistors, voltage dividers,
 * RC time constants, filter cutoff frequencies, and power dissipation.
 */

import { useCallback, useState } from 'react';
import {
  Calculator,
  Lightbulb,
  GitFork,
  Timer,
  Radio,
  Zap,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { solveOhmsLaw } from '@/lib/calculators/ohms-law';
import { solveLedResistor } from '@/lib/calculators/led-resistor';
import { solveVoltageDivider, suggestVoltageDividerPairs } from '@/lib/calculators/voltage-divider';
import { solveRcTimeConstant } from '@/lib/calculators/rc-time-constant';
import { solveRcFilter, solveBandpassFilter } from '@/lib/calculators/filter-cutoff';
import { solvePowerDissipation } from '@/lib/calculators/power-dissipation';
import { formatEngineering } from '@/lib/calculators/types';
import type { CalculatorError } from '@/lib/calculators/types';
import { CalcApplyButtons } from '@/components/ui/CalcApplyButtons';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ResultRow({
  label,
  value,
  testId,
  accent = false,
}: {
  label: string;
  value: string;
  testId: string;
  accent?: boolean;
}) {
  return (
    <div data-testid={testId} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-mono font-semibold', accent ? 'text-[#00F0FF]' : 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

function ErrorDisplay({ errors, testId }: { errors: CalculatorError[]; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-md bg-destructive/10 border border-destructive/20 p-2 space-y-1">
      {errors.map((err) => (
        <p key={`${err.field}-${err.message}`} className="text-xs text-destructive">
          {err.message}
        </p>
      ))}
    </div>
  );
}

function useNumericInput(initial = ''): [string, number | undefined, (v: string) => void] {
  const [raw, setRaw] = useState(initial);
  const parsed = raw.trim() === '' ? undefined : Number(raw);
  const value = parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
  return [raw, value, setRaw];
}

// ---------------------------------------------------------------------------
// Ohm's Law Calculator
// ---------------------------------------------------------------------------

function OhmsLawCard() {
  const [voltageRaw, voltage, setVoltage] = useNumericInput();
  const [currentRaw, current, setCurrent] = useNumericInput();
  const [resistanceRaw, resistance, setResistance] = useNumericInput();

  const [result, setResult] = useState<ReturnType<typeof solveOhmsLaw> | null>(null);

  const handleCalculate = useCallback(() => {
    setResult(solveOhmsLaw({ voltage, current, resistance }));
  }, [voltage, current, resistance]);

  const handleReset = useCallback(() => {
    setVoltage('');
    setCurrent('');
    setResistance('');
    setResult(null);
  }, [setVoltage, setCurrent, setResistance]);

  return (
    <Card data-testid="calc-ohms-card" className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="w-4 h-4 text-[#00F0FF]" />
          {"Ohm's Law"}
        </CardTitle>
        <CardDescription>V = I x R — enter any 2 values</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="ohms-voltage" className="text-xs">Voltage (V)</Label>
            <Input
              id="ohms-voltage"
              data-testid="calc-ohms-voltage-input"
              type="number"
              placeholder="V"
              value={voltageRaw}
              onChange={(e) => setVoltage(e.target.value)}
              min={0}
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="ohms-current" className="text-xs">Current (A)</Label>
            <Input
              id="ohms-current"
              data-testid="calc-ohms-current-input"
              type="number"
              placeholder="A"
              value={currentRaw}
              onChange={(e) => setCurrent(e.target.value)}
              min={0}
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="ohms-resistance" className="text-xs">{`Resistance (\u03A9)`}</Label>
            <Input
              id="ohms-resistance"
              data-testid="calc-ohms-resistance-input"
              type="number"
              placeholder={'\u03A9'}
              value={resistanceRaw}
              onChange={(e) => setResistance(e.target.value)}
              min={0}
              step="any"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button data-testid="calc-ohms-calculate-btn" size="sm" onClick={handleCalculate} className="flex-1">
            Calculate
          </Button>
          <Button data-testid="calc-ohms-reset-btn" size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
        {result && 'errors' in result && <ErrorDisplay errors={result.errors} testId="calc-ohms-errors" />}
        {result && 'result' in result && (
          <div data-testid="calc-ohms-results" className="space-y-0.5">
            <ResultRow label="Voltage" value={result.result.voltage.formatted} testId="calc-ohms-voltage-result" accent />
            <ResultRow label="Current" value={result.result.current.formatted} testId="calc-ohms-current-result" accent />
            <ResultRow label="Resistance" value={result.result.resistance.formatted} testId="calc-ohms-resistance-result" accent />
            <ResultRow label="Power" value={result.result.power.formatted} testId="calc-ohms-power-result" accent />
            <CalcApplyButtons
              result={{
                calculatorName: 'ohms-law',
                resultName: 'Resistance',
                value: result.result.resistance.value,
                unit: result.result.resistance.unit,
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LED Resistor Calculator
// ---------------------------------------------------------------------------

function LedResistorCard() {
  const [vsRaw, vs, setVs] = useNumericInput('5');
  const [vfRaw, vf, setVf] = useNumericInput('2');
  const [ifRaw, ifVal, setIf] = useNumericInput('0.02');

  const [result, setResult] = useState<ReturnType<typeof solveLedResistor> | null>(null);

  const handleCalculate = useCallback(() => {
    if (vs === undefined || vf === undefined || ifVal === undefined) {
      setResult({ errors: [{ field: 'general', message: 'All fields are required' }] });
      return;
    }
    setResult(solveLedResistor({ supplyVoltage: vs, forwardVoltage: vf, forwardCurrent: ifVal }));
  }, [vs, vf, ifVal]);

  const handleReset = useCallback(() => {
    setVs('5');
    setVf('2');
    setIf('0.02');
    setResult(null);
  }, [setVs, setVf, setIf]);

  return (
    <Card data-testid="calc-led-card" className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="w-4 h-4 text-[#00F0FF]" />
          LED Resistor
        </CardTitle>
        <CardDescription>R = (Vs - Vf) / If</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="led-vs" className="text-xs">Supply (V)</Label>
            <Input
              id="led-vs"
              data-testid="calc-led-supply-input"
              type="number"
              placeholder="5"
              value={vsRaw}
              onChange={(e) => setVs(e.target.value)}
              min={0}
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="led-vf" className="text-xs">Vf (V)</Label>
            <Input
              id="led-vf"
              data-testid="calc-led-forward-voltage-input"
              type="number"
              placeholder="2"
              value={vfRaw}
              onChange={(e) => setVf(e.target.value)}
              min={0}
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="led-if" className="text-xs">If (A)</Label>
            <Input
              id="led-if"
              data-testid="calc-led-forward-current-input"
              type="number"
              placeholder="0.02"
              value={ifRaw}
              onChange={(e) => setIf(e.target.value)}
              min={0}
              step="any"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button data-testid="calc-led-calculate-btn" size="sm" onClick={handleCalculate} className="flex-1">
            Calculate
          </Button>
          <Button data-testid="calc-led-reset-btn" size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
        {result && 'errors' in result && <ErrorDisplay errors={result.errors} testId="calc-led-errors" />}
        {result && 'result' in result && (
          <div data-testid="calc-led-results" className="space-y-0.5">
            <ResultRow label="Exact R" value={result.result.resistor.formatted} testId="calc-led-exact-result" accent />
            <ResultRow label="Nearest E24" value={result.result.resistor.nearestE24Formatted} testId="calc-led-e24-result" accent />
            <ResultRow label="Nearest E96" value={result.result.resistor.nearestE96Formatted} testId="calc-led-e96-result" accent />
            <ResultRow
              label="Current (E24)"
              value={formatEngineering(result.result.actualCurrentE24, 'A')}
              testId="calc-led-actual-current-result"
            />
            <ResultRow
              label="Resistor Power"
              value={formatEngineering(result.result.resistorPower, 'W')}
              testId="calc-led-power-result"
            />
            <CalcApplyButtons
              result={{
                calculatorName: 'led-resistor',
                resultName: 'Nearest E24',
                value: result.result.resistor.nearestE24,
                unit: '\u03A9',
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Voltage Divider Calculator
// ---------------------------------------------------------------------------

function VoltageDividerCard() {
  const [tab, setTab] = useState('forward');
  const [r1Raw, r1, setR1] = useNumericInput('10000');
  const [r2Raw, r2, setR2] = useNumericInput('10000');
  const [vinRaw, vin, setVin] = useNumericInput('5');
  const [targetVoutRaw, targetVout, setTargetVout] = useNumericInput('3.3');

  const [forwardResult, setForwardResult] = useState<ReturnType<typeof solveVoltageDivider> | null>(null);
  const [reverseResult, setReverseResult] = useState<ReturnType<typeof suggestVoltageDividerPairs> | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const handleForward = useCallback(() => {
    if (r1 === undefined || r2 === undefined || vin === undefined) {
      setForwardResult({ errors: [{ field: 'general', message: 'All fields are required' }] });
      return;
    }
    setForwardResult(solveVoltageDivider({ r1, r2, vin }));
  }, [r1, r2, vin]);

  const handleReverse = useCallback(() => {
    if (vin === undefined || targetVout === undefined) {
      setReverseResult({ errors: [{ field: 'general', message: 'All fields are required' }] });
      return;
    }
    setReverseResult(suggestVoltageDividerPairs({ vin, targetVout }));
    setShowAllSuggestions(false);
  }, [vin, targetVout]);

  const handleReset = useCallback(() => {
    setR1('10000');
    setR2('10000');
    setVin('5');
    setTargetVout('3.3');
    setForwardResult(null);
    setReverseResult(null);
  }, [setR1, setR2, setVin, setTargetVout]);

  return (
    <Card data-testid="calc-divider-card" className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <GitFork className="w-4 h-4 text-[#00F0FF]" />
          Voltage Divider
        </CardTitle>
        <CardDescription>Vout = Vin x R2 / (R1 + R2)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="forward" data-testid="calc-divider-forward-tab" className="flex-1">
              Forward
            </TabsTrigger>
            <TabsTrigger value="reverse" data-testid="calc-divider-reverse-tab" className="flex-1">
              Reverse
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forward" className="space-y-3 mt-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="div-r1" className="text-xs">{`R1 (\u03A9)`}</Label>
                <Input
                  id="div-r1"
                  data-testid="calc-divider-r1-input"
                  type="number"
                  value={r1Raw}
                  onChange={(e) => setR1(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div>
                <Label htmlFor="div-r2" className="text-xs">{`R2 (\u03A9)`}</Label>
                <Input
                  id="div-r2"
                  data-testid="calc-divider-r2-input"
                  type="number"
                  value={r2Raw}
                  onChange={(e) => setR2(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div>
                <Label htmlFor="div-vin" className="text-xs">Vin (V)</Label>
                <Input
                  id="div-vin"
                  data-testid="calc-divider-vin-input"
                  type="number"
                  value={vinRaw}
                  onChange={(e) => setVin(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button data-testid="calc-divider-forward-btn" size="sm" onClick={handleForward} className="flex-1">
                Calculate
              </Button>
              <Button data-testid="calc-divider-reset-btn" size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            {forwardResult && 'errors' in forwardResult && (
              <ErrorDisplay errors={forwardResult.errors} testId="calc-divider-forward-errors" />
            )}
            {forwardResult && 'result' in forwardResult && (
              <div data-testid="calc-divider-forward-results" className="space-y-0.5">
                <ResultRow label="Vout" value={forwardResult.result.vout.formatted} testId="calc-divider-vout-result" accent />
                <ResultRow label="Ratio" value={`${(forwardResult.result.ratio * 100).toFixed(1)}%`} testId="calc-divider-ratio-result" />
                <ResultRow label="Current" value={forwardResult.result.current.formatted} testId="calc-divider-current-result" />
                <ResultRow label="Total Power" value={forwardResult.result.totalPower.formatted} testId="calc-divider-power-result" />
                <CalcApplyButtons
                  result={{
                    calculatorName: 'voltage-divider',
                    resultName: 'Vout',
                    value: forwardResult.result.vout.value,
                    unit: 'V',
                  }}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="reverse" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="div-rev-vin" className="text-xs">Vin (V)</Label>
                <Input
                  id="div-rev-vin"
                  data-testid="calc-divider-rev-vin-input"
                  type="number"
                  value={vinRaw}
                  onChange={(e) => setVin(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div>
                <Label htmlFor="div-rev-vout" className="text-xs">Target Vout (V)</Label>
                <Input
                  id="div-rev-vout"
                  data-testid="calc-divider-rev-vout-input"
                  type="number"
                  value={targetVoutRaw}
                  onChange={(e) => setTargetVout(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button data-testid="calc-divider-reverse-btn" size="sm" onClick={handleReverse} className="flex-1">
                Suggest R Values
              </Button>
              <Button data-testid="calc-divider-rev-reset-btn" size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            {reverseResult && 'errors' in reverseResult && (
              <ErrorDisplay errors={reverseResult.errors} testId="calc-divider-reverse-errors" />
            )}
            {reverseResult && 'result' in reverseResult && reverseResult.result.length > 0 && (
              <div data-testid="calc-divider-suggestions" className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Best R1/R2 Pairs (E24)
                </div>
                {reverseResult.result.slice(0, showAllSuggestions ? 10 : 3).map((s, i) => (
                  <div
                    key={`${s.r1}-${s.r2}`}
                    data-testid={`calc-divider-suggestion-${i}`}
                    className="flex items-center justify-between text-xs px-2 py-1.5 bg-muted/30 rounded"
                  >
                    <span className="font-mono">
                      {s.r1Formatted} / {s.r2Formatted}
                    </span>
                    <span className="text-[#00F0FF] font-mono">
                      {formatEngineering(s.actualVout, 'V')} ({s.errorPercent.toFixed(2)}%)
                    </span>
                  </div>
                ))}
                {reverseResult.result.length > 3 && !showAllSuggestions && (
                  <Button
                    data-testid="calc-divider-show-more-btn"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAllSuggestions(true)}
                    className="w-full text-xs"
                  >
                    <ChevronDown className="w-3.5 h-3.5 mr-1" />
                    Show {reverseResult.result.length - 3} more
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// RC Time Constant Calculator
// ---------------------------------------------------------------------------

function RcTimeConstantCard() {
  const [rRaw, r, setR] = useNumericInput('10000');
  const [cRaw, c, setC] = useNumericInput('0.000001');

  const [result, setResult] = useState<ReturnType<typeof solveRcTimeConstant> | null>(null);

  const handleCalculate = useCallback(() => {
    if (r === undefined || c === undefined) {
      setResult({ errors: [{ field: 'general', message: 'Both fields are required' }] });
      return;
    }
    setResult(solveRcTimeConstant({ resistance: r, capacitance: c }));
  }, [r, c]);

  const handleReset = useCallback(() => {
    setR('10000');
    setC('0.000001');
    setResult(null);
  }, [setR, setC]);

  return (
    <Card data-testid="calc-rc-card" className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Timer className="w-4 h-4 text-[#00F0FF]" />
          RC Time Constant
        </CardTitle>
        <CardDescription>{'\u03C4 = R \u00D7 C, fc = 1/(2\u03C0RC)'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="rc-r" className="text-xs">{`Resistance (\u03A9)`}</Label>
            <Input
              id="rc-r"
              data-testid="calc-rc-resistance-input"
              type="number"
              value={rRaw}
              onChange={(e) => setR(e.target.value)}
              min={0}
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="rc-c" className="text-xs">Capacitance (F)</Label>
            <Input
              id="rc-c"
              data-testid="calc-rc-capacitance-input"
              type="number"
              value={cRaw}
              onChange={(e) => setC(e.target.value)}
              min={0}
              step="any"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button data-testid="calc-rc-calculate-btn" size="sm" onClick={handleCalculate} className="flex-1">
            Calculate
          </Button>
          <Button data-testid="calc-rc-reset-btn" size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
        {result && 'errors' in result && <ErrorDisplay errors={result.errors} testId="calc-rc-errors" />}
        {result && 'result' in result && (
          <div data-testid="calc-rc-results" className="space-y-0.5">
            <ResultRow label="Time Constant" value={result.result.tau.formatted} testId="calc-rc-tau-result" accent />
            <ResultRow label="Settling (5\u03C4)" value={result.result.settlingTime.formatted} testId="calc-rc-settling-result" accent />
            <ResultRow label="Cutoff Freq" value={result.result.cutoffFrequency.formatted} testId="calc-rc-frequency-result" accent />
            <div className="pt-1.5 mt-1.5 border-t border-border/30">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Charge Times
              </div>
              {result.result.chargeTimes.map(({ percent, time }) => (
                <ResultRow
                  key={percent}
                  label={`${percent}%`}
                  value={time.formatted}
                  testId={`calc-rc-charge-${percent}`}
                />
              ))}
            </div>
            <CalcApplyButtons
              result={{
                calculatorName: 'rc-time-constant',
                resultName: 'Cutoff Frequency',
                value: result.result.cutoffFrequency.value,
                unit: 'Hz',
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Filter Cutoff Calculator
// ---------------------------------------------------------------------------

function FilterCutoffCard() {
  const [filterTab, setFilterTab] = useState('rc');

  // RC filter inputs
  const [filterTypeState, setFilterType] = useState<'low-pass' | 'high-pass'>('low-pass');
  const [rcRRaw, rcR, setRcR] = useNumericInput('10000');
  const [rcCRaw, rcC, setRcC] = useNumericInput('0.0000001');

  // Bandpass inputs
  const [bpRRaw, bpR, setBpR] = useNumericInput('100');
  const [bpLRaw, bpL, setBpL] = useNumericInput('0.01');
  const [bpCRaw, bpC, setBpC] = useNumericInput('0.0000001');

  const [rcResult, setRcResult] = useState<ReturnType<typeof solveRcFilter> | null>(null);
  const [bpResult, setBpResult] = useState<ReturnType<typeof solveBandpassFilter> | null>(null);

  const handleRcCalculate = useCallback(() => {
    if (rcR === undefined || rcC === undefined) {
      setRcResult({ errors: [{ field: 'general', message: 'Both fields are required' }] });
      return;
    }
    setRcResult(solveRcFilter({ filterType: filterTypeState, resistance: rcR, capacitance: rcC }));
  }, [rcR, rcC, filterTypeState]);

  const handleBpCalculate = useCallback(() => {
    if (bpR === undefined || bpL === undefined || bpC === undefined) {
      setBpResult({ errors: [{ field: 'general', message: 'All fields are required' }] });
      return;
    }
    setBpResult(solveBandpassFilter({ resistance: bpR, inductance: bpL, capacitance: bpC }));
  }, [bpR, bpL, bpC]);

  const handleReset = useCallback(() => {
    setRcR('10000');
    setRcC('0.0000001');
    setBpR('100');
    setBpL('0.01');
    setBpC('0.0000001');
    setRcResult(null);
    setBpResult(null);
  }, [setRcR, setRcC, setBpR, setBpL, setBpC]);

  return (
    <Card data-testid="calc-filter-card" className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Radio className="w-4 h-4 text-[#00F0FF]" />
          Filter Cutoff
        </CardTitle>
        <CardDescription>Low-pass, high-pass, and bandpass</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={filterTab} onValueChange={setFilterTab}>
          <TabsList className="w-full">
            <TabsTrigger value="rc" data-testid="calc-filter-rc-tab" className="flex-1">
              RC Filter
            </TabsTrigger>
            <TabsTrigger value="bandpass" data-testid="calc-filter-bandpass-tab" className="flex-1">
              Bandpass
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rc" className="space-y-3 mt-3">
            <div className="flex gap-2 mb-2">
              <Button
                data-testid="calc-filter-lowpass-btn"
                size="sm"
                variant={filterTypeState === 'low-pass' ? 'default' : 'outline'}
                onClick={() => setFilterType('low-pass')}
                className="flex-1"
              >
                Low-pass
              </Button>
              <Button
                data-testid="calc-filter-highpass-btn"
                size="sm"
                variant={filterTypeState === 'high-pass' ? 'default' : 'outline'}
                onClick={() => setFilterType('high-pass')}
                className="flex-1"
              >
                High-pass
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="filter-rc-r" className="text-xs">{`R (\u03A9)`}</Label>
                <Input
                  id="filter-rc-r"
                  data-testid="calc-filter-resistance-input"
                  type="number"
                  value={rcRRaw}
                  onChange={(e) => setRcR(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div>
                <Label htmlFor="filter-rc-c" className="text-xs">C (F)</Label>
                <Input
                  id="filter-rc-c"
                  data-testid="calc-filter-capacitance-input"
                  type="number"
                  value={rcCRaw}
                  onChange={(e) => setRcC(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button data-testid="calc-filter-rc-btn" size="sm" onClick={handleRcCalculate} className="flex-1">
                Calculate
              </Button>
              <Button data-testid="calc-filter-reset-btn" size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            {rcResult && 'errors' in rcResult && (
              <ErrorDisplay errors={rcResult.errors} testId="calc-filter-rc-errors" />
            )}
            {rcResult && 'result' in rcResult && (
              <div data-testid="calc-filter-rc-results" className="space-y-0.5">
                <ResultRow label="Cutoff Freq" value={rcResult.result.cutoffFrequency.formatted} testId="calc-filter-fc-result" accent />
                <ResultRow label="Angular" value={rcResult.result.omegaCutoff.formatted} testId="calc-filter-omega-result" />
                <ResultRow label="Time Constant" value={rcResult.result.timeConstant.formatted} testId="calc-filter-tau-result" />
                <CalcApplyButtons
                  result={{
                    calculatorName: 'filter-cutoff',
                    resultName: 'Cutoff Frequency',
                    value: rcResult.result.cutoffFrequency.value,
                    unit: 'Hz',
                  }}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="bandpass" className="space-y-3 mt-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="filter-bp-r" className="text-xs">{`R (\u03A9)`}</Label>
                <Input
                  id="filter-bp-r"
                  data-testid="calc-filter-bp-resistance-input"
                  type="number"
                  value={bpRRaw}
                  onChange={(e) => setBpR(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div>
                <Label htmlFor="filter-bp-l" className="text-xs">L (H)</Label>
                <Input
                  id="filter-bp-l"
                  data-testid="calc-filter-bp-inductance-input"
                  type="number"
                  value={bpLRaw}
                  onChange={(e) => setBpL(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div>
                <Label htmlFor="filter-bp-c" className="text-xs">C (F)</Label>
                <Input
                  id="filter-bp-c"
                  data-testid="calc-filter-bp-capacitance-input"
                  type="number"
                  value={bpCRaw}
                  onChange={(e) => setBpC(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button data-testid="calc-filter-bp-btn" size="sm" onClick={handleBpCalculate} className="flex-1">
                Calculate
              </Button>
              <Button data-testid="calc-filter-bp-reset-btn" size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
            {bpResult && 'errors' in bpResult && (
              <ErrorDisplay errors={bpResult.errors} testId="calc-filter-bp-errors" />
            )}
            {bpResult && 'result' in bpResult && (
              <div data-testid="calc-filter-bp-results" className="space-y-0.5">
                <ResultRow label="Center Freq" value={bpResult.result.centerFrequency.formatted} testId="calc-filter-bp-center-result" accent />
                <ResultRow label="Bandwidth" value={bpResult.result.bandwidth.formatted} testId="calc-filter-bp-bw-result" accent />
                <ResultRow label="Lower -3dB" value={bpResult.result.lowerCutoff.formatted} testId="calc-filter-bp-lower-result" />
                <ResultRow label="Upper -3dB" value={bpResult.result.upperCutoff.formatted} testId="calc-filter-bp-upper-result" />
                <ResultRow label="Q Factor" value={bpResult.result.qualityFactor.toFixed(2)} testId="calc-filter-bp-q-result" />
                <CalcApplyButtons
                  result={{
                    calculatorName: 'filter-cutoff',
                    resultName: 'Center Frequency',
                    value: bpResult.result.centerFrequency.value,
                    unit: 'Hz',
                  }}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Power Dissipation Calculator
// ---------------------------------------------------------------------------

function PowerDissipationCard() {
  const [powerRaw, power, setPower] = useNumericInput();
  const [currentRaw, current, setCurrent] = useNumericInput();
  const [voltageRaw, voltage, setVoltage] = useNumericInput();
  const [resistanceRaw, resistance, setResistance] = useNumericInput();

  const [result, setResult] = useState<ReturnType<typeof solvePowerDissipation> | null>(null);

  const handleCalculate = useCallback(() => {
    setResult(solvePowerDissipation({ power, current, voltage, resistance }));
  }, [power, current, voltage, resistance]);

  const handleReset = useCallback(() => {
    setPower('');
    setCurrent('');
    setVoltage('');
    setResistance('');
    setResult(null);
  }, [setPower, setCurrent, setVoltage, setResistance]);

  return (
    <Card data-testid="calc-power-card" className="bg-card/60 backdrop-blur-xl border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Zap className="w-4 h-4 text-[#00F0FF]" />
          Power Dissipation
        </CardTitle>
        <CardDescription>P=IV, P=I{'\u00B2'}R, P=V{'\u00B2'}/R — enter any 2</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="pwr-p" className="text-xs">Power (W)</Label>
            <Input
              id="pwr-p"
              data-testid="calc-power-power-input"
              type="number"
              placeholder="W"
              value={powerRaw}
              onChange={(e) => setPower(e.target.value)}
              min={0}
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="pwr-i" className="text-xs">Current (A)</Label>
            <Input
              id="pwr-i"
              data-testid="calc-power-current-input"
              type="number"
              placeholder="A"
              value={currentRaw}
              onChange={(e) => setCurrent(e.target.value)}
              min={0}
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="pwr-v" className="text-xs">Voltage (V)</Label>
            <Input
              id="pwr-v"
              data-testid="calc-power-voltage-input"
              type="number"
              placeholder="V"
              value={voltageRaw}
              onChange={(e) => setVoltage(e.target.value)}
              min={0}
              step="any"
            />
          </div>
          <div>
            <Label htmlFor="pwr-r" className="text-xs">{`Resistance (\u03A9)`}</Label>
            <Input
              id="pwr-r"
              data-testid="calc-power-resistance-input"
              type="number"
              placeholder={'\u03A9'}
              value={resistanceRaw}
              onChange={(e) => setResistance(e.target.value)}
              min={0}
              step="any"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button data-testid="calc-power-calculate-btn" size="sm" onClick={handleCalculate} className="flex-1">
            Calculate
          </Button>
          <Button data-testid="calc-power-reset-btn" size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
        {result && 'errors' in result && <ErrorDisplay errors={result.errors} testId="calc-power-errors" />}
        {result && 'result' in result && (
          <div data-testid="calc-power-results" className="space-y-0.5">
            <ResultRow label="Power" value={result.result.power.formatted} testId="calc-power-power-result" accent />
            <ResultRow label="Current" value={result.result.current.formatted} testId="calc-power-current-result" accent />
            <ResultRow label="Voltage" value={result.result.voltage.formatted} testId="calc-power-voltage-result" accent />
            <ResultRow label="Resistance" value={result.result.resistance.formatted} testId="calc-power-resistance-result" accent />
            <CalcApplyButtons
              result={{
                calculatorName: 'power-dissipation',
                resultName: 'Resistance',
                value: result.result.resistance.value,
                unit: result.result.resistance.unit,
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export default function CalculatorsView() {
  return (
    <div
      data-testid="calculators-view"
      className="h-full overflow-auto bg-background/50 p-4 md:p-6"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div data-testid="calculators-header">
          <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">
            Engineering Calculators
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quick electronics calculations for common design tasks
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OhmsLawCard />
          <LedResistorCard />
          <VoltageDividerCard />
          <RcTimeConstantCard />
          <FilterCutoffCard />
          <PowerDissipationCard />
        </div>
      </div>
    </div>
  );
}
