import { useState, useCallback } from 'react';
import { AlertCircle, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseSpiceNetlist,
  runParsedNetlist,
} from '@/lib/simulation/spice-netlist-parser';
import { mergeDesignVarsIntoNetlist } from '@/lib/simulation/design-var-spice-bridge';
import { VariableStore } from '@shared/design-variables';

import { CollapsibleSection } from './AnalysisParamsForms';

import type { DesignVariable } from '@shared/design-variables';
import type { SimulationResult as SpiceSimResult } from '@/lib/simulation/spice-netlist-parser';

// ---------------------------------------------------------------------------
// SPICE Import Section
// ---------------------------------------------------------------------------

const SAMPLE_SPICE_NETLIST = `* Voltage Divider Example
V1 vcc 0 DC 10
R1 vcc out 10k
R2 out 0 10k
.OP
.END`;

export default function SpiceImportSection() {
  const [netlistText, setNetlistText] = useState('');
  const [spiceRunning, setSpiceRunning] = useState(false);
  const [spiceErrors, setSpiceErrors] = useState<Array<{ line: number; message: string }>>([]);
  const [spiceResult, setSpiceResult] = useState<SpiceSimResult | null>(null);
  const [useDesignVars, setUseDesignVars] = useState(false);

  /** Load design variables from localStorage (same key as DesignVariablesPanel). */
  const loadDesignVars = useCallback((): DesignVariable[] => {
    try {
      const raw = localStorage.getItem('protopulse:design-variables');
      if (!raw) { return []; }
      const vars = JSON.parse(raw) as DesignVariable[];
      if (!Array.isArray(vars)) { return []; }
      // Resolve all so .resolved is populated
      const store = new VariableStore();
      for (const v of vars) {
        if (typeof v.name === 'string' && typeof v.value === 'string') {
          store.addVariable(v);
        }
      }
      store.resolveAll();
      return store.all();
    } catch {
      return [];
    }
  }, []);

  const handleRunSpice = useCallback(async () => {
    if (!netlistText.trim()) {
      return;
    }

    setSpiceRunning(true);
    setSpiceErrors([]);
    setSpiceResult(null);

    try {
      // Optionally merge design variables into the netlist
      let effectiveNetlist = netlistText;
      if (useDesignVars) {
        const vars = loadDesignVars();
        if (vars.length > 0) {
          effectiveNetlist = mergeDesignVarsIntoNetlist(netlistText, vars);
        }
      }

      const parsed = parseSpiceNetlist(effectiveNetlist);

      if (parsed.errors.length > 0) {
        setSpiceErrors(parsed.errors);
      }

      // Only abort if the netlist has no elements at all
      if (parsed.elements.length === 0 && parsed.errors.length > 0) {
        setSpiceRunning(false);
        return;
      }

      const result = await runParsedNetlist(parsed);
      setSpiceResult(result);
    } catch (err) {
      setSpiceErrors([{
        line: 0,
        message: err instanceof Error ? err.message : 'Simulation failed',
      }]);
    } finally {
      setSpiceRunning(false);
    }
  }, [netlistText, useDesignVars, loadDesignVars]);

  return (
    <CollapsibleSection title="Import SPICE Netlist" defaultOpen={false} testId="section-spice-import">
      <div className="flex flex-col gap-3">
        <textarea
          value={netlistText}
          onChange={(e) => setNetlistText(e.target.value)}
          placeholder={SAMPLE_SPICE_NETLIST}
          rows={10}
          disabled={spiceRunning}
          data-testid="spice-netlist-input"
          className={cn(
            'w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground',
            'placeholder:text-muted-foreground/40 resize-y min-h-[120px]',
            'focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-cyan-400/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors',
          )}
        />

        {/* Use Design Variables toggle */}
        <label
          className="flex items-center gap-2 cursor-pointer select-none"
          data-testid="toggle-use-design-vars"
        >
          <input
            type="checkbox"
            checked={useDesignVars}
            onChange={(e) => setUseDesignVars(e.target.checked)}
            className="accent-primary w-3.5 h-3.5"
            data-testid="checkbox-use-design-vars"
          />
          <span className="text-xs text-muted-foreground">
            Use Design Variables
          </span>
          {useDesignVars && (() => {
            const count = loadDesignVars().length;
            return (
              <span className="text-[10px] text-primary/70">
                ({String(count)} var{count !== 1 ? 's' : ''} available)
              </span>
            );
          })()}
        </label>

        {/* Parse errors */}
        {spiceErrors.length > 0 && (
          <div className="flex flex-col gap-1" data-testid="spice-parse-errors">
            {spiceErrors.map((err, i) => (
              <div
                key={`${err.line}-${i}`}
                className="flex items-start gap-2 px-3 py-1.5 text-xs bg-destructive/10 border border-destructive/30 text-destructive"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  {err.line > 0 && <span className="font-mono font-semibold">Line {err.line}: </span>}
                  {err.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Run button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunSpice}
            disabled={spiceRunning || !netlistText.trim()}
            data-testid="run-spice-netlist"
            className={cn(
              'h-8 px-4 flex items-center gap-2 text-xs font-medium transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              spiceRunning
                ? 'bg-muted text-muted-foreground cursor-wait'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
            )}
          >
            {spiceRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                Run SPICE Netlist
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {spiceResult && (
          <div className="border border-border bg-background/50 p-3" data-testid="spice-import-results">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase',
                spiceResult.converged
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-destructive/20 text-destructive border border-destructive/30',
              )}>
                {spiceResult.converged ? 'Converged' : 'Did not converge'}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase">
                {spiceResult.analysisType} analysis
              </span>
            </div>

            {/* Warnings */}
            {spiceResult.warnings.length > 0 && (
              <div className="mb-2 flex flex-col gap-0.5">
                {spiceResult.warnings.map((w, i) => (
                  <span key={i} className="text-[10px] text-amber-400">{w}</span>
                ))}
              </div>
            )}

            {/* DC OP results table */}
            {spiceResult.analysisType === 'op' && spiceResult.dcResult && (
              <div className="overflow-auto max-h-60">
                <table className="w-full text-xs" data-testid="spice-dcop-table">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-1.5 px-2 font-semibold">Node</th>
                      <th className="text-right py-1.5 px-2 font-semibold">Voltage (V)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(spiceResult.nodeMap).map(([nodeName, nodeNum]) => (
                      <tr key={nodeName} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-1 px-2 font-mono text-foreground">{nodeName}</td>
                        <td className="py-1 px-2 text-right font-mono text-primary">
                          {(spiceResult.dcResult!.nodeVoltages[nodeNum] ?? 0).toFixed(6)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Branch currents */}
                {Object.keys(spiceResult.dcResult.branchCurrents).length > 0 && (
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-1.5 px-2 font-semibold">Component</th>
                        <th className="text-right py-1.5 px-2 font-semibold">Current (A)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(spiceResult.dcResult.branchCurrents).map(([compId, current]) => (
                        <tr key={compId} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-1 px-2 font-mono text-foreground">{compId}</td>
                          <td className="py-1 px-2 text-right font-mono text-primary">
                            {current.toExponential(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* DC Sweep summary */}
            {spiceResult.analysisType === 'dc' && spiceResult.dcSweepResult && (
              <p className="text-xs text-muted-foreground">
                DC sweep completed: {spiceResult.dcSweepResult.sweepValues.length} points
              </p>
            )}

            {/* Transient summary */}
            {spiceResult.analysisType === 'tran' && spiceResult.transientResult && (
              <p className="text-xs text-muted-foreground">
                Transient analysis completed: {spiceResult.transientResult.timePoints.length} time points
                {!spiceResult.transientResult.converged && ' (did not converge at some steps)'}
              </p>
            )}

            {/* AC summary */}
            {spiceResult.analysisType === 'ac' && spiceResult.acResult && (
              <p className="text-xs text-muted-foreground">
                AC analysis completed: {spiceResult.acResult.frequencies.length} frequency points
              </p>
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
