import { memo, useState, useCallback, useMemo } from 'react';
import {
  Play,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  solveDCOperatingPoint,
  solverInputToDCCircuit,
  formatVoltage,
  formatCurrent,
  formatPower,
} from '@/lib/simulation/dc-analysis';
import type { DCOperatingPoint } from '@/lib/simulation/dc-analysis';
import type { SolverInput } from '@/lib/simulation/circuit-solver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DCAnalysisPanelProps {
  /** Circuit data in SolverInput format. */
  circuit?: SolverInput | null;
  /** CSS class name for the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// DC Analysis Panel
// ---------------------------------------------------------------------------

const DCAnalysisPanel = memo(function DCAnalysisPanel({
  circuit,
  className,
}: DCAnalysisPanelProps) {
  const [result, setResult] = useState<DCOperatingPoint | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandVoltages, setExpandVoltages] = useState(true);
  const [expandCurrents, setExpandCurrents] = useState(true);
  const [expandPower, setExpandPower] = useState(true);

  // Run the DC analysis
  const handleRunAnalysis = useCallback(() => {
    if (!circuit) {
      setError('No circuit data available');
      setHasRun(true);
      setResult(null);
      return;
    }

    try {
      const dcCircuit = solverInputToDCCircuit(circuit);
      const dcResult = solveDCOperatingPoint(dcCircuit);
      setResult(dcResult);
      setError(null);
      setHasRun(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown analysis error';
      setError(message);
      setResult(null);
      setHasRun(true);
    }
  }, [circuit]);

  // Sorted node voltages (exclude ground for cleaner display, show ground first)
  const sortedVoltages = useMemo(() => {
    if (!result) {
      return [];
    }
    const entries: Array<[string, number]> = [];
    result.nodeVoltages.forEach((voltage, nodeId) => {
      entries.push([nodeId, voltage]);
    });
    // Sort: ground first, then numeric order
    return entries.sort((a, b) => {
      if (a[0] === '0') {
        return -1;
      }
      if (b[0] === '0') {
        return 1;
      }
      const numA = Number(a[0]);
      const numB = Number(b[0]);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a[0].localeCompare(b[0]);
    });
  }, [result]);

  // Sorted branch currents
  const sortedCurrents = useMemo(() => {
    if (!result) {
      return [];
    }
    const entries: Array<[string, number]> = [];
    result.branchCurrents.forEach((current, branchId) => {
      entries.push([branchId, current]);
    });
    return entries.sort((a, b) => a[0].localeCompare(b[0]));
  }, [result]);

  // Sorted power dissipation (non-zero only)
  const sortedPower = useMemo(() => {
    if (!result) {
      return [];
    }
    const entries: Array<[string, number]> = [];
    result.powerDissipation.forEach((power, compId) => {
      if (Math.abs(power) > 1e-15) {
        entries.push([compId, power]);
      }
    });
    return entries.sort((a, b) => b[1] - a[1]); // Highest power first
  }, [result]);

  return (
    <div
      className={cn('flex flex-col h-full bg-card/40', className)}
      data-testid="dc-analysis-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Zap className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground flex-1">
          DC Operating Point
        </span>
        <button
          data-testid="dc-analysis-run"
          onClick={handleRunAnalysis}
          disabled={!circuit}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
            circuit
              ? 'bg-primary/10 hover:bg-primary/20 text-primary'
              : 'bg-muted/30 text-muted-foreground cursor-not-allowed',
          )}
          title="Run DC analysis"
          aria-label="Run DC analysis"
        >
          <Play className="w-3 h-3" />
          Run
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasRun ? (
          <div
            className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 px-4 text-center"
            data-testid="dc-analysis-empty"
          >
            <Zap className="w-8 h-8 text-muted-foreground/20" />
            <span className="text-[10px]">
              Click &quot;Run&quot; to solve the DC operating point
            </span>
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-center justify-center h-full text-destructive gap-2 px-4 text-center"
            data-testid="dc-analysis-error"
          >
            <XCircle className="w-8 h-8" />
            <span className="text-xs font-medium">Analysis Failed</span>
            <span className="text-[10px] text-muted-foreground">{error}</span>
          </div>
        ) : result && !result.converged ? (
          <div
            className="flex flex-col items-center justify-center h-full text-yellow-500 gap-2 px-4 text-center"
            data-testid="dc-analysis-not-converged"
          >
            <XCircle className="w-8 h-8" />
            <span className="text-xs font-medium">Did Not Converge</span>
            <span className="text-[10px] text-muted-foreground">
              The circuit matrix is singular. Check for floating nodes or short circuits.
            </span>
          </div>
        ) : result ? (
          <div className="py-1" data-testid="dc-analysis-results">
            {/* Status bar */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] border-b border-border/50"
              data-testid="dc-analysis-status"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500 font-medium">Converged</span>
              <span className="text-muted-foreground">
                ({result.iterations} iteration{result.iterations !== 1 ? 's' : ''})
              </span>
            </div>

            {/* Node Voltages */}
            <div data-testid="dc-analysis-voltages-section">
              <button
                className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/30 transition-colors text-left"
                onClick={() => setExpandVoltages((v) => !v)}
                data-testid="dc-analysis-voltages-toggle"
              >
                {expandVoltages ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-[10px] font-medium text-foreground flex-1">
                  Node Voltages
                </span>
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {sortedVoltages.length}
                </span>
              </button>
              {expandVoltages && (
                <div className="ml-5 px-2" data-testid="dc-analysis-voltages-list">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/30">
                        <th className="text-left py-0.5 font-medium">Node</th>
                        <th className="text-right py-0.5 font-medium">Voltage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVoltages.map(([nodeId, voltage]) => (
                        <tr
                          key={nodeId}
                          className="hover:bg-accent/10"
                          data-testid={`dc-analysis-voltage-${nodeId}`}
                        >
                          <td className="py-0.5 text-foreground tabular-nums">
                            {nodeId === '0' ? 'GND' : `N${nodeId}`}
                          </td>
                          <td className="py-0.5 text-right text-foreground tabular-nums">
                            {formatVoltage(voltage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Branch Currents */}
            <div data-testid="dc-analysis-currents-section">
              <button
                className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/30 transition-colors text-left"
                onClick={() => setExpandCurrents((v) => !v)}
                data-testid="dc-analysis-currents-toggle"
              >
                {expandCurrents ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-[10px] font-medium text-foreground flex-1">
                  Branch Currents
                </span>
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {sortedCurrents.length}
                </span>
              </button>
              {expandCurrents && (
                <div className="ml-5 px-2" data-testid="dc-analysis-currents-list">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/30">
                        <th className="text-left py-0.5 font-medium">Branch</th>
                        <th className="text-right py-0.5 font-medium">Current</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCurrents.map(([branchId, current]) => (
                        <tr
                          key={branchId}
                          className="hover:bg-accent/10"
                          data-testid={`dc-analysis-current-${branchId}`}
                        >
                          <td className="py-0.5 text-foreground">{branchId}</td>
                          <td className="py-0.5 text-right text-foreground tabular-nums">
                            {formatCurrent(current)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Power Dissipation */}
            <div data-testid="dc-analysis-power-section">
              <button
                className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/30 transition-colors text-left"
                onClick={() => setExpandPower((v) => !v)}
                data-testid="dc-analysis-power-toggle"
              >
                {expandPower ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-[10px] font-medium text-foreground flex-1">
                  Power
                </span>
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {sortedPower.length}
                </span>
              </button>
              {expandPower && (
                <div className="ml-5 px-2" data-testid="dc-analysis-power-list">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/30">
                        <th className="text-left py-0.5 font-medium">Component</th>
                        <th className="text-right py-0.5 font-medium">Power</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPower.map(([compId, power]) => (
                        <tr
                          key={compId}
                          className="hover:bg-accent/10"
                          data-testid={`dc-analysis-power-${compId}`}
                        >
                          <td className="py-0.5 text-foreground">{compId}</td>
                          <td className="py-0.5 text-right text-foreground tabular-nums">
                            {formatPower(power)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Total power summary */}
                  <div
                    className="flex items-center justify-between pt-1.5 mt-1 border-t border-border/30 text-[10px]"
                    data-testid="dc-analysis-total-power"
                  >
                    <span className="font-medium text-foreground">Total</span>
                    <span className="font-medium text-primary tabular-nums">
                      {formatPower(result.totalPower)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default DCAnalysisPanel;
